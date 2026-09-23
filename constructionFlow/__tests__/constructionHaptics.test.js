// Haptics discipline.
//
// Sprint 9. FleetFlow fires tactile feedback at 25 sites; Construction Flow fired none in the
// game loop. Adding them is cheap — getting them WRONG is the expensive part, and there are
// exactly two ways to get them wrong. Both are guarded here by scanning the source, because
// neither can be caught by calling the function: a haptic has no return value and no
// observable effect in a test environment.
//
//   1. Firing from the tick. gameTick runs hundreds of times during offline catch-up. A buzz
//      per simulated day would vibrate the phone continuously when a player reopens the app
//      after a night away. FleetFlow's own module calls this out explicitly.
//
//   2. Firing "success" before the guards have run. A handler that buzzes success at the top
//      and then refuses the purchase two lines later has told the player, in the most physical
//      way the device has, that something happened when nothing did.

import fs from "fs";
import path from "path";

const SCREEN_PATH = path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js");
const RAW = fs.readFileSync(SCREEN_PATH, "utf8");
const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");

const HAPTICS_PATH = path.join(__dirname, "..", "src", "utils", "constructionHaptics.js");
const HAPTICS = fs.readFileSync(HAPTICS_PATH, "utf8");

// The exported simulation entry points. Anything reachable only from these runs during offline
// catch-up as well as live play.
function bodyOf(source, startPattern) {
  const start = source.indexOf(startPattern);
  if (start === -1) return null;
  let i = source.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < source.length; j++) {
    if (source[j] === "{") depth++;
    else if (source[j] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, j + 1);
    }
  }
  return null;
}

describe("the wrapper cannot throw into calling code", () => {
  test("every native call is inside a try/catch", () => {
    expect(HAPTICS).toContain("try {");
    expect(HAPTICS).toContain("catch");
  });

  test("it imports the real module rather than reimplementing vibration", () => {
    expect(HAPTICS).toContain('from "expo-haptics"');
  });

  test("expo-haptics is a declared dependency, not an accidental transitive one", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    expect(pkg.dependencies["expo-haptics"]).toBeTruthy();
  });
});

describe("rule 1: never from the tick", () => {
  test("gameTick does not fire a haptic", () => {
    const body = bodyOf(CODE, "export function gameTick");
    expect(body).toBeTruthy();
    expect(body).not.toContain("fireHaptic");
  });

  test("neither does the daily rollover or migration", () => {
    for (const entry of ["export function migrateState", "export function freshState"]) {
      const body = bodyOf(CODE, entry);
      if (body) expect(body).not.toContain("fireHaptic");
    }
  });

  test("no haptic sits inside the offline catch-up function itself", () => {
    // Checked by SCOPE, not by proximity. An earlier version of this test scanned the 40 lines
    // above each call and flagged handleBuyEquipment purely because it happens to sit just
    // below an unrelated offline useEffect — a false positive that would have trained the next
    // reader to ignore this test.
    const body = bodyOf(CODE, "function applyOfflineProgress");
    expect(body).toBeTruthy();
    expect(body).not.toContain("fireHaptic");
  });

  test("every haptic call lives inside a handler or a shared alert helper", () => {
    // The positive form of the same rule: name where each one IS, rather than guessing where
    // it is not.
    const lines = CODE.split("\n");
    const stray = [];
    lines.forEach((line, i) => {
      if (!/fireHaptic\(/.test(line)) return;
      // An `onPress` closure is a live button press by definition — the speed control in the
      // header is one — so it counts alongside the named handlers.
      const above = lines.slice(Math.max(0, i - 120), i + 1).join("\n");
      const lastHandler = Math.max(
        above.lastIndexOf("const handle"),
        above.lastIndexOf("function handle"),
        above.lastIndexOf("function alertInsufficientFunds"),
        above.lastIndexOf("onPress={")
      );
      if (lastHandler === -1) stray.push(line.trim());
    });
    expect(stray).toEqual([]);
  });

});

describe("rule 2: a press never lies about its outcome", () => {
  test("no handler opens by buzzing success, milestone or warning", () => {
    // The top of a handler is before the guards. Only a neutral tap is honest there.
    const bad = CODE.split("\n")
      .map((line, i, all) => ({ line: line.trim(), prev: (all[i - 1] || "").trim() }))
      .filter(({ line, prev }) =>
        /^fireHaptic\("(success|milestone|warning|error)"\);$/.test(line) &&
        /=>\s*\{$|^\s*function\s+handle/.test(prev)
      );
    expect(bad.map((b) => b.prev)).toEqual([]);
  });

  test("a refused purchase buzzes an error", () => {
    const body = bodyOf(CODE, "function alertInsufficientFunds");
    expect(body).toContain('fireHaptic("error")');
  });

  test("clearing a tax bill is felt, and only on the confirmed path", () => {
    const idx = CODE.indexOf("const handlePayTax");
    const body = CODE.slice(idx, idx + 1400);
    expect(body).toContain('fireHaptic(_res.cleared ? "milestone" : "success")');
    // It must come after the payment has actually been applied.
    expect(body.indexOf("applyTaxPayment")).toBeLessThan(body.indexOf("_res.cleared ?"));
  });

  test("lifting the freeze is felt", () => {
    const idx = CODE.indexOf("const handlePayTax");
    const body = CODE.slice(idx, idx + 1600);
    const unfrozen = body.indexOf("_res.unfrozen");
    expect(unfrozen).toBeGreaterThan(-1);
    expect(body.slice(unfrozen, unfrozen + 200)).toContain("fireHaptic");
  });
});

describe("coverage", () => {
  test("the game fires haptics at a comparable number of sites to FleetFlow", () => {
    // FleetFlow: 25. Construction Flow before this sprint: 0.
    const count = (CODE.match(/fireHaptic\(/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(25);
  });

  test("the money moments are all covered", () => {
    for (const handler of ["handleBuyEquipment", "handleHireCrew", "handleTakeLoan", "handleUpgradeOffice", "handleSettleSite"]) {
      const idx = CODE.indexOf(handler + " = useCallback");
      expect({ handler, covered: idx > -1 && CODE.slice(idx, idx + 260).includes("fireHaptic") })
        .toEqual({ handler, covered: true });
    }
  });
});
