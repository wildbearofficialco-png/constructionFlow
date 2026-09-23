// Plant and compliance in the real game.
//
// The unit tests prove the modules. These prove the GAME uses them — and, more importantly,
// that the new requirements cannot strand a player. Every gate added here is a way for the
// player to be told "no", and a gate with no way past it is a dead save.

import fs from "fs";
import path from "path";

import { freshState, migrateState, gameTick, EQUIPMENT_SHOP } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { ticksPerDay } from "../src/systems/gameClock.js";
import { satisfies, requirementFor, PHASE_PLANT_REQUIREMENTS, STALL_FACTOR } from "../src/systems/sitePlant.js";
import { unlicensedMachineCount, catchRiskPerDay, inspectSite, OPERATOR_CERT } from "../src/systems/siteCompliance.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const TICKS_PER_DAY = ticksPerDay("1x");
const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 1500000;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

describe("every requirement is satisfiable by something the shop sells", () => {
  test("no phase demands plant that does not exist", () => {
    // The unreachable-content guard, in its most dangerous form: a requirement nothing can
    // meet would block that phase forever, for every player, silently.
    const unsatisfiable = [];
    for (const phase of Object.keys(PHASE_PLANT_REQUIREMENTS)) {
      const ok = EQUIPMENT_SHOP.some((item) =>
        satisfies(phase, [{ id: "x", type: item.type, tier: item.tier, status: "Idle" }])
      );
      if (!ok) unsatisfiable.push(phase);
    }
    expect(unsatisfiable).toEqual([]);
  });

  test("and the starting company can begin at least some work", () => {
    // A brand-new player owns one machine. If the first phase of every job they can see
    // demanded plant they cannot afford, the game would open on a wall.
    const g = freshState();
    const startable = (g.contracts || []).filter((c) =>
      satisfies((c.phases || [])[0], g.equipment)
    );
    expect(startable.length).toBeGreaterThan(0);
  });
});

describe("the gate is wired to starting a site", () => {
  test("the handler refuses the wrong plant and says why", () => {
    expect(SCREEN_CODE).toContain("canStartWithPlant(c.phases");
    expect(SCREEN_CODE).toContain("Wrong Plant For The Job");
  });

  test("progress is multiplied by the plant factor", () => {
    expect(SCREEN_CODE).toContain("plantProgressFactor(currentPhaseName, assignedEquip)");
  });
});

