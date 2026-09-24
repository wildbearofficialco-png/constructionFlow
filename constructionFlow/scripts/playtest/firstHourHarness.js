// FIRST-HOUR HARNESS — plays a brand-new company through its first two contracts through the
// REAL game paths, and records every way the first hour can quietly go wrong.
//
// The original playtest (__tests__/playtest.test.js) built its own site object, never paid the
// deposit, never ordered materials through the order path, and dismissed every decision card
// without applying it. It measured a game that does not exist. This harness mobilises through
// mobilizeSite(), orders through orderSiteMaterials(), answers cards through resolveDecision(),
// and ticks through gameTick() — the same functions a player's taps reach.
//
// The simulated player is ATTENTIVE but not omniscient: it reacts only to what the site card and
// the bills show it. If the game hides a problem, this player does not fix it, and the run records
// the damage. That is the point: a defect in communication shows up as a stranded run.
//
// Deterministic: Math.random is replaced with a seeded generator for the duration of a run.

import {
  freshState, gameTick, mobilizeSite, orderSiteMaterials, resolveDecision, buyYardMaterials,
  payTaxBill, repairEquipment, getNextBestAction, CONTRACT_DEFS,
} from "../../src/games/constructionflow/ConstructionFlowScreen.js";
import { ticksPerDay, realSecondsPerGameDay } from "../../src/systems/gameClock.js";
import { canStartWithPlant } from "../../src/systems/sitePlant.js";
import { diagnoseSite } from "../../src/systems/siteDiagnostics.js";

export const TPD = ticksPerDay("1x");
export const SEC_PER_DAY = realSecondsPerGameDay("1x");

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function withSeed(seed, fn) {
  const real = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = real; }
}

// ─── Observation helpers ─────────────────────────────────────────────────────

function ledgerIds(g) {
  return new Set((g.ledger || []).map((e) => e.id));
}

// Every cash movement must be named in the ledger. Returns what was named, what the reconciler
// had to guess at, and what vanished without any entry at all.
export function accountCashMove(before, after, beforeIds = ledgerIds(before)) {
  const delta = (after.cash || 0) - (before.cash || 0);
  let named = 0, reconciled = 0;
  const entries = [];
  for (const e of (after.ledger || [])) {
    if (beforeIds.has(e.id)) continue;
    entries.push(e);
    if (e.meta && e.meta.nonCash) continue;
    if (e.meta && e.meta.source === "reconciliation") reconciled += e.amount;
    else named += e.amount;
  }
  return { delta, named, reconciled, silent: Math.round(delta - named - reconciled), entries };
}

// Any non-finite number anywhere in the save.
export function findNonFinite(obj, path = "", out = [], depth = 0) {
  if (depth > 6 || obj == null) return out;
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) out.push(path);
    return out;
  }
  if (typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length && i < 400; i++) findNonFinite(obj[i], `${path}[${i}]`, out, depth + 1);
    return out;
  }
  for (const k of Object.keys(obj)) findNonFinite(obj[k], path ? `${path}.${k}` : k, out, depth + 1);
  return out;
}

export function progressUnits(site) {
  return (site.currentPhaseIdx || 0) * 100 + Math.max(0, site.phaseProgress || 0);
}

function contractDefOf(g, site) {
  const c = (g.contracts || []).find((x) => x.id === site.contractId);
  return CONTRACT_DEFS.find((d) => d.id === c?.defId);
}

function missingMaterials(g, site) {
  const def = contractDefOf(g, site);
  if (!def?.materials) return [];
  return Object.entries(def.materials)
    .map(([matId, need]) => ({ matId, short: need - ((site.materialsFulfilled || {})[matId] || 0) }))
    .filter((m) => m.short > 0);
}

// ─── The attentive player ────────────────────────────────────────────────────

