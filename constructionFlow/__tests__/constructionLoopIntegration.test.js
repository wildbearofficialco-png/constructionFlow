// Core loop integration tests — the pure helpers wired into the real game state.
//
// `constructionLoop.test.js` proves the helpers are correct in isolation. These prove the
// game actually uses them: that a save carries the new fields, that an old save survives,
// that a job pays out exactly what it is worth however its money is timed, and that the two
// dominated options the audit found are genuinely decisions now.
//
// The payout invariant is the one to care about. Releasing a contract's money across the job
// instead of at its two ends is precisely the change that quietly mints or loses money, and
// the WildBear testing standard names "duplicate payouts" as a protected property.

import {
  freshState,
  migrateState,
  gameTick,
  createContract,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  planBid,
  BID_STYLES,
  DEPOSIT_SHARE,
  PROGRESS_SHARE,
  progressPaymentTarget,
  finalPaymentDue,
  NORMAL_DELIVERY_DAYS,
} from "../src/systems/constructionLoop.js";

// Enough of every material that a test site never stalls on supply. Work halts while
// materials are outstanding — that is the point of the delivery system — so any test about
// phases or payments has to stock the site first or it measures the stall instead.
const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

// A site part-way through a job, with the Phase 2 fields a live save carries.
function siteOn(g, over = {}) {
  const contract = g.contracts[0];
  return {
    id: "site-1",
    contractId: contract.id,
    label: "Test Build",
    client: "Test Client",
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
    materialsFulfilled: {},
    penaltyPerDay: 500,
    deadlineDay: g.day + 30,
    startDay: g.day,
    siteMode: "normal",
    chaosHistory: [],
    costs: { materials: 0, crew: 0, equipment: 0, incidents: 0, overhead: 0 },
    ...over,
  };
}

describe("new saves carry the loop's state", () => {
  test("a site created by the game has somewhere to track orders and claims", () => {
    // freshState has no active sites, so this asserts the shape the migration guarantees.
    const g = migrateState(JSON.parse(JSON.stringify({ ...freshState(), activeSites: [{ id: "s", phases: ["A"] }] })));
    const site = g.activeSites[0];
    expect(Array.isArray(site.pendingDeliveries)).toBe(true);
    expect(site.progressPaid).toBe(0);
    expect(site.phasesClaimed).toBe(0);
  });

  test("a build-1 save with a running job loads and keeps its money", () => {
    // The shape a device upgrading from build 1 actually has: no delivery queue, no claims.
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.cash = 61234;
    legacy.activeSites = [{
      id: "old-site",
      contractId: legacy.contracts[0].id,
      label: "Legacy Job",
      phases: ["Site Prep", "Foundation"],
      currentPhaseIdx: 1,
      phaseProgress: 30,
      assignedCrewIds: [],
      assignedEquipmentIds: [],
      totalValue: 50000,
      depositPaid: 12500,
      materialsFulfilled: { lumber: 20 },
      status: "Active",
    }];

    const loaded = migrateState(legacy);
    expect(loaded.cash).toBe(61234);
    const site = loaded.activeSites[0];
    expect(site.totalValue).toBe(50000);
    expect(site.depositPaid).toBe(12500);
    // Given the new fields, defaulted so nothing is owed retroactively and nothing is lost.
    expect(site.pendingDeliveries).toEqual([]);
    expect(site.progressPaid).toBe(0);
    expect(site.phasesClaimed).toBe(0);
  });

  test("migrating twice is idempotent — a claim already paid is not reset", () => {
    const g = freshState();
    g.activeSites = [{ id: "s", phases: ["A", "B"], progressPaid: 9000, phasesClaimed: 1, pendingDeliveries: [{ id: "d" }] }];
    const once = migrateState(JSON.parse(JSON.stringify(g)));
    const twice = migrateState(JSON.parse(JSON.stringify(once)));
    expect(twice.activeSites[0].progressPaid).toBe(9000);
    expect(twice.activeSites[0].phasesClaimed).toBe(1);
    expect(twice.activeSites[0].pendingDeliveries).toHaveLength(1);
  });
});

