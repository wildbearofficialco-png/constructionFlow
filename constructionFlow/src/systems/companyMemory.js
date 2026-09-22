// Company memory: the history your company accumulates, and what it costs you later.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Phase 6 of the FleetFlow parity work. Audit row 23, the one gap the earlier phases never
// touched:
//
//   "FleetFlow's events REMEMBER. A decision made on day 20 can be referenced on day 60.
//    Construction Flow's chains are per-site and short-lived, so the world doesn't
//    accumulate a history."
//
// That was exactly right, and grep confirms it. Construction Flow's only event history is
// `site.chaosHistory` — capped at 10 entries, scoped to one job site, and destroyed when that
// site completes. Nothing survives a finished project. A player on day 200 has a company with
// no past: the same events fire, worded the same way, referencing nothing they ever did.
//
// This module gives the company a durable memory, and — this is the part that matters — makes
// that memory COST AND PAY SOMETHING. Phase 5's lesson was that a game which advertises an
// effect and delivers nothing is worse than one that never advertised it. So every memory kind
// declared here feeds a modifier in `resolveMemoryEffects`, every modifier is consumed by the
// running game, and `companyMemory.test.js` walks both directions and fails if either side
// goes unclaimed.
//
// The design rule: YOUR HISTORY HELPS YOU AND HAUNTS YOU. Memory that only ever granted bonuses
// would just be a second perk ladder. Stiffing a supplier saves cash today and costs you
// goodwill for the rest of the run. Buying out a rival wins you the market and earns you a
// grudge from the survivors. That two-sidedness is what makes a remembered decision feel like a
// decision rather than a reward.
//
// Everything here is pure. Nothing in this module consumes a Math.random() draw — the RNG
// discipline FleetFlow's build 59 post-mortem established, because the simulation's gated
// behaviours read the same sequence and presentation must never perturb it. Variety in the
// recalled wording comes from `pickStable`, a hash of state that is already there.

import { pickStable } from "./companyLife.js";

// ─── What a company can remember ─────────────────────────────────────────────

// Every memory carries a `kind`. A kind that no effect reads, or an effect that no kind feeds,
// is the Phase 5 defect in a new costume, so both directions are tested.
export const MEMORY_KINDS = [
  "supplier",  // how you have treated the people who sell you materials
  "crew",      // how you have treated the people who work for you
  "rivalry",   // what you have done to the other firms in the market
  "client",    // how you have treated the people who pay you
  "triumph",   // jobs finished early, marquee work delivered
  "setback",   // jobs blown, inspections failed, penalties eaten
];

// The chronicle is capped. A save that grows without bound is a problem earlier phases already
// fought — Phase 4 capped market news at 30 for the same reason. 60 entries is roughly a year
// of notable moments at the rate these are recorded.
export const MEMORY_CAP = 60;

// How long a memory keeps moving the numbers. Older entries stay in the chronicle for the
// player to read, but stop applying — a grudge from 300 days ago should not still be pricing
// your concrete.
export const MEMORY_POTENCY_DAYS = 120;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function dayOf(game) {
  return Number.isFinite(game?.day) ? game.day : 0;
}

// ─── Recording ───────────────────────────────────────────────────────────────

// Appends a memory. Returns the game for convenience.
//
// Deduped on `tag` + `day`, because the daily tick can reach a recording site more than once in
// a day (a contract can complete and a client can react in the same tick) and a chronicle that
// says the same thing twice on one day reads like a bug to the player.
export function recordMemory(game, entry) {
  if (!game || !entry || !entry.tag) return game;
  const kind = MEMORY_KINDS.includes(entry.kind) ? entry.kind : "triumph";
  const day = Number.isFinite(entry.day) ? entry.day : dayOf(game);

  const existing = asArray(game.companyMemory);
  if (existing.some((m) => m && m.tag === entry.tag && m.day === day)) return game;

  const record = {
    tag: String(entry.tag),
    kind,
    day,
    label: String(entry.label || entry.tag),
    detail: entry.detail ? String(entry.detail) : "",
    // `weight` is how much this moment counts, 1 being ordinary. A first job and a
    // hundred-million-dollar tower should not echo equally.
    weight: Number.isFinite(entry.weight) ? Math.max(0.25, Math.min(4, entry.weight)) : 1,
    // Positive memories help, negative ones haunt. Neutral (0) is recorded for the chronicle
    // but moves nothing.
    valence: entry.valence === "bad" ? "bad" : entry.valence === "neutral" ? "neutral" : "good",
    subject: entry.subject ? String(entry.subject) : "",
  };

  game.companyMemory = [record, ...existing].slice(0, MEMORY_CAP);
  return game;
}

// ─── Recall ──────────────────────────────────────────────────────────────────

