// The Catalogue of formal phylogenetics. It reads the registry of the collection and the catalog of
// each hub from GitHub, draws the collection as a fan-shaped tree whose tips are the entries of the
// catalogs, and lays out a drawer for each hub with a tag for each entry. Only the colours are set
// here: a hub, sub-hub, family or entry appears as soon as it is pushed to its repository.

const ORG = "formal-phylogenetics";
const ROOT = "lean4-phylogenetics";
const RAW = (repo, path) => `https://raw.githubusercontent.com/${ORG}/${repo}/main/${path}`;
const TOML = "https://cdn.jsdelivr.net/npm/smol-toml@1.9.1/+esm";
const SVGNS = "http://www.w3.org/2000/svg";

// The colour of each hub, for light and for dark pages. A hub not named here takes a spare colour of
// its kind.
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
const SPARE = {
  inference: [
    ["#0f766e", "#4fd1c5"],
    ["#1e40af", "#93b4ff"],
  ],
  theory: [
    ["#a16207", "#facc15"],
    ["#9f1239", "#fb7185"],
  ],
};
const STATUS = { formalized: "formalized", "in-progress": "in progress", partial: "partly covered", todo: "to do" };
const KIND = { inference: "hubs of inference", theory: "hubs of theory" };

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
  const catalogs = await Promise.all(hubs.map((h) => read(h.name, "catalog/papers.toml").catch(() => null)));
  const byHub = {};
  hubs.forEach((h, i) => {
    if (catalogs[i]) byHub[h.name] = { family: catalogs[i].family || [], paper: catalogs[i].paper || [] };
  });
  return { hubs, catalogs: byHub, source: "live" };
}

async function loadSnapshot() {
  const r = await fetch(new URL("catalogue.json", import.meta.url));
  if (!r.ok) throw new Error("no snapshot");
  return { ...(await r.json()), source: "snapshot" };
}

const short = (name) => name.replace(/^lean4-phylo-/, "").replace(/-/g, " ");

function citeName(p) {
  const a = String(p.authors || "").trim();
  let who;
  if (/et al\.?$/.test(a)) who = a.replace(/\s*et al\.?$/, " et al.");
  else {
    const names = a.split(/\s*,\s*|\s+and\s+/).filter(Boolean);
    who = names.length <= 1 ? names[0] || "" : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} et al.`;
  }
  return `${who} ${p.year ?? ""}`.trim();
}

function model(data) {
  const children = (name) => data.hubs.filter((h) => h.parent === name);
  const used = {};
  const hubs = [];
  const visit = (h, depth, kind, parent) => {
    let colour = COLOURS[h.name];
    if (!colour) {
      const list = SPARE[kind] || SPARE.inference;
      used[kind] = (used[kind] ?? -1) + 1;
      colour = list[used[kind] % list.length];
    }
    const cat = data.catalogs[h.name];
    const families = [...((cat && cat.family) || [])].sort((a, b) => a.id - b.id).map((f) => ({ id: f.id, title: f.title, entries: [] }));
    const byId = new Map(families.map((f) => [f.id, f]));
    const papers = [...((cat && cat.paper) || [])].sort((a, b) => a.family - b.family || a.order - b.order);
    const hub = { ...h, depth, kind, colour, families, parent, subhubs: [], loaded: Boolean(cat), entries: [] };
    for (const p of papers) {
      const f = byId.get(p.family);
      if (!f) continue;
      const status = STATUS[p.status] ? p.status : "todo";
      const repo = p.repo || `lean4-${p.id}`; // the default of the collection's tools
      const repoUrl = (status === "formalized" || status === "in-progress") && p.commit ? `https://github.com/${ORG}/${repo}` : null;
      const e = {
        name: p.short || citeName(p),
        named: Boolean(p.short),
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
      e.hay = `${e.name} ${e.title} ${e.authors} ${e.year}`
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
      f.entries.push(e);
      hub.entries.push(e);
    }
    hubs.push(hub);
    for (const c of children(h.name)) hub.subhubs.push(visit(c, depth + 1, kind, hub));
    return hub;
  };
  const top = children(ROOT);
  const kinds = [...new Set(top.map((h) => h.kind || "inference"))];
  const groups = kinds.map((kind) => ({
    kind,
    hubs: top.filter((h) => (h.kind || "inference") === kind).map((h) => visit(h, 0, kind, null)),
  }));
  return { groups, hubs, entries: hubs.flatMap((h) => h.entries) };
}