describe("THE PAYOUT INVARIANT: timing changed, totals did not", () => {
  test("a completed job pays exactly its contract value, however it was staged", () => {
    // Walk the payment schedule a real four-phase job produces and assert the three
    // components sum to the contract value.
    for (const value of [10000, 48000, 100000, 999983]) {
      for (const phaseCount of [1, 2, 4, 7]) {
        const deposit = Math.round(value * DEPOSIT_SHARE);
        const claims = progressPaymentTarget(value, phaseCount, Math.max(0, phaseCount - 1));
        const final = finalPaymentDue(value, 0, deposit, claims);
        expect(deposit + claims + final).toBe(value);
      }
    }
  });

  test("a late penalty comes off what is still owed, and never claws back released cash", () => {
    // Liquidated damages are withheld from the final certificate; a client cannot reach into
    // the contractor's account for money already paid. So the total received is the contract
    // less the penalty, floored at whatever has already been released. See the note on
    // finalPaymentDue in constructionLoop.js — this is a balance decision, stated on purpose.
    const value = 100000;
    const deposit = Math.round(value * DEPOSIT_SHARE);
    const claims = progressPaymentTarget(value, 4, 3);
    const released = deposit + claims;

    for (const penalty of [0, 2500, 40000, 85000]) {
      const final = finalPaymentDue(value, penalty, deposit, claims);
      expect(deposit + claims + final).toBe(Math.max(released, value - penalty));
      expect(final).toBeGreaterThanOrEqual(0);
    }
  });

  test("a job behind on its phases is fully exposed to the penalty", () => {
    // The case that matters for balance: a late job is normally late *because* its phases
    // are not done, so few claims have been released and the penalty has room to bite.
    const value = 100000;
    const deposit = Math.round(value * DEPOSIT_SHARE);
    const claims = progressPaymentTarget(value, 4, 0); // nothing certified yet
    expect(claims).toBe(0);
    for (const penalty of [0, 2500, 40000]) {
      expect(deposit + claims + finalPaymentDue(value, penalty, deposit, claims)).toBe(value - penalty);
    }
  });

  test("claims never exceed the progress share, so handover is never zero on an on-time job", () => {
    const value = 100000;
    const claims = progressPaymentTarget(value, 4, 99);
    expect(claims).toBe(Math.round(value * PROGRESS_SHARE));
    const deposit = Math.round(value * DEPOSIT_SHARE);
    expect(finalPaymentDue(value, 0, deposit, claims)).toBeGreaterThan(0);
  });
});

