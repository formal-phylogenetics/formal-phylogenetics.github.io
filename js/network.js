import { esc, fmt, fold, hubStyle, svgEl, yearSort } from "./base.js";
import { card, placeAt } from "./card.js";
import { sameGroup } from "./people.js";

// The graphs of the people, for the years the trim bar shows. The co-authorship of the authors
// keeps the layout the library computed once: an author or a link appears once an entry of those
// years makes it. The authors and the venues of their entries stand in two rows, the authors above
// and the venues below, the venues grouped by publisher, in an order that keeps the links short
// (each author near the venues of their entries, each venue and publisher near its authors),
// computed once over all the years; the authors of fewer entries than the row has room for share a
// node at its end. A link is as wide as the entries behind it. Pointing at a node or a link marks
// it and tells what it is; clicking pins it in the panel, and clicking it again lets it go.
export const SHORT_HOUSE = {
  "Oxford University Press": "OUP",
  "Cambridge University Press": "CUP",
  "Institute of Mathematical Statistics": "IMS",
  "National Academy of Sciences": "NAS",
  "Taylor & Francis": "T&F",
  "World Scientific": "WSPC",
  "Schloss Dagstuhl": "Dagstuhl",
  "KIT Scientific Publishing": "KIT",
  "SAGE Publications": "SAGE",
  "The Royal Society": "Royal Soc.",
  Conference: "Conf.",
  Preprint: "Prepr.",
};

