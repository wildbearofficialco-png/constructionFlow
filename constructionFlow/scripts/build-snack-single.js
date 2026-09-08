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

// Which systems to inline is DERIVED from what ConstructionFlowScreen.js actually imports,
// not hardcoded. It used to be a fixed list of 12 that had to be hand-edited whenever the
// screen's imports changed — and because that list was the source of truth, it kept inlining
// ~2,400 lines of modules into Brady's copy-paste file long after the screen stopped needing
// them. Deriving it means the Snack build tracks the real dependency set on its own,
// including the current state: the screen imports no systems at all, so none are inlined.
const SYSTEM_IMPORT_RE =
  /import\s*(?:\{[^}]*\}|[A-Za-z_$][\w$]*)\s*from\s*"\.\.\/\.\.\/systems\/([a-zA-Z]+)\.js";\n/g;

// weatherRouteConditions -> WeatherRouteConditionsSystem; territorySystem -> TerritorySystem.
function systemVarName(base) {
  const pascal = base.charAt(0).toUpperCase() + base.slice(1);
  return /System$/.test(pascal) ? pascal : `${pascal}System`;
}

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

// The generated file is the ONLY way ConstructionFlow gets tested on a real device: it is
// pasted whole over Snack's App.js. A silently malformed build costs a full round-trip to
// discover, so every regeneration self-checks the properties Snack actually depends on.
function verify(output, assetCount) {
  const codeOnly = output.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const checks = [
    ["default export is intact (Snack renders App.js's default export)",
      /export default function ConstructionFlowScreen/.test(output)],
    ["no local imports remain (the file must be self-contained)",
      !/from\s+["']\.\.?\//.test(codeOnly)],
    ["no local asset require() remains (Snack has no local assets)",
      !/require\(["']\.\.?\//.test(codeOnly)],
    ["every asset resolves to a raw GitHub URI", assetCount > 0 &&
      (output.match(/uri: "https:\/\/raw\.githubusercontent\.com/g) || []).length === assetCount],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
  if (failed.length) {
    throw new Error(`Generated Snack build failed verification:\n  - ${failed.join("\n  - ")}`);
  }
  console.log(`Verified ${checks.length} structural checks on the generated file.`);
}

function main() {
  const utilsSource = fs.readFileSync(UTILS_PATH, "utf8");
  const utilsBody = stripExports(utilsSource).trim();

  // --- ConstructionFlowScreen.js: drop its systems imports, keep npm-package imports,
  //     rewrite asset requires to remote URIs, then destructure exactly what it originally
  //     imported from each system, from that system's IIFE object ---
  let screen = fs.readFileSync(SOURCE_SCREEN, "utf8");

  // [^}]* (not [\s\S]*?) is deliberate: it cannot cross a "}" boundary, so this can only ever
  // match ONE complete { ... } group, never accidentally swallow the unrelated react-native/
  // AsyncStorage/Ionicons import statements that precede these in the source file.
  let match;
  const importsBySystemFile = {};
  SYSTEM_IMPORT_RE.lastIndex = 0;
  while ((match = SYSTEM_IMPORT_RE.exec(screen))) {
    importsBySystemFile[match[1]] = match[0];
  }
  screen = screen.replace(SYSTEM_IMPORT_RE, "");

  // --- one IIFE per imported system, each with its own private inlined copy of utils.js ---
  const iifes = [];
  const destructures = [];

  for (const base of Object.keys(importsBySystemFile)) {
    const varName = systemVarName(base);
    const source = fs.readFileSync(path.join(SYSTEMS_DIR, `${base}.js`), "utf8");
    iifes.push(buildSystemIife(varName, source, utilsBody));

    const importStmt = importsBySystemFile[base];
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
 * Paste this ENTIRE file over Snack's App.js. No other files needed — any gameplay system
 * the screen imports is inlined below as an isolated module (IIFE), and all 50
 * equipment/office images load from this repo's raw GitHub content instead of local requires.
 *
 * Dependencies used (all standard in Expo Go / Snack SDK 57):
 *   react, react-native, @react-native-async-storage/async-storage, @expo/vector-icons
 */

`;

  const systemsSection = iifes.length
    ? "\n\n// ─── Inlined gameplay systems (each isolated in its own module scope) ──────────\n\n" +
      iifes.join("\n") +
      "\n// ─── Bindings the game screen below expects (mirrors its original imports) ─────\n\n" +
      destructures.join("\n")
    : "";

  const output =
    header +
    npmImports +
    systemsSection +
    "\n\n// ─── ConstructionFlow game screen ───────────────────────────────────────────────\n\n" +
    screen;

  verify(output, assetMatches.length);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, output);

  console.log(`Inlined ${iifes.length} system(s) that the screen actually imports.`);
  console.log(`Rewrote ${assetMatches.length} local asset requires to remote URIs.`);
  console.log(`Wrote ${OUT_PATH} (${output.split("\n").length} lines).`);
}

main();