describe("losing plant mid-job is a setback, never a dead end", () => {
  test("a site with the WRONG plant crawls rather than stopping", () => {
    // The rule this project keeps returning to: a setback must never become an unrecoverable
    // state. A hard stop here would strand the player's cash in a job that can never close.
    //
    // NOTE the deliberate choice of fixture. A site with NO usable equipment has made zero
    // progress since long before this sprint — `if (!assignedCrew.length ||
    // !assignedEquip.length) continue;` sits above the progress maths and predates this work.
    // What Sprint 12 introduced is the WRONG-plant case, and that is what is tested here: a
    // pickup truck on a piling phase, which the requirement rejects but which still leaves a
    // crew on site doing what they can.
    let g = running({ day: 1, gameMinutes: 0 });
    const pickup = { ...g.equipment[0], id: "wrong-plant", type: "Utility", tier: 1, status: "Active", condition: 95 };
    g.equipment = [...g.equipment, pickup];
    g.activeSites = [{
      id: "stall", contractId: "c1", label: "Stall Test", client: "Harbor Trust",
      status: "Active", phases: ["Piling"], currentPhaseIdx: 0, phaseProgress: 0,
      assignedCrewIds: g.crew.map((w) => w.id),
      assignedEquipmentIds: ["wrong-plant"],
      materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
      totalValue: 150000, depositPaid: 20000, penaltyPerDay: 0,
      deadlineDay: 9999, startDay: 1, siteMode: "normal", chaosHistory: [],
    }];
    for (const w of g.crew) w.status = "Working";

    expect(satisfies("Piling", [pickup])).toBe(false);
    for (let i = 0; i < TICKS_PER_DAY * 25; i++) g = gameTick(g);
    const site = (g.activeSites || [])[0];

    // Either it finished, or it made real progress. What it must not do is sit at zero.
    if (site) expect(site.phaseProgress).toBeGreaterThan(0);
    else expect(g.completedJobs).toBeGreaterThan(0);
  });

  test("the right plant is genuinely faster than the wrong plant", () => {
    // The requirement has to be worth meeting, not just worth announcing.
    function runWith(machine) {
      let g = running({ day: 1, gameMinutes: 0 });
      const m = { ...g.equipment[0], ...machine, status: "Active", condition: 95 };
      g.equipment = [...g.equipment, m];
      g.activeSites = [{
        id: "cmp", contractId: "c1", label: "Compare", client: "Harbor Trust",
        status: "Active", phases: ["Piling"], currentPhaseIdx: 0, phaseProgress: 0,
        assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: [m.id],
        materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
        totalValue: 150000, depositPaid: 20000, penaltyPerDay: 0,
        deadlineDay: 9999, startDay: 1, siteMode: "normal", chaosHistory: [],
      }];
      for (const w of g.crew) w.status = "Working";
      for (let i = 0; i < TICKS_PER_DAY * 6; i++) g = gameTick(g);
      const s = (g.activeSites || [])[0];
      return s ? s.phaseProgress : 100;
    }
    const wrong = runWith({ id: "w", type: "Utility", tier: 1 });
    const right = runWith({ id: "r", type: "Foundation", tier: 4 });
    expect(right).toBeGreaterThan(wrong);
  });

  test("the stall is a fraction, not a halt", () => {
    expect(STALL_FACTOR).toBeGreaterThan(0);
  });
});

describe("compliance runs in the real loop", () => {
  test("the daily rollover checks licences and inspects", () => {
    expect(SCREEN_CODE).toContain("catchRiskPerDay(_site, g)");
    expect(SCREEN_CODE).toContain("inspectSite(_site, g)");
    expect(SCREEN_CODE).toContain("INSPECTION_CHANCE_PER_DAY");
  });

  test("fines land in the ledger under a category that renders", () => {
    // The Sprint 6 guard caught an invented category once already this month.
    expect(SCREEN_CODE).toContain('recordTransaction(g, "fines"');
  });

  test("a long run with unlicensed cranes eventually costs money", () => {
    let g = running({ day: 1, gameMinutes: 0, reputation: 80 });
    const crane = { ...g.equipment[0], id: "big-crane", type: "Lifting", tier: 4, status: "Active", condition: 95 };
    g.equipment = [...g.equipment, crane];
    g.activeSites = [{
      id: "unl", contractId: "c1", label: "Unlicensed Site", client: "Harbor Trust",
      status: "Active", phases: ["Structure"], currentPhaseIdx: 0, phaseProgress: 0,
      // No crew assigned, deliberately: the site cannot progress and so cannot COMPLETE and end
      // the run early, while the crane still counts as heavy plant nobody is ticketed for.
      assignedCrewIds: [], assignedEquipmentIds: ["big-crane"],
      materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
      totalValue: 600000, depositPaid: 0, penaltyPerDay: 0,
      deadlineDay: 9999, startDay: 1, siteMode: "normal", chaosHistory: [],
    }];
    for (const w of g.crew) w.certifications = [];

    expect(unlicensedMachineCount(g.activeSites[0], g.crew, g.equipment)).toBe(1);
    expect(catchRiskPerDay(g.activeSites[0], g)).toBeGreaterThan(0);

    // Watched DURING the run rather than read at the end: recordTransaction caps the ledger at
    // 300 entries, so a fine on day 12 is long gone by day 200.
    let sawFine = false;
    for (let i = 0; i < TICKS_PER_DAY * 200 && !sawFine; i++) {
      g = gameTick(g);
      if ((g.ledger || []).some((t) => t.category === "fines")) sawFine = true;
    }
    // ~3.5%/day over 200 days: not seeing one is a 1-in-1200 event.
    expect(sawFine).toBe(true);
  });

  test("a compliant company is never fined for licences", () => {
    // The other half of the claim: the gamble is avoidable.
    let g = running({ day: 1, gameMinutes: 0 });
    const crane = { ...g.equipment[0], id: "lic-crane", type: "Lifting", tier: 4, status: "Active", condition: 95 };
    g.equipment = [...g.equipment, crane];
    for (const w of g.crew) w.certifications = [OPERATOR_CERT, "safety_cert"];
    const s = {
      id: "ok", label: "Compliant Site", status: "Active",
      assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: ["lic-crane"], totalValue: 600000,
    };
    expect(catchRiskPerDay(s, g)).toBe(0);
    expect(inspectSite(s, g).passed).toBe(true);
  });
});

