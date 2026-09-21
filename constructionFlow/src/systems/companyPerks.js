// Company perks: what your offices, regional offices and properties actually give you.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Phase 5 of the FleetFlow parity work. The brief was long-term progression — yards, offices,
// geographic expansion, company tiers, late-game goals. Construction Flow already has all of
// that content: five office tiers, nine cities, five regional office types, four property
// types, ten company levels, empire goals, milestones and achievements.
//
// What it did not have was any of it being true.
//
//   THE LADDER SOLD PERKS IT DID NOT DELIVER. Six perks are advertised on the office upgrade
//   path. Four of them were read by NOTHING — they existed only as strings in a data table
//   and on the button the player pressed to buy them:
//
//     Rented Portakabin   $3,500    "+5% bid win chance"      phantom
//     Small Site Office   $15,000   "-10% delay penalties"    phantom
//     Project Office      $45,000   "-15% delay penalties"    phantom
//                                   "-8% material costs"      worked
//     HQ Tower Suite      $110,000  "+12% bid win chance"     phantom
//                                   "-15% material costs"     worked
//
//   And beyond the office ladder:
//
//     contractSlots   Advertised on all five regional office types, up to "+80 contract
//                     slots" on a $1,500,000 National HQ. Read nowhere. The open-contract
//                     pool was hard-coded to a floor of 5 and a cap of 7 no matter what the
//                     player owned.
//     eliminatesRent  The Office Property costs $120,000 and its entire pitch is "Own instead
//                     of rent. Eliminates home office daily rent." Never read. Daily rent was
//                     charged unconditionally.
//     crew capacity   `getTotalCrewCap` computed a `propBonus` from owned properties and then
//                     returned without it — a dead variable ESLint had been flagging since
//                     the design-system pass.
//
// This module is the single place a company's perks are resolved, so a perk can no longer be
// advertised in one file and forgotten in another. `PERK_KEYS` plus the test that walks the
// data tables is what stops it recurring: every perk a table declares must be resolved here,
// and every perk resolved here must be consumed by the game.
//
// Everything is pure and RNG-free.

import { OFFICES, REGIONAL_OFFICE_TYPES, PROPERTY_TYPES } from "./companyPerkTables.js";

// Every perk the game can grant. A table declaring a key not in this list, or a key here that
// nothing consumes, is a bug — and there is a test for both directions.
export const PERK_KEYS = [
  "bidBonus",
  "penaltyReduction",
  "materialDiscount",
  "crewCap",
  "equipCap",
  "contractSlots",
  "rentEliminated",
  "weeklyPropertyIncome",
];

// Caps exist so a late-game company cannot make a mechanic disappear entirely. A player who
// has bought everything should be strong, not immune.
export const MAX_BID_BONUS = 0.15;
export const MAX_PENALTY_REDUCTION = 0.40;
export const MAX_MATERIAL_DISCOUNT = 0.40;

// The open-contract board. It was a hard-coded floor of 5 and cap of 7; regional offices now
// widen it.
//
// NOTE ON THE NUMBERS: the data tables advertised up to "+80 contract slots". Delivering that
// literally would put eighty contracts on the board — unreadable, and a save-size problem the
// earlier phases already fought. The honest fix for a promise that large and that false is to
// make the promise smaller and true, not to keep the number and ship an absurdity. The tables
// now advertise 1-5 extra contracts and deliver exactly that.
export const BASE_CONTRACT_FLOOR = 5;
export const BASE_CONTRACT_CAP = 7;
export const MAX_CONTRACT_SLOTS = 8;

function sum(list, fn) {
  return (Array.isArray(list) ? list : []).reduce((total, item) => total + (fn(item) || 0), 0);
}

// Resolves everything a company owns into one set of numbers. Every consumer in the game
// reads this rather than walking the tables itself, which is how the office perks came to be
// forgotten in the first place.
export function resolveCompanyPerks(gameState) {
  const game = gameState || {};
  const officeIndex = Number.isFinite(game.officeIndex) ? game.officeIndex : 0;
  const office = OFFICES[officeIndex] || OFFICES[0];
  const officePerks = Array.isArray(office?.perks) ? office.perks : [];
  const regionalOffices = Array.isArray(game.cityOffices) ? game.cityOffices : [];
  const properties = Array.isArray(game.properties) ? game.properties : [];

  const officePerkValue = (key) =>
    officePerks.filter((p) => p && p.key === key).reduce((total, p) => total + (Number.isFinite(p.value) ? p.value : 0), 0);

  const regionalDef = (o) => REGIONAL_OFFICE_TYPES.find((t) => t.id === o?.typeId);
  const propertyDef = (p) => PROPERTY_TYPES.find((t) => t.id === p?.typeId);

  const materialDiscount = Math.min(
    MAX_MATERIAL_DISCOUNT,
    officePerkValue("materialDiscount") + sum(properties, (p) => propertyDef(p)?.materialDiscount)
  );

  return {
    // Raises the chance of being awarded a contract. Only became worth anything at all once
    // Phase 2 made bid win probability real — before that there was nothing for it to move.
    bidBonus: Math.min(MAX_BID_BONUS, officePerkValue("bidBonus")),

    // Cuts liquidated damages on a late job.
    penaltyReduction: Math.min(MAX_PENALTY_REDUCTION, officePerkValue("penaltyReduction")),

    materialDiscount,

    // Home office tier, plus every regional office's crew allowance, plus property crew space.
    crewCap:
      (office?.crewCap || 4) +
      sum(regionalOffices, (o) => regionalDef(o)?.crewBonus) +
      sum(properties, (p) => propertyDef(p)?.crewCapBonus),

    equipCap:
      (office?.equipCap || 2) +
      sum(properties, (p) => propertyDef(p)?.equipCapBonus),

    // Extra contracts on the board, above the base floor.
    contractSlots: Math.min(MAX_CONTRACT_SLOTS, sum(regionalOffices, (o) => regionalDef(o)?.contractSlots)),

    // Owning your office means you stop paying rent on it.
    rentEliminated: properties.some((p) => propertyDef(p)?.eliminatesRent === true),

    weeklyPropertyIncome: sum(properties, (p) => propertyDef(p)?.weeklyIncome),
  };
}

