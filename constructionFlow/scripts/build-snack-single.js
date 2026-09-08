#!/usr/bin/env node

/**
 * Regenerates snack/ConstructionFlowSnack.js — ONE self-contained file with zero local
 * imports, pasteable directly over Snack's App.js.
 *
 * Why not just concatenate everything at the top level: ConstructionFlowScreen.js already
 * declares its own top-level `rand`/`pick`/`uid`/`clamp`/`addLog`/`money` helpers (it never
 * imported them from systems/utils.js), and several of the 12 systems it imports declare the
 * *same* names via `import { uid, rand, pick, clamp, addLog, money } from "./utils.js"`. Naively
 * flattening both into one module scope would redeclare those identifiers. So each system is
 * wrapped in its own IIFE (its own private copy of utils.js inlined inside), and only the
 * specific names ConstructionFlowScreen.js originally imported from it are pulled into the
 * outer scope — reproducing real module isolation without real modules.
 *
 * Run after changing ConstructionFlowScreen.js or any of the systems it imports:
 *   node scripts/build-snack-single.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE_SCREEN = path.join(ROOT, "src/games/constructionflow/ConstructionFlowScreen.js");
const SYSTEMS_DIR = path.join(ROOT, "src/systems");
const UTILS_PATH = path.join(SYSTEMS_DIR, "utils.js");
const OUT_PATH = path.join(ROOT, "snack/ConstructionFlowSnack.js");

const RAW_ASSET_BASE =
  "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction";

// filename -> IIFE variable name the screen destructures from
const SYSTEMS = [
  ["employeePersonalities.js", "EmployeePersonalitiesSystem"],
  ["inventorySystem.js", "InventorySystem"],
  ["randomEvents.js", "RandomEventsSystem"],
  ["aiCompetitors.js", "AiCompetitorsSystem"],
  ["economyEngine.js", "EconomyEngineSystem"],
  ["customerSatisfaction.js", "CustomerSatisfactionSystem"],
  ["demandPricing.js", "DemandPricingSystem"],
  ["weatherRouteConditions.js", "WeatherRouteConditionsSystem"],
  ["staffPerformance.js", "StaffPerformanceSystem"],
  ["contractBidding.js", "ContractBiddingSystem"],
  ["analyticsEngine.js", "AnalyticsEngineSystem"],
  ["territorySystem.js", "TerritorySystem"],
];

const EXPORT_DECL_RE = /^export (?:const|function|class|let|var)\s+([A-Za-z_$][\w$]*)/gm;

function stripExports(source) {
  return source.replace(/^export (?=(?:const|function|class|let|var)\s)/gm, "");
}

function collectExportedNames(source) {
  const names = [];
  let m;
  EXPORT_DECL_RE.lastIndex = 0;
  while ((m = EXPORT_DECL_RE.exec(source))) names.push(m[1]);
  return names;
}

function removeUtilsImportLine(source) {
  return source.replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\/utils\.js["'];?\s*\n/m, "");
}

function buildSystemIife(varName, systemSource, utilsBody) {
  const withoutImport = removeUtilsImportLine(systemSource);
  const exportedNames = collectExportedNames(withoutImport);
  const body = stripExports(withoutImport).trim();

  return (
    `const ${varName} = (() => {\n` +
    `${utilsBody}\n\n` +
    `${body}\n\n` +
    `  return { ${exportedNames.join(", ")} };\n` +
    `})();\n`
  );
}

function main() {
  const utilsSource = fs.readFileSync(UTILS_PATH, "utf8");
  const utilsBody = stripExports(utilsSource).trim();

  // --- one IIFE per system, each with its own private inlined copy of utils.js ---
  const iifes = [];
  const destructures = [];

  for (const [file, varName] of SYSTEMS) {
    const source = fs.readFileSync(path.join(SYSTEMS_DIR, file), "utf8");
    iifes.push(buildSystemIife(varName, source, utilsBody));
  }

  // --- ConstructionFlowScreen.js: drop its systems imports, keep npm-package imports,
  //     rewrite asset requires to remote URIs, then destructure exactly what it originally
  //     imported from each system, from that system's IIFE object ---
  let screen = fs.readFileSync(SOURCE_SCREEN, "utf8");

  // [^}]* (not [\s\S]*?) is deliberate: it cannot cross a "}" boundary, so this can only ever
  // match ONE complete { ... } group, never accidentally swallow the unrelated react-native/
  // AsyncStorage/Ionicons import statements that precede these in the source file.
  const importBlockRe =
    /import\s*(?:\{[^}]*\}|[A-Za-z_$][\w$]*)\s*from\s*"\.\.\/\.\.\/systems\/([a-zA-Z]+)\.js";\n/g;
  let match;
  const importsBySystemFile = {};
  while ((match = importBlockRe.exec(screen))) {
    importsBySystemFile[match[1]] = match[0];
  }
  screen = screen.replace(importBlockRe, "");

  for (const [file, varName] of SYSTEMS) {
    const base = path.basename(file, ".js");
    const importStmt = importsBySystemFile[base];
    if (!importStmt) {
      throw new Error(`ConstructionFlowScreen.js does not import from ${file} — check SYSTEMS list`);
    }
    const namesMatch = importStmt.match(/\{([\s\S]*?)\}/);
    const names = namesMatch
      ? namesMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")
      : importStmt.match(/import\s+([A-Za-z_$][\w$]*)/)[1];
    destructures.push(`const { ${names} } = ${varName};`);
  }

  const assetRequireRe = /require\("\.\.\/\.\.\/\.\.\/assets\/construction\/([^"]+)"\)/g;
  const assetMatches = screen.match(assetRequireRe) || [];
  screen = screen.replace(assetRequireRe, (_m, relPath) => `{ uri: "${RAW_ASSET_BASE}/${relPath}" }`);

  // Hoist the remaining (npm-package) imports — react, react-native, AsyncStorage,
  // @expo/vector-icons — to the very top of the generated file, ahead of the inlined
  // systems. They're still a leading, unbroken run of import statements at this point
  // (systems imports were the only other imports and are already stripped above), so this
  // just pulls that leading block out and drops it back in before the IIFEs.
  const leadingImportsRe = /^(?:import[\s\S]*?;\s*\n)+/;
  const leadingImportsMatch = screen.match(leadingImportsRe);
  const npmImports = leadingImportsMatch ? leadingImportsMatch[0].trim() : "";
  screen = screen.replace(leadingImportsRe, "");

  const header = `/**
 * ConstructionFlow — single-file Snack build. GENERATED — do not edit directly.
 * Regenerate with \`node scripts/build-snack-single.js\` from src/games/constructionflow/
 * ConstructionFlowScreen.js and src/systems/*.
 *
 * Paste this ENTIRE file over Snack's App.js. No other files needed — every gameplay
 * system (economy, employees, inventory, random events, AI competitors, customer
 * satisfaction, demand/pricing, weather, staff performance, contract bidding, analytics,
 * territories) is inlined below as an isolated module (IIFE), and all 50 equipment/office
 * images load from this repo's raw GitHub content instead of local requires.
 *
 * Dependencies used (all standard in Expo Go / Snack SDK 57):
 *   react, react-native, @react-native-async-storage/async-storage, @expo/vector-icons
 */

`;

  const output =
    header +
    npmImports +
    "\n\n// ─── Inlined gameplay systems (each isolated in its own module scope) ──────────\n\n" +
    iifes.join("\n") +
    "\n// ─── Bindings the game screen below expects (mirrors its original imports) ─────\n\n" +
    destructures.join("\n") +
    "\n\n// ─── ConstructionFlow game screen ───────────────────────────────────────────────\n\n" +
    screen;

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, output);

  console.log(`Inlined ${SYSTEMS.length} systems (+utils.js x${SYSTEMS.length}) into ${iifes.length} IIFEs.`);
  console.log(`Rewrote ${assetMatches.length} local asset requires to remote URIs.`);
  console.log(`Wrote ${OUT_PATH} (${output.split("\n").length} lines).`);
}

main();
