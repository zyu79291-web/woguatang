"""Build the small local Cocoa menu-bar helper (no Accessibility or admin permission)."""
from pathlib import Path
import argparse,plistlib,subprocess
ROOT=Path(__file__).resolve().parent

def build(output):
 app=Path(output)/'窝瓜汤专注.app';mac=app/'Contents/MacOS';mac.mkdir(parents=True,exist_ok=True)
 info={'CFBundleIdentifier':'com.woguatang.focus.guard','CFBundleName':'窝瓜汤专注','CFBundleDisplayName':'窝瓜汤专注','CFBundleExecutable':'FocusGuard','CFBundleVersion':'1','CFBundleShortVersionString':'1.0.0','CFBundlePackageType':'APPL','LSUIElement':True,'LSMinimumSystemVersion':'12.0','NSHighResolutionCapable':True}
 (app/'Contents/Info.plist').write_bytes(plistlib.dumps(info))
 subprocess.run(['xcrun','clang','-fobjc-arc','-Wno-incompatible-pointer-types','-Wno-deprecated-declarations',str(ROOT/'native/FocusGuard.m'),'-o',str(mac/'FocusGuard'),'-framework','Cocoa'],check=True)
 subprocess.run(['/usr/bin/codesign','--force','--sign','-',str(app)],check=True,stdout=subprocess.DEVNULL)
 return app
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();print(build(args.output))
