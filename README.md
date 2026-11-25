# formal-phylogenetics.github.io

The site of the collection of Lean 4 formalizations of phylogenetics, at
<https://formal-phylogenetics.github.io/>. It shows every entry of the hubs' catalogs in two views:
the tree of the collection, drawn as a fan from the root,
[lean4-phylogenetics](https://github.com/formal-phylogenetics/lean4-phylogenetics), through the hubs
and their families to a tip for each entry; and a timeline, with a column for each hub, a row for
each year and the citations between the entries. Below the views, each hub opens to its families.
Colour is the hub, shape the kind of paper (round for a method, square for theory) and fill the
status. Pointing at an entry shows its card, with its authors, venue and abstract.

The page reads the registry of the collection (`collection/repos.toml` in lean4-phylogenetics) and
the catalog of each hub (`catalog/papers.toml`) from GitHub each time it opens, so a hub, family or
entry appears as soon as it is pushed. The citations and the abstracts come from
[OpenAlex](https://openalex.org), and the abstracts from [Semantic Scholar](https://www.semanticscholar.org)
when OpenAlex has none.

- `index.html`, `style.css`, `app.js`: the page, with no build step; `app.js` draws into `#app`, so
  another site can show the catalogue with its own `index.html` that loads `style.css` and `app.js`
  from here;
- `catalogue.json` and `citations.json`: the snapshots the page falls back on when GitHub or
  OpenAlex cannot be reached, written by `python3 snapshot.py`;
- `catalogue.png`: the image shown when the page is shared.

To preview it, run `python3 -m http.server` here and open <http://localhost:8000/>.

## License

Apache-2.0: [LICENSE](LICENSE).
