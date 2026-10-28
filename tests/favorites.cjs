const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/assets/practice-preview.js'),'utf8');
function setup(storage={}){
 const elements=new Map();let selected=0,backups=0;
 const $=id=>{if(!elements.has(id))elements.set(id,{value:id==='scope'?'change':id==='filter'?'all':'',hidden:false,events:{},textContent:'',querySelectorAll:()=>[],setAttribute(k,v){this[k]=v},addEventListener(k,f){this.events[k]=f},focus(){this.focused=true}});return elements.get(id)};
 const q=[1,2,3].map(n=>({questionKey:'q'+n,sentence:'Question '+n,translation:'中文',changeHits:n===3?0:1,hasAudio:true}));
 const archived={questionKey:'old',sentence:'Archived question',changeHits:0,hasAudio:true};
 const PTE={questions:q,archivedQuestions:[archived],active:q[0],states:{},render(){},backupProgress(){backups++},book:{has:()=>false},select(){selected++}};
 const context={PTE,$,localStorage:{getItem:k=>storage[k]||null,setItem(k,v){storage[k]=v}},esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),matchScore:(q,t)=>q.sentence.toLowerCase().includes(t.toLowerCase())?1:0};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('const STATE_KEY='),source.indexOf('// ---------- Search')),context);
 vm.runInContext(source.slice(source.indexOf('const statusOk='),source.indexOf('// Optional complete bank')),context);
 vm.runInContext(source.slice(source.indexOf("$('list').addEventListener('click'"),source.indexOf("for(const id of ['search'")),context);
 return{PTE,q,archived,$,storage,context,selected:()=>selected,backups:()=>backups,keys:()=>Array.from(PTE.visible(),q=>q.questionKey)};
}
(async()=>{
 let h=setup({'pte:summary-preview:v1':JSON.stringify({q1:{practiced:true,practiceRounds:7,state:'review'}})});
 assert(!h.PTE.isFavorite('q1'));h.PTE.toggleFavorite('q1');assert(h.PTE.isFavorite('q1'));
 assert.equal(h.PTE.states.q1.practiceRounds,7);assert(h.PTE.states.q1.practiced);assert.equal(h.PTE.states.q1.state,'review');
 assert.equal(h.PTE.active.questionKey,'q1');assert.equal(h.selected(),0);assert.equal(h.backups(),1);
 let restored=setup({...h.storage});assert(restored.PTE.isFavorite('q1'),'favorites persist in the existing progress store');
 restored.PTE.setState('q1',{practiceRounds:8});assert(restored.PTE.isFavorite('q1'),'later practice updates keep favorites');
 h.PTE.toggleFavorite('q3');h.PTE.toggleFavorite('old');h.$('filter').value='favorites';
 assert.deepEqual(h.keys(),['q1','q3','old'],'favorites include questions outside weekly scope and archived questions');
 h.$('search').value='Archived';assert.deepEqual(h.keys(),['old'],'search works within favorites');h.$('search').value='';
 h.PTE.shufflePractice();const mixed=h.keys();assert.equal(new Set(mixed).size,3);assert.deepEqual([...mixed].sort(),['old','q1','q3']);
 assert.deepEqual(h.keys(),mixed,'favorite shuffle stays stable');
 h.PTE.toggleFavorite('q1');assert(!h.PTE.isFavorite('q1'));assert(!h.keys().includes('q1'));assert.equal(h.PTE.active.questionKey,'q1','removing current favorite preserves the active question');
 h.PTE.toggleFavorite('q3');h.PTE.toggleFavorite('old');assert.equal(h.keys().length,0,'empty favorites are supported');
 // Clicking or pressing a star must never trigger the row's practice action.
 h=setup();const star={dataset:{favorite:'q2'}};let stopped=false;
 h.$('list').events.click({target:{closest:s=>s==='[data-favorite]'?star:{dataset:{key:'q2'}}},stopPropagation(){stopped=true}});
 assert(stopped);assert(h.PTE.isFavorite('q2'));assert.equal(h.selected(),0);assert(h.$('filter').focused);
 h.$('list').events.keydown({key:'Enter',target:{closest:s=>s==='[data-favorite]'?star:{dataset:{key:'q2'}}},preventDefault(){throw Error('must allow native favorite button click')}});
 assert.equal(h.selected(),0);
 console.log('PASS: favorite toggle, persistence, preserve practice records, favorite-only search/scope, archived favorites, random order, star keyboard/click isolation, empty collection.');
})().catch(e=>{console.error(e);process.exitCode=1});
