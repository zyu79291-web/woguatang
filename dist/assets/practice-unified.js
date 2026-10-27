// WFD practice engine: one state object per question, one audio channel, one input path.
(()=>{
const dock=$('dock'),input=$('typing'),words=$('words'),audio=$('audio');
const blank=()=>({text:'',checked:false,checkedText:'',passed:false,revealed:false,errors:0,fix:null});
const progress=new Map();   // questionKey -> {mode, step, chunks:[item], whole:item, started:{mode:ms}, ended:{mode:ms}}
const SESSION_KEY='woguatang-session-v1';let resumedSession={};
try{resumedSession=JSON.parse(localStorage.getItem(SESSION_KEY)||'{}');for(const [key,entry] of Object.entries(resumedSession.items||{})){
 if(!entry.st?.whole||!Array.isArray(entry.st.chunks))continue;
 const st=entry.st;st.savedSentence=entry.sentence;
 for(const it of [st.whole,...st.chunks])if(Array.isArray(it.booked))it.booked=new Set(it.booked);
 for(const mode of ['whole','chunks'])if(st.started?.[mode]){st.started[mode]=Date.now()-(entry.elapsed?.[mode]||0);if(st.ended?.[mode])st.ended[mode]=Date.now()}
 progress.set(key,st);
}}catch{}
function saveProgress(){
 try{
  const items={};for(const [key,st] of progress){const q=PTE.findQuestion(key);if(!q)continue;const elapsed={};for(const mode of ['whole','chunks'])if(st.started?.[mode])elapsed[mode]=Math.max(0,(st.ended?.[mode]||Date.now())-st.started[mode]);items[key]={sentence:q.sentence,st,elapsed}}
  localStorage.setItem(SESSION_KEY,JSON.stringify({v:1,punishmentEnabled,practiceOrder:PTE.practiceOrder,active:PTE.active?.questionKey||resumedSession.active,items},(key,value)=>value instanceof Set?[...value]:value));
 }catch{}
}
PTE.flushProgress=saveProgress;window.addEventListener('pagehide',saveProgress);
const heard=new Set();      // questionKey:mode:step already played by clicking into the input
let preferredMode='whole',sound=true,autoListen=true,advanceTimer=0,checkTimer=0,cheerTimer=0,composing=false;
let answerVisible=false,loopEnabled=false,punishmentEnabled=resumedSession.punishmentEnabled===true;
let streak=0;               // consecutive phrases passed without the answer and with at most one miss

// ---------- State ----------
const question=()=>PTE.active;
const parts=()=>PTE.phrasesOf(question());
function stateOf(q){
 let st=progress.get(q.questionKey);
 if(st?.savedSentence&&st.savedSentence!==q.sentence){progress.delete(q.questionKey);st=null}
 if(!st){st={mode:preferredMode,step:0,chunks:PTE.phrasesOf(q).map(blank),whole:blank(),started:{},ended:{},roundRecorded:false};progress.set(q.questionKey,st)}
 st.mode='whole';
 if(seedRoundHistory(q,st))PTE.saveStates?.();
 return st;
}
const state=()=>stateOf(question());
const item=(st=state())=>st.mode==='whole'?st.whole:st.chunks[st.step];
const target=(st=state())=>st.mode==='whole'?question().sentence:parts()[st.step];
const finished=(st=state())=>st.mode==='whole'?st.whole.passed:st.chunks.every(c=>c.passed);
const stepKey=(st=state())=>`${question().questionKey}:${st.mode}:${st.step}`;
const exact=text=>tokens(text).join(' ')===tokens(target()).join(' ');
// After a wrong Enter the line becomes one slot per target word (it.fix): correct words stay locked where they are and
// only wrong or missing ones are retyped. The input then holds just the word being fixed, selected so typing replaces it.
const expected=()=>tokens(target());
const typed=(it=item())=>it.fix?it.fix.slots.join(' ').trim():input.value;
function alignSlots(exp,act){
 const slots=Array(exp.length).fill('');let i0=0,j0=0;
 for(const [i,j] of [...matchedPairs(exp,act),[exp.length,act.length]]){
  for(let k=0;k<i-i0;k++)slots[i0+k]=j0+k<j?act[j0+k]:'';   // words typed between two correct ones fill that gap in order
  if(i<exp.length)slots[i]=act[j];
  i0=i+1;j0=j+1;
 }
 return slots;
}
const slotOk=(f,i,exp)=>tokens(f.slots[i]).join(' ')===exp[i];
function editable(f,from,step){for(let i=from+step;i>=0&&i<f.slots.length;i+=step)if(!f.ok[i])return i;return -1}
function openSlot(i,{select=false,at=null}={}){
 const f=item().fix;if(!f||i<0)return;
 f.at=i;input.value=f.slots[i];
 f.replaceOnType=!f.ok[i]&&input.value&&(!f.marked||input.value===f.marked[i])?i:null;
 const n=input.value.length,p=select?0:at==null?n:Math.min(at,n);
 input.setSelectionRange(p,select?n:p);drawWords();
}
// A collapsed mouse/arrow caret must replace the marked mistake too, not insert into it.
function prepareCorrectionReplacement(){
 if(!question()||input.readOnly)return;
 const f=item().fix;if(!f||f.ok[f.at])return;
 if(f.replaceOnType===undefined&&input.value===f.marked?.[f.at])f.replaceOnType=f.at;
 if(f.replaceOnType!==f.at)return;
 input.setSelectionRange(0,input.value.length);f.replaceOnType=null;
}
function correctionBeforeInput(e){
 const kind=e.inputType||'';
 if(kind.startsWith('delete')){if(question()&&item().fix)item().fix.replaceOnType=null;return}
 if(kind.startsWith('insert')&&(kind!=='insertText'||/\S/.test(e.data||'')))prepareCorrectionReplacement();
}
// Typing in a slot; a space finishes the word and moves on to the next word still to fix.
function fixInput(f){
 const parts=input.value.split(/\s+/);f.slots[f.at]=parts[0];
 if(parts.length<2)return;
 let i=f.at;
 for(const w of parts.slice(1)){const next=editable(f,i,1);if(next<0)break;i=next;if(w)f.slots[i]=w}
 if(i===f.at){input.value=parts[0];toEnd();return}
 openSlot(i,parts.at(-1)?{}:{select:true});
}
// Both practice modes share the same word-by-word correction path.
function selectFirstMistake(f){
 const first=f.ok.indexOf(false);
 if(first<0)return;
 focusInput();openSlot(first,{select:true});
}
function markCorrections(it,value){
 const exp=expected(),f=it.fix||{slots:alignSlots(exp,tokens(value)),at:0};
 f.ok=f.slots.map((_,i)=>slotOk(f,i,exp));f.marked=f.slots.slice();
 bookWords(it,exp,f);it.fix=f;it.text=typed(it);it.checked=true;it.checkedText=it.text;it.errors++;
 return f;
}
// Lifetime question counts live beside practice status, so resets and weekly bank updates keep them.
function seedRoundHistory(q,st){
 const saved=PTE.states[q.questionKey]||{};
 if(Number.isSafeInteger(saved.practiceRounds))return false;
 const begun=typeof st.roundRecorded==='boolean'?st.roundRecorded:
  !!(st.whole.text||st.whole.checked||st.whole.passed||st.started?.whole||st.punishment?.listens);
 const p=st.punishment,known=p?.v===2&&Number.isSafeInteger(p.round)?Math.max(0,p.round-(begun?0:1)):begun?1:0;
 if(st.roundRecorded===undefined)st.roundRecorded=begun;
 if(!known)return false;
 PTE.states[q.questionKey]={...saved,practiceRounds:known,roundHistoryPartial:true};
 return true;
}
function recordRound(q,st){
 const seeded=seedRoundHistory(q,st);
 if(st.roundRecorded){if(seeded)PTE.saveStates?.();return}
 st.roundRecorded=true;
 const saved=PTE.states[q.questionKey]||{},n=Number.isSafeInteger(saved.practiceRounds)?saved.practiceRounds:0;
 PTE.setState(q.questionKey,{practiceRounds:n+1,roundHistoryPartial:saved.roundHistoryPartial??!!saved.practiced,started:true});
 if(question()===q)$('practiceRounds').textContent=PTE.roundLabel?.(q.questionKey)||`累计 ${n+1} 轮`;
 saveProgress();
}
function hideAnswerForTyping(){
 if(!answerVisible)return;
 answerVisible=false;
 $('reference').hidden=true;$('reference').textContent='';$('cue').textContent='';
 document.querySelector('.cue-line').hidden=true;
 $('show').setAttribute('aria-pressed','false');$('show').textContent='答案';
 // The answer was still seen in this round; only its visibility changes.
}
function resetQuestion(q,{keepPunishment=false,sameRound=false}={}){
 const previous=progress.get(q.questionKey),saved=keepPunishment&&previous?.punishment&&(sameRound||!previous.whole.passed)?previous.punishment:null;
 const mode=progress.get(q.questionKey)?.mode;
 progress.delete(q.questionKey);
 for(const key of heard)if(key.startsWith(q.questionKey+':'))heard.delete(key);
 const st=stateOf(q);
 if(saved){st.punishment=sameRound?{...saved,awaiting:false}:newPunishmentRound(saved);st.started=previous.started}
 if(sameRound&&previous){
  st.roundRecorded=previous.roundRecorded;st.started=previous.started;
  // Clearing the line is another try within this round, with the same exposure/error history.
  st.whole.errors=previous.whole.errors;st.whole.revealed=previous.whole.revealed;
  if(previous.whole.booked)st.whole.booked=new Set(previous.whole.booked);
 }
 if(mode&&st.chunks.length>1)st.mode=mode;return st;
}
function clearTimers(){clearTimeout(advanceTimer);clearTimeout(checkTimer);hideCheer()}
// Rating shown after each phrase and for the whole question.
const rate=it=>it.revealed?'Done':it.errors===0?'Perfect':it.errors===1?'Great':'Good';
const dockHidden=()=>dock.hidden;
PTE.focusPractice=()=>focusInput();
function focusInput(){if(dockHidden()||!question())return;input.focus({preventScroll:true});toEnd()}
function toEnd(){if(composing)return;const n=input.value.length;if(input.selectionStart!==n||input.selectionEnd!==n)input.setSelectionRange(n,n)}
// Typed words with their character ranges in the input, split exactly like tokens().
function typedRanges(value){
 const out=[],re=/[a-z0-9]+(?:'[a-z0-9]+)*/g,s=value.toLowerCase().replace(/[‘’]/g,"'");let m;
 while((m=re.exec(s)))out.push([m.index,m.index+m[0].length]);
 return out;
}
// Where the caret is when the learner went back to edit: {word, at} (letter offset inside that word);
// null while typing at the end.
function caretWord(value){
 const pos=input.selectionStart??value.length;if(document.activeElement!==input||pos>=value.length)return null;
 const ranges=typedRanges(value);const j=ranges.findIndex(r=>pos<=r[1]);
 return j<0?null:{word:j,at:Math.max(0,pos-ranges[j][0])};
}
// Letter boundary nearest to x inside a word slot (its text is monospace and maps 1:1 to the typed letters).
function letterOffset(el,x){
 const nodes=[...el.childNodes].filter(n=>n.nodeType===3&&n.length),len=el.textContent.length;
 if(!nodes.length)return 0;
 const range=document.createRange();range.setStart(nodes[0],0);range.setEnd(nodes.at(-1),nodes.at(-1).length);
 const box=range.getBoundingClientRect();if(!box.width)return len;
 return Math.max(0,Math.min(len,Math.round((x-box.left)/(box.width/len))));
}
// Clicking a word puts the caret between the letters under the pointer; clicking past the typed words goes to the end.
function placeCaretAt(x,y){
 if(composing||input.readOnly)return;
 const value=input.value,ranges=typedRanges(value),slots=[...words.children];let hit=-1,best=Infinity;
 slots.forEach((el,i)=>{const r=el.getBoundingClientRect();if(y<r.top-8||y>r.bottom+8)return;const d=x<r.left?r.left-x:x>r.right?x-r.right:0;if(d<best){best=d;hit=i}});
 const f=item().fix;
 if(f){   // correcting: clicking a word still to fix opens it; correct words stay locked
  if(hit>=0&&!f.ok[hit])openSlot(hit,{at:letterOffset(slots[hit],x)});else{toEnd();drawWords()}
  return;
 }
 const pos=hit>=0&&hit<ranges.length?Math.min(ranges[hit][1],ranges[hit][0]+letterOffset(slots[hit],x)):value.length;
 input.setSelectionRange(pos,pos);drawWords();
}
function note(text){$('status').textContent=text||''}
// Deep-link landing: if the browser blocks the first sound, a large start button covers the line until tapped.
const startGate=$('startGate');
function gate(on){if(startGate)startGate.hidden=!on}

// ---------- Audio (single channel; every new request cancels the old one) ----------
const player={seq:0,kind:null,timer:0};
function updateLoopButton(){
 const button=$('loopAudio');button.textContent=loopEnabled?'暂停循环':'循环播放';
 button.setAttribute('aria-pressed',String(loopEnabled));button.setAttribute('aria-label',loopEnabled?'暂停循环播放':'循环播放当前题');
 button.title=(loopEnabled?'停止循环播放':'循环播放当前题')+'（Alt+L）';button.setAttribute('aria-keyshortcuts','Alt+L');
}
function cancelAudio({keepLoop=false}={}){
 player.seq++;player.kind=null;clearTimeout(player.timer);audio.onended=audio.onerror=null;audio.pause();gate(false);
 if(!keepLoop)loopEnabled=false;audio.loop=loopEnabled;updateLoopButton();
}
async function playOnce(src,seq,qid=question()?.questionId){

 if(!src)throw Error('缺少本题原版录音');
 if(seq!==player.seq)return;
 // Capture this round before playback: a cancelled request must never charge a new round.
 const q=question(),st=q?.questionId===qid?state():null,practice=player.kind==='current';
 const p=punishmentEnabled&&st&&!finished(st)?punishment():null;
 return new Promise((resolve,reject)=>{
  audio.src=src;audio.onended=resolve;audio.onerror=()=>reject(Error('原版录音加载失败'));
  audio.play().then(()=>{
   if(seq!==player.seq||question()!==q||!st||state()!==st)return;
   if(practice&&!finished(st))recordRound(q,st);
   if(!p||!punishmentEnabled||st.punishment!==p)return;
   p.listens++;
   if(p.listens>1)invalidatePunishment('本轮已重听');
   else{renderPunishment();saveProgress()}
  },reject);
 });

}
// Server messages (rate limit with wait time, bank updated) are shown as is; media load failures stay generic.
function reportAudio(error,seq){if(seq!==player.seq)return;note(error?.name==='NotAllowedError'?'点击“重听”开启声音':error?.name!=='LoadError'&&error?.message&&error.message!=='audio'?error.message:'音频未能播放，请点“重听”重试')}
// A phrase without its own recording falls back to the original whole-sentence audio (never synthetic speech).
const phraseFallback=()=>{const st=state();return st.mode==='chunks'&&!finished(st)&&!PTE.phraseAudio(question(),st.step)&&!!question().audioUrl};
function currentSource(){const st=state();return finished(st)||st.mode==='whole'?question().audioUrl||null:PTE.phraseAudio(question(),st.step)||question().audioUrl||null}
// Nothing plays by itself: clicking into the input or “重听” plays the current step once, like the real exam.
async function playCurrent(){
 if(!question()||dockHidden())return;
 const st=state();
 cancelAudio({keepLoop:true});const src=currentSource();
 if(!src){note(st.mode==='whole'||st.chunks.length<2?'本题暂无音频，可以看答案练习':'本意群暂无音频，可以练整句或看答案');return}
 const seq=player.seq,key=stepKey(st);player.kind='current';heard.add(key);
 note(phraseFallback()?'本题暂无意群音频，先播放整句':'');
 try{await playOnce(src,seq)}
 catch(e){if(e?.name==='NotAllowedError')heard.delete(key);reportAudio(e,seq)}
 if(seq===player.seq)player.kind=null;
}
// Choosing a sentence in the list plays the whole sentence once; after that a click into the line does not play again
// (only “重听” does), also in meaning-group practice. Passing a meaning group plays the next one by itself.
async function playChosen({useGate=false}={}){
 if(!autoListen||!question()||dockHidden())return;
 const st=state(),src=question().audioUrl;if(!src||finished(st)||item(st).passed)return;
 cancelAudio();
 const seq=player.seq,key=stepKey(st);
 player.kind='current';heard.add(key);note('');
 try{await playOnce(src,seq)}
 catch(e){
  if(e?.name==='NotAllowedError')heard.delete(key);
  // Phones may block sound started from the list (it waits for the study data); a tap on the line then plays it.
  if(e?.name==='NotAllowedError'){if(seq===player.seq)useGate?gate(true):note('点一下练习区开始播放')}else reportAudio(e,seq);
 }
 if(seq===player.seq)player.kind=null;
}
startGate?.addEventListener('click',e=>{e.stopPropagation();gate(false);focusInput();void playChosen()});
// Wrong-word spelling review plays a question's whole sentence on the same channel; returns a message if it cannot.
PTE.stopAudio=cancelAudio;
PTE.playSentence=async q=>{
 cancelAudio();const seq=player.seq;
 try{
  if(!q.audioUrl&&!await ACCESS.ensureStudy(q))return '音频未能播放，请再点一次';
  if(!q.audioUrl)return '本题暂无音频';
  player.kind='book';await playOnce(q.audioUrl,seq,q.questionId);
 }catch(e){return seq!==player.seq?'':e?.name==='NotAllowedError'?'点“听原句”开启声音':e?.name!=='LoadError'&&e?.message&&e.message!=='audio'?e.message:'音频未能播放，请再点一次'}
 finally{if(seq===player.seq)player.kind=null}
};
function maybeAutoplay(){
 if(!autoListen||!question()||dockHidden())return;
 const st=state();if(finished(st)||item(st).passed||heard.has(stepKey(st))||(punishmentEnabled&&punishment().listens>0))return;
 void playCurrent();
}

// ---------- Sounds ----------
let audioContext,keyTonedAt=0,composed='',lastKeyAt=0,keySoundsLoading=false;
const keySounds={},keyTurn={};   // set -> decoded AudioBuffers / rotation counter
const FAST_KEY_MS=130;           // keys closer together than this use the lighter “fast” set
function context(){
 // iOS mutes Web Audio under the silent switch unless the page asks for playback (the dictation audio already plays).
 if(!audioContext){try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}}
 audioContext||=new (window.AudioContext||window.webkitAudioContext)();void audioContext.resume();
 loadKeySounds();return audioContext;
}
// Key sounds are recorded switch clicks (Kenney “UI Audio”, CC0) embedded below as WAV. They are decoded once,
// shortly after load, in an offline context (no user gesture needed), so even the first key has its sound.
function loadKeySounds(){
 if(keySoundsLoading)return;
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;let ctx;
 try{ctx=Offline?new Offline(1,1,32000):audioContext}catch{ctx=audioContext}
 if(!ctx)return;keySoundsLoading=true;
 for(const [set,list] of Object.entries(KEY_SAMPLES)){
  keySounds[set]=[];
  list.forEach((b64,i)=>{
   const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),done=buffer=>{keySounds[set][i]=buffer};
   try{const p=ctx.decodeAudioData(bytes.buffer,done,()=>{});if(p&&p.then)p.then(done,()=>{})}catch{}   // old Safari: callbacks only
  });
 }
}
// Phones only let a page start sound from a tap, so the first tap on the input wakes the sound engine with silence.
function unlockSound(){
 if(!sound)return;
 try{const ctx=context();if(ctx.state==='running'&&ctx.unlocked)return;const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,22050);s.connect(ctx.destination);s.start();ctx.unlocked=true}catch{}
}
function chime(ctx,notes,gainPeak,type){const now=ctx.currentTime;notes.forEach(([frequency,start,end],index)=>{const o=ctx.createOscillator(),g=ctx.createGain(),at=now+index*.085;o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(end,at+.1);g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(gainPeak,at+.006);g.gain.exponentialRampToValueAtTime(.001,at+start);o.connect(g);g.connect(ctx.destination);o.onended=()=>{o.disconnect();g.disconnect()};o.start(at);o.stop(at+start+.02)})}
function tone(kind){
 if(!sound)return;
 try{const ctx=context();
  if(kind==='success'){chime(ctx,[[660,.16,700],[990,.22,1040]],.14,'sine');return}
  if(kind==='complete'){chime(ctx,[[523,.18,540],[659,.18,680],[784,.2,800],[1047,.36,1060]],.13,'sine');return}
  if(kind==='error'){chime(ctx,[[220,.11,176],[165,.11,132]],.2,'triangle');return}
  // Letters use the slow or fast set by the gap since the previous key; space and backspace have their own.
  const now=performance.now(),set=kind==='space'?'space':kind==='backspace'?'back':now-lastKeyAt<FAST_KEY_MS?'fast':'slow';
  lastKeyAt=now;
  const list=(keySounds[set]||[]).filter(Boolean);if(!list.length)return;   // still decoding
  const source=ctx.createBufferSource();source.buffer=list[(keyTurn[set]=(keyTurn[set]||0)+1)%list.length];
  source.playbackRate.value=1+(Math.random()-.5)*.04;
  source.connect(ctx.destination);source.onended=()=>source.disconnect();source.start();
  input.dataset.keySoundCount=String(Number(input.dataset.keySoundCount||0)+1);
 }catch{}
}
// One keydown path. IME keys arrive as "Process"/229, so read the physical key code instead.
function keySound(e){
 if(e.ctrlKey||e.metaKey||e.altKey||e.target.readOnly)return;
 const ime=e.isComposing||e.key==='Process'||e.keyCode===229;let kind=null;
 if(ime){if(/^(Key[A-Z]|Digit\d|Quote|Minus|Comma|Period)$/.test(e.code))kind='key';else if(e.code==='Space')kind='space';else if(e.code==='Backspace')kind='backspace'}
 else if(e.key==='Backspace')kind='backspace';else if(e.key===' ')kind='space';else if(e.key.length===1)kind='key';
 if(kind){keyTonedAt=performance.now();tone(kind)}
}
// Phone keyboards send keydown as “Unidentified”/229 with no key code, so the sound comes from the edit itself.
// One keystroke can fire beforeinput, compositionupdate and input; whichever comes first sounds, unless keydown already did.
// Chinese keyboards that keep the pinyin inside the keyboard send nothing until a word is committed.
function editTone(kind,el=input){
 if(!kind||el.readOnly||performance.now()-keyTonedAt<80)return;
 keyTonedAt=performance.now();tone(kind);
}
function compositionKind(data){const kind=data.length<composed.length?'backspace':/\s$/.test(data)?'space':'key';composed=data;return kind}
function editSound(e){
 const type=e.inputType||'',data=e.data||'',el=e.target;
 if(type.startsWith('delete'))editTone('backspace',el);
 else if(type==='insertCompositionText')editTone(compositionKind(data),el);
 else if(type==='insertText'||type==='insertReplacementText')editTone(/^\s+$/.test(data)?'space':'key',el);
 else if(!type&&e.type==='input')editTone('key',el);
}
// The wrong-word spelling box sounds like the practice line: same key samples, same success/error chimes and shake.
PTE.typingSounds=el=>{
 el.addEventListener('compositionstart',()=>{composed=''});
 el.addEventListener('compositionupdate',e=>editTone(compositionKind(e.data||''),el));
 el.addEventListener('beforeinput',editSound);el.addEventListener('input',editSound);
 el.addEventListener('keydown',keySound);el.addEventListener('pointerdown',unlockSound);
};
PTE.tone=tone;
function shake(){
 words.dataset.errorFeedbackCount=String(Number(words.dataset.errorFeedbackCount||0)+1);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){words.getAnimations().forEach(a=>a.cancel());words.animate([0,-9,8,-6,4,-2,0].map(x=>({transform:`translateX(${x}px)`})),{duration:340,easing:'ease-out'})}
 tone('error');
}

