// Core construction loop contract tests.
//
// The two headline fixes in Phase 2 are both "this option was strictly dominated, so it was
// never a decision". These tests pin the property that makes each one a real choice, not just
// the numbers that happen to implement it today — so a future balance pass can retune the
// values without being able to silently reintroduce a dominant option.
//
// The progress-payment tests are the strictest in the file, because timing money differently
// is exactly the kind of change that quietly mints or loses it.

import {
  BID_STYLES,
  DEFAULT_BID_STYLE,
  getBidStyle,
  getBidCompetition,
  planBid,
  rollBidOutcome,
  pickWinningRival,
  NORMAL_DELIVERY_DAYS,
  EMERGENCY_DELIVERY_DAYS,
  planDeliveries,
  collectArrivedDeliveries,
  describeDelivery,
  nextDeliveryDay,
  summarizeSitePhases,
  describePhaseCompletion,
  DEPOSIT_SHARE,
  PROGRESS_SHARE,
  progressPaymentTarget,
  planProgressPayment,
  finalPaymentDue,
  summarizeSitePayments,
} from "../src/systems/constructionLoop.js";

const contract = (over = {}) => ({ id: "c1", value: 100000, category: "Commercial", ...over });
// An established company: past its first contract, so bids carry their real odds. Tests
// about the first-contract guarantee override completedJobs explicitly.
const game = (over = {}) => ({ reputation: 50, completedJobs: 3, rivals: [], acquiredRivals: [], ...over });

