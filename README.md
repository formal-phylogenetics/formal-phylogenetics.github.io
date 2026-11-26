# formal-phylogenetics.github.io

The site of the collection of Lean 4 formalizations of phylogenetics, at
<https://formal-phylogenetics.vltanh.me/>. Beside the title, the tree of the collection is drawn as a
fan from the root, [lean4-phylogenetics](https://github.com/formal-phylogenetics/lean4-phylogenetics),
the hubs of theory on the left and of inference on the right, each hub a wedge whose width grows with
its catalog, through its families to a tip for each entry; under the title, the figures of the
collection (papers, citations, authors, venues). Below come, in order: a trim bar, which
chooses the years shown by dragging its ends or the range between them, each year as wide as its
papers need; a view of the entries for those years: the timeline, where time runs from left to
right, each hub is a row, and the citations between the entries are drawn between them; the graph
of the co-authorship of the authors, in a fixed layout where the years shown choose which entries
count; or the authors and the venues of their entries in two rows, the authors above and the venues
below in blocks of their publishers, in an order that keeps the links short. In both graphs a link
is as wide as the entries behind it; pointing at an author, a venue, a publisher or a link tells
what it is, and a click pins it in the panel, and a click on what is pinned lets it go. Then come
the panel of the pinned entry, author, venue, publisher or link; the search; and the list, of the
hubs, which open to their families, of the authors, or of the publishers, which open to their
venues: a conference is a venue under Conference, a preprint server one under Preprint.
Colour is the hub, shape the kind of paper (round for a method, square for theory), fill the
status, and size the entry's weight in the citations: its PageRank, in which a citation counts for
as much as the paper that makes it weighs. Pointing at an entry, in the timeline or the list, marks it in both and shows its card,
with its authors, venue and abstract. A click pins it: the panel shows what it cites and what cites
it, marked everywhere, with links to its formalization and its paper, and the address keeps it; a
click on the pinned entry unpins it. The header switches between light and dark.

The panel of an author gives what [ORCID](https://orcid.org), OpenAlex and
[Wikidata](https://www.wikidata.org) say: the years of birth and death, the positions, education,
the institutions on their papers by year, doctoral advisors and students, honours, and the links to
their profiles (ORCID, Google Scholar, DBLP, the Mathematics Genealogy Project, Wikipedia); then
their co-authors and venues in the collection, each with the entries behind it. The panel of a
venue gives the year it was founded, the titles it continued, its ISSN and access, and its authors
with their entries there.

The page reads the registry of the collection (`collection/repos.toml` in lean4-phylogenetics) and
the catalog of each hub (`catalog/papers.toml`) from GitHub each time it opens, so a hub, family or
entry appears as soon as it is pushed. The citations and the abstracts are not read at each visit:
they are stored in `citations.json` and `works.json`, written from the collection's library of
papers, which is private. The citations come from the papers' own reference lists, in every version
the library holds (the list the publisher deposited with [Crossref](https://www.crossref.org), the
full text in PubMed Central, the PDF, the arXiv source), checked one by one where they differ from
what [OpenAlex](https://openalex.org), Crossref and [Semantic Scholar](https://www.semanticscholar.org)
claim. The authors, venue and abstract of each entry come from Crossref, OpenAlex, Semantic Scholar
and [Europe PMC](https://europepmc.org), or, where none gives the abstract, from the paper itself.

- `index.html`, `style.css`, `app.js`: the page, with no build step; `app.js` draws into `#app`, so
  another site can show the catalogue with its own `index.html` that loads `style.css` and `app.js`
  from here;
- `catalogue.json`, the catalogs the page falls back on when GitHub cannot be reached;
  `citations.json`, the citations between the entries; `works.json`, the authors, venue and abstract
  of each entry; `people.json`, the authors, the venues with their publishers, and the co-authorship
  with its layout; `profiles.json`, read when a panel shows one, the profiles of the authors and the
  venues: all written from the library;
- `catalogue.png`: the image shown when the page is shared, the tree of the collection.
- `icon.svg`, `apple-touch-icon.png`: the icon, the tree of the collection in brief: the root, its
  trunk forking into theory and inference, and the colour of each hub.

To preview it, run `python3 -m http.server` here and open <http://localhost:8000/>.

## Credits

Maintained by The-Anh Vu-Le, with the help of Claude and ChatGPT.

## License

Apache-2.0: [LICENSE](LICENSE).
