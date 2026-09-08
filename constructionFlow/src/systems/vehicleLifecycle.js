// FleetFlow Vehicle Lifecycle — Phase 2, Phase D ("Vehicle aging, mileage, failures, retirement,
// and replacement"). Extends FleetFlowScreen.js's existing condition/mileage/inspection system
// (vehicle.condition, vehicle.mileage, vehicle.inspectionDueDays, vehicle.breakdowns) rather than
// replacing it or building a second parallel wear system — src/systems/equipmentWear.js exists
// but is never imported by FleetFlowScreen.js (a different, unused module); this file is not
// that, and does not touch it.
//
// New fields this module introduces on a vehicle record: `ageDays` (elapsed time since
// manufacture — distinct from `purchasedDay`, which is when the PLAYER bought it; a used vehicle
// starts with age > 0), `terminalRiskScore` (0-1, recomputed daily), `terminalRiskWarned` (the
// day the vehicle first crossed the warning threshold — null until then), `serviceHistory`
// (array of {day, type, note} entries — maintenance/repair/inspection/overhaul events).
//
// Every function here is pure — takes a vehicle (and sometimes a rng/day) and returns a result or
// a set of field updates the caller applies. Nothing here reads AsyncStorage or mutates `game`
// directly, so age/mileage/risk math and terminal-failure decisions are all independently
// testable without a full game object.

// Typical annual mileage by vehicle type — used only to back-estimate a plausible age for a used
// vehicle from its generated mileage (generateUsedMarket already picks a random mileage; this
// derives a consistent age to go with it, rather than a used vehicle having high mileage but
// showing as brand new). Authored game-balance data, not a cited statistic — commercial vehicle
// annual-mileage figures vary widely by real-world duty cycle; these are reasonable midpoints.
const TYPICAL_ANNUAL_MILEAGE_BY_TYPE = {
  "E-Bike": 6000,
  "Moped": 8000,
  "Cargo Van": 22000,
  "Van": 22000,
  "Sprinter": 28000,
  "Box Truck": 30000,
  "Truck": 32000,
  "Reefer Truck": 35000,
  "Dump Truck": 26000,
  "Flatbed": 30000,
  "Semi": 65000,
  "Tanker": 45000,
  "Lowboy": 28000,
};
const DEFAULT_ANNUAL_MILEAGE = 25000;

export function estimateUsedVehicleAgeDays(mileage, vehicleType) {
  const annualMileage = TYPICAL_ANNUAL_MILEAGE_BY_TYPE[vehicleType] || DEFAULT_ANNUAL_MILEAGE;
  const years = Math.max(0, (mileage || 0) / annualMileage);
  return Math.round(years * 360); // this game's own 360-day year (see economyEngine.js's dayToSeason)
}

// 0..1 terminal-risk score. Four independent contributors, each already saturating well before
// 1.0 on its own so no single factor alone can push a vehicle to failure — condition (the
// existing, already-visible stat) dominates, age/mileage/breakdown history are secondary
// pressure. A vehicle with high condition and low age/mileage always scores near 0 regardless of
// how old the save file itself is — this is what keeps a freshly bought or freshly overhauled
// vehicle safe.
const RISK_WEIGHTS = { condition: 0.45, age: 0.2, mileage: 0.2, breakdowns: 0.15 };
const HIGH_MILEAGE_REFERENCE = 300000; // saturates the mileage contributor
const OLD_AGE_REFERENCE_DAYS = 3600; // ~10 in-game years, saturates the age contributor
const HEAVY_BREAKDOWN_REFERENCE = 12; // lifetime breakdown count that saturates that contributor

export function computeTerminalRiskScore(vehicle) {
  const condition = Math.max(0, Math.min(100, vehicle?.condition ?? 100));
  const conditionRisk = (100 - condition) / 100;
  const ageRisk = Math.min(1, (vehicle?.ageDays || 0) / OLD_AGE_REFERENCE_DAYS);
  const mileageRisk = Math.min(1, (vehicle?.mileage || 0) / HIGH_MILEAGE_REFERENCE);
  const breakdownRisk = Math.min(1, (vehicle?.breakdowns || 0) / HEAVY_BREAKDOWN_REFERENCE);
  return (
    conditionRisk * RISK_WEIGHTS.condition +
    ageRisk * RISK_WEIGHTS.age +
    mileageRisk * RISK_WEIGHTS.mileage +
    breakdownRisk * RISK_WEIGHTS.breakdowns
  );
}

