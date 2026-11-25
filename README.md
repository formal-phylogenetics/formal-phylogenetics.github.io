# formal-phylogenetics.github.io

The site of the collection of Lean 4 formalizations of phylogenetics, at
<https://formal-phylogenetics.vltanh.me/>. Beside the title, the tree of the collection is drawn as a
fan from the root, [lean4-phylogenetics](https://github.com/formal-phylogenetics/lean4-phylogenetics),
the hubs of theory on the left and of inference on the right, each hub a wedge whose width grows with
its catalog, through its families to a tip for each entry. Below come, in order: a trim bar, which
chooses the years shown by dragging its ends or the range between them, each year as wide as its
papers need; a timeline of the entries, where time runs from left to right, each hub is a row, and
the citations between the entries are drawn between them; the panel of the pinned entry; the
search; and the list of the hubs, which open to their families, one at a time or all at once.
Colour is the hub, shape the kind of paper (round for a method, square for theory) and fill the
status. Pointing at an entry, in the timeline or the list, marks it in both and shows its card,
with its authors, venue and abstract. A click pins it: the panel shows what it cites and what cites
it, marked everywhere, with links to its formalization and its paper, and the address keeps it; a
click on the pinned entry unpins it. The header switches between light and dark.

The page reads the registry of the collection (`collection/repos.toml` in lean4-phylogenetics) and
the catalog of each hub (`catalog/papers.toml`) from GitHub each time it opens, so a hub, family or
entry appears as soon as it is pushed. The citations and the abstracts are not read at each visit:
`snapshot.py` reads them from [OpenAlex](https://openalex.org), and from
[Semantic Scholar](https://www.semanticscholar.org) where OpenAlex has no abstract, in a few batched
requests, and stores them in `citations.json` and `works.json`. Run it when the catalogs change;
with `OPENALEX_API_KEY` set, OpenAlex counts its requests against that key instead of the small
budget shared by everyone on the same address.

- `index.html`, `style.css`, `app.js`: the page, with no build step; `app.js` draws into `#app`, so
  another site can show the catalogue with its own `index.html` that loads `style.css` and `app.js`
  from here;
- `catalogue.json`, the catalogs the page falls back on when GitHub cannot be reached;
  `citations.json`, the citations between the entries; `works.json`, the authors, venue and abstract
  of each entry: all written by `python3 snapshot.py`;
- `catalogue.png`: the image shown when the page is shared.

To preview it, run `python3 -m http.server` here and open <http://localhost:8000/>.

## Credits

Maintained by The-Anh Vu-Le, with the help of Claude and ChatGPT.

## License

Apache-2.0: [LICENSE](LICENSE).