describe("bid styles are a real decision", () => {
  test("every style is fully specified", () => {
    for (const s of BID_STYLES) {
      expect(typeof s.key).toBe("string");
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.detail.length).toBeGreaterThan(0);
      expect(s.value).toBeGreaterThan(0);
      expect(s.baseWinChance).toBeGreaterThan(0);
      expect(s.baseWinChance).toBeLessThanOrEqual(1);
    }
  });

  test("a higher price always costs win probability", () => {
    // This is the property the old implementation lacked entirely: bid style moved payout
    // and nothing else, so Premium was free money.
    const byValue = [...BID_STYLES].sort((a, b) => a.value - b.value);
    for (let i = 1; i < byValue.length; i++) {
      expect(byValue[i].baseWinChance).toBeLessThan(byValue[i - 1].baseWinChance);
    }
  });

  test("no style dominates another on expected value", () => {
    // If one style's expected value beat every other at every reputation, the decision would
    // be fake again — just in a subtler way than before.
    for (const rep of [0, 25, 50, 75, 100]) {
      const plans = BID_STYLES.map((s) => planBid(contract(), s.key, game({ reputation: rep })));
      const best = Math.max(...plans.map((p) => p.expectedValue));
      const worst = Math.min(...plans.map((p) => p.expectedValue));
      // Within 15% of each other: close enough that runway, board depth and crew idle cost
      // decide it rather than arithmetic.
      expect((best - worst) / best).toBeLessThan(0.15);
    }
  });

  test("the aggressive bid trades money for certainty, the premium bid the reverse", () => {
    const g = game();
    const aggressive = planBid(contract(), "aggressive", g);
    const premium = planBid(contract(), "premium", g);
    expect(aggressive.effectiveValue).toBeLessThan(premium.effectiveValue);
    expect(aggressive.winChance).toBeGreaterThan(premium.winChance);
  });

  test("an unknown or missing style falls back to standard rather than throwing", () => {
    for (const bad of [undefined, null, "", "cheeky", 7, {}]) {
      expect(getBidStyle(bad).key).toBe(DEFAULT_BID_STYLE);
    }
    expect(planBid(contract(), undefined, game()).styleKey).toBe(DEFAULT_BID_STYLE);
  });

  test("a brand-new company is guaranteed its first contract", () => {
    // The tutorial's step 1 points at a specific contract. Losing it would fail the
    // first-minute rule outright — a new company at 0 reputation would lose a standard bid
    // 31% of the time.
    const brandNew = game({ reputation: 0, completedJobs: 0, activeSites: [] });
    for (const style of BID_STYLES) {
      const plan = planBid(contract(), style.key, brandNew);
      expect(plan.guaranteed).toBe(true);
      expect(plan.winChance).toBe(1);
      expect(plan.winPercent).toBe(100);
      expect(plan.riskLabel).toBe("Guaranteed");
      // Still pays the style's own value, so the choice is not erased — just de-risked once.
      expect(plan.effectiveValue).toBe(Math.round(contract().value * style.value));
    }
  });

  test("the guarantee is honest: a guaranteed bid always wins, whatever the roll", () => {
    const brandNew = game({ completedJobs: 0, activeSites: [] });
    for (const roll of [0, 0.5, 0.999999]) {
      expect(rollBidOutcome(contract(), "premium", brandNew, () => roll).won).toBe(true);
    }
  });

  test("the guarantee lifts the moment the player has a company of their own", () => {
    expect(planBid(contract(), "premium", game({ completedJobs: 1, activeSites: [] })).guaranteed).toBe(false);
    expect(planBid(contract(), "premium", game({ completedJobs: 0, activeSites: [{ id: "s" }] })).guaranteed).toBe(false);
    // And the odds go back to being real.
    expect(planBid(contract(), "premium", game({ completedJobs: 1 })).winChance).toBeLessThan(1);
  });

  test("reputation is worth having: it raises the chance of being awarded work", () => {
    const low = planBid(contract(), "premium", game({ reputation: 0 }));
    const high = planBid(contract(), "premium", game({ reputation: 100 }));
    expect(high.winChance).toBeGreaterThan(low.winChance);
  });

  test("a contract a rival is already circling is harder to win", () => {
    const open = planBid(contract(), "standard", game());
    const contested = planBid(contract({ interestedRival: "Apex Build" }), "standard", game());
    expect(contested.winChance).toBeLessThan(open.winChance);
    expect(contested.contested).toBe(true);
    expect(contested.rivalName).toBe("Apex Build");
  });

  test("bigger work draws bigger firms", () => {
    const g = game();
    const commercial = planBid(contract({ category: "Commercial" }), "standard", g).winChance;
    const mega = planBid(contract({ category: "Mega" }), "standard", g).winChance;
    expect(mega).toBeLessThan(commercial);
  });

  test("no bid is ever hopeless or a certainty", () => {
    for (const rep of [0, 50, 100]) {
      for (const style of BID_STYLES) {
        for (const cat of ["Residential", "Commercial", "Infrastructure", "Government", "Mega"]) {
          for (const rival of [null, "Apex Build"]) {
            const p = planBid(
              contract({ category: cat, interestedRival: rival }),
              style.key,
              game({ reputation: rep })
            );
            expect(p.winChance).toBeGreaterThanOrEqual(0.25);
            expect(p.winChance).toBeLessThanOrEqual(0.97);
          }
        }
      }
    }
  });

  test("garbage input never produces NaN on screen", () => {
    const p = planBid({}, "standard", {});
    expect(Number.isFinite(p.effectiveValue)).toBe(true);
    expect(Number.isFinite(p.winChance)).toBe(true);
    expect(Number.isFinite(p.expectedValue)).toBe(true);
    expect(Number.isFinite(getBidCompetition({}, {}))).toBe(true);
  });
});

describe("rollBidOutcome", () => {
  test("what the player was promised is what gets rolled", () => {
    // The plan shown in the UI and the chance used for the award come from one call, so they
    // cannot drift apart.
    const outcome = rollBidOutcome(contract(), "premium", game(), () => 0.5);
    const plan = planBid(contract(), "premium", game());
    expect(outcome.winChance).toBe(plan.winChance);
    expect(outcome.effectiveValue).toBe(plan.effectiveValue);
  });

  test("a roll below the chance wins, at or above it loses", () => {
    const g = game();
    const chance = planBid(contract(), "standard", g).winChance;
    expect(rollBidOutcome(contract(), "standard", g, () => chance - 0.001).won).toBe(true);
    expect(rollBidOutcome(contract(), "standard", g, () => chance).won).toBe(false);
    expect(rollBidOutcome(contract(), "standard", g, () => chance + 0.001).won).toBe(false);
  });

  test("over many rolls the win rate matches the stated chance", () => {
    let wins = 0;
    const g = game();
    const plan = planBid(contract(), "premium", g);
    for (let i = 0; i < 1000; i++) {
      if (rollBidOutcome(contract(), "premium", g, () => i / 1000).won) wins++;
    }
    expect(Math.abs(wins / 1000 - plan.winChance)).toBeLessThan(0.02);
  });
});

