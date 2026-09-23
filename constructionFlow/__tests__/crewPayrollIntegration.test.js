// Payroll and the crew screen, wired into the real game.
//
// This sprint is mostly UI, which is the hardest thing in this codebase to prove. The module
// tests next door cover the maths; these cover the two failure modes that actually bite:
// a handler that exists but is never passed to the component that needs it, and a consequence
// that is computed but never applied.

import fs from "fs";
import path from "path";

import { freshState, migrateState, gameTick, getTotalCrewCap } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { ticksPerDay } from "../src/systems/gameClock.js";
import { marketRateFor, payPosition, quitRisk, payrollSummary } from "../src/systems/crewPayroll.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const TICKS_PER_DAY = ticksPerDay("1x");
const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function running(over = {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.cash = 900000;
  g.materials = { ...STOCKED };
  return { ...g, ...over };
}

describe("the handlers exist AND reach the screen that needs them", () => {
  // The defect this project produces most often: something written, unit-tested, and never
  // connected. A handler defined but not passed as a prop is invisible in exactly that way.
  test.each(["handleSetWage", "handleBulkHire", "handleFireMany"])("%s is defined", (name) => {
    expect(CODE).toContain(`const ${name} = useCallback`);
  });

  test.each([
    ["onSetWage", "handleSetWage"],
    ["onBulkHire", "handleBulkHire"],
    ["onFireMany", "handleFireMany"],
  ])("%s is passed to CrewScreen", (prop, handler) => {
    expect(CODE).toContain(`${prop}={${handler}}`);
  });

  test("CrewScreen accepts them in its signature", () => {
    const sig = CODE.slice(CODE.indexOf("function CrewScreen("), CODE.indexOf("function CrewScreen(") + 700);
    for (const prop of ["onSetWage", "onBulkHire", "onFireMany"]) {
      expect({ prop, inSignature: sig.includes(prop) }).toEqual({ prop, inSignature: true });
    }
  });

  test("and calls each of them", () => {
    for (const call of ["onSetWage && onSetWage(", "onBulkHire && onBulkHire(", "onFireMany && onFireMany("]) {
      expect(CODE).toContain(call);
    }
  });
});

describe("setting an exact wage is reachable", () => {
  test("there is a number field, not just the two nudges", () => {
    expect(CODE).toContain("Set Pay");
    expect(CODE).toContain("wageDrafts");
  });

  test("the old ±10% buttons are still there for a quick nudge", () => {
    // Adding the number should not take away the fast path.
    expect(CODE).toContain("Raise Wage");
    expect(CODE).toContain("Lower Wage");
  });

  test("the change is previewed before it is committed", () => {
    expect(CODE).toContain("previewWage(w, draft)");
  });
});

describe("the scrolling fix", () => {
  test("cards collapse by default and open one at a time", () => {
    expect(CODE).toContain("const [expandedCrewId, setExpandedCrewId] = useState(null)");
    expect(CODE).toContain("expandedCrewId === w.id");
  });

  test("the collapsed line still answers the two questions that matter", () => {
    // What are they costing me, and are they about to walk.
    expect(CODE).toContain("market {money(marketRateFor(w))}");
    expect(CODE).toContain("unhappy ${Math.round(w.underpaidDays)}d");
  });
});

describe("bulk actions", () => {
  test("a count field and a hire button", () => {
    expect(CODE).toContain("bulkHireCount");
    expect(CODE).toContain("Hire {bulkHireCount");
  });

  test("select-all and dismiss-selected", () => {
    expect(CODE).toContain("Select all");
    expect(CODE).toContain("selectedCrewIds");
  });

  test("a mass dismissal asks first and states the cost", () => {
    // Firing the whole crew is not something to do on a mis-tap.
    expect(CODE).toContain("in severance, saving");
    expect(CODE).toContain('style: "destructive"');
  });

  test("dismissed crew are removed from the sites they were on", () => {
    // Otherwise the site keeps a ghost in assignedCrewIds and its progress maths counts a
    // person who no longer exists.
    const idx = CODE.indexOf("const handleFireMany");
    const body = CODE.slice(idx, idx + 1400);
    expect(body).toContain("site.assignedCrewIds = (site.assignedCrewIds || []).filter");
  });

  test("severance actually leaves the account, through the ledger", () => {
    const idx = CODE.indexOf("const handleFireMany");
    const body = CODE.slice(idx, idx + 1400);
    expect(body).toContain('recordTransaction(g, "payroll", -_plan.severance');
  });
});

describe("underpayment has consequences in the real loop", () => {
  test("the daily rollover accrues it", () => {
    expect(CODE).toContain("accrueUnderpayment(_w)");
    expect(CODE).toContain("quitRisk(_w)");
  });

  test("a company paying market rates never puts anyone at risk over pay", () => {
    // Asserted on the pay mechanism specifically, not on headcount. Crew can also leave
    // through the employee events, burnout and poaching, none of which this sprint touched —
    // an earlier version of this test watched the head count and was measuring those instead.
    let g = running({ day: 1, gameMinutes: 0 });
    for (const w of g.crew) w.wagePerDay = Math.round(marketRateFor(w) * 1.1);
    for (let i = 0; i < TICKS_PER_DAY * 120; i++) {
      g = gameTick(g);
      const atRisk = (g.crew || []).filter((w) => quitRisk(w) > 0);
      expect(atRisk.map((w) => w.name)).toEqual([]);
    }
  });

  test("a company paying the floor eventually loses people", () => {
    // The exploit that used to be optimal: cut everyone's pay, eat one loyalty hit, bank the
    // savings forever. Nothing tracked it the next day.
    let g = running({ day: 1, gameMinutes: 0 });
    for (const w of g.crew) { w.wagePerDay = 90; w.loyalty = 20; }
    const before = g.crew.length;
    let lost = false;
    for (let i = 0; i < TICKS_PER_DAY * 300 && !lost; i++) {
      g = gameTick(g);
      if ((g.crew || []).length < before) lost = true;
    }
    expect(lost).toBe(true);
  });

  test("the underpaid counter survives a save round trip", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.crew = legacy.crew.map((w) => ({ ...w, underpaidDays: 9 }));
    expect(migrateState(legacy).crew[0].underpaidDays).toBe(9);
  });

  test("a build-7 save with no underpaidDays field does not produce NaN", () => {
    const legacy = JSON.parse(JSON.stringify(freshState()));
    legacy.crew = legacy.crew.map((w) => { const c = { ...w }; delete c.underpaidDays; return c; });
    let g = { ...migrateState(legacy), setupDone: true, tutorialDone: true, materials: { ...STOCKED } };
    for (let i = 0; i < TICKS_PER_DAY * 3; i++) g = gameTick(g);
    for (const w of g.crew) expect(Number.isFinite(w.underpaidDays)).toBe(true);
  });
});

describe("the payroll summary reads the real company", () => {
  test("it counts the crew the game actually has", () => {
    const g = running();
    expect(payrollSummary(g).headcount).toBe((g.crew || []).length + (g.officeStaff || []).length);
  });

  test("a starting company is not already underpaying everyone", () => {
    // If the default wages were below the market table this sprint introduced, every new
    // player would start with a crew quietly counting down to quitting.
    const g = freshState();
    const bad = (g.crew || []).filter((w) => payPosition(w).key === "insulting");
    expect(bad.map((w) => w.name)).toEqual([]);
  });

  test("nobody on a fresh save is at quit risk", () => {
    const g = freshState();
    expect((g.crew || []).filter((w) => quitRisk(w) > 0)).toHaveLength(0);
  });

  test("the crew cap is respected by bulk hiring", () => {
    const g = running();
    expect(getTotalCrewCap(g)).toBeGreaterThan(0);
    expect(CODE).toContain("crewCap: getTotalCrewCap(g)");
  });
});
