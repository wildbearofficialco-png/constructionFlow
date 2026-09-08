#!/usr/bin/env node

/**
 * Regenerates the /snack directory: a minimal, self-contained copy of ConstructionFlow
 * meant to be pasted into an Expo Snack (https://snack.expo.dev) for testing in Expo Go,
 * without a local dev server.
 *
 * Snack can't resolve require("../../../assets/...") the way Metro does in this repo without
 * every PNG being individually re-uploaded through the Snack UI, so this script rewrites the
 * equipment/office image map to remote { uri } sources pointing at this repo's raw GitHub
 * content instead. The production app (src/games/constructionflow/ConstructionFlowScreen.js,
 * used by src/app/) is untouched and keeps bundling assets locally, which is what you want for
 * a shipped app (offline, no network dependency, no GitHub rate limits).
 *
 * Run after any change to ConstructionFlowScreen.js or the systems it imports:
 *   node scripts/build-snack.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE_SCREEN = path.join(ROOT, "src/games/constructionflow/ConstructionFlowScreen.js");
const SYSTEMS_DIR = path.join(ROOT, "src/systems");
const OUT_DIR = path.join(ROOT, "snack");

// Only the systems ConstructionFlowScreen.js actually imports (plus utils.js, which all of
// them depend on) need to ship to Snack. lendingEngine/regionalEconomyEngine/holdingsEngine/
// vehicleLifecycle/equipmentWear/financialLedger aren't wired into this screen yet.
const SYSTEMS_NEEDED = [
  "utils.js",
  "employeePersonalities.js",
  "inventorySystem.js",
  "randomEvents.js",
  "aiCompetitors.js",
  "economyEngine.js",
  "customerSatisfaction.js",
  "demandPricing.js",
  "weatherRouteConditions.js",
  "staffPerformance.js",
  "contractBidding.js",
  "analyticsEngine.js",
  "territorySystem.js",
];

const RAW_ASSET_BASE =
  "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction";

const GENERATED_HEADER = (relPath) =>
  `// GENERATED FILE — do not edit directly.\n` +
  `// Regenerate with \`node scripts/build-snack.js\` from ${relPath}.\n` +
  `// This is the Snack-friendly copy: local asset requires are rewritten to remote\n` +
  `// { uri } sources so nothing needs to be re-uploaded into Snack by hand.\n\n`;

const APP_JS = `import React, { useEffect } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import ConstructionFlowScreen from "./ConstructionFlowScreen";

// Minimal error boundary so a crash shows a recoverable screen instead of a blank one —
// mirrors the production app's AppErrorBoundary (src/app/index.tsx) without any deps Snack
// doesn't need.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, errorMessage: error?.message || "Unknown error" };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ConstructionFlow crashed:", error, errorInfo);
  }

  resetApp = () => {
    this.setState({ crashed: false, errorMessage: "" });
  };

  render() {
    if (this.state.crashed) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#071224", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 420, backgroundColor: "#0d1b33", borderColor: "#233455", borderWidth: 1, borderRadius: 24, padding: 22, alignItems: "center" }}>
            <Text style={{ fontSize: 42, marginBottom: 14 }}>⚠️</Text>
            <Text style={{ color: "#f8fafc", fontSize: 23, fontWeight: "900", textAlign: "center", marginBottom: 10 }}>
              ConstructionFlow hit a bump
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 14 }}>
              The app caught an unexpected error instead of closing.
            </Text>
            <Text style={{ color: "#fca5a5", fontSize: 12, marginBottom: 18 }}>{this.state.errorMessage}</Text>
            <TouchableOpacity
              onPress={this.resetApp}
              style={{ backgroundColor: "#22c55e", paddingHorizontal: 30, paddingVertical: 15, borderRadius: 14, minWidth: 150, alignItems: "center" }}
            >
              <Text style={{ color: "#071224", fontWeight: "900", fontSize: 15 }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded) return null;

  return (
    <AppErrorBoundary>
      <ConstructionFlowScreen />
    </AppErrorBoundary>
  );
}
`;

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT_DIR, "systems"), { recursive: true });

  // --- ConstructionFlowScreen.js: rewrite asset requires + systems import paths ---
  let screen = fs.readFileSync(SOURCE_SCREEN, "utf8");

  const assetRequireRe = /require\("\.\.\/\.\.\/\.\.\/assets\/construction\/([^"]+)"\)/g;
  const assetMatches = screen.match(assetRequireRe) || [];
  screen = screen.replace(assetRequireRe, (_match, relPath) => `{ uri: "${RAW_ASSET_BASE}/${relPath}" }`);

  screen = screen.replace(/from "\.\.\/\.\.\/systems\//g, 'from "./systems/');

  fs.writeFileSync(
    path.join(OUT_DIR, "ConstructionFlowScreen.js"),
    GENERATED_HEADER("src/games/constructionflow/ConstructionFlowScreen.js") + screen
  );

  // --- systems/* + utils.js: copied verbatim, their own "./utils.js" imports still work ---
  for (const file of SYSTEMS_NEEDED) {
    const src = path.join(SYSTEMS_DIR, file);
    const dest = path.join(OUT_DIR, "systems", file);
    fs.copyFileSync(src, dest);
  }

  // --- App.js: static Snack entry point ---
  fs.writeFileSync(path.join(OUT_DIR, "App.js"), APP_JS);

  console.log(`Rewrote ${assetMatches.length} local asset requires to remote URIs.`);
  console.log(`Wrote snack/App.js, snack/ConstructionFlowScreen.js, and ${SYSTEMS_NEEDED.length} files in snack/systems/.`);
}

main();
