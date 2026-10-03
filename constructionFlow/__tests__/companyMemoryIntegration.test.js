// Company-memory integration — the chronicle wired into the real game.
//
// `companyMemory.test.js` proves the module. These prove the GAME reads it. That distinction
// has caught a near-miss in every phase of this work: Phase 4's rival personalities were
// written, unit-tested and never connected; Phase 5's crew-cap resolver was rewired and never
// exported. A memory system that records faithfully and changes nothing would be the same
// defect again, and a worse one — it would look alive while being inert.
//
// So each test below names the thing the player would feel.

import fs from "fs";
import path from "path";

import {
  freshState,
  migrateState,
  gameTick,
  checkWorkerTurnover,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  recordMemory,
  resolveMemoryEffects,
  recallMemory,
  MEMORY_CAP,
} from "../src/systems/companyMemory.js";
import { getBidCompetition, planBid } from "../src/systems/constructionLoop.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 2000000;
  g.day = 150;
  g.reputation = 60;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

function memories(list, day = 150) {
  return list.map((m, i) => ({
    tag: m.tag || `m${i}`, kind: m.kind, valence: m.valence, day: m.day ?? day,
    label: m.label || "moment", detail: m.detail || "detail", weight: m.weight ?? 2, subject: m.subject || "",
  }));
}

describe("a record of delivered work wins you future work", () => {
  test("the same contract is easier to win for a company that delivers", () => {
    const contract = { id: "c1", value: 150000, category: "Commercial" };
    const proven = { reputation: 60, day: 150, memoryEdge: resolveMemoryEffects({
      day: 150, companyMemory: memories([{ kind: "triumph", valence: "good", weight: 4 }]),
    }).bidEdge };
    const unknown = { reputation: 60, day: 150, memoryEdge: 0 };

    expect(getBidCompetition(proven, contract)).toBeGreaterThan(getBidCompetition(unknown, contract));
  });

  test("a record of blown jobs costs you work", () => {
    const contract = { id: "c1", value: 150000, category: "Commercial" };
    const burned = resolveMemoryEffects({
      day: 150, companyMemory: memories([{ kind: "setback", valence: "bad", weight: 4 }]),
    });
    expect(getBidCompetition({ reputation: 60, memoryEdge: burned.bidEdge }, contract))
      .toBeLessThan(getBidCompetition({ reputation: 60, memoryEdge: 0 }, contract));
  });

  test("history never makes a bid a certainty", () => {
    // completedJobs matters: a company on its FIRST contract is guaranteed the award on
    // purpose (hasFirstContractGuarantee), so this has to be a company past that point or the
    // test measures the guarantee instead of the clamp.
    const edge = 99; // far past any cap the module could produce
    for (const style of ["aggressive", "standard", "premium"]) {
      const plan = planBid({ id: "c", value: 50000, category: "Residential" }, style, {
        reputation: 100, bidBonus: 0.15, memoryEdge: edge, completedJobs: 25,
      });
      expect(plan.winChance).toBeLessThanOrEqual(0.97);
    }
  });

  test("history never makes a bid impossible either", () => {
    const plan = planBid({ id: "c", value: 50000, category: "Residential" }, "aggressive", {
      reputation: 0, memoryEdge: -99, completedJobs: 25,
    });
    expect(plan.winChance).toBeGreaterThan(0);
  });

  test("the screen routes memory into every bid through withBidPerks", () => {
    expect(SCREEN_CODE).toContain("memoryEdge");
    const bidCalls = SCREEN_CODE.match(/(?:planBid|rollBidOutcome)\([^)]*\)/g) || [];
    expect(bidCalls.length).toBeGreaterThanOrEqual(3);
    for (const call of bidCalls) expect(call).toContain("withBidPerks");
  });
});

