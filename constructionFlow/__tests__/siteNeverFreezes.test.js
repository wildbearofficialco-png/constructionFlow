// The freeze.
//
// Reported from a device, and it was the worst defect this project has produced:
//
//   "Employees run out of stamina too fast. I accept a job and before it's finished I run out
//    of money. The jobs don't get done fast enough. Players will hate this."
//
// Measured, and the report was an understatement. A SIX-DAY starter contract, fully crewed,
// fully supplied, took MORE THAN 120 DAYS — and in six runs out of six it never finished at
// all. Every run lost money. The screenshot that came with the report showed the cause without
// naming it: a site sitting at 48%, and the header reading $NaN.
//
// THE MECHANISM. A starting company owns one pickup: 60 litres, burning 12 a day. On day five
// it ran dry and was pulled off the site:
//
//     e.status = "Idle";
//     site.assignedEquipmentIds = filter(out e.id);
//     addLog(`... pulled from ${site.label}. Refuel overnight.`);
//
// It refuelled in the yard. Nothing ever put it back. And above the progress maths sat:
//
//     if (!assignedCrew.length || !assignedEquip.length) continue;
//
// So the contract froze at whatever percentage it had reached, permanently, while crew wages,
// plant costs and office rent went out every single day. The log line promised "Refuel
// overnight" — a return that never came.
//
// Crew exhaustion was the identical bug in different clothes: pulled off at stamina < 10,
// recovered in the yard, never reassigned. Once the crew had cycled through, the site had
// nobody on it and could never finish.
//
// These tests exist so that neither can ever come back.

import { freshState, gameTick } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { ticksPerDay } from "../src/systems/gameClock.js";
import { payPosition, quitRisk } from "../src/systems/crewPayroll.js";

const TPD = ticksPerDay("1x");
const STOCKED = { concrete: 9999, lumber: 9999, steel: 9999, electrical: 9999, plumbing: 9999, asphalt: 9999 };

function starterJob(over = {}) {
  const g = { ...freshState(), setupDone: true, tutorialDone: true, materials: { ...STOCKED }, ...over };
  const c = (g.contracts || [])[0];
  const need = c?.materials || {};
  const fulfilled = {};
  for (const k of Object.keys(need)) fulfilled[k] = need[k] * 10;
  g.activeSites = [{
    id: "s1", contractId: c.id, label: c.label, client: c.client, status: "Active",
    phases: [...c.phases], currentPhaseIdx: 0, phaseProgress: 0,
    assignedCrewIds: g.crew.map((w) => w.id), assignedEquipmentIds: g.equipment.map((e) => e.id),
    materialsFulfilled: fulfilled, pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
    totalValue: c.value, depositPaid: Math.round(c.value * 0.2), penaltyPerDay: 100,
    deadlineDay: g.day + c.durationDays, startDay: g.day, siteMode: "normal", chaosHistory: [],
  }];
  for (const w of g.crew) w.status = "Working";
  for (const e of g.equipment) e.status = "Active";
  return { g, contract: c };
}

function runJob(seedState, maxDays = 100) {
  let g = seedState;
  let done = null;
  const startDay = g.day;
  for (let i = 0; i < TPD * maxDays && done === null; i++) {
    g = gameTick(g);
    if (g.pendingDecision) g = { ...g, pendingDecision: null };
    if ((g.activeSites || []).length === 0) done = g.day - startDay;
  }
  return { g, days: done };
}

