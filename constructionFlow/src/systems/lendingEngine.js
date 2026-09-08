// FleetFlow Commercial Lending Ladder engine — Phase 2, Phase C. Pure underwriting and
// repayment-math functions over the products in src/data/lendingProducts.js. Nothing here reads
// or mutates game state directly — every function takes a plain "borrower profile" object and
// returns a plain result, which is what makes qualification boundaries and repayment math
// independently unit-testable without spinning up a whole game object.

import { getLendingProduct, REPOSSESSION_MISSED_PAYMENT_THRESHOLD } from "../data/lendingProducts";

// borrowerProfile shape (all optional; sane defaults applied):
//   creditScore        — 300-850ish, same scale the game already uses
//   companyValue       — net worth used for valuation-style checks (assets - debt), NEVER just cash
//   cashFlow           — recent average weekly profit (can be negative)
//   existingDebt       — game.debt (sum of all loans' remainingBalance)
//   missedPaymentCount — total missed payments across payment history (0 = perfect record)
//   companyAgeDays     — days since founding/last prestige reset
//   collateralValue    — for equipment/fleet/acquisition products, the appraised value of the
//                         asset being financed against
//   economyMult        — a regional/economic-cycle multiplier (from regionalEconomyEngine.js),
//                         nudges APR — a stronger local economy earns a small rate discount,
//                         capped so it can never be the deciding factor on its own
function normalizeProfile(profile = {}) {
  return {
    creditScore: Number.isFinite(profile.creditScore) ? profile.creditScore : 550,
    companyValue: Number.isFinite(profile.companyValue) ? profile.companyValue : 0,
    cashFlow: Number.isFinite(profile.cashFlow) ? profile.cashFlow : 0,
    existingDebt: Number.isFinite(profile.existingDebt) ? Math.max(0, profile.existingDebt) : 0,
    missedPaymentCount: Number.isFinite(profile.missedPaymentCount) ? Math.max(0, profile.missedPaymentCount) : 0,
    companyAgeDays: Number.isFinite(profile.companyAgeDays) ? Math.max(0, profile.companyAgeDays) : 0,
    collateralValue: Number.isFinite(profile.collateralValue) ? Math.max(0, profile.collateralValue) : 0,
    economyMult: Number.isFinite(profile.economyMult) ? profile.economyMult : 1.0,
  };
}

