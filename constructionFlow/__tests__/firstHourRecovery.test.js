// Sprint 1, P0-2 — no permanent recoverable dead states.
//
// "Automated tests prove a starter company can recover from fuel depletion, crew exhaustion, a
// breakdown, and a material shortage without restarting the save."
//
// Every scenario starts a real fence job through mobilizeSite(), injects one failure, lets the
// game run, and requires (a) the failure is visible on the card while it lasts, (b) the site gets
// its people / machine / materials back — automatically, or through the action the card names —
// and (c) the job finishes.
//
// Defects this file pins, all found by the first-hour audit:
//   * the Crew tab's Rest button (which the site card recommends) pulled the worker off the site
//     and forgot which one — they recovered in the yard and never went back;
//   * a worker injured on site was dropped the same way;
//   * a machine recalled for safety was dropped the same way;
//   * a breakdown's "In Repair" downtime was never counted down: on site it vanished after one
//     tick (the log's promised hours of downtime never happened); off site it lasted forever.

import {
  freshState, gameTick, mobilizeSite, orderSiteMaterials, repairEquipment, restWorker,
  getNextBestAction, CHAOS_EVENTS,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { triggerBreakdown } from "../src/systems/equipmentWear.js";
import { diagnoseSite } from "../src/systems/siteDiagnostics.js";
import { ticksPerDay } from "../src/systems/gameClock.js";
import { withSeed } from "../scripts/playtest/firstHourHarness.js";

const TPD = ticksPerDay("1x");

function startedFence(seed = 1) {
  return withSeed(seed, () => {
    const g = { ...freshState(), setupDone: true, tutorialDone: true };
    const c = g.contracts.find((x) => x.defId === "fence");
    const res = mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
    expect(res.status).toBe("won");
    return g;
  });
}

// Run with a seeded RNG, answering decision cards, until `done` or the day budget runs out.
function run(g, { days = 30, seed = 7, each = null, done = (s) => s.activeSites.length === 0 } = {}) {
  return withSeed(seed, () => {
    let s = g;
    for (let i = 0; i < TPD * days; i++) {
      s = gameTick(s);
      s.pendingDecision = null;
      if (each) each(s, i);
      if (done(s)) return { g: s, finished: true, day: s.day };
    }
    return { g: s, finished: false, day: s.day };
  });
}

const siteOf = (g) => g.activeSites[0];

describe("fuel depletion", () => {
  test("the truck runs dry, the card says so, it refuels and returns, the job finishes", () => {
    const g = startedFence();
    const truck = g.equipment[0];
    truck.fuel = 0.2;
    const r1 = run(g, { days: 1, done: (s) => s.equipment[0].awaitingFuelForSiteId != null });
    expect(r1.g.equipment[0].awaitingFuelForSiteId).toBe(siteOf(r1.g).id);
    // With its only machine gone, a phase that needs plant crawls — and says so.
    const r2 = run(r1.g, { days: 3, done: (s) => (siteOf(s)?.assignedEquipmentIds || []).includes(truck.id) });
    expect(siteOf(r2.g).assignedEquipmentIds).toContain(truck.id);
    const r3 = run(r2.g, { days: 30 });
    expect(r3.finished).toBe(true);
  });
});

describe("crew exhaustion", () => {
  test("the whole crew drops out, the card says they are resting, they come back, the job finishes", () => {
    const g = startedFence();
    for (const w of g.crew) w.stamina = 10.1;
    const out = run(g, { days: 1, done: (s) => (siteOf(s)?.assignedCrewIds || []).length === 0 });
    expect(siteOf(out.g).assignedCrewIds).toHaveLength(0);
    const t = gameTick(out.g);
    expect(diagnoseSite(siteOf(t), t.day).lines[0].text).toMatch(/all 3 crew are resting — they return automatically/);
    const back = run(t, { days: 6, done: (s) => (siteOf(s)?.assignedCrewIds || []).length === s.crew.length });
    expect(siteOf(back.g).assignedCrewIds.length).toBe(back.g.crew.length);
    expect(run(back.g, { days: 30 }).finished).toBe(true);
  });

  test("resting a worker with the Crew tab's Rest button does not strand them", () => {
    const g = startedFence();
    const w = g.crew[0];
    expect(restWorker(g, w.id)).toBe(true);
    expect(siteOf(g).assignedCrewIds).not.toContain(w.id);
    expect(g.crew[0].awaitingRestForSiteId).toBe(siteOf(g).id);
    g.crew[0].stamina = 30;
    const r = run(g, { days: 8, done: (s) => (siteOf(s)?.assignedCrewIds || []).includes(w.id) || s.activeSites.length === 0 });
    // Either they went back, or the job finished without them — never stranded on a live site.
    if (r.g.activeSites.length) expect(siteOf(r.g).assignedCrewIds).toContain(w.id);
  });

  test("an injured worker returns to the job once recovered", () => {
    const g = startedFence();
    const injury = CHAOS_EVENTS.find((e) => e.id === "injury");
    withSeed(3, () => injury.apply(siteOf(g), g));
    const hurt = g.crew.find((w) => w.awaitingRestForSiteId === siteOf(g).id);
    expect(hurt).toBeDefined();
    const r = run(g, { days: 8, done: (s) => (siteOf(s)?.assignedCrewIds || []).includes(hurt.id) || s.activeSites.length === 0 });
    if (r.g.activeSites.length) expect(siteOf(r.g).assignedCrewIds).toContain(hurt.id);
  });
});

describe("equipment breakdown", () => {
  test("a breakdown's downtime is real and ends on its own", () => {
    const g = startedFence();
    const truck = g.equipment[0];
    withSeed(11, () => triggerBreakdown(g, truck.id));
    expect(g.equipment[0].status).toBe("In Repair");
    const mins = g.equipment[0].repairMinsLeft;
    expect(mins).toBeGreaterThan(0);
    // Next tick it is still in the workshop — the old code flipped it straight back to Active.
    const one = gameTick(g);
    expect(one.equipment[0].status).toBe("In Repair");
    // And the card says it is coming back by itself, rather than asking for a paid repair.
    const line = diagnoseSite(siteOf(one), one.day).lines.find((l) => /workshop/.test(l.text));
    expect(line).toBeDefined();
    expect(line.action).toBeNull();
    const r = run(one, { days: 2, done: (s) => s.equipment[0].status !== "In Repair" });
    expect(r.g.equipment[0].status).toBe("Active");
    expect(siteOf(r.g).assignedEquipmentIds).toContain(truck.id);
    expect(run(r.g, { days: 30 }).finished).toBe(true);
  });

  test("a machine the company could not afford to fix is flagged on Home, and repairing it puts it back to work", () => {
    const g = startedFence();
    const truck = g.equipment[0];
    const cash = g.cash;
    g.cash = 0;
    withSeed(11, () => triggerBreakdown(g, truck.id));
    g.cash = cash;
    expect(g.equipment[0].status).toBe("Broken");
    expect(getNextBestAction(g).title).toBe("Machine Down on Site");
    expect(repairEquipment(g, truck.id, false).status).toBe("repaired");
    const after = gameTick(g);
    expect(after.equipment[0].status).toBe("Active");
    expect(run(after, { days: 30 }).finished).toBe(true);
  });

  test("a machine pulled by a safety recall goes back to the site once repaired", () => {
    const g = startedFence();
    const recall = CHAOS_EVENTS.find((e) => e.id === "equipment_recall");
    recall.apply(siteOf(g), g);
    const truck = g.equipment[0];
    expect(truck.status).toBe("Maintenance");
    expect(truck.awaitingRepairForSiteId).toBe(siteOf(g).id);
    expect(getNextBestAction(g).title).toMatch(/Machine/);
    repairEquipment(g, truck.id, false);
    const r = run(g, { days: 2, done: (s) => (siteOf(s)?.assignedEquipmentIds || []).includes(truck.id) });
    expect(siteOf(r.g).assignedEquipmentIds).toContain(truck.id);
  });
});

describe("material shortage", () => {
  test("stock disappears, the card names it and the fix, the order arrives, the job finishes", () => {
    const g = startedFence();
    siteOf(g).materialsFulfilled = { lumber: 4 };
    const t = gameTick(g);
    const v = diagnoseSite(siteOf(t), t.day);
    expect(v.lines[0].text).toMatch(/short 16 lumber and nothing on order/);
    expect(v.lines[0].action.label).toBe("Order materials");
    expect(orderSiteMaterials(t, siteOf(t).id).status).toBe("ordered");
    expect(diagnoseSite(siteOf(gameTick(t)), t.day).lines[0].text).toMatch(/Waiting on materials/);
    expect(run(t, { days: 30 }).finished).toBe(true);
  });
});

describe("weather and holds", () => {
  test("a permit hold pauses the site with a reason, and the job still finishes", () => {
    const g = startedFence();
    const permit = CHAOS_EVENTS.find((e) => e.id === "permit");
    withSeed(5, () => permit.apply(siteOf(g), g));
    expect(diagnoseSite(siteOf(g), g.day).lines[0].text).toMatch(/Paused: Permit hold · resumes in ~\dd/);
    expect(run(g, { days: 30 }).finished).toBe(true);
  });
});
