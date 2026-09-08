// Customer Satisfaction System
// Tracks reviews, loyalty, repeat visit rates, and demographic breakdown.
// Rating drives reputation modifier and revenue multiplier across all business types.

import { uid, rand, clamp, addLog } from "./utils.js";

export const CUSTOMER_DEMOGRAPHICS = [
  { id: "budget",    label: "Budget",    weight: 35, spendMult: 0.75, loyaltyBase: 45, sensitivityToPrice: 1.4 },
  { id: "standard", label: "Standard",  weight: 40, spendMult: 1.00, loyaltyBase: 60, sensitivityToPrice: 1.0 },
  { id: "premium",  label: "Premium",   weight: 18, spendMult: 1.45, loyaltyBase: 55, sensitivityToPrice: 0.7 },
  { id: "corporate",label: "Corporate", weight: 7,  spendMult: 1.80, loyaltyBase: 70, sensitivityToPrice: 0.5 },
];

const REVIEW_SENTIMENTS = {
  excellent: { minSatisfaction: 85, label: "Excellent", stars: 5 },
  good:      { minSatisfaction: 68, label: "Good",      stars: 4 },
  average:   { minSatisfaction: 48, label: "Average",   stars: 3 },
  poor:      { minSatisfaction: 28, label: "Poor",      stars: 2 },
  terrible:  { minSatisfaction: 0,  label: "Terrible",  stars: 1 },
};

function getSentiment(satisfaction) {
  if (satisfaction >= 85) return REVIEW_SENTIMENTS.excellent;
  if (satisfaction >= 68) return REVIEW_SENTIMENTS.good;
  if (satisfaction >= 48) return REVIEW_SENTIMENTS.average;
  if (satisfaction >= 28) return REVIEW_SENTIMENTS.poor;
  return REVIEW_SENTIMENTS.terrible;
}

function pickDemographic() {
  const total = CUSTOMER_DEMOGRAPHICS.reduce((s, d) => s + d.weight, 0);
  let roll = Math.random() * total;
  for (const d of CUSTOMER_DEMOGRAPHICS) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return CUSTOMER_DEMOGRAPHICS[1];
}

export function recordCustomerVisit(game, satisfaction, revenueAmount = 0) {
  if (!Array.isArray(game.reviews)) game.reviews = [];
  if (!game.demographics) game.demographics = {};

  const demo = pickDemographic();
  const sentiment = getSentiment(clamp(satisfaction, 0, 100));
  const isRepeat = Math.random() < ((game.repeatRate || 0.2) + (sentiment.stars >= 4 ? 0.15 : 0));

  const review = {
    id: uid(),
    day: game.day || 0,
    satisfaction: Math.round(satisfaction),
    stars: sentiment.stars,
    sentiment: sentiment.label,
    demographicId: demo.id,
    isRepeat,
    revenue: Math.round(revenueAmount * demo.spendMult),
  };

  game.reviews.unshift(review);
  if (game.reviews.length > 150) game.reviews.length = 150;

  // Update demographic counts
  game.demographics[demo.id] = (game.demographics[demo.id] || 0) + 1;

  // Log notable reviews
  if (sentiment.stars <= 2) {
    addLog(game, `⭐ ${sentiment.stars}-star review from ${demo.label} customer — satisfaction ${Math.round(satisfaction)}.`);
  } else if (sentiment.stars === 5 && Math.random() < 0.3) {
    addLog(game, `⭐⭐⭐⭐⭐ 5-star review from ${demo.label} customer — excellent service!`);
  }

  return review;
}

export function tickCustomerSatisfaction(game) {
  if (!Array.isArray(game.reviews)) game.reviews = [];

  const reviews = game.reviews;
  const currentDay = game.day || 0;

  // Age out reviews older than 60 days (keep last 150 anyway)
  const fresh = reviews.filter((r) => currentDay - r.day <= 60);
  if (fresh.length < reviews.length) game.reviews = fresh;

  if (fresh.length === 0) {
    game.customerRating = 3.5;
    game.loyaltyScore = 50;
    game.repeatRate = 0.20;
    return;
  }

  // Weighted star rating (recent reviews count more)
  let weightedSum = 0;
  let weightTotal = 0;
  fresh.forEach((r) => {
    const age = currentDay - r.day;
    const weight = Math.max(0.3, 1 - age / 60);
    weightedSum += r.stars * weight;
    weightTotal += weight;
  });
  game.customerRating = Math.round((weightedSum / weightTotal) * 10) / 10;

  // Loyalty decays slightly each day, boosted by positive reviews
  const avgStars = weightedSum / weightTotal;
  const loyaltyTarget = clamp((avgStars - 1) * 25, 10, 95);
  game.loyaltyScore = Math.round(clamp(
    ((game.loyaltyScore || 50) * 0.97) + (loyaltyTarget * 0.03),
    10, 95
  ));

  // Repeat rate
  const repeatVisits = fresh.filter((r) => r.isRepeat).length;
  game.repeatRate = clamp(repeatVisits / Math.max(1, fresh.length), 0.05, 0.65);

  // Apply to reputation
  const repDelta = (avgStars - 3) * 0.5;
  game.reputation = clamp((game.reputation || 50) + repDelta, 0, 100);
}

export function applyReviewImpact(game) {
  const rating = game.customerRating || 3.5;
  // Revenue multiplier: 1-star = 0.7x, 5-star = 1.35x
  const revenueMultiplier = clamp(0.70 + (rating - 1) * 0.1625, 0.70, 1.35);
  // Reputation drift
  const repTarget = clamp((rating - 1) * 20 + 20, 0, 100);
  game.reputation = clamp(
    (game.reputation || 50) * 0.99 + repTarget * 0.01,
    0, 100
  );
  return revenueMultiplier;
}

export function getCustomerMetrics(game) {
  const reviews = game.reviews || [];
  const total = reviews.length;
  const starCounts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => { starCounts[r.stars - 1] += 1; });

  const demo = game.demographics || {};
  const demoTotal = Object.values(demo).reduce((s, v) => s + v, 0);
  const demoBreakdown = CUSTOMER_DEMOGRAPHICS.map((d) => ({
    id: d.id,
    label: d.label,
    count: demo[d.id] || 0,
    pct: demoTotal > 0 ? Math.round(((demo[d.id] || 0) / demoTotal) * 100) : 0,
  }));

  const recentAvg = reviews.length > 0
    ? Math.round(reviews.slice(0, 10).reduce((s, r) => s + r.satisfaction, 0) / Math.min(10, reviews.length))
    : 0;

  return {
    rating: game.customerRating || 3.5,
    reviewCount: total,
    loyaltyScore: game.loyaltyScore || 50,
    repeatRate: Math.round((game.repeatRate || 0.20) * 100),
    recentSatisfaction: recentAvg,
    starCounts,
    demographics: demoBreakdown,
    revenueMultiplier: applyReviewImpact(game),
  };
}
