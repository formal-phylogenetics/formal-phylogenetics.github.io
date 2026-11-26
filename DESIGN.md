---
name: Formal Phylogenetics
description: Phylogenetic methods and theory, formalized in Lean; a curated map of the literature behind them.
colors:
  archive-paper: "#f6f3ec"
  card-paper: "#fffdf8"
  raised-paper: "#fbf8f1"
  iron-gall-ink: "#22201b"
  ink-secondary: "#4f4b44"
  ink-muted: "#6b665e"
  ink-faint: "#a8a297"
  hairline: "#e2dccf"
  citation-amber: "#c2700c"
  focus-blue: "#2563eb"
  forest-night: "#121816"
  forest-card: "#1a221e"
  forest-raised: "#1e2723"
  night-ink: "#eee9dc"
  night-hairline: "#34403a"
  night-amber: "#f5a524"
  hub-alignment: "#2563eb"
  hub-gene-tree: "#0e7490"
  hub-species-tree: "#15803d"
  hub-network: "#4338ca"
  hub-tree-of-blobs: "#7c3aed"
  hub-combinatorics: "#b45309"
  hub-algebraic: "#b91c1c"
  hub-statistics: "#be185d"
  hub-geometry: "#c2410c"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "2.5rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.15
    fontFeature: "lnum, tnum"
  headline:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.15rem"
    fontWeight: 600
  title:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans, Helvetica Neue, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  body-small:
    fontFamily: "IBM Plex Sans, Helvetica Neue, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.4
  tag:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 600
    letterSpacing: "0.1em"
rounded:
  mark: "1.5px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  tag:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.iron-gall-ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.sm}"
    padding: "0 10px 0 9px"
    height: "26px"
  chip:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.iron-gall-ink}"
    rounded: "{rounded.sm}"
    padding: "0 4px 0 10px"
    height: "26px"
  button:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.iron-gall-ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  button-primary:
    backgroundColor: "{colors.iron-gall-ink}"
    textColor: "{colors.archive-paper}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  link-pill:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.iron-gall-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  tab:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
  tab-selected:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.iron-gall-ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
  panel:
    backgroundColor: "{colors.raised-paper}"
    rounded: "{rounded.lg}"
    padding: "16px 16px 12px"
  search-field:
    textColor: "{colors.iron-gall-ink}"
    padding: "8px 2px"
---

# Design System: Formal Phylogenetics

## Overview

**Creative North Star: "The Annotated Atlas"**

The site is a map of a field. Each hub of the collection is a region with its own colour, and every
name on the map leads somewhere: a paper to what it cites, an author to their co-authors and
institutions, a venue to its authors. The notes stay quiet beside the map. The interface is ink on
archive paper by day and the same ink, lightened, on a green-black forest night: little text, small
type, hairlines, and colour spent only where it carries information.

One visual language runs through every view, list, chip and card. Colour is the hub. Shape is the
kind of paper: round for a method, square for theory. Fill is the status: solid once formalized,
half while in progress, dotted when partly covered, hollow to do. What an entry cites is drawn in
ink, what cites it in amber. A reader who learns these four encodings once can read the tree, the
timeline, the graphs and the lists without a legend.

The density is that of a well-set reference work: compact, labelled, legible at a glance and in
bulk. Nothing is raised, glowing or ornamental; the data carries the colour, and the chrome stays
paper and ink.

**Key Characteristics:**
- Warm archive paper and iron-gall ink by day; forest night by dark, chosen by the reader or the system.
- Hub colour as the only categorical colour; citation amber as the only directional one.
- Serif for what a thing is called, sans for everything that describes or labels it.
- Flat tonal layering; one soft shadow, for what floats under the pointer.
- Small tags and pills for collections; plain text links for reading (bylines, citations).

## Colors

A restrained paper-and-ink palette, with hub colours and one amber as the only voices.

### Primary
- **Iron-Gall Ink** (iron-gall-ink): text, rules that matter, the selected state of a tag, the
  primary button's fill, and every citation an entry makes. By night it is **Night Ink** (night-ink).

### Secondary
- **Citation Amber** (citation-amber): what cites the pinned entry, in the timeline, the lists and
  the panel; by night **Night Amber** (night-amber). It means one direction and nothing else.

