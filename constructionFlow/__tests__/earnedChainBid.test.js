import { planBid, rollBidOutcome } from "../src/systems/constructionLoop.js";
import { earnChainOpportunity, openReadyChainOpportunities } from "../src/systems/chainOpportunities.js";

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
  // The fields above are a test convenience. The live game builds an earned offer with
  // earnChainOpportunity(): `isChainUnlock`, and status "Locked" until the company can take it.
  // The guarantee must follow THAT record, or it never fires in a real game.
  test("the offer the live game actually builds is guaranteed once open, and not while locked", () => {
    const def = {
      id: "chain_live", defId: "apartment", label: "Apartment Block", value: 150000, category: "Commercial",
      phases: ["Excavation"], minTier: 3, crewMin: 8, equipMin: 3,
    };
    const small = { crewCap: 4, equipCap: 2, equipment: [{ type: "Earthwork", tier: 1, status: "Idle" }] };
    const big = { crewCap: 10, equipCap: 4, equipment: [{ type: "Earthwork", tier: 3, status: "Idle" }] };

    const offer = earnChainOpportunity(def, small, 20);
    expect(offer.status).toBe("Locked");
    expect(planBid(offer, "premium", establishedCompany).guaranteed).toBe(false);

    openReadyChainOpportunities([offer], big, 30);
    expect(offer.status).toBe("Open");
    const plan = planBid(offer, "premium", establishedCompany);
    expect(plan.guaranteed).toBe(true);
    expect(plan.winChance).toBe(1);
    expect(rollBidOutcome(offer, "premium", establishedCompany, () => 0.999999).won).toBe(true);
  });
});
