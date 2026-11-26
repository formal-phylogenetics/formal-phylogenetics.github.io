// The catalogue of formal phylogenetics. It reads the registry of the collection and the catalog of
// each hub from GitHub, and the data stored with the site (data/), and shows the tree of the
// collection as a fan; a view of the entries for the years a trim bar chooses (the timeline with the
// citations between them, the co-authorship of the authors, or the authors and the venues of their
// entries); the panel of what is pinned; and the lists of the hubs, the authors, the venues and
// the institutions. The page is drawn into #app; the host page gives the header and the footer.
//
// One visual language throughout: colour is the hub; shape is the kind of paper, round for a
// method and square for theory; fill is the status, solid once formalized, half while in progress.
//
// The parts are in js/: base.js, data.js, fan.js, timeline.js, card.js, people.js, network.js,
// panel.js, lists.js and page.js.

import { main } from "./js/page.js";

main();