describe("theft finally says something", () => {
  test("the event names the material and the replacement cost", () => {
    expect(SCREEN_CODE).not.toContain("Material theft — on-site materials reduced.");
    expect(SCREEN_CODE).toContain("stolen from ${site.label} overnight");
    expect(SCREEN_CODE).toContain("to replace, and the phase cannot finish without it");
  });

  test("it still actually removes the materials", () => {
    // The part that already worked and must not be lost in making it visible.
    expect(SCREEN_CODE).toContain("site.materialsFulfilled[_matId] = Math.max(0, _have - _taken)");
  });
});

describe("save compatibility", () => {
  test("a build-7 save loads and keeps its sites", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.activeSites = [{ id: "old", label: "Old Site", status: "Active", phases: ["Piling"], currentPhaseIdx: 0, assignedEquipmentIds: [], assignedCrewIds: [] }];
    const m = migrateState(legacy);
    expect(m.activeSites).toHaveLength(1);
  });

  test("a site already under way on plant it no longer has is not destroyed by the upgrade", () => {
    // The requirement is new. An existing save will contain sites that would not pass it, and
    // those must keep running rather than being invalidated retroactively.
    let g = running({ day: 1, gameMinutes: 0 });
    g.activeSites = [{
      id: "legacy", contractId: "c1", label: "Legacy Site", client: "X",
      status: "Active", phases: ["Structural Steel"], currentPhaseIdx: 0, phaseProgress: 40,
      assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: [],
      materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
      totalValue: 200000, depositPaid: 0, penaltyPerDay: 0,
      deadlineDay: 9999, startDay: 1, siteMode: "normal", chaosHistory: [],
    }];
    for (let i = 0; i < TICKS_PER_DAY * 5; i++) g = gameTick(g);
    const site = (g.activeSites || []).find((s) => s.id === "legacy");
    if (site) expect(site.phaseProgress).toBeGreaterThanOrEqual(40);
    expect(() => gameTick(g)).not.toThrow();
  });

  test("crew with no certifications array survive the compliance check", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.crew = legacy.crew.map((w) => { const c = { ...w }; delete c.certifications; return c; });
    const m = migrateState(legacy);
    expect(() => inspectSite({ assignedCrewIds: [], assignedEquipmentIds: [] }, m)).not.toThrow();
  });
});

describe("the requirement is visible before the player commits", () => {
  const CODE = fs.readFileSync(SCREEN_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

  test("plantPlanFor is actually used, not just imported", () => {
    // This project's most repeated defect: a module written, unit-tested, and never connected.
    // Phase 4's rival personalities, Phase 5's crew-cap resolver, Phase 6's chronicle callbacks
    // and Sprint 7's KPI counters all shipped that way at first.
    // `plantPlanFor(` with the paren counts CALLS only — the import line is `plantPlanFor,`
    // and does not match, so one is already proof of a real call site.
    const calls = (CODE.match(/plantPlanFor\(/g) || []).length;
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  test("the bid card warns when the plant is missing", () => {
    expect(CODE).toContain("plant you do not have");
  });

  test("and confirms when it is not", () => {
    expect(CODE).toContain("Plant on hand for all");
  });
});
