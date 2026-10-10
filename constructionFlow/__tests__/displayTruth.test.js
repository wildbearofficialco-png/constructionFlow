// Numbers the player reads must be true (review sprint, P2).
//
// Each case here was seen on screen in a live playtest of build 14.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConstructionFlowScreen, {
  freshState, computeMarketShare, cityDisplayName,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

jest.useFakeTimers();
jest.setTimeout(30000);

const STORAGE_KEY = "constructionflow_v1_save";

function screenText(tree) {
  const out = [];
  const walk = (n) => {
    if (n == null) return;
    if (typeof n === "string" || typeof n === "number") return out.push(String(n));
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.children) n.children.forEach(walk);
  };
  walk(tree.toJSON());
  return out.join("");
}

async function mount(mutate) {
  const g = freshState();
  g.setupDone = true; g.tutorialDone = true; g.lastRealTimestamp = Date.now();
  mutate(g);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(g));
  let tree;
  await act(async () => { tree = TestRenderer.create(<ConstructionFlowScreen />); });
  await act(async () => { jest.advanceTimersByTime(10); });
  return tree;
}

describe("market share is one number", () => {
  test("a one-city company with big rivals has a small share, not 13%", () => {
    const g = freshState();
    g.rivals = g.rivals.map((r) => ({ ...r, cash: 2_000_000, rep: 50, jobsCompleted: 30 }));
    const share = computeMarketShare(g, 200_000);
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(5);
  });

  test("small shares keep one decimal; large shares are whole", () => {
    const g = freshState();
    g.rivals = [{ id: "x", cash: 9_800_000, rep: 0, cityPresence: ["salem"], jobsCompleted: 0 }];
    expect(computeMarketShare(g, 100_000)).toBe(1);
    g.rivals = [{ id: "x", cash: 100_000, rep: 0, cityPresence: [], jobsCompleted: 0 }];
    expect(Number.isInteger(computeMarketShare(g, 300_000))).toBe(true);
  });

  test("acquired and bankrupt rivals are not in the market", () => {
    const g = freshState();
    g.rivals = [{ id: "a", cash: 1_000_000, status: "Bankrupt" }, { id: "b", cash: 1_000_000 }];
    g.acquiredRivals = ["b"];
    expect(computeMarketShare(g, 50_000)).toBe(100);
  });

  test("no screen reads the old footprint number", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
    expect(src).not.toMatch(/game\.marketShare\s*\|\|\s*1/);
  });
});

describe("the home city is the player's own town", () => {
  test("home market shows the typed city name, whatever competition template setup chose", () => {
    for (const startingCityId of ["salem", "portland", "phoenix"]) {
      const g = { ...freshState(), homeCityName: "Bend", startingCityId };
      expect(cityDisplayName(g, "salem")).toBe("Bend");
      expect(cityDisplayName(g, undefined)).toBe("Bend");
    }
  });
  test("other cities keep their names; no typed name falls back to the city", () => {
    const g = { ...freshState(), homeCityName: "Bend" };
    expect(cityDisplayName(g, "portland")).toBe("Portland");
    expect(cityDisplayName({ ...g, homeCityName: "" }, "salem")).toBe("Salem");
  });

  test("the Bids card names Bend, not Salem", async () => {
    // "Growing City" at setup sets the Portland template — the case the live replay caught.
    const tree = await mount((g) => { g.homeCityName = "Bend"; g.startingCityId = "portland"; });
    try {
      // Open the Bids tab: Home's header also reads "· Bend, OR", which would pass this vacuously.
      const bidsTab = tree.root.findAll((n) => n.props?.children === "Bids").map((n) => { let x = n; while (x && typeof x.props?.onPress !== "function") x = x.parent; return x; }).filter(Boolean).pop();
      await act(async () => { bidsTab.props.onPress(); });
      const text = screenText(tree);
      expect(text).toMatch(/Fence Installation/);
      expect(text).toMatch(/· Bend/);
      expect(text).not.toMatch(/· Salem/);
      // The held tutorial job says so, instead of counting down to an expiry that never comes.
      expect(text).toMatch(/Held for you — rivals can't take this one/);
    } finally { await act(async () => { tree.unmount(); }); }
  });
});

describe("rival reputation is shown in whole points", () => {
  test("no raw fractions on Home", async () => {
    const tree = await mount((g) => { g.rivals = g.rivals.map((r) => ({ ...r, rep: 58.39506779108726 })); });
    try {
      const text = screenText(tree);
      expect(text).not.toMatch(/58\.39/);
      expect(text).toMatch(/rep [↑↓] \S+ 58/); // the panel rendered, rounded
    } finally { await act(async () => { tree.unmount(); }); }
  });
});

describe("the job-complete screen leads with profit", () => {
  test("headline is the job's profit; the final payment is labelled as such", async () => {
    const tree = await mount((g) => {
      g.pendingCelebration = {
        label: "Road Patch & Seal", client: "Keystone Capital", earned: 12161, isOnTime: true, repGained: 4,
        economics: { contractValue: 47139, depositPaid: 35355, penalty: 0, qualityBonus: 377, materials: 2996, labor: 1725, equipment: 805, incidents: 0, directCosts: 5526, grossRevenue: 47516, finalPayment: 12161, netProfit: 41990, marginPercent: 88 },
      };
    });
    try {
      const text = screenText(tree);
      expect(text).toMatch(/\+\$41,990/);
      expect(text).toMatch(/profit on this job/);
      expect(text).toMatch(/Final payment \$12,161 from Keystone Capital/);
      expect(text).toMatch(/paid before completion \(deposit and phase payments\)/);
      expect(text).not.toMatch(/arrived as the deposit at mobilisation/);
    } finally { await act(async () => { tree.unmount(); }); }
  });
});

describe("a rival that is bought is not reported as bankrupt", () => {
  test("the story names the buyer", () => {
    const { gameTick } = require("../src/games/constructionflow/ConstructionFlowScreen.js");
    const g = freshState();
    g.setupDone = true;
    g.rivals[1] = { ...g.rivals[1], status: "Bankrupt", acquiredBy: "Apex Construction" };
    g.pendingStory = null;
    // Run to the next day boundary so the daily story check runs.
    let s = g;
    const startDay = s.day;
    for (let i = 0; i < 200 && s.day === startDay; i++) s = gameTick(s);
    const story = JSON.stringify(s.pendingStory || {});
    expect(story).not.toMatch(/Collapses/);
    expect(story).toMatch(/Apex Construction Buys/);
  });
});
