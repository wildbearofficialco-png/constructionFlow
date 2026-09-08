// FleetFlow Commercial Lending Ladder — Phase 2, Phase C ("Commercial lending ladder").
//
// Replaces the old flat, fixed-principal LOAN_PRODUCTS (4 products, no underwriting beyond a
// credit-score floor and a debt cap) with a real ladder: six products spanning emergency cash to
// acquisition financing, each with a principal *range* (not a fixed amount) that
// src/systems/lendingEngine.js underwrites within based on the borrower's actual financial
// profile — credit score, company value, cash flow, existing debt, payment history, company age,
// collateral, and the current economy (see regionalEconomyEngine.js for that last one).
//
// `game.loans` keeps its existing shape (id, productId, label, principal, apr, weeksLeft,
// totalWeeks, weeklyPayment, remainingBalance, missedPayments, deferUntilDay, inCollections) —
// this is purely additive: new optional fields (category, collateralVehicleId, collateralValue,
// paymentFrequency, approvalReason) ride alongside the old ones, so an old save's existing loans
// keep working with the exact same weekly-payment/collections code path untouched.

export const LOAN_CATEGORIES = {
  MICROLOAN: "microloan",
  EQUIPMENT: "equipment",
  WORKING_CAPITAL: "working_capital",
  BRANCH_EXPANSION: "branch_expansion",
  COMMERCIAL_FLEET: "commercial_fleet",
  ACQUISITION: "acquisition",
};

// principalMin/principalMax bound what computeLoanOffer (lendingEngine.js) can actually offer —
// the real principal lands somewhere in that range based on qualification strength, never a flat
// number. aprMin/aprMax bound how qualification strength moves APR (stronger profile -> aprMin).
export const LENDING_PRODUCTS = [
  {
    id: "microloan",
    category: LOAN_CATEGORIES.MICROLOAN,
    label: "Emergency Microloan",
    description: "Fast, small, unsecured cash for a short-term cash crunch.",
    principalMin: 2500,
    principalMax: 10000,
    aprMin: 14,
    aprMax: 26,
    termWeeks: 10,
    minCredit: 460,
    requiresCollateral: false,
    minCompanyAgeDays: 0,
    maxDebtToValueRatio: 1.5,
  },
  {
    id: "equipment",
    category: LOAN_CATEGORIES.EQUIPMENT,
    label: "Equipment Financing",
    description: "Borrow against the value of an eligible vehicle you already own — lower APR since the vehicle itself is collateral, but it can be repossessed on default.",
    principalMin: 3000,
    principalMax: 400000,
    aprMin: 6,
    aprMax: 14,
    termWeeks: 26,
    minCredit: 520,
    requiresCollateral: true,
    collateralType: "vehicle",
    maxCollateralLtv: 0.8, // "up to 80% of an eligible vehicle" per the Phase 2 handoff doc
    minCompanyAgeDays: 0,
    maxDebtToValueRatio: 2.5,
  },
  {
    id: "working_capital",
    category: LOAN_CATEGORIES.WORKING_CAPITAL,
    label: "Working-Capital Line",
    description: "Flexible unsecured operating capital for payroll, fuel, and day-to-day cash flow.",
    principalMin: 25000,
    principalMax: 250000,
    aprMin: 9,
    aprMax: 18,
    termWeeks: 30,
    minCredit: 600,
    requiresCollateral: false,
    minCompanyAgeDays: 14,
    maxDebtToValueRatio: 2.0,
  },
  {
    id: "branch_expansion",
    category: LOAN_CATEGORIES.BRANCH_EXPANSION,
    label: "Branch Expansion Loan",
    description: "Financing sized for opening or upgrading branch locations.",
    principalMin: 100000,
    principalMax: 1000000,
    aprMin: 7,
    aprMax: 15,
    termWeeks: 52,
    minCredit: 650,
    requiresCollateral: false,
    minCompanyAgeDays: 30,
    maxDebtToValueRatio: 1.6,
  },
  {
    id: "commercial_fleet",
    category: LOAN_CATEGORIES.COMMERCIAL_FLEET,
    label: "Commercial Fleet Loan",
    description: "Large-scale fleet financing for established companies, secured by the fleet's aggregate value.",
    principalMin: 500000,
    principalMax: 5000000,
    aprMin: 6,
    aprMax: 12,
    termWeeks: 65,
    minCredit: 700,
    requiresCollateral: true,
    collateralType: "fleet",
    maxCollateralLtv: 0.7,
    minCompanyAgeDays: 60,
    maxDebtToValueRatio: 1.4,
  },
  {
    id: "acquisition",
    category: LOAN_CATEGORIES.ACQUISITION,
    label: "Acquisition Financing",
    description: "Financing to fund the purchase of an eligible rival/company acquisition.",
    principalMin: 10000,
    principalMax: 8000000,
    aprMin: 8,
    aprMax: 16,
    termWeeks: 52,
    minCredit: 680,
    requiresCollateral: true,
    collateralType: "company",
    maxCollateralLtv: 0.9,
    minCompanyAgeDays: 45,
    maxDebtToValueRatio: 1.3,
  },
];

export const LENDING_PRODUCT_BY_ID = Object.fromEntries(LENDING_PRODUCTS.map((p) => [p.id, p]));

export function getLendingProduct(productId) {
  return LENDING_PRODUCT_BY_ID[productId] || null;
}

// Missed-payment thresholds shared by lendingEngine.js — kept here alongside the product data
// since they're policy, not math. A collateralized loan repossesses at the same "3 strikes"
// point an unsecured loan would go to collections at (see FleetFlowScreen.js's existing weekly
// loan tick) — this is a warning escalation the player can already see coming (missedPayments
// count is shown every week), never an unexplained surprise.
export const REPOSSESSION_MISSED_PAYMENT_THRESHOLD = 3;