describe("pickWinningRival", () => {
  const rivals = [
    { id: "apex", name: "Apex Build", status: "Active" },
    { id: "summit", name: "Summit Co", status: "Active" },
    { id: "dead", name: "Gone Ltd", status: "Bankrupt" },
  ];

  test("prefers the rival the player was already told was interested", () => {
    const r = pickWinningRival(contract({ interestedRival: "Summit Co" }), game({ rivals }));
    expect(r.name).toBe("Summit Co");
  });

  test("never names a bankrupt or acquired company as the winner", () => {
    for (let i = 0; i < 50; i++) {
      const r = pickWinningRival(contract(), game({ rivals, acquiredRivals: ["apex"] }), () => i / 50);
      expect(r.name).toBe("Summit Co");
    }
  });

  test("returns null rather than inventing a company when the market is empty", () => {
    expect(pickWinningRival(contract(), game({ rivals: [] }))).toBeNull();
    expect(pickWinningRival(contract(), {})).toBeNull();
  });
});

describe("material deliveries", () => {
  const missing = [
    { matId: "concrete", label: "Concrete", unit: "m³", missing: 40, costNormal: 4800, costEmergency: 7200 },
    { matId: "steel", label: "Steel", unit: "t", missing: 3, costNormal: 2850, costEmergency: 4275 },
  ];

  test("the emergency premium buys time — that is the whole point of it", () => {
    // Before this, both order types were instant, so paying 1.5x bought nothing at all.
    expect(EMERGENCY_DELIVERY_DAYS).toBeLessThan(NORMAL_DELIVERY_DAYS);
  });

  test("a normal order lands later and costs less than an emergency one", () => {
    const normal = planDeliveries(missing, 10);
    const urgent = planDeliveries(missing, 10, { emergency: true });
    expect(normal[0].arrivesDay).toBe(10 + NORMAL_DELIVERY_DAYS);
    expect(urgent[0].arrivesDay).toBe(10 + EMERGENCY_DELIVERY_DAYS);
    expect(urgent[0].cost).toBeGreaterThan(normal[0].cost);
  });

  test("one record per material, carrying everything needed to deliver it", () => {
    const deliveries = planDeliveries(missing, 5);
    expect(deliveries).toHaveLength(2);
    for (const d of deliveries) {
      expect(typeof d.id).toBe("string");
      expect(d.qty).toBeGreaterThan(0);
      expect(d.cost).toBeGreaterThan(0);
      expect(d.orderedDay).toBe(5);
      expect(d.arrivesDay).toBeGreaterThanOrEqual(5);
    }
  });

  test("delivery ids are deterministic, so replaying a day cannot duplicate an order", () => {
    // Offline catch-up replays ticks. A random id would let the same order land twice.
    expect(planDeliveries(missing, 5).map((d) => d.id)).toEqual(planDeliveries(missing, 5).map((d) => d.id));
    expect(planDeliveries(missing, 5)[0].id).not.toBe(planDeliveries(missing, 6)[0].id);
    expect(planDeliveries(missing, 5)[0].id).not.toBe(planDeliveries(missing, 5, { emergency: true })[0].id);
  });

  test("nothing is ordered for a material that is already covered", () => {
    expect(planDeliveries([{ matId: "x", missing: 0, costNormal: 0 }], 1)).toEqual([]);
    expect(planDeliveries([], 1)).toEqual([]);
    expect(planDeliveries(undefined, 1)).toEqual([]);
  });

  test("collecting arrivals splits on the day and never mutates the site", () => {
    const site = {
      pendingDeliveries: [
        { id: "a", arrivesDay: 8 },
        { id: "b", arrivesDay: 10 },
        { id: "c", arrivesDay: 12 },
      ],
    };
    const snapshot = JSON.stringify(site);
    const { arrived, stillPending } = collectArrivedDeliveries(site, 10);
    expect(arrived.map((d) => d.id)).toEqual(["a", "b"]);
    expect(stillPending.map((d) => d.id)).toEqual(["c"]);
    expect(JSON.stringify(site)).toBe(snapshot);
  });

  test("a site with no deliveries is handled, not crashed on", () => {
    for (const s of [{}, { pendingDeliveries: null }, { pendingDeliveries: [] }, undefined]) {
      const { arrived, stillPending } = collectArrivedDeliveries(s, 5);
      expect(arrived).toEqual([]);
      expect(stillPending).toEqual([]);
      expect(nextDeliveryDay(s)).toBeNull();
    }
  });

  test("malformed delivery records are skipped rather than thrown on", () => {
    const site = { pendingDeliveries: [null, "nope", { id: "ok", arrivesDay: 1 }] };
    const { arrived } = collectArrivedDeliveries(site, 5);
    expect(arrived.map((d) => d.id)).toEqual(["ok"]);
  });

  test("the soonest outstanding order is what the stall message quotes", () => {
    expect(nextDeliveryDay({ pendingDeliveries: [{ arrivesDay: 14 }, { arrivesDay: 11 }] })).toBe(11);
  });

  test("an arriving order announces itself, naming the site", () => {
    const [d] = planDeliveries(missing, 3);
    const line = describeDelivery("Riverside Fence", d);
    expect(line).toContain("Riverside Fence");
    expect(line).toContain("40");
    expect(line).toContain("Concrete");
    const [urgent] = planDeliveries(missing, 3, { emergency: true });
    expect(describeDelivery("Riverside Fence", urgent)).toContain("Emergency");
  });

  test("describing nothing returns nothing rather than 'undefined'", () => {
    expect(describeDelivery("Site", null)).toBe("");
  });
});

