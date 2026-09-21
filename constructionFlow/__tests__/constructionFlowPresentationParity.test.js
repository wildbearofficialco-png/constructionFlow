// Presentation-parity regression tests.
//
// Phase 1 of the FleetFlow parity work fixed a set of defects that are invisible to a normal
// unit test because they live in JSX: text rendered at 9px, a card rendered twice, a tab still
// named after a different game. These tests pin them by reading the screen source, which is
// the same technique FleetFlow uses for its own release-blocker checks — a hand-edit that
// reintroduces one of these fails CI rather than reaching a device.
//
// See FLEETFLOW_PARITY_AUDIT.md §2 gaps 2, 3, 6, 7, 8 and 38.

import fs from "fs";
import path from "path";

import {
  TABS,
  normalizeTabName,
  freshState,
  migrateState,
  getNextBestAction,
  getPredictiveWarnings,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_SRC = fs.readFileSync(SCREEN_PATH, "utf8");

// Comment-stripped source. Several assertions below count occurrences of a pattern, and a
// comment explaining the defect being pinned would otherwise count as an instance of it.
// The `(?<!:)` guard keeps `https://...` inside a string from eating the rest of its line.
const SCREEN_CODE = SCREEN_SRC
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(?<!:)\/\/.*$/gm, "");

describe("the source scan itself", () => {
  test("stripping comments leaves the code intact", () => {
    // If the stripper ever ate real code, every count-based test below would silently
    // start passing for the wrong reason.
    expect(SCREEN_CODE.length).toBeGreaterThan(SCREEN_SRC.length * 0.7);
    expect(SCREEN_CODE).toContain("export function freshState()");
    expect(SCREEN_CODE).toContain("export const TABS");
    expect((SCREEN_CODE.match(/fontSize:\s*\d+/g) || []).length).toBeGreaterThan(100);
  });
});

