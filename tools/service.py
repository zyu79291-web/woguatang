"""Local-only practice server. Checks once per day after login/wake; retries when offline."""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from datetime import datetime
import threading,time,json,os,signal
from urllib.parse import urlsplit,parse_qs
import progress_store
from sync_bank import sync,read_state,day,update_status
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist';EXPORT=Path(os.environ.setdefault('WOGUATANG_EXPORT_DIR',str(ROOT/'exports')))
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(DIST),**kw)
 def trusted(self):
  return self.headers.get('Host','').split(':')[0] in ['localhost','127.0.0.1'] and self.headers.get('Origin','http://127.0.0.1:8765') in ['http://localhost:8765','http://127.0.0.1:8765']
 def json_response(self,data,status=200):
  body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
 def do_POST(self):
  if self.path!='/api/progress-backup' or not self.trusted():self.send_error(403);return
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<2000000 or self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('无效的备份请求')
   result=progress_store.save(json.loads(self.rfile.read(size)));self.json_response({'savedAt':result['savedAt']})
  except (ValueError,TypeError):self.json_response({'error':'备份格式不正确'},400)
 def do_GET(self):
  if not self.trusted():self.send_error(403);return
  if self.path.split('?',1)[0]=='/api/progress-backup':
   data=progress_store.load(parse_qs(urlsplit(self.path).query).get('device',[None])[0]);self.json_response(data or {'error':'暂无本机备份'},200 if data else 404);return
  if self.path.split('?',1)[0]=='/api/update-status':
   s=read_state();payload={k:s.get(k) for k in ['status','message','questionCount','sourceSyncedAt','lastSuccessfulDay','completedAt']};data=json.dumps(payload,ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data);return
  if self.path.split('?',1)[0]=='/offline':
   p=EXPORT/'窝瓜汤练习站.html'
   if not p.exists():self.send_error(404);return
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(p.stat().st_size));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(p.read_bytes());return
  return super().do_GET()
 def end_headers(self):self.send_header('Cache-Control','no-cache');super().end_headers()
 def log_message(self,*args):pass

def updater():
 while True:
  if read_state().get('lastSuccessfulDay')!=day():
   try:print(json.dumps(sync(),ensure_ascii=False),flush=True)
   except Exception as e:print('同步暂未完成：'+str(e),flush=True)
   # Avoid repeated requests immediately after a failed or rate-limited run.
   time.sleep(900 if read_state().get('status')=='error' else 60)
  else:time.sleep(60)
if __name__=='__main__':
 server=ThreadingHTTPServer(('127.0.0.1',8765),Handler);threading.Thread(target=updater,daemon=True).start();print('窝瓜汤已启动：http://127.0.0.1:8765/',flush=True);server.serve_forever()
