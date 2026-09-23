// The clock.
//
// Sprint 11. Reported from a device: "I like how long deliveries take in FleetFlow... I feel
// like taxes are due every five seconds and I'm constantly running out of money."
//
// Measured: FleetFlow ticks every 1000ms and advances ONE game minute per sixty ticks, so a
// FleetFlow day is a real day. Construction Flow ticked every 3000ms and advanced THIRTY game
// minutes each time, so a Construction Flow day was 144 real seconds.
//
// Construction Flow was running 600x faster than the game it is being measured against. A full
// game week — payroll seven times, wear seven times, and the tax bill — landed every 17 real
// minutes. The report was not an exaggeration.

import {
  TICK_MS,
  MINS_PER_TICK,
  MINUTES_PER_DAY,
  SPEEDS,
  DEFAULT_SPEED_ID,
  speedById,
  multiplierFor,
  isPaused,
  minutesPerTick,
  realSecondsPerGameMinute,
  realSecondsPerGameDay,
  ticksPerDay,
  tickIntervalMs,
  offlineFromElapsed,
  describePace,
  MAX_OFFLINE_TICKS,
  MAX_OFFLINE_REAL_SECONDS,
  chancePerTick,
} from "../src/systems/gameClock.js";

describe("the pace actually changed", () => {
  test("a day is now several real minutes rather than two and a half", () => {
    const mins = realSecondsPerGameDay("1x") / 60;
    expect(mins).toBeGreaterThan(5);
    expect(mins).toBeLessThan(15);
  });

  test("the old pace is still reachable, and then some", () => {
    // The game used to run at a fixed 144s/day. 4x is 108s/day — faster still — so nothing is
    // taken away from a player who liked the old speed; 2x (216s) brackets it from the other
    // side. The point of the control is that the pace is now the player's to pick.
    const OLD_SECONDS_PER_DAY = 144;
    expect(realSecondsPerGameDay("4x")).toBeLessThanOrEqual(OLD_SECONDS_PER_DAY);
    expect(realSecondsPerGameDay("2x")).toBeGreaterThan(OLD_SECONDS_PER_DAY);
  });

  test("it is no longer 600x FleetFlow", () => {
    // FleetFlow: 1 game minute per real minute.
    const fleetflowSecondsPerGameMinute = 60;
    const ratio = fleetflowSecondsPerGameMinute / realSecondsPerGameMinute("1x");
    expect(ratio).toBeLessThan(250);
  });

  test("but it is deliberately NOT FleetFlow's clock", () => {
    // A mega contract runs 300 game days. At FleetFlow's rate that is 300 REAL days for one
    // job. Copying the clock would not make this feel like FleetFlow, it would make it
    // unplayable — so a day stays well under an hour.
    expect(realSecondsPerGameDay("1x")).toBeLessThan(3600);
  });
});

describe("speed", () => {
  test("pause, 1x, 2x and 4x all exist and are distinct", () => {
    const ids = SPEEDS.map((s) => s.id);
    expect(ids).toEqual(["pause", "1x", "2x", "4x"]);
    expect(new Set(SPEEDS.map((s) => s.multiplier)).size).toBe(4);
  });

  test("the default is 1x", () => {
    expect(speedById(DEFAULT_SPEED_ID).multiplier).toBe(1);
  });

  test("pause means zero, not slow", () => {
    expect(isPaused("pause")).toBe(true);
    expect(multiplierFor("pause")).toBe(0);
    expect(minutesPerTick("pause")).toBe(0);
    expect(isPaused("1x")).toBe(false);
  });

  test("faster is monotonically faster", () => {
    const perDay = ["1x", "2x", "4x"].map((id) => realSecondsPerGameDay(id));
    expect(perDay[0]).toBeGreaterThan(perDay[1]);
    expect(perDay[1]).toBeGreaterThan(perDay[2]);
  });

  test("4x is exactly four times 1x", () => {
    expect(realSecondsPerGameDay("1x") / realSecondsPerGameDay("4x")).toBeCloseTo(4, 6);
  });

  test("an unknown speed falls back to the default rather than stopping the game", () => {
    // A save or a typo must never silently pause the player's company.
    for (const junk of ["8x", "", null, undefined, "PAUSE "]) {
      expect(multiplierFor(junk)).toBe(1);
    }
  });

  test("a paused clock reports infinite seconds per day rather than dividing by zero", () => {
    expect(realSecondsPerGameMinute("pause")).toBe(Infinity);
    expect(ticksPerDay("pause")).toBe(Infinity);
    expect(Number.isNaN(realSecondsPerGameDay("pause"))).toBe(false);
  });
});

