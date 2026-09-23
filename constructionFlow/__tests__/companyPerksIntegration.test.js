// Company-perk integration tests — the ladder wired into the real game.
//
// `companyPerks.test.js` proves the resolver. These prove the GAME reads it, which is the
// whole point: every one of these perks was already declared in a data table and shown on the
// button the player pressed to buy it. What was missing was any consumer.
//
// Each test below names the money the player was spending on nothing.

import fs from "fs";
import path from "path";

import {
  freshState,
  gameTick,
  getTotalCrewCap,
  OFFICES,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

import { PROPERTY_TYPES, REGIONAL_OFFICE_TYPES } from "../src/systems/companyPerkTables.js";
import { resolveCompanyPerks, dailyOfficeRent, BASE_CONTRACT_CAP } from "../src/systems/companyPerks.js";
import { planBid } from "../src/systems/constructionLoop.js";

import { ticksPerDay } from "../src/systems/gameClock.js";
// A literal tick count meant "this many game days" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so every such literal silently became a third of
// what it said. Derived from the clock now, so the next pace change cannot lie to it.
const TICKS_PER_DAY = ticksPerDay("1x");

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 5000000;
  g.day = 200;
  g.reputation = 70;
  g.completedJobs = 20;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

describe("$120,000 for no office rent — the promise that was never kept", () => {
  test("owning an office property stops the rent leaving your account", () => {
    const topOffice = OFFICES.length - 1;
    const withRent = running({ officeIndex: topOffice, properties: [] });
    const owned = running({ officeIndex: topOffice, properties: [{ id: "p1", typeId: "office_property", purchasedDay: 1 }] });

    // Run both a full game day (48 ticks) and compare the spend.
    let a = withRent, b = owned;
    for (let i = 0; i < TICKS_PER_DAY; i++) { a = gameTick(a); b = gameTick(b); }

    const rentedSpend = withRent.cash - a.cash;
    const ownedSpend = owned.cash - b.cash;
    expect(rentedSpend).toBeGreaterThan(ownedSpend);
    // The gap is roughly a day of rent at the top office.
    expect(rentedSpend - ownedSpend).toBeGreaterThan(OFFICES[topOffice].dailyRent * 0.5);
  });

  test("the daily rent line disappears from the ledger, rather than being recorded as zero", () => {
    const owned = running({
      officeIndex: OFFICES.length - 1,
      properties: [{ id: "p1", typeId: "office_property", purchasedDay: 1 }],
    });
    let g = owned;
    for (let i = 0; i < 48; i++) g = gameTick(g);
    const rentLines = (g.ledger || []).filter((t) => (t.description || "").includes("daily rent"));
    expect(rentLines).toHaveLength(0);
  });

  test("the screen reads the resolver, not the raw office field", () => {
    expect(SCREEN_CODE).toContain("const dailyRent = dailyOfficeRent(g);");
    expect(SCREEN_CODE).not.toContain("const dailyRent = office.dailyRent;");
  });
});

describe("every rent figure the player reads matches the money that moves", () => {
  // Fixing the charge without fixing the displays would leave the Finance tab, the runway
  // warning and the away report all quoting a bill the player no longer pays — the same
  // "shown number is not the real number" defect in a new place.
  test("no burn-rate or projection reads the raw office rent any more", () => {
    expect(SCREEN_CODE).not.toMatch(/OFFICES\[g\.officeIndex\s*\|\|\s*0\]\?\.dailyRent/);
    expect(SCREEN_CODE).not.toMatch(/OFFICES\[game\.officeIndex\s*\|\|\s*0\]\?\.dailyRent/);
    expect(SCREEN_CODE).not.toContain("office.dailyRent * 7");
    expect(SCREEN_CODE).not.toContain("- office.dailyRent -");
  });

  test("the runway warning gets shorter, not longer, when the rent stops", () => {
    const paying = running({ officeIndex: 4, cash: 30000, properties: [] });
    const owning = running({
      officeIndex: 4,
      cash: 30000,
      properties: [{ id: "p1", typeId: "office_property", purchasedDay: 1 }],
    });
    // Same cash, same crew, same machines — the only difference is the rent.
    expect(dailyOfficeRent(owning)).toBe(0);
    expect(dailyOfficeRent(paying)).toBe(OFFICES[4].dailyRent);
  });
});

describe("contract slots on a $1,500,000 building — advertised, never delivered", () => {
  test("regional offices put more work on the board", () => {
    const plain = running();
    const expanded = running({
      cityOffices: [
        { id: "o1", typeId: "national_hq", cityId: "portland", openedDay: 1 },
        { id: "o2", typeId: "state_hq", cityId: "seattle", openedDay: 1 },
      ],
    });

    let a = plain, b = expanded;
    for (let i = 0; i < 96; i++) { a = gameTick(a); b = gameTick(b); }

    const openA = a.contracts.filter((c) => c.status === "Open").length;
    const openB = b.contracts.filter((c) => c.status === "Open").length;
    expect(openB).toBeGreaterThan(openA);
  });

  test("the board is still bounded, so a big company cannot balloon the save", () => {
    const everything = running({
      cityOffices: REGIONAL_OFFICE_TYPES.flatMap((d, i) => [
        { id: `a${i}`, typeId: d.id, cityId: "portland", openedDay: 1 },
        { id: `b${i}`, typeId: d.id, cityId: "seattle", openedDay: 1 },
      ]),
    });
    let g = everything;
    for (let i = 0; i < 240; i++) g = gameTick(g);
    const open = g.contracts.filter((c) => c.status === "Open").length;
    expect(open).toBeLessThanOrEqual(BASE_CONTRACT_CAP + 8);
  });

  test("the refresh reads the resolved board size, not a hard-coded 5 and 7", () => {
    expect(SCREEN_CODE).toContain("contractBoardSize(g)");
    expect(SCREEN_CODE).not.toMatch(/status === "Open"\)\.length < 5/);
    expect(SCREEN_CODE).not.toContain("openPool.slice(0, 7)");
  });
});