// ---------- Rendering ----------
// [target index, typed index] of typed words that match the target in order (longest common subsequence).
function matchedPairs(expected,actual){
 const d=Array.from({length:expected.length+1},()=>Array(actual.length+1).fill(0));
 for(let i=expected.length-1;i>=0;i--)for(let j=actual.length-1;j>=0;j--)d[i][j]=expected[i]===actual[j]?1+d[i+1][j+1]:Math.max(d[i+1][j],d[i][j+1]);
 const out=[];let i=0,j=0;
 while(i<expected.length&&j<actual.length){if(expected[i]===actual[j]){out.push([i,j]);i++;j++}else if(d[i+1][j]>=d[i][j+1])i++;else j++}
 return out;
}
const matchedIndexes=(expected,actual)=>new Set(matchedPairs(expected,actual).map(p=>p[1]));
// caret: letter offset for a caret drawn inside the word (null = at its end, shown by .current:after).
const slot=(text,kind,current,width,caret=null)=>{
 const inner=!text?'&nbsp;':caret==null||caret>=text.length?esc(text):`${esc(text.slice(0,caret))}<span class="caret" aria-hidden="true"></span>${esc(text.slice(caret))}`;
 const mid=caret!=null&&text&&caret<text.length;
 return `<span class="word${kind?' '+kind:''}${current?' current':''}${mid?' caret-mid':''}" style="min-width:${(Math.max(2,width)*.62+.3).toFixed(2)}em">${inner}</span>`;
};
// Passed words: original casing, coloured by part of speech with IPA above and the gloss below when notes exist.
const shownWords=s=>String(s).replace(/[‘’]/g,"'").match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g)||[];
function tokenOffset(st){return st.mode==='whole'?0:parts().slice(0,st.step).reduce((n,p)=>n+tokens(p).length,0)}
function annotated(word,note){
 if(!note)return slot(word,'correct',false,word.length);
 return `<span class="word correct annotated pos-${esc(note.pos)}"><span class="ipa">/${esc(note.ipa)}/</span><span class="w">${esc(word)}</span><span class="gloss">${esc(note.gloss)}</span><span class="pos">${esc(PTE.posLabels[note.pos]||'')}</span></span>`;
}
const hasNotes=()=>!!PTE.notes[question()?.questionId];
function drawWords(){
 const st=state(),it=item(st),done=finished(st);
 if(done||it.passed){
  const q=question(),offset=done?0:tokenOffset(st);
  words.classList.toggle('annotated-line',hasNotes());
  words.innerHTML=shownWords(done?q.sentence:target(st)).map((w,i)=>annotated(w,PTE.noteFor(q,offset+i))).join('');
  if(PTE.notes[q.questionId]?.length)ACCESS.feature(q.questionId,'notes');
  return;
 }
 words.classList.remove('annotated-line');
 if(it.fix){
  const f=it.fix,sel=document.activeElement===input&&input.selectionStart!==input.selectionEnd,pos=input.selectionStart??input.value.length;
  words.innerHTML=tokens(target(st)).map((e,i)=>{
   const cur=i===f.at,text=cur?input.value:f.slots[i];
   const kind=f.ok[i]?'correct':text===f.marked[i]?(text?'wrong':'missing'):'';
   return slot(text,[kind,cur&&sel?'selected':''].filter(Boolean).join(' '),cur,e.length,cur&&!sel&&pos<text.length?pos:null);
  }).join('');
  return;
 }
 const expected=tokens(target(st)),value=input.value,actual=tokens(value),atGap=!value||/\s$/.test(value);
 const editing=caretWord(value),current=editing?editing.word:(atGap?actual.length:actual.length-1);
 const matched=it.checked?matchedIndexes(expected,actual):new Set();
 const html=actual.map((w,j)=>{
  let kind='';
  if(it.checked){const settled=j<actual.length-1||atGap||value===it.checkedText;kind=matched.has(j)?'correct':settled?'wrong':''}
  return slot(w,kind,j===current,(expected[j]||w).length,editing&&j===current?editing.at:null);
 });
 for(let i=actual.length;i<expected.length;i++)html.push(slot('',it.checked?'missing':'',i===current,expected[i].length));
 if(current>=html.length)html.push(slot('','',true,2));
 words.innerHTML=html.join('');
}
// A round passes only on its first submission after one listen, with no answer exposure.
function newPunishmentRound(previous){
 return {v:2,round:(previous?.round||0)+1,listens:0,submissions:0,
  reason:'',misses:previous?.misses||0,awaiting:false,blocked:previous?.blocked||false};
}
function punishment(){
 const st=state();
 if(st.punishment?.v!==2){
  const previous=st.punishment;
  st.punishment=newPunishmentRound(previous);
  // Old attempts have no reliable listen count. Keep their draft and all completed records.
  if(!finished(st)&&(previous||st.whole.text||st.whole.revealed||st.whole.errors)){
   st.punishment.reason='旧规则下的练习';st.punishment.blocked=true;
  }
 }
 return st.punishment;
}
function invalidatePunishment(reason){
 if(!punishmentEnabled||!question()||finished())return;
 const p=punishment();p.reason||=reason;p.blocked=true;
 renderPunishment();saveProgress();
}
function renderPunishment(){
 const p=punishment(),on=punishmentEnabled;
 $('punishmentToggle').textContent='一遍过';
 $('punishmentToggle').title=on?'关闭一遍过挑战':'开启一遍过挑战';
 $('punishmentToggle').setAttribute('aria-pressed',String(on));
 $('punishmentProgress').hidden=!on;
 const progressLabel=$('punishmentProgress');
 const reason=p.reason.replace(/^本轮/,'').replace('首次提交未全对','首答未全对');
 progressLabel.textContent=finished()?'已通关':`第 ${p.round} 轮 · ${reason||('已听 '+p.listens+' 遍')}`;
 progressLabel.dataset.state=finished()?'passed':p.reason?'retry':'ready';
 progressLabel.title=p.reason?`${p.reason}；本轮全部写对后，按 Enter 重开一轮`:p.listens?'首次提交全对即可通关':'先听一遍录音，再独立听写';
 $('punishmentHelp').hidden=!on;if(!on)$('punishmentHelp').open=false;
 $('punishmentRetry').hidden=!on||(!p.reason&&!p.awaiting)||finished();
 for(const id of ['nextQuestion','next','nextDone']){
  $(id).disabled=on&&p.blocked;
  $(id).title=on&&p.blocked?'请重新开始一轮并通关，或关闭一遍过':'';
 }
}
function nextPunishmentAttempt(){
 if(!punishmentEnabled||!question())return;
 restart({replay:true});
}
function checkPunishment(fromEnter){
 const it=item(),p=punishment(),value=typed(it);
 if(!fromEnter)return;
 if(!tokens(value).length){note('先把本轮完整写对，再按 Enter。');return}
 if(it.checked&&it.checkedText===value&&!exact(value)){
  if(it.fix)selectFirstMistake(it.fix);
  note('');return;
 }
 ACCESS.activity(question().questionId,'answer');p.submissions++;
 if(!exact(value)){
  const f=markCorrections(it,value);
  p.awaiting=false;p.misses++;invalidatePunishment('本轮首次提交未全对');
  render();selectFirstMistake(f);note('');return;
 }
 const clean=p.listens===1&&p.submissions===1&&!p.reason&&!it.errors&&!it.revealed;
 if(clean){p.blocked=false;p.awaiting=false;pass();return}
 invalidatePunishment(it.revealed?'本轮已看答案':p.listens!==1?'本轮未只听一遍录音':'本轮不是首次提交');
 nextPunishmentAttempt();note('本轮已全部写对，开始新一轮独立听写。');
}

function render(){
 const q=question();if(!q)return;
 const st=state(),it=item(st),p=parts(),whole=st.mode==='whole',done=finished(st),split=p.length>1;
 if(!whole&&!done&&split)ACCESS.feature(q.questionId,'chunks');
 updateCount();
 $('practiceRounds').textContent=PTE.roundLabel?.(q.questionKey)||`累计 ${PTE.states[q.questionKey]?.practiceRounds||0} 轮`;
 $('mode').textContent=done?'本题完成':'整句听写';
 // English stays hidden while listening; a failed check only marks the words. “答案” reveals it until the phrase is
 // passed, after which the green words themselves show the answer.
 const showReference=answerVisible;
 $('reference').hidden=!showReference;$('reference').textContent=showReference?(done?q.sentence:target(st)):'';
 $('cue').textContent=answerVisible?(done||whole?q.translation:PTE.phraseChinese(q,st.step)):'';
 document.querySelector('.cue-line').hidden=!answerVisible;
 const shownText=done?'':it.fix&&!it.passed?it.fix.slots[it.fix.at]:it.text;
 if(!composing&&input.value!==shownText)input.value=shownText;
 input.readOnly=done||it.passed;
 $('lineInput').classList.toggle('is-checked',it.checked&&!it.passed);
 drawWords();
 $('show').hidden=false;$('show').setAttribute('aria-pressed',String(answerVisible));
 $('show').textContent=answerVisible?'隐藏答案':'答案';
 $('play').setAttribute('aria-label',done||whole?'重听整句':'重听整句');
 $('play').disabled=!currentSource();$('loopAudio').disabled=!currentSource();updateLoopButton();
 $('doneBar').hidden=!done;
 if(done)renderResult(st);
 note(!done&&!it.passed&&!it.text&&currentSource()&&!heard.has(stepKey(st))?'点一下练习区开始播放':'');
 renderPunishment();PTE.viewportChanged?.();saveProgress();
}
// Settlement card: rating, time, first-try phrases and misses for the mode just finished.
function renderResult(st){
 const items=st.mode==='whole'?[st.whole]:st.chunks;
 const errors=punishmentEnabled?punishment().misses:items.reduce((n,it)=>n+it.errors,0),revealed=items.filter(it=>it.revealed).length,firstTry=items.filter(it=>!it.errors&&!it.revealed).length;
 const title=revealed?'完成':errors===0?'Perfect':errors<=2?'Great':'Good';
 const seconds=Math.max(0,Math.round(((st.ended[st.mode]||Date.now())-(st.started[st.mode]||Date.now()))/1000));
 $('resultTitle').textContent=title+'!';$('resultTitle').dataset.level=title;
 // Internal notes (variants, easily-confused words) only after finishing, so they never give the answer away.
 $('resultNote').textContent=question().notes||'';
 const booked=items.reduce((n,it)=>n+(it.booked?.size||0),0);
 $('resultStats').innerHTML=[`用时 <b>${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}</b>`,items.length>1?`一次答对 <b>${firstTry}/${items.length}</b>`:'',`出错 <b>${errors}</b> 次`,revealed?`看答案 <b>${revealed}</b> 次`:'',booked?`<button type="button" class="book-link" data-book>收进错词本 <b>${booked}</b> 个 ›</button>`:''].filter(Boolean).join('<span class="sep">·</span>');
}
function cheer(label){
 const el=$('cheer');clearTimeout(cheerTimer);
 el.textContent=streak>=1&&label!=='Good'&&label!=='Done'?`${label} × ${streak}`:label;el.dataset.level=label;el.hidden=false;
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{transform:'translate(-50%,6px) scale(.7)',opacity:0},{transform:'translate(-50%,0) scale(1.08)',opacity:1,offset:.6},{transform:'translate(-50%,0) scale(1)',opacity:1}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
 cheerTimer=setTimeout(hideCheer,1100);
}
function hideCheer(){clearTimeout(cheerTimer);const el=$('cheer');if(el)el.hidden=true}

