import {
  COLOURS,
  FRESH,
  HERE,
  KIND,
  ORG,
  RAW,
  ROOT,
  SPARE,
  STATUS,
  TOML,
  fold,
} from "./base.js";

export async function loadLive() {
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

export async function loadSnapshot() {
  const r = await fetch(HERE("data/catalogue.json"), FRESH);
  if (!r.ok) throw new Error("no snapshot");
  return { ...(await r.json()), source: "snapshot" };
}

export function citeName(p) {
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

export function model(data) {
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
        // a method by its name and year, a theory paper by its authors and year
        name: p.short ? `${p.short} ${p.year ?? ""}`.trim() : citeName(p),
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

// The citations and the works, stored with the site: the citations from the papers' own reference
// lists, the works from their records. A visit asks no service.
export async function readCitations() {
  const r = await fetch(HERE("data/citations.json"), FRESH);
  if (!r.ok) throw new Error("no citations");
  return (await r.json()).edges;
}

export let worksFile = null;

export function readWorks() {
  if (!worksFile)
    worksFile = fetch(HERE("data/works.json"), FRESH)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  return worksFile;
}

export const readWork = (e) => readWorks().then((all) => all[e.key] || {});

export let peopleFile = null;

export function readPeople() {
  if (!peopleFile)
    peopleFile = fetch(HERE("data/people.json"), FRESH)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  return peopleFile;
}

export let profilesFile = null;

export function readProfiles() {
  if (!profilesFile)
    profilesFile = fetch(HERE("data/profiles.json"), FRESH)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  return profilesFile;
}
