// Company memory — the module that gives the world a past.
//
// Audit row 23 was the one gap Phases 1-5 never touched: "FleetFlow's events REMEMBER. A
// decision made on day 20 can be referenced on day 60. Construction Flow's chains are per-site
// and short-lived, so the world doesn't accumulate a history."
//
// These tests prove the recall, the decay, the caps, and — the Phase 5 lesson applied — that
// every effect this module declares is one the game actually reads.

import fs from "fs";
import path from "path";

import {
  MEMORY_KINDS,
  MEMORY_CAP,
  MEMORY_POTENCY_DAYS,
  MEMORY_EFFECT_KEYS,
  MAX_BID_EDGE,
  MAX_SUPPLIER_GOODWILL,
  MAX_CREW_LOYALTY,
  MAX_RIVAL_GRUDGE,
  MEMORY_CALLBACKS,
  recordMemory,
  recallMemory,
  hasMemory,
  lastMemory,
  resolveMemoryEffects,
  describeMemoryAge,
  summarizeCompanyStory,
  describeStanding,
  pickMemoryCallback,
} from "../src/systems/companyMemory.js";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const SCREEN_CODE = fs.readFileSync(SCREEN_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

function gameWith(memories, day = 100) {
  return { day, companyMemory: memories };
}

function mem(over = {}) {
  return {
    tag: "t", kind: "triumph", day: 100, label: "L", detail: "D", weight: 1, valence: "good", subject: "",
    ...over,
  };
}

describe("EVERY DECLARED EFFECT IS CONSUMED BY THE GAME", () => {
  // The Phase 5 defect in a new costume would be an effect resolved here and read nowhere.
  // This walks the declared keys and fails if one is not wired into the screen.
  test.each(MEMORY_EFFECT_KEYS)("the screen reads %s", (key) => {
    expect(SCREEN_CODE).toContain(key);
  });

  test("resolveMemoryEffects returns exactly the declared keys — no extras, none missing", () => {
    const keys = Object.keys(resolveMemoryEffects({})).sort();
    expect(keys).toEqual([...MEMORY_EFFECT_KEYS].sort());
  });

  test("every memory kind feeds at least one effect", () => {
    // A kind nothing reads is a kind that should not exist.
    for (const kind of MEMORY_KINDS) {
      const good = resolveMemoryEffects(gameWith([mem({ kind, valence: "good", weight: 4 })]));
      const bad = resolveMemoryEffects(gameWith([mem({ kind, valence: "bad", weight: 4 })]));
      const moved = MEMORY_EFFECT_KEYS.some((k) => good[k] !== 0 || bad[k] !== 0);
      expect({ kind, moved }).toEqual({ kind, moved: true });
    }
  });
});

describe("recording", () => {
  test("a memory is stored and can be recalled by tag", () => {
    const g = recordMemory({ day: 12 }, { tag: "stiffed_supplier", kind: "supplier", valence: "bad", label: "Walked away from a bulk order" });
    expect(hasMemory(g, "stiffed_supplier")).toBe(true);
    expect(recallMemory(g, { tag: "stiffed_supplier" })[0].day).toBe(12);
  });

  test("the same tag twice on the same day is recorded once", () => {
    // The daily tick can reach a recording site more than once; a chronicle that says the same
    // thing twice on one day reads as a bug.
    let g = { day: 5 };
    g = recordMemory(g, { tag: "dup", label: "A" });
    g = recordMemory(g, { tag: "dup", label: "B" });
    expect(recallMemory(g, { tag: "dup" })).toHaveLength(1);
  });

  test("the same tag on a different day is a separate memory", () => {
    let g = { day: 5 };
    g = recordMemory(g, { tag: "late", label: "Blew a deadline" });
    g.day = 40;
    g = recordMemory(g, { tag: "late", label: "Blew another" });
    expect(recallMemory(g, { tag: "late" })).toHaveLength(2);
  });

  test("the chronicle is capped, so a long game cannot balloon the save", () => {
    let g = { day: 0 };
    for (let i = 0; i < MEMORY_CAP * 3; i++) {
      g.day = i;
      g = recordMemory(g, { tag: `t${i}`, label: `Moment ${i}` });
    }
    expect(g.companyMemory.length).toBe(MEMORY_CAP);
    // Newest kept, oldest dropped.
    expect(g.companyMemory[0].tag).toBe(`t${MEMORY_CAP * 3 - 1}`);
  });

  test("a junk entry never corrupts the chronicle", () => {
    const g = { day: 3, companyMemory: [] };
    recordMemory(g, null);
    recordMemory(g, {});
    recordMemory(g, { label: "no tag" });
    expect(g.companyMemory).toHaveLength(0);
  });

  test("weight and valence are clamped and normalised", () => {
    let g = recordMemory({ day: 1 }, { tag: "a", weight: 999, valence: "nonsense" });
    expect(g.companyMemory[0].weight).toBeLessThanOrEqual(4);
    expect(g.companyMemory[0].valence).toBe("good");
    g = recordMemory({ day: 1 }, { tag: "b", weight: -5 });
    expect(g.companyMemory[0].weight).toBeGreaterThan(0);
  });

  test("an unknown kind falls back rather than creating an unreadable memory", () => {
    const g = recordMemory({ day: 1 }, { tag: "x", kind: "not_a_kind" });
    expect(MEMORY_KINDS).toContain(g.companyMemory[0].kind);
  });
});

describe("recall", () => {
  const g = gameWith([
    mem({ tag: "new", day: 98, kind: "crew", valence: "good", subject: "Dave" }),
    mem({ tag: "old", day: 10, kind: "crew", valence: "bad", subject: "Rosa" }),
  ], 100);

  test("filters by kind, valence, subject", () => {
    expect(recallMemory(g, { kind: "crew" })).toHaveLength(2);
    expect(recallMemory(g, { valence: "bad" })).toHaveLength(1);
    expect(recallMemory(g, { subject: "Dave" })).toHaveLength(1);
  });

  test("withinDays and olderThanDays bracket the timeline", () => {
    expect(recallMemory(g, { withinDays: 5 }).map((m) => m.tag)).toEqual(["new"]);
    expect(recallMemory(g, { olderThanDays: 30 }).map((m) => m.tag)).toEqual(["old"]);
  });

  test("lastMemory returns the most recent match, or null", () => {
    expect(lastMemory(g, { kind: "crew" }).tag).toBe("new");
    expect(lastMemory(g, { kind: "supplier" })).toBeNull();
  });

  test("a game with no memory at all recalls nothing rather than throwing", () => {
    expect(recallMemory(undefined)).toEqual([]);
    expect(recallMemory({})).toEqual([]);
    expect(hasMemory({}, "anything")).toBe(false);
  });
});

describe("effects", () => {
  test("a clean slate moves nothing", () => {
    const e = resolveMemoryEffects({});
    for (const k of MEMORY_EFFECT_KEYS) expect(e[k]).toBe(0);
  });

  test("delivered work wins you future work; blown jobs cost you", () => {
    const proud = resolveMemoryEffects(gameWith([mem({ kind: "triumph", valence: "good", weight: 3 })]));
    const shamed = resolveMemoryEffects(gameWith([mem({ kind: "setback", valence: "bad", weight: 3 })]));
    expect(proud.bidEdge).toBeGreaterThan(0);
    expect(shamed.bidEdge).toBeLessThan(0);
  });

  test("history helps AND haunts — buying out the market earns a grudge", () => {
    const e = resolveMemoryEffects(gameWith([mem({ kind: "rivalry", valence: "bad", weight: 3, subject: "Vance Bros" })]));
    expect(e.rivalGrudge).toBeGreaterThan(0);
  });

  test("beating rivals fairly is not itself a grudge", () => {
    const e = resolveMemoryEffects(gameWith([mem({ kind: "rivalry", valence: "good", weight: 4 })]));
    expect(e.rivalGrudge).toBe(0);
  });

  test("every effect is capped, so a day-400 company is strong and not absolute", () => {
    const many = [];
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `g${i}`, day: 100, kind: "triumph", valence: "good", weight: 4 }));
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `s${i}`, day: 100, kind: "supplier", valence: "good", weight: 4 }));
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `c${i}`, day: 100, kind: "crew", valence: "good", weight: 4 }));
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `r${i}`, day: 100, kind: "rivalry", valence: "bad", weight: 4 }));
    const e = resolveMemoryEffects(gameWith(many));
    expect(e.bidEdge).toBeLessThanOrEqual(MAX_BID_EDGE);
    expect(e.supplierGoodwill).toBeLessThanOrEqual(MAX_SUPPLIER_GOODWILL);
    expect(e.crewLoyalty).toBeLessThanOrEqual(MAX_CREW_LOYALTY);
    expect(e.rivalGrudge).toBeLessThanOrEqual(MAX_RIVAL_GRUDGE);
  });

  test("the negative side is capped too", () => {
    const many = [];
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `b${i}`, day: 100, kind: "setback", valence: "bad", weight: 4 }));
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `sb${i}`, day: 100, kind: "supplier", valence: "bad", weight: 4 }));
    for (let i = 0; i < 80; i++) many.push(mem({ tag: `cb${i}`, day: 100, kind: "crew", valence: "bad", weight: 4 }));
    const e = resolveMemoryEffects(gameWith(many));
    expect(e.bidEdge).toBeGreaterThanOrEqual(-MAX_BID_EDGE);
    expect(e.supplierGoodwill).toBeGreaterThanOrEqual(-MAX_SUPPLIER_GOODWILL);
    expect(e.crewLoyalty).toBeGreaterThanOrEqual(-MAX_CREW_LOYALTY);
  });

  test("a grudge from long enough ago stops pricing your concrete", () => {
    const fresh = resolveMemoryEffects(gameWith([mem({ kind: "supplier", valence: "bad", day: 100, weight: 2 })], 100));
    const stale = resolveMemoryEffects(gameWith([mem({ kind: "supplier", valence: "bad", day: 100, weight: 2 })], 100 + MEMORY_POTENCY_DAYS));
    expect(fresh.supplierGoodwill).toBeLessThan(0);
    expect(stale.supplierGoodwill).toBe(0);
  });

  test("decay is gradual, not a cliff", () => {
    const at = (age) => resolveMemoryEffects(gameWith([mem({ kind: "triumph", valence: "good", day: 0, weight: 2 })], age)).bidEdge;
    const a = at(0), b = at(MEMORY_POTENCY_DAYS / 2), c = at(MEMORY_POTENCY_DAYS - 1);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(0);
  });

  test("no effect is ever NaN, whatever the save contains", () => {
    const junk = gameWith([
      { tag: "a" }, null, { tag: "b", day: "x", weight: "y", kind: "crew", valence: "good" },
    ], 50);
    const e = resolveMemoryEffects(junk);
    for (const k of MEMORY_EFFECT_KEYS) expect(Number.isFinite(e[k])).toBe(true);
  });
});

