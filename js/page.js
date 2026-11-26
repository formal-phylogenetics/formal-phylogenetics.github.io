import { GROUP, HERE, MOON, ORG, SUN, esc, fold, short } from "./base.js";
import { card, hideCard, placeBy, showCard } from "./card.js";
import {
  loadLive,
  loadSnapshot,
  model,
  readCitations,
  readPeople,
  readWorks,
} from "./data.js";
import { countryRow, hubRow, personRow, publisherRow } from "./lists.js";
import { createNetwork } from "./network.js";
import { paintStats, renderPanel } from "./panel.js";
import { linkEntries, peopleModel, sameGroup } from "./people.js";
import { compileQuery, fieldText, parseQuery, yearSpan } from "./query.js";
import { createTimeline, wireTimeline } from "./timeline.js";

export function shell(app) {
  app.innerHTML = `
    <section class="hero">
      <div class="intro">
        <h1>Formal Phylogenetics</h1>
        <p class="sub">Phylogenetic methods and theory, formalized in Lean.</p>
        <dl class="stats" id="stats" aria-label="The collection in figures"></dl>
        <dl class="meta">
          <div><dt>Maintainer</dt><dd><a href="https://vltanh.me">The-Anh Vu-Le</a>, with the help of Claude and ChatGPT</dd></div>
          <div><dt>Skills</dt><dd><a href="https://github.com/vltanh/formalize-math-paper">formalize-math-paper</a>, <a href="https://impeccable.style">impeccable</a></dd></div>
          <div id="updated-row" class="pending"><dt>Updated</dt><dd id="updated">&nbsp;</dd></div>
        </dl>
      </div>
      <figure class="cover" id="cover"><svg id="fan" viewBox="0 0 760 372" aria-hidden="true"></svg></figure>
    </section>
    <div class="explorer">
      <div class="work">
      <section class="timeline" aria-label="The entries along time, and the citations between them">
        <div class="side-top">
          <div class="views" role="tablist" aria-label="The view">
            <button type="button" role="tab" data-view="citations" aria-selected="true">Citations</button>
            <button type="button" role="tab" data-view="coauthors" aria-selected="false">Co-authorship</button>
            <button type="button" role="tab" data-view="venues" aria-selected="false">Author-venue</button>
          </div>
          <span class="key" id="key-net" aria-label="Legend" hidden></span>
          <span class="key" id="key-citations" aria-label="Legend">
            <span class="k-item"><i class="sw k-method"></i>method</span>
            <span class="k-item"><i class="sw k-theory"></i>theory</span>
            <span class="k-item"><i class="sw s-formalized"></i>formalized</span>
            <span class="k-item"><i class="ln out"></i>cites</span>
            <span class="k-item"><i class="ln in"></i>cited by</span>
            <span class="k-item"><svg class="k-size" viewBox="0 0 20 12" aria-hidden="true"><circle cx="3.5" cy="7" r="2.2"/><circle cx="13.5" cy="6" r="5.2"/></svg>weight (PageRank)</span>
          </span>
          <div class="slider">
            <button type="button" class="s-all" id="all-years" disabled>All years</button>
            <svg id="overview" class="overview" role="group" aria-label="The years shown: drag the window or its ends, or scroll to zoom"></svg>
          </div>
          <svg id="axis" class="axis" aria-hidden="true"></svg>
        </div>
        <div class="stage loading" id="stage">
          <canvas id="tl-links" class="tl-links" aria-hidden="true"></canvas>
          <svg id="graph" class="view" role="img" aria-label="The entries of the catalogs along time, a row for each hub, and the citations between them"></svg>
          <canvas id="net-links" class="net-links" aria-hidden="true" hidden></canvas>
          <canvas id="net-over" class="net-links" aria-hidden="true" hidden></canvas>
          <svg id="net" class="net" role="img" hidden></svg>
          <p class="note" id="note" aria-live="polite"></p>
        </div>
      </section>
      <aside class="detail">
        <section class="panel" id="panel" aria-live="polite" aria-label="The pinned entry"></section>
      </aside>
      </div>
      <div class="find">
        <div class="q-row">
          <input id="q" type="search" placeholder="Search a method, a title, an author or an institution" aria-label="Search the catalogue" autocomplete="off" />
          <button type="button" class="q-adv" id="q-adv" aria-expanded="false" aria-controls="adv">Advanced</button>
        </div>
        <div class="lists" role="tablist" aria-label="The list">
          <button type="button" role="tab" data-list="hubs" aria-selected="true">By hub</button>
          <button type="button" role="tab" data-list="authors" aria-selected="false">By author</button>
          <button type="button" role="tab" data-list="venues" aria-selected="false">By venue</button>
          <button type="button" role="tab" data-list="institutions" aria-selected="false">By institution</button>
        </div>
        <button type="button" class="fold-all" id="fold-all"></button>
      </div>
      <form class="adv" id="adv" hidden aria-label="Advanced search">
        <label><span>Author</span><input name="author" list="dl-author" autocomplete="off" /></label>
        <label><span>Institution</span><input name="institution" list="dl-institution" autocomplete="off" /></label>
        <label><span>Country</span><input name="country" list="dl-country" autocomplete="off" /></label>
        <label><span>Venue</span><input name="venue" list="dl-venue" autocomplete="off" /></label>
        <label><span>From</span><input name="from" inputmode="numeric" maxlength="4" placeholder="year" autocomplete="off" /></label>
        <label><span>To</span><input name="to" inputmode="numeric" maxlength="4" placeholder="year" autocomplete="off" /></label>
        <label><span>Hub</span><select name="hub"><option value="">Any</option></select></label>
        <label><span>Kind</span><select name="kind"><option value="">Any</option><option value="method">Method</option><option value="theory">Theory</option></select></label>
        <label><span>Status</span><select name="status"><option value="">Any</option><option value="formalized">Formalized</option><option value="in-progress">In progress</option><option value="todo">To do</option></select></label>
        <label class="adv-words"><span>Words</span><input name="words" autocomplete="off" placeholder="in the name, title, authors or venue" /></label>
        <p class="adv-note">Each field narrows the entries. An author with an institution or a country finds the papers whose byline places that author there. The search box reads the same: <code>author:Warnow institution:Harvard year:1999-2004</code>.</p>
        <button type="reset" class="adv-clear">Clear</button>
        <datalist id="dl-author"></datalist><datalist id="dl-institution"></datalist><datalist id="dl-country"></datalist><datalist id="dl-venue"></datalist>
      </form>
      <section class="hubs" id="hubs" aria-label="The hubs"></section>
      <section class="hubs people" id="authors" aria-label="The authors" hidden></section>
      <section class="hubs people" id="venues" aria-label="The venues" hidden></section>
      <section class="hubs people" id="institutions" aria-label="The institutions" hidden></section>
    </div>`;
}

