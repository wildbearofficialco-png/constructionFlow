// Economy Engine
// Global macro economy affecting prices, wages, interest rates, and seasons.
// All costs in the game scale off these modifiers — nothing is hard-coded.

import { uid, rand, pick, clamp, addLog } from "./utils.js";

const SEASONS = ["Spring", "Summer", "Fall", "Winter"];

const SEASONAL_DEMAND = {
  fleet:        { Spring: 1.05, Summer: 1.15, Fall: 1.10, Winter: 0.85 },
  construction: { Spring: 1.15, Summer: 1.20, Fall: 1.00, Winter: 0.75 },
  restaurant:   { Spring: 1.00, Summer: 1.10, Fall: 1.05, Winter: 0.90 },
  realestate:   { Spring: 1.15, Summer: 1.05, Fall: 1.00, Winter: 0.90 },
};

export const ECONOMY_EVENTS = [
  { id: "recession",      label: "Economic Recession",    weight: 2, duration: [30, 60], effects: { inflationMod: -0.3, demandMod: -0.2, wageMod: -0.05, fuelMod: -0.1 } },
  { id: "boom",           label: "Economic Boom",         weight: 3, duration: [20, 45], effects: { inflationMod: +0.4, demandMod: +0.25, wageMod: +0.08, fuelMod: +0.05 } },
  { id: "fuel_crisis",    label: "Fuel Price Spike",      weight: 4, duration: [10, 25], effects: { fuelMod: +0.45, demandMod: -0.08, inflationMod: +0.1 } },
  { id: "supply_shock",   label: "Supply Chain Shock",    weight: 3, duration: [14, 30], effects: { ingredientMod: +0.3, inventoryMod: +0.2, inflationMod: +0.15 } },
  { id: "labor_tight",    label: "Labor Market Tightening", weight: 3, duration: [20, 40], effects: { wageMod: +0.12, demandMod: +0.05 } },
  { id: "rate_hike",      label: "Interest Rate Hike",   weight: 2, duration: [30, 60], effects: { interestRateMod: +0.025, demandMod: -0.05 } },
  { id: "consumer_conf",  label: "High Consumer Confidence", weight: 4, duration: [15, 35], effects: { demandMod: +0.15, wageMod: +0.03 } },
];

function dayToSeason(day) {
  const dayInYear = (day % 360) + 1;
  if (dayInYear <= 90) return "Spring";
  if (dayInYear <= 180) return "Summer";
  if (dayInYear <= 270) return "Fall";
  return "Winter";
}

export function initEconomy(game) {
  if (game.economy) return;
  game.economy = {
    inflationRate: 0.03,
    fuelPriceIndex: 1.0,
    ingredientPriceIndex: 1.0,
    inventoryPriceIndex: 1.0,
    interestRate: 0.065,
    wagePressureIndex: 1.0,
    demandIndex: 1.0,
    season: dayToSeason(game.day || 0),
    activeEvent: null,
    activeEventDaysLeft: 0,
    lastEventDay: 0,
    eventHistory: [],
    totalInflation: 1.0,
  };
}

