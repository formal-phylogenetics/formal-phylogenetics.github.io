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
  let current = null;
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
  const off = () => {
    hideCard();
    fan.pick.setAttribute("visibility", "hidden");
    current = null;
  };
  svg.addEventListener("pointermove", (ev) => {
    const p = toSvg(ev);
    const dx = p.x - G.cx;
    const dy = G.cy - p.y;
    const r = Math.hypot(dx, dy);
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (dy < -8 || r < G.hub - 14 || r > G.label + 140) {
      off();
      light(null);
      svg.style.cursor = "";
      return;
    }
    const h = hubAt(a);
    light(h);
    const s = r >= G.fam - 8 && r <= G.wedge + 26 ? nearest(a) : null;
    if (
      !s ||
      Math.abs(s.a - a) > Math.max(s.unit * 0.8, 0.35) ||
      s.entry.leaf.classList.contains("off")
    ) {
      off();
      svg.style.cursor = h ? "pointer" : "";
      return;
    }
    const e = s.entry;
    current = e;
    svg.style.cursor = "pointer";
    const [x0, y0] = P(G.fam, e.a);
    const [x1, y1] = P(G.leaf[e.status] + 6, e.a);
    for (const [k, v] of Object.entries({ x1: x0, y1: y0, x2: x1, y2: y1 }))
      fan.pick.setAttribute(k, fmt(v));
    fan.pick.setAttribute("visibility", "visible");
    showCard(e, () => placeAt(ev.clientX, ev.clientY));
  });
  svg.addEventListener("pointerleave", () => {
    off();
    light(null);
  });
  svg.addEventListener("click", () => {
    if (current && current.url) window.open(current.url, "_blank", "noopener");
    else if (lit) ui.openHub(lit);
  });
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

async function drawTimeline(svg, m, note) {
  const W = 1180;
  const AXIS = 54;
  const TOP = 58;
  const PAD = 6;
  note.textContent = "Reading the citations…";
  const byKey = new Map(m.entries.map((e) => [e.key, e]));
  const raw = await readCitations(
    m,
    (f) =>
      (note.textContent = `Reading the citations… ${Math.round(f * 100)}%`),
  );
  const links = raw
    .map(([a, b]) => ({ source: byKey.get(a), target: byKey.get(b) }))
    .filter((l) => l.source && l.target);
  for (const e of m.entries) e.cited = 0;
  for (const l of links) l.target.cited += 1;

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
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

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
        transform: `translate(${fmt((l.x0 + l.x1) / 2)} ${TOP - 12}) rotate(-28)`,
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
  note.textContent = links.length ? "" : "No citations could be read.";

  const ofNode = new Map(nodes.map((e) => [e, []]));
  for (const l of links) {
    ofNode.get(l.source)?.push(l);
    ofNode.get(l.target)?.push(l);
  }
  let current = null;
  const clear = () => {
    svg.classList.remove("focus");
    for (const l of links) l.el.classList.remove("out", "in");
    for (const e of nodes) e.node.classList.remove("near");
  };
  svg.addEventListener("pointermove", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.key;
    const e = k && byKey.get(k);
    if (!e) {
      if (current) {
        current = null;
        clear();
        hideCard();
      }
      return;
    }
    if (e !== current) {
      current = e;
      clear();
      svg.classList.add("focus");
      e.node.classList.add("near");
      for (const l of ofNode.get(e)) {
        l.el.classList.add(l.source === e ? "out" : "in");
        (l.source === e ? l.target : l.source).node.classList.add("near");
      }
    }
    showCard(e, () => placeAt(ev.clientX, ev.clientY));
  });
  svg.addEventListener("pointerleave", () => {
    current = null;
    clear();
    hideCard();
  });
  svg.addEventListener(
    "click",
    () =>
      current && current.url && window.open(current.url, "_blank", "noopener"),
  );
  return { nodes };
}

// ---------------------------------------------------------------------------------------------
// The card of an entry: what the catalog says at once, then the authors, the venue and the
// abstract from OpenAlex, or from Semantic Scholar when OpenAlex has no abstract.

const tagEntry = new WeakMap();
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
// The page

function tagHtml(e) {
  return `<a class="tag k-${e.kind} s-${e.status}" href="${esc(e.url || "#")}" target="_blank" rel="noopener" aria-label="${esc(`${e.name}: ${e.title}`)}">${esc(e.name)}</a>`;
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
            `<div class="family"><h4>${esc(f.title)}</h4><div class="tags">${f.entries.map(tagHtml).join("")}</div></div>`,
        )
        .join("")
    : `<p class="empty">The catalog could not be read.</p>`;
  return `<details class="hub hub-c${h.depth ? " sub" : ""}" id="${esc(h.name)}" style="${hubStyle(h)}">
      <summary>
        <span class="h-name">${esc(h.title || short(h.name))}</span>
        <span class="h-bar" aria-hidden="true"><i style="width:${pct(done)}%"></i><b style="width:${pct(going)}%"></b></span>
        <span class="h-count">${done}/${n}</span>
      </summary>
      <div class="h-body">
        <a class="h-repo" href="https://github.com/${ORG}/${esc(h.name)}">${esc(h.name)} ↗</a>
        ${fams}
      </div>
    </details>${h.subhubs.map(hubRow).join("")}`;
}

