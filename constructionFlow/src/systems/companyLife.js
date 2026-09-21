// The living company: the people, the machines, and what happened while you were away.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Phase 3 of the FleetFlow parity work. The audit's finding for this phase is not that
// systems are missing — Construction Flow already simulates crew mood, loyalty, stamina,
// traits, XP and turnover, and tracks equipment hours, condition, wear and utilisation. The
// finding is that **the company is being simulated but not witnessed**:
//
//   People     A worker rendered as "Dave · Concreter" with a Remove button. The simulation
//              knows Dave is exhausted, three days from quitting, and currently pouring the
//              foundation at Riverside — and said none of it.
//   Machines   The player can see a machine's condition but never the question they actually
//              have: is this thing making me money, or am I paying to park it?
//   Offline    The return report said cash +$8,200 and nothing about the job sites, which is
//              the only thing the player actually wants to know.
//
// Everything here is pure and, crucially, RNG-FREE. That second property is a lesson taken
// directly from FleetFlow's build 59 post-mortem: its `pushNewsFeedItem` minted list keys with
// Math.random(), so posting a purely cosmetic headline consumed a draw from the same sequence
// the gated simulation behaviours read — meaning adding or removing a decorative line could
// change what the simulation did that day. Flavour text here is therefore derived
// deterministically from state the game already holds (see `pickStable`), never rolled.

// ─── Deterministic variety ───────────────────────────────────────────────────

// Picks from a list using a stable hash of a seed string rather than Math.random(). Two
// properties matter: the same worker on the same day always says the same thing (so the UI
// does not flicker as the screen re-renders), and nothing here can perturb the simulation's
// RNG sequence.
export function pickStable(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const text = String(seed == null ? "" : seed);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    // djb2. Coerced with |0 each step so it stays a 32-bit int and cannot drift into
    // floating-point territory on a long seed.
    hash = ((hash * 33) ^ text.charCodeAt(i)) | 0;
  }
  return list[Math.abs(hash) % list.length];
}

// ─── People ──────────────────────────────────────────────────────────────────

// Where this person actually is right now. "Idle" was shown as a bare status word; what the
// player wants to know is which job and which phase, because that is the difference between
// a crew that is working and a wage bill that is not.
export function describeWorkerAssignment(worker = {}, game = {}) {
  const sites = Array.isArray(game.activeSites) ? game.activeSites : [];
  const site = sites.find((s) => Array.isArray(s?.assignedCrewIds) && s.assignedCrewIds.includes(worker.id));

  if (site) {
    const phases = Array.isArray(site.phases) ? site.phases : [];
    const phase = phases[site.currentPhaseIdx ?? 0];
    if (site.status === "Paused") {
      return { state: "paused", tone: "caution", label: `Stood down at ${site.label}`, siteId: site.id };
    }
    return {
      state: "working",
      tone: "safe",
      label: phase ? `${site.label} · ${phase}` : site.label,
      siteId: site.id,
    };
  }

  if (worker.status === "Resting") {
    return { state: "resting", tone: "info", label: "Resting — recovering stamina", siteId: null };
  }
  if (worker.onShift === false) {
    return { state: "off", tone: "neutral", label: "Off shift", siteId: null };
  }
  return { state: "idle", tone: "caution", label: "In the yard — no site assigned", siteId: null };
}

// The things about a person that should make the player act, in the order they should act on
// them. Capped at three: a card listing six problems communicates none of them.
export function workerRiskFlags(worker = {}) {
  const flags = [];
  const stamina = Number.isFinite(worker.stamina) ? worker.stamina : 50;
  const mood = Number.isFinite(worker.mood) ? worker.mood : 70;
  const loyalty = Number.isFinite(worker.loyalty) ? worker.loyalty : 50;

  if (stamina < 20) flags.push({ key: "exhausted", tone: "hazard", label: "Exhausted", detail: "Slowing every site they are on. Rest them." });
  else if (stamina < 40) flags.push({ key: "tired", tone: "caution", label: "Tired", detail: "Output dropping." });

  if (mood < 25) flags.push({ key: "unhappy", tone: "hazard", label: "Unhappy", detail: "A bonus or a lighter week would help." });
  if (loyalty < 25) flags.push({ key: "flight-risk", tone: "hazard", label: "Flight risk", detail: "Likely to take another offer." });
  if ((worker.attendanceStrikes || 0) >= 2) flags.push({ key: "attendance", tone: "caution", label: "Attendance", detail: `${worker.attendanceStrikes} no-shows on record.` });

  return flags.slice(0, 3);
}