describe("the rates cannot drift apart", () => {
  // The latent bug. The scale used to live in four places — MINS_PER_TICK, the tick interval,
  // REAL_SECONDS_PER_GAME_MINUTE, and a hard-coded `/ 30` in the offline path — that agreed
  // only by coincidence. Changing one would have silently paid out the wrong offline progress.
  test("the live rate and the offline conversion are the same number", () => {
    const live = (TICK_MS / 1000) / MINS_PER_TICK;
    expect(realSecondsPerGameMinute("1x")).toBeCloseTo(live, 10);
  });

  test("a day's worth of real time converts to a day's worth of ticks", () => {
    const secs = realSecondsPerGameDay("1x");
    const off = offlineFromElapsed(secs);
    expect(off.ticksToRun).toBe(ticksPerDay("1x"));
    expect(off.elapsedGameMinutes).toBe(MINUTES_PER_DAY);
  });

  test("ticksPerDay times minutesPerTick is exactly a day", () => {
    expect(ticksPerDay("1x") * minutesPerTick("1x")).toBe(MINUTES_PER_DAY);
  });

  test("the tick interval is what the screen is told to use", () => {
    expect(tickIntervalMs()).toBe(TICK_MS);
  });
});

describe("offline", () => {
  test("a blink away earns nothing", () => {
    expect(offlineFromElapsed(0)).toBeNull();
    expect(offlineFromElapsed(-500)).toBeNull();
    expect(offlineFromElapsed(0.4)).toBeNull();
  });

  test("a night away earns a night's ticks, capped", () => {
    const off = offlineFromElapsed(8 * 3600);
    expect(off.ticksToRun).toBeGreaterThan(0);
    expect(MAX_OFFLINE_TICKS).toBe(Math.round(10 * ticksPerDay("1x")));
  });

  test("time away is converted at 1x whatever speed was selected", () => {
    // Otherwise leaving the app on 4x overnight would pay four times for the same night —
    // an exploit rather than a setting. offlineFromElapsed takes no speed at all, by design.
    expect(offlineFromElapsed.length).toBe(1);
  });

  test("a week away is capped rather than unbounded", () => {
    const huge = offlineFromElapsed(365 * 24 * 3600);
    expect(huge.elapsedRealSeconds).toBe(MAX_OFFLINE_REAL_SECONDS);
  });

  test("the cap still means ten game days after the rate change", () => {
    // The old cap was the literal 480, correct only while a day was 48 ticks. It is now
    // derived, so it stayed ten days when the day became 144 ticks.
    expect(MAX_OFFLINE_TICKS / ticksPerDay("1x")).toBeCloseTo(10, 6);
  });
});

describe("describing", () => {
  test("the pace is stated in a unit a person uses", () => {
    expect(describePace("1x")).toMatch(/min per day/);
    expect(describePace("pause")).toBe("Paused");
  });
});

describe("rate-invariant chance", () => {
  test("a daily chance survives a change in tick rate", () => {
    // The property the whole helper exists for. Whatever the pace, 8% a day stays 8% a day.
    for (const speed of ["1x", "2x", "4x"]) {
      const perTick = chancePerTick(0.08, speed);
      const n = ticksPerDay(speed);
      const perDay = 1 - Math.pow(1 - perTick, n);
      expect(perDay).toBeCloseTo(0.08, 10);
    }
  });

  test("the old hard-coded constant really was 8% at the OLD tick rate", () => {
    // 0.0017 per tick at 48 ticks/day — which is why the comment beside it said 8%.
    expect(1 - Math.pow(1 - 0.0017, 48)).toBeCloseTo(0.08, 2);
  });

  test("and would have become 22% at the new one", () => {
    // The silent breakage. Nothing throws; the player is just interrupted three times as often.
    expect(1 - Math.pow(1 - 0.0017, ticksPerDay("1x"))).toBeGreaterThan(0.2);
  });

  test("certainty and impossibility pass through unchanged", () => {
    expect(chancePerTick(1)).toBe(1);
    expect(chancePerTick(0)).toBe(0);
  });

  test("nonsense input yields no chance rather than NaN", () => {
    for (const junk of [undefined, null, NaN, "lots", -5]) expect(chancePerTick(junk)).toBe(0);
    expect(chancePerTick(4)).toBe(1);
  });

  test("a paused clock has no per-tick chance at all", () => {
    expect(chancePerTick(0.5, "pause")).toBe(0);
  });
});
