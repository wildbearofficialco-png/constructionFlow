// KPI integration — the measures wired into the real game.
//
// `constructionKPIs.test.js` proves the module. These prove the GAME feeds it. Every phase of
// this work has produced at least one thing that was written, unit-tested and never connected:
// Phase 4's rival personalities, Phase 5's crew-cap resolver, and nearly Phase 6's memory. A
// dashboard fed by counters nobody increments would be the same defect wearing a chart.

import fs from "fs";
import path from "path";

import {
  freshState,
  migrateState,
  gameTick,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  computeKPIs,
  buildKPIRows,
  summarizePerformance,
  KPI_SNAPSHOT_INTERVAL,
  MAX_KPI_SNAPSHOTS,
  KPI_DEFS,
} from "../src/systems/constructionKPIs.js";

import { ticksPerDay } from "../src/systems/gameClock.js";
// Was a hard-coded 48, which meant "ticks per game day" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so the literal silently became "a third of a day".
const TICKS_PER_DAY = ticksPerDay("1x");

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 1500000;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

describe("the dead FleetFlow engine is genuinely disconnected", () => {
  test("the screen no longer ticks analyticsEngine", () => {
    expect(SCREEN_CODE).not.toContain("tickAnalytics(");
    expect(SCREEN_CODE).not.toContain("initAnalytics(");
  });

  test("the screen ticks the construction KPIs instead", () => {
    expect(SCREEN_CODE).toContain("tickConstructionKPIs(g)");
  });

  test("the stale analytics blob is dropped on load rather than left in the save", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    // What the old engine wrote: 26 snapshots of zeros and a frozen 3.5 rating.
    legacy.analytics = {
      snapshots: Array.from({ length: 26 }, (_, i) => ({
        day: i * 7, totalRevenue: 0, onTimeRate: 1, utilizationRate: 0, customerRating: 3.5,
      })),
      lastSnapshotDay: 182,
    };
    const migrated = migrateState(legacy);
    expect(migrated.analytics).toBeUndefined();
  });
});

describe("the counters the win-rate KPI needs are actually incremented", () => {
  test("the bid path records placed, won and lost", () => {
    expect(SCREEN_CODE).toContain("g.bidsPlaced = (g.bidsPlaced || 0) + 1");
    expect(SCREEN_CODE).toContain("g.bidsWon = (g.bidsWon || 0) + 1");
    expect(SCREEN_CODE).toContain("g.bidsLost = (g.bidsLost || 0) + 1");
  });

  test("won and lost always sum to placed", () => {
    // The invariant that makes the rate meaningful.
    const g = running({ bidsPlaced: 0, bidsWon: 0, bidsLost: 0 });
    let s = g;
    for (let i = 0; i < TICKS_PER_DAY * 120; i++) s = gameTick(s);
    expect((s.bidsWon || 0) + (s.bidsLost || 0)).toBe(s.bidsPlaced || 0);
  });

  test("jobHistory records how late each job was, so on-time rate is measurable", () => {
    expect(SCREEN_CODE).toMatch(/quality: _qualLabel, daysLate/);
  });
});

describe("a job driven to completion through the real tick reaches the KPIs", () => {
  test("finishing a job on time produces a measurable on-time rate", () => {
    let g = running({ jobHistory: [] });
    g.activeSites = [{
      id: "kpi-site", contractId: "c-kpi", label: "KPI Tower", client: "Harbor Trust",
      status: "Active", phases: ["Finish"], currentPhaseIdx: 0, phaseProgress: 99.9,
      assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: g.equipment.map((e) => e.id),
      materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
      totalValue: 90000, depositPaid: 20000, penaltyPerDay: 100,
      deadlineDay: g.day + 60, startDay: g.day - 3, siteMode: "normal", chaosHistory: [],
    }];
    for (const w of g.crew) w.status = "Working";
    for (const e of g.equipment) e.status = "Active";

    for (let i = 0; i < 300 && (g.activeSites || []).length > 0; i++) g = gameTick(g);

    expect(g.activeSites.length).toBe(0);
    const rated = (g.jobHistory || []).filter((j) => Number.isFinite(j.daysLate));
    expect(rated.length).toBeGreaterThan(0);
    expect(computeKPIs(g).onTimeRate).not.toBeNull();
  });
});

