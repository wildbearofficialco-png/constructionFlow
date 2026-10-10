// Rivals courting crew: a warning and a choice, not an ambush (review sprint, P3).
//
// Build-14 playtest: a rival "poached" a worker on day 2 of a brand-new company, and two of three
// starting crew were gone by day 17, each removed instantly with one log line.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConstructionFlowScreen, {
  freshState, enhancedRivalDailyLogic, resolvePoachOffers,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import {
  poachingAllowed, poachWeight, declineChance, makePoachOffer, approachCrew, matchOffer,
  expiredOffers, POACH_RESPONSE_DAYS, POACH_GRACE_DAYS_AFTER_FIRST_JOB,
} from "../src/systems/crewPoaching.js";
import { marketRateFor } from "../src/systems/crewPayroll.js";

jest.useFakeTimers();
jest.setTimeout(30000);

const worker = (over = {}) => ({ id: "w1", name: "Reed Hall", role: "Carpenter", skill: 90, certifications: [], status: "Idle", loyalty: 50, mood: 70, ...over, wagePerDay: over.wagePerDay ?? marketRateFor({ role: "Carpenter", skill: 90 }) });

describe("the rules", () => {
  test("no approaches until five days after the first job", () => {
    expect(poachingAllowed({ completedJobs: 0, day: 30 })).toBe(false);
    expect(poachingAllowed({ completedJobs: 1, firstJobCompletedDay: 8, day: 8 })).toBe(false);
    expect(poachingAllowed({ completedJobs: 1, firstJobCompletedDay: 8, day: 12 })).toBe(false);
    expect(poachingAllowed({ completedJobs: 1, firstJobCompletedDay: 8, day: 8 + POACH_GRACE_DAYS_AFTER_FIRST_JOB })).toBe(true);
  });

  test("a save from before the grace field, already past its first job, carries on", () => {
    expect(poachingAllowed({ completedJobs: 4, day: 60 })).toBe(true);
  });

  test("underpaid, disloyal people are approached far more than loyal, well-paid ones", () => {
    const unhappy = worker({ wagePerDay: 60, loyalty: 30, mood: 40 });
    const valued = worker({ wagePerDay: Math.round(marketRateFor(worker()) * 1.3), loyalty: 85 });
    expect(poachWeight(unhappy)).toBeGreaterThan(poachWeight(valued) * 10);
  });

  test("loyal, well-paid people often say no on their own", () => {
    expect(declineChance(worker({ loyalty: 90, wagePerDay: 400 }))).toBeGreaterThan(declineChance(worker({ loyalty: 20 })));
    expect(declineChance(worker({ loyalty: 100, wagePerDay: 1000 }))).toBeLessThanOrEqual(0.75);
  });

  test("an offer beats both their wage and the market, with a deadline", () => {
    const w = worker();
    const o = makePoachOffer(w, { id: "r", name: "IronPeak" }, 20);
    expect(o.offerWage).toBeGreaterThan(w.wagePerDay);
    expect(o.offerWage).toBeGreaterThanOrEqual(Math.round(marketRateFor(w) * 1.1));
    expect(o.expiresDay).toBe(20 + POACH_RESPONSE_DAYS);
  });

  test("matching keeps them, on the rival's number, more loyal", () => {
    const w = worker();
    approachCrew({ day: 5, crew: [w] }, { id: "r", name: "IronPeak" }, () => 0.99);
    const offer = w.poachOffer.offerWage;
    expect(matchOffer(w, 6)).toBe(true);
    expect(w.wagePerDay).toBe(offer);
    expect(w.loyalty).toBe(60);
    expect(w.poachOffer).toBeUndefined();
  });

  test("an unanswered offer expires on its day", () => {
    const g = { day: 5, crew: [worker()] };
    approachCrew(g, { id: "r", name: "IronPeak" }, () => 0.99);
    expect(expiredOffers({ ...g, day: 7 })).toHaveLength(0);
    expect(expiredOffers({ ...g, day: 5 + POACH_RESPONSE_DAYS })).toHaveLength(1);
  });
});

