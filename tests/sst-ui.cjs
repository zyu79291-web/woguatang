// Run only in a disposable browser context against an isolated static test server.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
 try{
  const context=await browser.newContext({viewport:{width:1360,height:1000}});
  await context.route('**/api/progress-backup**',r=>r.fulfill({status:r.request().method()==='GET'?404:200,contentType:'application/json',body:'{}'}));
  await context.route('**/api/update-status**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"status":"unchanged"}'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.WOGUATANG_TEST_URL||'http://127.0.0.1:8876')+'/?module=sst');
  await page.locator('#sstPanel').waitFor({state:'visible'});
  assert.equal(await page.locator('#sstList button').count(),60);
  assert.equal(await page.locator('#sstPoints li').count(),6);
  assert.equal(await page.locator('#sstPoints').isVisible(),true);
  assert.equal(await page.locator('#sstReveal,#sstCue,#sstFilter').count(),0);
  await page.locator('.sst-notes summary').click();
  await page.locator('#sstEditor').fill('My saved SST note.');
  await page.locator('#sstNext').click();
  assert.equal(await page.locator('#sstPoints li').count(),6);
  assert.equal(await page.locator('#sstEditor').inputValue(),'');
  await page.locator('#sstPrevious').click();
  await page.reload();await page.locator('#sstPanel').waitFor({state:'visible'});
  assert.equal(await page.locator('#sstEditor').inputValue(),'My saved SST note.');
  await page.locator('#sstSearch').fill('3');
  assert.equal(await page.locator('#sstList button').count(),1);
  assert.equal(await page.locator('#sstPoints li').count(),6);
  assert.match(await page.locator('#sstPoints').innerText(),/donations/);
  await page.locator('#sstSearch').fill('no-topic-xyz');assert.equal(await page.locator('#sstNoResults').isVisible(),true);
  await page.locator('#sstSearch').fill('');
  await page.locator('#weTab').click();assert.equal(await page.locator('#wePanel').isVisible(),true);
  await page.locator('#sstTab').click();assert.equal(await page.locator('#sstPoints').isVisible(),true);
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: direct six-point display, notes survive navigation/reload, search, WE switch and mobile overflow.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
