// Employee Personality System
// Covers happiness, stress, loyalty, ambition, skill growth, burnout,
// resignations, promotions, raises, training, attendance, productivity modifiers.
// Works with any game's workers array on game state.

import { uid, rand, pick, clamp, addLog } from "./utils.js";

export const PERSONALITY_TRAITS = [
  { id: "driven",        label: "Driven",        stressMod: 1.1,  ambitionBase: 75, loyaltyMod: -5  },
  { id: "easygoing",    label: "Easy-Going",    stressMod: 0.8,  ambitionBase: 35, loyaltyMod: 12  },
  { id: "perfectionist",label: "Perfectionist", stressMod: 1.2,  ambitionBase: 65, loyaltyMod: 0   },
  { id: "team_player",  label: "Team Player",   stressMod: 0.9,  ambitionBase: 45, loyaltyMod: 15  },
  { id: "independent",  label: "Independent",   stressMod: 1.05, ambitionBase: 60, loyaltyMod: -10 },
  { id: "methodical",   label: "Methodical",   stressMod: 0.85, ambitionBase: 50, loyaltyMod: 5   },
];

export const TRAINING_PROGRAMS = [
  { id: "safety",      label: "Safety & Compliance", cost: 220, durationDays: 3, skillGain: 5, stressReduction: 8  },
  { id: "efficiency",  label: "Efficiency Bootcamp", cost: 350, durationDays: 5, skillGain: 8, stressReduction: 0  },
  { id: "leadership",  label: "Leadership Seminar",  cost: 480, durationDays: 4, skillGain: 4, stressReduction: 5, promotionBonus: true },
  { id: "technical",   label: "Technical Skills",    cost: 300, durationDays: 4, skillGain: 10, stressReduction: 2 },
  { id: "wellness",    label: "Wellness Program",    cost: 160, durationDays: 2, skillGain: 0, stressReduction: 22, happinessGain: 15 },
];

export function initPersonality(worker) {
  if (worker.happiness !== undefined) return worker;
  const trait = pick(PERSONALITY_TRAITS);
  return {
    ...worker,
    happiness: clamp((worker.mood || 65), 0, 100),
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
    productivityMod: 1.0,
  };
}

export function getProductivityModifier(worker) {
  if (worker.burnout) return 0.50;
  const happinessFactor = clamp((worker.happiness || 65) / 100, 0, 1);
  const stressLevel = worker.stress || 0;
  const stressPenalty = stressLevel > 50 ? (stressLevel - 50) * 0.006 : 0;
  const loyaltyBonus = (worker.loyalty || 60) > 75 ? 0.05 : 0;
  return clamp(0.65 + happinessFactor * 0.25 - stressPenalty + loyaltyBonus, 0.45, 1.40);
}

function findWorker(game, workerId) {
  return (game.workers || game.crew || []).find((x) => x.id === workerId);
}

export function recordAttendance(game, workerId, present) {
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

export function sendToTraining(game, workerId, programId) {
  const w = findWorker(game, workerId);
  const program = TRAINING_PROGRAMS.find((p) => p.id === programId);
  if (!w || !program) return false;
  if (w.trainingCompleteDay) return false;
  if ((game.cash || 0) < program.cost) return false;
  game.cash -= program.cost;
  w.trainingCompleteDay = (game.day || 1) + program.durationDays;
  w.trainingProgramId = program.id;
  if (w.status === "Idle") w.status = "Training";
  addLog(game, `${w.name} enrolled in ${program.label} — back in ${program.durationDays} days.`);
  return true;
}

export function requestRaise(game, workerId) {
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
    addLog(game, `${w.name} got a $${raiseAmt}/hr raise — loyalty surged.`);
  } else {
    w.happiness = clamp((w.happiness || 65) - 10, 0, 100);
    w.resignationRisk = clamp((w.resignationRisk || 0) + 25, 0, 100);
    addLog(game, `${w.name}'s raise request denied — resignation risk up.`);
  }
}

