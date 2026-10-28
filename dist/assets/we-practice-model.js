// Pure typing model, shared by the UI and regression checks.
(()=>{
const normalize=s=>String(s||'').replace(/\r\n?/g,'\n').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').replace(/ +([.,;:!?])/g,'$1').trim();
function compile(sections){
 const chars=[],prompts=[];
 for(const section of sections){
  if(chars.length)chars.push(' ');
  for(const part of section.parts){
   if(typeof part==='string'){
    for(const c of part){
     if(/\s/.test(c)){if(chars.length&&chars.at(-1)!==' ')chars.push(' ')}
     else{if(/[.,;:!?]/.test(c)&&chars.at(-1)===' '){chars.pop();for(const p of prompts)if(p.at>chars.length)p.at=chars.length}chars.push(c)}
    }
   }else prompts.push({at:chars.length,text:part.slot});
  }
 }
 while(chars.at(-1)===' ')chars.pop();
 return {text:chars.join(''),prompts};
}
const blank=()=>({text:'',elapsedMs:0,strokes:0,correctStrokes:0,completed:false});
function edit(draft,text,target){
 if(draft.completed)return;
 let start=0,end=0;const old=normalize(draft.text),next=normalize(text);
 while(start<old.length&&start<next.length&&old[start]===next[start])start++;
 while(end<old.length-start&&end<next.length-start&&old[old.length-1-end]===next[next.length-1-end])end++;
 const inserted=next.slice(start,next.length-end);
 draft.strokes+=inserted.length;
 for(let i=0;i<inserted.length;i++)if(inserted[i]===target[start+i])draft.correctStrokes++;
 draft.text=text;return next===target;
}
function metrics(draft,target){
 const text=normalize(draft.text);let correct=0;
 for(let i=0;i<text.length;i++)if(text[i]===target[i])correct++;
 return {progress:Math.min(100,Math.floor(correct/target.length*100)),accuracy:draft.strokes?Math.round(draft.correctStrokes/draft.strokes*100):100,wpm:draft.elapsedMs>0?Math.round(correct/5/(draft.elapsedMs/60000)):0,correct};
}
function tick(draft,last,now,active,deadline){
 const gap=now-last;if(active&&!draft.completed&&gap>0&&gap<=5000)draft.elapsedMs+=Math.max(0,Math.min(now,deadline)-last);
 return now;
}
function finish(state,id,target,now){
 const draft=state.units[id];if(!draft||draft.completed||normalize(draft.text)!==target)return false;
 draft.completed=true;const m=metrics(draft,target);
 state.history.unshift({id,at:now,elapsedMs:draft.elapsedMs,wpm:m.wpm,accuracy:m.accuracy});state.history=state.history.slice(0,100);return true;
}
window.WEPracticeModel={normalize,compile,blank,edit,metrics,tick,finish};
})();
