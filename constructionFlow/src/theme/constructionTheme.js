// Construction Flow design system — the single source of truth for colour, type, spacing,
// radius and elevation.
//
// WHY THIS FILE EXISTS
// --------------------
// Construction Flow was forked from FleetFlow Simulator and inherited its palette byte for
// byte: the same navy, the same blue-and-cyan primary. Played side by side the two games
// looked like one app with different nouns. It also inherited a 32-entry StyleSheet carrying
// 503 inline style overrides, so no two cards showing the same kind of information matched.
//
// Everything here is presentational. Nothing in this module reads or writes game state, so no
// value in it can change what the simulation does. See FLEETFLOW_PARITY_AUDIT.md §2 gaps 1–4.
//
// CONSTRUCTION IDENTITY
// ---------------------
//   Surfaces   charcoal-navy, warmer and darker than FleetFlow's navy — a site at dusk.
//   Primary    construction amber. This is the colour of action: bid, mobilise, buy, build.
//   Safe       safety green. Reserved for "go / healthy / passed". Never used for a CTA,
//              because a green button in a game whose green means "safe" is ambiguous.
//   Caution    hi-vis yellow. Degrading, but nothing has failed yet.
//   Hazard     signal red. Stop: overdue, broken, unaffordable, unsafe.
//   Steel      blue-grey. Informational and structural, never an alarm.
//
// The colour KEYS are unchanged from the inherited theme (`bg`, `panel`, `orange`, `green`, …)
// so all 503 existing call sites keep working and shift coherently. New semantic keys
// (`accent`, `surface`, `hazard`, …) are additive and are what new code should use.

// ─── Scales ──────────────────────────────────────────────────────────────────

// 4pt grid. Replaces the ad-hoc 2/3/4/5/6/8/10 margins the screen had grown.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// The floor that fixes the audit's most visible defect: 51% of Construction Flow's font sizes
// were 10px or smaller, including body copy at 9px, against FleetFlow's 18%. Anything a player
// has to *read* sits at or above MIN_BODY. 11px is allowed only for uppercase eyebrow labels,
// which are short, spaced and high-contrast — the one place FleetFlow uses small type too.
export const MIN_BODY_FONT_SIZE = 12;
export const MIN_EYEBROW_FONT_SIZE = 11;

// Named type roles. `eyebrow` is the hierarchy primitive Construction Flow was missing: an
// uppercase, letter-spaced label above a large value above a small explanation. It is what
// makes a FleetFlow card scannable in a way a same-size title never is.
export const TYPE = {
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 13, lineHeight: 19 },
  bodyStrong: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "700" },
  title: { fontSize: 18, fontWeight: "800" },
  stat: { fontSize: 20, fontWeight: "800" },
  statLarge: { fontSize: 26, fontWeight: "900" },
  hero: { fontSize: 32, fontWeight: "900" },
};

// Two depth levels only. Flat cards on a flat background were a large part of why every
// Construction Flow card read as equally important; more than two levels just adds noise.
export const ELEVATION = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hero: {
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
};

// Minimum comfortable tap target. The inherited site cards had 9px-text buttons with 2px
// vertical padding — roughly 14pt tall against Apple's 44pt guidance.
export const MIN_TAP_TARGET = 44;

// ─── Themes ──────────────────────────────────────────────────────────────────

