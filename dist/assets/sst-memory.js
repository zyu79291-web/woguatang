(()=>{
const model=window.SSTMemoryModel.create(window.SST_MEMORY,PTE.sstPracticeState);
const state=PTE.sstPracticeState=model.state,$sst=id=>document.getElementById(id);
// Old memory labels and drafts remain saved, while the new page shows every topic.
state.filter='all';
const search=$sst('sstSearch'),list=$sst('sstList'),card=$sst('sstCard'),editor=$sst('sstEditor');
const recording=$sst('sstAudio'),loop=$sst('sstLoop');let audioQuestion='';
const audioEntries=model.questions.map(q=>window.SST_AUDIO?.[q.id]).filter(Boolean);
$sst('sstAudioCount').textContent=`已接入 ${audioEntries.length} / ${model.questions.length} 道录音`;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){PTE.flushProgress?.();$sst('sstSaved').textContent='已自动保存'}
function stopAudio(){recording.pause();recording.loop=false;loop.setAttribute('aria-pressed','false')}
function paintAudio(q){
 if(audioQuestion===q.id)return;stopAudio();audioQuestion=q.id;
 const source=window.SST_AUDIO?.[q.id];recording.removeAttribute('src');
 recording.hidden=loop.hidden=!source;
 const approximate=source?.kind==='近似音频';
 const label=approximate?'近似音频':'原版录音';
 $sst('sstAudioStatus').textContent=source?label:'录音暂未找到';
 $sst('sstAudioStatus').dataset.kind=approximate?'approximate':'original';
 if(source){recording.src=source.url;recording.setAttribute('aria-label',q.titleZh+label)}
 recording.load();
}
function paint(){
 const rows=model.filtered();
 if(rows.length&&!rows.some(q=>q.id===state.questionId))model.select(rows[0].id);
 $sst('sstCount').textContent=rows.length===model.questions.length?`${rows.length} 题`:`${rows.length} / ${model.questions.length} 题`;
 list.innerHTML=rows.map(q=>`<button class="sst-list-item${q.id===state.questionId?' selected':''}" type="button" data-sst-select="${escape(q.id)}" aria-pressed="${q.id===state.questionId}"><span class="sst-number">${String(q.number).padStart(2,'0')}</span><span class="sst-list-title">${escape(q.titleZh)}<small lang="en">${escape(q.title)}</small></span></button>`).join('');
 card.hidden=!rows.length;$sst('sstNoResults').hidden=!!rows.length;
 if(!rows.length){stopAudio();return;}
 const q=model.question(),record=model.record(q.id),at=rows.findIndex(row=>row.id===q.id);
 paintAudio(q);
 $sst('sstQuestionNumber').textContent=`SST ${String(q.number).padStart(2,'0')} / ${model.questions.length} · #${q.sourceId}`;
 $sst('sstTitle').textContent=q.titleZh;$sst('sstEnglishTitle').textContent=q.title;
 $sst('sstPrevious').disabled=at<=0;$sst('sstNext').disabled=at>=rows.length-1;
 $sst('sstPoints').innerHTML=q.points.map((p,i)=>`<li><span class="sst-point-number">${String(i+1).padStart(2,'0')}</span><div><p class="sst-point-en" lang="en">${escape(p.en)}</p><p class="sst-point-zh">${escape(p.zh)}</p></div></li>`).join('');
 editor.value=record.draft;$sst('sstWordCount').textContent=`${model.wordCount(record.draft)} 词`;
}
function focusCard(){
 $sst('sstTitle').focus({preventScroll:true});
 if(matchMedia('(max-width:760px)').matches){$sst('sstTopics').open=false;card.scrollIntoView({block:'start',behavior:'smooth'})}
}
search.value=state.query;
search.addEventListener('input',()=>{state.query=search.value.slice(0,200);paint();save()});
list.addEventListener('click',event=>{const button=event.target.closest('[data-sst-select]');if(!button)return;model.select(button.dataset.sstSelect);paint();save();focusCard()});
for(const [id,delta] of [['sstPrevious',-1],['sstNext',1]])$sst(id).addEventListener('click',()=>{if(model.move(delta)){paint();save();focusCard()}});
editor.addEventListener('input',()=>{model.update({draft:editor.value});$sst('sstWordCount').textContent=`${model.wordCount(editor.value)} 词`;save()});
loop.addEventListener('click',()=>{recording.loop=!recording.loop;loop.setAttribute('aria-pressed',String(recording.loop));loop.blur()});
recording.addEventListener('error',()=>{$sst('sstAudioStatus').textContent='录音加载失败，请重新选择这题'});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio()});
PTE.sstPractice={focus:focusCard,stop:stopAudio};
paint();
if(matchMedia('(max-width:760px)').matches)$sst('sstTopics').open=false;
})();
