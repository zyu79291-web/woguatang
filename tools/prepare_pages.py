"""Prepare the GitHub Pages folder from the sanitized static distribution."""
from pathlib import Path
import runpy
import shutil

ROOT = Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT / 'tools/check_public_bundle.py'))
source, target = ROOT / 'dist', ROOT / 'docs'
# Only generated release files live here; no browser or service data is copied.
if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)
print('Prepared docs/ for GitHub Pages.')
