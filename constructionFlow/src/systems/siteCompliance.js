// Compliance: licences, inspectors, and the things that go missing overnight.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 12, from three device notes that turn out to be one mechanic:
//
//   "Maybe you have some heavy equipment on the job site, but you don't have anybody who is
//    licensed or trained. You can accept the jobs and have your employees operate the equipment
//    but if they get caught without the certification or license, you get a penalty charge."
//
//   "Suggestions for future pop-ups would be OSHA inspections."
//
//   "If material is stolen from the job site you will need to replace it."
//
// The first is a risk. The second is the thing that discovers the risk. They are the same
// system, and building either alone would be half a mechanic.
//
// WHAT WAS ALREADY THERE, AND WHY IT DID NOTHING
// ----------------------------------------------
// `equipment_cert` has existed since the training system was written:
//
//     { id: "equipment_cert", label: "Equipment Certification", cost: 800, duration: 5,
//       skillBonus: 8, certId: "equipment_cert" },
//
// A player could pay $800, wait five days, and earn it. Nothing in the entire game read it.
// The only certificate the simulation looked at was `safety_cert`, for a flat +5% progress.
// So the game sold a licence to operate heavy plant, and then let anyone operate heavy plant.
//
// Material theft was the same shape in reverse — it already worked, and was invisible:
//
//     site.materialsFulfilled[_matId] = Math.max(0, (...) - 2);
//     addLog(game, `Material theft at ${site.label} — inventory reduced.`);
//
// Two units of one material, announced in a scrolling log. The player must indeed re-deliver
// them, exactly as asked for — they just never found out it had happened.
//
// THE DESIGN RULE THE REPORT SPECIFIES
// ------------------------------------
// "You CAN accept the jobs and have your employees operate the equipment." Unlicensed operation
// is permitted. It is not blocked, it is not prevented, and it is not nagged about. It is a
// gamble the player is allowed to take, and losing it costs money and reputation. That is a far
// better mechanic than a gate, and it is what was asked for.
//
// Everything here is pure. The randomness lives at the call sites, which pass in their own roll.

import { HEAVY_TIER, isUsable } from "./sitePlant.js";

export const OPERATOR_CERT = "equipment_cert";
export const SAFETY_CERTS = ["safety_cert", "safety_mgmt_cert"];

// Daily chance of being caught running heavy plant unlicensed, per unlicensed machine.
// Low enough to be a gamble worth taking, high enough that a habit is punished.
export const CATCH_CHANCE_PER_MACHINE = 0.035;

// A Safety Officer on the office staff is the player's lever: they run the paperwork and the
// toolbox talks, and the inspector finds less. The role already existed and, like the
// certificate, did almost nothing.
export const SAFETY_OFFICER_RISK_REDUCTION = 0.45;

// Fines are a share of the site's value so they scale with the company, with a floor and a
// ceiling so they are never trivial and never a death sentence.
export const FINE_SHARE_OF_SITE = 0.02;
export const MIN_FINE = 1200;
export const MAX_FINE = 45000;

// How often an inspector turns up, per site, per day.
export const INSPECTION_CHANCE_PER_DAY = 0.012;

// Equipment below this condition is a citable defect in its own right.
export const UNSAFE_CONDITION = 35;

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function num(v, f = 0) {
  return Number.isFinite(v) ? v : f;
}

// ─── Who may operate what ────────────────────────────────────────────────────

export function isLicensedOperator(worker) {
  return arr(worker?.certifications).includes(OPERATOR_CERT);
}

export function licensedOperatorCount(crew) {
  return arr(crew).filter(isLicensedOperator).length;
}

export function hasSafetyOfficer(game) {
  return arr(game?.officeStaff).some((s) => s && s.role === "Safety Officer");
}

// Heavy plant assigned to a site, which is the only plant a licence is about. A pickup truck
// does not need a ticket.
export function heavyPlantOnSite(site, equipment) {
  const ids = arr(site?.assignedEquipmentIds);
  return arr(equipment).filter(
    (e) => e && ids.includes(e.id) && num(e.tier, 1) >= HEAVY_TIER && isUsable(e)
  );
}

// The core reading: how many heavy machines on this site have nobody qualified to run them.
//
// One licensed operator covers one machine. That is the rule a site actually works under — a
// ticket is a person, not a permit for the yard — and it makes the second crane genuinely cost
// something beyond its price tag.
export function unlicensedMachineCount(site, crew, equipment) {
  const heavy = heavyPlantOnSite(site, equipment);
  if (heavy.length === 0) return 0;
  const assigned = arr(site?.assignedCrewIds);
  const licensed = arr(crew).filter((w) => w && assigned.includes(w.id) && isLicensedOperator(w)).length;
  return Math.max(0, heavy.length - licensed);
}

export function isRunningUnlicensed(site, crew, equipment) {
  return unlicensedMachineCount(site, crew, equipment) > 0;
}