describe("phases are visible and announced", () => {
  const site = {
    phases: ["Site Prep", "Foundation", "Framing", "Final Inspection"],
    currentPhaseIdx: 1,
    phaseProgress: 42,
  };

  test("the phase list shows what is done, current and still to come", () => {
    const summary = summarizeSitePhases(site);
    expect(summary.map((p) => p.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(summary.map((p) => p.percent)).toEqual([100, 42, 0, 0]);
    expect(summary[1].name).toBe("Foundation");
  });

  test("a site with no phases yields an empty list, not a crash", () => {
    expect(summarizeSitePhases({})).toEqual([]);
    expect(summarizeSitePhases(undefined)).toEqual([]);
  });

  test("negative progress from a failed inspection never renders as a negative bar", () => {
    // A failed inspection sets phaseProgress to -20 as a rework penalty.
    const reworking = summarizeSitePhases({ ...site, phaseProgress: -20 });
    expect(reworking[1].percent).toBe(0);
  });

  test("finishing a phase says so, and says what starts next", () => {
    // Before Phase 2 this was silent unless the phase happened to be an inspection.
    const line = describePhaseCompletion("Foundation", "Framing");
    expect(line).toContain("Foundation");
    expect(line).toContain("Framing");
  });

  test("finishing the last phase says the project is done, not that nothing begins", () => {
    expect(describePhaseCompletion("Final Inspection", null)).toContain("finished");
    expect(describePhaseCompletion("Final Inspection", undefined)).not.toContain("undefined");
  });

  test("describing nothing returns nothing", () => {
    expect(describePhaseCompletion(null, "Framing")).toBe("");
  });
});

describe("progress payments move money's timing, never its total", () => {
  const VALUE = 120000;
  const site = (over = {}) => ({ phases: ["A", "B", "C", "D"], totalValue: VALUE, ...over });

  test("the deposit and progress shares leave a balance for handover", () => {
    expect(DEPOSIT_SHARE + PROGRESS_SHARE).toBeLessThan(1);
  });

  test("claims accumulate to exactly the progress share across the job", () => {
    const claimable = 3; // four phases, the last is paid at handover
    expect(progressPaymentTarget(VALUE, 4, 0)).toBe(0);
    expect(progressPaymentTarget(VALUE, 4, claimable)).toBe(Math.round(VALUE * PROGRESS_SHARE));
  });

  test("THE INVARIANT: deposit + claims + final always equals value less penalty", () => {
    // This is the test that matters. Timing money differently is exactly how a game quietly
    // mints or loses it. Swept across awkward values, phase counts and penalties.
    for (const value of [1, 999, 7777, 48000, 120000, 1234567]) {
      for (const phaseCount of [1, 2, 3, 4, 5, 8, 13]) {
        for (const penalty of [0, 1, 5000, value * 2]) {
          const deposit = Math.round(value * DEPOSIT_SHARE);
          const claimable = Math.max(0, phaseCount - 1);
          const progress = progressPaymentTarget(value, phaseCount, claimable);
          const cappedPenalty = Math.min(penalty, value);
          const final = finalPaymentDue(value, cappedPenalty, deposit, progress);
          expect(deposit + progress + final).toBe(Math.max(deposit + progress, value - cappedPenalty));
        }
      }
    }
  });

  test("per-phase rounding never drifts away from the cumulative total", () => {
    // Releases are computed as (cumulative target - already paid), so 13 phases of an
    // awkward value still land on the exact share.
    const value = 999983;
    const phases = 13;
    let paid = 0;
    for (let done = 1; done <= phases - 1; done++) {
      const { release } = planProgressPayment(site({ phases: Array(phases).fill("P"), progressPaid: paid }), value, done);
      expect(release).toBeGreaterThanOrEqual(0);
      paid += release;
    }
    expect(paid).toBe(Math.round(value * PROGRESS_SHARE));
  });

  test("re-running the same phase completion pays nothing the second time", () => {
    // Offline catch-up replays ticks; a naive per-phase increment would pay twice.
    const first = planProgressPayment(site(), VALUE, 1);
    expect(first.release).toBeGreaterThan(0);
    const replay = planProgressPayment(site({ progressPaid: first.release }), VALUE, 1);
    expect(replay.release).toBe(0);
  });

  test("a single-phase job has no progress claims, only deposit and handover", () => {
    expect(progressPaymentTarget(VALUE, 1, 0)).toBe(0);
    expect(progressPaymentTarget(VALUE, 1, 5)).toBe(0);
    expect(planProgressPayment(site({ phases: ["Only"] }), VALUE, 1).release).toBe(0);
  });

  test("claiming more phases than exist cannot over-pay", () => {
    const claimable = Math.round(VALUE * PROGRESS_SHARE);
    expect(progressPaymentTarget(VALUE, 4, 99)).toBe(claimable);
    expect(planProgressPayment(site({ progressPaid: claimable }), VALUE, 99).release).toBe(0);
  });

  test("a penalty larger than the contract never pays the player to fail", () => {
    expect(finalPaymentDue(VALUE, VALUE * 5, 30000, 60000)).toBe(0);
    expect(finalPaymentDue(VALUE, VALUE, 0, 0)).toBe(0);
  });

  test("a site renegotiated downward stops claiming rather than clawing cash back", () => {
    const overpaid = planProgressPayment(site({ progressPaid: 90000 }), 40000, 3);
    expect(overpaid.release).toBe(0);
  });

  test("garbage never produces NaN in a payment", () => {
    for (const bad of [undefined, null, NaN, Infinity, "100", {}]) {
      expect(Number.isFinite(progressPaymentTarget(bad, 4, 2))).toBe(true);
      expect(Number.isFinite(progressPaymentTarget(VALUE, bad, 2))).toBe(true);
      expect(Number.isFinite(progressPaymentTarget(VALUE, 4, bad))).toBe(true);
      expect(Number.isFinite(finalPaymentDue(bad, bad, bad, bad))).toBe(true);
      expect(Number.isFinite(planProgressPayment(site(), bad, bad).release)).toBe(true);
    }
  });
});

describe("summarizeSitePayments", () => {
  test("reports what has been received and what is still owed", () => {
    const s = summarizeSitePayments({ totalValue: 100000, depositPaid: 25000, progressPaid: 25000 });
    expect(s.received).toBe(50000);
    expect(s.outstanding).toBe(50000);
    expect(s.percentReceived).toBe(50);
  });

  test("a brand-new site reads as nothing received, not NaN", () => {
    const s = summarizeSitePayments({ totalValue: 0 });
    expect(s.received).toBe(0);
    expect(s.outstanding).toBe(0);
    expect(s.percentReceived).toBe(0);
    expect(Number.isFinite(summarizeSitePayments({}).percentReceived)).toBe(true);
  });
});
