// Device-neutral merge model. Only encrypted copies of this document leave the browser.
(()=>{
const keys=['pte:summary-preview:v1','pte-wfd-wrongbook-v1','pte-daily-practice-v1','woguatang-session-v1','pte-wfd-review-session-v1'];
const canonical=x=>x&&typeof x==='object'?(Array.isArray(x)?x.map(canonical):Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]))):x;
const copy=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const fresh=()=>({v:1,registers:{},counters:{},sets:{}}),id=p=>JSON.stringify(p);
const total=c=>Math.max(0,c?.base||0)+Object.values(c?.actors||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0);
const newer=(a,b)=>(a?.clock||0)!==(b?.clock||0)?(a?.clock||0)>(b?.clock||0):String(a?.actor||'')>String(b?.actor||'');
function flatten(storage){
 const values={},counts={},sets={};
 const put=(p,v)=>{if(v!==undefined)values[id(p)]=v},count=(p,v)=>counts[id(p)]=Math.max(0,Number(v)||0),set=(p,v)=>sets[id(p)]=Array.isArray(v)?[...new Set(v)].sort():[];
 const read=k=>{try{return JSON.parse(storage[k]||'null')||{}}catch{return {}}};
 const states=read(keys[0]);for(const [q,s] of Object.entries(states)){for(const [k,v] of Object.entries(s||{})){if(k==='practiceRounds')count([keys[0],q,k],v);else put([keys[0],q,k],v)}}
 const book=read(keys[1]);for(const [word,v] of Object.entries(book.words||{}))put([keys[1],'words',word],v);
 const daily=read(keys[2]);for(const [day,d] of Object.entries(daily.days||{})){for(const k of ['milliseconds','attempts'])count([keys[2],'days',day,k],d[k]);set([keys[2],'days',day,'questionKeys'],d.questionKeys)}
 const session=read(keys[3]);
 for(const [k,v] of Object.entries(session)){
  if(k==='items'){for(const [q,e] of Object.entries(v||{}))put([keys[3],k,q],e)}
  else if(k==='wePractice'||k==='sstPractice'){
   for(const [part,value] of Object.entries(v||{})){
    if(part==='units'||part==='entries'){for(const [q,e] of Object.entries(value||{}))put([keys[3],k,part,q],e)}
    else if(part==='history'){for(const h of value||[])put([keys[3],k,'history',String(h.at)+':'+h.id],h)}
    else put([keys[3],k,part],value);
   }
  }else put([keys[3],k],v);
 }
 if(storage[keys[4]])put([keys[4]],read(keys[4]));
 return {values,counts,sets};
}
function comparable(k,v){const p=JSON.parse(k);if(p[1]==='items'&&v){const x=copy(v);delete x.elapsed;return x}return v}
function observe(storage,previous,actor,now=Date.now()){
 const doc=copy(previous||fresh()),f=flatten(storage);let clock=Math.max(now,...Object.values(doc.registers).map(x=>x.clock||0));
 const known=new Set([...Object.keys(doc.registers),...Object.keys(f.values)]);
 for(const k of known){const present=own(f.values,k),old=doc.registers[k];if(!old||old.deleted===present||!same(comparable(k,old.value),comparable(k,f.values[k]))){doc.registers[k]={clock:++clock,actor,deleted:!present,...(present?{value:f.values[k]}:{})}}}
 for(const [k,v] of Object.entries(f.counts)){const c=doc.counters[k];if(!c)doc.counters[k]={base:v,actors:{}};else if(v>total(c)){c.actors[actor]=(c.actors[actor]||0)+v-total(c)}}
 for(const [k,v] of Object.entries(f.sets))doc.sets[k]=[...new Set([...(doc.sets[k]||[]),...v])].sort();
 return doc;
}
function merge(a,b){
 const out=copy(a||fresh());b=b||fresh();
 for(const [k,v] of Object.entries(b.registers||{}))if(!out.registers[k]||newer(v,out.registers[k]))out.registers[k]=copy(v);
 for(const [k,c] of Object.entries(b.counters||{})){const x=out.counters[k]||={base:0,actors:{}};x.base=Math.max(x.base,c.base||0);for(const [actor,n] of Object.entries(c.actors||{}))x.actors[actor]=Math.max(x.actors[actor]||0,n)}
 for(const [k,v] of Object.entries(b.sets||{}))out.sets[k]=[...new Set([...(out.sets[k]||[]),...v])].sort();
 return out;
}
function materialize(doc){
 const data={};
 function put(k,value){const p=JSON.parse(k);if(!keys.includes(p[0])||p.some(k=>['__proto__','constructor','prototype'].includes(k)))return;let o=data;for(const part of p.slice(0,-1))o=o[part]||={};o[p.at(-1)]=value}
 for(const [k,r] of Object.entries(doc.registers))if(!r.deleted)put(k,copy(r.value));
 for(const [k,c] of Object.entries(doc.counters))put(k,total(c));
 for(const [k,s] of Object.entries(doc.sets))put(k,s);
 if(data[keys[1]])data[keys[1]].v=1;if(data[keys[2]])data[keys[2]].v=1;
 const history=data[keys[3]]?.wePractice?.history;if(history)data[keys[3]].wePractice.history=Object.values(history).sort((a,b)=>b.at-a.at).slice(0,100);
 return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,JSON.stringify(canonical(v))]));
}
window.WoguatangSyncModel={keys,fresh,flatten,observe,merge,materialize,same};
})();
