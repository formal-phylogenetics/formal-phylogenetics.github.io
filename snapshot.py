"""Writes the data that the page reads, so that a visit asks no service but GitHub:

- catalogue.json: the hubs of the registry of lean4-phylogenetics and the catalog of each, read from
  GitHub (the page reads them live, and falls back on this file);
- citations.json: the citations between the entries, read from OpenAlex;
- works.json: for each entry, its authors, venue and abstract, read from OpenAlex, and from
  Semantic Scholar where OpenAlex has no abstract.

    python3 snapshot.py

The requests go in batches (fifty works to a request to OpenAlex, five hundred to Semantic
Scholar), with a pause between them. OpenAlex gives requests without a key a small daily budget,
shared by everyone on the same address: set OPENALEX_API_KEY to a key of your own (they are free,
https://help.openalex.org/api/authentication/). When OpenAlex refuses, the citations and the works
already stored are kept, and Semantic Scholar still fills in what it can. A workflow of this
repository runs the script every week.
"""

import json
import os
import re
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ORG, ROOT = 'formal-phylogenetics', 'lean4-phylogenetics'
HUB_KEYS = ('name', 'role', 'parent', 'kind', 'title', 'package', 'url')
PAPER_KEYS = ('id', 'family', 'order', 'short', 'kind', 'authors', 'year', 'title', 'url', 'status', 'repo', 'commit')
UA = {'User-Agent': 'formal-phylogenetics-snapshot (+https://formal-phylogenetics.vltanh.me)'}
HERE = Path(__file__).parent
KEY = os.environ.get('OPENALEX_API_KEY', '')


def get(url: str, data: bytes | None = None, tries: int = 5):
    for i in range(tries):
        req = urllib.request.Request(url, data=data, headers={**UA, **({'Content-Type': 'application/json'} if data else {})})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get('Retry-After') or 0)
            if e.code in (429, 500, 502, 503) and i + 1 < tries and wait <= 60:
                time.sleep(max(wait, 5 * (i + 1)))
                continue
            raise
    return None


def read_toml(repo: str, path: str) -> dict:
    return tomllib.loads(get(f'https://raw.githubusercontent.com/{ORG}/{repo}/main/{path}').decode())


def ids_of(url: str) -> dict:
    """The identifiers of an entry's link, as OpenAlex and Semantic Scholar take them."""
    u = url or ''
    if m := re.search(r'(?:doi\.org|dl\.acm\.org/doi)/(10\.[^?#]+)$', u, re.I):
        doi = urllib.parse.unquote(m.group(1)).lower()
        return {'doi': doi, 's2': f'DOI:{doi}'}
    if m := re.search(r'arxiv\.org/abs/([^?#]+?)(?:v\d+)?$', u, re.I):
        return {'doi': f'10.48550/arxiv.{m.group(1)}'.lower(), 's2': f'ARXIV:{m.group(1)}'}
    if m := re.search(r'biorxiv\.org/content/(10\.1101/[\d.]+)', u, re.I):
        return {'doi': m.group(1).lower(), 's2': f'DOI:{m.group(1)}'}
    if m := re.search(r'ncbi\.nlm\.nih\.gov/articles/(PMC\d+)', u, re.I):
        return {'pmcid': m.group(1), 's2': f'PMCID:{m.group(1)[3:]}'}
    if m := re.search(r'pubmed\.ncbi\.nlm\.nih\.gov/(\d+)', u, re.I):
        return {'pmid': m.group(1), 's2': f'PMID:{m.group(1)}'}
    return {}


def invert(index: dict | None) -> str:
    words = {}
    for w, at in (index or {}).items():
        for k in at:
            words[k] = w
    return ' '.join(words[k] for k in sorted(words))


def tidy(s: str | None) -> str:
    s = re.sub(r'<[^>]+>', ' ', s or '')
    s = re.sub(r'\s+', ' ', s).strip()
    return re.sub(r'^(abstract|summary)\b[\s.:]*', '', s, flags=re.I)


# text that came through a broken encoding upstream: a replacement character, or a question mark
# where a letter was (a name has none at all; in an abstract one ends a question)
def garbled_name(s: str) -> bool:
    return '�' in s or '?' in s


def garbled_text(s: str) -> bool:
    return '�' in s or bool(re.search(r'[^\W\d_]\?[^\W\d_]', s))


# the catalogs
registry = read_toml(ROOT, 'collection/repos.toml')
hubs = [{k: r[k] for k in HUB_KEYS if k in r} for r in registry['repo'] if r.get('role') == 'hub']
catalogs = {}
for hub in hubs:
    cat = read_toml(hub['name'], 'catalog/papers.toml')
    catalogs[hub['name']] = {
        'family': [{'id': f['id'], 'title': f['title']} for f in cat.get('family', [])],
        'paper': [{k: p[k] for k in PAPER_KEYS if k in p} for p in cat.get('paper', [])],
    }
