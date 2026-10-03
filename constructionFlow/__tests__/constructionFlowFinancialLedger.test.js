import {
  recordTransaction,
  reconcileUnloggedCashMovement,
  getFinancialSummary,
  beginCashScope,
  closeCashScope,
} from "../src/systems/financialLedger.js";
import { freshState, migrateState } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { scheduleMaintenance } from "../src/systems/equipmentWear.js";

describe("Construction Flow financial ledger", () => {
  test("recordTransaction records history without changing cash or weekly totals", () => {
    const game = {
      day: 12,
      cash: 9000,
      revenue: 1000,
      expenses: 250,
      weeklyStats: { revenue: 1000, expenses: 250 },
      ledger: [],
    };

    recordTransaction(game, "materials", -400, "Concrete order");

    expect(game.cash).toBe(9000);
    expect(game.weeklyStats).toEqual({ revenue: 1000, expenses: 250 });
    expect(game.ledger).toHaveLength(1);
    expect(game.ledger[0]).toMatchObject({
      day: 12,
      category: "materials",
      amount: -400,
      description: "Concrete order",
      balance: 9000,
    });
  });

  test("financial summary groups revenue and expenses from the ledger", () => {
    const game = { day: 10, cash: 5000, revenue: 0, expenses: 0, ledger: [] };
    recordTransaction(game, "contracts", 3000, "Contract payment");
    recordTransaction(game, "payroll", -900, "Payroll");
    recordTransaction(game, "maintenance", -300, "Repair");

    const summary = getFinancialSummary(game, 7);
    expect(summary.totalRevenue).toBe(3000);
    expect(summary.totalExpenses).toBe(1200);
    expect(summary.netProfit).toBe(1800);
    expect(summary.expensesByCategory.payroll).toBe(900);
    expect(summary.expensesByCategory.maintenance).toBe(300);
  });

  test("reconciliation captures unlogged income, expenses, and financing without changing balances", () => {
    const game = { day: 4, cash: 10000, revenue: 1000, expenses: 200, ledger: [] };
    reconcileUnloggedCashMovement(game); // seed snapshot

    game.cash = 11500;
    game.revenue = 3000;   // +2000 income
    game.expenses = 700;   // +500 expense
    // Explained cash is +1500, so there is no financing residual.
    reconcileUnloggedCashMovement(game);

    expect(game.cash).toBe(11500);
    expect(game.revenue).toBe(3000);
    expect(game.expenses).toBe(700);
    expect(game.ledger).toHaveLength(2);
    expect(game.ledger.some(e => e.amount === 2000 && e.meta?.source === "reconciliation")).toBe(true);
    expect(game.ledger.some(e => e.amount === -500 && e.meta?.source === "reconciliation")).toBe(true);
  });

  test("explicit ledger entries refresh the snapshot so reconciliation does not duplicate them", () => {
    const game = { day: 7, cash: 5000, revenue: 0, expenses: 0, ledger: [] };
    reconcileUnloggedCashMovement(game);

    game.cash -= 300;
    game.expenses += 300;
    recordTransaction(game, "materials", -300, "Lumber order");
    const before = game.ledger.length;

    reconcileUnloggedCashMovement(game);
    expect(game.ledger).toHaveLength(before);
  });

  test("cash movement unexplained by revenue/expenses is classified as financing", () => {
    const game = { day: 9, cash: 2000, revenue: 0, expenses: 0, ledger: [] };
    reconcileUnloggedCashMovement(game);
    game.cash += 5000;
    reconcileUnloggedCashMovement(game);

    expect(game.ledger[0]).toMatchObject({ category: "financing", amount: 5000 });
  });

  test("scheduled maintenance creates one ledger expense after cash is deducted", () => {
    const game = {
      day: 5,
      cash: 10000,
      revenue: 0,
      expenses: 0,
      weeklyStats: { expenses: 0, repairs: 0 },
      ledger: [],
      equipment: [{
        id: "exc-1",
        name: "Excavator",
        status: "Idle",
        condition: 60,
        durability: 60,
        dailyCost: 520,
        price: 58000,
        wearProfile: "moderate",
        maintenanceDue: true,
        maintenanceHistory: [],
      }],
      logs: [],
    };

    const ok = scheduleMaintenance(game, "exc-1");
    expect(ok).toBe(true);
    expect(game.ledger).toHaveLength(1);
    expect(game.ledger[0].category).toBe("maintenance");
    expect(game.ledger[0].amount).toBeLessThan(0);
    expect(game.ledger[0].balance).toBe(game.cash);
    expect(game.weeklyStats.expenses).toBe(Math.abs(game.ledger[0].amount));
  });

  // ── Sprint 1: the swallow ────────────────────────────────────────────────────
  test("cash that moved WITHOUT an entry is still reconciled after something else is recorded", () => {
    // The defect: recordTransaction re-took the baseline from the live balance, so an unlogged
    // $10,000 followed by any logged entry vanished from the books for good.
    const game = { day: 3, cash: 50000, revenue: 0, expenses: 0, ledger: [] };
    reconcileUnloggedCashMovement(game);
    game.cash -= 10000;                                  // e.g. a decision card, unlogged
    game.cash -= 200; game.expenses += 200;
    recordTransaction(game, "payroll", -200, "Payroll"); // logged
    const named = reconcileUnloggedCashMovement(game);
    expect(named.reduce((t, e) => t + e.amount, 0)).toBe(-10000);
  });

  test("a combined deduction recorded in parts produces no phantom entry", () => {
    const game = { day: 3, cash: 50000, revenue: 0, expenses: 0, ledger: [] };
    reconcileUnloggedCashMovement(game);
    game.cash -= 700; game.expenses += 700;              // daily overhead, one deduction
    recordTransaction(game, "payroll", -540, "Payroll");
    recordTransaction(game, "property", -50, "Rent");
    recordTransaction(game, "equipment", -110, "Equipment");
    expect(reconcileUnloggedCashMovement(game)).toEqual([]);
  });

  test("a non-cash entry (capitalised interest) does not move the cash baseline", () => {
    const game = { day: 3, cash: 50000, revenue: 0, expenses: 0, ledger: [] };
    reconcileUnloggedCashMovement(game);
    game.expenses += 30;
    recordTransaction(game, "financing", -30, "Credit line interest", { nonCash: true });
    expect(reconcileUnloggedCashMovement(game)).toEqual([]);
  });

  test("a cash scope names exactly the part of a block that was not already recorded", () => {
    const game = { day: 3, cash: 50000, revenue: 0, expenses: 0, ledger: [] };
    reconcileUnloggedCashMovement(game);
    const scope = beginCashScope(game);
    game.cash -= 1100;                                   // unlogged fine inside the block
    game.cash -= 400; recordTransaction(game, "materials", -400, "Logged part");
    const e = closeCashScope(game, scope, "fines", "Regulatory hold: Accept");
    expect(e).toMatchObject({ category: "fines", amount: -1100, description: "Regulatory hold: Accept" });
    expect(reconcileUnloggedCashMovement(game)).toEqual([]);
  });

  test("a new company's books start at its opening balance", () => {
    const g = freshState();
    expect(g._ledgerSnapshot.cash).toBe(g.cash);
  });

  test("an old save with no baseline takes one from its own balance, not the new-company default", () => {
    const old = { ...freshState(), cash: 412345, revenue: 900000, expenses: 480000, day: 88 };
    delete old._ledgerSnapshot;
    const g = migrateState(JSON.parse(JSON.stringify(old)));
    expect(g._ledgerSnapshot.cash).toBe(412345);
    expect(reconcileUnloggedCashMovement(g)).toEqual([]);
  });
});
