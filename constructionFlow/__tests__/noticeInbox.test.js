// The Site Office inbox.
//
// Audit row 11. What it replaced was a single field behind 102 call sites:
//
//   state.importantNotice = { id: Date.now(), message, tone };
//
// Three defects followed, and each has a test here:
//   LOSS — every call overwrote the last, so two notices in one tick meant one was destroyed.
//   STALENESS — nothing expired. A simulated 120-day run left a day-3 milestone on screen.
//   COLLIDING IDS — Date.now() is millisecond resolution; same-tick notices shared an id.

import {
  NOTICE_LEVELS, NOTICE_TTL_DAYS, INBOX_CAP,
  levelForTone, pushNotice, expireNotices, sortedNotices, topNotice,
  unreadCount, actionCount, dismissNotice, markAllRead, clearInbox,
  describeNoticeAge, summarizeInbox, noticeTone,
} from "../src/systems/noticeInbox.js";

const g = (over = {}) => ({ day: 10, inbox: [], _noticeSeq: 0, ...over });

describe("nothing raised is lost", () => {
  test("three notices in the same tick all survive", () => {
    const s = g();
    pushNotice(s, "Job complete", "green");
    pushNotice(s, "Excavator broke down", "red");
    pushNotice(s, "Bid lost", "orange");
    expect(s.inbox).toHaveLength(3);
    expect(s.inbox.map((n) => n.message)).toContain("Job complete");
    expect(s.inbox.map((n) => n.message)).toContain("Excavator broke down");
  });

  test("ids are unique even when everything happens in the same millisecond", () => {
    // The exact failure of `id: Date.now()`.
    const s = g();
    for (let i = 0; i < 25; i++) pushNotice(s, `Notice ${i}`, "info");
    const ids = s.inbox.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the same message twice in one day is recorded once", () => {
    const s = g();
    pushNotice(s, "Materials delivered", "green");
    pushNotice(s, "Materials delivered", "green");
    expect(s.inbox).toHaveLength(1);
  });

  test("the same message on a later day is a separate notice", () => {
    const s = g();
    pushNotice(s, "Late penalty applied", "red");
    s.day = 12;
    pushNotice(s, "Late penalty applied", "red");
    expect(s.inbox).toHaveLength(2);
  });

  test("the queue is capped so a long game cannot balloon the save", () => {
    const s = g();
    for (let i = 0; i < INBOX_CAP * 3; i++) { s.day = i; pushNotice(s, `m${i}`, "info"); }
    expect(s.inbox.length).toBe(INBOX_CAP);
  });

  test("junk never enters the queue", () => {
    const s = g();
    pushNotice(s, "", "green");
    pushNotice(s, null, "green");
    pushNotice(null, "x", "green");
    expect(s.inbox).toHaveLength(0);
  });
});

describe("nothing goes stale", () => {
  test("a congratulation from four months ago is gone", () => {
    // The exact observed defect: a day-3 milestone still on screen at day 120.
    const s = g({ day: 3 });
    pushNotice(s, '🏆 "$100K Reserve" milestone reached!', "green");
    s.day = 120;
    expireNotices(s);
    expect(s.inbox).toHaveLength(0);
  });

  test("each level ages out on its own schedule", () => {
    for (const level of Object.keys(NOTICE_TTL_DAYS)) {
      const s = g({ day: 0 });
      pushNotice(s, `a ${level} thing`, level);
      s.day = NOTICE_TTL_DAYS[level] - 1;
      expireNotices(s);
      expect({ level, kept: s.inbox.length }).toEqual({ level, kept: 1 });
      s.day = NOTICE_TTL_DAYS[level];
      expireNotices(s);
      expect({ level, gone: s.inbox.length }).toEqual({ level, gone: 0 });
    }
  });

  test("a decision the player still has to make NEVER expires", () => {
    // Silently removing something the player still owes a decision on is how a game loses
    // their trust.
    const s = g({ day: 1 });
    pushNotice(s, "Choose a settlement", "action");
    s.day = 900;
    expireNotices(s);
    expect(s.inbox).toHaveLength(1);
  });

  test("Clear all keeps the decisions", () => {
    const s = g();
    pushNotice(s, "fyi", "green");
    pushNotice(s, "decide this", "action");
    clearInbox(s);
    expect(s.inbox).toHaveLength(1);
    expect(s.inbox[0].level).toBe("action");
  });
});

