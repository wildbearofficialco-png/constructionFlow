// The living market: rival contractors that arrive, grow, struggle, fail and get bought.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Phase 4 of the FleetFlow parity work. FleetFlow shipped builds 58 and 59 specifically to
// fix a market that stopped living, and its changelog is a ready-made post-mortem. Reading
// Construction Flow's rival code against it found every one of those defects still present,
// plus three of its own:
//
//   1. THE MARKET DIES PERMANENTLY. `createRivals()` mints seven fixed companies and is only
//      ever called on a fresh save. Acquire or bankrupt them all and the board is empty
//      forever, with no way back. (FleetFlow's build 59 was reported by a player who had
//      bought all five of its competitors and found a permanently dead market.)
//   2. RIVAL NEWS CROWDS OUT THE PLAYER'S OWN. Rival chatter went through `addLog`, which
//      caps `logs` at 25 and `opsFeed` at 20 — the player's *own* operations feeds. A rival
//      buying a digger pushed the player's site events out of their own history.
//   3. TWO COMPETING BANKRUPTCY SYSTEMS shared one field with opposite meanings.
//      `enhancedRivalDailyLogic` had a lifecycle at the top of its loop using `bankruptDays`
//      as "days spent bankrupt", and a second one lower down ("Rival War: Feature 7") using
//      the same field as "days spent nearly bankrupt". The second system's recovery branch
//      was unreachable — the first one `continue`s past it for any bankrupt rival — and its
//      recovery wrote `rival.reputation`, a field nothing reads.
//   4. TWO COUNTERS FOR ONE THING. One capex path incremented `rival.equipCount`, another
//      incremented `rival.equipment`, and the UI read only `rival.equipment`. Half of every
//      rival's machine purchases were invisible.
//   5. ACQUISITIONS TRANSFERRED ALMOST NOTHING. Buying a company gave 1-3 *generic* workers
//      regardless of whether it employed 2 or 20, no equipment at all, and recorded nothing
//      in the ledger — so the reconciler saw cash it could not explain.
//
// Everything here is pure. The news builders are additionally RNG-FREE, which is the direct
// lesson of FleetFlow's build 59: its `pushNewsFeedItem` minted keys with `Math.random()`, so
// posting a cosmetic headline consumed a draw from the sequence the gated simulation
// behaviours read, and adding or removing a decorative line changed what the simulation did
// that day. Functions that genuinely roll take an injectable `rng` and say so in their name.

import { pickStable } from "./companyLife.js";

// ─── Lifecycle ───────────────────────────────────────────────────────────────

// One vocabulary, replacing four overlapping ways of saying the same thing
// (`status`, `bankrupt`, `bankruptDay`, `bankruptDays`).
export const RIVAL_STATUS = {
  ACTIVE: "Active",
  STRUGGLING: "Struggling",
  BANKRUPT: "Bankrupt",
};

// Days of sustained trouble before a company folds, and days under before it can restructure.
export const DAYS_TO_FAIL = 30;
export const DAYS_TO_RESTRUCTURE = 90;

// One valuation formula. It was computed inline, identically, in two different places — which
// is how the two bankruptcy systems came to disagree about when a company was in trouble.
export function rivalValuation(rivalRecord) {
  const rival = rivalRecord || {};
  const cash = Number.isFinite(rival.cash) ? rival.cash : 0;
  const rep = Number.isFinite(rival.rep) ? rival.rep : 0;
  const cities = Array.isArray(rival.cityPresence) ? rival.cityPresence.length : 1;
  return cash + rep * 50000 + Math.max(1, cities) * 100000;
}

export const FAILING_VALUATION = 10000;
export const FAILING_CASH = -15000;

// Whether this company is in trouble today. Separated from the transition logic so the news
// builders and the UI can ask the question without risking a state change.
export function isRivalFailing(rivalRecord) {
  const rival = rivalRecord || {};
  return rivalValuation(rival) < FAILING_VALUATION || (Number.isFinite(rival.cash) ? rival.cash : 0) < FAILING_CASH;
}

