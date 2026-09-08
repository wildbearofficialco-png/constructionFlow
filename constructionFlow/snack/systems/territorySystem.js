// Territory & Delivery Zone System
// Players unlock city districts/zones for bonus payouts, exclusive job types,
// and daily zone-presence income. Competitors can contest zones.
// Each game type maps zones to their business context.

import { clamp, rand, pick, uid, addLog } from "./utils.js";

export const ZONE_TYPES = {
  fleet: [
    { id: "downtown",    label: "Downtown Core",      unlockCost: 3500,  repRequired: 20, payoutMult: 1.12, exclusiveTag: "rush",       presenceIncome: 45,  competitorWeight: 3, desc: "High-volume commercial deliveries, rush premium" },
    { id: "industrial",  label: "Industrial District", unlockCost: 5000,  repRequired: 35, payoutMult: 1.18, exclusiveTag: "heavy",      presenceIncome: 60,  competitorWeight: 2, desc: "Bulk freight, manufacturing accounts" },
    { id: "airport",     label: "Airport Corridor",    unlockCost: 8000,  repRequired: 50, payoutMult: 1.25, exclusiveTag: "time_critical", presenceIncome: 80, competitorWeight: 4, desc: "Time-critical cargo, highest payout density" },
    { id: "suburbs",     label: "Suburban Network",    unlockCost: 4500,  repRequired: 30, payoutMult: 1.08, exclusiveTag: "residential", presenceIncome: 50,  competitorWeight: 1, desc: "High volume, reliable steady income" },
    { id: "port",        label: "Port & Docks",        unlockCost: 9500,  repRequired: 60, payoutMult: 1.35, exclusiveTag: "hazmat",     presenceIncome: 95,  competitorWeight: 3, desc: "Hazmat and container logistics, top rates" },
    { id: "medical",     label: "Medical Zone",         unlockCost: 12000, repRequired: 70, payoutMult: 1.40, exclusiveTag: "priority",   presenceIncome: 110, competitorWeight: 2, desc: "Medical supply chain, highest trust required" },
  ],
  construction: [
    { id: "residential", label: "Residential Builds",  unlockCost: 4000,  repRequired: 20, payoutMult: 1.10, exclusiveTag: "housing",    presenceIncome: 40,  competitorWeight: 2, desc: "Subdivision and home builds" },
    { id: "commercial",  label: "Commercial District", unlockCost: 7000,  repRequired: 40, payoutMult: 1.20, exclusiveTag: "commercial", presenceIncome: 65,  competitorWeight: 3, desc: "Office parks, retail builds" },
    { id: "government",  label: "Gov. Infrastructure", unlockCost: 12000, repRequired: 65, payoutMult: 1.35, exclusiveTag: "gov",        presenceIncome: 100, competitorWeight: 1, desc: "Public works, highest contract stability" },
  ],
  restaurant: [
    { id: "downtown",    label: "Downtown Foot Traffic", unlockCost: 3000, repRequired: 25, payoutMult: 1.15, exclusiveTag: "catering",  presenceIncome: 55,  competitorWeight: 3, desc: "Peak lunch rush, corporate catering" },
    { id: "university",  label: "University District",   unlockCost: 2500, repRequired: 15, payoutMult: 1.08, exclusiveTag: "student",   presenceIncome: 40,  competitorWeight: 2, desc: "Consistent volume, budget-sensitive" },
    { id: "upscale",     label: "Upscale Quarter",       unlockCost: 6000, repRequired: 55, payoutMult: 1.28, exclusiveTag: "premium",   presenceIncome: 80,  competitorWeight: 4, desc: "Fine dining demand, premium clientele" },
  ],
  realestate: [
    { id: "urban_core",  label: "Urban Core",           unlockCost: 15000, repRequired: 30, payoutMult: 1.15, exclusiveTag: "highrise",  presenceIncome: 90,  competitorWeight: 4, desc: "High-density multi-family" },
    { id: "suburb_dev",  label: "Suburb Development",   unlockCost: 10000, repRequired: 20, payoutMult: 1.10, exclusiveTag: "sfh",       presenceIncome: 70,  competitorWeight: 2, desc: "SFH and townhome market" },
    { id: "luxury",      label: "Luxury Market",         unlockCost: 25000, repRequired: 60, payoutMult: 1.30, exclusiveTag: "luxury",    presenceIncome: 150, competitorWeight: 3, desc: "Premium listings, biggest margins" },
  ],
};

