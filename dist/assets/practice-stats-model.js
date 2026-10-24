// Daily practice ledger. Times are grouped by calendar day in Asia/Shanghai.
(()=>{
const DAY=86400000,OFFSET=8*3600000;
const dayKey=ms=>new Date(ms+OFFSET).toISOString().slice(0,10);
class DailyPracticeLog{
 constructor({read=()=>null,write=()=>{}}={}){this.read=read;this.write=write;this.data={v:1,days:{}};this.last=null;this.active=false;this.deadline=0;this.persistent=true;this.refresh()}
 refresh(){try{const d=JSON.parse(this.read()||'null');if(d?.v===1&&d.days&&typeof d.days==='object')this.data=d}catch{}}
 save(){try{this.write(JSON.stringify(this.data))}catch{this.persistent=false}}
 day(key){const d=this.data.days[key]||={milliseconds:0,questionKeys:[],attempts:0};d.milliseconds=Math.max(0,Number(d.milliseconds)||0);d.questionKeys=Array.isArray(d.questionKeys)?[...new Set(d.questionKeys.filter(x=>typeof x==='string'))]:[];d.attempts=Math.max(0,Number(d.attempts)||0);return d}
 addTime(from,to){if(to<=from)return;this.refresh();while(from<to){const end=Math.min(to,(Math.floor((from+OFFSET)/DAY)+1)*DAY-OFFSET);this.day(dayKey(from)).milliseconds+=end-from;from=end}this.save()}
 tick(now,{active=false,deadline=Infinity}={}){
  if(this.last!==null&&this.active&&now>this.last){const end=Math.min(now,this.deadline,this.last+(now-this.last>5000?2000:now-this.last));this.addTime(this.last,end)}
  this.last=now;this.active=active;this.deadline=deadline;
 }
 complete(questionKey,now){this.refresh();const d=this.day(dayKey(now));d.attempts++;if(!d.questionKeys.includes(questionKey))d.questionKeys.push(questionKey);this.save()}
 recent(now,count=7){this.refresh();return Array.from({length:count},(_,i)=>{const key=dayKey(now-i*DAY),d=this.data.days[key]||{};return {key,milliseconds:Math.max(0,Number(d.milliseconds)||0),questions:new Set(d.questionKeys||[]).size,attempts:Math.max(0,Number(d.attempts)||0)}})}
}
window.PracticeDailyLog=DailyPracticeLog;
})();
