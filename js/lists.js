import {
  ARROW,
  CHEVRON,
  ORG,
  esc,
  fold,
  hubStyle,
  short,
  yearSort,
} from "./base.js";
import { chipOf } from "./panel.js";

export function tagHtml(e, extra = "", own = false) {
  return `<a class="tag k-${e.kind} ${e.named ? "named" : "cite"} s-${e.status}${extra}${own ? " hub-c" : ""}"${own ? ` style="${hubStyle(e.hub)}"` : ""} data-key="${esc(e.key)}" href="${esc(e.url || "#")}" target="_blank" rel="noopener" aria-label="${esc(`${e.name}: ${e.title}`)}">${esc(e.name)}</a>`;
}

export function hubRow(h) {
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

// ---------------------------------------------------------------------------------------------
// The people of the collection and where they published: the authors (each person once), the
// venues and the publishers they are grouped under, read from people.json; and the profiles of
// the authors and the venues, read from profiles.json when one is shown. Both are written with
// the site's other data from the library of papers.

// the lists of the authors and of the publishers with their venues, each a row that opens to its
// entries; a button opens the author's or the venue's panel
export function personRow(a) {
  // the author's entries in the hubs that hold them, the hub of the most entries first
  const byHub = new Map();
  for (const e of [...a.entries].sort(yearSort)) {
    if (!byHub.has(e.hub)) byHub.set(e.hub, []);
    byHub.get(e.hub).push(e);
  }
  const hubs = [...byHub]
    .sort(
      (x, y) => y[1].length - x[1].length || x[0].name.localeCompare(y[0].name),
    )
    .map(
      ([h, list]) =>
        `<div class="family" data-name="${esc(fold(`${a.name} ${h.title || ""}`))}"><h4>${esc(h.title || short(h.name))} <span class="f-n">${list.length}</span></h4><div class="tags">${list.map((e) => tagHtml(e, "", true)).join("")}</div></div>`,
    )
    .join("");
  return `<details class="hub grp" data-name="${esc(fold(`${a.name} ${a.short}`))}"><summary><span class="h-name" title="${esc(a.name)}">${esc(a.short)}</span><span class="h-count">${a.entries.length}</span>${CHEVRON}</summary><div class="h-body"><button type="button" class="p-open" data-go="author:${a.i}">Profile, co-authors and venues</button>${hubs}</div></details>`;
}

// a country, opening to its institutions, each with its authors and the years they were there
export function countryRow(c) {
  const places = c.institutions
    .slice()
    .sort(
      (x, y) =>
        y.people.length - x.people.length || x.name.localeCompare(y.name),
    )
    .map(
      (h) =>
        `<div class="family" data-name="${esc(h.hay)}"><h4><button type="button" class="f-go" data-go="institution:${h.i}">${esc(h.name)}</button> <span class="f-n">${h.people.length}</span></h4><div class="p-chips all">${h.people.map(({ who, n }) => chipOf("author", who, n)).join("")}</div></div>`,
    )
    .join("");
  return `<details class="hub grp" data-name="${esc(c.hay)}"><summary><span class="h-name">${esc(c.name)}</span><span class="h-count">${c.people.length}</span>${CHEVRON}</summary><div class="h-body"><button type="button" class="p-open" data-go="country:${c.i}">Institutions and authors</button>${places}</div></details>`;
}

export function publisherRow(p) {
  const venues = p.venues
    .map((v) => {
      const entries = [...v.entries].sort(yearSort);
      return `<div class="family" data-name="${esc(fold(`${v.name} ${v.short}`))}"><h4><button type="button" class="f-go" data-go="venue:${v.i}" title="${esc(v.name)}">${esc(v.short)}</button> <span class="f-n">${entries.length}</span></h4><div class="tags">${entries.map((e) => tagHtml(e, "", true)).join("")}</div></div>`;
    })
    .join("");
  return `<details class="hub grp" data-name="${esc(fold(`${p.name} ${p.full}`))}"><summary><span class="h-name">${esc(p.full)}</span><span class="h-count">${p.entries.length}</span>${CHEVRON}</summary><div class="h-body"><button type="button" class="p-open" data-go="publisher:${p.i}">Venues and authors</button>${venues}</div></details>`;
}
