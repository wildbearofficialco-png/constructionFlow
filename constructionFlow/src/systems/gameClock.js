// The clock: how fast a game day passes, and who is allowed to know.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 11. Reported from a device: "I like how long deliveries take in FleetFlow... I feel
// like taxes are due every five seconds and I'm constantly running out of money."
//
// Measured rather than guessed, and the number is startling.
//
//   FleetFlow          tick 1000ms, +1 game minute per 60 ticks
//                      => 1 game minute per REAL minute. A game day is a REAL day.
//
//   Construction Flow  tick 3000ms, +30 game minutes per tick
//                      => 10 game minutes per real SECOND. A game day is 144 real seconds.
//
// Construction Flow was running its clock **600x faster than FleetFlow**. A full game week —
// payroll seven times, equipment wear seven times, and the tax bill — landed every 17 real
// minutes, or every 8 with the 2x toggle on. That is the whole of the report: the player was
// not imagining the pace, and "constantly running out of money" is what it feels like when
// obligations arrive faster than you can act between them.
//
// WHAT THIS MODULE DOES NOT DO
// ----------------------------
// It does not copy FleetFlow's clock, and that is a deliberate refusal rather than an
// oversight. The two games measure different things:
//
//   FleetFlow's unit of work is a DELIVERY, timed in real seconds (`route.elapsedSec`).
//   Construction Flow's unit of work is a PROJECT, timed in game days — 45 to 300 of them
//   for a mega contract.
//
// At FleetFlow's rate a single Construction Flow mega contract would take 300 real days. One
// job, most of a year. Copying the clock would not make Construction Flow feel like FleetFlow;
// it would make it unplayable. So the day gets substantially longer, and the player gets a
// real speed control to set the rest themselves.
//
// THE LATENT BUG THIS ALSO FIXES
// ------------------------------
// The time scale was defined in four places that agreed only by coincidence:
//
//   MINS_PER_TICK = 30                    (live, inside gameTick)
//   tickMs = speedMode ? 1500 : 3000      (live, inside a useEffect)
//   REAL_SECONDS_PER_GAME_MINUTE = 0.1    (offline)
//   Math.floor(elapsedGameMinutes / 30)   (offline, a hard-coded literal)
//
// Change any one and the offline catch-up silently pays out the wrong amount of progress —
// the kind of defect that never throws and never shows up in a log. They now derive from one
// another here, and `gameClock.test.js` asserts they cannot drift apart.
//
// Everything is pure and RNG-free.

// ─── The base rate ───────────────────────────────────────────────────────────

// How often the live timer fires. Unchanged: the tick interval is a performance and
// battery decision, not a pacing one, and every tick deep-clones the save.
export const TICK_MS = 3000;

// Game minutes advanced per tick at 1x. Was 30, which is where the 600x came from.
//
// At 10: a game day is 1440 / 10 = 144 ticks = 432 real seconds = 7.2 minutes, and a game week
// is about 50 minutes. Three times slower than before, and still roughly 200x faster than
// FleetFlow — which is the correct place to be for a game whose jobs are measured in months.
// MEASURED AGAINST FLEETFLOW IN REAL TIME, which is the comparison that actually matters and
// the one I failed to make for four sprints.
//
//   FleetFlow's smallest delivery:  routeSecRange [500, 900] / vehicle speed, floored at 180s
//                                   => 6 to 15 REAL MINUTES, and several run in parallel, each
//                                      paying out as it lands.
//
//   Construction Flow at MINS_PER_TICK 10:  432 real seconds per game day
//                                   => a SIX-DAY starter contract took 43 REAL MINUTES, paid
//                                      once at the end, with nothing else earning meanwhile.
//
// Three to seven times a FleetFlow delivery, for a single payout. That is the "why is it taking
// so long to do a job" report, and it is arithmetic rather than opinion.
//
// I ALSO CAUSED PART OF IT. Sprint 11 read "taxes are due every five seconds" as "the whole game
// runs too fast" and slowed the clock three-fold, from 144 to 432 seconds a day. The complaint
// was about how often the TAX BILL arrives, not about job pace — and the change tripled exactly
// the thing being complained about. Tax cadence is fixed separately, where it belongs.
//
// At 45: a game day is 96 real seconds, so the six-day starter contract lands at about NINE AND
// A HALF REAL MINUTES — inside FleetFlow's own smallest-delivery window.
//
// Per-game-day economics are untouched by this: costs and income both scale with the day, which
// is what `gameClockIntegration.test.js` pins.
export const MINS_PER_TICK = 45;

export const MINUTES_PER_DAY = 1440;

// ─── Speed ───────────────────────────────────────────────────────────────────

// The old control was a boolean that doubled the tick RATE while leaving MINS_PER_TICK alone,
// and whose own comment ("1.5s real = 15 min game") described something the code did not do.
// A player who wants to skip a quiet stretch and a player who wants to watch a pour finish are
// asking for different things, and one toggle cannot serve both.
export const SPEEDS = Object.freeze([
  { id: "pause", label: "❚❚", multiplier: 0, description: "Paused" },
  { id: "1x", label: "1×", multiplier: 1, description: "Normal — about 1.6 minutes to the day" },
  { id: "2x", label: "2×", multiplier: 2, description: "Double" },
  { id: "4x", label: "4×", multiplier: 4, description: "Fast — for skipping a quiet stretch" },
]);