// ---------- Flow ----------
function check(fromEnter){
 if(!question())return;const it=item();if(it.passed||finished())return;
 if(punishmentEnabled){checkPunishment(fromEnter);return}
 const value=typed(it);
 if(tokens(value).length)ACCESS.activity(question().questionId,'answer');
 if(exact(value)){pass();return}
 if(!fromEnter||!tokens(value).length)return;
 // Lock correct words and select the first mistake, ready to be replaced by typing.
 const f=markCorrections(it,value);
 render();selectFirstMistake(f);shake();

}
// The book entry each target word belongs to: the word as written, a hyphenated word kept whole (re-enrollments).
function bookUnits(text){
 const out=[];
 for(const [m] of String(text).replace(/[‘’]/g,"'").matchAll(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*(?:-[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*)*/g))
  for(const _ of tokens(m))out.push(m);
 return out;
}
// Wrong-word book: every word marked wrong or missing goes in once per attempt (it.booked holds those entries).
// On the first check without the answer shown, words already in the book that are right this time count towards
// leaving it. f is null when the whole line is right.
function bookWords(it,exp,f){
 const q=question(),st=state(),units=bookUnits(target(st)),offset=tokenOffset(st),booked=it.booked||=new Set();
 const key=i=>(units[i]||exp[i]).toLowerCase(),wrong=new Map();let changed=false;
 exp.forEach((w,i)=>{if(f?.ok[i]===false){const k=key(i);wrong.set(k,[...(wrong.get(k)||[]),i])}});
 for(const [k,at] of wrong){
  const was=at.map(i=>tokens(f.slots[i]).join(' ')).filter(Boolean).join(' ');
  if(booked.has(k)||PTE.book.skip(k,was))continue;
  booked.add(k);PTE.book.miss(q,k,units[at[0]]||k,was,PTE.noteFor(q,offset+at[0]));changed=true;
 }
 if(!it.errors&&!it.revealed)for(const k of new Set(exp.map((_,i)=>key(i))))if(!wrong.has(k)&&PTE.book.credit(k))changed=true;
 if(changed)PTE.book.save();
}
function pass(){
 const st=state(),it=item(st),q=question(),label=rate(it);
 if(!it.errors&&!it.revealed)bookWords(it,expected(),null);
 it.passed=true;it.text=typed(it);clearTimers();if(!loopEnabled)cancelAudio();
 streak=it.revealed||it.errors>1?0:streak+1;
 if(finished(st)){PTE.dailyStats?.complete(q);st.ended[st.mode]=Date.now();tone('complete');PTE.setState(q.questionKey,{practiced:true,started:true});render();return}
 tone('success');
 if(!PTE.states[q.questionKey]?.started)PTE.setState(q.questionKey,{started:true});
 render();cheer(label);
 if(st.mode==='chunks'){const key=stepKey(st);advanceTimer=setTimeout(()=>{if(question()===q&&stepKey()===key)advance()},hasNotes()?1600:950)}
}
function advance(){
 clearTimers();const st=state();
 if(st.mode==='whole'||finished(st)){render();return}
 const n=st.chunks.length;let next=-1;
 for(let k=1;k<=n;k++){const i=(st.step+k)%n;if(!st.chunks[i].passed){next=i;break}}
 if(next<0){render();return}
 st.step=next;heard.delete(stepKey(st));render();focusInput();
 // Passing a meaning group leads straight into the next one, so it plays once (switching with ←/→ still waits).
 maybeAutoplay();
}
function jump(delta){
 const st=state();if(!question()||st.mode==='whole'||finished(st))return;
 const step=st.step+delta;if(step<0||step>=st.chunks.length)return;
 clearTimers();cancelAudio();st.step=step;heard.delete(stepKey(st));render();focusInput();
}
function setMode(mode){
 const st=state();if(!question()||st.chunks.length<2||st.mode===mode)return;
 clearTimers();cancelAudio();preferredMode=mode;st.mode=mode;heard.delete(stepKey(st));render();focusInput();
}
function restart({replay=false,sameRound=false}={}){if(!question())return;answerVisible=false;clearTimers();cancelAudio();resetQuestion(question(),{keepPunishment:punishmentEnabled,sameRound});render();focusInput();if(replay)void playCurrent()}
// Opening the previous/next question is like choosing it in the list: its whole sentence plays once.
async function nextQuestion(delta=1){
 if(punishmentEnabled&&punishment().blocked){note('请重新开始一轮并通关，或关闭一遍过');focusInput();return}
 const rows=PTE.visible(),i=rows.findIndex(q=>q.questionKey===question()?.questionKey),next=rows[i+delta];
 if(i<0&&rows[0]){await PTE.select(rows[0].questionKey,{play:true});focusInput();return}
 if(!next){note(delta>0?'已是当前列表最后一题':'已是当前列表第一题');return}
 await PTE.select(next.questionKey,{play:true});focusInput();
}
// Position in the current list replaces third-party question numbers.
function updateCount(){
 const q=question();if(!q)return;
 const rows=PTE.visible(),i=rows.findIndex(x=>x.questionKey===q.questionKey);
 $('dockCount').textContent=i>=0?`${PTE.practiceOrder?.enabled?'随机 · ':''}${i+1} / ${rows.length}`:'';
}
PTE.afterListRender=updateCount;
function toggleAnswer(){if(!question())return;answerVisible=!answerVisible;if(answerVisible){item().revealed=true;invalidatePunishment('本轮已看答案')}render();focusInput()}
PTE.select=async(key,{fromList=false,fresh=false,play=false,resume=false}={})=>{
 const q=PTE.findQuestion(key);if(!q)return;
 if(question()&&key!==question().questionKey&&punishmentEnabled&&punishment().blocked){note('请重新开始一轮并通关，或关闭一遍过');focusInput();return}
 const selection=++ACCESS.selected;
 clearTimers();cancelAudio();
 try{if(!await ACCESS.ensureStudy(q)||selection!==ACCESS.selected)return}catch(e){note(e.message);return}

 clearTimers();cancelAudio();
 PTE.active=q;answerVisible=false;
 if(!punishmentEnabled)for(const it of [...stateOf(q).chunks,stateOf(q).whole])it.revealed=false;
 if($('restore').hidden)dock.hidden=false;
 if(fresh||(!resume&&finished(stateOf(q))))resetQuestion(q);   // a completed question starts over when chosen again
 // Each time a question is opened, the first click into the line plays the current step again, even if it was heard before.
 else for(const key of heard)if(key.startsWith(q.questionKey+':'))heard.delete(key);
 render();PTE.render();
 if(fromList&&matchMedia('(pointer:fine)').matches)focusInput();
 if(play)void playChosen();   // only a click/Enter on a list row; the “点输入自动听” switch also covers this
};
PTE.onHide=()=>{clearTimeout(checkTimer);cancelAudio();saveProgress()};
// Logging in or out changes which meaning groups exist, so per-question progress starts fresh.
PTE.resetProgress=()=>{clearTimers();progress.clear();heard.clear()};
PTE.onShown=()=>{render();focusInput()};

// ---------- Events ----------
input.addEventListener('compositionstart',()=>{prepareCorrectionReplacement();composing=true;composed=''});
input.addEventListener('compositionend',()=>{composing=false;composed='';handleInput({isComposing:false})});
input.addEventListener('compositionupdate',e=>editTone(compositionKind(e.data||'')));
input.addEventListener('beforeinput',e=>{correctionBeforeInput(e);editSound(e)});
input.addEventListener('input',editSound);
input.addEventListener('input',handleInput);
function handleInput(e){
 const q=question();if(!q)return;
 const st=state(),it=item(st);
 if(it.passed||finished(st)){if(!composing)input.value=finished(st)?'':it.text;return}
 if(it.fix){if(!e.isComposing&&!composing)fixInput(it.fix)}
 else if(!e.isComposing&&!composing){
  // At the end a space moves to the next line, never adds blanks. Mid-sentence edits keep their spaces
  // (an inserted word needs the space after it); extra spaces never change the words being checked.
  const tidy=input.value.replace(/^\s+/,'').replace(/\s{2,}/g,' ');
  if(tidy!==input.value&&(input.selectionStart??input.value.length)>=input.value.length){input.value=tidy;toEnd()}
 }
 it.text=typed(it);
 if(input.value.length)hideAnswerForTyping();
 if(it.text.trim())recordRound(q,st);
 saveProgress();
 if(it.text&&!st.started[st.mode])st.started[st.mode]=Date.now();
 // Typing never stops the audio: learners jot initials while listening, as in the real exam.
 heard.add(stepKey(st));
 drawWords();
 clearTimeout(checkTimer);
 if(!punishmentEnabled&&!composing&&exact(it.text))checkTimer=setTimeout(()=>check(false),220);
}
input.addEventListener('keydown',e=>{
 keySound(e);
 if(e.key.length===1&&/\S/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey)prepareCorrectionReplacement();
 if(e.key==='Backspace'||e.key==='Delete'){if(question()&&item().fix)item().fix.replaceOnType=null}
 if(e.isComposing||e.keyCode===229)return;
 // Ctrl/Cmd+Enter is the backup answer key (handled below), not a check.
 if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))return;
 if(e.key==='Enter'){e.preventDefault();clearTimeout(checkTimer);if(punishmentEnabled&&e.repeat)return;if(finished())nextQuestion();else if(item().passed)advance();else check(true);return}
 const f=item().fix,collapsed=input.selectionStart===input.selectionEnd;
 // Correcting: Backspace in an empty word goes back to the previous word still to fix.
 if(f&&!item().passed&&e.key==='Backspace'&&!input.value){const prev=editable(f,f.at,-1);if(prev>=0){e.preventDefault();openSlot(prev)}return}
 // ←/→ switch meaning groups; in whole-sentence practice they move the caret between letters instead
 // (and, while correcting, past the edge of a word to the next word still to fix).
 if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
  const st=state();
  if(st.mode==='whole'||st.chunks.length<2){
   const left=e.key==='ArrowLeft';
   if(f&&!item().passed&&collapsed&&input.selectionStart===(left?0:input.value.length)){const n=editable(f,f.at,left?-1:1);if(n>=0){e.preventDefault();openSlot(n,{at:left?Infinity:0})}}
   return;
  }
  e.preventDefault();jump(e.key==='ArrowLeft'?-1:1);return;
 }
 if(['ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
});
input.addEventListener('pointerup',e=>requestAnimationFrame(()=>placeCaretAt(e.clientX,e.clientY)));
document.addEventListener('selectionchange',()=>{if(document.activeElement===input&&!composing&&question())drawWords()});
// A click/tap anywhere in the practice area (not on its buttons) plays the current step once each time the learner
// arrives at that step, so the hit area is not just the thin lines. The dock is a drag handle that captures the
// pointer, which retargets the click to the dock itself, so the element under the press decides.
let pressedOn=null;
dock.addEventListener('pointerdown',e=>{pressedOn=e.target},true);
dock.addEventListener('click',e=>{
 const t=pressedOn||e.target;pressedOn=null;
 if(dockHidden()||!question()||!t.closest?.('.stage')||t.closest('button,a,select,summary,details,.result'))return;
 unlockSound();if(document.activeElement!==input)focusInput();maybeAutoplay();
});

$('play').addEventListener('click',()=>{void playCurrent();focusInput()});
$('show').addEventListener('click',toggleAnswer);
function toggleLoop(){
 if(!question()||dockHidden()||$('loopAudio').disabled)return;
 if(loopEnabled)cancelAudio();
 else{loopEnabled=true;audio.loop=true;invalidatePunishment('本轮已开循环');updateLoopButton();void playCurrent()}
 focusInput();
}
$('loopAudio').addEventListener('click',toggleLoop);
$('punishmentRetry').addEventListener('click',nextPunishmentAttempt);
$('punishmentToggle').addEventListener('click',()=>{
 if(!question())return;
 punishmentEnabled=!punishmentEnabled;clearTimers();cancelAudio();answerVisible=false;
 // A mode switch begins a new attempt, leaving learned questions and daily records intact.
 const st=state();st.whole=blank();st.roundRecorded=false;delete st.ended.whole;
 delete st.punishment;
 if(punishmentEnabled)st.punishment=newPunishmentRound();
 for(const key of heard)if(key.startsWith(question().questionKey+':'))heard.delete(key);
 render();focusInput();
 note(punishmentEnabled?'一遍过已开启：先听一遍，不看答案，首次按 Enter 提交全对即可通关。':'已恢复普通听写');
});
// Answers are revealed together; the independent Chinese hint switch is no longer used.
$('cueToggle').hidden=true;document.querySelector('.cue-line').classList.remove('cue-off');
$('previousQuestion').addEventListener('click',()=>nextQuestion(-1));$('nextQuestion').addEventListener('click',()=>nextQuestion(1));
$('clearRedo').addEventListener('click',()=>restart({replay:true,sameRound:true}));
$('again').addEventListener('click',restart);$('restartDone').addEventListener('click',restart);
$('resultStats').addEventListener('click',e=>{if(e.target.closest('[data-book]'))PTE.book.open()});
PTE.typingSounds($('drillInput'));
$('next').addEventListener('click',()=>nextQuestion(1));$('nextDone').addEventListener('click',()=>nextQuestion(1));
for(const [id,value,text] of [['master','mastered','已标记练会'],['review','review','已标记需要复习']])
 $(id).addEventListener('click',()=>{if(!question())return;PTE.setState(question().questionKey,{state:value});note(text)});
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=`音效：${sound?'开':'关'}`;$('sound').setAttribute('aria-pressed',String(sound))});
$('autoListen').addEventListener('click',()=>{autoListen=!autoListen;$('autoListen').textContent=`点输入自动听：${autoListen?'开':'关'}`;$('autoListen').setAttribute('aria-pressed',String(autoListen));if(!autoListen)cancelAudio()});
document.querySelector('.more-menu').addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.prefs'))document.querySelector('.practice-more').open=false});
// Replay: Alt+P or Ctrl+' ; answer: Ctrl+; (same keys as 句乐部 for learners used to it) or Ctrl+Enter,
// a backup for machines where Ctrl/Cmd+; is taken (Mac spell-check, IME or global hotkeys).
document.addEventListener('keydown',e=>{
 if(dockHidden()||document.querySelector('dialog[open]'))return;
 const loopShortcut=e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&(e.code==='KeyL'||e.key.toLowerCase()==='l');
 if(loopShortcut){if(e.isComposing)return;e.preventDefault();if(!e.repeat)toggleLoop();return}
 const replay=(e.altKey&&e.key.toLowerCase()==='p')||((e.ctrlKey||e.metaKey)&&(e.key==="'"||e.code==='Quote'));
 const answer=(e.ctrlKey||e.metaKey)&&(e.key===';'||e.code==='Semicolon'||(e.key==='Enter'&&!e.isComposing));
 if(replay){e.preventDefault();void playCurrent()}else if(answer){e.preventDefault();toggleAnswer()}
});
audio.addEventListener('error',()=>{if(player.kind)note('音频加载失败，请看答案练习')});

