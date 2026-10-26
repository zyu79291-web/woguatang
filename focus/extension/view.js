let enabled=false;const button=document.getElementById('toggle'),status=document.getElementById('status');
function render(state){enabled=!!state.enabled;button.disabled=!state.nativeReady;button.textContent=enabled?'结束专注':'开启专注';status.textContent=state.error?'本机组件未连接：'+state.error:enabled?'专注已开启，随时可以结束。':'专注已关闭，正常使用电脑。'}
chrome.runtime.sendMessage({type:'status'},state=>render(state||{error:chrome.runtime.lastError?.message||'扩展连接失败'}));
button.addEventListener('click',()=>{button.disabled=true;chrome.runtime.sendMessage({type:'setFocus',enabled:!enabled},state=>render(state||{error:'连接失败'}))});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session')chrome.storage.session.get(['enabled','nativeReady','lastError']).then(s=>render({...s,error:s.lastError}))});
