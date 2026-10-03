import { equipmentRepairEventCost, fuelSurgeEventCost } from "../src/systems/eventEconomy.js";

describe("scaled event economics", () => {
  test("repair shocks rise with machine value/tier", () => {
    const pickup = equipmentRepairEventCost({ price: 18000, tier: 1 }, { severity: 1, roll: 0.5 });
    const excavator = equipmentRepairEventCost({ price: 58000, tier: 2 }, { severity: 1, roll: 0.5 });
    const crane = equipmentRepairEventCost({ price: 420000, tier: 5 }, { severity: 1, roll: 0.5 });
    expect(excavator).toBeGreaterThan(pickup);
    expect(crane).toBeGreaterThan(excavator);
  });

  test("severity matters without allowing absurd uncapped bills", () => {
    const eq = { price: 60000, tier: 2 };
    const minor = equipmentRepairEventCost(eq, { severity: 0.75, roll: 0.5 });
    const major = equipmentRepairEventCost(eq, { severity: 2.5, roll: 0.5 });
    expect(major).toBeGreaterThan(minor);
    expect(major).toBeLessThanOrEqual(Math.round(eq.price * 0.09));
  });

  test("fuel surge exposure grows with the working fleet", () => {
    const onePickup = fuelSurgeEventCost([{ fuelBurn: 5, status: "Active" }]);
    const heavyFleet = fuelSurgeEventCost([
      { fuelBurn: 5, status: "Active" },
      { fuelBurn: 22, status: "Active" },
      { fuelBurn: 34, status: "Active" },
      { fuelBurn: 28, status: "Idle" },
    ]);
    expect(heavyFleet).toBeGreaterThan(onePickup);
  });

  test("fuel surge no longer starts at a flat $500 for a tiny contractor", () => {
    const starter = fuelSurgeEventCost([{ fuelBurn: 5, status: "Active" }], { surgePct: 0.30, exposureDays: 5 });
    expect(starter).toBeLessThan(500);
    expect(starter).toBeGreaterThanOrEqual(50);
  });

  test("invalid values stay finite", () => {
    expect(Number.isFinite(equipmentRepairEventCost({ price: NaN, tier: Infinity }))).toBe(true);
    expect(Number.isFinite(fuelSurgeEventCost([{ fuelBurn: NaN }]))).toBe(true);
  });
});