// Everyone lands on the first question: whole-sentence practice without a code, meaning groups with one.
// A deep link (?t=<code>) lands on its question instead, opened in immersive practice, and tries to play it once.
Promise.all([PTE.ready,ACCESS.ready]).then(async()=>{
 let migrated=false;for(const [key,st] of progress){const q=PTE.findQuestion(key);if(q&&seedRoundHistory(q,st))migrated=true}
 if(migrated)PTE.saveStates?.();
 const linked=PTE.linkedQuestion?.(),first=linked||PTE.findQuestion(resumedSession.active)||PTE.visible()[0]||PTE.questions[0];if(!first)return;
 await PTE.select(first.questionKey,{resume:true});
 if(!linked||PTE.active!==linked)return;
 await PTE.setImmersive?.(true);
 if(PTE.active===linked)void playChosen({useGate:true});
});
setTimeout(loadKeySounds,1000);
// ---------- Typing key samples (generated by scripts/build-typing-sounds.py; do not edit by hand) ----------
const KEY_SAMPLES={
 slow:['UklGRi4RAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YQoRAADZ/5v/9P/+/9b/EQDR/4n/Hf8xAAkB0wDUAHYBLgFL/4P9xPzc+wr+ygJeAzYB/AC1AYYCTwBm/TP/Fv8EAMUBMAGCA3EBmv0R/gf/N/8y/B77jQLWCAoI3AaYA4z+jfzt/Tb+Fv2V/ngDywJQAXf/PAA/AD//MgKSAe8Blv16AHz+y/sFAQD+mv/rBAwDrgPaAbn8w/pX+SX+HgTuBHcCdv9t/v78Vv3DBJ8BPQFWA+ICAwOAAr8BKv+FADYAZfnv/Kf35fH69Hrf7PR8ANYQAieYMBAwrPpx6OLnRvz0BTcVSyJMGeUK3fns8fnw0fXD7zQKwCuSG0rl3gVHF08Fs+Dbxd/dB/c+C1LunxNPHtf8rtUi4DD4WeXl8oz4SwemCr0A3QoK/uUJ0yhiGggvqd6Lp0GmxuG6NMk2C1RuUpFQsBYo9iPi6wauBn8JaAb61xnxb+WaGfUQotk3roahrqyx2DMETgpcEXglGDsFBRbog98L5c3jBsckDjJypzkaJNQjqA9W86zaavoH+oMtXQ2eGM1RkEBCKygR1e0/rqm3Z8XL1Rn4UwYaEusW5QOC8SHjXczNyci87rBQy0MP2Q94D6w4KBvy/mf+4uwn50n0tuN7D8xKRTHIFA8T9gLe/aoJSvGW6wb43u4f/fkR2QTWGmwFDdY837TUNNu89OQQhB/PIpsenQ8ZFnIGQQR7JW0WbxK2IdcXvBwtHLcRsA6ABsLqOe1k8P3qmAHJCnQK3P8V++rpauVw5IrfcvZH+2D+0f8u/7ACUwzBDDEHVgKT7qzrLvX3+sUE2AjVAT//Qft0/58HqwedAksEAAolBEUKQAxiBFIDbP7O+fwChgRuAOwGFwcoA+sDoQWpAiECVfxq9m32jvi9+vH6Uf23/AH9zvp8+XX4afiL+i36G/9BBzcL1gkwBHH9TPxT/mMDRgc0BqUEbwFz/Kr8wQHXA5YEoQOHAqgEOAPh+ED3rP7W/97/HwNcBgUCh/oh+dH/8gIK/kr6J/zq/Vv7afvH/Xb+cPty/ZADwwKu/rP+TwCaAA8CiwZPCnoJKAiwBHUANP8vArQHuQ6aEP0KMgX1/rP6s/qU/+AC3QRFBOYA6AE0Amf/IP0b/68BFAHS/58B8QQYBpcGbwnICKUAq/mm+Hj7KP5E/gH/SAKG/fz1P/jv+4H7Ivk3+cj7ofwi+bf0n/mhAQACTQCU/wb+wPvn/FcB3gJ8AaT/Jv+P/5wBrgPxAUcBOQQDBj0FOwYPBX8CUgP5AGYDxAZcAzoBowDI/wr8X/xUAG8Bzv8G/6MBDgHa/Zv9rf2E/CH79vcv+c/9mP5z/kb+Lvo1+Zf6K/qg/Gf+Bf0a+iL9xgBbAbgARf8gAcr/Av7b/5P+t/zY/Rz+sgEIA9//df/LAc8Adf12/vD/PQF2AaADtgSxAlL+avs0/er9OP5M/gwDvQV6AtEBpQS1BfgBQv+2An4GMgf4BpYGAQeUBDcDOAOGAmgB2gB2/3r9eP1G/o8BiQGq/xf+5/w4/Fv8f/30/fj+lf03/IL8Cf3R/dv+fP10/BT+QP/P/kL9Hv3v/Sn+dP1q/9AB+gGlAQ4CmQOzA3MBef++ASYEoQOEA0MEPwS/AR7/JAAFAlMDmATBAhAAYgBYAIT/jQAy/wv9kPwI/JL9r/8zAZkAp/5N/f78WP37/EL/RADN/wAAmACLAsEBMAAGAK8BgQJdAQIBPgNmBUAE+gKZAfMAeAHZAG4AXQCF/Tz7Zvv/+rf5hftC/k3+Uv7D/N38hv15+wX5v/qB/uT+8P9MAn4CxQCT////mwBd/u//gAT+BMIBrv9IAAwBlAOxBDgFywOVALX+mQB4AmsCiwQwBHgDggIGAAf/gQAcAqMD4wU7BTsCSgHq/9/+AwDS/wcCnQPHAlQBvQDbAEH+vvvk/V8ANv+E/iz9Qf0g/vr+8f9R//f97Pzl+936gv3q/uP8/Py7/1MAdQB2/yX+if9a/ZL8ev9H/9T+JgK0BQwFxQFHAF3/hf5g/X39dwDXADEAMwJ+BOACOv/s/Xz+bf4P/0QAKAD6ANQA3/8TAO4AqQFMAL/9Mf5G/5D+9v9RAi4DEwMbAaL8jfz4/jP9wf48AtkCNwI9/1T+mgATAOD8k/w8/Rn9LP/kAKIBnwHRAtkErwMGANT8Sv6w/xv/ngGeAygCp/87/03/6P2C/O78Xf9s/h/9bwByAlwBWgG+ADD+u/3c/Tf+qv/RAFcDgQUDBXEEewNBARL/e/6P/uH9lACWAy8FogVLAyMCfwBW/aD73fxy/wkBOQN9BTUEmQE/AWsAV/3k+zn9Kv/F/gH+nQAnAggBR//T/9D/9P7o/bP8e/+v/mD9lgHiAun/2/7D/ob+Yf6P/UT/jAEpAS8AzQCQ/6X9dv4d/zX+O/7M/7EB+gA3/lD+DP+B/4sAzAGtASEBDwHmABgCtAI7AlsDagT9AW4BJQL0AMP/HAEHA1YCRwL3AZoA4v5i/qX+kf9C/2P9Tf2L/hAAEQDS/1j/XP62/Kz8Ev5s/uv/DwBh/mr+OP+PAM8BBgHe/4z+xP0U/gsAHwGgANMAPAAzACcAcAEaA9UCcAE4AB7/Pv+UATMBCgCY/wQANgAE/8z+KP/w/4X/L//KAJ8A0v4fAKsBwgFpALb/VAFIAa0AqwBHAVQBpQEIAm0Az/6w/wQBAQBa/ycADwDC/h3+xv00/pH+Gf+C/5b+yfyT/E39a/2i/x//gv6z/iz98Pyb/V3+PP//AEUA1P4m/6X/7P9hAHkAHgBVAPcA9wFLA9wD0QLjAZ4ANwCmAHwAbwCAAfoB3QCMAVcCYAHw/x3/BP8d/wb/df/p/x3/L/47/sf9+P0yAJ7/+P1f/kf/ov8TAIkAgQCOAVwA9/6W/0b/QgDpAY4CIAI4AaIA8/+n/2z/Kv+j/kP+Yf5k/hD+8v0I/6//u/7Q/Qr98Pvu+zr9ZP4W/+b/HgCa/0T+ev49AKX/FP/Z/ycATwA+AUwC/gJdA28CqgFjAg4CtgCoAN0B/gJ1AsYBYwCw/9kASgHfAG4AtQBl/wr+gP6W/1MADgCo/0n/+P6s/gT/dP/M/1sAHgCj/z4AVQCW/4L/yP8HAKb/a/90AOwAD/9F/oP+2/3M/YL+kP93/+D+Of7Q/Un+iv3h+wT8xfwM/Sv+lv+QAJAAAgCr//r/ff9w/+UAXQH3AJkA9wC8AT8CaQEuAccB+ACVABUBCgHJAEkBYwH8AMkAkgBYADQAr//c/xoAV/+o/yQAuv+q/+L/cf9Z/1n/Uv9q/1T/S/8s/3H/YP92/6P/OP/p/gf/Uf/G/+z/DQCz/7v+mv7a/hL/pP66/r7/hQAcAQwBEADU/j/+UP65/kH/+f+vAOkAFgEOAVEAgP93/tP9FP4r/6EAQwFSAQ4BLgDE/lD+5f4p/2v/FgBDAM7/yf8sAEQA4P+D/9j/1f9g/7n//f8pALQANQEEAXAAKACj/+b+gv7s/g0AtgBwAOX/2f9DAM7/H/+H/jD+Fv5N/kL/3P+SAKcAwv+p/ub9LP5q/ob+V/+g/4///P9hAHcAEADf/3MAxAAdADcAGAGVARgB/gBzAQIBfABfABwBbAFdAW4BQQEUAR4AJf8t/5X/VgCtAIMAnAAoAK3/Wv97/2z/9/4j/z3/K/8S/0T/CAAkAFX/WP9x/+b+5P5j/4b/dv9g/0L/ef+a/1n/Gf+Z//b/kP8C/wP/cv+I/43/if+o/7H/CwA5ADb/r/6U/mn+Ov9eAOYADgHJANP/a/85AMAAyAA1AUsBmQAAANr/JAA4AMX/8v/6/5D/9f8DAJD/gP/u/0AALQDt/4b/ev/f/0YAsQC/AOP/mv/R/7X/2/9bAKUAZQAnALn/bf92/4v/+/9nABAA8v9SACAAef87/7P/DQC1/zH/av+Y/1n/eP+f/1n/h/8AAO//wv+X/6f/KQC0AO8AhwGxAYYAr//w/1MAYACuADoBKgGKAAAAcf87/43/tv+H/6r/TgA0AIH/b/9x/4n/JQC+AMkAxADwAFgA1P/9/1sAMQCD/27/kP+G/2v/Ov8k/yH/KP8K/8r+vf6b/nX+f/4J/7X/vf8+/+r+of5I/sf+TP8Z/3D+bv4l/5//oP+d/24AogAPACwAyQA9Af4AugBfAagBUgG9AGwA1gAVASoB/QAEATIBbgDv/4QApQAxAOb/0f/k/7H/iv/5/1AAJQD2/w8AQgDU/2H/hP/r/1gAiQDtAPQAOACJ/1X/iv+x/4z/bP+t/4z/JP++/5sAAwGAALf/o/9+/xP/rf7W/iz/e//r/z4AVgBtAIsACQA7/9D+xf7b/nn/4QCUAf4A+gA6AdYAYQBaAIkAkgCUAH0A3AA1AQMBkQAEAKD/6/+XAO8AxQA7AOD/hf8+/0n/nP/C/w4AsQCOABYAGgAFAL7/z/+g/8f/VQBqAFEALQA8AFAAXQCVANAA6ABWAFL/AP9j/73/rP+8/x0ABwCW/4T/t/9p/z//fP+a/5D/jv/q/wkA0v/X/3QA0QBFAN7/3v/J/6//BgCcACABOwHhAFoACwBJAHYAiADeADoBNAEQAeUAWQDV/+z/KgAYAN7/k/+a/4X/Gv88/8n/GQB3AJsAPQCM/+v+G/+q/93/8f9lAJAAVwASAMv/AQA5AM7/4/7k/tT/OQDf/3f/lv+C/9/+lf7W/gv/Vf+U/5D/jv++/xoAHADc/+H/9f+y/3b/qP9tAPQA1wDiAPYApAANANj/OQB+AGsAgwCzAP4ABAF0ABMAKABFAA4A7/8bAI4A1QACAQcBcgDQ/2b/D/+//hj/uf8gAJYArABVAOv/aP///g//Hf8b/4v/+P8wAJMAxQDOAIwArv8X/zv/af+H//3/kQD3AIwA3f+Y/xH/i/6q/lf/oP+F/6T/sv+t/57/k//r/y4A8/8SAGMALAD1/ykAggBgAP7/+P/d/5//r//Z/0sA+AA9ARYBzACcADAA3/8pAFgAMQAfAB8A2v9j/xb/Qv+o/7v/qv/H/8j/i/9r/67/FABPAFIAWQBDAMr/1f8VADAAjgCtAM4A8wC3AEgAGwAyAEoAPwDr/6n/nv9o/zT/hf/G/4v/Uf9A/0n/YP9//8b/+//n//f/PwBdADYAOACEAMUArgAyAN3/2P+x/63/EgBZAJwA2gDTAJoAbgBrAEUAPQBmAIkAdQBeAF0AXQBjAGsAZgBBAEoALwDq/+j/7v/Y/+b/IwBGAAUAuf+f/43/e/9z/7//+v+4/1v/U/+R/2j/Hf+e/xwAAAAVAC4AGwD0/9n/AQA6AFoAhADBAMAAcgAYABIATABjAD4ARwCkALMApwC2AJ4AsAC3AHgAGQCh/2v/jv+//9n/+v9GAGsAKgDH/6T/rf+r/9L/OQBZAB4A8v/w/wgABwDx/8D/of+r/4P/Yf9x/3n/bf9n/2f/gf+T/6T/wP+g/6H/3v8sAF8AFgDJ/+//CwDo/9r/GQBdAHQAbgBYAFkAbABKAOj/hf9L/3z/9v9mAIoAWQD8/4r/Q/8j/yn/eP/h/x4ASwBkAHEAaABFAFkAXwB4ANsAFAEPAeoAvQCmAJgAnwB9AGMAegBbAEIAWABXACwA/P/V//L/HgATAA0A9v+6/4v/lf+9/+D/0P+p/6z/sv+0/+f/AgDY/7b/kf93/3L/j/+8/8D/xP/Z/93/3f/1/ywASAAbAPT/8v8JABQAEgAbAEQAVwA4ABMA8P/m/+///f8AAAgAHAAZAAsA8//g/+f/7//r/+b/7f8HABcAEwAHAAAA9//o/+X/6//2/wMADwATAA0ABwAEAAEAAAAAAAAAAAA=','UklGRhQSAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YfARAADJAOMA1wDeADUABQAiAN0AEACN//L/Q/9J/rf+5AA1AGICCv6B/7j+P/sl/4L9vgAI/j79Tf8SAKQAsgFxAcL/7P46/C7/awBu/6oDwwI3ANX+ifzr/RP+dP9QAasEo/wrAU0AlgRAB4P8AAeB+878/P3O/zgGxgFH/pP+iQHH+zUBugUnBwsBpP2I+3f7lPY28F74aAiE/p/2E/JO7UgFbQNdD44ifCOTD+n5K+nJ+A4IZgQYFFIWHikwEYEMhQvyBKIGKOmo5/rru/WW/YMSqRXa/JjdONmC2orsP/PFAIgQ/Oq53ozamfccDOobPw2R/EfgScx2CYgGYx3ZMsEoBzal/afiI9i16zwD3BnGO9ccJgzd9yELFf7oAFjvcNdx+IDthvBXA0ceLy52LsDMao2Kj2+fqdrOF/1l4WVgNxEXK/yg8BrplecQ7tsWmDHAMNAQ0edwxXq6eKmqlzXk2CK+VChQYzKYBA7Z3tHSs/uz3/iIXwRuf04sS8JN/CGG+2DfhvEBAvfi+ufOJM8rj/k56r61vqTKrnqrc7mK2Oj9+SWmPrk0jRHZ2RLH+8WyprXFKvwgIXwnEQtAJII4ViLI8kfZmecV9IUHziD/M0lBtBufCKkMKAHaAJb1eeKJ64b4TPhgCrUSRQ13/gz39eTu3rHlkfoeEqUVXiQ/HgIKl/9+/TYCnAXHAw8EUwq6GVYbfxGLCnoGlv5F64LrTvIKAN8VdxiaGh0ZUQ7R++brRfLB/lcGURHOFqQTHxFYEAIKqP1d9vTgrNGY2FPktvGG/LcFLQnLAln6/PA34aPfvefx8iQDrhJtF+MW2hOmAVDxovepBukLDg9gF9wYBRSIGVUUrQlI/uPwz/P9Af4HcwpNDlYHl//X+yb0/Osd38zTHfLGB0cCcASJ+uTsEvJO96v3DgM+8zfjdfsPErQVcRPwA5j/MgfQ/B/yHPGt9h4DPRDmDFURbw7h/WQBqvjC8fL5PfjS+pcHTgrLCWYOnAcE+uz6IP2WAvUJ5/5dAVsEKgL8CUMJ2gZICtgHcvlr93P6B/Kp+EoDlAWCCX0Ca/2wAPoEDQXPAn8IEwYh/QT72gFKDwML6QHjBDAE3wDN/I36H/pOAHoDSf/h/woBTP3y/ngB8f1E/kv/cP97ADn/p/19/eP4Dfr8+GXxIvHO99b7Bf4NBIcApPd1+Gn6yfrF/Oz8N//FAv8GhQR8BW4GUP4X+cD9OAX4A2oCbgUHCPAIAQayAUMDMf3/9jT1wPiR/XH8Fv0J/U0CUQR8+7n1bvV59HL4+PyGAGMEkwN4/oz7svsg+zP9eP/U/LX7Fvvk+UL9UP2i+tsAMAOL/OT8ef78AA0EdQe3BMv/6f90/5//nwKLBUAGyQkhCiAGbQLnAc38kv2qA8MF9wWLA+8B0QGbAiYA2f7P/Sz8Pv+NAHX+qgIqBKwDDgQVAigC2v/5+iD8RP9BARMBcAIRBIcAWv3I9Cb2W/5x/Xr6BPvT+0EAoAHK/Cf4bvni/kP7BPzS/YUAfwF/AFQEbQY6BKMBjwEmADv/Vf6w/xgCbwTFAE7/BgAG/Jz5YvuXAOT+Mv9XAvT/FP9kADEBTAAw/s77IvsO/Tr+bf4QA78E/gI7ATn7QPw9/yn+Nv+6/5z7OflX+6j9kwEhBSQCwflI+1f+Tfvr/eEDrgYpCb0K8wRM/ysAiwAzATcHggdeBPgDwAH2AhMDJ/+p/Mb6PPvM/pD+pv0xAUkAw/xN/jb/Mf1K/SX8qPpp/KL+pQGeBMIFLwTHAQb/1/xi/cH+gf/8/vEAvwaABoAE3AMQ/33+zP7K/uYBIgF4ATwF+QenBz8B0/5TAHoATAEjAqkCcf7S/rQB4P/lAcYB+/uw+ov6m/ns+xT9aPzf/Nb+i/x4+qX8KACNAEj/vAD7/w//Pf2v/RoCuwIR/2D9Bf3+/B/+rvvw+IP7Tv4D/FL8+/w8++H9XgBv/xIA1ACLAPkAAf9l/dX6OPt/AGT/6f6mAJ8AlQJNAuj/uvxr/K3/MQLEAW7+PP+YAUUAqwOJA/H/agRwBNcCogVCAzT+ZAJJBSUCAAWeBeYDDAPv/4v+rQAkAncB3ADM/oT93v/OALgAxwC8/dL/PQCp/M/9xfzO/bMBJAI8/y0AHACc/nYByQAt//r/H/+F/GH+0f7W/OD+JgOgA2kDzAA1/rb9b/ra/T0AqgJvBFMBXgCsAGv/D/2z+xv8D/xP/Qr/WP3W/psAuQIwA5cA/P7m/DX8af3a/mz/EwD+/xH+uv2b/nAAnwIsAaP9D/up/Lb+Ev/xAtAEKQJMAdL8Dvol/b7+AQBJBFAFJQBf/uD8JPoK/eIAeAHkBWoFxQBn/4r9zv1a/5oACwM2BFYBh/8N/pj/2QJ3AtoATwGTAFr/XwC5/00A1wEnAS4A+ADJ/v/9PACSAA8EJgZ+AQr/R/97/7ECcgTABG4DzACsALAAf/8X/mf+fP8TAeoB9/9E//MA4QCq/9n90/pc+6H9sv7p/v79bf4CAHf/8v/z/2H8K/zL/en9Fv+GAWMCBQOCBL4B5/0E/8H+7PyH/5UBLwF8AAMAuwAIAeT/x/xb+iP8sP3b/QwBhQP0AKj9cfxb/CX9eP+z/wAAZQJoAYgAowCo/rP+9QCiAFT/3P3I/WEAdgEYAZAAx/5C/hwAnQD6/ywA8wBAAVYA6P4X/54BKAOrA+ECjwBAAL7/ZwA7A5kCk/+U/hX+jf9gABP+zP53AHL/xf4g/+j+3v/7/3AAYwETAXL/7f6aAJ4BFQM9AzAC2gFRAQQBrQHAARAD5AEMAOgA8/6n/Ob9Cf+K/w8BnACS/+7+0P13/Fz+RwCm/18AGAAQ/rH9rv17/Tn/0QDeADP/df1S/LL8v/60/wMAggBEAMn/Yv87/3f/xP/x/vL+Uf+2/44B2QBU/8T+r/1u/Sz+mP5K/+z/ygAnABL/nv3o+2P8hPzu/iQB2gHKAqsBZQCAAEn/XP5L/+H/sABEAp4D+AKHApQB4gCQAi0DEQLuAKsAWQGeAv4BMQHuAUUBWAAAAGz/xv/hAF0BRAGbAC0AqwCXAPn/9f8S/zf+nv/B/8P+dv9//8n+9f7s/eH8af4o/9L+Xf/N/mb+q/81AHj/sf73/i0AuAAEAIX/dv/8/i7/sf8a/w//Bf+j/rv/sgC6AGQAx/+k/7r/m/85AL8AuQA0AekASwDyAIAByQDB/xr/f/99ADsAJf/5/q//iv8b/2T/qP8NAKn/rf7s/jP/E/9h/1sAKAGHADQA8P+w/ygA7P/X//T/lv+bAEABVQCm/yP/xP+EAL8AogAVAOD/AQBTAPb/Bv/P/vf+YP8mAA4As/+c/3//tP9C/6r+Yv/L/6P/mgDGAZ8B+gDNANkAWACu/6D/9/9/AEwByQF0AdUABgCw/xEAdABkANcAfQGUAUwBZwC3/4T/gv/6/+EAQwEBAU4A1//u/5L/uv6s/m3/tP+u/8H/WP8W/+L+hv51/sn+Rv81/0r/wf8EAMr/lf9N/z//qf8MAC0ADgBWAOMABgGXADUASQDfAFsBBwFDAAMATACaAHQAWACwAOAAlgBHAOX/gP9S/zn/cv+N/zP/7v5b/57/a/8h/9T+t/4g/5f/ev9I/4v/r/+q/9n/vv/X/6j/4///AFkBEgETAfgAcgD1/9j/9v8vAB8A1P+r/2j/Xv/V/1gANADq/xUARgACABUApwA/AdcA/P+e//P+7v42/zj/cv+p/8r/JQBLAMj/H//g/iT/uP/3/+r/LAByAIgACQFTAUABVAH5AMgA3gCeAD8AYgCjADAAX/94/7H/h/9s/0P/5f+LAD0Alf8w/zn/nf+//7z/P/+n/un+nf/e/6H/of/G/8r/Tf/+/gH/+f5k/+//YAChAF4A5P+C/2P/QP9O/7X/3v/H/+r/GQDy/43/Qf9S/7//hQCuAEYAKwCiAFsBXQG0AEMAagCoAEoA9f8yAGUAZwBUAOv/Wf/k/m7+mv7e/jn/7/8jAML/tf/8/9P/3f8NAAYAMACEAHoAfwB+ACIA2v+X/1T/NP8u/zP/jv/m/73/df9t/2z/av9X/2z/BQAcAOv/BwDl/8j/7v9bAA0B/wA1AP//HgB6AJcAiQDdAAoB5gA+ABoAPAAiAIAAzAC3AOMAAgG2AFIARgDHAMYATgDR/7L/JwBPAFoAwACrAPT/iv97/2D/UP+j/y8AkgBcAOb/xf+p/3T/kP+q/7D/8//m//H/MQBKAC0A///k/4r/dP+N/7H/9v8FACQAYQAtAHf/Gv9y/5H/OP+B/14A7AC0AJgA2ACAAMz/QP9d/0cAPAGOAYABNAHBAEcA2v/D/0wA+wAdAUABWAE9AesArwBGAP//IgAhALMAGAHOALQAtABkADoA6P9s/5//+v/6//f/SwBhADYAEwALAPL/mP9m/3X/4/8uABMAHwBNAHwAcQA+AEYAOwD+//L/NwBTAPj/wP/U/w0Asv82/6T/EwBjAJAAiQB+AHMAdQBsAAcAef91/87/HwCaAAIB2wCYAD4A8/+B/zj/Yv+Y//P/KABoAGwA5f+t//L/3f+D/5T/8f8fAHoAogB0ADwA1P+X/63/SQCBAGcAkQBjAC8A2v9n/23/qv/r/0UAjQCBAE0ARAB+AI0AQADy//b/HQA/AGwAjADPALkAXAAWAAQAIQBcAI8AzADkAGgA6/+2/6T/tP/j/w4AUwBjABIAiP9b/83/VgCmALsAhQApAC4ANgAkAFcAvgDgAM0AoACGAHwAQgA0AHkAvQC8ALwAfQDu/9P/4v/5/04AHgAEAAkAyf/5/yAAl//4/hv/lv+Z/3f/sP82AKgAjAAPAJ7/fv+j/wYAgwDIAJYAQgDo/1j/N/+O/+j/YQDDAHcA7f+Z/4n/bv+D/+D/GgAmAOT/s//X/yYAdgC0ALsAlAA7AOb/6/84AIcApQCTAIQATwAGAA8AYQDdAPgAnABIADQABQAJAHQA9AA2AQ4BhADY/4r/kP/d/3IA5QDTAI8ARwAtABcABwBFALsA/ADEAHoALQAPAB4AJQAwAD4AMwAgADYAOAAXAFcAfQAoAMD/hv+D/33/pf8yAKEAzwDdAIQANwAiAAoACgBwAOcANgFTASsB8wC9AIkATABJAEIASgBvAGAANQAtAEAAKACf/xz/Ev9H/2T/T/97/9L/1/+z/9X/3v/o//L/BABdAIgAUwDq/7f/6P8hADwARwA1AFsAdAByAFQAEAD//yQAbwCMAFIALwBgAIoAsgD+AC0B+QCLAHsArwCRAEoAKwBDADgAHgA3AHMAsACaAFwASgAeAJP/Ef8P/6z/TQCYAIMARQDn/27/Hv8S/3j/6f+BAPsADAG8AB0A0f8vAI4AfABwAIUAtADeAOUA3QDCAIcAWQBIAFEAQwAuACYADQD4/+P/3/+5/43/u//n/wMAHQAGAAwANQB4AJUAUADN/67/9f8aADoAWACZAMEAcwAFAMn/w//F//n/igDRAMsAlwBXAEYAKgABANH/0f8WAHAAwgATAR0B1ACqAKsAaQA4ADEALQBSAJEAmgBaAFIAPwAvABgA+P8NAAAA7v/6//f/3v/O/77/wf8aAG8AkgCmAFsABQDu/+7/IgBeAIIAiQCxAPAAqQBDABEAKAA7AAkACQAOAPr/v/9k/yn/Rv98/8D/JwBjAHYAZAAUAKP/Y/+G/+//NABrAJ8AyQCbABAAtP+M/6f/xv/u/1QAegBIAAYA4v8BAPf/5P8mAGUAhwC5ALcAdQBpAIQAkgCiALYA3ADcAJMAcwCNAHkAHgD6/x8AHgD1/8P/t/+i/3//m/+Q/4n/t/++/7T/kf+N/53/ov+//83/zf+8/6n/2v8kADkABADa/wUANQCDAKkAowCfAIAATgAMAPj/+/8AABcAXQCNAGYAHwDz/+j/+P8YADAAMAAJAOD/7P///8f/qv/Q/9b/1f/p/yEAUAAoANr/uv/S/8//v//l/ysASwAmAAAAAgD6/+T/6/8KAC4ANgA1AEoATQApAAMA9//4/wcAGwAtADIAGADw/93/3f/c/9L/2//x//3//P/y//D/7v/q/+v/9P8BAAcABgADAAMAAwAAAAAAAAAAAAAAAAAAAA==','UklGRhwWAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YfgVAABwAcMBDv+5APEAFgA2AT/+iQGC/1n+Cf8d/2QAV/5BATz97f+EACT/wQTY/4wCAQJO/5IBPAA2//X/UgGj/qYB/v91/rr/Kv46/+L+YAIh/vL97QEl/5v+FwJlBWv+H/7L/QYA6ABU/OgADfzg/lv/MP7NARj9cwCX/17/+P6d/Z0HUgLQ/Ln/YgEe/sH/oP3d+UsDyABlAOv90QfeBMj8NPvM/XYChAVB+037rgJS/jEIjxc0G6n+cfCM9H3zr+Ro7ZH26wIEBg8Y1wqa/ckD2geZCL/9liSf4bW8dRD/8qP6dFRDDrAPKCrH/5TwzvxYCT7f5+g7833GCPi0JQzvh+A7x0b+8VXWRhLuiBFaTB8IbALf8auTtL+XD3oR+B7X/IH2B8aVkz/AowgGFUkngEAKKlTslN3Z9ZHy6wX+HGgfURN8IH8fVTHIHfQWSyf3GrsFZfrC+kgJ4uVDvHDSS/ZnENz1S/cP7anZF9546v/6/Ry8Dnr8SgqnCpUHChFWIvIbCBQxAljsEebv6eTY6NsH8tD/8/Iu9J4EqBfMIjEPxwvCDUb3buTK6zPrq+xG9+H6vwl5IWUgfhFiE+kgWiRbEQr/zf/+8nfpE+8B7Bjtyu2e8YP63ABSAkYJRBVqC7sBOAj/CkoCJ/16+VfwGff1++r8Zv8f/D8BgwJWAkgFyAJFBIoDvvVB8en2Tvm//nH5y/OI9s/7/AddE6AVZAvgB1YDqv0qDaAVGwy8AIr7PPqX9ojypfIj+rsCMAeHBCAGsAc5As7+c/nV+ngC+AAo9bfsEey37IHzY/xQ/koBoAj9DSsOtQ1YEFcVJRhJDrUBjPmz9c32tfUs8GzrD+yp6wPyqv7TAq0AGP/M/6UGcAzhB0gLoRCMCKkHZwr1AkcCeAdkBFsGMwooAiP/ff8J+j/4QPR96iLvFPgP8X3uD/WJ+oT/5AcTDWQSVhlhF4kWDxWCDikF8f0G+Pr0lPLu6VLoeO8D+AX4bvgc/1MADwKHBPMDFAEC//j8UPzNAHoAGf+RBGIH2QQNCBMMHwn0CCAKUgdGA7L/8vci9yD4gfJo9d/1AfZ7+cf7CQCwA80EcAYeCi8MaA20CGEExAGq/4j7PvYz9/b0zPhy//j+VQAuAsQDvATDBrEGtALm/0v6GvQG9af4zfhI/OIB/Qa0C/YKhgpZDU4MYAarBqcF1P5z+RD2IfOq75vyaPWe+N/+ZQPQBsoJGwcEAyAHRQVz//H+Yvxj9xv2+Pb9+FX+MQALAV4DPQRzB6MJewqnCOQCCAIgADD6w/is+Mj1Ifd4+rn6lvxrAM4D0gTJBHcEYQQxBscHcwQZAhYCnf62+kz6qPuv/WwDiQOqAVgE3ANjA/IDZgDD/Pj7lvpZ+ZP45/g/+rz84P4zAlwFkAeICTIINQiwBXYBggER/5L5t/cr9nb1Cfop/lX+Pv0wAT4EiALFBJADvQBcAD/9q/+lARP+cvyeAWEDpv8IBZAIUgR6BK0Dhv0rAQEDS/tL+n/82Pvc+1v7W/mu/T//s/7/Aq4FNQTe/wQA8QINBkUF+gFNAP/91PsK+Yv6Pf4bAPUAtv9H/7T+hf82A2AFdwBH/6ABM/5LAdT/Y/r+/KL/VQA1BCwGZgEYAvwB2v/jAYUAk/vx/Kr9UfuEADkBzf3c/Pj+XgS1CKgEaP3O/3ECCwE+/5n/0v6z+xr7pPl4/YQChANZBPQBFgJxA7oAkv3P/cP8+/68AW79g/7I/lr9DAFXAqH9Fv/fBEoF7wVWAmMA2AHo/dv4yvtE/2L9lf4sAJ3+2/xW/MP9CgR+BeAFMgojBAT/0P8Y/I78qAO7AS74wPep+Jv4SP5pAEICgQc2B1cDwQXMBGYCXAXHASX9GPwp+bz3K/xR/oz9/f9/Ay4DyQFXAjsCRgMQAXz/fAGHAKz8Hvu1+wb8k/yY/Ob8zP4bA2kFVwgYC34K8wjgA+EAUf9r/Hz9ufqH9YL0ufN69p77Fv5t/owBUwQ6A38GRAqDBsED2gKZAZkEHgRq/iH8Nvtq+XP++gAEAJsAGfyO+4X/xf89/h0AVv+Q/Gz8ef2H/5cC1gQaAooDvwX3BHAHZwczBP0CzwEU/tP84PwD+nz6VP3++zz8+f5J/xIANgKLA0QBsfuf+d36rv5DAQj/J/zb/6gFqwNVBPkEkAUhCI8FqgElAPr+x/0A/yP5vPRb97L5ZfpH+vD8d/1VANcF9wX6BbQIoQVKBCoIQQRO/iv8MvtBAKwFI/9n+1ICfAAUADMHYQND/Xn8TPtD/Db9d/hr+I/7Qvpz/FUDKgXIArkGaAW1BYUG9/9RAlsDKf5q/Gj8yfmB/JAAYP0W/s8CRQDI/XABMgGEAgwFBgGG/Tn+w/3t/NH8TfkB+u3+yv/tAv8GAQY/BfkHkAnvCJEGyQAc/xr/cPpy9r720vYG+cn48/Um/i0D3QO3BQUGJAZWBNsErQS3AqcByQCO/9z+Ivx3+13+0v80AHD/kf1O/XH/mv0L++b6YPxnAfsD2gHVAekDOwNDAcn/Y/99AJwBbwHB/6wAegHj/kQAlAE7AvEBAP/S/t//YwApAE4AXv5A/Fr9wv8Q/7D/HgJ6/538T/22ABwBJP8jAIsDOwMiAdQBBQFr/6ABuQLE/uD9jfw5/KH9xPwQ/4D/rv+iAQEB7f/X/vr/OwEEAogEugI/ANwAG/8w/i0APgABA1wFdgJGAUgAY/0q/ZP/F/6Q/GD9LP/AAPIASwE3/xf+BP5N/jr/Iv/z/l8ANP/K/3EDTwDB/7sBCQJbA1YDggL+AJ7+ivsJ/fL9v/qF/AP/j//QALT/HP/c/9z/0QF0AiUChQSrAZH+dQEtA+IB4ACkAicDlAEGABf/dP2F/Gb97P1a/QD9c/+TAOMAwQCKAOj/vP1p/6gD3wNZAMsAWf9Q/IsAZQGy/S4AMAFd/ST/qgBh/zAAS/9B/5MAAgAd/x3/1P/B/5L/2P+P/jD+HQEHAy0DwAItAPD9gP8WAsgBdAD+/4wBmQBa/az+g//9/fj9AwD0AboBZgFWAbsAUgIgA1YA+P4p/Yz9UgC7/dX72f12/VT+fgEHAA0BdgQXAvoAHAPBAfb+IADSAH/+Z/yC+7j7Af6J/2gA5gN/A94BugLhAMb+/P7t/zP/DP71/Qf+ZP5I/1QAlAFoAx4EXQMbAuMBJwJiAS0Asv74/HP6tvtc/vr9bv8nAo0DpAJrAlsDWgLB/4f+8v2w/Mz9Av+L/yj+r/09ACABuQBPAPb/AP8H/0//lP/gAFoBr/9m/fL9TwDXAqsDkQKjAioChP96/6sBUgHGAGz+hPoL/GD9OP34/7X/RP6GAB4AlgAnBusF9gL7AkkCxQD0/0D/QP5v/SH8dP0W/mv95v5y/6f/LwFLAtQCdQJy/7b9V/75/Wz9jP4Z/9b+egCfAVEB9gJkBHADzgJyAcr/p/7k/Xn+EP45/G/9cAD9APEAiQA3ABUCWgK1ACoBPv9p/eL/sv/3/Xz+nP1W/jQCwAH0AMMDCwTAAS8AQv65/YH/4//s/i7+yv34/eX+Fv8U/5v/iQEVAioAuP/N/1YAtAAtAYsBPwBL/vX9fv/XAA0BTwDBALoBFgL+ABX/hABfAtUA+v9qAJH/UP4I/a77Nf3s/kX+PwDpAV4BowJFAoj/tQDBARMAZQAaAMj+iv8WAM3+ZADjAHb/OAIKA48A2AGZATn8kPss/DH6dvvA/cz+vQCdAgEDwATABCACBAKtAXgA+gCrAAL/Yf1c/OD80v4RAGcAAAFtAsYCqAD0/5T/Ff63/av+4P68/mD/h/8lAHUABgHYAacBcALfArsAewB8AAP/kwAK/2n8q/7w/qH+CwFs/3T+CALlANv+sf/f/RT+OgHZAHwA4gCk/y4BqgFa/pD/EgKjAGAAjgHkAFf/GQCCAOX/cQDf/9H+L/8G/z3+RP4n/gT/hwB9ALb/UgDmAK4AcwKHA+cA5P+XAO7+T/8bAUkAjP9l/7z93f5WAdL/pAC/ATH+kf0m/wv+8/7HAGQAdAB8AD4A/gD+ADv/r/5Q/xj/NwD5AmsDeAIdAkoARf7n/jQAkf9Z/yf/Qv0x/cf9av1+/+sAmwAMAukDQQPqACEA5P+e/9j/k/8r/nL++f/j/uT+kgEbAugApgHuACoAdAHu/yb/sv+V/ZX89fxo/Pf9ywBxAbUBkwLtAa0BdgIXAVYAiQFpAML+nv6T/pP/0/+c/k3/JQCy/sT/3QFqAPn/RABG/hj/QAERAGwALgBy/v//6QDV/zX/uP+oAEEBqQHtAV0BlADZAPD/zP7s/6T/0v19/tD9pPsJ/h4Af/9yAbUCwAF1AsACrwCJALgBp/9z/u7+sv18/sH/y/5jACICMAGjAbUBKf+Q/sj/9v5S/44A7/6J/Y79nP0y/9QA6gClASEC1AHrAU4C7QHRAM8Afv/Z/UD/x/9d/8X/If7D/IH+KQCkADMBxP8z/jIAHwEtAJwB+QGBADoBeAH0/1//KP8d/3n/dv+3/zEA4P/L/9YAgAAqAEYBIwBV/7L/1/5f/5b/Zf6i/vj+/v4wAIMAGACrAWoDewI0AHf/ngARAeD/ef+t/of8EP7WAPz/zv97ALX/x/+jAIUBOAJOAZP/Dv9+/gP9dP7FAGf/2/6iAJ4A2P9dAZEC6gGqAuUCkgD1/zgAgf7B/SD9bvwS/ij/tv+IAMr/0P84AboB/AFCApgB6gDD/wn+3v6W/2X+QP+s/6X+WQAUAg0BVgDAAM4AiACnAE8Ao/+2/8v+9fz9/Br+M/+vAFMBKQH3AM8AYQCkAAsBmgDFAXICeQBb/0b/mf7P/jv/w/70/nH/ov8dANf/nP/cAFIBvgAhAEP/AgA2AXMAagAvAFf+iv6g/zgAdgG0Af8AKAA1/7T/kwBbADgAxv+f/pz+w/4A/sX+iv93/5YASgHAAEgBPQJGAjICMwHQ//P+bP5D/k3+x/56/5D/i/+CANcABQBcAAwBCAG/AV0Bpv/K/sf9Rv3F/vr/MQBoAPT/QgCDAWwB4gAtAcIAZwDHAPD//P4U/5H+av5b/zz/bv9hAFYAYgD9AIkA+/9iAPf/3P9RAIb/Sf+SAL0AGQDU/xP/cv81AYgBdADR/1j/bf9BAD0Alv+r/6j/hf95//n+jP+yALMAzv8I/5r//wAsAfsAHwFjAAsAgABFAAEA2v8f/yn/Lv+0/oz/cQA0AGsAWAANANsAkgC2/4n/5f6v/rH/OwA4AF0ALABxAEwBAgHc/wkAhQBOAA4Ar/9W/z7/Bf/P/j7/tv8DAHoA0ACgAEcAOgBkACgArf/o//X/nP/k/wAACAB6AEEADgCCAAQB5gBMAO3/jv8g/xb/Nv9k/+n/pv9X//n/SQAMAAkABgA7AOMApQCIAMUANAD4/yAAyf+D/1f/pf9MANL/mv/G/3X/BQBbANP/eACnAIL/7P8qAPH+jf8TAAr/8v+zAAkALQGmATwAvQAlAQsAVQB5AEb/Cf/+/if+vP49/+X+6v/RAK8AKQFDAUUAMgBqAOD/qP/w/5j/cv/M/1D/TP81AJ8AwgAWAegAuADJAD8AoP9y/+f+dv71/kX/Uv+8/wgARwBTAE8A2gDfAFYAiQDSAFsAQAAnAF3/Lf9U/67/jQCwAFkAYwB0/9b+df+p/zoAogAAAMH/u/8+/6n/HACq/+X/SgBqAOgAyADl/wcAmACXAHgAYwBTAAQArf9C//X+Ov9q/5//7f+M/6H/OADj/+3/kgBgAJMAHwF2AOH/9P+G/3P/HAD7/wwAcQD3/7r/MwArAP3/YgAhANv/SAAEAFj/iv9g/yL/mf9//+r/hwAtAFEAvAAuADAA0QCWAGcAggAdALf/zv/D/7r/vP9j/0L/pf/s/+D/FgBjAGMAigAyAGf/af+h/9D/GQDa/53/6/8GAEgAxwD1APAAxgCrAHMAOADL/zr/3/7B/sP+Qf88AC8Ar/8fAIQAXACsAJQACAALAOH/zP8aAAkAhv9S/4j/9v+NAN0ADAEcAXwAnv84/0X/p/+4/5v/0f+N/2H/9f8WAA0AcQCiAIMAVQDy/77/xf9h/4//QwBkAGoApgBUADwApABlAOn/1v/B/zn/M/9Y/zP/pv8OAN7/BwCHAKYAxgCJAMD/Y//P/+X/rf/L/6D/vP9zAMAAywD9AOYAnwAzAJ7/Of/p/s/+ff+7/0r/h//K/+r/tADvAKwA9QCWAEUARQCG/1j/3P9n/9X+kf80AKYAPwHEAM3/EQA6ANn/fQB3AHL/Zv8V//b9A/9cAND/gwAlAQsAkgBlAfr/rf8mAG7/AgAFASEAr/8QADH/T/+VADUALQDYAMT/K//p/6v/uP+jAAoAg/8UALP/jf9wABIARf++////RgACAQABRwAKAAQAxP9HALYAEACV/5T/E/8A/2b/df+b/yAAhgCCAKkAnAAVANX//f8nAHUAcACw/0n/Z/9n////qQB0AJAAvQAlAO//DgDu/x8A6P9N/zn/bP+M/8j/KAAYANv/6f8cAFcAvwDYAGcAJAAEAKP/t/9qAEgA7//d/1n/aP8PAAIA3P8hALf/x/9bAP3/8/9sAPP/5/9eAMX/y/8FAE3/a//e/9L/ngBkAfoAlgBEAI//uf9cABoAr/9x/9X+tf5Z/6L/vf8aAHQAuQAHAdUAjACDAO3/b/+o//X/KgBEAKH/HP9R/8X/WADJALEAiAC0ACAAk//H/4r/T/+G/3f/p/8fAAoA6//v//L/dgDxANcAvwBxAMb/of/J/8z/5P+1/2r/mv/M/97/7//5//7/8P9BAJMAYQA3ABAAl/+P/9b/vv/Y/zgA+//G/yAAHgBWALgAiwBOADMA1P/E//f/vP+G/2v/T/96/+P/DABIAJAAUgArADgACwAEAC4AHwDb/9f/4P/C/9X/BgBBAJIAfgANAOP/1f/f/+z/7P/j/8X/l/+8/wMA8v83AF4AAwASADgAvv/e/ywA3/8jAEEA7f8aAC0Az/8GAFwAGwAmABcAkP+X/6//R/+I//L/2v9NAL4AVQArAEUA2f/4/0oA4f/R/x4A3v/h/xQAtf/L/zUAQwBiAKUATwDj/8//Yv82/53/w/8aAHYA8v/R/w0A+f9RALQAWAAwAC0Avv/S/+n/r//U/9r/sf8YAFIAJgBBAAkAxP8FABYA5f/o/+H/rv/h/wEA8/89ADQA2P/4/wEA6f9CAEkAFwAVAPD/sP/2/yUA+/8ZAAoA5f8cACkAyf/Y/9P/pv8LAEUADgAYACQA1f/t/yEAEQAwAA8Avv/b/wMACQAgAAMA3P/1/yEAIgArADoA/P/I/7j/wP/f/xkALQAWAAsA+f/q/wAAHgAFABMAFwDq//T/EgD3/+L/5//Z//X/HwAiABoAEQDn/9v/6f/4/xEAGgARAP7//v/+//v/CQANAP3///8EAPT/+v////D/9f////3/DQAdAAwABQAGAPj/9//9//n//P8BAP3///8AAAAAAAAAAA=='],   // switch26 switch28 switch8
 fast:['UklGRvgLAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YdQLAADv/17/+//I/4MAWgEK/8f/cv8+AM0BzQAkAa8B+wAb//f8zf8j/2gAuAE0/QYBrv3OADv+lv+bAfX+2f0S/SsGcPx5A4IE/QED/57+TAG0/HkCmv2rArL8j/3xAZj+NQVLAh//qv1t/LcAo/onALUEEwAqBTP7o/8kAhT9S/+5AFD7c/9KBo8A7AScAKD7OwASAeb+XQBjBuz+lvkEAtn1dgG9BdMDSQB5/hEBofXABNj4+QLLAU0DtgJY/4AGs/zq/Y77xwOS//YAvv7vBjv+FvbiBM8CDAVS/tf3EQGh7CwApw08AdQd3vyL37UaGxuy0kXiDhbtBtLvBea3F4kCAAcfNR0FEBTt2O7m2eZl8EzxBxZkO9vwGQ5pFdr/YdK36EbsXQIh0mQIXkDeHTEpkBjqBITxws2kyHbtybPbJcYC+xXlcVsiVRQu+37xVseoqzzYShWm/OQPjTnUGoAj8BSq+MXjA9Tg7xrbkd3x+0MvSiRPK9YbH/+UCGvT4+J45WLv8OYGIY0Wzgi5FKMXShl66J4jC9cyyBrIVdHsLNoZazz+F1UUohvy9twDX9OC0J7Y/tm57poysTomF/Uj9wf6BSb2O+zF07/OXfg++7caGiv4ImH9MfVC/9n18fMi0w3kjQirJZwg/RoCDCP1AALA+tDxcOsu60/awuUYG8s8WCG0B8kK/Pe++I3n8uR062Xj+/3mDWQmLilqDnv9cvY5AS3wjOBE68X3WwKBC/EZMxQ1DT0IXfkA90nuv+ML7VkFpRjkEBEBIASCBZgMiQjI85nvW9tm4PL/IRfZH6UOxwenBsoLWgW5+Qvqe+Ao9E4BBArjBdYIKwzuA9ECVgCE/eP2TfO19bEEwwaj/5sF0A3AC2MAqfzW7O/pTv1aBn8JdQjAAkwABgRTBT8AFvdP+Bn8/v9ICVwI9f7b99757QT5DGD6m+2S9Jz/EQ82CDUG4wW0AEQBPf0YBd36hepO77wCLxGOB+f9f/21BYAIkQrQA0vyY+7Q8Z0CVg6yBpD/8f4RAWAHCgJh/PX7tPIz+af++gRYDIYD9v5ZBDAFkwBh/qH3jvsz/Pf7WwDR/+8EBQNoBQwJVQTf+Vv5oP/X/aX7ufh8/AX/ZwGNBBcFoQU1AxwABQQPBlP/F/kz9bn8MQBdAP//Yf6TBIkFaf84+6j/SgAIA8AEUAZOBEz0cPI0/kUIgQOZ++b5Rf2pBZIFhwYvBBoBrgI+/EH9gPxa9bj7mP0MBaQLYQXWAOX7G/7+/DYAWgCa/CD9rfnkAHcGmQlmBS/+UQAK/nT6Xfuw/SD/ZQBsAUkGTwXiBHgDq/py+ff25fpc/MH7mwc+CbEG9wX/ApcB6fzI9oL3XPqN+0cCdwd5B9kDLgRaBmkBlfeT8+L4evlgArQHfgg/B7H+5wN//+X7NPqQ9pL6ofu7A1sFZQe1DX4K/QER+m7zK/Wn+g/7YQCgAe0BpAY4CqwLyQbQ/Bz5ivNF8Jn4c/3PBZsHkAb0CiIODwNX9o35gPtN/oL1r/qjA9QB+wbYA8IH9QQ5/Lz2yfRl/NsD4gOrArcEhgTdBNX7SvsP/TD5Wv47BJEHBQHH/Nf/aASUAqD+5/z39jf5d/89Bv0JYwK6AK4FMQC7/KH8bPn6+Bf4MP7cBPwE9QgYB10DyQL0/nv+yfqB+lj47vibAr8DgAdvBPEDVgMZ+gL6kfnt/gP/Ff1ABCwK9wnO/8385P37/Yn9XvjK+cT/FgN7Au0EaAeIAqX+Bv/L/gH7Rf2o/4P/W/77/QMEGgKVAuMBwP+lAJ370v72AFr+5f+0AdEBPgND//f7XP42/goBCgGD/ycBgQOTAdMA3wCz/6b+Gfr+/cr9NPoy/5MDVAWbBp8F9QSkAPT6ov36+5P53flq/30ElwLeAFEAPwB5AAoEsgHUADP9Jf+xAUL97v5L/V4CsQJNA4X+wflg/t7+6gOgAMcCBgEJ/TwB1f/qAJL/c/3x/O7+QQB2Ai8EewIVAk0BSQFS//35RfYa+Sv//ARwCCQHPwQd/578ywL+ADX7H/os+l7+7/5jA5QGQQKG/iYAQwRoArj72Pbm/EACzgSdBkgFWgEc/qH/SP0H+Ur40/w8/tgB1wXBA6IDCAL+A/EDAgDX/MH31Pe7/B0BXAQyBbYEFAPL/oD7GwGNBMr7EveZ+0UG5wXh/lIBfwEQANH9Fv6+/mT/s/3E/G0EtAfwBFz+z/wM/Vb8lv7U/Br9TgFqBkgGEgWDA5D+3f4W/kv6T/hw+av73v53BTcIMwcVBUECsP8t/hX8F/no+r39rQAsA6QGCQgFApX8fvqN/Un/7f60/FD6Jv5rA2QMiwvhAI/6B/mi/P76hvofAa4CJwH7BL4GwwNIAJb7Lf6HALf+DPzr+If79f7EBWIKNwfAAH79J/xk+qkADwH2/4v/JPw0/5b/GQLWAVT/7AHNAQkDxwLw/i/9Kf6d/Yv+GgF//xX9+/0bBOwGdAH9+wD8u/2P/83/bv+6A58ELwUUBOf+tPys+Wv6Afz1/J0A2AF7A/gFvwaBBUD/WPrt+h794Pw1/CcAuQESBF8EggT/Az39tfs3+YX6vP7t/28EQQcABgUFBwHN+p36gPqN+w38gP5GA6EE2AUgBlUECQGC/6z5+/VS+Pr8qgIOBPIExAYGBgQDRv77+6f9s/kU+Tf8fQAoAy0FGwkzBf8Atvwm/aT7Ofs+/E77jwFWBdMGdgRjATT/vP6o/az+k/0H/MD8e/1MBNIDEgXWA/ABGwAF/Rz9M/lL/ED/OAD4AjgHCgUt/zH9uQHbANb7Evsl+rAB4f8DA4AGDQVoAvX5Cf3f/df+5f0C/sEAZwXEBsMCCgDF/FL9IPuj/Eb9oABiABAAHgZ0BwoH1v2s+oP7z/oE/Av+cABdAVcEoQY/BXUAAP9a/DX6Gvsn/+UBBQJdAs0CfAebA5v7rfYJ+ND9PgBBA0oE7QOhAs0CAAOHAlH+v/dy9m74oP96BioItwWdA/EBTgAe/d75u/o4+cT93AL1BskGDwJSBDIB+/1a+mP4LvkP+7gAOAbOCAAGBwS/AGECY/1891T51PtZ/n/84gJRBzQI1QPFAcYCfvw2+Tf4/vyk/3L/cQF7BeMEPAQ1AoT+av/B++769fjs+9wBLASGBv0G+AV8ADb7ZPtE/5P9TvrE+fL/NAPSBOIGwAM6Azb/uv9N/Pj3ofkm/B8CCAUTB/AFOAHa/JL/kgFp/+j4M/aL/SsCtQeYBt0EKgOl/Wr9/PyK/lf7HfhQ/TgDeQcwB7cEqAD6/fD+if4f/Bb5EPqS/jMEDAgIB3kCu/47/oP+8v7q/Pz68PsJABcFPAZeA2n/fP6KAP//rfxP/Lr9mf8HAWUDtQOOAVT/R/6ZAMsAif6T+8T9mAB6AkECWgFRAgT/HP/F/bv/LQHP/mP/7v4YAskBRP7p/RIBQwLg/+f+GwAuAJb/LwD3APkBKP+F/tn94v3xAFYA2gDfAXoBZgGm/4D/wwDn/Zn98v2N/0oCwQA4AGIAYgFaAG8B/gHs/Tj7IfsZAVQEwQImARMAkQA0/or+wgBq//X9af5pALIBUgK6AE4ALgAYAc4A3fx9/er9z/9KACABhwM7Aar/VQB+AXH+i/10/nP/HACu/zkBCwJlAvf/JP92/+/+Wf5y/iUAhQB2ANAAHwFuAn8B7v6Z/p39DP/p/aT+5gDuAJ4D0wJVAUj/zf9L/wT+GP2A/lYBwP6C/4QAugJAA2YBkv8S/3H+4fzH/1kAYwEx/xD/XgJxAXYAXv9ZANr/mf67/TH+IQDLAGYCewOsAZn+Gv0G/0cBOgBC/i7+9v/vAGUBeAHhAN3/1/4V/+z/gABZ/5z+NgDSAUgBEgBi/zv/xv5U/24BRwF3ABD/H/8KAYIAn/+5/tn+AgAZAHAA5QAbAXkABwBsAAYAN/9o/sD+6P+LAK8AcQA8AGEAfABCALD/Yf/N/4P/qP8pAI4AoQDV/wgA9f/m//j/r//Q/8//AgAlADgANwAWABkABgDy/+z/8f/7/wAA','UklGRkYGAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YSIGAAB//0MA8wDk/3H+Hf9n/wwBwwHn/yj/UgDw/1D/wgHP/+T85P/XADT+Nf8fAQcBQ/8wAcIAav4yAT0BOf+E/0QBmP/+/a4BtwLN/54AmgAG/qn+YwFF/0j+jADT/8T/Pf95AJIAhf+DAOT+bv9uANz+Tv9J/x8B0QHG/6QAgAFmAR8A6/9///D+GACEADoB4/96/9L/Kf9zAej/Xv+WALj9ff/q/1X+VQDNAM0AHAAo/wwAzwCF/hf+WQDp/n4AxgJIAbn/3P9UAvX/5P/FAaf/bQIgATj7nP7wA33+/fy2Adz/7QA5/Sj+cgDi+CIH6Ah89m328gJBDgT8AvaSBqgAvP/8A0gFSfrE9jULMAX3+/D7FP4o/m363RHlAxDqSP7RD8AOm/BP+ZMJwfE9BeoH8gRN+hbOfhVxQNbNT966VmnnPpueVuUyFpmmIJhPSLaoy4pVpQwWoKoyplOdqz7azVKF/x++jRT+Hbb2cRcP7q/KhvrdCkgJLharJUH1+cfL+PAUYxOBC6gH8P9n3Sj5fAQq9BIdaBh//jUJYNRDvBI07UoPyPv46TCMv9TrsUBrG/D8VPPN3TPn6Q4YGJ8A/PmB9mvytPFE/P8lvBNG/Ufy8OKH6rYXsyd+/WUArRRG7fvRcwqzMMwXNuEY7fLxa+K6Ejk1tghZ5CjosOF1APkcDRfp+6r3WucB7NUV/C76Iwf5K9nW2UX58wnKCP0HhBQF8onfZP9tG4UduxXzCzfi39O+8cAMNxHgFHb8v9305cUQhhbJDWkUvPKo3aPv4AmPF30YSQBl7K/xofMU9WgZFB3s6CzmeAeOBwL7JxEhGYcCmPxo+DX49Qt7C5v4LPEy72Hx6QHgCMX5H/yf/YvuTv8qEpoKQxEiDrL4LPIMAQkSyw8BAIXwS+9u81v8nwnsDRsBLvLa+LwDbgQQCgQH1vSr88T60wP8C+8Fvv5XBHEA4/Ih+6oK7gCg9jX8FfUl9/oIBQ2YBuEHX/3H98UBgAOyBqQLPgLB86X4HgL9AnsAMwfBAFrvgfWt/s/9sgKvB2AA0fcz/IcDsweLCaMBwvUJ9XH+IAMsBXcIHAfA/Vf4/v4NDBkISwIrBt/93vU79iz+8wB8/Y783vaL9Oj7ggNECJgG8wOWBSYH6AFABBUMuf6I8Of3QPr79Vr9MgRm/9v56gH1A84Flw1QC3sF2AOb/jH4l/vWAjX/U/iO9pj4g/zh/akBMwHy/sT/ZAQFAYAChwf6BuwA7fyh/er+EgXa/wv+R/2A+Xj6wf89/t8DMAjO/eX7zAZ/CigEeQOZ+8T52P5b/Ev8b//M+1/62PrX/poCnwTAAUwAsgFk/t0F1AZP/yj+zQFwAM//ngDq/779KgBI/nz6if72/X7+5gOxCRMD/fwNAUz/aP57BQAAcPel+vD9bPv9A84GUPlw+j0BfwOdA8cElQEl/eb6oQECCdAEBgKlAlr/+/gt++79Sf8V/tH8k/01/j4BeQWXCTAF1wEXAK78evxS/Yb9Kvv4+Gr5af6zAQQCdgaNB8QDJQH//5UENAXf/7H+Pf7Y+of5TfxhAD8EcgHs/Fz/kQFmAG0E5ARN/wT8dvrF+woBZQXm/1b8kPw2/KcB9QSGBP0BbP72+7L+EwO1At4EFQPw/uz+ev/A/zEAGACM/Pj6h/yD/D7+YQP4AiYBdALwATv/NADBBbYBbvw1/DX9W/2d/KoCJALw/k/+0v98Ak4D7wSWAiT/w/44AJYAbAAcAH0AB/x++477d/xZAtcC1/04/lkDBwAyAKMHigWb/eL/YP4i/AH/BwM4/4b8w/0D/bMBWwPEAUf+0ADpAcQAdf8FAmwBSf1h/u7/DQBYAAgAYv4TAOcA7f6D/oICVgGc/uL/5wD5/a7+FQEAATAAqAAh/1P/OgFLAJ8CtAAL/mb9zABnAPT+6gDp/7n+JAA7AEkA4AGOAIX/1/9rAN7+kv8cALD/j/7Z/UkAmwGZAEgBfgHB/67/+gAVAVf/lv8G/1b+JP/x/y8AOgCOACQAHwBtAGIAYQA/ANn/hv+n/6H/3v93AFsAwP/a/zAA6v/v/wYA/v/+/wEA+f/8/wIA','UklGRm4IAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YUoIAACAAb0Avv9GAfQA0AD7AYwABv5d/sL/hwAFALv/E/5fAOoCjP5rAeoEDABc/sIAEwFWALr8Sf+EASj8Xv2i/wb9l/39AHQA3f+l/34ABAJnArIAqv/zAUgDlAEL/3oBxAHh/vb/vQC9/mv/fv8q/pf+g/9IAX79RP0bAlf/Mv55AOAAo/sV/gkD/gI9AKH9lAHrAe8BqAN2Ab/8QP32/cEBNAAWAKf9iAIpAvYAcwVc/ToCaACc/hX9Uv/B/nv/AwHz/m79Jvxw+9YDsgKw+tz9tPsBCFsBi/3W/QgDtQLyAoMGwPolAbEJggT2/ED/yQGhAGf8HwXY+0/3MPpWA4kAafe5/939GwKS/BIAXQFY/5H+XwHWBloF/vtDA08F1P+xAa78rPxJ/mULGfom/HgAvP3ZBmQA7/znAssG/vybBUoB7fRa9mcXCQop0mvVjRgeE6/67zkb98GX7xV1cnnBus9CZ0/xcZOlNBpYb6zxzw1TOysgyjT2Fh9m79XS4itQMxvaauRs8+nlz+i8HXEfUht39pLVYASVKq/kj9sNJ1AUt/NS6O73oPw5IwcifAYF/CfjEc21EJFAM/n425P0pALJ8QQVsBByANwAOurV95oZwvph+MMWkdVqzUwfRTVw87z8fQ7A+tYACvO06VMQvBlV8qvu8QDQDAYBQBu1Kxf7dc565NkPrhTwBxHybuZt8OPuNO+1IYIgju8370/8xAlIIzgfsvys5eLko+6ACB4KeuzCAiMXbv1I9+sH3hPUFX4THwYk4p3ZIvHVEqsYkvWs6K7u6/ckA5IU2RsOBmnpxea+/kIXlwsp+2r27PF4A/8TvwlW9hUGFAXd5w/57Bx3D0r9kAFF9krtsgqyFI/+r/tm7grmFvtbDv0LcwiU90vnmvSeAA8D0RONCrLzZP70DmsKEwSoBjD8o/mo/cP5IfbGC/YXxAL59V72hPWnBHcJ2fnZ9c789PN38psEJwpvEVoKp/cK8VgCTQkm+Nb9HQm3+A/zEwHDDKYIBQkGCFf+MPnN+FEKpQq0+3byyPeqAk4CPQMlBcT/Cf2r9Vb2l/0hBfAEef7x+TP4RQbTBZACHgRs/0r+gv9m/Sf/KwP4Ar/8UQAYBckIlA4lCXb6J/RIBDUAUPS4+jr+5PY4817z+v48DacOvAR8/w8BygLXBL4AEgJeAI38Y/aF+Mf8tv/yA9IF8PuV+AAHgQ1nCKH7uALzCc39cPq3BgEFYvY693D7fvmm+Zn6VP9EA8L+rv7WAe4FLAaT/68Akv7B/5MBiv3m96P+RA58Bfn+ewFw/S39/gchCAn9JfzNACYAxAPUBe35dvPU9H0AYAHq/Uj95vj9+xX+RAFQBfkN2AjX/X0C7wTMAN8BNPtZ8zz/uAjO/072yQDRBHQGIghtAzv+Tvjn/z7/Q/zv+wD61vjcAFkLZAe9/Ob4Of5IBXAFrP1q/jL9D/qB9pX9dQSxBtwJCAUhA5P/owK3B8b9GviY/Uz8UfrL/lD/iP2mBtoGEP9kAHMGOgYbAPL5LfWk+YIAH/sN+gP8zfkZAFoBJwQbB0IHZAYABjsC1wCqBVoFdwDA+5D69P4a/5P5o/w5Ak8DqftP/mkBEwG9BLYAlvsV++z6Zf22+1X7OgPQAOf50f7uBlIBsQX8CgIFEwGXAxgGRgPuAED/4/wd/5j85Plz/4/7WvlI+JT9mQGRA5oB1Pz0/p3/BARHA/gCBwHX+3j9+vxH/vkBeAHCApAEzwIyAj4FzQVFAwwA//1//WT+Cv+u/dn6Xfuc+tP7oQC6AJcB8P83/fD89v9IBMACEgDMARkABf9DAdABJQFyApMExwLZ/5j92gDJAUsBn/44/asAVAA0AOf90Ptm+Kz6cf9kAowAmv8tBLD/5gCfAh4EtwNMAJkAvfwn/ev9Lv7gAPABWQAiABABx/1O/9kEogGx/b79UgB2AiABGAGZ/Yn+7AAn/2ABAALS/iT/QABl/Pj6r//mASz+oP4eALYARQC+AXwEogFlAfn/aAKvAmH9CP2T/dP/MgBfAU//Uv6YAQcB/QFXALcAhwALAI0Bv/yS/Df/sf5l/PD90QC1//X/ewDKApoBnP+DAJwAxwFkAEj/AAF7ATcBVgE7/2T/DwL0AU4Aev66/cD9n/8DAIf+If2E//4B8f3b/tcAIf/0/ugARAHz/yoBZ/9N/34A+QCcAcQCsQNFAAUA4v0Y/iYC0ABt/zT9yfvb/lgFfwOm/bX9O/03AfcBzf4vAXX/TPwk/nsAWAGEAD0AUAGxAYj/gPzU/skCHQM8Arf/7/vp+4sBsgOvATgCtAGgAL7/qgAKAwv/rvvq/dX/aP7a+gn9ev/M/rABSgEl/+oAuwG6Ae4BxwDl/ywAGAAdAvID/P5S/UH/Gf9XAXMBxv+k/j//dQBp/ykBIAPxAGz9qPvH/5H/0/yiABYB6PyQ+1b/YwK6AmECtAG7Af3/9wAxAmkAQQFYAI3/V/+H/n0AFwHG/kX/6wCCAJ7+/f+//y/+Tv7q/fr+5P70/4H+0/2E/xQCugGNAUoDiwM5Afr/agAEAGABnAL/AX/8C/5fAab9pvqgAH0Bjvwe/tsAHwEuAIn/df4XAhACv/9yAYIB0/wh/goDKwJm/gP+Iv/4/24C+P+5/uUAXgLzANf/Ef8n/k4BRgJ8/h/+Nf9c/lb/JQGhAIb/uAAvALr/9QDSAHMA+/+8/8X/zP/q/7n//f/S/7j/9v/5/xAAJgA4AB4A9/8BAAUA7/8CAA8ACADt//X/+f/5/wQACQD///v/AgAAAP7/AAAIAAAA/v/+//z/AAADAAEA//8AAAAA'],   // switch12 switch13 switch14
 space:['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'],   // switch17
 back:['UklGRiwYAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YQgYAAAAAekAywCsAKAAngCyAN0AwgCNAC8AuP9m//f+Wf7Y/YX9m/3E/cH9yf0f/oL+wv4l/0v/fP/t/4AA/ABaAXgBkgG0AbgBzgHTAcUBzgHaAbsBTgGiAOL/E//R/sL+0P4X/2v/xP/6/ywAMQAiAAEA9f8GAD8AnwD/ADUBNgEFAcAAZgAsAA4A8f///xMASABJABsAvv9t/2v/jf/H/yYAqQD5ABQBFAEDAfQA8gDXAOQACwFKAY8BwwHhAd4BxAGcAYIBYQFCATgBXQFhAWIBVwEOAZAAAwCM/zX/Fv8I/wT/DP/+/tz+tv6G/nv+h/6i/tz+Of+u/ywAnwD+AFABYAFGATMBFwEPAREBFgENAfoA/gDiANsA6QDjAPoAKgFsAZQBtwHQAbcBmAFyAUsBHwEJARAB+gDqAMQAkgBiAAsAuP9k/xL/yf6h/pz+of7H/uX+Cf83/1T/e/+c/7f/yf/p/wEACwA0AE8AbgB8AIsAsACdAK8AvwCdAKkAngCCAIEAjACQAGsAUgBAADkATABIAFEAbwCMAKQAqgCqAJwAlgCYAI0AewBxAG8AWgBNACcA4v+w/3P/Tv8f/+H+zP69/sT+tP62/tH+xf72/h3/M/97/7b/+v8wAGkAogC/APEA+ADxABsBLQEXAREBGQHuANsAzQCCAF0ATgAnAAsAGQACAO7/FgD1//P/FQDW/9b/AQDi/9n/2f/h//L/+v/z/+//DwDj/9v/6f/R/8P/nv+p/6D/iv+B/4X/dv93/33/cf+b/4L/ef+6/9n/wf/s/zQARwBoAJYAywC/AOoADAEcAVYBPQEQAQwBIAHOAKkAmwBtAFoAJQAoACwA/f+9/8r/rv+a/7n/mf+m/6b/nP+c/8L/wP+6/9b/3v/8/+n/BAAXABAACAAEABEAHAA2ABkAGwAUAC8AXwBuAIgAsQDeAMUA1wDdANQAtgCQAHoAfwCjAF8AXgChAO8AMwGjASUCZQK8AqsCigJsAjgCHgIRAiACEgISAuABdgENAZMAJwC2/yb/vv6O/lL+2/1c/QX9mvw5/MH7aPtW+2n7yftP/Pb8nf1H/tz+df8FAF8A/ACAAQsCoALeAi8DRgM2A0ADFAPDAosCfwJLAisCPgI5AjgCEQLAAXsBLAGtAEgALgA1AGAAYABsAJAAawA4APz/0v+m/07/I/8J/9/+rv5Q/gb+zP2e/VH96Py6/Lz82/wV/W79uv0N/kz+eP6S/rj+Cv+L/x8ApABYAc4BPgK0At4C0wLPAsYCigJZAjMCMgIeAtcBfAE3Ac8AjgBFANX/uP+b/4//iP+f/4T/Wv9A/wr/yv6V/pT+ov7P/ur+Bf8u/3f/gP9w/2P/Ov8F/6/+xv7S/vP+Ov9O/1X/j/+w/4P/eP+q/+3/DABiAL8ARAHDAeoB0AHAAccBngHFAeMBAwJfAnACZQJyAgYCggEtAbwASwDv/9z/5f/f/7H/gv8Y/8X+q/6Z/qL+sP7d/j3/lP+G/6D/i/+S/3n/IP8h/2H/r/+Q/8f/4v/w/xQAHgAzAF4AlwCfAOAADwE5ASgBYgFdASEBQgEWAWsBdwF6AbsBtQG3AZ8BiQFhAR0BwQBxAD8AfgA7AB0AZgAFABAA1f+V/4j/Tv8o/zH/bP9n/zv/jv+6/2j/Xf9d/3P/k/+UANb/yf8yAN//zABRAE0A6P6YAHgBnQAgAND+tQJyAuf/MP96AWQCQwJCASH/Jv/E/cYExQHV/TkAnP/PAYsBdwOS+5f+pQT5AVkCgv2j/Qn9qADMAhYANvoC/nIErf9w/sn6yANXA3P/NADp/BsCsv8ZAnz7+voOArP+NAEmBCQCEf11A0L/Dv10AOX+2gNwAagBHwBSALv9mgDeAmQBNAIM+QEFvgKp+wsC7gHUA/n8QPyhAKcBT/t0BA0Gsf9jAIP8ywKf/Y4BkACy/Hn+XwS2BN73jABPBWv7qvOxA1AA1gNd/eH6fQjY720T7QZn91sQRgMH9Gv4uw2o5b0JOQr99c4qBOPgtckZB1nZDWb3x/R2CH8eneyRDoHGzKPNBoD7Gho5SZ/7tu3HyGqleVBcV3/1tdeB5ik8WDZ/RcYUt76NxYa6dtTmK4odo9hW37XhGTJdJZDyygFX2ZnwIOdiIqI5qg/g/Jb8kTH9zfEEMC+96dkZjdQU+JomtPjFDZ3/XRJsCqTghewz3VUP/gqz5pcNB+Q9FBUDYPFnHnDYsQaIB2gLNiNCBJ8mh/8r9A7hnut+C0kGAhRv4kfxeQYFD5gThQSf/Dn6oPlP7CP8swQJE1MRywYQATD/kRCUCh8IowolBNoOZQKfGswaBAZRDW7zSPoP+1z6GvYb/x0IfvtH+3zy0vm3/E/yrvY8+Vv3D+vl6Jzpfet3+/v1pv678+/4kADb+9ULDQiE/pD33v1xApULIAQG/Mf3Pe+a8Aj4CfnP+C79EPs8AHMH3wXqCRsK/QQzCwwCVgkUDa4GVARs/Fv3zPw+A+/7evcY9Un2Zvjh/hH8sQK1AFT7mP2a/OX+KAA2A4D7APuZ/qUCDAFb/NEAj/+nACcD//uYAXoA/v9q/2v+HwPmBMQNugbSBEL/1v4gAsoDaAyKB+QCvAAM/s3+HAMjAmIA3//4/Rf/agJIBFsEJgSc/232nfgd+6f7R/48/lr7hfxOApH8/vuc+AX8Pvw09kv5sPea/Yj7zvss/dn9wwX3APz/Cf24/IkBKQInBmkHQAjk/zf/CAAa/C0DygMmBIIDugS1CWgLkQt3BlYBbPyG/h3/9Px6/yABLAYOBQkChQO4AqX+Lfwd+3oADgb8A4UDAAHw/v39h/oI+Zv9OAKRA4IEBgZjA18CgABn/D/+Wvxx+dr73vuZ/lUD+v8FAMb/uP5x/sP+p/9UBLcE7QBJBJUCQQCu/YX+pv4x/lz/n//K/24AUARUBCoBQv93/cn/Lv5C+739oPpl/SP+KP50/Uv7cv8LApsCLQMwA24D3gNnAxkF9wEfBC0EyQCJAn4CIALyAw8CAf89AiADlAHJAOgATgFDAvoAW/6i+vL6n/qM/EH+j/2j/+f9Wv6Y/g8DIAWRA74D7AJIBWoEAQRlBYX8/Pq8+935JP9N/f38oPzq+xj8bv0nADL+/vsj/Lf9Gv4YAGIA4P//AZEBgQMRA3ABNQQ2AxgEVQGJAuMFvQLjAe3/CAB7/SD7x/xw/db77fp1/Ej7WvzA/oL/wwGrAiUAFAHWAq8ADAUiA1D/4AIBAtcDHwFC/qcAMv4a/vL/vgHzATb/wf33++L7u/6+/37/Vf+0/Kv+Lf4M/bUBcAEqAIr/GgElAVoAmALQA3sBogCoALn/ggBl/3L/T/8P/jn9/P2d/gP9Wv6H/bf7hf6v/CsARQBl/RcA8/21AGMBRwB5AWwAYv9ZAFMBRgPaAJv/oABe/vsAcwESALb+ZPwY/Qv/uPyV/Hb+Pv6f/mz/vQAXAhwB2wAxAPUAoQC3/ysEtQGQA1oDhAEtAIr+uACT/Oj9Qf14/RkAb/0G/8P+ZP1Y/pf86/3v/UH+PwEgAbT/RgLXAAj/tQFIACgCnP82ANQAM/5IAR8B6P+O/yf+J/3w/S/9kfyB/WX9FPtl/Kr+Mv1Y/k3///0FAcQBKgFLAuUCaAPJAlkEMAJjAaYAvv5Z/yD+CAAQASr+BP9O/tf9xAAM/fX7bfys+9f/NQAY//L++/5kAh4CSgA+ALX/YAG4AYQASwJ+A5gB+v+q/4YAAQFXAOH9Vfu1/Mj+fQCfABz9MvxR/Lv7s/z9/U//bwDYAZgBuwHGAzIC5wHJAOf9TgDB/+EBRQLzAHoDmACb/6r+mf2K/3T+mf0x/lL+IP/l/l7+RP7L/NH7e/7V/lcB9QLlAE8DlgLEAcUBJQE4AAT/gv8x/wgAKgKxAdQAJ/9x/3f/sP7e/1H+x/+o/uz9EgAUAAgA7v5k/cf9gv+QAToCzgHcAtoAiv/EAKkAqwCvAH3/JgGs/on9FP8Y/kj///0j/vX+lP93AAoB0/1y/Fz+nP4UAKUA+gBXAVwAuv5q/9YBqwLAAsQBMgAtAFP/BADX/pL/1v+h/mUAiv9WALgAbgCh/97/UwFnAXX/H/8M/6D+2QCg/08AAAFw/hn/KQBNAb0BsABtADz/ef+j/+z/j/8wAPb/Hv6A/8/8PfwP/Y39ZgCbAZMBGwDzAKIAEgANAIH/f/+y/98Aqf9hAFQBXv+p/lL+F/+AAJj/yf9O//f+8P/A/goAtv7e/Gv+sP5i/2sAyAD6AKwBmgFjAEAAawBpAPD/uf8pAMz+xv84/7P+CADd/08Alf/4/o3/2wD7/ywAKgA1/xb/t/3O/4UA2/+bAcn/OP8vAKf/kwBwAbgAnwA5AYIBlAGv/3f/1f4g/2//5f7I/2b/lf+H/+//GQCj/0H/xf6X/t7/3gAeANL/3P93/g//P//P/uAAwgALAEMAt/9G/6v/qf1M/tr+9v3a/0b/8/6l/yT/uf/D/yP/bgCLAMsAvABj/2D/aP9M/+H/oP8DAdwABwBfAFb/hQBbAHYAXgAzAKEAtgDUAM//J//a/qb+MP+U//j/jQBtADgBIAAdAAsArP8LAI//sP8HAGgAzf9FALr/bP+D/3//EwBI/yX/6P96ADkBKQCN/+//UP8MABX/7P6s/1b/rwBrAPP/yADm/0r/W/9N/ykAJwBs/zX/cP/9//H/uf94/1f/U/8n/xr/EP/K/ykA///n/8T/6/+D/+v+HgA8AL3/9P9i/hz/MAC8/1cA7v+q//X/eP88AJIAUwBgAHf/rf83ACYA9//M/wEAxP/P/10AYwDrAO4AtgCnAEAAGgBCAKEAZQABAFz/Yv8e/0v/2wBMAM7+s/4T/xQALQB+/6z/mP8x/2n//f/P/8n/if+M/+f/3/8pAAgABACgAFgAqP9a/7f/lgBLAEIACQCU/9X/FgCNAMEAEwAMAMn/Vv9rAA8A9/81AP3/7wCLAPz/SgAhAAwBBwEiALX/bP///0wAEgG7AOz/ov/P/5sALwBJ/8L+z/6q/1wANQBGAN//+P9BAAAAPAAcAP3/vP/K/2gAVgBUAEkA0P+y/1L/9f88AJT/OgAZABgAlQB6AKUAJgDW/6v/9/+WACMA9f/F/9T//P/h/3IAfwAfAEQA3//N/0YACwD//+D/lf/H/9T/7P8JAP//AAAsAKwA//8jAKUASQBrAMD/tP/x/6X/yv82AOH/xf+QAJUAOgBGAHkAwwDPAIMAOgC4/6//HQC1/0v/h/+N/8z/6//m//j/QgCcAJ4AkQCHAPz/5/9vAOP/AQBm/4X/KwC2////nf/n//n/vv8PALv/uf+X/6z/HQAqAMQASgDN/3r/5/6n/zEApgDkAHUAuP8yAPMAAQGpAEkAKgDJ/yYAtACzAA0ACgBVACsAHwAJAHgABABq/3kAZQAfAHoA7P8TANn///9xAIj/uf/T/+7/OwDW/y0AEQCKAKgAQgAVAIH/fP9H//D/WgCU/1z/wP8WAL3/mv8qAB4Ay//I/xQAqQCDAN3/rv/p/8gAOgBQ/woA1v9KANv/aP9UAOj/sv8TAMEAbACZ/0v/i/8wADwATQDD/+j+Pf9DAE0BYQGiAEIASgABADQAvQA4ANH/aP8a/7D/AAD0/z4A/v8iABAAZP+y/5v/AwBWAPD/OwB0AKAAXgDM/y0AwgCkANMAQwHVAK4AigDPAOYACgC//5//8v8HAAIA6v8qAA0ATgCwAMb/wf+s//z/uQBxAF0AYgCJ/5P/TP9G////CQD5/9b/BQD4/4gAgABNAFQAtP9s/6//nv+q/+L/FwDr/wz/a//k/+//iP/p/x4AlQAbAacAvAD8/xgA4/8bANsAsQCAAEAALAA8ABcBvwBsAEkAEQBFAPH/jgAZAWkAo/+t/67/0f/j//7/ggBzAGIAmgCDAAQA2v83AGMAYQAoAMH/RAACAOH/DACs/83/4/+KADYAFwDz/7r/HAASAI8AtAAHALj/6/+6/9b/HwARAJz/iP/p/20AwADaAA0BVwCK/6D/uv/u/xcAy//b/7X/yv8eACsADwAZAPT///8GACkAQwDy/z8ACQCIABgAl/8rAC4APADZ/9j/UgAvAOf/LgDS//L/JgBAAEUAtP9x/4P/3P+AAKoAlwCaAKb/r//F/+7/nACcAOX/mP+5/9b/7v9M/xkAx/+n//b/qf86ABEA/v8TAHsA7v/6/xcABwB3AI3/2v/MAJwAhgBxAOf/MwAtAJYAGAHIAIMAnv9d/9j/NQC6/3b/bP/g/wQAw//z/58APQGfAJwAXwA9ACkA6v/r/2gAlwAKAOT/RgDeAFkAAQCS/7L/xf/a/2MAOwBiAOf/yv9zAP7/Bf8X/0H/2/8YAPD/5QDIAF0AVwAyAB0Ap/+B/7P/GQAEAOT/EwDF/6X/4f9FABoAdf+w/6kAsADPAPcAOACz/5r//f/U/2T/P/9V/6f/EACSANoAOgDg/0wASwCMADMA+v9cANT/wP8gAG4AjgDF/wEAJQCu/8n/1P+2ALMAWAA0AJT/qv/Y//j/MwC8/3T/0f/W/2wAcAD+/87/bP/5/68AlQAkAHYAbQDq/7T/cv+1/83/7v86AM//m/8WAGkAkAAMAND/UwDz/5///f92AGoA4v/R/9L/yv8NAEsAeQA1AAYAHgB6AN0AfgBLABsAHAB3AAwAvv8AABIAbQArAM//ZwAzAA0ASwAIAPH/xP/t/3IAMAAvAC0A0f/g//7/zf+c/xMAVwAnAP3/MAB1AE8Ayf90/7L/UAArAAYAfgAWAC0A0P9l////LwB/AKEA0/8EAHoAOAC1AMD/mv8SAEb/df/+/3cAlwB3AJoAwQALAN//OwB8AGkA2f8JABkAUgBEAAwAIgDy/+j/2f/W/xAATwDi/9f/dwB/AHIAtv9J/+j//P84ACAA7/8WAP7/MwDUAOcAUQBJAD8AbgA1AP//TwDp/83/9P/c/8T/+f8UAOP/s/8UAKYAnQBiAH0A1gCiAA4Ar/8AAC4APgB4AHIAWAAZABkAKAAqABAA9//p/7b/vv9HAH0ADgBw/3//wf+Y/yEAlwBbAAYAsgAHAdYAlAD//xQAmf/a/yEAOQBjAIH/SP+s/2YAPwD1/ysAMgAyABQASgBZADMAFgBXADwA4/9wAJ8APgA8APj/1//n/yoA9AAIAacAOwAbADkAMAD2/8L/4//Q/xIAyADZAHgAhQAqAP7/6P8fAKYADAANAFMAfAB0AJEAnwCa/4T/0v8tAOYAkQAdAPv/FQB2AMz/0v/w/3f/xf/0/3AANACY/6D/wv9aAIsAKgAdAML/8/9LAA8AWwAaAP//w/8EABYBIwGYAO//+/97AKUA1QD0AKUASgCy/wAAfAB/AFsAs//0/+n/UgARAdAALgCb/6H/GADWAL4ANADJ/8//CQBGAE4A4//I/5v/+P8kACsAqwBaADYA5f+7/yUA8/8SAAAATgB1ANT/FAAvADgAQAAUAKMApQBnAPMAdgDY/x0AfAB7AEoA+//G/zMAFgBXAEIAHwBgAA4ALAA3ABsA3/8oAAUAnv8SAHIAqADq/3D/RwAsAAcAPgD6/zoAQQBoAAUAhv+k/xoAigBEAN//XP/H/ycAOgA1ADEAQQAwAFQAoAD6AGEACQC8/+L/VQCuAHgA5v8xADQA1ADDAIQASgCL/6z/7P+KAMcAJQDz//n/3/8DAJP/pf/b/67/BADu/1oAjwD2//X/pf/v/1kAwf/J/7H/5P/9/zkAugAWAPL/+P8xADQAqf+m/93/5f/E/8T/vP8HADQAMAAFAAoAVQD//+b/KQBqAH8AGgAVACMADABcAPj/zv/O/23/x//A/8L/5P8bAGoAYABMAPH////w/6//2f+t/9X/EQDJ/wEAEgArACgA6P92AG0A7P+e/6H/IQALANv/7f/e/wkACADR/wUACgAlABAAvf9ZAD0A5f80AFoAfgAKAMr/+v+w/3v/uf8uABkArP/L//P/ZABdAAMADgDQ/xEABQDt/zgAGgAXAPD/zf+0/7T/6P/P/wEALwAVAB4A9v8bAF8AJAAFAAsA7//r/+7/5/8LAPj/xP/l/9r/9v8UAP//HwD6/wAAGwADAPj/8P/+/wAA/v8OABAA+v/9//H/9/8MAP7//f8AAA0ACQAFAAcA/P/8//z/BQAEAP7/AQD//wAAAgAAAA=='],   // switch29
};
// ---------- end typing key samples ----------
})();
