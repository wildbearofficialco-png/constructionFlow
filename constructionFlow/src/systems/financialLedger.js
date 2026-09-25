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
  // Buying a rival contractor. Its own line rather than folded into `property` or `misc`,
  // because an acquisition is a large, rare, deliberate outlay and burying it in
  // "Miscellaneous" makes the Finance tab unreadable in the month it happens.
  acquisitions:{ label: "Acquisitions",  icon: "git-merge",       color: "#a78bfa" },
  misc:        { label: "Miscellaneous", icon: "ellipsis-horizontal", color: "#94a3b8" },
};

export const REVENUE_CATEGORIES = {
  contracts:   { label: "Contracts",    icon: "briefcase",       color: "#22c55e" },
  property:    { label: "Property",     icon: "home",            color: "#8b5cf6" },
  financing:   { label: "Financing",    icon: "card",            color: "#8b5cf6" },
  bonuses:     { label: "Bonuses",      icon: "star",            color: "#eab308" },
  sales:       { label: "Asset Sales",  icon: "cash",            color: "#06b6d4" },
  // The cash reserves that come over with an acquired company.
  acquisitions:{ label: "Acquisitions", icon: "git-merge",       color: "#a78bfa" },
  misc:        { label: "Other Income", icon: "cash",            color: "#94a3b8" },
};

function refreshLedgerSnapshot(game) {
  game._ledgerSnapshot = {
    cash: Number(game.cash) || 0,
    revenue: Number(game.revenue) || 0,
    expenses: Number(game.expenses) || 0,
    day: Number(game.day) || 0,
  };
}

function pushEntry(game, category, amount, description, meta) {
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

// Call this AFTER the game has already applied the cash change. It only records
// what happened; it never changes cash, revenue, expenses or weeklyStats.
//
// Pass `meta.nonCash: true` for an entry that is a real cost but did not move cash (capitalised
// credit-line interest is the one case today).
//
// SPRINT 1 — THE SWALLOW. This used to re-take the reconciliation snapshot from the live balance
// on every call. Any cash that had moved WITHOUT a ledger entry since the last snapshot was
// therefore absorbed into the new baseline the moment anything else was recorded — and in a game
// tick something else is always recorded — so the daily reconciler found nothing to name. A seeded
// playtest of the first hour logged $0 of reconciled cash while $460,000 moved with no entry at
// all: deposits, fines, medical bills, a $120,000 investor cheque. "Where did my money go?" had no
// answer, by construction.
//
// The cash baseline now advances by exactly what was recorded. Whatever moved without a record
// stays visible as the gap between the baseline and the balance until reconcileUnloggedCashMovement
// names it. (Resetting to the live balance was also wrong in the other direction: code that
// deducts a combined total and then records it in parts — daily overhead does — is correct, and
// advancing by each part handles it exactly.)
export function recordTransaction(game, category, amount, description, meta = null) {
  if (!Number.isFinite(amount) || amount === 0) return null;
  const entry = pushEntry(game, category, amount, description, meta);
  const snap = game._ledgerSnapshot;
  if (snap && Number.isFinite(Number(snap.cash))) {
    game._ledgerSnapshot = {
      cash: Number(snap.cash) + (meta && meta.nonCash ? 0 : amount),
      revenue: Number(game.revenue) || 0,
      expenses: Number(game.expenses) || 0,
      day: Number(game.day) || 0,
    };
  } else {
    refreshLedgerSnapshot(game);
  }
  return entry;
}

// Name whatever cash moved inside a block of code that was not already recorded. For code that
// moves money in many small branches (decision cards, site chaos events), this puts a single,
// correctly-described entry on the ledger instead of relying on every branch to remember.
//
//   const scope = beginCashScope(g);
//   evt.apply(g);
//   closeCashScope(g, scope, "fines", "Safety incident — Fence Installation");
export function beginCashScope(game) {
  return { cash: Number(game.cash) || 0, head: (game.ledger && game.ledger[0] && game.ledger[0].id) || null };
}

export function closeCashScope(game, scope, category, description, meta = null) {
  if (!scope) return null;
  let logged = 0;
  let reachedHead = scope.head === null;
  for (const e of (game.ledger || [])) {
    if (e.id === scope.head) { reachedHead = true; break; }
    if (!(e.meta && e.meta.nonCash)) logged += e.amount;
  }
  // The ledger is capped; if the starting point has scrolled off, the scope cannot be measured.
  if (!reachedHead && (game.ledger || []).length >= 300) return null;
  const unlogged = Math.round((Number(game.cash) || 0) - scope.cash - logged);
  if (unlogged === 0) return null;
  return recordTransaction(game, category, unlogged, description, meta);
}

// Safety-net reconciliation for cash flows that have not yet been individually
// instrumented. Explicit recordTransaction() calls refresh the snapshot, so already-
// logged maintenance/repair/etc. are not duplicated here.
export function reconcileUnloggedCashMovement(game) {
  const snap = game._ledgerSnapshot;
  if (!snap) {
    refreshLedgerSnapshot(game);
    return [];
  }

  const currentCash = Number(game.cash) || 0;
  const currentRevenue = Number(game.revenue) || 0;
  const currentExpenses = Number(game.expenses) || 0;
  const deltaCash = currentCash - (Number(snap.cash) || 0);
  const deltaRevenue = currentRevenue - (Number(snap.revenue) || 0);
  const deltaExpenses = currentExpenses - (Number(snap.expenses) || 0);
  const created = [];

  if (deltaRevenue > 0) {
    created.push(recordTransaction(game, "misc", deltaRevenue, "Uncategorized income", { source: "reconciliation" }));
  }
  if (deltaExpenses > 0) {
    created.push(recordTransaction(game, "misc", -deltaExpenses, "Uncategorized operating expense", { source: "reconciliation" }));
  }

  // Cash movement not explained by revenue/expense totals is usually financing,
  // savings transfer, asset movement, or another balance-sheet transaction.
  const explainedCash = deltaRevenue - deltaExpenses;
  const residual = deltaCash - explainedCash;
  if (Math.abs(residual) >= 1) {
    created.push(recordTransaction(
      game,
      "financing",
      residual,
      residual > 0 ? "Financing or balance transfer in" : "Financing or balance transfer out",
      { source: "reconciliation" }
    ));
  }

  refreshLedgerSnapshot(game);
  return created.filter(Boolean);
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
