// Floating practice window: drag inside the viewport, collapse straight into the keyboard bubble, restore.
(()=>{
const dock=$('dock'),bubble=$('restore'),head=dock.querySelector('.dockhead');
const narrow=()=>matchMedia('(max-width:900px)').matches;
const motionAllowed=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
let busy=false,bubbleMoved=false;

// Mobile keyboards can shrink only visualViewport while leaving the layout viewport unchanged.
// Keep the controls in that visible region and scroll the current word inside the practice stage.
const viewport=window.visualViewport;
let viewportFrame=0,largestHeight=innerHeight,lastWidth=innerWidth;
function fitInput(){
 if(!dock.classList.contains('keyboard-open')||dock.hidden||document.activeElement!==$('typing'))return;
 const stage=dock.querySelector('.stage'),word=dock.querySelector('.word.current')||$('lineInput');
 if(!word)return;
 const box=word.getBoundingClientRect(),area=stage.getBoundingClientRect(),tools=dock.querySelector('.actions').getBoundingClientRect();
 const top=area.top+6,bottom=Math.min(area.bottom,tools.top)-6;
 if(box.bottom>bottom)stage.scrollTop+=box.bottom-bottom;
 else if(box.top<top)stage.scrollTop-=top-box.top;
}
function updateViewport(){
 viewportFrame=0;
 if(lastWidth!==innerWidth){lastWidth=innerWidth;largestHeight=innerHeight}
 largestHeight=Math.max(largestHeight,innerHeight);
 const height=viewport?.height||innerHeight,offset=viewport?.offsetTop||0;
 document.documentElement.style.setProperty('--pte-vv-height',height+'px');
 document.documentElement.style.setProperty('--pte-vv-top',offset+'px');
 const editing=document.activeElement===$('typing');
 const keyboard=narrow()&&editing&&(height<largestHeight*.78||height<420);
 dock.classList.toggle('keyboard-open',keyboard);
 if(keyboard)requestAnimationFrame(fitInput);
}
function scheduleViewport(){if(!viewportFrame)viewportFrame=requestAnimationFrame(updateViewport)}
viewport?.addEventListener('resize',scheduleViewport);
viewport?.addEventListener('scroll',scheduleViewport);
addEventListener('resize',scheduleViewport);
document.addEventListener('focusin',scheduleViewport);
document.addEventListener('focusout',scheduleViewport);
$('typing').addEventListener('input',scheduleViewport);
PTE.viewportChanged=scheduleViewport;
scheduleViewport();

// clientWidth/Height exclude the page scrollbar, so a window dragged to the edge never covers it.
function clampTo(el,left,top){const r=el.getBoundingClientRect(),{clientWidth:w,clientHeight:h}=document.documentElement;return [Math.max(8,Math.min(w-r.width-8,left)),Math.max(8,Math.min(h-r.height-8,top))]}
function place(el,left,top){[left,top]=clampTo(el,left,top);Object.assign(el.style,{left:left+'px',top:top+'px',right:'auto',bottom:'auto'})}
function unplace(el){for(const p of ['left','top','right','bottom'])el.style.removeProperty(p)}
const centerShift=(from,to)=>`translate(${to.left+to.width/2-(from.left+from.width/2)}px,${to.top+to.height/2-(from.top+from.height/2)}px) scale(${to.width/from.width})`;

// While collapsed, the reading column widens and re-centres (CSS: body.dock-collapsed). The bubble goes just
// outside that column: left of it when the window was docked left, otherwise right of it.
function placeBubble(panel){
 if(bubbleMoved)return;if(narrow()){unplace(bubble);return}
 const {clientWidth:w,clientHeight:h}=document.documentElement,contentW=Math.min(1100,w-48),left=Math.max(24,(w-contentW)/2);
 const where=dock.dataset.place,x=where==='left'?left-48-16:left+contentW+16;
 place(bubble,x,where==='top'?16:where==='bottom'?h-48-96:panel.top);
}

async function minimize(){
 if(busy||dock.hidden||!PTE.active)return;busy=true;PTE.onHide?.();
 const from=dock.getBoundingClientRect();
 document.body.classList.add('dock-collapsed');
 bubble.hidden=false;bubble.style.visibility='hidden';placeBubble(from);
 const to=bubble.getBoundingClientRect();
 if(motionAllowed()){
  const animation=dock.animate([{transform:'none',opacity:1,borderRadius:'18px'},{transform:centerShift(from,to),opacity:0,borderRadius:'50%'}],{duration:280,easing:'cubic-bezier(.4,0,.2,1)'});
  await animation.finished.catch(()=>{});animation.cancel();
 }
 dock.hidden=true;bubble.style.visibility='';
 if(motionAllowed())bubble.animate([{transform:'scale(.55)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'});
 bubble.focus({preventScroll:true});busy=false;
}
async function restore(){
 if(busy||!dock.hidden)return;busy=true;
 const from=bubble.getBoundingClientRect();bubble.hidden=true;dock.hidden=false;
 document.body.classList.remove('dock-collapsed');
 if(dock.style.left)place(dock,parseFloat(dock.style.left),parseFloat(dock.style.top));
 const to=dock.getBoundingClientRect();
 if(motionAllowed()){
  const animation=dock.animate([{transform:centerShift(to,from),opacity:0,borderRadius:'50%'},{transform:'none',opacity:1,borderRadius:'18px'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});
  await animation.finished.catch(()=>{});animation.cancel();
 }
 busy=false;PTE.onShown?.();
}

// Animate the window from its previous box to its current one (after a layout change).
async function flipFrom(from){
 if(!motionAllowed())return;const to=dock.getBoundingClientRect();
 const animation=dock.animate([{transformOrigin:'0 0',transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:.6},{transformOrigin:'0 0',transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
 await animation.finished.catch(()=>{});animation.cancel();
}

// Immersive mode reuses the same window and practice state, expanded to fill the screen.
let immersive=false;
async function setImmersive(on){
 if(busy||dock.hidden||on===immersive)return;busy=true;
 const from=dock.getBoundingClientRect();
 immersive=on;dock.classList.toggle('immersive',on);document.documentElement.classList.toggle('immersive-open',on);
 const expand=$('expand'),label=on?'退出沉浸练习':'沉浸练习';expand.setAttribute('aria-label',label);expand.title=label;
 await flipFrom(from);
 busy=false;PTE.onShown?.();
}
PTE.isImmersive=()=>immersive;

// Edge snapping (wide screens): near the top or bottom edge gives a full-width bar; the left third docks the
// window on the left (the reading column moves right); anywhere else docks it on the right.
const PLACE_KEY='pte:dock-place',PLACES=['right','left','top','bottom'];
const snapPreview=Object.assign(document.createElement('div'),{className:'snap-preview',hidden:true});document.body.append(snapPreview);
const zoneAt=(x,y)=>{const {clientWidth:w,clientHeight:h}=document.documentElement;return y<h*.2?'top':y>h*.8?'bottom':x<w*.35?'left':'right'};
function applyPlace(where){
 dock.dataset.place=where;document.body.dataset.dockPlace=where;try{localStorage.setItem(PLACE_KEY,where)}catch{}
 document.querySelectorAll('[data-snap]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.snap===where)));
}
// Docked left or right, the window keeps the height it was dropped at (--dock-y), leaving at least 300px of room.
const Y_KEY='pte:dock-y';
const clampY=y=>Math.round(Math.max(12,Math.min(document.documentElement.clientHeight-316,y)));
function setDockY(y){if(y==null)return;document.body.style.setProperty('--dock-y',clampY(y)+'px');try{localStorage.setItem(Y_KEY,String(clampY(y)))}catch{}}
async function snapTo(where,dropTop){
 snapPreview.hidden=true;const from=dock.getBoundingClientRect();
 unplace(dock);applyPlace(where);if(where==='left'||where==='right')setDockY(dropTop);if(!bubbleMoved)unplace(bubble);
 busy=true;await flipFrom(from);busy=false;
}
let initialPlace='right';try{initialPlace=localStorage.getItem(PLACE_KEY)||'right';const y=localStorage.getItem(Y_KEY);if(y)document.body.style.setProperty('--dock-y',clampY(+y)+'px')}catch{}
applyPlace(PLACES.includes(initialPlace)?initialPlace:'right');
document.querySelectorAll('[data-snap]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('.practice-more').open=false;if(!busy&&!immersive)snapTo(b.dataset.snap)}));

function draggable(el,handle,{onMove,onEnd,enabled=()=>true,ignore='button:not(.practice-bubble)'}={}){
 let drag=null,suppress=false;
 handle.addEventListener('pointerdown',e=>{if(e.button!==0||!enabled()||e.target.closest(ignore))return;const r=el.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};handle.setPointerCapture(e.pointerId)});
 handle.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;el.classList.add('dragging');place(el,drag.left+dx,drag.top+dy);onMove?.(e)});
 const finish=e=>{if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;suppress=moved;drag=null;el.classList.remove('dragging');if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);if(moved)onEnd?.(e);setTimeout(()=>{suppress=false},0)};
 handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
 handle.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation()}},true);
}
// The whole window is a drag handle except its controls and the typing area.
draggable(dock,dock,{enabled:()=>!narrow()&&!immersive&&!busy,ignore:'button,input,select,summary,details,a,.line-input,.more-menu',
 onMove:e=>{const zone=zoneAt(e.clientX,e.clientY);snapPreview.dataset.zone=zone;snapPreview.style.top=zone==='left'||zone==='right'?clampY(dock.getBoundingClientRect().top)+'px':'';snapPreview.hidden=false},
 onEnd:e=>snapTo(zoneAt(e.clientX,e.clientY),dock.getBoundingClientRect().top)});
draggable(bubble,bubble,{onMove:()=>{bubbleMoved=true}});

addEventListener('resize',()=>{
 const y=parseFloat(document.body.style.getPropertyValue('--dock-y'));if(y)document.body.style.setProperty('--dock-y',clampY(y)+'px');
 if(narrow())unplace(dock);else if(dock.style.left)place(dock,parseFloat(dock.style.left),parseFloat(dock.style.top));
 if(!bubble.hidden){if(bubble.style.left)place(bubble,parseFloat(bubble.style.left),parseFloat(bubble.style.top))}
 if(narrow()&&!bubbleMoved)unplace(bubble);
});
$('minimize').addEventListener('click',minimize);
bubble.addEventListener('click',restore);
$('expand').addEventListener('click',()=>setImmersive(!immersive));
// Esc closes the menu first, then leaves immersive mode, then collapses the window.
document.addEventListener('keydown',e=>{
 if(PTE.practiceView==='we'||PTE.practiceView==='sst'||e.key!=='Escape'||dock.hidden)return;
 const menu=document.querySelector('.practice-more[open]');
 if(menu)menu.removeAttribute('open');else if(immersive)setImmersive(false);else minimize();
});
PTE.minimize=minimize;PTE.restore=restore;PTE.setImmersive=setImmersive;PTE.snapTo=snapTo;
})();
