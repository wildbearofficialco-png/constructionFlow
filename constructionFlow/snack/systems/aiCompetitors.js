// AI Competitors System
// Simulates competing companies with expansion, contract bidding, pricing competition,
// acquisitions, and bankruptcies. Works across all business types.

import { uid, rand, pick, clamp, addLog, money } from "./utils.js";

const COMPETITOR_NAMES = [
  "Apex Logistics", "BlueStar Freight", "Meridian Delivery", "Nova Transit",
  "Summit Carriers", "IronRoute Co.", "Pacific Haul", "CrossTown Express",
  "Atlas Freight", "PeakLine Transport", "ClearPath Logistics", "Velocity Freight",
  "Harbor Haulers", "Canyon Carriers", "Ridgeline Express",
];

const OWNER_NAMES = [
  "Marcus Chen",   "Sandra Rivera",  "James Okafor",  "Priya Patel",
  "Tom Brennan",   "Layla Hassan",   "Derek Walsh",   "Aisha Osei",
  "Carlos Reyes",  "Mina Tanaka",    "Paul Morin",    "Zara Ahmed",
];

const STRATEGIES = [
  { id: "aggressive",  label: "Aggressive",  expansionRate: 1.6, pricingMod: 0.88, riskTolerance: 0.80 },
  { id: "balanced",    label: "Balanced",    expansionRate: 1.0, pricingMod: 1.00, riskTolerance: 0.50 },
  { id: "conservative",label: "Conservative",expansionRate: 0.6, pricingMod: 1.08, riskTolerance: 0.25 },
  { id: "predatory",   label: "Predatory",   expansionRate: 1.3, pricingMod: 0.82, riskTolerance: 0.70 },
];

export function createAiCompetitor(overrides = {}) {
  const strategy = pick(STRATEGIES);
  const startCash = rand(8000, 35000);
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
    weeklyRevenue: rand(800, 3000),
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
    lastActionDay: 0,
  };
}

export function initAiCompetitors(game, count) {
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
  const marketMult = marketState === "Boom" ? 1.15 : marketState === "Slow" ? 0.85 : 1.0;
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
  if ((competitor.expansionCooldown || 0) > 0) { competitor.expansionCooldown -= 1; return; }
  if (competitor.cash < 5000) return;

  const expandRoll = Math.random();
  const threshold = 0.04 * strategy.expansionRate;
  if (expandRoll > threshold) return;

  const expandType = Math.random();
  if (expandType < 0.5) {
    competitor.fleetSize += 1;
    const cost = rand(3000, 10000);
    competitor.cash -= cost;
    competitor.weeklyExpenses += rand(50, 150);
    competitor.companyLevel = Math.min(10, Math.ceil(competitor.fleetSize / 3) + 1);
  } else {
    competitor.staffCount += 1;
    competitor.weeklyExpenses += rand(30, 80);
  }

  competitor.expansionCooldown = rand(5, 14);
  addLog(game, `Competitor ${competitor.name} expanded — now ${competitor.fleetSize} vehicles, ${competitor.staffCount} staff.`);
}

function tryBidOnContract(competitor, game) {
  if ((competitor.biddingCooldown || 0) > 0) { competitor.biddingCooldown -= 1; return; }
  const strategy = getStrategy(competitor);
  if (Math.random() > 0.12) return;

  const playerRep = game.reputation || 50;
  const compRep = competitor.reputation || 50;
  const pricingAdvantage = strategy.pricingMod < 1.0 ? 0.12 : 0;
  const reputationFactor = compRep > playerRep ? 0.08 : -0.05;

  const winChance = clamp(0.25 + pricingAdvantage + reputationFactor, 0.05, 0.65);
  const won = Math.random() < winChance;

  if (won) {
    competitor.contractsWon += 1;
    competitor.reputation = clamp(competitor.reputation + rand(1, 4), 0, 100);
    competitor.weeklyRevenue += rand(200, 800);
    competitor.marketShare = clamp(competitor.marketShare + rand(0, 2), 0, 100);
    game.reputation = clamp(playerRep - rand(1, 3), 0, 100);
    addLog(game, `${competitor.name} outbid you on a contract — market share up.`);
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
      addLog(game, `${competitor.name} is struggling financially — bankruptcy possible.`);
    } else {
      competitor.bankruptcyCountdown -= 1;
      if (competitor.bankruptcyCountdown <= 0) {
        competitor.status = "Bankrupt";
        competitor.cash = 0;
        competitor.fleetSize = 0;
        competitor.marketShare = 0;
        addLog(game, `${competitor.name} has gone bankrupt — market share opens up.`);
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
  if (competitor.cash < 20000) return;
  if (Math.random() > 0.015) return;

  const target = (game.aiCompetitors || []).find(
    (c) => c.id !== competitor.id && c.status === "Bankrupt" || (c.status === "Active" && c.cash < 2000 && c.weeklyProfit < 0)
  );
  if (!target) return;

  const acquisitionCost = rand(5000, 15000);
  if (competitor.cash < acquisitionCost) return;

  competitor.cash -= acquisitionCost;
  competitor.fleetSize += Math.floor(target.fleetSize * 0.6);
  competitor.staffCount += Math.floor(target.staffCount * 0.5);
  competitor.marketShare = clamp(competitor.marketShare + target.marketShare * 0.7, 0, 100);
  competitor.acquisitions.push(target.id);

  target.status = "Acquired";
  target.acquiredBy = competitor.id;

  addLog(game, `${competitor.name} acquired ${target.name} — growing fast.`);
}

export function tickAiCompetitors(game) {
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

export function getMarketPressure(game) {
  const competitors = (game.aiCompetitors || []).filter((c) => c.status === "Active");
  if (competitors.length === 0) return { pressureLevel: "None", pricingPressure: 1.0, totalMarketShare: 0 };

  const avgRep = competitors.reduce((s, c) => s + c.reputation, 0) / competitors.length;
  const aggressiveCount = competitors.filter((c) => c.strategyId === "predatory" || c.strategyId === "aggressive").length;
  const totalShare = competitors.reduce((s, c) => s + c.marketShare, 0);

  const pricingPressure = 1.0 - (aggressiveCount * 0.03);
  const level = totalShare > 60 ? "High" : totalShare > 35 ? "Moderate" : "Low";

  return {
    pressureLevel: level,
    pricingPressure: clamp(pricingPressure, 0.75, 1.0),
    totalMarketShare: totalShare,
    competitorCount: competitors.length,
    averageReputation: Math.round(avgRep),
  };
}

export function getCompetitorLeaderboard(game) {
  const all = game.aiCompetitors || [];
  return [...all]
    .filter((c) => c.status === "Active")
    .sort((a, b) => b.companyValue - a.companyValue)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      ownerName: c.ownerName,
      companyValue: c.companyValue,
      reputation: c.reputation,
      fleetSize: c.fleetSize,
      status: c.status,
    }));
}
