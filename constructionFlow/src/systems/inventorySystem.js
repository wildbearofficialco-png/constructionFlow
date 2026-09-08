// Advanced Inventory System
// Per-item inventory with spoilage, expiration, auto-consumption, reorder points,
// suppliers, delivery delays, substitutions, and shortage handling.
// Works with any game by operating on game.inventory and game.suppliers.

import { uid, rand, pick, clamp, addLog } from "./utils.js";

export const SUPPLIER_TIERS = [
  { id: "budget",    label: "Budget Supplier",    costMult: 0.82, reliability: 0.72, leadTimeDays: [3, 6] },
  { id: "standard", label: "Standard Supplier",   costMult: 1.00, reliability: 0.88, leadTimeDays: [1, 3] },
  { id: "premium",  label: "Premium Supplier",    costMult: 1.24, reliability: 0.97, leadTimeDays: [0, 1] },
  { id: "local",    label: "Local Supplier",      costMult: 1.10, reliability: 0.82, leadTimeDays: [0, 1] },
];

export function createSupplier(def = {}) {
  const tier = SUPPLIER_TIERS.find((t) => t.id === (def.tierId || "standard")) || SUPPLIER_TIERS[1];
  return {
    id: uid(),
    name: def.name || "Generic Supplier",
    tierId: tier.id,
    costMult: tier.costMult,
    reliability: tier.reliability,
    leadTimeDays: tier.leadTimeDays,
    failStreak: 0,
    totalOrders: 0,
    failedOrders: 0,
    active: true,
  };
}

export function createInventoryItem(def = {}) {
  return {
    id: uid(),
    name: def.name || "Unknown Item",
    category: def.category || "General",
    quantity: def.quantity || 0,
    unit: def.unit || "units",
    costPerUnit: def.costPerUnit || 1,
    reorderPoint: def.reorderPoint || 10,
    reorderQty: def.reorderQty || 50,
    maxStock: def.maxStock || 200,
    supplierId: def.supplierId || null,
    substituteItemId: def.substituteItemId || null,
    spoilable: def.spoilable || false,
    spoilRatePerDay: def.spoilable ? (def.spoilRatePerDay || 0.03) : 0,
    expirationDays: def.expirationDays || null,
    expiresOnDay: def.expirationDays ? (def.currentDay || 0) + def.expirationDays : null,
    dailyConsumption: def.dailyConsumption || 0,
    pendingOrders: [],
    shortage: false,
    lastRestockedDay: 0,
  };
}

export function placeReorder(game, itemId) {
  const item = (game.inventory || []).find((i) => i.id === itemId);
  if (!item) return false;

  const supplier = (game.suppliers || []).find((s) => s.id === item.supplierId && s.active);
  if (!supplier) {
    addLog(game, `Shortage: no active supplier for ${item.name}.`);
    item.shortage = true;
    return false;
  }

  const alreadyPending = item.pendingOrders.some((o) => o.status === "Pending");
  if (alreadyPending) return false;

  const failed = Math.random() > supplier.reliability;
  if (failed) {
    supplier.failStreak = (supplier.failStreak || 0) + 1;
    supplier.failedOrders = (supplier.failedOrders || 0) + 1;
    if ((supplier.failStreak || 0) >= 3) {
      supplier.active = false;
      addLog(game, `Supplier ${supplier.name} has failed repeatedly and been removed.`);
    } else {
      addLog(game, `Supplier ${supplier.name} failed to fulfill order for ${item.name}.`);
    }
    return false;
  }

  supplier.failStreak = 0;
  supplier.totalOrders = (supplier.totalOrders || 0) + 1;

  const [minDays, maxDays] = supplier.leadTimeDays;
  const deliveryDay = (game.day || 1) + rand(minDays, maxDays);
  const totalCost = item.reorderQty * item.costPerUnit * supplier.costMult;

  if ((game.cash || 0) < totalCost) {
    addLog(game, `Cannot reorder ${item.name} — insufficient cash.`);
    item.shortage = true;
    return false;
  }

  game.cash -= totalCost;
  item.pendingOrders.push({ id: uid(), qty: item.reorderQty, deliveryDay, supplierId: supplier.id, status: "Pending" });
  addLog(game, `Reordered ${item.reorderQty} ${item.unit} of ${item.name} — arrives day ${deliveryDay}.`);
  return true;
}

