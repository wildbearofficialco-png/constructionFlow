// Licences, inspectors, and theft.
//
// Sprint 12, from three device notes that are really one mechanic: unlicensed operation is the
// risk, the inspection is what discovers it, and theft is the other thing that happens to a
// site you are not watching.
//
// The scaffolding was already there and did nothing. `equipment_cert` had existed since the
// training system was written — $800, five days — and not one line of the simulation read it.
// The game sold a licence to operate heavy plant and then let anyone operate heavy plant.

import {
  OPERATOR_CERT,
  SAFETY_CERTS,
  CATCH_CHANCE_PER_MACHINE,
  SAFETY_OFFICER_RISK_REDUCTION,
  UNSAFE_CONDITION,
  THEFT_MIN_UNITS,
  THEFT_MAX_UNITS,
  isLicensedOperator,
  licensedOperatorCount,
  hasSafetyOfficer,
  heavyPlantOnSite,
  unlicensedMachineCount,
  isRunningUnlicensed,
  catchRiskPerDay,
  fineFor,
  inspectSite,
  describeInspection,
  hasSiteSecurity,
  theftRiskMultiplier,
  describeTheft,
} from "../src/systems/siteCompliance.js";
import { KNOWING_CAP_SHARE, ROUTINE_CAP_SHARE, PENALTY_CEILING } from "../src/systems/penalties.js";

const crane = (id = "c1", over = {}) => ({ id, type: "Lifting", tier: 4, status: "Idle", condition: 90, ...over });
const truck = (id = "t1", over = {}) => ({ id, type: "Utility", tier: 1, status: "Idle", condition: 90, ...over });
const worker = (id, certs = []) => ({ id, name: id, certifications: certs });

function site(over = {}) {
  return { id: "s1", label: "Harbour Works", status: "Active", totalValue: 400000,
           assignedCrewIds: [], assignedEquipmentIds: [], ...over };
}
function game(over = {}) {
  return { crew: [], equipment: [], officeStaff: [], reputation: 50, ...over };
}

describe("who is allowed to run the machine", () => {
  test("the operator certificate is the one the training system already sold", () => {
    expect(OPERATOR_CERT).toBe("equipment_cert");
  });

  test("a worker with the ticket is licensed, one without is not", () => {
    expect(isLicensedOperator(worker("a", ["equipment_cert"]))).toBe(true);
    expect(isLicensedOperator(worker("b", ["safety_cert"]))).toBe(false);
    expect(isLicensedOperator(worker("c"))).toBe(false);
    expect(isLicensedOperator(null)).toBe(false);
  });

  test("a missing certifications array does not crash the check", () => {
    expect(isLicensedOperator({ id: "x" })).toBe(false);
    expect(licensedOperatorCount(null)).toBe(0);
  });
});

describe("only heavy plant needs a ticket", () => {
  test("a pickup truck does not", () => {
    const s = site({ assignedEquipmentIds: ["t1"] });
    expect(heavyPlantOnSite(s, [truck("t1")])).toHaveLength(0);
    expect(unlicensedMachineCount(s, [], [truck("t1")])).toBe(0);
  });

  test("a crane does", () => {
    const s = site({ assignedEquipmentIds: ["c1"] });
    expect(heavyPlantOnSite(s, [crane("c1")])).toHaveLength(1);
    expect(unlicensedMachineCount(s, [], [crane("c1")])).toBe(1);
  });

  test("plant not assigned to THIS site does not count against it", () => {
    const s = site({ assignedEquipmentIds: [] });
    expect(unlicensedMachineCount(s, [], [crane("c1")])).toBe(0);
  });

  test("a broken crane cannot be operated, so it cannot be operated unlicensed", () => {
    const s = site({ assignedEquipmentIds: ["c1"] });
    expect(unlicensedMachineCount(s, [], [crane("c1", { status: "Broken" })])).toBe(0);
  });
});

describe("one ticket covers one machine", () => {
  test("a licensed operator on site covers a crane", () => {
    const s = site({ assignedCrewIds: ["w1"], assignedEquipmentIds: ["c1"] });
    const g = [worker("w1", ["equipment_cert"])];
    expect(unlicensedMachineCount(s, g, [crane("c1")])).toBe(0);
    expect(isRunningUnlicensed(s, g, [crane("c1")])).toBe(false);
  });

  test("but not two cranes", () => {
    // A ticket is a person, not a permit for the yard. This is what makes the second crane
    // cost something beyond its price.
    const s = site({ assignedCrewIds: ["w1"], assignedEquipmentIds: ["c1", "c2"] });
    expect(unlicensedMachineCount(s, [worker("w1", ["equipment_cert"])], [crane("c1"), crane("c2")])).toBe(1);
  });

  test("a licensed worker NOT assigned to this site does not cover it", () => {
    const s = site({ assignedCrewIds: [], assignedEquipmentIds: ["c1"] });
    expect(unlicensedMachineCount(s, [worker("w1", ["equipment_cert"])], [crane("c1")])).toBe(1);
  });
});