describe("material orders take time and the site says so", () => {
  test("an order placed today has not arrived today", () => {
    const g = freshState();
    g.setupDone = true;
    g.activeSites = [siteOn(g, {
      pendingDeliveries: [{
        id: "d1", matId: "concrete", label: "Concrete", unit: "m³",
        qty: 40, cost: 4800, emergency: false,
        orderedDay: g.day, arrivesDay: g.day + NORMAL_DELIVERY_DAYS,
      }],
    })];

    const after = gameTick(g);
    // Same day: still in transit, nothing added to the site's materials.
    expect(after.activeSites[0].pendingDeliveries).toHaveLength(1);
    expect(after.activeSites[0].materialsFulfilled.concrete || 0).toBe(0);
  });

  test("an order that has come due lands, and announces itself", () => {
    const g = freshState();
    g.setupDone = true;
    g.activeSites = [siteOn(g, {
      pendingDeliveries: [{
        id: "d1", matId: "concrete", label: "Concrete", unit: "m³",
        qty: 40, cost: 4800, emergency: false,
        orderedDay: g.day - NORMAL_DELIVERY_DAYS, arrivesDay: g.day,
      }],
    })];

    const after = gameTick(g);
    expect(after.activeSites[0].pendingDeliveries).toHaveLength(0);
    expect(after.activeSites[0].materialsFulfilled.concrete).toBe(40);
    expect(after.logs.some((l) => l.includes("Concrete"))).toBe(true);
  });

  test("a delivery landing does not move cash — it was paid for at the order", () => {
    const g = freshState();
    g.setupDone = true;
    g.activeSites = [siteOn(g, {
      pendingDeliveries: [{
        id: "d1", matId: "steel", label: "Steel", unit: "t",
        qty: 3, cost: 2850, emergency: false, orderedDay: g.day - 2, arrivesDay: g.day,
      }],
    })];
    const before = g.cash;
    const after = gameTick(g);
    // Wages and overhead still tick, so cash can fall — but never by the delivery's cost.
    expect(before - after.cash).toBeLessThan(2850);
  });

  test("ticking many times never delivers the same order twice", () => {
    let g = freshState();
    g.setupDone = true;
    g.activeSites = [siteOn(g, {
      pendingDeliveries: [{
        id: "d1", matId: "concrete", label: "Concrete", unit: "m³",
        qty: 40, cost: 4800, emergency: false, orderedDay: g.day, arrivesDay: g.day,
      }],
    })];
    for (let i = 0; i < 40; i++) g = gameTick(g);
    const site = g.activeSites[0];
    // The site may have completed and been removed; if it is still running, it holds exactly
    // the ordered quantity and nothing is left in transit.
    if (site) {
      expect(site.materialsFulfilled.concrete).toBe(40);
      expect(site.pendingDeliveries).toHaveLength(0);
    }
  });
});

describe("a completed phase is a moment, and releases a claim", () => {
  test("finishing a phase announces it and pays a progress claim", () => {
    const g = freshState();
    g.setupDone = true;
    g.cash = 200000;
    // Sitting at the very edge of phase 1 so one tick tips it over.
    // Materials in hand, or the site stalls and the phase never tips over.
    g.activeSites = [siteOn(g, { phaseProgress: 99.99, materialsFulfilled: STOCKED })];
    const cashBefore = g.cash;

    const after = gameTick(g);
    const site = after.activeSites[0];

    expect(site.currentPhaseIdx).toBe(1);
    expect(site.phasesClaimed).toBe(1);
    expect(site.progressPaid).toBeGreaterThan(0);
    expect(after.cash).toBeGreaterThan(cashBefore);
    expect(after.logs.some((l) => l.includes("Site Prep") && l.includes("complete"))).toBe(true);
    expect(after.logs.some((l) => l.includes("Progress payment"))).toBe(true);
  });

  test("claims across a whole job total exactly the progress share", () => {
    const g = freshState();
    g.setupDone = true;
    g.cash = 200000;
    const value = 100000;
    let state = { ...g, activeSites: [siteOn(g, { totalValue: value, phaseProgress: 99.99, materialsFulfilled: STOCKED })] };

    // Tip each non-final phase over in turn.
    for (let i = 0; i < 3; i++) {
      state = gameTick(state);
      const site = state.activeSites[0];
      if (!site) break;
      site.phaseProgress = 99.99;
    }

    const site = state.activeSites[0];
    if (site) {
      // Assert against the site's CURRENT value, not the value it started with. A contract's
      // worth legitimately changes mid-job — a scope change or client praise adds to it, a
      // payment hold subtracts — and claims are certified against what the job is worth now.
      // Pinning the starting value here made this test flaky roughly 1 run in 400, and the
      // flake was the test's, not the code's.
      expect(site.progressPaid).toBeLessThanOrEqual(Math.round(site.totalValue * PROGRESS_SHARE));
      expect(site.progressPaid).toBe(progressPaymentTarget(site.totalValue, site.phases.length, site.phasesClaimed));
    }
  });

  test("a contract whose value changes mid-job still pays out exactly once", () => {
    // Scope changes, client praise and payment holds all move `site.totalValue` while the job
    // runs. The claim schedule has to tolerate that in both directions without ever paying
    // more than the contract is worth or clawing back cash already released.
    const value = 100000;
    const deposit = Math.round(value * DEPOSIT_SHARE);

    // Value rises after two claims were certified against the old figure.
    const afterTwo = progressPaymentTarget(value, 4, 2);
    const raised = 140000;
    const raisedTarget = progressPaymentTarget(raised, 4, 3);
    expect(raisedTarget).toBeGreaterThan(afterTwo);
    expect(deposit + raisedTarget + finalPaymentDue(raised, 0, deposit, raisedTarget)).toBe(raised);

    // Value falls below what has already been claimed: nothing is clawed back, and the
    // handover simply owes nothing.
    const slashed = 30000;
    const overClaimed = afterTwo;
    expect(finalPaymentDue(slashed, 0, deposit, overClaimed)).toBe(0);
    expect(deposit + overClaimed).toBeGreaterThan(slashed);
  });

  test("the final phase pays at handover, not as a claim", () => {
    const g = freshState();
    g.setupDone = true;
    g.cash = 200000;
    // Last phase, about to complete.
    let state = { ...g, activeSites: [siteOn(g, { currentPhaseIdx: 3, phasesClaimed: 3, progressPaid: 50000, phaseProgress: 99.99, materialsFulfilled: STOCKED })] };
    state = gameTick(state);
    // The site is finished and removed from the active list, or marked Complete.
    const stillActive = (state.activeSites || []).find((s) => s.id === "site-1" && s.status === "Active");
    expect(stillActive).toBeUndefined();
    // A claim is never released for the final phase, so the count cannot have risen.
    const done = (state.activeSites || []).find((s) => s.id === "site-1");
    if (done) expect(done.phasesClaimed).toBe(3);
  });
});