// Lines a worker "says". Deterministic per worker per day — see pickStable. These are chosen
// from the state the simulation already produced, so they can only ever narrate something
// that is true.
const VOICE = {
  exhausted: [
    "I'm running on fumes. Need a day off before I drop something heavy.",
    "Boss, I've been on site fourteen days straight.",
  ],
  unhappy: [
    "Not sure this is worth what I'm getting paid.",
    "Morale's low out here. People are noticing.",
  ],
  flightRisk: [
    "Had a call from another outfit. Haven't said no yet.",
    "I've been here a while with no move. Just saying.",
  ],
  proud: [
    "That foundation came out clean. Proud of that one.",
    "Good crew on this job. We're moving well.",
  ],
  loyal: [
    "Wherever you need me, boss.",
    "Been with this company a long time. Not going anywhere.",
  ],
  idle: [
    "Sitting in the yard again. Put me on something.",
    "Plenty of daylight and nothing to swing at.",
  ],
  neutral: [
    "All good on my end.",
    "Steady day. Nothing to report.",
  ],
};

// What this person would say to the owner today. Priority order matters: an exhausted worker
// who is also proud of their work should say the thing that needs acting on.
export function workerVoiceLine(worker = {}, game = {}) {
  const day = Number.isFinite(game.day) ? game.day : 0;
  const seed = `${worker.id || "w"}-${day}`;
  const stamina = Number.isFinite(worker.stamina) ? worker.stamina : 50;
  const mood = Number.isFinite(worker.mood) ? worker.mood : 70;
  const loyalty = Number.isFinite(worker.loyalty) ? worker.loyalty : 50;
  const assignment = describeWorkerAssignment(worker, game);

  if (stamina < 20) return pickStable(VOICE.exhausted, seed);
  if (mood < 25) return pickStable(VOICE.unhappy, seed);
  if (loyalty < 25) return pickStable(VOICE.flightRisk, seed);
  if (assignment.state === "idle") return pickStable(VOICE.idle, seed);
  if (loyalty >= 80 && (worker.jobsCompleted || 0) >= 5) return pickStable(VOICE.loyal, seed);
  if (mood >= 75 && (worker.jobsCompleted || 0) >= 1) return pickStable(VOICE.proud, seed);
  return pickStable(VOICE.neutral, seed);
}

// Tenure and track record — the numbers that turn a row into a person with a history at this
// company. `daysEmployed` is clamped at zero because a save migrated from a build without
// `hireDay` defaults it to the current day.
export function summarizeWorkerStanding(worker = {}, game = {}) {
  const day = Number.isFinite(game.day) ? game.day : 1;
  const hireDay = Number.isFinite(worker.hireDay) ? worker.hireDay : day;
  const daysEmployed = Math.max(0, day - hireDay);
  const jobs = Number.isFinite(worker.jobsCompleted) ? worker.jobsCompleted : 0;

  return {
    daysEmployed,
    jobs,
    tenureLabel:
      daysEmployed >= 365 ? `${Math.floor(daysEmployed / 365)}y with the company` :
      daysEmployed >= 30 ? `${Math.floor(daysEmployed / 30)}mo with the company` :
      daysEmployed <= 0 ? "Started today" :
      `${daysEmployed}d with the company`,
    rank:
      jobs >= 100 ? "Company legend" :
      jobs >= 50 ? "Senior hand" :
      jobs >= 25 ? "Experienced" :
      jobs >= 10 ? "Trusted" :
      jobs >= 1 ? "Getting established" :
      "New hire",
  };
}

