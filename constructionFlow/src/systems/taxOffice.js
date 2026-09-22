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

function num(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

// ─── Assessment ──────────────────────────────────────────────────────────────

export function taxRateFor(gameState) {
  const level = num(gameState?.companyLevel, 1);
  return level < EARLY_RELIEF_BELOW_LEVEL ? TAX_RATE * EARLY_RELIEF_MULTIPLIER : TAX_RATE;
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

// ─── Describing ──────────────────────────────────────────────────────────────

export function describeTaxStatus(gameState) {
  const due = num(gameState?.taxDue, 0);
  const overdue = num(gameState?.taxOverdueDays, 0);

  if (due <= 0) {
    return { level: "clear", headline: "No tax outstanding", detail: "Your account with the tax office is clear." };
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
