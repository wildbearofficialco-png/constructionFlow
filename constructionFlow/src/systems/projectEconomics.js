// Project Economics — per-project profit & loss.
//
// WildBear Core parity note: FleetFlow answers "did that job actually make money?" with
// `fleetflowFirstDeliveryHelpers.js` (gross − operating costs = net profit, plus one
// reinvestment line). Construction Flow needs the same contract, but a construction project
// has a genuinely different cost shape — a delivery burns fuel for a few hours, a project
// burns materials, crew-days and machine-days over a week or more. So the *grammar* is
// shared (gross → itemised direct costs → net → margin → one honest next step) and the
// *line items* are construction's own.
//
// Accounting rule, and the reason this module never touches cash:
// every figure here is ATTRIBUTION of money the game has already moved. Materials are paid
// for at the supplier, wages and machine costs are paid in the daily overhead sweep. This
// ledger only remembers which project those dollars belonged to. Adding a cost here must
// never deduct cash, or the player is charged twice.

// Direct costs are the ones a project causes. Office rent is NOT here on purpose: the rent
// is owed whether or not the project exists, so charging it to the job would understate
// margin and teach the player the wrong lesson about which costs a bid has to cover.
export const PROJECT_COST_CATEGORIES = {
  materials: { label: "Materials", icon: "cube" },
  labor: { label: "Crew wages", icon: "people" },
  equipment: { label: "Equipment", icon: "construct" },
  incidents: { label: "Problems on site", icon: "warning" },
};

export function createProjectCostLedger() {
  return { materials: 0, labor: 0, equipment: 0, incidents: 0, crewDays: 0, equipmentDays: 0 };
}

