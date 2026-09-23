// Save health.
//
// A device screenshot showed the header reading $NaN. Every affordability check in the game is
// `cash >= cost`, and every comparison against NaN is false — so once cash is NaN the player
// can buy nothing, hire nobody and pay no bill, and a loan adds to NaN and stays NaN. From
// inside the game it reads exactly as reported: "I run out of money before a job is completed.
// Even if I take out every loan I still run out."
//
// It could not be reproduced: ~1,500 simulated days across seeded runs, migrated build-6 saves
// and hostile states produced no non-finite value anywhere. That points at a handler, which the
// harness cannot drive. So this does not claim to know the cause — it stops the defect being
// fatal and leaves evidence behind.

import {
  CRITICAL_NUMERICS,
  FALLBACKS,
  auditState,
  repairState,
  snapshotGood,
  describeRepair,
} from "../src/systems/saveHealth.js";
import { freshState, migrateState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen.js";

describe("the audit finds what matters", () => {
  test("a healthy state passes", () => {
    expect(auditState(freshState()).ok).toBe(true);
  });

  test("NaN cash is caught", () => {
    const a = auditState({ ...freshState(), cash: NaN });
    expect(a.ok).toBe(false);
    expect(a.broken.map((b) => b.key)).toContain("cash");
  });

  test("so are Infinity and a string that looks like a number", () => {
    for (const bad of [Infinity, -Infinity, "75000", null, undefined]) {
      expect(auditState({ ...freshState(), cash: bad }).ok).toBe(false);
    }
  });

  test("every critical field is actually checked", () => {
    for (const key of CRITICAL_NUMERICS) {
      const g = { ...freshState(), [key]: NaN };
      expect({ key, caught: auditState(g).broken.some((b) => b.key === key) }).toEqual({ key, caught: true });
    }
  });

  test("a corrupted wage is caught, because it feeds cash", () => {
    const g = freshState();
    g.crew[0].wagePerDay = NaN;
    expect(auditState(g).broken.some((b) => b.key.includes("wagePerDay"))).toBe(true);
  });

  test("a missing game is not a crash", () => {
    expect(auditState(null).ok).toBe(true);
  });
});

describe("repair restores what the player had, not a constant", () => {
  test("cash comes back from the last good snapshot", () => {
    const good = snapshotGood({ ...freshState(), cash: 48213 });
    const g = { ...freshState(), cash: NaN };
    const r = repairState(g, good);
    expect(r.repaired).toBe(true);
    expect(g.cash).toBe(48213);
  });

  test("without a snapshot it falls back to something sane", () => {
    const g = { ...freshState(), cash: NaN };
    repairState(g, null);
    expect(g.cash).toBe(FALLBACKS.cash);
    expect(Number.isFinite(g.cash)).toBe(true);
  });

  test("a healthy state is left completely alone", () => {
    const g = freshState();
    const before = JSON.stringify(g);
    expect(repairState(g, null).repaired).toBe(false);
    expect(JSON.stringify(g)).toBe(before);
  });

  test("it repairs everything broken, not just the first thing", () => {
    const g = { ...freshState(), cash: NaN, taxDue: Infinity, reputation: "high" };
    repairState(g, null);
    for (const k of ["cash", "taxDue", "reputation"]) expect(Number.isFinite(g[k])).toBe(true);
  });

  test("a corrupted wage is repaired to a workable number", () => {
    const g = freshState();
    g.crew[0].wagePerDay = NaN;
    repairState(g, null);
    expect(Number.isFinite(g.crew[0].wagePerDay)).toBe(true);
    expect(g.crew[0].wagePerDay).toBeGreaterThan(0);
  });

  test("it leaves a bounded breadcrumb so the next report names itself", () => {
    const g = freshState();
    for (let i = 0; i < 40; i++) { g.cash = NaN; repairState(g, null); }
    expect(g.healthLog.length).toBeLessThanOrEqual(20);
    expect(g.healthLog[0].fields.join()).toContain("cash");
  });

  test("the player is told, in words, rather than silently corrected", () => {
    // A game that quietly rewrites the player's money is worse than one that breaks honestly.
    const g = { ...freshState(), cash: NaN };
    const msg = describeRepair(repairState(g, null));
    expect(msg).toMatch(/restored/i);
    expect(msg).toMatch(/report this/i);
  });
});

describe("wired into the game", () => {
  test("a tick that begins with NaN cash ends with real cash", () => {
    const g = { ...freshState(), setupDone: true, tutorialDone: true, cash: NaN };
    const after = gameTick(g);
    expect(Number.isFinite(after.cash)).toBe(true);
  });

  test("and says so in the log", () => {
    const g = { ...freshState(), setupDone: true, tutorialDone: true, cash: NaN };
    const after = gameTick(g);
    expect((after.logs || []).some((l) => /Recovered a corrupted value/i.test(typeof l === "string" ? l : l?.text || ""))).toBe(true);
  });

  test("a save that arrives corrupted is repaired before it is played", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.cash = null;
    legacy.taxDue = NaN;
    const m = migrateState(legacy);
    expect(Number.isFinite(m.cash)).toBe(true);
    expect(Number.isFinite(m.taxDue)).toBe(true);
  });

  test("the guard never fires on a normal run", () => {
    // If this ever fails, something in the tick is genuinely producing NaN and the repair is
    // masking it — which is the one way this module could do harm.
    let g = { ...freshState(), setupDone: true, tutorialDone: true };
    for (let i = 0; i < 600; i++) g = gameTick(g);
    expect(g.healthLog || []).toEqual([]);
  });
});
