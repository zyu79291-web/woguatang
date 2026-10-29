"""Build a self-contained, read-only WE page for sharing with a teacher."""
from pathlib import Path
from html import escape
import json

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'dist/assets/we-library-data.js').read_text()
data = json.loads(source.split('=', 1)[1].strip().rstrip(';'))
essays = data['essays']

def e(value):
    return escape(str(value), quote=True)

links, articles = [], []
for essay in essays:
    number, key = essay['number'], essay['id']
    search = ' '.join([str(number), f'{number:02}', essay['titleZh'], essay['title'], essay['prompt']])
    links.append(f'<a href="#{e(key)}" data-search="{e(search)}"><span class="number">{number:02}</span><span>{e(essay["titleZh"])}<small lang="en">{e(essay["title"])}</small></span></a>')
    points = []
    for i, point in enumerate(essay['points'], 1):
        sentences = point['sentences']
        points.append(f'''<section class="point"><span class="label">分论点 {i}</span><h3>{e(point['title'])}</h3>
<p lang="en">{e(sentences[0])}</p><dl><div><dt>解释</dt><dd lang="en">{e(sentences[1])}</dd></div><div><dt>例子</dt><dd lang="en">{e(sentences[2])}</dd></div></dl></section>''')
    paragraphs = ''.join(f'<p lang="en">{e(paragraph)}</p>' for paragraph in essay['essay'])
    articles.append(f'''<article id="{e(key)}" aria-labelledby="{e(key)}-title">
<header class="essay-heading"><span class="eyebrow">WRITE ESSAY · {number:02} / {len(essays)}</span><h2 id="{e(key)}-title" tabindex="-1">{e(essay['titleZh'])}</h2><p class="english-title" lang="en">{e(essay['title'])}</p></header>
<section class="prompt"><h3 class="label">作文题目 · 英文原题</h3><p lang="en">{e(essay['prompt'])}</p></section>
<section class="thesis"><h3 class="label">总论点 · 总体立场</h3><p class="thesis-zh">{e(essay['stanceZh'])}</p><p lang="en">{e(essay['stance'])}</p></section>
<div class="points">{''.join(points)}</div>
<section class="full-essay"><h3>完整作文</h3>{paragraphs}</section></article>''')

