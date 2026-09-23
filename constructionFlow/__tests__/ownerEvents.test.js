// Owner event selection.
//
// Sprint 10. The catalog was never the problem — 17 decision events, several of them genuinely
// construction-native. The draw was:
//
//     const evt = pick(DECISION_EVENTS);
//
// Uniform, over everything, every time. These tests pin the three things that replaced it.

import {
  EVENT_CATEGORIES,
  RARITY_WEIGHT,
  DEFAULT_COOLDOWN_DAYS,
  EVENT_HISTORY_CAP,
  lastFiredDay,
  cooldownFor,
  cooldownRemaining,
  isEligible,
  eligibleEvents,
  weightOf,
  selectOwnerEvent,
  recordEventFired,
  describeEventPool,
} from "../src/systems/ownerEvents.js";

const ev = (id, over = {}) => ({ id, title: id, rarity: "common", ...over });
const g = (over = {}) => ({ day: 100, eventHistory: {}, ...over });

// A deterministic stand-in for Math.random that walks a fixed sequence.
const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };

describe("cooldowns", () => {
  test("an event that has never fired is off cooldown", () => {
    expect(cooldownRemaining(g(), ev("a"))).toBe(0);
    expect(lastFiredDay(g(), "a")).toBeNull();
  });

  test("an event with no declared cooldown still gets one", () => {
    // Zero would mean "may repeat tomorrow", which is the behaviour this module removes.
    expect(cooldownFor(ev("a"))).toBe(DEFAULT_COOLDOWN_DAYS);
  });

  test("a declared cooldown is respected", () => {
    expect(cooldownFor(ev("a", { cooldownDays: 60 }))).toBe(60);
  });

  test("an event just fired is on cooldown and cannot be drawn again", () => {
    const state = g({ day: 100 });
    recordEventFired(state, "a");
    expect(cooldownRemaining(state, ev("a", { cooldownDays: 30 }))).toBe(30);
    expect(isEligible(state, ev("a", { cooldownDays: 30 }))).toBe(false);
  });

  test("the cooldown counts down with the days and then clears", () => {
    const state = g({ day: 100 });
    recordEventFired(state, "a");
    state.day = 120;
    expect(cooldownRemaining(state, ev("a", { cooldownDays: 30 }))).toBe(10);
    state.day = 130;
    expect(cooldownRemaining(state, ev("a", { cooldownDays: 30 }))).toBe(0);
    expect(isEligible(state, ev("a", { cooldownDays: 30 }))).toBe(true);
  });

  test("a nonsensical negative cooldown falls back to the default", () => {
    expect(cooldownFor(ev("a", { cooldownDays: -5 }))).toBe(DEFAULT_COOLDOWN_DAYS);
  });
});

describe("eligibility", () => {
  test("an event with no predicate is eligible", () => {
    expect(isEligible(g(), ev("a"))).toBe(true);
  });

  test("a predicate that returns false blocks it", () => {
    expect(isEligible(g({ cash: 10 }), ev("a", { eligible: (s) => s.cash > 1000 }))).toBe(false);
  });

  test("a predicate that returns true allows it", () => {
    expect(isEligible(g({ cash: 5000 }), ev("a", { eligible: (s) => s.cash > 1000 }))).toBe(true);
  });

  test("a predicate that throws costs one scenario, not the run", () => {
    const bad = ev("a", { eligible: () => { throw new Error("boom"); } });
    expect(() => isEligible(g(), bad)).not.toThrow();
    expect(isEligible(g(), bad)).toBe(false);
  });

  test("an event with no id is never eligible", () => {
    expect(isEligible(g(), { title: "nameless" })).toBe(false);
  });

  test("eligibleEvents filters a whole catalog", () => {
    const cat = [
      ev("rich", { eligible: (s) => s.cash > 1000 }),
      ev("poor", { eligible: (s) => s.cash <= 1000 }),
      ev("always"),
    ];
    expect(eligibleEvents(g({ cash: 50 }), cat).map((e) => e.id)).toEqual(["poor", "always"]);
  });

  test("a non-array catalog yields nothing rather than throwing", () => {
    expect(eligibleEvents(g(), null)).toEqual([]);
    expect(eligibleEvents(g(), undefined)).toEqual([]);
  });
});

