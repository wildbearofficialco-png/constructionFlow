// Payroll: what you pay people, and what happens because of it.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 13, from the device: "I should be able to determine how much people are paid."
//
// You could not. The entire wage control was two buttons:
//
//     onRaiseWage  -> wagePerDay += round(wagePerDay * 0.1); loyalty += 8;  mood += 10
//     onLowerWage  -> wagePerDay -= round(wagePerDay * 0.1); loyalty -= 15; mood -= 12
//
// Nudge up, nudge down, and that was the whole system. Worse, the consequence was a ONE-OFF
// adjustment with no memory: a wage cut cost 15 loyalty on the day it happened and then nothing
// ever again, so the optimal play was to cut everyone's pay, eat the single hit, and bank the
// savings forever. Nobody ever left over it, because nothing was still tracking it tomorrow.
//
// That is the real defect. "Set an exact number" is the feature that was asked for; a number
// that MEANS something is what makes it worth having. So this module adds the missing half:
//
//   1. A MARKET RATE per trade, adjusted for skill and tickets. Now a wage can be read as
//      generous or insulting rather than just large or small.
//   2. SUSTAINED consequences. Underpayment accrues day after day; it does not clear because
//      the player looked away.
//   3. A real exit. People who are paid badly for long enough leave, which is the only thing
//      that makes a payroll decision a decision.
//
// Everything here is pure. Randomness stays at the call site.

// Daily rate the trade pays a competent, unticketed worker. Differentials follow the real
// pecking order: licensed trades over general labour, structural over finishing.
// CALIBRATED AGAINST THE GAME, not against intuition.
//
// The first cut of this table was written from what the trades pay each other in the real
// world, and never checked against what Construction Flow actually pays. `createWorker` deals
// out `wagePerDay: rand(160, 260)`, so a table topping out at 265 meant roughly a QUARTER of
// every new company's crew was below market on the day the player first opened the game — and
// Sprint 13 had just given "below market" teeth. They accrued, and they walked out. A probe of
// forty fresh saves found 27 of 120 crew already underpaid before a single decision was made.
//
// The test that was supposed to catch this only checked for the "insulting" band, which caught
// 1 of 120, so it passed on luck rather than on correctness.
//
// These sit at or below the BOTTOM of the game's own starting range (160), so a fresh company
// is fair-to-generous everywhere and underpayment is something the player chooses, never
// something they inherit. The differentials between trades are kept — they are the part that
// was always right.
export const MARKET_RATES = Object.freeze({
  "Labourer": 120,
  "Carpenter": 145,
  "Concreter": 150,
  "Steelworker": 170,
  "Plumber": 165,
  "Electrician": 175,
  // Office and supervisory roles.
  "Site Foreman": 195,
  "Safety Officer": 180,
  "Project Manager": 215,
  "Estimator": 190,
});

export const DEFAULT_MARKET_RATE = 200;

// Nobody works for nothing, and a floor stops the "pay everyone $1" exploit outright rather
// than relying on the consequences below to punish it.
export const WAGE_FLOOR = 90;
export const WAGE_CEILING = 2000;

// Skill moves the rate: a 120-skill tradesman is worth more than a 75-skill one, and knows it.
export const SKILL_PIVOT = 90;
export const SKILL_WEIGHT = 0.4;

// Each certificate the worker holds is worth this much on top.
export const CERT_PREMIUM = 0.06;

// Bands, as a ratio of the worker's own market rate.
export const INSULTING_BELOW = 0.75;
export const UNDERPAID_BELOW = 0.95;
export const GENEROUS_ABOVE = 1.15;

// How fast sustained underpayment turns into someone handing in their boots.
export const QUIT_RISK_PER_DAY = 0.014;
export const QUIT_GRACE_DAYS = 5;
export const MAX_QUIT_RISK = 0.18;

