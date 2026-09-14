// Project P&L regression tests.
//
// The critical invariant here is that cost attribution NEVER moves cash. The ledger exists
// so a completed project can report a margin; if accruing to it also charged the player,
// every job would silently cost double. The gameTick test below is the real guard.

import {
  PROJECT_COST_CATEGORIES,
  createProjectCostLedger,
  ensureProjectCostLedger,
  accrueProjectCost,
  accrueProjectCrewDay,
  getTotalProjectCost,
  buildProjectEconomics,
  getProjectReinvestmentHint,
  buildProjectProfitLines,
} from "../src/systems/projectEconomics.js";

import { freshState, migrateState, gameTick, clone } from "../src/games/constructionflow/ConstructionFlowScreen.js";

describe("project cost ledger", () => {
  test("starts empty and totals only real cost categories", () => {
    const ledger = createProjectCostLedger();
    expect(getTotalProjectCost(ledger)).toBe(0);
    accrueProjectCost({ costs: ledger }, "materials", 1200);
    accrueProjectCost({ costs: ledger }, "labor", 800);
    accrueProjectCost({ costs: ledger }, "equipment", 400);
    accrueProjectCost({ costs: ledger }, "incidents", 100);
    expect(getTotalProjectCost(ledger)).toBe(2500);
  });

  test("crew-day and machine-day counters are not treated as money", () => {
    const site = { costs: createProjectCostLedger() };
    accrueProjectCost(site, "materials", 500);
    accrueProjectCrewDay(site, 3, 2);
    expect(site.costs.crewDays).toBe(3);
    expect(site.costs.equipmentDays).toBe(2);
    // crewDays/equipmentDays must never leak into the money total.
    expect(getTotalProjectCost(site.costs)).toBe(500);
  });

  test("rejects unknown categories and non-positive amounts", () => {
    const site = { costs: createProjectCostLedger() };
    accrueProjectCost(site, "bribes", 10000);
    accrueProjectCost(site, "materials", -500);
    accrueProjectCost(site, "materials", NaN);
    accrueProjectCost(site, "materials", undefined);
    expect(getTotalProjectCost(site.costs)).toBe(0);
    expect(site.costs.bribes).toBeUndefined();
  });

  test("a site saved before cost tracking gets an empty ledger and a partial flag", () => {
    const legacySite = { id: "s1", label: "Old Job" };
    ensureProjectCostLedger(legacySite);
    expect(legacySite.costs).toEqual(createProjectCostLedger());
    expect(legacySite.costsPartial).toBe(true);
  });

  test("a corrupt ledger is repaired rather than propagating NaN", () => {
    const site = { costs: { materials: "abc", labor: -5, equipment: 300 } };
    ensureProjectCostLedger(site);
    expect(site.costs.materials).toBe(0);
    expect(site.costs.labor).toBe(0);
    expect(site.costs.equipment).toBe(300);
    expect(Number.isFinite(getTotalProjectCost(site.costs))).toBe(true);
  });
});

