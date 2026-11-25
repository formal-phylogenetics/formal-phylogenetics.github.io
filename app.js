// The catalogue of formal phylogenetics. It reads the registry of the collection and the catalog of
// each hub from GitHub and shows the entries in two views: the tree of the collection, drawn as a
// fan, and the timeline of the entries with the citations between them, stored with the site by
// snapshot.py. Below them, each hub opens to its families and their entries. The page is drawn into #app; the host page gives the header
// and the footer.
//
// One visual language throughout: colour is the hub; shape is the kind of paper, round for a
// method and square for theory; fill is the status, solid once formalized, half while in progress.

const ORG = "formal-phylogenetics";
const ROOT = "lean4-phylogenetics";
const RAW = (repo, path) =>
  `https://raw.githubusercontent.com/${ORG}/${repo}/main/${path}`;
const TOML = "https://cdn.jsdelivr.net/npm/smol-toml@1.9.1/+esm";
const SVGNS = "http://www.w3.org/2000/svg";
const HERE = (file) => new URL(file, import.meta.url);

// The colour of each hub, for light and for dark pages; a hub not named here takes a spare colour.
const COLOURS = {
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
const SPARE = [
  ["#0f766e", "#4fd1c5"],
  ["#a16207", "#facc15"],
  ["#1e40af", "#93b4ff"],
  ["#9f1239", "#fb7185"],
];
const STATUS = {
  formalized: "formalized",
  "in-progress": "in progress",
  partial: "partly covered",
  todo: "to do",
};
const KIND = {
  method: "method",
  "method+evaluation": "method",
  evaluation: "method",
  "theory+method": "method",
  theory: "theory",
  "theory+algorithm": "theory",
  "theory+evaluation": "theory",
};
const GROUP = { inference: "inference", theory: "theory" };

const ARROW =
  '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON =
  '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const short = (name) => name.replace(/^lean4-phylo-/, "").replace(/-/g, " ");
const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

// ---------------------------------------------------------------------------------------------
// Reading the catalogs

async function loadLive() {
  const { parse } = await import(TOML);
  const read = async (repo, path) => {
    const r = await fetch(RAW(repo, path), { cache: "no-cache" });
    if (!r.ok) throw new Error(`${repo}/${path}: ${r.status}`);
    return parse(await r.text());
  };
  const registry = await read(ROOT, "collection/repos.toml");
  const hubs = (registry.repo || []).filter((r) => r.role === "hub");
  const cats = await Promise.all(
    hubs.map((h) => read(h.name, "catalog/papers.toml").catch(() => null)),
  );
  const catalogs = {};
  hubs.forEach((h, i) => {
    if (cats[i])
      catalogs[h.name] = {
        family: cats[i].family || [],
        paper: cats[i].paper || [],
      };
  });
  return { hubs, catalogs, source: "live" };
}

async function loadSnapshot() {
  const r = await fetch(HERE("catalogue.json"));
  if (!r.ok) throw new Error("no snapshot");
  return { ...(await r.json()), source: "snapshot" };
}

function citeName(p) {
  const a = String(p.authors || "").trim();
  let who;
  if (/et al\.?$/.test(a)) who = a.replace(/\s*et al\.?$/, " et al.");
  else {
    const names = a.split(/\s*,\s*|\s+and\s+/).filter(Boolean);
    who =
      names.length <= 1
        ? names[0] || ""
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names[0]} et al.`;
  }
  return `${who} ${p.year ?? ""}`.trim();
}

function model(data) {
  const children = (name) => data.hubs.filter((h) => h.parent === name);
  let spare = 0;
  const hubs = [];
  const visit = (h, depth, group, parent) => {
    const colour = COLOURS[h.name] || SPARE[spare++ % SPARE.length];
    const cat = data.catalogs[h.name];
    const families = [...((cat && cat.family) || [])]
      .sort((a, b) => a.id - b.id)
      .map((f) => ({ id: f.id, title: f.title, entries: [] }));
    const byId = new Map(families.map((f) => [f.id, f]));
    const hub = {
      ...h,
      depth,
      group,
      colour,
      families,
      parent,
      subhubs: [],
      loaded: Boolean(cat),
      entries: [],
    };
    const papers = [...((cat && cat.paper) || [])].sort(
      (a, b) => a.family - b.family || a.order - b.order,
    );
    for (const p of papers) {
      const f = byId.get(p.family);
      if (!f) continue;
      const status = STATUS[p.status] ? p.status : "todo";
      const repo = p.repo || `lean4-${p.id}`; // the default of the collection's tools
      const repoUrl =
        (status === "formalized" || status === "in-progress") && p.commit
          ? `https://github.com/${ORG}/${repo}`
          : null;
      const e = {
        key: `${h.name}/${p.id}`,
        name: p.short || citeName(p),
        named: Boolean(p.short),
        kind: KIND[p.kind] || (p.short ? "method" : "theory"),
        title: p.title || "",
        authors: p.authors || "",
        year: p.year ?? "",
        status,
        url: repoUrl || p.url,
        repoUrl,
        paperUrl: p.url,
        family: f,
        hub,
      };
      e.hay = fold(`${e.name} ${e.title} ${e.authors} ${e.year}`);
      f.entries.push(e);
      hub.entries.push(e);
    }
    hubs.push(hub);
    for (const c of children(h.name))
      hub.subhubs.push(visit(c, depth + 1, group, hub));
    return hub;
  };
  const top = children(ROOT);
  const groups = [...new Set(top.map((h) => h.kind || "inference"))].map(
    (group) => ({
      group,
      hubs: top
        .filter((h) => (h.kind || "inference") === group)
        .map((h) => visit(h, 0, group, null)),
    }),
  );
  return { groups, hubs, entries: hubs.flatMap((h) => h.entries) };
}

// ---------------------------------------------------------------------------------------------
// SVG helpers

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs))
    if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
const fmt = (x) => (+x).toFixed(2);
const hubStyle = (h) => `--c-light:${h.colour[0]};--c-dark:${h.colour[1]}`;