describe("a machine that runs dry comes back", () => {
  test("it remembers the site it was pulled from", () => {
    const { g } = starterJob();
    let s = g;
    let sawPulled = false;
    for (let i = 0; i < TPD * 20 && !sawPulled; i++) {
      s = gameTick(s);
      if ((s.equipment || []).some((e) => e.awaitingFuelForSiteId)) sawPulled = true;
    }
    // Either it never ran dry in twenty days, or when it did it recorded where to go back to.
    // What must NOT happen is being dropped with no memory of the job.
    if (sawPulled) {
      expect((s.equipment || []).some((e) => e.awaitingFuelForSiteId === "s1")).toBe(true);
    }
  });

  test("the site does not end a long run with zero plant on it", () => {
    // The exact end state of the bug: a live site with an empty equipment list and a full
    // fuel tank sitting in the yard.
    const { g } = starterJob();
    const { g: after } = runJob(g, 60);
    const site = (after.activeSites || [])[0];
    if (site) {
      const stranded = (after.equipment || []).filter((e) => e.awaitingFuelForSiteId && e.fuel >= e.fuelCap * 0.5);
      expect(stranded.map((e) => e.name)).toEqual([]);
    }
  });

  test("the log no longer promises a return it cannot make", () => {
    const fs = require("fs"), path = require("path");
    const code = fs.readFileSync(path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
    expect(code).not.toContain("Refuel overnight.");
    expect(code).toContain("It returns once refuelled");
  });
});

describe("an exhausted worker comes back", () => {
  test("they remember the site, and a long run does not strand a rested worker", () => {
    const { g } = starterJob();
    const { g: after } = runJob(g, 60);
    const stranded = (after.crew || []).filter((w) => w.awaitingRestForSiteId && w.stamina >= 60);
    expect(stranded.map((w) => w.name)).toEqual([]);
  });
});

describe("the starter contract is actually completable", () => {
  test("it finishes, across many seeds", () => {
    // Before the fix this was 0 out of 6.
    let finished = 0;
    const RUNS = 10;
    for (let r = 0; r < RUNS; r++) {
      const { g } = starterJob();
      if (runJob(g, 100).days !== null) finished += 1;
    }
    expect(finished).toBeGreaterThanOrEqual(Math.ceil(RUNS * 0.8));
  });

  test("and does not take twenty times its contracted length", () => {
    const { g, contract } = starterJob();
    const { days } = runJob(g, 100);
    if (days !== null) expect(days).toBeLessThan(contract.durationDays * 4);
  });

  test("a company that completes it is not bankrupted by it", () => {
    // "I literally run out of money before a job is completed." Cash must never approach zero
    // on the FIRST contract of the game.
    let worstRatio = 1;
    for (let r = 0; r < 6; r++) {
      const { g } = starterJob();
      const start = g.cash;
      let s = g, min = g.cash, done = false;
      for (let i = 0; i < TPD * 60 && !done; i++) {
        s = gameTick(s);
        if (s.pendingDecision) s = { ...s, pendingDecision: null };
        if (s.cash < min) min = s.cash;
        if ((s.activeSites || []).length === 0) done = true;
      }
      worstRatio = Math.min(worstRatio, min / start);
    }
    // Never down to a third of the starting float on the opening job.
    expect(worstRatio).toBeGreaterThan(0.33);
  });
});

describe("a site never stops silently", () => {
  test("losing all plant crawls rather than halting", () => {
    const { g } = starterJob();
    g.activeSites[0].assignedEquipmentIds = [];
    const before = g.activeSites[0].phaseProgress;
    let s = g;
    for (let i = 0; i < TPD * 12; i++) s = gameTick(s);
    const site = (s.activeSites || [])[0];
    if (site) expect(site.phaseProgress).toBeGreaterThan(before);
    else expect(s.completedJobs).toBeGreaterThan(0);
  });

  test("and the player is told, not left guessing", () => {
    const { g } = starterJob();
    g.activeSites[0].assignedEquipmentIds = [];
    // Checked after ONE day, not three: an urgent notice ages out of the inbox after three
    // days, so the original three-day window landed exactly on the expiry and the test was
    // measuring the TTL rather than whether the warning was ever raised.
    let s = g;
    for (let i = 0; i < TPD; i++) s = gameTick(s);
    const said = (s.inbox || []).some((n) => /no working plant/i.test(n.message || ""));
    expect(said).toBe(true);
  });

  test("a site with nobody on it raises an action item", () => {
    const { g } = starterJob();
    g.activeSites[0].assignedCrewIds = [];
    let s = g;
    for (let i = 0; i < TPD; i++) s = gameTick(s);
    expect((s.inbox || []).some((n) => /nobody on site/i.test(n.message || ""))).toBe(true);
  });
});

describe("nobody starts the game already quitting", () => {
  test("no fresh save has an underpaid worker", () => {
    // Sprint 13 gave "below market" teeth, then handed the player a crew that was already
    // below it — a quarter of them, through no decision of their own. The test that was meant
    // to catch this only checked the worst band, so it passed on luck.
    const bad = [];
    for (let r = 0; r < 50; r++) {
      const g = freshState();
      for (const w of g.crew) {
        const pos = payPosition(w);
        if (pos.key === "under" || pos.key === "insulting") bad.push(`${w.role} $${w.wagePerDay} (${pos.key})`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test("and nobody is at quit risk on day one", () => {
    for (let r = 0; r < 20; r++) {
      const g = freshState();
      expect((g.crew || []).filter((w) => quitRisk(w) > 0)).toHaveLength(0);
    }
  });
});
