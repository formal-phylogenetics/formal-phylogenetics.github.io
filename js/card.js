import { STATUS, esc, hubStyle, short } from "./base.js";
import { readWork } from "./data.js";

export const card = {
  el: null,
  entry: null,
  pinned: null,
  timer: 0,
  place: () => {},
};

export function cardHtml(e, work, waiting) {
  const list =
    work && work.authors && work.authors.length ? work.authors : null;
  const who = list
    ? list.length > 6
      ? `${list.slice(0, 6).join(", ")} et al.`
      : list.join(", ")
    : e.authors;
  const venue = work && work.venue ? ` · ${work.venue}` : "";
  let text = (work && work.abstract) || "";
  if (text.length > 900)
    text = `${text.slice(0, text.lastIndexOf(" ", 880))} …`;
  const body = text
    ? `<p class="t-abstract">${esc(text)}</p>`
    : waiting
      ? `<p class="t-wait">Reading the abstract…</p>`
      : work
        ? `<p class="t-wait">No abstract is available.</p>`
        : "";
  const nth = (k) =>
    `${k}${["th", "st", "nd", "rd"][(k % 100 > 10 && k % 100 < 14) || k % 10 > 3 ? 0 : k % 10]}`;
  const cited = e.cited
    ? ` · cited by ${e.cited} in the catalogs${e.place ? `, ${nth(e.place)} by weight` : ""}`
    : "";
  return `<div class="t-head"><span class="t-name k-${e.kind}">${esc(e.name)}</span><span class="t-kind">${e.kind}</span></div>
    <div class="t-title">${esc(e.title)}</div>
    <div class="t-by">${esc(who)}${e.year ? ` (${esc(e.year)})` : ""}${esc(venue)}</div>
    ${body}
    <div class="t-foot"><span class="t-status">${esc(STATUS[e.status])}</span><span>${esc(short(e.hub.name))} › ${esc(e.family.title)}${esc(cited)}</span></div>
    <div class="t-hint">${card.pinned === e ? "Click to unpin" : "Click to pin"}</div>`;
}

export function showCard(e, place) {
  const tip = card.el;
  card.place = place;
  if (card.entry !== e) {
    card.entry = e;
    clearTimeout(card.timer);
    tip.style.cssText = hubStyle(e.hub);
    tip.innerHTML = cardHtml(e, e.work, !e.work);
    if (!e.work) {
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

export function hideCard() {
  card.entry = null;
  clearTimeout(card.timer);
  if (card.el) card.el.hidden = true;
}

export function placeAt(x, y) {
  const tip = card.el;
  let left = x + 18;
  let top = y + 18;
  if (left + tip.offsetWidth > innerWidth - 12) left = x - tip.offsetWidth - 18;
  if (top + tip.offsetHeight > innerHeight - 12)
    top = y - tip.offsetHeight - 18;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

export function placeBy(rect) {
  const tip = card.el;
  let top = rect.bottom + 8;
  if (top + tip.offsetHeight > innerHeight - 12)
    top = rect.top - tip.offsetHeight - 8;
  tip.style.left = `${Math.min(Math.max(8, rect.left), innerWidth - tip.offsetWidth - 12)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

// ---------------------------------------------------------------------------------------------
// The page: the list of the hubs beside the views and the panel of the selected entry. Pointing at
// an entry anywhere marks it everywhere; a click pins it and shows what it cites (ink) and what
// cites it (amber), and a click on the pinned entry unpins it. The panel's links open it.
