// Construction Flow event economics.
// Sprint 1 P0: operational shocks must scale with the business exposed to them.

import { fuelUnitPrice, fleetFuelExposure } from "./fuelEconomy.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function equipmentRepairEventCost(equipment, {
  severity = 1,
  roll = 0.5,
} = {}) {
  const value = Math.max(1000, finite(equipment?.price, finite(equipment?.value, 10000)));
  const tier = Math.max(1, finite(equipment?.tier, 1));
  const sev = clamp(finite(severity, 1), 0.5, 3);
  const variance = 0.85 + clamp(finite(roll, 0.5), 0, 1) * 0.30;

  // A repair shock is a small percentage of the machine's value, with tier/severity moving it.
  // The caps keep a pickup failure survivable and a crane failure meaningful without becoming
  // an arbitrary company-killer.
  const raw = value * (0.018 + tier * 0.004) * sev * variance;
  const floor = Math.max(250, 250 * tier);
  const ceiling = Math.max(1500, value * 0.09);
  return Math.round(clamp(raw, floor, ceiling));
}

export function fuelSurgeEventCost(equipment = [], {
  surgePct = 0.30,
  exposureDays = 5,
  regionalMultiplier = 1,
  economicMultiplier = 1,
} = {}) {
  const price = fuelUnitPrice({ regionalMultiplier, economicMultiplier });
  const exposure = fleetFuelExposure(equipment, { regionalMultiplier, economicMultiplier });
  const pct = clamp(finite(surgePct, 0.30), 0.05, 1.5);
  const days = clamp(finite(exposureDays, 5), 1, 30);
  const raw = exposure.unitsPerDay * price * days * pct;
  // One lightly-used starter vehicle should feel the surge, not be demolished by it. Larger
  // fleets naturally scale upward because the exposure is their real burn rate.
  return Math.round(clamp(raw, 50, 25000));
}
