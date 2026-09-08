// Expanded Random Events System
// Covers inspections, lawsuits, theft, vandalism, weather, power outages,
// viral social media, celebrity visits, labor shortages, and supplier failures.
// Generic: works with any business type via businessType checks.

import { uid, rand, pick, clamp, addLog, money } from "./utils.js";

const SEVERITY = { minor: "minor", moderate: "moderate", major: "major", critical: "critical" };

export const EVENT_POOL = [
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
        addLog(game, "Health inspection passed — reputation boosted.");
      } else {
        const fine = rand(800, 2800);
        game.cash -= fine;
        game.reputation = clamp((game.reputation || 50) - 8, 0, 100);
        addLog(game, `Failed health inspection — ${money(fine)} fine and reputation hit.`);
      }
    },
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
        addLog(game, "DOT inspection passed — fleet compliance confirmed.");
      } else {
        const fine = rand(500, 2200);
        game.cash -= fine;
        if (vehicles.length > 0) pick(vehicles).status = "In Repair";
        addLog(game, `DOT inspection failed — ${money(fine)} fine, vehicle grounded.`);
      }
    },
  },
  {
    id: "lawsuit",
    label: "Customer Lawsuit",
    severity: SEVERITY.major,
    weight: 2,
    businessTypes: ["all"],
    resolve: (game) => {
      const settlement = rand(3000, 12000);
      game.cash -= settlement;
      game.reputation = clamp((game.reputation || 50) - 12, 0, 100);
      addLog(game, `Customer lawsuit settled for ${money(settlement)} — reputation damaged.`);
    },
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
      addLog(game, `Theft incident — ${money(stolen)} in losses.`);
    },
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
      addLog(game, `Vandalism — ${money(repairCost)} in damage and cleanup costs.`);
    },
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
      routes.forEach((r) => { r.remainingSec = Math.round((r.remainingSec || 0) * 1.3); });
      game.reputation = clamp((game.reputation || 50) - 3, 0, 100);
      addLog(game, `Severe weather hit — ${affected.length} vehicles damaged, routes delayed.`);
    },
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
      addLog(game, `Power outage — ${money(lostRevenue)} in lost revenue.`);
    },
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
        addLog(game, `Negative viral post — reputation dropped ${drop} points.`);
      }
    },
  },
  {
    id: "celebrity_visit",
    label: "Celebrity Visit",
    severity: SEVERITY.minor,
    weight: 2,
    businessTypes: ["restaurant", "retail", "service"],
    resolve: (game) => {
      const reputationGain = rand(10, 22);
      const revenueBoost = rand(800, 3000);
      game.reputation = clamp((game.reputation || 50) + reputationGain, 0, 100);
      game.cash = (game.cash || 0) + revenueBoost;
      addLog(game, `Celebrity visited — +${reputationGain} reputation and ${money(revenueBoost)} bonus revenue!`);
    },
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
    },
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
        addLog(game, "Supplier failure warning — no active suppliers on file.");
        return;
      }
      const failed = pick(suppliers);
      failed.active = false;
      failed.failStreak = (failed.failStreak || 0) + 5;
      const inventory = (game.inventory || []).filter((i) => i.supplierId === failed.id);
      inventory.forEach((item) => { item.shortage = true; });
      addLog(game, `Supplier ${failed.name} collapsed — ${inventory.length} items now in shortage.`);
    },
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
      const cost = rand(1500, 5000);
      game.cash -= cost;
      addLog(game, `Equipment recall: ${recalled.name} grounded for ${Math.round(recalled.repairMinsLeft / 60)}h — ${money(cost)} cost.`);
    },
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
      const medCost = rand(1000, 4500);
      game.cash -= medCost;
      game.reputation = clamp((game.reputation || 50) - 5, 0, 100);
      addLog(game, `Workplace accident involving ${worker.name} — ${money(medCost)} medical costs.`);
    },
  },
  {
    id: "financial_audit",
    label: "Tax / Financial Audit",
    severity: SEVERITY.major,
    weight: 2,
    businessTypes: ["all"],
    resolve: (game) => {
      const penalty = rand(1000, 3500);
      game.cash -= penalty;
      addLog(game, `Financial audit — ${money(penalty)} in penalties.`);
    },
  },
];

export function rollRandomEvent(game, businessType) {
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

export function applyRandomEvent(game, event) {
  if (!event || typeof event.resolve !== "function") return;
  const roll = Math.random();
  event.resolve(game, roll);

  if (!Array.isArray(game.activeEvents)) game.activeEvents = [];
  game.activeEvents.push({
    id: uid(),
    eventId: event.id,
    label: event.label,
    severity: event.severity,
    day: game.day || 0,
  });
  if (game.activeEvents.length > 30) game.activeEvents.shift();
}

export function maybeFireRandomEvent(game, businessType, dailyChance = 0.08) {
  if (Math.random() < dailyChance) applyRandomEvent(game, rollRandomEvent(game, businessType));
}

export function getActiveEventEffects(game) {
  const recent = (game.activeEvents || []).filter((e) => e.day >= (game.day || 0) - 3);
  return {
    recentCount: recent.length,
    hasMajor: recent.some((e) => e.severity === SEVERITY.major || e.severity === SEVERITY.critical),
    labels: recent.map((e) => e.label),
  };
}
