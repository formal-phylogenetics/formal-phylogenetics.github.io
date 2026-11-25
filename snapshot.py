"""Writes the data that the page reads, so that a visit asks no service but GitHub:

- catalogue.json: the hubs of the registry of lean4-phylogenetics and the catalog of each, read from
  GitHub (the page reads them live, and falls back on this file);
- citations.json: the citations between the entries, from the reference lists of OpenAlex,
  Crossref and Semantic Scholar;
- works.json: for each entry, its authors, venue and abstract, read from OpenAlex; where OpenAlex
  has no abstract, from Semantic Scholar, Europe PMC (the abstracts of PubMed) or Crossref, in that
  order.

    python3 snapshot.py

The requests go in batches (fifty works to a request to OpenAlex and to Semantic Scholar, which cuts
reference lists short in larger ones, forty to Crossref, twenty-five to Europe PMC), with a pause
between them. OpenAlex gives requests
without a key a small daily budget, shared by everyone on the same address: set OPENALEX_API_KEY to
a key of your own (they are free, https://help.openalex.org/api/authentication/). When a source
refuses, the others still answer, the citations already stored are kept beside the new ones, and so
are the works. The Snapshot workflow of this repository runs the script, with the key as a secret,
from the Actions tab.
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

refused = []


def ask(name: str, read) -> None:
    """Runs one source; a refusal is reported and leaves what is stored."""
    try:
        read()
    except (OSError, json.JSONDecodeError) as e:
        refused.append(name)
        print(f'{name} refused ({getattr(e, "code", e)}): what is stored is kept')


def fill(key: str, abstract: str | None) -> None:
    w = works.setdefault(key, {'authors': [], 'venue': '', 'abstract': ''})
    abstract = tidy(abstract)
    if not w['abstract'] and abstract and not garbled_text(abstract):
        w['abstract'] = abstract


edges = set()
by_doi = {ids['doi']: key for key, ids in entries.items() if 'doi' in ids}


# OpenAlex: the works, by DOI, PMCID or PMID, fifty to a request
def openalex() -> None:
    by_work, refs = {}, {}
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
    edges.update((k, by_work[w]) for k, rs in refs.items() for w in rs if w in by_work and by_work[w] != k)


# Semantic Scholar: the reference lists of every entry, and the abstracts and names OpenAlex has not
# given, fifty to a request (in larger batches, it leaves most reference lists empty)
def semantic_scholar() -> None:
    keys = [k for k, ids in entries.items() if 's2' in ids]
    by_paper, refs = {}, {}
    for i in range(0, len(keys), 50):
        chunk = keys[i:i + 50]
        raw = get('https://api.semanticscholar.org/graph/v1/paper/batch?fields=abstract,venue,authors,references.paperId',
                  data=json.dumps({'ids': [entries[k]['s2'] for k in chunk]}).encode(), tries=8)
        for key, p in zip(chunk, json.loads(raw)):
            if not p:
                continue
            by_paper[p['paperId']] = key
            refs[key] = [r.get('paperId') for r in p.get('references') or []]
            fill(key, p.get('abstract'))
            w = works[key]
            names = [a.get('name') or '' for a in p.get('authors') or []]
            if not w['authors'] and names and not any(garbled_name(n) for n in names):
                w['authors'] = names
            w['venue'] = w['venue'] or p.get('venue') or ''
        time.sleep(3)
    edges.update((k, by_paper[r]) for k, rs in refs.items() for r in rs if r in by_paper and by_paper[r] != k)


# Europe PMC: the abstracts of PubMed, for the entries still without one, twenty-five to a request
def europe_pmc() -> None:
    wanted = {}
    for key, ids in entries.items():
        if works.get(key, {}).get('abstract'):
            continue
        if 'doi' in ids:
            wanted[('doi', ids['doi'])] = (key, f'DOI:"{ids["doi"]}"')
        elif 'pmcid' in ids:
            wanted[('pmcid', ids['pmcid'])] = (key, f'PMCID:{ids["pmcid"]}')
        elif 'pmid' in ids:
            wanted[('pmid', ids['pmid'])] = (key, f'(EXT_ID:{ids["pmid"]} AND SRC:MED)')
    terms = sorted(wanted.values())
    for i in range(0, len(terms), 25):
        query = ' OR '.join(q for _, q in terms[i:i + 25])
        params = urllib.parse.urlencode({'query': query, 'resultType': 'core', 'format': 'json', 'pageSize': 100})
        for r in json.loads(get(f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?{params}'))['resultList']['result']:
            for ident in (('doi', (r.get('doi') or '').lower()), ('pmcid', r.get('pmcid') or ''), ('pmid', r.get('pmid') or '')):
                if ident in wanted:
                    fill(wanted[ident][0], r.get('abstractText'))
        time.sleep(1)


# Crossref: the reference lists the publishers deposit, and the abstracts still missing, forty DOIs
# to a request
def crossref() -> None:
    dois = sorted(d for d in by_doi if ',' not in d and not d.startswith('10.48550/'))
    for i in range(0, len(dois), 40):
        f = ','.join('doi:' + d for d in dois[i:i + 40])
        url = f'https://api.crossref.org/works?filter={urllib.parse.quote(f, safe=":,/")}&select=DOI,abstract,reference&rows=100'
        for w in json.loads(get(url))['message']['items']:
            key = by_doi.get((w.get('DOI') or '').lower())
            if not key:
                continue
            fill(key, w.get('abstract'))
            for r in w.get('reference') or []:
                cited = by_doi.get((r.get('DOI') or '').lower())
                if cited and cited != key:
                    edges.add((key, cited))
        time.sleep(1)


ask('OpenAlex', openalex)
ask('Semantic Scholar', semantic_scholar)
ask('Europe PMC', europe_pmc)
ask('Crossref', crossref)

if refused:
    edges.update(map(tuple, json.loads((HERE / 'citations.json').read_text())['edges']))
(HERE / 'citations.json').write_text(json.dumps({'edges': [list(e) for e in sorted(edges)]}, separators=(',', ':')) + '\n')

works = {k: {f: v for f, v in w.items() if v} for k, w in sorted(works.items())}
(HERE / 'works.json').write_text(json.dumps(works, ensure_ascii=False, separators=(',', ':')) + '\n')
with_abstract = sum(1 for w in works.values() if w.get('abstract'))
print(f'{len(entries)} entries, {len(edges)} citations, {len(works)} works ({with_abstract} with an abstract)')
