// Weather & Route Conditions System
// Daily weather affects delivery times, fuel costs, breakdown risk, and customer demand.
// Integrates with equipmentWear (breakdown mod), demandPricing (demand index),
// financialLedger (fuel surcharge), and randomEvents (storm disruption).

import { clamp, rand, pick, addLog } from "./utils.js";

export const WEATHER_TYPES = [
  { id: "clear",    label: "Clear",      icon: "☀️",  timeMult: 1.00, fuelMult: 1.00, breakdownMod: 0.00, demandMod: 1.00, weight: 35 },
  { id: "cloudy",   label: "Overcast",   icon: "⛅",  timeMult: 1.02, fuelMult: 1.00, breakdownMod: 0.00, demandMod: 0.98, weight: 20 },
  { id: "rain",     label: "Rain",       icon: "🌧️", timeMult: 1.15, fuelMult: 1.05, breakdownMod: 0.02, demandMod: 0.92, weight: 20 },
  { id: "storm",    label: "Storm",      icon: "⛈️", timeMult: 1.35, fuelMult: 1.15, breakdownMod: 0.05, demandMod: 0.80, weight: 8  },
  { id: "snow",     label: "Snow",       icon: "🌨️", timeMult: 1.50, fuelMult: 1.25, breakdownMod: 0.08, demandMod: 0.75, weight: 7  },
  { id: "fog",      label: "Dense Fog",  icon: "🌫️", timeMult: 1.25, fuelMult: 1.02, breakdownMod: 0.03, demandMod: 0.88, weight: 6  },
  { id: "heatwave", label: "Heat Wave",  icon: "🔥",  timeMult: 1.08, fuelMult: 1.12, breakdownMod: 0.04, demandMod: 1.05, weight: 4  },
];

// Season biases: each season shifts the probability of certain weather
const SEASON_WEATHER_BIAS = {
  Spring:  { rain: 2.0, storm: 1.5, snow: 0.2, clear: 0.9, fog: 1.2 },
  Summer:  { heatwave: 3.0, storm: 1.8, clear: 1.4, snow: 0, rain: 0.8 },
  Fall:    { rain: 1.5, fog: 2.0, storm: 1.2, clear: 0.8, snow: 0.5 },
  Winter:  { snow: 4.0, fog: 1.5, clear: 0.6, heatwave: 0, storm: 0.8 },
};

// Road condition modifiers layered on top of weather
const ROAD_CONDITIONS = [
  { id: "normal",      label: "Normal",        timeMod: 1.00, fuelMod: 1.00, weight: 60 },
  { id: "roadwork",    label: "Road Works",    timeMod: 1.18, fuelMod: 1.03, weight: 15 },
  { id: "accident",    label: "Accident",      timeMod: 1.30, fuelMod: 1.05, weight: 10 },
  { id: "flooding",    label: "Flooding",      timeMod: 1.45, fuelMod: 1.15, weight: 5  },
  { id: "detour",      label: "Detour",        timeMod: 1.20, fuelMod: 1.08, weight: 10 },
];

function pickWeighted(options, season) {
  const bias = (season && SEASON_WEATHER_BIAS[season]) || {};
  const weighted = options.map((o) => ({
    ...o,
    effectiveWeight: (o.weight || 1) * (bias[o.id] ?? 1.0),
  }));
  const total = weighted.reduce((s, o) => s + o.effectiveWeight, 0);
  let r = Math.random() * total;
  for (const o of weighted) {
    r -= o.effectiveWeight;
    if (r <= 0) return o;
  }
  return weighted[0];
}

export function initWeather(game) {
  if (game.weather) return;
  game.weather = {
    current: "clear",
    icon: "☀️",
    label: "Clear",
    daysSinceChange: 0,
    roadCondition: "normal",
    roadLabel: "Normal",
    fuelSurchargeActive: false,
    weatherHistory: [],
  };
}

