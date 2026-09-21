// Living-company contract tests.
//
// The property that matters most in this file is the RNG-free one. FleetFlow's build 59
// post-mortem found that its news-feed helper minted keys with Math.random(), so posting a
// purely cosmetic line consumed a draw from the same sequence the gated simulation behaviours
// read — adding or removing decorative text could change what the simulation did that day.
// Construction Flow is adding a lot of flavour text in this phase, so that failure mode is
// tested for directly rather than assumed away.

import {
  pickStable,
  describeWorkerAssignment,
  workerRiskFlags,
  workerVoiceLine,
  summarizeWorkerStanding,
  describeTraitEffects,
  summarizeEquipmentEconomics,
  summarizeFleet,
  snapshotSites,
  overallPercent,
  buildOfflineSiteReport,
} from "../src/systems/companyLife.js";

const worker = (over = {}) => ({
  id: "w1", name: "Dave Mercer", role: "Concreter", specialty: "Concrete",
  skill: 90, mood: 70, loyalty: 60, stamina: 80, wagePerDay: 200,
  status: "Idle", onShift: true, jobsCompleted: 4, hireDay: 1,
  trait: { label: "Reliable", speed: 1.03, safety: 1.05, quality: 1.02, wagePressure: 1.0 },
  ...over,
});

const site = (over = {}) => ({
  id: "s1", label: "Riverside Fence", status: "Active",
  phases: ["Site Prep", "Foundation", "Framing", "Handover"],
  currentPhaseIdx: 1, phaseProgress: 50,
  assignedCrewIds: [], assignedEquipmentIds: [],
  pendingDeliveries: [], progressPaid: 0,
  ...over,
});

const game = (over = {}) => ({ day: 40, activeSites: [], equipment: [], crew: [], ...over });

