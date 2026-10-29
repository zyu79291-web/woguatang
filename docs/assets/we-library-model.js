(()=>{
function create(data){
 const essays=new Map(data.essays.map(e=>[e.id,e])),groups=new Map(data.groups.map(g=>[g.id,g]));
 const points=new Map();for(const e of data.essays)for(const [index,p] of e.points.entries())points.set(p.id,{essay:e,point:p,index});
 function entries(groupId){
  const rows=new Map();for(const id of groups.get(groupId)?.pointIds||[]){const found=points.get(id);if(!found)continue;
   if(!rows.has(found.essay.id))rows.set(found.essay.id,{essay:found.essay,points:[]});rows.get(found.essay.id).points.push(found);
  }return [...rows.values()].sort((a,b)=>a.essay.number-b.essay.number);
 }
 const text=e=>[String(e.number),String(e.number).padStart(2,'0'),e.title,e.titleZh,e.prompt,e.stanceZh,e.stance,...e.points.flatMap(p=>[p.title,...p.sentences,...p.groups.map(g=>groups.get(g)?.title||'')])].join(' ').toLowerCase();
 const includes=(haystack,query)=>query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(q=>haystack.includes(q));
 return {
  essay:id=>essays.get(id),group:id=>groups.get(id),entries,
  essays:query=>data.essays.filter(e=>includes(text(e),query)),
  groups:query=>data.groups.filter(g=>includes([g.title,g.description,...entries(g.id).map(r=>text(r.essay))].join(' ').toLowerCase(),query)).sort((a,b)=>entries(b.id).length-entries(a.id).length||data.groups.indexOf(a)-data.groups.indexOf(b)),
  related:(pointId,groupId)=>entries(groupId).filter(r=>r.essay.id!==points.get(pointId)?.essay.id),
  counts:{essays:essays.size,points:points.size,groups:groups.size}
 };
}
window.WELibraryModel={create};
})();
