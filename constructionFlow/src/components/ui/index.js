// Construction Flow shared UI primitives.
//
// Before this module the screen rebuilt every badge, bar, tile and empty state from scratch at
// the point of use — 503 inline style objects against a 32-entry StyleSheet, so two cards
// showing the same kind of thing never quite matched. These eight components are the parts the
// screen was rebuilding, extracted once with the design system's tokens baked in.
//
// Every component here is presentational: it takes a theme and already-computed values and
// renders them. None of them read or write game state, so none of them can change what the
// simulation does.
//
// All of them take `T` (a theme object from src/theme/constructionTheme.js) rather than
// importing a theme directly, because the screen flips between dark and light at runtime.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SPACING,
  RADIUS,
  TYPE,
  ELEVATION,
  MIN_TAP_TARGET,
  THEMES,
  toneColor,
  alpha,
} from "../../theme/constructionTheme";

const fallbackTheme = THEMES.dark;

// ─── Card ────────────────────────────────────────────────────────────────────
// The surface everything else sits on. `tone` adds the 4px left accent stripe and tints the
// border, which is how a card says "I matter more than the one above me" without words —
// the single biggest reason a FleetFlow screen reads as ranked and a Construction Flow screen
// read as a list.
export function Card({
  T = fallbackTheme,
  tone = null,
  elevated = false,
  padded = true,
  style,
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}) {
  const accent = tone ? toneColor(tone, T) : null;
  const cardStyle = [
    {
      backgroundColor: T.panel,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: accent ? alpha(accent, 0.4) : T.border,
      padding: padded ? SPACING.md + 2 : 0,
      marginBottom: SPACING.md - 2,
    },
    accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null,
    elevated ? ELEVATION.card : null,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

// ─── SectionLabel ────────────────────────────────────────────────────────────
// The uppercase, letter-spaced eyebrow. This is the hierarchy primitive the game was missing:
// a small quiet label above a large loud value reads instantly, where two 15px titles in a row
// have to be read word by word.
export function SectionLabel({ T = fallbackTheme, children, tone = null, style, right = null }) {
  const color = tone ? toneColor(tone, T) : T.sub;
  const label = (
    <Text style={[TYPE.eyebrow, { color }, style]} accessibilityRole="header">
      {children}
    </Text>
  );
  if (!right) return label;
  return (
    <View style={styles.rowBetween}>
      {label}
      {right}
    </View>
  );
}

// ─── Pill ────────────────────────────────────────────────────────────────────
// Status badge. `filled` is for the one status on a card that should shout.
export function Pill({ T = fallbackTheme, label, tone = "info", filled = false, style }) {
  const color = toneColor(tone, T);
  return (
    <View
      style={[
        {
          borderRadius: RADIUS.pill,
          paddingHorizontal: SPACING.sm + 2,
          paddingVertical: 3,
          borderWidth: 1,
          alignSelf: "flex-start",
        },
        filled
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: alpha(color, 0.12), borderColor: alpha(color, 0.65) },
        style,
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: filled ? "#0a1018" : color }}>
        {label}
      </Text>
    </View>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
// One bar for the whole game. An optional label row above it, because a bar without a number
// is decoration — the WildBear UI Standard's rule that progress must communicate something real.
export function ProgressBar({
  T = fallbackTheme,
  percent = 0,
  tone = "accent",
  label = null,
  value = null,
  height = 6,
  style,
}) {
  const color = toneColor(tone, T);
  const safePercent = Math.max(0, Math.min(100, typeof percent === "number" && Number.isFinite(percent) ? percent : 0));
  return (
    <View style={style}>
      {(label || value) && (
        <View style={[styles.rowBetween, { marginBottom: SPACING.xs }]}>
          {label ? <Text style={[TYPE.caption, { color: T.sub }]}>{label}</Text> : <View />}
          {value ? <Text style={[TYPE.caption, { color, fontWeight: "700" }]}>{value}</Text> : null}
        </View>
      )}
      <View
        style={{ height, borderRadius: height / 2, backgroundColor: T.track, overflow: "hidden" }}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: Math.round(safePercent), min: 0, max: 100 }}
      >
        <View style={{ height, width: `${safePercent}%`, backgroundColor: color, borderRadius: height / 2 }} />
      </View>
    </View>
  );
}

// ─── StatTile ────────────────────────────────────────────────────────────────
// A KPI: quiet label, loud value, optional explanation. Designed to sit in a row of two to
// four inside a Card rather than as a card of its own, so related figures group visually.
export function StatTile({ T = fallbackTheme, label, value, sub = null, tone = null, style }) {
  const color = tone ? toneColor(tone, T) : T.text;
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: T.panel2,
          borderRadius: RADIUS.sm,
          paddingHorizontal: SPACING.sm + 2,
          paddingVertical: SPACING.sm + 2,
          borderWidth: 1,
          borderColor: T.border,
        },
        style,
      ]}
    >
      <Text style={[TYPE.eyebrow, { color: T.sub, marginBottom: 3 }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[TYPE.stat, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {sub ? (
        <Text style={[TYPE.caption, { color: T.sub, marginTop: 2 }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

// ─── KeyValueRow ─────────────────────────────────────────────────────────────
// A labelled figure in a list — ledger lines, cost breakdowns, spec sheets.
export function KeyValueRow({ T = fallbackTheme, label, value, tone = null, divider = true, style }) {
  const color = tone ? toneColor(tone, T) : T.text;
  return (
    <View
      style={[
        styles.rowBetween,
        {
          paddingVertical: SPACING.sm - 1,
          borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: T.border,
        },
        style,
      ]}
    >
      <Text style={[TYPE.body, { color: T.sub, flex: 1, marginRight: SPACING.sm }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[TYPE.bodyStrong, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── AlertBanner ─────────────────────────────────────────────────────────────
// A warning that can be acted on. The inherited Early Warnings card rendered bullet dots with
// no way to reach the screen that would fix the problem; FleetFlow's equivalent carries a tap
// target to the relevant tab, which is most of why its warnings feel useful rather than nagging.
export function AlertBanner({
  T = fallbackTheme,
  tone = "caution",
  icon = null,
  title,
  body = null,
  actionLabel = null,
  onAction = null,
  onDismiss = null,
  style,
}) {
  const color = toneColor(tone, T);
  return (
    <View
      style={[
        {
          backgroundColor: alpha(color, 0.08),
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: alpha(color, 0.45),
          borderLeftWidth: 4,
          borderLeftColor: color,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.md - 2,
          marginBottom: SPACING.sm + 2,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={18} color={color} style={{ marginRight: SPACING.sm }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.bodyStrong, { color }]}>{title}</Text>
          {body ? (
            <Text style={[TYPE.caption, { color: T.text, marginTop: 3, lineHeight: 17 }]}>{body}</Text>
          ) : null}
        </View>
        {onDismiss ? (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${title}`}
          >
            <Ionicons name="close" size={18} color={T.sub} />
          </TouchableOpacity>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={{ marginTop: SPACING.sm, alignSelf: "flex-start", paddingVertical: SPACING.xs }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[TYPE.bodyStrong, { color }]}>{actionLabel} →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
// No screen should ever look broken. Icon, what this screen is, what to do next, and — when
// there is one — the button that does it.
export function EmptyState({ T = fallbackTheme, icon = "information-circle-outline", title, body, ctaLabel = null, onCta = null, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: T.panel,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: T.border,
          borderStyle: "dashed",
          paddingHorizontal: SPACING.xl,
          paddingVertical: SPACING.xxl,
          alignItems: "center",
          marginBottom: SPACING.md,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: alpha(T.accent, 0.12),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SPACING.md,
        }}
      >
        <Ionicons name={icon} size={28} color={T.accent} />
      </View>
      <Text style={[TYPE.label, { color: T.text, textAlign: "center", marginBottom: SPACING.xs }]}>{title}</Text>
      <Text style={[TYPE.body, { color: T.sub, textAlign: "center", maxWidth: 320 }]}>{body}</Text>
      {ctaLabel && onCta ? (
        <TouchableOpacity
          style={{
            marginTop: SPACING.lg,
            backgroundColor: T.accent,
            borderRadius: RADIUS.sm,
            paddingHorizontal: SPACING.xl,
            minHeight: MIN_TAP_TARGET,
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={{ color: "#0a1018", fontWeight: "800", fontSize: 14 }}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
