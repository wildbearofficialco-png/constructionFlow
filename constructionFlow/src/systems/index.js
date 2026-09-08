// Gameplay Systems — central export hub
// Import from this file to access all five systems in any game module.

export {
  PERSONALITY_TRAITS,
  TRAINING_PROGRAMS,
  initPersonality,
  getProductivityModifier,
  recordAttendance,
  sendToTraining,
  requestRaise,
  checkPromotion,
  tickEmployeePersonalities,
  applyDailyPersonalityEvents,
} from "./employeePersonalities.js";

export {
  SUPPLIER_TIERS,
  createSupplier,
  createInventoryItem,
  placeReorder,
  receiveDelivery,
  applySubstitution,
  tickInventory,
  getInventorySummary,
  initInventory,
} from "./inventorySystem.js";

export {
  initEquipmentProfile,
  getBreakdownProbability,
  triggerBreakdown,
  scheduleMaintenance,
  performReplacement,
  tickEquipmentWear,
  getMaintenanceSchedule,
} from "./equipmentWear.js";

export {
  EVENT_POOL,
  rollRandomEvent,
  applyRandomEvent,
  maybeFireRandomEvent,
  getActiveEventEffects,
} from "./randomEvents.js";

export {
  createAiCompetitor,
  initAiCompetitors,
  tickAiCompetitors,
  getMarketPressure,
  getCompetitorLeaderboard,
} from "./aiCompetitors.js";

export {
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
  recordTransaction,
  recordRevenue,
  processDailyFinancials,
  getFinancialSummary,
  getDailyPnL,
  getLedgerTrend,
} from "./financialLedger.js";

export {
  ECONOMY_EVENTS,
  initEconomy,
  tickEconomy,
  getEconomyModifiers,
  applySeasonalEffects,
} from "./economyEngine.js";

export {
  CUSTOMER_DEMOGRAPHICS,
  recordCustomerVisit,
  tickCustomerSatisfaction,
  applyReviewImpact,
  getCustomerMetrics,
} from "./customerSatisfaction.js";

export {
  PRICING_STRATEGIES,
  initPricing,
  getPriceMultiplier,
  getDemandScore,
  tickDemand,
  setPricingStrategy,
  estimateRevenueImpact,
} from "./demandPricing.js";

export {
  WEATHER_TYPES,
  initWeather,
  tickWeather,
  getWeatherEffects,
  applyWeatherToRoute,
  getWeatherBreakdownBonus,
  getConstructionWeatherDelay,
  getRestaurantWeatherTrafficMod,
  getRealEstateWeatherMod,
  getWeatherSummary,
} from "./weatherRouteConditions.js";

export {
  RETENTION_BONUSES,
  REVIEW_INTERVAL_DAYS,
  tickPerformanceReviews,
  getTeamMorale,
  getMoraleServiceMult,
  applyRetentionBonus,
  tickTeamMorale,
  getStaffPerformanceSummary,
} from "./staffPerformance.js";

export {
  CONTRACT_TYPES,
  tickContractRFPs,
  calculateBidWinChance,
  submitBid,
  getContractSummary,
} from "./contractBidding.js";

export {
  KPI_BENCHMARKS,
  initAnalytics,
  tickAnalytics,
  getAnalyticsTrend,
  getAnalyticsSummary,
} from "./analyticsEngine.js";

export {
  ZONE_TYPES,
  initTerritories,
  unlockZone,
  tickTerritories,
  getZonePayoutMult,
  getTerritoryStatus,
} from "./territorySystem.js";