function shell(app) {
  app.innerHTML = `
    <section class="hero">
      <h1>Formal Phylogenetics</h1>
      <p class="sub">Phylogenetic methods and theory, as the tree of a collection of Lean&nbsp;4 formalizations.</p>
    </section>
    <div class="bar">
      <div class="seg" role="tablist" aria-label="View">
        <button type="button" role="tab" data-view="tree" aria-selected="true">Tree</button>
        <button type="button" role="tab" data-view="graph" aria-selected="false">Citations</button>
      </div>
      <input id="q" type="search" placeholder="Search" aria-label="Search the catalogue" autocomplete="off" />
      <span class="key" aria-label="Legend">
        <span class="k-item"><i class="sw k-method"></i>method</span>
        <span class="k-item"><i class="sw k-theory"></i>theory</span>
        <span class="k-item"><i class="sw k-method s-formalized"></i>formalized</span>
        <span class="k-item"><i class="sw k-method s-in-progress"></i>in progress</span>
        <span class="k-item"><i class="sw k-method s-todo"></i>to do</span>
      </span>
    </div>
    <div class="stage">
      <svg id="fan" class="view" role="img" aria-label="The tree of the collection: the root, the hubs, their families and their entries"></svg>
      <svg id="graph" class="view" role="img" aria-label="The entries of the catalogs along time, and the citations between them" hidden></svg>
      <p class="note" id="note" aria-live="polite"></p>
    </div>
    <section class="hubs" id="hubs" aria-label="The hubs"></section>`;
}

function wireTags(root) {
  const over = (ev) => {
    const t = ev.target.closest && ev.target.closest(".tag");
    const e = t && tagEntry.get(t);
    if (e && ev.pointerType !== "touch")
      showCard(e, () => placeBy(t.getBoundingClientRect()));
  };
  root.addEventListener("pointerover", over);
  root.addEventListener("pointerout", (ev) => {
    const t = ev.target.closest && ev.target.closest(".tag");
    if (t && !t.contains(ev.relatedTarget)) hideCard();
  });
  root.addEventListener("focusin", (ev) => {
    const t = ev.target.closest && ev.target.closest(".tag");
    const e = t && tagEntry.get(t);
    if (e) showCard(e, () => placeBy(t.getBoundingClientRect()));
  });
  root.addEventListener("focusout", hideCard);
  addEventListener(
    "scroll",
    () => card.entry && !card.el.hidden && card.place(),
    { passive: true },
  );
  addEventListener("keydown", (ev) => ev.key === "Escape" && hideCard());
}

async function main() {
  const app = document.getElementById("app");
  shell(app);
  card.el = document.createElement("div");
  card.el.className = "card";
  card.el.setAttribute("role", "tooltip");
  card.el.hidden = true;
  document.body.appendChild(card.el);
  const note = document.getElementById("note");
  note.textContent = "Reading the catalogs…";
  let data;
  try {
    data = await loadLive();
  } catch (err) {
    try {
      data = await loadSnapshot();
    } catch (err2) {
      note.textContent = "The catalogs could not be read from GitHub.";
      return;
    }
  }
  const m = model(data);
  const fanSvg = document.getElementById("fan");
  const graphSvg = document.getElementById("graph");
  const hubsEl = document.getElementById("hubs");
  hubsEl.innerHTML = m.groups
    .map(
      (g) =>
        `<h2>${esc(GROUP[g.group] || g.group)}</h2>${g.hubs.map(hubRow).join("")}`,
    )
    .join("");
  for (const h of m.hubs) {
    h.el = document.getElementById(h.name);
    const tags = h.el.querySelectorAll(":scope > .h-body .tag");
    h.entries.forEach((e, i) => {
      e.tag = tags[i];
      if (tags[i]) tagEntry.set(tags[i], e);
    });
  }
  const ui = {
    openHub(h) {
      h.el.open = true;
      h.el.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    },
  };
  fanSvg.classList.add("grow");
  const fan = drawFan(fanSvg, m);
  wireFan(fanSvg, fan, m, ui);
  wireTags(hubsEl);
  note.textContent =
    data.source === "snapshot"
      ? "GitHub could not be reached: a snapshot of the catalogs."
      : "";

  // the views
  let graph = null;
  for (const b of app.querySelectorAll(".seg button")) {
    b.addEventListener("click", async () => {
      for (const x of app.querySelectorAll(".seg button"))
        x.setAttribute("aria-selected", String(x === b));
      const view = b.dataset.view;
      fanSvg.toggleAttribute("hidden", view !== "tree");
      graphSvg.toggleAttribute("hidden", view !== "graph");
      app.querySelector(".stage").classList.toggle("scroll", view === "graph");
      hideCard();
      if (view === "graph" && !graph) {
        graph = drawTimeline(graphSvg, m, note).catch(
          () => (note.textContent = "The citations could not be read."),
        );
        await graph;
        filter();
      }
    });
  }

  // the search: it dims what does not match, in the views and in the hubs
  const q = document.getElementById("q");
  const opened = new Set();
  const filter = () => {
    const words = fold(q.value).split(/\s+/).filter(Boolean);
    const on = words.length > 0;
    for (const h of m.hubs) {
      let hits = 0;
      for (const e of h.entries) {
        const ok = !on || words.every((w) => e.hay.includes(w));
        hits += ok;
        if (e.tag) e.tag.hidden = !ok;
        if (e.leaf) e.leaf.classList.toggle("off", !ok);
        if (e.bud) e.bud.classList.toggle("off", !ok);
        if (e.node) e.node.classList.toggle("off", !ok);
      }
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
  };
  q.addEventListener("input", filter);
}

main();