describe("the bid is a decision, not a formality", () => {
  test("a brand-new company cannot lose its first contract", () => {
    // The tutorial points at a specific job. Losing it would fail the first-minute rule.
    const g = freshState();
    const c = createContract(g);
    for (const s of BID_STYLES) {
      const plan = planBid(c, s.key, g);
      expect(plan.guaranteed).toBe(true);
      expect(plan.winPercent).toBe(100);
    }
  });

  test("every style is reachable and none is free money", () => {
    // Past the opening guarantee, so the odds are the real ones.
    const g = { ...freshState(), completedJobs: 3 };
    const c = createContract(g);
    const plans = BID_STYLES.map((s) => planBid(c, s.key, g));
    // The premium bid pays the most and is the least likely; that pairing is the decision.
    const premium = plans.find((p) => p.styleKey === "premium");
    const aggressive = plans.find((p) => p.styleKey === "aggressive");
    expect(premium.effectiveValue).toBeGreaterThan(aggressive.effectiveValue);
    expect(premium.winChance).toBeLessThan(aggressive.winChance);
  });

  test("the odds shown on a real contract are always usable numbers", () => {
    const g = { ...freshState(), completedJobs: 3 };
    for (let i = 0; i < 25; i++) {
      const c = createContract(g);
      for (const s of BID_STYLES) {
        const plan = planBid(c, s.key, g);
        expect(plan.winPercent).toBeGreaterThanOrEqual(25);
        expect(plan.winPercent).toBeLessThanOrEqual(97);
        expect(plan.effectiveValue).toBeGreaterThan(0);
        expect(plan.riskLabel.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("the economy stays sane over a long run", () => {
  test("300 ticks with a live job never produces NaN cash or a negative claim", () => {
    let g = freshState();
    g.setupDone = true;
    g.tutorialDone = true;
    g.cash = 150000;
    g.activeSites = [siteOn(g, { materialsFulfilled: { lumber: 999, concrete: 999, steel: 999 } })];

    for (let i = 0; i < 300; i++) {
      g = gameTick(g);
      expect(Number.isFinite(g.cash)).toBe(true);
      for (const s of g.activeSites || []) {
        expect(s.progressPaid).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(s.progressPaid)).toBe(true);
        expect(s.progressPaid).toBeLessThanOrEqual(Math.round((s.totalValue || 0) * PROGRESS_SHARE) + 1);
      }
    }
  });
});
