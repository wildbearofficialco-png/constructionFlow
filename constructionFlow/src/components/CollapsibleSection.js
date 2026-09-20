import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// WildBear Core — reusable accessible accordion.
//
// Ported from FleetFlow Simulator, which already wrote it game-agnostically (colours and
// labels are all props) precisely so other WildBear titles could adopt it. This is the
// first shared presentation primitive Construction Flow takes from the reference
// implementation, and the two copies should be kept in step.
//
// Differences from the FleetFlow copy, both deliberate:
//   - The storage prefix is `wildbear_` rather than `fleetflow_`, so a future extraction
//     into a genuinely shared package does not have to migrate anyone's saved preferences.
//   - No haptics. FleetFlow has a haptics helper and a presentation setting to gate it;
//     Construction Flow has neither yet. `hapticsEnabled` is accepted and ignored so the
//     call sites stay identical across games and wiring it later is a one-line change.
//
// - `persistKey`, if provided, remembers expanded/collapsed state in AsyncStorage so the
//   preference survives app restarts. Failures to read/write storage are non-fatal — the
//   section just falls back to `defaultExpanded` for that session.
// - `alwaysVisible` content should NOT be placed inside `children` — render urgent
//   warnings/claimable rewards outside this component entirely, per #491's requirement that
//   collapsing never hides critical alerts.

const STORAGE_PREFIX = "wildbear_collapsible_v1_";

const DEFAULT_COLORS = {
  background: "#141C2E",
  border: "#26314A",
  text: "#F4F6FB",
  sub: "#8891A8",
  accent: "#3B82F6",
};

export default function CollapsibleSection({
  title,
  summary,
  badge,
  children,
  defaultExpanded = false,
  persistKey,
  colors,
  style,
  testID,
  // Accepted for call-site parity with FleetFlow; Construction Flow has no haptics yet, so
  // this is read and discarded rather than dropped from the signature.
  hapticsEnabled = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hydrated, setHydrated] = useState(!persistKey);
  const c = { ...DEFAULT_COLORS, ...colors };

  useEffect(() => {
    let cancelled = false;
    if (!persistKey) return undefined;
    AsyncStorage.getItem(STORAGE_PREFIX + persistKey)
      .then((raw) => {
        if (cancelled || raw == null) return;
        setExpanded(raw === "1");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [persistKey]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (persistKey) {
      AsyncStorage.setItem(STORAGE_PREFIX + persistKey, next ? "1" : "0").catch(() => {});
    }
    // Haptics land here when Construction Flow grows a haptics helper and a presentation
    // setting to gate it, matching FleetFlow. Until then the flag is intentionally inert.
    if (hapticsEnabled) { /* no-op until Construction Flow has haptics */ }
    
  };

  // Avoid a one-frame flash of the wrong state while the persisted preference loads.
  if (!hydrated) return null;

  return (
    <View
      testID={testID}
      style={[styles.container, { backgroundColor: c.background, borderColor: c.border }, style]}
    >
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={expanded ? "Double tap to collapse" : "Double tap to expand"}
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
            {title}
          </Text>
          {summary ? (
            <Text style={[styles.summary, { color: c.sub }]} numberOfLines={expanded ? undefined : 1}>
              {summary}
            </Text>
          ) : null}
        </View>
        {badge != null ? (
          <View style={[styles.badge, { borderColor: c.accent }]}>
            <Text style={[styles.badgeText, { color: c.accent }]}>{badge}</Text>
          </View>
        ) : null}
        <Text style={[styles.chevron, { color: c.sub }]} accessibilityElementsHidden importantForAccessibility="no">
          {expanded ? "⌃" : "⌄"}
        </Text>
      </TouchableOpacity>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerText: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  summary: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  chevron: {
    fontSize: 18,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