// The whole lifecycle, as one pure transition. Returns the fields to apply and the news to
// post, rather than mutating — so it can be tested exhaustively and cannot half-apply.
//
// `troubleDays` counts sustained trouble while trading, and is reused as days-under once the
// company has folded. That reuse is deliberate and single-meaning: it is always "days in the
// current state", and it resets on every transition.
export function stepRivalLifecycle(rivalRecord, { rng = Math.random } = {}) {
  const rival = rivalRecord || {};
  const status = rival.status === RIVAL_STATUS.BANKRUPT ? RIVAL_STATUS.BANKRUPT
    : rival.status === RIVAL_STATUS.STRUGGLING ? RIVAL_STATUS.STRUGGLING
    : RIVAL_STATUS.ACTIVE;
  const troubleDays = Number.isFinite(rival.troubleDays) ? rival.troubleDays : 0;

  if (status === RIVAL_STATUS.BANKRUPT) {
    const under = troubleDays + 1;
    if (under >= DAYS_TO_RESTRUCTURE) {
      return {
        changes: {
          status: RIVAL_STATUS.ACTIVE,
          troubleDays: 0,
          // Comes back smaller: a restructured firm is not the firm that failed.
          cash: Math.round(8000 + rng() * 12000),
          rep: Math.max(5, Math.round((Number.isFinite(rival.rep) ? rival.rep : 10) * 0.4)),
          activeJobs: 0,
        },
        news: { kind: "restructured", tone: "info" },
        trading: false,
      };
    }
    return { changes: { troubleDays: under }, news: null, trading: false };
  }

  if (isRivalFailing(rival)) {
    const days = troubleDays + 1;
    if (days >= DAYS_TO_FAIL) {
      return {
        changes: { status: RIVAL_STATUS.BANKRUPT, troubleDays: 0, activeJobs: 0 },
        news: { kind: "failed", tone: "hazard" },
        trading: false,
      };
    }
    return {
      changes: { status: RIVAL_STATUS.STRUGGLING, troubleDays: days },
      // An escalating line, so a company going under is visible *before* it becomes a
      // buyout opportunity rather than the player learning about it from its obituary.
      news: { kind: "declining", tone: "caution", daysStruggling: days },
      trading: true,
    };
  }

  // Trading normally. Clears any accumulated trouble.
  return {
    changes: status === RIVAL_STATUS.ACTIVE && troubleDays === 0
      ? {}
      : { status: RIVAL_STATUS.ACTIVE, troubleDays: 0 },
    news: status === RIVAL_STATUS.STRUGGLING ? { kind: "recovered", tone: "safe" } : null,
    trading: true,
  };
}

// ─── Market health and new entrants ──────────────────────────────────────────

// A company the player bought stays bought. This is the one thing FleetFlow's build 59 is
// explicit about: the buyout copy promises they are off the market permanently, so a
// respawn would make the game a liar.
export function isRivalOffTheBoard(rivalRecord, gameState) {
  const rival = rivalRecord || {};
  const game = gameState || {};
  return (game.acquiredRivals || []).includes(rival.id);
}

export function countLiveRivals(gameState) {
  const game = gameState || {};
  return (game.rivals || []).filter(
    (r) => r && r.status !== RIVAL_STATUS.BANKRUPT && !isRivalOffTheBoard(r, game)
  ).length;
}

// How thin the field has to get before anyone new bothers showing up, and how long between
// arrivals. An arrival is news, not a conveyor belt.
export const THIN_MARKET_THRESHOLD = 3;
export const ENTRANT_COOLDOWN_DAYS = 45;
export const ENTRANT_DAILY_CHANCE = 0.05;

export function isMarketThin(gameState) {
  return countLiveRivals(gameState) < THIN_MARKET_THRESHOLD;
}

// Gated on all three: a thin field, a cooldown since the last arrival, and a low daily roll.
export function shouldSpawnEntrant(gameState, rng = Math.random) {
  const game = gameState || {};
  if (!isMarketThin(game)) return false;
  const day = Number.isFinite(game.day) ? game.day : 1;
  const last = Number.isFinite(game.lastEntrantDay) ? game.lastEntrantDay : -Infinity;
  if (day - last < ENTRANT_COOLDOWN_DAYS) return false;
  return rng() < ENTRANT_DAILY_CHANCE;
}

