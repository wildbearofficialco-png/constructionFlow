// Taxes. Reported from a device as "I feel like there is a bug with taxes." There was.
//
// The headline defect: `businessFrozen` was set at 14 days overdue, the game said "operations
// suspended", and NOTHING was suspended. Every reference to the flag in the screen was status
// text. FleetFlow has 39 references and gates dispatch on it; Construction Flow inherited the
// flag and the threshold and none of the consequences.
//
// Two more: no partial payment (so a bill bigger than your cash could never be reduced, only
// grown), and no early-game relief (FleetFlow charges 0.75x below company level 5).
//
// Cleared as NOT bugs, and pinned here so they are not "fixed" later by mistake: the 12% rate
// matches FleetFlow, the overdue counter runs per day rather than per tick, and weeklyStats is
// reset after assessment so revenue is never taxed twice.

import {
  TAX_RATE, FREEZE_DAYS, EARLY_RELIEF_BELOW_LEVEL, EARLY_RELIEF_MULTIPLIER,
  MIN_PAYMENT, UNFREEZE_SHARE, PARTIAL_DAYS_FORGIVEN,
  taxRateFor, assessWeeklyTax, isFrozen, daysUntilFreeze, canTakeNewWork, blockedReason,
  minPartialPayment, suggestedPayment, unfreezeThreshold,
  canPayInFull, canPayPartial, applyTaxPayment, describeTaxStatus,
} from "../src/systems/taxOffice.js";

const g = (over = {}) => ({ day: 30, cash: 100000, taxDue: 0, taxOverdueDays: 0, businessFrozen: false, companyLevel: 6, ...over });

describe("the rate matches the benchmark, with relief for a young company", () => {
  test("an established company pays the headline rate", () => {
    expect(taxRateFor(g({ companyLevel: 6 }))).toBe(TAX_RATE);
  });

  test("a young company pays less", () => {
    expect(taxRateFor(g({ companyLevel: 1 }))).toBeCloseTo(TAX_RATE * EARLY_RELIEF_MULTIPLIER, 6);
    expect(taxRateFor(g({ companyLevel: EARLY_RELIEF_BELOW_LEVEL - 1 }))).toBeLessThan(TAX_RATE);
    expect(taxRateFor(g({ companyLevel: EARLY_RELIEF_BELOW_LEVEL }))).toBe(TAX_RATE);
  });

  test("the bill is that rate on gross revenue", () => {
    expect(assessWeeklyTax(g({ companyLevel: 6 }), 100000)).toBe(12000);
    expect(assessWeeklyTax(g({ companyLevel: 1 }), 100000)).toBe(9000);
  });

  test("no revenue, no bill; junk revenue, no crash", () => {
    expect(assessWeeklyTax(g(), 0)).toBe(0);
    expect(assessWeeklyTax(g(), -5)).toBe(0);
    expect(assessWeeklyTax(g(), NaN)).toBe(0);
    expect(assessWeeklyTax(undefined, 1000)).toBeGreaterThan(0);
  });
});

describe("THE FREEZE IS REAL NOW", () => {
  test("a frozen company cannot take on new work", () => {
    expect(canTakeNewWork(g({ businessFrozen: false }))).toBe(true);
    expect(canTakeNewWork(g({ businessFrozen: true }))).toBe(false);
  });

  test("the block explains itself and points at the fix", () => {
    const reason = blockedReason(g({ businessFrozen: true, taxDue: 40000 }));
    expect(reason).toContain("frozen");
    expect(reason).toContain("Finance");
    expect(reason).toContain("part payment");
  });

  test("a solvent company is never blocked", () => {
    expect(blockedReason(g())).toBeNull();
  });

  test("the countdown to the freeze is honest", () => {
    expect(daysUntilFreeze(g({ taxOverdueDays: 0 }))).toBe(FREEZE_DAYS);
    expect(daysUntilFreeze(g({ taxOverdueDays: 13 }))).toBe(1);
    expect(daysUntilFreeze(g({ taxOverdueDays: 40 }))).toBe(0);
  });
});

