// Sprint 1 P0 — the Resume button cannot clear an official hold.
//
// Resume used to set ANY paused site back to Active: a permit hold, a regulatory hold, a failed
// safety or quality inspection — one tap. It now resumes only the player's own pause. Official
// holds end by their countdown or through the regulatory decision card's paid resolution.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConstructionFlowScreen, {
  freshState, gameTick, mobilizeSite, resumeSite,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { pauseSite, canPlayerResume, canAutoResume, REGULATORY_HOLDS } from "../src/systems/siteDiagnostics.js";

import { mulberry32 as __mulberry32 } from "../scripts/playtest/firstHourHarness.js";

// Deterministic: every test in this file runs on a seeded RNG, so a pass or a failure reproduces.
let __realRandom;
beforeEach(() => { __realRandom = Math.random; Math.random = __mulberry32(20260924); });
afterEach(() => { Math.random = __realRandom; });

jest.setTimeout(30000);

function withSite() {
  const g = { ...freshState(), setupDone: true, tutorialDone: true };
  const c = g.contracts.find((x) => x.defId === "fence");
  mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
  return g;
}

describe.each([...REGULATORY_HOLDS])("a %s hold", (reason) => {
  test("Resume does not clear it", () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 4, reason);
    expect(resumeSite(g, g.activeSites[0].id)).toBe(false);
    expect(g.activeSites[0].status).toBe("Paused");
    expect(g.activeSites[0].pausedDays).toBe(4);
    expect(g.activeSites[0].pauseReason.key).toBe(reason);
  });

  test("Pause-then-Resume is not a way round it", () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 4, reason);
    pauseSite(g.activeSites[0], 999, "manual");     // the player's Pause / hold control
    expect(g.activeSites[0].pauseReason.key).toBe(reason);
    expect(resumeSite(g, g.activeSites[0].id)).toBe(false);
    expect(g.activeSites[0].status).toBe("Paused");
  });

  test("a Senior PM cannot overrule it either", () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 4, reason);
    expect(canAutoResume(g.activeSites[0])).toBe(false);
  });

  test("it still ends on its own", () => {
    let g = withSite();
    pauseSite(g.activeSites[0], 1, reason);
    for (let i = 0; i < 80 && g.activeSites[0].status === "Paused"; i++) { g = gameTick(g); g.pendingDecision = null; }
    expect(g.activeSites[0].status).toBe("Active");
  });
});

describe("the player's own pause", () => {
  test("Resume clears it", () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 999, "manual");
    expect(resumeSite(g, g.activeSites[0].id)).toBe(true);
    expect(g.activeSites[0].status).toBe("Active");
  });

  test("a pre-Sprint-1 manual pause (no reason, 999 days) can still be resumed", () => {
    const g = withSite();
    Object.assign(g.activeSites[0], { status: "Paused", pausedDays: 999, pauseReason: undefined });
    expect(canPlayerResume(g.activeSites[0])).toBe(true);
  });

  test("a pre-Sprint-1 timed hold (no reason, a few days) cannot", () => {
    const g = withSite();
    Object.assign(g.activeSites[0], { status: "Paused", pausedDays: 3, pauseReason: undefined });
    expect(resumeSite(g, g.activeSites[0].id)).toBe(false);
  });

  test("a hold landing on a manual pause runs its own clock, not 999 + days", () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 999, "manual");
    pauseSite(g.activeSites[0], 3, "permit");
    expect(g.activeSites[0].pausedDays).toBe(3);
    expect(g.activeSites[0].pauseReason.key).toBe("permit");
  });

  test("weather is operational: a PM may get the site moving", () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 3, "weather");
    expect(canAutoResume(g.activeSites[0])).toBe(true);
    expect(canPlayerResume(g.activeSites[0])).toBe(false);
  });
});

describe("the Sites tab shows it", () => {
  beforeAll(() => { jest.useFakeTimers(); });
  afterAll(() => { jest.useRealTimers(); });

  async function sitesJson(g) {
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

  test("a permit hold shows 'On hold', not a Resume button", async () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 3, "permit");
    const json = await sitesJson(g);
    expect(json).toContain("On hold");
    expect(json).not.toContain("▶ Resume");
  });

  test("a manual pause shows Resume", async () => {
    const g = withSite();
    pauseSite(g.activeSites[0], 999, "manual");
    const json = await sitesJson(g);
    expect(json).toContain("▶ Resume");
  });
});
