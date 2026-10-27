// WFD summary preview: lesson data, question list and per-tab practice status.
// Local preview only. Content matches stable question identities; no account or Feishu writes.
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokens=s=>String(s??'').toLowerCase().replace(/[‘’]/g,"'").match(/[a-z0-9]+(?:'[a-z0-9]+)*/g)||[];

const PTE={questions:[],active:null,states:{}};

PTE.lessons={};
PTE.chinese={};
// Phrase audio: user-approved separately generated voice first, then original-sentence slices.
// Windows offline speech files in /memory-preview are deliberately not used.
// Only questions whose meaning groups did not change in lessons v2 (2026-10-10); #1028 and 8 slices were cut for v1 groups.
PTE.approvedVoiceIds=new Set([]);
PTE.sliceIds=new Set(['653','1073','673','2108','478','1417','572','701']);

PTE.phrasesOf=q=>{const p=PTE.lessons[q.questionId];return p&&tokens(p.join(' ')).join(' ')===tokens(q.sentence).join(' ')?p:[q.sentence]};
PTE.phraseChinese=(q,step)=>PTE.phrasesOf(q).length>1&&PTE.chinese[q.questionId]?.[step]||q.translation;
// The authenticated study response supplies audio IDs and their exact recorded parts.
// A recording from an older split must never play under current text.
PTE.phraseAudioMap={};PTE.phraseAudioParts={};
PTE.phraseAudio=(q,step)=>{
 const id=q.questionId,parts=PTE.phrasesOf(q);

 const listed=PTE.phraseAudioMap[id],made=PTE.phraseAudioParts[id];
 if(listed?.length===parts.length&&made?.join('|')===parts.join('|'))return listed[step]||null;

 return PTE.phrasesOf(q).length===1?q.audioUrl||null:null;
};

// Practice status stays on this device (survives reloads and new tabs); never sent anywhere.
const STATE_KEY='pte:summary-preview:v1';
try{PTE.states=JSON.parse(localStorage.getItem(STATE_KEY)||sessionStorage.getItem(STATE_KEY)||'{}')}catch{}
PTE.saveStates=()=>{try{localStorage.setItem(STATE_KEY,JSON.stringify(PTE.states))}catch{}PTE.render()};
PTE.setState=(key,patch)=>{PTE.states[key]={...PTE.states[key],...patch};PTE.saveStates()};
PTE.roundCount=key=>Number.isSafeInteger(PTE.states[key]?.practiceRounds)?Math.max(0,PTE.states[key].practiceRounds):0;
PTE.roundLabel=key=>`累计 ${PTE.roundCount(key)} 轮`;
PTE.stateLabel=key=>{const s=PTE.states[key];return s?.state==='mastered'?'已练会':s?.state==='review'?'需要复习':s?.practiced?'已练过':s?.started?'练习中':'未练过'};

// ---------- Search ----------
// Learners often remember only the gist, so matching is fuzzy: English words match exactly, by stem, by prefix or
// with a small typo; Chinese matches by shared character pairs in the translation and notes. A bare number is
// matched against other sites' question numbers, which are never displayed. A search covers the whole bank.
const STOP=new Set('the a an of to in on at for and or is are was were be been by with as it its this that these those can will'.split(' '));
const stem=w=>w.length>4?w.replace(/(ies|ied)$/,'y').replace(/(ing|ed|es|s|ly)$/,''):w;
function editDistance(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let prev=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){const cur=[i];let best=i;for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));best=Math.min(best,cur[j])}if(best>limit)return limit+1;prev=cur}
 return prev[b.length];
}
function wordScore(q,words){
 let best=0;
 for(const w of words){
  if(w===q)return 1;
  if(stem(w)===stem(q))best=Math.max(best,.9);
  else if(q.length>=3&&w.startsWith(q))best=Math.max(best,.8);
  else if(q.length>=4&&editDistance(q,w,q.length>=7?2:1)<=(q.length>=7?2:1))best=Math.max(best,.65);
 }
 return best;
}
// Near-synonym groups common in WFD sentences; a typed word is also tried as each other member of its group.
const SYNONYMS='夏天 夏季 暑假 暑期|冬天 冬季 寒假|图书馆 图书室|学生 同学 学员 学习者|老师 教师 导师 讲师 教授|课程 课堂 讲课 讲座 上课|作业 任务 论文 功课|考试 测验 测试 评估 考核|研究 调查 研讨|大学 高校 学校 学院|环境 生态 自然|气候 天气 气温|污染 排放|经济 金融 财政|政府 当局 官方|资金 经费 预算 费用 钱|工作 职业 就业 岗位|电脑 计算机|手机 电话|网站 网页 网上 互联网 网络|取消 撤销|关闭 闭馆 关门|动物 野生动物 生物|植物 花草 树木|食物 食品 饮食|健康 保健|会议 研讨会 研讨课|申请 报名|截止 期限 截止日期|企业 公司 商业 业务|员工 职员 雇员|城市 都市|交通 车辆 汽车|科学家 学者 专家|技能 能力|增加 增长 上升 提高|减少 下降 降低|重要 关键 主要|问题 难题 挑战|方法 方式 途径|影响 作用|文献 文章 资料|书籍 图书 教科书 教材 课本|实验 试验|宿舍 住宿 公寓|校园 校区|讲话 演讲 演说 报告|理论 学说|数据 资料 统计|历史 过去'
 .split('|').map(g=>g.split(' '));
