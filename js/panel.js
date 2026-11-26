import {
  ARROW,
  CROSS,
  STATUS,
  countryName,
  esc,
  hubStyle,
  short,
  when,
  yearOf,
  yearSort,
} from "./base.js";
import { readProfiles, readWork } from "./data.js";
import { tagHtml } from "./lists.js";
import { linkEntries } from "./people.js";

export const chipOf = (kind, x, n) =>
  `<button type="button" class="p-chip" data-go="${kind}:${x.i}"${x.short && x.short !== x.name ? ` title="${esc(x.name)}"` : ""}><span>${esc(x.short || x.name)}</span>${n != null ? `<span class="c-n">${n}</span>` : ""}</button>`;

export function chipsSection(title, list, kind, note) {
  if (!list.length) return "";
  const more =
    list.length > 12
      ? `<button type="button" class="p-more" data-all>+${list.length - 12} more</button>`
      : "";
  return `<div class="p-sec"><h3>${title} <span>${list.length}</span></h3>${note ? `<p class="p-note">${note}</p>` : ""}<div class="p-chips">${list
    .map(({ who, n }) => chipOf(kind, who, n))
    .join("")}${more}</div></div>`;
}

export function linksRow(links) {
  const html = links
    .filter(Boolean)
    .map(
      ([label, url]) =>
        `<a class="p-id" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`,
    )
    .join("");
  return html ? `<div class="p-ids">${html}</div>` : "";
}

export function listSection(title, rows) {
  if (!rows.length) return "";
  return `<div class="p-sec"><h3>${title}</h3><ul class="p-list">${rows
    .map(
      ([what, sub, at]) =>
        `<li><span class="l-main">${what}</span>${sub ? `<span class="l-sub">${sub}</span>` : ""}${at ? `<span class="l-when">${esc(at)}</span>` : ""}</li>`,
    )
    .join("")}</ul></div>`;
}