describe("snapshots accumulate over a real game and stay bounded", () => {
  test("a long run builds history without ballooning the save", () => {
    let g = running();
    for (let i = 0; i < TICKS_PER_DAY * 250; i++) g = gameTick(g);
    const snaps = g.kpiHistory?.snapshots || [];
    expect(snaps.length).toBeGreaterThan(1);
    expect(snaps.length).toBeLessThanOrEqual(MAX_KPI_SNAPSHOTS);
    // Newest first, and spaced by the interval.
    expect(snaps[0].day).toBeGreaterThan(snaps[snaps.length - 1].day);
  });

  test("400 ticks never produce a NaN KPI", () => {
    let g = running();
    for (let i = 0; i < 400; i++) {
      g = gameTick(g);
      const k = computeKPIs(g);
      for (const def of KPI_DEFS) {
        const v = k[def.key];
        expect(v === null || Number.isFinite(v)).toBe(true);
      }
    }
  });

  test("the first snapshot is not taken before the interval has elapsed", () => {
    let g = running({ day: 1, kpiHistory: { snapshots: [], lastSnapshotDay: 0 } });
    for (let i = 0; i < TICKS_PER_DAY * (KPI_SNAPSHOT_INTERVAL - 2); i++) g = gameTick(g);
    expect((g.kpiHistory?.snapshots || []).length).toBe(0);
  });
});

describe("save compatibility", () => {
  test("a build-5 save with no KPI history loads and starts one", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.kpiHistory;
    delete legacy.bidsWon;
    delete legacy.bidsLost;
    delete legacy.bidsPlaced;
    const migrated = migrateState(legacy);
    expect(Array.isArray(migrated.kpiHistory.snapshots)).toBe(true);
    expect(migrated.bidsWon).toBe(0);
    expect(migrated.bidsLost).toBe(0);
  });

  test("migration does not invent a bid record the player never had", () => {
    // completedJobs is NOT evidence of bids won: a returning player has no record of the bids
    // they lost, and a fabricated win rate would be the game making something up about them.
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.bidsWon; delete legacy.bidsLost; delete legacy.bidsPlaced;
    legacy.completedJobs = 30;
    const migrated = migrateState(legacy);
    expect(migrated.bidsWon).toBe(0);
    expect(computeKPIs(migrated).bidWinRate).toBeNull();
  });

  test("an existing KPI history survives migration", () => {
    const g = JSON.parse(JSON.stringify(freshState()));
    g.kpiHistory = { snapshots: [{ day: 7, onTimeRate: 0.8 }], lastSnapshotDay: 7 };
    const migrated = migrateState(g);
    expect(migrated.kpiHistory.snapshots).toHaveLength(1);
  });

  test("a corrupted KPI history is repaired rather than crashing the load", () => {
    const g = JSON.parse(JSON.stringify(freshState()));
    g.kpiHistory = "garbage";
    const migrated = migrateState(g);
    expect(Array.isArray(migrated.kpiHistory.snapshots)).toBe(true);
  });

  test("measures with no recorded history stay silent on a legacy save", () => {
    const legacy = migrateState(JSON.parse(JSON.stringify(freshState())));
    const rows = buildKPIRows(legacy);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

    // These depend on history the save does not have — a returning player must not be graded
    // on jobs, bids, clients or ledger activity that was never recorded.
    for (const key of ["onTimeRate", "bidWinRate", "clientRetention", "profitMargin", "revenuePerCrew"]) {
      expect({ key, ready: byKey[key].ready }).toEqual({ key, ready: false });
    }

    // Utilisation is deliberately NOT in that list. A fresh company really does have its
    // machines and crew sitting idle; that is measured from the roster in front of it, not
    // from missing history, and "0% — assign them to sites" is exactly the nudge it needs.
    expect(byKey.plantUtilisation.ready).toBe(true);
    expect(byKey.crewUtilisation.ready).toBe(true);
    expect(summarizePerformance(legacy).ready).toBe(true);
  });
});

describe("clients came out of the drawer", () => {
  test("the client roster is no longer hidden inside a CollapsibleSection", () => {
    const idx = SCREEN_CODE.indexOf("const activeClients = CLIENT_ROSTER");
    expect(idx).toBeGreaterThan(-1);
    const block = SCREEN_CODE.slice(idx, idx + 1600);
    expect(block).not.toContain("<CollapsibleSection");
    expect(block).toContain("<Card");
  });

  test("the card leads with what loyalty is actually worth", () => {
    const idx = SCREEN_CODE.indexOf("const activeClients = CLIENT_ROSTER");
    const block = SCREEN_CODE.slice(idx, idx + 1600);
    expect(block).toContain("loyalty premium");
  });
});
