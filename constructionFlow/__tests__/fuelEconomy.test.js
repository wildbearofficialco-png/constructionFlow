import {
  BASE_FUEL_PRICE_PER_UNIT,
  fuelUnitPrice,
  fuelNeeded,
  quoteRefuel,
  refuelAmountForBudget,
  applyRefuel,
  fleetFuelExposure,
} from "../src/systems/fuelEconomy.js";

describe("canonical fuel economy", () => {
  test("quotes only the fuel missing from the tank", () => {
    const eq = { fuel: 25, fuelCap: 100 };
    expect(fuelNeeded(eq)).toBe(75);
    expect(quoteRefuel(eq)).toEqual({
      units: 75,
      unitPrice: BASE_FUEL_PRICE_PER_UNIT,
      cost: Math.round(75 * BASE_FUEL_PRICE_PER_UNIT),
    });
  });

  test("regional/economic multipliers are applied through one price function", () => {
    expect(fuelUnitPrice({ regionalMultiplier: 1.1, economicMultiplier: 1.2 }))
      .toBeCloseTo(BASE_FUEL_PRICE_PER_UNIT * 1.1 * 1.2, 8);
  });

  test("budget limits how much fuel can actually be bought", () => {
    const eq = { fuel: 0, fuelCap: 100 };
    const q = refuelAmountForBudget(eq, 42.5);
    expect(q.units).toBeCloseTo(10, 6);
    expect(q.cost).toBe(43);
  });

  test("applying fuel never overfills the tank", () => {
    const eq = { fuel: 90, fuelCap: 100 };
    expect(applyRefuel(eq, 30)).toBe(10);
    expect(eq.fuel).toBe(100);
  });

  test("fleet exposure grows with active machinery and burn rate", () => {
    const small = fleetFuelExposure([{ fuelBurn: 5, status: "Active" }]);
    const large = fleetFuelExposure([
      { fuelBurn: 5, status: "Active" },
      { fuelBurn: 20, status: "Active" },
      { fuelBurn: 35, status: "Idle" },
    ]);
    expect(large.unitsPerDay).toBeGreaterThan(small.unitsPerDay);
    expect(large.dailyCost).toBeGreaterThan(small.dailyCost);
  });

  test("bad numeric input cannot produce NaN or Infinity", () => {
    const eq = { fuel: NaN, fuelCap: Infinity };
    const q = quoteRefuel(eq);
    expect(Number.isFinite(q.units)).toBe(true);
    expect(Number.isFinite(q.unitPrice)).toBe(true);
    expect(Number.isFinite(q.cost)).toBe(true);
  });
});
