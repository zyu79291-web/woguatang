(()=>{
 const outgoing=message=>window.postMessage({source:'woguatang-focus-extension',...message},location.origin);
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.source!=='woguatang-focus-page')return;
  const {action,requestId,enabled}=event.data;if(!['status','setFocus'].includes(action))return;
  chrome.runtime.sendMessage({type:action,enabled:enabled===true},result=>{
   const error=chrome.runtime.lastError;outgoing({requestId,...result,...(error?{error:'专注扩展连接已断开，请刷新页面'}:{})});
  });
 });
 chrome.runtime.onMessage.addListener(message=>{if(message.type==='focusState')outgoing(message)});
})();
