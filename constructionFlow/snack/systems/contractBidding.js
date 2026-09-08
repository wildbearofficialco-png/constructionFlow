// Contract Bidding System
// Time-limited RFPs arrive periodically. Player sets bid price vs AI competitors.
// Win probability = function of price competitiveness + reputation vs client requirements.
// Won contracts pay recurring income for their duration. Integrates with financialLedger
// (recordRevenue), aiCompetitors (competing bids), and demandPricing (market context).

import { clamp, rand, pick, uid, addLog } from "./utils.js";

export const CONTRACT_TYPES = [
  { id: "supply_run",     label: "Supply Run Contract",     baseValue: 800,   duration: 7,  repRequired: 0,  clientType: "Small Business", frequency: 0.35 },
  { id: "retail_chain",   label: "Retail Chain Account",    baseValue: 2200,  duration: 14, repRequired: 30, clientType: "Retail Chain",    frequency: 0.25 },
  { id: "gov_logistics",  label: "Gov. Logistics Tender",   baseValue: 4500,  duration: 21, repRequired: 55, clientType: "Government",      frequency: 0.15 },
  { id: "corp_account",   label: "Corporate Account",       baseValue: 3200,  duration: 14, repRequired: 45, clientType: "Corporation",     frequency: 0.18 },
  { id: "hospital_chain", label: "Medical Supply Deal",     baseValue: 5500,  duration: 30, repRequired: 65, clientType: "Healthcare",      frequency: 0.07 },
];

// How often (days) a new RFP can spawn
const RFP_SPAWN_INTERVAL = 5;
const MAX_OPEN_RFPS = 3;
const RFP_EXPIRY_DAYS = 4;

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
    // AI bids within ±25% of base, weighted by their reputation
    const bidAmount = Math.round(base * (0.75 + Math.random() * 0.50) * repFactor);
    return { name: ai.name || ai.id, bid: bidAmount, reputation: ai.reputation || 50 };
  });
}

// Spawn a new RFP if conditions are met
export function tickContractRFPs(game) {
  const day = game.day || 0;
  if (!game.openRFPs) game.openRFPs = [];
  if (!game.activeContracts) game.activeContracts = [];
  if (!game.contractHistory) game.contractHistory = [];

  // Expire old RFPs
  game.openRFPs = game.openRFPs.filter((rfp) => {
    if (day - rfp.spawnDay >= RFP_EXPIRY_DAYS) {
      addLog(game, `📋 RFP expired: ${rfp.label} — no bid submitted.`);
      return false;
    }
    return true;
  });

  // Tick active contracts — collect daily income, expire when duration ends
  game.activeContracts = game.activeContracts.filter((contract) => {
    if (day >= contract.expiresDay) {
      addLog(game, `✅ Contract complete: ${contract.label} — finished.`);
      game.contractHistory.push({ ...contract, completedDay: day });
      return false;
    }
    // Daily income from contract (proportional to weekly payout)
    const dailyPay = Math.round(contract.weeklyPayout / 7);
    game.cash = (game.cash || 0) + dailyPay;
    game.weeklyProfit = (game.weeklyProfit || 0) + dailyPay;
    if (!game.contractIncome) game.contractIncome = 0;
    game.contractIncome += dailyPay;
    return true;
  });

  // Spawn new RFP
  const lastSpawn = game.lastRFPSpawnDay || 0;
  if (day - lastSpawn >= RFP_SPAWN_INTERVAL && game.openRFPs.length < MAX_OPEN_RFPS) {
    const type = pickContractType(game.reputation || 0);
    const demandMod = (game.economy?.demandIndex || 1.0);
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
      status: "open",
    };

    game.openRFPs.push(rfp);
    game.lastRFPSpawnDay = day;
    addLog(game, `📋 New RFP: ${rfp.label} (${rfp.clientType}) — ${rfp.duration}d contract, up to $${baseValue.toLocaleString()}/wk. Bid before day ${rfp.expiresDay}.`);
  }
}

// Calculate win probability for a player bid
export function calculateBidWinChance(game, rfpId, playerBidAmount) {
  const rfp = (game.openRFPs || []).find((r) => r.id === rfpId);
  if (!rfp) return 0;

  const reputation = game.reputation || 0;
  const repBonus = clamp((reputation - rfp.repRequired) / 50, -0.2, 0.3);

  // If player bids lower than lowest AI bid → better chance
  const lowestAiBid = rfp.aiBids.length > 0 ? Math.min(...rfp.aiBids.map((b) => b.bid)) : rfp.baseValue;
  const priceFactor = clamp((lowestAiBid / Math.max(playerBidAmount, 1)) * 0.6, 0.1, 0.9);

  const satisfactionBonus = clamp(((game.customerRating || 3.5) - 3.5) * 0.08, -0.15, 0.15);

  return clamp(priceFactor + repBonus + satisfactionBonus, 0.05, 0.95);
}

// Player submits a bid on an open RFP
export function submitBid(game, rfpId, playerBidAmount) {
  const rfpIndex = (game.openRFPs || []).findIndex((r) => r.id === rfpId);
  if (rfpIndex === -1) return { success: false, reason: "RFP not found or expired" };

  const rfp = game.openRFPs[rfpIndex];
  if (rfp.status !== "open") return { success: false, reason: "RFP already bid on" };

  const winChance = calculateBidWinChance(game, rfpId, playerBidAmount);
  const won = Math.random() < winChance;

  rfp.playerBid = playerBidAmount;
  rfp.winChance = Math.round(winChance * 100);
  rfp.status = won ? "won" : "lost";

  if (won) {
    const contract = {
      id: uid(),
      rfpId: rfp.id,
      type: rfp.type,
      label: rfp.label,
      clientType: rfp.clientType,
      weeklyPayout: playerBidAmount,
      duration: rfp.duration,
      startDay: game.day || 0,
      expiresDay: (game.day || 0) + rfp.duration,
      status: "active",
    };
    if (!game.activeContracts) game.activeContracts = [];
    game.activeContracts.push(contract);
    addLog(game, `🏆 Contract won: ${rfp.label} — $${playerBidAmount.toLocaleString()}/wk for ${rfp.duration} days!`);
    game.reputation = clamp((game.reputation || 0) + 3, 0, 100);
  } else {
    const winner = rfp.aiBids.sort((a, b) => b.bid - a.bid)[0];
    addLog(game, `❌ Bid lost: ${rfp.label} — ${winner ? winner.name : "competitor"} won at $${winner?.bid?.toLocaleString() || "?"}.`);
  }

  // Remove from open RFPs
  game.openRFPs.splice(rfpIndex, 1);

  return { success: true, won, winChance: Math.round(winChance * 100) };
}

export function getContractSummary(game) {
  return {
    openRFPs: (game.openRFPs || []).map((r) => ({
      ...r,
      daysLeft: (r.expiresDay || 0) - (game.day || 0),
    })),
    activeContracts: game.activeContracts || [],
    contractCount: (game.activeContracts || []).length,
    weeklyContractIncome: (game.activeContracts || []).reduce((s, c) => s + (c.weeklyPayout || 0), 0),
    totalWon: (game.contractHistory || []).length,
    dailyContractIncome: (game.activeContracts || []).reduce((s, c) => s + Math.round((c.weeklyPayout || 0) / 7), 0),
  };
}