// Save migration helper. Existing warning timestamps must survive ordinary reloads or the
// minimum-warning countdown would restart every time the app opens. Missing/corrupt timestamps
// still become null so pre-lifecycle saves receive the full warning period.
export function normalizeVehicleLifecycleFields(vehicle, { estimateAge = estimateUsedVehicleAgeDays } = {}) {
  const v = vehicle || {};
  if (typeof v.ageDays !== "number" || !Number.isFinite(v.ageDays)) {
    v.ageDays = estimateAge(v.mileage || 0, v.type);
  }
  if (typeof v.terminalRiskScore !== "number" || !Number.isFinite(v.terminalRiskScore)) {
    v.terminalRiskScore = 0;
  }
  if (typeof v.terminalRiskWarnedDay !== "number" || !Number.isFinite(v.terminalRiskWarnedDay)) {
    v.terminalRiskWarnedDay = null;
  }
  if (!Array.isArray(v.serviceHistory)) v.serviceHistory = [];
  return v;
}

export const TERMINAL_WARNING_THRESHOLD = 0.6;
// Minimum days a vehicle must have been visibly at/above the warning threshold before terminal
// failure can actually roll — this is the "always has a visible warning first" guarantee: no
// vehicle can fail the same day it first crosses into risk territory.
export const TERMINAL_MIN_WARNING_DAYS = 5;
// Once past the minimum warning period, daily failure chance scales with how far past the
// threshold the score is, capped at 5%/day — a vehicle deep in the red for weeks eventually
// fails, but even the worst case isn't a coin-flip any single day.
const TERMINAL_MAX_DAILY_CHANCE = 0.05;

// Picks the most fitting terminal-failure cause given which risk factor is driving the score —
// so "why did this happen" always has a specific, consistent answer rather than a random pick
// unrelated to the vehicle's actual condition.
export function pickTerminalFailureCause(vehicle) {
  const condition = Math.max(0, Math.min(100, vehicle?.condition ?? 100));
  const ageDays = vehicle?.ageDays || 0;
  const mileage = vehicle?.mileage || 0;
  const breakdowns = vehicle?.breakdowns || 0;
  const inspectionOverdueDays = vehicle?.inspectionOverdueDays || 0;

  if (inspectionOverdueDays >= 14) {
    return { cause: "failed_inspection", label: "Failed a mandatory safety inspection and cannot be legally re-certified" };
  }
  if (condition < 20 && breakdowns >= 6) {
    return { cause: "frame_damage", label: "Cumulative collision and frame damage made the vehicle unsafe to operate" };
  }
  if (mileage >= HIGH_MILEAGE_REFERENCE * 0.8 || ageDays >= OLD_AGE_REFERENCE_DAYS * 0.85) {
    return { cause: vehicle?.fuelType === "Charge" ? "battery_failure" : "engine_failure", label: vehicle?.fuelType === "Charge" ? "Catastrophic battery pack failure — beyond economical repair" : "Catastrophic engine failure — beyond economical repair" };
  }
  if (ageDays >= OLD_AGE_REFERENCE_DAYS * 0.6) {
    return { cause: "obsolete_parts", label: "Replacement parts are no longer available for this aging model" };
  }
  return { cause: "transmission_failure", label: "Catastrophic transmission failure — beyond economical repair" };
}

// Called once per vehicle per day. Returns the field updates the caller should apply — never
// mutates `vehicle` itself, so it's trivially testable and the caller stays in full control of
// when/whether to apply the result (e.g. skipping vehicles mid-repair).
//
// `rng` defaults to Math.random but is injectable for deterministic tests.
export function tickVehicleLifecycle(vehicle, { day, rng = Math.random } = {}) {
  const updates = { ageDays: (vehicle.ageDays || 0) + 1 };
  const riskScore = computeTerminalRiskScore({ ...vehicle, ...updates });
  updates.terminalRiskScore = riskScore;

  if (riskScore >= TERMINAL_WARNING_THRESHOLD) {
    if (!vehicle.terminalRiskWarnedDay) {
      updates.terminalRiskWarnedDay = day;
      return { ...updates, terminalFailure: false, justWarned: true };
    }
    const daysWarned = day - vehicle.terminalRiskWarnedDay;
    if (daysWarned >= TERMINAL_MIN_WARNING_DAYS) {
      const overThreshold = riskScore - TERMINAL_WARNING_THRESHOLD;
      const dailyChance = Math.min(TERMINAL_MAX_DAILY_CHANCE, overThreshold * 0.125);
      if (rng() < dailyChance) {
        return { ...updates, terminalFailure: true, ...pickTerminalFailureCause(vehicle) };
      }
    }
  } else if (vehicle.terminalRiskWarnedDay) {
    // Recovered below the warning threshold (repaired/overhauled) — clear the warning so a
    // future re-entry into risk territory needs its own fresh minimum-warning period rather
    // than failing immediately off old accumulated warning time.
    updates.terminalRiskWarnedDay = null;
  }
  return { ...updates, terminalFailure: false };
}

