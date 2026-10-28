const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/practice-unified.js'),'utf8');
function setup(storage={},sentence='The site is interactive.'){
 const elements=new Map(),events={};let completed=0,playResult=()=>Promise.resolve(),plays=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{id,hidden:id==='restore',value:'',dataset:{},style:{},children:[],textContent:'',selectionStart:0,selectionEnd:0,readOnly:false,disabled:false,
  classList:{toggle(){},remove(){},add(){}},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},addEventListener(k,f){(this.events??={})[k]=f},focus(){document.activeElement=this},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b},getAnimations(){return[]},animate(){},pause(){this.paused=true},play(){plays++;this.paused=false;return playResult()}});return elements.get(id)};
 const document={activeElement:null,querySelector:s=>s==='dialog[open]'?null:el(s),addEventListener(k,f){events[k]=f}};
 const q={questionKey:'q1',questionId:'1',sentence,translation:'中文',audioUrl:'test.mp3'};
 const other={...q,questionKey:'q2',questionId:'2'};
 const PTE={active:q,questions:[q,other],notes:{},posLabels:{},states:{},phrasesOf:()=>[q.sentence],findQuestion:k=>[q,other].find(x=>x.questionKey===k),visible:()=>[q,other],phraseAudio:()=>null,render(){},setState(k,v){PTE.states[k]={...PTE.states[k],...v}},dailyStats:{complete(){completed++}},book:{skip:()=>false,miss(){},credit:()=>false,save(){}},noteFor:()=>null,ready:new Promise(()=>{})};
 const context={$,document,PTE,ACCESS:{selected:0,ready:new Promise(()=>{}),activity(){},feature(){},ensureStudy:async()=>true},window:{addEventListener(){}},localStorage:{getItem:k=>storage[k]??null,setItem(k,v){storage[k]=v}},tokens:s=>(s.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)*/g)||[]),esc:s=>String(s),matchMedia:()=>({matches:true}),setTimeout:()=>0,clearTimeout(){},Date,console,performance:{now:()=>0},requestAnimationFrame:f=>f()};function $(id){return el(id)}
 context.window=context;context.addEventListener=()=>{};
 const hooks='window.testEngine={scoreWords,wordScore,exact,check,state,punishment,restart,nextPunishmentAttempt,toggleAnswer,render,saveProgress,toggleLoop,handleInput,playCurrent,playChosen,maybeAutoplay,openSlot,enabled:()=>punishmentEnabled};';
 const previewSource=fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/practice-preview.js'),'utf8');
 vm.runInNewContext(previewSource.slice(previewSource.indexOf('const STATE_KEY='),previewSource.indexOf('// ---------- Search')),context);
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,hooks+'})();'),context);
 const t=context.testEngine;t.render();const click=id=>el(id).events.click();
 // Whole-answer fixtures set content; real selected-word keyboard edits are tested separately.
 const answer=text=>{t.state().whole.fix=null;el('typing').value=text;t.handleInput({isComposing:false});t.check(true)};
 return{t,el,click,answer,PTE,storage,completed:()=>completed,plays:()=>plays,setPlay:f=>{playResult=f}};
}
const correct='The site is interactive.';
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
async function listen(h){void h.t.playCurrent();await tick();h.el('audio').onended?.();await tick()}
function enter(h,{repeat=false}={}){h.el('typing').events.keydown({key:'Enter',code:'Enter',target:h.el('typing'),repeat,preventDefault(){}})}
function type(h,text){h.t.state().whole.fix=null;h.el('typing').value=text;h.t.handleInput({isComposing:false})}
(async()=>{
 // Different answer lengths must produce identical blank and in-progress displays.
 let blindShort=setup({},'A short sentence.'),blindLong=setup({},'This is a considerably longer sentence with many additional words.');
 assert.equal(blindShort.el('words').innerHTML,blindLong.el('words').innerHTML,'blank view must not reveal target word count or lengths');
 type(blindShort,'my own draft');type(blindLong,'my own draft');
 assert.equal(blindShort.el('words').innerHTML,blindLong.el('words').innerHTML,'typed display must depend only on typed words before checking');
 assert.equal((blindLong.el('words').innerHTML.match(/class="word/g)||[]).length,3,'no future answer slots');
 // Trial-word scoring counts occurrence-limited words, independent of order and extra guesses.
 const eleven='The library offers many useful resources for students on this campus.';
 let scored=setup({},eleven);assert.equal(scored.el('wordScore').hidden,true,'no denominator before the first submission');
 scored.click('punishmentToggle');await listen(scored);scored.answer('campus useful The offers students library guesses');
 assert.equal(scored.t.state().lastSubmission.correct,6);assert.equal(scored.t.state().lastSubmission.total,11);
 assert(scored.el('wordScore').innerHTML.includes('6/11'));assert.equal(scored.completed(),0);
 const partial=scored.t.state().whole.fix;assert.equal(partial.ok.filter(Boolean).length,6,'out-of-order correct words stay credited in correction slots');
 scored.t.saveProgress();let scoreRestore=setup({...scored.storage},eleven);assert.equal(scoreRestore.t.state().lastSubmission.correct,6);assert(scoreRestore.el('wordScore').innerHTML.includes('6/11'));
 scored=setup({},eleven);scored.click('punishmentToggle');await listen(scored);
 scored.answer('campus this on students for resources useful many offers library the extra guesses');
 assert.equal(scored.completed(),1,'first full word score passes despite order and surplus guesses');assert(scored.el('wordScore').innerHTML.includes('11/11'));
 scored=setup({},'The course and the test are useful.');
 let count=scored.t.wordScore('course and the test are useful');assert.equal(count.correct,6);assert.equal(count.total,7,'repeated target word needs two occurrences');
 count=scored.t.wordScore('the the the the');assert.equal(count.correct,2,'repeating a guessed word never earns more than its target count');
 assert.equal(scored.t.wordScore('the course and the tests are useful').correct,6,'spelling and singular/plural remain distinct');
 scored=setup({},'This course has useful materials.');scored.click('punishmentToggle');await listen(scored);
 scored.answer('materials useful has courses course this');assert.equal(scored.completed(),1,'both candidate spellings may be tried together');
 scored=setup({},eleven);scored.click('punishmentToggle');await listen(scored);await listen(scored);
 scored.answer('campus this on students for resources useful many offers library the guess');await tick();
 assert.equal(scored.completed(),0,'replayed round still cannot independently pass');assert.equal(scored.t.punishment().round,2);
 assert.equal(scored.el('wordScore').hidden,true,'a new round never reveals the previous denominator');assert.equal(scored.el('wordScore').textContent,'');assert.equal(scored.el('status').textContent,'');
 scored.click('clearRedo');await tick();assert.equal(scored.el('wordScore').hidden,true,'manual clear does not show an old score as a fresh result');
 scored=setup({},eleven);scored.click('punishmentToggle');scored.t.check(true);
 assert(scored.el('wordScore').innerHTML.includes('0/11'));assert.equal(scored.t.punishment().submissions,0,'empty Enter still consumes no challenge submission');

 let h=setup();h.click('punishmentToggle');await listen(h);h.answer(correct);
 assert.equal(h.completed(),1,'one listen and first correct submission passes');
 h.t.check(true);assert.equal(h.completed(),1,'completion counted once');
 h.t.saveProgress();let restored=setup({...h.storage});assert(restored.t.enabled());assert(restored.t.state().whole.passed);

 h=setup();h.click('punishmentToggle');await listen(h);h.answer('wrong');await tick();
 assert.equal(h.completed(),0);assert.equal(h.el('typing').value,'wrong','wrong submission must retain this round and its input');
 assert.equal(h.t.punishment().round,1);assert.equal(h.t.punishment().listens,1);assert.equal(h.t.punishment().submissions,1);
 assert.equal(h.t.punishment().misses,1);assert(h.el('next').disabled);assert.equal(h.plays(),1);assert.equal(h.el('typing').readOnly,false);
 enter(h);await tick();assert.equal(h.t.punishment().round,1);assert.equal(h.t.punishment().misses,1,'unchanged Enter is not another miss');
 type(h,'The site');enter(h);await tick();assert.equal(h.t.punishment().round,1,'partially corrected input stays in the round');assert.equal(h.plays(),1);
 type(h,correct);await tick();assert.equal(h.t.punishment().round,1,'typing the right sentence does not advance automatically');
 enter(h,{repeat:true});await tick();assert.equal(h.t.punishment().round,1,'held Enter cannot start a round');
 await h.PTE.select('q2');assert.equal(h.PTE.active.questionKey,'q1','unsuccessful question remains guarded');
 enter(h);await tick();assert.equal(h.t.punishment().round,2,'only a fully correct submission starts the next round');
 assert.equal(h.t.punishment().listens,1);assert.equal(h.plays(),2);assert.equal(h.el('typing').value,'');assert.equal(h.completed(),0);
 enter(h);await tick();assert.equal(h.t.punishment().round,2,'empty new round does not advance');
 h.answer(correct);assert.equal(h.completed(),1,'next clean round passes');

 h=setup();h.click('punishmentToggle');await listen(h);await listen(h);enter(h);await tick();
 assert.equal(h.t.punishment().round,1,'replayed empty round cannot be skipped with Enter');
 h.answer('not correct');await tick();assert.equal(h.t.punishment().round,1);assert.equal(h.plays(),2);
 h.answer(correct);await tick();assert.equal(h.t.punishment().round,2);assert.equal(h.t.punishment().listens,1);assert.equal(h.completed(),0);
 h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');h.t.toggleLoop();await tick();
 assert(h.t.punishment().reason.includes('循环'));h.answer('wrong');await tick();
 assert.equal(h.el('audio').loop,true,'wrong submission does not reset playback');assert.equal(h.t.punishment().round,1);
 h.answer(correct);await tick();assert.equal(h.el('audio').loop,false,'correct Enter starts a new single-play round');
 assert.equal(h.t.punishment().listens,1);assert.equal(h.t.punishment().reason,'');assert.equal(h.plays(),2);
 h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');await listen(h);h.t.toggleAnswer();
 assert.equal(h.el('cue').textContent,'中文');h.answer('a draft');await tick();
 assert.equal(h.t.state().whole.text,'a draft');assert.equal(h.el('reference').hidden,true,'starting to type hides the revealed answer');assert.equal(h.el('cue').textContent,'');
 assert.equal(h.t.punishment().round,1);h.answer(correct);await tick();
 assert.equal(h.el('typing').value,'');assert(h.el('reference').hidden);assert.equal(h.el('cue').textContent,'');
 assert.equal(h.t.punishment().round,2);assert.equal(h.t.punishment().listens,1);assert.equal(h.completed(),0);
 h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');await listen(h);h.t.toggleAnswer();h.t.toggleAnswer();h.answer(correct);await tick();
 assert.equal(h.completed(),0,'hiding an answer cannot restore eligibility');assert.equal(h.t.punishment().round,2);

 h=setup();h.click('punishmentToggle');h.answer(correct);await tick();assert.equal(h.completed(),0,'no listen cannot pass');
 assert.equal(h.t.punishment().round,2);h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');h.setPlay(()=>Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'})));
 await listen(h);assert.equal(h.t.punishment().listens,0,'blocked audio consumes no listen');h.setPlay(()=>Promise.resolve());await listen(h);h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');let resolveOld;
 h.setPlay(()=>new Promise(resolve=>{resolveOld=resolve}));void h.t.playCurrent();h.t.restart();h.setPlay(()=>Promise.resolve());resolveOld();await tick();
 assert.equal(h.t.punishment().listens,0,'cancelled playback cannot charge a new round');await listen(h);h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');await listen(h);h.answer('wrong');h.t.saveProgress();
 restored=setup({...h.storage});assert.equal(restored.el('typing').value,'wrong');assert(restored.el('next').disabled);
 enter(restored);await tick();assert.equal(restored.t.punishment().round,1);assert.equal(restored.el('typing').value,'wrong');
 restored.answer(correct);await tick();assert.equal(restored.t.punishment().round,2);restored.answer(correct);assert.equal(restored.completed(),1);
 h=setup();h.click('punishmentToggle');await listen(h);h.t.saveProgress();restored=setup({...h.storage});
 restored.t.maybeAutoplay();await tick();assert.equal(restored.plays(),0,'refresh does not replay an already-heard round');restored.answer(correct);assert.equal(restored.completed(),1);

 const legacy=JSON.parse(h.storage['woguatang-session-v1']);legacy.items.q1.st.whole.text='my existing draft';
 legacy.items.q1.st.punishment={streak:1,penalty:3,misses:2,awaiting:false,blocked:true};
 restored=setup({'woguatang-session-v1':JSON.stringify(legacy),'unrelated-practice-records':'KEEP'});
 assert.equal(restored.el('typing').value,'my existing draft');assert.equal(restored.t.punishment().misses,2);assert(restored.t.punishment().reason.includes('旧规则'));
 assert.equal(restored.storage['unrelated-practice-records'],'KEEP');restored.click('punishmentToggle');assert(!restored.el('next').disabled);assert.equal(restored.el('typing').readOnly,false);

 h=setup();h.click('punishmentToggle');await h.PTE.select('q2',{play:true});await tick();assert.equal(h.t.punishment().listens,1);h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');await listen(h);void h.PTE.playSentence(h.PTE.active);await tick();h.answer(correct);await tick();assert.equal(h.completed(),0);assert.equal(h.t.punishment().round,2);
 h=setup();h.click('punishmentToggle');h.t.toggleLoop();await tick();h.click('clearRedo');await tick();assert.equal(h.el('audio').loop,false);assert.equal(h.t.punishment().listens,2);h.answer(correct);await tick();assert.equal(h.completed(),0);assert.equal(h.t.punishment().round,2);h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.answer(correct);assert.equal(h.completed(),1,'normal mode unchanged');
 // Per-question totals count started attempts, not checks, replays, visits or refreshes.
 h=setup();h.click('punishmentToggle');assert.equal(h.PTE.roundCount('q1'),0);
 await listen(h);assert.equal(h.PTE.roundCount('q1'),1);await listen(h);assert.equal(h.PTE.roundCount('q1'),1);
 h.answer('wrong');enter(h);assert.equal(h.PTE.roundCount('q1'),1);type(h,correct);assert.equal(h.PTE.roundCount('q1'),1);
 enter(h);await tick();assert.equal(h.PTE.roundCount('q1'),2,'new audio-backed attempt adds exactly one round');
 h.answer(correct);assert.equal(h.PTE.roundCount('q1'),2);h.t.saveProgress();
 restored=setup({...h.storage});assert.equal(restored.PTE.roundCount('q1'),2,'lifetime totals survive refresh');
 assert.equal(restored.el('practiceRounds').textContent,'累计 2 轮');
 await restored.PTE.select('q2',{play:true});await tick();assert.equal(restored.PTE.roundCount('q2'),1);assert.equal(restored.PTE.roundCount('q1'),2);
 restored.t.restart({replay:true});await tick();assert.equal(restored.PTE.roundCount('q2'),2);
 await restored.PTE.select('q1');assert.equal(restored.PTE.roundCount('q1'),2,'opening completed question alone does not count');
 type(restored,'some typing');assert.equal(restored.PTE.roundCount('q1'),3,'typing without audio still starts a round');
 restored.t.restart();assert.equal(restored.PTE.roundCount('q1'),3,'blank reset is not counted until practice begins');
 type(restored,'a');assert.equal(restored.PTE.roundCount('q1'),4);
 restored.click('punishmentToggle');assert.equal(restored.PTE.roundCount('q1'),4);type(restored,'normal practice');assert.equal(restored.PTE.roundCount('q1'),5,'switching mode keeps lifetime totals');

 h=setup();h.click('punishmentToggle');h.setPlay(()=>Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'})));
 await listen(h);assert.equal(h.PTE.roundCount('q1'),0,'blocked audio alone does not count as practice');
 h.setPlay(()=>Promise.resolve());void h.PTE.playSentence(h.PTE.active);await tick();assert.equal(h.PTE.roundCount('q1'),0,'wrong-word audio review alone does not create a dictation round');
 type(h,'start');assert.equal(h.PTE.roundCount('q1'),1);

 h=setup();h.click('punishmentToggle');await listen(h);h.t.saveProgress();
 const oldStorage={...h.storage},oldSession=JSON.parse(oldStorage['woguatang-session-v1']);
 delete oldSession.items.q1.st.roundRecorded;oldSession.items.q1.st.punishment.round=4;
 const oldStates=JSON.parse(oldStorage['pte:summary-preview:v1']);delete oldStates.q1.practiceRounds;delete oldStates.q1.roundHistoryPartial;
 oldStorage['woguatang-session-v1']=JSON.stringify(oldSession);oldStorage['pte:summary-preview:v1']=JSON.stringify(oldStates);
 restored=setup(oldStorage);assert.equal(restored.PTE.roundCount('q1'),4,'known legacy punishment rounds are retained');
 assert.equal(restored.PTE.roundLabel('q1'),'累计 4 轮');await listen(restored);assert.equal(restored.PTE.roundCount('q1'),4,'migration does not charge the same current round twice');
 restored.t.restart({replay:true});await tick();assert.equal(restored.PTE.roundCount('q1'),5);

 // Clear/redo stays in the same round, even across repeated clicks and refreshes.
 for(const challenge of [false,true]){
  h=setup();if(challenge)h.click('punishmentToggle');await listen(h);type(h,'my current draft');
  const total=h.PTE.roundCount('q1'),round=h.t.punishment().round,plays=h.plays();
  h.t.toggleAnswer();
  for(let i=1;i<=3;i++){
   h.click('clearRedo');await tick();
   assert.equal(h.PTE.roundCount('q1'),total,'clear/redo never adds another lifetime round');
   assert.equal(h.t.punishment().round,round,'clear/redo never advances the displayed round');
   assert.equal(h.el('typing').value,'');assert(h.el('reference').hidden);assert.equal(h.el('cue').textContent,'');
   assert.equal(h.el('audio').loop,false);assert.equal(h.plays(),plays+i,'each clear/redo plays exactly once');
   assert(h.t.state().whole.revealed,'clearing within a round preserves answer exposure');
  }
  h.t.saveProgress();restored=setup({...h.storage});assert.equal(restored.PTE.roundCount('q1'),total);
  type(restored,'continue');assert.equal(restored.PTE.roundCount('q1'),total,'typing after restored clear/redo is the same round');
  if(challenge){restored.answer(correct);await tick();assert.equal(restored.t.punishment().round,round+1);assert.equal(restored.PTE.roundCount('q1'),total+1,'correct Enter still starts the actual next round')}
 }
 h=setup();h.click('punishmentToggle');await listen(h);h.answer('wrong');
 h.click('clearRedo');await tick();assert.equal(h.t.punishment().round,1);assert.equal(h.PTE.roundCount('q1'),1);
 assert.equal(h.t.punishment().misses,1);assert(h.t.state().whole.errors>0,"clear/redo preserves the round's earlier mistake");
 h.answer(correct);await tick();assert.equal(h.completed(),0);assert.equal(h.t.punishment().round,2);assert.equal(h.PTE.roundCount('q1'),2);
 // Auto-hide changes visibility only, preserves seen-answer disqualification and the input caret/audio.
 for(const challenge of [false,true]){
  h=setup();if(challenge)h.click('punishmentToggle');await listen(h);h.t.toggleAnswer();
  assert.equal(h.el('reference').hidden,false);assert.equal(h.el('cue').textContent,'中文');
  h.el('typing').value='The si';h.el('typing').selectionStart=3;h.el('typing').selectionEnd=3;
  const plays=h.plays();h.t.handleInput({isComposing:false});
  assert(h.el('reference').hidden);assert.equal(h.el('reference').textContent,'');assert.equal(h.el('cue').textContent,'');assert(h.el('.cue-line').hidden);
  assert.equal(h.el('show')['aria-pressed'],'false');assert.equal(h.el('show').textContent,'答案');
  assert.equal(h.el('typing').value,'The si');assert.equal(h.el('typing').selectionStart,3);assert.equal(h.plays(),plays);
  assert(h.t.state().whole.revealed,'auto-hide never erases answer exposure');
  if(challenge)assert(h.t.punishment().reason.includes('答案'));
 }
 h=setup();h.t.toggleAnswer();h.el('typing').value='t';h.t.handleInput({isComposing:true});assert(h.el('reference').hidden,'composition input also hides answers immediately');
 // Actual input selection and keyboard replacement, including the sentence in the user's screenshot.
 function insertText(h,text){
  const box=h.el('typing');box.events.beforeinput({inputType:'insertText',data:text,target:box});
  const start=box.selectionStart,end=box.selectionEnd;
  box.value=box.value.slice(0,start)+text+box.value.slice(end);
  box.setSelectionRange(start+text.length,start+text.length);h.t.handleInput({isComposing:false});
 }
 const wildlife='The plight of wildlife has frequently been overlooked in development.';
 for(const challenge of [false,true]){
  h=setup({},wildlife);if(challenge)h.click('punishmentToggle');await listen(h);
  const original='the plight of wildlife has frequdently been overlooked the development';
  h.answer(original);
  const f=h.t.state().whole.fix;assert(f.free);assert.equal(f.at,5);
  assert.equal(h.el('typing').value,original,'checking never drops, reorders or replaces the full response');
  const start=original.indexOf('frequdently');
  assert.equal(h.el('typing').selectionStart,start);assert.equal(h.el('typing').selectionEnd,start+'frequdently'.length);
  enter(h);assert.equal(h.el('typing').selectionStart,start,'unchanged Enter reselects the first wrong word');
  insertText(h,'f');assert.equal(h.el('typing').value,original.replace('frequdently','f'));
  insertText(h,'requently');assert.equal(h.el('typing').value,original.replace('frequdently','frequently'),'following letters append without clearing again');
  h.t.openSlot(8,{select:true});insertText(h,'in');
  assert.equal(h.el('typing').value,'the plight of wildlife has frequently been overlooked in development');
  assert.equal(h.PTE.roundCount('q1'),1);assert.equal(h.plays(),1);
  enter(h);await tick();
  if(challenge){assert.equal(h.t.punishment().round,2);assert.equal(h.PTE.roundCount('q1'),2);assert.equal(h.completed(),0)}
  else assert.equal(h.completed(),1);
 }
 // Missing words are appended freely; no fixed number of slots survives checking.
 for(const challenge of [false,true]){
  h=setup();if(challenge)h.click('punishmentToggle');await listen(h);h.answer('The site');
  assert.equal(h.el('typing').value,'The site ');assert.equal(h.el('typing').selectionStart,9);
  insertText(h,'interactive ');insertText(h,Array.from({length:30},(_,i)=>'guess'+i).join(' '));
  const many=h.el('typing').value;assert.equal(h.t.wordScore(many).correct,3);
  assert.equal(h.t.state().whole.text,many);assert.equal(many.split(/\s+/).length,33,'extra guesses exceed the answer length without clipping');
  enter(h);await tick();assert.equal(h.el('typing').value,many,'all guesses survive another submission');
  assert(h.el('wordScore').innerHTML.includes('3/4'));
  h.t.saveProgress();restored=setup({...h.storage});assert.equal(restored.el('typing').value,many,'refresh restores every extra word');
  const n=h.el('typing').value.length;h.el('typing').setSelectionRange(n,n);insertText(h,' is spare words');
  assert.equal(h.t.wordScore(h.el('typing').value).correct,4);assert.equal(h.completed(),0,'full word credit does not submit while typing');
  assert.equal(h.el('typing').readOnly,false,'more words remain editable until Enter');
  enter(h);await tick();
  if(challenge){assert.equal(h.t.punishment().round,2);assert.equal(h.el('wordScore').hidden,true)}else {assert.equal(h.completed(),1);assert(h.el('wordScore').innerHTML.includes('4/4'))}
 }
 // A collapsed caret inside a marked mistake still replaces its whole old spelling.
 h=setup({},wildlife);h.answer('the plight of wildlife has frequdently been overlooked the development');
 h.t.openSlot(5,{at:4});const caret=h.el('typing').selectionStart;
 assert.equal(caret,h.el('typing').value.indexOf('frequdently')+4);
 insertText(h,'f');insertText(h,'r');assert(h.el('typing').value.includes('has fr been'));
 h.t.openSlot(5,{at:1});insertText(h,'x');assert(h.el('typing').value.includes('has fxr been'),'mid-word edits of new partial text remain ordinary');
 // Correct words are editable as well, and Space remains a normal separator.
 h.t.openSlot(0,{select:true});insertText(h,'there');assert(h.el('typing').value.startsWith('there plight'));
 h.el('typing').setSelectionRange(h.el('typing').value.length,h.el('typing').value.length);insertText(h,' more extra guesses');
 assert(h.el('typing').value.endsWith('development more extra guesses'));
 h=setup();h.answer('The syte is interactive.');h.t.openSlot(1,{at:2});h.el('typing').events.compositionstart();
 assert.equal(h.el('typing').selectionStart,4);assert.equal(h.el('typing').selectionEnd,8,'IME selects only the old wrong word inside the full response');
 const ime=h.el('typing');ime.value=ime.value.slice(0,ime.selectionStart)+'site'+ime.value.slice(ime.selectionEnd);ime.events.compositionend();
 assert.equal(ime.value,'The site is interactive.');assert.equal(h.completed(),0);
 // Legacy correction storage migrates in place, preserving audio/round exposure and all available words.
 h=setup();h.click('punishmentToggle');await listen(h);h.answer('The syte is interactive.');h.t.saveProgress();
 const old=JSON.parse(h.storage['woguatang-session-v1']);old.items.q1.st.whole.fix={slots:['The','syte','is','interactive','spare','words'],ok:[true,false,true,true,false,false],marked:['The','syte','is','interactive','spare','words'],at:1};
 h.storage['woguatang-session-v1']=JSON.stringify(old);restored=setup({...h.storage});
 assert.equal(restored.el('typing').value,'The syte is interactive spare words');assert(restored.t.state().whole.fix.free);
 assert.equal(restored.t.punishment().round,1);assert.equal(restored.t.punishment().listens,1);
 // Real Enter grades, reveals both answers, and preserves the selected wrong word in the full response.
 h=setup();h.click('punishmentToggle');await listen(h);type(h,'The syte is interactive extra trials');enter(h);await tick();
 assert.equal(h.el('reference').hidden,false);assert.equal(h.el('reference').textContent,correct);assert.equal(h.el('cue').textContent,'中文');
 assert.equal(h.el('typing').value,'The syte is interactive extra trials');
 assert.equal(h.el('typing').selectionStart,4);assert.equal(h.el('typing').selectionEnd,8);
 insertText(h,'site');assert.equal(h.el('reference').hidden,true);assert.equal(h.el('cue').textContent,'');
 assert.equal(h.el('typing').value,'The site is interactive extra trials');enter(h);await tick();
 assert.equal(h.t.punishment().round,2);assert.equal(h.el('wordScore').hidden,true);assert.equal(h.el('status').textContent,'');
 assert.equal(h.el('reference').hidden,true);assert.equal(h.el('cue').textContent,'','new-round answers stay hidden');
 type(h,'interactive is site the extra trials');enter(h);await tick();
 assert.equal(h.completed(),1,'answers shown after a clean successful submission do not invalidate the pass');assert.equal(h.el('cue').textContent,'中文');
 // Random order is persisted in the existing session backup without touching the draft or round count.
 h=setup();type(h,'my current draft');const roundsBefore=h.PTE.roundCount('q1'),playsBefore=h.plays();
 h.PTE.toggleRandomPractice();assert(h.PTE.practiceOrder.enabled);assert.equal(h.el('typing').value,'my current draft');
 assert.equal(h.PTE.roundCount('q1'),roundsBefore);assert.equal(h.plays(),playsBefore);
 assert.equal(JSON.parse(h.storage['woguatang-session-v1']).practiceOrder.enabled,true);
 restored=setup({...h.storage});assert(restored.PTE.practiceOrder.enabled);assert.equal(restored.el('typing').value,'my current draft');
 restored.PTE.toggleRandomPractice();assert.equal(JSON.parse(restored.storage['woguatang-session-v1']).practiceOrder.enabled,false);
 // Favoriting while practicing preserves the current draft, audio, round and saved favorite flag.
 h=setup();h.click('punishmentToggle');await listen(h);type(h,'my draft');
 const favoriteRounds=h.PTE.roundCount('q1'),favoritePlays=h.plays();h.click('favoriteCurrent');h.t.render();
 assert(h.PTE.isFavorite('q1'));assert.equal(h.el('favoriteCurrent')['aria-pressed'],'true');
 assert.equal(h.el('typing').value,'my draft');assert.equal(h.PTE.roundCount('q1'),favoriteRounds);assert.equal(h.plays(),favoritePlays);
 restored=setup({...h.storage});assert(restored.PTE.isFavorite('q1'));assert.equal(restored.el('typing').value,'my draft');
 restored.click('favoriteCurrent');assert(!restored.PTE.isFavorite('q1'));
 console.log('PASS: unlimited full-response trial words before/after checks, refresh and legacy migration, explicit submission, occurrence-limited unordered scores, 6/11 and full-score feedback, persistence, challenge guards, collapsed-caret first-letter replacement, continued typing, mid-word edits, IME, selected corrections, same-round redo, round totals, existing practice rules.');
})().catch(e=>{console.error(e);process.exitCode=1});
