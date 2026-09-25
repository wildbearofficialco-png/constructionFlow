// Sprint 1, P0-5 — money integrity over long seeded runs.
//
// "Long-running seeded simulations produce no NaN/Infinity values. If repair logic ever
// activates, tests fail unless the triggering cause is explicitly understood."
//
// Two kinds of run, both deterministic:
//   * an ACTIVE company — the first-hour harness player, kept going for ten contracts over up to
//     150 game days (bids, material orders, decision cards, repairs, tax bills);
//   * an ABANDONED company — nobody plays for 200 days, so overheads, market events and the
//     tax clock grind on with no revenue. This is where debt spirals and divide-by-zero live.
//
// Every tick of both is audited: every number in the save must be finite, saveHealth must never
// have to repair anything, and every change in cash must be covered by named ledger entries.

import { freshState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { playFirstHour, withSeed, findNonFinite, accountCashMove, TPD } from "../scripts/playtest/firstHourHarness.js";
import { reconcileUnloggedCashMovement } from "../src/systems/financialLedger.js";

jest.setTimeout(240000);

describe("an active company over ten contracts", () => {
  test.each([101, 202, 303])("seed %i: finite, unrepaired, fully accounted", (seed) => {
    const r = playFirstHour(seed, { maxDays: 150, jobs: 10 });
    expect(r.nonFinite).toEqual([]);
    expect(r.saveRepairs).toBe(0);
    expect(r.cash.silent).toBe(0);
    expect(r.cash.reconciled).toBe(0);
    expect(r.jobs.filter((j) => j.endDay != null).length).toBeGreaterThanOrEqual(6);
  });
});

describe("an abandoned company for 200 days", () => {
  test.each([1, 2, 3])("seed %i: finite, unrepaired, every cash change named", (seed) => {
    withSeed(seed, () => {
      let g = { ...freshState(), setupDone: true, tutorialDone: true };
      let silent = 0;
      const nonFinite = [];
      for (let i = 0; i < TPD * 200 && !g.gameOver; i++) {
        const before = g;
        g = gameTick(before);
        g.pendingDecision = null;
        silent += accountCashMove(before, g).silent;
        if (i % TPD === 0) {
          const nf = findNonFinite(g);
          if (nf.length) nonFinite.push({ day: g.day, nf: nf.slice(0, 3) });
        }
      }
      expect(nonFinite).toEqual([]);
      expect((g.healthLog || []).length).toBe(0);
      expect(silent).toBe(0);
      // Nothing is left for the safety net to guess at.
      const guessed = reconcileUnloggedCashMovement(g);
      expect(guessed).toEqual([]);
    });
  });
});
