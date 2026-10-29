// Counts focused practice only. Listening counts; idle time without playback pauses after 60 seconds.
(()=>{
const KEY='pte-daily-practice-v1',audio=document.getElementById('audio'),dialog=document.getElementById('practiceStatsDialog');
const ledger=new PracticeDailyLog({read:()=>localStorage.getItem(KEY),write:value=>localStorage.setItem(KEY,value)});
let lastActivity=0;
const duration=ms=>{const seconds=Math.floor(ms/1000);return seconds>=3600?`${Math.floor(seconds/3600)}小时${Math.floor(seconds%3600/60)}分`:`${Math.floor(seconds/60)}分${seconds%60}秒`};
function flush(){const now=Date.now(),playing=[...document.querySelectorAll('audio')].some(a=>!a.paused&&!a.ended&&!a.error),deadline=playing?Infinity:lastActivity+60000;ledger.tick(now,{active:!!lastActivity&&document.visibilityState==='visible'&&document.hasFocus()&&!document.querySelector('dialog[open]:not(#bookDialog)')&&now<deadline,deadline});if(dialog.open)render()}
function activity(){lastActivity=Date.now();flush()}
for(const id of ['dock','list','bookDialog','wePanel','sstPanel']){const el=document.getElementById(id);for(const event of ['pointerdown','keydown','input'])el.addEventListener(event,activity,{passive:true})}
for(const player of document.querySelectorAll('audio'))for(const event of ['play','pause','ended'])player.addEventListener(event,flush);
document.addEventListener('visibilitychange',flush);window.addEventListener('blur',flush);window.addEventListener('focus',flush);window.addEventListener('pagehide',flush);window.addEventListener('storage',e=>{if(e.key===KEY){ledger.refresh();if(dialog.open)render()}});
setInterval(flush,1000);
function render(){
 const days=ledger.recent(Date.now()),today=days[0];
 document.getElementById('statsTodayDate').textContent=today.key.replaceAll('-','.');
 document.getElementById('statsTime').textContent=duration(today.milliseconds);document.getElementById('statsQuestions').textContent=today.questions+' 道';document.getElementById('statsAttempts').textContent=today.attempts+' 次';
 document.getElementById('statsDays').innerHTML=days.map((d,i)=>`<tr><th scope="row">${i===0?'今天':i===1?'昨天':d.key.slice(5).replace('-','月')+'日'}</th><td>${duration(d.milliseconds)}</td><td>${d.questions} 道</td><td>${d.attempts} 次</td></tr>`).join('');
 document.getElementById('statsStorageNote').textContent=ledger.persistent?'记录保存在当前浏览器，本机服务运行时会自动备份。也可导出进度文件，用于迁移和恢复。':'当前浏览器未允许保存数据，记录只能在本次页面打开期间保留。';
}
document.getElementById('practiceStatsOpen').addEventListener('click',()=>{flush();render();dialog.showModal()});document.getElementById('practiceStatsClose').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
PTE.dailyStats={complete:q=>{activity();ledger.complete(q.questionKey,Date.now());if(dialog.open)render()}};
})();
