// Living-market contract tests.
//
// The properties that matter here are the ones FleetFlow learned the hard way across builds
// 58 and 59, so each gets a test named after the failure it prevents:
//
//   - the market can always come back (but companies you BOUGHT stay bought)
//   - an entrant is never inert — it carries its own seed and identity
//   - rival news never consumes an RNG draw
//   - one bankruptcy lifecycle, not two sharing a field with opposite meanings
//   - what an acquisition promises is what it delivers

import {
  RIVAL_STATUS,
  DAYS_TO_FAIL,
  DAYS_TO_RESTRUCTURE,
  rivalValuation,
  FAILING_VALUATION,
  FAILING_CASH,
  isRivalFailing,
  stepRivalLifecycle,
  isRivalOffTheBoard,
  countLiveRivals,
  THIN_MARKET_THRESHOLD,
  ENTRANT_COOLDOWN_DAYS,
  isMarketThin,
  shouldSpawnEntrant,
  ENTRANT_ARCHETYPES,
  createEntrant,
  getRivalPersonality,
  MARKET_NEWS_CAP,
  pushMarketNews,
  describeRivalGrowth,
  describeRivalDecline,
  describeRivalLifecycleNews,
  describeEntrantArrival,
  ACQUISITION_MIN_REPUTATION,
  ACQUISITION_COOLDOWN_DAYS,
  MAX_TRANSFERRED_CREW,
  MAX_TRANSFERRED_MACHINES,
  acquisitionCost,
  planAcquisition,
  acquisitionBlockReason,
} from "../src/systems/rivalMarket.js";

const rival = (over = {}) => ({
  id: "apex", name: "Apex Construction", aggression: 0.7, focus: "residential",
  rep: 20, cash: 50000, employees: 6, equipment: 3, activeJobs: 2,
  status: RIVAL_STATUS.ACTIVE, troubleDays: 0, cityPresence: ["salem"], ...over,
});

const game = (over = {}) => ({
  day: 100, reputation: 60, cash: 500000, rivals: [], acquiredRivals: [],
  lastAcquisitionDay: 0, ...over,
});

// A deterministic RNG so lifecycle and entrant tests are repeatable.
const fixed = (v) => () => v;

describe("one valuation formula", () => {
  test("cash, reputation and geography all count", () => {
    expect(rivalValuation(rival({ cash: 0, rep: 0, cityPresence: ["salem"] }))).toBe(100000);
    expect(rivalValuation(rival({ cash: 5000, rep: 1, cityPresence: ["salem"] }))).toBe(155000);
    expect(rivalValuation(rival({ cityPresence: ["a", "b"] }))).toBeGreaterThan(rivalValuation(rival()));
  });

  test("a company with no geography still counts as having one base", () => {
    expect(rivalValuation({ cash: 0, rep: 0 })).toBe(100000);
    expect(rivalValuation({ cash: 0, rep: 0, cityPresence: [] })).toBe(100000);
  });

  test("garbage never produces NaN — including a literal null in the rivals array", () => {
    // A JS default parameter only fires for `undefined`, so `null` reaches the body. A
    // corrupt save can easily hold one, and it used to throw.
    for (const bad of [undefined, null, {}, { cash: "x", rep: NaN }, { cityPresence: "salem" }]) {
      expect(Number.isFinite(rivalValuation(bad))).toBe(true);
    }
  });

  test("every entry point survives a null company record", () => {
    for (const fn of [rivalValuation, isRivalFailing, stepRivalLifecycle, describeEntrantArrival, acquisitionCost]) {
      expect(() => fn(null)).not.toThrow();
    }
    expect(() => isRivalOffTheBoard(null, null)).not.toThrow();
    expect(() => getRivalPersonality(null, null)).not.toThrow();
    expect(() => describeRivalGrowth(null, null)).not.toThrow();
    expect(() => describeRivalLifecycleNews(null, null)).not.toThrow();
    expect(() => planAcquisition(null, null)).not.toThrow();
    expect(() => acquisitionBlockReason(null, null)).not.toThrow();
    expect(() => countLiveRivals(null)).not.toThrow();
    expect(() => shouldSpawnEntrant(null, () => 0)).not.toThrow();
    expect(() => createEntrant(null, () => 0.5)).not.toThrow();
  });
});

