// Sprint 1 P0 — earned chain contracts wait for the company instead of expiring unreachable.
//
// Finishing Residential Renovation earns Apartment Block (8 crew, tier 3); finishing Road Patch
// earns City Road (6 crew, tier 2). A new company's office holds 4 crew and it owns tier-1 plant.
// Both used to arrive with a 14-day expiry and die unused. Now they are held, locked, with each
// gate shown, and the bid window opens only once the company can take the job.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  freshState, gameTick, mobilizeSite, migrateState, EQUIPMENT_SHOP, CONTRACT_DEFS, getTotalCrewCap,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { chainReadiness, CHAIN_LOCKED, CHAIN_OFFER_DAYS } from "../src/systems/chainOpportunities.js";
import ChainOpportunityCard from "../src/components/ChainOpportunityCard.js";
import { withSeed, TPD } from "../scripts/playtest/firstHourHarness.js";

import { mulberry32 as __mulberry32 } from "../scripts/playtest/firstHourHarness.js";

// Deterministic: every test in this file runs on a seeded RNG, so a pass or a failure reproduces.
let __realRandom;
beforeEach(() => { __realRandom = Math.random; Math.random = __mulberry32(20260924); });
afterEach(() => { Math.random = __realRandom; });

jest.setTimeout(60000);

const shopItem = (id) => ({ ...EQUIPMENT_SHOP.find((e) => e.shopId === id), id: `eq-${id}`, status: "Idle", condition: 100, fuel: 100 });

