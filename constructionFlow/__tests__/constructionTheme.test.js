// Design-system contract tests.
//
// Everything in src/theme/constructionTheme.js is a pure function or a constant, which is the
// whole reason it was extracted from the screen: presentation decisions that used to live as
// 503 inline style objects can now be asserted. See FLEETFLOW_PARITY_AUDIT.md §2 gaps 1 and 4.

import {
  SPACING,
  RADIUS,
  TYPE,
  ELEVATION,
  MIN_BODY_FONT_SIZE,
  MIN_EYEBROW_FONT_SIZE,
  MIN_TAP_TARGET,
  THEMES,
  toneColor,
  progressTone,
  conditionTone,
  deadlineTone,
  compactMoney,
  signedMoney,
  getEmptyState,
  alpha,
} from "../src/theme/constructionTheme.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("themes", () => {
  test("dark and light define exactly the same keys", () => {
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  test("every theme value is a 6-digit hex colour", () => {
    for (const mode of ["dark", "light"]) {
      for (const [key, value] of Object.entries(THEMES[mode])) {
        expect(`${mode}.${key}=${value}`).toMatch(new RegExp(`^${mode}\\.${key}=#[0-9a-fA-F]{6}$`));
      }
    }
  });

  test("the legacy keys the screen still reads are all present", () => {
    // ~500 call sites in ConstructionFlowScreen.js reference these directly. Dropping one
    // would render an element with `color: undefined`, which is invisible rather than loud.
    const legacy = ["bg", "panel", "panel2", "panel3", "border", "strongBorder", "text", "sub",
      "green", "red", "blue", "orange", "purple", "cyan", "yellow", "tabBar", "track", "shadow"];
    for (const key of legacy) {
      expect(THEMES.dark[key]).toMatch(HEX);
      expect(THEMES.light[key]).toMatch(HEX);
    }
  });

  test("the semantic construction roles are present", () => {
    const semantic = ["accent", "accentSoft", "safe", "caution", "hazard", "steel", "surface", "surfaceAlt", "dim"];
    for (const key of semantic) {
      expect(THEMES.dark[key]).toMatch(HEX);
      expect(THEMES.light[key]).toMatch(HEX);
    }
  });

  test("Construction Flow no longer ships FleetFlow's palette", () => {
    // The fork inherited FleetFlow's THEMES object byte for byte, which is why the two games
    // looked like one app with different nouns. These are FleetFlow's exact values.
    expect(THEMES.dark.bg).not.toBe("#071224");
    expect(THEMES.dark.panel).not.toBe("#0d1b33");
    expect(THEMES.dark.tabBar).not.toBe("#0a1730");
  });

  test("amber is the primary action colour, not blue", () => {
    expect(THEMES.dark.accent).toBe("#f59e0b");
    expect(THEMES.dark.accent).toBe(THEMES.dark.orange);
  });
});

describe("scales", () => {
  test("spacing is a strictly ascending 4pt-based scale", () => {
    const values = [SPACING.xs, SPACING.sm, SPACING.md, SPACING.lg, SPACING.xl, SPACING.xxl];
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    for (const v of values) expect(v % 4).toBe(0);
  });

  test("radius is strictly ascending, with a pill at the end", () => {
    const values = [RADIUS.xs, RADIUS.sm, RADIUS.md, RADIUS.lg, RADIUS.xl];
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(RADIUS.pill).toBeGreaterThanOrEqual(999);
  });

  test("every readable type role meets the body-size floor", () => {
    // 11px is allowed only for `eyebrow`: short, uppercase, letter-spaced. Everything a
    // player reads as a sentence sits at MIN_BODY_FONT_SIZE or above.
    expect(TYPE.eyebrow.fontSize).toBeGreaterThanOrEqual(MIN_EYEBROW_FONT_SIZE);
    expect(TYPE.eyebrow.textTransform).toBe("uppercase");
    for (const [name, role] of Object.entries(TYPE)) {
      if (name === "eyebrow") continue;
      expect(role.fontSize).toBeGreaterThanOrEqual(MIN_BODY_FONT_SIZE);
    }
  });

  test("the type scale is ordered from caption up to hero", () => {
    expect(TYPE.caption.fontSize).toBeLessThan(TYPE.body.fontSize);
    expect(TYPE.body.fontSize).toBeLessThan(TYPE.label.fontSize);
    expect(TYPE.label.fontSize).toBeLessThan(TYPE.title.fontSize);
    expect(TYPE.title.fontSize).toBeLessThan(TYPE.stat.fontSize);
    expect(TYPE.stat.fontSize).toBeLessThan(TYPE.statLarge.fontSize);
    expect(TYPE.statLarge.fontSize).toBeLessThan(TYPE.hero.fontSize);
  });

  test("elevation defines both platforms' shadow properties", () => {
    for (const level of [ELEVATION.card, ELEVATION.hero]) {
      expect(level.elevation).toBeGreaterThan(0); // Android
      expect(level.shadowOpacity).toBeGreaterThan(0); // iOS
      expect(level.shadowRadius).toBeGreaterThan(0);
    }
    expect(ELEVATION.hero.elevation).toBeGreaterThan(ELEVATION.card.elevation);
  });

  test("the minimum tap target meets the platform guideline", () => {
    expect(MIN_TAP_TARGET).toBeGreaterThanOrEqual(44);
  });
});

