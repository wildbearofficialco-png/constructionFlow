import { EQUIPMENT_SHOP, EQUIPMENT_IMAGES } from "../src/games/constructionflow/ConstructionFlowScreen";

describe("EQUIPMENT_SHOP", () => {
  test("every entry has a unique shopId", () => {
    const ids = EQUIPMENT_SHOP.map((e) => e.shopId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every entry has a matching image", () => {
    const missing = EQUIPMENT_SHOP.filter((e) => !EQUIPMENT_IMAGES[e.shopId]).map((e) => e.shopId);
    expect(missing).toEqual([]);
  });

  test("every image corresponds to a shop item", () => {
    const shopIds = new Set(EQUIPMENT_SHOP.map((e) => e.shopId));
    const orphaned = Object.keys(EQUIPMENT_IMAGES).filter((id) => !shopIds.has(id));
    expect(orphaned).toEqual([]);
  });

  test("economic data is finite and positive", () => {
    for (const item of EQUIPMENT_SHOP) {
      expect(Number.isFinite(item.price)).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      expect(Number.isFinite(item.dailyCost)).toBe(true);
      expect(item.dailyCost).toBeGreaterThan(0);
    }
  });

  test("tier, fuel, and reliability data are sane", () => {
    for (const item of EQUIPMENT_SHOP) {
      expect(item.tier).toBeGreaterThanOrEqual(1);
      expect(item.tier).toBeLessThanOrEqual(4);
      expect(item.fuelCap).toBeGreaterThanOrEqual(0);
      expect(item.reliability).toBeGreaterThan(0);
      expect(item.reliability).toBeLessThanOrEqual(100);
    }
  });

  test("required presentation fields are populated", () => {
    for (const item of EQUIPMENT_SHOP) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.type.length).toBeGreaterThan(0);
      expect(item.role.length).toBeGreaterThan(0);
      expect(["Light", "Medium", "Heavy", "Max"]).toContain(item.capacity);
    }
  });
});