### Tertiary
- **Hub colours** (hub-alignment, hub-gene-tree, hub-species-tree, hub-network, hub-tree-of-blobs,
  hub-combinatorics, hub-algebraic, hub-statistics, hub-geometry): each hub's identity, set on the
  marks of its entries, its row of the timeline, its wedge of the tree, the border of a formalized
  tag and the name in a panel's head. Each has a lighter night variant (see the sidecar). A hub
  added later takes the next spare colour.

### Neutral
- **Archive Paper** (archive-paper): the page. By night **Forest Night** (forest-night).
- **Card Paper** (card-paper): tags, chips, pills and the floating card. By night **Forest Card** (forest-card).
- **Raised Paper** (raised-paper): the panel and other resting containers. By night **Forest Raised** (forest-raised).
- **Ink Secondary** (ink-secondary): body text inside panels and lists.
- **Ink Muted** (ink-muted): metadata, labels, counts, the unselected tab.
- **Ink Faint** (ink-faint): underlines, separators, the dash before a section label. Never words.
- **Hairline** (hairline): borders of tags, panels and pills. By night **Night Hairline** (night-hairline).
- **Focus Blue** (focus-blue): the keyboard focus ring only.

### Named Rules
**The Hub Owns the Colour Rule.** Categorical colour belongs to the hubs. Interface chrome (tabs,
buttons, panels, links) stays paper and ink; no hue is spent on decoration.

**The Two Directions Rule.** Ink for what an entry cites, amber for what cites it. Amber is never a
highlight, a warning or an accent elsewhere.

**The Faint Is Not Text Rule.** Ink Faint marks structure (an underline, a "·", a section dash). Any
word, count or year is Ink Muted at the lightest.

## Typography

**Display Font:** Literata (with Georgia, serif)
**Body Font:** IBM Plex Sans (with Helvetica Neue, sans-serif)

**Character:** Literata, a book face with optical sizes, names things: the site, a hub, an author, an
entry, a title, a figure. IBM Plex Sans, a plain engineered sans, does the describing: metadata,
labels, tags, lists, controls. Numbers are tabular throughout, lining in figures.

### Hierarchy
- **Display** (500, clamp(1.9rem, 3.4vw, 2.5rem), 1.1): the site's name only.
- **Figure** (400, 1.3rem, 1.15): the collection's figures under the title.
- **Headline** (600, 1.15rem): the name in a panel's head, in its hub's colour.
- **Title** (500, 1rem, 1.35): an entry's title in its panel.
- **Body** (400, 1rem, 1.55): page text and the search field.
- **Body Small** (400, 0.82–0.86rem, 1.35–1.4): panel content, bylines, citation lines, lists.
- **Tag** (500, 0.8rem, 1): entry tags and chips; 0.76rem in a panel.
- **Label** (600, 0.7rem, 0.1em, uppercase): section heads in panels ("Authors", "Cites"), the
  panel's meta line, and the stat and credit labels.

### Named Rules
**The Serif Names Things Rule.** Literata only for what a thing is called or counted; never for a
label, a control or running metadata.

**The Small-Caps Labels Rule.** A section is introduced by a short uppercase label with a faint dash
before it, never by a heading of larger size; the content carries the weight.

## Layout

A single column at most 1600px wide with 40px gutters. The hero sets the title, figures and credits
beside the tree of the collection; below it the stage (timeline or graphs) and the panel of the
pinned item, then the search bar with its tabs, then the lists. Spacing follows a 4px base scale
(s1–s7: 4, 8, 12, 16, 24, 32, 48px): tight inside a group, one step more between groups, more
above a section label than below it. Text inside wide containers keeps a readable width (a byline
at most 62rem, a list at most 44rem), so years and counts stay near the names they belong to.
Breakpoints at 1100px (the panel beside or below the stage), 899px and 760px (the bar and lists
wrap), and 560px (bylines stack, the location line drops under the buttons).

### Named Rules
**The Readable Width Rule.** No line of related text spans the full stage; cap it so the eye can
travel from a name to its date.

## Elevation & Depth

Flat, with tonal layering: Archive Paper under Raised Paper (panels) under Card Paper (tags, chips,
the card), each step separated by a hairline rather than a shadow. Two shadows exist. The floating
card of an entry, which follows the pointer, casts a long soft ambient shadow; the selected tab in a
segmented control lifts by a 1px hairline shadow. Selection inside a view is shown by an outline
ring (ink, ink at 70% for cites, amber for cited by), never by elevation.