page = '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="WE 作文：37 道英文题目、总论点、分论点与完整作文。"><title>WE 作文</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='12' fill='%237b65a7'/%3E%3Ctext x='20' y='28' text-anchor='middle' font-size='16' fill='white'%3EWE%3C/text%3E%3C/svg%3E">
<style>
:root{color-scheme:light;--ink:#51435f;--muted:#8a7b9b;--accent:#8269ac;--line:#e8e0f0;--paper:#fff;--wash:#f7f5fb}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}button,input{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer}button:disabled{opacity:.35;cursor:default}[hidden]{display:none!important}a{color:inherit;text-decoration:none}:focus-visible{outline:3px solid #b7a2d6;outline-offset:4px}button:focus-visible,input:focus-visible{outline-offset:2px}
.site-header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 max(28px,calc((100vw - 1320px)/2));gap:16px;background:#ffffffdc;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;font-weight:750;font-size:19px}.brand-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#8269ac;color:white;font-size:18px}.header-caption{font-size:14px;color:var(--muted)}.page{max-width:1376px;margin:36px auto 64px;padding:0 28px}.page-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:26px}.page-heading h1{font-size:30px;letter-spacing:-.6px;margin:0 0 8px}.page-heading p{font-size:16px;color:var(--muted);margin:0;line-height:1.7}.print{border:1px solid #dcd0e9;background:#fff;color:#7f659f;padding:10px 16px;border-radius:10px;white-space:nowrap;font-size:14px}.layout{display:grid;grid-template-columns:262px minmax(0,1fr);gap:26px;align-items:start}.sidebar{position:sticky;top:22px;border:1px solid var(--line);border-radius:15px;background:#ffffffb8;overflow:hidden}.search-wrap{padding:16px 14px 12px;border-bottom:1px solid #eee8f4}.search-wrap label{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:14px;color:#8d7b9e}.search-wrap label span{font-size:12px;color:#ac9ab9}.search-wrap input{width:100%;padding:10px 11px;border:1px solid #e3dbea;border-radius:8px;background:#fcfbfe;color:#665075;font-size:14px;min-height:42px}.search-wrap input::placeholder{color:#aea1bb}.essay-list{max-height:calc(100vh - 224px);min-height:220px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#d8cce7 transparent;padding:7px}.essay-list a{display:flex;gap:11px;padding:13px 11px;margin:2px 0;border:1px solid transparent;border-radius:9px;font-size:16px;line-height:1.55;color:#806d90}.essay-list a:hover{background:#f7f3fb}.essay-list a[aria-current=page]{background:#efe8f8;border-color:#e3d5f0;color:#745493}.essay-list .number{font-size:12px;color:#af99c0;padding-top:3px;font-variant-numeric:tabular-nums}.essay-list small{display:block;font-size:12px;line-height:1.6;margin-top:4px;color:#a390b4}.empty{font-size:14px;color:#9a86ab;padding:16px;line-height:1.8}.reading{min-width:0}.reader-controls{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px;min-height:34px}.reader-controls span{color:#a18cb4;font-size:13px;font-variant-numeric:tabular-nums}.reader-controls div{display:flex;gap:8px}.reader-controls button{background:#fff;border:1px solid #e0d5ec;border-radius:8px;padding:7px 12px;color:#8c71a4;font-size:13px;min-height:36px}article{padding:36px 40px 38px;background:var(--paper);border:1px solid var(--line);border-radius:18px;scroll-margin-top:20px}article+article{margin-top:24px}.eyebrow{font-size:12px;letter-spacing:1.2px;color:#a48bb8}.essay-heading h2{font-size:32px;line-height:1.4;margin:12px 0 7px;letter-spacing:-.7px}.essay-heading h2:focus{outline:none}.english-title{font-size:18px;line-height:1.65;margin:0;color:#a08bae}.label{display:block;font-size:13px;line-height:1.6;letter-spacing:.3px;font-weight:500;margin:0;color:#9b80af}article p{font-size:20px;line-height:1.85;margin:12px 0 0;color:#6b577b;overflow-wrap:anywhere}.prompt{padding:20px 22px;background:#faf8fd;border:1px solid #eee7f5;border-radius:12px;margin-top:28px}.prompt p{font-size:19px;margin-top:9px}.thesis{padding:22px;background:#f3eef9;border:1px solid #e7dcef;border-radius:12px;margin:20px 0}.thesis .thesis-zh{font-weight:600;font-size:21px;margin-top:8px;color:#705582}.points{display:grid;gap:16px}.point{padding:23px 22px;border:1px solid #eae2f1;border-radius:12px}.point h3{font-size:22px;line-height:1.6;margin:7px 0 9px;color:#705582}.point>p{font-size:21px;font-family:Georgia,"Times New Roman",serif;color:#665071}.point dl{margin:18px 0 0}.point dl div{display:grid;grid-template-columns:35px minmax(0,1fr);gap:13px;margin-top:12px}.point dt{font-size:13px;line-height:1.9;padding-top:3px;color:#a087b4}.point dd{font-size:18px;line-height:1.85;margin:0;color:#8b759a;overflow-wrap:anywhere}.full-essay{border-top:1px solid var(--line);padding-top:26px;margin-top:30px}.full-essay h3{margin:0 0 18px;font-size:21px;letter-spacing:-.3px;color:#705582}.full-essay p{font:20px/1.95 Georgia,"Times New Roman",serif;margin:0 0 21px;color:#66526f}.full-essay p:last-child{margin-bottom:0}.bottom-controls{margin:18px 0 0}.footer{font-size:12px;color:#b5a6bf;text-align:center;margin:32px 0 0;line-height:1.8}
@media(max-width:1000px){.layout{grid-template-columns:222px minmax(0,1fr);gap:18px}article{padding:29px 27px}.page{padding:0 22px}.essay-heading h2{font-size:29px}}
@media(max-width:760px){.site-header{height:62px;padding:0 20px}.brand{font-size:17px}.header-caption{font-size:12px}.page{padding:0 16px;margin:25px auto 40px}.page-heading{align-items:flex-start;margin-bottom:20px;gap:12px}.page-heading h1{font-size:27px}.page-heading p{font-size:14px}.print{font-size:12px;padding:9px 12px}.layout{grid-template-columns:1fr;gap:20px}.sidebar{position:static}.search-wrap{padding:14px}.essay-list{max-height:205px;min-height:0}.essay-list a{padding:10px 11px}.reader-controls{margin-bottom:12px}article{padding:26px 21px;border-radius:14px}.essay-heading h2{font-size:28px}.english-title{font-size:16px}.prompt,.thesis,.point{padding:18px 16px}.prompt{margin-top:23px}.prompt p,article p{font-size:18px}.thesis .thesis-zh,.point h3{font-size:20px}.point>p{font-size:20px}.point dd{font-size:17px}.point dl div{gap:8px}.full-essay p{font-size:19px;line-height:1.9}.full-essay h3{font-size:20px}.footer{margin-top:25px}}
@media print{@page{margin:18mm}.site-header,.page-heading,.sidebar,.reader-controls,.footer{display:none!important}body{background:#fff}.page{margin:0;padding:0;max-width:none}.layout{display:block}article{padding:0;border:0;border-radius:0}.essay-heading h2{font-size:24pt}.english-title{font-size:12pt}.prompt,.thesis,.point{padding:12px 14px;break-inside:avoid}article p,.prompt p,.point>p,.point dd,.full-essay p{font-size:12pt;line-height:1.75}.point h3,.thesis .thesis-zh,.full-essay h3{font-size:14pt}.full-essay p{orphans:3;widows:3}.label{font-size:10pt}}
</style></head><body>
<main class="page"><div class="page-heading"><div><h1>WE 作文</h1><p>37 道题目与完整作文</p></div><button type="button" class="print" id="printEssay">打印本篇</button></div>
<div class="layout"><aside class="sidebar" aria-label="作文目录"><div class="search-wrap"><label for="essaySearch">作文目录<span id="resultCount">37 篇</span></label><input id="essaySearch" type="search" placeholder="搜索题号或中英文题目…" autocomplete="off"></div><nav class="essay-list" id="essayList">__LINKS__<p class="empty" id="emptySearch" hidden>没有找到匹配的题目。</p></nav></aside>
<div class="reading"><div class="reader-controls"><span id="currentNumber" aria-live="polite"></span><div><button type="button" data-step="-1">← 上一篇</button><button type="button" data-step="1">下一篇 →</button></div></div>
<div id="essays">__ARTICLES__</div>
<div class="reader-controls bottom-controls"><span>WE 作文</span><div><button type="button" data-step="-1">← 上一篇</button><button type="button" data-step="1">下一篇 →</button></div></div></div></div>
</main>
<script>
(()=>{
const articles=Array.from(document.querySelectorAll('#essays article')),links=Array.from(document.querySelectorAll('#essayList a')),search=document.getElementById('essaySearch');let current=0;
function show(id,{focus=false}={}){
 const found=articles.findIndex(a=>a.id===id);current=found<0?0:found;
 articles.forEach((a,i)=>a.hidden=i!==current);links.forEach((a,i)=>{if(i===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 document.title=articles[current].querySelector('h2').textContent+' · WE 作文';document.getElementById('currentNumber').textContent=String(current+1).padStart(2,'0')+' / '+articles.length+' 篇';
 document.querySelectorAll('[data-step]').forEach(b=>b.disabled=current+Number(b.dataset.step)<0||current+Number(b.dataset.step)>=articles.length);
 if(focus){articles[current].querySelector('h2').focus({preventScroll:true});articles[current].scrollIntoView({block:'start',behavior:'smooth'})}
}
function navigate(id){history.pushState(null,'','#'+id);show(id,{focus:true})}
document.getElementById('essayList').addEventListener('click',event=>{const a=event.target.closest('a');if(!a||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.hash.slice(1))});
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>navigate(articles[current+Number(b.dataset.step)].id)));
search.addEventListener('input',()=>{const terms=search.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);let count=0;links.forEach(a=>{const match=terms.every(term=>a.dataset.search.toLowerCase().includes(term));a.hidden=!match;if(match)count++});document.getElementById('resultCount').textContent=count+' / '+articles.length+' 篇';document.getElementById('emptySearch').hidden=count>0});
window.addEventListener('popstate',()=>show(location.hash.slice(1),{focus:true}));window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
document.getElementById('printEssay').addEventListener('click',()=>window.print());show(location.hash.slice(1));
})();
</script></body></html>
'''
page = page.replace('__LINKS__', ''.join(links)).replace('__ARTICLES__', ''.join(articles))
target = ROOT / 'dist/we.html'
target.write_text(page)
print(f'Built {target}: {len(essays)} essays, self-contained, no practice records or dependencies.')
