// First-session Home: essentials first, everything else as the company grows (stage A).
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConstructionFlowScreen, { freshState } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { homeStage, homeSectionVisibility, HOME_STAGES, ALL_OPTIONAL_SECTIONS } from "../src/systems/homeLayout.js";

jest.useFakeTimers();
jest.setTimeout(30000);

describe("stages", () => {
  test("new → growing → established, by real progress", () => {
    expect(homeStage({ completedJobs: 0 })).toBe(HOME_STAGES.NEW);
    expect(homeStage({ completedJobs: 1 })).toBe(HOME_STAGES.GROWING);
    expect(homeStage({ completedJobs: 5 })).toBe(HOME_STAGES.ESTABLISHED);
    expect(homeStage({ completedJobs: 2, companyLevel: 2 })).toBe(HOME_STAGES.ESTABLISHED);
    expect(homeStage({ completedJobs: 1, cityOffices: [{ cityId: "portland" }] })).toBe(HOME_STAGES.ESTABLISHED);
  });

  test("a new company sees none of the optional sections; show-all reveals every one", () => {
    const v = homeSectionVisibility({ completedJobs: 0 });
    expect(ALL_OPTIONAL_SECTIONS.every((k) => v[k] === false)).toBe(true);
    expect(v.hiddenCount).toBe(ALL_OPTIONAL_SECTIONS.length);
    const all = homeSectionVisibility({ completedJobs: 0, homeShowAll: true });
    expect(ALL_OPTIONAL_SECTIONS.every((k) => all[k] === true)).toBe(true);
    expect(all.hiddenCount).toBe(0);
  });

  test("stages only ever widen", () => {
    const order = [{ completedJobs: 0 }, { completedJobs: 1 }, { completedJobs: 5 }].map(homeSectionVisibility);
    for (const k of ALL_OPTIONAL_SECTIONS) {
      if (order[0][k]) expect(order[1][k]).toBe(true);
      if (order[1][k]) expect(order[2][k]).toBe(true);
    }
  });
});

function text(tree) {
  const out = [];
  const walk = (n) => { if (n == null) return; if (typeof n === "string" || typeof n === "number") return out.push(String(n)); if (Array.isArray(n)) return n.forEach(walk); if (n.children) n.children.forEach(walk); };
  walk(tree.toJSON());
  return out.join("\n");
}

async function mount(mutate) {
  const g = freshState();
  g.setupDone = true; g.lastRealTimestamp = Date.now();
  mutate(g);
  await AsyncStorage.setItem("constructionflow_v1_save", JSON.stringify(g));
  let tree;
  await act(async () => { tree = TestRenderer.create(<ConstructionFlowScreen />); });
  await act(async () => { jest.advanceTimersByTime(10); });
  return tree;
}

describe("Home as a player sees it", () => {
  test("day 1: the tutorial and what to do — no dashboard, rivals or market news", async () => {
    const tree = await mount(() => {});
    try {
      const t = text(tree);
      expect(t).toMatch(/Accept Your First Contract/);
      for (const hidden of [/Executive Dashboard/, /LEGACY SCORE/, /Rival Activity/, /Ops Feed/, /Today's Priorities/]) expect(t).not.toMatch(hidden);
      expect(t).toMatch(/Show full dashboard \(\d+ more\)/);
    } finally { await act(async () => { tree.unmount(); }); }
  });

  test("the full dashboard is one tap away, and the choice sticks", async () => {
    const tree = await mount(() => {});
    try {
      const label = tree.root.findAll((n) => typeof n.props?.children === "string" && n.props.children.startsWith("Show full dashboard"))[0];
      let btn = label; while (btn && typeof btn.props?.onPress !== "function") btn = btn.parent;
      await act(async () => { btn.props.onPress(); });
      const t = text(tree);
      expect(t).toMatch(/Executive Dashboard/);
      expect(t).toMatch(/Show the essentials only/);
    } finally { await act(async () => { tree.unmount(); }); }
  });

  test("after the first job: this week and the feed; still no executive dashboard", async () => {
    const tree = await mount((g) => { g.completedJobs = 1; g.tutorialDone = true; g.weeklyStats = { revenue: 12000, expenses: 4000 }; });
    try {
      const t = text(tree);
      expect(t).toMatch(/This Week/);
      expect(t).toMatch(/Ops Feed/);
      expect(t).not.toMatch(/Executive Dashboard/);
    } finally { await act(async () => { tree.unmount(); }); }
  });

  test("an established company sees everything it saw before", async () => {
    const tree = await mount((g) => { g.completedJobs = 6; g.tutorialDone = true; });
    try {
      const t = text(tree);
      expect(t).toMatch(/Executive Dashboard/);
      expect(t).toMatch(/Rival Activity/);
      expect(t).not.toMatch(/Show full dashboard/);
    } finally { await act(async () => { tree.unmount(); }); }
  });
});
