// Financial Ledger System
// Tracks every cash movement by category. Provides P&L, cash flow,
// and daily/weekly summaries. Integrates with all other systems.

import { uid, clamp, addLog, money } from "./utils.js";

export const EXPENSE_CATEGORIES = {
  payroll:     { label: "Payroll",       icon: "people",          color: "#ef4444" },
  fuel:        { label: "Fuel",          icon: "car",             color: "#f59e0b" },
  maintenance: { label: "Maintenance",   icon: "construct",       color: "#f97316" },
  insurance:   { label: "Insurance",     icon: "shield-checkmark",color: "#8b5cf6" },
  utilities:   { label: "Utilities",     icon: "flash",           color: "#06b6d4" },
  inventory:   { label: "Inventory",     icon: "cube",            color: "#3b82f6" },
  taxes:       { label: "Taxes",         icon: "document-text",   color: "#ec4899" },
  fines:       { label: "Fines & Legal", icon: "warning",         color: "#ef4444" },
  misc:        { label: "Miscellaneous", icon: "ellipsis-horizontal", color: "#94a3b8" },
};

export const REVENUE_CATEGORIES = {
  deliveries:  { label: "Deliveries",   icon: "cube",            color: "#22c55e" },
  contracts:   { label: "Contracts",    icon: "briefcase",       color: "#3b82f6" },
  services:    { label: "Services",     icon: "construct",       color: "#06b6d4" },
  rent:        { label: "Rent Income",  icon: "home",            color: "#8b5cf6" },
  bonuses:     { label: "Bonuses",      icon: "star",            color: "#eab308" },
  misc:        { label: "Other Income", icon: "cash",            color: "#94a3b8" },
};

export function recordTransaction(game, category, amount, description) {
  if (!Array.isArray(game.ledger)) game.ledger = [];
  const entry = {
    id: uid(),
    day: game.day || 0,
    category,
    amount,
    description,
    balance: (game.cash || 0) + amount,
  };
  game.ledger.unshift(entry);
  if (game.ledger.length > 200) game.ledger.length = 200;

  if (!game.weeklyStats) game.weeklyStats = {};
  if (amount < 0) {
    game.weeklyStats.expenses = (game.weeklyStats.expenses || 0) + Math.abs(amount);
  } else {
    game.weeklyStats.revenue = (game.weeklyStats.revenue || 0) + amount;
  }
  game.weeklyStats.netProfit = (game.weeklyStats.revenue || 0) - (game.weeklyStats.expenses || 0);
}

export function processDailyFinancials(game) {
  const workers = Array.isArray(game.workers) ? game.workers
    : Array.isArray(game.crew) ? game.crew
    : [];

  // Payroll — daily wage slice (hourly * 8h shift, only on-shift workers)
  const onShiftWorkers = workers.filter((w) => w.onShift !== false && w.status !== "Resting");
  const payroll = onShiftWorkers.reduce((sum, w) => sum + Math.round((w.wagePerHour || 12) * 8), 0);
  if (payroll > 0) {
    game.cash = (game.cash || 0) - payroll;
    recordTransaction(game, "payroll", -payroll, `Daily wages — ${onShiftWorkers.length} workers`);
  }

  // Support staff payroll
  const support = (game.supportStaff || []);
  const supportWages = support.reduce((sum, s) => sum + Math.round((s.salary || 400) / 30), 0);
  if (supportWages > 0) {
    game.cash -= supportWages;
    recordTransaction(game, "payroll", -supportWages, `Support staff daily cost — ${support.length} staff`);
  }

  // Utilities — flat daily rate scaled to fleet/crew size
  const utilityBase = 18 + (workers.length * 4) + ((game.vehicles || game.equipment || []).length * 6);
  game.cash -= utilityBase;
  recordTransaction(game, "utilities", -utilityBase, "Daily utilities");

  // Insurance — per vehicle, already handled by FleetFlow's own calc but log it
  // (Skip double-deduction: only log if not already handled by game's own insurance code)
  // Insurance logging is handled by the game itself via its own calcVehicleInsurance()

  // Fuel consumption for active vehicles
  const vehicles = (game.vehicles || game.equipment || []).filter((v) => v.status === "En Route");
  const ecoMods = game.economy ? game.economy.fuelPriceIndex : 1.0;
  const fuelCost = vehicles.reduce((sum, v) => {
    const base = Math.round((v.maintenance || 50) * 0.12 * (game.fuelPriceMultiplier || 1.0) * ecoMods);
    return sum + base;
  }, 0);
  if (fuelCost > 0) {
    game.cash -= fuelCost;
    recordTransaction(game, "fuel", -fuelCost, `Fuel — ${vehicles.length} active vehicles`);
  }

  // Depreciation (non-cash but tracked for P&L reporting)
  const allVehicles = game.vehicles || game.equipment || [];
  const depreciationLog = allVehicles.reduce((sum, v) => sum + Math.round((v.price || 8000) * 0.0003), 0);
  if (!game.weeklyStats) game.weeklyStats = {};
  game.weeklyStats.depreciation = (game.weeklyStats.depreciation || 0) + depreciationLog;
}

export function recordRevenue(game, category, amount, description) {
  game.cash = (game.cash || 0) + amount;
  recordTransaction(game, category, amount, description);
}

export function getFinancialSummary(game, days = 7) {
  const ledger = game.ledger || [];
  const cutoff = (game.day || 0) - days;
  const recent = ledger.filter((e) => e.day >= cutoff);

  const expensesByCategory = {};
  const revenueByCategory = {};
  let totalRevenue = 0;
  let totalExpenses = 0;

  recent.forEach((e) => {
    if (e.amount < 0) {
      totalExpenses += Math.abs(e.amount);
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Math.abs(e.amount);
    } else {
      totalRevenue += e.amount;
      revenueByCategory[e.category] = (revenueByCategory[e.category] || 0) + e.amount;
    }
  });

  const netProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    margin,
    expensesByCategory,
    revenueByCategory,
    cashOnHand: game.cash || 0,
    runway: totalExpenses > 0 ? Math.round(((game.cash || 0) / (totalExpenses / days))) : 999,
    weeklyStats: game.weeklyStats || {},
  };
}

export function getDailyPnL(game, day) {
  return (game.ledger || []).filter((e) => e.day === day);
}

export function getLedgerTrend(game, days = 14) {
  const result = [];
  const today = game.day || 0;
  for (let d = today - days + 1; d <= today; d++) {
    const entries = getDailyPnL(game, d);
    const rev = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const exp = entries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
    result.push({ day: d, revenue: rev, expenses: exp, net: rev - exp });
  }
  return result;
}