function dismissModals(g) {
  if (g.pendingDecision) resolveDecision(g, 0);   // the highlighted, first option
  g.pendingCelebration = null;
  g.pendingStory = null;
  g.pendingInspection = null;
  g.pendingCeremony = null;
  g.pendingVeteranEvent = null;
  g.pendingOfflineSummary = null;
}

function idleCrew(g) {
  return (g.crew || []).filter((w) => w.status === "Idle" && !w.awaitingRestForSiteId && (w.stamina ?? 0) >= 30);
}

function idleEquipment(g) {
  return (g.equipment || []).filter((e) => e.status === "Idle" && !e.awaitingFuelForSiteId);
}

// A contract this company can actually put a crew on right now.
function feasible(g, c) {
  if (c.status !== "Open") return false;
  const def = CONTRACT_DEFS.find((d) => d.id === c.defId);
  if (!def) return false;
  const crew = idleCrew(g), equip = idleEquipment(g);
  if (crew.length < (def.crewMin || 1) || equip.length < (def.equipMin || 1)) return false;
  if (Math.max(0, ...equip.map((e) => e.tier || 1)) < (def.minTier || 1)) return false;
  return canStartWithPlant(c.phases || [], equip, def.minTier).ok;
}

function tryStartJob(g, run, preferDefId) {
  const open = (g.contracts || []).filter((c) => c.status === "Open");
  const ordered = [
    ...open.filter((c) => c.defId === preferDefId),
    ...open.filter((c) => c.defId !== preferDefId).sort((a, b) => (b.value || 0) - (a.value || 0)),
  ].filter((c) => feasible(g, c));
  for (const c of ordered) {
    // The Bids card blocks the start until the yard holds the job's materials, and offers a Buy
    // button for each. An attentive player presses it.
    for (const [matId, need] of Object.entries(c.materials || {})) {
      const short = need - ((g.materials || {})[matId] || 0);
      if (short > 0) buyYardMaterials(g, matId, short);
    }
    const res = mobilizeSite(g, c.id, idleCrew(g).map((w) => w.id), idleEquipment(g).map((e) => e.id));
    run.bids.push({ day: g.day, defId: c.defId, status: res.status, reason: res.reason || null });
    if (res.status === "won") return res.site;
    if (res.status === "blocked") {
      // Materials missing from the yard block the start. A player buys them first; the harness
      // records it as a friction point rather than skipping the job.
      run.startBlocks.push({ day: g.day, defId: c.defId, reason: res.reason });
    }
  }
  return null;
}

function respond(g, run) {
  dismissModals(g);

  for (const site of (g.activeSites || [])) {
    // What the card shows: materials short with nothing on order.
    if (missingMaterials(g, site).length && !(site.pendingDeliveries || []).length) {
      const r = orderSiteMaterials(g, site.id);
      if (r.status === "ordered") run.materialOrders += 1;
      else if (r.status === "unaffordable") run.unaffordableOrders += 1;
    }
    // What the card shows: "No crew".
    if (!(site.assignedCrewIds || []).length) {
      for (const w of idleCrew(g)) {
        site.assignedCrewIds = [...(site.assignedCrewIds || []), w.id];
        w.status = "Active";
        w.assignedSiteId = site.id;
        run.playerReassignedCrew += 1;
      }
    }
  }

  // Home's command card. It is the game's own "do this next"; an attentive player does it.
  const next = getNextBestAction(g);
  if (next && (next.title === "Machine Down on Site" || next.title === "Machine Needs Repair")) {
    for (const e of (g.equipment || [])) {
      if (e.status === "Broken" || e.status === "Maintenance") {
        const r = repairEquipment(g, e.id, false);
        if (r.status === "repaired") run.repairs += 1;
      }
    }
  }

  // The tax bill, when one is issued.
  if ((g.taxDue || 0) > 0) {
    const r = payTaxBill(g);
    if (r.status === "paid") run.taxPaid += r.paid;
  }
}

// ─── One run ─────────────────────────────────────────────────────────────────

