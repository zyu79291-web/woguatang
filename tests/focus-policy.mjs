import assert from 'node:assert/strict';
import {isAllowed,isPractice,RULES} from '../focus/extension/policy.mjs';
const origin='chrome-extension://dgogpmdnbededpohjpmnafhpjpdmeead/';
const allowed=['http://localhost:8765/','http://localhost:8765/?check=daily-record','http://127.0.0.1:8765/','https://chatgpt.com/c/abc','https://chatgpt.com:443/','https://www.ptexj.com/pte/user_center/home?type=home','https://ptexj.com/pte/','chrome-extension://dgogpmdnbededpohjpmnafhpjpdmeead/focus.html'];
const blocked=['https://example.com/','https://chatgpt.com.evil.com/','https://chatgpt.com@evil.com/','https://evil.com@chatgpt.com/','http://chatgpt.com/','http://localhost:8766/','https://ptexj.com:8443/','https://evil.ptexj.com/','file:///tmp/a','data:text/html,hello','about:blank','chrome://settings','chrome-extension://other-id/popup.html'];
for(const url of allowed)assert(isAllowed(url,origin),url);
for(const url of blocked)assert(!isAllowed(url,origin),url);
function blockedByRules(url){let match=RULES.filter(r=>new RegExp(r.condition.regexFilter).test(url)).sort((a,b)=>b.priority-a.priority)[0];return match?.action.type==='block'}
for(const url of allowed.filter(u=>u.startsWith('http')))assert(!blockedByRules(url),url);
for(const url of blocked.filter(u=>u.startsWith('http')))assert(blockedByRules(url),url);
assert(!isPractice('https://chatgpt.com/'));assert(!isPractice('http://localhost:8765@evil.com/'));
assert(RULES.every(r=>r.condition.resourceTypes.length===1&&r.condition.resourceTypes[0]==='main_frame'));
console.log('PASS: allowed domains, ports, URL credential tricks, existing internal tabs and main-frame-only rules.');