// ---------------------------------------------------------------------------------------------
// The fan

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
  label: 386,
  a0: 177.5,
  a1: 2.5,
};
const fmt = (x) => x.toFixed(2);
const P = (r, a) => [G.cx + r * Math.cos((a * Math.PI) / 180), G.cy - r * Math.sin((a * Math.PI) / 180)];

function arcD(r, a0, a1) {
  const [x0, y0] = P(r, a0);
  const [x1, y1] = P(r, a1);
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0;
  return `M${fmt(x0)} ${fmt(y0)}A${r} ${r} 0 ${large} ${a0 > a1 ? 1 : 0} ${fmt(x1)} ${fmt(y1)}`;
}

function sectorD(r0, r1, a0, a1) {
  const [x0, y0] = P(r1, a0);
  const [x1, y1] = P(r1, a1);
  const [x2, y2] = P(r0, a1);
  const [x3, y3] = P(r0, a0);
  return `M${fmt(x0)} ${fmt(y0)}A${r1} ${r1} 0 0 1 ${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}A${r0} ${r0} 0 0 0 ${fmt(x3)} ${fmt(y3)}Z`;
}

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
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
    parent
  );
}

function arc(r, a0, a1, cls, delay, parent, width) {
  if (Math.abs(a0 - a1) < 1e-6) return null;
  return svgEl("path", { d: arcD(r, a0, a1), class: cls, pathLength: 1, style: `--d:${Math.round(delay)}ms`, "stroke-width": width }, parent);
}

// Angles: each kind of hub takes an equal part of the fan; inside it, one step per entry, and a
// wider step between families and between hubs.
function layout(m) {
  const GAP = { family: 0.9, hub: 3.2 };
  const groupGap = 7;
  const span = (G.a0 - G.a1 - groupGap * (m.groups.length - 1)) / m.groups.length;
  const slots = [];
  const units = [];
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
      if (hi) extra += GAP.hub;
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
    units.push(unit);
  });
  return { slots, unit: Math.min(...units) };
}

