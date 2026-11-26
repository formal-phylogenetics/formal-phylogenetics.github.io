# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Phylogenetics researchers** (primary): people who work on methods and theory for estimating
  alignments, gene trees, species trees and networks, and on the combinatorics, algebra,
  statistics and geometry behind them. They come to see how the literature of their field
  connects: who cites whom, who wrote with whom, where it was published, where its authors were.
- **Lean and formal-methods people**: the Lean and Mathlib community, looking at a field of applied
  mathematics laid out for formalization and at what is formalized in it.

## Product Purpose

The site of Formal Phylogenetics, a collection of Lean 4 formalizations of phylogenetics organized
as a tree of repositories (a root library, hubs of inference and of theory, each with its families
of papers, the libraries under a hub, and a repository for each paper formalized). Its purpose is to map the literature the collection draws
on: the papers of every hub's catalog, the citations between them, their authors and co-authors,
their venues and publishers, and the institutions and countries their bylines give. A visit
succeeds when a reader can follow a thread through that literature (a paper to what it cites, an
author to their co-authors and institutions, a venue to its authors) and trust what they find.

## Positioning

The map is curated from the papers themselves, not assembled from a bibliographic service: the
citations come from each paper's own reference list, the bylines and affiliations are read from
the PDFs, and an author's identifiers (ORCID, Google Scholar, dblp, OpenAlex) are shown only once
checked to be theirs. The services (Crossref, OpenAlex, Semantic Scholar, ORCID, ROR, dblp and the
others named in the footer) are references for that curation, credited, not mirrored.

## Operating Context

- The page reads the collection's registry (`collection/repos.toml` in lean4-phylogenetics) and
  each hub's catalog (`catalog/papers.toml`) from GitHub at each visit, so a new entry appears as
  soon as it is pushed; it falls back on `data/catalogue.json` when GitHub cannot be reached.
- Everything else it shows (citations, works and their bylines, people, institutions, profiles)
  comes from files in `data/`, exported from the collection's curated library of papers, which is
  private. The page queries no service when it is visited.
- The views: a tree of the collection, a timeline of citations, a co-authorship graph and an
  author-venue graph, lists by hub, author, venue and institution, a search with fields, and a
  panel for each entry, author, venue, publisher, institution and country.

## Capabilities and Constraints

- **Binding: curated data only.** What the site shows comes from the curated library export and the
  hubs' catalogs, never from services queried at visit or copied unchecked.
- **Binding: nothing private in public.** The public repository and page never name the private
  library's repositories, notes or unannounced work.
- **Binding: say no more than the source.** An affiliation is the institution the paper names (an
  institute printed alone is not credited to a university the paper does not print); an identifier
  is shown only when it is the person's.
- Current implementation, not a commitment: a static page with no build step (HTML, CSS and ES
  modules served by GitHub Pages at formal-phylogenetics.vltanh.me), and embeddable, since `app.js`
  draws into `#app` so another site can load `style.css` and `app.js` with its own page.
- Terminology: a *hub* holds the papers of a field and their shared library; an *entry* is a paper
  of a catalog; a *method* is an entry named by the method it introduces, a *theory* paper one named
  by its authors and year; an entry's status is to do, in progress, partly covered or formalized.

## Brand Commitments

- The name is Formal Phylogenetics; the line under it reads "Phylogenetic methods and theory,
  formalized in Lean."
- The maintainer is credited as The-Anh Vu-Le, with the help of Claude and ChatGPT.
- The footer names the sources used as references, each linked, under "Curated from the papers
  themselves".

## Evidence on Hand

- The data in `data/` (`catalogue.json`, `citations.json`, `works.json`, `people.json`,
  `profiles.json`) and the hubs' catalogs on GitHub.
- `assets/share.png` (the image shown when the page is shared), `assets/icon.svg` and
  `assets/apple-touch-icon.png`.
- No usage figures, testimonials or endorsements exist; none may be invented.

## Product Principles

1. **The literature is the map.** Connections (citations, co-authorship, venues, institutions) are
   the content; every name leads somewhere.
2. **Traceable over complete.** A fact shown is one read from the paper or checked against it; a
   gap stays a gap rather than being filled from an unchecked source.
3. **The source's own words, one entity each.** Names follow the papers and the registries, and a
   thing that changed its name stays one thing, with its earlier names noted.
4. **Two readers, one vocabulary.** The field's own terms come first for phylogeneticists; the
   formalization (status, repository) is there for the Lean reader without crowding the map.
