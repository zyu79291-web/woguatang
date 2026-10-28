(()=>{
const M=window.WEPracticeModel,sections=window.WE_TEMPLATE,$we=id=>document.getElementById(id);
const saved=PTE.wePracticeState||{};
const state=PTE.wePracticeState={v:1,library:saved.library&&typeof saved.library==='object'?saved.library:{},view:saved.view==='we'?'we':'wfd',unit:sections.some(s=>s.id===saved.unit)?saved.unit:saved.unit==='all'?'all':'intro',mode:saved.mode==='memory'?'memory':'copy',units:saved.units&&typeof saved.units==='object'?saved.units:{},history:Array.isArray(saved.history)?saved.history.slice(0,100):[]};
const editor=$we('weEditor'),reference=$we('weReference');let lastTick=Date.now(),lastEdit=0,visible=false,peek=false,composing=false,lastSave=0,wasImmersive=false;
const group=()=>state.unit==='all'?sections:sections.filter(s=>s.id===state.unit);
const compiled=()=>M.compile(group());
function draft(){const d=state.units[state.unit];if(!d||typeof d.text!=='string'){state.units[state.unit]=M.blank()}const result=state.units[state.unit];for(const k of ['elapsedMs','strokes','correctStrokes'])if(!Number.isFinite(result[k])||result[k]<0)result[k]=0;return result}
const duration=ms=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
function save(){PTE.flushProgress?.();lastSave=Date.now();$we('weSaved').textContent='草稿已保存'}
function tick(active){const now=Date.now();lastTick=M.tick(draft(),lastTick,now,active??(visible&&document.visibilityState==='visible'&&document.hasFocus()&&document.activeElement===editor&&!!lastEdit),lastEdit+60000)}
function paintReference(){
 reference.replaceChildren();const value=M.normalize(draft().text);let offset=0;
 for(const section of group()){
  const p=document.createElement('p'),c=M.compile([section]);
  const addPrompts=i=>{for(const prompt of c.prompts.filter(x=>x.at===i)){const pill=document.createElement('span');pill.className='we-slot';pill.textContent=prompt.text;p.append(pill)}};
  for(let i=0;i<c.text.length;i++){addPrompts(i);const span=document.createElement('span'),index=offset+i;span.className='we-char'+(index<value.length?(value[index]===c.text[i]?' correct':' incorrect'):index===value.length?' current':'');span.textContent=c.text[i];p.append(span)}
  addPrompts(c.text.length);reference.append(p);offset+=c.text.length+1;
 }
 reference.hidden=state.mode==='memory'&&!peek;$we('weHiddenReference').hidden=!reference.hidden;
 $we('wePeek').textContent='看一下模板';$we('weGuidance').textContent=state.mode==='memory'?'凭记忆输入英文固定句；查看后，开始打字会自动收起。':'只练英文固定句，跳过中文填空提示，标点照打。';
}
function paintStats(){
 const d=draft(),m=M.metrics(d,compiled().text);
 $we('weTime').textContent=duration(d.elapsedMs);$we('weSpeed').textContent=d.elapsedMs>=1000?(m.wpm||'—'):'—';$we('weAccuracy').textContent=d.strokes?m.accuracy+'%':'—';$we('weProgressValue').textContent=m.progress+'%';$we('weProgressBar').style.width=m.progress+'%';
 const feedback=$we('weFeedback');feedback.textContent=d.completed?'完成了！成绩已保存，休息一下再练。':d.text?'可以随时修改，全部输入正确后自动完成。':'输入第一个字母开始计时';feedback.classList.toggle('done',!!d.completed);
 editor.readOnly=!!d.completed;$we('weRestart').textContent=d.completed?'再练一遍':'重新练习';
}
function paintHistory(){
 const history=state.history.filter(h=>h.id===state.unit),best=history.length?Math.max(...history.map(h=>h.wpm||0)):0;
 $we('weHistorySummary').textContent=history.length?`已完成 ${history.length} 次 · 最快 ${best} WPM`:'完成后会保存在这里';
 const list=$we('weHistoryList');list.replaceChildren();
 if(!history.length){const li=document.createElement('li');li.className='we-empty';li.textContent='还没有完成记录，先练一遍试试。';list.append(li);return}
 for(const h of history.slice(0,5)){const li=document.createElement('li'),date=document.createElement('span'),result=document.createElement('strong');date.textContent=new Date(h.at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});result.textContent=`${duration(h.elapsedMs)} · ${h.wpm} WPM · ${h.accuracy}% 准确率`;li.append(date,result);list.append(li)}
}
function paint(){
 editor.value=draft().text;$we('weUnitTitle').textContent=state.unit==='all'?'全篇连打':group()[0].title;
 for(const b of document.querySelectorAll('[data-we-unit]'))b.setAttribute('aria-pressed',String(b.dataset.weUnit===state.unit));
 for(const b of document.querySelectorAll('[data-we-mode]'))b.setAttribute('aria-pressed',String(b.dataset.weMode===state.mode));
 paintReference();paintStats();paintHistory();
}
async function switchView(view,{focus=true}={}){
 tick();lastEdit=0;lastTick=Date.now();
 if(view==='we'){
  wasImmersive=PTE.isImmersive?.()||false;if(wasImmersive)await PTE.setImmersive(false);PTE.onHide?.();
 }
 visible=view==='we';state.view=view;PTE.practiceView=view;
 document.body.classList.toggle('practice-we',visible);$we('wePanel').hidden=!visible;$we('wfdPanel').hidden=visible;
 for(const [id,on] of [['weTab',visible],['wfdTab',!visible]]){$we(id).classList.toggle('active',on);$we(id).setAttribute('aria-selected',String(on))}
 save();if(visible){paint();if(focus){if(PTE.weLibrary?.isOpen())PTE.weLibrary.focus();else editor.focus({preventScroll:true})}}else if(focus){if(wasImmersive)await PTE.setImmersive(true);PTE.onShown?.()}
}
$we('weTab').addEventListener('click',()=>switchView('we'));$we('wfdTab').addEventListener('click',()=>switchView('wfd'));
$we('weFromDock').addEventListener('click',()=>switchView('we'));
for(const b of document.querySelectorAll('[data-we-unit]'))b.addEventListener('click',()=>{tick();state.unit=b.dataset.weUnit;peek=false;lastEdit=0;lastTick=Date.now();paint();save();editor.focus({preventScroll:true})});
for(const b of document.querySelectorAll('[data-we-mode]'))b.addEventListener('click',()=>{tick();state.mode=b.dataset.weMode;peek=false;paint();save();editor.focus({preventScroll:true})});
$we('wePeek').addEventListener('click',()=>{peek=true;paintReference();editor.focus({preventScroll:true})});
editor.addEventListener('compositionstart',()=>{composing=true});editor.addEventListener('compositionend',()=>{composing=false;onInput()});
function onInput(){
 if(composing)return;tick();const d=draft(),target=compiled().text;lastEdit=Date.now();
 M.edit(d,editor.value,target);if(state.mode==='memory')peek=false;
 if(M.finish(state,state.unit,target,Date.now())){lastEdit=0;PTE.backupProgress?.();paintHistory()}
 paintReference();paintStats();save();
}
editor.addEventListener('input',onInput);editor.addEventListener('blur',()=>{tick(true);lastEdit=0;save()});editor.addEventListener('focus',()=>{lastTick=Date.now()});
$we('weRestart').addEventListener('click',()=>{tick();state.units[state.unit]=M.blank();lastEdit=0;peek=false;lastTick=Date.now();paint();save();editor.focus({preventScroll:true})});
window.addEventListener('blur',()=>{tick(true);lastEdit=0;save()});document.addEventListener('visibilitychange',()=>{tick();if(document.visibilityState!=='visible')lastEdit=0;save()});window.addEventListener('pagehide',()=>{tick();save()});
setInterval(()=>{tick();if(visible){paintStats();if(lastEdit&&Date.now()-lastSave>=5000)save()}},1000);
paint();const linked=new URLSearchParams(location.search).has('t');void switchView(linked?'wfd':state.view,{focus:false});
})();
