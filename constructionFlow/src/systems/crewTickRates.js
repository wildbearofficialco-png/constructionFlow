// Tick-rate invariant crew progression costs.
//
// Sprint 1 P0 found more hard-coded per-tick numbers after the game clock changed. These
// values express design intent per GAME DAY and derive the per-tick behavior from the clock.

import { ticksPerDay } from "./gameClock.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Current behavior at 32 ticks/day was 25% chance of a 2-point rush/overtime stamina hit:
// 32 * .25 = 8 hits/day = 16 extra stamina/day. Preserve that daily intent if the clock changes.
export const RUSH_STAMINA_HITS_PER_DAY = 8;
export const RUSH_STAMINA_PER_HIT = 2;

// Current behavior was a 5% chance of +1 skill each tick: 32 * .05 = 1.6 expected gains/day.
// This is intentionally an EXPECTED COUNT, not an "at least one event per day" probability.
export const SKILL_GAIN_EVENTS_PER_DAY = 1.6;
export const SKILL_GAIN_PER_EVENT = 1;

export function repeatedEventChancePerTick(eventsPerDay, ticks = ticksPerDay("1x")) {
  const events = Number.isFinite(eventsPerDay) ? Math.max(0, eventsPerDay) : 0;
  const n = Number.isFinite(ticks) && ticks > 0 ? ticks : 1;
  return clamp(events / n, 0, 1);
}

export function rushStaminaChancePerTick(ticks = ticksPerDay("1x")) {
  return repeatedEventChancePerTick(RUSH_STAMINA_HITS_PER_DAY, ticks);
}

export function skillGainChancePerTick(ticks = ticksPerDay("1x")) {
  return repeatedEventChancePerTick(SKILL_GAIN_EVENTS_PER_DAY, ticks);
}

export function expectedRushStaminaDrainPerDay(ticks = ticksPerDay("1x")) {
  return ticks * rushStaminaChancePerTick(ticks) * RUSH_STAMINA_PER_HIT;
}

export function expectedSkillGainPerDay(ticks = ticksPerDay("1x")) {
  return ticks * skillGainChancePerTick(ticks) * SKILL_GAIN_PER_EVENT;
}