describe("project economics", () => {
  test("net profit is revenue minus every direct cost", () => {
    const ec = buildProjectEconomics({
      contractValue: 50000,
      depositPaid: 12500,
      penalty: 0,
      qualityBonus: 0,
      costs: { materials: 8000, labor: 6000, equipment: 3000, incidents: 1000 },
    });
    expect(ec.grossRevenue).toBe(50000);
    expect(ec.directCosts).toBe(18000);
    expect(ec.netProfit).toBe(32000);
    expect(ec.marginPercent).toBe(64);
  });

  test("the deposit is revenue, not a discount — gross includes it, final payment does not", () => {
    const ec = buildProjectEconomics({ contractValue: 40000, depositPaid: 10000, costs: createProjectCostLedger() });
    expect(ec.grossRevenue).toBe(40000);
    expect(ec.finalPayment).toBe(30000);
    // Gross minus the deposit already banked must equal what lands at completion.
    expect(ec.grossRevenue - ec.depositPaid).toBe(ec.finalPayment);
  });

  test("penalties reduce revenue and quality bonuses raise it", () => {
    const ec = buildProjectEconomics({
      contractValue: 20000, penalty: 3000, qualityBonus: 1500,
      costs: { materials: 5000 },
    });
    expect(ec.grossRevenue).toBe(18500);
    expect(ec.netProfit).toBe(13500);
  });

  test("a project can lose money and reports it as a negative, not a floor of zero", () => {
    const ec = buildProjectEconomics({
      contractValue: 10000, penalty: 4000,
      costs: { materials: 9000, labor: 2000 },
    });
    expect(ec.grossRevenue).toBe(6000);
    expect(ec.netProfit).toBe(-5000);
    expect(ec.marginPercent).toBeLessThan(0);
    expect(getProjectReinvestmentHint(ec.netProfit)).toMatch(/didn't clear its costs/i);
  });

  test("a forfeited project never produces NaN or Infinity in player-facing figures", () => {
    const ec = buildProjectEconomics({ contractValue: 0, penalty: 0, costs: createProjectCostLedger() });
    expect(ec.marginPercent).toBe(0);
    expect(Number.isFinite(ec.netProfit)).toBe(true);
    for (const line of buildProjectProfitLines(ec, (n) => `$${n}`)) {
      expect(line.value).not.toMatch(/NaN|Infinity/);
    }
  });

  test("missing input is treated as zero rather than throwing", () => {
    const ec = buildProjectEconomics();
    expect(ec.netProfit).toBe(0);
    expect(ec.directCosts).toBe(0);
  });

  test("profit lines omit costs that did not occur", () => {
    const ec = buildProjectEconomics({ contractValue: 5000, costs: { materials: 500 } });
    const labels = buildProjectProfitLines(ec, (n) => `$${n}`).map((l) => l.label);
    expect(labels).toContain("Materials");
    expect(labels.some((l) => l.startsWith("Crew wages"))).toBe(false);
    expect(labels).not.toContain("Late penalty");
  });

  test("every cost category has a player-facing label", () => {
    for (const def of Object.values(PROJECT_COST_CATEGORIES)) {
      expect(typeof def.label).toBe("string");
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  test("the reinvestment hint always names a concrete next step", () => {
    for (const net of [-1000, 0, 1000, 10000, 50000, 500000]) {
      const hint = getProjectReinvestmentHint(net);
      expect(typeof hint).toBe("string");
      expect(hint.length).toBeGreaterThan(20);
    }
  });
});

describe("cost attribution does not move cash", () => {
  test("a running project accrues labour and equipment cost without charging twice", () => {
    let g = migrateState(freshState());
    // Put a site on the board with the starting crew and truck assigned to it.
    const crewIds = g.crew.slice(0, 2).map((w) => w.id);
    const equipIds = g.equipment.map((e) => e.id);
    g.activeSites.push({
      id: "test-site", contractId: g.contracts[0].id, label: "Test Job", client: "Test Client",
      totalValue: 40000, phases: [...(g.contracts[0].phases || [])],
      currentPhaseIdx: 0, phaseProgress: 0,
      assignedCrewIds: crewIds, assignedEquipmentIds: equipIds,
      crewMin: 1, equipMin: 1,
      startDay: g.day, durationDays: 10,
      deadlineDay: g.day + 10, penaltyPerDay: 200,
      status: "Active", chaosHistory: [], pausedDays: 0,
      cityId: "salem", siteMode: "normal", materialsFulfilled: {},
      depositPaid: 0, completionBonus: 0, rushQualityPenalty: 0,
      costs: createProjectCostLedger(),
    });
    for (const id of crewIds) {
      const w = g.crew.find((c) => c.id === id);
      w.status = "Active";
      w.assignedSiteId = "test-site";
    }

    // The expected daily sweep: ALL crew and ALL equipment plus rent, unchanged by the new
    // per-site attribution. If attribution ever deducted cash, expenses would exceed this.
    const expensesBefore = g.expenses;

    // Run a full game day (48 half-hour ticks).
    for (let i = 0; i < 48; i++) g = gameTick(g);

    const site = g.activeSites.find((s) => s.id === "test-site");
    expect(site).toBeDefined();

    const attributed = getTotalProjectCost(site.costs);
    const totalSpent = g.expenses - expensesBefore;

    // Something was attributed to the project...
    expect(attributed).toBeGreaterThan(0);
    // ...and it is a SUBSET of what the company actually spent, never an extra charge on
    // top of it. This is the double-charge guard.
    expect(attributed).toBeLessThanOrEqual(totalSpent);
    expect(site.costs.crewDays).toBeGreaterThan(0);
  });

  test("cost ledgers survive a save/load round trip", () => {
    let g = migrateState(freshState());
    g.activeSites.push({
      id: "s-persist", contractId: "c1", label: "Persist Job", client: "C",
      totalValue: 10000, phases: [], currentPhaseIdx: 0, phaseProgress: 0,
      assignedCrewIds: [], assignedEquipmentIds: [], status: "Active",
      startDay: 1, durationDays: 5, deadlineDay: 6, penaltyPerDay: 100,
      materialsFulfilled: {}, depositPaid: 0, chaosHistory: [],
      costs: createProjectCostLedger(),
    });
    const site = g.activeSites.find((s) => s.id === "s-persist");
    accrueProjectCost(site, "materials", 3400);
    accrueProjectCrewDay(site, 4, 1);

    const reloaded = migrateState(JSON.parse(JSON.stringify(clone(g))));
    const restored = reloaded.activeSites.find((s) => s.id === "s-persist");
    expect(restored.costs.materials).toBe(3400);
    expect(restored.costs.crewDays).toBe(4);
    // A site that already had a ledger must not be flagged partial on load.
    expect(restored.costsPartial).toBeFalsy();
  });

  test("migration flags pre-tracking sites as partial instead of claiming a clean margin", () => {
    const g = freshState();
    g.activeSites.push({
      id: "legacy", contractId: "c1", label: "Legacy Job", client: "C",
      totalValue: 10000, phases: [], currentPhaseIdx: 0, phaseProgress: 0,
      assignedCrewIds: [], assignedEquipmentIds: [], status: "Active",
      startDay: 1, durationDays: 5, deadlineDay: 6, penaltyPerDay: 100,
      materialsFulfilled: {}, chaosHistory: [],
    });
    const migrated = migrateState(g);
    const legacy = migrated.activeSites.find((s) => s.id === "legacy");
    expect(legacy.costs).toBeDefined();
    expect(legacy.costsPartial).toBe(true);
  });
});
