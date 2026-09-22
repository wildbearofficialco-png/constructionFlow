// Construction KPIs: how the company is actually performing, measured from things that exist.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 7. Audit rows 36 and 37 said `analyticsEngine` was "ticked every day and almost never
// shown — data is collected; the player can't see it." That was half right, and the half it got
// wrong is the more interesting half.
//
// `analyticsEngine.js` is FleetFlow's, shared verbatim. Every input it reads is a FleetFlow
// field that DOES NOT EXIST in Construction Flow:
//
//   it reads                     Construction Flow has          so the KPI is
//   ------------------------------------------------------------------------------------
//   weeklyStats.completedRoutes  (nothing)                      onTimeRate = 1.00, always
//   weeklyStats.lateDeliveries   (nothing)                      "
//   weeklyStats.routeIncome      (nothing)                      revenue = 0, always
//   weeklyStats.wages/fuel/rent  (nothing)                      expenses = 0, always
//   v.status === "En Route"      "Active"/"Idle"/"Broken"       utilization = 0.00, always
//   game.customerRating          (nothing)                      3.5, forever
//
// Construction Flow's weeklyStats is `{revenue, expenses, jobsCompleted, unexpectedCosts,
// savingsInterest}` — none of the names above. So the engine was not merely unsurfaced: it was
// snapshotting a row of zeros, a permanent 100% on-time rate and a permanent 0% utilisation
// every seven days and keeping 26 of them in the save.
//
// It also carries a genuine operator-precedence bug that would misreport FleetFlow too:
//
//   const totalExpenses = game.weeklyStats?.wages || 0 + (game.weeklyStats?.fuel || 0) + ...
//
// `||` binds looser than `+`, so that parses as `wages || (0 + fuel + repairs + ...)`. Whenever
// wages is non-zero, every other expense line is silently discarded.
//
// Surfacing those numbers would have been worse than leaving them hidden — it would have put
// confident, precise, wrong figures in front of the player. So this module computes
// construction KPIs from fields Construction Flow actually maintains, and the Performance card
// reads this, not the FleetFlow engine.
//
// Everything is pure and RNG-free. Presentation must never consume a Math.random() draw — the
// discipline FleetFlow's build 59 post-mortem established.

// ─── What a construction company is judged on ────────────────────────────────
//
// Translated, not copied — the instruction that has governed this whole effort. "Revenue per
// vehicle" becomes revenue per crew member; "cost per route" becomes cost per active job site;
// "fleet utilisation" becomes plant utilisation.

export const KPI_DEFS = [
  {
    key: "onTimeRate",
    label: "On-Time Completion",
    help: "Jobs delivered by their deadline",
    format: "percent",
    good: 0.75, great: 0.92,
  },
  {
    key: "plantUtilisation",
    label: "Plant Utilisation",
    help: "Machines working rather than sitting in the yard",
    format: "percent",
    good: 0.55, great: 0.80,
  },
  {
    key: "crewUtilisation",
    label: "Crew Utilisation",
    help: "People on site rather than idle",
    format: "percent",
    good: 0.60, great: 0.85,
  },
  {
    key: "profitMargin",
    label: "Profit Margin",
    help: "What you keep of what you bill",
    format: "percent",
    good: 0.12, great: 0.28,
  },
  {
    key: "revenuePerCrew",
    label: "Revenue / Crew / Week",
    help: "What each person on the books brings in",
    format: "money",
    good: 3000, great: 6000,
  },
  {
    key: "bidWinRate",
    label: "Bid Win Rate",
    help: "Contracts won as a share of those bid",
    format: "percent",
    good: 0.40, great: 0.65,
  },
  {
    key: "plantCondition",
    label: "Plant Condition",
    help: "Average condition across the yard",
    format: "percent",
    good: 0.65, great: 0.85,
  },
  {
    key: "clientRetention",
    label: "Client Retention",
    help: "Clients who came back for more work",
    format: "percent",
    good: 0.30, great: 0.55,
  },
];