// Entrants must carry their own seed AND their own identity on the record.
//
// This is the trap FleetFlow's build 59 calls out by name: its daily simulation begins with
// `AI_RIVALS_DEFS.find(...)` and returns early when there is no def, so a generated company
// without a seed would sit on the board forever — present, but never growing, struggling or
// dying. Construction Flow has exactly the same shape: `enhancedRivalBidding` looks up a
// `rivalPersonality[rival.id]` and `continue`s when there is none, so an entrant without a
// personality would never bid on anything. Entrants therefore carry `personality` on the
// record, and the lookups fall back to it.
export const ENTRANT_ARCHETYPES = [
  {
    key: "owner_operator",
    label: "owner-operator",
    aggression: 0.5,
    focus: "residential",
    personality: { focus: ["Residential"], focusBonus: 1.0, dailySkip: 0.5 },
    firstNames: ["Halvorsen", "Brody", "Kestrel", "Marsh", "Verano"],
    suffixes: ["Builders", "Contracting", "& Sons"],
  },
  {
    key: "concrete_specialist",
    label: "concrete specialist",
    aggression: 0.6,
    focus: "commercial",
    personality: { focus: ["Commercial"], focusBonus: 1.05 },
    firstNames: ["Granite", "Foundry", "Cinder", "Bedrock", "Keystone"],
    suffixes: ["Concrete", "Structures", "Works"],
  },
  {
    key: "civil_outfit",
    label: "civil outfit",
    aggression: 0.55,
    focus: "infrastructure",
    personality: { focus: ["Infrastructure"], focusBonus: 1.0, dailySkip: 0.6 },
    firstNames: ["Cascade", "Meridian", "Overland", "Tallgrass", "Riverbend"],
    suffixes: ["Civil", "Infrastructure", "Engineering"],
  },
  {
    key: "renovation_shop",
    label: "renovation shop",
    aggression: 0.45,
    focus: "residential",
    personality: { focus: ["Residential"], focusBonus: 0.9, dailySkip: 0.45 },
    firstNames: ["Fairhaven", "Willowick", "Thornbury", "Alder", "Haywood"],
    suffixes: ["Renovations", "Restoration", "Home Co."],
  },
];

// An entrant is never richer than the companies the game opens with, so clearing the board
// can't be punished with a stronger replacement. `rng` is injectable for tests.
export function createEntrant(gameState, rng = Math.random) {
  const game = gameState || {};
  const archetype = ENTRANT_ARCHETYPES[Math.floor(rng() * ENTRANT_ARCHETYPES.length)] || ENTRANT_ARCHETYPES[0];
  const first = archetype.firstNames[Math.floor(rng() * archetype.firstNames.length)] || archetype.firstNames[0];
  const suffix = archetype.suffixes[Math.floor(rng() * archetype.suffixes.length)] || archetype.suffixes[0];
  const day = Number.isFinite(game.day) ? game.day : 1;

  return {
    // Namespaced so an entrant id can never collide with an authored rival's.
    id: `entrant_${day}_${archetype.key}`,
    name: `${first} ${suffix}`,
    aggression: archetype.aggression,
    focus: archetype.focus,
    rep: Math.round(4 + rng() * 6),
    jobsCompleted: 0,
    activeJobs: 0,
    cash: Math.round(18000 + rng() * 14000),
    employees: 2,
    equipment: 1,
    status: RIVAL_STATUS.ACTIVE,
    troubleDays: 0,
    cityPresence: ["salem"],
    // Carried on the record, so the bidding and daily-sim lookups never come up empty.
    personality: archetype.personality,
    archetypeKey: archetype.key,
    archetypeLabel: archetype.label,
    isEntrant: true,
    joinedDay: day,
  };
}

// The personality lookup every rival behaviour should go through: authored companies get
// theirs from the table, entrants from their own record. Without this an entrant is inert.
export function getRivalPersonality(rivalRecord, table) {
  const rival = rivalRecord || {};
  return (table || {})[rival.id] || rival.personality || null;
}

// ─── Rival news, in its own feed ─────────────────────────────────────────────

export const MARKET_NEWS_CAP = 30;

// A separate feed from `logs` and `opsFeed`. Rival activity fires far more often than the
// player's own events, the ops log is capped at 20-25 entries, and it is about the *player's*
// operations — so rival chatter was pushing the player's own history out of it.
//
// The id is a monotonic counter rather than Math.random(), for exactly the reason FleetFlow's
// build 59 documents: a cosmetic headline must not consume a draw from the simulation's
// sequence. It is unique for the same reason and cannot perturb anything.
export function pushMarketNews(game, item) {
  if (!game || !item || !item.text) return game;
  if (!Array.isArray(game.marketNews)) game.marketNews = [];
  game._marketNewsSeq = (Number.isFinite(game._marketNewsSeq) ? game._marketNewsSeq : 0) + 1;
  game.marketNews = [
    {
      id: `mn-${game._marketNewsSeq}`,
      text: item.text,
      tone: item.tone || "neutral",
      day: Number.isFinite(game.day) ? game.day : 1,
      rivalId: item.rivalId || null,
    },
    ...game.marketNews,
  ].slice(0, MARKET_NEWS_CAP);
  return game;
}

