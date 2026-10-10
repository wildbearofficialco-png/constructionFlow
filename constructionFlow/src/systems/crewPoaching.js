// Rivals courting your crew — as a decision, not an ambush.
//
// Build 14 removed a worker the instant a rival "poached" them: a 3% roll per larger rival per
// day, ignoring pay and loyalty, with a single log line after the fact. In a live playtest a
// two-day-old company lost a third of its crew before its first job, and two of three starting
// workers by day 17, with nothing the player could have done.
//
// Now a rival makes an OFFER. The worker weighs it — loyal, well-paid people often turn it down
// on their own, and the player is told — and if they are tempted the player gets a warning and
// POACH_RESPONSE_DAYS to match it or let them go. The challenge stays: good people cost more to
// keep. What is gone is losing someone with no warning and no say.
//
// Pure apart from the injected rng, so the rules are testable without the game.

import { payRatio, marketRateFor } from "./crewPayroll.js";

export const POACH_RESPONSE_DAYS = 3;
// A rival bids this much over what the worker earns now, and never less than this over market.
export const POACH_PREMIUM = 0.2;
export const POACH_MARKET_PREMIUM = 0.1;

function num(v, f = 0) { return Number.isFinite(v) ? v : f; }

// A brand-new company gets to finish one job before anyone comes for its people. Short by
// design: the review asked for warnings and a chance to respond, not a long immunity.
export function poachingAllowed(game) {
  return num(game?.completedJobs, 0) >= 1;
}

// How attractive a worker is to approach: unhappy and underpaid people take calls; loyal,
// well-paid people mostly do not. Never zero, never certain.
export function poachWeight(worker) {
  const ratio = payRatio(worker);
  const pay = ratio < 0.95 ? 2 : ratio > 1.15 ? 0.4 : 1;
  const loyalty = num(worker?.loyalty, 50);
  const loyal = loyalty >= 75 ? 0.4 : loyalty < 40 ? 2 : 1;
  const mood = num(worker?.mood, 70) < 50 ? 1.5 : 1;
  return pay * loyal * mood;
}

export function pickPoachTarget(crew, rng = Math.random) {
  const pool = (crew || []).filter((w) => w && w.status === "Idle" && !w.poachOffer);
  if (pool.length === 0) return null;
  const weights = pool.map(poachWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// The chance the worker says no before it ever reaches the player.
export function declineChance(worker) {
  const loyalty = num(worker?.loyalty, 50);
  const generous = payRatio(worker) > 1.15 ? 0.15 : 0;
  return Math.min(0.75, loyalty / 160 + generous);
}

export function makePoachOffer(worker, rival, day) {
  const current = num(worker?.wagePerDay, 0);
  const offerWage = Math.round(Math.max(current * (1 + POACH_PREMIUM), marketRateFor(worker) * (1 + POACH_MARKET_PREMIUM)));
  return {
    rivalId: rival?.id || null,
    rivalName: rival?.name || "A rival",
    offerWage,
    madeDay: num(day, 1),
    expiresDay: num(day, 1) + POACH_RESPONSE_DAYS,
  };
}

// The rival approaches. Returns what happened so the game can narrate it:
//   { kind: "declined", worker }  — they said no on their own (told to the player as good news)
//   { kind: "offer", worker, offer } — the player must decide by offer.expiresDay
//   null — nobody to approach
export function approachCrew(game, rival, rng = Math.random) {
  const worker = pickPoachTarget(game?.crew, rng);
  if (!worker) return null;
  if (rng() < declineChance(worker)) return { kind: "declined", worker };
  const offer = makePoachOffer(worker, rival, game?.day);
  worker.poachOffer = offer;
  return { kind: "offer", worker, offer };
}

// The player matches. The worker stays on the rival's number and is the more loyal for it.
export function matchOffer(worker, day) {
  if (!worker?.poachOffer) return false;
  worker.wagePerDay = worker.poachOffer.offerWage;
  worker.loyalty = Math.min(100, num(worker.loyalty, 50) + 10);
  worker.mood = Math.min(100, num(worker.mood, 70) + 10);
  worker.underpaidDays = 0;
  worker.lastRaiseDay = num(day, 1);
  delete worker.poachOffer;
  return true;
}

// Workers whose offer has run out without a match. The caller removes them from the company.
export function expiredOffers(game) {
  const day = num(game?.day, 1);
  return (game?.crew || []).filter((w) => w?.poachOffer && day >= w.poachOffer.expiresDay);
}
