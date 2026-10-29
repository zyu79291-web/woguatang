// Pairing keys stay on the device. Server receives an account ID, a separate capability,
// and AES-GCM ciphertext; the encryption key is never transmitted.
(()=>{
if(location.protocol==='file:')return;
const M=window.WoguatangSyncModel,CONFIG='woguatang-cloud-config-v1',META='woguatang-cloud-document-v1',PENDING='woguatang-cloud-pending-v1',BACKUPS='woguatang-cloud-recovery-v1';
const api=location.port==='8899'?'http://127.0.0.1:8898':'https://woguatang-sync.zyu79291.chatgpt.site';
const parse=(s,fallback)=>{try{return JSON.parse(s)||fallback}catch{return fallback}};
// A reload applies after existing modules have flushed their old in-memory state.
try{const p=parse(sessionStorage.getItem(PENDING),null);if(p){for(const [k,v] of Object.entries(p.storage))if(M.keys.includes(k))localStorage.setItem(k,v);localStorage.setItem(META,JSON.stringify(p.doc));sessionStorage.removeItem(PENDING)}}catch{}
let config=parse(localStorage.getItem(CONFIG),null),doc=parse(localStorage.getItem(META),M.fresh()),actor=localStorage.getItem('woguatang-cloud-actor'),pending=null,busy=false,staging=false,lastInput=0,lastAction=0,button,status,dialog,details,keyInput,note;
if(!actor){actor=crypto.randomUUID();localStorage.setItem('woguatang-cloud-actor',actor)}
const read=()=>Object.fromEntries(M.keys.map(k=>[k,localStorage.getItem(k)]).filter(([,v])=>v!==null));
const b64=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
async function credentials(code){
 const match=String(code).trim().match(/^WGT1\.([A-Za-z0-9_-]{32})\.([a-f0-9]{8})$/);if(!match||hex(await digest('check:'+match[1])).slice(0,8)!==match[2])throw Error('配对码不完整或有输错，请重新复制。');
 const secret=match[1];return {id:hex(await digest('account:'+secret)),auth:hex(await digest('auth:'+secret)),key:await crypto.subtle.importKey('raw',await digest('encryption:'+secret),'AES-GCM',false,['encrypt','decrypt'])};
}
async function encrypt(value,c){const iv=crypto.getRandomValues(new Uint8Array(12));return 'v1.'+b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(c.id)},c.key,new TextEncoder().encode(JSON.stringify(value)))))}
async function decrypt(value,c){const parts=String(value).split('.');if(parts.length!==3||parts[0]!=='v1')throw Error('云端备份格式不正确。');let data;try{data=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(parts[1]),additionalData:new TextEncoder().encode(c.id)},c.key,bytes(parts[2]))))}catch{throw Error('无法解密，请确认两台设备使用同一个配对码。')}
 if(data?.v!==1||!data.registers||!data.counters||!data.sets)throw Error('云端进度格式不正确。');return data;
}
function saveConfig(){localStorage.setItem(CONFIG,JSON.stringify(config))}
function observe(){window.PTE?.flushProgress?.();doc=M.observe(read(),doc,actor);localStorage.setItem(META,JSON.stringify(doc));return doc}
// PTE is a global lexical binding rather than a window property.
function flush(){try{if(typeof PTE!=='undefined')PTE.flushProgress?.()}catch{}}
function ownDocument(){flush();return observe()}
function equivalent(a,b){const x=M.flatten(a),y=M.flatten(b);for(const f of [x,y])for(const [k,v] of Object.entries(f.values)){if(JSON.parse(k)[1]==='items'&&v)delete v.elapsed}return M.same(x,y)}
function backup(storage){const list=parse(localStorage.getItem(BACKUPS),[]);if(!list.length||!M.same(list[0].storage,storage)){list.unshift({at:new Date().toISOString(),storage});localStorage.setItem(BACKUPS,JSON.stringify(list.slice(0,5)))}}
function message(text){if(status)status.textContent=text;if(button)button.textContent=!config?.enabled?'云同步':busy?'正在同步…':text.startsWith('已同步')?'云同步 ✓':'云同步 · '+(pending?'待接续':'待同步')}
function render(){if(!dialog)return;details.hidden=!config;document.getElementById('cloudStart').hidden=!!config;document.getElementById('cloudPause').hidden=!config;document.getElementById('cloudPause').textContent=config?.enabled?'暂停同步':'恢复同步';document.getElementById('cloudPairCode').value=config?.code||'';document.getElementById('cloudRecovery').hidden=!localStorage.getItem(BACKUPS);if(!config?.enabled)message(config?'同步已暂停，本机记录照常保存。':'开启后，用同一个配对码连接电脑和 iPad。')}
async function request(method,c,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);const r=await fetch(api+'/api/sync/'+c.id,{method,headers:{Authorization:'Bearer '+c.auth,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:controller.signal}).finally(()=>clearTimeout(timer));return {r,data:await r.json()}}
function stage(){
 if(!pending||staging||busy||!config?.enabled)return;
 if(!document.hidden&&(Date.now()-lastInput<15000||Date.now()-lastAction<1500||Array.from(document.querySelectorAll('audio')).some(a=>!a.paused)))return;
 const merged=M.merge(ownDocument(),pending),storage=M.materialize(merged);
 if(equivalent(read(),storage)){pending=null;return}
 backup(read());staging=true;sessionStorage.setItem(PENDING,JSON.stringify({doc:merged,storage}));location.reload();
}
async function sync({explicit=false}={}){
 if(!config?.enabled||busy||staging)return;let succeeded=false;busy=true;message('正在同步，进度仍保存在本机。');
 try{
  const c=await credentials(config.code);
  for(let attempt=0;attempt<3;attempt++){
   ownDocument();const pulled=await request('GET',c);
   if(pulled.r.status!==404&&!pulled.r.ok)throw Error('云端暂时无法连接，稍后自动重试。');
   if(pulled.r.status===404&&!config.create)throw Error('没有找到这个配对码的进度，请先在原设备完成一次同步。');
   const remote=pulled.r.ok?await decrypt(pulled.data.payload,c):M.fresh();
   const merged=M.merge(ownDocument(),remote);
   const revision=pulled.r.ok?pulled.data.revision:0;
   if(!M.same(merged,remote)){
    const saved=await request('PUT',c,{revision,payload:await encrypt(merged,c)});
    if(saved.r.status===409)continue;
    if(!saved.r.ok)throw Error(saved.r.status===413?'进度超过云端容量，请先导出备份。':'云端暂时无法保存，稍后自动重试。');
   }
   succeeded=true;config.create=false;config.lastSynced=new Date().toISOString();saveConfig();
   if(!equivalent(read(),M.materialize(merged)))pending=merged;
   else{doc=merged;localStorage.setItem(META,JSON.stringify(doc));pending=null}
   message('已同步 · '+new Date(config.lastSynced).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+(pending?' · 停止输入后自动接续':''));return;
  }
  throw Error('另一台设备正在保存，稍后自动重试。');
 }catch(e){message(['TimeoutError','TypeError','AbortError','SyntaxError'].includes(e.name)?'暂时离线，联网后自动同步。':e.message)}
 finally{busy=false;render();if(!succeeded&&status)message(status.textContent);if(succeeded&&config?.enabled&&config.lastSynced&&!pending)message('已同步 · '+new Date(config.lastSynced).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));if(pending)stage()}
}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function mount(){
 const style=document.createElement('style');style.textContent='.cloud-dialog{width:min(510px,calc(100vw - 32px));border:1px solid #dfd6eb;border-radius:18px;padding:28px;color:#51435e;background:#fff;box-shadow:0 24px 80px #30274130}.cloud-dialog::backdrop{background:#20152b70}.cloud-dialog h2{font-size:23px;margin:0 0 12px}.cloud-dialog p{font-size:15px;line-height:1.8;margin:10px 0;color:#887394}.cloud-dialog label{display:block;margin:22px 0 8px;font-size:15px}.cloud-dialog input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dcd1e8;border-radius:9px;font:14px/1.5 ui-monospace,monospace;color:#655279}.cloud-dialog button{border:1px solid #ddd0e9;border-radius:9px;background:#f1ebf8;color:#70558b;padding:10px 15px;font-size:15px}.cloud-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.cloud-status{display:block;font-size:14px;line-height:1.7;margin:15px 0;color:#8a709e}.cloud-dialog summary{margin-top:20px;font-size:14px;color:#947fa4;cursor:pointer}.cloud-dialog .cloud-close{position:absolute;right:12px;top:10px;border:0;background:none;padding:4px;font-size:24px}';document.head.append(style);
 button=document.createElement('button');button.type='button';button.className='stats-open';button.id='cloudSyncButton';button.textContent='云同步';document.querySelector('.hero-tools')?.prepend(button);
 dialog=document.createElement('dialog');dialog.className='cloud-dialog';dialog.setAttribute('aria-labelledby','cloudTitle');dialog.innerHTML='<button type="button" class="cloud-close" aria-label="关闭云同步">×</button><h2 id="cloudTitle">电脑 · iPad 进度同步</h2><p>不用注册。两台设备使用同一个配对码，自动同步练习记录、收藏和草稿。</p><output class="cloud-status" id="cloudStatus" aria-live="polite"></output><button type="button" id="cloudStart">开启云同步</button><div id="cloudDetails" hidden><label for="cloudPairCode">在另一台设备输入这个配对码</label><input id="cloudPairCode" readonly autocomplete="off" spellcheck="false"><div class="cloud-actions"><button type="button" id="cloudCopy">复制配对码</button><button type="button" id="cloudNow">立即同步</button><button type="button" id="cloudPause">暂停同步</button></div><p>配对码能读取你的加密进度，请自己保管，不要公开分享。服务器无法帮你找回配对码。</p></div><details id="cloudJoin"><summary>已有配对码？连接另一台设备</summary><label for="cloudJoinCode">配对码</label><input id="cloudJoinCode" placeholder="WGT1.…" autocomplete="off" spellcheck="false" autocapitalize="off"><div class="cloud-actions"><button type="button" id="cloudConnect">连接并合并进度</button></div></details><button type="button" id="cloudRecovery" style="margin-top:18px" hidden>导出合并前备份</button>';
 document.body.append(dialog);status=document.getElementById('cloudStatus');details=document.getElementById('cloudDetails');keyInput=document.getElementById('cloudJoinCode');
 button.addEventListener('click',()=>{render();dialog.showModal()});dialog.querySelector('.cloud-close').addEventListener('click',()=>dialog.close());
 document.getElementById('cloudStart').addEventListener('click',async()=>{try{const secret=b64(crypto.getRandomValues(new Uint8Array(24))),code='WGT1.'+secret+'.'+hex(await digest('check:'+secret)).slice(0,8);config={code,enabled:true,create:true};doc=M.fresh();saveConfig();render();await sync({explicit:true})}catch(e){message(e.message)}});
 document.getElementById('cloudConnect').addEventListener('click',async()=>{
  const code=keyInput.value.trim();try{const c=await credentials(code),r=await request('GET',c);if(!r.r.ok)throw Error('未找到进度或暂时无法连接，请检查配对码。');const remote=await decrypt(r.data.payload,c);const local=read(),flat=M.flatten(local),meaningful=Object.values(flat.counts).some(v=>v>0)||Object.entries(flat.values).some(([k,v])=>{const path=JSON.parse(k);return path[0]===M.keys[0]||path[0]===M.keys[1]||path.includes('entries')&&v?.draft||path.includes('units')&&v?.text});backup(local);config={code,enabled:true,create:false};saveConfig();if(!meaningful){pending=null;staging=true;sessionStorage.setItem(PENDING,JSON.stringify({doc:remote,storage:M.materialize(remote)}));location.reload();return}doc=M.observe(local,M.fresh(),actor);pending=remote;render();dialog.close();lastInput=0;lastAction=0;await sync({explicit:true})}catch(e){message(e.message)}
 });
 document.getElementById('cloudCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(config.code);message('配对码已复制，在 iPad 的云同步里粘贴即可。')}catch{const field=document.getElementById('cloudPairCode');field.focus();field.select();message('请复制选中的配对码。')}});
 document.getElementById('cloudNow').addEventListener('click',()=>sync({explicit:true}));
 document.getElementById('cloudPause').addEventListener('click',()=>{config.enabled=!config.enabled;saveConfig();render();if(config.enabled)sync()});
 document.getElementById('cloudRecovery').addEventListener('click',()=>{const saved=parse(localStorage.getItem(BACKUPS),[])[0];if(saved)download({version:1,app:'窝瓜汤',savedAt:saved.at,storage:saved.storage},'窝瓜汤-云同步合并前备份.json')});
 render();if(config?.enabled)sync();
}
document.addEventListener('input',()=>{lastInput=Date.now()},{capture:true});document.addEventListener('pointerdown',()=>{lastAction=Date.now()},{capture:true});
window.addEventListener('online',()=>sync());window.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>sync());
window.addEventListener('pagehide',()=>{if(staging&&pending){const merged=M.merge(ownDocument(),pending);sessionStorage.setItem(PENDING,JSON.stringify({doc:merged,storage:M.materialize(merged)}))}});
setInterval(()=>{if(config?.enabled&&!document.hidden)sync()},15000);setInterval(stage,1000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
