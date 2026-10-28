"""Import the user's bilingual SST short sentences without rewriting them."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
# Join two related source sentences when the document lists seven details.
# The complete source sentences remain available for lossless verification.
JOIN = {3:5,6:1,7:5,9:6,10:1,11:5,12:1,14:4,15:3,16:1,18:3,
        19:2,21:6,22:1,24:4,25:2,26:4,27:2,29:4,30:3,31:5,32:4,
        33:5,35:6,38:4,41:1,42:3,43:1,46:1,51:3,54:2,55:2,57:5,
        58:5,60:1}


def extract(path):
    text = path.read_text()
    cues = json.loads((ROOT / 'tools/sst-memory-cues.json').read_text())
    sections = re.split(r'^## (\d+)\. (.+?)｜(.+?)｜#(\d+)\s*$', text, flags=re.M)
    questions = []
    for at in range(1, len(sections), 5):
        number, title, title_zh, source_id, body = sections[at:at + 5]
        points = re.findall(r'^\d+\. \*\*(.+?)\*\* — (.+)$', body, flags=re.M)
        assert 6 <= len(points) <= 7, f'Unexpected sentence count: {number}'
        source_points = [{'en': en.strip(), 'zh': zh.strip()} for en, zh in points]
        display_points = [dict(p, sourcePointNumbers=[i+1]) for i,p in enumerate(source_points)]
        if len(display_points) == 7:
            index = JOIN[int(number)] - 1
            left, right = display_points[index:index+2]
            display_points[index:index+2] = [{'en': left['en']+' '+right['en'],
                'zh': left['zh']+'；'+right['zh'],
                'sourcePointNumbers': left['sourcePointNumbers']+right['sourcePointNumbers']}]
        assert len(display_points) == 6
        questions.append({
            'id': 'sst-' + source_id, 'number': int(number), 'sourceId': source_id,
            'title': title.strip(), 'titleZh': title_zh.strip(),
            **cues[source_id],
            'sourcePoints': source_points, 'points': display_points,
        })
    assert [q['number'] for q in questions] == list(range(1, 61))
    assert len({q['id'] for q in questions}) == 60
    return {'version': 3, 'source': {'filename': path.name,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}, 'questions': questions}


if __name__ == '__main__':
    data = extract(Path(sys.argv[1]))
    (ROOT / 'dist/assets/sst-memory-data.js').write_text(
        'window.SST_MEMORY = ' + json.dumps(data, ensure_ascii=False, indent=2).replace('</', '<\\/') + ';\n')
    print(f"Imported {len(data['questions'])} SST topics, six points each; preserved {sum(len(q['sourcePoints']) for q in data['questions'])} source sentences.")
