// Decisions during a job (stage B): weather, ground conditions, running late.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConstructionFlowScreen, {
  freshState, gameTick, mobilizeSite, CHAOS_EVENTS, applySiteChoiceResult,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import {
  buildChoice, offerChoice, resolveChoice, canOfferChoice, choiceBudget, weatherFactor, overtimeFactor,
  forecastLateBy, changeOrderChance, COVER_SPEED, OVERTIME_SPEED, COVER_SHARE, COVER_MIN, PUSH_INCIDENT_CHANCE,
} from "../src/systems/siteChoices.js";
import { ticksPerDay } from "../src/systems/gameClock.js";
import { withSeed } from "../scripts/playtest/firstHourHarness.js";

jest.useFakeTimers();
jest.setTimeout(30000);
const TPD = ticksPerDay("1x");

const site = (over = {}) => ({ id: "s1", label: "Road Patch", totalValue: 47000, deadlineDay: 20, durationDays: 9, phases: ["A", "B", "C"], currentPhaseIdx: 1, phaseProgress: 40, assignedCrewIds: [], assignedEquipmentIds: [], ...over });

describe("the rules", () => {
  test("one decision per job, two on long jobs", () => {
    expect(choiceBudget(site({ durationDays: 6 }))).toBe(1);
    expect(choiceBudget(site({ durationDays: 20 }))).toBe(2);
    const s = site({ durationDays: 6 });
    expect(offerChoice(s, "weather", { day: 5, days: 2 })).not.toBeNull();
    resolveChoice(s, "wait", { day: 5 });
    expect(canOfferChoice(s)).toBe(false);
    expect(offerChoice(s, "ground", { day: 6 })).toBeNull();
  });

  test("never two at once on a site", () => {
    const s = site({ durationDays: 20 });
    offerChoice(s, "weather", { day: 5, days: 2 });
    expect(offerChoice(s, "ground", { day: 5 })).toBeNull();
  });

  test("costs scale with the job", () => {
    const small = buildChoice("ground", site({ totalValue: 9000 }), { day: 1 });
    const big = buildChoice("ground", site({ totalValue: 220000 }), { day: 1 });
    expect(small.options[0].label).toMatch(/\$500/); // floor
    expect(big.options[0].label).toMatch(/\$6,600/);  // 3%
  });
});

describe("what each option does", () => {
  test("weather: waiting really stops work and moves the deadline", () => {
    const s = site();
    offerChoice(s, "weather", { day: 5, days: 2 });
    const r = resolveChoice(s, "wait", { day: 5 });
    expect(r.cash).toBe(0);
    expect(s.deadlineDay).toBe(22);
    expect(weatherFactor(s, 5)).toBe(0);
    expect(weatherFactor(s, 7)).toBe(1);
  });

  test("weather: covering costs money, keeps working slower, deadline +1", () => {
    const s = site();
    offerChoice(s, "weather", { day: 5, days: 2 });
    const r = resolveChoice(s, "cover", { day: 5 });
    expect(r.cash).toBe(300); // 0.5% of $47,000 is $235 — the $300 floor applies
    expect(weatherFactor(s, 5)).toBe(COVER_SPEED);
    expect(s.deadlineDay).toBe(21);
  });

  test("weather: pushing through is free but costs quality, sometimes an incident", () => {
    const s = site();
    offerChoice(s, "weather", { day: 5, days: 2 });
    const r = resolveChoice(s, "push", { day: 5 }, () => 0.1);
    expect(r.cash).toBe(0);
    expect(r.incident).toBe(1);
    expect(s.rushQualityPenalty).toBeCloseTo(0.04);
    expect(weatherFactor(s, 5)).toBe(1);
  });

  test("ground: a change order succeeds more often for a reputable firm", () => {
    expect(changeOrderChance(90)).toBeGreaterThan(changeOrderChance(0));
    const s = site();
    offerChoice(s, "ground", { day: 5, reputation: 90 });
    resolveChoice(s, "change_order", { day: 5, reputation: 90 }, () => 0.1);
    expect(s.totalValue).toBe(Math.round(47000 * 1.04));
    const f = site();
    offerChoice(f, "ground", { day: 5, reputation: 0 });
    resolveChoice(f, "change_order", { day: 5, reputation: 0 }, () => 0.99);
    expect(f.totalValue).toBe(47000);
    expect(f.phaseProgress).toBe(25);
  });

  test("ground: digging through wears the machines", () => {
    const s = site();
    offerChoice(s, "ground", { day: 5 });
    expect(resolveChoice(s, "dig", { day: 5 }, () => 0.9).machineWear).toBe(15);
  });

  test("running late: overtime speeds the site for three days", () => {
    const s = site();
    offerChoice(s, "behind", { day: 5, lateBy: 2, crewDayCost: 500 });
    const r = resolveChoice(s, "overtime", { day: 5, crewDayCost: 500 });
    expect(r.cash).toBe(750);
    expect(overtimeFactor(s, 6)).toBe(OVERTIME_SPEED);
    expect(overtimeFactor(s, 8)).toBe(1);
  });

  test("an unknown option falls back to the default and is marked as such", () => {
    const s = site();
    offerChoice(s, "behind", { day: 5, lateBy: 2 });
    expect(resolveChoice(s, "nonsense", { day: 5 })).toMatchObject({ optionId: "accept", defaulted: true });
  });
});

