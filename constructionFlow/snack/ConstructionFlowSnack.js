/**
 * ConstructionFlow — GENERATED single-file Expo Snack build.
 * Paste this entire file over Snack's App.js.
 * Local gameplay systems/data are bundled; React Native/Expo package imports remain external.
 */

// src/games/constructionflow/.ConstructionFlowSnackEntry.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  AppState,
  Platform,
  Modal,
  StatusBar,
  Dimensions,
  Animated,
  Switch,
  Image
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// src/systems/utils.js
var uid = () => Math.random().toString(36).slice(2, 10);
var rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
var pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function addLog(game, msg) {
  if (!Array.isArray(game.logs)) game.logs = [];
  if (!Array.isArray(game.eventLog)) game.eventLog = [];
  game.logs.unshift(msg);
  if (game.logs.length > 100) game.logs.length = 100;
  game.eventLog.unshift({ id: uid(), msg, day: game.day || 0 });
  if (game.eventLog.length > 80) game.eventLog.length = 80;
}
function money(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

// src/systems/employeePersonalities.js
var PERSONALITY_TRAITS = [
  { id: "driven", label: "Driven", stressMod: 1.1, ambitionBase: 75, loyaltyMod: -5 },
  { id: "easygoing", label: "Easy-Going", stressMod: 0.8, ambitionBase: 35, loyaltyMod: 12 },
  { id: "perfectionist", label: "Perfectionist", stressMod: 1.2, ambitionBase: 65, loyaltyMod: 0 },
  { id: "team_player", label: "Team Player", stressMod: 0.9, ambitionBase: 45, loyaltyMod: 15 },
  { id: "independent", label: "Independent", stressMod: 1.05, ambitionBase: 60, loyaltyMod: -10 },
  { id: "methodical", label: "Methodical", stressMod: 0.85, ambitionBase: 50, loyaltyMod: 5 }
];
var TRAINING_PROGRAMS = [
  { id: "safety", label: "Safety & Compliance", cost: 220, durationDays: 3, skillGain: 5, stressReduction: 8 },
  { id: "efficiency", label: "Efficiency Bootcamp", cost: 350, durationDays: 5, skillGain: 8, stressReduction: 0 },
  { id: "leadership", label: "Leadership Seminar", cost: 480, durationDays: 4, skillGain: 4, stressReduction: 5, promotionBonus: true },
  { id: "technical", label: "Technical Skills", cost: 300, durationDays: 4, skillGain: 10, stressReduction: 2 },
  { id: "wellness", label: "Wellness Program", cost: 160, durationDays: 2, skillGain: 0, stressReduction: 22, happinessGain: 15 }
];
function initPersonality(worker) {
  if (worker.happiness !== void 0) return worker;
  const trait = pick(PERSONALITY_TRAITS);
  return {
    ...worker,
    happiness: clamp(worker.mood || 65, 0, 100),
    stress: rand(8, 28),
    burnout: false,
    burnoutDays: 0,
    ambition: clamp(trait.ambitionBase + rand(-10, 10), 10, 100),
    personalityTraitId: trait.id,
    skillGrowthAccum: 0,
    trainingCompleteDay: null,
    trainingProgramId: null,
    attendanceStreak: 0,
    absencesThisMonth: 0,
    lastRaiseDay: 0,
    promotionReady: false,
    resignationRisk: 0,
    productivityMod: 1
  };
}
function getProductivityModifier(worker) {
  if (worker.burnout) return 0.5;
  const happinessFactor = clamp((worker.happiness || 65) / 100, 0, 1);
  const stressLevel = worker.stress || 0;
  const stressPenalty = stressLevel > 50 ? (stressLevel - 50) * 6e-3 : 0;
  const loyaltyBonus = (worker.loyalty || 60) > 75 ? 0.05 : 0;
  return clamp(0.65 + happinessFactor * 0.25 - stressPenalty + loyaltyBonus, 0.45, 1.4);
}
function findWorker(game, workerId) {
  return (game.workers || game.crew || []).find((x) => x.id === workerId);
}
function recordAttendance(game, workerId, present) {
  const w = findWorker(game, workerId);
  if (!w) return;
  if (present) {
    w.attendanceStreak = (w.attendanceStreak || 0) + 1;
    if ((w.attendanceStreak || 0) % 7 === 0) {
      w.happiness = clamp((w.happiness || 65) + 3, 0, 100);
      w.loyalty = clamp((w.loyalty || 60) + 2, 0, 100);
    }
  } else {
    w.absencesThisMonth = (w.absencesThisMonth || 0) + 1;
    w.attendanceStreak = 0;
    w.stress = clamp((w.stress || 20) + 6, 0, 100);
    w.happiness = clamp((w.happiness || 65) - 4, 0, 100);
  }
}
function requestRaise(game, workerId) {
  const w = findWorker(game, workerId);
  if (!w) return;
  const daysSince = (game.day || 1) - (w.lastRaiseDay || 0);
  if (daysSince < 14) return;
  const raiseAmt = rand(1, 4);
  const canAfford = (game.cash || 0) > 1500;
  const workerEarned = (w.deliveries || 0) >= 5 || (w.loyalty || 60) >= 65;
  if (canAfford && workerEarned) {
    w.wagePerHour = (w.wagePerHour || 12) + raiseAmt;
    w.lastRaiseDay = game.day || 1;
    w.happiness = clamp((w.happiness || 65) + 14, 0, 100);
    w.loyalty = clamp((w.loyalty || 60) + 10, 0, 100);
    w.stress = clamp((w.stress || 20) - 12, 0, 100);
    w.resignationRisk = clamp((w.resignationRisk || 0) - 30, 0, 100);
    addLog(game, `${w.name} got a $${raiseAmt}/hr raise \u2014 loyalty surged.`);
  } else {
    w.happiness = clamp((w.happiness || 65) - 10, 0, 100);
    w.resignationRisk = clamp((w.resignationRisk || 0) + 25, 0, 100);
    addLog(game, `${w.name}'s raise request denied \u2014 resignation risk up.`);
  }
}
function tickEmployeePersonalities(game) {
  const workers = Array.isArray(game.workers) ? game.workers : Array.isArray(game.crew) ? game.crew : null;
  if (!workers) return;
  workers.forEach((w) => {
    if (w.happiness === void 0) {
      const patch = initPersonality(w);
      Object.assign(w, patch);
    }
    const fatigue = w.fatigue || 0;
    const mood = w.mood || 65;
    const trait = PERSONALITY_TRAITS.find((t) => t.id === w.personalityTraitId) || PERSONALITY_TRAITS[0];
    let stressDelta = -1.5;
    if (fatigue > 68) stressDelta += 3.5 * trait.stressMod;
    if (fatigue > 85) stressDelta += 4 * trait.stressMod;
    if (mood < 45) stressDelta += 2.5;
    if (w.status === "En Route") stressDelta += 0.8;
    if ((w.absencesThisMonth || 0) > 3) stressDelta += 1.5;
    w.stress = clamp((w.stress || 0) + stressDelta, 0, 100);
    if ((w.stress || 0) >= 86) {
      w.burnoutDays = (w.burnoutDays || 0) + 1;
      if ((w.burnoutDays || 0) >= 3 && !w.burnout) {
        w.burnout = true;
        addLog(game, `${w.name} burned out \u2014 productivity will suffer until they recover.`);
      }
    } else if ((w.stress || 0) < 55) {
      w.burnoutDays = Math.max(0, (w.burnoutDays || 0) - 1);
      if (w.burnout && (w.stress || 0) < 38) {
        w.burnout = false;
        addLog(game, `${w.name} recovered from burnout and is back to full capacity.`);
      }
    }
    const stressPenalty = Math.max(0, (w.stress || 0) - 45) * 0.45;
    w.happiness = clamp(mood * 0.55 + (w.loyalty || 60) * 0.3 - stressPenalty, 0, 100);
    const baseRisk = w.burnout ? 28 : 0;
    const lowHappinessRisk = (w.happiness || 65) < 38 ? (38 - (w.happiness || 65)) * 1.4 : 0;
    const loyaltyShield = Math.max(0, (w.loyalty || 60) - 48) * 0.6;
    const ambitionFrustration = (w.ambition || 40) > 72 && !w.promotionReady ? 8 : 0;
    w.resignationRisk = clamp(baseRisk + lowHappinessRisk - loyaltyShield + ambitionFrustration, 0, 100);
    const deliveryGrowth = Math.min(0.04, (w.deliveries || 0) * 5e-4);
    w.skill = clamp((w.skill || 85) + deliveryGrowth, 0, 130);
    if (w.trainingCompleteDay && (game.day || 0) >= w.trainingCompleteDay) {
      const program = TRAINING_PROGRAMS.find((p) => p.id === w.trainingProgramId);
      if (program) {
        w.skill = clamp((w.skill || 85) + program.skillGain, 0, 130);
        w.stress = clamp((w.stress || 20) - program.stressReduction, 0, 100);
        w.happiness = clamp((w.happiness || 65) + (program.happinessGain || 6), 0, 100);
        if (program.promotionBonus) w.promotionReady = true;
        addLog(game, `${w.name} completed ${program.label}${program.skillGain > 0 ? ` \u2014 skill +${program.skillGain}` : ""}.`);
      }
      w.trainingCompleteDay = null;
      w.trainingProgramId = null;
      if (w.status === "Training") w.status = "Idle";
    }
    w.promotionReady = (w.ambition || 40) >= 68 && (w.deliveries || 0) >= 15 && (w.level || 1) < 5 && !w.burnout;
    w.productivityMod = getProductivityModifier(w);
  });
}
function applyDailyPersonalityEvents(game) {
  const isCrewGame = !Array.isArray(game.workers) && Array.isArray(game.crew);
  const workers = isCrewGame ? game.crew : game.workers || [];
  const toRemove = [];
  workers.forEach((w) => {
    if ((w.resignationRisk || 0) > 55 && Math.random() < (w.resignationRisk - 55) / 220) {
      addLog(game, `${w.name} quit \u2014 morale and stress reached a breaking point.`);
      if (game.weeklyStats) game.weeklyStats.quits = (game.weeklyStats.quits || 0) + 1;
      const vehicle = (game.vehicles || []).find((v) => v.assignedWorkerId === w.id);
      if (vehicle) {
        vehicle.status = "Idle";
        vehicle.assignedWorkerId = null;
        vehicle.routeId = null;
      }
      toRemove.push(w.id);
      return;
    }
    if ((w.ambition || 40) > 72 && Math.random() < 0.035) {
      requestRaise(game, w.id);
    }
    if ((w.stress || 0) > 72 && Math.random() < 0.055) {
      w.callouts = (w.callouts || 0) + 1;
      recordAttendance(game, w.id, false);
      addLog(game, `${w.name} called out today \u2014 stress levels too high.`);
    } else {
      recordAttendance(game, w.id, true);
    }
    if ((w.absencesThisMonth || 0) > 0 && (game.day || 0) % 30 === 0) {
      w.absencesThisMonth = 0;
    }
  });
  if (toRemove.length > 0) {
    if (isCrewGame) {
      game.crew = game.crew.filter((w) => !toRemove.includes(w.id));
    } else {
      game.workers = game.workers.filter((w) => !toRemove.includes(w.id));
    }
  }
}

// src/systems/inventorySystem.js
function placeReorder(game, itemId) {
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
    addLog(game, `Cannot reorder ${item.name} \u2014 insufficient cash.`);
    item.shortage = true;
    return false;
  }
  game.cash -= totalCost;
  item.pendingOrders.push({ id: uid(), qty: item.reorderQty, deliveryDay, supplierId: supplier.id, status: "Pending" });
  addLog(game, `Reordered ${item.reorderQty} ${item.unit} of ${item.name} \u2014 arrives day ${deliveryDay}.`);
  return true;
}
function receiveDelivery(game, itemId, orderId) {
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
function applySubstitution(game, itemId) {
  const item = (game.inventory || []).find((i) => i.id === itemId);
  if (!item || !item.substituteItemId) return false;
  const sub = (game.inventory || []).find((i) => i.id === item.substituteItemId);
  if (!sub || sub.quantity <= 0) return false;
  const useQty = Math.min(sub.quantity, item.dailyConsumption || 1);
  sub.quantity = Math.max(0, sub.quantity - useQty);
  addLog(game, `Using ${sub.name} as substitute for ${item.name} (${useQty} ${sub.unit}).`);
  return true;
}
function tickInventory(game) {
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

// src/systems/randomEvents.js
var SEVERITY = { minor: "minor", moderate: "moderate", major: "major", critical: "critical" };
var EVENT_POOL = [
  {
    id: "health_inspection",
    label: "Health Inspection",
    severity: SEVERITY.moderate,
    weight: 6,
    businessTypes: ["restaurant", "food"],
    resolve: (game, roll) => {
      const pass = (game.reputation || 50) >= 55 && roll > 0.35;
      if (pass) {
        game.reputation = clamp((game.reputation || 50) + 3, 0, 100);
        addLog(game, "Health inspection passed \u2014 reputation boosted.");
      } else {
        const fine = rand(800, 2800);
        game.cash -= fine;
        game.reputation = clamp((game.reputation || 50) - 8, 0, 100);
        addLog(game, `Failed health inspection \u2014 ${money(fine)} fine and reputation hit.`);
      }
    }
  },
  {
    id: "dot_inspection",
    label: "DOT Vehicle Inspection",
    severity: SEVERITY.moderate,
    weight: 5,
    businessTypes: ["fleet", "construction", "logistics"],
    resolve: (game, roll) => {
      const vehicles = game.vehicles || [];
      const avgCondition = vehicles.length ? vehicles.reduce((s, v) => s + (v.condition || 100), 0) / vehicles.length : 100;
      const pass = avgCondition >= 60 && roll > 0.3;
      if (pass) {
        addLog(game, "DOT inspection passed \u2014 fleet compliance confirmed.");
      } else {
        const fine = rand(500, 2200);
        game.cash -= fine;
        if (vehicles.length > 0) pick(vehicles).status = "In Repair";
        addLog(game, `DOT inspection failed \u2014 ${money(fine)} fine, vehicle grounded.`);
      }
    }
  },
  {
    id: "lawsuit",
    label: "Customer Lawsuit",
    severity: SEVERITY.major,
    weight: 2,
    businessTypes: ["all"],
    resolve: (game) => {
      const settlement = rand(3e3, 12e3);
      game.cash -= settlement;
      game.reputation = clamp((game.reputation || 50) - 12, 0, 100);
      addLog(game, `Customer lawsuit settled for ${money(settlement)} \u2014 reputation damaged.`);
    }
  },
  {
    id: "theft",
    label: "Theft Incident",
    severity: SEVERITY.moderate,
    weight: 4,
    businessTypes: ["all"],
    resolve: (game) => {
      const stolen = rand(400, 2400);
      const fromInventory = Array.isArray(game.inventory) && game.inventory.length > 0;
      if (fromInventory) {
        const item = pick(game.inventory);
        const qtyStolen = Math.min(item.quantity, rand(5, 20));
        item.quantity -= qtyStolen;
        addLog(game, `Theft: ${qtyStolen} ${item.unit} of ${item.name} stolen.`);
      }
      game.cash -= stolen;
      addLog(game, `Theft incident \u2014 ${money(stolen)} in losses.`);
    }
  },
  {
    id: "vandalism",
    label: "Vandalism",
    severity: SEVERITY.minor,
    weight: 3,
    businessTypes: ["all"],
    resolve: (game) => {
      const repairCost = rand(300, 1200);
      game.cash -= repairCost;
      const vehicles = (game.vehicles || []).filter((v) => v.status === "Idle");
      if (vehicles.length > 0) {
        const v = pick(vehicles);
        v.condition = clamp((v.condition || 100) - rand(5, 14), 0, 100);
      }
      addLog(game, `Vandalism \u2014 ${money(repairCost)} in damage and cleanup costs.`);
    }
  },
  {
    id: "severe_weather",
    label: "Severe Weather",
    severity: SEVERITY.moderate,
    weight: 5,
    businessTypes: ["all"],
    resolve: (game) => {
      const vehicles = game.vehicles || [];
      const affected = vehicles.filter((v) => v.status === "En Route");
      affected.forEach((v) => {
        v.condition = clamp((v.condition || 100) - rand(4, 10), 0, 100);
      });
      const routes = (game.routes || []).filter((r) => r.status === "Active");
      routes.forEach((r) => {
        r.remainingSec = Math.round((r.remainingSec || 0) * 1.3);
      });
      game.reputation = clamp((game.reputation || 50) - 3, 0, 100);
      addLog(game, `Severe weather hit \u2014 ${affected.length} vehicles damaged, routes delayed.`);
    }
  },
  {
    id: "power_outage",
    label: "Power Outage",
    severity: SEVERITY.moderate,
    weight: 3,
    businessTypes: ["all"],
    resolve: (game) => {
      const lostRevenue = rand(500, 2500);
      game.cash -= lostRevenue;
      const inventory = (game.inventory || []).filter((i) => i.spoilable);
      inventory.forEach((item) => {
        const spoiled = Math.floor(item.quantity * 0.15);
        item.quantity = Math.max(0, item.quantity - spoiled);
        if (spoiled > 0) addLog(game, `Power outage spoiled ${spoiled} ${item.unit} of ${item.name}.`);
      });
      addLog(game, `Power outage \u2014 ${money(lostRevenue)} in lost revenue.`);
    }
  },
  {
    id: "viral_social_media",
    label: "Viral Social Media Moment",
    severity: SEVERITY.minor,
    weight: 3,
    businessTypes: ["all"],
    resolve: (game, roll) => {
      const positive = roll > 0.45;
      if (positive) {
        const boost = rand(8, 18);
        game.reputation = clamp((game.reputation || 50) + boost, 0, 100);
        addLog(game, `Viral social media post boosted reputation by ${boost} points!`);
      } else {
        const drop = rand(6, 14);
        game.reputation = clamp((game.reputation || 50) - drop, 0, 100);
        addLog(game, `Negative viral post \u2014 reputation dropped ${drop} points.`);
      }
    }
  },
  {
    id: "celebrity_visit",
    label: "Celebrity Visit",
    severity: SEVERITY.minor,
    weight: 2,
    businessTypes: ["restaurant", "retail", "service"],
    resolve: (game) => {
      const reputationGain = rand(10, 22);
      const revenueBoost = rand(800, 3e3);
      game.reputation = clamp((game.reputation || 50) + reputationGain, 0, 100);
      game.cash = (game.cash || 0) + revenueBoost;
      addLog(game, `Celebrity visited \u2014 +${reputationGain} reputation and ${money(revenueBoost)} bonus revenue!`);
    }
  },
  {
    id: "labor_shortage",
    label: "Area Labor Shortage",
    severity: SEVERITY.moderate,
    weight: 4,
    businessTypes: ["all"],
    resolve: (game) => {
      if (Array.isArray(game.applicants)) game.applicants = [];
      const workers = game.workers || [];
      workers.forEach((w) => {
        if (Math.random() < 0.25) {
          w.wagePerHour = Math.round((w.wagePerHour || 12) * 1.08);
          w.mood = clamp((w.mood || 65) + 5, 0, 100);
        }
      });
      addLog(game, "Labor shortage: applicant pool dried up, workers demanding higher wages.");
    }
  },
  {
    id: "supplier_failure",
    label: "Supplier Failure",
    severity: SEVERITY.major,
    weight: 3,
    businessTypes: ["all"],
    resolve: (game) => {
      const suppliers = (game.suppliers || []).filter((s) => s.active);
      if (suppliers.length === 0) {
        addLog(game, "Supplier failure warning \u2014 no active suppliers on file.");
        return;
      }
      const failed = pick(suppliers);
      failed.active = false;
      failed.failStreak = (failed.failStreak || 0) + 5;
      const inventory = (game.inventory || []).filter((i) => i.supplierId === failed.id);
      inventory.forEach((item) => {
        item.shortage = true;
      });
      addLog(game, `Supplier ${failed.name} collapsed \u2014 ${inventory.length} items now in shortage.`);
    }
  },
  {
    id: "equipment_recall",
    label: "Equipment Recall",
    severity: SEVERITY.major,
    weight: 2,
    businessTypes: ["fleet", "construction", "manufacturing"],
    resolve: (game) => {
      const vehicles = (game.vehicles || []).filter((v) => v.tier >= 2);
      if (vehicles.length === 0) return;
      const recalled = pick(vehicles);
      recalled.status = "In Repair";
      recalled.repairMinsLeft = rand(480, 1440);
      const cost = rand(1500, 5e3);
      game.cash -= cost;
      addLog(game, `Equipment recall: ${recalled.name} grounded for ${Math.round(recalled.repairMinsLeft / 60)}h \u2014 ${money(cost)} cost.`);
    }
  },
  {
    id: "employee_accident",
    label: "Workplace Accident",
    severity: SEVERITY.major,
    weight: 3,
    businessTypes: ["all"],
    resolve: (game) => {
      const workers = (game.workers || []).filter((w) => w.status !== "En Route");
      if (workers.length === 0) return;
      const worker = pick(workers);
      worker.status = "Idle";
      worker.fatigue = clamp((worker.fatigue || 0) + 40, 0, 100);
      worker.mood = clamp((worker.mood || 65) - 20, 0, 100);
      const medCost = rand(1e3, 4500);
      game.cash -= medCost;
      game.reputation = clamp((game.reputation || 50) - 5, 0, 100);
      addLog(game, `Workplace accident involving ${worker.name} \u2014 ${money(medCost)} medical costs.`);
    }
  },
  {
    id: "financial_audit",
    label: "Tax / Financial Audit",
    severity: SEVERITY.major,
    weight: 2,
    businessTypes: ["all"],
    resolve: (game) => {
      const penalty = rand(1e3, 3500);
      game.cash -= penalty;
      addLog(game, `Financial audit \u2014 ${money(penalty)} in penalties.`);
    }
  }
];
function rollRandomEvent(game, businessType) {
  const eligible = EVENT_POOL.filter(
    (e) => e.businessTypes.includes("all") || e.businessTypes.includes(businessType)
  );
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of eligible) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return eligible[eligible.length - 1];
}
function applyRandomEvent(game, event) {
  if (!event || typeof event.resolve !== "function") return;
  const roll = Math.random();
  event.resolve(game, roll);
  if (!Array.isArray(game.activeEvents)) game.activeEvents = [];
  game.activeEvents.push({
    id: uid(),
    eventId: event.id,
    label: event.label,
    severity: event.severity,
    day: game.day || 0
  });
  if (game.activeEvents.length > 30) game.activeEvents.shift();
}
function maybeFireRandomEvent(game, businessType, dailyChance = 0.08) {
  if (Math.random() < dailyChance) applyRandomEvent(game, rollRandomEvent(game, businessType));
}

// src/systems/aiCompetitors.js
var COMPETITOR_NAMES = [
  "Apex Logistics",
  "BlueStar Freight",
  "Meridian Delivery",
  "Nova Transit",
  "Summit Carriers",
  "IronRoute Co.",
  "Pacific Haul",
  "CrossTown Express",
  "Atlas Freight",
  "PeakLine Transport",
  "ClearPath Logistics",
  "Velocity Freight",
  "Harbor Haulers",
  "Canyon Carriers",
  "Ridgeline Express"
];
var OWNER_NAMES = [
  "Marcus Chen",
  "Sandra Rivera",
  "James Okafor",
  "Priya Patel",
  "Tom Brennan",
  "Layla Hassan",
  "Derek Walsh",
  "Aisha Osei",
  "Carlos Reyes",
  "Mina Tanaka",
  "Paul Morin",
  "Zara Ahmed"
];
var STRATEGIES = [
  { id: "aggressive", label: "Aggressive", expansionRate: 1.6, pricingMod: 0.88, riskTolerance: 0.8 },
  { id: "balanced", label: "Balanced", expansionRate: 1, pricingMod: 1, riskTolerance: 0.5 },
  { id: "conservative", label: "Conservative", expansionRate: 0.6, pricingMod: 1.08, riskTolerance: 0.25 },
  { id: "predatory", label: "Predatory", expansionRate: 1.3, pricingMod: 0.82, riskTolerance: 0.7 }
];
function createAiCompetitor(overrides = {}) {
  const strategy = pick(STRATEGIES);
  const startCash = rand(8e3, 35e3);
  return {
    id: uid(),
    name: overrides.name || pick(COMPETITOR_NAMES),
    ownerName: overrides.ownerName || pick(OWNER_NAMES),
    strategyId: strategy.id,
    cash: startCash,
    companyValue: startCash,
    reputation: rand(35, 65),
    fleetSize: rand(1, 4),
    staffCount: rand(2, 8),
    companyLevel: 1,
    weeklyRevenue: rand(800, 3e3),
    weeklyExpenses: rand(400, 1800),
    weeklyProfit: 0,
    totalProfit: 0,
    marketShare: rand(3, 12),
    contractsWon: 0,
    contractsLost: 0,
    acquisitions: [],
    acquiredBy: null,
    status: "Active",
    bankruptcyWarning: false,
    bankruptcyCountdown: 0,
    expansionCooldown: 0,
    biddingCooldown: 0,
    foundedDay: 1,
    lastActionDay: 0
  };
}
function initAiCompetitors(game, count) {
  if (!Array.isArray(game.aiCompetitors)) game.aiCompetitors = [];
  const existing = game.aiCompetitors.length;
  const toAdd = Math.max(0, (count || 3) - existing);
  for (let i = 0; i < toAdd; i++) {
    game.aiCompetitors.push(createAiCompetitor());
  }
}
function getStrategy(competitor) {
  return STRATEGIES.find((s) => s.id === competitor.strategyId) || STRATEGIES[1];
}
function tickFinances(competitor, marketState) {
  const marketMult = marketState === "Boom" ? 1.15 : marketState === "Slow" ? 0.85 : 1;
  const revenueGrowth = competitor.weeklyRevenue * (0.98 + Math.random() * 0.08) * marketMult;
  const expenseGrowth = competitor.weeklyExpenses * (0.97 + Math.random() * 0.06);
  competitor.weeklyRevenue = Math.max(300, revenueGrowth);
  competitor.weeklyExpenses = Math.max(150, expenseGrowth);
  competitor.weeklyProfit = competitor.weeklyRevenue - competitor.weeklyExpenses;
  competitor.cash = Math.max(0, competitor.cash + competitor.weeklyProfit);
  competitor.totalProfit += competitor.weeklyProfit;
  competitor.companyValue = Math.round(competitor.cash + competitor.weeklyRevenue * 8);
}
function tryExpansion(competitor, game) {
  const strategy = getStrategy(competitor);
  if ((competitor.expansionCooldown || 0) > 0) {
    competitor.expansionCooldown -= 1;
    return;
  }
  if (competitor.cash < 5e3) return;
  const expandRoll = Math.random();
  const threshold = 0.04 * strategy.expansionRate;
  if (expandRoll > threshold) return;
  const expandType = Math.random();
  if (expandType < 0.5) {
    competitor.fleetSize += 1;
    const cost = rand(3e3, 1e4);
    competitor.cash -= cost;
    competitor.weeklyExpenses += rand(50, 150);
    competitor.companyLevel = Math.min(10, Math.ceil(competitor.fleetSize / 3) + 1);
  } else {
    competitor.staffCount += 1;
    competitor.weeklyExpenses += rand(30, 80);
  }
  competitor.expansionCooldown = rand(5, 14);
  addLog(game, `Competitor ${competitor.name} expanded \u2014 now ${competitor.fleetSize} vehicles, ${competitor.staffCount} staff.`);
}
function tryBidOnContract(competitor, game) {
  if ((competitor.biddingCooldown || 0) > 0) {
    competitor.biddingCooldown -= 1;
    return;
  }
  const strategy = getStrategy(competitor);
  if (Math.random() > 0.12) return;
  const playerRep = game.reputation || 50;
  const compRep = competitor.reputation || 50;
  const pricingAdvantage = strategy.pricingMod < 1 ? 0.12 : 0;
  const reputationFactor = compRep > playerRep ? 0.08 : -0.05;
  const winChance = clamp(0.25 + pricingAdvantage + reputationFactor, 0.05, 0.65);
  const won = Math.random() < winChance;
  if (won) {
    competitor.contractsWon += 1;
    competitor.reputation = clamp(competitor.reputation + rand(1, 4), 0, 100);
    competitor.weeklyRevenue += rand(200, 800);
    competitor.marketShare = clamp(competitor.marketShare + rand(0, 2), 0, 100);
    game.reputation = clamp(playerRep - rand(1, 3), 0, 100);
    addLog(game, `${competitor.name} outbid you on a contract \u2014 market share up.`);
  } else {
    competitor.contractsLost += 1;
    competitor.reputation = clamp(competitor.reputation - 1, 0, 100);
  }
  competitor.biddingCooldown = rand(3, 8);
}
function checkBankruptcy(competitor, game) {
  const isLosing = competitor.weeklyProfit < -500;
  const lowCash = competitor.cash < 500;
  if (isLosing && lowCash) {
    if (!competitor.bankruptcyWarning) {
      competitor.bankruptcyWarning = true;
      competitor.bankruptcyCountdown = rand(7, 21);
      addLog(game, `${competitor.name} is struggling financially \u2014 bankruptcy possible.`);
    } else {
      competitor.bankruptcyCountdown -= 1;
      if (competitor.bankruptcyCountdown <= 0) {
        competitor.status = "Bankrupt";
        competitor.cash = 0;
        competitor.fleetSize = 0;
        competitor.marketShare = 0;
        addLog(game, `${competitor.name} has gone bankrupt \u2014 market share opens up.`);
        game.reputation = clamp((game.reputation || 50) + rand(3, 8), 0, 100);
        return true;
      }
    }
  } else {
    competitor.bankruptcyWarning = false;
    competitor.bankruptcyCountdown = 0;
  }
  return false;
}
function tryAcquisition(competitor, game) {
  const strategy = getStrategy(competitor);
  if (strategy.id !== "predatory" && strategy.id !== "aggressive") return;
  if (competitor.cash < 2e4) return;
  if (Math.random() > 0.015) return;
  const target = (game.aiCompetitors || []).find(
    (c) => c.id !== competitor.id && c.status === "Bankrupt" || c.status === "Active" && c.cash < 2e3 && c.weeklyProfit < 0
  );
  if (!target) return;
  const acquisitionCost = rand(5e3, 15e3);
  if (competitor.cash < acquisitionCost) return;
  competitor.cash -= acquisitionCost;
  competitor.fleetSize += Math.floor(target.fleetSize * 0.6);
  competitor.staffCount += Math.floor(target.staffCount * 0.5);
  competitor.marketShare = clamp(competitor.marketShare + target.marketShare * 0.7, 0, 100);
  competitor.acquisitions.push(target.id);
  target.status = "Acquired";
  target.acquiredBy = competitor.id;
  addLog(game, `${competitor.name} acquired ${target.name} \u2014 growing fast.`);
}
function tickAiCompetitors(game) {
  if (!Array.isArray(game.aiCompetitors)) return;
  const marketState = game.marketState || "Normal";
  game.aiCompetitors.forEach((competitor) => {
    if (competitor.status !== "Active") return;
    tickFinances(competitor, marketState);
    const wentBankrupt = checkBankruptcy(competitor, game);
    if (wentBankrupt) return;
    tryExpansion(competitor, game);
    tryBidOnContract(competitor, game);
    tryAcquisition(competitor, game);
    competitor.reputation = clamp(competitor.reputation + (competitor.weeklyProfit > 0 ? 0.3 : -0.5), 0, 100);
    competitor.lastActionDay = game.day || 0;
  });
}

// src/systems/financialLedger.js
function refreshLedgerSnapshot(game) {
  game._ledgerSnapshot = {
    cash: Number(game.cash) || 0,
    revenue: Number(game.revenue) || 0,
    expenses: Number(game.expenses) || 0,
    day: Number(game.day) || 0
  };
}
function recordTransaction(game, category, amount, description, meta = null) {
  if (!Number.isFinite(amount) || amount === 0) return null;
  if (!Array.isArray(game.ledger)) game.ledger = [];
  const entry = {
    id: uid(),
    day: game.day || 0,
    category: category || "misc",
    amount,
    description: description || "Transaction",
    balance: game.cash || 0,
    ...meta ? { meta } : {}
  };
  game.ledger.unshift(entry);
  if (game.ledger.length > 300) game.ledger.length = 300;
  refreshLedgerSnapshot(game);
  return entry;
}
function reconcileUnloggedCashMovement(game) {
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

// src/systems/economyEngine.js
var ECONOMY_EVENTS = [
  { id: "recession", label: "Economic Recession", weight: 2, duration: [30, 60], effects: { inflationMod: -0.3, demandMod: -0.2, wageMod: -0.05, fuelMod: -0.1 } },
  { id: "boom", label: "Economic Boom", weight: 3, duration: [20, 45], effects: { inflationMod: 0.4, demandMod: 0.25, wageMod: 0.08, fuelMod: 0.05 } },
  { id: "fuel_crisis", label: "Fuel Price Spike", weight: 4, duration: [10, 25], effects: { fuelMod: 0.45, demandMod: -0.08, inflationMod: 0.1 } },
  { id: "supply_shock", label: "Supply Chain Shock", weight: 3, duration: [14, 30], effects: { ingredientMod: 0.3, inventoryMod: 0.2, inflationMod: 0.15 } },
  { id: "labor_tight", label: "Labor Market Tightening", weight: 3, duration: [20, 40], effects: { wageMod: 0.12, demandMod: 0.05 } },
  { id: "rate_hike", label: "Interest Rate Hike", weight: 2, duration: [30, 60], effects: { interestRateMod: 0.025, demandMod: -0.05 } },
  { id: "consumer_conf", label: "High Consumer Confidence", weight: 4, duration: [15, 35], effects: { demandMod: 0.15, wageMod: 0.03 } }
];
function dayToSeason(day) {
  const dayInYear = day % 360 + 1;
  if (dayInYear <= 90) return "Spring";
  if (dayInYear <= 180) return "Summer";
  if (dayInYear <= 270) return "Fall";
  return "Winter";
}
function initEconomy(game) {
  if (game.economy) return;
  game.economy = {
    inflationRate: 0.03,
    fuelPriceIndex: 1,
    ingredientPriceIndex: 1,
    inventoryPriceIndex: 1,
    interestRate: 0.065,
    wagePressureIndex: 1,
    demandIndex: 1,
    season: dayToSeason(game.day || 0),
    activeEvent: null,
    activeEventDaysLeft: 0,
    lastEventDay: 0,
    eventHistory: [],
    totalInflation: 1
  };
}
function tickEconomy(game) {
  reconcileUnloggedCashMovement(game);
  if (!game.economy) initEconomy(game);
  const eco = game.economy;
  const day = game.day || 0;
  eco.season = dayToSeason(day);
  if (eco.activeEvent && eco.activeEventDaysLeft > 0) {
    eco.activeEventDaysLeft -= 1;
    if (eco.activeEventDaysLeft === 0) {
      addLog(game, `Economy: "${eco.activeEvent.label}" has ended.`);
      eco.activeEvent = null;
    }
  }
  if (!eco.activeEvent && day - (eco.lastEventDay || 0) >= 20 && Math.random() < 0.03) {
    const totalWeight = ECONOMY_EVENTS.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = null;
    for (const ev of ECONOMY_EVENTS) {
      roll -= ev.weight;
      if (roll <= 0) {
        chosen = ev;
        break;
      }
    }
    if (chosen) {
      eco.activeEvent = chosen;
      eco.activeEventDaysLeft = rand(chosen.duration[0], chosen.duration[1]);
      eco.lastEventDay = day;
      eco.eventHistory.unshift({ id: uid(), label: chosen.label, day });
      if (eco.eventHistory.length > 10) eco.eventHistory.pop();
      addLog(game, `Economy shift: "${chosen.label}" \u2014 lasting ~${eco.activeEventDaysLeft} days.`);
    }
  }
  const eff = eco.activeEvent?.effects || {};
  const infTarget = 0.03 + (eff.inflationMod || 0);
  eco.inflationRate = clamp(eco.inflationRate + (infTarget - eco.inflationRate) * 0.04 + (Math.random() - 0.5) * 1e-3, 0, 0.12);
  eco.totalInflation = clamp(eco.totalInflation * (1 + eco.inflationRate / 360), 1, 2.5);
  const fuelTarget = 1 + (eff.fuelMod || 0);
  eco.fuelPriceIndex = clamp(eco.fuelPriceIndex + (fuelTarget - eco.fuelPriceIndex) * 0.03 + (Math.random() - 0.5) * 0.015, 0.7, 1.8);
  const ingTarget = 1 + (eff.ingredientMod || 0);
  eco.ingredientPriceIndex = clamp(eco.ingredientPriceIndex + (ingTarget - eco.ingredientPriceIndex) * 0.025 + (Math.random() - 0.5) * 8e-3, 0.75, 1.7);
  const invTarget = 1 + (eff.inventoryMod || 0);
  eco.inventoryPriceIndex = clamp(eco.inventoryPriceIndex + (invTarget - eco.inventoryPriceIndex) * 0.02 + (Math.random() - 0.5) * 6e-3, 0.8, 1.6);
  const wageTarget = 1 + (eff.wageMod || 0);
  eco.wagePressureIndex = clamp(eco.wagePressureIndex + (wageTarget - eco.wagePressureIndex) * 0.02 + (Math.random() - 0.5) * 4e-3, 0.85, 1.4);
  const irTarget = 0.065 + (eff.interestRateMod || 0);
  eco.interestRate = clamp(eco.interestRate + (irTarget - eco.interestRate) * 0.01, 0.02, 0.18);
  const demandTarget = 1 + (eff.demandMod || 0);
  eco.demandIndex = clamp(eco.demandIndex + (demandTarget - eco.demandIndex) * 0.05 + (Math.random() - 0.5) * 0.01, 0.6, 1.5);
}

// src/systems/customerSatisfaction.js
function tickCustomerSatisfaction(game) {
  if (!Array.isArray(game.reviews)) game.reviews = [];
  const reviews = game.reviews;
  const currentDay = game.day || 0;
  const fresh = reviews.filter((r) => currentDay - r.day <= 60);
  if (fresh.length < reviews.length) game.reviews = fresh;
  if (fresh.length === 0) {
    game.customerRating = 3.5;
    game.loyaltyScore = 50;
    game.repeatRate = 0.2;
    return;
  }
  let weightedSum = 0;
  let weightTotal = 0;
  fresh.forEach((r) => {
    const age = currentDay - r.day;
    const weight = Math.max(0.3, 1 - age / 60);
    weightedSum += r.stars * weight;
    weightTotal += weight;
  });
  game.customerRating = Math.round(weightedSum / weightTotal * 10) / 10;
  const avgStars = weightedSum / weightTotal;
  const loyaltyTarget = clamp((avgStars - 1) * 25, 10, 95);
  game.loyaltyScore = Math.round(clamp(
    (game.loyaltyScore || 50) * 0.97 + loyaltyTarget * 0.03,
    10,
    95
  ));
  const repeatVisits = fresh.filter((r) => r.isRepeat).length;
  game.repeatRate = clamp(repeatVisits / Math.max(1, fresh.length), 0.05, 0.65);
  const repDelta = (avgStars - 3) * 0.5;
  game.reputation = clamp((game.reputation || 50) + repDelta, 0, 100);
}

// src/systems/demandPricing.js
function initPricing(game) {
  if (game.pricingStrategyId) return;
  game.pricingStrategyId = "standard";
  game.priceMultiplierOverride = null;
  game.demandScore = 1;
  game.surgeActive = false;
  game.surgeEndHour = null;
}
function getLoyaltyVolumeBonus(game) {
  const loyalty = game.loyaltyScore || 50;
  const repeatRate = game.repeatRate || 0.2;
  return clamp(1 + (loyalty - 50) / 200 + repeatRate * 0.3, 0.9, 1.35);
}
var SEASONAL_DEMAND_BY_TYPE = {
  fleet: { Spring: 1.05, Summer: 1.15, Fall: 1.1, Winter: 0.85 },
  construction: { Spring: 1.15, Summer: 1.2, Fall: 1, Winter: 0.75 },
  restaurant: { Spring: 1, Summer: 1.1, Fall: 1.05, Winter: 0.9 },
  realestate: { Spring: 1.15, Summer: 1.05, Fall: 1, Winter: 0.9 }
};
function tickDemand(game, businessType) {
  initPricing(game);
  const eco = game.economy || {};
  const seasonal = eco.season && SEASONAL_DEMAND_BY_TYPE[businessType]?.[eco.season] || 1;
  const loyaltyBonus = getLoyaltyVolumeBonus(game);
  game.demandScore = clamp((eco.demandIndex || 1) * seasonal * loyaltyBonus, 0.3, 2.2);
  game.surgeActive = game.pricingStrategyId === "surge" && game.demandScore > 1.35;
}

// src/systems/weatherRouteConditions.js
var WEATHER_TYPES = [
  { id: "clear", label: "Clear", icon: "\u2600\uFE0F", timeMult: 1, fuelMult: 1, breakdownMod: 0, demandMod: 1, weight: 35 },
  { id: "cloudy", label: "Overcast", icon: "\u26C5", timeMult: 1.02, fuelMult: 1, breakdownMod: 0, demandMod: 0.98, weight: 20 },
  { id: "rain", label: "Rain", icon: "\u{1F327}\uFE0F", timeMult: 1.15, fuelMult: 1.05, breakdownMod: 0.02, demandMod: 0.92, weight: 20 },
  { id: "storm", label: "Storm", icon: "\u26C8\uFE0F", timeMult: 1.35, fuelMult: 1.15, breakdownMod: 0.05, demandMod: 0.8, weight: 8 },
  { id: "snow", label: "Snow", icon: "\u{1F328}\uFE0F", timeMult: 1.5, fuelMult: 1.25, breakdownMod: 0.08, demandMod: 0.75, weight: 7 },
  { id: "fog", label: "Dense Fog", icon: "\u{1F32B}\uFE0F", timeMult: 1.25, fuelMult: 1.02, breakdownMod: 0.03, demandMod: 0.88, weight: 6 },
  { id: "heatwave", label: "Heat Wave", icon: "\u{1F525}", timeMult: 1.08, fuelMult: 1.12, breakdownMod: 0.04, demandMod: 1.05, weight: 4 }
];
var SEASON_WEATHER_BIAS = {
  Spring: { rain: 2, storm: 1.5, snow: 0.2, clear: 0.9, fog: 1.2 },
  Summer: { heatwave: 3, storm: 1.8, clear: 1.4, snow: 0, rain: 0.8 },
  Fall: { rain: 1.5, fog: 2, storm: 1.2, clear: 0.8, snow: 0.5 },
  Winter: { snow: 4, fog: 1.5, clear: 0.6, heatwave: 0, storm: 0.8 }
};
var ROAD_CONDITIONS = [
  { id: "normal", label: "Normal", timeMod: 1, fuelMod: 1, weight: 60 },
  { id: "roadwork", label: "Road Works", timeMod: 1.18, fuelMod: 1.03, weight: 15 },
  { id: "accident", label: "Accident", timeMod: 1.3, fuelMod: 1.05, weight: 10 },
  { id: "flooding", label: "Flooding", timeMod: 1.45, fuelMod: 1.15, weight: 5 },
  { id: "detour", label: "Detour", timeMod: 1.2, fuelMod: 1.08, weight: 10 }
];
function pickWeighted(options, season) {
  const bias = season && SEASON_WEATHER_BIAS[season] || {};
  const weighted = options.map((o) => ({
    ...o,
    effectiveWeight: (o.weight || 1) * (bias[o.id] ?? 1)
  }));
  const total = weighted.reduce((s, o) => s + o.effectiveWeight, 0);
  let r = Math.random() * total;
  for (const o of weighted) {
    r -= o.effectiveWeight;
    if (r <= 0) return o;
  }
  return weighted[0];
}
function initWeather(game) {
  if (game.weather) return;
  game.weather = {
    current: "clear",
    icon: "\u2600\uFE0F",
    label: "Clear",
    daysSinceChange: 0,
    roadCondition: "normal",
    roadLabel: "Normal",
    fuelSurchargeActive: false,
    weatherHistory: []
  };
}
function tickWeather(game) {
  initWeather(game);
  const w = game.weather;
  const season = game.economy?.season || "Summer";
  w.daysSinceChange = (w.daysSinceChange || 0) + 1;
  const changeChance = clamp((w.daysSinceChange - 1) * 0.3, 0.1, 0.9);
  if (Math.random() < changeChance) {
    const next = pickWeighted(WEATHER_TYPES, season);
    const prevId = w.current;
    w.current = next.id;
    w.icon = next.icon;
    w.label = next.label;
    w.daysSinceChange = 0;
    if (next.id === "storm" || next.id === "snow") {
      addLog(game, `${next.icon} Weather alert: ${next.label} moving in \u2014 deliveries will be slower and fuel costs up.`);
    } else if ((prevId === "storm" || prevId === "snow") && next.id === "clear") {
      addLog(game, "\u2600\uFE0F Skies cleared up \u2014 back to normal delivery conditions.");
    }
    w.weatherHistory = [...(w.weatherHistory || []).slice(-13), { day: game.day || 0, id: next.id, label: next.label }];
  }
  const road = pickWeighted(ROAD_CONDITIONS, null);
  w.roadCondition = road.id;
  w.roadLabel = road.label;
  if (road.id !== "normal" && Math.random() < 0.4) {
    addLog(game, `\u{1F6A7} ${road.label} reported on main routes today.`);
  }
  const weatherDef = WEATHER_TYPES.find((t) => t.id === w.current);
  w.fuelSurchargeActive = (weatherDef?.fuelMult || 1) > 1.1;
  if (game.economy && weatherDef) {
    const existingDemand = game.economy.demandIndex || 1;
    game.economy.demandIndex = clamp(
      existingDemand * 0.85 + weatherDef.demandMod * 0.15,
      0.5,
      1.8
    );
  }
}
function getWeatherEffects(game) {
  const w = game.weather || { current: "clear" };
  const weatherDef = WEATHER_TYPES.find((t) => t.id === w.current) || WEATHER_TYPES[0];
  const roadDef = ROAD_CONDITIONS.find((r) => r.id === (w.roadCondition || "normal")) || ROAD_CONDITIONS[0];
  return {
    weatherId: w.current,
    weatherLabel: w.label || "Clear",
    weatherIcon: w.icon || "\u2600\uFE0F",
    roadCondition: w.roadCondition || "normal",
    roadLabel: w.roadLabel || "Normal",
    timeMult: weatherDef.timeMult * roadDef.timeMod,
    fuelMult: weatherDef.fuelMult * roadDef.fuelMod,
    breakdownMod: weatherDef.breakdownMod,
    demandMod: weatherDef.demandMod,
    fuelSurchargeActive: w.fuelSurchargeActive || false,
    severe: weatherDef.id === "storm" || weatherDef.id === "snow"
  };
}
function getConstructionWeatherDelay(game) {
  const fx = getWeatherEffects(game);
  if (fx.severe) return rand(1, 3);
  if (fx.timeMult > 1.1) return rand(0, 1);
  return 0;
}

// src/systems/staffPerformance.js
var REVIEW_OUTCOMES = [
  { min: 85, label: "Outstanding", ratingLabel: "\u2B50\u2B50\u2B50\u2B50\u2B50", raiseChance: 0.8, loyaltyGain: 15, stressRelief: 10, promotionEligible: true },
  { min: 70, label: "Exceeds Expectations", ratingLabel: "\u2B50\u2B50\u2B50\u2B50", raiseChance: 0.45, loyaltyGain: 8, stressRelief: 5, promotionEligible: false },
  { min: 55, label: "Meets Expectations", ratingLabel: "\u2B50\u2B50\u2B50", raiseChance: 0.2, loyaltyGain: 3, stressRelief: 0, promotionEligible: false },
  { min: 35, label: "Needs Improvement", ratingLabel: "\u2B50\u2B50", raiseChance: 0, loyaltyGain: -5, stressRelief: -5, promotionEligible: false },
  { min: 0, label: "Underperforming", ratingLabel: "\u2B50", raiseChance: 0, loyaltyGain: -12, stressRelief: -10, promotionEligible: false }
];
var REVIEW_INTERVAL_DAYS = 14;
function getWorkerArray(game) {
  return game.workers || game.crew || game.staff || [];
}
function computePerformanceScore(worker) {
  const deliveries = Math.min(worker.deliveries || worker.jobsDone || 0, 30);
  const deliveryScore = deliveries / 30 * 35;
  const happiness = worker.happiness || 65;
  const happinessScore = happiness / 100 * 25;
  const skill = worker.skill || 50;
  const skillScore = skill / 100 * 20;
  const attendance = 1 - Math.min(worker.absences || 0, 5) * 0.08;
  const attendanceScore = attendance * 15;
  const burnoutPenalty = worker.burnout ? -15 : 0;
  const stressPenalty = (worker.stress || 0) > 70 ? -5 : 0;
  return clamp(Math.round(deliveryScore + happinessScore + skillScore + attendanceScore + burnoutPenalty + stressPenalty), 0, 100);
}
function getOutcome(score) {
  return REVIEW_OUTCOMES.find((o) => score >= o.min) || REVIEW_OUTCOMES[REVIEW_OUTCOMES.length - 1];
}
function reviewWorker(game, worker) {
  const score = computePerformanceScore(worker);
  const outcome = getOutcome(score);
  worker.lastReviewDay = game.day || 0;
  worker.lastReviewScore = score;
  worker.lastReviewLabel = outcome.label;
  worker.performanceScore = score;
  worker.loyalty = clamp((worker.loyalty || 60) + outcome.loyaltyGain, 0, 100);
  worker.stress = clamp((worker.stress || 20) + outcome.stressRelief * -1, 0, 100);
  if (outcome.raiseChance > 0 && Math.random() < outcome.raiseChance) {
    const bump = score >= 85 ? 0.75 : 0.25;
    worker.hourlyWage = Math.round(((worker.hourlyWage || 15) + bump) * 100) / 100;
    worker.loyalty = clamp((worker.loyalty || 60) + 5, 0, 100);
    addLog(game, `\u{1F4CB} ${worker.name} \u2014 ${outcome.label} review. Wage \u2191 $${bump.toFixed(2)}/hr.`);
  } else if (outcome.loyaltyGain < 0) {
    worker.resignationRisk = clamp((worker.resignationRisk || 0) + 15, 0, 100);
    addLog(game, `\u{1F4CB} ${worker.name} \u2014 ${outcome.label} review. Improvement needed or morale drops further.`);
  } else {
    addLog(game, `\u{1F4CB} ${worker.name} \u2014 ${outcome.label} review (${score}/100).`);
  }
  worker.promotionEligible = outcome.promotionEligible && (worker.skill || 50) >= 70;
  worker.deliveries = 0;
  return { workerId: worker.id, score, label: outcome.label };
}
function tickPerformanceReviews(game) {
  const day = game.day || 0;
  if (day < 7) return;
  if (!game.performanceReviewsEnabled) game.performanceReviewsEnabled = true;
  const workers = getWorkerArray(game);
  const reviewed = [];
  workers.forEach((w) => {
    const lastReview = w.lastReviewDay || 0;
    if (day - lastReview >= REVIEW_INTERVAL_DAYS) {
      reviewed.push(reviewWorker(game, w));
    }
  });
  if (reviewed.length > 0) {
    game.lastReviewBatch = { day, reviews: reviewed };
  }
}
function getTeamMorale(game) {
  const workers = getWorkerArray(game);
  if (workers.length === 0) return 65;
  const totalHappiness = workers.reduce((s, w) => s + (w.happiness || 65), 0);
  const totalStress = workers.reduce((s, w) => s + (w.stress || 20), 0);
  const burnoutCount = workers.filter((w) => w.burnout).length;
  const avgHappiness = totalHappiness / workers.length;
  const avgStress = totalStress / workers.length;
  const burnoutPenalty = burnoutCount * 8;
  return clamp(Math.round(avgHappiness * 0.6 - avgStress * 0.3 - burnoutPenalty + 30), 0, 100);
}
function tickTeamMorale(game) {
  const workers = getWorkerArray(game);
  if (workers.length === 0) return;
  const morale = getTeamMorale(game);
  if (morale >= 80 && Math.random() < 0.3) {
    workers.forEach((w) => {
      w.happiness = clamp((w.happiness || 65) + rand(1, 4), 0, 100);
    });
    addLog(game, "\u{1F465} High team morale \u2014 positive energy spreading through the crew.");
  }
  if (morale <= 25 && Math.random() < 0.4) {
    workers.forEach((w) => {
      w.stress = clamp((w.stress || 20) + rand(3, 8), 0, 100);
      w.resignationRisk = clamp((w.resignationRisk || 0) + 5, 0, 100);
    });
    addLog(game, "\u26A0 Low team morale \u2014 stress spreading. Consider a retention bonus or team day.");
  }
  game.teamMorale = morale;
}

// src/systems/contractBidding.js
var CONTRACT_TYPES = [
  { id: "supply_run", label: "Supply Run Contract", baseValue: 800, duration: 7, repRequired: 0, clientType: "Small Business", frequency: 0.35 },
  { id: "retail_chain", label: "Retail Chain Account", baseValue: 2200, duration: 14, repRequired: 30, clientType: "Retail Chain", frequency: 0.25 },
  { id: "gov_logistics", label: "Gov. Logistics Tender", baseValue: 4500, duration: 21, repRequired: 55, clientType: "Government", frequency: 0.15 },
  { id: "corp_account", label: "Corporate Account", baseValue: 3200, duration: 14, repRequired: 45, clientType: "Corporation", frequency: 0.18 },
  { id: "hospital_chain", label: "Medical Supply Deal", baseValue: 5500, duration: 30, repRequired: 65, clientType: "Healthcare", frequency: 0.07 }
];
var RFP_SPAWN_INTERVAL = 5;
var MAX_OPEN_RFPS = 3;
var RFP_EXPIRY_DAYS = 4;
function pickContractType(reputation) {
  const eligible = CONTRACT_TYPES.filter((t) => reputation >= t.repRequired);
  if (eligible.length === 0) return CONTRACT_TYPES[0];
  const total = eligible.reduce((s, t) => s + t.frequency, 0);
  let r = Math.random() * total;
  for (const t of eligible) {
    r -= t.frequency;
    if (r <= 0) return t;
  }
  return eligible[eligible.length - 1];
}
function generateAiBids(contractType, reputation, aiCompetitors) {
  const base = contractType.baseValue;
  const numBidders = Math.min(aiCompetitors.length, rand(1, 3));
  const rivals = aiCompetitors.slice(0, numBidders);
  return rivals.map((ai) => {
    const repFactor = clamp((ai.reputation || 50) / 80, 0.7, 1.3);
    const bidAmount = Math.round(base * (0.75 + Math.random() * 0.5) * repFactor);
    return { name: ai.name || ai.id, bid: bidAmount, reputation: ai.reputation || 50 };
  });
}
function tickContractRFPs(game) {
  const day = game.day || 0;
  if (!game.openRFPs) game.openRFPs = [];
  if (!game.activeContracts) game.activeContracts = [];
  if (!game.contractHistory) game.contractHistory = [];
  game.openRFPs = game.openRFPs.filter((rfp) => {
    if (day - rfp.spawnDay >= RFP_EXPIRY_DAYS) {
      addLog(game, `\u{1F4CB} RFP expired: ${rfp.label} \u2014 no bid submitted.`);
      return false;
    }
    return true;
  });
  game.activeContracts = game.activeContracts.filter((contract) => {
    if (day >= contract.expiresDay) {
      addLog(game, `\u2705 Contract complete: ${contract.label} \u2014 finished.`);
      game.contractHistory.push({ ...contract, completedDay: day });
      return false;
    }
    const dailyPay = Math.round(contract.weeklyPayout / 7);
    game.cash = (game.cash || 0) + dailyPay;
    game.weeklyProfit = (game.weeklyProfit || 0) + dailyPay;
    if (!game.contractIncome) game.contractIncome = 0;
    game.contractIncome += dailyPay;
    return true;
  });
  const lastSpawn = game.lastRFPSpawnDay || 0;
  if (day - lastSpawn >= RFP_SPAWN_INTERVAL && game.openRFPs.length < MAX_OPEN_RFPS) {
    const type = pickContractType(game.reputation || 0);
    const demandMod = game.economy?.demandIndex || 1;
    const baseValue = Math.round(type.baseValue * demandMod * (0.9 + Math.random() * 0.2));
    const rfp = {
      id: uid(),
      type: type.id,
      label: type.label,
      clientType: type.clientType,
      baseValue,
      weeklyPayout: baseValue,
      duration: type.duration,
      repRequired: type.repRequired,
      spawnDay: day,
      expiresDay: day + RFP_EXPIRY_DAYS,
      aiBids: generateAiBids(type, game.reputation || 0, game.aiCompetitors || []),
      playerBid: null,
      status: "open"
    };
    game.openRFPs.push(rfp);
    game.lastRFPSpawnDay = day;
    addLog(game, `\u{1F4CB} New RFP: ${rfp.label} (${rfp.clientType}) \u2014 ${rfp.duration}d contract, up to $${baseValue.toLocaleString()}/wk. Bid before day ${rfp.expiresDay}.`);
  }
}

// src/systems/analyticsEngine.js
var SNAPSHOT_INTERVAL = 7;
var MAX_SNAPSHOTS = 26;
var KPI_BENCHMARKS = {
  revenuePerVehicle: { good: 1200, great: 2e3, label: "Revenue / Vehicle / Week" },
  onTimeRate: { good: 0.8, great: 0.92, label: "On-Time Delivery Rate" },
  costPerRoute: { good: 120, great: 70, label: "Cost per Route", lowerIsBetter: true },
  utilizationRate: { good: 0.65, great: 0.82, label: "Fleet Utilization" },
  staffRetention: { good: 0.8, great: 0.92, label: "Staff Retention Rate" },
  customerRating: { good: 3.8, great: 4.5, label: "Customer Rating" },
  profitMargin: { good: 0.15, great: 0.3, label: "Profit Margin" },
  contractWinRate: { good: 0.4, great: 0.65, label: "Contract Win Rate" }
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
function initAnalytics(game) {
  if (game.analytics) return;
  game.analytics = {
    snapshots: [],
    lastSnapshotDay: 0,
    weeklyReport: null,
    allTimeRevenue: 0,
    allTimeRoutes: 0,
    allTimeExpenses: 0
  };
}
function captureSnapshot(game) {
  const day = game.day || 0;
  const vehicles = game.vehicles || game.equipment || [];
  const activeVehicles = vehicles.filter((v) => v.status === "En Route").length;
  const utilizationRate = vehicles.length > 0 ? clamp(activeVehicles / vehicles.length, 0, 1) : 0;
  const completedRoutes = game.weeklyStats?.completedRoutes || 0;
  const lateDeliveries = game.weeklyStats?.lateDeliveries || 0;
  const onTimeRate = completedRoutes > 0 ? clamp((completedRoutes - lateDeliveries) / completedRoutes, 0, 1) : 1;
  const routeIncome = game.weeklyStats?.routeIncome || 0;
  const contractIncome = game.weeklyStats?.contractIncome || 0;
  const totalRevenue = routeIncome + contractIncome;
  const totalExpenses = game.weeklyStats?.wages || 0 + (game.weeklyStats?.fuel || 0) + (game.weeklyStats?.repairs || 0) + (game.weeklyStats?.rent || 0) + (game.weeklyStats?.insurance || 0) + (game.weeklyStats?.taxes || 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
  const revenuePerVehicle = vehicles.length > 0 ? Math.round(totalRevenue / vehicles.length) : 0;
  const workers = game.workers || game.crew || game.staff || [];
  const activeWorkers = workers.filter((w) => !w.fired && w.status !== "Fired");
  const burnoutCount = activeWorkers.filter((w) => w.burnout).length;
  const staffRetention = activeWorkers.length > 0 ? clamp(1 - (game.weeklyStats?.quits || 0) / activeWorkers.length, 0, 1) : 1;
  const costPerRoute = completedRoutes > 0 ? Math.round(totalExpenses / completedRoutes) : 0;
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
    demandScore: game.demandScore || 1
  };
  game.analytics.allTimeRevenue = (game.analytics.allTimeRevenue || 0) + totalRevenue;
  game.analytics.allTimeRoutes = (game.analytics.allTimeRoutes || 0) + completedRoutes;
  game.analytics.allTimeExpenses = (game.analytics.allTimeExpenses || 0) + totalExpenses;
  return snapshot;
}
function tickAnalytics(game) {
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
  if (snap.onTimeRate < 0.7) highlights.push("Late deliveries hurting reputation \u2014 dispatch earlier.");
  if (snap.utilizationRate < 0.4) highlights.push("Fleet underutilized \u2014 hire more drivers or reduce vehicles.");
  if (snap.burnoutCount > 0) highlights.push(`${snap.burnoutCount} worker(s) burned out \u2014 reduce shifts.`);
  if (snap.customerRating >= 4.5) highlights.push("Customer ratings outstanding \u2014 keep it up.");
  if (snap.customerRating < 3) highlights.push("Customer satisfaction falling \u2014 check staffing.");
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
      customerRating: { value: snap.customerRating, rating: scoreKpi(snap.customerRating, KPI_BENCHMARKS.customerRating) }
    }
  };
}

// src/systems/territorySystem.js
var ZONE_TYPES = {
  fleet: [
    { id: "downtown", label: "Downtown Core", unlockCost: 3500, repRequired: 20, payoutMult: 1.12, exclusiveTag: "rush", presenceIncome: 45, competitorWeight: 3, desc: "High-volume commercial deliveries, rush premium" },
    { id: "industrial", label: "Industrial District", unlockCost: 5e3, repRequired: 35, payoutMult: 1.18, exclusiveTag: "heavy", presenceIncome: 60, competitorWeight: 2, desc: "Bulk freight, manufacturing accounts" },
    { id: "airport", label: "Airport Corridor", unlockCost: 8e3, repRequired: 50, payoutMult: 1.25, exclusiveTag: "time_critical", presenceIncome: 80, competitorWeight: 4, desc: "Time-critical cargo, highest payout density" },
    { id: "suburbs", label: "Suburban Network", unlockCost: 4500, repRequired: 30, payoutMult: 1.08, exclusiveTag: "residential", presenceIncome: 50, competitorWeight: 1, desc: "High volume, reliable steady income" },
    { id: "port", label: "Port & Docks", unlockCost: 9500, repRequired: 60, payoutMult: 1.35, exclusiveTag: "hazmat", presenceIncome: 95, competitorWeight: 3, desc: "Hazmat and container logistics, top rates" },
    { id: "medical", label: "Medical Zone", unlockCost: 12e3, repRequired: 70, payoutMult: 1.4, exclusiveTag: "priority", presenceIncome: 110, competitorWeight: 2, desc: "Medical supply chain, highest trust required" }
  ],
  construction: [
    { id: "residential", label: "Residential Builds", unlockCost: 4e3, repRequired: 20, payoutMult: 1.1, exclusiveTag: "housing", presenceIncome: 40, competitorWeight: 2, desc: "Subdivision and home builds" },
    { id: "commercial", label: "Commercial District", unlockCost: 7e3, repRequired: 40, payoutMult: 1.2, exclusiveTag: "commercial", presenceIncome: 65, competitorWeight: 3, desc: "Office parks, retail builds" },
    { id: "government", label: "Gov. Infrastructure", unlockCost: 12e3, repRequired: 65, payoutMult: 1.35, exclusiveTag: "gov", presenceIncome: 100, competitorWeight: 1, desc: "Public works, highest contract stability" }
  ],
  restaurant: [
    { id: "downtown", label: "Downtown Foot Traffic", unlockCost: 3e3, repRequired: 25, payoutMult: 1.15, exclusiveTag: "catering", presenceIncome: 55, competitorWeight: 3, desc: "Peak lunch rush, corporate catering" },
    { id: "university", label: "University District", unlockCost: 2500, repRequired: 15, payoutMult: 1.08, exclusiveTag: "student", presenceIncome: 40, competitorWeight: 2, desc: "Consistent volume, budget-sensitive" },
    { id: "upscale", label: "Upscale Quarter", unlockCost: 6e3, repRequired: 55, payoutMult: 1.28, exclusiveTag: "premium", presenceIncome: 80, competitorWeight: 4, desc: "Fine dining demand, premium clientele" }
  ],
  realestate: [
    { id: "urban_core", label: "Urban Core", unlockCost: 15e3, repRequired: 30, payoutMult: 1.15, exclusiveTag: "highrise", presenceIncome: 90, competitorWeight: 4, desc: "High-density multi-family" },
    { id: "suburb_dev", label: "Suburb Development", unlockCost: 1e4, repRequired: 20, payoutMult: 1.1, exclusiveTag: "sfh", presenceIncome: 70, competitorWeight: 2, desc: "SFH and townhome market" },
    { id: "luxury", label: "Luxury Market", unlockCost: 25e3, repRequired: 60, payoutMult: 1.3, exclusiveTag: "luxury", presenceIncome: 150, competitorWeight: 3, desc: "Premium listings, biggest margins" }
  ]
};
function initTerritories(game, businessType) {
  if (game.territories) return;
  const zones = ZONE_TYPES[businessType] || ZONE_TYPES.fleet;
  game.territories = {
    businessType,
    unlockedZones: [],
    contestedZones: [],
    totalPresenceIncome: 0,
    lastPresenceDay: 0
  };
}
function tickTerritories(game) {
  if (!game.territories) return;
  const day = game.day || 0;
  const t = game.territories;
  const zones = ZONE_TYPES[t.businessType] || ZONE_TYPES.fleet;
  if (day <= t.lastPresenceDay) return;
  t.lastPresenceDay = day;
  let totalIncome = 0;
  const contestedNow = [];
  t.unlockedZones.forEach((zoneId) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const competitors = game.aiCompetitors || [];
    const avgCompRep = competitors.length > 0 ? competitors.reduce((s, c) => s + (c.reputation || 50), 0) / competitors.length : 0;
    const contested = avgCompRep > (game.reputation || 0) + 10 && Math.random() < zone.competitorWeight * 0.08;
    const incomeMult = contested ? 0.65 : 1;
    const dailyIncome = Math.round(zone.presenceIncome * incomeMult * (1 + (game.reputation || 0) * 2e-3));
    game.cash = (game.cash || 0) + dailyIncome;
    totalIncome += dailyIncome;
    if (contested) {
      contestedNow.push(zoneId);
      if (Math.random() < 0.25) {
        addLog(game, `\u26A0 ${zone.label} is contested \u2014 presence income reduced. Build reputation to defend territory.`);
      }
    }
  });
  t.totalPresenceIncome = totalIncome;
  t.contestedZones = contestedNow;
  if (totalIncome > 0 && game.economy) {
    game.economy.demandIndex = clamp((game.economy.demandIndex || 1) + 5e-3 * t.unlockedZones.length, 0.5, 1.8);
  }
}

// src/data/lendingProducts.js
var LOAN_CATEGORIES = {
  MICROLOAN: "microloan",
  EQUIPMENT: "equipment",
  WORKING_CAPITAL: "working_capital",
  BRANCH_EXPANSION: "branch_expansion",
  COMMERCIAL_FLEET: "commercial_fleet",
  ACQUISITION: "acquisition"
};
var LENDING_PRODUCTS = [
  {
    id: "microloan",
    category: LOAN_CATEGORIES.MICROLOAN,
    label: "Emergency Microloan",
    description: "Fast, small, unsecured cash for a short-term cash crunch.",
    principalMin: 2500,
    principalMax: 1e4,
    aprMin: 14,
    aprMax: 26,
    termWeeks: 10,
    minCredit: 460,
    requiresCollateral: false,
    minCompanyAgeDays: 0,
    maxDebtToValueRatio: 1.5
  },
  {
    id: "equipment",
    category: LOAN_CATEGORIES.EQUIPMENT,
    label: "Equipment Financing",
    description: "Borrow against the value of an eligible vehicle you already own \u2014 lower APR since the vehicle itself is collateral, but it can be repossessed on default.",
    principalMin: 3e3,
    principalMax: 4e5,
    aprMin: 6,
    aprMax: 14,
    termWeeks: 26,
    minCredit: 520,
    requiresCollateral: true,
    collateralType: "vehicle",
    maxCollateralLtv: 0.8,
    // "up to 80% of an eligible vehicle" per the Phase 2 handoff doc
    minCompanyAgeDays: 0,
    maxDebtToValueRatio: 2.5
  },
  {
    id: "working_capital",
    category: LOAN_CATEGORIES.WORKING_CAPITAL,
    label: "Working-Capital Line",
    description: "Flexible unsecured operating capital for payroll, fuel, and day-to-day cash flow.",
    principalMin: 25e3,
    principalMax: 25e4,
    aprMin: 9,
    aprMax: 18,
    termWeeks: 30,
    minCredit: 600,
    requiresCollateral: false,
    minCompanyAgeDays: 14,
    maxDebtToValueRatio: 2
  },
  {
    id: "branch_expansion",
    category: LOAN_CATEGORIES.BRANCH_EXPANSION,
    label: "Branch Expansion Loan",
    description: "Financing sized for opening or upgrading branch locations.",
    principalMin: 1e5,
    principalMax: 1e6,
    aprMin: 7,
    aprMax: 15,
    termWeeks: 52,
    minCredit: 650,
    requiresCollateral: false,
    minCompanyAgeDays: 30,
    maxDebtToValueRatio: 1.6
  },
  {
    id: "commercial_fleet",
    category: LOAN_CATEGORIES.COMMERCIAL_FLEET,
    label: "Commercial Fleet Loan",
    description: "Large-scale fleet financing for established companies, secured by the fleet's aggregate value.",
    principalMin: 5e5,
    principalMax: 5e6,
    aprMin: 6,
    aprMax: 12,
    termWeeks: 65,
    minCredit: 700,
    requiresCollateral: true,
    collateralType: "fleet",
    maxCollateralLtv: 0.7,
    minCompanyAgeDays: 60,
    maxDebtToValueRatio: 1.4
  },
  {
    id: "acquisition",
    category: LOAN_CATEGORIES.ACQUISITION,
    label: "Acquisition Financing",
    description: "Financing to fund the purchase of an eligible rival/company acquisition.",
    principalMin: 1e4,
    principalMax: 8e6,
    aprMin: 8,
    aprMax: 16,
    termWeeks: 52,
    minCredit: 680,
    requiresCollateral: true,
    collateralType: "company",
    maxCollateralLtv: 0.9,
    minCompanyAgeDays: 45,
    maxDebtToValueRatio: 1.3
  }
];
var LENDING_PRODUCT_BY_ID = Object.fromEntries(LENDING_PRODUCTS.map((p) => [p.id, p]));
function getLendingProduct(productId) {
  return LENDING_PRODUCT_BY_ID[productId] || null;
}

// src/systems/lendingEngine.js
function normalizeProfile(profile = {}) {
  return {
    creditScore: Number.isFinite(profile.creditScore) ? profile.creditScore : 550,
    companyValue: Number.isFinite(profile.companyValue) ? profile.companyValue : 0,
    cashFlow: Number.isFinite(profile.cashFlow) ? profile.cashFlow : 0,
    existingDebt: Number.isFinite(profile.existingDebt) ? Math.max(0, profile.existingDebt) : 0,
    missedPaymentCount: Number.isFinite(profile.missedPaymentCount) ? Math.max(0, profile.missedPaymentCount) : 0,
    companyAgeDays: Number.isFinite(profile.companyAgeDays) ? Math.max(0, profile.companyAgeDays) : 0,
    collateralValue: Number.isFinite(profile.collateralValue) ? Math.max(0, profile.collateralValue) : 0,
    economyMult: Number.isFinite(profile.economyMult) ? profile.economyMult : 1
  };
}
function qualificationStrength(profile, product) {
  const creditRange = 850 - product.minCredit;
  const creditScore01 = creditRange > 0 ? clamp01((profile.creditScore - product.minCredit) / creditRange) : 1;
  const debtToValue = profile.companyValue > 0 ? profile.existingDebt / profile.companyValue : profile.existingDebt > 0 ? 1 : 0;
  const debtHeadroom01 = clamp01(1 - debtToValue / Math.max(0.01, product.maxDebtToValueRatio));
  const cashFlow01 = clamp01((profile.cashFlow + 2e3) / 1e4);
  const paymentHistory01 = clamp01(1 - profile.missedPaymentCount / 8);
  return clamp01(
    creditScore01 * 0.35 + debtHeadroom01 * 0.3 + cashFlow01 * 0.2 + paymentHistory01 * 0.15
  );
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function evaluateLoanEligibility(productId, rawProfile) {
  const product = getLendingProduct(productId);
  if (!product) return { eligible: false, reasons: ["Unknown loan product."] };
  const profile = normalizeProfile(rawProfile);
  const reasons = [];
  if (profile.creditScore < product.minCredit) {
    reasons.push(`Credit score ${profile.creditScore} is below the ${product.minCredit} minimum for ${product.label}.`);
  }
  if (profile.companyAgeDays < product.minCompanyAgeDays) {
    reasons.push(`Company must be at least ${product.minCompanyAgeDays} days old (currently ${profile.companyAgeDays}).`);
  }
  const debtToValue = profile.companyValue > 0 ? profile.existingDebt / profile.companyValue : profile.existingDebt > 0 ? Infinity : 0;
  if (debtToValue > product.maxDebtToValueRatio) {
    reasons.push(`Existing debt is too high relative to company value for ${product.label}.`);
  }
  if (product.requiresCollateral && profile.collateralValue <= 0) {
    reasons.push(`${product.label} requires eligible collateral, and none was provided.`);
  }
  if (profile.cashFlow < -5e3) {
    reasons.push("Recent cash flow is too negative to support new debt service.");
  }
  return { eligible: reasons.length === 0, reasons };
}
function computeLoanOffer(productId, rawProfile, { idFactory } = {}) {
  const product = getLendingProduct(productId);
  if (!product) return { approved: false, reasons: ["Unknown loan product."] };
  const profile = normalizeProfile(rawProfile);
  const eligibility = evaluateLoanEligibility(productId, profile);
  if (!eligibility.eligible) return { approved: false, reasons: eligibility.reasons };
  const strength = qualificationStrength(profile, product);
  let principal = Math.round(product.principalMin + (product.principalMax - product.principalMin) * strength);
  let collateralCap = null;
  if (product.requiresCollateral) {
    collateralCap = Math.round(profile.collateralValue * (product.maxCollateralLtv ?? 1));
    principal = Math.min(principal, collateralCap);
    principal = Math.max(product.principalMin, Math.min(principal, product.principalMax));
    if (principal > collateralCap) {
      return { approved: false, reasons: [`Collateral only supports up to ${collateralCap} at this product's ${Math.round((product.maxCollateralLtv ?? 1) * 100)}% LTV cap.`] };
    }
  }
  const baseApr = product.aprMax - (product.aprMax - product.aprMin) * strength;
  const economyAdjustment = clamp2(((profile.economyMult ?? 1) - 1) * -6, -1.5, 1.5);
  const apr = Math.max(product.aprMin, Math.round((baseApr + economyAdjustment) * 10) / 10);
  const totalRepayment = Math.round(principal * (1 + apr / 100 * (product.termWeeks / 52)));
  const weeklyPayment = Math.max(1, Math.round(totalRepayment / product.termWeeks));
  const approvalReason = strength >= 0.75 ? "Strong credit, low existing debt, and healthy cash flow qualified you for near-prime terms." : strength >= 0.45 ? "Approved on standard terms based on your current credit and debt profile." : "Approved at the higher end of this product's rate range \u2014 credit, debt load, or cash flow are limiting factors.";
  return {
    approved: true,
    id: idFactory ? idFactory() : void 0,
    productId: product.id,
    category: product.category,
    label: product.label,
    principal,
    apr,
    termWeeks: product.termWeeks,
    weeklyPayment,
    totalRepayment,
    paymentFrequency: "Weekly",
    collateralRequired: product.requiresCollateral,
    collateralType: product.requiresCollateral ? product.collateralType : null,
    collateralValue: product.requiresCollateral ? profile.collateralValue : 0,
    approvalReason,
    qualificationStrength: strength
  };
}
function clamp2(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function offerToLoanRecord(offer, uid3, extra = {}) {
  return {
    id: uid3(),
    productId: offer.productId,
    category: offer.category,
    label: offer.label,
    principal: offer.principal,
    apr: offer.apr,
    weeksLeft: offer.termWeeks,
    totalWeeks: offer.termWeeks,
    weeklyPayment: offer.weeklyPayment,
    remainingBalance: offer.totalRepayment,
    missedPayments: 0,
    deferUntilDay: 0,
    inCollections: false,
    collateralType: offer.collateralType || null,
    collateralVehicleId: extra.collateralVehicleId || null,
    collateralValue: offer.collateralValue || 0,
    paymentFrequency: offer.paymentFrequency,
    approvalReason: offer.approvalReason
  };
}

// src/data/regionalEconomy2026.js
var DIVISION_IDS = [
  "local_last_mile",
  "retail_distribution",
  "cold_chain",
  "medical_logistics",
  "construction_heavy_haul",
  "industrial_resources",
  "specialized_logistics"
];
function demand(overrides = {}) {
  const base = {};
  DIVISION_IDS.forEach((id) => {
    base[id] = 1;
  });
  return { ...base, ...overrides };
}
var STATE_ECONOMY_2026 = {
  // ── West ──────────────────────────────────────────────────────────────────────────────────
  CA: { code: "CA", name: "California", censusRegion: "West", costIndex: 1.107, wageIndex: 1.1, fuelIndex: 1.38, dieselIndex: 1.45, insuranceIndex: 1.35, vehicleTaxRate: 0.0725, registrationBaseFee: 240, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.2, cold_chain: 1.2, specialized_logistics: 1.15, local_last_mile: 1.15 }), sourceTier: "anchor" },
  OR: { code: "OR", name: "Oregon", censusRegion: "West", costIndex: 1.034, wageIndex: 1.02, fuelIndex: 1.13, dieselIndex: 1.2, insuranceIndex: 1, vehicleTaxRate: 5e-3, registrationBaseFee: 150, weatherRiskIndex: 1.05, industryDemand: demand({ industrial_resources: 1.25, construction_heavy_haul: 1.1, local_last_mile: 1.05 }), sourceTier: "anchor" },
  WA: { code: "WA", name: "Washington", censusRegion: "West", costIndex: 1.075, wageIndex: 1.08, fuelIndex: 1.25, dieselIndex: 1.32, insuranceIndex: 1.05, vehicleTaxRate: 0.065, registrationBaseFee: 180, weatherRiskIndex: 1, industryDemand: demand({ retail_distribution: 1.2, industrial_resources: 1.1, specialized_logistics: 1.05 }), sourceTier: "anchor" },
  NV: { code: "NV", name: "Nevada", censusRegion: "West", costIndex: 0.98, wageIndex: 0.97, fuelIndex: 1.1, dieselIndex: 1.17, insuranceIndex: 1.2, vehicleTaxRate: 0.0685, registrationBaseFee: 165, weatherRiskIndex: 0.9, industryDemand: demand({ specialized_logistics: 1.15, retail_distribution: 1.1 }), sourceTier: "regional-estimate" },
  AZ: { code: "AZ", name: "Arizona", censusRegion: "West", costIndex: 0.97, wageIndex: 0.95, fuelIndex: 1.02, dieselIndex: 1.08, insuranceIndex: 1.05, vehicleTaxRate: 0.056, registrationBaseFee: 130, weatherRiskIndex: 0.9, industryDemand: demand({ construction_heavy_haul: 1.15, industrial_resources: 1.1 }), sourceTier: "regional-estimate" },
  CO: { code: "CO", name: "Colorado", censusRegion: "West", costIndex: 1.02, wageIndex: 1.02, fuelIndex: 0.98, dieselIndex: 1.04, insuranceIndex: 1.22, vehicleTaxRate: 0.029, registrationBaseFee: 145, weatherRiskIndex: 1.15, industryDemand: demand({ construction_heavy_haul: 1.15, industrial_resources: 1.1 }), sourceTier: "regional-estimate" },
  UT: { code: "UT", name: "Utah", censusRegion: "West", costIndex: 0.97, wageIndex: 0.96, fuelIndex: 0.99, dieselIndex: 1.05, insuranceIndex: 0.95, vehicleTaxRate: 0.0685, registrationBaseFee: 120, weatherRiskIndex: 1.05, industryDemand: demand({ construction_heavy_haul: 1.1, industrial_resources: 1.1 }), sourceTier: "regional-estimate" },
  NM: { code: "NM", name: "New Mexico", censusRegion: "West", costIndex: 0.93, wageIndex: 0.93, fuelIndex: 1, dieselIndex: 1.06, insuranceIndex: 1.05, vehicleTaxRate: 0.04, registrationBaseFee: 110, weatherRiskIndex: 1, industryDemand: demand({ industrial_resources: 1.2 }), sourceTier: "regional-estimate" },
  ID: { code: "ID", name: "Idaho", censusRegion: "West", costIndex: 0.93, wageIndex: 0.92, fuelIndex: 1.02, dieselIndex: 1.08, insuranceIndex: 0.92, vehicleTaxRate: 0.06, registrationBaseFee: 110, weatherRiskIndex: 1.1, industryDemand: demand({ industrial_resources: 1.25, cold_chain: 1.1 }), sourceTier: "regional-estimate" },
  MT: { code: "MT", name: "Montana", censusRegion: "West", costIndex: 0.946, wageIndex: 0.94, fuelIndex: 0.83, dieselIndex: 0.9, insuranceIndex: 0.95, vehicleTaxRate: 0, registrationBaseFee: 88, weatherRiskIndex: 1.3, industryDemand: demand({ industrial_resources: 1.35, construction_heavy_haul: 1.15, specialized_logistics: 1.1, cold_chain: 0.85, medical_logistics: 0.9 }), sourceTier: "anchor" },
  WY: { code: "WY", name: "Wyoming", censusRegion: "West", costIndex: 0.92, wageIndex: 0.93, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 0.92, vehicleTaxRate: 0.04, registrationBaseFee: 100, weatherRiskIndex: 1.3, industryDemand: demand({ industrial_resources: 1.35, construction_heavy_haul: 1.1 }), sourceTier: "regional-estimate" },
  AK: { code: "AK", name: "Alaska", censusRegion: "West", costIndex: 1.06, wageIndex: 1.18, fuelIndex: 1.2, dieselIndex: 1.27, insuranceIndex: 1.05, vehicleTaxRate: 0, registrationBaseFee: 100, weatherRiskIndex: 1.4, industryDemand: demand({ industrial_resources: 1.3, specialized_logistics: 1.2, cold_chain: 0.85 }), sourceTier: "anchor" },
  HI: { code: "HI", name: "Hawaii", censusRegion: "West", costIndex: 1.1, wageIndex: 1.05, fuelIndex: 1.33, dieselIndex: 1.4, insuranceIndex: 0.85, vehicleTaxRate: 0.045, registrationBaseFee: 200, weatherRiskIndex: 0.85, industryDemand: demand({ specialized_logistics: 1.15, local_last_mile: 1.1 }), sourceTier: "anchor" },
  // ── South ─────────────────────────────────────────────────────────────────────────────────
  TX: { code: "TX", name: "Texas", censusRegion: "South", costIndex: 0.965, wageIndex: 0.99, fuelIndex: 0.88, dieselIndex: 0.94, insuranceIndex: 1.1, vehicleTaxRate: 0.0625, registrationBaseFee: 90, weatherRiskIndex: 1, industryDemand: demand({ industrial_resources: 1.25, construction_heavy_haul: 1.15, specialized_logistics: 1.1 }), sourceTier: "anchor" },
  FL: { code: "FL", name: "Florida", censusRegion: "South", costIndex: 1, wageIndex: 0.97, fuelIndex: 0.96, dieselIndex: 1.02, insuranceIndex: 1.35, vehicleTaxRate: 0.06, registrationBaseFee: 130, weatherRiskIndex: 1.1, industryDemand: demand({ cold_chain: 1.2, specialized_logistics: 1.1, retail_distribution: 1.1 }), sourceTier: "anchor" },
  GA: { code: "GA", name: "Georgia", censusRegion: "South", costIndex: 0.94, wageIndex: 0.95, fuelIndex: 0.92, dieselIndex: 0.98, insuranceIndex: 1.1, vehicleTaxRate: 0.066, registrationBaseFee: 100, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.2, cold_chain: 1.05 }), sourceTier: "regional-estimate" },
  NC: { code: "NC", name: "North Carolina", censusRegion: "South", costIndex: 0.93, wageIndex: 0.93, fuelIndex: 0.93, dieselIndex: 0.99, insuranceIndex: 0.95, vehicleTaxRate: 0.03, registrationBaseFee: 90, weatherRiskIndex: 1, industryDemand: demand({ retail_distribution: 1.1, construction_heavy_haul: 1.05 }), sourceTier: "regional-estimate" },
  SC: { code: "SC", name: "South Carolina", censusRegion: "South", costIndex: 0.9, wageIndex: 0.9, fuelIndex: 0.91, dieselIndex: 0.97, insuranceIndex: 1.05, vehicleTaxRate: 0.05, registrationBaseFee: 85, weatherRiskIndex: 0.98, industryDemand: demand({ retail_distribution: 1.1 }), sourceTier: "regional-estimate" },
  VA: { code: "VA", name: "Virginia", censusRegion: "South", costIndex: 1, wageIndex: 1, fuelIndex: 0.95, dieselIndex: 1.01, insuranceIndex: 0.98, vehicleTaxRate: 0.042, registrationBaseFee: 100, weatherRiskIndex: 1, industryDemand: demand({ specialized_logistics: 1.1, retail_distribution: 1.05 }), sourceTier: "regional-estimate" },
  WV: { code: "WV", name: "West Virginia", censusRegion: "South", costIndex: 0.9, wageIndex: 0.9, fuelIndex: 0.93, dieselIndex: 0.99, insuranceIndex: 0.92, vehicleTaxRate: 0.06, registrationBaseFee: 80, weatherRiskIndex: 1.15, industryDemand: demand({ industrial_resources: 1.3, construction_heavy_haul: 1.1 }), sourceTier: "regional-estimate" },
  KY: { code: "KY", name: "Kentucky", censusRegion: "South", costIndex: 0.89, wageIndex: 0.9, fuelIndex: 0.92, dieselIndex: 0.98, insuranceIndex: 1, vehicleTaxRate: 0.06, registrationBaseFee: 85, weatherRiskIndex: 1, industryDemand: demand({ industrial_resources: 1.15, retail_distribution: 1.05 }), sourceTier: "regional-estimate" },
  TN: { code: "TN", name: "Tennessee", censusRegion: "South", costIndex: 0.9, wageIndex: 0.92, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.07, registrationBaseFee: 85, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.15, industrial_resources: 1.05 }), sourceTier: "anchor" },
  AL: { code: "AL", name: "Alabama", censusRegion: "South", costIndex: 0.88, wageIndex: 0.89, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 1.05, vehicleTaxRate: 0.02, registrationBaseFee: 75, weatherRiskIndex: 1, industryDemand: demand({ industrial_resources: 1.15, construction_heavy_haul: 1.05 }), sourceTier: "regional-estimate" },
  MS: { code: "MS", name: "Mississippi", censusRegion: "South", costIndex: 0.87, wageIndex: 0.87, fuelIndex: 0.89, dieselIndex: 0.95, insuranceIndex: 1, vehicleTaxRate: 0.05, registrationBaseFee: 75, weatherRiskIndex: 1.05, industryDemand: demand({ industrial_resources: 1.25, construction_heavy_haul: 1.1 }), sourceTier: "anchor" },
  LA: { code: "LA", name: "Louisiana", censusRegion: "South", costIndex: 0.9, wageIndex: 0.91, fuelIndex: 0.91, dieselIndex: 0.97, insuranceIndex: 1.45, vehicleTaxRate: 0.0445, registrationBaseFee: 90, weatherRiskIndex: 1.15, industryDemand: demand({ industrial_resources: 1.3, specialized_logistics: 1.15 }), sourceTier: "anchor" },
  AR: { code: "AR", name: "Arkansas", censusRegion: "South", costIndex: 0.869, wageIndex: 0.88, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 0.95, vehicleTaxRate: 0.065, registrationBaseFee: 75, weatherRiskIndex: 1, industryDemand: demand({ retail_distribution: 1.2, industrial_resources: 1.15 }), sourceTier: "anchor" },
  OK: { code: "OK", name: "Oklahoma", censusRegion: "South", costIndex: 0.878, wageIndex: 0.9, fuelIndex: 0.89, dieselIndex: 0.95, insuranceIndex: 1.1, vehicleTaxRate: 0.0325, registrationBaseFee: 85, weatherRiskIndex: 1.1, industryDemand: demand({ industrial_resources: 1.25 }), sourceTier: "anchor" },
  MD: { code: "MD", name: "Maryland", censusRegion: "South", costIndex: 1.06, wageIndex: 1.06, fuelIndex: 1, dieselIndex: 1.06, insuranceIndex: 1.1, vehicleTaxRate: 0.06, registrationBaseFee: 150, weatherRiskIndex: 0.95, industryDemand: demand({ specialized_logistics: 1.1, medical_logistics: 1.1 }), sourceTier: "regional-estimate" },
  DE: { code: "DE", name: "Delaware", censusRegion: "South", costIndex: 1, wageIndex: 1, fuelIndex: 0.97, dieselIndex: 1.03, insuranceIndex: 1.05, vehicleTaxRate: 0, registrationBaseFee: 60, weatherRiskIndex: 0.95, industryDemand: demand({ retail_distribution: 1.15 }), sourceTier: "regional-estimate" },
  // ── Midwest ───────────────────────────────────────────────────────────────────────────────
  IL: { code: "IL", name: "Illinois", censusRegion: "Midwest", costIndex: 0.99, wageIndex: 1, fuelIndex: 1.08, dieselIndex: 1.14, insuranceIndex: 1, vehicleTaxRate: 0.0725, registrationBaseFee: 155, weatherRiskIndex: 1.1, industryDemand: demand({ retail_distribution: 1.25, industrial_resources: 1.1 }), sourceTier: "regional-estimate" },
  OH: { code: "OH", name: "Ohio", censusRegion: "Midwest", costIndex: 0.9, wageIndex: 0.93, fuelIndex: 0.94, dieselIndex: 1, insuranceIndex: 0.75, vehicleTaxRate: 0.0575, registrationBaseFee: 95, weatherRiskIndex: 1.1, industryDemand: demand({ retail_distribution: 1.2, industrial_resources: 1.1 }), sourceTier: "anchor" },
  IN: { code: "IN", name: "Indiana", censusRegion: "Midwest", costIndex: 0.9, wageIndex: 0.92, fuelIndex: 0.86, dieselIndex: 0.92, insuranceIndex: 0.85, vehicleTaxRate: 0.07, registrationBaseFee: 90, weatherRiskIndex: 1.1, industryDemand: demand({ retail_distribution: 1.25, industrial_resources: 1.1 }), sourceTier: "anchor" },
  MI: { code: "MI", name: "Michigan", censusRegion: "Midwest", costIndex: 0.91, wageIndex: 0.94, fuelIndex: 0.98, dieselIndex: 1.04, insuranceIndex: 1.3, vehicleTaxRate: 0.06, registrationBaseFee: 130, weatherRiskIndex: 1.2, industryDemand: demand({ industrial_resources: 1.15, retail_distribution: 1.05 }), sourceTier: "regional-estimate" },
  WI: { code: "WI", name: "Wisconsin", censusRegion: "Midwest", costIndex: 0.92, wageIndex: 0.94, fuelIndex: 0.95, dieselIndex: 1.01, insuranceIndex: 0.9, vehicleTaxRate: 0.05, registrationBaseFee: 100, weatherRiskIndex: 1.2, industryDemand: demand({ industrial_resources: 1.15, cold_chain: 1.05 }), sourceTier: "regional-estimate" },
  MN: { code: "MN", name: "Minnesota", censusRegion: "Midwest", costIndex: 0.97, wageIndex: 0.99, fuelIndex: 0.97, dieselIndex: 1.03, insuranceIndex: 0.95, vehicleTaxRate: 0.0688, registrationBaseFee: 120, weatherRiskIndex: 1.3, industryDemand: demand({ industrial_resources: 1.2, cold_chain: 1.05 }), sourceTier: "regional-estimate" },
  IA: { code: "IA", name: "Iowa", censusRegion: "Midwest", costIndex: 0.878, wageIndex: 0.91, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.05, registrationBaseFee: 90, weatherRiskIndex: 1.2, industryDemand: demand({ industrial_resources: 1.3 }), sourceTier: "anchor" },
  MO: { code: "MO", name: "Missouri", censusRegion: "Midwest", costIndex: 0.89, wageIndex: 0.91, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 1, vehicleTaxRate: 0.04225, registrationBaseFee: 85, weatherRiskIndex: 1.1, industryDemand: demand({ retail_distribution: 1.15, industrial_resources: 1.1 }), sourceTier: "regional-estimate" },
  KS: { code: "KS", name: "Kansas", censusRegion: "Midwest", costIndex: 0.89, wageIndex: 0.9, fuelIndex: 0.89, dieselIndex: 0.95, insuranceIndex: 0.95, vehicleTaxRate: 0.065, registrationBaseFee: 85, weatherRiskIndex: 1.15, industryDemand: demand({ industrial_resources: 1.3 }), sourceTier: "regional-estimate" },
  NE: { code: "NE", name: "Nebraska", censusRegion: "Midwest", costIndex: 0.89, wageIndex: 0.9, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.055, registrationBaseFee: 85, weatherRiskIndex: 1.2, industryDemand: demand({ industrial_resources: 1.35 }), sourceTier: "anchor" },
  SD: { code: "SD", name: "South Dakota", censusRegion: "Midwest", costIndex: 0.881, wageIndex: 0.9, fuelIndex: 0.91, dieselIndex: 0.97, insuranceIndex: 0.9, vehicleTaxRate: 0.04, registrationBaseFee: 80, weatherRiskIndex: 1.25, industryDemand: demand({ industrial_resources: 1.35 }), sourceTier: "anchor" },
  ND: { code: "ND", name: "North Dakota", censusRegion: "Midwest", costIndex: 0.9, wageIndex: 0.93, fuelIndex: 0.9, dieselIndex: 0.96, insuranceIndex: 0.85, vehicleTaxRate: 0.05, registrationBaseFee: 90, weatherRiskIndex: 1.3, industryDemand: demand({ industrial_resources: 1.35 }), sourceTier: "anchor" },
  // ── Northeast ─────────────────────────────────────────────────────────────────────────────
  NY: { code: "NY", name: "New York", censusRegion: "Northeast", costIndex: 1.1, wageIndex: 1.1, fuelIndex: 1.1, dieselIndex: 1.17, insuranceIndex: 1.4, vehicleTaxRate: 0.04, registrationBaseFee: 140, weatherRiskIndex: 1.15, industryDemand: demand({ local_last_mile: 1.25, specialized_logistics: 1.15, medical_logistics: 1.1 }), sourceTier: "anchor" },
  NJ: { code: "NJ", name: "New Jersey", censusRegion: "Northeast", costIndex: 1.088, wageIndex: 1.15, fuelIndex: 1.05, dieselIndex: 1.12, insuranceIndex: 1.5, vehicleTaxRate: 0.06625, registrationBaseFee: 130, weatherRiskIndex: 1.05, industryDemand: demand({ retail_distribution: 1.25, local_last_mile: 1.15 }), sourceTier: "anchor" },
  PA: { code: "PA", name: "Pennsylvania", censusRegion: "Northeast", costIndex: 0.98, wageIndex: 1, fuelIndex: 1.05, dieselIndex: 1.12, insuranceIndex: 1.05, vehicleTaxRate: 0.06, registrationBaseFee: 105, weatherRiskIndex: 1.1, industryDemand: demand({ retail_distribution: 1.15, industrial_resources: 1.05 }), sourceTier: "regional-estimate" },
  MA: { code: "MA", name: "Massachusetts", censusRegion: "Northeast", costIndex: 1.07, wageIndex: 1.08, fuelIndex: 1.03, dieselIndex: 1.1, insuranceIndex: 0.9, vehicleTaxRate: 0.0625, registrationBaseFee: 130, weatherRiskIndex: 1.1, industryDemand: demand({ medical_logistics: 1.2, local_last_mile: 1.15 }), sourceTier: "regional-estimate" },
  CT: { code: "CT", name: "Connecticut", censusRegion: "Northeast", costIndex: 1.05, wageIndex: 1.06, fuelIndex: 1.04, dieselIndex: 1.11, insuranceIndex: 1.1, vehicleTaxRate: 0.0635, registrationBaseFee: 140, weatherRiskIndex: 1.05, industryDemand: demand({ local_last_mile: 1.15, medical_logistics: 1.1 }), sourceTier: "regional-estimate" },
  RI: { code: "RI", name: "Rhode Island", censusRegion: "Northeast", costIndex: 1, wageIndex: 1, fuelIndex: 1.02, dieselIndex: 1.09, insuranceIndex: 1.25, vehicleTaxRate: 0.07, registrationBaseFee: 120, weatherRiskIndex: 1.05, industryDemand: demand({ local_last_mile: 1.1 }), sourceTier: "regional-estimate" },
  VT: { code: "VT", name: "Vermont", censusRegion: "Northeast", costIndex: 1, wageIndex: 0.98, fuelIndex: 1, dieselIndex: 1.07, insuranceIndex: 0.7, vehicleTaxRate: 0.06, registrationBaseFee: 100, weatherRiskIndex: 1.25, industryDemand: demand({ industrial_resources: 1.15 }), sourceTier: "anchor" },
  NH: { code: "NH", name: "New Hampshire", censusRegion: "Northeast", costIndex: 1.03, wageIndex: 1, fuelIndex: 0.98, dieselIndex: 1.05, insuranceIndex: 0.72, vehicleTaxRate: 0, registrationBaseFee: 90, weatherRiskIndex: 1.2, industryDemand: demand({ industrial_resources: 1.1 }), sourceTier: "anchor" },
  ME: { code: "ME", name: "Maine", censusRegion: "Northeast", costIndex: 0.98, wageIndex: 0.95, fuelIndex: 1, dieselIndex: 1.07, insuranceIndex: 0.75, vehicleTaxRate: 0.055, registrationBaseFee: 90, weatherRiskIndex: 1.25, industryDemand: demand({ industrial_resources: 1.2, cold_chain: 1.05 }), sourceTier: "anchor" },
  // ── DC (BEA/BLS treat it alongside states) ───────────────────────────────────────────────
  DC: { code: "DC", name: "Washington D.C.", censusRegion: "Northeast", costIndex: 1.11, wageIndex: 1.1, fuelIndex: 1.05, dieselIndex: 1.12, insuranceIndex: 1.35, vehicleTaxRate: 0.06, registrationBaseFee: 155, weatherRiskIndex: 1, industryDemand: demand({ specialized_logistics: 1.15, medical_logistics: 1.15, local_last_mile: 1.1 }), sourceTier: "anchor" }
};
var STATE_ECONOMY_CODES = Object.keys(STATE_ECONOMY_2026);
var ECONOMY_BALANCE = {
  MIN_COMBINED_MULT: 0.55,
  MAX_COMBINED_MULT: 1.85
};

// src/systems/regionalEconomyEngine.js
var NEUTRAL_PROFILE = {
  code: null,
  name: "Unknown",
  censusRegion: null,
  costIndex: 1,
  wageIndex: 1,
  fuelIndex: 1,
  dieselIndex: 1,
  insuranceIndex: 1,
  vehicleTaxRate: 0,
  registrationBaseFee: 100,
  weatherRiskIndex: 1,
  industryDemand: {},
  sourceTier: "neutral"
};
function getStateEconomicProfile(stateCode) {
  return STATE_ECONOMY_2026[stateCode] || NEUTRAL_PROFILE;
}
function clampBalance(mult) {
  return Math.min(ECONOMY_BALANCE.MAX_COMBINED_MULT, Math.max(ECONOMY_BALANCE.MIN_COMBINED_MULT, mult));
}
function getRegionalCostIndex(stateCode) {
  return getStateEconomicProfile(stateCode).costIndex;
}
function getRegionalWageIndex(stateCode) {
  return getStateEconomicProfile(stateCode).wageIndex;
}
function getRegionalFuelIndex(stateCode, fuelType = "Gas") {
  const profile = getStateEconomicProfile(stateCode);
  if (fuelType === "Charge") return 1 + (profile.fuelIndex - 1) * 0.35;
  if (fuelType === "Diesel") return profile.dieselIndex;
  return profile.fuelIndex;
}
function getRegionalVehicleTaxMultiplier(stateCode) {
  return 1 + getStateEconomicProfile(stateCode).vehicleTaxRate;
}
function getRegionalIndustryDemand(stateCode, divisionId) {
  const profile = getStateEconomicProfile(stateCode);
  if (!divisionId) return 1;
  return profile.industryDemand?.[divisionId] ?? 1;
}
function computeRegionalEconMult({ stateCode, divisionId = null, cycleMult = 1 } = {}) {
  const costFactor = getRegionalCostIndex(stateCode);
  const demandFactor = getRegionalIndustryDemand(stateCode, divisionId);
  const raw = costFactor * demandFactor * (Number.isFinite(cycleMult) ? cycleMult : 1);
  return clampBalance(raw);
}
function computeRegionalPurchaseMultiplier(stateCode, { includeVehicleTax = false } = {}) {
  const cost = getRegionalCostIndex(stateCode);
  const taxMult = includeVehicleTax ? getRegionalVehicleTaxMultiplier(stateCode) : 1;
  return clampBalance(cost * taxMult);
}
function getStateEconomySnapshot(stateCode, { divisionId = null, fuelType = "Gas" } = {}) {
  const profile = getStateEconomicProfile(stateCode);
  return {
    code: profile.code,
    name: profile.name,
    costIndex: profile.costIndex,
    wageIndex: profile.wageIndex,
    fuelIndex: getRegionalFuelIndex(stateCode, fuelType),
    insuranceIndex: profile.insuranceIndex,
    vehicleTaxMultiplier: getRegionalVehicleTaxMultiplier(stateCode),
    registrationFee: profile.registrationBaseFee,
    weatherRisk: profile.weatherRiskIndex,
    econMult: computeRegionalEconMult({ stateCode, divisionId }),
    purchaseMultiplier: computeRegionalPurchaseMultiplier(stateCode, { includeVehicleTax: true }),
    sourceTier: profile.sourceTier
  };
}

// src/systems/constructionRegionalEconomy.js
var CONSTRUCTION_DIVISION_ID = "construction_heavy_haul";
function getConstructionStateCode(game) {
  return game?.homeStateCode || game?.homeState || "OR";
}
function getConstructionRegionalSnapshot(game) {
  const stateCode = getConstructionStateCode(game);
  const cycleMult = game?.economy?.demandIndex || 1;
  const macroWage = game?.economy?.wagePressureIndex || 1;
  const macroMaterials = game?.economy?.inventoryPriceIndex || 1;
  const macroInterest = game?.economy?.interestRate || 0.065;
  const state = getStateEconomySnapshot(stateCode, { divisionId: CONSTRUCTION_DIVISION_ID });
  return {
    stateCode,
    stateName: state.name,
    contractValueMult: computeRegionalEconMult({
      stateCode,
      divisionId: CONSTRUCTION_DIVISION_ID,
      cycleMult
    }),
    materialPriceMult: clamp3(getRegionalCostIndex(stateCode) * macroMaterials, 0.65, 1.65),
    wageMult: clamp3(getRegionalWageIndex(stateCode) * macroWage, 0.75, 1.55),
    lendingEconomyMult: clamp3(cycleMult * (1 - Math.max(-0.04, Math.min(0.08, macroInterest - 0.065))), 0.7, 1.4),
    costIndex: state.costIndex,
    wageIndex: state.wageIndex,
    weatherRisk: state.weatherRisk,
    sourceTier: state.sourceTier
  };
}
function applyRegionalContractValue(baseValue, game) {
  return Math.max(1, Math.round((baseValue || 0) * getConstructionRegionalSnapshot(game).contractValueMult));
}
function applyRegionalMaterialPrice(basePrice, game) {
  return Math.max(1, Math.round((basePrice || 0) * getConstructionRegionalSnapshot(game).materialPriceMult));
}
function applyRegionalWage(baseWage, game) {
  return Math.max(1, Math.round((baseWage || 0) * getConstructionRegionalSnapshot(game).wageMult));
}
function clamp3(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// src/systems/equipmentWear.js
var WEAR_PROFILES = {
  light: { dailyWear: 0.4, breakdownBase: 3e-3, maintenanceInterval: 20 },
  moderate: { dailyWear: 0.9, breakdownBase: 7e-3, maintenanceInterval: 14 },
  heavy: { dailyWear: 1.6, breakdownBase: 0.014, maintenanceInterval: 10 },
  extreme: { dailyWear: 2.8, breakdownBase: 0.025, maintenanceInterval: 7 }
};
var BREAKDOWN_TYPES = [
  { id: "tire", label: "Tire Blowout", costMult: 0.6, downtime: 60, conditionLoss: 8 },
  { id: "engine", label: "Engine Failure", costMult: 2, downtime: 300, conditionLoss: 22 },
  { id: "brake", label: "Brake Failure", costMult: 1.2, downtime: 120, conditionLoss: 12 },
  { id: "electrical", label: "Electrical Fault", costMult: 0.9, downtime: 90, conditionLoss: 10 },
  { id: "fluid", label: "Fluid Leak", costMult: 0.7, downtime: 75, conditionLoss: 6 },
  { id: "body", label: "Body Damage", costMult: 0.5, downtime: 45, conditionLoss: 5 }
];
var numericOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
function maintenanceBasis(vehicle) {
  if (Number.isFinite(vehicle?.maintenance)) return Math.max(1, vehicle.maintenance);
  if (Number.isFinite(vehicle?.dailyCost)) return Math.max(1, Math.round(vehicle.dailyCost * 0.35));
  return 50;
}
function initEquipmentProfile(vehicle) {
  if (vehicle.wearProfile !== void 0) return vehicle;
  return {
    ...vehicle,
    wearProfile: "moderate",
    durability: numericOr(vehicle.condition, 100),
    totalRepairCost: 0,
    breakdownCount: 0,
    lastMaintenanceDay: 0,
    maintenanceScheduledDay: null,
    maintenanceDue: false,
    replacementNeeded: false,
    lifetimeWear: 0,
    maintenanceHistory: []
  };
}
function getBreakdownProbability(vehicle, activeRouteSec) {
  const condition = numericOr(vehicle.condition, 100);
  const profile = WEAR_PROFILES[vehicle.wearProfile || "moderate"] || WEAR_PROFILES.moderate;
  const baseProbability = profile.breakdownBase;
  const conditionFactor = condition < 40 ? (40 - condition) * 2e-3 : 0;
  const overuseBoost = activeRouteSec > 3600 ? 4e-3 : 0;
  const maintenanceBoost = vehicle.maintenanceDue ? 5e-3 : 0;
  return clamp(baseProbability + conditionFactor + overuseBoost + maintenanceBoost, 0, 0.15);
}
function triggerBreakdown(game, vehicleId) {
  const allEquip = Array.isArray(game.vehicles) ? game.vehicles : game.equipment || [];
  const v = allEquip.find((x) => x.id === vehicleId);
  if (!v || v.status === "In Repair") return;
  const breakdown = BREAKDOWN_TYPES[Math.floor(Math.random() * BREAKDOWN_TYPES.length)];
  const baseCost = Math.round(maintenanceBasis(v) * 8 * breakdown.costMult);
  const hasMechanic = (game.supportStaff || []).some((s) => s.role === "Mechanic");
  const repairCost = hasMechanic ? Math.round(baseCost * 0.7) : baseCost;
  const repairMins = Math.round(breakdown.downtime * (hasMechanic ? 0.65 : 1));
  v.condition = clamp(numericOr(v.condition, 100) - breakdown.conditionLoss, 0, 100);
  v.durability = clamp(numericOr(v.durability, 100) - breakdown.conditionLoss, 0, 100);
  v.breakdowns = (v.breakdowns || 0) + 1;
  v.breakdownCount = (v.breakdownCount || 0) + 1;
  if ((game.cash || 0) >= repairCost) {
    game.cash -= repairCost;
    if (Number.isFinite(game.expenses)) game.expenses += repairCost;
    if (game.weeklyStats) {
      game.weeklyStats.repairs = (game.weeklyStats.repairs || 0) + repairCost;
      game.weeklyStats.expenses = (game.weeklyStats.expenses || 0) + repairCost;
    }
    v.totalRepairCost = (v.totalRepairCost || 0) + repairCost;
    v.status = "In Repair";
    v.repairMinsLeft = repairMins;
    recordTransaction(game, "maintenance", -repairCost, `${v.name}: ${breakdown.label} repair`);
    addLog(game, `${v.name}: ${breakdown.label} \u2014 ${money(repairCost)} repair, ${Math.round(repairMins / 60)}h downtime.`);
  } else {
    v.status = "Broken";
    addLog(game, `${v.name}: ${breakdown.label} \u2014 can't afford repairs right now.`);
  }
  if (!Array.isArray(v.maintenanceHistory)) v.maintenanceHistory = [];
  v.maintenanceHistory.push({ day: game.day || 0, type: breakdown.id, cost: repairCost, label: breakdown.label });
  if (v.maintenanceHistory.length > 20) v.maintenanceHistory.shift();
}
function scheduleMaintenance(game, vehicleId) {
  const allEquip = Array.isArray(game.vehicles) ? game.vehicles : game.equipment || [];
  const v = allEquip.find((x) => x.id === vehicleId);
  if (!v || v.maintenanceScheduledDay || v.status === "Active" || v.status === "En Route") return false;
  const maintenanceCost = Math.round(maintenanceBasis(v) * 3.5);
  if ((game.cash || 0) < maintenanceCost) return false;
  game.cash -= maintenanceCost;
  if (Number.isFinite(game.expenses)) game.expenses += maintenanceCost;
  v.lastMaintenanceDay = game.day || 1;
  v.maintenanceScheduledDay = (game.day || 1) + 1;
  v.maintenanceDue = false;
  v.condition = clamp(numericOr(v.condition, 100) + 12, 0, 100);
  v.durability = clamp(numericOr(v.durability, 100) + 8, 0, 100);
  v.totalRepairCost = (v.totalRepairCost || 0) + maintenanceCost;
  if (!Array.isArray(v.maintenanceHistory)) v.maintenanceHistory = [];
  v.maintenanceHistory.push({ day: game.day || 0, type: "preventive", cost: maintenanceCost, label: "Scheduled Maintenance" });
  if (v.maintenanceHistory.length > 20) v.maintenanceHistory.shift();
  if (game.weeklyStats) {
    game.weeklyStats.repairs = (game.weeklyStats.repairs || 0) + maintenanceCost;
    game.weeklyStats.expenses = (game.weeklyStats.expenses || 0) + maintenanceCost;
  }
  recordTransaction(game, "maintenance", -maintenanceCost, `${v.name}: scheduled maintenance`);
  addLog(game, `${v.name} scheduled maintenance complete \u2014 condition restored.`);
  return true;
}
function tickEquipmentWear(game) {
  const vehicles = Array.isArray(game.vehicles) ? game.vehicles : Array.isArray(game.equipment) ? game.equipment : [];
  vehicles.forEach((v) => {
    if (v.wearProfile === void 0) {
      Object.assign(v, initEquipmentProfile(v));
    }
    const profile = WEAR_PROFILES[v.wearProfile || "moderate"] || WEAR_PROFILES.moderate;
    const interval = profile.maintenanceInterval;
    const daysSinceMaintenance = (game.day || 0) - (v.lastMaintenanceDay || 0);
    if (daysSinceMaintenance >= interval && !v.maintenanceDue) {
      v.maintenanceDue = true;
    }
    const isWorking = v.status === "En Route" || v.status === "Active";
    if (isWorking) {
      const dailyWear = profile.dailyWear * (v.maintenanceDue ? 1.35 : 1);
      v.condition = clamp(numericOr(v.condition, 100) - dailyWear, 0, 100);
      v.durability = clamp(numericOr(v.durability, 100) - dailyWear * 0.7, 0, 100);
      v.lifetimeWear = (v.lifetimeWear || 0) + dailyWear;
      const breakdownChance = getBreakdownProbability(v, 1800);
      if (Math.random() < breakdownChance) {
        triggerBreakdown(game, v.id);
      }
    }
    if (numericOr(v.condition, 100) < 15 && !v.replacementNeeded) {
      v.replacementNeeded = true;
      addLog(game, `${v.name} is critically degraded \u2014 replacement recommended.`);
    }
    if (v.maintenanceScheduledDay && (game.day || 0) >= v.maintenanceScheduledDay) {
      v.maintenanceScheduledDay = null;
    }
  });
}

// src/systems/projectEconomics.js
var PROJECT_COST_CATEGORIES = {
  materials: { label: "Materials", icon: "cube" },
  labor: { label: "Crew wages", icon: "people" },
  equipment: { label: "Equipment", icon: "construct" },
  incidents: { label: "Problems on site", icon: "warning" }
};
function createProjectCostLedger() {
  return { materials: 0, labor: 0, equipment: 0, incidents: 0, crewDays: 0, equipmentDays: 0 };
}
function ensureProjectCostLedger(site) {
  if (!site || typeof site !== "object") return createProjectCostLedger();
  if (!site.costs || typeof site.costs !== "object" || Array.isArray(site.costs)) {
    site.costs = createProjectCostLedger();
    site.costsPartial = true;
  } else {
    const base = createProjectCostLedger();
    for (const key of Object.keys(base)) {
      const value = Number(site.costs[key]);
      site.costs[key] = Number.isFinite(value) && value > 0 ? value : 0;
    }
  }
  return site.costs;
}
function accrueProjectCost(site, category, amount) {
  const value = Number(amount);
  if (!site || !Number.isFinite(value) || value <= 0) return;
  if (!Object.prototype.hasOwnProperty.call(PROJECT_COST_CATEGORIES, category)) return;
  const costs = ensureProjectCostLedger(site);
  costs[category] = (costs[category] || 0) + value;
}
function accrueProjectCrewDay(site, crewCount, equipmentCount) {
  if (!site) return;
  const costs = ensureProjectCostLedger(site);
  const crew = Number(crewCount);
  const equip = Number(equipmentCount);
  if (Number.isFinite(crew) && crew > 0) costs.crewDays = (costs.crewDays || 0) + crew;
  if (Number.isFinite(equip) && equip > 0) costs.equipmentDays = (costs.equipmentDays || 0) + equip;
}
function buildProjectEconomics({
  contractValue = 0,
  depositPaid = 0,
  penalty = 0,
  qualityBonus = 0,
  costs = null
} = {}) {
  const value = Math.max(0, Math.round(Number(contractValue) || 0));
  const deposit = Math.max(0, Math.round(Number(depositPaid) || 0));
  const latePenalty = Math.max(0, Math.round(Number(penalty) || 0));
  const bonus = Math.max(0, Math.round(Number(qualityBonus) || 0));
  const ledger = costs && typeof costs === "object" ? costs : createProjectCostLedger();
  const materials = Math.max(0, Math.round(Number(ledger.materials) || 0));
  const labor = Math.max(0, Math.round(Number(ledger.labor) || 0));
  const equipment = Math.max(0, Math.round(Number(ledger.equipment) || 0));
  const incidents = Math.max(0, Math.round(Number(ledger.incidents) || 0));
  const directCosts = materials + labor + equipment + incidents;
  const grossRevenue = Math.max(0, value + bonus - latePenalty);
  const finalPayment = Math.max(0, grossRevenue - deposit);
  const netProfit = grossRevenue - directCosts;
  return {
    contractValue: value,
    depositPaid: deposit,
    penalty: latePenalty,
    qualityBonus: bonus,
    materials,
    labor,
    equipment,
    incidents,
    directCosts,
    grossRevenue,
    finalPayment,
    netProfit,
    // Only reported when there is revenue to divide by — a forfeited project must not
    // produce NaN or Infinity in player-facing copy.
    marginPercent: grossRevenue > 0 ? Math.round(netProfit / grossRevenue * 100) : 0,
    crewDays: Math.max(0, Math.round(Number(ledger.crewDays) || 0)),
    equipmentDays: Math.max(0, Math.round(Number(ledger.equipmentDays) || 0))
  };
}
var OVERHEAD_NOTE = "Office rent, insurance and loan payments are company overhead \u2014 they're paid daily whether or not this job runs, so they're not charged against it.";
function getProjectReinvestmentHint(netProfit) {
  const net = Math.round(Number(netProfit) || 0);
  if (net <= 0) {
    return "This one didn't clear its costs. Bid closer to the estimate, buy materials before prices move, and don't leave crew on a stalled site.";
  }
  if (net < 5e3) {
    return "Reinvest it: keep materials stocked and take the next bid. A few jobs like this covers your first extra labourer.";
  }
  if (net < 2e4) {
    return "Reinvest it: another crew member in Crew lets you run a second site at once \u2014 that's the fastest way to double this number.";
  }
  if (net < 75e3) {
    return "Reinvest it: a bigger machine in Vehicles unlocks higher-tier contracts that pay far more per crew-day.";
  }
  return "Reinvest it: a second city office in Empire opens larger contracts, or clear debt in Finance to cut your daily burn.";
}
function buildProjectProfitLines(economics, formatMoney) {
  const fmt = typeof formatMoney === "function" ? formatMoney : (n) => `$${Math.round(n).toLocaleString()}`;
  const lines = [{ label: "Contract value", value: fmt(economics.contractValue), tone: "neutral" }];
  if (economics.qualityBonus > 0) {
    lines.push({ label: "Quality bonus", value: `+${fmt(economics.qualityBonus)}`, tone: "positive" });
  }
  if (economics.penalty > 0) {
    lines.push({ label: "Late penalty", value: `\u2212${fmt(economics.penalty)}`, tone: "negative" });
  }
  if (economics.materials > 0) {
    lines.push({ label: "Materials", value: `\u2212${fmt(economics.materials)}`, tone: "negative" });
  }
  if (economics.labor > 0) {
    lines.push({
      label: economics.crewDays > 0 ? `Crew wages (${economics.crewDays} crew-days)` : "Crew wages",
      value: `\u2212${fmt(economics.labor)}`,
      tone: "negative"
    });
  }
  if (economics.equipment > 0) {
    lines.push({
      label: economics.equipmentDays > 0 ? `Equipment (${economics.equipmentDays} machine-days)` : "Equipment",
      value: `\u2212${fmt(economics.equipment)}`,
      tone: "negative"
    });
  }
  if (economics.incidents > 0) {
    lines.push({ label: "Problems on site", value: `\u2212${fmt(economics.incidents)}`, tone: "negative" });
  }
  return lines;
}

// src/games/constructionflow/.ConstructionFlowSnackEntry.js
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var STORAGE_KEY = "constructionflow_v1_save";
var TABS = ["Home", "Bids", "Sites", "Crew", "Vehicles", "Finance", "Empire"];
var THEMES = {
  dark: {
    bg: "#071224",
    panel: "#0d1b33",
    panel2: "#12213d",
    panel3: "#182949",
    border: "#233455",
    strongBorder: "#31507d",
    text: "#f8fafc",
    sub: "#94a3b8",
    green: "#22c55e",
    red: "#ef4444",
    blue: "#3b82f6",
    orange: "#f59e0b",
    purple: "#8b5cf6",
    cyan: "#06b6d4",
    yellow: "#eab308",
    tabBar: "#0a1730",
    track: "#091321",
    shadow: "#000000"
  },
  light: {
    bg: "#edf3fb",
    panel: "#ffffff",
    panel2: "#f6f9fd",
    panel3: "#edf4fb",
    border: "#c9d7ea",
    strongBorder: "#aac0de",
    text: "#11213a",
    sub: "#5e7392",
    green: "#16a34a",
    red: "#dc2626",
    blue: "#2563eb",
    orange: "#d97706",
    purple: "#7c3aed",
    cyan: "#0891b2",
    yellow: "#ca8a04",
    tabBar: "#ffffff",
    track: "#d8e4f1",
    shadow: "#9bb0ca"
  }
};
var rand2 = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
var pick2 = (arr) => arr[Math.floor(Math.random() * arr.length)];
var uid2 = () => Math.random().toString(36).slice(2, 10);
function clone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    const copy2 = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) copy2[i] = clone(obj[i]);
    return copy2;
  }
  const copy = {};
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    copy[key] = clone(obj[key]);
  }
  return copy;
}
function money2(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}
var FIRST_NAMES = [
  "Jake",
  "Maya",
  "Luis",
  "Tara",
  "Nate",
  "Olivia",
  "Miles",
  "Sofia",
  "Eli",
  "Rosa",
  "Leah",
  "Noah",
  "Ava",
  "Zane",
  "Ivy",
  "Luca",
  "Milo",
  "Emma",
  "Cam",
  "Dana",
  "Finn",
  "Gabi",
  "Hugo",
  "Iris",
  "Joel",
  "Kara",
  "Leon",
  "Mia",
  "Omar",
  "Petra",
  "Quinn",
  "Reed",
  "Sara",
  "Theo",
  "Uma",
  "Vera",
  "Wade",
  "Xara",
  "Yuri",
  "Zoe",
  "Aiden",
  "Blake",
  "Casey",
  "Drew",
  "Eden",
  "Felix",
  "Grace",
  "Hana",
  "Ivan",
  "Juno"
];
var LAST_NAMES = [
  "Chen",
  "Rivera",
  "Patel",
  "Kim",
  "Singh",
  "Okafor",
  "Novak",
  "Hassan",
  "Brennan",
  "Walsh",
  "Murray",
  "Osei",
  "Reyes",
  "Tanaka",
  "Morin",
  "Bakr",
  "Flynn",
  "Owens",
  "Tran",
  "Diaz",
  "Scott",
  "Ahmed",
  "Burke",
  "Costa",
  "Dean",
  "Ellis",
  "Ford",
  "Grant",
  "Hall",
  "James"
];
var CLIENTS = [
  "Meridian Properties",
  "Atlas Development",
  "Cornerstone Group",
  "Summit Build Co.",
  "Nova Infrastructure",
  "Ironclad Ventures",
  "Pacific Construct",
  "BlueSky Builders",
  "Landmark Projects",
  "CrossRoads Corp",
  "Apex Structures",
  "Keystone Capital"
];
var CREW_TRAITS = [
  { label: "Reliable", speed: 1.03, safety: 1.05, quality: 1.02, wagePressure: 1, desc: "Shows up every day, no drama" },
  { label: "Skilled", speed: 1.05, safety: 1.02, quality: 1.12, wagePressure: 1.08, desc: "Top-quality finish work" },
  { label: "Fast", speed: 1.14, safety: 0.96, quality: 0.97, wagePressure: 1.04, desc: "Moves quick, cuts a few corners" },
  { label: "Careful", speed: 0.93, safety: 1.12, quality: 1.08, wagePressure: 1, desc: "Meticulous \u2014 fewer reworks" },
  { label: "Cheap", speed: 0.96, safety: 0.94, quality: 0.93, wagePressure: 0.88, desc: "Low cost, lower patience" },
  { label: "Veteran", speed: 1.08, safety: 1.08, quality: 1.1, wagePressure: 1.15, desc: "Seen it all, fixes problems fast" },
  { label: "Ambitious", speed: 1.06, safety: 0.98, quality: 1, wagePressure: 1.18, desc: "Wants foreman or more money" },
  { label: "Hard Worker", speed: 1.1, safety: 1, quality: 1.05, wagePressure: 1.05, desc: "Puts in extra effort, consistent output" },
  { label: "Lazy", speed: 0.82, safety: 0.92, quality: 0.88, wagePressure: 0.9, desc: "Does the minimum, needs supervision" },
  { label: "Safety Focused", speed: 0.9, safety: 1.2, quality: 1.03, wagePressure: 1.02, desc: "Zero incidents, slows down to stay safe" },
  { label: "Team Leader", speed: 1.04, safety: 1.06, quality: 1.08, wagePressure: 1.15, desc: "Lifts performance of nearby crew" },
  { label: "Equipment Expert", speed: 1.12, safety: 1.04, quality: 1.02, wagePressure: 1.1, desc: "Handles machines like a pro" },
  { label: "High Maintenance", speed: 1.07, safety: 0.95, quality: 1.04, wagePressure: 1.22, desc: "Talented but demanding \u2014 wage pressure high" },
  { label: "Frequent No-Show", speed: 1.05, safety: 0.9, quality: 0.96, wagePressure: 0.85, desc: "Great when there, but unreliable" }
];
var PHASE_TYPE_BONUS = {
  "Site Prep": { Earthwork: 1.22 },
  "Excavation": { Earthwork: 1.28, Foundation: 1.1 },
  "Earthwork": { Earthwork: 1.28 },
  "Foundation": { Foundation: 1.25, Earthwork: 1.1, Concrete: 1.15 },
  "Piling": { Foundation: 1.28, Lifting: 1.1 },
  "Framing": { Lifting: 1.15 },
  "Structure": { Lifting: 1.22 },
  "Structural": { Lifting: 1.18, Foundation: 1.08 },
  "Structural Steel": { Lifting: 1.3, Foundation: 1.1 },
  "Core": { Lifting: 1.2, Concrete: 1.12 },
  "Roof Structure": { Lifting: 1.18 },
  "MEP": { Concrete: 1.1 },
  "MEP Rough": { Concrete: 1.08 },
  "Deck": { Lifting: 1.15 },
  "Survey": { Earthwork: 1.08 },
  "Material Delivery": { Earthwork: 1.05 },
  "Post Installation": { Foundation: 1.15, Earthwork: 1.1 },
  "Fence Assembly": { Lifting: 1.1 },
  "Base Layer": { Earthwork: 1.22, Concrete: 1.15 },
  "Paving": { Concrete: 1.2, Earthwork: 1.12 },
  "Striping": { Concrete: 1.05 },
  "Finish Work": { Concrete: 1.08 },
  "Barriers": { Lifting: 1.12, Foundation: 1.08 },
  "Surfacing": { Concrete: 1.18, Earthwork: 1.12 }
};
var CREW_SPECIALTIES = ["General", "Earthwork", "Concrete", "Framing", "Roofing", "Utility", "Finish Work"];
var SPECIALTY_PHASE_BONUS = {
  "Earthwork": { "Survey": 1.1, "Site Prep": 1.15, "Excavation": 1.25, "Earthwork": 1.28, "Base Layer": 1.18, "Barriers": 1.1 },
  "Concrete": { "Foundation": 1.22, "Concrete": 1.25, "Base Layer": 1.15, "Deck": 1.12, "Paving": 1.18, "Surfacing": 1.15 },
  "Framing": { "Framing": 1.22, "Structure": 1.18, "Structural": 1.18, "Post Installation": 1.2, "Fence Assembly": 1.18, "Structural Steel": 1.15 },
  "Roofing": { "Roofing": 1.25, "Roof Structure": 1.22, "Envelope": 1.15, "Facade": 1.12, "Finish Work": 1.1 },
  "Utility": { "MEP": 1.22, "MEP Rough": 1.2, "Piling": 1.18, "Utilities": 1.2, "Material Delivery": 1.12 },
  "Finish Work": { "Finishes": 1.2, "Interior": 1.18, "Fitout": 1.18, "Commissioning": 1.12, "Final Inspection": 1.1, "Inspection": 1.08, "Finish Work": 1.22 }
};
var INSPECTION_PHASES = /* @__PURE__ */ new Set(["Inspection", "Final Inspection", "Commissioning"]);
var EQUIPMENT_SHOP = [
  { shopId: "pickup", name: "Basic Pickup Truck", type: "Earthwork", tier: 1, price: 6500, dailyCost: 110, fuelCap: 60, reliability: 88, capacity: "Light", role: "Materials transport, light site work" },
  { shopId: "skidsteer", name: "Skid Steer", type: "Earthwork", tier: 1, price: 18e3, dailyCost: 240, fuelCap: 80, reliability: 84, capacity: "Light", role: "Grading, loading, tight-space work" },
  { shopId: "miniex", name: "Mini Excavator", type: "Earthwork", tier: 1, price: 24e3, dailyCost: 300, fuelCap: 90, reliability: 86, capacity: "Light", role: "Trenching, small foundations" },
  { shopId: "compactor", name: "Plate Compactor", type: "Earthwork", tier: 1, price: 9e3, dailyCost: 130, fuelCap: 40, reliability: 86, capacity: "Light", role: "Soil compaction, road prep, foundation work" },
  { shopId: "generator", name: "Portable Generator", type: "Utility", tier: 1, price: 5500, dailyCost: 85, fuelCap: 30, reliability: 90, capacity: "Light", role: "On-site power, tools, lighting & machinery" },
  { shopId: "backhoe", name: "Backhoe Loader", type: "Earthwork", tier: 2, price: 55e3, dailyCost: 500, fuelCap: 120, reliability: 88, capacity: "Medium", role: "Excavation, backfill, drainage" },
  { shopId: "bulldozer", name: "Bulldozer", type: "Earthwork", tier: 2, price: 78e3, dailyCost: 680, fuelCap: 150, reliability: 85, capacity: "Medium", role: "Site clearing, rough grading" },
  { shopId: "dumptruck", name: "Dump Truck", type: "Earthwork", tier: 2, price: 46e3, dailyCost: 420, fuelCap: 160, reliability: 87, capacity: "Medium", role: "Bulk material transport, waste removal" },
  { shopId: "grader", name: "Motor Grader", type: "Earthwork", tier: 2, price: 68e3, dailyCost: 610, fuelCap: 140, reliability: 86, capacity: "Medium", role: "Road leveling, site grading, precision earthwork" },
  { shopId: "mobcrane", name: "Mobile Crane", type: "Lifting", tier: 3, price: 135e3, dailyCost: 1300, fuelCap: 200, reliability: 82, capacity: "Heavy", role: "Structural steel, precast lifts" },
  { shopId: "concpump", name: "Concrete Pump", type: "Concrete", tier: 3, price: 92e3, dailyCost: 900, fuelCap: 180, reliability: 87, capacity: "Heavy", role: "High-reach pours, slabs, columns" },
  { shopId: "telehandler", name: "Telehandler", type: "Lifting", tier: 3, price: 82e3, dailyCost: 760, fuelCap: 110, reliability: 88, capacity: "Heavy", role: "Reach lifting, multi-level material placement" },
  { shopId: "pavermachine", name: "Asphalt Paver", type: "Earthwork", tier: 3, price: 112e3, dailyCost: 1050, fuelCap: 170, reliability: 85, capacity: "Heavy", role: "Road paving, asphalt laying, surface finishing" },
  { shopId: "towercrane", name: "Tower Crane", type: "Lifting", tier: 4, price: 29e4, dailyCost: 2800, fuelCap: 0, reliability: 91, capacity: "Max", role: "High-rise construction only" },
  { shopId: "piledriver", name: "Pile Driver", type: "Foundation", tier: 4, price: 21e4, dailyCost: 2100, fuelCap: 220, reliability: 89, capacity: "Max", role: "Deep foundations, marine work" },
  { shopId: "drillingrig", name: "Drilling Rig", type: "Foundation", tier: 4, price: 185e3, dailyCost: 1750, fuelCap: 250, reliability: 88, capacity: "Max", role: "Deep pile drilling, ground anchoring, shaft boring" },
  // ── Tier 1 additions ────────────────────────────────────────────────────────
  { shopId: "cargovan", name: "Cargo Van", type: "Utility", tier: 1, price: 12e3, dailyCost: 150, fuelCap: 55, reliability: 90, capacity: "Light", role: "Tool & crew transport, small material runs" },
  { shopId: "trackloader", name: "Mini Track Loader", type: "Earthwork", tier: 1, price: 21e3, dailyCost: 270, fuelCap: 70, reliability: 85, capacity: "Light", role: "Tight-access loading, landscaping" },
  { shopId: "utilitytruck", name: "Utility Truck", type: "Utility", tier: 1, price: 15e3, dailyCost: 190, fuelCap: 60, reliability: 87, capacity: "Light", role: "Electrical & plumbing crew transport, ladder rack" },
  { shopId: "stakebed", name: "Stake Bed Truck", type: "Earthwork", tier: 1, price: 17e3, dailyCost: 200, fuelCap: 70, reliability: 86, capacity: "Light", role: "Material & lumber hauling" },
  { shopId: "towtruck", name: "Tow Truck", type: "Utility", tier: 1, price: 26e3, dailyCost: 260, fuelCap: 70, reliability: 87, capacity: "Light", role: "Equipment recovery, breakdown response" },
  { shopId: "sweeper", name: "Street Sweeper", type: "Utility", tier: 1, price: 32e3, dailyCost: 310, fuelCap: 80, reliability: 86, capacity: "Light", role: "Site cleanup, dust & debris compliance" },
  { shopId: "padfootroller", name: "Padfoot Roller", type: "Earthwork", tier: 1, price: 42e3, dailyCost: 380, fuelCap: 90, reliability: 85, capacity: "Light", role: "Clay & cohesive soil compaction" },
  { shopId: "trenchroller", name: "Trench Roller", type: "Earthwork", tier: 1, price: 16e3, dailyCost: 180, fuelCap: 30, reliability: 88, capacity: "Light", role: "Remote-controlled trench backfill compaction" },
  { shopId: "dustcannon", name: "Dust Suppression Cannon", type: "Utility", tier: 1, price: 11e3, dailyCost: 120, fuelCap: 20, reliability: 90, capacity: "Light", role: "Dust control on demolition & earthwork sites" },
  { shopId: "scissorlift", name: "Scissor Lift", type: "Lifting", tier: 1, price: 19e3, dailyCost: 220, fuelCap: 0, reliability: 91, capacity: "Light", role: "Elevated interior & exterior work" },
  // ── Tier 2 additions ────────────────────────────────────────────────────────
  { shopId: "excavator", name: "Excavator", type: "Earthwork", tier: 2, price: 58e3, dailyCost: 520, fuelCap: 130, reliability: 87, capacity: "Medium", role: "Excavation, foundations, demolition" },
  { shopId: "wheelloader", name: "Wheel Loader", type: "Earthwork", tier: 2, price: 64e3, dailyCost: 570, fuelCap: 140, reliability: 86, capacity: "Medium", role: "Material loading, stockpiling, site cleanup" },
  { shopId: "forklift", name: "Rough Terrain Forklift", type: "Lifting", tier: 2, price: 51e3, dailyCost: 460, fuelCap: 100, reliability: 87, capacity: "Medium", role: "Material handling, pallet & unit loads" },
  { shopId: "mixertruck", name: "Concrete Mixer Truck", type: "Concrete", tier: 2, price: 72e3, dailyCost: 640, fuelCap: 150, reliability: 85, capacity: "Medium", role: "Ready-mix concrete delivery" },
  { shopId: "watertruck", name: "Water Truck", type: "Utility", tier: 2, price: 49e3, dailyCost: 430, fuelCap: 160, reliability: 86, capacity: "Medium", role: "Dust control, compaction support" },
  { shopId: "fueltruck", name: "Fuel Truck", type: "Utility", tier: 2, price: 53e3, dailyCost: 460, fuelCap: 170, reliability: 85, capacity: "Medium", role: "Mobile refueling for site equipment" },
  { shopId: "flatbedhauler", name: "Flatbed Hauler", type: "Utility", tier: 2, price: 61e3, dailyCost: 540, fuelCap: 150, reliability: 86, capacity: "Medium", role: "Equipment transport between sites" },
  { shopId: "boomtruck", name: "Boom Truck Crane", type: "Lifting", tier: 2, price: 74e3, dailyCost: 660, fuelCap: 130, reliability: 84, capacity: "Medium", role: "Material lifting, smaller crane jobs" },
  { shopId: "boomlift", name: "Boom Lift", type: "Lifting", tier: 2, price: 56e3, dailyCost: 490, fuelCap: 90, reliability: 86, capacity: "Medium", role: "Elevated reach work, facade access" },
  { shopId: "trencher", name: "Trencher", type: "Utility", tier: 2, price: 47e3, dailyCost: 410, fuelCap: 100, reliability: 85, capacity: "Medium", role: "Utility trenching, pipe & cable laying" },
  { shopId: "vibratoryroller", name: "Vibratory Roller", type: "Earthwork", tier: 2, price: 44e3, dailyCost: 390, fuelCap: 100, reliability: 86, capacity: "Medium", role: "Asphalt & granular compaction" },
  { shopId: "linepump", name: "Concrete Line Pump", type: "Concrete", tier: 2, price: 39e3, dailyCost: 350, fuelCap: 90, reliability: 86, capacity: "Medium", role: "Smaller pours, tight-access placement" },
  { shopId: "spreadertruck", name: "Spreader Truck", type: "Earthwork", tier: 2, price: 43e3, dailyCost: 380, fuelCap: 120, reliability: 85, capacity: "Medium", role: "Bulk material spreading \u2014 seed, mulch, aggregate" },
  // ── Tier 3 additions ────────────────────────────────────────────────────────
  { shopId: "haultruck", name: "Rigid Haul Truck", type: "Earthwork", tier: 3, price: 165e3, dailyCost: 1450, fuelCap: 260, reliability: 84, capacity: "Heavy", role: "Heavy bulk haulage, quarry & large-site work" },
  { shopId: "vactruck", name: "Vacuum Excavation Truck", type: "Utility", tier: 3, price: 128e3, dailyCost: 1150, fuelCap: 200, reliability: 83, capacity: "Heavy", role: "Utility line exposure, non-destructive digging" },
  { shopId: "coldplaner", name: "Cold Planer", type: "Earthwork", tier: 3, price: 148e3, dailyCost: 1320, fuelCap: 190, reliability: 84, capacity: "Heavy", role: "Asphalt removal, road resurfacing prep" },
  // ── Tier 4 additions ────────────────────────────────────────────────────────
  { shopId: "crawlercrane", name: "Crawler Crane", type: "Lifting", tier: 4, price: 34e4, dailyCost: 3200, fuelCap: 280, reliability: 87, capacity: "Max", role: "Heavy lifts, precast, structural steel" },
  { shopId: "screeningplant", name: "Screening Plant", type: "Earthwork", tier: 4, price: 265e3, dailyCost: 2400, fuelCap: 200, reliability: 85, capacity: "Max", role: "On-site material screening & grading" },
  { shopId: "crushingplant", name: "Crushing Plant", type: "Earthwork", tier: 4, price: 31e4, dailyCost: 2750, fuelCap: 220, reliability: 84, capacity: "Max", role: "On-site aggregate crushing & recycling" }
];
var EQUIPMENT_IMAGES = {
  pickup: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/pickup.png" },
  skidsteer: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/skidsteer.png" },
  miniex: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/miniex.png" },
  compactor: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/compactor.png" },
  generator: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/generator.png" },
  backhoe: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/backhoe.png" },
  bulldozer: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/bulldozer.png" },
  dumptruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/dumptruck.png" },
  grader: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/grader.png" },
  mobcrane: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/mobcrane.png" },
  concpump: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/concpump.png" },
  telehandler: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/telehandler.png" },
  pavermachine: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/pavermachine.png" },
  towercrane: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/towercrane.png" },
  piledriver: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/piledriver.png" },
  drillingrig: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/drillingrig.png" },
  cargovan: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/cargovan.png" },
  trackloader: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/trackloader.png" },
  utilitytruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/utilitytruck.png" },
  stakebed: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/stakebed.png" },
  towtruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/towtruck.png" },
  sweeper: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/sweeper.png" },
  padfootroller: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/padfootroller.png" },
  trenchroller: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/trenchroller.png" },
  dustcannon: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/dustcannon.png" },
  scissorlift: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/scissorlift.png" },
  excavator: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/excavator.png" },
  wheelloader: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/wheelloader.png" },
  forklift: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/forklift.png" },
  mixertruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/mixertruck.png" },
  watertruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/watertruck.png" },
  fueltruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/fueltruck.png" },
  flatbedhauler: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/flatbedhauler.png" },
  boomtruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/boomtruck.png" },
  boomlift: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/boomlift.png" },
  trencher: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/trencher.png" },
  vibratoryroller: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/vibratoryroller.png" },
  linepump: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/linepump.png" },
  spreadertruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/spreadertruck.png" },
  haultruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/haultruck.png" },
  vactruck: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/vactruck.png" },
  coldplaner: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/coldplaner.png" },
  crawlercrane: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/crawlercrane.png" },
  screeningplant: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/screeningplant.png" },
  crushingplant: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/crushingplant.png" }
};
var EQUIPMENT_UPGRADES = [
  { id: "engine", label: "Engine Overhaul", icon: "\u2699\uFE0F", tiers: [{ tier: 1, cost: 3e3, effect: "+6% speed" }, { tier: 2, cost: 9e3, effect: "+12% speed" }] },
  { id: "telematics", label: "Telematics Kit", icon: "\u{1F4E1}", tiers: [{ tier: 1, cost: 2e3, effect: "-10% breakdown risk" }, { tier: 2, cost: 6e3, effect: "-20% breakdown risk" }] },
  { id: "safety", label: "Safety Package", icon: "\u{1F9BA}", tiers: [{ tier: 1, cost: 1500, effect: "-8% incident risk" }, { tier: 2, cost: 4500, effect: "-18% incident risk" }] }
];
var CONTRACT_DEFS = [
  // ── Residential — fast cash, reputation growth ───────────────────────────────
  {
    id: "fence",
    label: "Fence Installation",
    category: "Residential",
    minTier: 1,
    crewMin: 1,
    equipMin: 1,
    baseValue: 9e3,
    durationDays: 6,
    phases: ["Survey", "Material Delivery", "Post Installation", "Fence Assembly", "Inspection"],
    materials: { lumber: 20 },
    penaltyPerDay: 60,
    creditReq: 500,
    risk: 1,
    repReward: 2,
    creditReward: 2,
    desc: "Timber fence for a suburban property. Fast cash to get started.",
    unlocksContractId: "comm_fitout"
  },
  {
    id: "deck",
    label: "Deck Build",
    category: "Residential",
    minTier: 1,
    crewMin: 2,
    equipMin: 1,
    baseValue: 19e3,
    durationDays: 6,
    phases: ["Site Prep", "Framing", "Finishes"],
    materials: { lumber: 35, electrical: 4 },
    penaltyPerDay: 80,
    creditReq: 500,
    risk: 1,
    repReward: 2,
    creditReward: 2,
    desc: "Outdoor entertaining deck. Timber frame with lighting."
  },
  {
    id: "garage",
    label: "Garage Construction",
    category: "Residential",
    minTier: 1,
    crewMin: 2,
    equipMin: 1,
    baseValue: 38e3,
    durationDays: 10,
    phases: ["Site Prep", "Foundation", "Framing", "Roofing", "Finish Work", "Inspection"],
    materials: { concrete: 12, lumber: 50 },
    penaltyPerDay: 140,
    creditReq: 500,
    risk: 1,
    repReward: 3,
    creditReward: 3,
    desc: "Double garage with slab. Bread-and-butter residential."
  },
  {
    id: "resi_reno",
    label: "Residential Renovation",
    category: "Residential",
    minTier: 1,
    crewMin: 2,
    equipMin: 1,
    baseValue: 3e4,
    durationDays: 9,
    phases: ["Demo", "Framing", "Finishing"],
    materials: { lumber: 40, electrical: 10, plumbing: 8 },
    penaltyPerDay: 130,
    creditReq: 500,
    risk: 1,
    repReward: 3,
    creditReward: 2,
    desc: "Kitchen and bathroom remodel for a private client.",
    unlocksContractId: "apt_block"
  },
  {
    id: "house",
    label: "House Build",
    category: "Residential",
    minTier: 2,
    crewMin: 5,
    equipMin: 1,
    baseValue: 22e4,
    durationDays: 25,
    phases: ["Survey", "Site Prep", "Foundation", "Framing", "Roofing", "Interior", "Final Inspection"],
    materials: { concrete: 35, lumber: 180, electrical: 50, plumbing: 40 },
    penaltyPerDay: 900,
    creditReq: 560,
    risk: 2,
    repReward: 6,
    creditReward: 5,
    desc: "Full house build from slab to handover. Good reputation builder.",
    unlocksContractId: "apt_block"
  },
  // ── Infrastructure — reputation + community standing ─────────────────────────
  {
    id: "road_patch",
    label: "Road Patch & Seal",
    category: "Infrastructure",
    minTier: 1,
    crewMin: 3,
    equipMin: 1,
    baseValue: 45e3,
    durationDays: 9,
    phases: ["Survey", "Excavation", "Base Layer", "Paving", "Inspection"],
    materials: { asphalt: 12, concrete: 8 },
    penaltyPerDay: 220,
    creditReq: 500,
    risk: 1,
    repReward: 4,
    creditReward: 4,
    desc: "Council road repair \u2014 community visibility, quick turnaround required.",
    unlocksContractId: "city_road"
  },
  // ── Commercial — profit growth, cash focus ────────────────────────────────────
  {
    id: "restaurant",
    label: "Restaurant Fitout",
    category: "Commercial",
    minTier: 2,
    crewMin: 4,
    equipMin: 1,
    baseValue: 115e3,
    durationDays: 12,
    phases: ["Demo", "MEP Rough", "Framing", "Finishes"],
    materials: { lumber: 60, electrical: 50, plumbing: 30 },
    penaltyPerDay: 1700,
    creditReq: 530,
    risk: 2,
    repReward: 4,
    creditReward: 5,
    desc: "Commercial kitchen and dining room fitout. High-margin job."
  },
  {
    id: "comm_fitout",
    label: "Commercial Fitout",
    category: "Commercial",
    minTier: 2,
    crewMin: 4,
    equipMin: 1,
    baseValue: 9e4,
    durationDays: 10,
    phases: ["Demo", "MEP Rough", "Framing", "Finishes"],
    materials: { lumber: 80, electrical: 40, plumbing: 20 },
    penaltyPerDay: 1300,
    creditReq: 530,
    risk: 2,
    repReward: 3,
    creditReward: 4,
    desc: "Retail space fit-out for a new tenant. Tight deadline."
  },
  {
    id: "office_build",
    label: "Office Building",
    category: "Commercial",
    minTier: 2,
    crewMin: 6,
    equipMin: 2,
    baseValue: 26e4,
    durationDays: 20,
    phases: ["Excavation", "Foundation", "Structural Steel", "Exterior", "Interior", "Inspection"],
    materials: { concrete: 100, steel: 18, lumber: 90, electrical: 60, plumbing: 30 },
    penaltyPerDay: 3200,
    creditReq: 570,
    risk: 3,
    repReward: 5,
    creditReward: 8,
    desc: "4-storey commercial office. Tight tolerances on structural steelwork."
  },
  {
    id: "warehouse",
    label: "Warehouse Build",
    category: "Commercial",
    minTier: 2,
    crewMin: 5,
    equipMin: 2,
    baseValue: 15e4,
    durationDays: 14,
    phases: ["Site Prep", "Foundation", "Structural", "Envelope"],
    materials: { concrete: 80, steel: 12, lumber: 60 },
    penaltyPerDay: 1900,
    creditReq: 560,
    risk: 2,
    repReward: 4,
    creditReward: 6,
    desc: "Industrial warehouse shell, 2,000sqm. Structural steel frame."
  },
  {
    id: "retail_centre",
    label: "Retail Centre",
    category: "Commercial",
    minTier: 3,
    crewMin: 10,
    equipMin: 2,
    baseValue: 72e4,
    durationDays: 45,
    phases: ["Site Prep", "Foundation", "Structural Steel", "Exterior", "Interior", "Inspection"],
    materials: { concrete: 250, steel: 55, lumber: 150, electrical: 120, plumbing: 60 },
    penaltyPerDay: 9500,
    creditReq: 620,
    risk: 3,
    repReward: 8,
    creditReward: 10,
    desc: "Multi-tenancy retail strip. Anchor tenant on fixed open date."
  },
  // ── Infrastructure — community standing, long-term expansion enabler ──────────
  {
    id: "utilities",
    label: "Utilities Installation",
    category: "Infrastructure",
    minTier: 2,
    crewMin: 4,
    equipMin: 2,
    baseValue: 17e4,
    durationDays: 16,
    phases: ["Excavation", "Piling", "Framing", "Inspection"],
    materials: { concrete: 60, steel: 8, plumbing: 80 },
    penaltyPerDay: 2200,
    creditReq: 560,
    risk: 3,
    repReward: 7,
    creditReward: 6,
    desc: "Stormwater and sewerage upgrade for a council suburb."
  },
  {
    id: "apt_block",
    label: "Apartment Block",
    category: "Commercial",
    minTier: 3,
    crewMin: 8,
    equipMin: 2,
    baseValue: 42e4,
    durationDays: 30,
    phases: ["Foundation", "Structure", "MEP", "Facade", "Fitout"],
    materials: { concrete: 300, steel: 45, lumber: 120, electrical: 80, plumbing: 60 },
    penaltyPerDay: 5500,
    creditReq: 600,
    risk: 3,
    repReward: 7,
    creditReward: 10,
    desc: "24-unit apartment block. Complex MEP and structural requirements.",
    unlocksContractId: "shopping_mall"
  },
  {
    id: "bridge",
    label: "Bridge Construction",
    category: "Infrastructure",
    minTier: 3,
    crewMin: 10,
    equipMin: 3,
    baseValue: 62e4,
    durationDays: 40,
    phases: ["Piling", "Deck", "Barriers", "Surfacing"],
    materials: { concrete: 500, steel: 120 },
    penaltyPerDay: 8500,
    creditReq: 640,
    risk: 4,
    repReward: 10,
    creditReward: 8,
    desc: "Single-span road bridge. High community visibility."
  },
  // ── Mega — company-defining, high risk/reward ─────────────────────────────────
  {
    id: "hospital_wing",
    label: "Hospital Wing Extension",
    category: "Mega",
    minTier: 4,
    crewMin: 14,
    equipMin: 3,
    baseValue: 13e5,
    durationDays: 60,
    phases: ["Foundation", "Structure", "MEP", "Finishes", "Commissioning"],
    materials: { concrete: 800, steel: 200, electrical: 300, plumbing: 200, lumber: 150 },
    penaltyPerDay: 17e3,
    creditReq: 700,
    risk: 4,
    repReward: 12,
    creditReward: 15,
    desc: "Critical healthcare infrastructure. Zero tolerance for defects."
  },
  {
    id: "highrise",
    label: "High-Rise Tower",
    category: "Mega",
    minTier: 4,
    crewMin: 20,
    equipMin: 4,
    baseValue: 32e5,
    durationDays: 120,
    phases: ["Foundation", "Core", "Structure", "Facade", "MEP", "Fitout"],
    materials: { concrete: 2e3, steel: 600, electrical: 800, plumbing: 400, lumber: 300 },
    penaltyPerDay: 43e3,
    creditReq: 750,
    risk: 5,
    repReward: 15,
    creditReward: 20,
    desc: "40-story mixed-use tower. This is what empires are made of."
  },
  {
    id: "stadium",
    label: "Sports Stadium",
    category: "Mega",
    minTier: 4,
    crewMin: 25,
    equipMin: 5,
    baseValue: 75e5,
    durationDays: 180,
    phases: ["Site Prep", "Foundation", "Structure", "Facade", "Interior", "Commissioning"],
    materials: { concrete: 4e3, steel: 1200, electrical: 1200, plumbing: 600, lumber: 400 },
    penaltyPerDay: 95e3,
    creditReq: 780,
    risk: 5,
    repReward: 20,
    creditReward: 25,
    desc: "30,000-seat stadium. Rep 80+ required. Legacy-defining contract."
  },
  {
    id: "wildbear_city",
    label: "WildBear City Plaza",
    category: "Mega",
    minTier: 4,
    crewMin: 30,
    equipMin: 6,
    baseValue: 17e6,
    durationDays: 300,
    phases: ["Site Prep", "Foundation", "Core", "Structure", "Facade", "MEP", "Interior", "Commissioning"],
    materials: { concrete: 1e4, steel: 3e3, electrical: 3e3, plumbing: 1500, lumber: 1e3 },
    penaltyPerDay: 215e3,
    creditReq: 800,
    risk: 5,
    repReward: 30,
    creditReward: 30,
    desc: "The biggest contract in the city's history. For Elite Constructors only."
  },
  {
    id: "hotel_build",
    label: "Boutique Hotel",
    category: "Commercial",
    minTier: 3,
    crewMin: 8,
    equipMin: 2,
    baseValue: 39e4,
    durationDays: 28,
    phases: ["Survey", "Site Prep", "Foundation", "Structural Steel", "Exterior", "MEP", "Fitout", "Final Inspection"],
    materials: { concrete: 200, steel: 40, lumber: 80, electrical: 80, plumbing: 50 },
    penaltyPerDay: 4800,
    creditReq: 580,
    risk: 3,
    repReward: 7,
    creditReward: 8,
    desc: "50-room boutique hotel build. Interior fitout is key to client satisfaction.",
    unlocksContractId: "airport_terminal"
  },
  {
    id: "shopping_mall",
    label: "Shopping Mall",
    category: "Commercial",
    minTier: 3,
    crewMin: 12,
    equipMin: 3,
    baseValue: 9e5,
    durationDays: 50,
    phases: ["Site Prep", "Foundation", "Structural Steel", "Exterior", "MEP Rough", "Interior", "Finishes", "Commissioning"],
    materials: { concrete: 400, steel: 80, lumber: 200, electrical: 150, plumbing: 80 },
    penaltyPerDay: 12e3,
    creditReq: 630,
    risk: 3,
    repReward: 9,
    creditReward: 10,
    desc: "30-store retail mall. Anchor tenant move-in date is non-negotiable.",
    unlocksContractId: "regional_mall"
  },
  {
    id: "airport_terminal",
    label: "Airport Terminal",
    category: "Mega",
    minTier: 4,
    crewMin: 20,
    equipMin: 4,
    baseValue: 48e5,
    durationDays: 150,
    phases: ["Survey", "Excavation", "Foundation", "Structural Steel", "Core", "Envelope", "MEP", "Interior", "Commissioning"],
    materials: { concrete: 3e3, steel: 800, electrical: 600, plumbing: 300, lumber: 400 },
    penaltyPerDay: 65e3,
    creditReq: 740,
    risk: 5,
    repReward: 14,
    creditReward: 18,
    desc: "Regional airport terminal expansion. Safety and compliance above all else.",
    unlocksContractId: "salem_airport_expansion"
  },
  {
    id: "university_building",
    label: "University Building",
    category: "Government",
    minTier: 3,
    crewMin: 10,
    equipMin: 2,
    baseValue: 8e5,
    durationDays: 48,
    phases: ["Survey", "Site Prep", "Foundation", "Structure", "MEP", "Interior", "Commissioning"],
    materials: { concrete: 350, steel: 60, lumber: 150, electrical: 120, plumbing: 80 },
    penaltyPerDay: 9500,
    creditReq: 660,
    complianceReq: 65,
    risk: 3,
    repReward: 11,
    creditReward: 16,
    desc: "Six-story university research building. Academic schedule must be honoured."
  },
  {
    id: "highway_section",
    label: "Highway Section",
    category: "Mega",
    minTier: 4,
    crewMin: 18,
    equipMin: 4,
    baseValue: 39e5,
    durationDays: 120,
    phases: ["Survey", "Excavation", "Base Layer", "Paving", "Barriers", "Striping", "Inspection"],
    materials: { asphalt: 500, concrete: 800, steel: 200 },
    penaltyPerDay: 47e3,
    creditReq: 720,
    complianceReq: 70,
    risk: 4,
    repReward: 13,
    creditReward: 16,
    desc: "12km dual-carriageway highway. Traffic management and public safety critical."
  },
  {
    id: "data_centre",
    label: "Data Centre Build",
    category: "Commercial",
    minTier: 3,
    crewMin: 10,
    equipMin: 2,
    baseValue: 68e4,
    durationDays: 40,
    phases: ["Site Prep", "Foundation", "Structure", "MEP Rough", "MEP", "Finishes", "Commissioning"],
    materials: { concrete: 200, steel: 50, electrical: 300, plumbing: 40, lumber: 60 },
    penaltyPerDay: 8500,
    creditReq: 620,
    risk: 3,
    repReward: 8,
    creditReward: 10,
    desc: "Mission-critical data centre. Power and cooling systems must be flawless."
  },
  // ── Government — credit score bonuses, community trust ────────────────────────
  {
    id: "city_road",
    label: "City Road Reconstruction",
    category: "Government",
    minTier: 2,
    crewMin: 6,
    equipMin: 2,
    baseValue: 2e5,
    durationDays: 20,
    phases: ["Survey", "Excavation", "Base Layer", "Paving", "Striping", "Inspection"],
    materials: { asphalt: 80, concrete: 30, steel: 10 },
    penaltyPerDay: 2600,
    creditReq: 580,
    complianceReq: 55,
    risk: 2,
    repReward: 6,
    creditReward: 12,
    desc: "Municipal road reconstruction. Council visibility, builds trust."
  },
  {
    id: "fire_station",
    label: "Fire Station Build",
    category: "Government",
    minTier: 3,
    crewMin: 8,
    equipMin: 2,
    baseValue: 38e4,
    durationDays: 30,
    phases: ["Foundation", "Structural", "MEP", "Finishes", "Commissioning"],
    materials: { concrete: 180, steel: 35, lumber: 90, electrical: 70, plumbing: 40 },
    penaltyPerDay: 4800,
    creditReq: 630,
    complianceReq: 60,
    risk: 3,
    repReward: 8,
    creditReward: 15,
    desc: "Emergency services facility. Safety compliance non-negotiable."
  },
  {
    id: "public_school",
    label: "Public School Build",
    category: "Government",
    minTier: 3,
    crewMin: 10,
    equipMin: 2,
    baseValue: 51e4,
    durationDays: 40,
    phases: ["Site Prep", "Foundation", "Structure", "Interior", "Commissioning"],
    materials: { concrete: 250, steel: 50, lumber: 120, electrical: 100, plumbing: 60 },
    penaltyPerDay: 6500,
    creditReq: 650,
    complianceReq: 65,
    risk: 3,
    repReward: 10,
    creditReward: 18,
    desc: "Government school. High community visibility and credit boost."
  },
  {
    id: "water_treatment",
    label: "Water Treatment Plant",
    category: "Government",
    minTier: 3,
    crewMin: 12,
    equipMin: 3,
    baseValue: 9e5,
    durationDays: 55,
    phases: ["Excavation", "Foundation", "Structure", "MEP", "Commissioning"],
    materials: { concrete: 500, steel: 120, plumbing: 200, electrical: 150 },
    penaltyPerDay: 11e3,
    creditReq: 700,
    complianceReq: 75,
    risk: 4,
    repReward: 12,
    creditReward: 20,
    desc: "Critical public infrastructure. Premium compliance required."
  },
  // ── Named Major Projects ─────────────────────────────────────────────────────
  {
    id: "regional_mall",
    label: "Regional Mall",
    category: "Commercial",
    minTier: 3,
    crewMin: 6,
    equipMin: 2,
    baseValue: 68e4,
    durationDays: 30,
    phases: ["Survey", "Site Prep", "Foundation", "Steel Frame", "Roofing", "Interior", "Final Inspection"],
    materials: { concrete: 120, steel: 50, lumber: 40 },
    penaltyPerDay: 8500,
    creditReq: 620,
    risk: 3,
    repReward: 9,
    creditReward: 10,
    minRep: 45,
    desc: "Large regional shopping complex anchoring a new commercial district.",
    unlocksContractId: "riverfront_stadium"
  },
  {
    id: "salem_airport_expansion",
    label: "Salem Airport Expansion",
    category: "Mega",
    minTier: 4,
    crewMin: 8,
    equipMin: 2,
    baseValue: 18e5,
    durationDays: 45,
    phases: ["Survey", "Site Prep", "Foundation", "Steel Frame", "Utilities", "Paving", "Commissioning"],
    materials: { concrete: 200, steel: 80, asphalt: 60 },
    penaltyPerDay: 22e3,
    creditReq: 700,
    risk: 4,
    repReward: 12,
    creditReward: 14,
    minRep: 65,
    isMajorProject: true,
    desc: "Runway extension and new terminal gates for Salem's commercial airport."
  },
  {
    id: "riverfront_stadium",
    label: "Riverfront Stadium",
    category: "Mega",
    minTier: 4,
    crewMin: 10,
    equipMin: 3,
    baseValue: 26e5,
    durationDays: 60,
    phases: ["Survey", "Excavation", "Foundation", "Steel Frame", "Seating Structure", "Interior", "Commissioning"],
    materials: { concrete: 350, steel: 150, lumber: 80 },
    penaltyPerDay: 33e3,
    creditReq: 730,
    risk: 5,
    repReward: 14,
    creditReward: 16,
    minRep: 75,
    isMajorProject: true,
    desc: "18,000-seat multipurpose stadium on the Willamette riverfront. A landmark build."
  },
  {
    id: "pacific_trade_port",
    label: "Pacific Trade Port",
    category: "Mega",
    minTier: 4,
    crewMin: 9,
    equipMin: 3,
    baseValue: 21e5,
    durationDays: 50,
    phases: ["Survey", "Dredging", "Foundation", "Dock Structure", "Warehousing", "Paving", "Commissioning"],
    materials: { concrete: 280, steel: 120, asphalt: 90 },
    penaltyPerDay: 26e3,
    creditReq: 720,
    risk: 5,
    repReward: 13,
    creditReward: 15,
    minRep: 70,
    isMajorProject: true,
    desc: "Deep-water commercial port with bulk cargo handling and warehousing."
  },
  {
    id: "cascade_medical_center",
    label: "Cascade Medical Center",
    category: "Government",
    minTier: 4,
    crewMin: 7,
    equipMin: 2,
    baseValue: 16e5,
    durationDays: 40,
    phases: ["Survey", "Site Prep", "Foundation", "Framing", "Utilities", "Interior", "Final Inspection"],
    materials: { concrete: 180, steel: 70, electrical: 120, plumbing: 90 },
    penaltyPerDay: 19e3,
    creditReq: 700,
    complianceReq: 70,
    risk: 4,
    repReward: 12,
    creditReward: 16,
    minRep: 60,
    isMajorProject: true,
    desc: "Regional medical complex serving three counties. Highest compliance standards."
  },
  {
    id: "columbia_bridge",
    label: "Columbia River Bridge",
    category: "Infrastructure",
    minTier: 4,
    crewMin: 10,
    equipMin: 3,
    baseValue: 24e5,
    durationDays: 55,
    phases: ["Survey", "Foundation Piers", "Steel Frame", "Deck Pour", "Barriers", "Paving", "Commissioning"],
    materials: { concrete: 400, steel: 200, asphalt: 40 },
    penaltyPerDay: 3e4,
    creditReq: 720,
    risk: 5,
    repReward: 13,
    creditReward: 15,
    minRep: 72,
    isMajorProject: true,
    desc: "Major highway bridge spanning the Columbia River. National infrastructure significance."
  },
  {
    id: "osu_campus_expansion",
    label: "OSU Campus Expansion",
    category: "Government",
    minTier: 4,
    crewMin: 8,
    equipMin: 2,
    baseValue: 15e5,
    durationDays: 38,
    phases: ["Survey", "Site Prep", "Foundation", "Framing", "Roofing", "Interior", "Final Inspection"],
    materials: { concrete: 160, steel: 60, lumber: 100, electrical: 80 },
    penaltyPerDay: 17e3,
    creditReq: 700,
    complianceReq: 65,
    risk: 4,
    repReward: 11,
    creditReward: 14,
    minRep: 60,
    isMajorProject: true,
    desc: "Three new academic buildings for Oregon State University's engineering campus."
  }
];
var MATERIAL_DEFS = [
  { id: "concrete", label: "Concrete", unit: "m\xB3", basePrice: 120, volatility: 0.14, icon: "layers" },
  { id: "lumber", label: "Lumber", unit: "sheets", basePrice: 85, volatility: 0.18, icon: "leaf" },
  { id: "steel", label: "Steel", unit: "tons", basePrice: 950, volatility: 0.2, icon: "build" },
  { id: "electrical", label: "Electrical", unit: "spools", basePrice: 45, volatility: 0.1, icon: "flash" },
  { id: "plumbing", label: "Plumbing", unit: "meters", basePrice: 38, volatility: 0.1, icon: "water" },
  { id: "asphalt", label: "Asphalt", unit: "tons", basePrice: 200, volatility: 0.12, icon: "map" }
];
var OFFICES = [
  { id: 0, name: "Shed & Trailer", cost: 0, crewCap: 4, equipCap: 2, dailyRent: 50, perks: [], desc: "One phone, one whiteboard, unlimited ambition." },
  { id: 1, name: "Rented Portakabin", cost: 3500, crewCap: 8, equipCap: 4, dailyRent: 160, perks: [{ key: "bidBonus", value: 0.05, label: "+5% bid win chance" }], desc: "A proper on-site office. Clients trust you more." },
  { id: 2, name: "Small Site Office", cost: 15e3, crewCap: 16, equipCap: 8, dailyRent: 420, perks: [{ key: "penaltyReduction", value: 0.1, label: "-10% delay penalties" }], desc: "Room to grow and plan bigger projects." },
  { id: 3, name: "Project Office", cost: 45e3, crewCap: 30, equipCap: 18, dailyRent: 1100, perks: [{ key: "materialDiscount", value: 0.08, label: "-8% material costs" }, { key: "penaltyReduction", value: 0.15, label: "-15% delay penalties" }], desc: "A full project management hub." },
  { id: 4, name: "HQ Tower Suite", cost: 11e4, crewCap: 80, equipCap: 50, dailyRent: 2800, perks: [{ key: "bidBonus", value: 0.12, label: "+12% bid win chance" }, { key: "materialDiscount", value: 0.15, label: "-15% material costs" }], desc: "When you sign contracts, people stand up." }
];
var OFFICE_IMAGES = {
  0: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/shed.png" },
  1: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/portakabin.png" },
  2: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/smalloffice.png" },
  3: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/projectoffice.png" },
  4: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/hqtower.png" }
};
var REP_TIERS = [
  { min: 0, label: "Unknown Contractor", badge: "\u26AB", bonus: null },
  { min: 20, label: "Local Builder", badge: "\u{1F7E4}", bonus: { cash: 500, credit: 5 } },
  { min: 40, label: "Reliable Builder", badge: "\u26AA", bonus: { cash: 1500, credit: 10 } },
  { min: 60, label: "Regional Leader", badge: "\u{1F7E1}", bonus: { cash: 4e3, credit: 15 } },
  { min: 80, label: "Industry Standard", badge: "\u{1F535}", bonus: { cash: 1e4, credit: 20 } },
  { min: 95, label: "Elite Constructor", badge: "\u{1F534}", bonus: { cash: 25e3, credit: 30 } }
];
function getRepTier(rep) {
  let tier = REP_TIERS[0];
  for (const t of REP_TIERS) {
    if ((rep || 0) >= t.min) tier = t;
  }
  return tier;
}
var MILESTONE_DEFS = [
  { key: "firstSite", check: (g) => g.completedJobs >= 1, label: "First Site Complete", reward: 0 },
  { key: "crew5", check: (g) => g.crew.length >= 5, label: "5-Person Crew", reward: 1e3 },
  { key: "crew10", check: (g) => g.crew.length >= 10, label: "10-Person Crew", reward: 3e3 },
  { key: "equip3", check: (g) => g.equipment.length >= 3, label: "3 Machines", reward: 1600 },
  { key: "cash25k", check: (g) => g.cash >= 25e3, label: "$25K Reserve", reward: 0 },
  { key: "cash100k", check: (g) => g.cash >= 1e5, label: "$100K Reserve", reward: 0 },
  { key: "office2", check: (g) => g.officeIndex >= 2, label: "Proper Office", reward: 4e3 },
  { key: "sites5", check: (g) => g.completedJobs >= 5, label: "5 Jobs Completed", reward: 2e3 },
  { key: "sites25", check: (g) => g.completedJobs >= 25, label: "25 Jobs Completed", reward: 1e4 },
  { key: "tier3equip", check: (g) => g.equipment.some((e) => e.tier >= 3), label: "First Heavy Machine", reward: 6e3 },
  { key: "sites50", check: (g) => g.completedJobs >= 50, label: "50 Jobs Completed", reward: 3e4 },
  { key: "sites100", check: (g) => g.completedJobs >= 100, label: "100 Jobs Completed", reward: 1e5 },
  { key: "cash500k", check: (g) => g.cash >= 5e5, label: "$500K Reserve", reward: 0 },
  { key: "cash1m", check: (g) => g.cash >= 1e6, label: "$1M Reserve", reward: 0 },
  { key: "crew20", check: (g) => g.crew.length >= 20, label: "20-Person Crew", reward: 1e4 },
  { key: "equip8", check: (g) => g.equipment.length >= 8, label: "8 Machines", reward: 2e4 },
  { key: "crew30", check: (g) => g.crew.length >= 30, label: "30-Person Crew", reward: 24e3 },
  { key: "sites75", check: (g) => g.completedJobs >= 75, label: "75 Jobs Complete", reward: 5e4 },
  { key: "cash5m", check: (g) => g.cash >= 5e6, label: "$5M Reserve", reward: 0 },
  { key: "equip12", check: (g) => (g.equipment || []).length >= 12, label: "12-Machine Fleet", reward: 5e4 },
  { key: "sites150", check: (g) => g.completedJobs >= 150, label: "150 Jobs Complete", reward: 2e5 },
  {
    id: "rep100",
    key: "rep100",
    label: "Reputation 100",
    desc: "Reach 100 reputation",
    tier: 4,
    check: (g) => (g.reputation || 0) >= 100,
    reward: (g) => {
      g.cash += 5e4;
      addLog2(g, "\u{1F3C6} 100 Reputation achieved \u2014 $50k bonus!");
    }
  },
  {
    id: "cities10",
    key: "cities10",
    label: "10 Cities",
    desc: "Expand to 10 cities",
    tier: 4,
    check: (g) => (g.unlockedCities?.length || 1) >= 10,
    reward: (g) => {
      g.reputation = (g.reputation || 0) + 15;
      addLog2(g, "\u{1F30E} 10 cities expanded! Reputation +15");
    }
  },
  {
    id: "value100m",
    key: "value100m",
    label: "$100M Empire",
    desc: "Reach $100M company value",
    tier: 4,
    check: (g) => (g.companyValuation || 0) >= 1e8,
    reward: (g) => {
      g.cash += 25e4;
      addLog2(g, "\u{1F4B0} $100M company value reached! $250k bonus!");
    }
  },
  {
    id: "jobs1000",
    key: "jobs1000",
    label: "1,000 Projects",
    desc: "Complete 1,000 projects",
    tier: 4,
    check: (g) => (g.completedJobs || 0) >= 1e3,
    reward: (g) => {
      g.reputation = (g.reputation || 0) + 20;
      addLog2(g, "\u{1F3D7}\uFE0F 1,000 projects complete! Rep +20");
    }
  },
  {
    id: "domination",
    key: "domination",
    label: "Market Domination",
    desc: "Outvalue every rival by 10\xD7",
    tier: 4,
    check: (g) => (g.rivals || []).length > 0 && (g.rivals || []).every((r) => r.status === "Bankrupt" || (g.companyValuation || 0) > ((r.cash || 0) + (r.rep || 0) * 5e4) * 10),
    reward: (g) => {
      g.cash += 5e5;
      addLog2(g, "\u{1F451} Market Domination achieved! $500k bonus!");
    }
  }
];
var CITIES = [
  { id: "salem", name: "Salem", state: "OR", region: "Pacific Northwest", unlockCost: 0, unlockRep: 0, contractMult: 1, competition: "Low", popLabel: "Capital City", rivals: ["apex", "northwest"] },
  { id: "portland", name: "Portland", state: "OR", region: "Pacific Northwest", unlockCost: 75e3, unlockRep: 25, contractMult: 1.4, competition: "Medium", popLabel: "Largest City", rivals: ["summit", "apex"] },
  { id: "eugene", name: "Eugene", state: "OR", region: "Pacific Northwest", unlockCost: 5e4, unlockRep: 20, contractMult: 1.2, competition: "Low", popLabel: "University City", rivals: ["northwest"] },
  { id: "seattle", name: "Seattle", state: "WA", region: "Pacific Northwest", unlockCost: 15e4, unlockRep: 40, contractMult: 1.8, competition: "High", popLabel: "Major Metro", rivals: ["summit", "ironpeak", "apex"] },
  { id: "boise", name: "Boise", state: "ID", region: "Mountain West", unlockCost: 8e4, unlockRep: 30, contractMult: 1.3, competition: "Medium", popLabel: "Fast-Growing City", rivals: ["ironpeak"] },
  { id: "spokane", name: "Spokane", state: "WA", region: "Pacific Northwest", unlockCost: 9e4, unlockRep: 35, contractMult: 1.3, competition: "Medium", popLabel: "Eastern WA Hub", rivals: ["northwest", "ironpeak"] },
  { id: "denver", name: "Denver", state: "CO", region: "Mountain West", unlockCost: 2e5, unlockRep: 55, contractMult: 2, competition: "High", popLabel: "Mountain Metropolis", rivals: ["summit", "ironpeak"] },
  { id: "dallas", name: "Dallas", state: "TX", region: "South Central", unlockCost: 3e5, unlockRep: 65, contractMult: 2.5, competition: "Very High", popLabel: "Booming Market", rivals: ["apex", "summit", "ironpeak"] },
  { id: "phoenix", name: "Phoenix", state: "AZ", region: "Southwest", unlockCost: 25e4, unlockRep: 60, contractMult: 2.3, competition: "High", popLabel: "Sun Belt Growth", rivals: ["apex", "summit"] }
];
var REGIONAL_OFFICE_TYPES = [
  { id: "small_office", name: "Small Office", cost: 25e3, dailyRent: 150, crewBonus: 5, contractSlots: 3, desc: "Covers a local area. Room for a small team." },
  { id: "regional_office", name: "Regional Office", cost: 8e4, dailyRent: 450, crewBonus: 15, contractSlots: 8, desc: "Multi-site coordination hub." },
  { id: "corporate_office", name: "Corporate Office", cost: 2e5, dailyRent: 1200, crewBonus: 30, contractSlots: 18, desc: "Full corporate presence in the city." },
  { id: "state_hq", name: "State HQ", cost: 5e5, dailyRent: 3e3, crewBonus: 60, contractSlots: 35, desc: "Dominant player in the state." },
  { id: "national_hq", name: "National HQ", cost: 15e5, dailyRent: 9e3, crewBonus: 150, contractSlots: 80, desc: "Commands national market presence." }
];
var PROPERTY_TYPES = [
  { id: "equipment_yard", name: "Equipment Yard", cost: 4e4, dailyCost: 120, weeklyIncome: 400, resaleRate: 0.8, equipCapBonus: 5, materialDiscount: 0, eliminatesRent: false, desc: "Stores 5 extra machines and cuts maintenance fees." },
  { id: "storage_lot", name: "Storage Lot", cost: 25e3, dailyCost: 75, weeklyIncome: 250, resaleRate: 0.8, equipCapBonus: 0, materialDiscount: 0.05, eliminatesRent: false, desc: "Bulk material storage. 5% off material orders." },
  { id: "material_warehouse", name: "Material Warehouse", cost: 75e3, dailyCost: 200, weeklyIncome: 750, resaleRate: 0.8, equipCapBonus: 0, materialDiscount: 0.15, eliminatesRent: false, desc: "Full warehouse. 15% off all material purchases." },
  { id: "office_property", name: "Office Property", cost: 12e4, dailyCost: 0, weeklyIncome: 600, resaleRate: 0.85, equipCapBonus: 0, materialDiscount: 0, eliminatesRent: true, desc: "Own instead of rent. Eliminates home office daily rent." }
];
var CLIENT_ROSTER = [
  { id: "city_hall", name: "City Hall", focus: "infrastructure", icon: "\u{1F3DB}\uFE0F" },
  { id: "apex_dev", name: "Apex Development", focus: "commercial", icon: "\u{1F3E2}" },
  { id: "greenfield", name: "Greenfield Homes", focus: "residential", icon: "\u{1F3E0}" },
  { id: "harbor_port", name: "Harbor Port Auth.", focus: "industrial", icon: "\u2693" },
  { id: "summit_school", name: "Summit School Dist.", focus: "commercial", icon: "\u{1F3EB}" }
];
var LEGACY_PERKS = [
  { id: "iron_foundation", label: "Iron Foundation", desc: "Start next gen with +$50k cash" },
  { id: "reputation_legacy", label: "Reputation Legacy", desc: "Start next gen at Reputation 25" },
  { id: "veteran_mentor", label: "Veteran Mentor", desc: "Your best worker joins at half wage" },
  { id: "equipment_cache", label: "Equipment Cache", desc: "Begin with a free Tier-2 vehicle" },
  { id: "material_stockpile", label: "Material Stockpile", desc: "Start with $8,000 in mixed materials" },
  { id: "political_connections", label: "Political Connections", desc: "First 5 contracts worth 20% more" }
];
var PM_TIERS = [
  { id: "junior_pm", name: "Junior PM", wagePerDay: 340, hireCost: 4e3, delayReduce: 0.1, marginBoost: 0.03, autoManage: false, desc: "Reduces delays by 10% and lifts margins slightly." },
  { id: "senior_pm", name: "Senior PM", wagePerDay: 500, hireCost: 8e3, delayReduce: 0.2, marginBoost: 0.06, autoManage: true, desc: "Auto-unpauses stalled sites. 20% fewer delays." },
  { id: "director", name: "PM Director", wagePerDay: 780, hireCost: 15e3, delayReduce: 0.35, marginBoost: 0.1, autoManage: true, desc: "Company-wide oversight. Biggest margin and delay boost." }
];
var TRAINING_PROGRAMS2 = [
  { id: "safety_course", label: "Safety Course", cost: 500, duration: 3, skillBonus: 5, wagePressure: 0, certId: "safety_cert" },
  { id: "equipment_cert", label: "Equipment Certification", cost: 800, duration: 5, skillBonus: 8, wagePressure: 0, certId: "equipment_cert" },
  { id: "foreman_track", label: "Foreman Fast-Track", cost: 1500, duration: 7, skillBonus: 12, wagePressure: 0.15, certId: "foreman_cert" },
  { id: "safety_management", label: "Safety Management Course", cost: 2e3, duration: 10, skillBonus: 15, wagePressure: 0.05, certId: "safety_mgmt_cert" },
  { id: "project_leadership", label: "Project Leadership", cost: 3500, duration: 14, skillBonus: 18, wagePressure: 0.2, certId: "project_lead_cert" }
];
var PROMOTION_MILESTONES = [5, 10, 20, 35];
var WORKER_LEVELS = [
  { level: 1, label: "Apprentice", xpRequired: 0 },
  { level: 2, label: "Journeyman", xpRequired: 150 },
  { level: 3, label: "Skilled", xpRequired: 400 },
  { level: 4, label: "Senior", xpRequired: 800 },
  { level: 5, label: "Master", xpRequired: 1500 }
];
var EMPIRE_GOALS = [
  { id: "local_foothold", title: "Local Foothold", desc: "Complete 10 jobs", check: (g) => (g.completedJobs || 0) >= 10, cashReward: 5e3, repReward: 5 },
  { id: "second_city", title: "Second City", desc: "Open an office in any second city", check: (g) => (g.cityOffices || []).length >= 1, cashReward: 1e4, repReward: 10 },
  { id: "multi_city", title: "Multi-City Operator", desc: "Have offices in 3+ cities", check: (g) => (g.cityOffices || []).length >= 3, cashReward: 3e4, repReward: 15 },
  { id: "oregon_one", title: "Oregon's #1 Contractor", desc: "Rep 75+ with offices in Portland & Eugene", check: (g) => g.reputation >= 75 && (g.cityOffices || []).some((o) => o.cityId === "portland") && (g.cityOffices || []).some((o) => o.cityId === "eugene"), cashReward: 5e4, repReward: 20 },
  { id: "pnw_empire", title: "PNW Empire", desc: "Offices in all four Pacific NW cities", check: (g) => ["portland", "eugene", "seattle", "spokane"].every((id) => (g.cityOffices || []).some((o) => o.cityId === id)), cashReward: 1e5, repReward: 25 },
  { id: "land_baron", title: "Land Baron", desc: "Own 5+ properties", check: (g) => (g.properties || []).length >= 5, cashReward: 4e4, repReward: 10 },
  { id: "national_player", title: "National Player", desc: "Have offices in 7+ cities", check: (g) => (g.cityOffices || []).length >= 7, cashReward: 2e5, repReward: 30 },
  { id: "acquisition_king", title: "Acquisition King", desc: "Acquire 2+ rival companies", check: (g) => (g.acquiredRivals || []).length >= 2, cashReward: 15e4, repReward: 20 },
  { id: "valuation_5m", title: "$5M Company", desc: "Reach $5 million company valuation", check: (g) => computeValuation(g) >= 5e6, cashReward: 4e5, repReward: 50 },
  { id: "construction_empire", title: "Construction Empire", desc: "Reach $10M company valuation", check: (g) => computeValuation(g) >= 1e7, cashReward: 6e5, repReward: 75 },
  { id: "number_one", title: "#1 in America", desc: "Reach $20M valuation and national rank #1", check: (g) => computeValuation(g) >= 2e7 && (g.nationalRank || 99) <= 1, cashReward: 1e6, repReward: 100 },
  { id: "salem_dominant", title: "Salem Dominator", desc: "Win 15+ jobs in your home city", check: (g) => ((g.cityJobsWon || {})["salem"] || 0) >= 15, cashReward: 16e3, repReward: 8 },
  { id: "oregon_leader", title: "Oregon Leader", desc: "Rep 70+ and active jobs in Portland, Eugene & Salem", check: (g) => g.reputation >= 70 && ((g.cityJobsWon || {}).portland || 0) > 0 && ((g.cityJobsWon || {}).eugene || 0) > 0 && ((g.cityJobsWon || {}).salem || 0) >= 5, cashReward: 6e4, repReward: 18 }
];
function computeValuation(g) {
  const equipValue = (g.equipment || []).reduce((s, e) => s + e.price * (e.condition / 100) * 0.6, 0);
  const propValue = (g.properties || []).reduce((s, p) => {
    const def = PROPERTY_TYPES.find((t) => t.id === p.typeId);
    return s + (def ? def.cost * (def.resaleRate || 0.8) : 0);
  }, 0);
  const offValue = (g.cityOffices || []).reduce((s, o) => {
    const def = REGIONAL_OFFICE_TYPES.find((t) => t.id === o.typeId);
    return s + (def ? def.cost * 0.7 : 0);
  }, 0);
  const pipeline = (g.activeSites || []).reduce((s, site) => s + site.totalValue * 0.4, 0);
  return Math.round((g.cash || 0) + equipValue + propValue + offValue + pipeline + (g.reputation || 0) * 1500);
}
function computeNationalRank(g) {
  const val = computeValuation(g);
  if (val >= 2e7) return 1;
  if (val >= 15e6) return 2;
  if (val >= 1e7) return 3;
  if (val >= 7e6) return 5;
  if (val >= 5e6) return 8;
  if (val >= 3e6) return 15;
  if (val >= 2e6) return 25;
  if (val >= 1e6) return 40;
  if (val >= 5e5) return 60;
  if (val >= 2e5) return 85;
  if (val >= 1e5) return 90;
  return 99;
}
function computeMarketShare(g) {
  const cities = (g.cityOffices || []).length + 1;
  const base = cities / CITIES.length;
  const repBonus = (g.reputation || 0) / 2e3;
  return Math.min(35, Math.round((base + repBonus) * 100));
}
function computeHealthScore(g) {
  const dailyBurn = (g.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0) + (g.equipment || []).reduce((s, e) => s + e.dailyCost, 0) + (OFFICES[g.officeIndex || 0]?.dailyRent || 0);
  const runway = dailyBurn > 0 ? Math.floor((g.cash || 0) / dailyBurn) : 999;
  const overdue = (g.activeSites || []).filter((s) => s.status === "Active" && g.day > (s.deadlineDay || 9999)).length;
  const burning = (g.crew || []).filter((w) => (w.stamina ?? 50) < 15).length;
  let score = 100;
  const factors = [];
  if (runway < 7) {
    const pts = Math.round((7 - runway) / 7 * 25);
    score -= pts;
    if (pts > 0) factors.push(`Cash runway ${runway}d (-${pts}pts)`);
  }
  if ((g.safetyScore || 60) < 50) {
    const pts = Math.round((50 - (g.safetyScore || 60)) / 50 * 20);
    score -= pts;
    factors.push(`Low safety score (-${pts}pts)`);
  }
  const overdueDeduct = Math.min(20, overdue * 10);
  score -= overdueDeduct;
  if (overdue > 0) factors.push(`${overdue} overdue site${overdue > 1 ? "s" : ""} (-${overdueDeduct}pts)`);
  const burnDeduct = Math.min(15, burning * 5);
  score -= burnDeduct;
  if (burning > 0) factors.push(`${burning} crew burning out (-${burnDeduct}pts)`);
  if ((g.reputation || 0) > 60) score += 5;
  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "At Risk";
  const colorKey = score >= 80 ? "green" : score >= 60 ? "cyan" : score >= 40 ? "orange" : "red";
  return { score, label, colorKey, factors };
}
function getPredictiveWarnings(g) {
  const warnings = [];
  const dailyBurn = (g.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0) + (g.equipment || []).reduce((s, e) => s + e.dailyCost, 0) + (OFFICES[g.officeIndex || 0]?.dailyRent || 0);
  const runway = dailyBurn > 0 ? Math.floor((g.cash || 0) / dailyBurn) : 999;
  if (runway < 5) warnings.push({ text: `Cash runway critical \u2014 only ${runway} day${runway !== 1 ? "s" : ""} left`, severity: "high" });
  const overdue = (g.activeSites || []).filter((s) => s.status === "Active" && g.day > (s.deadlineDay || 9999));
  for (const s of overdue.slice(0, 2)) warnings.push({ text: `"${s.label}" is overdue \u2014 penalties accumulating`, severity: "high" });
  const badEquip = (g.equipment || []).filter((e) => (e.condition ?? 100) < 30);
  if (badEquip.length > 0) warnings.push({ text: `${badEquip.length} vehicle${badEquip.length > 1 ? "s" : ""} below 30% condition \u2014 breakdown risk`, severity: "medium" });
  const missingSite = (g.activeSites || []).find((s) => {
    const con = (g.contracts || []).find((c) => c.id === s.contractId);
    const def = CONTRACT_DEFS.find((d) => d.id === con?.defId);
    return def?.materials && Object.entries(def.materials).some(([m, n]) => ((s.materialsFulfilled || {})[m] || 0) < n);
  });
  if (missingSite) warnings.push({ text: `"${missingSite.label}" is stalled \u2014 missing materials`, severity: "medium" });
  return warnings.slice(0, 3);
}
function computeInflation(g) {
  const day = g.day || 1;
  let mult;
  if (day <= 30) mult = 1;
  else if (day <= 100) mult = 1 + (day - 30) / 1e3;
  else if (day <= 300) mult = 1.07 + (day - 100) / 200 * (1.18 - 1.07);
  else mult = 1.18 + (day - 300) / 5e3;
  return Math.min(1.5, mult);
}
function enhanceContractValue(def, state, base) {
  const inflMult = computeInflation(state);
  let cityMult = 1;
  if (state.cityOffices && state.cityOffices.length > 0) {
    const maxCityMult = state.cityOffices.reduce((best, office) => {
      const cityDef = CITIES.find((c) => c.id === office.cityId);
      return cityDef && cityDef.contractMult > best ? cityDef.contractMult : best;
    }, 1);
    cityMult = maxCityMult;
  }
  let eventMult = 1;
  if (state.activeMarketEvent) {
    const activeEvent = MARKET_EVENTS.find((e) => e.id === state.activeMarketEvent);
    if (activeEvent) {
      if (!activeEvent.categoryRestrict || activeEvent.categoryRestrict.includes(def.category)) {
        eventMult = activeEvent.contractMult;
      }
    }
  } else {
    eventMult = state.marketState === "Boom" ? 1.12 : state.marketState === "Slow" ? 0.88 : 1;
  }
  const variancePct = rand2(-20, 35) / 100;
  const repBonus = Math.min(0.25, (state.reputation || 0) / 400);
  const enhancedValue = Math.round(def.baseValue * eventMult * inflMult * cityMult * (1 + variancePct) * (1 + repBonus));
  const inflDeadlineBonus = Math.min(5, Math.floor((inflMult - 1) / 0.1));
  const enhancedDeadline = base.deadline + inflDeadlineBonus;
  return {
    value: Math.max(Math.round(def.baseValue * 0.5), enhancedValue),
    deadline: enhancedDeadline
  };
}
function getTotalCrewCap(g) {
  const officeTier = OFFICES[g.officeIndex || 0];
  const officeBonus = (g.cityOffices || []).reduce((s, o) => {
    const def = REGIONAL_OFFICE_TYPES.find((t) => t.id === o.typeId);
    return s + (def ? def.crewBonus : 0);
  }, 0);
  const propBonus = (g.properties || []).reduce((s, p) => {
    const def = PROPERTY_TYPES.find((t) => t.id === p.typeId);
    return s + (def ? def.equipCapBonus : 0);
  }, 0);
  return (officeTier?.crewCap || 4) + officeBonus;
}
function getMaterialDiscount(g) {
  const officePerk = OFFICES[g.officeIndex || 0]?.perks?.find((p) => p.key === "materialDiscount");
  const baseDisc = officePerk ? officePerk.value : 0;
  const propDisc = (g.properties || []).reduce((s, p) => {
    const def = PROPERTY_TYPES.find((t) => t.id === p.typeId);
    return s + (def ? def.materialDiscount || 0 : 0);
  }, 0);
  return Math.min(0.4, baseDisc + propDisc);
}
function getEquipCapBonus(g) {
  return (g.properties || []).reduce((s, p) => {
    const def = PROPERTY_TYPES.find((t) => t.id === p.typeId);
    return s + (def ? def.equipCapBonus || 0 : 0);
  }, 0);
}
function pickContractCity(g) {
  const available = [
    "salem",
    ...(g.cityOffices || []).map((o) => o.cityId).filter((v, i, a) => a.indexOf(v) === i)
  ];
  const weighted = [];
  for (const cityId of available) {
    const city = CITIES.find((c) => c.id === cityId);
    const weight = city ? Math.max(1, Math.round(city.contractMult * 3)) : 3;
    for (let i = 0; i < weight; i++) weighted.push(cityId);
  }
  return pick2(weighted);
}
function buildContractorRankings(g) {
  const playerVal = computeValuation(g);
  const playerRow = {
    id: "player",
    name: g.companyName,
    isPlayer: true,
    rep: g.reputation,
    value: playerVal,
    cities: (g.cityOffices || []).length + 1,
    status: null,
    acquired: false
  };
  const rivalRows = (g.rivals || []).map((r) => ({
    id: r.id,
    name: r.name,
    isPlayer: false,
    rep: r.rep || 0,
    value: (r.cash || 0) + (r.rep || 0) * 5e4 + (r.cityPresence || ["salem"]).length * 1e5 + (r.jobsCompleted || 0) * 15e3,
    cities: (r.cityPresence || ["salem"]).length,
    status: r.status || null,
    acquired: (g.acquiredRivals || []).includes(r.id)
  }));
  return [...rivalRows, playerRow].sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, rank: i + 1 }));
}
function getCityPlayerShare(g, cityId) {
  const playerJobs = (g.cityJobsWon || {})[cityId] || 0;
  const rivalJobs = (g.rivals || []).reduce((total, rival) => {
    if ((rival.cityPresence || ["salem"]).includes(cityId)) {
      return total + Math.max(1, Math.floor((rival.jobsCompleted || 0) / Math.max(1, (rival.cityPresence || []).length)));
    }
    return total;
  }, 0);
  const totalJobs = playerJobs + rivalJobs;
  return totalJobs === 0 ? 0 : Math.round(playerJobs / totalJobs * 100);
}
var ULTIMATE_GOAL_IDS = ["number_one", "construction_empire", "national_player", "acquisition_king", "pnw_empire"];
function checkEmpireGoals(g) {
  for (const goal of EMPIRE_GOALS) {
    if ((g.empireGoalsCompleted || []).includes(goal.id)) continue;
    try {
      if (goal.check(g)) {
        if (!g.empireGoalsCompleted) g.empireGoalsCompleted = [];
        g.empireGoalsCompleted.push(goal.id);
        if (goal.cashReward) {
          g.cash += goal.cashReward;
          g.revenue += goal.cashReward;
        }
        if (goal.repReward) g.reputation = Math.min(100, (g.reputation || 0) + goal.repReward);
        addLog2(g, `\u{1F3C6} Empire Goal: "${goal.title}" \u2014 +${money2(goal.cashReward || 0)} & +${goal.repReward} rep!`);
      }
    } catch (e) {
      if (__DEV__) console.warn("[ConstructionFlow] empire goal check error:", e);
    }
  }
  const allUltimateDone = ULTIMATE_GOAL_IDS.every((id) => (g.empireGoalsCompleted || []).includes(id));
  if (allUltimateDone) {
    if (!g.hallOfFame) g.hallOfFame = {};
    if (!g.hallOfFame.prestigeReached) {
      g.hallOfFame.prestigeReached = g.day;
      addLog2(g, `\u{1F451} LEGACY COMPLETE \u2014 You have built a construction empire! Day ${g.day}.`);
      g.pendingStory = g.pendingStory || { icon: "trophy", title: "Legacy Complete!", body: "You have achieved everything \u2014 the #1 ranked construction empire in America. Your legacy is set in stone." };
    }
  }
}
var CHAOS_EVENTS = [
  {
    id: "noshow",
    label: "Worker No-Show",
    prob: 0.04,
    tone: "orange",
    icon: "\u{1F624}",
    apply: (site, game) => {
      const impact = rand2(8, 18);
      site.phaseProgress = Math.max(0, site.phaseProgress - impact);
      addLog2(game, `\u26A0 ${site.label}: A crew member didn't show up \u2014 lost ${impact}% progress.`);
      return { text: `Worker no-show \u2014 lost ${impact}% phase progress.`, type: "noshow" };
    }
  },
  {
    id: "weather",
    label: "Weather Delay",
    prob: 0.035,
    tone: "blue",
    icon: "\u{1F327}\uFE0F",
    apply: (site, game) => {
      const days = rand2(1, 3);
      site.deadlineDay += days;
      site.currentWeather = { icon: "rainy", label: "Weather Delay", endsDay: (game.day || 1) + days };
      addLog2(game, `\u{1F327}\uFE0F ${site.label}: Weather delay \u2014 deadline pushed ${days} day(s).`);
      return { text: `Weather stopped work for ${days} day(s). Deadline extended.`, type: "weather" };
    }
  },
  {
    id: "breakdown",
    label: "Equipment Breakdown",
    prob: 0.03,
    tone: "red",
    icon: "\u{1F527}",
    apply: (site, game) => {
      const assigned = game.equipment.find((e) => (site.assignedEquipmentIds || []).includes(e.id) && e.status === "Active");
      if (!assigned) return null;
      if (!game.pendingBreakdown) {
        const repairCost = rand2(800, 3500);
        game.pendingBreakdown = {
          siteId: site.id,
          siteLabel: site.label,
          equipId: assigned.id,
          equipName: assigned.name,
          repairCost
        };
        assigned.condition = Math.max(25, assigned.condition - rand2(10, 20));
        addLog2(game, `\u26A0\uFE0F ${assigned.name} broke down on ${site.label} \u2014 awaiting your decision.`);
        return { text: `${assigned.name} broke down. Choose your response.`, type: "breakdown" };
      }
      return null;
    }
  },
  {
    id: "shortage",
    label: "Material Shortage",
    prob: 0.025,
    tone: "orange",
    icon: "\u{1F4E6}",
    apply: (site, game) => {
      const impact = rand2(5, 15);
      site.phaseProgress = Math.max(0, site.phaseProgress - impact);
      const matKeys = Object.keys(site.materialsFulfilled || {}).filter((k) => (site.materialsFulfilled[k] || 0) > 2);
      if (matKeys.length > 0) {
        const matId = matKeys[Math.floor(Math.random() * matKeys.length)];
        site.materialsFulfilled[matId] = Math.max(0, (site.materialsFulfilled[matId] || 0) - rand2(2, 4));
      }
      addLog2(game, `\u{1F4E6} ${site.label}: Material shortage \u2014 stock depleted and ${impact}% progress lost. Re-stock to continue.`);
      return { text: `Material shortage! Lost ${impact}% progress \u2014 re-stock materials.`, type: "shortage" };
    }
  },
  {
    id: "safety",
    label: "Safety Incident",
    prob: 0.02,
    tone: "red",
    icon: "\u{1F9BA}",
    apply: (site, game) => {
      const fine = rand2(2e3, 8e3);
      game.cash -= fine;
      game.reputation = Math.max(0, game.reputation - rand2(2, 6));
      addLog2(game, `\u{1F9BA} Safety incident on ${site.label}! Fine of ${money2(fine)} issued.`);
      return { text: `Safety incident \u2014 ${money2(fine)} fine, reputation hit.`, type: "safety" };
    }
  },
  {
    id: "permit",
    label: "Permit Delay",
    prob: 0.02,
    tone: "yellow",
    icon: "\u{1F4CB}",
    apply: (site, game) => {
      site.status = "Paused";
      const days = rand2(2, 5);
      site.pausedDays = (site.pausedDays || 0) + days;
      addLog2(game, `\u{1F4CB} ${site.label}: Permit issue \u2014 site paused for up to ${days} days.`);
      return { text: `Permit issue \u2014 site paused ${days} days.`, type: "permit" };
    }
  },
  {
    id: "scope",
    label: "Scope Change",
    prob: 0.025,
    tone: "purple",
    icon: "\u{1F4D0}",
    apply: (site, game) => {
      const bonus = rand2(2e3, 8e3);
      site.totalValue += bonus;
      addLog2(game, `\u{1F4D0} ${site.label}: Client added scope \u2014 contract value +${money2(bonus)}!`);
      return { text: `Client added scope. Contract value +${money2(bonus)}.`, type: "scope" };
    }
  },
  {
    id: "theft",
    label: "Material Theft",
    prob: 0.015,
    tone: "red",
    icon: "\u{1F6A8}",
    apply: (site, game) => {
      const mats = Object.keys(game.materials).filter((k) => (game.materials[k] || 0) > 0);
      if (!mats.length) return null;
      const matId = pick2(mats);
      const stolen = rand2(5, Math.min(20, game.materials[matId]));
      game.materials[matId] = Math.max(0, game.materials[matId] - stolen);
      const mat = MATERIAL_DEFS.find((m) => m.id === matId);
      const loss = stolen * (game.materialPrices[matId] || mat?.basePrice || 100);
      game.reputation = Math.max(0, game.reputation - 1);
      addLog2(game, `\u{1F6A8} ${site.label}: ${stolen} ${mat?.unit} of ${mat?.label} stolen \u2014 ${money2(loss)} in losses.`);
      return { text: `${stolen} ${mat?.unit} of ${mat?.label} stolen. ${money2(loss)} lost.`, type: "theft" };
    }
  },
  {
    id: "injury",
    label: "Worker Injury",
    prob: 0.012,
    tone: "red",
    icon: "\u{1FA7A}",
    apply: (site, game) => {
      const injured = game.crew.find((w) => (site.assignedCrewIds || []).includes(w.id));
      if (!injured) return null;
      const days = rand2(3, 7);
      injured.status = "Idle";
      injured.stamina = 10;
      injured.mood = Math.max(20, injured.mood - 20);
      site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== injured.id);
      const baseVal = site.totalValue || 8e3;
      const medCost = Math.max(400, Math.round(baseVal * rand2(5, 12) / 100 / 100) * 100);
      game.cash -= medCost;
      game.reputation = Math.max(0, game.reputation - 2);
      addLog2(game, `\u{1FA7A} ${injured.name} injured on ${site.label} \u2014 off for ~${days} days. Medical: ${money2(medCost)}.`);
      return { text: `${injured.name} injured. Off site. Medical cost ${money2(medCost)}.`, type: "injury" };
    }
  },
  {
    id: "inspection",
    label: "Safety Inspection",
    prob: 0.018,
    tone: "yellow",
    icon: "\u{1F50D}",
    apply: (site, game) => {
      const safetyScore = game.officeStaff.some((s) => s.role === "Safety Officer") ? 80 : rand2(40, 75);
      const pass = safetyScore >= 65;
      if (pass) {
        game.reputation = Math.min(100, game.reputation + rand2(1, 3));
        addLog2(game, `\u2705 ${site.label}: Safety inspection PASSED \u2014 reputation up.`);
        return { text: "Safety inspection passed. Reputation +.", type: "inspect_pass" };
      } else {
        const baseVal = site.totalValue || 8e3;
        const fine = Math.max(500, Math.round(baseVal * rand2(8, 18) / 100 / 100) * 100);
        game.cash -= fine;
        site.status = "Paused";
        site.pausedDays = rand2(2, 4);
        game.reputation = Math.max(0, game.reputation - 3);
        addLog2(game, `\u274C ${site.label}: Safety inspection FAILED \u2014 ${money2(fine)} fine, work stopped.`);
        return { text: `Inspection failed. ${money2(fine)} fine. Work paused.`, type: "inspect_fail" };
      }
    }
  },
  {
    id: "fuel_cost",
    label: "Fuel Cost Surge",
    prob: 0.02,
    tone: "orange",
    icon: "\u26FD",
    apply: (site, game) => {
      const surcharge = rand2(500, 2e3);
      game.cash -= surcharge;
      addLog2(game, `\u26FD Fuel cost surge on ${site.label} \u2014 ${money2(surcharge)} equipment surcharge.`);
      return { text: `Fuel surge \u2014 ${money2(surcharge)} equipment surcharge.`, type: "fuel_cost" };
    }
  },
  {
    id: "client_dispute",
    label: "Client Dispute",
    prob: 0.018,
    tone: "orange",
    icon: "\u{1F4DE}",
    apply: (site, game) => {
      const baseVal = site.totalValue || 8e3;
      const hold = Math.max(300, Math.round(baseVal * rand2(5, 15) / 100 / 100) * 100);
      site.totalValue = Math.max(0, site.totalValue - hold);
      addLog2(game, `\u{1F4DE} ${site.label}: Client dispute \u2014 ${money2(hold)} withheld from contract.`);
      return { text: `Client dispute. ${money2(hold)} withheld from payment.`, type: "client_dispute" };
    }
  },
  {
    id: "subcontractor_walkoff",
    label: "Sub Walkoff",
    prob: 0.015,
    tone: "red",
    icon: "\u{1F6B6}",
    apply: (site, game) => {
      const sc = (game.subcontractors || []).find((s) => s.status === "Active");
      if (!sc) return null;
      sc.status = "Idle";
      const loss = rand2(10, 20);
      site.phaseProgress = Math.max(0, site.phaseProgress - loss);
      addLog2(game, `\u{1F6B6} ${sc.name} walked off ${site.label} \u2014 lost ${loss}% progress.`);
      return { text: `Subcontractor walkoff. Lost ${loss}% progress.`, type: "subcontractor_walkoff" };
    }
  },
  {
    id: "client_praise",
    label: "Client Praise",
    prob: 0.03,
    tone: "green",
    icon: "\u2B50",
    apply: (site, game) => {
      const bonus = rand2(1e3, 5e3);
      site.totalValue += bonus;
      game.reputation = Math.min(100, (game.reputation || 0) + rand2(1, 3));
      addLog2(game, `\u2B50 ${site.label}: Client delighted \u2014 bonus ${money2(bonus)} added!`);
      return { text: `Client praise. Bonus ${money2(bonus)}. Rep +.`, type: "client_praise" };
    }
  },
  {
    id: "equipment_recall",
    label: "Equipment Recall",
    prob: 8e-3,
    tone: "red",
    icon: "\u{1F534}",
    apply: (site, game) => {
      const equip = game.equipment.find((e) => (site.assignedEquipmentIds || []).includes(e.id));
      if (!equip) return null;
      equip.status = "Maintenance";
      equip.condition = Math.max(10, equip.condition - 30);
      site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => id !== equip.id);
      addLog2(game, `\u{1F534} ${equip.name} subject to safety recall \u2014 pulled from ${site.label}.`);
      return { text: `${equip.name} recalled for safety. Pulled from site.`, type: "recall" };
    }
  },
  {
    id: "community_award",
    label: "Community Award",
    prob: 0.012,
    tone: "cyan",
    icon: "\u{1F3C6}",
    apply: (site, game) => {
      game.reputation = Math.min(100, (game.reputation || 0) + rand2(3, 6));
      game.creditScore = Math.min(850, (game.creditScore || 600) + rand2(3, 8));
      addLog2(game, `\u{1F3C6} ${site.label} received a community excellence award! Rep +, Credit +.`);
      return { text: `Community award! Reputation and credit improved.`, type: "award" };
    }
  },
  {
    id: "material_delivery_bonus",
    label: "Early Material Delivery",
    prob: 0.025,
    tone: "green",
    icon: "\u{1F69A}",
    apply: (site, game) => {
      const gain = rand2(5, 12);
      site.phaseProgress = Math.min(100, site.phaseProgress + gain);
      addLog2(game, `\u{1F69A} ${site.label}: Early material delivery \u2014 gained ${gain}% phase progress.`);
      return { text: `Early delivery. Gained ${gain}% progress.`, type: "delivery_bonus" };
    }
  },
  {
    id: "regulatory_hold",
    label: "Regulatory Hold",
    prob: 0.012,
    tone: "yellow",
    icon: "\u{1F4DC}",
    apply: (site, game) => {
      if (game.pendingDecision) return { text: `Regulatory hold incoming \u2014 decision pending.`, type: "regulatory" };
      const days = rand2(3, 7);
      const baseValue = site.totalValue || 8e3;
      const fineRaw = baseValue * rand2(5, 15) / 100;
      const fine = Math.max(200, Math.round(fineRaw / 100) * 100);
      const expediteCost = Math.max(100, Math.round(fine * 0.6 / 100) * 100);
      const premiumCost = Math.max(200, Math.round(fine * 1.1 / 100) * 100);
      game.pendingDecision = {
        id: "delay_regulatory",
        siteId: site.id,
        title: "\u{1F4DC} Regulatory Hold",
        tone: "yellow",
        desc: `Inspectors have flagged ${site.label} for a compliance review. Work must pause ${days} day${days > 1 ? "s" : ""} and a compliance fee is owed.`,
        delayDays: days,
        fine,
        expediteCost,
        premiumCost,
        options: [
          { label: "Wait It Out", sub: `Pause ${days} days \u2014 pay ${money2(fine)} compliance fee` },
          { label: "Expedite Process", sub: `Pay ${money2(fine + expediteCost)} total \u2014 reduce to ${Math.ceil(days / 2)} day pause` },
          { label: "Premium Resolution", sub: `Pay ${money2(fine + premiumCost)} \u2014 70% chance to clear entirely` }
        ]
      };
      addLog2(game, `\u{1F4DC} ${site.label}: Regulatory hold \u2014 compliance review required. Decision needed.`);
      return { text: `Regulatory hold \u2014 awaiting your decision.`, type: "regulatory" };
    }
  },
  {
    id: "material_theft",
    weight: 4,
    prob: 0.018,
    tone: "red",
    icon: "\u{1F534}",
    label: "Material Theft (Site)",
    apply: (site, game) => {
      const _def = CONTRACT_DEFS.find((c) => c.id === game.contracts.find((cc) => cc.id === site.contractId)?.defId);
      const _matIds = Object.keys(_def?.materials || {});
      if (_matIds.length > 0) {
        const _matId = _matIds[Math.floor(Math.random() * _matIds.length)];
        if (site.materialsFulfilled) site.materialsFulfilled[_matId] = Math.max(0, (site.materialsFulfilled[_matId] || 0) - 2);
      }
      addLog2(game, `\u{1F534} Material theft at ${site.label} \u2014 inventory reduced.`);
      return { text: `Material theft \u2014 on-site materials reduced.`, type: "material_theft" };
    }
  },
  {
    id: "productivity_surge",
    weight: 6,
    prob: 0.022,
    tone: "green",
    icon: "\u26A1",
    label: "Crew Productivity Surge",
    apply: (site, game) => {
      site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + 12);
      addLog2(game, `\u26A1 ${site.label}: Crew surge \u2014 extra 12% progress today.`);
      return { text: `Crew productivity surge \u2014 +12% phase progress.`, type: "productivity_surge" };
    }
  },
  {
    id: "permit_delay",
    weight: 5,
    prob: 0.016,
    tone: "yellow",
    icon: "\u{1F4CB}",
    label: "Permit Review Delay",
    apply: (site, game) => {
      if (game.pendingDecision) return { text: `Permit delay incoming \u2014 decision pending.`, type: "permit_delay" };
      const progressLoss = rand2(5, 12);
      const baseValue = site.totalValue || 8e3;
      const expediteCost = Math.max(100, Math.round(baseValue * 0.04 / 100) * 100);
      const premiumCost = Math.max(200, Math.round(baseValue * 0.08 / 100) * 100);
      game.pendingDecision = {
        id: "delay_permit",
        siteId: site.id,
        title: "\u{1F4CB} Permit Review Delay",
        tone: "yellow",
        desc: `${site.label} has hit a permit review snag. The city requires additional paperwork before work can proceed.`,
        progressLoss,
        expediteCost,
        premiumCost,
        options: [
          { label: "Accept the Delay", sub: `Lose ${progressLoss}% phase progress, rep -1` },
          { label: "Expedite Paperwork", sub: `Pay ${money2(expediteCost)} \u2014 lose only ${Math.ceil(progressLoss / 2)}% progress` },
          { label: "Premium Resolution", sub: `Pay ${money2(premiumCost)} \u2014 80% chance to skip delay entirely` }
        ]
      };
      addLog2(game, `\u{1F4CB} ${site.label}: Permit review delay \u2014 paperwork required. Decision needed.`);
      return { text: `Permit delay \u2014 awaiting your decision.`, type: "permit_delay" };
    }
  }
];
var DECISION_EVENTS = [
  {
    id: "supplier_deal",
    title: "\u{1F4E6} Supplier Deal",
    tone: "cyan",
    desc: "Your materials supplier offers a one-time 30% discount on bulk lumber and concrete if you commit $8,000 today.",
    options: [
      { label: "Take the deal", sub: "Spend $8,000 \u2192 receive 40 lumber + 15 concrete", apply: (g) => {
        if (g.cash >= 8e3) {
          g.cash -= 8e3;
          g.expenses += 8e3;
          g.materials.lumber = (g.materials.lumber || 0) + 40;
          g.materials.concrete = (g.materials.concrete || 0) + 15;
          addLog2(g, "\u{1F4E6} Took supplier deal \u2014 40 lumber + 15 concrete at 30% off!");
          addImportantNotice(g, "Bulk deal: 40 lumber + 15 concrete purchased for $8,000.", "green");
        }
      } },
      { label: "Pass", sub: "Keep your cash", apply: (g) => {
        addImportantNotice(g, "Supplier deal declined \u2014 cash kept.", "neutral");
      } }
    ]
  },
  {
    id: "investor_offer",
    title: "\u{1F4BC} Angel Investor",
    tone: "green",
    desc: "A local investor offers $120,000 cash today. In return, you agree to pay $1,200/week until $180,000 total is repaid.",
    options: [
      { label: "Accept investment", sub: "+$120,000 now, $1,200/week repayment", apply: (g) => {
        g.cash += 12e4;
        g.loans = g.loans || [];
        g.loans.push({ id: uid2(), label: "Angel Investment", weeklyPayment: 1200, weeksLeft: 150, remainingBalance: 18e4, missedPayments: 0 });
        addLog2(g, "\u{1F4BC} Angel investor deal closed \u2014 $120,000 received.");
        addImportantNotice(g, "Angel investment: $120,000 received \u2014 loan created.", "green");
      } },
      { label: "Decline", sub: "No debt, no strings", apply: (g) => {
        addImportantNotice(g, "Angel investor declined \u2014 no debt taken on.", "neutral");
      } }
    ]
  },
  {
    id: "rival_poach",
    title: "\u{1F4C9} Rival Struggling",
    tone: "orange",
    desc: "A struggling rival's best worker is looking for a new employer. You can hire them for a $10,000 signing bonus.",
    options: [
      { label: "Poach them", sub: "Pay $10,000 \u2014 get a skilled Veteran worker", apply: (g) => {
        if (g.cash >= 1e4) {
          g.cash -= 1e4;
          g.expenses += 1e4;
          const w = createWorker("Site Foreman");
          w.skill = rand2(100, 118);
          w.trait = CREW_TRAITS.find((t) => t.label === "Veteran") || pick2(CREW_TRAITS);
          w.wagePerDay = rand2(220, 320);
          w.hireDay = g.day;
          g.crew.push(w);
          addLog2(g, `\u{1F477} Poached ${w.name} from struggling rival \u2014 Veteran Foreman hired.`);
          addImportantNotice(g, `Veteran crew member poached from rival for $10,000.`, "green");
        }
      } },
      { label: "Stay out", sub: "Not your business", apply: (g) => {
        addImportantNotice(g, "Rival's worker not hired \u2014 cash saved.", "neutral");
      } }
    ]
  },
  {
    id: "rush_bid",
    title: "\u26A1 Emergency Contract",
    tone: "yellow",
    desc: "A client needs urgent repair work \u2014 double the going rate but the deadline is 4 days with heavy penalties.",
    options: [
      { label: "Take the rush job", sub: "2\xD7 value, 4-day deadline, 3\xD7 penalty/day", apply: (g) => {
        const base = CONTRACT_DEFS.find((d) => d.category === "Commercial" && d.minTier <= 2);
        if (base) {
          const c = createContract(g);
          c.value = Math.round(c.value * 2);
          c.deadline = g.day + 5;
          c.expiresDay = g.day + 2;
          c.penaltyPerDay = (c.penaltyPerDay || 200) * 3;
          c.label = "\u26A1 " + c.label;
          g.contracts.push(c);
          addLog2(g, `\u26A1 Emergency contract added \u2014 high value, tight window.`);
          addImportantNotice(g, "Rush contract added \u2014 tight deadline, 2\xD7 payout. Check Bids.", "orange");
        }
      } },
      { label: "Turn it down", sub: "Too risky right now", apply: (g) => {
        addImportantNotice(g, "Emergency contract declined \u2014 too risky.", "neutral");
      } }
    ]
  },
  {
    id: "bulk_equipment_deal",
    title: "\u{1F69C} Fleet Discount",
    tone: "cyan",
    desc: "An equipment dealer offers 20% off any purchase today only. Valid for next machine you buy.",
    options: [
      { label: "Lock in the discount", sub: "Next equipment purchase: -20%", apply: (g) => {
        g._equipDiscount = 0.2;
        g._equipDiscountExpiry = (g.day || 1) + 3;
        addLog2(g, "\u{1F69C} Fleet discount locked \u2014 20% off next machine for 3 days!");
        addImportantNotice(g, "20% equipment discount active for 3 days \u2014 visit Vehicles.", "green");
      } },
      { label: "Not now", sub: "No savings today", apply: (g) => {
        addImportantNotice(g, "Equipment discount passed \u2014 no purchase planned.", "neutral");
      } }
    ]
  },
  {
    id: "govt_contract_tip",
    title: "\u{1F3DB}\uFE0F Gov't Insider",
    tone: "purple",
    desc: "A contact tips you off: a major government contract is coming. Spend $3,000 on prep work to get priority bid access.",
    options: [
      { label: "Invest in prep", sub: "$3,000 \u2192 priority on next Government contract", apply: (g) => {
        if (g.cash >= 3e3) {
          g.cash -= 3e3;
          g.expenses += 3e3;
          g._govtPriority = true;
          addLog2(g, "\u{1F3DB}\uFE0F Invested in government prep \u2014 priority access on next Gov contract.");
          addImportantNotice(g, "Government contract tip: $3,000 invested \u2014 priority bid access unlocked.", "green");
        }
      } },
      { label: "Skip it", sub: "Save your cash", apply: (g) => {
        addImportantNotice(g, "Government contract tip declined.", "neutral");
      } }
    ]
  },
  {
    id: "competitor_acquisition",
    title: "\u{1F91D} Acquisition Offer",
    tone: "orange",
    desc: "Northwest Contractors is in financial trouble. You can acquire them for $160,000 \u2014 absorbing their 3 crew and 1 machine.",
    options: [
      { label: "Acquire them", sub: "$160,000 \u2192 3 workers + 1 machine + rep boost", apply: (g) => {
        if (g.cash >= 16e4) {
          g.cash -= 16e4;
          g.expenses += 16e4;
          for (let i = 0; i < 3; i++) {
            const w = createWorker();
            w.skill = rand2(90, 110);
            w.hireDay = g.day;
            g.crew.push(w);
          }
          const acquiredMachine = createEquipment(EQUIPMENT_SHOP[1] || EQUIPMENT_SHOP[0]);
          acquiredMachine.condition = rand2(60, 80);
          acquiredMachine.name = "Acquired " + acquiredMachine.name;
          g.equipment = g.equipment || [];
          g.equipment.push(acquiredMachine);
          g.reputation = Math.min(100, (g.reputation || 0) + 5);
          if (!(g.acquiredRivals || []).includes("northwest")) g.acquiredRivals = [...g.acquiredRivals || [], "northwest"];
          addLog2(g, "\u{1F91D} Acquired Northwest Contractors \u2014 3 crew, 1 machine absorbed!");
          addImportantNotice(g, "Rival acquired! +3 crew, +1 equipment, +5 reputation.", "green");
        }
      } },
      { label: "Pass", sub: "Not the right time", apply: (g) => {
        addImportantNotice(g, "Acquisition passed \u2014 not the right time.", "neutral");
      } }
    ]
  },
  {
    id: "material_futures",
    title: "\u{1F4CA} Material Futures",
    tone: "yellow",
    desc: "Lock in today's steel price for 30 days by pre-paying $8,000. Protects against market volatility.",
    options: [
      { label: "Lock in steel price", sub: "$8,000 \u2192 steel price frozen for 30 days", apply: (g) => {
        if (g.cash >= 8e3) {
          g.cash -= 8e3;
          g.expenses += 8e3;
          g._steelPriceLock = (g.day || 1) + 30;
          g._steelPriceLocked = g.materialPrices.steel || 950;
          addLog2(g, "\u{1F4CA} Steel price locked for 30 days \u2014 protected from volatility.");
          addImportantNotice(g, "Steel price locked for 30 days \u2014 protected from market spikes.", "green");
        }
      } },
      { label: "Skip the hedge", sub: "Take your chances", apply: (g) => {
        addImportantNotice(g, "Material futures declined \u2014 steel price exposed to market.", "neutral");
      } }
    ]
  },
  {
    id: "training_grant",
    title: "\u{1F393} Government Grant",
    tone: "green",
    desc: "A regional skills grant offers to fund $10,000 worth of crew training. Accept or lose the allocation.",
    options: [
      { label: "Accept the grant", sub: "+$10,000 training credit", apply: (g) => {
        g.cash += 1e4;
        addLog2(g, "\u{1F393} Government training grant accepted \u2014 $10,000 added to operating funds.");
        addImportantNotice(g, "Training grant received: $10,000 added to cash.", "green");
      } },
      { label: "Decline", sub: "Someone else gets it", apply: (g) => {
        addImportantNotice(g, "Training grant declined \u2014 someone else takes it.", "neutral");
      } }
    ]
  },
  {
    id: "insurance_payout",
    title: "Insurance Payout Offer",
    tone: "opportunity",
    desc: "Your insurer is offering a one-time payout of $40,000 in exchange for raising your deductible by 50%. Accept?",
    options: [
      { label: "Accept Payout (+$40k, higher deductible)", sub: "Immediate cash, but incidents cost more.", apply: (g) => {
        g.cash = (g.cash || 0) + 4e4;
        g.insuranceDeductibleMult = (g.insuranceDeductibleMult || 1) * 1.5;
        addLog2(g, "\u{1F4B0} Insurance payout accepted \u2014 $40k received.");
        addImportantNotice(g, "Insurance payout: $40,000 received \u2014 deductible raised 50%.", "green");
      } },
      { label: "Decline (keep current terms)", sub: "No change.", apply: (g) => {
        addLog2(g, "Insurance terms unchanged.");
        addImportantNotice(g, "Insurance payout declined \u2014 terms unchanged.", "neutral");
      } }
    ]
  },
  {
    id: "local_government_grant",
    title: "Government Infrastructure Grant",
    tone: "opportunity",
    desc: "The city is offering a $50,000 construction grant for infrastructure work. Requires completing 1 road/bridge contract within 60 days.",
    options: [
      { label: "Apply for Grant (+$50k on completion)", sub: "Must complete an infrastructure contract in 60 days.", apply: (g) => {
        g.activeGrant = { type: "infrastructure", reward: 5e4, deadline: (g.day || 0) + 60 };
        addLog2(g, "\u{1F4CB} Infrastructure grant applied \u2014 complete a road or bridge contract within 60 days for $50k.");
        addImportantNotice(g, "Government grant active \u2014 earn $50,000 bonus on next infrastructure job.", "green");
      } },
      { label: "Pass on This Offer", sub: "No obligation.", apply: (g) => {
        addLog2(g, "Government grant declined.");
        addImportantNotice(g, "Government grant declined.", "neutral");
      } }
    ]
  },
  {
    id: "corner_cut",
    title: "\u2702\uFE0F Client Wants to Cut Corners",
    tone: "red",
    desc: "Your client is asking you to skip a safety check to finish 2 days early. Saves time, but increases your liability.",
    options: [
      { label: "Agree \u2014 skip the check", sub: "Site +15% speed \xB7 safety -8 \xB7 risk of fine", apply: (g) => {
        const site = (g.activeSites || []).find((s) => s.status === "Active");
        if (site) site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + 15);
        g.safetyScore = Math.max(0, (g.safetyScore || 60) - 8);
        if (Math.random() < 0.25) {
          g.cash -= 2e3;
          g.expenses += 2e3;
          addImportantNotice(g, "Safety shortcut backfired \u2014 $2,000 inspector fine!", "red");
        } else addImportantNotice(g, "Corner cut \u2014 faster progress, lower safety score.", "orange");
        addLog2(g, "\u2702\uFE0F Safety check skipped to speed up delivery.");
      } },
      { label: "Refuse professionally", sub: "No impact \xB7 rep +2", apply: (g) => {
        g.reputation = Math.min(100, (g.reputation || 0) + 2);
        addImportantNotice(g, "Refused to cut corners \u2014 reputation +2 for doing it right.", "green");
        addLog2(g, "\u2705 Refused to skip safety check \u2014 reputation +2.");
      } },
      { label: "Extend deadline 1 day", sub: "No penalty \xB7 safety maintained", apply: (g) => {
        const site = (g.activeSites || []).find((s) => s.status === "Active");
        if (site) site.deadlineDay = (site.deadlineDay || g.day) + 1;
        addImportantNotice(g, "Deadline extended 1 day \u2014 safety maintained.", "green");
        addLog2(g, "\u{1F4CB} Deadline extended 1 day to maintain safety standards.");
      } }
    ]
  },
  {
    id: "foreman_ultimatum",
    title: "\u{1F4BC} Foreman Demands a Raise or Quits",
    tone: "orange",
    desc: "Your most experienced crew member issued an ultimatum: 20% raise or they're leaving for a competitor.",
    options: [
      { label: "Grant the 20% raise", sub: "Wage +20% \xB7 loyalty +10", apply: (g) => {
        const w = [...g.crew || []].sort((a, b) => (b.jobsCompleted || 0) - (a.jobsCompleted || 0))[0];
        if (w) {
          w.wagePerDay = Math.round(w.wagePerDay * 1.2);
          w.loyalty = Math.min(100, (w.loyalty ?? 50) + 10);
          addLog2(g, `\u{1F4BC} ${w.name} got their 20% raise \u2014 staying loyal.`);
          addImportantNotice(g, `${w.name} got their raise \u2014 loyalty +10.`, "green");
        }
      } },
      { label: "Negotiate 10% raise", sub: "Wage +10% \xB7 loyalty +2 \xB7 mood -5", apply: (g) => {
        const w = [...g.crew || []].sort((a, b) => (b.jobsCompleted || 0) - (a.jobsCompleted || 0))[0];
        if (w) {
          w.wagePerDay = Math.round(w.wagePerDay * 1.1);
          w.loyalty = Math.min(100, (w.loyalty ?? 50) + 2);
          w.mood = Math.max(0, (w.mood ?? 50) - 5);
          addLog2(g, `\u{1F4BC} ${w.name} accepted 10% compromise.`);
          addImportantNotice(g, `${w.name} accepted partial raise.`, "orange");
        }
      } },
      { label: "Let them go", sub: "Worker leaves \xB7 rep -1", apply: (g) => {
        const w = [...g.crew || []].sort((a, b) => (b.jobsCompleted || 0) - (a.jobsCompleted || 0))[0];
        if (w) {
          g.crew = g.crew.filter((c) => c.id !== w.id);
          g.reputation = Math.max(0, (g.reputation || 0) - 1);
          addLog2(g, `\u{1F44B} ${w.name} left after demands were rejected.`);
          addImportantNotice(g, `${w.name} walked out \u2014 rep -1.`, "red");
        }
      } }
    ]
  },
  {
    id: "inspector_violation",
    title: "\u{1F6A8} Inspector Found a Violation",
    tone: "red",
    desc: "An inspector flagged a safety issue on your active site. You can fix it properly, pay a fine, or contest it.",
    options: [
      { label: "Fix it properly", sub: "-$1,500 \xB7 safety +5 \xB7 site paused 2 days", apply: (g) => {
        g.cash -= 1500;
        g.expenses += 1500;
        g.weeklyStats.expenses += 1500;
        g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 1500;
        g.safetyScore = Math.min(100, (g.safetyScore || 60) + 5);
        const site = (g.activeSites || []).find((s) => s.status === "Active");
        if (site) site.pausedDays = (site.pausedDays || 0) + 2;
        addLog2(g, "\u{1F527} Violation fixed properly \u2014 $1,500, site paused 2 days, safety +5.");
        addImportantNotice(g, "Violation fixed \u2014 safety +5. Site resumes in 2 days.", "green");
      } },
      { label: "Pay the fine and continue", sub: "-$3,000 \xB7 safety -2", apply: (g) => {
        g.cash -= 3e3;
        g.expenses += 3e3;
        g.weeklyStats.expenses += 3e3;
        g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 3e3;
        g.safetyScore = Math.max(0, (g.safetyScore || 60) - 2);
        addLog2(g, "\u{1F4B8} Paid $3,000 fine and continued \u2014 safety -2.");
        addImportantNotice(g, "Violation fine paid \u2014 $3,000. Site continues but safety docked.", "orange");
      } },
      { label: "Contest the violation", sub: "50% waived \xB7 50% doubled to $6,000", apply: (g) => {
        if (Math.random() < 0.5) {
          addLog2(g, "\u2705 Violation contested \u2014 fine waived.");
          addImportantNotice(g, "Inspection contested \u2014 violation overturned!", "green");
        } else {
          g.cash -= 6e3;
          g.expenses += 6e3;
          g.weeklyStats.expenses += 6e3;
          g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 6e3;
          addLog2(g, "\u274C Contested and lost \u2014 doubled fine of $6,000.");
          addImportantNotice(g, "Contest failed \u2014 $6,000 fine applied.", "red");
        }
      } }
    ]
  },
  {
    id: "emergency_job",
    title: "\u{1F6A8} Emergency Project Offer",
    tone: "green",
    desc: "A developer just called \u2014 a competitor dropped out and they need someone to start a $45,000 job tomorrow. Tight 5-day deadline.",
    options: [
      { label: "Take the emergency job", sub: "~$45k contract added \xB7 5-day deadline", apply: (g) => {
        const c = createContract(g);
        c.value = Math.round(45e3 * computeInflation(g));
        c.deadline = g.day + 5;
        c.expiresDay = g.day + 2;
        c.penaltyPerDay = Math.round(c.value * 0.06);
        c.label = "\u{1F6A8} Emergency: " + c.label;
        g.contracts.push(c);
        addLog2(g, "\u{1F6A8} Emergency contract added \u2014 $45k, 5-day window.");
        addImportantNotice(g, "Emergency contract available! Tight deadline \u2014 check Bids.", "orange");
      } },
      { label: "Stay the course", sub: "Rep +1 \u2014 you're reliable", apply: (g) => {
        g.reputation = Math.min(100, (g.reputation || 0) + 1);
        addLog2(g, "\u2705 Declined emergency job \u2014 focused on current commitments. Rep +1.");
        addImportantNotice(g, "Emergency job declined \u2014 clients respect your focus. Rep +1.", "green");
      } }
    ]
  },
  {
    id: "union_rep",
    title: "\u{1F91D} Union Representative Visits",
    tone: "orange",
    desc: "A labor organizer is on your site talking to crew. How you respond will shape morale and wages.",
    options: [
      { label: "Engage cooperatively", sub: "All wages +$15/day \xB7 loyalty +8 \xB7 mood +10", apply: (g) => {
        for (const w of g.crew || []) {
          w.wagePerDay = (w.wagePerDay || 120) + 15;
          w.loyalty = Math.min(100, (w.loyalty ?? 50) + 8);
          w.mood = Math.min(100, (w.mood ?? 50) + 10);
        }
        addLog2(g, "\u{1F91D} Cooperative with union \u2014 wages +$15/day, morale boosted.");
        addImportantNotice(g, "Union engagement positive \u2014 crew morale and loyalty up.", "green");
      } },
      { label: "Disclaim any issues", sub: "No change, 25% chance mood -5 all", apply: (g) => {
        if (Math.random() < 0.25) {
          for (const w of g.crew || []) {
            w.mood = Math.max(0, (w.mood ?? 50) - 5);
          }
          addImportantNotice(g, "Workers not convinced \u2014 crew mood slightly down.", "orange");
          addLog2(g, "\u{1F615} Crew not satisfied with response \u2014 mood -5 each.");
        } else {
          addImportantNotice(g, "Crew accepted the response \u2014 no change.", "neutral");
          addLog2(g, "Union rep visit \u2014 no change.");
        }
      } },
      { label: "Block them from the site", sub: "Loyalty -5 all \xB7 mood -8 all \xB7 rep -1", apply: (g) => {
        for (const w of g.crew || []) {
          w.loyalty = Math.max(0, (w.loyalty ?? 50) - 5);
          w.mood = Math.max(0, (w.mood ?? 50) - 8);
        }
        g.reputation = Math.max(0, (g.reputation || 0) - 1);
        addLog2(g, "\u{1F6AB} Union blocked \u2014 crew loyalty and morale damaged.");
        addImportantNotice(g, "Union blocked \u2014 crew loyalty -5, mood -8 each. Rep -1.", "red");
      } }
    ]
  },
  {
    id: "subcontractor_dispute",
    title: "\u26A0\uFE0F Subcontractor Dispute",
    tone: "orange",
    desc: "Your subcontractor crew is threatening to walk off the job over a payment dispute.",
    options: [
      { label: "Pay dispute settlement", sub: "-$2,500 \xB7 subs stay on site", apply: (g) => {
        g.cash -= 2500;
        g.expenses += 2500;
        g.weeklyStats.expenses += 2500;
        g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 2500;
        addLog2(g, "\u{1F4B8} Subcontractor dispute settled \u2014 $2,500 paid, work continues.");
        addImportantNotice(g, "Subcontractor settled for $2,500 \u2014 site stays on track.", "orange");
      } },
      { label: "Negotiate", sub: "60% resolve for $1,000 \u2014 40% walkoff", apply: (g) => {
        if (Math.random() < 0.6) {
          g.cash -= 1e3;
          g.expenses += 1e3;
          addLog2(g, "\u2705 Negotiated sub dispute for $1,000.");
          addImportantNotice(g, "Negotiation success \u2014 $1,000 paid, work continues.", "green");
        } else {
          const site = (g.activeSites || []).find((s) => s.status === "Active");
          if (site) site.pausedDays = (site.pausedDays || 0) + 3;
          addLog2(g, "\u274C Negotiations failed \u2014 subs walked off. Site paused 3 days.");
          addImportantNotice(g, "Subs walked off \u2014 site paused 3 days.", "red");
        }
      } },
      { label: "Let them walk", sub: "Site paused 3 days \xB7 no cost", apply: (g) => {
        const site = (g.activeSites || []).find((s) => s.status === "Active");
        if (site) site.pausedDays = (site.pausedDays || 0) + 3;
        if ((g.subcontractors || []).length > 0) g.subcontractors = g.subcontractors.slice(1);
        addLog2(g, "\u{1F6AA} Subcontractors walked off \u2014 site paused 3 days.");
        addImportantNotice(g, "Subs walked \u2014 site paused 3 days. Find a replacement.", "red");
      } }
    ]
  },
  {
    id: "delay_regulatory",
    title: "\u{1F4DC} Regulatory Hold",
    tone: "yellow",
    desc: "Inspectors have flagged this site for a compliance review.",
    options: [
      { label: "Wait It Out", sub: "Pause and pay compliance fee", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites || []).find((s) => s.id === pd.siteId);
        if (site) {
          site.status = "Paused";
          site.pausedDays = (site.pausedDays || 0) + (pd.delayDays || 5);
        }
        g.cash -= pd.fine || 1e3;
        g.expenses = (g.expenses || 0) + (pd.fine || 1e3);
        addLog2(g, `\u{1F4DC} Regulatory hold accepted \u2014 ${money2(pd.fine || 1e3)} paid, site paused ${pd.delayDays || 5} days.`);
        addImportantNotice(g, `Site paused ${pd.delayDays || 5} days for regulatory hold. ${money2(pd.fine || 1e3)} paid.`, "orange");
      } },
      { label: "Expedite Process", sub: "Pay extra to reduce delay", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites || []).find((s) => s.id === pd.siteId);
        const totalCost = (pd.fine || 1e3) + (pd.expediteCost || 500);
        const reducedDays = Math.ceil((pd.delayDays || 5) / 2);
        if (g.cash >= totalCost) {
          if (site) {
            site.status = "Paused";
            site.pausedDays = (site.pausedDays || 0) + reducedDays;
          }
          g.cash -= totalCost;
          g.expenses = (g.expenses || 0) + totalCost;
          addLog2(g, `\u{1F4DC} Expedited regulatory process \u2014 ${money2(totalCost)} paid, only ${reducedDays} day pause.`);
          addImportantNotice(g, `Expedited review: ${money2(totalCost)} paid, hold cut to ${reducedDays} days.`, "orange");
        } else {
          if (site) {
            site.status = "Paused";
            site.pausedDays = (site.pausedDays || 0) + (pd.delayDays || 5);
          }
          g.cash -= pd.fine || 1e3;
          g.expenses = (g.expenses || 0) + (pd.fine || 1e3);
          addLog2(g, `\u{1F4DC} Not enough cash to expedite \u2014 paid ${money2(pd.fine || 1e3)}, full delay applied.`);
          addImportantNotice(g, `Not enough cash to expedite \u2014 full delay applied.`, "red");
        }
      } },
      { label: "Premium Resolution", sub: "High cost, chance to eliminate delay", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites || []).find((s) => s.id === pd.siteId);
        const totalCost = (pd.fine || 1e3) + (pd.premiumCost || 800);
        if (g.cash >= totalCost) {
          g.cash -= totalCost;
          g.expenses = (g.expenses || 0) + totalCost;
          if (Math.random() < 0.7) {
            addLog2(g, `\u{1F4DC} Premium resolution succeeded \u2014 regulatory hold cleared! Cost: ${money2(totalCost)}.`);
            addImportantNotice(g, `Premium push worked \u2014 hold cleared! ${money2(totalCost)} paid.`, "green");
          } else {
            if (site) {
              site.status = "Paused";
              site.pausedDays = (site.pausedDays || 0) + 1;
            }
            addLog2(g, `\u{1F4DC} Premium resolution partially worked \u2014 ${money2(totalCost)} paid, 1-day minimum hold.`);
            addImportantNotice(g, `Premium didn't fully clear \u2014 1-day hold remains. ${money2(totalCost)} paid.`, "orange");
          }
        } else {
          if (site) {
            site.status = "Paused";
            site.pausedDays = (site.pausedDays || 0) + (pd.delayDays || 5);
          }
          g.cash -= pd.fine || 1e3;
          g.expenses = (g.expenses || 0) + (pd.fine || 1e3);
          addLog2(g, `\u{1F4DC} Insufficient funds for premium \u2014 ${money2(pd.fine || 1e3)} paid, full delay applied.`);
          addImportantNotice(g, `Insufficient funds for premium \u2014 full delay applied.`, "red");
        }
      } }
    ]
  },
  {
    id: "delay_permit",
    title: "\u{1F4CB} Permit Review Delay",
    tone: "yellow",
    desc: "The city requires additional paperwork before work can proceed.",
    options: [
      { label: "Accept the Delay", sub: "Lose progress and reputation", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites || []).find((s) => s.id === pd.siteId);
        if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - (pd.progressLoss || 8));
        g.reputation = Math.max(0, (g.reputation || 0) - 1);
        addLog2(g, `\u{1F4CB} Permit delay accepted \u2014 ${pd.progressLoss || 8}% progress lost, rep -1.`);
        addImportantNotice(g, `Permit delay: ${pd.progressLoss || 8}% progress lost, rep -1.`, "orange");
      } },
      { label: "Expedite Paperwork", sub: "Pay to reduce progress loss", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites || []).find((s) => s.id === pd.siteId);
        const cost = pd.expediteCost || 400;
        const halfLoss = Math.ceil((pd.progressLoss || 8) / 2);
        if (g.cash >= cost) {
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - halfLoss);
          g.cash -= cost;
          g.expenses = (g.expenses || 0) + cost;
          addLog2(g, `\u{1F4CB} Expedited permit \u2014 ${money2(cost)} paid, only ${halfLoss}% progress lost.`);
          addImportantNotice(g, `Paid ${money2(cost)} to halve permit delay \u2014 ${halfLoss}% progress lost.`, "orange");
        } else {
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - (pd.progressLoss || 8));
          g.reputation = Math.max(0, (g.reputation || 0) - 1);
          addLog2(g, `\u{1F4CB} Insufficient funds to expedite \u2014 full ${pd.progressLoss || 8}% progress lost.`);
          addImportantNotice(g, `Not enough cash to expedite \u2014 full permit delay applied.`, "red");
        }
      } },
      { label: "Premium Resolution", sub: "Pay more for 80% chance to skip", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites || []).find((s) => s.id === pd.siteId);
        const cost = pd.premiumCost || 800;
        if (g.cash >= cost) {
          g.cash -= cost;
          g.expenses = (g.expenses || 0) + cost;
          if (Math.random() < 0.8) {
            addLog2(g, `\u{1F4CB} Premium filing succeeded \u2014 permit delay cleared! Cost: ${money2(cost)}.`);
            addImportantNotice(g, `Paid ${money2(cost)} \u2014 permit cleared!`, "green");
          } else {
            if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - Math.ceil((pd.progressLoss || 8) / 3));
            addLog2(g, `\u{1F4CB} Premium filing helped \u2014 ${money2(cost)} paid, minimal progress lost.`);
            addImportantNotice(g, `Premium helped but didn't fully clear \u2014 ${money2(cost)} paid, minimal loss.`, "orange");
          }
        } else {
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - (pd.progressLoss || 8));
          g.reputation = Math.max(0, (g.reputation || 0) - 1);
          addLog2(g, `\u{1F4CB} Insufficient funds for premium \u2014 full permit delay applied.`);
          addImportantNotice(g, `Not enough cash for premium \u2014 full permit delay applied.`, "red");
        }
      } }
    ]
  }
];
var EMPLOYEE_EVENTS = [
  // ── Negative ────────────────────────────────────────────────────────────────
  {
    id: "emp_sick",
    title: "\u{1F912} Employee Called Off Sick",
    tone: "orange",
    desc: "A crew member called in sick. Site progress will slow unless you act.",
    options: [
      {
        label: "Hire a day worker to cover",
        sub: "-$350 \xB7 site keeps moving",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          g.cash -= 350;
          g.expenses += 350;
          addLog2(g, `\u{1F912} ${w?.name || "Crew"} called off \u2014 temp covered for $350.`);
          addImportantNotice(g, `${w?.name || "Crew member"} sick \u2014 temp hired for $350, site on track.`, "orange");
        }
      },
      {
        label: "Run short-handed",
        sub: "Progress -4% \xB7 no cost",
        apply: (g) => {
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - 4);
          addLog2(g, `\u{1F912} ${w?.name || "Crew"} absent \u2014 short-handed today.`);
          addImportantNotice(g, `${w?.name || "Crew member"} absent \u2014 site running short, 4% progress lost.`, "orange");
        }
      },
      {
        label: "Paid sick day",
        sub: "-day's wages \xB7 loyalty +10",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          if (w) {
            g.cash -= w.wagePerDay || 20;
            g.expenses += w.wagePerDay || 20;
            w.loyalty = Math.min(100, (w.loyalty ?? 50) + 10);
            addLog2(g, `\u{1F912} ${w.name} given paid sick day \u2014 loyalty up.`);
            addImportantNotice(g, `${w.name} given paid sick day \u2014 loyalty +10.`, "green");
          }
        }
      }
    ]
  },
  {
    id: "emp_vehicle_damage",
    title: "\u{1F697} Vehicle Damaged on Site",
    tone: "red",
    desc: "An employee accidentally damaged a vehicle on site. You need to decide how to handle it.",
    options: [
      {
        label: "Repair on-site now",
        sub: "-$600 \xB7 vehicle condition -15",
        apply: (g) => {
          const e = (g.equipment || []).find((eq) => eq.id === g.pendingDecision?.context?.equipId);
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          g.cash -= 600;
          g.expenses += 600;
          if (e) e.condition = Math.max(20, e.condition - 15);
          addLog2(g, `\u{1F697} ${w?.name || "Worker"} damaged a vehicle \u2014 repaired for $600.`);
          addImportantNotice(g, `Vehicle repaired on-site for $600. Condition reduced.`, "orange");
        }
      },
      {
        label: "Dock their pay for damages",
        sub: "Recovers $150 \xB7 loyalty -15",
        apply: (g) => {
          const e = (g.equipment || []).find((eq) => eq.id === g.pendingDecision?.context?.equipId);
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          if (w) {
            g.cash += 150;
            w.loyalty = Math.max(0, (w.loyalty ?? 50) - 15);
          }
          if (e) e.condition = Math.max(20, e.condition - 25);
          addLog2(g, `\u{1F697} ${w?.name || "Worker"} docked for vehicle damage.`);
          addImportantNotice(g, `${w?.name || "Worker"} docked $150 for vehicle damage \u2014 loyalty -15.`, "orange");
        }
      },
      {
        label: "Write it off as wear and tear",
        sub: "Vehicle condition -25 \xB7 no cost",
        apply: (g) => {
          const e = (g.equipment || []).find((eq) => eq.id === g.pendingDecision?.context?.equipId);
          if (e) e.condition = Math.max(15, e.condition - 25);
          addLog2(g, `\u{1F697} Vehicle damage written off as site wear.`);
          addImportantNotice(g, `Vehicle damage written off \u2014 condition -25.`, "orange");
        }
      }
    ]
  },
  {
    id: "emp_quits",
    title: "\u{1F624} Employee Quit Without Notice",
    tone: "red",
    desc: "A crew member walked off the job without warning. You need to replace them quickly.",
    options: [
      {
        label: "Emergency temp hire",
        sub: "-$800 \xB7 site stays staffed",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          if (w) {
            if (site) site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== w.id);
            g.crew = g.crew.filter((c) => c.id !== w.id);
          }
          g.cash -= 800;
          g.expenses += 800;
          addLog2(g, `\u{1F624} ${w?.name || "Worker"} quit \u2014 emergency temp hired for $800.`);
          addImportantNotice(g, `${w?.name || "Worker"} quit \u2014 emergency temp hired for $800.`, "orange");
        }
      },
      {
        label: "Reassign remaining crew",
        sub: "Progress -5% \xB7 no cost",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          if (w) {
            if (site) {
              site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== w.id);
              site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - 5);
            }
            g.crew = g.crew.filter((c) => c.id !== w.id);
          }
          addLog2(g, `\u{1F624} ${w?.name || "Worker"} quit \u2014 remaining crew redistributed.`);
          addImportantNotice(g, `${w?.name || "Worker"} quit \u2014 crew redistributed, 5% progress lost.`, "red");
        }
      }
    ]
  },
  {
    id: "emp_theft",
    title: "\u{1F513} Theft Suspected on Site",
    tone: "red",
    desc: "A crew member is suspected of stealing materials worth about $900. How do you handle it?",
    options: [
      {
        label: "Fire them immediately",
        sub: "Lumber -8 \xB7 reputation -1",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          const matLoss = Math.min(g.materials?.lumber || 0, 8);
          if (matLoss > 0) g.materials.lumber -= matLoss;
          g.reputation = Math.max(0, (g.reputation || 0) - 1);
          if (w) {
            if (site) site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== w.id);
            g.crew = g.crew.filter((c) => c.id !== w.id);
          }
          addLog2(g, `\u{1F513} ${w?.name || "Worker"} fired for theft. Materials lost.`);
          addImportantNotice(g, `${w?.name || "Worker"} fired for theft \u2014 8 lumber lost, rep -1.`, "red");
        }
      },
      {
        label: "Formal warning, add site security",
        sub: "-$400 security \xB7 loyalty -20",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          g.cash -= 400;
          g.expenses += 400;
          if (w) w.loyalty = Math.max(0, (w.loyalty ?? 50) - 20);
          addLog2(g, `\u{1F513} Theft warning issued. $400 in site security added.`);
          addImportantNotice(g, `Theft warning issued \u2014 $400 security added, ${w?.name || "worker"} loyalty -20.`, "orange");
        }
      }
    ]
  },
  {
    id: "emp_delay",
    title: "\u{1F550} Worker Caused a Setback",
    tone: "orange",
    desc: "A crew member made a sequencing error, forcing the team to redo part of the current phase.",
    options: [
      {
        label: "Address calmly, retrain on the spot",
        sub: "Progress -5% \xB7 skill +2",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - 5);
          if (w) w.skill = Math.min(150, (w.skill || 50) + 2);
          addLog2(g, `\u{1F550} ${w?.name || "Worker"} retrained after causing a delay.`);
          addImportantNotice(g, `${w?.name || "Worker"} retrained \u2014 skill +2, 5% progress lost.`, "orange");
        }
      },
      {
        label: "Dock pay and issue warning",
        sub: "Progress -5% \xB7 loyalty -10",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          const dock = w?.wagePerDay || 20;
          g.cash += dock;
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - 5);
          if (w) w.loyalty = Math.max(0, (w.loyalty ?? 50) - 10);
          addLog2(g, `\u{1F550} ${w?.name || "Worker"} docked pay for causing delay.`);
          addImportantNotice(g, `${w?.name || "Worker"} docked pay \u2014 loyalty -10, 5% progress lost.`, "orange");
        }
      }
    ]
  },
  // ── Positive ────────────────────────────────────────────────────────────────
  {
    id: "emp_overtime",
    title: "\u{1F4AA} Employee Worked Overtime",
    tone: "green",
    desc: "A crew member stayed late without being asked and pushed the site forward. How do you respond?",
    options: [
      {
        label: "Pay them for the overtime",
        sub: "-$120 \xB7 progress +8% \xB7 loyalty +15",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          g.cash -= 120;
          g.expenses += 120;
          if (site) site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + 8);
          if (w) w.loyalty = Math.min(100, (w.loyalty ?? 50) + 15);
          addLog2(g, `\u{1F4AA} ${w?.name || "Worker"} paid for overtime \u2014 great progress.`);
          addImportantNotice(g, `${w?.name || "Worker"} paid $120 overtime \u2014 progress +8%, loyalty +15.`, "green");
        }
      },
      {
        label: "Say thanks \u2014 no extra pay",
        sub: "Progress +8% \xB7 loyalty -5",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          if (site) site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + 8);
          if (w) w.loyalty = Math.max(0, (w.loyalty ?? 50) - 5);
          addLog2(g, `\u{1F4AA} ${w?.name || "Worker"} worked overtime unpaid.`);
          addImportantNotice(g, `${w?.name || "Worker"} worked overtime unpaid \u2014 progress +8%, loyalty -5.`, "orange");
        }
      }
    ]
  },
  {
    id: "emp_saves_delay",
    title: "\u{1F6E1}\uFE0F Employee Prevented a Delay",
    tone: "green",
    desc: "Quick thinking by a crew member caught an issue before it became costly.",
    options: [
      {
        label: "Publicly recognize the good work",
        sub: "All crew loyalty +5 \xB7 top worker +10",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          (g.crew || []).forEach((c) => c.loyalty = Math.min(100, (c.loyalty ?? 50) + 5));
          if (w) w.loyalty = Math.min(100, (w.loyalty ?? 50) + 10);
          addLog2(g, `\u{1F6E1}\uFE0F ${w?.name || "Worker"} praised for preventing a delay \u2014 team morale up.`);
          addImportantNotice(g, `${w?.name || "Worker"} praised \u2014 all crew loyalty +5, ${w?.name || "worker"} +10.`, "green");
        }
      },
      {
        label: "Note it, move on",
        sub: "Progress +5%",
        apply: (g) => {
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          if (site) site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + 5);
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          addLog2(g, `\u{1F6E1}\uFE0F ${w?.name || "Worker"} caught an issue early.`);
          addImportantNotice(g, `${w?.name || "Worker"} caught an issue early \u2014 progress +5%.`, "green");
        }
      }
    ]
  },
  {
    id: "emp_cheap_materials",
    title: "\u{1F4B0} Employee Found Cheaper Materials",
    tone: "cyan",
    desc: "A crew member sourced an alternate supplier offering lumber 25% below market price.",
    options: [
      {
        label: "Buy 30 units at the discount",
        sub: "Costs ~25% below normal rate",
        apply: (g) => {
          const price = Math.round((g.materialPrices?.lumber || 85) * 0.75 * 30);
          if (g.cash >= price) {
            g.cash -= price;
            g.expenses += price;
            g.materials.lumber = (g.materials.lumber || 0) + 30;
            addLog2(g, `\u{1F4B0} Bulk lumber at 25% off \u2014 30 units for ${money2(price)}.`);
            addImportantNotice(g, `30 lumber purchased at 25% off for ${money2(price)}.`, "green");
          } else {
            addLog2(g, `\u{1F4B0} Couldn't afford the bulk discount this time.`);
            addImportantNotice(g, `Not enough cash for bulk lumber discount.`, "red");
          }
        }
      },
      {
        label: "Pass for now",
        sub: "No action",
        apply: (g) => {
          addLog2(g, `\u{1F4B0} Discounted materials offer declined.`);
          addImportantNotice(g, `Discounted lumber offer declined.`, "neutral");
        }
      }
    ]
  },
  {
    id: "emp_morale_boost",
    title: "\u{1F389} Crew Morale Is High",
    tone: "green",
    desc: "A crew member organized an impromptu team lunch. Spirits are up across the site.",
    options: [
      {
        label: "Kick in $200 to cover the crew",
        sub: "-$200 \xB7 all loyalty +15",
        apply: (g) => {
          g.cash -= 200;
          g.expenses += 200;
          (g.crew || []).forEach((c) => c.loyalty = Math.min(100, (c.loyalty ?? 50) + 15));
          addLog2(g, `\u{1F389} You covered team lunch \u2014 crew loyalty up significantly.`);
          addImportantNotice(g, `You covered team lunch ($200) \u2014 all crew loyalty +15.`, "green");
        }
      },
      {
        label: "Let it happen naturally",
        sub: "All loyalty +5",
        apply: (g) => {
          (g.crew || []).forEach((c) => c.loyalty = Math.min(100, (c.loyalty ?? 50) + 5));
          addLog2(g, `\u{1F389} Team morale boosted naturally today.`);
          addImportantNotice(g, `Team morale boost \u2014 all crew loyalty +5.`, "green");
        }
      }
    ]
  },
  {
    id: "emp_early_phase",
    title: "\u26A1 Phase Completed Early",
    tone: "green",
    desc: "A crew member organized the team efficiently and the current phase wrapped ahead of schedule.",
    options: [
      {
        label: "Push straight to the next phase",
        sub: "Progress +10%",
        apply: (g) => {
          const site = (g.activeSites || []).find((s) => s.id === g.pendingDecision?.context?.siteId);
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          if (site) site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + 10);
          addLog2(g, `\u26A1 ${w?.name || "Worker"} led early phase completion \u2014 ahead of schedule.`);
          addImportantNotice(g, `Phase completed early! Progress +10% \u2014 ahead of schedule.`, "green");
        }
      }
    ]
  },
  {
    id: "emp_referral",
    title: "\u{1F4CB} Employee Brought in a Lead",
    tone: "cyan",
    desc: "A crew member's contact needs construction work done. A new contract has been added to your Bids.",
    options: [
      {
        label: "Great \u2014 thanks!",
        sub: "New contract added \xB7 loyalty +8",
        apply: (g) => {
          const w = (g.crew || []).find((c) => c.id === g.pendingDecision?.context?.workerId);
          if (w) w.loyalty = Math.min(100, (w.loyalty ?? 50) + 8);
          const ref = createContract({ cash: g.cash, day: g.day, creditScore: g.creditScore || 600, marketState: g.marketState || "Normal", equipment: g.equipment || [], contracts: g.contracts || [], _milestones: g._milestones || {}, cityOffices: g.cityOffices || [], properties: g.properties || [] });
          if (ref) g.contracts.push(ref);
          addLog2(g, `\u{1F4CB} ${w?.name || "Worker"} brought in a referral \u2014 new contract available!`);
          addImportantNotice(g, `${w?.name || "Worker"} brought in a referral \u2014 new contract added to Bids!`, "green");
        }
      }
    ]
  }
];
var WEATHER_PATTERNS = {
  "Pacific Northwest": { rainProb: 0.35, snowProb: 0.05, heatProb: 0.05 },
  "Mountain West": { rainProb: 0.15, snowProb: 0.2, heatProb: 0.1 },
  "South Central": { rainProb: 0.2, snowProb: 0.01, heatProb: 0.25 },
  "Southwest": { rainProb: 0.08, snowProb: 0.01, heatProb: 0.35 }
};
var PHASE_VISUALS = {
  "Site Prep": { emoji: "\u{1F7EB}", desc: "Dirt lot" },
  "Demolition": { emoji: "\u{1F4A5}", desc: "Demo" },
  "Demo": { emoji: "\u{1F4A5}", desc: "Demo" },
  "Excavation": { emoji: "\u26CF\uFE0F", desc: "Digging" },
  "Foundation": { emoji: "\u{1F7E6}", desc: "Concrete poured" },
  "Piling": { emoji: "\u{1F529}", desc: "Piles driven" },
  "Framing": { emoji: "\u{1F3D7}\uFE0F", desc: "Frame up" },
  "Structure": { emoji: "\u{1F3D7}\uFE0F", desc: "Structure" },
  "Structural Steel": { emoji: "\u{1F529}", desc: "Steel erected" },
  "Roofing": { emoji: "\u{1F3DA}\uFE0F", desc: "Roof on" },
  "Exterior": { emoji: "\u{1F3E0}", desc: "Exterior done" },
  "Envelope": { emoji: "\u{1F3E0}", desc: "Enclosed" },
  "MEP": { emoji: "\u26A1", desc: "MEP works" },
  "MEP Rough": { emoji: "\u26A1", desc: "MEP rough-in" },
  "Interior": { emoji: "\u{1FAB5}", desc: "Interior" },
  "Finishes": { emoji: "\u{1F58C}\uFE0F", desc: "Finishes" },
  "Finishing": { emoji: "\u{1F58C}\uFE0F", desc: "Finishing" },
  "Fitout": { emoji: "\u{1F6CB}\uFE0F", desc: "Fitout" },
  "Facade": { emoji: "\u{1F3E2}", desc: "Facade" },
  "Core": { emoji: "\u{1F3D7}\uFE0F", desc: "Core" },
  "Deck": { emoji: "\u{1F309}", desc: "Deck" },
  "Barriers": { emoji: "\u{1F6A7}", desc: "Barriers" },
  "Surfacing": { emoji: "\u{1F6E3}\uFE0F", desc: "Surfacing" },
  "Patching": { emoji: "\u{1F6E0}\uFE0F", desc: "Patching" },
  "Seal": { emoji: "\u{1F6E3}\uFE0F", desc: "Sealed" },
  "Inspection": { emoji: "\u{1F50D}", desc: "Inspection" },
  "Final Inspection": { emoji: "\u2705", desc: "Final check" },
  "Commissioning": { emoji: "\u2705", desc: "Commissioning" },
  "Survey": { emoji: "\u{1F4D0}", desc: "Surveying" },
  "Material Delivery": { emoji: "\u{1F69A}", desc: "Materials on site" },
  "Post Installation": { emoji: "\u{1FAB5}", desc: "Posts in ground" },
  "Fence Assembly": { emoji: "\u{1F3D7}\uFE0F", desc: "Assembly" },
  "Base Layer": { emoji: "\u{1FAA8}", desc: "Base compacted" },
  "Paving": { emoji: "\u{1F6E3}\uFE0F", desc: "Asphalt laid" },
  "Striping": { emoji: "\u{1F3A8}", desc: "Line marking" },
  "Finish Work": { emoji: "\u{1F58C}\uFE0F", desc: "Finishing" },
  "Utilities": { emoji: "\u{1F50C}", desc: "Utilities" },
  "Cladding": { emoji: "\u{1F3E2}", desc: "Cladding" },
  "Waterproofing": { emoji: "\u{1F4A7}", desc: "Waterproofing" },
  "Landscaping": { emoji: "\u{1F33F}", desc: "Landscaping" }
};
var RIVAL_COMPANIES = [
  { id: "apex", name: "Apex Construction", aggression: 0.72, focus: "residential", startRep: 12 },
  { id: "summit", name: "Summit Builders", aggression: 0.55, focus: "commercial", startRep: 18 },
  { id: "ironpeak", name: "IronPeak Development", aggression: 0.64, focus: "infrastructure", startRep: 15 },
  { id: "northwest", name: "Northwest Contractors", aggression: 0.45, focus: "residential", startRep: 8 },
  { id: "pacific_group", name: "Pacific Group Co.", aggression: 0.8, focus: "commercial", startRep: 22 },
  { id: "western_build_co", name: "Western Build Co.", aggression: 0.6, focus: "residential", startRep: 4 },
  { id: "summit_construction", name: "Summit Construction", aggression: 0.8, focus: "commercial", startRep: 7 }
];
var MARKET_EVENTS = [
  {
    id: "housing_boom",
    label: "Housing Boom",
    icon: "\u{1F4C8}",
    ionicon: "trending-up",
    duration: 14,
    tone: "green",
    contractMult: 1.25,
    materialCostMult: 1,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Residential demand surges \u2014 contracts worth 25% more."
  },
  {
    id: "housing_crash",
    label: "Housing Market Crash",
    icon: "\u{1F4C9}",
    ionicon: "trending-down",
    duration: 10,
    tone: "red",
    contractMult: 0.72,
    materialCostMult: 1,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Residential market collapses \u2014 values drop 28%."
  },
  {
    id: "material_shortage",
    label: "Material Shortage",
    icon: "\u{1F4E6}",
    ionicon: "cube",
    duration: 8,
    tone: "orange",
    contractMult: 1,
    materialCostMult: 1.45,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Supply chain disruptions \u2014 material costs spike 45%."
  },
  {
    id: "infra_funding",
    label: "Infrastructure Stimulus",
    icon: "\u{1F3DB}\uFE0F",
    ionicon: "business",
    duration: 20,
    tone: "cyan",
    contractMult: 1.35,
    materialCostMult: 1,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Government funding boosts public works contracts 35%."
  },
  {
    id: "fuel_spike",
    label: "Fuel Price Spike",
    icon: "\u26FD",
    ionicon: "speedometer",
    duration: 10,
    tone: "orange",
    contractMult: 1,
    materialCostMult: 1,
    equipDailyCostMult: 1.32,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Energy costs surge \u2014 equipment daily costs up 32%."
  },
  {
    id: "construction_boom",
    label: "Construction Boom",
    icon: "\u{1F3D7}\uFE0F",
    ionicon: "construct",
    duration: 16,
    tone: "green",
    contractMult: 1.18,
    materialCostMult: 1.12,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "City-wide growth \u2014 more work and higher material demand."
  },
  {
    id: "recession_start",
    label: "Recession Begins",
    icon: "\u{1F311}",
    ionicon: "moon",
    duration: 30,
    tone: "red",
    contractMult: 0.6,
    materialCostMult: 0.85,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Economy contracts sharply. Fewer jobs available, but materials are cheaper."
  },
  {
    id: "interest_rate_hike",
    label: "Interest Rate Hike",
    icon: "\u{1F3E6}",
    ionicon: "cash",
    duration: 25,
    tone: "purple",
    contractMult: 1,
    materialCostMult: 1,
    equipDailyCostMult: 1,
    loanAprMod: 0.3,
    crewWageMod: 0,
    categoryRestrict: null,
    desc: "Central bank raises rates. New loans cost 30% more interest."
  },
  {
    id: "labor_shortage",
    label: "Labor Shortage",
    icon: "\u{1F477}",
    ionicon: "people",
    duration: 20,
    tone: "orange",
    contractMult: 1.1,
    materialCostMult: 1,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0.25,
    categoryRestrict: null,
    desc: "Tradies are scarce. All crew wages rise 25%, but contract rates inch up."
  },
  {
    id: "urban_development_wave",
    label: "Urban Development Wave",
    icon: "\u{1F306}",
    ionicon: "map",
    duration: 18,
    tone: "cyan",
    contractMult: 1.45,
    materialCostMult: 1,
    equipDailyCostMult: 1,
    loanAprMod: 0,
    crewWageMod: 0,
    categoryRestrict: ["Commercial", "Infrastructure"],
    desc: "City planning surge \u2014 Commercial and Infrastructure contracts pay 45% more."
  }
];
var SUBCONTRACTOR_TYPES = [
  { id: "temp_carpenter", label: "Temp Carpenter Crew", role: "Carpenter", skill: 85, wagePerDay: 300, count: 3, durationDays: 14, reliability: 0.76, hireCost: 2e3, desc: "Fast but pricey. May skip Mondays." },
  { id: "temp_concrete", label: "Temp Concrete Gang", role: "Concreter", skill: 82, wagePerDay: 340, count: 4, durationDays: 10, reliability: 0.7, hireCost: 3e3, desc: "Useful for big pours. Unreliable in cold." },
  { id: "temp_elec", label: "Temp Electricians", role: "Electrician", skill: 92, wagePerDay: 380, count: 2, durationDays: 21, reliability: 0.82, hireCost: 2500, desc: "Licensed and skilled. High day rate." },
  { id: "temp_plumb", label: "Temp Plumbing Crew", role: "Plumber", skill: 88, wagePerDay: 360, count: 2, durationDays: 14, reliability: 0.74, hireCost: 2200, desc: "Licensed plumbers for short engagements." }
];
var INSURANCE_PLANS = [
  { id: "none", label: "No Insurance", monthlyPremium: 0, coverage: 0, deductible: 0, desc: "No coverage. All accidents are full cost." },
  { id: "basic", label: "Basic Coverage", monthlyPremium: 900, coverage: 0.5, deductible: 2500, desc: "Covers half of accident costs above deductible." },
  { id: "standard", label: "Standard Plan", monthlyPremium: 2e3, coverage: 0.75, deductible: 1e3, desc: "75% coverage. Recommended for active sites." },
  { id: "premium", label: "Premium Shield", monthlyPremium: 4e3, coverage: 0.92, deductible: 250, desc: "Near full coverage. Required for some government contracts." }
];
var ACHIEVEMENTS_LIST = [
  { id: "first_job", title: "Breaking Ground", icon: "construct", desc: "Complete your first contract", check: (g) => (g.completedJobs || 0) >= 1 },
  { id: "crew_of_5", title: "Growing Team", icon: "people", desc: "Employ 5+ workers at once", check: (g) => (g.crew || []).length >= 5 },
  { id: "crew_of_10", title: "Full Crew", icon: "people-circle", desc: "Employ 10+ workers at once", check: (g) => (g.crew || []).length >= 10 },
  { id: "machine_fleet", title: "Machine Fleet", icon: "car", desc: "Own 3+ pieces of equipment", check: (g) => (g.equipment || []).length >= 3 },
  { id: "first_million", title: "First Million", icon: "cash", desc: "Earn $1M total revenue", check: (g) => (g.revenue || 0) >= 1e6 },
  { id: "five_million", title: "Five Million Club", icon: "diamond", desc: "Earn $5M total revenue", check: (g) => (g.revenue || 0) >= 5e6 },
  { id: "first_city_office", title: "City Presence", icon: "business", desc: "Open your first city office", check: (g) => (g.cityOffices || []).length >= 1 },
  { id: "safety_record", title: "Safety Record", icon: "shield-checkmark", desc: "Achieve safety score 90+", check: (g) => (g.safetyScore || 0) >= 90 },
  { id: "insurance_wise", title: "Fully Insured", icon: "shield", desc: "Activate Premium Shield coverage", check: (g) => g.insurancePlanId === "premium" },
  { id: "equipment_mogul", title: "Equipment Mogul", icon: "settings", desc: "Own 6+ pieces of equipment", check: (g) => (g.equipment || []).length >= 6 },
  { id: "one_hundred_jobs", title: "Century Mark", icon: "checkmark-circle", desc: "Complete 100 contracts", check: (g) => (g.completedJobs || 0) >= 100 },
  { id: "empire_builder", title: "Empire Builder", icon: "map", desc: "Offices in 5+ cities", check: (g) => (g.cityOffices || []).length >= 5 },
  { id: "top_employer", title: "Top Employer", icon: "medal", desc: "Employ 20+ workers at once", check: (g) => (g.crew || []).length >= 20 },
  { id: "debt_free", title: "Debt Free", icon: "checkmark-done-circle", desc: "No loans and $50K+ cash", check: (g) => (g.loans || []).length === 0 && (g.cash || 0) >= 5e4 },
  { id: "big_contract", title: "Big Score", icon: "ribbon", desc: "Win a government or mega contract", check: (g) => (g.legacyStats?.totalContractsWon || 0) >= 1 && (g.cityOffices || []).length >= 1 }
];
var LOAN_PRODUCTS = LENDING_PRODUCTS;
function getLendingCollateral(g, product) {
  const equipment = g.equipment || [];
  const appraised = equipment.map((e) => ({
    id: e.id,
    value: Math.max(0, Math.round((e.price || 0) * ((e.condition ?? 100) / 100)))
  }));
  if (product?.collateralType === "vehicle") {
    return appraised.sort((a, b) => b.value - a.value)[0] || { id: null, value: 0 };
  }
  if (product?.collateralType === "fleet") {
    return { id: null, value: appraised.reduce((sum, e) => sum + e.value, 0) };
  }
  if (product?.collateralType === "company") {
    return { id: null, value: Math.max(0, computeValuation(g)) };
  }
  return { id: null, value: 0 };
}
function buildBorrowerProfile(g, product) {
  const collateral = getLendingCollateral(g, product);
  const existingDebt = (g.loans || []).reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0);
  const missedPaymentCount = (g.loans || []).reduce((sum, loan) => sum + (loan.missedPayments || 0), 0);
  const weeklyRevenue = g.weeklyStats?.revenue || 0;
  const weeklyExpenses = g.weeklyStats?.expenses || 0;
  return {
    creditScore: g.creditScore || 600,
    companyValue: Math.max(0, computeValuation(g)),
    cashFlow: weeklyRevenue - weeklyExpenses,
    existingDebt,
    missedPaymentCount,
    companyAgeDays: g.day || 0,
    collateralValue: collateral.value,
    economyMult: getConstructionRegionalSnapshot(g).lendingEconomyMult
  };
}
var JOB_POSTINGS = [
  { id: "basic", label: "Basic Ad", cost: 120, count: 1, skillMin: 75, skillMax: 95, wageMin: 18, wageMax: 26, desc: "Finds a reliable labourer or tradesperson." },
  { id: "standard", label: "Standard Ad", cost: 300, count: 2, skillMin: 90, skillMax: 110, wageMin: 24, wageMax: 34, desc: "Attracts experienced tradespeople." },
  { id: "premium", label: "Premium Ad", cost: 650, count: 3, skillMin: 105, skillMax: 130, wageMin: 30, wageMax: 45, desc: "Top-tier tradespeople. Foreman-quality." }
];
var CREW_ROLES = ["Labourer", "Carpenter", "Electrician", "Plumber", "Concreter", "Steelworker"];
function addLog2(state, text) {
  state.logs = [text, ...state.logs].slice(0, 25);
  if (!Array.isArray(state.opsFeed)) state.opsFeed = [];
  const tone = /broke down|late|penalty|❌|incident|fine|shortage|paused|overdue/.test(text) ? "red" : /\+\$|completed|✅|hired|acquired|Milestone|🎉|bonus/.test(text) ? "green" : /⚠|warning|no-show|delay/.test(text) ? "orange" : /📋|permit|pause|weather/.test(text) ? "blue" : "neutral";
  state.opsFeed = [{ id: uid2(), text, tone, day: state.day || 1 }, ...state.opsFeed].slice(0, 20);
}
function addImportantNotice(state, message, tone = "green") {
  state.importantNotice = { id: Date.now(), message, tone };
}
function getCreditLabel(score) {
  if (score >= 780) return { label: "Excellent", color: "cyan" };
  if (score >= 720) return { label: "Very Good", color: "green" };
  if (score >= 660) return { label: "Good", color: "green" };
  if (score >= 580) return { label: "Fair", color: "yellow" };
  if (score >= 500) return { label: "Poor", color: "orange" };
  return { label: "Very Poor", color: "red" };
}
function getIdleCrew(state) {
  return state.crew.filter((w) => w.status === "Idle" && w.onShift !== false);
}
function getIdleEquipment(state) {
  return state.equipment.filter((e) => e.status === "Idle");
}
function getActiveSites(state) {
  return state.activeSites.filter((s) => s.status === "Active" || s.status === "Paused");
}
function getOpenContracts(state) {
  return state.contracts.filter((c) => c.status === "Open");
}
function getBestEquipTier(state) {
  if (!state.equipment.length) return 0;
  return Math.max(...state.equipment.map((e) => e.tier));
}
function createEquipment(item) {
  return {
    id: uid2(),
    shopId: item.shopId,
    name: item.name,
    type: item.type,
    tier: item.tier,
    price: item.price,
    dailyCost: item.dailyCost,
    fuelCap: item.fuelCap,
    fuel: item.fuelCap,
    reliability: item.reliability,
    capacity: item.capacity,
    condition: 100,
    mileage: 0,
    status: "Idle",
    assignedSiteId: null,
    breakdowns: 0,
    upgrades: {}
  };
}
function createWorker(role, overrides = {}) {
  const trait = pick2(CREW_TRAITS);
  return {
    id: uid2(),
    name: `${pick2(FIRST_NAMES)} ${pick2(LAST_NAMES)}`,
    role: role || pick2(CREW_ROLES),
    specialty: pick2(CREW_SPECIALTIES),
    age: rand2(20, 56),
    skill: rand2(75, 105),
    mood: rand2(60, 85),
    loyalty: rand2(55, 80),
    stamina: rand2(70, 95),
    trait,
    wagePerDay: rand2(160, 260),
    status: "Idle",
    onShift: true,
    assignedSiteId: null,
    jobsCompleted: 0,
    xp: 0,
    level: 1,
    hireDay: 0,
    favoriteCategory: null,
    jobHistory: [],
    attendanceStrikes: 0,
    certifications: [],
    ...overrides
  };
}
function createApplicant(boost = {}) {
  const trait = pick2(CREW_TRAITS);
  const role = boost.role || pick2(CREW_ROLES);
  return {
    id: uid2(),
    name: `${pick2(FIRST_NAMES)} ${pick2(LAST_NAMES)}`,
    role,
    specialty: boost.specialty || pick2(CREW_SPECIALTIES),
    desiredWage: rand2(boost.wageMin ?? 18, boost.wageMax ?? 32),
    skill: rand2(boost.skillMin ?? 75, boost.skillMax ?? 105),
    mood: rand2(58, 88),
    loyalty: rand2(50, 78),
    stamina: rand2(65, 95),
    trait,
    signingBonus: rand2(50, 200),
    quality: boost.quality || null
  };
}
function applyInsuranceClaim(g, rawDamage) {
  const planId = g.insurancePlanId || "none";
  const plan = INSURANCE_PLANS.find((p) => p.id === planId);
  if (!plan || plan.id === "none" || plan.coverage <= 0) return rawDamage;
  const netDamage = Math.min(rawDamage, plan.deductible + rawDamage * (1 - plan.coverage));
  const covered = rawDamage - netDamage;
  addLog2(g, `\u{1F6E1}\uFE0F Insurance covered ${money2(covered)} of the ${money2(rawDamage)} incident.`);
  return netDamage;
}
function applyIncident(g, severity) {
  if (!g.incidentHistory) g.incidentHistory = [];
  g.safetyScore = Math.max(0, Math.min(100, (g.safetyScore ?? 70) - severity * rand2(3, 8)));
  g.complianceScore = Math.max(0, Math.min(100, (g.complianceScore ?? 60) - severity * rand2(2, 5)));
  g.safetyViolations = (g.safetyViolations ?? 0) + 1;
  const rawCost = severity * rand2(1500, 4e3);
  const netCost = applyInsuranceClaim(g, rawCost);
  g.cash -= netCost;
  g.expenses += netCost;
  g.incidentHistory.push({ day: g.day, severity, desc: "Safety incident level " + severity });
  if (g.incidentHistory.length > 50) g.incidentHistory = g.incidentHistory.slice(-50);
}
function applyInspectionPass(g) {
  if (!g.incidentHistory) g.incidentHistory = [];
  g.safetyScore = Math.min(100, (g.safetyScore ?? 70) + rand2(3, 8));
  g.complianceScore = Math.min(100, (g.complianceScore ?? 60) + rand2(2, 6));
  g.incidentHistory.push({ day: g.day, severity: 0, desc: "Inspection passed" });
  if (g.incidentHistory.length > 50) g.incidentHistory = g.incidentHistory.slice(-50);
}
function recoverSafetyScores(g) {
  const safety = g.safetyScore ?? 70;
  const compliance = g.complianceScore ?? 60;
  g.safetyScore = Math.max(0, Math.min(100, safety + (safety < 70 ? 0.5 : safety > 70 ? -0.1 : 0)));
  g.complianceScore = Math.max(0, Math.min(100, compliance + (compliance < 60 ? 0.3 : compliance > 60 ? -0.1 : 0)));
}
function captureEconomicSnapshot(g) {
  if (!g.economicHistory) g.economicHistory = [];
  const ws = g.weeklyStats ?? { revenue: 0, expenses: 0 };
  g.economicHistory.push({
    week: Math.floor((g.day || 1) / 7),
    day: g.day,
    cash: g.cash,
    revenue: ws.revenue,
    expenses: ws.expenses,
    profit: ws.revenue - ws.expenses,
    valuation: computeValuation(g),
    reputation: g.reputation,
    marketShare: g.marketShare ?? 1
  });
  if (g.economicHistory.length > 52) g.economicHistory = g.economicHistory.slice(-52);
}
function checkAchievements(g) {
  if (!g.achievements) g.achievements = [];
  for (const ach of ACHIEVEMENTS_LIST) {
    if (g.achievements.includes(ach.id)) continue;
    try {
      if (ach.check(g)) {
        g.achievements.push(ach.id);
        addLog2(g, `\u{1F3C5} Achievement unlocked: "${ach.title}" \u2014 ${ach.desc}!`);
      }
    } catch (e) {
      if (__DEV__) console.warn("[ConstructionFlow] achievement check error:", e);
    }
  }
}
function initLegacyStats() {
  return { founded: 1, totalContractsWon: 0, totalRevenue: 0, totalPayroll: 0, totalEmployeesHired: 2, totalEquipmentBought: 1 };
}
function trackHire(g) {
  if (!g.legacyStats) g.legacyStats = initLegacyStats();
  g.legacyStats.totalEmployeesHired++;
}
function trackEquipBuy(g) {
  if (!g.legacyStats) g.legacyStats = initLegacyStats();
  g.legacyStats.totalEquipmentBought++;
}
function trackContractWon(g) {
  if (!g.legacyStats) g.legacyStats = initLegacyStats();
  g.legacyStats.totalContractsWon++;
}
function createContract(state, forcedDefId) {
  const bestTier = getBestEquipTier(state);
  const repRequired = { stadium: 80, wildbear_city: 95 };
  const eligible = CONTRACT_DEFS.filter((d) => {
    if (d.minTier >= 3 && (state.reputation || 0) < 25) return false;
    if (d.minTier >= 4 && (state.reputation || 0) < 60) return false;
    if (state.creditScore < d.creditReq) return false;
    if (d.minTier > Math.max(1, bestTier)) return false;
    if (repRequired[d.id] && (state.reputation || 0) < repRequired[d.id]) return false;
    if (d.category === "Government" && d.complianceReq && (state.complianceScore ?? 60) < d.complianceReq) return false;
    return true;
  });
  const pool = eligible.length ? eligible : CONTRACT_DEFS.slice(0, 3);
  const forcedDef = forcedDefId ? CONTRACT_DEFS.find((d) => d.id === forcedDefId) : null;
  const def = forcedDef || pick2(pool);
  const contractCityId = pickContractCity(state);
  const baseDeadline = state.day + def.durationDays + rand2(2, 6);
  const seasonMult = state.seasonContractMult || 1;
  const regionAdjustedBase = applyRegionalContractValue(def.baseValue, state);
  const enhanced = enhanceContractValue(def, state, { value: Math.round(regionAdjustedBase * seasonMult), deadline: baseDeadline });
  const contract = {
    id: uid2(),
    defId: def.id,
    label: def.label,
    category: def.category || "Commercial",
    client: pick2(CLIENTS),
    value: enhanced.value,
    phases: [...def.phases],
    minTier: def.minTier,
    crewMin: def.crewMin,
    equipMin: def.equipMin,
    materials: { ...def.materials },
    penaltyPerDay: def.penaltyPerDay,
    durationDays: def.durationDays,
    deadline: enhanced.deadline,
    expiresDay: state.day + rand2(3, 7),
    expiryDay: state.day + 10,
    status: "Open",
    desc: def.desc,
    risk: def.risk,
    cityId: contractCityId
  };
  const _activeRivals = (state.rivals || []).filter((r) => r.status !== "Bankrupt");
  if (_activeRivals.length > 0 && Math.random() < 0.3) {
    const _rival = _activeRivals[Math.floor(Math.random() * _activeRivals.length)];
    contract.interestedRival = _rival.name;
    contract.rivalTakesDay = state.day + 2;
  }
  if ((state.reputation || 0) >= 20 && Math.random() < 0.3) {
    const matching = CLIENT_ROSTER.filter((c) => !def.category || def.category.toLowerCase().includes(c.focus) || c.focus === "commercial");
    const cl = matching[Math.floor(Math.random() * matching.length)] || CLIENT_ROSTER[Math.floor(Math.random() * CLIENT_ROSTER.length)];
    contract.clientId = cl.id;
    contract.client = cl.name;
    const rel = (state.clientRelationships || {})[cl.id] || { loyalty: 0 };
    const tier = getClientTier(rel.loyalty);
    if (tier.valueMult > 1) contract.value = Math.round(contract.value * tier.valueMult);
    if (tier.extraDays > 0) {
      contract.deadline += tier.extraDays;
      contract.durationDays += tier.extraDays;
    }
  }
  const g = state;
  if (g._govtPriority && def.category === "Government") {
    g._govtPriority = false;
    return { ...contract, value: Math.round(contract.value * 1.25), label: "\u2B50 " + contract.label };
  }
  return contract;
}
function createRivals() {
  return RIVAL_COMPANIES.map((r) => ({
    id: r.id,
    name: r.name,
    aggression: r.aggression,
    focus: r.focus,
    rep: r.startRep,
    jobsCompleted: 0,
    activeJobs: 0,
    cash: rand2(2e4, 5e4)
  }));
}
function createSubcontractor(typeId) {
  const def = SUBCONTRACTOR_TYPES.find((t) => t.id === typeId);
  if (!def) return null;
  return {
    id: uid2(),
    typeId: def.id,
    name: def.label,
    role: def.role,
    skill: def.skill,
    wagePerDay: def.wagePerDay,
    count: def.count,
    daysLeft: def.durationDays,
    reliability: def.reliability,
    status: "Active",
    assignedSiteId: null
  };
}
function getAssignBlockReason(contract, crewIds, equipIds, state) {
  if (!contract) return "No contract selected.";
  if (state.businessFrozen) return "Business is frozen \u2014 resolve overdue taxes.";
  const def = CONTRACT_DEFS.find((d) => d.id === contract.defId) || {};
  const bestTier = Math.max(0, ...equipIds.map((id) => {
    const e = state.equipment.find((eq) => eq.id === id);
    return e ? e.tier : 0;
  }));
  if (equipIds.length < (def.equipMin || 1)) return `Need at least ${def.equipMin} piece(s) of equipment.`;
  if (crewIds.length < (def.crewMin || 1)) return `Need at least ${def.crewMin} crew members.`;
  if (bestTier < (def.minTier || 1)) return `Job needs Tier ${def.minTier}+ equipment.`;
  for (const matId of Object.keys(contract.materials || {})) {
    const needed = contract.materials[matId];
    const have = state.materials[matId] || 0;
    if (have < needed) {
      const mat = MATERIAL_DEFS.find((m) => m.id === matId);
      return `Need ${needed} ${mat?.unit || "units"} of ${mat?.label || matId} (have ${have}).`;
    }
  }
  return null;
}
function getMaterialUnitPrice(game, matId) {
  const mat = MATERIAL_DEFS.find((m) => m.id === matId);
  const rawBasePrice = game?.materialPrices?.[matId] || mat?.basePrice || 100;
  const basePrice = game ? applyRegionalMaterialPrice(rawBasePrice, game) : rawBasePrice;
  return Math.round(basePrice * (1 - (game ? getMaterialDiscount(game) : 0)));
}
function getSiteMissingMaterials(site, contractDef, game) {
  if (!contractDef?.materials) return [];
  const disc = game ? getMaterialDiscount(game) : 0;
  return Object.entries(contractDef.materials).reduce((acc, [matId, needed]) => {
    const fulfilled = (site.materialsFulfilled || {})[matId] || 0;
    const shortfall = Math.max(0, needed - fulfilled);
    if (shortfall === 0) return acc;
    const mat = MATERIAL_DEFS.find((m) => m.id === matId);
    const rawBasePrice = game?.materialPrices?.[matId] || mat?.basePrice || 100;
    const basePrice = game ? applyRegionalMaterialPrice(rawBasePrice, game) : rawBasePrice;
    const pricePerUnit = Math.round(basePrice * (1 - disc));
    acc.push({
      matId,
      needed,
      fulfilled,
      missing: shortfall,
      label: mat?.label || matId,
      icon: mat?.icon || "\u{1F4E6}",
      unit: mat?.unit || "units",
      pricePerUnit,
      costNormal: pricePerUnit * shortfall,
      costEmergency: Math.round(pricePerUnit * shortfall * 1.5)
    });
    return acc;
  }, []);
}
function getNextBestAction(s) {
  if (s.businessFrozen) return { title: "Business Frozen", body: "Overdue taxes suspended operations. Pay now in Finance.", tone: "red", tab: "Finance" };
  if ((s.cash || 0) < -1e3) return { title: "Cash Crisis", body: "Account is deep in the red. Win and complete jobs urgently.", tone: "red", tab: "Finance" };
  const _activeSites = s.activeSites || [];
  const _crew = s.crew || [];
  const _equipment = s.equipment || [];
  const _contracts = s.contracts || [];
  const _noCrewSite = _activeSites.find(
    (site) => site.status === "Active" && (site.assignedCrewIds || []).length === 0
  );
  if (_noCrewSite) return { title: "Site Has No Crew", body: `"${_noCrewSite.label}" is active but has no workers assigned. Go to Sites and assign crew to keep it moving.`, tone: "red", tab: "Sites" };
  const _brokenAssigned = _equipment.find(
    (e) => (e.status === "Broken" || e.status === "Maintenance") && _activeSites.some((site) => (site.assignedEquipmentIds || []).includes(e.id) && site.status === "Active")
  );
  if (_brokenAssigned) return { title: "Vehicle Broken on Site", body: `${_brokenAssigned.name} is down on an active site. Repair it in Vehicles to restore full progress.`, tone: "orange", tab: "Vehicles" };
  const _brokenAny = _equipment.find((e) => e.status === "Broken" || e.status === "Maintenance");
  if (_brokenAny) return { title: "Vehicle Needs Repair", body: `${_brokenAny.name} is out of action. Repair it in Vehicles before assigning to new sites.`, tone: "orange", tab: "Vehicles" };
  const _stalledSite = _activeSites.find((site) => {
    const _contract = _contracts.find((c) => c.id === site.contractId);
    const _def = CONTRACT_DEFS.find((d) => d.id === _contract?.defId);
    return _def?.materials && Object.entries(_def.materials).some(([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed);
  });
  if (_stalledSite) return { title: "Site Stalled \u2014 Materials Needed", body: `"${_stalledSite.label}" can't progress. Buy the required materials in the Sites tab to resume work.`, tone: "orange", tab: "Sites" };
  const _overdueSite = _activeSites.find((site) => (s.day || 1) > site.deadlineDay && site.status === "Active");
  if (_overdueSite) return { title: "Overdue Site \u2014 Act Now!", body: `"${_overdueSite.label}" is past deadline. Every day costs ${money2(_overdueSite.penaltyPerDay || 0)}. Switch strategy to Rush or renegotiate.`, tone: "red", tab: "Sites" };
  const _exhaustedWorker = _crew.find((w) => w.status === "Active" && ((w.stamina ?? 50) < 20 || (w.mood ?? 70) < 15));
  if (_exhaustedWorker) return { title: "Crew Exhausted", body: `${_exhaustedWorker.name} is running on empty (stamina ${Math.round(_exhaustedWorker.stamina ?? 0)}). Send them to rest or morale will crater.`, tone: "orange", tab: "Crew" };
  const _moodCrisis = _crew.find((w) => (w.mood ?? 70) < 20 && (w.loyalty ?? 50) < 30);
  if (_moodCrisis) return { title: "Crew About to Quit", body: `${_moodCrisis.name} has very low morale. Consider a raise or bonus \u2014 check Crew before they walk.`, tone: "red", tab: "Crew" };
  if ((s.cash || 0) < 500) return { title: "Cash Running Low", body: "Under $500 in the account. Complete active sites faster to bring in revenue.", tone: "orange", tab: "Finance" };
  const _openContracts = _contracts.filter((c) => c.status === "Open");
  const _idleCrew = _crew.filter((w) => w.status === "Idle" && w.onShift !== false);
  const _idleEquip = _equipment.filter((e) => e.status === "Idle");
  if (_activeSites.length === 0) {
    if (_crew.length === 0) return { title: "Hire Your First Worker", body: "Post a job ad in Crew then hire an applicant. You need at least 1 worker to start any site.", tone: "cyan", tab: "Crew" };
    if (_equipment.length < 1) return { title: "Buy Your First Machine", body: "A Basic Pickup Truck unlocks Tier 1 contracts. Go to Vehicles tab to purchase.", tone: "cyan", tab: "Vehicles" };
    if (_openContracts.length === 0) return { title: "No Active Sites", body: "No contracts available right now. Your reputation will attract new ones tomorrow.", tone: "blue", tab: "Bids" };
    if (_idleCrew.length >= 1 && _idleEquip.length >= 1) {
      return { title: "Ready to Work \u2014 No Active Sites", body: `${_idleCrew.length} crew idle and ${_idleEquip.length} machines ready. Bid on a contract in Bids and start a site.`, tone: "blue", tab: "Bids" };
    }
    return { title: "No Active Sites", body: "Head to Bids and pick up a contract to get back to work.", tone: "blue", tab: "Bids" };
  }
  const _activeSubs = (s.subcontractors || []).filter((sc) => (sc.daysLeft || 0) > 0 && sc.status === "Active");
  const _slowSite = _activeSites.find((site) => site._progressRate && site._progressRate * 48 < 8 && site.status === "Active");
  if (_activeSubs.length === 0 && _slowSite && (s.cash || 0) > 3e3) {
    return { title: "Speed Up With Subcontractors", body: `"${_slowSite.label}" is progressing slowly. Hire a temp crew in the Crew tab to boost site speed by up to 30%.`, tone: "blue", tab: "Crew" };
  }
  const _allHealthy = _activeSites.every((site) => {
    const _c = _contracts.find((c) => c.id === site.contractId);
    const _d = CONTRACT_DEFS.find((d) => d.id === _c?.defId);
    const _noMissing = !_d?.materials || !Object.entries(_d.materials).some(([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed);
    return _noMissing && site.status === "Active" && (s.day || 1) <= site.deadlineDay && (site.assignedCrewIds || []).length > 0;
  });
  if (_allHealthy) return { title: "All Sites Running Smoothly", body: "Everything looks good. Review Finance for optimizations \u2014 or bid on new contracts to grow faster.", tone: "green", tab: "Finance" };
  return { title: "Check Your Sites", body: "Review active sites to make sure crew, materials, and deadlines are all in order.", tone: "blue", tab: "Sites" };
}
function checkMilestones(state) {
  if (!state._milestones) state._milestones = {};
  const unlocked = [];
  for (const m of MILESTONE_DEFS) {
    if (state._milestones[m.key]) continue;
    try {
      if (m.check(state)) {
        state._milestones[m.key] = true;
        if (typeof m.reward === "function") {
          m.reward(state);
          addImportantNotice(state, `\u{1F3C6} "${m.label}" milestone reached!`, "green");
        } else if (m.reward > 0) {
          state.cash += m.reward;
          addLog2(state, `\u{1F3C6} Milestone: "${m.label}" \u2014 Bonus ${money2(m.reward)}!`);
          addImportantNotice(state, `\u{1F3C6} "${m.label}" \u2014 ${money2(m.reward)} bonus!`, "green");
        } else {
          addLog2(state, `\u{1F3C6} Milestone: "${m.label}"!`);
          addImportantNotice(state, `\u{1F3C6} "${m.label}" milestone reached!`, "green");
        }
        unlocked.push(m);
      }
    } catch (e) {
      if (__DEV__) console.warn("[ConstructionFlow] milestone check error:", e);
    }
  }
  const _cl10 = COMPANY_LEVELS.slice().reverse().find((l) => (state.reputation || 0) >= l.repMin && (state.completedJobs || 0) >= l.jobsMin && computeValuation(state) >= l.valMin) || COMPANY_LEVELS[0];
  if (_cl10.level >= 10 && !state._level10Celebrated) {
    state._level10Celebrated = true;
    state.cash += 25e3;
    state.revenue += 25e3;
    addImportantNotice(state, "\u{1F451} Construction Dynasty achieved! +$25,000 celebration bonus.", "green");
    addLog2(state, "\u{1F451} Reached Level 10: Construction Dynasty \u2014 the pinnacle of the industry!");
  }
  return unlocked;
}
function checkWorkerTurnover(g) {
  const quitters = [];
  for (const w of g.crew) {
    let quitChance = 0;
    if (w.mood < 25 && w.loyalty < 40) quitChance = 0.15;
    if (w.mood < 40 && w.wagePerDay < 25 && w.skill > 90) quitChance = Math.max(quitChance, 0.08);
    if ((w.stamina ?? 50) < 10 && w.status !== "Idle") {
      w.mood = Math.max(0, (w.mood ?? 50) - rand2(10, 18));
      quitChance = Math.max(quitChance, 0.6);
      addLog2(g, `\u{1F630} ${w.name} is completely burned out \u2014 about to quit!`);
    } else if ((w.stamina ?? 50) < 20 && w.status !== "Idle") {
      w.mood = Math.max(0, (w.mood ?? 50) - rand2(6, 12));
      if ((w.mood ?? 50) < 20) quitChance = Math.max(quitChance, 0.3);
      addLog2(g, `\u{1F630} ${w.name} is burning out \u2014 low stamina draining morale.`);
    }
    if (w.status === "Active") {
      w.loyalty = Math.min(100, (w.loyalty ?? 0) + 0.1);
    } else if (Math.random() < 0.05) {
      w.loyalty = Math.min(100, (w.loyalty ?? 50) + 1);
    }
    const loyaltyMilestone = Math.floor(w.loyalty ?? 0);
    if (loyaltyMilestone >= 50 && !w._loyalty50Done && w.status !== "Active") {
      w._loyalty50Done = true;
      const raiseAmt = Math.round(w.wagePerDay * 0.1);
      if (g.cash > raiseAmt * 30) {
        w.wagePerDay += raiseAmt;
        w.mood = Math.min(100, (w.mood ?? 50) + 15);
        addLog2(g, `\u{1F4BC} ${w.name} has been loyal for 50 days \u2014 earned a 10% raise!`);
      } else {
        addLog2(g, `\u{1F4BC} ${w.name} is requesting a raise after 50 days of loyalty.`);
      }
    }
    if (loyaltyMilestone >= 100 && !w._loyalty100Done) {
      w._loyalty100Done = true;
      w.skill = Math.min(150, (w.skill || 80) + 5);
      addLog2(g, `\u{1F3C5} ${w.name} has reached max loyalty \u2014 permanent +5 skill bonus from experience!`);
    }
    const pressure = w.trait?.wagePressure || 1;
    if (pressure > 1.1) {
      const daysSinceRaise = g.day - (w.lastRaiseDay || 0);
      if (daysSinceRaise > 60 && Math.random() < (pressure - 1) * 0.5) {
        if (g.cash > w.wagePerDay * 30) {
          const raise = Math.round(w.wagePerDay * (pressure - 1) * 0.3);
          w.wagePerDay += raise;
          w.lastRaiseDay = g.day;
          w.mood = Math.min(100, (w.mood ?? 50) + 10);
          addLog2(g, `\u{1F4B0} ${w.name} got a raise (+$${raise}/day) \u2014 ${w.trait.label} demands it.`);
        } else {
          w.mood = Math.max(0, (w.mood ?? 50) - 15);
          quitChance = Math.max(quitChance, 0.1);
        }
      }
    }
    if (quitChance > 0 && Math.random() < quitChance) {
      quitters.push(w.id);
      for (const site of g.activeSites) {
        if ((site.assignedCrewIds || []).includes(w.id)) {
          site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== w.id);
        }
      }
      if ((w.jobsCompleted || 0) > 3 || (w.loyalty ?? 0) > 30) {
        const _daysWorked = g.day - (w.hireDay || g.day);
        const _years = Math.floor(_daysWorked / 365);
        const _yearStr = _years > 0 ? `${_years} year(s)` : `${_daysWorked} days`;
        const _isVet = (w.loyalty ?? 0) >= 100;
        const _msg = _isVet ? `${w.name} retired after ${_yearStr} \u2014 a loyal veteran, ${w.jobsCompleted || 0} projects completed. Thank you.` : `${w.name} departed after ${_yearStr} \u2014 ${w.jobsCompleted || 0} projects completed.`;
        addLog2(g, `\u{1F464} ${_msg}`);
      } else {
        addLog2(g, `\u{1F44B} ${w.name} quit \u2014 low morale or undervalued. Lost a ${w.role}.`);
      }
    }
  }
  if (quitters.length) g.crew = g.crew.filter((w) => !quitters.includes(w.id));
}
function checkLevelUp(g, w) {
  const next = WORKER_LEVELS.find((l) => l.level === (w.level || 1) + 1);
  if (!next || (w.xp || 0) < next.xpRequired) return;
  w.level = next.level;
  w.skill = Math.min(150, (w.skill || 75) + 3);
  w.loyalty = Math.min(100, (w.loyalty ?? 50) + 5);
  addLog2(g, `\u2B50 ${w.name} reached ${next.label} (Lv${next.level})! Skill +3.`);
  addImportantNotice(g, `${w.name} leveled up to ${next.label}!`, "green");
}
function checkPromotion(g) {
  for (const w of g.crew) {
    const jobs = w.jobsCompleted || 0;
    if (!w._promotedAt) w._promotedAt = [];
    for (const milestone of PROMOTION_MILESTONES) {
      if (jobs >= milestone && !w._promotedAt.includes(milestone)) {
        w._promotedAt.push(milestone);
        const skillBonus = rand2(3, 8);
        w.skill = Math.min(150, w.skill + skillBonus);
        w.loyalty = Math.min(100, w.loyalty + rand2(2, 5));
        addLog2(g, `\u2B50 ${w.name} promoted after ${milestone} jobs \u2014 skill +${skillBonus}!`);
        if (milestone === 20 && !g.pendingVeteranEvent) {
          const retainCost = 800 + jobs * 15;
          g.pendingVeteranEvent = { workerId: w.id, workerName: w.name, jobsCompleted: jobs, skill: w.skill, retainCost };
        }
      }
    }
  }
}
function generateWeeklyChallenge(g) {
  const lv = Math.min(10, Math.floor((g.reputation || 0) / 20) + 1);
  const opts = [
    { type: "week_contracts", label: `Complete ${2 + lv} contract${2 + lv > 1 ? "s" : ""} this week`, target: 2 + lv, reward: 600 + lv * 120, repBonus: 4 },
    { type: "week_revenue", label: `Earn ${money2(3e3 + lv * 800)} in contract income`, target: 3e3 + lv * 800, reward: 500 + lv * 100, repBonus: 2 },
    { type: "week_safety", label: `Keep safety score above 70 all week`, target: 70, reward: 400 + lv * 80, repBonus: 3 },
    { type: "week_ontime", label: `Complete ${1 + Math.floor(lv / 2)} job${1 + Math.floor(lv / 2) > 1 ? "s" : ""} on time`, target: 1 + Math.floor(lv / 2), reward: 700 + lv * 140, repBonus: 5 },
    { type: "week_fleet", label: `Keep all vehicles above 40% condition`, target: 40, reward: 450 + lv * 90, repBonus: 2 },
    { type: "week_crew", label: `Keep all active crew stamina above 50`, target: 50, reward: 350 + lv * 70, repBonus: 1 }
  ];
  const chosen = opts[Math.floor(Math.random() * opts.length)];
  g.weeklyChallenge = { ...chosen, progress: 0, completed: false, startDay: g.day, claimedDay: null };
}
function checkWeeklyChallenge(g, event, value) {
  const wc = g.weeklyChallenge;
  if (!wc || wc.completed || wc.progress < 0) return;
  if (wc.type === "week_contracts" && event === "job_complete") wc.progress = (wc.progress || 0) + 1;
  if (wc.type === "week_revenue" && event === "revenue") wc.progress = (wc.progress || 0) + value;
  if (wc.type === "week_ontime" && event === "ontime") wc.progress = (wc.progress || 0) + 1;
  if (wc.type === "week_safety" && event === "daily" && (g.safetyScore || 60) < wc.target) wc.progress = -1;
  if (wc.type === "week_fleet" && event === "daily" && (g.equipment || []).some((e) => (e.condition || 0) < wc.target)) wc.progress = -1;
  if (wc.type === "week_crew" && event === "daily" && (g.crew || []).filter((w) => w.status === "Active").some((w) => (w.stamina ?? 50) < wc.target)) wc.progress = -1;
  if (wc.progress !== -1 && wc.progress >= wc.target) {
    wc.completed = true;
    addImportantNotice(g, `\u{1F4CB} Weekly Challenge complete! Claim your ${money2(wc.reward)} reward on the Home screen.`, "green");
  }
}
function startNewGeneration(g, perkId) {
  const nextGen = (g.generation || 1) + 1;
  const mentor = [...g.crew || []].sort((a, b) => (b.skill || 0) - (a.skill || 0))[0];
  const perks = [...g.legacyPerks || [], perkId];
  const fresh = freshState();
  fresh.generation = nextGen;
  fresh.companyName = g.companyName;
  fresh.startingCityId = g.startingCityId;
  fresh.homeCityName = g.homeCityName;
  fresh.homeStateCode = g.homeStateCode;
  fresh.homeStateName = g.homeStateName;
  fresh.homeCompetition = g.homeCompetition;
  fresh.tutorialDone = true;
  fresh.setupDone = true;
  fresh.theme = g.theme || "dark";
  fresh.legacyPerks = perks;
  fresh.hallOfFame = { ...g.hallOfFame, prestigeReached: g.day };
  if (perkId === "iron_foundation") {
    fresh.cash += 5e4;
    fresh.revenue += 5e4;
  }
  if (perkId === "reputation_legacy") {
    fresh.reputation = 25;
  }
  if (perkId === "veteran_mentor" && mentor) {
    fresh.legacyMentor = { name: mentor.name, skill: mentor.skill || 75, role: mentor.role, wagePerDay: Math.round((mentor.wagePerDay || 120) * 0.5) };
  }
  if (perkId === "equipment_cache") {
    fresh._pendingEquipCache = true;
  }
  if (perkId === "material_stockpile") {
    const mats = ["concrete", "lumber", "steel"];
    mats.forEach((m) => {
      fresh.materials[m] = (fresh.materials[m] || 0) + 30;
    });
  }
  if (perkId === "political_connections") {
    fresh._politicalContractsLeft = 5;
  }
  for (const p of g.legacyPerks || []) {
    if (p === "iron_foundation") fresh.cash += 15e3;
    if (p === "reputation_legacy") fresh.reputation = Math.min(fresh.reputation + 8, 35);
  }
  return fresh;
}
function getClientTier(loyalty) {
  if (loyalty >= 81) return { label: "Preferred Vendor", color: "green", valueMult: 1.15, extraDays: 2 };
  if (loyalty >= 51) return { label: "Trusted Partner", color: "cyan", valueMult: 1.08, extraDays: 1 };
  if (loyalty >= 21) return { label: "Acquaintance", color: "sub", valueMult: 1, extraDays: 0 };
  return { label: "Stranger", color: "sub", valueMult: 1, extraDays: 0 };
}
function applyEquipmentAging(g) {
  for (const e of g.equipment) {
    if (e.status === "Active") continue;
    e.condition = Math.max(0, e.condition - 0.5);
    if (e.condition < 20 && e.status === "Idle") {
      e.status = "Maintenance";
      addLog2(g, `\u{1F527} ${e.name} condition critical \u2014 needs maintenance before next use.`);
    }
  }
}
function decrementTraining(g) {
  if (!g.trainingQueue || !g.trainingQueue.length) return;
  const done = [];
  for (const t of g.trainingQueue) {
    t.daysLeft = (t.daysLeft || 1) - 1;
    if (t.daysLeft <= 0) {
      const w = g.crew.find((w2) => w2.id === t.workerId);
      const prog = TRAINING_PROGRAMS2.find((p) => p.id === t.programId);
      if (w && prog) {
        w.skill = Math.min(150, w.skill + prog.skillBonus);
        if (prog.wagePressure) w.wagePerDay = Math.round(w.wagePerDay * (1 + prog.wagePressure));
        if (prog.certId && !w.certifications) w.certifications = [];
        if (prog.certId && !(w.certifications || []).includes(prog.certId)) {
          w.certifications = [...w.certifications || [], prog.certId];
          addLog2(g, `\u{1F393} ${w.name} earned certification: ${prog.label}!`);
        }
        addLog2(g, `\u{1F393} ${w.name} completed "${prog.label}" \u2014 skill +${prog.skillBonus}!`);
      }
      done.push(t.id);
    }
  }
  if (done.length) g.trainingQueue = g.trainingQueue.filter((t) => !done.includes(t.id));
}
function enhancedRivalDailyLogic(g) {
  if (!g.rivals) g.rivals = createRivals();
  for (const rival of g.rivals) {
    if ((g.acquiredRivals || []).includes(rival.id)) continue;
    if (rival.status === "Bankrupt") {
      rival.bankruptDays = (rival.bankruptDays || 0) + 1;
      if (rival.bankruptDays >= 90) {
        rival.status = "Active";
        rival.cash = rand2(8e3, 2e4);
        rival.rep = Math.max(5, Math.round((rival.rep || 10) * 0.4));
        rival.activeJobs = 0;
        rival.bankruptDays = 0;
        addLog2(g, `\u{1F4C8} ${rival.name} has restructured and re-entered the market.`);
      }
      continue;
    }
    const activeJobs = rival.activeJobs || 0;
    if (activeJobs > 0) {
      const income = activeJobs * rand2(12e3, 4e4);
      const costs = activeJobs * rand2(3e3, 8e3) + (rival.employees || 2) * rand2(180, 280);
      rival.cash = (rival.cash || 0) + income - costs;
      rival.estimatedRevenue = (rival.estimatedRevenue || 0) + income;
    } else {
      rival.cash = (rival.cash || 0) - rand2(400, 1200) - (rival.employees || 2) * 100;
      if (Math.random() < 0.15) rival.rep = Math.max(0, (rival.rep || 10) - 1);
    }
    rival.lowValuationDays = rival.lowValuationDays || 0;
    const rivalVal = (rival.cash || 0) + (rival.rep || 0) * 5e4 + (rival.cityPresence || ["salem"]).length * 1e5;
    if (rivalVal < 1e4) {
      rival.lowValuationDays++;
    } else {
      rival.lowValuationDays = 0;
    }
    if ((rival.cash || 0) < -15e3 || rival.lowValuationDays >= 30) {
      rival.status = "Bankrupt";
      rival.bankruptDays = 0;
      addLog2(g, `\u{1F4C9} ${rival.name} has gone bankrupt and exited the market.`);
      continue;
    }
    if (activeJobs > 0 && Math.random() < 0.6) {
      rival.rep = Math.min(100, (rival.rep || 0) + (Math.random() * 0.08 + 0.02));
    }
    if (activeJobs > 0 && Math.random() < 0.18) {
      rival.activeJobs = Math.max(0, activeJobs - 1);
      rival.jobsCompleted = (rival.jobsCompleted || 0) + 1;
      rival.rep = Math.min(100, (rival.rep || 0) + rand2(1, 3));
    }
    if (Math.random() < 0.05 && (rival.employees || 2) < 20) {
      rival.employees = (rival.employees || 2) + 1;
      rival.cash -= rand2(2e3, 5e3);
    }
    if (Math.random() < 0.03 && (rival.cash || 0) > 5e4) {
      rival.equipCount = (rival.equipCount || 1) + 1;
      rival.cash -= rand2(15e3, 5e4);
      rival.rep = Math.min(100, (rival.rep || 0) + 1);
    }
    if (g.activeMarketEvent === "recession_start" && Math.random() < 0.3) {
      rival.activeJobs = Math.max(0, (rival.activeJobs || 0) - 1);
    }
    if ((rival.rep || 0) > 20 && Math.random() < 0.02) {
      const poachTarget = g.crew.find((w) => w.mood < 50 && w.loyalty < 40);
      if (poachTarget) {
        g.crew = g.crew.filter((w) => w.id !== poachTarget.id);
        addLog2(g, `\u{1F44B} ${poachTarget.name} was poached by ${rival.name}. Low morale cost you a worker.`);
      }
    }
    if (rival.cash > 3e4 && (rival.employees || 2) < 20 && Math.random() < 0.08) {
      const hireCount = rand2(1, 2);
      rival.employees = (rival.employees || 2) + hireCount;
      rival.cash -= hireCount * rand2(3e3, 6e3);
      if (Math.random() < 0.3) addLog2(g, `\u{1F477} ${rival.name} hired ${hireCount} new worker${hireCount > 1 ? "s" : ""}.`);
    }
    if (rival.cash > 6e4 && (rival.equipment || 1) < 8 && Math.random() < 0.05) {
      rival.equipment = (rival.equipment || 1) + 1;
      rival.cash -= rand2(2e4, 55e3);
      if (Math.random() < 0.25) addLog2(g, `\u{1F69C} ${rival.name} acquired new equipment.`);
    }
    if (rival.cash < 5e3 && (rival.employees || 2) > 2 && Math.random() < 0.12) {
      rival.employees = Math.max(2, (rival.employees || 2) - 1);
      if (Math.random() < 0.4) addLog2(g, `\u{1F4C9} ${rival.name} downsized \u2014 laid off a worker.`);
    }
    const hasPMDirector = (g.projectManagers || []).some((pm) => pm.typeId === "director");
    const stealPenalty = hasPMDirector ? 0.8 : 1;
    const focusMap = { residential: ["Residential"], commercial: ["Commercial"], infrastructure: ["Infrastructure"] };
    const targetCategories = focusMap[rival.focus] || ["Commercial"];
    const vulnerableContracts = g.contracts.filter(
      (c) => c.status === "Open" && targetCategories.includes(c.category) && c.expiresDay <= g.day + 2
    );
    for (const c of vulnerableContracts) {
      if (Math.random() < rival.aggression * 0.8 * stealPenalty) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand2(1, 3));
        addLog2(g, `\u{1F3D7}\uFE0F ${rival.name} outbid you on "${c.label}" \u2014 act faster on ${c.category} contracts.`);
        break;
      }
    }
    const expiredOpen = g.contracts.filter((c) => c.status === "Open" && c.expiresDay < g.day);
    for (const c of expiredOpen) {
      if (Math.random() < rival.aggression * stealPenalty) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand2(1, 3));
        addLog2(g, `\u{1F3D7}\uFE0F ${rival.name} snagged "${c.label}" before you \u2014 move faster next time.`);
      }
    }
    const _interestedContracts = g.contracts.filter((c) => c.status === "Open" && c.interestedRival === rival.name && g.day >= (c.rivalTakesDay || 999));
    for (const c of _interestedContracts) {
      c.status = "Taken";
      rival.activeJobs = (rival.activeJobs || 0) + 1;
      addLog2(g, `\u{1F525} ${rival.name} moved fast \u2014 they snagged "${c.label}" before you did.`);
    }
    if (g.day % 15 === 0 && Math.random() < 0.25 && rival.cash > 2e4) {
      const presence = rival.cityPresence || ["salem"];
      const candidateCities = CITIES.filter((c) => c.rivals.includes(rival.id) && !presence.includes(c.id));
      if (candidateCities.length > 0) {
        const target = candidateCities.reduce(
          (best, city) => city.contractMult > best.contractMult ? city : best
        );
        rival.cityPresence = [...presence, target.id];
        rival.rep = Math.min(100, (rival.rep || 0) + rand2(2, 5));
        rival.cash -= rand2(5e3, 15e3);
        addLog2(g, `\u{1F3D7}\uFE0F ${rival.name} strategically expanded to ${target.name}!`);
      }
    }
    if (g.day % 365 === 0 && rival.rep >= 60 && Math.random() < 0.3) {
      rival.rep = Math.min(100, (rival.rep || 0) + rand2(3, 8));
      if (Math.random() < 0.5) addLog2(g, `\u{1F3C6} ${rival.name} won an industry award \u2014 their reputation grows.`);
    }
    const prevRev = rival.estimatedRevenue || 0;
    rival.growthTrend = prevRev > 1e5 ? "growing" : prevRev > 3e4 ? "stable" : "declining";
    const _rivalCity = (g.unlockedCities || ["salem"])[Math.floor(Math.random() * Math.max(1, (g.unlockedCities || ["salem"]).length))];
    if (!g.cityStats) g.cityStats = {};
    if (!g.cityStats[_rivalCity]) g.cityStats[_rivalCity] = { playerJobs: 0, rivalJobs: 0 };
    g.cityStats[_rivalCity].rivalJobs = (g.cityStats[_rivalCity].rivalJobs || 0) + 1;
    if ((rival.valuation || rival.cash || 0) > (g.companyValuation || 0) * 1.8 && Math.random() < 0.03) {
      const _idleCrew = (g.crew || []).filter((w) => w.status === "Idle");
      if (_idleCrew.length > 1) {
        const _target = _idleCrew[Math.floor(Math.random() * _idleCrew.length)];
        for (const _site of g.activeSites || []) {
          _site.assignedCrewIds = (_site.assignedCrewIds || []).filter((id) => id !== _target.id);
        }
        g.crew = g.crew.filter((w) => w.id !== _target.id);
        addLog2(g, `\u26A0\uFE0F ${rival.name} poached ${_target.name} from your crew!`);
      }
    }
    if ((rival.activeJobs || 0) > 0) {
      const _rCities = rival.cityPresence || ["salem"];
      const _rCity = _rCities[Math.floor(Math.random() * _rCities.length)];
      if (!g.cityStats) g.cityStats = {};
      if (!g.cityStats[_rCity]) g.cityStats[_rCity] = { playerJobs: 0, rivalJobs: 0 };
      g.cityStats[_rCity].rivalJobs = (g.cityStats[_rCity].rivalJobs || 0) + 1;
      rival.cityJobs = (rival.cityJobs || 0) + 1;
    }
    if (Math.random() < 0.01) {
      const _weakerRival = (g.rivals || []).find(
        (r) => r.id !== rival.id && r.status !== "Bankrupt" && !(g.acquiredRivals || []).includes(r.id) && (rival.cash || 0) + (rival.rep || 0) * 5e4 >= ((r.cash || 0) + (r.rep || 0) * 5e4) * 5
      );
      if (_weakerRival) {
        rival.activeJobs = (rival.activeJobs || 0) + (_weakerRival.activeJobs || 0);
        rival.employees = (rival.employees || 2) + Math.floor((_weakerRival.employees || 2) * 0.5);
        rival.rep = Math.min(100, (rival.rep || 0) + rand2(2, 5));
        _weakerRival.status = "Bankrupt";
        _weakerRival.bankruptDays = 0;
        addLog2(g, `\u{1F3D7}\uFE0F ${rival.name} acquired ${_weakerRival.name} \u2014 a rival has consolidated!`);
      }
    }
    const _rivalValuation = (rival.cash || 0) + (rival.rep || 0) * 5e4 + (rival.cityPresence || ["salem"]).length * 1e5;
    if (_rivalValuation < 1e4 && rival.status !== "Bankrupt") {
      rival.bankruptDays = (rival.bankruptDays || 0) + 1;
      if (rival.bankruptDays >= 30 && !rival.bankrupt) {
        rival.bankrupt = true;
        rival.bankruptDay = g.day;
        rival.status = "Bankrupt";
        addLog2(g, `\u{1F4C9} ${rival.name} has gone bankrupt.`);
      }
    }
    if (rival.bankrupt && g.day > (rival.bankruptDay || 0) + 90) {
      rival.bankrupt = false;
      rival.status = "Active";
      rival.cash = 15e3;
      rival.reputation = Math.max(5, (rival.rep || 0) * 0.4);
      rival.bankruptDays = 0;
      addLog2(g, `\u{1F4C8} ${rival.name} has recovered and re-entered the market.`);
    }
  }
}
function enhancedRivalBidding(g, openContracts) {
  if (!openContracts || openContracts.length === 0) return;
  const hasPMDirector = (g.projectManagers || []).some((pm) => pm.typeId === "director");
  const playerEdge = hasPMDirector ? 0.8 : 1;
  const competitionMultiplier = { "Low": 0.6, "Medium": 0.85, "High": 1.1, "Very High": 1.3 };
  const playerCities = ["salem", ...(g.cityOffices || []).map((o) => o.cityId)];
  let cityPressure = 0.6;
  for (const cityId of playerCities) {
    const cityDef = CITIES.find((c) => c.id === cityId);
    if (cityDef) {
      const m = competitionMultiplier[cityDef.competition] || 0.85;
      if (m > cityPressure) cityPressure = m;
    }
  }
  const rivalPersonality = {
    apex: { focus: ["Residential"], focusBonus: 1.15 },
    summit: { focus: ["Commercial"], focusBonus: 1.2 },
    ironpeak: { focus: ["Infrastructure", "Mega"], focusBonus: 1.1 },
    northwest: { focus: ["Residential"], focusBonus: 0.75, dailySkip: 0.6 },
    pacific_group: { focus: ["Commercial", "Mega"], focusBonus: 1.25 },
    western_build_co: { focus: ["Residential"], focusBonus: 1.1, dailySkip: 0.55 },
    summit_construction: { focus: ["Commercial", "Government"], focusBonus: 1.2 }
  };
  for (const rival of g.rivals || []) {
    if ((g.acquiredRivals || []).includes(rival.id)) continue;
    if (rival.status === "Bankrupt") continue;
    const personality = rivalPersonality[rival.id];
    if (!personality) continue;
    if (personality.dailySkip && Math.random() > personality.dailySkip) continue;
    const targets = openContracts.filter(
      (c) => c.status === "Open" && personality.focus.includes(c.category)
    );
    for (const c of targets) {
      if (Math.random() < rival.aggression * personality.focusBonus * cityPressure * playerEdge) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand2(1, 3));
        addLog2(g, `\u{1F3D7}\uFE0F ${rival.name} claimed "${c.label}".`);
        break;
      }
    }
  }
}
function applyWeatherEvent(site, game, region) {
  const pattern = WEATHER_PATTERNS[region] || WEATHER_PATTERNS["Pacific Northwest"];
  const roll = Math.random();
  if (roll < pattern.snowProb) {
    const progressLoss = Math.round(site.phaseProgress * 0.4);
    const pauseDays = rand2(2, 5);
    site.phaseProgress = Math.max(0, site.phaseProgress - progressLoss);
    site.status = "Paused";
    site.pausedDays = (site.pausedDays || 0) + pauseDays;
    site.currentWeather = { icon: "snow", label: "Snow Delay", endsDay: (game.day || 1) + pauseDays };
    addLog2(game, `\u2744\uFE0F ${site.label}: Snow halted work \u2014 lost ${progressLoss}% progress, paused ${pauseDays} day(s).`);
    return { text: `Snow halted work \u2014 lost ${progressLoss}% progress. Paused ${pauseDays} day(s).`, type: "weather_snow" };
  }
  if (roll < pattern.snowProb + pattern.rainProb) {
    const progressLoss = Math.round(site.phaseProgress * 0.2);
    const pauseDays = rand2(1, 3);
    site.phaseProgress = Math.max(0, site.phaseProgress - progressLoss);
    site.deadlineDay += pauseDays;
    site.currentWeather = { icon: "rainy", label: "Rain Delay", endsDay: (game.day || 1) + pauseDays };
    addLog2(game, `\u{1F327}\uFE0F ${site.label}: Rain delay \u2014 lost ${progressLoss}% progress, deadline pushed ${pauseDays} day(s).`);
    return { text: `Rain delay \u2014 lost ${progressLoss}% progress. Deadline extended ${pauseDays} day(s).`, type: "weather_rain" };
  }
  if (roll < pattern.snowProb + pattern.rainProb + pattern.heatProb) {
    const progressLoss = Math.round(site.phaseProgress * 0.1);
    site.phaseProgress = Math.max(0, site.phaseProgress - progressLoss);
    const assignedCrew = game.crew.filter((w) => site.assignedCrewIds.includes(w.id));
    for (const w of assignedCrew) w.stamina = Math.max(0, w.stamina - rand2(8, 18));
    site.currentWeather = { icon: "sunny", label: "Extreme Heat", endsDay: (game.day || 1) + 1 };
    addLog2(game, `\u2600\uFE0F ${site.label}: Extreme heat \u2014 crew stamina drained, lost ${progressLoss}% progress.`);
    return { text: `Extreme heat slowed the site. Lost ${progressLoss}% progress, crew stamina hit.`, type: "weather_heat" };
  }
  return null;
}
function checkChainEvents(site, game, lastEventType) {
  switch (lastEventType) {
    case "theft": {
      if (Math.random() < 0.4) {
        const mats = Object.keys(game.materials).filter((k) => (game.materials[k] || 0) > 0);
        if (!mats.length) break;
        const matId = pick2(mats);
        const stolen = rand2(3, Math.min(12, game.materials[matId]));
        game.materials[matId] = Math.max(0, game.materials[matId] - stolen);
        const mat = MATERIAL_DEFS.find((m) => m.id === matId);
        const loss = stolen * (game.materialPrices[matId] || mat?.basePrice || 100);
        addLog2(game, `\u{1F6A8} Chain: Second theft at ${site.label}! ${stolen} ${mat?.unit} stolen \u2014 ${money2(loss)} lost.`);
        return true;
      }
      break;
    }
    case "safety": {
      if (Math.random() < 0.5) {
        const fine = rand2(1500, 5e3);
        game.cash -= fine;
        site.status = "Paused";
        site.pausedDays = (site.pausedDays || 0) + rand2(1, 3);
        addLog2(game, `\u{1F50D} Chain: Follow-up inspection at ${site.label} \u2014 ${money2(fine)} fine, work paused.`);
        return true;
      }
      break;
    }
    case "scope": {
      if (Math.random() < 0.3) {
        const bonus = rand2(3e3, 12e3);
        site.totalValue += bonus;
        addLog2(game, `\u{1F4D0} Chain: Scope expansion at ${site.label} \u2014 contract value +${money2(bonus)}.`);
        return true;
      }
      break;
    }
    case "breakdown": {
      if (Math.random() < 0.35) {
        const impact = rand2(5, 12);
        site.phaseProgress = Math.max(0, site.phaseProgress - impact);
        addLog2(game, `\u{1F4E6} Chain: Breakdown at ${site.label} caused re-schedule \u2014 lost ${impact}% progress.`);
        return true;
      }
      break;
    }
    default:
      break;
  }
  return false;
}
function checkSaveIntegrity(savedData) {
  const issues = [];
  if (!savedData || typeof savedData !== "object") {
    return { valid: false, issues: ["Save data is not a valid object."], migrationNeeded: false };
  }
  if (!Number.isFinite(savedData.cash)) issues.push("g.cash is missing or not finite.");
  if (!Number.isInteger(savedData.day) || savedData.day < 1) issues.push("g.day is missing or invalid.");
  if (!Array.isArray(savedData.crew)) issues.push("g.crew is missing.");
  if (!Array.isArray(savedData.equipment)) issues.push("g.equipment is missing.");
  if (!Array.isArray(savedData.contracts)) issues.push("g.contracts is missing.");
  if (!Array.isArray(savedData.activeSites)) issues.push("g.activeSites is missing.");
  const migrationNeeded = savedData.cityOffices === void 0 || savedData.properties === void 0 || savedData.projectManagers === void 0 || savedData.acquiredRivals === void 0 || savedData.empireGoalsCompleted === void 0 || savedData.trainingQueue === void 0;
  return { valid: issues.length === 0, issues, migrationNeeded };
}
function cleanStaleState(g) {
  if (Array.isArray(g.logs)) g.logs = g.logs.slice(0, 25);
  if (Array.isArray(g.opsFeed)) g.opsFeed = g.opsFeed.slice(0, 20);
  g.eventLog = (g.eventLog || []).slice(0, 50);
  if (Array.isArray(g.contracts) && g.day > 10) {
    const currentDay = g.day || 1;
    g.contracts = g.contracts.filter((c) => c.status !== "Taken" || (c.expiresDay || 0) >= currentDay - 10);
  }
  if (Array.isArray(g.activeSites)) {
    for (const site of g.activeSites) {
      if (Array.isArray(site.chaosHistory)) site.chaosHistory = site.chaosHistory.slice(0, 10);
    }
  }
  if (g._equipDiscountExpiry && (g.day || 1) > g._equipDiscountExpiry) {
    delete g._equipDiscountExpiry;
    delete g._equipDiscount;
  }
  if (Array.isArray(g.crew)) {
    g.crew = g.crew.map((w) => ({ ...w, jobHistory: (w.jobHistory || []).slice(-10) }));
  }
  return g;
}
function freshState() {
  const startEquip = createEquipment(EQUIPMENT_SHOP[0]);
  const startWorker1 = createWorker("Labourer");
  const startWorker2 = createWorker("Carpenter");
  const startWorker3 = createWorker("General Labourer");
  const baseContracts = [
    createContract({ cash: 75e3, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices: [], properties: [] }, "fence"),
    createContract({ cash: 75e3, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices: [], properties: [] }),
    createContract({ cash: 75e3, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices: [], properties: [] })
  ];
  return {
    cash: 75e3,
    day: 1,
    gameMinutes: 480,
    reputation: 0,
    creditScore: 600,
    companyName: "New Build Co.",
    theme: "dark",
    marketState: "Normal",
    businessFrozen: false,
    taxDue: 0,
    taxOverdueDays: 0,
    revenue: 0,
    expenses: 0,
    weeklyStats: { revenue: 0, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0 },
    savings: 0,
    creditLine: null,
    equipment: [startEquip],
    crew: [startWorker1, startWorker2, startWorker3],
    officeStaff: [],
    applicants: [],
    contracts: baseContracts,
    activeSites: [],
    completedJobs: 0,
    onTimeStreak: 0,
    bestStreak: 0,
    weeklyReport: null,
    materials: { concrete: 5, lumber: 20, steel: 0, electrical: 0, plumbing: 0, asphalt: 0 },
    materialPrices: { concrete: 120, lumber: 85, steel: 950, electrical: 45, plumbing: 38, asphalt: 200 },
    officeIndex: 0,
    loans: [],
    debt: 0,
    rivals: createRivals(),
    activeMarketEvent: null,
    marketEventDaysLeft: 0,
    subcontractors: [],
    contractCategoryFilter: "All",
    // Empire expansion
    cityOffices: [],
    // { id, cityId, typeId, openedDay }
    properties: [],
    // { id, typeId, purchasedDay }
    projectManagers: [],
    // { id, typeId, name, wagePerDay }
    acquiredRivals: [],
    // rival ids that were acquired
    empireGoalsCompleted: [],
    nationalRank: 99,
    marketShare: 1,
    companyValuation: 15e3,
    unlockedCities: [],
    // city ids unlocked by valuation threshold
    selectedEmpireCity: "portland",
    trainingQueue: [],
    cityJobsWon: {},
    // Sprint 5 — Safety, Insurance, Economy History, Achievements, Legacy
    safetyScore: 60,
    complianceScore: 60,
    safetyViolations: 0,
    incidentHistory: [],
    insurancePlanId: "none",
    economicHistory: [],
    achievements: [],
    legacyStats: initLegacyStats(),
    contractBidStyles: {},
    logs: ["\u{1F3D7}\uFE0F Welcome to ConstructionFlow. You have $75,000, one truck, and two crew. Start with the Fence job in Bids."],
    opsFeed: [],
    eventLog: [],
    _milestones: {},
    _generation: 1,
    legacyPerks: [],
    pendingCelebration: null,
    pendingDecision: null,
    pendingStory: null,
    pendingBreakdown: null,
    pendingInspection: null,
    pendingOfflineSummary: null,
    pendingVeteranEvent: null,
    _stories: [],
    lastLoginDay: 0,
    consecutiveLoginDays: 0,
    tutorialDone: false,
    lastRealTimestamp: null,
    // Addiction Pass additions
    pendingCeremony: null,
    companyHistory: [],
    hallOfFame: {
      biggestContract: 0,
      highestRep: 0,
      largestCrew: 0,
      largestFleet: 0,
      highestValuation: 0,
      mostProfitableProject: { label: "", value: 0 }
    },
    // Endgame arc
    generation: 1,
    legacyMentor: null,
    _pendingPrestige: false,
    _rankOneCelebrated: false,
    _level10Celebrated: false,
    _valuationMilestonesHit: [],
    clientRelationships: {},
    cityStats: {},
    bids: [],
    activeGrant: null,
    lastAcquisitionDay: 0,
    insuranceDeductibleMult: 1,
    autoAssignCrew: false,
    autoAssignEquipment: false,
    autoRepairEquipment: false,
    autoPurchaseMaterials: false,
    setupDone: false,
    startingCityId: "salem",
    homeCityName: "",
    homeStateCode: "",
    homeStateName: "",
    homeCompetition: "Low",
    speedUpUses: 0,
    jobHistory: [],
    speedMode: false,
    pendingRepeatClients: [],
    currentSeason: "Spring",
    seasonEmoji: "\u{1F331}",
    seasonContractMult: 1.08,
    seasonStaminaMult: 1,
    hotMaterialDeal: null,
    _prevNationalRank: 99,
    importantNotice: null,
    weeklyChallenge: null,
    _weekOnTimeJobs: 0,
    bankruptcyDays: 0,
    gameOver: false,
    gameOverReason: null
  };
}
function migrateState(saved) {
  const defaults = freshState();
  const g = { ...defaults, ...saved };
  g.weeklyStats = { ...defaults.weeklyStats, ...saved.weeklyStats || {} };
  g.hallOfFame = { ...defaults.hallOfFame, ...saved.hallOfFame || {} };
  if (!g.rivals || !g.rivals.length) g.rivals = createRivals();
  if (g.activeMarketEvent === void 0) g.activeMarketEvent = null;
  if (g.marketEventDaysLeft === void 0) g.marketEventDaysLeft = 0;
  if (!g.subcontractors) g.subcontractors = [];
  if (!g.contractCategoryFilter) g.contractCategoryFilter = "All";
  if (!g.cityOffices) g.cityOffices = [];
  if (!g.properties) g.properties = [];
  if (!g.projectManagers) g.projectManagers = [];
  if (!g.acquiredRivals) g.acquiredRivals = [];
  if (!g.empireGoalsCompleted) g.empireGoalsCompleted = [];
  if (g.nationalRank === void 0) g.nationalRank = 99;
  if (g.marketShare === void 0) g.marketShare = 1;
  if (g.companyValuation === void 0) g.companyValuation = 0;
  if (!g.unlockedCities) g.unlockedCities = [];
  if (!g.selectedEmpireCity) g.selectedEmpireCity = "portland";
  if (!g.trainingQueue) g.trainingQueue = [];
  if (!g.cityJobsWon) g.cityJobsWon = {};
  if (g.safetyScore === void 0) g.safetyScore = 60;
  if (g.complianceScore === void 0) g.complianceScore = 60;
  if (g.safetyViolations === void 0) g.safetyViolations = 0;
  if (!g.incidentHistory) g.incidentHistory = [];
  if (!g.insurancePlanId) g.insurancePlanId = "none";
  if (!g.economicHistory) g.economicHistory = [];
  if (!g.achievements) g.achievements = [];
  if (!g.legacyStats) g.legacyStats = initLegacyStats();
  if (!g.contractBidStyles) g.contractBidStyles = {};
  if (g.materials && g.materials.asphalt === void 0) g.materials.asphalt = 0;
  if (g.materialPrices && g.materialPrices.asphalt === void 0) g.materialPrices.asphalt = 200;
  if (g.pendingBreakdown === void 0) g.pendingBreakdown = null;
  if (g.pendingInspection === void 0) g.pendingInspection = null;
  if (g.lastLoginDay === void 0) g.lastLoginDay = g.day || 1;
  if (g.consecutiveLoginDays === void 0) g.consecutiveLoginDays = 0;
  if (g.tutorialDone === void 0) g.tutorialDone = (g.completedJobs || 0) > 0;
  if (g.lastRealTimestamp === void 0) g.lastRealTimestamp = null;
  if (g.pendingOfflineSummary === void 0) g.pendingOfflineSummary = null;
  if (g.pendingCeremony === void 0) g.pendingCeremony = null;
  if (!g.companyHistory) g.companyHistory = [];
  if (!g.hallOfFame) g.hallOfFame = { biggestContract: 0, highestRep: 0, largestCrew: 0, largestFleet: 0, highestValuation: 0, mostProfitableProject: { label: "", value: 0 } };
  if (!g.cityStats) g.cityStats = {};
  if (!g.bids) g.bids = [];
  if (g.activeGrant === void 0) g.activeGrant = null;
  if (g.lastAcquisitionDay === void 0) g.lastAcquisitionDay = 0;
  if (g.insuranceDeductibleMult === void 0) g.insuranceDeductibleMult = 1;
  if (g.autoAssignCrew === void 0) g.autoAssignCrew = false;
  if (g.autoAssignEquipment === void 0) g.autoAssignEquipment = false;
  if (g.autoRepairEquipment === void 0) g.autoRepairEquipment = false;
  if (g.autoPurchaseMaterials === void 0) g.autoPurchaseMaterials = false;
  if (g.onTimeStreak === void 0) g.onTimeStreak = 0;
  if (g.bestStreak === void 0) g.bestStreak = 0;
  if (g.weeklyChallenge === void 0) g.weeklyChallenge = null;
  if (g.pendingVeteranEvent === void 0) g.pendingVeteranEvent = null;
  if (g.weeklyReport === void 0) g.weeklyReport = null;
  if (g._weekOnTimeJobs === void 0) g._weekOnTimeJobs = 0;
  if (g.setupDone === void 0) g.setupDone = (g.day || 1) > 1 || (g.completedJobs || 0) > 0;
  if (!g.startingCityId) g.startingCityId = "salem";
  if (g.homeCityName === void 0) g.homeCityName = "";
  if (g.homeStateCode === void 0) g.homeStateCode = "";
  if (g.homeStateName === void 0) g.homeStateName = "";
  if (g.homeCompetition === void 0) g.homeCompetition = "Low";
  if (g.speedUpUses === void 0) g.speedUpUses = 0;
  if (g.speedMode === void 0) g.speedMode = false;
  if (!g.jobHistory) g.jobHistory = [];
  if (!g.pendingRepeatClients) g.pendingRepeatClients = [];
  if (g.savings === void 0) g.savings = 0;
  if (g.creditLine === void 0) g.creditLine = null;
  if (g.weeklyStats && g.weeklyStats.savingsInterest === void 0) g.weeklyStats.savingsInterest = 0;
  if (!g.currentSeason) g.currentSeason = "Spring";
  if (!g.seasonEmoji) g.seasonEmoji = "\u{1F331}";
  if (!g.seasonContractMult) g.seasonContractMult = 1.08;
  if (!g.seasonStaminaMult) g.seasonStaminaMult = 1;
  if (g.hotMaterialDeal === void 0) g.hotMaterialDeal = null;
  if (g._prevNationalRank === void 0) g._prevNationalRank = g.nationalRank || 99;
  if (g.importantNotice === void 0) g.importantNotice = null;
  if (g.bankruptcyDays === void 0) g.bankruptcyDays = 0;
  if (g.gameOver === void 0) g.gameOver = false;
  if (g.gameOverReason === void 0) g.gameOverReason = null;
  if (g.generation === void 0) g.generation = 1;
  if (g.legacyPerks === void 0) g.legacyPerks = [];
  if (g.legacyMentor === void 0) g.legacyMentor = null;
  if (g._pendingPrestige === void 0) g._pendingPrestige = false;
  if (g._rankOneCelebrated === void 0) g._rankOneCelebrated = false;
  if (g._level10Celebrated === void 0) g._level10Celebrated = false;
  if (g._valuationMilestonesHit === void 0) g._valuationMilestonesHit = [];
  if (g.clientRelationships === void 0) g.clientRelationships = {};
  (g.activeSites || []).forEach((s) => {
    if (!s._clientCheckins) s._clientCheckins = [];
  });
  (g.activeSites || []).forEach((s) => {
    if (s.depositPaid === void 0) s.depositPaid = 0;
    if (s.completionBonus === void 0) s.completionBonus = 0;
    if (s.rushQualityPenalty === void 0) s.rushQualityPenalty = 0;
    ensureProjectCostLedger(s);
  });
  g.crew = (g.crew || []).map((w) => w.certifications ? w : { ...w, certifications: [] });
  g.crew = (g.crew || []).map((w) => ({ specialty: pick2(CREW_SPECIALTIES), ...w }));
  g.crew = (g.crew || []).map((w) => ({
    loyalty: rand2(50, 75),
    level: 1,
    jobsCompleted: 0,
    ...w
  }));
  g.activeSites = (g.activeSites || []).map((s) => {
    const base = { currentWeather: null, ...s };
    if (!base.materialsFulfilled) {
      const contract = (g.contracts || []).find((c) => c.id === s.contractId);
      const def = CONTRACT_DEFS.find((d) => d.id === contract?.defId);
      const materialsFulfilled = {};
      for (const [matId, needed] of Object.entries(def?.materials || {})) {
        materialsFulfilled[matId] = needed;
      }
      base.materialsFulfilled = materialsFulfilled;
    }
    return base;
  });
  for (const matId of Object.keys(g.materials || {})) {
    if ((g.materials[matId] || 0) < 0) g.materials[matId] = 0;
  }
  if (g.pendingBreakdown?.equipId) {
    const _bdEq = (g.equipment || []).find((e) => e.id === g.pendingBreakdown.equipId);
    if (!_bdEq || _bdEq.status !== "Broken" && _bdEq.status !== "Maintenance") g.pendingBreakdown = null;
  }
  const _validCrewIds = new Set((g.crew || []).map((w) => w.id));
  (g.activeSites || []).forEach((site) => {
    site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => _validCrewIds.has(id));
  });
  (g.crew || []).forEach((_cw) => {
    if (_cw.status === "Resting" || _cw.status === "Training") return;
    const _onSite = (g.activeSites || []).some((s) => (s.assignedCrewIds || []).includes(_cw.id));
    _cw.status = _onSite ? "Active" : "Idle";
    _cw.siteId = null;
  });
  const _validEquipIds = new Set((g.equipment || []).map((e) => e.id));
  (g.activeSites || []).forEach((site) => {
    site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => _validEquipIds.has(id));
  });
  g.rivals = (g.rivals || []).map((r) => ({ cityPresence: ["salem"], cash: 2e4, ...r }));
  g.contracts = (g.contracts || []).map((c) => {
    if (!c.category) {
      const def = CONTRACT_DEFS.find((d) => d.id === c.defId);
      c.category = def?.category || "Commercial";
    }
    return c;
  });
  const cleaned = cleanStaleState(g);
  repairCrewAssignments(cleaned);
  return cleaned;
}
function repairCrewAssignments(g) {
  const crewIds = new Set((g.crew || []).map((w) => w.id));
  const equipIds = new Set((g.equipment || []).map((e) => e.id));
  for (const site of g.activeSites || []) {
    site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => crewIds.has(id));
    site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => equipIds.has(id));
  }
  const crewSiteMap = {};
  const equipSiteMap = {};
  for (const site of g.activeSites || []) {
    for (const cid of site.assignedCrewIds) crewSiteMap[cid] = site.id;
    for (const eid of site.assignedEquipmentIds) equipSiteMap[eid] = site.id;
  }
  for (const w of g.crew || []) {
    if (w.status === "Resting" || w.status === "Training") continue;
    if (crewSiteMap[w.id]) {
      w.status = "Active";
      w.assignedSiteId = crewSiteMap[w.id];
    } else {
      if (w.status === "Active") w.status = "Idle";
      w.assignedSiteId = null;
    }
  }
  for (const e of g.equipment || []) {
    if (e.status === "Maintenance" || e.status === "Broken") continue;
    if (equipSiteMap[e.id]) {
      e.status = "Active";
      e.assignedSiteId = equipSiteMap[e.id];
    } else {
      if (e.status === "Active") e.status = "Idle";
      e.assignedSiteId = null;
    }
  }
}
function gameTick(prev) {
  const g = clone(prev);
  const MINS_PER_TICK = 30;
  g.gameMinutes = (g.gameMinutes ?? 480) + MINS_PER_TICK;
  let newDay = false;
  if (g.gameMinutes >= 1440) {
    g.gameMinutes -= 1440;
    g.day = (g.day || 1) + 1;
    newDay = true;
  }
  repairCrewAssignments(g);
  for (const site of g.activeSites) {
    if (site.status === "Paused") {
      if ((site.pausedDays || 0) > 0 && site.pausedDays !== 999) {
        site.pausedDays = site.pausedDays - MINS_PER_TICK / 1440;
        if (site.pausedDays <= 0) {
          site.status = "Active";
          site.pausedDays = 0;
        }
      }
      continue;
    }
    if (site.status !== "Active") continue;
    const assignedCrew = g.crew.filter((w) => site.assignedCrewIds.includes(w.id));
    const assignedEquip = g.equipment.filter((e) => site.assignedEquipmentIds.includes(e.id) && e.status !== "Broken" && e.status !== "Maintenance");
    if (!assignedCrew.length || !assignedEquip.length) continue;
    const _siteContract = g.contracts.find((c) => c.id === site.contractId);
    const _siteDef = CONTRACT_DEFS.find((d) => d.id === _siteContract?.defId);
    const _hasMissingMats = _siteDef?.materials && Object.entries(_siteDef.materials).some(
      ([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed
    );
    if (_hasMissingMats) {
      if (Math.random() < 0.04) addLog2(g, `\u26A0\uFE0F ${site.label}: Work stalled \u2014 materials missing. Go to Sites to purchase.`);
      continue;
    }
    const avgSkill = assignedCrew.reduce((s, w) => s + w.skill, 0) / assignedCrew.length;
    const presentCrew = assignedCrew.filter((w) => w.trait?.label !== "Frequent No-Show" || Math.random() > 0.35);
    const avgSpeed = (presentCrew.length > 0 ? presentCrew : assignedCrew).reduce((s, w) => s + (w.trait?.speed || 1), 0) / Math.max(1, presentCrew.length || assignedCrew.length);
    const crewCount = presentCrew.length || assignedCrew.length;
    const hasTeamLeader = assignedCrew.some((w) => w.trait?.label === "Team Leader");
    const teamLeaderBonus = hasTeamLeader ? 1.08 : 1;
    const currentPhaseName = site.phases[site.currentPhaseIdx || 0] || "";
    const phaseAffinity = PHASE_TYPE_BONUS[currentPhaseName] || {};
    const equipTypeBonus = assignedEquip.reduce((best, e) => {
      const b = phaseAffinity[e.type] || 1;
      return b > best ? b : best;
    }, 1);
    const crewSpecialtyBonus = assignedCrew.reduce((best, w) => {
      const specialtyMap = SPECIALTY_PHASE_BONUS[w.specialty] || {};
      const b = specialtyMap[currentPhaseName] || 1;
      return b > best ? b : best;
    }, 1);
    const activeSubs = (g.subcontractors || []).filter((sc) => sc.daysLeft > 0 && sc.status === "Active");
    const subBonus = activeSubs.length > 0 ? Math.min(1.3, 1 + activeSubs.length * 0.1) : 1;
    const pmBonus = (g.projectManagers || []).reduce((s, pm) => {
      const def = PM_TIERS.find((t) => t.id === pm.typeId);
      return s + (def ? def.marginBoost : 0);
    }, 1);
    const SITE_MODE_MODS = { normal: 1, rush: 1.45, overtime: 1.3, quality: 0.78, budget: 0.88 };
    const stratMod = SITE_MODE_MODS[site.siteMode || "normal"] || 1;
    if ((site.siteMode === "rush" || site.siteMode === "overtime") && Math.random() < 0.25) {
      for (const id of site.assignedCrewIds) {
        const w = g.crew.find((cw) => cw.id === id);
        if (w) w.stamina = Math.max(0, (w.stamina ?? 50) - 2);
      }
    }
    if (site.siteMode === "rush") {
      site.rushQualityPenalty = Math.min(0.12, (site.rushQualityPenalty || 0) + 5e-4);
    }
    const hasMatchingSpecialty = crewSpecialtyBonus > 1;
    const mismatchPenalty = hasMatchingSpecialty ? 1 : 0.9;
    const _certBonus = assignedCrew.some((w) => (w.certifications || []).includes("safety_cert") || (w.certifications || []).includes("safety_mgmt_cert")) ? 1.05 : 1;
    const engineTier = assignedEquip.reduce((max, e) => Math.max(max, e.upgrades?.engine || 0), 0);
    const engineBonus = 1 + engineTier * 0.06;
    const pmSpeedBonus = (g.projectManagers || []).reduce((max, pm) => {
      const _pmd = PM_TIERS.find((t) => t.id === pm.typeId);
      return Math.max(max, _pmd ? 1 + (_pmd.delayReduce || 0) : 1);
    }, 1);
    const progressRate = 2 * (avgSkill / 100) * avgSpeed * Math.min(crewCount / (site.crewMin || 2), 1.5) * (MINS_PER_TICK / 60) * subBonus * pmBonus * pmSpeedBonus * teamLeaderBonus * equipTypeBonus * crewSpecialtyBonus * mismatchPenalty * stratMod * _certBonus * engineBonus;
    site._progressRate = progressRate;
    const _prevProgress = site.phaseProgress || 0;
    site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + progressRate);
    if (site.phases.length > 0) {
      const _prevPct = Math.floor(((site.currentPhaseIdx || 0) / site.phases.length + Math.max(0, _prevProgress) / 100 / site.phases.length) * 100);
      const _newPct = Math.floor(((site.currentPhaseIdx || 0) / site.phases.length + Math.max(0, site.phaseProgress) / 100 / site.phases.length) * 100);
      const _checkMilestone = [25, 50, 75].find((m) => _prevPct < m && _newPct >= m);
      if (_checkMilestone && !(site._clientCheckins || []).includes(_checkMilestone)) {
        site._clientCheckins = [...site._clientCheckins || [], _checkMilestone];
        const CLIENT_MSGS = {
          25: [`${site.client}: "Good progress so far \u2014 keep it up!" \u{1F44D}`, `${site.client} drove past the site. Looking good.`],
          50: [`${site.client}: "Halfway there! Really liking how this is taking shape."`, `${site.client} stopped by \u2014 impressed with the pace. \u2B50`],
          75: [`${site.client}: "Almost there! Can't wait to see it finished \u{1F389}"`, `${site.client}: "Outstanding work. Might have another job for you after this."`]
        };
        const _msgs = CLIENT_MSGS[_checkMilestone];
        addLog2(g, `\u{1F4AC} ${_msgs[Math.floor(Math.random() * _msgs.length)]}`);
        if (_checkMilestone === 75) site._clientLovesIt = true;
      }
    }
    if (site.phaseProgress >= 100) {
      const completedPhaseIdx = site.currentPhaseIdx || 0;
      const completedPhaseName = site.phases[completedPhaseIdx] || "";
      site.phaseProgress = 0;
      site.currentPhaseIdx = completedPhaseIdx + 1;
      if (INSPECTION_PHASES.has(completedPhaseName) && !g.pendingInspection) {
        const qualityMod = site.siteMode === "quality" ? 0.2 : site.siteMode === "budget" ? -0.18 : 0;
        const avgCrewSkillInsp = assignedCrew.length ? assignedCrew.reduce((s, w) => s + w.skill, 0) / assignedCrew.length : 80;
        const passChance = Math.min(0.9, 0.55 + qualityMod + (avgCrewSkillInsp - 80) / 200);
        const inspRoll = Math.random();
        let inspOutcome, inspPenalty = 0;
        if (inspRoll < passChance) {
          inspOutcome = "pass";
          g.reputation = Math.min(100, (g.reputation || 0) + 2);
          g.creditScore = Math.min(850, (g.creditScore || 600) + 1);
          addLog2(g, `\u2705 ${site.label}: ${completedPhaseName} passed \u2014 reputation +2.`);
        } else if (inspRoll < passChance + 0.28) {
          inspOutcome = "minor";
          inspPenalty = rand2(500, 2500);
          g.cash -= inspPenalty;
          site.phaseProgress = -20;
          addLog2(g, `\u{1F50D} ${site.label}: Minor correction required \u2014 ${money2(inspPenalty)} to remediate.`);
        } else {
          inspOutcome = "major";
          inspPenalty = rand2(2500, 9e3);
          g.cash -= inspPenalty;
          site.status = "Paused";
          site.pausedDays = (site.pausedDays || 0) + rand2(3, 6);
          g.reputation = Math.max(0, (g.reputation || 0) - 3);
          addLog2(g, `\u274C ${site.label}: Major inspection failure \u2014 ${money2(inspPenalty)} cost, site paused.`);
        }
        accrueProjectCost(site, "incidents", inspPenalty);
        g.pendingInspection = { siteId: site.id, siteLabel: site.label, phaseName: completedPhaseName, outcome: inspOutcome, penaltyApplied: inspPenalty };
      }
      if (site.currentPhaseIdx >= site.phases.length) {
        site.status = "Complete";
        const daysLate = Math.max(0, g.day - site.deadlineDay);
        const BASE_LATE_DAYS = 5;
        let penalty = 0;
        if (daysLate <= BASE_LATE_DAYS) {
          penalty = daysLate * site.penaltyPerDay;
        } else {
          penalty = BASE_LATE_DAYS * site.penaltyPerDay + (daysLate - BASE_LATE_DAYS) * site.penaltyPerDay * 1.5;
        }
        penalty = Math.min(penalty, Math.round(site.totalValue * 0.85));
        const earned = Math.max(0, site.totalValue - penalty - (site.depositPaid || 0));
        g.cash += earned;
        g.revenue += earned;
        g.weeklyStats.revenue += earned;
        g.completedJobs = (g.completedJobs || 0) + 1;
        if (!g.cityJobsWon) g.cityJobsWon = {};
        const completedCityKey = site.cityId || "salem";
        g.cityJobsWon[completedCityKey] = (g.cityJobsWon[completedCityKey] || 0) + 1;
        const siteDef = CONTRACT_DEFS.find((d) => d.id === g.contracts.find((c) => c.id === site.contractId)?.defId);
        const repGained = siteDef?.repReward || rand2(3, 8);
        const creditGained = siteDef?.creditReward || rand2(2, 5);
        g.reputation = Math.min(100, (g.reputation || 0) + repGained);
        g.creditScore = Math.min(850, (g.creditScore || 600) + creditGained);
        const avgQuality = assignedCrew.reduce((s, w) => s + (w.trait?.quality || 1), 0) / Math.max(1, assignedCrew.length);
        const effectiveQuality = Math.max(0.8, avgQuality - (site.rushQualityPenalty || 0));
        let qualityBonus = 0;
        if (effectiveQuality > 1.05) {
          qualityBonus = Math.round(earned * (effectiveQuality - 1) * 0.4);
          g.cash += qualityBonus;
          g.revenue += qualityBonus;
        }
        const economics = buildProjectEconomics({
          contractValue: site.totalValue,
          depositPaid: site.depositPaid || 0,
          penalty,
          qualityBonus,
          costs: ensureProjectCostLedger(site)
        });
        site.finalEconomics = economics;
        if (!g.pendingCelebration) {
          g.pendingCelebration = {
            label: site.label,
            client: site.client,
            earned: earned + qualityBonus,
            penalty,
            repGained,
            isOnTime: daysLate === 0,
            isMajor: (siteDef?.baseValue || 0) >= 1e5,
            qualityBonus,
            day: g.day,
            economics,
            // The first completed project is the one moment a new player has a concrete
            // example to learn the unit economics from, so it gets the full breakdown.
            isFirstProject: (g.completedJobs || 0) === 1,
            // Old saves have no cost history for projects already running, so the
            // breakdown would be misleadingly rosy. Say so rather than quietly lying.
            costsPartial: Boolean(site.costsPartial)
          };
        }
        if (earned >= 1e5 && !(g._stories || []).includes("first_100k")) {
          g._stories = [...g._stories || [], "first_100k"];
          g.pendingStory = { icon: "cash", title: "First Six-Figure Job!", body: `"${site.label}" earned ${money2(earned + qualityBonus)}. You've hit the big leagues.` };
        }
        if (g.completedJobs === 1 && !(g._stories || []).includes("first_job")) {
          g._stories = [...g._stories || [], "first_job"];
          g.pendingStory = g.pendingStory || { icon: "construct", title: "First Job Done!", body: `"${site.label}" complete. Every empire starts with one.` };
          if (!g.tutorialDone) {
            g.tutorialDone = true;
            addImportantNotice(g, "First job complete! Check Finance for loans, Empire to grow your company.", "green");
          }
        }
        const siteCategory = siteDef?.category || "Commercial";
        for (const id of site.assignedCrewIds || []) {
          const w = g.crew.find((w2) => w2.id === id);
          if (w) {
            w.status = "Idle";
            w.assignedSiteId = null;
            w.jobsCompleted = (w.jobsCompleted || 0) + 1;
            const xpGain = Math.min(50, Math.round(3 + (site.totalValue || 5e3) / 5e3));
            w.xp = (w.xp || 0) + xpGain;
            checkLevelUp(g, w);
            const _jMilestones = [5, 10, 25, 50, 100];
            if (_jMilestones.includes(w.jobsCompleted)) {
              w.loyalty = Math.min(100, (w.loyalty ?? 50) + 15);
              w.mood = Math.min(100, (w.mood ?? 50) + 10);
              const _rank = w.jobsCompleted >= 100 ? "a Company Legend" : w.jobsCompleted >= 50 ? "a Senior Hand" : w.jobsCompleted >= 25 ? "an Experienced Pro" : w.jobsCompleted >= 10 ? "a Trusted Builder" : "part of the team";
              addLog2(g, `\u{1F389} ${w.name} just hit ${w.jobsCompleted} jobs! They're ${_rank}. Loyalty +15.`);
              if (w.jobsCompleted === 10) {
                g.pendingStory = g.pendingStory || { icon: "people", title: `${w.name} \u2014 10 Jobs!`, body: `${w.name} has completed 10 jobs with your company. They're becoming a backbone of your operation. Their loyalty and skill are growing.` };
              }
            }
            w.jobHistory = [...w.jobHistory || [], siteCategory].slice(-5);
            const catCounts = (w.jobHistory || []).reduce((acc, cat) => {
              acc[cat] = (acc[cat] || 0) + 1;
              return acc;
            }, {});
            w.favoriteCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
            if ((w.jobsCompleted || 0) >= 50 && (w.skill || 0) >= 100 && (w.loyalty ?? 0) >= 70 && Math.random() < 0.08) {
              g.pendingStory = g.pendingStory || { icon: "medal", title: `${w.name} Retires!`, body: `${w.name} completed ${w.jobsCompleted} jobs with you. A legend of the company.` };
              g.crew = g.crew.filter((cw) => cw.id !== w.id);
              addLog2(g, `\u{1F396}\uFE0F ${w.name} retired after ${w.jobsCompleted} jobs. A true legend.`);
            }
          }
        }
        for (const id of site.assignedEquipmentIds || []) {
          const e = g.equipment.find((e2) => e2.id === id);
          if (e) {
            e.status = "Idle";
            e.assignedSiteId = null;
          }
        }
        const penaltyNote = penalty > 0 ? ` (${money2(penalty)} late penalty)` : "";
        addLog2(g, `\u2705 ${site.label} complete \u2014 earned ${money2(earned + qualityBonus)}${penaltyNote}!`);
        const _qualLabel = effectiveQuality >= 1.15 ? "Premium" : effectiveQuality >= 1.05 ? "High" : effectiveQuality < 0.95 ? "Below Standard" : "Standard";
        g.jobHistory = [...g.jobHistory || [], { label: site.label, client: site.client, value: earned + qualityBonus, day: g.day, quality: _qualLabel }].slice(-20);
        if (daysLate === 0) {
          g.onTimeStreak = (g.onTimeStreak || 0) + 1;
          g.bestStreak = Math.max(g.bestStreak || 0, g.onTimeStreak);
          g._weekOnTimeJobs = (g._weekOnTimeJobs || 0) + 1;
          const streakMilestones = [3, 5, 10, 20];
          if (streakMilestones.includes(g.onTimeStreak)) {
            const streakReward = g.onTimeStreak * 300;
            g.cash += streakReward;
            g.revenue += streakReward;
            addLog2(g, `\u{1F525} ${g.onTimeStreak}-job on-time streak! Bonus: ${money2(streakReward)}`);
            addImportantNotice(g, `On-time streak of ${g.onTimeStreak}! Bonus ${money2(streakReward)} earned.`, "green");
          }
          checkWeeklyChallenge(g, "ontime", 1);
        } else {
          if ((g.onTimeStreak || 0) > 0) {
            addLog2(g, `\u{1F494} On-time streak broken at ${g.onTimeStreak} \u2014 ${site.label} was ${daysLate} day(s) late.`);
          }
          g.onTimeStreak = 0;
        }
        checkWeeklyChallenge(g, "job_complete", 1);
        checkWeeklyChallenge(g, "revenue", earned);
        const _con = (g.contracts || []).find((c) => c.id === site.contractId);
        if (_con?.clientId && CLIENT_ROSTER.find((c) => c.id === _con.clientId)) {
          if (!g.clientRelationships) g.clientRelationships = {};
          if (!g.clientRelationships[_con.clientId]) g.clientRelationships[_con.clientId] = { loyalty: 0, jobsDone: 0, lastJobDay: null };
          const _rel = g.clientRelationships[_con.clientId];
          const _loyBonus = daysLate === 0 ? 3 : 1;
          _rel.loyalty = Math.min(100, (_rel.loyalty ?? 0) + _loyBonus);
          _rel.jobsDone = (_rel.jobsDone || 0) + 1;
          _rel.lastJobDay = g.day;
          const _cl = CLIENT_ROSTER.find((c) => c.id === _con.clientId);
          const _prevTier = getClientTier((_rel.loyalty ?? 0) - _loyBonus);
          const _newTier = getClientTier(_rel.loyalty ?? 0);
          if (_newTier.label !== _prevTier.label) {
            addImportantNotice(g, `${_cl.icon} ${_cl.name} relationship: now "${_newTier.label}"!`, "cyan");
          }
        }
        if (daysLate === 0 && (site.completionBonus || 0) > 0) {
          g.cash -= site.completionBonus;
          g.expenses += site.completionBonus;
          g.weeklyStats.expenses += site.completionBonus;
          for (const id of site.assignedCrewIds || []) {
            const w = g.crew.find((c) => c.id === id);
            if (w) {
              w.mood = Math.min(100, (w.mood ?? 50) + 15);
              w.loyalty = Math.min(100, (w.loyalty ?? 50) + 8);
            }
          }
          addLog2(g, `\u2B50 Crew bonus paid \u2014 ${money2(site.completionBonus)}. Morale boosted!`);
        }
        const _wasOnTime = daysLate === 0;
        const _qualityGood = (site.rushQualityPenalty || 0) < 0.05;
        const _repeatChance = _wasOnTime ? _qualityGood ? 0.45 : 0.25 : 0.1;
        if (Math.random() < _repeatChance) {
          if (!g.pendingRepeatClients) g.pendingRepeatClients = [];
          const _siteCityId = site.cityId || g.startingCityId || "salem";
          g.pendingRepeatClients.push({
            client: site.client,
            cityId: _siteCityId,
            appearsDay: g.day + rand2(3, 7),
            valueMult: _wasOnTime && _qualityGood ? 1.15 : 1
          });
        }
        if (g.activeGrant) {
          const _grantDef = CONTRACT_DEFS.find((c) => c.id === g.contracts.find((cc) => cc.id === site.contractId)?.defId);
          const _isInfra = _grantDef?.category === "Infrastructure" || _grantDef?.category === "Government";
          const _hasPaving = (_grantDef?.phases || []).some((p) => p === "Paving" || p === "Base Layer");
          if (g.activeGrant.type === "infrastructure" && (_isInfra || _hasPaving) && g.day <= g.activeGrant.deadline) {
            g.cash = (g.cash || 0) + g.activeGrant.reward;
            addLog2(g, `\u{1F3DB}\uFE0F Infrastructure grant awarded \u2014 ${money2(g.activeGrant.reward)} deposited!`);
            g.pendingStory = g.pendingStory || { icon: "ribbon", title: "Grant Awarded!", body: `You completed an infrastructure contract on time and earned the city grant of ${money2(g.activeGrant.reward)}.` };
            g.activeGrant = null;
          } else if (g.activeGrant.deadline < g.day) {
            addLog2(g, `\u{1F4CB} Government grant expired \u2014 contract not completed in time.`);
            g.activeGrant = null;
          }
        }
        const _completedDef = CONTRACT_DEFS.find((c) => c.id === g.contracts.find((cc) => cc.id === site.contractId)?.defId);
        if (_completedDef?.unlocksContractId) {
          const _unlockDef = CONTRACT_DEFS.find((c) => c.id === _completedDef.unlocksContractId);
          if (_unlockDef && !g.bids.some((b) => b.contractId === _unlockDef.id)) {
            const _newBid = { ..._unlockDef };
            _newBid.value = Math.round((_unlockDef.baseValue || _unlockDef.value || 1e4) * 1.15);
            _newBid.isChainUnlock = true;
            _newBid.id = `bid_chain_${Date.now()}`;
            _newBid.contractId = _unlockDef.id;
            _newBid.expiryDay = g.day + 14;
            if (!g.bids) g.bids = [];
            g.bids.unshift(_newBid);
            const _chainContract = {
              id: `chain_${uid2()}`,
              defId: _unlockDef.id,
              label: _unlockDef.label,
              category: _unlockDef.category || "Commercial",
              client: pick2(CLIENTS),
              value: _newBid.value,
              phases: [..._unlockDef.phases],
              minTier: _unlockDef.minTier,
              crewMin: _unlockDef.crewMin,
              equipMin: _unlockDef.equipMin,
              materials: { ..._unlockDef.materials || {} },
              penaltyPerDay: _unlockDef.penaltyPerDay,
              durationDays: _unlockDef.durationDays,
              deadline: g.day + _unlockDef.durationDays + rand2(3, 8),
              expiresDay: g.day + 14,
              status: "Open",
              desc: _unlockDef.desc,
              risk: _unlockDef.risk || 2,
              cityId: pickContractCity(g),
              isChainUnlock: true
            };
            g.contracts.push(_chainContract);
            addLog2(g, `\u{1F513} New opportunity unlocked: ${_unlockDef.label}`);
          }
        }
        const _contractDefForHistory = siteDef;
        const actualPayout = earned + qualityBonus;
        g.companyHistory = g.companyHistory || [];
        g.companyHistory.push({
          label: site.label,
          day: g.day,
          revenue: actualPayout,
          repGained: _contractDefForHistory?.repReward || 5,
          isMajor: !!_contractDefForHistory?.isMajorProject
        });
        if (g.companyHistory.length > 50) g.companyHistory = g.companyHistory.slice(-50);
        if (_contractDefForHistory?.isMajorProject && !g.pendingCeremony) {
          g.pendingCeremony = {
            label: site.label,
            day: g.day,
            revenue: actualPayout,
            repGained: _contractDefForHistory.repReward || 10,
            crewCount: site.assignedCrewIds?.length || 0,
            equipmentCount: site.assignedEquipmentIds?.length || 0
          };
        }
        if (!g.hallOfFame) g.hallOfFame = { biggestContract: 0, highestRep: 0, largestCrew: 0, largestFleet: 0, highestValuation: 0, mostProfitableProject: { label: "", value: 0 } };
        if (actualPayout > (g.hallOfFame.biggestContract || 0)) g.hallOfFame.biggestContract = actualPayout;
        if (actualPayout > (g.hallOfFame.mostProfitableProject?.value || 0)) {
          g.hallOfFame.mostProfitableProject = { label: site.label, value: actualPayout };
        }
        const _city = site.city || site.cityId || (g.unlockedCities?.[0] || "salem");
        if (!g.cityStats) g.cityStats = {};
        if (!g.cityStats[_city]) g.cityStats[_city] = { playerJobs: 0, rivalJobs: 0 };
        g.cityStats[_city].playerJobs = (g.cityStats[_city].playerJobs || 0) + 1;
        continue;
      } else {
        addLog2(g, `\u{1F528} ${site.label}: Phase "${completedPhaseName}" done. Starting "${site.phases[site.currentPhaseIdx]}".`);
      }
    }
    const isMidGameSite = (site.startDay || 0) > 30;
    const chaosBaseProb = isMidGameSite ? 0.015 : 0.012;
    const chaosProbMult = isMidGameSite ? 9.6 : 8;
    if (Math.random() < chaosBaseProb) {
      const siteEquip = g.equipment.find((e) => (site.assignedEquipmentIds || []).includes(e.id));
      const telematicsTier = siteEquip?.upgrades?.telematics || 0;
      const safetyTier = siteEquip?.upgrades?.safety || 0;
      const eligible = CHAOS_EVENTS.filter((e) => {
        let prob = e.prob * chaosProbMult;
        if (e.id === "breakdown") prob *= 1 - telematicsTier * 0.1;
        if (e.id === "safety" || e.id === "inspection") prob *= 1 - safetyTier * 0.09;
        return Math.random() < prob;
      });
      if (eligible.length) {
        const event = pick2(eligible);
        const result = event.apply(site, g);
        if (result) {
          if (!site.chaosHistory) site.chaosHistory = [];
          site.chaosHistory = [{ ...result, day: g.day }, ...site.chaosHistory].slice(0, 10);
          if (result.type === "breakdown" || result.type === "safety") {
            g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 2e3;
            applyIncident(g, result.type === "safety" ? 2 : 1);
          } else if (result.type === "permit" && Math.random() < 0.3) {
            applyInspectionPass(g);
          }
          checkChainEvents(site, g, result.type);
        }
        const siteCityDef = CITIES.find((c) => c.id === site.cityId);
        const siteRegion = siteCityDef?.region || "Pacific Northwest";
        if (Math.random() < 0.04) {
          const weatherResult = applyWeatherEvent(site, g, siteRegion);
          if (weatherResult) {
            site.chaosHistory = [{ ...weatherResult, day: g.day }, ...site.chaosHistory].slice(0, 10);
          }
        }
      }
    }
    for (const id of site.assignedEquipmentIds) {
      const e = g.equipment.find((eq) => eq.id === id);
      if (!e) continue;
      e.fuel = Math.max(0, (e.fuel ?? e.fuelCap ?? 0) - 0.5 * MINS_PER_TICK / 60);
      if (e.fuel <= 0 && e.fuelCap > 0 && e.status === "Active") {
        e.status = "Idle";
        e.assignedSiteId = null;
        site.assignedEquipmentIds = site.assignedEquipmentIds.filter((eid) => eid !== e.id);
        addLog2(g, `\u26FD ${e.name} ran out of fuel \u2014 pulled from ${site.label}. Refuel overnight.`);
      }
    }
    const _seasonStamDrain = (g.seasonStaminaMult || 1) * 0.25;
    for (const id of site.assignedCrewIds) {
      const w = g.crew.find((w2) => w2.id === id);
      if (!w) continue;
      w.stamina = Math.max(0, w.stamina - _seasonStamDrain * MINS_PER_TICK / 60);
      if (Math.random() < 0.05 && (w.skill || 0) < 120) w.skill = Math.min(120, (w.skill || 75) + 1);
      if (w.stamina < 10 && w.status === "Active") {
        w.status = "Idle";
        w.assignedSiteId = null;
        site.assignedCrewIds = site.assignedCrewIds.filter((cid) => cid !== w.id);
        addLog2(g, `\u26A0 ${w.name} exhausted \u2014 pulled from ${site.label}.`);
      }
      if (w.status === "Active" && Math.random() < 0.017 && (w._lastBanter || 0) < g.day) {
        w._lastBanter = g.day;
        const _banterSite = g.activeSites.find((s) => (s.assignedCrewIds || []).includes(w.id));
        const BANTER = {
          "Reliable": [`${w.name}: "Another solid day on the tools."`, `${w.name} checked every connection twice before moving on. That's why we hire them.`],
          "Skilled": [`${w.name} spotted a structural issue before it became a problem \u2014 quick thinking saves time.`, `${w.name}: "These specs are tight, but I've seen worse."`],
          "Fast": [`${w.name} is moving at pace today \u2014 ${_banterSite?.label || "the site"} is flying.`, `${w.name}: "Let's get this wrapped up. I've got another job in mind."`],
          "Careful": [`${w.name} triple-checked the measurements before cutting. Slow is smooth.`, `${w.name}: "I'd rather do it right once than rush and do it twice."`],
          "Veteran": [`${w.name}: "Built half the buildings in this city. This one will be no different."`, `${w.name} has a story about every street corner \u2014 keeps the crew laughing.`],
          "Ambitious": [`${w.name} asked about project management training again. Good sign.`, `${w.name}: "When do I get my own crew to lead?"`],
          "Lazy": [`${w.name} took a long lunch. Crew noticed \u2014 morale dipped slightly.`, `${w.name}: "Nearly done, right? We've been at this for hours."`],
          "Hardworking": [`${w.name} stayed late to finish the rough-in. Didn't ask for extra pay.`, `${w.name}: "Not leaving till this phase is clean."`],
          "Loyal": [`${w.name}: "Wouldn't work for anyone else in this city."`, `${w.name} turned down a rival's recruiter call. "I'm happy where I am."`]
        };
        const _banterLines = BANTER[w.trait?.label] || [`${w.name} got on with the job today.`];
        addLog2(g, `\u{1F4AC} ${_banterLines[Math.floor(Math.random() * _banterLines.length)]}`, "sub");
        if (w.trait?.label === "Lazy") {
          const _randomCrew = g.crew[Math.floor(Math.random() * g.crew.length)];
          if (_randomCrew) _randomCrew.mood = Math.max(0, (_randomCrew.mood ?? 50) - 1);
        }
      }
    }
  }
  g.activeSites = g.activeSites.filter((s) => s.status === "Active" || s.status === "Paused");
  if (newDay) {
    const daysSinceLogin = (g.day || 1) - (g.lastLoginDay || 0);
    if (daysSinceLogin === 1) {
      g.consecutiveLoginDays = (g.consecutiveLoginDays || 0) + 1;
      const streakBonus = Math.min(500, (g.consecutiveLoginDays || 1) * 50);
      if ((g.consecutiveLoginDays || 0) >= 3) {
        g.cash += streakBonus;
        addLog2(g, `\u{1F3AF} ${g.consecutiveLoginDays}-day streak! Bonus: ${money2(streakBonus)}.`);
      }
    } else if (daysSinceLogin > 2) {
      g.consecutiveLoginDays = 1;
    }
    g.lastLoginDay = g.day;
    const activePayrollEvent = g.activeMarketEvent ? MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent) : null;
    const crewWageMod = activePayrollEvent?.crewWageMod || 0;
    const dailyPayroll = [...g.crew.filter((w) => w.onShift !== false), ...g.officeStaff].reduce((s, p) => s + (p.wagePerDay || 0) * (1 + crewWageMod), 0);
    const office = OFFICES[g.officeIndex];
    const dailyRent = office.dailyRent;
    const equipCost = g.equipment.reduce((s, e) => s + e.dailyCost, 0);
    const totalOverhead = dailyPayroll + dailyRent + equipCost;
    g.cash -= totalOverhead;
    g.expenses += totalOverhead;
    g.weeklyStats.expenses += totalOverhead;
    for (const _site of g.activeSites || []) {
      if (_site.status === "Complete") continue;
      let _siteWages = 0;
      let _siteCrewCount = 0;
      for (const _id of _site.assignedCrewIds || []) {
        const _w = g.crew.find((w) => w.id === _id);
        if (!_w || _w.onShift === false) continue;
        _siteWages += (_w.wagePerDay || 0) * (1 + crewWageMod);
        _siteCrewCount += 1;
      }
      let _siteEquip = 0;
      let _siteEquipCount = 0;
      for (const _id of _site.assignedEquipmentIds || []) {
        const _e = g.equipment.find((e) => e.id === _id);
        if (!_e) continue;
        _siteEquip += _e.dailyCost || 0;
        _siteEquipCount += 1;
      }
      accrueProjectCost(_site, "labor", Math.round(_siteWages));
      accrueProjectCost(_site, "equipment", Math.round(_siteEquip));
      accrueProjectCrewDay(_site, _siteCrewCount, _siteEquipCount);
    }
    for (const w of g.crew) {
      if (w.status === "Idle") {
        w.stamina = Math.min(100, w.stamina + rand2(15, 25));
        w.mood = Math.min(100, w.mood + rand2(2, 6));
      }
    }
    for (const site of g.activeSites) {
      if (site.currentWeather && site.currentWeather.endsDay <= g.day) {
        site.currentWeather = null;
      }
    }
    for (const sc of g.subcontractors || []) {
      if (sc.status === "Idle" && sc.daysLeft > 0) sc.status = "Active";
    }
    for (const e of g.equipment) {
      if (e.status === "Idle") e.fuel = Math.min(e.fuelCap, e.fuel + e.fuelCap * 0.3);
    }
    g.bids = (g.bids || []).filter((b) => !b.expiryDay || b.expiryDay >= g.day || b.isActive);
    if ((g.pendingRepeatClients || []).length > 0) {
      const _dueToday = g.pendingRepeatClients.filter((rc) => rc.appearsDay <= g.day);
      for (const rc of _dueToday) {
        const _base = createContract(g);
        _base.client = rc.client;
        _base.cityId = rc.cityId || g.startingCityId || "salem";
        _base.value = Math.round(_base.value * (rc.valueMult || 1));
        _base.label = "\u{1F504} " + _base.label;
        _base.expiresDay = g.day + 5;
        _base.isRepeatClient = true;
        g.contracts.push(_base);
        addLog2(g, `\u{1F504} ${rc.client} is back \u2014 new contract available in Bids!`);
      }
      g.pendingRepeatClients = g.pendingRepeatClients.filter((rc) => rc.appearsDay > g.day);
    }
    const _seasonIndex = Math.floor((g.day - 1) % 360 / 90);
    const _SEASONS = [
      { name: "Spring", emoji: "\u{1F331}", contractMult: 1.08, staminaMult: 1, desc: "Building season begins \u2014 demand is high." },
      { name: "Summer", emoji: "\u2600\uFE0F", contractMult: 1.15, staminaMult: 1.15, desc: "Peak summer \u2014 contracts pay premium but heat slows crews." },
      { name: "Fall", emoji: "\u{1F342}", contractMult: 1.2, staminaMult: 1, desc: "Pre-winter rush \u2014 book it before the cold hits." },
      { name: "Winter", emoji: "\u2744\uFE0F", contractMult: 0.9, staminaMult: 1, desc: "Slow season \u2014 focus on efficiency and crew training." }
    ];
    const _newSeason = _SEASONS[_seasonIndex];
    if (_newSeason.name !== g.currentSeason) {
      g.currentSeason = _newSeason.name;
      g.seasonEmoji = _newSeason.emoji;
      g.seasonContractMult = _newSeason.contractMult;
      g.seasonStaminaMult = _newSeason.staminaMult || 1;
      addLog2(g, `${_newSeason.emoji} Season change: ${_newSeason.name} \u2014 ${_newSeason.desc}`);
      g.pendingStory = g.pendingStory || { icon: "calendar", title: `${_newSeason.emoji} ${_newSeason.name} Season`, body: _newSeason.desc };
    }
    if (g.day % 7 === 0 && !g.contracts.some((c) => c.isWeeklyRush && c.status === "Open")) {
      const _rushBase = createContract(g);
      _rushBase.value = Math.round(_rushBase.value * 2.2);
      _rushBase.label = "\u26A1 Weekend Rush \u2014 " + _rushBase.label;
      _rushBase.deadline = g.day + 3;
      _rushBase.durationDays = 3;
      _rushBase.penaltyPerDay = Math.round((_rushBase.penaltyPerDay || 200) * 1.8);
      _rushBase.expiresDay = g.day + 1;
      _rushBase.isWeeklyRush = true;
      g.contracts.push(_rushBase);
      addLog2(g, `\u26A1 Weekend Rush Job available in Bids \u2014 2\xD7 pay, 3-day window. Expires tomorrow!`);
    }
    if (g.day % 14 === 0 && !g.hotMaterialDeal) {
      const _flashMats = MATERIAL_DEFS.filter((m) => m.id !== "fuel");
      const _flashMat = _flashMats[Math.floor(Math.random() * _flashMats.length)];
      const _discPct = rand2(25, 40);
      g.hotMaterialDeal = {
        matId: _flashMat.id,
        label: _flashMat.label,
        discountPct: _discPct,
        expiresDay: g.day + 2,
        unitPrice: Math.round((g.materialPrices[_flashMat.id] || _flashMat.basePrice) * (1 - _discPct / 100))
      };
      addLog2(g, `\u{1F4CA} Market Flash: ${_flashMat.label} dropped ${_discPct}% \u2014 bulk buy available for 2 days!`);
    }
    if (g.hotMaterialDeal && g.hotMaterialDeal.expiresDay < g.day) {
      g.hotMaterialDeal = null;
    }
    g.contracts = g.contracts.filter((c) => c.status !== "Open" || c.expiresDay >= g.day);
    while (g.contracts.filter((c) => c.status === "Open").length < 5) {
      g.contracts.push(createContract(g));
    }
    const openPool = g.contracts.filter((c) => c.status === "Open");
    g.contracts = [...g.contracts.filter((c) => c.status !== "Open"), ...openPool.slice(0, 7)];
    for (const m of MATERIAL_DEFS) {
      const current = g.materialPrices[m.id] || m.basePrice;
      const change = (Math.random() - 0.5) * 2 * m.volatility * current;
      g.materialPrices[m.id] = Math.round(Math.max(m.basePrice * 0.6, Math.min(m.basePrice * 1.8, current + change)));
    }
    if (g.day % 10 === 0) {
      const r = Math.random();
      g.marketState = r < 0.25 ? "Boom" : r < 0.5 ? "Slow" : "Normal";
      if (g.marketState !== "Normal") {
        addLog2(g, `\u{1F4C8} Market shift: ${g.marketState} conditions affecting contract values.`);
      }
    }
    for (const loan of g.loans || []) {
      if (loan.weeksLeft > 0 && loan.remainingBalance > 0) {
        const dailyInterest = Math.round(loan.remainingBalance * 5e-3);
        if (dailyInterest > 0) {
          loan.remainingBalance += dailyInterest;
          g.weeklyStats.expenses += dailyInterest;
        }
      }
    }
    if (g.day % 7 === 0 && g.loans.length) {
      for (const loan of g.loans) {
        if (loan.weeksLeft <= 0) continue;
        if (g.cash >= loan.weeklyPayment) {
          g.cash -= loan.weeklyPayment;
          loan.remainingBalance = Math.max(0, loan.remainingBalance - loan.weeklyPayment);
          loan.weeksLeft -= 1;
          if (loan.weeksLeft <= 0) addLog2(g, `\u2705 Loan "${loan.label}" fully repaid!`);
        } else {
          loan.missedPayments = (loan.missedPayments || 0) + 1;
          g.creditScore = Math.max(300, g.creditScore - 15);
          addLog2(g, `\u26A0 Missed loan payment on "${loan.label}" \u2014 credit score hit.`);
        }
      }
      g.loans = g.loans.filter((l) => l.weeksLeft > 0);
    }
    tickEquipmentWear(g);
    if (g.day % 7 === 0) {
      const _ownedProps = g.properties || [];
      if (_ownedProps.length > 0) {
        const _propIncome = _ownedProps.reduce((sum, p) => {
          const _pdef = PROPERTY_TYPES.find((t) => t.id === p.typeId);
          return sum + (_pdef?.weeklyIncome || 0);
        }, 0);
        if (_propIncome > 0) {
          g.cash += _propIncome;
          g.revenue += _propIncome;
          g.weeklyStats.revenue = (g.weeklyStats.revenue || 0) + _propIncome;
          addLog2(g, `\u{1F3D7}\uFE0F Property income: +${money2(_propIncome)} passive revenue from ${_ownedProps.length} propert${_ownedProps.length === 1 ? "y" : "ies"}.`);
        }
      }
      const weeklyRevenue = g.weeklyStats.revenue || 0;
      if (weeklyRevenue > 0) {
        g.taxDue = (g.taxDue || 0) + Math.round(weeklyRevenue * 0.12);
      }
      const weekRev = g.weeklyStats.revenue || 0;
      const weekExp = g.weeklyStats.expenses || 0;
      const weekProfit = weekRev - weekExp;
      addLog2(g, `\u{1F4CA} Week ${Math.floor(g.day / 7)} summary: Revenue ${money2(weekRev)} | Expenses ${money2(weekExp)} | Net ${weekProfit >= 0 ? "+" : ""}${money2(weekProfit)}`);
      g.weeklyReport = { revenue: weekRev, expenses: weekExp, jobsCompleted: g.weeklyStats.jobsCompleted || 0, unexpectedCosts: g.weeklyStats.unexpectedCosts || 0, onTimeJobs: g._weekOnTimeJobs || 0, week: Math.floor(g.day / 7), day: g.day };
      g._weekOnTimeJobs = 0;
      const _wc = g.weeklyChallenge;
      const _needsNew = !_wc || g.day - (_wc.startDay || 0) >= 7 && (_wc.progress < 0 || _wc.claimedDay !== null);
      if (_needsNew) generateWeeklyChallenge(g);
      g.weeklyStats = { revenue: 0, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0 };
    }
    if ((g.savings || 0) > 0) {
      const _savInt = Math.round(g.savings * 12e-4);
      if (_savInt >= 1) {
        g.cash += _savInt;
        g.revenue += _savInt;
        g.weeklyStats.revenue += _savInt;
        g.weeklyStats.savingsInterest = (g.weeklyStats.savingsInterest || 0) + _savInt;
        if (g.day % 7 === 0) addLog2(g, `\u{1F3E6} Reserve savings earned ${money2(g.weeklyStats.savingsInterest || _savInt)} in interest this week. Balance: ${money2(g.savings)}.`);
      }
    }
    if (g.creditLine && (g.creditLine.drawn || 0) > 0) {
      const _clInt = Math.round(g.creditLine.drawn * 0.14 / 365);
      if (_clInt > 0) {
        g.creditLine.drawn = (g.creditLine.drawn || 0) + _clInt;
        g.expenses += _clInt;
        g.weeklyStats.expenses += _clInt;
      }
    }
    if ((g.taxDue || 0) > 0) {
      g.taxOverdueDays = (g.taxOverdueDays || 0) + 1;
      if (g.taxOverdueDays >= 14) g.businessFrozen = true;
    }
    if (g.cash < 0) {
      addLog2(g, `\u26A0 Day ${g.day}: Overhead ${money2(totalOverhead)} \u2014 account in the red!`);
      if (g.day <= 10 && g.cash < -500) {
        const grant = Math.abs(g.cash) + 1e3;
        g.cash += grant;
        addLog2(g, `\u{1F198} Emergency grant: +${money2(grant)} \u2014 business is not allowed to die on Day ${g.day}.`);
      }
    }
    if (g.cash > 0 && g.cash < 2e3 && g.day > 5) {
      if (!g._lowCashWarned || g.day - g._lowCashWarned > 3) {
        g._lowCashWarned = g.day;
        addLog2(g, `\u26A0 Cash is critically low (${money2(g.cash)}) \u2014 take a contract or get a loan.`);
      }
    }
    for (const site of g.activeSites) {
      if (g.day > site.deadlineDay && site.status === "Active") {
        addLog2(g, `\u26A0 ${site.label} is overdue \u2014 daily penalty of ${money2(site.penaltyPerDay)} accruing.`);
      }
    }
    checkMilestones(g);
    if (newDay) {
      const _curRank = computeNationalRank(g);
      if (_curRank === 1 && !g._rankOneCelebrated) {
        g._rankOneCelebrated = true;
        g.cash += 1e4;
        g.revenue += 1e4;
        g.reputation = Math.min(100, (g.reputation || 0) + 3);
        addImportantNotice(g, "\u{1F3C6} You are now the #1 construction company in America! +$10,000 + 3 rep.", "green");
        addLog2(g, "\u{1F3C6} Reached National Rank #1 \u2014 construction dynasty rising!");
      }
      const _val = computeValuation(g);
      const _valMilestones = [
        { v: 1e6, label: "$1M", reward: 5e3, rep: 2 },
        { v: 5e6, label: "$5M", reward: 15e3, rep: 5 },
        { v: 1e7, label: "$10M", reward: 3e4, rep: 8 },
        { v: 25e6, label: "$25M", reward: 75e3, rep: 12 }
      ];
      if (!g._valuationMilestonesHit) g._valuationMilestonesHit = [];
      for (const vm of _valMilestones) {
        if (_val >= vm.v && !g._valuationMilestonesHit.includes(vm.label)) {
          g._valuationMilestonesHit.push(vm.label);
          g.cash += vm.reward;
          g.revenue += vm.reward;
          g.reputation = Math.min(100, (g.reputation || 0) + vm.rep);
          addImportantNotice(g, `\u{1F4B0} ${vm.label} valuation milestone! +${money2(vm.reward)} + ${vm.rep} rep.`, "green");
        }
      }
      const _compLevel = COMPANY_LEVELS.slice().reverse().find((l) => (g.reputation || 0) >= l.repMin && (g.completedJobs || 0) >= l.jobsMin && computeValuation(g) >= l.valMin) || COMPANY_LEVELS[0];
      const _totalDebt = (g.loans || []).reduce((s, l) => s + (l.remaining || 0), 0);
      if (_compLevel.level >= 10 && _curRank === 1 && _totalDebt === 0 && !g._pendingPrestige && !g.hallOfFame?.prestigeReached) {
        g._pendingPrestige = true;
        addImportantNotice(g, "\u{1F451} Dynasty conditions met \u2014 Level 10, Rank #1, debt-free! Claim your Legacy on the Empire tab.", "green");
      }
    }
    recoverSafetyScores(g);
    checkAchievements(g);
    if (g.day % 7 === 0) captureEconomicSnapshot(g);
    if (g.day % 30 === 0) {
      const plan = INSURANCE_PLANS.find((p) => p.id === (g.insurancePlanId || "none"));
      if (plan && plan.monthlyPremium > 0) {
        g.cash -= plan.monthlyPremium;
        g.expenses += plan.monthlyPremium;
        addLog2(g, `\u{1F6E1}\uFE0F Insurance premium paid: ${money2(plan.monthlyPremium)} (${plan.label})`);
      }
    }
    if (!g.legacyStats) g.legacyStats = initLegacyStats();
    g.legacyStats.totalRevenue = g.revenue || 0;
    g.legacyStats.totalPayroll = g.expenses || 0;
    for (const w of g.crew) {
      if (w.status === "Resting") {
        w.stamina = Math.min(100, (w.stamina ?? 50) + 12);
        w.mood = Math.min(100, (w.mood ?? 50) + 0.5);
        if ((w.stamina ?? 50) >= (w.restUntilStamina || 80)) {
          w.status = "Idle";
          w.restUntilStamina = void 0;
          addLog2(g, `\u{1F634} ${w.name} has rested and is ready to work again.`);
        }
      }
    }
    const activeCrewIds = /* @__PURE__ */ new Set();
    for (const site of g.activeSites) {
      if (site.status === "Active") {
        (site.assignedCrewIds || []).forEach((id) => activeCrewIds.add(id));
      }
    }
    for (const w of g.crew) {
      if (w.status === "Active" && !activeCrewIds.has(w.id)) {
        w.status = "Idle";
      }
      if (w.status === "Idle" && activeCrewIds.has(w.id)) {
        w.status = "Active";
      }
    }
    checkWorkerTurnover(g);
    checkPromotion(g);
    checkWeeklyChallenge(g, "daily", 0);
    applyEquipmentAging(g);
    decrementTraining(g);
    enhancedRivalDailyLogic(g);
    enhancedRivalBidding(g, g.contracts.filter((c) => c.status === "Open"));
    if (g._steelPriceLock && g.day <= g._steelPriceLock && g._steelPriceLocked) {
      g.materialPrices.steel = g._steelPriceLocked;
    } else if (g._steelPriceLock && g.day > g._steelPriceLock) {
      delete g._steelPriceLock;
      delete g._steelPriceLocked;
    }
    if (g.activeMarketEvent) {
      g.marketEventDaysLeft = Math.max(0, (g.marketEventDaysLeft || 1) - 1);
      if (g.marketEventDaysLeft <= 0) {
        const evt = MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent);
        addLog2(g, `\u{1F4CA} Market event ended: "${evt?.label || g.activeMarketEvent}". Conditions normalising.`);
        g.activeMarketEvent = null;
      }
    } else if (g.day % 8 === 0 && Math.random() < 0.3) {
      const evt = pick2(MARKET_EVENTS);
      g.activeMarketEvent = evt.id;
      g.marketEventDaysLeft = evt.duration;
      addLog2(g, `${evt.icon} Market event: "${evt.label}" \u2014 ${evt.desc}`);
    }
    if (!g.subcontractors) g.subcontractors = [];
    const subPayroll = g.subcontractors.reduce((s, sc) => s + (sc.wagePerDay || 0) * (sc.count || 1), 0);
    if (subPayroll > 0) {
      g.cash -= subPayroll;
      g.expenses += subPayroll;
    }
    for (const sc of g.subcontractors) {
      sc.daysLeft = (sc.daysLeft || 0) - 1;
      if (Math.random() > sc.reliability && sc.status === "Active") {
        sc.status = "Idle";
        const site = g.activeSites.find((s) => s.id === sc.assignedSiteId);
        if (site) {
          site.assignedCrewIds = site.assignedCrewIds.filter((id) => id !== sc.id);
          addLog2(g, `\u26A0 Subcontractor "${sc.name}" didn't show up today.`);
        }
      }
    }
    g.subcontractors = g.subcontractors.filter((sc) => sc.daysLeft > 0);
    const activeEvent = g.activeMarketEvent ? MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent) : null;
    if (activeEvent && activeEvent.equipDailyCostMult !== 1) {
      const surcharge = Math.round(g.equipment.reduce((s, e) => s + e.dailyCost, 0) * (activeEvent.equipDailyCostMult - 1));
      if (surcharge > 0) {
        g.cash -= surcharge;
        g.expenses += surcharge;
      }
    }
    const officeRent = (g.cityOffices || []).reduce((s, o) => {
      const def = REGIONAL_OFFICE_TYPES.find((t) => t.id === o.typeId);
      return s + (def ? def.dailyRent : 0);
    }, 0);
    if (officeRent > 0) {
      g.cash -= officeRent;
      g.expenses += officeRent;
    }
    const propCost = (g.properties || []).reduce((s, p) => {
      const def = PROPERTY_TYPES.find((t) => t.id === p.typeId);
      return s + (def ? def.dailyCost : 0);
    }, 0);
    if (propCost > 0) {
      g.cash -= propCost;
      g.expenses += propCost;
    }
    const pmPayroll = (g.projectManagers || []).reduce((s, pm) => s + (pm.wagePerDay || 0), 0);
    if (pmPayroll > 0) {
      g.cash -= pmPayroll;
      g.expenses += pmPayroll;
    }
    const hasAutoMgr = (g.projectManagers || []).some((pm) => {
      const def = PM_TIERS.find((t) => t.id === pm.typeId);
      return def?.autoManage;
    });
    if (hasAutoMgr) {
      for (const site of g.activeSites) {
        if (site.status === "Paused" && Math.random() < 0.6) {
          site.status = "Active";
          site.pausedDays = 0;
          addLog2(g, `\u{1F4CB} PM intervened \u2014 "${site.label}" back on track.`);
        }
      }
    }
    if (!g.hallOfFame) g.hallOfFame = { biggestContract: 0, highestRep: 0, largestCrew: 0, largestFleet: 0, highestValuation: 0, mostProfitableProject: { label: "", value: 0 } };
    if ((g.reputation || 0) > (g.hallOfFame.highestRep || 0)) g.hallOfFame.highestRep = g.reputation;
    if ((g.crew?.length || 0) > (g.hallOfFame.largestCrew || 0)) g.hallOfFame.largestCrew = g.crew.length;
    if ((g.equipment || []).length > (g.hallOfFame.largestFleet || 0)) g.hallOfFame.largestFleet = (g.equipment || []).length;
    if ((g.companyValuation || 0) > (g.hallOfFame.highestValuation || 0)) g.hallOfFame.highestValuation = g.companyValuation;
    const _prevRank = g._prevNationalRank || g.nationalRank || 99;
    g.nationalRank = computeNationalRank(g);
    g.marketShare = computeMarketShare(g);
    g.companyValuation = computeValuation(g);
    if (g.nationalRank < _prevRank) {
      const _passed = (g.rivals || []).filter((r) => !(g.acquiredRivals || []).includes(r.id) && r.status !== "Bankrupt").find((r) => r._rank === g.nationalRank + 1);
      if (_passed) addLog2(g, `\u{1F4C8} You just overtook ${_passed.name} in national rankings! They won't take that lying down.`);
    } else if (g.nationalRank > _prevRank) {
      const _overtaker = (g.rivals || []).find((r) => r._rank === g.nationalRank - 1);
      if (_overtaker) addLog2(g, `\u{1F4C9} ${_overtaker.name} just pushed you down to #${g.nationalRank}. Time to step up.`);
    }
    g._prevNationalRank = g.nationalRank;
    if (g.day % 10 === 0) {
      const _topRival = (g.rivals || []).filter((r) => r.status !== "Bankrupt" && !(g.acquiredRivals || []).includes(r.id)).sort((a, b) => (b.rep || 0) - (a.rep || 0))[0];
      if (_topRival && Math.random() < 0.5) {
        const TAUNTS = [
          `\u{1F4F0} Industry news: ${_topRival.name} wins a major contract in ${(_topRival.cityPresence || ["salem"])[0]}.`,
          `\u{1F4F0} Contractors Weekly: "${_topRival.name} eyes regional expansion."`,
          `\u{1F4F0} ${_topRival.name} hired 3 new crew this week. They're growing fast.`
        ];
        addLog2(g, TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
      }
    }
    const cityValThresholds = [
      { cityId: "portland", valThreshold: 1e5 },
      { cityId: "eugene", valThreshold: 5e5 },
      { cityId: "seattle", valThreshold: 2e6 },
      { cityId: "boise", valThreshold: 1e7 }
    ];
    for (const t of cityValThresholds) {
      const alreadyUnlocked = (g.unlockedCities || []).includes(t.cityId);
      if (!alreadyUnlocked && g.companyValuation >= t.valThreshold) {
        if (!g.unlockedCities) g.unlockedCities = [];
        g.unlockedCities.push(t.cityId);
        const cityDef = CITIES.find((c) => c.id === t.cityId);
        addLog2(g, `\u{1F3D9}\uFE0F ${cityDef?.name || t.cityId} is now available for expansion! Your company growth qualifies.`);
      }
    }
    if (!g.pendingDecision && (g.day % 15 === 0 && Math.random() < 0.4 || g.day % 7 === 0 && Math.random() < 0.12)) {
      const evt = pick2(DECISION_EVENTS);
      g.pendingDecision = {
        id: evt.id,
        title: evt.title,
        tone: evt.tone,
        desc: evt.desc,
        options: evt.options.map((o) => ({ label: o.label, sub: o.sub }))
      };
    }
    if (!g.pendingDecision && (g.activeSites || []).some((s) => (s.assignedCrewIds || []).length > 0)) {
      if (Math.random() < 17e-4) {
        const siteWithCrew = pick2((g.activeSites || []).filter((s) => (s.assignedCrewIds || []).length > 0));
        const workerId = siteWithCrew ? pick2(siteWithCrew.assignedCrewIds) : null;
        const worker = workerId ? (g.crew || []).find((c) => c.id === workerId) : null;
        const assignedEquip = siteWithCrew ? (g.equipment || []).find((e) => (siteWithCrew.assignedEquipmentIds || []).includes(e.id)) : null;
        const evt = pick2(EMPLOYEE_EVENTS);
        g.pendingDecision = {
          id: evt.id,
          title: evt.title,
          tone: evt.tone,
          desc: worker ? evt.desc.replace("A crew member", worker.name).replace("An employee", worker.name) : evt.desc,
          context: { workerId: workerId || null, siteId: siteWithCrew?.id || null, equipId: assignedEquip?.id || null },
          options: evt.options.map((o) => ({ label: o.label, sub: o.sub }))
        };
      }
    }
    for (const w of g.crew) {
      const yearsWorked = Math.floor((g.day - (w.hireDay || 0)) / 365);
      if (yearsWorked > 0 && (g.day - (w.hireDay || 0)) % 365 === 0) {
        w.mood = Math.min(100, (w.mood ?? 50) + 15);
        w.loyalty = Math.min(100, (w.loyalty ?? 50) + 8);
        addLog2(g, `\u{1F382} ${w.name} just hit their ${yearsWorked}-year anniversary! Morale +15.`);
        if (!g.pendingStory && yearsWorked >= 2) {
          g.pendingStory = { icon: "happy", title: `${w.name}'s Anniversary`, body: `${yearsWorked} years with the company. ${w.name} is a cornerstone of your team.` };
        }
      }
    }
    const justBankrupt = (g.rivals || []).find((r) => r.status === "Bankrupt" && !(g._stories || []).includes(`bankrupt_${r.id}`));
    if (justBankrupt) {
      g._stories = [...g._stories || [], `bankrupt_${justBankrupt.id}`];
      g.pendingStory = g.pendingStory || { icon: "trending-down", title: `${justBankrupt.name} Collapses!`, body: `${justBankrupt.name} has gone bankrupt. Their contracts and market share are now up for grabs.` };
    }
    if ((g.cityOffices || []).length === 1 && !(g._stories || []).includes("first_city")) {
      g._stories = [...g._stories || [], "first_city"];
      const city = CITIES.find((c) => c.id === g.cityOffices[0]?.cityId);
      g.pendingStory = g.pendingStory || { icon: "business", title: "First City Conquered!", body: `You've opened an office in ${city?.name || "a new city"}. Your empire is expanding beyond home.` };
    }
    if (g.autoAssignCrew) {
      for (const site of g.activeSites) {
        if (site.status !== "Active") continue;
        const needed = (site.crewMin || 2) - (site.assignedCrewIds || []).length;
        if (needed <= 0) continue;
        const idleCrew = g.crew.filter((w) => w.status === "Idle");
        const toAssign = idleCrew.slice(0, needed);
        for (const w of toAssign) {
          w.status = "Active";
          w.assignedSiteId = site.id;
          site.assignedCrewIds = [...site.assignedCrewIds || [], w.id];
        }
        if (toAssign.length > 0) {
          addLog2(g, `\u26A1 Auto-assigned ${toAssign.length} crew to "${site.label}".`);
        }
      }
    }
    if (g.autoAssignEquipment) {
      for (const site of g.activeSites) {
        if (site.status !== "Active") continue;
        if ((site.assignedEquipmentIds || []).length > 0) continue;
        const idleEquip = g.equipment.filter((e2) => e2.status === "Idle" && !e2.assignedSiteId);
        if (idleEquip.length === 0) continue;
        const e = idleEquip[0];
        e.status = "Active";
        e.assignedSiteId = site.id;
        site.assignedEquipmentIds = [...site.assignedEquipmentIds || [], e.id];
        addLog2(g, `\u26A1 Auto-assigned ${e.name} to "${site.label}".`);
      }
    }
    if (g.autoRepairEquipment && newDay) {
      for (const eq of g.equipment || []) {
        if (eq.condition < 50 && eq.status !== "Maintenance") {
          const repCost = Math.round((eq.price || 5e3) * 0.15);
          if (g.cash >= repCost) {
            g.cash -= repCost;
            g.expenses = (g.expenses || 0) + repCost;
            eq.condition = Math.min(100, (eq.condition || 0) + 40);
            if (eq.status === "Broken") eq.status = "Idle";
            addLog2(g, `\u{1F527} Auto-repaired ${eq.name} \u2014 ${money2(repCost)}.`);
          }
        }
      }
    }
    if (g.autoPurchaseMaterials && newDay) {
      for (const site of g.activeSites || []) {
        if (site.status !== "Active") continue;
        const _con = (g.contracts || []).find((c) => c.id === site.contractId);
        const _def = CONTRACT_DEFS.find((d) => d.id === _con?.defId);
        if (!_def?.materials) continue;
        const _disc = getMaterialDiscount(g);
        for (const [matId, needed] of Object.entries(_def.materials)) {
          const have = (site.materialsFulfilled || {})[matId] || 0;
          if (have >= needed) continue;
          const shortage = needed - have;
          const price = (g.materialPrices || {})[matId] || 100;
          const cost = Math.round(shortage * price * (1 - _disc));
          if (g.cash >= cost) {
            g.cash -= cost;
            g.expenses = (g.expenses || 0) + cost;
            g.weeklyStats.expenses = (g.weeklyStats.expenses || 0) + cost;
            if (!site.materialsFulfilled) site.materialsFulfilled = {};
            site.materialsFulfilled[matId] = needed;
            accrueProjectCost(site, "materials", cost);
            addLog2(g, `\u26A1 Auto-purchased ${shortage} ${matId} for "${site.label}" \u2014 ${money2(cost)}.`);
          }
        }
      }
    }
    if (g.cash < -1e4) {
      g.bankruptcyDays = (g.bankruptcyDays || 0) + 1;
      if (g.bankruptcyDays >= 5) {
        g.gameOver = true;
        g.gameOverReason = "bankruptcy";
      } else {
        addLog2(g, `\u{1F6A8} Bankruptcy warning: ${money2(Math.abs(g.cash))} in debt \u2014 Day ${g.bankruptcyDays} of 5 before collapse.`);
      }
    } else if (g.cash >= 0) {
      g.bankruptcyDays = 0;
    }
    tickEmployeePersonalities(g);
    applyDailyPersonalityEvents(g);
    if (Array.isArray(g.inventory)) tickInventory(g);
    maybeFireRandomEvent(g, "construction", 0.06);
    initAiCompetitors(g, 3);
    tickAiCompetitors(g);
    initEconomy(g);
    tickEconomy(g);
    tickCustomerSatisfaction(g);
    initPricing(g);
    tickDemand(g, "construction");
    initWeather(g);
    tickWeather(g);
    tickPerformanceReviews(g);
    if ((g.day || 0) % 7 === 0) tickTeamMorale(g);
    tickContractRFPs(g);
    tickAnalytics(g);
    initTerritories(g, "construction");
    tickTerritories(g);
    const wxDelay = getConstructionWeatherDelay(g);
    if (wxDelay > 0) {
      (g.activeProjects || []).forEach((proj) => {
        if (proj.status === "Active") {
          proj.daysRemaining = (proj.daysRemaining || 0) + wxDelay;
        }
      });
    }
    checkEmpireGoals(g);
  }
  return g;
}
var COMPANY_LEVELS = [
  { level: 1, label: "Starting Out", repMin: 0, jobsMin: 0, valMin: 0 },
  { level: 2, label: "Local Contractor", repMin: 10, jobsMin: 3, valMin: 15e3 },
  { level: 3, label: "Growing Company", repMin: 20, jobsMin: 8, valMin: 5e4 },
  { level: 4, label: "Established Builder", repMin: 35, jobsMin: 20, valMin: 15e4 },
  { level: 5, label: "Regional Operator", repMin: 50, jobsMin: 40, valMin: 4e5 },
  { level: 6, label: "Major Contractor", repMin: 65, jobsMin: 75, valMin: 1e6 },
  { level: 7, label: "Industry Leader", repMin: 80, jobsMin: 120, valMin: 3e6 },
  { level: 8, label: "Construction Empire", repMin: 90, jobsMin: 200, valMin: 8e6 },
  { level: 9, label: "National Powerhouse", repMin: 95, jobsMin: 300, valMin: 15e6 },
  { level: 10, label: "Construction Dynasty", repMin: 99, jobsMin: 500, valMin: 25e6 }
];
function getCompanyLevel(g) {
  const val = computeValuation(g);
  let best = COMPANY_LEVELS[0];
  for (const lvl of COMPANY_LEVELS) {
    if ((g.reputation || 0) >= lvl.repMin && (g.completedJobs || 0) >= lvl.jobsMin && val >= lvl.valMin) best = lvl;
  }
  return best;
}
function getLegacyScore(g) {
  const repScore = Math.min(40, (g.reputation || 0) * 0.4);
  const projectScore = Math.min(20, (g.completedJobs || 0) * 0.2);
  const cityScore = Math.min(10, ((g.unlockedCities?.length || 1) - 1) * 2.5);
  const marketScore = Math.min(15, (g.companyValuation || 0) / 1e6 * 1.5);
  const crewScore = Math.min(10, (g.crew?.length || 0) * 0.5);
  const total = Math.round(repScore + projectScore + cityScore + marketScore + crewScore);
  const tiers = [
    { min: 80, label: "Industry Legend", icon: "trophy" },
    { min: 60, label: "National Powerhouse", icon: "business" },
    { min: 40, label: "State Leader", icon: "star" },
    { min: 20, label: "Regional Contractor", icon: "construct" },
    { min: 0, label: "Local Builder", icon: "hammer" }
  ];
  const tier = tiers.find((t) => total >= t.min) || tiers[tiers.length - 1];
  return { score: total, label: tier.label, icon: tier.icon };
}
var REAL_SECONDS_PER_GAME_MINUTE = 0.1;
var MAX_OFFLINE_REAL_SECONDS = 7 * 24 * 3600;
var OFFLINE_SUMMARY_THRESHOLD_GAME_MINUTES = 5;
function computeOfflineProgress(savedGame, nowTimestamp) {
  const lastTs = savedGame.lastRealTimestamp;
  if (!lastTs || !nowTimestamp) return null;
  const elapsedRealSeconds = Math.min(MAX_OFFLINE_REAL_SECONDS, Math.max(0, (nowTimestamp - lastTs) / 1e3));
  if (elapsedRealSeconds < 1) return null;
  const elapsedGameMinutes = Math.floor(elapsedRealSeconds / REAL_SECONDS_PER_GAME_MINUTE);
  if (elapsedGameMinutes < OFFLINE_SUMMARY_THRESHOLD_GAME_MINUTES) return null;
  const ticksToRun = Math.floor(elapsedGameMinutes / 30);
  if (ticksToRun < 1) return null;
  return { elapsedRealSeconds, elapsedGameMinutes, ticksToRun };
}
function applyOfflineProgress(savedGame, ticksToRun) {
  const MAX_TICKS = 480;
  const clampedTicks = Math.min(ticksToRun, MAX_TICKS);
  let g = clone(savedGame);
  const before = {
    cash: g.cash,
    completedJobs: g.completedJobs || 0,
    reputation: g.reputation || 0,
    day: g.day || 1,
    logCount: (g.logs || []).length
  };
  for (let i = 0; i < clampedTicks; i++) {
    const cashBefore = g.cash;
    g = gameTick(g);
    if (cashBefore > 0 && g.cash < cashBefore * 0.5 && g.cash < 0) {
      g.cash = Math.max(0, cashBefore * 0.5);
    }
    if (g.cash < -5e4) {
      g.cash = -5e4;
    }
  }
  const after = {
    cash: g.cash,
    completedJobs: g.completedJobs || 0,
    reputation: g.reputation || 0,
    day: g.day || 1
  };
  const cashDelta = after.cash - before.cash;
  const jobsDelta = after.completedJobs - before.completedJobs;
  const repDelta = after.reputation - before.reputation;
  const daysDelta = after.day - before.day;
  const logsWhileAway = (g.logs || []).slice(before.logCount).slice(-6);
  const dailyWages = (g.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0);
  const dailyEquip = (g.equipment || []).reduce((s, e) => s + e.dailyCost, 0);
  const dailyRent = OFFICES[g.officeIndex || 0]?.dailyRent || 0;
  const overheadPerDay = Math.round(dailyWages + dailyEquip + dailyRent);
  g.pendingOfflineSummary = {
    elapsedDays: daysDelta,
    cashDelta,
    jobsDelta,
    repDelta,
    cashNow: after.cash,
    overheadPerDay,
    logsWhileAway
  };
  g.lastRealTimestamp = Date.now();
  return g;
}
function ConstructionFlowScreen({ onBackToHub }) {
  const [game, setGame] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("Home");
  const [theme, setTheme] = useState("dark");
  const T = THEMES[theme] || THEMES.dark;
  const tickRef = useRef(null);
  const [speedMode, setSpeedMode] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const gameRef = useRef(null);
  const saveTimerRef = useRef(null);
  const [setupName, setSetupName] = useState("New Build Co.");
  const [setupCityId, setSetupCityId] = useState("salem");
  const [savingsAmt, setSavingsAmt] = useState("");
  const [creditLineAmt, setCreditLineAmt] = useState("");
  const [loanPayAmts, setLoanPayAmts] = useState({});
  const [setupStep, setSetupStep] = useState(0);
  const [setupStateId, setSetupStateId] = useState(null);
  const [setupHomeCityText, setSetupHomeCityText] = useState("");
  const [setupHomeStateCode, setSetupHomeStateCode] = useState("");
  const [setupHomeStateName, setSetupHomeStateName] = useState("");
  const [setupCompetition, setSetupCompetition] = useState("Low");
  const [setupStateSearch, setSetupStateSearch] = useState("");
  const [crewFilter, setCrewFilter] = useState("All");
  const [equipFilter, setEquipFilter] = useState("All");
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const integrity = checkSaveIntegrity(parsed);
          if (!integrity.valid) {
          }
          const saved = migrateState(parsed);
          const nowTs = Date.now();
          const offlineInfo = computeOfflineProgress(saved, nowTs);
          if (offlineInfo && offlineInfo.ticksToRun > 0) {
            const progressed = applyOfflineProgress(saved, offlineInfo.ticksToRun);
            setGame(progressed);
            setTheme(progressed.theme || "dark");
          } else {
            saved.lastRealTimestamp = nowTs;
            setGame(saved);
            setTheme(saved.theme || "dark");
          }
        } else {
          const fs = freshState();
          fs.lastRealTimestamp = Date.now();
          setGame(fs);
        }
      } catch (_) {
        const fs = freshState();
        fs.lastRealTimestamp = Date.now();
        setGame(fs);
      }
      setLoaded(true);
    })();
  }, []);
  const saveGame = useCallback((g) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(g)).catch(() => {
    });
  }, []);
  useEffect(() => {
    if (!game || !game.legacyMentor || (game.crew || []).length > 0) return;
    const timer = setTimeout(() => {
      setGame((prev) => {
        if (!prev || !prev.legacyMentor || (prev.crew || []).length > 0) return prev;
        const next = clone(prev);
        const m = next.legacyMentor;
        next.crew.push(createWorker({ name: m.name, skill: m.skill || 75, role: m.role, wagePerDay: m.wagePerDay || 60, loyalty: 90, jobsCompleted: 20 }));
        next.legacyMentor = null;
        addLog2(next, `\u2B50 ${m.name} returns as your legacy mentor from the previous dynasty.`);
        addImportantNotice(next, `${m.name} joins your new company at half their previous wage!`, "green");
        return next;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [game?.generation]);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    if (!loaded || !game) return;
    if (saveTimerRef.current) return;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (!gameRef.current) return;
      saveGame(gameRef.current);
    }, 2e3);
  }, [game, loaded, saveGame]);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const tickMs = speedMode ? 1500 : 3e3;
    tickRef.current = setInterval(() => {
      setGame((prev) => {
        if (!prev) return prev;
        try {
          let next = gameTick(prev);
          if (next.cash < -5e4) next.cash = -5e4;
          next.lastRealTimestamp = Date.now();
          return next;
        } catch (e) {
          if (__DEV__) console.warn("[ConstructionFlow] tick error:", e);
          return prev;
        }
      });
    }, tickMs);
    return () => clearInterval(tickRef.current);
  }, [loaded, speedMode]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      if (prev === "active" && next.match(/inactive|background/)) {
        if (gameRef.current) {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          const toSave = { ...gameRef.current, lastRealTimestamp: Date.now() };
          saveGame(toSave);
        }
      } else if (prev.match(/inactive|background/) && next === "active") {
        setGame((prevGame) => {
          if (!prevGame) return prevGame;
          const nowTs = Date.now();
          const offlineInfo = computeOfflineProgress(prevGame, nowTs);
          if (offlineInfo && offlineInfo.ticksToRun > 0) {
            const progressed = applyOfflineProgress(prevGame, offlineInfo.ticksToRun);
            saveGame(progressed);
            return progressed;
          }
          const updated = { ...prevGame, lastRealTimestamp: nowTs };
          saveGame(updated);
          return updated;
        });
      }
      appStateRef.current = next;
    });
    return () => sub?.remove();
  }, [saveGame]);
  const update = useCallback((fn) => {
    setGame((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
  }, []);
  const handleBuyEquipment = useCallback((item, isUsed = false) => {
    update((g) => {
      const discount = g._equipDiscount || 0;
      const basePrice = Math.round(item.price * (1 - discount));
      const effectivePrice = isUsed ? Math.round(basePrice * 0.58) : basePrice;
      if (g.cash < effectivePrice) {
        Alert.alert("Insufficient Funds", `Need ${money2(effectivePrice)}.`);
        return;
      }
      const office2 = OFFICES[g.officeIndex];
      const totalEquipCap = office2.equipCap + getEquipCapBonus(g);
      if (g.equipment.length >= totalEquipCap) {
        Alert.alert("Vehicles Cap", `Upgrade your office to add more vehicles to your fleet.`);
        return;
      }
      g.cash -= effectivePrice;
      g.expenses += effectivePrice;
      const equip = createEquipment(item);
      if (isUsed) {
        equip.condition = rand2(40, 68);
        equip.reliability = Math.round(item.reliability * 0.78);
        equip.isUsed = true;
      }
      g.equipment.push(equip);
      if (discount > 0) {
        delete g._equipDiscount;
        delete g._equipDiscountExpiry;
        addLog2(g, `\u{1F69C} ${isUsed ? "Used " : ""}${item.name} purchased for ${money2(effectivePrice)}${discount > 0 ? ` (${Math.round(discount * 100)}% discount)` : ""}.`);
      } else {
        addLog2(g, `\u{1F69C} ${isUsed ? "Used " : ""}${item.name} purchased for ${money2(effectivePrice)}.`);
      }
      trackEquipBuy(g);
    });
  }, [update]);
  const handleSpeedUp = useCallback(() => {
    const cur = gameRef.current;
    if (!cur) return;
    const uses = cur.speedUpUses || 0;
    const cost = Math.round(1e3 * Math.pow(2, uses));
    if (cur.cash < cost) {
      Alert.alert("Insufficient Funds", `You need ${money2(cost)} to speed up time.
Save up and try again.`);
      return;
    }
    Alert.alert(
      "\u26A1 Speed Up Time",
      `Advance 2 game hours for ${money2(cost)}?

${uses > 0 ? `Cost doubles each use \u2014 next will cost ${money2(cost * 2)}.` : "Cost doubles with each use."}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: `Pay ${money2(cost)}`, onPress: () => {
          setGame((prev) => {
            if (!prev || prev.cash < cost) return prev;
            let next = clone(prev);
            next.cash -= cost;
            next.expenses = (next.expenses || 0) + cost;
            next.speedUpUses = (next.speedUpUses || 0) + 1;
            for (let i = 0; i < 4; i++) next = gameTick(next);
            next.lastRealTimestamp = Date.now();
            addLog2(next, `\u26A1 Time advanced 2 hours \u2014 paid ${money2(cost)}.`);
            saveGame(next);
            return next;
          });
        } }
      ]
    );
  }, [saveGame]);
  const handleRepairEquipment = useCallback((equipId) => {
    update((g) => {
      const e = g.equipment.find((eq) => eq.id === equipId);
      if (!e) return;
      const cost = Math.round((100 - e.condition) * 25);
      if (g.cash < cost) {
        Alert.alert("Insufficient Funds", `Repair costs ${money2(cost)}.`);
        return;
      }
      g.cash -= cost;
      g.expenses += cost;
      e.condition = 100;
      e.fuel = e.fuelCap;
      e.status = "Idle";
      if (g.pendingBreakdown?.equipId === equipId) g.pendingBreakdown = null;
      addLog2(g, `\u{1F527} ${e.name} repaired and fuelled for ${money2(cost)}.`);
    });
  }, [update]);
  const handleSellEquipment = useCallback((equipId) => {
    update((g) => {
      const e = g.equipment.find((eq) => eq.id === equipId);
      if (!e) return;
      if (e.status === "Active") {
        Alert.alert("In Use", "Can't sell equipment currently assigned to a site.");
        return;
      }
      const salePrice = Math.round(e.price * 0.45 * (e.condition / 100));
      g.cash += salePrice;
      g.revenue += salePrice;
      g.equipment = g.equipment.filter((eq) => eq.id !== equipId);
      addLog2(g, `\u{1F4B8} Sold ${e.name} for ${money2(salePrice)}.`);
    });
  }, [update]);
  const handleHireCrew = useCallback((applicant) => {
    update((g) => {
      const totalCrewCap = getTotalCrewCap(g);
      if (g.crew.length >= totalCrewCap) {
        Alert.alert("Crew Cap", "Upgrade your office or open a Regional Office in a new city.");
        return;
      }
      const bonus = applicant.signingBonus || 0;
      if (g.cash < bonus) {
        Alert.alert("Insufficient Funds", `Signing bonus requires ${money2(bonus)}.`);
        return;
      }
      g.cash -= bonus;
      g.expenses += bonus;
      g.applicants = g.applicants.filter((a) => a.id !== applicant.id);
      const _newWorker = {
        ...createWorker(applicant.role),
        id: uid2(),
        name: applicant.name,
        role: applicant.role,
        skill: applicant.skill,
        wagePerDay: applyRegionalWage(applicant.desiredWage, g),
        mood: applicant.mood,
        loyalty: applicant.loyalty,
        trait: applicant.trait,
        hireDay: g.day,
        jobHistory: [],
        attendanceStrikes: 0,
        status: "Idle"
      };
      delete _newWorker.siteId;
      delete _newWorker.currentSiteId;
      delete _newWorker.assignedSiteId;
      g.crew.push(_newWorker);
      trackHire(g);
      addLog2(g, `\u{1F477} ${applicant.name} hired as ${applicant.role}.`);
      repairCrewAssignments(g);
    });
  }, [update]);
  const handleFireCrew = useCallback((workerId) => {
    update((g) => {
      const w = g.crew.find((w2) => w2.id === workerId);
      if (!w) return;
      (g.activeSites || []).forEach((site) => {
        site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== workerId);
      });
      g.crew = g.crew.filter((w2) => w2.id !== workerId);
      repairCrewAssignments(g);
      addLog2(g, `\u274C ${w.name} has been let go.`);
    });
  }, [update]);
  const handlePromoteCrew = useCallback((workerId) => {
    update((g) => {
      const w = g.crew.find((w2) => w2.id === workerId);
      if (!w) return;
      if (g.cash < 500) {
        Alert.alert("Insufficient Funds", "Promotion costs $500.");
        return;
      }
      if ((w.level || 1) < 3 || (w.skill || 0) < 70) {
        Alert.alert("Not Eligible", "Worker needs level 3+ and skill 70+.");
        return;
      }
      g.cash -= 500;
      g.expenses += 500;
      const newRole = `Senior ${w.role}`;
      w.role = newRole;
      w.skill = Math.min(150, (w.skill || 80) + 5);
      w.wagePerDay = Math.round(w.wagePerDay * 1.2);
      w.mood = Math.min(100, (w.mood ?? 50) + 20);
      addLog2(g, `\u2B50 ${w.name} promoted to ${newRole} \u2014 +5 skill, +20% wage!`);
    });
  }, [update]);
  const handlePostJob = useCallback((posting) => {
    update((g) => {
      if (g.cash < posting.cost) {
        Alert.alert("Insufficient Funds", `Posting costs ${money2(posting.cost)}.`);
        return;
      }
      g.cash -= posting.cost;
      g.expenses += posting.cost;
      for (let i = 0; i < posting.count; i++) {
        g.applicants.push(createApplicant({ skillMin: posting.skillMin, skillMax: posting.skillMax, wageMin: posting.wageMin, wageMax: posting.wageMax, quality: posting.quality }));
      }
      addLog2(g, `\u{1F4E2} Job ad posted \u2014 ${posting.count} applicant(s) added.`);
    });
  }, [update]);
  const handleBuyMaterials = useCallback((matId, qty) => {
    update((g) => {
      if (!qty || qty < 1) return;
      const rawBasePrice = g.materialPrices[matId] || MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice || 100;
      const basePrice = applyRegionalMaterialPrice(rawBasePrice, g);
      const isFlashDeal = g.hotMaterialDeal && g.hotMaterialDeal.matId === matId && g.hotMaterialDeal.expiresDay >= g.day;
      const price = isFlashDeal ? g.hotMaterialDeal.unitPrice : Math.round(basePrice * (1 - getMaterialDiscount(g)));
      const totalCost = price * qty;
      if (g.cash < totalCost) {
        Alert.alert("Insufficient Funds", `Costs ${money2(totalCost)}.`);
        return;
      }
      g.cash -= totalCost;
      g.expenses += totalCost;
      g.materials[matId] = (g.materials[matId] || 0) + qty;
      const mat = MATERIAL_DEFS.find((m) => m.id === matId);
      addLog2(g, `\u{1F4E6} Purchased ${qty} ${mat?.unit || "units"} of ${mat?.label || matId} for ${money2(totalCost)}.`);
    });
  }, [update]);
  const handleBuyMaterialsForSite = useCallback((siteId) => {
    update((g) => {
      const site = g.activeSites.find((s) => s.id === siteId);
      if (!site) return;
      const contract = g.contracts.find((c) => c.id === site.contractId);
      const def = CONTRACT_DEFS.find((d) => d.id === contract?.defId);
      const missing = getSiteMissingMaterials(site, def, g);
      if (!missing.length) return;
      const totalCost = missing.reduce((s, m) => s + m.costNormal, 0);
      if (g.cash < totalCost) {
        let budget = g.cash;
        for (const m of missing) {
          if (budget <= 0) break;
          const canBuy = Math.min(m.missing, Math.floor(budget / m.pricePerUnit));
          if (canBuy > 0) {
            const cost = canBuy * m.pricePerUnit;
            g.cash -= cost;
            g.expenses += cost;
            if (!site.materialsFulfilled) site.materialsFulfilled = {};
            site.materialsFulfilled[m.matId] = (site.materialsFulfilled[m.matId] || 0) + canBuy;
            budget -= cost;
            accrueProjectCost(site, "materials", cost);
            addLog2(g, `\u{1F4E6} Partial buy: ${canBuy} ${m.unit} of ${m.label} for ${money2(cost)}.`);
          }
        }
      } else {
        g.cash -= totalCost;
        g.expenses += totalCost;
        accrueProjectCost(site, "materials", totalCost);
        for (const m of missing) {
          if (!site.materialsFulfilled) site.materialsFulfilled = {};
          site.materialsFulfilled[m.matId] = (site.materialsFulfilled[m.matId] || 0) + m.missing;
          addLog2(g, `\u{1F4E6} Bought ${m.missing} ${m.unit} of ${m.label} for ${money2(m.costNormal)}.`);
        }
      }
    });
  }, [update]);
  const handleEmergencyPurchase = useCallback((siteId) => {
    update((g) => {
      const site = g.activeSites.find((s) => s.id === siteId);
      if (!site) return;
      const contract = g.contracts.find((c) => c.id === site.contractId);
      const def = CONTRACT_DEFS.find((d) => d.id === contract?.defId);
      const missing = getSiteMissingMaterials(site, def, g);
      if (!missing.length) return;
      const totalCost = missing.reduce((s, m) => s + m.costEmergency, 0);
      const shortfall = Math.max(0, totalCost - (g.cash || 0));
      const canUseCredit = (g.creditScore || 600) >= 600;
      if (shortfall > 0 && !canUseCredit) {
        addLog2(g, `\u274C Emergency purchase failed \u2014 insufficient cash and credit below 600.`);
        return;
      }
      if (shortfall > 0) {
        g.debt = (g.debt || 0) + shortfall;
        g.creditScore = Math.max(300, (g.creditScore || 600) - 5);
        g.cash = Math.max(0, g.cash - (totalCost - shortfall));
        addLog2(g, `\u26A1 Emergency: ${money2(shortfall)} charged to supplier credit.`);
      } else {
        g.cash -= totalCost;
      }
      g.expenses += totalCost;
      accrueProjectCost(site, "materials", totalCost);
      for (const m of missing) {
        if (!site.materialsFulfilled) site.materialsFulfilled = {};
        site.materialsFulfilled[m.matId] = (site.materialsFulfilled[m.matId] || 0) + m.missing;
        addLog2(g, `\u26A1 Emergency delivery: ${m.missing} ${m.unit} of ${m.label} (${money2(m.costEmergency)}).`);
      }
    });
  }, [update]);
  const handleStartSite = useCallback((contract, crewIds, equipIds) => {
    update((g) => {
      const c = g.contracts.find((c2) => c2.id === contract.id);
      if (!c || c.status !== "Open") {
        Alert.alert("Unavailable", "This contract is no longer open.");
        return;
      }
      const blockReason = getAssignBlockReason(c, crewIds, equipIds, g);
      if (blockReason) {
        Alert.alert("Cannot Start", blockReason);
        return;
      }
      const BID_MULTIPLIERS = { aggressive: 0.82, standard: 1, premium: 1.28 };
      const bidStyle = (g.contractBidStyles || {})[c.id] || "standard";
      const bidMult = BID_MULTIPLIERS[bidStyle] ?? 1;
      const effectiveValue = Math.round(c.value * bidMult);
      const materialsFulfilled = {};
      let materialsFromStockCost = 0;
      for (const matId of Object.keys(c.materials || {})) {
        const needed = c.materials[matId];
        const available = Math.max(0, g.materials[matId] || 0);
        const consumed = Math.min(needed, available);
        g.materials[matId] = available - consumed;
        materialsFulfilled[matId] = consumed;
        materialsFromStockCost += consumed * getMaterialUnitPrice(g, matId);
      }
      for (const id of crewIds) {
        const w = g.crew.find((w2) => w2.id === id);
        if (w) {
          w.status = "Active";
          w.assignedSiteId = contract.id;
        }
      }
      for (const id of equipIds) {
        const e = g.equipment.find((e2) => e2.id === id);
        if (e) {
          e.status = "Active";
          e.assignedSiteId = contract.id;
        }
      }
      trackContractWon(g);
      c.status = "Active";
      g.activeSites.push({
        id: uid2(),
        contractId: c.id,
        label: c.label,
        client: c.client,
        totalValue: effectiveValue,
        phases: [...c.phases],
        currentPhaseIdx: 0,
        phaseProgress: 0,
        assignedCrewIds: [...crewIds],
        assignedEquipmentIds: [...equipIds],
        crewMin: c.crewMin,
        equipMin: c.equipMin,
        startDay: g.day,
        durationDays: c.durationDays,
        deadlineDay: c.deadline,
        penaltyPerDay: c.penaltyPerDay,
        status: "Active",
        chaosHistory: [],
        pausedDays: 0,
        cityId: c.cityId || "salem",
        siteMode: "normal",
        materialsFulfilled,
        depositPaid: 0,
        completionBonus: 0,
        rushQualityPenalty: 0,
        costs: createProjectCostLedger()
      });
      const _deposit = Math.round(effectiveValue * 0.25);
      g.cash += _deposit;
      g.revenue += _deposit;
      g.weeklyStats.revenue += _deposit;
      const _newSite = g.activeSites[g.activeSites.length - 1];
      _newSite.depositPaid = _deposit;
      accrueProjectCost(_newSite, "materials", materialsFromStockCost);
      const bidNote = bidStyle !== "standard" ? ` [${bidStyle} bid]` : "";
      addLog2(g, `\u{1F3D7}\uFE0F Site started: "${c.label}" for ${c.client} \u2014 ${money2(effectiveValue)} contract${bidNote}. \u{1F4B0} 25% deposit: ${money2(_deposit)}.`);
    });
  }, [update]);
  const handleHireSubcontractor = useCallback((typeId) => {
    update((g) => {
      const def = SUBCONTRACTOR_TYPES.find((t) => t.id === typeId);
      if (!def) return;
      if (g.cash < def.hireCost) {
        Alert.alert("Insufficient Funds", `Hire cost: ${money2(def.hireCost)}`);
        return;
      }
      g.cash -= def.hireCost;
      g.expenses += def.hireCost;
      if (!g.subcontractors) g.subcontractors = [];
      g.subcontractors.push(createSubcontractor(typeId));
      addLog2(g, `\u{1F91D} Hired ${def.label} for ${def.durationDays} days \u2014 ${money2(def.hireCost)} upfront.`);
    });
  }, [update]);
  const handleBuyInsurance = useCallback((planId) => {
    update((g) => {
      const plan = INSURANCE_PLANS.find((p) => p.id === planId);
      if (!plan) return;
      g.insurancePlanId = planId;
      if (planId === "none") {
        addLog2(g, `\u{1F6E1}\uFE0F Insurance cancelled \u2014 no coverage.`);
      } else {
        addLog2(g, `\u{1F6E1}\uFE0F Insurance switched to ${plan.label} (${money2(plan.monthlyPremium)}/mo).`);
      }
    });
  }, [update]);
  const handleSetBidStyle = useCallback((contractId, style) => {
    update((g) => {
      if (!g.contractBidStyles) g.contractBidStyles = {};
      g.contractBidStyles[contractId] = style;
    });
  }, [update]);
  const handleTakeLoan = useCallback((product) => {
    update((g) => {
      if ((g.loans || []).length >= 3) {
        Alert.alert("Loan Limit", "You already have 3 active loans. Pay off a loan before taking another.");
        return;
      }
      const profile = buildBorrowerProfile(g, product);
      const offer = computeLoanOffer(product.id, profile);
      if (!offer.approved) {
        Alert.alert("Financing Declined", (offer.reasons || ["You do not currently qualify for this product."]).join("\n\n"));
        return;
      }
      const collateral = getLendingCollateral(g, product);
      const loan = offerToLoanRecord(offer, uid2, {
        collateralVehicleId: product.collateralType === "vehicle" ? collateral.id : null
      });
      g.loans.push(loan);
      g.cash += offer.principal;
      recordTransaction(g, "financing", offer.principal, `${offer.label} proceeds`, {
        loanId: loan.id,
        productId: offer.productId,
        apr: offer.apr
      });
      addLog2(g, `\u{1F4B3} Loan approved: ${money2(offer.principal)} (${offer.apr}% APR, ${offer.termWeeks} weeks, ${money2(offer.weeklyPayment)}/week).`);
    });
  }, [update]);
  const handlePayTax = useCallback(() => {
    update((g) => {
      if ((g.taxDue || 0) <= 0) return;
      if (g.cash < g.taxDue) {
        Alert.alert("Insufficient Funds", `Tax bill is ${money2(g.taxDue)}.`);
        return;
      }
      g.cash -= g.taxDue;
      g.expenses += g.taxDue;
      addLog2(g, `\u2705 Tax bill of ${money2(g.taxDue)} paid.`);
      g.taxDue = 0;
      g.taxOverdueDays = 0;
      g.businessFrozen = false;
    });
  }, [update]);
  const handleSavingsDeposit = useCallback((amount) => {
    update((g) => {
      const amt = Math.round(amount);
      if (!amt || amt <= 0) {
        Alert.alert("Invalid Amount", "Enter a positive amount.");
        return;
      }
      if (g.cash < amt) {
        Alert.alert("Insufficient Funds", `Need ${money2(amt)} in operating cash.`);
        return;
      }
      g.cash -= amt;
      g.savings = (g.savings || 0) + amt;
      addLog2(g, `\u{1F3E6} Deposited ${money2(amt)} into savings. Reserve: ${money2(g.savings)}.`);
    });
  }, [update]);
  const handleSavingsWithdraw = useCallback((amount) => {
    update((g) => {
      const amt = Math.round(amount);
      if (!amt || amt <= 0) {
        Alert.alert("Invalid Amount", "Enter a positive amount.");
        return;
      }
      if ((g.savings || 0) < amt) {
        Alert.alert("Insufficient Reserve", `Only ${money2(g.savings || 0)} in savings.`);
        return;
      }
      g.savings -= amt;
      g.cash += amt;
      addLog2(g, `\u{1F3E6} Withdrew ${money2(amt)} from savings. Reserve: ${money2(g.savings)}.`);
    });
  }, [update]);
  const handlePayoffLoan = useCallback((loanId, payoffAmount) => {
    update((g) => {
      const loan = (g.loans || []).find((l) => l.id === loanId);
      if (!loan) return;
      if (g.cash < payoffAmount) {
        Alert.alert("Insufficient Funds", `Need ${money2(payoffAmount)} to pay off this loan early.`);
        return;
      }
      g.cash -= payoffAmount;
      g.expenses += payoffAmount;
      g.loans = g.loans.filter((l) => l.id !== loanId);
      g.creditScore = Math.min(850, (g.creditScore || 600) + 5);
      addLog2(g, `\u2705 "${loan.label}" paid off early. Credit +5.`);
    });
  }, [update]);
  const handleLoanPartialPayment = useCallback((loanId, amount) => {
    update((g) => {
      const loan = (g.loans || []).find((l) => l.id === loanId);
      const amt = Math.round(amount);
      if (!loan || amt <= 0 || g.cash < amt) {
        Alert.alert("Insufficient Funds", `Need ${money2(amt)} in cash.`);
        return;
      }
      const actualAmt = Math.min(amt, loan.remainingBalance);
      g.cash -= actualAmt;
      g.expenses += actualAmt;
      loan.remainingBalance -= actualAmt;
      loan.weeksLeft = Math.max(0, Math.ceil(loan.remainingBalance / (loan.weeklyPayment || 1)));
      if (loan.remainingBalance <= 0) {
        g.loans = g.loans.filter((l) => l.id !== loanId);
        g.creditScore = Math.min(850, (g.creditScore || 600) + 5);
        addLog2(g, `\u2705 Loan "${loan.label}" fully paid off. Credit +5.`);
      } else {
        g.creditScore = Math.min(850, (g.creditScore || 600) + 1);
        addLog2(g, `\u{1F4B3} Paid ${money2(actualAmt)} toward "${loan.label}". Remaining: ${money2(loan.remainingBalance)}.`);
      }
    });
  }, [update]);
  const handleOpenCreditLine = useCallback(() => {
    update((g) => {
      if ((g.creditScore || 600) < 680) {
        Alert.alert("Credit Too Low", "Need 680+ credit score to open a line of credit.");
        return;
      }
      if (g.creditLine) {
        Alert.alert("Already Active", "You already have an open line of credit.");
        return;
      }
      g.creditLine = { limit: 75e3, drawn: 0, apr: 14, opened: g.day };
      g.creditScore = Math.max(300, (g.creditScore || 600) - 3);
      addLog2(g, `\u{1F4B3} Business Line of Credit opened \u2014 up to ${money2(75e3)} at 14% APR on drawn amount.`);
    });
  }, [update]);
  const handleDrawCreditLine = useCallback((amount) => {
    update((g) => {
      if (!g.creditLine) return;
      const avail = (g.creditLine.limit || 75e3) - (g.creditLine.drawn || 0);
      const amt = Math.min(Math.round(amount), avail);
      if (amt <= 0) {
        Alert.alert("No Credit Available", "Credit limit reached.");
        return;
      }
      g.creditLine.drawn = (g.creditLine.drawn || 0) + amt;
      g.cash += amt;
      addLog2(g, `\u{1F4B3} Drew ${money2(amt)} from credit line. Total drawn: ${money2(g.creditLine.drawn)}.`);
    });
  }, [update]);
  const handleRepayCreditLine = useCallback((amount) => {
    update((g) => {
      if (!g.creditLine || !g.creditLine.drawn) return;
      const amt = Math.min(Math.round(amount), g.creditLine.drawn, g.cash);
      if (amt <= 0) {
        Alert.alert("Cannot Repay", "Nothing drawn or insufficient cash.");
        return;
      }
      g.creditLine.drawn -= amt;
      g.cash -= amt;
      g.expenses += amt;
      if (g.creditLine.drawn <= 0) {
        g.creditLine.drawn = 0;
        addLog2(g, `\u2705 Credit line fully repaid.`);
      } else {
        addLog2(g, `\u{1F4B3} Repaid ${money2(amt)}. Still drawn: ${money2(g.creditLine.drawn)}.`);
      }
    });
  }, [update]);
  const handleUpgradeOffice = useCallback(() => {
    update((g) => {
      const next = OFFICES[g.officeIndex + 1];
      if (!next) {
        Alert.alert("Max Office", "You're at the top tier already.");
        return;
      }
      if (g.cash < next.cost) {
        Alert.alert("Insufficient Funds", `Need ${money2(next.cost)}.`);
        return;
      }
      g.cash -= next.cost;
      g.expenses += next.cost;
      g.officeIndex += 1;
      addLog2(g, `\u{1F3E2} Upgraded to ${next.name} \u2014 crew cap ${next.crewCap}, equip cap ${next.equipCap}.`);
    });
  }, [update]);
  const handleResetGame = useCallback(() => {
    Alert.alert("Reset Game", "Start over from scratch? All progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => {
        const fresh = freshState();
        fresh.lastRealTimestamp = Date.now();
        setGame(fresh);
        setTheme("dark");
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {
        });
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => {
        });
      } }
    ]);
  }, []);
  const handleOpenOffice = useCallback((cityId, officeTypeId) => {
    update((g) => {
      const city = CITIES.find((c) => c.id === cityId);
      const def = REGIONAL_OFFICE_TYPES.find((t) => t.id === officeTypeId);
      if (!city || !def) return;
      if (g.reputation < city.unlockRep) {
        Alert.alert("Not Yet", `Need ${city.unlockRep}+ reputation to expand to ${city.name}.`);
        return;
      }
      if (g.cash < city.unlockCost + def.cost) {
        Alert.alert("Insufficient Funds", `Expanding to ${city.name} and opening a ${def.name} costs ${money2(city.unlockCost + def.cost)}.`);
        return;
      }
      const alreadyInCity = (g.cityOffices || []).some((o) => o.cityId === cityId);
      const totalCost = def.cost + (alreadyInCity ? 0 : city.unlockCost);
      g.cash -= totalCost;
      g.expenses += totalCost;
      if (!g.cityOffices) g.cityOffices = [];
      g.cityOffices.push({ id: uid2(), cityId, typeId: officeTypeId, name: `${def.name} \u2014 ${city.name}`, openedDay: g.day });
      addLog2(g, `\u{1F3D9}\uFE0F Opened ${def.name} in ${city.name}, ${city.state}!`);
    });
  }, [update]);
  const handleBuyProperty = useCallback((typeId) => {
    update((g) => {
      const def = PROPERTY_TYPES.find((t) => t.id === typeId);
      if (!def) return;
      if (g.cash < def.cost) {
        Alert.alert("Insufficient Funds", `${def.name} costs ${money2(def.cost)}.`);
        return;
      }
      g.cash -= def.cost;
      g.expenses += def.cost;
      if (!g.properties) g.properties = [];
      g.properties.push({ id: uid2(), typeId, name: def.name, purchasedDay: g.day });
      addLog2(g, `\u{1F3E0} Purchased ${def.name} \u2014 ${def.desc}`);
    });
  }, [update]);
  const handleHirePM = useCallback((pmTypeId) => {
    update((g) => {
      const def = PM_TIERS.find((t) => t.id === pmTypeId);
      if (!def) return;
      const already = (g.projectManagers || []).some((pm) => pm.typeId === pmTypeId);
      if (already) {
        Alert.alert("Already Hired", `You already have a ${def.name} on staff.`);
        return;
      }
      if (g.cash < def.hireCost) {
        Alert.alert("Insufficient Funds", `Hiring costs ${money2(def.hireCost)}.`);
        return;
      }
      g.cash -= def.hireCost;
      g.expenses += def.hireCost;
      if (!g.projectManagers) g.projectManagers = [];
      g.projectManagers.push({ id: uid2(), typeId: pmTypeId, name: `${pick2(FIRST_NAMES)} ${pick2(LAST_NAMES)}`, wagePerDay: def.wagePerDay });
      addLog2(g, `\u{1F4CB} ${def.name} hired \u2014 ${def.desc}`);
      if (def.autoManage) {
        g.autoAssignCrew = true;
        g.autoAssignEquipment = true;
        addLog2(g, `\u26A1 Auto-assign crew & vehicles enabled by ${def.name}.`);
      }
      if (def.id === "director") {
        g.autoPurchaseMaterials = true;
        g.autoRepairEquipment = true;
        addLog2(g, `\u26A1 Auto-buy materials & auto-repair enabled.`);
      }
    });
  }, [update]);
  const handleFirePM = useCallback((pmId) => {
    update((g) => {
      const pm = (g.projectManagers || []).find((p) => p.id === pmId);
      if (!pm) return;
      g.projectManagers = g.projectManagers.filter((p) => p.id !== pmId);
      addLog2(g, `\u274C ${pm.name} has left the company.`);
    });
  }, [update]);
  const handleTrainCrew = useCallback((workerId, programId) => {
    update((g) => {
      const w = g.crew.find((w2) => w2.id === workerId);
      const prog = TRAINING_PROGRAMS2.find((p) => p.id === programId);
      if (!w || !prog) return;
      if (g.cash < prog.cost) {
        Alert.alert("Insufficient Funds", `Training costs ${money2(prog.cost)}.`);
        return;
      }
      if (w.status === "Active") {
        Alert.alert("On Site", "Can't enroll a worker currently assigned to a site.");
        return;
      }
      const alreadyEnrolled = (g.trainingQueue || []).some((t) => t.workerId === workerId);
      if (alreadyEnrolled) {
        Alert.alert("Already Training", "This worker is already enrolled in a program.");
        return;
      }
      g.cash -= prog.cost;
      g.expenses += prog.cost;
      if (!g.trainingQueue) g.trainingQueue = [];
      g.trainingQueue.push({ id: uid2(), workerId, programId, daysLeft: prog.duration });
      addLog2(g, `\u{1F4DA} ${w.name} enrolled in "${prog.label}" \u2014 completes in ${prog.duration} days.`);
    });
  }, [update]);
  const handleAcquireRival = useCallback((rivalId) => {
    update((g) => {
      const rival = (g.rivals || []).find((r) => r.id === rivalId);
      if (!rival) return;
      const acquisitionCost = Math.max(5e4, (rival.rep || 0) * 3e3 + (rival.cash || 0) * 0.5);
      if (g.reputation < 50) {
        Alert.alert("Reputation Too Low", "Need 50+ reputation to acquire rivals.");
        return;
      }
      if (g.day - (g.lastAcquisitionDay || 0) < 30) {
        Alert.alert("Acquisition Cooldown", `Must wait ${30 - (g.day - (g.lastAcquisitionDay || 0))} more day(s) before next acquisition.`);
        return;
      }
      if (g.cash < acquisitionCost) {
        Alert.alert("Insufficient Funds", `Acquiring ${rival.name} costs ${money2(acquisitionCost)}.`);
        return;
      }
      g.cash -= acquisitionCost;
      g.expenses += acquisitionCost;
      g.cash += (rival.cash || 0) * 0.7;
      g.revenue += (rival.cash || 0) * 0.7;
      if (!g.acquiredRivals) g.acquiredRivals = [];
      g.acquiredRivals.push(rivalId);
      g.lastAcquisitionDay = g.day;
      g.reputation = Math.min(100, (g.reputation || 0) + rand2(3, 8));
      g.creditScore = Math.min(850, (g.creditScore || 600) + rand2(5, 15));
      for (const site of g.activeSites || []) {
        site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== rivalId);
      }
      const newCrew = Math.min(3, rand2(1, 3));
      for (let i = 0; i < newCrew; i++) g.crew.push(createWorker(pick2(CREW_ROLES)));
      addLog2(g, `\u{1F91D} Acquired ${rival.name}! Absorbed their assets and ${newCrew} workers.`);
      if ((g.acquiredRivals || []).length === 1) {
        addImportantNotice(g, `\u{1F91D} First rival acquired! Your empire expands \u2014 ${rival.name} is now under your banner.`, "cyan");
      }
    });
  }, [update]);
  const handleSellProperty = useCallback((propId) => {
    update((g) => {
      const prop = (g.properties || []).find((p) => p.id === propId);
      if (!prop) return;
      const def = PROPERTY_TYPES.find((t) => t.id === prop.typeId);
      const salePrice = Math.round((def?.cost || 0) * (def?.resaleRate || 0.8));
      g.cash += salePrice;
      g.revenue += salePrice;
      g.properties = g.properties.filter((p) => p.id !== propId);
      addLog2(g, `\u{1F4B8} Sold ${def?.name || "property"} for ${money2(salePrice)}.`);
    });
  }, [update]);
  const handleBuyEquipmentUpgrade = useCallback((equipId, upgradeId) => {
    update((g) => {
      const eq = g.equipment.find((e) => e.id === equipId);
      const upg = EQUIPMENT_UPGRADES.find((u) => u.id === upgradeId);
      if (!eq || !upg) return;
      const currentTier = (eq.upgrades || {})[upgradeId] || 0;
      const nextTier = upg.tiers[currentTier];
      if (!nextTier || g.cash < nextTier.cost) return;
      g.cash -= nextTier.cost;
      g.expenses += nextTier.cost;
      if (!eq.upgrades) eq.upgrades = {};
      eq.upgrades[upgradeId] = currentTier + 1;
      addLog2(g, `\u2699\uFE0F ${eq.name}: ${upg.label} upgraded to Tier ${currentTier + 1} (${nextTier.effect})`);
    });
  }, [update]);
  const handleRepairEquipmentNew = useCallback((equipId, isEmergency) => {
    update((g) => {
      const _eq = (g.equipment || []).find((e) => e.id === equipId);
      if (!_eq) return;
      const _baseCost = Math.round((_eq.price || 5e3) * (isEmergency ? 0.4 : 0.2));
      if (g.cash < _baseCost) {
        addLog2(g, `Not enough cash to repair ${_eq.name}.`);
        return;
      }
      g.cash -= _baseCost;
      g.expenses += _baseCost;
      _eq.condition = isEmergency ? 100 : Math.min(100, (_eq.condition || 0) + 60);
      _eq.status = "Idle";
      if (g.pendingBreakdown?.equipId === equipId) g.pendingBreakdown = null;
      addLog2(g, `\u{1F527} ${_eq.name} repaired \u2014 condition ${Math.round(_eq.condition)}%`);
    });
  }, [update]);
  const handleRaiseWage = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew || []).find((w) => w.id === workerId);
      if (!_w) return;
      const _increase = Math.round(_w.wagePerDay * 0.1);
      _w.wagePerDay += _increase;
      _w.loyalty = Math.min(100, (_w.loyalty ?? 0) + 8);
      _w.mood = Math.min(100, (_w.mood ?? 70) + 10);
      addLog2(g, `\u{1F49A} ${_w.name} wage raised by ${money2(_increase)}/day \u2014 loyalty +8`);
    });
  }, [update]);
  const handleLowerWage = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew || []).find((w) => w.id === workerId);
      if (!_w) return;
      const _decrease = Math.round(_w.wagePerDay * 0.1);
      _w.wagePerDay = Math.max(50, _w.wagePerDay - _decrease);
      _w.loyalty = Math.max(0, (_w.loyalty ?? 0) - 15);
      _w.mood = Math.max(0, (_w.mood ?? 70) - 12);
      addLog2(g, `\u{1F534} ${_w.name} wage cut by ${money2(_decrease)}/day \u2014 morale hit`);
    });
  }, [update]);
  const handleGiveBonus = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew || []).find((w) => w.id === workerId);
      if (!_w) return;
      const _bonus = _w.wagePerDay * 2;
      if (g.cash < _bonus) {
        addLog2(g, "Not enough cash for bonus.");
        return;
      }
      g.cash -= _bonus;
      g.expenses += _bonus;
      _w.mood = Math.min(100, (_w.mood ?? 70) + 20);
      _w.loyalty = Math.min(100, (_w.loyalty ?? 0) + 12);
      addLog2(g, `\u{1F381} ${_w.name} received a ${money2(_bonus)} bonus \u2014 morale +20`);
    });
  }, [update]);
  const handleRestWorker = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew || []).find((w) => w.id === workerId);
      if (!_w) return;
      (g.activeSites || []).forEach((site) => {
        site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== workerId);
      });
      _w.status = "Resting";
      _w.restUntilStamina = 80;
      addLog2(g, `\u{1F4A4} ${_w.name} is resting \u2014 will return when stamina reaches 80%.`);
    });
  }, [update]);
  const handleRestAllTired = useCallback(() => {
    update((g) => {
      let count = 0;
      (g.crew || []).forEach((_w) => {
        if ((_w.stamina ?? 100) < 40 && _w.status !== "Resting") {
          (g.activeSites || []).forEach((site) => {
            site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== _w.id);
          });
          _w.status = "Resting";
          _w.restUntilStamina = 80;
          count++;
        }
      });
      if (count > 0) addLog2(g, `\u{1F4A4} ${count} tired worker(s) sent to rest.`);
    });
  }, [update]);
  const handleBuyLunch = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew || []).find((w) => w.id === workerId);
      if (!_w) return;
      if ((g.cash || 0) < 25) {
        addLog2(g, "Not enough cash for lunch.");
        return;
      }
      if (_w.lastLunchDay === g.day) {
        addLog2(g, `${_w.name} already had lunch today.`);
        return;
      }
      g.cash -= 25;
      _w.mood = Math.min(100, (_w.mood ?? 70) + 8);
      _w.stamina = Math.min(100, (_w.stamina ?? 50) + 5);
      _w.lastLunchDay = g.day;
      addLog2(g, `\u{1F371} ${_w.name} had lunch \u2014 mood +8, stamina +5`);
    });
  }, [update]);
  const handlePauseSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites || []).find((s) => s.id === siteId);
      if (!_s) return;
      _s.status = "Paused";
      _s.pausedDays = 999;
      addLog2(g, `\u23F8 ${_s.label} paused.`);
    });
  }, [update]);
  const handleResumeSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites || []).find((s) => s.id === siteId);
      if (!_s) return;
      _s.status = "Active";
      _s.pausedDays = 0;
      addLog2(g, `\u25B6\uFE0F ${_s.label} resumed.`);
    });
  }, [update]);
  const handleAbandonSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites || []).find((s) => s.id === siteId);
      if (!_s) return;
      const _def = CONTRACT_DEFS.find((c) => c.id === (g.contracts || []).find((cc) => cc.id === _s.contractId)?.defId);
      const _fee = Math.round((_def?.baseValue || 1e4) * 0.15);
      const _repLoss = Math.max(2, (_def?.tier || _def?.minTier || 1) * 2);
      g.cash = Math.max(-5e4, (g.cash || 0) - _fee);
      g.expenses = (g.expenses || 0) + _fee;
      g.reputation = Math.max(0, (g.reputation || 0) - _repLoss);
      (_s.assignedCrewIds || []).forEach((cid) => {
        const _w = (g.crew || []).find((w) => w.id === cid);
        if (_w) {
          _w.status = "Idle";
          _w.assignedSiteId = null;
        }
      });
      (_s.assignedEquipmentIds || []).forEach((eid) => {
        const _e = (g.equipment || []).find((e) => e.id === eid);
        if (_e) {
          _e.assignedSiteId = null;
          _e.status = "Idle";
        }
      });
      g.activeSites = (g.activeSites || []).filter((s) => s.id !== siteId);
      addLog2(g, `\u{1F6AB} Abandoned ${_s.label} \u2014 ${money2(_fee)} fee, rep -${_repLoss}.`);
      addImportantNotice(g, `\u{1F6AB} Abandoned "${_s.label}" \u2014 ${money2(_fee)} fee, reputation -${_repLoss}. Win more contracts to recover.`, "red");
    });
  }, [update]);
  const handleSettleSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites || []).find((s) => s.id === siteId);
      if (!_s) return;
      const _def = CONTRACT_DEFS.find((c) => c.id === (g.contracts || []).find((cc) => cc.id === _s.contractId)?.defId);
      const _prog = Math.min(1, (_s.currentPhaseIdx || 0) / Math.max(1, (_s.phases || []).length) + (_s.phaseProgress || 0) / 100 / Math.max(1, (_s.phases || []).length));
      const _partial = Math.round((_s.totalValue || _def?.baseValue || 1e4) * Math.max(0.2, _prog) * 0.6);
      const _repLoss = Math.max(1, Math.round((_def?.minTier || 1) * 1.5));
      g.cash = (g.cash || 0) + _partial;
      g.revenue = (g.revenue || 0) + _partial;
      g.reputation = Math.max(0, (g.reputation || 0) - _repLoss);
      (_s.assignedCrewIds || []).forEach((cid) => {
        const _w = (g.crew || []).find((w) => w.id === cid);
        if (_w) {
          _w.status = "Idle";
          _w.assignedSiteId = null;
        }
      });
      (_s.assignedEquipmentIds || []).forEach((eid) => {
        const _e = (g.equipment || []).find((e) => e.id === eid);
        if (_e) {
          _e.assignedSiteId = null;
          _e.status = "Idle";
        }
      });
      g.activeSites = (g.activeSites || []).filter((s) => s.id !== siteId);
      g.completedJobs = (g.completedJobs || 0) + 1;
      addLog2(g, `\u{1F91D} Settled ${_s.label} \u2014 ${money2(_partial)} partial payout, rep -${_repLoss}.`);
      addImportantNotice(g, `\u{1F91D} Settled "${_s.label}" early \u2014 partial payout of ${money2(_partial)}, reputation -${_repLoss}.`, "orange");
    });
  }, [update]);
  const handleRenegotiate = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites || []).find((s) => s.id === siteId);
      if (!_s || _s.renegotiated) return;
      const _def = CONTRACT_DEFS.find((c) => c.id === (g.contracts || []).find((cc) => cc.id === _s.contractId)?.defId);
      const _cost = Math.round((_def?.baseValue || _s.totalValue || 1e4) * 0.08);
      if ((g.cash || 0) < _cost) {
        addLog2(g, `Need ${money2(_cost)} to renegotiate.`);
        Alert.alert("Insufficient Funds", `Renegotiating costs ${money2(_cost)}. You have ${money2(g.cash || 0)}.`);
        return;
      }
      g.cash -= _cost;
      g.expenses = (g.expenses || 0) + _cost;
      g.reputation = Math.max(0, (g.reputation || 0) - 2);
      _s.deadlineDay = (g.day || 0) + Math.max(7, Math.round((_def?.durationDays || 14) * 0.4));
      _s.renegotiated = true;
      addLog2(g, `\u{1F4C5} ${_s.label} deadline extended \u2014 ${money2(_cost)}, rep -2.`);
    });
  }, [update]);
  const handleAssignCrewToSite = useCallback((workerId, siteId) => {
    update((g) => {
      const w = (g.crew || []).find((c) => c.id === workerId);
      const site = (g.activeSites || []).find((s) => s.id === siteId);
      if (!w || !site) return;
      if (w.status === "Resting" || w.status === "Training") {
        addLog2(g, `${w.name} is not available.`);
        return;
      }
      (g.activeSites || []).forEach((s) => {
        s.assignedCrewIds = (s.assignedCrewIds || []).filter((id) => id !== workerId);
      });
      site.assignedCrewIds = [...site.assignedCrewIds || [], workerId];
      repairCrewAssignments(g);
      addLog2(g, `\u{1F477} ${w.name} assigned to ${site.label}.`);
    });
  }, [update]);
  const handleUnassignCrewFromSite = useCallback((workerId, siteId) => {
    update((g) => {
      const w = (g.crew || []).find((c) => c.id === workerId);
      const site = (g.activeSites || []).find((s) => s.id === siteId);
      if (!w || !site) return;
      site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== workerId);
      repairCrewAssignments(g);
      addLog2(g, `\u{1F477} ${w.name} removed from ${site.label}.`);
    });
  }, [update]);
  const handleAssignEquipToSite = useCallback((equipId, siteId) => {
    update((g) => {
      const eq = (g.equipment || []).find((e) => e.id === equipId);
      const site = (g.activeSites || []).find((s) => s.id === siteId);
      if (!eq || !site) return;
      if (eq.status === "Maintenance" || eq.status === "Broken") {
        addLog2(g, `${eq.name} is not available.`);
        return;
      }
      (g.activeSites || []).forEach((s) => {
        s.assignedEquipmentIds = (s.assignedEquipmentIds || []).filter((id) => id !== equipId);
      });
      site.assignedEquipmentIds = [...site.assignedEquipmentIds || [], equipId];
      repairCrewAssignments(g);
      addLog2(g, `\u{1F69C} ${eq.name} assigned to ${site.label}.`);
    });
  }, [update]);
  const handleUnassignEquipFromSite = useCallback((equipId, siteId) => {
    update((g) => {
      const eq = (g.equipment || []).find((e) => e.id === equipId);
      const site = (g.activeSites || []).find((s) => s.id === siteId);
      if (!eq || !site) return;
      site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => id !== equipId);
      repairCrewAssignments(g);
      addLog2(g, `\u{1F69C} ${eq.name} removed from ${site.label}.`);
    });
  }, [update]);
  const handleScheduleMaintenance = useCallback((equipId) => {
    update((g) => {
      const eq = (g.equipment || []).find((e) => e.id === equipId);
      if (!eq) return;
      if (eq.status === "Active" || eq.assignedSiteId) {
        Alert.alert("In Use", "Unassign this vehicle from its site before scheduling maintenance.");
        return;
      }
      const ok = scheduleMaintenance(g, equipId);
      if (!ok) {
        const estimated = Math.max(25, Math.round((eq.dailyCost || eq.maintenance || 50) * 0.35));
        Alert.alert("Maintenance Unavailable", `Unable to schedule maintenance right now. Keep at least ${money2(estimated)} available and make sure the vehicle is idle.`);
        return;
      }
      repairCrewAssignments(g);
    });
  }, [update]);
  const handleRetireEquipment = useCallback((equipId) => {
    update((g) => {
      const eq = (g.equipment || []).find((e) => e.id === equipId);
      if (!eq) return;
      (g.activeSites || []).forEach((s) => {
        s.assignedEquipmentIds = (s.assignedEquipmentIds || []).filter((id) => id !== equipId);
      });
      g.equipment = (g.equipment || []).filter((e) => e.id !== equipId);
      repairCrewAssignments(g);
      addLog2(g, `\u2B1B ${eq.name} retired from fleet.`);
    });
  }, [update]);
  if (!loaded || !game) {
    return /* @__PURE__ */ jsx(SafeAreaView, { style: { flex: 1, backgroundColor: THEMES.dark.bg, alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsx(Text, { style: { color: THEMES.dark.text, fontSize: 18 }, children: "Loading ConstructionFlow\u2026" }) });
  }
  const col = { color: T.text };
  const subCol = { color: T.sub };
  if (!game.setupDone) {
    return renderSetup();
  }
  if (game.gameOver) {
    return /* @__PURE__ */ jsxs(SafeAreaView, { style: { flex: 1, backgroundColor: T.bg }, children: [
      /* @__PURE__ */ jsx(StatusBar, { barStyle: "light-content", backgroundColor: T.bg }),
      /* @__PURE__ */ jsxs(ScrollView, { contentContainerStyle: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 52, marginBottom: 8 }, children: "\u{1F4B8}" }),
        /* @__PURE__ */ jsxs(Text, { style: { color: T.red, fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 8 }, children: [
          game.companyName,
          " is Bankrupt"
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: { color: T.sub, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 }, children: [
          "Cash fell below \u2212$10,000 for 5 consecutive days.",
          "\n",
          "Your creditors have moved in."
        ] }),
        /* @__PURE__ */ jsxs(View, { style: { width: "100%", backgroundColor: T.panel, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: T.border, marginBottom: 20 }, children: [
          /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 }, children: "FINAL STATS" }),
          [
            ["Days in Business", String(game.day || 1)],
            ["Jobs Completed", String(game.completedJobs || 0)],
            ["Crew at Close", String((game.crew || []).length)],
            ["Peak Reputation", String(game.hallOfFame?.highestRep || game.reputation || 0)],
            ["Peak Valuation", money2(game.hallOfFame?.highestValuation || game.companyValuation || 0)]
          ].map(([label, value]) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border }, children: [
            /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 13 }, children: label }),
            /* @__PURE__ */ jsx(Text, { style: { color: T.text, fontSize: 13, fontWeight: "700" }, children: value })
          ] }, label))
        ] }),
        /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 12, fontStyle: "italic", textAlign: "center", marginBottom: 28, lineHeight: 18 }, children: '"Every failed company is just a blueprint for the next one."' }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: { backgroundColor: T.green, paddingVertical: 16, borderRadius: 14, width: "100%", alignItems: "center", marginBottom: 12 },
            onPress: handleResetGame,
            activeOpacity: 0.8,
            children: /* @__PURE__ */ jsx(Text, { style: { color: "#000", fontSize: 16, fontWeight: "900" }, children: "Start Over \u2192" })
          }
        ),
        onBackToHub && /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: { paddingVertical: 14, width: "100%", alignItems: "center" },
            onPress: onBackToHub,
            activeOpacity: 0.8,
            children: /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 14 }, children: "\u2190 Back to Hub" })
          }
        )
      ] })
    ] });
  }
  const repTier = getRepTier(game.reputation);
  const creditInfo = getCreditLabel(game.creditScore);
  const nextBest = getNextBestAction(game);
  const office = OFFICES[game.officeIndex || 0];
  const { width } = Dimensions.get("window");
  const homeCity = CITIES.find((c) => c.id === (game.startingCityId || "salem"));
  const displayCityName = game.homeCityName || homeCity?.name || "Salem";
  const displayStateCode = game.homeStateCode || homeCity?.state || "OR";
  const displayCompetition = game.homeCompetition || homeCity?.competition || "Low";
  function renderSetup() {
    const US_STATES = [
      ["AL", "Alabama"],
      ["AK", "Alaska"],
      ["AZ", "Arizona"],
      ["AR", "Arkansas"],
      ["CA", "California"],
      ["CO", "Colorado"],
      ["CT", "Connecticut"],
      ["DE", "Delaware"],
      ["FL", "Florida"],
      ["GA", "Georgia"],
      ["HI", "Hawaii"],
      ["ID", "Idaho"],
      ["IL", "Illinois"],
      ["IN", "Indiana"],
      ["IA", "Iowa"],
      ["KS", "Kansas"],
      ["KY", "Kentucky"],
      ["LA", "Louisiana"],
      ["ME", "Maine"],
      ["MD", "Maryland"],
      ["MA", "Massachusetts"],
      ["MI", "Michigan"],
      ["MN", "Minnesota"],
      ["MS", "Mississippi"],
      ["MO", "Missouri"],
      ["MT", "Montana"],
      ["NE", "Nebraska"],
      ["NV", "Nevada"],
      ["NH", "New Hampshire"],
      ["NJ", "New Jersey"],
      ["NM", "New Mexico"],
      ["NY", "New York"],
      ["NC", "North Carolina"],
      ["ND", "North Dakota"],
      ["OH", "Ohio"],
      ["OK", "Oklahoma"],
      ["OR", "Oregon"],
      ["PA", "Pennsylvania"],
      ["RI", "Rhode Island"],
      ["SC", "South Carolina"],
      ["SD", "South Dakota"],
      ["TN", "Tennessee"],
      ["TX", "Texas"],
      ["UT", "Utah"],
      ["VT", "Vermont"],
      ["VA", "Virginia"],
      ["WA", "Washington"],
      ["WV", "West Virginia"],
      ["WI", "Wisconsin"],
      ["WY", "Wyoming"],
      ["DC", "Washington D.C."]
    ];
    return /* @__PURE__ */ jsx(SafeAreaView, { style: { flex: 1, backgroundColor: T.bg }, children: /* @__PURE__ */ jsxs(ScrollView, { contentContainerStyle: { padding: 24, paddingBottom: 60, flexGrow: 1, justifyContent: "center" }, children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 36, textAlign: "center", marginBottom: 4 }, children: "\u{1F3D7}\uFE0F" }),
      /* @__PURE__ */ jsx(Text, { style: { color: T.text, fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 4 }, children: "ConstructionFlow" }),
      /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 14, textAlign: "center", marginBottom: 32 }, children: "Build a construction empire from the ground up." }),
      /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 }, children: [0, 1, 2].map((s) => /* @__PURE__ */ jsx(View, { style: { width: 28, height: 4, borderRadius: 2, backgroundColor: setupStep >= s ? T.green : T.border } }, s)) }),
      setupStep === 0 ? (
        /* Step 1 — Company name */
        /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.green, borderWidth: 2 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 4 }], children: "Step 1 \u2014 Name Your Company" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 12 }], children: "This will appear on your Home screen, bids, and company profile." }),
          /* @__PURE__ */ jsx(
            TextInput,
            {
              style: [styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 12 }],
              value: setupName,
              onChangeText: setSetupName,
              placeholder: "e.g. Apex Build Co.",
              placeholderTextColor: T.sub,
              maxLength: 36,
              autoFocus: true
            }
          ),
          /* @__PURE__ */ jsx(
            TouchableOpacity,
            {
              style: [styles.btn, { backgroundColor: setupName.trim().length > 0 ? T.green : T.panel2, borderColor: T.green }],
              onPress: () => {
                if (setupName.trim().length > 0) setSetupStep(1);
              },
              children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: setupName.trim().length > 0 ? "#000" : T.sub }], children: "Next \u2014 Choose Your State \u2192" })
            }
          )
        ] })
      ) : setupStep === 1 ? (
        /* Step 2 — State selection (all 50 states, searchable) */
        /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 2 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 4 }], children: "Step 2 \u2014 Your State" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "Where are you building? Search by name or abbreviation." }),
          setupHomeStateCode ? /* @__PURE__ */ jsxs(View, { style: [styles.rowItem, { borderColor: T.cyan, backgroundColor: T.panel2, marginBottom: 10, flexDirection: "row", alignItems: "center" }], children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: T.cyan, flex: 1 }], children: [
              "\u2713 ",
              setupHomeStateName,
              " (",
              setupHomeStateCode,
              ")"
            ] }),
            /* @__PURE__ */ jsx(TouchableOpacity, { onPress: () => {
              setSetupHomeStateCode("");
              setSetupHomeStateName("");
              setSetupStateSearch("");
            }, children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub }], children: "Change" }) })
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              TextInput,
              {
                style: [styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 8 }],
                value: setupStateSearch,
                onChangeText: (text) => {
                  setSetupStateSearch(text);
                },
                placeholder: "e.g. Tennessee or TN",
                placeholderTextColor: T.sub,
                autoCorrect: false
              }
            ),
            /* @__PURE__ */ jsx(ScrollView, { style: { maxHeight: 220 }, keyboardShouldPersistTaps: "handled", children: US_STATES.filter(([code, name]) => {
              const q = setupStateSearch.toLowerCase();
              return !q || name.toLowerCase().includes(q) || code.toLowerCase() === q;
            }).map(([code, name]) => /* @__PURE__ */ jsxs(
              TouchableOpacity,
              {
                style: [styles.rowItem, { marginBottom: 4, paddingVertical: 8, flexDirection: "row", alignItems: "center" }],
                onPress: () => {
                  setSetupHomeStateCode(code);
                  setSetupHomeStateName(name);
                  setSetupStateSearch(name);
                },
                children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, width: 32 }], children: code }),
                  /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { flex: 1 }], children: name })
                ]
              },
              code
            )) })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginTop: 8 }, children: [
            /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { flex: 1, backgroundColor: T.panel2, borderColor: T.border }], onPress: () => setSetupStep(0), children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, col], children: "\u2190 Back" }) }),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.btn, { flex: 2, backgroundColor: setupHomeStateCode ? T.green : T.panel2, borderColor: T.green }],
                onPress: () => {
                  if (setupHomeStateCode) setSetupStep(2);
                },
                children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: setupHomeStateCode ? "#000" : T.sub }], children: "Next \u2014 Your City \u2192" })
              }
            )
          ] })
        ] })
      ) : (
        /* Step 3 — City name + market size */
        /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 2 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 4 }], children: "Step 3 \u2014 Your City" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "Type your city or town. This is where you'll pick up your first contracts." }),
          /* @__PURE__ */ jsx(
            TextInput,
            {
              style: [styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 14 }],
              value: setupHomeCityText,
              onChangeText: setSetupHomeCityText,
              placeholder: "e.g. Nashville",
              placeholderTextColor: T.sub,
              maxLength: 40,
              autoFocus: true
            }
          ),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "What's the construction market like there?" }),
          [
            { key: "Low", label: "Small Market", desc: "Less competition, steady local work" },
            { key: "Medium", label: "Growing City", desc: "Mix of residential and commercial" },
            { key: "High", label: "Major Metro", desc: "High competition, bigger contracts" }
          ].map((opt) => {
            const sel = setupCompetition === opt.key;
            return /* @__PURE__ */ jsxs(
              TouchableOpacity,
              {
                style: [styles.rowItem, { borderColor: sel ? T.cyan : T.border, backgroundColor: sel ? T.panel2 : "transparent", marginBottom: 6 }],
                onPress: () => setSetupCompetition(opt.key),
                children: [
                  /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                    /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: sel ? T.cyan : T.text }], children: opt.label }),
                    /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: opt.desc })
                  ] }),
                  /* @__PURE__ */ jsx(View, { style: [styles.selDot, { backgroundColor: sel ? T.cyan : T.border }] })
                ]
              },
              opt.key
            );
          }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginTop: 10 }, children: [
            /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { flex: 1, backgroundColor: T.panel2, borderColor: T.border }], onPress: () => setSetupStep(1), children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, col], children: "\u2190 Back" }) }),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.btn, { flex: 2, backgroundColor: setupHomeCityText.trim() ? T.green : T.panel2, borderColor: T.green }],
                onPress: () => {
                  if (!setupHomeCityText.trim()) return;
                  const competitionToCityId = { Low: "salem", Medium: "portland", High: "phoenix" };
                  const templateCityId = competitionToCityId[setupCompetition] || "salem";
                  update((g) => {
                    g.companyName = setupName.trim() || "New Build Co.";
                    g.startingCityId = templateCityId;
                    g.homeCityName = setupHomeCityText.trim();
                    g.homeStateCode = setupHomeStateCode;
                    g.homeStateName = setupHomeStateName;
                    g.homeCompetition = setupCompetition;
                    g.setupDone = true;
                    addLog2(g, `\u{1F3D7}\uFE0F Welcome to ${g.companyName}! Based in ${g.homeCityName}, ${g.homeStateCode}. Let's build.`);
                  });
                },
                children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: setupHomeCityText.trim() ? "#000" : T.sub }], children: "\u{1F680} Start Building" })
              }
            )
          ] })
        ] })
      ),
      /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 11, textAlign: "center", marginTop: 24 }, children: "You start with $75,000 \xB7 1 truck \xB7 3 crew members" })
    ] }) });
  }
  function renderHome() {
    const activeSites = getActiveSites(game);
    const idleCrew = getIdleCrew(game);
    const idleEquip = getIdleEquipment(game);
    const valuation = computeValuation(game);
    const rank = game.nationalRank || 99;
    const cityCount = (game.cityOffices || []).length + 1;
    const companyLevel = getCompanyLevel(game);
    const nextLevel = COMPANY_LEVELS.find((l) => l.level === companyLevel.level + 1);
    const overdueSites = activeSites.filter((s) => game.day > s.deadlineDay);
    const burningOutCrew = game.crew.filter((w) => (w.stamina ?? 50) < 15);
    const sitesNeedingMats = activeSites.filter((s) => {
      const contract = game.contracts.find((c) => c.id === s.contractId);
      const def = CONTRACT_DEFS.find((d) => d.id === contract?.defId);
      return def?.materials && Object.entries(def.materials).some(([matId, needed]) => ((s.materialsFulfilled || {})[matId] || 0) < needed);
    });
    const topRivalByRep = [...game.rivals || []].filter((r) => r.status !== "Bankrupt" && !(game.acquiredRivals || []).includes(r.id)).sort((a, b) => (b.cash || 0) - (a.cash || 0))[0];
    const rivalOutpacing = topRivalByRep && (topRivalByRep.cash || 0) > (game.cash || 0);
    return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 14, paddingBottom: 100 }, children: [
      (() => {
        const dailyBurn = (game.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0) + (game.equipment || []).reduce((s, e) => s + e.dailyCost, 0) + (OFFICES[game.officeIndex || 0]?.dailyRent || 0);
        const daysLeft = dailyBurn > 0 ? Math.floor(game.cash / dailyBurn) : 999;
        if (daysLeft < 5 && game.cash >= 0) return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.red, borderWidth: 2, borderLeftWidth: 5, marginBottom: 10 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.red, marginBottom: 4 }], children: "\u26A0\uFE0F Cash Running Low" }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, col], children: [
            "~",
            daysLeft,
            " day",
            daysLeft !== 1 ? "s" : "",
            " of runway left at ",
            money2(dailyBurn),
            "/day overhead. Complete a job or take out a loan in Finance before you run out."
          ] })
        ] });
        return null;
      })(),
      burningOutCrew.length > 0 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1.5, marginBottom: 8 }], children: [
        /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: T.orange, marginBottom: 6 }], children: [
          "\u26A0\uFE0F Crew Burning Out (",
          burningOutCrew.length,
          ")"
        ] }),
        burningOutCrew.slice(0, 3).map((w) => /* @__PURE__ */ jsxs(View, { style: { marginBottom: 6 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: w.name }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
              "Stamina ",
              Math.round(w.stamina ?? 0),
              "%"
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.round(w.stamina ?? 0)}%`, backgroundColor: T.red }] }) })
        ] }, w.id)),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, fontStyle: "italic", marginTop: 2 }], children: "Low stamina slows site progress \u2014 remove from sites to recover." })
      ] }),
      game.importantNotice && (() => {
        const noticeColors = { green: T.green, orange: T.orange, red: T.red, neutral: T.sub };
        const borderCol = noticeColors[game.importantNotice.tone] || T.cyan;
        return /* @__PURE__ */ jsxs(
          TouchableOpacity,
          {
            onPress: () => update((g) => {
              g.importantNotice = null;
            }),
            style: [styles.card, { backgroundColor: T.panel, borderColor: borderCol, borderWidth: 2, borderLeftWidth: 5, marginBottom: 10 }],
            children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: borderCol, marginBottom: 3 }], children: "\u{1F4E3} Update" }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: game.importantNotice.message }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginTop: 4, fontStyle: "italic" }], children: "Tap to dismiss" })
            ]
          }
        );
      })(),
      game.tutorialDone && (() => {
        const hs = computeHealthScore(game);
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T[hs.colorKey], borderWidth: 1.5 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "\u{1F4CA} Company Health" }),
            /* @__PURE__ */ jsx(View, { style: { backgroundColor: T[hs.colorKey] + "33", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }, children: /* @__PURE__ */ jsx(Text, { style: { color: T[hs.colorKey], fontWeight: "700", fontSize: 13 }, children: hs.label }) })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", marginBottom: 6 }, children: [
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 30, fontWeight: "900", color: T[hs.colorKey], marginRight: 10 }, children: hs.score }),
            /* @__PURE__ */ jsx(View, { style: { flex: 1 }, children: /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${hs.score}%`, backgroundColor: T[hs.colorKey] }] }) }) })
          ] }),
          hs.factors.map((f, i) => /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 11 }], children: [
            "\u2022 ",
            f
          ] }, i)),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginTop: 6, fontStyle: "italic" }], children: "Safety recovers +0.5/day toward 70. Incidents, corner cuts, and violations lower it." })
        ] });
      })(),
      game.tutorialDone && (() => {
        const warnings = getPredictiveWarnings(game);
        if (!warnings.length) return null;
        const sevColors = { high: T.red, medium: T.orange, low: T.sub };
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 8 }], children: "\u26A1 Early Warnings" }),
          warnings.map((w, i) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", marginBottom: 5 }, children: [
            /* @__PURE__ */ jsx(View, { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: sevColors[w.severity] || T.sub, marginRight: 8 } }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.text, flex: 1, fontSize: 12 }], children: w.text })
          ] }, i))
        ] });
      })(),
      (() => {
        const nba = getNextBestAction(game);
        const _isCritical = ["red", "orange"].includes(nba.tone);
        if (!game.tutorialDone && !_isCritical) return null;
        if (nba.tab === "Home") return null;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1.5 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 4 }], children: "\u{1F3AF} Next Best Action" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col, { fontWeight: "600", marginBottom: 4 }], children: nba.title }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, marginBottom: 10 }], children: nba.body }),
          /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { backgroundColor: T.cyan, borderColor: T.cyan }], onPress: () => setTab(nba.tab), children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: "#fff" }], children: [
            "Go to ",
            nba.tab,
            " \u2192"
          ] }) })
        ] });
      })(),
      ((game.onTimeStreak || 0) >= 1 || (game.bestStreak || 0) >= 3) && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1.5 }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "\u{1F525} On-Time Streak" }),
          /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.orange + "33", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }, children: /* @__PURE__ */ jsxs(Text, { style: { color: T.orange, fontWeight: "700", fontSize: 13 }, children: [
            game.onTimeStreak || 0,
            " in a row"
          ] }) })
        ] }),
        (() => {
          const milestones = [3, 5, 10, 20];
          const streak = game.onTimeStreak || 0;
          const nextMilestone = milestones.find((m) => m > streak) || 20;
          const pct = Math.min(100, Math.round(streak / nextMilestone * 100));
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 8 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${pct}%`, backgroundColor: T.orange }] }) }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, marginTop: 3 }], children: [
              streak,
              "/",
              nextMilestone,
              " \u2192 ",
              money2(nextMilestone * 300),
              " bonus \xB7 Best: ",
              game.bestStreak || 0
            ] })
          ] });
        })()
      ] }),
      game.weeklyChallenge && (() => {
        const wc = game.weeklyChallenge;
        const pct = wc.progress < 0 ? 0 : Math.min(100, Math.round((wc.progress || 0) / wc.target * 100));
        const daysLeft = Math.max(0, 7 - (game.day - (wc.startDay || 0)) % 7);
        const failed = wc.progress < 0;
        const claimable = wc.completed && !wc.claimedDay;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: claimable ? T.green : failed ? T.red : T.purple, borderWidth: 1.5 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "\u{1F4CB} Weekly Challenge" }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub }], children: [
              daysLeft,
              "d left"
            ] })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col, { marginVertical: 4 }], children: wc.label }),
          !failed && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 4 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${pct}%`, backgroundColor: wc.completed ? T.green : T.purple }] }) }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, marginTop: 2 }], children: [
              pct,
              "% \xB7 Reward: ",
              money2(wc.reward),
              " + ",
              wc.repBonus,
              " rep"
            ] })
          ] }),
          failed && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.red, marginTop: 4 }], children: "Challenge failed \u2014 new one starts next week." }),
          claimable && /* @__PURE__ */ jsx(
            TouchableOpacity,
            {
              style: [styles.btn, { marginTop: 8, backgroundColor: T.green, borderColor: T.green }],
              onPress: () => update((g) => {
                const _wc = g.weeklyChallenge;
                g.cash += _wc.reward;
                g.revenue += _wc.reward;
                g.reputation = Math.min(100, (g.reputation || 0) + _wc.repBonus);
                _wc.claimedDay = g.day;
                addLog2(g, `\u{1F389} Weekly challenge reward claimed: ${money2(_wc.reward)} + ${_wc.repBonus} rep!`);
              }),
              children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: "#fff" }], children: [
                "Claim Reward \u2014 ",
                money2(wc.reward)
              ] })
            }
          )
        ] });
      })(),
      game.weeklyReport && (() => {
        const wr = game.weeklyReport;
        const net = (wr.revenue || 0) - (wr.expenses || 0);
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "\u{1F4C8} Last Week Report" }),
            /* @__PURE__ */ jsx(TouchableOpacity, { onPress: () => update((g) => {
              g.weeklyReport = null;
            }), children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub }], children: "Dismiss" }) })
          ] }),
          /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 8, marginBottom: 6 }, children: [
            { label: "Revenue", val: money2(wr.revenue || 0), color: T.green },
            { label: "Expenses", val: money2(wr.expenses || 0), color: T.red },
            { label: "Net", val: (net >= 0 ? "+" : "") + money2(net), color: net >= 0 ? T.green : T.red }
          ].map((s) => /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 6, padding: 8, alignItems: "center" }, children: [
            /* @__PURE__ */ jsx(Text, { style: { color: s.color, fontSize: 13, fontWeight: "800" }, children: s.val }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: s.label })
          ] }, s.label)) }),
          (wr.jobsCompleted || 0) > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub }], children: [
            wr.jobsCompleted,
            " contract",
            wr.jobsCompleted !== 1 ? "s" : "",
            " completed \xB7 ",
            wr.onTimeJobs || 0,
            " on time"
          ] })
        ] });
      })(),
      game.tutorialDone && (() => {
        const rels = game.clientRelationships || {};
        const activeClients = CLIENT_ROSTER.filter((c) => rels[c.id]?.jobsDone > 0);
        if (activeClients.length === 0) return null;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "\u{1F91D} Client Relationships" }),
          CLIENT_ROSTER.map((cl) => {
            const rel = rels[cl.id] || { loyalty: 0, jobsDone: 0 };
            if (rel.jobsDone === 0) return null;
            const tier = getClientTier(rel.loyalty);
            const pct = Math.min(100, Math.round(rel.loyalty / 100 * 100));
            const tierColor = T[tier.color] || T.sub;
            return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 10 }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }, children: [
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, col], children: [
                  cl.icon,
                  " ",
                  cl.name
                ] }),
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 6 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: tierColor, fontSize: 10, fontWeight: "700" }], children: tier.label }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
                    rel.jobsDone,
                    " job",
                    rel.jobsDone !== 1 ? "s" : ""
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${pct}%`, backgroundColor: tierColor, borderRadius: 2 } }) }),
              tier.valueMult > 1 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.green, fontSize: 10, marginTop: 2 }], children: [
                "\u2713 ",
                Math.round((tier.valueMult - 1) * 100),
                "% value bonus \xB7 +",
                tier.extraDays,
                "d deadline on their contracts"
              ] })
            ] }, cl.id);
          })
        ] });
      })(),
      !game.tutorialDone && (() => {
        const hasActiveSite = (game.activeSites || []).length > 0;
        const hasBid = (game.contracts || []).some((c) => c.status === "Active" || c.status === "Awarded");
        const needsMaterials = hasActiveSite && (game.activeSites || []).some((s2) => {
          const con = (game.contracts || []).find((c) => c.id === s2.contractId);
          const def = CONTRACT_DEFS.find((d) => d.id === con?.defId);
          return def?.materials && Object.entries(def.materials).some(([id, qty]) => ((s2.materialsFulfilled || {})[id] || 0) < qty);
        });
        let step = 0;
        if (hasActiveSite && !needsMaterials) step = 3;
        else if (hasActiveSite && needsMaterials) step = 2;
        else if (hasBid) step = 1;
        const steps = [
          {
            num: "1 of 4",
            title: "Accept Your First Contract",
            body: `You start with ${money2(game.cash)}, 1 truck, ${(game.crew || []).length} crew, and 20 lumber already in inventory.

Go to Bids \u2192 accept the Fence Installation \u2014 your lumber is already covered. Assign crew + truck, then tap Mobilise.`,
            cta: "Go to Bids \u2192",
            action: () => setTab("Bids")
          },
          {
            num: "2 of 4",
            title: "Buy Materials & Mobilise Crew",
            body: `Your contract is accepted. Now:
\u2022 Go to Sites \u2192 open the job
\u2022 Tap Buy Materials to purchase what the job needs
\u2022 Assign crew and your truck, then tap Mobilise`,
            cta: "Go to Sites \u2192",
            action: () => setTab("Sites")
          },
          {
            num: "3 of 4",
            title: "Buy Missing Materials",
            body: `Your site needs materials before work can start. Go to Sites, open the job, and tap Buy Materials.

Your daily costs: ${money2((game.crew || []).reduce((s2, w) => s2 + (w.wagePerDay || 0), 0))} crew + ${money2(game.equipment.reduce((s2, e) => s2 + e.dailyCost, 0))} equipment.`,
            cta: "Go to Sites \u2192",
            action: () => setTab("Sites")
          },
          {
            num: "4 of 4",
            title: "Watch Your Site Progress",
            body: `Crew and equipment are working! Check the Sites tab to see phase progress.

When all phases complete, cash lands automatically.

Tip: assign more crew to finish faster \u2014 but watch your daily wage bill.`,
            cta: "Go to Sites \u2192",
            action: () => setTab("Sites")
          }
        ];
        const s = steps[step];
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.cyan, borderWidth: 2, borderLeftWidth: 5 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.cyan }], children: "\u{1F680} Getting Started" }),
            /* @__PURE__ */ jsxs(Text, { style: { color: T.sub, fontSize: 11 }, children: [
              "Step ",
              s.num
            ] })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 6 }], children: s.title }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col, { lineHeight: 20, marginBottom: 10 }], children: s.body }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8 }, children: [
            /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { flex: 1, backgroundColor: T.cyan, borderColor: T.cyan }], onPress: s.action, children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#000" }], children: s.cta }) }),
            /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { backgroundColor: T.panel3 || T.panel, borderColor: T.border }], onPress: () => update((g) => {
              g.tutorialDone = true;
              addImportantNotice(g, "Tutorial skipped. Check Bids for contracts, Finance for loans, Empire to grow.", "green");
            }), children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, subCol], children: "Skip" }) })
          ] })
        ] });
      })(),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.strongBorder, borderLeftWidth: 4, borderLeftColor: T.cyan }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxs(View, { children: [
            /* @__PURE__ */ jsxs(Text, { style: [{ fontSize: 11, color: T.cyan, fontWeight: "700", marginBottom: 2 }], children: [
              "LEVEL ",
              companyLevel.level
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: companyLevel.label })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
            nextLevel && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub }], children: [
              "Next: ",
              nextLevel.label
            ] }),
            !nextLevel && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.yellow }], children: "MAX LEVEL" })
          ] })
        ] }),
        nextLevel && /* @__PURE__ */ jsx(View, { style: { marginTop: 8, gap: 4 }, children: [
          { label: "Rep", current: game.reputation || 0, target: nextLevel.repMin, color: T.purple, fmt: (v) => `${v}` },
          { label: "Jobs", current: game.completedJobs || 0, target: nextLevel.jobsMin, color: T.orange, fmt: (v) => `${v}` },
          { label: "Value", current: valuation, target: nextLevel.valMin, color: T.cyan, fmt: (v) => money2(v) }
        ].map((bar) => {
          const pct = Math.min(100, Math.round(bar.current / Math.max(1, bar.target) * 100));
          const done = bar.current >= bar.target;
          return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: done ? T.green : T.sub, fontSize: 10 }], children: [
                done ? "\u2713 " : "",
                bar.label
              ] }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: done ? T.green : bar.color, fontSize: 10 }], children: [
                bar.fmt(bar.current),
                " / ",
                bar.fmt(bar.target)
              ] })
            ] }),
            /* @__PURE__ */ jsx(View, { style: { height: 3, backgroundColor: T.track, borderRadius: 2, marginTop: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 3, width: `${pct}%`, backgroundColor: done ? T.green : bar.color, borderRadius: 2 } }) })
          ] }, bar.label);
        }) })
      ] }),
      /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsxs(View, { style: { flex: 1, marginRight: 8 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.h2, col], numberOfLines: 1, children: game.companyName }),
            (game.generation || 1) > 1 && /* @__PURE__ */ jsxs(Text, { style: { fontSize: 10, color: T.yellow, fontWeight: "700", borderWidth: 1, borderColor: T.yellow, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }, children: [
              "GEN ",
              game.generation
            ] })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 8 }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                repTier.badge,
                " ",
                repTier.label,
                " \xB7 Day ",
                game.day
              ] }),
              game.seasonEmoji && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 11 }], children: [
                game.seasonEmoji,
                " ",
                game.currentSeason
              ] }),
              (game.savings || 0) > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan, fontSize: 10 }], children: [
                "\u{1F3E6} ",
                money2(game.savings),
                " saved"
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: speedMode ? T.yellow + "33" : T.panel2, borderWidth: 1, borderColor: speedMode ? T.yellow : T.border, marginLeft: 8 },
                onPress: () => setSpeedMode((s) => !s),
                children: /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, color: speedMode ? T.yellow : T.sub, fontWeight: speedMode ? "700" : "400" }, children: speedMode ? "\u26A1 2\xD7" : "1\xD7" })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end", minWidth: 0 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.cashBig, { color: game.cash >= 0 ? T.green : T.red }], numberOfLines: 1, children: money2(game.cash) }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], numberOfLines: 1, children: office.name }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginTop: 1 }], numberOfLines: 1, children: [
            "\u{1F4CD} ",
            displayCityName,
            ", ",
            displayStateCode
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Today's Priorities" }),
        sitesNeedingMats.length > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
          "\u26A0 Materials needed on ",
          sitesNeedingMats.length,
          " site",
          sitesNeedingMats.length > 1 ? "s" : ""
        ] }),
        burningOutCrew.length > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
          "\u26A0 ",
          burningOutCrew.length,
          " crew member",
          burningOutCrew.length > 1 ? "s" : "",
          " burning out"
        ] }),
        overdueSites.length > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
          "\u{1F534} ",
          overdueSites.length,
          " site",
          overdueSites.length > 1 ? "s" : "",
          " overdue"
        ] }),
        rivalOutpacing && topRivalByRep && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.yellow }], children: [
          "\u26A1 ",
          topRivalByRep.name.split(" ")[0],
          " is outpacing you"
        ] }),
        sitesNeedingMats.length === 0 && burningOutCrew.length === 0 && overdueSites.length === 0 && !rivalOutpacing && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green }], children: "\u2705 Operations running smoothly" })
      ] }),
      (() => {
        const equipVal = Math.round((game.equipment || []).reduce((s, e) => s + e.price * (e.condition / 100) * 0.6, 0));
        const realEstVal = Math.round((game.properties || []).reduce((s, p) => {
          const def = PROPERTY_TYPES.find((t) => t.id === p.typeId);
          return s + (def ? def.cost * (def.resaleRate || 0.8) : 0);
        }, 0));
        const wkRev = game.weeklyStats?.revenue || 0;
        const wkExp = game.weeklyStats?.expenses || 0;
        const wkProfit = wkRev - wkExp;
        const topRival = [...game.rivals || []].filter((r) => r.status !== "Bankrupt").sort((a, b) => (b.rep || 0) - (a.rep || 0))[0];
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.strongBorder, borderLeftWidth: 4 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }, children: [
            /* @__PURE__ */ jsxs(View, { children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, { color: T.purple }], children: "Executive Dashboard" }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                "CEO View \xB7 Day ",
                game.day
              ] })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
              /* @__PURE__ */ jsx(Text, { style: [{ fontSize: 20, fontWeight: "900", color: T.cyan }], children: money2(valuation) }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Company Value" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 6, marginBottom: 6 }, children: [
            { label: "National Rank", val: rank <= 3 ? `#${rank} \u{1F3C6}` : `#${rank}`, color: rank <= 3 ? T.yellow : rank <= 10 ? T.green : T.sub },
            { label: "Market Share", val: `${game.marketShare || 1}%`, color: T.blue },
            { label: "Cities Active", val: `${cityCount}`, color: T.orange }
          ].map((k) => /* @__PURE__ */ jsxs(View, { style: [styles.kpi, { flex: 1, backgroundColor: T.panel, borderColor: T.border }], children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.kpiVal, { color: k.color, fontSize: 13 }], children: k.val }),
            /* @__PURE__ */ jsx(Text, { style: [styles.kpiLabel, subCol], children: k.label })
          ] }, k.label)) }),
          /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 6, marginBottom: 6 }, children: [
            { label: "Wk Revenue", val: money2(wkRev), color: T.green },
            { label: "Wk Expenses", val: money2(wkExp), color: T.red },
            { label: "Wk Profit", val: money2(wkProfit), color: wkProfit >= 0 ? T.green : T.red }
          ].map((k) => /* @__PURE__ */ jsxs(View, { style: [styles.kpi, { flex: 1, backgroundColor: T.panel, borderColor: T.border }], children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.kpiVal, { color: k.color, fontSize: 12 }], children: k.val }),
            /* @__PURE__ */ jsx(Text, { style: [styles.kpiLabel, subCol], children: k.label })
          ] }, k.label)) }),
          /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 6 }, children: [
            { label: "Equip Fleet", val: money2(equipVal), color: T.orange },
            { label: "Real Estate", val: money2(realEstVal), color: T.purple },
            { label: "Top Rival", val: topRival ? topRival.name.split(" ")[0] : "None", color: T.red }
          ].map((k) => /* @__PURE__ */ jsxs(View, { style: [styles.kpi, { flex: 1, backgroundColor: T.panel, borderColor: T.border }], children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.kpiVal, { color: k.color, fontSize: 11 }], numberOfLines: 1, children: k.val }),
            /* @__PURE__ */ jsx(Text, { style: [styles.kpiLabel, subCol], children: k.label })
          ] }, k.label)) }),
          EMPIRE_GOALS.filter((g2) => !(game.empireGoalsCompleted || []).includes(g2.id)).slice(0, 2).map((goal) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.purple }], children: [
              "\u{1F3AF} ",
              goal.title
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: goal.desc })
          ] }, goal.id))
        ] });
      })(),
      nextBest && /* @__PURE__ */ jsxs(
        TouchableOpacity,
        {
          style: [styles.card, { backgroundColor: T.panel2, borderColor: T[nextBest.tone] || T.border, borderLeftWidth: 4 }],
          onPress: () => setTab(nextBest.tab || tab),
          activeOpacity: 0.8,
          children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T[nextBest.tone] || T.text }], children: nextBest.title }),
            /* @__PURE__ */ jsx(Text, { style: [styles.body, col], children: nextBest.body }),
            nextBest.tab && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T[nextBest.tone] }], children: [
              "\u2192 Go to ",
              nextBest.tab
            ] })
          ]
        }
      ),
      (game.activeSites || []).length > 0 && /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.card, { backgroundColor: T.panel2, borderColor: T.purple, borderLeftWidth: 4 }],
          onPress: handleSpeedUp,
          activeOpacity: 0.85,
          children: /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.purple }], children: "\u26A1 Speed Up Time" }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Advance 2 game hours instantly \u2014 costs in-game cash." }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.purple }], children: [
                "Cost: ",
                money2(Math.round(1e3 * Math.pow(2, game.speedUpUses || 0))),
                " ",
                (game.speedUpUses || 0) > 0 ? `(doubles each use)` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsx(Text, { style: { color: T.purple, fontSize: 22 }, children: "\u2192" })
          ] })
        }
      ),
      (() => {
        const legacy = getLegacyScore(game);
        const nextTiers = [
          { min: 80, label: "Industry Legend", icon: "trophy" },
          { min: 60, label: "National Powerhouse", icon: "business" },
          { min: 40, label: "State Leader", icon: "star" },
          { min: 20, label: "Regional Contractor", icon: "construct" },
          { min: 0, label: "Local Builder", icon: "hammer" }
        ];
        const nextTier = nextTiers.slice().reverse().find((t) => t.min > legacy.score);
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.purple, borderLeftWidth: 4, marginBottom: 8 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxs(View, { children: [
              /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, color: T.purple, fontWeight: "700", marginBottom: 2 }, children: "LEGACY SCORE" }),
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 6 }, children: [
                /* @__PURE__ */ jsx(Ionicons, { name: legacy.icon, size: 20, color: T.purple }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 22, fontWeight: "900", color: T.text }, children: legacy.label })
              ] })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
              /* @__PURE__ */ jsx(Text, { style: { fontSize: 28, fontWeight: "900", color: T.purple }, children: legacy.score }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub }], children: "/100" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: { height: 5, backgroundColor: T.track, borderRadius: 3, marginTop: 8 }, children: /* @__PURE__ */ jsx(View, { style: { height: 5, width: `${legacy.score}%`, backgroundColor: T.purple, borderRadius: 3 } }) }),
          nextTier && /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: "Next:" }),
            /* @__PURE__ */ jsx(Ionicons, { name: nextTier.icon, size: 10, color: T.sub }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
              nextTier.label,
              " at ",
              nextTier.min,
              " pts"
            ] })
          ] })
        ] });
      })(),
      /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 8, marginBottom: 8 }, children: [
        { label: "Active Sites", val: activeSites.length, color: T.orange },
        { label: "Crew Idle", val: idleCrew.length, color: T.cyan },
        { label: "Jobs Done", val: game.completedJobs, color: T.green },
        { label: "Reputation", val: `${game.reputation}`, color: T.purple }
      ].map((k) => /* @__PURE__ */ jsxs(View, { style: [styles.kpi, { backgroundColor: T.panel, borderColor: T.border, flex: 1 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.kpiVal, { color: k.color }], children: k.val }),
        /* @__PURE__ */ jsx(Text, { style: [styles.kpiLabel, subCol], children: k.label })
      ] }, k.label)) }),
      game.activeMarketEvent && (() => {
        const evt = MARKET_EVENTS.find((e) => e.id === game.activeMarketEvent);
        if (!evt) return null;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T[evt.tone] || T.border, borderWidth: 2 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 6 }, children: [
            /* @__PURE__ */ jsx(Ionicons, { name: evt.ionicon, size: 14, color: T[evt.tone] || T.text }),
            /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T[evt.tone] || T.text }], children: evt.label })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: evt.desc }),
          /* @__PURE__ */ jsxs(View, { style: { marginTop: 6 }, children: [
            /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2, overflow: "hidden" }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${Math.round(game.marketEventDaysLeft / evt.duration * 100)}%`, backgroundColor: T[evt.tone] || T.text, borderRadius: 2 } }) }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T[evt.tone] || T.sub, marginTop: 2, fontSize: 10 }], children: [
              game.marketEventDaysLeft,
              " of ",
              evt.duration,
              " day",
              evt.duration !== 1 ? "s" : "",
              " remaining"
            ] })
          ] })
        ] });
      })(),
      activeSites.length > 0 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Active Sites" }),
        activeSites.map((site) => {
          const overallPct = (site.currentPhaseIdx / site.phases.length + site.phaseProgress / 100 / site.phases.length) * 100;
          const currentPhaseName = site.phases[site.currentPhaseIdx] || "Complete";
          const vis = PHASE_VISUALS[currentPhaseName] || { emoji: "\u{1F3D7}\uFE0F", desc: currentPhaseName };
          return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { flex: 1 }], numberOfLines: 1, children: site.label }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: site.status === "Paused" ? T.orange : T.cyan }], numberOfLines: 1, children: site.status === "Paused" ? "\u23F8 Paused" : `${vis.emoji} ${currentPhaseName}` })
            ] }),
            /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 3, marginTop: 5, marginBottom: 3 }, children: site.phases.map((ph, idx) => {
              const done = idx < site.currentPhaseIdx;
              const active = idx === site.currentPhaseIdx;
              const pv = PHASE_VISUALS[ph] || { emoji: "\u{1F3D7}\uFE0F" };
              return /* @__PURE__ */ jsxs(View, { style: { alignItems: "center", flex: 1 }, children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 14, opacity: done ? 1 : active ? 1 : 0.3 }, children: pv.emoji }),
                active && /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, width: "100%", marginTop: 2 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${site.phaseProgress}%`, backgroundColor: T.orange }] }) }),
                done && /* @__PURE__ */ jsx(View, { style: { height: 4, width: "100%", backgroundColor: T.green, borderRadius: 2, marginTop: 2 } }),
                !done && !active && /* @__PURE__ */ jsx(View, { style: { height: 4, width: "100%", backgroundColor: T.track, borderRadius: 2, marginTop: 2 } })
              ] }, idx);
            }) }),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                site.client,
                " \xB7 ",
                Math.round(overallPct),
                "%"
              ] }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: game.day > site.deadlineDay ? T.red : T.green }], children: game.day > site.deadlineDay ? "\u26A0 OVERDUE" : `Day ${site.deadlineDay} deadline` })
            ] })
          ] }, site.id);
        })
      ] }),
      (() => {
        const ws = game.weeklyStats || {};
        const income = ws.revenue || 0;
        const expenses = ws.expenses || 0;
        if (income === 0 && expenses === 0) return null;
        const net = income - expenses;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border, marginBottom: 8 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "This Week" }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Revenue" }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontWeight: "700" }], children: money2(income) })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Expenses" }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
              "-",
              money2(expenses)
            ] })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: T.border }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Net" }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: net >= 0 ? T.green : T.red, fontWeight: "700" }], children: [
              net >= 0 ? "+" : "",
              money2(net)
            ] })
          ] })
        ] });
      })(),
      game.hotMaterialDeal && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.green + "18", borderColor: T.green, borderWidth: 1.5, marginBottom: 8 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, { color: T.green }], children: "\u{1F4CA} Market Flash Deal" }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          game.hotMaterialDeal.label,
          " \u2014 ",
          game.hotMaterialDeal.discountPct,
          "% off \xB7 ",
          money2(game.hotMaterialDeal.unitPrice),
          "/unit"
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
          "Expires Day ",
          game.hotMaterialDeal.expiresDay,
          " \xB7 Buy in Sites tab"
        ] }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.smallBtn, { marginTop: 6, backgroundColor: T.green, borderColor: T.green }],
            onPress: () => setTab("Sites"),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: "#000" }], children: "Buy Now \u2192" })
          }
        )
      ] }),
      (() => {
        const FEED_EMOJI = { green: "\u2705", red: "\u{1F534}", orange: "\u26A0\uFE0F", cyan: "\u{1F535}", yellow: "\u2B50", purple: "\u{1F537}", sub: "\xB7" };
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Ops Feed" }),
          game.opsFeed?.length > 0 ? game.opsFeed.slice(0, 8).map((entry) => /* @__PURE__ */ jsxs(Text, { style: [styles.feedItem, { color: T[entry.tone] || T.sub }], children: [
            FEED_EMOJI[entry.tone] || "\xB7",
            " ",
            entry.text
          ] }, entry.id)) : /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontStyle: "italic" }], children: "No recent events \u2014 keep building!" })
        ] });
      })(),
      game.rivals && game.rivals.length > 0 && (() => {
        const topRivals = [...game.rivals].filter((r) => !(game.acquiredRivals || []).includes(r.id)).sort((a, b) => (b.rep || 0) - (a.rep || 0)).slice(0, 2);
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Rival Activity" }),
          topRivals.map((r) => {
            const statusLabel = r.status === "Bankrupt" ? "Bankrupt" : (r.cash || 0) < 5e3 ? "Struggling" : "Active";
            const statusColor = r.status === "Bankrupt" ? T.sub : (r.cash || 0) < 5e3 ? T.orange : T.green;
            const myRep = game.reputation || 0;
            const theirRep = r.rep || 0;
            const maxRep = Math.max(myRep, theirRep, 1);
            const myPct = Math.round(myRep / maxRep * 100);
            const ahead = myRep >= theirRep;
            return /* @__PURE__ */ jsxs(View, { style: { paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsxs(View, { children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: r.name }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                    r.activeJobs || 0,
                    " active jobs"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: statusColor, fontWeight: "600" }], children: statusLabel }),
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: money2(r.cash || 0) })
                ] })
              ] }),
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", height: 3, borderRadius: 2, overflow: "hidden", marginTop: 4 }, children: [
                /* @__PURE__ */ jsx(View, { style: { flex: myPct, height: 3, backgroundColor: T.purple } }),
                /* @__PURE__ */ jsx(View, { style: { flex: 100 - myPct, height: 3, backgroundColor: ahead ? T.panel2 : T.red } })
              ] }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 1 }], children: [
                "You ",
                myRep,
                " rep ",
                ahead ? "\u2191" : "\u2193",
                " ",
                r.name.split(" ")[0],
                " ",
                theirRep
              ] })
            ] }, r.id);
          })
        ] });
      })(),
      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginTop: 4 }, children: [
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { backgroundColor: T.panel2, borderColor: T.border, flex: 1 }],
            onPress: () => {
              const t = theme === "dark" ? "light" : "dark";
              setTheme(t);
              update((g) => {
                g.theme = t;
              });
            },
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, col], children: theme === "dark" ? "\u2600\uFE0F Light Mode" : "\u{1F319} Dark Mode" })
          }
        ),
        /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { backgroundColor: T.panel2, borderColor: T.red, flex: 1 }], onPress: handleResetGame, children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.red }], children: "Reset Game" }) })
      ] }),
      onBackToHub && /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { backgroundColor: T.panel2, borderColor: T.border, marginTop: 8 }],
          onPress: onBackToHub,
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, col], children: "\u2190 Back to Game Hub" })
        }
      )
    ] });
  }
  function renderBids() {
    const allOpen = getOpenContracts(game);
    const filter = game.contractCategoryFilter || "All";
    const openContracts = filter === "All" ? allOpen : allOpen.filter((c) => c.category === filter);
    const idleCrew = getIdleCrew(game);
    const idleEquip = getIdleEquipment(game);
    return /* @__PURE__ */ jsx(
      BidsScreen,
      {
        game,
        T,
        col,
        subCol,
        openContracts,
        allOpenCount: allOpen.length,
        categoryFilter: filter,
        onSetFilter: (f) => update((g) => {
          g.contractCategoryFilter = f;
        }),
        idleCrew,
        idleEquip,
        onStartSite: handleStartSite,
        onBuyMaterials: handleBuyMaterials,
        onSetBidStyle: handleSetBidStyle
      }
    );
  }
  function renderSites() {
    const activeSites = getActiveSites(game);
    const SITE_MODES = [
      { key: "normal", label: "Normal", icon: "reorder-three", desc: "Balanced pace", color: T.sub },
      { key: "rush", label: "Rush", icon: "flash", desc: "+45% speed, tires crew", color: T.orange },
      { key: "overtime", label: "Overtime", icon: "moon", desc: "+30% speed, $$ cost", color: T.yellow },
      { key: "quality", label: "Quality", icon: "star", desc: "-22% speed, +bonus pay", color: T.cyan },
      { key: "budget", label: "Budget", icon: "cash", desc: "-12% speed, save costs", color: T.green }
    ];
    return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 12, paddingBottom: 100 }, children: [
      activeSites.length === 0 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", paddingVertical: 24 }], children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 32, marginBottom: 8 }, children: "\u{1F3D7}\uFE0F" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.sub, textAlign: "center", marginBottom: 4 }], children: "No active sites" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { textAlign: "center", marginBottom: 12 }], children: "Accept a contract from the Bids tab to get started." }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { backgroundColor: T.orange, borderColor: T.orange }],
            onPress: () => setTab("Bids"),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#fff" }], children: "Go to Bids" })
          }
        )
      ] }),
      activeSites.length > 0 && /* @__PURE__ */ jsxs(View, { style: { marginBottom: 16 }, children: [
        /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col, { marginBottom: 8 }], children: [
          "Active Sites (",
          activeSites.length,
          ")"
        ] }),
        activeSites.map((site) => {
          const overallPct = Math.min(100, (site.currentPhaseIdx / site.phases.length + Math.max(0, site.phaseProgress) / 100 / site.phases.length) * 100);
          const currentPh = site.phases[site.currentPhaseIdx] || "Complete";
          const vis = PHASE_VISUALS[currentPh] || { emoji: "\u{1F3D7}\uFE0F" };
          const mode = site.siteMode || "normal";
          const modeDef = SITE_MODES.find((m) => m.key === mode) || SITE_MODES[0];
          const siteCrew = game.crew.filter((w) => site.assignedCrewIds.includes(w.id));
          const siteEquip = game.equipment.filter((e) => site.assignedEquipmentIds.includes(e.id));
          const contract = game.contracts.find((c) => c.id === site.contractId);
          const def = CONTRACT_DEFS.find((d) => d.id === contract?.defId);
          const daysLate = Math.max(0, game.day - site.deadlineDay);
          const projectedProfit = Math.max(0, site.totalValue - daysLate * site.penaltyPerDay);
          const isOverdue = game.day > site.deadlineDay;
          const missingMats = getSiteMissingMaterials(site, def, game);
          const _renegCost = Math.round((def?.baseValue || site.totalValue || 1e4) * 0.08);
          const _canRenegotiate = game.cash >= _renegCost;
          const hasMissingMats = missingMats.length > 0;
          const totalCostNormal = missingMats.reduce((s, m) => s + m.costNormal, 0);
          const totalCostEmergency = missingMats.reduce((s, m) => s + m.costEmergency, 0);
          const canAffordNormal = game.cash >= totalCostNormal;
          const canAffordEmergency = game.cash >= totalCostEmergency || (game.creditScore || 600) >= 600;
          const allMats = def?.materials ? Object.entries(def.materials).map(([matId, needed]) => {
            const fulfilled = (site.materialsFulfilled || {})[matId] || 0;
            const mat = MATERIAL_DEFS.find((m) => m.id === matId);
            return { icon: mat?.icon || "\u{1F4E6}", id: matId, fulfilled, needed, ok: fulfilled >= needed };
          }) : [];
          const lastChaos = site.chaosHistory?.[0];
          return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: hasMissingMats ? T.orange : isOverdue ? T.red : T.border, borderWidth: hasMissingMats || isOverdue ? 2 : 1, marginBottom: 10 }], children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flex: 1, marginRight: 8 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.label, col], numberOfLines: 1, children: site.label }),
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], numberOfLines: 1, children: site.client }),
                contract?.cityId && (() => {
                  const siteCity = CITIES.find((c) => c.id === contract.cityId);
                  if (!siteCity) return null;
                  const _region = siteCity.region;
                  const _weatherRisk = _region === "Pacific Northwest" ? "\u{1F327}\uFE0F Rain risk region" : _region === "Southwest" ? "\u2600\uFE0F Heat risk region" : _region === "Mountain" ? "\u2744\uFE0F Snow risk region" : _region === "South Central" ? "\u26C8\uFE0F Storm risk region" : null;
                  return /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
                      "\u{1F4CD} ",
                      siteCity.name
                    ] }),
                    _weatherRisk && !site.currentWeather && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 9 }], children: _weatherRisk })
                  ] });
                })()
              ] }),
              /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: site.status === "Paused" ? T.orange : isOverdue ? T.red : T.green, fontWeight: "700" }], children: site.status === "Paused" ? "\u23F8 Paused" : isOverdue ? `\u26A0 ${daysLate}d Late` : `${Math.round(overallPct)}%` }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: isOverdue ? T.red : T.sub }], children: [
                  "Due Day ",
                  site.deadlineDay
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginBottom: 4 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${overallPct}%`, backgroundColor: isOverdue ? T.red : T.orange }] }) }),
            !isOverdue && site.status !== "Paused" && (() => {
              const daysLeft = site.deadlineDay - game.day;
              const barColor = daysLeft <= 2 ? T.red : daysLeft <= 5 ? T.orange : T.green;
              const pct = Math.min(100, Math.round(daysLeft / 14 * 100));
              return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 6 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: "Deadline" }),
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: barColor, fontSize: 10, fontWeight: daysLeft <= 5 ? "700" : "400" }], children: daysLeft <= 0 ? "Due today" : `${daysLeft}d left` })
                ] }),
                /* @__PURE__ */ jsx(View, { style: { height: 3, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 3, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 } }) })
              ] });
            })(),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", marginBottom: 6 }, children: [
              /* @__PURE__ */ jsx(Text, { style: { fontSize: 16, marginRight: 6 }, children: vis.emoji }),
              /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.cyan, fontWeight: "600", fontSize: 11 }], children: currentPh }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
                    "Phase ",
                    (site.currentPhaseIdx || 0) + 1,
                    "/",
                    site.phases.length
                  ] })
                ] }),
                /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, height: 4, marginTop: 3 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.max(0, site.phaseProgress || 0)}%`, backgroundColor: T.cyan, height: 4 }] }) }),
                (() => {
                  const _rate = site._progressRate;
                  if (!_rate || overallPct >= 100 || site.status === "Paused") return null;
                  const _phasesLeft = (site.phases.length || 1) - (site.currentPhaseIdx || 0);
                  const _progressLeft = 100 * _phasesLeft - (site.phaseProgress || 0);
                  const _pctPerDay = _rate * 48;
                  const _daysLeft = _pctPerDay > 0 ? Math.ceil(_progressLeft / _pctPerDay) : null;
                  return /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginTop: 3 }], children: [
                    _daysLeft ? `~${_daysLeft} days remaining` : "",
                    _daysLeft ? " \xB7 " : "",
                    _pctPerDay.toFixed(1),
                    "%/day"
                  ] });
                })()
              ] })
            ] }),
            (() => {
              const sitePh = site.phases[site.currentPhaseIdx] || "";
              const specialtyMap = SPECIALTY_PHASE_BONUS;
              const crewHasMatch = siteCrew.some((w) => (specialtyMap[w.specialty || ""] || {})[sitePh] > 1);
              const phaseTypeMatch = sitePh && (PHASE_TYPE_BONUS[sitePh] || {});
              const equipHasMatch = siteEquip.some((e) => (phaseTypeMatch[e.type] || 1) > 1);
              const showMismatch = sitePh && siteCrew.length > 0 && !crewHasMatch && !equipHasMatch;
              const rushPenalty = site.rushQualityPenalty || 0;
              return /* @__PURE__ */ jsxs(Fragment, { children: [
                showMismatch && (() => {
                  const neededSpec = Object.entries(SPECIALTY_PHASE_BONUS).find(
                    ([, phases]) => Object.entries(phases).some(([p, v]) => v > 1 && sitePh.toLowerCase().includes(p.toLowerCase()))
                  )?.[0] || "matching";
                  return /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange, fontSize: 10, marginBottom: 4 }], children: [
                    "\u26A0 ",
                    sitePh,
                    " needs a ",
                    neededSpec,
                    " specialist \xB7 \u221210% speed without one"
                  ] });
                })(),
                rushPenalty > 0.04 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange, fontSize: 10, marginBottom: 4 }], children: [
                  "\u26A1 Rush impact: quality \u2212",
                  Math.round(rushPenalty * 100),
                  "%"
                ] })
              ] });
            })(),
            (() => {
              const idleCrew = game.crew.filter((w) => w.status === "Idle");
              return /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.panel2, borderRadius: 6, padding: 8, marginBottom: 6 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, fontWeight: "700" }], children: [
                    "CREW (",
                    siteCrew.length,
                    ")"
                  ] }),
                  siteCrew.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.red, fontSize: 10 }], children: "\u26A0 No crew" })
                ] }),
                (() => {
                  const _exhausted = siteCrew.filter((w) => (w.stamina ?? 50) < 25 || (w.mood ?? 70) < 20);
                  return _exhausted.length > 0 ? /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange, fontSize: 10, marginBottom: 3 }], children: [
                    "\u26A0 ",
                    _exhausted.length,
                    " worker",
                    _exhausted.length > 1 ? "s" : "",
                    " exhausted \u2014 rest them in Crew tab."
                  ] }) : null;
                })(),
                siteCrew.map((w) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 10, color: T.text, flex: 1 }], children: [
                    w.name.split(" ")[0],
                    " \xB7 ",
                    w.specialty || w.role
                  ] }),
                  /* @__PURE__ */ jsx(
                    TouchableOpacity,
                    {
                      style: { backgroundColor: T.red + "33", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.red },
                      onPress: () => handleUnassignCrewFromSite(w.id, site.id),
                      children: /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.red, fontWeight: "700" }, children: "Remove" })
                    }
                  )
                ] }, w.id)),
                idleCrew.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 4, marginBottom: 2 }], children: "Idle workers:" }),
                  idleCrew.slice(0, 4).map((w) => /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: T.green + "18", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2, borderWidth: 1, borderColor: T.green + "55" },
                      onPress: () => handleAssignCrewToSite(w.id, site.id),
                      children: [
                        /* @__PURE__ */ jsxs(Text, { style: { fontSize: 10, color: T.text }, children: [
                          w.name.split(" ")[0],
                          " \xB7 ",
                          w.role
                        ] }),
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.green, fontWeight: "700" }, children: "+ Assign" })
                      ]
                    },
                    w.id
                  )),
                  idleCrew.length > 4 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 2, fontStyle: "italic" }], children: [
                    "+",
                    idleCrew.length - 4,
                    " more in Crew tab"
                  ] })
                ] }),
                idleCrew.length === 0 && siteCrew.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, fontStyle: "italic" }], children: "No idle workers available" })
              ] });
            })(),
            (() => {
              const idleEquip = game.equipment.filter((e) => e.status === "Idle" && !e.assignedSiteId);
              const brokenOnSite = siteEquip.filter((e) => e.status === "Maintenance" || e.condition < 30);
              return /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.panel2, borderRadius: 6, padding: 8, marginBottom: 6 }, children: [
                /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, fontWeight: "700" }], children: [
                  "EQUIPMENT (",
                  siteEquip.length,
                  ")"
                ] }) }),
                siteEquip.map((e) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 10, color: e.condition < 30 ? T.red : T.text, flex: 1 }], numberOfLines: 1, children: [
                    e.name,
                    " ",
                    e.condition < 30 ? "\u26A0" : ""
                  ] }),
                  /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 4 }, children: [
                    (e.condition < 80 || e.status === "Maintenance") && /* @__PURE__ */ jsx(
                      TouchableOpacity,
                      {
                        style: { backgroundColor: T.blue + "33", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: T.blue },
                        onPress: () => handleRepairEquipmentNew(e.id, e.status === "Maintenance"),
                        children: /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.blue, fontWeight: "700" }, children: "Repair" })
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      TouchableOpacity,
                      {
                        style: { backgroundColor: T.red + "33", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.red },
                        onPress: () => handleUnassignEquipFromSite(e.id, site.id),
                        children: /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.red, fontWeight: "700" }, children: "Remove" })
                      }
                    )
                  ] })
                ] }, e.id)),
                idleEquip.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 4, marginBottom: 2 }], children: "Available equipment:" }),
                  idleEquip.slice(0, 3).map((e) => /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: T.cyan + "18", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2, borderWidth: 1, borderColor: T.cyan + "55" },
                      onPress: () => handleAssignEquipToSite(e.id, site.id),
                      children: [
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.text }, children: e.name }),
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.cyan, fontWeight: "700" }, children: "+ Assign" })
                      ]
                    },
                    e.id
                  )),
                  idleEquip.length > 3 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 2, fontStyle: "italic" }], children: [
                    "+",
                    idleEquip.length - 3,
                    " more in Vehicles tab"
                  ] })
                ] }),
                siteEquip.length === 0 && idleEquip.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, fontStyle: "italic" }], children: "No equipment available" })
              ] });
            })(),
            allMats.length > 0 && /* @__PURE__ */ jsxs(View, { style: { marginBottom: 6 }, children: [
              hasMissingMats && /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.orange + "22", borderRadius: 6, padding: 6, marginBottom: 6, borderWidth: 1, borderColor: T.orange }, children: [
                /* @__PURE__ */ jsx(Text, { style: { color: T.orange, fontWeight: "700", fontSize: 11, marginBottom: 2 }, children: "\u26A0 Materials Missing \u2014 Work Stalled" }),
                missingMats.map((m) => {
                  const shortfall = totalCostNormal - game.cash;
                  return /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 }, children: [
                    /* @__PURE__ */ jsxs(View, { style: { flex: 1, marginRight: 8 }, children: [
                      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 3 }, children: [
                        /* @__PURE__ */ jsx(Ionicons, { name: m.icon, size: 10, color: T.text }),
                        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 10, color: T.text }], children: [
                          m.label,
                          ": ",
                          m.fulfilled,
                          "/",
                          m.needed,
                          " ",
                          m.unit
                        ] })
                      ] }),
                      /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 2, height: 3 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.round(m.fulfilled / m.needed * 100)}%`, backgroundColor: T.orange, height: 3 }] }) })
                    ] }),
                    /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 10, color: T.orange }], children: [
                      "Need ",
                      money2(m.costNormal)
                    ] })
                  ] }, m.matId);
                }),
                !canAffordNormal && /* @__PURE__ */ jsxs(View, { style: { marginTop: 4, backgroundColor: T.red + "18", borderRadius: 4, padding: 4 }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 10, color: T.red }], children: [
                    "Cash shortfall: ",
                    money2(Math.max(0, totalCostNormal - game.cash))
                  ] }),
                  (game.creditScore || 600) >= 600 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 10, color: T.cyan }], children: [
                    "Supplier credit available (Credit ",
                    game.creditScore,
                    ")"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 6, marginTop: 8 }, children: [
                  /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: { flex: 1, backgroundColor: canAffordNormal ? T.green : T.panel2, borderRadius: 6, borderWidth: 1.5, borderColor: canAffordNormal ? T.green : T.border, paddingVertical: 7, alignItems: "center" },
                      onPress: () => handleBuyMaterialsForSite(site.id),
                      children: [
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, fontWeight: "700", color: canAffordNormal ? "#fff" : T.sub }, children: "Buy Materials" }),
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: canAffordNormal ? "#ffffffcc" : T.sub }, children: money2(totalCostNormal) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: { flex: 1, backgroundColor: canAffordEmergency ? T.orange + "33" : T.panel2, borderRadius: 6, borderWidth: 1.5, borderColor: canAffordEmergency ? T.orange : T.border, paddingVertical: 7, alignItems: "center" },
                      onPress: () => handleEmergencyPurchase(site.id),
                      children: [
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, fontWeight: "700", color: canAffordEmergency ? T.orange : T.sub }, children: "Emergency" }),
                        /* @__PURE__ */ jsxs(Text, { style: { fontSize: 9, color: canAffordEmergency ? T.orange : T.sub }, children: [
                          money2(totalCostEmergency),
                          " (1.5\xD7)"
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: { flex: 1, backgroundColor: T.panel2, borderRadius: 6, borderWidth: 1.5, borderColor: T.blue, paddingVertical: 7, alignItems: "center" },
                      onPress: () => update((g) => {
                        const s = g.activeSites.find((s2) => s2.id === site.id);
                        if (s) {
                          s.status = "Paused";
                          s.pausedDays = 999;
                        }
                      }),
                      children: [
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, fontWeight: "700", color: T.blue }, children: "Pause" }),
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.sub }, children: "No penalty" })
                      ]
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, children: allMats.map((m) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", backgroundColor: m.ok ? T.panel3 : T.orange + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }, children: [
                /* @__PURE__ */ jsx(Ionicons, { name: m.icon, size: 10, color: m.ok ? T.sub : T.orange }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 9, color: m.ok ? T.sub : T.orange, marginLeft: 2 }], children: [
                  m.fulfilled,
                  "/",
                  m.needed
                ] })
              ] }, m.id)) })
            ] }),
            (site.currentWeather || lastChaos) && /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 6, marginBottom: 6 }, children: [
              site.currentWeather && /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", backgroundColor: T.blue + "28", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }, children: [
                /* @__PURE__ */ jsx(Ionicons, { name: site.currentWeather.icon, size: 11, color: T.blue }),
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.blue, fontSize: 9, marginLeft: 3 }], children: site.currentWeather.label })
              ] }),
              lastChaos && /* @__PURE__ */ jsx(View, { style: { flex: 1 }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange, fontSize: 9 }], numberOfLines: 1, children: [
                "\u26A1 ",
                lastChaos.text
              ] }) })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: "Contract value" }),
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontWeight: "700", fontSize: 11 }], children: money2(site.totalValue) }),
                daysLate > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red, fontSize: 10 }], children: [
                  "\u2192 ",
                  money2(projectedProfit)
                ] })
              ] })
            ] }),
            (site.depositPaid || 0) > 0 && !isOverdue && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan, fontSize: 10, marginBottom: 4 }], children: [
              "\u{1F4B0} 25% deposit received: ",
              money2(site.depositPaid)
            ] }),
            isOverdue && daysLate > 0 && /* @__PURE__ */ jsxs(View, { style: { marginBottom: 6 }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: "Value remaining" }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red, fontSize: 10, fontWeight: "700" }], children: [
                  "-",
                  money2(daysLate * site.penaltyPerDay),
                  " penalty",
                  daysLate > 5 ? " (1.5\xD7 escalated)" : ""
                ] })
              ] }),
              /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${Math.max(0, Math.round(projectedProfit / site.totalValue * 100))}%`, backgroundColor: projectedProfit > site.totalValue * 0.5 ? T.orange : T.red, borderRadius: 2 } }) }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 1 }], children: [
                money2(projectedProfit),
                " of ",
                money2(site.totalValue),
                " remaining"
              ] })
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginBottom: 4 }], children: "SITE STRATEGY" }),
            /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 4 }, children: SITE_MODES.map((m) => /* @__PURE__ */ jsxs(
              TouchableOpacity,
              {
                style: {
                  flex: 1,
                  paddingVertical: 5,
                  paddingHorizontal: 2,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: mode === m.key ? m.color : T.border,
                  backgroundColor: mode === m.key ? m.color + "28" : "transparent",
                  alignItems: "center"
                },
                onPress: () => update((g) => {
                  const s = g.activeSites.find((s2) => s2.id === site.id);
                  if (s) s.siteMode = m.key;
                }),
                children: [
                  /* @__PURE__ */ jsx(Ionicons, { name: m.icon, size: 12, color: mode === m.key ? m.color : T.sub }),
                  /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: mode === m.key ? m.color : T.sub, fontWeight: mode === m.key ? "700" : "400" }, children: m.label })
                ]
              },
              m.key
            )) }),
            modeDef.key !== "normal" && /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }, children: [
              /* @__PURE__ */ jsx(Ionicons, { name: modeDef.icon, size: 10, color: modeDef.color }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: modeDef.color, fontSize: 10 }], children: modeDef.desc })
            ] }),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: T.cyan, marginTop: 6 },
                onPress: () => setTab("Crew"),
                children: /* @__PURE__ */ jsx(Text, { style: { color: T.cyan, fontSize: 10, fontWeight: "700" }, children: "\u26A1 Hire Sub Crew \u2192" })
              }
            ),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 8 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: "On-time bonus:" }),
              [0, 500, 1e3, 2500].map((amt) => {
                const sel = (site.completionBonus || 0) === amt;
                return /* @__PURE__ */ jsx(
                  TouchableOpacity,
                  {
                    style: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: sel ? T.yellow : T.border, backgroundColor: sel ? T.yellow + "33" : "transparent" },
                    onPress: () => update((g) => {
                      const s = g.activeSites.find((s2) => s2.id === site.id);
                      if (s) s.completionBonus = amt;
                    }),
                    children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: sel ? T.yellow : T.sub, fontSize: 10, fontWeight: sel ? "700" : "400" }], children: amt === 0 ? "None" : money2(amt) })
                  },
                  amt
                );
              })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }, children: [
              /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { borderWidth: 1, borderColor: site.status === "Paused" ? T.green : T.cyan, backgroundColor: "transparent" }],
                  onPress: () => site.status === "Paused" ? handleResumeSite(site.id) : handlePauseSite(site.id),
                  children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: site.status === "Paused" ? T.green : T.cyan }], children: site.status === "Paused" ? "\u25B6 Resume" : "\u23F8 Pause" })
                }
              ),
              game.day > site.deadlineDay && !site.renegotiated && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { borderWidth: 1, borderColor: _canRenegotiate ? T.yellow : T.border, backgroundColor: "transparent", opacity: _canRenegotiate ? 1 : 0.45 }],
                  onPress: () => handleRenegotiate(site.id),
                  children: /* @__PURE__ */ jsxs(Text, { style: [styles.smallBtnText, { color: _canRenegotiate ? T.yellow : T.sub }], children: [
                    "Renegotiate ",
                    money2(_renegCost)
                  ] })
                }
              ),
              (game.day > site.deadlineDay || site.status === "Paused") && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { borderWidth: 1, borderColor: T.purple, backgroundColor: "transparent" }],
                  onPress: () => handleSettleSite(site.id),
                  children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.purple }], children: "Settle" })
                }
              ),
              /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { borderWidth: 1, borderColor: T.red, backgroundColor: "transparent" }],
                  onPress: () => {
                    const _siteDef = CONTRACT_DEFS.find((c) => c.id === game.contracts.find((cc) => cc.id === site.contractId)?.defId);
                    const _fee = Math.round((_siteDef?.baseValue || 1e4) * 0.15);
                    Alert.alert("Abandon Site?", `Fee: ${money2(_fee)}, reputation penalty. Cannot undo.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Abandon", style: "destructive", onPress: () => handleAbandonSite(site.id) }
                    ]);
                  },
                  children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.red }], children: "Abandon" })
                }
              )
            ] })
          ] }, site.id);
        })
      ] }),
      (game.jobHistory || []).length > 0 && /* @__PURE__ */ jsxs(View, { style: { marginTop: 16 }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginBottom: 8 }], children: "Recently Completed" }),
        [...game.jobHistory || []].reverse().slice(0, 5).map((job, i) => /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel, borderLeftWidth: 3, borderLeftColor: T.green, marginBottom: 6, padding: 10 }], children: /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1, marginRight: 8 }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.label, col, { fontSize: 13 }], children: [
              "\u2713 ",
              job.label
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              job.client,
              " \xB7 Day ",
              job.day
            ] })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontWeight: "700", fontSize: 13 }], children: money2(job.value) }),
            job.quality && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
              job.quality,
              " quality"
            ] })
          ] })
        ] }) }, i))
      ] }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: [
        "Office: ",
        office.name
      ] }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        OFFICE_IMAGES[office.id] && /* @__PURE__ */ jsx(Image, { source: OFFICE_IMAGES[office.id], style: { width: "100%", height: 130, borderRadius: 8, marginBottom: 8, backgroundColor: "#fff" }, resizeMode: "contain" }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          "Crew cap: ",
          office.crewCap,
          " \xB7 Equip cap: ",
          office.equipCap,
          " \xB7 Daily rent: ",
          money2(office.dailyRent)
        ] }),
        office.perks.map((p) => /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.cyan }], children: p.label }, p.key)),
        OFFICES[game.officeIndex + 1] && (() => {
          const nextOffice = OFFICES[game.officeIndex + 1];
          const canAfford = game.cash >= nextOffice.cost;
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            OFFICE_IMAGES[nextOffice.id] && /* @__PURE__ */ jsx(Image, { source: OFFICE_IMAGES[nextOffice.id], style: { width: "100%", height: 100, borderRadius: 8, marginTop: 10, backgroundColor: "#fff", opacity: 0.85 }, resizeMode: "contain" }),
            !canAfford && nextOffice.cost > 0 && (() => {
              const pct = Math.min(99, Math.round(game.cash / nextOffice.cost * 100));
              const barColor = pct >= 75 ? T.yellow : pct >= 50 ? T.orange : T.sub;
              return /* @__PURE__ */ jsxs(View, { style: { marginTop: 10, marginBottom: 4 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Upgrade savings" }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: barColor }], children: [
                    money2(game.cash),
                    " / ",
                    money2(nextOffice.cost)
                  ] })
                ] }),
                /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 } }) })
              ] });
            })(),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.btn, { marginTop: canAfford ? 10 : 4, backgroundColor: canAfford ? T.blue : T.panel2, borderColor: T.blue }],
                onPress: handleUpgradeOffice,
                children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: canAfford ? "#fff" : T.red }], children: [
                  "Upgrade to ",
                  nextOffice.name,
                  " \u2014 ",
                  money2(nextOffice.cost)
                ] })
              }
            )
          ] });
        })()
      ] })
    ] });
  }
  function renderCrew() {
    return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { paddingBottom: 0 }, children: [
      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 0 }, children: [
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { flex: 1, backgroundColor: game.autoAssignCrew ? T.green : T.panel2, borderColor: T.green, paddingVertical: 8 }],
            onPress: () => update((g) => {
              g.autoAssignCrew = !g.autoAssignCrew;
            }),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.autoAssignCrew ? "#fff" : T.sub, fontSize: 12 }], children: game.autoAssignCrew ? "\u2713 Auto Assign ON" : "Auto Assign OFF" })
          }
        ),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { flex: 1, backgroundColor: T.panel2, borderColor: T.cyan, paddingVertical: 8 }],
            onPress: () => handleRestAllTired(),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.cyan, fontSize: 12 }], children: "\u{1F634} Rest All Tired" })
          }
        )
      ] }),
      /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { paddingHorizontal: 12, marginTop: 8, marginBottom: 4 }, contentContainerStyle: { gap: 8, flexDirection: "row" }, children: ["All", "Active", "Idle", "Resting", "Training", "Low Stamina"].map((f) => /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          onPress: () => setCrewFilter(f),
          style: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: crewFilter === f ? T.cyan : T.panel2, borderWidth: 1, borderColor: crewFilter === f ? T.cyan : T.border },
          children: /* @__PURE__ */ jsx(Text, { style: { color: crewFilter === f ? "#fff" : T.sub, fontSize: 12, fontWeight: "600" }, children: f })
        },
        f
      )) }),
      (() => {
        const _filteredCrew = crewFilter === "All" ? game.crew || [] : (game.crew || []).filter(
          (w) => crewFilter === "Active" ? w.status === "Active" : crewFilter === "Idle" ? w.status === "Idle" : crewFilter === "Resting" ? w.status === "Resting" : crewFilter === "Training" ? !!(game.trainingQueue || []).find((t) => t.workerId === w.id) : crewFilter === "Low Stamina" ? (w.stamina ?? 50) < 30 : true
        );
        if (crewFilter !== "All" && _filteredCrew.length === 0 && (game.crew || []).length > 0) return /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 20, margin: 12 }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center" }], children: [
          "No ",
          crewFilter.toLowerCase(),
          " crew members right now."
        ] }) });
        return null;
      })(),
      /* @__PURE__ */ jsx(
        CrewScreen,
        {
          game: crewFilter === "All" ? game : { ...game, crew: (game.crew || []).filter(
            (w) => crewFilter === "Active" ? w.status === "Active" : crewFilter === "Idle" ? w.status === "Idle" : crewFilter === "Resting" ? w.status === "Resting" : crewFilter === "Training" ? !!(game.trainingQueue || []).find((t) => t.workerId === w.id) : crewFilter === "Low Stamina" ? (w.stamina ?? 50) < 30 : true
          ) },
          T,
          col,
          subCol,
          onHire: handleHireCrew,
          onFire: handleFireCrew,
          onPostJob: handlePostJob,
          onHireSubcontractor: handleHireSubcontractor,
          onHirePM: handleHirePM,
          onFirePM: handleFirePM,
          onTrain: handleTrainCrew,
          onPromote: handlePromoteCrew,
          onRaiseWage: handleRaiseWage,
          onLowerWage: handleLowerWage,
          onGiveBonus: handleGiveBonus,
          onRest: handleRestWorker,
          onRestAllTired: handleRestAllTired,
          onBuyLunch: handleBuyLunch,
          onAssignToSite: handleAssignCrewToSite,
          activeSites: game.activeSites
        }
      )
    ] });
  }
  function renderEquipment() {
    const conditionColor = (c) => c >= 70 ? T.green : c >= 40 ? T.orange : T.red;
    const office2 = OFFICES[game.officeIndex || 0];
    const totalEquipCap = office2.equipCap + getEquipCapBonus(game);
    return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 12, paddingBottom: 120 }, children: [
      /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col], children: [
        "Vehicles Fleet (",
        (game.equipment || []).length,
        "/",
        totalEquipCap,
        ")"
      ] }) }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "\u26A1 Auto Dispatch" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginBottom: 8 }], children: "Hire a Senior PM or Director to auto-manage your operation." }),
        [
          { key: "autoAssignCrew", label: "Auto-Assign Crew", icon: "\u{1F477}", color: T.green },
          { key: "autoAssignEquipment", label: "Auto-Assign Vehicles", icon: "\u{1F69B}", color: T.cyan },
          { key: "autoRepairEquipment", label: "Auto-Repair Fleet", icon: "\u{1F527}", color: T.orange },
          { key: "autoPurchaseMaterials", label: "Auto-Buy Materials", icon: "\u{1F4E6}", color: T.yellow }
        ].map((item, idx, arr) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: idx < arr.length - 1 ? 1 : 0, borderColor: T.border }, children: [
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, col], children: [
            item.icon,
            "  ",
            item.label
          ] }),
          /* @__PURE__ */ jsx(
            Switch,
            {
              value: !!game[item.key],
              onValueChange: (v) => update((g) => {
                g[item.key] = v;
              }),
              trackColor: { false: T.track, true: item.color },
              thumbColor: "#fff"
            }
          )
        ] }, item.key))
      ] }),
      /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 8 }, contentContainerStyle: { gap: 8, flexDirection: "row" }, children: ["All", "Active", "Idle", "Maintenance", "Broken", "Low Condition"].map((f) => /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          onPress: () => setEquipFilter(f),
          style: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: equipFilter === f ? T.orange : T.panel2, borderWidth: 1, borderColor: equipFilter === f ? T.orange : T.border },
          children: /* @__PURE__ */ jsx(Text, { style: { color: equipFilter === f ? "#fff" : T.sub, fontSize: 11, fontWeight: "600" }, children: f })
        },
        f
      )) }),
      (game.equipment || []).length > 0 && (() => {
        const equips = game.equipment || [];
        const avgCond = Math.round(equips.reduce((s, e) => s + (e.condition || 0), 0) / equips.length);
        const active = equips.filter((e) => e.status === "Active").length;
        const idle = equips.filter((e) => e.status === "Idle").length;
        const needsWork = equips.filter((e) => e.status === "Maintenance" || e.status === "Broken").length;
        const barColor = avgCond >= 70 ? T.green : avgCond >= 40 ? T.orange : T.red;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border, marginBottom: 8 }], children: [
          /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 8, marginBottom: 8 }, children: [
            { label: "Active", val: active, color: T.orange },
            { label: "Idle", val: idle, color: T.green },
            { label: "Needs Work", val: needsWork, color: needsWork > 0 ? T.red : T.sub }
          ].map((s) => /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 6, padding: 8, alignItems: "center" }, children: [
            /* @__PURE__ */ jsx(Text, { style: { color: s.color, fontSize: 18, fontWeight: "900" }, children: s.val }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: s.label })
          ] }, s.label)) }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Fleet health" }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: barColor, fontWeight: "600" }], children: [
              avgCond,
              "% avg condition"
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${avgCond}%`, backgroundColor: barColor }] }) })
        ] });
      })(),
      (game.equipment || []).length === 0 ? /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 24 }], children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 32, marginBottom: 8 }, children: "\u{1F69C}" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { textAlign: "center" }], children: "No Vehicles Yet" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { textAlign: "center", marginTop: 4 }], children: "Buy a vehicle below to boost site efficiency and unlock contracts." })
      ] }) : (() => {
        const _filteredEquip = equipFilter === "All" ? game.equipment || [] : (game.equipment || []).filter(
          (e) => equipFilter === "Active" ? e.status === "Active" : equipFilter === "Idle" ? e.status === "Idle" : equipFilter === "Maintenance" ? e.status === "Maintenance" : equipFilter === "Broken" ? e.status === "Broken" : equipFilter === "Low Condition" ? (e.condition ?? 100) < 40 : true
        );
        if (_filteredEquip.length === 0 && equipFilter !== "All") return /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 20 }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center" }], children: [
          "No ",
          equipFilter.toLowerCase(),
          " equipment right now."
        ] }) });
        return _filteredEquip.map((equip) => {
          const cond = Math.round(equip.condition ?? 100);
          const cc = conditionColor(cond);
          const repairCost = Math.round((equip.price || 5e3) * 0.2);
          const emergRepairCost = Math.round((equip.price || 5e3) * 0.4);
          const assignedSite = equip.assignedSiteId ? game.activeSites?.find((s) => s.id === equip.assignedSiteId) : null;
          const equipImg = EQUIPMENT_IMAGES[equip.shopId];
          return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: cc, borderWidth: 1.5 }], children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              equipImg && /* @__PURE__ */ jsx(Image, { source: equipImg, style: { width: 64, height: 48, borderRadius: 8, marginRight: 10, backgroundColor: "#fff" }, resizeMode: "contain" }),
              /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                /* @__PURE__ */ jsxs(Text, { style: [styles.label, col], children: [
                  equipImg ? "" : "\u{1F527} ",
                  equip.name
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                  "Tier ",
                  equip.tier || 1,
                  " \xB7 ",
                  money2(equip.dailyCost || 0),
                  "/day \xB7 ",
                  equip.type
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: cc }], children: [
                  "Condition: ",
                  cond,
                  "%"
                ] }),
                equip.status === "Maintenance" && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.red }], children: "\u26A0\uFE0F In maintenance \u2014 needs repair" }),
                assignedSite && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
                  "Assigned to: ",
                  assignedSite.label
                ] }),
                !assignedSite && equip.status === "Idle" && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green }], children: "Available" })
              ] }),
              /* @__PURE__ */ jsx(View, { style: { alignItems: "flex-end" }, children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: equip.status === "Active" ? T.orange : equip.status === "Maintenance" ? T.red : T.green }], children: equip.status }) })
            ] }),
            /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 6 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${cond}%`, backgroundColor: cc }] }) }),
            /* @__PURE__ */ jsxs(View, { style: { marginTop: 10, marginBottom: 2 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, fontWeight: "700", marginBottom: 5 }], children: "UPGRADES" }),
              EQUIPMENT_UPGRADES.map((upg) => {
                const currentTier = (equip.upgrades || {})[upg.id] || 0;
                const nextTier = upg.tiers[currentTier];
                const isMax = currentTier >= upg.tiers.length;
                const canAfford = nextTier && game.cash >= nextTier.cost;
                return /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", marginBottom: 5 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: { fontSize: 13, marginRight: 6 }, children: upg.icon }),
                  /* @__PURE__ */ jsx(View, { style: { flex: 1 }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: isMax ? T.green : currentTier > 0 ? T.cyan : T.sub, fontSize: 10 }], children: [
                    upg.label,
                    currentTier > 0 ? ` T${currentTier} \u2014 ${upg.tiers[currentTier - 1].effect}` : " \u2014 not installed"
                  ] }) }),
                  !isMax ? /* @__PURE__ */ jsx(
                    TouchableOpacity,
                    {
                      style: [styles.smallBtn, { backgroundColor: canAfford ? T.blue : T.panel2, borderColor: T.blue, paddingHorizontal: 8 }],
                      onPress: () => handleBuyEquipmentUpgrade(equip.id, upg.id),
                      children: /* @__PURE__ */ jsxs(Text, { style: [styles.smallBtnText, { color: canAfford ? "#fff" : T.sub }], children: [
                        currentTier === 0 ? "Install" : "Upgrade",
                        " ",
                        money2(nextTier.cost)
                      ] })
                    }
                  ) : /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontSize: 10 }], children: "\u2713 Max" })
                ] }, upg.id);
              })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }, children: [
              cond < 80 && equip.status !== "Maintenance" && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { backgroundColor: T.blue, flex: 1, minWidth: 80 }],
                  onPress: () => handleRepairEquipmentNew(equip.id, false),
                  children: /* @__PURE__ */ jsxs(Text, { style: styles.smallBtnText, children: [
                    "Repair (",
                    money2(repairCost),
                    ")"
                  ] })
                }
              ),
              equip.status === "Maintenance" && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { backgroundColor: T.orange, flex: 1, minWidth: 80 }],
                  onPress: () => handleRepairEquipmentNew(equip.id, true),
                  children: /* @__PURE__ */ jsxs(Text, { style: styles.smallBtnText, children: [
                    "Emergency Repair (",
                    money2(emergRepairCost),
                    ")"
                  ] })
                }
              ),
              equip.status !== "Maintenance" && !equip.assignedSiteId && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { backgroundColor: T.yellow + "33", flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.yellow }],
                  onPress: () => handleScheduleMaintenance(equip.id),
                  children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.yellow }], children: "Maintenance" })
                }
              ),
              !equip.assignedSiteId && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { backgroundColor: T.red + "22", flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.red }],
                  onPress: () => handleSellEquipment(equip.id),
                  children: /* @__PURE__ */ jsxs(Text, { style: [styles.smallBtnText, { color: T.red }], children: [
                    "Sell (",
                    money2(Math.round(cond / 100 * (equip.price || 5e3) * 0.5)),
                    ")"
                  ] })
                }
              ),
              !equip.assignedSiteId && /* @__PURE__ */ jsx(
                TouchableOpacity,
                {
                  style: [styles.smallBtn, { backgroundColor: T.panel2, flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.sub }],
                  onPress: () => Alert.alert("Retire Equipment", `Remove ${equip.name} from fleet permanently? No cash recovered.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Retire", style: "destructive", onPress: () => handleRetireEquipment(equip.id) }
                  ]),
                  children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.sub }], children: "Retire" })
                }
              )
            ] })
          ] }, equip.id);
        });
      })(),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 4 }], children: "Buy Vehicles" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 10 }], children: "New vehicles have full reliability. Used vehicles cost ~40% less but have higher breakdown risk." }),
      EQUIPMENT_SHOP.map((item) => {
        const atCap = (game.equipment || []).length >= totalEquipCap;
        const discount = game._equipDiscount || 0;
        const newPrice = Math.round(item.price * (1 - discount));
        const usedPrice = Math.round(newPrice * 0.58);
        const shopImg = EQUIPMENT_IMAGES[item.shopId];
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
          shopImg && /* @__PURE__ */ jsx(Image, { source: shopImg, style: { width: "100%", height: 110, borderRadius: 8, marginBottom: 8, backgroundColor: "#fff" }, resizeMode: "contain" }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.label, col], children: [
                shopImg ? "" : "\u{1F69C} ",
                item.name,
                " ",
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.blue }], children: [
                  "Tier ",
                  item.tier
                ] })
              ] }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: item.role }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                "Daily cost: ",
                money2(item.dailyCost),
                " \xB7 Type: ",
                item.type
              ] })
            ] }),
            discount > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.yellow }], children: [
              "-",
              Math.round(discount * 100),
              "%"
            ] })
          ] }),
          atCap ? /* @__PURE__ */ jsx(View, { style: [styles.btn, { marginTop: 8, backgroundColor: T.panel2, borderColor: T.border }], children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.sub }], children: "Vehicles Cap \u2014 Upgrade office" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            game.cash < newPrice && (() => {
              const pct = Math.min(99, Math.round(game.cash / newPrice * 100));
              const barColor = pct >= 75 ? T.yellow : pct >= 50 ? T.orange : T.sub;
              return /* @__PURE__ */ jsxs(View, { style: { marginTop: 8, marginBottom: 2 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Savings" }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: barColor }], children: [
                    money2(game.cash),
                    " / ",
                    money2(newPrice)
                  ] })
                ] }),
                /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 } }) })
              ] });
            })(),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginTop: 8 }, children: [
              /* @__PURE__ */ jsxs(
                TouchableOpacity,
                {
                  style: [styles.btn, { flex: 1, backgroundColor: game.cash >= newPrice ? T.blue : T.panel2, borderColor: T.blue }],
                  onPress: () => handleBuyEquipment(item, false),
                  children: [
                    /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.cash >= newPrice ? "#fff" : T.red, fontSize: 12 }], children: "\u{1F195} New" }),
                    /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: game.cash >= newPrice ? T.sub : T.red, textAlign: "center" }], children: money2(newPrice) }),
                    /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", fontSize: 10 }], children: "100% condition \xB7 reliable" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                TouchableOpacity,
                {
                  style: [styles.btn, { flex: 1, backgroundColor: game.cash >= usedPrice ? T.orange + "44" : T.panel2, borderColor: T.orange }],
                  onPress: () => handleBuyEquipment(item, true),
                  children: [
                    /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.cash >= usedPrice ? T.orange : T.red, fontSize: 12 }], children: "\u{1F504} Used" }),
                    /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: game.cash >= usedPrice ? T.orange : T.red, textAlign: "center" }], children: money2(usedPrice) }),
                    /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", fontSize: 10 }], children: "~55% cond \xB7 higher risk" })
                  ]
                }
              )
            ] })
          ] })
        ] }, item.shopId);
      })
    ] });
  }
  function renderEmpire() {
    const valuation = computeValuation(game);
    const rank = game.nationalRank || 99;
    const completedGoalIds = game.empireGoalsCompleted || [];
    const selectedCity = CITIES.find((c) => c.id === game.selectedEmpireCity) || CITIES[1];
    const hasOfficeInSelected = (game.cityOffices || []).some((o) => o.cityId === selectedCity.id);
    return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 14, paddingBottom: 120 }, children: [
      game.hallOfFame?.prestigeReached && /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.yellow + "22", borderColor: T.yellow, borderWidth: 2, borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" }, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 28, marginBottom: 4 }, children: "\u{1F451}" }),
        /* @__PURE__ */ jsxs(Text, { style: { color: T.yellow, fontWeight: "900", fontSize: 16, marginBottom: 2 }, children: [
          "DYNASTY COMPLETE \u2014 GEN ",
          game.generation || 1
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.text, textAlign: "center", marginBottom: 8 }], children: [
          "Built the #1 construction empire in America. Achieved on Day ",
          game.hallOfFame.prestigeReached,
          "."
        ] }),
        (game.legacyPerks || []).length > 0 && /* @__PURE__ */ jsxs(View, { style: { width: "100%", marginTop: 4 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.yellow, fontWeight: "700", marginBottom: 4 }], children: "Carried Legacy Perks:" }),
          (game.legacyPerks || []).map((p, i) => {
            const def = LEGACY_PERKS.find((lp) => lp.id === p);
            return /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.text }], children: [
              "\u2022 ",
              def?.label || p
            ] }, i);
          })
        ] })
      ] }),
      game._pendingPrestige && !game.hallOfFame?.prestigeReached && /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.green + "22", borderColor: T.green, borderWidth: 2, borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" }, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 24, marginBottom: 4 }, children: "\u{1F3C6}" }),
        /* @__PURE__ */ jsx(Text, { style: { color: T.green, fontWeight: "900", fontSize: 15, marginBottom: 4 }, children: "Dynasty Ready to Claim!" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.text, textAlign: "center" }], children: "You've hit Level 10, Rank #1, and cleared your debt. Tap the crown to begin your legacy." })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.strongBorder, borderWidth: 2 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Company Valuation" }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginBottom: 6 }], children: [
          "Home market: ",
          displayCityName,
          ", ",
          displayStateCode,
          " \xB7 ",
          displayCompetition,
          " competition"
        ] }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 }, children: [
          /* @__PURE__ */ jsxs(View, { children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.cashBig, { color: T.cyan }], children: money2(valuation) }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Net Worth" })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.cashBig, { color: rank <= 10 ? T.green : T.sub }], children: [
              "#",
              rank
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "National Rank" })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.cashBig, { color: T.blue }], children: [
              game.marketShare || 1,
              "%"
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Market Share" })
          ] })
        ] }),
        [
          { label: "Cash", val: money2(game.cash), color: game.cash >= 0 ? T.green : T.red },
          { label: "Equipment Fleet", val: money2(Math.round((game.equipment || []).reduce((s, e) => s + e.price * (e.condition / 100) * 0.6, 0))), color: T.orange },
          { label: "Properties", val: money2(Math.round((game.properties || []).reduce((s, p) => {
            const d = PROPERTY_TYPES.find((t) => t.id === p.typeId);
            return s + (d ? d.cost * (d.resaleRate || 0.8) : 0);
          }, 0))), color: T.purple },
          { label: "Office Network", val: money2(Math.round((game.cityOffices || []).reduce((s, o) => {
            const d = REGIONAL_OFFICE_TYPES.find((t) => t.id === o.typeId);
            return s + (d ? d.cost * 0.7 : 0);
          }, 0))), color: T.blue },
          { label: "Active Pipeline", val: money2(Math.round((game.activeSites || []).reduce((s, site) => s + site.totalValue * 0.4, 0))), color: T.cyan }
        ].map((row) => /* @__PURE__ */ jsxs(View, { style: [styles.finRow, { borderBottomColor: T.border }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: row.label }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.color }], children: row.val })
        ] }, row.label))
      ] }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border, marginTop: 8 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Market Position" }),
        [
          { label: "Market Share", val: `${game.marketShare || 1}%`, color: T.blue },
          { label: "National Rank", val: `#${rank}`, color: rank <= 3 ? T.yellow : rank <= 10 ? T.green : T.sub },
          { label: "Cities with Offices", val: `${(game.cityOffices || []).length + 1}`, color: T.orange },
          { label: "Acquired Rivals", val: `${(game.acquiredRivals || []).length}`, color: T.purple },
          { label: "Your Valuation", val: money2(valuation), color: T.cyan }
        ].map((row) => /* @__PURE__ */ jsxs(View, { style: [styles.finRow, { borderBottomColor: T.border }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: row.label }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.color }], children: row.val })
        ] }, row.label)),
        (game.rivals || []).filter((r) => !(game.acquiredRivals || []).includes(r.id) && r.status !== "Bankrupt").slice(0, 3).map((rival) => {
          const rivalVal = (rival.cash || 0) + (rival.rep || 0) * 5e4 + (rival.cityPresence || ["salem"]).length * 1e5 + (rival.jobsCompleted || 0) * 15e3;
          const ahead = valuation > rivalVal;
          const total = valuation + rivalVal;
          const playerShare = total > 0 ? Math.round(valuation / total * 100) : 50;
          const gap = Math.abs(valuation - rivalVal);
          return /* @__PURE__ */ jsxs(View, { style: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: rival.name }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: ahead ? T.green : T.red }], children: [
                money2(rivalVal),
                " ",
                ahead ? "\u25BC" : "\u25B2"
              ] })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", marginTop: 4 }, children: [
              /* @__PURE__ */ jsx(View, { style: { flex: playerShare, height: 4, backgroundColor: T.green } }),
              /* @__PURE__ */ jsx(View, { style: { flex: 100 - playerShare, height: 4, backgroundColor: ahead ? T.panel2 : T.red } })
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 9, marginTop: 2 }], children: ahead ? `You're ahead by ${money2(gap)}` : `Behind by ${money2(gap)}` })
          ] }, rival.id);
        })
      ] }),
      (() => {
        const activeRivals = (game.rivals || []).filter((r) => !(game.acquiredRivals || []).includes(r.id) && r.status !== "Bankrupt");
        const totalMarket = activeRivals.reduce((s, r) => {
          return s + (r.cash || 0) + (r.rep || 0) * 5e4 + (r.cityPresence || ["salem"]).length * 1e5 + (r.jobsCompleted || 0) * 15e3;
        }, valuation);
        const marketSharePct = totalMarket > 0 ? valuation / totalMarket * 100 : 100;
        const weeklyRev = game.weeklyStats?.revenue || 0;
        const revenueRank = 1 + activeRivals.filter((r) => {
          const est = ((r.cash || 0) + (r.rep || 0) * 5e4 + (r.cityPresence || ["salem"]).length * 1e5) * 0.1;
          return est > weeklyRev;
        }).length;
        const repRank = 1 + activeRivals.filter((r) => (r.rep || 0) > (game.reputation || 0)).length;
        const valRank = 1 + activeRivals.filter((r) => {
          const rv = (r.cash || 0) + (r.rep || 0) * 5e4 + (r.cityPresence || ["salem"]).length * 1e5 + (r.jobsCompleted || 0) * 15e3;
          return rv > valuation;
        }).length;
        const totalRivals = activeRivals.length;
        const aheadCount = totalRivals - (valRank - 1);
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.strongBorder, borderWidth: 1.5, marginTop: 8 }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, { color: T.yellow, marginBottom: 8 }], children: "Rankings" }),
          [
            { label: "Revenue Rank", val: `#${revenueRank} / ${totalRivals + 1}`, color: revenueRank <= 3 ? T.yellow : revenueRank <= Math.ceil((totalRivals + 1) / 2) ? T.green : T.sub },
            { label: "Reputation Rank", val: `#${repRank} / ${totalRivals + 1}`, color: repRank <= 3 ? T.yellow : repRank <= Math.ceil((totalRivals + 1) / 2) ? T.green : T.sub },
            { label: "Market Share", val: `${marketSharePct.toFixed(1)}%`, color: marketSharePct >= 50 ? T.green : marketSharePct >= 25 ? T.cyan : T.sub },
            { label: "Company Value", val: `#${valRank} / ${totalRivals + 1}`, color: valRank <= 3 ? T.yellow : valRank <= Math.ceil((totalRivals + 1) / 2) ? T.green : T.sub }
          ].map((row) => /* @__PURE__ */ jsxs(View, { style: [styles.finRow, { borderBottomColor: T.border }], children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: row.label }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.color, fontWeight: "700" }], children: row.val })
          ] }, row.label)),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.cyan, marginTop: 6, fontStyle: "italic" }], children: aheadCount > 0 ? `You're ahead of ${aheadCount} rival${aheadCount !== 1 ? "s" : ""}` : "Rivals are outpacing you \u2014 push harder!" })
        ] });
      })(),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 8, marginBottom: 8 }], children: "Empire Goals" }),
      EMPIRE_GOALS.map((goal) => {
        const done = completedGoalIds.includes(goal.id);
        let progressPct = done ? 100 : 0;
        let progressLabel = null;
        if (!done) {
          if (goal.id === "local_foothold") {
            const v = game.completedJobs || 0;
            progressPct = Math.min(100, v / 10 * 100);
            progressLabel = `${v}/10 jobs`;
          } else if (goal.id === "second_city" || goal.id === "multi_city") {
            const v = (game.cityOffices || []).length;
            const t = goal.id === "second_city" ? 1 : 3;
            progressPct = Math.min(100, v / t * 100);
            progressLabel = `${v}/${t} offices`;
          } else if (goal.id === "national_player") {
            const v = (game.cityOffices || []).length;
            progressPct = Math.min(100, v / 7 * 100);
            progressLabel = `${v}/7 cities`;
          } else if (goal.id === "land_baron") {
            const v = (game.properties || []).length;
            progressPct = Math.min(100, v / 5 * 100);
            progressLabel = `${v}/5 properties`;
          } else if (goal.id === "acquisition_king") {
            const v = (game.acquiredRivals || []).length;
            progressPct = Math.min(100, v / 2 * 100);
            progressLabel = `${v}/2 rivals`;
          } else if (goal.id === "valuation_5m") {
            const v = valuation;
            progressPct = Math.min(100, v / 5e6 * 100);
            progressLabel = `${money2(v)} / $5M`;
          } else if (goal.id === "construction_empire") {
            const v = valuation;
            progressPct = Math.min(100, v / 1e7 * 100);
            progressLabel = `${money2(v)} / $10M`;
          } else if (goal.id === "number_one") {
            const v = valuation;
            progressPct = Math.min(100, v / 2e7 * 100);
            progressLabel = `${money2(v)} / $20M`;
          } else if (goal.id === "salem_dominant") {
            const v = (game.cityJobsWon || {}).salem || 0;
            progressPct = Math.min(100, v / 15 * 100);
            progressLabel = `${v}/15 jobs`;
          }
        }
        return /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: done ? T.panel3 : T.panel, borderColor: done ? T.green : T.border, borderWidth: done ? 1.5 : 1 }], children: /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: done ? T.green : T.text }], children: [
              done ? "\u2705" : "\u25CB",
              " ",
              goal.title
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: goal.desc }),
            !done && progressLabel && /* @__PURE__ */ jsxs(View, { style: { marginTop: 5 }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.cyan, fontSize: 10 }], children: progressLabel }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
                  Math.round(progressPct),
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2, marginTop: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${progressPct}%`, backgroundColor: T.cyan, borderRadius: 2 } }) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
            "+",
            money2(goal.cashReward || 0)
          ] })
        ] }) }, goal.id);
      }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "City Expansion" }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol, { marginBottom: 10 }], children: [
        "You operate in ",
        (game.cityOffices || []).length + 1,
        " cit",
        (game.cityOffices || []).length === 0 ? "y" : "ies",
        ". Open offices to unlock higher-value contracts."
      ] }),
      /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 12 }, children: CITIES.filter((c) => c.id !== "salem").map((city) => {
        const hasOffice = (game.cityOffices || []).some((o) => o.cityId === city.id);
        const isSelected = game.selectedEmpireCity === city.id;
        return /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.chip, { marginRight: 8, paddingVertical: 6, paddingHorizontal: 12, borderColor: isSelected ? T.orange : hasOffice ? T.green : T.border, backgroundColor: isSelected ? T.orange : hasOffice ? T.panel3 : T.panel2 }],
            onPress: () => update((g) => {
              g.selectedEmpireCity = city.id;
            }),
            children: /* @__PURE__ */ jsxs(Text, { style: { color: isSelected ? "#fff" : hasOffice ? T.green : T.sub, fontSize: 12, fontWeight: "600" }, children: [
              hasOffice ? "\u2705 " : "",
              city.name,
              ", ",
              city.state
            ] })
          },
          city.id
        );
      }) }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(Text, { style: [styles.label, col], children: [
          selectedCity.name,
          ", ",
          selectedCity.state
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          selectedCity.popLabel,
          " \xB7 ",
          selectedCity.region
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          "Contract value: \xD7",
          selectedCity.contractMult,
          " \xB7 Competition: ",
          selectedCity.competition
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: game.reputation >= selectedCity.unlockRep ? T.green : T.orange }], children: [
          "Rep required: ",
          selectedCity.unlockRep,
          " ",
          game.reputation >= selectedCity.unlockRep ? "\u2705" : `(have ${game.reputation})`
        ] }),
        hasOfficeInSelected ? /* @__PURE__ */ jsxs(View, { style: { marginTop: 8 }, children: [
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.green }], children: [
            "\u2705 You have a presence in ",
            selectedCity.name
          ] }),
          (game.cityOffices || []).filter((o) => o.cityId === selectedCity.id).map((o) => {
            const def = REGIONAL_OFFICE_TYPES.find((t) => t.id === o.typeId);
            return /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              "\xB7 ",
              def?.name || o.typeId,
              " (opened Day ",
              o.openedDay,
              ")"
            ] }, o.id);
          })
        ] }) : null,
        /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginTop: 12, marginBottom: 4 }], children: "Open an Office" }),
        REGIONAL_OFFICE_TYPES.map((def) => {
          const totalCost = def.cost + (hasOfficeInSelected ? 0 : selectedCity.unlockCost);
          const canAfford = game.cash >= totalCost;
          const repOk = game.reputation >= selectedCity.unlockRep;
          return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.border, marginBottom: 8 }], children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: def.name }),
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: def.desc }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
                  "+",
                  def.crewBonus,
                  " crew \xB7 +",
                  def.contractSlots,
                  " contract slots"
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
                  "Daily rent: ",
                  money2(def.dailyRent)
                ] })
              ] }),
              /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: canAfford ? T.green : T.red }], children: money2(totalCost) })
            ] }),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.btn, { marginTop: 8, backgroundColor: !repOk || !canAfford ? T.panel3 : T.blue, borderColor: !repOk ? T.orange : T.blue }],
                onPress: () => handleOpenOffice(selectedCity.id, def.id),
                disabled: !repOk,
                children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: !repOk || !canAfford ? T.sub : "#fff" }], children: !repOk ? `Needs Rep ${selectedCity.unlockRep}` : `Open ${def.name}` })
              }
            )
          ] }, def.id);
        })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Land & Properties" }),
      PROPERTY_TYPES.map((def) => {
        const owned = (game.properties || []).filter((p) => p.typeId === def.id);
        const canAfford = game.cash >= def.cost;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: def.name }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: def.desc }),
              def.dailyCost > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
                "Daily cost: ",
                money2(def.dailyCost)
              ] }),
              def.weeklyIncome > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.green }], children: [
                "\u{1F4B5} Weekly income: +",
                money2(def.weeklyIncome)
              ] }),
              owned.length > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
                "\u2705 Owned \xD7",
                owned.length,
                " \xB7 earning ",
                money2(def.weeklyIncome * owned.length),
                "/wk"
              ] })
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: canAfford ? T.green : T.red }], children: money2(def.cost) })
          ] }),
          /* @__PURE__ */ jsx(
            TouchableOpacity,
            {
              style: [styles.btn, { marginTop: 8, backgroundColor: canAfford ? T.purple : T.panel2, borderColor: T.purple }],
              onPress: () => handleBuyProperty(def.id),
              children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: canAfford ? "#fff" : T.sub }], children: "Purchase" })
            }
          ),
          owned.map((p) => /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { marginTop: 4, borderColor: T.red }], onPress: () => handleSellProperty(p.id), children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: T.red }], children: [
            "Sell (",
            money2(Math.round(def.cost * (def.resaleRate || 0.8))),
            ")"
          ] }) }, p.id))
        ] }, def.id);
      }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "City Market Share" }),
      /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border, padding: 10 }], children: CITIES.map((city) => {
        const hasPresence = city.id === "salem" || (game.cityOffices || []).some((o) => o.cityId === city.id);
        if (!hasPresence) return null;
        const playerShare = getCityPlayerShare(game, city.id);
        const jobsWon = (game.cityJobsWon || {})[city.id] || 0;
        return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 10 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.label, col], children: [
              city.name,
              ", ",
              city.state
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: playerShare >= 50 ? T.green : T.sub }], children: [
              playerShare,
              "% share \xB7 ",
              jobsWon,
              " jobs won"
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: { height: 6, backgroundColor: T.track, borderRadius: 3 }, children: /* @__PURE__ */ jsx(View, { style: { height: 6, width: `${Math.min(100, playerShare)}%`, backgroundColor: playerShare >= 50 ? T.green : T.blue, borderRadius: 3 } }) })
        ] }, city.id);
      }) }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "National Contractor Rankings" }),
      (() => {
        const activeRivals = (game.rivals || []).filter((r) => !(game.acquiredRivals || []).includes(r.id) && r.status !== "Bankrupt");
        if (activeRivals.length === 0) return null;
        const closestRival = activeRivals.reduce((closest, r) => {
          const rVal = (r.cash || 0) + (r.rep || 0) * 5e4 + (r.cityPresence || ["salem"]).length * 1e5 + (r.jobsCompleted || 0) * 15e3;
          const closestVal2 = (closest.cash || 0) + (closest.rep || 0) * 5e4 + (closest.cityPresence || ["salem"]).length * 1e5 + (closest.jobsCompleted || 0) * 15e3;
          return Math.abs(rVal - valuation) < Math.abs(closestVal2 - valuation) ? r : closest;
        });
        const closestVal = (closestRival.cash || 0) + (closestRival.rep || 0) * 5e4 + (closestRival.cityPresence || ["salem"]).length * 1e5 + (closestRival.jobsCompleted || 0) * 15e3;
        const gap = valuation - closestVal;
        const isAhead = gap >= 0;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.orange, borderWidth: 1, marginBottom: 8 }], children: [
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange, fontSize: 10, fontWeight: "700", marginBottom: 2 }], children: [
            "\u{1F3AF} CLOSEST RIVAL \u2014 ",
            closestRival.name
          ] }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
            isAhead ? `You're ahead by ${money2(Math.abs(gap))}` : `They're ahead by ${money2(Math.abs(gap))}`,
            " \xB7 ",
            closestRival.focus || "general",
            " focus"
          ] })
        ] });
      })(),
      buildContractorRankings(game).map((entry) => {
        const rival = !entry.isPlayer ? (game.rivals || []).find((r) => r.id === entry.id) : null;
        const acqCost = rival ? Math.max(5e4, (rival.rep || 0) * 3e3 + (rival.cash || 0) * 0.5) : 0;
        const rankColor = entry.rank === 1 ? T.yellow : entry.rank <= 3 ? T.orange : entry.rank <= 10 ? T.green : T.sub;
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, {
          backgroundColor: entry.isPlayer ? T.panel3 : entry.acquired ? T.panel2 : T.panel,
          borderColor: entry.isPlayer ? T.cyan : entry.rank <= 3 ? T.yellow : entry.acquired ? T.green : T.border,
          borderLeftWidth: entry.isPlayer || entry.rank <= 3 ? 4 : 1,
          marginBottom: 6
        }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [{ fontSize: 18, fontWeight: "900", color: rankColor, minWidth: 36 }], children: [
                "#",
                entry.rank
              ] }),
              /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: entry.isPlayer ? T.cyan : col.color }], children: [
                  entry.isPlayer ? "\u2605 " : "",
                  entry.name,
                  entry.acquired ? " \u2705" : ""
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                  "Rep ",
                  entry.rep,
                  " \xB7 ",
                  entry.cities,
                  " ",
                  entry.cities === 1 ? "city" : "cities",
                  entry.status === "Bankrupt" ? " \xB7 \u{1F480} Bankrupt" : ""
                ] }),
                rival && (() => {
                  const focusIcon = rival.focus === "residential" ? "\u{1F3E0}" : rival.focus === "commercial" ? "\u{1F3E2}" : "\u{1F527}";
                  const focusLabel = rival.focus || "general";
                  const aggLabel = (rival.aggression || 0) >= 0.7 ? "High threat" : (rival.aggression || 0) >= 0.55 ? "Active" : "Low key";
                  const aggColor = (rival.aggression || 0) >= 0.7 ? T.red : (rival.aggression || 0) >= 0.55 ? T.orange : T.sub;
                  const inHomeCity = (rival.cityPresence || ["salem"]).includes(game.startingCityId || "salem");
                  return /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginTop: 1 }], children: [
                    focusIcon,
                    " ",
                    focusLabel,
                    " \xB7 ",
                    /* @__PURE__ */ jsx(Text, { style: { color: aggColor }, children: aggLabel }),
                    inHomeCity ? " \xB7 \u{1F3E0} In your market" : ""
                  ] });
                })()
              ] })
            ] }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: entry.isPlayer ? T.cyan : T.sub }], children: money2(entry.value) })
          ] }),
          rival && !entry.acquired && entry.status !== "Bankrupt" && /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 12, marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }, children: [
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
              "\u{1F477} ",
              rival.employees || 0,
              " crew"
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
              "\u{1F69B} ",
              rival.equipment || 0,
              " vehicles"
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
              "\u{1F3D9}\uFE0F ",
              (rival.cityPresence || ["salem"]).length,
              " ",
              (rival.cityPresence || ["salem"]).length === 1 ? "city" : "cities"
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
              "\u{1F4B0} ",
              money2(rival.cash || 0)
            ] })
          ] }),
          rival && (rival.aggression || 0) >= 0.7 && !entry.acquired && entry.status !== "Bankrupt" && /* @__PURE__ */ jsxs(View, { style: { marginTop: 5 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.red, fontSize: 10, fontWeight: "700" }], children: "\u26A0 High aggression rival" }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red, fontSize: 10 }], children: [
                Math.round((rival.aggression || 0) * 100),
                "%"
              ] })
            ] }),
            /* @__PURE__ */ jsx(View, { style: { height: 3, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 3, width: `${Math.round((rival.aggression || 0) * 100)}%`, backgroundColor: T.red, borderRadius: 2 } }) })
          ] }),
          !entry.isPlayer && !entry.acquired && entry.status !== "Bankrupt" && game.reputation >= 50 && (() => {
            const rivalValNow = entry.value;
            const canAcquire = valuation >= rivalValNow * 5 && game.cash >= 2e5 || game.cash >= acqCost;
            return canAcquire ? /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.btn, { marginTop: 8, backgroundColor: game.cash >= acqCost ? T.orange : T.panel2, borderColor: T.orange }],
                onPress: () => Alert.alert(
                  "Acquire Competitor",
                  `Buy out ${entry.name} for ${money2(acqCost)}? You'll absorb their assets and crew.`,
                  [{ text: "Cancel", style: "cancel" }, { text: "Acquire", onPress: () => handleAcquireRival(entry.id) }]
                ),
                children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: game.cash >= acqCost ? "#fff" : T.sub }], children: [
                  "Acquire \u2014 ",
                  money2(acqCost)
                ] })
              }
            ) : null;
          })(),
          entry.acquired && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, marginTop: 4 }], children: "Acquired \u2014 integrated into your company." })
        ] }, entry.id);
      }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Achievements" }),
      /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, children: ACHIEVEMENTS_LIST.map((ach) => {
        const earned = (game.achievements || []).includes(ach.id);
        return /* @__PURE__ */ jsxs(View, { style: { width: "48%", backgroundColor: earned ? T.green + "15" : T.panel, borderColor: earned ? T.green : T.border, borderWidth: earned ? 1.5 : 1, borderRadius: 10, padding: 11, marginBottom: 0 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", marginBottom: 5 }, children: [
            /* @__PURE__ */ jsx(Ionicons, { name: ach.icon, size: 22, color: earned ? T.green : T.sub, style: { marginRight: 7, opacity: earned ? 1 : 0.35 } }),
            earned && /* @__PURE__ */ jsx(Text, { style: { color: T.green, fontSize: 13, fontWeight: "bold", marginLeft: "auto" }, children: "\u2713" })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: { fontWeight: "bold", fontSize: 12, color: earned ? T.text : T.sub, marginBottom: 3 }, children: ach.title }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: earned ? T.sub : T.border, fontSize: 10, lineHeight: 14 }], children: ach.desc })
        ] }, ach.id);
      }) }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }], children: "Company Records" }),
      /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.yellow, borderWidth: 1.5 }], children: [
        { label: "\u{1F3C6} Biggest Contract", value: money2(game.hallOfFame?.biggestContract || 0), color: T.yellow },
        { label: "\u{1F4C8} Peak Reputation", value: `${game.hallOfFame?.highestRep || 0}`, color: T.purple },
        { label: "\u{1F477} Largest Crew Ever", value: `${game.hallOfFame?.largestCrew || 0} workers`, color: T.cyan },
        { label: "\u{1F69C} Largest Fleet Ever", value: `${game.hallOfFame?.largestFleet || 0} machines`, color: T.orange },
        { label: "\u{1F4B0} Peak Valuation", value: money2(game.hallOfFame?.highestValuation || 0), color: T.green },
        { label: "\u2B50 Most Profitable Job", value: game.hallOfFame?.mostProfitableProject?.label ? `${game.hallOfFame.mostProfitableProject.label} (${money2(game.hallOfFame.mostProfitableProject.value)})` : "None yet", color: T.blue }
      ].map((row, i, arr) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.border }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 12 }], children: row.label }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.color, fontWeight: "700", fontSize: 12, textAlign: "right", flex: 1, marginLeft: 8 }], numberOfLines: 1, children: row.value })
      ] }, row.label)) }),
      (() => {
        const activeCities = CITIES.filter(
          (city) => city.id === "salem" || (game.cityOffices || []).some((o) => o.cityId === city.id)
        );
        if (activeCities.length === 0) return null;
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }], children: "City Presence" }),
          /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: activeCities.map((city, i) => {
            const stats = game.cityStats?.[city.id] || { playerJobs: 0, rivalJobs: 0 };
            const totalJobs = stats.playerJobs + stats.rivalJobs;
            const sharePct = totalJobs > 0 ? Math.round(stats.playerJobs / totalJobs * 100) : 100;
            const rankInCity = 1 + (game.rivals || []).filter(
              (r) => r.status !== "Bankrupt" && (r.cityPresence || ["salem"]).includes(city.id) && (r.rep || 0) > (game.reputation || 0)
            ).length;
            const hasOffice = city.id === "salem" || (game.cityOffices || []).some((o) => o.cityId === city.id);
            return /* @__PURE__ */ jsxs(View, { style: { marginBottom: i < activeCities.length - 1 ? 12 : 0, paddingBottom: i < activeCities.length - 1 ? 12 : 0, borderBottomWidth: i < activeCities.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: T.border }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
                /* @__PURE__ */ jsxs(View, { children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.label, col], children: [
                    city.name,
                    ", ",
                    city.state
                  ] }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub }], children: [
                    "Rank #",
                    rankInCity,
                    " \xB7 ",
                    stats.playerJobs,
                    " jobs won"
                  ] })
                ] }),
                /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: sharePct >= 50 ? T.green : sharePct >= 25 ? T.cyan : T.sub, fontWeight: "700" }], children: [
                    sharePct,
                    "%"
                  ] }),
                  /* @__PURE__ */ jsx(Text, { style: [{ fontSize: 9, color: T.sub }], children: "market share" })
                ] })
              ] }),
              /* @__PURE__ */ jsx(View, { style: { height: 6, backgroundColor: T.track, borderRadius: 3 }, children: /* @__PURE__ */ jsx(View, { style: { height: 6, width: `${Math.min(100, sharePct)}%`, backgroundColor: sharePct >= 50 ? T.green : T.blue, borderRadius: 3 } }) })
            ] }, city.id);
          }) })
        ] });
      })(),
      (() => {
        const endgameMilestones = MILESTONE_DEFS.filter((m) => m.tier === 4);
        if (endgameMilestones.length === 0) return null;
        const valuation2 = computeValuation(game);
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }], children: "Ultimate Goals" }),
          endgameMilestones.map((m) => {
            const done = !!game._milestones?.[m.key];
            let progressPct = done ? 100 : 0;
            let progressLabel = null;
            if (!done) {
              if (m.key === "rep100") {
                const v = game.reputation || 0;
                progressPct = Math.min(100, v / 100 * 100);
                progressLabel = `${v}/100 rep`;
              } else if (m.key === "cities10") {
                const v = game.unlockedCities?.length || 1;
                progressPct = Math.min(100, v / 10 * 100);
                progressLabel = `${v}/10 cities`;
              } else if (m.key === "value100m") {
                const v = game.companyValuation || 0;
                progressPct = Math.min(100, v / 1e8 * 100);
                progressLabel = `${money2(v)} / $100M`;
              } else if (m.key === "jobs1000") {
                const v = game.completedJobs || 0;
                progressPct = Math.min(100, v / 1e3 * 100);
                progressLabel = `${v}/1,000 jobs`;
              } else if (m.key === "domination") {
                const activeRivals = (game.rivals || []).filter((r) => r.status !== "Bankrupt");
                const outvalued = activeRivals.filter((r) => (game.companyValuation || 0) > ((r.cash || 0) + (r.rep || 0) * 5e4) * 10).length;
                progressPct = activeRivals.length > 0 ? Math.min(100, outvalued / activeRivals.length * 100) : 100;
                progressLabel = `${outvalued}/${activeRivals.length} rivals outvalued 10\xD7`;
              }
            }
            return /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: done ? T.panel3 : T.panel, borderColor: done ? T.yellow : T.border, borderWidth: done ? 2 : 1, marginBottom: 6 }], children: /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, children: /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: done ? T.yellow : T.text }], children: [
                done ? "\u{1F3C6}" : "\u25CB",
                " ",
                m.label
              ] }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub }], children: m.desc }),
              !done && progressLabel && /* @__PURE__ */ jsxs(View, { style: { marginTop: 5 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.yellow, fontSize: 10 }], children: progressLabel }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
                    Math.round(progressPct),
                    "%"
                  ] })
                ] }),
                /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2, marginTop: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${progressPct}%`, backgroundColor: T.yellow, borderRadius: 2 } }) })
              ] })
            ] }) }) }, m.key);
          })
        ] });
      })(),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }], children: "Company Legacy" }),
      /* @__PURE__ */ jsx(View, { style: styles.card, children: [
        { label: "Years in Business", value: (() => {
          const yrs = Math.floor((game.day || 1) / 365);
          return yrs >= 1 ? `${yrs} Year${yrs !== 1 ? "s" : ""}` : "< 1 Year";
        })(), color: T.cyan },
        { label: "Days Operating", value: `${game.day ?? 0}`, color: T.text },
        { label: "Total Contracts Won", value: `${(game.legacyStats?.totalContractsWon ?? 0).toLocaleString()}`, color: T.blue },
        { label: "Total Revenue", value: money2(game.legacyStats?.totalRevenue ?? 0), color: T.green },
        { label: "Employees Ever Hired", value: `${(game.legacyStats?.totalEmployeesHired ?? 0).toLocaleString()}`, color: T.purple },
        { label: "Equipment Purchased", value: `${(game.legacyStats?.totalEquipmentBought ?? 0).toLocaleString()}`, color: T.orange },
        { label: "Achievements Earned", value: `${(game.achievements || []).length} / ${ACHIEVEMENTS_LIST.length}`, color: T.yellow }
      ].map((row, i, arr) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.border }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.sub, fontWeight: "500", fontSize: 13 }], children: row.label }),
        /* @__PURE__ */ jsx(Text, { style: { color: row.color, fontWeight: "bold", fontSize: 14 }, children: row.value })
      ] }, row.label)) }),
      (() => {
        const legacy = getLegacyScore(game);
        return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.purple, borderWidth: 1.5, marginTop: 8, marginBottom: 8, alignItems: "center" }], children: [
          /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, color: T.purple, fontWeight: "700", marginBottom: 4 }, children: "YOUR LEGACY TIER" }),
          /* @__PURE__ */ jsx(Ionicons, { name: legacy.icon, size: 36, color: T.purple, style: { marginBottom: 4 } }),
          /* @__PURE__ */ jsx(Text, { style: [styles.h2, { color: T.purple, textAlign: "center" }], children: legacy.label }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }], children: [
            "Legacy Score: ",
            legacy.score,
            " / 100"
          ] }),
          /* @__PURE__ */ jsx(View, { style: { height: 6, width: "100%", backgroundColor: T.track, borderRadius: 3, marginTop: 10 }, children: /* @__PURE__ */ jsx(View, { style: { height: 6, width: `${legacy.score}%`, backgroundColor: T.purple, borderRadius: 3 } }) })
        ] });
      })()
    ] });
  }
  function renderFinance() {
    const totalDebt = game.loans.reduce((s, l) => s + l.remainingBalance, 0);
    const dailyPayroll = [...game.crew, ...game.officeStaff].reduce((s, p) => s + (p.wagePerDay || 0), 0);
    const weeklyPayroll = dailyPayroll * 7;
    const weeklyEquipCost = game.equipment.reduce((s, e) => s + e.dailyCost, 0) * 7;
    const weeklyRent = office.dailyRent * 7;
    const dailyEquipCost = game.equipment.reduce((s, e) => s + e.dailyCost, 0);
    const dailyLoanInterest = game.loans.reduce((s, l) => s + (l.weeklyPayment || 0) / 7, 0);
    const dailyIncome = (game.weeklyStats?.revenue || 0) / 7;
    const netDailyCashFlow = dailyIncome - dailyPayroll - dailyEquipCost - office.dailyRent - dailyLoanInterest;
    const regionalEconomy = getConstructionRegionalSnapshot(game);
    const loanOffers = LOAN_PRODUCTS.map((product) => {
      const offer = computeLoanOffer(product.id, buildBorrowerProfile(game, product));
      return {
        ...product,
        _offer: offer,
        principal: offer.approved ? offer.principal : product.principalMin,
        apr: offer.approved ? offer.apr : product.aprMax,
        weeks: product.termWeeks,
        eligible: offer.approved,
        declineReasons: offer.approved ? [] : offer.reasons || []
      };
    });
    const ledgerCutoff = (game.day || 0) - 7;
    const ledger7d = (game.ledger || []).filter((entry) => (entry.day || 0) >= ledgerCutoff);
    const recentLedger = (game.ledger || []).slice(0, 8);
    const ledgerRevenue = ledger7d.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
    const ledgerExpenses = ledger7d.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const ledgerNet = ledgerRevenue - ledgerExpenses;
    const ledgerCategoryLabels = {
      payroll: "Payroll",
      fuel: "Fuel",
      maintenance: "Maintenance",
      equipment: "Equipment",
      materials: "Materials",
      insurance: "Insurance",
      utilities: "Utilities",
      inventory: "Inventory",
      taxes: "Taxes",
      financing: "Financing",
      property: "Property",
      fines: "Fines & Legal",
      contracts: "Contracts",
      bonuses: "Bonuses",
      sales: "Asset Sales",
      misc: "Other"
    };
    const summarizeLedgerCategories = (entries, sign) => Object.entries(entries.reduce((acc, entry) => {
      if (sign === "income" && entry.amount <= 0 || sign === "expense" && entry.amount >= 0) return acc;
      const key = entry.category || "misc";
      acc[key] = (acc[key] || 0) + Math.abs(entry.amount);
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topRevenueCategories = summarizeLedgerCategories(ledger7d, "income");
    const topExpenseCategories = summarizeLedgerCategories(ledger7d, "expense");
    return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 14, paddingBottom: 100 }, children: [
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Financial Overview" }),
        [
          { label: "Cash on Hand", val: money2(game.cash), color: game.cash >= 0 ? T.green : T.red },
          {
            label: "Net Daily Cash Flow",
            val: (netDailyCashFlow >= 0 ? "+" : "") + money2(netDailyCashFlow),
            color: netDailyCashFlow >= 0 ? T.green : T.red,
            bar: netDailyCashFlow < 0 && game.cash > 0 ? (() => {
              const d = Math.floor(game.cash / Math.abs(netDailyCashFlow));
              return { value: Math.min(100, Math.round(d / 30 * 100)), color: d < 7 ? T.red : d < 14 ? T.orange : T.yellow };
            })() : null,
            note: netDailyCashFlow < 0 && game.cash > 0 ? `${Math.floor(game.cash / Math.abs(netDailyCashFlow))}d runway at current burn rate` : null
          },
          { label: "Credit Score", val: `${game.creditScore} (${creditInfo.label})`, color: T[creditInfo.color], bar: { value: Math.round(Math.max(0, Math.min(100, (game.creditScore - 300) / 550 * 100))), color: T[creditInfo.color] } },
          { label: "Total Debt", val: money2(totalDebt), color: totalDebt > 0 ? T.orange : T.green },
          { label: "Daily Loan Interest", val: money2(Math.round(dailyLoanInterest)), color: dailyLoanInterest > 0 ? T.orange : T.sub },
          { label: "Weekly Payroll", val: money2(weeklyPayroll), color: T.text },
          { label: "Weekly Equip Cost", val: money2(weeklyEquipCost), color: T.text },
          { label: "Weekly Rent", val: money2(weeklyRent), color: T.text },
          { label: "Total Revenue", val: money2(game.revenue), color: T.cyan },
          { label: "Total Expenses", val: money2(game.expenses), color: T.orange }
        ].map((row) => /* @__PURE__ */ jsxs(View, { style: [styles.finRow, { borderBottomColor: T.border, flexDirection: "column", alignItems: "stretch" }], children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: row.label }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.color }], children: row.val })
          ] }),
          row.bar && /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 4 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${row.bar.value}%`, backgroundColor: row.bar.color }] }) }),
          row.note && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.bar?.color || T.sub, fontSize: 10, marginTop: 2 }], children: row.note })
        ] }, row.label))
      ] }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1 }], children: [
        /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, { color: T.cyan }], children: [
          "Regional Economy \xB7 ",
          regionalEconomy.stateName
        ] }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "Local construction conditions actively affect bids, materials, wages, and financing." }),
        [
          { label: "Contract Market", val: `${regionalEconomy.contractValueMult.toFixed(2)}\xD7`, color: regionalEconomy.contractValueMult >= 1 ? T.green : T.orange },
          { label: "Material Prices", val: `${regionalEconomy.materialPriceMult.toFixed(2)}\xD7`, color: regionalEconomy.materialPriceMult <= 1 ? T.green : T.orange },
          { label: "Wage Pressure", val: `${regionalEconomy.wageMult.toFixed(2)}\xD7`, color: regionalEconomy.wageMult <= 1 ? T.green : T.orange },
          { label: "Lending Climate", val: `${regionalEconomy.lendingEconomyMult.toFixed(2)}\xD7`, color: regionalEconomy.lendingEconomyMult >= 1 ? T.green : T.orange }
        ].map((row) => /* @__PURE__ */ jsxs(View, { style: [styles.finRow, { borderBottomColor: T.border }], children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: row.label }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: row.color, fontWeight: "700" }], children: row.val })
        ] }, row.label))
      ] }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.strongBorder, borderWidth: 1.5 }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
          /* @__PURE__ */ jsxs(View, { children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Transaction Ledger" }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Last 7 days \xB7 cash movements recorded automatically" })
          ] }),
          /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: (ledgerNet >= 0 ? T.green : T.red) + "22" }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.statusPillText, { color: ledgerNet >= 0 ? T.green : T.red }], children: [
            ledgerNet >= 0 ? "+" : "",
            money2(ledgerNet),
            " net"
          ] }) })
        ] }),
        /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 8, marginBottom: 10 }, children: [
          { label: "Income", value: ledgerRevenue, color: T.green, prefix: "+" },
          { label: "Expenses", value: ledgerExpenses, color: T.red, prefix: "-" },
          { label: "Net", value: Math.abs(ledgerNet), color: ledgerNet >= 0 ? T.green : T.red, prefix: ledgerNet >= 0 ? "+" : "-" }
        ].map((item) => /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 8, padding: 9, alignItems: "center" }, children: [
          /* @__PURE__ */ jsxs(Text, { style: { color: item.color, fontSize: 13, fontWeight: "800" }, children: [
            item.prefix,
            money2(item.value)
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: item.label })
        ] }, item.label)) }),
        ledger7d.length > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
          (topRevenueCategories.length > 0 || topExpenseCategories.length > 0) && /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 10, marginBottom: 10 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontWeight: "700", marginBottom: 4 }], children: "TOP INCOME" }),
              topRevenueCategories.map(([category, amount]) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], numberOfLines: 1, children: ledgerCategoryLabels[category] || category }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.green }], children: [
                  "+",
                  money2(amount)
                ] })
              ] }, `rev-${category}`)),
              topRevenueCategories.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "No income yet" })
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.red, fontWeight: "700", marginBottom: 4 }], children: "TOP SPENDING" }),
              topExpenseCategories.map(([category, amount]) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], numberOfLines: 1, children: ledgerCategoryLabels[category] || category }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
                  "-",
                  money2(amount)
                ] })
              ] }, `exp-${category}`)),
              topExpenseCategories.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "No expenses yet" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontWeight: "700", marginBottom: 5 }], children: "RECENT TRANSACTIONS" }),
          recentLedger.map((entry, index) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: T.border }, children: [
            /* @__PURE__ */ jsx(View, { style: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: (entry.amount >= 0 ? T.green : T.orange) + "22", marginRight: 8 }, children: /* @__PURE__ */ jsx(Ionicons, { name: entry.amount >= 0 ? "arrow-down" : "arrow-up", size: 14, color: entry.amount >= 0 ? T.green : T.orange }) }),
            /* @__PURE__ */ jsxs(View, { style: { flex: 1, marginRight: 8 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], numberOfLines: 1, children: entry.description || ledgerCategoryLabels[entry.category] || "Transaction" }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: [
                "Day ",
                entry.day || 0,
                " \xB7 ",
                ledgerCategoryLabels[entry.category] || entry.category || "Other",
                " \xB7 Balance ",
                money2(entry.balance || 0)
              ] })
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: entry.amount >= 0 ? T.green : T.red, fontWeight: "800" }], children: [
              entry.amount >= 0 ? "+" : "-",
              money2(Math.abs(entry.amount))
            ] })
          ] }, entry.id || `${entry.day}-${index}`))
        ] }) : /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.panel2, borderRadius: 8, padding: 12 }, children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, textAlign: "center" }], children: "No ledger activity yet. New income and expenses will appear here automatically." }) })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1, marginBottom: 8 }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, { color: T.cyan }], children: "\u{1F3E6} Reserve Savings" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.cyan }], children: money2(game.savings || 0) })
        ] }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginBottom: 8 }], children: (game.savings || 0) > 0 ? `Earning ${money2(Math.round((game.savings || 0) * 12e-4))}/day \xB7 4.4% annual` : "Deposit to earn 4.4% annual interest on reserves." }),
        /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 8 }, children: [1e3, 5e3, 1e4, 5e4, 1e5].map((p) => /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.chip, { marginRight: 6, borderColor: savingsAmt === String(p) ? T.cyan : T.border }], onPress: () => setSavingsAmt(String(p)), children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: savingsAmt === String(p) ? T.cyan : T.sub }], children: money2(p) }) }, p)) }),
        /* @__PURE__ */ jsx(TextInput, { style: [styles.input, col, { marginBottom: 8 }], value: savingsAmt, onChangeText: setSavingsAmt, keyboardType: "numeric", placeholder: "Custom amount", placeholderTextColor: T.sub }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8 }, children: [
          /* @__PURE__ */ jsx(
            TouchableOpacity,
            {
              style: [styles.btn, { flex: 1, backgroundColor: game.cash >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? T.cyan : T.panel2, borderColor: T.cyan }],
              onPress: () => {
                handleSavingsDeposit(parseInt(savingsAmt) || 0);
                setSavingsAmt("");
              },
              children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.cash >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? "#000" : T.sub }], children: "Deposit \u2192" })
            }
          ),
          /* @__PURE__ */ jsx(
            TouchableOpacity,
            {
              style: [styles.btn, { flex: 1, backgroundColor: (game.savings || 0) >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? T.green : T.panel2, borderColor: T.green }],
              onPress: () => {
                handleSavingsWithdraw(parseInt(savingsAmt) || 0);
                setSavingsAmt("");
              },
              children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: (game.savings || 0) >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? "#fff" : T.sub }], children: "\u2190 Withdraw" })
            }
          )
        ] })
      ] }),
      (game.taxDue || 0) > 0 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.red, borderWidth: 1.5 }], children: [
        /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: T.red }], children: [
          "\u26A0 Tax Due: ",
          money2(game.taxDue)
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          "Overdue ",
          game.taxOverdueDays,
          " day(s). Business freezes at 14 days."
        ] }),
        game.taxOverdueDays > 0 && /* @__PURE__ */ jsxs(View, { style: { marginTop: 6 }, children: [
          /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, height: 8 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.round(game.taxOverdueDays / 14 * 100)}%`, backgroundColor: game.taxOverdueDays >= 10 ? T.red : T.orange, height: 8 }] }) }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: game.taxOverdueDays >= 10 ? T.red : T.orange, marginTop: 2, fontWeight: "600" }], children: [
            "Day ",
            game.taxOverdueDays,
            " of 14 \u2014 ",
            14 - game.taxOverdueDays,
            " day",
            14 - game.taxOverdueDays !== 1 ? "s" : "",
            " until freeze"
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 8, backgroundColor: game.cash >= (game.taxDue || 0) ? T.red : T.panel2, borderColor: T.red }],
            onPress: handlePayTax,
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.cash >= (game.taxDue || 0) ? "#fff" : T.red }], children: "Pay Tax Bill" })
          }
        )
      ] }),
      game.loans.length > 0 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Active Loans" }),
        game.loans.map((loan) => /* @__PURE__ */ jsxs(View, { style: { marginBottom: 10 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { flex: 1 }], numberOfLines: 1, children: loan.label }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: T.orange }], numberOfLines: 1, children: [
              money2(loan.remainingBalance),
              " left"
            ] })
          ] }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
            loan.weeksLeft,
            " weeks \xB7 ",
            money2(loan.weeklyPayment),
            "/week"
          ] }),
          (() => {
            const maxWeeks = 52;
            const pct = Math.min(100, Math.round(loan.weeksLeft / maxWeeks * 100));
            const barColor = loan.weeksLeft <= 4 ? T.green : loan.weeksLeft <= 13 ? T.orange : T.red;
            return /* @__PURE__ */ jsxs(View, { style: { marginTop: 4 }, children: [
              /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }] }) }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, marginTop: 2, fontSize: 10 }], children: loan.weeksLeft <= 4 ? `Almost done \u2014 ${loan.weeksLeft} wk${loan.weeksLeft !== 1 ? "s" : ""} left` : `${loan.weeksLeft} weeks remaining` })
            ] });
          })(),
          loan.missedPayments > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
            loan.missedPayments,
            " missed payment(s)"
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 6, marginTop: 6 }, children: [
            /* @__PURE__ */ jsx(
              TextInput,
              {
                style: [styles.input, col, { flex: 1, marginBottom: 0, paddingVertical: 4 }],
                value: loanPayAmts[loan.id] || "",
                onChangeText: (v) => setLoanPayAmts((prev) => ({ ...prev, [loan.id]: v })),
                keyboardType: "numeric",
                placeholder: "Extra payment",
                placeholderTextColor: T.sub
              }
            ),
            /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.smallBtn, { borderWidth: 1, borderColor: T.cyan, paddingHorizontal: 14 }],
                onPress: () => {
                  handleLoanPartialPayment(loan.id, parseInt(loanPayAmts[loan.id]) || 0);
                  setLoanPayAmts((prev) => ({ ...prev, [loan.id]: "" }));
                },
                children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.cyan }], children: "Pay" })
              }
            )
          ] }),
          (() => {
            const payoff = Math.round((loan.remainingBalance || 0) * 1.01);
            const canAfford = game.cash >= payoff;
            return /* @__PURE__ */ jsx(
              TouchableOpacity,
              {
                style: [styles.smallBtn, { marginTop: 4, borderWidth: 1, borderColor: canAfford ? T.green : T.border, backgroundColor: "transparent" }],
                onPress: () => handlePayoffLoan(loan.id, payoff),
                children: /* @__PURE__ */ jsxs(Text, { style: [styles.smallBtnText, { color: canAfford ? T.green : T.sub }], children: [
                  "Pay Off Early \u2014 ",
                  money2(payoff),
                  !canAfford ? ` (need ${money2(payoff - game.cash)} more)` : " \xB7 1% fee \xB7 Credit +5"
                ] })
              }
            );
          })()
        ] }, loan.id))
      ] }),
      !game.creditLine && (game.creditScore || 600) >= 680 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.purple, borderWidth: 1, marginBottom: 8 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, { color: T.purple }], children: "\u{1F4B3} Business Line of Credit" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "$75,000 revolving \xB7 14% APR on drawn amount only \xB7 repay anytime" }),
        /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { marginTop: 8, backgroundColor: T.purple, borderColor: T.purple }], onPress: handleOpenCreditLine, children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#fff" }], children: "Open Line of Credit" }) })
      ] }),
      game.creditLine && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.purple, borderWidth: 1.5, marginBottom: 8 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, { color: T.purple }], children: "\u{1F4B3} Line of Credit" }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Drawn" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.red }], children: money2(game.creditLine.drawn || 0) })
        ] }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Available" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.green }], children: money2((game.creditLine.limit || 75e3) - (game.creditLine.drawn || 0)) })
        ] }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10, marginBottom: 8 }], children: (game.creditLine.drawn || 0) > 0 ? `Interest: ~${money2(Math.round((game.creditLine.drawn || 0) * 0.14 / 365))}/day` : "No interest until you draw funds." }),
        /* @__PURE__ */ jsx(TextInput, { style: [styles.input, col, { marginBottom: 8 }], value: creditLineAmt, onChangeText: setCreditLineAmt, keyboardType: "numeric", placeholder: "Amount to draw or repay", placeholderTextColor: T.sub }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8 }, children: [
          /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.smallBtn, { flex: 1, borderWidth: 1, borderColor: T.purple }], onPress: () => {
            handleDrawCreditLine(parseInt(creditLineAmt) || 0);
            setCreditLineAmt("");
          }, children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.purple }], children: "Draw Funds" }) }),
          /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.smallBtn, { flex: 1, borderWidth: 1, borderColor: T.green }], onPress: () => {
            handleRepayCreditLine(parseInt(creditLineAmt) || 0);
            setCreditLineAmt("");
          }, children: /* @__PURE__ */ jsx(Text, { style: [styles.smallBtnText, { color: T.green }], children: "Repay" }) })
        ] })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Available Financing" }),
      loanOffers.map((product) => /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: product.label }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.green }], children: money2(product.principal) })
        ] }),
        product.eligible ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
            product.apr,
            "% APR \xB7 ",
            product.weeks,
            " weeks \xB7 ",
            money2(product._offer.weeklyPayment),
            "/week \xB7 Total ",
            money2(product._offer.totalRepayment)
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontSize: 10, marginTop: 3 }], children: product._offer.approvalReason }),
          product.collateralRequired && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.orange, fontSize: 10, marginTop: 2 }], children: "Secured financing \xB7 collateral required" })
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.red }], children: "Not currently eligible" }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { fontSize: 10, marginTop: 3 }], children: product.declineReasons[0] || `Needs ${product.minCredit}+ credit score.` })
        ] }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 8, backgroundColor: product.eligible ? T.blue : T.panel2, borderColor: product.eligible ? T.blue : T.border }],
            onPress: () => handleTakeLoan(product),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: product.eligible ? "#fff" : T.sub }], children: product.eligible ? "Accept Financing" : "View Requirements" })
          }
        )
      ] }, product.id)),
      loanOffers.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { textAlign: "center", paddingVertical: 16 }], children: "No financing available \u2014 improve credit score to unlock loans." }),
      /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border, marginBottom: 10 }], children: [
        /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col], children: [
          "Reputation: ",
          game.reputation,
          " \u2014 ",
          repTier.badge,
          " ",
          repTier.label
        ] }),
        /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 6, height: 8 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.min(100, game.reputation)}%`, backgroundColor: T.purple, height: 8 }] }) }),
        [
          { threshold: 20, effect: "Unlock residential contracts" },
          { threshold: 40, effect: "Better loan terms, more contract variety" },
          { threshold: 60, effect: "Commercial mega-contracts unlock" },
          { threshold: 80, effect: "Stadium contract available" },
          { threshold: 95, effect: "WildBear City Plaza unlocked" }
        ].map((r) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }, children: [
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: game.reputation >= r.threshold ? T.green : T.sub }], children: [
            game.reputation >= r.threshold ? "\u2705" : "\u25CB",
            " Rep ",
            r.threshold
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: game.reputation >= r.threshold ? T.green : T.sub }], children: r.effect })
        ] }, r.threshold))
      ] }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Materials Inventory" }),
      /* @__PURE__ */ jsx(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: MATERIAL_DEFS.map((m) => /* @__PURE__ */ jsxs(View, { style: [styles.finRow, { borderBottomColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 5 }, children: [
          /* @__PURE__ */ jsx(Ionicons, { name: m.icon, size: 13, color: T.text }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, col], children: m.label })
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
          game.materials[m.id] || 0,
          " ",
          m.unit,
          " \xB7 ",
          money2(game.materialPrices[m.id] || m.basePrice),
          "/",
          m.unit
        ] })
      ] }, m.id)) }),
      /* @__PURE__ */ jsxs(View, { style: { marginTop: 18, marginBottom: 18 }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Insurance Coverage" }),
        (() => {
          const activePlan = INSURANCE_PLANS.find((p) => p.id === (game.insurancePlanId || "none"));
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            !activePlan || game.insurancePlanId === "none" ? /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.red + "22", borderColor: T.red, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 }, children: /* @__PURE__ */ jsx(Text, { style: { color: T.red, fontWeight: "bold", fontSize: 13 }, children: "\u26A0 No insurance \u2014 accidents are 100% your cost" }) }) : /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.cyan + "18", borderColor: T.cyan, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.cyan }], children: activePlan.label }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                "Coverage: ",
                Math.round(activePlan.coverage * 100),
                "%  \xB7  Deductible: ",
                money2(activePlan.deductible),
                "  \xB7  Premium: ",
                money2(activePlan.monthlyPremium),
                "/mo"
              ] })
            ] }),
            INSURANCE_PLANS.map((plan) => {
              const isActive = plan.id === (game.insurancePlanId || "none");
              return /* @__PURE__ */ jsxs(TouchableOpacity, { onPress: () => handleBuyInsurance(plan.id), style: { backgroundColor: isActive ? T.cyan + "22" : T.panel, borderColor: isActive ? T.cyan : T.border, borderWidth: isActive ? 1.5 : 1, borderRadius: 8, padding: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: { color: isActive ? T.cyan : T.text, fontWeight: "bold", fontSize: 13 }, children: [
                    plan.label,
                    isActive ? "  \u2713" : ""
                  ] }),
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: plan.desc })
                ] }),
                /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end", marginLeft: 10 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: { color: isActive ? T.cyan : T.text, fontWeight: "600", fontSize: 12 }, children: plan.monthlyPremium > 0 ? money2(plan.monthlyPremium) + "/mo" : "Free" }),
                  plan.id !== "none" && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                    Math.round(plan.coverage * 100),
                    "% cov \xB7 ",
                    money2(plan.deductible),
                    " ded"
                  ] })
                ] })
              ] }, plan.id);
            })
          ] });
        })()
      ] }),
      /* @__PURE__ */ jsxs(View, { style: { marginBottom: 18 }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Safety & Compliance" }),
        /* @__PURE__ */ jsxs(View, { style: [styles.card, { marginBottom: 10 }], children: [
          /* @__PURE__ */ jsxs(View, { style: { marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "Safety Score" }),
              /* @__PURE__ */ jsxs(Text, { style: { fontWeight: "bold", fontSize: 13, color: (game.safetyScore ?? 0) >= 70 ? T.green : (game.safetyScore ?? 0) >= 40 ? T.orange : T.red }, children: [
                game.safetyScore ?? 0,
                "/100"
              ] })
            ] }),
            /* @__PURE__ */ jsx(View, { style: { height: 8, backgroundColor: T.track, borderRadius: 4, overflow: "hidden" }, children: /* @__PURE__ */ jsx(View, { style: { height: 8, borderRadius: 4, width: `${Math.min(game.safetyScore ?? 0, 100)}%`, backgroundColor: (game.safetyScore ?? 0) >= 70 ? T.green : (game.safetyScore ?? 0) >= 40 ? T.orange : T.red } }) })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "Compliance Score" }),
              /* @__PURE__ */ jsxs(Text, { style: { fontWeight: "bold", fontSize: 13, color: (game.complianceScore ?? 0) >= 60 ? T.blue : (game.complianceScore ?? 0) >= 40 ? T.orange : T.red }, children: [
                game.complianceScore ?? 0,
                "/100"
              ] })
            ] }),
            /* @__PURE__ */ jsx(View, { style: { height: 8, backgroundColor: T.track, borderRadius: 4, overflow: "hidden" }, children: /* @__PURE__ */ jsx(View, { style: { height: 8, borderRadius: 4, width: `${Math.min(game.complianceScore ?? 0, 100)}%`, backgroundColor: (game.complianceScore ?? 0) >= 60 ? T.blue : (game.complianceScore ?? 0) >= 40 ? T.orange : T.red } }) })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "Safety Violations" }),
            /* @__PURE__ */ jsx(Text, { style: { fontWeight: "bold", fontSize: 13, color: (game.safetyViolations ?? 0) > 0 ? T.red : T.green }, children: game.safetyViolations ?? 0 })
          ] }),
          game.incidentHistory && game.incidentHistory.length > 0 && /* @__PURE__ */ jsxs(View, { style: { marginBottom: 10 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, marginBottom: 4 }], children: "Recent Incidents" }),
            [...game.incidentHistory].slice(-3).reverse().map((inc, i) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: T.border }, children: [
              /* @__PURE__ */ jsx(Text, { style: { color: inc.severity === 0 ? T.green : T.red, marginRight: 6, fontSize: 12 }, children: inc.severity === 0 ? "\u2713" : "\u26A0" }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol, { flex: 1 }], children: [
                inc.desc,
                " (Day ",
                inc.day,
                ")"
              ] })
            ] }, i))
          ] }),
          /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.panel2, borderRadius: 6, padding: 8 }, children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontStyle: "italic" }], children: "Higher scores unlock Government contracts and better workers" }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: { marginBottom: 18 }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col], children: "Performance History" }),
        !game.economicHistory || game.economicHistory.length < 2 ? /* @__PURE__ */ jsx(View, { style: [styles.card, { alignItems: "center", paddingVertical: 18 }], children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontStyle: "italic", textAlign: "center" }], children: "Tracking begins after first week of operations" }) }) : /* @__PURE__ */ jsxs(View, { style: [styles.card, { padding: 0, overflow: "hidden" }], children: [
          /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", backgroundColor: T.panel2, paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: T.border }, children: ["Week", "Revenue", "Expenses", "Profit", "Rep"].map((h, i) => /* @__PURE__ */ jsx(Text, { style: [styles.sub, { flex: i === 0 ? 0.6 : 1, color: T.sub, fontWeight: "700", fontSize: 11, textAlign: i === 0 ? "left" : "right" }], children: h }, h)) }),
          (() => {
            const history = [...game.economicHistory].slice(-8).reverse();
            const maxAbsProfit = Math.max(1, ...history.map((r) => Math.abs(r.profit ?? 0)));
            return history.map((row, i) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: i < Math.min((game.economicHistory || []).length, 8) - 1 ? 1 : 0, borderBottomColor: T.border, backgroundColor: i % 2 === 0 ? "transparent" : T.panel2 + "55" }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { flex: 0.6, color: T.sub, fontSize: 11 }], children: [
                "W",
                row.week
              ] }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { flex: 1, color: T.text, fontSize: 11, textAlign: "right" }], children: money2(row.revenue) }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { flex: 1, color: T.text, fontSize: 11, textAlign: "right" }], children: money2(row.expenses) }),
              /* @__PURE__ */ jsxs(View, { style: { flex: 1, alignItems: "flex-end" }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, { fontSize: 11, fontWeight: "700", color: (row.profit ?? 0) >= 0 ? T.green : T.red }], children: money2(row.profit) }),
                /* @__PURE__ */ jsx(View, { style: { height: 2, width: `${Math.round(Math.abs(row.profit ?? 0) / maxAbsProfit * 100)}%`, backgroundColor: (row.profit ?? 0) >= 0 ? T.green : T.red, borderRadius: 1, marginTop: 2 } })
              ] }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { flex: 1, color: T.sub, fontSize: 11, textAlign: "right" }], children: row.reputation ?? "\u2014" })
            ] }, i));
          })()
        ] })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs(SafeAreaView, { style: { flex: 1, backgroundColor: T.bg }, children: [
    /* @__PURE__ */ jsx(StatusBar, { barStyle: theme === "dark" ? "light-content" : "dark-content", backgroundColor: T.bg }),
    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, backgroundColor: T.panel, borderBottomColor: T.border }, children: [
      onBackToHub && /* @__PURE__ */ jsx(TouchableOpacity, { onPress: onBackToHub, style: { flexDirection: "row", alignItems: "center", paddingRight: 12 }, children: /* @__PURE__ */ jsx(Text, { style: { color: T.sub, fontSize: 13, fontWeight: "600" }, children: "\u2039 Hub" }) }),
      /* @__PURE__ */ jsx(Text, { style: { flex: 1, color: T.text, fontSize: 16, fontWeight: "800" }, children: "ConstructionFlow" }),
      /* @__PURE__ */ jsx(View, { style: { backgroundColor: (game.cash >= 0 ? T.green : T.red) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }, children: /* @__PURE__ */ jsx(Text, { style: { color: game.cash >= 0 ? T.green : T.red, fontSize: 12, fontWeight: "700" }, children: money2(game.cash) }) })
    ] }),
    game.pendingCelebration && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "fade", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "center" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, { margin: 24, alignItems: "center", borderColor: game.pendingCelebration.isOnTime ? T.green : T.orange, borderWidth: 2 }], children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 48, marginBottom: 8 }, children: game.pendingCelebration.isMajor ? "\u{1F3C6}" : game.pendingCelebration.isOnTime ? "\u2705" : "\u2714\uFE0F" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.h2, col, { textAlign: "center", marginBottom: 4 }], children: game.pendingCelebration.isMajor ? "MAJOR CONTRACT COMPLETE!" : "Job Complete!" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.sub, textAlign: "center", marginBottom: 12 }], children: game.pendingCelebration.label }),
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 36, fontWeight: "900", color: T.green, marginBottom: 4 }, children: money2(game.pendingCelebration.earned) }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: [
        "paid by ",
        game.pendingCelebration.client
      ] }),
      game.pendingCelebration.economics && (() => {
        const ec = game.pendingCelebration.economics;
        const profitable = ec.netProfit >= 0;
        const toneColor = { positive: T.green, negative: T.red, neutral: T.text };
        return /* @__PURE__ */ jsxs(View, { style: { width: "100%", backgroundColor: T.panel2, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: T.border }, children: [
          /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.sub, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 }, children: "WHAT THIS JOB MADE" }),
          buildProjectProfitLines(ec, money2).map((line, i) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, flex: 1 }], numberOfLines: 1, children: line.label }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: toneColor[line.tone] || T.text, fontWeight: "700" }], children: line.value })
          ] }, i)),
          /* @__PURE__ */ jsx(View, { style: { height: 1, backgroundColor: T.border, marginVertical: 8 } }),
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: "Net profit" }),
            /* @__PURE__ */ jsxs(Text, { style: { color: profitable ? T.green : T.red, fontSize: 20, fontWeight: "900" }, children: [
              profitable ? "" : "\u2212",
              money2(Math.abs(ec.netProfit))
            ] })
          ] }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 11, marginTop: 2 }], children: [
            ec.marginPercent,
            "% margin",
            ec.depositPaid > 0 ? ` \xB7 ${money2(ec.depositPaid)} of this arrived as the deposit at mobilisation` : ""
          ] }),
          game.pendingCelebration.costsPartial && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.orange, fontSize: 11, marginTop: 6 }], children: "\u26A0 This job was already running before cost tracking started \u2014 the costs above cover only part of it." }),
          game.pendingCelebration.isFirstProject && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 11, marginTop: 8, fontStyle: "italic" }], children: OVERHEAD_NOTE }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.cyan, fontSize: 12, marginTop: 8 }], children: getProjectReinvestmentHint(ec.netProfit) })
          ] })
        ] });
      })(),
      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 12, marginBottom: 16 }, children: [
        game.pendingCelebration.isOnTime && /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.green + "22" }], children: /* @__PURE__ */ jsx(Text, { style: [styles.statusPillText, { color: T.green }], children: "\u2705 On Time" }) }),
        game.pendingCelebration.repGained > 0 && /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.purple + "22" }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.statusPillText, { color: T.purple }], children: [
          "+",
          game.pendingCelebration.repGained,
          " Rep"
        ] }) }),
        game.pendingCelebration.qualityBonus > 0 && /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.cyan + "22" }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.statusPillText, { color: T.cyan }], children: [
          "\u2B50 Quality +",
          money2(game.pendingCelebration.qualityBonus)
        ] }) }),
        game.pendingCelebration.penalty > 0 && /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.red + "22" }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.statusPillText, { color: T.red }], children: [
          "\u26A0 ",
          money2(game.pendingCelebration.penalty),
          " penalty"
        ] }) })
      ] }),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { backgroundColor: T.green, borderColor: T.green, width: "100%" }],
          onPress: () => update((g) => {
            g.pendingCelebration = null;
          }),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#fff" }], children: "Continue" })
        }
      )
    ] }) }) }),
    game.pendingDecision && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "slide", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "flex-end" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, { margin: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: T[game.pendingDecision.tone] || T.border, borderWidth: 2 }], children: [
      /* @__PURE__ */ jsx(Text, { style: [col, { fontSize: 28, textAlign: "center", marginBottom: 8 }], children: game.pendingDecision.title }),
      /* @__PURE__ */ jsx(Text, { style: [styles.body, col, { textAlign: "center", marginBottom: 16 }], children: game.pendingDecision.desc }),
      (game.pendingDecision.options || []).map((opt, i) => /* @__PURE__ */ jsxs(
        TouchableOpacity,
        {
          style: [styles.btn, { marginBottom: 8, backgroundColor: i === 0 ? T[game.pendingDecision.tone] || T.blue : T.panel2, borderColor: i === 0 ? T[game.pendingDecision.tone] || T.blue : T.strongBorder, borderWidth: i === 0 ? 0 : 1.5 }],
          onPress: () => update((g) => {
            const evtDef = DECISION_EVENTS.find((e) => e.id === g.pendingDecision?.id) || EMPLOYEE_EVENTS.find((e) => e.id === g.pendingDecision?.id);
            if (evtDef?.options?.[i]?.apply) evtDef.options[i].apply(g);
            g.pendingDecision = null;
          }),
          children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: i === 0 ? "#000" : T.text, fontWeight: "800" }], children: opt.label }),
            opt.sub && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: i === 0 ? "rgba(0,0,0,0.65)" : T.sub, textAlign: "center", marginTop: 2 }], children: opt.sub })
          ]
        },
        i
      ))
    ] }) }) }),
    game.pendingStory && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "fade", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "center" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, { margin: 28, alignItems: "center", borderColor: T.yellow, borderWidth: 2 }], children: [
      /* @__PURE__ */ jsx(Ionicons, { name: game.pendingStory.icon, size: 52, color: T.yellow, style: { marginBottom: 12 } }),
      /* @__PURE__ */ jsx(Text, { style: [styles.h2, col, { textAlign: "center", marginBottom: 8 }], children: game.pendingStory.title }),
      /* @__PURE__ */ jsx(Text, { style: [styles.body, col, { textAlign: "center", marginBottom: 20 }], children: game.pendingStory.body }),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { backgroundColor: T.yellow, borderColor: T.yellow, width: "100%" }],
          onPress: () => update((g) => {
            g.pendingStory = null;
          }),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#000" }], children: "Noted" })
        }
      )
    ] }) }) }),
    game.pendingBreakdown && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "slide", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "flex-end" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, { margin: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: T.red, borderWidth: 2 }], children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 28, textAlign: "center", marginBottom: 4 }, children: "\u{1F527} Vehicle Breakdown" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { textAlign: "center", marginBottom: 4 }], children: game.pendingBreakdown.equipName }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginBottom: 16 }], children: [
        "Broke down on ",
        game.pendingBreakdown.siteLabel
      ] }),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { marginBottom: 8, backgroundColor: T.green, borderColor: T.green }],
          onPress: () => update((g) => {
            const bd = g.pendingBreakdown;
            const equip = g.equipment.find((e) => e.id === bd.equipId);
            if (equip) {
              g.cash -= bd.repairCost;
              equip.condition = Math.min(100, equip.condition + 40);
              equip.status = "Active";
            }
            addLog2(g, `\u{1F527} ${bd.equipName} repaired for ${money2(bd.repairCost)} \u2014 back online.`);
            g.pendingBreakdown = null;
          }),
          children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: "#000" }], children: [
            "Repair On-Site \u2014 ",
            money2(game.pendingBreakdown.repairCost)
          ] })
        }
      ),
      /* @__PURE__ */ jsxs(
        TouchableOpacity,
        {
          style: [styles.btn, { marginBottom: 8, backgroundColor: T.panel2, borderColor: T.orange, borderWidth: 1.5 }],
          onPress: () => update((g) => {
            const bd = g.pendingBreakdown;
            const equip = g.equipment.find((e) => e.id === bd.equipId);
            if (equip) {
              equip.condition = Math.max(5, equip.condition - 25);
            }
            addLog2(g, `\u26A0\uFE0F ${bd.equipName} pushed through breakdown \u2014 high failure risk.`);
            g.pendingBreakdown = null;
          }),
          children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.text }], children: "Push Through \u2014 Risk further damage" }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }], children: "No cost \xB7 condition \u221225 \xB7 high breakdown risk" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        TouchableOpacity,
        {
          style: [styles.btn, { marginBottom: 8, backgroundColor: T.panel2, borderColor: T.blue, borderWidth: 1.5 }],
          onPress: () => update((g) => {
            const bd = g.pendingBreakdown;
            const equip = g.equipment.find((e) => e.id === bd.equipId);
            if (equip) {
              equip.status = "Maintenance";
              const site = g.activeSites.find((s) => s.id === bd.siteId);
              if (site) site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => id !== bd.equipId);
            }
            addLog2(g, `\u{1F527} ${bd.equipName} pulled for scheduled maintenance \u2014 repair from Vehicles tab.`);
            g.pendingBreakdown = null;
          }),
          children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.text }], children: "Delay Repair \u2014 Pull from site for later" }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }], children: "No cost \xB7 repair later from Vehicles tab" })
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { marginBottom: 4, backgroundColor: T.panel2, borderColor: T.red }],
          onPress: () => update((g) => {
            const bd = g.pendingBreakdown;
            const equip = g.equipment.find((e) => e.id === bd.equipId);
            const scrapValue = equip ? Math.round(equip.price * 0.15 * equip.condition / 100) : 0;
            if (equip) {
              g.cash += scrapValue;
              const site = g.activeSites.find((s) => s.id === bd.siteId);
              if (site) site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => id !== bd.equipId);
              g.equipment = g.equipment.filter((e) => e.id !== bd.equipId);
            }
            addLog2(g, `\u{1F5D1}\uFE0F ${bd.equipName} scrapped \u2014 recovered ${money2(scrapValue)}.`);
            g.pendingBreakdown = null;
          }),
          children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: T.red }], children: [
            "Scrap & Replace \u2014 Recover ",
            money2(Math.round((game.equipment.find((e) => e.id === game.pendingBreakdown.equipId)?.price || 0) * 0.15 * (game.equipment.find((e) => e.id === game.pendingBreakdown.equipId)?.condition || 0) / 100))
          ] })
        }
      )
    ] }) }) }),
    game.pendingInspection && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "fade", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "center" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, {
      margin: 28,
      alignItems: "center",
      borderColor: game.pendingInspection.outcome === "pass" ? T.green : game.pendingInspection.outcome === "minor" ? T.yellow : T.red,
      borderWidth: 2
    }], children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 48, marginBottom: 8 }, children: game.pendingInspection.outcome === "pass" ? "\u2705" : game.pendingInspection.outcome === "minor" ? "\u{1F50D}" : "\u274C" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.h2, col, { textAlign: "center", marginBottom: 4 }], children: game.pendingInspection.outcome === "pass" ? "Inspection Passed!" : game.pendingInspection.outcome === "minor" ? "Minor Corrections Required" : "Major Inspection Failure" }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: T.sub, textAlign: "center", marginBottom: 8 }], children: [
        game.pendingInspection.phaseName,
        " \xB7 ",
        game.pendingInspection.siteLabel
      ] }),
      game.pendingInspection.outcome === "pass" && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, textAlign: "center", marginBottom: 12 }], children: "Work passed all checks. Reputation +2, Credit +1." }),
      game.pendingInspection.outcome === "minor" && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.yellow, textAlign: "center", marginBottom: 12 }], children: [
        "Remediation cost: ",
        money2(game.pendingInspection.penaltyApplied),
        ". Minor setback on next phase."
      ] }),
      game.pendingInspection.outcome === "major" && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red, textAlign: "center", marginBottom: 12 }], children: [
        "Major defects found. Cost: ",
        money2(game.pendingInspection.penaltyApplied),
        ". Site paused. Rep -3."
      ] }),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, {
            backgroundColor: game.pendingInspection.outcome === "pass" ? T.green : game.pendingInspection.outcome === "minor" ? T.yellow : T.red,
            borderColor: "transparent",
            width: "100%"
          }],
          onPress: () => update((g) => {
            g.pendingInspection = null;
          }),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.pendingInspection.outcome === "minor" ? "#000" : "#fff" }], children: game.pendingInspection.outcome === "pass" ? "Excellent!" : "Understood" })
        }
      )
    ] }) }) }),
    game.pendingOfflineSummary && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "fade", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "center", backgroundColor: "rgba(0,0,0,0.82)" }], children: /* @__PURE__ */ jsxs(View, { style: { margin: 16, backgroundColor: T.panel, borderRadius: 20, borderWidth: 2, borderColor: T.strongBorder, overflow: "hidden" }, children: [
      /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.green, paddingVertical: 18, alignItems: "center" }, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 32, marginBottom: 4 }, children: "\u{1F3D7}\uFE0F" }),
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 20, fontWeight: "900", color: "#000" }, children: "While You Were Away" }),
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 13, color: "rgba(0,0,0,0.75)", marginTop: 3 }, children: game.pendingOfflineSummary.elapsedDays > 0 ? `${game.pendingOfflineSummary.elapsedDays} game day${game.pendingOfflineSummary.elapsedDays !== 1 ? "s" : ""} of work continued` : "A short while passed" })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: { padding: 16 }, children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginBottom: 8 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: game.pendingOfflineSummary.cashDelta >= 0 ? T.green : T.red }, children: [
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }, children: "NET CASH" }),
            /* @__PURE__ */ jsxs(Text, { style: { fontSize: 19, fontWeight: "800", color: game.pendingOfflineSummary.cashDelta >= 0 ? T.green : T.red }, children: [
              game.pendingOfflineSummary.cashDelta >= 0 ? "+" : "",
              money2(game.pendingOfflineSummary.cashDelta)
            ] })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: T.cyan }, children: [
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }, children: "CASH NOW" }),
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 19, fontWeight: "800", color: game.pendingOfflineSummary.cashNow >= 0 ? T.cyan : T.red }, children: money2(game.pendingOfflineSummary.cashNow) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginBottom: 12 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.orange }, children: [
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }, children: "JOBS DONE" }),
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 19, fontWeight: "800", color: T.orange }, children: game.pendingOfflineSummary.jobsDelta })
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.purple }, children: [
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }, children: "REP" }),
            /* @__PURE__ */ jsxs(Text, { style: { fontSize: 19, fontWeight: "800", color: T.purple }, children: [
              game.pendingOfflineSummary.repDelta >= 0 ? "+" : "",
              game.pendingOfflineSummary.repDelta
            ] })
          ] }),
          (game.pendingOfflineSummary.overheadPerDay || 0) > 0 && /* @__PURE__ */ jsxs(View, { style: { flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.red }, children: [
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }, children: "BURN/DAY" }),
            /* @__PURE__ */ jsx(Text, { style: { fontSize: 15, fontWeight: "800", color: T.red }, children: money2(game.pendingOfflineSummary.overheadPerDay) })
          ] })
        ] }),
        (game.pendingOfflineSummary.logsWhileAway || []).length > 0 && /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.panel2, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: T.border }, children: [
          /* @__PURE__ */ jsx(Text, { style: { fontSize: 11, color: T.sub, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 }, children: "WHAT HAPPENED" }),
          (game.pendingOfflineSummary.logsWhileAway || []).map((entry, i) => /* @__PURE__ */ jsx(Text, { style: { fontSize: 12, color: T.text, lineHeight: 18, marginBottom: 3 }, children: entry }, i))
        ] }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: { backgroundColor: T.green, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
            onPress: () => update((g) => {
              g.pendingOfflineSummary = null;
            }),
            children: /* @__PURE__ */ jsx(Text, { style: { fontSize: 16, fontWeight: "900", color: "#000", letterSpacing: 0.5 }, children: "Get Back to Work \u2192" })
          }
        )
      ] })
    ] }) }) }),
    game.pendingCeremony && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "fade", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "center" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, { margin: 20, alignItems: "center", borderColor: T.yellow, borderWidth: 3 }], children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 56, marginBottom: 10 }, children: "\u{1F3C6}" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.h2, { color: T.yellow, textAlign: "center", marginBottom: 6 }], children: "LANDMARK PROJECT COMPLETE!" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { textAlign: "center", marginBottom: 4 }], children: game.pendingCeremony.label }),
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 32, fontWeight: "900", color: T.green, marginBottom: 4 }, children: money2(game.pendingCeremony.revenue) }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginBottom: 12 }], children: [
        "Day ",
        game.pendingCeremony.day,
        " \xB7 ",
        game.pendingCeremony.crewCount,
        " crew \xB7 ",
        game.pendingCeremony.equipmentCount,
        " equipment"
      ] }),
      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }, children: [
        /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.yellow + "22" }], children: /* @__PURE__ */ jsxs(Text, { style: [styles.statusPillText, { color: T.yellow }], children: [
          "+",
          game.pendingCeremony.repGained,
          " Reputation"
        ] }) }),
        /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.purple + "22" }], children: /* @__PURE__ */ jsx(Text, { style: [styles.statusPillText, { color: T.purple }], children: "Major Milestone" }) })
      ] }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginBottom: 16, fontStyle: "italic" }], children: [
        "A defining moment for ",
        game.companyName,
        ". This project will be remembered."
      ] }),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { backgroundColor: T.yellow, borderColor: T.yellow, width: "100%" }],
          onPress: () => update((g) => {
            g.pendingCeremony = null;
          }),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#000", fontWeight: "900" }], children: "Accept the Award" })
        }
      )
    ] }) }) }),
    game.pendingVeteranEvent && /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "slide", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "flex-end" }], children: /* @__PURE__ */ jsxs(View, { style: [styles.modalCard, { margin: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: T.yellow, borderWidth: 2 }], children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 28, textAlign: "center", marginBottom: 8 }, children: "\u2B50 Veteran Recognition" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { textAlign: "center", marginBottom: 4 }], children: game.pendingVeteranEvent.workerName }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginBottom: 12 }], children: [
        game.pendingVeteranEvent.jobsCompleted,
        " jobs completed \xB7 Skill ",
        game.pendingVeteranEvent.skill
      ] }),
      /* @__PURE__ */ jsx(Text, { style: [styles.body, col, { textAlign: "center", marginBottom: 16 }], children: "One of your most experienced builders. How do you recognize their contribution?" }),
      (() => {
        const _canAfford = game.cash >= game.pendingVeteranEvent.retainCost;
        return /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginBottom: 8, backgroundColor: _canAfford ? T.green : T.panel2, borderColor: _canAfford ? T.green : T.border, opacity: _canAfford ? 1 : 0.55 }],
            onPress: () => {
              const ev = game.pendingVeteranEvent;
              if (!_canAfford) {
                Alert.alert("Insufficient Funds", `You need ${money2(ev.retainCost)} to pay this bonus.`);
                return;
              }
              update((g) => {
                const _ev = g.pendingVeteranEvent;
                const w = (g.crew || []).find((c) => c.id === _ev.workerId);
                if (w) {
                  g.cash -= _ev.retainCost;
                  g.expenses += _ev.retainCost;
                  w.loyalty = Math.min(100, (w.loyalty ?? 50) + 20);
                  w.wagePerDay = Math.round(w.wagePerDay * 1.08);
                  w.skill = Math.min(150, (w.skill || 75) + 5);
                  addLog2(g, `\u2B50 Retention bonus paid to ${w.name} \u2014 ${money2(_ev.retainCost)}. Loyalty +20, skill +5.`);
                  addImportantNotice(g, `${w.name} is staying! Loyalty cemented.`, "green");
                }
                g.pendingVeteranEvent = null;
              });
            },
            children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: _canAfford ? "#fff" : T.sub }], children: [
              "Pay Retention Bonus \u2014 ",
              money2(game.pendingVeteranEvent.retainCost)
            ] })
          }
        );
      })(),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { marginBottom: 8, backgroundColor: T.cyan, borderColor: T.cyan }],
          onPress: () => update((g) => {
            const ev = g.pendingVeteranEvent;
            const w = (g.crew || []).find((c) => c.id === ev.workerId);
            if (w) {
              w.careerLevel = "super";
              w.loyalty = Math.min(100, (w.loyalty ?? 50) + 15);
              w.wagePerDay = Math.round(w.wagePerDay * 1.12);
              addLog2(g, `\u{1F4CB} ${w.name} promoted to Field Superintendent. +12% wage, loyalty +15.`);
              addImportantNotice(g, `${w.name} is now a Field Superintendent!`, "green");
            }
            g.pendingVeteranEvent = null;
          }),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#fff" }], children: "Promote to Field Superintendent (+12% wage)" })
        }
      ),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { borderColor: T.sub }],
          onPress: () => update((g) => {
            const ev = g.pendingVeteranEvent;
            const w = (g.crew || []).find((c) => c.id === ev.workerId);
            if (w) {
              g.reputation = (g.reputation || 0) + 3;
              g.cash += 500;
              g.revenue += 500;
              g.crew = g.crew.filter((c) => c.id !== ev.workerId);
              addLog2(g, `\u{1F44B} ${w.name} departed gracefully. +3 rep, +$500 referral.`);
            }
            g.pendingVeteranEvent = null;
          }),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.sub }], children: "Graceful Farewell (+3 rep, +$500 referral)" })
        }
      )
    ] }) }) }),
    game._pendingPrestige && (() => {
      const [_chosen, _setChosen] = [null, () => {
      }];
      const _shuffled = [...LEGACY_PERKS].sort(() => Math.random() - 0.5).slice(0, 3);
      const bestWorker = [...game.crew || []].sort((a, b) => (b.skill || 0) - (a.skill || 0))[0];
      return /* @__PURE__ */ jsx(Modal, { transparent: true, animationType: "fade", visible: true, children: /* @__PURE__ */ jsx(View, { style: [styles.modalOverlay, { justifyContent: "center" }], children: /* @__PURE__ */ jsx(View, { style: [styles.modalCard, { borderColor: T.yellow, borderWidth: 2, maxHeight: "90%" }], children: /* @__PURE__ */ jsxs(ScrollView, { showsVerticalScrollIndicator: false, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 36, textAlign: "center", marginBottom: 4 }, children: "\u{1F451}" }),
        /* @__PURE__ */ jsx(Text, { style: { color: T.yellow, fontWeight: "900", fontSize: 20, textAlign: "center", marginBottom: 4 }, children: "DYNASTY COMPLETE" }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.text, textAlign: "center", marginBottom: 16 }], children: [
          "You built the #1 construction empire in America \u2014 debt-free, Generation ",
          game.generation || 1,
          "."
        ] }),
        /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.panel2, borderRadius: 8, padding: 10, marginBottom: 16 }, children: [
          { label: "Days Played", val: `Day ${game.day}` },
          { label: "Total Revenue", val: money2(game.revenue || 0) },
          { label: "Jobs Completed", val: `${game.completedJobs || 0}` },
          { label: "Best Worker", val: bestWorker ? `${bestWorker.name} (Skill ${bestWorker.skill || 75})` : "\u2014" },
          { label: "Rivals Acquired", val: `${(game.acquiredRivals || []).length}` }
        ].map((r) => /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub }], children: r.label }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.text, fontWeight: "700" }], children: r.val })
        ] }, r.label)) }),
        /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { textAlign: "center", marginBottom: 10 }], children: "Choose your Legacy Perk" }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginBottom: 12 }], children: [
          "This bonus carries into Generation ",
          (game.generation || 1) + 1,
          " and stacks with each new dynasty."
        ] }),
        _shuffled.map((perk) => /* @__PURE__ */ jsxs(
          TouchableOpacity,
          {
            style: [styles.btn, { marginBottom: 8, backgroundColor: T.panel2, borderColor: T.yellow, borderWidth: 1 }],
            onPress: () => {
              const next = startNewGeneration(game, perk.id);
              saveGame(next);
              setGame(next);
            },
            children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.yellow }], children: perk.label }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }], children: perk.desc })
            ]
          },
          perk.id
        )),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: { paddingVertical: 12, alignItems: "center" },
            onPress: () => update((g) => {
              g._pendingPrestige = false;
              g.hallOfFame.prestigeReached = g.day;
            }),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub }], children: "Keep playing this save instead \u2192" })
          }
        )
      ] }) }) }) });
    })(),
    /* @__PURE__ */ jsxs(View, { style: { flex: 1, paddingBottom: Platform.select({ ios: 88, android: 76, default: 70 }) }, children: [
      tab === "Home" && renderHome(),
      tab === "Bids" && renderBids(),
      tab === "Sites" && renderSites(),
      tab === "Crew" && renderCrew(),
      tab === "Vehicles" && renderEquipment(),
      tab === "Finance" && renderFinance(),
      tab === "Empire" && renderEmpire()
    ] }),
    /* @__PURE__ */ jsx(View, { style: [styles.tabBar, { backgroundColor: T.tabBar, borderColor: T.border }], children: TABS.map((t) => {
      const active = tab === t;
      const badgeVal = {
        Bids: getOpenContracts(game).length,
        Crew: game.applicants.length,
        Vehicles: (game.equipment || []).filter((e) => e.condition < 40 || e.status === "Maintenance").length || 0,
        Finance: (game.taxDue || 0) > 0 ? "!" : 0,
        Empire: (game.empireGoalsCompleted || []).length < EMPIRE_GOALS.length && EMPIRE_GOALS.some((g2) => !(game.empireGoalsCompleted || []).includes(g2.id) && (() => {
          try {
            return g2.check(game);
          } catch (_) {
            return false;
          }
        })()) ? "!" : 0
      }[t];
      const TAB_ICONS = {
        Home: { active: "home", inactive: "home-outline" },
        Bids: { active: "document-text", inactive: "document-text-outline" },
        Sites: { active: "construct", inactive: "construct-outline" },
        Crew: { active: "people", inactive: "people-outline" },
        Vehicles: { active: "car", inactive: "car-outline" },
        Finance: { active: "wallet", inactive: "wallet-outline" },
        Empire: { active: "trophy", inactive: "trophy-outline" }
      };
      const iconName = active ? TAB_ICONS[t]?.active : TAB_ICONS[t]?.inactive;
      return /* @__PURE__ */ jsxs(TouchableOpacity, { style: styles.tabItem, onPress: () => setTab(t), activeOpacity: 0.75, children: [
        !!badgeVal && /* @__PURE__ */ jsx(View, { style: [styles.badge, { backgroundColor: t === "Finance" ? T.red : T.orange }], children: /* @__PURE__ */ jsx(Text, { style: styles.badgeText, children: badgeVal }) }),
        /* @__PURE__ */ jsx(Ionicons, { name: iconName, size: 20, color: active ? T.green : T.sub }),
        /* @__PURE__ */ jsx(Text, { style: [styles.tabLabel, { color: active ? T.text : T.sub, fontWeight: active ? "700" : "500" }], children: t }),
        active ? /* @__PURE__ */ jsx(View, { style: [styles.tabDot, { backgroundColor: T.green }] }) : /* @__PURE__ */ jsx(View, { style: [styles.tabDot, { backgroundColor: "transparent" }] })
      ] }, t);
    }) })
  ] });
}
var CONTRACT_CATEGORIES = ["All", "Residential", "Commercial", "Infrastructure", "Government", "Mega"];
function BidsScreen({ game, T, col, subCol, openContracts, allOpenCount, categoryFilter, onSetFilter, idleCrew, idleEquip, onStartSite, onBuyMaterials, onSetBidStyle }) {
  const [selectedContract, setSelectedContract] = useState(null);
  const [selectedCrewIds, setSelectedCrewIds] = useState([]);
  const [selectedEquipIds, setSelectedEquipIds] = useState([]);
  const [materialModal, setMaterialModal] = useState(null);
  const [buyQty, setBuyQty] = useState("10");
  const contract = selectedContract ? (game.contracts || []).find((c) => c.id === selectedContract) : null;
  const blockReason = contract ? getAssignBlockReason(contract, selectedCrewIds, selectedEquipIds, game) : null;
  function toggleCrew(id) {
    setSelectedCrewIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleEquip(id) {
    setSelectedEquipIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function handleConfirm() {
    if (!contract) return;
    if (blockReason) {
      Alert.alert("Cannot Start Site", blockReason);
      return;
    }
    const _cdef = CONTRACT_DEFS.find((d) => d.id === contract.defId);
    const _requiredMats = Object.entries(_cdef?.materials || {});
    const _shortMats = _requiredMats.filter(([matId, needed]) => (game.materials?.[matId] || 0) < needed);
    if (_shortMats.length > 0) {
      const _matDesc = _shortMats.map(([matId, needed]) => `${matId}: need ${needed}, have ${game.materials?.[matId] || 0}`).join("\n");
      Alert.alert(
        "Missing Materials",
        `This site needs materials you don't have:

${_matDesc}

The site will stall when it starts. You can buy them in the Sites tab. Start anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Anyway", onPress: () => {
            onStartSite(contract, selectedCrewIds, selectedEquipIds);
            setSelectedContract(null);
            setSelectedCrewIds([]);
            setSelectedEquipIds([]);
          } }
        ]
      );
      return;
    }
    onStartSite(contract, selectedCrewIds, selectedEquipIds);
    setSelectedContract(null);
    setSelectedCrewIds([]);
    setSelectedEquipIds([]);
  }
  function openBuyModal(matId) {
    const needed = contract?.materials?.[matId] || 0;
    const have = game.materials[matId] || 0;
    setMaterialModal({ matId, needed, have });
    setBuyQty(String(Math.max(1, needed - have)));
  }
  const riskColors = ["", T.green, T.cyan, T.yellow, T.orange, T.red];
  return /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
    /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 14, paddingBottom: 120 }, children: [
      /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col], children: [
        openContracts.length,
        "/",
        allOpenCount,
        " Contract",
        allOpenCount !== 1 ? "s" : ""
      ] }) }),
      /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 10 }, children: CONTRACT_CATEGORIES.map((cat) => /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.chip, { marginRight: 6, color: categoryFilter === cat ? "#fff" : T.sub, borderColor: categoryFilter === cat ? T.orange : T.border, backgroundColor: categoryFilter === cat ? T.orange : T.panel2, paddingVertical: 5, paddingHorizontal: 10 }],
          onPress: () => onSetFilter(cat),
          children: /* @__PURE__ */ jsx(Text, { style: { color: categoryFilter === cat ? "#fff" : T.sub, fontSize: 12, fontWeight: "600" }, children: cat })
        },
        cat
      )) }),
      openContracts.length === 0 && /* @__PURE__ */ jsxs(View, { style: { alignItems: "center", padding: 24 }, children: [
        /* @__PURE__ */ jsx(Text, { style: { fontSize: 32, marginBottom: 8 }, children: "\u{1F4CB}" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.sub, textAlign: "center", marginBottom: 6 }], children: categoryFilter !== "All" ? `No ${categoryFilter} contracts right now` : "No contracts available" }),
        /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { textAlign: "center" }], children: "New contracts arrive daily. Come back tomorrow or improve your reputation for better offers." })
      ] }),
      openContracts.map((c) => {
        const isSelected = selectedContract === c.id;
        const def = CONTRACT_DEFS.find((d) => d.id === c.defId);
        return /* @__PURE__ */ jsxs(
          TouchableOpacity,
          {
            style: [styles.card, {
              backgroundColor: T.panel,
              borderColor: isSelected ? T.orange : T.border,
              borderWidth: isSelected ? 2 : 1
            }],
            onPress: () => {
              setSelectedContract(isSelected ? null : c.id);
              setSelectedCrewIds([]);
              setSelectedEquipIds([]);
            },
            activeOpacity: 0.8,
            children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flex: 1, marginRight: 8 }, children: [
                  /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }, children: [
                    /* @__PURE__ */ jsx(Text, { style: [styles.label, col], numberOfLines: 1, children: c.label }),
                    /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, color: T.purple, borderWidth: 1, borderColor: T.purple, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }, children: c.category || "Commercial" })
                  ] }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                    c.client,
                    (() => {
                      const bidCity = CITIES.find((ct) => ct.id === (c.cityId || "salem"));
                      const isHome = (c.cityId || "salem") === (game.startingCityId || "salem");
                      return bidCity ? ` \xB7 ${bidCity.name}${isHome ? " \u{1F3E0}" : ""}` : "";
                    })()
                  ] }),
                  /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 2, marginTop: 4 }, children: c.phases.map((ph, i) => {
                    const pv = PHASE_VISUALS[ph] || { emoji: "\u{1F3D7}\uFE0F" };
                    return /* @__PURE__ */ jsx(Text, { style: { fontSize: 12 }, children: pv.emoji }, i);
                  }) })
                ] }),
                /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.green }], children: money2(c.value) }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub }], children: [
                    money2(Math.round(c.value / Math.max(1, c.durationDays))),
                    "/day"
                  ] }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: riskColors[c.risk] || T.sub }], children: [
                    "Risk: ",
                    "\u25CF".repeat(c.risk),
                    "\u25CB".repeat(5 - c.risk)
                  ] })
                ] })
              ] }),
              c.isWeeklyRush && /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.yellow + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6, borderWidth: 1, borderColor: T.yellow }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.yellow, fontWeight: "700", fontSize: 10 }], children: [
                "\u26A1 WEEKEND RUSH \u2014 2\xD7 Pay \xB7 Expires Day ",
                c.expiresDay
              ] }) }),
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }, children: [
                /* @__PURE__ */ jsxs(Text, { style: [styles.chip, { color: T.blue, borderColor: T.blue }], children: [
                  "\u{1F477} Min ",
                  c.crewMin
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.chip, { color: T.orange, borderColor: T.orange }], children: [
                  "\u{1F69C} Tier ",
                  c.minTier,
                  "+"
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.chip, { color: T.purple, borderColor: T.purple }], children: [
                  c.durationDays,
                  "d target"
                ] }),
                def?.repReward > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.chip, { color: T.cyan, borderColor: T.cyan }], children: [
                  "+",
                  def.repReward,
                  " rep"
                ] }),
                c.isChainUnlock && /* @__PURE__ */ jsx(Text, { style: [styles.chip, { color: T.yellow, borderColor: T.yellow, fontWeight: "700" }], children: "\u{1F513} Chain Unlock" })
              ] }),
              c.interestedRival && c.status === "Open" && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red, fontSize: 10, marginTop: 3, fontWeight: "600" }], children: [
                "\u{1F525} ",
                c.interestedRival,
                " is also bidding \u2014 don't wait"
              ] }),
              (() => {
                const daysLeft = (c.expiresDay || 0) - (game.day || 0);
                if (daysLeft > 7) return null;
                const color = daysLeft <= 2 ? T.red : daysLeft <= 4 ? T.orange : T.yellow;
                const pct = Math.max(0, Math.round(daysLeft / 7 * 100));
                return /* @__PURE__ */ jsxs(View, { style: { marginTop: 4 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color, fontWeight: daysLeft <= 2 ? "700" : "400" }], children: daysLeft <= 0 ? "\u26A0 Expires today" : daysLeft === 1 ? "\u23F1 Expires tomorrow" : `\u23F1 Expires in ${daysLeft} days` }),
                  /* @__PURE__ */ jsx(View, { style: { height: 2, backgroundColor: T.track, borderRadius: 1, marginTop: 3 }, children: /* @__PURE__ */ jsx(View, { style: { height: 2, width: `${pct}%`, backgroundColor: color, borderRadius: 1 } }) })
                ] });
              })(),
              c.isChainUnlock && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.yellow, marginTop: 4, fontStyle: "italic" }], children: "Unlocked by completing a previous contract \u2014 limited time offer." }),
              isSelected && /* @__PURE__ */ jsxs(View, { style: { marginTop: 14 }, children: [
                /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: c.desc }),
                (() => {
                  const estMatCost = Object.entries(c.materials || {}).reduce((s, [matId, qty]) => {
                    const price = game.materialPrices[matId] || MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice || 100;
                    return s + qty * price;
                  }, 0);
                  const estLaborCost = (c.crewMin || 1) * 220 * (c.durationDays || 1);
                  const estProfit = c.value - estMatCost - estLaborCost;
                  const bidStyle = (game.contractBidStyles || {})[c.id] || "standard";
                  const BID_MULT = { aggressive: 0.82, standard: 1, premium: 1.28 };
                  const effectiveValue = Math.round(c.value * (BID_MULT[bidStyle] ?? 1));
                  return /* @__PURE__ */ jsxs(View, { style: { backgroundColor: T.panel2, borderRadius: 8, padding: 10, marginBottom: 10 }, children: [
                    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Contract value" }),
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.green, fontWeight: "700" }], children: money2(effectiveValue) })
                    ] }),
                    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Est. material cost" }),
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.orange }], children: money2(estMatCost) })
                    ] }),
                    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Est. labor cost" }),
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.orange }], children: money2(estLaborCost) })
                    ] }),
                    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }, children: [
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.text, fontWeight: "700" }], children: "Est. profit" }),
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: estProfit >= 0 ? T.cyan : T.red, fontWeight: "700" }], children: money2(estProfit) })
                    ] }),
                    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 }, children: [
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: "Deadline penalty" }),
                      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
                        money2(c.penaltyPerDay),
                        "/day late"
                      ] })
                    ] }),
                    estProfit > 0 && (() => {
                      const marginPct = Math.round(estProfit / Math.max(1, effectiveValue) * 100);
                      const barColor = marginPct >= 30 ? T.green : marginPct >= 15 ? T.cyan : T.orange;
                      return /* @__PURE__ */ jsxs(View, { style: { marginTop: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }, children: [
                        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }, children: [
                          /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 10 }], children: "Profit margin" }),
                          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: barColor, fontSize: 10, fontWeight: "600" }], children: [
                            marginPct,
                            "%"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx(View, { style: { height: 4, backgroundColor: T.track, borderRadius: 2 }, children: /* @__PURE__ */ jsx(View, { style: { height: 4, width: `${Math.min(100, marginPct * 2)}%`, backgroundColor: barColor, borderRadius: 2 } }) })
                      ] });
                    })()
                  ] });
                })(),
                Object.keys(c.materials || {}).length > 0 && /* @__PURE__ */ jsxs(View, { style: { marginBottom: 10 }, children: [
                  /* @__PURE__ */ jsx(Text, { style: [styles.label, col, { marginBottom: 4 }], children: "Materials Needed" }),
                  Object.entries(c.materials).map(([matId, needed]) => {
                    const have = game.materials[matId] || 0;
                    const mat = MATERIAL_DEFS.find((m) => m.id === matId);
                    const ok = have >= needed;
                    return /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }, children: [
                      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 3 }, children: [
                        mat?.icon && /* @__PURE__ */ jsx(Ionicons, { name: mat.icon, size: 11, color: ok ? T.green : T.red }),
                        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: ok ? T.green : T.red }], children: [
                          mat?.label,
                          ": ",
                          have,
                          "/",
                          needed,
                          " ",
                          mat?.unit
                        ] })
                      ] }),
                      !ok && /* @__PURE__ */ jsx(
                        TouchableOpacity,
                        {
                          style: [styles.smallBtn, { backgroundColor: T.orange }],
                          onPress: () => openBuyModal(matId),
                          children: /* @__PURE__ */ jsx(Text, { style: styles.smallBtnText, children: "Buy" })
                        }
                      )
                    ] }, matId);
                  })
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.label, col, { marginBottom: 4 }], children: [
                  "Assign Crew (",
                  selectedCrewIds.length,
                  " selected, need ",
                  c.crewMin,
                  ")"
                ] }),
                idleCrew.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.orange }], children: "No idle crew available \u2014 hire more in the Crew tab." }),
                idleCrew.map((w) => {
                  const sel = selectedCrewIds.includes(w.id);
                  return /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: [styles.rowItem, { backgroundColor: sel ? T.panel3 : T.panel2, borderColor: sel ? T.orange : T.border }],
                      onPress: () => toggleCrew(w.id),
                      children: [
                        /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 4 }, children: [
                            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], numberOfLines: 1, children: w.name }),
                            (w.certifications || []).length > 0 && /* @__PURE__ */ jsx(Text, { style: { fontSize: 12 }, children: "\u{1F393}" })
                          ] }),
                          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                            w.role,
                            " \xB7 Skill ",
                            w.skill,
                            " \xB7 ",
                            w.trait.label
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx(View, { style: [styles.selDot, { backgroundColor: sel ? T.orange : T.border }] })
                      ]
                    },
                    w.id
                  );
                }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.label, col, { marginTop: 12, marginBottom: 4 }], children: [
                  "Assign Equipment (",
                  selectedEquipIds.length,
                  " selected, need ",
                  c.equipMin,
                  ")"
                ] }),
                idleEquip.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.orange }], children: "No idle vehicles \u2014 buy machines in the Vehicles tab." }),
                idleEquip.map((e) => {
                  const sel = selectedEquipIds.includes(e.id);
                  const tierOk = e.tier >= c.minTier;
                  return /* @__PURE__ */ jsxs(
                    TouchableOpacity,
                    {
                      style: [styles.rowItem, { backgroundColor: sel ? T.panel3 : T.panel2, borderColor: sel ? T.orange : tierOk ? T.border : T.red, opacity: tierOk ? 1 : 0.6 }],
                      onPress: () => tierOk && toggleEquip(e.id),
                      children: [
                        /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
                          /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: e.name }),
                          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                            "Tier ",
                            e.tier,
                            " \xB7 Cond ",
                            Math.round(e.condition),
                            "%"
                          ] }),
                          !tierOk && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.red }], children: [
                            "Needs Tier ",
                            c.minTier,
                            "+"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsx(View, { style: [styles.selDot, { backgroundColor: sel ? T.orange : T.border }] })
                      ]
                    },
                    e.id
                  );
                }),
                (() => {
                  const BID_OPTIONS = [
                    { key: "aggressive", label: "Aggressive", sub: "\u221218% value, fast close", multiplier: 0.82, color: T.orange },
                    { key: "standard", label: "Standard", sub: "Market rate", multiplier: 1, color: T.blue },
                    { key: "premium", label: "Premium", sub: "+28% value, higher bar", multiplier: 1.28, color: T.green }
                  ];
                  const bidStyle = (game.contractBidStyles || {})[c.id] || "standard";
                  const activeMultiplier = BID_OPTIONS.find((o) => o.key === bidStyle)?.multiplier ?? 1;
                  return /* @__PURE__ */ jsxs(View, { style: { marginTop: 10 }, children: [
                    /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, marginBottom: 6, fontSize: 11 }], children: "Bid Strategy" }),
                    /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", gap: 6, marginBottom: 8 }, children: BID_OPTIONS.map((opt) => {
                      const active = bidStyle === opt.key;
                      return /* @__PURE__ */ jsxs(TouchableOpacity, { onPress: () => onSetBidStyle(c.id, opt.key), style: { flex: 1, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 7, borderWidth: 1.5, borderColor: opt.color, backgroundColor: active ? opt.color + "33" : "transparent", alignItems: "center" }, children: [
                        /* @__PURE__ */ jsx(Text, { style: { fontWeight: "bold", fontSize: 12, color: active ? opt.color : T.sub }, children: opt.label }),
                        /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: active ? opt.color : T.border, textAlign: "center", marginTop: 1 }, children: opt.sub })
                      ] }, opt.key);
                    }) }),
                    /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", backgroundColor: T.panel2, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 }, children: [
                      /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.sub, fontSize: 12 }], children: "Effective Value" }),
                      /* @__PURE__ */ jsx(Text, { style: { color: T.text, fontWeight: "bold", fontSize: 12 }, children: `$${Math.round(c.value * activeMultiplier).toLocaleString()}` })
                    ] })
                  ] });
                })(),
                /* @__PURE__ */ jsx(
                  TouchableOpacity,
                  {
                    style: [styles.btn, { marginTop: 14, backgroundColor: !blockReason ? T.green : T.panel2, borderColor: !blockReason ? T.green : T.border }],
                    onPress: handleConfirm,
                    children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: !blockReason ? "#fff" : T.sub }], children: blockReason || "\u2705 Mobilise & Start Site" })
                  }
                )
              ] })
            ]
          },
          c.id
        );
      }),
      getActiveSites(game).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Active Sites" }),
        getActiveSites(game).map((site) => {
          const pct = (site.currentPhaseIdx / site.phases.length + site.phaseProgress / 100 / site.phases.length) * 100;
          return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.label, col], numberOfLines: 1, children: site.label }),
              /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: site.status === "Paused" ? T.orange : T.cyan }], children: site.status === "Paused" ? "\u23F8 Paused" : site.phases[site.currentPhaseIdx] || "Done" })
            ] }),
            /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 6 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.round(pct)}%`, backgroundColor: T.green }] }) }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              Math.round(pct),
              "% \xB7 ",
              site.assignedCrewIds.length,
              " crew \xB7 Deadline Day ",
              site.deadlineDay
            ] }),
            site.chaosHistory?.slice(0, 2).map((e, i) => /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange, marginTop: 2 }], children: [
              "\u26A0 ",
              e.text
            ] }, i))
          ] }, site.id);
        })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Modal, { visible: !!materialModal, transparent: true, animationType: "slide", onRequestClose: () => setMaterialModal(null), children: /* @__PURE__ */ jsx(View, { style: styles.modalOverlay, children: /* @__PURE__ */ jsx(View, { style: [styles.modalCard, { backgroundColor: T.panel, borderColor: T.border }], children: materialModal && (() => {
      const mat = MATERIAL_DEFS.find((m) => m.id === materialModal.matId);
      const price = game.materialPrices[materialModal.matId] || mat?.basePrice || 100;
      const qty = parseInt(buyQty) || 0;
      const total = price * qty;
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }, children: [
          mat?.icon && /* @__PURE__ */ jsx(Ionicons, { name: mat.icon, size: 20, color: T.text }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.h2, col], children: [
            "Buy ",
            mat?.label
          ] })
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          "Current stock: ",
          materialModal.have,
          " ",
          mat?.unit
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          "Market price: ",
          money2(price),
          "/",
          mat?.unit
        ] }),
        /* @__PURE__ */ jsx(
          TextInput,
          {
            style: [styles.input, { color: T.text, borderColor: T.border, backgroundColor: T.panel2, marginTop: 12 }],
            value: buyQty,
            onChangeText: setBuyQty,
            keyboardType: "numeric",
            placeholder: "Quantity",
            placeholderTextColor: T.sub
          }
        ),
        /* @__PURE__ */ jsxs(Text, { style: [styles.label, { color: T.green, marginTop: 8 }], children: [
          "Total: ",
          money2(total)
        ] }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", gap: 10, marginTop: 14 }, children: [
          /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { flex: 1, borderColor: T.border }], onPress: () => setMaterialModal(null), children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, col], children: "Cancel" }) }),
          /* @__PURE__ */ jsx(
            TouchableOpacity,
            {
              style: [styles.btn, { flex: 1, backgroundColor: game.cash >= total ? T.green : T.panel2, borderColor: T.green }],
              onPress: () => {
                onBuyMaterials(materialModal.matId, qty);
                setMaterialModal(null);
              },
              children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.cash >= total ? "#fff" : T.red }], children: "Buy" })
            }
          )
        ] })
      ] });
    })() }) }) })
  ] });
}
function CrewScreen({ game, T, col, subCol, onHire, onFire, onPostJob, onHireSubcontractor, onHirePM, onFirePM, onTrain, onPromote, onRaiseWage, onLowerWage, onGiveBonus, onRest, onRestAllTired, onBuyLunch }) {
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const office = OFFICES[game.officeIndex || 0];
  const moodColor = (v) => v >= 70 ? T.green : v >= 45 ? T.yellow : T.red;
  return /* @__PURE__ */ jsxs(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 14, paddingBottom: 100 }, children: [
    /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginBottom: 8 }], children: "Post Job Ads" }),
    JOB_POSTINGS.map((posting) => /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
      /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: posting.label }),
        /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.orange }], children: money2(posting.cost) })
      ] }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: posting.desc }),
      /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
        "Adds ",
        posting.count,
        " candidate(s) \xB7 Skill ",
        posting.skillMin,
        "\u2013",
        posting.skillMax
      ] }),
      /* @__PURE__ */ jsx(
        TouchableOpacity,
        {
          style: [styles.btn, { marginTop: 8, backgroundColor: game.cash >= posting.cost ? T.blue : T.panel2, borderColor: T.blue }],
          onPress: () => onPostJob(posting),
          children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: game.cash >= posting.cost ? "#fff" : T.sub }], children: "Post Ad" })
        }
      )
    ] }, posting.id)),
    game.applicants.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { textAlign: "center", padding: 16, fontStyle: "italic" }], children: "Post a job to attract applicants." }),
    game.applicants.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 6 }], children: [
        "Applicants (",
        game.applicants.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { marginBottom: 8 }, children: ["All", ...CREW_SPECIALTIES].map((spec) => /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.chip, { marginRight: 6, borderColor: specialtyFilter === spec ? T.purple : T.border }], onPress: () => setSpecialtyFilter(spec), children: /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: specialtyFilter === spec ? T.purple : T.sub, fontWeight: specialtyFilter === spec ? "700" : "400" }], children: spec }) }, spec)) }),
      game.applicants.filter((a) => specialtyFilter === "All" || (a.specialty || "General") === specialtyFilter).map((a) => /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], numberOfLines: 1, children: a.name }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              a.role,
              " \xB7 ",
              a.trait.label
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              "Skill ",
              a.skill,
              " \xB7 ",
              money2(a.desiredWage),
              "/day"
            ] }),
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }, children: [
              /* @__PURE__ */ jsx(Text, { style: [styles.chip, { color: T.purple, borderColor: T.purple }], children: a.specialty || "General" }),
              a.quality && /* @__PURE__ */ jsx(Text, { style: [styles.chip, { color: T.yellow, borderColor: T.yellow }], children: a.quality })
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: { alignItems: "flex-end", marginLeft: 8 }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
            "Signing: ",
            money2(a.signingBonus)
          ] }) })
        ] }),
        /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 8, backgroundColor: T.green, borderColor: T.green }],
            onPress: () => onHire(a),
            disabled: game.crew.length >= office.crewCap,
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: "#fff" }], children: game.crew.length >= office.crewCap ? "Crew Cap Reached" : `Hire \u2014 ${money2(a.signingBonus)} signing bonus` })
          }
        )
      ] }, a.id))
    ] }),
    /* @__PURE__ */ jsxs(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: [
      "Crew (",
      game.crew.length,
      "/",
      office.crewCap,
      ")"
    ] }),
    game.crew.some((w) => (w.stamina ?? 50) < 40) && /* @__PURE__ */ jsx(
      TouchableOpacity,
      {
        style: [styles.btn, { marginBottom: 10, backgroundColor: T.cyan + "22", borderColor: T.cyan }],
        onPress: () => onRestAllTired && onRestAllTired(),
        children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.cyan }], children: "\u{1F634} Rest All Tired Workers (stamina < 40)" })
      }
    ),
    game.crew.length === 0 && /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { textAlign: "center", padding: 16 }], children: "No crew yet \u2014 post a job ad to find workers." }),
    game.crew.map((w) => {
      const trait = w.trait || {};
      const traitEffects = [];
      if ((trait.speed || 1) > 1.05) traitEffects.push({ label: `Speed +${Math.round((trait.speed - 1) * 100)}%`, color: T.green });
      else if ((trait.speed || 1) < 0.97) traitEffects.push({ label: `Speed \u2212${Math.round((1 - trait.speed) * 100)}%`, color: T.red });
      if ((trait.quality || 1) > 1.05) traitEffects.push({ label: `Quality +${Math.round((trait.quality - 1) * 100)}%`, color: T.cyan });
      if ((trait.safety || 1) > 1.08) traitEffects.push({ label: `Safety +${Math.round((trait.safety - 1) * 100)}%`, color: T.blue });
      else if ((trait.safety || 1) < 0.95) traitEffects.push({ label: `Safety risk`, color: T.orange });
      if (trait.label === "Team Leader") traitEffects.push({ label: "Team +8% progress", color: T.purple });
      if (trait.label === "Frequent No-Show") traitEffects.push({ label: "Unreliable presence", color: T.red });
      if ((trait.wagePressure || 1) > 1.12) traitEffects.push({ label: `High wage demand`, color: T.orange });
      return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: w.name }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              w.role,
              " \xB7 Lv",
              w.level || 1,
              " ",
              WORKER_LEVELS.find((l) => l.level === (w.level || 1))?.label || ""
            ] }),
            (() => {
              const curLvl = WORKER_LEVELS.find((l) => l.level === (w.level || 1));
              const nextLvl = WORKER_LEVELS.find((l) => l.level === (w.level || 1) + 1);
              if (!nextLvl) return /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: T.yellow, fontSize: 10 }], children: "\u2B50 Max Level" });
              const xpProgress = Math.min(1, ((w.xp || 0) - curLvl.xpRequired) / (nextLvl.xpRequired - curLvl.xpRequired));
              return /* @__PURE__ */ jsxs(View, { style: { marginTop: 3, marginBottom: 2 }, children: [
                /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.sub, fontSize: 9 }], children: [
                    "XP ",
                    w.xp || 0,
                    " / ",
                    nextLvl.xpRequired
                  ] }),
                  /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan, fontSize: 9 }], children: [
                    "Next: ",
                    nextLvl.label
                  ] })
                ] }),
                /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, height: 4, marginTop: 2 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.round(xpProgress * 100)}%`, backgroundColor: T.cyan, height: 4 }] }) })
              ] });
            })(),
            /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }, children: /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
              /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                  "Skill \xB7 ",
                  money2(w.wagePerDay),
                  "/day"
                ] }),
                /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: w.skill >= 100 ? T.green : w.skill >= 70 ? T.blue : T.orange }], children: [
                  w.skill,
                  "/150"
                ] })
              ] }),
              /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 2 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.min(100, Math.round(w.skill / 150 * 100))}%`, backgroundColor: w.skill >= 100 ? T.green : w.skill >= 70 ? T.blue : T.orange }] }) })
            ] }) }),
            (() => {
              const daysWorked = game.day - (w.hireDay || game.day);
              const jobsDone = w.jobsCompleted || 0;
              const loyalty = w.loyalty ?? 0;
              if (daysWorked > 0 || jobsDone > 0) {
                return /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: loyalty >= 80 ? T.yellow : loyalty >= 40 ? T.cyan : T.sub, fontSize: 10, marginTop: 1 }], children: [
                  loyalty >= 80 ? "\u2B50 " : "",
                  "Hired Day ",
                  w.hireDay || 0,
                  " \xB7 ",
                  jobsDone,
                  " project",
                  jobsDone !== 1 ? "s" : "",
                  " complete",
                  loyalty >= 80 ? " \xB7 Veteran" : ""
                ] });
              }
              return null;
            })()
          ] }),
          /* @__PURE__ */ jsxs(View, { style: { alignItems: "flex-end" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, { color: w.status === "Active" ? T.orange : w.status === "Idle" ? T.green : T.sub }], children: w.status }),
            w.status === "Active" && (() => {
              const workingSite = (game.activeSites || []).find((s) => (s.assignedCrewIds || []).includes(w.id));
              return workingSite ? /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan, fontSize: 10, marginTop: 2 }], children: [
                "\u{1F3D7}\uFE0F ",
                workingSite.label
              ] }) : null;
            })(),
            /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: T.panel2, marginTop: 4 }], children: /* @__PURE__ */ jsx(Text, { style: [styles.statusPillText, { color: T.text }], children: trait.label || "\u2014" }) })
          ] })
        ] }),
        traitEffects.length > 0 && /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }, children: traitEffects.map((e, i) => /* @__PURE__ */ jsx(View, { style: [styles.statusPill, { backgroundColor: e.color + "22" }], children: /* @__PURE__ */ jsx(Text, { style: [styles.statusPillText, { color: e.color }], children: e.label }) }, i)) }),
        [
          { label: "Mood", val: w.mood, color: moodColor(w.mood) },
          { label: "Stamina", val: w.stamina, color: (w.stamina ?? 50) < 20 ? T.red : (w.stamina ?? 50) < 40 ? T.orange : T.cyan },
          { label: "Loyalty", val: w.loyalty ?? 0, color: (w.loyalty ?? 0) >= 70 ? T.yellow : (w.loyalty ?? 0) >= 40 ? T.green : T.red }
        ].map((stat) => /* @__PURE__ */ jsxs(View, { style: { marginTop: 6 }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: stat.label }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: stat.color }], children: [
              Math.round(stat.val),
              "/100"
            ] })
          ] }),
          /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${Math.max(0, Math.min(100, stat.val))}%`, backgroundColor: stat.color }] }) })
        ] }, stat.label)),
        (w.certifications || []).length > 0 && /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }, children: (w.certifications || []).map((cert) => {
          const prog = TRAINING_PROGRAMS2.find((p) => p.certId === cert);
          return /* @__PURE__ */ jsx(View, { style: { backgroundColor: T.blue + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.blue }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { fontSize: 9, color: T.blue, fontWeight: "700" }], children: [
            "\u{1F393} ",
            prog?.label || cert
          ] }) }, cert);
        }) }),
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }, children: [
          /* @__PURE__ */ jsxs(
            TouchableOpacity,
            {
              style: { flex: 1, minWidth: 80, backgroundColor: T.green + "22", borderRadius: 7, borderWidth: 1, borderColor: T.green, paddingVertical: 6, alignItems: "center" },
              onPress: () => onRaiseWage && onRaiseWage(w.id),
              children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, fontWeight: "700", color: T.green }, children: "Raise Wage" }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.sub }, children: "+10%" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            TouchableOpacity,
            {
              style: { flex: 1, minWidth: 80, backgroundColor: T.orange + "22", borderRadius: 7, borderWidth: 1, borderColor: T.orange, paddingVertical: 6, alignItems: "center" },
              onPress: () => onLowerWage && onLowerWage(w.id),
              children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, fontWeight: "700", color: T.orange }, children: "Lower Wage" }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.sub }, children: "-10%" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            TouchableOpacity,
            {
              style: { flex: 1, minWidth: 80, backgroundColor: T.yellow + "22", borderRadius: 7, borderWidth: 1, borderColor: T.yellow, paddingVertical: 6, alignItems: "center" },
              onPress: () => onGiveBonus && onGiveBonus(w.id),
              children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, fontWeight: "700", color: T.yellow }, children: "Give Bonus" }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.sub }, children: "2\xD7 daily" })
              ]
            }
          ),
          w.status !== "Resting" && (w.stamina ?? 50) < 80 && /* @__PURE__ */ jsxs(
            TouchableOpacity,
            {
              style: { flex: 1, minWidth: 80, backgroundColor: T.cyan + "22", borderRadius: 7, borderWidth: 1, borderColor: T.cyan, paddingVertical: 6, alignItems: "center" },
              onPress: () => onRest && onRest(w.id),
              children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, fontWeight: "700", color: T.cyan }, children: "Rest" }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.sub }, children: "\u219280 stamina" })
              ]
            }
          ),
          w.lastLunchDay !== game.day && /* @__PURE__ */ jsxs(
            TouchableOpacity,
            {
              style: { flex: 1, minWidth: 80, backgroundColor: T.orange + "22", borderRadius: 7, borderWidth: 1, borderColor: T.orange, paddingVertical: 6, alignItems: "center" },
              onPress: () => onBuyLunch && onBuyLunch(w.id),
              children: [
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 10, fontWeight: "700", color: T.orange }, children: "Buy Lunch" }),
                /* @__PURE__ */ jsx(Text, { style: { fontSize: 9, color: T.sub }, children: "$25 \xB7 mood+8" })
              ]
            }
          )
        ] }),
        w.status !== "Active" && (w.level || 1) >= 3 && (w.skill || 0) >= 70 && !w.role?.startsWith("Senior") && /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 6, backgroundColor: T.purple + "22", borderColor: T.purple }],
            onPress: () => onPromote && onPromote(w.id),
            children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: T.purple }], children: [
              "Promote to Senior ",
              w.role,
              " \u2014 $500"
            ] })
          }
        ),
        w.status !== "Active" && w.status !== "Resting" && /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 8, borderColor: T.red }],
            onPress: () => Alert.alert("Fire Worker", `Let go of ${w.name}?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Fire", style: "destructive", onPress: () => onFire(w.id) }
            ]),
            children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.red }], children: "Let Go" })
          }
        ),
        w.status === "Resting" && /* @__PURE__ */ jsx(View, { style: { marginTop: 6, backgroundColor: T.cyan + "18", borderRadius: 6, padding: 6, borderWidth: 1, borderColor: T.cyan }, children: /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan, fontSize: 10 }], children: [
          "\u{1F634} Resting \u2014 stamina recovering to ",
          w.restUntilStamina || 80
        ] }) })
      ] }, w.id);
    }),
    game.crew.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Training Programs" }),
      /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "Invest in crew skill and unlock certifications. Worker must be idle." }),
      TRAINING_PROGRAMS2.map((prog) => /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: prog.label }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
              "Skill +",
              prog.skillBonus,
              " \xB7 ",
              prog.duration,
              " days \xB7 Cert: ",
              prog.certId
            ] }),
            prog.wagePressure > 0 && /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
              "Wage pressure +",
              Math.round(prog.wagePressure * 100),
              "% after completion"
            ] })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: game.cash >= prog.cost ? T.green : T.red }], children: money2(prog.cost) })
        ] }),
        game.crew.filter((w) => w.status === "Idle" && !(game.trainingQueue || []).some((t) => t.workerId === w.id)).slice(0, 3).map((w) => /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 6, backgroundColor: game.cash >= prog.cost ? T.blue : T.panel2, borderColor: T.blue }],
            onPress: () => onTrain && onTrain(w.id, prog.id),
            children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: game.cash >= prog.cost ? "#fff" : T.sub }], children: [
              "Train ",
              w.name.split(" ")[0],
              " \u2014 ",
              money2(prog.cost)
            ] })
          },
          w.id
        ))
      ] }, prog.id)),
      (game.trainingQueue || []).length > 0 && /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.cyan, borderWidth: 1 }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.cyan, marginBottom: 6 }], children: "In Training" }),
        (game.trainingQueue || []).map((t) => {
          const w = game.crew.find((c) => c.id === t.workerId);
          const prog = TRAINING_PROGRAMS2.find((p) => p.id === t.programId);
          const totalDays = prog?.duration || 1;
          const doneDays = totalDays - (t.daysLeft || 0);
          const pct = Math.round(doneDays / totalDays * 100);
          return /* @__PURE__ */ jsxs(View, { style: { marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
                w?.name || "Worker",
                " \u2014 ",
                prog?.label || t.programId
              ] }),
              /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
                t.daysLeft,
                "d left"
              ] })
            ] }),
            /* @__PURE__ */ jsx(View, { style: [styles.progressTrack, { backgroundColor: T.track, marginTop: 3 }], children: /* @__PURE__ */ jsx(View, { style: [styles.progressFill, { width: `${pct}%`, backgroundColor: T.cyan }] }) })
          ] }, t.id);
        })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Hire Subcontractors" }),
    /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "Temporary crews \u2014 faster progress, higher cost, lower reliability." }),
    SUBCONTRACTOR_TYPES.map((def) => {
      const active = (game.subcontractors || []).find((sc) => sc.typeId === def.id);
      return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: def.label }),
            /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: def.desc }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
              "Skill ",
              def.skill,
              " \xB7 ",
              money2(def.wagePerDay),
              "/day \xB7 ",
              def.count,
              " workers \xB7 ",
              def.durationDays,
              " days"
            ] }),
            /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
              "Reliability: ",
              Math.round(def.reliability * 100),
              "%"
            ] })
          ] }),
          /* @__PURE__ */ jsx(Text, { style: [styles.label, { color: T.orange }], children: money2(def.hireCost) })
        ] }),
        active ? /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan, marginTop: 8 }], children: [
          "\u2705 Active \u2014 ",
          active.daysLeft,
          " day(s) left"
        ] }) : /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 8, backgroundColor: game.cash >= def.hireCost ? T.cyan : T.panel2, borderColor: T.cyan }],
            onPress: () => onHireSubcontractor(def.id),
            children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: game.cash >= def.hireCost ? "#fff" : T.sub }], children: [
              "Hire for ",
              def.durationDays,
              " days"
            ] })
          }
        )
      ] }, def.id);
    }),
    (game.subcontractors || []).length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Active Subcontractors" }),
      game.subcontractors.map((sc) => /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel2, borderColor: T.border }], children: [
        /* @__PURE__ */ jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: sc.name }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
            sc.daysLeft,
            "d left"
          ] })
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          sc.role,
          " \xB7 ",
          sc.count,
          " workers \xB7 ",
          money2(sc.wagePerDay),
          "/day \xB7 ",
          sc.status
        ] })
      ] }, sc.id))
    ] }),
    game.officeStaff.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Office Staff" }),
      game.officeStaff.map((s) => /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: s.name }),
        /* @__PURE__ */ jsxs(Text, { style: [styles.sub, subCol], children: [
          s.role,
          " \xB7 ",
          money2(s.wagePerDay),
          "/day"
        ] })
      ] }, s.id))
    ] }),
    /* @__PURE__ */ jsx(Text, { style: [styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }], children: "Project Managers" }),
    /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol, { marginBottom: 8 }], children: "PMs speed up sites, reduce delays, and senior PMs auto-manage stalled jobs." }),
    PM_TIERS.map((def) => {
      const hired = (game.projectManagers || []).find((pm) => pm.typeId === def.id);
      return /* @__PURE__ */ jsxs(View, { style: [styles.card, { backgroundColor: T.panel, borderColor: T.border }], children: [
        /* @__PURE__ */ jsx(View, { style: { flexDirection: "row", justifyContent: "space-between" }, children: /* @__PURE__ */ jsxs(View, { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsx(Text, { style: [styles.label, col], children: def.name }),
          /* @__PURE__ */ jsx(Text, { style: [styles.sub, subCol], children: def.desc }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.cyan }], children: [
            "Delay -",
            Math.round(def.delayReduce * 100),
            "% \xB7 Margin +",
            Math.round(def.marginBoost * 100),
            "%",
            def.autoManage ? " \xB7 Auto-manages" : ""
          ] }),
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.orange }], children: [
            money2(def.wagePerDay),
            "/day \xB7 Hire: ",
            money2(def.hireCost)
          ] })
        ] }) }),
        hired ? /* @__PURE__ */ jsxs(View, { style: { marginTop: 8 }, children: [
          /* @__PURE__ */ jsxs(Text, { style: [styles.sub, { color: T.green }], children: [
            "\u2705 On staff: ",
            hired.name
          ] }),
          /* @__PURE__ */ jsx(TouchableOpacity, { style: [styles.btn, { marginTop: 6, borderColor: T.red }], onPress: () => onFirePM(hired.id), children: /* @__PURE__ */ jsx(Text, { style: [styles.btnText, { color: T.red }], children: "Let Go" }) })
        ] }) : /* @__PURE__ */ jsx(
          TouchableOpacity,
          {
            style: [styles.btn, { marginTop: 8, backgroundColor: game.cash >= def.hireCost ? T.blue : T.panel2, borderColor: T.blue }],
            onPress: () => onHirePM(def.id),
            children: /* @__PURE__ */ jsxs(Text, { style: [styles.btnText, { color: game.cash >= def.hireCost ? "#fff" : T.sub }], children: [
              "Hire \u2014 ",
              money2(def.hireCost)
            ] })
          }
        )
      ] }, def.id);
    })
  ] });
}
var styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 10 },
  h2: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 14, marginTop: 4 },
  sub: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cashBig: { fontSize: 22, fontWeight: "800" },
  kpi: { borderRadius: 8, borderWidth: 1, padding: 10, alignItems: "center" },
  kpiVal: { fontSize: 20, fontWeight: "800" },
  kpiLabel: { fontSize: 11, marginTop: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  tabBar: { position: "absolute", left: 10, right: 10, bottom: Platform.select({ ios: 24, android: 12, default: 10 }), flexDirection: "row", borderRadius: 20, borderWidth: 1.2, justifyContent: "space-around", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, elevation: 10 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", position: "relative", paddingVertical: 8, paddingHorizontal: 2 },
  tabIcon: { fontSize: 14, fontWeight: "700" },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  tabDot: { marginTop: 4, width: 5, height: 5, borderRadius: 999 },
  badge: { position: "absolute", top: 0, right: 10, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  btn: { borderRadius: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  btnText: { fontSize: 14, fontWeight: "600" },
  smallBtn: { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, alignItems: "center" },
  smallBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chip: { fontSize: 11, borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rowItem: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  selDot: { width: 16, height: 16, borderRadius: 8, marginLeft: 8 },
  finRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 20, backgroundColor: "#111a0f" },
  feedItem: { fontSize: 12, paddingVertical: 3 },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: "600" }
});
export {
  ACHIEVEMENTS_LIST,
  EQUIPMENT_IMAGES,
  EQUIPMENT_SHOP,
  MILESTONE_DEFS,
  OFFICES,
  OFFICE_IMAGES,
  applyOfflineProgress,
  checkAchievements,
  checkMilestones,
  checkWeeklyChallenge,
  checkWorkerTurnover,
  clone,
  computeOfflineProgress,
  createContract,
  createRivals,
  ConstructionFlowScreen as default,
  enhancedRivalBidding,
  enhancedRivalDailyLogic,
  freshState,
  gameTick,
  generateWeeklyChallenge,
  getPredictiveWarnings,
  migrateState,
  money2 as money,
  startNewGeneration
};