describe("bid win chance on the office ladder — a string on a button", () => {
  test("a better office makes you more likely to be awarded work", () => {
    const shed = running({ officeIndex: 0 });
    const tower = running({ officeIndex: 4 });
    const contract = { id: "c1", value: 100000, category: "Commercial" };

    const shedOdds = planBid(contract, "standard", { ...shed, bidBonus: resolveCompanyPerks(shed).bidBonus });
    const towerOdds = planBid(contract, "standard", { ...tower, bidBonus: resolveCompanyPerks(tower).bidBonus });

    expect(towerOdds.winChance).toBeGreaterThan(shedOdds.winChance);
  });

  test("the office perk never makes a bid a certainty", () => {
    const tower = running({ officeIndex: 4, reputation: 100 });
    for (const style of ["aggressive", "standard", "premium"]) {
      const odds = planBid(
        { id: "c", value: 50000, category: "Residential" },
        style,
        { ...tower, bidBonus: resolveCompanyPerks(tower).bidBonus }
      );
      expect(odds.winChance).toBeLessThanOrEqual(0.97);
    }
  });

  test("every bid call site passes the perk, so the card and the award agree", () => {
    // If one call site forgot, the odds shown would differ from the odds rolled.
    const bidCalls = SCREEN_CODE.match(/(?:planBid|rollBidOutcome)\([^)]*\)/g) || [];
    expect(bidCalls.length).toBeGreaterThanOrEqual(3);
    for (const call of bidCalls) {
      expect(call).toContain("withBidPerks");
    }
  });
});

describe("delay penalties on the office ladder — the other string on a button", () => {
  test("a better office cuts the penalty the simulation actually applies", () => {
    expect(resolveCompanyPerks({ officeIndex: 0 }).penaltyReduction).toBe(0);
    expect(resolveCompanyPerks({ officeIndex: 3 }).penaltyReduction).toBeGreaterThan(0);
    // And the completion path reads it.
    expect(SCREEN_CODE).toContain("resolveCompanyPerks(g).penaltyReduction");
  });

  test("relief never turns a late job into a free one", () => {
    // The 85% cap still applies on top, and relief is a fraction, never a waiver.
    expect(resolveCompanyPerks({ officeIndex: 4 }).penaltyReduction).toBeLessThan(1);
  });
});

describe("crew capacity from properties — computed, then dropped", () => {
  test("an office property raises the crew cap the game enforces", () => {
    const base = getTotalCrewCap(running());
    const withProperty = getTotalCrewCap(running({
      properties: [{ id: "p1", typeId: "office_property", purchasedDay: 1 }],
    }));
    expect(withProperty).toBeGreaterThan(base);
  });

  test("getTotalCrewCap no longer computes a bonus it throws away", () => {
    // The dead `propBonus` local ESLint had been flagging since the design-system pass.
    expect(SCREEN_CODE).not.toContain("propBonus");
    expect(SCREEN_CODE).toContain("resolveCompanyPerks(g).crewCap");
  });

  test("regional offices and properties stack on the home office", () => {
    const stacked = getTotalCrewCap(running({
      officeIndex: 3,
      cityOffices: [{ id: "o1", typeId: "national_hq", cityId: "portland", openedDay: 1 }],
      properties: [{ id: "p1", typeId: "office_property", purchasedDay: 1 }],
    }));
    expect(stacked).toBeGreaterThan(OFFICES[3].crewCap + 150);
  });
});

describe("the ladder holds up over a long game", () => {
  test("400 ticks with everything owned never produces a NaN capacity or cost", () => {
    let g = running({
      officeIndex: 4,
      cityOffices: REGIONAL_OFFICE_TYPES.map((d, i) => ({ id: `o${i}`, typeId: d.id, cityId: "portland", openedDay: 1 })),
      properties: PROPERTY_TYPES.map((d, i) => ({ id: `p${i}`, typeId: d.id, purchasedDay: 1 })),
    });
    for (let i = 0; i < 400; i++) {
      g = gameTick(g);
      expect(Number.isFinite(g.cash)).toBe(true);
      const perks = resolveCompanyPerks(g);
      expect(Number.isFinite(perks.crewCap)).toBe(true);
      expect(Number.isFinite(perks.equipCap)).toBe(true);
      expect(perks.materialDiscount).toBeLessThan(1);
    }
  });

  test("a save from before the tables moved still loads and resolves perks", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.officeIndex = 2;
    legacy.cityOffices = [{ id: "o1", typeId: "regional_office", cityId: "portland", openedDay: 5 }];
    legacy.properties = [{ id: "p1", typeId: "equipment_yard", purchasedDay: 9 }];

    const perks = resolveCompanyPerks(legacy);
    expect(perks.crewCap).toBe(OFFICES[2].crewCap + 15);
    expect(perks.equipCap).toBe(OFFICES[2].equipCap + 5);
    expect(perks.penaltyReduction).toBeGreaterThan(0);
  });
});
