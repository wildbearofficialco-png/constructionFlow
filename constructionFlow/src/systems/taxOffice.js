// The tax office: what you owe, what happens when you cannot pay, and how you get out.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Reported from a device as "I feel like there is a bug with taxes." There was. Three of them,
// and the first is the Phase 5 defect wearing a new hat.
//
//   1. THE FREEZE WAS FAKE. At 14 days overdue the game set `businessFrozen = true` and told
//      the player "Overdue taxes suspended operations." Nothing was suspended. Every reference
//      to the flag in the screen was status text — a label, a warning string, a next-action
//      hint — and not one of them gated anything. Proved rather than assumed: two identical
//      companies on the same seed, one flagged frozen with an $80,000 overdue bill, both
//      completed the same job and ended within RNG noise of the same cash.
//
//        normal:  jobs 1, sites 0, cash 642,844
//        frozen:  jobs 1, sites 0, cash 637,908
//
//      FleetFlow, the benchmark, has 39 references to the same flag and gates dispatch, the
//      action list and the health score on it. Construction Flow inherited the flag and the
//      14-day threshold and none of the consequences.
//
//   2. THERE WAS NO WAY OUT. `handlePayTax` refused anything but payment in full:
//      `if (g.cash < g.taxDue) return`. A bill larger than the player's cash could therefore
//      never be reduced, only grown, while `taxOverdueDays` climbed forever. FleetFlow has
//      `partialTaxPayment()` for exactly this. Construction Flow did not.
//
//   3. NO EARLY RELIEF. FleetFlow charges a young company 0.75x the headline rate
//      (`companyLevel < 5 ? 0.75 : 1.0`). Construction Flow charged everyone the full 12% from
//      day one, on a company with no reputation, no repeat clients and the thinnest margins it
//      will ever have.
//
// NOT a bug, checked and cleared: the 12% rate itself matches FleetFlow's; the overdue counter
// is correctly inside the day rollover rather than running every tick; and `weeklyStats` is
// reset AFTER assessment, so the same revenue is never taxed twice. Those were the first
// suspicions and all three were wrong.
//
// Everything here is pure and RNG-free.

// The headline rate, matching FleetFlow's.
export const TAX_RATE = 0.12;

// A young company pays less, because a young company has the thinnest margins it will ever
// have and the fewest tools to fix them. Same shape as FleetFlow's early-game modifier.
export const EARLY_RELIEF_BELOW_LEVEL = 5;
export const EARLY_RELIEF_MULTIPLIER = 0.75;

// Days overdue before operations are actually suspended.
export const FREEZE_DAYS = 14;

// Two different thresholds, and conflating them was a bug in the first cut of this module.
//
// MIN_PAYMENT is the smallest payment the game will accept: a floor, so the button does
// something meaningful, and nothing more. Setting this at half the bill (the first attempt)
// recreated the exact trap this module exists to remove — a player with a $96,000 bill and
// $30,000 cash could still pay NOTHING, because the minimum was $48,000. You must always be
// able to chip away at it.
export const MIN_PAYMENT = 50;

// UNFREEZE_SHARE is what it takes to get trading again: half of what is outstanding, matching
// FleetFlow. Paying less is still allowed and still reduces the debt; it just does not lift
// the suspension.
export const UNFREEZE_SHARE = 0.5;

// Paying down the bill buys back time as well as money.
export const PARTIAL_DAYS_FORGIVEN = 4;

// An Estimator on the office staff keeps the assessable base tight — the same shape as
// FleetFlow's Analyst, who cuts the rate to 0.80x. This is the player's LEVER on tax, and its
// absence is half of why tax reads as punishment rather than a problem: a bill you can do
// nothing about is weather, not a decision. Pitched milder than FleetFlow's 0.80 because
// Construction Flow's relief already stacks with the early-game multiplier above.
export const ESTIMATOR_RELIEF = 0.85;

