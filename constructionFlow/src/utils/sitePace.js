// How fast a site is going, in the units the card prints: percent of a phase per GAME DAY, and
// whole game days to finish.
//
// Sprint 1. Both places that printed this multiplied the per-tick rate by a hard-coded 48 — ticks
// per day when a tick was 30 game minutes. The clock has since moved to 45-minute ticks (32 a
// day; systems/gameClock.js), so the card showed 1.5x the real speed and a finish date a third too
// soon: "~4 days remaining" on a job that then took six. The conversion now comes from the clock,
// so the card and the simulation cannot drift apart again.

import { ticksPerDay } from "../systems/gameClock.js";

export function pctPerDay(ratePerTick) {
  const r = Number(ratePerTick);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return r * ticksPerDay("1x");
}

// null when the site is not moving: an ETA for a stopped job would be a guess, not a number.
export function daysRemaining(site, ratePerTick = site?._progressRate) {
  const perDay = pctPerDay(ratePerTick);
  if (!site || perDay <= 0) return null;
  const phases = Array.isArray(site.phases) ? site.phases.length : 0;
  const left = Math.max(0, 100 * (phases - (site.currentPhaseIdx || 0)) - Math.max(0, site.phaseProgress || 0));
  return Math.ceil(left / perDay);
}
