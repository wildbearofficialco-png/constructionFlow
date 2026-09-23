// Owner events wired into the real catalog and the real tick.
//
// The unit tests prove the selector. These prove it is connected to the 21 actual scenarios,
// and — the failure mode that matters most for a content system — that none of them has been
// gated into a state it can never reach. An event nobody can ever see is indistinguishable
// from an event that was never written, and it fails silently forever.

import fs from "fs";
import path from "path";

import {
  freshState,
  migrateState,
  gameTick,
  DECISION_EVENTS,
  getTotalCrewCap,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  isEligible,
  eligibleEvents,
  cooldownFor,
  weightOf,
  selectOwnerEvent,
  describeEventPool,
  DEFAULT_COOLDOWN_DAYS,
} from "../src/systems/ownerEvents.js";

import { ticksPerDay } from "../src/systems/gameClock.js";
// Was a hard-coded 48, which meant "ticks per game day" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so the literal silently became "a third of a day".
const TICKS_PER_DAY = ticksPerDay("1x");

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 120000;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

// A deliberately generous company: late game, rich, staffed, with sites and history. If an
// event cannot fire HERE, the question is whether it can fire anywhere.
function established() {
  const g = running({
    day: 400,
    cash: 900000,
    reputation: 85,
    companyLevel: 8,
    completedJobs: 40,
    creditScore: 760,
    officeStaff: [{ id: "s1", role: "Site Foreman" }, { id: "s2", role: "Estimator" }],
    eventHistory: {},
  });
  g.activeSites = [{
    id: "s-1", contractId: "c-1", label: "Harbour Works", client: "Harbor Trust",
    status: "Active", phases: ["Finish"], currentPhaseIdx: 0, phaseProgress: 10,
    assignedCrewIds: [], assignedEquipmentIds: [], materialsFulfilled: {}, pendingDeliveries: [],
    progressPaid: 0, phasesClaimed: 0, totalValue: 400000, depositPaid: 50000, penaltyPerDay: 200,
    deadlineDay: g.day + 90, startDay: g.day - 10, siteMode: "normal", chaosHistory: [],
  }];
  // Enough plant for a policy to be worth arguing about.
  while (g.equipment.length < 4) g.equipment.push({ ...g.equipment[0], id: `eq${g.equipment.length}` });
  // A workforce, with someone free to answer an emergency.
  while (g.crew.length < 6) g.crew.push({ ...g.crew[0], id: `w${g.crew.length}`, status: "Idle" });
  g.crew[0].status = "Idle";
  // A history worth being confronted about, in every flavour the chain events read.
  g.companyMemory = [
    { tag: "supplier_stiffed_1", kind: "supplier", valence: "bad", weight: 2, day: 100, label: "Took materials without paying", detail: "you took a bulk order on account and never settled it" },
    { tag: "crew_stood_1", kind: "crew", valence: "good", weight: 2, day: 100, label: "Stood by the crew", detail: "you paid people when it would have been cheaper not to" },
    { tag: "rival_1", kind: "rivalry", valence: "bad", weight: 2, day: 100, label: "Made an enemy", detail: "you undercut a rival badly" },
    { tag: "client_1", kind: "client", valence: "good", weight: 2, day: 100, label: "Delivered early", detail: "you delivered a difficult job early" },
  ];
  return g;
}

// A company with nothing: no sites, no money, no history. Several events exist for exactly
// this state and must remain reachable from it.
function struggling() {
  return running({ day: 30, cash: 400, reputation: 4, companyLevel: 1, completedJobs: 0, activeSites: [], companyMemory: [], eventHistory: {} });
}

// The middle of the game: some plant, some people, work on the books, no deep history yet.
function growing() {
  const g = established();
  g.cash = 60000;
  g.companyLevel = 3;
  g.reputation = 45;
  g.completedJobs = 4;
  g.companyMemory = [];
  while (g.equipment.length < 3) g.equipment.push({ ...g.equipment[0], id: `eq${g.equipment.length}` });
  g.crew = g.crew.slice(0, 3);
  return g;
}

describe("the catalog carries the metadata the selector needs", () => {
  test("every event has a unique id", () => {
    const ids = DECISION_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every event declares a rarity that the weighting recognises", () => {
    const unrecognised = DECISION_EVENTS
      .filter((e) => !["common", "uncommon", "rare"].includes(e.rarity))
      .map((e) => e.id);
    expect(unrecognised).toEqual([]);
  });

  test("every event declares its own cooldown rather than inheriting the default", () => {
    const inheriting = DECISION_EVENTS.filter((e) => cooldownFor(e) === DEFAULT_COOLDOWN_DAYS && !Number.isFinite(e.cooldownDays));
    expect(inheriting.map((e) => e.id)).toEqual([]);
  });

  test("every event declares an eligibility predicate", () => {
    // The whole point of the sprint. A missing predicate means that scenario is still being
    // offered to companies it makes no sense for.
    const ungated = DECISION_EVENTS.filter((e) => typeof e.eligible !== "function").map((e) => e.id);
    expect(ungated).toEqual([]);
  });

  test("every event has options the player can actually choose", () => {
    const broken = DECISION_EVENTS
      .filter((e) => !Array.isArray(e.options) || e.options.length < 2 || e.options.some((o) => typeof o.apply !== "function"))
      .map((e) => e.id);
    expect(broken).toEqual([]);
  });

  test("no rarity weight is zero, which would make an event undrawable", () => {
    expect(DECISION_EVENTS.filter((e) => weightOf(e) <= 0).map((e) => e.id)).toEqual([]);
  });
});

