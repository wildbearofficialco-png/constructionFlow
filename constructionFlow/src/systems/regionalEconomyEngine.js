// FleetFlow Regional Economy Engine — Phase 2, Phase B ("Versioned 2026 regional economy
// engine"). Pure helper functions over the frozen STATE_ECONOMY_2026 dataset
// (src/data/regionalEconomy2026.js). Nothing here mutates game state or reads/writes AsyncStorage
// — every function here is a plain (input) -> output calculation, which is what makes each one
// independently unit-testable and safe to call from anywhere in FleetFlowScreen.js without
// worrying about side effects.
//
// effective value = national base × state cost/wage index × market/metro index × economic cycle
//                    × industry demand
//
// The "one multiplier application per transaction" requirement (Phase 2 handoff, Phase B) is
// enforced by convention here: each exported function is the SINGLE place a given cost category's
// regional adjustment is computed. A call site should call exactly one of these per transaction
// and multiply it into the base price/wage/etc. exactly once — never chain two of these functions
// together on the same dollar amount, and never apply a raw STATE_ECONOMY_2026 field directly at
// a call site (always go through one of these functions so the clamping/fallback behavior below
// is guaranteed).

import { STATE_ECONOMY_2026, ECONOMY_BALANCE, ECONOMY_VERSION } from "../data/regionalEconomy2026";

export { ECONOMY_VERSION };

// Every function below falls back to this neutral, no-op profile for an unknown/missing state
// code (a new save mid-onboarding before a home state is chosen, a corrupted stateCode, a branch
// opened before this system existed) — regional economy always degrades to "no adjustment",
// never to a crash or an undefined multiplier.
const NEUTRAL_PROFILE = {
  code: null,
  name: "Unknown",
  censusRegion: null,
  costIndex: 1.0,
  wageIndex: 1.0,
  fuelIndex: 1.0,
  dieselIndex: 1.0,
  insuranceIndex: 1.0,
  vehicleTaxRate: 0.0,
  registrationBaseFee: 100,
  weatherRiskIndex: 1.0,
  industryDemand: {},
  sourceTier: "neutral",
};

export function getStateEconomicProfile(stateCode) {
  return STATE_ECONOMY_2026[stateCode] || NEUTRAL_PROFILE;
}

function clampBalance(mult) {
  return Math.min(ECONOMY_BALANCE.MAX_COMBINED_MULT, Math.max(ECONOMY_BALANCE.MIN_COMBINED_MULT, mult));
}

// Cost-of-living index for property/rent/general overhead pricing (BEA RPP-derived).
export function getRegionalCostIndex(stateCode) {
  return getStateEconomicProfile(stateCode).costIndex;
}

// Wage index for driver/staff pay (BLS OEWS-derived).
export function getRegionalWageIndex(stateCode) {
  return getStateEconomicProfile(stateCode).wageIndex;
}

// Fuel index — `fuelType` "Charge" gets a much smaller regional swing than liquid fuel since
// electricity rates vary far less dramatically state-to-state than gas/diesel taxes+transport do
// in this dataset; everything else uses the diesel index for heavier classes, gas index otherwise.
export function getRegionalFuelIndex(stateCode, fuelType = "Gas") {
  const profile = getStateEconomicProfile(stateCode);
  if (fuelType === "Charge") return 1.0 + (profile.fuelIndex - 1.0) * 0.35;
  if (fuelType === "Diesel") return profile.dieselIndex;
  return profile.fuelIndex;
}

export function getRegionalInsuranceIndex(stateCode) {
  return getStateEconomicProfile(stateCode).insuranceIndex;
}

// Vehicle purchase-time tax/registration burden as a single combined multiplier (1 + tax rate),
// separate from registrationBaseFee (a flat periodic cost, not a purchase-time multiplier).
export function getRegionalVehicleTaxMultiplier(stateCode) {
  return 1.0 + getStateEconomicProfile(stateCode).vehicleTaxRate;
}

export function getRegionalRegistrationFee(stateCode) {
  return getStateEconomicProfile(stateCode).registrationBaseFee;
}

