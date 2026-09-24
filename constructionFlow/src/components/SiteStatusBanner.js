// The line on a site card that says why the job is not running at full speed.
//
// Sprint 1, P0-1. It renders systems/siteDiagnostics.js's verdict and nothing else, so it can only
// ever say what the simulation actually did to the site this tick. Presentational: it takes a
// theme, the site, the day, and a resolver that turns a suggested action into a handler (or null
// when the fix is further down the same card, in which case the action is shown as a pointer).

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { diagnoseSite } from "../systems/siteDiagnostics.js";
import { SPACING, RADIUS, TYPE, MIN_TAP_TARGET, toneColor, alpha, THEMES } from "../theme/constructionTheme";

const TONE = { stop: "hazard", slow: "caution", info: "info" };

export default function SiteStatusBanner({ T = THEMES.dark, site, day, resolveAction = () => null, style }) {
  const verdict = diagnoseSite(site, day);
  if (verdict.state === "running" || verdict.lines.length === 0) return null;
  return (
    <View style={[{ marginBottom: SPACING.sm }, style]} testID="site-status-banner">
      {verdict.lines.map((line, i) => {
        const color = toneColor(TONE[line.severity] || "caution", T);
        const handler = line.action ? resolveAction(line.action) : null;
        return (
          <View
            key={`${line.text}-${i}`}
            style={{
              backgroundColor: alpha(color, 0.12), borderRadius: RADIUS.sm, borderWidth: 1,
              borderColor: alpha(color, 0.55), padding: SPACING.sm, marginBottom: SPACING.xs,
              flexDirection: "row", alignItems: "center",
            }}
          >
            <Text style={[TYPE.caption, { color, fontWeight: "700", flex: 1 }]}>
              {line.severity === "stop" ? "⛔ " : line.severity === "slow" ? "🐢 " : "ℹ️ "}{line.text}
            </Text>
            {line.action && handler ? (
              <TouchableOpacity
                onPress={handler}
                style={{ marginLeft: SPACING.sm, minHeight: MIN_TAP_TARGET, justifyContent: "center", paddingHorizontal: SPACING.sm }}
                accessibilityRole="button"
                accessibilityLabel={line.action.label}
              >
                <Text style={[TYPE.caption, { color, fontWeight: "800" }]}>{line.action.label} →</Text>
              </TouchableOpacity>
            ) : line.action ? (
              <Text style={[TYPE.caption, { color: T.sub, marginLeft: SPACING.sm }]}>{line.action.label} ↓</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