function drawFan(svg, m) {
  const { slots, unit } = layout(m);
  const H = G.cy + 92;
  svg.setAttribute("viewBox", `0 0 ${G.w} ${H}`);
  const defs = svgEl("defs", {}, svg);
  const grad = svgEl("radialGradient", { id: "glow" }, defs);
  svgEl("stop", { offset: "0", "stop-color": "var(--glow-1)", "stop-opacity": "0.95" }, grad);
  svgEl("stop", { offset: "0.5", "stop-color": "var(--glow-2)", "stop-opacity": "0.3" }, grad);
  svgEl("stop", { offset: "1", "stop-color": "var(--glow-2)", "stop-opacity": "0" }, grad);

  const layers = {};
  for (const k of ["rings", "wedges", "branches", "hubs", "labels", "root"]) layers[k] = svgEl("g", {}, svg);
  const sweep = (a) => ((G.a0 - a) / (G.a0 - G.a1)) * 650;

  // Angles of the families, hubs and groups, from the tips inward.
  const famAngle = new Map();
  for (const s of slots) {
    if (!s.entry) continue;
    const f = s.family;
    const r = famAngle.get(f) || { a0: s.a, a1: s.a };
    r.a1 = s.a;
    famAngle.set(f, r);
  }
  const hubRange = new Map(); // all its tips, sub-hubs included
  const ownRange = new Map(); // its own tips
  for (const s of slots) {
    const own = ownRange.get(s.hub) || { a0: s.a, a1: s.a };
    own.a1 = s.a;
    ownRange.set(s.hub, own);
    for (let h = s.hub; h; h = h.parent) {
      const r = hubRange.get(h) || { a0: s.a, a1: s.a };
      r.a1 = s.a;
      hubRange.set(h, r);
    }
  }
  const nodeAngle = new Map();
  const hubRadius = (h) => G.hub + h.depth * G.subStep;
  const placeHub = (h) => {
    const kids = h.families.filter((f) => famAngle.has(f)).map((f) => (famAngle.get(f).a0 + famAngle.get(f).a1) / 2);
    h.subhubs.forEach((s) => kids.push(placeHub(s)));
    const own = ownRange.get(h);
    const a = kids.length ? (Math.max(...kids) + Math.min(...kids)) / 2 : (own.a0 + own.a1) / 2;
    nodeAngle.set(h, { a, kids });
    return a;
  };
  const groupAngles = m.groups.map((g) => {
    const as = g.hubs.map(placeHub);
    return { g, as, a: (Math.max(...as) + Math.min(...as)) / 2 };
  });

  // The rings of the levels, named along the baseline.
  const hasSub = m.hubs.some((h) => h.depth > 0);
  const rings = [
    [G.hub, "hubs"],
    ...(hasSub ? [[G.hub + G.subStep, "sub-hubs"]] : []),
    [G.fam, "families"],
    [(G.leaf.todo + G.leaf.formalized) / 2, "entries"],
  ];
  svgEl("line", { x1: G.cx - G.wedge - 40, y1: G.cy, x2: G.cx + G.wedge + 40, y2: G.cy, class: "baseline" }, layers.rings);
  for (const [r, name] of rings) {
    svgEl("path", { d: arcD(r, 180, 0), class: "ring" }, layers.rings);
    for (const side of [-1, 1]) {
      const t = svgEl(
        "text",
        { x: fmt(G.cx + side * r), y: G.cy + 24, "text-anchor": "middle", class: "ringname fade", style: "--d:1500ms" },
        layers.rings
      );
      t.textContent = name;
    }
  }

  // Each hub: a wedge, its branches, its leaves and its name, in its own colour.
  for (const h of m.hubs) {
    const halfStep = (h.unit || unit) * 0.75;
    const g = svgEl("g", { class: "hub-c", style: `--c-light:${h.colour[0]};--c-dark:${h.colour[1]}`, "data-hub": h.name }, layers.hubs);
    h.g = g;
    const all = hubRange.get(h);
    const rIn = hubRadius(h) - 10;
    svgEl("path", { d: sectorD(rIn, G.wedge, all.a0 + halfStep, all.a1 - halfStep), class: "wedge" }, g);
    const r = hubRadius(h);
    const { kids } = nodeAngle.get(h);
    if (kids.length > 1) arc(r, Math.max(...kids), Math.min(...kids), "hubline anim", 380 + sweep(nodeAngle.get(h).a) * 0.4, g, 2.4);
    for (const f of h.families) {
      if (!famAngle.has(f)) continue;
      const fa = famAngle.get(f);
      const mid = (fa.a0 + fa.a1) / 2;
      radial(r, G.fam, mid, "hubline anim", 520 + sweep(mid) * 0.5, g, 1.8);
      arc(G.fam, fa.a0, fa.a1, "hubline anim", 760 + sweep(mid) * 0.6, g, 1.6);
      for (const e of f.entries) {
        e.leaf = radial(G.fam, G.leaf[e.status], e.a, `leaf anim s-${e.status}`, 900 + sweep(e.a), g, e.status === "formalized" ? 2.6 : 1.3);
        if (e.status === "formalized" || e.status === "in-progress") {
          const [x, y] = P(G.leaf[e.status] + 4, e.a);
          e.bud = svgEl(
            "circle",
            { cx: fmt(x), cy: fmt(y), r: e.status === "formalized" ? 4.4 : 3, class: "bud", style: `--d:${Math.round(1500 + sweep(e.a))}ms` },
            g
          );
        }
      }
    }
    for (const s of h.subhubs) {
      const sa = nodeAngle.get(s).a;
      radial(r, hubRadius(s), sa, "hubline anim", 470 + sweep(sa) * 0.4, g, 2.2);
    }
    // the name, set radially outside the wedge, over the hub's own tips
    const own = ownRange.get(h);
    const la = (own.a0 + own.a1) / 2;
    const [lx, ly] = P(G.label, la);
    const left = la > 90;
    const t = svgEl(
      "text",
      {
        transform: `translate(${fmt(lx)} ${fmt(ly)}) rotate(${fmt(left ? 180 - la : -la)})`,
        "text-anchor": left ? "end" : "start",
        "dominant-baseline": "central",
        class: "hubname fade",
        style: `--d:${Math.round(1300 + sweep(la) * 0.5)}ms`,
      },
      g
    );
    t.textContent = short(h.name);
  }

  // The hubs under each group, the groups under the root.
  for (const { g, as, a } of groupAngles) {
    for (const ha of as) radial(G.group, G.hub, ha, "branch anim", 240, layers.branches, 2.6);
    if (as.length > 1) arc(G.group, Math.max(...as), Math.min(...as), "branch anim", 160, layers.branches, 2.8);
    const left = a > 90;
    const t = svgEl(
      "text",
      { x: G.cx + (left ? -1 : 1) * 104, y: G.cy - 14, "text-anchor": "middle", class: "groupname fade", style: "--d:1100ms" },
      layers.labels
    );
    t.textContent = (KIND[g.kind] || g.kind).replace(/^hubs of /, "");
    radial(G.stem, G.group, a, "branch anim", 80, layers.branches, 3);
  }
  const gas = groupAngles.map((x) => x.a);
  if (gas.length > 1) arc(G.stem, Math.max(...gas), Math.min(...gas), "branch anim", 40, layers.branches, 3.2);
  radial(0, G.stem, 90, "branch anim", 0, layers.branches, 3.6);

  // The root.
  svgEl("circle", { cx: G.cx, cy: G.cy, r: 46, fill: "url(#glow)", class: "glow" }, layers.root);
  svgEl("circle", { cx: G.cx, cy: G.cy, r: 9, fill: "var(--ink)" }, layers.root);
  svgEl("circle", { cx: G.cx, cy: G.cy, r: 3.4, fill: "var(--glow-1)" }, layers.root);
  const rn = svgEl("text", { x: G.cx, y: G.cy + 50, "text-anchor": "middle", class: "rootname" }, layers.root);
  rn.textContent = ROOT;
  const rs = svgEl("text", { x: G.cx, y: G.cy + 74, "text-anchor": "middle", class: "rootsub" }, layers.root);
  rs.textContent = "the root: the library every formalization shares";

  const pick = svgEl("line", { class: "pick", visibility: "hidden" }, svg);
  return { slots: slots.filter((s) => s.entry), unit, hubRange, pick };
}

