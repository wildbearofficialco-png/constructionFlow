// Sprint 1 P0 — the price the player is quoted is the price they are charged, on every path.
//
// Five paths priced materials five ways: the Buy modal quoted the raw market price while the
// purchase charged regional x supplier terms (or a flash deal); auto-buy skipped the regional
// adjustment; site orders ignored flash deals; the flash card quoted its own number. All five now
// read systems/materialPricing.js.

import fs from "fs";
import path from "path";
import {
  freshState, mobilizeSite, buyYardMaterials, orderSiteMaterials, emergencyOrderMaterials, autoPurchaseSiteMaterials, MATERIAL_DEFS,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { quoteMaterialUnitPrice, quoteMaterialCost, EMERGENCY_MULTIPLIER } from "../src/systems/materialPricing.js";

import { mulberry32 as __mulberry32 } from "../scripts/playtest/firstHourHarness.js";

// Deterministic: every test in this file runs on a seeded RNG, so a pass or a failure reproduces.
let __realRandom;
beforeEach(() => { __realRandom = Math.random; Math.random = __mulberry32(20260924); });
afterEach(() => { Math.random = __realRandom; });

const base = (id) => MATERIAL_DEFS.find((m) => m.id === id).basePrice;

// The scenarios the brief names. Each returns a company; pricing must agree across every path.
const SCENARIOS = {
  normal: (g) => g,
  regional_expensive: (g) => { g.homeStateCode = "CA"; return g; },
  regional_cheap: (g) => { g.homeStateCode = "MS"; return g; },
  supplier_perk: (g) => { g.officeIndex = 3; return g; },   // Project Office: −8% materials
  market_move: (g) => { g.materialPrices = { ...g.materialPrices, lumber: 131, concrete: 97 }; return g; },
  flash_deal: (g) => { g.hotMaterialDeal = { matId: "lumber", label: "Lumber", discountPct: 30, expiresDay: g.day + 2, unitPrice: 1 }; return g; },
  flash_deal_expired: (g) => { g.hotMaterialDeal = { matId: "lumber", label: "Lumber", discountPct: 30, expiresDay: g.day - 1, unitPrice: 1 }; return g; },
  everything: (g) => { g.homeStateCode = "CA"; g.officeIndex = 3; g.materialPrices = { ...g.materialPrices, lumber: 120 };
    g.hotMaterialDeal = { matId: "lumber", label: "Lumber", discountPct: 25, expiresDay: g.day + 2, unitPrice: 1 }; return g; },
};

function company(mutate) {
  return mutate({ ...freshState(), setupDone: true, tutorialDone: true, cash: 500000 });
}

// A fence site short of 12 lumber, nothing on order.
function shortSite(g) {
  const c = g.contracts.find((x) => x.defId === "fence");
  mobilizeSite(g, c.id, g.crew.map((w) => w.id), g.equipment.map((e) => e.id), () => 0);
  g.activeSites[0].materialsFulfilled = { lumber: 8 };
  return g.activeSites[0];
}

describe.each(Object.keys(SCENARIOS))("%s", (name) => {
  const mk = () => company(SCENARIOS[name]);

  test("yard purchase charges exactly the quote", () => {
    const g = mk();
    const quote = quoteMaterialCost(g, "lumber", 17, { fallbackBase: base("lumber") });
    const before = g.cash;
    expect(buyYardMaterials(g, "lumber", 17).status).toBe("bought");
    expect(before - g.cash).toBe(quote);
  });

  test("a normal site order charges exactly the quote", () => {
    const g = mk();
    const site = shortSite(g);
    const quote = quoteMaterialCost(g, "lumber", 12, { fallbackBase: base("lumber") });
    const before = g.cash;
    expect(orderSiteMaterials(g, site.id).status).toBe("ordered");
    expect(before - g.cash).toBe(quote);
  });

  test("an emergency order charges exactly the quote x1.5", () => {
    const g = mk();
    const site = shortSite(g);
    const quote = quoteMaterialCost(g, "lumber", 12, { emergency: true, fallbackBase: base("lumber") });
    expect(quote).toBe(Math.round(quoteMaterialCost(g, "lumber", 12, { fallbackBase: base("lumber") }) * EMERGENCY_MULTIPLIER));
    const before = g.cash;
    expect(emergencyOrderMaterials(g, site.id).status).toBe("ordered");
    expect(before - g.cash).toBe(quote);
  });

  test("auto-buy charges exactly what the manual quote says", () => {
    const g = mk();
    shortSite(g);
    const quote = quoteMaterialCost(g, "lumber", 12, { fallbackBase: base("lumber") });
    const before = g.cash;
    autoPurchaseSiteMaterials(g);
    expect(before - g.cash).toBe(quote);
  });
});

describe("the modifiers do what they say", () => {
  test("regional pricing moves the quote", () => {
    const or = quoteMaterialUnitPrice(company(SCENARIOS.normal), "concrete", 120);
    const ca = quoteMaterialUnitPrice(company(SCENARIOS.regional_expensive), "concrete", 120);
    expect(ca).not.toBe(or);
  });

  test("supplier perks lower it", () => {
    expect(quoteMaterialUnitPrice(company(SCENARIOS.supplier_perk), "concrete", 120))
      .toBeLessThan(quoteMaterialUnitPrice(company(SCENARIOS.normal), "concrete", 120));
  });

  test("a flash deal applies only to its material, only while live, and never costs more than normal terms", () => {
    const g = company(SCENARIOS.flash_deal);
    const n = company(SCENARIOS.normal);
    expect(quoteMaterialUnitPrice(g, "lumber", 85)).toBeLessThan(quoteMaterialUnitPrice(n, "lumber", 85));
    expect(quoteMaterialUnitPrice(g, "concrete", 120)).toBe(quoteMaterialUnitPrice(n, "concrete", 120));
    expect(quoteMaterialUnitPrice(company(SCENARIOS.flash_deal_expired), "lumber", 85)).toBe(quoteMaterialUnitPrice(n, "lumber", 85));
    const worseDeal = company((x) => { x.officeIndex = 3; x.hotMaterialDeal = { matId: "lumber", discountPct: 1, expiresDay: x.day + 2 }; return x; });
    expect(quoteMaterialUnitPrice(worseDeal, "lumber", 85)).toBe(quoteMaterialUnitPrice(company(SCENARIOS.supplier_perk), "lumber", 85));
  });
});

test("every display and charge path reads the canonical price", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
  // The Buy modal's "Market price" and the materials list both show getMaterialUnitPrice.
  expect(code).toContain("const price = getMaterialUnitPrice(game, materialModal.matId);");
  expect(code).toContain("{money(getMaterialUnitPrice(game, m.id))}/{m.unit}");
  // No path computes its own price from the raw market table any more.
  expect(code).not.toMatch(/const price = \(g\.materialPrices \|\| \{\}\)\[matId\]/);
  expect(code).not.toMatch(/game\.materialPrices\[materialModal\.matId\]/);
  expect(code).not.toMatch(/hotMaterialDeal\.unitPrice : Math\.round/);
});