export function playFirstHour(seed, { maxDays = 45, jobs = 2 } = {}) {
  return withSeed(seed, () => {
    let g = { ...freshState(), setupDone: true, tutorialDone: false };
    const run = {
      seed, startCash: g.cash, minCash: g.cash, finalCash: null,
      bids: [], startBlocks: [], materialOrders: 0, unaffordableOrders: 0, taxPaid: 0,
      playerReassignedCrew: 0, repairs: 0,
      jobs: [],               // { defId, startDay, endDay, days, realMinutes, economics }
      cash: { named: 0, reconciled: 0, silent: 0 },
      silentSamples: [],      // ticks where money moved with no ledger entry
      reconciledSamples: [],
      nonFinite: [],
      saveRepairs: 0,
      stalls: [],             // { day, site, reason, visible }
      staleRate: 0,           // ticks where the card's %/day was shown for a site making no progress
      strandedCrew: [],
      strandedEquipment: [],
      stuckInRepair: [],
      bankruptcyDays: 0, gameOver: false, emergencyGrants: 0, loansTaken: 0,
      categories: {},
    };

    // Job 1 — the tutorial's recommended first contract.
    const ids0 = ledgerIds(g);
    const g0 = JSON.parse(JSON.stringify(g));
    const site = tryStartJob(g, run, "fence");
    const a0 = accountCashMove(g0, g, ids0);
    run.cash.named += a0.named;
    run.cash.silent += a0.silent;
    if (a0.silent !== 0) run.silentSamples.push({ day: g.day, amount: a0.silent, logs: ["(mobilise)", ...(g.logs || []).slice(0, 2)] });
    if (site) run.jobs.push({ defId: contractDefOf(g, site)?.id, siteId: site.id, startDay: g.day, endDay: null });

    const lastSiteOfWorker = {};
    const lastSiteOfMachine = {};
    const inRepairSince = {};

    for (let i = 0; i < TPD * maxDays; i++) {
      const before = g;
      const ids = ledgerIds(before);
      const progBefore = Object.fromEntries((before.activeSites || []).map((s) => [s.id, progressUnits(s)]));
      const phaseBefore = Object.fromEntries((before.activeSites || []).map((s) => [s.id, s.currentPhaseIdx || 0]));
      const wasPaused = new Set((before.activeSites || []).filter((s) => s.status === "Paused").map((s) => s.id));

      g = gameTick(before);

      // ── Money integrity ──
      const acct = accountCashMove(before, g, ids);
      run.cash.named += acct.named;
      run.cash.reconciled += acct.reconciled;
      run.cash.silent += acct.silent;
      if (acct.silent !== 0 && run.silentSamples.length < 12) {
        const newLogs = (g.logs || []).slice(0, 4);
        run.silentSamples.push({ day: g.day, amount: acct.silent, logs: newLogs });
      }
      if (acct.reconciled !== 0 && run.reconciledSamples.length < 12) {
        run.reconciledSamples.push({ day: g.day, amount: acct.reconciled, entries: acct.entries.map((e) => e.description) });
      }
      for (const e of acct.entries) {
        if (e.meta && e.meta.source === "reconciliation") continue;
        run.categories[e.category] = (run.categories[e.category] || 0) + e.amount;
        if (e.description === "Startup emergency grant") run.emergencyGrants += 1;
      }
      const nf = findNonFinite(g);
      if (nf.length && run.nonFinite.length < 10) run.nonFinite.push({ day: g.day, paths: nf.slice(0, 5) });
      run.saveRepairs = (g.healthLog || []).length;

      // ── Silent stalls & stale rates ──
      // "Visible" means exactly what SiteStatusBanner would render for the site right now.
      for (const s of (g.activeSites || [])) {
        if (!(s.id in progBefore)) continue;
        const moved = progressUnits(s) - progBefore[s.id];
        if (moved > 0) continue;
        // The tick a pause ends flips the site back to Active and moves on the next one.
        if (wasPaused.has(s.id)) continue;
        // A phase that closed this tick is progress, even when a bonus had already parked it at 100%.
        if ((s.currentPhaseIdx || 0) > phaseBefore[s.id]) continue;
        const verdict = diagnoseSite(s, g.day);
        // The card prints "%/day" from _progressRate whenever it is non-zero and the site is not
        // paused. A site that did not move while the card still shows a rate is a stale rate.
        if (s.status !== "Paused" && (s._progressRate || 0) > 0 && verdict.state === "running" && moved === 0) {
          run.staleRate += 1;
          if (!run.staleSamples) run.staleSamples = [];
          if (run.staleSamples.length < 3) run.staleSamples.push({ day: g.day, phase: s.phases[s.currentPhaseIdx], prog: s.phaseProgress, before: progBefore[s.id], idx: s.currentPhaseIdx, rate: s._progressRate, logs: (g.logs || []).slice(0, 3) });
        }
        if (i % 6 === 0) {
          const reason = verdict.state === "running" ? (moved < 0 ? "setback event" : "unknown") : verdict.lines[0].text;
          run.stalls.push({ day: g.day, site: s.label, reason: verdict.state === "running" && moved === 0 ? "unknown" : reason,
            detail: verdict.state === "running" && moved === 0 ? { status: s.status, phase: s.phases[s.currentPhaseIdx], prog: s.phaseProgress, crew: (s.assignedCrewIds || []).length, equip: (s.assignedEquipmentIds || []).length, rate: s._progressRate, chaos: (s.chaosHistory || [])[0] } : undefined });
        }
      }

      // ── Stranding & stuck machines, once a day ──
      if (i % TPD === 0) {
        for (const s of (g.activeSites || [])) {
          for (const id of s.assignedCrewIds || []) lastSiteOfWorker[id] = s.id;
          for (const id of s.assignedEquipmentIds || []) lastSiteOfMachine[id] = s.id;
        }
        const liveIds = new Set((g.activeSites || []).map((s) => s.id));
        for (const w of (g.crew || [])) {
          const was = lastSiteOfWorker[w.id];
          const onSite = (g.activeSites || []).some((s) => (s.assignedCrewIds || []).includes(w.id));
          if (was && liveIds.has(was) && !onSite && !w.awaitingRestForSiteId
              && w.status !== "Resting" && (w.stamina ?? 0) >= 60) {
            run.strandedCrew.push({ day: g.day, name: w.name, status: w.status });
          }
        }
        for (const e of (g.equipment || [])) {
          const was = lastSiteOfMachine[e.id];
          const onSite = (g.activeSites || []).some((s) => (s.assignedEquipmentIds || []).includes(e.id));
          if (was && liveIds.has(was) && !onSite && !e.awaitingFuelForSiteId
              && e.status === "Idle" && (e.fuel ?? 0) >= (e.fuelCap || 0) * 0.25) {
            run.strandedEquipment.push({ day: g.day, name: e.name });
          }
          if (e.status === "In Repair") {
            inRepairSince[e.id] = inRepairSince[e.id] ?? g.day;
            if (g.day - inRepairSince[e.id] >= 2) run.stuckInRepair.push({ day: g.day, name: e.name });
          } else delete inRepairSince[e.id];
        }
      }

      // ── The player: job bookkeeping every tick, a look at the sites once an in-game hour ──
      {
        const pre = g;
        const preIds = ledgerIds(pre);
        g = JSON.parse(JSON.stringify(pre));
        const openJob = run.jobs.find((j) => j.endDay === null);
        if (openJob && !(g.activeSites || []).some((s) => s.id === openJob.siteId)) {
          openJob.endDay = g.day;
          openJob.days = g.day - openJob.startDay;
          openJob.realMinutes = +(openJob.days * SEC_PER_DAY / 60).toFixed(1);
          const hist = (g.jobHistory || []).slice(-1)[0];
          openJob.payout = hist?.value ?? null;
          openJob.daysLate = hist?.daysLate ?? null;
          // The completion card's own breakdown — the numbers the player is shown.
          openJob.economics = g.pendingCelebration?.economics || null;
          openJob.cashAtEnd = g.cash;
          dismissModals(g);
          if (run.jobs.length < jobs) {
            const next = tryStartJob(g, run, null);
            if (next) run.jobs.push({ defId: contractDefOf(g, next)?.id, siteId: next.id, startDay: g.day, endDay: null });
            else run.noSecondJob = { day: g.day, cash: Math.round(g.cash), open: (g.contracts || []).filter((c) => c.status === "Open").map((c) => c.defId) };
          }
        } else if (!openJob && run.jobs.length < jobs && run.noSecondJob && i % 6 === 0) {
          // Nothing was startable last time; the board refreshes daily, so keep looking.
          const next = tryStartJob(g, run, null);
          if (next) { run.jobs.push({ defId: contractDefOf(g, next)?.id, siteId: next.id, startDay: g.day, endDay: null }); run.secondJobWaitDays = g.day - run.noSecondJob.day; }
        }
        if (i % 6 === 0) respond(g, run);
        const a2 = accountCashMove(pre, g, preIds);
        run.cash.named += a2.named;
        run.cash.silent += a2.silent;
        for (const e of a2.entries) run.categories[e.category] = (run.categories[e.category] || 0) + e.amount;
        if (a2.silent !== 0 && run.silentSamples.length < 12) {
          run.silentSamples.push({ day: g.day, amount: a2.silent, logs: ["(player action)", ...(g.logs || []).slice(0, 3)] });
        }
      }

      if (g.cash < run.minCash) run.minCash = g.cash;
      if ((g.bankruptcyDays || 0) > run.bankruptcyDays) run.bankruptcyDays = g.bankruptcyDays;
      run.loansTaken = (g.loans || []).length;
      if (g.gameOver) { run.gameOver = true; break; }
      if (run.jobs.length >= jobs && run.jobs.every((j) => j.endDay !== null)) break;
    }

    run.finalCash = g.cash;
    run.endDay = g.day;
    run.taxReserve = g.taxReserve || 0;
    run.taxDue = g.taxDue || 0;
    run.state = g;
    return run;
  });
}