describe("one bankruptcy lifecycle, not two", () => {
  // The defect: `enhancedRivalDailyLogic` had a lifecycle at the top of its loop treating
  // `bankruptDays` as "days spent bankrupt", and a second ("Rival War: Feature 7") treating
  // the same field as "days spent nearly bankrupt". The second's recovery was unreachable.

  test("a healthy company stays active and accumulates no trouble", () => {
    const { changes, trading } = stepRivalLifecycle(rival());
    expect(trading).toBe(true);
    expect(changes.status).toBeUndefined();
    expect(changes.troubleDays).toBeUndefined();
  });

  test("a failing company starts struggling, and keeps trading while it does", () => {
    const { changes, news, trading } = stepRivalLifecycle(rival({ cash: FAILING_CASH - 1 }));
    expect(changes.status).toBe(RIVAL_STATUS.STRUGGLING);
    expect(changes.troubleDays).toBe(1);
    expect(news.kind).toBe("declining");
    // Still trading: a struggling company is a competitor, not a corpse.
    expect(trading).toBe(true);
  });

  test("sustained trouble folds the company on exactly the documented day", () => {
    const struggling = rival({ cash: FAILING_CASH - 1, status: RIVAL_STATUS.STRUGGLING, troubleDays: DAYS_TO_FAIL - 2 });
    expect(stepRivalLifecycle(struggling).changes.status).toBe(RIVAL_STATUS.STRUGGLING);
    const oneMore = { ...struggling, troubleDays: DAYS_TO_FAIL - 1 };
    const result = stepRivalLifecycle(oneMore);
    expect(result.changes.status).toBe(RIVAL_STATUS.BANKRUPT);
    expect(result.changes.troubleDays).toBe(0);
    expect(result.news.kind).toBe("failed");
    expect(result.trading).toBe(false);
  });

  test("a company that recovers before folding goes back to trading, and says so", () => {
    const recovering = rival({ status: RIVAL_STATUS.STRUGGLING, troubleDays: 12, cash: 90000 });
    const { changes, news, trading } = stepRivalLifecycle(recovering);
    expect(changes.status).toBe(RIVAL_STATUS.ACTIVE);
    expect(changes.troubleDays).toBe(0);
    expect(news.kind).toBe("recovered");
    expect(trading).toBe(true);
  });

  test("a bankrupt company restructures after the documented time, smaller than before", () => {
    const under = rival({ status: RIVAL_STATUS.BANKRUPT, troubleDays: DAYS_TO_RESTRUCTURE - 1, rep: 40 });
    const { changes, news, trading } = stepRivalLifecycle(under, { rng: fixed(0.5) });
    expect(changes.status).toBe(RIVAL_STATUS.ACTIVE);
    expect(changes.rep).toBe(16); // 40 * 0.4
    expect(changes.activeJobs).toBe(0);
    expect(changes.troubleDays).toBe(0);
    expect(news.kind).toBe("restructured");
    expect(trading).toBe(false); // does not trade on the day it re-enters
  });

  test("a bankrupt company does not trade or recover early", () => {
    for (const days of [0, 1, DAYS_TO_RESTRUCTURE - 2]) {
      const r = stepRivalLifecycle(rival({ status: RIVAL_STATUS.BANKRUPT, troubleDays: days }));
      expect(r.trading).toBe(false);
      expect(r.changes.status).toBeUndefined();
      expect(r.changes.troubleDays).toBe(days + 1);
    }
  });

  test("a restructured company never comes back richer than it failed", () => {
    for (const roll of [0, 0.5, 0.9999]) {
      const { changes } = stepRivalLifecycle(
        rival({ status: RIVAL_STATUS.BANKRUPT, troubleDays: DAYS_TO_RESTRUCTURE, rep: 80, cash: 500000 }),
        { rng: fixed(roll) }
      );
      expect(changes.cash).toBeLessThan(50000);
      expect(changes.rep).toBeLessThan(80);
    }
  });

  test("troubleDays always means 'days in the current state' and resets on every transition", () => {
    // The whole point of unifying the two systems: one field, one meaning.
    const transitions = [
      stepRivalLifecycle(rival({ cash: FAILING_CASH - 1, troubleDays: DAYS_TO_FAIL - 1 })),
      stepRivalLifecycle(rival({ status: RIVAL_STATUS.STRUGGLING, troubleDays: 5, cash: 90000 })),
      stepRivalLifecycle(rival({ status: RIVAL_STATUS.BANKRUPT, troubleDays: DAYS_TO_RESTRUCTURE }), { rng: fixed(0.5) }),
    ];
    for (const t of transitions) expect(t.changes.troubleDays).toBe(0);
  });

  test("a company with a corrupt status is treated as active, not crashed on", () => {
    for (const bad of [undefined, null, "", "Exploded", 7]) {
      expect(() => stepRivalLifecycle(rival({ status: bad }))).not.toThrow();
    }
    expect(() => stepRivalLifecycle(undefined)).not.toThrow();
  });
});