export const THEMES = {
  dark: {
    // Surfaces — charcoal-navy. Darker and warmer than the inherited #071224 navy.
    bg: "#0a1018",
    panel: "#141c28",
    panel2: "#1b2533",
    panel3: "#232f40",
    border: "#2c3949",
    strongBorder: "#405168",
    text: "#f6f8fb",
    sub: "#94a3b8",
    dim: "#64748b",

    // Semantic roles — what new code should use.
    accent: "#f59e0b", // construction amber: the colour of action
    accentSoft: "#fbbf24",
    safe: "#22c55e", // safety green: go / healthy / passed
    caution: "#facc15", // hi-vis yellow: degrading
    hazard: "#ef4444", // signal red: stop
    steel: "#60a5fa", // informational, structural
    surface: "#141c28",
    surfaceAlt: "#1b2533",

    // Legacy keys, retuned. Kept so the existing call sites keep working.
    green: "#22c55e",
    red: "#ef4444",
    blue: "#60a5fa",
    orange: "#f59e0b",
    purple: "#a78bfa",
    cyan: "#38bdf8",
    yellow: "#facc15",
    tabBar: "#111824",
    track: "#0d141d",
    shadow: "#000000",
  },
  light: {
    bg: "#eef1f6",
    panel: "#ffffff",
    panel2: "#f5f7fb",
    panel3: "#e9eef5",
    border: "#ccd5e2",
    strongBorder: "#aab8cc",
    text: "#101822",
    sub: "#55657c",
    dim: "#7c8a9e",

    accent: "#c2680a",
    accentSoft: "#d97706",
    safe: "#15803d",
    caution: "#a16207",
    hazard: "#dc2626",
    steel: "#1d4ed8",
    surface: "#ffffff",
    surfaceAlt: "#f5f7fb",

    green: "#15803d",
    red: "#dc2626",
    blue: "#1d4ed8",
    orange: "#c2680a",
    purple: "#6d28d9",
    cyan: "#0369a1",
    yellow: "#a16207",
    tabBar: "#ffffff",
    track: "#d6dee9",
    shadow: "#94a3b8",
  },
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

const TONE_KEYS = {
  accent: "accent",
  action: "accent",
  safe: "safe",
  success: "safe",
  good: "safe",
  green: "safe",
  caution: "caution",
  warning: "caution",
  yellow: "caution",
  orange: "accent",
  hazard: "hazard",
  danger: "hazard",
  bad: "hazard",
  red: "hazard",
  info: "steel",
  steel: "steel",
  blue: "steel",
  cyan: "steel",
  neutral: "sub",
  muted: "sub",
};

// One tone vocabulary for the whole game. Previously each card picked its own colour inline,
// so a cyan bar meant phase progress in one card and something unrelated two cards below.
export function toneColor(tone, T) {
  const theme = T || THEMES.dark;
  const key = TONE_KEYS[tone];
  if (key && theme[key]) return theme[key];
  // Allow a raw theme key ("purple") or a literal hex to pass straight through, so callers
  // migrating from inline colours never end up with an invisible element.
  if (tone && typeof tone === "string") {
    if (theme[tone]) return theme[tone];
    if (tone.startsWith("#")) return tone;
  }
  return theme.sub;
}

// Percent → tone. Used by every progress bar so "how far along is this" always reads the same.
export function progressTone(percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return "neutral";
  if (percent >= 90) return "safe";
  if (percent >= 60) return "accent";
  if (percent >= 30) return "caution";
  return "hazard";
}

// Equipment condition → tone. Matches the thresholds the simulation already enforces:
// below 40 the screen flags it, below 30 it blocks assignment.
export function conditionTone(condition) {
  if (typeof condition !== "number" || !Number.isFinite(condition)) return "neutral";
  if (condition >= 70) return "safe";
  if (condition >= 40) return "caution";
  return "hazard";
}

// Days remaining against a contract deadline → tone.
export function deadlineTone(daysLeft) {
  if (typeof daysLeft !== "number" || !Number.isFinite(daysLeft)) return "neutral";
  if (daysLeft < 0) return "hazard";
  if (daysLeft <= 2) return "hazard";
  if (daysLeft <= 5) return "caution";
  return "safe";
}

// Compact money for tiles and chips where the full figure would wrap. The long form stays in
// ledgers and confirmations — a player approving a purchase should see every digit.
export function compactMoney(value) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

// Signed money, for deltas where the direction is the point.
export function signedMoney(value) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${amount >= 0 ? "+" : ""}${compactMoney(amount)}`;
}

// Every tab gets an empty state that explains what the screen is for and what to do next, so
// the player learns that an empty screen is never a broken one. FleetFlow has the same helper
// (`getFleetFlowEmptyStateMessage`); Construction Flow had good copy on two tabs and nothing
// on the rest.
const EMPTY_STATES = {
  Home: {
    icon: "home-outline",
    title: "Nothing needs you right now",
    body: "No warnings, no overdue work. Take a bid while the crew is free.",
    cta: "Browse Bids",
    tab: "Bids",
  },
  Bids: {
    icon: "document-text-outline",
    title: "No open invitations to bid",
    body: "New RFPs are issued as the market moves. Reputation and completed work bring bigger ones.",
    cta: null,
    tab: null,
  },
  Sites: {
    icon: "construct-outline",
    title: "No active job sites",
    body: "Win a contract, assign a crew and equipment, then mobilise to break ground.",
    cta: "Go to Bids",
    tab: "Bids",
  },
  Crew: {
    icon: "people-outline",
    title: "Nobody on the books",
    body: "Post a job or hire an applicant. Crews cost wages every day — hire to the work you have won.",
    cta: null,
    tab: null,
  },
  Equipment: {
    icon: "hammer-outline",
    title: "The yard is empty",
    body: "Buy or finance a machine. Every contract lists the equipment its phases need.",
    cta: null,
    tab: null,
  },
  Finance: {
    icon: "wallet-outline",
    title: "No financial activity yet",
    body: "Complete a contract to start the books. Loans, taxes and weekly P&L all land here.",
    cta: null,
    tab: null,
  },
  Empire: {
    icon: "trophy-outline",
    title: "One office, one market",
    body: "Grow company value to unlock new cities, yards and regional offices.",
    cta: null,
    tab: null,
  },
};

export function getEmptyState(tab) {
  return (
    EMPTY_STATES[tab] || {
      icon: "information-circle-outline",
      title: "Nothing here yet",
      body: "Keep building — the next move is usually one contract away.",
      cta: null,
      tab: null,
    }
  );
}

// Adds transparency to a theme colour for tinted backgrounds and soft borders. Takes the
// 0–1 alpha the caller means rather than making every call site remember that "22" is 13%.
export function alpha(hexColor, a) {
  if (typeof hexColor !== "string" || !hexColor.startsWith("#")) return hexColor;
  const clamped = Math.max(0, Math.min(1, typeof a === "number" && Number.isFinite(a) ? a : 1));
  const byte = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  // Only 6-digit hex is supported; an 8-digit value already carries its own alpha.
  if (hexColor.length !== 7) return hexColor;
  return `${hexColor}${byte}`;
}
