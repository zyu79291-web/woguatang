// The optional Chrome bridge handles global focus; ordinary practice remains browser-only.
(()=>{
 const button=document.getElementById('focusModeButton'),dialog=document.getElementById('focusSetupDialog');if(!button)return;
 let enabled=false,connected=false,busy=false,sequence=0,pending=new Map();
 function render(error=''){
  button.textContent=enabled?'结束专注':'专注模式：关';button.setAttribute('aria-pressed',String(enabled));button.disabled=busy;
  button.title=enabled?'只保留窝瓜汤、ChatGPT 和 PTE 学姐，点击恢复正常使用':'开启后只使用窝瓜汤、ChatGPT 和 PTE 学姐';
  if(error)document.getElementById('focusSetupMessage').textContent=error;
 }
 function request(action,extra={}){return new Promise((resolve,reject)=>{const requestId=++sequence,timer=setTimeout(()=>{pending.delete(requestId);reject(Error('尚未连接专注组件，请先完成安装。'))},7000);pending.set(requestId,{resolve,reject,timer});window.postMessage({source:'woguatang-focus-page',action,requestId,...extra},location.origin)})}
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.source!=='woguatang-focus-extension')return;
  const data=event.data;enabled=!!data.enabled;connected=!!data.nativeReady;render(data.error||'');
  const item=pending.get(data.requestId);if(item){pending.delete(data.requestId);clearTimeout(item.timer);data.error?item.reject(Error(data.error)):item.resolve(data)}
 });
 button.addEventListener('click',async()=>{
  busy=true;render();try{
   if(!connected)await request('status');
   if(!connected)throw Error('专注组件尚未连接，请完成安装后重试。');
   await request('setFocus',{enabled:!enabled});
  }catch(error){render(error.message);if(!dialog.open)dialog.showModal()}finally{busy=false;render()}
 });
 document.getElementById('focusSetupClose').addEventListener('click',()=>dialog.close());
 request('status').catch(()=>{});render();
})();