describe("the most important thing leads", () => {
  test("a decision outranks an urgent item, which outranks good news", () => {
    const s = g();
    pushNotice(s, "nice", "green");
    pushNotice(s, "bad", "red");
    pushNotice(s, "decide", "action");
    expect(topNotice(s).message).toBe("decide");
    expect(sortedNotices(s).map((n) => n.level)).toEqual(["action", "urgent", "good"]);
  });

  test("within a level, newest first", () => {
    const s = g({ day: 1 });
    pushNotice(s, "older", "red");
    s.day = 5;
    pushNotice(s, "newer", "red");
    expect(topNotice(s).message).toBe("newer");
  });

  test("an empty inbox has no top item, rather than an empty card", () => {
    expect(topNotice(g())).toBeNull();
    expect(topNotice({})).toBeNull();
    expect(sortedNotices(undefined)).toEqual([]);
  });

  test("every tone the 102 call sites pass maps to a real level", () => {
    for (const tone of ["green", "red", "orange", "neutral", "cyan", "blue", "yellow"]) {
      expect(NOTICE_LEVELS).toContain(levelForTone(tone));
    }
    // An unknown tone degrades to info rather than breaking the sort.
    expect(levelForTone("chartreuse")).toBe("info");
  });

  test("every level has a tone the UI can render", () => {
    for (const level of NOTICE_LEVELS) {
      expect(typeof noticeTone(level)).toBe("string");
      expect(noticeTone(level).length).toBeGreaterThan(0);
    }
  });
});

describe("counts and summary", () => {
  test("unread and action counts are separate things", () => {
    const s = g();
    pushNotice(s, "a", "green");
    pushNotice(s, "b", "action");
    expect(unreadCount(s)).toBe(2);
    expect(actionCount(s)).toBe(1);
    markAllRead(s);
    expect(unreadCount(s)).toBe(0);
    expect(actionCount(s)).toBe(1);
  });

  test("dismissing removes exactly one", () => {
    const s = g();
    pushNotice(s, "a", "green");
    pushNotice(s, "b", "red");
    const id = s.inbox[0].id;
    dismissNotice(s, id);
    expect(s.inbox).toHaveLength(1);
    expect(s.inbox[0].id).not.toBe(id);
  });

  test("the summary leads with decisions, then urgency, then volume", () => {
    const empty = summarizeInbox(g());
    expect(empty.count).toBe(0);
    expect(empty.headline).toContain("Nothing needs you");

    const a = g(); pushNotice(a, "x", "action");
    expect(summarizeInbox(a).headline).toContain("decision");

    const u = g(); pushNotice(u, "x", "red");
    expect(summarizeInbox(u).headline).toContain("urgent");

    const i = g(); pushNotice(i, "x", "green");
    expect(summarizeInbox(i).headline).toContain("update");
  });

  test("singular and plural read correctly", () => {
    const one = g(); pushNotice(one, "x", "action");
    expect(summarizeInbox(one).headline).toBe("1 thing needs a decision");
    const two = g(); pushNotice(two, "x", "action"); pushNotice(two, "y", "action");
    expect(summarizeInbox(two).headline).toBe("2 things need a decision");
  });

  test("ages read naturally", () => {
    expect(describeNoticeAge(10, 10)).toBe("today");
    expect(describeNoticeAge(9, 10)).toBe("yesterday");
    expect(describeNoticeAge(4, 10)).toBe("6 days ago");
  });

  test("a corrupted inbox never throws", () => {
    const junk = { day: 5, inbox: "nope" };
    expect(() => sortedNotices(junk)).not.toThrow();
    expect(() => expireNotices(junk)).not.toThrow();
    expect(() => summarizeInbox(junk)).not.toThrow();
    expect(sortedNotices(junk)).toEqual([]);
  });
});