describe("there is always a way out", () => {
  test("a bill bigger than your cash can still be paid down", () => {
    // The exact trap: old code did `if (cash < taxDue) return`, forever.
    const s = g({ cash: 30000, taxDue: 96000, taxOverdueDays: 65, businessFrozen: true });
    expect(canPayInFull(s)).toBe(false);
    expect(canPayPartial(s)).toBe(true);
    const res = applyTaxPayment(s, minPartialPayment(s));
    expect(res.paid).toBeGreaterThan(0);
    expect(s.taxDue).toBeLessThan(96000);
  });

  test("a payment of at least half lifts the freeze", () => {
    const s = g({ cash: 60000, taxDue: 100000, taxOverdueDays: 30, businessFrozen: true });
    const res = applyTaxPayment(s, 50000);
    expect(res.unfrozen).toBe(true);
    expect(s.businessFrozen).toBe(false);
    expect(canTakeNewWork(s)).toBe(true);
  });

  test("a token payment does NOT lift the freeze", () => {
    const s = g({ cash: 60000, taxDue: 100000, taxOverdueDays: 30, businessFrozen: true });
    applyTaxPayment(s, 1000);
    expect(s.businessFrozen).toBe(true);
  });

  test("paying down buys back time as well as money", () => {
    const s = g({ cash: 60000, taxDue: 100000, taxOverdueDays: 10 });
    applyTaxPayment(s, 50000);
    expect(s.taxOverdueDays).toBe(10 - PARTIAL_DAYS_FORGIVEN);
  });

  test("clearing the bill clears everything", () => {
    const s = g({ cash: 100000, taxDue: 40000, taxOverdueDays: 20, businessFrozen: true });
    const res = applyTaxPayment(s, 40000);
    expect(res.cleared).toBe(true);
    expect(s.taxDue).toBe(0);
    expect(s.taxOverdueDays).toBe(0);
    expect(s.businessFrozen).toBe(false);
  });

  test("you can never overpay, and cash can never go negative", () => {
    const s = g({ cash: 500, taxDue: 100 });
    applyTaxPayment(s, 999999);
    expect(s.taxDue).toBe(0);
    expect(s.cash).toBe(400);

    const broke = g({ cash: 10, taxDue: 5000 });
    applyTaxPayment(broke, 5000);
    expect(broke.cash).toBeGreaterThanOrEqual(0);
  });

  test("the minimum payment is a FLOOR, never a share of the bill", () => {
    // The first cut of this module set the minimum at half the bill, which recreated the very
    // trap it existed to remove: a $96,000 bill with $30,000 cash meant a $48,000 minimum, so
    // the player could still pay nothing. You must always be able to chip away.
    expect(minPartialPayment(g({ taxDue: 100000 }))).toBe(MIN_PAYMENT);
    expect(minPartialPayment(g({ taxDue: 30 }))).toBe(30); // never more than owed
    expect(minPartialPayment(g({ taxDue: 0 }))).toBe(0);
  });

  test("a huge bill with modest cash is still payable in part", () => {
    const s = g({ cash: 30000, taxDue: 96000, businessFrozen: true });
    expect(canPayPartial(s)).toBe(true);
    expect(suggestedPayment(s)).toBe(30000); // pay everything you can afford
  });

  test("the unfreeze threshold is quoted honestly, and only while frozen", () => {
    expect(unfreezeThreshold(g({ taxDue: 100000, businessFrozen: true }))).toBe(100000 * UNFREEZE_SHARE);
    expect(unfreezeThreshold(g({ taxDue: 100000, businessFrozen: false }))).toBe(0);
  });

  test("a payment below the unfreeze share still reduces the debt", () => {
    const s = g({ cash: 30000, taxDue: 96000, businessFrozen: true });
    applyTaxPayment(s, suggestedPayment(s));
    expect(s.taxDue).toBe(66000);
    expect(s.businessFrozen).toBe(true); // 30k < half of 96k
  });

  test("a partial option is not offered when it is just the full payment renamed", () => {
    // Bill of 100 with 100 cash: full payment is available, so "part payment" would be a lie.
    expect(canPayPartial(g({ cash: 100, taxDue: 100 }))).toBe(false);
  });

  test("nothing throws on junk state", () => {
    expect(() => applyTaxPayment(null, 100)).not.toThrow();
    expect(() => applyTaxPayment({}, 100)).not.toThrow();
    expect(() => applyTaxPayment(g({ taxDue: "x", cash: null }), "y")).not.toThrow();
    expect(() => describeTaxStatus(undefined)).not.toThrow();
  });
});

describe("the status tells the truth", () => {
  test("clear, due, overdue and frozen each read differently", () => {
    expect(describeTaxStatus(g({ taxDue: 0 })).level).toBe("clear");
    expect(describeTaxStatus(g({ taxDue: 5000, taxOverdueDays: 0 })).level).toBe("due");
    expect(describeTaxStatus(g({ taxDue: 5000, taxOverdueDays: 3 })).level).toBe("warning");
    expect(describeTaxStatus(g({ taxDue: 5000, taxOverdueDays: 12 })).level).toBe("urgent");
    expect(describeTaxStatus(g({ taxDue: 5000, businessFrozen: true })).level).toBe("frozen");
  });

  test("the frozen message says existing sites keep running", () => {
    // The scoping decision that keeps a freeze a setback rather than a dead save.
    expect(describeTaxStatus(g({ taxDue: 5000, businessFrozen: true })).detail)
      .toContain("Existing sites keep running");
  });
});