// ─── Getting caught ──────────────────────────────────────────────────────────

export function catchRiskPerDay(site, game) {
  const unlicensed = unlicensedMachineCount(site, game?.crew, game?.equipment);
  if (unlicensed <= 0) return 0;
  const base = 1 - Math.pow(1 - CATCH_CHANCE_PER_MACHINE, unlicensed);
  return hasSafetyOfficer(game) ? base * (1 - SAFETY_OFFICER_RISK_REDUCTION) : base;
}

export function fineFor(site, multiplier = 1) {
  const value = num(site?.totalValue, 0);
  const raw = Math.round(value * FINE_SHARE_OF_SITE * multiplier);
  return Math.max(MIN_FINE, Math.min(MAX_FINE, raw));
}

// ─── The inspection ──────────────────────────────────────────────────────────

// An inspection is resolved against what is ACTUALLY true of the site, not rolled for. That is
// the difference between an inspector and a slot machine: a player who trained operators,
// maintained their plant and hired a Safety Officer should pass, every time, and know why.
export function inspectSite(site, game) {
  const findings = [];

  const unlicensed = unlicensedMachineCount(site, game?.crew, game?.equipment);
  if (unlicensed > 0) {
    findings.push({
      code: "unlicensed_operation",
      severity: 3,
      detail: `${unlicensed} heavy machine${unlicensed === 1 ? "" : "s"} being operated without a certified operator`,
      fix: "Train crew on Equipment Certification in the Crew tab.",
    });
  }

  const ids = arr(site?.assignedEquipmentIds);
  const unsafe = arr(game?.equipment).filter(
    (e) => e && ids.includes(e.id) && num(e.condition, 100) < UNSAFE_CONDITION
  );
  if (unsafe.length > 0) {
    findings.push({
      code: "defective_plant",
      severity: 2,
      detail: `${unsafe.length} machine${unsafe.length === 1 ? "" : "s"} on site below safe working condition`,
      fix: "Repair or retire the machine before it is used again.",
    });
  }

  const assignedCrew = arr(game?.crew).filter((w) => w && arr(site?.assignedCrewIds).includes(w.id));
  const anySafetyTrained = assignedCrew.some((w) =>
    arr(w.certifications).some((c) => SAFETY_CERTS.includes(c))
  );
  if (assignedCrew.length >= 3 && !anySafetyTrained) {
    findings.push({
      code: "no_safety_training",
      severity: 1,
      detail: "no safety-trained crew member on a site of three or more",
      fix: "Put someone through the Safety Course.",
    });
  }

  const severity = findings.reduce((s, f) => s + f.severity, 0);
  const mitigated = hasSafetyOfficer(game);

  return {
    passed: findings.length === 0,
    findings,
    severity,
    mitigated,
    // A Safety Officer does not hide a violation — they argue it down.
    fine: findings.length === 0 ? 0 : fineFor(site, severity * (mitigated ? 0.6 : 1)),
    reputationHit: findings.length === 0 ? 0 : Math.min(6, severity),
    reputationGain: findings.length === 0 ? 1 : 0,
  };
}

export function describeInspection(result) {
  if (!result) return "";
  if (result.passed) {
    return "Inspector walked the site and found nothing. Clean record, and it counts for something.";
  }
  const lines = result.findings.map((f) => `• ${f.detail}`);
  return `Inspector cited ${result.findings.length} issue${result.findings.length === 1 ? "" : "s"}:\n${lines.join("\n")}`;
}

// ─── Theft ───────────────────────────────────────────────────────────────────

// Theft already worked — it reduced `site.materialsFulfilled` so the player genuinely had to
// re-deliver. What it never did was say what had gone, or what replacing it would cost. A
// silent two-unit decrement inside a scrolling log is indistinguishable from nothing happening.
export const THEFT_MIN_UNITS = 2;
export const THEFT_MAX_UNITS = 6;

// Site security is the counter-measure, and like the Safety Officer it is a standing choice
// rather than a reaction.
export const SECURITY_RISK_REDUCTION = 0.6;

export function hasSiteSecurity(game) {
  return Boolean(game?.siteSecurity);
}

export function theftRiskMultiplier(game) {
  return hasSiteSecurity(game) ? 1 - SECURITY_RISK_REDUCTION : 1;
}

// What was taken, priced, so the notice can say something useful instead of "inventory reduced".
export function describeTheft(materialId, units, unitCost) {
  const cost = Math.round(num(unitCost, 0) * num(units, 0));
  return {
    materialId,
    units,
    replacementCost: cost,
    message: cost > 0
      ? `${units} ${materialId} stolen overnight — about $${cost.toLocaleString()} to replace, and the phase cannot finish without it.`
      : `${units} ${materialId} stolen overnight — it has to be re-delivered before the phase can finish.`,
  };
}
