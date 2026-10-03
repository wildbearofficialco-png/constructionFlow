// Sprint 1 P0 — chaos events fire at their DOCUMENTED daily rate, whatever the tick length.
//
// The roll was a fixed per-tick 0.012 labelled "8% daily". At the current 32 ticks a day that is
// ~32% a day — 4x — and it had drifted every time the clock changed. These tests pin the daily
// rate, prove it survives tick-length changes, and keep the magic number from coming back.

import fs from "fs";
import path from "path";
import { chancePerTickFor, ticksPerDay } from "../src/systems/gameClock.js";
import { CHAOS_DAILY_CHANCE, chaosDailyChance, chaosChancePerTick } from "../src/systems/siteEvents.js";
import { mulberry32 } from "../scripts/playtest/firstHourHarness.js";

const dailyFromPerTick = (q, n) => 1 - Math.pow(1 - q, n);

describe("the configured daily chance", () => {
  test("starter and mid-game sites", () => {
    expect(chaosDailyChance({ startDay: 1 })).toBe(0.08);
    expect(chaosDailyChance({ startDay: 31 })).toBe(0.12);
    expect(CHAOS_DAILY_CHANCE.starter).toBe(0.08);
  });

  test("the live clock produces exactly that daily rate", () => {
    const n = ticksPerDay("1x");
    expect(dailyFromPerTick(chaosChancePerTick({ startDay: 1 }), n)).toBeCloseTo(0.08, 12);
    expect(dailyFromPerTick(chaosChancePerTick({ startDay: 40 }), n)).toBeCloseTo(0.12, 12);
  });

  test("the old fixed 0.012-per-tick roll really was ~4x the documented rate at 32 ticks", () => {
    expect(dailyFromPerTick(0.012, 32)).toBeGreaterThan(0.31);
    expect(dailyFromPerTick(0.012, 32)).toBeLessThan(0.33);
  });
});

describe.each([7, 32, 48, 96, 144])("at %i ticks per day", (ticks) => {
  test("the analytic daily chance is unchanged", () => {
    for (const p of [0.08, 0.12, 0.5]) {
      expect(dailyFromPerTick(chancePerTickFor(p, ticks), ticks)).toBeCloseTo(p, 12);
      expect(dailyFromPerTick(chaosChancePerTick({ startDay: 1 }, ticks), ticks)).toBeCloseTo(0.08, 12);
    }
  });

  test("a seeded simulation of 20,000 days lands within ±0.6 points of 8%", () => {
    const rng = mulberry32(1234 + ticks);
    const q = chaosChancePerTick({ startDay: 1 }, ticks);
    let days = 0;
    const DAYS = 20000;
    for (let d = 0; d < DAYS; d++) {
      let hit = false;
      for (let t = 0; t < ticks; t++) if (rng() < q) hit = true;
      if (hit) days += 1;
    }
    expect(Math.abs(days / DAYS - 0.08)).toBeLessThan(0.006);
  });
});

test("the site loop uses the derived chance, not a per-tick magic number", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
  expect(code).toContain("Math.random() < chaosChancePerTick(site)");
  expect(code).not.toMatch(/chaosBaseProb/);
});