// The trait's actual effects, as something readable. The screen was deriving this inline at
// the point of use, so the same trait could be described differently in two places.
export function describeTraitEffects(worker = {}) {
  const trait = worker.trait || {};
  const out = [];
  const pct = (v) => Math.round(Math.abs(v - 1) * 100);

  if ((trait.speed || 1) > 1.02) out.push({ label: `Speed +${pct(trait.speed)}%`, tone: "safe" });
  else if ((trait.speed || 1) < 0.98) out.push({ label: `Speed −${pct(trait.speed)}%`, tone: "hazard" });

  if ((trait.quality || 1) > 1.02) out.push({ label: `Quality +${pct(trait.quality)}%`, tone: "info" });
  else if ((trait.quality || 1) < 0.98) out.push({ label: `Quality −${pct(trait.quality)}%`, tone: "caution" });

  if ((trait.safety || 1) > 1.04) out.push({ label: `Safety +${pct(trait.safety)}%`, tone: "safe" });
  else if ((trait.safety || 1) < 0.96) out.push({ label: "Safety risk", tone: "caution" });

  if ((trait.wagePressure || 1) > 1.12) out.push({ label: "Wants more money", tone: "caution" });
  else if ((trait.wagePressure || 1) < 0.92) out.push({ label: "Cheap to keep", tone: "safe" });

  return out;
}

// ─── Machines ────────────────────────────────────────────────────────────────

// The question a player actually has about a machine, which the game had never answered: is
// this thing making me money, or am I paying to park it?
//
// `utilisation` is days on a site as a share of days owned. Everything else is derived from
// fields the simulation already maintains — nothing here changes what a machine does.
export function summarizeEquipmentEconomics(machine = {}, game = {}) {
  const day = Number.isFinite(game.day) ? game.day : 1;
  const purchaseDay = Number.isFinite(machine.purchaseDay) ? machine.purchaseDay : day;
  const daysOwned = Math.max(1, day - purchaseDay);
  const dailyCost = Number.isFinite(machine.dailyCost) ? machine.dailyCost : 0;
  const daysWorked = Number.isFinite(machine.daysWorked) ? machine.daysWorked : 0;
  const utilisation = Math.max(0, Math.min(100, Math.round((daysWorked / daysOwned) * 100)));

  const sites = Array.isArray(game.activeSites) ? game.activeSites : [];
  const site = sites.find((s) => Array.isArray(s?.assignedEquipmentIds) && s.assignedEquipmentIds.includes(machine.id));

  const condition = Number.isFinite(machine.condition) ? machine.condition : 100;
  const purchasePrice = Number.isFinite(machine.value) ? machine.value : 0;
  // Straight-line age depreciation against condition, floored so a wreck still has scrap
  // value. Deliberately conservative — this is an estimate shown to the player, not a
  // guaranteed sale price.
  const resaleEstimate = Math.max(
    Math.round(purchasePrice * 0.08),
    Math.round(purchasePrice * (condition / 100) * 0.55)
  );

  return {
    daysOwned,
    daysWorked,
    utilisation,
    dailyCost,
    lifetimeCost: dailyCost * daysOwned,
    onSite: Boolean(site),
    siteLabel: site ? site.label : null,
    status: machine.status || "Idle",
    condition,
    resaleEstimate,
    // The verdict, in the player's own terms.
    verdict:
      machine.status === "Maintenance" ? { tone: "hazard", label: "In the workshop", detail: "Costing you daily and earning nothing." } :
      site ? { tone: "safe", label: "Earning", detail: `On ${site.label}.` } :
      utilisation >= 60 ? { tone: "caution", label: "Idle today", detail: "Usually busy — put it back on a site." } :
      daysOwned >= 14 ? { tone: "hazard", label: "Underused", detail: `Worked ${utilisation}% of the days you have owned it.` } :
      { tone: "neutral", label: "Idle", detail: "Not long enough in the yard to judge." },
  };
}

// The fleet at a glance: what is working, what is parked, what is broken, and what the whole
// lot costs per day whether or not it turns a wheel.
export function summarizeFleet(game = {}) {
  const machines = Array.isArray(game.equipment) ? game.equipment : [];
  const sites = Array.isArray(game.activeSites) ? game.activeSites : [];
  const assignedIds = new Set(sites.flatMap((s) => (Array.isArray(s?.assignedEquipmentIds) ? s.assignedEquipmentIds : [])));

  let working = 0;
  let parked = 0;
  let workshop = 0;
  let dailyCost = 0;
  let conditionSum = 0;

  for (const m of machines) {
    if (!m) continue;
    dailyCost += Number.isFinite(m.dailyCost) ? m.dailyCost : 0;
    conditionSum += Number.isFinite(m.condition) ? m.condition : 100;
    if (m.status === "Maintenance" || m.status === "Broken") workshop++;
    else if (assignedIds.has(m.id)) working++;
    else parked++;
  }

  return {
    total: machines.length,
    working,
    parked,
    workshop,
    dailyCost,
    averageCondition: machines.length ? Math.round(conditionSum / machines.length) : 0,
    utilisation: machines.length ? Math.round((working / machines.length) * 100) : 0,
  };
}