describe("isRivalFailing", () => {
  test("either deep cash trouble or a collapsed valuation counts", () => {
    expect(isRivalFailing(rival({ cash: FAILING_CASH - 1 }))).toBe(true);
    expect(isRivalFailing(rival({ cash: 0, rep: 0, cityPresence: [] }))).toBe(false); // 100k floor
    expect(isRivalFailing(rival())).toBe(false);
  });

  test("asking the question never changes the answer", () => {
    const r = rival({ cash: FAILING_CASH - 1 });
    const before = JSON.stringify(r);
    isRivalFailing(r);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("the market can always come back", () => {
  const live = (n) => Array.from({ length: n }, (_, i) => rival({ id: `r${i}` }));

  test("a healthy field spawns nobody", () => {
    expect(isMarketThin(game({ rivals: live(7) }))).toBe(false);
    expect(shouldSpawnEntrant(game({ rivals: live(7) }), fixed(0))).toBe(false);
  });

  test("a thin field can spawn, but only off cooldown and on a low roll", () => {
    const thin = game({ rivals: live(1), lastEntrantDay: 0, day: 100 });
    expect(isMarketThin(thin)).toBe(true);
    expect(shouldSpawnEntrant(thin, fixed(0.001))).toBe(true);
    expect(shouldSpawnEntrant(thin, fixed(0.99))).toBe(false);
  });

  test("an arrival is news, not a conveyor belt", () => {
    const justSpawned = game({ rivals: live(1), lastEntrantDay: 100, day: 100 });
    expect(shouldSpawnEntrant(justSpawned, fixed(0))).toBe(false);
    const stillCooling = game({ rivals: live(1), lastEntrantDay: 100, day: 100 + ENTRANT_COOLDOWN_DAYS - 1 });
    expect(shouldSpawnEntrant(stillCooling, fixed(0))).toBe(false);
    const clear = game({ rivals: live(1), lastEntrantDay: 100, day: 100 + ENTRANT_COOLDOWN_DAYS });
    expect(shouldSpawnEntrant(clear, fixed(0))).toBe(true);
  });

  test("bankrupt and acquired companies do not count as live competition", () => {
    const g = game({
      rivals: [
        rival({ id: "a" }),
        rival({ id: "b", status: RIVAL_STATUS.BANKRUPT }),
        rival({ id: "c" }),
      ],
      acquiredRivals: ["c"],
    });
    expect(countLiveRivals(g)).toBe(1);
    expect(isRivalOffTheBoard(rival({ id: "c" }), g)).toBe(true);
    expect(isRivalOffTheBoard(rival({ id: "a" }), g)).toBe(false);
  });

  test("THE COMPANIES YOU BOUGHT STAY BOUGHT", () => {
    // FleetFlow's build 59 is explicit: the buyout copy promises they are off the market
    // permanently, so a respawn would make the game a liar. An empty board must be refilled
    // by NEW companies, never by resurrecting purchased ones.
    const g = game({ rivals: [rival({ id: "apex" })], acquiredRivals: ["apex"], lastEntrantDay: 0 });
    expect(countLiveRivals(g)).toBe(0);
    const entrant = createEntrant(g, fixed(0.5));
    expect(entrant.id).not.toBe("apex");
    expect(g.acquiredRivals).toContain("apex");
  });

  test("a market emptied entirely can still be refilled", () => {
    const g = game({ rivals: [], acquiredRivals: [], lastEntrantDay: -999 });
    expect(countLiveRivals(g)).toBe(0);
    expect(isMarketThin(g)).toBe(true);
    expect(shouldSpawnEntrant(g, fixed(0))).toBe(true);
  });

  test("the thin threshold leaves room for a real field", () => {
    expect(THIN_MARKET_THRESHOLD).toBeGreaterThan(0);
    expect(THIN_MARKET_THRESHOLD).toBeLessThan(7);
  });
});

describe("an entrant is never inert", () => {
  // FleetFlow's build 59: its daily sim begins with `AI_RIVALS_DEFS.find(...)` and returns
  // early with no def, so a generated company without a seed would sit on the board forever —
  // present, but never growing, struggling or dying. Construction Flow's `enhancedRivalBidding`
  // has the same shape with `rivalPersonality[rival.id]`.

  test("every entrant carries its own seed AND identity", () => {
    for (let i = 0; i < 40; i++) {
      const e = createEntrant(game(), () => i / 40);
      expect(typeof e.id).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(e.aggression)).toBe(true);
      expect(typeof e.focus).toBe("string");
      // The part that makes it behave at all:
      expect(e.personality).toBeTruthy();
      expect(Array.isArray(e.personality.focus)).toBe(true);
      expect(e.personality.focus.length).toBeGreaterThan(0);
    }
  });

  test("the personality lookup falls back to the record, so an entrant can bid", () => {
    const authored = { apex: { focus: ["Residential"], focusBonus: 1.15 } };
    expect(getRivalPersonality(rival({ id: "apex" }), authored)).toBe(authored.apex);

    const entrant = createEntrant(game(), fixed(0.5));
    // Not in the authored table — this is exactly the case that used to go inert.
    expect(authored[entrant.id]).toBeUndefined();
    expect(getRivalPersonality(entrant, authored)).toBe(entrant.personality);
  });

  test("a company with no personality anywhere returns null rather than undefined", () => {
    expect(getRivalPersonality({ id: "ghost" }, {})).toBeNull();
    expect(getRivalPersonality({}, {})).toBeNull();
    expect(getRivalPersonality(undefined, undefined)).toBeNull();
  });

  test("an entrant is never richer than the companies the game opens with", () => {
    // Clearing the board must not be punished with a stronger replacement.
    for (let i = 0; i < 40; i++) {
      const e = createEntrant(game(), () => i / 40);
      expect(e.cash).toBeLessThanOrEqual(32000); // opening rivals roll 20k-50k
      expect(e.rep).toBeLessThanOrEqual(10);
      expect(e.employees).toBeLessThanOrEqual(2);
      expect(e.equipment).toBeLessThanOrEqual(1);
    }
  });

  test("an entrant id can never collide with an authored company's", () => {
    const authoredIds = ["apex", "summit", "ironpeak", "northwest", "pacific_group", "western_build_co", "summit_construction"];
    for (let i = 0; i < 40; i++) {
      const e = createEntrant(game({ day: i * 7 }), () => i / 40);
      expect(authoredIds).not.toContain(e.id);
      expect(e.id.startsWith("entrant_")).toBe(true);
    }
  });

  test("entrants start active, solvent and not in trouble", () => {
    const e = createEntrant(game(), fixed(0.5));
    expect(e.status).toBe(RIVAL_STATUS.ACTIVE);
    expect(e.troubleDays).toBe(0);
    expect(isRivalFailing(e)).toBe(false);
  });

  test("every archetype is reachable and fully specified", () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(createEntrant(game(), () => i / 200).archetypeKey);
    expect(seen.size).toBe(ENTRANT_ARCHETYPES.length);
    for (const a of ENTRANT_ARCHETYPES) {
      expect(a.firstNames.length).toBeGreaterThan(0);
      expect(a.suffixes.length).toBeGreaterThan(0);
      expect(a.personality.focus.length).toBeGreaterThan(0);
    }
  });

  test("an arrival announces itself in plain language", () => {
    const line = describeEntrantArrival(createEntrant(game(), fixed(0.5)));
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain("undefined");
  });
});

describe("rival news lives in its own feed and never touches the RNG", () => {
  test("the news builders never call Math.random", () => {
    // FleetFlow's build 59 defect, tested directly.
    const spy = jest.spyOn(Math, "random");
    try {
      describeRivalGrowth(rival(), { hired: 2, machines: 1, jobsWon: 3, cityOpened: "Bend" });
      describeRivalDecline(rival(), 12);
      describeRivalLifecycleNews(rival(), { kind: "failed" });
      describeEntrantArrival(rival());
      const g = game();
      for (let i = 0; i < 50; i++) pushMarketNews(g, { text: `line ${i}`, tone: "neutral" });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  test("news ids are unique without being random", () => {
    const g = game();
    for (let i = 0; i < 20; i++) pushMarketNews(g, { text: `n${i}` });
    const ids = g.marketNews.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the feed is capped, newest first, so it cannot grow forever", () => {
    const g = game();
    for (let i = 0; i < MARKET_NEWS_CAP + 25; i++) pushMarketNews(g, { text: `n${i}` });
    expect(g.marketNews).toHaveLength(MARKET_NEWS_CAP);
    expect(g.marketNews[0].text).toBe(`n${MARKET_NEWS_CAP + 24}`);
  });

  test("rival news never touches the player's own operations feeds", () => {
    // The defect: rival chatter went through addLog, which caps `logs` at 25 and `opsFeed`
    // at 20 — the player's own history — so a rival buying a digger pushed the player's site
    // events out of it.
    const g = game({ logs: ["my own event"], opsFeed: [{ id: "x", text: "my own event" }] });
    for (let i = 0; i < 60; i++) pushMarketNews(g, { text: `rival news ${i}` });
    expect(g.logs).toEqual(["my own event"]);
    expect(g.opsFeed).toHaveLength(1);
  });

  test("an empty or malformed item is ignored rather than posted", () => {
    const g = game();
    pushMarketNews(g, null);
    pushMarketNews(g, {});
    pushMarketNews(g, { text: "" });
    pushMarketNews(null, { text: "x" });
    expect(g.marketNews || []).toHaveLength(0);
  });

  test("every news entry carries what the UI needs to render it", () => {
    const g = game();
    pushMarketNews(g, { text: "something happened", tone: "caution", rivalId: "apex" });
    const [item] = g.marketNews;
    expect(item.text).toBe("something happened");
    expect(item.tone).toBe("caution");
    expect(item.rivalId).toBe("apex");
    expect(item.day).toBe(100);
  });
});

describe("growth is narrated from movements that really happened", () => {
  test("every clause corresponds to a real delta", () => {
    const line = describeRivalGrowth(rival(), { hired: 2, machines: 1, cityOpened: "Bend" });
    expect(line).toContain("Apex Construction");
    expect(line).toContain("Bend");
    expect(line).toContain("1 machine");
    expect(line).toContain("2 workers");
  });

  test("nothing moved means no headline — silence is correct", () => {
    expect(describeRivalGrowth(rival(), {})).toBeNull();
    expect(describeRivalGrowth(rival(), { hired: 0, machines: 0, jobsWon: 0 })).toBeNull();
    expect(describeRivalGrowth(rival(), undefined)).toBeNull();
  });

  test("singular and plural both read correctly", () => {
    expect(describeRivalGrowth(rival(), { hired: 1 })).toContain("1 worker");
    expect(describeRivalGrowth(rival(), { hired: 3 })).toContain("3 workers");
    expect(describeRivalGrowth(rival(), { machines: 1 })).toContain("1 machine.");
    expect(describeRivalGrowth(rival(), { machines: 2 })).toContain("2 machines");
  });

  test("several movements read as a sentence, not a list of fragments", () => {
    const line = describeRivalGrowth(rival(), { hired: 2, machines: 1, jobsWon: 1 });
    expect(line).toContain(" and ");
    expect(line).not.toContain(",,");
    expect(line.endsWith(".")).toBe(true);
  });
});

describe("decline is visible before it is an opportunity", () => {
  test("the line escalates as the slump deepens", () => {
    const early = describeRivalDecline(rival(), 1);
    const mid = describeRivalDecline(rival(), Math.ceil(DAYS_TO_FAIL * 0.5));
    const late = describeRivalDecline(rival(), DAYS_TO_FAIL - 1);
    expect(new Set([early, mid, late]).size).toBe(3);
    expect(late).toMatch(/closing|creditors|cash up front/i);
  });

  test("the same company at the same stage says the same thing", () => {
    expect(describeRivalDecline(rival(), 5)).toBe(describeRivalDecline(rival(), 5));
  });

  test("every lifecycle event has a headline, and none reads as undefined", () => {
    for (const kind of ["failed", "restructured", "recovered", "declining"]) {
      const line = describeRivalLifecycleNews(rival(), { kind, daysStruggling: 10 });
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toContain("undefined");
    }
    expect(describeRivalLifecycleNews(rival(), { kind: "nonsense" })).toBeNull();
  });
});

describe("an acquisition transfers a real business", () => {
  test("a going concern hands over people, plant and cash", () => {
    const plan = planAcquisition(rival({ employees: 6, equipment: 3, cash: 80000 }), game());
    expect(plan.bankrupt).toBe(false);
    expect(plan.crew).toHaveLength(6);
    expect(plan.machines).toBe(3);
    expect(plan.cashTransferred).toBe(56000); // 70%
    expect(plan.summary).toContain("going concern");
  });

  test("a failed company hands over nothing but what cash is left", () => {
    // Its plant and crew went to creditors before the player ever got there, which is what
    // the cheap distressed price has always represented.
    const plan = planAcquisition(rival({ status: RIVAL_STATUS.BANKRUPT, employees: 20, equipment: 8, cash: 10000 }), game());
    expect(plan.bankrupt).toBe(true);
    expect(plan.crew).toHaveLength(0);
    expect(plan.machines).toBe(0);
    expect(plan.cashTransferred).toBe(3500); // 35%
    expect(plan.summary).toContain("creditors");
  });

  test("crew scale with the company's actual size, not a fixed 1-3", () => {
    // The old handler gave 1-3 generic workers whether the firm employed 2 or 20.
    expect(planAcquisition(rival({ employees: 2 }), game()).crew).toHaveLength(2);
    expect(planAcquisition(rival({ employees: 9 }), game()).crew).toHaveLength(9);
  });

  test("crew trades match what the company actually built", () => {
    const residential = planAcquisition(rival({ focus: "residential", employees: 3 }), game());
    expect(residential.crew.map((c) => c.role)).toEqual(["Carpenter", "Labourer", "Plumber"]);
    const commercial = planAcquisition(rival({ focus: "commercial", employees: 3 }), game());
    expect(commercial.crew.map((c) => c.role)).toEqual(["Concreter", "Steelworker", "Electrician"]);
  });

  test("an inherited crew is experienced but did not choose you", () => {
    for (const c of planAcquisition(rival({ employees: 8 }), game()).crew) {
      expect(c.skill).toBeGreaterThanOrEqual(88);
      expect(c.loyalty).toBeLessThan(50);
      expect(c.mood).toBeLessThan(60);
    }
  });

  test("a huge company is capped, with the remainder sold off in the deal", () => {
    // Rather than dumping 40 individual records on the player and ballooning the save.
    const plan = planAcquisition(rival({ employees: 40, equipment: 20 }), game());
    expect(plan.crew).toHaveLength(MAX_TRANSFERRED_CREW);
    expect(plan.crewSoldOff).toBe(40 - MAX_TRANSFERRED_CREW);
    expect(plan.machines).toBe(MAX_TRANSFERRED_MACHINES);
    expect(plan.machinesSoldOff).toBe(20 - MAX_TRANSFERRED_MACHINES);
  });

  test("live and bankrupt are genuinely different deals, not just different prices", () => {
    const liveDeal = planAcquisition(rival({ cash: 80000 }), game());
    const deadDeal = planAcquisition(rival({ cash: 80000, status: RIVAL_STATUS.BANKRUPT }), game());
    expect(liveDeal.crew.length).toBeGreaterThan(deadDeal.crew.length);
    expect(liveDeal.machines).toBeGreaterThan(deadDeal.machines);
    expect(liveDeal.cashTransferred).toBeGreaterThan(deadDeal.cashTransferred);
    expect(liveDeal.repGain).toBeGreaterThan(deadDeal.repGain);
  });

  test("the price never drops below the floor", () => {
    expect(acquisitionCost(rival({ rep: 0, cash: 0 }))).toBe(50000);
    expect(acquisitionCost(rival({ rep: 50, cash: 100000 }))).toBe(200000);
  });

  test("a plan never produces NaN or a negative transfer", () => {
    for (const bad of [{}, { cash: NaN }, { employees: -5, equipment: -2 }, { cash: -90000 }]) {
      const plan = planAcquisition(bad, game());
      expect(Number.isFinite(plan.cost)).toBe(true);
      expect(plan.cashTransferred).toBeGreaterThanOrEqual(0);
      expect(plan.machines).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(plan.crew)).toBe(true);
    }
  });
});

describe("why an acquisition is blocked says the actual blocker", () => {
  test("a valid deal has no blocker", () => {
    expect(acquisitionBlockReason(rival(), game({ reputation: 80, cash: 900000, lastAcquisitionDay: 0, day: 100 }))).toBeNull();
  });

  test("each blocker names itself and the number that matters", () => {
    expect(acquisitionBlockReason(rival(), game({ reputation: 10 }))).toContain("Reputation");
    expect(acquisitionBlockReason(rival(), game({ reputation: 10 }))).toContain("10");

    const cooling = game({ reputation: 80, day: 100, lastAcquisitionDay: 95 });
    expect(acquisitionBlockReason(rival(), cooling)).toMatch(/day/);

    const broke = game({ reputation: 80, cash: 1000, lastAcquisitionDay: 0 });
    expect(acquisitionBlockReason(rival(), broke)).toContain("more to close");
  });

  test("you cannot buy a company you already own", () => {
    const g = game({ reputation: 80, cash: 900000, acquiredRivals: ["apex"] });
    expect(acquisitionBlockReason(rival({ id: "apex" }), g)).toContain("already own");
  });

  test("a missing company is reported, not crashed on", () => {
    expect(acquisitionBlockReason(undefined, game())).toContain("no longer on the market");
    expect(acquisitionBlockReason({}, game())).toContain("no longer on the market");
  });

  test("the cooldown boundary is inclusive, so the wait is honest", () => {
    const rep = { reputation: 80, cash: 900000 };
    const justShort = game({ ...rep, day: 100, lastAcquisitionDay: 100 - ACQUISITION_COOLDOWN_DAYS + 1 });
    expect(acquisitionBlockReason(rival(), justShort)).toMatch(/day/);
    const exactly = game({ ...rep, day: 100, lastAcquisitionDay: 100 - ACQUISITION_COOLDOWN_DAYS });
    expect(acquisitionBlockReason(rival(), exactly)).toBeNull();
  });

  test("the reputation gate matches the documented constant", () => {
    const atGate = game({ reputation: ACQUISITION_MIN_REPUTATION, cash: 900000, lastAcquisitionDay: 0 });
    expect(acquisitionBlockReason(rival(), atGate)).toBeNull();
    const below = game({ reputation: ACQUISITION_MIN_REPUTATION - 1, cash: 900000, lastAcquisitionDay: 0 });
    expect(acquisitionBlockReason(rival(), below)).toContain("Reputation");
  });
});