(HERE / 'catalogue.json').write_text(json.dumps({'hubs': hubs, 'catalogs': catalogs}, ensure_ascii=False, separators=(',', ':')) + '\n')

entries = {f'{hub}/{p["id"]}': ids_of(p.get('url', '')) for hub, cat in catalogs.items() for p in cat['paper']}

# what is already stored, kept where a source refuses
stored = HERE / 'works.json'
works = {k: {'authors': [], 'venue': '', 'abstract': '', **w} for k, w in (json.loads(stored.read_text()) if stored.exists() else {}).items() if k in entries}

# OpenAlex: the works, by DOI, PMCID or PMID, fifty to a request
by_work, refs = {}, {}
openalex = True
try:
    for kind in ('doi', 'pmcid', 'pmid'):
        keyed = {ids[kind]: key for key, ids in entries.items() if kind in ids and not re.search(r'[,|]', ids[kind])}
        names = sorted(keyed)
        for i in range(0, len(names), 50):
            chunk = '|'.join(urllib.parse.quote(n, safe='/') for n in names[i:i + 50])
            select = 'id,doi,ids,referenced_works,authorships,primary_location,abstract_inverted_index'
            url = f'https://api.openalex.org/works?filter={kind}:{chunk}&select={select}&per-page=50' + (f'&api_key={KEY}' if KEY else '')
            for w in json.loads(get(url))['results']:
                ident = {
                    'doi': re.sub(r'^https?://doi\.org/', '', w.get('doi') or '', flags=re.I).lower(),
                    'pmcid': re.sub(r'^.*/(PMC\d+)/?$', r'\1', (w.get('ids') or {}).get('pmcid') or ''),
                    'pmid': re.sub(r'^.*/(\d+)$', r'\1', (w.get('ids') or {}).get('pmid') or ''),
                }[kind]
                key = keyed.get(ident)
                if not key:
                    continue
                by_work[w['id']] = key
                refs[key] = w.get('referenced_works') or []
                authors = [a['author']['display_name'] for a in w.get('authorships') or [] if a.get('author')]
                source = (w.get('primary_location') or {}).get('source') or {}
                abstract = tidy(invert(w.get('abstract_inverted_index')))
                works[key] = {
                    'authors': [] if any(garbled_name(a) for a in authors) else authors,
                    'venue': source.get('display_name') or '',
                    'abstract': '' if garbled_text(abstract) else abstract,
                }
            time.sleep(0.3)
except urllib.error.HTTPError as e:
    openalex = False
    print(f'OpenAlex refused ({e.code}): the stored citations and works are kept')

if openalex:
    edges = sorted({(k, by_work[w]) for k, rs in refs.items() for w in rs if w in by_work and by_work[w] != k})
    (HERE / 'citations.json').write_text(json.dumps({'edges': [list(e) for e in edges]}, separators=(',', ':')) + '\n')
else:
    edges = json.loads((HERE / 'citations.json').read_text())['edges']

# Semantic Scholar, for the entries OpenAlex gave no abstract or no clean names
missing = [k for k, ids in entries.items() if 's2' in ids and not (works.get(k, {}).get('abstract') and works[k].get('authors'))]
for i in range(0, len(missing), 500):
    chunk = missing[i:i + 500]
    raw = get('https://api.semanticscholar.org/graph/v1/paper/batch?fields=abstract,venue,authors',
              data=json.dumps({'ids': [entries[k]['s2'] for k in chunk]}).encode())
    for key, p in zip(chunk, json.loads(raw) if raw else []):
        if not p:
            continue
        w = works.setdefault(key, {'authors': [], 'venue': '', 'abstract': ''})
        abstract = tidy(p.get('abstract'))
        if not w['abstract'] and abstract and not garbled_text(abstract):
            w['abstract'] = abstract
        names = [a.get('name') or '' for a in p.get('authors') or []]
        if not w['authors'] and names and not any(garbled_name(n) for n in names):
            w['authors'] = names
        w['venue'] = w['venue'] or p.get('venue') or ''
    time.sleep(3)

works = {k: {f: v for f, v in w.items() if v} for k, w in sorted(works.items())}
(HERE / 'works.json').write_text(json.dumps(works, ensure_ascii=False, separators=(',', ':')) + '\n')
with_abstract = sum(1 for w in works.values() if w.get('abstract'))
print(f'{len(entries)} entries, {len(edges)} citations, {len(works)} works ({with_abstract} with an abstract)')