### Shadow Vocabulary
- **Floating card** (`box-shadow: 0 12px 32px -18px rgba(34, 32, 27, 0.45)`; by night `0 16px 36px -18px rgba(0, 0, 0, 0.9)`): the entry card under the pointer only.
- **Selected tab** (`box-shadow: 0 1px 2px color-mix(in oklab, var(--ink) 12%, transparent)`): the selected segment of the view and list switches.

### Named Rules
**The Flat Paper Rule.** Everything at rest lies flat on the paper. Only what floats above the
pointer casts a shadow.

## Shapes

Small, consistent corners: 6px for tags, chips and tab segments; 8px for the floating card and the
tab track; 10px for the panel; full pills for buttons and identifier links. Borders are 1px
hairlines. The entry mark is an 8px shape with a 1.5px border in the hub colour: a circle for a
method, a square with 1.5px corners for theory, filled to show the status.

### Named Rules
**The Mark Grammar Rule.** Round is a method, square is theory; solid is formalized, half is in
progress, dotted is partly covered, hollow is to do. These shapes and fills mean nothing else
anywhere on the site.

## Components

**Quiet and exact.** Hairline borders, paper tiles, small type, nothing raised or ornamental.

### Buttons
- **Shape:** full pill (999px), 30px high, 12px side padding, 0.84rem medium.
- **Default:** Card Paper with a hairline border and ink text ("Paper ↗").
- **Primary:** ink fill with paper text ("Formalization ↗"), one per panel at most.
- **Hover / Focus:** the border darkens to Ink Muted; focus draws the 2px Focus Blue ring, 2px offset.
- **Close:** a 28px round ghost button with a 12px cross, tinted on hover.

### Chips (tags, chips and identifier pills)
- **Entry tag:** Card Paper, hairline border, 6px corners, 26px high, the hub mark then the name.
  Formalized: the border and a faint fill take the hub colour. Selected: a 1.5px ink ring; cited: a
  1.5px ink ring at 70%; citing: a 1.5px amber ring.
- **Chip:** the same tile for an author, venue or institution in a panel, with a count in a small
  tinted box at its end; overflow shows "+N more" as a dashed chip.
- **Identifier pill:** a small full pill (2px 9px, 0.76rem) for ORCID, Google Scholar, dblp,
  OpenAlex and ROR links.

### Cards / Containers
- **Panel:** Raised Paper, hairline border, 10px corners, 16px padding; a head with the name
  (Headline, in the hub's colour), a meta line (Label), and sections each introduced by a label.
- **Floating card:** Card Paper, a border tinted with the hub colour, 8px corners, the floating
  shadow, at most 420px wide.

### Inputs / Fields
- **Search:** no box: an underline in Ink Faint that turns ink on focus, 8px 2px padding, a muted
  placeholder.
- **Advanced search:** a grid of labelled fields, each an uppercase Label over an underlined input
  or select, between two hairline rules.

### Navigation
- **Segmented switches:** the view and list tabs sit in a track tinted 5% ink with 8px corners;
  segments are 28px high, muted text, and the selected one is Card Paper with ink text and the
  1px tab shadow.
- **Links:** inherit the text colour, underlined in Ink Faint at a 0.2em offset; the underline takes
  the text colour on hover.

### Byline (signature)
An entry's authors as a reference prints them: names in a semibold column, beside each the
institutions the paper gives them as links in Ink Secondary, each followed by its country in Ink
Muted; several institutions separated by a faint "·". Links underline only on hover. Above it, the
citation line: venue (link), volume(issue):pages, year, publisher (link), separated by "·".

## Do's and Don'ts

### Do:
- **Do** spend colour only on hubs (hub colours) and on the direction of a citation (ink, amber).
- **Do** keep the mark grammar everywhere an entry appears: hub colour, shape for the kind, fill for the status.
- **Do** use Literata for names, titles and figures, and IBM Plex Sans for everything else.
- **Do** separate rows by spacing (5–7px gaps) and cap text width inside full-width panels.
- **Do** give every name in a panel a link to its own panel.

### Don't:
- **Don't** draw a rule between every row of a list or byline; the user rejected rows of horizontal bars.
- **Don't** set a byline or a citation as pills; pills are for collections the reader browses and jumps through.
- **Don't** use amber for anything but what cites an entry.
- **Don't** add shadows to panels, tags or chips at rest.
- **Don't** set words in Ink Faint.
