import {
  getConstructionRegionalSnapshot,
  applyRegionalContractValue,
  applyRegionalMaterialPrice,
  applyRegionalWage,
} from "../src/systems/constructionRegionalEconomy.js";

describe("Construction regional economy adapter", () => {
  const baseGame = {
    homeStateCode: "OR",
    economy: {
      demandIndex: 1.0,
      wagePressureIndex: 1.0,
      inventoryPriceIndex: 1.0,
      interestRate: 0.065,
    },
  };

  test("Oregon produces bounded, non-neutral construction multipliers", () => {
    const snap = getConstructionRegionalSnapshot(baseGame);
    expect(snap.stateCode).toBe("OR");
    expect(snap.contractValueMult).toBeGreaterThan(1);
    expect(snap.materialPriceMult).toBeGreaterThan(1);
    expect(snap.wageMult).toBeGreaterThan(1);
    expect(snap.contractValueMult).toBeLessThanOrEqual(1.85);
  });

  test("unknown state safely falls back to neutral profile", () => {
    const snap = getConstructionRegionalSnapshot({ ...baseGame, homeStateCode: "ZZ" });
    expect(snap.contractValueMult).toBeGreaterThan(0);
    expect(snap.materialPriceMult).toBeGreaterThan(0);
    expect(snap.wageMult).toBeGreaterThan(0);
  });

  test("macro boom/recession moves visible regional outputs", () => {
    const boom = getConstructionRegionalSnapshot({
      ...baseGame,
      economy: { ...baseGame.economy, demandIndex: 1.2, wagePressureIndex: 1.1, inventoryPriceIndex: 1.15 },
    });
    const recession = getConstructionRegionalSnapshot({
      ...baseGame,
      economy: { ...baseGame.economy, demandIndex: 0.8, wagePressureIndex: 0.9, inventoryPriceIndex: 0.85 },
    });
    expect(boom.contractValueMult).toBeGreaterThan(recession.contractValueMult);
    expect(boom.materialPriceMult).toBeGreaterThan(recession.materialPriceMult);
    expect(boom.wageMult).toBeGreaterThan(recession.wageMult);
  });

  test("helpers apply the adapter once to base values", () => {
    expect(applyRegionalContractValue(10000, baseGame)).toBeGreaterThan(10000);
    expect(applyRegionalMaterialPrice(100, baseGame)).toBeGreaterThan(100);
    expect(applyRegionalWage(200, baseGame)).toBeGreaterThan(200);
  });
});