describe("no option is always right", () => {
  // Expected cost in dollars. Time is priced at the site's crew cost x1.5 (wages plus the yard
  // and overheads that keep running); an incident at ~4% of the job (the minor-penalty share in
  // systems/penalties.js); the quality hit at ~0.5% of the job in a smaller completion bonus.
  function weatherCosts(value, crewDay, days) {
    const time = 1.5 * crewDay;
    return {
      wait: days * time,
      cover: Math.max(COVER_MIN, value * COVER_SHARE) + days * (1 - COVER_SPEED) * time,
      push: PUSH_INCIDENT_CHANCE * value * 0.04 + value * 0.005,
    };
  }
  test("each weather option is the cheapest somewhere across realistic jobs", () => {
    const best = new Set();
    for (const value of [9000, 20000, 47000, 120000, 400000]) {
      for (const crewDay of [150, 300, 600, 1200]) {
        for (const days of [1, 2, 3]) {
          const c = weatherCosts(value, crewDay, days);
          best.add(Object.entries(c).sort((a, b) => a[1] - b[1])[0][0]);
        }
      }
    }
    expect([...best].sort()).toEqual(["cover", "push", "wait"]);
  });
});

describe("in the game", () => {
  function runningSite(seed = 3) {
    return withSeed(seed, () => {
      const g = { ...freshState(), setupDone: true, tutorialDone: true, completedJobs: 2 };
      const c = g.contracts.find((x) => x.defId === "fence");
      const res = mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
      expect(res.status).toBe("won");
      return g;
    });
  }

  test("the weather event asks instead of applying, with one notice", () => {
    const g = runningSite();
    const s = g.activeSites[0];
    const before = (g.inbox || []).length;
    CHAOS_EVENTS.find((e) => e.id === "weather").apply(s, g);
    expect(s.pendingChoice.kind).toBe("weather");
    expect((g.inbox || []).length).toBe(before + 1);
    expect(JSON.stringify(g.inbox)).toMatch(/choose on the site card/);
  });

  test("a second weather event on a short job applies the honest default: work stops", () => {
    const g = runningSite();
    const s = g.activeSites[0];
    s.choicesOffered = 1;
    const deadline = s.deadlineDay;
    CHAOS_EVENTS.find((e) => e.id === "weather").apply(s, g);
    expect(s.pendingChoice).toBeUndefined();
    expect(s.deadlineDay).toBeGreaterThan(deadline);
    expect(weatherFactor(s, g.day)).toBe(0);
  });

  test("ignored, the choice goes ahead with its default the next day", () => {
    let g = runningSite();
    const s0 = g.activeSites[0];
    offerChoice(s0, "ground", { day: g.day, reputation: 0 });
    const startDay = g.day;
    for (let i = 0; i < TPD * 2 && g.day < startDay + 2; i++) { g = gameTick(g); g.pendingDecision = null; }
    const s = g.activeSites.find((x) => x.id === s0.id) || s0;
    expect(s.pendingChoice).toBeUndefined();
    expect(s.choiceHistory?.[0]).toMatchObject({ kind: "ground", optionId: "engineer", defaulted: true });
    expect(JSON.stringify(g.ledger || [])).toMatch(/brought in an engineer/);
    expect(JSON.stringify(g.logs)).toMatch(/no answer, so brought in an engineer/);
  });

  test("a waiting site really makes no progress while it rains", () => {
    let g = runningSite();
    const s = g.activeSites[0];
    s.currentWeather = { label: "Rain — work stopped", endsDay: g.day + 2, stopsWork: true };
    const p0 = s.phaseProgress; const idx = s.currentPhaseIdx;
    for (let i = 0; i < Math.floor(TPD / 2); i++) { g = gameTick(g); g.pendingDecision = null; }
    const after = g.activeSites[0];
    expect(after.currentPhaseIdx).toBe(idx);
    expect(after.phaseProgress).toBe(p0);
    expect(after.rateFactors.some((f) => f.key === "weather" && f.factor === 0)).toBe(true);
  });

  test("the forecast knows when a job will run late", () => {
    const s = site({ _progressRate: 1, phases: ["A", "B", "C"], currentPhaseIdx: 1, phaseProgress: 0, deadlineDay: 6 });
    // 200 units left at 1/tick = 200/TPD days needed vs 1 day left
    expect(forecastLateBy(s, 5, TPD)).toBeCloseTo(200 / TPD - 1);
  });

  test("applying a result charges the ledger and wears machines", () => {
    const g = runningSite();
    const s = g.activeSites[0];
    const eq = g.equipment.find((e) => s.assignedEquipmentIds.includes(e.id));
    const before = eq.condition;
    applySiteChoiceResult(g, s, { cash: 500, machineWear: 15, incident: 0, log: "dug through the rock", kind: "ground" });
    expect(eq.condition).toBe(before - 15);
    expect(JSON.stringify(g.ledger || g.transactions || g)).toMatch(/dug through the rock/);
  });
});

