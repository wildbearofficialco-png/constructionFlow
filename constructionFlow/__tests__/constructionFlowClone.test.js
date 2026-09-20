// Equivalence proof for ConstructionFlow's clone() swap: JSON.parse(JSON.stringify(obj)) ->
// a hand-rolled recursive clone. clone() runs on every game tick plus save prep, so this
// protects both correctness and the performance optimization.
import { clone, freshState } from "../src/games/constructionflow/ConstructionFlowScreen";

function jsonClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function makeRealisticFixture() {
  return {
    cash: 78453.5,
    day: 12,
    reputation: 34,
    gameOver: false,
    gameOverReason: null,
    pendingInspection: null,
    crew: [
      { id: "w1", name: "Sofia Brennan", skill: 100, trait: { label: "Veteran", speed: 1.08 }, certifications: [], stamina: 62.5 },
      { id: "w2", name: "Juno Scott", skill: 90, trait: null, certifications: ["safety_cert"], stamina: 100 },
    ],
    equipment: [
      { id: "e1", name: "Basic Pickup Truck", tier: 1, condition: 100, status: "Idle", upgrades: {} },
    ],
    activeSites: [
      {
        id: "s1", label: "Fence Installation", phases: ["Survey", "Material Delivery"],
        currentPhaseIdx: 0, phaseProgress: 2.4, assignedCrewIds: ["w1"], assignedEquipmentIds: ["e1"],
        materialsFulfilled: { lumber: 20 }, chaosHistory: [],
      },
    ],
    contracts: [
      { id: "c1", defId: "fence", label: "Fence Installation", materials: { lumber: 20 }, phases: ["Survey"] },
    ],
    materials: { concrete: 5, lumber: 0, steel: 0, electrical: 0, plumbing: 0, asphalt: 0 },
    weeklyStats: { revenue: 0, expenses: -12.5, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0 },
    hallOfFame: { biggestContract: 0, highestRep: 0, largestCrew: 0, largestFleet: 0, highestValuation: 0, mostProfitableProject: { label: "", value: 0 } },
    logs: ["Welcome", "Purchased materials"],
    opsFeed: [{ id: "log1", text: "Site started", tone: "green", day: 1 }],
    _milestones: {},
    _generation: 1,
    legacyPerks: [],
  };
}

describe("ConstructionFlow clone()", () => {
  test("realistic nested state matches JSON clone behavior", () => {
    const fixture = makeRealisticFixture();
    expect(clone(fixture)).toEqual(jsonClone(fixture));
  });

  test("freshState clones identically", () => {
    const fixture = freshState();
    expect(clone(fixture)).toEqual(jsonClone(fixture));
  });

  test("primitives pass through unchanged", () => {
    expect(clone(5)).toBe(5);
    expect(clone(-3.25)).toBe(-3.25);
    expect(clone(0)).toBe(0);
    expect(clone("hello")).toBe("hello");
    expect(clone(true)).toBe(true);
    expect(clone(false)).toBe(false);
    expect(clone(null)).toBe(null);
  });

  test("nested arrays and objects are independent copies", () => {
    const original = makeRealisticFixture();
    const cloned = clone(original);
    cloned.activeSites[0].phaseProgress = 50;
    cloned.equipment[0].status = "Broken";
    cloned.crew.push({ id: "new", name: "Injected" });
    expect(original.activeSites[0].phaseProgress).toBe(2.4);
    expect(original.equipment[0].status).toBe("Idle");
    expect(original.crew.length).toBe(2);
  });
});
