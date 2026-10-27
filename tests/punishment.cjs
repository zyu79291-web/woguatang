const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/practice-unified.js'),'utf8');
function setup(storage={}){
 const elements=new Map(),events={};let completed=0,playResult=()=>Promise.resolve(),plays=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{id,hidden:id==='restore',value:'',dataset:{},style:{},children:[],textContent:'',selectionStart:0,selectionEnd:0,readOnly:false,disabled:false,
  classList:{toggle(){},remove(){},add(){}},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},addEventListener(k,f){(this.events??={})[k]=f},focus(){document.activeElement=this},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b},getAnimations(){return[]},animate(){},pause(){this.paused=true},play(){plays++;this.paused=false;return playResult()}});return elements.get(id)};
 const document={activeElement:null,querySelector:s=>s==='dialog[open]'?null:el(s),addEventListener(k,f){events[k]=f}};
 const q={questionKey:'q1',questionId:'1',sentence:'The site is interactive.',translation:'中文',audioUrl:'test.mp3'};
 const other={...q,questionKey:'q2',questionId:'2'};
 const PTE={active:q,questions:[q,other],notes:{},posLabels:{},states:{},phrasesOf:()=>[q.sentence],findQuestion:k=>[q,other].find(x=>x.questionKey===k),visible:()=>[q,other],phraseAudio:()=>null,render(){},setState(k,v){PTE.states[k]={...PTE.states[k],...v}},dailyStats:{complete(){completed++}},book:{skip:()=>false,miss(){},credit:()=>false,save(){}},noteFor:()=>null,ready:new Promise(()=>{})};
 const context={$,document,PTE,ACCESS:{selected:0,ready:new Promise(()=>{}),activity(){},feature(){},ensureStudy:async()=>true},window:{addEventListener(){}},localStorage:{getItem:k=>storage[k]??null,setItem(k,v){storage[k]=v}},tokens:s=>(s.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)*/g)||[]),esc:s=>String(s),matchMedia:()=>({matches:true}),setTimeout:()=>0,clearTimeout(){},Date,console,performance:{now:()=>0},requestAnimationFrame:f=>f()};function $(id){return el(id)}
 context.window=context;context.addEventListener=()=>{};
 const hooks='window.testEngine={check,state,punishment,restart,nextPunishmentAttempt,toggleAnswer,render,saveProgress,toggleLoop,handleInput,playCurrent,playChosen,maybeAutoplay,enabled:()=>punishmentEnabled};';
 const previewSource=fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/practice-preview.js'),'utf8');
 vm.runInNewContext(previewSource.slice(previewSource.indexOf('const STATE_KEY='),previewSource.indexOf('// ---------- Search')),context);
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,hooks+'})();'),context);
 const t=context.testEngine;t.render();const click=id=>el(id).events.click();
 const answer=text=>{el('typing').value=text;t.handleInput({isComposing:false});t.check(true)};
 return{t,el,click,answer,PTE,storage,completed:()=>completed,plays:()=>plays,setPlay:f=>{playResult=f}};
}
const correct='The site is interactive.';
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
async function listen(h){void h.t.playCurrent();await tick();h.el('audio').onended?.();await tick()}
function enter(h,{repeat=false}={}){h.el('typing').events.keydown({key:'Enter',code:'Enter',target:h.el('typing'),repeat,preventDefault(){}})}
function type(h,text){h.el('typing').value=text;h.t.handleInput({isComposing:false})}
(async()=>{
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
 assert.equal(h.el('typing').value,'a draft');assert.equal(h.el('reference').hidden,true,'starting to type hides the revealed answer');assert.equal(h.el('cue').textContent,'');
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
 h=setup();h.click('punishmentToggle');h.t.toggleLoop();await tick();h.click('clearRedo');await tick();assert.equal(h.el('audio').loop,false);assert.equal(h.t.punishment().listens,1);h.answer(correct);assert.equal(h.completed(),1);
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
 assert.equal(restored.PTE.roundLabel('q1'),'至少 4 轮');await listen(restored);assert.equal(restored.PTE.roundCount('q1'),4,'migration does not charge the same current round twice');
 restored.t.restart({replay:true});await tick();assert.equal(restored.PTE.roundCount('q1'),5);

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
 console.log('PASS: correct-then-Enter retries, persistent per-question round counts, no duplicate counts on replay/check/refresh, legacy migration, typing/composition auto-hide, seen-answer rules, normal mode.');
})().catch(e=>{console.error(e);process.exitCode=1});