export function createNetwork(svg, canvas, ui, people, kind) {
  const W0 = () => Math.max(300, Math.round(svg.parentNode.clientWidth));
  const rows = kind === "venues";
  const { publishers } = people;

  // the order of the two rows: the publishers by their links to authors, the most first, and in
  // each the venues the same way; each author above the venue of most of their entries, and above
  // one venue the authors by their links, the most first, so that the links stay short
  const rank = new Map();
  if (rows) {
    const at = new Map();
    const tie = (x, y) => x.name.localeCompare(y.name);
    const links = (v) => v.authors.length;
    const house = (p) => p.venues.reduce((s, v) => s + links(v), 0);
    const order = [...publishers]
      .sort((x, y) => house(y) - house(x) || tie(x, y))
      .flatMap((p) =>
        [...p.venues].sort((x, y) => links(y) - links(x) || tie(x, y)),
      );
    order.forEach((v, i) => at.set(v, i));
    const home = (a) => {
      const most = a.venues.length ? a.venues[0].n : 0;
      const tops = a.venues
        .filter((x) => x.n === most)
        .map((x) => at.get(x.who));
      return tops.length ? Math.min(...tops) : order.length;
    };
    const orderA = [...people.authors].sort(
      (x, y) =>
        home(x) - home(y) ||
        y.venues.length - x.venues.length ||
        y.entries.length - x.entries.length ||
        tie(x, y),
    );
    order.forEach((v, i) => rank.set(v, i));
    orderA.forEach((a, i) => rank.set(a, i));
  }

  // this graph's own dots over the authors and venues it shows, which the other graph shares: a
  // dot reads the author or venue it stands for and keeps its own place, size and elements
  const dot = (d) => Object.assign(Object.create(d), { d, rank: rank.get(d) });
  const authors = people.authors.map(dot);
  const venues = rows ? people.venues.map(dot) : [];
  const dotOf = new Map([...authors, ...venues].map((n) => [n.d, n]));
  const restA = { kind: "rest", name: "", short: "", entries: [], hay: "" };
  restA.d = restA;
  const nodes = rows ? [...authors, ...venues, restA] : authors;
  const coLinks = rows
    ? []
    : people.co.map((l) => ({
        kind: "link",
        a: dotOf.get(l.a),
        b: dotOf.get(l.b),
        entries: l.entries,
      }));

  const root = svgEl("g", {});
  const gB = svgEl("g", { class: "n-bands" }, root);
  const gN = svgEl("g", { class: "n-nodes" }, root);
  const gL = svgEl("g", { class: "n-labels" }, root);
  nodes.forEach((n, i) => {
    const attrs = { class: `n-node ${n.kind}${n.hub ? " hub-c" : ""}` };
    if (n.hub) attrs.style = hubStyle(n.hub);
    n.el = svgEl(n.kind === "venue" ? "rect" : "circle", attrs, gN);
    n.el.dataset.i = i;
    n.label = svgEl("text", { class: `n-label ${n.kind}` }, gL);
    n.label.textContent = n.short || n.name;
  });
  const bands = new Map();
  if (rows)
    for (const p of publishers) {
      const band = svgEl("rect", { class: "n-band" }, gB);
      const tag = svgEl("text", { class: "n-plabel" }, gB);
      band.dataset.p = tag.dataset.p = p.i;
      bands.set(p, { band, tag });
    }

  // the graphs share one drawing: the one drawn last is the one that answers the pointer
  const mine = () => svg.firstChild === root;

  let win = { a: -Infinity, b: Infinity };
  const inWin = (e) => {
    const y = +e.year;
    return !y || (y >= win.a && y < win.b);
  };
  let words = [];
  const named = (n) =>
    words.length > 0 && words.every((w) => n.hay.includes(w));
  const hit = (e) => words.every((w) => e.hay.includes(w));
  const matches = (n) => !words.length || named(n) || n.entries.some(hit);
  let links = coLinks;
  let near = new Map();
  const linkUp = () => {
    near = new Map(nodes.map((n) => [n, []]));
    for (const l of links)
      if (l.count) (near.get(l.a).push(l), near.get(l.b).push(l));
  };

  const put = (n, r) => {
    if (n.r !== r || n.at !== `${n.x} ${n.y}`) {
      n.r = r;
      n.at = `${n.x} ${n.y}`;
      if (n.el.tagName === "rect")
        for (const [k, v] of Object.entries({
          x: n.x - r,
          y: n.y - r,
          width: 2 * r,
          height: 2 * r,
          rx: 1.5,
        }))
          n.el.setAttribute(k, fmt(v));
      else {
        n.el.setAttribute("cx", fmt(n.x));
        n.el.setAttribute("cy", fmt(n.y));
        n.el.setAttribute("r", fmt(r));
      }
    }
    n.el.classList.toggle("gone", !n.count);
    n.el.classList.toggle("off", Boolean(n.count) && !matches(n));
  };
  const hideLabels = () => {
    for (const n of nodes) n.label.classList.add("gone");
  };
  // a link as wide as the entries behind it; its box and, for a curve, points along it, for
  // finding the link under the pointer
  const shape = (l) => {
    l.w = Math.min(l.rest ? 2.4 : 5.5, 0.6 + 0.6 * Math.sqrt(l.count));
    const pad = l.w / 2 + 4;
    l.box = [
      Math.min(l.a.x, l.b.x) - pad,
      Math.min(l.a.y, l.b.y) - pad,
      Math.max(l.a.x, l.b.x) + pad,
      Math.max(l.a.y, l.b.y) + pad,
    ];
    if (!rows) return;
    const my = (l.a.y + l.b.y) / 2;
    l.c = [l.a.x, l.a.y, l.a.x, my, l.b.x, my, l.b.x, l.b.y];
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const u = 1 - t;
      const [x0, y0, x1, y1, x2, y2, x3, y3] = l.c;
      pts.push(
        u * u * u * x0 +
          3 * u * u * t * x1 +
          3 * u * t * t * x2 +
          t * t * t * x3,
        u * u * u * y0 +
          3 * u * u * t * y1 +
          3 * u * t * t * y2 +
          t * t * t * y3,
      );
    }
    l.pts = pts;
  };

  // the links, on the canvas under the drawing: each its own stroke, so that where they bundle the
  // ink adds up; what is marked over the rest
  let W = 0;
  let H = 0;
  let focus = false;
  const size = (w, h) => {
    W = w;
    H = h;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.height = `${h}px`;
    const r = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width !== Math.round(w * r) ||
      canvas.height !== Math.round(h * r)
    ) {
      canvas.width = Math.round(w * r);
      canvas.height = Math.round(h * r);
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  };
  // all the links at rest are drawn once into a picture of their own; marking one draws that
  // picture faded and the marked links over it, so that pointing costs a few strokes, not all
  const rest = document.createElement("canvas");
  let restOk = false;
  let ink = "#22201b";
  const stroke = (ctx, l, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(l.a.x, l.a.y);
    if (l.c) ctx.bezierCurveTo(l.c[2], l.c[3], l.c[4], l.c[5], l.c[6], l.c[7]);
    else ctx.lineTo(l.b.x, l.b.y);
    ctx.stroke();
  };
  const pen = (ctx, r, ink) => {
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.strokeStyle = ink;
    ctx.lineCap = "round";
  };
  const paint = () => {
    if (!mine() || !W) return;
    const ctx = canvas.getContext("2d");
    const r = canvas.width / W;
    // the ink is read when the picture is redrawn, not at each mark, which would make the
    // browser work out the styles of the whole page there and then
    if (!restOk) {
      ink = getComputedStyle(svg).getPropertyValue("--ink").trim() || "#22201b";
      rest.width = canvas.width;
      rest.height = canvas.height;
      const b = rest.getContext("2d");
      pen(b, r, ink);
      b.clearRect(0, 0, W, H);
      const base = rows ? 0.14 : 0.16;
      for (const l of links)
        if (l.count) stroke(b, l, (l.rest ? 0.045 : base) * (l.off ? 0.14 : 1));
      restOk = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = focus ? 0.2 : 1;
    ctx.drawImage(rest, 0, 0);
    if (!focus) return;
    pen(ctx, r, ink);
    for (const l of links)
      if (l.count && l.near && !l.hot) stroke(ctx, l, 0.55);
    for (const l of links) if (l.count && l.hot) stroke(ctx, l, 0.85);
  };
  const linkAt = (x, y) => {
    let best = null;
    let bd = Infinity;
    const seg = (x0, y0, x1, y1) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const t = Math.max(
        0,
        Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)),
      );
      return Math.hypot(x - x0 - t * dx, y - y0 - t * dy);
    };
    for (const l of links) {
      if (
        !l.count ||
        x < l.box[0] ||
        x > l.box[2] ||
        y < l.box[1] ||
        y > l.box[3]
      )
        continue;
      let d = Infinity;
      if (l.pts)
        for (let i = 0; i + 3 < l.pts.length; i += 2)
          d = Math.min(
            d,
            seg(l.pts[i], l.pts[i + 1], l.pts[i + 2], l.pts[i + 3]),
          );
      else d = seg(l.a.x, l.a.y, l.b.x, l.b.y);
      if (d <= l.w / 2 + 3 && d < bd) ((bd = d), (best = l));
    }
    return best;
  };

  let placed = "";
  const drawCoauthors = () => {
    const w = W0();
    const h = Math.round(Math.min(1040, Math.max(w * 0.8, Math.min(w, 460))));
    const k = Math.max(0.6, Math.min(1, w / 1000));
    // the places hold until the size changes; the years and the search change only what shows
    size(w, h);
    if (placed !== `${w} ${h}`) {
      placed = `${w} ${h}`;
      const xs = authors.map((n) => n.p[0]);
      const ys = authors.map((n) => n.p[1]);
      const [x0, x1, y0, y1] = [
        Math.min(...xs),
        Math.max(...xs),
        Math.min(...ys),
        Math.max(...ys),
      ];
      const pad = 28;
      const s = Math.min(
        (w - 2 * pad) / (x1 - x0 || 1),
        (h - 2 * pad) / (y1 - y0 || 1),
      );
      const ox = (w - s * (x1 - x0)) / 2;
      const oy = (h - s * (y1 - y0)) / 2;
      for (const n of authors) {
        n.x = ox + s * (n.p[0] - x0);
        n.y = oy + s * (n.p[1] - y0);
      }
    }
    for (const n of authors) {
      n.count = n.entries.filter(inWin).length;
      put(n, k * Math.min(11, 1.6 + 1.25 * Math.sqrt(n.count)));
    }
    for (const l of coLinks) {
      l.count = l.entries.filter(inWin).length;
      l.off = Boolean(words.length) && !(matches(l.a) && matches(l.b));
      shape(l);
    }
    linkUp();
    // the names of the busiest, each to the right of its node or else to its left, none over another
    hideLabels();
    const boxes = [];
    const free = (b) =>
      boxes.every(
        (q) => b.x1 < q.x0 || b.x0 > q.x1 || b.y1 < q.y0 || b.y0 > q.y1,
      );
    for (const n of authors) {
      n.label.setAttribute("x", fmt(n.x + n.r + 3));
      n.label.setAttribute("y", fmt(n.y + 3.5));
    }
    const top = authors
      .filter((a) => a.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.min(22, Math.round(w / 60)));
    for (const n of top) {
      const wl = n.label.textContent.length * 5.9;
      for (const side of [1, -1]) {
        const x0 = side > 0 ? n.x + n.r + 3 : n.x - n.r - 3 - wl;
        const box = { x0, x1: x0 + wl, y0: n.y - 6, y1: n.y + 6 };
        if (!free(box)) continue;
        boxes.push(box);
        n.label.setAttribute("x", fmt(x0));
        n.label.classList.remove("gone");
        break;
      }
    }
  };

  const drawRows = () => {
    const w = W0();
    const h = Math.round(Math.min(660, Math.max(500, w * 0.6)));
    size(w, h);
    const pad = 16;
    const yA = 118;
    const yV = h - 168;
    for (const n of [...authors, ...venues])
      n.count = n.entries.filter(inWin).length;
    // as many authors as the row has room for, the busiest; the fewest entries a row author has
    const seen = authors.filter((a) => a.count);
    let least = 2;
    while (
      least < 99 &&
      seen.filter((a) => a.count >= least).length > (w - 2 * pad) / 4.2
    )
      least++;
    const rowA = seen
      .filter((a) => a.count >= least)
      .sort((x, y) => x.rank - y.rank);
    const fewA = seen.filter((a) => a.count < least);
    restA.count = fewA.length;
    restA.entries = [...new Set(fewA.flatMap((a) => a.entries.filter(inWin)))];
    restA.name = `${fewA.length} ${fewA.length === 1 ? "author" : "authors"} of ${least === 2 ? "one entry" : `fewer than ${least} entries`}`;
    restA.short = `${fewA.length} ${least === 2 ? "of one entry" : `of under ${least}`}`;
    restA.hay = fold(restA.name);
    for (const n of nodes) n.x = n.y = -99;
    // the authors' row, the node of the others at its end a little apart
    const allA = restA.count ? [...rowA, restA] : rowA;
    const stepA =
      (w - 2 * pad - (restA.count ? 14 : 0)) / Math.max(allA.length, 1);
    allA.forEach((n, i) => {
      n.x = pad + stepA * (i + 0.5) + (n === restA ? 14 : 0);
      n.y = yA;
    });
    // the venues' row, in blocks of their publishers, a gap between two blocks
    const rowV = venues.filter((v) => v.count).sort((x, y) => x.rank - y.rank);
    const blocks = [];
    for (const v of rowV) {
      if (!blocks.length || blocks[blocks.length - 1].p !== v.house)
        blocks.push({ p: v.house, list: [] });
      blocks[blocks.length - 1].list.push(v);
    }
    const gap = 0.9;
    const stepV =
      (w - 2 * pad) / Math.max(1, rowV.length + gap * (blocks.length - 1));
    let x = pad + stepV / 2;
    blocks.forEach((b, i) => {
      if (i) x += gap * stepV;
      for (const v of b.list) {
        v.x = x;
        v.y = yV;
        x += stepV;
      }
    });
    for (const { band, tag } of bands.values()) {
      band.classList.add("gone");
      tag.classList.add("gone");
    }
    blocks.forEach((b, i) => {
      const x0 = b.list[0].x - stepV / 2;
      const x1 = b.list[b.list.length - 1].x + stepV / 2;
      const { band, tag } = bands.get(b.p);
      for (const [k, v] of Object.entries({
        x: x0,
        y: yV - 14,
        width: x1 - x0,
        height: h - yV + 12,
        rx: 4,
      }))
        band.setAttribute(k, fmt(v));
      band.classList.remove("gone");
      band.classList.toggle("alt", i % 2 === 1);
      band.classList.toggle(
        "off",
        Boolean(words.length) && !b.list.some(matches),
      );
      // the publisher's name under its block, or its short name, when either fits
      const fit = [b.p.name, SHORT_HOUSE[b.p.name]].find(
        (s) => s && s.length * 6 <= x1 - x0 + 2,
      );
      if (fit) {
        tag.textContent = fit;
        tag.setAttribute("x", fmt((x0 + x1) / 2));
        tag.setAttribute("y", fmt(h - 9));
        tag.classList.remove("gone");
      }
    });
    const inRow = new Set([...rowA, ...rowV]);
    for (const n of authors) {
      const c = n.count;
      if (!inRow.has(n)) n.count = 0;
      put(n, Math.min(4.6, 1.3 + 0.75 * Math.sqrt(c)));
      n.count = c;
    }
    for (const v of venues)
      put(
        v,
        Math.min(Math.max(2, stepV / 2 - 0.5), 2.2 + 0.95 * Math.sqrt(v.count)),
      );
    put(restA, 4.6);

    // a link for each author and venue that the entries of those years join
    const pairs = new Map();
    for (const a of seen)
      for (const e of a.entries) {
        const v = dotOf.get(people.venueOf.get(e));
        if (!v || !inWin(e)) continue;
        const from = inRow.has(a) ? a : restA;
        if (!pairs.has(from)) pairs.set(from, new Map());
        const of = pairs.get(from);
        if (!of.has(v))
          of.set(v, {
            kind: "link",
            a: from,
            b: v,
            rest: from === restA,
            set: new Set(),
          });
        of.get(v).set.add(e);
      }
    links = [];
    for (const of of pairs.values())
      for (const l of of.values()) {
        l.entries = [...l.set];
        l.count = l.entries.length;
        l.off =
          Boolean(words.length) &&
          !(named(l.a) || named(l.b) || l.entries.some(hit));
        shape(l);
        links.push(l);
      }
    linkUp();

    // the names, upright along the rows, the busiest first and none over another: the authors'
    // above their row, the venues' below theirs, above the publishers' names
    hideLabels();
    const room = { up: yA - 14, down: h - 30 - yV };
    for (const [row, up] of [
      [allA, true],
      [rowV, false],
    ]) {
      const taken = [];
      for (const n of [...row].sort(
        (a, b) => (b === restA) - (a === restA) || b.count - a.count,
      )) {
        if (!n.count) continue;
        let text = n.short || n.name;
        const fits = (s) => s.length * 6 <= (up ? room.up : room.down) - n.r;
        if (!fits(text) && n.kind === "author")
          text = text.replace(/^(\S)\S*\s+(?:\S+\s+)*?(?=\S+$)/, "$1. ");
        while (!fits(text) && text.length > 4)
          text = `${text.slice(0, -2).trimEnd()}…`;
        if (n.label.textContent !== text) n.label.textContent = text;
        const lx = n.x + 3.6;
        const ly = up ? n.y - n.r - 5 : n.y + n.r + 5;
        n.label.setAttribute("x", fmt(lx));
        n.label.setAttribute("y", fmt(ly));
        n.label.setAttribute("transform", `rotate(-90 ${fmt(lx)} ${fmt(ly)})`);
        n.label.setAttribute("text-anchor", up ? "start" : "end");
        // a name hidden for want of room still shows while its node is pointed at
        if (taken.some((t) => Math.abs(t - n.x) < 11.5)) continue;
        taken.push(n.x);
        n.label.classList.remove("gone");
      }
    }
  };

  // pointing marks a node, a link or a publisher, with what is joined to it; the pinned one stays
  // marked while nothing else is pointed at
  let pinned = null;
  let shown = null;
  let marked = [];
  const mark = (t) => {
    shown = t;
    for (const [el, cls] of marked) el.classList.remove(cls);
    for (const l of links) l.near = l.hot = false;
    marked = [];
    const add = (el, cls) => {
      el.classList.add(cls);
      marked.push([el, cls]);
    };
    focus = Boolean(t);
    svg.classList.toggle("focus", focus);
    const ends = (l) => {
      l.near = true;
      for (const n of [l.a, l.b]) {
        add(n.el, "near");
        add(n.label, "near");
      }
    };
    if (t && t.kind === "link") {
      const l = links.find((x) => x.a.d === t.a.d && x.b.d === t.b.d);
      if (l && l.count) {
        ends(l);
        l.hot = true;
        // the two it joins are named, even where their names had no room
        for (const n of [l.a, l.b]) add(n.label, "hot");
      }
    } else if (t && t.kind === "publisher") {
      // a publisher: its block and venues, and their links; its venues' names stay as placed
      if (bands.has(t)) add(bands.get(t).band, "hot");
      for (const v of t.venues.map((v) => dotOf.get(v)).filter(Boolean)) {
        add(v.el, "near");
        add(v.label, "near");
        for (const l of near.get(v) || []) ends(l);
      }
    } else if (t) {
      add(t.el, "hot");
      add(t.label, "hot");
      for (const l of near.get(t) || []) ends(l);
    }
    paint();
  };
  // a pinned author, venue, publisher or link, as this graph has it
  const own = (g) => {
    if (!g) return null;
    if (g.kind === "link")
      return { kind: "link", a: { d: g.a }, b: { d: g.b } };
    if (g.kind === "publisher") return rows ? g : null;
    if (g === restA) return restA;
    return dotOf.get(g) || null;
  };
  const draw = () => {
    if (!mine()) svg.replaceChildren(root);
    restOk = false;
    if (rows) drawRows();
    else drawCoauthors();
    mark(shown && shown !== pinned ? shown : own(pinned));
  };
  const targetAt = (ev) => {
    const t = ev.target;
    const node = t.closest && t.closest(".n-node");
    if (node)
      return node.classList.contains("gone") ? null : nodes[+node.dataset.i];
    const b = t.closest && t.closest(".n-band, .n-plabel");
    if (b) return publishers[+b.dataset.p];
    const r = svg.getBoundingClientRect();
    return linkAt(
      ((ev.clientX - r.left) * W) / r.width,
      ((ev.clientY - r.top) * H) / r.height,
    );
  };
  // a card names what it shows by the short names; the panel gives the full ones
  const title = (t) =>
    t.kind === "link"
      ? rows
        ? `${t.a.kind === "rest" ? "Authors of one entry" : t.a.short || t.a.name} in ${t.b.short || t.b.name}`
        : `${t.a.short || t.a.name} and ${t.b.short || t.b.name}`
      : t.short || t.name;
  const cardFor = (t) => {
    const list = t.entries.filter(inWin).sort(yearSort);
    const names = list
      .slice(0, 14)
      .map((e) => esc(e.name))
      .join(" · ");
    const what =
      t.kind === "link"
        ? rows
          ? "published there"
          : "together"
        : t.kind === "publisher"
          ? `${t.venues.filter((v) => v.entries.some(inWin)).length} venues`
          : t.kind === "venue"
            ? t.publisher
            : "";
    const kindName =
      t.kind === "rest"
        ? ""
        : t.kind === "link"
          ? rows
            ? "author-venue"
            : "co-authors"
          : t.kind;
    card.entry = null;
    card.el.style.cssText = t.hub ? hubStyle(t.hub) : "";
    card.el.innerHTML = `<div class="t-head"><span class="t-name">${esc(title(t))}</span><span class="t-kind">${kindName}</span></div>
      <div class="t-by">${what ? `${esc(what)} · ` : ""}${list.length} ${list.length === 1 ? "entry" : "entries"} in the years shown</div>
      <p class="t-abstract">${names}${list.length > 14 ? ` · +${list.length - 14} more` : ""}</p>
      <div class="t-hint">${sameGroup(ui.group, pick(t)) ? "Click to let go" : "Click to pin"}</div>`;
    card.el.hidden = false;
  };
  // what a click pins: the author, venue or publisher itself, or the link between two of them
  const pick = (t) =>
    t.kind === "link"
      ? { kind: "link", a: t.a.d, b: t.b.d, name: title(t), entries: t.entries }
      : t.d || t;
  let over = null;
  svg.addEventListener("pointermove", (ev) => {
    if (!mine()) return;
    const t = targetAt(ev);
    const want = t || own(pinned);
    if (t !== over) {
      over = t;
      if (t) cardFor(t);
      else card.el.hidden = true;
    }
    if (
      want !== shown &&
      !(
        want &&
        shown &&
        want.kind === "link" &&
        shown.kind === "link" &&
        want.a.d === shown.a.d &&
        want.b.d === shown.b.d
      )
    )
      mark(want);
    if (t) placeAt(ev.clientX, ev.clientY);
  });
  svg.addEventListener("pointerleave", () => {
    if (!mine()) return;
    over = null;
    mark(own(pinned));
    card.el.hidden = true;
  });
  svg.addEventListener("click", (ev) => {
    const t = mine() && (over || targetAt(ev));
    if (!t) return;
    ev.preventDefault();
    over = null;
    card.el.hidden = true;
    ui.pickGroup(pick(t));
  });
  // the colours of the links follow the theme
  const repaint = () => {
    restOk = false;
    paint();
  };
  new MutationObserver(repaint).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener(
    "change",
    repaint,
  );

  return {
    draw,
    setWindow(a, b) {
      win = { a, b };
      draw();
    },
    search(w, now = true) {
      words = w;
      if (now) draw();
    },
    pin(g) {
      pinned = g;
      if (mine()) mark(own(g));
    },
  };
}
