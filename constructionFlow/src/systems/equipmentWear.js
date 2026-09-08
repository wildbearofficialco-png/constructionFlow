// Equipment Wear System
// Covers durability, maintenance schedules, breakdown probability, repairs, and replacements.
// Operates on game.vehicles (or game.equipment in other game types).

import { uid, rand, clamp, addLog, money } from "./utils.js";

const WEAR_PROFILES = {
  light:    { dailyWear: 0.4,  breakdownBase: 0.003, maintenanceInterval: 20 },
  moderate: { dailyWear: 0.9,  breakdownBase: 0.007, maintenanceInterval: 14 },
  heavy:    { dailyWear: 1.6,  breakdownBase: 0.014, maintenanceInterval: 10 },
  extreme:  { dailyWear: 2.8,  breakdownBase: 0.025, maintenanceInterval:  7 },
};

const BREAKDOWN_TYPES = [
  { id: "tire",      label: "Tire Blowout",      costMult: 0.6,  downtime: 60,   conditionLoss: 8  },
  { id: "engine",    label: "Engine Failure",     costMult: 2.0,  downtime: 300,  conditionLoss: 22 },
  { id: "brake",     label: "Brake Failure",      costMult: 1.2,  downtime: 120,  conditionLoss: 12 },
  { id: "electrical",label: "Electrical Fault",   costMult: 0.9,  downtime: 90,   conditionLoss: 10 },
  { id: "fluid",     label: "Fluid Leak",         costMult: 0.7,  downtime: 75,   conditionLoss: 6  },
  { id: "body",      label: "Body Damage",        costMult: 0.5,  downtime: 45,   conditionLoss: 5  },
];

export function initEquipmentProfile(vehicle) {
  if (vehicle.wearProfile !== undefined) return vehicle;
  return {
    ...vehicle,
    wearProfile: "moderate",
    durability: vehicle.condition !== undefined ? vehicle.condition : 100,
    totalRepairCost: 0,
    breakdownCount: 0,
    lastMaintenanceDay: 0,
    maintenanceScheduledDay: null,
    maintenanceDue: false,
    replacementNeeded: false,
    lifetimeWear: 0,
    maintenanceHistory: [],
  };
}

export function getBreakdownProbability(vehicle, activeRouteSec) {
  const condition = vehicle.condition || 100;
  const profile = WEAR_PROFILES[vehicle.wearProfile || "moderate"];
  const baseProbability = profile.breakdownBase;
  const conditionFactor = condition < 40 ? (40 - condition) * 0.002 : 0;
  const overuseBoost = activeRouteSec > 3600 ? 0.004 : 0;
  const maintenanceBoost = vehicle.maintenanceDue ? 0.005 : 0;
  return clamp(baseProbability + conditionFactor + overuseBoost + maintenanceBoost, 0, 0.15);
}

export function triggerBreakdown(game, vehicleId) {
  const allEquip = Array.isArray(game.vehicles) ? game.vehicles : (game.equipment || []);
  const v = allEquip.find((x) => x.id === vehicleId);
  if (!v || v.status === "In Repair") return;

  const breakdown = BREAKDOWN_TYPES[Math.floor(Math.random() * BREAKDOWN_TYPES.length)];
  const baseCost = Math.round((v.maintenance || 50) * 8 * breakdown.costMult);
  const hasMechanic = (game.supportStaff || []).some((s) => s.role === "Mechanic");
  const repairCost = hasMechanic ? Math.round(baseCost * 0.70) : baseCost;
  const repairMins = Math.round(breakdown.downtime * (hasMechanic ? 0.65 : 1.0));

  v.condition = clamp((v.condition || 100) - breakdown.conditionLoss, 0, 100);
  v.durability = clamp((v.durability || 100) - breakdown.conditionLoss, 0, 100);
  v.breakdowns = (v.breakdowns || 0) + 1;
  v.breakdownCount = (v.breakdownCount || 0) + 1;

  if ((game.cash || 0) >= repairCost) {
    game.cash -= repairCost;
    v.totalRepairCost = (v.totalRepairCost || 0) + repairCost;
    v.status = "In Repair";
    v.repairMinsLeft = repairMins;
    if (game.weeklyStats) game.weeklyStats.repairs = (game.weeklyStats.repairs || 0) + repairCost;
    addLog(game, `${v.name}: ${breakdown.label} — ${money(repairCost)} repair, ${Math.round(repairMins / 60)}h downtime.`);
  } else {
    v.status = "Broken";
    addLog(game, `${v.name}: ${breakdown.label} — can't afford repairs right now.`);
  }

  if (!Array.isArray(v.maintenanceHistory)) v.maintenanceHistory = [];
  v.maintenanceHistory.push({ day: game.day || 0, type: breakdown.id, cost: repairCost, label: breakdown.label });
  if (v.maintenanceHistory.length > 20) v.maintenanceHistory.shift();
}