// ---------------------------------------------------------------------------------------------
// The drawers

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function tagHtml(e) {
  const label = `${e.name}: ${e.title}`;
  return `<a class="tag ${e.named ? "named" : "cite"} s-${e.status}" href="${esc(e.url || "#")}" target="_blank" rel="noopener" aria-label="${esc(label)}">${esc(e.name)}</a>`;
}

function drawerHtml(h) {
  const kicker = h.depth ? `sub-hub of ${short(h.parent.name)}` : (KIND[h.kind] || h.kind).replace(/^hubs/, "hub");
  const fams = h.loaded
    ? h.families
        .map(
          (f) => `<div class="family" data-family="${f.id}">
          <h4><b>${f.id}</b>${esc(f.title)}</h4>
          <div class="tags">${f.entries.map(tagHtml).join("")}</div>
        </div>`
        )
        .join("")
    : `<p class="empty">The catalog of this hub could not be read.</p>`;
  return `<article class="drawer hub-c" id="${esc(h.name)}" style="--c-light:${h.colour[0]};--c-dark:${h.colour[1]}">
      <header>
        <span class="d-kicker">${esc(kicker)}</span>
        <h3>${esc(h.title || short(h.name))}</h3>
        <span class="d-meta">
          ${h.package ? `<span>library <code>${esc(h.package)}</code></span>` : ""}
          <a href="https://github.com/${ORG}/${esc(h.name)}">${esc(h.name)} &nearr;</a>
          <a href="https://github.com/${ORG}/${esc(h.name)}/blob/main/catalog/papers.toml">catalog &nearr;</a>
        </span>
        <span class="d-tally"></span>
      </header>
      ${fams}
      ${h.subhubs.map(drawerHtml).join("")}
      <p class="empty nothing" hidden>Nothing here matches.</p>
    </article>`;
}

