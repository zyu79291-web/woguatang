// The installed local service performs updates. Offline exports do not make network requests.
(()=>{
if(!['127.0.0.1','localhost'].includes(location.hostname))return;
const notice=document.getElementById('bankSyncNotice');let loaded;
try{loaded=JSON.parse(document.getElementById('questionData').textContent)}catch{return}
async function check(){try{
 const response=await fetch('/api/update-status',{cache:'no-store'});if(!response.ok)return;const status=await response.json();
 notice.hidden=false;notice.disabled=true;
 if(['checking','downloading','waiting'].includes(status.status)){notice.textContent='正在同步题库和原版音频…';return}
 if(status.status==='error'){notice.textContent='暂未联网，稍后自动重试';return}
 if(status.sourceSyncedAt!==loaded.syncedAt||status.questionCount!==loaded.questions.length){notice.textContent='题库已更新，点此刷新';notice.disabled=false;return}
 notice.textContent='今日题库已检查';
}catch{notice.hidden=true}}
notice.addEventListener('click',()=>location.reload());check();setInterval(check,60000);
})();
