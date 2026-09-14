// First-minute contract tests.
//
// The WildBear standard says a fresh player must be able to answer five questions within
// 60 seconds: who am I, what company do I own, how do I make money, what do I need to
// start, and where do I tap next. These tests pin the state-level half of that contract —
// the parts that a refactor could silently break.

import {
  freshState,
  migrateState,
  getNextBestAction,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

describe("company identity", () => {
  test("a new company has both an owner and a company name", () => {
    const g = freshState();
    expect(typeof g.ownerName).toBe("string");
    expect(g.ownerName.length).toBeGreaterThan(0);
    expect(typeof g.companyName).toBe("string");
    expect(g.companyName.length).toBeGreaterThan(0);
  });

  test("owner name survives a save/load round trip", () => {
    const g = freshState();
    g.ownerName = "Sam Delgado";
    const reloaded = migrateState(JSON.parse(JSON.stringify(g)));
    expect(reloaded.ownerName).toBe("Sam Delgado");
  });

  test("a save made before the owner was asked for keeps playing with a neutral default", () => {
    const g = freshState();
    delete g.ownerName;
    const migrated = migrateState(g);
    expect(migrated.ownerName).toBe("Owner");
  });

  test("a blank or whitespace owner name is replaced rather than rendered empty", () => {
    for (const bad of ["", "   ", null, 42]) {
      const g = freshState();
      g.ownerName = bad;
      expect(migrateState(g).ownerName).toBe("Owner");
    }
  });
});

describe("the first project is reachable", () => {
  test("a new player starts with the crew, machine and stock the first contract needs", () => {
    const g = freshState();
    expect(g.crew.length).toBeGreaterThan(0);
    expect(g.equipment.length).toBeGreaterThan(0);
    expect(g.cash).toBeGreaterThan(0);
    // The tutorial points at the Fence job specifically because the starting lumber covers
    // it. If that stock ever drops below the requirement the guided path dead-ends.
    expect(g.materials.lumber).toBeGreaterThanOrEqual(20);
  });

  test("the first contract slot is the tutorial's fence job", () => {
    const g = freshState();
    expect(g.contracts.length).toBeGreaterThan(0);
    expect(g.contracts[0].label.toLowerCase()).toContain("fence");
  });

  test("the tutorial has not been marked done for a new player", () => {
    expect(freshState().tutorialDone).toBe(false);
  });
});

describe("where do I tap next", () => {
  test("next best action always names a tab and gives a reason", () => {
    const g = migrateState(freshState());
    const nba = getNextBestAction(g);
    expect(typeof nba.tab).toBe("string");
    expect(nba.tab.length).toBeGreaterThan(0);
    expect(typeof nba.title).toBe("string");
    expect(typeof nba.body).toBe("string");
    expect(nba.body.length).toBeGreaterThan(0);
  });

  test("a company with no sites and no crew is still told what to do, not left silent", () => {
    const g = migrateState(freshState());
    g.activeSites = [];
    g.crew = [];
    const nba = getNextBestAction(g);
    expect(nba.title).toBeTruthy();
    expect(nba.body).toBeTruthy();
  });

  test("a broke company is pointed somewhere rather than dead-ending", () => {
    const g = migrateState(freshState());
    g.cash = -5000;
    g.activeSites = [];
    const nba = getNextBestAction(g);
    expect(nba.tab).toBeTruthy();
    expect(nba.body.length).toBeGreaterThan(0);
  });
});
