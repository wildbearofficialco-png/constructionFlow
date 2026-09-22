// The Site Office inbox: the things that happened that you should know about.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 8. Audit row 11: "FleetFlow has an Executive Inbox with unresolved action items the
// player must Mark Handled, urgent items promoted to a red card. Construction Flow has
// `importantNotice` — one at a time."
//
// "One at a time" undersells it. The whole channel was a single field:
//
//   function addImportantNotice(state, message, tone) {
//     state.importantNotice = { id: Date.now(), message, tone };
//   }
//
// One hundred and two call sites, one slot. Three defects follow from that:
//
//   1. LOSS. Every call overwrites the last. Complete a job, break a machine and lose a bid in
//      the same tick and the player sees one of the three. The other two are destroyed before
//      they are ever drawn.
//
//   2. STALENESS. Nothing expires. A simulated run showed a day-3 "$100K Reserve milestone
//      reached!" banner still sitting at the top of Home on day 120 — 117 game-days later — for
//      the simple reason that nobody had tapped Dismiss. The most prominent card on the home
//      screen was a congratulation from four months ago.
//
//   3. COLLIDING IDS. `id: Date.now()` is millisecond resolution. Two notices raised in the same
//      millisecond — which is every notice raised in the same tick — share an id. Anything using
//      that id to key a list or to dedupe silently treats them as the same notice.
//
// This module replaces the slot with a small queue that keeps what matters, ages out what does
// not, and distinguishes a thing you should SEE from a thing you must DO.
//
// Everything is pure and RNG-free: presentation must never consume a Math.random() draw, the
// discipline FleetFlow's build 59 post-mortem established.

// ─── Shape ───────────────────────────────────────────────────────────────────

// Severity drives ordering and expiry. `action` items are the ones FleetFlow makes the player
// resolve: they do not age out on their own.
export const NOTICE_LEVELS = ["action", "urgent", "warning", "info", "good"];

// How many days a notice stays before it ages out. `action` is absent on purpose — an item that
// needs a decision waits for the decision.
export const NOTICE_TTL_DAYS = {
  urgent: 3,
  warning: 3,
  info: 2,
  good: 2,
};

// The queue is capped. A long game must not accumulate an unbounded list in the save, the same
// constraint Phase 4 put on market news and Phase 6 on the chronicle.
export const INBOX_CAP = 25;

// Tone names the old call sites pass, mapped to levels. Keeping the old vocabulary working means
// all 102 call sites keep their meaning without being individually rewritten and re-reviewed.
const TONE_TO_LEVEL = {
  red: "urgent",
  orange: "warning",
  green: "good",
  cyan: "info",
  blue: "info",
  neutral: "info",
  yellow: "warning",
};

export function levelForTone(tone) {
  return TONE_TO_LEVEL[tone] || "info";
}

const LEVEL_RANK = { action: 0, urgent: 1, warning: 2, info: 3, good: 4 };

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function dayOf(game) {
  return Number.isFinite(game?.day) ? game.day : 0;
}

// ─── Adding ──────────────────────────────────────────────────────────────────

// Ids must be unique per notice, not per millisecond. A monotonic counter carried on the game
// state does that without touching the RNG.
function nextNoticeId(game) {
  const n = Number.isFinite(game._noticeSeq) ? game._noticeSeq + 1 : 1;
  game._noticeSeq = n;
  return `n${n}`;
}

export function pushNotice(game, message, toneOrLevel = "info", options = {}) {
  if (!game || !message) return game;

  const level = NOTICE_LEVELS.includes(toneOrLevel) ? toneOrLevel : levelForTone(toneOrLevel);
  const day = dayOf(game);
  const inbox = arr(game.inbox);

  // Dedupe on identical text raised the same day. The tick can reach a notice site more than
  // once a day and an inbox that says the same thing twice reads as a bug.
  if (inbox.some((n) => n && n.message === message && n.day === day)) return game;

  const notice = {
    id: nextNoticeId(game),
    message: String(message),
    level,
    day,
    // An action item names what resolves it, so the card can offer a way to act rather than a
    // dismiss button that hides the problem.
    actionLabel: options.actionLabel ? String(options.actionLabel) : null,
    actionTab: options.actionTab ? String(options.actionTab) : null,
    read: false,
  };

  game.inbox = [notice, ...inbox].slice(0, INBOX_CAP);
  return game;
}

