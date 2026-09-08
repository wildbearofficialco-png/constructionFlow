// Business Analytics & KPI Engine
// Weekly snapshots, trend data, KPIs, and performance benchmarks.
// Feeds the Finance tab charts and weekly email report.
// Integrates with financialLedger, demandPricing, staffPerformance, customerSatisfaction.

import { clamp } from "./utils.js";

const SNAPSHOT_INTERVAL = 7; // days between snapshots
const MAX_SNAPSHOTS = 26;    // ~6 months of weekly history

export const KPI_BENCHMARKS = {
  revenuePerVehicle:  { good: 1200, great: 2000, label: "Revenue / Vehicle / Week" },
  onTimeRate:         { good: 0.80, great: 0.92, label: "On-Time Delivery Rate" },
  costPerRoute:       { good: 120,  great: 70,   label: "Cost per Route", lowerIsBetter: true },
  utilizationRate:    { good: 0.65, great: 0.82, label: "Fleet Utilization" },
  staffRetention:     { good: 0.80, great: 0.92, label: "Staff Retention Rate" },
  customerRating:     { good: 3.8,  great: 4.5,  label: "Customer Rating" },
  profitMargin:       { good: 0.15, great: 0.30, label: "Profit Margin" },
  contractWinRate:    { good: 0.40, great: 0.65, label: "Contract Win Rate" },
};

function scoreKpi(value, benchmark) {
  if (benchmark.lowerIsBetter) {
    if (value <= benchmark.great) return "great";
    if (value <= benchmark.good) return "good";
    return "poor";
  }
  if (value >= benchmark.great) return "great";
  if (value >= benchmark.good) return "good";
  return "poor";
}

export function initAnalytics(game) {
  if (game.analytics) return;
  game.analytics = {
    snapshots: [],
    lastSnapshotDay: 0,
    weeklyReport: null,
    allTimeRevenue: 0,
    allTimeRoutes: 0,
    allTimeExpenses: 0,
  };
}

