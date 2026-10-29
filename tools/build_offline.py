from pathlib import Path
from urllib.parse import urlsplit
import json,re,base64,zipfile,html,os
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist';OUT=Path(os.environ.get('WOGUATANG_EXPORT_DIR',str(ROOT/'exports')));OUT.mkdir(parents=True,exist_ok=True)

def build():
 data=json.loads((DIST/'summary-preview-data.json').read_text());manifest=json.loads((DIST/'assets/original-audio.json').read_text());allq=data['questions']+data.get('archivedQuestions',[])
 for q in allq:
  q['hasAudio']=q['questionKey'] in manifest
  if not q['hasAudio']:raise ValueError('Missing original audio: '+q['questionKey'])
 (DIST/'assets/original-audio.js').write_text('const ORIGINAL_AUDIO='+json.dumps(manifest)+';')
 sst_path=DIST/'assets/sst-audio.json';sst_manifest=json.loads(sst_path.read_text()) if sst_path.exists() else {}
 if sst_path.exists():(DIST/'assets/sst-audio.js').write_text('window.SST_AUDIO='+json.dumps(sst_manifest,ensure_ascii=False)+';')
 page=(DIST/'index.html').read_text();encoded=json.dumps(data,ensure_ascii=False).replace('</','<\\/')
 page=re.sub(r'(<script type="application/json" id="questionData">).*?(</script>)',lambda m:m[1]+encoded+m[2],page,flags=re.S)
 page=re.sub(r'\d+ 道题均使用已保存的原站整句录音。',f"{len(data['questions'])} 道题均使用已保存的原站整句录音。",page)
 (DIST/'index.html').write_text(page);(DIST/'summary-preview-data.json').write_text(json.dumps(data,ensure_ascii=False))
 standalone=re.sub(r'<link rel="stylesheet" href="./assets/([^"]+)">',lambda m:'<style>'+(DIST/'assets'/urlsplit(m[1]).path).read_text()+'</style>',page)
 standalone=re.sub(r'<script src="./assets/([^"]+)"></script>',lambda m:'<script>'+(DIST/'assets'/urlsplit(m[1]).path).read_text().replace('</script','<\\/script')+'</script>',standalone)
 for url in set(manifest.values())|{entry['url'] for entry in sst_manifest.values()}:standalone=standalone.replace(url,'data:audio/mpeg;base64,'+base64.b64encode((DIST/url.removeprefix('./')).read_bytes()).decode())
 for url,mime in [('./assets/wecom-qr.png','image/png'),('./favicon.svg','image/svg+xml')]:standalone=standalone.replace(url,'data:'+mime+';base64,'+base64.b64encode((DIST/url.removeprefix('./')).read_bytes()).decode())
 target=OUT/'窝瓜汤练习站.html';target.write_text(standalone);(OUT/'本周高频题库-复刻版.html').write_text(standalone)
 with zipfile.ZipFile(OUT/'网站源码.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in ROOT.rglob('*'):
   if OUT.resolve().is_relative_to(ROOT.resolve()) and p.resolve().is_relative_to(OUT.resolve()):continue
   if p.is_file() and not any(x in p.parts for x in ['.git','__pycache__','runtime']):z.write(p,'窝瓜汤/'+str(p.relative_to(ROOT)))
  z.write(target,target.name)
 return len(data['questions'])
if __name__=='__main__':print('Built',build(),'questions with original recordings.')
