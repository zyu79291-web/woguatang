"""Versioned local-only progress copies, independent of daily bank updates."""
from pathlib import Path
from datetime import datetime,timezone
import json,re,threading,hashlib
ROOT=Path(__file__).resolve().parents[1]/'runtime'/'progress'
KEYS={'pte:summary-preview:v1','pte-wfd-wrongbook-v1','pte-daily-practice-v1','woguatang-session-v1','pte-wfd-review-session-v1','woguatang-progress-import-v1'}
LOCK=threading.Lock()
def validate(data):
 if not isinstance(data,dict) or data.get('version')!=1 or data.get('app')!='窝瓜汤':raise ValueError('备份格式不正确')
 device=data.get('device','')
 if not re.fullmatch(r'[a-zA-Z0-9-]{1,64}',device):raise ValueError('无效的设备编号')
 storage=data.get('storage')
 if not isinstance(storage,dict) or not storage or set(storage)-KEYS:raise ValueError('无效的练习记录')
 for key,value in storage.items():
  if not isinstance(value,str) or len(value)>1500000:raise ValueError('无效的练习记录')
  if key!='woguatang-progress-import-v1' and not isinstance(json.loads(value),dict):raise ValueError('无效的练习记录')
 return device,storage

def atomic(path,value):
 temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8');temp.replace(path)
def save(data):
 device,storage=validate(data);stamp=datetime.now(timezone.utc);digest=hashlib.sha256(json.dumps(storage,sort_keys=True).encode()).hexdigest()
 with LOCK:
  folder=ROOT/device;folder.mkdir(parents=True,exist_ok=True);latest=folder/'latest.json'
  if latest.exists():
   old=json.loads(latest.read_text())
   if old.get('digest')==digest:return old
  payload={'version':1,'app':'窝瓜汤','savedAt':stamp.isoformat(),'storage':storage,'device':device,'digest':digest}
  atomic(latest,payload)
  atomic(folder/('day-'+stamp.astimezone().strftime('%Y-%m-%d')+'.json'),payload)
  # One history file per minute, plus one daily copy. Keep a bounded history.
  atomic(folder/('snapshot-'+stamp.strftime('%Y%m%dT%H%M')+'.json'),payload)
  for prefix,keep in [('snapshot-',100),('day-',32)]:
   for p in sorted(folder.glob(prefix+'*.json'),reverse=True)[keep:]:p.unlink()
  return payload

def load(device=None):
 with LOCK:
  if device and re.fullmatch(r'[a-zA-Z0-9-]{1,64}',device):
   p=ROOT/device/'latest.json'
   if p.exists():return json.loads(p.read_text())
  files=list(ROOT.glob('*/latest.json'))
  if not files:return None
  return json.loads(max(files,key=lambda p:p.stat().st_mtime_ns).read_text())
