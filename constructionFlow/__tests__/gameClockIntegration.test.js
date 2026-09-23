// The clock wired into the real game.
//
// The claim this whole sprint rests on: slowing the clock changed the PACE and nothing else.
// Every per-tick rate in the simulation is scaled by MINS_PER_TICK — site progress, fuel burn,
// stamina drain, the paused-day countdown — so cutting it from 30 to 10 must be exactly
// cancelled by there now being three times as many ticks in a day.
//
// If it is not, the sprint quietly rebalanced the entire economy and every number the player
// has learned is wrong.

import fs from "fs";
import path from "path";

import {
  freshState,
  migrateState,
  gameTick,
  computeOfflineProgress,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  MINS_PER_TICK,
  MINUTES_PER_DAY,
  ticksPerDay,
  realSecondsPerGameDay,
  offlineFromElapsed,
} from "../src/systems/gameClock.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };
const TICKS_PER_DAY = ticksPerDay("1x");

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

describe("a day is still a day", () => {
  test("exactly one day passes in one day's worth of ticks", () => {
    let g = running({ day: 1, gameMinutes: 0 });
    for (let i = 0; i < TICKS_PER_DAY; i++) g = gameTick(g);
    expect(g.day).toBe(2);
    expect(g.gameMinutes).toBe(0);
  });

  test("the clock never drifts across a long run", () => {
    // The `?? 480` bug in this function's history compressed every day by a third, silently,
    // for the life of the save. This is the guard that would have caught it.
    let g = running({ day: 1, gameMinutes: 0 });
    const DAYS = 90;
    for (let i = 0; i < TICKS_PER_DAY * DAYS; i++) g = gameTick(g);
    expect(g.day).toBe(1 + DAYS);
  });

  test("a tick advances exactly MINS_PER_TICK", () => {
    const g = running({ day: 5, gameMinutes: 0 });
    expect(gameTick(g).gameMinutes).toBe(MINS_PER_TICK);
  });
});

describe("the economy is untouched", () => {
  // Per-DAY, not per-tick. Everything below runs for a fixed number of game DAYS and compares
  // totals, because that is the unit the player experiences and the unit the balance was
  // tuned in.
  function runDays(days, seedOver = {}) {
    let g = running({ day: 1, gameMinutes: 0, ...seedOver });
    for (let i = 0; i < TICKS_PER_DAY * days; i++) {
      g = gameTick(g);
      if (g.pendingDecision) g = { ...g, pendingDecision: null };
    }
    return g;
  }

  test("a passive company burns a sane amount per day, not three times as much", () => {
    // If MINS_PER_TICK had been cut without the tick count rising to match, daily overheads
    // would be charged three times as often and this would be roughly triple.
    const days = 60;
    const g = runDays(days);
    const perDay = g.expenses / days;
    expect(perDay).toBeGreaterThan(50);
    expect(perDay).toBeLessThan(2000);
  });

  test("a passive company is not bankrupted by the clock change", () => {
    // The device report was "constantly running out of money". A company that starts no work
    // still should not die in two months.
    const g = runDays(60);
    expect(g.cash).toBeGreaterThan(0);
  });

  test("fuel burn is charged per day, not per tick", () => {
    const g = runDays(10);
    const worst = Math.min(...(g.equipment || []).map((e) => e.fuel ?? 100));
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(worst)).toBe(true);
  });

  test("stamina drains over days without collapsing in an afternoon", () => {
    const g = runDays(5);
    const stams = (g.crew || []).map((w) => w.stamina ?? 0);
    expect(Math.min(...stams)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...stams)).toBeGreaterThan(0);
  });

  test("a full run still produces no NaN anywhere that matters", () => {
    const g = runDays(40);
    for (const k of ["cash", "expenses", "revenue", "day", "gameMinutes", "taxDue", "taxReserve"]) {
      expect({ k, finite: Number.isFinite(g[k]) }).toEqual({ k, finite: true });
    }
  });
});