export function initTerritories(game, businessType) {
  if (game.territories) return;
  const zones = ZONE_TYPES[businessType] || ZONE_TYPES.fleet;
  game.territories = {
    businessType,
    unlockedZones: [],
    contestedZones: [],
    totalPresenceIncome: 0,
    lastPresenceDay: 0,
  };
}

// Unlock a zone by spending cash
export function unlockZone(game, zoneId, businessType) {
  const zones = ZONE_TYPES[businessType || game.territories?.businessType] || ZONE_TYPES.fleet;
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return { success: false, reason: "Zone not found" };

  const already = (game.territories?.unlockedZones || []).includes(zoneId);
  if (already) return { success: false, reason: "Zone already unlocked" };

  if ((game.reputation || 0) < zone.repRequired) {
    return { success: false, reason: `Need ${zone.repRequired} reputation` };
  }
  if ((game.cash || 0) < zone.unlockCost) {
    return { success: false, reason: `Need $${zone.unlockCost.toLocaleString()} to unlock` };
  }

  game.cash -= zone.unlockCost;
  if (!game.territories) initTerritories(game, businessType);
  game.territories.unlockedZones.push(zoneId);
  addLog(game, `🗺️ Zone unlocked: ${zone.label} — ${zone.desc}. Presence income: $${zone.presenceIncome}/day.`);
  return { success: true, zone };
}

// Daily tick — collect presence income and update contested status
export function tickTerritories(game) {
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

    // Check if competitors are in this zone
    const competitors = game.aiCompetitors || [];
    const avgCompRep = competitors.length > 0
      ? competitors.reduce((s, c) => s + (c.reputation || 50), 0) / competitors.length
      : 0;
    const contested = avgCompRep > (game.reputation || 0) + 10 && Math.random() < zone.competitorWeight * 0.08;

    const incomeMult = contested ? 0.65 : 1.0;
    const dailyIncome = Math.round(zone.presenceIncome * incomeMult * (1 + (game.reputation || 0) * 0.002));

    game.cash = (game.cash || 0) + dailyIncome;
    totalIncome += dailyIncome;

    if (contested) {
      contestedNow.push(zoneId);
      if (Math.random() < 0.25) {
        addLog(game, `⚠ ${zone.label} is contested — presence income reduced. Build reputation to defend territory.`);
      }
    }
  });

  t.totalPresenceIncome = totalIncome;
  t.contestedZones = contestedNow;

  // Presence income boosts demand score slightly
  if (totalIncome > 0 && game.economy) {
    game.economy.demandIndex = clamp((game.economy.demandIndex || 1.0) + 0.005 * t.unlockedZones.length, 0.5, 1.8);
  }
}

// Get payout multiplier for a job based on its tag and unlocked zones
export function getZonePayoutMult(game, jobTag, businessType) {
  if (!game.territories) return 1.0;
  const zones = ZONE_TYPES[businessType || game.territories.businessType] || ZONE_TYPES.fleet;
  const unlockedZones = (game.territories?.unlockedZones || []).map((id) => zones.find((z) => z.id === id)).filter(Boolean);

  if (unlockedZones.length === 0) return 1.0;

  // If job tag matches an exclusive zone tag, apply that zone's multiplier
  const matchingZone = unlockedZones.find((z) => z.exclusiveTag === jobTag);
  if (matchingZone) return matchingZone.payoutMult;

  // Otherwise average of all unlocked zone multipliers (presence knowledge)
  const avgMult = unlockedZones.reduce((s, z) => s + z.payoutMult, 0) / unlockedZones.length;
  return clamp(1.0 + (avgMult - 1.0) * 0.35, 1.0, 1.40);
}

export function getTerritoryStatus(game, businessType) {
  const type = businessType || game.territories?.businessType || "fleet";
  const zones = ZONE_TYPES[type] || ZONE_TYPES.fleet;
  const unlocked = game.territories?.unlockedZones || [];
  const contested = game.territories?.contestedZones || [];

  return {
    zones: zones.map((z) => ({
      ...z,
      isUnlocked: unlocked.includes(z.id),
      isContested: contested.includes(z.id),
      canUnlock: (game.reputation || 0) >= z.repRequired && (game.cash || 0) >= z.unlockCost && !unlocked.includes(z.id),
    })),
    unlockedCount: unlocked.length,
    totalZones: zones.length,
    dailyPresenceIncome: game.territories?.totalPresenceIncome || 0,
    contestedCount: contested.length,
  };
}
