// Sprint 1, P0-1 — no silent project stalls.
//
// Found by the first-hour audit harness (scripts/playtest/firstHourHarness.js), each with a test:
//
//  1. STALE RATE. Every stall branch in gameTick `continue`d past the line that writes
//     `site._progressRate`, so a site waiting on materials, missing its crew, or paused kept
//     printing yesterday's "~3 days remaining · 97%/day". 426 stalled ticks across 30 seeded
//     first hours showed a healthy rate on a site that was not moving.
//  2. UNEXPLAINED PAUSES. Permit holds, failed inspections, regulatory holds and quality failures
//     all paused a site; the card showed a "Paused" pill and nothing about why or for how long.
//  3. DOUBLE PLANT PENALTY. A site with no working machine on a phase that needs one paid the
//     missing-plant penalty twice (55% x 55% = 30% speed), and a site with no machine on a
//     hand-tool phase (Inspection, Finish Work) paid it once, contradicting the plant table.
//  4. HIDDEN MODIFIERS. Understaffing (crew below the job's minimum) cut the rate in proportion
//     with nothing on screen; the specialty warning fired on a different condition from the −10%
//     the tick applied, so card and simulation disagreed.
//  5. WRONG CLOCK ON THE CARD. "%/day" and "days remaining" multiplied by 48 ticks a day; the
//     clock runs 32. The card promised a job 1.5x faster than it was.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ConstructionFlowScreen, {
  freshState, gameTick, mobilizeSite,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { diagnoseSite, pauseSite, describeFactor } from "../src/systems/siteDiagnostics.js";
import { STALL_FACTOR } from "../src/systems/sitePlant.js";
import { pctPerDay, daysRemaining } from "../src/utils/sitePace.js";
import { ticksPerDay } from "../src/systems/gameClock.js";
import SiteStatusBanner from "../src/components/SiteStatusBanner.js";

import { mulberry32 as __mulberry32 } from "../scripts/playtest/firstHourHarness.js";

// Deterministic: every test in this file runs on a seeded RNG, so a pass or a failure reproduces.
let __realRandom;
beforeEach(() => { __realRandom = Math.random; Math.random = __mulberry32(20260924); });
afterEach(() => { Math.random = __realRandom; });

jest.setTimeout(30000);

// A fence job started through the real Bids path, rng pinned so the bid is won.
function startedFence(mutate = () => {}) {
  const g = { ...freshState(), setupDone: true, tutorialDone: true };
  mutate(g);
  const c = g.contracts.find((x) => x.defId === "fence");
  const res = mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
  expect(res.status).toBe("won");
  return { g, site: g.activeSites[0] };
}

function tickUntil(g, pred, max = 400) {
  let s = g;
  for (let i = 0; i < max; i++) {
    s = gameTick(s);
    s.pendingDecision = null;
    if (pred(s)) return s;
  }
  return s;
}

describe("a stopped site never shows a running rate", () => {
  test("short of materials: rate goes to zero and the card says why, with the fix", () => {
    const { g, site } = startedFence();
    g.activeSites[0].materialsFulfilled = { lumber: 5 };
    const after = gameTick(g);
    const s = after.activeSites.find((x) => x.id === site.id);
    expect(s._progressRate).toBe(0);
    const v = diagnoseSite(s, after.day);
    expect(v.state).toBe("stopped");
    expect(v.lines[0].text).toMatch(/short 15 lumber and nothing on order/);
    expect(v.lines[0].action.label).toBe("Order materials");
  });

  test("materials in transit: says when they land", () => {
    const { g } = startedFence();
    const s0 = g.activeSites[0];
    s0.materialsFulfilled = { lumber: 5 };
    s0.pendingDeliveries = [{ id: "d1", matId: "lumber", label: "Lumber", unit: "sheets", qty: 15, arrivesDay: g.day + 2 }];
    const after = gameTick(g);
    const v = diagnoseSite(after.activeSites[0], after.day);
    expect(v.state).toBe("stopped");
    expect(v.lines[0].text).toMatch(/arrives in 2d/);
  });

  test("nobody on site: stopped, and resting crew are named as coming back", () => {
    const { g } = startedFence();
    const s0 = g.activeSites[0];
    for (const w of g.crew) { w.awaitingRestForSiteId = s0.id; w.status = "Idle"; }
    s0.assignedCrewIds = [];
    const after = gameTick(g);
    const v = diagnoseSite(after.activeSites[0], after.day);
    expect(after.activeSites[0]._progressRate).toBe(0);
    expect(v.lines[0].text).toMatch(/all 3 crew are resting — they return automatically/);
  });
});