// A glyph for an entry: round for a method, square for theory, filled by status.
function glyph(e, x, y, r, parent, extra = {}) {
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

const G = {
  w: 1240,
  cx: 620,
  cy: 500,
  stem: 34,
  group: 94,
  hub: 162,
  subStep: 56,
  fam: 282,
  leaf: { formalized: 362, "in-progress": 354, partial: 341, todo: 336 },
  wedge: 374,
  label: 390,
  a0: 177.5,
  a1: 2.5,
};
const P = (r, a) => [
  G.cx + r * Math.cos((a * Math.PI) / 180),
  G.cy - r * Math.sin((a * Math.PI) / 180),
];

function arcD(r, a0, a1) {
  const [x0, y0] = P(r, a0);
  const [x1, y1] = P(r, a1);
  return `M${fmt(x0)} ${fmt(y0)}A${r} ${r} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} ${a0 > a1 ? 1 : 0} ${fmt(x1)} ${fmt(y1)}`;
}
function sectorD(r0, r1, a0, a1) {
  const [x0, y0] = P(r1, a0);
  const [x1, y1] = P(r1, a1);
  const [x2, y2] = P(r0, a1);
  const [x3, y3] = P(r0, a0);
  return `M${fmt(x0)} ${fmt(y0)}A${r1} ${r1} 0 0 1 ${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}A${r0} ${r0} 0 0 0 ${fmt(x3)} ${fmt(y3)}Z`;
}
function radial(r0, r1, a, cls, delay, parent, width) {
  const [x0, y0] = P(r0, a);
  const [x1, y1] = P(r1, a);
  return svgEl(
    "line",
    {
      x1: fmt(x0),
      y1: fmt(y0),
      x2: fmt(x1),
      y2: fmt(y1),
      class: cls,
      pathLength: 1,
      style: `--d:${Math.round(delay)}ms`,
      "stroke-width": width,
    },
    parent,
  );
}
function arc(r, a0, a1, cls, delay, parent, width) {
  if (Math.abs(a0 - a1) < 1e-6) return null;
  return svgEl(
    "path",
    {
      d: arcD(r, a0, a1),
      class: cls,
      pathLength: 1,
      style: `--d:${Math.round(delay)}ms`,
      "stroke-width": width,
    },
    parent,
  );
}

// Each group of hubs takes an equal part of the fan; inside it, one step per entry, a wider step
// between families and between hubs, and a sub-hub follows its hub as a family would.
function layout(m) {
  const famGap = 0.9; // in steps between tips
  const hubGap = 2.6; // in degrees
  const subGap = 1.4;
  const groupGap = 8;
  const span =
    (G.a0 - G.a1 - groupGap * (m.groups.length - 1)) / m.groups.length;
  const weight = (h) => Math.sqrt(Math.max(1, h.entries.length));
  const slots = [];
  m.groups.forEach((g, gi) => {
    const order = [];
    const walk = (h) => {
      order.push(h);
      h.subhubs.forEach(walk);
    };
    g.hubs.forEach(walk);
    const gaps = order.reduce(
      (s, h, i) => s + (i ? (h.depth ? subGap : hubGap) : 0),
      0,
    );
    const total = order.reduce((s, h) => s + weight(h), 0);
    let a = G.a0 - gi * (span + groupGap);
    order.forEach((h, hi) => {
      if (hi) a -= h.depth ? subGap : hubGap;
      const hubSpan = ((span - gaps) * weight(h)) / total;
      const fams = h.families.filter((f) => f.entries.length);
      const n = fams.reduce((s, f) => s + f.entries.length, 0);
      if (!n) {
        h.unit = hubSpan;
        slots.push({ hub: h, a: a - hubSpan / 2, unit: hubSpan });
        a -= hubSpan;
        return;
      }
      // the tips sit half a step inside the hub's span, a family's first tip a little further on
      const unit = hubSpan / (n + famGap * (fams.length - 1));
      h.unit = unit;
      let b = a - unit / 2;
      let first = true;
      for (const f of fams) {
        if (!first) b -= famGap * unit;
        for (const e of f.entries) {
          if (!first) b -= unit;
          first = false;
          e.a = b;
          slots.push({ entry: e, hub: h, family: f, a: b, unit });
        }
      }
      a -= hubSpan;
    });
  });
  return slots;
}

// The cover: the groups of hubs, theory on the left and inference on the right; a sub-hub is drawn
// as part of its hub.
function coverModel(m) {
  const flat = (h) => [h, ...h.subhubs.flatMap(flat)];
  const groups = [...m.groups]
    .sort(
      (p, q) => (p.group === "theory" ? 0 : 1) - (q.group === "theory" ? 0 : 1),
    )
    .map((g) => ({
      group: g.group,
      hubs: g.hubs.map((h) => {
        const all = flat(h);
        return {
          ...h,
          depth: 0,
          parent: null,
          subhubs: [],
          families: all.flatMap((x) => x.families),
          entries: all.flatMap((x) => x.entries),
        };
      }),
    }));
  return { groups, hubs: groups.flatMap((g) => g.hubs) };
}

// The names of the hubs, level: on the left of the fan they end at their wedge, on the right they
// start there, at the top they are centred on it. A name that would cover one placed before it
// moves outward along its wedge's direction until it does not.
function placeNames(names) {
  const placed = [];
  const gap = 4;
  const hits = (b) =>
    placed.some(
      (q) =>
        b.x < q.x + q.width + gap &&
        q.x < b.x + b.width + gap &&
        b.y < q.y + q.height + gap &&
        q.y < b.y + b.height + gap,
    );
  for (const n of [...names].sort(
    (p, q) => Math.abs(p.a - 90) - Math.abs(q.a - 90),
  )) {
    const anchor = n.a > 96 ? "end" : n.a < 84 ? "start" : "middle";
    n.t.setAttribute("text-anchor", anchor);
    let box;
    for (let r = G.label; r < G.label + 160; r += 6) {
      const [x, y] = P(r, n.a);
      n.t.setAttribute(
        "x",
        fmt(x + (anchor === "end" ? -2 : anchor === "start" ? 2 : 0)),
      );
      n.t.setAttribute("y", fmt(y));
      box = n.t.getBBox();
      if (!hits(box)) break;
    }
    placed.push(box);
  }
}

function drawFan(svg, m) {
  const slots = layout(m);
  svg.setAttribute("viewBox", `0 0 ${G.w} ${G.cy + 40}`);
  const defs = svgEl("defs", {}, svg);
  const grad = svgEl("radialGradient", { id: "glow" }, defs);
  svgEl(
    "stop",
    { offset: "0", "stop-color": "var(--glow-1)", "stop-opacity": "0.95" },
    grad,
  );
  svgEl(
    "stop",
    { offset: "0.5", "stop-color": "var(--glow-2)", "stop-opacity": "0.3" },
    grad,
  );
  svgEl(
    "stop",
    { offset: "1", "stop-color": "var(--glow-2)", "stop-opacity": "0" },
    grad,
  );
  const layer = {};
  for (const k of ["rings", "hubs", "branches", "labels", "root"])
    layer[k] = svgEl("g", {}, svg);
  const sweep = (a) => ((G.a0 - a) / (G.a0 - G.a1)) * 650;

  const famRange = new Map();
  const hubRange = new Map(); // its tips, its sub-hubs' included
  const ownRange = new Map(); // its own tips
  const grow = (map, k, a) => {
    const r = map.get(k) || { a0: a, a1: a };
    r.a1 = a;
    map.set(k, r);
  };
  for (const s of slots) {
    if (s.family) grow(famRange, s.family, s.a);
    grow(ownRange, s.hub, s.a);
    for (let h = s.hub; h; h = h.parent) grow(hubRange, h, s.a);
  }
  const mid = (r) => (r.a0 + r.a1) / 2;
  const hubRadius = (h) => G.hub + h.depth * G.subStep;
  const node = new Map();
  const place = (h) => {
    const kids = h.families
      .filter((f) => famRange.has(f))
      .map((f) => mid(famRange.get(f)));
    h.subhubs.forEach((s) => kids.push(place(s)));
    const a = kids.length
      ? (Math.max(...kids) + Math.min(...kids)) / 2
      : mid(ownRange.get(h));
    node.set(h, { a, kids });
    return a;
  };
  const groups = m.groups.map((g) => {
    const as = g.hubs.map(place);
    return { g, as, a: (Math.max(...as) + Math.min(...as)) / 2 };
  });

  const names = [];
  for (const h of m.hubs) {
    const g = svgEl(
      "g",
      { class: "hub-c", style: hubStyle(h), "data-hub": h.name },
      layer.hubs,
    );
    h.g = g;
    const all = hubRange.get(h);
    const half = (h.unit || 1) * 0.5;
    const r = hubRadius(h);
    if (!h.depth)
      svgEl(
        "path",
        {
          d: sectorD(r - 10, G.wedge, all.a0 + half, all.a1 - half),
          class: "wedge",
        },
        g,
      );
    else {
      // a sub-hub: a band along the rim of its hub's wedge, over its own tips
      const own = hubRange.get(h);
      svgEl(
        "path",
        {
          d: sectorD(G.fam - 6, G.wedge, own.a0 + half, own.a1 - half),
          class: "wedge sub",
        },
        g,
      );
      svgEl(
        "path",
        { d: arcD(G.wedge + 5, own.a0 + half, own.a1 - half), class: "band" },
        g,
      );
    }
    const { kids } = node.get(h);
    if (kids.length > 1)
      arc(
        r,
        Math.max(...kids),
        Math.min(...kids),
        "hubline anim",
        380 + sweep(node.get(h).a) * 0.4,
        g,
        2.4,
      );
    for (const f of h.families) {
      if (!famRange.has(f)) continue;
      const fr = famRange.get(f);
      radial(
        r,
        G.fam,
        mid(fr),
        "hubline anim",
        520 + sweep(mid(fr)) * 0.5,
        g,
        1.8,
      );
      arc(
        G.fam,
        fr.a0,
        fr.a1,
        "hubline anim",
        760 + sweep(mid(fr)) * 0.6,
        g,
        1.6,
      );
      for (const e of f.entries) {
        radial(
          G.fam,
          G.leaf[e.status],
          e.a,
          `leaf anim s-${e.status}`,
          900 + sweep(e.a),
          g,
          e.status === "formalized" ? 2.6 : 1.3,
        );
        if (e.status === "formalized" || e.status === "in-progress") {
          const [x, y] = P(G.leaf[e.status] + 5, e.a);
          const bud = glyph(e, x, y, e.status === "formalized" ? 4.6 : 3.4, g, {
            style: `--d:${Math.round(1500 + sweep(e.a))}ms`,
          });
          bud.classList.add("bud");
        }
      }
    }
    for (const s of h.subhubs)
      radial(
        r,
        hubRadius(s),
        node.get(s).a,
        "hubline anim",
        470 + sweep(node.get(s).a) * 0.4,
        g,
        2.2,
      );
    // the name, level, beyond the rim, over the hub's tips
    const la = mid(hubRange.get(h));
    const t = svgEl(
      "text",
      {
        "dominant-baseline": "central",
        class: `hubname fade${h.depth ? " subname" : ""}`,
        style: `--d:${Math.round(1300 + sweep(la) * 0.5)}ms`,
      },
      g,
    );
    t.textContent = short(h.name);
    names.push({ t, a: la });
  }

  for (const { g, as, a } of groups) {
    for (const ha of as)
      radial(G.group, G.hub, ha, "branch anim", 240, layer.branches, 2.6);
    if (as.length > 1)
      arc(
        G.group,
        Math.max(...as),
        Math.min(...as),
        "branch anim",
        160,
        layer.branches,
        2.8,
      );
    radial(G.stem, G.group, a, "branch anim", 80, layer.branches, 3);
    const t = svgEl(
      "text",
      {
        x: G.cx + (a > 90 ? -1 : 1) * ((G.hub + G.wedge) / 2),
        y: G.cy + 30,
        "text-anchor": "middle",
        class: "groupname fade",
        style: "--d:1100ms",
      },
      layer.labels,
    );
    t.textContent = GROUP[g.group] || g.group;
  }
  const gas = groups.map((x) => x.a);
  if (gas.length > 1)
    arc(
      G.stem,
      Math.max(...gas),
      Math.min(...gas),
      "branch anim",
      40,
      layer.branches,
      3.2,
    );
  radial(0, G.stem, 90, "branch anim", 0, layer.branches, 3.6);
  svgEl(
    "circle",
    { cx: G.cx, cy: G.cy, r: 40, fill: "url(#glow)", class: "glow" },
    layer.root,
  );
  svgEl("circle", { cx: G.cx, cy: G.cy, r: 8, class: "rootdot" }, layer.root);
  const rn = svgEl(
    "text",
    { x: G.cx, y: G.cy + 30, "text-anchor": "middle", class: "rootname" },
    layer.root,
  );
  rn.textContent = ROOT;

  const fit = () => {
    placeNames(names);
    const boxes = [...svg.children]
      .filter((c) => c.tagName === "g")
      .map((c) => c.getBBox())
      .filter((b) => b.width || b.height);
    const x0 = Math.min(...boxes.map((b) => b.x)) - 10;
    const y0 = Math.min(...boxes.map((b) => b.y)) - 10;
    const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + 10;
    const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + 10;
    svg.setAttribute(
      "viewBox",
      `${fmt(x0)} ${fmt(y0)} ${fmt(x1 - x0)} ${fmt(y1 - y0)}`,
    );
  };
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  return {};
}

function wireTimeline(svg, ui) {
  svg.addEventListener("pointermove", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.key;
    const e = k ? ui.byKey.get(k) : null;
    svg.style.cursor = e ? "pointer" : "";
    ui.hover(e, () => placeAt(ev.clientX, ev.clientY));
  });
  svg.addEventListener("pointerleave", () => ui.hover(null));
  svg.addEventListener(
    "click",
    () => ui.hovered && ui.pick(ui.hovered, "view"),
  );
}

