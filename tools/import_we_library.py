"""Import the user's structured WE document without rewriting its text.
Usage: python3 tools/import_we_library.py /path/to/source.docx
The original DOCX and all personal practice records stay outside the repository.
"""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import sys,re,json,hashlib

# Curated concept links. These are navigation groupings, not claims that sentences are interchangeable.
GROUPS=[
 ('jobs','增加工作机会','通过行业发展、语言能力或工作安排，解释就业机会如何增加。','13.1 32.1 33.2 36.1 37.1'),
 ('knowledge','获取信息与学习新知','围绕信息、学习资源和知识获取展开；保留各题具体渠道。','2.1 11.1 14.1 20.1 30.1'),
 ('misinformation','错误信息影响判断','信息未经核实传播，可能使人形成错误观点。','2.2 20.2'),
 ('personal-time','工作挤占私人生活','工作负担和长工时压缩休息与家庭时间。','3.1 8.2 22.2'),
 ('balance','调整安排以实现平衡','通过灵活安排或缩短工时，为休息、家庭或学习留出时间。','3.2 12.1 31.2'),
 ('family','陪伴家人与家庭关系','讨论相处时间如何影响家庭生活；正反方向按题目调整。','3.1 6.1 8.2 31.2'),
 ('health','身体健康与充分休息','讨论居住、医疗、工时或屏幕使用对健康的影响。','6.2 7.2 8.1 11.2 22.1'),
 ('mental-health','心理健康与缓解压力','围绕压力、休息、孤独感和心理状态展开。','8.1 14.2 15.2 22.1 35.1'),
 ('efficiency','工作效率与时间成本','解释环境、技术或决策方式如何改变完成任务所需的时间。','7.1 23.2 30.2 31.1'),
 ('practice','实践培养实用技能','真实场景中的练习，帮助培养沟通、合作或解决问题的能力。','12.2 17.2 24.1 24.2 26.1'),
 ('culture','理解历史与文化','通过戏剧或实地参观，了解过去的生活和文化。','10.2 17.1'),
 ('language','语言理解与沟通障碍','语言表达难懂或翻译不准，可能影响理解。','10.1 37.2'),
 ('access','资源可及性与平等机会','让无力承担额外费用的人也能获得学习或出行机会。','18.1 33.1 36.2'),
 ('fairness','公平评估与合理回报','围绕公平对待不同人展开，需使用该题的评估或报酬情境。','1.1 16.2'),
 ('time-management','时间管理与守时习惯','通过期限、任务或规划，培养更好的时间安排习惯。','5.1 5.2 12.1'),
 ('rules','规则约束与责任意识','教育、年龄要求或法律后果，帮助人们遵守规则、承担责任。','4.1 4.2 25.2 29.1'),
 ('climate-risk','海平面上升与洪水风险','洪水损害沿海住房或农田，居民可能被迫迁离。','9.1 27.1'),
 ('environment-policy','环保政策与清洁能源','通过政府资金、法规或清洁技术减少污染。','9.2 19.1 19.2 29.2'),
 ('pollution','减少污染与环境损害','从游客垃圾、交通方式或企业排放讨论环境后果。','13.2 18.2 19.2 29.2'),
 ('convenience','生活便利与节省时间','通过集中购物或公共交通，让日常活动更方便。','18.1 21.1 36.2'),
 ('income','收入与利润减少','收入或利润受损；企业和劳动者的具体机制应分别说明。','21.2 28.2 32.2'),
 ('screen-risk','屏幕与社交媒体的负面影响','长时间使用屏幕或社交媒体，影响健康、睡眠或学习。','11.2 25.1 35.2'),
 ('tourism','旅游带动本地经济','游客消费带动酒店、餐饮或商店发展。','13.1 34.1'),
 ('knowledge-check','独立作答检查所学知识','通过学生独立完成试题，判断知识掌握程度。','1.2'),
 ('privacy','隐私权与个人安全','名人的个人隐私同样值得保护。','15.1'),
 ('motivation','工作动力与创新','报酬激励影响努力工作、学习技能和创新的意愿。','16.1'),
 ('frontline','一线经验改善产品与服务','接触实际工作和顾客的员工能够提出实用建议。','23.1'),
 ('independence','独立决策与应对新情况','独立经历帮助人们安排生活和处理意外问题。','26.2'),
 ('research','研究帮助风险应对','研究结果帮助确定高风险地区并改善防护措施。','27.2'),
 ('trust','品牌信誉与顾客信任','可靠的产品与服务建立信任，带来回购和推荐。','28.1'),
 ('budget','公共资金的优先分配','预算有限时，过多修复支出可能挤占住房与基础设施资金。','34.2'),
]

def extract(path):
 ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 with ZipFile(path) as z:root=ET.fromstring(z.read('word/document.xml'))
 paragraphs=[]
 for p in root.findall('w:body/w:p',ns):
  text=''.join(t.text or '' for t in p.findall('.//w:t',ns))
  if text.strip():
   style=p.find('w:pPr/w:pStyle',ns)
   paragraphs.append((style.get('{'+ns['w']+'}val','') if style is not None else '',text))
 starts=[i for i,(style,text) in enumerate(paragraphs) if style=='Heading1' and re.match(r'^\d{2}\. ',text)]
 essays=[]
 for a,b in zip(starts,starts[1:]+[len(paragraphs)]):
  lines=[t for _,t in paragraphs[a:b]];full=lines.index('完整作文');first=next(i for i,t in enumerate(lines) if t.startswith('观点一：'));second=next(i for i,t in enumerate(lines) if t.startswith('观点二：'))
  number=int(lines[0][:2]);title,title_zh=lines[0].split('. ',1)[1].split(' — ',1)
  points=[{'id':f'{number}.{j+1}','title':lines[k].split('：',1)[1],'sentences':lines[k+1:end],'groups':[]} for j,(k,end) in enumerate([(first,second),(second,full)])]
  essay={'id':f'we-{number:02}','number':number,'title':title,'titleZh':title_zh,'prompt':lines[1].removeprefix('原题：'),'stanceZh':lines[3].removeprefix('个人立场：'),'stance':lines[4],'points':points,'essay':lines[full+1:]}
  assert len(essay['essay'])==4 and all(len(p['sentences'])==3 for p in points),f'Unexpected source structure: {number}'
  essays.append(essay)
 assert [e['number'] for e in essays]==list(range(1,38)),'Expected all 37 essays in source order'
 by_point={p['id']:p for e in essays for p in e['points']};groups=[]
 for gid,title,description,refs in GROUPS:
  ids=refs.split();assert all(i in by_point for i in ids)
  groups.append({'id':gid,'title':title,'description':description,'pointIds':ids})
  for point_id in ids:by_point[point_id]['groups'].append(gid)
 assert all(p['groups'] for p in by_point.values()),'Every source point needs a reverse link'
 return {'v':1,'source':{'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'note':paragraphs[2][1]},'essays':essays,'groups':groups}

if __name__=='__main__':
 source=Path(sys.argv[1]);data=extract(source)
 out=Path(__file__).resolve().parents[1]/'dist/assets/we-library-data.js'
 out.write_text('// Source text is preserved; concept groups are curated navigation aids.\nwindow.WE_LIBRARY='+json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+';\n')
 print(f"Imported {len(data['essays'])} essays, 74 original points, {len(data['groups'])} concept groups.")
