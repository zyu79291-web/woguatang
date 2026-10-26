import {isAllowed,isPractice,RULES,HOME} from './policy.mjs';
const HOST='com.woguatang.focus',origin=chrome.runtime.getURL('/');
let port=null,enabled=false,sequence=0,nativeReady=false,lastError='',pending=new Map(),queue=Promise.resolve(),initializing;
const serial=f=>{const task=queue.then(f,f);queue=task.catch(()=>{});return task};
async function publish(){
 await chrome.storage.session.set({enabled,nativeReady,lastError});
 await chrome.action.setBadgeText({text:enabled?'开':''});await chrome.action.setBadgeBackgroundColor({color:'#655486'});
 for(const tab of await chrome.tabs.query({}))if(isPractice(tab.url))chrome.tabs.sendMessage(tab.id,{type:'focusState',enabled,nativeReady,error:lastError}).catch(()=>{});
}
async function rules(on){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:RULES.map(x=>x.id),addRules:on?RULES:[]});enabled=on;await publish()}
function nativeRequest(type,extra={}){
 return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('本机组件没有回应，请重新连接专注扩展'))},6000);pending.set(id,{resolve,reject,timer});try{port.postMessage({id,type,...extra})}catch(e){clearTimeout(timer);pending.delete(id);reject(e)}});
}
async function connect(){
 if(port&&nativeReady)return;
 port=chrome.runtime.connectNative(HOST);
 port.onMessage.addListener(message=>{
  if(message.id&&pending.has(message.id)){const item=pending.get(message.id);pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(message.error)):item.resolve(message);return}
  if(message.type==='state'&&message.enabled!==enabled)void serial(async()=>{lastError=message.reason||'';await rules(!!message.enabled)});
 });
 port.onDisconnect.addListener(()=>{
  const detail=chrome.runtime.lastError?.message||'本机组件已断开，专注已自动结束';port=null;nativeReady=false;lastError=detail;
  for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error(detail))}pending.clear();void serial(()=>rules(false));
 });
 const reply=await nativeRequest('status');nativeReady=true;lastError='';if(reply.enabled!==enabled)await rules(!!reply.enabled);else await publish();
}
async function guardTab(id){
 if(!enabled)return;let tab;try{tab=await chrome.tabs.get(id)}catch{return}
 if(!tab.active||isAllowed(tab.url||tab.pendingUrl,origin))return;
 // Keep other open tabs intact, including unsaved forms. Move focus to an allowed tab instead.
 const tabs=await chrome.tabs.query({windowId:tab.windowId});const allowed=tabs.find(t=>isPractice(t.url))||tabs.find(t=>isAllowed(t.url,origin));
 if(allowed)await chrome.tabs.update(allowed.id,{active:true});else await chrome.tabs.create({windowId:tab.windowId,url:chrome.runtime.getURL('focus.html'),active:true});
}
async function setFocus(on){
 await connect();
 if(on){
  await rules(true);
  try{await nativeRequest('set',{enabled:true})}catch(e){await rules(false);throw e}
  for(const tab of await chrome.tabs.query({active:true}))await guardTab(tab.id);
 }else{await rules(false);await nativeRequest('set',{enabled:false})}
 lastError='';await publish();return{enabled,nativeReady};
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||sender.tab&&!isPractice(sender.tab.url))return false;
 if(!['status','setFocus'].includes(message.type))return false;
 void serial(async()=>{
  try{await initializing;if(message.type==='setFocus')reply(await setFocus(message.enabled===true));else{await connect();reply({enabled,nativeReady,error:lastError})}}
  catch(e){lastError=e.message;await publish();reply({enabled,nativeReady,error:e.message})}
 });return true;
});
chrome.tabs.onActivated.addListener(({tabId})=>{void guardTab(tabId)});
chrome.tabs.onUpdated.addListener((id,changes,tab)=>{if(enabled&&tab.active&&(changes.url||changes.status==='complete'))void guardTab(id)});
chrome.windows.onFocusChanged.addListener(id=>{if(enabled&&id!==chrome.windows.WINDOW_ID_NONE)chrome.tabs.query({active:true,windowId:id}).then(t=>t[0]&&guardTab(t[0].id))});
// Session-only blocking expires on Chrome restart, even if this host is unavailable.
initializing=(async()=>{await rules(false);try{await connect()}catch(e){lastError=e.message;await publish()}})();
