// Failure-state recovery tests.
//
// The WildBear failure-state rule is that every setback must answer WHAT HAPPENED, WHY, and
// WHAT I CAN DO ABOUT IT. These tests pin the third clause — specifically that the advice is
// derived from real state, so the game never suggests a route the player cannot take.

import {
  buildInsufficientFundsAlert,
  buildAssignBlockAlert,
  getAssignBlockRecovery,
  buildCreditTooLowAlert,
  buildCapacityAlert,
} from "../src/systems/recoveryGuidance.js";

const money = (n) => `$${Math.round(n).toLocaleString()}`;

describe("not enough cash", () => {
  test("states the gap, not just the price", () => {
    const a = buildInsufficientFundsAlert({ cost: 18000, cash: 5000, purchase: "A Skid Steer", formatMoney: money });
    expect(a.shortfall).toBe(13000);
    expect(a.body).toContain("$18,000");
    expect(a.body).toContain("$5,000");
    expect(a.body).toContain("$13,000");
  });

  test("always names at least one recovery route", () => {
    const a = buildInsufficientFundsAlert({ cost: 1000, cash: 0, formatMoney: money });
    expect(a.body).toMatch(/To close the gap:/);
    expect(a.body.split("To close the gap:")[1].trim().length).toBeGreaterThan(10);
  });

  test("does not suggest finishing a job when no job is running", () => {
    const a = buildInsufficientFundsAlert({ cost: 1000, cash: 0, hasActiveSites: false, formatMoney: money });
    expect(a.body).not.toMatch(/finish an active job/i);
    // ...and instead points at the route that IS open.
    expect(a.body).toMatch(/win a bid/i);
  });

  test("suggests finishing a job when one is running", () => {
    const a = buildInsufficientFundsAlert({ cost: 1000, cash: 0, hasActiveSites: true, formatMoney: money });
    expect(a.body).toMatch(/finish an active job/i);
  });

  test("does not suggest borrowing when the player cannot borrow", () => {
    const maxedOut = buildInsufficientFundsAlert({ cost: 1000, cash: 0, canBorrow: false, formatMoney: money });
    expect(maxedOut.body).not.toMatch(/take a loan/i);

    const badCredit = buildInsufficientFundsAlert({ cost: 1000, cash: 0, creditScore: 450, formatMoney: money });
    expect(badCredit.body).not.toMatch(/take a loan/i);
  });

  test("suggests savings only when savings would actually cover it", () => {
    const covered = buildInsufficientFundsAlert({ cost: 5000, cash: 1000, savings: 9000, formatMoney: money });
    expect(covered.body).toMatch(/savings/i);

    const notCovered = buildInsufficientFundsAlert({ cost: 5000, cash: 1000, savings: 100, formatMoney: money });
    expect(notCovered.body).not.toMatch(/move money out of savings/i);
  });

  test("reads as prose, not a dangling list", () => {
    const a = buildInsufficientFundsAlert({
      cost: 5000, cash: 0, savings: 9000, hasActiveSites: true, creditScore: 700, formatMoney: money,
    });
    expect(a.body).not.toMatch(/,\s*\./);
    expect(a.body).not.toMatch(/,\s*or\s*$/);
    expect(a.body.trim().endsWith(".")).toBe(true);
  });

  test("negative cash is handled without producing a nonsense shortfall", () => {
    const a = buildInsufficientFundsAlert({ cost: 1000, cash: -4000, formatMoney: money });
    expect(a.shortfall).toBe(5000);
    expect(a.body).not.toMatch(/NaN|Infinity|undefined/);
  });

  test("missing input does not throw or leak undefined into copy", () => {
    const a = buildInsufficientFundsAlert();
    expect(a.title).toBeTruthy();
    expect(a.body).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe("blocked from starting a job", () => {
  test("every block kind names where the missing piece comes from", () => {
    for (const kind of ["equipment", "tier", "crew", "materials", "frozen"]) {
      const recovery = getAssignBlockRecovery(kind);
      expect(recovery.length).toBeGreaterThan(20);
      // Each route must point at a place in the game, not just restate the rule.
      expect(recovery).toMatch(/Vehicles|Crew|Sites|Bids|Finance/);
    }
  });

  test("the reason and the route arrive as one message", () => {
    const a = buildAssignBlockAlert("Need at least 2 crew members.", "crew");
    expect(a.body).toContain("Need at least 2 crew members.");
    expect(a.body).toMatch(/Crew tab/);
  });

  test("an unrecognised kind degrades to the reason alone rather than blank advice", () => {
    const a = buildAssignBlockAlert("Something went wrong.", "not-a-kind");
    expect(a.body).toBe("Something went wrong.");
    expect(a.title).toBeTruthy();
  });
});

describe("progression gates", () => {
  test("credit gate says how credit moves in both directions", () => {
    const a = buildCreditTooLowAlert({ creditScore: 610, required: 680 });
    expect(a.body).toContain("610");
    expect(a.body).toContain("680");
    expect(a.body).toContain("70");
    expect(a.body).toMatch(/rises/i);
    expect(a.body).toMatch(/falls/i);
  });

  test("capacity gate says what lifts the cap", () => {
    for (const kind of ["crew", "equipment"]) {
      const a = buildCapacityAlert({ kind, current: 4, cap: 4 });
      expect(a.body).toMatch(/Upgrade your office/i);
      expect(a.body).toContain("4");
    }
  });
});
