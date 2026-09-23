// The reserve wired into the real game.
//
// Every sprint in this project has produced at least one thing that was written, unit-tested
// and never connected. The unit tests next door prove the module; these prove the GAME uses it,
// and — the part that matters most — that it did not quietly change the economy.

import fs from "fs";
import path from "path";

import { freshState, migrateState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { taxRateFor, PENALTY_GRACE_DAYS, LATE_PENALTY_RATE } from "../src/systems/taxOffice.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const RAW = fs.readFileSync(SCREEN_PATH, "utf8");
const SCREEN_CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 1500000;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

describe("the reserve is actually wired in", () => {
  test("the daily rollover keeps the estimate current", () => {
    expect(SCREEN_CODE).toContain("accrueTaxReserve(g)");
  });

  test("the week bills from the reserve, not from a fresh multiplication", () => {
    expect(SCREEN_CODE).toContain("issueWeeklyTaxBill(g)");
    // The old path must be gone, or revenue would be taxed twice.
    expect(SCREEN_CODE).not.toContain("assessWeeklyTax(g, weeklyRevenue)");
  });

  test("falling behind now costs money and credit", () => {
    expect(SCREEN_CODE).toContain("applyLatePenalty(g)");
    expect(SCREEN_CODE).toContain("applyOverdueCreditHit(g)");
  });

  test("a fresh company starts with an empty reserve", () => {
    expect(freshState().taxReserve).toBe(0);
  });
});

describe("the estimate is visible before the bill lands", () => {
  test("Finance shows what is being set aside while nothing is yet owed", () => {
    // The ambush was structural: the entire tax card was gated on `taxDue > 0`, so during the
    // week a bill was building there was no tax card on screen at all.
    expect(SCREEN_CODE).toContain("Tax Set Aside");
    const idx = SCREEN_CODE.indexOf("Tax Set Aside");
    const block = SCREEN_CODE.slice(Math.max(0, idx - 400), idx);
    expect(block).toContain("(game.taxDue || 0) <= 0 && taxEstimate(game) > 0");
  });

  test("the daily cash-flow figure deducts the tax it accrues", () => {
    // Otherwise the runway estimate overstates the business by the whole tax rate.
    expect(SCREEN_CODE).toContain("dailyTaxAccrual");
    expect(SCREEN_CODE).toMatch(/netDailyCashFlow\s*=[^;]*-\s*dailyTaxAccrual/);
  });

  test("the accrual is shown as its own row rather than silently baked in", () => {
    expect(SCREEN_CODE).toContain("Daily Tax Accrual");
  });
});

describe("economy integrity across a real run", () => {
  test("a long game taxes each week's revenue exactly once", () => {
    // The strongest guard in this sprint. It reconstructs what the bill SHOULD have been from
    // the revenue actually booked and compares it to what the game charged. Double-taxation, a
    // missed week, or a reserve that fails to clear all show up here.
    //
    // Revenue is driven by reserve savings interest rather than by winning jobs, because it is
    // booked every single day by a formula with no RNG in it. A run that depended on bid
    // outcomes would be measuring the dice, not the tax.
    //
    // The bill is zeroed after every tick, standing in for a player who always pays on time.
    // That keeps `taxOverdueDays` at zero so no late penalty can ever fire, which means every
    // increase in taxDue across the run is an assessment and nothing else.
    let g = running({ savings: 400000 });
    let expected = 0;
    let charged = 0;
    let lastRevenue = 0;

    for (let i = 0; i < 48 * 140; i++) {
      const before = g;
      const revBefore = g.weeklyStats?.revenue || 0;
      g = gameTick(g);

      const revAfter = g.weeklyStats?.revenue || 0;
      if (revAfter < revBefore) expected += Math.round(revBefore * taxRateFor(before));
      lastRevenue = revAfter;

      charged += g.taxDue || 0;
      g = { ...g, taxDue: 0, taxOverdueDays: 0, businessFrozen: false };
    }

    expect(lastRevenue).toBeGreaterThanOrEqual(0);
    expect(charged).toBeGreaterThan(0);
    expect(charged).toBe(expected);
  });

  test("400 ticks never produce a NaN reserve or a negative one", () => {
    let g = running();
    for (let i = 0; i < 400; i++) {
      g = gameTick(g);
      expect(Number.isFinite(g.taxReserve)).toBe(true);
      expect(g.taxReserve).toBeGreaterThanOrEqual(0);
    }
  });

  test("the reserve never removes cash", () => {
    // It is an estimate, not an escrow. If this fails the change has rebalanced the game.
    let g = running({ cash: 500000 });
    let prev = g.cash;
    for (let i = 0; i < 48 * 30; i++) {
      const beforeReserve = g.taxReserve || 0;
      g = gameTick(g);
      const grew = (g.taxReserve || 0) - beforeReserve;
      if (grew > 0) {
        // Cash may move for any number of unrelated reasons on the same tick; what must never
        // happen is cash falling by the amount the reserve grew.
        expect(prev - g.cash).not.toBe(grew);
      }
      prev = g.cash;
    }
  });
});

describe("falling behind compounds in the real loop", () => {
  test("an ignored bill grows instead of sitting still", () => {
    let g = running({ cash: 0, taxDue: 40000, taxOverdueDays: PENALTY_GRACE_DAYS });
    const start = g.taxDue;
    for (let i = 0; i < 48 * 10; i++) g = gameTick(g);
    expect(g.taxDue).toBeGreaterThan(start);
  });

  test("the penalty is weekly, so ten days cannot multiply the debt", () => {
    let g = running({ cash: 0, taxDue: 40000, taxOverdueDays: PENALTY_GRACE_DAYS });
    for (let i = 0; i < 48 * 10; i++) g = gameTick(g);
    // Two charges at most over ten days; a daily charge would be ~2.2x.
    expect(g.taxDue).toBeLessThan(40000 * (1 + LATE_PENALTY_RATE) ** 3);
  });
});

describe("save compatibility", () => {
  test("a build-6 save with no reserve loads and starts one from the week it is in", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.taxReserve;
    legacy.weeklyStats = { revenue: 80000, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0 };
    const migrated = migrateState(legacy);
    // Not defaulted to zero: that would silently forgive the tax already accrued this week.
    expect(migrated.taxReserve).toBe(Math.round(80000 * taxRateFor(migrated)));
  });

  test("a legacy save mid-week with no revenue yet gets an empty reserve, not NaN", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.taxReserve;
    expect(migrateState(legacy).taxReserve).toBe(0);
  });

  test("a corrupted reserve is repaired rather than crashing the load", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.taxReserve = "a lot";
    expect(Number.isFinite(migrateState(legacy).taxReserve)).toBe(true);
  });

  test("an existing reserve survives migration untouched", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.taxReserve = 1234;
    expect(migrateState(legacy).taxReserve).toBe(1234);
  });

  test("a save with no credit score gets one rather than NaN-ing the penalty", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.creditScore;
    expect(Number.isFinite(migrateState(legacy).creditScore)).toBe(true);
  });

  test("an unpaid tax bill on a legacy save is not wiped by the upgrade", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.taxDue = 12500;
    legacy.taxOverdueDays = 9;
    delete legacy.taxReserve;
    const m = migrateState(legacy);
    expect({ due: m.taxDue, overdue: m.taxOverdueDays }).toEqual({ due: 12500, overdue: 9 });
  });
});
