// PLAYTEST — actually play the opening of the game, through the real game paths, and report it.
//
// WHY THIS EXISTS
// ---------------
// Four sprints of unit tests never once played the game, and a defect that made the first
// contract impossible to finish reached a real device. This file plays it.
//
// Sprint 1 rebuilt it on scripts/playtest/firstHourHarness.js. The previous version built its own
// site object, never paid the mobilisation deposit, never ordered through the order path, and
// dismissed every decision card without applying it — so it measured a game that did not exist,
// and it could not see the $460,000 of first-hour cash that moved with no ledger entry, the
// stale "%/day" on stalled sites, or the workers the Rest button stranded. The harness mobilises
// through mobilizeSite(), orders through orderSiteMaterials(), answers cards through
// resolveDecision(), repairs through repairEquipment(), and ticks through gameTick().
//
// Scenario A (Sprint 1, P1-10): a fresh company, first contract through second contract.
// Deterministic: every run is seeded.
//
// Run it alone and read the table:  npx jest playtest
//
// FleetFlow's bar for the smallest job, taken from its own data: 6 to 15 real minutes.

import { playFirstHour, summarize, SEC_PER_DAY } from "../scripts/playtest/firstHourHarness.js";

const FLEETFLOW_SHORT_JOB_MIN = 6;
const FLEETFLOW_SHORT_JOB_MAX = 15;
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

const money = (n) => (n == null ? "--" : `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`);

describe("PLAYTEST — Scenario A: a fresh company, first contract through second", () => {
  let runs, sum;

  beforeAll(() => {
    runs = SEEDS.map((seed) => playFirstHour(seed, { maxDays: 45, jobs: 2 }));
    sum = summarize(runs);
    const cat = (r, k) => r.categories[k] || 0;
    const lines = runs.map((r) => {
      const j1 = r.jobs[0] || {};
      const j2 = r.jobs[1] || {};
      const e1 = j1.economics || {};
      return `  seed ${String(r.seed).padStart(2)}  job1 ${String(j1.defId).padEnd(6)} ${String(j1.days ?? "NEVER").padStart(3)}d ${String(j1.realMinutes ?? "--").padStart(5)}min` +
        ` profit ${money(e1.netProfit).padStart(8)}  job2 ${String(j2.defId ?? "-").padEnd(10)} ${String(j2.days ?? "-").padStart(3)}d` +
        `  cash ${money(r.startCash)} → min ${money(r.minCash)} → ${money(r.finalCash)}` +
        `  wages ${money(-cat(r, "payroll"))} mats ${money(-cat(r, "materials"))} fuel ${money(-cat(r, "fuel"))}` +
        ` overhead ${money(-(cat(r, "property") + cat(r, "equipment")))} repairs ${money(-cat(r, "maintenance"))}` +
        ` fines ${money(-cat(r, "fines"))} tax paid ${money(r.taxPaid)} tax reserve ${money(r.taxReserve)}`;
    });
    console.log(
      `\nPLAYTEST — ${runs.length} seeded fresh companies · ${(SEC_PER_DAY / 60).toFixed(1)} real min per game day` +
      `\nFleetFlow's smallest delivery: ${FLEETFLOW_SHORT_JOB_MIN}-${FLEETFLOW_SHORT_JOB_MAX} real minutes\n` +
      lines.join("\n") +
      `\n  ${JSON.stringify(sum)}\n`
    );
  }, 180000);

  test("≥90% finish the first contract without forced borrowing or bankruptcy", () => {
    const clean = runs.filter((r) => r.jobs[0]?.endDay != null && r.loansTaken === 0 && r.emergencyGrants === 0 && !r.gameOver && r.bankruptcyDays === 0);
    expect(clean.length / runs.length).toBeGreaterThanOrEqual(0.9);
  });

  test("≥90% go on to start AND finish a second contract", () => {
    expect(sum.job2Complete / runs.length).toBeGreaterThanOrEqual(0.9);
  });

  test("the first job takes a FleetFlow-sized amount of REAL time", () => {
    expect(sum.medianJob1Minutes).toBeLessThanOrEqual(FLEETFLOW_SHORT_JOB_MAX);
    expect(sum.medianJob1Minutes).toBeGreaterThan(2);
  });

  test("the company is never close to broke in its first hour", () => {
    expect(Math.min(...runs.map((r) => r.minCash / r.startCash))).toBeGreaterThan(0.4);
  });

  test("every dollar that moved is named in the ledger", () => {
    // Before Sprint 1: deposits, fines, medical bills and decision-card money moved with no
    // entry, and the ledger's snapshot reset absorbed it so even the safety net saw nothing.
    expect(sum.silentCash).toBe(0);
    expect(sum.reconciledCash).toBe(0);
  });

  test("no silent stalls: a site that is not moving always says why", () => {
    expect(sum.unknownStalls).toBe(0);
    expect(sum.staleRateTicks).toBe(0);
  });

  test("nobody and nothing is stranded off a live site", () => {
    expect(sum.strandedCrewRuns).toBe(0);
    expect(sum.strandedEquipRuns).toBe(0);
    expect(sum.stuckInRepairRuns).toBe(0);
  });

  test("no NaN/Infinity anywhere in the save, and no save repair fired", () => {
    expect(sum.nonFiniteRuns).toBe(0);
    expect(sum.saveRepairs).toBe(0);
  });

  test("the opening does not empty the crew", () => {
    const lost = runs.map((r) => 3 - (r.state.crew || []).length);
    expect(Math.max(...lost)).toBeLessThanOrEqual(1);
  });
});
