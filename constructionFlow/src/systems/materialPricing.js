// Material pricing — the ONE place a material's price is decided.
//
// SPRINT 1. Five paths priced materials five ways:
//
//   Buy modal quote        raw market price                       (what the player was SHOWN)
//   yard purchase          regional x supplier discount | flash    (what they were CHARGED)
//   auto-buy for a site    raw market price x supplier discount    (no regional adjustment)
//   site order/emergency   regional x supplier discount            (no flash deal)
//   flash-deal card        raw market price x deal
//
// So "Market price: $85 · Total: $1,700" could charge $1,960, and auto-buy undercharged a Seattle
// company relative to its own manual quote. The player cannot be shown one cost and charged
// another. Every path — quote, yard purchase, site order, emergency order, auto-buy — now reads
// quoteMaterialUnitPrice().
//
// Order of operations (all multiplicative on the day's market price):
//   1. regional adjustment for where the company works
//   2. the better of: the supplier/company discount, or an active flash deal on this material
//   3. emergency same-day delivery: x1.5 on the line total

import { applyRegionalMaterialPrice } from "./constructionRegionalEconomy.js";
import { resolveCompanyPerks } from "./companyPerks.js";
import { resolveMemoryEffects } from "./companyMemory.js";

export const EMERGENCY_MULTIPLIER = 1.5;

// Supplier terms from company perks plus the goodwill (or grudge) the company has earned.
// Clamped: goodwill can lift you but never to free materials; a grudge never past paying double.
export function supplierDiscount(game) {
  const { supplierGoodwill } = resolveMemoryEffects(game);
  const combined = resolveCompanyPerks(game).materialDiscount + supplierGoodwill;
  return Math.max(-0.25, Math.min(0.5, combined));
}

export function activeFlashDeal(game, matId) {
  const deal = game?.hotMaterialDeal;
  return deal && deal.matId === matId && deal.expiresDay >= (game?.day || 0) ? deal : null;
}

// Unit price right now. `fallbackBase` is the catalog price for a material with no market quote.
export function quoteMaterialUnitPrice(game, matId, fallbackBase = 100) {
  const market = (game?.materialPrices?.[matId]) || fallbackBase || 100;
  const regional = game ? applyRegionalMaterialPrice(market, game) : market;
  const normal = Math.round(regional * (1 - (game ? supplierDiscount(game) : 0)));
  const deal = activeFlashDeal(game, matId);
  if (!deal) return normal;
  const flash = Math.round(regional * (1 - (Number(deal.discountPct) || 0) / 100));
  // A "deal" is never allowed to cost more than the player's normal terms.
  return Math.min(normal, flash);
}

// Line total for `qty` units, as charged.
export function quoteMaterialCost(game, matId, qty, { emergency = false, fallbackBase = 100 } = {}) {
  const units = Math.max(0, Math.floor(Number(qty) || 0));
  const line = quoteMaterialUnitPrice(game, matId, fallbackBase) * units;
  return emergency ? Math.round(line * EMERGENCY_MULTIPLIER) : line;
}
