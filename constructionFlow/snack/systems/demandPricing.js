// Demand & Pricing Engine
// Computes real-time price multipliers from reputation, season, competition,
// time-of-day, customer satisfaction, and economy. Every revenue event in
// every game should pass through getPriceMultiplier() before finalizing.

import { clamp, rand } from "./utils.js";

const TIME_OF_DAY_DEMAND = {
  // hour (0–23) → demand index
  0: 0.55, 1: 0.50, 2: 0.45, 3: 0.45, 4: 0.50, 5: 0.65,
  6: 0.80, 7: 0.90, 8: 1.00, 9: 1.05, 10: 1.10, 11: 1.15,
  12: 1.20, 13: 1.10, 14: 1.05, 15: 1.10, 16: 1.15, 17: 1.20,
  18: 1.15, 19: 1.10, 20: 1.00, 21: 0.90, 22: 0.75, 23: 0.65,
};

const BUSINESS_PRICE_FLOORS = {
  fleet:        0.60,
  construction: 0.55,
  restaurant:   0.50,
  realestate:   0.70,
};

const BUSINESS_PRICE_CEILINGS = {
  fleet:        2.00,
  construction: 2.20,
  restaurant:   1.80,
  realestate:   1.60,
};

export const PRICING_STRATEGIES = [
  { id: "economy",    label: "Economy",    baseMult: 0.82, demandSensitivity: 0.6, notes: "Lower price, higher volume" },
  { id: "standard",  label: "Standard",   baseMult: 1.00, demandSensitivity: 1.0, notes: "Market rate" },
  { id: "premium",   label: "Premium",    baseMult: 1.22, demandSensitivity: 1.3, notes: "Higher price, requires good rep" },
  { id: "dynamic",   label: "Dynamic",    baseMult: 1.00, demandSensitivity: 1.8, notes: "Floats with demand — best average" },
  { id: "surge",     label: "Surge",      baseMult: 1.40, demandSensitivity: 2.2, notes: "Peak-demand pricing — alienates loyalists" },
];

export function initPricing(game) {
  if (game.pricingStrategyId) return;
  game.pricingStrategyId = "standard";
  game.priceMultiplierOverride = null;
  game.demandScore = 1.0;
  game.surgeActive = false;
  game.surgeEndHour = null;
}

function getTimeOfDayMultiplier(gameHour) {
  return TIME_OF_DAY_DEMAND[gameHour] ?? 1.0;
}

function getReputationMultiplier(reputation) {
  // 0 rep → 0.70x, 50 rep → 1.00x, 100 rep → 1.30x
  return clamp(0.70 + (reputation / 100) * 0.60, 0.70, 1.30);
}

function getCompetitionMultiplier(game) {
  const competitors = game.aiCompetitors || [];
  if (competitors.length === 0) return 1.0;
  const avgRep = competitors.reduce((s, c) => s + (c.reputation || 50), 0) / competitors.length;
  const myRep = game.reputation || 50;
  // If competitors have higher rep, our effective price is pushed down
  const delta = myRep - avgRep;
  return clamp(1.0 + delta * 0.004, 0.75, 1.25);
}

function getCustomerSatisfactionMultiplier(game) {
  const rating = game.customerRating || 3.5;
  // 1 star → 0.80x, 3.5 stars → 1.00x, 5 stars → 1.20x
  return clamp(0.80 + (rating - 1) / 4 * 0.40, 0.80, 1.20);
}

function getLoyaltyVolumeBonus(game) {
  const loyalty = game.loyaltyScore || 50;
  const repeatRate = game.repeatRate || 0.20;
  // High loyalty = more repeat customers = higher effective volume
  return clamp(1.0 + (loyalty - 50) / 200 + repeatRate * 0.3, 0.90, 1.35);
}

export function getPriceMultiplier(game, businessType, gameHour) {
  initPricing(game);

  const strategy = PRICING_STRATEGIES.find((s) => s.id === game.pricingStrategyId) || PRICING_STRATEGIES[1];
  const eco = game.economy || {};
  const demandIndex = eco.demandIndex || 1.0;
  const hour = gameHour ?? new Date().getHours();

  const repMult = getReputationMultiplier(game.reputation || 50);
  const timeMult = getTimeOfDayMultiplier(hour);
  const compMult = getCompetitionMultiplier(game);
  const satMult = getCustomerSatisfactionMultiplier(game);

  // Dynamic strategy floats with demand; others use base
  let basePrice = strategy.baseMult;
  if (strategy.id === "dynamic" || strategy.id === "surge") {
    basePrice = strategy.baseMult * (1 + (demandIndex - 1) * strategy.demandSensitivity);
  }

  const floor = BUSINESS_PRICE_FLOORS[businessType] || 0.55;
  const ceiling = BUSINESS_PRICE_CEILINGS[businessType] || 2.0;

  const raw = basePrice * repMult * timeMult * compMult * satMult * demandIndex;
  const final = clamp(raw, floor, ceiling);

  return {
    multiplier: Math.round(final * 1000) / 1000,
    breakdown: {
      strategy: basePrice,
      reputation: repMult,
      timeOfDay: timeMult,
      competition: compMult,
      satisfaction: satMult,
      demand: demandIndex,
    },
    surgeActive: strategy.id === "surge" && final > 1.30,
    demandScore: demandIndex * timeMult,
  };
}

export function getDemandScore(game, businessType, gameHour) {
  const hour = gameHour ?? new Date().getHours();
  const eco = game.economy || {};
  const seasonal = (eco.season && SEASONAL_DEMAND_BY_TYPE[businessType]?.[eco.season]) || 1.0;
  return clamp(
    getTimeOfDayMultiplier(hour) * (eco.demandIndex || 1.0) * seasonal,
    0.3, 2.0
  );
}

const SEASONAL_DEMAND_BY_TYPE = {
  fleet:        { Spring: 1.05, Summer: 1.15, Fall: 1.10, Winter: 0.85 },
  construction: { Spring: 1.15, Summer: 1.20, Fall: 1.00, Winter: 0.75 },
  restaurant:   { Spring: 1.00, Summer: 1.10, Fall: 1.05, Winter: 0.90 },
  realestate:   { Spring: 1.15, Summer: 1.05, Fall: 1.00, Winter: 0.90 },
};

export function tickDemand(game, businessType) {
  initPricing(game);
  const eco = game.economy || {};
  const seasonal = (eco.season && SEASONAL_DEMAND_BY_TYPE[businessType]?.[eco.season]) || 1.0;
  const loyaltyBonus = getLoyaltyVolumeBonus(game);
  game.demandScore = clamp((eco.demandIndex || 1.0) * seasonal * loyaltyBonus, 0.30, 2.20);
  // Surge detection: if demand > 1.4 and strategy is dynamic, flag it
  game.surgeActive = game.pricingStrategyId === "surge" && game.demandScore > 1.35;
}

export function setPricingStrategy(game, strategyId) {
  const strategy = PRICING_STRATEGIES.find((s) => s.id === strategyId);
  if (!strategy) return false;
  game.pricingStrategyId = strategyId;
  return true;
}

export function estimateRevenueImpact(game, businessType, baseRevenue) {
  const result = getPriceMultiplier(game, businessType, 12);
  const demand = game.demandScore || 1.0;
  return {
    base: Math.round(baseRevenue),
    adjusted: Math.round(baseRevenue * result.multiplier),
    demand: Math.round(demand * 100),
    breakdown: result.breakdown,
  };
}