export function tickEconomy(game) {
  if (!game.economy) initEconomy(game);
  const eco = game.economy;
  const day = game.day || 0;

  eco.season = dayToSeason(day);

  // Decay active event
  if (eco.activeEvent && eco.activeEventDaysLeft > 0) {
    eco.activeEventDaysLeft -= 1;
    if (eco.activeEventDaysLeft === 0) {
      addLog(game, `Economy: "${eco.activeEvent.label}" has ended.`);
      eco.activeEvent = null;
    }
  }

  // Possibly trigger a new economy event (3% daily chance, min 20 days between events)
  if (!eco.activeEvent && day - (eco.lastEventDay || 0) >= 20 && Math.random() < 0.03) {
    const totalWeight = ECONOMY_EVENTS.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = null;
    for (const ev of ECONOMY_EVENTS) {
      roll -= ev.weight;
      if (roll <= 0) { chosen = ev; break; }
    }
    if (chosen) {
      eco.activeEvent = chosen;
      eco.activeEventDaysLeft = rand(chosen.duration[0], chosen.duration[1]);
      eco.lastEventDay = day;
      eco.eventHistory.unshift({ id: uid(), label: chosen.label, day });
      if (eco.eventHistory.length > 10) eco.eventHistory.pop();
      addLog(game, `Economy shift: "${chosen.label}" — lasting ~${eco.activeEventDaysLeft} days.`);
    }
  }

  const eff = eco.activeEvent?.effects || {};

  // Inflation drift: ±0.002% daily, pulled toward baseline 3%
  const infTarget = 0.03 + (eff.inflationMod || 0);
  eco.inflationRate = clamp(eco.inflationRate + (infTarget - eco.inflationRate) * 0.04 + (Math.random() - 0.5) * 0.001, 0.0, 0.12);
  eco.totalInflation = clamp(eco.totalInflation * (1 + eco.inflationRate / 360), 1.0, 2.5);

  // Fuel price index: random walk clamped 0.7–1.8, influenced by events
  const fuelTarget = 1.0 + (eff.fuelMod || 0);
  eco.fuelPriceIndex = clamp(eco.fuelPriceIndex + (fuelTarget - eco.fuelPriceIndex) * 0.03 + (Math.random() - 0.5) * 0.015, 0.70, 1.80);

  // Ingredient prices
  const ingTarget = 1.0 + (eff.ingredientMod || 0);
  eco.ingredientPriceIndex = clamp(eco.ingredientPriceIndex + (ingTarget - eco.ingredientPriceIndex) * 0.025 + (Math.random() - 0.5) * 0.008, 0.75, 1.70);

  // Inventory/supply prices
  const invTarget = 1.0 + (eff.inventoryMod || 0);
  eco.inventoryPriceIndex = clamp(eco.inventoryPriceIndex + (invTarget - eco.inventoryPriceIndex) * 0.02 + (Math.random() - 0.5) * 0.006, 0.80, 1.60);

  // Wage pressure
  const wageTarget = 1.0 + (eff.wageMod || 0);
  eco.wagePressureIndex = clamp(eco.wagePressureIndex + (wageTarget - eco.wagePressureIndex) * 0.02 + (Math.random() - 0.5) * 0.004, 0.85, 1.40);

  // Interest rate
  const irTarget = 0.065 + (eff.interestRateMod || 0);
  eco.interestRate = clamp(eco.interestRate + (irTarget - eco.interestRate) * 0.01, 0.02, 0.18);

  // Demand index
  const demandTarget = 1.0 + (eff.demandMod || 0);
  eco.demandIndex = clamp(eco.demandIndex + (demandTarget - eco.demandIndex) * 0.05 + (Math.random() - 0.5) * 0.01, 0.60, 1.50);
}

export function getEconomyModifiers(game) {
  const eco = game.economy;
  if (!eco) return { fuel: 1.0, ingredients: 1.0, wages: 1.0, demand: 1.0, interest: 0.065, inventory: 1.0 };
  return {
    fuel: eco.fuelPriceIndex,
    ingredients: eco.ingredientPriceIndex,
    wages: eco.wagePressureIndex,
    demand: eco.demandIndex,
    interest: eco.interestRate,
    inventory: eco.inventoryPriceIndex,
    inflation: eco.inflationRate,
    totalInflation: eco.totalInflation,
    season: eco.season,
    activeEvent: eco.activeEvent?.label || null,
    activeEventDaysLeft: eco.activeEventDaysLeft || 0,
  };
}

export function applySeasonalEffects(game, businessType) {
  const eco = game.economy;
  if (!eco) return 1.0;
  const profile = SEASONAL_DEMAND[businessType] || { Spring: 1.0, Summer: 1.0, Fall: 1.0, Winter: 1.0 };
  const seasonMod = profile[eco.season] || 1.0;
  return seasonMod * (eco.demandIndex || 1.0);
}