function synonymsOf(segment){
 const out=new Set([segment]);
 for(const group of SYNONYMS)for(const word of group)if(segment.includes(word))for(const other of group)out.add(segment.replace(word,other));
 return [...out];
}
function segmentScore(s,text){
 const grams=s.length<2?[s]:Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2));
 const pairs=grams.filter(g=>text.includes(g)).length/grams.length,chars=[...s].filter(c=>text.includes(c)).length/s.length;
 return Math.max(.7*pairs+.3*chars,.75*chars);
}
const chineseText=q=>(q.translation||'')+(q.notes||'')+(PTE.notes[q.questionId]||[]).map(n=>n.gloss).join('');
function matchScore(q,query){
 const scores=[];
 const english=tokens(query),content=english.filter(t=>!STOP.has(t)),useful=content.length?content:english;
 if(useful.length){const words=tokens(q.sentence);scores.push(useful.reduce((n,t)=>n+wordScore(t,words),0)/useful.length)}
 // Chinese: each typed segment (and its near-synonyms) is compared with the translation, notes and per-word glosses.
 const segments=query.match(/[一-鿿]+/g)||[];
 if(segments.length){
  const text=chineseText(q);
  scores.push(segments.reduce((n,s)=>n+Math.max(...synonymsOf(s).map(v=>segmentScore(v,text))),0)/segments.length);
 }
 return scores.length?Math.max(...scores):0;
}
const statusOk=q=>{const st=PTE.states[q.questionKey],f=$('filter').value;return f==='all'||(f==='wrongbook'?PTE.book.has(q.questionKey):f==='practiced'?!!st?.practiced:f==='unpracticed'?!st?.practiced:st?.state===f)};
// Questions with wrong words are listed wherever they are in the bank, not only within the chosen scope.
const inScope=q=>{const s=$('scope').value;return s==='all'||$('filter').value==='wrongbook'||(s==='audio'?!!q.hasAudio:q.changeHits>0)};
PTE.searchQuery=()=>$('search').value.trim();
function search(pool,query){
 if(/^\d+$/.test(query))return pool.filter(q=>String(q.sourceIds||'').split(/\s+/).includes(query));
 return pool.map(q=>[q,matchScore(q,query)]).filter(([,s])=>s>=.5).sort((a,b)=>b[1]-a[1]).map(([q])=>q);
}
PTE.visible=()=>{const query=PTE.searchQuery();return (query?search(PTE.questions,query):PTE.questions.filter(inScope)).filter(statusOk)};
// Optional complete bank (e.g. scraped by a separate task) for questions outside the curated list.
PTE.fullBank=[];PTE.archivedQuestions=[];
PTE.findQuestion=key=>PTE.questions.find(q=>q.questionKey===key)||PTE.fullBank.find(q=>q.questionKey===key)||PTE.archivedQuestions.find(q=>q.questionKey===key);
function fullBankMatches(query){
 if(!query||!PTE.fullBank.length)return [];
 const known=new Set(PTE.questions.flatMap(q=>String(q.sourceIds||'').split(/\s+/)).filter(Boolean));
 return search(PTE.fullBank,query).filter(q=>!String(q.sourceIds).split(/\s+/).some(id=>known.has(id))).slice(0,20);
}