describe("getting caught is a risk, not a gate", () => {
  test("running unlicensed is permitted — it just carries a chance", () => {
    // The report's exact ask: "you CAN accept the jobs and have your employees operate the
    // equipment, but if they get caught you get a penalty charge."
    const s = site({ assignedEquipmentIds: ["c1"] });
    const risk = catchRiskPerDay(s, game({ equipment: [crane("c1")] }));
    expect(risk).toBeGreaterThan(0);
    expect(risk).toBeLessThan(0.2);
  });

  test("compliant sites carry no risk at all", () => {
    const s = site({ assignedCrewIds: ["w1"], assignedEquipmentIds: ["c1"] });
    const g = game({ crew: [worker("w1", ["equipment_cert"])], equipment: [crane("c1")] });
    expect(catchRiskPerDay(s, g)).toBe(0);
  });

  test("more unlicensed machines means more risk", () => {
    const one = site({ assignedEquipmentIds: ["c1"] });
    const two = site({ assignedEquipmentIds: ["c1", "c2"] });
    const g = game({ equipment: [crane("c1"), crane("c2")] });
    expect(catchRiskPerDay(two, g)).toBeGreaterThan(catchRiskPerDay(one, g));
  });

  test("a Safety Officer is the player's lever on it", () => {
    const s = site({ assignedEquipmentIds: ["c1"] });
    const without = catchRiskPerDay(s, game({ equipment: [crane("c1")] }));
    const with_ = catchRiskPerDay(s, game({ equipment: [crane("c1")], officeStaff: [{ role: "Safety Officer" }] }));
    expect(with_).toBeCloseTo(without * (1 - SAFETY_OFFICER_RISK_REDUCTION), 10);
    expect(hasSafetyOfficer(game({ officeStaff: [{ role: "Safety Officer" }] }))).toBe(true);
  });
});

describe("the fine", () => {
  // Sprint 1: fines come from the one penalty rule (systems/penalties.js). The old flat $1,200
  // floor took 13% of a $9,000 starter fence for a routine visit, and more of anything smaller.
  test("scales with the site, so it means something at every size", () => {
    expect(fineFor(site({ totalValue: 2000000 }))).toBeGreaterThan(fineFor(site({ totalValue: 200000 })));
  });

  test("never takes more than its share of the job, and never exceeds the ceiling", () => {
    const tiny = 3000;
    expect(fineFor(site({ totalValue: tiny }))).toBeLessThanOrEqual(tiny * KNOWING_CAP_SHARE);
    expect(fineFor(site({ totalValue: tiny }), 1, { knowing: false })).toBeLessThanOrEqual(tiny * ROUTINE_CAP_SHARE);
    expect(fineFor(site({ totalValue: 5e9 }))).toBe(PENALTY_CEILING);
  });

  test("running unlicensed (knowing) costs more than a housekeeping finding", () => {
    const s = site({ totalValue: 500000 });
    expect(fineFor(s, 3, { knowing: true })).toBeGreaterThan(fineFor(s, 1, { knowing: false }));
  });

  test("a Safety Officer argues it down", () => {
    const s = site({ totalValue: 500000 });
    expect(fineFor(s, 3, { mitigated: true })).toBeLessThan(fineFor(s, 3));
  });

  test("a site with no recorded value cannot produce a fine out of nothing", () => {
    expect(fineFor(site({ totalValue: undefined }))).toBe(0);
    expect(fineFor(null)).toBe(0);
  });
});

