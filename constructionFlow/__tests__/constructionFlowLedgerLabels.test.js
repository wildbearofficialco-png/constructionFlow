import { freshState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen";
import {
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
  getFinancialSummary,
} from "../src/systems/financialLedger";

import { ticksPerDay } from "../src/systems/gameClock.js";
// Was a hard-coded 48, which meant "ticks per game day" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so the literal silently became "a third of a day".
const TICKS_PER_DAY = ticksPerDay("1x");

// The reconciler is a safety net, not a filing system: anything it has to catch shows up in
// Finance as "Uncategorized income" / "Uncategorized operating expense" / "Financing or
// balance transfer". With the day-to-day flows instrumented, those lines should be the
// exception rather than the bulk of the ledger.
function runDays(days) {
  let g = freshState();
  for (let i = 0; i < days * 48; i++) g = gameTick(g);
  return g;
}

describe("Construction Flow ledger labels", () => {
  test("every recorded category has a display label", () => {
    const g = runDays(30);
    expect(g.ledger.length).toBeGreaterThan(0);
    for (const entry of g.ledger) {
      const table = entry.amount < 0 ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;
      expect(table[entry.category]).toBeDefined();
      expect(typeof table[entry.category].label).toBe("string");
    }
  });

  test("daily overhead is filed as payroll, property and equipment", () => {
    const g = runDays(10);
    const categories = new Set(g.ledger.map((e) => e.category));
    expect(categories.has("payroll")).toBe(true);
    expect(categories.has("property")).toBe(true);
    expect(categories.has("equipment")).toBe(true);
  });

  test("reconciliation entries are a small minority of recorded cash", () => {
    const g = runDays(30);
    const total = g.ledger.reduce((s, e) => s + Math.abs(e.amount), 0);
    const reconciled = g.ledger
      .filter((e) => e.meta?.source === "reconciliation")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    expect(total).toBeGreaterThan(0);
    expect(reconciled / total).toBeLessThan(0.25);
  });

  test("a drawn credit line does not manufacture phantom ledger pairs", () => {
    let g = freshState();
    g.creditLine = { limit: 75000, drawn: 40000, apr: 14, opened: 1 };
    for (let i = 0; i < TICKS_PER_DAY * 14; i++) g = gameTick(g);
    const phantomIn = g.ledger.filter((e) => e.description === "Financing or balance transfer in");
    // Interest capitalised into the drawn balance used to read as unexplained cash coming in
    // on every single day a balance was drawn.
    expect(phantomIn.length).toBeLessThan(4);
    const charged = g.ledger.filter((e) => e.description === "Credit line interest charged");
    expect(charged.length).toBeGreaterThan(5);
  }, 120000);

  test("financial summary buckets resolve to real categories", () => {
    const g = runDays(20);
    const summary = getFinancialSummary(g, 7);
    for (const key of Object.keys(summary.expensesByCategory)) {
      expect(EXPENSE_CATEGORIES[key]).toBeDefined();
    }
    for (const key of Object.keys(summary.revenueByCategory)) {
      expect(REVENUE_CATEGORIES[key]).toBeDefined();
    }
  });
});
