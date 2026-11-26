import { fold, when } from "./base.js";

// the authors, the venues and the publishers, and what joins them: for each author the co-authors
// and the venues, for each venue the authors, for each publisher the venues and the authors, each
// with the number of entries behind it
export function peopleModel(data, ui) {
  const entriesOf = (keys) => keys.map((k) => ui.byKey.get(k)).filter(Boolean);
  const authors = data.authors.map((a, i) => {
    const entries = entriesOf(a.papers);
    const hubs = new Map();
    for (const e of entries) hubs.set(e.hub, (hubs.get(e.hub) || 0) + 1);
    const hub = [...hubs].sort((x, y) => y[1] - x[1])[0]?.[0];
    return {
      kind: "author",
      i,
      name: a.name,
      short: a.short || a.name,
      entries,
      hub,
      hay: fold(`${a.name} ${a.short || ""}`),
      p: data.coauthors.pos[i],
    };
  });
  const venues = data.venues.map((v, i) => ({
    kind: "venue",
    i,
    name: v.name,
    short: v.short || v.name,
    publisher: v.publisher,
    entries: entriesOf(v.papers),
    hay: fold(`${v.name} ${v.short || ""} ${v.publisher}`),
  }));
  const houses = new Map();
  for (const v of venues) {
    if (!houses.has(v.publisher))
      houses.set(v.publisher, {
        kind: "publisher",
        name: v.publisher,
        full: (data.publishers || {})[v.publisher] || v.publisher,
        venues: [],
        entries: [],
        hay: fold(v.publisher),
      });
    const p = houses.get(v.publisher);
    p.venues.push(v);
    p.entries.push(...v.entries);
    v.house = p;
  }
  const publishers = [...houses.values()].sort(
    (a, b) =>
      (a.name === "Other") - (b.name === "Other") ||
      b.entries.length - a.entries.length ||
      a.name.localeCompare(b.name),
  );
  publishers.forEach((p, i) => (p.i = i));
  const venueOf = new Map();
  for (const v of venues) for (const e of v.entries) venueOf.set(e, v);
  const authorsOf = new Map();
  for (const a of authors)
    for (const e of a.entries) {
      if (!authorsOf.has(e)) authorsOf.set(e, []);
      authorsOf.get(e).push(a);
    }
  const co = data.coauthors.edges.map(([i, j, keys]) => ({
    kind: "link",
    a: authors[i],
    b: authors[j],
    entries: entriesOf(keys),
  }));
  const tally = (list) =>
    [...list.reduce((s, x) => s.set(x, (s.get(x) || 0) + 1), new Map())].map(
      ([who, n]) => ({ who, n }),
    );
  const byCount = (x, y) => y.n - x.n || x.who.name.localeCompare(y.who.name);
  for (const a of authors) a.co = [];
  for (const l of co) {
    l.a.co.push({ who: l.b, n: l.entries.length });
    l.b.co.push({ who: l.a, n: l.entries.length });
  }
  for (const a of authors) {
    a.co.sort(byCount);
    a.venues = tally(a.entries.map((e) => venueOf.get(e)).filter(Boolean)).sort(
      byCount,
    );
  }
  for (const v of venues)
    v.authors = tally(v.entries.flatMap((e) => authorsOf.get(e) || [])).sort(
      byCount,
    );
  for (const p of publishers) {
    p.counts = p.venues
      .map((v) => ({ who: v, n: v.entries.length }))
      .sort(byCount);
    p.authors = tally(p.entries.flatMap((e) => authorsOf.get(e) || [])).sort(
      byCount,
    );
  }
  const institutions = (data.institutions || []).map((h, i) => ({
    kind: "institution",
    i,
    name: h.name,
    country: h.country || "",
    ror: h.ror || "",
    people: h.authors
      .map(([j, from, to]) => ({
        who: authors[j],
        n: when(String(from || ""), String(to || "")),
      }))
      .filter((x) => x.who),
    entries: entriesOf(h.papers),
    hay: fold(
      `${h.name} ${h.authors.map(([j]) => (authors[j] ? authors[j].hay : "")).join(" ")}`,
    ),
  }));
  const institutionNamed = new Map(institutions.map((h) => [h.name, h]));
  return {
    authors,
    venues,
    publishers,
    institutions,
    institutionNamed,
    venueOf,
    authorsOf,
    co,
  };
}

// the same pinned thing: the same object, or a link between the same two
export const sameGroup = (g, h) =>
  g === h ||
  Boolean(
    g &&
    h &&
    g.kind === "link" &&
    h.kind === "link" &&
    g.a === h.a &&
    g.b === h.b,
  );

// the entries of a link: those its two ends share
export const linkEntries = (g) =>
  g.a.entries.filter((e) => g.b.entries.includes(e));

// ---------------------------------------------------------------------------------------------
// The panel of an author, a venue, a publisher or a link: what the registries say, then the
// co-authors, venues or authors with the entries behind each, then the entries
