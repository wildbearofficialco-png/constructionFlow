// Chain opportunities — the bigger contract a finished job earns you.
//
// SPRINT 1 — EARNED, THEN EXPIRED BEFORE IT COULD BE TAKEN. Finishing Residential Renovation put
// Apartment Block (8 crew, tier 3) on the board; finishing Road Patch put City Road (6 crew). A new
// company's office caps the crew at 4 and it owns tier-1 plant. The offer carried a 14-day expiry
// from the moment it appeared, so the player was shown a reward, could not take it by any route
// in that window, and watched it vanish. It could also be sliced off the board by the daily cap.
//
// Now: finishing the prerequisite PERMANENTLY earns the opportunity. It waits on the Bids tab as
// "Locked" with each gate it is waiting on, and no expiry runs while it waits. When the company can
// realistically take it — the capacity to staff and equip it, plant of the tier it asks for, and a
// machine that can open its first phase — it opens, and the normal bid window starts.
//
// Pure: no RNG, no game-state imports. The screen supplies the company's capacity.

import { canStartWithPlant } from "./sitePlant.js";

export const CHAIN_OFFER_DAYS = 14;
export const CHAIN_LOCKED = "Locked";

// company: { crewCap, equipCap, equipment: [...] }
export function chainGates(contract, company) {
  const equipment = Array.isArray(company?.equipment) ? company.equipment : [];
  const bestTier = equipment.reduce((m, e) => Math.max(m, Number(e?.tier) || 0), 0);
  const firstPhase = (contract?.phases || [])[0] || null;
  const opens = canStartWithPlant(contract?.phases || [], equipment, contract?.minTier);
  return [
    { key: "crew", label: "Crew capacity", need: contract?.crewMin || 1, have: company?.crewCap || 0,
      ok: (company?.crewCap || 0) >= (contract?.crewMin || 1),
      hint: "Upgrade your office in Empire to house a bigger crew" },
    { key: "equipment", label: "Machine slots", need: contract?.equipMin || 1, have: company?.equipCap || 0,
      ok: (company?.equipCap || 0) >= (contract?.equipMin || 1),
      hint: "Upgrade your office in Empire for more machine slots" },
    { key: "tier", label: "Plant tier", need: contract?.minTier || 1, have: bestTier,
      ok: bestTier >= (contract?.minTier || 1),
      hint: `Buy a tier ${contract?.minTier || 1}+ machine in Equipment` },
    { key: "first_phase", label: firstPhase ? `Plant for ${firstPhase}` : "Plant for the first phase",
      need: opens.missing ? `${opens.missing.anyOf.join("/")} tier ${opens.missing.minTier}+` : null,
      have: null, ok: opens.ok,
      hint: opens.missing ? opens.missing.action : null },
  ];
}

export function chainReadiness(contract, company) {
  const gates = chainGates(contract, company);
  return { ready: gates.every((g) => g.ok), gates, waitingOn: gates.filter((g) => !g.ok) };
}

// The contract record for a freshly earned opportunity: locked (no expiry) unless already ready.
export function earnChainOpportunity(contract, company, day) {
  const c = { ...contract, isChainUnlock: true, earnedDay: day };
  if (chainReadiness(c, company).ready) {
    c.status = "Open";
    c.expiresDay = day + CHAIN_OFFER_DAYS;
    c.openedDay = day;
  } else {
    c.status = CHAIN_LOCKED;
    c.expiresDay = null;
  }
  return c;
}

// Open any locked opportunity the company can now take. Mutates the contracts; returns those opened.
export function openReadyChainOpportunities(contracts, company, day) {
  const opened = [];
  for (const c of (contracts || [])) {
    if (c?.status !== CHAIN_LOCKED) continue;
    if (!chainReadiness(c, company).ready) continue;
    c.status = "Open";
    c.expiresDay = day + CHAIN_OFFER_DAYS;
    c.openedDay = day;
    opened.push(c);
  }
  return opened;
}

// Has this chain already been earned and not yet used up? Prevents a second copy.
export function hasLiveChainOpportunity(contracts, defId) {
  return (contracts || []).some((c) => c?.isChainUnlock && c.defId === defId && (c.status === CHAIN_LOCKED || c.status === "Open"));
}
