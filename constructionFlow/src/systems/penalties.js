// Penalties — one rule for what a fine, a failed inspection or a site incident costs.
//
// SPRINT 1 — A $9,000 INSPECTION ON A $9,000 FENCE. Five code paths charged for inspections and
// safety incidents, and four ignored the size of the job entirely:
//
//   phase inspection, major failure   flat $2,500–9,000
//   site "safety incident"            flat $2,000–8,000, PLUS an incident cost of $1,500–4,000
//                                     per severity level on top
//   follow-up inspection              flat $1,500–5,000
//   scheduled compliance inspection   2% x severity, floored at $1,200
//   site "safety inspection" fail     8–18% of value, no cap
//
// So a starter's first fence could lose its entire gross value to one routine roll, while a
// $1.5M contract paid the same flat $9,000 for the identical failure. Neither is a penalty that
// means anything.
//
// The rule now: a penalty is a SHARE of the contract's value, chosen by severity, raised when the
// player knowingly broke a rule (unlicensed operators, rush/budget corner-cutting), eased a little
// for a small company and stiffened for a large one — and capped as a share of the job, so a
// routine event can hurt but never erase the contract, and a deliberate one can hurt a lot but
// still not exceed half of it.
//
// Pure and deterministic: callers pass `roll` (0..1) when they want variation inside the band.

export const PENALTY_BANDS = Object.freeze({
  minor:  { share: [0.01, 0.03], floor: 250 },
  major:  { share: [0.03, 0.08], floor: 600 },
  severe: { share: [0.08, 0.15], floor: 1500 },
});

// A knowing violation — the player chose it — costs this much more.
export const KNOWING_MULTIPLIER = 1.75;

// The most a single penalty can take, as a share of the contract's value.
export const ROUTINE_CAP_SHARE = 0.15;
export const KNOWING_CAP_SHARE = 0.45;

// An absolute ceiling so a mega-project fine stays a fine rather than a second contract.
export const PENALTY_CEILING = 400000;

export function companySizeFactor(companyLevel) {
  const lvl = Number(companyLevel) || 1;
  if (lvl <= 2) return 0.85;   // a two-truck outfit
  if (lvl <= 5) return 1.0;
  return 1.2;                  // regulators expect more of a large contractor
}

// { contractValue, severity: "minor"|"major"|"severe", knowing, companyLevel, roll }
export function penaltyFor({ contractValue, severity = "major", knowing = false, companyLevel = 1, roll = 0.5 } = {}) {
  const value = Math.max(0, Number(contractValue) || 0);
  const band = PENALTY_BANDS[severity] || PENALTY_BANDS.major;
  const r = Math.min(1, Math.max(0, Number.isFinite(roll) ? roll : 0.5));
  const share = band.share[0] + (band.share[1] - band.share[0]) * r;
  const mult = knowing ? KNOWING_MULTIPLIER : 1;

  let amount = Math.max(value * share * companySizeFactor(companyLevel) * mult, band.floor * mult);
  const cap = value * (knowing ? KNOWING_CAP_SHARE : ROUTINE_CAP_SHARE);
  amount = Math.min(amount, cap, PENALTY_CEILING);
  return Math.max(0, Math.round(amount / 10) * 10);
}

// Share of the contract a penalty represents — for tests and for the player-facing breakdown.
export function penaltyShare(amount, contractValue) {
  const v = Number(contractValue) || 0;
  return v > 0 ? amount / v : 0;
}
