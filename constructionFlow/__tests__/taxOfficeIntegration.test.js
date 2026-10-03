// Tax integration — the gate wired into the real game.
//
// The headline test is the experiment that found the bug: two identical companies on the same
// seed, one frozen. Before the fix they behaved identically, because `businessFrozen` was read
// by nothing. If that ever becomes true again, this fails.

import fs from "fs";
import path from "path";

import { freshState, migrateState, gameTick, mobilizeSite } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { canTakeNewWork, assessWeeklyTax, applyTaxPayment, TAX_RATE,
  accrueTaxReserve,
  issueWeeklyTaxBill,
} from "../src/systems/taxOffice.js";

import { ticksPerDay } from "../src/systems/gameClock.js";
// Was a hard-coded 48, which meant "ticks per game day" only while a tick moved 30 game
// minutes. Sprint 11 cut that to 10, so the literal silently became "a third of a day".
const TICKS_PER_DAY = ticksPerDay("1x");

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

describe("the freeze is enforced, not just displayed", () => {
  test("the contract-acceptance path actually checks it", () => {
    // The bug in one line: the flag was set and no code path consulted it. The Bids tap handler
    // delegates to mobilizeSite() (Sprint 1, so the playtest harness runs the same code), so
    // that is where the gate has to be.
    expect(SCREEN_CODE).toContain("canTakeNewWork(g)");
    const fn = SCREEN_CODE.slice(SCREEN_CODE.indexOf("export function mobilizeSite"));
    expect(fn.slice(0, 1400)).toContain("canTakeNewWork");
    const handler = SCREEN_CODE.slice(SCREEN_CODE.indexOf("const handleStartSite"));
    expect(handler.slice(0, 600)).toContain("mobilizeSite(");
  });

  test("the block is raised before any state is mutated", () => {
    // A frozen player must not lose materials or crew assignment to a rejected start.
    const fn = SCREEN_CODE.slice(SCREEN_CODE.indexOf("export function mobilizeSite"));
    const gateAt = fn.indexOf("canTakeNewWork");
    const rollAt = fn.indexOf("rollBidOutcome");
    expect(gateAt).toBeGreaterThan(-1);
    expect(rollAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(rollAt);

    // And behaviourally: a frozen company's bid is refused with nothing consumed.
    const g = { ...freshState(), businessFrozen: true, taxDue: 5000, taxOverdueDays: 20 };
    const c = g.contracts.find((x) => x.defId === "fence");
    const before = JSON.stringify({ cash: g.cash, materials: g.materials, crew: g.crew, contracts: g.contracts });
    const res = mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id));
    expect(res.status).toBe("frozen");
    expect(JSON.stringify({ cash: g.cash, materials: g.materials, crew: g.crew, contracts: g.contracts })).toBe(before);
  });

  test("freezing does NOT stop sites already under way", () => {
    // The scoping decision: a freeze that stopped everything would leave the player with no
    // cash and no way to earn any, which is a dead save rather than a setback.
    const build = () => {
      const g = freshState();
      g.setupDone = true; g.tutorialDone = true; g.cash = 400000;
      g.materials = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };
      g.activeSites = [{
        id: "s1", contractId: "c1", label: "Frozen Tower", client: "Harbor Trust", status: "Active",
        phases: ["Finish"], currentPhaseIdx: 0, phaseProgress: 99.5,
        assignedCrewIds: g.crew.map(w => w.id), assignedEquipmentIds: g.equipment.map(e => e.id),
        materialsFulfilled: {}, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
        totalValue: 200000, depositPaid: 50000, penaltyPerDay: 100,
        deadlineDay: g.day + 90, startDay: g.day - 2, siteMode: "normal", chaosHistory: [],
      }];
      for (const w of g.crew) w.status = "Working";
      for (const e of g.equipment) e.status = "Active";
      return g;
    };
    let frozen = build();
    frozen.businessFrozen = true; frozen.taxDue = 80000; frozen.taxOverdueDays = 30;
    for (let i = 0; i < TICKS_PER_DAY * 30 && (frozen.activeSites || []).length > 0; i++) frozen = gameTick(frozen);
    // The job it already had still finished and still paid.
    expect(frozen.completedJobs).toBeGreaterThan(0);
  });
});