export function recallMemory(game, filter = {}) {
  const now = dayOf(game);
  return asArray(game?.companyMemory).filter((m) => {
    if (!m) return false;
    if (filter.tag && m.tag !== filter.tag) return false;
    if (filter.kind && m.kind !== filter.kind) return false;
    if (filter.valence && m.valence !== filter.valence) return false;
    if (filter.subject && m.subject !== filter.subject) return false;
    if (Number.isFinite(filter.withinDays) && now - m.day > filter.withinDays) return false;
    if (Number.isFinite(filter.olderThanDays) && now - m.day <= filter.olderThanDays) return false;
    return true;
  });
}

export function hasMemory(game, tag) {
  return recallMemory(game, { tag }).length > 0;
}

// The single most recent memory matching a filter, or null.
export function lastMemory(game, filter = {}) {
  const hits = recallMemory(game, filter);
  return hits.length > 0 ? hits[0] : null;
}

// ─── Effects ─────────────────────────────────────────────────────────────────

// Every key here must be consumed by the running game. `companyMemory.test.js` asserts it, and
// `companyMemoryIntegration.test.js` proves each one actually moves a number in play.
export const MEMORY_EFFECT_KEYS = [
  "bidEdge",           // + to bid win chance, from a reputation built on delivered work
  "supplierGoodwill",  // + to material discount, from dealing straight with suppliers
  "crewLoyalty",       // − to the chance a worker quits, from looking after people
  "rivalGrudge",       // − to bid win chance, from what you did to the competition
];

// Caps. A long run accumulates a lot of history, and without these a day-400 company would be
// unbeatable or unplayable. Strong, never absolute — the same rule Phase 5 set for perks.
export const MAX_BID_EDGE = 0.10;
export const MAX_SUPPLIER_GOODWILL = 0.10;
export const MAX_CREW_LOYALTY = 0.50;
export const MAX_RIVAL_GRUDGE = 0.12;

// A memory's contribution decays linearly to nothing over MEMORY_POTENCY_DAYS.
function potency(memory, now) {
  const age = now - (Number.isFinite(memory?.day) ? memory.day : 0);
  if (age < 0 || age >= MEMORY_POTENCY_DAYS) return 0;
  return (1 - age / MEMORY_POTENCY_DAYS) * (Number.isFinite(memory.weight) ? memory.weight : 1);
}

function accumulate(game, kind, valence) {
  const now = dayOf(game);
  return recallMemory(game, { kind, valence }).reduce((total, m) => total + potency(m, now), 0);
}

// Turns everything the company has done into four numbers the game reads. One resolver, one
// place — the structure Phase 5 introduced so an effect cannot be declared here and forgotten
// everywhere else.
export function resolveMemoryEffects(gameState) {
  const game = gameState || {};

  // Delivered work and pleased clients make you a safer bet; blown jobs make you a riskier one.
  const good = accumulate(game, "triumph", "good") + accumulate(game, "client", "good");
  const bad = accumulate(game, "setback", "bad") + accumulate(game, "client", "bad");
  const bidEdge = Math.max(
    -MAX_BID_EDGE,
    Math.min(MAX_BID_EDGE, (good - bad) * 0.012)
  );

  const supplierGood = accumulate(game, "supplier", "good");
  const supplierBad = accumulate(game, "supplier", "bad");
  const supplierGoodwill = Math.max(
    -MAX_SUPPLIER_GOODWILL,
    Math.min(MAX_SUPPLIER_GOODWILL, (supplierGood - supplierBad) * 0.015)
  );

  const crewGood = accumulate(game, "crew", "good");
  const crewBad = accumulate(game, "crew", "bad");
  const crewLoyalty = Math.max(
    -MAX_CREW_LOYALTY,
    Math.min(MAX_CREW_LOYALTY, (crewGood - crewBad) * 0.06)
  );

  // Only the bad half of rivalry is a grudge. Beating the market is its own reward; what it
  // buys you here is enemies.
  const rivalGrudge = Math.min(MAX_RIVAL_GRUDGE, accumulate(game, "rivalry", "bad") * 0.02);

  return { bidEdge, supplierGoodwill, crewLoyalty, rivalGrudge };
}

// ─── Telling the player about it ─────────────────────────────────────────────

// "yesterday" / "three weeks ago" / "on day 12". A remembered moment has to be placed in time
// or the callback reads as a non-sequitur.
export function describeMemoryAge(memoryDay, currentDay) {
  const from = Number.isFinite(memoryDay) ? memoryDay : 0;
  const now = Number.isFinite(currentDay) ? currentDay : from;
  const age = Math.max(0, now - from);
  if (age === 0) return "today";
  if (age === 1) return "yesterday";
  if (age < 7) return `${age} days ago`;
  if (age < 14) return "last week";
  if (age < 60) return `${Math.round(age / 7)} weeks ago`;
  return `back on day ${from}`;
}