export const KPI_SNAPSHOT_INTERVAL = 7;  // days
export const MAX_KPI_SNAPSHOTS = 26;     // ~6 months, matching the engine it replaces

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function safeDiv(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  const out = numerator / denominator;
  return Number.isFinite(out) ? out : 0;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// A KPI with no data behind it yet is `null`, not zero. Zero is a claim — "you are performing
// terribly" — and a company on day 3 that has not bid on anything has not earned that claim.
// The card renders these as "Not enough history yet".
function rate(value, hasData) {
  return hasData ? value : null;
}

// ─── Measurement ─────────────────────────────────────────────────────────────

export function computeKPIs(gameState) {
  const game = gameState || {};

  const equipment = arr(game.equipment);
  const crew = arr(game.crew);
  const sites = arr(game.activeSites);
  const history = arr(game.jobHistory);

  // On-time completion. jobHistory carries `daysLate` from Sprint 7 onward; older entries
  // predate the field and are excluded rather than assumed on time, which would flatter a
  // returning player's record.
  const rated = history.filter((j) => j && Number.isFinite(j.daysLate));
  const onTime = rated.filter((j) => j.daysLate === 0).length;
  const onTimeRate = rate(clamp01(safeDiv(onTime, rated.length)), rated.length > 0);

  // Plant utilisation. A broken machine is not idle by choice, so it is excluded from the
  // denominator — otherwise a breakdown would read as a management failure.
  const usable = equipment.filter((e) => e && e.status !== "Broken");
  const working = usable.filter((e) => e.status === "Active").length;
  const plantUtilisation = rate(clamp01(safeDiv(working, usable.length)), usable.length > 0);

  // Crew utilisation. Resting counts as unavailable rather than idle, for the same reason.
  const available = crew.filter((w) => w && w.status !== "Resting");
  const onSite = available.filter((w) => w.status === "Working").length;
  const crewUtilisation = rate(clamp01(safeDiv(onSite, available.length)), available.length > 0);

  // Margin, from the ledger rather than from a weeklyStats field that does not exist. The
  // ledger is trustworthy as of Sprint 6, which instrumented the six modules that were moving
  // cash without recording it.
  const ledger = arr(game.ledger);
  const revenue = ledger.filter((e) => e && e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const spend = ledger.filter((e) => e && e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const profitMargin = rate(
    Math.max(-1, Math.min(1, safeDiv(revenue - spend, revenue))),
    revenue > 0
  );

  // Revenue per head per week, annualised down from the whole ledger so a short game is not
  // judged on a single payout.
  const weeks = Math.max(1, (Number.isFinite(game.day) ? game.day : 1) / 7);
  const revenuePerCrew = rate(
    Math.round(safeDiv(revenue / weeks, crew.length)),
    crew.length > 0 && revenue > 0
  );

  // Bid win rate, from counters Sprint 7 adds. Before the first resolved bid there is no rate.
  const won = Number.isFinite(game.bidsWon) ? game.bidsWon : 0;
  const lost = Number.isFinite(game.bidsLost) ? game.bidsLost : 0;
  const bidWinRate = rate(clamp01(safeDiv(won, won + lost)), won + lost > 0);

  // Condition across the whole yard, broken machines included — a yard full of wrecks IS a
  // condition problem, unlike utilisation.
  const conditions = equipment.filter((e) => e && Number.isFinite(e.condition));
  const plantCondition = rate(
    clamp01(safeDiv(conditions.reduce((s, e) => s + e.condition, 0), conditions.length) / 100),
    conditions.length > 0
  );

  // Retention: clients who have given you more than one job.
  const rels = game.clientRelationships && typeof game.clientRelationships === "object"
    ? Object.values(game.clientRelationships) : [];
  const repeat = rels.filter((r) => r && (r.jobsDone || 0) > 1).length;
  const clientRetention = rate(clamp01(safeDiv(repeat, rels.length)), rels.length > 0);

  return {
    onTimeRate,
    plantUtilisation,
    crewUtilisation,
    profitMargin,
    revenuePerCrew,
    bidWinRate,
    plantCondition,
    clientRetention,
    // Context the card shows alongside the grades, so a bad rate is readable as "1 of 3 late"
    // rather than an abstract percentage.
    context: {
      ratedJobs: rated.length,
      lateJobs: rated.length - onTime,
      machines: equipment.length,
      machinesWorking: working,
      crew: crew.length,
      crewOnSite: onSite,
      activeSites: sites.length,
      bidsResolved: won + lost,
      clients: rels.length,
      repeatClients: repeat,
    },
  };
}

// ─── Grading ─────────────────────────────────────────────────────────────────

export function gradeKPI(def, value) {
  if (!def || value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  if (def.lowerIsBetter) {
    if (value <= def.great) return "great";
    if (value <= def.good) return "good";
    return "poor";
  }
  if (value >= def.great) return "great";
  if (value >= def.good) return "good";
  return "poor";
}

export function formatKPI(def, value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (def.format === "percent") return `${Math.round(value * 100)}%`;
  if (def.format === "money") return `$${Math.round(value).toLocaleString()}`;
  return String(Math.round(value));
}

// One row per KPI, ready to render: value, grade, formatted display, and whether there is
// enough history to say anything at all.
export function buildKPIRows(gameState) {
  const kpis = computeKPIs(gameState);
  return KPI_DEFS.map((def) => {
    const value = kpis[def.key];
    const grade = gradeKPI(def, value);
    return {
      key: def.key,
      label: def.label,
      help: def.help,
      value,
      grade,
      display: formatKPI(def, value),
      ready: value !== null && value !== undefined && Number.isFinite(value),
    };
  });
}

// ─── History ─────────────────────────────────────────────────────────────────

export function initKPIs(game) {
  if (!game) return;
  if (!game.kpiHistory || typeof game.kpiHistory !== "object" || Array.isArray(game.kpiHistory)) {
    game.kpiHistory = { snapshots: [], lastSnapshotDay: 0 };
  }
  if (!Array.isArray(game.kpiHistory.snapshots)) game.kpiHistory.snapshots = [];
  if (!Number.isFinite(game.kpiHistory.lastSnapshotDay)) game.kpiHistory.lastSnapshotDay = 0;
}

export function tickConstructionKPIs(game) {
  if (!game) return;
  initKPIs(game);
  const day = Number.isFinite(game.day) ? game.day : 0;
  if (day <= 0) return;
  if (day - game.kpiHistory.lastSnapshotDay < KPI_SNAPSHOT_INTERVAL) return;

  const kpis = computeKPIs(game);
  const snapshot = { day, week: Math.floor(day / 7) };
  for (const def of KPI_DEFS) snapshot[def.key] = kpis[def.key];

  game.kpiHistory.snapshots = [snapshot, ...game.kpiHistory.snapshots].slice(0, MAX_KPI_SNAPSHOTS);
  game.kpiHistory.lastSnapshotDay = day;
}

// Oldest-first, for a sparkline. Entries where the KPI had no data are dropped rather than
// plotted as zero.
export function getKPITrend(game, key, limit = 8) {
  const snaps = arr(game?.kpiHistory?.snapshots);
  return snaps
    .filter((s) => s && Number.isFinite(s[key]))
    .slice(0, Math.max(0, limit))
    .map((s) => ({ day: s.day, value: s[key] }))
    .reverse();
}

// "Up", "down" or "flat" against the previous snapshot — the thing a player actually wants to
// know from a number they saw last week.
export function describeKPIDirection(game, key) {
  const trend = getKPITrend(game, key, 8);
  if (trend.length < 2) return { direction: "flat", delta: 0, hasTrend: false };
  const latest = trend[trend.length - 1].value;
  const previous = trend[trend.length - 2].value;
  const delta = latest - previous;
  const meaningful = Math.abs(delta) > Math.max(0.01, Math.abs(previous) * 0.02);
  return {
    direction: !meaningful ? "flat" : delta > 0 ? "up" : "down",
    delta,
    hasTrend: true,
  };
}

// ─── The headline ────────────────────────────────────────────────────────────

// The single weakest thing the company is doing, and what to do about it. A dashboard of eight
// numbers with no verdict is a spreadsheet; naming the worst one is what makes it advice.
export function summarizePerformance(gameState) {
  const rows = buildKPIRows(gameState).filter((r) => r.ready);
  if (rows.length === 0) {
    return {
      ready: false,
      headline: "Not enough history yet",
      detail: "Finish a job, bid on work and put machines on site — your numbers start here.",
      weakest: null,
      strongest: null,
    };
  }

  const rank = { poor: 0, good: 1, great: 2 };
  const sorted = [...rows].sort((a, b) => rank[a.grade] - rank[b.grade]);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  const ADVICE = {
    onTimeRate: "Deadlines are slipping. Put more crew on the sites closest to their deadline.",
    plantUtilisation: "Machines are sitting idle. Assign them to sites, or sell what you are not using.",
    crewUtilisation: "People are idle on your payroll. Take on more work or trim the roster.",
    profitMargin: "You are billing well and keeping little. Check material costs and overtime.",
    revenuePerCrew: "Each person is bringing in less than they cost. Bid on bigger work.",
    bidWinRate: "You are losing most bids. Try a lower bid style, or build reputation on smaller jobs.",
    plantCondition: "The yard is wearing out. Service machines before they break on site.",
    clientRetention: "Clients are not coming back. Deliver on time and at quality to earn repeat work.",
  };

  // The verdict keys off whether anything is actually POOR, not off whether everything is
  // great. Demanding a perfect scorecard before saying "nothing is dragging" would nag a
  // well-run company forever, which is the opposite of useful.
  const poor = rows.filter((r) => r.grade === "poor");

  return {
    ready: true,
    headline: poor.length === 0
      ? "Every measure is strong"
      : `Weakest: ${weakest.label}`,
    detail: poor.length === 0
      ? "Nothing is dragging. Take on bigger work."
      : ADVICE[weakest.key] || "",
    weakest,
    strongest,
    poorCount: rows.filter((r) => r.grade === "poor").length,
    greatCount: rows.filter((r) => r.grade === "great").length,
    readyCount: rows.length,
  };
}
