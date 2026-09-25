// Sprint 1 P0 — inspection and safety penalties scale with the job.
//
// A routine inspection on a ~$9,000 starter fence could cost $9,000 (flat $2,500–9,000), and a
// random "safety incident" could cost ~$16,000 on the same fence (a flat $2–8k fine plus a flat
// $1.5–4k-per-level incident charge). The identical failure on a $1.5M contract cost the same flat
// amount. These tests pin the intended shape at three contract sizes.

import fs from "fs";
import path from "path";
import {
  penaltyFor, penaltyShare, PENALTY_BANDS, ROUTINE_CAP_SHARE, KNOWING_CAP_SHARE, companySizeFactor,
} from "../src/systems/penalties.js";

const SIZES = { small: 9000, medium: 150000, large: 1500000 };
const worst = (opts) => penaltyFor({ ...opts, roll: 1 });
const best = (opts) => penaltyFor({ ...opts, roll: 0 });

describe.each(Object.entries(SIZES))("%s contract ($%i)", (_name, value) => {
  test("a routine failure can hurt but never erases the job", () => {
    for (const severity of ["minor", "major", "severe"]) {
      for (const lvl of [1, 4, 8]) {
        const f = worst({ contractValue: value, severity, companyLevel: lvl });
        expect(penaltyShare(f, value)).toBeLessThanOrEqual(ROUTINE_CAP_SHARE + 1e-9);
        expect(f).toBeGreaterThan(0);
      }
    }
  });

  test("a knowing violation can be painful, but not more than the knowing cap", () => {
    const f = worst({ contractValue: value, severity: "severe", knowing: true, companyLevel: 8 });
    expect(penaltyShare(f, value)).toBeLessThanOrEqual(KNOWING_CAP_SHARE + 1e-9);
    expect(f).toBeGreaterThan(worst({ contractValue: value, severity: "severe", companyLevel: 8 }));
  });

  test("severity orders the cost: minor ≤ major ≤ severe", () => {
    const m = (s) => penaltyFor({ contractValue: value, severity: s, companyLevel: 3 });
    expect(m("minor")).toBeLessThanOrEqual(m("major"));
    expect(m("major")).toBeLessThanOrEqual(m("severe"));
  });

  test("a bigger company pays more for the same failure", () => {
    const at = (lvl) => penaltyFor({ contractValue: value, severity: "major", companyLevel: lvl });
    expect(at(1)).toBeLessThanOrEqual(at(4));
    expect(at(4)).toBeLessThanOrEqual(at(8));
  });
});

describe("scaling is intentional across sizes", () => {
  test("the same failure costs more on a bigger contract, in dollars", () => {
    const f = (v) => penaltyFor({ contractValue: v, severity: "major", companyLevel: 3 });
    expect(f(SIZES.small)).toBeLessThan(f(SIZES.medium));
    expect(f(SIZES.medium)).toBeLessThan(f(SIZES.large));
  });

  test("the starter fence: a routine major failure costs hundreds, not the job", () => {
    const f = worst({ contractValue: SIZES.small, severity: "major", companyLevel: 1 });
    expect(f).toBeLessThanOrEqual(SIZES.small * ROUTINE_CAP_SHARE);
    expect(f).toBeGreaterThanOrEqual(PENALTY_BANDS.major.floor);
    expect(f).toBeLessThan(1500);
  });

  test("the large contract no longer pays a flat pittance", () => {
    // The old phase-inspection major failure topped out at $9,000 on any contract.
    expect(best({ contractValue: SIZES.large, severity: "major", companyLevel: 6 })).toBeGreaterThan(9000);
  });

  test("the company-size factor", () => {
    expect([1, 2, 3, 5, 6, 10].map(companySizeFactor)).toEqual([0.85, 0.85, 1, 1, 1.2, 1.2]);
  });

  test("garbage in does not produce NaN out", () => {
    for (const v of [undefined, null, NaN, -5, "abc"]) expect(penaltyFor({ contractValue: v })).toBe(0);
    expect(Number.isFinite(penaltyFor({ contractValue: 10000, roll: NaN }))).toBe(true);
  });
});

test("no inspection or incident path charges a flat amount any more", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
  for (const flat of ["rand(2500, 9000)", "rand(500, 2500)", "rand(2000, 8000);\n      game.cash -= fine", "rand(1500, 5000)", "severity * rand(1500, 4000)"]) {
    expect(code).not.toContain(flat);
  }
});
