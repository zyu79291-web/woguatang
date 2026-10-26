"""Install only this user's optional focus helper and Chrome native-host registration."""
from pathlib import Path
import argparse,json,os,shlex,shutil,sys
ROOT=Path(__file__).resolve().parent

def install(target):
 target=Path(target);sourceApp=ROOT/'窝瓜汤专注.app'
 if not sourceApp.exists():
  from build import build
  sourceApp=build(ROOT)
 target.mkdir(parents=True,exist_ok=True)
 for name in ['extension','native','extension-id.txt','窝瓜汤专注.app']:
  src=ROOT/name;dst=target/name
  if src.resolve()==dst.resolve():continue
  if src.is_dir():shutil.copytree(src,dst,dirs_exist_ok=True)
  else:shutil.copyfile(src,dst)
 launcher=target/'native/launch-host';launcher.write_text('#!/bin/sh\nexec '+shlex.quote(sys.executable)+' '+shlex.quote(str(target/'native/native_host.py'))+' "$@"\n');launcher.chmod(0o755)
 host=Path.home()/'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.woguatang.focus.json';host.parent.mkdir(parents=True,exist_ok=True)
 ident=(target/'extension-id.txt').read_text().strip();host.write_text(json.dumps({'name':'com.woguatang.focus','description':'窝瓜汤专注开关（仅本机）','path':str(launcher),'type':'stdio','allowed_origins':['chrome-extension://'+ident+'/']},ensure_ascii=False,indent=2))
 print('本机组件已安装，默认关闭。请在 Chrome 加载此扩展文件夹：\n'+str(target/'extension'))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--destination',default=str(Path.home()/'Library/Application Support/Woguatang/focus'));args=p.parse_args();install(args.destination)
