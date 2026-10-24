"""Incremental update using the original site's normal public whole-sentence playback API."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import subprocess,json,time,urllib.parse,hashlib,shutil,os,tempfile,fcntl
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist';RUNTIME=ROOT/'runtime';RUNTIME.mkdir(exist_ok=True)
STATE=RUNTIME/'sync-state.json';ORIGIN='https://pte3000.com';TZ=timezone(timedelta(hours=8));cookie=''
def now():return datetime.now(TZ).isoformat()
def day():return datetime.now(TZ).date().isoformat()
def read_state():
 try:return json.loads(STATE.read_text())
 except (OSError,ValueError):return {}
def atomic(path,data):
 temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(path)
def update_status(**fields):
 state=read_state();state.update(fields);atomic(STATE,state);return state
def request(path,body=None):
 global cookie
 url=urllib.parse.urljoin(ORIGIN,path);u=urllib.parse.urlsplit(url)
 if u.scheme!='https' or u.hostname!='pte3000.com':raise ValueError('Unexpected source URL')
 cfg=['silent','show-error','include','max-time = 45','url = '+json.dumps(url),'header = "Origin: https://pte3000.com"','header = "Referer: https://pte3000.com/"']
 if cookie:cfg.append('cookie = '+json.dumps(cookie))
 if body is not None:cfg+=['header = "Content-Type: application/json"','data = '+json.dumps(json.dumps(body))]
 r=subprocess.run(['curl','--config','-'],input=('\n'.join(cfg)+'\n').encode(),capture_output=True)
 if r.returncode:raise RuntimeError('无法连接原站，请联网后重试')
 data=r.stdout;headers={};status=0
 while data.startswith(b'HTTP/'):
  head,sep,data=data.partition(b'\r\n\r\n')
  if not sep:raise RuntimeError('原站响应不完整')
  lines=head.decode(errors='replace').splitlines();status=int(lines[0].split()[1]);headers={}
  for line in lines[1:]:
   if ':' not in line:continue
   key,value=line.split(':',1);headers[key.lower()]=value.strip()
   if key.lower()=='set-cookie':cookie=value.strip().split(';',1)[0]
 return status,headers,data
def ticket(qid):
 for attempt in range(4):
  status,headers,body=request('/api/public/whole-ticket',{'question_id':str(qid),'signals':[]});data=json.loads(body)
  if data.get('error')=='rate_limited' or status==429:
   retry=headers.get('retry-after','300');wait=max(65,int(retry)) if retry.isdigit() else 300
   update_status(status='waiting',message=f'原站要求等待 {wait} 秒后继续同步');time.sleep(wait);continue
  if status!=200 or not data.get('url'):raise RuntimeError('原站暂未提供题目 '+str(qid)+' 的整句录音')
  return data['url']
 raise RuntimeError('原站频率限制，稍后自动重试')
def validate(path):
 if path.stat().st_size<1000:raise RuntimeError('原版录音文件不完整')
 if shutil.which('afinfo') and subprocess.run(['afinfo',str(path)],capture_output=True).returncode:raise RuntimeError('原版录音校验失败')
def _sync_body(force=False):
 state=read_state()
 if not force and state.get('lastSuccessfulDay')==day():return {'status':'unchanged','reason':'already-checked-today','questions':state.get('questionCount')}
 update_status(status='checking',message='正在检查原站更新',checkedAt=now())
 try:
  status,_,body=request('/summary-preview-data.json')
  if status!=200:raise RuntimeError('原站题库暂不可用')
  incoming=json.loads(body);questions=incoming.get('questions')
  if not isinstance(questions,list) or not questions:raise RuntimeError('原站题库数据为空，保留现有题库')
  required=['questionKey','questionId','sentence','translation'];seen=set()
  for q in questions:
   if not all(k in q for k in required) or q['questionKey'] in seen:raise RuntimeError('原站题库结构有变化，保留现有题库')
   if not str(q['questionId']).isdigit() or q['questionKey']!='wfd-'+str(q['questionId']):raise RuntimeError('原站题目编号格式变化，保留现有题库')
   seen.add(q['questionKey'])
  old=json.loads((DIST/'summary-preview-data.json').read_text());previous={q['questionKey']:q for q in old['questions']+old.get('archivedQuestions',[])};manifest=json.loads((DIST/'assets/original-audio.json').read_text());media=state.get('mediaIds',{})
  added=downloaded=0
  # Keep verified originals for unchanged sentences; fetch only new or changed questions.
  for q in questions:
   key=q['questionKey'];existing=previous.get(key);changed=not existing or existing.get('sentence')!=q['sentence'];need=key not in manifest or changed
   if not need:continue
   if not existing:added+=1
   update_status(status='downloading',message='正在同步新增原版录音',progress={'completed':downloaded,'questionId':q['questionId']})
   url=ticket(q['questionId']);mid=urllib.parse.urlsplit(url).path
   status,headers,audio=request(url)
   if status!=200:raise RuntimeError('原版录音下载未完成，保留现有题库')
   digest=hashlib.sha256(audio).hexdigest();name='original-'+key+'-'+digest[:10]+'.mp3';path=DIST/'assets'/name
   path.write_bytes(audio);validate(path);manifest[key]='./assets/'+name;media[key]=mid;downloaded+=1;time.sleep(4.5)
  incoming['archivedQuestions']=[q for key,q in previous.items() if key not in seen]
  # Commit only after every required recording is present. Never clear browser practice storage.
  for q in questions:
   if q['questionKey'] not in manifest:raise RuntimeError('新题原版录音尚未补齐')
  atomic(DIST/'assets/original-audio.json',manifest);atomic(DIST/'summary-preview-data.json',incoming)
  from build_offline import build
  build()
  result=update_status(status='ready',message='今日已检查',lastSuccessfulDay=day(),completedAt=now(),sourceSyncedAt=incoming.get('syncedAt'),sourceVersion=incoming.get('accessVersion'),questionCount=len(questions),progress=None,added=added,downloaded=downloaded,mediaIds=media)
  return {k:result.get(k) for k in ['status','questionCount','added','downloaded','lastSuccessfulDay']}
 except Exception as e:
  update_status(status='error',message=str(e),failedAt=now());raise
def sync(force=False):
 with (RUNTIME/'sync.lock').open('a') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:return {'status':'busy'}
  try:return _sync_body(force)
  finally:fcntl.flock(lock,fcntl.LOCK_UN)
if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--force',action='store_true');args=p.parse_args();print(json.dumps(sync(args.force),ensure_ascii=False))