describe("the inspection is resolved, not rolled", () => {
  test("a compliant site passes every time", () => {
    // The difference between an inspector and a slot machine. A player who trained their
    // operators and maintained their plant should pass, and know why.
    const s = site({ assignedCrewIds: ["w1", "w2", "w3"], assignedEquipmentIds: ["c1"] });
    const g = game({
      crew: [worker("w1", ["equipment_cert", "safety_cert"]), worker("w2"), worker("w3")],
      equipment: [crane("c1", { condition: 95 })],
    });
    const res = inspectSite(s, g);
    expect(res.passed).toBe(true);
    expect(res.fine).toBe(0);
    expect(res.reputationGain).toBeGreaterThan(0);
    expect(describeInspection(res)).toContain("nothing");
  });

  test("unlicensed operation is the most serious finding", () => {
    const s = site({ assignedEquipmentIds: ["c1"] });
    const res = inspectSite(s, game({ equipment: [crane("c1")] }));
    const f = res.findings.find((x) => x.code === "unlicensed_operation");
    expect(f).toBeTruthy();
    expect(f.severity).toBe(3);
    expect(f.fix).toContain("Equipment Certification");
  });

  test("plant below safe condition is cited in its own right", () => {
    const s = site({ assignedCrewIds: ["w1"], assignedEquipmentIds: ["c1"] });
    const g = game({
      crew: [worker("w1", ["equipment_cert", "safety_cert"])],
      equipment: [crane("c1", { condition: UNSAFE_CONDITION - 1 })],
    });
    expect(inspectSite(s, g).findings.map((f) => f.code)).toContain("defective_plant");
  });

  test("a big crew with nobody safety-trained is cited", () => {
    const s = site({ assignedCrewIds: ["w1", "w2", "w3"], assignedEquipmentIds: [] });
    const g = game({ crew: [worker("w1"), worker("w2"), worker("w3")] });
    expect(inspectSite(s, g).findings.map((f) => f.code)).toContain("no_safety_training");
  });

  test("a two-person crew is not", () => {
    const s = site({ assignedCrewIds: ["w1", "w2"], assignedEquipmentIds: [] });
    const g = game({ crew: [worker("w1"), worker("w2")] });
    expect(inspectSite(s, g).passed).toBe(true);
  });

  test("more findings cost more", () => {
    const clean = site({ assignedCrewIds: ["w1"], assignedEquipmentIds: [] });
    const messy = site({ assignedCrewIds: ["w1", "w2", "w3"], assignedEquipmentIds: ["c1"] });
    const g = game({ crew: [worker("w1"), worker("w2"), worker("w3")], equipment: [crane("c1", { condition: 10 })] });
    expect(inspectSite(messy, g).fine).toBeGreaterThan(inspectSite(clean, g).fine);
  });

  test("a Safety Officer argues it down but does not hide it", () => {
    const s = site({ assignedEquipmentIds: ["c1"] });
    const plain = inspectSite(s, game({ equipment: [crane("c1")] }));
    const covered = inspectSite(s, game({ equipment: [crane("c1")], officeStaff: [{ role: "Safety Officer" }] }));
    expect(covered.findings.length).toBe(plain.findings.length);
    expect(covered.fine).toBeLessThan(plain.fine);
    expect(covered.mitigated).toBe(true);
  });

  test("the reputation hit is bounded", () => {
    const s = site({ assignedCrewIds: ["w1", "w2", "w3"], assignedEquipmentIds: ["c1", "c2"] });
    const g = game({ crew: [worker("w1"), worker("w2"), worker("w3")], equipment: [crane("c1", { condition: 5 }), crane("c2", { condition: 5 })] });
    expect(inspectSite(s, g).reputationHit).toBeLessThanOrEqual(6);
  });

  test("the safety certificates it accepts are the ones the training system issues", () => {
    expect(SAFETY_CERTS).toEqual(expect.arrayContaining(["safety_cert", "safety_mgmt_cert"]));
  });
});

describe("theft", () => {
  test("site security is a standing choice that cuts the risk", () => {
    expect(theftRiskMultiplier({ siteSecurity: false })).toBe(1);
    expect(theftRiskMultiplier({ siteSecurity: true })).toBeLessThan(1);
    expect(hasSiteSecurity({ siteSecurity: true })).toBe(true);
  });

  test("the notice says what went and what replacing it costs", () => {
    // It already forced a re-delivery. What it never did was tell anyone.
    const d = describeTheft("steel", 4, 950);
    expect(d.replacementCost).toBe(3800);
    expect(d.message).toContain("4 steel");
    expect(d.message).toContain("3,800");
    expect(d.message).toContain("cannot finish");
  });

  test("an unpriced material still produces a usable sentence", () => {
    expect(describeTheft("mystery", 3, 0).message).toContain("re-delivered");
  });

  test("the units taken stay in a sane band", () => {
    expect(THEFT_MIN_UNITS).toBeGreaterThan(0);
    expect(THEFT_MAX_UNITS).toBeGreaterThan(THEFT_MIN_UNITS);
  });
});
