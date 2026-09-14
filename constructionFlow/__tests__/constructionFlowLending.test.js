import {
  evaluateLoanEligibility,
  computeLoanOffer,
  offerToLoanRecord,
  computeWeeklyPaymentResult,
  shouldRepossess,
} from "../src/systems/lendingEngine.js";

describe("Construction Flow commercial lending", () => {
  const strongProfile = {
    creditScore: 760,
    companyValue: 900000,
    cashFlow: 12000,
    existingDebt: 40000,
    missedPaymentCount: 0,
    companyAgeDays: 120,
    collateralValue: 300000,
    economyMult: 1,
  };

  test("approves a strong borrower with disclosed terms", () => {
    const offer = computeLoanOffer("working_capital", strongProfile, { idFactory: () => "offer-1" });
    expect(offer.approved).toBe(true);
    expect(offer.principal).toBeGreaterThanOrEqual(25000);
    expect(offer.principal).toBeLessThanOrEqual(250000);
    expect(offer.apr).toBeGreaterThanOrEqual(9);
    expect(offer.apr).toBeLessThanOrEqual(18);
    expect(offer.weeklyPayment).toBeGreaterThan(0);
    expect(offer.totalRepayment).toBeGreaterThanOrEqual(offer.principal);
  });

  test("declines borrowers below the product credit floor", () => {
    const result = evaluateLoanEligibility("working_capital", {
      ...strongProfile,
      creditScore: 540,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/credit score/i);
  });

  test("secured equipment financing requires collateral", () => {
    const result = evaluateLoanEligibility("equipment", {
      ...strongProfile,
      collateralValue: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/collateral/i);
  });

  test("equipment offer never exceeds the collateral LTV cap", () => {
    const offer = computeLoanOffer("equipment", {
      ...strongProfile,
      collateralValue: 10000,
    });
    expect(offer.approved).toBe(true);
    expect(offer.principal).toBeLessThanOrEqual(8000);
  });

  test("approved offer converts to the existing game loan shape", () => {
    const offer = computeLoanOffer("microloan", strongProfile);
    const loan = offerToLoanRecord(offer, () => "loan-1");
    expect(loan).toMatchObject({
      id: "loan-1",
      productId: "microloan",
      remainingBalance: offer.totalRepayment,
      weeklyPayment: offer.weeklyPayment,
      weeksLeft: offer.termWeeks,
      missedPayments: 0,
      inCollections: false,
    });
  });

  test("weekly payment math reduces balance without mutating the loan", () => {
    const loan = { weeklyPayment: 500, remainingBalance: 5000, missedPayments: 0 };
    const result = computeWeeklyPaymentResult(loan, 1000);
    expect(result).toEqual({
      paid: true,
      cashSpent: 500,
      remainingBalance: 4500,
      missedPayments: 0,
    });
    expect(loan.remainingBalance).toBe(5000);
  });

  test("missed payment adds penalty and increments missed count", () => {
    const loan = { weeklyPayment: 500, remainingBalance: 5000, missedPayments: 1 };
    const result = computeWeeklyPaymentResult(loan, 100);
    expect(result.paid).toBe(false);
    expect(result.penalty).toBe(40);
    expect(result.remainingBalance).toBe(5040);
    expect(result.missedPayments).toBe(2);
  });

  test("secured vehicle loan becomes repossession-eligible after three misses", () => {
    expect(shouldRepossess({ collateralVehicleId: "exc-1", missedPayments: 3 })).toBe(true);
    expect(shouldRepossess({ collateralVehicleId: null, missedPayments: 3 })).toBe(false);
  });
});
