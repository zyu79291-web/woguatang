const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.createContext(context);
for(const file of ['sst-memory-data.js','sst-memory-model.js'])vm.runInContext(fs.readFileSync('dist/assets/'+file,'utf8'),context);
const data=context.window.SST_MEMORY,create=context.window.SSTMemoryModel.create;
assert.equal(data.questions.length,60);assert.equal(new Set(data.questions.map(q=>q.id)).size,60);
assert.deepEqual(Array.from(data.questions,q=>q.number),Array.from({length:60},(_,i)=>i+1));
for(const q of data.questions){assert(q.cue&&q.title&&q.titleZh&&/^\d+$/.test(q.sourceId));assert.equal(q.points.length,6);assert(q.sourcePoints.length>=6&&q.sourcePoints.length<=7);assert(q.points.every(p=>p.en&&p.zh));assert.equal(q.keywords.length,3)}
assert.equal(data.questions.reduce((n,q)=>n+q.sourcePoints.length,0),395);
assert.equal(data.questions.reduce((n,q)=>n+q.points.length,0),360);
for(const q of data.questions){assert.deepEqual(Array.from(q.points.flatMap(p=>p.sourcePointNumbers)),Array.from({length:q.sourcePoints.length},(_,i)=>i+1));for(const p of q.points)assert.equal(p.en,p.sourcePointNumbers.map(n=>q.sourcePoints[n-1].en).join(' '));}
assert.equal(data.questions[0].points[0].en,'All living things are similar.');
let model=create(data);
model.update({draft:'All life is similar.',status:'review'});
model.move(1);assert.equal(model.question().number,2);assert.equal(model.state.stage,0);assert.equal(model.record(model.state.questionId).draft,'');
model.update({draft:'Sunlight makes vitamin D.',status:'remembered'});
model.state.query='4';assert.deepEqual(Array.from(model.filtered(),q=>q.number),[4]);
model.state.query='01';assert.deepEqual(Array.from(model.filtered(),q=>q.number),[1]);
model.state.query='#111013';assert.equal(model.filtered()[0].number,2);
model.state.query='抢老师';assert.equal(model.filtered()[0].number,3);
model.state.query='avoid loss';assert(model.filtered().some(q=>q.number===28));
model.state.query='';model.state.filter='review';assert.equal(model.filtered().length,1);assert.equal(model.filtered()[0].number,1);
model.state.filter='remembered';assert.equal(model.filtered()[0].number,2);
model=create(data,JSON.parse(JSON.stringify(model.state)));
assert.equal(model.record(data.questions[0].id).draft,'All life is similar.');assert.equal(model.record(data.questions[1].id).draft,'Sunlight makes vitamin D.');
assert.equal(model.state.filter,'remembered');assert.equal(model.wordCount('  a\n b   c '),3);
const stale=create(data,{questionId:'unknown',stage:999,filter:'unknown',entries:{unknown:{draft:'discard'},[data.questions[0].id]:{draft:123,status:'invalid'}}});
assert.equal(stale.question().number,1);assert.equal(stale.state.stage,1);assert.equal(stale.state.filter,'all');assert.equal(Object.keys(stale.state.entries).length,1);assert.equal(stale.record(data.questions[0].id).draft,'');
const engine=fs.readFileSync('dist/assets/practice-unified.js','utf8');assert(engine.includes('sstPractice:PTE.sstPracticeState||resumedSession.sstPractice'));
console.log('PASS: 60 SST questions, exactly six points each, 395 source sentences preserved, bilingual/ID search, independent drafts and reload/backup compatibility.');