describe("on the site card", () => {
  test("shows the choice and a tap carries it out", async () => {
    const g = withSeed(3, () => ({ ...freshState(), setupDone: true, tutorialDone: true, completedJobs: 2, lastRealTimestamp: Date.now() }));
    const c = g.contracts.find((x) => x.defId === "fence");
    mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
    offerChoice(g.activeSites[0], "weather", { day: g.day, days: 2 });
    await AsyncStorage.setItem("constructionflow_v1_save", JSON.stringify(g));
    let tree;
    await act(async () => { tree = TestRenderer.create(<ConstructionFlowScreen />); });
    await act(async () => { jest.advanceTimersByTime(10); });
    try {
      const sitesTab = tree.root.findAll((n) => n.props?.children === "Sites").map((n) => { let x = n; while (x && typeof x.props?.onPress !== "function") x = x.parent; return x; }).filter(Boolean).pop();
      await act(async () => { sitesTab.props.onPress(); });
      const wait = tree.root.findAll((n) => typeof n.props?.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Wait it out"))[0];
      expect(wait).toBeDefined();
      await act(async () => { wait.props.onPress(); });
      expect(tree.root.findAll((n) => typeof n.props?.accessibilityLabel === "string" && n.props.accessibilityLabel.startsWith("Wait it out"))).toHaveLength(0);
    } finally { await act(async () => { tree.unmount(); }); }
  });
});

describe("the mid-job moment", () => {
  const { rollMidJobChoice, jobProgress, midJobChoiceKind, MID_JOB_AT } = require("../src/systems/siteChoices.js");
  test("considered once, past the 40% mark, within the budget", () => {
    const s = site({ phases: ["Site Prep", "Framing", "Finishes"], currentPhaseIdx: 0, phaseProgress: 50 });
    expect(jobProgress(s)).toBeLessThan(MID_JOB_AT);
    expect(rollMidJobChoice(s, () => 0)).toBeNull();
    s.currentPhaseIdx = 1; s.phaseProgress = 30;
    expect(rollMidJobChoice(s, () => 0)).toBe("weather");
    expect(rollMidJobChoice(s, () => 0)).toBeNull(); // never twice
  });
  test("ground while digging, weather otherwise", () => {
    expect(midJobChoiceKind(site({ phases: ["Survey", "Foundation"], currentPhaseIdx: 1 }))).toBe("ground");
    expect(midJobChoiceKind(site({ phases: ["Survey", "Finishes"], currentPhaseIdx: 1 }))).toBe("weather");
  });
  test("skipped when the job's decision is already spent", () => {
    const s = site({ phases: ["A", "B"], currentPhaseIdx: 1, phaseProgress: 0, choicesOffered: 1, durationDays: 6 });
    expect(rollMidJobChoice(s, () => 0)).toBeNull();
  });
});
