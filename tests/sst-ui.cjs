const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const baseURL=process.env.WOGUATANG_TEST_URL||'http://127.0.0.1:8876';
const output=path.resolve(process.env.WOGUATANG_TEST_OUTPUT||'/private/tmp/woguatang-sst-ui');
const firstDraft='All life is similar. DNA passes information.';
const secondDraft='Sunlight makes vitamin D. We need it in winter.';
const weDraft='In recent years, this is my separate WE draft.';
const wfdDraft='my separate WFD draft';
fs.mkdirSync(output,{recursive:true});

(async()=>{
 let browser,page;
 const runtimeErrors=[];
 const intercepted={backupGET:0,backupPOST:0,updateStatus:0};
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
  // Never reuse the user's browser profile or let this test write server backups.
  const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true});
  await context.route('**/api/progress-backup**',async route=>{
   const method=route.request().method();
   if(method==='GET'){
    intercepted.backupGET++;
    await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'No test backup'})});
   }else if(method==='POST'){
    intercepted.backupPOST++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({savedAt:new Date().toISOString()})});
   }else await route.fulfill({status:405,body:'Test backup route accepts GET and POST only'});
  });
  await context.route('**/api/update-status**',async route=>{
   intercepted.updateStatus++;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'unchanged'})});
  });
  await context.addInitScript(()=>{
   window.__sstAudioPlayCalls=0;
   const nativePlay=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(...args){
    window.__sstAudioPlayCalls++;
    return nativePlay.apply(this,args);
   };
  });
  page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>runtimeErrors.push(error.stack||error.message));
  const ready=async()=>{
   await page.locator('#sstPanel').waitFor({state:'visible'});
   await page.waitForFunction(()=>typeof PTE!=='undefined'&&PTE.active&&PTE.sstPractice&&PTE.backupProgress);
  };
  const panel=async name=>{
   await page.locator('#'+name+'Panel').waitFor({state:'visible'});
   for(const other of ['sst','we','wfd']){
    assert.equal(await page.locator('#'+other+'Tab').getAttribute('aria-selected'),String(other===name),other+' tab selection');
    assert.equal(await page.locator('#'+other+'Panel').isVisible(),other===name,other+' panel visibility');
   }
  };
  const count=async expected=>{
   await page.waitForFunction(n=>document.querySelectorAll('#sstList [data-sst-select]').length===n,expected);
   assert.equal(await page.locator('#sstList [data-sst-select]').count(),expected);
  };
  const find=async(query,expected,title)=>{
   await page.locator('#sstSearch').fill(query);
   await count(expected);
   if(title)assert.equal(await page.locator('#sstTitle').textContent(),title);
  };
  const noEnglish=async()=>{
   assert.equal(await page.locator('#sstPoints').isVisible(),false,'English points must be hidden');
   assert.equal(await page.locator('#sstPoints').textContent(),'','Hidden points must also leave the DOM');
  };
  const showEnglish=async()=>{
   for(let i=0;i<3&&!await page.locator('#sstPoints').isVisible();i++)await page.locator('#sstReveal').click();
   assert.equal(await page.locator('#sstPoints').isVisible(),true);
   assert((await page.locator('#sstPoints li').count())>=6);
  };

  const entryURL=new URL(baseURL);
  entryURL.searchParams.delete('t');entryURL.searchParams.set('module','sst');
  await page.goto(entryURL.href,{waitUntil:'load'});
  await ready();await panel('sst');await count(60);
  assert.match(await page.locator('#sstCount').textContent(),/60\s*\/\s*60/);
  assert.equal(await page.evaluate(()=>window.__sstAudioPlayCalls),0,'SST entry must not autoplay WFD');
  const firstId=await page.locator('#sstList [data-sst-select]').first().getAttribute('data-sst-select');
  const firstTitle=await page.locator('#sstTitle').textContent();
  assert.match(await page.locator('#sstQuestionNumber').textContent(),/SST 01 \/ 60/);

  // Fresh entry starts with the Chinese cue. The button cycles English -> recall -> Chinese.
  assert.equal(await page.locator('#sstCue').isVisible(),true);await noEnglish();
  await page.locator('#sstReveal').click();
  assert.equal(await page.locator('#sstPoints').isVisible(),true);
  assert((await page.locator('#sstPoints li').count())>=6);
  await page.locator('#sstReveal').click();
  assert.equal(await page.locator('#sstCue').isVisible(),false);
  assert.equal(await page.locator('#sstRecallPrompt').isVisible(),true);await noEnglish();
  await page.locator('#sstReveal').click();
  assert.equal(await page.locator('#sstCue').isVisible(),true);
  assert.equal(await page.locator('#sstRecallPrompt').isVisible(),false);await noEnglish();

  await page.locator('#sstEditor').fill(firstDraft);
  await showEnglish();
  await page.locator('#sstNext').click();await noEnglish();
  assert.equal(await page.locator('#sstCue').isVisible(),false,'Changing question resets to recall');
  const secondId=await page.locator('#sstList [aria-pressed="true"]').getAttribute('data-sst-select');
  const secondTitle=await page.locator('#sstTitle').textContent();
  assert.notEqual(secondId,firstId);
  assert.equal(await page.locator('#sstEditor').inputValue(),'');
  await page.locator('#sstEditor').fill(secondDraft);
  await page.locator('#sstPrevious').click();
  assert.equal(await page.locator('#sstEditor').inputValue(),firstDraft);
  await page.locator('#sstNext').click();
  assert.equal(await page.locator('#sstEditor').inputValue(),secondDraft);

  await find('01',1,firstTitle);
  await find('111013',1,secondTitle);
  await find('抢老师',1,'高校竞争');
  await find('University Competition',1,'高校竞争');
  await find('no-such-SST-topic-xyz987',0);
  assert.equal(await page.locator('#sstCard').isVisible(),false);
  assert.equal(await page.locator('#sstNoResults').isVisible(),true);
  await find('',60);
  assert.equal(await page.locator('#sstCard').isVisible(),true);
  assert.equal(await page.locator('#sstNoResults').isVisible(),false);

  await find('01',1,firstTitle);
  await page.locator('#sstRemembered').click();
  assert.equal(await page.locator('#sstRemembered').getAttribute('aria-pressed'),'true');
  await find('111013',1,secondTitle);
  await page.locator('#sstReview').click();
  assert.equal(await page.locator('#sstReview').getAttribute('aria-pressed'),'true');
  await find('',60);
  await page.locator('#sstFilter').selectOption('remembered');await count(1);
  assert.equal(await page.locator('#sstTitle').textContent(),firstTitle);
  assert.equal(await page.locator('#sstEditor').inputValue(),firstDraft);
  await page.locator('#sstFilter').selectOption('review');await count(1);
  assert.equal(await page.locator('#sstTitle').textContent(),secondTitle);
  assert.equal(await page.locator('#sstEditor').inputValue(),secondDraft);
  await page.locator('#sstFilter').selectOption('all');await count(60);

  // Remove the explicit query before refresh so the saved module must restore SST itself.
  await page.evaluate(()=>history.replaceState(null,'',location.pathname));
  await page.reload({waitUntil:'load'});await ready();await panel('sst');
  assert.equal(await page.locator('#sstTitle').textContent(),secondTitle);
  assert.equal(await page.locator('#sstEditor').inputValue(),secondDraft);
  assert.equal(await page.locator('#sstReview').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>window.__sstAudioPlayCalls),0,'SST refresh must not autoplay WFD');

  await page.locator('#weTab').click();await panel('we');
  await page.locator('#weTypingTab').click();
  await page.locator('#weEditor').fill(weDraft);
  await page.locator('#wfdTab').click();await panel('wfd');
  await page.locator('#typing').waitFor({state:'visible'});
  const wfdKey=await page.evaluate(()=>PTE.active.questionKey);
  await page.locator('#typing').fill(wfdDraft);
  await page.locator('#sstTab').click();await panel('sst');
  assert.equal(await page.locator('#sstEditor').inputValue(),secondDraft);
  const beforeShortcuts=await page.evaluate(()=>window.__sstAudioPlayCalls);
  await page.locator('#sstEditor').focus();
  for(const key of ['Alt+l','Alt+p',"Control+'",'Control+;','Control+Enter','Escape'])await page.keyboard.press(key);
  assert.equal(await page.evaluate(()=>window.__sstAudioPlayCalls),beforeShortcuts,'WFD shortcuts must not play audio in SST');
  assert.equal(await page.locator('#audio').evaluate(audio=>audio.paused),true);
  assert.equal(await page.locator('#loopAudio').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#typing').inputValue(),wfdDraft,'SST shortcuts must preserve the WFD draft');
  assert.equal(await page.locator('#show').getAttribute('aria-pressed'),'false','SST shortcuts must not reveal the WFD answer');
  await panel('sst');
  const secondDraftAfterKeys=await page.locator('#sstEditor').inputValue();
  assert(secondDraftAfterKeys.includes(secondDraft));

  await page.locator('#weTab').click();await panel('we');
  assert.equal(await page.locator('#weEditor').inputValue(),weDraft);
  await page.locator('#wfdTab').click();await panel('wfd');
  assert.equal(await page.locator('#typing').inputValue(),wfdDraft);
  await page.locator('#sstTab').click();await panel('sst');
  await page.reload({waitUntil:'load'});await ready();await panel('sst');
  assert.equal(await page.locator('#sstEditor').inputValue(),secondDraftAfterKeys);

  await page.locator('#practiceStatsOpen').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportProgress').click();
  const download=await downloadPromise;
  const backupPath=path.join(output,'progress-backup.json');
  await download.saveAs(backupPath);
  const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  assert.equal(backup.app,'窝瓜汤');assert.equal(backup.version,1);
  const session=JSON.parse(backup.storage['woguatang-session-v1']);
  assert.equal(session.sstPractice.entries[firstId].draft,firstDraft);
  assert.equal(session.sstPractice.entries[firstId].status,'remembered');
  assert.equal(session.sstPractice.entries[secondId].draft,secondDraftAfterKeys);
  assert.equal(session.sstPractice.entries[secondId].status,'review');
  assert.equal(session.wePractice.view,'sst');
  assert.equal(session.wePractice.units.intro.text,weDraft);
  assert.equal(session.items[wfdKey].st.whole.text,wfdDraft);
  await page.locator('#practiceStatsClose').click();

  for(const width of [1360,390,320]){
   await page.setViewportSize({width,height:1000});
   if(width!==1360){await page.reload({waitUntil:'load'});await ready()}
   await showEnglish();
   await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});
   await page.screenshot({path:path.join(output,'sst-'+width+'.png'),fullPage:true});
   const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert(dimensions.document<=dimensions.viewport+1&&dimensions.body<=dimensions.viewport+1,'Horizontal overflow at '+width+'px: '+JSON.stringify(dimensions));
   assert.equal(await page.evaluate(()=>window.__sstAudioPlayCalls),0,'Responsive reload must not autoplay WFD');
  }
  assert(intercepted.backupGET>0&&intercepted.backupPOST>0,'Backup requests must be intercepted');
  assert.deepEqual(runtimeErrors,[],'Page runtime errors');
  console.log('PASS: SST navigation, 60 questions, three hint stages, search, filters, independent drafts, reload, WE/WFD isolation, audio shortcuts, backup export and 1360/390/320px layouts.');
  console.log('Artifacts: '+output);
 }catch(error){
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
  if(runtimeErrors.length)console.error('Page runtime errors:\n'+runtimeErrors.join('\n'));
  throw error;
 }finally{
  if(browser)await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
