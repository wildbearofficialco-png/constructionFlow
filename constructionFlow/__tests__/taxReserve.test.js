// The tax reserve: the accrual that turns a weekly ambush into an expected event.
//
// Sprint 9. Reported from a device as "taxes is still an issue" AFTER the freeze fix. The
// freeze fix was real but it was not this: FleetFlow sets tax aside as the player earns and
// shows the running figure all week (`taxReserve` / `taxEstimate`), and Construction Flow had
// zero references to either. The bill was computed at week end and simply appeared.

import {
  TAX_RATE,
  EARLY_RELIEF_MULTIPLIER,
  ESTIMATOR_RELIEF,
  LATE_PENALTY_RATE,
  PENALTY_GRACE_DAYS,
  OVERDUE_CREDIT_PENALTY,
  CREDIT_FLOOR,
  taxRateFor,
  hasEstimator,
  accrueTaxReserve,
  taxEstimate,
  issueWeeklyTaxBill,
  applyLatePenalty,
  applyOverdueCreditHit,
  assessWeeklyTax,
  describeTaxStatus,
} from "../src/systems/taxOffice.js";

const co = (over = {}) => ({
  companyLevel: 9, cash: 100000, taxDue: 0, taxOverdueDays: 0, taxReserve: 0,
  creditScore: 700, officeStaff: [], weeklyStats: { revenue: 0 }, ...over,
});

describe("the reserve accrues as revenue lands", () => {
  test("no revenue means nothing set aside", () => {
    const g = co();
    expect(accrueTaxReserve(g)).toBe(0);
    expect(g.taxReserve).toBe(0);
  });

  test("the estimate grows with the week's revenue", () => {
    const g = co();
    const seen = [];
    for (const rev of [1000, 5000, 20000, 60000]) {
      g.weeklyStats.revenue = rev;
      seen.push(accrueTaxReserve(g));
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen[0]).toBeGreaterThan(0);
  });

  test("the reserve is NOTIONAL — it never moves cash", () => {
    // The whole reason this change is economically safe. FleetFlow's reserve does not touch
    // cash either; it is a running estimate, not an escrow account.
    const g = co({ weeklyStats: { revenue: 250000 } });
    const before = g.cash;
    accrueTaxReserve(g);
    expect(g.taxReserve).toBeGreaterThan(0);
    expect(g.cash).toBe(before);
  });

  test("a revenue reversal shrinks the estimate rather than stranding an old one", () => {
    const g = co({ weeklyStats: { revenue: 90000 } });
    accrueTaxReserve(g);
    const high = g.taxReserve;
    g.weeklyStats.revenue = 10000;
    accrueTaxReserve(g);
    expect(g.taxReserve).toBeLessThan(high);
  });

  test("negative weekly revenue never produces a negative reserve", () => {
    const g = co({ weeklyStats: { revenue: -5000 } });
    expect(accrueTaxReserve(g)).toBe(0);
  });

  test("taxEstimate reads the reserve back without mutating it", () => {
    const g = co({ taxReserve: 4321 });
    expect(taxEstimate(g)).toBe(4321);
    expect(g.taxReserve).toBe(4321);
  });

  test("a garbage reserve reads as zero rather than NaN", () => {
    expect(taxEstimate({ taxReserve: "lots" })).toBe(0);
    expect(taxEstimate(null)).toBe(0);
  });
});

describe("the week's bill comes out of the reserve", () => {
  test("billing moves the reserve into what is owed and empties it", () => {
    const g = co({ weeklyStats: { revenue: 100000 } });
    accrueTaxReserve(g);
    const reserved = g.taxReserve;
    expect(issueWeeklyTaxBill(g)).toBe(reserved);
    expect(g.taxDue).toBe(reserved);
    expect(g.taxReserve).toBe(0);
  });

  test("an empty reserve issues no bill", () => {
    const g = co();
    expect(issueWeeklyTaxBill(g)).toBe(0);
    expect(g.taxDue).toBe(0);
  });

  test("a new bill stacks on an unpaid one rather than replacing it", () => {
    const g = co({ taxDue: 5000, weeklyStats: { revenue: 100000 } });
    accrueTaxReserve(g);
    const bill = issueWeeklyTaxBill(g);
    expect(g.taxDue).toBe(5000 + bill);
  });

  test("billing twice without re-accruing cannot double-charge", () => {
    // The defect this ordering is designed to prevent.
    const g = co({ weeklyStats: { revenue: 100000 } });
    accrueTaxReserve(g);
    const first = issueWeeklyTaxBill(g);
    const second = issueWeeklyTaxBill(g);
    expect(second).toBe(0);
    expect(g.taxDue).toBe(first);
  });
});

describe("the bill is arithmetically identical to the old one", () => {
  // ECONOMY INTEGRITY. This change must move the telegraphing and nothing else. If these fail,
  // the reserve has silently rebalanced the game.
  test.each([1, 99, 100, 847, 5000, 12345, 99999, 250000, 1750000])(
    "revenue %i bills the same through the reserve as through assessWeeklyTax",
    (rev) => {
      const direct = assessWeeklyTax(co(), rev);
      const g = co({ weeklyStats: { revenue: rev } });
      accrueTaxReserve(g);
      expect(issueWeeklyTaxBill(g)).toBe(direct);
    }
  );

  test("holds at every company level, where the early-relief multiplier changes", () => {
    for (let level = 1; level <= 10; level++) {
      const rev = 84000;
      const direct = assessWeeklyTax(co({ companyLevel: level }), rev);
      const g = co({ companyLevel: level, weeklyStats: { revenue: rev } });
      accrueTaxReserve(g);
      expect({ level, bill: issueWeeklyTaxBill(g) }).toEqual({ level, bill: direct });
    }
  });
});

