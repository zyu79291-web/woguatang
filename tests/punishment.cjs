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
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,hooks+'})();'),context);
 const t=context.testEngine;t.render();const click=id=>el(id).events.click();
 const answer=text=>{el('typing').value=text;t.handleInput({isComposing:false});t.check(true)};
 return{t,el,click,answer,PTE,storage,completed:()=>completed,plays:()=>plays,setPlay:f=>{playResult=f}};
}
const correct='The site is interactive.';
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve()};
async function listen(h){void h.t.playCurrent();await tick();h.el('audio').onended?.();await tick()}
function enter(h,{repeat=false}={}){h.el('typing').events.keydown({key:'Enter',code:'Enter',target:h.el('typing'),repeat,preventDefault(){}})}
(async()=>{
 let h=setup();h.click('punishmentToggle');await listen(h);h.answer(correct);
 assert.equal(h.completed(),1,'one listen and first correct submission passes');
 h.t.check(true);assert.equal(h.completed(),1,'completion counted once');
 h.t.saveProgress();let restored=setup({...h.storage});assert(restored.t.enabled());assert(restored.t.state().whole.passed);

 h=setup();h.click('punishmentToggle');await listen(h);h.answer('wrong');await tick();
 assert.equal(h.completed(),0);assert.equal(h.el('typing').value,'','wrong first submission automatically clears the line');
 assert.equal(h.t.punishment().round,2);assert.equal(h.t.punishment().listens,1,'new round replays exactly once');
 assert.equal(h.t.punishment().submissions,0);assert.equal(h.t.punishment().misses,1);assert(h.el('next').disabled);
 assert.equal(h.plays(),2);assert.equal(h.el('typing').readOnly,false);
 enter(h,{repeat:true});await tick();assert.equal(h.t.punishment().round,2,'holding Enter cannot restart repeatedly');assert.equal(h.plays(),2);
 enter(h);await tick();assert.equal(h.t.punishment().round,2,'empty fresh round does not restart on Enter');
 await h.PTE.select('q2');assert.equal(h.PTE.active.questionKey,'q1','unsuccessful question remains guarded');
 h.answer(correct);assert.equal(h.completed(),1,'next clean round passes without extra repetitions');

 h=setup();h.click('punishmentToggle');await listen(h);await listen(h);
 assert.equal(h.t.punishment().listens,2);enter(h);await tick();
 assert.equal(h.t.punishment().round,2,'Enter on a replayed empty round starts over');
 assert.equal(h.t.punishment().listens,1);assert.equal(h.completed(),0);h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');h.t.toggleLoop();await tick();
 assert(h.t.punishment().reason.includes('循环'));assert.equal(h.t.punishment().listens,1);
 enter(h);await tick();assert.equal(h.el('audio').loop,false,'Enter stops looping');
 assert.equal(h.t.punishment().listens,1);assert.equal(h.t.punishment().reason,'');assert.equal(h.plays(),2);
 h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');await listen(h);h.t.toggleAnswer();
 assert.equal(h.el('cue').textContent,'中文');h.el('typing').value='a draft';h.t.handleInput({isComposing:false});
 enter(h);await tick();assert.equal(h.el('typing').value,'');assert(h.el('reference').hidden);assert.equal(h.el('cue').textContent,'');
 assert.equal(h.t.punishment().round,2);assert.equal(h.t.punishment().listens,1);assert.equal(h.completed(),0);
 h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');await listen(h);h.t.toggleAnswer();h.t.toggleAnswer();h.answer(correct);await tick();
 assert.equal(h.completed(),0,'hiding an answer cannot restore eligibility');assert.equal(h.t.punishment().round,2);

 h=setup();h.click('punishmentToggle');h.answer(correct);await tick();
 assert.equal(h.completed(),0,'typing from memory without a listen cannot pass');
 assert.equal(h.t.punishment().round,2);assert.equal(h.t.punishment().listens,1);h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');h.setPlay(()=>Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'})));
 await listen(h);assert.equal(h.t.punishment().listens,0,'blocked audio consumes no listen');
 h.setPlay(()=>Promise.resolve());await listen(h);h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');let resolveOld;
 h.setPlay(()=>new Promise(resolve=>{resolveOld=resolve}));void h.t.playCurrent();h.t.restart();h.setPlay(()=>Promise.resolve());resolveOld();await tick();
 assert.equal(h.t.punishment().listens,0,'stale cancelled playback cannot charge a new round');await listen(h);h.answer(correct);assert.equal(h.completed(),1);

 h=setup();h.click('punishmentToggle');await listen(h);await listen(h);
 h.el('typing').value='my existing draft';h.t.handleInput({isComposing:false});h.t.saveProgress();
 restored=setup({...h.storage});assert.equal(restored.el('typing').value,'my existing draft');assert(restored.el('next').disabled);
 enter(restored);await tick();assert.equal(restored.el('typing').value,'');assert.equal(restored.t.punishment().listens,1);
 restored.answer(correct);assert.equal(restored.completed(),1,'failed persisted round restarts on Enter');
 h=setup();h.click('punishmentToggle');await listen(h);h.t.saveProgress();restored=setup({...h.storage});
 restored.t.maybeAutoplay();await tick();assert.equal(restored.plays(),0,'refresh does not replay an already-heard round');
 restored.answer(correct);assert.equal(restored.completed(),1,'eligible round survives refresh');

 const legacy=JSON.parse(h.storage['woguatang-session-v1']);legacy.items.q1.st.whole.text='my existing draft';
 legacy.items.q1.st.punishment={streak:1,penalty:3,misses:2,awaiting:false,blocked:true};
 restored=setup({'woguatang-session-v1':JSON.stringify(legacy),'unrelated-practice-records':'KEEP'});
 assert.equal(restored.el('typing').value,'my existing draft');assert.equal(restored.t.punishment().misses,2);
 assert(restored.t.punishment().reason.includes('旧规则'));assert.equal(restored.storage['unrelated-practice-records'],'KEEP');
 restored.click('punishmentToggle');assert(!restored.el('next').disabled);assert.equal(restored.el('typing').readOnly,false);

 h=setup();h.click('punishmentToggle');await h.PTE.select('q2',{play:true});await tick();assert.equal(h.t.punishment().listens,1);
 h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.click('punishmentToggle');await listen(h);void h.PTE.playSentence(h.PTE.active);await tick();h.answer(correct);await tick();
 assert.equal(h.completed(),0,'same audio from wrong-word review also counts as replay');assert.equal(h.t.punishment().round,2);
 h=setup();h.click('punishmentToggle');h.t.toggleLoop();await tick();h.click('clearRedo');await tick();
 assert.equal(h.el('audio').loop,false);assert.equal(h.t.punishment().listens,1);h.answer(correct);assert.equal(h.completed(),1);
 h=setup();h.answer(correct);assert.equal(h.completed(),1,'normal mode unchanged');
 console.log('PASS: automatic retry on wrong Enter, disqualified-round Enter, repeat-key guard, one original playback, hidden answers, progress persistence, clean completion, normal mode.');
})().catch(e=>{console.error(e);process.exitCode=1});
