(()=>{
const data=window.WE_LIBRARY,model=window.WELibraryModel.create(data),$lib=id=>document.getElementById(id);
const saved=PTE.wePracticeState.library||{};
const state=PTE.wePracticeState.library={section:saved.section==='library'?'library':'typing',view:saved.view==='groups'?'groups':'essays',essayId:model.essay(saved.essayId)?saved.essayId:data.essays[0].id,groupId:model.group(saved.groupId)?saved.groupId:'jobs',query:typeof saved.query==='string'?saved.query:'',originGroup:model.group(saved.originGroup)?saved.originGroup:null};
const search=$lib('weLibrarySearch'),list=$lib('weLibraryList'),detail=$lib('weLibraryDetail');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){PTE.flushProgress?.()}
function showSection(section,{focus=false}={}){
 state.section=section;$lib('weTypingPanel').hidden=section!=='typing';$lib('weLibraryPanel').hidden=section!=='library';
 for(const [id,value] of [['weTypingTab','typing'],['weLibraryTab','library']])$lib(id).setAttribute('aria-selected',String(section===value));
 if(focus){if(section==='library')search.focus({preventScroll:true});else $lib('weEditor').focus({preventScroll:true})}save();
}
function chip(point,gid){const g=model.group(gid),count=model.related(point.id,gid).length;return `<button type="button" class="we-concept-chip" data-we-group="${escape(gid)}">${escape(g.title)}<span>${count?'另 '+count+' 篇':'本题论点'}</span><span aria-hidden="true">↗</span></button>`}
function sourceSentence(point){return `<div class="we-original-point"><p lang="en">${escape(point.sentences[0])}</p><div class="we-point-expansion"><dl><div><dt>解释</dt><dd lang="en">${escape(point.sentences[1])}</dd></div><div><dt>例子</dt><dd lang="en">${escape(point.sentences[2])}</dd></div></dl></div></div>`}
function paintEssay(essay){
 const origin=model.group(state.originGroup);
 detail.innerHTML=`${origin?`<button type="button" class="we-library-back" data-we-group="${escape(origin.id)}">← 返回「${escape(origin.title)}」</button>`:''}<div class="we-library-eyebrow">作文 ${String(essay.number).padStart(2,'0')}</div><h3 id="weLibraryDetailTitle" tabindex="-1">${escape(essay.titleZh)}</h3><p class="we-essay-title" lang="en">${escape(essay.title)}</p><section class="we-original-prompt"><span class="we-outline-label">作文题目 · 英文原题</span><p lang="en">${escape(essay.prompt)}</p></section>
 <section class="we-thesis"><span class="we-outline-label">总论点 · 总体立场</span><h4>${escape(essay.stanceZh)}</h4><p lang="en">${escape(essay.stance)}</p></section>
 <div class="we-point-pair">${essay.points.map((p,i)=>`<section class="we-point-card"><span class="we-outline-label">分论点 ${i+1}</span><h4>${escape(p.title)}</h4>${sourceSentence(p)}<div class="we-point-connections">${p.groups.map(g=>chip(p,g)).join('')}</div></section>`).join('')}</div>
 <details class="we-full-essay"><summary>展开完整作文 <span>四段原文</span></summary><div lang="en">${essay.essay.map(p=>`<p>${escape(p)}</p>`).join('')}</div></details>`;
}
function paintGroup(group){
 const rows=model.entries(group.id);
 detail.innerHTML=`<div class="we-library-eyebrow">同类论点 · ${rows.length} 篇作文</div><h3 id="weLibraryDetailTitle" tabindex="-1">${escape(group.title)}</h3><p class="we-group-description">${escape(group.description)}</p><p class="we-adapt-note">以下是各篇的原文写法。复用时按原题调整主体、立场和例子。</p><div class="we-related-essays">${rows.map(({essay,points})=>`<article class="we-related-essay"><div class="we-related-header"><div><span class="we-library-number">${String(essay.number).padStart(2,'0')}</span><h4>${escape(essay.titleZh)}</h4></div><button type="button" data-we-essay="${escape(essay.id)}">看作文与全部论点 ↗</button></div><section class="we-related-prompt"><span>作文题目</span><p lang="en">${escape(essay.prompt)}</p></section><div class="we-related-thesis"><span>总论点</span><p>${escape(essay.stanceZh)}</p><p lang="en">${escape(essay.stance)}</p></div>${points.map(({point,index})=>`<div class="we-related-point"><span class="we-outline-label">分论点 ${index+1} · ${escape(point.title)}</span>${sourceSentence(point)}</div>`).join('')}</article>`).join('')}</div>`;
}
function paint(){
 const groupView=state.view==='groups';
 for(const [id,value] of [['weBrowseEssays','essays'],['weBrowseGroups','groups']])$lib(id).setAttribute('aria-pressed',String(state.view===value));
 search.placeholder=groupView?'搜索论点、题目或总论点…':'搜索题号、题目、总论点或分论点…';
 const results=groupView?model.groups(state.query):model.essays(state.query);
 $lib('weLibraryCount').textContent=groupView?`${results.length} 类论点`:`${results.length} 篇作文`;
 if(!results.length){list.innerHTML='<p class="we-library-empty">没有匹配结果，试试其他关键词。</p>';detail.innerHTML='<div class="we-library-empty">可以搜中文、英文，也可以搜作文编号。</div>';return}
 const key=groupView?'groupId':'essayId';if(!results.some(r=>r.id===state[key]))state[key]=results[0].id;
 list.innerHTML=results.map(r=>`<button type="button" class="we-library-item${state[key]===r.id?' selected':''}" data-we-select="${escape(r.id)}" aria-pressed="${state[key]===r.id}">${groupView?`<span class="we-library-item-title">${escape(r.title)}</span><small>${model.entries(r.id).length} 篇</small>`:`<span class="we-library-number">${String(r.number).padStart(2,'0')}</span><span class="we-library-item-title">${escape(r.titleZh)}<small lang="en">${escape(r.title)}</small></span>`}</button>`).join('');
 if(groupView)paintGroup(model.group(state.groupId));else paintEssay(model.essay(state.essayId));
}
function focusDetail(){const title=$lib('weLibraryDetailTitle');title?.focus({preventScroll:true});if(matchMedia('(max-width:760px)').matches)detail.scrollIntoView({block:'start',behavior:'smooth'})}
function openGroup(id){if(!model.group(id))return;state.view='groups';state.groupId=id;state.query='';search.value='';state.originGroup=id;paint();save();focusDetail()}
function openEssay(id){if(!model.essay(id))return;state.view='essays';state.essayId=id;state.query='';search.value='';paint();save();focusDetail()}
$lib('weTypingTab').addEventListener('click',()=>showSection('typing',{focus:true}));$lib('weLibraryTab').addEventListener('click',()=>showSection('library',{focus:true}));
$lib('weBrowseEssays').addEventListener('click',()=>{state.view='essays';state.originGroup=null;paint();save()});$lib('weBrowseGroups').addEventListener('click',()=>{state.view='groups';paint();save()});
search.value=state.query;search.addEventListener('input',()=>{state.query=search.value;paint();save()});
list.addEventListener('click',e=>{const button=e.target.closest('[data-we-select]');if(!button)return;state[state.view==='groups'?'groupId':'essayId']=button.dataset.weSelect;state.originGroup=null;paint();save();focusDetail()});
detail.addEventListener('click',e=>{const group=e.target.closest('[data-we-group]'),essay=e.target.closest('[data-we-essay]');if(group)openGroup(group.dataset.weGroup);else if(essay)openEssay(essay.dataset.weEssay)});
$lib('weLibrarySourceNote').textContent=data.source.note;
PTE.weLibrary={isOpen:()=>state.section==='library',focus:()=>search.focus({preventScroll:true})};
paint();showSection(state.section);
})();
