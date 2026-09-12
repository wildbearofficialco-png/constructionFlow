import { recordTransaction, getFinancialSummary } from "../src/systems/financialLedger.js";
import { scheduleMaintenance } from "../src/systems/equipmentWear.js";

describe("Construction Flow financial ledger", () => {
  test("recordTransaction records history without changing cash or weekly totals", () => {
    const game = {
      day: 12,
      cash: 9000,
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
    const game = { day: 10, cash: 5000, ledger: [] };
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

  test("scheduled maintenance creates one ledger expense after cash is deducted", () => {
    const game = {
      day: 5,
      cash: 10000,
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