export function tickWeather(game) {
  initWeather(game);
  const w = game.weather;
  const season = game.economy?.season || "Summer";

  w.daysSinceChange = (w.daysSinceChange || 0) + 1;

  // Weather persists 1–4 days; chance of change increases each day
  const changeChance = clamp((w.daysSinceChange - 1) * 0.30, 0.10, 0.90);
  if (Math.random() < changeChance) {
    const next = pickWeighted(WEATHER_TYPES, season);
    const prevId = w.current;
    w.current = next.id;
    w.icon = next.icon;
    w.label = next.label;
    w.daysSinceChange = 0;

    // Log notable weather changes
    if (next.id === "storm" || next.id === "snow") {
      addLog(game, `${next.icon} Weather alert: ${next.label} moving in — deliveries will be slower and fuel costs up.`);
    } else if ((prevId === "storm" || prevId === "snow") && next.id === "clear") {
      addLog(game, "☀️ Skies cleared up — back to normal delivery conditions.");
    }

    w.weatherHistory = [...(w.weatherHistory || []).slice(-13), { day: game.day || 0, id: next.id, label: next.label }];
  }

  // Road conditions refresh daily
  const road = pickWeighted(ROAD_CONDITIONS, null);
  w.roadCondition = road.id;
  w.roadLabel = road.label;
  if (road.id !== "normal" && Math.random() < 0.4) {
    addLog(game, `🚧 ${road.label} reported on main routes today.`);
  }

  // Fuel surcharge: storm or heatwave triggers surcharge
  const weatherDef = WEATHER_TYPES.find((t) => t.id === w.current);
  w.fuelSurchargeActive = (weatherDef?.fuelMult || 1) > 1.10;

  // Apply demand index nudge from weather into economy
  if (game.economy && weatherDef) {
    const existingDemand = game.economy.demandIndex || 1.0;
    game.economy.demandIndex = clamp(
      existingDemand * 0.85 + weatherDef.demandMod * 0.15,
      0.50, 1.80
    );
  }
}

export function getWeatherEffects(game) {
  const w = game.weather || { current: "clear" };
  const weatherDef = WEATHER_TYPES.find((t) => t.id === w.current) || WEATHER_TYPES[0];
  const roadDef = ROAD_CONDITIONS.find((r) => r.id === (w.roadCondition || "normal")) || ROAD_CONDITIONS[0];

  return {
    weatherId: w.current,
    weatherLabel: w.label || "Clear",
    weatherIcon: w.icon || "☀️",
    roadCondition: w.roadCondition || "normal",
    roadLabel: w.roadLabel || "Normal",
    timeMult: weatherDef.timeMult * roadDef.timeMod,
    fuelMult: weatherDef.fuelMult * roadDef.fuelMod,
    breakdownMod: weatherDef.breakdownMod,
    demandMod: weatherDef.demandMod,
    fuelSurchargeActive: w.fuelSurchargeActive || false,
    severe: weatherDef.id === "storm" || weatherDef.id === "snow",
  };
}

// Call this when a route completes or when computing ETA
export function applyWeatherToRoute(game, route) {
  const fx = getWeatherEffects(game);
  if (fx.timeMult <= 1.00) return route;

  // Extend remaining duration proportional to weather
  if (route.remainingSec && route.remainingSec > 0) {
    route.remainingSec = Math.round(route.remainingSec * fx.timeMult);
  }
  if (route.totalSec && !route._weatherApplied) {
    route.totalSec = Math.round(route.totalSec * fx.timeMult);
    route._weatherApplied = fx.weatherId;
  }

  // Add fuel surcharge to cost if severe
  if (fx.severe && route.fuelCost) {
    route.fuelCost = Math.round(route.fuelCost * fx.fuelMult);
  }

  return route;
}

// Increase breakdown probability based on current weather
export function getWeatherBreakdownBonus(game) {
  const fx = getWeatherEffects(game);
  return fx.breakdownMod;
}

// For construction: bad weather delays project by days
export function getConstructionWeatherDelay(game) {
  const fx = getWeatherEffects(game);
  if (fx.severe) return rand(1, 3);
  if (fx.timeMult > 1.10) return rand(0, 1);
  return 0;
}

// For restaurant: weather affects foot traffic / customer volume
export function getRestaurantWeatherTrafficMod(game) {
  const fx = getWeatherEffects(game);
  // Storm/snow = fewer walk-ins; heatwave = more drink/light meal demand
  if (fx.weatherId === "storm" || fx.weatherId === "snow") return 0.70;
  if (fx.weatherId === "heatwave") return 1.15;
  if (fx.weatherId === "rain" || fx.weatherId === "fog") return 0.88;
  return 1.00;
}

// For real estate: weather affects showings and tenant satisfaction
export function getRealEstateWeatherMod(game) {
  const fx = getWeatherEffects(game);
  if (fx.severe) return { showings: 0.60, satisfaction: -2 };
  if (fx.weatherId === "rain") return { showings: 0.85, satisfaction: -1 };
  if (fx.weatherId === "clear") return { showings: 1.10, satisfaction: 1 };
  return { showings: 1.00, satisfaction: 0 };
}

export function getWeatherSummary(game) {
  const fx = getWeatherEffects(game);
  return {
    ...fx,
    history: (game.weather?.weatherHistory || []).slice(-7),
    daysSinceChange: game.weather?.daysSinceChange || 0,
  };
}