describe("telling the player", () => {
  test("a moment is placed in time", () => {
    expect(describeMemoryAge(10, 10)).toBe("today");
    expect(describeMemoryAge(9, 10)).toBe("yesterday");
    expect(describeMemoryAge(7, 10)).toBe("3 days ago");
    expect(describeMemoryAge(0, 10)).toBe("last week");
    expect(describeMemoryAge(0, 30)).toContain("weeks ago");
    expect(describeMemoryAge(12, 200)).toBe("back on day 12");
  });

  test("a new company is told it has no history, not a blank card", () => {
    expect(describeStanding({})).toContain("no reputation yet");
  });

  test("standing names what the history has actually done", () => {
    const g = gameWith([mem({ kind: "triumph", valence: "good", weight: 4 }), mem({ tag: "s", kind: "supplier", valence: "bad", weight: 4 })]);
    const text = describeStanding(g);
    expect(text.length).toBeGreaterThan(10);
    expect(text.endsWith(".")).toBe(true);
  });

  test("the story renders newest first with a readable age and a potency flag", () => {
    // The ancient one is deliberately outside MEMORY_POTENCY_DAYS: still in the chronicle for
    // the player to read, but no longer moving any number.
    const g = gameWith([
      mem({ tag: "recent", day: 199, label: "Finished the tower early" }),
      mem({ tag: "ancient", day: 0, label: "First fence" }),
    ], 200);
    const story = summarizeCompanyStory(g);
    expect(story[0].label).toBe("Finished the tower early");
    expect(story[0].stillCounts).toBe(true);
    expect(story[1].stillCounts).toBe(false);
    expect(story[0].when).toBeTruthy();
  });

  test("the story respects its limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => mem({ tag: `t${i}`, day: i }));
    expect(summarizeCompanyStory(gameWith(many), 5)).toHaveLength(5);
  });
});

