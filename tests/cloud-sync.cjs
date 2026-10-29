const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('dist/assets/cloud-sync-model.js','utf8'),c);const M=c.window.WoguatangSyncModel;
const state='pte:summary-preview:v1',daily='pte-daily-practice-v1',session='woguatang-session-v1';
const storage={[state]:JSON.stringify({a:{favorite:true,practiceRounds:5}}),[daily]:JSON.stringify({v:1,days:{'2026-10-29':{milliseconds:60000,attempts:3,questionKeys:['a']}}}),[session]:JSON.stringify({v:1,items:{},sstPractice:{entries:{a:{draft:'old'}}}})};
const base=M.observe(storage,null,'mac',100),a=JSON.parse(JSON.stringify(storage)),b=JSON.parse(JSON.stringify(storage));
a[state]=JSON.stringify({a:{favorite:false,practiceRounds:7},b:{practiced:true,practiceRounds:1}});b[state]=JSON.stringify({a:{favorite:true,practiceRounds:6},c:{practiced:true,practiceRounds:1}});
a[daily]=JSON.stringify({v:1,days:{'2026-10-29':{milliseconds:90000,attempts:5,questionKeys:['a','b']}}});b[daily]=JSON.stringify({v:1,days:{'2026-10-29':{milliseconds:80000,attempts:4,questionKeys:['a','c']}}});
a[session]=JSON.stringify({v:1,items:{},sstPractice:{entries:{a:{draft:'mac'},b:{draft:'keep mac'}}}});b[session]=JSON.stringify({v:1,items:{},sstPractice:{entries:{a:{draft:'ipad'},c:{draft:'keep ipad'}}}});
const A=M.observe(a,base,'mac',200),B=M.observe(b,base,'ipad',300),merged=M.merge(A,B),out=M.materialize(merged),states=JSON.parse(out[state]),d=JSON.parse(out[daily]).days['2026-10-29'],s=JSON.parse(out[session]);
assert.equal(states.a.practiceRounds,8);assert.equal(states.a.favorite,false);assert(states.b.practiced&&states.c.practiced);assert.equal(d.milliseconds,110000);assert.equal(d.attempts,6);assert.deepEqual(d.questionKeys,['a','b','c']);assert.equal(s.sstPractice.entries.a.draft,'ipad');assert.equal(s.sstPractice.entries.b.draft,'keep mac');assert.equal(s.sstPractice.entries.c.draft,'keep ipad');
assert(M.same(M.materialize(M.merge(A,B)),M.materialize(M.merge(B,A))));assert(M.same(M.materialize(M.merge(merged,merged)),out));assert(M.same(M.materialize(M.observe(out,merged,'mac',400)),out));
// Rejoining/importing historical counters takes the maximum baseline, without counting history twice.
assert.equal(JSON.parse(M.materialize(M.merge(base,M.observe(storage,null,'ipad',101)))[state]).a.practiceRounds,5);
// Clearing a field creates a tombstone, preventing stale devices from resurrecting it.
const cleared=M.observe({},base,'mac',500);assert.equal(JSON.parse(M.materialize(M.merge(base,cleared))[state]||'{}').a?.favorite,undefined);
console.log('PASS: independent devices merge rounds, daily time, completed questions, favorite removals, independent drafts, conflicts, old imports and idempotent retries.');
