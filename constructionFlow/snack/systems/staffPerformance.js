// Staff Performance & Morale System
// Periodic performance reviews, team morale aggregation, retention bonuses,
// and KPI tracking. Layers on top of employeePersonalities without duplicating
// the daily tick — reviews fire every 14 days, team morale updates weekly.

import { clamp, rand, pick, addLog } from "./utils.js";

// Review outcome thresholds (0–100 performance score)
const REVIEW_OUTCOMES = [
  { min: 85, label: "Outstanding", ratingLabel: "⭐⭐⭐⭐⭐", raiseChance: 0.80, loyaltyGain: 15, stressRelief: 10, promotionEligible: true  },
  { min: 70, label: "Exceeds Expectations", ratingLabel: "⭐⭐⭐⭐",  raiseChance: 0.45, loyaltyGain: 8,  stressRelief: 5,  promotionEligible: false },
  { min: 55, label: "Meets Expectations",   ratingLabel: "⭐⭐⭐",   raiseChance: 0.20, loyaltyGain: 3,  stressRelief: 0,  promotionEligible: false },
  { min: 35, label: "Needs Improvement",    ratingLabel: "⭐⭐",    raiseChance: 0,    loyaltyGain: -5, stressRelief: -5, promotionEligible: false },
  { min: 0,  label: "Underperforming",      ratingLabel: "⭐",     raiseChance: 0,    loyaltyGain: -12, stressRelief: -10, promotionEligible: false },
];

// Retention bonus tiers — offered to high-risk/high-value workers
export const RETENTION_BONUSES = [
  { id: "spot_bonus",  label: "Spot Bonus",       cost: 200,  loyaltyGain: 12, riskReduction: 20 },
  { id: "extra_day",   label: "Extra Day Off",     cost: 0,    loyaltyGain: 8,  riskReduction: 15, happinessGain: 10 },
  { id: "raise_early", label: "Early Raise",       cost: 0,    loyaltyGain: 18, riskReduction: 30, wageIncrease: 0.5 },
  { id: "stock_grant", label: "Profit Share",      cost: 500,  loyaltyGain: 25, riskReduction: 40, happinessGain: 15 },
];

export const REVIEW_INTERVAL_DAYS = 14;

function getWorkerArray(game) {
  return game.workers || game.crew || game.staff || [];
}

// Compute a 0–100 performance score for one worker
function computePerformanceScore(worker) {
  const deliveries = Math.min(worker.deliveries || worker.jobsDone || 0, 30);
  const deliveryScore = (deliveries / 30) * 35;

  const happiness = worker.happiness || 65;
  const happinessScore = (happiness / 100) * 25;

  const skill = worker.skill || 50;
  const skillScore = (skill / 100) * 20;

  const attendance = 1.0 - Math.min(worker.absences || 0, 5) * 0.08;
  const attendanceScore = attendance * 15;

  const burnoutPenalty = worker.burnout ? -15 : 0;
  const stressPenalty = (worker.stress || 0) > 70 ? -5 : 0;

  return clamp(Math.round(deliveryScore + happinessScore + skillScore + attendanceScore + burnoutPenalty + stressPenalty), 0, 100);
}

function getOutcome(score) {
  return REVIEW_OUTCOMES.find((o) => score >= o.min) || REVIEW_OUTCOMES[REVIEW_OUTCOMES.length - 1];
}

// Run a performance review for a single worker
function reviewWorker(game, worker) {
  const score = computePerformanceScore(worker);
  const outcome = getOutcome(score);

  worker.lastReviewDay = game.day || 0;
  worker.lastReviewScore = score;
  worker.lastReviewLabel = outcome.label;
  worker.performanceScore = score;

  // Apply loyalty/stress effects
  worker.loyalty = clamp((worker.loyalty || 60) + outcome.loyaltyGain, 0, 100);
  worker.stress = clamp((worker.stress || 20) + outcome.stressRelief * -1, 0, 100);

  // Auto-raise for outstanding performers (small bump)
  if (outcome.raiseChance > 0 && Math.random() < outcome.raiseChance) {
    const bump = score >= 85 ? 0.75 : 0.25;
    worker.hourlyWage = Math.round(((worker.hourlyWage || 15) + bump) * 100) / 100;
    worker.loyalty = clamp((worker.loyalty || 60) + 5, 0, 100);
    addLog(game, `📋 ${worker.name} — ${outcome.label} review. Wage ↑ $${bump.toFixed(2)}/hr.`);
  } else if (outcome.loyaltyGain < 0) {
    worker.resignationRisk = clamp((worker.resignationRisk || 0) + 15, 0, 100);
    addLog(game, `📋 ${worker.name} — ${outcome.label} review. Improvement needed or morale drops further.`);
  } else {
    addLog(game, `📋 ${worker.name} — ${outcome.label} review (${score}/100).`);
  }

  // Promotion eligible flag
  worker.promotionEligible = outcome.promotionEligible && (worker.skill || 50) >= 70;

  // Reset delivery counter post-review
  worker.deliveries = 0;

  return { workerId: worker.id, score, label: outcome.label };
}

