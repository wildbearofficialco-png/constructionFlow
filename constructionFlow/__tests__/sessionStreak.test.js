// Sprint 1 P0 — the login streak pays for real returns, never for simulated days.
//
// It lived in gameTick's new-day block and compared GAME days, so a game left running paid a
// "login" bonus every 96 real seconds: ~$19,600 in a new company's first 45 game days.

import { freshState, gameTick, migrateState, applyOfflineProgress } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { registerSession, calendarDayKey, streakBonusFor } from "../src/systems/sessionStreak.js";
import { withSeed, TPD } from "../scripts/playtest/firstHourHarness.js";

import { mulberry32 as __mulberry32 } from "../scripts/playtest/firstHourHarness.js";

// Deterministic: every test in this file runs on a seeded RNG, so a pass or a failure reproduces.
let __realRandom;
beforeEach(() => { __realRandom = Math.random; Math.random = __mulberry32(20260924); });
afterEach(() => { Math.random = __realRandom; });

const DAY = 86400000;
const noon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0).getTime();
const streakEntries = (g) => (g.ledger || []).filter((e) => /streak/i.test(e.description));

describe("simulated days never pay a streak bonus", () => {
  test("45 game days of an idle company left running: zero streak money", () => {
    withSeed(9, () => {
      let g = { ...freshState(), setupDone: true, tutorialDone: true };
      for (let i = 0; i < TPD * 45; i++) { g = gameTick(g); g.pendingDecision = null; }
      expect(streakEntries(g)).toEqual([]);
      expect((g.logs || []).some((l) => /streak! Bonus/.test(l))).toBe(false);
    });
  });

  test("a long offline catch-up pays nothing either", () => {
    withSeed(9, () => {
      const g = { ...freshState(), setupDone: true, tutorialDone: true };
      const after = applyOfflineProgress(g, TPD * 10);
      expect(streakEntries(after)).toEqual([]);
    });
  });
});

describe("real sessions", () => {
  test("the first session starts a streak of 1 with no bonus", () => {
    const g = freshState();
    const r = registerSession(g, noon(2026, 9, 1));
    expect(r).toMatchObject({ streak: 1, bonus: 0, counted: true });
    expect(g.lastSessionDate).toBe("2026-09-01");
  });

  test("a second session the same day counts nothing", () => {
    const g = freshState();
    registerSession(g, noon(2026, 9, 1));
    expect(registerSession(g, noon(2026, 9, 1) + 3600000)).toMatchObject({ counted: false, bonus: 0 });
  });

  test("consecutive real days build the streak and pay from day 3, capped", () => {
    const g = freshState();
    const cash0 = g.cash;
    const bonuses = [];
    for (let d = 0; d < 12; d++) bonuses.push(registerSession(g, noon(2026, 9, 1) + d * DAY).bonus);
    expect(bonuses).toEqual([0, 0, 150, 200, 250, 300, 350, 400, 450, 500, 500, 500]);
    expect(g.cash - cash0).toBe(bonuses.reduce((a, b) => a + b, 0));
    expect(streakEntries(g)).toHaveLength(10);
  });

  test("a missed day, or a clock moved backwards, restarts the streak", () => {
    const g = freshState();
    for (let d = 0; d < 4; d++) registerSession(g, noon(2026, 9, 1) + d * DAY);
    expect(registerSession(g, noon(2026, 9, 7)).streak).toBe(1);
    expect(registerSession(g, noon(2026, 9, 5)).streak).toBe(1);
  });

  test("the bonus schedule is unchanged from the old one", () => {
    expect([1, 2, 3, 10, 30].map(streakBonusFor)).toEqual([0, 0, 150, 500, 500]);
    expect(calendarDayKey(noon(2026, 1, 9))).toBe("2026-01-09");
  });
});

describe("old saves", () => {
  test("a game-day streak from before real-session tracking is not carried over", () => {
    const old = { ...freshState(), consecutiveLoginDays: 43, lastLoginDay: 44, day: 44 };
    delete old.lastSessionDate;
    const g = migrateState(JSON.parse(JSON.stringify(old)));
    expect(g.lastSessionDate).toBeNull();
    expect(g.consecutiveLoginDays).toBe(0);
    expect(registerSession(g, noon(2026, 9, 1))).toMatchObject({ streak: 1, bonus: 0 });
  });

  test("a save that already tracks real sessions keeps its streak", () => {
    const g0 = freshState();
    registerSession(g0, noon(2026, 9, 1));
    registerSession(g0, noon(2026, 9, 2));
    const g = migrateState(JSON.parse(JSON.stringify(g0)));
    expect(registerSession(g, noon(2026, 9, 3))).toMatchObject({ streak: 3, bonus: 150 });
  });
});