// Unpaid tax compounds, matching FleetFlow's 8%/week after the first week overdue. Without
// this, tax debt is a static number that never gets worse, so ignoring it costs nothing and
// the 14-day freeze arrives out of a clear sky.
export const LATE_PENALTY_RATE = 0.08;
export const PENALTY_GRACE_DAYS = 7;

// The credit-score hit the day the debt turns a week old, as FleetFlow does it.
export const OVERDUE_CREDIT_PENALTY = 15;
export const CREDIT_FLOOR = 420;

function num(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

// ─── Assessment ──────────────────────────────────────────────────────────────

export function hasEstimator(gameState) {
  return (gameState?.officeStaff || []).some((s) => s && s.role === "Estimator");
}

export function taxRateFor(gameState) {
  const level = num(gameState?.companyLevel, 1);
  const base = level < EARLY_RELIEF_BELOW_LEVEL ? TAX_RATE * EARLY_RELIEF_MULTIPLIER : TAX_RATE;
  return hasEstimator(gameState) ? base * ESTIMATOR_RELIEF : base;
}

// The bill for a week's trading. Revenue is gross, as in FleetFlow — the relief above is what
// keeps that survivable early rather than a different base.
export function assessWeeklyTax(gameState, weeklyRevenue) {
  const revenue = num(weeklyRevenue, 0);
  if (revenue <= 0) return 0;
  return Math.round(revenue * taxRateFor(gameState));
}

// ─── Status ──────────────────────────────────────────────────────────────────

export function isFrozen(gameState) {
  return Boolean(gameState?.businessFrozen);
}

export function daysUntilFreeze(gameState) {
  const overdue = num(gameState?.taxOverdueDays, 0);
  return Math.max(0, FREEZE_DAYS - overdue);
}

// THE GATE. This is the function whose absence was the bug: a frozen company may not take on
// NEW work.
//
// Deliberately scoped to new work only. Sites already under way keep running, crews keep being
// paid and progress payments keep arriving — because a freeze that stopped everything would
// leave a player with no cash and no way to earn any, which is a dead save rather than a
// setback. You can finish what you started and pay your way out; you just cannot grow while
// you owe.
export function canTakeNewWork(gameState) {
  return !isFrozen(gameState);
}

export function blockedReason(gameState) {
  if (!isFrozen(gameState)) return null;
  const owed = num(gameState?.taxDue, 0);
  return `Operations are frozen over ${owed > 0 ? `$${Math.round(owed).toLocaleString()} in ` : ""}unpaid tax. ` +
    `Finish the work you have and pay the bill in Finance — a part payment is enough to lift the freeze.`;
}

// ─── Payment ─────────────────────────────────────────────────────────────────

// The smallest payment the game accepts — a floor, never a share of the bill.
export function minPartialPayment(gameState) {
  const due = num(gameState?.taxDue, 0);
  if (due <= 0) return 0;
  return Math.min(due, MIN_PAYMENT);
}

// What the button should actually pay: everything you can afford, up to what you owe. A player
// digging out of a hole wants the biggest dent they can make, not an arbitrary instalment.
export function suggestedPayment(gameState) {
  const due = num(gameState?.taxDue, 0);
  if (due <= 0) return 0;
  return Math.max(0, Math.min(due, Math.floor(num(gameState?.cash, 0))));
}

// What it would take to lift the freeze, or 0 when there is nothing to lift.
export function unfreezeThreshold(gameState) {
  const due = num(gameState?.taxDue, 0);
  if (due <= 0 || !isFrozen(gameState)) return 0;
  return Math.ceil(due * UNFREEZE_SHARE);
}

export function canPayInFull(gameState) {
  const due = num(gameState?.taxDue, 0);
  return due > 0 && num(gameState?.cash, 0) >= due;
}

export function canPayPartial(gameState) {
  const due = num(gameState?.taxDue, 0);
  if (due <= 0) return false;
  const cash = num(gameState?.cash, 0);
  // Offered when you can afford SOMETHING but not the lot. Never offered when you could simply
  // pay in full, because "part payment" would then be the full payment under another name.
  return cash >= minPartialPayment(gameState) && cash < due;
}

// Applies a payment and returns what happened, so the caller can log and notify honestly.
// `amount` is clamped to what is owed and what is affordable; callers cannot overpay, and a
// payment can never push cash negative.
export function applyTaxPayment(game, requestedAmount) {
  if (!game) return { paid: 0, remaining: 0, cleared: false, unfrozen: false };

  const due = num(game.taxDue, 0);
  if (due <= 0) return { paid: 0, remaining: 0, cleared: true, unfrozen: false };

  const cash = num(game.cash, 0);
  const amount = Math.max(0, Math.min(Math.round(num(requestedAmount, 0)), due, cash));
  if (amount <= 0) return { paid: 0, remaining: due, cleared: false, unfrozen: false };

  const wasFrozen = isFrozen(game);

  game.cash = cash - amount;
  game.expenses = num(game.expenses, 0) + amount;
  game.taxDue = Math.max(0, due - amount);

  const cleared = game.taxDue <= 0;
  if (cleared) {
    game.taxOverdueDays = 0;
    game.businessFrozen = false;
  } else {
    // A serious payment buys back time and lifts the freeze, matching FleetFlow's rule that a
    // payment of at least half the outstanding balance unfreezes the business. Without this a
    // player who genuinely cannot raise the full amount has no route back, which is the
    // second defect this module exists to fix.
    game.taxOverdueDays = Math.max(0, num(game.taxOverdueDays, 0) - PARTIAL_DAYS_FORGIVEN);
    if (wasFrozen && amount >= due * UNFREEZE_SHARE) game.businessFrozen = false;
  }

  return {
    paid: amount,
    remaining: game.taxDue,
    cleared,
    unfrozen: wasFrozen && !game.businessFrozen,
  };
}

// ─── The reserve ─────────────────────────────────────────────────────────────
//
// THE DEFECT THIS FIXES, reported from a device as "taxes is still an issue" after the freeze
// fix above was already written.
//
// FleetFlow sets tax aside as the player earns it:
//
//   game.taxReserve += finalPayout * 0.12 * earlyGameMod * taxMod;   // every completed route
//   const taxBill = Math.round(game.taxReserve);                     // at week end
//
// and surfaces the running figure as `taxEstimate` inside getDailyExpenses, so the player
// watches the money being set aside and knows the bill before it lands. It is an expected event.
//
// Construction Flow had ZERO references to taxReserve. The bill was computed at week end from
// weeklyStats.revenue and simply appeared, against cash already committed to wages and
// materials. That is an ambush, and no amount of rebalancing the RATE fixes it, because the
// rate was never the problem — FleetFlow charges the same 12%.
//
// IMPORTANT: the reserve is NOTIONAL. It never moves cash, exactly as FleetFlow's does not.
// It is a running estimate of what is being accrued, nothing more. That is what makes this
// change economically neutral: the bill it issues is arithmetically identical to the old
// `Math.round(weeklyRevenue * taxRateFor(g))`, and `taxReserveIntegrity.test.js` proves it
// across the whole revenue range rather than asserting it here.

// Recomputes the running estimate from the revenue booked so far this week. Called every day,
// so the figure grows as payments land rather than appearing all at once.
//
// Derived rather than incremented on purpose. An incremental accrual would have to be added at
// every site that books revenue — progress claims, job completion, property income, savings
// interest, asset sales — and missing one under-taxes the player forever while double-counting
// one over-taxes them. Deriving from the single field the bill was always based on cannot
// drift from it.
export function accrueTaxReserve(game) {
  if (!game) return 0;
  const weeklyRevenue = num(game.weeklyStats?.revenue, 0);
  game.taxReserve = weeklyRevenue > 0 ? Math.round(weeklyRevenue * taxRateFor(game)) : 0;
  return game.taxReserve;
}

// What the player is told they are heading for. Kept separate from the field so callers read an
// intention rather than a mutable.
export function taxEstimate(gameState) {
  return Math.max(0, Math.round(num(gameState?.taxReserve, 0)));
}

// Issues the week's bill FROM the reserve and empties it, as FleetFlow does. Returns the amount
// billed so the caller can log it honestly.
//
// Callers must accrue immediately before issuing, so revenue booked earlier in the same
// week-end block (property income, for one) is captured. Doing it here would hide that ordering
// requirement rather than remove it, so it stays explicit at the call site.
export function issueWeeklyTaxBill(game) {
  if (!game) return 0;
  const bill = Math.max(0, Math.round(num(game.taxReserve, 0)));
  game.taxReserve = 0;
  if (bill <= 0) return 0;
  game.taxDue = num(game.taxDue, 0) + bill;
  return bill;
}

// ─── Falling behind ──────────────────────────────────────────────────────────

// Compounds the debt once it is more than a week old, matching FleetFlow's 8%/week. Returns the
// penalty added, or 0.
//
// Deliberately charged per WEEK, not per day: `taxOverdueDays` ticks daily, so charging 8% each
// day would multiply the debt by ~2.9x over the seven days before the freeze and turn a setback
// into a death spiral. FleetFlow charges it inside a weekly block; Construction Flow's overdue
// counter lives in the daily rollover, so the week boundary has to be checked explicitly.
export function applyLatePenalty(game) {
  if (!game) return 0;
  const due = num(game.taxDue, 0);
  const overdue = num(game.taxOverdueDays, 0);
  if (due <= 0 || overdue <= PENALTY_GRACE_DAYS) return 0;
  if ((overdue - PENALTY_GRACE_DAYS) % 7 !== 0) return 0;

  const penalty = Math.round(due * LATE_PENALTY_RATE);
  if (penalty <= 0) return 0;
  game.taxDue = due + penalty;
  return penalty;
}

// The one-off credit hit the day the debt turns a week old. Returns the points lost, or 0.
export function applyOverdueCreditHit(game) {
  if (!game) return 0;
  if (num(game.taxOverdueDays, 0) !== PENALTY_GRACE_DAYS) return 0;
  const before = num(game.creditScore, CREDIT_FLOOR);
  game.creditScore = Math.max(CREDIT_FLOOR, before - OVERDUE_CREDIT_PENALTY);
  return before - game.creditScore;
}

// ─── Describing ──────────────────────────────────────────────────────────────

export function describeTaxStatus(gameState) {
  const due = num(gameState?.taxDue, 0);
  const overdue = num(gameState?.taxOverdueDays, 0);

  if (due <= 0) {
    const setAside = taxEstimate(gameState);
    // "No tax outstanding" on its own was part of the ambush: it read as "nothing is coming"
    // on the exact screen where a bill was quietly building.
    return {
      level: "clear",
      headline: "No tax outstanding",
      detail: setAside > 0
        ? `Nothing owed yet. $${setAside.toLocaleString()} is being set aside from this week's revenue.`
        : "Your account with the tax office is clear.",
    };
  }
  if (isFrozen(gameState)) {
    return {
      level: "frozen",
      headline: "Operations frozen",
      detail: "You cannot take on new work until this is paid down. Existing sites keep running.",
    };
  }
  const left = daysUntilFreeze(gameState);
  if (overdue > 0) {
    return {
      level: left <= 4 ? "urgent" : "warning",
      headline: `Tax overdue ${overdue} day${overdue === 1 ? "" : "s"}`,
      detail: `Operations freeze in ${left} day${left === 1 ? "" : "s"} if this is not paid down.`,
    };
  }
  return { level: "due", headline: "Tax due", detail: "Pay before it falls overdue." };
}
