// Owner events: choosing WHICH thing happens to you, and remembering that it did.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 10. The measured gap said FleetFlow has 104 owner events across 1,796 lines with
// categories, rarities, cooldowns, persistent consequences and multi-step chains, and
// Construction Flow has none. That was half right, and the wrong half was the important one.
//
// Construction Flow DOES have events — 19 decision events and 6 employee events, several of
// them good. What it does not have is any reason for them to land when they land:
//
//     const evt = pick(DECISION_EVENTS);
//
// A uniform draw over the whole catalog, every time. Three consequences, all of which read as
// bugs from the player's seat:
//
//   1. NO MEMORY OF ITSELF. The same event can fire twice in a row, and across a long game the
//      player sees the same nineteen scenarios on shuffle. FleetFlow gives every event its own
//      `cooldownDays` for exactly this.
//
//   2. NO AWARENESS OF THE COMPANY. The Angel Investor offers $120,000 against a $180,000
//      repayment whether you are down to your last $400 or sitting on five million. The rival
//      poach offers you a worker when your crew is already at cap. A scenario that does not fit
//      the company it is happening to is the clearest possible signal that nothing is really
//      being simulated.
//
//   3. NO WEIGHT. A once-in-a-company windfall draws exactly as often as a routine supplier
//      call, so nothing feels rare and nothing feels routine.
//
// This module is the selection layer that fixes all three. It deliberately does NOT own the
// event content: the scenarios keep living next to the code they mutate, because splitting an
// event's text from its `apply` across two files is how the halves drift apart.
//
// Everything here is pure. The only RNG is the draw itself, which is gameplay rather than
// presentation — the distinction FleetFlow's build 59 post-mortem drew, and the reason
// `pickStable` exists for the cosmetic cases.

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const EVENT_CATEGORIES = Object.freeze({
  PEOPLE: "people",
  MONEY: "money",
  RIVALS: "rivals",
  PLANT: "plant",
  CLIENT: "client",
  SITE: "site",
  REGULATOR: "regulator",
});

// Rare things must be rare. These are relative draw weights, not probabilities.
export const RARITY_WEIGHT = Object.freeze({
  common: 100,
  uncommon: 42,
  rare: 12,
});

export const DEFAULT_RARITY = "common";

// An event with no cooldown of its own still gets one. Zero would mean "may repeat tomorrow",
// which is the behaviour this module exists to remove, so the default is deliberately long
// enough to be felt.
export const DEFAULT_COOLDOWN_DAYS = 26;

// How many fired-event records the save keeps. An unbounded map would grow with the catalog
// rather than with play, but a cap keeps the shape honest alongside every other bounded
// structure in this save (logs, ledger, chronicle, inbox).
export const EVENT_HISTORY_CAP = 120;

function num(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

function dayOf(game) {
  return num(game?.day, 0);
}

function historyOf(game) {
  const h = game?.eventHistory;
  return h && typeof h === "object" && !Array.isArray(h) ? h : {};
}

// ─── Cooldowns ───────────────────────────────────────────────────────────────

export function lastFiredDay(game, eventId) {
  const day = historyOf(game)[eventId];
  return Number.isFinite(day) ? day : null;
}

export function cooldownFor(event) {
  const c = event?.cooldownDays;
  return Number.isFinite(c) && c >= 0 ? c : DEFAULT_COOLDOWN_DAYS;
}

export function cooldownRemaining(game, event) {
  const last = lastFiredDay(game, event?.id);
  if (last === null) return 0;
  const elapsed = dayOf(game) - last;
  return Math.max(0, cooldownFor(event) - elapsed);
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

// An event may declare `eligible(game)`. Anything that throws is treated as ineligible rather
// than crashing the tick: a bad predicate should cost the player one scenario, not their run.
export function isEligible(game, event) {
  if (!event || !event.id) return false;
  if (cooldownRemaining(game, event) > 0) return false;
  if (typeof event.eligible !== "function") return true;
  try {
    return Boolean(event.eligible(game));
  } catch (_e) {
    return false;
  }
}

export function eligibleEvents(game, catalog) {
  return (Array.isArray(catalog) ? catalog : []).filter((ev) => isEligible(game, ev));
}

// ─── Selection ───────────────────────────────────────────────────────────────

export function weightOf(event) {
  const w = RARITY_WEIGHT[event?.rarity];
  return Number.isFinite(w) ? w : RARITY_WEIGHT[DEFAULT_RARITY];
}

// Weighted draw over whatever is currently eligible. `rng` is injectable so tests can assert
// the distribution instead of hoping for it.
export function selectOwnerEvent(game, catalog, rng = Math.random) {
  const pool = eligibleEvents(game, catalog);
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, ev) => sum + weightOf(ev), 0);
  if (total <= 0) return pool[0];

  let roll = rng() * total;
  for (const ev of pool) {
    roll -= weightOf(ev);
    if (roll < 0) return ev;
  }
  // Floating-point tail: the last eligible event is the correct answer, not a failure.
  return pool[pool.length - 1];
}

// ─── Remembering ─────────────────────────────────────────────────────────────

export function recordEventFired(game, eventId) {
  if (!game || !eventId) return game;
  const history = { ...historyOf(game), [eventId]: dayOf(game) };

  const keys = Object.keys(history);
  if (keys.length > EVENT_HISTORY_CAP) {
    // Drop the oldest records first — they are the ones whose cooldowns have long since
    // expired, so forgetting them changes nothing the player can observe.
    keys
      .sort((a, b) => num(history[a]) - num(history[b]))
      .slice(0, keys.length - EVENT_HISTORY_CAP)
      .forEach((k) => delete history[k]);
  }

  game.eventHistory = history;
  return game;
}

// ─── Describing ──────────────────────────────────────────────────────────────

// Used by tests and by the dev-facing audit rather than the player UI: a catalog where nothing
// is eligible is a silent failure, and this is how it stops being silent.
export function describeEventPool(game, catalog) {
  const all = Array.isArray(catalog) ? catalog : [];
  const pool = eligibleEvents(game, catalog);
  const byRarity = {};
  for (const ev of pool) {
    const r = ev.rarity || DEFAULT_RARITY;
    byRarity[r] = (byRarity[r] || 0) + 1;
  }
  return {
    total: all.length,
    eligible: pool.length,
    onCooldown: all.filter((ev) => cooldownRemaining(game, ev) > 0).length,
    byRarity,
  };
}
