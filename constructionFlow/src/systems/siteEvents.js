// How often a job site has a "chaos" event — breakdowns, theft, injuries, fines, holds.
//
// SPRINT 1 — THE 4x DRIFT. The roll used to be a fixed per-TICK number:
//
//     // Chaos events — mid-game sites (started after day 30) get 12% daily chance vs 8%
//     const chaosBaseProb = isMidGameSite ? 0.015 : 0.012;
//     if (Math.random() < chaosBaseProb) { ... }
//
// 0.012 per tick is 8% a day only at about seven ticks a day. The clock has run 48, then 144, then
// 32 ticks a day, and the roll followed every change: at 32 it was ~32% a day for a starter site —
// four times the documented rate — which is why a six-day fence job met fines, injuries and holds
// more often than it met a quiet day. The same trap was closed for employee call-offs with
// chancePerTick(); this closes it for the site events.
//
// The DAILY chance is the design number. The per-tick chance is derived from it and the clock.

import { chancePerTickFor, ticksPerDay } from "./gameClock.js";

export const CHAOS_DAILY_CHANCE = Object.freeze({
  starter: 0.08,   // a site started in the company's first month
  midGame: 0.12,   // a site started after day 30
});

export const MID_GAME_START_DAY = 30;

export function chaosDailyChance(site) {
  return (Number(site?.startDay) || 0) > MID_GAME_START_DAY ? CHAOS_DAILY_CHANCE.midGame : CHAOS_DAILY_CHANCE.starter;
}

// Per-tick chance of a chaos roll for this site. `ticks` defaults to the real clock.
export function chaosChancePerTick(site, ticks = ticksPerDay("1x")) {
  return chancePerTickFor(chaosDailyChance(site), ticks);
}
