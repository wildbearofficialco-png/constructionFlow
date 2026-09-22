// Every dollar that leaves the player's account is filed as what it actually was.
//
// WHAT THIS FOUND
// ---------------
// Chasing a 1-in-25 flake in the ledger-labels test turned up something bigger than the flake.
// SIX shared system modules moved the player's cash and wrote no ledger entry at all:
//
//   randomEvents.js          9 cash movements, 0 ledger entries
//   inventorySystem.js       1
//   staffPerformance.js      1
//   employeePersonalities.js 1
//   territorySystem.js       1
//
// The ledger's reconciler caught the money — that is what it is for — but it could only file it
// as "Financing or balance transfer", because by the time it runs, all it can see is that cash
// moved and no category claimed it. So a failed health inspection, a theft, an emergency
// repair and a training programme all appeared in Finance as a balance transfer.
//
// That is the same defect this whole effort keeps finding in new places: the number the player
// reads is not the thing that happened. Phase 5 found it in the office ladder's perks, Phase 6
// found it here.
//
// These tests are the guard. The source scan is deliberately mechanical: any NEW unrecorded
// `game.cash` movement in a shared module fails this suite, whoever adds it.

import fs from "fs";
import path from "path";

import { freshState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from "../src/systems/financialLedger.js";

const SYSTEMS_DIR = path.join(__dirname, "..", "src", "systems");

// Modules that move the PLAYER's cash. aiCompetitors.js is excluded on purpose: it moves
// `competitor.cash`, which is a rival's balance sheet and correctly absent from the player's
// ledger.
const PLAYER_CASH_MODULES = [
  "randomEvents.js",
  "inventorySystem.js",
  "staffPerformance.js",
  "employeePersonalities.js",
  "territorySystem.js",
  "equipmentWear.js",
];

function sourceOf(file) {
  return fs.readFileSync(path.join(SYSTEMS_DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");
}

describe("no shared module moves the player's money silently", () => {
  test.each(PLAYER_CASH_MODULES)("%s records every cash movement it makes", (file) => {
    const code = sourceOf(file);
    const lines = code.split("\n");
    const unrecorded = [];

    lines.forEach((line, i) => {
      if (!/^\s*game\.cash\s*(\+|-)=/.test(line)) return;
      // The ledger entry has to follow the movement closely enough that the two cannot drift
      // apart unnoticed, but not so closely that a module which updates `expenses` and
      // `weeklyStats` in between fails for good style. equipmentWear.js does exactly that and
      // has always been correct; the modules this suite was written for had NO record anywhere
      // in the file, which this window catches unambiguously.
      const window = lines.slice(i + 1, i + 20).join("\n");
      if (!window.includes("recordTransaction(game")) {
        unrecorded.push(`${file}:${i + 1}  ${line.trim()}`);
      }
    });

    expect(unrecorded).toEqual([]);
  });

  test("aiCompetitors moves only rival money, never the player's", () => {
    const code = sourceOf("aiCompetitors.js");
    expect(code).not.toMatch(/^\s*game\.cash\s*(\+|-)=/m);
  });
});

describe("every category written is one Finance can label", () => {
  test.each(PLAYER_CASH_MODULES)("%s uses only known categories", (file) => {
    const code = sourceOf(file);
    const calls = code.match(/recordTransaction\(game,\s*"([a-z]+)"/g) || [];
    for (const call of calls) {
      const category = call.match(/"([a-z]+)"/)[1];
      const known = category in EXPENSE_CATEGORIES || category in REVENUE_CATEGORIES;
      expect({ file, category, known }).toEqual({ file, category, known: true });
    }
  });

  test("no cost is filed under a placeholder description", () => {
    // "Random event cost" told the player nothing; each one now names what happened.
    for (const file of PLAYER_CASH_MODULES) {
      expect(sourceOf(file)).not.toContain("Random event cost");
    }
  });
});

describe("the reconciler goes quiet now that the flows are instrumented", () => {
  // The flake this work started from: reconciliation entries could reach ~32% of ledger volume
  // in a short run, because unrecorded expenses landed in the financing catch-all.
  function run(days, seed) {
    const real = Math.random;
    let s = seed >>> 0;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    let g = freshState();
    for (let i = 0; i < days * 48; i++) g = gameTick(g);
    Math.random = real;
    return g;
  }

  test.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i keeps uncategorised cash marginal", (seed) => {
    const g = run(30, seed);
    const total = g.ledger.reduce((s, e) => s + Math.abs(e.amount), 0);
    expect(total).toBeGreaterThan(0);

    // "misc" reconciliation entries are the real filing failure — money the ledger could not
    // explain as revenue or expense. This bound is far TIGHTER than the 25% the original test
    // allowed for all three reconciliation kinds combined.
    const miscReconciled = g.ledger
      .filter((e) => e.meta?.source === "reconciliation" && e.category === "misc")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    expect(miscReconciled / total).toBeLessThan(0.05);
  });

  test("a long run stays instrumented rather than drifting into the catch-all", () => {
    const g = run(120, 42);
    const total = g.ledger.reduce((s, e) => s + Math.abs(e.amount), 0);
    const reconciled = g.ledger
      .filter((e) => e.meta?.source === "reconciliation")
      .reduce((s, e) => s + Math.abs(e.amount), 0);
    expect(reconciled / total).toBeLessThan(0.25);
  });

  test("every ledger entry still carries a displayable label", () => {
    const g = run(60, 7);
    for (const entry of g.ledger) {
      const table = entry.amount < 0 ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;
      expect(table[entry.category]).toBeDefined();
    }
  });
});
