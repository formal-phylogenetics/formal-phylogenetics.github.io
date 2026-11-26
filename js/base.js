export const ORG = "formal-phylogenetics";

export const ROOT = "lean4-phylogenetics";

export const RAW = (repo, path) =>
  `https://raw.githubusercontent.com/${ORG}/${repo}/main/${path}`;

export const TOML = "https://cdn.jsdelivr.net/npm/smol-toml@1.9.1/+esm";

export const SVGNS = "http://www.w3.org/2000/svg";

// a file of the site, beside app.js, wherever the page that loads it is
export const HERE = (file) => new URL(`../${file}`, import.meta.url);

// the data written with the page is checked with the server at each visit (an unchanged file
// costs a short answer), so that the page never reads data older than itself
export const FRESH = { cache: "no-cache" };

// The colour of each hub, for light and for dark pages; a hub not named here takes a spare colour.
export const COLOURS = {
  "lean4-phylo-alignment": ["#2563eb", "#7aa7ff"],
  "lean4-phylo-gene-tree": ["#0e7490", "#4cc9e0"],
  "lean4-phylo-species-tree": ["#15803d", "#5fd38d"],
  "lean4-phylo-network": ["#4338ca", "#a5a5ff"],
  "lean4-phylo-tree-of-blobs": ["#7c3aed", "#c4a2ff"],
  "lean4-phylo-combinatorics": ["#b45309", "#f0b35a"],
  "lean4-phylo-algebraic": ["#b91c1c", "#ff8f8f"],
  "lean4-phylo-statistics": ["#be185d", "#ff8cc6"],
  "lean4-phylo-geometry": ["#c2410c", "#ff9c66"],
};

export const SPARE = [
  ["#0f766e", "#4fd1c5"],
  ["#a16207", "#facc15"],
  ["#1e40af", "#93b4ff"],
  ["#9f1239", "#fb7185"],
];

export const STATUS = {
  formalized: "formalized",
  "in-progress": "in progress",
  partial: "partly covered",
  todo: "to do",
};

export const KIND = {
  method: "method",
  "method+evaluation": "method",
  evaluation: "method",
  "theory+method": "method",
  theory: "theory",
  "theory+algorithm": "theory",
  "theory+evaluation": "theory",
};

export const GROUP = { inference: "inference", theory: "theory" };

export const ARROW =
  '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const CHEVRON =
  '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export const short = (name) =>
  name.replace(/^lean4-phylo-/, "").replace(/-/g, " ");

export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// ---------------------------------------------------------------------------------------------
// Reading the catalogs

export function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs))
    if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export const fmt = (x) => (+x).toFixed(2);

export const hubStyle = (h) =>
  `--c-light:${h.colour[0]};--c-dark:${h.colour[1]}`;

// A glyph for an entry: round for a method, square for theory, filled by status.
export function glyph(e, x, y, r, parent, extra = {}) {
  const attrs = { class: `glyph k-${e.kind} s-${e.status}`, ...extra };
  if (e.kind === "method")
    return svgEl(
      "circle",
      { cx: fmt(x), cy: fmt(y), r: fmt(r), ...attrs },
      parent,
    );
  const s = r * 1.7;
  return svgEl(
    "rect",
    {
      x: fmt(x - s / 2),
      y: fmt(y - s / 2),
      width: fmt(s),
      height: fmt(s),
      rx: 1,
      ...attrs,
    },
    parent,
  );
}

// ---------------------------------------------------------------------------------------------
// The tree, drawn as a fan

export const SUN =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

export const MOON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

export const CROSS =
  '<svg class="ico-x" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

// a country by its name, from the two letters of its ISO code
const REGIONS = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code) => {
  try {
    return (code && REGIONS.of(code)) || code || "";
  } catch {
    return code || "";
  }
};

// the year an entry is placed at: the first of a range ("2025–2026"), or null
export const yearOf = (e) => {
  const m = String(e.year).match(/\d{4}/);
  return m ? +m[0] : null;
};

export const yearSort = (a, b) =>
  (yearOf(a) || 0) - (yearOf(b) || 0) || a.name.localeCompare(b.name);

export const when = (a, b) =>
  a && b ? (a === b ? a : `${a}–${b}`) : a ? `${a}–` : b ? `–${b}` : "";