// A 0..1 "how strong is this borrower" score — drives both how much of the product's principal
// range they qualify for and where in the APR range they land. Deliberately simple/transparent
// (each factor is independently visible to the player elsewhere in the UI — credit score,
// company value, cash flow, debt) rather than a hidden black-box score.
function qualificationStrength(profile, product) {
  const creditRange = 850 - product.minCredit;
  const creditScore01 = creditRange > 0 ? clamp01((profile.creditScore - product.minCredit) / creditRange) : 1;

  const debtToValue = profile.companyValue > 0 ? profile.existingDebt / profile.companyValue : (profile.existingDebt > 0 ? 1 : 0);
  const debtHeadroom01 = clamp01(1 - debtToValue / Math.max(0.01, product.maxDebtToValueRatio));

  const cashFlow01 = clamp01((profile.cashFlow + 2000) / 10000); // -2000/wk floors at 0, +8000/wk caps at 1

  const paymentHistory01 = clamp01(1 - profile.missedPaymentCount / 8);

  return clamp01(
    creditScore01 * 0.35 +
    debtHeadroom01 * 0.30 +
    cashFlow01 * 0.20 +
    paymentHistory01 * 0.15
  );
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// Reasons a loan is declined, most-important-first — returned as a list so the UI can show every
// blocking reason at once instead of one at a time.
export function evaluateLoanEligibility(productId, rawProfile) {
  const product = getLendingProduct(productId);
  if (!product) return { eligible: false, reasons: ["Unknown loan product."] };
  const profile = normalizeProfile(rawProfile);
  const reasons = [];

  if (profile.creditScore < product.minCredit) {
    reasons.push(`Credit score ${profile.creditScore} is below the ${product.minCredit} minimum for ${product.label}.`);
  }
  if (profile.companyAgeDays < product.minCompanyAgeDays) {
    reasons.push(`Company must be at least ${product.minCompanyAgeDays} days old (currently ${profile.companyAgeDays}).`);
  }
  const debtToValue = profile.companyValue > 0 ? profile.existingDebt / profile.companyValue : (profile.existingDebt > 0 ? Infinity : 0);
  if (debtToValue > product.maxDebtToValueRatio) {
    reasons.push(`Existing debt is too high relative to company value for ${product.label}.`);
  }
  if (product.requiresCollateral && profile.collateralValue <= 0) {
    reasons.push(`${product.label} requires eligible collateral, and none was provided.`);
  }
  if (profile.cashFlow < -5000) {
    reasons.push("Recent cash flow is too negative to support new debt service.");
  }

  return { eligible: reasons.length === 0, reasons };
}

// The single underwriting function — call this once per offer generation. Returns either a full
// offer (approved: true) with every disclosure the Phase 2 handoff doc requires shown before
// acceptance (APR, principal, total repayment, payment frequency, collateral, approval reason),
// or approved: false with the decline reasons from evaluateLoanEligibility.
export function computeLoanOffer(productId, rawProfile, { idFactory } = {}) {
  const product = getLendingProduct(productId);
  if (!product) return { approved: false, reasons: ["Unknown loan product."] };
  const profile = normalizeProfile(rawProfile);
  const eligibility = evaluateLoanEligibility(productId, profile);
  if (!eligibility.eligible) return { approved: false, reasons: eligibility.reasons };

  const strength = qualificationStrength(profile, product);

  // Principal: interpolate within [min, max] by qualification strength, then cap by collateral
  // LTV for secured products — a player can never borrow more than the collateral actually
  // supports, no matter how strong the rest of their profile is.
  let principal = Math.round(product.principalMin + (product.principalMax - product.principalMin) * strength);
  let collateralCap = null;
  if (product.requiresCollateral) {
    collateralCap = Math.round(profile.collateralValue * (product.maxCollateralLtv ?? 1));
    principal = Math.min(principal, collateralCap);
    principal = Math.max(product.principalMin, Math.min(principal, product.principalMax));
    if (principal > collateralCap) {
      return { approved: false, reasons: [`Collateral only supports up to ${collateralCap} at this product's ${Math.round((product.maxCollateralLtv ?? 1) * 100)}% LTV cap.`] };
    }
  }

  // APR: stronger borrowers land near aprMin, weaker near aprMax. The regional/economic-cycle
  // multiplier can only nudge this by up to ±1.5 points — a strong economy is a small tailwind,
  // never the deciding factor over the borrower's own qualification.
  const baseApr = product.aprMax - (product.aprMax - product.aprMin) * strength;
  const economyAdjustment = clamp(((profile.economyMult ?? 1.0) - 1.0) * -6, -1.5, 1.5);
  const apr = Math.max(product.aprMin, Math.round((baseApr + economyAdjustment) * 10) / 10);

  const totalRepayment = Math.round(principal * (1 + (apr / 100) * (product.termWeeks / 52)));
  const weeklyPayment = Math.max(1, Math.round(totalRepayment / product.termWeeks));

  const approvalReason = strength >= 0.75
    ? "Strong credit, low existing debt, and healthy cash flow qualified you for near-prime terms."
    : strength >= 0.45
    ? "Approved on standard terms based on your current credit and debt profile."
    : "Approved at the higher end of this product's rate range — credit, debt load, or cash flow are limiting factors.";

  return {
    approved: true,
    id: idFactory ? idFactory() : undefined,
    productId: product.id,
    category: product.category,
    label: product.label,
    principal,
    apr,
    termWeeks: product.termWeeks,
    weeklyPayment,
    totalRepayment,
    paymentFrequency: "Weekly",
    collateralRequired: product.requiresCollateral,
    collateralType: product.requiresCollateral ? product.collateralType : null,
    collateralValue: product.requiresCollateral ? profile.collateralValue : 0,
    approvalReason,
    qualificationStrength: strength,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Converts an approved offer into the exact `game.loans` shape the existing weekly-payment/
// collections pipeline in FleetFlowScreen.js already reads (id, productId, label, principal,
// apr, weeksLeft, totalWeeks, weeklyPayment, remainingBalance, missedPayments, deferUntilDay) —
// plus the new collateral/category fields riding alongside, additively.
export function offerToLoanRecord(offer, uid, extra = {}) {
  return {
    id: uid(),
    productId: offer.productId,
    category: offer.category,
    label: offer.label,
    principal: offer.principal,
    apr: offer.apr,
    weeksLeft: offer.termWeeks,
    totalWeeks: offer.termWeeks,
    weeklyPayment: offer.weeklyPayment,
    remainingBalance: offer.totalRepayment,
    missedPayments: 0,
    deferUntilDay: 0,
    inCollections: false,
    collateralType: offer.collateralType || null,
    collateralVehicleId: extra.collateralVehicleId || null,
    collateralValue: offer.collateralValue || 0,
    paymentFrequency: offer.paymentFrequency,
    approvalReason: offer.approvalReason,
  };
}

// Whether a loan's current missedPayments count should trigger repossession THIS tick, instead
// of (or in addition to) the existing unsecured-loan collections escalation. Only collateralized
// loans with an attached vehicle ever repossess — an unsecured loan has nothing to repossess and
// keeps going to collections exactly as it already does.
export function shouldRepossess(loan) {
  if (!loan || !loan.collateralVehicleId) return false;
  return (loan.missedPayments || 0) >= REPOSSESSION_MISSED_PAYMENT_THRESHOLD && !loan.repossessed;
}

// Pure repayment-math helper for a single week's payment attempt — used by tests to verify the
// math independent of the setState-wrapped game tick. Mirrors (does not replace) the existing
// inline logic in FleetFlowScreen.js's weekly loan tick.
export function computeWeeklyPaymentResult(loan, cashAvailable) {
  if (!loan || loan.remainingBalance <= 0) {
    return { paid: false, remainingBalance: loan?.remainingBalance || 0, missedPayments: loan?.missedPayments || 0 };
  }
  if (cashAvailable >= loan.weeklyPayment) {
    return {
      paid: true,
      cashSpent: loan.weeklyPayment,
      remainingBalance: Math.max(0, loan.remainingBalance - loan.weeklyPayment),
      missedPayments: loan.missedPayments || 0,
    };
  }
  const penalty = Math.round(loan.weeklyPayment * 0.08);
  return {
    paid: false,
    cashSpent: 0,
    remainingBalance: loan.remainingBalance + penalty,
    missedPayments: (loan.missedPayments || 0) + 1,
    penalty,
  };
}
