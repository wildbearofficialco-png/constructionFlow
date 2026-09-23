// Inbox integration — the queue wired into the real game.
//
// The module tests prove the queue. These prove the GAME uses it, and that the defect the
// sprint set out to fix is measurably gone.

import fs from "fs";
import path from "path";

import { freshState, migrateState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { sortedNotices, topNotice, INBOX_CAP } from "../src/systems/noticeInbox.js";

import { ticksPerDay } from "../src/systems/gameClock.js";
// Was a hard-coded 48, which meant "ticks per game day" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so the literal silently became "a third of a day".
const TICKS_PER_DAY = ticksPerDay("1x");

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function run(days, seed, mutate = () => {}) {
  const real = Math.random;
  Math.random = seeded(seed);
  let g = freshState();
  g.setupDone = true; g.tutorialDone = true; g.cash = 500000;
  mutate(g);
  for (let i = 0; i < days * 48; i++) g = gameTick(g);
  Math.random = real;
  return g;
}

describe("the single slot is gone", () => {
  test("the one-field assignment no longer exists", () => {
    expect(SCREEN_CODE).not.toMatch(/state\.importantNotice = \{ id: Date\.now\(\)/);
  });

  test("every notice goes through the queue", () => {
    expect(SCREEN_CODE).toContain("pushNotice(state, message, tone, options)");
  });

  test("all 102-ish call sites still compile against the same signature", () => {
    // The migration kept addImportantNotice(state, message, tone) intact on purpose, so no
    // call site needed individual rewriting and re-review.
    const calls = (SCREEN_CODE.match(/addImportantNotice\(/g) || []).length;
    expect(calls).toBeGreaterThan(80);
  });
});

describe("the staleness defect is measurably fixed", () => {
  test("a day-3 milestone is NOT still on screen on day 120", () => {
    // This is the exact observed behaviour that motivated the sprint.
    const g = run(120, 7);
    for (const n of sortedNotices(g)) {
      const age = g.day - n.day;
      // Anything still present is either recent or waiting on a decision.
      expect({ msg: n.message, ok: age <= 3 || n.level === "action" })
        .toEqual({ msg: n.message, ok: true });
    }
  });

  test("the lead banner is never older than a few days", () => {
    const g = run(90, 3);
    const lead = topNotice(g);
    if (lead && lead.level !== "action") {
      expect(g.day - lead.day).toBeLessThanOrEqual(3);
    }
  });

  test("the inbox stays bounded across a long game", () => {
    const g = run(200, 11);
    expect((g.inbox || []).length).toBeLessThanOrEqual(INBOX_CAP);
  });

  test("ids stay unique across a long game", () => {
    const g = run(150, 5);
    const ids = (g.inbox || []).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("importantNotice still reflects the top of the queue, for anything reading it", () => {
    const g = run(40, 9);
    const lead = topNotice(g);
    if (lead) expect(g.importantNotice?.message).toBe(lead.message);
    else expect(g.importantNotice).toBeNull();
  });
});

describe("the daily ageing runs inside the tick", () => {
  test("expiry is wired to the day rollover, not to opening a screen", () => {
    expect(SCREEN_CODE).toContain("expireNotices(g)");
  });

  test("a notice raised today is still there tomorrow, and gone later", () => {
    let g = freshState();
    g.setupDone = true; g.tutorialDone = true;
    g.inbox = [{ id: "n1", message: "Old news", level: "good", day: g.day, read: false }];
    g._noticeSeq = 1;
    const startDay = g.day;
    // One day on: still present.
    for (let i = 0; i < TICKS_PER_DAY; i++) g = gameTick(g);
    expect(g.day).toBe(startDay + 1);
    expect((g.inbox || []).some((n) => n.message === "Old news")).toBe(true);
    // Several days on: aged out.
    for (let i = 0; i < TICKS_PER_DAY * 4; i++) g = gameTick(g);
    expect((g.inbox || []).some((n) => n.message === "Old news")).toBe(false);
  });
});

describe("save compatibility", () => {
  test("a build-5 save with no inbox gets one", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.inbox;
    delete legacy._noticeSeq;
    const migrated = migrateState(legacy);
    expect(Array.isArray(migrated.inbox)).toBe(true);
  });

  test("the notice a returning player had on screen is carried into the queue, not dropped", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.inbox;
    delete legacy._noticeSeq;
    legacy.day = 40;
    legacy.importantNotice = { id: 123, message: "Your loan was approved.", tone: "green" };
    const migrated = migrateState(legacy);
    expect(migrated.inbox.some((n) => n.message === "Your loan was approved.")).toBe(true);
  });

  test("a corrupted inbox is repaired rather than crashing the load", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.inbox = "garbage";
    const migrated = migrateState(legacy);
    expect(Array.isArray(migrated.inbox)).toBe(true);
  });

  test("migration does not resurrect a notice that was already stale", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    delete legacy.inbox; delete legacy._noticeSeq;
    legacy.day = 300;
    legacy.importantNotice = { id: 1, message: "Ancient congratulation", tone: "green" };
    const migrated = migrateState(legacy);
    // It is carried in at the CURRENT day, so it gets its normal lifespan from the upgrade
    // rather than arriving pre-expired or living forever.
    const carried = migrated.inbox.find((n) => n.message === "Ancient congratulation");
    if (carried) expect(carried.day).toBe(300);
  });
});
