#!/bin/zsh
# Install and start the per-user launchd service. Do not tie its lifetime to a terminal or chat.
set -eu
app_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
plist_path="$HOME/Library/LaunchAgents/com.woguatang.practice.plist"
user_domain="gui/$(id -u)"
python_bin='/Library/Frameworks/Python.framework/Versions/3.13/bin/python3'
if [[ ! -x "$python_bin" ]]; then python_bin="$(command -v python3)"; fi
mkdir -p "$app_root/runtime" "$(dirname -- "$plist_path")"
"$python_bin" - "$app_root" "$plist_path" "$python_bin" <<'PY'
from pathlib import Path
import plistlib,sys
root=Path(sys.argv[1]);target=Path(sys.argv[2]);python=sys.argv[3]
config={'Label':'com.woguatang.practice','ProgramArguments':[python,str(root/'tools/service.py')],'WorkingDirectory':str(root),'EnvironmentVariables':{'WOGUATANG_EXPORT_DIR':str(root/'exports')},'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':10,'ProcessType':'Background','StandardOutPath':str(root/'runtime/service.log'),'StandardErrorPath':str(root/'runtime/service-error.log')}
temp=target.with_suffix('.plist.tmp');temp.write_bytes(plistlib.dumps(config));temp.chmod(0o644);temp.replace(target)
PY
/bin/launchctl enable "$user_domain/com.woguatang.practice"
if ! /bin/launchctl print "$user_domain/com.woguatang.practice" >/dev/null 2>&1; then
  if ! /bin/launchctl bootstrap "$user_domain" "$plist_path"; then
    print -u2 '窝瓜汤自动启动项加载失败。请保留此窗口中的错误信息；尚未完成修复。'
    exit 1
  fi
fi
# Retire only the temporary recovery server recorded by this repair, after launchd is registered.
"$python_bin" - "$app_root" <<'PY_STOP'
from pathlib import Path
import json,os,signal,subprocess,sys
root=Path(sys.argv[1]);marker=root/'runtime/temporary-recovery-service.json'
if marker.exists():
 try:
  record=json.loads(marker.read_text());pid=int(record['pid'])
  command=subprocess.run(['/bin/ps','-p',str(pid),'-o','command='],capture_output=True,text=True).stdout.strip()
  parent=subprocess.run(['/bin/ps','-p',str(pid),'-o','ppid='],capture_output=True,text=True).stdout.strip()
  if pid>1 and str(root/'tools/service.py') in command and parent and parent!='1':os.kill(pid,signal.SIGTERM)
 except (OSError,ValueError,KeyError):pass
 marker.unlink(missing_ok=True)
PY_STOP
/bin/launchctl kickstart "$user_domain/com.woguatang.practice" || true
for attempt in {1..45}; do
  job_pid="$(/bin/launchctl print "$user_domain/com.woguatang.practice" 2>/dev/null | /usr/bin/awk '/^[[:space:]]*pid =/{print $3;exit}')"
  server_pid="$(/usr/sbin/lsof -nP -t -iTCP:8765 -sTCP:LISTEN 2>/dev/null | /usr/bin/head -1 || true)"
  if [[ -n "$job_pid" && "$job_pid" == "$server_pid" ]] && /usr/bin/curl --silent --fail --max-time 1 http://localhost:8765/api/update-status >/dev/null; then
    print '窝瓜汤已启动：http://localhost:8765/'
    print '已启用：登录自动启动、服务停止后自动重启。关闭此终端不会停止网站。'
    /bin/launchctl print "$user_domain/com.woguatang.practice" | /usr/bin/sed -n '/state =/p;/pid =/p'
    /usr/bin/open 'http://localhost:8765/'
    exit 0
  fi
  /bin/sleep 1
done
print -u2 '自动启动项已加载，但网站还未就绪。错误日志：'
print -u2 "$app_root/runtime/service-error.log"
exit 1