describe("a paused site says why and for how long", () => {
  test.each([
    ["permit", /Paused: Permit hold · resumes in ~3d/],
    ["inspection", /Paused: Failed safety inspection · resumes in ~3d/],
    ["regulatory", /Paused: Regulatory hold · resumes in ~3d/],
  ])("%s", (reason, re) => {
    const site = { status: "Active" };
    pauseSite(site, 3, reason);
    expect(site.status).toBe("Paused");
    expect(diagnoseSite(site, 1).lines[0].text).toMatch(re);
  });

  test("a manual pause says it waits for the player, and offers Resume", () => {
    const site = { status: "Active" };
    pauseSite(site, 999, "manual");
    const v = diagnoseSite(site, 1);
    expect(v.lines[0].text).toMatch(/until you resume it/);
    expect(v.lines[0].action.label).toBe("Resume");
  });

  test("the reason clears when the hold runs out", () => {
    const { g } = startedFence();
    pauseSite(g.activeSites[0], 1, "permit");
    const after = tickUntil(g, (s) => s.activeSites[0]?.status === "Active", 200);
    expect(after.activeSites[0].status).toBe("Active");
    expect(after.activeSites[0].pauseReason).toBeNull();
  });

  test("every pause in the game goes through pauseSite, so none can be reasonless", () => {
    const code = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
    expect(code).not.toMatch(/\.status\s*=\s*"Paused"/);
  });
});

describe("the missing-plant penalty is charged once, and only where the plant table says so", () => {
  // One company, compared against itself: freshState() rolls a new crew every call.
  const { g: base } = startedFence();
  function rateWith(phase, withMachines, affinityFree = true) {
    const g = JSON.parse(JSON.stringify(base));
    const s0 = g.activeSites[0];
    s0.phases = [phase, "Inspection"];
    s0.currentPhaseIdx = 0;
    s0.assignedEquipmentIds = withMachines ? g.equipment.map((e) => e.id) : [];
    // The truck is Earthwork; make it a type with no affinity bonus for these phases, so the
    // only difference between the two runs is the plant REQUIREMENT, not a speed bonus.
    if (affinityFree) for (const e of g.equipment) e.type = "Utility";
    const real = Math.random; Math.random = () => 0.99;   // no no-shows, no chaos
    try { return gameTick(g).activeSites[0]; } finally { Math.random = real; }
  }

  test("no machine on a phase that needs one runs at STALL_FACTOR, not STALL_FACTOR squared", () => {
    const withTruck = rateWith("Survey", true);
    const without = rateWith("Survey", false);
    expect(without._progressRate / withTruck._progressRate).toBeCloseTo(STALL_FACTOR, 5);
    expect(without.rateFactors.find((f) => f.key === "plant").factor).toBe(STALL_FACTOR);
  });

  test("no machine on a hand-tool phase costs nothing", () => {
    const withTruck = rateWith("Inspection", true);
    const without = rateWith("Inspection", false);
    expect(without._progressRate).toBeCloseTo(withTruck._progressRate, 8);
    expect(without.rateFactors.find((f) => f.key === "plant")).toBeUndefined();
  });
});

describe("every multiplier the tick applies below 1 is on the card", () => {
  test("understaffing is reported with the real numbers", () => {
    const { g } = startedFence();
    const s0 = g.activeSites[0];
    s0.crewMin = 3;
    s0.assignedCrewIds = [g.crew[0].id];
    const real = Math.random; Math.random = () => 0.99;
    let after;
    try { after = gameTick(g); } finally { Math.random = real; }
    const f = after.activeSites[0].rateFactors.find((x) => x.key === "understaffed");
    expect(f).toBeDefined();
    expect(f.factor).toBeCloseTo(1 / 3, 5);
    expect(describeFactor(f).text).toBe("Understaffed: 1 of 3 crew on site — 33% speed");
  });

  test("the specialty penalty is reported exactly when the tick applies it", () => {
    const { g } = startedFence();
    for (const w of g.crew) w.specialty = "Roofing";   // nobody matches Survey
    const real = Math.random; Math.random = () => 0.99;
    let after;
    try { after = gameTick(g); } finally { Math.random = real; }
    const f = after.activeSites[0].rateFactors.find((x) => x.key === "specialty");
    expect(f && f.factor).toBe(0.9);
    expect(diagnoseSite(after.activeSites[0], after.day).state).toBe("slowed");
  });

  test("a healthy site reports nothing", () => {
    const { g } = startedFence();
    for (const w of g.crew) w.specialty = "Earthwork";
    const real = Math.random; Math.random = () => 0.99;
    let after;
    try { after = gameTick(g); } finally { Math.random = real; }
    expect(diagnoseSite(after.activeSites[0], after.day).state).toBe("running");
  });
});

