import {
  getBreakdownProbability,
  initEquipmentProfile,
  performReplacement,
  scheduleMaintenance,
  tickEquipmentWear,
} from "../src/systems/equipmentWear";

function gameWithEquipment(overrides = {}) {
  return {
    day: 20,
    cash: 100000,
    expenses: 0,
    logs: [],
    weeklyStats: { revenue: 0, expenses: 0, repairs: 0 },
    equipment: [{
      id: "eq1",
      name: "Excavator",
      status: "Idle",
      condition: 100,
      dailyCost: 520,
      price: 58000,
      ...overrides,
    }],
  };
}

describe("Construction Flow equipment wear integration", () => {
  test("condition=0 stays catastrophic instead of being treated as 100%", () => {
    const probability = getBreakdownProbability({ condition: 0, wearProfile: "moderate" }, 0);
    expect(probability).toBeGreaterThan(0.05);
  });

  test("initial profile preserves a real 0% condition", () => {
    const profiled = initEquipmentProfile({ id: "eq1", condition: 0 });
    expect(profiled.durability).toBe(0);
  });

  test("Construction Flow's Active status receives wear", () => {
    const game = gameWithEquipment({ status: "Active", condition: 90, wearProfile: "moderate", lastMaintenanceDay: 20 });
    const before = game.equipment[0].condition;
    const random = jest.spyOn(Math, "random").mockReturnValue(1);
    tickEquipmentWear(game);
    random.mockRestore();
    expect(game.equipment[0].condition).toBeLessThan(before);
  });

  test("idle equipment becomes maintenance-due after its interval", () => {
    const game = gameWithEquipment({ status: "Idle", wearProfile: "moderate", lastMaintenanceDay: 1 });
    tickEquipmentWear(game);
    expect(game.equipment[0].maintenanceDue).toBe(true);
  });

  test("preventive maintenance refuses equipment assigned to an active site", () => {
    const game = gameWithEquipment({ status: "Active", maintenanceDue: true, wearProfile: "moderate" });
    const beforeCash = game.cash;
    expect(scheduleMaintenance(game, "eq1")).toBe(false);
    expect(game.cash).toBe(beforeCash);
  });

  test("preventive maintenance uses Construction Flow dailyCost and records the expense", () => {
    const game = gameWithEquipment({ status: "Idle", condition: 70, maintenanceDue: true, wearProfile: "moderate" });
    const beforeCash = game.cash;
    expect(scheduleMaintenance(game, "eq1")).toBe(true);
    expect(game.cash).toBeLessThan(beforeCash);
    expect(game.expenses).toBe(beforeCash - game.cash);
    expect(game.weeklyStats.expenses).toBe(beforeCash - game.cash);
    expect(game.equipment[0].condition).toBeGreaterThan(70);
  });

  test("major replacement cannot happen while equipment is active", () => {
    const game = gameWithEquipment({ status: "Active", condition: 10, replacementNeeded: true });
    expect(performReplacement(game, "eq1")).toBe(false);
    expect(game.equipment[0].condition).toBe(10);
  });
});