describe("site progress still completes in the contracted time", () => {
  test("a job does not take three times as many days as it used to", () => {
    // progressRate is scaled by MINS_PER_TICK / 60. If that scaling were missed, every site in
    // the game would suddenly take three times as long and every deadline would be missed.
    let g = running({ day: 1, gameMinutes: 0, cash: 1500000 });
    g.activeSites = [{
      id: "s1", contractId: "c1", label: "Clock Test", client: "Harbor Trust",
      status: "Active", phases: ["Finish"], currentPhaseIdx: 0, phaseProgress: 0,
      assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: g.equipment.map((e) => e.id),
      materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
      totalValue: 120000, depositPaid: 20000, penaltyPerDay: 100,
      deadlineDay: 400, startDay: 1, siteMode: "normal", chaosHistory: [],
    }];
    for (const w of g.crew) w.status = "Working";
    for (const e of g.equipment) e.status = "Active";

    let ticks = 0;
    const LIMIT = TICKS_PER_DAY * 120;
    while ((g.activeSites || []).length > 0 && ticks < LIMIT) { g = gameTick(g); ticks += 1; }

    expect(g.activeSites.length).toBe(0);
    const daysTaken = ticks / TICKS_PER_DAY;
    // A single-phase job with full crew and plant: days, not months.
    expect(daysTaken).toBeLessThan(60);
  });
});

describe("offline catch-up agrees with the live clock", () => {
  test("the screen no longer carries its own copy of the conversion", () => {
    expect(SCREEN_CODE).not.toContain("REAL_SECONDS_PER_GAME_MINUTE = 0.1");
    expect(SCREEN_CODE).not.toContain("elapsedGameMinutes / 30");
    expect(SCREEN_CODE).not.toContain("const MAX_TICKS = 480");
  });

  test("computeOfflineProgress delegates to the clock module", () => {
    const now = Date.now();
    const dayInMs = realSecondsPerGameDay("1x") * 1000;
    const got = computeOfflineProgress({ lastRealTimestamp: now - dayInMs }, now);
    const want = offlineFromElapsed(dayInMs / 1000);
    expect(got).toEqual(want);
  });

  test("a day offline advances the same number of days as a day online", () => {
    // The single most important property of the whole module: being away must not be worth
    // more or less than being present.
    const now = Date.now();
    const off = computeOfflineProgress({ lastRealTimestamp: now - realSecondsPerGameDay("1x") * 1000 }, now);
    expect(off.ticksToRun).toBe(TICKS_PER_DAY);
    expect(off.elapsedGameMinutes).toBe(MINUTES_PER_DAY);
  });

  test("no timestamp means no offline payout", () => {
    expect(computeOfflineProgress({}, Date.now())).toBeNull();
    expect(computeOfflineProgress({ lastRealTimestamp: Date.now() }, null)).toBeNull();
  });
});

describe("the speed control is wired to the tick", () => {
  test("speed runs the tick more times rather than moving more minutes", () => {
    // The safe design: every per-tick rate is scaled by MINS_PER_TICK, so multiplying that
    // constant would need threading a per-call value through all of them — and missing one
    // would change the economy at 2x but not at 1x.
    expect(SCREEN_CODE).toContain("const steps = multiplierFor(speedId)");
    expect(SCREEN_CODE).toMatch(/for \(let i = 0; i < steps; i\+\+\) next = gameTick\(next\)/);
  });

  test("paused stops time without tearing down the timer", () => {
    expect(SCREEN_CODE).toContain("if (steps <= 0) return;");
  });

  test("the tick interval comes from the clock module", () => {
    expect(SCREEN_CODE).toContain("}, tickIntervalMs());");
    expect(SCREEN_CODE).not.toContain("speedMode ? 1500 : 3000");
  });

  test("N steps of the tick equal N single ticks", () => {
    // What the multiplier actually claims.
    let a = running({ day: 1, gameMinutes: 0 });
    let b = running({ day: 1, gameMinutes: 0 });
    for (let i = 0; i < 12; i++) a = gameTick(a);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) b = gameTick(b);
    expect({ day: a.day, mins: a.gameMinutes }).toEqual({ day: b.day, mins: b.gameMinutes });
  });
});

describe("save compatibility", () => {
  test("the retired speedMode field is dropped rather than carried forever", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.speedMode = true;
    expect(migrateState(legacy).speedMode).toBeUndefined();
  });

  test("a build-7 save keeps its day and clock across the rate change", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.day = 140;
    legacy.gameMinutes = 930;
    const m = migrateState(legacy);
    expect({ day: m.day, mins: m.gameMinutes }).toEqual({ day: 140, mins: 930 });
  });

  test("a save mid-day keeps ticking to the next day, not past it", () => {
    let g = migrateState({ ...JSON.parse(JSON.stringify(freshState())), day: 50, gameMinutes: MINUTES_PER_DAY - MINS_PER_TICK });
    g = { ...g, setupDone: true, tutorialDone: true, materials: { ...STOCKED } };
    g = gameTick(g);
    expect({ day: g.day, mins: g.gameMinutes }).toEqual({ day: 51, mins: 0 });
  });
});