// ---------------------------------------------------------------------------------------------
// The citations and the works, read from OpenAlex and Semantic Scholar by snapshot.py and stored
// with the site, so that a visit asks those services nothing.
async function readCitations() {
  const r = await fetch(HERE("citations.json"));
  if (!r.ok) throw new Error("no citations");
  return (await r.json()).edges;
}

// The timeline: every entry of the catalogs, in the row of its hub, at its year; time runs from
// left to right, and a citation is a curve from the citing entry back to the entry it cites. Above
// it, a trim bar chooses the years shown; a year's width grows with its papers. A row per hub, so
// that a new hub is a new row.
const yearOf = (e) => {
  const m = String(e.year).match(/\d{4}/);
  return m ? +m[0] : null;
};

function moveGlyph(e) {
  if (e.kind === "method") {
    e.node.setAttribute("cx", fmt(e.px));
    e.node.setAttribute("cy", fmt(e.py));
  } else {
    const s = e.r * 1.7;
    e.node.setAttribute("x", fmt(e.px - s / 2));
    e.node.setAttribute("y", fmt(e.py - s / 2));
  }
}

function createTimeline(els, m, links) {
  const svg = els.graph;
  const nodes = m.entries.filter((e) => yearOf(e) !== null);
  for (const e of nodes) {
    e.y4 = yearOf(e);
    e.r = Math.min(6.5, 2.8 + 0.9 * Math.sqrt(e.cited || 0));
  }
  const Y0 = Math.min(...nodes.map((e) => e.y4));
  const Y1 = Math.max(...nodes.map((e) => e.y4)) + 1;
  const count = new Map();
  for (const e of nodes) count.set(e.y4, (count.get(e.y4) || 0) + 1);
  const most = Math.max(...count.values());
  const STEP = 13;
  // a narrow screen opens on the recent years; the trim bar reaches the others
  const narrow = els.stage.clientWidth < 600;
  const st = { a: narrow ? Math.max(Y0, Y1 - 18) : Y0, b: Y1 };
  const lanes = [];
  m.groups.forEach((g) => {
    const walk = (h) => {
      lanes.push(h);
      h.subhubs.forEach(walk);
    };
    g.hubs.forEach(walk);
  });
  const byLane = new Map(
    lanes.map((h) => [
      h,
      nodes
        .filter((e) => e.hub === h)
        .sort((a, b) => a.y4 - b.y4 || (b.cited || 0) - (a.cited || 0)),
    ]),
  );

  // the elements, made once and moved by the layout
  svg.innerHTML = "";
  const gGrid = svgEl("g", { class: "grid" }, svg);
  const gLanes = svgEl("g", {}, svg);
  const laneEls = new Map(
    lanes.map((h) => {
      const g = svgEl("g", { class: "hub-c lane", style: hubStyle(h) }, gLanes);
      const bg = svgEl(
        "rect",
        { class: `lanebg${lanes.indexOf(h) % 2 ? " alt" : ""}` },
        g,
      );
      const name = svgEl(
        "text",
        { class: `lanename${h.depth ? " subname" : ""}` },
        g,
      );
      name.textContent = short(h.name);
      return [h, { bg, name }];
    }),
  );
  const gEdges = svgEl("g", { class: "edges" }, svg);
  for (const l of links)
    l.el = svgEl("path", { class: "edge", pathLength: 1 }, gEdges);
  const gNodes = svgEl("g", { class: "nodes" }, svg);
  for (const e of nodes) {
    const g = svgEl("g", { class: "hub-c", style: hubStyle(e.hub) }, gNodes);
    e.node = glyph(e, 0, 0, e.r, g);
    e.node.dataset.key = e.key;
  }

  // the trim bar: a track with the papers of each year, the shade outside the range shown, a frame
  // round it, a handle at each end, and the first and last years above the handles
  const ov = els.overview;
  ov.innerHTML = "";
  const track = svgEl("rect", { class: "ov-track", rx: 6 }, ov);
  const gBars = svgEl("g", { class: "ov-bars" }, ov);
  const bars = [];
  for (let y = Y0; y < Y1; y++)
    bars.push([y, svgEl("rect", { class: "ov-bar" }, gBars)]);
  const shadeL = svgEl("rect", { class: "ov-shade" }, ov);
  const shadeR = svgEl("rect", { class: "ov-shade" }, ov);
  const win = svgEl("rect", { class: "ov-win" }, ov);
  const outline = svgEl("rect", { class: "ov-frame", rx: 2 }, ov);
  const handle = (name, side) => {
    const h = svgEl(
      "rect",
      {
        class: `ov-handle ${side}`,
        rx: 3,
        width: 8,
        tabindex: 0,
        role: "slider",
        "aria-label": name,
        "aria-valuemin": Y0,
        "aria-valuemax": Y1 - 1,
      },
      ov,
    );
    const grip = svgEl("path", { class: "ov-grip" }, ov);
    return { h, grip };
  };
  const { h: hA, grip: gripA } = handle("First year shown", "start");
  const { h: hB, grip: gripB } = handle("Last year shown", "end");
  const tagA = svgEl("g", { class: "ov-tag" }, ov);
  const tagB = svgEl("g", { class: "ov-tag" }, ov);
  for (const g of [tagA, tagB]) {
    svgEl("rect", { rx: 4, height: 17 }, g);
    svgEl("text", { y: 12.5, "text-anchor": "middle" }, g);
  }

  const PADY = 6;
  const GAP = 3;
  const OVH = 62;
  const dims = () => {
    const W = Math.max(300, Math.round(els.stage.clientWidth));
    const L = W < 560 ? 92 : 122;
    return { W, L, PW: W - L - 14 };
  };
  const weights = () => {
    const w = [];
    for (let y = st.a; y < st.b; y++)
      w.push(0.5 + Math.sqrt(count.get(y) || 0));
    return w;
  };
  const scaleX = (d) => {
    const w = weights();
    // a year with papers is never narrower than one of them
    for (let pass = 0; pass < 4; pass++) {
      const unit = d.PW / w.reduce((s, x) => s + x, 0);
      let grew = false;
      w.forEach((x, i) => {
        if (count.get(st.a + i) && x * unit < STEP + 1) {
          w[i] = (STEP + 1) / unit;
          grew = true;
        }
      });
      if (!grew) break;
    }
    const cum = [0];
    w.forEach((x, i) => cum.push(cum[i] + x));
    const tot = cum[cum.length - 1];
    return (y) => {
      const k = Math.min(Math.max(Math.floor(y) - st.a, 0), w.length - 1);
      return d.L + ((cum[k] + (y - st.a - k) * w[k]) / tot) * d.PW;
    };
  };
  const xo = (d, y) => d.L + ((y - Y0) / (Y1 - Y0)) * d.PW;
  const yo = (d, x) => Y0 + ((x - d.L) / d.PW) * (Y1 - Y0);

  function ticks(d, X) {
    const out = [];
    const room = (x) => out.every(([, p]) => Math.abs(p - x) >= 36);
    for (const every of [10, 5, 1]) {
      for (let y = Math.ceil(st.a / every) * every; y < st.b; y += every) {
        const x = X(y + 0.5);
        if (every === 1 && X(y + 1) - X(y) < 26) continue;
        if (!out.some(([v]) => v === y) && room(x)) out.push([y, x]);
      }
    }
    return out.sort((p, q) => p[0] - q[0]);
  }

  function layout() {
    const d = dims();
    const X = scaleX(d);
    let top = 4;
    for (const h of lanes) {
      const cells = new Map();
      for (const e of byLane.get(h)) {
        e.vis = e.y4 >= st.a && e.y4 < st.b;
        if (!e.vis) continue;
        if (!cells.has(e.y4)) cells.set(e.y4, []);
        cells.get(e.y4).push(e);
      }
      let rows = 1;
      for (const [y, cell] of cells) {
        const x0 = X(y);
        const w = Math.max(0, X(y + 1) - x0);
        const cols = Math.max(1, Math.floor((w - 1) / STEP));
        const used = Math.min(cell.length, cols);
        cell.forEach((e, i) => {
          e.px = x0 + w / 2 + ((i % cols) - (used - 1) / 2) * STEP;
          e.row = Math.floor(i / cols);
        });
        rows = Math.max(rows, Math.ceil(cell.length / cols));
      }
      const height = rows * STEP + 2 * PADY;
      for (const cell of cells.values())
        for (const e of cell) e.py = top + PADY + e.row * STEP + STEP / 2;
      const { bg, name } = laneEls.get(h);
      for (const [k, v] of Object.entries({
        x: 2,
        y: top,
        width: d.W - 4,
        height,
      }))
        bg.setAttribute(k, fmt(v));
      name.setAttribute("x", h.depth ? 20 : 10);
      name.setAttribute("y", fmt(top + Math.min(height / 2, STEP) + 4));
      top += height + GAP;
    }
    const H = top + 2;
    svg.setAttribute("viewBox", `0 0 ${d.W} ${fmt(H)}`);
    svg.setAttribute("height", fmt(H));
    for (const e of nodes) {
      e.node.style.display = e.vis ? "" : "none";
      if (e.vis) moveGlyph(e);
    }
    for (const l of links) {
      const p = l.source;
      const q = l.target;
      if (!p.vis || !q.vis) {
        l.el.style.display = "none";
        continue;
      }
      l.el.style.display = "";
      const mid = (p.px + q.px) / 2;
      l.el.setAttribute(
        "d",
        `M${fmt(p.px)} ${fmt(p.py)}C${fmt(mid)} ${fmt(p.py)} ${fmt(mid)} ${fmt(q.py)} ${fmt(q.px)} ${fmt(q.py)}`,
      );
    }

    // the years: labels above the rows, lines across them
    const marks = ticks(d, X);
    els.axis.setAttribute("viewBox", `0 0 ${d.W} 22`);
    els.axis.innerHTML = marks
      .map(
        ([y, x]) =>
          `<text class="tick" x="${fmt(x)}" y="15" text-anchor="middle">${y}</text>`,
      )
      .join("");
    gGrid.innerHTML = marks
      .map(
        ([, x]) =>
          `<line class="gridline" x1="${fmt(x)}" x2="${fmt(x)}" y1="0" y2="${fmt(H)}"/>`,
      )
      .join("");

    // the trim bar
    const TY = 22;
    const TH = 36;
    ov.setAttribute("viewBox", `0 0 ${d.W} ${OVH}`);
    for (const [k, v] of Object.entries({
      x: d.L,
      y: TY,
      width: d.PW,
      height: TH,
    }))
      track.setAttribute(k, fmt(v));
    const bw = d.PW / (Y1 - Y0);
    for (const [y, r] of bars) {
      const h = ((count.get(y) || 0) / most) * (TH - 8);
      for (const [k, v] of Object.entries({
        x: xo(d, y) + 0.5,
        y: TY + TH - 4 - h,
        width: Math.max(1, bw - 1),
        height: h,
      }))
        r.setAttribute(k, fmt(v));
    }
    const xa = xo(d, st.a);
    const xb = xo(d, st.b);
    for (const [r, x0, x1] of [
      [shadeL, d.L, xa],
      [shadeR, xb, d.L + d.PW],
    ])
      for (const [k, v] of Object.entries({
        x: x0,
        y: TY,
        width: Math.max(0, x1 - x0),
        height: TH,
      }))
        r.setAttribute(k, fmt(v));
    for (const [k, v] of Object.entries({
      x: xa,
      y: TY,
      width: Math.max(1, xb - xa),
      height: TH,
    }))
      win.setAttribute(k, fmt(v));
    for (const [k, v] of Object.entries({
      x: xa - 1,
      y: TY - 2,
      width: Math.max(2, xb - xa + 2),
      height: TH + 4,
    }))
      outline.setAttribute(k, fmt(v));
    for (const [h, grip, x, v] of [
      [hA, gripA, xa - 8, st.a],
      [hB, gripB, xb, st.b - 1],
    ]) {
      h.setAttribute("x", fmt(x));
      h.setAttribute("y", TY - 2);
      h.setAttribute("height", TH + 4);
      h.setAttribute("aria-valuenow", v);
      h.setAttribute("aria-valuetext", String(v));
      const gx = x + 4;
      grip.setAttribute(
        "d",
        `M${fmt(gx - 2)} ${TY + 11}V${TY + TH - 11}M${fmt(gx + 2)} ${TY + 11}V${TY + TH - 11}`,
      );
    }
    const tag = (g, x, text) => {
      const w = text.length * 7 + 12;
      g.setAttribute(
        "transform",
        `translate(${fmt(Math.min(Math.max(x, d.L + w / 2), d.L + d.PW - w / 2))} 0)`,
      );
      g.firstChild.setAttribute("x", fmt(-w / 2));
      g.firstChild.setAttribute("width", fmt(w));
      g.lastChild.textContent = text;
    };
    if (xb - xa < 64) {
      tag(
        tagA,
        (xa + xb) / 2,
        st.b - st.a === 1 ? String(st.a) : `${st.a}–${st.b - 1}`,
      );
      tagB.style.display = "none";
    } else {
      tag(tagA, xa - 6, String(st.a));
      tag(tagB, xb + 6, String(st.b - 1));
      tagB.style.display = "";
    }
    els.allYears.disabled = st.a === Y0 && st.b === Y1;
  }

  let frame = 0;
  const schedule = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        layout();
      });
  };
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let glideTimer = 0;
  const glide = () => {
    if (still()) return;
    svg.classList.add("glide");
    clearTimeout(glideTimer);
    glideTimer = setTimeout(() => svg.classList.remove("glide"), 420);
  };
  const setWindow = (a, b, smooth = false) => {
    const w = Math.max(1, Math.min(b - a, Y1 - Y0));
    a = Math.max(Y0, Math.min(a, Y1 - w));
    if (smooth) glide();
    st.a = Math.round(a);
    st.b = Math.round(a + w);
    schedule();
  };

  // dragging: a handle moves its end, the window moves as a whole, elsewhere centres the window
  let drag = null;
  ov.addEventListener("pointerdown", (ev) => {
    const d = dims();
    const x = ev.clientX - ov.getBoundingClientRect().left;
    const y = yo(d, x);
    const kind =
      ev.target === hA
        ? "a"
        : ev.target === hB
          ? "b"
          : ev.target === win
            ? "move"
            : "jump";
    if (kind === "jump")
      setWindow(
        Math.round(y - (st.b - st.a) / 2),
        Math.round(y - (st.b - st.a) / 2) + (st.b - st.a),
        true,
      );
    drag = { kind: kind === "jump" ? "move" : kind, y0: y, a0: st.a, b0: st.b };
    ov.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  ov.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const d = dims();
    const y = yo(d, ev.clientX - ov.getBoundingClientRect().left);
    if (drag.kind === "a") {
      st.a = Math.max(Y0, Math.min(Math.round(y), st.b - 1));
      schedule();
    } else if (drag.kind === "b") {
      st.b = Math.min(Y1, Math.max(Math.round(y), st.a + 1));
      schedule();
    } else {
      const dy = Math.round(y - drag.y0);
      setWindow(drag.a0 + dy, drag.b0 + dy);
    }
  });
  const stop = () => (drag = null);
  ov.addEventListener("pointerup", stop);
  ov.addEventListener("pointercancel", stop);
  ov.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const d = dims();
      const at = yo(d, ev.clientX - ov.getBoundingClientRect().left);
      const w = st.b - st.a;
      const next = Math.max(
        2,
        Math.min(Y1 - Y0, Math.round(w * (ev.deltaY > 0 ? 1.2 : 1 / 1.2))),
      );
      const f = (at - st.a) / w;
      setWindow(at - f * next, at - f * next + next);
    },
    { passive: false },
  );
  const keys = (end) => (ev) => {
    const step = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowUp: 1,
      PageDown: -5,
      PageUp: 5,
    }[ev.key];
    if (step == null && ev.key !== "Home" && ev.key !== "End") return;
    ev.preventDefault();
    glide();
    if (end === "a")
      st.a =
        ev.key === "Home"
          ? Y0
          : ev.key === "End"
            ? st.b - 1
            : Math.max(Y0, Math.min(st.a + step, st.b - 1));
    else
      st.b =
        ev.key === "End"
          ? Y1
          : ev.key === "Home"
            ? st.a + 1
            : Math.min(Y1, Math.max(st.b + step, st.a + 1));
    schedule();
  };
  hA.addEventListener("keydown", keys("a"));
  hB.addEventListener("keydown", keys("b"));
  els.allYears.addEventListener("click", () => setWindow(Y0, Y1, true));
  new ResizeObserver(schedule).observe(els.stage);

  return {
    layout,
    ensure(e) {
      if (e.y4 == null || (e.y4 >= st.a && e.y4 < st.b)) return;
      const w = st.b - st.a;
      const a = Math.max(Y0, Math.min(e.y4 - Math.floor(w / 2), Y1 - w));
      glide();
      st.a = a;
      st.b = a + w;
      layout();
    },
    // the entrance: once the timeline comes into view, its papers appear year by year from the
    // left, and the citations behind them
    enter() {
      if (still() || !("IntersectionObserver" in window)) return;
      const d = dims();
      for (const e of nodes)
        if (e.vis)
          e.node.style.setProperty(
            "--d",
            `${Math.round(((e.px - d.L) / d.PW) * 1100)}ms`,
          );
      svg.classList.add("pending");
      const io = new IntersectionObserver(
        (seen) => {
          if (!seen.some((x) => x.isIntersecting)) return;
          io.disconnect();
          svg.classList.remove("pending");
          svg.classList.add("enter");
          setTimeout(() => svg.classList.remove("enter"), 2200);
        },
        { threshold: 0.12 },
      );
      io.observe(svg);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The card of an entry: what the catalog says at once, then the authors, the venue and the
// abstract stored in works.json.

const card = { el: null, entry: null, pinned: null, timer: 0, place: () => {} };

let worksFile = null;
function readWork(e) {
  if (!worksFile)
    worksFile = fetch(HERE("works.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  return worksFile.then((all) => all[e.key] || {});
}

function cardHtml(e, work, waiting) {
  const list =
    work && work.authors && work.authors.length ? work.authors : null;
  const who = list
    ? list.length > 6
      ? `${list.slice(0, 6).join(", ")} et al.`
      : list.join(", ")
    : e.authors;
  const venue = work && work.venue ? ` · ${work.venue}` : "";
  let text = (work && work.abstract) || "";
  if (text.length > 900)
    text = `${text.slice(0, text.lastIndexOf(" ", 880))} …`;
  const body = text
    ? `<p class="t-abstract">${esc(text)}</p>`
    : waiting
      ? `<p class="t-wait">Reading the abstract…</p>`
      : work
        ? `<p class="t-wait">No abstract is available.</p>`
        : "";
  const cited = e.cited ? ` · cited by ${e.cited} in the catalogs` : "";
  return `<div class="t-head"><span class="t-name k-${e.kind}">${esc(e.name)}</span><span class="t-kind">${e.kind}</span></div>
    <div class="t-title">${esc(e.title)}</div>
    <div class="t-by">${esc(who)}${e.year ? ` (${esc(e.year)})` : ""}${esc(venue)}</div>
    ${body}
    <div class="t-foot"><span class="t-status">${esc(STATUS[e.status])}</span><span>${esc(short(e.hub.name))} › ${esc(e.family.title)}${esc(cited)}</span></div>
    <div class="t-hint">${card.pinned === e ? "Click to unpin" : "Click to pin"}</div>`;
}

function showCard(e, place) {
  const tip = card.el;
  card.place = place;
  if (card.entry !== e) {
    card.entry = e;
    clearTimeout(card.timer);
    tip.style.cssText = hubStyle(e.hub);
    tip.innerHTML = cardHtml(e, e.work, !e.work);
    if (!e.work) {
      card.timer = setTimeout(async () => {
        e.work = await readWork(e);
        if (card.entry === e) {
          tip.innerHTML = cardHtml(e, e.work, false);
          card.place();
        }
      }, 160);
    }
  }
  tip.hidden = false;
  place();
}

function hideCard() {
  card.entry = null;
  clearTimeout(card.timer);
  if (card.el) card.el.hidden = true;
}

function placeAt(x, y) {
  const tip = card.el;
  let left = x + 18;
  let top = y + 18;
  if (left + tip.offsetWidth > innerWidth - 12) left = x - tip.offsetWidth - 18;
  if (top + tip.offsetHeight > innerHeight - 12)
    top = y - tip.offsetHeight - 18;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function placeBy(rect) {
  const tip = card.el;
  let top = rect.bottom + 8;
  if (top + tip.offsetHeight > innerHeight - 12)
    top = rect.top - tip.offsetHeight - 8;
  tip.style.left = `${Math.min(Math.max(8, rect.left), innerWidth - tip.offsetWidth - 12)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

// ---------------------------------------------------------------------------------------------
// The page: the list of the hubs beside the views and the panel of the selected entry. Pointing at
// an entry anywhere marks it everywhere; a click pins it and shows what it cites (ink) and what
// cites it (amber), and a click on the pinned entry unpins it. The panel's links open it.

const SUN =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const MOON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const CROSS =
  '<svg class="ico-x" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

function tagHtml(e, extra = "") {
  return `<a class="tag k-${e.kind} ${e.named ? "named" : "cite"} s-${e.status}${extra}" data-key="${esc(e.key)}" href="${esc(e.url || "#")}" target="_blank" rel="noopener" aria-label="${esc(`${e.name}: ${e.title}`)}">${esc(e.name)}</a>`;
}

function hubRow(h) {
  const n = h.entries.length;
  const done = h.entries.filter((e) => e.status === "formalized").length;
  const going = h.entries.filter((e) => e.status === "in-progress").length;
  const pct = (k) => (n ? (100 * k) / n : 0).toFixed(2);
  const fams = h.loaded
    ? h.families
        .filter((f) => f.entries.length)
        .map(
          (f) =>
            `<div class="family"><h4>${esc(f.title)}</h4><div class="tags">${f.entries.map((e) => tagHtml(e)).join("")}</div></div>`,
        )
        .join("")
    : `<p class="empty">The catalog could not be read.</p>`;
  return `<details class="hub hub-c${h.depth ? " sub" : ""}" id="${esc(h.name)}" style="${hubStyle(h)}">
      <summary>
        <span class="h-name">${esc(h.title || short(h.name))}</span>
        <span class="h-count" title="formalized of the catalog's entries">${done}/${n}</span>
        ${CHEVRON}
      </summary>
      <div class="h-body">
        <a class="h-repo" href="https://github.com/${ORG}/${esc(h.name)}">${esc(h.name)}${ARROW}</a>
        ${fams}
      </div>
    </details>${h.subhubs.map(hubRow).join("")}`;
}

function shell(app) {
  app.innerHTML = `
    <section class="hero">
      <div class="intro">
        <h1>Formal Phylogenetics</h1>
        <p class="sub">Phylogenetic methods and theory, formalized in Lean.</p>
        <dl class="meta">
          <div><dt>Maintainer</dt><dd><a href="https://vltanh.me">The-Anh Vu-Le</a>, with the help of Claude and ChatGPT</dd></div>
          <div><dt>Skills</dt><dd><a href="https://github.com/vltanh/formalize-math-paper">formalize-math-paper</a>, <a href="https://impeccable.style">impeccable</a></dd></div>
          <div id="updated-row" hidden><dt>Updated</dt><dd id="updated"></dd></div>
        </dl>
      </div>
      <figure class="cover">
        <svg id="fan" class="view" role="img" aria-label="The tree of the collection: the root, the hubs, their families and their entries"></svg>
      </figure>
    </section>
    <div class="explorer">
      <div class="work">
      <section class="timeline" aria-label="The entries along time, and the citations between them">
        <div class="side-top">
          <span class="key" aria-label="Legend">
            <span class="k-item"><i class="sw k-method"></i>method</span>
            <span class="k-item"><i class="sw k-theory"></i>theory</span>
            <span class="k-item"><i class="sw s-formalized"></i>formalized</span>
            <span class="k-item"><i class="ln out"></i>cites</span>
            <span class="k-item"><i class="ln in"></i>cited by</span>
          </span>
          <div class="slider">
            <button type="button" class="s-all" id="all-years" disabled>All years</button>
            <svg id="overview" class="overview" role="group" aria-label="The years shown: drag the window or its ends, or scroll to zoom"></svg>
          </div>
          <svg id="axis" class="axis" aria-hidden="true"></svg>
        </div>
        <div class="stage" id="stage">
          <svg id="graph" class="view" role="img" aria-label="The entries of the catalogs along time, a row for each hub, and the citations between them"></svg>
          <p class="note" id="note" aria-live="polite"></p>
        </div>
      </section>
      <aside class="detail">
        <section class="panel" id="panel" aria-live="polite" aria-label="The pinned entry"></section>
      </aside>
      </div>
      <div class="find">
        <input id="q" type="search" placeholder="Search a method, a title or an author" aria-label="Search the catalogue" autocomplete="off" />
        <button type="button" class="fold-all" id="fold-all"></button>
      </div>
      <section class="hubs" id="hubs" aria-label="The hubs"></section>
    </div>`;
}

// The theme: the system's, until the reader chooses; the choice is kept as vltanh.me keeps it.
function themeNow() {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function wireTheme(btn) {
  const paint = () => {
    const dark = themeNow() === "dark";
    btn.innerHTML = `${dark ? SUN : MOON}<span>${dark ? "Light" : "Dark"}</span>`;
    const label = dark ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("aria-label", label);
    btn.title = label;
  };
  btn.addEventListener("click", () => {
    const next = themeNow() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch (err) {
      /* the choice lasts for this visit */
    }
    paint();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);
  paint();
}

function renderPanel(ui) {
  const p = ui.els.panel;
  const e = ui.selected;
  p.classList.toggle("empty", !e);
  if (!e) {
    p.innerHTML = "";
    return;
  }
  const FIRST = 12;
  const rel = (label, list, cls) => {
    const head = `<h3>${label}${list ? ` <span>${list.length}</span>` : ""}</h3>`;
    if (!list)
      return `<div class="p-rel ${cls}">${head}<p class="p-none">${ui.citations === "failed" ? "The citations could not be read." : "Reading the citations…"}</p></div>`;
    if (!list.length)
      return `<div class="p-rel ${cls}">${head}<p class="p-none">None in the catalogs.</p></div>`;
    const more =
      list.length > FIRST
        ? `<button type="button" class="p-more" data-rel="${cls}">+${list.length - FIRST} more</button>`
        : "";
    return `<div class="p-rel ${cls}">${head}<div class="tags">${list
      .slice(0, FIRST)
      .map((x) => tagHtml(x, " mini"))
      .join("")}${more}</div></div>`;
  };
  const ready = ui.citations === true;
  p.innerHTML = `<div class="p-head hub-c" style="${hubStyle(e.hub)}">
      <span class="p-name ${e.named ? "named" : "cite"}">${esc(e.name)}</span>
      <span class="p-meta">${esc(e.kind)} · ${esc(STATUS[e.status])}</span>
      <button type="button" class="p-close" aria-label="Clear the selection">${CROSS}</button>
    </div>
    <div class="p-title">${esc(e.title)}</div>
    <div class="p-by" id="p-by">${esc(e.authors)}${e.year ? ` (${esc(e.year)})` : ""}</div>
    <div class="p-links">
      ${e.repoUrl ? `<a class="btn primary" href="${esc(e.repoUrl)}" target="_blank" rel="noopener">Formalization${ARROW}</a>` : ""}
      ${e.paperUrl ? `<a class="btn" href="${esc(e.paperUrl)}" target="_blank" rel="noopener">Paper${ARROW}</a>` : ""}
      <span class="p-where">${esc(short(e.hub.name))} › ${esc(e.family.title)}</span>
    </div>
    ${rel("Cites", ready ? ui.cites.get(e) || [] : null, "out")}
    ${rel("Cited by", ready ? ui.citedBy.get(e) || [] : null, "in")}
    <details class="p-abs" id="p-abs" hidden><summary>Abstract</summary><p class="p-abstract" id="p-abstract"></p></details>`;
  p.querySelector(".p-close").addEventListener("click", () => ui.select(null));
  for (const b of p.querySelectorAll(".p-more")) {
    b.addEventListener("click", () => {
      const list =
        (b.dataset.rel === "out" ? ui.cites : ui.citedBy).get(e) || [];
      b.parentElement.innerHTML = list.map((x) => tagHtml(x, " mini")).join("");
    });
  }
  p.scrollTop = 0;
  readWork(e).then((w) => {
    if (ui.selected !== e || !w) return;
    const by = p.querySelector("#p-by");
    const list = w.authors && w.authors.length ? w.authors : null;
    if (by && (list || w.venue)) {
      const who = list
        ? list.length > 8
          ? `${list.slice(0, 8).join(", ")} et al.`
          : list.join(", ")
        : e.authors;
      by.textContent = `${who}${e.year ? ` (${e.year})` : ""}${w.venue ? ` · ${w.venue}` : ""}`;
    }
    const ab = p.querySelector("#p-abstract");
    if (ab && w.abstract) {
      ab.textContent = w.abstract;
      p.querySelector("#p-abs").hidden = false;
    }
  });
}

function makeUi(m, els) {
  const ui = {
    m,
    els,
    byKey: new Map(m.entries.map((e) => [e.key, e])),
    selected: null,
    hovered: null,
    citations: false,
    cites: new Map(),
    citedBy: new Map(),
    edgesOf: new Map(),
    links: [],
  };
  const smooth = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const wide = () => matchMedia("(min-width: 1100px)").matches;
  let marked = [];
  ui.mark = (e) => {
    for (const [el, cls] of marked) el.classList.remove(cls);
    marked = [];
    const add = (el, cls) => {
      if (el) {
        el.classList.add(cls);
        marked.push([el, cls]);
      }
    };
    els.graph.classList.toggle("focus", Boolean(e));
    if (!e) return;
    for (const el of [e.node, e.tag]) add(el, "sel");
    for (const x of ui.cites.get(e) || [])
      for (const el of [x.node, x.tag]) add(el, "out");
    for (const x of ui.citedBy.get(e) || [])
      for (const el of [x.node, x.tag]) add(el, "in");
    for (const l of ui.edgesOf.get(e) || [])
      add(l.el, l.source === e ? "out" : "in");
  };
  ui.hover = (e, place) => {
    if (e === ui.hovered) {
      if (e && place) {
        card.place = place;
        place();
      }
      return;
    }
    ui.hovered = e;
    if (e) showCard(e, place);
    else hideCard();
    ui.mark(e || ui.selected);
  };
  ui.pick = (e, from) => {
    ui.select(e && ui.selected === e ? null : e, from);
  };
  ui.select = (e, from) => {
    ui.selected = e;
    card.pinned = e;
    ui.hovered = null;
    hideCard();
    ui.mark(e);
    renderPanel(ui);
    history.replaceState(
      null,
      "",
      e ? `#${encodeURIComponent(e.key)}` : location.pathname + location.search,
    );
    if (!e) return;
    if (e.hub.el) e.hub.el.open = true;
    if (ui.timeline) ui.timeline.ensure(e);
    if (e.node && from === "hash") ui.reveal(e);
  };
  ui.reveal = (e) => {
    if (ui.timeline) ui.timeline.ensure(e);
    if (!e.node || e.node.style.display === "none") return;
    // the node, in the middle of the window
    const r = e.node.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top - innerHeight / 2, behavior: smooth() });
  };
  ui.openHub = (h) => {
    h.el.open = true;
    h.el.scrollIntoView({
      block: wide() ? "nearest" : "start",
      behavior: smooth(),
    });
  };
  ui.useCitations = (raw) => {
    ui.links = raw
      .map(([a, b]) => ({ source: ui.byKey.get(a), target: ui.byKey.get(b) }))
      .filter((l) => l.source && l.target);
    for (const e of m.entries) e.cited = 0;
    for (const l of ui.links) {
      l.target.cited += 1;
      if (!ui.cites.has(l.source)) ui.cites.set(l.source, []);
      if (!ui.citedBy.has(l.target)) ui.citedBy.set(l.target, []);
      ui.cites.get(l.source).push(l.target);
      ui.citedBy.get(l.target).push(l.source);
      for (const x of [l.source, l.target]) {
        if (!ui.edgesOf.has(x)) ui.edgesOf.set(x, []);
        ui.edgesOf.get(x).push(l);
      }
    }
    const byYear = (a, b) => String(a.year).localeCompare(String(b.year));
    for (const list of [...ui.cites.values(), ...ui.citedBy.values()])
      list.sort(byYear);
    ui.citations = true;
    if (ui.selected) renderPanel(ui);
    ui.mark(ui.hovered || ui.selected);
  };
  return ui;
}

function wireList(ui) {
  const entryOf = (t) => (t ? ui.byKey.get(t.dataset.key) : null);
  const tagAt = (ev) =>
    ev.target.closest ? ev.target.closest("a.tag[data-key]") : null;
  document.addEventListener("pointerover", (ev) => {
    const t = tagAt(ev);
    if (!t || ev.pointerType === "touch") return;
    ui.hover(entryOf(t), () => placeBy(t.getBoundingClientRect()));
  });
  document.addEventListener("pointerout", (ev) => {
    const t = tagAt(ev);
    if (t && !t.contains(ev.relatedTarget)) ui.hover(null);
  });
  document.addEventListener("focusin", (ev) => {
    const t = tagAt(ev);
    if (t) ui.hover(entryOf(t), () => placeBy(t.getBoundingClientRect()));
  });
  document.addEventListener("focusout", (ev) => tagAt(ev) && ui.hover(null));
  document.addEventListener("click", (ev) => {
    const t = tagAt(ev);
    const e = entryOf(t);
    if (
      !e ||
      ev.button !== 0 ||
      ev.metaKey ||
      ev.ctrlKey ||
      ev.shiftKey ||
      ev.altKey
    )
      return;
    ev.preventDefault();
    ui.pick(e, t.closest(".panel") ? "panel" : "list");
  });
  addEventListener(
    "scroll",
    () => card.entry && !card.el.hidden && card.place(),
    { passive: true },
  );
  addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    hideCard();
    if (ui.selected && !ev.target.closest?.("input")) ui.select(null);
  });
}

async function main() {
  const app = document.getElementById("app");
  shell(app);
  card.el = document.createElement("div");
  card.el.className = "card";
  card.el.setAttribute("role", "tooltip");
  card.el.hidden = true;
  document.body.appendChild(card.el);
  const els = {
    fan: document.getElementById("fan"),
    graph: document.getElementById("graph"),
    stage: document.getElementById("stage"),
    panel: document.getElementById("panel"),
    hubs: document.getElementById("hubs"),
    note: document.getElementById("note"),
    axis: document.getElementById("axis"),
    overview: document.getElementById("overview"),
    allYears: document.getElementById("all-years"),
  };
  // when the collection last changed: the last push to one of its public repositories
  fetch(
    `https://api.github.com/orgs/${ORG}/repos?sort=pushed&direction=desc&per_page=1`,
  )
    .then((r) => (r.ok ? r.json() : []))
    .then((repos) => {
      const at = repos[0] && repos[0].pushed_at;
      if (!at) return;
      const shown = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(at));
      document.getElementById("updated").innerHTML =
        `<time datetime="${esc(at)}">${esc(shown)}</time>`;
      document.getElementById("updated-row").hidden = false;
    })
    .catch(() => {});
  const themeBtn = document.getElementById("theme");
  if (themeBtn) wireTheme(themeBtn);
  els.note.textContent = "Reading the catalogs…";
  let data;
  try {
    data = await loadLive();
  } catch (err) {
    try {
      data = await loadSnapshot();
    } catch (err2) {
      els.note.textContent = "The catalogs could not be read from GitHub.";
      return;
    }
  }
  const m = model(data);
  els.hubs.innerHTML = m.groups
    .map(
      (g) =>
        `<h2>${esc(GROUP[g.group] || g.group)}</h2>${g.hubs.map(hubRow).join("")}`,
    )
    .join("");
  for (const h of m.hubs) {
    h.el = document.getElementById(h.name);
    const tags = h.el.querySelectorAll(":scope > .h-body .tag");
    h.entries.forEach((e, i) => (e.tag = tags[i]));
  }
  // one button opens every hub, or closes them all once one is open
  const foldAll = document.getElementById("fold-all");
  const paintFold = () => {
    const any = m.hubs.some((h) => h.el.open);
    foldAll.textContent = any ? "Collapse all" : "Expand all";
    foldAll.setAttribute("aria-expanded", String(any));
  };
  foldAll.addEventListener("click", () => {
    const open = !m.hubs.some((h) => h.el.open);
    for (const h of m.hubs) h.el.open = open;
    paintFold();
  });
  for (const h of m.hubs) h.el.addEventListener("toggle", paintFold);
  paintFold();
  const ui = makeUi(m, els);
  els.fan.classList.add("grow");
  drawFan(els.fan, coverModel(m));
  wireTimeline(els.graph, ui);
  wireList(ui);
  renderPanel(ui);
  els.note.textContent =
    data.source === "snapshot"
      ? "GitHub could not be reached: a snapshot of the catalogs."
      : "";

  // the citations, read once in the background for the panel, the cover and the timeline
  els.note.textContent = "Reading the citations…";
  readCitations()
    .then((raw) => {
      ui.useCitations(raw);
      ui.timeline = createTimeline(els, m, ui.links);
      ui.timeline.layout();
      ui.timeline.enter();
      els.note.textContent = ui.links.length
        ? ""
        : "No citations could be read.";
      filter();
      ui.mark(ui.hovered || ui.selected);
      if (ui.selected && ui.selected.node) ui.reveal(ui.selected);
    })
    .catch(() => {
      ui.citations = "failed";
      els.note.textContent = "The citations could not be read.";
      if (ui.selected) renderPanel(ui);
    });

  // the search: it dims what does not match, in the views and in the list
  const q = document.getElementById("q");
  const opened = new Set();
  const filter = () => {
    const words = fold(q.value).split(/\s+/).filter(Boolean);
    const on = words.length > 0;
    let any = false;
    for (const h of m.hubs) {
      let hits = 0;
      for (const e of h.entries) {
        const ok = !on || words.every((w) => e.hay.includes(w));
        hits += ok;
        if (e.tag) e.tag.hidden = !ok;
        for (const el of [e.node]) if (el) el.classList.toggle("off", !ok);
      }
      any = any || hits > 0;
      for (const f of h.el.querySelectorAll(":scope > .h-body .family"))
        f.hidden = !f.querySelector(".tag:not([hidden])");
      if (on) {
        if (hits && !h.el.open) {
          h.el.open = true;
          opened.add(h);
        }
        h.el.classList.toggle("miss", !hits);
      } else {
        h.el.classList.remove("miss");
        if (opened.has(h)) h.el.open = false;
      }
    }
    if (!on) opened.clear();
    // a citation stays when one of its ends matches
    const hit = (e) => !on || words.every((w) => e.hay.includes(w));
    for (const l of ui.links)
      if (l.el)
        l.el.classList.toggle("off", on && !hit(l.source) && !hit(l.target));
    if (on && !any) els.note.textContent = "No entry matches the search.";
    else if (els.note.textContent === "No entry matches the search.")
      els.note.textContent = "";
  };
  q.addEventListener("input", filter);

  // a selection in the address is restored
  const key = decodeURIComponent(location.hash.slice(1));
  if (ui.byKey.has(key)) ui.select(ui.byKey.get(key), "hash");
}

main();