// Tolerant of old saves: a site that predates cost tracking has no ledger, and gets an empty
// one rather than blocking. `partial` then tells the UI not to claim a precise margin.
export function ensureProjectCostLedger(site) {
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

// Attribution only — see the accounting rule above. Never call this with money the caller
// has not already deducted from g.cash somewhere else.
export function accrueProjectCost(site, category, amount) {
  const value = Number(amount);
  if (!site || !Number.isFinite(value) || value <= 0) return;
  if (!Object.prototype.hasOwnProperty.call(PROJECT_COST_CATEGORIES, category)) return;
  const costs = ensureProjectCostLedger(site);
  costs[category] = (costs[category] || 0) + value;
}

export function accrueProjectCrewDay(site, crewCount, equipmentCount) {
  if (!site) return;
  const costs = ensureProjectCostLedger(site);
  const crew = Number(crewCount);
  const equip = Number(equipmentCount);
  if (Number.isFinite(crew) && crew > 0) costs.crewDays = (costs.crewDays || 0) + crew;
  if (Number.isFinite(equip) && equip > 0) costs.equipmentDays = (costs.equipmentDays || 0) + equip;
}

export function getTotalProjectCost(costs) {
  if (!costs || typeof costs !== "object") return 0;
  return Object.keys(PROJECT_COST_CATEGORIES).reduce((sum, key) => {
    const value = Number(costs[key]);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
}

// The one number the completion screen is really for.
//
// `contractValue` is the headline value the player bid on; `depositPaid` was already banked
// when the project started, so it is part of the project's revenue even though it does not
// arrive in the completion payment. Reporting only the final payment would make every
// project with a deposit look less profitable than it was.
export function buildProjectEconomics({
  contractValue = 0,
  depositPaid = 0,
  penalty = 0,
  qualityBonus = 0,
  costs = null,
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

  // Gross is what the project earned in total, deposit included. The final payment is what
  // actually lands in cash at completion — both are shown, because a player who sees only
  // one of them cannot reconcile the number against their balance.
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
    marginPercent: grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0,
    crewDays: Math.max(0, Math.round(Number(ledger.crewDays) || 0)),
    equipmentDays: Math.max(0, Math.round(Number(ledger.equipmentDays) || 0)),
  };
}

// Office rent, insurance and loan interest are real, but they are company overhead rather
// than project cost. Saying so is the difference between an honest breakdown and one the
// player later discovers was hiding something — same reason FleetFlow spells out that
// driver wages settle at weekly payroll rather than per job.
export const OVERHEAD_NOTE =
  "Office rent, insurance and loan payments are company overhead — they're paid daily whether or not this job runs, so they're not charged against it.";

// One concrete next step, sized to what the project actually cleared. Deliberately a single
// line: this points at the reinvestment loop, it does not try to teach the whole game.
export function getProjectReinvestmentHint(netProfit) {
  const net = Math.round(Number(netProfit) || 0);
  if (net <= 0) {
    return "This one didn't clear its costs. Bid closer to the estimate, buy materials before prices move, and don't leave crew on a stalled site.";
  }
  if (net < 5000) {
    return "Reinvest it: keep materials stocked and take the next bid. A few jobs like this covers your first extra labourer.";
  }
  if (net < 20000) {
    return "Reinvest it: another crew member in Crew lets you run a second site at once — that's the fastest way to double this number.";
  }
  if (net < 75000) {
    return "Reinvest it: a bigger machine in Vehicles unlocks higher-tier contracts that pay far more per crew-day.";
  }
  return "Reinvest it: a second city office in Empire opens larger contracts, or clear debt in Finance to cut your daily burn.";
}

// Shapes the economics into the { title, lines } the completion overlay renders. Kept text-only
// so the overlay stays one modal — no new state field, nothing extra to migrate.
export function buildProjectProfitLines(economics, formatMoney) {
  const fmt = typeof formatMoney === "function" ? formatMoney : (n) => `$${Math.round(n).toLocaleString()}`;
  const lines = [{ label: "Contract value", value: fmt(economics.contractValue), tone: "neutral" }];
  if (economics.qualityBonus > 0) {
    lines.push({ label: "Quality bonus", value: `+${fmt(economics.qualityBonus)}`, tone: "positive" });
  }
  if (economics.penalty > 0) {
    lines.push({ label: "Late penalty", value: `−${fmt(economics.penalty)}`, tone: "negative" });
  }
  if (economics.materials > 0) {
    lines.push({ label: "Materials", value: `−${fmt(economics.materials)}`, tone: "negative" });
  }
  if (economics.labor > 0) {
    lines.push({
      label: economics.crewDays > 0 ? `Crew wages (${economics.crewDays} crew-days)` : "Crew wages",
      value: `−${fmt(economics.labor)}`,
      tone: "negative",
    });
  }
  if (economics.equipment > 0) {
    lines.push({
      label: economics.equipmentDays > 0 ? `Equipment (${economics.equipmentDays} machine-days)` : "Equipment",
      value: `−${fmt(economics.equipment)}`,
      tone: "negative",
    });
  }
  if (economics.incidents > 0) {
    lines.push({ label: "Problems on site", value: `−${fmt(economics.incidents)}`, tone: "negative" });
  }
  return lines;
}

// ─── Pre-bid estimate ─────────────────────────────────────────────────────────
//
// What a project is likely to cost BEFORE the player commits. The WildBear standard
// requires that "displayed price and charged price must use the same calculation path",
// so every input here is resolved by the caller using the same helpers the real charge
// uses — regional material pricing, the player's bulk discount, the player's actual crew
// wages and machine day rates. Nothing is hardcoded.
//
// This is an estimate, not a promise: it assumes the job runs to its target duration with
// the minimum crew. Delays, weather and incidents make the real number worse, which is why
// the completion P&L exists as the honest settlement.
export function estimateProjectCosts({
  contractValue = 0,
  durationDays = 1,
  crewMin = 1,
  equipMin = 0,
  materialUnitCost = 0,
  avgCrewWagePerDay = 0,
  avgEquipmentCostPerDay = 0,
} = {}) {
  const days = Math.max(1, Math.round(Number(durationDays) || 1));
  const crew = Math.max(0, Math.round(Number(crewMin) || 0));
  const machines = Math.max(0, Math.round(Number(equipMin) || 0));

  const materials = Math.max(0, Math.round(Number(materialUnitCost) || 0));
  const labor = Math.max(0, Math.round(crew * (Number(avgCrewWagePerDay) || 0) * days));
  const equipment = Math.max(0, Math.round(machines * (Number(avgEquipmentCostPerDay) || 0) * days));
  const directCosts = materials + labor + equipment;

  const value = Math.max(0, Math.round(Number(contractValue) || 0));
  const netProfit = value - directCosts;

  return {
    contractValue: value,
    materials,
    labor,
    equipment,
    directCosts,
    netProfit,
    marginPercent: value > 0 ? Math.round((netProfit / value) * 100) : 0,
    crewDays: crew * days,
    equipmentDays: machines * days,
  };
}