// Growth narrated from movements the daily simulation ALREADY produced, rather than a second
// simulation running beside it. Every clause is derived from a real delta, so the line can
// never claim something that did not happen. Returns null when nothing moved — silence is
// correct when there is no news.
export function describeRivalGrowth(rivalRecord, movementRecord) {
  const rival = rivalRecord || {};
  const movements = movementRecord || {};
  const parts = [];
  const hired = Number.isFinite(movements.hired) ? movements.hired : 0;
  const machines = Number.isFinite(movements.machines) ? movements.machines : 0;
  const jobsWon = Number.isFinite(movements.jobsWon) ? movements.jobsWon : 0;
  const cityOpened = movements.cityOpened || null;

  if (cityOpened) parts.push(`opened a yard in ${cityOpened}`);
  if (machines > 0) parts.push(`added ${machines} machine${machines === 1 ? "" : "s"}`);
  if (hired > 0) parts.push(`hired ${hired} ${hired === 1 ? "worker" : "workers"}`);
  if (jobsWon > 0) parts.push(`picked up ${jobsWon} new job${jobsWon === 1 ? "" : "s"}`);

  if (parts.length === 0) return null;

  const sentence = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `🏗️ ${rival.name} ${sentence}.`;
}

// An escalating line per day of a slump, so a company going under is visible before it is a
// buyout opportunity. Deterministic: same company, same day of trouble, same line.
const DECLINE_LINES = {
  early: [
    "is losing money and missing bid deadlines",
    "has gone quiet — no new work in weeks",
  ],
  mid: [
    "parked part of its fleet and cut shifts",
    "is laying off crew and subletting its yard",
  ],
  late: [
    "is weeks from closing, with creditors circling",
    "has suppliers refusing to deliver without cash up front",
  ],
};

export function describeRivalDecline(rivalRecord, daysStruggling = 1) {
  const rival = rivalRecord || {};
  const days = Number.isFinite(daysStruggling) ? daysStruggling : 1;
  const stage = days >= DAYS_TO_FAIL * 0.66 ? "late" : days >= DAYS_TO_FAIL * 0.33 ? "mid" : "early";
  const line = pickStable(DECLINE_LINES[stage], `${rival.id || "r"}-${stage}`);
  return `📉 ${rival.name} ${line}.`;
}

// The other lifecycle headlines, kept here so every market line reads in one voice.
export function describeRivalLifecycleNews(rivalRecord, newsRecord) {
  const rival = rivalRecord || {};
  const news = newsRecord || {};
  switch (news.kind) {
    case "failed":
      return `📉 ${rival.name} has gone under. Its remaining work is up for grabs.`;
    case "restructured":
      return `📈 ${rival.name} has restructured and is bidding again — smaller than before.`;
    case "recovered":
      return `📊 ${rival.name} is trading normally again.`;
    case "declining":
      return describeRivalDecline(rival, news.daysStruggling);
    default:
      return null;
  }
}

export function describeEntrantArrival(rivalRecord) {
  const rival = rivalRecord || {};
  const label = rival.archetypeLabel ? ` — a ${rival.archetypeLabel}` : "";
  return `🆕 ${rival.name} has opened for business${label}, bidding on local work.`;
}

// ─── Acquisitions that transfer a real business ──────────────────────────────

// What buying this company actually hands over, computed once so the confirmation the player
// is shown and the transaction that runs are by construction the same thing. Returns
// DESCRIPTORS rather than records — the screen owns `createWorker`/`createEquipment` — so
// this stays pure and testable.
//
// Live and bankrupt are genuinely different deals, not just different prices: a trading firm
// is a going concern and hands over its people, plant and cash; a failed one's assets went to
// creditors before the player ever got there, so all that is left is whatever cash remains.
// That is what the cheap distressed price has always represented.
export const ACQUISITION_MIN_REPUTATION = 50;
export const ACQUISITION_COOLDOWN_DAYS = 30;
export const MAX_TRANSFERRED_CREW = 12;
export const MAX_TRANSFERRED_MACHINES = 6;

// Trades that match what the company actually built, so buying a residential firm gets you
// carpenters rather than a random draw.
const FOCUS_ROLES = {
  residential: ["Carpenter", "Labourer", "Plumber"],
  commercial: ["Concreter", "Steelworker", "Electrician"],
  infrastructure: ["Steelworker", "Concreter", "Labourer"],
};

