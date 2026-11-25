// The catalogue of formal phylogenetics. It reads the registry of the collection and the catalog of
// each hub from GitHub and shows the entries in two views: the tree of the collection, drawn as a
// fan, and the citations between the entries, read from OpenAlex. Below the views, each hub opens
// to its families and their entries. The page is drawn into #app; the host page gives the header
// and the footer.
//
// One visual language throughout: colour is the hub; shape is the kind of paper, round for a
// method and square for theory; fill is the status, solid once formalized, half while in progress.

const ORG = "formal-phylogenetics";
const ROOT = "lean4-phylogenetics";
const RAW = (repo, path) =>
  `https://raw.githubusercontent.com/${ORG}/${repo}/main/${path}`;
const TOML = "https://cdn.jsdelivr.net/npm/smol-toml@1.9.1/+esm";
const OPENALEX = "https://api.openalex.org/works";
const S2 = "https://api.semanticscholar.org/graph/v1/paper/";
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
  const GAP = { family: 0.9, hub: 3.2 };
  const groupGap = 7;
  const span =
    (G.a0 - G.a1 - groupGap * (m.groups.length - 1)) / m.groups.length;
  const slots = [];
  m.groups.forEach((g, gi) => {
    const mine = [];
    let extra = 0;
    const order = [];
    const walk = (h) => {
      order.push(h);
      h.subhubs.forEach(walk);
    };
    g.hubs.forEach(walk);
    order.forEach((h, hi) => {
      if (hi) extra += h.depth ? GAP.family : GAP.hub;
      const fams = h.families.filter((f) => f.entries.length);
      if (!fams.length) {
        mine.push({ extra, hub: h });
        extra = 0;
        return;
      }
      fams.forEach((f, fi) => {
        if (fi) extra += GAP.family;
        for (const e of f.entries) {
          mine.push({ extra, entry: e, hub: h, family: f });
          extra = 0;
        }
      });
    });
    const total = mine.reduce((s, x, i) => s + (i ? 1 + x.extra : 0), 0);
    const unit = total ? span / total : span;
    let a = G.a0 - gi * (span + groupGap) - (total ? 0 : span / 2);
    mine.forEach((s, i) => {
      if (i) a -= (1 + s.extra) * unit;
      s.a = a;
      s.unit = unit;
      s.hub.unit = unit;
      if (s.entry) s.entry.a = a;
    });
    slots.push(...mine);
  });
  return slots;
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

  // The rings of the levels, named on the left.
  svgEl(
    "line",
    {
      x1: G.cx - G.wedge - 30,
      y1: G.cy,
      x2: G.cx + G.wedge + 30,
      y2: G.cy,
      class: "baseline",
    },
    layer.rings,
  );
  for (const [r, name] of [
    [G.hub, "hubs"],
    [G.fam, "families"],
    [(G.leaf.todo + G.leaf.formalized) / 2, "entries"],
  ]) {
    svgEl("path", { d: arcD(r, 180, 0), class: "ring" }, layer.rings);
    const t = svgEl(
      "text",
      {
        x: fmt(G.cx - r),
        y: G.cy + 22,
        "text-anchor": "middle",
        class: "ringname fade",
        style: "--d:1500ms",
      },
      layer.rings,
    );
    t.textContent = name;
  }

  for (const h of m.hubs) {
    const g = svgEl(
      "g",
      { class: "hub-c", style: hubStyle(h), "data-hub": h.name },
      layer.hubs,
    );
    h.g = g;
    const all = hubRange.get(h);
    const half = (h.unit || 1) * 0.75;
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
        e.leaf = radial(
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
          e.bud = glyph(e, x, y, e.status === "formalized" ? 4.6 : 3.4, g, {
            style: `--d:${Math.round(1500 + sweep(e.a))}ms`,
          });
          e.bud.classList.add("bud");
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
    // the name, radially beyond the rim: a hub over all its tips, a sub-hub over its own, smaller
    const la = h.depth ? mid(hubRange.get(h)) : mid(ownRange.get(h));
    const [lx, ly] = P(G.label + (h.depth ? 6 : 0), la);
    const left = la > 90;
    const t = svgEl(
      "text",
      {
        transform: `translate(${fmt(lx)} ${fmt(ly)}) rotate(${fmt(left ? 180 - la : -la)})`,
        "text-anchor": left ? "end" : "start",
        "dominant-baseline": "central",
        class: `hubname fade${h.depth ? " subname" : ""}`,
        style: `--d:${Math.round(1300 + sweep(la) * 0.5)}ms`,
      },
      g,
    );
    t.textContent = short(h.name);
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
        x: G.cx + (a > 90 ? -1 : 1) * 104,
        y: G.cy - 14,
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

  const pick = svgEl("line", { class: "pick", visibility: "hidden" }, svg);
  return { tips: slots.filter((s) => s.entry), hubRange, pick };
}

function wireFan(svg, fan, m, ui) {
  const tips = fan.tips; // by decreasing angle
  let lit = null;
  const toSvg = (ev) => {
    const p = svg.createSVGPoint();
    p.x = ev.clientX;
    p.y = ev.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  const nearest = (a) => {
    let lo = 0;
    let hi = tips.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tips[mid].a > a) lo = mid + 1;
      else hi = mid;
    }
    const c = [tips[lo], tips[lo - 1]].filter(Boolean);
    return c.reduce(
      (b, s) => (Math.abs(s.a - a) < Math.abs(b.a - a) ? s : b),
      c[0],
    );
  };
  const related = (x, h) => {
    for (let p = h; p; p = p.parent) if (p === x) return true;
    for (let p = x; p; p = p.parent) if (p === h) return true;
    return false;
  };
  const light = (h) => {
    if (h === lit) return;
    lit = h;
    for (const x of m.hubs) {
      x.g.classList.toggle("lit", x === h);
      x.g.classList.toggle("dim", Boolean(h) && !related(x, h));
    }
  };
  const hubAt = (a) => {
    let best = null;
    for (const h of m.hubs) {
      const r = fan.hubRange.get(h);
      const pad = (h.unit || 0.3) * 0.8;
      if (
        r &&
        a <= r.a0 + pad &&
        a >= r.a1 - pad &&
        (!best || h.depth > best.depth)
      )
        best = h;
    }
    return best;
  };
  svg.addEventListener("pointermove", (ev) => {
    const p = toSvg(ev);
    const dx = p.x - G.cx;
    const dy = G.cy - p.y;
    const r = Math.hypot(dx, dy);
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (dy < -8 || r < G.hub - 14 || r > G.label + 140) {
      ui.hover(null);
      light(null);
      svg.style.cursor = "";
      return;
    }
    const s = r >= G.fam - 8 && r <= G.wedge + 26 ? nearest(a) : null;
    const hit =
      s &&
      Math.abs(s.a - a) <= Math.max(s.unit * 0.8, 0.35) &&
      !s.entry.leaf.classList.contains("off");
    light(hit || ui.selected ? null : hubAt(a));
    svg.style.cursor = hit || hubAt(a) ? "pointer" : "";
    ui.hover(hit ? s.entry : null, () => placeAt(ev.clientX, ev.clientY));
  });
  svg.addEventListener("pointerleave", () => {
    ui.hover(null);
    light(null);
  });
  svg.addEventListener("click", () => {
    if (ui.hovered) ui.pick(ui.hovered, "cover");
    else if (lit) ui.openHub(lit);
  });
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
// The citations between the entries, read from OpenAlex

function workId(url) {
  const u = String(url || "");
  let m;
  if ((m = u.match(/(?:doi\.org|dl\.acm\.org\/doi)\/(10\.[^?#]+)$/i))) {
    const doi = decodeURIComponent(m[1]);
    return { doi: doi.toLowerCase(), openalex: `doi:${doi}`, s2: `DOI:${doi}` };
  }
  if ((m = u.match(/arxiv\.org\/abs\/([^?#]+?)(?:v\d+)?$/i))) {
    const doi = `10.48550/arxiv.${m[1]}`.toLowerCase();
    return { doi, openalex: `doi:${doi}`, s2: `ARXIV:${m[1]}` };
  }
  if ((m = u.match(/biorxiv\.org\/content\/(10\.1101\/[\d.]+)/i)))
    return {
      doi: m[1].toLowerCase(),
      openalex: `doi:${m[1]}`,
      s2: `DOI:${m[1]}`,
    };
  if ((m = u.match(/ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i)))
    return { openalex: `pmcid:${m[1]}`, s2: `PMCID:${m[1].slice(3)}` };
  if ((m = u.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)))
    return { openalex: `pmid:${m[1]}`, s2: `PMID:${m[1]}` };
  return null;
}

async function readCitationsLive(m, progress) {
  const byDoi = new Map();
  for (const e of m.entries) {
    const id = workId(e.paperUrl);
    if (id && id.doi && !/[,|]/.test(id.doi)) byDoi.set(id.doi, e);
  }
  const dois = [...byDoi.keys()];
  const byWork = new Map();
  const refs = new Map();
  for (let i = 0; i < dois.length; i += 50) {
    const chunk = dois.slice(i, i + 50);
    const url = `${OPENALEX}?filter=doi:${chunk.map((d) => encodeURIComponent(d).replace(/%2F/gi, "/")).join("|")}&select=id,doi,referenced_works&per-page=50`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`OpenAlex: ${r.status}`);
    for (const w of (await r.json()).results || []) {
      const e = byDoi.get(
        String(w.doi || "")
          .replace(/^https?:\/\/doi\.org\//i, "")
          .toLowerCase(),
      );
      if (!e) continue;
      byWork.set(w.id, e);
      refs.set(e, w.referenced_works || []);
    }
    progress(Math.min(1, (i + 50) / dois.length));
  }
  const edges = [];
  for (const [e, rs] of refs)
    for (const w of rs)
      if (byWork.has(w) && byWork.get(w) !== e)
        edges.push([e.key, byWork.get(w).key]);
  return edges;
}

async function readCitations(m, progress) {
  const cached = sessionStorage.getItem("fp-citations");
  if (cached) return JSON.parse(cached);
  let edges;
  try {
    edges = await readCitationsLive(m, progress);
  } catch (err) {
    const r = await fetch(HERE("citations.json"));
    edges = r.ok ? (await r.json()).edges : [];
  }
  try {
    sessionStorage.setItem("fp-citations", JSON.stringify(edges));
  } catch (err) {
    /* the cache is a convenience */
  }
  return edges;
}

// The timeline: every entry of the catalogs, in the column of its hub and the row of its year
// (of its decade before 1990), oldest at the top; a citation is a curve from the citing entry up
// to the entry it cites.
const yearOf = (e) => {
  const m = String(e.year).match(/\d{4}/);
  return m ? +m[0] : null;
};
const binOf = (y) => (y < 1990 ? Math.floor(y / 10) * 10 : y);
const binName = (b) => (b < 1990 ? `${b}s` : String(b));

function drawTimeline(svg, m, links) {
  const W = 1180;
  const AXIS = 54;
  const TOP = 58;
  const PAD = 6;

  // the columns: the hubs in the order of the fan, a sub-hub next to its hub, wider for more entries
  const lanes = [];
  m.groups.forEach((g, gi) => {
    const walk = (h) => {
      lanes.push({ hub: h, group: gi });
      h.subhubs.forEach(walk);
    };
    g.hubs.forEach(walk);
  });
  const groupGap = 22;
  const weight = (lane) => Math.sqrt(lane.hub.entries.length) + 2.5;
  const free = W - AXIS - groupGap * (m.groups.length - 1);
  const total = lanes.reduce((s, l) => s + weight(l), 0);
  let x = AXIS;
  lanes.forEach((l, k) => {
    if (k && l.group !== lanes[k - 1].group) x += groupGap;
    l.x0 = x;
    l.x1 = x + (free * weight(l)) / total;
    x = l.x1;
  });

  // the rows: each bin of years as tall as its fullest column needs
  const nodes = m.entries.filter((e) => yearOf(e) !== null);
  for (const e of nodes) e.r = Math.min(10, 3.2 + 1.3 * Math.sqrt(e.cited));
  const bins = [...new Set(nodes.map((e) => binOf(yearOf(e))))].sort(
    (a, b) => a - b,
  );
  const cell = new Map(); // `${lane}|${bin}` -> entries
  const laneOf = new Map(lanes.map((l) => [l.hub, l]));
  for (const e of nodes) {
    const k = `${lanes.indexOf(laneOf.get(e.hub))}|${binOf(yearOf(e))}`;
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(e);
  }
  let y = TOP;
  const rows = [];
  for (const b of bins) {
    let height = 0;
    lanes.forEach((l, li) => {
      const mine = cell.get(`${li}|${b}`) || [];
      let cx = l.x0 + PAD;
      let line = 0;
      let lineH = 0;
      let used = 0;
      for (const e of mine) {
        const d = 2 * e.r + 3;
        if (cx + d > l.x1 - PAD && cx > l.x0 + PAD) {
          line += lineH;
          cx = l.x0 + PAD;
          lineH = 0;
        }
        e.x = cx + e.r;
        e.dy = line + e.r;
        cx += d;
        lineH = Math.max(lineH, d);
        used = line + lineH;
      }
      height = Math.max(height, used);
    });
    rows.push({ b, y, height });
    for (const e of nodes) if (binOf(yearOf(e)) === b) e.y = y + 4 + e.dy;
    y += Math.max(height, 6) + 8;
  }
  const H = y + 10;
  svg.setAttribute("viewBox", `0 0 ${W + 70} ${H}`); // room for the names of the last columns

  // the grid: a line and a label for each decade and each fifth year
  const grid = svgEl("g", { class: "grid" }, svg);
  for (const r of rows) {
    if (!(r.b < 1990 || r.b % 5 === 0)) continue;
    svgEl(
      "line",
      { x1: AXIS - 6, y1: fmt(r.y), x2: W, y2: fmt(r.y), class: "gridline" },
      grid,
    );
    const t = svgEl(
      "text",
      { x: AXIS - 10, y: fmt(r.y + 4), "text-anchor": "end", class: "year" },
      grid,
    );
    t.textContent = binName(r.b);
  }
  for (const l of lanes) {
    const g = svgEl("g", { class: "hub-c lane", style: hubStyle(l.hub) }, svg);
    svgEl(
      "rect",
      {
        x: fmt(l.x0 + 1),
        y: TOP - 6,
        width: fmt(l.x1 - l.x0 - 2),
        height: fmt(H - TOP - 4),
        class: "lanebg",
      },
      g,
    );
    const t = svgEl(
      "text",
      {
        transform: `translate(${fmt((l.x0 + l.x1) / 2)} ${TOP - 12}) rotate(-40)`,
        class: `lanename${l.hub.depth ? " subname" : ""}`,
      },
      g,
    );
    t.textContent = short(l.hub.name);
  }

  const gEdges = svgEl("g", { class: "edges" }, svg);
  for (const l of links) {
    const { source: a, target: b } = l;
    const mid = (a.y + b.y) / 2;
    l.el = svgEl(
      "path",
      {
        d: `M${fmt(a.x)} ${fmt(a.y)}C${fmt(a.x)} ${fmt(mid)} ${fmt(b.x)} ${fmt(mid)} ${fmt(b.x)} ${fmt(b.y)}`,
        class: "edge",
      },
      gEdges,
    );
  }
  const gNodes = svgEl("g", { class: "nodes" }, svg);
  for (const e of nodes) {
    const g = svgEl("g", { class: "hub-c", style: hubStyle(e.hub) }, gNodes);
    e.node = glyph(e, e.x, e.y, e.r, g);
    e.node.dataset.key = e.key;
  }
  return { nodes };
}

// ---------------------------------------------------------------------------------------------
// The card of an entry: what the catalog says at once, then the authors, the venue and the
// abstract from OpenAlex, or from Semantic Scholar when OpenAlex has no abstract.

const works = new Map();
const card = { el: null, entry: null, timer: 0, place: () => {} };

function invert(index) {
  const words = [];
  for (const [w, at] of Object.entries(index || {}))
    for (const k of at) words[k] = w;
  return words.join(" ");
}
const tidy = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s*(abstract|summary)\b[\s.:]*/i, "")
    .trim();

function readWork(e) {
  const id = workId(e.paperUrl);
  if (!id) return Promise.resolve({});
  if (!works.has(id.openalex)) {
    works.set(
      id.openalex,
      (async () => {
        const out = {};
        try {
          const r = await fetch(
            `${OPENALEX}/${encodeURI(id.openalex)}?select=authorships,primary_location,abstract_inverted_index`,
          );
          if (r.ok) {
            const w = await r.json();
            out.authors = (w.authorships || [])
              .map((a) => a.author && a.author.display_name)
              .filter(Boolean);
            out.venue =
              w.primary_location && w.primary_location.source
                ? w.primary_location.source.display_name
                : "";
            out.abstract = tidy(invert(w.abstract_inverted_index));
          }
        } catch (err) {
          /* the card keeps what the catalog says */
        }
        if (!out.abstract) {
          try {
            const r = await fetch(
              `${S2}${encodeURI(id.s2)}?fields=abstract,venue,authors`,
            );
            if (r.ok) {
              const p = await r.json();
              out.abstract = tidy(p.abstract);
              out.venue = out.venue || p.venue || "";
              if (!(out.authors && out.authors.length))
                out.authors = (p.authors || []).map((a) => a.name);
            }
          } catch (err) {
            /* idem */
          }
        }
        return out;
      })(),
    );
  }
  return works.get(id.openalex);
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
    <div class="t-foot"><span class="t-status">${esc(STATUS[e.status])}</span><span>${esc(short(e.hub.name))} › ${esc(e.family.title)}${esc(cited)}</span></div>`;
}

function showCard(e, place) {
  const tip = card.el;
  card.place = place;
  if (card.entry !== e) {
    card.entry = e;
    clearTimeout(card.timer);
    const id = workId(e.paperUrl);
    tip.style.cssText = hubStyle(e.hub);
    tip.innerHTML = cardHtml(e, e.work, !e.work && Boolean(id));
    if (!e.work && id) {
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
// an entry anywhere marks it everywhere; the first click selects it and shows what it cites (ink)
// and what cites it (amber); a second click opens its formalization, or the paper.

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
        <span class="h-bar" aria-hidden="true"><i style="width:${pct(done)}%"></i><b style="width:${pct(going)}%"></b></span>
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
        <p class="sub">Phylogenetic methods and theory, as the tree of a collection of Lean&nbsp;4 formalizations.</p>
        <p class="by">Maintained by <a href="https://vltanh.me">The-Anh Vu-Le</a>, with the help of Claude and ChatGPT.</p>
      </div>
      <figure class="cover">
        <svg id="fan" class="view" role="img" aria-label="The tree of the collection: the root, the hubs, their families and their entries"></svg>
      </figure>
    </section>
    <div class="bar" id="bar">
      <input id="q" type="search" placeholder="Search a method, a title or an author" aria-label="Search the catalogue" autocomplete="off" />
      <button type="button" class="theme" id="theme"></button>
    </div>
    <div class="explorer">
      <section class="hubs" id="hubs" aria-label="The hubs"></section>
      <aside class="side">
        <div class="side-head">
          <h2>Citations along time</h2>
          <span class="key" aria-label="Legend">
            <span class="k-group"><span class="k-item"><i class="sw k-method kind"></i>method</span><span class="k-item"><i class="sw k-theory kind"></i>theory</span></span>
            <span class="k-group"><span class="k-item"><i class="sw s-formalized"></i>formalized</span><span class="k-item"><i class="sw s-in-progress"></i>in progress</span><span class="k-item"><i class="sw s-todo"></i>to do</span></span>
            <span class="k-group"><span class="k-item"><i class="ln out"></i>cites</span><span class="k-item"><i class="ln in"></i>cited by</span></span>
          </span>
        </div>
        <div class="stage" id="stage">
          <svg id="graph" class="view" role="img" aria-label="The entries of the catalogs along time, and the citations between them"></svg>
          <p class="note" id="note" aria-live="polite"></p>
        </div>
        <section class="panel" id="panel" aria-live="polite" aria-label="The selected entry"></section>
      </aside>
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
    btn.innerHTML = dark ? SUN : MOON;
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
  if (!e) {
    p.innerHTML = `<p class="p-hint">Select an entry in a view or in the list to follow its citations. Select it again to open it.</p>`;
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
    fan: null,
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
    for (const el of [els.fan, els.graph])
      el.classList.toggle("focus", Boolean(e));
    const pick = ui.fan && ui.fan.pick;
    if (!e) {
      if (pick) pick.setAttribute("visibility", "hidden");
      return;
    }
    for (const el of [e.leaf, e.bud, e.node, e.tag]) add(el, "sel");
    for (const x of ui.cites.get(e) || [])
      for (const el of [x.leaf, x.bud, x.node, x.tag]) add(el, "out");
    for (const x of ui.citedBy.get(e) || [])
      for (const el of [x.leaf, x.bud, x.node, x.tag]) add(el, "in");
    for (const l of ui.edgesOf.get(e) || [])
      add(l.el, l.source === e ? "out" : "in");
    if (pick && e.a != null) {
      const [x0, y0] = P(G.fam, e.a);
      const [x1, y1] = P(G.leaf[e.status] + 6, e.a);
      for (const [k, v] of Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }))
        pick.setAttribute(k, fmt(v));
      pick.setAttribute("visibility", "visible");
    }
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
    if (e && ui.selected === e) {
      if (e.url) window.open(e.url, "_blank", "noopener");
      return;
    }
    ui.select(e, from);
  };
  ui.select = (e, from) => {
    ui.selected = e;
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
    if (from === "cover")
      els.bar.scrollIntoView({ block: "start", behavior: smooth() });
    else if (from !== "list" && e.tag && wide())
      e.tag.scrollIntoView({ block: "nearest", behavior: smooth() });
    if (e.node && from !== "view") ui.reveal(e);
  };
  ui.reveal = (e) => {
    const st = els.stage;
    const r = e.node.getBoundingClientRect();
    const s = st.getBoundingClientRect();
    st.scrollTo({
      top: st.scrollTop + (r.top - s.top) - st.clientHeight / 2,
      behavior: smooth(),
    });
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
    if (ui.selected !== e) {
      ev.preventDefault();
      ui.select(e, t.closest(".panel") ? "panel" : "list");
    }
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
    bar: document.getElementById("bar"),
  };
  wireTheme(document.getElementById("theme"));
  const barHeight = () =>
    document.documentElement.style.setProperty(
      "--bar-h",
      `${els.bar.offsetHeight}px`,
    );
  barHeight();
  addEventListener("resize", barHeight);
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
  const ui = makeUi(m, els);
  els.fan.classList.add("grow");
  ui.fan = drawFan(els.fan, m);
  wireFan(els.fan, ui.fan, m, ui);
  wireTimeline(els.graph, ui);
  wireList(ui);
  renderPanel(ui);
  els.note.textContent =
    data.source === "snapshot"
      ? "GitHub could not be reached: a snapshot of the catalogs."
      : "";

  // the citations, read once in the background for the panel, the cover and the timeline
  els.note.textContent = "Reading the citations…";
  readCitations(m, () => {})
    .then((raw) => {
      ui.useCitations(raw);
      drawTimeline(els.graph, m, ui.links);
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
        for (const el of [e.leaf, e.bud, e.node])
          if (el) el.classList.toggle("off", !ok);
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
