#!/usr/bin/env node

/**
 * Build ONE self-contained Construction Flow file for Expo Snack.
 *
 * Local gameplay/data modules are bundled automatically with esbuild so new systems do not need
 * to be manually added to an inliner list. React Native / Expo package imports remain external,
 * which is exactly what Snack expects. Construction image requires are rewritten to raw GitHub
 * URIs before bundling so the generated file needs no local assets.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "src/games/constructionflow/ConstructionFlowScreen.js");
const TEMP = path.join(ROOT, "src/games/constructionflow/.ConstructionFlowSnackEntry.js");
const OUT = path.join(ROOT, "snack/ConstructionFlowSnack.js");
const RAW_ASSET_BASE = "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction";

function main() {
  let source = fs.readFileSync(SOURCE, "utf8");
  let assetCount = 0;
  source = source.replace(
    /require\("\.\.\/\.\.\/\.\.\/assets\/construction\/([^"]+)"\)/g,
    (_match, relPath) => {
      assetCount += 1;
      return `{ uri: "${RAW_ASSET_BASE}/${relPath}" }`;
    }
  );

  fs.writeFileSync(TEMP, source);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  try {
    execFileSync(
      "npx",
      [
        "--yes", "esbuild@0.25.10", TEMP,
        "--bundle",
        "--format=esm",
        "--platform=browser",
        "--loader:.js=jsx",
        "--external:react",
        "--external:react-native",
        "--external:@react-native-async-storage/async-storage",
        "--external:@expo/vector-icons",
        `--outfile=${OUT}`,
        "--log-level=warning",
      ],
      { cwd: ROOT, stdio: "inherit" }
    );
  } finally {
    if (fs.existsSync(TEMP)) fs.unlinkSync(TEMP);
  }

  const bundled = fs.readFileSync(OUT, "utf8");
  const header = `/**\n * ConstructionFlow — GENERATED single-file Expo Snack build.\n * Paste this entire file over Snack's App.js.\n * Local gameplay systems/data are bundled; React Native/Expo package imports remain external.\n */\n\n`;
  fs.writeFileSync(OUT, header + bundled);
  console.log(`Rewrote ${assetCount} construction assets to remote URIs.`);
  console.log(`Wrote ${OUT} (${(header + bundled).split("\\n").length} lines).`);
}

main();
