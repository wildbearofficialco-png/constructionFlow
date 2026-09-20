import {
  computeRegionalEconMult,
  getRegionalCostIndex,
  getRegionalWageIndex,
  getStateEconomySnapshot,
} from "./regionalEconomyEngine.js";

const CONSTRUCTION_DIVISION_ID = "construction_heavy_haul";

export function getConstructionStateCode(game) {
  return game?.homeStateCode || game?.homeState || "OR";
}

export function getConstructionRegionalSnapshot(game) {
  const stateCode = getConstructionStateCode(game);
  const cycleMult = game?.economy?.demandIndex || 1.0;
  const macroWage = game?.economy?.wagePressureIndex || 1.0;
  const macroMaterials = game?.economy?.inventoryPriceIndex || 1.0;
  const macroInterest = game?.economy?.interestRate || 0.065;
  const state = getStateEconomySnapshot(stateCode, { divisionId: CONSTRUCTION_DIVISION_ID });

  return {
    stateCode,
    stateName: state.name,
    contractValueMult: computeRegionalEconMult({
      stateCode,
      divisionId: CONSTRUCTION_DIVISION_ID,
      cycleMult,
    }),
    materialPriceMult: clamp(getRegionalCostIndex(stateCode) * macroMaterials, 0.65, 1.65),
    wageMult: clamp(getRegionalWageIndex(stateCode) * macroWage, 0.75, 1.55),
    lendingEconomyMult: clamp(cycleMult * (1 - Math.max(-0.04, Math.min(0.08, macroInterest - 0.065))), 0.70, 1.40),
    costIndex: state.costIndex,
    wageIndex: state.wageIndex,
    weatherRisk: state.weatherRisk,
    sourceTier: state.sourceTier,
  };
}

export function applyRegionalContractValue(baseValue, game) {
  return Math.max(1, Math.round((baseValue || 0) * getConstructionRegionalSnapshot(game).contractValueMult));
}

export function applyRegionalMaterialPrice(basePrice, game) {
  return Math.max(1, Math.round((basePrice || 0) * getConstructionRegionalSnapshot(game).materialPriceMult));
}

export function applyRegionalWage(baseWage, game) {
  return Math.max(1, Math.round((baseWage || 0) * getConstructionRegionalSnapshot(game).wageMult));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
