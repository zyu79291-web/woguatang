// Browser persistence plus a second copy on this computer; no data goes to the source site.
(()=>{
const KEYS=['pte:summary-preview:v1','pte-wfd-wrongbook-v1','pte-daily-practice-v1','woguatang-session-v1','pte-wfd-review-session-v1','woguatang-progress-import-v1'];
const localServer=['localhost','127.0.0.1'].includes(location.hostname),status=document.getElementById('progressBackupStatus');let previous='',pending=false;
const snapshot=()=>{PTE.flushProgress?.();const storage={};for(const k of KEYS){const v=localStorage.getItem(k);if(v!==null)storage[k]=v}return {version:1,app:'窝瓜汤',savedAt:new Date().toISOString(),storage}};
let device;try{device=localStorage.getItem('woguatang-device-id');if(!device){device=crypto.randomUUID();localStorage.setItem('woguatang-device-id',device)}}catch{device='browser'}
function message(text){status.textContent=text}
async function save(force=false){
 if(!localServer){message('进度已保存在当前浏览器，可导出备份。');return}
 if(pending)return;let data;try{data=snapshot()}catch{message('浏览器未允许保存，请导出进度备份。');return}
 const hash=JSON.stringify(data.storage);if(!force&&hash===previous)return;pending=true;
 try{const response=await fetch('/api/progress-backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,device})});if(!response.ok)throw Error();previous=hash;message('进度已备份到本机 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))}catch{message('进度已保存在浏览器；本机备份暂不可用。')}finally{pending=false}
}
function restore(data){
 if(data.version!==1||data.app!=='窝瓜汤'||!data.storage||typeof data.storage!=='object')throw Error('请选择窝瓜汤导出的进度备份');
 const entries=Object.entries(data.storage);if(!entries.length)throw Error('备份没有练习记录');
 for(const [k,v] of entries){if(!KEYS.includes(k)||typeof v!=='string'||v.length>1500000)throw Error('备份格式不正确');if(k!=='woguatang-progress-import-v1')JSON.parse(v)}
 localStorage.setItem('woguatang-before-restore',JSON.stringify(snapshot()));
 for(const [k,v] of entries)localStorage.setItem(k,v);
 location.reload();
}
document.getElementById('exportProgress').addEventListener('click',()=>{try{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));a.href=url;a.download='窝瓜汤-练习进度-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){message(e.message)}});
document.getElementById('importProgress').addEventListener('change',async e=>{try{const file=e.target.files[0];if(file)restore(JSON.parse(await file.text()))}catch(err){message(err.message)}e.target.value=''});
document.getElementById('restoreProgress').addEventListener('click',async()=>{try{const r=await fetch('/api/progress-backup?device='+encodeURIComponent(device),{cache:'no-store'});if(!r.ok)throw Error('还没有可恢复的本机备份');restore(await r.json())}catch(e){message(e.message)}});
document.getElementById('restoreProgress').hidden=!localServer;
setInterval(()=>save(),10000);document.getElementById('practiceStatsOpen').addEventListener('click',()=>save(true));
window.addEventListener('pagehide',()=>{try{const data={...snapshot(),device};if(localServer)navigator.sendBeacon('/api/progress-backup',new Blob([JSON.stringify(data)],{type:'application/json'}))}catch{}});
window.addEventListener('woguatang-progress-saved',()=>save());
PTE.backupProgress=save;
if(localServer&&window.WOGUATANG_EMPTY_PROGRESS){fetch('/api/progress-backup',{cache:'no-store'}).then(async r=>{if(r.ok)restore(await r.json());else save(true)}).catch(()=>save(true))}else save(true);
})();
