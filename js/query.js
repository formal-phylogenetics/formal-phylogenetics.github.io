import { STATUS, fold, yearOf } from "./base.js";

// The search: words, which an entry's name, title, authors, year, venue or institutions must all
// hold, and fields, written field:value or field:"several words", each narrowing the entries.
// With an author, an institution or a country is where the byline of the paper places that author.
const ALIAS = {
  author: "author",
  by: "author",
  institution: "institution",
  inst: "institution",
  at: "institution",
  country: "country",
  venue: "venue",
  journal: "venue",
  publisher: "publisher",
  year: "year",
  years: "year",
  hub: "hub",
  kind: "kind",
  status: "status",
  title: "title",
};
const split = (s) => fold(s).split(/\s+/).filter(Boolean);

export function parseQuery(text) {
  const words = [];
  const fields = [];
  const re = /([A-Za-z]+):(?:"([^"]*)"?|(\S*))|"([^"]*)"?|(\S+)/g;
  for (const m of String(text || "").matchAll(re)) {
    if (m[1] === undefined) {
      words.push(...split(m[4] ?? m[5] ?? ""));
      continue;
    }
    const f = ALIAS[m[1].toLowerCase()];
    const raw = (m[2] ?? m[3] ?? "").trim();
    if (!f) words.push(...split(m[0].replace(/"/g, "")));
    else if (raw) fields.push({ f, raw, v: split(raw) });
  }
  return { words, fields, on: words.length > 0 || fields.length > 0 };
}

// a field and its value, as the search box writes them
export const fieldText = (f, raw) =>
  `${f}:${/[\s:]/.test(raw) ? `"${raw.replace(/"/g, "")}"` : raw}`;

// a year, or a span of years: 2004, 1999-2004, 2010-, -1999, >2010, <2000
export function yearSpan(raw) {
  const s = raw.replace(/[–—]|\.\./g, "-");
  let m;
  if ((m = s.match(/^(\d{4})$/))) return [+m[1], +m[1]];
  if ((m = s.match(/^(\d{4})?-(\d{4})?$/)) && (m[1] || m[2]))
    return [m[1] ? +m[1] : -Infinity, m[2] ? +m[2] : Infinity];
  if ((m = s.match(/^>(=?)(\d{4})$/)))
    return [+m[2] + (m[1] ? 0 : 1), Infinity];
  if ((m = s.match(/^<(=?)(\d{4})$/)))
    return [-Infinity, +m[2] - (m[1] ? 0 : 1)];
  return null;
}

const hubHay = new WeakMap();
const hayOfHub = (h) => {
  if (!hubHay.has(h)) {
    const names = [];
    for (let x = h; x; x = x.parent) names.push(x.name, x.title || "");
    hubHay.set(h, fold(names.join(" ").replace(/-/g, " ")));
  }
  return hubHay.get(h);
};

// the search as tests: whether an entry matches, and whether a node of a graph or a row of a
// list does (it is named by the words, or its own field holds and one of its entries matches)
export function compileQuery(text, people) {
  const q = parseQuery(text);
  const by = (f) => q.fields.filter((x) => x.f === f).map((x) => x.v);
  const A = by("author");
  const I = by("institution");
  const C = by("country");
  const V = by("venue");
  const P = by("publisher");
  const H = by("hub");
  const K = by("kind");
  const S = by("status");
  const T = by("title");
  const Y = q.fields
    .filter((x) => x.f === "year")
    .map((x) => yearSpan(x.raw))
    .filter(Boolean);
  const holds = (hay, v) => v.every((w) => hay.includes(w));
  const needs = A.length + I.length + C.length + V.length + P.length > 0;
  const ready = !needs || Boolean(people);
  const named = (who) => A.some((x) => holds(who.hay, x));

  const test = (e) => {
    if (!q.words.every((w) => e.hay.includes(w))) return false;
    if (T.length && !T.every((v) => holds(fold(e.title), v))) return false;
    if (K.length && !K.every((v) => holds(e.kind, v))) return false;
    if (
      S.length &&
      !S.every((v) =>
        holds(
          fold(
            `${e.status} ${e.status.replace(/-/g, " ")} ${STATUS[e.status] || ""}`,
          ),
          v,
        ),
      )
    )
      return false;
    if (H.length && !H.every((v) => holds(hayOfHub(e.hub), v))) return false;
    if (Y.length) {
      const y = yearOf(e);
      if (!y || !Y.every(([a, b]) => y >= a && y <= b)) return false;
    }
    if (!needs) return true;
    if (!people) return false;
    const venue = people.venueOf.get(e);
    if (V.length && !(venue && V.every((x) => holds(venue.hay, x))))
      return false;
    if (
      P.length &&
      !(
        venue &&
        P.every((x) =>
          holds(fold(`${venue.house.name} ${venue.house.full}`), x),
        )
      )
    )
      return false;
    const who = people.authorsOf.get(e) || [];
    if (!A.every((x) => who.some((a) => holds(a.hay, x)))) return false;
    if (!I.length && !C.length) return true;
    const places = (people.placesOf.get(e) || []).filter(
      (p) => !A.length || named(p.who),
    );
    return (
      I.every((x) => places.some((p) => holds(p.where.own, x))) &&
      C.every((x) =>
        places.some((p) => p.where.land && holds(p.where.land.own, x)),
      )
    );
  };

  // a row or a node is one the fields name, when a field names its kind
  const own = (n) => {
    switch (n.kind) {
      case "author":
        return !A.length || named(n);
      case "venue":
        return !V.length || V.some((x) => holds(n.hay, x));
      case "publisher":
        return (
          !P.length || P.some((x) => holds(fold(`${n.name} ${n.full}`), x))
        );
      case "institution":
        return !I.length || I.some((x) => holds(n.own, x));
      case "country":
        return !C.length || C.some((x) => holds(n.own, x));
      default:
        return true;
    }
  };
  // an entry counts for an institution or a country when one of the authors searched for is there
  const counts = (n, e) => {
    if (!test(e)) return false;
    if (
      !A.length ||
      !people ||
      (n.kind !== "institution" && n.kind !== "country")
    )
      return true;
    return (people.placesOf.get(e) || []).some(
      (p) =>
        (n.kind === "institution" ? p.where === n : p.where.land === n) &&
        named(p.who),
    );
  };
  const plain = q.fields.length === 0;
  const node = (n) =>
    !q.on ||
    (plain && q.words.every((w) => (n.hay || "").includes(w))) ||
    (own(n) && (n.entries || []).some((e) => counts(n, e)));
  return { ...q, plain, ready, test, own, counts, node };
}