// Finish `defId` through the real start path and the real completion code.
function completeOn(g, defId) {
  const d = CONTRACT_DEFS.find((x) => x.id === defId);
  const id = `forced-${defId}-${g.contracts.length}`;
  g.contracts.push({ ...g.contracts[0], id, defId, status: "Open", label: d.label, phases: [...d.phases],
    minTier: d.minTier, crewMin: d.crewMin, equipMin: d.equipMin, materials: { ...d.materials },
    durationDays: d.durationDays, deadline: g.day + 30 });
  for (const [m, q] of Object.entries(d.materials)) g.materials[m] = q;
  for (const w of g.crew) { w.status = "Idle"; w.assignedSiteId = null; }
  for (const e of g.equipment) { e.status = "Idle"; e.assignedSiteId = null; }
  const res = mobilizeSite(g, id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
  expect(res.status).toBe("won");
  const site = g.activeSites.at(-1);
  site.currentPhaseIdx = site.phases.length - 1;
  site.phaseProgress = 99.99;
  const real = Math.random; Math.random = () => 0.01;   // clean inspection, no chaos
  try { g = gameTick(g); } finally { Math.random = real; }
  expect(g.activeSites.some((x) => x.id === site.id)).toBe(false);
  return g;
}

function finishJob(defId, seed = 4) {
  return withSeed(seed, () => completeOn({ ...freshState(), setupDone: true, tutorialDone: true }, defId));
}

function runDays(g, days, seed = 5) {
  return withSeed(seed, () => {
    let s = g;
    for (let i = 0; i < TPD * days; i++) { s = gameTick(s); s.pendingDecision = null; }
    return s;
  });
}

const chainOf = (g, defId) => g.contracts.find((c) => c.isChainUnlock && c.defId === defId);

describe.each([
  ["resi_reno", "apt_block", { crew: 8, tier: 3, buy: "concpump" }],     // Foundation → Concrete tier 3
  ["road_patch", "city_road", { crew: 6, tier: 2, buy: "dumptruck" }],   // Survey → Earthwork tier 2
])("%s → %s", (from, to, need) => {
  test("finishing the prerequisite earns it, locked, with no expiry, because the company cannot take it yet", () => {
    const g = finishJob(from);
    const c = chainOf(g, to);
    expect(c).toBeDefined();
    expect(c.status).toBe(CHAIN_LOCKED);
    expect(c.expiresDay).toBeNull();
    const { gates } = chainReadiness(c, { crewCap: getTotalCrewCap(g), equipCap: 2, equipment: g.equipment });
    const crewGate = gates.find((x) => x.key === "crew");
    expect(crewGate).toMatchObject({ ok: false, need: need.crew, have: 4 });
    expect(gates.find((x) => x.key === "tier")).toMatchObject({ ok: false, need: need.tier, have: 1 });
    expect((g.logs || []).some((l) => l.includes(`Earned: ${c.label}`))).toBe(true);
  });

  test("it survives 60 game days of waiting — not expired, not pruned, not trimmed by the board cap", () => {
    const g = runDays(finishJob(from), 60);
    const c = chainOf(g, to);
    expect(c).toBeDefined();
    expect(c.status).toBe(CHAIN_LOCKED);
  });

  test("capacity alone does not open it while the plant gate is still unmet", () => {
    const g = finishJob(from);
    g.officeIndex = 1;                       // crew cap 8, machine slots 4
    const s = runDays(g, 1);
    expect(chainOf(s, to).status).toBe(CHAIN_LOCKED);
    const r = chainReadiness(chainOf(s, to), { crewCap: getTotalCrewCap(s), equipCap: 4, equipment: s.equipment });
    expect(r.waitingOn.map((x) => x.key)).toEqual(expect.arrayContaining(["tier"]));
  });

  test("once the company can take it, it opens and the normal 14-day window starts", () => {
    const g = finishJob(from);
    g.officeIndex = 1;
    g.equipment.push(shopItem(need.buy));
    const s = runDays(g, 1);
    const c = chainOf(s, to);
    expect(c.status).toBe("Open");
    expect(c.expiresDay).toBe(c.openedDay + CHAIN_OFFER_DAYS);
    expect(c.deadline).toBeGreaterThan(s.day);
  });

  test("…and it is then actually biddable: no gate the bid path enforces is left impossible", () => {
    const g = finishJob(from);
    g.officeIndex = 1;
    g.equipment.push(shopItem(need.buy));
    let s = runDays(g, 1);
    const c = chainOf(s, to);
    // Hire up to the requirement within the new cap, and stock the yard.
    while (s.crew.length < c.crewMin) s.crew.push({ ...s.crew[0], id: `hire-${s.crew.length}`, status: "Idle", assignedSiteId: null });
    expect(s.crew.length).toBeLessThanOrEqual(getTotalCrewCap(s));
    for (const [m, q] of Object.entries(c.materials)) s.materials[m] = q;
    for (const w of s.crew) w.status = "Idle";
    const res = mobilizeSite(s, c.id, s.crew.map((w) => w.id), s.equipment.map((e) => e.id), () => 0);
    expect(res.status).toBe("won");
  });

  test("it expires normally if the player then lets the window pass", () => {
    const g = finishJob(from);
    g.officeIndex = 1;
    g.equipment.push(shopItem(need.buy));
    const s = runDays(g, CHAIN_OFFER_DAYS + 2);
    expect(chainOf(s, to)).toBeUndefined();
  });

  test("finishing the prerequisite again does not create a second copy", () => {
    let g = finishJob(from);
    g = withSeed(8, () => completeOn(g, from));
    expect(g.contracts.filter((c) => c.isChainUnlock && c.defId === to)).toHaveLength(1);
  });
});

describe("the player sees exactly what it is waiting on", () => {
  test("the card lists every gate with need, have, and how to meet it", () => {
    const g = finishJob("resi_reno");
    const c = chainOf(g, "apt_block");
    let tree;
    act(() => { tree = TestRenderer.create(<ChainOpportunityCard contract={c} company={{ crewCap: 4, equipCap: 2, equipment: g.equipment }} />); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Apartment Block");
    expect(json).toContain("held for you with no expiry");
    expect(json).toMatch(/Crew capacity.*need 8.*you have 4/);
    expect(json).toMatch(/Plant tier.*need 3.*you have 1/);
    expect(json).toContain("Upgrade your office in Empire");
  });
});

describe("old saves", () => {
  test("an earned chain the company cannot take yet is held rather than left on a 14-day clock", () => {
    const g = finishJob("road_patch");
    const c = chainOf(g, "city_road");
    c.status = "Open";
    c.expiresDay = g.day + 3;                // how a pre-Sprint-1 save stored it
    const m = migrateState(JSON.parse(JSON.stringify(g)));
    const mc = chainOf(m, "city_road");
    expect(mc.status).toBe(CHAIN_LOCKED);
    expect(mc.expiresDay).toBeNull();
  });
});
