// Living-company integration tests — the helpers wired into the real game.
//
// `companyLife.test.js` proves the helpers are correct in isolation. These prove the game
// uses them: that the offline return report is actually built from a real catch-up run, and
// — the property that matters most — that adding all of Phase 3's flavour text did not
// perturb the simulation's RNG sequence.
//
// That last one is FleetFlow's build 59 defect, and it is subtle enough to be worth an
// integration test rather than trusting the unit test: its `pushNewsFeedItem` minted keys
// with Math.random(), so a cosmetic headline consumed a draw the gated simulation behaviours
// read, and adding or removing a decorative line changed what the simulation did that day.

import {
  freshState,
  gameTick,
  applyOfflineProgress,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  snapshotSites,
  buildOfflineSiteReport,
  describeWorkerAssignment,
  workerVoiceLine,
  summarizeEquipmentEconomics,
  summarizeFleet,
} from "../src/systems/companyLife.js";

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function runningGame(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 200000;
  g.lastRealTimestamp = Date.now();
  for (const w of g.crew) w.status = "Working";
  for (const e of g.equipment) { e.status = "Active"; e.purchaseDay = 1; e.daysWorked = 0; }
  g.activeSites = [{
    id: "site-1",
    contractId: g.contracts[0].id,
    label: "Riverside Fence",
    client: "Acme Developments",
    status: "Active",
    phases: ["Site Prep", "Foundation", "Framing", "Handover"],
    currentPhaseIdx: 0,
    phaseProgress: 0,
    assignedCrewIds: g.crew.map((w) => w.id),
    assignedEquipmentIds: g.equipment.map((e) => e.id),
    crewMin: 1,
    equipMin: 1,
    totalValue: 100000,
    depositPaid: 25000,
    progressPaid: 0,
    phasesClaimed: 0,
    pendingDeliveries: [],
    materialsFulfilled: STOCKED,
    penaltyPerDay: 500,
    deadlineDay: g.day + 60,
    startDay: g.day,
    siteMode: "normal",
    chaosHistory: [],
    costs: { materials: 0, crew: 0, equipment: 0, incidents: 0, overhead: 0 },
  }];
  return { ...g, ...over };
}