describe("the card's pace uses the real clock", () => {
  test("percent per day is rate x ticks per day, not rate x 48", () => {
    expect(ticksPerDay("1x")).toBe(32);
    expect(pctPerDay(2)).toBe(64);
  });

  test("days remaining matches what the simulation actually delivers", () => {
    const { g } = startedFence((s) => { for (const w of s.crew) w.specialty = "Earthwork"; });
    const real = Math.random; Math.random = () => 0.99;   // no chaos, no no-shows
    try {
      let s = gameTick(g);
      const promised = daysRemaining(s.activeSites[0]);
      const startDay = s.day;
      s = tickUntil(s, (x) => x.activeSites.length === 0, 32 * 30);
      const actual = s.day - startDay;
      // Phase-by-phase specialty matches move the rate a little; the promise must be close,
      // not off by the 1.5x the old constant produced.
      expect(Math.abs(actual - promised)).toBeLessThanOrEqual(Math.ceil(promised * 0.35) + 1);
    } finally { Math.random = real; }
  });

  test("nothing in the screen converts pace with a hard-coded 48", () => {
    const code = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
    expect(code).not.toMatch(/_progressRate\s*\*\s*48/);
    expect(code).not.toMatch(/_rate\s*\*\s*48/);
  });
});

describe("the player can SEE it — the banner renders on the real Sites tab", () => {
  test("component: renders the stop line and the action", () => {
    const site = { status: "Active", stopReason: { key: "materials_short", summary: "15 lumber" } };
    let tree;
    act(() => { tree = TestRenderer.create(<SiteStatusBanner site={site} day={3} resolveAction={() => () => {}} />); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Stopped: short 15 lumber and nothing on order");
    expect(json).toContain("Order materials");
  });

  test("component: renders nothing for a healthy site", () => {
    let tree;
    act(() => { tree = TestRenderer.create(<SiteStatusBanner site={{ status: "Active", rateFactors: [] }} day={3} />); });
    expect(tree.toJSON()).toBeNull();
  });

  async function mountSitesTab(g) {
    g.lastRealTimestamp = Date.now();
    await AsyncStorage.setItem("constructionflow_v1_save", JSON.stringify(g));
    let tree;
    await act(async () => { tree = TestRenderer.create(<ConstructionFlowScreen />); });
    await act(async () => { jest.advanceTimersByTime(10); });
    const btn = tree.root.findAll((n) => n.props && n.props.accessibilityRole === "tab", { deep: true })
      .find((b) => String(b.props.accessibilityLabel || "").startsWith("Sites"));
    await act(async () => { btn.props.onPress(); });
    return JSON.stringify(tree.toJSON());
  }

  beforeAll(() => { jest.useFakeTimers(); });
  afterAll(() => { jest.useRealTimers(); });

  test("screen: a site the TICK stalled for materials shows why on the Sites tab", async () => {
    const { g } = startedFence();
    g.activeSites[0].materialsFulfilled = { lumber: 5 };
    const after = gameTick(g);
    after.pendingDecision = null;
    const json = await mountSitesTab(after);
    expect(json).toContain("Stopped: short 15 lumber and nothing on order");
    expect(json).not.toMatch(/\d+\.\d%\/day/);   // no stale pace printed for a stopped site
  });

  test("screen: a paused site shows the reason and when it resumes", async () => {
    const { g } = startedFence();
    pauseSite(g.activeSites[0], 3, "permit");
    const json = await mountSitesTab(g);
    expect(json).toContain("Paused: Permit hold · resumes in ~3d");
  });

  test("screen: an understaffed site shows its real speed", async () => {
    const { g } = startedFence();
    g.activeSites[0].crewMin = 3;
    g.activeSites[0].assignedCrewIds = [g.crew[0].id];
    const real = Math.random; Math.random = () => 0.99;
    let after;
    try { after = gameTick(g); } finally { Math.random = real; }
    after.pendingDecision = null;
    const json = await mountSitesTab(after);
    expect(json).toContain("Understaffed: 1 of 3 crew on site — 33% speed");
  });
});

describe("old saves", () => {
  test("a site saved before Sprint 1 has no diagnostics fields and reads as running", () => {
    expect(diagnoseSite({ status: "Active", phases: ["Survey"] }, 5).state).toBe("running");
    expect(diagnoseSite({ status: "Paused", pausedDays: 2 }, 5).lines[0].text).toMatch(/Paused: On hold · resumes in ~2d/);
  });
});