// ─── While you were away ─────────────────────────────────────────────────────

// A snapshot of every running job, taken before offline catch-up runs. Diffed against the
// same shape afterwards to produce the report.
export function snapshotSites(game = {}) {
  const sites = Array.isArray(game.activeSites) ? game.activeSites : [];
  const out = {};
  for (const s of sites) {
    if (!s || !s.id) continue;
    out[s.id] = {
      id: s.id,
      label: s.label,
      phaseIndex: s.currentPhaseIdx || 0,
      phaseName: (Array.isArray(s.phases) ? s.phases : [])[s.currentPhaseIdx || 0] || null,
      percent: overallPercent(s),
      progressPaid: Number.isFinite(s.progressPaid) ? s.progressPaid : 0,
      phases: Array.isArray(s.phases) ? s.phases.length : 0,
      deliveriesPending: Array.isArray(s.pendingDeliveries) ? s.pendingDeliveries.length : 0,
    };
  }
  return out;
}

// Overall completion of a job, phases and part-phase together. Shared so the report and the
// site card can never disagree about how far along something is.
export function overallPercent(site = {}) {
  const phases = Array.isArray(site.phases) ? site.phases.length : 0;
  if (phases === 0) return 0;
  const idx = Number.isFinite(site.currentPhaseIdx) ? site.currentPhaseIdx : 0;
  const within = Math.max(0, Math.min(100, Number.isFinite(site.phaseProgress) ? site.phaseProgress : 0));
  return Math.max(0, Math.min(100, Math.round(((idx / phases) + (within / 100 / phases)) * 100)));
}

// The report itself: per job, what moved. This is the thing the audit's gap 29 was about —
// "cash +$8,200" is a bank statement, and the player's actual question is what happened to
// their job sites.
//
// A job that finished while the player was away will be absent from `after`, which is exactly
// how it is detected: it is reported as completed rather than silently vanishing.
export function buildOfflineSiteReport(beforeSnapshot = {}, afterGame = {}) {
  const after = snapshotSites(afterGame);
  const lines = [];

  for (const id of Object.keys(beforeSnapshot)) {
    const was = beforeSnapshot[id];
    const now = after[id];

    if (!now) {
      lines.push({
        id,
        label: was.label,
        kind: "completed",
        tone: "safe",
        headline: `${was.label} — finished`,
        detail: "Handed over while you were away.",
      });
      continue;
    }

    const movedPercent = now.percent - was.percent;
    const phasesDone = Math.max(0, now.phaseIndex - was.phaseIndex);
    const claimed = Math.max(0, now.progressPaid - was.progressPaid);

    // A job that did not move at all is worth saying so about — that is usually a stall the
    // player needs to fix, and silence would hide it.
    if (movedPercent <= 0 && phasesDone === 0) {
      lines.push({
        id,
        label: was.label,
        kind: "stalled",
        tone: "caution",
        headline: `${was.label} — no progress`,
        detail: now.deliveriesPending > 0
          ? "Waiting on a material delivery."
          : "Check crew, equipment and materials.",
        percentFrom: was.percent,
        percentTo: now.percent,
        claimed,
      });
      continue;
    }

    lines.push({
      id,
      label: was.label,
      kind: "progressed",
      tone: "safe",
      headline: was.phaseName && now.phaseName && was.phaseName !== now.phaseName
        ? `${was.label} — ${was.phaseName} → ${now.phaseName}`
        : `${was.label} — ${now.phaseName || "in progress"}`,
      detail: `${was.percent}% → ${now.percent}%${phasesDone > 0 ? ` · ${phasesDone} phase${phasesDone === 1 ? "" : "s"} complete` : ""}`,
      percentFrom: was.percent,
      percentTo: now.percent,
      phasesDone,
      claimed,
    });
  }

  // Jobs that started while away (the player cannot start one, but an event can).
  for (const id of Object.keys(after)) {
    if (beforeSnapshot[id]) continue;
    lines.push({
      id,
      label: after[id].label,
      kind: "started",
      tone: "info",
      headline: `${after[id].label} — started`,
      detail: "A new job opened while you were away.",
    });
  }

  return lines;
}
