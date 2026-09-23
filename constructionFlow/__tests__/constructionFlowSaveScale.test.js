import {
  freshState,
  gameTick,
  pruneContractHistory,
} from "../src/games/constructionflow/ConstructionFlowScreen";

import { ticksPerDay } from "../src/systems/gameClock.js";
// A literal tick count meant "this many game days" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so every such literal silently became a third of
// what it said. Derived from the clock now, so the next pace change cannot lie to it.
const TICKS_PER_DAY = ticksPerDay("1x");

// Contracts were the one collection in the save with no upper bound: every contract the
// player won and every contract a rival took stayed forever. Measured before the fix, a
// day-300 save carried 745 contracts and weighed 446 KB — and clone() deep-copies the whole
// save on every tick and every player tap. These tests pin the bound.
describe("Construction Flow save scale", () => {
  test("closed-contract history stays bounded over a long run", () => {
    let g = freshState();
    for (let i = 0; i < TICKS_PER_DAY * 200; i++) g = gameTick(g); // 200 game days
    expect(g.day).toBeGreaterThan(150);
    expect(g.contracts.length).toBeLessThanOrEqual(60);
    expect(JSON.stringify(g).length).toBeLessThan(200 * 1024);
  }, 300000);

  test("prune keeps every Open contract and every contract a live site points at", () => {
    const g = freshState();
    g.day = 200;
    g.activeSites = [{ id: "s1", contractId: "live-1" }];
    g.contracts = [
      { id: "live-1", status: "Active", expiresDay: 5 },
      { id: "open-1", status: "Open", expiresDay: 205 },
      { id: "stale-taken", status: "Taken", expiresDay: 20 },
      ...Array.from({ length: 120 }, (_, i) => ({
        id: `done-${i}`, status: "Active", expiresDay: 30 + i,
      })),
    ];
    pruneContractHistory(g);
    const ids = g.contracts.map((c) => c.id);
    expect(ids).toContain("live-1");
    expect(ids).toContain("open-1");
    expect(ids).not.toContain("stale-taken");
    // The most recent closed contracts survive; the oldest are dropped.
    expect(ids).toContain("done-119");
    expect(ids).not.toContain("done-0");
    expect(g.contracts.length).toBeLessThanOrEqual(45);
  });

  test("prune leaves the opening days alone so early history is intact", () => {
    const g = freshState();
    g.day = 6;
    g.contracts = Array.from({ length: 80 }, (_, i) => ({
      id: `c${i}`, status: "Active", expiresDay: 3,
    }));
    pruneContractHistory(g);
    expect(g.contracts.length).toBe(80);
  });
});