export function summarize(runs) {
  const done1 = runs.filter((r) => r.jobs[0]?.endDay != null);
  const done2 = runs.filter((r) => r.jobs[1]?.endDay != null);
  const mins = done1.map((r) => r.jobs[0].realMinutes).sort((a, b) => a - b);
  return {
    runs: runs.length,
    job1Complete: done1.length,
    job2Complete: done2.length,
    medianJob1Minutes: mins.length ? mins[Math.floor(mins.length / 2)] : null,
    worstCashFloor: Math.min(...runs.map((r) => r.minCash)),
    bankrupted: runs.filter((r) => r.gameOver || r.bankruptcyDays > 0).length,
    emergencyGrants: runs.reduce((s, r) => s + r.emergencyGrants, 0),
    silentCash: runs.reduce((s, r) => s + Math.abs(r.cash.silent), 0),
    reconciledCash: runs.reduce((s, r) => s + Math.abs(r.cash.reconciled), 0),
    nonFiniteRuns: runs.filter((r) => r.nonFinite.length).length,
    saveRepairs: runs.reduce((s, r) => s + r.saveRepairs, 0),
    strandedCrewRuns: runs.filter((r) => r.strandedCrew.length).length,
    strandedEquipRuns: runs.filter((r) => r.strandedEquipment.length).length,
    stuckInRepairRuns: runs.filter((r) => r.stuckInRepair.length).length,
    staleRateTicks: runs.reduce((s, r) => s + r.staleRate, 0),
    unknownStalls: runs.reduce((s, r) => s + r.stalls.filter((x) => x.reason === "unknown").length, 0),
    noSecondJob: runs.filter((r) => r.jobs.length < 2).length,
  };
}