describe("weighted selection", () => {
  test("rare draws less often than common", () => {
    expect(weightOf(ev("a", { rarity: "rare" }))).toBeLessThan(weightOf(ev("b", { rarity: "common" })));
    expect(weightOf(ev("a", { rarity: "uncommon" }))).toBeLessThan(weightOf(ev("b", { rarity: "common" })));
  });

  test("an unknown rarity is treated as common rather than as zero", () => {
    // Zero weight would make the event undrawable, which is a silent content bug.
    expect(weightOf(ev("a", { rarity: "legendary" }))).toBe(RARITY_WEIGHT.common);
    expect(weightOf(ev("a", {}))).toBe(RARITY_WEIGHT.common);
  });

  test("an empty pool selects nothing rather than crashing", () => {
    expect(selectOwnerEvent(g(), [])).toBeNull();
    expect(selectOwnerEvent(g(), [ev("a", { eligible: () => false })])).toBeNull();
  });

  test("a single eligible event is always the answer", () => {
    const cat = [ev("a"), ev("b", { eligible: () => false })];
    for (const r of [0, 0.5, 0.999]) expect(selectOwnerEvent(g(), cat, () => r).id).toBe("a");
  });

  test("the draw lands inside the pool, never outside it", () => {
    const cat = [ev("a"), ev("b"), ev("c", { eligible: () => false })];
    for (let i = 0; i < 200; i++) {
      expect(["a", "b"]).toContain(selectOwnerEvent(g(), cat, Math.random).id);
    }
  });

  test("the distribution actually follows the weights", () => {
    // The claim the rarity tiers are making. Asserted, not hoped for.
    const cat = [ev("common1", { rarity: "common" }), ev("rare1", { rarity: "rare" })];
    const counts = { common1: 0, rare1: 0 };
    for (let i = 0; i < 20000; i++) counts[selectOwnerEvent(g(), cat, Math.random).id] += 1;
    const expectedRareShare = RARITY_WEIGHT.rare / (RARITY_WEIGHT.rare + RARITY_WEIGHT.common);
    const actualRareShare = counts.rare1 / 20000;
    expect(Math.abs(actualRareShare - expectedRareShare)).toBeLessThan(0.03);
  });

  test("a roll at the very top of the range still returns an event", () => {
    // Floating-point tail: the last eligible event is the right answer, not null.
    const cat = [ev("a"), ev("b")];
    expect(selectOwnerEvent(g(), cat, () => 0.9999999999)).not.toBeNull();
  });

  test("selection never mutates the catalog or the game", () => {
    const cat = [ev("a"), ev("b")];
    const frozen = JSON.parse(JSON.stringify(g()));
    const state = g();
    selectOwnerEvent(state, cat, seq([0.1]));
    expect(state).toEqual(frozen);
    expect(cat.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("the history stays bounded", () => {
  test("firing an event records the day", () => {
    const state = g({ day: 77 });
    recordEventFired(state, "a");
    expect(state.eventHistory.a).toBe(77);
  });

  test("firing again overwrites rather than accumulating", () => {
    const state = g({ day: 10 });
    recordEventFired(state, "a");
    state.day = 90;
    recordEventFired(state, "a");
    expect(Object.keys(state.eventHistory)).toEqual(["a"]);
    expect(state.eventHistory.a).toBe(90);
  });

  test("the record is capped, and the oldest go first", () => {
    const state = g({ day: 0 });
    for (let i = 0; i < EVENT_HISTORY_CAP + 25; i++) {
      state.day = i;
      recordEventFired(state, `e${i}`);
    }
    expect(Object.keys(state.eventHistory).length).toBeLessThanOrEqual(EVENT_HISTORY_CAP);
    // The very first ones are gone; the most recent survive.
    expect(state.eventHistory.e0).toBeUndefined();
    expect(state.eventHistory[`e${EVENT_HISTORY_CAP + 24}`]).toBeDefined();
  });

  test("a corrupted history is treated as empty rather than crashing", () => {
    expect(lastFiredDay({ eventHistory: "nope", day: 5 }, "a")).toBeNull();
    expect(lastFiredDay({ eventHistory: ["a"], day: 5 }, "a")).toBeNull();
    const state = { day: 5, eventHistory: "nope" };
    recordEventFired(state, "a");
    expect(state.eventHistory).toEqual({ a: 5 });
  });

  test("recording is a no-op without a game or an id", () => {
    expect(() => recordEventFired(null, "a")).not.toThrow();
    expect(() => recordEventFired(g(), null)).not.toThrow();
  });
});

describe("the pool can be inspected", () => {
  test("a catalog where nothing is eligible is visible rather than silent", () => {
    const cat = [ev("a", { eligible: () => false }), ev("b", { eligible: () => false })];
    expect(describeEventPool(g(), cat)).toEqual({ total: 2, eligible: 0, onCooldown: 0, byRarity: {} });
  });

  test("cooldowned events are counted separately from ineligible ones", () => {
    const state = g({ day: 100 });
    recordEventFired(state, "a");
    const cat = [ev("a", { cooldownDays: 30 }), ev("b")];
    const d = describeEventPool(state, cat);
    expect({ eligible: d.eligible, onCooldown: d.onCooldown }).toEqual({ eligible: 1, onCooldown: 1 });
  });
});

describe("the vocabulary is shared", () => {
  test("categories are defined and distinct", () => {
    const values = Object.values(EVENT_CATEGORIES);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain("regulator");
  });
});
