// The clock, and the tab label that fell off the bar.
//
// Both reported from a device screenshot on build 5.
//
// THE CLOCK. Construction Flow has always had one: `gameMinutes` starts at 480 (8:00 AM) and
// advances 30 per tick, 48 ticks to the day. It was never rendered, so time passed invisibly and
// the day appeared to jump — which is what "the clock feels off" was describing. The formatter
// is deliberately identical to FleetFlow's so the two games tell the time the same way.
//
// THE TAB LABEL. "Equipment" is the longest entry in TABS and was wrapping to two lines and
// overflowing the bar.

import fs from "fs";
import path from "path";

import { formatClock, freshState, gameTick, TABS } from "../src/games/constructionflow/ConstructionFlowScreen.js";

import { ticksPerDay } from "../src/systems/gameClock.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

describe("the clock reads the way FleetFlow's does", () => {
  test("midnight, noon and the edges are right", () => {
    expect(formatClock(0)).toBe("12:00 AM");
    expect(formatClock(1)).toBe("12:01 AM");
    expect(formatClock(11 * 60 + 59)).toBe("11:59 AM");
    expect(formatClock(12 * 60)).toBe("12:00 PM");
    expect(formatClock(13 * 60 + 5)).toBe("1:05 PM");
    expect(formatClock(23 * 60 + 59)).toBe("11:59 PM");
  });

  test("the working day starts at 8:00 AM, as the state has always said", () => {
    expect(formatClock(480)).toBe("8:00 AM");
    expect(freshState().gameMinutes).toBe(480);
  });

  test("minutes are zero-padded, so the clock never jitters in width", () => {
    expect(formatClock(9 * 60 + 5)).toBe("9:05 AM");
    expect(formatClock(9 * 60 + 30)).toBe("9:30 AM");
  });

  test("a missing or junk value falls back to the start of the day rather than NaN", () => {
    for (const bad of [undefined, null, NaN, "nonsense", Infinity]) {
      expect(formatClock(bad)).toBe("8:00 AM");
    }
  });

  test("it wraps past 24h rather than reading 25:00", () => {
    expect(formatClock(1440)).toBe("12:00 AM");
    expect(formatClock(1440 + 480)).toBe("8:00 AM");
  });

  test("the clock actually advances as the game ticks, and rolls the day over", () => {
    let g = freshState();
    g.setupDone = true; g.tutorialDone = true;
    const startDay = g.day;
    const seen = new Set();
    for (let i = 0; i < ticksPerDay("1x"); i++) {
      g = gameTick(g);
      seen.add(formatClock(g.gameMinutes));
    }
    // One day's worth of ticks is exactly one day, whatever the pace is set to.
    expect(g.day).toBe(startDay + 1);
    // And the player would have seen the time move, not sit still.
    expect(seen.size).toBeGreaterThan(20);
  });

  test("the header renders the day and the time together", () => {
    expect(SCREEN_CODE).toContain("formatClock(game.gameMinutes)");
    expect(SCREEN_CODE).toMatch(/Day \$\{game\.day\} · \$\{formatClock\(game\.gameMinutes\)\}/);
  });
});

describe("no tab label can fall off the bar", () => {
  test("the tab label is pinned to one line and allowed to shrink", () => {
    const bar = SCREEN_CODE.slice(SCREEN_CODE.indexOf('accessibilityRole="tab"'));
    expect(bar).toContain("numberOfLines={1}");
    expect(bar).toContain("adjustsFontSizeToFit");
    expect(bar).toContain("minimumFontScale");
  });

  test("tab items can shrink below their content width", () => {
    // Without minWidth: 0 a flex child refuses to shrink past its intrinsic text width, which
    // is what pushed "Equipment" onto a second line.
    expect(SCREEN_CODE).toMatch(/tabItem:\s*\{[^}]*minWidth: 0/);
  });

  test("the label is centred and fills its cell", () => {
    expect(SCREEN_CODE).toMatch(/tabLabel:\s*\{[^}]*textAlign: "center"/);
  });

  test("every tab name is short enough to be plausible in a 7-tab bar", () => {
    // A guard against a future rename reintroducing the overflow.
    for (const t of TABS) {
      expect({ tab: t, length: t.length <= 9 }).toEqual({ tab: t, length: true });
    }
    expect(TABS).toHaveLength(7);
  });
});
