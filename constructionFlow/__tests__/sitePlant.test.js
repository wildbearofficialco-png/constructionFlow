// Plant requirements.
//
// Sprint 12, from the device: "if you're going to be doing a job, it should require certain
// equipment. I don't feel like you should be able to use any equipment for any job."
//
// The code agreed. Equipment type was a bonus whose reduce floor was 1.0, so the WRONG machine
// and NO machine were worth exactly the same, and nothing ever said "you cannot do this
// without a crane."

import {
  PHASE_PLANT_REQUIREMENTS,
  PLANT_TYPES,
  HEAVY_TIER,
  STALL_FACTOR,
  isUsable,
  requirementFor,
  satisfies,
  missingPlantFor,
  canStartWithPlant,
  plantPlanFor,
  plantProgressFactor,
} from "../src/systems/sitePlant.js";

const machine = (over = {}) => ({ id: "m1", type: "Earthwork", tier: 2, status: "Idle", ...over });

describe("a machine only counts if it can actually work", () => {
  test("idle and active plant counts", () => {
    expect(isUsable(machine({ status: "Idle" }))).toBe(true);
    expect(isUsable(machine({ status: "Active" }))).toBe(true);
  });

  test("broken, in-maintenance and sold plant does not", () => {
    // A broken machine on the books is not plant on site. This is the whole reason a
    // breakdown is felt at all.
    for (const status of ["Broken", "Maintenance", "Sold"]) {
      expect({ status, usable: isUsable(machine({ status })) }).toEqual({ status, usable: false });
    }
  });

  test("nothing is not a machine", () => {
    expect(isUsable(null)).toBe(false);
    expect(isUsable(undefined)).toBe(false);
  });
});

describe("the requirement is real", () => {
  test("piling demands foundation plant and will not take a pickup", () => {
    const pickup = machine({ type: "Earthwork", tier: 1 });
    expect(satisfies("Piling", [pickup])).toBe(false);
    expect(satisfies("Piling", [machine({ type: "Foundation", tier: 4 })])).toBe(true);
  });

  test("a tier below the minimum does not satisfy it", () => {
    // A mini excavator is Earthwork, but it is not a commercial excavation.
    expect(satisfies("Excavation", [machine({ type: "Earthwork", tier: 1 })])).toBe(false);
    expect(satisfies("Excavation", [machine({ type: "Earthwork", tier: 2 })])).toBe(true);
  });

  test("the wrong machine and no machine are no longer the same thing", () => {
    // The exact defect. Both of these used to yield a 1.0 multiplier.
    const wrong = [machine({ type: "Utility", tier: 1 })];
    expect(satisfies("Structural Steel", wrong)).toBe(false);
    expect(satisfies("Structural Steel", [])).toBe(false);
    expect(satisfies("Structural Steel", [machine({ type: "Lifting", tier: 3 })])).toBe(true);
  });

  test("a broken crane does not satisfy a lifting phase", () => {
    expect(satisfies("Structure", [machine({ type: "Lifting", tier: 4, status: "Broken" })])).toBe(false);
  });

  test("any one of the accepted types is enough", () => {
    const req = requirementFor("Foundation");
    expect(req.anyOf.length).toBeGreaterThan(1);
    for (const type of req.anyOf) {
      expect({ type, ok: satisfies("Foundation", [machine({ type, tier: req.minTier })]) })
        .toEqual({ type, ok: true });
    }
  });

  test("trade-labour phases require nothing, on purpose", () => {
    // People with hand tools do fit-out. Demanding a machine for it would be theatre.
    for (const phase of ["Finish Work", "Finishes", "Fitout", "Interior", "MEP", "Commissioning", "Inspection"]) {
      expect({ phase, req: requirementFor(phase) }).toEqual({ phase, req: null });
      expect(satisfies(phase, [])).toBe(true);
    }
  });

  test("an unknown phase name never blocks the player", () => {
    // A phase added later without a requirement entry must be permissive, not a wall.
    expect(satisfies("Some Future Phase", [])).toBe(true);
  });
});