export function scheduleMaintenance(game, vehicleId) {
  const allEquip = Array.isArray(game.vehicles) ? game.vehicles : (game.equipment || []);
  const v = allEquip.find((x) => x.id === vehicleId);
  if (!v || v.maintenanceScheduledDay) return false;

  const maintenanceCost = Math.round((v.maintenance || 50) * 3.5);
  if ((game.cash || 0) < maintenanceCost) return false;

  game.cash -= maintenanceCost;
  v.lastMaintenanceDay = game.day || 1;
  v.maintenanceScheduledDay = (game.day || 1) + 1;
  v.maintenanceDue = false;
  v.condition = clamp((v.condition || 100) + 12, 0, 100);
  v.durability = clamp((v.durability || 100) + 8, 0, 100);
  v.totalRepairCost = (v.totalRepairCost || 0) + maintenanceCost;

  if (!Array.isArray(v.maintenanceHistory)) v.maintenanceHistory = [];
  v.maintenanceHistory.push({ day: game.day || 0, type: "preventive", cost: maintenanceCost, label: "Scheduled Maintenance" });
  if (v.maintenanceHistory.length > 20) v.maintenanceHistory.shift();

  if (game.weeklyStats) game.weeklyStats.repairs = (game.weeklyStats.repairs || 0) + maintenanceCost;
  addLog(game, `${v.name} scheduled maintenance complete — condition restored.`);
  return true;
}

export function performReplacement(game, vehicleId) {
  const allEquip = Array.isArray(game.vehicles) ? game.vehicles : (game.equipment || []);
  const v = allEquip.find((x) => x.id === vehicleId);
  if (!v) return false;

  const replacementCost = Math.round((v.price || 8000) * 0.30);
  if ((game.cash || 0) < replacementCost) {
    addLog(game, `${v.name} needs replacement but can't afford the ${money(replacementCost)} cost.`);
    return false;
  }

  game.cash -= replacementCost;
  v.condition = 90;
  v.durability = 90;
  v.breakdowns = 0;
  v.breakdownCount = 0;
  v.maintenanceDue = false;
  v.lastMaintenanceDay = game.day || 1;
  v.replacementNeeded = false;
  v.status = "Idle";
  v.repairMinsLeft = 0;
  addLog(game, `${v.name} underwent major component replacement — ${money(replacementCost)}.`);
  return true;
}

export function tickEquipmentWear(game) {
  const vehicles = Array.isArray(game.vehicles) ? game.vehicles
    : Array.isArray(game.equipment) ? game.equipment
    : [];

  vehicles.forEach((v) => {
    if (v.wearProfile === undefined) {
      Object.assign(v, initEquipmentProfile(v));
    }

    const profile = WEAR_PROFILES[v.wearProfile || "moderate"];
    const interval = profile.maintenanceInterval;
    const daysSinceMaintenance = (game.day || 0) - (v.lastMaintenanceDay || 0);
    if (daysSinceMaintenance >= interval && !v.maintenanceDue) {
      v.maintenanceDue = true;
    }

    if (v.status === "En Route") {
      const dailyWear = profile.dailyWear * (v.maintenanceDue ? 1.35 : 1.0);
      v.condition = clamp((v.condition || 100) - dailyWear, 0, 100);
      v.durability = clamp((v.durability || 100) - dailyWear * 0.7, 0, 100);
      v.lifetimeWear = (v.lifetimeWear || 0) + dailyWear;

      const breakdownChance = getBreakdownProbability(v, 1800);
      if (Math.random() < breakdownChance) {
        triggerBreakdown(game, v.id);
      }
    }

    if ((v.condition || 100) < 15 && !v.replacementNeeded) {
      v.replacementNeeded = true;
      addLog(game, `${v.name} is critically degraded — replacement recommended.`);
    }

    if (v.maintenanceScheduledDay && (game.day || 0) >= v.maintenanceScheduledDay) {
      v.maintenanceScheduledDay = null;
    }
  });
}

export function getMaintenanceSchedule(game) {
  const vehicles = Array.isArray(game.vehicles) ? game.vehicles : (game.equipment || []);
  return {
    overdue: vehicles.filter((v) => v.maintenanceDue && v.status !== "In Repair"),
    scheduled: vehicles.filter((v) => v.maintenanceScheduledDay),
    needsReplacement: vehicles.filter((v) => v.replacementNeeded),
    totalDeferred: vehicles.filter((v) => v.maintenanceDue).length,
  };
}
