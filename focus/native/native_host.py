#!/usr/bin/env python3
"""Chrome native host: fixed focus commands only; no webpage text or commands accepted."""
from pathlib import Path
import atexit,fcntl,json,os,signal,struct,subprocess,sys,threading,time
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT.parent/'runtime'/'focus'
STATE=RUNTIME/'state.json';READY=RUNTIME/'helper.json'
EXPECTED='chrome-extension://'+(ROOT/'extension-id.txt').read_text().strip()+'/'
SEND_LOCK=threading.Lock();STATE_LOCK=threading.Lock();running=True

def read_state():
 try:return json.loads(STATE.read_text())
 except (OSError,ValueError):return {'enabled':False}

def write_state(enabled,reason=''):
 RUNTIME.mkdir(parents=True,exist_ok=True)
 with STATE_LOCK:
  payload={'enabled':bool(enabled),'updatedAt':time.time(),'expiresAt':time.time()+30 if enabled else 0,'reason':reason}
  temp=STATE.with_suffix('.host.tmp');temp.write_text(json.dumps(payload,ensure_ascii=False));temp.replace(STATE)
 return payload

def send(message):
 data=json.dumps(message,ensure_ascii=False).encode('utf-8')
 with SEND_LOCK:sys.stdout.buffer.write(struct.pack('=I',len(data))+data);sys.stdout.buffer.flush()

def receive(stream):
 header=stream.read(4)
 if not header:return None
 if len(header)!=4:raise ValueError('incomplete frame')
 length=struct.unpack('=I',header)[0]
 if not 0<length<65536:raise ValueError('invalid frame length')
 payload=stream.read(length)
 if len(payload)!=length:raise ValueError('incomplete message')
 message=json.loads(payload)
 if not isinstance(message,dict):raise ValueError('invalid message')
 return message

def helper_running():
 try:
  record=json.loads(READY.read_text());pid=int(record.get('pid',0))
  if pid<=0 or time.time()-record.get('updatedAt',0)>5:return False
  os.kill(pid,0);return True
 except (OSError,ValueError,TypeError):return False

def ensure_helper():
 if helper_running():return
 subprocess.run(['/usr/bin/open','-gj',str(ROOT/'窝瓜汤专注.app')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
 until=time.time()+4
 while time.time()<until:
  if helper_running():return
  time.sleep(.1)
 raise RuntimeError('本机专注组件未启动，请打开“窝瓜汤专注.app”后再试')

def heartbeat():
 previous=False
 while running:
  RUNTIME.mkdir(parents=True,exist_ok=True)
  beat=RUNTIME/'heartbeat.json';temp=beat.with_suffix('.tmp');temp.write_text(json.dumps({'pid':os.getpid(),'updatedAt':time.time()}));temp.replace(beat)
  state=read_state();current=bool(state.get('enabled'))
  if current:
   if not helper_running():state=write_state(False,'本机组件已退出，专注已自动结束');current=False
  if current!=previous:
   try:send({'type':'state','enabled':current,'reason':state.get('reason','')})
   except (BrokenPipeError,OSError):break
   previous=current
  time.sleep(1)

def main():
 global running
 if len(sys.argv)<2 or sys.argv[1]!=EXPECTED:return 1
 RUNTIME.mkdir(parents=True,exist_ok=True)
 with (RUNTIME/'host.lock').open('a') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:
   send({'error':'另一个 Chrome 配置正在使用专注组件，请先结束其专注模式'});return 1
  write_state(False)
  atexit.register(lambda:write_state(False,'浏览器已断开，专注已结束'))
  signal.signal(signal.SIGTERM,lambda *_:sys.exit(0))
  thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
  try:
   while True:
    message=receive(sys.stdin.buffer)
    if message is None:break
    ident=message.get('id');action=message.get('type')
    try:
     if action=='status':state=read_state()
     elif action=='set' and isinstance(message.get('enabled'),bool):
      if message['enabled']:ensure_helper()
      state=write_state(message['enabled'])
     else:raise ValueError('不支持的专注操作')
     send({'id':ident,'enabled':bool(state.get('enabled')),'nativeReady':True})
    except Exception as error:send({'id':ident,'error':str(error)})
  finally:running=False;write_state(False,'浏览器已断开，专注已结束')
 return 0
if __name__=='__main__':sys.exit(main())
