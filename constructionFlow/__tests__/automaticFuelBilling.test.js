import { settleAutomaticFuelPurchases, returnRecoveredToSites } from "../src/systems/siteDiagnostics.js";
import { BASE_FUEL_PRICE_PER_UNIT } from "../src/systems/fuelEconomy.js";

describe("automatic refuelling is a real operating expense", () => {
  function game(overrides = {}) {
    return {
      day: 2,
      cash: 10000,
      revenue: 0,
      expenses: 0,
      weeklyStats: { expenses: 0 },
      ledger: [],
      _ledgerSnapshot: { cash: 10000, revenue: 0, expenses: 0, day: 2 },
      activeSites: [],
      crew: [],
      equipment: [],
      ...overrides,
    };
  }

  test("an upward tank movement charges cash and records Fuel in Finance", () => {
    const g = game({ equipment: [{ id: "eq1", name: "Skid Steer", fuelCap: 100, fuel: 40, _fuelBilledLevel: 20, status: "Idle" }] });
    const lines = settleAutomaticFuelPurchases(g);
    const expected = Math.round(20 * BASE_FUEL_PRICE_PER_UNIT);
    expect(g.cash).toBe(10000 - expected);
    expect(g.expenses).toBe(expected);
    expect(g.weeklyStats.expenses).toBe(expected);
    expect(g.ledger[0]).toMatchObject({ category: "fuel", amount: -expected });
    expect(lines[0].kind).toBe("fuel");
  });

  test("normal fuel burn is not charged a second time", () => {
    const g = game({ equipment: [{ id: "eq1", name: "Pickup", fuelCap: 100, fuel: 70, _fuelBilledLevel: 80, status: "Active" }] });
    settleAutomaticFuelPurchases(g);
    expect(g.cash).toBe(10000);
    expect(g.equipment[0]._fuelBilledLevel).toBe(70);
    expect(g.ledger).toHaveLength(0);
  });

  test("a company cannot receive fuel it cannot afford", () => {
    const g = game({
      cash: 0,
      _ledgerSnapshot: { cash: 0, revenue: 0, expenses: 0, day: 2 },
      equipment: [{ id: "eq1", name: "Excavator", fuelCap: 100, fuel: 35, _fuelBilledLevel: 0, status: "Idle" }],
    });
    settleAutomaticFuelPurchases(g);
    expect(g.equipment[0].fuel).toBe(0);
    expect(g.cash).toBe(0);
    expect(g.ledger).toHaveLength(0);
  });

  test("a fuel-stranded machine returns only after purchased fuel reaches the recovery threshold", () => {
    const site = { id: "s1", label: "Fence Installation", status: "Active", assignedEquipmentIds: [], assignedCrewIds: [] };
    const eq = {
      id: "eq1",
      name: "Pickup",
      fuelCap: 100,
      fuel: 35,
      _fuelBilledLevel: 0,
      status: "In Repair",
      awaitingFuelForSiteId: "s1",
    };
    const g = game({ activeSites: [site], equipment: [eq] });
    returnRecoveredToSites(g, () => true);
    expect(site.assignedEquipmentIds).toContain("eq1");
    expect(eq.awaitingFuelForSiteId).toBeNull();
    expect(eq.status).toBe("Active");
    expect(g.ledger.some((e) => e.category === "fuel")).toBe(true);
  });

  test("first observation of an old save does not retroactively charge its existing tank", () => {
    const g = game({ equipment: [{ id: "legacy", name: "Legacy Loader", fuelCap: 100, fuel: 60, status: "Idle" }] });
    settleAutomaticFuelPurchases(g);
    expect(g.cash).toBe(10000);
    expect(g.equipment[0]._fuelBilledLevel).toBe(60);
  });
});