describe("the Estimator is the player's lever on tax", () => {
  test("no Estimator, no relief", () => {
    expect(hasEstimator(co())).toBe(false);
    expect(taxRateFor(co())).toBeCloseTo(TAX_RATE, 10);
  });

  test("an Estimator on the office staff reduces the rate", () => {
    const g = co({ officeStaff: [{ role: "Estimator" }] });
    expect(hasEstimator(g)).toBe(true);
    expect(taxRateFor(g)).toBeCloseTo(TAX_RATE * ESTIMATOR_RELIEF, 10);
  });

  test("other office roles do not", () => {
    for (const role of ["Site Foreman", "Safety Officer", "Project Manager"]) {
      expect(hasEstimator(co({ officeStaff: [{ role }] }))).toBe(false);
    }
  });

  test("the relief stacks with early-game relief for a young company", () => {
    const g = co({ companyLevel: 1, officeStaff: [{ role: "Estimator" }] });
    expect(taxRateFor(g)).toBeCloseTo(TAX_RATE * EARLY_RELIEF_MULTIPLIER * ESTIMATOR_RELIEF, 10);
  });

  test("hiring an Estimator genuinely lowers the bill", () => {
    const rev = 200000;
    const without = co({ weeklyStats: { revenue: rev } });
    const with_ = co({ weeklyStats: { revenue: rev }, officeStaff: [{ role: "Estimator" }] });
    accrueTaxReserve(without); accrueTaxReserve(with_);
    expect(issueWeeklyTaxBill(with_)).toBeLessThan(issueWeeklyTaxBill(without));
  });

  test("a malformed officeStaff entry does not crash the rate", () => {
    expect(() => taxRateFor(co({ officeStaff: [null, undefined, {}] }))).not.toThrow();
  });
});

describe("unpaid tax compounds", () => {
  test("nothing is charged inside the grace period", () => {
    for (let d = 0; d <= PENALTY_GRACE_DAYS; d++) {
      expect(applyLatePenalty(co({ taxDue: 10000, taxOverdueDays: d }))).toBe(0);
    }
  });

  test("the penalty lands one week past grace", () => {
    const g = co({ taxDue: 10000, taxOverdueDays: PENALTY_GRACE_DAYS + 7 });
    expect(applyLatePenalty(g)).toBe(Math.round(10000 * LATE_PENALTY_RATE));
    expect(g.taxDue).toBe(10800);
  });

  test("it is charged per week, not per day", () => {
    // Charging daily would multiply the debt ~2.9x across the week before the freeze and turn
    // a setback into a death spiral. This is the guard on that.
    let g = co({ taxDue: 10000, taxOverdueDays: PENALTY_GRACE_DAYS });
    let charges = 0;
    for (let i = 0; i < 14; i++) {
      g.taxOverdueDays += 1;
      if (applyLatePenalty(g) > 0) charges += 1;
    }
    expect(charges).toBe(2);
  });

  test("no debt means no penalty however overdue the counter reads", () => {
    expect(applyLatePenalty(co({ taxDue: 0, taxOverdueDays: 400 }))).toBe(0);
  });

  test("a debt too small to round to a penalty is left alone", () => {
    const g = co({ taxDue: 4, taxOverdueDays: PENALTY_GRACE_DAYS + 7 });
    expect(applyLatePenalty(g)).toBe(0);
    expect(g.taxDue).toBe(4);
  });
});

describe("credit takes the hit once", () => {
  test("the score drops the day the debt turns a week old", () => {
    const g = co({ taxDue: 9000, taxOverdueDays: PENALTY_GRACE_DAYS, creditScore: 700 });
    expect(applyOverdueCreditHit(g)).toBe(OVERDUE_CREDIT_PENALTY);
    expect(g.creditScore).toBe(700 - OVERDUE_CREDIT_PENALTY);
  });

  test("and never again on later days", () => {
    const g = co({ taxDue: 9000, taxOverdueDays: PENALTY_GRACE_DAYS + 1, creditScore: 700 });
    expect(applyOverdueCreditHit(g)).toBe(0);
    expect(g.creditScore).toBe(700);
  });

  test("the score cannot be driven below the floor", () => {
    const g = co({ taxDue: 9000, taxOverdueDays: PENALTY_GRACE_DAYS, creditScore: CREDIT_FLOOR + 3 });
    applyOverdueCreditHit(g);
    expect(g.creditScore).toBe(CREDIT_FLOOR);
  });
});

describe("the status line stops implying nothing is coming", () => {
  test("a clear account with a reserve building says so", () => {
    const g = co({ taxDue: 0, taxReserve: 7400 });
    expect(describeTaxStatus(g).detail).toContain("7,400");
  });

  test("a genuinely clear account still reads clear", () => {
    expect(describeTaxStatus(co()).detail).toContain("clear");
  });
});