function drawCatalogue(root, m) {
  root.innerHTML =
    `<div class="root-card">
      <div class="root-seal" aria-hidden="true"><span></span></div>
      <div>
        <h2><a href="https://github.com/${ORG}/${ROOT}">${ROOT}</a></h2>
        <p>The root of the collection: the library <code>Phylogenetics</code>, which every repository requires, the registry of the repositories, the conventions and the tools.</p>
      </div>
    </div>` +
    m.groups
      .map(
        (g) => `<section class="group" aria-label="${esc(KIND[g.kind] || g.kind)}">
          <h2>${esc(KIND[g.kind] || g.kind)}</h2>
          ${g.hubs.map(drawerHtml).join("")}
        </section>`
      )
      .join("");
  for (const h of m.hubs) {
    h.el = document.getElementById(h.name);
    const tags = [...h.el.querySelectorAll(":scope > .family .tag")];
    const flat = h.families.flatMap((f) => f.entries);
    flat.forEach((e, i) => {
      e.tag = tags[i];
      tagEntry.set(tags[i], e);
    });
    for (const f of h.families) f.el = h.el.querySelector(`:scope > .family[data-family="${f.id}"]`);
  }
}

// ---------------------------------------------------------------------------------------------
// Filtering

const state = { q: [], status: "all", named: false };

function matches(e) {
  if (state.named && !e.named) return false;
  if (state.status !== "all") {
    const s = e.status === "partial" ? "todo" : e.status;
    if (s !== state.status) return false;
  }
  return state.q.every((w) => e.hay.includes(w));
}

function apply(m) {
  let shown = 0;
  const visible = new Map();
  for (const h of m.hubs) {
    let n = 0;
    for (const f of h.families) {
      let k = 0;
      for (const e of f.entries) {
        const ok = matches(e);
        if (e.tag) e.tag.hidden = !ok;
        if (e.leaf) e.leaf.classList.toggle("off", !ok);
        if (e.bud) e.bud.classList.toggle("off", !ok);
        k += ok;
      }
      if (f.el) f.el.hidden = k === 0;
      n += k;
    }
    visible.set(h, n);
    shown += n;
    const total = h.entries.length;
    const done = h.entries.filter((e) => e.status === "formalized").length;
    const tally = h.el.querySelector(":scope > header .d-tally");
    const filtered = state.q.length || state.status !== "all" || state.named;
    tally.textContent = filtered ? `${n} of ${total} shown` : `${total} entries, ${done} formalized`;
  }
  const inTree = (h) => visible.get(h) + h.subhubs.reduce((s, c) => s + inTree(c), 0);
  for (const h of m.hubs) {
    const any = inTree(h) > 0;
    h.el.hidden = !any && !h.depth && Boolean(state.q.length || state.status !== "all" || state.named);
    h.el.querySelector(":scope > .nothing").hidden = visible.get(h) > 0 || !h.loaded || h.subhubs.some((c) => inTree(c) > 0);
  }
  document.getElementById("shown").textContent = `${shown} of ${m.entries.length} entries`;
}

function wireTools(m) {
  const q = document.getElementById("q");
  q.addEventListener("input", () => {
    state.q = q.value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    apply(m);
  });
  for (const b of document.querySelectorAll(".seg button")) {
    b.addEventListener("click", () => {
      state.status = b.dataset.status;
      for (const x of document.querySelectorAll(".seg button")) x.setAttribute("aria-pressed", String(x === b));
      apply(m);
    });
  }
  const named = document.getElementById("named");
  named.addEventListener("change", () => {
    state.named = named.checked;
    apply(m);
  });
}

// ---------------------------------------------------------------------------------------------
// The card of an entry, shown when pointing at a tip or a tag: what the catalog says at once, then
// the authors, the venue and the abstract, read from OpenAlex, or from Semantic Scholar when
// OpenAlex has no abstract. Each paper is read once.

const OPENALEX = "https://api.openalex.org/works/";
const S2 = "https://api.semanticscholar.org/graph/v1/paper/";
const tagEntry = new WeakMap();
const works = new Map();
const card = { el: null, entry: null, timer: 0, place: () => {} };

