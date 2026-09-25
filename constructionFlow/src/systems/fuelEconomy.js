// Construction Flow fuel economics.
//
// Sprint 1 P0: fuel must be a real operating expense, not a free overnight refill.
// Keep this module pure so automatic refuelling, manual refuelling, events and
// offline progression can all use the same math.

export const BASE_FUEL_PRICE_PER_UNIT = 4.25;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function fuelUnitPrice({ regionalMultiplier = 1, economicMultiplier = 1 } = {}) {
  const regional = Math.max(0.25, finiteOr(regionalMultiplier, 1));
  const economic = Math.max(0.25, finiteOr(economicMultiplier, 1));
  return BASE_FUEL_PRICE_PER_UNIT * regional * economic;
}

export function fuelNeeded(equipment) {
  const cap = Math.max(0, finiteOr(equipment?.fuelCap, 100));
  const current = Math.min(cap, Math.max(0, finiteOr(equipment?.fuel, cap)));
  return Math.max(0, cap - current);
}

export function quoteRefuel(equipment, options = {}) {
  const units = fuelNeeded(equipment);
  const unitPrice = fuelUnitPrice(options);
  return {
    units,
    unitPrice,
    cost: Math.round(units * unitPrice),
  };
}

export function refuelAmountForBudget(equipment, budget, options = {}) {
  const unitPrice = fuelUnitPrice(options);
  const need = fuelNeeded(equipment);
  const safeBudget = Math.max(0, finiteOr(budget, 0));
  const affordableUnits = unitPrice > 0 ? safeBudget / unitPrice : need;
  const units = Math.min(need, affordableUnits);
  return {
    units,
    unitPrice,
    cost: Math.round(units * unitPrice),
  };
}

export function applyRefuel(equipment, units) {
  if (!equipment || !Number.isFinite(units) || units <= 0) return 0;
  const cap = Math.max(0, finiteOr(equipment.fuelCap, 100));
  const before = Math.min(cap, Math.max(0, finiteOr(equipment.fuel, cap)));
  const after = Math.min(cap, before + units);
  equipment.fuel = after;
  return after - before;
}

export function fleetFuelExposure(equipmentList = [], options = {}) {
  const active = equipmentList.filter((eq) => eq && eq.status !== "Sold");
  if (!active.length) return { unitsPerDay: 0, dailyCost: 0, unitPrice: fuelUnitPrice(options) };
  const unitsPerDay = active.reduce((sum, eq) => sum + Math.max(0, finiteOr(eq.fuelBurn, 5)), 0);
  const unitPrice = fuelUnitPrice(options);
  return {
    unitsPerDay,
    unitPrice,
    dailyCost: Math.round(unitsPerDay * unitPrice),
  };
}