// Escalating repair-cost multiplier for age/mileage — applied ONCE inside getRepairCost
// alongside (not instead of) that function's existing condition-based cost and every other
// discount it already applies. Caps at 1.6x so an old vehicle is meaningfully more expensive to
// keep running without repair cost alone making it nonsensical to ever fix.
export function computeAgeRepairCostMultiplier(vehicle) {
  const ageFactor = Math.min(1, (vehicle?.ageDays || 0) / OLD_AGE_REFERENCE_DAYS);
  const mileageFactor = Math.min(1, (vehicle?.mileage || 0) / HIGH_MILEAGE_REFERENCE);
  return 1 + Math.max(ageFactor, mileageFactor) * 0.6;
}

// Escalating downtime multiplier for age/mileage — same idea, applied once wherever repair
// downtime (repairMinsLeft-style timers) is computed.
export function computeAgeDowntimeMultiplier(vehicle) {
  const ageFactor = Math.min(1, (vehicle?.ageDays || 0) / OLD_AGE_REFERENCE_DAYS);
  const mileageFactor = Math.min(1, (vehicle?.mileage || 0) / HIGH_MILEAGE_REFERENCE);
  return 1 + Math.max(ageFactor, mileageFactor) * 0.5;
}

// Reliability decline — an additional breakdown-probability contributor from age/mileage, meant
// to be added (once) to whatever base breakdown chance a route/day already rolls, exactly the
// way computeAgeRepairCostMultiplier composes with (not replaces) getRepairCost's existing math.
export function computeAgeBreakdownRiskBonus(vehicle) {
  const ageFactor = Math.min(1, (vehicle?.ageDays || 0) / OLD_AGE_REFERENCE_DAYS);
  const mileageFactor = Math.min(1, (vehicle?.mileage || 0) / HIGH_MILEAGE_REFERENCE);
  return Math.max(ageFactor, mileageFactor) * 0.05; // up to +5 percentage points at max age/mileage
}

// Resale value (a still-working vehicle sold on the open/used market) — replaces the old flat
// `price * 0.45 * condition%` formula in confirmSellVehicle with one that also accounts for age,
// mileage, and the regional market (via the caller-supplied cost index from
// regionalEconomyEngine.js — passed in rather than imported here so this module has no
// dependency on game/company location plumbing).
const RESALE_BASE_FRACTION = 0.45;
export function computeVehicleResaleValue(vehicle, { regionalCostIndex = 1.0 } = {}) {
  const condition = Math.max(0, Math.min(100, vehicle?.condition ?? 100)) / 100;
  const ageDepreciation = 1 - Math.min(0.5, (vehicle?.ageDays || 0) / OLD_AGE_REFERENCE_DAYS * 0.5);
  const mileageDepreciation = 1 - Math.min(0.4, (vehicle?.mileage || 0) / HIGH_MILEAGE_REFERENCE * 0.4);
  const value = (vehicle?.price || 0) * RESALE_BASE_FRACTION * condition * ageDepreciation * mileageDepreciation * regionalCostIndex;
  return Math.max(0, Math.round(value));
}

// Salvage value — a vehicle being scrapped/repossessed/terminally retired, not sold running.
// Deliberately lower than resale at the same condition (a salvage yard pays for parts/scrap, not
// a working vehicle) and floors at a small nonzero amount for anything with recognizable value.
const SALVAGE_FRACTION_OF_RESALE = 0.35;
export function computeVehicleSalvageValue(vehicle, { regionalCostIndex = 1.0 } = {}) {
  const resale = computeVehicleResaleValue(vehicle, { regionalCostIndex });
  return Math.max(0, Math.round(resale * SALVAGE_FRACTION_OF_RESALE));
}

export function appendServiceHistory(vehicle, entry) {
  const history = Array.isArray(vehicle.serviceHistory) ? vehicle.serviceHistory.slice() : [];
  history.push(entry);
  if (history.length > 30) history.shift();
  return history;
}
