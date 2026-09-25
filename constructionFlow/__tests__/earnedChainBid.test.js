import { planBid, rollBidOutcome } from "../src/systems/constructionLoop.js";

describe("earned chain contract bidding", () => {
  const establishedCompany = {
    completedJobs: 12,
    activeSites: [],
    reputation: 45,
    rivals: [],
  };

  test("an unlocked earned chain opportunity is shown as guaranteed", () => {
    const contract = {
      id: "chain-apartment",
      label: "Apartment Block",
      value: 150000,
      category: "Commercial",
      chainGuaranteed: true,
      locked: false,
    };
    const plan = planBid(contract, "premium", establishedCompany);
    expect(plan.guaranteed).toBe(true);
    expect(plan.winChance).toBe(1);
    expect(plan.winPercent).toBe(100);
    expect(plan.riskLabel).toBe("Guaranteed");
  });

  test("an earned eligible opportunity cannot be lost even with a worst-case RNG roll", () => {
    const contract = {
      id: "chain-city-road",
      label: "City Road",
      value: 250000,
      category: "Infrastructure",
      chainGuaranteed: true,
      locked: false,
    };
    const result = rollBidOutcome(contract, "premium", establishedCompany, () => 0.999999);
    expect(result.won).toBe(true);
    expect(result.guaranteed).toBe(true);
  });

  test("a locked chain opportunity is not advertised as bid-guaranteed yet", () => {
    const contract = {
      id: "chain-locked",
      label: "Apartment Block",
      value: 150000,
      category: "Commercial",
      chainGuaranteed: true,
      locked: true,
    };
    const plan = planBid(contract, "standard", establishedCompany);
    expect(plan.guaranteed).toBe(false);
    expect(plan.winChance).toBeLessThan(1);
  });

  test("ordinary public-market contracts remain competitive", () => {
    const contract = {
      id: "public-job",
      label: "Public Job",
      value: 90000,
      category: "Commercial",
      chainGuaranteed: false,
      locked: false,
    };
    const plan = planBid(contract, "premium", establishedCompany);
    expect(plan.guaranteed).toBe(false);
    expect(plan.winChance).toBeLessThan(1);
    const result = rollBidOutcome(contract, "premium", establishedCompany, () => 0.999999);
    expect(result.won).toBe(false);
  });
});
