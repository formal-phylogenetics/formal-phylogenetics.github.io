import { fmt, glyph, hubStyle, short, svgEl } from "./base.js";
import { placeAt } from "./card.js";

export function wireTimeline(svg, ui) {
  svg.addEventListener("pointermove", (ev) => {
    const k = ev.target.dataset && ev.target.dataset.key;
    const e = k ? ui.byKey.get(k) : null;
    svg.style.cursor = e ? "pointer" : "";
    ui.hover(e, () => placeAt(ev.clientX, ev.clientY));
  });
  svg.addEventListener("pointerleave", () => ui.hover(null));
  svg.addEventListener("click", (ev) => {
    if (!ui.hovered) return;
    ev.preventDefault();
    ui.pick(ui.hovered, "view");
  });
}

// ---------------------------------------------------------------------------------------------

// The timeline: every entry of the catalogs, in the row of its hub, at its year; time runs from
// left to right, and a citation is a curve from the citing entry back to the entry it cites. Above
// it, a trim bar chooses the years shown; a year's width grows with its papers. A row per hub, so
// that a new hub is a new row.
export const yearOf = (e) => {
  const m = String(e.year).match(/\d{4}/);
  return m ? +m[0] : null;
};

export function moveGlyph(e) {
  if (e.kind === "method") {
    e.node.setAttribute("cx", fmt(e.px));
    e.node.setAttribute("cy", fmt(e.py));
  } else {
    const s = e.r * 1.7;
    e.node.setAttribute("x", fmt(e.px - s / 2));
    e.node.setAttribute("y", fmt(e.py - s / 2));
  }
}

export function createTimeline(els, m, links) {
  const svg = els.graph;
  const nodes = m.entries.filter((e) => yearOf(e) !== null);
  for (const e of nodes) {
    e.y4 = yearOf(e);
    // the size says the weight in the citations (PageRank)
    e.r = 2.6 + 4.4 * Math.sqrt(e.weight || 0);
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
    els.stage.dispatchEvent(
      new CustomEvent("window", { detail: { a: st.a, b: st.b } }),
    );
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
