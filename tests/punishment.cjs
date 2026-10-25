const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/practice-unified.js'),'utf8');
function setup(storage={}){
 const elements=new Map(),events={};let completed=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{id,hidden:id==='restore',value:'',dataset:{},style:{},children:[],textContent:'',selectionStart:0,selectionEnd:0,readOnly:false,disabled:false,
  classList:{toggle(){},remove(){},add(){}},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},addEventListener(k,f){(this.events??={})[k]=f},focus(){document.activeElement=this},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b},getAnimations(){return[]},animate(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()}});return elements.get(id)};
 const document={activeElement:null,querySelector:s=>s==='dialog[open]'?null:el(s),addEventListener(k,f){events[k]=f}};
 const q={questionKey:'q1',questionId:'1',sentence:'The site is interactive.',translation:'中文',audioUrl:'test.mp3'};
 const other={...q,questionKey:'q2',questionId:'2'};
 const PTE={active:q,questions:[q,other],notes:{},posLabels:{},states:{},phrasesOf:()=>[q.sentence],findQuestion:k=>[q,other].find(x=>x.questionKey===k),visible:()=>[q,other],phraseAudio:()=>null,render(){},setState(k,v){PTE.states[k]={...PTE.states[k],...v}},dailyStats:{complete(){completed++}},book:{skip:()=>false,miss(){},credit:()=>false,save(){}},noteFor:()=>null,ready:new Promise(()=>{})};
 const context={$,document,PTE,ACCESS:{selected:0,ready:new Promise(()=>{}),activity(){},feature(){},ensureStudy:async()=>true},window:{addEventListener(){}},localStorage:{getItem:k=>storage[k]??null,setItem(k,v){storage[k]=v}},tokens:s=>(s.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)*/g)||[]),esc:s=>String(s),matchMedia:()=>({matches:true}),setTimeout:()=>0,clearTimeout(){},Date,console,performance:{now:()=>0},requestAnimationFrame:f=>f()};function $(id){return el(id)}
 context.window=context;context.addEventListener=()=>{};
 const hooks='window.testEngine={check,state,punishment,restart,nextPunishmentAttempt,toggleAnswer,render,saveProgress,toggleLoop,handleInput,enabled:()=>punishmentEnabled};';
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,hooks+'})();'),context);
 const t=context.testEngine;t.render();const click=id=>el(id).events.click();
 const answer=text=>{el('typing').value=text;t.handleInput({isComposing:false});t.check(true)};
 return{t,el,click,answer,PTE,storage,completed:()=>completed};
}
(async()=>{
 let h=setup();h.click('punishmentToggle');assert(h.t.enabled());h.answer('wrong');assert.equal(h.t.punishment().penalty,1);assert.equal(h.t.punishment().streak,0);assert(h.el('next').disabled);assert.equal(h.completed(),0);
 h.t.check(true);assert.equal(h.t.punishment().penalty,1,'repeated Enter on unchanged wrong answer is not another attempt');
 await h.PTE.select('q2');assert.equal(h.PTE.active.questionKey,'q1','list cannot bypass wrong answer');
 h.t.toggleLoop();h.t.restart({replay:true});assert.equal(h.el('audio').loop,false);assert.equal(h.el('typing').value,'');assert.equal(h.t.punishment().penalty,1);assert(h.t.punishment().blocked);
 h.answer('The site is interactive.');assert.equal(h.t.punishment().streak,1);assert.equal(h.completed(),0);assert(h.el('typing').readOnly);
 h.t.nextPunishmentAttempt();h.answer('bad');assert.equal(h.t.punishment().penalty,2);assert.equal(h.t.punishment().streak,0);
 h.answer('The site is interactive.');assert.equal(h.t.punishment().streak,0,'fixing answer cannot count');assert(h.t.punishment().awaiting);
 h.t.nextPunishmentAttempt();h.t.toggleAnswer();h.answer('The site is interactive.');assert.equal(h.t.punishment().streak,0,'revealed answer cannot count');assert.equal(h.el('cue').textContent,'中文');
 h.t.nextPunishmentAttempt();assert(h.el('reference').hidden);assert.equal(h.el('cue').textContent,'');
 for(let i=1;i<=4;i++){h.answer('The site is interactive.');assert.equal(h.t.punishment().streak,i);if(i<4){assert.equal(h.completed(),0);h.t.nextPunishmentAttempt()}}
 assert.equal(h.completed(),1);assert.equal(h.t.punishment().penalty,0);assert(h.t.state().whole.passed);
 h.t.saveProgress();let restored=setup({...h.storage});assert(restored.t.enabled());assert(restored.t.state().whole.passed);assert.equal(restored.t.punishment().penalty,0);
 h=setup();h.answer('The site is interactive.');assert.equal(h.completed(),1,'normal mode keeps existing completion');
 h=setup();h.click('punishmentToggle');h.answer('wrong');h.t.saveProgress();restored=setup({...h.storage});assert.equal(restored.t.punishment().penalty,1);assert(restored.el('next').disabled);assert.equal(restored.el('typing').value,'wrong');
 restored.click('punishmentToggle');assert(!restored.el('next').disabled);assert.equal(restored.el('typing').readOnly,false);
 console.log('PASS: penalties, independent rounds, answer reveal, next guards, redo single playback, completion, persistence, normal mode.');
})().catch(e=>{console.error(e);process.exitCode=1});