describe("flavour text cannot change the simulation", () => {
  test("the whole companyLife module never calls Math.random", () => {
    const g = runningGame();
    const spy = jest.spyOn(Math, "random");
    try {
      for (const w of g.crew) {
        describeWorkerAssignment(w, g);
        workerVoiceLine(w, g);
      }
      for (const e of g.equipment) summarizeEquipmentEconomics(e, g);
      summarizeFleet(g);
      buildOfflineSiteReport(snapshotSites(g), g);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  test("a tick produces identical state whether or not the narration ran", () => {
    // The real test of the build 59 defect: run the same seeded sequence twice, calling all
    // the presentation helpers in between on one of them. If any of them consumed a draw,
    // the two runs would diverge.
    const seeded = (seed) => {
      let n = seed;
      return () => {
        n = (n * 1664525 + 1013904223) % 4294967296;
        return n / 4294967296;
      };
    };

    const runPlain = () => {
      const spy = jest.spyOn(Math, "random").mockImplementation(seeded(12345));
      try {
        let g = runningGame();
        for (let i = 0; i < 30; i++) g = gameTick(g);
        return g;
      } finally { spy.mockRestore(); }
    };

    const runNarrated = () => {
      const spy = jest.spyOn(Math, "random").mockImplementation(seeded(12345));
      try {
        let g = runningGame();
        for (let i = 0; i < 30; i++) {
          g = gameTick(g);
          // Everything the screen would render between ticks.
          for (const w of g.crew) { describeWorkerAssignment(w, g); workerVoiceLine(w, g); }
          for (const e of g.equipment) summarizeEquipmentEconomics(e, g);
          summarizeFleet(g);
        }
        return g;
      } finally { spy.mockRestore(); }
    };

    const plain = runPlain();
    const narrated = runNarrated();
    expect(narrated.cash).toBe(plain.cash);
    expect(narrated.day).toBe(plain.day);
    expect(narrated.reputation).toBe(plain.reputation);
    expect(narrated.activeSites.length).toBe(plain.activeSites.length);
    if (plain.activeSites[0]) {
      expect(narrated.activeSites[0].currentPhaseIdx).toBe(plain.activeSites[0].currentPhaseIdx);
      expect(narrated.activeSites[0].progressPaid).toBe(plain.activeSites[0].progressPaid);
    }
  });
});

describe("the away report is built from a real catch-up", () => {
  test("returning after a couple of days reports what each job did", () => {
    const g = runningGame();
    // 48 ticks per game day.
    const after = applyOfflineProgress(g, 96);

    expect(after.pendingOfflineSummary).toBeTruthy();
    const report = after.pendingOfflineSummary.siteReport;
    expect(Array.isArray(report)).toBe(true);
    expect(report.length).toBe(1);

    const line = report[0];
    expect(line.label).toBe("Riverside Fence");
    expect(["progressed", "completed", "stalled"]).toContain(line.kind);
    expect(line.headline).not.toContain("undefined");
    expect(line.detail).not.toContain("undefined");
  });

  test("a job that actually moved reports a higher percentage than it started at", () => {
    const g = runningGame();
    const startPercent = snapshotSites(g)["site-1"].percent;
    const after = applyOfflineProgress(g, 96);
    const line = after.pendingOfflineSummary.siteReport[0];

    if (line.kind === "progressed") {
      expect(line.percentTo).toBeGreaterThan(startPercent);
    } else {
      // Completed is the other acceptable outcome over two days on a small job.
      expect(line.kind).toBe("completed");
    }
  });

  test("progress claims banked while away are reported on the job that earned them", () => {
    const g = runningGame();
    const after = applyOfflineProgress(g, 240); // five days
    const line = after.pendingOfflineSummary.siteReport[0];
    if (line.kind === "progressed") {
      expect(Number.isFinite(line.claimed)).toBe(true);
      expect(line.claimed).toBeGreaterThanOrEqual(0);
    }
  });

  test("a company with no jobs returns an empty report, not a broken one", () => {
    const g = runningGame({ activeSites: [] });
    const after = applyOfflineProgress(g, 96);
    expect(after.pendingOfflineSummary.siteReport).toEqual([]);
  });

  test("the cash figures the report sits beside are still finite", () => {
    const after = applyOfflineProgress(runningGame(), 240);
    const s = after.pendingOfflineSummary;
    for (const key of ["cashDelta", "cashNow", "jobsDelta", "repDelta", "overheadPerDay", "elapsedDays"]) {
      expect(Number.isFinite(s[key])).toBe(true);
    }
  });
});

describe("people and machines describe real state", () => {
  test("a crew member on a site is reported on that site, by name and phase", () => {
    const g = runningGame();
    const where = describeWorkerAssignment(g.crew[0], g);
    expect(where.state).toBe("working");
    expect(where.label).toContain("Riverside Fence");
    expect(where.siteId).toBe("site-1");
  });

  test("a crew member with no site is reported as a cost, not as 'Idle'", () => {
    const g = runningGame({ activeSites: [] });
    const where = describeWorkerAssignment(g.crew[0], g);
    expect(where.state).toBe("idle");
    expect(where.tone).toBe("caution");
  });

  test("the fleet summary agrees with the sites about what is working", () => {
    const g = runningGame();
    const fleet = summarizeFleet(g);
    expect(fleet.total).toBe(g.equipment.length);
    expect(fleet.working).toBe(g.activeSites[0].assignedEquipmentIds.length);
    expect(fleet.working + fleet.parked + fleet.workshop).toBe(fleet.total);
  });

  test("a machine on a site reads as earning, and names the job", () => {
    const g = runningGame();
    const econ = summarizeEquipmentEconomics(g.equipment[0], g);
    expect(econ.onSite).toBe(true);
    expect(econ.verdict.label).toBe("Earning");
    expect(econ.siteLabel).toBe("Riverside Fence");
  });

  test("every worker in a real save produces a renderable line", () => {
    const g = runningGame();
    for (const w of g.crew) {
      const line = workerVoiceLine(w, g);
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toContain("undefined");
    }
  });

  test("after a long run, nothing about a worker or machine reads as NaN", () => {
    let g = runningGame();
    for (let i = 0; i < 200; i++) g = gameTick(g);
    for (const w of g.crew || []) {
      expect(typeof workerVoiceLine(w, g)).toBe("string");
      expect(describeWorkerAssignment(w, g).label).not.toContain("NaN");
    }
    for (const e of g.equipment || []) {
      const econ = summarizeEquipmentEconomics(e, g);
      expect(Number.isFinite(econ.utilisation)).toBe(true);
      expect(Number.isFinite(econ.resaleEstimate)).toBe(true);
      expect(econ.verdict.detail).not.toContain("NaN");
    }
  });
});