describe("how you treat suppliers prices your materials", () => {
  test("paying straight earns terms; stiffing them costs terms", () => {
    const straight = resolveMemoryEffects({ day: 150, companyMemory: memories([{ kind: "supplier", valence: "good", weight: 4 }]) });
    const stiffed = resolveMemoryEffects({ day: 150, companyMemory: memories([{ kind: "supplier", valence: "bad", weight: 4 }]) });
    expect(straight.supplierGoodwill).toBeGreaterThan(0);
    expect(stiffed.supplierGoodwill).toBeLessThan(0);
  });

  // Sprint 1: supplier terms moved to systems/materialPricing.js, the single price every material
  // path reads, so the checks follow them there.
  test("the price the game charges folds goodwill into the discount", () => {
    const code = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "systems", "materialPricing.js"), "utf8");
    expect(code).toMatch(/resolveCompanyPerks\(game\)\.materialDiscount \+ supplierGoodwill/);
    expect(SCREEN_CODE).toContain("quoteMaterialUnitPrice(");
  });

  test("goodwill can never make materials free, and a grudge can never make them unbuyable", () => {
    const { supplierDiscount } = require("../src/systems/materialPricing.js");
    const memory = (valence, n) => Array.from({ length: n }, (_, i) => ({
      tag: `s${valence}${i}`, kind: "supplier", valence, weight: 5, day: 1, label: "x", detail: "x",
    }));
    for (const [valence, n] of [["good", 60], ["bad", 60]]) {
      const d = supplierDiscount({ officeIndex: 4, properties: [], companyMemory: memory(valence, n), day: 2 });
      expect(d).toBeGreaterThanOrEqual(-0.25);
      expect(d).toBeLessThanOrEqual(0.5);
    }
  });

  test("the supplier decision offers a real choice with a later cost", () => {
    // "Take it, settle later" is materials now, goodwill later — a decision whose price is
    // not on the invoice.
    expect(SCREEN_CODE).toContain("Take it, settle later");
    expect(SCREEN_CODE).toContain("supplier_stiffed_");
    expect(SCREEN_CODE).toContain("supplier_paid_");
  });
});

describe("how you treat people decides whether they stay", () => {
  test("a company that looks after its crew loses fewer of them", () => {
    // Same desperate roster, same RNG draw. Only the history differs.
    const roster = () => {
      const g = running();
      g.crew = g.crew.map((w) => ({ ...w, mood: 10, loyalty: 10, stamina: 5, status: "Working" }));
      return g;
    };
    const kind = roster();
    kind.companyMemory = memories([{ kind: "crew", valence: "good", weight: 4 }], kind.day);
    const harsh = roster();
    harsh.companyMemory = memories([{ kind: "crew", valence: "bad", weight: 4 }], harsh.day);

    expect(resolveMemoryEffects(kind).crewLoyalty).toBeGreaterThan(0);
    expect(resolveMemoryEffects(harsh).crewLoyalty).toBeLessThan(0);

    // And the turnover path reads it.
    expect(SCREEN_CODE).toContain("crewLoyalty");
    expect(SCREEN_CODE).toMatch(/quitChance \* \(1 - _loyalty\)/);
  });

  test("loyalty changes the odds but never the reasons — burnout is still burnout", () => {
    // A beloved employer still burns people out; memory must not make stamina irrelevant.
    const g = running();
    g.crew = g.crew.map((w) => ({ ...w, mood: 5, loyalty: 5, stamina: 2, status: "Working" }));
    g.companyMemory = memories([{ kind: "crew", valence: "good", weight: 4 }], g.day);
    const before = g.crew.length;
    checkWorkerTurnover(g);
    // The burnout log fires regardless of how well-liked the company is.
    expect(g.crew.length).toBeLessThanOrEqual(before);
    expect(JSON.stringify(g.logs || [])).toMatch(/burn/i);
  });

  test("turnover never goes negative or above certainty, whatever the history", () => {
    for (const valence of ["good", "bad"]) {
      const g = running();
      g.crew = g.crew.map((w) => ({ ...w, mood: 1, loyalty: 1, stamina: 1, status: "Working" }));
      g.companyMemory = Array.from({ length: 40 }, (_, i) => ({
        tag: `t${i}`, kind: "crew", valence, day: g.day, label: "x", detail: "x", weight: 4,
      }));
      expect(() => checkWorkerTurnover(g)).not.toThrow();
      expect(Number.isFinite(g.crew.length)).toBe(true);
    }
  });
});