describe("in the game", () => {
  const realRandom = Math.random;
  afterEach(() => { Math.random = realRandom; });

  function bigRivals(g) {
    g.rivals = g.rivals.map((r) => ({ ...r, cash: 50_000_000, valuation: 50_000_000, rep: 60 }));
    g.companyValuation = 80_000;
    // Loyalty 0 and market pay: nobody turns an offer down on their own (generous pay would).
    g.crew.forEach((w) => { w.status = "Idle"; w.loyalty = 0; w.mood = 30; w.wagePerDay = marketRateFor(w); });
  }

  test("a brand-new company keeps its crew through its first days, however big the rivals", () => {
    const g = { ...freshState(), setupDone: true };
    bigRivals(g);
    Math.random = () => 0.025; // the same roll that produces an offer once the first job is done
    for (let d = 0; d < 20; d++) { g.day += 1; enhancedRivalDailyLogic(g); resolvePoachOffers(g); }
    expect(g.crew).toHaveLength(3);
    expect(g.crew.some((w) => w.poachOffer)).toBe(false);
  });

  test("after the first job, a rival makes an offer — nobody vanishes on the spot", () => {
    const { withSeed } = require("../scripts/playtest/firstHourHarness.js");
    const g = withSeed(42, () => ({ ...freshState(), setupDone: true, completedJobs: 1 }));
    bigRivals(g);
    Math.random = () => 0.025;
    let offered = null;
    for (let d = 0; d < 30 && !offered; d++) {
      g.day += 1;
      enhancedRivalDailyLogic(g);
      expect(g.crew).toHaveLength(3); // offers only — nobody removed without one
      offered = g.crew.find((w) => w.poachOffer) || null;
    }
    expect(offered).not.toBeNull();
    expect(JSON.stringify(g)).toMatch(/Match it in Crew by day/);
  });

  test("the five days after the first job stay quiet; offers can come after", () => {
    const { withSeed } = require("../scripts/playtest/firstHourHarness.js");
    const g = withSeed(42, () => ({ ...freshState(), setupDone: true, completedJobs: 1 }));
    bigRivals(g);
    g.firstJobCompletedDay = g.day;
    Math.random = () => 0.025;
    for (let d = 1; d < POACH_GRACE_DAYS_AFTER_FIRST_JOB; d++) {
      g.day += 1; enhancedRivalDailyLogic(g);
      expect(g.crew.some((w) => w.poachOffer)).toBe(false);
    }
    let offered = false;
    for (let d = 0; d < 30 && !offered; d++) { g.day += 1; enhancedRivalDailyLogic(g); offered = g.crew.some((w) => w.poachOffer); }
    expect(offered).toBe(true);
  });

  test("ignored, they leave when the window closes; matched, they stay", () => {
    const g = { ...freshState(), setupDone: true, completedJobs: 1 };
    g.crew.forEach((w) => { w.status = "Idle"; });
    const [a, b] = g.crew;
    approachCrew({ day: g.day, crew: [a] }, { id: "r1", name: "IronPeak" }, () => 0.99);
    approachCrew({ day: g.day, crew: [b] }, { id: "r2", name: "Apex" }, () => 0.99);
    matchOffer(b, g.day);
    g.day += POACH_RESPONSE_DAYS;
    resolvePoachOffers(g);
    expect(g.crew.find((w) => w.id === a.id)).toBeUndefined();
    expect(g.crew.find((w) => w.id === b.id)).toBeDefined();
  });

  test("a worker on a site who leaves is taken off the site too", () => {
    const g = { ...freshState(), setupDone: true, completedJobs: 1 };
    const w = g.crew[0];
    g.activeSites = [{ id: "s1", assignedCrewIds: [w.id, g.crew[1].id] }];
    w.poachOffer = { rivalName: "IronPeak", offerWage: 300, madeDay: 1, expiresDay: g.day };
    resolvePoachOffers(g);
    expect(g.activeSites[0].assignedCrewIds).toEqual([g.crew[0].id]);
  });
});

describe("the Crew card", () => {
  function text(tree) {
    const out = [];
    const walk = (n) => { if (n == null) return; if (typeof n === "string") return out.push(n); if (Array.isArray(n)) return n.forEach(walk); if (n.children) n.children.forEach(walk); };
    walk(tree.toJSON());
    return out.join("");
  }

  test("shows the offer with Match and Let go, and Match keeps the worker", async () => {
    const g = freshState();
    g.setupDone = true; g.tutorialDone = true; g.lastRealTimestamp = Date.now(); g.activeTab = "Crew"; g.completedJobs = 1;
    const w = g.crew[0];
    w.poachOffer = { rivalId: "r", rivalName: "IronPeak Development", offerWage: 333, madeDay: g.day, expiresDay: g.day + 3 };
    await AsyncStorage.setItem("constructionflow_v1_save", JSON.stringify(g));
    let tree;
    await act(async () => { tree = TestRenderer.create(<ConstructionFlowScreen />); });
    await act(async () => { jest.advanceTimersByTime(10); });
    try {
      const crewTab = tree.root.findAll((n) => n.props?.children === "Crew").map((n) => { let x = n; while (x && typeof x.props?.onPress !== "function") x = x.parent; return x; }).filter(Boolean).pop();
      await act(async () => { crewTab.props.onPress(); });
      expect(text(tree)).toMatch(/IronPeak Development offered \$333\/day/);
      const match = tree.root.findAll((n) => n.props?.accessibilityLabel === `Match $333 per day to keep ${w.name}`)[0];
      expect(match).toBeDefined();
      await act(async () => { match.props.onPress(); });
      expect(text(tree)).not.toMatch(/offered \$333\/day/);
    } finally {
      await act(async () => { tree.unmount(); });
    }
  });
});
