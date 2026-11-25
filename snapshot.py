"""Writes catalogue.json, the snapshot that the page falls back on when GitHub cannot be reached: the
hubs of the registry of lean4-phylogenetics and the catalog of each, read from GitHub.

    python3 snapshot.py
"""

import json
import tomllib
import urllib.request
from pathlib import Path

ORG, ROOT = 'formal-phylogenetics', 'lean4-phylogenetics'
HUB_KEYS = ('name', 'role', 'parent', 'kind', 'title', 'package', 'url')
PAPER_KEYS = ('id', 'family', 'order', 'short', 'authors', 'year', 'title', 'url', 'status', 'repo', 'commit')


def read(repo: str, path: str) -> dict:
    with urllib.request.urlopen(f'https://raw.githubusercontent.com/{ORG}/{repo}/main/{path}') as r:
        return tomllib.loads(r.read().decode())


registry = read(ROOT, 'collection/repos.toml')
hubs = [{k: r[k] for k in HUB_KEYS if k in r} for r in registry['repo'] if r.get('role') == 'hub']
catalogs = {}
for hub in hubs:
    cat = read(hub['name'], 'catalog/papers.toml')
    catalogs[hub['name']] = {
        'family': [{'id': f['id'], 'title': f['title']} for f in cat.get('family', [])],
        'paper': [{k: p[k] for k in PAPER_KEYS if k in p} for p in cat.get('paper', [])],
    }
out = Path(__file__).with_name('catalogue.json')
out.write_text(json.dumps({'hubs': hubs, 'catalogs': catalogs}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{out}: {sum(len(c["paper"]) for c in catalogs.values())} entries')