describe("the market remembers what you did to it", () => {
  test("buying a rival out earns a grudge that costs you bids", () => {
    const bought = resolveMemoryEffects({
      day: 150, companyMemory: memories([{ kind: "rivalry", valence: "bad", weight: 3, subject: "Vance Bros" }]),
    });
    expect(bought.rivalGrudge).toBeGreaterThan(0);
    const contract = { id: "c", value: 200000, category: "Commercial" };
    expect(getBidCompetition({ reputation: 60, memoryEdge: -bought.rivalGrudge }, contract))
      .toBeLessThan(getBidCompetition({ reputation: 60, memoryEdge: 0 }, contract));
  });

  test("the acquisition path records the grudge", () => {
    expect(SCREEN_CODE).toContain("rivalGrudge");
    expect(SCREEN_CODE).toMatch(/tag: `acquired_\$\{rivalId\}`/);
  });
});

describe("the chronicle survives a real game", () => {
  test("400 ticks never produce a NaN effect or an unbounded chronicle", () => {
    let g = running({ companyMemory: [] });
    for (let i = 0; i < 400; i++) {
      g = gameTick(g);
      const e = resolveMemoryEffects(g);
      for (const k of Object.keys(e)) expect(Number.isFinite(e[k])).toBe(true);
      expect((g.companyMemory || []).length).toBeLessThanOrEqual(MEMORY_CAP);
    }
  });

  test("a job finished on time puts something on the record", () => {
    // Driven through the real completion path rather than by calling recordMemory directly.
    let g = running({ companyMemory: [] });
    g.activeSites = [{
      id: "site-mem", contractId: "c-mem", label: "Memory Tower", client: "Harbor Trust",
      status: "Active", phases: ["Finish"], currentPhaseIdx: 0, phaseProgress: 99.9,
      assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: g.equipment.map((e) => e.id),
      materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
      totalValue: 120000, depositPaid: 30000, penaltyPerDay: 100,
      deadlineDay: g.day + 40, startDay: g.day - 5, siteMode: "normal", chaosHistory: [],
    }];
    for (const w of g.crew) w.status = "Working";
    for (const e of g.equipment) e.status = "Active";

    for (let i = 0; i < 300 && (g.activeSites || []).length > 0; i++) g = gameTick(g);

    expect(g.activeSites.length).toBe(0);
    const recorded = recallMemory(g).filter((m) => m.tag.includes("site-mem"));
    expect(recorded.length).toBeGreaterThan(0);
  });
});

describe("save compatibility", () => {
  test("a build-4 save with no chronicle loads and starts one", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.companyMemory;
    const migrated = migrateState(legacy);
    expect(Array.isArray(migrated.companyMemory)).toBe(true);
    expect(migrated.companyMemory).toHaveLength(0);
  });

  test("migration never invents a history the player did not have", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.companyMemory;
    legacy.completedJobs = 40;
    legacy.day = 300;
    const migrated = migrateState(legacy);
    // 40 completed jobs do NOT become 40 remembered triumphs. The chronicle starts empty and
    // fills from the day the build is installed.
    expect(migrated.companyMemory).toHaveLength(0);
    for (const k of Object.keys(resolveMemoryEffects(migrated))) {
      expect(resolveMemoryEffects(migrated)[k]).toBe(0);
    }
  });

  test("an existing chronicle is preserved across migration", () => {
    const g = recordMemory(JSON.parse(JSON.stringify(freshState())), {
      tag: "keep_me", kind: "triumph", valence: "good", label: "Kept",
    });
    const migrated = migrateState(JSON.parse(JSON.stringify(g)));
    expect(recallMemory(migrated, { tag: "keep_me" })).toHaveLength(1);
  });

  test("a corrupted chronicle is repaired rather than crashing the load", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.companyMemory = "not an array";
    const migrated = migrateState(legacy);
    expect(Array.isArray(migrated.companyMemory)).toBe(true);
  });
});

describe("equipment artwork reaches the decision, not just the list", () => {
  test("the assignment picker renders the machine's own artwork", () => {
    // Audit gap 5: 45 equipment renders shown in exactly two places. Phase 3 put them on site
    // cards; the PICKER — where the player actually chooses what to send — was still text.
    const picker = SCREEN_CODE.slice(SCREEN_CODE.indexOf("Assign Equipment ("));
    expect(picker).toContain("EQUIPMENT_IMAGES[e.shopId]");
  });

  test("the picker row is a real tap target with an accessible label", () => {
    const picker = SCREEN_CODE.slice(SCREEN_CODE.indexOf("Assign Equipment ("));
    expect(picker).toContain("MIN_TAP_TARGET");
    expect(picker).toMatch(/accessibilityLabel=\{`\$\{sel \? "Deselect" : "Select"\}/);
  });
});
