"""Import the user's bilingual SST short sentences without rewriting them."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def extract(path):
    text = path.read_text()
    cues = json.loads((ROOT / 'tools/sst-memory-cues.json').read_text())
    sections = re.split(r'^## (\d+)\. (.+?)｜(.+?)｜#(\d+)\s*$', text, flags=re.M)
    questions = []
    for at in range(1, len(sections), 5):
        number, title, title_zh, source_id, body = sections[at:at + 5]
        points = re.findall(r'^\d+\. \*\*(.+?)\*\* — (.+)$', body, flags=re.M)
        assert 6 <= len(points) <= 7, f'Unexpected sentence count: {number}'
        questions.append({
            'id': 'sst-' + source_id, 'number': int(number), 'sourceId': source_id,
            'title': title.strip(), 'titleZh': title_zh.strip(),
            **cues[source_id],
            'points': [{'en': en.strip(), 'zh': zh.strip()} for en, zh in points],
        })
    assert [q['number'] for q in questions] == list(range(1, 61))
    assert len({q['id'] for q in questions}) == 60
    return {'version': 2, 'source': {'filename': path.name,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}, 'questions': questions}


if __name__ == '__main__':
    data = extract(Path(sys.argv[1]))
    (ROOT / 'dist/assets/sst-memory-data.js').write_text(
        'window.SST_MEMORY = ' + json.dumps(data, ensure_ascii=False, indent=2).replace('</', '<\\/') + ';\n')
    print(f"Imported {len(data['questions'])} SST topics and {sum(len(q['points']) for q in data['questions'])} bilingual sentences.")
