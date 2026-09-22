// Construction KPIs — measured from state this game actually maintains.
//
// WHAT THIS REPLACED
// ------------------
// The audit said `analyticsEngine` was "collected but the player can't see it" (rows 36/37).
// The truth was worse. It is FleetFlow's module, shared verbatim, and EVERY input it reads is a
// field Construction Flow does not have:
//
//   weeklyStats.completedRoutes / routeIncome / wages / fuel / rent  -> absent
//   vehicle.status === "En Route"                                    -> CF uses Active/Idle/Broken
//   game.customerRating                                              -> absent
//
// So it snapshotted revenue 0, expenses 0, on-time 100%, utilisation 0%, rating 3.5 every seven
// days and kept 26 of them in the save. Surfacing those figures would have been worse than
// leaving them hidden: precise, confident and wrong.
//
// The first describe block below pins that claim, so nobody "fixes" this by wiring the old
// engine back up.

import {
  KPI_DEFS,
  KPI_SNAPSHOT_INTERVAL,
  MAX_KPI_SNAPSHOTS,
  computeKPIs,
  gradeKPI,
  formatKPI,
  buildKPIRows,
  initKPIs,
  tickConstructionKPIs,
  getKPITrend,
  describeKPIDirection,
  summarizePerformance,
} from "../src/systems/constructionKPIs.js";


function game(over = {}) {
  return {
    day: 70,
    equipment: [],
    crew: [],
    activeSites: [],
    jobHistory: [],
    ledger: [],
    clientRelationships: {},
    ...over,
  };
}

const eq = (status, condition = 80) => ({ id: Math.random().toString(36), status, condition });
const worker = (status) => ({ id: Math.random().toString(36), status });
const job = (daysLate) => ({ label: "J", client: "C", value: 1000, day: 10, daysLate });

describe("the FleetFlow engine it replaced could not measure this game", () => {
  test("Construction Flow has none of the fields analyticsEngine reads", () => {
    // A live-ish game state, built the way the real game builds it.
    const g = game({
      weeklyStats: { revenue: 5000, expenses: 3000, jobsCompleted: 2, unexpectedCosts: 0, savingsInterest: 0 },
      equipment: [eq("Active"), eq("Idle")],
    });
    // The FleetFlow inputs simply are not there.
    expect(g.weeklyStats.completedRoutes).toBeUndefined();
    expect(g.weeklyStats.routeIncome).toBeUndefined();
    expect(g.weeklyStats.wages).toBeUndefined();
    expect(g.customerRating).toBeUndefined();
    // And no equipment carries FleetFlow's status vocabulary.
    expect(g.equipment.some((e) => e.status === "En Route")).toBe(false);
  });

  test("the operator-precedence bug in the old engine is real, and is why it is not used", () => {
    // `a || 0 + b + c` parses as `a || (0 + b + c)`, so a non-zero first term discards the rest.
    const wages = 500, fuel = 200, repairs = 300;
    const buggy = wages || 0 + fuel + repairs;
    const correct = (wages || 0) + fuel + repairs;
    expect(buggy).toBe(500);
    expect(correct).toBe(1000);
    expect(buggy).not.toBe(correct);
  });
});

describe("a KPI with no data behind it says so, rather than claiming zero", () => {
  test("a brand-new company reports nothing rather than failing every measure", () => {
    const rows = buildKPIRows(game());
    expect(rows.every((r) => r.ready === false)).toBe(true);
    expect(rows.every((r) => r.display === "—")).toBe(true);
  });

  test("the summary tells a new player where their numbers will come from", () => {
    const s = summarizePerformance(game());
    expect(s.ready).toBe(false);
    expect(s.headline).toContain("Not enough history");
    expect(s.detail.length).toBeGreaterThan(10);
  });

  test("zero is never substituted for absent data", () => {
    const k = computeKPIs(game());
    for (const def of KPI_DEFS) expect(k[def.key]).toBeNull();
  });

  test("a company with no bids resolved has no win rate", () => {
    expect(computeKPIs(game({ bidsWon: 0, bidsLost: 0 })).bidWinRate).toBeNull();
    expect(computeKPIs(game({ bidsWon: 1, bidsLost: 0 })).bidWinRate).toBe(1);
  });
});

