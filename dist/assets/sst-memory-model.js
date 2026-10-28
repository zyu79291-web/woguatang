// SST keeps its own drafts inside the existing backed-up practice session.
(()=>{
function create(data,saved={}){
 const questions=data.questions,byId=new Map(questions.map(q=>[q.id,q]));
 const entries={};
 for(const [id,value] of Object.entries(saved?.entries||{})){
  if(!byId.has(id)||!value||typeof value!=='object')continue;
  entries[id]={draft:typeof value.draft==='string'?value.draft.slice(0,20000):'',status:['remembered','review'].includes(value.status)?value.status:'',updatedAt:typeof value.updatedAt==='string'?value.updatedAt:''};
 }
 const state={v:1,questionId:byId.has(saved?.questionId)?saved.questionId:questions[0].id,stage:[0,1,2].includes(saved?.stage)?saved.stage:1,query:typeof saved?.query==='string'?saved.query.slice(0,200):'',filter:['remembered','review'].includes(saved?.filter)?saved.filter:'all',entries};
 const record=id=>entries[id]||{draft:'',status:'',updatedAt:''};
 const normalize=s=>String(s).toLowerCase().replace(/\s+/g,' ').trim();
 function filtered(){
  const terms=normalize(state.query).split(' ').filter(Boolean);
  const numeric=/^#?\d+$/.test(state.query.trim())?state.query.trim().replace(/^#/,''):null;
  return questions.filter(q=>{
   if(state.filter!=='all'&&record(q.id).status!==state.filter)return false;
   if(numeric!==null)return q.number===Number(numeric)||q.sourceId===numeric;
   const text=normalize([q.number,q.sourceId,q.titleZh,q.title,q.cue,...q.points.flatMap(p=>[p.zh,p.en]),...(q.keywords||[]).flatMap(p=>[p.zh,p.en])].join(' '));
   return terms.every(term=>text.includes(term));
  });
 }
 function select(id){if(!byId.has(id))return false;state.questionId=id;state.stage=0;return true}
 function update(patch){entries[state.questionId]={...record(state.questionId),...patch,updatedAt:new Date().toISOString()};return entries[state.questionId]}
 function move(delta){const rows=filtered(),at=rows.findIndex(q=>q.id===state.questionId),q=rows[at+delta];return q?select(q.id):false}
 return {state,questions,question:()=>byId.get(state.questionId),record,filtered,select,update,move,wordCount:text=>(String(text).match(/\S+/g)||[]).length};
}
window.SSTMemoryModel={create};
})();
