// FleetFlow Regional Economy — Version 2026.1 (Phase 2, Phase B)
//
// A frozen, versioned snapshot of state-level economic conditions used to differentiate where a
// player operates. Nothing here makes a live network call — the whole dataset is baked into the
// app bundle so it works fully offline, and it changes only when a developer ships a new
// ECONOMY_VERSION with a documented reason.
//
// ── Sources (retrieved 2026-09, most recent published figures at that time) ──────────────────
// - Cost of living / `costIndex`: U.S. Bureau of Economic Analysis, "Regional Price Parities by
//   State", 2024 annual release (index, national average = 100). https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area
// - Wages / `wageIndex`: U.S. Bureau of Labor Statistics, Occupational Employment and Wage
//   Statistics (OEWS), May 2024, SOC 53-3032 "Heavy and Tractor-Trailer Truck Drivers", mean
//   annual wage by state (national mean $58,240). https://www.bls.gov/oes/current/oes533032.htm
// - Fuel / `fuelIndex`, `dieselIndex`: AAA state average retail gasoline prices, late Aug/early
//   Sep 2026 (national average ≈ $4.10/gal at time of retrieval; diesel indexed off gasoline
//   using the industry-standard ~1.10x diesel/gasoline ratio, not sourced per state).
//   https://gasprices.aaa.com/
// - Vehicle tax & registration / `vehicleTaxRate`, `registrationBaseFee`: state DMV / DOR vehicle
//   sales (or use/privilege) tax rates and typical annual registration fees, compiled from state
//   revenue department summaries and the Oregon DOT "Comparison of Light Vehicle Related Taxes"
//   (Western States, Jan 2026). https://www.oregon.gov/odot
// - Insurance / `insuranceIndex`: relative ranking from 2026 commercial trucking and personal
//   auto insurance rate surveys (industry aggregator reports, e.g. Truck Writers' "Fleet
//   Insurance Rates by State" and standard consumer insurance-rate-by-state comparisons).
//
// ── Sourcing tiers (see `sourceTier` on each record) ──────────────────────────────────────────
// "anchor"            — this state's costIndex/wageIndex/fuelIndex are the actual published
//                        figures from the sources above (as retrieved 2026-09).
// "regional-estimate" — this state has no individually-verified figure in this dataset. Its
//                        values are set within its official U.S. Census Bureau region's
//                        documented range (derived from that region's anchor states), positioned
//                        by well-established relative cost-of-living/wage patterns for that
//                        state. This is a modeling approximation, not a claim of BEA/BLS
//                        precision for that specific state — flagged here so a future update
//                        replacing it with a verified anchor figure is a clear, trackable task.
//
// Every index is expressed relative to a national baseline of 1.0. `industryDemand` multipliers
// are authored game-balance data (not drawn from the sources above — the handoff doc scopes
// external sourcing to cost/wage/fuel/tax data) reflecting each state's real-world economic
// character (e.g. Montana's demand skews toward Industrial Resources/Construction, not Cold
// Chain) so branches feel like they're really operating in that state without inventing a new
// vehicle taxonomy — the division ids below are exactly VEHICLE_DIVISIONS from vehicleDivisions.js.
// `weatherRiskIndex` is likewise an authored design parameter (not a cited statistic): states
// with harsher winters/mountain terrain (e.g. Montana, North Dakota, Wyoming) run higher than
// mild, low-terrain-risk states (e.g. Florida, California's coast) — it feeds a small operating
// risk modifier, never a "this state is just worse" penalty (see ECONOMY_BALANCE constants below
// for the caps that guarantee that).

export const ECONOMY_VERSION = "2026.1";
export const ECONOMY_SOURCE_YEAR = 2024; // most recent published BEA RPP / BLS OEWS data as of retrieval
export const ECONOMY_RETRIEVED = "2026-09";

const DIVISION_IDS = [
  "local_last_mile",
  "retail_distribution",
  "cold_chain",
  "medical_logistics",
  "construction_heavy_haul",
  "industrial_resources",
  "specialized_logistics",
];