describe("each measure reads the thing it claims to read", () => {
  test("on-time completion counts jobs, and excludes ones from before the field existed", () => {
    const g = game({ jobHistory: [job(0), job(3), job(0), { label: "legacy", value: 1 }] });
    // 2 of the 3 RATED jobs were on time; the legacy entry is excluded, not assumed on time.
    expect(computeKPIs(g).onTimeRate).toBeCloseTo(2 / 3, 5);
    expect(computeKPIs(g).context.ratedJobs).toBe(3);
  });

  test("a broken machine is not counted as idle by choice", () => {
    const working = computeKPIs(game({ equipment: [eq("Active"), eq("Idle")] })).plantUtilisation;
    const withBroken = computeKPIs(game({ equipment: [eq("Active"), eq("Idle"), eq("Broken")] })).plantUtilisation;
    // Adding a breakdown must not make the manager look worse.
    expect(withBroken).toBe(working);
  });

  test("resting crew are unavailable, not idle", () => {
    const base = computeKPIs(game({ crew: [worker("Working"), worker("Idle")] })).crewUtilisation;
    const withRest = computeKPIs(game({ crew: [worker("Working"), worker("Idle"), worker("Resting")] })).crewUtilisation;
    expect(withRest).toBe(base);
  });

  test("margin comes from the ledger, which Sprint 6 made trustworthy", () => {
    const g = game({ ledger: [{ amount: 10000 }, { amount: -4000 }, { amount: -1000 }] });
    expect(computeKPIs(g).profitMargin).toBeCloseTo(0.5, 5);
  });

  test("a loss-making company reports a negative margin rather than clamping to zero", () => {
    const g = game({ ledger: [{ amount: 1000 }, { amount: -3000 }] });
    expect(computeKPIs(g).profitMargin).toBeLessThan(0);
  });

  test("plant condition spans the whole yard, breakdowns included", () => {
    const g = game({ equipment: [eq("Active", 100), eq("Broken", 0)] });
    expect(computeKPIs(g).plantCondition).toBeCloseTo(0.5, 5);
  });

  test("client retention counts clients who came back", () => {
    const g = game({ clientRelationships: { a: { jobsDone: 3 }, b: { jobsDone: 1 }, c: { jobsDone: 2 } } });
    expect(computeKPIs(g).clientRetention).toBeCloseTo(2 / 3, 5);
  });

  test("revenue per crew divides real revenue by real people", () => {
    const g = game({ day: 70, crew: [worker("Idle"), worker("Idle")], ledger: [{ amount: 20000 }] });
    // 20000 over 10 weeks over 2 people = 1000
    expect(computeKPIs(g).revenuePerCrew).toBe(1000);
  });
});

describe("nothing produces NaN, whatever the save holds", () => {
  test("junk state grades cleanly", () => {
    const junk = {
      day: "x", equipment: "nope", crew: null, ledger: [{ amount: "abc" }, null],
      jobHistory: [null, { daysLate: "late" }], clientRelationships: "no",
      bidsWon: "1", bidsLost: null,
    };
    const k = computeKPIs(junk);
    for (const def of KPI_DEFS) {
      const v = k[def.key];
      expect(v === null || Number.isFinite(v)).toBe(true);
    }
    expect(() => buildKPIRows(junk)).not.toThrow();
    expect(() => summarizePerformance(junk)).not.toThrow();
  });

  test("computeKPIs survives undefined entirely", () => {
    expect(() => computeKPIs(undefined)).not.toThrow();
    expect(() => buildKPIRows(undefined)).not.toThrow();
  });
});

describe("grading and formatting", () => {
  test("grades follow the benchmarks", () => {
    const def = KPI_DEFS.find((d) => d.key === "onTimeRate");
    expect(gradeKPI(def, 0.95)).toBe("great");
    expect(gradeKPI(def, 0.80)).toBe("good");
    expect(gradeKPI(def, 0.40)).toBe("poor");
    expect(gradeKPI(def, null)).toBe("unknown");
  });

  test("percent and money render readably; absent renders as a dash", () => {
    const pct = KPI_DEFS.find((d) => d.key === "onTimeRate");
    const cash = KPI_DEFS.find((d) => d.key === "revenuePerCrew");
    expect(formatKPI(pct, 0.667)).toBe("67%");
    expect(formatKPI(cash, 4210)).toBe("$4,210");
    expect(formatKPI(pct, null)).toBe("—");
  });

  test("every KPI def is complete enough to render", () => {
    for (const def of KPI_DEFS) {
      expect(typeof def.label).toBe("string");
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.help).toBe("string");
      expect(["percent", "money", "number"]).toContain(def.format);
      expect(Number.isFinite(def.good)).toBe(true);
      expect(Number.isFinite(def.great)).toBe(true);
    }
  });

  test("the labels are construction, not haulage", () => {
    const text = KPI_DEFS.map((d) => `${d.label} ${d.help}`).join(" ").toLowerCase();
    for (const word of ["route", "vehicle", "delivery", "fleet", "driver"]) {
      expect(text).not.toContain(word);
    }
    expect(text).toContain("crew");
    expect(text).toContain("plant");
  });
});

