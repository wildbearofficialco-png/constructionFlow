import {
  recordTransaction,
  reconcileUnloggedCashMovement,
  getFinancialSummary,
} from "../src/systems/financialLedger.js";
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
});