// The theme: the system's, until the reader chooses; the choice is kept as vltanh.me keeps it.
export function themeNow() {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function wireTheme(btn) {
  const paint = () => {
    const dark = themeNow() === "dark";
    for (const meta of document.querySelectorAll('meta[name="theme-color"]'))
      meta.content = dark ? "#121816" : "#f6f3ec";
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

export function makeUi(m, els) {
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
    // a pinned author, venue, institution or other group: its entries, and the citations between two
    // of them
    const g = !e && ui.group;
    const focus = Boolean(e || g);
    const links = [];
    els.graph.classList.toggle("focus", focus);
    if (g) {
      const set = new Set(g.kind === "link" ? linkEntries(g) : g.entries || []);
      for (const x of set)
        for (const el of [x.node, ...(x.tags || [])]) add(el, "grp");
      for (const l of ui.links)
        if (set.has(l.source) && set.has(l.target)) links.push([l, "grp"]);
    } else if (e) {
      for (const el of [e.node, ...(e.tags || [])]) add(el, "sel");
      for (const x of ui.cites.get(e) || [])
        for (const el of [x.node, ...(x.tags || [])]) add(el, "out");
      for (const x of ui.citedBy.get(e) || [])
        for (const el of [x.node, ...(x.tags || [])]) add(el, "in");
      for (const l of ui.edgesOf.get(e) || [])
        links.push([l, l.source === e ? "out" : "in"]);
    }
    if (ui.timeline) ui.timeline.mark(links, focus);
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
  ui.selectGroup = (g) => {
    ui.group = g;
    ui.selected = null;
    card.pinned = null;
    ui.mark(null);
    renderPanel(ui);
  };
  ui.select = (e, from) => {
    ui.selected = e;
    if (e) ui.group = null;
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
    // the weight of each entry in the citations: its PageRank, where a citation counts for as much
    // as the paper that makes it weighs (damping 0.85; a paper citing none spreads its weight evenly)
    const all = m.entries;
    const n = all.length;
    const at = new Map(all.map((e, i) => [e, i]));
    const src = Int32Array.from(ui.links, (l) => at.get(l.source));
    const dst = Int32Array.from(ui.links, (l) => at.get(l.target));
    const out = new Int32Array(n);
    for (const i of src) out[i] += 1;
    let pr = new Float64Array(n).fill(1 / n);
    for (let step = 0; step < 60; step++) {
      let spread = 0;
      for (let i = 0; i < n; i++) if (!out[i]) spread += pr[i];
      const next = new Float64Array(n).fill((0.15 + 0.85 * spread) / n);
      for (let k = 0; k < src.length; k++)
        next[dst[k]] += (0.85 * pr[src[k]]) / out[src[k]];
      pr = next;
    }
    const top = Math.max(...pr);
    all
      .map((e, i) => [e, pr[i]])
      .sort((a, b) => b[1] - a[1])
      .forEach(([e, v], i) => {
        e.weight = v / top;
        e.place = i + 1;
      });
    const byYear = (a, b) => String(a.year).localeCompare(String(b.year));
    for (const list of [...ui.cites.values(), ...ui.citedBy.values()])
      list.sort(byYear);
    ui.citations = true;
    if (ui.selected) renderPanel(ui);
    ui.mark(ui.hovered || ui.selected);
  };
  return ui;
}

export function wireList(ui) {
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

// The cover: a phylogeny drawn as a fan, which grows from its root on arrival. It is the same
// drawing whatever the catalogs hold; inlined, it follows the theme of the page.
async function drawCover(figure) {
  const r = await fetch(HERE("assets/tree.svg"));
  if (!r.ok) return;
  figure.innerHTML = await r.text();
  const svg = figure.querySelector("svg");
  svg.id = "fan";
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  // the glow of the root pulses while the cover is in sight, and rests once it is scrolled past
  if ("IntersectionObserver" in window)
    new IntersectionObserver(([seen]) =>
      figure.classList.toggle("away", !seen.isIntersecting),
    ).observe(figure);
}

export async function main() {
  // the citations and the people are read while the catalogs are: none waits on another
  const citationsRead = readCitations();
  citationsRead.catch(() => {});
  readPeople();
  const app = document.getElementById("app");
  shell(app);
  drawCover(document.getElementById("cover")).catch(() => {});
  card.el = document.createElement("div");
  card.el.className = "card";
  card.el.setAttribute("role", "tooltip");
  card.el.hidden = true;
  document.body.appendChild(card.el);
  const els = {
    graph: document.getElementById("graph"),
    stage: document.getElementById("stage"),
    panel: document.getElementById("panel"),
    hubs: document.getElementById("hubs"),
    note: document.getElementById("note"),
    axis: document.getElementById("axis"),
    overview: document.getElementById("overview"),
    allYears: document.getElementById("all-years"),
    links: document.getElementById("tl-links"),
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
      document.getElementById("updated-row").classList.remove("pending");
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
      els.stage.classList.remove("loading");
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
    h.entries.forEach((e, i) => {
      e.tag = tags[i];
      e.tags = [tags[i]];
    });
  }
  // one button opens every hub, or closes them all once one is open
  const foldAll = document.getElementById("fold-all");
  const shownRows = () =>
    [...document.querySelectorAll(".hubs:not([hidden]) > details")].filter(
      (d) => !d.hidden,
    );
  const paintFold = () => {
    const any = shownRows().some((d) => d.open);
    foldAll.textContent = any ? "Collapse all" : "Expand all";
    foldAll.setAttribute("aria-expanded", String(any));
  };
  foldAll.addEventListener("click", () => {
    const rows = shownRows();
    const open = !rows.some((d) => d.open);
    for (const d of rows) d.open = open;
    paintFold();
  });
  for (const h of m.hubs) h.el.addEventListener("toggle", paintFold);
  paintFold();
  const ui = makeUi(m, els);
  wireTimeline(els.graph, ui);
  wireList(ui);
  renderPanel(ui);
  // what the note says when nothing else is to be said: that the catalogs are a snapshot, if they are
  const calm =
    data.source === "snapshot"
      ? "GitHub could not be reached: a snapshot of the catalogs."
      : "";

  // the citations, read once in the background for the panel, the cover and the timeline
  els.note.textContent = "Reading the citations…";
  citationsRead
    .then((raw) => {
      ui.useCitations(raw);
      stats();
      ui.timeline = createTimeline(els, m, ui.links);
      ui.timeline.layout();
      els.stage.classList.remove("loading");
      ui.timeline.enter();
      els.note.textContent = ui.links.length
        ? calm
        : "No citations could be read.";
      filter();
      ui.mark(ui.hovered || ui.selected);
      if (ui.selected && ui.selected.node) ui.reveal(ui.selected);
    })
    .catch(() => {
      ui.citations = "failed";
      els.stage.classList.remove("loading");
      els.note.textContent = "The citations could not be read.";
      if (ui.selected) renderPanel(ui);
    });

  // the figures under the title, the graphs of the people, and the lists of the authors and the
  // venues, once people.json is read
  const statsEl = document.getElementById("stats");
  let people = null;
  let peopleFailed = false;
  // the authors and the venues are counted from the file itself, before anything is built from it
  let counts = null;
  const stats = () => paintStats(statsEl, m, ui, counts);
  stats();
  let lastWin = { a: -Infinity, b: Infinity };
  const nets = {};
  let view = "citations";
  const net = document.getElementById("net");
  const netLinks = document.getElementById("net-links");
  const netOver = document.getElementById("net-over");
  const keyNet = document.getElementById("key-net");
  const KEYS = {
    coauthors:
      '<span class="k-item"><svg class="k-size" viewBox="0 0 20 12" aria-hidden="true"><circle cx="3.5" cy="7" r="2.2"/><circle cx="13.5" cy="6" r="5.2"/></svg>author, by entries</span><span class="k-item"><i class="ln co"></i>co-authors, as wide as their shared entries</span><span class="k-item">colour: the hub of most of their entries</span>',
    venues:
      '<span class="k-item"><svg class="k-size" viewBox="0 0 20 12" aria-hidden="true"><circle cx="3.5" cy="6" r="2"/><circle cx="12" cy="6" r="4"/></svg>author, by entries</span><span class="k-item"><svg class="k-size pub" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5"/></svg>venue</span><span class="k-item"><i class="k-band"></i>publisher</span><span class="k-item"><i class="ln co"></i>published there, as wide as the entries</span>',
  };
  // the trim bar can move many times a frame; the graph follows once a frame
  let frame = 0;
  els.stage.addEventListener("window", (ev) => {
    lastWin = ev.detail;
    if (frame || !nets[view]) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (nets[view]) nets[view].setWindow(lastWin.a, lastWin.b);
    });
  });
  // what the graphs mark: the pinned author, venue or other group, or the pinned entry, which they
  // show as its authors and venue (the same object while it stays pinned)
  let entryPin = null;
  const graphPin = () => {
    if (!ui.selected) return ui.group;
    if (!entryPin || entryPin.e !== ui.selected)
      entryPin = { kind: "entry", e: ui.selected, entries: [ui.selected] };
    return entryPin;
  };
  const show = (v) => {
    view = v;
    for (const b of document.querySelectorAll(".views [data-view]"))
      b.setAttribute("aria-selected", String(b.dataset.view === v));
    const timeline = v === "citations";
    // SVG elements take the attribute, not the property
    els.graph.toggleAttribute("hidden", !timeline);
    els.links.hidden = !timeline;
    document.getElementById("axis").toggleAttribute("hidden", !timeline);
    document.getElementById("key-citations").hidden = !timeline;
    keyNet.hidden = timeline;
    net.toggleAttribute("hidden", timeline);
    netLinks.hidden = timeline;
    netOver.hidden = timeline;
    hideCard();
    if (timeline) {
      if (ui.timeline) ui.timeline.wake();
      return;
    }
    keyNet.innerHTML = KEYS[v];
    if (!people) {
      els.note.textContent = peopleFailed
        ? "The authors could not be read."
        : "Reading the authors…";
      return;
    }
    nets[v] ||= createNetwork(net, netLinks, netOver, ui, people, v);
    nets[v].pin(graphPin());
    net.setAttribute(
      "aria-label",
      v === "coauthors"
        ? "The authors, and who wrote with whom, in the years shown"
        : "The authors above, and below the venues of their entries grouped by publisher, in the years shown",
    );
    nets[v].search(query, false);
    nets[v].setWindow(lastWin.a, lastWin.b);
  };
  for (const b of document.querySelectorAll(".views [data-view]"))
    b.addEventListener("click", () => show(b.dataset.view));
  // a new width draws the graph again; a new height, which its own drawing makes, does not
  let stageWidth = 0;
  new ResizeObserver(([seen]) => {
    const w = Math.round(seen.contentRect.width);
    if (w === stageWidth) return;
    stageWidth = w;
    if (nets[view]) nets[view].draw();
  }).observe(els.stage);

  // the lists: by hub, by author, by venue
  const sections = {
    hubs: els.hubs,
    authors: document.getElementById("authors"),
    venues: document.getElementById("venues"),
    institutions: document.getElementById("institutions"),
  };
  let list = "hubs";
  const built = new Set(["hubs"]);
  const build = (which) => {
    if (built.has(which) || !people) return;
    built.add(which);
    sections[which].innerHTML =
      which === "authors"
        ? people.authors.map(personRow).join("")
        : which === "venues"
          ? people.publishers.map(publisherRow).join("")
          : people.countries.map(countryRow).join("");
    for (const t of sections[which].querySelectorAll("a.tag[data-key]")) {
      const e = ui.byKey.get(t.dataset.key);
      if (e) (e.tags ||= []).push(t);
    }
    for (const d of sections[which].querySelectorAll("details"))
      d.addEventListener("toggle", paintFold);
    markLists(ui.group);
  };
  const showList = (which) => {
    list = which;
    build(which);
    for (const b of document.querySelectorAll(".lists [data-list]"))
      b.setAttribute("aria-selected", String(b.dataset.list === which));
    for (const [k, s] of Object.entries(sections)) s.hidden = k !== which;
    paintFold();
    filter();
  };
  for (const b of document.querySelectorAll(".lists [data-list]"))
    b.addEventListener("click", () => showList(b.dataset.list));
  // an author, a venue or a publisher named in the panel or the lists opens its panel; pinning
  // one marks it in the graphs, and clicking what is pinned lets it go
  const resolve = (go) => {
    const [k, i] = go.split(":");
    const list = {
      author: "authors",
      venue: "venues",
      publisher: "publishers",
      institution: "institutions",
      country: "countries",
    }[k];
    return list && people ? people[list][+i] : null;
  };
  const pinAll = () => {
    const g = graphPin();
    for (const n of Object.values(nets)) n.pin(g);
  };
  const selectGroup = ui.selectGroup;
  // a click pins without moving the page, wherever it is made: what is pinned shows in the panel,
  // and is marked in the graphs and in the lists
  const markLists = (g) => {
    for (const b of document.querySelectorAll(".hubs.people [data-go]")) {
      const on = resolve(b.dataset.go) === g;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
  };
  ui.selectGroup = (g) => {
    selectGroup(g);
    pinAll();
    markLists(g);
  };
  ui.pickGroup = (g) => ui.selectGroup(sameGroup(ui.group, g) ? null : g);
  const select = ui.select;
  ui.select = (e, from) => {
    select(e, from);
    pinAll();
    if (e) markLists(null);
    if (from === "panel") topOfPanel();
  };
  // a pick inside the panel changes it in place: its top comes back into view when it was passed
  const topOfPanel = () => {
    if (els.panel.getBoundingClientRect().top < 0)
      els.panel.scrollIntoView({ block: "start" });
  };
  const go = (ev) => {
    // a count that searches: an author's entries at one of their institutions
    const s = ev.target.closest("[data-q]");
    if (s) {
      q.value = s.dataset.q;
      widen();
      filter();
      return;
    }
    const all = ev.target.closest("[data-all]");
    if (all) {
      all.parentElement.classList.add("all");
      all.remove();
      return;
    }
    const b = ev.target.closest("[data-go]");
    const g = b && resolve(b.dataset.go);
    if (!g) return;
    ui.selectGroup(g);
    if (ev.currentTarget === els.panel) topOfPanel();
  };
  els.panel.addEventListener("click", go);
  // a click on nothing (the page, the background of a view or a graph) lets go of what is pinned,
  // as Escape does; a click that picks, ends a selection of text or lands in the panel does not
  const KEEP =
    "a, button, input, select, textarea, label, summary, [data-go], [data-key], .panel, .card, .overview, .views, .lists, .find";
  document.addEventListener("click", (ev) => {
    if (!ui.selected && !ui.group) return;
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.target.closest && ev.target.closest(KEEP)) return;
    if (String(getSelection()).trim()) return;
    if (ui.selected) ui.select(null);
    if (ui.group) ui.selectGroup(null);
  });
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && ui.group && !ev.target.closest?.("input"))
      ui.selectGroup(null);
  });
  for (const s of [sections.authors, sections.venues, sections.institutions])
    s.addEventListener("click", go);
  readPeople().then((data) => {
    if (data && Array.isArray(data.authors) && Array.isArray(data.venues)) {
      counts = {
        authors: data.authors.length,
        venues: data.venues.filter((v) => v.name !== "Venue not recorded")
          .length,
      };
      stats();
    }
    try {
      people = data && peopleModel(data, ui);
    } catch (err) {
      people = null;
    }
    if (!people) {
      peopleFailed = true;
      if (view !== "citations" || list !== "hubs")
        els.note.textContent = "The authors could not be read.";
      return;
    }
    ui.model = people;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
    for (const which of ["authors", "venues", "institutions"])
      idle(() => build(which), { timeout: 4000 });
    // the search also reads each entry's venue and the institutions of its byline
    for (const e of m.entries) {
      const v = people.venueOf.get(e);
      const at = (people.placesOf.get(e) || []).map(
        (p) => `${p.where.own} ${p.where.land ? p.where.land.own : ""}`,
      );
      e.hay += ` ${v ? v.hay : ""} ${[...new Set(at)].join(" ")}`;
    }
    offer();
    stats();
    // a pinned entry's panel names its authors and their institutions once the people are read
    if (ui.selected) renderPanel(ui);
    if (view !== "citations") show(view);
    if (list !== "hubs") showList(list);
    if (els.note.textContent === "Reading the authors…")
      els.note.textContent = calm;
    if (q.value.trim()) filter();
  });

  // the search (query.js): it dims what does not match, in the views and in the lists. Words
  // match an entry's name, title, authors, year, venue and institutions; fields narrow by each
  const q = document.getElementById("q");
  const adv = document.getElementById("adv");
  const advBtn = document.getElementById("q-adv");
  const opened = new Set();
  let query = compileQuery("", null);
  const goOf = (el, kind) => {
    const b = el && el.querySelector(`[data-go^="${kind}:"]`);
    return b ? resolve(b.dataset.go) : null;
  };
  const filter = () => {
    query = compileQuery(q.value, people);
    const { on, plain, words } = query;
    const test = (e) => !on || query.test(e);
    // a row named by the words shows all its entries; fields name rows by their own kind
    const named = (hay) => on && plain && words.every((w) => hay.includes(w));
    let any = false;
    for (const h of m.hubs) {
      let hits = 0;
      for (const e of h.entries) {
        const ok = test(e);
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
    // a citation shows when both its ends match
    for (const l of ui.links)
      l.off = on && !(test(l.source) && test(l.target));
    if (ui.timeline) ui.timeline.search();
    if (nets[view]) nets[view].search(query);
    // a country shows with its institutions that match (the lists hidden follow the search when they
    // are shown)
    if (built.has("institutions") && list === "institutions")
      for (const d of sections.institutions.querySelectorAll(
        ":scope > details",
      )) {
        const c = goOf(d, "country");
        const all = named(fold(d.querySelector(".h-name").textContent));
        let hits = 0;
        for (const f of d.querySelectorAll(".family")) {
          const h = goOf(f, "institution");
          f.hidden =
            on &&
            !all &&
            !(plain
              ? words.every((w) => f.dataset.name.includes(w))
              : c &&
                h &&
                query.own(c) &&
                query.own(h) &&
                h.entries.some((e) => query.counts(h, e)));
          hits += !f.hidden;
        }
        d.hidden = on && !hits;
      }
    // an author or a publisher shows with the entries that match: its own, or its venues'
    for (const which of ["authors", "venues"]) {
      if (!built.has(which) || which !== list) continue;
      for (const d of sections[which].querySelectorAll(":scope > details")) {
        const row = goOf(d, which === "authors" ? "author" : "publisher");
        const all = named(d.dataset.name);
        const mine = !on || !row || query.own(row);
        let hits = 0;
        for (const f of d.querySelectorAll(".family")) {
          const venue = which === "venues" ? goOf(f, "venue") : null;
          const fAll = all || named(f.dataset.name);
          const fMine = mine && (!venue || query.own(venue));
          let fHits = 0;
          for (const t of f.querySelectorAll("a.tag")) {
            const e = ui.byKey.get(t.dataset.key);
            const ok =
              !on || fAll || (fMine && query.counts(venue || row || {}, e));
            t.hidden = !ok;
            fHits += ok;
          }
          f.hidden = !fHits;
          hits += fHits;
        }
        d.hidden = on && !hits;
        if (on && hits && which === list && !d.open && (all || hits <= 6)) {
          d.open = true;
          opened.add(d);
        }
        if (!on && opened.has(d)) d.open = false;
      }
    }
    if (on && !query.ready)
      els.note.textContent = peopleFailed
        ? "The authors could not be read."
        : "Reading the authors…";
    else if (on && !any) els.note.textContent = "No entry matches the search.";
    else if (els.note.textContent === "No entry matches the search.")
      els.note.textContent = calm;
    if (adv.hidden === false && document.activeElement === q) fillForm();
  };
  // the catalogs often shorten the authors to "et al.": the full lists in works.json join what
  // the search reads, once it is first used
  let widened = null;
  const widen = () => {
    widened ??= readWorks().then((all) => {
      for (const h of m.hubs)
        for (const e of h.entries) {
          const names = (all[e.key] || {}).authors;
          if (names && names.length) e.hay += ` ${fold(names.join(" "))}`;
        }
      if (q.value.trim()) filter();
    });
  };
  q.addEventListener("focus", widen);
  q.addEventListener("input", () => {
    widen();
    filter();
  });

  // the advanced search: a form whose fields write the search, and which reads it back
  const ON_FORM = [
    "author",
    "institution",
    "country",
    "venue",
    "hub",
    "kind",
    "status",
  ];
  function fillForm() {
    const p = parseQuery(q.value);
    const first = (f) => p.fields.find((x) => x.f === f);
    for (const f of ON_FORM)
      adv.elements[f].value = first(f) ? first(f).raw : "";
    const y = first("year") && yearSpan(first("year").raw);
    adv.elements.from.value = y && Number.isFinite(y[0]) ? y[0] : "";
    adv.elements.to.value = y && Number.isFinite(y[1]) ? y[1] : "";
    adv.elements.words.value = p.words.join(" ");
  }
  function fromForm() {
    const p = parseQuery(q.value);
    const kept = new Set([...ON_FORM, "year"]);
    const seen = new Set();
    // what the form does not show stays as it was written: a second author, a publisher, a title
    const rest = p.fields.filter((x) => {
      if (!kept.has(x.f)) return true;
      if (seen.has(x.f)) return true;
      seen.add(x.f);
      return false;
    });
    const parts = [];
    for (const f of ON_FORM) {
      const v = adv.elements[f].value.trim();
      if (v) parts.push(fieldText(f, v));
    }
    const a = adv.elements.from.value.trim();
    const b = adv.elements.to.value.trim();
    if (/^\d{4}$/.test(a) || /^\d{4}$/.test(b))
      parts.push(`year:${a === b ? a : `${a}-${b}`}`);
    for (const x of rest) parts.push(fieldText(x.f, x.raw));
    const w = adv.elements.words.value.trim();
    if (w) parts.push(w);
    q.value = parts.join(" ");
    widen();
    filter();
  }
  adv.addEventListener("input", fromForm);
  adv.addEventListener("change", fromForm);
  adv.addEventListener("submit", (ev) => ev.preventDefault());
  adv.addEventListener("reset", () => {
    q.value = "";
    filter();
  });
  advBtn.addEventListener("click", () => {
    adv.hidden = !adv.hidden;
    advBtn.setAttribute("aria-expanded", String(!adv.hidden));
    if (!adv.hidden) {
      fillForm();
      widen();
    }
  });
  for (const h of m.hubs) {
    const o = document.createElement("option");
    o.value = short(h.name);
    o.textContent = `${h.depth ? "  " : ""}${h.title || short(h.name)}`;
    adv.elements.hub.append(o);
  }
  // the names the form offers, once the authors are read
  function offer() {
    const fill = (id, names) => {
      document.getElementById(id).innerHTML = [...new Set(names)]
        .map((n) => `<option value="${esc(n)}"></option>`)
        .join("");
    };
    fill(
      "dl-author",
      people.authors.map((a) => a.name),
    );
    fill(
      "dl-institution",
      people.institutions.map((h) => h.name),
    );
    fill(
      "dl-country",
      people.countries.map((c) => c.name),
    );
    fill(
      "dl-venue",
      people.venues
        .filter((v) => v.name !== "Venue not recorded")
        .map((v) => v.name),
    );
  }

  // a selection in the address is restored
  const key = decodeURIComponent(location.hash.slice(1));
  if (ui.byKey.has(key)) ui.select(ui.byKey.get(key), "hash");
}