function workId(url) {
  const u = String(url || "");
  let m;
  if ((m = u.match(/(?:doi\.org|dl\.acm\.org\/doi)\/(10\.[^?#]+)$/i))) {
    const doi = decodeURIComponent(m[1]);
    return { openalex: `doi:${doi}`, s2: `DOI:${doi}` };
  }
  if ((m = u.match(/arxiv\.org\/abs\/([^?#]+?)(?:v\d+)?$/i))) return { openalex: `doi:10.48550/arxiv.${m[1]}`, s2: `ARXIV:${m[1]}` };
  if ((m = u.match(/biorxiv\.org\/content\/(10\.1101\/[\d.]+)/i))) return { openalex: `doi:${m[1]}`, s2: `DOI:${m[1]}` };
  if ((m = u.match(/ncbi\.nlm\.nih\.gov\/articles\/(PMC\d+)/i))) return { openalex: `pmcid:${m[1]}`, s2: `PMCID:${m[1].slice(3)}` };
  if ((m = u.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i))) return { openalex: `pmid:${m[1]}`, s2: `PMID:${m[1]}` };
  return null;
}

function invert(index) {
  if (!index) return "";
  const words = [];
  for (const [w, at] of Object.entries(index)) for (const k of at) words[k] = w;
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
          const r = await fetch(`${OPENALEX}${encodeURI(id.openalex)}?select=authorships,primary_location,abstract_inverted_index`);
          if (r.ok) {
            const w = await r.json();
            out.authors = (w.authorships || []).map((a) => a.author && a.author.display_name).filter(Boolean);
            out.venue = w.primary_location && w.primary_location.source ? w.primary_location.source.display_name : "";
            out.abstract = tidy(invert(w.abstract_inverted_index));
          }
        } catch (err) {
          /* the card keeps what the catalog says */
        }
        if (!out.abstract) {
          try {
            const r = await fetch(`${S2}${encodeURI(id.s2)}?fields=abstract,venue,authors`);
            if (r.ok) {
              const p = await r.json();
              out.abstract = tidy(p.abstract);
              out.venue = out.venue || p.venue || "";
              if (!(out.authors && out.authors.length)) out.authors = (p.authors || []).map((a) => a.name);
            }
          } catch (err) {
            /* idem */
          }
        }
        return out;
      })()
    );
  }
  return works.get(id.openalex);
}

function cardHtml(e, work, waiting) {
  const list = work && work.authors && work.authors.length ? work.authors : null;
  const who = list ? (list.length > 6 ? `${list.slice(0, 6).join(", ")} et al.` : list.join(", ")) : e.authors;
  const venue = work && work.venue ? ` · ${work.venue}` : "";
  let text = (work && work.abstract) || "";
  if (text.length > 900) text = `${text.slice(0, text.lastIndexOf(" ", 880))} …`;
  const body = text
    ? `<p class="t-abstract">${esc(text)}</p>`
    : waiting
      ? `<p class="t-wait">Reading the abstract…</p>`
      : work
        ? `<p class="t-wait">No abstract is available.</p>`
        : "";
  return `<div class="t-name ${e.named ? "" : "cite"}">${esc(e.name)}</div>
    <div class="t-title">${esc(e.title)}</div>
    <div class="t-by">${esc(who)}${e.year ? ` (${esc(e.year)})` : ""}${esc(venue)}</div>
    ${body}
    <div class="t-foot"><span class="t-status">${esc(STATUS[e.status])}</span><span>${esc(short(e.hub.name))} &rsaquo; ${esc(e.family.title)}</span></div>
    <div class="t-hint">${e.repoUrl ? "Click to open the formalization" : "Click to open the paper"}</div>`;
}

function showCard(e, place) {
  const tip = card.el;
  card.place = place;
  if (card.entry !== e) {
    card.entry = e;
    clearTimeout(card.timer);
    const id = workId(e.paperUrl);
    tip.style.setProperty("--c", getComputedStyle(e.hub.el).getPropertyValue("--c"));
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
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let left = x + 18;
  let top = y + 18;
  if (left + w > innerWidth - 12) left = x - w - 18;
  if (top + h > innerHeight - 12) top = y - h - 18;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function placeBy(rect) {
  const tip = card.el;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let top = rect.bottom + 8;
  if (top + h > innerHeight - 12) top = rect.top - h - 8;
  const left = Math.min(Math.max(8, rect.left), innerWidth - w - 12);
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function wireCards() {
  card.el = document.getElementById("tip");
  const root = document.getElementById("catalogue");
  const over = (ev) => {
    const t = ev.target.closest && ev.target.closest(".tag");
    if (!t || ev.pointerType === "touch") return;
    const e = tagEntry.get(t);
    if (e) showCard(e, () => placeBy(t.getBoundingClientRect()));
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
  addEventListener("scroll", () => card.entry && !card.el.hidden && card.place(), { passive: true });
  addEventListener("keydown", (ev) => ev.key === "Escape" && hideCard());
}

// ---------------------------------------------------------------------------------------------
// Pointing at the fan

function wireFan(svg, fan, m) {
  const tips = fan.slots; // by decreasing angle
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
    const cands = [tips[lo], tips[lo - 1]].filter(Boolean);
    return cands.reduce((b, s) => (Math.abs(s.a - a) < Math.abs(b.a - a) ? s : b), cands[0]);
  };
  const light = (h) => {
    if (h === lit) return;
    lit = h;
    for (const x of m.hubs) {
      x.g.classList.toggle("lit", x === h);
      x.g.classList.toggle("dim", Boolean(h) && x !== h && !isAncestor(x, h));
    }
  };
  const isAncestor = (a, h) => {
    for (let p = h.parent; p; p = p.parent) if (p === a) return true;
    return false;
  };
  const hubAt = (a) => {
    let best = null;
    for (const h of m.hubs) {
      const r = fan.hubRange.get(h);
      if (r && a <= r.a0 + fan.unit && a >= r.a1 - fan.unit && (!best || h.depth > best.depth)) best = h;
    }
    return best;
  };
  const hide = () => {
    hideCard();
    fan.pick.setAttribute("visibility", "hidden");
    current = null;
    light(null);
    svg.style.cursor = "";
  };

  svg.addEventListener("pointermove", (ev) => {
    const p = toSvg(ev);
    const dx = p.x - G.cx;
    const dy = G.cy - p.y;
    const r = Math.hypot(dx, dy);
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (dy < -8 || r < G.hub - 14 || r > G.label + 150) return hide();
    const h = hubAt(a);
    light(h);
    const s = r >= G.fam - 8 && r <= G.wedge + 26 ? nearest(a) : null;
    if (!s || Math.abs(s.a - a) > Math.max(s.unit * 0.8, 0.35) || (s.entry.leaf && s.entry.leaf.classList.contains("off"))) {
      hideCard();
      fan.pick.setAttribute("visibility", "hidden");
      current = null;
      svg.style.cursor = h ? "pointer" : "";
      return;
    }
    const e = s.entry;
    current = e;
    svg.style.cursor = "pointer";
    const [x0, y0] = P(G.fam, e.a);
    const [x1, y1] = P(G.leaf[e.status] + 6, e.a);
    Object.entries({ x1: fmt(x0), y1: fmt(y0), x2: fmt(x1), y2: fmt(y1) }).forEach(([k, v]) => fan.pick.setAttribute(k, v));
    fan.pick.setAttribute("visibility", "visible");
    showCard(e, () => placeAt(ev.clientX, ev.clientY));
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("click", () => {
    if (current && current.url) window.open(current.url, "_blank", "noopener");
    else if (lit) {
      lit.el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      lit.el.classList.remove("flash");
      void lit.el.offsetWidth;
      lit.el.classList.add("flash");
    }
  });
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const line = document.getElementById("status-line");
  let data;
  try {
    data = await loadLive();
  } catch (err) {
    try {
      data = await loadSnapshot();
    } catch (err2) {
      line.textContent = "The catalogs could not be read from GitHub. Try again later.";
      return;
    }
  }
  const m = model(data);
  const svg = document.getElementById("fan");
  svg.classList.add("grow");
  const fan = drawFan(svg, m);
  drawCatalogue(document.getElementById("catalogue"), m);
  wireTools(m);
  wireCards();
  wireFan(svg, fan, m);
  apply(m);
  const touch = matchMedia("(hover: none)").matches;
  line.textContent = `${touch ? "Tap" : "Point at"} a tip to name it, and ${touch ? "tap" : "click"} it to open the paper or its formalization.`;
  if (data.source === "snapshot") document.getElementById("source-note").textContent = "; GitHub could not be reached, so this is a snapshot";
}

main();
