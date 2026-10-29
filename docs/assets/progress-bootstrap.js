// Apply the user's imported records once, merging with existing practice on this browser.
(()=>{
try{window.WOGUATANG_EMPTY_PROGRESS=!localStorage.getItem('pte:summary-preview:v1')&&!localStorage.getItem('pte-daily-practice-v1')}catch{}
const seed=window.WOGUATANG_IMPORTED_PROGRESS;if(!seed)return;
const marker='woguatang-progress-import-v1';
try{
 if(localStorage.getItem(marker)===seed.id)return;
 const states=JSON.parse(localStorage.getItem('pte:summary-preview:v1')||'{}');
 for(const [key,value] of Object.entries(seed.states))states[key]={...value,...states[key],practiced:!!(value.practiced||states[key]?.practiced),started:true};
 const book=JSON.parse(localStorage.getItem('pte-wfd-wrongbook-v1')||'{"v":1,"words":{}}');book.words||={};
 for(const [word,value] of Object.entries(seed.book.words))if(!book.words[word])book.words[word]=value;
 localStorage.setItem('pte:summary-preview:v1',JSON.stringify(states));localStorage.setItem('pte-wfd-wrongbook-v1',JSON.stringify(book));
 if(!localStorage.getItem('pte-wfd-review-session-v1'))localStorage.setItem('pte-wfd-review-session-v1',JSON.stringify(seed.reviewResume));
 localStorage.setItem(marker,seed.id);
}catch(e){console.warn('进度导入暂未完成',e.message)}
})();
