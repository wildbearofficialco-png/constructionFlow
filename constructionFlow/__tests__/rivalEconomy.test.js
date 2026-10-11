// Rivals earn from the contracts they win (systems/rivalEconomy.js).
//
// The old model paid $12k–40k per open job per DAY regardless of the job's value: a $9,000 fence
// was worth ~$100,000 to a rival, and the top firm passed $13M by day 37.
import {
  ensureJobBook, rivalWinsContract, settleRivalDay,
  RIVAL_MARGIN_MAX, RIVAL_OVERHEAD_BASE, RIVAL_OVERHEAD_PER_EMPLOYEE,
} from "../src/systems/rivalEconomy.js";

const rival = (over = {}) => ({ id: "r", name: "IronPeak", cash: 30000, employees: 4, activeJobs: 0, ...over });

test("winning a contract books its value and keeps the count in step", () => {
  const r = rival();
  rivalWinsContract(r, { value: 9000 });
  rivalWinsContract(r, { value: 45000 });
  expect(r.jobBook).toEqual([9000, 45000]);
  expect(r.activeJobs).toBe(2);
});

test("a $9,000 fence is worth at most its margin to a rival, not ~$100,000", () => {
  const r = rival({ employees: 1 });
  rivalWinsContract(r, { value: 9000 });
  let earned = 0;
  for (let d = 0; d < 60 && r.jobBook.length; d++) earned += settleRivalDay(r).income;
  expect(earned).toBeGreaterThan(0);
  expect(earned).toBeLessThanOrEqual(Math.round(9000 * RIVAL_MARGIN_MAX));
});

test("overhead is paid every day, work or not", () => {
  const r = rival({ cash: 10000, employees: 5 });
  const out = settleRivalDay(r, () => 0.99);
  expect(out.income).toBe(0);
  expect(r.cash).toBe(10000 - (RIVAL_OVERHEAD_BASE + 5 * RIVAL_OVERHEAD_PER_EMPLOYEE));
});

test("a job finishes and pays once", () => {
  const r = rival({ employees: 1 });
  rivalWinsContract(r, { value: 100000 });
  const out = settleRivalDay(r, () => 0.01); // finishes; minimum margin
  expect(out.completed).toBe(1);
  expect(out.income).toBeGreaterThanOrEqual(22000);
  expect(r.jobBook).toEqual([]);
  expect(settleRivalDay(r, () => 0.01).income).toBe(0);
});

test("a save from before job books gets one entry per open job", () => {
  const r = ensureJobBook(rival({ activeJobs: 3 }), 20000);
  expect(r.jobBook).toEqual([20000, 20000, 20000]);
  expect(r.activeJobs).toBe(3);
  ensureJobBook(r, 99);
  expect(r.jobBook).toEqual([20000, 20000, 20000]); // never rebuilt once present
});

describe("one-time market correction for old saves", () => {
  const { freshState, migrateState } = require("../src/games/constructionflow/ConstructionFlowScreen.js");
  const { rivalValuation } = require("../src/systems/rivalMarket.js");
  const { rivalValueLimit, MARKET_CORRECTION_FLAG } = require("../src/systems/rivalEconomy.js");

  function oldSave() {
    const g = freshState();
    delete g[MARKET_CORRECTION_FLAG];          // written before the correction existed
    g.day = 60; g.setupDone = true; g.cash = 340000; g.completedJobs = 14; g.reputation = 55;
    g.rivals = g.rivals.map((r, i) => ({ ...r, cash: (50 - i * 6) * 1_000_000, rep: 80, activeJobs: 18, equipment: 6, jobBook: undefined }));
    return JSON.parse(JSON.stringify(g));
  }
  const playerView = (g) => JSON.stringify({ cash: g.cash, crew: g.crew, equipment: g.equipment, contracts: g.contracts, completedJobs: g.completedJobs, reputation: g.reputation, activeSites: g.activeSites, materials: g.materials, day: g.day, loans: g.loans });

  test("rivals over the limit are brought back to it, in order, and nothing of the player's changes", () => {
    const saved = oldSave();
    const g = migrateState(JSON.parse(JSON.stringify(saved)));
    // The player is worth cash + machines + reputation (55 x $1,500) — under $450k here.
    const limit = rivalValueLimit(60, 450000);
    const values = g.rivals.map(rivalValuation);
    expect(Math.max(...values)).toBeLessThanOrEqual(limit);
    const before = saved.rivals.map((r) => r.cash);
    const order = (arr) => arr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    expect(order(values)).toEqual(order(before));
    expect(g.rivals.every((r) => r.jobBook.length <= 8)).toBe(true);
    expect(playerView(g)).toBe(playerView(migrateState(JSON.parse(JSON.stringify(saved)))));
    expect(g.cash).toBe(340000); expect(g.completedJobs).toBe(14); expect(g.reputation).toBe(55);
  });

  test("it says so once, in one news line, and never runs again", () => {
    const g = migrateState(oldSave());
    const lines = (g.marketNews || []).filter((n) => /Market correction/.test(n.text));
    expect(lines).toHaveLength(1);
    expect(g[MARKET_CORRECTION_FLAG]).toBe(true);
    // Loaded again (and again), and with rivals grown huge again in play: no second correction.
    g.rivals[0].cash = 90_000_000;
    const again = migrateState(JSON.parse(JSON.stringify(g)));
    const again2 = migrateState(JSON.parse(JSON.stringify(again)));
    expect(again2.rivals[0].cash).toBe(90_000_000);
    expect((again2.marketNews || []).filter((n) => /Market correction/.test(n.text))).toHaveLength(1);
  });

  test("a save whose rivals are within the limits is left alone, silently", () => {
    const g0 = freshState();
    delete g0[MARKET_CORRECTION_FLAG];
    const before = JSON.stringify(g0.rivals);
    const g = migrateState(JSON.parse(JSON.stringify(g0)));
    expect((g.marketNews || []).some((n) => /Market correction/.test(n.text))).toBe(false);
    expect(g[MARKET_CORRECTION_FLAG]).toBe(true);
    expect(g.rivals.map((r) => r.cash)).toEqual(JSON.parse(before).map((r) => r.cash));
  });

  test("a new game never sees it", () => {
    const g = migrateState(JSON.parse(JSON.stringify(freshState())));
    expect((g.marketNews || []).some((n) => /Market correction/.test(n.text))).toBe(false);
  });
});