describe("the catalog is coherent", () => {
  test("every requirement names types the equipment shop actually sells", () => {
    const bad = [];
    for (const [phase, req] of Object.entries(PHASE_PLANT_REQUIREMENTS)) {
      for (const t of req.anyOf) if (!PLANT_TYPES.includes(t)) bad.push(`${phase}: ${t}`);
    }
    expect(bad).toEqual([]);
  });

  test("no requirement asks for a tier above what exists", () => {
    const bad = Object.entries(PHASE_PLANT_REQUIREMENTS)
      .filter(([, r]) => !(r.minTier >= 1 && r.minTier <= 4))
      .map(([p]) => p);
    expect(bad).toEqual([]);
  });

  test("every requirement explains itself", () => {
    // The message the player reads is built from `why`. A missing one produces a sentence that
    // trails off into nothing.
    const bad = Object.entries(PHASE_PLANT_REQUIREMENTS)
      .filter(([, r]) => typeof r.why !== "string" || r.why.length < 10)
      .map(([p]) => p);
    expect(bad).toEqual([]);
  });
});

describe("what the player is told", () => {
  test("missing plant names the type, the tier and the reason", () => {
    const m = missingPlantFor("Piling", [machine({ type: "Earthwork", tier: 1 })]);
    expect(m.summary).toContain("Foundation");
    expect(m.summary).toContain("tier 4");
    expect(m.why.length).toBeGreaterThan(10);
  });

  test("owning the right machine but broken gives a DIFFERENT instruction", () => {
    // "Buy a crane" and "repair your crane" need completely different actions from the player.
    const broken = missingPlantFor("Structure", [machine({ type: "Lifting", tier: 3, status: "Broken" })]);
    expect(broken.ownedButUnusable).toBe(true);
    expect(broken.action).toContain("Repair");

    const none = missingPlantFor("Structure", []);
    expect(none.ownedButUnusable).toBe(false);
    expect(none.action).toContain("Buy or assign");
  });

  test("nothing missing reports nothing", () => {
    expect(missingPlantFor("Piling", [machine({ type: "Foundation", tier: 4 })])).toBeNull();
    expect(missingPlantFor("Finish Work", [])).toBeNull();
  });
});

describe("starting a job", () => {
  test("only the FIRST phase gates the start", () => {
    // A contractor wins the job then hires in. Demanding a tower crane for a fit-out six
    // months away would mean never being able to take the work.
    const phases = ["Site Prep", "Piling", "Structural Steel"];
    const onlyEarthwork = [machine({ type: "Earthwork", tier: 2 })];
    expect(canStartWithPlant(phases, onlyEarthwork).ok).toBe(true);
  });

  test("but the first phase really does gate it", () => {
    const res = canStartWithPlant(["Piling", "Finish Work"], [machine({ type: "Earthwork", tier: 1 })]);
    expect(res.ok).toBe(false);
    expect(res.missing.phase).toBe("Piling");
  });

  test("a job with no phases is not blocked", () => {
    expect(canStartWithPlant([], []).ok).toBe(true);
    expect(canStartWithPlant(null, null).ok).toBe(true);
  });

  test("the plan shows every phase, so nothing is a surprise at phase four", () => {
    const plan = plantPlanFor(["Site Prep", "Piling", "Finish Work"], [machine({ type: "Earthwork", tier: 2 })]);
    expect(plan.map((p) => p.phase)).toEqual(["Site Prep", "Piling", "Finish Work"]);
    expect(plan[0].satisfied).toBe(true);
    expect(plan[1].satisfied).toBe(false);
    expect(plan[2].required).toBeNull();
    expect(plan[2].satisfied).toBe(true);
  });
});

describe("losing plant mid-phase", () => {
  test("progress crawls rather than stopping", () => {
    // A machine breaking through no fault of the player must be a setback, never a dead save.
    expect(plantProgressFactor("Piling", [])).toBe(STALL_FACTOR);
    expect(STALL_FACTOR).toBeGreaterThan(0);
    expect(STALL_FACTOR).toBeLessThan(1);
  });

  test("full rate with the right plant", () => {
    expect(plantProgressFactor("Piling", [machine({ type: "Foundation", tier: 4 })])).toBe(1.0);
  });

  test("a phase with no requirement is never stalled", () => {
    expect(plantProgressFactor("Finish Work", [])).toBe(1.0);
  });
});

describe("heavy plant", () => {
  test("the licence threshold is shared with the compliance module", () => {
    expect(HEAVY_TIER).toBe(3);
  });
});
