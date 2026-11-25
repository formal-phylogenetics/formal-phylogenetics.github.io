"""Writes the snapshots that the page falls back on: catalogue.json, the hubs of the registry of
lean4-phylogenetics and the catalog of each, read from GitHub; and citations.json, the citations
between the entries, read from OpenAlex.

    python3 snapshot.py
"""

import json
import re
import tomllib
import urllib.parse
import urllib.request
from pathlib import Path

ORG, ROOT = 'formal-phylogenetics', 'lean4-phylogenetics'
HUB_KEYS = ('name', 'role', 'parent', 'kind', 'title', 'package', 'url')
PAPER_KEYS = ('id', 'family', 'order', 'short', 'kind', 'authors', 'year', 'title', 'url', 'status', 'repo', 'commit')


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


def doi_of(url: str) -> str | None:
    """The DOI of an entry's link, as the page finds it."""
    for pattern, form in ((r'(?:doi\.org|dl\.acm\.org/doi)/(10\.[^?#]+)$', '{}'),
                          (r'arxiv\.org/abs/([^?#]+?)(?:v\d+)?$', '10.48550/arxiv.{}'),
                          (r'biorxiv\.org/content/(10\.1101/[\d.]+)', '{}')):
        m = re.search(pattern, url, re.I)
        if m:
            return form.format(urllib.parse.unquote(m.group(1))).lower()
    return None


by_doi = {}
for hub, cat in catalogs.items():
    for p in cat['paper']:
        d = doi_of(p.get('url', ''))
        if d and not re.search(r'[,|]', d):
            by_doi[d] = f'{hub}/{p["id"]}'
by_work, refs = {}, {}
dois = sorted(by_doi)
for i in range(0, len(dois), 50):
    chunk = '|'.join(urllib.parse.quote(d, safe='/') for d in dois[i:i + 50])
    url = f'https://api.openalex.org/works?filter=doi:{chunk}&select=id,doi,referenced_works&per-page=50'
    with urllib.request.urlopen(url) as r:
        for w in json.load(r)['results']:
            key = by_doi.get(re.sub(r'^https?://doi\.org/', '', w.get('doi') or '', flags=re.I).lower())
            if key:
                by_work[w['id']] = key
                refs[key] = w.get('referenced_works') or []
edges = sorted({(k, by_work[w]) for k, rs in refs.items() for w in rs if w in by_work and by_work[w] != k})
cites = Path(__file__).with_name('citations.json')
cites.write_text(json.dumps({'edges': [list(e) for e in edges]}, separators=(',', ':')) + '\n')
print(f'{cites}: {len(edges)} citations')
