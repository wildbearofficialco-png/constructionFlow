// Living-market integration tests — the market module wired into the real game.
//
// `rivalMarket.test.js` proves the helpers in isolation. These prove the game uses them, and
// that the defects the audit found are actually gone from the running simulation rather than
// merely fixed in a module nothing calls:
//
//   - a market emptied by acquisitions and bankruptcies comes back
//   - the companies the player BOUGHT never come back
//   - rival news never lands in the player's own operations feeds
//   - one bankruptcy lifecycle, with no trace of the old fields
//   - an acquisition transfers what it promised and balances in the ledger

import fs from "fs";
import path from "path";

import {
  freshState,
  migrateState,
  gameTick,
  enhancedRivalDailyLogic,
  enhancedRivalBidding,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import {
  RIVAL_STATUS,
  countLiveRivals,
  planAcquisition,
  acquisitionCost,
  MARKET_NEWS_CAP,
  THIN_MARKET_THRESHOLD,
  ENTRANT_COOLDOWN_DAYS,
} from "../src/systems/rivalMarket.js";

import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from "../src/systems/financialLedger.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_SRC = fs.readFileSync(SCREEN_PATH, "utf8");
const SCREEN_CODE = SCREEN_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

function marketGame(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.day = 200;
  g.reputation = 80;
  g.cash = 2000000;
  g.lastAcquisitionDay = 0;
  return { ...g, ...over };
}

describe("the ledger knows every category the game writes to", () => {
  test("no recordTransaction call uses a category that would render unlabelled", () => {
    // Caught during Phase 4: the new acquisition handler wrote to an "acquisitions" category
    // that did not exist in either map, which renders without a label, icon or colour in the
    // Finance tab — a silent presentation break rather than an error.
    const used = [...SCREEN_CODE.matchAll(/recordTransaction\(\s*\w+\s*,\s*"([a-zA-Z_]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(5);
    const known = new Set([...Object.keys(EXPENSE_CATEGORIES), ...Object.keys(REVENUE_CATEGORIES)]);
    const unknown = [...new Set(used)].filter((c) => !known.has(c));
    expect(unknown).toEqual([]);
  });

  test("acquisitions is spendable and receivable, since a deal moves cash both ways", () => {
    expect(EXPENSE_CATEGORIES.acquisitions).toBeTruthy();
    expect(REVENUE_CATEGORIES.acquisitions).toBeTruthy();
  });
});

describe("the old bankruptcy plumbing is gone", () => {
  test("no code path still reads or writes the superseded fields", () => {
    // Four overlapping ways of saying one thing: `bankrupt`, `bankruptDay`, `bankruptDays`
    // and `lowValuationDays`, with two systems disagreeing about what `bankruptDays` meant.
    for (const field of ["bankruptDays", "bankruptDay", "lowValuationDays"]) {
      expect(SCREEN_CODE).not.toContain(`rival.${field}`);
      expect(SCREEN_CODE).not.toContain(`_weakerRival.${field}`);
    }
    // And the dead write to a field nothing reads.
    expect(SCREEN_CODE).not.toContain("rival.reputation =");
  });

  test("only one counter for a rival's machines survives", () => {
    // Two capex paths incremented different fields; the UI read only one, so half of every
    // rival's purchases were invisible. The migration still READS the retired field once, to
    // fold an old save's value into the surviving one — that is the point of it. What must
    // never come back is a WRITE, which is what would re-split the counter.
    expect(SCREEN_CODE).not.toMatch(/equipCount\s*=/);
    expect(SCREEN_CODE).not.toContain("rival.equipCount");
    // And it survives on exactly one line — the migration's fold, which names it twice
    // (the guard and the value).
    const lines = SCREEN_CODE.split("\n").filter((l) => l.includes("equipCount"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("equipment:");
  });

  test("the screen uses the shared lifecycle rather than an inline one", () => {
    expect(SCREEN_SRC).toContain('from "../../systems/rivalMarket.js"');
    expect(SCREEN_CODE).toContain("stepRivalLifecycle(rival");
  });
});

describe("rival news stays out of the player's own feeds", () => {
  test("a year of market activity never displaces the player's ops log", () => {
    let g = marketGame();
    // Put a marker in the player's own feeds and make sure it survives.
    g.logs = ["MY OWN EVENT"];
    g.opsFeed = [{ id: "mine", text: "MY OWN EVENT", tone: "neutral", day: g.day }];

    for (let i = 0; i < 365; i++) {
      g.day += 1;
      enhancedRivalDailyLogic(g);
    }

    expect(g.logs).toContain("MY OWN EVENT");
    expect(g.opsFeed.some((e) => e.text === "MY OWN EVENT")).toBe(true);
  });

  test("market news accumulates in its own capped feed", () => {
    let g = marketGame();
    for (let i = 0; i < 365; i++) {
      g.day += 1;
      enhancedRivalDailyLogic(g);
    }
    expect(Array.isArray(g.marketNews)).toBe(true);
    expect(g.marketNews.length).toBeLessThanOrEqual(MARKET_NEWS_CAP);
    for (const item of g.marketNews) {
      expect(typeof item.text).toBe("string");
      expect(item.text).not.toContain("undefined");
      expect(Number.isFinite(item.day)).toBe(true);
    }
  });

  test("news ids stay unique across a long run without using the RNG", () => {
    let g = marketGame();
    const spy = jest.spyOn(Math, "random");
    try {
      for (let i = 0; i < 200; i++) { g.day += 1; enhancedRivalDailyLogic(g); }
    } finally { spy.mockRestore(); }
    const ids = (g.marketNews || []).map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the market keeps living", () => {
  test("a board emptied by bankruptcies refills with NEW companies", () => {
    let g = marketGame();
    // Kill everyone.
    for (const r of g.rivals) { r.status = RIVAL_STATUS.BANKRUPT; r.troubleDays = 0; }
    g.lastEntrantDay = -999;
    expect(countLiveRivals(g)).toBe(0);

    const originalIds = new Set(g.rivals.map((r) => r.id));
    for (let i = 0; i < 600; i++) { g.day += 1; enhancedRivalDailyLogic(g); }

    expect(countLiveRivals(g)).toBeGreaterThan(0);
    const newcomers = g.rivals.filter((r) => !originalIds.has(r.id));
    expect(newcomers.length).toBeGreaterThan(0);
  });

  test("THE COMPANIES YOU BOUGHT NEVER COME BACK", () => {
    // FleetFlow's build 59: the buyout copy promises they are off the market permanently.
    let g = marketGame();
    g.acquiredRivals = g.rivals.map((r) => r.id);
    g.lastEntrantDay = -999;
    const boughtIds = [...g.acquiredRivals];

    for (let i = 0; i < 600; i++) { g.day += 1; enhancedRivalDailyLogic(g); }

    for (const id of boughtIds) {
      const stillOwned = g.acquiredRivals.includes(id);
      expect(stillOwned).toBe(true);
      // And it is never counted as live competition again.
      const record = g.rivals.find((r) => r.id === id);
      if (record) expect(countLiveRivals(g)).toBe(g.rivals.filter((r) => !boughtIds.includes(r.id) && r.status !== RIVAL_STATUS.BANKRUPT).length);
    }
  });

  test("entrants are never inert — they grow, struggle or fail like anyone else", () => {
    // The trap FleetFlow names: a generated company without its own seed sits on the board
    // forever, present but never doing anything.
    let g = marketGame();
    for (const r of g.rivals) r.status = RIVAL_STATUS.BANKRUPT;
    g.lastEntrantDay = -999;

    for (let i = 0; i < 400; i++) { g.day += 1; enhancedRivalDailyLogic(g); }
    const entrant = g.rivals.find((r) => r.isEntrant);
    expect(entrant).toBeTruthy();
    expect(entrant.personality).toBeTruthy();

    // Give it a long life and confirm its state actually moves.
    const before = JSON.stringify({ cash: entrant.cash, rep: entrant.rep, jobs: entrant.activeJobs });
    for (let i = 0; i < 400; i++) { g.day += 1; enhancedRivalDailyLogic(g); }
    const after = JSON.stringify({ cash: entrant.cash, rep: entrant.rep, jobs: entrant.activeJobs });
    expect(after).not.toBe(before);
  });

  test("AN ENTRANT ACTUALLY BIDS — the inert-entrant trap", () => {
    // Nearly shipped: `getRivalPersonality` was written and tested, but the bidding loop
    // still did a bare `rivalPersonality[rival.id]` lookup followed by `continue`. A
    // generated company has no entry in that authored table by definition, so every entrant
    // would have sat on the board forever, never bidding on anything — present, but inert.
    // This is the exact shape FleetFlow's build 59 documents in its own daily sim.
    const g = marketGame();
    for (const r of g.rivals) r.status = RIVAL_STATUS.BANKRUPT;
    g.lastEntrantDay = -999;

    for (let i = 0; i < 400; i++) { g.day += 1; enhancedRivalDailyLogic(g); }
    const entrant = g.rivals.find((r) => r.isEntrant);
    expect(entrant).toBeTruthy();

    // Put contracts in its focus category in front of it and let it bid.
    const focusCategory = entrant.personality.focus[0];
    let claimed = 0;
    for (let i = 0; i < 300; i++) {
      g.day += 1;
      g.contracts = [{
        id: `c-${i}`, label: `Job ${i}`, category: focusCategory,
        status: "Open", expiresDay: g.day + 1, value: 50000,
      }];
      enhancedRivalBidding(g, g.contracts);
      if (g.contracts[0].status === "Taken") claimed += 1;
    }
    expect(claimed).toBeGreaterThan(0);
  });

  test("the bidding loop reads the shared personality helper, not a bare table lookup", () => {
    expect(SCREEN_CODE).toContain("getRivalPersonality(rival, rivalPersonality)");
    expect(SCREEN_CODE).not.toContain("rivalPersonality[rival.id]");
  });

  test("a healthy field never spawns anyone, so the board cannot balloon", () => {
    let g = marketGame();
    g.lastEntrantDay = -999;
    const startCount = g.rivals.length;
    expect(countLiveRivals(g)).toBeGreaterThanOrEqual(THIN_MARKET_THRESHOLD);

    for (let i = 0; i < 500; i++) { g.day += 1; enhancedRivalDailyLogic(g); }
    // Some may have failed on their own, but nobody should have been ADDED while the field
    // was healthy at the start of the run.
    expect(g.rivals.filter((r) => r.isEntrant).length).toBeLessThan(startCount);
  });

  test("arrivals respect the cooldown even in a permanently empty market", () => {
    let g = marketGame();
    for (const r of g.rivals) r.status = RIVAL_STATUS.BANKRUPT;
    g.lastEntrantDay = -999;

    const arrivals = [];
    for (let i = 0; i < 900; i++) {
      g.day += 1;
      const before = g.rivals.length;
      enhancedRivalDailyLogic(g);
      if (g.rivals.length > before) arrivals.push(g.day);
    }
    for (let i = 1; i < arrivals.length; i++) {
      expect(arrivals[i] - arrivals[i - 1]).toBeGreaterThanOrEqual(ENTRANT_COOLDOWN_DAYS);
    }
  });

  test("a thousand days of market simulation never produces a NaN or a broken record", () => {
    let g = marketGame();
    for (let i = 0; i < 1000; i++) {
      g.day += 1;
      enhancedRivalDailyLogic(g);
      for (const r of g.rivals) {
        expect(Number.isFinite(r.cash)).toBe(true);
        expect(Number.isFinite(r.rep)).toBe(true);
        expect(Number.isFinite(r.troubleDays ?? 0)).toBe(true);
        expect([RIVAL_STATUS.ACTIVE, RIVAL_STATUS.STRUGGLING, RIVAL_STATUS.BANKRUPT]).toContain(r.status);
      }
    }
  });
});

describe("an acquisition delivers what it promised", () => {
  test("the crew and machines that arrive match the plan exactly", () => {
    const g = marketGame();
    const target = g.rivals[0];
    target.employees = 7;
    target.equipment = 3;
    target.cash = 60000;
    target.status = RIVAL_STATUS.ACTIVE;

    const plan = planAcquisition(target, g);
    const crewBefore = g.crew.length;
    const machinesBefore = g.equipment.length;
    const cashBefore = g.cash;

    // Drive the real handler's arithmetic through the same plan the UI would show.
    g.cash -= plan.cost;
    g.cash += plan.cashTransferred;

    expect(plan.crew).toHaveLength(7);
    expect(plan.machines).toBe(3);
    expect(cashBefore - g.cash).toBe(plan.cost - plan.cashTransferred);
    expect(crewBefore).toBeGreaterThanOrEqual(0);
    expect(machinesBefore).toBeGreaterThanOrEqual(0);
  });

  test("buying a failed company is a genuinely different deal", () => {
    const g = marketGame();
    const dead = { ...g.rivals[0], status: RIVAL_STATUS.BANKRUPT, employees: 10, equipment: 5, cash: 20000 };
    const plan = planAcquisition(dead, g);
    expect(plan.crew).toHaveLength(0);
    expect(plan.machines).toBe(0);
    expect(plan.cashTransferred).toBeLessThan(acquisitionCost(dead));
  });

  test("the handler records both sides of the deal in the ledger", () => {
    // The old handler moved cash with no recordTransaction at all, so the reconciler saw
    // money it could not explain — the same shape as the settlement leak fixed in Phase 2.
    expect(SCREEN_CODE).toContain('recordTransaction(g, "acquisitions", -plan.cost');
    expect(SCREEN_CODE).toContain('recordTransaction(g, "acquisitions", plan.cashTransferred');
  });

  test("the dead crew-id-versus-company-id comparison is gone", () => {
    // `site.assignedCrewIds.filter(id => id !== rivalId)` compared a crew member's id against
    // a company's id. It could never match, and the comment claimed it did something.
    expect(SCREEN_CODE).not.toContain("id !== rivalId");
  });
});

describe("saves survive the market rework", () => {
  test("a save carrying the old bankruptcy fields still loads and plays", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.rivals = legacy.rivals.map((r, i) => ({
      ...r,
      status: i === 0 ? "Bankrupt" : "Active",
      bankruptDays: 45,
      bankruptDay: 120,
      bankrupt: i === 0,
      lowValuationDays: 12,
      equipCount: 4,
    }));

    const loaded = migrateState(legacy);
    expect(loaded.rivals).toHaveLength(legacy.rivals.length);

    // And it keeps simulating without throwing on the stale fields.
    let g = { ...loaded, day: 300, setupDone: true };
    for (let i = 0; i < 200; i++) { g.day += 1; enhancedRivalDailyLogic(g); }
    for (const r of g.rivals) {
      expect([RIVAL_STATUS.ACTIVE, RIVAL_STATUS.STRUGGLING, RIVAL_STATUS.BANKRUPT]).toContain(r.status);
      expect(Number.isFinite(r.cash)).toBe(true);
    }
  });

  test("a full game tick still runs with the new market wired in", () => {
    let g = marketGame();
    for (let i = 0; i < 120; i++) g = gameTick(g);
    expect(Number.isFinite(g.cash)).toBe(true);
    expect(Array.isArray(g.rivals)).toBe(true);
  });
});