export function acquisitionCost(rivalRecord) {
  const rival = rivalRecord || {};
  const rep = Number.isFinite(rival.rep) ? rival.rep : 0;
  const cash = Number.isFinite(rival.cash) ? rival.cash : 0;
  return Math.max(50000, Math.round(rep * 3000 + cash * 0.5));
}

// `gameState` is accepted but unused today. It is part of the signature so the confirmation
// dialog and the handler call this identically, and so client-relationship transfer can be
// added here later without changing every call site.
export function planAcquisition(rivalRecord, gameState) {
  const rival = rivalRecord || {};
  const bankrupt = rival.status === RIVAL_STATUS.BANKRUPT;
  const cost = acquisitionCost(rival);
  const rivalCash = Number.isFinite(rival.cash) ? rival.cash : 0;
  // Their reserves come over. A failed company's are what little is left.
  const cashTransferred = Math.max(0, Math.round(rivalCash * (bankrupt ? 0.35 : 0.7)));

  if (bankrupt) {
    return {
      rivalId: rival.id,
      rivalName: rival.name,
      bankrupt: true,
      cost,
      cashTransferred,
      crew: [],
      machines: 0,
      repGain: 2,
      creditGain: 3,
      summary: `${rival.name} has already folded — its plant and crew went to creditors. You are buying what cash is left and the name.`,
    };
  }

  const employees = Number.isFinite(rival.employees) ? rival.employees : 2;
  const machinesOwned = Number.isFinite(rival.equipment) ? rival.equipment : 1;
  const roles = FOCUS_ROLES[rival.focus] || FOCUS_ROLES.commercial;

  // Above the cap the remainder is sold off in the deal rather than dumped on the player as
  // individual records — which is what a real acquirer does with a workforce they have no
  // sites for, and keeps the save from ballooning.
  const crewCount = Math.max(1, Math.min(MAX_TRANSFERRED_CREW, employees));
  const crew = [];
  for (let i = 0; i < crewCount; i++) {
    crew.push({
      role: roles[i % roles.length],
      // Experienced enough to skip the new-hire curve, but they did not choose you.
      skill: 88 + ((i * 7) % 18),
      loyalty: 30,
      mood: 45,
    });
  }

  return {
    rivalId: rival.id,
    rivalName: rival.name,
    bankrupt: false,
    cost,
    cashTransferred,
    crew,
    crewSoldOff: Math.max(0, employees - crewCount),
    machines: Math.max(0, Math.min(MAX_TRANSFERRED_MACHINES, machinesOwned)),
    machinesSoldOff: Math.max(0, machinesOwned - Math.min(MAX_TRANSFERRED_MACHINES, machinesOwned)),
    repGain: 5,
    creditGain: 10,
    summary: `${rival.name} is a going concern: ${crewCount} crew, ${Math.min(MAX_TRANSFERRED_MACHINES, machinesOwned)} machine${machinesOwned === 1 ? "" : "s"} and ${cashTransferred > 0 ? "their cash reserves" : "no reserves"} transfer to you.`,
  };
}

// Why an acquisition cannot go ahead, or null when it can. Returned as a reason string so the
// button can say the actual blocker rather than being mysteriously inert.
export function acquisitionBlockReason(rivalRecord, gameState) {
  const rival = rivalRecord || {};
  const game = gameState || {};
  if (!rival.id) return "That company is no longer on the market.";
  if (isRivalOffTheBoard(rival, game)) return "You already own that company.";
  const rep = Number.isFinite(game.reputation) ? game.reputation : 0;
  if (rep < ACQUISITION_MIN_REPUTATION) {
    return `Reputation ${ACQUISITION_MIN_REPUTATION}+ required to acquire a company — you have ${Math.round(rep)}.`;
  }
  const day = Number.isFinite(game.day) ? game.day : 1;
  const since = day - (Number.isFinite(game.lastAcquisitionDay) ? game.lastAcquisitionDay : -Infinity);
  if (since < ACQUISITION_COOLDOWN_DAYS) {
    const wait = Math.ceil(ACQUISITION_COOLDOWN_DAYS - since);
    return `Another acquisition is ${wait} day${wait === 1 ? "" : "s"} away — deals this size take time to clear.`;
  }
  const cash = Number.isFinite(game.cash) ? game.cash : 0;
  const cost = acquisitionCost(rival);
  if (cash < cost) return `You need ${Math.round(cost - cash).toLocaleString()} more to close this deal.`;
  return null;
}