export function receiveDelivery(game, itemId, orderId) {
  const item = (game.inventory || []).find((i) => i.id === itemId);
  if (!item) return;

  const orderIdx = item.pendingOrders.findIndex((o) => o.id === orderId);
  if (orderIdx === -1) return;

  const order = item.pendingOrders[orderIdx];
  item.quantity = Math.min(item.maxStock, item.quantity + order.qty);
  item.shortage = false;
  item.lastRestockedDay = game.day || 1;

  if (item.expirationDays) {
    item.expiresOnDay = (game.day || 1) + item.expirationDays;
  }

  item.pendingOrders.splice(orderIdx, 1);
  addLog(game, `Received ${order.qty} ${item.unit} of ${item.name}.`);
}

export function applySubstitution(game, itemId) {
  const item = (game.inventory || []).find((i) => i.id === itemId);
  if (!item || !item.substituteItemId) return false;

  const sub = (game.inventory || []).find((i) => i.id === item.substituteItemId);
  if (!sub || sub.quantity <= 0) return false;

  const useQty = Math.min(sub.quantity, item.dailyConsumption || 1);
  sub.quantity = Math.max(0, sub.quantity - useQty);
  addLog(game, `Using ${sub.name} as substitute for ${item.name} (${useQty} ${sub.unit}).`);
  return true;
}

export function tickInventory(game) {
  if (!Array.isArray(game.inventory)) return;

  game.inventory.forEach((item) => {
    if (!Array.isArray(item.pendingOrders)) item.pendingOrders = [];

    item.pendingOrders = item.pendingOrders.filter((order) => {
      if (order.status === "Pending" && (game.day || 0) >= order.deliveryDay) {
        receiveDelivery(game, item.id, order.id);
        return false;
      }
      return true;
    });

    if (item.dailyConsumption > 0) {
      const consumed = Math.min(item.quantity, item.dailyConsumption);
      item.quantity -= consumed;
    }

    if (item.spoilable && item.quantity > 0) {
      const spoiled = Math.floor(item.quantity * item.spoilRatePerDay);
      if (spoiled > 0) {
        item.quantity = Math.max(0, item.quantity - spoiled);
        addLog(game, `${spoiled} ${item.unit} of ${item.name} spoiled.`);
      }
    }

    if (item.expiresOnDay && (game.day || 0) >= item.expiresOnDay && item.quantity > 0) {
      addLog(game, `${item.quantity} ${item.unit} of ${item.name} expired and discarded.`);
      item.quantity = 0;
      item.expiresOnDay = null;
    }

    const hasPending = item.pendingOrders.some((o) => o.status === "Pending");
    if (item.quantity <= item.reorderPoint && !hasPending) {
      item.shortage = item.quantity === 0;
      const ordered = placeReorder(game, item.id);
      if (!ordered && item.quantity === 0) {
        const substituted = applySubstitution(game, item.id);
        if (!substituted) {
          addLog(game, `Critical shortage: ${item.name} is out of stock with no substitute.`);
        }
      }
    } else if (item.quantity > item.reorderPoint) {
      item.shortage = false;
    }
  });
}

export function getInventorySummary(game) {
  const inventory = game.inventory || [];
  return {
    totalItems: inventory.length,
    shortages: inventory.filter((i) => i.shortage).map((i) => i.name),
    pendingDeliveries: inventory.reduce((sum, i) => sum + (i.pendingOrders || []).length, 0),
    expiringSoon: inventory.filter((i) => i.expiresOnDay && (i.expiresOnDay - (game.day || 0)) <= 3 && i.quantity > 0).map((i) => i.name),
    lowStock: inventory.filter((i) => i.quantity <= i.reorderPoint && i.quantity > 0).map((i) => i.name),
  };
}

export function initInventory(game) {
  if (!Array.isArray(game.inventory)) game.inventory = [];
  if (!Array.isArray(game.suppliers)) game.suppliers = [];
}