describe("no event is gated into a state it can never reach", () => {
  test("every event is reachable by some company that could actually exist", () => {
    // The silent-content-bug guard: an event gated behind an impossible predicate — a typo, a
    // field that does not exist, an `&&` that should have been `||` — is indistinguishable
    // from one that was never written, and it fails silently forever.
    //
    // Asserted as reachability across representative states rather than "all eligible at
    // once", because all-at-once is impossible BY DESIGN: investor_offer is deliberately gated
    // to exclude rich companies, so any state that satisfies the late-game events cannot
    // satisfy that one. An earlier version of this test demanded exactly that and was wrong.
    const states = { struggling: struggling(), growing: growing(), established: established() };
    const unreachable = DECISION_EVENTS
      .filter((e) => !Object.values(states).some((st) => isEligible(st, e)))
      .map((e) => e.id);
    expect(unreachable).toEqual([]);
  });

  test("the gates are real — no single company sees the whole catalog", () => {
    // The inverse. If this ever passes trivially, the predicates have stopped doing anything.
    for (const [name, st] of Object.entries({ struggling: struggling(), growing: growing(), established: established() })) {
      const n = eligibleEvents(st, DECISION_EVENTS).length;
      expect({ name, sees_everything: n === DECISION_EVENTS.length }).toEqual({ name, sees_everything: false });
    }
  });

  test("no eligibility predicate throws on a fresh company", () => {
    // isEligible swallows throws by design, so a broken predicate would otherwise look exactly
    // like an ineligible one. This calls them directly.
    const threw = [];
    for (const e of DECISION_EVENTS) {
      try { e.eligible(freshState()); } catch (err) { threw.push(`${e.id}: ${err.message}`); }
    }
    expect(threw).toEqual([]);
  });

  test("nor on a deliberately hostile state", () => {
    const hostile = { day: 1, cash: -5000, crew: [], equipment: [], activeSites: [], officeStaff: [], loans: [], companyMemory: [], contracts: [], officeIndex: 0, reputation: 0, completedJobs: 0, companyLevel: 1 };
    const threw = [];
    for (const e of DECISION_EVENTS) {
      try { e.eligible(hostile); } catch (err) { threw.push(`${e.id}: ${err.message}`); }
    }
    expect(threw).toEqual([]);
  });
});

describe("eligibility means something", () => {
  test("a broke company is not offered a rival acquisition", () => {
    const broke = running({ cash: 500, companyLevel: 1 });
    const offered = eligibleEvents(broke, DECISION_EVENTS).map((e) => e.id);
    expect(offered).not.toContain("competitor_acquisition");
  });

  test("a company sitting on millions is not offered a payday loan dressed as an angel", () => {
    // $120,000 against a $180,000 repayment is a lifeline at $400 and an insult at $5M.
    const rich = running({ cash: 5000000 });
    expect(eligibleEvents(rich, DECISION_EVENTS).map((e) => e.id)).not.toContain("investor_offer");
  });

  test("a company with no open sites is not asked to cut corners on one", () => {
    const idle = running({ activeSites: [] });
    const offered = eligibleEvents(idle, DECISION_EVENTS).map((e) => e.id);
    for (const id of ["corner_cut", "inspector_violation", "subcontractor_dispute"]) {
      expect({ id, offered: offered.includes(id) }).toEqual({ id, offered: false });
    }
  });

  test("a crew at capacity is not offered another body", () => {
    const g = running();
    while (g.crew.length < getTotalCrewCap(g)) g.crew.push({ ...g.crew[0], id: `x${g.crew.length}` });
    expect(eligibleEvents(g, DECISION_EVENTS).map((e) => e.id)).not.toContain("rival_poach");
  });

  test("a no-name outfit gets no government insider tip", () => {
    const nobody = running({ reputation: 5, completedJobs: 0 });
    expect(eligibleEvents(nobody, DECISION_EVENTS).map((e) => e.id)).not.toContain("govt_contract_tip");
  });
});