export function checkPromotion(game, workerId) {
  const w = findWorker(game, workerId);
  if (!w || !w.promotionReady) return false;
  w.level = clamp((w.level || 1) + 1, 1, 5);
  w.promotionReady = false;
  w.ambition = clamp((w.ambition || 50) - 20, 10, 100);
  w.happiness = clamp((w.happiness || 65) + 18, 0, 100);
  w.loyalty = clamp((w.loyalty || 60) + 12, 0, 100);
  w.resignationRisk = clamp((w.resignationRisk || 0) - 35, 0, 100);
  addLog(game, `${w.name} promoted to Level ${w.level} — morale and loyalty boosted.`);
  if (game.weeklyStats) game.weeklyStats.hires = (game.weeklyStats.hires || 0);
  return true;
}

export function tickEmployeePersonalities(game) {
  const workers = Array.isArray(game.workers) ? game.workers
    : Array.isArray(game.crew) ? game.crew
    : null;
  if (!workers) return;

  workers.forEach((w) => {
    if (w.happiness === undefined) {
      const patch = initPersonality(w);
      Object.assign(w, patch);
    }

    const fatigue = w.fatigue || 0;
    const mood = w.mood || 65;
    const trait = PERSONALITY_TRAITS.find((t) => t.id === w.personalityTraitId) || PERSONALITY_TRAITS[0];

    let stressDelta = -1.5;
    if (fatigue > 68) stressDelta += 3.5 * trait.stressMod;
    if (fatigue > 85) stressDelta += 4.0 * trait.stressMod;
    if (mood < 45) stressDelta += 2.5;
    if (w.status === "En Route") stressDelta += 0.8;
    if ((w.absencesThisMonth || 0) > 3) stressDelta += 1.5;
    w.stress = clamp((w.stress || 0) + stressDelta, 0, 100);

    if ((w.stress || 0) >= 86) {
      w.burnoutDays = (w.burnoutDays || 0) + 1;
      if ((w.burnoutDays || 0) >= 3 && !w.burnout) {
        w.burnout = true;
        addLog(game, `${w.name} burned out — productivity will suffer until they recover.`);
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

    const deliveryGrowth = Math.min(0.04, (w.deliveries || 0) * 0.0005);
    w.skill = clamp((w.skill || 85) + deliveryGrowth, 0, 130);

    if (w.trainingCompleteDay && (game.day || 0) >= w.trainingCompleteDay) {
      const program = TRAINING_PROGRAMS.find((p) => p.id === w.trainingProgramId);
      if (program) {
        w.skill = clamp((w.skill || 85) + program.skillGain, 0, 130);
        w.stress = clamp((w.stress || 20) - program.stressReduction, 0, 100);
        w.happiness = clamp((w.happiness || 65) + (program.happinessGain || 6), 0, 100);
        if (program.promotionBonus) w.promotionReady = true;
        addLog(game, `${w.name} completed ${program.label}${program.skillGain > 0 ? ` — skill +${program.skillGain}` : ""}.`);
      }
      w.trainingCompleteDay = null;
      w.trainingProgramId = null;
      if (w.status === "Training") w.status = "Idle";
    }

    w.promotionReady =
      (w.ambition || 40) >= 68 &&
      (w.deliveries || 0) >= 15 &&
      (w.level || 1) < 5 &&
      !w.burnout;

    w.productivityMod = getProductivityModifier(w);
  });
}

export function applyDailyPersonalityEvents(game) {
  const isCrewGame = !Array.isArray(game.workers) && Array.isArray(game.crew);
  const workers = isCrewGame ? game.crew : (game.workers || []);

  const toRemove = [];
  workers.forEach((w) => {
    if ((w.resignationRisk || 0) > 55 && Math.random() < (w.resignationRisk - 55) / 220) {
      addLog(game, `${w.name} quit — morale and stress reached a breaking point.`);
      if (game.weeklyStats) game.weeklyStats.quits = (game.weeklyStats.quits || 0) + 1;
      const vehicle = (game.vehicles || []).find((v) => v.assignedWorkerId === w.id);
      if (vehicle) { vehicle.status = "Idle"; vehicle.assignedWorkerId = null; vehicle.routeId = null; }
      toRemove.push(w.id);
      return;
    }

    if ((w.ambition || 40) > 72 && Math.random() < 0.035) {
      requestRaise(game, w.id);
    }

    if ((w.stress || 0) > 72 && Math.random() < 0.055) {
      w.callouts = (w.callouts || 0) + 1;
      recordAttendance(game, w.id, false);
      addLog(game, `${w.name} called out today — stress levels too high.`);
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
