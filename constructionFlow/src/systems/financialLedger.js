// Financial Ledger System
// Tracks cash movements by category without mutating cash or weekly totals.
// The owning game remains the source of truth for balances, revenue, expenses,
// taxes, payroll and other accounting totals. This prevents double-counting.

import { uid } from "./utils.js";

export const EXPENSE_CATEGORIES = {
  payroll:     { label: "Payroll",       icon: "people",          color: "#ef4444" },
  fuel:        { label: "Fuel",          icon: "car",             color: "#f59e0b" },
  maintenance: { label: "Maintenance",   icon: "construct",       color: "#f97316" },
  equipment:   { label: "Equipment",     icon: "hammer",          color: "#f59e0b" },
  materials:   { label: "Materials",     icon: "cube",            color: "#3b82f6" },
  insurance:   { label: "Insurance",     icon: "shield-checkmark",color: "#8b5cf6" },
  utilities:   { label: "Utilities",     icon: "flash",           color: "#06b6d4" },
  inventory:   { label: "Inventory",     icon: "cube",            color: "#3b82f6" },
  taxes:       { label: "Taxes",         icon: "document-text",   color: "#ec4899" },
  financing:   { label: "Financing",     icon: "card",            color: "#8b5cf6" },
  property:    { label: "Property",      icon: "business",        color: "#06b6d4" },
  fines:       { label: "Fines & Legal", icon: "warning",         color: "#ef4444" },
  misc:        { label: "Miscellaneous", icon: "ellipsis-horizontal", color: "#94a3b8" },
};

export const REVENUE_CATEGORIES = {
  contracts:   { label: "Contracts",    icon: "briefcase",       color: "#22c55e" },
  property:    { label: "Property",     icon: "home",            color: "#8b5cf6" },
  financing:   { label: "Financing",    icon: "card",            color: "#8b5cf6" },
  bonuses:     { label: "Bonuses",      icon: "star",            color: "#eab308" },
  sales:       { label: "Asset Sales",  icon: "cash",            color: "#06b6d4" },
  misc:        { label: "Other Income", icon: "cash",            color: "#94a3b8" },
};

// Call this AFTER the game has already applied the cash change. It only records
// what happened; it never changes cash, revenue, expenses or weeklyStats.
export function recordTransaction(game, category, amount, description, meta = null) {
  if (!Number.isFinite(amount) || amount === 0) return null;
  if (!Array.isArray(game.ledger)) game.ledger = [];
  const entry = {
    id: uid(),
    day: game.day || 0,
    category: category || "misc",
    amount,
    description: description || "Transaction",
    balance: game.cash || 0,
    ...(meta ? { meta } : {}),
  };
  game.ledger.unshift(entry);
  if (game.ledger.length > 300) game.ledger.length = 300;
  return entry;
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
    runway: totalExpenses > 0 ? Math.round(((game.cash || 0) / (totalExpenses / Math.max(1, days)))) : 999,
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
