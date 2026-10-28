const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);for(const f of ['we-library-data.js','we-library-model.js'])vm.runInContext(fs.readFileSync('dist/assets/'+f,'utf8'),ctx);
const data=ctx.window.WE_LIBRARY,M=ctx.window.WELibraryModel.create(data);
assert.equal(M.counts.essays,37);assert.equal(M.counts.points,74);assert.equal(M.counts.groups,31);
assert.equal(new Set(data.essays.map(e=>e.id)).size,37);
for(const e of data.essays){assert(e.stanceZh&&e.stance&&e.prompt);assert.equal(e.points.length,2);assert.equal(e.essay.length,4);for(const p of e.points){assert.equal(p.sentences.length,3);assert(p.groups.length);for(const g of p.groups)assert(M.group(g).pointIds.includes(p.id))}}
for(const g of data.groups)for(const id of g.pointIds){const p=data.essays.flatMap(e=>e.points).find(p=>p.id===id);assert(p);assert(p.groups.includes(g.id))}
assert.equal(M.entries('jobs').length,5);assert.deepEqual(Array.from(M.entries('jobs'),r=>r.essay.number),[13,32,33,36,37]);
assert.equal(M.related('33.2','jobs').length,4);assert(!M.related('33.2','jobs').some(r=>r.essay.number===33));
assert.equal(M.entries('time-management').length,2,'two points from the same essay produce one essay card');
assert.equal(M.entries('time-management')[0].points.length,2,'both source points remain available');
assert.equal(M.essays('37')[0].number,37);assert(M.essays('AI translation').some(e=>e.number===37));
assert(M.essays('政府应该优先投资现代住房').some(e=>e.number===34),'Chinese total thesis is searchable');
assert(M.essays(data.essays[33].stance.slice(0,65)).some(e=>e.number===34),'English total thesis is searchable');
assert.equal(M.essays('a keyword that cannot possibly match any provided essay xyz987').length,0);
assert(M.groups('错误信息').some(g=>g.id==='misinformation'));
const html=fs.readFileSync('dist/index.html','utf8');for(const id of ['weTypingPanel','weLibraryPanel','weLibraryTab','weLibrarySearch'])assert(html.includes('id="'+id+'"'));
assert(fs.readFileSync('dist/assets/we-practice.js','utf8').includes('library:saved.library'),'existing typing saves retain library navigation');
const ui=fs.readFileSync('dist/assets/we-library.js','utf8');assert(!ui.includes('查看英文原题'));assert(!ui.includes('<summary>解释与例子</summary>'));assert(ui.includes('作文题目 · 英文原题'));
console.log('PASS: 37 essays, 74 source points, total theses, bidirectional links, reverse-list deduplication, Chinese/English search, unknown queries and typing-state integration.');
