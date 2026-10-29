"""Validate the static release without loading anyone's browser records."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
seed = (DIST / 'assets/imported-progress.js').read_text()
assert re.search(r'WOGUATANG_IMPORTED_PROGRESS\s*=\s*null\s*;', seed), 'Public seed must be empty'
page = (DIST / 'index.html').read_text()
embedded = json.loads(re.search(r'<script type="application/json" id="questionData">(.*?)</script>', page, re.S)[1])
bank = json.loads((DIST / 'summary-preview-data.json').read_text())
assert embedded == bank, 'Embedded question bank differs from JSON'
for relative in re.findall(r'(?:src|href)="(\./[^"?#]+)"', page):
    assert (DIST / relative).is_file(), f'Missing asset: {relative}'
for manifest in ['original-audio.json', 'sst-audio.json']:
    entries = json.loads((DIST / 'assets' / manifest).read_text())
    for entry in entries.values():
        url = entry if isinstance(entry, str) else entry['url']
        assert url.startswith('./assets/'), f'Nonportable recording: {url}'
        assert (DIST / url).is_file(), f'Missing recording: {url}'
for path in DIST.rglob('*'):
    assert not path.is_symlink(), f'Unexpected symlink: {path}'
    assert path.name not in {'.env', 'install-info.json'}, f'Private file: {path}'
    assert path.suffix.lower() not in {'.zip', '.log'}, f'Runtime/export file: {path}'
print(f'Public bundle OK: {len(bank["questions"])} WFD questions, empty personal seed, portable assets.')