describe("toneColor", () => {
  test("each semantic tone resolves to its theme role", () => {
    expect(toneColor("accent", THEMES.dark)).toBe(THEMES.dark.accent);
    expect(toneColor("safe", THEMES.dark)).toBe(THEMES.dark.safe);
    expect(toneColor("caution", THEMES.dark)).toBe(THEMES.dark.caution);
    expect(toneColor("hazard", THEMES.dark)).toBe(THEMES.dark.hazard);
    expect(toneColor("info", THEMES.dark)).toBe(THEMES.dark.steel);
  });

  test("the legacy tone words the game already stores still resolve", () => {
    // getNextBestAction and the event catalogs persist tones as "red"/"orange"/"green"/"cyan".
    expect(toneColor("red", THEMES.dark)).toBe(THEMES.dark.hazard);
    expect(toneColor("green", THEMES.dark)).toBe(THEMES.dark.safe);
    expect(toneColor("orange", THEMES.dark)).toBe(THEMES.dark.accent);
    expect(toneColor("cyan", THEMES.dark)).toBe(THEMES.dark.steel);
  });

  test("a raw theme key or a literal hex passes through rather than vanishing", () => {
    expect(toneColor("purple", THEMES.dark)).toBe(THEMES.dark.purple);
    expect(toneColor("#123456", THEMES.dark)).toBe("#123456");
  });

  test("garbage never produces an invisible element", () => {
    for (const bad of [undefined, null, "", 0, {}, [], "not-a-tone"]) {
      expect(toneColor(bad, THEMES.dark)).toMatch(HEX);
    }
  });

  test("a missing theme falls back to dark rather than throwing", () => {
    expect(toneColor("accent")).toMatch(HEX);
    expect(toneColor("accent", undefined)).toBe(THEMES.dark.accent);
  });

  test("light mode resolves to light values, not dark ones", () => {
    expect(toneColor("accent", THEMES.light)).toBe(THEMES.light.accent);
    expect(toneColor("accent", THEMES.light)).not.toBe(THEMES.dark.accent);
  });
});

describe("progressTone", () => {
  test("reads better as the bar fills", () => {
    expect(progressTone(5)).toBe("hazard");
    expect(progressTone(45)).toBe("caution");
    expect(progressTone(75)).toBe("accent");
    expect(progressTone(95)).toBe("safe");
  });

  test("boundaries land on the higher tone", () => {
    expect(progressTone(30)).toBe("caution");
    expect(progressTone(60)).toBe("accent");
    expect(progressTone(90)).toBe("safe");
  });

  test("non-numeric input is neutral, never a false alarm", () => {
    for (const bad of [undefined, null, NaN, Infinity, "80", {}]) {
      expect(progressTone(bad)).toBe("neutral");
    }
  });
});

describe("conditionTone", () => {
  test("matches the thresholds the simulation already enforces", () => {
    // The screen flags equipment below 40 and blocks assignment below 30.
    expect(conditionTone(100)).toBe("safe");
    expect(conditionTone(70)).toBe("safe");
    expect(conditionTone(69)).toBe("caution");
    expect(conditionTone(40)).toBe("caution");
    expect(conditionTone(39)).toBe("hazard");
    expect(conditionTone(0)).toBe("hazard");
  });

  test("an unknown condition is neutral", () => {
    expect(conditionTone(undefined)).toBe("neutral");
    expect(conditionTone(NaN)).toBe("neutral");
  });
});

