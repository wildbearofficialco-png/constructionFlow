// PLAYTEST — actually play the opening of the game, and report it in REAL MINUTES.
//
// WHY THIS EXISTS
// ---------------
// Four sprints of thorough unit tests never once played the game, and a defect that made the
// first contract literally impossible to finish reached a real device. Every module was proven;
// the GAME was not.
//
// It also reports the only number a player actually feels: how long a job takes in REAL
// MINUTES, against FleetFlow's own smallest delivery. Counting game DAYS hid this for four
// sprints — "a 6-day contract" sounds fine right up until you measure that it was taking
// FORTY-THREE REAL MINUTES while FleetFlow's shortest delivery is six.
//
// FleetFlow's bar, taken from its own data rather than from memory:
//   routeSecRange [500, 900] / vehicle speed, floored at 180s  =>  6 to 15 real minutes.
//
// Run it alone and read the table:  npx jest playtest
//
// This is a REPORT as much as a test. The assertions at the end are the ship gate; the printed
// table is what a person reads to decide whether the game is fun.

import { freshState, gameTick, CONTRACT_DEFS, MATERIAL_DEFS } from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { ticksPerDay, realSecondsPerGameDay } from "../src/systems/gameClock.js";

const TPD = ticksPerDay("1x");
const SEC_PER_DAY = realSecondsPerGameDay("1x");

const FLEETFLOW_SHORT_JOB_MIN = 6;
const FLEETFLOW_SHORT_JOB_MAX = 15;