// The chronicle, newest first, ready to render. Presentation only — no RNG, so building this
// can never perturb the simulation.
export function summarizeCompanyStory(gameState, limit = 8) {
  const game = gameState || {};
  const now = dayOf(game);
  return recallMemory(game).slice(0, Math.max(0, limit)).map((m) => ({
    key: `${m.tag}-${m.day}`,
    label: m.label,
    detail: m.detail,
    kind: m.kind,
    valence: m.valence,
    when: describeMemoryAge(m.day, now),
    stillCounts: potency(m, now) > 0,
  }));
}

// A one-line read on where the company's history has left it, for the top of the story card.
export function describeStanding(gameState) {
  const effects = resolveMemoryEffects(gameState);
  const notes = [];
  if (effects.bidEdge >= 0.01) notes.push("Your record wins you work");
  else if (effects.bidEdge <= -0.01) notes.push("Your record costs you work");
  if (effects.supplierGoodwill >= 0.01) notes.push("suppliers deal straight with you");
  else if (effects.supplierGoodwill <= -0.01) notes.push("suppliers have stopped doing you favours");
  if (effects.crewLoyalty >= 0.05) notes.push("your crews stay");
  else if (effects.crewLoyalty <= -0.05) notes.push("word has got round about how you treat people");
  if (effects.rivalGrudge >= 0.02) notes.push("rivals bid against you personally");

  if (notes.length === 0) return "Your company has no reputation yet — only a start date.";
  const joined = notes.join(" · ");
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

// ─── Callbacks: events that reference what you did ───────────────────────────

// A callback fires only when the memory it refers to exists. This is the whole point of the
// module: on day 60 the game can say "the supplier you stiffed in week three is not returning
// your calls" — and mean it, because that memory is on file and is currently pricing your
// materials.
//
// Each entry declares the memory it needs. The screen builds a real decision from it, so these
// are data, not prose: `build(memory, game)` returns the title/desc/option text, and the
// consequences are applied by the screen through the normal decision path.
export const MEMORY_CALLBACKS = [
  {
    id: "supplier_grudge_callback",
    requires: { kind: "supplier", valence: "bad", olderThanDays: 10 },
    tone: "orange",
    build: (memory, game) => ({
      title: "📦 An Old Account",
      desc: `Your materials rep remembers ${describeMemoryAge(memory.day, dayOf(game))}: ${memory.detail || memory.label}. ` +
        `They will keep supplying you — at a price that reflects the history.`,
    }),
  },
  {
    id: "supplier_trust_callback",
    requires: { kind: "supplier", valence: "good", olderThanDays: 10 },
    tone: "green",
    build: (memory, game) => ({
      title: "📦 A Standing Account",
      desc: `Your materials rep has not forgotten ${describeMemoryAge(memory.day, dayOf(game))}: ${memory.detail || memory.label}. ` +
        `They are offering you terms they do not offer everyone.`,
    }),
  },
  {
    id: "crew_loyalty_callback",
    requires: { kind: "crew", valence: "good", olderThanDays: 14 },
    tone: "cyan",
    build: (memory, game) => ({
      title: "👷 They Remember",
      desc: `${memory.subject || "One of your crew"} still talks about ${describeMemoryAge(memory.day, dayOf(game))}: ${memory.detail || memory.label}. ` +
        `A rival made them an offer this week and they turned it down without telling you.`,
    }),
  },
  {
    id: "rival_grudge_callback",
    requires: { kind: "rivalry", valence: "bad", olderThanDays: 20 },
    tone: "red",
    build: (memory, game) => ({
      title: "🎯 Personal",
      desc: `${memory.subject || "A rival"} has not let go of what happened ${describeMemoryAge(memory.day, dayOf(game))}: ${memory.detail || memory.label}. ` +
        `They are underbidding you on principle now, not on margin.`,
    }),
  },
  {
    id: "client_return_callback",
    requires: { kind: "client", valence: "good", olderThanDays: 14 },
    tone: "green",
    build: (memory, game) => ({
      title: "🤝 They Came Back",
      desc: `${memory.subject || "A client"} remembers ${describeMemoryAge(memory.day, dayOf(game))}: ${memory.detail || memory.label}. ` +
        `They are bringing you their next project before it goes out to tender.`,
    }),
  },
];

// Picks a callback the company's history actually supports. Returns null when the company has
// not yet done anything worth referring back to — a new player should never be told the world
// remembers something that never happened.
//
// RNG-free: which callback fires is a stable hash of the company's own state, so building this
// cannot shift the sequence the simulation reads.
export function pickMemoryCallback(gameState) {
  const game = gameState || {};
  const available = [];
  for (const callback of MEMORY_CALLBACKS) {
    const memory = lastMemory(game, callback.requires);
    if (memory) available.push({ callback, memory });
  }
  if (available.length === 0) return null;

  const seed = `${dayOf(game)}-${asArray(game.companyMemory).length}-${available.length}`;
  const chosen = pickStable(available, seed);
  if (!chosen) return null;

  return {
    id: chosen.callback.id,
    tone: chosen.callback.tone,
    memory: chosen.memory,
    ...chosen.callback.build(chosen.memory, game),
  };
}