// The contract board's floor and cap for this company.
export function contractBoardSize(gameState) {
  const { contractSlots } = resolveCompanyPerks(gameState);
  return {
    floor: BASE_CONTRACT_FLOOR + contractSlots,
    cap: BASE_CONTRACT_CAP + contractSlots,
  };
}

// The daily rent this company actually pays. Owning an office property eliminates it, which
// is the entire reason that property costs $120,000.
export function dailyOfficeRent(gameState) {
  const game = gameState || {};
  const office = OFFICES[Number.isFinite(game.officeIndex) ? game.officeIndex : 0] || OFFICES[0];
  const { rentEliminated } = resolveCompanyPerks(game);
  return rentEliminated ? 0 : (office?.dailyRent || 0);
}

// ─── Where your perks come from ──────────────────────────────────────────────

// For the progression screen: which building is giving you what. A player who has bought six
// things should be able to see what each one bought them, and — now that the perks are real —
// that answer is worth showing.
export function describePerkSources(gameState) {
  const game = gameState || {};
  const office = OFFICES[Number.isFinite(game.officeIndex) ? game.officeIndex : 0] || OFFICES[0];
  const sources = [];

  const officeEffects = [];
  if (office?.crewCap) officeEffects.push(`${office.crewCap} crew`);
  if (office?.equipCap) officeEffects.push(`${office.equipCap} machines`);
  for (const p of Array.isArray(office?.perks) ? office.perks : []) {
    if (p?.label) officeEffects.push(p.label);
  }
  if (officeEffects.length > 0) {
    sources.push({ key: `office-${office.id}`, name: office.name, kind: "office", effects: officeEffects });
  }

  for (const o of Array.isArray(game.cityOffices) ? game.cityOffices : []) {
    const def = REGIONAL_OFFICE_TYPES.find((t) => t.id === o?.typeId);
    if (!def) continue;
    const effects = [];
    if (def.crewBonus) effects.push(`+${def.crewBonus} crew`);
    if (def.contractSlots) effects.push(`+${def.contractSlots} contract${def.contractSlots === 1 ? "" : "s"} on the board`);
    sources.push({ key: `regional-${o.id || def.id}`, name: def.name, kind: "regional", effects });
  }

  for (const p of Array.isArray(game.properties) ? game.properties : []) {
    const def = PROPERTY_TYPES.find((t) => t.id === p?.typeId);
    if (!def) continue;
    const effects = [];
    if (def.equipCapBonus) effects.push(`+${def.equipCapBonus} machine space`);
    if (def.crewCapBonus) effects.push(`+${def.crewCapBonus} crew space`);
    if (def.materialDiscount) effects.push(`−${Math.round(def.materialDiscount * 100)}% materials`);
    if (def.eliminatesRent) effects.push("No office rent");
    if (def.weeklyIncome) effects.push(`+$${def.weeklyIncome.toLocaleString()}/wk`);
    sources.push({ key: `property-${p.id || def.id}`, name: def.name, kind: "property", effects });
  }

  return sources;
}

// The next rung on the home-office ladder, and whether it can be afforded. Returns null at
// the top, so the screen can say "you own the best there is" rather than rendering nothing.
export function nextOfficeUpgrade(gameState) {
  const game = gameState || {};
  const index = Number.isFinite(game.officeIndex) ? game.officeIndex : 0;
  const next = OFFICES[index + 1];
  if (!next) return null;

  const current = OFFICES[index] || OFFICES[0];
  const cash = Number.isFinite(game.cash) ? game.cash : 0;
  const gains = [];
  if (next.crewCap > (current?.crewCap || 0)) gains.push(`+${next.crewCap - current.crewCap} crew capacity`);
  if (next.equipCap > (current?.equipCap || 0)) gains.push(`+${next.equipCap - current.equipCap} machine capacity`);
  for (const p of Array.isArray(next.perks) ? next.perks : []) {
    if (p?.label) gains.push(p.label);
  }

  return {
    name: next.name,
    cost: next.cost,
    dailyRent: next.dailyRent,
    rentIncrease: Math.max(0, (next.dailyRent || 0) - (current?.dailyRent || 0)),
    affordable: cash >= next.cost,
    shortfall: Math.max(0, next.cost - cash),
    gains,
    desc: next.desc,
  };
}