describe("the chronicle finally knocks on the door", () => {
  test("chain events exist and are part of the same pool", () => {
    const chains = DECISION_EVENTS.filter((e) => e.id.startsWith("chain_"));
    expect(chains.length).toBeGreaterThanOrEqual(4);
  });

  test("a company with no history is never confronted about one", () => {
    // The difference between a consequence and a coincidence.
    const blank = running({ companyMemory: [] });
    const offered = eligibleEvents(blank, DECISION_EVENTS).map((e) => e.id);
    expect(offered.filter((id) => id.startsWith("chain_"))).toEqual([]);
  });

  test("stiffing a supplier eventually brings them to the gate", () => {
    const g = running({
      day: 200,
      companyMemory: [{ tag: "supplier_stiffed_1", kind: "supplier", valence: "bad", weight: 2, day: 100, label: "x", detail: "y" }],
    });
    expect(eligibleEvents(g, DECISION_EVENTS).map((e) => e.id)).toContain("chain_supplier_reckoning");
  });

  test("a fresh grudge does not knock immediately — it has to become history", () => {
    const g = running({
      day: 102,
      companyMemory: [{ tag: "supplier_stiffed_1", kind: "supplier", valence: "bad", weight: 2, day: 100, label: "x", detail: "y" }],
    });
    expect(eligibleEvents(g, DECISION_EVENTS).map((e) => e.id)).not.toContain("chain_supplier_reckoning");
  });

  test("standing by your crew is worth something you can see", () => {
    const g = running({
      day: 200,
      companyMemory: [{ tag: "crew_good_1", kind: "crew", valence: "good", weight: 2, day: 100, label: "x", detail: "y" }],
    });
    expect(eligibleEvents(g, DECISION_EVENTS).map((e) => e.id)).toContain("chain_loyal_crew_opportunity");
  });
});

describe("wired into the tick", () => {
  test("the uniform draw is gone", () => {
    expect(SCREEN_CODE).not.toContain("pick(DECISION_EVENTS)");
    expect(SCREEN_CODE).toContain("selectOwnerEvent(g, DECISION_EVENTS)");
    expect(SCREEN_CODE).toContain("recordEventFired(g, evt.id)");
  });

  test("a long run fires events and never repeats one inside its cooldown", () => {
    let g = running(established());
    const fired = [];
    for (let i = 0; i < TICKS_PER_DAY * 300; i++) {
      const before = g.pendingDecision?.id || null;
      g = gameTick(g);
      const after = g.pendingDecision?.id || null;
      if (after && after !== before) fired.push({ id: after, day: g.day });
      // Answer it immediately so the next one can arrive.
      if (g.pendingDecision) g = { ...g, pendingDecision: null };
    }

    expect(fired.length).toBeGreaterThan(0);

    const def = Object.fromEntries(DECISION_EVENTS.map((e) => [e.id, e]));
    const violations = [];
    const lastSeen = {};
    for (const f of fired) {
      const cd = cooldownFor(def[f.id] || {});
      if (lastSeen[f.id] !== undefined && f.day - lastSeen[f.id] < cd) {
        violations.push(`${f.id}: ${f.day - lastSeen[f.id]}d apart, cooldown ${cd}d`);
      }
      lastSeen[f.id] = f.day;
    }
    expect(violations).toEqual([]);
  });

  test("a tick with nothing eligible simply raises no event rather than crashing", () => {
    // selectOwnerEvent returns null, and the caller must cope with that.
    const g = running({ crew: [], equipment: [], activeSites: [], cash: 0, companyMemory: [] });
    expect(() => { let s = g; for (let i = 0; i < TICKS_PER_DAY * 40; i++) s = gameTick(s); }).not.toThrow();
  });
});

describe("save compatibility", () => {
  test("a fresh company starts with an empty event history", () => {
    expect(freshState().eventHistory).toEqual({});
  });

  test("a build-7 save with no event history loads and starts one", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.eventHistory;
    expect(migrateState(legacy).eventHistory).toEqual({});
  });

  test("an existing event history survives migration", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.eventHistory = { supplier_deal: 42 };
    expect(migrateState(legacy).eventHistory).toEqual({ supplier_deal: 42 });
  });

  test("a corrupted event history is repaired rather than crashing the load", () => {
    for (const junk of ["nope", ["a"], 7]) {
      const legacy = JSON.parse(JSON.stringify(freshState()));
      legacy.eventHistory = junk;
      expect(migrateState(legacy).eventHistory).toEqual({});
    }
  });

  test("a returning player's pool is healthy rather than empty", () => {
    // Healthy, not complete. A company good enough to see the late-game events is by
    // definition too rich for the ones written for a company in trouble.
    const d = describeEventPool(established(), DECISION_EVENTS);
    expect(d.total).toBeGreaterThanOrEqual(21);
    expect(d.eligible).toBeGreaterThanOrEqual(14);
    expect(d.eligible).toBeLessThan(d.total);
    // And it spans more than one rarity tier, so the draw has something to weight.
    expect(Object.keys(d.byRarity).length).toBeGreaterThanOrEqual(2);
  });
});