// Called every game day — fires reviews on schedule
export function tickPerformanceReviews(game) {
  const day = game.day || 0;
  if (day < 7) return; // no reviews in first week
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

// Aggregate team morale (0–100) from all active workers
export function getTeamMorale(game) {
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

// Team morale → service quality multiplier (feeds into customerSatisfaction)
export function getMoraleServiceMult(game) {
  const morale = getTeamMorale(game);
  // 0 morale → 0.75x, 50 morale → 1.00x, 100 morale → 1.20x
  return clamp(0.75 + (morale / 100) * 0.45, 0.75, 1.20);
}

// Apply a retention bonus to a specific worker
export function applyRetentionBonus(game, workerId, bonusId) {
  const workers = getWorkerArray(game);
  const worker = workers.find((w) => w.id === workerId);
  const bonus = RETENTION_BONUSES.find((b) => b.id === bonusId);
  if (!worker || !bonus) return false;

  if (bonus.cost > 0) {
    if ((game.cash || 0) < bonus.cost) return false;
    game.cash -= bonus.cost;
  }

  worker.loyalty = clamp((worker.loyalty || 60) + bonus.loyaltyGain, 0, 100);
  worker.resignationRisk = clamp((worker.resignationRisk || 0) - bonus.riskReduction, 0, 100);
  if (bonus.happinessGain) worker.happiness = clamp((worker.happiness || 65) + bonus.happinessGain, 0, 100);
  if (bonus.wageIncrease) worker.hourlyWage = Math.round(((worker.hourlyWage || 15) + bonus.wageIncrease) * 100) / 100;

  addLog(game, `🎁 Retention bonus (${bonus.label}) offered to ${worker.name} — risk ↓${bonus.riskReduction}.`);
  return true;
}

// Weekly morale event — small random morale swings from team dynamics
export function tickTeamMorale(game) {
  const workers = getWorkerArray(game);
  if (workers.length === 0) return;

  const morale = getTeamMorale(game);

  // Positive feedback loop when morale is high
  if (morale >= 80 && Math.random() < 0.3) {
    workers.forEach((w) => {
      w.happiness = clamp((w.happiness || 65) + rand(1, 4), 0, 100);
    });
    addLog(game, "👥 High team morale — positive energy spreading through the crew.");
  }

  // Negative cascade when morale collapses
  if (morale <= 25 && Math.random() < 0.4) {
    workers.forEach((w) => {
      w.stress = clamp((w.stress || 20) + rand(3, 8), 0, 100);
      w.resignationRisk = clamp((w.resignationRisk || 0) + 5, 0, 100);
    });
    addLog(game, "⚠ Low team morale — stress spreading. Consider a retention bonus or team day.");
  }

  game.teamMorale = morale;
}

export function getStaffPerformanceSummary(game) {
  const workers = getWorkerArray(game);
  const morale = getTeamMorale(game);
  const atRisk = workers.filter((w) => (w.resignationRisk || 0) >= 60);
  const promotionReady = workers.filter((w) => w.promotionEligible);
  const burnoutCount = workers.filter((w) => w.burnout).length;
  const avgScore = workers.length > 0
    ? Math.round(workers.reduce((s, w) => s + (w.performanceScore || 50), 0) / workers.length)
    : 50;

  return {
    teamMorale: morale,
    moraleLabel: morale >= 80 ? "Excellent" : morale >= 60 ? "Good" : morale >= 40 ? "Fair" : "Poor",
    serviceMultiplier: getMoraleServiceMult(game),
    avgPerformanceScore: avgScore,
    atRiskCount: atRisk.length,
    atRiskWorkers: atRisk.map((w) => ({ id: w.id, name: w.name, risk: w.resignationRisk })),
    promotionReadyCount: promotionReady.length,
    burnoutCount,
    totalWorkers: workers.length,
    lastReviewBatch: game.lastReviewBatch || null,
  };
}