describe("callbacks — the world referring to what you did", () => {
  test("a company with no history gets no callback, rather than a lie", () => {
    expect(pickMemoryCallback({})).toBeNull();
    expect(pickMemoryCallback({ day: 5, companyMemory: [] })).toBeNull();
  });

  test("a callback only fires once its memory is old enough to be worth recalling", () => {
    const justHappened = gameWith([mem({ tag: "s", kind: "supplier", valence: "bad", day: 100 })], 100);
    expect(pickMemoryCallback(justHappened)).toBeNull();

    const settled = gameWith([mem({ tag: "s", kind: "supplier", valence: "bad", day: 100 })], 140);
    expect(pickMemoryCallback(settled)).not.toBeNull();
  });

  test("the callback text actually references the remembered moment", () => {
    const g = gameWith([mem({
      tag: "stiffed", kind: "supplier", valence: "bad", day: 10,
      label: "Walked away from a bulk order", detail: "you walked away from a signed bulk order",
    })], 60);
    const cb = pickMemoryCallback(g);
    expect(cb.desc).toContain("you walked away from a signed bulk order");
    expect(cb.desc).toMatch(/weeks ago|last week|day 10/);
  });

  test("picking a callback is stable and RNG-free", () => {
    // Presentation must never consume a Math.random() draw — the simulation reads the same
    // sequence, and FleetFlow's build 59 shipped a bug exactly here.
    const g = gameWith([
      mem({ tag: "a", kind: "supplier", valence: "bad", day: 10 }),
      mem({ tag: "b", kind: "crew", valence: "good", day: 10 }),
      mem({ tag: "c", kind: "rivalry", valence: "bad", day: 10 }),
    ], 90);
    const spy = jest.spyOn(Math, "random");
    const first = pickMemoryCallback(g);
    const second = pickMemoryCallback(g);
    expect(spy).not.toHaveBeenCalled();
    expect(first.id).toBe(second.id);
    spy.mockRestore();
  });

  test("every declared callback can be reached by some history", () => {
    // A callback that no reachable state can trigger is dead prose.
    for (const cb of MEMORY_CALLBACKS) {
      const r = cb.requires;
      const g = gameWith([mem({
        tag: `probe-${cb.id}`, kind: r.kind, valence: r.valence, day: 0,
        label: "probe", detail: "probe detail", subject: "Someone",
      })], (r.olderThanDays || 0) + 5);
      const picked = pickMemoryCallback(g);
      expect({ id: cb.id, reachable: picked?.id === cb.id }).toEqual({ id: cb.id, reachable: true });
    }
  });

  test("a callback carries a tone and a title the screen can render", () => {
    const g = gameWith([mem({ tag: "s", kind: "client", valence: "good", day: 0, subject: "Harbor Trust" })], 40);
    const cb = pickMemoryCallback(g);
    expect(cb.title).toBeTruthy();
    expect(cb.tone).toBeTruthy();
    expect(cb.memory.subject).toBe("Harbor Trust");
  });
});