export const DEFAULT_SPEED_ID = "1x";

export function speedById(id) {
  return SPEEDS.find((s) => s.id === id) || SPEEDS.find((s) => s.id === DEFAULT_SPEED_ID);
}

export function multiplierFor(speedId) {
  return speedById(speedId).multiplier;
}

export function isPaused(speedId) {
  return multiplierFor(speedId) === 0;
}

// Game minutes to advance on one tick at a given speed. Pausing yields 0, which stops the
// clock without tearing down the timer — the tick still runs, it just does not move time.
export function minutesPerTick(speedId) {
  return MINS_PER_TICK * multiplierFor(speedId);
}

// ─── Derived, so nothing can disagree ────────────────────────────────────────

// The single conversion every other rate is built from.
export function realSecondsPerGameMinute(speedId = DEFAULT_SPEED_ID) {
  const mins = minutesPerTick(speedId);
  if (mins <= 0) return Infinity;
  return (TICK_MS / 1000) / mins;
}

export function realSecondsPerGameDay(speedId = DEFAULT_SPEED_ID) {
  return realSecondsPerGameMinute(speedId) * MINUTES_PER_DAY;
}

export function ticksPerDay(speedId = DEFAULT_SPEED_ID) {
  const mins = minutesPerTick(speedId);
  if (mins <= 0) return Infinity;
  return MINUTES_PER_DAY / mins;
}

export function tickIntervalMs() {
  return TICK_MS;
}

// ─── Offline ─────────────────────────────────────────────────────────────────

// Time away is always converted at 1x, whatever speed the player last had selected. Speed is a
// viewing preference for time the player is present for; letting it multiply time they were
// NOT present for would mean leaving the app on 4x paid four times as much for the same night,
// which is a exploit rather than a setting.
export const MAX_OFFLINE_REAL_SECONDS = 7 * 24 * 3600;
export const OFFLINE_SUMMARY_THRESHOLD_GAME_MINUTES = 5;

// Ten game days, matching the old cap, expressed in the new tick rate rather than the old one.
export const MAX_OFFLINE_TICKS = Math.round(10 * ticksPerDay(DEFAULT_SPEED_ID));

export function offlineFromElapsed(elapsedRealSeconds) {
  const capped = Math.min(MAX_OFFLINE_REAL_SECONDS, Math.max(0, elapsedRealSeconds));
  if (capped < 1) return null;

  const elapsedGameMinutes = Math.floor(capped / realSecondsPerGameMinute(DEFAULT_SPEED_ID));
  if (elapsedGameMinutes < OFFLINE_SUMMARY_THRESHOLD_GAME_MINUTES) return null;

  // Derived from MINS_PER_TICK rather than a literal. The literal 30 here was the bug.
  const ticksToRun = Math.floor(elapsedGameMinutes / MINS_PER_TICK);
  if (ticksToRun < 1) return null;

  return { elapsedRealSeconds: capped, elapsedGameMinutes, ticksToRun };
}

// ─── Rate-invariant chance ───────────────────────────────────────────────────

// Converts "this often per game DAY" into the per-tick probability that produces it.
//
// THE TRAP THIS EXISTS TO CLOSE. Slowing the clock tripled the number of ticks in a day, so
// every `Math.random() < p` sitting in the per-tick path silently tripled in frequency. The
// employee call-off gate carried its own documentation of the bug:
//
//     // ~8% chance per game day (every 48 ticks)
//     if (Math.random() < 0.0017) {
//
// 0.0017 per tick is 8% a day at 48 ticks. At 144 it is 21.7%, and the comment above it still
// says 8%. Nothing throws; the game just starts interrupting the player three times as often.
//
// Expressed this way the intent survives any future pace change, because the DAILY rate is the
// number a designer actually reasons about.
export function chancePerTick(dailyChance, speedId = DEFAULT_SPEED_ID) {
  return chancePerTickFor(dailyChance, ticksPerDay(speedId));
}

// The same conversion for an explicit number of ticks in a day. Split out so a test can prove a
// daily rate survives a change of tick length without having to change the real clock.
export function chancePerTickFor(dailyChance, ticks) {
  const p = Number.isFinite(dailyChance) ? Math.min(1, Math.max(0, dailyChance)) : 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (!Number.isFinite(ticks) || ticks <= 0) return 0;
  // 1 - (1-p)^(1/n): the per-tick chance whose complement over n ticks is exactly (1-p).
  return 1 - Math.pow(1 - p, 1 / ticks);
}

// ─── Describing ──────────────────────────────────────────────────────────────

export function describePace(speedId = DEFAULT_SPEED_ID) {
  if (isPaused(speedId)) return "Paused";
  const secs = realSecondsPerGameDay(speedId);
  const mins = secs / 60;
  return mins >= 1
    ? `About ${mins < 10 ? mins.toFixed(1) : Math.round(mins)} min per day`
    : `${Math.round(secs)}s per day`;
}