export function getRegionalWeatherRisk(stateCode) {
  return getStateEconomicProfile(stateCode).weatherRiskIndex;
}

// Industry demand multiplier for one canonical division in one state — falls back to 1.0
// (neutral) for a state/division combination the authored data doesn't specifically call out.
export function getRegionalIndustryDemand(stateCode, divisionId) {
  const profile = getStateEconomicProfile(stateCode);
  if (!divisionId) return 1.0;
  return profile.industryDemand?.[divisionId] ?? 1.0;
}

// The one composed multiplier for branch daily revenue: state cost index (as a demand proxy —
// pricier regions support pricier contracts) × industry demand for the branch's specialization ×
// the caller-supplied economic-cycle multiplier (e.g. the existing global economyEngine.js
// demand index, or 1.0 if the caller doesn't track one). Clamped to ECONOMY_BALANCE bounds so no
// state/division/cycle combination can push a branch to "impossible" or "runaway" — every
// location stays a viable, if different, business per the handoff's "different but balanced"
// requirement.
//
// Call this exactly ONCE per branch per day and multiply it into revenue — it already contains
// every regional factor; do not additionally multiply by getRegionalCostIndex/getRegionalIndustryDemand
// separately on the same revenue figure (that would double-scale).
export function computeRegionalEconMult({ stateCode, divisionId = null, cycleMult = 1.0 } = {}) {
  const costFactor = getRegionalCostIndex(stateCode);
  const demandFactor = getRegionalIndustryDemand(stateCode, divisionId);
  const raw = costFactor * demandFactor * (Number.isFinite(cycleMult) ? cycleMult : 1.0);
  return clampBalance(raw);
}

// The one composed multiplier for a purchase-time dollar amount (vehicles, branch openings,
// facility upgrades) in a given state: cost-of-living index × (1 + vehicle tax rate). Call once
// per purchase and multiply into the already-level/repeat-scaled base price
// (getVehiclePurchaseCost / getBranchPurchaseCost / getPropertyPurchaseCost in
// fleetflowLateGameEconomyHelpers.js) — never apply costIndex a second time elsewhere in the same
// transaction.
export function computeRegionalPurchaseMultiplier(stateCode, { includeVehicleTax = false } = {}) {
  const cost = getRegionalCostIndex(stateCode);
  const taxMult = includeVehicleTax ? getRegionalVehicleTaxMultiplier(stateCode) : 1.0;
  return clampBalance(cost * taxMult);
}

// Resolve the state a vehicle/worker/cost calculation should use: its own branch's stateCode if
// assigned to one, otherwise the company's home state (HQ), otherwise null (neutral profile).
// Centralizing this resolution is what keeps every regional lookup site consistent — a vehicle
// moved HQ<->branch always prices off wherever it currently is, never a stale location.
export function resolveOperatingStateCode(game, entity) {
  if (entity?.branchId) {
    const branch = (game?.branches || []).find((b) => b.id === entity.branchId);
    if (branch?.stateCode) return branch.stateCode;
  }
  return game?.homeState || null;
}

// A compact, deterministic snapshot of every derived multiplier for one state — used by the
// balance-report test and available for debug/UI display without recomputing each field by hand.
export function getStateEconomySnapshot(stateCode, { divisionId = null, fuelType = "Gas" } = {}) {
  const profile = getStateEconomicProfile(stateCode);
  return {
    code: profile.code,
    name: profile.name,
    costIndex: profile.costIndex,
    wageIndex: profile.wageIndex,
    fuelIndex: getRegionalFuelIndex(stateCode, fuelType),
    insuranceIndex: profile.insuranceIndex,
    vehicleTaxMultiplier: getRegionalVehicleTaxMultiplier(stateCode),
    registrationFee: profile.registrationBaseFee,
    weatherRisk: profile.weatherRiskIndex,
    econMult: computeRegionalEconMult({ stateCode, divisionId }),
    purchaseMultiplier: computeRegionalPurchaseMultiplier(stateCode, { includeVehicleTax: true }),
    sourceTier: profile.sourceTier,
  };
}