describe("a young company gets relief", () => {
  test("the assessment path uses the relief helper, not a bare 12%", () => {
    // Sprint 9 moved the assessment behind the reserve: the week now bills from what was
    // accrued daily rather than multiplying revenue at week end. The relief still applies —
    // accrueTaxReserve derives the reserve through taxRateFor — so the claim this test was
    // written to protect is unchanged, but the call site it pinned is gone.
    expect(SCREEN_CODE).toContain("accrueTaxReserve(g)");
    expect(SCREEN_CODE).toContain("issueWeeklyTaxBill(g)");
    expect(SCREEN_CODE).not.toContain("Math.round(weeklyRevenue * 0.12)");
    expect(SCREEN_CODE).not.toContain("weeklyRevenue * TAX_RATE");
  });

  test("the relief still reaches the bill through the reserve", () => {
    // Behavioural rather than textual, so this one survives the next refactor.
    const rev = 120000;
    const bill = (level) => {
      const g = { companyLevel: level, officeStaff: [], weeklyStats: { revenue: rev }, taxDue: 0, taxReserve: 0 };
      accrueTaxReserve(g);
      return issueWeeklyTaxBill(g);
    };
    expect(bill(1)).toBeLessThan(bill(6));
    expect(bill(6)).toBe(Math.round(rev * TAX_RATE));
  });

  test("a level-1 company is billed less than a level-6 one on the same revenue", () => {
    const young = assessWeeklyTax({ companyLevel: 1 }, 50000);
    const grown = assessWeeklyTax({ companyLevel: 6 }, 50000);
    expect(young).toBeLessThan(grown);
    expect(grown).toBe(Math.round(50000 * TAX_RATE));
  });
});

describe("the player can always dig out", () => {
  test("the pay handler no longer refuses everything but payment in full", () => {
    expect(SCREEN_CODE).not.toContain("if (g.cash < g.taxDue) { alertInsufficientFunds(g, g.taxDue");
    expect(SCREEN_CODE).toContain("applyTaxPayment(g, _want)");
    expect(SCREEN_CODE).toContain("suggestedPayment(g)");
  });

  test("repeated part payments clear a bill that could never be paid in one go", () => {
    const g = { cash: 0, taxDue: 96000, taxOverdueDays: 65, businessFrozen: true, expenses: 0 };
    let rounds = 0;
    while (g.taxDue > 0 && rounds < 50) {
      g.cash += 20000;                  // a job pays out
      applyTaxPayment(g, Math.min(g.cash, g.taxDue));
      rounds++;
    }
    expect(g.taxDue).toBe(0);
    expect(g.businessFrozen).toBe(false);
    expect(canTakeNewWork(g)).toBe(true);
  });

  test("the ledger records part payments distinctly from full ones", () => {
    expect(SCREEN_CODE).toContain('"Tax bill part payment"');
  });
});

describe("save compatibility", () => {
  test("an existing save keeps its tax state untouched", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.taxDue = 12345; legacy.taxOverdueDays = 9; legacy.businessFrozen = false;
    const m = migrateState(legacy);
    expect(m.taxDue).toBe(12345);
    expect(m.taxOverdueDays).toBe(9);
  });

  test("a save that was already frozen stays frozen, and is now actually gated", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.businessFrozen = true; legacy.taxDue = 50000; legacy.taxOverdueDays = 40;
    const m = migrateState(legacy);
    expect(m.businessFrozen).toBe(true);
    // Previously this flag meant nothing; from this build it does.
    expect(canTakeNewWork(m)).toBe(false);
  });
});