function captureSnapshot(game) {
  const day = game.day || 0;

  // Fleet metrics
  const vehicles = game.vehicles || game.equipment || [];
  const activeVehicles = vehicles.filter((v) => v.status === "En Route").length;
  const utilizationRate = vehicles.length > 0 ? clamp(activeVehicles / vehicles.length, 0, 1) : 0;

  // Delivery metrics
  const completedRoutes = game.weeklyStats?.completedRoutes || 0;
  const lateDeliveries = game.weeklyStats?.lateDeliveries || 0;
  const onTimeRate = completedRoutes > 0 ? clamp((completedRoutes - lateDeliveries) / completedRoutes, 0, 1) : 1;

  // Financial
  const routeIncome = game.weeklyStats?.routeIncome || 0;
  const contractIncome = game.weeklyStats?.contractIncome || 0;
  const totalRevenue = routeIncome + contractIncome;
  const totalExpenses = game.weeklyStats?.wages || 0
    + (game.weeklyStats?.fuel || 0)
    + (game.weeklyStats?.repairs || 0)
    + (game.weeklyStats?.rent || 0)
    + (game.weeklyStats?.insurance || 0)
    + (game.weeklyStats?.taxes || 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;

  // Per-vehicle revenue
  const revenuePerVehicle = vehicles.length > 0 ? Math.round(totalRevenue / vehicles.length) : 0;

  // Staff metrics
  const workers = game.workers || game.crew || game.staff || [];
  const activeWorkers = workers.filter((w) => !w.fired && w.status !== "Fired");
  const burnoutCount = activeWorkers.filter((w) => w.burnout).length;
  const staffRetention = activeWorkers.length > 0
    ? clamp(1.0 - (game.weeklyStats?.quits || 0) / activeWorkers.length, 0, 1)
    : 1;

  // Cost per route
  const costPerRoute = completedRoutes > 0 ? Math.round(totalExpenses / completedRoutes) : 0;

  // Contract win rate
  const contractHistory = game.contractHistory || [];
  const recentWins = contractHistory.filter((c) => c.completedDay && day - c.completedDay <= 30).length;
  const contractWinRate = recentWins > 0 ? clamp(recentWins / Math.max(recentWins + 2, 5), 0, 1) : 0;

  const snapshot = {
    day,
    week: Math.floor(day / 7),
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    revenuePerVehicle,
    onTimeRate: Math.round(onTimeRate * 100) / 100,
    utilizationRate: Math.round(utilizationRate * 100) / 100,
    costPerRoute,
    staffRetention: Math.round(staffRetention * 100) / 100,
    customerRating: game.customerRating || 3.5,
    contractWinRate: Math.round(contractWinRate * 100) / 100,
    reputation: game.reputation || 0,
    cash: game.cash || 0,
    fleetSize: vehicles.length,
    workerCount: activeWorkers.length,
    burnoutCount,
    completedRoutes,
    demandScore: game.demandScore || 1.0,
  };

  // Update all-time counters
  game.analytics.allTimeRevenue = (game.analytics.allTimeRevenue || 0) + totalRevenue;
  game.analytics.allTimeRoutes = (game.analytics.allTimeRoutes || 0) + completedRoutes;
  game.analytics.allTimeExpenses = (game.analytics.allTimeExpenses || 0) + totalExpenses;

  return snapshot;
}

export function tickAnalytics(game) {
  initAnalytics(game);
  const day = game.day || 0;
  const lastSnap = game.analytics.lastSnapshotDay || 0;

  if (day > 0 && day - lastSnap >= SNAPSHOT_INTERVAL) {
    const snap = captureSnapshot(game);
    game.analytics.snapshots = [snap, ...game.analytics.snapshots].slice(0, MAX_SNAPSHOTS);
    game.analytics.lastSnapshotDay = day;
    game.analytics.weeklyReport = generateWeeklyReport(game, snap);
  }
}

function generateWeeklyReport(game, snap) {
  const prev = game.analytics.snapshots[1];
  const revChange = prev ? snap.totalRevenue - prev.totalRevenue : 0;
  const profitChange = prev ? snap.netProfit - prev.netProfit : 0;

  const highlights = [];
  if (snap.onTimeRate >= 0.92) highlights.push("Excellent on-time rate this week.");
  if (snap.onTimeRate < 0.70) highlights.push("Late deliveries hurting reputation — dispatch earlier.");
  if (snap.utilizationRate < 0.40) highlights.push("Fleet underutilized — hire more drivers or reduce vehicles.");
  if (snap.burnoutCount > 0) highlights.push(`${snap.burnoutCount} worker(s) burned out — reduce shifts.`);
  if (snap.customerRating >= 4.5) highlights.push("Customer ratings outstanding — keep it up.");
  if (snap.customerRating < 3.0) highlights.push("Customer satisfaction falling — check staffing.");

  return {
    week: snap.week,
    day: snap.day,
    revenue: snap.totalRevenue,
    expenses: snap.totalExpenses,
    netProfit: snap.netProfit,
    revChange,
    profitChange,
    highlights,
    kpis: {
      revenuePerVehicle: { value: snap.revenuePerVehicle, rating: scoreKpi(snap.revenuePerVehicle, KPI_BENCHMARKS.revenuePerVehicle) },
      onTimeRate: { value: snap.onTimeRate, rating: scoreKpi(snap.onTimeRate, KPI_BENCHMARKS.onTimeRate) },
      utilizationRate: { value: snap.utilizationRate, rating: scoreKpi(snap.utilizationRate, KPI_BENCHMARKS.utilizationRate) },
      profitMargin: { value: snap.profitMargin, rating: scoreKpi(snap.profitMargin, KPI_BENCHMARKS.profitMargin) },
      staffRetention: { value: snap.staffRetention, rating: scoreKpi(snap.staffRetention, KPI_BENCHMARKS.staffRetention) },
      customerRating: { value: snap.customerRating, rating: scoreKpi(snap.customerRating, KPI_BENCHMARKS.customerRating) },
    },
  };
}

// Returns last N snapshots in chronological order (oldest first) for chart rendering
export function getAnalyticsTrend(game, limit = 8) {
  initAnalytics(game);
  return [...(game.analytics.snapshots || [])].reverse().slice(-limit);
}

export function getAnalyticsSummary(game) {
  initAnalytics(game);
  const snap = game.analytics.snapshots[0];
  if (!snap) {
    return { ready: false, snapshots: [], weeklyReport: null, allTime: { revenue: 0, routes: 0 } };
  }
  return {
    ready: true,
    latest: snap,
    weeklyReport: game.analytics.weeklyReport,
    snapshots: game.analytics.snapshots,
    trend: getAnalyticsTrend(game, 8),
    allTime: {
      revenue: game.analytics.allTimeRevenue || 0,
      routes: game.analytics.allTimeRoutes || 0,
      expenses: game.analytics.allTimeExpenses || 0,
    },
  };
}