function demand(overrides = {}) {
  const base = {};
  DIVISION_IDS.forEach((id) => { base[id] = 1.0; });
  return { ...base, ...overrides };
}

// code, name, censusRegion (Northeast | Midwest | South | West — the standard U.S. Census
// Bureau classification, used only to group states for the regional-estimate tier, not a new
// taxonomy), costIndex, wageIndex, fuelIndex, dieselIndex, insuranceIndex, vehicleTaxRate
// (decimal, sales/use/privilege tax applied at vehicle purchase), registrationBaseFee (typical
// annual-equivalent $, flat), weatherRiskIndex, industryDemand (per canonical division),
// sourceTier.
export const STATE_ECONOMY_2026 = {
  // ── West ──────────────────────────────────────────────────────────────────────────────────
  CA: { code: "CA", name: "California", censusRegion: "West", costIndex: 1.107, wageIndex: 1.10, fuelIndex: 1.38, dieselIndex: 1.45, insuranceIndex: 1.35, vehicleTaxRate: 0.0725, registrationBaseFee: 240, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.20, cold_chain: 1.20, specialized_logistics: 1.15, local_last_mile: 1.15 }), sourceTier: "anchor" },
  OR: { code: "OR", name: "Oregon", censusRegion: "West", costIndex: 1.034, wageIndex: 1.02, fuelIndex: 1.13, dieselIndex: 1.20, insuranceIndex: 1.00, vehicleTaxRate: 0.005, registrationBaseFee: 150, weatherRiskIndex: 1.05, industryDemand: demand({ industrial_resources: 1.25, construction_heavy_haul: 1.10, local_last_mile: 1.05 }), sourceTier: "anchor" },
  WA: { code: "WA", name: "Washington", censusRegion: "West", costIndex: 1.075, wageIndex: 1.08, fuelIndex: 1.25, dieselIndex: 1.32, insuranceIndex: 1.05, vehicleTaxRate: 0.065, registrationBaseFee: 180, weatherRiskIndex: 1.00, industryDemand: demand({ retail_distribution: 1.20, industrial_resources: 1.10, specialized_logistics: 1.05 }), sourceTier: "anchor" },
  NV: { code: "NV", name: "Nevada", censusRegion: "West", costIndex: 0.98, wageIndex: 0.97, fuelIndex: 1.10, dieselIndex: 1.17, insuranceIndex: 1.20, vehicleTaxRate: 0.0685, registrationBaseFee: 165, weatherRiskIndex: 0.90, industryDemand: demand({ specialized_logistics: 1.15, retail_distribution: 1.10 }), sourceTier: "regional-estimate" },
  AZ: { code: "AZ", name: "Arizona", censusRegion: "West", costIndex: 0.97, wageIndex: 0.95, fuelIndex: 1.02, dieselIndex: 1.08, insuranceIndex: 1.05, vehicleTaxRate: 0.056, registrationBaseFee: 130, weatherRiskIndex: 0.90, industryDemand: demand({ construction_heavy_haul: 1.15, industrial_resources: 1.10 }), sourceTier: "regional-estimate" },
  CO: { code: "CO", name: "Colorado", censusRegion: "West", costIndex: 1.02, wageIndex: 1.02, fuelIndex: 0.98, dieselIndex: 1.04, insuranceIndex: 1.22, vehicleTaxRate: 0.029, registrationBaseFee: 145, weatherRiskIndex: 1.15, industryDemand: demand({ construction_heavy_haul: 1.15, industrial_resources: 1.10 }), sourceTier: "regional-estimate" },
  UT: { code: "UT", name: "Utah", censusRegion: "West", costIndex: 0.97, wageIndex: 0.96, fuelIndex: 0.99, dieselIndex: 1.05, insuranceIndex: 0.95, vehicleTaxRate: 0.0685, registrationBaseFee: 120, weatherRiskIndex: 1.05, industryDemand: demand({ construction_heavy_haul: 1.10, industrial_resources: 1.10 }), sourceTier: "regional-estimate" },
  NM: { code: "NM", name: "New Mexico", censusRegion: "West", costIndex: 0.93, wageIndex: 0.93, fuelIndex: 1.00, dieselIndex: 1.06, insuranceIndex: 1.05, vehicleTaxRate: 0.04, registrationBaseFee: 110, weatherRiskIndex: 1.00, industryDemand: demand({ industrial_resources: 1.20 }), sourceTier: "regional-estimate" },
  ID: { code: "ID", name: "Idaho", censusRegion: "West", costIndex: 0.93, wageIndex: 0.92, fuelIndex: 1.02, dieselIndex: 1.08, insuranceIndex: 0.92, vehicleTaxRate: 0.06, registrationBaseFee: 110, weatherRiskIndex: 1.10, industryDemand: demand({ industrial_resources: 1.25, cold_chain: 1.10 }), sourceTier: "regional-estimate" },
  MT: { code: "MT", name: "Montana", censusRegion: "West", costIndex: 0.946, wageIndex: 0.94, fuelIndex: 0.83, dieselIndex: 0.90, insuranceIndex: 0.95, vehicleTaxRate: 0.0, registrationBaseFee: 88, weatherRiskIndex: 1.30, industryDemand: demand({ industrial_resources: 1.35, construction_heavy_haul: 1.15, specialized_logistics: 1.10, cold_chain: 0.85, medical_logistics: 0.90 }), sourceTier: "anchor" },
  WY: { code: "WY", name: "Wyoming", censusRegion: "West", costIndex: 0.92, wageIndex: 0.93, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 0.92, vehicleTaxRate: 0.04, registrationBaseFee: 100, weatherRiskIndex: 1.30, industryDemand: demand({ industrial_resources: 1.35, construction_heavy_haul: 1.10 }), sourceTier: "regional-estimate" },
  AK: { code: "AK", name: "Alaska", censusRegion: "West", costIndex: 1.06, wageIndex: 1.18, fuelIndex: 1.20, dieselIndex: 1.27, insuranceIndex: 1.05, vehicleTaxRate: 0.0, registrationBaseFee: 100, weatherRiskIndex: 1.40, industryDemand: demand({ industrial_resources: 1.30, specialized_logistics: 1.20, cold_chain: 0.85 }), sourceTier: "anchor" },
  HI: { code: "HI", name: "Hawaii", censusRegion: "West", costIndex: 1.10, wageIndex: 1.05, fuelIndex: 1.33, dieselIndex: 1.40, insuranceIndex: 0.85, vehicleTaxRate: 0.045, registrationBaseFee: 200, weatherRiskIndex: 0.85, industryDemand: demand({ specialized_logistics: 1.15, local_last_mile: 1.10 }), sourceTier: "anchor" },

  // ── South ─────────────────────────────────────────────────────────────────────────────────
  TX: { code: "TX", name: "Texas", censusRegion: "South", costIndex: 0.965, wageIndex: 0.99, fuelIndex: 0.88, dieselIndex: 0.94, insuranceIndex: 1.10, vehicleTaxRate: 0.0625, registrationBaseFee: 90, weatherRiskIndex: 1.00, industryDemand: demand({ industrial_resources: 1.25, construction_heavy_haul: 1.15, specialized_logistics: 1.10 }), sourceTier: "anchor" },
  FL: { code: "FL", name: "Florida", censusRegion: "South", costIndex: 1.00, wageIndex: 0.97, fuelIndex: 0.96, dieselIndex: 1.02, insuranceIndex: 1.35, vehicleTaxRate: 0.06, registrationBaseFee: 130, weatherRiskIndex: 1.10, industryDemand: demand({ cold_chain: 1.20, specialized_logistics: 1.10, retail_distribution: 1.10 }), sourceTier: "anchor" },
  GA: { code: "GA", name: "Georgia", censusRegion: "South", costIndex: 0.94, wageIndex: 0.95, fuelIndex: 0.92, dieselIndex: 0.98, insuranceIndex: 1.10, vehicleTaxRate: 0.066, registrationBaseFee: 100, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.20, cold_chain: 1.05 }), sourceTier: "regional-estimate" },
  NC: { code: "NC", name: "North Carolina", censusRegion: "South", costIndex: 0.93, wageIndex: 0.93, fuelIndex: 0.93, dieselIndex: 0.99, insuranceIndex: 0.95, vehicleTaxRate: 0.03, registrationBaseFee: 90, weatherRiskIndex: 1.00, industryDemand: demand({ retail_distribution: 1.10, construction_heavy_haul: 1.05 }), sourceTier: "regional-estimate" },
  SC: { code: "SC", name: "South Carolina", censusRegion: "South", costIndex: 0.90, wageIndex: 0.90, fuelIndex: 0.91, dieselIndex: 0.97, insuranceIndex: 1.05, vehicleTaxRate: 0.05, registrationBaseFee: 85, weatherRiskIndex: 0.98, industryDemand: demand({ retail_distribution: 1.10 }), sourceTier: "regional-estimate" },
  VA: { code: "VA", name: "Virginia", censusRegion: "South", costIndex: 1.00, wageIndex: 1.00, fuelIndex: 0.95, dieselIndex: 1.01, insuranceIndex: 0.98, vehicleTaxRate: 0.042, registrationBaseFee: 100, weatherRiskIndex: 1.00, industryDemand: demand({ specialized_logistics: 1.10, retail_distribution: 1.05 }), sourceTier: "regional-estimate" },
  WV: { code: "WV", name: "West Virginia", censusRegion: "South", costIndex: 0.90, wageIndex: 0.90, fuelIndex: 0.93, dieselIndex: 0.99, insuranceIndex: 0.92, vehicleTaxRate: 0.06, registrationBaseFee: 80, weatherRiskIndex: 1.15, industryDemand: demand({ industrial_resources: 1.30, construction_heavy_haul: 1.10 }), sourceTier: "regional-estimate" },
  KY: { code: "KY", name: "Kentucky", censusRegion: "South", costIndex: 0.89, wageIndex: 0.90, fuelIndex: 0.92, dieselIndex: 0.98, insuranceIndex: 1.00, vehicleTaxRate: 0.06, registrationBaseFee: 85, weatherRiskIndex: 1.00, industryDemand: demand({ industrial_resources: 1.15, retail_distribution: 1.05 }), sourceTier: "regional-estimate" },
  TN: { code: "TN", name: "Tennessee", censusRegion: "South", costIndex: 0.90, wageIndex: 0.92, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.07, registrationBaseFee: 85, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.15, industrial_resources: 1.05 }), sourceTier: "anchor" },
  AL: { code: "AL", name: "Alabama", censusRegion: "South", costIndex: 0.88, wageIndex: 0.89, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 1.05, vehicleTaxRate: 0.02, registrationBaseFee: 75, weatherRiskIndex: 1.00, industryDemand: demand({ industrial_resources: 1.15, construction_heavy_haul: 1.05 }), sourceTier: "regional-estimate" },
  MS: { code: "MS", name: "Mississippi", censusRegion: "South", costIndex: 0.87, wageIndex: 0.87, fuelIndex: 0.89, dieselIndex: 0.95, insuranceIndex: 1.00, vehicleTaxRate: 0.05, registrationBaseFee: 75, weatherRiskIndex: 1.05, industryDemand: demand({ industrial_resources: 1.25, construction_heavy_haul: 1.10 }), sourceTier: "anchor" },
  LA: { code: "LA", name: "Louisiana", censusRegion: "South", costIndex: 0.90, wageIndex: 0.91, fuelIndex: 0.91, dieselIndex: 0.97, insuranceIndex: 1.45, vehicleTaxRate: 0.0445, registrationBaseFee: 90, weatherRiskIndex: 1.15, industryDemand: demand({ industrial_resources: 1.30, specialized_logistics: 1.15 }), sourceTier: "anchor" },
  AR: { code: "AR", name: "Arkansas", censusRegion: "South", costIndex: 0.869, wageIndex: 0.88, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 0.95, vehicleTaxRate: 0.065, registrationBaseFee: 75, weatherRiskIndex: 1.00, industryDemand: demand({ retail_distribution: 1.20, industrial_resources: 1.15 }), sourceTier: "anchor" },
  OK: { code: "OK", name: "Oklahoma", censusRegion: "South", costIndex: 0.878, wageIndex: 0.90, fuelIndex: 0.89, dieselIndex: 0.95, insuranceIndex: 1.10, vehicleTaxRate: 0.0325, registrationBaseFee: 85, weatherRiskIndex: 1.10, industryDemand: demand({ industrial_resources: 1.25 }), sourceTier: "anchor" },
  MD: { code: "MD", name: "Maryland", censusRegion: "South", costIndex: 1.06, wageIndex: 1.06, fuelIndex: 1.00, dieselIndex: 1.06, insuranceIndex: 1.10, vehicleTaxRate: 0.06, registrationBaseFee: 150, weatherRiskIndex: 0.95, industryDemand: demand({ specialized_logistics: 1.10, medical_logistics: 1.10 }), sourceTier: "regional-estimate" },
  DE: { code: "DE", name: "Delaware", censusRegion: "South", costIndex: 1.00, wageIndex: 1.00, fuelIndex: 0.97, dieselIndex: 1.03, insuranceIndex: 1.05, vehicleTaxRate: 0.0, registrationBaseFee: 60, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.15 }), sourceTier: "regional-estimate" },

  // ── Midwest ───────────────────────────────────────────────────────────────────────────────
  IL: { code: "IL", name: "Illinois", censusRegion: "Midwest", costIndex: 0.99, wageIndex: 1.00, fuelIndex: 1.08, dieselIndex: 1.14, insuranceIndex: 1.00, vehicleTaxRate: 0.0725, registrationBaseFee: 155, weatherRiskIndex: 1.10, industryDemand: demand({ retail_distribution: 1.25, industrial_resources: 1.10 }), sourceTier: "regional-estimate" },
  OH: { code: "OH", name: "Ohio", censusRegion: "Midwest", costIndex: 0.90, wageIndex: 0.93, fuelIndex: 0.94, dieselIndex: 1.00, insuranceIndex: 0.75, vehicleTaxRate: 0.0575, registrationBaseFee: 95, weatherRiskIndex: 1.10, industryDemand: demand({ retail_distribution: 1.20, industrial_resources: 1.10 }), sourceTier: "anchor" },
  IN: { code: "IN", name: "Indiana", censusRegion: "Midwest", costIndex: 0.90, wageIndex: 0.92, fuelIndex: 0.86, dieselIndex: 0.92, insuranceIndex: 0.85, vehicleTaxRate: 0.07, registrationBaseFee: 90, weatherRiskIndex: 1.10, industryDemand: demand({ retail_distribution: 1.25, industrial_resources: 1.10 }), sourceTier: "anchor" },
  MI: { code: "MI", name: "Michigan", censusRegion: "Midwest", costIndex: 0.91, wageIndex: 0.94, fuelIndex: 0.98, dieselIndex: 1.04, insuranceIndex: 1.30, vehicleTaxRate: 0.06, registrationBaseFee: 130, weatherRiskIndex: 1.20, industryDemand: demand({ industrial_resources: 1.15, retail_distribution: 1.05 }), sourceTier: "regional-estimate" },
  WI: { code: "WI", name: "Wisconsin", censusRegion: "Midwest", costIndex: 0.92, wageIndex: 0.94, fuelIndex: 0.95, dieselIndex: 1.01, insuranceIndex: 0.90, vehicleTaxRate: 0.05, registrationBaseFee: 100, weatherRiskIndex: 1.20, industryDemand: demand({ industrial_resources: 1.15, cold_chain: 1.05 }), sourceTier: "regional-estimate" },
  MN: { code: "MN", name: "Minnesota", censusRegion: "Midwest", costIndex: 0.97, wageIndex: 0.99, fuelIndex: 0.97, dieselIndex: 1.03, insuranceIndex: 0.95, vehicleTaxRate: 0.0688, registrationBaseFee: 120, weatherRiskIndex: 1.30, industryDemand: demand({ industrial_resources: 1.20, cold_chain: 1.05 }), sourceTier: "regional-estimate" },
  IA: { code: "IA", name: "Iowa", censusRegion: "Midwest", costIndex: 0.878, wageIndex: 0.91, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.05, registrationBaseFee: 90, weatherRiskIndex: 1.20, industryDemand: demand({ industrial_resources: 1.30 }), sourceTier: "anchor" },
  MO: { code: "MO", name: "Missouri", censusRegion: "Midwest", costIndex: 0.89, wageIndex: 0.91, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 1.00, vehicleTaxRate: 0.04225, registrationBaseFee: 85, weatherRiskIndex: 1.10, industryDemand: demand({ retail_distribution: 1.15, industrial_resources: 1.10 }), sourceTier: "regional-estimate" },
  KS: { code: "KS", name: "Kansas", censusRegion: "Midwest", costIndex: 0.89, wageIndex: 0.90, fuelIndex: 0.89, dieselIndex: 0.95, insuranceIndex: 0.95, vehicleTaxRate: 0.065, registrationBaseFee: 85, weatherRiskIndex: 1.15, industryDemand: demand({ industrial_resources: 1.30 }), sourceTier: "regional-estimate" },
  NE: { code: "NE", name: "Nebraska", censusRegion: "Midwest", costIndex: 0.89, wageIndex: 0.90, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.055, registrationBaseFee: 85, weatherRiskIndex: 1.20, industryDemand: demand({ industrial_resources: 1.35 }), sourceTier: "anchor" },
  SD: { code: "SD", name: "South Dakota", censusRegion: "Midwest", costIndex: 0.881, wageIndex: 0.90, fuelIndex: 0.91, dieselIndex: 0.97, insuranceIndex: 0.90, vehicleTaxRate: 0.04, registrationBaseFee: 80, weatherRiskIndex: 1.25, industryDemand: demand({ industrial_resources: 1.35 }), sourceTier: "anchor" },
  ND: { code: "ND", name: "North Dakota", censusRegion: "Midwest", costIndex: 0.90, wageIndex: 0.93, fuelIndex: 0.90, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.05, registrationBaseFee: 90, weatherRiskIndex: 1.30, industryDemand: demand({ industrial_resources: 1.35 }), sourceTier: "anchor" },

  // ── Northeast ─────────────────────────────────────────────────────────────────────────────
  NY: { code: "NY", name: "New York", censusRegion: "Northeast", costIndex: 1.10, wageIndex: 1.10, fuelIndex: 1.10, dieselIndex: 1.17, insuranceIndex: 1.40, vehicleTaxRate: 0.04, registrationBaseFee: 140, weatherRiskIndex: 1.15, industryDemand: demand({ local_last_mile: 1.25, specialized_logistics: 1.15, medical_logistics: 1.10 }), sourceTier: "anchor" },
  NJ: { code: "NJ", name: "New Jersey", censusRegion: "Northeast", costIndex: 1.088, wageIndex: 1.15, fuelIndex: 1.05, dieselIndex: 1.12, insuranceIndex: 1.50, vehicleTaxRate: 0.06625, registrationBaseFee: 130, weatherRiskIndex: 1.05, industryDemand: demand({ retail_distribution: 1.25, local_last_mile: 1.15 }), sourceTier: "anchor" },
  PA: { code: "PA", name: "Pennsylvania", censusRegion: "Northeast", costIndex: 0.98, wageIndex: 1.00, fuelIndex: 1.05, dieselIndex: 1.12, insuranceIndex: 1.05, vehicleTaxRate: 0.06, registrationBaseFee: 105, weatherRiskIndex: 1.10, industryDemand: demand({ retail_distribution: 1.15, industrial_resources: 1.05 }), sourceTier: "regional-estimate" },
  MA: { code: "MA", name: "Massachusetts", censusRegion: "Northeast", costIndex: 1.07, wageIndex: 1.08, fuelIndex: 1.03, dieselIndex: 1.10, insuranceIndex: 0.90, vehicleTaxRate: 0.0625, registrationBaseFee: 130, weatherRiskIndex: 1.10, industryDemand: demand({ medical_logistics: 1.20, local_last_mile: 1.15 }), sourceTier: "regional-estimate" },
  CT: { code: "CT", name: "Connecticut", censusRegion: "Northeast", costIndex: 1.05, wageIndex: 1.06, fuelIndex: 1.04, dieselIndex: 1.11, insuranceIndex: 1.10, vehicleTaxRate: 0.0635, registrationBaseFee: 140, weatherRiskIndex: 1.05, industryDemand: demand({ local_last_mile: 1.15, medical_logistics: 1.10 }), sourceTier: "regional-estimate" },
  RI: { code: "RI", name: "Rhode Island", censusRegion: "Northeast", costIndex: 1.00, wageIndex: 1.00, fuelIndex: 1.02, dieselIndex: 1.09, insuranceIndex: 1.25, vehicleTaxRate: 0.07, registrationBaseFee: 120, weatherRiskIndex: 1.05, industryDemand: demand({ local_last_mile: 1.10 }), sourceTier: "regional-estimate" },
  VT: { code: "VT", name: "Vermont", censusRegion: "Northeast", costIndex: 1.00, wageIndex: 0.98, fuelIndex: 1.00, dieselIndex: 1.07, insuranceIndex: 0.70, vehicleTaxRate: 0.06, registrationBaseFee: 100, weatherRiskIndex: 1.25, industryDemand: demand({ industrial_resources: 1.15 }), sourceTier: "anchor" },
  NH: { code: "NH", name: "New Hampshire", censusRegion: "Northeast", costIndex: 1.03, wageIndex: 1.00, fuelIndex: 0.98, dieselIndex: 1.05, insuranceIndex: 0.72, vehicleTaxRate: 0.0, registrationBaseFee: 90, weatherRiskIndex: 1.20, industryDemand: demand({ industrial_resources: 1.10 }), sourceTier: "anchor" },
  ME: { code: "ME", name: "Maine", censusRegion: "Northeast", costIndex: 0.98, wageIndex: 0.95, fuelIndex: 1.00, dieselIndex: 1.07, insuranceIndex: 0.75, vehicleTaxRate: 0.055, registrationBaseFee: 90, weatherRiskIndex: 1.25, industryDemand: demand({ industrial_resources: 1.20, cold_chain: 1.05 }), sourceTier: "anchor" },

  // ── DC (BEA/BLS treat it alongside states) ───────────────────────────────────────────────
  DC: { code: "DC", name: "Washington D.C.", censusRegion: "Northeast", costIndex: 1.11, wageIndex: 1.10, fuelIndex: 1.05, dieselIndex: 1.12, insuranceIndex: 1.35, vehicleTaxRate: 0.06, registrationBaseFee: 155, weatherRiskIndex: 1.00, industryDemand: demand({ specialized_logistics: 1.15, medical_logistics: 1.15, local_last_mile: 1.10 }), sourceTier: "anchor" },
};

export const STATE_ECONOMY_CODES = Object.keys(STATE_ECONOMY_2026);

// Bounds every derived multiplier is clamped to — no single state's economy can make a branch
// simply unplayable ("worse", not "impossible") or runaway-favorable ("balanced" per the Phase 2
// handoff). See regionalEconomyEngine.js for where these are applied.
export const ECONOMY_BALANCE = {
  MIN_COMBINED_MULT: 0.55,
  MAX_COMBINED_MULT: 1.85,
};