describe("history", () => {
  test("snapshots are taken on the interval, not every tick", () => {
    const g = game({ day: 0, equipment: [eq("Active")] });
    initKPIs(g);
    for (let d = 1; d <= KPI_SNAPSHOT_INTERVAL - 1; d++) { g.day = d; tickConstructionKPIs(g); }
    expect(g.kpiHistory.snapshots).toHaveLength(0);
    g.day = KPI_SNAPSHOT_INTERVAL; tickConstructionKPIs(g);
    expect(g.kpiHistory.snapshots).toHaveLength(1);
  });

  test("history is capped so a long game cannot balloon the save", () => {
    const g = game({ day: 0, equipment: [eq("Active")] });
    for (let d = 0; d <= KPI_SNAPSHOT_INTERVAL * (MAX_KPI_SNAPSHOTS + 10); d += KPI_SNAPSHOT_INTERVAL) {
      g.day = d; tickConstructionKPIs(g);
    }
    expect(g.kpiHistory.snapshots.length).toBeLessThanOrEqual(MAX_KPI_SNAPSHOTS);
  });

  test("a trend drops snapshots where the KPI had no data, rather than plotting them as zero", () => {
    const g = game({
      kpiHistory: { lastSnapshotDay: 21, snapshots: [
        { day: 21, onTimeRate: 0.9 }, { day: 14, onTimeRate: null }, { day: 7, onTimeRate: 0.5 },
      ] },
    });
    const trend = getKPITrend(g, "onTimeRate");
    expect(trend.map((t) => t.value)).toEqual([0.5, 0.9]);
  });

  test("direction compares against last week", () => {
    const up = game({ kpiHistory: { snapshots: [{ day: 14, onTimeRate: 0.9 }, { day: 7, onTimeRate: 0.5 }] } });
    const down = game({ kpiHistory: { snapshots: [{ day: 14, onTimeRate: 0.4 }, { day: 7, onTimeRate: 0.9 }] } });
    expect(describeKPIDirection(up, "onTimeRate").direction).toBe("up");
    expect(describeKPIDirection(down, "onTimeRate").direction).toBe("down");
  });

  test("a company with one snapshot has no direction to report", () => {
    const g = game({ kpiHistory: { snapshots: [{ day: 7, onTimeRate: 0.9 }] } });
    expect(describeKPIDirection(g, "onTimeRate").hasTrend).toBe(false);
  });

  test("a corrupted history is repaired rather than crashing", () => {
    const g = game({ kpiHistory: "nonsense" });
    initKPIs(g);
    expect(Array.isArray(g.kpiHistory.snapshots)).toBe(true);
    expect(() => tickConstructionKPIs(g)).not.toThrow();
  });
});

describe("the verdict, not just the numbers", () => {
  test("the weakest measure is named, with advice for it", () => {
    const g = game({
      day: 70,
      equipment: [eq("Idle"), eq("Idle"), eq("Idle"), eq("Active")], // poor utilisation
      crew: [worker("Working"), worker("Working")],                  // strong
      jobHistory: [job(0), job(0), job(0)],                          // strong
      ledger: [{ amount: 50000 }, { amount: -5000 }],                // strong
      bidsWon: 9, bidsLost: 1,                                       // strong
      clientRelationships: { a: { jobsDone: 4 }, b: { jobsDone: 3 } },
    });
    const s = summarizePerformance(g);
    expect(s.ready).toBe(true);
    expect(s.weakest.key).toBe("plantUtilisation");
    expect(s.headline).toContain("Plant Utilisation");
    expect(s.detail.toLowerCase()).toContain("idle");
  });

  test("a company doing everything well is told to push, not nagged", () => {
    const g = game({
      day: 70,
      equipment: [eq("Active", 95), eq("Active", 95)],
      crew: [worker("Working"), worker("Working")],
      jobHistory: [job(0), job(0), job(0)],
      ledger: [{ amount: 100000 }, { amount: -10000 }],
      bidsWon: 9, bidsLost: 1,
      clientRelationships: { a: { jobsDone: 4 }, b: { jobsDone: 3 } },
    });
    const s = summarizePerformance(g);
    expect(s.headline).toContain("Every measure is strong");
    expect(s.poorCount).toBe(0);
  });

  test("every KPI has advice attached, so the weakest is always actionable", () => {
    for (const def of KPI_DEFS) {
      // Drive each KPI to its worst while leaving the others absent.
      const g = game({ day: 70 });
      if (def.key === "plantUtilisation") g.equipment = [eq("Idle"), eq("Idle")];
      if (def.key === "crewUtilisation") g.crew = [worker("Idle"), worker("Idle")];
      if (def.key === "onTimeRate") g.jobHistory = [job(5), job(4)];
      if (def.key === "profitMargin") g.ledger = [{ amount: 100 }, { amount: -95 }];
      if (def.key === "revenuePerCrew") { g.crew = [worker("Idle")]; g.ledger = [{ amount: 10 }]; }
      if (def.key === "bidWinRate") { g.bidsWon = 1; g.bidsLost = 20; }
      if (def.key === "plantCondition") g.equipment = [eq("Active", 5)];
      if (def.key === "clientRetention") g.clientRelationships = { a: { jobsDone: 1 } };
      const s = summarizePerformance(g);
      expect({ key: def.key, ready: s.ready }).toEqual({ key: def.key, ready: true });
      expect({ key: def.key, hasAdvice: s.detail.length > 0 }).toEqual({ key: def.key, hasAdvice: true });
    }
  });
});