describe("typography floor", () => {
  test("no text in the game is rendered below 11px", () => {
    // Construction Flow shipped 34 uses of 9px and 100 of 10px, including body copy — 51% of
    // all font sizes at or below 10px, against FleetFlow's 18%. This is the single most
    // visible quality gap on a physical iPhone.
    const offenders = SCREEN_CODE.match(/fontSize:\s*(?:[0-9]|10)\b/g) || [];
    expect(offenders).toEqual([]);
  });

  test("11px is used sparingly, because it is the eyebrow size only", () => {
    const elevenPx = (SCREEN_CODE.match(/fontSize:\s*11\b/g) || []).length;
    const allSizes = (SCREEN_CODE.match(/fontSize:\s*\d+/g) || []).length;
    expect(allSizes).toBeGreaterThan(0);
    expect(elevenPx / allSizes).toBeLessThan(0.2);
  });

  test("the shared stylesheet's body styles clear the floor", () => {
    // styles.sub is the workhorse text style, referenced at hundreds of call sites.
    const sub = SCREEN_CODE.match(/sub:\s*\{\s*fontSize:\s*(\d+)/);
    expect(sub).not.toBeNull();
    expect(Number(sub[1])).toBeGreaterThanOrEqual(12);
  });
});

describe("tab naming", () => {
  test("the equipment tab is called Equipment, not Vehicles", () => {
    expect(TABS).toContain("Equipment");
    expect(TABS).not.toContain("Vehicles");
  });

  test("the tab set stays within the WildBear UI Standard's 5-7 range", () => {
    expect(TABS.length).toBeGreaterThanOrEqual(5);
    expect(TABS.length).toBeLessThanOrEqual(7);
  });

  test("an older save or helper naming Vehicles lands on Equipment, not a blank screen", () => {
    expect(normalizeTabName("Vehicles")).toBe("Equipment");
    expect(normalizeTabName("Fleet")).toBe("Equipment");
  });

  test("a real tab name passes through unchanged", () => {
    for (const tab of TABS) expect(normalizeTabName(tab)).toBe(tab);
  });

  test("an unrecognised tab falls back to Home rather than rendering nothing", () => {
    for (const bad of [undefined, null, "", "Dispatch", "Garage", 7, {}]) {
      expect(normalizeTabName(bad)).toBe("Home");
    }
  });

  test("every tab the screen can render has an entry in the tab list", () => {
    // `{tab === "X" && renderY()}` — each of these must be reachable from the tab bar.
    const rendered = [...SCREEN_CODE.matchAll(/\{tab === "([A-Za-z]+)"\s*&&/g)].map((m) => m[1]);
    expect(rendered.length).toBe(TABS.length);
    for (const name of rendered) expect(TABS).toContain(name);
  });
});

describe("guidance is singular and actionable", () => {
  test("Next Best Action is rendered exactly once on Home", () => {
    // It used to appear twice, ~250 lines apart, in two different card designs — the same
    // getNextBestAction(game) result rendered as two separate cards.
    const calls = (SCREEN_CODE.match(/getNextBestAction\(game\)/g) || []).length;
    expect(calls).toBe(1);
  });

  test("no guidance sends the player to a tab that no longer exists", () => {
    // getNextBestAction's records used to point at "Vehicles".
    const states = [
      freshState(),
      { ...freshState(), businessFrozen: true },
      { ...freshState(), cash: -5000 },
      { ...freshState(), equipment: [], crew: [] },
      { ...freshState(), tutorialDone: true, contracts: [] },
    ];
    for (const state of states) {
      const action = getNextBestAction(state);
      if (action && action.tab) expect(TABS).toContain(action.tab);
    }
  });

  test("every predictive warning carries a tab the player can act on", () => {
    // FleetFlow's Early Warnings each carry a tap target to the screen that fixes the
    // problem. Construction Flow's were bullet dots with nowhere to go.
    const g = freshState();
    g.cash = 200; // trips the runway warning
    g.tutorialDone = true;
    g.equipment = [{ id: "e1", name: "Old Excavator", condition: 12, dailyCost: 50, status: "Idle", shopId: "excavator" }];

    const warnings = getPredictiveWarnings(g);
    expect(warnings.length).toBeGreaterThan(0);
    for (const w of warnings) {
      expect(typeof w.text).toBe("string");
      expect(w.text.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(w.severity);
      expect(TABS).toContain(w.tab);
      expect(typeof w.action).toBe("string");
      expect(w.action.length).toBeGreaterThan(0);
    }
  });

  test("warnings are still capped at three, so Home cannot be buried in them", () => {
    const g = freshState();
    g.cash = 10;
    g.tutorialDone = true;
    g.day = 200;
    g.equipment = [
      { id: "e1", name: "A", condition: 5, dailyCost: 50, status: "Idle", shopId: "excavator" },
      { id: "e2", name: "B", condition: 5, dailyCost: 50, status: "Idle", shopId: "excavator" },
    ];
    g.activeSites = [1, 2, 3, 4].map((n) => ({
      id: `s${n}`, label: `Site ${n}`, status: "Active", deadlineDay: 1,
      contractId: `c${n}`, materialsFulfilled: {}, phases: ["Site Prep"], currentPhaseIdx: 0,
    }));
    expect(getPredictiveWarnings(g).length).toBeLessThanOrEqual(3);
  });

  test("warning copy talks about machines, not vehicles", () => {
    const g = freshState();
    g.tutorialDone = true;
    g.equipment = [{ id: "e1", name: "Old Excavator", condition: 10, dailyCost: 50, status: "Idle", shopId: "excavator" }];
    const text = getPredictiveWarnings(g).map((w) => w.text).join(" ").toLowerCase();
    expect(text).not.toContain("vehicle");
  });
});

describe("design system adoption", () => {
  test("the screen imports the shared theme rather than defining its own", () => {
    // The inherited copy declared a local THEMES object byte-identical to FleetFlow's.
    expect(SCREEN_SRC).toContain('from "../../theme/constructionTheme.js"');
    expect(SCREEN_CODE).not.toMatch(/^const THEMES = \{/m);
  });

  test("the screen uses the shared UI primitives", () => {
    expect(SCREEN_SRC).toContain('from "../../components/ui/index.js"');
    for (const component of ["<Card", "<SectionLabel", "<Pill", "<ProgressBar", "<StatTile", "<AlertBanner", "<EmptyState", "<KeyValueRow"]) {
      expect(SCREEN_CODE).toContain(component);
    }
  });

  test("motion is wired up and respects Reduce Motion", () => {
    expect(SCREEN_SRC).toContain('from "../../utils/constructionMotion.js"');
    expect(SCREEN_CODE).toContain("useOsReducedMotion()");
    // Every animation must be gated on the OS setting, never unconditional.
    expect(SCREEN_CODE).toContain("!reducedMotion");
  });

  test("equipment artwork reaches the job site, not only the shop", () => {
    // 45 equipment renders ship with the game; they used to appear in two places.
    const uses = (SCREEN_CODE.match(/EQUIPMENT_IMAGES\[/g) || []).length;
    expect(uses).toBeGreaterThanOrEqual(4);
  });
});

describe("gameplay is unchanged by the presentation pass", () => {
  test("a fresh company still starts with the documented opening position", () => {
    const g = freshState();
    expect(g.cash).toBe(75000);
    expect(g.day).toBe(1);
    expect(g.creditScore).toBe(600);
    expect(g.equipment).toHaveLength(1);
    expect(g.crew).toHaveLength(3);
    expect(g.contracts).toHaveLength(3);
    expect(g.materials.lumber).toBe(20);
  });

  test("the save key is untouched, so existing devices still find their save", () => {
    expect(SCREEN_CODE).toContain('const STORAGE_KEY = "constructionflow_v1_save";');
  });

  test("a save written before this change still loads", () => {
    // Simulates a build-1 save: no theme tokens, no knowledge of the Equipment tab.
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.cash = 123456;
    legacy.day = 42;
    legacy.completedJobs = 7;
    legacy.reputation = 31;
    delete legacy.importantNotice;

    const loaded = migrateState(legacy);
    expect(loaded.cash).toBe(123456);
    expect(loaded.day).toBe(42);
    expect(loaded.completedJobs).toBe(7);
    expect(loaded.reputation).toBe(31);
  });
});