function num(v, f = 0) {
  return Number.isFinite(v) ? v : f;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

// ─── What the job is worth ───────────────────────────────────────────────────

export function baseRateFor(role) {
  return MARKET_RATES[role] ?? DEFAULT_MARKET_RATE;
}

// What THIS person could get elsewhere: their trade's rate, moved by skill and tickets.
export function marketRateFor(worker) {
  const base = baseRateFor(worker?.role);
  const skill = num(worker?.skill, SKILL_PIVOT);
  const skillFactor = 1 + ((skill - SKILL_PIVOT) / SKILL_PIVOT) * SKILL_WEIGHT;
  const certFactor = 1 + arr(worker?.certifications).length * CERT_PREMIUM;
  return Math.max(WAGE_FLOOR, Math.round(base * Math.max(0.5, skillFactor) * certFactor));
}

export function payRatio(worker) {
  const market = marketRateFor(worker);
  if (market <= 0) return 1;
  return num(worker?.wagePerDay, 0) / market;
}

// A word for the number, so the UI never has to invent one.
export function payPosition(worker) {
  const ratio = payRatio(worker);
  if (ratio < INSULTING_BELOW) {
    return { key: "insulting", label: "Badly underpaid", ratio, tone: "hazard" };
  }
  if (ratio < UNDERPAID_BELOW) {
    return { key: "under", label: "Below market", ratio, tone: "caution" };
  }
  if (ratio > GENEROUS_ABOVE) {
    return { key: "generous", label: "Paid well", ratio, tone: "success" };
  }
  return { key: "fair", label: "Market rate", ratio, tone: "info" };
}

// ─── Setting a wage ──────────────────────────────────────────────────────────

// Clamp and explain. Returns what WOULD happen without mutating, so a caller can preview it
// and the UI can warn before the player commits.
export function previewWage(worker, requested) {
  const current = num(worker?.wagePerDay, 0);
  const wanted = Math.round(num(requested, current));
  const applied = Math.max(WAGE_FLOOR, Math.min(WAGE_CEILING, wanted));
  const delta = applied - current;
  const market = marketRateFor(worker);

  // Reaction scales with the SIZE of the change relative to what they earn, not a flat number.
  // A $10 cut to a $400 wage is a rounding error; the same cut to a $100 wage is an insult.
  const proportion = current > 0 ? delta / current : 0;
  const loyaltyDelta = Math.round(proportion * (delta >= 0 ? 60 : 130));
  const moodDelta = Math.round(proportion * (delta >= 0 ? 70 : 110));

  return {
    current,
    requested: wanted,
    applied,
    delta,
    clamped: applied !== wanted,
    market,
    loyaltyDelta,
    moodDelta,
    positionAfter: payPosition({ ...worker, wagePerDay: applied }),
  };
}

export function setWage(worker, requested) {
  if (!worker) return null;
  const p = previewWage(worker, requested);
  worker.wagePerDay = p.applied;
  worker.loyalty = Math.max(0, Math.min(100, num(worker.loyalty, 50) + p.loyaltyDelta));
  worker.mood = Math.max(0, Math.min(100, num(worker.mood, 70) + p.moodDelta));
  // A raise to at least market wipes the grudge. That is the point of paying it.
  if (p.applied >= p.market) worker.underpaidDays = 0;
  return p;
}

// ─── Being underpaid, day after day ──────────────────────────────────────────

// Called once per game day, per worker. The old system charged for a wage cut once and then
// forgot, which made cutting everyone's pay strictly optimal.
export function accrueUnderpayment(worker) {
  if (!worker) return 0;
  // Normalise first. A build-7 save has no `underpaidDays` at all, and the fair-pay branch
  // below only touches the field when it is already above zero — so a well-paid worker on an
  // upgraded save kept `undefined` forever, and anything doing arithmetic on it got NaN.
  if (!Number.isFinite(worker.underpaidDays)) worker.underpaidDays = 0;
  const pos = payPosition(worker);
  if (pos.key === "under" || pos.key === "insulting") {
    worker.underpaidDays = num(worker.underpaidDays, 0) + 1;
    // A slow morale bleed, so the player can see it happening before anyone walks.
    if (pos.key === "insulting") {
      worker.mood = Math.max(0, num(worker.mood, 70) - 1);
      worker.loyalty = Math.max(0, num(worker.loyalty, 50) - 1);
    }
  } else if (num(worker.underpaidDays, 0) > 0) {
    // Paying properly again heals it, but slower than it accrued.
    worker.underpaidDays = Math.max(0, num(worker.underpaidDays, 0) - 0.5);
  }
  return num(worker.underpaidDays, 0);
}

// The chance this worker walks today. Zero until the grace period is past, so a brief squeeze
// during a cash crisis is survivable — which is the decision the player should get to make.
export function quitRisk(worker) {
  const days = num(worker?.underpaidDays, 0);
  if (days <= QUIT_GRACE_DAYS) return 0;
  const pos = payPosition(worker);
  if (pos.key !== "under" && pos.key !== "insulting") return 0;

  const severity = pos.key === "insulting" ? 1.8 : 1.0;
  const loyaltyShield = 1 - Math.min(0.7, num(worker?.loyalty, 50) / 140);
  const risk = (days - QUIT_GRACE_DAYS) * QUIT_RISK_PER_DAY * severity * loyaltyShield;
  return Math.max(0, Math.min(MAX_QUIT_RISK, risk));
}

// ─── The whole payroll ───────────────────────────────────────────────────────

export function payrollSummary(game) {
  const crew = arr(game?.crew);
  const office = arr(game?.officeStaff);
  const everyone = [...crew, ...office];

  const daily = everyone.reduce((s, w) => s + num(w?.wagePerDay, 0), 0);
  const marketTotal = everyone.reduce((s, w) => s + marketRateFor(w), 0);

  const counts = { insulting: 0, under: 0, fair: 0, generous: 0 };
  for (const w of everyone) counts[payPosition(w).key] += 1;

  const atRisk = crew.filter((w) => quitRisk(w) > 0).length;

  return {
    headcount: everyone.length,
    daily,
    weekly: daily * 7,
    marketDaily: marketTotal,
    // Negative means you are paying under the going rate overall.
    versusMarket: daily - marketTotal,
    counts,
    atRisk,
    headline: atRisk > 0
      ? `${atRisk} ${atRisk === 1 ? "person is" : "people are"} being underpaid and may walk`
      : counts.insulting + counts.under > 0
        ? `${counts.insulting + counts.under} below market`
        : "Everyone at or above market",
  };
}

// ─── Bulk ────────────────────────────────────────────────────────────────────
//
// "If you want to hire 25 employees at once you can; if you want to fire all of them you can."
// FleetFlow has bulkHireApplicants(count) and fireAllDrivers(). Construction Flow had neither —
// every hire and every dismissal was one tap at a time, down a list with no end.

// How many of `count` can actually be taken on, given the cap and the cash. Returns the plan
// rather than performing it, so the UI can say "you can afford 6 of the 25" before the tap.
export function planBulkHire(applicants, count, { crewCap, currentCrew, cash, hireCostFor }) {
  const want = Math.max(0, Math.floor(num(count, 0)));
  const room = Math.max(0, num(crewCap, 0) - num(currentCrew, 0));
  const pool = arr(applicants);

  const taking = [];
  let spend = 0;
  for (const a of pool) {
    if (taking.length >= Math.min(want, room)) break;
    const cost = Math.round(num(hireCostFor ? hireCostFor(a) : a?.hireCost, 0));
    if (spend + cost > num(cash, 0)) break;
    taking.push(a);
    spend += cost;
  }

  return {
    requested: want,
    hiring: taking,
    count: taking.length,
    spend,
    shortOfRoom: want > room,
    shortOfCash: taking.length < Math.min(want, room),
    room,
    reason: want === 0
      ? "Enter how many to hire."
      : room === 0
        ? "No room on the crew — expand your office first."
        : taking.length < want
          ? `Only ${taking.length} of ${want} — ${want > room ? "crew cap" : "not enough cash"}.`
          : null,
  };
}

// Severance is what stops "fire everyone" being free. A day's pay each, which is enough to
// make a mass dismissal a decision rather than a reflex.
export const SEVERANCE_DAYS = 1;

export function planBulkFire(workers) {
  const list = arr(workers);
  const severance = list.reduce((s, w) => s + Math.round(num(w?.wagePerDay, 0) * SEVERANCE_DAYS), 0);
  return {
    count: list.length,
    severance,
    dailySaving: list.reduce((s, w) => s + num(w?.wagePerDay, 0), 0),
  };
}
