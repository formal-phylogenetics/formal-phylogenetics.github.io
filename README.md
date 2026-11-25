# formal-phylogenetics.github.io

The site of the collection of Lean 4 formalizations of phylogenetics, at
<https://formal-phylogenetics.github.io/>: a catalogue of the methods, software and theorems in the
catalogs of the hubs, arranged as the tree of the collection. The tree is drawn as a fan from the
root, [lean4-phylogenetics](https://github.com/formal-phylogenetics/lean4-phylogenetics), through
the hubs and their families to a tip for each entry; below it, each hub has a drawer with a tag for
each entry. Pointing at a tip or a tag shows the entry's card, with its authors, venue and abstract.

The page reads the registry of the collection (`collection/repos.toml` in lean4-phylogenetics) and
the catalog of each hub (`catalog/papers.toml`) from GitHub each time it opens, so a hub, family or
entry appears as soon as it is pushed. The abstracts come from [OpenAlex](https://openalex.org),
and from [Semantic Scholar](https://www.semanticscholar.org) when OpenAlex has none.

- `index.html`, `style.css`, `app.js`: the page, with no build step;
- `catalogue.json`: the snapshot the page falls back on when GitHub cannot be reached, written by
  `python3 snapshot.py`;
- `catalogue.png`: the image shown when the page is shared.

To preview it, run `python3 -m http.server` here and open <http://localhost:8000/>. Another site can
show the catalogue with its own `index.html` that loads `style.css` and `app.js` from here: the
script finds `catalogue.json` next to itself.

## License

Apache-2.0: [LICENSE](LICENSE).