// ─── Ageing ──────────────────────────────────────────────────────────────────

// Drops notices past their time to live. Action items never expire; they are waiting on the
// player, and silently removing a thing the player still has to do is how a game loses their
// trust.
export function expireNotices(game) {
  if (!game) return game;
  const day = dayOf(game);
  game.inbox = arr(game.inbox).filter((n) => {
    if (!n) return false;
    if (n.level === "action") return true;
    const ttl = NOTICE_TTL_DAYS[n.level];
    if (!Number.isFinite(ttl)) return true;
    return day - (Number.isFinite(n.day) ? n.day : day) < ttl;
  });
  return game;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

// Most important first, then newest. An urgent notice from yesterday outranks a congratulation
// from this morning.
export function sortedNotices(game) {
  return [...arr(game?.inbox)].filter(Boolean).sort((a, b) => {
    const rank = (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9);
    if (rank !== 0) return rank;
    return (b.day || 0) - (a.day || 0);
  });
}

// The single notice that deserves the top of the screen, or null when the inbox is empty. This
// is what replaces the old one-slot banner — the difference being that everything else is still
// in the inbox rather than destroyed.
export function topNotice(game) {
  const sorted = sortedNotices(game);
  return sorted.length > 0 ? sorted[0] : null;
}

export function unreadCount(game) {
  return arr(game?.inbox).filter((n) => n && !n.read).length;
}

export function actionCount(game) {
  return arr(game?.inbox).filter((n) => n && n.level === "action").length;
}

export function dismissNotice(game, id) {
  if (!game) return game;
  game.inbox = arr(game.inbox).filter((n) => n && n.id !== id);
  return game;
}

export function markAllRead(game) {
  if (!game) return game;
  game.inbox = arr(game.inbox).map((n) => (n ? { ...n, read: true } : n));
  return game;
}

export function clearInbox(game) {
  if (!game) return game;
  // Action items survive "clear": they are the ones still waiting on a decision.
  game.inbox = arr(game.inbox).filter((n) => n && n.level === "action");
  return game;
}

// ─── Describing ──────────────────────────────────────────────────────────────

export function describeNoticeAge(noticeDay, currentDay) {
  const from = Number.isFinite(noticeDay) ? noticeDay : 0;
  const now = Number.isFinite(currentDay) ? currentDay : from;
  const age = Math.max(0, now - from);
  if (age === 0) return "today";
  if (age === 1) return "yesterday";
  return `${age} days ago`;
}

// A one-line read on the inbox for the header chip.
export function summarizeInbox(game) {
  const notices = sortedNotices(game);
  const actions = notices.filter((n) => n.level === "action").length;
  const urgent = notices.filter((n) => n.level === "urgent").length;

  if (notices.length === 0) {
    return { count: 0, actions, urgent, headline: "Nothing needs you", level: "info" };
  }
  if (actions > 0) {
    return {
      count: notices.length, actions, urgent, level: "action",
      headline: `${actions} thing${actions === 1 ? "" : "s"} need${actions === 1 ? "s" : ""} a decision`,
    };
  }
  if (urgent > 0) {
    return {
      count: notices.length, actions, urgent, level: "urgent",
      headline: `${urgent} urgent update${urgent === 1 ? "" : "s"}`,
    };
  }
  return {
    count: notices.length, actions, urgent, level: notices[0].level,
    headline: `${notices.length} update${notices.length === 1 ? "" : "s"}`,
  };
}

// The tone vocabulary the UI primitives use, per level.
export function noticeTone(level) {
  switch (level) {
    case "action": return "accent";
    case "urgent": return "hazard";
    case "warning": return "caution";
    case "good": return "success";
    default: return "info";
  }
}