describe("pickStable — variety without touching the RNG", () => {
  test("never calls Math.random", () => {
    // The build 59 defect, tested for directly: flavour text must not consume a draw from
    // the sequence the simulation reads.
    const spy = jest.spyOn(Math, "random");
    try {
      for (let i = 0; i < 50; i++) pickStable(["a", "b", "c"], `seed-${i}`);
      workerVoiceLine(worker(), game());
      describeWorkerAssignment(worker(), game());
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  test("the same seed always gives the same answer", () => {
    const list = ["one", "two", "three", "four"];
    for (const seed of ["w1-40", "w2-9", "", "a very long seed string indeed"]) {
      expect(pickStable(list, seed)).toBe(pickStable(list, seed));
    }
  });

  test("different seeds spread across the list rather than collapsing to one entry", () => {
    const list = ["a", "b", "c", "d", "e"];
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(pickStable(list, `w${i}-1`));
    expect(seen.size).toBe(list.length);
  });

  test("an empty or missing list returns null rather than undefined", () => {
    expect(pickStable([], "x")).toBeNull();
    expect(pickStable(undefined, "x")).toBeNull();
    expect(pickStable(null, "x")).toBeNull();
  });

  test("a missing seed is handled, not thrown on", () => {
    expect(pickStable(["a"], undefined)).toBe("a");
    expect(pickStable(["a"], null)).toBe("a");
  });
});

describe("where a worker actually is", () => {
  test("names the job and the phase, not just 'Active'", () => {
    const g = game({ activeSites: [site({ assignedCrewIds: ["w1"] })] });
    const where = describeWorkerAssignment(worker(), g);
    expect(where.state).toBe("working");
    expect(where.label).toContain("Riverside Fence");
    expect(where.label).toContain("Foundation");
    expect(where.siteId).toBe("s1");
  });

  test("an idle worker is flagged as a cost, because that is what they are", () => {
    const where = describeWorkerAssignment(worker(), game());
    expect(where.state).toBe("idle");
    expect(where.tone).toBe("caution");
    expect(where.label).toContain("no site assigned");
  });

  test("a stood-down worker is distinguished from an idle one", () => {
    const g = game({ activeSites: [site({ status: "Paused", assignedCrewIds: ["w1"] })] });
    expect(describeWorkerAssignment(worker(), g).state).toBe("paused");
  });

  test("resting and off-shift are their own states", () => {
    expect(describeWorkerAssignment(worker({ status: "Resting" }), game()).state).toBe("resting");
    expect(describeWorkerAssignment(worker({ onShift: false }), game()).state).toBe("off");
  });

  test("a site with no phases does not produce 'undefined' on screen", () => {
    const g = game({ activeSites: [site({ phases: [], assignedCrewIds: ["w1"] })] });
    expect(describeWorkerAssignment(worker(), g).label).not.toContain("undefined");
  });

  test("garbage state never throws", () => {
    for (const g of [{}, { activeSites: null }, { activeSites: [null, "nope"] }, undefined]) {
      expect(() => describeWorkerAssignment(worker(), g)).not.toThrow();
    }
    expect(() => describeWorkerAssignment(undefined, undefined)).not.toThrow();
  });
});

describe("worker risk flags", () => {
  test("exhaustion outranks tiredness", () => {
    expect(workerRiskFlags(worker({ stamina: 10 }))[0].key).toBe("exhausted");
    expect(workerRiskFlags(worker({ stamina: 30 }))[0].key).toBe("tired");
    expect(workerRiskFlags(worker({ stamina: 80 }))).toHaveLength(0);
  });

  test("unhappiness and flight risk are surfaced before they cost you the person", () => {
    expect(workerRiskFlags(worker({ mood: 10 })).some((f) => f.key === "unhappy")).toBe(true);
    expect(workerRiskFlags(worker({ loyalty: 10 })).some((f) => f.key === "flight-risk")).toBe(true);
  });

  test("never more than three flags, so a card cannot become a wall", () => {
    const wreck = worker({ stamina: 5, mood: 5, loyalty: 5, attendanceStrikes: 4 });
    expect(workerRiskFlags(wreck).length).toBeLessThanOrEqual(3);
  });

  test("every flag carries something the player can act on", () => {
    for (const f of workerRiskFlags(worker({ stamina: 5, mood: 5, loyalty: 5 }))) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.detail.length).toBeGreaterThan(0);
      expect(["hazard", "caution", "info", "safe", "neutral"]).toContain(f.tone);
    }
  });

  test("a worker with missing stats is treated as fine, not as a crisis", () => {
    expect(workerRiskFlags({})).toHaveLength(0);
    expect(workerRiskFlags(undefined)).toHaveLength(0);
  });
});

describe("worker voice", () => {
  test("says the thing that needs acting on first", () => {
    const g = game();
    expect(workerVoiceLine(worker({ stamina: 5, mood: 90, loyalty: 90 }), g)).toMatch(/fumes|days straight/i);
    expect(workerVoiceLine(worker({ stamina: 90, mood: 5 }), g)).toMatch(/worth|Morale/i);
    expect(workerVoiceLine(worker({ stamina: 90, mood: 90, loyalty: 5 }), g)).toMatch(/another outfit|no move/i);
  });

  test("an idle worker asks for work", () => {
    expect(workerVoiceLine(worker(), game())).toMatch(/yard|daylight/i);
  });

  test("a long-serving loyal worker says so", () => {
    const g = game({ activeSites: [site({ assignedCrewIds: ["w1"] })] });
    expect(workerVoiceLine(worker({ loyalty: 90, jobsCompleted: 20 }), g)).toMatch(/boss|long time/i);
  });

  test("the same worker says the same thing all day, then something new tomorrow", () => {
    const w = worker({ loyalty: 90, jobsCompleted: 20 });
    const g = game({ activeSites: [site({ assignedCrewIds: ["w1"] })] });
    expect(workerVoiceLine(w, g)).toBe(workerVoiceLine(w, g));
    // Not a guarantee of difference (a two-line pool can repeat), but it must not throw and
    // must still be a line.
    expect(typeof workerVoiceLine(w, { ...g, day: 41 })).toBe("string");
  });

  test("always returns a line, never undefined", () => {
    for (const w of [{}, worker(), worker({ mood: 100, loyalty: 100, stamina: 100 })]) {
      const line = workerVoiceLine(w, game());
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe("worker standing", () => {
  test("tenure reads in the largest sensible unit", () => {
    expect(summarizeWorkerStanding(worker({ hireDay: 40 }), game({ day: 40 })).tenureLabel).toBe("Started today");
    expect(summarizeWorkerStanding(worker({ hireDay: 35 }), game({ day: 40 })).tenureLabel).toContain("5d");
    expect(summarizeWorkerStanding(worker({ hireDay: 1 }), game({ day: 100 })).tenureLabel).toContain("mo");
    expect(summarizeWorkerStanding(worker({ hireDay: 1 }), game({ day: 800 })).tenureLabel).toContain("y");
  });

  test("rank reflects jobs actually completed", () => {
    const ranks = [0, 1, 10, 25, 50, 100].map((jobs) =>
      summarizeWorkerStanding(worker({ jobsCompleted: jobs }), game()).rank
    );
    expect(ranks[0]).toBe("New hire");
    expect(ranks[5]).toBe("Company legend");
    expect(new Set(ranks).size).toBe(6);
  });

  test("a save with no hireDay does not report negative tenure", () => {
    expect(summarizeWorkerStanding({}, game({ day: 100 })).daysEmployed).toBe(0);
    // A hireDay in the future (corrupt save) is clamped, not rendered as "-30d".
    expect(summarizeWorkerStanding(worker({ hireDay: 200 }), game({ day: 100 })).daysEmployed).toBe(0);
  });
});

describe("trait effects", () => {
  test("a good trait reads positive and a bad one reads negative", () => {
    const fast = describeTraitEffects(worker({ trait: { speed: 1.14, safety: 0.96, quality: 0.97 } }));
    expect(fast.some((e) => e.label.includes("Speed +14%"))).toBe(true);
    expect(fast.some((e) => e.tone === "caution" || e.tone === "hazard")).toBe(true);
  });

  test("a wage-hungry trait is called out, because it costs money later", () => {
    const effects = describeTraitEffects(worker({ trait: { wagePressure: 1.18 } }));
    expect(effects.some((e) => e.label.includes("more money"))).toBe(true);
  });

  test("a worker with no trait yields no claims about them", () => {
    expect(describeTraitEffects({})).toEqual([]);
    expect(describeTraitEffects(undefined)).toEqual([]);
  });
});

describe("is this machine making me money", () => {
  const machine = (over = {}) => ({
    id: "e1", name: "CAT 320 Excavator", shopId: "excavator",
    condition: 80, dailyCost: 120, value: 90000,
    status: "Idle", purchaseDay: 1, daysWorked: 20, ...over,
  });

  test("a machine on a site is earning, and says which one", () => {
    const g = game({ activeSites: [site({ assignedEquipmentIds: ["e1"] })] });
    const econ = summarizeEquipmentEconomics(machine(), g);
    expect(econ.onSite).toBe(true);
    expect(econ.verdict.label).toBe("Earning");
    expect(econ.verdict.detail).toContain("Riverside Fence");
  });

  test("a machine in the workshop is named as a pure cost", () => {
    const econ = summarizeEquipmentEconomics(machine({ status: "Maintenance" }), game());
    expect(econ.verdict.tone).toBe("hazard");
    expect(econ.verdict.detail).toContain("earning nothing");
  });

  test("a long-owned, rarely-used machine is called underused", () => {
    const econ = summarizeEquipmentEconomics(machine({ daysWorked: 2, purchaseDay: 1 }), game({ day: 100 }));
    expect(econ.verdict.label).toBe("Underused");
    expect(econ.utilisation).toBeLessThan(10);
  });

  test("a machine bought days ago is not judged yet", () => {
    const econ = summarizeEquipmentEconomics(machine({ purchaseDay: 38, daysWorked: 0 }), game({ day: 40 }));
    expect(econ.verdict.label).toBe("Idle");
    expect(econ.verdict.detail).toContain("Not long enough");
  });

  test("utilisation is a percentage, always", () => {
    for (const [worked, owned] of [[0, 1], [50, 10], [5, 100], [-5, 10]]) {
      const econ = summarizeEquipmentEconomics(
        machine({ daysWorked: worked, purchaseDay: 1 }),
        game({ day: 1 + owned })
      );
      expect(econ.utilisation).toBeGreaterThanOrEqual(0);
      expect(econ.utilisation).toBeLessThanOrEqual(100);
    }
  });

  test("resale falls with condition but never to nothing", () => {
    const good = summarizeEquipmentEconomics(machine({ condition: 95 }), game()).resaleEstimate;
    const rough = summarizeEquipmentEconomics(machine({ condition: 20 }), game()).resaleEstimate;
    const wreck = summarizeEquipmentEconomics(machine({ condition: 0 }), game()).resaleEstimate;
    expect(good).toBeGreaterThan(rough);
    expect(wreck).toBeGreaterThan(0);
  });

  test("a machine record missing everything still produces usable numbers", () => {
    const econ = summarizeEquipmentEconomics({}, {});
    for (const key of ["daysOwned", "daysWorked", "utilisation", "dailyCost", "lifetimeCost", "resaleEstimate"]) {
      expect(Number.isFinite(econ[key])).toBe(true);
    }
    expect(econ.verdict.label.length).toBeGreaterThan(0);
  });
});

describe("the fleet at a glance", () => {
  test("every machine is counted exactly once", () => {
    const g = game({
      equipment: [
        { id: "a", dailyCost: 100, condition: 90, status: "Idle" },
        { id: "b", dailyCost: 200, condition: 50, status: "Idle" },
        { id: "c", dailyCost: 300, condition: 20, status: "Maintenance" },
      ],
      activeSites: [site({ assignedEquipmentIds: ["a"] })],
    });
    const fleet = summarizeFleet(g);
    expect(fleet.total).toBe(3);
    expect(fleet.working + fleet.parked + fleet.workshop).toBe(3);
    expect(fleet.working).toBe(1);
    expect(fleet.parked).toBe(1);
    expect(fleet.workshop).toBe(1);
  });

  test("the daily bill counts every machine, working or not", () => {
    const g = game({ equipment: [{ id: "a", dailyCost: 100 }, { id: "b", dailyCost: 200 }] });
    expect(summarizeFleet(g).dailyCost).toBe(300);
  });

  test("an empty yard reports zeroes, not NaN", () => {
    const fleet = summarizeFleet({});
    expect(fleet.total).toBe(0);
    expect(fleet.averageCondition).toBe(0);
    expect(fleet.utilisation).toBe(0);
    expect(Number.isFinite(fleet.dailyCost)).toBe(true);
  });

  test("a null machine in the list is skipped, not counted", () => {
    expect(summarizeFleet({ equipment: [null, { id: "a", dailyCost: 50 }] }).total).toBe(2);
    expect(summarizeFleet({ equipment: [null, { id: "a", dailyCost: 50 }] }).dailyCost).toBe(50);
  });
});

describe("overallPercent", () => {
  test("counts completed phases and the part-done one together", () => {
    expect(overallPercent({ phases: ["a", "b", "c", "d"], currentPhaseIdx: 0, phaseProgress: 0 })).toBe(0);
    expect(overallPercent({ phases: ["a", "b", "c", "d"], currentPhaseIdx: 2, phaseProgress: 0 })).toBe(50);
    expect(overallPercent({ phases: ["a", "b", "c", "d"], currentPhaseIdx: 4, phaseProgress: 0 })).toBe(100);
  });

  test("a failed inspection's negative progress never reads as negative overall", () => {
    expect(overallPercent({ phases: ["a", "b"], currentPhaseIdx: 1, phaseProgress: -20 })).toBe(50);
  });

  test("a phaseless site is 0, not NaN", () => {
    expect(overallPercent({})).toBe(0);
    expect(overallPercent(undefined)).toBe(0);
  });
});

describe("while you were away: the job sites", () => {
  test("a job that moved reports the phase change and the numbers", () => {
    const before = snapshotSites(game({ activeSites: [site({ currentPhaseIdx: 1, phaseProgress: 68 })] }));
    const after = game({ activeSites: [site({ currentPhaseIdx: 2, phaseProgress: 68 })] });
    const [line] = buildOfflineSiteReport(before, after);

    expect(line.kind).toBe("progressed");
    expect(line.headline).toContain("Foundation");
    expect(line.headline).toContain("Framing");
    expect(line.detail).toContain("%");
    expect(line.percentTo).toBeGreaterThan(line.percentFrom);
    expect(line.phasesDone).toBe(1);
  });

  test("a job that finished is reported as finished, not silently dropped", () => {
    const before = snapshotSites(game({ activeSites: [site()] }));
    const [line] = buildOfflineSiteReport(before, game({ activeSites: [] }));
    expect(line.kind).toBe("completed");
    expect(line.headline).toContain("finished");
  });

  test("a job that did not move says so — silence would hide a stall", () => {
    const before = snapshotSites(game({ activeSites: [site()] }));
    const [line] = buildOfflineSiteReport(before, game({ activeSites: [site()] }));
    expect(line.kind).toBe("stalled");
    expect(line.tone).toBe("caution");
  });

  test("a stall waiting on a delivery reads differently from one nobody has ordered for", () => {
    const stalledSite = site({ pendingDeliveries: [{ id: "d", arrivesDay: 42 }] });
    const before = snapshotSites(game({ activeSites: [stalledSite] }));
    const waiting = buildOfflineSiteReport(before, game({ activeSites: [stalledSite] }))[0];
    expect(waiting.detail).toContain("delivery");

    const bare = snapshotSites(game({ activeSites: [site()] }));
    const unordered = buildOfflineSiteReport(bare, game({ activeSites: [site()] }))[0];
    expect(unordered.detail).not.toContain("delivery");
  });

  test("progress claims banked while away are reported per job", () => {
    const before = snapshotSites(game({ activeSites: [site({ progressPaid: 0 })] }));
    const after = game({ activeSites: [site({ currentPhaseIdx: 2, progressPaid: 12500 })] });
    expect(buildOfflineSiteReport(before, after)[0].claimed).toBe(12500);
  });

  test("a job that started while away is reported, not missed", () => {
    const report = buildOfflineSiteReport({}, game({ activeSites: [site()] }));
    expect(report).toHaveLength(1);
    expect(report[0].kind).toBe("started");
  });

  test("several jobs each get their own line", () => {
    const before = snapshotSites(game({
      activeSites: [site(), site({ id: "s2", label: "Depot Slab", currentPhaseIdx: 0 })],
    }));
    const after = game({
      activeSites: [site({ currentPhaseIdx: 3 }), site({ id: "s2", label: "Depot Slab", currentPhaseIdx: 1 })],
    });
    const report = buildOfflineSiteReport(before, after);
    expect(report).toHaveLength(2);
    expect(report.map((l) => l.label).sort()).toEqual(["Depot Slab", "Riverside Fence"]);
  });

  test("no jobs means no report, not an error", () => {
    expect(buildOfflineSiteReport({}, game())).toEqual([]);
    expect(buildOfflineSiteReport(undefined, undefined)).toEqual([]);
  });

  test("every line is renderable — headline, detail, tone, all present", () => {
    const before = snapshotSites(game({ activeSites: [site(), site({ id: "s2", label: "Gone" })] }));
    const after = game({ activeSites: [site({ currentPhaseIdx: 3 })] });
    for (const line of buildOfflineSiteReport(before, after)) {
      expect(typeof line.headline).toBe("string");
      expect(line.headline.length).toBeGreaterThan(0);
      expect(typeof line.detail).toBe("string");
      expect(line.headline).not.toContain("undefined");
      expect(line.detail).not.toContain("undefined");
      expect(["safe", "caution", "hazard", "info", "neutral"]).toContain(line.tone);
    }
  });

  test("snapshotting skips malformed sites rather than throwing", () => {
    const snap = snapshotSites({ activeSites: [null, "nope", { label: "no id" }, site()] });
    expect(Object.keys(snap)).toEqual(["s1"]);
  });
});
