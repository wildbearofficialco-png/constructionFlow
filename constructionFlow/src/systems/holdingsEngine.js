// WildBear Holdings — Phase 2, Phase E ("Sell Company / WildBear Holdings"). Pure math for the
// exit-and-reinvestment loop that replaces the old "Sell the Company" prestige reset, where sale
// proceeds simply vanished into a fresh `initialState()`. This module answers exactly one
// question — "given a sale, what actually happens to the money" — and nothing here mutates game
// state; FleetFlowScreen.js's sellTheCompany() applies the result.
//
// sale valuation - debt payoff - transaction cost - applicable tax = net exit proceeds
//
// This does NOT touch, replace, or duplicate the existing prestige system in
// fleetflowPrestigeHelpers.js (Founder Capital reward curve, permanent income multiplier,
// archived-company record shape, prestige difficulty/reward curves) — those are preserved
// exactly as-is and continue to run alongside this. Holdings is a new, separate persistent
// layer: liquid cash the player can choose to reinvest into their next company, on top of (not
// instead of) Founder Capital.

// Game-design flavor rates, not a claim of real accounting/tax law — a simple, transparent,
// always-visible-before-confirmation model per the handoff doc's "show ... before acceptance"
// spirit used elsewhere (the lending ladder). Deliberately linear (not sqrt/saturating like the
// Founder Capital curve) — Holdings proceeds are meant to be a straightforward "what you built,
// minus real costs of exiting," not another farmable reward curve; the day-gate
// (MIN_PRESTIGE_DAY in fleetflowPrestigeHelpers.js) plus the fact that transaction cost and tax
// are a genuine, unrecoverable skim on every sale are what make repeated quick exits pointless
// rather than advantageous — see computeExitProceeds tests for the linearity proof.
export const EXIT_TRANSACTION_COST_RATE = 0.06;
export const EXIT_TAX_RATE = 0.15;

function toSafeFiniteNonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// The one function that answers "what happens to the money" for a sale. Debt is paid off first
// (capped at the sale valuation — a company can never leave its founder owing money personally;
// any debt beyond what the sale covers is simply discharged along with the dissolved company,
// the same limited-liability simplification real business sales/dissolutions use), transaction
// cost is a flat rate on the gross valuation, and tax applies to what's left after both. Every
// output is floored at 0 — this can never produce a negative Holdings credit.
export function computeExitProceeds({ valuation, debt = 0 } = {}) {
  const grossValuation = toSafeFiniteNonNegative(valuation);
  const rawDebt = toSafeFiniteNonNegative(debt);

  const debtPayoff = Math.min(grossValuation, rawDebt);
  const afterDebt = Math.max(0, grossValuation - debtPayoff);

  const transactionCost = Math.min(afterDebt, Math.round(grossValuation * EXIT_TRANSACTION_COST_RATE));
  const afterDebtAndCosts = Math.max(0, afterDebt - transactionCost);

  const tax = Math.round(afterDebtAndCosts * EXIT_TAX_RATE);
  const netProceeds = Math.max(0, afterDebtAndCosts - tax);

  return {
    grossValuation: Math.round(grossValuation),
    debtPayoff: Math.round(debtPayoff),
    transactionCost: Math.round(transactionCost),
    tax: Math.round(tax),
    netProceeds: Math.round(netProceeds),
  };
}

// The one place "what valuation does a sale use" gets decided — shared by the Sell the Company
// preview card, its confirmation modal, and sellTheCompany()'s actual commit, so the number a
// player is shown before confirming can never drift from what they're actually paid.
// peakCompanyValuation only refreshes once per day (applyDailySystems' trailing-average
// rollover), so a same-day valuation jump (a big contract payout, a windfall) can leave the live
// trailing value above the last stored peak; this always takes the larger of the two rather than
// trusting a stored value that may already be stale.
export function resolveSalePeakValuation(storedPeakValuation, liveValuation) {
  const live = Number.isFinite(liveValuation) ? liveValuation : 0;
  return Number.isFinite(storedPeakValuation) && storedPeakValuation > live ? storedPeakValuation : live;
}

// Clamps a requested reinvestment amount into what's actually available — never more than
// holdingsCash, never negative. The caller (FleetFlowScreen.js's investHoldingsCash) is
// responsible for actually moving the money; this is just the bounds-check every call site
// should share instead of each re-deriving its own clamp.
export function computeReinvestmentAmount(holdingsCash, requestedAmount) {
  const available = toSafeFiniteNonNegative(holdingsCash);
  const requested = toSafeFiniteNonNegative(requestedAmount);
  const investAmount = Math.min(available, requested);
  return {
    investAmount: Math.round(investAmount),
    remainingHoldingsCash: Math.round(available - investAmount),
  };
}

// Builds the Holdings-layer update for one completed sale — the caller merges this into
// `game.holdings`. Kept as a pure builder (rather than mutating in FleetFlowScreen.js inline) so
// the "how holdings.cash accumulates across multiple exits" behavior is independently testable.
export function applyExitToHoldings(priorHoldings, exitProceeds) {
  const prior = priorHoldings || {};
  return {
    cash: toSafeFiniteNonNegative(prior.cash) + toSafeFiniteNonNegative(exitProceeds?.netProceeds),
    lifetimeExits: Math.round(toSafeFiniteNonNegative(prior.lifetimeExits)) + 1,
    lifetimeNetProceeds: toSafeFiniteNonNegative(prior.lifetimeNetProceeds) + toSafeFiniteNonNegative(exitProceeds?.netProceeds),
  };
}
