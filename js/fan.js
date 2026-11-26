import { GROUP, ROOT, fmt, glyph, hubStyle, short, svgEl } from "./base.js";

export const G = {
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

export const P = (r, a) => [
  G.cx + r * Math.cos((a * Math.PI) / 180),
  G.cy - r * Math.sin((a * Math.PI) / 180),
];

export function arcD(r, a0, a1) {
  const [x0, y0] = P(r, a0);
  const [x1, y1] = P(r, a1);
  return `M${fmt(x0)} ${fmt(y0)}A${r} ${r} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} ${a0 > a1 ? 1 : 0} ${fmt(x1)} ${fmt(y1)}`;
}

export function sectorD(r0, r1, a0, a1) {
  const [x0, y0] = P(r1, a0);
  const [x1, y1] = P(r1, a1);
  const [x2, y2] = P(r0, a1);
  const [x3, y3] = P(r0, a0);
  return `M${fmt(x0)} ${fmt(y0)}A${r1} ${r1} 0 0 1 ${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}A${r0} ${r0} 0 0 0 ${fmt(x3)} ${fmt(y3)}Z`;
}

export function radial(r0, r1, a, cls, delay, parent, width) {
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

export function arc(r, a0, a1, cls, delay, parent, width) {
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
export function fanPlaces(m) {
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
export function coverModel(m) {
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
export function placeNames(names) {
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

export function drawFan(svg, m) {
  const slots = fanPlaces(m);
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