// ---------- Wrong-word book ----------
// Words marked wrong or missing when the learner presses Enter are collected automatically (practice-unified.js calls
// miss/credit). A word leaves the list after it is written right on the first try BOOK_DONE times in a row, anywhere.
// Kept on this device only, like the practice status.
const BOOK_KEY='pte-wfd-wrongbook-v1',BOOK_DONE=2,BOOK_MAX=600;
// A missed little word (the, of, a…) is a listening slip, not vocabulary; it is only collected when misspelled.
const BOOK_SKIP_MISSED=new Set([...STOP,...'i you he she we they me him her us them my your his our their not do does did has have had from but if so than then there which who what when'.split(' ')]);
PTE.book={words:{}};
try{PTE.book.words=JSON.parse(localStorage.getItem(BOOK_KEY)||'{}').words||{}}catch{}
PTE.book.skip=(word,typed)=>!typed&&BOOK_SKIP_MISSED.has(word);
PTE.book.miss=(q,word,shown,typed,note)=>{
 const e=PTE.book.words[word]||(PTE.book.words[word]={n:0,q:[]});
 Object.assign(e,{w:shown,n:e.n+1,ok:0,done:false,last:typed||'',t:Date.now(),q:[q.questionKey,...e.q.filter(k=>k!==q.questionKey)].slice(0,5)});
 if(note)e.note={ipa:note.ipa,gloss:note.gloss,pos:note.pos};
};
// Written right on the first try: true when this moved the word along (the caller then saves).
PTE.book.credit=word=>{const e=PTE.book.words[word];if(!e||e.done)return false;e.ok=(e.ok||0)+1;if(e.ok>=BOOK_DONE)Object.assign(e,{done:true,doneAt:Date.now()});return true};
const bookActive=()=>Object.entries(PTE.book.words).filter(([,e])=>!e.done).sort((a,b)=>b[1].t-a[1].t);
PTE.book.has=key=>Object.values(PTE.book.words).some(e=>!e.done&&e.q.includes(key));
PTE.book.save=()=>{
 const all=Object.entries(PTE.book.words);
 if(all.length>BOOK_MAX)all.sort((a,b)=>(a[1].done?0:1)-(b[1].done?0:1)||(a[1].doneAt||a[1].t)-(b[1].doneAt||b[1].t)).slice(0,all.length-BOOK_MAX).forEach(([w])=>delete PTE.book.words[w]);
 try{localStorage.setItem(BOOK_KEY,JSON.stringify({v:1,words:PTE.book.words}))}catch{}
 bookCount();
 if($('bookDialog').open)renderBook();
 if($('filter').value==='wrongbook')PTE.render();
};
function bookCount(){const n=bookActive().length;$('bookCount').textContent=n?String(n):'';$('bookOpen').classList.toggle('has-words',n>0)}
// The sentence with every occurrence of the word (or hyphenated word) passed through wrap.
const WORD_RE=/[A-Za-z0-9]+(?:(?:'|&#39;|[‘’]|-)[A-Za-z0-9]+)*/g;
const sameWord=(m,word)=>m.replace(/&#39;|[‘’]/g,"'").toLowerCase()===word;
const bookSentence=(sentence,word,wrap=m=>`<mark>${m}</mark>`)=>esc(sentence).replace(WORD_RE,m=>sameWord(m,word)?wrap(m):m);
const bookQuestion=e=>e.q.map(PTE.findQuestion).find(Boolean);
const bookHint=(e,word)=>`<div class="book-word"><b>${esc(e.w||word)}</b>${e.note?.ipa?`<span class="book-ipa">/${esc(e.note.ipa)}/</span>`:''}${e.note?.gloss?`<span class="book-gloss">${esc(e.note.gloss)}</span>`:''}</div>`;
function bookItem([word,e],done){
 const q=bookQuestion(e);
 const meta=done?'已连续两次一次写对':`错 ${e.n} 次 · ${e.last?`上次写成 <s>${esc(e.last)}</s>`:'上次漏写'}${e.ok?` · 之后写对 ${e.ok} 次`:''}`;
 const actions=(q&&!done?`<button type="button" class="primary" data-spell="${esc(word)}">练拼写</button>`:'')+(done?`<button type="button" data-restore="${esc(word)}">放回错词本</button>`:`<button type="button" data-remove="${esc(word)}">移出</button>`);
 return `<li class="book-item">${bookHint(e,word)}<div class="book-meta">${meta}</div>${q?`<div class="book-sentence" lang="en">${bookSentence(q.sentence,word)}</div>`:''}<div class="book-actions">${actions}</div></li>`;
}
function renderBook(){
 const hasResume=savedReview.queue?.length&&savedReview.i>0&&savedReview.i<savedReview.queue.length;
 $('bookPractice').textContent=hasResume?`继续复习：从第 ${savedReview.i+1} / ${savedReview.queue.length} 个词接着拼`:'开始复习：先拼单词，再练整题';$('bookRestart').hidden=!hasResume;
 const active=bookActive(),done=Object.entries(PTE.book.words).filter(([,e])=>e.done).sort((a,b)=>b[1].doneAt-a[1].doneAt);
 $('bookList').innerHTML=active.length?active.map(x=>bookItem(x,false)).join(''):'<li class="book-empty">还没有错词。听写时按回车检查，打错或漏写的单词会自动收进这里。</li>';
 $('bookPractice').hidden=!active.some(([,e])=>bookQuestion(e));
 $('bookDoneWrap').hidden=!done.length;$('bookDoneTitle').textContent=`已掌握 ${done.length} 个`;
 $('bookDoneList').innerHTML=done.map(x=>bookItem(x,true)).join('');
}
// Review runs in two steps: spell each word into the blank of its sentence (listening to the original sentence),
// then practise the whole questions in the normal practice window. The word must be typed right to move on.
const REVIEW_KEY='pte-wfd-review-session-v1';let savedReview={};try{savedReview=JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}')}catch{}
const drill={queue:[],i:0,tries:0,shown:false,ok:false};
function saveReview(){if(drill.queue.length>1){savedReview={queue:drill.queue,i:drill.i};try{localStorage.setItem(REVIEW_KEY,JSON.stringify(savedReview))}catch{}}}
const normWord=s=>String(s).trim().toLowerCase().replace(/[‘’]/g,"'").replace(/\s*-\s*/g,'-').replace(/\s+/g,' ');
function startDrill(queue,{restart=false,resume=false}={}){
 let index=0;if(resume&&!restart&&savedReview.queue?.length&&savedReview.i<savedReview.queue.length){queue=savedReview.queue.filter(w=>PTE.book.words[w]&&bookQuestion(PTE.book.words[w]));index=Math.min(savedReview.i,queue.length-1)}
 Object.assign(drill,{queue,i:Math.max(0,index)});saveReview();$('bookListView').hidden=true;$('bookDrill').hidden=false;showDrillWord();
}
function endDrill(){PTE.stopAudio?.();$('bookDrill').hidden=true;$('bookListView').hidden=false;renderBook()}
function drillQuestions(){return [...new Set(drill.queue.map(w=>bookQuestion(PTE.book.words[w])?.questionKey).filter(Boolean))]}
function showDrillWord(){
 Object.assign(drill,{tries:0,shown:false,ok:false});
 const done=drill.i>=drill.queue.length;
 $('drillCard').hidden=done;$('drillFinish').hidden=!done;
 $('drillProgress').textContent=done?'拼写完成':`拼写 ${drill.i+1} / ${drill.queue.length}`;
 if(done){
  const n=drillQuestions().length;
  $('drillFinishText').textContent=`${drill.queue.length} 个词都拼对了。接着把${n>1?`这 ${n} 道题`:'这道题'}整题听写一遍。`;
  $('drillWhole').focus();return;
 }
 const word=drill.queue[drill.i],e=PTE.book.words[word],q=bookQuestion(e);
 $('drillHint').innerHTML=`${e.note?.gloss?`<span class="book-gloss">${esc(e.note.gloss)}</span>`:''}${e.note?.ipa?`<span class="book-ipa">/${esc(e.note.ipa)}/</span>`:''}`;
 $('drillCn').textContent=q.translation||'';
 $('drillInput').value='';$('drillInput').readOnly=false;$('drillFeedback').textContent='';$('drillFeedback').className='drill-feedback';
 $('drillListen').hidden=!q.hasAudio&&!q.audioUrl;
 drawDrill();$('drillNext').hidden=true;$('drillAnswer').hidden=false;
 $('drillInput').focus();
}
function drawDrill(){
 const word=drill.queue[drill.i],q=bookQuestion(PTE.book.words[word]);
 $('drillSentence').innerHTML=bookSentence(q.sentence,word,m=>drill.shown||drill.ok?`<span class="drill-blank filled${drill.ok?' ok':''}">${m}</span>`:`<span class="drill-blank" style="min-width:${(m.length*.62+.6).toFixed(2)}em"></span>`);
}
function checkDrill(){
 if(drill.ok){nextDrill();return}
 const word=drill.queue[drill.i],typed=normWord($('drillInput').value);if(!typed)return;
 const fb=$('drillFeedback');
 if(typed===word){
  drill.ok=true;drawDrill();$('drillInput').readOnly=true;$('drillAnswer').hidden=true;$('drillNext').hidden=false;
  $('drillNext').textContent=drill.i+1<drill.queue.length?'下一个词 →':drill.queue.length>1?'完成拼写 →':'练整题 →';
  fb.textContent=drill.shown?'对了。之后在整题里再写对两次，就能移出错词本。':'拼对了！';fb.className='drill-feedback ok';
  PTE.tone?.(drill.i+1<drill.queue.length||drill.queue.length===1?'success':'complete');return;
 }
 drill.tries++;fb.className='drill-feedback wrong';PTE.tone?.('error');
 const box=$('drillInput');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)box.animate([0,-9,8,-6,4,-2,0].map(x=>({transform:`translateX(${x}px)`})),{duration:340,easing:'ease-out'});
 fb.textContent=drill.shown?'照着上面的词再拼一遍':drill.tries>=2?'还不对，可以再听一次，或点“看答案”':'不对，再听一次试试';
 $('drillInput').select();
}
// The finish screen leads into the whole questions; a single word goes straight to its question.
function nextDrill(){drill.i++;saveReview();if(drill.i<drill.queue.length||drill.queue.length>1){showDrillWord();return}practiseWhole()}
async function practiseWhole(){
 const keys=drillQuestions();PTE.stopAudio?.();$('bookDialog').close();
 if(!keys.length)return;
 if(keys.length>1){$('filter').value='wrongbook';$('search').value='';PTE.render()}
 if(!$('restore').hidden)await PTE.restore?.();
 await PTE.select?.(keys[0],{fromList:true,fresh:true});
}
async function drillListen(){
 const q=bookQuestion(PTE.book.words[drill.queue[drill.i]]);if(!q)return;
 $('drillInput').focus();   // type while it plays
 const error=await PTE.playSentence?.(q);if(error){$('drillFeedback').textContent=error;$('drillFeedback').className='drill-feedback'}
}
PTE.book.open=()=>{endDrill();if(!$('bookDialog').open)$('bookDialog').showModal()};
$('bookOpen').addEventListener('click',PTE.book.open);
$('bookFromDock').addEventListener('click',PTE.book.open);
$('bookClose').addEventListener('click',()=>$('bookDialog').close());
$('bookDialog').addEventListener('close',()=>PTE.stopAudio?.());
$('bookDialog').addEventListener('click',e=>{
 if(e.target===$('bookDialog')){$('bookDialog').close();return}
 const b=e.target.closest('button');if(!b)return;
 const word=b.dataset.remove||b.dataset.restore;
 if(word){Object.assign(PTE.book.words[word],b.dataset.remove?{done:true,doneAt:Date.now()}:{done:false,ok:0,t:Date.now()});PTE.book.save();return}
 if(b.id==='bookPractice'||b.id==='bookRestart')startDrill(bookActive().filter(([,e])=>bookQuestion(e)).map(([w])=>w),{resume:true,restart:b.id==='bookRestart'});
 else if(b.dataset.spell)startDrill([b.dataset.spell]);
 else if(b.id==='drillBack')endDrill();
 else if(b.id==='drillListen')drillListen();
 else if(b.id==='drillAnswer'){drill.shown=true;drawDrill();$('drillInput').value='';$('drillFeedback').textContent='照着拼一遍';$('drillFeedback').className='drill-feedback';$('drillInput').focus()}
 else if(b.id==='drillNext')nextDrill();
 else if(b.id==='drillWhole')practiseWhole();
});
$('drillInput').addEventListener('keydown',e=>{
 if(e.isComposing||e.keyCode===229)return;
 if(e.key==='Enter'){e.preventDefault();checkDrill()}
 else if((e.ctrlKey||e.metaKey)&&(e.key==="'"||e.code==='Quote')){e.preventDefault();drillListen()}
});
bookCount();

function noteHtml(notes){
 return String(notes||'').split('\n').filter(Boolean).map(line=>{const [label,...rest]=line.split('：');return `<div class="row-note">${rest.length?`<b>${esc(label)}</b>${esc(rest.join('：'))}`:esc(line)}</div>`}).join('');
}
// Notes stay as small chips (变题 / 听辨) and open in full only on the selected row.
function noteChips(notes){
 const labels=[...new Set(String(notes||'').split('\n').map(l=>l.split('：')[0]).filter(Boolean))];
 return labels.map(l=>`<span class="note-chip">${esc(l.length>4?'备注':l)}</span>`).join('');
}
function rowHtml(q,searching,index=''){
 const label=PTE.stateLabel(q.questionKey),latest=(q.recentHits||'').split('\n')[0],selected=PTE.active?.questionKey===q.questionKey;
 const outside=searching&&!q.full&&!(q.changeHits>0)?'<span class="out-tag">非本周高频</span>':'';
 return `<div class="row ${PTE.active?.questionKey===q.questionKey?'selected':''}" data-key="${esc(q.questionKey)}" tabindex="0" role="button" aria-label="练习：${esc(q.sentence)}"><span class="idx">${index}</span><div class="text"><div class="sentence">${esc(q.sentence)}${outside}</div>${q.translation?`<div class="translation">${esc(q.translation)}</div>`:''}${selected?noteHtml(q.notes):noteChips(q.notes)}</div><div class="recent">${latest?`<span>${esc(latest)}</span>`:'<span class="muted">暂无记录</span>'}</div><div class="practice-state"><span class="state tag ${({'未练过':'','练习中':'doing'})[label]??'done'}">${label}</span><span class="round-count" title="已记录的累计练习轮数；清空重做、修改、重听和刷新不重复计数。">${PTE.roundLabel(q.questionKey)}</span></div></div>`;
}
PTE.render=()=>{
 const query=PTE.searchQuery(),rows=PTE.visible(),extra=fullBankMatches(query);
 const done=rows.filter(q=>PTE.states[q.questionKey]?.practiced).length;
 $('count').innerHTML=!query?`共 ${rows.length} 道 · <span class="list-progress">已练 ${done} / ${rows.length}</span>`:/^\d+$/.test(query)?`按题号匹配到 ${rows.length+extra.length} 道`:`找到 ${rows.length+extra.length} 道相关题目（按相似度排序）`;
 // Other sites' question numbers are intentionally not shown.
 $('list').innerHTML=(rows.length?rows.map((q,i)=>rowHtml(q,!!query,query?'':i+1)).join(''):extra.length?'':'<div class="empty">没有找到相关题目。可以换几个关键词，或者尝试更短的英文或中文关键词。</div>')
  +(extra.length?`<div class="group-head"><span>完整题库中的其他题目</span></div>${extra.map(q=>rowHtml(q,true)).join('')}`:'');
 PTE.afterListRender?.();
};

$('list').addEventListener('click',e=>{const row=e.target.closest('.row');if(row)PTE.select?.(row.dataset.key,{fromList:true,play:true})});
$('list').addEventListener('keydown',e=>{const row=e.target.closest('.row');if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();PTE.select?.(row.dataset.key,{fromList:true,play:true})}});
for(const id of ['search','scope','filter'])$(id).addEventListener('input',PTE.render);
$('search').addEventListener('focus',()=>{$('searchHint').hidden=false});
$('search').addEventListener('blur',()=>{$('searchHint').hidden=true});

// Per-word notes (IPA, part of speech, gloss) shown after a phrase is passed. Draft data; a question whose
// notes do not line up word-for-word with its sentence simply shows plain words.
PTE.notes={};PTE.posLabels={};
PTE.noteFor=(q,index)=>PTE.notes[q.questionId]?.[index]||null;
// The weekly list runs for seven days starting on the bank's update date (Taipei time).
function showUpdateDate(syncedAt){
 const start=new Date(syncedAt);if(isNaN(start))return;
 const part=(date,opts)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Taipei',...opts}).formatToParts(date).reduce((o,p)=>(o[p.type]=p.value,o),{});
 const a=part(start,{year:'numeric',month:'numeric',day:'numeric'}),b=part(new Date(start.getTime()+6*864e5),{month:'numeric',day:'numeric'});
 const md=p=>`${p.month}月${p.day}日`;
 $('updatedAt').textContent=`${a.year}.${a.month.padStart(2,'0')}.${a.day.padStart(2,'0')}`;
 $('weekRange').textContent=`${md(a)} – ${md(b)}`;
}
PTE.ready=Promise.resolve(JSON.parse(document.getElementById('questionData').textContent)).then(d=>{
 PTE.questions=d.questions;PTE.archivedQuestions=d.archivedQuestions||[];PTE.accessVersion=d.accessVersion;
 showUpdateDate(d.syncedAt);PTE.render();return d;
}).catch(()=>{$('count').textContent='题库未能加载，请刷新重试。'});
// Complete bank file format: {"questions":[{"id":"131902","sentence":"…","translation":"…"}]} — loaded only if present.
Promise.resolve({questions:[]}).then(bank=>{
 if(!bank?.questions)return;
 PTE.fullBank=[...PTE.archivedQuestions,...bank.questions.filter(q=>q.id&&q.sentence).map(q=>({questionKey:'full-'+q.id,questionId:String(q.id),sourceIds:String(q.id),sentence:q.sentence,translation:q.translation||'',full:true}))];
 if(PTE.searchQuery())PTE.render();
}).catch(()=>{});
// Deep link from the Feishu sheet: /?t=<code> opens that question in immersive practice.
// The code is our own 6-character id (FNV-1a of "pte3000:"+questionKey, base 36), so no third-party
// number shows in the address; scripts/wfd-link-codes.py computes the same codes for the sheet.
PTE.linkCode=key=>{let h=0x811c9dc5;for(const b of new TextEncoder().encode('pte3000:'+key))h=Math.imul(h^b,0x01000193)>>>0;return (h%2176782336).toString(36).padStart(6,'0')};
PTE.linkedQuestion=()=>{
 const code=new URLSearchParams(location.search).get('t')?.trim().toLowerCase();
 return code?PTE.questions.find(q=>PTE.linkCode(q.questionKey)===code)||null:null;
};
