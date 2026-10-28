(()=>{
const model=window.SSTMemoryModel.create(window.SST_MEMORY,PTE.sstPracticeState);
const state=PTE.sstPracticeState=model.state,$sst=id=>document.getElementById(id);
const search=$sst('sstSearch'),filter=$sst('sstFilter'),list=$sst('sstList'),card=$sst('sstCard'),editor=$sst('sstEditor');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusName=status=>status==='remembered'?'已记住':status==='review'?'待复习':'未标记';
const recording=$sst('sstAudio'),loop=$sst('sstLoop');let audioQuestion='';
function stopAudio(){recording.pause();recording.loop=false;loop.setAttribute('aria-pressed','false')}
function paintAudio(q){
 if(audioQuestion===q.id)return;stopAudio();audioQuestion=q.id;
 const source=window.SST_AUDIO?.[q.id];recording.removeAttribute('src');
 recording.hidden=loop.hidden=!source;$sst('sstAudioPending').hidden=!!source;
 $sst('sstAudioStatus').textContent=source?'猩际原版录音':'原版录音待接入';
 if(source){recording.src=source.url;recording.setAttribute('aria-label',q.titleZh+'原版录音')}
 recording.load();
}
function save(){PTE.flushProgress?.();$sst('sstSaved').textContent='已自动保存'}
function paintList(){
 const rows=model.filtered();
 if(rows.length&&!rows.some(q=>q.id===state.questionId))model.select(rows[0].id);
 const remembered=model.questions.filter(q=>model.record(q.id).status==='remembered').length;
 $sst('sstCount').textContent=`${rows.length} / ${model.questions.length} 题 · 已记住 ${remembered}`;
 list.innerHTML=rows.length?rows.map(q=>`<button class="sst-list-item${q.id===state.questionId?' selected':''}" type="button" data-sst-select="${escape(q.id)}" aria-pressed="${q.id===state.questionId}"><span class="sst-number">${String(q.number).padStart(2,'0')}</span><span class="sst-list-title">${escape(q.titleZh)}<small lang="en">${escape(q.title)}</small></span><span class="sst-list-status" data-status="${model.record(q.id).status}">${statusName(model.record(q.id).status)}</span></button>`).join(''):'<p class="sst-empty">没有匹配的题目，试试其他搜索词或练习状态。</p>';
 card.hidden=!rows.length;$sst('sstNoResults').hidden=!!rows.length;
 return rows;
}
function paintHints(){
 const q=model.question();
 $sst('sstCue').textContent=q.cue;$sst('sstCue').hidden=state.stage===0;
 $sst('sstRecallPrompt').hidden=state.stage!==0;
 const points=$sst('sstPoints');points.hidden=state.stage!==2;
 points.innerHTML=state.stage===2?q.points.map((p,i)=>`<li><span class="sst-point-number">${i+1}</span><div><strong lang="en">${escape(p.en)}</strong><span>${escape(p.zh)}</span></div></li>`).join(''):'';
 $sst('sstReveal').textContent=['看中文提示','看完整中英短句','遮住，自己回想'][state.stage];
 $sst('sstReveal').setAttribute('aria-expanded',String(state.stage>0));
}
function paint(){
 const rows=paintList();if(!rows.length){stopAudio();return;}
 const q=model.question(),record=model.record(q.id),at=rows.findIndex(row=>row.id===q.id);
 paintAudio(q);
 $sst('sstQuestionNumber').textContent=`SST ${String(q.number).padStart(2,'0')} / ${model.questions.length} · #${q.sourceId}`;
 $sst('sstTitle').textContent=q.titleZh;$sst('sstEnglishTitle').textContent=q.title;
 $sst('sstStatus').textContent=statusName(record.status);
 $sst('sstPrevious').disabled=at<=0;$sst('sstNext').disabled=at>=rows.length-1;
 editor.value=record.draft;$sst('sstWordCount').textContent=`${model.wordCount(record.draft)} 词`;
 $sst('sstRemembered').setAttribute('aria-pressed',String(record.status==='remembered'));
 $sst('sstReview').setAttribute('aria-pressed',String(record.status==='review'));
 paintHints();
}
function focusCard(){
 $sst('sstTitle').focus({preventScroll:true});
 if(matchMedia('(max-width:760px)').matches){$sst('sstTopics').open=false;card.scrollIntoView({block:'start',behavior:'smooth'})}
}
search.value=state.query;filter.value=state.filter;
search.addEventListener('input',()=>{state.query=search.value.slice(0,200);paint();save()});
filter.addEventListener('change',()=>{state.filter=filter.value;paint();save()});
list.addEventListener('click',event=>{const button=event.target.closest('[data-sst-select]');if(!button)return;model.select(button.dataset.sstSelect);paint();save();focusCard()});
for(const [id,delta] of [['sstPrevious',-1],['sstNext',1]])$sst(id).addEventListener('click',()=>{if(model.move(delta)){paint();save();focusCard()}});
$sst('sstReveal').addEventListener('click',()=>{state.stage=(state.stage+1)%3;paintHints();save()});
editor.addEventListener('input',()=>{model.update({draft:editor.value});$sst('sstWordCount').textContent=`${model.wordCount(editor.value)} 词`;save()});
for(const [id,status] of [['sstRemembered','remembered'],['sstReview','review']])$sst(id).addEventListener('click',()=>{
 const nextStatus=model.record(state.questionId).status===status?'':status;
 model.update({status:nextStatus});if(nextStatus==='remembered')PTE.dailyStats?.complete({questionKey:state.questionId});
 paint();save();PTE.backupProgress?.();
});
loop.addEventListener('click',()=>{recording.loop=!recording.loop;loop.setAttribute('aria-pressed',String(recording.loop));editor.focus({preventScroll:true})});
recording.addEventListener('error',()=>{$sst('sstAudioStatus').textContent='录音加载失败，请重新打开这题'});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio()});
PTE.sstPractice={focus:focusCard,stop:stopAudio};
paint();
if(matchMedia('(max-width:760px)').matches)$sst('sstTopics').open=false;
})();