function startFirstContract() {
  const g = { ...freshState(), setupDone: true, tutorialDone: true };
  const c = (g.contracts || [])[0];
  // Exactly what the tutorial tells a new player to do: take the first contract, put the crew
  // and the truck on it, and the starting lumber covers the materials.
  const need = c.materials || {};
  const fulfilled = {};
  for (const k of Object.keys(need)) fulfilled[k] = need[k];
  g.activeSites = [{
    id: "pt-1", contractId: c.id, label: c.label, client: c.client, status: "Active",
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

// An ATTENTIVE PLAYER, not a passive observer. A harness that only watches measures whether the
// game plays itself; what matters is whether a person who responds to what the game tells them
// can finish a job. So this reacts to the one action item the opening contract can raise —
// "short of materials, nothing on order" — by buying them, at the real price, out of real cash.
//
// Without this the harness died three runs in ten on a material stall, which is a player who
// walked away rather than a broken game. WITH it, a stall that still kills the job is a defect.
function restockIfShort(g) {
  let spent = 0;
  for (const site of (g.activeSites || [])) {
    const def = CONTRACT_DEFS.find((c) => c.id === (g.contracts.find((cc) => cc.id === site.contractId)?.defId));
    const needs = def?.materials;
    if (!needs) continue;
    for (const [matId, needed] of Object.entries(needs)) {
      const have = (site.materialsFulfilled || {})[matId] || 0;
      if (have >= needed) continue;
      const short = needed - have;
      const price = (MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice) || 100;
      const cost = Math.round(short * price);
      if (g.cash < cost) continue;      // a player who cannot afford it is a different story
      g.cash -= cost;
      g.expenses += cost;
      site.materialsFulfilled = { ...(site.materialsFulfilled || {}), [matId]: needed };
      spent += cost;
    }
  }
  return spent;
}

function playOneGame(maxDays = 120) {
  let { g, contract } = startFirstContract();
  const startCash = g.cash, startDay = g.day, startCrew = g.crew.length;
  let minCash = g.cash, finishedDay = null, stalledDays = 0, repairs = 0;

  for (let i = 0; i < TPD * maxDays && finishedDay === null; i++) {
    g = gameTick(g);
    if (g.pendingDecision) g = { ...g, pendingDecision: null };
    if (i % TPD === 0) restockIfShort(g);   // the player checks their sites once a day
    if (g.cash < minCash) minCash = g.cash;
    if ((g.healthLog || []).length > repairs) repairs = g.healthLog.length;
    if ((g.activeSites || []).length === 0) finishedDay = g.day - startDay;
    else if (i % TPD === 0) {
      const s = g.activeSites[0];
      if (!(s.assignedCrewIds || []).length || !(s.assignedEquipmentIds || []).length) stalledDays++;
    }
  }

  return {
    contractedDays: contract.durationDays,
    actualDays: finishedDay,
    realMinutes: finishedDay === null ? null : +(finishedDay * SEC_PER_DAY / 60).toFixed(1),
    profit: Math.round(g.cash - startCash),
    cashFloorPct: Math.round((minCash / startCash) * 100),
    crewLost: startCrew - g.crew.length,
    stalledDays,
    saveRepairs: repairs,
  };
}

describe("PLAYTEST: the opening contract", () => {
  const RUNS = 10;
  let rows;

  beforeAll(() => {
    rows = Array.from({ length: RUNS }, () => playOneGame());
    const lines = rows.map((r) =>
      `  ${String(r.actualDays ?? "NEVER").padStart(5)}d ${String(r.realMinutes ?? "--").padStart(6)}min` +
      `  profit ${String(r.profit).padStart(8)}  cash floor ${String(r.cashFloorPct).padStart(3)}%` +
      `  crewLost ${r.crewLost}  stalled ${r.stalledDays}d` +
      (r.saveRepairs ? `  !! ${r.saveRepairs} SAVE REPAIRS` : ""));
    const done = rows.filter((r) => r.actualDays !== null);
    const mins = done.map((r) => r.realMinutes).sort((a, b) => a - b);
    console.log(
      `\nPLAYTEST — ${RUNS} runs of the opening contract` +
      `\nclock: ${SEC_PER_DAY.toFixed(0)}s per game day (${(SEC_PER_DAY / 60).toFixed(1)} min)` +
      `\nFleetFlow's smallest delivery: ${FLEETFLOW_SHORT_JOB_MIN}-${FLEETFLOW_SHORT_JOB_MAX} real minutes\n` +
      lines.join("\n") +
      `\n  median: ${mins.length ? mins[Math.floor(mins.length / 2)] : "n/a"} real minutes\n`
    );
  });

  test("it finishes — every time", () => {
    // Before the hotfix this was 0 out of 6. A contract that cannot be completed is not a
    // difficulty curve, it is a broken game.
    expect(rows.filter((r) => r.actualDays === null)).toHaveLength(0);
  });

  test("it takes a FleetFlow-sized amount of REAL time", () => {
    // The number the player feels. Game-day counts hid a 43-minute job behind "6 days".
    const mins = rows.map((r) => r.realMinutes).filter((m) => m !== null).sort((a, b) => a - b);
    const median = mins[Math.floor(mins.length / 2)];
    expect(median).toBeLessThanOrEqual(FLEETFLOW_SHORT_JOB_MAX);
    expect(median).toBeGreaterThan(2);
  });

  test("most runs make money", () => {
    const done = rows.filter((r) => r.actualDays !== null);
    expect(done.filter((r) => r.profit > 0).length).toBeGreaterThanOrEqual(Math.ceil(done.length * 0.6));
  });

  test("the company is never close to broke on its first job", () => {
    // "I literally run out of money before a job is completed."
    expect(Math.min(...rows.map((r) => r.cashFloorPct))).toBeGreaterThan(40);
  });

  test("the site never sits stalled for long", () => {
    // The fuel/exhaustion freeze showed up here as dozens of stalled days.
    expect(Math.max(...rows.map((r) => r.stalledDays))).toBeLessThanOrEqual(3);
  });

  test("the opening job does not empty the crew", () => {
    // Not zero: the employee events can legitimately take someone off the books, and a run
    // that loses one person to a random event is the game working. What must not happen is a
    // systematic bleed — which is what the bad market-wage table produced (1-3 of 3, every run).
    const lost = rows.map((r) => r.crewLost);
    expect(Math.max(...lost)).toBeLessThanOrEqual(1);
    expect(lost.filter((n) => n > 0).length).toBeLessThanOrEqual(2);
  });

  test("no save repair fires during normal play", () => {
    // If this trips, something is producing NaN and saveHealth is masking it.
    expect(rows.reduce((s, r) => s + r.saveRepairs, 0)).toBe(0);
  });
});