describe("deadlineTone", () => {
  test("escalates as the deadline closes", () => {
    expect(deadlineTone(10)).toBe("safe");
    expect(deadlineTone(6)).toBe("safe");
    expect(deadlineTone(5)).toBe("caution");
    expect(deadlineTone(3)).toBe("caution");
    expect(deadlineTone(2)).toBe("hazard");
    expect(deadlineTone(0)).toBe("hazard");
  });

  test("already overdue is hazard, not neutral", () => {
    expect(deadlineTone(-1)).toBe("hazard");
    expect(deadlineTone(-40)).toBe("hazard");
  });
});

describe("compactMoney", () => {
  test("formats each magnitude band", () => {
    expect(compactMoney(0)).toBe("$0");
    expect(compactMoney(750)).toBe("$750");
    expect(compactMoney(1_500)).toBe("$1.5K");
    expect(compactMoney(75_000)).toBe("$75K");
    expect(compactMoney(1_200_000)).toBe("$1.2M");
    expect(compactMoney(15_000_000)).toBe("$15M");
    expect(compactMoney(2_400_000_000)).toBe("$2.4B");
  });

  test("negatives keep their sign", () => {
    expect(compactMoney(-1_500)).toBe("-$1.5K");
    expect(compactMoney(-420)).toBe("-$420");
  });

  test("never renders NaN or undefined to the player", () => {
    for (const bad of [undefined, null, NaN, Infinity, "1000", {}]) {
      expect(compactMoney(bad)).toBe("$0");
    }
  });
});

describe("signedMoney", () => {
  test("a gain is explicitly positive and a loss explicitly negative", () => {
    expect(signedMoney(2_400)).toBe("+$2.4K");
    expect(signedMoney(-800)).toBe("-$800");
    expect(signedMoney(0)).toBe("+$0");
  });
});

describe("getEmptyState", () => {
  const TAB_NAMES = ["Home", "Bids", "Sites", "Crew", "Equipment", "Finance", "Empire"];

  test("every tab has an empty state — no screen can look broken", () => {
    for (const tab of TAB_NAMES) {
      const empty = getEmptyState(tab);
      expect(typeof empty.icon).toBe("string");
      expect(empty.icon.length).toBeGreaterThan(0);
      expect(empty.title.length).toBeGreaterThan(0);
      expect(empty.body.length).toBeGreaterThan(0);
    }
  });

  test("an empty state that offers a button also says where it goes", () => {
    for (const tab of TAB_NAMES) {
      const empty = getEmptyState(tab);
      if (empty.cta) expect(TAB_NAMES).toContain(empty.tab);
      if (empty.tab) expect(typeof empty.cta).toBe("string");
    }
  });

  test("an unknown tab still returns usable copy rather than undefined", () => {
    const empty = getEmptyState("NotATab");
    expect(empty.title.length).toBeGreaterThan(0);
    expect(empty.body.length).toBeGreaterThan(0);
  });

  test("no empty state still talks about vehicles", () => {
    for (const tab of TAB_NAMES) {
      const empty = getEmptyState(tab);
      expect(`${empty.title} ${empty.body}`.toLowerCase()).not.toContain("vehicle");
    }
  });
});

describe("alpha", () => {
  test("produces an 8-digit hex with the requested opacity", () => {
    expect(alpha("#f59e0b", 1)).toBe("#f59e0bff");
    expect(alpha("#f59e0b", 0)).toBe("#f59e0b00");
    expect(alpha("#f59e0b", 0.5)).toBe("#f59e0b80");
  });

  test("clamps out-of-range opacity instead of emitting a broken colour", () => {
    expect(alpha("#f59e0b", 5)).toBe("#f59e0bff");
    expect(alpha("#f59e0b", -3)).toBe("#f59e0b00");
    expect(alpha("#f59e0b", NaN)).toBe("#f59e0bff");
  });

  test("passes through anything that is not a 6-digit hex", () => {
    expect(alpha("rgba(0,0,0,0.5)", 0.2)).toBe("rgba(0,0,0,0.5)");
    expect(alpha("#f59e0bcc", 0.2)).toBe("#f59e0bcc");
    expect(alpha(undefined, 0.2)).toBe(undefined);
  });
});
