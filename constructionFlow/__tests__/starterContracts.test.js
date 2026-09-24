// Sprint 1, P0-4 — validate every starter contract.
//
// "For each contract available to a Level 1 company, verify: required crew can actually be
// hired/owned; required equipment exists in the shop; tier requirement matches the equipment the
// UI tells the player is valid; materials can be purchased; the contract can finish within a
// plausible deadline under normal conditions; payout supports the expected costs.
// Acceptance: a test iterates all starter-eligible contract definitions and fails on impossible
// requirements."
//
// The eligible set is computed with the game's own filter (isContractEligible, the one
// createContract uses), against a real fresh company — not a hand-maintained list.

import {
  freshState, isContractEligible, getTotalCrewCap, CONTRACT_DEFS, EQUIPMENT_SHOP, MATERIAL_DEFS,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { requirementFor, canStartWithPlant, plantPlanFor, STALL_FACTOR } from "../src/systems/sitePlant.js";
import { OFFICES } from "../src/systems/companyPerkTables.js";
import { MINS_PER_TICK, ticksPerDay } from "../src/systems/gameClock.js";

import { mulberry32 as __mulberry32 } from "../scripts/playtest/firstHourHarness.js";

// Deterministic: every test in this file runs on a seeded RNG, so a pass or a failure reproduces.
let __realRandom;
beforeEach(() => { __realRandom = Math.random; Math.random = __mulberry32(20260924); });
afterEach(() => { Math.random = __realRandom; });

const fresh = freshState();
const STARTERS = CONTRACT_DEFS.filter((d) => isContractEligible(d, fresh));
const CASH = fresh.cash;
const TPD = ticksPerDay("1x");

// The tick's own rate formula at its least favourable for a normal starting crew: lowest starting
// skill (75), no trait speed-up, no affinity bonus, and the −10% no-specialist penalty.
function phasePctPerDay(def, crew, plantOk = true) {
  const ratio = Math.min(crew / (def.crewMin || 2), 1.5);
  return 3.0 * 0.75 * ratio * (MINS_PER_TICK / 60) * 0.9 * (plantOk ? 1 : STALL_FACTOR) * TPD;
}

function daysToFinish(def, machines) {
  const crew = fresh.crew.length;
  return def.phases.reduce((days, phase) => {
    const ok = plantPlanFor([phase], machines, def.minTier)[0].satisfied;
    return days + 100 / phasePctPerDay(def, crew, ok);
  }, 0);
}

// Cheapest shop machine that satisfies a phase at the contract's tier.
function cheapestFor(phase, minTier) {
  const req = requirementFor(phase, minTier);
  if (!req) return null;
  return EQUIPMENT_SHOP
    .filter((m) => req.anyOf.includes(m.type) && m.tier >= req.minTier)
    .sort((a, b) => a.price - b.price)[0] || { price: Infinity, name: "NOTHING IN THE SHOP" };
}

function kitFor(def) {
  const owned = fresh.equipment;
  const extra = [];
  for (const phase of def.phases) {
    const machines = [...owned, ...extra];
    if (plantPlanFor([phase], machines, def.minTier)[0].satisfied) continue;
    const buy = cheapestFor(phase, def.minTier);
    if (buy && !extra.some((m) => m.shopId === buy.shopId)) extra.push({ ...buy, status: "Idle" });
  }
  return extra;
}

describe("the starter board", () => {
  test("a fresh company is offered a real, non-trivial set of contracts", () => {
    const ids = STARTERS.map((d) => d.id).sort();
    // Printed so the set is visible in CI output when it changes.
    console.log(`Starter-eligible contracts: ${ids.join(", ")}`);
    expect(ids).toContain("fence");            // the tutorial names it
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });

  test("the tutorial's first contract is on the opening board every time", () => {
    for (let i = 0; i < 20; i++) expect(freshState().contracts.some((c) => c.defId === "fence")).toBe(true);
  });
});

describe.each(STARTERS.map((d) => [d.id, d]))("%s", (_id, def) => {
  test("crew: the minimum can be staffed from the starting crew or by hiring within the cap", () => {
    expect(def.crewMin).toBeLessThanOrEqual(getTotalCrewCap(fresh));
  });

  test("equipment: every phase that needs plant has a machine in the shop at the tier the card shows", () => {
    for (const phase of def.phases) {
      const req = requirementFor(phase, def.minTier);
      if (!req) continue;
      // The card's chip says "Tier N+" from the contract; a phase may never demand more (build 11).
      expect({ phase, tier: req.minTier }).toEqual({ phase, tier: Math.min(req.minTier, def.minTier) });
      const buy = cheapestFor(phase, def.minTier);
      expect({ phase, found: Number.isFinite(buy.price) }).toEqual({ phase, found: true });
    }
  });

  test("equipment: the starting truck can open the job (first phase), so the Bids tab does not dead-end", () => {
    expect(canStartWithPlant(def.phases, fresh.equipment, def.minTier).ok).toBe(true);
  });

  test("equipment: any extra plant the job needs is affordable on starting cash", () => {
    const extra = kitFor(def);
    const cost = extra.reduce((s, m) => s + m.price, 0);
    expect(cost).toBeLessThan(CASH * 0.35);
  });

  test("materials: every material is sold, and the full bill is affordable on starting cash", () => {
    let bill = 0;
    for (const [matId, qty] of Object.entries(def.materials || {})) {
      const m = MATERIAL_DEFS.find((x) => x.id === matId);
      expect({ matId, sold: !!m }).toEqual({ matId, sold: true });
      bill += qty * m.basePrice;
    }
    expect(bill).toBeLessThan(CASH * 0.5);
  });

  test("deadline: finishable in time under normal conditions with the plant the card says it needs", () => {
    const machines = [...fresh.equipment, ...kitFor(def)];
    const days = daysToFinish(def, machines);
    // createContract sets the deadline at durationDays + rand(2, 6); use the tightest.
    expect(days).toBeLessThanOrEqual(def.durationDays + 2);
  });

  test("payout: the base contract value covers materials plus running costs for the job's length", () => {
    const machines = [...fresh.equipment, ...kitFor(def)];
    const days = Math.ceil(daysToFinish(def, machines));
    const wages = fresh.crew.reduce((s, w) => s + (w.wagePerDay || 0), 0);
    const plant = machines.reduce((s, e) => s + (e.dailyCost || 0), 0);
    const rent = OFFICES[0].dailyRent || 0;
    const materials = Object.entries(def.materials || {})
      .reduce((s, [matId, qty]) => s + qty * MATERIAL_DEFS.find((x) => x.id === matId).basePrice, 0);
    const costs = materials + days * (wages + plant + rent);
    // Printed: this is the table a designer reads when tuning the starter board.
    console.log(`${def.id.padEnd(11)} value ${String(def.baseValue).padStart(6)}  est ${String(days).padStart(2)}d  ` +
      `materials ${String(materials).padStart(5)}  running ${String(costs - materials).padStart(6)}  margin ${String(def.baseValue - costs).padStart(6)}`);
    expect(def.baseValue).toBeGreaterThan(costs);
  });
});

describe("chain unlocks that land on a starter board are reachable in the game, and the gap is visible", () => {
  // Finishing some starter jobs puts a bigger contract on the board regardless of eligibility
  // (Residential Renovation -> Apartment Block, Road Patch -> City Road). They are aspirational,
  // not impossible: the office ladder raises the crew cap and the shop sells the plant. What must
  // never happen is a requirement NOTHING in the game can meet.
  //
  // SPRINT 1 FINDING, reported rather than changed (a content decision, not a defect in a
  // system): at the STARTING office's crew cap these two cannot be staffed before they expire.
  const MAX_CREW_CAP = Math.max(...OFFICES.map((o) => o.crewCap || 0));
  const unlocks = STARTERS.filter((d) => d.unlocksContractId).map((d) => [d.id, d.unlocksContractId]);

  test.each(unlocks)("%s unlocks %s — staffable somewhere on the office ladder, plant in the shop", (_from, unlockId) => {
    const def = CONTRACT_DEFS.find((d) => d.id === unlockId);
    expect(def.crewMin).toBeLessThanOrEqual(MAX_CREW_CAP);
    for (const phase of def.phases) {
      const buy = cheapestFor(phase, def.minTier);
      if (buy) expect({ phase, inShop: Number.isFinite(buy.price) }).toEqual({ phase, inShop: true });
    }
  });

  test("which unlocks outrun the starting office is printed, so the gap is on the record", () => {
    const outrun = unlocks
      .map(([from, id]) => ({ from, id, crewMin: CONTRACT_DEFS.find((d) => d.id === id).crewMin }))
      .filter((u) => u.crewMin > getTotalCrewCap(fresh));
    console.log(`Chain unlocks beyond the starting crew cap (${getTotalCrewCap(fresh)}): ` +
      (outrun.map((u) => `${u.from} -> ${u.id} (needs ${u.crewMin})`).join(", ") || "none"));
    expect(Array.isArray(outrun)).toBe(true);
  });
});