// an author's years and the institutions their papers in the collection place them at, with the
// links to their ORCID, Google Scholar, OpenAlex and Wikipedia pages
export function authorFacts(pr, people) {
  if (!pr) return "";
  const life = pr.died
    ? `${pr.born || "?"}–${pr.died.slice(0, 4)}`
    : pr.born
      ? `born ${pr.born}`
      : "";
  return `${life ? `<p class="p-lead">${esc(life)}</p>` : ""}
    ${linksRow([
      ...(pr.orcid || []).map((o) => [`ORCID ${o}`, `https://orcid.org/${o}`]),
      pr.scholar && [
        "Google Scholar",
        `https://scholar.google.com/citations?user=${pr.scholar}`,
      ],
      pr.openalex && ["OpenAlex", `https://openalex.org/${pr.openalex}`],
      pr.wikipedia && ["Wikipedia", pr.wikipedia],
    ])}
    ${listSection(
      "Institutions",
      (pr.institutions || []).map((r) => [
        people && people.institutionNamed.has(r.name)
          ? `<button type="button" class="p-up" data-go="institution:${people.institutionNamed.get(r.name).i}">${esc(r.name)}</button>`
          : esc(r.name),
        esc(countryName(r.country)),
        when(String(r.from), String(r.to)),
      ]),
    )}`;
}

// a venue's predecessor or successor: one of the collection opens its panel
export const titles = (list) =>
  list
    .map((r) =>
      r.venue != null
        ? `<button type="button" class="p-up" data-go="venue:${r.venue}">${esc(r.name)}</button>`
        : esc(r.name),
    )
    .join("; ");

export function venueFacts(pr, v) {
  if (v.publisher === "Conference" || v.publisher === "Preprint" || !pr)
    return v.publisher === "Conference"
      ? `<p class="p-lead">A conference: its papers appear in its proceedings.</p>`
      : v.publisher === "Preprint"
        ? `<p class="p-lead">A preprint server.</p>`
        : "";
  const since = pr.founded
    ? `founded ${pr.founded}`
    : pr.first_year
      ? `publishing since ${pr.first_year}`
      : "";
  const lead = [
    since,
    pr.about && pr.about !== "scientific journal" ? pr.about : "",
  ]
    .filter(Boolean)
    .map(esc)
    .join(" · ");
  const rows = [
    pr.continues && ["Continues", titles(pr.continues), ""],
    pr.continued_by && ["Continued by", titles(pr.continued_by), ""],
    pr.iso4 && ["Abbreviation", esc(pr.iso4), ""],
    pr.issn && ["ISSN", esc(pr.issn.join(", ")), ""],
    pr.country && ["Country", esc(pr.country), ""],
    (pr.societies || []).length && [
      "Societies",
      esc(pr.societies.join("; ")),
      "",
    ],
    (pr.other_titles || []).length && [
      "Also",
      esc(pr.other_titles.join("; ")),
      "",
    ],
  ].filter(Boolean);
  return `${lead ? `<p class="p-lead">${lead}</p>` : ""}
    ${linksRow([
      pr.website && ["Website", pr.website],
      pr.wikipedia && ["Wikipedia", pr.wikipedia],
      pr.openalex && ["OpenAlex", `https://openalex.org/${pr.openalex}`],
    ])}
    ${rows.length ? `<dl class="p-facts">${rows.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join("")}</dl>` : ""}`;
}

export function groupPanel(g, people) {
  const entries = (g.kind === "link" ? linkEntries(g) : g.entries)
    .slice()
    .sort(yearSort);
  const years = entries.map(yearOf).filter(Boolean);
  const span = years.length
    ? when(String(Math.min(...years)), String(Math.max(...years)))
    : "";
  const count = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const meta =
    g.kind === "venue"
      ? `<button type="button" class="p-up" data-go="publisher:${g.house.i}">${esc(g.publisher)}</button> · ${count}`
      : g.kind === "author" || g.kind === "publisher"
        ? `${g.kind} · ${count}`
        : g.kind === "institution"
          ? `${g.land ? `<button type="button" class="p-up" data-go="country:${g.land.i}">${esc(g.land.name)}</button> · ` : ""}${g.people.length} ${g.people.length === 1 ? "author" : "authors"} · ${count}`
          : g.kind === "country"
            ? `country · ${g.institutions.length} ${g.institutions.length === 1 ? "institution" : "institutions"} · ${g.people.length} ${g.people.length === 1 ? "author" : "authors"} · ${count}`
            : count;
  const tags = `<div class="p-sec"><h3>Entries <span>${entries.length}</span></h3><div class="tags">${entries.map((e) => tagHtml(e, " mini", true)).join("")}</div></div>`;
  let body = "";
  if (g.kind === "author")
    body = `<div class="p-profile" id="p-profile"><p class="p-none">Reading the profile…</p></div>
      ${chipsSection("Co-authors", g.co, "author", "with the entries they share")}
      ${chipsSection("Venues", g.venues, "venue", "with the entries there")}`;
  else if (g.kind === "venue")
    body = `<div class="p-profile" id="p-profile"><p class="p-none">Reading the profile…</p></div>
      ${chipsSection("Authors", g.authors, "author", "with their entries there")}`;
  else if (g.kind === "institution")
    body = `${g.ror ? linksRow([["ROR", g.ror]]) : ""}
      ${chipsSection("Authors", g.people, "author", "with the years their papers place them there")}`;
  else if (g.kind === "country")
    body = `${chipsSection("Institutions", g.counts, "institution", "with their authors")}
      ${chipsSection("Authors", g.people, "author", "with their entries from there")}`;
  else if (g.kind === "publisher")
    body = `${chipsSection("Venues", g.counts, "venue", "with the entries there")}
      ${chipsSection("Authors", g.authors, "author", "with their entries there")}`;
  else if (g.kind === "link")
    body = `<div class="p-sec"><div class="p-chips all">${[g.a, g.b]
      .filter((x) => x.kind !== "rest")
      .map((x) => chipOf(x.kind, x))
      .join("")}</div></div>`;
  return `<div class="p-head${g.hub ? " hub-c" : ""}"${g.hub ? ` style="${hubStyle(g.hub)}"` : ""}>
      <span class="p-name">${esc(g.name)}</span>
      <button type="button" class="p-close" aria-label="Clear the selection">${CROSS}</button>
    </div>
    <div class="p-meta">${meta}${span ? ` · ${span}` : ""}</div>
    ${body}${tags}`;
}

// the figures under the title, from the data the page has read
export function paintStats(el, m, ui, counts) {
  const items = [
    [m.entries.length, "papers"],
    ui.links.length && [ui.links.length, "citations"],
    counts && [counts.authors, "authors"],
    counts && [counts.venues, "venues"],
  ].filter(Boolean);
  el.innerHTML = items
    .map(
      ([n, label]) =>
        `<div><dt>${label}</dt><dd>${n.toLocaleString("en")}</dd></div>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------------------------

export function renderPanel(ui) {
  const p = ui.els.panel;
  const e = ui.selected;
  p.classList.toggle("empty", !e && !ui.group);
  if (!e && ui.group) {
    const g = ui.group;
    p.innerHTML = groupPanel(g, ui.model);
    p.querySelector(".p-close").addEventListener("click", () =>
      ui.selectGroup(null),
    );
    p.scrollTop = 0;
    if (g.kind === "author" || g.kind === "venue")
      readProfiles().then((all) => {
        const el = p.querySelector("#p-profile");
        if (ui.group !== g || !el) return;
        el.innerHTML =
          g.kind === "author"
            ? authorFacts(all && all.authors[g.i], ui.model)
            : venueFacts(all && all.venues[g.i], g);
      });
    return;
  }
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
