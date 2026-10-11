// Action items wait for a decision, not forever after it. A live replay of a build-14 save showed
// "Deck Build is running slow — assign plant" at the top of Home 32 days after the job ended,
// with no active sites, under the heading "1 thing needs a decision".
import {
  pushNotice, expireNotices, resolveNotice, dropStaleLegacyActions, topNotice,
  LEGACY_ACTION_MAX_AGE_DAYS,
} from "../src/systems/noticeInbox.js";

const game = (over = {}) => ({ day: 10, inbox: [], activeSites: [{ id: "s1" }], ...over });

test("a site's action item is withdrawn when the problem is fixed", () => {
  const g = game();
  pushNotice(g, "Deck is running slow", "action", { key: "plant:s1", siteId: "s1" });
  pushNotice(g, "Bankruptcy in 3 days", "action", { key: "bankruptcy" });
  resolveNotice(g, "plant:s1");
  expect(g.inbox.map((n) => n.key)).toEqual(["bankruptcy"]);
});

test("a site's notices go when the site does, even action items", () => {
  const g = game();
  pushNotice(g, "Deck is running slow", "action", { key: "plant:s1", siteId: "s1" });
  pushNotice(g, "Bankruptcy in 3 days", "action", { key: "bankruptcy" });
  g.activeSites = [];
  g.day = 40;
  expireNotices(g);
  expect(g.inbox.map((n) => n.key)).toEqual(["bankruptcy"]); // not about a site: still waits
});

test("an unresolved action item on a live site still never ages out", () => {
  const g = game();
  pushNotice(g, "Deck has stopped: short lumber", "action", { key: "materials:s1", siteId: "s1" });
  g.day = 200;
  expireNotices(g);
  expect(topNotice(g).key).toBe("materials:s1");
});

test("old saves: keyless action items older than the limit are dropped, recent ones kept", () => {
  const g = game({ day: 36 });
  g.inbox = [
    { id: "n1", message: "Deck Build is running slow", level: "action", day: 4 },
    { id: "n2", message: "Something from this week", level: "action", day: 36 - LEGACY_ACTION_MAX_AGE_DAYS },
    { id: "n3", message: "Keyed and old", level: "action", day: 2, key: "bankruptcy" },
  ];
  dropStaleLegacyActions(g);
  expect(g.inbox.map((n) => n.id)).toEqual(["n2", "n3"]);
});

test("the real build-14 case: the stale card is gone after loading", () => {
  const { freshState, migrateState } = require("../src/games/constructionflow/ConstructionFlowScreen.js");
  const s = freshState();
  s.day = 36; s.activeSites = [];
  s.inbox = [{ id: "n9", message: "Deck Build is running slow. Assign the right machine or the deadline will go.", level: "action", day: 4, actionLabel: "Assign plant", actionTab: "Sites" }];
  const g = migrateState(JSON.parse(JSON.stringify(s)));
  expect(g.inbox.some((n) => /running slow/.test(n.message))).toBe(false);
});
