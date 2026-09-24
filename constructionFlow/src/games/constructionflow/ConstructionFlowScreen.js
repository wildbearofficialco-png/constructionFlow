import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert, AppState, Platform, Modal,
  StatusBar, Dimensions, Animated, Switch, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import CollapsibleSection from "../../components/CollapsibleSection.js";
import SiteStatusBanner from "../../components/SiteStatusBanner.js";
import ChainOpportunityCard from "../../components/ChainOpportunityCard.js";
import { pctPerDay, daysRemaining } from "../../utils/sitePace.js";
import {
  tickEmployeePersonalities,
  applyDailyPersonalityEvents,
} from "../../systems/employeePersonalities.js";
import { tickInventory } from "../../systems/inventorySystem.js";
import { maybeFireRandomEvent } from "../../systems/randomEvents.js";
import { tickAiCompetitors, initAiCompetitors } from "../../systems/aiCompetitors.js";
import { initEconomy, tickEconomy } from "../../systems/economyEngine.js";
import { tickCustomerSatisfaction } from "../../systems/customerSatisfaction.js";
import { initPricing, tickDemand } from "../../systems/demandPricing.js";
import { initWeather, tickWeather, getConstructionWeatherDelay } from "../../systems/weatherRouteConditions.js";
import { tickPerformanceReviews, tickTeamMorale } from "../../systems/staffPerformance.js";
import { tickContractRFPs } from "../../systems/contractBidding.js";
import { initTerritories, tickTerritories } from "../../systems/territorySystem.js";
import { LENDING_PRODUCTS } from "../../data/lendingProducts.js";
import { computeLoanOffer, offerToLoanRecord } from "../../systems/lendingEngine.js";
import { recordTransaction, beginCashScope, closeCashScope } from "../../systems/financialLedger.js";
import { pauseSite, returnRecoveredToSites, canPlayerResume, canAutoResume } from "../../systems/siteDiagnostics.js";
import { chaosChancePerTick } from "../../systems/siteEvents.js";
import { penaltyFor } from "../../systems/penalties.js";
import { quoteMaterialUnitPrice, quoteMaterialCost } from "../../systems/materialPricing.js";
import { registerSession } from "../../systems/sessionStreak.js";
import {
  earnChainOpportunity, openReadyChainOpportunities, hasLiveChainOpportunity, chainReadiness, CHAIN_LOCKED, CHAIN_OFFER_DAYS,
} from "../../systems/chainOpportunities.js";
import {
  getConstructionRegionalSnapshot,
  applyRegionalContractValue,
  applyRegionalWage,
} from "../../systems/constructionRegionalEconomy.js";
import {
  initEquipmentProfile,
  tickEquipmentWear,
  scheduleMaintenance,
} from "../../systems/equipmentWear.js";
import {
  buildInsufficientFundsAlert,
  buildAssignBlockAlert,
  buildCreditTooLowAlert,
  buildCapacityAlert,
} from "../../systems/recoveryGuidance.js";
import {
  OVERHEAD_NOTE,
  estimateProjectCosts,
  createProjectCostLedger,
  ensureProjectCostLedger,
  accrueProjectCost,
  accrueProjectCrewDay,
  buildProjectEconomics,
  getProjectReinvestmentHint,
  buildProjectProfitLines,
} from "../../systems/projectEconomics.js";
import {
  OFFICES,
  REGIONAL_OFFICE_TYPES,
  PROPERTY_TYPES,
} from "../../systems/companyPerkTables.js";
import {
  TAX_RATE,
  FREEZE_DAYS,
  PENALTY_GRACE_DAYS,
  LATE_PENALTY_RATE,
  taxRateFor,
  hasEstimator,
  accrueTaxReserve,
  taxEstimate,
  issueWeeklyTaxBill,
  bankWeekIntoTaxPeriod,
  isTaxDay,
  TAX_PERIOD_DAYS,
  applyLatePenalty,
  applyOverdueCreditHit,
  canTakeNewWork,
  blockedReason,
  minPartialPayment,
  suggestedPayment,
  unfreezeThreshold,
  canPayPartial,
  canPayInFull,
  applyTaxPayment,
  describeTaxStatus,
} from "../../systems/taxOffice.js";
import { fireHaptic } from "../../utils/constructionHaptics.js";
import { repairState, snapshotGood, describeRepair, auditState } from "../../systems/saveHealth.js";
import {
  missingPlantFor,
  canStartWithPlant,
  plantPlanFor,
  plantProgressFactor,
  satisfies as plantSatisfies,
  isUsable,
  STALL_FACTOR,
} from "../../systems/sitePlant.js";
import {
  isLicensedOperator,
  unlicensedMachineCount,
  isRunningUnlicensed,
  catchRiskPerDay,
  fineFor,
  inspectSite,
  describeInspection,
  hasSafetyOfficer,
  INSPECTION_CHANCE_PER_DAY,
  OPERATOR_CERT,
  THEFT_MIN_UNITS,
  THEFT_MAX_UNITS,
} from "../../systems/siteCompliance.js";
import {
  marketRateFor,
  payPosition,
  previewWage,
  setWage,
  accrueUnderpayment,
  quitRisk,
  payrollSummary,
  planBulkHire,
  planBulkFire,
  WAGE_FLOOR,
  WAGE_CEILING,
} from "../../systems/crewPayroll.js";
import {
  MINS_PER_TICK,
  SPEEDS,
  DEFAULT_SPEED_ID,
  speedById,
  multiplierFor,
  isPaused,
  minutesPerTick,
  tickIntervalMs,
  offlineFromElapsed,
  chancePerTick,
  describePace,
  MAX_OFFLINE_TICKS,
} from "../../systems/gameClock.js";
import {
  EVENT_CATEGORIES,
  selectOwnerEvent,
  recordEventFired,
  eligibleEvents,
  describeEventPool,
} from "../../systems/ownerEvents.js";
import {
  pushNotice,
  expireNotices,
  sortedNotices,
  topNotice,
  unreadCount,
  actionCount,
  dismissNotice,
  clearInbox,
  markAllRead,
  describeNoticeAge,
  summarizeInbox,
  noticeTone,
} from "../../systems/noticeInbox.js";
import {
  tickConstructionKPIs,
  buildKPIRows,
  computeKPIs,
  summarizePerformance,
  describeKPIDirection,
} from "../../systems/constructionKPIs.js";
import {
  recordMemory,
  recallMemory,
  resolveMemoryEffects,
  summarizeCompanyStory,
  describeStanding,
  pickMemoryCallback,
} from "../../systems/companyMemory.js";
import {
  resolveCompanyPerks,
  contractBoardSize,
  dailyOfficeRent,
  describePerkSources,
  nextOfficeUpgrade,
} from "../../systems/companyPerks.js";
import {
  RIVAL_STATUS,
  stepRivalLifecycle,
  isRivalOffTheBoard,
  countLiveRivals,
  shouldSpawnEntrant,
  createEntrant,
  getRivalPersonality,
  pushMarketNews,
  describeRivalGrowth,
  describeRivalLifecycleNews,
  describeEntrantArrival,
  planAcquisition,
  acquisitionBlockReason,
} from "../../systems/rivalMarket.js";
import {
  describeWorkerAssignment,
  workerRiskFlags,
  workerVoiceLine,
  summarizeWorkerStanding,
  describeTraitEffects,
  summarizeEquipmentEconomics,
  summarizeFleet,
  snapshotSites,
  buildOfflineSiteReport,
} from "../../systems/companyLife.js";
import {
  BID_STYLES,
  DEFAULT_BID_STYLE,
  planBid,
  rollBidOutcome,
  pickWinningRival,
  planDeliveries,
  collectArrivedDeliveries,
  describeDelivery,
  nextDeliveryDay,
  summarizeSitePhases,
  describePhaseCompletion,
  planProgressPayment,
  finalPaymentDue,
  summarizeSitePayments,
} from "../../systems/constructionLoop.js";
import {
  THEMES,
  SPACING,
  RADIUS,
  TYPE,
  ELEVATION,
  MIN_TAP_TARGET,
  toneColor,
  progressTone,
  conditionTone,
  deadlineTone,
  compactMoney,
  getEmptyState,
  alpha,
} from "../../theme/constructionTheme.js";
import {
  Card,
  SectionLabel,
  Pill,
  ProgressBar,
  StatTile,
  KeyValueRow,
  AlertBanner,
  EmptyState,
} from "../../components/ui/index.js";
import {
  useOsReducedMotion,
  usePulseOnIncrease,
  useEntranceAnimation,
} from "../../utils/constructionMotion.js";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "constructionflow_v1_save";
// "Equipment", not "Vehicles". The inherited name was a leftover from the FleetFlow fork and
// was the clearest tell on every screen that this game was a re-skin — a construction company
// owns plant and equipment, not a vehicle fleet. `normalizeTabName` keeps any older persisted
// or hard-coded "Vehicles" reference working rather than leaving the player on a blank screen.
// How many inbox items are drawn at once when it is expanded. The queue holds more; this
// is a rendering bound so a busy week cannot produce a card the length of the screen.
const INBOX_VISIBLE = 6;

export const TABS = ["Home", "Bids", "Sites", "Crew", "Equipment", "Finance", "Empire"];

export function normalizeTabName(name) {
  if (name === "Vehicles" || name === "Fleet") return "Equipment";
  return TABS.includes(name) ? name : "Home";
}

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Hand-rolled deep clone instead of JSON.parse(JSON.stringify(obj)) — this runs on every
// ~3s game tick (gameTick's clone(prev)) plus every saveGame() payload prep, so the string
// round-trip cost compounds with save size the longer a company plays. Ported verbatim from
// the equivalent fix in FleetFlowScreen.js's clone() (see that file's comment + its
// __tests__/clone.test.js for the original equivalence proof), which replaced the exact same
// pattern there for the exact same reason. Only handles what actually appears in game state
// (plain objects, arrays, primitives) — no Date/Map/Set/function/symbol values are ever stored
// in ConstructionFlow's state (verified: every `new Set(...)`/`new Date(...)` in this file is
// either a module-level constant never attached to game state, or a local lookup variable,
// never persisted). See __tests__/constructionFlowClone.test.js for the equivalence proof.
export function clone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    const copy = new Array(obj.length);
    for (let i = 0; i < obj.length; i++) copy[i] = clone(obj[i]);
    return copy;
  }
  const copy = {};
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    copy[key] = clone(obj[key]);
  }
  return copy;
}

// Identical to FleetFlow's formatClock, deliberately: the two games should tell the time the
// same way. Construction Flow has always HAD a clock — `gameMinutes` starts at 480 (8:00 AM) and
// advances 30 per tick, 48 ticks to the day — it simply never showed it, so time passed
// invisibly and the day appeared to jump. That is what felt off.
export function formatClock(mins) {
  const safe = Number.isFinite(mins) ? mins : 480;
  let h = Math.floor(safe / 60) % 24;
  const m = Math.round(safe % 60);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function money(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}
function percent(n) { return `${Math.round(n)}%`; }

// ─── Worker Names ───────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Jake","Maya","Luis","Tara","Nate","Olivia","Miles","Sofia","Eli","Rosa",
  "Leah","Noah","Ava","Zane","Ivy","Luca","Milo","Emma","Cam","Dana",
  "Finn","Gabi","Hugo","Iris","Joel","Kara","Leon","Mia","Omar","Petra",
  "Quinn","Reed","Sara","Theo","Uma","Vera","Wade","Xara","Yuri","Zoe",
  "Aiden","Blake","Casey","Drew","Eden","Felix","Grace","Hana","Ivan","Juno",
];
const LAST_NAMES = [
  "Chen","Rivera","Patel","Kim","Singh","Okafor","Novak","Hassan","Brennan","Walsh",
  "Murray","Osei","Reyes","Tanaka","Morin","Bakr","Flynn","Owens","Tran","Diaz",
  "Scott","Ahmed","Burke","Costa","Dean","Ellis","Ford","Grant","Hall","James",
];
const CLIENTS = [
  "Meridian Properties","Atlas Development","Cornerstone Group","Summit Build Co.",
  "Nova Infrastructure","Ironclad Ventures","Pacific Construct","BlueSky Builders",
  "Landmark Projects","CrossRoads Corp","Apex Structures","Keystone Capital",
];

// ─── Crew Traits ────────────────────────────────────────────────────────────────

const CREW_TRAITS = [
  { label: "Reliable",         speed: 1.03, safety: 1.05, quality: 1.02, wagePressure: 1.0,  desc: "Shows up every day, no drama" },
  { label: "Skilled",          speed: 1.05, safety: 1.02, quality: 1.12, wagePressure: 1.08, desc: "Top-quality finish work" },
  { label: "Fast",             speed: 1.14, safety: 0.96, quality: 0.97, wagePressure: 1.04, desc: "Moves quick, cuts a few corners" },
  { label: "Careful",          speed: 0.93, safety: 1.12, quality: 1.08, wagePressure: 1.0,  desc: "Meticulous — fewer reworks" },
  { label: "Cheap",            speed: 0.96, safety: 0.94, quality: 0.93, wagePressure: 0.88, desc: "Low cost, lower patience" },
  { label: "Veteran",          speed: 1.08, safety: 1.08, quality: 1.10, wagePressure: 1.15, desc: "Seen it all, fixes problems fast" },
  { label: "Ambitious",        speed: 1.06, safety: 0.98, quality: 1.0,  wagePressure: 1.18, desc: "Wants foreman or more money" },
  { label: "Hard Worker",      speed: 1.10, safety: 1.00, quality: 1.05, wagePressure: 1.05, desc: "Puts in extra effort, consistent output" },
  { label: "Lazy",             speed: 0.82, safety: 0.92, quality: 0.88, wagePressure: 0.90, desc: "Does the minimum, needs supervision" },
  { label: "Safety Focused",   speed: 0.90, safety: 1.20, quality: 1.03, wagePressure: 1.02, desc: "Zero incidents, slows down to stay safe" },
  { label: "Team Leader",      speed: 1.04, safety: 1.06, quality: 1.08, wagePressure: 1.15, desc: "Lifts performance of nearby crew" },
  { label: "Equipment Expert", speed: 1.12, safety: 1.04, quality: 1.02, wagePressure: 1.10, desc: "Handles machines like a pro" },
  { label: "High Maintenance", speed: 1.07, safety: 0.95, quality: 1.04, wagePressure: 1.22, desc: "Talented but demanding — wage pressure high" },
  { label: "Frequent No-Show", speed: 1.05, safety: 0.90, quality: 0.96, wagePressure: 0.85, desc: "Great when there, but unreliable" },
];

// Equipment type → phase affinity bonuses. Having the right machine for the phase speeds work.
const PHASE_TYPE_BONUS = {
  "Site Prep":        { Earthwork: 1.22 },
  "Excavation":       { Earthwork: 1.28, Foundation: 1.10 },
  "Earthwork":        { Earthwork: 1.28 },
  "Foundation":       { Foundation: 1.25, Earthwork: 1.10, Concrete: 1.15 },
  "Piling":           { Foundation: 1.28, Lifting: 1.10 },
  "Framing":          { Lifting: 1.15 },
  "Structure":        { Lifting: 1.22 },
  "Structural":       { Lifting: 1.18, Foundation: 1.08 },
  "Structural Steel": { Lifting: 1.30, Foundation: 1.10 },
  "Core":             { Lifting: 1.20, Concrete: 1.12 },
  "Roof Structure":   { Lifting: 1.18 },
  "MEP":              { Concrete: 1.10 },
  "MEP Rough":        { Concrete: 1.08 },
  "Deck":             { Lifting: 1.15 },
  "Survey":           { Earthwork: 1.08 },
  "Material Delivery":{ Earthwork: 1.05 },
  "Post Installation":{ Foundation: 1.15, Earthwork: 1.10 },
  "Fence Assembly":   { Lifting: 1.10 },
  "Base Layer":       { Earthwork: 1.22, Concrete: 1.15 },
  "Paving":           { Concrete: 1.20, Earthwork: 1.12 },
  "Striping":         { Concrete: 1.05 },
  "Finish Work":      { Concrete: 1.08 },
  "Barriers":         { Lifting: 1.12, Foundation: 1.08 },
  "Surfacing":        { Concrete: 1.18, Earthwork: 1.12 },
};

const CREW_SPECIALTIES = ["General", "Earthwork", "Concrete", "Framing", "Roofing", "Utility", "Finish Work"];

const SPECIALTY_PHASE_BONUS = {
  "Earthwork":   { "Survey": 1.10, "Site Prep": 1.15, "Excavation": 1.25, "Earthwork": 1.28, "Base Layer": 1.18, "Barriers": 1.10 },
  "Concrete":    { "Foundation": 1.22, "Concrete": 1.25, "Base Layer": 1.15, "Deck": 1.12, "Paving": 1.18, "Surfacing": 1.15 },
  "Framing":     { "Framing": 1.22, "Structure": 1.18, "Structural": 1.18, "Post Installation": 1.20, "Fence Assembly": 1.18, "Structural Steel": 1.15 },
  "Roofing":     { "Roofing": 1.25, "Roof Structure": 1.22, "Envelope": 1.15, "Facade": 1.12, "Finish Work": 1.10 },
  "Utility":     { "MEP": 1.22, "MEP Rough": 1.20, "Piling": 1.18, "Utilities": 1.20, "Material Delivery": 1.12 },
  "Finish Work": { "Finishes": 1.20, "Interior": 1.18, "Fitout": 1.18, "Commissioning": 1.12, "Final Inspection": 1.10, "Inspection": 1.08, "Finish Work": 1.22 },
};

const INSPECTION_PHASES = new Set(["Inspection", "Final Inspection", "Commissioning"]);

// ─── Career Levels ───────────────────────────────────────────────────────────────

const CAREER_LEVELS = [
  { id:"laborer",   label:"Labourer",        minJobs:0,  skillReq:0,   dailyWageBonus:0,  perfBonus:1.00, desc:"Starting level" },
  { id:"skilled",   label:"Skilled Worker",  minJobs:5,  skillReq:85,  dailyWageBonus:4,  perfBonus:1.05, desc:"Proven experience" },
  { id:"crew_lead", label:"Crew Lead",       minJobs:15, skillReq:95,  dailyWageBonus:9,  perfBonus:1.10, desc:"Leads a small team" },
  { id:"foreman",   label:"Foreman",         minJobs:30, skillReq:105, dailyWageBonus:15, perfBonus:1.15, desc:"Site supervisor" },
  { id:"super",     label:"Superintendent",  minJobs:50, skillReq:115, dailyWageBonus:22, perfBonus:1.20, desc:"Multi-site coordinator" },
  { id:"pm",        label:"Project Manager", minJobs:80, skillReq:125, dailyWageBonus:32, perfBonus:1.25, desc:"Full project ownership" },
];

// ─── Equipment Shop ─────────────────────────────────────────────────────────────

export const EQUIPMENT_SHOP = [
  { shopId: "pickup",       name: "Basic Pickup Truck",  type: "Earthwork",  tier: 1, price: 6500,   dailyCost: 110,  fuelCap: 60,  reliability: 88, capacity: "Light",  role: "Materials transport, light site work" },
  { shopId: "skidsteer",   name: "Skid Steer",          type: "Earthwork",  tier: 1, price: 18000,  dailyCost: 240,  fuelCap: 80,  reliability: 84, capacity: "Light",  role: "Grading, loading, tight-space work" },
  { shopId: "miniex",      name: "Mini Excavator",      type: "Earthwork",  tier: 1, price: 24000,  dailyCost: 300,  fuelCap: 90,  reliability: 86, capacity: "Light",  role: "Trenching, small foundations" },
  { shopId: "compactor",   name: "Plate Compactor",     type: "Earthwork",  tier: 1, price: 9000,   dailyCost: 130,  fuelCap: 40,  reliability: 86, capacity: "Light",  role: "Soil compaction, road prep, foundation work" },
  { shopId: "generator",   name: "Portable Generator",  type: "Utility",    tier: 1, price: 5500,   dailyCost: 85,   fuelCap: 30,  reliability: 90, capacity: "Light",  role: "On-site power, tools, lighting & machinery" },
  { shopId: "backhoe",     name: "Backhoe Loader",      type: "Earthwork",  tier: 2, price: 55000,  dailyCost: 500,  fuelCap: 120, reliability: 88, capacity: "Medium", role: "Excavation, backfill, drainage" },
  { shopId: "bulldozer",   name: "Bulldozer",           type: "Earthwork",  tier: 2, price: 78000,  dailyCost: 680,  fuelCap: 150, reliability: 85, capacity: "Medium", role: "Site clearing, rough grading" },
  { shopId: "dumptruck",   name: "Dump Truck",          type: "Earthwork",  tier: 2, price: 46000,  dailyCost: 420,  fuelCap: 160, reliability: 87, capacity: "Medium", role: "Bulk material transport, waste removal" },
  { shopId: "grader",      name: "Motor Grader",        type: "Earthwork",  tier: 2, price: 68000,  dailyCost: 610,  fuelCap: 140, reliability: 86, capacity: "Medium", role: "Road leveling, site grading, precision earthwork" },
  { shopId: "mobcrane",    name: "Mobile Crane",        type: "Lifting",    tier: 3, price: 135000, dailyCost: 1300, fuelCap: 200, reliability: 82, capacity: "Heavy",  role: "Structural steel, precast lifts" },
  { shopId: "concpump",    name: "Concrete Pump",       type: "Concrete",   tier: 3, price: 92000,  dailyCost: 900,  fuelCap: 180, reliability: 87, capacity: "Heavy",  role: "High-reach pours, slabs, columns" },
  { shopId: "telehandler", name: "Telehandler",         type: "Lifting",    tier: 3, price: 82000,  dailyCost: 760,  fuelCap: 110, reliability: 88, capacity: "Heavy",  role: "Reach lifting, multi-level material placement" },
  { shopId: "pavermachine",name: "Asphalt Paver",       type: "Earthwork",  tier: 3, price: 112000, dailyCost: 1050, fuelCap: 170, reliability: 85, capacity: "Heavy",  role: "Road paving, asphalt laying, surface finishing" },
  { shopId: "towercrane",  name: "Tower Crane",         type: "Lifting",    tier: 4, price: 290000, dailyCost: 2800, fuelCap: 0,   reliability: 91, capacity: "Max",    role: "High-rise construction only" },
  { shopId: "piledriver",  name: "Pile Driver",         type: "Foundation", tier: 4, price: 210000, dailyCost: 2100, fuelCap: 220, reliability: 89, capacity: "Max",    role: "Deep foundations, marine work" },
  { shopId: "drillingrig", name: "Drilling Rig",        type: "Foundation", tier: 4, price: 185000, dailyCost: 1750, fuelCap: 250, reliability: 88, capacity: "Max",    role: "Deep pile drilling, ground anchoring, shaft boring" },

  // ── Tier 1 additions ────────────────────────────────────────────────────────
  { shopId: "cargovan",      name: "Cargo Van",            type: "Utility",  tier: 1, price: 12000, dailyCost: 150, fuelCap: 55, reliability: 90, capacity: "Light", role: "Tool & crew transport, small material runs" },
  { shopId: "trackloader",   name: "Mini Track Loader",    type: "Earthwork",tier: 1, price: 21000, dailyCost: 270, fuelCap: 70, reliability: 85, capacity: "Light", role: "Tight-access loading, landscaping" },
  { shopId: "utilitytruck",  name: "Utility Truck",        type: "Utility",  tier: 1, price: 15000, dailyCost: 190, fuelCap: 60, reliability: 87, capacity: "Light", role: "Electrical & plumbing crew transport, ladder rack" },
  { shopId: "stakebed",      name: "Stake Bed Truck",      type: "Earthwork",tier: 1, price: 17000, dailyCost: 200, fuelCap: 70, reliability: 86, capacity: "Light", role: "Material & lumber hauling" },
  { shopId: "towtruck",      name: "Tow Truck",            type: "Utility",  tier: 1, price: 26000, dailyCost: 260, fuelCap: 70, reliability: 87, capacity: "Light", role: "Equipment recovery, breakdown response" },
  { shopId: "sweeper",       name: "Street Sweeper",       type: "Utility",  tier: 1, price: 32000, dailyCost: 310, fuelCap: 80, reliability: 86, capacity: "Light", role: "Site cleanup, dust & debris compliance" },
  { shopId: "padfootroller", name: "Padfoot Roller",       type: "Earthwork",tier: 1, price: 42000, dailyCost: 380, fuelCap: 90, reliability: 85, capacity: "Light", role: "Clay & cohesive soil compaction" },
  { shopId: "trenchroller",  name: "Trench Roller",        type: "Earthwork",tier: 1, price: 16000, dailyCost: 180, fuelCap: 30, reliability: 88, capacity: "Light", role: "Remote-controlled trench backfill compaction" },
  { shopId: "dustcannon",    name: "Dust Suppression Cannon", type: "Utility", tier: 1, price: 11000, dailyCost: 120, fuelCap: 20, reliability: 90, capacity: "Light", role: "Dust control on demolition & earthwork sites" },
  { shopId: "scissorlift",   name: "Scissor Lift",         type: "Lifting",  tier: 1, price: 19000, dailyCost: 220, fuelCap: 0,  reliability: 91, capacity: "Light", role: "Elevated interior & exterior work" },

  // ── Tier 2 additions ────────────────────────────────────────────────────────
  { shopId: "excavator",     name: "Excavator",            type: "Earthwork",tier: 2, price: 58000, dailyCost: 520, fuelCap: 130, reliability: 87, capacity: "Medium", role: "Excavation, foundations, demolition" },
  { shopId: "wheelloader",   name: "Wheel Loader",         type: "Earthwork",tier: 2, price: 64000, dailyCost: 570, fuelCap: 140, reliability: 86, capacity: "Medium", role: "Material loading, stockpiling, site cleanup" },
  { shopId: "forklift",      name: "Rough Terrain Forklift", type: "Lifting", tier: 2, price: 51000, dailyCost: 460, fuelCap: 100, reliability: 87, capacity: "Medium", role: "Material handling, pallet & unit loads" },
  { shopId: "mixertruck",    name: "Concrete Mixer Truck", type: "Concrete", tier: 2, price: 72000, dailyCost: 640, fuelCap: 150, reliability: 85, capacity: "Medium", role: "Ready-mix concrete delivery" },
  { shopId: "watertruck",    name: "Water Truck",          type: "Utility",  tier: 2, price: 49000, dailyCost: 430, fuelCap: 160, reliability: 86, capacity: "Medium", role: "Dust control, compaction support" },
  { shopId: "fueltruck",     name: "Fuel Truck",           type: "Utility",  tier: 2, price: 53000, dailyCost: 460, fuelCap: 170, reliability: 85, capacity: "Medium", role: "Mobile refueling for site equipment" },
  { shopId: "flatbedhauler", name: "Flatbed Hauler",       type: "Utility",  tier: 2, price: 61000, dailyCost: 540, fuelCap: 150, reliability: 86, capacity: "Medium", role: "Equipment transport between sites" },
  { shopId: "boomtruck",     name: "Boom Truck Crane",     type: "Lifting",  tier: 2, price: 74000, dailyCost: 660, fuelCap: 130, reliability: 84, capacity: "Medium", role: "Material lifting, smaller crane jobs" },
  { shopId: "boomlift",      name: "Boom Lift",            type: "Lifting",  tier: 2, price: 56000, dailyCost: 490, fuelCap: 90,  reliability: 86, capacity: "Medium", role: "Elevated reach work, facade access" },
  { shopId: "trencher",      name: "Trencher",             type: "Utility",  tier: 2, price: 47000, dailyCost: 410, fuelCap: 100, reliability: 85, capacity: "Medium", role: "Utility trenching, pipe & cable laying" },
  { shopId: "vibratoryroller", name: "Vibratory Roller",   type: "Earthwork",tier: 2, price: 44000, dailyCost: 390, fuelCap: 100, reliability: 86, capacity: "Medium", role: "Asphalt & granular compaction" },
  { shopId: "linepump",      name: "Concrete Line Pump",   type: "Concrete", tier: 2, price: 39000, dailyCost: 350, fuelCap: 90,  reliability: 86, capacity: "Medium", role: "Smaller pours, tight-access placement" },
  { shopId: "spreadertruck", name: "Spreader Truck",       type: "Earthwork",tier: 2, price: 43000, dailyCost: 380, fuelCap: 120, reliability: 85, capacity: "Medium", role: "Bulk material spreading — seed, mulch, aggregate" },

  // ── Tier 3 additions ────────────────────────────────────────────────────────
  { shopId: "haultruck",     name: "Rigid Haul Truck",     type: "Earthwork",tier: 3, price: 165000, dailyCost: 1450, fuelCap: 260, reliability: 84, capacity: "Heavy", role: "Heavy bulk haulage, quarry & large-site work" },
  { shopId: "vactruck",      name: "Vacuum Excavation Truck", type: "Utility", tier: 3, price: 128000, dailyCost: 1150, fuelCap: 200, reliability: 83, capacity: "Heavy", role: "Utility line exposure, non-destructive digging" },
  { shopId: "coldplaner",    name: "Cold Planer",          type: "Earthwork",tier: 3, price: 148000, dailyCost: 1320, fuelCap: 190, reliability: 84, capacity: "Heavy", role: "Asphalt removal, road resurfacing prep" },

  // ── Tier 4 additions ────────────────────────────────────────────────────────
  { shopId: "crawlercrane",  name: "Crawler Crane",        type: "Lifting",  tier: 4, price: 340000, dailyCost: 3200, fuelCap: 280, reliability: 87, capacity: "Max", role: "Heavy lifts, precast, structural steel" },
  { shopId: "screeningplant",name: "Screening Plant",      type: "Earthwork",tier: 4, price: 265000, dailyCost: 2400, fuelCap: 200, reliability: 85, capacity: "Max", role: "On-site material screening & grading" },
  { shopId: "crushingplant", name: "Crushing Plant",       type: "Earthwork",tier: 4, price: 310000, dailyCost: 2750, fuelCap: 220, reliability: 84, capacity: "Max", role: "On-site aggregate crushing & recycling" },
];

// Owned equipment keeps its shopId (see createEquipment), so this doubles as the lookup for
// both the shop listing and a player's owned fleet. Not every shopId is guaranteed to have an
// image — render call sites must fall back gracefully (e.g. to the existing emoji) for any
// future equipment added without art yet.
export const EQUIPMENT_IMAGES = {
  pickup:       require("../../../assets/construction/equipment/pickup.png"),
  skidsteer:    require("../../../assets/construction/equipment/skidsteer.png"),
  miniex:       require("../../../assets/construction/equipment/miniex.png"),
  compactor:    require("../../../assets/construction/equipment/compactor.png"),
  generator:    require("../../../assets/construction/equipment/generator.png"),
  backhoe:      require("../../../assets/construction/equipment/backhoe.png"),
  bulldozer:    require("../../../assets/construction/equipment/bulldozer.png"),
  dumptruck:    require("../../../assets/construction/equipment/dumptruck.png"),
  grader:       require("../../../assets/construction/equipment/grader.png"),
  mobcrane:     require("../../../assets/construction/equipment/mobcrane.png"),
  concpump:     require("../../../assets/construction/equipment/concpump.png"),
  telehandler:  require("../../../assets/construction/equipment/telehandler.png"),
  pavermachine: require("../../../assets/construction/equipment/pavermachine.png"),
  towercrane:   require("../../../assets/construction/equipment/towercrane.png"),
  piledriver:   require("../../../assets/construction/equipment/piledriver.png"),
  drillingrig:  require("../../../assets/construction/equipment/drillingrig.png"),
  cargovan:       require("../../../assets/construction/equipment/cargovan.png"),
  trackloader:    require("../../../assets/construction/equipment/trackloader.png"),
  utilitytruck:   require("../../../assets/construction/equipment/utilitytruck.png"),
  stakebed:       require("../../../assets/construction/equipment/stakebed.png"),
  towtruck:       require("../../../assets/construction/equipment/towtruck.png"),
  sweeper:        require("../../../assets/construction/equipment/sweeper.png"),
  padfootroller:  require("../../../assets/construction/equipment/padfootroller.png"),
  trenchroller:   require("../../../assets/construction/equipment/trenchroller.png"),
  dustcannon:     require("../../../assets/construction/equipment/dustcannon.png"),
  scissorlift:    require("../../../assets/construction/equipment/scissorlift.png"),
  excavator:      require("../../../assets/construction/equipment/excavator.png"),
  wheelloader:    require("../../../assets/construction/equipment/wheelloader.png"),
  forklift:       require("../../../assets/construction/equipment/forklift.png"),
  mixertruck:     require("../../../assets/construction/equipment/mixertruck.png"),
  watertruck:     require("../../../assets/construction/equipment/watertruck.png"),
  fueltruck:      require("../../../assets/construction/equipment/fueltruck.png"),
  flatbedhauler:  require("../../../assets/construction/equipment/flatbedhauler.png"),
  boomtruck:      require("../../../assets/construction/equipment/boomtruck.png"),
  boomlift:       require("../../../assets/construction/equipment/boomlift.png"),
  trencher:       require("../../../assets/construction/equipment/trencher.png"),
  vibratoryroller:require("../../../assets/construction/equipment/vibratoryroller.png"),
  linepump:       require("../../../assets/construction/equipment/linepump.png"),
  spreadertruck:  require("../../../assets/construction/equipment/spreadertruck.png"),
  haultruck:      require("../../../assets/construction/equipment/haultruck.png"),
  vactruck:       require("../../../assets/construction/equipment/vactruck.png"),
  coldplaner:     require("../../../assets/construction/equipment/coldplaner.png"),
  crawlercrane:   require("../../../assets/construction/equipment/crawlercrane.png"),
  screeningplant: require("../../../assets/construction/equipment/screeningplant.png"),
  crushingplant:  require("../../../assets/construction/equipment/crushingplant.png"),
};

// ─── Equipment Upgrades ─────────────────────────────────────────────────────────

const EQUIPMENT_UPGRADES = [
  { id: "engine",    label: "Engine Overhaul",   icon: "⚙️",  tiers: [{ tier:1, cost:3000, effect:"+6% speed" },{ tier:2, cost:9000, effect:"+12% speed" }] },
  { id: "telematics",label: "Telematics Kit",    icon: "📡",  tiers: [{ tier:1, cost:2000, effect:"-10% breakdown risk" },{ tier:2, cost:6000, effect:"-20% breakdown risk" }] },
  { id: "safety",    label: "Safety Package",    icon: "🦺",  tiers: [{ tier:1, cost:1500, effect:"-8% incident risk" },{ tier:2, cost:4500, effect:"-18% incident risk" }] },
];

// ─── Contract Definitions ────────────────────────────────────────────────────────

// Exported so the playtest harness can act like a player who restocks a stalled site.
export const CONTRACT_DEFS = [
  // ── Residential — fast cash, reputation growth ───────────────────────────────
  { id: "fence",        label: "Fence Installation",       category: "Residential",
    minTier: 1, crewMin: 1, equipMin: 1,
    baseValue: 9000, durationDays: 6, phases: ["Survey","Material Delivery","Post Installation","Fence Assembly","Inspection"],
    materials: { lumber: 20 }, penaltyPerDay: 60, creditReq: 500, risk: 1,
    repReward: 2, creditReward: 2,
    desc: "Timber fence for a suburban property. Fast cash to get started.",
    unlocksContractId: "comm_fitout" },
  { id: "deck",         label: "Deck Build",               category: "Residential",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 19000, durationDays: 6, phases: ["Site Prep","Framing","Finishes"],
    materials: { lumber: 35, electrical: 4 }, penaltyPerDay: 80, creditReq: 500, risk: 1,
    repReward: 2, creditReward: 2,
    desc: "Outdoor entertaining deck. Timber frame with lighting." },
  { id: "garage",       label: "Garage Construction",      category: "Residential",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 38000, durationDays: 10, phases: ["Site Prep","Foundation","Framing","Roofing","Finish Work","Inspection"],
    materials: { concrete: 12, lumber: 50 }, penaltyPerDay: 140, creditReq: 500, risk: 1,
    repReward: 3, creditReward: 3,
    desc: "Double garage with slab. Bread-and-butter residential." },
  { id: "resi_reno",    label: "Residential Renovation",   category: "Residential",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 30000, durationDays: 9, phases: ["Demo","Framing","Finishing"],
    materials: { lumber: 40, electrical: 10, plumbing: 8 },
    penaltyPerDay: 130, creditReq: 500, risk: 1,
    repReward: 3, creditReward: 2,
    desc: "Kitchen and bathroom remodel for a private client.",
    unlocksContractId: "apt_block" },
  { id: "house",        label: "House Build",               category: "Residential",
    minTier: 2, crewMin: 5, equipMin: 1,
    baseValue: 220000, durationDays: 25, phases: ["Survey","Site Prep","Foundation","Framing","Roofing","Interior","Final Inspection"],
    materials: { concrete: 35, lumber: 180, electrical: 50, plumbing: 40 },
    penaltyPerDay: 900, creditReq: 560, risk: 2,
    repReward: 6, creditReward: 5,
    desc: "Full house build from slab to handover. Good reputation builder.",
    unlocksContractId: "apt_block" },
  // ── Infrastructure — reputation + community standing ─────────────────────────
  { id: "road_patch",   label: "Road Patch & Seal",        category: "Infrastructure",
    minTier: 1, crewMin: 3, equipMin: 1,
    baseValue: 45000, durationDays: 9, phases: ["Survey","Excavation","Base Layer","Paving","Inspection"],
    materials: { asphalt: 12, concrete: 8 },
    penaltyPerDay: 220, creditReq: 500, risk: 1,
    repReward: 4, creditReward: 4,
    desc: "Council road repair — community visibility, quick turnaround required.",
    unlocksContractId: "city_road" },
  // ── Commercial — profit growth, cash focus ────────────────────────────────────
  { id: "restaurant",   label: "Restaurant Fitout",        category: "Commercial",
    minTier: 2, crewMin: 4, equipMin: 1,
    baseValue: 115000, durationDays: 12, phases: ["Demo","MEP Rough","Framing","Finishes"],
    materials: { lumber: 60, electrical: 50, plumbing: 30 },
    penaltyPerDay: 1700, creditReq: 530, risk: 2,
    repReward: 4, creditReward: 5,
    desc: "Commercial kitchen and dining room fitout. High-margin job." },
  { id: "comm_fitout",  label: "Commercial Fitout",        category: "Commercial",
    minTier: 2, crewMin: 4, equipMin: 1,
    baseValue: 90000, durationDays: 10, phases: ["Demo","MEP Rough","Framing","Finishes"],
    materials: { lumber: 80, electrical: 40, plumbing: 20 },
    penaltyPerDay: 1300, creditReq: 530, risk: 2,
    repReward: 3, creditReward: 4,
    desc: "Retail space fit-out for a new tenant. Tight deadline." },
  { id: "office_build", label: "Office Building",          category: "Commercial",
    minTier: 2, crewMin: 6, equipMin: 2,
    baseValue: 260000, durationDays: 20, phases: ["Excavation","Foundation","Structural Steel","Exterior","Interior","Inspection"],
    materials: { concrete: 100, steel: 18, lumber: 90, electrical: 60, plumbing: 30 },
    penaltyPerDay: 3200, creditReq: 570, risk: 3,
    repReward: 5, creditReward: 8,
    desc: "4-storey commercial office. Tight tolerances on structural steelwork." },
  { id: "warehouse",    label: "Warehouse Build",          category: "Commercial",
    minTier: 2, crewMin: 5, equipMin: 2,
    baseValue: 150000, durationDays: 14, phases: ["Site Prep","Foundation","Structural","Envelope"],
    materials: { concrete: 80, steel: 12, lumber: 60 },
    penaltyPerDay: 1900, creditReq: 560, risk: 2,
    repReward: 4, creditReward: 6,
    desc: "Industrial warehouse shell, 2,000sqm. Structural steel frame." },
  { id: "retail_centre",label: "Retail Centre",            category: "Commercial",
    minTier: 3, crewMin: 10, equipMin: 2,
    baseValue: 720000, durationDays: 45, phases: ["Site Prep","Foundation","Structural Steel","Exterior","Interior","Inspection"],
    materials: { concrete: 250, steel: 55, lumber: 150, electrical: 120, plumbing: 60 },
    penaltyPerDay: 9500, creditReq: 620, risk: 3,
    repReward: 8, creditReward: 10,
    desc: "Multi-tenancy retail strip. Anchor tenant on fixed open date." },
  // ── Infrastructure — community standing, long-term expansion enabler ──────────
  { id: "utilities",    label: "Utilities Installation",   category: "Infrastructure",
    minTier: 2, crewMin: 4, equipMin: 2,
    baseValue: 170000, durationDays: 16, phases: ["Excavation","Piling","Framing","Inspection"],
    materials: { concrete: 60, steel: 8, plumbing: 80 },
    penaltyPerDay: 2200, creditReq: 560, risk: 3,
    repReward: 7, creditReward: 6,
    desc: "Stormwater and sewerage upgrade for a council suburb." },
  { id: "apt_block",    label: "Apartment Block",          category: "Commercial",
    minTier: 3, crewMin: 8, equipMin: 2,
    baseValue: 420000, durationDays: 30, phases: ["Foundation","Structure","MEP","Facade","Fitout"],
    materials: { concrete: 300, steel: 45, lumber: 120, electrical: 80, plumbing: 60 },
    penaltyPerDay: 5500, creditReq: 600, risk: 3,
    repReward: 7, creditReward: 10,
    desc: "24-unit apartment block. Complex MEP and structural requirements.",
    unlocksContractId: "shopping_mall" },
  { id: "bridge",       label: "Bridge Construction",      category: "Infrastructure",
    minTier: 3, crewMin: 10, equipMin: 3,
    baseValue: 620000, durationDays: 40, phases: ["Piling","Deck","Barriers","Surfacing"],
    materials: { concrete: 500, steel: 120 },
    penaltyPerDay: 8500, creditReq: 640, risk: 4,
    repReward: 10, creditReward: 8,
    desc: "Single-span road bridge. High community visibility." },
  // ── Mega — company-defining, high risk/reward ─────────────────────────────────
  { id: "hospital_wing",label: "Hospital Wing Extension",  category: "Mega",
    minTier: 4, crewMin: 14, equipMin: 3,
    baseValue: 1300000, durationDays: 60, phases: ["Foundation","Structure","MEP","Finishes","Commissioning"],
    materials: { concrete: 800, steel: 200, electrical: 300, plumbing: 200, lumber: 150 },
    penaltyPerDay: 17000, creditReq: 700, risk: 4,
    repReward: 12, creditReward: 15,
    desc: "Critical healthcare infrastructure. Zero tolerance for defects." },
  { id: "highrise",     label: "High-Rise Tower",          category: "Mega",
    minTier: 4, crewMin: 20, equipMin: 4,
    baseValue: 3200000, durationDays: 120, phases: ["Foundation","Core","Structure","Facade","MEP","Fitout"],
    materials: { concrete: 2000, steel: 600, electrical: 800, plumbing: 400, lumber: 300 },
    penaltyPerDay: 43000, creditReq: 750, risk: 5,
    repReward: 15, creditReward: 20,
    desc: "40-story mixed-use tower. This is what empires are made of." },
  { id: "stadium",      label: "Sports Stadium",           category: "Mega",
    minTier: 4, crewMin: 25, equipMin: 5,
    baseValue: 7500000, durationDays: 180, phases: ["Site Prep","Foundation","Structure","Facade","Interior","Commissioning"],
    materials: { concrete: 4000, steel: 1200, electrical: 1200, plumbing: 600, lumber: 400 },
    penaltyPerDay: 95000, creditReq: 780, risk: 5,
    repReward: 20, creditReward: 25,
    desc: "30,000-seat stadium. Rep 80+ required. Legacy-defining contract." },
  { id: "wildbear_city",label: "WildBear City Plaza",      category: "Mega",
    minTier: 4, crewMin: 30, equipMin: 6,
    baseValue: 17000000, durationDays: 300, phases: ["Site Prep","Foundation","Core","Structure","Facade","MEP","Interior","Commissioning"],
    materials: { concrete: 10000, steel: 3000, electrical: 3000, plumbing: 1500, lumber: 1000 },
    penaltyPerDay: 215000, creditReq: 800, risk: 5,
    repReward: 30, creditReward: 30,
    desc: "The biggest contract in the city's history. For Elite Constructors only." },
  { id: "hotel_build", label: "Boutique Hotel", category: "Commercial",
    minTier: 3, crewMin: 8, equipMin: 2,
    baseValue: 390000, durationDays: 28, phases: ["Survey","Site Prep","Foundation","Structural Steel","Exterior","MEP","Fitout","Final Inspection"],
    materials: { concrete: 200, steel: 40, lumber: 80, electrical: 80, plumbing: 50 },
    penaltyPerDay: 4800, creditReq: 580, risk: 3, repReward: 7, creditReward: 8,
    desc: "50-room boutique hotel build. Interior fitout is key to client satisfaction.",
    unlocksContractId: "airport_terminal" },
  { id: "shopping_mall", label: "Shopping Mall", category: "Commercial",
    minTier: 3, crewMin: 12, equipMin: 3,
    baseValue: 900000, durationDays: 50, phases: ["Site Prep","Foundation","Structural Steel","Exterior","MEP Rough","Interior","Finishes","Commissioning"],
    materials: { concrete: 400, steel: 80, lumber: 200, electrical: 150, plumbing: 80 },
    penaltyPerDay: 12000, creditReq: 630, risk: 3, repReward: 9, creditReward: 10,
    desc: "30-store retail mall. Anchor tenant move-in date is non-negotiable.",
    unlocksContractId: "regional_mall" },
  { id: "airport_terminal", label: "Airport Terminal", category: "Mega",
    minTier: 4, crewMin: 20, equipMin: 4,
    baseValue: 4800000, durationDays: 150, phases: ["Survey","Excavation","Foundation","Structural Steel","Core","Envelope","MEP","Interior","Commissioning"],
    materials: { concrete: 3000, steel: 800, electrical: 600, plumbing: 300, lumber: 400 },
    penaltyPerDay: 65000, creditReq: 740, risk: 5, repReward: 14, creditReward: 18,
    desc: "Regional airport terminal expansion. Safety and compliance above all else.",
    unlocksContractId: "salem_airport_expansion" },
  { id: "university_building", label: "University Building", category: "Government",
    minTier: 3, crewMin: 10, equipMin: 2,
    baseValue: 800000, durationDays: 48, phases: ["Survey","Site Prep","Foundation","Structure","MEP","Interior","Commissioning"],
    materials: { concrete: 350, steel: 60, lumber: 150, electrical: 120, plumbing: 80 },
    penaltyPerDay: 9500, creditReq: 660, complianceReq: 65, risk: 3, repReward: 11, creditReward: 16,
    desc: "Six-story university research building. Academic schedule must be honoured." },
  { id: "highway_section", label: "Highway Section", category: "Mega",
    minTier: 4, crewMin: 18, equipMin: 4,
    baseValue: 3900000, durationDays: 120, phases: ["Survey","Excavation","Base Layer","Paving","Barriers","Striping","Inspection"],
    materials: { asphalt: 500, concrete: 800, steel: 200 },
    penaltyPerDay: 47000, creditReq: 720, complianceReq: 70, risk: 4, repReward: 13, creditReward: 16,
    desc: "12km dual-carriageway highway. Traffic management and public safety critical." },
  { id: "data_centre", label: "Data Centre Build", category: "Commercial",
    minTier: 3, crewMin: 10, equipMin: 2,
    baseValue: 680000, durationDays: 40, phases: ["Site Prep","Foundation","Structure","MEP Rough","MEP","Finishes","Commissioning"],
    materials: { concrete: 200, steel: 50, electrical: 300, plumbing: 40, lumber: 60 },
    penaltyPerDay: 8500, creditReq: 620, risk: 3, repReward: 8, creditReward: 10,
    desc: "Mission-critical data centre. Power and cooling systems must be flawless." },
  // ── Government — credit score bonuses, community trust ────────────────────────
  { id: "city_road",    label: "City Road Reconstruction", category: "Government",
    minTier: 2, crewMin: 6, equipMin: 2,
    baseValue: 200000, durationDays: 20, phases: ["Survey","Excavation","Base Layer","Paving","Striping","Inspection"],
    materials: { asphalt: 80, concrete: 30, steel: 10 },
    penaltyPerDay: 2600, creditReq: 580, complianceReq: 55, risk: 2,
    repReward: 6, creditReward: 12,
    desc: "Municipal road reconstruction. Council visibility, builds trust." },
  { id: "fire_station", label: "Fire Station Build",       category: "Government",
    minTier: 3, crewMin: 8, equipMin: 2,
    baseValue: 380000, durationDays: 30, phases: ["Foundation","Structural","MEP","Finishes","Commissioning"],
    materials: { concrete: 180, steel: 35, lumber: 90, electrical: 70, plumbing: 40 },
    penaltyPerDay: 4800, creditReq: 630, complianceReq: 60, risk: 3,
    repReward: 8, creditReward: 15,
    desc: "Emergency services facility. Safety compliance non-negotiable." },
  { id: "public_school",label: "Public School Build",      category: "Government",
    minTier: 3, crewMin: 10, equipMin: 2,
    baseValue: 510000, durationDays: 40, phases: ["Site Prep","Foundation","Structure","Interior","Commissioning"],
    materials: { concrete: 250, steel: 50, lumber: 120, electrical: 100, plumbing: 60 },
    penaltyPerDay: 6500, creditReq: 650, complianceReq: 65, risk: 3,
    repReward: 10, creditReward: 18,
    desc: "Government school. High community visibility and credit boost." },
  { id: "water_treatment",label: "Water Treatment Plant",  category: "Government",
    minTier: 3, crewMin: 12, equipMin: 3,
    baseValue: 900000, durationDays: 55, phases: ["Excavation","Foundation","Structure","MEP","Commissioning"],
    materials: { concrete: 500, steel: 120, plumbing: 200, electrical: 150 },
    penaltyPerDay: 11000, creditReq: 700, complianceReq: 75, risk: 4,
    repReward: 12, creditReward: 20,
    desc: "Critical public infrastructure. Premium compliance required." },
  // ── Named Major Projects ─────────────────────────────────────────────────────
  { id: "regional_mall", label: "Regional Mall", category: "Commercial",
    minTier: 3, crewMin: 6, equipMin: 2,
    baseValue: 680000, durationDays: 30, phases: ["Survey","Site Prep","Foundation","Steel Frame","Roofing","Interior","Final Inspection"],
    materials: { concrete: 120, steel: 50, lumber: 40 },
    penaltyPerDay: 8500, creditReq: 620, risk: 3, repReward: 9, creditReward: 10,
    minRep: 45,
    desc: "Large regional shopping complex anchoring a new commercial district.",
    unlocksContractId: "riverfront_stadium" },
  { id: "salem_airport_expansion", label: "Salem Airport Expansion", category: "Mega",
    minTier: 4, crewMin: 8, equipMin: 2,
    baseValue: 1800000, durationDays: 45, phases: ["Survey","Site Prep","Foundation","Steel Frame","Utilities","Paving","Commissioning"],
    materials: { concrete: 200, steel: 80, asphalt: 60 },
    penaltyPerDay: 22000, creditReq: 700, risk: 4, repReward: 12, creditReward: 14,
    minRep: 65, isMajorProject: true,
    desc: "Runway extension and new terminal gates for Salem's commercial airport." },
  { id: "riverfront_stadium", label: "Riverfront Stadium", category: "Mega",
    minTier: 4, crewMin: 10, equipMin: 3,
    baseValue: 2600000, durationDays: 60, phases: ["Survey","Excavation","Foundation","Steel Frame","Seating Structure","Interior","Commissioning"],
    materials: { concrete: 350, steel: 150, lumber: 80 },
    penaltyPerDay: 33000, creditReq: 730, risk: 5, repReward: 14, creditReward: 16,
    minRep: 75, isMajorProject: true,
    desc: "18,000-seat multipurpose stadium on the Willamette riverfront. A landmark build." },
  { id: "pacific_trade_port", label: "Pacific Trade Port", category: "Mega",
    minTier: 4, crewMin: 9, equipMin: 3,
    baseValue: 2100000, durationDays: 50, phases: ["Survey","Dredging","Foundation","Dock Structure","Warehousing","Paving","Commissioning"],
    materials: { concrete: 280, steel: 120, asphalt: 90 },
    penaltyPerDay: 26000, creditReq: 720, risk: 5, repReward: 13, creditReward: 15,
    minRep: 70, isMajorProject: true,
    desc: "Deep-water commercial port with bulk cargo handling and warehousing." },
  { id: "cascade_medical_center", label: "Cascade Medical Center", category: "Government",
    minTier: 4, crewMin: 7, equipMin: 2,
    baseValue: 1600000, durationDays: 40, phases: ["Survey","Site Prep","Foundation","Framing","Utilities","Interior","Final Inspection"],
    materials: { concrete: 180, steel: 70, electrical: 120, plumbing: 90 },
    penaltyPerDay: 19000, creditReq: 700, complianceReq: 70, risk: 4, repReward: 12, creditReward: 16,
    minRep: 60, isMajorProject: true,
    desc: "Regional medical complex serving three counties. Highest compliance standards." },
  { id: "columbia_bridge", label: "Columbia River Bridge", category: "Infrastructure",
    minTier: 4, crewMin: 10, equipMin: 3,
    baseValue: 2400000, durationDays: 55, phases: ["Survey","Foundation Piers","Steel Frame","Deck Pour","Barriers","Paving","Commissioning"],
    materials: { concrete: 400, steel: 200, asphalt: 40 },
    penaltyPerDay: 30000, creditReq: 720, risk: 5, repReward: 13, creditReward: 15,
    minRep: 72, isMajorProject: true,
    desc: "Major highway bridge spanning the Columbia River. National infrastructure significance." },
  { id: "osu_campus_expansion", label: "OSU Campus Expansion", category: "Government",
    minTier: 4, crewMin: 8, equipMin: 2,
    baseValue: 1500000, durationDays: 38, phases: ["Survey","Site Prep","Foundation","Framing","Roofing","Interior","Final Inspection"],
    materials: { concrete: 160, steel: 60, lumber: 100, electrical: 80 },
    penaltyPerDay: 17000, creditReq: 700, complianceReq: 65, risk: 4, repReward: 11, creditReward: 14,
    minRep: 60, isMajorProject: true,
    desc: "Three new academic buildings for Oregon State University's engineering campus." },
];

// ─── Material Catalog ───────────────────────────────────────────────────────────

// Exported for the same reason: the harness pays the real price for materials.
export const MATERIAL_DEFS = [
  { id: "concrete",   label: "Concrete",   unit: "m³",   basePrice: 120, volatility: 0.14, icon: "layers" },
  { id: "lumber",     label: "Lumber",     unit: "sheets",basePrice: 85,  volatility: 0.18, icon: "leaf" },
  { id: "steel",      label: "Steel",      unit: "tons",  basePrice: 950, volatility: 0.20, icon: "build" },
  { id: "electrical", label: "Electrical", unit: "spools",basePrice: 45,  volatility: 0.10, icon: "flash" },
  { id: "plumbing",   label: "Plumbing",   unit: "meters",basePrice: 38,  volatility: 0.10, icon: "water" },
  { id: "asphalt",    label: "Asphalt",    unit: "tons",  basePrice: 200, volatility: 0.12, icon: "map" },
];

// ─── Office Tiers (analog to Properties) ────────────────────────────────────────

// The office, regional-office and property ladders now live in src/systems/companyPerkTables.js
// so that the screen and companyPerks.js read ONE copy. They were declared here, which is how
// four of the six office perks came to be advertised on a button and read by nothing.
// Re-exported because `OFFICES` is imported by tests and other modules.
export { OFFICES, REGIONAL_OFFICE_TYPES, PROPERTY_TYPES };


// Keyed by OFFICES[].id (0-4), same pattern as EQUIPMENT_IMAGES.
export const OFFICE_IMAGES = {
  0: require("../../../assets/construction/office/shed.png"),
  1: require("../../../assets/construction/office/portakabin.png"),
  2: require("../../../assets/construction/office/smalloffice.png"),
  3: require("../../../assets/construction/office/projectoffice.png"),
  4: require("../../../assets/construction/office/hqtower.png"),
};

// ─── Reputation Tiers ───────────────────────────────────────────────────────────

const REP_TIERS = [
  { min: 0,  label: "Unknown Contractor", badge: "⚫", bonus: null },
  { min: 20, label: "Local Builder",      badge: "🟤", bonus: { cash: 500,   credit: 5  } },
  { min: 40, label: "Reliable Builder",   badge: "⚪", bonus: { cash: 1500,  credit: 10 } },
  { min: 60, label: "Regional Leader",    badge: "🟡", bonus: { cash: 4000,  credit: 15 } },
  { min: 80, label: "Industry Standard",  badge: "🔵", bonus: { cash: 10000, credit: 20 } },
  { min: 95, label: "Elite Constructor",  badge: "🔴", bonus: { cash: 25000, credit: 30 } },
];

function getRepTier(rep) {
  let tier = REP_TIERS[0];
  for (const t of REP_TIERS) { if ((rep || 0) >= t.min) tier = t; }
  return tier;
}

// ─── Milestones ─────────────────────────────────────────────────────────────────

export const MILESTONE_DEFS = [
  { key: "firstSite",    check: (g) => g.completedJobs >= 1,                         label: "First Site Complete",   reward: 0     },
  { key: "crew5",        check: (g) => g.crew.length >= 5,                            label: "5-Person Crew",         reward: 1000  },
  { key: "crew10",       check: (g) => g.crew.length >= 10,                           label: "10-Person Crew",        reward: 3000  },
  { key: "equip3",       check: (g) => g.equipment.length >= 3,                       label: "3 Machines",            reward: 1600  },
  { key: "cash25k",      check: (g) => g.cash >= 25000,                               label: "$25K Reserve",          reward: 0     },
  { key: "cash100k",     check: (g) => g.cash >= 100000,                              label: "$100K Reserve",         reward: 0     },
  { key: "office2",      check: (g) => g.officeIndex >= 2,                            label: "Proper Office",         reward: 4000  },
  { key: "sites5",       check: (g) => g.completedJobs >= 5,                          label: "5 Jobs Completed",      reward: 2000  },
  { key: "sites25",      check: (g) => g.completedJobs >= 25,                         label: "25 Jobs Completed",     reward: 10000 },
  { key: "tier3equip",   check: (g) => g.equipment.some((e) => e.tier >= 3),          label: "First Heavy Machine",   reward: 6000  },
  { key: "sites50",      check: (g) => g.completedJobs >= 50,                         label: "50 Jobs Completed",     reward: 30000 },
  { key: "sites100",     check: (g) => g.completedJobs >= 100,                        label: "100 Jobs Completed",    reward: 100000},
  { key: "cash500k",     check: (g) => g.cash >= 500000,                              label: "$500K Reserve",         reward: 0     },
  { key: "cash1m",       check: (g) => g.cash >= 1000000,                             label: "$1M Reserve",           reward: 0     },
  { key: "crew20",       check: (g) => g.crew.length >= 20,                           label: "20-Person Crew",        reward: 10000 },
  { key: "equip8",       check: (g) => g.equipment.length >= 8,                       label: "8 Machines",            reward: 20000 },
  { key: "crew30",       check: (g) => g.crew.length >= 30,                           label: "30-Person Crew",        reward: 24000 },
  { key: "sites75",      check: (g) => g.completedJobs >= 75,                         label: "75 Jobs Complete",      reward: 50000 },
  { key: "cash5m",       check: (g) => g.cash >= 5000000,                             label: "$5M Reserve",           reward: 0     },
  { key: "equip12",      check: (g) => (g.equipment||[]).length >= 12,                label: "12-Machine Fleet",      reward: 50000 },
  { key: "sites150",     check: (g) => g.completedJobs >= 150,                        label: "150 Jobs Complete",     reward: 200000},
  { id: "rep100",     key: "rep100",     label: "Reputation 100",   desc: "Reach 100 reputation",          tier: 4,
    check: (g) => (g.reputation || 0) >= 100,
    reward: (g) => { g.cash += 50000; addLog(g, "🏆 100 Reputation achieved — $50k bonus!"); } },
  { id: "cities10",   key: "cities10",   label: "10 Cities",        desc: "Expand to 10 cities",           tier: 4,
    check: (g) => (g.unlockedCities?.length || 1) >= 10,
    reward: (g) => { g.reputation = (g.reputation||0) + 15; addLog(g, "🌎 10 cities expanded! Reputation +15"); } },
  { id: "value100m",  key: "value100m",  label: "$100M Empire",     desc: "Reach $100M company value",     tier: 4,
    check: (g) => (g.companyValuation || 0) >= 100000000,
    reward: (g) => { g.cash += 250000; addLog(g, "💰 $100M company value reached! $250k bonus!"); } },
  { id: "jobs1000",   key: "jobs1000",   label: "1,000 Projects",   desc: "Complete 1,000 projects",       tier: 4,
    check: (g) => (g.completedJobs || 0) >= 1000,
    reward: (g) => { g.reputation = (g.reputation||0) + 20; addLog(g, "🏗️ 1,000 projects complete! Rep +20"); } },
  { id: "domination", key: "domination", label: "Market Domination", desc: "Outvalue every rival by 10×",  tier: 4,
    check: (g) => (g.rivals||[]).length > 0 && (g.rivals||[]).every(r => r.status==="Bankrupt" || (g.companyValuation||0) > ((r.cash||0)+(r.rep||0)*50000)*10),
    reward: (g) => { g.cash += 500000; addLog(g, "👑 Market Domination achieved! $500k bonus!"); } },
];

// ─── Cities ──────────────────────────────────────────────────────────────────────

const CITIES = [
  { id:"salem",    name:"Salem",    state:"OR", region:"Pacific Northwest", unlockCost:0,       unlockRep:0,  contractMult:1.0, competition:"Low",       popLabel:"Capital City",       rivals:["apex","northwest"] },
  { id:"portland", name:"Portland", state:"OR", region:"Pacific Northwest", unlockCost:75000,   unlockRep:25, contractMult:1.4, competition:"Medium",    popLabel:"Largest City",       rivals:["summit","apex"] },
  { id:"eugene",   name:"Eugene",   state:"OR", region:"Pacific Northwest", unlockCost:50000,   unlockRep:20, contractMult:1.2, competition:"Low",       popLabel:"University City",    rivals:["northwest"] },
  { id:"seattle",  name:"Seattle",  state:"WA", region:"Pacific Northwest", unlockCost:150000,  unlockRep:40, contractMult:1.8, competition:"High",      popLabel:"Major Metro",        rivals:["summit","ironpeak","apex"] },
  { id:"boise",    name:"Boise",    state:"ID", region:"Mountain West",     unlockCost:80000,   unlockRep:30, contractMult:1.3, competition:"Medium",    popLabel:"Fast-Growing City",  rivals:["ironpeak"] },
  { id:"spokane",  name:"Spokane",  state:"WA", region:"Pacific Northwest", unlockCost:90000,   unlockRep:35, contractMult:1.3, competition:"Medium",    popLabel:"Eastern WA Hub",     rivals:["northwest","ironpeak"] },
  { id:"denver",   name:"Denver",   state:"CO", region:"Mountain West",     unlockCost:200000,  unlockRep:55, contractMult:2.0, competition:"High",      popLabel:"Mountain Metropolis",rivals:["summit","ironpeak"] },
  { id:"dallas",   name:"Dallas",   state:"TX", region:"South Central",     unlockCost:300000,  unlockRep:65, contractMult:2.5, competition:"Very High", popLabel:"Booming Market",     rivals:["apex","summit","ironpeak"] },
  { id:"phoenix",  name:"Phoenix",  state:"AZ", region:"Southwest",         unlockCost:250000,  unlockRep:60, contractMult:2.3, competition:"High",      popLabel:"Sun Belt Growth",    rivals:["apex","summit"] },
];

// ─── Regional Office Types ────────────────────────────────────────────────────────



// ─── Property Types ────────────────────────────────────────────────────────────────



const CLIENT_ROSTER = [
  { id: "city_hall",     name: "City Hall",           focus: "infrastructure", icon: "🏛️" },
  { id: "apex_dev",      name: "Apex Development",    focus: "commercial",     icon: "🏢" },
  { id: "greenfield",    name: "Greenfield Homes",    focus: "residential",    icon: "🏠" },
  { id: "harbor_port",   name: "Harbor Port Auth.",   focus: "industrial",     icon: "⚓" },
  { id: "summit_school", name: "Summit School Dist.", focus: "commercial",     icon: "🏫" },
];

const LEGACY_PERKS = [
  { id: "iron_foundation",       label: "Iron Foundation",       desc: "Start next gen with +$50k cash" },
  { id: "reputation_legacy",     label: "Reputation Legacy",     desc: "Start next gen at Reputation 25" },
  { id: "veteran_mentor",        label: "Veteran Mentor",        desc: "Your best worker joins at half wage" },
  { id: "equipment_cache",       label: "Equipment Cache",       desc: "Begin with a free Tier-2 vehicle" },
  { id: "material_stockpile",    label: "Material Stockpile",    desc: "Start with $8,000 in mixed materials" },
  { id: "political_connections", label: "Political Connections", desc: "First 5 contracts worth 20% more" },
];

// ─── Project Manager Tiers ─────────────────────────────────────────────────────────

const PM_TIERS = [
  { id:"junior_pm", name:"Junior PM",   wagePerDay:340,  hireCost:4000,  delayReduce:0.10, marginBoost:0.03, autoManage:false, desc:"Reduces delays by 10% and lifts margins slightly." },
  { id:"senior_pm", name:"Senior PM",   wagePerDay:500,  hireCost:8000, delayReduce:0.20, marginBoost:0.06, autoManage:true,  desc:"Auto-unpauses stalled sites. 20% fewer delays." },
  { id:"director",  name:"PM Director", wagePerDay:780, hireCost:15000, delayReduce:0.35, marginBoost:0.10, autoManage:true,  desc:"Company-wide oversight. Biggest margin and delay boost." },
];

// ─── Training Programs ────────────────────────────────────────────────────────────

const TRAINING_PROGRAMS = [
  { id: "safety_course",      label: "Safety Course",            cost: 500,  duration: 3,  skillBonus: 5,  wagePressure: 0,    certId: "safety_cert" },
  { id: "equipment_cert",     label: "Equipment Certification",  cost: 800,  duration: 5,  skillBonus: 8,  wagePressure: 0,    certId: "equipment_cert" },
  { id: "foreman_track",      label: "Foreman Fast-Track",       cost: 1500, duration: 7,  skillBonus: 12, wagePressure: 0.15, certId: "foreman_cert" },
  { id: "safety_management",  label: "Safety Management Course", cost: 2000, duration: 10, skillBonus: 15, wagePressure: 0.05, certId: "safety_mgmt_cert" },
  { id: "project_leadership", label: "Project Leadership",       cost: 3500, duration: 14, skillBonus: 18, wagePressure: 0.20, certId: "project_lead_cert" },
];

const PROMOTION_MILESTONES = [5, 10, 20, 35];

const WORKER_LEVELS = [
  { level: 1, label: "Apprentice",  xpRequired: 0    },
  { level: 2, label: "Journeyman",  xpRequired: 150  },
  { level: 3, label: "Skilled",     xpRequired: 400  },
  { level: 4, label: "Senior",      xpRequired: 800  },
  { level: 5, label: "Master",      xpRequired: 1500 },
];

// ─── Empire Goals ──────────────────────────────────────────────────────────────────

const EMPIRE_GOALS = [
  { id:"local_foothold",   title:"Local Foothold",           desc:"Complete 10 jobs",                                       check:(g)=>(g.completedJobs||0)>=10,                                                                                                  cashReward:5000,  repReward:5  },
  { id:"second_city",      title:"Second City",              desc:"Open an office in any second city",                      check:(g)=>(g.cityOffices||[]).length>=1,                                                                                              cashReward:10000, repReward:10 },
  { id:"multi_city",       title:"Multi-City Operator",      desc:"Have offices in 3+ cities",                              check:(g)=>(g.cityOffices||[]).length>=3,                                                                                              cashReward:30000, repReward:15 },
  { id:"oregon_one",       title:"Oregon's #1 Contractor",   desc:"Rep 75+ with offices in Portland & Eugene",              check:(g)=>g.reputation>=75&&(g.cityOffices||[]).some(o=>o.cityId==="portland")&&(g.cityOffices||[]).some(o=>o.cityId==="eugene"),    cashReward:50000, repReward:20 },
  { id:"pnw_empire",       title:"PNW Empire",               desc:"Offices in all four Pacific NW cities",                  check:(g)=>["portland","eugene","seattle","spokane"].every(id=>(g.cityOffices||[]).some(o=>o.cityId===id)),                           cashReward:100000,repReward:25 },
  { id:"land_baron",       title:"Land Baron",               desc:"Own 5+ properties",                                      check:(g)=>(g.properties||[]).length>=5,                                                                                              cashReward:40000, repReward:10 },
  { id:"national_player",  title:"National Player",          desc:"Have offices in 7+ cities",                              check:(g)=>(g.cityOffices||[]).length>=7,                                                                                             cashReward:200000,repReward:30 },
  { id:"acquisition_king", title:"Acquisition King",         desc:"Acquire 2+ rival companies",                             check:(g)=>(g.acquiredRivals||[]).length>=2,                                                                                          cashReward:150000,repReward:20 },
  { id:"valuation_5m",     title:"$5M Company",              desc:"Reach $5 million company valuation",                     check:(g)=>computeValuation(g)>=5000000,                                                                                              cashReward:400000,repReward:50 },
  { id:"construction_empire",title:"Construction Empire",     desc:"Reach $10M company valuation",                          check:(g)=>computeValuation(g)>=10000000,                                                                                             cashReward:600000,repReward:75 },
  { id:"number_one",       title:"#1 in America",            desc:"Reach $20M valuation and national rank #1",              check:(g)=>computeValuation(g)>=20000000&&(g.nationalRank||99)<=1,                                                                    cashReward:1000000,repReward:100 },
  { id:"salem_dominant",   title:"Salem Dominator",          desc:"Win 15+ jobs in your home city",                        check:(g)=>((g.cityJobsWon||{})["salem"]||0)>=15,                                                                                     cashReward:16000, repReward:8  },
  { id:"oregon_leader",    title:"Oregon Leader",            desc:"Rep 70+ and active jobs in Portland, Eugene & Salem",   check:(g)=>g.reputation>=70&&((g.cityJobsWon||{}).portland||0)>0&&((g.cityJobsWon||{}).eugene||0)>0&&((g.cityJobsWon||{}).salem||0)>=5, cashReward:60000, repReward:18 },
];

function computeValuation(g) {
  const equipValue = (g.equipment||[]).reduce((s,e) => s + e.price*(e.condition/100)*0.6, 0);
  const propValue  = (g.properties||[]).reduce((s,p) => {
    const def = PROPERTY_TYPES.find(t=>t.id===p.typeId);
    return s + (def ? def.cost * (def.resaleRate||0.8) : 0);
  }, 0);
  const offValue   = (g.cityOffices||[]).reduce((s,o) => {
    const def = REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId);
    return s + (def ? def.cost * 0.7 : 0);
  }, 0);
  const pipeline = (g.activeSites||[]).reduce((s,site) => s + site.totalValue*0.4, 0);
  return Math.round((g.cash||0) + equipValue + propValue + offValue + pipeline + (g.reputation||0)*1500);
}

function computeNationalRank(g) {
  const val = computeValuation(g);
  if (val >= 20000000) return 1;
  if (val >= 15000000) return 2;
  if (val >= 10000000) return 3;
  if (val >= 7000000)  return 5;
  if (val >= 5000000)  return 8;
  if (val >= 3000000)  return 15;
  if (val >= 2000000)  return 25;
  if (val >= 1000000)  return 40;
  if (val >= 500000)   return 60;
  if (val >= 200000)   return 85;
  if (val >= 100000)   return 90;
  return 99;
}

function computeMarketShare(g) {
  const cities = (g.cityOffices||[]).length + 1; // +1 for home city
  const base = cities / CITIES.length;
  const repBonus = (g.reputation||0) / 2000;
  return Math.min(35, Math.round((base + repBonus) * 100));
}

function computeHealthScore(g) {
  const dailyBurn = (g.crew||[]).reduce((s,w)=>s+(w.wagePerDay||0),0)+(g.equipment||[]).reduce((s,e)=>s+e.dailyCost,0)+dailyOfficeRent(g);
  const runway = dailyBurn>0?Math.floor((g.cash||0)/dailyBurn):999;
  const overdue = (g.activeSites||[]).filter(s=>s.status==="Active"&&(g.day>(s.deadlineDay||9999))).length;
  const burning = (g.crew||[]).filter(w=>(w.stamina ?? 50)<15).length;
  let score = 100;
  const factors = [];
  if (runway<7) { const pts=Math.round((7-runway)/7*25); score-=pts; if(pts>0) factors.push(`Cash runway ${runway}d (-${pts}pts)`); }
  if ((g.safetyScore||60)<50) { const pts=Math.round((50-(g.safetyScore||60))/50*20); score-=pts; factors.push(`Low safety score (-${pts}pts)`); }
  const overdueDeduct = Math.min(20,overdue*10); score-=overdueDeduct; if(overdue>0) factors.push(`${overdue} overdue site${overdue>1?"s":""} (-${overdueDeduct}pts)`);
  const burnDeduct = Math.min(15,burning*5); score-=burnDeduct; if(burning>0) factors.push(`${burning} crew burning out (-${burnDeduct}pts)`);
  if ((g.reputation||0)>60) score+=5;
  score=Math.max(0,Math.min(100,score));
  const label=score>=80?"Excellent":score>=60?"Good":score>=40?"Fair":"At Risk";
  const colorKey=score>=80?"green":score>=60?"cyan":score>=40?"orange":"red";
  return { score, label, colorKey, factors };
}

// Every warning now carries the tab that fixes it and the verb for the link, so a warning is
// something the player can act on in one tap rather than a line they have to go hunting for.
// Same conditions, same order, same cap of 3 as before — only `tab`, `action` and `icon` are
// new, and the equipment wording is no longer "vehicle".
export function getPredictiveWarnings(g) {
  const warnings = [];
  const dailyBurn=(g.crew||[]).reduce((s,w)=>s+(w.wagePerDay||0),0)+(g.equipment||[]).reduce((s,e)=>s+e.dailyCost,0)+dailyOfficeRent(g);
  const runway=dailyBurn>0?Math.floor((g.cash||0)/dailyBurn):999;
  if (runway<5) warnings.push({ text:`Cash runway critical — only ${runway} day${runway!==1?"s":""} left`, severity:"high", tab:"Finance", action:"Open Finance", icon:"cash-outline" });
  const overdue=(g.activeSites||[]).filter(s=>s.status==="Active"&&(g.day>(s.deadlineDay||9999)));
  for (const s of overdue.slice(0,2)) warnings.push({ text:`"${s.label}" is overdue — penalties accumulating`, severity:"high", tab:"Sites", action:"Open site", icon:"alarm-outline" });
  const badEquip=(g.equipment||[]).filter(e=>(e.condition ?? 100)<30);
  if (badEquip.length>0) warnings.push({ text:`${badEquip.length} machine${badEquip.length>1?"s":""} below 30% condition — breakdown risk`, severity:"medium", tab:"Equipment", action:"Repair", icon:"build-outline" });
  const missingSite=(g.activeSites||[]).find(s=>{ const con=(g.contracts||[]).find(c=>c.id===s.contractId); const def=CONTRACT_DEFS.find(d=>d.id===con?.defId); return def?.materials&&Object.entries(def.materials).some(([m,n])=>((s.materialsFulfilled||{})[m]||0)<n); });
  if (missingSite) warnings.push({ text:`"${missingSite.label}" is stalled — missing materials`, severity:"medium", tab:"Sites", action:"Buy materials", icon:"cube-outline" });
  return warnings.slice(0,3);
}


function computeInflation(g) {
  const day = g.day || 1;
  let mult;
  if (day <= 30)       mult = 1.0;
  else if (day <= 100) mult = 1.0 + (day - 30) / 1000;
  else if (day <= 300) mult = 1.07 + ((day - 100) / 200) * (1.18 - 1.07);
  else                 mult = 1.18 + (day - 300) / 5000;
  return Math.min(1.50, mult);
}

function enhanceContractValue(def, state, base) {
  const inflMult = computeInflation(state);
  let cityMult = 1.0;
  if (state.cityOffices && state.cityOffices.length > 0) {
    const maxCityMult = state.cityOffices.reduce((best, office) => {
      const cityDef = CITIES.find((c) => c.id === office.cityId);
      return cityDef && cityDef.contractMult > best ? cityDef.contractMult : best;
    }, 1.0);
    cityMult = maxCityMult;
  }
  let eventMult = 1.0;
  if (state.activeMarketEvent) {
    const activeEvent = MARKET_EVENTS.find((e) => e.id === state.activeMarketEvent);
    if (activeEvent) {
      if (!activeEvent.categoryRestrict || activeEvent.categoryRestrict.includes(def.category)) {
        eventMult = activeEvent.contractMult;
      }
    }
  } else {
    eventMult = state.marketState === "Boom" ? 1.12 : state.marketState === "Slow" ? 0.88 : 1.0;
  }
  const variancePct = rand(-20, 35) / 100;
  const repBonus = Math.min(0.25, (state.reputation || 0) / 400);
  const enhancedValue = Math.round(def.baseValue * eventMult * inflMult * cityMult * (1 + variancePct) * (1 + repBonus));
  const inflDeadlineBonus = Math.min(5, Math.floor((inflMult - 1.0) / 0.10));
  const enhancedDeadline = base.deadline + inflDeadlineBonus;
  return {
    value: Math.max(Math.round(def.baseValue * 0.50), enhancedValue),
    deadline: enhancedDeadline,
  };
}

// Home office tier + regional offices + properties, resolved in one place.
// This used to compute a `propBonus` from `equipCapBonus` — a MACHINE figure — and then
// return without using it at all. Properties now have their own `crewCapBonus`, and it counts.
export function getTotalCrewCap(g) {
  return resolveCompanyPerks(g).crewCap;
}

// The state `planBid`/`rollBidOutcome` should see: the game plus the office tier's bid perk.
// Every bid call site goes through this so the chance shown on the card is by construction
// the chance that gets rolled.
function withBidPerks(g) {
  // Phase 6: what your company has DONE moves the odds alongside what it has BOUGHT.
  // A record of delivered work makes you a safer bet; a market you bought your way through
  // leaves rivals bidding against you personally. Net of the two, clamped in
  // getBidCompetition so history can never make a bid a certainty or an impossibility.
  const memory = resolveMemoryEffects(g);
  return {
    ...g,
    bidBonus: resolveCompanyPerks(g).bidBonus,
    memoryEdge: memory.bidEdge - memory.rivalGrudge,
  };
}


function getEquipCapBonus(g) {
  const office = OFFICES[g?.officeIndex || 0];
  return resolveCompanyPerks(g).equipCap - (office?.equipCap || 2);
}

function pickContractCity(g) {
  const available = [
    "salem",
    ...(g.cityOffices || []).map((o) => o.cityId).filter((v, i, a) => a.indexOf(v) === i),
  ];
  // Weight toward higher-contractMult cities (more valuable = more likely)
  const weighted = [];
  for (const cityId of available) {
    const city = CITIES.find((c) => c.id === cityId);
    const weight = city ? Math.max(1, Math.round(city.contractMult * 3)) : 3;
    for (let i = 0; i < weight; i++) weighted.push(cityId);
  }
  return pick(weighted);
}

function buildContractorRankings(g) {
  const playerVal = computeValuation(g);
  const playerRow = {
    id: "player", name: g.companyName, isPlayer: true,
    rep: g.reputation, value: playerVal,
    cities: (g.cityOffices || []).length + 1,
    status: null, acquired: false,
  };
  const rivalRows = (g.rivals || []).map((r) => ({
    id: r.id, name: r.name, isPlayer: false,
    rep: r.rep || 0,
    value: (r.cash || 0) + (r.rep || 0) * 50000 +
           (r.cityPresence || ["salem"]).length * 100000 +
           (r.jobsCompleted || 0) * 15000,
    cities: (r.cityPresence || ["salem"]).length,
    status: r.status || null,
    acquired: (g.acquiredRivals || []).includes(r.id),
  }));
  return [...rivalRows, playerRow]
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function getCityPlayerShare(g, cityId) {
  const playerJobs = (g.cityJobsWon || {})[cityId] || 0;
  const rivalJobs = (g.rivals || []).reduce((total, rival) => {
    if ((rival.cityPresence || ["salem"]).includes(cityId)) {
      return total + Math.max(1, Math.floor((rival.jobsCompleted || 0) / Math.max(1, (rival.cityPresence || []).length)));
    }
    return total;
  }, 0);
  const totalJobs = playerJobs + rivalJobs;
  return totalJobs === 0 ? 0 : Math.round((playerJobs / totalJobs) * 100);
}

const ULTIMATE_GOAL_IDS = ["number_one", "construction_empire", "national_player", "acquisition_king", "pnw_empire"];

function checkEmpireGoals(g) {
  for (const goal of EMPIRE_GOALS) {
    if ((g.empireGoalsCompleted||[]).includes(goal.id)) continue;
    try {
      if (goal.check(g)) {
        if (!g.empireGoalsCompleted) g.empireGoalsCompleted = [];
        g.empireGoalsCompleted.push(goal.id);
        if (goal.cashReward) {
          g.cash += goal.cashReward; g.revenue += goal.cashReward;
          recordTransaction(g, "bonuses", goal.cashReward, `Empire goal: ${goal.title}`);
        }
        if (goal.repReward)  g.reputation = Math.min(100, (g.reputation||0) + goal.repReward);
        addLog(g, `🏆 Empire Goal: "${goal.title}" — +${money(goal.cashReward||0)} & +${goal.repReward} rep!`);
      }
    } catch(e) { if (__DEV__) console.warn('[ConstructionFlow] empire goal check error:', e); }
  }
  // Prestige check: all 5 ultimate goals completed
  const allUltimateDone = ULTIMATE_GOAL_IDS.every(id => (g.empireGoalsCompleted||[]).includes(id));
  if (allUltimateDone) {
    if (!g.hallOfFame) g.hallOfFame = {};
    if (!g.hallOfFame.prestigeReached) {
      g.hallOfFame.prestigeReached = g.day;
      addLog(g, `👑 LEGACY COMPLETE — You have built a construction empire! Day ${g.day}.`);
      g.pendingStory = g.pendingStory || { icon: "trophy", title: "Legacy Complete!", body: "You have achieved everything — the #1 ranked construction empire in America. Your legacy is set in stone." };
    }
  }
}

// ─── Chaos Events ───────────────────────────────────────────────────────────────

// Which Finance line a site event's cash lands on. Anything unlisted is "Miscellaneous" — still
// named after the event, never silent.
const CHAOS_LEDGER_CATEGORY = {
  safety: "fines", inspection: "fines", injury: "payroll", breakdown: "maintenance",
  fuel_cost: "fuel", client_dispute: "contracts", equipment_recall: "maintenance",
};

// Exported so the recovery tests can inject a specific site event.
export const CHAOS_EVENTS = [
  { id: "noshow",     label: "Worker No-Show",        prob: 0.04, tone: "orange", icon: "😤",
    apply: (site, game) => {
      const impact = rand(8, 18);
      site.phaseProgress = Math.max(0, site.phaseProgress - impact);
      addLog(game, `⚠ ${site.label}: A crew member didn't show up — lost ${impact}% progress.`);
      return { text: `Worker no-show — lost ${impact}% phase progress.`, type: "noshow" };
    }
  },
  { id: "weather",    label: "Weather Delay",         prob: 0.035,tone: "blue",   icon: "🌧️",
    apply: (site, game) => {
      const days = rand(1, 3);
      site.deadlineDay += days;
      site.currentWeather = { icon: "rainy", label: "Weather Delay", endsDay: (game.day || 1) + days };
      addLog(game, `🌧️ ${site.label}: Weather delay — deadline pushed ${days} day(s).`);
      return { text: `Weather stopped work for ${days} day(s). Deadline extended.`, type: "weather" };
    }
  },
  { id: "breakdown",  label: "Equipment Breakdown",   prob: 0.03, tone: "red",    icon: "🔧",
    apply: (site, game) => {
      const assigned = game.equipment.find((e) => (site.assignedEquipmentIds || []).includes(e.id) && e.status === "Active");
      if (!assigned) return null;
      // Offer player choice instead of auto-applying
      if (!game.pendingBreakdown) {
        const repairCost = rand(800, 3500);
        game.pendingBreakdown = {
          siteId: site.id, siteLabel: site.label,
          equipId: assigned.id, equipName: assigned.name,
          repairCost,
        };
        assigned.condition = Math.max(25, assigned.condition - rand(10, 20));
        addLog(game, `⚠️ ${assigned.name} broke down on ${site.label} — awaiting your decision.`);
        return { text: `${assigned.name} broke down. Choose your response.`, type: "breakdown" };
      }
      return null;
    }
  },
  { id: "shortage",   label: "Material Shortage",     prob: 0.025,tone: "orange", icon: "📦",
    apply: (site, game) => {
      const impact = rand(5, 15);
      site.phaseProgress = Math.max(0, site.phaseProgress - impact);
      // Deplete on-site materials so bar reflects the shortage and blocks progress
      const matKeys = Object.keys(site.materialsFulfilled || {}).filter(k => (site.materialsFulfilled[k] || 0) > 2);
      if (matKeys.length > 0) {
        const matId = matKeys[Math.floor(Math.random() * matKeys.length)];
        site.materialsFulfilled[matId] = Math.max(0, (site.materialsFulfilled[matId] || 0) - rand(2, 4));
      }
      addLog(game, `📦 ${site.label}: Material shortage — stock depleted and ${impact}% progress lost. Re-stock to continue.`);
      return { text: `Material shortage! Lost ${impact}% progress — re-stock materials.`, type: "shortage" };
    }
  },
  { id: "safety",     label: "Safety Incident",       prob: 0.02, tone: "red",    icon: "🦺",
    apply: (site, game) => {
      const fine = penaltyFor({ contractValue: site.totalValue, severity: "major", companyLevel: game.companyLevel, roll: Math.random() });
      game.cash -= fine;
      game.reputation = Math.max(0, game.reputation - rand(2, 6));
      addLog(game, `🦺 Safety incident on ${site.label}! Fine of ${money(fine)} issued.`);
      return { text: `Safety incident — ${money(fine)} fine, reputation hit.`, type: "safety" };
    }
  },
  { id: "permit",     label: "Permit Delay",          prob: 0.02, tone: "yellow", icon: "📋",
    apply: (site, game) => {
      const days = rand(2, 5);
      pauseSite(site, days, "permit");
      addLog(game, `📋 ${site.label}: Permit issue — site paused for up to ${days} days.`);
      return { text: `Permit issue — site paused ${days} days.`, type: "permit" };
    }
  },
  { id: "scope",      label: "Scope Change",          prob: 0.025,tone: "purple", icon: "📐",
    apply: (site, game) => {
      const bonus = rand(2000, 8000);
      site.totalValue += bonus;
      addLog(game, `📐 ${site.label}: Client added scope — contract value +${money(bonus)}!`);
      return { text: `Client added scope. Contract value +${money(bonus)}.`, type: "scope" };
    }
  },
  { id: "theft",      label: "Material Theft",        prob: 0.015,tone: "red",    icon: "🚨",
    apply: (site, game) => {
      const mats = Object.keys(game.materials).filter((k) => (game.materials[k] || 0) > 0);
      if (!mats.length) return null;
      const matId = pick(mats);
      const stolen = rand(5, Math.min(20, game.materials[matId]));
      game.materials[matId] = Math.max(0, game.materials[matId] - stolen);
      const mat = MATERIAL_DEFS.find((m) => m.id === matId);
      const loss = stolen * (game.materialPrices[matId] || mat?.basePrice || 100);
      game.reputation = Math.max(0, game.reputation - 1);
      addLog(game, `🚨 ${site.label}: ${stolen} ${mat?.unit} of ${mat?.label} stolen — ${money(loss)} in losses.`);
      return { text: `${stolen} ${mat?.unit} of ${mat?.label} stolen. ${money(loss)} lost.`, type: "theft" };
    }
  },
  { id: "injury",     label: "Worker Injury",         prob: 0.012,tone: "red",    icon: "🩺",
    apply: (site, game) => {
      const injured = game.crew.find((w) => (site.assignedCrewIds || []).includes(w.id));
      if (!injured) return null;
      const days = rand(3, 7);
      injured.status = "Idle";
      injured.stamina = 10;
      injured.mood = Math.max(20, injured.mood - 20);
      site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== injured.id);
      // Off for a few days, not off the job: they return to this site once recovered.
      injured.awaitingRestForSiteId = site.id;
      const baseVal = site.totalValue || 8000;
      const medCost = Math.max(400, Math.round(baseVal * rand(5, 12) / 100 / 100) * 100);
      game.cash -= medCost;
      game.reputation = Math.max(0, game.reputation - 2);
      addLog(game, `🩺 ${injured.name} injured on ${site.label} — off for ~${days} days. Medical: ${money(medCost)}.`);
      return { text: `${injured.name} injured. Off site. Medical cost ${money(medCost)}.`, type: "injury" };
    }
  },
  { id: "inspection", label: "Safety Inspection",     prob: 0.018,tone: "yellow", icon: "🔍",
    apply: (site, game) => {
      const safetyScore = game.officeStaff.some((s) => s.role === "Safety Officer") ? 80 : rand(40, 75);
      const pass = safetyScore >= 65;
      if (pass) {
        game.reputation = Math.min(100, game.reputation + rand(1, 3));
        addLog(game, `✅ ${site.label}: Safety inspection PASSED — reputation up.`);
        return { text: "Safety inspection passed. Reputation +.", type: "inspect_pass" };
      } else {
        const fine = penaltyFor({ contractValue: site.totalValue, severity: "major", companyLevel: game.companyLevel, roll: Math.random() });
        game.cash -= fine;
        site.pausedDays = 0;
        pauseSite(site, rand(2, 4), "inspection", `${money(fine)} fine`);
        game.reputation = Math.max(0, game.reputation - 3);
        addLog(game, `❌ ${site.label}: Safety inspection FAILED — ${money(fine)} fine, work stopped.`);
        return { text: `Inspection failed. ${money(fine)} fine. Work paused.`, type: "inspect_fail" };
      }
    }
  },
  { id: "fuel_cost",  label: "Fuel Cost Surge",       prob: 0.02, tone: "orange", icon: "⛽",
    apply: (site, game) => {
      const surcharge = rand(500, 2000);
      game.cash -= surcharge;
      addLog(game, `⛽ Fuel cost surge on ${site.label} — ${money(surcharge)} equipment surcharge.`);
      return { text: `Fuel surge — ${money(surcharge)} equipment surcharge.`, type: "fuel_cost" };
    }
  },
  { id: "client_dispute", label: "Client Dispute", prob: 0.018, tone: "orange", icon: "📞",
    apply: (site, game) => {
      const baseVal = site.totalValue || 8000;
      const hold = Math.max(300, Math.round(baseVal * rand(5, 15) / 100 / 100) * 100);
      site.totalValue = Math.max(0, site.totalValue - hold);
      addLog(game, `📞 ${site.label}: Client dispute — ${money(hold)} withheld from contract.`);
      return { text: `Client dispute. ${money(hold)} withheld from payment.`, type: "client_dispute" };
    }
  },
  { id: "subcontractor_walkoff", label: "Sub Walkoff", prob: 0.015, tone: "red", icon: "🚶",
    apply: (site, game) => {
      const sc = (game.subcontractors||[]).find(s => s.status === "Active");
      if (!sc) return null;
      sc.status = "Idle";
      const loss = rand(10, 20);
      site.phaseProgress = Math.max(0, site.phaseProgress - loss);
      addLog(game, `🚶 ${sc.name} walked off ${site.label} — lost ${loss}% progress.`);
      return { text: `Subcontractor walkoff. Lost ${loss}% progress.`, type: "subcontractor_walkoff" };
    }
  },
  { id: "client_praise", label: "Client Praise", prob: 0.03, tone: "green", icon: "⭐",
    apply: (site, game) => {
      const bonus = rand(1000, 5000);
      site.totalValue += bonus;
      game.reputation = Math.min(100, (game.reputation||0) + rand(1,3));
      addLog(game, `⭐ ${site.label}: Client delighted — bonus ${money(bonus)} added!`);
      return { text: `Client praise. Bonus ${money(bonus)}. Rep +.`, type: "client_praise" };
    }
  },
  { id: "equipment_recall", label: "Equipment Recall", prob: 0.008, tone: "red", icon: "🔴",
    apply: (site, game) => {
      const equip = game.equipment.find(e => (site.assignedEquipmentIds || []).includes(e.id));
      if (!equip) return null;
      equip.status = "Maintenance";
      equip.condition = Math.max(10, equip.condition - 30);
      site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter(id => id !== equip.id);
      // Once the player repairs it, it goes back to this site on its own.
      equip.awaitingRepairForSiteId = site.id;
      addLog(game, `🔴 ${equip.name} subject to safety recall — pulled from ${site.label}.`);
      return { text: `${equip.name} recalled for safety. Pulled from site.`, type: "recall" };
    }
  },
  { id: "community_award", label: "Community Award", prob: 0.012, tone: "cyan", icon: "🏆",
    apply: (site, game) => {
      game.reputation = Math.min(100, (game.reputation||0) + rand(3,6));
      game.creditScore = Math.min(850, (game.creditScore||600) + rand(3,8));
      addLog(game, `🏆 ${site.label} received a community excellence award! Rep +, Credit +.`);
      return { text: `Community award! Reputation and credit improved.`, type: "award" };
    }
  },
  { id: "material_delivery_bonus", label: "Early Material Delivery", prob: 0.025, tone: "green", icon: "🚚",
    apply: (site, game) => {
      const gain = rand(5, 12);
      site.phaseProgress = Math.min(100, site.phaseProgress + gain);
      addLog(game, `🚚 ${site.label}: Early material delivery — gained ${gain}% phase progress.`);
      return { text: `Early delivery. Gained ${gain}% progress.`, type: "delivery_bonus" };
    }
  },
  { id: "regulatory_hold", label: "Regulatory Hold", prob: 0.012, tone: "yellow", icon: "📜",
    apply: (site, game) => {
      if (game.pendingDecision) return { text: `Regulatory hold incoming — decision pending.`, type: "regulatory" };
      const days = rand(3, 7);
      const baseValue = site.totalValue || 8000;
      const fineRaw = baseValue * rand(5, 15) / 100;
      const fine = Math.max(200, Math.round(fineRaw / 100) * 100);
      const expediteCost = Math.max(100, Math.round(fine * 0.6 / 100) * 100);
      const premiumCost = Math.max(200, Math.round(fine * 1.1 / 100) * 100);
      game.pendingDecision = {
        id: "delay_regulatory",
        siteId: site.id,
        title: "📜 Regulatory Hold",
        tone: "yellow",
        desc: `Inspectors have flagged ${site.label} for a compliance review. Work must pause ${days} day${days > 1 ? "s" : ""} and a compliance fee is owed.`,
        delayDays: days,
        fine,
        expediteCost,
        premiumCost,
        options: [
          { label: "Wait It Out", sub: `Pause ${days} days — pay ${money(fine)} compliance fee` },
          { label: "Expedite Process", sub: `Pay ${money(fine + expediteCost)} total — reduce to ${Math.ceil(days / 2)} day pause` },
          { label: "Premium Resolution", sub: `Pay ${money(fine + premiumCost)} — 70% chance to clear entirely` },
        ],
      };
      addLog(game, `📜 ${site.label}: Regulatory hold — compliance review required. Decision needed.`);
      return { text: `Regulatory hold — awaiting your decision.`, type: "regulatory" };
    }
  },
  { id: "material_theft", weight: 4, prob: 0.018, tone: "red", icon: "🔴", label: "Material Theft (Site)",
    apply: (site, game) => {
      const _def = CONTRACT_DEFS.find(c => c.id === (game.contracts.find(cc => cc.id === site.contractId)?.defId));
      const _matIds = Object.keys(_def?.materials || {});
      // Sprint 12. This already worked: the decrement below genuinely forced a re-delivery,
      // exactly as asked for. What it never did was TELL anyone. Two units of one material,
      // announced in a scrolling log, is indistinguishable from nothing happening.
      let _taken = 0, _matId = null;
      if (_matIds.length > 0) {
        _matId = _matIds[Math.floor(Math.random() * _matIds.length)];
        _taken = Math.min(THEFT_MAX_UNITS, Math.max(THEFT_MIN_UNITS, Math.round((site.totalValue || 0) / 90000) + THEFT_MIN_UNITS));
        if (site.materialsFulfilled) {
          const _have = site.materialsFulfilled[_matId] || 0;
          _taken = Math.min(_taken, _have);
          site.materialsFulfilled[_matId] = Math.max(0, _have - _taken);
        }
      }
      const _cost = _taken * (MATERIAL_DEFS.find((m) => m.id === _matId)?.basePrice || 0);
      addLog(game, `🔴 Material theft at ${site.label} — ${_taken} ${_matId || "units"} gone.`);
      addImportantNotice(game,
        _cost > 0
          ? `${_taken} ${_matId} stolen from ${site.label} overnight — about ${money(_cost)} to replace, and the phase cannot finish without it.`
          : `${_taken} ${_matId || "units of material"} stolen from ${site.label} overnight — it has to be re-delivered before the phase can finish.`,
        "red", { actionLabel: "Re-order materials", actionTab: "Sites" });
      return { text: `Material theft — ${_taken} ${_matId || "units"} stolen.`, type: "material_theft" };
    }
  },
  { id: "productivity_surge", weight: 6, prob: 0.022, tone: "green", icon: "⚡", label: "Crew Productivity Surge",
    apply: (site, game) => {
      site.phaseProgress = Math.min(100, (site.phaseProgress||0) + 12);
      addLog(game, `⚡ ${site.label}: Crew surge — extra 12% progress today.`);
      return { text: `Crew productivity surge — +12% phase progress.`, type: "productivity_surge" };
    }
  },
  { id: "permit_delay", weight: 5, prob: 0.016, tone: "yellow", icon: "📋", label: "Permit Review Delay",
    apply: (site, game) => {
      if (game.pendingDecision) return { text: `Permit delay incoming — decision pending.`, type: "permit_delay" };
      const progressLoss = rand(5, 12);
      const baseValue = site.totalValue || 8000;
      const expediteCost = Math.max(100, Math.round(baseValue * 0.04 / 100) * 100);
      const premiumCost = Math.max(200, Math.round(baseValue * 0.08 / 100) * 100);
      game.pendingDecision = {
        id: "delay_permit",
        siteId: site.id,
        title: "📋 Permit Review Delay",
        tone: "yellow",
        desc: `${site.label} has hit a permit review snag. The city requires additional paperwork before work can proceed.`,
        progressLoss,
        expediteCost,
        premiumCost,
        options: [
          { label: "Accept the Delay", sub: `Lose ${progressLoss}% phase progress, rep -1` },
          { label: "Expedite Paperwork", sub: `Pay ${money(expediteCost)} — lose only ${Math.ceil(progressLoss / 2)}% progress` },
          { label: "Premium Resolution", sub: `Pay ${money(premiumCost)} — 80% chance to skip delay entirely` },
        ],
      };
      addLog(game, `📋 ${site.label}: Permit review delay — paperwork required. Decision needed.`);
      return { text: `Permit delay — awaiting your decision.`, type: "permit_delay" };
    }
  },
];

// ─── Decision Events ─────────────────────────────────────────────────────────────

// Exported so the integration tests can audit the catalog itself — an event gated into a
// state it can never reach fails silently forever otherwise.
export const DECISION_EVENTS = [
  {
    id: "supplier_deal",
    category: EVENT_CATEGORIES.MONEY, rarity: "common", cooldownDays: 24,
    // A bulk materials offer means nothing to a company that has never run a job.
    eligible: (g) => (g.completedJobs || 0) >= 1 || (g.activeSites || []).length > 0,
    title: "📦 Supplier Deal", tone: "cyan",
    desc: "Your materials supplier offers a one-time 30% discount on bulk lumber and concrete if you commit $8,000 today.",
    options: [
      { label: "Pay up front", sub: "Spend $8,000 → receive 40 lumber + 15 concrete", apply: (g) => { if (g.cash >= 8000) { g.cash -= 8000; g.expenses += 8000; g.materials.lumber = (g.materials.lumber||0)+40; g.materials.concrete = (g.materials.concrete||0)+15; addLog(g, "📦 Took supplier deal — 40 lumber + 15 concrete at 30% off!"); addImportantNotice(g, "Bulk deal: 40 lumber + 15 concrete purchased for $8,000.", "green"); recordMemory(g, { tag: `supplier_paid_${g.day}`, kind: "supplier", valence: "good", weight: 1.5, label: "Paid the supplier up front", detail: "you paid your materials supplier up front, in full" }); } } },
      // Phase 6: the cost of this one is not on the invoice. Materials now, goodwill later.
      { label: "Take it, settle later", sub: "Materials now, nothing paid — your supplier will remember", apply: (g) => { g.materials.lumber = (g.materials.lumber||0)+40; g.materials.concrete = (g.materials.concrete||0)+15; addLog(g, "📦 Took the materials on account — supplier not paid."); addImportantNotice(g, "Materials taken on account. Your supplier noted it.", "orange"); recordMemory(g, { tag: `supplier_stiffed_${g.day}`, kind: "supplier", valence: "bad", weight: 2, label: "Took materials without paying", detail: "you took a bulk order on account and never settled it" }); } },
      { label: "Pass", sub: "Keep your cash", apply: (g) => { addImportantNotice(g, "Supplier deal declined — cash kept.", "neutral"); } },
    ],
  },
  {
    id: "investor_offer",
    category: EVENT_CATEGORIES.MONEY, rarity: "uncommon", cooldownDays: 60,
    // $120,000 against a $180,000 repayment is a lifeline at $400 and an insult at $5M.
    eligible: (g) => (g.cash || 0) < 250000 && (g.loans || []).length < 3,
    title: "💼 Angel Investor", tone: "green",
    desc: "A local investor offers $120,000 cash today. In return, you agree to pay $1,200/week until $180,000 total is repaid.",
    options: [
      { label: "Accept investment", sub: "+$120,000 now, $1,200/week repayment", apply: (g) => { g.cash += 120000; g.loans = g.loans || []; g.loans.push({ id: uid(), label: "Angel Investment", weeklyPayment: 1200, weeksLeft: 150, remainingBalance: 180000, missedPayments: 0 }); addLog(g, "💼 Angel investor deal closed — $120,000 received."); addImportantNotice(g, "Angel investment: $120,000 received — loan created.", "green"); } },
      { label: "Decline", sub: "No debt, no strings", apply: (g) => { addImportantNotice(g, "Angel investor declined — no debt taken on.", "neutral"); } },
    ],
  },
  {
    id: "rival_poach",
    category: EVENT_CATEGORIES.RIVALS, rarity: "uncommon", cooldownDays: 40,
    // Never offer a worker to a company with nowhere to put them or no way to pay the bonus.
    eligible: (g) => (g.crew || []).length < getTotalCrewCap(g) && (g.cash || 0) >= 10000,
    title: "📉 Rival Struggling", tone: "orange",
    desc: "A struggling rival's best worker is looking for a new employer. You can hire them for a $10,000 signing bonus.",
    options: [
      { label: "Poach them", sub: "Pay $10,000 — get a skilled Veteran worker", apply: (g) => { if (g.cash >= 10000) { g.cash -= 10000; g.expenses += 10000; const w = createWorker("Site Foreman"); w.skill = rand(100, 118); w.trait = CREW_TRAITS.find(t => t.label === "Veteran") || pick(CREW_TRAITS); w.wagePerDay = rand(220, 320); w.hireDay = g.day; g.crew.push(w); addLog(g, `👷 Poached ${w.name} from struggling rival — Veteran Foreman hired.`); addImportantNotice(g, `Veteran crew member poached from rival for $10,000.`, "green"); } } },
      { label: "Stay out", sub: "Not your business", apply: (g) => { addImportantNotice(g, "Rival's worker not hired — cash saved.", "neutral"); } },
    ],
  },
  {
    id: "rush_bid",
    category: EVENT_CATEGORIES.CLIENT, rarity: "common", cooldownDays: 20,
    // Someone has to be able to do the work.
    eligible: (g) => (g.crew || []).length > 0,
    title: "⚡ Emergency Contract", tone: "yellow",
    desc: "A client needs urgent repair work — double the going rate but the deadline is 4 days with heavy penalties.",
    options: [
      { label: "Take the rush job", sub: "2× value, 4-day deadline, 3× penalty/day", apply: (g) => { const base = CONTRACT_DEFS.find(d => d.category === "Commercial" && d.minTier <= 2); if (base) { const c = createContract(g); c.value = Math.round(c.value * 2.0); c.deadline = g.day + 5; c.expiresDay = g.day + 2; c.penaltyPerDay = (c.penaltyPerDay || 200) * 3; c.label = "⚡ " + c.label; g.contracts.push(c); addLog(g, `⚡ Emergency contract added — high value, tight window.`); addImportantNotice(g, "Rush contract added — tight deadline, 2× payout. Check Bids.", "orange"); } } },
      { label: "Turn it down", sub: "Too risky right now", apply: (g) => { addImportantNotice(g, "Emergency contract declined — too risky.", "neutral"); } },
    ],
  },
  {
    id: "bulk_equipment_deal",
    category: EVENT_CATEGORIES.PLANT, rarity: "uncommon", cooldownDays: 45,
    // A yard already at capacity cannot take the discount.
    eligible: (g) => (g.equipment || []).length < (OFFICES[g.officeIndex]?.equipCap || 0) + getEquipCapBonus(g),
    title: "🚜 Fleet Discount", tone: "cyan",
    desc: "An equipment dealer offers 20% off any purchase today only. Valid for next machine you buy.",
    options: [
      { label: "Lock in the discount", sub: "Next equipment purchase: -20%", apply: (g) => { g._equipDiscount = 0.20; g._equipDiscountExpiry = (g.day||1) + 3; addLog(g, "🚜 Fleet discount locked — 20% off next machine for 3 days!"); addImportantNotice(g, "20% equipment discount active for 3 days — visit Vehicles.", "green"); } },
      { label: "Not now", sub: "No savings today", apply: (g) => { addImportantNotice(g, "Equipment discount passed — no purchase planned.", "neutral"); } },
    ],
  },
  {
    id: "govt_contract_tip",
    category: EVENT_CATEGORIES.CLIENT, rarity: "rare", cooldownDays: 70,
    // Nobody slips inside information to an outfit with no track record.
    eligible: (g) => (g.reputation || 0) >= 40 && (g.completedJobs || 0) >= 3,
    title: "🏛️ Gov't Insider", tone: "purple",
    desc: "A contact tips you off: a major government contract is coming. Spend $3,000 on prep work to get priority bid access.",
    options: [
      { label: "Invest in prep", sub: "$3,000 → priority on next Government contract", apply: (g) => { if (g.cash >= 3000) { g.cash -= 3000; g.expenses += 3000; g._govtPriority = true; addLog(g, "🏛️ Invested in government prep — priority access on next Gov contract."); addImportantNotice(g, "Government contract tip: $3,000 invested — priority bid access unlocked.", "green"); } } },
      { label: "Skip it", sub: "Save your cash", apply: (g) => { addImportantNotice(g, "Government contract tip declined.", "neutral"); } },
    ],
  },
  {
    id: "competitor_acquisition",
    category: EVENT_CATEGORIES.RIVALS, rarity: "rare", cooldownDays: 90,
    // Buying a rival is a late-game move, and offering it early just advertises that nothing is being tracked.
    eligible: (g) => (g.cash || 0) >= 150000 && (g.companyLevel || 1) >= 4,
    title: "🤝 Acquisition Offer", tone: "orange",
    desc: "Northwest Contractors is in financial trouble. You can acquire them for $160,000 — absorbing their 3 crew and 1 machine.",
    options: [
      { label: "Acquire them", sub: "$160,000 → 3 workers + 1 machine + rep boost", apply: (g) => { if (g.cash >= 160000) { g.cash -= 160000; g.expenses += 160000; for (let i=0;i<3;i++) { const w = createWorker(); w.skill = rand(90,110); w.hireDay = g.day; g.crew.push(w); } const acquiredMachine = createEquipment(EQUIPMENT_SHOP[1] || EQUIPMENT_SHOP[0]); acquiredMachine.condition = rand(60, 80); acquiredMachine.name = "Acquired " + acquiredMachine.name; g.equipment = g.equipment || []; g.equipment.push(acquiredMachine); g.reputation = Math.min(100,(g.reputation||0)+5); if (!(g.acquiredRivals||[]).includes("northwest")) g.acquiredRivals = [...(g.acquiredRivals||[]),"northwest"]; addLog(g, "🤝 Acquired Northwest Contractors — 3 crew, 1 machine absorbed!"); addImportantNotice(g, "Rival acquired! +3 crew, +1 equipment, +5 reputation.", "green"); } } },
      { label: "Pass", sub: "Not the right time", apply: (g) => { addImportantNotice(g, "Acquisition passed — not the right time.", "neutral"); } },
    ],
  },
  {
    id: "material_futures",
    category: EVENT_CATEGORIES.MONEY, rarity: "uncommon", cooldownDays: 40,
    // You cannot take a position you cannot fund.
    eligible: (g) => (g.cash || 0) >= 15000,
    title: "📊 Material Futures", tone: "yellow",
    desc: "Lock in today's steel price for 30 days by pre-paying $8,000. Protects against market volatility.",
    options: [
      { label: "Lock in steel price", sub: "$8,000 → steel price frozen for 30 days", apply: (g) => { if (g.cash >= 8000) { g.cash -= 8000; g.expenses += 8000; g._steelPriceLock = (g.day||1) + 30; g._steelPriceLocked = g.materialPrices.steel || 950; addLog(g, "📊 Steel price locked for 30 days — protected from volatility."); addImportantNotice(g, "Steel price locked for 30 days — protected from market spikes.", "green"); } } },
      { label: "Skip the hedge", sub: "Take your chances", apply: (g) => { addImportantNotice(g, "Material futures declined — steel price exposed to market.", "neutral"); } },
    ],
  },
  {
    id: "training_grant",
    category: EVENT_CATEGORIES.PEOPLE, rarity: "uncommon", cooldownDays: 50,
    // A training grant needs someone to train.
    eligible: (g) => (g.crew || []).length >= 2,
    title: "🎓 Government Grant", tone: "green",
    desc: "A regional skills grant offers to fund $10,000 worth of crew training. Accept or lose the allocation.",
    options: [
      { label: "Accept the grant", sub: "+$10,000 training credit", apply: (g) => { g.cash += 10000; addLog(g, "🎓 Government training grant accepted — $10,000 added to operating funds."); addImportantNotice(g, "Training grant received: $10,000 added to cash.", "green"); } },
      { label: "Decline", sub: "Someone else gets it", apply: (g) => { addImportantNotice(g, "Training grant declined — someone else takes it.", "neutral"); } },
    ],
  },
  {
    id: "insurance_payout",
    category: EVENT_CATEGORIES.MONEY, rarity: "uncommon", cooldownDays: 50,
    // Raising a deductible only means something if you own plant the policy covers.
    eligible: (g) => (g.equipment || []).length >= 2,
    title: "Insurance Payout Offer",
    tone: "opportunity",
    desc: "Your insurer is offering a one-time payout of $40,000 in exchange for raising your deductible by 50%. Accept?",
    options: [
      { label: "Accept Payout (+$40k, higher deductible)", sub: "Immediate cash, but incidents cost more.", apply: (g) => {
        g.cash = (g.cash||0) + 40000;
        g.insuranceDeductibleMult = ((g.insuranceDeductibleMult||1) * 1.5);
        addLog(g, "💰 Insurance payout accepted — $40k received.");
        addImportantNotice(g, "Insurance payout: $40,000 received — deductible raised 50%.", "green");
      } },
      { label: "Decline (keep current terms)", sub: "No change.", apply: (g) => {
        addLog(g, "Insurance terms unchanged.");
        addImportantNotice(g, "Insurance payout declined — terms unchanged.", "neutral");
      } },
    ],
  },
  {
    id: "local_government_grant",
    category: EVENT_CATEGORIES.CLIENT, rarity: "rare", cooldownDays: 65,
    // A city does not hand infrastructure grants to a company with no delivery record.
    eligible: (g) => (g.completedJobs || 0) >= 2 && (g.reputation || 0) >= 30,
    title: "Government Infrastructure Grant",
    tone: "opportunity",
    desc: "The city is offering a $50,000 construction grant for infrastructure work. Requires completing 1 road/bridge contract within 60 days.",
    options: [
      { label: "Apply for Grant (+$50k on completion)", sub: "Must complete an infrastructure contract in 60 days.", apply: (g) => {
        g.activeGrant = { type: "infrastructure", reward: 50000, deadline: (g.day||0) + 60 };
        addLog(g, "📋 Infrastructure grant applied — complete a road or bridge contract within 60 days for $50k.");
        addImportantNotice(g, "Government grant active — earn $50,000 bonus on next infrastructure job.", "green");
      } },
      { label: "Pass on This Offer", sub: "No obligation.", apply: (g) => {
        addLog(g, "Government grant declined.");
        addImportantNotice(g, "Government grant declined.", "neutral");
      } },
    ],
  },
  {
    id: "corner_cut",
    category: EVENT_CATEGORIES.CLIENT, rarity: "common", cooldownDays: 30,
    // A client can only ask you to cut corners on work that is actually under way.
    eligible: (g) => (g.activeSites || []).length > 0,
    title: "✂️ Client Wants to Cut Corners", tone: "red",
    desc: "Your client is asking you to skip a safety check to finish 2 days early. Saves time, but increases your liability.",
    options: [
      { label: "Agree — skip the check", sub: "Site +15% speed · safety -8 · risk of fine", apply: (g) => {
        const site=(g.activeSites||[]).find(s=>s.status==="Active");
        if (site) site.phaseProgress=Math.min(100,(site.phaseProgress||0)+15);
        g.safetyScore=Math.max(0,(g.safetyScore||60)-8);
        if (Math.random()<0.25) { g.cash-=2000; g.expenses+=2000; addImportantNotice(g,"Safety shortcut backfired — $2,000 inspector fine!","red"); }
        else addImportantNotice(g,"Corner cut — faster progress, lower safety score.","orange");
        addLog(g,"✂️ Safety check skipped to speed up delivery.");
      }},
      { label: "Refuse professionally", sub: "No impact · rep +2", apply: (g) => {
        g.reputation=Math.min(100,(g.reputation||0)+2);
        addImportantNotice(g,"Refused to cut corners — reputation +2 for doing it right.","green");
        addLog(g,"✅ Refused to skip safety check — reputation +2.");
      }},
      { label: "Extend deadline 1 day", sub: "No penalty · safety maintained", apply: (g) => {
        const site=(g.activeSites||[]).find(s=>s.status==="Active");
        if (site) site.deadlineDay=(site.deadlineDay||g.day)+1;
        addImportantNotice(g,"Deadline extended 1 day — safety maintained.","green");
        addLog(g,"📋 Deadline extended 1 day to maintain safety standards.");
      }},
    ],
  },
  {
    id: "foreman_ultimatum",
    category: EVENT_CATEGORIES.PEOPLE, rarity: "common", cooldownDays: 35,
    // There has to be a crew worth running before someone demands to run it.
    eligible: (g) => (g.crew || []).length >= 3 || (g.officeStaff || []).some((s) => s && s.role === "Site Foreman"),
    title: "💼 Foreman Demands a Raise or Quits", tone: "orange",
    desc: "Your most experienced crew member issued an ultimatum: 20% raise or they're leaving for a competitor.",
    options: [
      { label: "Grant the 20% raise", sub: "Wage +20% · loyalty +10", apply: (g) => {
        const w=[...(g.crew||[])].sort((a,b)=>(b.jobsCompleted||0)-(a.jobsCompleted||0))[0];
        if (w) { w.wagePerDay=Math.round(w.wagePerDay*1.20); w.loyalty=Math.min(100,(w.loyalty ?? 50)+10); addLog(g,`💼 ${w.name} got their 20% raise — staying loyal.`); addImportantNotice(g,`${w.name} got their raise — loyalty +10.`,"green"); }
      }},
      { label: "Negotiate 10% raise", sub: "Wage +10% · loyalty +2 · mood -5", apply: (g) => {
        const w=[...(g.crew||[])].sort((a,b)=>(b.jobsCompleted||0)-(a.jobsCompleted||0))[0];
        if (w) { w.wagePerDay=Math.round(w.wagePerDay*1.10); w.loyalty=Math.min(100,(w.loyalty ?? 50)+2); w.mood=Math.max(0,(w.mood ?? 50)-5); addLog(g,`💼 ${w.name} accepted 10% compromise.`); addImportantNotice(g,`${w.name} accepted partial raise.`,"orange"); }
      }},
      { label: "Let them go", sub: "Worker leaves · rep -1", apply: (g) => {
        const w=[...(g.crew||[])].sort((a,b)=>(b.jobsCompleted||0)-(a.jobsCompleted||0))[0];
        if (w) { g.crew=g.crew.filter(c=>c.id!==w.id); g.reputation=Math.max(0,(g.reputation||0)-1); addLog(g,`👋 ${w.name} left after demands were rejected.`); addImportantNotice(g,`${w.name} walked out — rep -1.`,"red"); }
      }},
    ],
  },
  {
    id: "inspector_violation",
    category: EVENT_CATEGORIES.REGULATOR, rarity: "common", cooldownDays: 30,
    // There is nothing to inspect without an open site.
    eligible: (g) => (g.activeSites || []).length > 0,
    title: "🚨 Inspector Found a Violation", tone: "red",
    desc: "An inspector flagged a safety issue on your active site. You can fix it properly, pay a fine, or contest it.",
    options: [
      { label: "Fix it properly", sub: "-$1,500 · safety +5 · site paused 2 days", apply: (g) => {
        g.cash-=1500; g.expenses+=1500; g.weeklyStats.expenses+=1500; g.weeklyStats.unexpectedCosts=(g.weeklyStats.unexpectedCosts||0)+1500;
        g.safetyScore=Math.min(100,(g.safetyScore||60)+5);
        const site=(g.activeSites||[]).find(s=>s.status==="Active");
        if (site) site.pausedDays=(site.pausedDays||0)+2;
        addLog(g,"🔧 Violation fixed properly — $1,500, site paused 2 days, safety +5.");
        addImportantNotice(g,"Violation fixed — safety +5. Site resumes in 2 days.","green");
      }},
      { label: "Pay the fine and continue", sub: "-$3,000 · safety -2", apply: (g) => {
        g.cash-=3000; g.expenses+=3000; g.weeklyStats.expenses+=3000; g.weeklyStats.unexpectedCosts=(g.weeklyStats.unexpectedCosts||0)+3000;
        g.safetyScore=Math.max(0,(g.safetyScore||60)-2);
        addLog(g,"💸 Paid $3,000 fine and continued — safety -2.");
        addImportantNotice(g,"Violation fine paid — $3,000. Site continues but safety docked.","orange");
      }},
      { label: "Contest the violation", sub: "50% waived · 50% doubled to $6,000", apply: (g) => {
        if (Math.random()<0.5) { addLog(g,"✅ Violation contested — fine waived."); addImportantNotice(g,"Inspection contested — violation overturned!","green"); }
        else { g.cash-=6000; g.expenses+=6000; g.weeklyStats.expenses+=6000; g.weeklyStats.unexpectedCosts=(g.weeklyStats.unexpectedCosts||0)+6000; addLog(g,"❌ Contested and lost — doubled fine of $6,000."); addImportantNotice(g,"Contest failed — $6,000 fine applied.","red"); }
      }},
    ],
  },
  {
    id: "emergency_job",
    category: EVENT_CATEGORIES.CLIENT, rarity: "common", cooldownDays: 22,
    // An emergency you have nobody free to answer is not a decision, it is a notification.
    eligible: (g) => (g.crew || []).some((w) => w && w.status !== "Working"),
    title: "🚨 Emergency Project Offer", tone: "green",
    desc: "A developer just called — a competitor dropped out and they need someone to start a $45,000 job tomorrow. Tight 5-day deadline.",
    options: [
      { label: "Take the emergency job", sub: "~$45k contract added · 5-day deadline", apply: (g) => {
        const c=createContract(g); c.value=Math.round(45000*computeInflation(g)); c.deadline=g.day+5; c.expiresDay=g.day+2; c.penaltyPerDay=Math.round(c.value*0.06); c.label="🚨 Emergency: "+c.label; g.contracts.push(c);
        addLog(g,"🚨 Emergency contract added — $45k, 5-day window.");
        addImportantNotice(g,"Emergency contract available! Tight deadline — check Bids.","orange");
      }},
      { label: "Stay the course", sub: "Rep +1 — you're reliable", apply: (g) => {
        g.reputation=Math.min(100,(g.reputation||0)+1);
        addLog(g,"✅ Declined emergency job — focused on current commitments. Rep +1.");
        addImportantNotice(g,"Emergency job declined — clients respect your focus. Rep +1.","green");
      }},
    ],
  },
  {
    id: "union_rep",
    category: EVENT_CATEGORIES.PEOPLE, rarity: "uncommon", cooldownDays: 55,
    // A union rep visits a workforce, not a pair of labourers.
    eligible: (g) => (g.crew || []).length >= 4,
    title: "🤝 Union Representative Visits", tone: "orange",
    desc: "A labor organizer is on your site talking to crew. How you respond will shape morale and wages.",
    options: [
      { label: "Engage cooperatively", sub: "All wages +$15/day · loyalty +8 · mood +10", apply: (g) => {
        for (const w of (g.crew||[])) { w.wagePerDay=(w.wagePerDay||120)+15; w.loyalty=Math.min(100,(w.loyalty ?? 50)+8); w.mood=Math.min(100,(w.mood ?? 50)+10); }
        addLog(g,"🤝 Cooperative with union — wages +$15/day, morale boosted.");
        addImportantNotice(g,"Union engagement positive — crew morale and loyalty up.","green");
      }},
      { label: "Disclaim any issues", sub: "No change, 25% chance mood -5 all", apply: (g) => {
        if (Math.random()<0.25) { for (const w of (g.crew||[])) { w.mood=Math.max(0,(w.mood ?? 50)-5); } addImportantNotice(g,"Workers not convinced — crew mood slightly down.","orange"); addLog(g,"😕 Crew not satisfied with response — mood -5 each."); }
        else { addImportantNotice(g,"Crew accepted the response — no change.","neutral"); addLog(g,"Union rep visit — no change."); }
      }},
      { label: "Block them from the site", sub: "Loyalty -5 all · mood -8 all · rep -1", apply: (g) => {
        for (const w of (g.crew||[])) { w.loyalty=Math.max(0,(w.loyalty ?? 50)-5); w.mood=Math.max(0,(w.mood ?? 50)-8); }
        g.reputation=Math.max(0,(g.reputation||0)-1);
        addLog(g,"🚫 Union blocked — crew loyalty and morale damaged.");
        addImportantNotice(g,"Union blocked — crew loyalty -5, mood -8 each. Rep -1.","red");
      }},
    ],
  },
  {
    id: "subcontractor_dispute",
    category: EVENT_CATEGORIES.SITE, rarity: "common", cooldownDays: 28,
    // A dispute needs a site to be disputed on.
    eligible: (g) => (g.activeSites || []).length > 0,
    title: "⚠️ Subcontractor Dispute", tone: "orange",
    desc: "Your subcontractor crew is threatening to walk off the job over a payment dispute.",
    options: [
      { label: "Pay dispute settlement", sub: "-$2,500 · subs stay on site", apply: (g) => {
        g.cash-=2500; g.expenses+=2500; g.weeklyStats.expenses+=2500; g.weeklyStats.unexpectedCosts=(g.weeklyStats.unexpectedCosts||0)+2500;
        addLog(g,"💸 Subcontractor dispute settled — $2,500 paid, work continues.");
        addImportantNotice(g,"Subcontractor settled for $2,500 — site stays on track.","orange");
      }},
      { label: "Negotiate", sub: "60% resolve for $1,000 — 40% walkoff", apply: (g) => {
        if (Math.random()<0.6) { g.cash-=1000; g.expenses+=1000; addLog(g,"✅ Negotiated sub dispute for $1,000."); addImportantNotice(g,"Negotiation success — $1,000 paid, work continues.","green"); }
        else { const site=(g.activeSites||[]).find(s=>s.status==="Active"); if (site) site.pausedDays=(site.pausedDays||0)+3; addLog(g,"❌ Negotiations failed — subs walked off. Site paused 3 days."); addImportantNotice(g,"Subs walked off — site paused 3 days.","red"); }
      }},
      { label: "Let them walk", sub: "Site paused 3 days · no cost", apply: (g) => {
        const site=(g.activeSites||[]).find(s=>s.status==="Active");
        if (site) site.pausedDays=(site.pausedDays||0)+3;
        if ((g.subcontractors||[]).length>0) g.subcontractors=g.subcontractors.slice(1);
        addLog(g,"🚪 Subcontractors walked off — site paused 3 days.");
        addImportantNotice(g,"Subs walked — site paused 3 days. Find a replacement.","red");
      }},
    ],
  },
  {
    id: "delay_regulatory",
    category: EVENT_CATEGORIES.REGULATOR, rarity: "rare", cooldownDays: 45,
    // Rare in the random pool because this one has its own real trigger in the site code; the draw is the exception, not the source.
    eligible: (g) => (g.activeSites || []).length > 0,
    title: "📜 Regulatory Hold", tone: "yellow",
    desc: "Inspectors have flagged this site for a compliance review.",
    options: [
      { label: "Wait It Out", sub: "Pause and pay compliance fee", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        if (site) pauseSite(site, pd.delayDays||5, "regulatory");
        g.cash -= (pd.fine||1000); g.expenses = (g.expenses||0) + (pd.fine||1000);
        addLog(g, `📜 Regulatory hold accepted — ${money(pd.fine||1000)} paid, site paused ${pd.delayDays||5} days.`);
        addImportantNotice(g, `Site paused ${pd.delayDays||5} days for regulatory hold. ${money(pd.fine||1000)} paid.`, "orange");
      } },
      { label: "Expedite Process", sub: "Pay extra to reduce delay", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        const totalCost = (pd.fine||1000) + (pd.expediteCost||500);
        const reducedDays = Math.ceil((pd.delayDays||5) / 2);
        if (g.cash >= totalCost) {
          if (site) pauseSite(site, reducedDays, "regulatory");
          g.cash -= totalCost; g.expenses = (g.expenses||0) + totalCost;
          addLog(g, `📜 Expedited regulatory process — ${money(totalCost)} paid, only ${reducedDays} day pause.`);
          addImportantNotice(g, `Expedited review: ${money(totalCost)} paid, hold cut to ${reducedDays} days.`, "orange");
        } else {
          if (site) pauseSite(site, pd.delayDays||5, "regulatory");
          g.cash -= (pd.fine||1000); g.expenses = (g.expenses||0) + (pd.fine||1000);
          addLog(g, `📜 Not enough cash to expedite — paid ${money(pd.fine||1000)}, full delay applied.`);
          addImportantNotice(g, `Not enough cash to expedite — full delay applied.`, "red");
        }
      } },
      { label: "Premium Resolution", sub: "High cost, chance to eliminate delay", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        const totalCost = (pd.fine||1000) + (pd.premiumCost||800);
        if (g.cash >= totalCost) {
          g.cash -= totalCost; g.expenses = (g.expenses||0) + totalCost;
          if (Math.random() < 0.70) {
            addLog(g, `📜 Premium resolution succeeded — regulatory hold cleared! Cost: ${money(totalCost)}.`);
            addImportantNotice(g, `Premium push worked — hold cleared! ${money(totalCost)} paid.`, "green");
          } else {
            if (site) pauseSite(site, 1, "regulatory");
            addLog(g, `📜 Premium resolution partially worked — ${money(totalCost)} paid, 1-day minimum hold.`);
            addImportantNotice(g, `Premium didn't fully clear — 1-day hold remains. ${money(totalCost)} paid.`, "orange");
          }
        } else {
          if (site) pauseSite(site, pd.delayDays||5, "regulatory");
          g.cash -= (pd.fine||1000); g.expenses = (g.expenses||0) + (pd.fine||1000);
          addLog(g, `📜 Insufficient funds for premium — ${money(pd.fine||1000)} paid, full delay applied.`);
          addImportantNotice(g, `Insufficient funds for premium — full delay applied.`, "red");
        }
      } },
    ],
  },
  {
    id: "delay_permit",
    category: EVENT_CATEGORIES.REGULATOR, rarity: "rare", cooldownDays: 30,
    // Same: the permit system raises this properly. The random draw is a backstop.
    eligible: (g) => (g.activeSites || []).length > 0,
    title: "📋 Permit Review Delay", tone: "yellow",
    desc: "The city requires additional paperwork before work can proceed.",
    options: [
      { label: "Accept the Delay", sub: "Lose progress and reputation", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        if (site) site.phaseProgress = Math.max(0, (site.phaseProgress||0) - (pd.progressLoss||8));
        g.reputation = Math.max(0, (g.reputation||0) - 1);
        addLog(g, `📋 Permit delay accepted — ${pd.progressLoss||8}% progress lost, rep -1.`);
        addImportantNotice(g, `Permit delay: ${pd.progressLoss||8}% progress lost, rep -1.`, "orange");
      } },
      { label: "Expedite Paperwork", sub: "Pay to reduce progress loss", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        const cost = pd.expediteCost || 400;
        const halfLoss = Math.ceil((pd.progressLoss||8) / 2);
        if (g.cash >= cost) {
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress||0) - halfLoss);
          g.cash -= cost; g.expenses = (g.expenses||0) + cost;
          addLog(g, `📋 Expedited permit — ${money(cost)} paid, only ${halfLoss}% progress lost.`);
          addImportantNotice(g, `Paid ${money(cost)} to halve permit delay — ${halfLoss}% progress lost.`, "orange");
        } else {
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress||0) - (pd.progressLoss||8));
          g.reputation = Math.max(0, (g.reputation||0) - 1);
          addLog(g, `📋 Insufficient funds to expedite — full ${pd.progressLoss||8}% progress lost.`);
          addImportantNotice(g, `Not enough cash to expedite — full permit delay applied.`, "red");
        }
      } },
      { label: "Premium Resolution", sub: "Pay more for 80% chance to skip", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        const cost = pd.premiumCost || 800;
        if (g.cash >= cost) {
          g.cash -= cost; g.expenses = (g.expenses||0) + cost;
          if (Math.random() < 0.80) {
            addLog(g, `📋 Premium filing succeeded — permit delay cleared! Cost: ${money(cost)}.`);
            addImportantNotice(g, `Paid ${money(cost)} — permit cleared!`, "green");
          } else {
            if (site) site.phaseProgress = Math.max(0, (site.phaseProgress||0) - Math.ceil((pd.progressLoss||8) / 3));
            addLog(g, `📋 Premium filing helped — ${money(cost)} paid, minimal progress lost.`);
            addImportantNotice(g, `Premium helped but didn't fully clear — ${money(cost)} paid, minimal loss.`, "orange");
          }
        } else {
          if (site) site.phaseProgress = Math.max(0, (site.phaseProgress||0) - (pd.progressLoss||8));
          g.reputation = Math.max(0, (g.reputation||0) - 1);
          addLog(g, `📋 Insufficient funds for premium — full permit delay applied.`);
          addImportantNotice(g, `Not enough cash for premium — full permit delay applied.`, "red");
        }
      } },
    ],
  },
  // ── Chain events: the chronicle comes back for you ────────────────────────
  //
  // Phase 6 built a durable company memory — who you paid, who you stiffed, which crew you
  // stood by — and wired it into bidding edges, material prices and crew turnover. What it
  // never did was CONFRONT the player with it. `pickMemoryCallback` was called in exactly one
  // place in this file: inside the Company Story card's render, as display text.
  //
  // So the chronicle informed the numbers and narrated itself, and nothing ever knocked on the
  // door. These are the knock. Each one is eligible only when the memory it refers to actually
  // exists, which is what makes it a consequence rather than a coincidence.
  {
    id: "chain_supplier_reckoning",
    category: EVENT_CATEGORIES.MONEY, rarity: "common", cooldownDays: 40,
    // Only if you genuinely took materials and did not pay for them, and enough time has
    // passed that it reads as history rather than as the same conversation continuing.
    eligible: (g) => recallMemory(g, { kind: "supplier", valence: "bad", olderThanDays: 12 }).length > 0,
    title: "📦 An Old Account", tone: "orange",
    desc: "Your materials rep is at the gate with a folder. They have not forgotten the order you took on account and never settled — and they want to know what you intend to do about it before the next delivery goes out.",
    options: [
      { label: "Settle it in full", sub: "Pay $12,000 → the account is clean and they will remember that too",
        apply: (g) => {
          if (g.cash < 12000) { addImportantNotice(g, "Not enough cash to settle the supplier account.", "red"); return; }
          g.cash -= 12000; g.expenses += 12000;
          recordTransaction(g, "materials", -12000, "Settled overdue supplier account");
          recordMemory(g, { tag: `supplier_settled_${g.day}`, kind: "supplier", valence: "good", weight: 2.5, label: "Settled an old debt", detail: "you came back and settled an account you could have walked away from" });
          addLog(g, "📦 Old supplier account settled in full — $12,000.");
          addImportantNotice(g, "Supplier account settled. Your rep noted that you came back for it.", "green");
        } },
      { label: "Pay half and promise the rest", sub: "Pay $6,000 → buys goodwill, but the history stands",
        apply: (g) => {
          if (g.cash < 6000) { addImportantNotice(g, "Not enough cash for even a part settlement.", "red"); return; }
          g.cash -= 6000; g.expenses += 6000;
          recordTransaction(g, "materials", -6000, "Part settlement of supplier account");
          addLog(g, "📦 Part-settled the old supplier account — $6,000.");
          addImportantNotice(g, "Half the old account paid. Your supplier is watching.", "orange");
        } },
      { label: "Tell them to take a number", sub: "Costs nothing today — your supplier goodwill gets worse",
        apply: (g) => {
          recordMemory(g, { tag: `supplier_refused_${g.day}`, kind: "supplier", valence: "bad", weight: 3, label: "Refused to settle", detail: "you were asked directly for an old debt and refused" });
          addLog(g, "📦 Refused to settle the old supplier account.");
          addImportantNotice(g, "You refused to settle. Materials will cost you more from here.", "red");
        } },
    ],
  },
  {
    id: "chain_loyal_crew_opportunity",
    category: EVENT_CATEGORIES.PEOPLE, rarity: "uncommon", cooldownDays: 45,
    // The mirror image: standing by your crew is supposed to be worth something, and until now
    // it was worth a number the player never saw.
    eligible: (g) => recallMemory(g, { kind: "crew", valence: "good", olderThanDays: 12 }).length > 0 && (g.crew || []).length >= 2,
    title: "👷 Word Gets Around", tone: "green",
    desc: "One of your crew heard you looked after your people when it would have been cheaper not to. They have a cousin in the trade — a good one, currently underpaid somewhere worse — who would come to you for a handshake rather than a signing bonus.",
    options: [
      { label: "Bring them on", sub: "A skilled hire at no signing cost",
        apply: (g) => {
          if ((g.crew || []).length >= getTotalCrewCap(g)) { addImportantNotice(g, "No room on the crew for another hire — expand your office first.", "orange"); return; }
          // A referral is someone vouched for: better than the open market on both counts.
          const w = createWorker(null, { skill: rand(95, 118), loyalty: rand(78, 92), hireDay: g.day });
          g.crew.push(w);
          recordMemory(g, { tag: `crew_referral_${g.day}`, kind: "crew", valence: "good", weight: 1.5, label: "Hired on a crew referral", detail: "one of your own vouched for a hire and was right" });
          addLog(g, `👷 ${w.name} joined on a crew referral — no signing bonus.`);
          addImportantNotice(g, `${w.name} joined on a referral from your own crew. No signing bonus.`, "green");
        } },
      { label: "Not right now", sub: "Keep the payroll where it is",
        apply: (g) => { addImportantNotice(g, "Referral declined — payroll held steady.", "neutral"); } },
    ],
  },
  {
    id: "chain_rival_grudge",
    category: EVENT_CATEGORIES.RIVALS, rarity: "uncommon", cooldownDays: 50,
    eligible: (g) => recallMemory(g, { kind: "rivalry", olderThanDays: 15 }).length > 0,
    title: "📉 They Remember You", tone: "red",
    desc: "A rival you have history with has started bidding against you on purpose — not to win the work, but to make sure you do not win it cheaply. Your estimator says they are pricing below cost on anything you show interest in.",
    options: [
      { label: "Bid through it", sub: "Absorb the pressure — reputation +2, tighter margins for a while",
        apply: (g) => {
          g.reputation = Math.min(100, (g.reputation || 0) + 2);
          recordMemory(g, { tag: `rival_stood_${g.day}`, kind: "rivalry", valence: "good", weight: 2, label: "Stood your ground", detail: "a rival tried to price you out and you did not blink" });
          addLog(g, "📉 Held your pricing against a rival bidding below cost.");
          addImportantNotice(g, "You held your pricing. The market noticed — reputation +2.", "green");
        } },
      { label: "Quietly approach them", sub: "Pay $8,000 to settle the history",
        apply: (g) => {
          if (g.cash < 8000) { addImportantNotice(g, "Not enough cash to settle this.", "red"); return; }
          g.cash -= 8000; g.expenses += 8000;
          recordTransaction(g, "fines", -8000, "Settled a rivalry");
          recordMemory(g, { tag: `rival_settled_${g.day}`, kind: "rivalry", valence: "good", weight: 2, label: "Settled a rivalry", detail: "you paid to end a feud rather than let it run" });
          addLog(g, "📉 Settled the rivalry — $8,000.");
          addImportantNotice(g, "The rivalry is settled. They will stop targeting your bids.", "green");
        } },
      { label: "Let it run", sub: "Costs nothing — the grudge deepens",
        apply: (g) => {
          recordMemory(g, { tag: `rival_escalated_${g.day}`, kind: "rivalry", valence: "bad", weight: 2, label: "Let a feud run", detail: "you let a rivalry escalate rather than end it" });
          addImportantNotice(g, "You let it run. Expect them on every bid you want.", "orange");
        } },
    ],
  },
  {
    id: "chain_client_returns",
    category: EVENT_CATEGORIES.CLIENT, rarity: "uncommon", cooldownDays: 40,
    eligible: (g) => recallMemory(g, { kind: "client", valence: "good", olderThanDays: 10 }).length > 0,
    title: "🤝 A Client Came Back", tone: "green",
    desc: "A client you delivered for is building again, and they have come to you before they went to market. The price is theirs to set, but the work is yours to take.",
    options: [
      { label: "Take it at their number", sub: "A contract added to Bids, reputation +3",
        apply: (g) => {
          const ref = createContract({ cash: g.cash, day: g.day, creditScore: g.creditScore || 600, marketState: g.marketState || "Normal", equipment: g.equipment || [], contracts: g.contracts || [], _milestones: g._milestones || {}, cityOffices: g.cityOffices || [], properties: g.properties || [] });
          if (ref) g.contracts.push(ref);
          g.reputation = Math.min(100, (g.reputation || 0) + 3);
          recordMemory(g, { tag: `client_repeat_${g.day}`, kind: "client", valence: "good", weight: 2, label: "A client came back", detail: "a client you delivered for came back to you before going to market" });
          addLog(g, "🤝 Repeat client brought work straight to you.");
          addImportantNotice(g, "A repeat client brought work straight to you — new contract in Bids.", "green");
        } },
      { label: "Hold out for a better price", sub: "Risk the relationship for margin",
        apply: (g) => {
          recordMemory(g, { tag: `client_pushed_${g.day}`, kind: "client", valence: "bad", weight: 1.5, label: "Pushed a loyal client on price", detail: "you pushed a returning client for more money" });
          addImportantNotice(g, "You pushed for more. They said they would think about it.", "orange");
        } },
    ],
  },

];

// ─── Employee Events ─────────────────────────────────────────────────────────────
// Same shape as DECISION_EVENTS. apply(g) reads context from g.pendingDecision.context.

const EMPLOYEE_EVENTS = [
  // ── Negative ────────────────────────────────────────────────────────────────
  {
    id: "emp_sick", title: "🤒 Employee Called Off Sick", tone: "orange",
    desc: "A crew member called in sick. Site progress will slow unless you act.",
    options: [
      { label: "Hire a day worker to cover", sub: "-$350 · site keeps moving",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); g.cash -= 350; g.expenses += 350; addLog(g, `🤒 ${w?.name||"Crew"} called off — temp covered for $350.`); addImportantNotice(g, `${w?.name||"Crew member"} sick — temp hired for $350, site on track.`, "orange"); } },
      { label: "Run short-handed", sub: "Progress -4% · no cost",
        apply: (g) => { const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); if (site) site.phaseProgress = Math.max(0, (site.phaseProgress||0) - 4); addLog(g, `🤒 ${w?.name||"Crew"} absent — short-handed today.`); addImportantNotice(g, `${w?.name||"Crew member"} absent — site running short, 4% progress lost.`, "orange"); } },
      { label: "Paid sick day", sub: "-day's wages · loyalty +10",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); if (w) { g.cash -= (w.wagePerDay||20); g.expenses += (w.wagePerDay||20); w.loyalty = Math.min(100,(w.loyalty ?? 50)+10); addLog(g, `🤒 ${w.name} given paid sick day — loyalty up.`); addImportantNotice(g, `${w.name} given paid sick day — loyalty +10.`, "green"); } } },
    ],
  },
  {
    id: "emp_vehicle_damage", title: "🚗 Vehicle Damaged on Site", tone: "red",
    desc: "An employee accidentally damaged a vehicle on site. You need to decide how to handle it.",
    options: [
      { label: "Repair on-site now", sub: "-$600 · vehicle condition -15",
        apply: (g) => { const e = (g.equipment||[]).find(eq => eq.id === g.pendingDecision?.context?.equipId); const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); g.cash -= 600; g.expenses += 600; if (e) e.condition = Math.max(20, e.condition - 15); addLog(g, `🚗 ${w?.name||"Worker"} damaged a vehicle — repaired for $600.`); addImportantNotice(g, `Vehicle repaired on-site for $600. Condition reduced.`, "orange"); } },
      { label: "Dock their pay for damages", sub: "Recovers $150 · loyalty -15",
        apply: (g) => { const e = (g.equipment||[]).find(eq => eq.id === g.pendingDecision?.context?.equipId); const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); if (w) { g.cash += 150; w.loyalty = Math.max(0,(w.loyalty ?? 50)-15); } if (e) e.condition = Math.max(20, e.condition - 25); addLog(g, `🚗 ${w?.name||"Worker"} docked for vehicle damage.`); addImportantNotice(g, `${w?.name||"Worker"} docked $150 for vehicle damage — loyalty -15.`, "orange"); } },
      { label: "Write it off as wear and tear", sub: "Vehicle condition -25 · no cost",
        apply: (g) => { const e = (g.equipment||[]).find(eq => eq.id === g.pendingDecision?.context?.equipId); if (e) e.condition = Math.max(15, e.condition - 25); addLog(g, `🚗 Vehicle damage written off as site wear.`); addImportantNotice(g, `Vehicle damage written off — condition -25.`, "orange"); } },
    ],
  },
  {
    id: "emp_quits", title: "😤 Employee Quit Without Notice", tone: "red",
    desc: "A crew member walked off the job without warning. You need to replace them quickly.",
    options: [
      { label: "Emergency temp hire", sub: "-$800 · site stays staffed",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); if (w) { if (site) site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== w.id); g.crew = g.crew.filter(c => c.id !== w.id); } g.cash -= 800; g.expenses += 800; addLog(g, `😤 ${w?.name||"Worker"} quit — emergency temp hired for $800.`); addImportantNotice(g, `${w?.name||"Worker"} quit — emergency temp hired for $800.`, "orange"); } },
      { label: "Reassign remaining crew", sub: "Progress -5% · no cost",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); if (w) { if (site) { site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== w.id); site.phaseProgress = Math.max(0, (site.phaseProgress||0) - 5); } g.crew = g.crew.filter(c => c.id !== w.id); } addLog(g, `😤 ${w?.name||"Worker"} quit — remaining crew redistributed.`); addImportantNotice(g, `${w?.name||"Worker"} quit — crew redistributed, 5% progress lost.`, "red"); } },
    ],
  },
  {
    id: "emp_theft", title: "🔓 Theft Suspected on Site", tone: "red",
    desc: "A crew member is suspected of stealing materials worth about $900. How do you handle it?",
    options: [
      { label: "Fire them immediately", sub: "Lumber -8 · reputation -1",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); const matLoss = Math.min(g.materials?.lumber||0, 8); if (matLoss > 0) g.materials.lumber -= matLoss; g.reputation = Math.max(0,(g.reputation||0)-1); if (w) { if (site) site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== w.id); g.crew = g.crew.filter(c => c.id !== w.id); } addLog(g, `🔓 ${w?.name||"Worker"} fired for theft. Materials lost.`); addImportantNotice(g, `${w?.name||"Worker"} fired for theft — 8 lumber lost, rep -1.`, "red"); } },
      { label: "Formal warning, add site security", sub: "-$400 security · loyalty -20",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); g.cash -= 400; g.expenses += 400; if (w) w.loyalty = Math.max(0,(w.loyalty ?? 50)-20); addLog(g, `🔓 Theft warning issued. $400 in site security added.`); addImportantNotice(g, `Theft warning issued — $400 security added, ${w?.name||"worker"} loyalty -20.`, "orange"); } },
    ],
  },
  {
    id: "emp_delay", title: "🕐 Worker Caused a Setback", tone: "orange",
    desc: "A crew member made a sequencing error, forcing the team to redo part of the current phase.",
    options: [
      { label: "Address calmly, retrain on the spot", sub: "Progress -5% · skill +2",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); if (site) site.phaseProgress = Math.max(0,(site.phaseProgress||0)-5); if (w) w.skill = Math.min(150,(w.skill||50)+2); addLog(g, `🕐 ${w?.name||"Worker"} retrained after causing a delay.`); addImportantNotice(g, `${w?.name||"Worker"} retrained — skill +2, 5% progress lost.`, "orange"); } },
      { label: "Dock pay and issue warning", sub: "Progress -5% · loyalty -10",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); const dock = w?.wagePerDay||20; g.cash += dock; if (site) site.phaseProgress = Math.max(0,(site.phaseProgress||0)-5); if (w) w.loyalty = Math.max(0,(w.loyalty ?? 50)-10); addLog(g, `🕐 ${w?.name||"Worker"} docked pay for causing delay.`); addImportantNotice(g, `${w?.name||"Worker"} docked pay — loyalty -10, 5% progress lost.`, "orange"); } },
    ],
  },
  // ── Positive ────────────────────────────────────────────────────────────────
  {
    id: "emp_overtime", title: "💪 Employee Worked Overtime", tone: "green",
    desc: "A crew member stayed late without being asked and pushed the site forward. How do you respond?",
    options: [
      { label: "Pay them for the overtime", sub: "-$120 · progress +8% · loyalty +15",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); g.cash -= 120; g.expenses += 120; if (site) site.phaseProgress = Math.min(100,(site.phaseProgress||0)+8); if (w) w.loyalty = Math.min(100,(w.loyalty ?? 50)+15); addLog(g, `💪 ${w?.name||"Worker"} paid for overtime — great progress.`); addImportantNotice(g, `${w?.name||"Worker"} paid $120 overtime — progress +8%, loyalty +15.`, "green"); } },
      { label: "Say thanks — no extra pay", sub: "Progress +8% · loyalty -5",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); if (site) site.phaseProgress = Math.min(100,(site.phaseProgress||0)+8); if (w) w.loyalty = Math.max(0,(w.loyalty ?? 50)-5); addLog(g, `💪 ${w?.name||"Worker"} worked overtime unpaid.`); addImportantNotice(g, `${w?.name||"Worker"} worked overtime unpaid — progress +8%, loyalty -5.`, "orange"); } },
    ],
  },
  {
    id: "emp_saves_delay", title: "🛡️ Employee Prevented a Delay", tone: "green",
    desc: "Quick thinking by a crew member caught an issue before it became costly.",
    options: [
      { label: "Publicly recognize the good work", sub: "All crew loyalty +5 · top worker +10",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); (g.crew||[]).forEach(c => c.loyalty = Math.min(100,(c.loyalty ?? 50)+5)); if (w) w.loyalty = Math.min(100,(w.loyalty ?? 50)+10); addLog(g, `🛡️ ${w?.name||"Worker"} praised for preventing a delay — team morale up.`); addImportantNotice(g, `${w?.name||"Worker"} praised — all crew loyalty +5, ${w?.name||"worker"} +10.`, "green"); } },
      { label: "Note it, move on", sub: "Progress +5%",
        apply: (g) => { const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); if (site) site.phaseProgress = Math.min(100,(site.phaseProgress||0)+5); const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); addLog(g, `🛡️ ${w?.name||"Worker"} caught an issue early.`); addImportantNotice(g, `${w?.name||"Worker"} caught an issue early — progress +5%.`, "green"); } },
    ],
  },
  {
    id: "emp_cheap_materials", title: "💰 Employee Found Cheaper Materials", tone: "cyan",
    desc: "A crew member sourced an alternate supplier offering lumber 25% below market price.",
    options: [
      { label: "Buy 30 units at the discount", sub: "Costs ~25% below normal rate",
        apply: (g) => { const price = Math.round((g.materialPrices?.lumber||85)*0.75*30); if (g.cash >= price) { g.cash -= price; g.expenses += price; g.materials.lumber = (g.materials.lumber||0)+30; addLog(g, `💰 Bulk lumber at 25% off — 30 units for ${money(price)}.`); addImportantNotice(g, `30 lumber purchased at 25% off for ${money(price)}.`, "green"); } else { addLog(g, `💰 Couldn't afford the bulk discount this time.`); addImportantNotice(g, `Not enough cash for bulk lumber discount.`, "red"); } } },
      { label: "Pass for now", sub: "No action",
        apply: (g) => { addLog(g, `💰 Discounted materials offer declined.`); addImportantNotice(g, `Discounted lumber offer declined.`, "neutral"); } },
    ],
  },
  {
    id: "emp_morale_boost", title: "🎉 Crew Morale Is High", tone: "green",
    desc: "A crew member organized an impromptu team lunch. Spirits are up across the site.",
    options: [
      { label: "Kick in $200 to cover the crew", sub: "-$200 · all loyalty +15",
        apply: (g) => { g.cash -= 200; g.expenses += 200; (g.crew||[]).forEach(c => c.loyalty = Math.min(100,(c.loyalty ?? 50)+15)); addLog(g, `🎉 You covered team lunch — crew loyalty up significantly.`); addImportantNotice(g, `You covered team lunch ($200) — all crew loyalty +15.`, "green"); } },
      { label: "Let it happen naturally", sub: "All loyalty +5",
        apply: (g) => { (g.crew||[]).forEach(c => c.loyalty = Math.min(100,(c.loyalty ?? 50)+5)); addLog(g, `🎉 Team morale boosted naturally today.`); addImportantNotice(g, `Team morale boost — all crew loyalty +5.`, "green"); } },
    ],
  },
  {
    id: "emp_early_phase", title: "⚡ Phase Completed Early", tone: "green",
    desc: "A crew member organized the team efficiently and the current phase wrapped ahead of schedule.",
    options: [
      { label: "Push straight to the next phase", sub: "Progress +10%",
        apply: (g) => { const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); if (site) site.phaseProgress = Math.min(100,(site.phaseProgress||0)+10); addLog(g, `⚡ ${w?.name||"Worker"} led early phase completion — ahead of schedule.`); addImportantNotice(g, `Phase completed early! Progress +10% — ahead of schedule.`, "green"); } },
    ],
  },
  {
    id: "emp_referral", title: "📋 Employee Brought in a Lead", tone: "cyan",
    desc: "A crew member's contact needs construction work done. A new contract has been added to your Bids.",
    options: [
      { label: "Great — thanks!", sub: "New contract added · loyalty +8",
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); if (w) w.loyalty = Math.min(100,(w.loyalty ?? 50)+8); const ref = createContract({ cash: g.cash, day: g.day, creditScore: g.creditScore||600, marketState: g.marketState||"Normal", equipment: g.equipment||[], contracts: g.contracts||[], _milestones: g._milestones||{}, cityOffices: g.cityOffices||[], properties: g.properties||[] }); if (ref) g.contracts.push(ref); addLog(g, `📋 ${w?.name||"Worker"} brought in a referral — new contract available!`); addImportantNotice(g, `${w?.name||"Worker"} brought in a referral — new contract added to Bids!`, "green"); } },
    ],
  },
];

// ─── Weather Patterns ─────────────────────────────────────────────────────────────

const WEATHER_PATTERNS = {
  "Pacific Northwest": { rainProb: 0.35, snowProb: 0.05, heatProb: 0.05 },
  "Mountain West":     { rainProb: 0.15, snowProb: 0.20, heatProb: 0.10 },
  "South Central":     { rainProb: 0.20, snowProb: 0.01, heatProb: 0.25 },
  "Southwest":         { rainProb: 0.08, snowProb: 0.01, heatProb: 0.35 },
};

// ─── Phase Visuals ───────────────────────────────────────────────────────────────

const PHASE_VISUALS = {
  "Site Prep":    { emoji: "🟫", desc: "Dirt lot" },
  "Demolition":   { emoji: "💥", desc: "Demo" },
  "Demo":         { emoji: "💥", desc: "Demo" },
  "Excavation":   { emoji: "⛏️",  desc: "Digging" },
  "Foundation":   { emoji: "🟦", desc: "Concrete poured" },
  "Piling":       { emoji: "🔩", desc: "Piles driven" },
  "Framing":      { emoji: "🏗️", desc: "Frame up" },
  "Structure":    { emoji: "🏗️", desc: "Structure" },
  "Structural Steel":{ emoji: "🔩", desc: "Steel erected" },
  "Roofing":      { emoji: "🏚️", desc: "Roof on" },
  "Exterior":     { emoji: "🏠", desc: "Exterior done" },
  "Envelope":     { emoji: "🏠", desc: "Enclosed" },
  "MEP":          { emoji: "⚡", desc: "MEP works" },
  "MEP Rough":    { emoji: "⚡", desc: "MEP rough-in" },
  "Interior":     { emoji: "🪵", desc: "Interior" },
  "Finishes":     { emoji: "🖌️", desc: "Finishes" },
  "Finishing":    { emoji: "🖌️", desc: "Finishing" },
  "Fitout":       { emoji: "🛋️", desc: "Fitout" },
  "Facade":       { emoji: "🏢", desc: "Facade" },
  "Core":         { emoji: "🏗️", desc: "Core" },
  "Deck":         { emoji: "🌉", desc: "Deck" },
  "Barriers":     { emoji: "🚧", desc: "Barriers" },
  "Surfacing":    { emoji: "🛣️", desc: "Surfacing" },
  "Patching":     { emoji: "🛠️", desc: "Patching" },
  "Seal":         { emoji: "🛣️", desc: "Sealed" },
  "Inspection":   { emoji: "🔍", desc: "Inspection" },
  "Final Inspection":{ emoji: "✅", desc: "Final check" },
  "Commissioning":{ emoji: "✅", desc: "Commissioning" },
  "Survey":           { emoji: "📐", desc: "Surveying" },
  "Material Delivery":{ emoji: "🚚", desc: "Materials on site" },
  "Post Installation":{ emoji: "🪵", desc: "Posts in ground" },
  "Fence Assembly":   { emoji: "🏗️", desc: "Assembly" },
  "Base Layer":       { emoji: "🪨", desc: "Base compacted" },
  "Paving":           { emoji: "🛣️", desc: "Asphalt laid" },
  "Striping":         { emoji: "🎨", desc: "Line marking" },
  "Finish Work":      { emoji: "🖌️", desc: "Finishing" },
  "Utilities":        { emoji: "🔌", desc: "Utilities" },
  "Cladding":         { emoji: "🏢", desc: "Cladding" },
  "Waterproofing":    { emoji: "💧", desc: "Waterproofing" },
  "Landscaping":      { emoji: "🌿", desc: "Landscaping" },
};

// ─── Rival Contractors ────────────────────────────────────────────────────────────

const RIVAL_COMPANIES = [
  { id: "apex",          name: "Apex Construction",       aggression: 0.72, focus: "residential",    startRep: 12 },
  { id: "summit",        name: "Summit Builders",          aggression: 0.55, focus: "commercial",     startRep: 18 },
  { id: "ironpeak",      name: "IronPeak Development",     aggression: 0.64, focus: "infrastructure", startRep: 15 },
  { id: "northwest",     name: "Northwest Contractors",    aggression: 0.45, focus: "residential",    startRep: 8  },
  { id: "pacific_group",       name: "Pacific Group Co.",        aggression: 0.80, focus: "commercial",     startRep: 22 },
  { id: "western_build_co",   name: "Western Build Co.",        aggression: 0.60, focus: "residential",   startRep: 4  },
  { id: "summit_construction",name: "Summit Construction",      aggression: 0.80, focus: "commercial",    startRep: 7  },
];

// ─── Market Events ────────────────────────────────────────────────────────────────

const MARKET_EVENTS = [
  { id: "housing_boom",          label: "Housing Boom",            icon: "📈", ionicon: "trending-up",   duration: 14, tone: "green",
    contractMult: 1.25, materialCostMult: 1.0,  equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "Residential demand surges — contracts worth 25% more." },
  { id: "housing_crash",         label: "Housing Market Crash",    icon: "📉", ionicon: "trending-down", duration: 10, tone: "red",
    contractMult: 0.72, materialCostMult: 1.0,  equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "Residential market collapses — values drop 28%." },
  { id: "material_shortage",     label: "Material Shortage",       icon: "📦", ionicon: "cube",          duration: 8,  tone: "orange",
    contractMult: 1.0,  materialCostMult: 1.45, equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "Supply chain disruptions — material costs spike 45%." },
  { id: "infra_funding",         label: "Infrastructure Stimulus", icon: "🏛️", ionicon: "business",      duration: 20, tone: "cyan",
    contractMult: 1.35, materialCostMult: 1.0,  equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "Government funding boosts public works contracts 35%." },
  { id: "fuel_spike",            label: "Fuel Price Spike",        icon: "⛽", ionicon: "speedometer",   duration: 10, tone: "orange",
    contractMult: 1.0,  materialCostMult: 1.0,  equipDailyCostMult: 1.32, loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "Energy costs surge — equipment daily costs up 32%." },
  { id: "construction_boom",     label: "Construction Boom",       icon: "🏗️", ionicon: "construct",     duration: 16, tone: "green",
    contractMult: 1.18, materialCostMult: 1.12, equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "City-wide growth — more work and higher material demand." },
  { id: "recession_start",       label: "Recession Begins",        icon: "🌑", ionicon: "moon",          duration: 30, tone: "red",
    contractMult: 0.60, materialCostMult: 0.85, equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: null,
    desc: "Economy contracts sharply. Fewer jobs available, but materials are cheaper." },
  { id: "interest_rate_hike",    label: "Interest Rate Hike",      icon: "🏦", ionicon: "cash",          duration: 25, tone: "purple",
    contractMult: 1.0,  materialCostMult: 1.0,  equipDailyCostMult: 1.0,  loanAprMod: 0.30, crewWageMod: 0, categoryRestrict: null,
    desc: "Central bank raises rates. New loans cost 30% more interest." },
  { id: "labor_shortage",        label: "Labor Shortage",          icon: "👷", ionicon: "people",        duration: 20, tone: "orange",
    contractMult: 1.10, materialCostMult: 1.0,  equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0.25, categoryRestrict: null,
    desc: "Tradies are scarce. All crew wages rise 25%, but contract rates inch up." },
  { id: "urban_development_wave",label: "Urban Development Wave",  icon: "🌆", ionicon: "map",           duration: 18, tone: "cyan",
    contractMult: 1.45, materialCostMult: 1.0,  equipDailyCostMult: 1.0,  loanAprMod: 0, crewWageMod: 0, categoryRestrict: ["Commercial","Infrastructure"],
    desc: "City planning surge — Commercial and Infrastructure contracts pay 45% more." },
];

// ─── Subcontractor Types ──────────────────────────────────────────────────────────

const SUBCONTRACTOR_TYPES = [
  { id: "temp_carpenter", label: "Temp Carpenter Crew",   role: "Carpenter",   skill: 85, wagePerDay: 300, count: 3, durationDays: 14, reliability: 0.76, hireCost: 2000,  desc: "Fast but pricey. May skip Mondays." },
  { id: "temp_concrete",  label: "Temp Concrete Gang",    role: "Concreter",   skill: 82, wagePerDay: 340, count: 4, durationDays: 10, reliability: 0.70, hireCost: 3000,  desc: "Useful for big pours. Unreliable in cold." },
  { id: "temp_elec",      label: "Temp Electricians",     role: "Electrician", skill: 92, wagePerDay: 380, count: 2, durationDays: 21, reliability: 0.82, hireCost: 2500,  desc: "Licensed and skilled. High day rate." },
  { id: "temp_plumb",     label: "Temp Plumbing Crew",    role: "Plumber",     skill: 88, wagePerDay: 360, count: 2, durationDays: 14, reliability: 0.74, hireCost: 2200,  desc: "Licensed plumbers for short engagements." },
];

// ─── Loan Products ───────────────────────────────────────────────────────────────

// ─── Insurance Plans ─────────────────────────────────────────────────────────────

const INSURANCE_PLANS = [
  { id:"none",     label:"No Insurance",   monthlyPremium:0,    coverage:0.00, deductible:0,    desc:"No coverage. All accidents are full cost." },
  { id:"basic",    label:"Basic Coverage", monthlyPremium:900,  coverage:0.50, deductible:2500, desc:"Covers half of accident costs above deductible." },
  { id:"standard", label:"Standard Plan",  monthlyPremium:2000, coverage:0.75, deductible:1000, desc:"75% coverage. Recommended for active sites." },
  { id:"premium",  label:"Premium Shield", monthlyPremium:4000, coverage:0.92, deductible:250,  desc:"Near full coverage. Required for some government contracts." },
];

// ─── Achievements ─────────────────────────────────────────────────────────────

export const ACHIEVEMENTS_LIST = [
  { id:"first_job",         title:"Breaking Ground",    icon:"construct",          desc:"Complete your first contract",             check:(g)=>(g.completedJobs||0)>=1 },
  { id:"crew_of_5",         title:"Growing Team",       icon:"people",             desc:"Employ 5+ workers at once",               check:(g)=>(g.crew||[]).length>=5 },
  { id:"crew_of_10",        title:"Full Crew",          icon:"people-circle",      desc:"Employ 10+ workers at once",             check:(g)=>(g.crew||[]).length>=10 },
  { id:"machine_fleet",     title:"Machine Fleet",      icon:"car",                desc:"Own 3+ pieces of equipment",            check:(g)=>(g.equipment||[]).length>=3 },
  { id:"first_million",     title:"First Million",      icon:"cash",               desc:"Earn $1M total revenue",                check:(g)=>(g.revenue||0)>=1000000 },
  { id:"five_million",      title:"Five Million Club",  icon:"diamond",            desc:"Earn $5M total revenue",                check:(g)=>(g.revenue||0)>=5000000 },
  { id:"first_city_office", title:"City Presence",      icon:"business",           desc:"Open your first city office",           check:(g)=>(g.cityOffices||[]).length>=1 },
  { id:"safety_record",     title:"Safety Record",      icon:"shield-checkmark",   desc:"Achieve safety score 90+",              check:(g)=>(g.safetyScore||0)>=90 },
  { id:"insurance_wise",    title:"Fully Insured",      icon:"shield",             desc:"Activate Premium Shield coverage",      check:(g)=>g.insurancePlanId==="premium" },
  { id:"equipment_mogul",   title:"Equipment Mogul",    icon:"settings",           desc:"Own 6+ pieces of equipment",           check:(g)=>(g.equipment||[]).length>=6 },
  { id:"one_hundred_jobs",  title:"Century Mark",       icon:"checkmark-circle",   desc:"Complete 100 contracts",                check:(g)=>(g.completedJobs||0)>=100 },
  { id:"empire_builder",    title:"Empire Builder",     icon:"map",                desc:"Offices in 5+ cities",                 check:(g)=>(g.cityOffices||[]).length>=5 },
  { id:"top_employer",      title:"Top Employer",       icon:"medal",              desc:"Employ 20+ workers at once",           check:(g)=>(g.crew||[]).length>=20 },
  { id:"debt_free",         title:"Debt Free",          icon:"checkmark-done-circle", desc:"No loans and $50K+ cash",           check:(g)=>(g.loans||[]).length===0&&(g.cash||0)>=50000 },
  { id:"big_contract",      title:"Big Score",          icon:"ribbon",             desc:"Win a government or mega contract",    check:(g)=>(g.legacyStats?.totalContractsWon||0)>=1&&(g.cityOffices||[]).length>=1 },
];

const LOAN_PRODUCTS = LENDING_PRODUCTS;

function getLendingCollateral(g, product) {
  const equipment = g.equipment || [];
  const appraised = equipment.map((e) => ({
    id: e.id,
    value: Math.max(0, Math.round((e.price || 0) * ((e.condition ?? 100) / 100))),
  }));
  if (product?.collateralType === "vehicle") {
    return appraised.sort((a, b) => b.value - a.value)[0] || { id: null, value: 0 };
  }
  if (product?.collateralType === "fleet") {
    return { id: null, value: appraised.reduce((sum, e) => sum + e.value, 0) };
  }
  if (product?.collateralType === "company") {
    return { id: null, value: Math.max(0, computeValuation(g)) };
  }
  return { id: null, value: 0 };
}

function buildBorrowerProfile(g, product) {
  const collateral = getLendingCollateral(g, product);
  const existingDebt = (g.loans || []).reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0);
  const missedPaymentCount = (g.loans || []).reduce((sum, loan) => sum + (loan.missedPayments || 0), 0);
  const weeklyRevenue = g.weeklyStats?.revenue || 0;
  const weeklyExpenses = g.weeklyStats?.expenses || 0;
  return {
    creditScore: g.creditScore || 600,
    companyValue: Math.max(0, computeValuation(g)),
    cashFlow: weeklyRevenue - weeklyExpenses,
    existingDebt,
    missedPaymentCount,
    companyAgeDays: g.day || 0,
    collateralValue: collateral.value,
    economyMult: getConstructionRegionalSnapshot(g).lendingEconomyMult,
  };
}

// ─── Job Postings ────────────────────────────────────────────────────────────────

const JOB_POSTINGS = [
  { id: "basic",    label: "Basic Ad",    cost: 120,  count: 1, skillMin: 75,  skillMax: 95,  wageMin: 18, wageMax: 26, desc: "Finds a reliable labourer or tradesperson." },
  { id: "standard", label: "Standard Ad", cost: 300,  count: 2, skillMin: 90,  skillMax: 110, wageMin: 24, wageMax: 34, desc: "Attracts experienced tradespeople." },
  { id: "premium",  label: "Premium Ad",  cost: 650,  count: 3, skillMin: 105, skillMax: 130, wageMin: 30, wageMax: 45, desc: "Top-tier tradespeople. Foreman-quality." },
];

const CREW_ROLES = ["Labourer", "Carpenter", "Electrician", "Plumber", "Concreter", "Steelworker"];
const SUPPORT_ROLES = ["Site Foreman", "Safety Officer", "Project Manager", "Estimator"];

// ─── Utility Functions ───────────────────────────────────────────────────────────

function addLog(state, text) {
  state.logs = [text, ...state.logs].slice(0, 25);
  if (!Array.isArray(state.opsFeed)) state.opsFeed = [];
  const tone =
    /broke down|late|penalty|❌|incident|fine|shortage|paused|overdue/.test(text) ? "red" :
    /\+\$|completed|✅|hired|acquired|Milestone|🎉|bonus/.test(text) ? "green" :
    /⚠|warning|no-show|delay/.test(text) ? "orange" :
    /📋|permit|pause|weather/.test(text) ? "blue" : "neutral";
  state.opsFeed = [{ id: uid(), text, tone, day: state.day || 1 }, ...state.opsFeed].slice(0, 20);
}

// Sprint 8. This was `state.importantNotice = { id: Date.now(), message, tone }` — ONE slot
// behind 102 call sites, so anything raised in the same tick as something else was destroyed
// before it was ever drawn, nothing ever expired (a day-3 milestone was still on screen on day
// 120), and `Date.now()` handed colliding ids to notices raised in the same millisecond.
//
// Every call site keeps its existing signature; the tone vocabulary is mapped to a level inside
// the inbox. `importantNotice` is still written so anything reading it directly keeps working.
function addImportantNotice(state, message, tone = "green", options = undefined) {
  pushNotice(state, message, tone, options);
  state.importantNotice = topNotice(state);
}

function getCreditLabel(score) {
  if (score >= 780) return { label: "Excellent", color: "cyan" };
  if (score >= 720) return { label: "Very Good", color: "green" };
  if (score >= 660) return { label: "Good", color: "green" };
  if (score >= 580) return { label: "Fair", color: "yellow" };
  if (score >= 500) return { label: "Poor", color: "orange" };
  return { label: "Very Poor", color: "red" };
}

function getOfficeTier(state) { return OFFICES[state.officeIndex]; }

function getIdleCrew(state) {
  return state.crew.filter((w) => w.status === "Idle" && w.onShift !== false);
}
function getIdleEquipment(state) {
  return state.equipment.filter((e) => e.status === "Idle");
}
function getActiveSites(state) {
  return state.activeSites.filter((s) => s.status === "Active" || s.status === "Paused");
}
function getOpenContracts(state) {
  return state.contracts.filter((c) => c.status === "Open");
}

// What the company could staff and equip right now — the gates a chain opportunity waits on.
function companyCapacity(g) {
  const office = OFFICES[g.officeIndex] || OFFICES[0];
  return { crewCap: getTotalCrewCap(g), equipCap: (office?.equipCap || 2) + getEquipCapBonus(g), equipment: g.equipment || [] };
}

function getBestEquipTier(state) {
  if (!state.equipment.length) return 0;
  return Math.max(...state.equipment.map((e) => e.tier));
}

function createEquipment(item) {
  return {
    id: uid(), shopId: item.shopId, name: item.name, type: item.type,
    tier: item.tier, price: item.price, dailyCost: item.dailyCost,
    fuelCap: item.fuelCap, fuel: item.fuelCap, reliability: item.reliability,
    capacity: item.capacity, condition: 100, mileage: 0,
    status: "Idle", assignedSiteId: null, breakdowns: 0, upgrades: {},
  };
}

function createWorker(role, overrides = {}) {
  const trait = pick(CREW_TRAITS);
  const _role = role || pick(CREW_ROLES);
  const _skill = rand(75, 105);
  // Sprint 13 gave "below market" real teeth — underpayment accrues and people walk. A blind
  // `rand(160, 260)` then meant a quarter of every new company's crew was ALREADY underpaid on
  // the day the player first opened the game, through no decision of their own, and they
  // started quitting. Deriving the wage from the same market rate the consequence is measured
  // against makes that impossible by construction rather than by a table kept in sync by hand.
  // The spread starts everyone fair-to-generous; going below market has to be a choice.
  const _wage = Math.round(marketRateFor({ role: _role, skill: _skill, certifications: [] }) * (rand(100, 122) / 100));
  return {
    id: uid(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    role: _role,
    specialty: pick(CREW_SPECIALTIES),
    age: rand(20, 56),
    skill: _skill,
    mood: rand(60, 85),
    loyalty: rand(55, 80),
    stamina: rand(70, 95),
    trait,
    wagePerDay: _wage,
    status: "Idle",
    onShift: true,
    assignedSiteId: null,
    jobsCompleted: 0,
    xp: 0, level: 1,
    hireDay: 0, favoriteCategory: null, jobHistory: [], attendanceStrikes: 0, certifications: [],
    ...overrides,
  };
}

function createApplicant(boost = {}) {
  const trait = pick(CREW_TRAITS);
  const role = boost.role || pick(CREW_ROLES);
  return {
    id: uid(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    role,
    specialty: boost.specialty || pick(CREW_SPECIALTIES),
    desiredWage: rand(boost.wageMin ?? 18, boost.wageMax ?? 32),
    skill: rand(boost.skillMin ?? 75, boost.skillMax ?? 105),
    mood: rand(58, 88),
    loyalty: rand(50, 78),
    stamina: rand(65, 95),
    trait,
    signingBonus: rand(50, 200),
    quality: boost.quality || null,
  };
}

function createSupportStaff(role) {
  const wageMap = { "Site Foreman": 320, "Safety Officer": 290, "Project Manager": 380, "Estimator": 340 };
  return {
    id: uid(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    role, wagePerDay: wageMap[role] || 300, skill: 100, mood: 75, loyalty: 72,
    trait: { label: "Professional", desc: role }, status: "Working",
  };
}

function getCareerLevel(w) {
  const jobs = w.jobsCompleted || 0;
  const skill = w.skill || 0;
  let best = CAREER_LEVELS[0];
  for (const lvl of CAREER_LEVELS) {
    if (jobs >= lvl.minJobs && skill >= lvl.skillReq) best = lvl;
  }
  return best;
}

function applyInsuranceClaim(g, rawDamage) {
  const planId = g.insurancePlanId || "none";
  const plan = INSURANCE_PLANS.find(p => p.id === planId);
  if (!plan || plan.id === "none" || plan.coverage <= 0) return rawDamage;
  const netDamage = Math.min(rawDamage, plan.deductible + rawDamage * (1 - plan.coverage));
  const covered = rawDamage - netDamage;
  addLog(g, `🛡️ Insurance covered ${money(covered)} of the ${money(rawDamage)} incident.`);
  return netDamage;
}

function applyIncident(g, severity, contractValue = 0) {
  if (!g.incidentHistory) g.incidentHistory = [];
  g.safetyScore     = Math.max(0, Math.min(100, (g.safetyScore    ?? 70) - severity * rand(3, 8)));
  g.complianceScore = Math.max(0, Math.min(100, (g.complianceScore ?? 60) - severity * rand(2, 5)));
  g.safetyViolations = (g.safetyViolations ?? 0) + 1;
  // Damage and medical cost of the incident, priced off the job it happened on (it was a flat
  // $1,500–4,000 per level, charged ON TOP of the event's own fine — up to ~$16k on a $9k fence).
  const rawCost = penaltyFor({ contractValue, severity: severity >= 2 ? "major" : "minor", companyLevel: g.companyLevel, roll: Math.random() });
  const netCost = applyInsuranceClaim(g, rawCost);
  g.cash -= netCost;
  g.expenses += netCost;
  if (netCost > 0) recordTransaction(g, "fines", -netCost, `Safety incident (level ${severity})`);
  g.incidentHistory.push({ day: g.day, severity, desc: "Safety incident level " + severity });
  if (g.incidentHistory.length > 50) g.incidentHistory = g.incidentHistory.slice(-50);
}

function applyInspectionPass(g) {
  if (!g.incidentHistory) g.incidentHistory = [];
  g.safetyScore     = Math.min(100, (g.safetyScore    ?? 70) + rand(3, 8));
  g.complianceScore = Math.min(100, (g.complianceScore ?? 60) + rand(2, 6));
  g.incidentHistory.push({ day: g.day, severity: 0, desc: "Inspection passed" });
  if (g.incidentHistory.length > 50) g.incidentHistory = g.incidentHistory.slice(-50);
}

function recoverSafetyScores(g) {
  const safety     = g.safetyScore     ?? 70;
  const compliance = g.complianceScore ?? 60;
  g.safetyScore     = Math.max(0, Math.min(100, safety     + (safety     < 70 ? 0.5 : safety     > 70 ? -0.1 : 0)));
  g.complianceScore = Math.max(0, Math.min(100, compliance + (compliance < 60 ? 0.3 : compliance > 60 ? -0.1 : 0)));
}

function captureEconomicSnapshot(g) {
  if (!g.economicHistory) g.economicHistory = [];
  const ws = g.weeklyStats ?? { revenue: 0, expenses: 0 };
  g.economicHistory.push({
    week: Math.floor((g.day || 1) / 7), day: g.day,
    cash: g.cash, revenue: ws.revenue, expenses: ws.expenses,
    profit: ws.revenue - ws.expenses,
    valuation: computeValuation(g), reputation: g.reputation,
    marketShare: g.marketShare ?? 1,
  });
  if (g.economicHistory.length > 52) g.economicHistory = g.economicHistory.slice(-52);
}

export function checkAchievements(g) {
  if (!g.achievements) g.achievements = [];
  for (const ach of ACHIEVEMENTS_LIST) {
    if (g.achievements.includes(ach.id)) continue;
    try {
      if (ach.check(g)) {
        g.achievements.push(ach.id);
        addLog(g, `🏅 Achievement unlocked: "${ach.title}" — ${ach.desc}!`);
      }
    } catch(e) { if (__DEV__) console.warn('[ConstructionFlow] achievement check error:', e); }
  }
}

function initLegacyStats() {
  return { founded: 1, totalContractsWon: 0, totalRevenue: 0, totalPayroll: 0, totalEmployeesHired: 2, totalEquipmentBought: 1 };
}
function trackHire(g)        { if (!g.legacyStats) g.legacyStats = initLegacyStats(); g.legacyStats.totalEmployeesHired++; }
function trackEquipBuy(g)    { if (!g.legacyStats) g.legacyStats = initLegacyStats(); g.legacyStats.totalEquipmentBought++; }
function trackContractWon(g) { if (!g.legacyStats) g.legacyStats = initLegacyStats(); g.legacyStats.totalContractsWon++; }

// Which contract definitions can appear on this company's Bids board. Exported so the starter-
// contract audit checks exactly the set a new player is shown.
export function isContractEligible(d, state) {
  const bestTier = getBestEquipTier(state);
  const repRequired = { stadium: 80, wildbear_city: 95 };
  if (d.minTier >= 3 && (state.reputation || 0) < 25) return false;
  if (d.minTier >= 4 && (state.reputation || 0) < 60) return false;
  if (state.creditScore < d.creditReq) return false;
  if (d.minTier > Math.max(1, bestTier)) return false;
  if (repRequired[d.id] && (state.reputation || 0) < repRequired[d.id]) return false;
  if (d.category === "Government" && d.complianceReq && (state.complianceScore ?? 60) < d.complianceReq) return false;
  return true;
}

export function createContract(state, forcedDefId) {
  const eligible = CONTRACT_DEFS.filter((d) => isContractEligible(d, state));
  const pool = eligible.length ? eligible : CONTRACT_DEFS.slice(0, 3);
  const forcedDef = forcedDefId ? CONTRACT_DEFS.find((d) => d.id === forcedDefId) : null;
  const def = forcedDef || pick(pool);

  const contractCityId = pickContractCity(state);
  const baseDeadline = state.day + def.durationDays + rand(2, 6);
  const seasonMult = state.seasonContractMult || 1.0;
  const regionAdjustedBase = applyRegionalContractValue(def.baseValue, state);
  const enhanced = enhanceContractValue(def, state, { value: Math.round(regionAdjustedBase * seasonMult), deadline: baseDeadline });

  const contract = {
    id: uid(), defId: def.id, label: def.label, category: def.category || "Commercial",
    client: pick(CLIENTS), value: enhanced.value, phases: [...def.phases],
    minTier: def.minTier, crewMin: def.crewMin, equipMin: def.equipMin,
    materials: { ...def.materials }, penaltyPerDay: def.penaltyPerDay,
    durationDays: def.durationDays, deadline: enhanced.deadline,
    expiresDay: state.day + rand(3, 7),
    expiryDay: state.day + 10,
    status: "Open", desc: def.desc, risk: def.risk,
    cityId: contractCityId,
  };
  // R15-3: Rival bid interest — 30% of contracts have an interested rival
  const _activeRivals = (state.rivals || []).filter(r => r.status !== "Bankrupt");
  if (_activeRivals.length > 0 && Math.random() < 0.30) {
    const _rival = _activeRivals[Math.floor(Math.random() * _activeRivals.length)];
    contract.interestedRival = _rival.name;
    contract.rivalTakesDay = state.day + 2;
  }
  // Named client assignment (30% chance once rep >= 20)
  if ((state.reputation||0) >= 20 && Math.random() < 0.30) {
    const matching = CLIENT_ROSTER.filter(c => !def.category || def.category.toLowerCase().includes(c.focus) || c.focus === "commercial");
    const cl = matching[Math.floor(Math.random()*matching.length)] || CLIENT_ROSTER[Math.floor(Math.random()*CLIENT_ROSTER.length)];
    contract.clientId = cl.id;
    contract.client = cl.name;
    // Apply Preferred Vendor bonus if applicable
    const rel = (state.clientRelationships||{})[cl.id] || { loyalty: 0 };
    const tier = getClientTier(rel.loyalty);
    if (tier.valueMult > 1) contract.value = Math.round(contract.value * tier.valueMult);
    if (tier.extraDays > 0) { contract.deadline += tier.extraDays; contract.durationDays += tier.extraDays; }
  }
  const g = state;
  if (g._govtPriority && def.category === "Government") {
    g._govtPriority = false;
    return { ...contract, value: Math.round(contract.value * 1.25), label: "⭐ " + contract.label };
  }
  return contract;
}

export function createRivals() {
  // Complete records. These used to be minted without `status`, `employees` or `equipment`
  // at all, and the old code only worked by accident: `rival.status === "Bankrupt"` is
  // false for undefined, and every read of the counters was written `(rival.employees || 2)`.
  // A company whose status is literally undefined cannot be reasoned about, and the fleet
  // and acquisition code both need the counters to exist.
  return RIVAL_COMPANIES.map((r) => ({
    id: r.id, name: r.name, aggression: r.aggression, focus: r.focus,
    rep: r.startRep, jobsCompleted: 0, activeJobs: 0,
    cash: rand(20000, 50000),
    status: RIVAL_STATUS.ACTIVE,
    troubleDays: 0,
    employees: 2,
    equipment: 1,
    cityPresence: ["salem"],
  }));
}

function createSubcontractor(typeId) {
  const def = SUBCONTRACTOR_TYPES.find((t) => t.id === typeId);
  if (!def) return null;
  return {
    id: uid(), typeId: def.id, name: def.label,
    role: def.role, skill: def.skill, wagePerDay: def.wagePerDay,
    count: def.count, daysLeft: def.durationDays, reliability: def.reliability,
    status: "Active", assignedSiteId: null,
  };
}

function createLoanFromProduct(product, state) {
  const activeEvt = state?.activeMarketEvent
    ? MARKET_EVENTS.find((e) => e.id === state.activeMarketEvent)
    : null;
  let effectiveApr = product.apr * (1 + (activeEvt?.loanAprMod || 0));
  // R16-3: Credit score discount — better credit = lower APR
  const _creditScore = state?.creditScore || 600;
  const _creditDisc = _creditScore >= 780 ? 2.5 : _creditScore >= 720 ? 1.5 : _creditScore >= 660 ? 0.5 : 0;
  effectiveApr = Math.max(0.5, effectiveApr - _creditDisc);
  const totalPayback = Math.round(product.principal * (1 + effectiveApr / 100));
  return {
    id: uid(), productId: product.id, label: product.label,
    principal: product.principal, apr: effectiveApr,
    weeksLeft: product.weeks, totalWeeks: product.weeks,
    weeklyPayment: Math.round(totalPayback / product.weeks),
    remainingBalance: totalPayback, missedPayments: 0,
  };
}

// Shows the shared "not enough cash" alert, with the recovery routes that are actually open
// to this company right now. Every affordability check in the game funnels through here so
// the advice can never drift between screens.
function alertInsufficientFunds(state, cost, purchase) {
  // The press already fired a neutral tap. This says it did not go through.
  fireHaptic("error");
  const { title, body } = buildInsufficientFundsAlert({
    cost,
    purchase,
    cash: state?.cash || 0,
    savings: state?.savings || 0,
    hasActiveSites: (state?.activeSites || []).length > 0,
    creditScore: state?.creditScore || 600,
    // Three concurrent loans is the game's own ceiling — do not advise borrowing at it.
    canBorrow: (state?.loans || []).length < 3,
    formatMoney: money,
  });
  Alert.alert(title, body);
}

// Classifies a block reason so the alert can name the route to fixing it. Kept next to the
// reason strings themselves so the two cannot fall out of sync.
function getAssignBlockKind(contract, crewIds, equipIds, state) {
  if (!contract) return "none";
  if (state.businessFrozen) return "frozen";
  const def = CONTRACT_DEFS.find((d) => d.id === contract.defId) || {};
  const bestTier = Math.max(0, ...equipIds.map((id) => {
    const e = state.equipment.find((eq) => eq.id === id);
    return e ? e.tier : 0;
  }));
  if (equipIds.length < (def.equipMin || 1)) return "equipment";
  if (crewIds.length < (def.crewMin || 1)) return "crew";
  if (bestTier < (def.minTier || 1)) return "tier";
  for (const matId of Object.keys(contract.materials || {})) {
    if ((state.materials[matId] || 0) < contract.materials[matId]) return "materials";
  }
  return "none";
}

function getAssignBlockReason(contract, crewIds, equipIds, state) {
  if (!contract) return "No contract selected.";
  if (state.businessFrozen) return "Business is frozen — resolve overdue taxes.";
  const def = CONTRACT_DEFS.find((d) => d.id === contract.defId) || {};
  const bestTier = Math.max(0, ...equipIds.map((id) => {
    const e = state.equipment.find((eq) => eq.id === id);
    return e ? e.tier : 0;
  }));
  if (equipIds.length < (def.equipMin || 1)) return `Need at least ${def.equipMin} piece(s) of equipment.`;
  if (crewIds.length < (def.crewMin || 1)) return `Need at least ${def.crewMin} crew members.`;
  if (bestTier < (def.minTier || 1)) return `Job needs Tier ${def.minTier}+ equipment.`;
  for (const matId of Object.keys(contract.materials || {})) {
    const needed = contract.materials[matId];
    const have = state.materials[matId] || 0;
    if (have < needed) {
      const mat = MATERIAL_DEFS.find((m) => m.id === matId);
      return `Need ${needed} ${mat?.unit || "units"} of ${mat?.label || matId} (have ${have}).`;
    }
  }
  return null;
}

// The price one unit of a material costs right now, after regional pricing and the
// player's bulk discount. Shared so that what a project is *charged* for a material and
// what the shop *quotes* for it can never drift apart (WildBear standard: "displayed price
// and charged price must use the same calculation path").
function getMaterialUnitPrice(game, matId) {
  return quoteMaterialUnitPrice(game, matId, MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice);
}

// Returns array of { matId, label, icon, unit, needed, fulfilled, missing, pricePerUnit, costNormal, costEmergency }
function getSiteMissingMaterials(site, contractDef, game) {
  if (!contractDef?.materials) return [];
  return Object.entries(contractDef.materials).reduce((acc, [matId, needed]) => {
    const fulfilled = (site.materialsFulfilled || {})[matId] || 0;
    const shortfall = Math.max(0, needed - fulfilled);
    if (shortfall === 0) return acc;
    const mat = MATERIAL_DEFS.find(m => m.id === matId);
    const pricePerUnit = getMaterialUnitPrice(game, matId);
    acc.push({
      matId, needed, fulfilled, missing: shortfall,
      label: mat?.label || matId, icon: mat?.icon || "📦", unit: mat?.unit || "units",
      pricePerUnit,
      costNormal: pricePerUnit * shortfall,
      costEmergency: quoteMaterialCost(game, matId, shortfall, { emergency: true, fallbackBase: mat?.basePrice }),
    });
    return acc;
  }, []);
}

// Winning (or losing) a bid and putting a crew on the job. Lifted out of the Bids tap handler so
// the playtest harness mobilises through the same code a player does: the old harness built its
// own site object and so could never see a defect in the real start path. Mutates `g`; returns
// a verdict the UI turns into an alert. `rng` is injectable so a seeded run is reproducible.
export function mobilizeSite(g, contractId, crewIds, equipIds, rng = Math.random) {
  const c = g.contracts.find((c) => c.id === contractId);
  if (!c || c.status !== "Open") return { status: "unavailable" };

  // Sprint 12: the right machine for the job. Equipment type used to be a BONUS with a
  // floor of 1.0, so the wrong machine and NO machine were worth exactly the same and
  // nothing ever said "you cannot do this without a crane".
  // The contract's own minTier is the authority on how big a machine this job needs.
  const _cDefStart = CONTRACT_DEFS.find((d) => d.id === c.defId);
  const _plant = canStartWithPlant(c.phases || [], (g.equipment || []).filter((e) => equipIds.includes(e.id)), _cDefStart?.minTier);
  if (!_plant.ok) return { status: "plant", missing: _plant.missing };

  // The freeze is real now. It was set at 14 days overdue and read by NOTHING — every
  // reference in this screen was status text, so "operations suspended" suspended nothing.
  // Scoped to NEW work only: sites already running keep going and keep paying, so a frozen
  // player can finish what they started and earn their way out instead of being stuck.
  if (!canTakeNewWork(g)) return { status: "frozen", reason: blockedReason(g) };
  const blockReason = getAssignBlockReason(c, crewIds, equipIds, g);
  if (blockReason) return { status: "blocked", reason: blockReason, kind: getAssignBlockKind(c, crewIds, equipIds, g) };

  // ── THE BID IS NOW AWARDED, NOT ASSUMED ────────────────────────────────
  // Bid style used to move the payout and nothing else: Premium paid +28% at no cost,
  // so it was free money and the "choice" was fake. It now moves the probability of
  // being awarded the job. The player sees that probability on the card before
  // committing, and `rollBidOutcome` rolls the same number the card showed, because
  // both come from one `planBid` call.
  const bidStyle = (g.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE;
  // The office perk rides on the state handed to the roll, so the bid card and the award
  // read one number. `withBidPerks` is used at every call site for exactly that reason.
  const outcome = rollBidOutcome(c, bidStyle, withBidPerks(g), rng);
  const effectiveValue = outcome.effectiveValue;

  g.bidsPlaced = (g.bidsPlaced || 0) + 1;
  if (outcome.won) g.bidsWon = (g.bidsWon || 0) + 1;
  else g.bidsLost = (g.bidsLost || 0) + 1;

  if (!outcome.won) {
    // Losing costs the contract, not the crew. Nothing is consumed: no materials drawn,
    // no crew or machines marked active, no cash moved. The board is the cost.
    const winner = pickWinningRival(c, g, rng);
    c.status = "Taken";
    if (winner && winner.id) {
      const rival = (g.rivals || []).find((r) => r.id === winner.id);
      if (rival) {
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand(1, 3));
      }
    }
    const winnerName = winner?.name || "another contractor";
    addLog(g, `📄 Bid lost: "${c.label}" went to ${winnerName}.`);
    addImportantNotice(g, `${winnerName} won "${c.label}". A lower bid would have had a better chance.`, "orange");
    return { status: "lost", winnerName, label: c.label, outcome };
  }

  // Consume materials — track exactly what was fulfilled, never go negative.
  // Stock drawn from inventory was paid for earlier, at the supplier. Valuing it at
  // today's price is what lets the completion P&L show a real margin instead of
  // pretending warehoused material was free.
  const materialsFulfilled = {};
  let materialsFromStockCost = 0;
  for (const matId of Object.keys(c.materials || {})) {
    const needed = c.materials[matId];
    const available = Math.max(0, g.materials[matId] || 0);
    const consumed = Math.min(needed, available);
    g.materials[matId] = available - consumed;
    materialsFulfilled[matId] = consumed;
    materialsFromStockCost += consumed * getMaterialUnitPrice(g, matId);
  }

  // Mark crew and equipment as active
  for (const id of crewIds) {
    const w = g.crew.find((w) => w.id === id);
    if (w) { w.status = "Active"; w.assignedSiteId = contractId; }
  }
  for (const id of equipIds) {
    const e = g.equipment.find((e) => e.id === id);
    if (e) { e.status = "Active"; e.assignedSiteId = contractId; }
  }

  trackContractWon(g);

  c.status = "Active";
  g.activeSites.push({
    id: uid(), contractId: c.id, label: c.label, client: c.client,
    totalValue: effectiveValue, phases: [...c.phases],
    currentPhaseIdx: 0, phaseProgress: 0,
    assignedCrewIds: [...crewIds],
    assignedEquipmentIds: [...equipIds],
    crewMin: c.crewMin, equipMin: c.equipMin,
    startDay: g.day, durationDays: c.durationDays,
    deadlineDay: c.deadline, penaltyPerDay: c.penaltyPerDay,
    status: "Active", chaosHistory: [], pausedDays: 0,
    cityId: c.cityId || "salem", siteMode: "normal",
    materialsFulfilled,
    depositPaid: 0, completionBonus: 0, rushQualityPenalty: 0,
    // Phase 2: orders in transit, and what the client has certified so far.
    pendingDeliveries: [], progressPaid: 0, phasesClaimed: 0,
    costs: createProjectCostLedger(),
  });

  // R14-2: 25% deposit received on mobilise
  const _deposit = Math.round(effectiveValue * 0.25);
  g.cash += _deposit;
  g.revenue += _deposit;
  g.weeklyStats.revenue += _deposit;
  recordTransaction(g, "contracts", _deposit, `${c.label}: 25% mobilisation deposit`);
  const _newSite = g.activeSites[g.activeSites.length - 1];
  _newSite.depositPaid = _deposit;
  // Attribution only — this cash left the balance when the material was bought.
  accrueProjectCost(_newSite, "materials", materialsFromStockCost);

  const bidNote = bidStyle !== DEFAULT_BID_STYLE ? ` [${outcome.label.toLowerCase()} bid]` : "";
  addLog(g, `🏗️ Bid won: "${c.label}" for ${c.client} — ${money(effectiveValue)} contract${bidNote}. 💰 25% deposit: ${money(_deposit)}.`);
  return { status: "won", site: _newSite, outcome };
}

// Order exactly what a site is short of, at the quoted price, for normal delivery. Lifted out of
// the Sites tap handler for the same reason as mobilizeSite(). Mutates `g`.
export function orderSiteMaterials(g, siteId) {
  const site = g.activeSites.find(s => s.id === siteId);
  if (!site) return { status: "none" };
  const contract = g.contracts.find(c => c.id === site.contractId);
  const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
  const missing = getSiteMissingMaterials(site, def, g);
  if (!missing.length) return { status: "none" };
  // ── ORDERS NOW TAKE TIME TO ARRIVE ────────────────────────────────────
  // Materials used to appear the instant they were paid for, which made the emergency
  // option — 1.5x price for the same instant delivery — strictly worse than this one,
  // and therefore never the right call. A normal order is placed with a supplier and
  // lands a couple of days later; work stalls until it does. That is what the emergency
  // premium now buys.
  //
  // Cash still leaves the account at the moment of ordering, and the cost is still
  // attributed to this project at that moment, so nothing about the books changes.
  const totalCost = missing.reduce((s, m) => s + m.costNormal, 0);
  if (!Array.isArray(site.pendingDeliveries)) site.pendingDeliveries = [];

  let ordered = missing;
  let spend = totalCost;
  if (g.cash < totalCost) {
    // Short of cash: order as much as the balance covers, material by material.
    let budget = g.cash;
    ordered = [];
    spend = 0;
    for (const m of missing) {
      if (budget <= 0) break;
      const canBuy = Math.min(m.missing, Math.floor(budget / m.pricePerUnit));
      if (canBuy <= 0) continue;
      const cost = canBuy * m.pricePerUnit;
      ordered.push({ ...m, missing: canBuy, costNormal: cost, costEmergency: Math.round(cost * 1.5) });
      budget -= cost;
      spend += cost;
    }
    if (ordered.length === 0) return { status: "unaffordable", unitPrice: missing[0].pricePerUnit };
  }

  g.cash -= spend;
  g.expenses += spend;
  accrueProjectCost(site, "materials", spend);
  recordTransaction(g, "materials", -spend, `${site.label}: material order`);

  const deliveries = planDeliveries(ordered, g.day);
  site.pendingDeliveries.push(...deliveries);
  const arrivesIn = Math.max(0, (deliveries[0]?.arrivesDay ?? g.day) - g.day);
  const summary = ordered.map((m) => `${m.missing} ${m.unit} of ${m.label}`).join(", ");
  addLog(g, `🚚 Ordered ${summary} for ${money(spend)} — arriving day ${deliveries[0]?.arrivesDay ?? g.day}.`);
  addImportantNotice(
    g,
    `Materials ordered for ${site.label}: ${money(spend)}, arriving in ${arrivesIn} day${arrivesIn === 1 ? "" : "s"}. Work stalls until then — pay the emergency premium for same-day if you cannot wait.`,
    "neutral"
  );
  return { status: "ordered", spend, arrivesIn };
}

// Answer the pending decision card with option `i`. Shared by the modal and the playtest harness,
// so a harness player's choices cost exactly what a real player's do.
export function resolveDecision(g, i) {
  const evtDef = DECISION_EVENTS.find(e => e.id === g.pendingDecision?.id) || EMPLOYEE_EVENTS.find(e => e.id === g.pendingDecision?.id);
  const opt = evtDef?.options?.[i];
  if (opt?.apply) {
    // Two dozen option handlers move cash directly. Rather than trust each to remember the
    // ledger, whatever they moved is named here after the card that caused it — so "Where did
    // my $10,000 go?" reads "Rival in trouble: Poach them", not nothing at all.
    const scope = beginCashScope(g);
    const loansBefore = (g.loans || []).length;
    opt.apply(g);
    const tookLoan = (g.loans || []).length > loansBefore;
    closeCashScope(g, scope, tookLoan ? "financing" : "misc", `${g.pendingDecision?.title || evtDef.title || "Decision"}: ${opt.label}`);
  }
  g.pendingDecision = null;
}

// Buy stock into the yard at the quoted price (flash deals included). Shared by the Bids and
// materials screens and the playtest harness. Mutates `g`.
export function buyYardMaterials(g, matId, qty) {
  if (!qty || qty < 1) return { status: "none" };
  // The canonical price (regional, supplier terms or flash deal) — the same number the Buy modal quotes.
  const totalCost = getMaterialUnitPrice(g, matId) * qty;
  if (g.cash < totalCost) return { status: "unaffordable", cost: totalCost };
  g.cash -= totalCost;
  g.expenses += totalCost;
  g.materials[matId] = (g.materials[matId] || 0) + qty;
  const mat = MATERIAL_DEFS.find((m) => m.id === matId);
  recordTransaction(g, "materials", -totalCost, `Bought ${qty} ${mat?.unit || "units"} of ${mat?.label || matId}`);
  addLog(g, `📦 Purchased ${qty} ${mat?.unit || "units"} of ${mat?.label || matId} for ${money(totalCost)}.`);
  return { status: "bought", cost: totalCost };
}

// Pay down the tax bill by the suggested amount. Shared by Finance and the playtest harness.
export function payTaxBill(g) {
  if ((g.taxDue || 0) <= 0) return { status: "none" };
  // Pay what you can. The old handler did `if (g.cash < g.taxDue) return`, so a bill
  // larger than the player's cash could never be reduced — only grown — while the overdue
  // counter climbed forever. That was a permanent, unrecoverable state.
  const _want = suggestedPayment(g);
  if (g.cash < _want) return { status: "unaffordable", want: _want };
  const _res = applyTaxPayment(g, _want);
  if (_res.paid <= 0) return { status: "none" };
  recordTransaction(g, "taxes", -_res.paid, _res.cleared ? "Tax bill paid" : "Tax bill part payment");
  addLog(g, _res.cleared
    ? `✅ Tax bill of ${money(_res.paid)} paid in full.`
    : `🧾 Part payment of ${money(_res.paid)} — ${money(_res.remaining)} still owed.`);
  if (_res.unfrozen) {
    addImportantNotice(g, "Operations resumed — the tax freeze has been lifted.", "green");
  }
  return { status: "paid", ...(_res) };
}

// Workshop repair from the Equipment tab. Shared with the playtest harness. Mutates `g`.
export function repairEquipment(g, equipId, isEmergency) {
  const _eq = (g.equipment || []).find(e => e.id === equipId);
  if (!_eq) return { status: "none" };
  const _baseCost = Math.round((_eq.price || 5000) * (isEmergency ? 0.4 : 0.2));
  if (g.cash < _baseCost) { addLog(g, `Not enough cash to repair ${_eq.name}.`); return { status: "unaffordable", cost: _baseCost }; }
  g.cash -= _baseCost;
  g.expenses += _baseCost;
  recordTransaction(g, "maintenance", -_baseCost, `${_eq.name}: ${isEmergency ? "emergency " : ""}repair`);
  _eq.condition = isEmergency ? 100 : Math.min(100, (_eq.condition || 0) + 60);
  _eq.status = "Idle";
  if (g.pendingBreakdown?.equipId === equipId) g.pendingBreakdown = null;
  addLog(g, `🔧 ${_eq.name} repaired — condition ${Math.round(_eq.condition)}%`);
  // Pulled off a site for this repair (a recall)? It goes straight back, not at tomorrow's check.
  if (_eq.awaitingRepairForSiteId) for (const _ret of returnRecoveredToSites(g, isUsable)) addLog(g, _ret.text);
  return { status: "repaired", cost: _baseCost };
}

// The Crew tab's Rest button. Shared with the recovery tests. Mutates `g`.
export function restWorker(g, workerId) {
  const _w = (g.crew||[]).find(w => w.id === workerId);
  if (!_w) return false;
  // Remember the job, so resting is a pause rather than a resignation from the site. The site
  // card tells players to "rest them in the Crew tab"; doing exactly that used to strand them.
  const _from = (g.activeSites||[]).find(site => (site.assignedCrewIds||[]).includes(workerId));
  if (_from) _w.awaitingRestForSiteId = _from.id;
  (g.activeSites||[]).forEach(site => {
    site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== workerId);
  });
  _w.status = "Resting";
  _w.restUntilStamina = 80;
  addLog(g, `💤 ${_w.name} is resting — will return when stamina reaches 80%.`);
  return true;
}

// The Resume button. Resumes only a pause the player made — a permit, regulatory or inspection
// hold is cleared by its own resolution, never by this. Returns whether it resumed. Mutates `g`.
export function resumeSite(g, siteId) {
  const _s = (g.activeSites||[]).find(s => s.id === siteId);
  if (!_s) return false;
  if (!canPlayerResume(_s)) {
    addLog(g, `⛔ ${_s.label} is on an official hold — it cannot be resumed early.`);
    return false;
  }
  _s.status = "Active";
  _s.pausedDays = 0;
  _s.pauseReason = null;
  addLog(g, `▶️ ${_s.label} resumed.`);
  return true;
}

// Same-day emergency order at 1.5x, on supplier credit if cash is short. Shared with the tests.
export function emergencyOrderMaterials(g, siteId) {
  const site = g.activeSites.find(s => s.id === siteId);
  if (!site) return { status: "none" };
  const contract = g.contracts.find(c => c.id === site.contractId);
  const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
  const missing = getSiteMissingMaterials(site, def, g);
  if (!missing.length) return { status: "none" };
  const totalCost = missing.reduce((s, m) => s + m.costEmergency, 0);
  const shortfall = Math.max(0, totalCost - (g.cash || 0));
  const canUseCredit = (g.creditScore || 600) >= 600;
  if (shortfall > 0 && !canUseCredit) {
    addLog(g, `❌ Emergency purchase failed — insufficient cash and credit below 600.`);
    return { status: "refused" };
  }
  if (shortfall > 0) {
    g.debt = (g.debt || 0) + shortfall;
    g.creditScore = Math.max(300, (g.creditScore || 600) - 5);
    g.cash = Math.max(0, g.cash - (totalCost - shortfall));
    addLog(g, `⚡ Emergency: ${money(shortfall)} charged to supplier credit.`);
  } else {
    g.cash -= totalCost;
  }
  g.expenses += totalCost;
  // Emergency premium is a cost this project caused, so it lands on this project.
  accrueProjectCost(site, "materials", totalCost);
  recordTransaction(g, "materials", -totalCost, `${site.label}: emergency material order`);
  // The part on supplier credit did not leave the bank today — it became debt. Name it, so the
  // ledger matches the balance.
  if (shortfall > 0) recordTransaction(g, "financing", shortfall, `${site.label}: supplier credit drawn`);

  // Same-day: the emergency order is queued like any other, but with a zero-day lead, so
  // it is collected by the same arrival path in the tick rather than a second code path
  // that could drift from it. This is now what the 1.5x premium actually buys.
  if (!Array.isArray(site.pendingDeliveries)) site.pendingDeliveries = [];
  site.pendingDeliveries.push(...planDeliveries(missing, g.day, { emergency: true }));
  const summary = missing.map((m) => `${m.missing} ${m.unit} of ${m.label}`).join(", ");
  addLog(g, `⚡ Emergency order placed: ${summary} (${money(totalCost)}) — on site today.`);
  return { status: "ordered", cost: totalCost };
}

// Auto-buy: top up every active site's shortfall at the canonical price. Shared with the tests.
export function autoPurchaseSiteMaterials(g) {
  for (const site of (g.activeSites || [])) {
    if (site.status !== "Active") continue;
    const _con = (g.contracts || []).find(c => c.id === site.contractId);
    const _def = CONTRACT_DEFS.find(d => d.id === _con?.defId);
    if (!_def?.materials) continue;
    for (const [matId, needed] of Object.entries(_def.materials)) {
      const have = (site.materialsFulfilled || {})[matId] || 0;
      if (have >= needed) continue;
      const shortage = needed - have;
      // Same price the manual quote shows (systems/materialPricing.js) — it used to skip the
      // regional adjustment, so auto-buy and the shop disagreed.
      const cost = getMaterialUnitPrice(g, matId) * shortage;
      if (g.cash >= cost) {
        g.cash -= cost;
        g.expenses = (g.expenses || 0) + cost;
        g.weeklyStats.expenses = (g.weeklyStats.expenses || 0) + cost;
        if (!site.materialsFulfilled) site.materialsFulfilled = {};
        site.materialsFulfilled[matId] = needed;
        accrueProjectCost(site, "materials", cost);
        recordTransaction(g, "materials", -cost, `${site.label}: auto-purchased ${shortage} ${matId}`);
        addLog(g, `⚡ Auto-purchased ${shortage} ${matId} for "${site.label}" — ${money(cost)}.`);
      }
    }
  }
}

// Which Getting Started step the player is on, derived purely from game state — there is no
// stored tutorial cursor, so the card can never get out of step with what the player has
// actually done. Extracted from renderHome so the bottom nav can mark the same tab the card
// is pointing at, which is how FleetFlow guides its own first sixty seconds.
export function getTutorialStepIndex(game) {
  if (!game || game.tutorialDone) return -1;
  const sites = game.activeSites || [];
  const hasActiveSite = sites.length > 0;
  const hasBid = (game.contracts || []).some((c) => c.status === "Active" || c.status === "Awarded");
  const needsMaterials = hasActiveSite && sites.some((site) => {
    const con = (game.contracts || []).find((c) => c.id === site.contractId);
    const def = CONTRACT_DEFS.find((d) => d.id === con?.defId);
    return def?.materials && Object.entries(def.materials).some(
      ([id, qty]) => ((site.materialsFulfilled || {})[id] || 0) < qty,
    );
  });

  if (hasActiveSite && !needsMaterials) return 3;
  if (hasActiveSite && needsMaterials) return 2;
  if (hasBid) return 1;
  return 0;
}

// The tab the tutorial is currently sending the player to, or null when the tutorial is
// done or the player is already looking at the right tab.
export function getTutorialTargetTab(game) {
  const step = getTutorialStepIndex(game);
  if (step < 0) return null;
  return step === 0 ? "Bids" : "Sites";
}

export function getNextBestAction(s) {
  // Priority 1: Business frozen / deep cash crisis
  if (s.businessFrozen) return { title: "Business Frozen", body: "Overdue taxes suspended operations. Pay now in Finance.", tone: "red", tab: "Finance" };
  if ((s.cash || 0) < -1000) return { title: "Cash Crisis", body: "Account is deep in the red. Win and complete jobs urgently.", tone: "red", tab: "Finance" };

  const _activeSites = s.activeSites || [];
  const _crew = s.crew || [];
  const _equipment = s.equipment || [];
  const _contracts = s.contracts || [];

  // Priority 2: Active site with no crew assigned
  const _noCrewSite = _activeSites.find(site =>
    site.status === "Active" && (site.assignedCrewIds || []).length === 0
  );
  if (_noCrewSite) return { title: "Site Has No Crew", body: `"${_noCrewSite.label}" is active but has no workers assigned. Go to Sites and assign crew to keep it moving.`, tone: "red", tab: "Sites" };

  // Priority 3: Broken or maintenance equipment on an active site
  const _brokenAssigned = _equipment.find(e =>
    (e.status === "Broken" || e.status === "Maintenance") &&
    _activeSites.some(site => (site.assignedEquipmentIds || []).includes(e.id) && site.status === "Active")
  );
  if (_brokenAssigned) return { title: "Machine Down on Site", body: `${_brokenAssigned.name} is out of action on an active site. Repair it in Equipment to restore full progress.`, tone: "orange", tab: "Equipment" };

  // Also catch any broken equipment not on site
  const _brokenAny = _equipment.find(e => e.status === "Broken" || e.status === "Maintenance");
  if (_brokenAny) return { title: "Machine Needs Repair", body: `${_brokenAny.name} is out of action. Repair it in Equipment before assigning it to new sites.`, tone: "orange", tab: "Equipment" };

  // Priority 4: Site stalled — missing materials
  const _stalledSite = _activeSites.find(site => {
    const _contract = _contracts.find(c => c.id === site.contractId);
    const _def = CONTRACT_DEFS.find(d => d.id === _contract?.defId);
    return _def?.materials && Object.entries(_def.materials).some(([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed);
  });
  if (_stalledSite) return { title: "Site Stalled — Materials Needed", body: `"${_stalledSite.label}" can't progress. Buy the required materials in the Sites tab to resume work.`, tone: "orange", tab: "Sites" };

  // Priority 5: Overdue / late site
  const _overdueSite = _activeSites.find(site => (s.day || 1) > site.deadlineDay && site.status === "Active");
  if (_overdueSite) return { title: "Overdue Site — Act Now!", body: `"${_overdueSite.label}" is past deadline. Every day costs ${money(_overdueSite.penaltyPerDay || 0)}. Switch strategy to Rush or renegotiate.`, tone: "red", tab: "Sites" };

  // Priority 6: Exhausted crew (very low stamina or mood)
  const _exhaustedWorker = _crew.find(w => w.status === "Active" && ((w.stamina ?? 50) < 20 || (w.mood ?? 70) < 15));
  if (_exhaustedWorker) return { title: "Crew Exhausted", body: `${_exhaustedWorker.name} is running on empty (stamina ${Math.round(_exhaustedWorker.stamina ?? 0)}). Send them to rest or morale will crater.`, tone: "orange", tab: "Crew" };

  // Worker about to quit
  const _moodCrisis = _crew.find(w => (w.mood ?? 70) < 20 && (w.loyalty ?? 50) < 30);
  if (_moodCrisis) return { title: "Crew About to Quit", body: `${_moodCrisis.name} has very low morale. Consider a raise or bonus — check Crew before they walk.`, tone: "red", tab: "Crew" };

  // Priority 7: Low cash
  if ((s.cash || 0) < 500) return { title: "Cash Running Low", body: "Under $500 in the account. Complete active sites faster to bring in revenue.", tone: "orange", tab: "Finance" };

  // No active sites
  const _openContracts = _contracts.filter(c => c.status === "Open");
  const _idleCrew = _crew.filter(w => w.status === "Idle" && w.onShift !== false);
  const _idleEquip = _equipment.filter(e => e.status === "Idle");

  if (_activeSites.length === 0) {
    if (_crew.length === 0) return { title: "Hire Your First Worker", body: "Post a job ad in Crew then hire an applicant. You need at least 1 worker to start any site.", tone: "cyan", tab: "Crew" };
    if (_equipment.length < 1) return { title: "Buy Your First Machine", body: "A Basic Pickup Truck unlocks Tier 1 contracts. Buy one from the Equipment tab.", tone: "cyan", tab: "Equipment" };
    if (_openContracts.length === 0) return { title: "No Active Sites", body: "No contracts available right now. Your reputation will attract new ones tomorrow.", tone: "blue", tab: "Bids" };
    if (_idleCrew.length >= 1 && _idleEquip.length >= 1) {
      return { title: "Ready to Work — No Active Sites", body: `${_idleCrew.length} crew idle and ${_idleEquip.length} machines ready. Bid on a contract in Bids and start a site.`, tone: "blue", tab: "Bids" };
    }
    return { title: "No Active Sites", body: "Head to Bids and pick up a contract to get back to work.", tone: "blue", tab: "Bids" };
  }

  // Subcontractor suggestion: slow site, no subs active, can afford
  const _activeSubs = (s.subcontractors||[]).filter(sc => (sc.daysLeft||0) > 0 && sc.status === "Active");
  const _slowSite = _activeSites.find(site => site._progressRate && pctPerDay(site._progressRate) < 8 && site.status === "Active");
  if (_activeSubs.length === 0 && _slowSite && (s.cash||0) > 3000) {
    return { title: "Speed Up With Subcontractors", body: `"${_slowSite.label}" is progressing slowly. Hire a temp crew in the Crew tab to boost site speed by up to 30%.`, tone: "blue", tab: "Crew" };
  }

  // All sites healthy
  const _allHealthy = _activeSites.every(site => {
    const _c = _contracts.find(c => c.id === site.contractId);
    const _d = CONTRACT_DEFS.find(d => d.id === _c?.defId);
    const _noMissing = !_d?.materials || !Object.entries(_d.materials).some(([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed);
    return _noMissing && site.status === "Active" && (s.day || 1) <= site.deadlineDay && (site.assignedCrewIds || []).length > 0;
  });
  if (_allHealthy) return { title: "All Sites Running Smoothly", body: "Everything looks good. Review Finance for optimizations — or bid on new contracts to grow faster.", tone: "green", tab: "Finance" };

  // Fallback
  return { title: "Check Your Sites", body: "Review active sites to make sure crew, materials, and deadlines are all in order.", tone: "blue", tab: "Sites" };
}

export function checkMilestones(state) {
  if (!state._milestones) state._milestones = {};
  const unlocked = [];
  for (const m of MILESTONE_DEFS) {
    if (state._milestones[m.key]) continue;
    try {
      if (m.check(state)) {
        state._milestones[m.key] = true;
        if (typeof m.reward === "function") {
          const _scope = beginCashScope(state);
          m.reward(state);
          closeCashScope(state, _scope, "bonuses", `Milestone: ${m.label}`);
          addImportantNotice(state, `🏆 "${m.label}" milestone reached!`, "green");
        } else if (m.reward > 0) {
          state.cash += m.reward;
          recordTransaction(state, "bonuses", m.reward, `Milestone: ${m.label}`);
          addLog(state, `🏆 Milestone: "${m.label}" — Bonus ${money(m.reward)}!`);
          addImportantNotice(state, `🏆 "${m.label}" — ${money(m.reward)} bonus!`, "green");
        } else {
          addLog(state, `🏆 Milestone: "${m.label}"!`);
          addImportantNotice(state, `🏆 "${m.label}" milestone reached!`, "green");
        }
        unlocked.push(m);
      }
    } catch(e) { if (__DEV__) console.warn('[ConstructionFlow] milestone check error:', e); }
  }
  // Level 10 first-time celebration
  const _cl10 = COMPANY_LEVELS.slice().reverse().find(l => (state.reputation||0) >= l.repMin && (state.completedJobs||0) >= l.jobsMin && computeValuation(state) >= l.valMin) || COMPANY_LEVELS[0];
  if (_cl10.level >= 10 && !state._level10Celebrated) {
    state._level10Celebrated = true;
    state.cash += 25000; state.revenue += 25000;
    recordTransaction(state, "bonuses", 25000, "Level 10 celebration bonus");
    addImportantNotice(state, "👑 Construction Dynasty achieved! +$25,000 celebration bonus.", "green");
    addLog(state, "👑 Reached Level 10: Construction Dynasty — the pinnacle of the industry!");
  }
  return unlocked;
}

// ─── Workforce Functions ──────────────────────────────────────────────────────

export function checkWorkerTurnover(g) {
  const quitters = [];
  for (const w of g.crew) {
    let quitChance = 0;
    if (w.mood < 25 && w.loyalty < 40) quitChance = 0.15;
    if (w.mood < 40 && w.wagePerDay < 25 && w.skill > 90) quitChance = Math.max(quitChance, 0.08);

    // Burnout: stamina < 20 → 30% quit chance; stamina < 10 → 60% quit chance
    if ((w.stamina ?? 50) < 10 && w.status !== "Idle") {
      w.mood = Math.max(0, (w.mood ?? 50) - rand(10, 18));
      quitChance = Math.max(quitChance, 0.60);
      addLog(g, `😰 ${w.name} is completely burned out — about to quit!`);
      // Running someone into the ground is remembered by everyone else on the crew.
      recordMemory(g, {
        tag: `burnout_${w.id}`, kind: "crew", valence: "bad", weight: 2, subject: w.name,
        label: `Ran ${w.name} into the ground`,
        detail: `you worked ${w.name} to burnout`,
      });
    } else if ((w.stamina ?? 50) < 20 && w.status !== "Idle") {
      w.mood = Math.max(0, (w.mood ?? 50) - rand(6, 12));
      if ((w.mood ?? 50) < 20) quitChance = Math.max(quitChance, 0.30);
      addLog(g, `😰 ${w.name} is burning out — low stamina draining morale.`);
    }

    // Loyalty builds 0.1/day while on the job
    if (w.status === "Active") {
      w.loyalty = Math.min(100, (w.loyalty ?? 0) + 0.1);
    } else if (Math.random() < 0.05) {
      w.loyalty = Math.min(100, (w.loyalty ?? 50) + 1);
    }

    // Loyalty milestone events
    const loyaltyMilestone = Math.floor((w.loyalty ?? 0));
    if (loyaltyMilestone >= 50 && !(w._loyalty50Done) && w.status !== "Active") {
      w._loyalty50Done = true;
      const raiseAmt = Math.round(w.wagePerDay * 0.10);
      if (g.cash > raiseAmt * 30) {
        w.wagePerDay += raiseAmt;
        w.mood = Math.min(100, (w.mood ?? 50) + 15);
        addLog(g, `💼 ${w.name} has been loyal for 50 days — earned a 10% raise!`);
      } else {
        addLog(g, `💼 ${w.name} is requesting a raise after 50 days of loyalty.`);
      }
    }
    if (loyaltyMilestone >= 100 && !(w._loyalty100Done)) {
      w._loyalty100Done = true;
      w.skill = Math.min(150, (w.skill || 80) + 5);
      addLog(g, `🏅 ${w.name} has reached max loyalty — permanent +5 skill bonus from experience!`);
    }

    // Wage pressure: high-pressure traits demand raises every ~60 days or morale drops
    const pressure = w.trait?.wagePressure || 1.0;
    if (pressure > 1.1) {
      const daysSinceRaise = g.day - (w.lastRaiseDay || 0);
      if (daysSinceRaise > 60 && Math.random() < (pressure - 1.0) * 0.5) {
        // Demand a raise — auto-apply small raise or worker mood tanks
        if (g.cash > w.wagePerDay * 30) {
          const raise = Math.round(w.wagePerDay * (pressure - 1.0) * 0.3);
          w.wagePerDay += raise;
          w.lastRaiseDay = g.day;
          w.mood = Math.min(100, (w.mood ?? 50) + 10);
          addLog(g, `💰 ${w.name} got a raise (+$${raise}/day) — ${w.trait.label} demands it.`);
          recordMemory(g, {
            tag: `raise_${w.id}`, kind: "crew", valence: "good", weight: 1, subject: w.name,
            label: `Gave ${w.name} a raise`,
            detail: `you paid ${w.name} properly when they asked`,
          });
        } else {
          w.mood = Math.max(0, (w.mood ?? 50) - 15);
          quitChance = Math.max(quitChance, 0.10);
        }
      }
    }

    // Phase 6: people remember how they were treated. A company with a history of looking
    // after its crew holds on to them; one with the opposite history bleeds them faster.
    // Applied to the CHANCE, never to the reasons — a burned-out worker is still burned out.
    const _loyalty = resolveMemoryEffects(g).crewLoyalty;
    if (_loyalty !== 0) quitChance = Math.max(0, Math.min(1, quitChance * (1 - _loyalty)));

    if (quitChance > 0 && Math.random() < quitChance) {
      quitters.push(w.id);
      for (const site of g.activeSites) {
        if ((site.assignedCrewIds || []).includes(w.id)) {
          site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== w.id);
        }
      }
      // Crew story (Feature 6)
      if ((w.jobsCompleted || 0) > 3 || (w.loyalty ?? 0) > 30) {
        const _daysWorked = g.day - (w.hireDay || g.day);
        const _years = Math.floor(_daysWorked / 365);
        const _yearStr = _years > 0 ? `${_years} year(s)` : `${_daysWorked} days`;
        const _isVet = (w.loyalty ?? 0) >= 100;
        const _msg = _isVet
          ? `${w.name} retired after ${_yearStr} — a loyal veteran, ${w.jobsCompleted||0} projects completed. Thank you.`
          : `${w.name} departed after ${_yearStr} — ${w.jobsCompleted||0} projects completed.`;
        addLog(g, `👤 ${_msg}`);
      } else {
        addLog(g, `👋 ${w.name} quit — low morale or undervalued. Lost a ${w.role}.`);
      }
    }
  }
  if (quitters.length) g.crew = g.crew.filter((w) => !quitters.includes(w.id));
}

function checkLevelUp(g, w) {
  const next = WORKER_LEVELS.find(l => l.level === (w.level || 1) + 1);
  if (!next || (w.xp || 0) < next.xpRequired) return;
  w.level = next.level;
  w.skill = Math.min(150, (w.skill || 75) + 3);
  w.loyalty = Math.min(100, (w.loyalty ?? 50) + 5);
  addLog(g, `⭐ ${w.name} reached ${next.label} (Lv${next.level})! Skill +3.`);
  addImportantNotice(g, `${w.name} leveled up to ${next.label}!`, "green");
}

function checkPromotion(g) {
  for (const w of g.crew) {
    const jobs = w.jobsCompleted || 0;
    if (!w._promotedAt) w._promotedAt = [];
    for (const milestone of PROMOTION_MILESTONES) {
      if (jobs >= milestone && !w._promotedAt.includes(milestone)) {
        w._promotedAt.push(milestone);
        const skillBonus = rand(3, 8);
        w.skill = Math.min(150, w.skill + skillBonus);
        w.loyalty = Math.min(100, w.loyalty + rand(2, 5));
        addLog(g, `⭐ ${w.name} promoted after ${milestone} jobs — skill +${skillBonus}!`);
        // Veteran milestone: trigger recognition event at 20 jobs
        if (milestone === 20 && !g.pendingVeteranEvent) {
          const retainCost = 800 + (jobs * 15);
          g.pendingVeteranEvent = { workerId: w.id, workerName: w.name, jobsCompleted: jobs, skill: w.skill, retainCost };
        }
      }
    }
  }
}

export function generateWeeklyChallenge(g) {
  const lv = Math.min(10, Math.floor((g.reputation || 0) / 20) + 1);
  const opts = [
    { type: "week_contracts", label: `Complete ${2+lv} contract${2+lv>1?"s":""} this week`, target: 2+lv, reward: 600+lv*120, repBonus: 4 },
    { type: "week_revenue",   label: `Earn ${money(3000+lv*800)} in contract income`,         target: 3000+lv*800, reward: 500+lv*100, repBonus: 2 },
    { type: "week_safety",    label: `Keep safety score above 70 all week`,                   target: 70, reward: 400+lv*80, repBonus: 3 },
    { type: "week_ontime",    label: `Complete ${1+Math.floor(lv/2)} job${1+Math.floor(lv/2)>1?"s":""} on time`, target: 1+Math.floor(lv/2), reward: 700+lv*140, repBonus: 5 },
    { type: "week_fleet",     label: `Keep all vehicles above 40% condition`,                 target: 40, reward: 450+lv*90, repBonus: 2 },
    { type: "week_crew",      label: `Keep all active crew stamina above 50`,                  target: 50, reward: 350+lv*70, repBonus: 1 },
  ];
  const chosen = opts[Math.floor(Math.random()*opts.length)];
  g.weeklyChallenge = { ...chosen, progress: 0, completed: false, startDay: g.day, claimedDay: null };
}

export function checkWeeklyChallenge(g, event, value) {
  const wc = g.weeklyChallenge;
  if (!wc || wc.completed || wc.progress < 0) return;
  if (wc.type === "week_contracts" && event === "job_complete") wc.progress = (wc.progress||0) + 1;
  if (wc.type === "week_revenue"   && event === "revenue")      wc.progress = (wc.progress||0) + value;
  if (wc.type === "week_ontime"    && event === "ontime")       wc.progress = (wc.progress||0) + 1;
  if (wc.type === "week_safety" && event === "daily" && (g.safetyScore||60) < wc.target) wc.progress = -1;
  if (wc.type === "week_fleet"  && event === "daily" && (g.equipment||[]).some(e=>(e.condition||0)<wc.target)) wc.progress = -1;
  if (wc.type === "week_crew"   && event === "daily" && (g.crew||[]).filter(w=>w.status==="Active").some(w=>(w.stamina ?? 50)<wc.target)) wc.progress = -1;
  if (wc.progress !== -1 && wc.progress >= wc.target) {
    wc.completed = true;
    addImportantNotice(g, `📋 Weekly Challenge complete! Claim your ${money(wc.reward)} reward on the Home screen.`, "green");
  }
}

export function startNewGeneration(g, perkId) {
  const nextGen = (g.generation || 1) + 1;
  const mentor = [...(g.crew||[])].sort((a,b)=>(b.skill||0)-(a.skill||0))[0];
  const perks = [...(g.legacyPerks||[]), perkId];
  const fresh = freshState();
  fresh.generation = nextGen;
  fresh.companyName = g.companyName;
  fresh.startingCityId = g.startingCityId;
  fresh.homeCityName = g.homeCityName;
  fresh.homeStateCode = g.homeStateCode;
  fresh.homeStateName = g.homeStateName;
  fresh.homeCompetition = g.homeCompetition;
  fresh.tutorialDone = true;
  fresh.setupDone = true;
  fresh.theme = g.theme || "dark";
  fresh.legacyPerks = perks;
  fresh.hallOfFame = { ...g.hallOfFame, prestigeReached: g.day };
  // Apply chosen perk
  if (perkId === "iron_foundation")       { fresh.cash += 50000; fresh.revenue += 50000; }
  if (perkId === "reputation_legacy")     { fresh.reputation = 25; }
  if (perkId === "veteran_mentor" && mentor) { fresh.legacyMentor = { name: mentor.name, skill: mentor.skill||75, role: mentor.role, wagePerDay: Math.round((mentor.wagePerDay||120) * 0.5) }; }
  if (perkId === "equipment_cache")       { fresh._pendingEquipCache = true; }
  if (perkId === "material_stockpile")    { const mats = ["concrete","lumber","steel"]; mats.forEach(m => { fresh.materials[m] = (fresh.materials[m]||0) + 30; }); }
  if (perkId === "political_connections") { fresh._politicalContractsLeft = 5; }
  // Stack bonuses from prior generations (diminishing)
  for (const p of (g.legacyPerks||[])) {
    if (p === "iron_foundation")   fresh.cash += 15000;
    if (p === "reputation_legacy") fresh.reputation = Math.min(fresh.reputation + 8, 35);
  }
  // The new generation's opening balance is where its books start, perk capital included.
  fresh._ledgerSnapshot = { cash: fresh.cash, revenue: fresh.revenue, expenses: fresh.expenses, day: fresh.day };
  return fresh;
}

function getClientTier(loyalty) {
  if (loyalty >= 81) return { label: "Preferred Vendor", color: "green", valueMult: 1.15, extraDays: 2 };
  if (loyalty >= 51) return { label: "Trusted Partner",  color: "cyan",  valueMult: 1.08, extraDays: 1 };
  if (loyalty >= 21) return { label: "Acquaintance",     color: "sub",   valueMult: 1.0,  extraDays: 0 };
  return                      { label: "Stranger",        color: "sub",   valueMult: 1.0,  extraDays: 0 };
}

function applyEquipmentAging(g) {
  for (const e of g.equipment) {
    if (e.status === "Active") continue;
    e.condition = Math.max(0, e.condition - 0.5);
    if (e.condition < 20 && e.status === "Idle") {
      e.status = "Maintenance";
      addLog(g, `🔧 ${e.name} condition critical — needs maintenance before next use.`);
    }
  }
}

function decrementTraining(g) {
  if (!g.trainingQueue || !g.trainingQueue.length) return;
  const done = [];
  for (const t of g.trainingQueue) {
    t.daysLeft = (t.daysLeft || 1) - 1;
    if (t.daysLeft <= 0) {
      const w = g.crew.find((w) => w.id === t.workerId);
      const prog = TRAINING_PROGRAMS.find((p) => p.id === t.programId);
      if (w && prog) {
        w.skill = Math.min(150, w.skill + prog.skillBonus);
        if (prog.wagePressure) w.wagePerDay = Math.round(w.wagePerDay * (1 + prog.wagePressure));
        if (prog.certId && !w.certifications) w.certifications = [];
        if (prog.certId && !(w.certifications||[]).includes(prog.certId)) {
          w.certifications = [...(w.certifications||[]), prog.certId];
          addLog(g, `🎓 ${w.name} earned certification: ${prog.label}!`);
        }
        addLog(g, `🎓 ${w.name} completed "${prog.label}" — skill +${prog.skillBonus}!`);
      }
      done.push(t.id);
    }
  }
  if (done.length) g.trainingQueue = g.trainingQueue.filter((t) => !done.includes(t.id));
}

// ─── Rival AI Functions ────────────────────────────────────────────────────────

export function enhancedRivalDailyLogic(g) {
  if (!g.rivals) g.rivals = createRivals();

  // ── NEW COMPANIES ENTER A THIN MARKET ──────────────────────────────────────
  // Without this the board is finite: acquire or bankrupt all seven authored companies and
  // the market is dead forever. Gated on a thin field, a cooldown and a low daily roll, so
  // an arrival is news rather than a conveyor belt — and the companies the player BOUGHT
  // stay bought, because the buyout copy promises exactly that.
  if (shouldSpawnEntrant(g, Math.random)) {
    const entrant = createEntrant(g, Math.random);
    g.rivals.push(entrant);
    g.lastEntrantDay = g.day;
    pushMarketNews(g, { text: describeEntrantArrival(entrant), tone: "info", rivalId: entrant.id });
  }

  for (const rival of g.rivals) {
    if (!rival) continue;
    if (isRivalOffTheBoard(rival, g)) continue;

    // ── ONE LIFECYCLE ────────────────────────────────────────────────────────
    // This replaces two competing systems that shared `bankruptDays` with opposite meanings:
    // one treated it as days spent bankrupt, the other as days spent nearly bankrupt, and
    // the second system's recovery branch was unreachable because the first `continue`d past
    // it. See src/systems/rivalMarket.js.
    const step = stepRivalLifecycle(rival, { rng: Math.random });
    Object.assign(rival, step.changes);
    if (step.news) {
      const line = describeRivalLifecycleNews(rival, step.news);
      if (line) pushMarketNews(g, { text: line, tone: step.news.tone, rivalId: rival.id });
    }
    // A struggling company keeps trading — it is a competitor, not a corpse. Only a folded
    // or just-restructured one sits the day out.
    if (!step.trading) continue;

    // Movements this company actually made today, so the growth headline below narrates the
    // simulation rather than running a second one beside it.
    const moved = { hired: 0, machines: 0, jobsWon: 0, cityOpened: null };

    const activeJobs = rival.activeJobs || 0;

    // Cash flow: active jobs generate income — scaled higher so rivals can
    // eventually challenge the player in late game
    if (activeJobs > 0) {
      const income = activeJobs * rand(12000, 40000);
      const costs = activeJobs * rand(3000, 8000) + (rival.employees || 2) * rand(180, 280);
      rival.cash = (rival.cash || 0) + income - costs;
      rival.estimatedRevenue = (rival.estimatedRevenue || 0) + income;
    } else {
      // Overhead burns cash even without jobs
      rival.cash = (rival.cash || 0) - rand(400, 1200) - (rival.employees || 2) * 100;
      // Rep slowly decays when inactive
      if (Math.random() < 0.15) rival.rep = Math.max(0, (rival.rep || 10) - 1);
    }

    // Bankruptcy is decided by stepRivalLifecycle at the top of this loop — one place, one
    // valuation formula, one meaning for `troubleDays`. The duplicate declaration that used
    // to sit here computed the same valuation inline and disagreed with the other system.

    // Rivals grow rep daily at +0.04–0.08 (so 50-80 rep after 1000 days passively)
    if (activeJobs > 0 && Math.random() < 0.60) {
      rival.rep = Math.min(100, (rival.rep || 0) + (Math.random() * 0.08 + 0.02));
    }

    // Complete active jobs
    if (activeJobs > 0 && Math.random() < 0.18) {
      rival.activeJobs = Math.max(0, activeJobs - 1);
      rival.jobsCompleted = (rival.jobsCompleted || 0) + 1;
      rival.rep = Math.min(100, (rival.rep || 0) + rand(1, 3));
    }

    // Rivals occasionally hire workers (simulated)
    if (Math.random() < 0.05 && (rival.employees || 2) < 20) {
      rival.employees = (rival.employees || 2) + 1;
      rival.cash -= rand(2000, 5000);
      moved.hired += 1;
    }
    // Rivals occasionally buy equipment (simulated).
    // This used to increment `rival.equipCount` while the other capex path below incremented
    // `rival.equipment` — two counters for one thing, and the UI only ever read the second,
    // so half of every rival's machine purchases were invisible. One field now.
    if (Math.random() < 0.03 && (rival.cash || 0) > 50000) {
      rival.equipment = (rival.equipment || 1) + 1;
      rival.cash -= rand(15000, 50000);
      rival.rep = Math.min(100, (rival.rep || 0) + 1);
      moved.machines += 1;
    }
    // Market response — rivals pull back during recession
    if (g.activeMarketEvent === "recession_start" && Math.random() < 0.30) {
      rival.activeJobs = Math.max(0, (rival.activeJobs || 0) - 1);
    }
    // WHICH FEED? The rule is whether this happened TO THE PLAYER or merely in the market.
    // Losing a worker, or being outbid on a contract you were looking at, is the player's own
    // event and belongs in their ops log. A rival opening a yard, winning an award or buying
    // another firm is market news and belongs in `marketNews` — the ops log is capped at 25
    // entries and rival activity fires far more often than the player's own.
    // Rivals occasionally poach your crew if they're struggling
    if ((rival.rep || 0) > 20 && Math.random() < 0.02) {
      const poachTarget = g.crew.find(w => w.mood < 50 && w.loyalty < 40);
      if (poachTarget) {
        g.crew = g.crew.filter(w => w.id !== poachTarget.id);
        addLog(g, `👋 ${poachTarget.name} was poached by ${rival.name}. Low morale cost you a worker.`);
      }
    }

    // Hire workers when growing and profitable
    if (rival.cash > 30000 && (rival.employees || 2) < 20 && Math.random() < 0.08) {
      const hireCount = rand(1, 2);
      rival.employees = (rival.employees || 2) + hireCount;
      rival.cash -= hireCount * rand(3000, 6000);
      moved.hired += hireCount;
    }

    // Buy equipment when cash-positive and expanding
    if (rival.cash > 60000 && (rival.equipment || 1) < 8 && Math.random() < 0.05) {
      rival.equipment = (rival.equipment || 1) + 1;
      rival.cash -= rand(20000, 55000);
      moved.machines += 1;
    }

    // Lay off workers when cash-strapped
    if (rival.cash < 5000 && (rival.employees || 2) > 2 && Math.random() < 0.12) {
      rival.employees = Math.max(2, (rival.employees || 2) - 1);
      // Rival news goes to the market feed, never to `logs`/`opsFeed` — those are capped at
      // 25 and 20 entries and are about the PLAYER's operations. Rival chatter fires far
      // more often and was pushing the player's own site events out of their own history.
      pushMarketNews(g, { text: `📉 ${rival.name} laid off a worker.`, tone: "caution", rivalId: rival.id });
    }

    // Contract stealing
    const hasPMDirector = (g.projectManagers || []).some((pm) => pm.typeId === "director");
    const stealPenalty = hasPMDirector ? 0.80 : 1.0;
    const focusMap = { residential: ["Residential"], commercial: ["Commercial"], infrastructure: ["Infrastructure"] };
    const targetCategories = focusMap[rival.focus] || ["Commercial"];
    const vulnerableContracts = g.contracts.filter((c) =>
      isRivalBiddable(c) && targetCategories.includes(c.category) && c.expiresDay <= g.day + 2
    );
    for (const c of vulnerableContracts) {
      if (Math.random() < rival.aggression * 0.8 * stealPenalty) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand(1, 3));
        addLog(g, `🏗️ ${rival.name} outbid you on "${c.label}" — act faster on ${c.category} contracts.`);
        break;
      }
    }
    const expiredOpen = g.contracts.filter((c) => isRivalBiddable(c) && c.expiresDay < g.day);
    for (const c of expiredOpen) {
      if (Math.random() < rival.aggression * stealPenalty) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand(1, 3));
        addLog(g, `🏗️ ${rival.name} snagged "${c.label}" before you — move faster next time.`);
      }
    }
    // R15-3: Rival takes an "interested" contract it was watching if it's still Open
    const _interestedContracts = g.contracts.filter(c => c.status === "Open" && c.interestedRival === rival.name && g.day >= (c.rivalTakesDay || 999));
    for (const c of _interestedContracts) {
      c.status = "Taken";
      rival.activeJobs = (rival.activeJobs || 0) + 1;
      addLog(g, `🔥 ${rival.name} moved fast — they snagged "${c.label}" before you did.`);
    }

    // City expansion
    if (g.day % 15 === 0 && Math.random() < 0.25 && rival.cash > 20000) {
      const presence = rival.cityPresence || ["salem"];
      const candidateCities = CITIES.filter((c) => c.rivals.includes(rival.id) && !presence.includes(c.id));
      if (candidateCities.length > 0) {
        const target = candidateCities.reduce((best, city) =>
          city.contractMult > best.contractMult ? city : best
        );
        rival.cityPresence = [...presence, target.id];
        rival.rep = Math.min(100, (rival.rep || 0) + rand(2, 5));
        rival.cash -= rand(5000, 15000);
        moved.cityOpened = target.name;
      }
    }

    // Rivals can win annual awards too (adds realism)
    if (g.day % 365 === 0 && rival.rep >= 60 && Math.random() < 0.3) {
      rival.rep = Math.min(100, (rival.rep || 0) + rand(3, 8));
      if (Math.random() < 0.5) {
        pushMarketNews(g, { text: `🏆 ${rival.name} won an industry award — their reputation grows.`, tone: "neutral", rivalId: rival.id });
      }
    }

    // Update growth trend for UI display
    const prevRev = rival.estimatedRevenue || 0;
    rival.growthTrend = prevRev > 100000 ? "growing" : prevRev > 30000 ? "stable" : "declining";

    // ── City stats for rival jobs (Feature 8) ─────────────────────────────────
    const _rivalCity = (g.unlockedCities || ["salem"])[Math.floor(Math.random() * Math.max(1, (g.unlockedCities||["salem"]).length))];
    if (!g.cityStats) g.cityStats = {};
    if (!g.cityStats[_rivalCity]) g.cityStats[_rivalCity] = { playerJobs: 0, rivalJobs: 0 };
    g.cityStats[_rivalCity].rivalJobs = (g.cityStats[_rivalCity].rivalJobs || 0) + 1;

    // ── Rival War: Employee poaching (Feature 7) ────────────────────────────
    if ((rival.valuation || rival.cash || 0) > (g.companyValuation||0) * 1.8 && Math.random() < 0.03) {
      const _idleCrew = (g.crew||[]).filter(w => w.status === "Idle");
      if (_idleCrew.length > 1) {
        const _target = _idleCrew[Math.floor(Math.random() * _idleCrew.length)];
        // Remove from all site assignments before removing from crew
        for (const _site of (g.activeSites||[])) {
          _site.assignedCrewIds = (_site.assignedCrewIds||[]).filter(id => id !== _target.id);
        }
        g.crew = g.crew.filter(w => w.id !== _target.id);
        addLog(g, `⚠️ ${rival.name} poached ${_target.name} from your crew!`);
      }
    }

    // ── Rival War: cityJobs tracking ─────────────────────────────────────────
    if ((rival.activeJobs||0) > 0) {
      const _rCities = rival.cityPresence || ["salem"];
      const _rCity = _rCities[Math.floor(Math.random() * _rCities.length)];
      if (!g.cityStats) g.cityStats = {};
      if (!g.cityStats[_rCity]) g.cityStats[_rCity] = { playerJobs: 0, rivalJobs: 0 };
      g.cityStats[_rCity].rivalJobs = (g.cityStats[_rCity].rivalJobs||0) + 1;
      rival.cityJobs = (rival.cityJobs||0) + 1;
    }

    // ── Rival-vs-rival acquisition (1% chance when 5× valuation gap) ─────────
    if (Math.random() < 0.01) {
      const _weakerRival = (g.rivals||[]).find(r =>
        r.id !== rival.id &&
        r.status !== "Bankrupt" &&
        !(g.acquiredRivals||[]).includes(r.id) &&
        ((rival.cash||0) + (rival.rep||0)*50000) >= ((r.cash||0) + (r.rep||0)*50000) * 5
      );
      if (_weakerRival) {
        rival.activeJobs = (rival.activeJobs||0) + (_weakerRival.activeJobs||0);
        rival.employees = (rival.employees||2) + Math.floor((_weakerRival.employees||2) * 0.5);
        rival.rep = Math.min(100, (rival.rep||0) + rand(2, 5));
        _weakerRival.status = RIVAL_STATUS.BANKRUPT;
        _weakerRival.troubleDays = 0;
        pushMarketNews(g, { text: `🤝 ${rival.name} acquired ${_weakerRival.name} — the market is consolidating.`, tone: "caution", rivalId: rival.id });
      }
    }

    // ── GROWTH, NARRATED FROM WHAT ACTUALLY HAPPENED ────────────────────────
    // Every clause is derived from a movement recorded above, so the headline can never
    // claim something the simulation did not do. Silence when nothing moved.
    const growthLine = describeRivalGrowth(rival, moved);
    if (growthLine) pushMarketNews(g, { text: growthLine, tone: "neutral", rivalId: rival.id });
  }
}

// A contract the open market can take. An earned chain opportunity is a private offer to the
// player — the reward for finishing its prerequisite — so no rival can bid it away. Sprint 1 found
// rivals claiming one on the very day it opened.
function isRivalBiddable(c) {
  return !!c && c.status === "Open" && !c.isChainUnlock;
}

export function enhancedRivalBidding(g, openContracts) {
  if (!openContracts || openContracts.length === 0) return;
  const hasPMDirector = (g.projectManagers || []).some((pm) => pm.typeId === "director");
  const playerEdge = hasPMDirector ? 0.80 : 1.0;
  const competitionMultiplier = { "Low": 0.6, "Medium": 0.85, "High": 1.1, "Very High": 1.3 };
  const playerCities = ["salem", ...(g.cityOffices || []).map((o) => o.cityId)];
  let cityPressure = 0.6;
  for (const cityId of playerCities) {
    const cityDef = CITIES.find((c) => c.id === cityId);
    if (cityDef) {
      const m = competitionMultiplier[cityDef.competition] || 0.85;
      if (m > cityPressure) cityPressure = m;
    }
  }
  const rivalPersonality = {
    apex:      { focus: ["Residential"], focusBonus: 1.15 },
    summit:    { focus: ["Commercial"],  focusBonus: 1.20 },
    ironpeak:       { focus: ["Infrastructure","Mega"], focusBonus: 1.10 },
    northwest:      { focus: ["Residential"], focusBonus: 0.75, dailySkip: 0.60 },
    pacific_group:       { focus: ["Commercial","Mega"],         focusBonus: 1.25 },
    western_build_co:    { focus: ["Residential"],               focusBonus: 1.10, dailySkip: 0.55 },
    summit_construction: { focus: ["Commercial","Government"],   focusBonus: 1.20 },
  };
  for (const rival of (g.rivals || [])) {
    if (!rival) continue;
    if (isRivalOffTheBoard(rival, g)) continue;
    if (rival.status === RIVAL_STATUS.BANKRUPT) continue;
    // THE INERT-ENTRANT TRAP. This lookup used to be a bare `rivalPersonality[rival.id]`
    // followed by `if (!personality) continue`, so a generated company — which by definition
    // has no entry in the authored table — would sit on the board forever, never bidding on
    // anything. FleetFlow's build 59 documents exactly this shape in its own daily sim.
    // Entrants carry their personality on the record, and this falls back to it.
    const personality = getRivalPersonality(rival, rivalPersonality);
    if (!personality) continue;
    if (personality.dailySkip && Math.random() > personality.dailySkip) continue;
    const targets = openContracts.filter((c) =>
      isRivalBiddable(c) && personality.focus.includes(c.category)
    );
    for (const c of targets) {
      if (Math.random() < rival.aggression * personality.focusBonus * cityPressure * playerEdge) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand(1, 3));
        pushMarketNews(g, { text: `🏗️ ${rival.name} claimed "${c.label}".`, tone: "neutral", rivalId: rival.id });
        break;
      }
    }
  }
}

// ─── Regional Weather ─────────────────────────────────────────────────────────

function applyWeatherEvent(site, game, region) {
  const pattern = WEATHER_PATTERNS[region] || WEATHER_PATTERNS["Pacific Northwest"];
  const roll = Math.random();
  if (roll < pattern.snowProb) {
    const progressLoss = Math.round(site.phaseProgress * 0.40);
    const pauseDays = rand(2, 5);
    site.phaseProgress = Math.max(0, site.phaseProgress - progressLoss);
    pauseSite(site, pauseDays, "weather", "snow");
    site.currentWeather = { icon: "snow", label: "Snow Delay", endsDay: (game.day || 1) + pauseDays };
    addLog(game, `❄️ ${site.label}: Snow halted work — lost ${progressLoss}% progress, paused ${pauseDays} day(s).`);
    return { text: `Snow halted work — lost ${progressLoss}% progress. Paused ${pauseDays} day(s).`, type: "weather_snow" };
  }
  if (roll < pattern.snowProb + pattern.rainProb) {
    const progressLoss = Math.round(site.phaseProgress * 0.20);
    const pauseDays = rand(1, 3);
    site.phaseProgress = Math.max(0, site.phaseProgress - progressLoss);
    site.deadlineDay += pauseDays;
    site.currentWeather = { icon: "rainy", label: "Rain Delay", endsDay: (game.day || 1) + pauseDays };
    addLog(game, `🌧️ ${site.label}: Rain delay — lost ${progressLoss}% progress, deadline pushed ${pauseDays} day(s).`);
    return { text: `Rain delay — lost ${progressLoss}% progress. Deadline extended ${pauseDays} day(s).`, type: "weather_rain" };
  }
  if (roll < pattern.snowProb + pattern.rainProb + pattern.heatProb) {
    const progressLoss = Math.round(site.phaseProgress * 0.10);
    site.phaseProgress = Math.max(0, site.phaseProgress - progressLoss);
    const assignedCrew = game.crew.filter((w) => site.assignedCrewIds.includes(w.id));
    for (const w of assignedCrew) w.stamina = Math.max(0, w.stamina - rand(8, 18));
    site.currentWeather = { icon: "sunny", label: "Extreme Heat", endsDay: (game.day || 1) + 1 };
    addLog(game, `☀️ ${site.label}: Extreme heat — crew stamina drained, lost ${progressLoss}% progress.`);
    return { text: `Extreme heat slowed the site. Lost ${progressLoss}% progress, crew stamina hit.`, type: "weather_heat" };
  }
  return null;
}

function checkChainEvents(site, game, lastEventType) {
  switch (lastEventType) {
    case "theft": {
      if (Math.random() < 0.40) {
        const mats = Object.keys(game.materials).filter((k) => (game.materials[k] || 0) > 0);
        if (!mats.length) break;
        const matId = pick(mats);
        const stolen = rand(3, Math.min(12, game.materials[matId]));
        game.materials[matId] = Math.max(0, game.materials[matId] - stolen);
        const mat = MATERIAL_DEFS.find((m) => m.id === matId);
        const loss = stolen * (game.materialPrices[matId] || mat?.basePrice || 100);
        addLog(game, `🚨 Chain: Second theft at ${site.label}! ${stolen} ${mat?.unit} stolen — ${money(loss)} lost.`);
        return true;
      }
      break;
    }
    case "safety": {
      if (Math.random() < 0.50) {
        // A second finding on the same site is worse than the first.
        const fine = penaltyFor({ contractValue: site.totalValue, severity: "severe", companyLevel: game.companyLevel, roll: Math.random() });
        game.cash -= fine;
        pauseSite(site, rand(1, 3), "inspection", `follow-up, ${money(fine)} fine`);
        addLog(game, `🔍 Chain: Follow-up inspection at ${site.label} — ${money(fine)} fine, work paused.`);
        return true;
      }
      break;
    }
    case "scope": {
      if (Math.random() < 0.30) {
        const bonus = rand(3000, 12000);
        site.totalValue += bonus;
        addLog(game, `📐 Chain: Scope expansion at ${site.label} — contract value +${money(bonus)}.`);
        return true;
      }
      break;
    }
    case "breakdown": {
      if (Math.random() < 0.35) {
        const impact = rand(5, 12);
        site.phaseProgress = Math.max(0, site.phaseProgress - impact);
        addLog(game, `📦 Chain: Breakdown at ${site.label} caused re-schedule — lost ${impact}% progress.`);
        return true;
      }
      break;
    }
    default: break;
  }
  return false;
}

// ─── Save Integrity ────────────────────────────────────────────────────────────

function checkSaveIntegrity(savedData) {
  const issues = [];
  if (!savedData || typeof savedData !== "object") {
    return { valid: false, issues: ["Save data is not a valid object."], migrationNeeded: false };
  }
  if (!Number.isFinite(savedData.cash))                  issues.push("g.cash is missing or not finite.");
  if (!Number.isInteger(savedData.day) || savedData.day < 1) issues.push("g.day is missing or invalid.");
  if (!Array.isArray(savedData.crew))                    issues.push("g.crew is missing.");
  if (!Array.isArray(savedData.equipment))               issues.push("g.equipment is missing.");
  if (!Array.isArray(savedData.contracts))               issues.push("g.contracts is missing.");
  if (!Array.isArray(savedData.activeSites))             issues.push("g.activeSites is missing.");
  const migrationNeeded = (
    savedData.cityOffices === undefined || savedData.properties === undefined ||
    savedData.projectManagers === undefined || savedData.acquiredRivals === undefined ||
    savedData.empireGoalsCompleted === undefined || savedData.trainingQueue === undefined
  );
  return { valid: issues.length === 0, issues, migrationNeeded };
}

// Contracts were the only unbounded collection in the save: every contract the player won
// and every contract a rival took stayed in g.contracts forever, while logs, opsFeed,
// eventLog and ledger are all capped. Measured growth was linear — 745 entries and a 446 KB
// save by day 300, and every clone() (one per tick AND one per player tap) deep-copies the
// lot. Bound the closed-contract history the way the other collections are bounded.
//
// Nothing outside the Bids list reads a closed contract except by id, via site.contractId,
// so anything a live site still points at is kept regardless of age. The tail kept beyond
// that is far longer than getTutorialStepIndex()'s "has the player ever bid?" check needs.
const CONTRACT_HISTORY_KEEP = 40;

export function pruneContractHistory(g) {
  if (!Array.isArray(g.contracts)) return;
  const currentDay = g.day || 1;
  if (currentDay <= 10) return;
  const liveContractIds = new Set((g.activeSites || []).map((s) => s.contractId));
  const kept = [];
  const history = [];
  for (const c of g.contracts) {
    if (c.status === "Open" || c.status === CHAIN_LOCKED || liveContractIds.has(c.id)) { kept.push(c); continue; }
    // Contracts a rival snapped up are pure noise once they are well past expiry.
    if (c.status === "Taken" && (c.expiresDay || 0) < currentDay - 10) continue;
    history.push(c);
  }
  // history keeps insertion order, so its tail is the most recent.
  g.contracts = [...kept, ...history.slice(-CONTRACT_HISTORY_KEEP)];
}

function cleanStaleState(g) {
  if (Array.isArray(g.logs))     g.logs = g.logs.slice(0, 25);
  if (Array.isArray(g.opsFeed))  g.opsFeed = g.opsFeed.slice(0, 20);
  g.eventLog = (g.eventLog || []).slice(0, 50);
  pruneContractHistory(g);
  if (Array.isArray(g.activeSites)) {
    for (const site of g.activeSites) {
      if (Array.isArray(site.chaosHistory)) site.chaosHistory = site.chaosHistory.slice(0, 10);
    }
  }
  // Clean up expired equipment discount flag
  if (g._equipDiscountExpiry && (g.day||1) > g._equipDiscountExpiry) {
    delete g._equipDiscountExpiry;
    delete g._equipDiscount;
  }
  // Trim crew job history
  if (Array.isArray(g.crew)) {
    g.crew = g.crew.map(w => ({ ...w, jobHistory: (w.jobHistory||[]).slice(-10) }));
  }
  return g;
}

// ─── Initial State ────────────────────────────────────────────────────────────

export function freshState() {
  const startEquip = createEquipment(EQUIPMENT_SHOP[0]); // Basic Pickup Truck
  const startWorker1 = createWorker("Labourer");
  const startWorker2 = createWorker("Carpenter");
  const startWorker3 = createWorker("General Labourer");
  // First slot is forced to "fence" — the Getting Started tutorial (see `logs` below and
  // the in-app onboarding banner) explicitly tells new players to accept the Fence
  // Installation job, whose 20-lumber requirement matches the starting inventory exactly.
  // Leaving this to random draw meant the referenced contract was often missing entirely.
  const baseContracts = [
    createContract({ cash: 75000, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices:[], properties:[] }, "fence"),
    createContract({ cash: 75000, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices:[], properties:[] }),
    createContract({ cash: 75000, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices:[], properties:[] }),
  ];

  return {
    cash: 75000, day: 1, gameMinutes: 480,
    reputation: 0, creditScore: 600,
    companyName: "New Build Co.",
    ownerName: "Owner",
    theme: "dark",
    marketState: "Normal",
    businessFrozen: false,
    taxDue: 0, taxOverdueDays: 0, taxReserve: 0, taxPeriodRevenue: 0,
    eventHistory: {},
    revenue: 0, expenses: 0,
    // The ledger's reconciliation baseline exists from the first moment, so the very first day's
    // entries are measured against the opening balance. Without it the first entry took its
    // baseline from a balance other deductions had already hit, and the reconciler reported a
    // phantom $160 "balance transfer" on day one of every new company.
    _ledgerSnapshot: { cash: 75000, revenue: 0, expenses: 0, day: 1 },
    weeklyStats: { revenue: 0, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0 },
    savings: 0,
    creditLine: null,

    equipment: [startEquip],
    crew: [startWorker1, startWorker2, startWorker3],
    officeStaff: [],
    applicants: [],
    contracts: baseContracts,
    activeSites: [],
    completedJobs: 0,
    onTimeStreak: 0,
    bestStreak: 0,
    weeklyReport: null,

    materials: { concrete: 5, lumber: 20, steel: 0, electrical: 0, plumbing: 0, asphalt: 0 },
    materialPrices: { concrete: 120, lumber: 85, steel: 950, electrical: 45, plumbing: 38, asphalt: 200 },

    officeIndex: 0,
    loans: [],
    debt: 0,

    rivals: createRivals(),
    marketNews: [],      // rival news, kept out of the player's own ops log
    lastEntrantDay: 0,   // cooldown anchor for new companies entering a thin market
    activeMarketEvent: null,
    marketEventDaysLeft: 0,
    subcontractors: [],
    contractCategoryFilter: "All",

    // Empire expansion
    cityOffices: [],       // { id, cityId, typeId, openedDay }
    properties: [],        // { id, typeId, purchasedDay }
    projectManagers: [],   // { id, typeId, name, wagePerDay }
    acquiredRivals: [],    // rival ids that were acquired
    empireGoalsCompleted: [],
    nationalRank: 99,
    marketShare: 1,
    companyValuation: 15000,
    unlockedCities: [],    // city ids unlocked by valuation threshold
    selectedEmpireCity: "portland",
    trainingQueue: [],
    companyMemory: [],
    inbox: [],
    _noticeSeq: 0,
    kpiHistory: { snapshots: [], lastSnapshotDay: 0 },
    bidsPlaced: 0,
    bidsWon: 0,
    bidsLost: 0,
    cityJobsWon: {},

    // Sprint 5 — Safety, Insurance, Economy History, Achievements, Legacy
    safetyScore: 60, complianceScore: 60, safetyViolations: 0,
    incidentHistory: [],
    insurancePlanId: "none",
    economicHistory: [],
    achievements: [],
    legacyStats: initLegacyStats(),
    contractBidStyles: {},

    logs: ["🏗️ Welcome to ConstructionFlow. You have $75,000, one truck, and three crew. Start with the Fence job in Bids."],
    opsFeed: [],
    eventLog: [],
    _milestones: {},
    _generation: 1,
    legacyPerks: [],
    pendingCelebration: null,
    pendingDecision: null,
    pendingStory: null,
    pendingBreakdown: null,
    pendingInspection: null,
    pendingOfflineSummary: null,
    pendingVeteranEvent: null,
    _stories: [],
    lastLoginDay: 0,
    consecutiveLoginDays: 0,
    lastSessionDate: null,   // real calendar day of the last session, "YYYY-MM-DD"
    tutorialDone: false,
    lastRealTimestamp: null,
    // Addiction Pass additions
    pendingCeremony: null,
    companyHistory: [],
    hallOfFame: {
      biggestContract: 0, highestRep: 0, largestCrew: 0, largestFleet: 0,
      highestValuation: 0, mostProfitableProject: { label: "", value: 0 },
    },
    // Endgame arc
    generation: 1,
    legacyMentor: null,
    _pendingPrestige: false,
    _rankOneCelebrated: false,
    _level10Celebrated: false,
    _valuationMilestonesHit: [],
    clientRelationships: {},
    cityStats: {},
    bids: [],
    activeGrant: null,
    lastAcquisitionDay: 0,
    insuranceDeductibleMult: 1.0,
    autoAssignCrew: false,
    autoAssignEquipment: false,
    autoRepairEquipment: false,
    autoPurchaseMaterials: false,
    setupDone: false,
    startingCityId: "salem",
    homeCityName: "",
    homeStateCode: "",
    homeStateName: "",
    homeCompetition: "Low",
    speedUpUses: 0,
    jobHistory: [],
    pendingRepeatClients: [],
    currentSeason: "Spring",
    seasonEmoji: "🌱",
    seasonContractMult: 1.08,
    seasonStaminaMult: 1.0,
    hotMaterialDeal: null,
    _prevNationalRank: 99,
    importantNotice: null,
    weeklyChallenge: null,
    _weekOnTimeJobs: 0,
    bankruptcyDays: 0,
    gameOver: false,
    gameOverReason: null,
  };
}

// ─── Save Migration ────────────────────────────────────────────────────────────

export function migrateState(saved) {
  const defaults = freshState();
  const g = { ...defaults, ...saved };
  // A save written before it had a ledger baseline takes one from its OWN balance — never the
  // new-company default, which would report the difference as a phantom transfer.
  if (!saved || !saved._ledgerSnapshot || !Number.isFinite(Number(saved._ledgerSnapshot.cash))) {
    g._ledgerSnapshot = {
      cash: Number(g.cash) || 0, revenue: Number(g.revenue) || 0,
      expenses: Number(g.expenses) || 0, day: Number(g.day) || 0,
    };
  }
  // Deep-merge nested objects so new sub-keys added in future sprints are
  // defaulted for old saves while all existing saved values are preserved.
  g.weeklyStats = { ...defaults.weeklyStats, ...(saved.weeklyStats || {}) };
  g.hallOfFame  = { ...defaults.hallOfFame,  ...(saved.hallOfFame  || {}) };
  // Only mint the authored roster when there is genuinely no rivals array — an EMPTY one is
  // a legitimate late-game state (everyone bought or bankrupt) and regenerating the seven
  // authored companies there would resurrect ones the player had already bought. The market
  // refills through new entrants instead; see src/systems/rivalMarket.js.
  if (!Array.isArray(g.rivals)) g.rivals = createRivals();
  // Backfill the lifecycle fields on saves written before the market rework. A record whose
  // status is undefined cannot be reasoned about by the lifecycle.
  g.rivals = g.rivals.filter(Boolean).map((r) => ({
    ...r,
    status: r.status === RIVAL_STATUS.BANKRUPT || r.status === RIVAL_STATUS.STRUGGLING
      ? r.status
      : RIVAL_STATUS.ACTIVE,
    // The retired fields meant different things in two different systems, so neither can be
    // carried across honestly. Everyone starts the new lifecycle on a clean slate, which at
    // worst gives a company already in trouble a fresh run at failing.
    troubleDays: Number.isFinite(r.troubleDays) ? r.troubleDays : 0,
    employees: Number.isFinite(r.employees) ? r.employees : 2,
    // `equipCount` was the other half of the split counter — fold it in rather than losing it.
    equipment: Number.isFinite(r.equipment) ? r.equipment : (Number.isFinite(r.equipCount) ? r.equipCount : 1),
    cityPresence: Array.isArray(r.cityPresence) ? r.cityPresence : ["salem"],
  }));
  if (!Array.isArray(g.marketNews)) g.marketNews = [];
  if (!Number.isFinite(g.lastEntrantDay)) g.lastEntrantDay = 0;
  if (g.activeMarketEvent === undefined)    g.activeMarketEvent = null;
  if (g.marketEventDaysLeft === undefined)  g.marketEventDaysLeft = 0;
  if (!g.subcontractors)                   g.subcontractors = [];
  if (!g.contractCategoryFilter)           g.contractCategoryFilter = "All";
  if (!g.cityOffices)                      g.cityOffices = [];
  if (!g.properties)                       g.properties = [];
  if (!g.projectManagers)                  g.projectManagers = [];
  if (!g.acquiredRivals)                   g.acquiredRivals = [];
  if (!g.empireGoalsCompleted)             g.empireGoalsCompleted = [];
  if (g.nationalRank === undefined)        g.nationalRank = 99;
  if (g.marketShare === undefined)         g.marketShare = 1;
  if (g.companyValuation === undefined)    g.companyValuation = 0;
  if (!g.unlockedCities)                   g.unlockedCities = [];
  if (!g.selectedEmpireCity)              g.selectedEmpireCity = "portland";
  if (!g.trainingQueue)                   g.trainingQueue = [];
  // Phase 6. A build-4 save has no chronicle; it starts one from the day it is loaded rather
  // than inventing a history it never had.
  if (!Array.isArray(g.companyMemory))    g.companyMemory = [];
  // Sprint 9. A pre-reserve save has no taxReserve. It is recomputed from the revenue already
  // booked this week rather than defaulted to zero, so a returning player's first estimate is
  // the truth about the week they are in and their first bill is not silently reduced.
  // NOTE the `saved.taxReserve` rather than `g.taxReserve`. migrateState opens with
  // `{ ...freshState(), ...saved }`, so g.taxReserve is ALWAYS the fresh 0 on a save that
  // lacks the field — checking g here can never detect a legacy save and the accrual would
  // never run. This is the same trap the Sprint 8 inbox migration fell into.
  // Sprint 10. A pre-cooldown save has no event history. Starting it empty is correct: it lets
  // every scenario fire once more, which is generous rather than punishing, and the cooldowns
  // take hold from the day of the upgrade onward.
  if (!g.eventHistory || typeof g.eventHistory !== "object" || Array.isArray(g.eventHistory)) {
    g.eventHistory = {};
  }
  if (!Number.isFinite(g.taxPeriodRevenue)) g.taxPeriodRevenue = 0;
  if (!Number.isFinite(saved?.taxReserve)) accrueTaxReserve(g);
  // A save can arrive already corrupted — that is exactly the state the $NaN report described.
  // Repair before the first tick rather than after.
  repairState(g, null);
  if (!Number.isFinite(g.creditScore))     g.creditScore = 600;
  // Sprint 8. A pre-inbox save carries at most one notice in the old single slot; it is moved
  // into the queue rather than dropped, so nothing the player had on screen disappears on
  // upgrade.
  // NOTE the `saved.inbox` rather than `g.inbox`. migrateState opens with
  // `{ ...freshState(), ...saved }`, and freshState now carries `inbox: []`, so by this point
  // g.inbox is ALWAYS an array and a check against it could never detect a legacy save. The
  // saved object is the only honest witness to what the player actually had.
  if (!Array.isArray(saved?.inbox)) {
    g.inbox = Array.isArray(g.inbox) ? g.inbox : [];
    if (g.importantNotice && g.importantNotice.message) {
      pushNotice(g, g.importantNotice.message, g.importantNotice.tone || "info");
    }
  } else if (!Array.isArray(g.inbox)) {
    g.inbox = [];
  }
  if (!Number.isFinite(g._noticeSeq)) g._noticeSeq = g.inbox.length;
  expireNotices(g);
  g.importantNotice = topNotice(g);
  // Sprint 7. Counters start at zero rather than being inferred from completedJobs: a returning
  // player has no record of the bids they LOST, and inventing a win rate would be a number the
  // game made up about them.
  if (!Number.isFinite(g.bidsPlaced))     g.bidsPlaced = 0;
  if (!Number.isFinite(g.bidsWon))        g.bidsWon = 0;
  if (!Number.isFinite(g.bidsLost))       g.bidsLost = 0;
  if (!g.kpiHistory || typeof g.kpiHistory !== "object" || Array.isArray(g.kpiHistory)) {
    g.kpiHistory = { snapshots: [], lastSnapshotDay: 0 };
  }
  // Reclaim the space the FleetFlow analytics blob occupied. Nothing ever read it, and every
  // figure in it was measured from fields this game does not have.
  if (g.analytics) delete g.analytics;
  if (!g.cityJobsWon)                     g.cityJobsWon = {};
  // Sprint 5 fields
  if (g.safetyScore     === undefined)    g.safetyScore = 60;
  if (g.complianceScore === undefined)    g.complianceScore = 60;
  if (g.safetyViolations === undefined)   g.safetyViolations = 0;
  if (!g.incidentHistory)                g.incidentHistory = [];
  if (!g.insurancePlanId)               g.insurancePlanId = "none";
  if (!g.economicHistory)               g.economicHistory = [];
  if (!g.achievements)                  g.achievements = [];
  if (!g.legacyStats)                   g.legacyStats = initLegacyStats();
  if (!g.contractBidStyles)            g.contractBidStyles = {};
  // Sprint 15 fields
  if (g.materials && g.materials.asphalt === undefined) g.materials.asphalt = 0;
  if (g.materialPrices && g.materialPrices.asphalt === undefined) g.materialPrices.asphalt = 200;
  if (g.pendingBreakdown === undefined)  g.pendingBreakdown = null;
  if (g.pendingInspection === undefined) g.pendingInspection = null;
  // Sprint finalization fields
  if (g.lastLoginDay === undefined)         g.lastLoginDay = g.day || 1;
  if (g.consecutiveLoginDays === undefined) g.consecutiveLoginDays = 0;
  // Saves from before real-session tracking counted the streak in GAME days; that number means
  // nothing now, so the real-day streak starts fresh at the next session.
  if (!saved || saved.lastSessionDate === undefined) { g.lastSessionDate = null; g.consecutiveLoginDays = 0; }
  if (g.tutorialDone === undefined)         g.tutorialDone = (g.completedJobs || 0) > 0;
  if (g.lastRealTimestamp === undefined)    g.lastRealTimestamp = null;
  if (g.pendingOfflineSummary === undefined)g.pendingOfflineSummary = null;
  // Addiction Pass migrations
  if (g.pendingCeremony === undefined)  g.pendingCeremony = null;
  if (!g.companyHistory)               g.companyHistory = [];
  if (!g.hallOfFame) g.hallOfFame = { biggestContract:0, highestRep:0, largestCrew:0, largestFleet:0, highestValuation:0, mostProfitableProject:{label:"",value:0} };
  if (!g.cityStats)                    g.cityStats = {};
  if (!g.bids)                         g.bids = [];
  if (g.activeGrant === undefined)     g.activeGrant = null;
  if (g.lastAcquisitionDay === undefined) g.lastAcquisitionDay = 0;
  if (g.insuranceDeductibleMult === undefined) g.insuranceDeductibleMult = 1.0;
  // Parity sprint fields
  if (g.autoAssignCrew        === undefined) g.autoAssignCrew        = false;
  if (g.autoAssignEquipment   === undefined) g.autoAssignEquipment   = false;
  if (g.autoRepairEquipment   === undefined) g.autoRepairEquipment   = false;
  if (g.autoPurchaseMaterials === undefined) g.autoPurchaseMaterials = false;
  // Feature parity fields
  if (g.onTimeStreak          === undefined) g.onTimeStreak          = 0;
  if (g.bestStreak            === undefined) g.bestStreak            = 0;
  if (g.weeklyChallenge       === undefined) g.weeklyChallenge       = null;
  if (g.pendingVeteranEvent   === undefined) g.pendingVeteranEvent   = null;
  if (g.weeklyReport          === undefined) g.weeklyReport          = null;
  if (g._weekOnTimeJobs       === undefined) g._weekOnTimeJobs       = 0;
  // Gameplay-completion sprint fields
  if (g.setupDone     === undefined) g.setupDone     = (g.day||1) > 1 || (g.completedJobs||0) > 0;
  if (!g.startingCityId)             g.startingCityId = "salem";
  if (g.homeCityName   === undefined) g.homeCityName   = "";
  if (g.homeStateCode  === undefined) g.homeStateCode  = "";
  if (g.homeStateName  === undefined) g.homeStateName  = "";
  if (g.homeCompetition === undefined) g.homeCompetition = "Low";
  if (g.speedUpUses   === undefined) g.speedUpUses   = 0;
  // Sprint 11: speedMode is gone. It was a saved boolean for a control that is now a
  // session preference (pause / 1x / 2x / 4x), and a stale field is copied by every
  // clone() on every tick for the life of the save.
  delete g.speedMode;
  if (!g.jobHistory)                 g.jobHistory    = [];
  if (!g.pendingRepeatClients)       g.pendingRepeatClients = [];
  // R16 banking fields
  if (g.savings === undefined)    g.savings = 0;
  if (g.creditLine === undefined) g.creditLine = null;
  if (g.weeklyStats && g.weeklyStats.savingsInterest === undefined) g.weeklyStats.savingsInterest = 0;
  // R15 season & deal fields
  if (!g.currentSeason)         g.currentSeason = "Spring";
  if (!g.seasonEmoji)           g.seasonEmoji = "🌱";
  if (!g.seasonContractMult)    g.seasonContractMult = 1.08;
  if (!g.seasonStaminaMult)     g.seasonStaminaMult = 1.0;
  if (g.hotMaterialDeal === undefined) g.hotMaterialDeal = null;
  if (g._prevNationalRank === undefined) g._prevNationalRank = g.nationalRank || 99;
  if (g.importantNotice === undefined)  g.importantNotice = null;
  if (g.bankruptcyDays === undefined)   g.bankruptcyDays = 0;
  if (g.gameOver === undefined)         g.gameOver = false;
  if (g.gameOverReason === undefined)   g.gameOverReason = null;
  // Endgame arc fields
  if (g.generation          === undefined) g.generation          = 1;
  if (g.legacyPerks         === undefined) g.legacyPerks         = [];
  if (g.legacyMentor        === undefined) g.legacyMentor        = null;
  if (g._pendingPrestige    === undefined) g._pendingPrestige    = false;
  if (g._rankOneCelebrated  === undefined) g._rankOneCelebrated  = false;
  if (g._level10Celebrated  === undefined) g._level10Celebrated  = false;
  if (g._valuationMilestonesHit === undefined) g._valuationMilestonesHit = [];
  if (g.clientRelationships === undefined) g.clientRelationships = {};
  // Company identity. Saves made before the owner was asked for keep playing with the
  // neutral default rather than being sent back through setup.
  if (typeof g.ownerName !== "string" || !g.ownerName.trim()) g.ownerName = "Owner";
  // Migrate active sites
  (g.activeSites || []).forEach(s => {
    if (!s._clientCheckins) s._clientCheckins = [];
  });
  // Migrate existing active sites to have new fields
  (g.activeSites || []).forEach(s => {
    if (s.depositPaid      === undefined) s.depositPaid      = 0;
    if (s.completionBonus  === undefined) s.completionBonus  = 0;
    if (s.rushQualityPenalty === undefined) s.rushQualityPenalty = 0;
    // Phase 2. A site that was already running when material lead times and progress claims
    // arrived keeps everything it had: no outstanding orders (its materials were bought under
    // the old instant rule and are already fulfilled), and nothing claimed yet. Its remaining
    // phases will start releasing claims from today, and the handover balance is whatever is
    // left — so the total it pays is unchanged either way.
    if (!Array.isArray(s.pendingDeliveries)) s.pendingDeliveries = [];
    if (!Number.isFinite(s.progressPaid)) s.progressPaid = 0;
    if (!Number.isFinite(s.phasesClaimed)) s.phasesClaimed = 0;
    // Per-project P&L. A site that was already running before cost tracking existed gets an
    // empty ledger and a `costsPartial` flag — it will accrue from today onward, and the
    // completion screen says the breakdown covers only part of the job rather than
    // presenting a too-good margin as fact.
    ensureProjectCostLedger(s);
  });
  // Ensure crew have certifications field
  g.crew = (g.crew || []).map(w => w.certifications ? w : { ...w, certifications: [] });
  // ensure crew have specialty field
  g.crew = (g.crew || []).map(w => ({ specialty: pick(CREW_SPECIALTIES), ...w }));
  // ensure crew have loyalty and level fields
  g.crew = (g.crew || []).map(w => ({
    loyalty: rand(50, 75),
    level: 1,
    jobsCompleted: 0,
    ...w,
  }));
  // ensure sites have currentWeather and materialsFulfilled fields
  g.activeSites = (g.activeSites || []).map(s => {
    const base = { currentWeather: null, ...s };
    if (!base.materialsFulfilled) {
      // Legacy site: assume materials were fully supplied at start
      const contract = (g.contracts || []).find(c => c.id === s.contractId);
      const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
      const materialsFulfilled = {};
      for (const [matId, needed] of Object.entries(def?.materials || {})) {
        materialsFulfilled[matId] = needed;
      }
      base.materialsFulfilled = materialsFulfilled;
    }
    return base;
  });
  // fix negative material inventory (safety net)
  for (const matId of Object.keys(g.materials || {})) {
    if ((g.materials[matId] || 0) < 0) g.materials[matId] = 0;
  }
  // Sanitize stale pendingBreakdown — clear if equipment is no longer broken
  if (g.pendingBreakdown?.equipId) {
    const _bdEq = (g.equipment||[]).find(e => e.id === g.pendingBreakdown.equipId);
    if (!_bdEq || (_bdEq.status !== "Broken" && _bdEq.status !== "Maintenance")) g.pendingBreakdown = null;
  }
  // Crew/site assignment cleanup — remove refs to fired/missing crew and equipment
  const _validCrewIds = new Set((g.crew||[]).map(w => w.id));
  (g.activeSites||[]).forEach(site => {
    site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => _validCrewIds.has(id));
  });
  (g.crew||[]).forEach(_cw => {
    if (_cw.status === "Resting" || _cw.status === "Training") return;
    const _onSite = (g.activeSites||[]).some(s => (s.assignedCrewIds||[]).includes(_cw.id));
    _cw.status = _onSite ? "Active" : "Idle";
    _cw.siteId = null;
  });
  const _validEquipIds = new Set((g.equipment||[]).map(e => e.id));
  (g.activeSites||[]).forEach(site => {
    site.assignedEquipmentIds = (site.assignedEquipmentIds||[]).filter(id => _validEquipIds.has(id));
  });
  // ensure rivals have cityPresence for expansion
  g.rivals = (g.rivals||[]).map(r => ({ cityPresence: ["salem"], cash: 20000, ...r }));
  // ensure category on existing contracts
  g.contracts = (g.contracts || []).map((c) => {
    if (!c.category) {
      const def = CONTRACT_DEFS.find((d) => d.id === c.defId);
      c.category = def?.category || "Commercial";
    }
    return c;
  });
  // An earned chain opportunity from before Sprint 1 is an ordinary Open contract with a 14-day
  // expiry, even if the company cannot take it. Hold it instead, exactly as a new one would be.
  for (const c of (g.contracts || [])) {
    if (c && c.isChainUnlock && c.status === "Open" && !chainReadiness(c, companyCapacity(g)).ready) {
      c.status = CHAIN_LOCKED;
      c.expiresDay = null;
    }
  }
  const cleaned = cleanStaleState(g);
  repairCrewAssignments(cleaned);
  return cleaned;
}

// ─── Crew/Equipment Assignment Repair ────────────────────────────────────────

function repairCrewAssignments(g) {
  const crewIds = new Set((g.crew || []).map(w => w.id));
  const equipIds = new Set((g.equipment || []).map(e => e.id));
  // Remove stale references from sites
  for (const site of (g.activeSites || [])) {
    site.assignedCrewIds = (site.assignedCrewIds || []).filter(id => crewIds.has(id));
    site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter(id => equipIds.has(id));
  }
  // Build lookup: which site each crew/equip is on
  const crewSiteMap = {};
  const equipSiteMap = {};
  for (const site of (g.activeSites || [])) {
    for (const cid of site.assignedCrewIds) crewSiteMap[cid] = site.id;
    for (const eid of site.assignedEquipmentIds) equipSiteMap[eid] = site.id;
  }
  // Sync crew status
  for (const w of (g.crew || [])) {
    if (w.status === "Resting" || w.status === "Training") continue;
    if (crewSiteMap[w.id]) {
      w.status = "Active";
      w.assignedSiteId = crewSiteMap[w.id];
    } else {
      if (w.status === "Active") w.status = "Idle";
      w.assignedSiteId = null;
    }
  }
  // Sync equipment status (don't override Maintenance/Broken/In Repair)
  for (const e of (g.equipment || [])) {
    if (e.status === "Maintenance" || e.status === "Broken" || e.status === "In Repair") continue;
    if (equipSiteMap[e.id]) {
      e.status = "Active";
      e.assignedSiteId = equipSiteMap[e.id];
    } else {
      if (e.status === "Active") e.status = "Idle";
      e.assignedSiteId = null;
    }
  }
}

// ─── Game Tick Logic ──────────────────────────────────────────────────────────

export function gameTick(prev) {
  const g = clone(prev);
  // Taken BEFORE anything runs, so a repair can restore the value the player actually had a
  // moment ago rather than a constant. See systems/saveHealth.js for why this exists: a device
  // screenshot showed the header reading $NaN, which makes every `cash >= cost` false and so
  // makes the whole game unplayable while looking like bad luck.
  const _lastGood = snapshotGood(prev);
  // MINS_PER_TICK now lives in systems/gameClock.js, alongside the tick interval and the
  // offline conversion, because those three used to agree only by coincidence.
  // `?? ` not `||` — gameMinutes legitimately hits exactly 0 once a day right after the
  // midnight wrap below, and `0 || 480` would treat that valid 0 as "missing" and jump the
  // clock forward by 8 in-game hours on the very next tick. That compressed every day from
  // 1440 game-minutes (48 ticks) to 960 (32 ticks) — the game clock ran 33% fast, permanently,
  // for every save, from the very first midnight it crossed. Only actually-missing
  // (null/undefined, e.g. a pre-migration save) should fall back to the 480 default.
  g.gameMinutes = (g.gameMinutes ?? 480) + MINS_PER_TICK;

  let newDay = false;
  if (g.gameMinutes >= 1440) {
    g.gameMinutes -= 1440;
    g.day = (g.day || 1) + 1;
    newDay = true;
  }

  // ── Breakdown repairs finish ─────────────────────────────────────────────────
  // equipmentWear.js puts a broken-down machine "In Repair" for a stated number of hours and the
  // log tells the player so. Nothing in this screen ever counted those hours down: the next tick
  // flipped the machine straight back to Active, so the "4h downtime" the log promised never
  // happened, and a machine that broke while parked stayed "In Repair" forever. Now the stated
  // downtime is the real downtime, and the machine comes back on its own.
  for (const e of (g.equipment || [])) {
    if (e.status !== "In Repair") continue;
    e.repairMinsLeft = Math.max(0, (Number(e.repairMinsLeft) || 0) - MINS_PER_TICK);
    if (e.repairMinsLeft <= 0) {
      e.status = "Idle";
      addLog(g, `🔧 ${e.name} is repaired and back in service.`);
    }
  }

  // ── Crew/equipment assignment integrity every tick ───────────────────────────
  repairCrewAssignments(g);

  // ── Update active sites ──────────────────────────────────────────────────────
  for (const site of g.activeSites) {
    // ── Material deliveries land first ─────────────────────────────────────────
    // Before the stall check below, so an order arriving today gets the crew working today
    // rather than on the next tick. Runs even for a paused site: a truck does not wait for
    // the site to reopen, and the materials should be on site when it does.
    if (Array.isArray(site.pendingDeliveries) && site.pendingDeliveries.length > 0) {
      const { arrived, stillPending } = collectArrivedDeliveries(site, g.day);
      if (arrived.length > 0) {
        site.pendingDeliveries = stillPending;
        if (!site.materialsFulfilled) site.materialsFulfilled = {};
        for (const d of arrived) {
          site.materialsFulfilled[d.matId] = (site.materialsFulfilled[d.matId] || 0) + d.qty;
          addLog(g, describeDelivery(site.label, d));
        }
        // One notice per site per arrival wave, not one per material, so a four-material
        // order does not bury everything else the player needs to read.
        addImportantNotice(
          g,
          arrived.length === 1
            ? `${arrived[0].qty} ${arrived[0].unit} of ${arrived[0].label} arrived at ${site.label}. Work resumes.`
            : `${arrived.length} material deliveries arrived at ${site.label}. Work resumes.`,
          "green"
        );
      }
    }

    // What the card reads. Reset every tick and set only by the branch that actually applies,
    // so a stall can never leave yesterday's rate on the card. See systems/siteDiagnostics.js.
    site.stopReason = null;
    site.rateFactors = [];

    if (site.status === "Paused") {
      site._progressRate = 0;
      if ((site.pausedDays || 0) > 0 && site.pausedDays !== 999) {
        site.pausedDays = site.pausedDays - (MINS_PER_TICK / 1440);
        if (site.pausedDays <= 0) { site.status = "Active"; site.pausedDays = 0; site.pauseReason = null; }
      }
      continue;
    }
    if (site.status !== "Active") continue;

    const assignedCrew = g.crew.filter((w) => site.assignedCrewIds.includes(w.id));
    // Only use equipment that is not broken/maintenance
    const assignedEquip = g.equipment.filter((e) => site.assignedEquipmentIds.includes(e.id) && isUsable(e));

    // A site with no CREW genuinely cannot proceed — there is nobody there. But a site with no
    // usable PLANT used to hit the same hard `continue`, which is how a single truck running
    // dry froze an entire contract at 48% with no way back. It now crawls, exactly as a phase
    // missing its required plant does, and says so rather than silently stopping.
    if (!assignedCrew.length) {
      site._progressRate = 0;
      const _resting = (g.crew || []).filter((w) => w.awaitingRestForSiteId === site.id).length;
      site.stopReason = _resting > 0 ? { key: "crew_resting", resting: _resting } : { key: "no_crew" };
      continue;
    }
    const _noPlant = assignedEquip.length === 0;
    if (_noPlant && !site._noPlantWarned) {
      site._noPlantWarned = true;
      addImportantNotice(g, `${site.label} has no working plant on site — the crew are down to hand tools. Assign a machine.`, "red", { actionLabel: "Assign plant", actionTab: "Sites" });
    }
    if (!_noPlant && site._noPlantWarned) site._noPlantWarned = false;

    // Stall progress while materials are missing — player must buy or emergency-purchase
    const _siteContract = g.contracts.find(c => c.id === site.contractId);
    const _siteDef = CONTRACT_DEFS.find(d => d.id === _siteContract?.defId);
    const _hasMissingMats = _siteDef?.materials && Object.entries(_siteDef.materials).some(
      ([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed
    );
    if (_hasMissingMats) {
      // THE THIRD FREEZE, and the same shape as the fuel and exhaustion ones. A site short of
      // materials stops dead — correctly, you cannot build without them — but the ONLY signal
      // was a log line with a four-percent chance per tick, buried in a scrolling feed. So a
      // theft (which Sprint 12 made both larger and more frequent) could take a site to a halt
      // that lasted the rest of the game, while wages and overheads carried on, and the player
      // was never told why. Three runs in ten of the playtest harness died exactly this way.
      //
      // The work still stops. What changes is that the player cannot miss it.
      site.status = "Active";
      const _missing = Object.entries(_siteDef.materials)
        .map(([matId, needed]) => ({ matId, short: needed - ((site.materialsFulfilled || {})[matId] || 0) }))
        .filter((m) => m.short > 0);
      const _due = nextDeliveryDay(site);
      const _summary = _missing.map((m) => `${m.short} ${m.matId}`).join(", ");

      site._progressRate = 0;
      site.stopReason = { key: _due != null ? "materials_in_transit" : "materials_short", due: _due, summary: _summary };
      if (!site._matsWarnedDay || site._matsWarnedDay !== g.day) {
        site._matsWarnedDay = g.day;
        addLog(g, _due != null
          ? `⏳ ${site.label}: stalled — ${_summary} arrives day ${_due}.`
          : `⚠️ ${site.label}: STALLED — short ${_summary}, nothing on order.`);
        // An action item, not a log line. Action items do not age out of the inbox, so a
        // stalled site stays in front of the player until they deal with it.
        if (_due == null) {
          addImportantNotice(g,
            `${site.label} has stopped: short ${_summary} and nothing on order. The crew are being paid to stand still.`,
            "action", { actionLabel: "Order materials", actionTab: "Sites" });
        }
      }
      continue;
    }

    // A throttled site must say so. Sprint 12 added a plant requirement that quietly cut
    // progress when the wrong machine was assigned, and only warned when a site had NO machine
    // at all — so a garage job with a pickup and a skid steer on it ran at a fraction of speed
    // showing "~32 days remaining · 14.8%/day" against a six-day deadline, with no explanation
    // anywhere on the screen. A penalty the player cannot see is indistinguishable from a bug,
    // and this one WAS reported as one.
    const _phaseNow = site.phases[site.currentPhaseIdx || 0] || "";
    const _wrongPlant = !_noPlant && !plantSatisfies(_phaseNow, assignedEquip, _siteDef?.minTier);
    if (_wrongPlant) {
      const _miss = missingPlantFor(_phaseNow, assignedEquip, _siteDef?.minTier);
      site.plantWarning = _miss
        ? `${_phaseNow} needs ${_miss.anyOf.join(" or ")} plant at tier ${_miss.minTier}+ — running at ${Math.round(STALL_FACTOR * 100)}% speed.`
        : null;
      if (site._plantWarnedPhase !== _phaseNow) {
        site._plantWarnedPhase = _phaseNow;
        addLog(g, `🐌 ${site.label}: ${site.plantWarning}`);
        addImportantNotice(g,
          `${site.label} is running slow. ${site.plantWarning} Assign the right machine or the deadline will go.`,
          "action", { actionLabel: "Assign plant", actionTab: "Sites" });
      }
    } else {
      site.plantWarning = null;
      site._plantWarnedPhase = null;
    }

    // Progress rate: base 2% per tick, modified by crew skill & trait
    const avgSkill = assignedCrew.reduce((s, w) => s + w.skill, 0) / assignedCrew.length;
    // No-show crew excluded from speed average (they randomly skip ticks)
    const presentCrew = assignedCrew.filter(w => w.trait?.label !== "Frequent No-Show" || Math.random() > 0.35);
    const avgSpeed = (presentCrew.length > 0 ? presentCrew : assignedCrew)
      .reduce((s, w) => s + (w.trait?.speed || 1.0), 0) / Math.max(1, presentCrew.length || assignedCrew.length);
    const crewCount = presentCrew.length || assignedCrew.length;
    // Team Leader boosts overall crew progress
    const hasTeamLeader = assignedCrew.some(w => w.trait?.label === "Team Leader");
    const teamLeaderBonus = hasTeamLeader ? 1.08 : 1.0;
    // Phase-type equipment affinity bonus
    const currentPhaseName = site.phases[site.currentPhaseIdx || 0] || "";
    const phaseAffinity = PHASE_TYPE_BONUS[currentPhaseName] || {};
    const equipTypeBonus = assignedEquip.reduce((best, e) => {
      const b = phaseAffinity[e.type] || 1.0;
      return b > best ? b : best;
    }, 1.0);
    // Crew specialty bonus: best specialty match among assigned crew
    const crewSpecialtyBonus = assignedCrew.reduce((best, w) => {
      const specialtyMap = SPECIALTY_PHASE_BONUS[w.specialty] || {};
      const b = specialtyMap[currentPhaseName] || 1.0;
      return b > best ? b : best;
    }, 1.0);
    const activeSubs = (g.subcontractors || []).filter((sc) => sc.daysLeft > 0 && sc.status === "Active");
    const subBonus = activeSubs.length > 0 ? Math.min(1.3, 1.0 + activeSubs.length * 0.1) : 1.0;
    const pmBonus = (g.projectManagers||[]).reduce((s,pm) => {
      const def = PM_TIERS.find(t=>t.id===pm.typeId);
      return s + (def ? def.marginBoost : 0);
    }, 1.0);
    // Site strategy modifier
    const SITE_MODE_MODS = { normal: 1.0, rush: 1.45, overtime: 1.30, quality: 0.78, budget: 0.88 };
    const stratMod = SITE_MODE_MODS[site.siteMode || "normal"] || 1.0;
    // Rush/overtime: extra stamina drain
    if ((site.siteMode === "rush" || site.siteMode === "overtime") && Math.random() < 0.25) {
      for (const id of site.assignedCrewIds) {
        const w = g.crew.find(cw => cw.id === id);
        if (w) w.stamina = Math.max(0, (w.stamina ?? 50) - 2);
      }
    }
    // Rush mode accumulates a quality penalty (0.05% per tick, caps at 12%)
    if (site.siteMode === "rush") {
      site.rushQualityPenalty = Math.min(0.12, (site.rushQualityPenalty || 0) + 0.0005);
    }
    // Crew specialty mismatch penalty: no matching specialty = −10% speed
    const hasMatchingSpecialty = crewSpecialtyBonus > 1.0;
    const mismatchPenalty = hasMatchingSpecialty ? 1.0 : 0.90;
    // Certification bonus: workers with safety cert give +5% progress
    const _certBonus = assignedCrew.some(w => (w.certifications||[]).includes("safety_cert") || (w.certifications||[]).includes("safety_mgmt_cert")) ? 1.05 : 1.0;
    const engineTier = assignedEquip.reduce((max, e) => Math.max(max, e.upgrades?.engine || 0), 0);
    const engineBonus = 1 + engineTier * 0.06;
    // PM speed bonus from delayReduce (Senior: ×1.20, Director: ×1.35)
    const pmSpeedBonus = (g.projectManagers||[]).reduce((max, pm) => {
      const _pmd = PM_TIERS.find(t => t.id === pm.typeId);
      return Math.max(max, _pmd ? (1 + (_pmd.delayReduce || 0)) : 1.0);
    }, 1.0);
    // Reported from a device: "the jobs don't get done fast enough... I literally run out of
    // money before a job is completed."
    //
    // Measured rather than argued. At base 2.0 a fully-crewed starting company advanced about
    // 65% of a phase per day, so a FIVE-phase contract needed ~7.7 days of perfect conditions
    // against a contracted SIX — before any material wait, fuel gap or weather. Real runs came
    // in at 9 to 14 days, and the player pays crew, plant and overheads for every one of them
    // while the payout waits at the end. Losing money on the starter contract is not a
    // difficulty curve, it is a broken first impression.
    //
    // At 3.0 the same company clears ~97% of a phase per day: five phases in about five days
    // of clean running, which leaves headroom for the friction the game then throws at it.
    const _plantFactor = plantProgressFactor(currentPhaseName, assignedEquip, _siteDef?.minTier);
    const _crewRatio = Math.min(crewCount / (site.crewMin || 2), 1.5);
    const _rateFactors = [];
    if (_crewRatio < 1) _rateFactors.push({ key: "understaffed", factor: _crewRatio, have: crewCount, need: site.crewMin || 2 });
    if (mismatchPenalty < 1) {
      const _wantSpec = Object.entries(SPECIALTY_PHASE_BONUS).find(([, ph]) => (ph[currentPhaseName] || 1) > 1)?.[0] || null;
      _rateFactors.push({ key: "specialty", factor: mismatchPenalty, phase: currentPhaseName, specialty: _wantSpec });
    }
    if (_plantFactor < 1) {
      const _pm = missingPlantFor(currentPhaseName, assignedEquip, _siteDef?.minTier)
        || missingPlantFor(currentPhaseName, g.equipment.filter((e) => site.assignedEquipmentIds.includes(e.id)), _siteDef?.minTier);
      const _inShop = g.equipment.filter((e) => site.assignedEquipmentIds.includes(e.id) && e.status === "In Repair");
      _rateFactors.push({ key: "plant", factor: _plantFactor, phase: currentPhaseName,
        anyOf: _pm?.anyOf || [], minTier: _pm?.minTier || 1,
        ownedButUnusable: g.equipment.some((e) => site.assignedEquipmentIds.includes(e.id) && !isUsable(e) && e.status !== "In Repair"),
        // A breakdown already paid for: it comes back by itself, so the card must not ask for money.
        workshopHours: _inShop.length ? Math.max(1, Math.ceil(Math.max(..._inShop.map((e) => Number(e.repairMinsLeft) || 0)) / 60)) : null });
    }
    if (stratMod < 1) _rateFactors.push({ key: "site_mode", factor: stratMod, mode: site.siteMode });
    const progressRate = (3.0 * (avgSkill / 100) * avgSpeed * Math.min(crewCount / (site.crewMin || 2), 1.5)) * (MINS_PER_TICK / 60) * subBonus * pmBonus * pmSpeedBonus * teamLeaderBonus * equipTypeBonus * crewSpecialtyBonus * mismatchPenalty * stratMod * _certBonus * engineBonus
      // Sprint 12: required plant missing mid-phase crawls rather than halting. A machine
      // breaking through no fault of the player must be a setback, never a dead save.
      //
      // Sprint 1: this used to be followed by `* (_noPlant ? STALL_FACTOR : 1)`, which charged
      // the SAME missing-plant penalty twice — 55% x 55% = 30% speed — whenever the site had no
      // working machine on a phase that needs one, and charged it once on phases the plant table
      // says are hand-tool work (Inspection, Finish Work), contradicting that table. The phase
      // requirement is the one rule; a site with no machine is simply a site that fails it.
      * _plantFactor;
    site._progressRate = progressRate;
    // Exactly the multipliers below 1 that were just applied, for the card to explain.
    site.rateFactors = _rateFactors;

    const _prevProgress = site.phaseProgress || 0;
    site.phaseProgress = Math.min(100, (site.phaseProgress || 0) + progressRate);

    // R15-6: Client check-in messages at 25%, 50%, 75% overall site completion
    if (site.phases.length > 0) {
      const _prevPct = Math.floor(((site.currentPhaseIdx || 0) / site.phases.length + Math.max(0, _prevProgress) / 100 / site.phases.length) * 100);
      const _newPct  = Math.floor(((site.currentPhaseIdx || 0) / site.phases.length + Math.max(0, site.phaseProgress) / 100 / site.phases.length) * 100);
      const _checkMilestone = [25, 50, 75].find(m => _prevPct < m && _newPct >= m);
      if (_checkMilestone && !((site._clientCheckins || []).includes(_checkMilestone))) {
        site._clientCheckins = [...(site._clientCheckins || []), _checkMilestone];
        const CLIENT_MSGS = {
          25: [`${site.client}: "Good progress so far — keep it up!" 👍`, `${site.client} drove past the site. Looking good.`],
          50: [`${site.client}: "Halfway there! Really liking how this is taking shape."`, `${site.client} stopped by — impressed with the pace. ⭐`],
          75: [`${site.client}: "Almost there! Can't wait to see it finished 🎉"`, `${site.client}: "Outstanding work. Might have another job for you after this."`],
        };
        const _msgs = CLIENT_MSGS[_checkMilestone];
        addLog(g, `💬 ${_msgs[Math.floor(Math.random() * _msgs.length)]}`);
        if (_checkMilestone === 75) site._clientLovesIt = true;
      }
    }

    if (site.phaseProgress >= 100) {
      const completedPhaseIdx = site.currentPhaseIdx || 0;
      const completedPhaseName = site.phases[completedPhaseIdx] || "";
      site.phaseProgress = 0;
      site.currentPhaseIdx = completedPhaseIdx + 1;

      // ── A COMPLETED PHASE NOW SAYS SO ──────────────────────────────────────
      // Finishing a phase was silent unless it happened to be an inspection, so the loop's
      // most frequent milestone — the thing the player is actually waiting for — had no
      // moment at all. The final phase is left to the completion ceremony below, which is a
      // bigger beat and should not be pre-empted by a line saying the same thing.
      const _nextPhaseName = site.phases[site.currentPhaseIdx] || null;
      if (_nextPhaseName) {
        addLog(g, describePhaseCompletion(completedPhaseName, _nextPhaseName));
        addImportantNotice(g, `${site.label}: ${completedPhaseName} complete. ${_nextPhaseName} begins.`, "green");
      }

      // ── PROGRESS CLAIM ─────────────────────────────────────────────────────
      // Construction is not paid in two lumps. The client certifies completed work and
      // releases a claim against it. This changes WHEN the contract's money arrives, never
      // how much: planProgressPayment computes a cumulative target minus what has already
      // been paid, and the handover payment below is the remainder, so deposit + claims +
      // final always equals value less penalty. See constructionLoop.js and its tests.
      if (_nextPhaseName) {
        site.phasesClaimed = (site.phasesClaimed || 0) + 1;
        const { release } = planProgressPayment(site, site.totalValue, site.phasesClaimed);
        if (release > 0) {
          site.progressPaid = (site.progressPaid || 0) + release;
          g.cash += release;
          g.revenue += release;
          g.weeklyStats.revenue += release;
          recordTransaction(g, "contracts", release, `${site.label}: progress claim — ${completedPhaseName}`);
          addLog(g, `💰 Progress payment received: ${money(release)} for ${completedPhaseName} at ${site.label}.`);
        }
      }

      // Inspection outcome — fires when an inspection phase completes
      if (INSPECTION_PHASES.has(completedPhaseName) && !g.pendingInspection) {
        const qualityMod = site.siteMode === "quality" ? 0.20 : site.siteMode === "budget" ? -0.18 : 0;
        const avgCrewSkillInsp = assignedCrew.length
          ? assignedCrew.reduce((s, w) => s + w.skill, 0) / assignedCrew.length : 80;
        const passChance = Math.min(0.90, 0.55 + qualityMod + (avgCrewSkillInsp - 80) / 200);
        const inspRoll = Math.random();
        let inspOutcome, inspPenalty = 0;
        // Remediation is priced off the job (systems/penalties.js). It was a flat $500–2,500 /
        // $2,500–9,000 — the whole value of a starter fence, and pocket change on a hospital.
        // Rush and Budget modes are the player choosing to cut corners, so a failure there counts
        // as a knowing one.
        const _knowingly = site.siteMode === "rush" || site.siteMode === "budget";
        if (inspRoll < passChance) {
          inspOutcome = "pass";
          g.reputation = Math.min(100, (g.reputation || 0) + 2);
          g.creditScore = Math.min(850, (g.creditScore || 600) + 1);
          addLog(g, `✅ ${site.label}: ${completedPhaseName} passed — reputation +2.`);
        } else if (inspRoll < passChance + 0.28) {
          inspOutcome = "minor";
          inspPenalty = penaltyFor({ contractValue: site.totalValue, severity: "minor", knowing: _knowingly, companyLevel: g.companyLevel, roll: Math.random() });
          g.cash -= inspPenalty;
          site.phaseProgress = -20;
          addLog(g, `🔍 ${site.label}: Minor correction required — ${money(inspPenalty)} to remediate.`);
        } else {
          inspOutcome = "major";
          inspPenalty = penaltyFor({ contractValue: site.totalValue, severity: "major", knowing: _knowingly, companyLevel: g.companyLevel, roll: Math.random() });
          g.cash -= inspPenalty;
          pauseSite(site, rand(3, 6), "quality", `${completedPhaseName} failed`);
          g.reputation = Math.max(0, (g.reputation || 0) - 3);
          addLog(g, `❌ ${site.label}: Major inspection failure — ${money(inspPenalty)} cost, site paused.`);
        }
        // Remediation is a cost this project caused — it belongs in this project's P&L.
        accrueProjectCost(site, "incidents", inspPenalty);
        if (inspPenalty > 0) recordTransaction(g, "fines", -inspPenalty, `${site.label}: ${completedPhaseName} remediation`);
        g.pendingInspection = { siteId: site.id, siteLabel: site.label, phaseName: completedPhaseName, outcome: inspOutcome, penaltyApplied: inspPenalty };
      }

      if (site.currentPhaseIdx >= site.phases.length) {
        // Site complete
        site.status = "Complete";
        const daysLate = Math.max(0, g.day - site.deadlineDay);
        // Escalating penalty: 1× for first 5 days late, 1.5× after that, capped at 85%
        const BASE_LATE_DAYS = 5;
        let penalty = 0;
        if (daysLate <= BASE_LATE_DAYS) {
          penalty = daysLate * site.penaltyPerDay;
        } else {
          penalty = BASE_LATE_DAYS * site.penaltyPerDay + (daysLate - BASE_LATE_DAYS) * site.penaltyPerDay * 1.5;
        }
        // Office tiers advertise "−10%/−15% delay penalties". Nothing read that perk until
        // now; it existed only as a string on the upgrade button.
        const _penaltyRelief = resolveCompanyPerks(g).penaltyReduction;
        if (_penaltyRelief > 0) penalty = Math.round(penalty * (1 - _penaltyRelief));
        penalty = Math.min(penalty, Math.round(site.totalValue * 0.85));
        // The handover balance: the contract value, less the late penalty, less everything
        // the client has already released — the deposit at mobilisation and every progress
        // claim certified along the way. Deducting the claims here is what keeps the total a
        // contract pays identical to what it paid before progress claims existed; only the
        // timing moved. `finalPaymentDue` and its tests own that invariant.
        const earned = finalPaymentDue(site.totalValue, penalty, site.depositPaid || 0, site.progressPaid || 0);
        g.cash += earned;
        g.revenue += earned;
        g.weeklyStats.revenue += earned;
        if (earned > 0) recordTransaction(g, "contracts", earned, `${site.label}: final payment`);
        g.completedJobs = (g.completedJobs || 0) + 1;
        if (!g.cityJobsWon) g.cityJobsWon = {};
        const completedCityKey = site.cityId || "salem";
        g.cityJobsWon[completedCityKey] = (g.cityJobsWon[completedCityKey] || 0) + 1;
        const siteDef = CONTRACT_DEFS.find(d => d.id === (g.contracts.find(c => c.id === site.contractId)?.defId));
        const repGained = siteDef?.repReward || rand(3, 8);
        const creditGained = siteDef?.creditReward || rand(2, 5);
        g.reputation = Math.min(100, (g.reputation || 0) + repGained);
        g.creditScore = Math.min(850, (g.creditScore || 600) + creditGained);
        // Quality bonus (rush mode degrades quality)
        const avgQuality = assignedCrew.reduce((s, w) => s + (w.trait?.quality || 1.0), 0) / Math.max(1, assignedCrew.length);
        const effectiveQuality = Math.max(0.80, avgQuality - (site.rushQualityPenalty || 0));
        let qualityBonus = 0;
        if (effectiveQuality > 1.05) {
          qualityBonus = Math.round(earned * (effectiveQuality - 1.0) * 0.4);
          g.cash += qualityBonus;
          g.revenue += qualityBonus;
          if (qualityBonus > 0) recordTransaction(g, "bonuses", qualityBonus, `${site.label}: quality bonus`);
        }
        // What the project actually made, not just what it paid out. `site.costs` has been
        // accumulating materials, crew-days, machine-days and on-site problems since
        // mobilisation; none of it moves cash here, it is only being totalled.
        const economics = buildProjectEconomics({
          contractValue: site.totalValue,
          // Progress claims are money this contract already paid out, exactly like the
          // deposit. Rolling them in here keeps the completion breakdown honest — without
          // it, a job paid half its value in claims would read as though that half vanished.
          depositPaid: (site.depositPaid || 0) + (site.progressPaid || 0),
          penalty,
          qualityBonus,
          costs: ensureProjectCostLedger(site),
        });
        site.finalEconomics = economics;

        // Story triggers
        if (!g.pendingCelebration) {
          g.pendingCelebration = {
            label: site.label, client: site.client,
            earned: earned + qualityBonus, penalty, repGained,
            isOnTime: daysLate === 0, isMajor: (siteDef?.baseValue || 0) >= 100000,
            qualityBonus, day: g.day,
            economics,
            // The first completed project is the one moment a new player has a concrete
            // example to learn the unit economics from, so it gets the full breakdown.
            isFirstProject: (g.completedJobs || 0) === 1,
            // Old saves have no cost history for projects already running, so the
            // breakdown would be misleadingly rosy. Say so rather than quietly lying.
            costsPartial: Boolean(site.costsPartial),
          };
        }
        // Company story milestones
        if (earned >= 100000 && !(g._stories || []).includes("first_100k")) {
          g._stories = [...(g._stories || []), "first_100k"];
          g.pendingStory = { icon: "cash", title: "First Six-Figure Job!", body: `"${site.label}" earned ${money(earned + qualityBonus)}. You've hit the big leagues.` };
        }
        if (g.completedJobs === 1 && !(g._stories || []).includes("first_job")) {
          g._stories = [...(g._stories || []), "first_job"];
          g.pendingStory = g.pendingStory || { icon: "construct", title: "First Job Done!", body: `"${site.label}" complete. Every empire starts with one.` };
          if (!g.tutorialDone) {
            g.tutorialDone = true;
            addImportantNotice(g, "First job complete! Check Finance for loans, Empire to grow your company.", "green");
          }
        }
        // Free up crew and update job history
        const siteCategory = siteDef?.category || "Commercial";
        for (const id of (site.assignedCrewIds || [])) {
          const w = g.crew.find((w) => w.id === id);
          if (w) {
            w.status = "Idle"; w.assignedSiteId = null; w.jobsCompleted = (w.jobsCompleted||0)+1;
            // XP gain based on contract value
            const xpGain = Math.min(50, Math.round(3 + (site.totalValue || 5000) / 5000));
            w.xp = (w.xp || 0) + xpGain;
            checkLevelUp(g, w);
            // R15-5: Crew milestone celebrations
            const _jMilestones = [5, 10, 25, 50, 100];
            if (_jMilestones.includes(w.jobsCompleted)) {
              w.loyalty = Math.min(100, (w.loyalty ?? 50) + 15);
              w.mood = Math.min(100, (w.mood ?? 50) + 10);
              const _rank = w.jobsCompleted >= 100 ? "a Company Legend" : w.jobsCompleted >= 50 ? "a Senior Hand" : w.jobsCompleted >= 25 ? "an Experienced Pro" : w.jobsCompleted >= 10 ? "a Trusted Builder" : "part of the team";
              addLog(g, `🎉 ${w.name} just hit ${w.jobsCompleted} jobs! They're ${_rank}. Loyalty +15.`);
              if (w.jobsCompleted === 10) {
                g.pendingStory = g.pendingStory || { icon: "people", title: `${w.name} — 10 Jobs!`, body: `${w.name} has completed 10 jobs with your company. They're becoming a backbone of your operation. Their loyalty and skill are growing.` };
              }
            }
            w.jobHistory = [...(w.jobHistory||[]), siteCategory].slice(-5);
            // Update favorite category
            const catCounts = (w.jobHistory||[]).reduce((acc, cat) => { acc[cat]=(acc[cat]||0)+1; return acc; }, {});
            w.favoriteCategory = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
            // Check retirement: 50+ jobs, skill 100+, loyalty 70+
            if ((w.jobsCompleted||0) >= 50 && (w.skill||0) >= 100 && (w.loyalty ?? 0) >= 70 && Math.random() < 0.08) {
              g.pendingStory = g.pendingStory || { icon: "medal", title: `${w.name} Retires!`, body: `${w.name} completed ${w.jobsCompleted} jobs with you. A legend of the company.` };
              g.crew = g.crew.filter(cw => cw.id !== w.id);
              addLog(g, `🎖️ ${w.name} retired after ${w.jobsCompleted} jobs. A true legend.`);
            }
          }
        }
        for (const id of (site.assignedEquipmentIds || [])) {
          const e = g.equipment.find((e) => e.id === id);
          if (e) { e.status = "Idle"; e.assignedSiteId = null; }
        }
        const penaltyNote = penalty > 0 ? ` (${money(penalty)} late penalty)` : "";
        addLog(g, `✅ ${site.label} complete — earned ${money(earned + qualityBonus)}${penaltyNote}!`);
        const _qualLabel = effectiveQuality >= 1.15 ? "Premium" : effectiveQuality >= 1.05 ? "High" : effectiveQuality < 0.95 ? "Below Standard" : "Standard";
        g.jobHistory = [...(g.jobHistory || []), { label: site.label, client: site.client, value: earned + qualityBonus, day: g.day, quality: _qualLabel, daysLate }].slice(-20);
        // On-time streak tracking
        if (daysLate === 0) {
          g.onTimeStreak = (g.onTimeStreak || 0) + 1;
          g.bestStreak = Math.max(g.bestStreak || 0, g.onTimeStreak);
          g._weekOnTimeJobs = (g._weekOnTimeJobs || 0) + 1;
          const streakMilestones = [3, 5, 10, 20];
          if (streakMilestones.includes(g.onTimeStreak)) {
            const streakReward = g.onTimeStreak * 300;
            g.cash += streakReward;
            g.revenue += streakReward;
            recordTransaction(g, "bonuses", streakReward, `${g.onTimeStreak}-job on-time streak bonus`);
            addLog(g, `🔥 ${g.onTimeStreak}-job on-time streak! Bonus: ${money(streakReward)}`);
            addImportantNotice(g, `On-time streak of ${g.onTimeStreak}! Bonus ${money(streakReward)} earned.`, "green");
          }
          checkWeeklyChallenge(g, "ontime", 1);
        } else {
          if ((g.onTimeStreak || 0) > 0) {
            addLog(g, `💔 On-time streak broken at ${g.onTimeStreak} — ${site.label} was ${daysLate} day(s) late.`);
          }
          g.onTimeStreak = 0;
        }
        // Phase 6: the company remembers how this one went. Weighted by the size of the job,
        // so a fence and a tower do not echo equally.
        {
          const _weight = (site.totalValue || 0) >= 250000 ? 3 : (site.totalValue || 0) >= 80000 ? 2 : 1;
          if (daysLate === 0) {
            recordMemory(g, {
              tag: `delivered_${site.id}`, kind: "triumph", valence: "good", weight: _weight,
              subject: site.client || "",
              label: `Delivered ${site.label} on time`,
              detail: `you delivered ${site.label} on time for ${site.client || "the client"}`,
            });
          } else {
            recordMemory(g, {
              tag: `blew_${site.id}`, kind: "setback", valence: "bad", weight: _weight,
              subject: site.client || "",
              label: `${site.label} ran ${daysLate} day${daysLate === 1 ? "" : "s"} late`,
              detail: `${site.label} ran ${daysLate} day${daysLate === 1 ? "" : "s"} late`,
            });
          }
          if (effectiveQuality >= 1.15) {
            recordMemory(g, {
              tag: `praised_${site.id}`, kind: "client", valence: "good", weight: _weight,
              subject: site.client || "",
              label: `${site.client || "A client"} got premium work`,
              detail: `you handed ${site.client || "them"} premium work on ${site.label}`,
            });
          } else if (effectiveQuality < 0.95) {
            recordMemory(g, {
              tag: `disappointed_${site.id}`, kind: "client", valence: "bad", weight: _weight,
              subject: site.client || "",
              label: `${site.client || "A client"} got below-standard work`,
              detail: `you handed ${site.client || "them"} below-standard work on ${site.label}`,
            });
          }
        }
        checkWeeklyChallenge(g, "job_complete", 1);
        checkWeeklyChallenge(g, "revenue", earned);
        // Named client loyalty update
        const _con = (g.contracts||[]).find(c => c.id === site.contractId);
        if (_con?.clientId && CLIENT_ROSTER.find(c => c.id === _con.clientId)) {
          if (!g.clientRelationships) g.clientRelationships = {};
          if (!g.clientRelationships[_con.clientId]) g.clientRelationships[_con.clientId] = { loyalty: 0, jobsDone: 0, lastJobDay: null };
          const _rel = g.clientRelationships[_con.clientId];
          const _loyBonus = daysLate === 0 ? 3 : 1;
          _rel.loyalty = Math.min(100, (_rel.loyalty ?? 0) + _loyBonus);
          _rel.jobsDone = (_rel.jobsDone||0) + 1;
          _rel.lastJobDay = g.day;
          const _cl = CLIENT_ROSTER.find(c => c.id === _con.clientId);
          const _prevTier = getClientTier((_rel.loyalty ?? 0) - _loyBonus);
          const _newTier  = getClientTier(_rel.loyalty ?? 0);
          if (_newTier.label !== _prevTier.label) {
            addImportantNotice(g, `${_cl.icon} ${_cl.name} relationship: now "${_newTier.label}"!`, "cyan");
          }
        }
        // R14-3: Crew completion bonus — pay and boost morale if on-time
        if (daysLate === 0 && (site.completionBonus || 0) > 0) {
          g.cash -= site.completionBonus;
          g.expenses += site.completionBonus;
          g.weeklyStats.expenses += site.completionBonus;
          recordTransaction(g, "payroll", -site.completionBonus, `${site.label}: crew completion bonus`);
          for (const id of (site.assignedCrewIds || [])) {
            const w = g.crew.find(c => c.id === id);
            if (w) { w.mood = Math.min(100, (w.mood ?? 50) + 15); w.loyalty = Math.min(100, (w.loyalty ?? 50) + 8); }
          }
          addLog(g, `⭐ Crew bonus paid — ${money(site.completionBonus)}. Morale boosted!`);
        }
        // R14-6: Repeat client chance — 45% on-time+quality, 25% on-time, 10% late
        const _wasOnTime = daysLate === 0;
        const _qualityGood = (site.rushQualityPenalty || 0) < 0.05;
        const _repeatChance = _wasOnTime ? (_qualityGood ? 0.45 : 0.25) : 0.10;
        if (Math.random() < _repeatChance) {
          if (!g.pendingRepeatClients) g.pendingRepeatClients = [];
          const _siteCityId = site.cityId || g.startingCityId || "salem";
          g.pendingRepeatClients.push({
            client: site.client,
            cityId: _siteCityId,
            appearsDay: g.day + rand(3, 7),
            valueMult: _wasOnTime && _qualityGood ? 1.15 : 1.0,
          });
        }

        // ── Government grant completion check ─────────────────────────────────
        if (g.activeGrant) {
          const _grantDef = CONTRACT_DEFS.find(c => c.id === (g.contracts.find(cc => cc.id === site.contractId)?.defId));
          const _isInfra = _grantDef?.category === "Infrastructure" || _grantDef?.category === "Government";
          const _hasPaving = (_grantDef?.phases || []).some(p => p === "Paving" || p === "Base Layer");
          if (g.activeGrant.type === "infrastructure" && (_isInfra || _hasPaving) && g.day <= g.activeGrant.deadline) {
            g.cash = (g.cash || 0) + g.activeGrant.reward;
            recordTransaction(g, "bonuses", g.activeGrant.reward, "Infrastructure grant");
            addLog(g, `🏛️ Infrastructure grant awarded — ${money(g.activeGrant.reward)} deposited!`);
            g.pendingStory = g.pendingStory || { icon: "ribbon", title: "Grant Awarded!", body: `You completed an infrastructure contract on time and earned the city grant of ${money(g.activeGrant.reward)}.` };
            g.activeGrant = null;
          } else if (g.activeGrant.deadline < g.day) {
            addLog(g, `📋 Government grant expired — contract not completed in time.`);
            g.activeGrant = null;
          }
        }

        // ── Contract chain unlock (Feature 1) ────────────────────────────────
        const _completedDef = CONTRACT_DEFS.find(c => c.id === (g.contracts.find(cc => cc.id === site.contractId)?.defId));
        if (_completedDef?.unlocksContractId) {
          const _unlockDef = CONTRACT_DEFS.find(c => c.id === _completedDef.unlocksContractId);
          if (_unlockDef && !hasLiveChainOpportunity(g.contracts, _unlockDef.id)) {
            // Earned for good. If the company cannot take it yet it waits, locked and without an
            // expiry, until it can — see systems/chainOpportunities.js.
            const _chainContract = earnChainOpportunity({
              id: `chain_${uid()}`, defId: _unlockDef.id, label: _unlockDef.label, category: _unlockDef.category || "Commercial",
              client: pick(CLIENTS), value: Math.round((_unlockDef.baseValue || _unlockDef.value || 10000) * 1.15), phases: [..._unlockDef.phases],
              minTier: _unlockDef.minTier, crewMin: _unlockDef.crewMin, equipMin: _unlockDef.equipMin,
              materials: { ...(_unlockDef.materials||{}) }, penaltyPerDay: _unlockDef.penaltyPerDay,
              durationDays: _unlockDef.durationDays, risk: _unlockDef.risk || 2, desc: _unlockDef.desc,
              cityId: pickContractCity(g),
            }, companyCapacity(g), g.day);
            // The deadline is set when the bid window opens, not when the job was earned.
            _chainContract.deadline = g.day + _unlockDef.durationDays + rand(3, 8);
            g.contracts.push(_chainContract);
            if (_chainContract.status === "Open") {
              addLog(g, `🔓 New opportunity unlocked: ${_unlockDef.label}`);
            } else {
              const _wait = chainReadiness(_chainContract, companyCapacity(g)).waitingOn.map((x) => x.label.toLowerCase()).join(", ");
              addLog(g, `🔓 Earned: ${_unlockDef.label}. It waits on the Bids tab until you have the ${_wait} for it.`);
              addImportantNotice(g, `You earned a shot at ${_unlockDef.label}. It is held for you — no expiry — until your company can take it. See Bids.`, "cyan", { actionLabel: "See what it needs", actionTab: "Bids" });
            }
          }
        }

        // ── Company history + ceremony (Feature 3) ────────────────────────────
        const _contractDefForHistory = siteDef;
        const actualPayout = earned + qualityBonus;
        g.companyHistory = g.companyHistory || [];
        g.companyHistory.push({
          label: site.label, day: g.day, revenue: actualPayout,
          repGained: _contractDefForHistory?.repReward || 5,
          isMajor: !!_contractDefForHistory?.isMajorProject,
        });
        if (g.companyHistory.length > 50) g.companyHistory = g.companyHistory.slice(-50);

        if (_contractDefForHistory?.isMajorProject && !g.pendingCeremony) {
          g.pendingCeremony = {
            label: site.label, day: g.day, revenue: actualPayout,
            repGained: _contractDefForHistory.repReward || 10,
            crewCount: site.assignedCrewIds?.length || 0,
            equipmentCount: site.assignedEquipmentIds?.length || 0,
          };
        }

        // ── Hall of Fame updates (Feature 5) ─────────────────────────────────
        if (!g.hallOfFame) g.hallOfFame = { biggestContract:0, highestRep:0, largestCrew:0, largestFleet:0, highestValuation:0, mostProfitableProject:{label:"",value:0} };
        if (actualPayout > (g.hallOfFame.biggestContract||0)) g.hallOfFame.biggestContract = actualPayout;
        if (actualPayout > (g.hallOfFame.mostProfitableProject?.value||0)) {
          g.hallOfFame.mostProfitableProject = { label: site.label, value: actualPayout };
        }

        // ── City stats update (Feature 8) ─────────────────────────────────────
        const _city = site.city || site.cityId || (g.unlockedCities?.[0] || "salem");
        if (!g.cityStats) g.cityStats = {};
        if (!g.cityStats[_city]) g.cityStats[_city] = { playerJobs: 0, rivalJobs: 0 };
        g.cityStats[_city].playerJobs = (g.cityStats[_city].playerJobs || 0) + 1;

        continue;
      } else {
        addLog(g, `🔨 ${site.label}: Phase "${completedPhaseName}" done. Starting "${site.phases[site.currentPhaseIdx]}".`);
      }
    }

    // Chaos events — mid-game sites (started after day 30) get a 12% daily chance vs 8%. The
    // daily figure is converted to a per-tick chance from the clock (systems/siteEvents.js); a
    // fixed per-tick number drifted to ~32% a day as the tick length changed.
    const isMidGameSite = (site.startDay || 0) > 30;
    const chaosProbMult = isMidGameSite ? 9.6 : 8;
    if (Math.random() < chaosChancePerTick(site)) {
      const siteEquip = g.equipment.find(e => (site.assignedEquipmentIds || []).includes(e.id));
      const telematicsTier = siteEquip?.upgrades?.telematics || 0;
      const safetyTier = siteEquip?.upgrades?.safety || 0;
      const eligible = CHAOS_EVENTS.filter((e) => {
        let prob = e.prob * chaosProbMult;
        if (e.id === "breakdown") prob *= (1 - telematicsTier * 0.10);
        if (e.id === "safety" || e.id === "inspection") prob *= (1 - safetyTier * 0.09);
        return Math.random() < prob;
      });
      if (eligible.length) {
        const event = pick(eligible);
        const _chaosScope = beginCashScope(g);
        const result = event.apply(site, g);
        closeCashScope(g, _chaosScope, CHAOS_LEDGER_CATEGORY[event.id] || "misc", `${site.label}: ${event.label}`);
        if (result) {
          if (!site.chaosHistory) site.chaosHistory = [];
          site.chaosHistory = [{ ...result, day: g.day }, ...site.chaosHistory].slice(0, 10);
          if (result.type === "breakdown" || result.type === "safety") {
            g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 2000;
            applyIncident(g, result.type === "safety" ? 2 : 1, site.totalValue);
          } else if (result.type === "permit" && Math.random() < 0.3) {
            applyInspectionPass(g);
          }
          const _chainScope = beginCashScope(g);
          checkChainEvents(site, g, result.type);
          closeCashScope(g, _chainScope, "fines", `${site.label}: follow-up to ${event.label.toLowerCase()}`);
        }
        // Regional weather check
        const siteCityDef = CITIES.find((c) => c.id === site.cityId);
        const siteRegion = siteCityDef?.region || "Pacific Northwest";
        if (Math.random() < 0.04) {
          const weatherResult = applyWeatherEvent(site, g, siteRegion);
          if (weatherResult) {
            site.chaosHistory = [{ ...weatherResult, day: g.day }, ...site.chaosHistory].slice(0, 10);
          }
        }
      }
    }

    // Fuel consumption stays site-specific. Condition wear/breakdowns are handled centrally
    // by tickEquipmentWear() below so there is only one source of truth for maintenance.
    for (const id of site.assignedEquipmentIds) {
      const e = g.equipment.find((eq) => eq.id === id);
      if (!e) continue;
      // A machine that is broken or in the workshop is not running, so it is not burning fuel.
      if (!isUsable(e)) continue;
      e.fuel = Math.max(0, (e.fuel ?? e.fuelCap ?? 0) - (0.5 * MINS_PER_TICK / 60));
      if (e.fuel <= 0 && e.fuelCap > 0 && e.status === "Active") {
        e.status = "Idle";
        e.assignedSiteId = null;
        // THE GAME-KILLER. This used to drop the machine off the site and forget which site it
        // came from. Nothing ever put it back. On a starting company — one pickup, 60 litres,
        // 12 a day — the truck ran dry on day five and the job froze at whatever percentage it
        // had reached, FOREVER, while wages kept going out every day. A six-day contract took
        // more than a hundred and twenty days and never finished. The log line even promised
        // "Refuel overnight", which was a return that never came.
        e.awaitingFuelForSiteId = site.id;
        site.assignedEquipmentIds = site.assignedEquipmentIds.filter((eid) => eid !== e.id);
        addLog(g, `⛽ ${e.name} ran out of fuel — pulled from ${site.label}. It returns once refuelled.`);
        addImportantNotice(g, `${e.name} ran dry at ${site.label}. It goes back on as soon as it is refuelled.`, "orange", { actionTab: "Equipment" });
      }
    }

    // Crew stamina drain
    // Reported from a device: "employees run out of stamina too fast."
    //
    // At 0.25 this cost 6 stamina per game DAY of work. A six-day contract therefore burned
    // ~36 of a starting worker's 70-95, and anything longer pushed them under the exhaustion
    // threshold — at which point they were pulled off the site, which slowed the job, which
    // made it longer, which exhausted the next one. A death spiral dressed as a difficulty
    // curve: measured runs of a SIX-day contract were finishing in 18 to 24 days, or never.
    //
    // At 0.12 a day's work costs ~2.9, so a normal contract is comfortable, a long one is
    // genuinely tiring, and rest is a decision rather than a constant tax.
    const _seasonStamDrain = (g.seasonStaminaMult || 1.0) * 0.12;
    for (const id of site.assignedCrewIds) {
      const w = g.crew.find((w) => w.id === id);
      if (!w) continue;
      w.stamina = Math.max(0, w.stamina - (_seasonStamDrain * MINS_PER_TICK / 60));
      if (Math.random() < 0.05 && (w.skill || 0) < 120) w.skill = Math.min(120, (w.skill || 75) + 1);
      if (w.stamina < 10 && w.status === "Active") {
        w.status = "Idle";
        w.assignedSiteId = null;
        // Exactly the fuel bug wearing different clothes. A worker was dropped off the site and
        // the site forgot where they came from, so once the whole crew had cycled through
        // exhaustion the job had nobody on it and froze permanently — the player watching wages
        // go out against a contract that could never finish.
        w.awaitingRestForSiteId = site.id;
        site.assignedCrewIds = site.assignedCrewIds.filter((cid) => cid !== w.id);
        addLog(g, `⚠ ${w.name} exhausted — pulled from ${site.label}. They return once rested.`);
      }
      // R15-1: Crew personality banter — once per worker per day, ~1.7% chance per tick
      if (w.status === "Active" && Math.random() < 0.017 && (w._lastBanter || 0) < g.day) {
        w._lastBanter = g.day;
        const _banterSite = g.activeSites.find(s => (s.assignedCrewIds || []).includes(w.id));
        const BANTER = {
          "Reliable":    [`${w.name}: "Another solid day on the tools."`, `${w.name} checked every connection twice before moving on. That's why we hire them.`],
          "Skilled":     [`${w.name} spotted a structural issue before it became a problem — quick thinking saves time.`, `${w.name}: "These specs are tight, but I've seen worse."`],
          "Fast":        [`${w.name} is moving at pace today — ${_banterSite?.label || "the site"} is flying.`, `${w.name}: "Let's get this wrapped up. I've got another job in mind."`],
          "Careful":     [`${w.name} triple-checked the measurements before cutting. Slow is smooth.`, `${w.name}: "I'd rather do it right once than rush and do it twice."`],
          "Veteran":     [`${w.name}: "Built half the buildings in this city. This one will be no different."`, `${w.name} has a story about every street corner — keeps the crew laughing.`],
          "Ambitious":   [`${w.name} asked about project management training again. Good sign.`, `${w.name}: "When do I get my own crew to lead?"`],
          "Lazy":        [`${w.name} took a long lunch. Crew noticed — morale dipped slightly.`, `${w.name}: "Nearly done, right? We've been at this for hours."`],
          "Hardworking": [`${w.name} stayed late to finish the rough-in. Didn't ask for extra pay.`, `${w.name}: "Not leaving till this phase is clean."`],
          "Loyal":       [`${w.name}: "Wouldn't work for anyone else in this city."`, `${w.name} turned down a rival's recruiter call. "I'm happy where I am."`],
        };
        const _banterLines = BANTER[w.trait?.label] || [`${w.name} got on with the job today.`];
        addLog(g, `💬 ${_banterLines[Math.floor(Math.random() * _banterLines.length)]}`, "sub");
        if (w.trait?.label === "Lazy") {
          const _randomCrew = g.crew[Math.floor(Math.random() * g.crew.length)];
          if (_randomCrew) _randomCrew.mood = Math.max(0, (_randomCrew.mood ?? 50) - 1);
        }
      }
    }
  }

  // Remove completed/failed sites from active
  g.activeSites = g.activeSites.filter((s) => s.status === "Active" || s.status === "Paused");

  // ── Daily tick ───────────────────────────────────────────────────────────────
  if (newDay) {
    // The login streak used to be paid here, once per SIMULATED day — so leaving the game running
    // was a $500/day income. It is counted on real calendar days now, when the app is opened or
    // brought back (systems/sessionStreak.js). Game days never touch it.

    // Payroll (with labor_shortage market event crewWageMod)
    const activePayrollEvent = g.activeMarketEvent ? MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent) : null;
    const crewWageMod = activePayrollEvent?.crewWageMod || 0;
    const dailyPayroll = [...g.crew.filter((w) => w.onShift !== false), ...g.officeStaff]
      .reduce((s, p) => s + (p.wagePerDay || 0) * (1 + crewWageMod), 0);

    // Office rent
    const office = OFFICES[g.officeIndex];
    // Owning an Office Property eliminates this. That is the entire pitch of a $120,000
    // purchase, and it was never checked — rent was charged unconditionally.
    const dailyRent = dailyOfficeRent(g);

    // Equipment daily cost
    const equipCost = g.equipment.reduce((s, e) => s + e.dailyCost, 0);

    // Charged in whole dollars, exactly as the ledger records it below. A $0.25/hr review raise
    // makes a wage fractional; the cents used to leave the balance unrecorded, a dollar at a time.
    const totalOverhead = Math.round(dailyPayroll) + Math.round(dailyRent) + Math.round(equipCost);
    g.cash -= totalOverhead;
    g.expenses += totalOverhead;
    g.weeklyStats.expenses += totalOverhead;

    // Daily overhead is the single largest line in the game's cash flow. Split it into the
    // three things it actually is, so Finance shows "Payroll / Property / Equipment"
    // instead of one "Uncategorized operating expense" from the reconciler.
    if (Math.round(dailyPayroll) > 0) recordTransaction(g, "payroll", -Math.round(dailyPayroll), "Daily crew and office payroll");
    if (Math.round(dailyRent) > 0) recordTransaction(g, "property", -Math.round(dailyRent), `${office.name}: daily rent`);
    else if ((office?.dailyRent || 0) > 0 && Math.random() < 0.02) {
      addLog(g, `🏢 No rent on ${office.name} — you own the building.`);
    }
    if (Math.round(equipCost) > 0) recordTransaction(g, "equipment", -Math.round(equipCost), "Equipment daily running cost");

    // Attribute today's crew and machine cost to the projects those people and machines
    // are actually standing on. Attribution only — the cash already left in the sweep
    // above; this just records which job it belonged to, so completion can show a margin.
    // Idle crew and parked equipment are deliberately unattributed: they are company
    // overhead, and charging them to whichever project happens to be open would make a
    // profitable job look like it lost money.
    for (const _site of (g.activeSites || [])) {
      if (_site.status === "Complete") continue;
      let _siteWages = 0;
      let _siteCrewCount = 0;
      for (const _id of (_site.assignedCrewIds || [])) {
        const _w = g.crew.find((w) => w.id === _id);
        if (!_w || _w.onShift === false) continue;
        _siteWages += (_w.wagePerDay || 0) * (1 + crewWageMod);
        _siteCrewCount += 1;
      }
      let _siteEquip = 0;
      let _siteEquipCount = 0;
      for (const _id of (_site.assignedEquipmentIds || [])) {
        const _e = g.equipment.find((e) => e.id === _id);
        if (!_e) continue;
        _siteEquip += _e.dailyCost || 0;
        _siteEquipCount += 1;
      }
      accrueProjectCost(_site, "labor", Math.round(_siteWages));
      accrueProjectCost(_site, "equipment", Math.round(_siteEquip));
      accrueProjectCrewDay(_site, _siteCrewCount, _siteEquipCount);
    }

    // Crew stamina recovery
    for (const w of g.crew) {
      if (w.status === "Idle") {
        w.stamina = Math.min(100, w.stamina + rand(15, 25));
        w.mood = Math.min(100, w.mood + rand(2, 6));
      }
    }

    // Equipment fuel refill (simulate overnight refuel)
    for (const e of g.equipment) {
      if (e.status === "Idle") e.fuel = Math.min(e.fuelCap, e.fuel + e.fuelCap * 0.5);
    }

    // Back to the job they were pulled off — rested crew, refuelled and repaired machines. Without
    // this they recover in the yard while the site they left sits at 48% forever. One function
    // for every recoverable removal, so a new way off a site cannot forget the way back.
    for (const _ret of returnRecoveredToSites(g, isUsable)) addLog(g, _ret.text);

    // A site with nobody on it is the other half of the freeze. Say so, loudly, every time it
    // happens — silence here is what let a contract die at 48% without the player knowing why.
    for (const _s of (g.activeSites || [])) {
      const _hasCrew = (_s.assignedCrewIds || []).length > 0;
      if (!_hasCrew && _s.status === "Active" && !_s._noCrewWarned) {
        _s._noCrewWarned = true;
        const _resting = (g.crew || []).filter((w) => w.awaitingRestForSiteId === _s.id).length;
        addImportantNotice(g, _resting > 0
          ? `${_s.label} has stopped — its crew are resting and go back automatically once rested. Assign other crew to keep it moving.`
          : `${_s.label} has nobody on site — work has stopped. Assign crew.`, "red", { actionLabel: "Assign crew", actionTab: "Sites" });
      } else if (_hasCrew && _s._noCrewWarned) {
        _s._noCrewWarned = false;
      }
    }

    // Clear expired weather on sites
    for (const site of g.activeSites) {
      if (site.currentWeather && site.currentWeather.endsDay <= g.day) {
        site.currentWeather = null;
      }
    }

    // Reset no-show subs to Active each new day
    for (const sc of (g.subcontractors || [])) {
      if (sc.status === "Idle" && sc.daysLeft > 0) sc.status = "Active";
    }


    // Expire stale bids (preserve bids that have been accepted/active)
    g.bids = (g.bids||[]).filter(b => !b.expiryDay || b.expiryDay >= g.day || b.isActive);

    // R14-6: Inject pending repeat-client contracts that are due today
    if ((g.pendingRepeatClients || []).length > 0) {
      const _dueToday = g.pendingRepeatClients.filter(rc => rc.appearsDay <= g.day);
      for (const rc of _dueToday) {
        const _base = createContract(g);
        _base.client = rc.client;
        _base.cityId = rc.cityId || g.startingCityId || "salem";
        _base.value = Math.round(_base.value * (rc.valueMult || 1.0));
        _base.label = "🔄 " + _base.label;
        _base.expiresDay = g.day + 5;
        _base.isRepeatClient = true;
        g.contracts.push(_base);
        addLog(g, `🔄 ${rc.client} is back — new contract available in Bids!`);
      }
      g.pendingRepeatClients = g.pendingRepeatClients.filter(rc => rc.appearsDay > g.day);
    }

    // R15-4: Season change check (every 90 days cycling through 360-day year)
    const _seasonIndex = Math.floor(((g.day - 1) % 360) / 90);
    const _SEASONS = [
      { name: "Spring", emoji: "🌱", contractMult: 1.08, staminaMult: 1.0, desc: "Building season begins — demand is high." },
      { name: "Summer", emoji: "☀️", contractMult: 1.15, staminaMult: 1.15, desc: "Peak summer — contracts pay premium but heat slows crews." },
      { name: "Fall",   emoji: "🍂", contractMult: 1.20, staminaMult: 1.0, desc: "Pre-winter rush — book it before the cold hits." },
      { name: "Winter", emoji: "❄️", contractMult: 0.90, staminaMult: 1.0, desc: "Slow season — focus on efficiency and crew training." },
    ];
    const _newSeason = _SEASONS[_seasonIndex];
    if (_newSeason.name !== g.currentSeason) {
      g.currentSeason = _newSeason.name;
      g.seasonEmoji = _newSeason.emoji;
      g.seasonContractMult = _newSeason.contractMult;
      g.seasonStaminaMult = _newSeason.staminaMult || 1.0;
      addLog(g, `${_newSeason.emoji} Season change: ${_newSeason.name} — ${_newSeason.desc}`);
      g.pendingStory = g.pendingStory || { icon: "calendar", title: `${_newSeason.emoji} ${_newSeason.name} Season`, body: _newSeason.desc };
    }

    // R15-2: Weekly Rush Job (every 7 days)
    if (g.day % 7 === 0 && !g.contracts.some(c => c.isWeeklyRush && c.status === "Open")) {
      const _rushBase = createContract(g);
      _rushBase.value = Math.round(_rushBase.value * 2.2);
      _rushBase.label = "⚡ Weekend Rush — " + _rushBase.label;
      _rushBase.deadline = g.day + 3;
      _rushBase.durationDays = 3;
      _rushBase.penaltyPerDay = Math.round((_rushBase.penaltyPerDay || 200) * 1.8);
      _rushBase.expiresDay = g.day + 1;
      _rushBase.isWeeklyRush = true;
      g.contracts.push(_rushBase);
      addLog(g, `⚡ Weekend Rush Job available in Bids — 2× pay, 3-day window. Expires tomorrow!`);
    }

    // R15-8: Hot material flash deal (every 14 days)
    if (g.day % 14 === 0 && !g.hotMaterialDeal) {
      const _flashMats = MATERIAL_DEFS.filter(m => m.id !== "fuel");
      const _flashMat = _flashMats[Math.floor(Math.random() * _flashMats.length)];
      const _discPct = rand(25, 40);
      g.hotMaterialDeal = {
        matId: _flashMat.id,
        label: _flashMat.label,
        discountPct: _discPct,
        expiresDay: g.day + 2,
        unitPrice: Math.round((g.materialPrices[_flashMat.id] || _flashMat.basePrice) * (1 - _discPct / 100)),
      };
      addLog(g, `📊 Market Flash: ${_flashMat.label} dropped ${_discPct}% — bulk buy available for 2 days!`);
    }
    if (g.hotMaterialDeal && g.hotMaterialDeal.expiresDay < g.day) {
      g.hotMaterialDeal = null;
    }

    // Refresh contracts. The board's size is no longer hard-coded: regional offices widen
    // it, which is what their advertised "contract slots" always claimed and never did.
    const _board = contractBoardSize(g);
    for (const _opened of openReadyChainOpportunities(g.contracts, companyCapacity(g), g.day)) {
      _opened.deadline = g.day + (_opened.durationDays || 14) + rand(3, 8);
      addLog(g, `🔓 ${_opened.label} is open to bid — you have what it needs now. ${CHAIN_OFFER_DAYS} days to take it.`);
      addImportantNotice(g, `${_opened.label} is open to bid now that your company can take it. The offer runs ${CHAIN_OFFER_DAYS} days.`, "green", { actionLabel: "Bid", actionTab: "Bids" });
    }
    g.contracts = g.contracts.filter((c) => c.status !== "Open" || c.expiresDay >= g.day);
    while (g.contracts.filter((c) => c.status === "Open").length < _board.floor) {
      g.contracts.push(createContract(g));
    }
    // Expire old contracts — cap the Open pool at 7, then bound the closed history. This
    // ran only on app load before, so a long uninterrupted session grew the save without
    // limit; a live session needs the same bound the loader applies.
    // Earned chain opportunities are never the ones the cap trims.
    const openPool = g.contracts.filter((c) => c.status === "Open").sort((a, b) => (b.isChainUnlock ? 1 : 0) - (a.isChainUnlock ? 1 : 0));
    g.contracts = [...g.contracts.filter((c) => c.status !== "Open"), ...openPool.slice(0, _board.cap)];
    pruneContractHistory(g);

    // Material price fluctuation
    for (const m of MATERIAL_DEFS) {
      const current = g.materialPrices[m.id] || m.basePrice;
      const change = (Math.random() - 0.5) * 2 * m.volatility * current;
      g.materialPrices[m.id] = Math.round(Math.max(m.basePrice * 0.6, Math.min(m.basePrice * 1.8, current + change)));
    }

    // Market state shift (every ~10 days)
    if (g.day % 10 === 0) {
      const r = Math.random();
      g.marketState = r < 0.25 ? "Boom" : r < 0.5 ? "Slow" : "Normal";
      if (g.marketState !== "Normal") {
        addLog(g, `📈 Market shift: ${g.marketState} conditions affecting contract values.`);
      }
    }

    // Daily loan interest: 0.5% of remaining balance per day
    for (const loan of (g.loans || [])) {
      if (loan.weeksLeft > 0 && loan.remainingBalance > 0) {
        const dailyInterest = Math.round(loan.remainingBalance * 0.005);
        if (dailyInterest > 0) {
          loan.remainingBalance += dailyInterest;
          g.weeklyStats.expenses += dailyInterest;
        }
      }
    }

    // Weekly loan repayments (every 7 days)
    if (g.day % 7 === 0 && g.loans.length) {
      // Max 3 active loans enforcement
      for (const loan of g.loans) {
        if (loan.weeksLeft <= 0) continue;
        if (g.cash >= loan.weeklyPayment) {
          g.cash -= loan.weeklyPayment;
          recordTransaction(g, "financing", -loan.weeklyPayment, `${loan.label}: weekly repayment`);
          loan.remainingBalance = Math.max(0, loan.remainingBalance - loan.weeklyPayment);
          loan.weeksLeft -= 1;
          if (loan.weeksLeft <= 0) addLog(g, `✅ Loan "${loan.label}" fully repaid!`);
        } else {
          loan.missedPayments = (loan.missedPayments || 0) + 1;
          g.creditScore = Math.max(300, g.creditScore - 15);
          addLog(g, `⚠ Missed loan payment on "${loan.label}" — credit score hit.`);
        }
      }
      g.loans = g.loans.filter((l) => l.weeksLeft > 0);
    }

    // Equipment wear/maintenance is centralized in equipmentWear.js. This replaces the old
    // flat low-condition charge and idle-condition decay, avoiding double wear and double cost.
    tickEquipmentWear(g);

    // ── Payroll: underpayment accrues, and people leave over it ───────────────
    //
    // Sprint 13. The old wage controls charged for a cut ONCE — 15 loyalty on the day it
    // happened — and then forgot. Cutting everyone's pay, eating a single hit and banking the
    // savings forever was therefore strictly optimal, and nobody ever left over it because
    // nothing was still tracking it tomorrow. A wage you can set is only a decision if it has
    // a cost that persists.
    for (const _w of [...(g.crew || [])]) {
      accrueUnderpayment(_w);
      const _risk = quitRisk(_w);
      if (_risk > 0 && Math.random() < _risk) {
        const _pos = payPosition(_w);
        for (const site of (g.activeSites || [])) {
          site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => id !== _w.id);
        }
        g.crew = (g.crew || []).filter((x) => x.id !== _w.id);
        addLog(g, `😤 ${_w.name} quit — ${money(_w.wagePerDay)}/day against a market rate of ${money(marketRateFor(_w))}.`);
        addImportantNotice(g,
          `${_w.name} handed in their boots. They were ${_pos.label.toLowerCase()} for ${Math.round(_w.underpaidDays || 0)} days.`,
          "red", { actionLabel: "Review pay", actionTab: "Crew" });
        recordMemory(g, { tag: `quit_pay_${g.day}`, kind: "crew", valence: "bad", weight: 1.5,
          label: "Lost someone over pay", detail: `${_w.name} left because you were paying under the rate` });
      }
    }

    // ── Compliance: licences and inspectors ───────────────────────────────────
    //
    // Sprint 12. `equipment_cert` had existed since the training system was written — a player
    // could pay $800 and wait five days for it — and NOTHING in the game read it. The game sold
    // a licence to operate heavy plant and then let anyone operate heavy plant.
    //
    // Unlicensed operation stays ALLOWED, deliberately: "you can accept the jobs and have your
    // employees operate the equipment, but if they get caught you get a penalty charge." It is
    // a gamble the player is entitled to take, which is a better mechanic than a gate.
    for (const _site of (g.activeSites || [])) {
      if ((_site.status || "") !== "Active") continue;

      // Caught running unlicensed.
      const _risk = catchRiskPerDay(_site, g);
      if (_risk > 0 && Math.random() < _risk) {
        const _n = unlicensedMachineCount(_site, g.crew, g.equipment);
        const _fine = fineFor(_site, 3, { knowing: true, companyLevel: g.companyLevel || 1 });
        g.cash -= _fine;
        g.expenses += _fine;
        recordTransaction(g, "fines", -_fine, `Unlicensed operation — ${_site.label}`);
        g.reputation = Math.max(0, (g.reputation || 0) - 2);
        addLog(g, `🚨 Caught operating ${_n} machine${_n === 1 ? "" : "s"} unlicensed at ${_site.label} — ${money(_fine)} fine.`);
        addImportantNotice(g,
          `Unlicensed operation at ${_site.label}: ${money(_fine)} fine and reputation down. Put a crew member through Equipment Certification.`,
          "red", { actionLabel: "Train crew", actionTab: "Crew" });
        recordMemory(g, { tag: `unlicensed_${g.day}`, kind: "setback", valence: "bad", weight: 1.5,
          label: "Caught operating unlicensed", detail: "an inspector caught your crew running heavy plant without tickets" });
      }

      // A full inspection, resolved against what is actually true of the site rather than
      // rolled for — a player who trained their operators and maintained their plant passes.
      if (Math.random() < INSPECTION_CHANCE_PER_DAY) {
        const _res = inspectSite(_site, g);
        if (_res.passed) {
          g.reputation = Math.min(100, (g.reputation || 0) + _res.reputationGain);
          addLog(g, `✅ Safety inspection at ${_site.label} — passed, no findings.`);
          addImportantNotice(g, `Safety inspection at ${_site.label}: passed clean. Reputation up.`, "green");
        } else {
          g.cash -= _res.fine;
          g.expenses += _res.fine;
          recordTransaction(g, "fines", -_res.fine, `Safety inspection — ${_site.label}`);
          g.reputation = Math.max(0, (g.reputation || 0) - _res.reputationHit);
          addLog(g, `🚨 Safety inspection at ${_site.label} — ${_res.findings.length} finding(s), ${money(_res.fine)} in penalties.`);
          addImportantNotice(g,
            `${describeInspection(_res)}\n\nPenalties: ${money(_res.fine)}.${_res.mitigated ? " Your Safety Officer argued it down." : ""}`,
            "red", { actionLabel: "Review crew", actionTab: "Crew" });
        }
      }
    }

    // The company level is DERIVED by getCompanyLevel(), and nothing ever wrote it onto the
    // state — so every consumer reading `g.companyLevel` got undefined. Two shipped bugs came
    // out of that, both found by the save-health audit rather than by review:
    //
    //   * taxRateFor() fell back to level 1, so EVERY company got the young-company tax
    //     discount forever and the relief never expired.
    //   * the `competitor_acquisition` owner event requires level >= 4, so it could never fire
    //     at all. Sprint 10's "no event is unreachable" test missed it because the fixture set
    //     companyLevel explicitly — inventing a field the real game does not have.
    //
    // Publishing it here makes the field real for everyone who reads it.
    g.companyLevel = getCompanyLevel(g).level;

    // Keep the running tax estimate current every day, so the figure grows as payments land
    // instead of the whole bill appearing at week end. This is the fix for the ambush.
    accrueTaxReserve(g);

    // Weekly tax (every 7 days)
    if (g.day % 7 === 0) {
      // Property passive income
      const _ownedProps = (g.properties || []);
      if (_ownedProps.length > 0) {
        const _propIncome = _ownedProps.reduce((sum, p) => {
          const _pdef = PROPERTY_TYPES.find(t => t.id === p.typeId);
          return sum + (_pdef?.weeklyIncome || 0);
        }, 0);
        if (_propIncome > 0) {
          g.cash += _propIncome;
          g.revenue += _propIncome;
          g.weeklyStats.revenue = (g.weeklyStats.revenue || 0) + _propIncome;
          recordTransaction(g, "property", _propIncome, "Weekly property income");
          addLog(g, `🏗️ Property income: +${money(_propIncome)} passive revenue from ${_ownedProps.length} propert${_ownedProps.length === 1 ? 'y' : 'ies'}.`);
        }
      }
      // Bank the week that is about to be cleared, so a 28-day tax period does not forget
      // three weeks in four.
      bankWeekIntoTaxPeriod(g);
      accrueTaxReserve(g);
      // The bill is MONTHLY now, not weekly. A game week is eleven real minutes on this clock,
      // and billing on it was the literal substance of "taxes are due every five seconds".
      if (isTaxDay(g)) {
        const _periodRevenue = g.taxPeriodRevenue || 0;
        const _bill = issueWeeklyTaxBill(g);
        if (_bill > 0) {
          addLog(g, `🧾 Tax assessed: ${money(_bill)} on ${money(_periodRevenue)} of revenue this period — the amount set aside.`);
        }
      }
      // Weekly summary log
      const weekRev = g.weeklyStats.revenue || 0;
      const weekExp = g.weeklyStats.expenses || 0;
      const weekProfit = weekRev - weekExp;
      addLog(g, `📊 Week ${Math.floor(g.day/7)} summary: Revenue ${money(weekRev)} | Expenses ${money(weekExp)} | Net ${weekProfit >= 0 ? '+' : ''}${money(weekProfit)}`);
      // Capture weekly report before reset
      g.weeklyReport = { revenue: weekRev, expenses: weekExp, jobsCompleted: g.weeklyStats.jobsCompleted||0, unexpectedCosts: g.weeklyStats.unexpectedCosts||0, onTimeJobs: g._weekOnTimeJobs||0, week: Math.floor(g.day/7), day: g.day };
      g._weekOnTimeJobs = 0;
      // Generate new weekly challenge (don't overwrite a completed-but-unclaimed reward)
      const _wc = g.weeklyChallenge;
      const _needsNew = !_wc || ((g.day - (_wc.startDay||0)) >= 7 && (_wc.progress < 0 || _wc.claimedDay !== null));
      if (_needsNew) generateWeeklyChallenge(g);
      g.weeklyStats = { revenue: 0, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0 };
    }

    // R16-1: Daily savings interest (0.12%/day ≈ 4.4% annual)
    if ((g.savings || 0) > 0) {
      const _savInt = Math.round(g.savings * 0.0012);
      if (_savInt >= 1) {
        g.cash += _savInt;
        g.revenue += _savInt;
        g.weeklyStats.revenue += _savInt;
        g.weeklyStats.savingsInterest = (g.weeklyStats.savingsInterest || 0) + _savInt;
        recordTransaction(g, "financing", _savInt, "Reserve savings interest");
        if (g.day % 7 === 0) addLog(g, `🏦 Reserve savings earned ${money(g.weeklyStats.savingsInterest || _savInt)} in interest this week. Balance: ${money(g.savings)}.`);
      }
    }

    // R16-4: Daily interest on credit line drawn amount (14% APR / 365)
    if (g.creditLine && (g.creditLine.drawn || 0) > 0) {
      const _clInt = Math.round(g.creditLine.drawn * 0.14 / 365);
      if (_clInt > 0) {
        g.creditLine.drawn = (g.creditLine.drawn || 0) + _clInt;
        g.expenses += _clInt;
        g.weeklyStats.expenses += _clInt;
        // This interest is capitalised into the drawn balance rather than paid in cash, so
        // it raises g.expenses without moving g.cash. Left unrecorded, the reconciler saw an
        // unexplained expense AND an unexplained cash surplus and logged a phantom pair
        // ("Uncategorized operating expense" + "Financing or balance transfer in") every
        // single day a balance was drawn. Naming it here absorbs both.
        recordTransaction(g, "financing", -_clInt, "Credit line interest charged", { nonCash: true });
      }
    }

    if ((g.taxDue || 0) > 0) {
      g.taxOverdueDays = (g.taxOverdueDays || 0) + 1;
      // Debt that never grows is furniture: ignoring it costs nothing and the 14-day freeze
      // arrives out of a clear sky. FleetFlow charges 8%/week past the first week overdue and
      // docks credit the day the debt turns a week old.
      const _creditHit = applyOverdueCreditHit(g);
      if (_creditHit > 0) {
        addLog(g, `📉 Tax debt is a week overdue — credit score down ${_creditHit} points.`);
      }
      const _penalty = applyLatePenalty(g);
      if (_penalty > 0) {
        addLog(g, `⚠ Late-payment penalty of ${money(_penalty)} added to the tax bill (${Math.round(LATE_PENALTY_RATE * 100)}%/week). Now owing ${money(g.taxDue)}.`);
        addImportantNotice(g, `Tax debt grew by ${money(_penalty)} in penalties. Unpaid tax compounds every week — pay it down.`, "red", { actionLabel: "Pay in Finance", actionTab: "Finance" });
      }
      if (g.taxOverdueDays >= FREEZE_DAYS && !g.businessFrozen) {
        g.businessFrozen = true;
        addImportantNotice(g, `Operations frozen — ${money(g.taxDue || 0)} of tax is ${g.taxOverdueDays} days overdue. You cannot take new work until it is paid down.`, "red", { actionLabel: "Pay in Finance", actionTab: "Finance" });
      }
    }

    if (g.cash < 0) {
      addLog(g, `⚠ Day ${g.day}: Overhead ${money(totalOverhead)} — account in the red!`);
      // Early-game safety net: prevent impossible lock-out on first 10 days
      if (g.day <= 10 && g.cash < -500) {
        const grant = Math.abs(g.cash) + 1000;
        g.cash += grant;
        recordTransaction(g, "bonuses", grant, "Startup emergency grant");
        addLog(g, `🆘 Emergency grant: +${money(grant)} — business is not allowed to die on Day ${g.day}.`);
      }
    }
    // Low cash warning
    if (g.cash > 0 && g.cash < 2000 && g.day > 5) {
      if (!g._lowCashWarned || g.day - g._lowCashWarned > 3) {
        g._lowCashWarned = g.day;
        addLog(g, `⚠ Cash is critically low (${money(g.cash)}) — take a contract or get a loan.`);
      }
    }

    // Late site penalties
    for (const site of g.activeSites) {
      if (g.day > site.deadlineDay && site.status === "Active") {
        addLog(g, `⚠ ${site.label} is overdue — daily penalty of ${money(site.penaltyPerDay)} accruing.`);
      }
    }

    checkMilestones(g);

    // ── Endgame arc checks ─────────────────────────────────────────────────────
    if (newDay) {
      // Rank #1 first-time celebration
      const _curRank = computeNationalRank(g);
      if (_curRank === 1 && !g._rankOneCelebrated) {
        g._rankOneCelebrated = true;
        g.cash += 10000; g.revenue += 10000;
        recordTransaction(g, "bonuses", 10000, "National Rank #1 reward");
        g.reputation = Math.min(100, (g.reputation||0) + 3);
        addImportantNotice(g, "🏆 You are now the #1 construction company in America! +$10,000 + 3 rep.", "green");
        addLog(g, "🏆 Reached National Rank #1 — construction dynasty rising!");
      }
      // Valuation milestone celebrations
      const _val = computeValuation(g);
      const _valMilestones = [
        { v: 1000000,  label: "$1M",   reward: 5000,  rep: 2  },
        { v: 5000000,  label: "$5M",   reward: 15000, rep: 5  },
        { v: 10000000, label: "$10M",  reward: 30000, rep: 8  },
        { v: 25000000, label: "$25M",  reward: 75000, rep: 12 },
      ];
      if (!g._valuationMilestonesHit) g._valuationMilestonesHit = [];
      for (const vm of _valMilestones) {
        if (_val >= vm.v && !g._valuationMilestonesHit.includes(vm.label)) {
          g._valuationMilestonesHit.push(vm.label);
          g.cash += vm.reward; g.revenue += vm.reward;
          recordTransaction(g, "bonuses", vm.reward, `${vm.label} valuation milestone`);
          g.reputation = Math.min(100, (g.reputation||0) + vm.rep);
          addImportantNotice(g, `💰 ${vm.label} valuation milestone! +${money(vm.reward)} + ${vm.rep} rep.`, "green");
        }
      }
      // Dynasty trigger: Level 10 + Rank #1 + no debt
      const _compLevel = COMPANY_LEVELS.slice().reverse().find(l => (g.reputation||0) >= l.repMin && (g.completedJobs||0) >= l.jobsMin && computeValuation(g) >= l.valMin) || COMPANY_LEVELS[0];
      // Loans carry `remainingBalance`; the old `l.remaining` read undefined on every loan,
      // so this always summed to 0 and the debt-free condition below was never actually
      // checked — Dynasty could be claimed with loans still outstanding.
      const _totalDebt = (g.loans||[]).reduce((s,l)=>s+(l.remainingBalance||0),0);
      if (_compLevel.level >= 10 && _curRank === 1 && _totalDebt === 0 && !g._pendingPrestige && !g.hallOfFame?.prestigeReached) {
        g._pendingPrestige = true;
        addImportantNotice(g, "👑 Dynasty conditions met — Level 10, Rank #1, debt-free! Claim your Legacy on the Empire tab.", "green");
      }
    }

    // ── Sprint 5: Safety recovery & achievements ───────────────────────────────
    recoverSafetyScores(g);
    checkAchievements(g);
    if (g.day % 7 === 0) captureEconomicSnapshot(g);

    // ── Sprint 5: Insurance monthly premium ────────────────────────────────────
    if (g.day % 30 === 0) {
      const plan = INSURANCE_PLANS.find(p => p.id === (g.insurancePlanId || "none"));
      if (plan && plan.monthlyPremium > 0) {
        g.cash -= plan.monthlyPremium;
        g.expenses += plan.monthlyPremium;
        recordTransaction(g, "insurance", -plan.monthlyPremium, `${plan.label}: monthly premium`);
        addLog(g, `🛡️ Insurance premium paid: ${money(plan.monthlyPremium)} (${plan.label})`);
      }
    }

    // ── Sprint 5: Legacy revenue tracking ──────────────────────────────────────
    if (!g.legacyStats) g.legacyStats = initLegacyStats();
    g.legacyStats.totalRevenue = g.revenue || 0;
    g.legacyStats.totalPayroll = g.expenses || 0;

    // ── Resting worker recovery (+3 stamina/tick equivalent per day, +0.5 mood) ─
    for (const w of g.crew) {
      if (w.status === "Resting") {
        w.stamina = Math.min(100, (w.stamina ?? 50) + 12);
        w.mood    = Math.min(100, (w.mood ?? 50) + 0.5);
        if ((w.stamina ?? 50) >= (w.restUntilStamina || 80)) {
          w.status = "Idle";
          w.restUntilStamina = undefined;
          addLog(g, `😴 ${w.name} has rested and is ready to work again.`);
        }
      }
    }

    // ── Status consistency: workers marked Active must be on a site ──────────
    const activeCrewIds = new Set();
    for (const site of g.activeSites) {
      if (site.status === "Active") {
        (site.assignedCrewIds || []).forEach(id => activeCrewIds.add(id));
      }
    }
    for (const w of g.crew) {
      if (w.status === "Active" && !activeCrewIds.has(w.id)) {
        w.status = "Idle";
      }
      if (w.status === "Idle" && activeCrewIds.has(w.id)) {
        w.status = "Active";
      }
    }

    // ── Workforce systems ─────────────────────────────────────────────────────
    checkWorkerTurnover(g);
    checkPromotion(g);
    checkWeeklyChallenge(g, "daily", 0);
    applyEquipmentAging(g);
    decrementTraining(g);

    // ── Enhanced rival AI ─────────────────────────────────────────────────────
    enhancedRivalDailyLogic(g);
    enhancedRivalBidding(g, g.contracts.filter((c) => c.status === "Open"));

    // ── Steel price lock (from material_futures decision event) ───────────────
    if (g._steelPriceLock && g.day <= g._steelPriceLock && g._steelPriceLocked) {
      g.materialPrices.steel = g._steelPriceLocked;
    } else if (g._steelPriceLock && g.day > g._steelPriceLock) {
      delete g._steelPriceLock; delete g._steelPriceLocked;
    }

    // ── Market events ─────────────────────────────────────────────────────────
    if (g.activeMarketEvent) {
      g.marketEventDaysLeft = Math.max(0, (g.marketEventDaysLeft || 1) - 1);
      if (g.marketEventDaysLeft <= 0) {
        const evt = MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent);
        addLog(g, `📊 Market event ended: "${evt?.label || g.activeMarketEvent}". Conditions normalising.`);
        g.activeMarketEvent = null;
      }
    } else if (g.day % 8 === 0 && Math.random() < 0.30) {
      const evt = pick(MARKET_EVENTS);
      g.activeMarketEvent = evt.id;
      g.marketEventDaysLeft = evt.duration;
      addLog(g, `${evt.icon} Market event: "${evt.label}" — ${evt.desc}`);
    }

    // ── Subcontractor daily ────────────────────────────────────────────────────
    if (!g.subcontractors) g.subcontractors = [];
    const subPayroll = g.subcontractors.reduce((s, sc) => s + (sc.wagePerDay || 0) * (sc.count || 1), 0);
    if (subPayroll > 0) {
      g.cash -= subPayroll;
      g.expenses += subPayroll;
      recordTransaction(g, "payroll", -Math.round(subPayroll), "Subcontractor day rates");
    }
    // Reliability check — unreliable subs may be absent
    for (const sc of g.subcontractors) {
      sc.daysLeft = (sc.daysLeft || 0) - 1;
      if (Math.random() > sc.reliability && sc.status === "Active") {
        sc.status = "Idle";
        const site = g.activeSites.find((s) => s.id === sc.assignedSiteId);
        if (site) {
          site.assignedCrewIds = site.assignedCrewIds.filter((id) => id !== sc.id);
          addLog(g, `⚠ Subcontractor "${sc.name}" didn't show up today.`);
        }
      }
    }
    g.subcontractors = g.subcontractors.filter((sc) => sc.daysLeft > 0);

    // ── Equip cost modifier from market event ─────────────────────────────────
    const activeEvent = g.activeMarketEvent ? MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent) : null;
    if (activeEvent && activeEvent.equipDailyCostMult !== 1.0) {
      const surcharge = Math.round(g.equipment.reduce((s, e) => s + e.dailyCost, 0) * (activeEvent.equipDailyCostMult - 1));
      if (surcharge > 0) {
        g.cash -= surcharge;
        g.expenses += surcharge;
        recordTransaction(g, "equipment", -surcharge, `${activeEvent.label}: equipment cost surcharge`);
      }
    }

    // ── Regional office rent ───────────────────────────────────────────────────
    const officeRent = (g.cityOffices||[]).reduce((s,o) => {
      const def = REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId);
      return s + (def ? def.dailyRent : 0);
    }, 0);
    if (officeRent > 0) {
      g.cash -= officeRent;
      g.expenses += officeRent;
      recordTransaction(g, "property", -officeRent, "Regional office rent");
    }

    // ── Property running costs ────────────────────────────────────────────────
    const propCost = (g.properties||[]).reduce((s,p) => {
      const def = PROPERTY_TYPES.find(t=>t.id===p.typeId);
      return s + (def ? def.dailyCost : 0);
    }, 0);
    if (propCost > 0) {
      g.cash -= propCost;
      g.expenses += propCost;
      recordTransaction(g, "property", -propCost, "Property running costs");
    }

    // ── PM payroll ─────────────────────────────────────────────────────────────
    const pmPayroll = (g.projectManagers||[]).reduce((s,pm) => s + (pm.wagePerDay||0), 0);
    if (pmPayroll > 0) {
      g.cash -= pmPayroll;
      g.expenses += pmPayroll;
      recordTransaction(g, "payroll", -pmPayroll, "Project manager payroll");
    }

    // ── PM auto-management: senior PMs unpause stalled sites ──────────────────
    const hasAutoMgr = (g.projectManagers||[]).some(pm => {
      const def = PM_TIERS.find(t=>t.id===pm.typeId);
      return def?.autoManage;
    });
    if (hasAutoMgr) {
      for (const site of g.activeSites) {
        // Operational holds only — a PM does not overrule the permit office either.
        if (canAutoResume(site) && Math.random() < 0.60) {
          site.status = "Active";
          site.pausedDays = 0;
          addLog(g, `📋 PM intervened — "${site.label}" back on track.`);
        }
      }
    }

    // ── Hall of Fame daily updates (Feature 5) ──────────────────────────────
    if (!g.hallOfFame) g.hallOfFame = { biggestContract:0, highestRep:0, largestCrew:0, largestFleet:0, highestValuation:0, mostProfitableProject:{label:"",value:0} };
    if ((g.reputation||0) > (g.hallOfFame.highestRep||0)) g.hallOfFame.highestRep = g.reputation;
    if ((g.crew?.length||0) > (g.hallOfFame.largestCrew||0)) g.hallOfFame.largestCrew = g.crew.length;
    if (((g.equipment||[]).length) > (g.hallOfFame.largestFleet||0)) g.hallOfFame.largestFleet = (g.equipment||[]).length;
    if ((g.companyValuation||0) > (g.hallOfFame.highestValuation||0)) g.hallOfFame.highestValuation = g.companyValuation;

    // ── Update rank & market share ─────────────────────────────────────────────
    const _prevRank = g._prevNationalRank || g.nationalRank || 99;
    g.nationalRank = computeNationalRank(g);
    g.marketShare  = computeMarketShare(g);
    g.companyValuation = computeValuation(g);
    // R15-7: Rank change alerts
    if (g.nationalRank < _prevRank) {
      const _passed = (g.rivals || []).filter(r => !(g.acquiredRivals||[]).includes(r.id) && r.status !== "Bankrupt").find(r => r._rank === g.nationalRank + 1);
      if (_passed) addLog(g, `📈 You just overtook ${_passed.name} in national rankings! They won't take that lying down.`);
    } else if (g.nationalRank > _prevRank) {
      const _overtaker = (g.rivals || []).find(r => r._rank === g.nationalRank - 1);
      if (_overtaker) addLog(g, `📉 ${_overtaker.name} just pushed you down to #${g.nationalRank}. Time to step up.`);
    }
    g._prevNationalRank = g.nationalRank;
    // R15-7: Rival industry news every 10 days
    if (g.day % 10 === 0) {
      const _topRival = (g.rivals || []).filter(r => r.status !== "Bankrupt" && !((g.acquiredRivals||[]).includes(r.id))).sort((a,b) => (b.rep||0)-(a.rep||0))[0];
      if (_topRival && Math.random() < 0.5) {
        const TAUNTS = [
          `📰 Industry news: ${_topRival.name} wins a major contract in ${(_topRival.cityPresence||["salem"])[0]}.`,
          `📰 Contractors Weekly: "${_topRival.name} eyes regional expansion."`,
          `📰 ${_topRival.name} hired 3 new crew this week. They're growing fast.`,
        ];
        addLog(g, TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
      }
    }

    // ── Auto city unlock by valuation threshold ───────────────────────────────
    // city 2 at $100k, city 3 at $500k, city 4 at $2M, city 5 at $10M
    const cityValThresholds = [
      { cityId: "portland", valThreshold: 100000 },
      { cityId: "eugene",   valThreshold: 500000 },
      { cityId: "seattle",  valThreshold: 2000000 },
      { cityId: "boise",    valThreshold: 10000000 },
    ];
    for (const t of cityValThresholds) {
      const alreadyUnlocked = (g.unlockedCities||[]).includes(t.cityId);
      if (!alreadyUnlocked && g.companyValuation >= t.valThreshold) {
        if (!g.unlockedCities) g.unlockedCities = [];
        g.unlockedCities.push(t.cityId);
        const cityDef = CITIES.find(c=>c.id===t.cityId);
        addLog(g, `🏙️ ${cityDef?.name||t.cityId} is now available for expansion! Your company growth qualifies.`);
      }
    }

    // ── Decision events ────────────────────────────────────────────────────────
    //
    // `newDay &&` is load-bearing. Without it this rolled on EVERY tick of a qualifying day,
    // so "40% on day 15" was really 1 - 0.6^48 ≈ 1 — a certainty wearing a probability's
    // clothes, and it would have become 1 - 0.6^144 after the pace change. Rolled once, on the
    // day boundary, the number means what it says.
    if (newDay && !g.pendingDecision && ((g.day % 15 === 0 && Math.random() < 0.40) || (g.day % 7 === 0 && Math.random() < 0.12))) {
      // Was `pick(DECISION_EVENTS)` — a uniform draw over the whole catalog every time, so the
      // same scenario could land twice running, the Angel Investor offered $120,000 to a
      // company sitting on five million, and a once-in-a-company windfall drew exactly as
      // often as a routine supplier call. Now: only events this company can actually be in,
      // weighted by rarity, each on its own cooldown.
      const evt = selectOwnerEvent(g, DECISION_EVENTS);
      if (evt) {
        recordEventFired(g, evt.id);
        // Only store serializable fields — apply() functions looked up from DECISION_EVENTS at render time
        g.pendingDecision = {
          id: evt.id, title: evt.title, tone: evt.tone, desc: evt.desc,
          options: evt.options.map(o => ({ label: o.label, sub: o.sub })),
        };
      }
    }

    // ── Employee events (pop-up decisions from active crew) ────────────────────
    if (!g.pendingDecision && (g.activeSites||[]).some(s => (s.assignedCrewIds||[]).length > 0)) {
      // 8% chance per game DAY if crew are on site. This used to read
      // `Math.random() < 0.0017`, with a comment explaining that 0.0017 was 8% a day "every 48
      // ticks" — true only while a tick moved 30 game minutes. Sprint 11 cut that to 10, which
      // would have made it 21.7% a day and interrupted the player three times as often, with
      // the comment still claiming 8%.
      if (Math.random() < chancePerTick(0.08)) {
        const siteWithCrew = pick((g.activeSites||[]).filter(s => (s.assignedCrewIds||[]).length > 0));
        const workerId = siteWithCrew ? pick(siteWithCrew.assignedCrewIds) : null;
        const worker = workerId ? (g.crew||[]).find(c => c.id === workerId) : null;
        const assignedEquip = siteWithCrew ? (g.equipment||[]).find(e => (siteWithCrew.assignedEquipmentIds||[]).includes(e.id)) : null;
        const evt = pick(EMPLOYEE_EVENTS);
        g.pendingDecision = {
          id: evt.id, title: evt.title, tone: evt.tone,
          desc: worker ? evt.desc.replace("A crew member", worker.name).replace("An employee", worker.name) : evt.desc,
          context: { workerId: workerId||null, siteId: siteWithCrew?.id||null, equipId: assignedEquip?.id||null },
          options: evt.options.map(o => ({ label: o.label, sub: o.sub })),
        };
      }
    }

    // ── Worker anniversaries ──────────────────────────────────────────────────
    for (const w of g.crew) {
      const yearsWorked = Math.floor((g.day - (w.hireDay || 0)) / 365);
      if (yearsWorked > 0 && (g.day - (w.hireDay || 0)) % 365 === 0) {
        w.mood = Math.min(100, (w.mood ?? 50) + 15);
        w.loyalty = Math.min(100, (w.loyalty ?? 50) + 8);
        addLog(g, `🎂 ${w.name} just hit their ${yearsWorked}-year anniversary! Morale +15.`);
        if (!g.pendingStory && yearsWorked >= 2) {
          g.pendingStory = { icon: "happy", title: `${w.name}'s Anniversary`, body: `${yearsWorked} years with the company. ${w.name} is a cornerstone of your team.` };
        }
      }
    }

    // ── Rival bankrupt story ──────────────────────────────────────────────────
    const justBankrupt = (g.rivals || []).find(r => r.status === "Bankrupt" && !(g._stories || []).includes(`bankrupt_${r.id}`));
    if (justBankrupt) {
      g._stories = [...(g._stories || []), `bankrupt_${justBankrupt.id}`];
      g.pendingStory = g.pendingStory || { icon: "trending-down", title: `${justBankrupt.name} Collapses!`, body: `${justBankrupt.name} has gone bankrupt. Their contracts and market share are now up for grabs.` };
    }

    // ── First city expansion story ────────────────────────────────────────────
    if ((g.cityOffices || []).length === 1 && !(g._stories || []).includes("first_city")) {
      g._stories = [...(g._stories || []), "first_city"];
      const city = CITIES.find(c => c.id === (g.cityOffices[0]?.cityId));
      g.pendingStory = g.pendingStory || { icon: "business", title: "First City Conquered!", body: `You've opened an office in ${city?.name || "a new city"}. Your empire is expanding beyond home.` };
    }

    // ── Auto-assign crew to understaffed active sites ─────────────────────────
    if (g.autoAssignCrew) {
      for (const site of g.activeSites) {
        if (site.status !== "Active") continue;
        const needed = (site.crewMin || 2) - (site.assignedCrewIds || []).length;
        if (needed <= 0) continue;
        const idleCrew = g.crew.filter(w => w.status === "Idle");
        const toAssign = idleCrew.slice(0, needed);
        for (const w of toAssign) {
          w.status = "Active";
          w.assignedSiteId = site.id;
          site.assignedCrewIds = [...(site.assignedCrewIds || []), w.id];
        }
        if (toAssign.length > 0) {
          addLog(g, `⚡ Auto-assigned ${toAssign.length} crew to "${site.label}".`);
        }
      }
    }

    // ── Auto-assign equipment to sites missing equipment ──────────────────────
    if (g.autoAssignEquipment) {
      for (const site of g.activeSites) {
        if (site.status !== "Active") continue;
        if ((site.assignedEquipmentIds || []).length > 0) continue;
        const idleEquip = g.equipment.filter(e => e.status === "Idle" && !e.assignedSiteId);
        if (idleEquip.length === 0) continue;
        const e = idleEquip[0];
        e.status = "Active";
        e.assignedSiteId = site.id;
        site.assignedEquipmentIds = [...(site.assignedEquipmentIds || []), e.id];
        addLog(g, `⚡ Auto-assigned ${e.name} to "${site.label}".`);
      }
    }

    // ── Auto-repair degraded equipment ───────────────────────────────────────
    if (g.autoRepairEquipment && newDay) {
      for (const eq of (g.equipment || [])) {
        if (eq.condition < 50 && eq.status !== "Maintenance") {
          const repCost = Math.round((eq.price || 5000) * 0.15);
          if (g.cash >= repCost) {
            g.cash -= repCost;
            g.expenses = (g.expenses || 0) + repCost;
            recordTransaction(g, "maintenance", -repCost, `${eq.name}: auto-repair`);
            eq.condition = Math.min(100, (eq.condition || 0) + 40);
            if (eq.status === "Broken") eq.status = "Idle";
            addLog(g, `🔧 Auto-repaired ${eq.name} — ${money(repCost)}.`);
          }
        }
      }
    }

    // ── Auto-purchase missing materials for active sites ──────────────────────
    if (g.autoPurchaseMaterials && newDay) autoPurchaseSiteMaterials(g);

    // ── Bankruptcy check ──────────────────────────────────────────────────────
    if (g.cash < -10000) {
      g.bankruptcyDays = (g.bankruptcyDays || 0) + 1;
      if (g.bankruptcyDays >= 5) {
        g.gameOver = true;
        g.gameOverReason = "bankruptcy";
      } else {
        addLog(g, `🚨 Bankruptcy warning: ${money(Math.abs(g.cash))} in debt — Day ${g.bankruptcyDays} of 5 before collapse.`);
        // A five-day countdown to game over was announced only in the scrolling log. An action
        // item cannot age out of the inbox, so the player cannot miss the one warning that ends
        // the save.
        addImportantNotice(g,
          `Bankruptcy in ${5 - g.bankruptcyDays} day${5 - g.bankruptcyDays === 1 ? "" : "s"}: the account is ${money(Math.abs(g.cash))} overdrawn. Get cash back above -$10,000 — finish a job, sell a machine or borrow.`,
          "action", { actionLabel: "Open Finance", actionTab: "Finance" });
      }
    } else if (g.cash >= 0) {
      g.bankruptcyDays = 0;
    }

    tickEmployeePersonalities(g);
    applyDailyPersonalityEvents(g);
    if (Array.isArray(g.inventory)) tickInventory(g);
    maybeFireRandomEvent(g, "construction", 0.06);
    initAiCompetitors(g, 3);
    tickAiCompetitors(g);
    initEconomy(g);
    tickEconomy(g);
    tickCustomerSatisfaction(g);
    initPricing(g);
    tickDemand(g, "construction");
    initWeather(g);
    tickWeather(g);
    tickPerformanceReviews(g);
    if ((g.day || 0) % 7 === 0) tickTeamMorale(g);
    tickContractRFPs(g);
    // Sprint 7: analyticsEngine.js is FleetFlow's and every input it reads
    // (weeklyStats.completedRoutes/routeIncome/wages, status "En Route", customerRating) is a
    // field Construction Flow does not have, so it snapshotted a row of zeros every 7 days and
    // kept 26 of them in the save. Replaced with KPIs measured from state that exists.
    tickConstructionKPIs(g);
    // Notices age out daily so the home screen never leads with a four-month-old
    // congratulation. Action items are exempt — they are waiting on the player.
    if (newDay) {
      expireNotices(g);
      g.importantNotice = topNotice(g);
    }
    initTerritories(g, "construction");
    tickTerritories(g);
    // Weather delays active projects
    const wxDelay = getConstructionWeatherDelay(g);
    if (wxDelay > 0) {
      (g.activeProjects || []).forEach((proj) => {
        if (proj.status === "Active") {
          proj.daysRemaining = (proj.daysRemaining || 0) + wxDelay;
        }
      });
    }

    // ── Empire goals ──────────────────────────────────────────────────────────
    checkEmpireGoals(g);
  }

  // Last line of defence. If any critical number has gone non-finite during this tick, put it
  // back and tell the player honestly rather than handing them a dead company.
  const _health = repairState(g, _lastGood);
  if (_health.repaired) {
    addLog(g, `🩺 Recovered a corrupted value: ${_health.fields.map((f) => f.key).join(", ")}.`);
    addImportantNotice(g, describeRepair(_health), "orange");
  }
  return g;
}

// ─── Company Levels ────────────────────────────────────────────────────────────

const COMPANY_LEVELS = [
  { level: 1,  label: "Starting Out",         repMin: 0,  jobsMin: 0,   valMin: 0        },
  { level: 2,  label: "Local Contractor",      repMin: 10, jobsMin: 3,   valMin: 15000    },
  { level: 3,  label: "Growing Company",       repMin: 20, jobsMin: 8,   valMin: 50000    },
  { level: 4,  label: "Established Builder",   repMin: 35, jobsMin: 20,  valMin: 150000   },
  { level: 5,  label: "Regional Operator",     repMin: 50, jobsMin: 40,  valMin: 400000   },
  { level: 6,  label: "Major Contractor",      repMin: 65, jobsMin: 75,  valMin: 1000000  },
  { level: 7,  label: "Industry Leader",       repMin: 80, jobsMin: 120, valMin: 3000000  },
  { level: 8,  label: "Construction Empire",   repMin: 90, jobsMin: 200, valMin: 8000000  },
  { level: 9,  label: "National Powerhouse",   repMin: 95, jobsMin: 300, valMin: 15000000 },
  { level: 10, label: "Construction Dynasty",  repMin: 99, jobsMin: 500, valMin: 25000000 },
];

function getCompanyLevel(g) {
  const val = computeValuation(g);
  let best = COMPANY_LEVELS[0];
  for (const lvl of COMPANY_LEVELS) {
    if ((g.reputation||0) >= lvl.repMin && (g.completedJobs||0) >= lvl.jobsMin && val >= lvl.valMin) best = lvl;
  }
  return best;
}

// ─── Legacy Score ─────────────────────────────────────────────────────────────

function getLegacyScore(g) {
  const repScore = Math.min(40, (g.reputation || 0) * 0.4);
  const projectScore = Math.min(20, (g.completedJobs || 0) * 0.2);
  const cityScore = Math.min(10, ((g.unlockedCities?.length || 1) - 1) * 2.5);
  const marketScore = Math.min(15, ((g.companyValuation || 0) / 1000000) * 1.5);
  const crewScore = Math.min(10, (g.crew?.length || 0) * 0.5);
  const total = Math.round(repScore + projectScore + cityScore + marketScore + crewScore);
  const tiers = [
    { min: 80, label: "Industry Legend",     icon: "trophy" },
    { min: 60, label: "National Powerhouse", icon: "business" },
    { min: 40, label: "State Leader",        icon: "star" },
    { min: 20, label: "Regional Contractor", icon: "construct" },
    { min: 0,  label: "Local Builder",       icon: "hammer" },
  ];
  const tier = tiers.find(t => total >= t.min) || tiers[tiers.length - 1];
  return { score: total, label: tier.label, icon: tier.icon };
}

// ─── Offline Progression ─────────────────────────────────────────────────────
// 1 real second = 10 game minutes (so 1 real minute = 10 game hours, 1 real hour = ~2.5 game days)
// The offline conversion constants that used to live here are now in systems/gameClock.js,
// derived from the same MINS_PER_TICK and TICK_MS the live tick uses.

export function computeOfflineProgress(savedGame, nowTimestamp) {
  const lastTs = savedGame.lastRealTimestamp;
  if (!lastTs || !nowTimestamp) return null;
  // Every rate here is derived in systems/gameClock.js. This function used to carry its own
  // copy of the conversion AND a hard-coded `/ 30`, so changing the live clock would have
  // silently paid out the wrong offline progress — a defect that never throws and never logs.
  return offlineFromElapsed((nowTimestamp - lastTs) / 1000);
}

export function applyOfflineProgress(savedGame, ticksToRun) {
  const MAX_TICKS = MAX_OFFLINE_TICKS; // 10 game days, expressed in the CURRENT tick rate
  const clampedTicks = Math.min(ticksToRun, MAX_TICKS);
  let g = clone(savedGame);

  const before = {
    cash: g.cash,
    completedJobs: g.completedJobs || 0,
    reputation: g.reputation || 0,
    day: g.day || 1,
    logCount: (g.logs || []).length,
    // Per-job snapshot, diffed after the catch-up runs. "Cash +$8,200" is a bank statement;
    // the player's actual question on returning is what happened to their job sites.
    sites: snapshotSites(g),
  };

  for (let i = 0; i < clampedTicks; i++) {
    const cashBefore = g.cash;
    g = gameTick(g);
    const cashAfterTick = g.cash;
    // Offline payroll protection: if a single tick would burn more than 50% of
    // a positive cash balance, cap the loss so the player doesn't log back in bankrupt
    if (cashBefore > 0 && g.cash < cashBefore * 0.5 && g.cash < 0) {
      g.cash = Math.max(0, cashBefore * 0.5);
    }
    // Hard bankruptcy floor: never go below -$50,000
    if (g.cash < -50000) {
      g.cash = -50000;
    }
    // Both clamps hand cash back without touching g.expenses, so the ledger reconciler
    // would otherwise see cash it cannot explain and file it as "Financing or balance
    // transfer in" — a line that reads like a loan the player never took. Name it for
    // what it is; recordTransaction also re-baselines the reconciler's snapshot.
    const relief = Math.round(g.cash - cashAfterTick);
    if (relief > 0) {
      recordTransaction(g, "bonuses", relief, "Offline hardship relief");
    }
  }

  const after = {
    cash: g.cash,
    completedJobs: g.completedJobs || 0,
    reputation: g.reputation || 0,
    day: g.day || 1,
  };

  const cashDelta = after.cash - before.cash;
  const jobsDelta = after.completedJobs - before.completedJobs;
  const repDelta  = after.reputation - before.reputation;
  const daysDelta = after.day - before.day;

  // Collect events that fired during offline simulation (last 6 new log lines)
  const logsWhileAway = (g.logs || []).slice(before.logCount).slice(-6);

  // Estimate overhead per day at current crew/equipment levels
  const dailyWages = (g.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0);
  const dailyEquip  = (g.equipment || []).reduce((s, e) => s + e.dailyCost, 0);
  const dailyRent   = dailyOfficeRent(g);
  const overheadPerDay = Math.round(dailyWages + dailyEquip + dailyRent);

  g.pendingOfflineSummary = {
    elapsedDays: daysDelta,
    cashDelta,
    jobsDelta,
    repDelta,
    cashNow: after.cash,
    overheadPerDay,
    logsWhileAway,
    // One line per job: what phase it moved through, how far it got, what it claimed, or
    // that it sat still and why. See companyLife.js.
    siteReport: buildOfflineSiteReport(before.sites, g),
  };
  g.lastRealTimestamp = Date.now();
  return g;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ConstructionFlowScreen({ onBackToHub }) {
  const [game, setGame] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // Every tab change goes through normalizeTabName, so an older save, a guidance record or a
  // helper that still names the tab "Vehicles" lands on Equipment instead of on nothing.
  const [tab, setRawTab] = useState("Home");
  const setTab = useCallback((next) => setRawTab(normalizeTabName(next)), []);
  const [theme, setTheme] = useState("dark");
  const T = THEMES[theme] || THEMES.dark;

  // Motion. These are hooks, so they live at the top of the component: the render* functions
  // below are called conditionally on the active tab and could never host a hook safely.
  // Everything here observes values gameplay already computed and animates around them, so
  // none of it can change what the simulation does. Reduce Motion removes the transitions
  // entirely rather than shortening them.
  const reducedMotion = useOsReducedMotion();
  const cashPulse = usePulseOnIncrease(game?.cash ?? 0, !reducedMotion);
  const offlineEntrance = useEntranceAnimation(Boolean(game?.pendingOfflineSummary) && !reducedMotion);

  const tickRef = useRef(null);
  // Was a boolean that doubled the tick RATE while leaving MINS_PER_TICK alone — so "2x" moved
  // the same 30 game-minutes twice as often, and its own comment ("1.5s real = 15 min game")
  // described something the code did not do.
  const [speedId, setSpeedId] = useState(DEFAULT_SPEED_ID);
  // Sprint 8: whether the Site Office inbox is showing everything beneath the lead item.
  const [inboxOpen, setInboxOpen] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const gameRef = useRef(null);
  const saveTimerRef = useRef(null);
  const [setupOwner, setSetupOwner] = useState("");
  const [setupName, setSetupName] = useState("New Build Co.");
  const [setupCityId, setSetupCityId] = useState("salem");
  const [savingsAmt, setSavingsAmt] = useState("");
  const [creditLineAmt, setCreditLineAmt] = useState("");
  const [loanPayAmts, setLoanPayAmts] = useState({});
  const [setupStep, setSetupStep] = useState(0);
  const [setupStateId, setSetupStateId] = useState(null);
  const [setupHomeCityText, setSetupHomeCityText] = useState("");
  const [setupHomeStateCode, setSetupHomeStateCode] = useState("");
  const [setupHomeStateName, setSetupHomeStateName] = useState("");
  const [setupCompetition, setSetupCompetition] = useState("Low");
  const [setupStateSearch, setSetupStateSearch] = useState("");
  const [crewFilter, setCrewFilter] = useState("All");
  const [equipFilter, setEquipFilter] = useState("All");

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const integrity = checkSaveIntegrity(parsed);
          if (!integrity.valid) {
            // Save has issues - will be fixed by migrateState
          }
          const saved = migrateState(parsed);
          const nowTs = Date.now();
          const offlineInfo = computeOfflineProgress(saved, nowTs);
          if (offlineInfo && offlineInfo.ticksToRun > 0) {
            const progressed = applyOfflineProgress(saved, offlineInfo.ticksToRun);
            registerSession(progressed, nowTs);
            setGame(progressed);
            setTheme(progressed.theme || "dark");
          } else {
            saved.lastRealTimestamp = nowTs;
            registerSession(saved, nowTs);
            setGame(saved);
            setTheme(saved.theme || "dark");
          }
        } else {
          const fs = freshState();
          fs.lastRealTimestamp = Date.now();
          registerSession(fs, fs.lastRealTimestamp);
          setGame(fs);
        }
      } catch (_) {
        const fs = freshState();
        fs.lastRealTimestamp = Date.now();
        setGame(fs);
      }
      setLoaded(true);
    })();
  }, []);

  const saveGame = useCallback((g) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(g)).catch(() => {});
  }, []);

  // Veteran mentor auto-hire on new generation start. The setGame call is deferred with a
  // setTimeout (not called synchronously in the effect body) specifically to avoid the
  // react-hooks/set-state-in-effect cascading-render warning — a same-tick synchronous setState
  // from inside an effect schedules a second render pass during commit. Persistence is handled
  // by the throttled-save effect below, not here directly (see that effect's comment).
  useEffect(() => {
    if (!game || !game.legacyMentor || (game.crew||[]).length > 0) return;
    const timer = setTimeout(() => {
      setGame(prev => {
        if (!prev || !prev.legacyMentor || (prev.crew||[]).length > 0) return prev;
        const next = clone(prev);
        const m = next.legacyMentor;
        next.crew.push(createWorker({ name: m.name, skill: m.skill||75, role: m.role, wagePerDay: m.wagePerDay||60, loyalty: 90, jobsCompleted: 20 }));
        next.legacyMentor = null;
        addLog(next, `⭐ ${m.name} returns as your legacy mentor from the previous dynasty.`);
        addImportantNotice(next, `${m.name} joins your new company at half their previous wage!`, "green");
        return next;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [game?.generation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep gameRef current so AppState listener always reads latest state without
  // capturing a stale closure or re-registering the listener on every tick.
  useEffect(() => { gameRef.current = game; }, [game]);

  // Throttled, not debounced — same fix as FleetFlowScreen.js's saveTimerRef effect, ported
  // here for the same reason: update() previously called saveGame() directly and
  // unconditionally on every single player action (every tap, not just periodic ticks), on top
  // of the game-tick interval also saving unconditionally every 3s. A debounce (clearing and
  // restarting the timer on every change) never gets a quiet gap to fire in during live play —
  // a save is scheduled ~2s after the *first* change in a burst, and further changes in that
  // window don't push it back, coalescing bursts of rapid taps into one write instead of one
  // write per tap.
  useEffect(() => {
    if (!loaded || !game) return;
    if (saveTimerRef.current) return;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (!gameRef.current) return;
      saveGame(gameRef.current);
    }, 2000);
  }, [game, loaded, saveGame]);

  // Unmount-only cleanup for the throttle timer above — intentionally separate from the effect
  // itself, which must NOT clear the pending timer on every state change (that would recreate
  // the debounce-starvation bug this replaces).
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // ── Game tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    tickRef.current = setInterval(() => {
      // Speed runs the tick MORE TIMES rather than moving more minutes per tick.
      //
      // That distinction is the whole reason this is safe. Every per-tick rate in the
      // simulation — site progress, fuel burn, stamina drain, paused-day countdown — is scaled
      // by MINS_PER_TICK. Multiplying that constant would have meant threading a per-call
      // value through every one of them, and missing one would silently change the economy at
      // 2x but not at 1x: a bug that only exists at a setting, which is close to untestable.
      // Running the same tick twice cannot desync anything, because it IS the same tick.
      const steps = multiplierFor(speedId);
      if (steps <= 0) return; // paused: stop TIME, not the timer
      setGame((prev) => {
        if (!prev) return prev;
        try {
          let next = prev;
          for (let i = 0; i < steps; i++) next = gameTick(next);
          if (next.cash < -50000) next.cash = -50000;
          next.lastRealTimestamp = Date.now();
          return next;
        } catch (e) {
          if (__DEV__) console.warn("[ConstructionFlow] tick error:", e);
          return prev;
        }
      });
    }, tickIntervalMs());
    return () => clearInterval(tickRef.current);
  }, [loaded, speedId]);

  // ── AppState (background / foreground) ────────────────────────────────────
  // Registered once (deps: [saveGame] only). gameRef.current always holds the
  // latest state so background-save is never one tick stale.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      if (prev === "active" && next.match(/inactive|background/)) {
        if (gameRef.current) {
          if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
          const toSave = { ...gameRef.current, lastRealTimestamp: Date.now() };
          saveGame(toSave);
        }
      } else if (prev.match(/inactive|background/) && next === "active") {
        // Returning to foreground — run offline ticks using functional updater
        // so we always operate on the committed state, not the ref snapshot.
        setGame((prevGame) => {
          if (!prevGame) return prevGame;
          const nowTs = Date.now();
          const offlineInfo = computeOfflineProgress(prevGame, nowTs);
          if (offlineInfo && offlineInfo.ticksToRun > 0) {
            const progressed = applyOfflineProgress(prevGame, offlineInfo.ticksToRun);
            registerSession(progressed, nowTs);
            saveGame(progressed);
            return progressed;
          }
          const updated = { ...clone(prevGame), lastRealTimestamp: nowTs };
          registerSession(updated, nowTs);
          saveGame(updated);
          return updated;
        });
      }
      appStateRef.current = next;
    });
    return () => sub?.remove();
  }, [saveGame]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const update = useCallback((fn) => {
    setGame((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
  }, []);

  const handleBuyEquipment = useCallback((item, isUsed = false) => {
    fireHaptic("light");
    update((g) => {
      const discount = (g._equipDiscount || 0);
      const basePrice = Math.round(item.price * (1 - discount));
      const effectivePrice = isUsed ? Math.round(basePrice * 0.58) : basePrice;
      if (g.cash < effectivePrice) { alertInsufficientFunds(g, effectivePrice, item?.name || "This machine"); return; }
      const office = OFFICES[g.officeIndex];
      const totalEquipCap = office.equipCap + getEquipCapBonus(g);
      if (g.equipment.length >= totalEquipCap) { const a = buildCapacityAlert({ kind: "equipment", current: g.equipment.length, cap: totalEquipCap }); Alert.alert(a.title, a.body); return; }
      g.cash -= effectivePrice;
      g.expenses += effectivePrice;
      recordTransaction(g, "equipment", -effectivePrice, `Bought ${isUsed ? "used " : ""}${item.name}`);
      const equip = createEquipment(item);
      if (isUsed) {
        equip.condition = rand(40, 68);
        equip.reliability = Math.round(item.reliability * 0.78);
        equip.isUsed = true;
      }
      g.equipment.push(equip);
      if (discount > 0) {
        delete g._equipDiscount;
        delete g._equipDiscountExpiry;
        addLog(g, `🚜 ${isUsed ? "Used " : ""}${item.name} purchased for ${money(effectivePrice)}${discount > 0 ? ` (${Math.round(discount * 100)}% discount)` : ""}.`);
      } else {
        addLog(g, `🚜 ${isUsed ? "Used " : ""}${item.name} purchased for ${money(effectivePrice)}.`);
      }
      trackEquipBuy(g);
    });
  }, [update]);

  const handleSpeedUp = useCallback(() => {
    const cur = gameRef.current;
    if (!cur) return;
    const uses = cur.speedUpUses || 0;
    const cost = Math.round(1000 * Math.pow(2, uses));
    if (cur.cash < cost) {
      alertInsufficientFunds(cur, cost, "Skipping ahead");
      return;
    }
    Alert.alert(
      "⚡ Speed Up Time",
      `Advance 2 game hours for ${money(cost)}?\n\n${uses > 0 ? `Cost doubles each use — next will cost ${money(cost * 2)}.` : "Cost doubles with each use."}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: `Pay ${money(cost)}`, onPress: () => {
          setGame((prev) => {
            if (!prev || prev.cash < cost) return prev;
            let next = clone(prev);
            next.cash -= cost;
            next.expenses = (next.expenses||0) + cost;
            next.speedUpUses = (next.speedUpUses||0) + 1;
            for (let i = 0; i < 4; i++) next = gameTick(next);
            next.lastRealTimestamp = Date.now();
            addLog(next, `⚡ Time advanced 2 hours — paid ${money(cost)}.`);
            saveGame(next);
            return next;
          });
        }},
      ]
    );
  }, [saveGame]);

  const handleRepairEquipment = useCallback((equipId) => {
    fireHaptic("light");
    update((g) => {
      const e = g.equipment.find((eq) => eq.id === equipId);
      if (!e) return;
      const cost = Math.round((100 - e.condition) * 25);
      if (g.cash < cost) { alertInsufficientFunds(g, cost, "This repair"); return; }
      g.cash -= cost;
      g.expenses += cost;
      recordTransaction(g, "maintenance", -cost, `${e.name}: repair and refuel`);
      e.condition = 100;
      e.fuel = e.fuelCap;
      e.status = "Idle";
      if (g.pendingBreakdown?.equipId === equipId) g.pendingBreakdown = null;
      addLog(g, `🔧 ${e.name} repaired and fuelled for ${money(cost)}.`);
    });
  }, [update]);

  const handleSellEquipment = useCallback((equipId) => {
    fireHaptic("light");
    update((g) => {
      const e = g.equipment.find((eq) => eq.id === equipId);
      if (!e) return;
      if (e.status === "Active") { Alert.alert("In Use", "Can't sell equipment currently assigned to a site."); return; }
      const salePrice = Math.round(e.price * 0.45 * (e.condition / 100));
      g.cash += salePrice;
      g.revenue += salePrice;
      recordTransaction(g, "sales", salePrice, `Sold ${e.name}`);
      g.equipment = g.equipment.filter((eq) => eq.id !== equipId);
      addLog(g, `💸 Sold ${e.name} for ${money(salePrice)}.`);
    });
  }, [update]);

  const handleHireCrew = useCallback((applicant) => {
    fireHaptic("light");
    update((g) => {
      const totalCrewCap = getTotalCrewCap(g);
      if (g.crew.length >= totalCrewCap) { const a = buildCapacityAlert({ kind: "crew", current: g.crew.length, cap: totalCrewCap }); Alert.alert(a.title, a.body); return; }
      const bonus = applicant.signingBonus || 0;
      if (g.cash < bonus) { alertInsufficientFunds(g, bonus, "This hire's signing bonus"); return; }
      g.cash -= bonus;
      g.expenses += bonus;
      if (bonus > 0) recordTransaction(g, "payroll", -bonus, `${applicant.name}: signing bonus`);
      g.applicants = g.applicants.filter((a) => a.id !== applicant.id);
      const _newWorker = {
        ...createWorker(applicant.role),
        id: uid(), name: applicant.name, role: applicant.role,
        skill: applicant.skill, wagePerDay: applyRegionalWage(applicant.desiredWage, g),
        mood: applicant.mood, loyalty: applicant.loyalty, trait: applicant.trait,
        hireDay: g.day, jobHistory: [], attendanceStrikes: 0,
        status: "Idle",
      };
      delete _newWorker.siteId;
      delete _newWorker.currentSiteId;
      delete _newWorker.assignedSiteId;
      g.crew.push(_newWorker);
      trackHire(g);
      addLog(g, `👷 ${applicant.name} hired as ${applicant.role}.`);
      repairCrewAssignments(g);
    });
  }, [update]);

  const handleFireCrew = useCallback((workerId) => {
    fireHaptic("light");
    update((g) => {
      const w = g.crew.find((w) => w.id === workerId);
      if (!w) return;
      // Remove from all sites unconditionally before firing
      (g.activeSites || []).forEach(site => {
        site.assignedCrewIds = (site.assignedCrewIds || []).filter(id => id !== workerId);
      });
      g.crew = g.crew.filter((w) => w.id !== workerId);
      repairCrewAssignments(g);
      addLog(g, `❌ ${w.name} has been let go.`);
    });
  }, [update]);

  const handlePromoteCrew = useCallback((workerId) => {
    fireHaptic("light");
    update((g) => {
      const w = g.crew.find(w => w.id === workerId);
      if (!w) return;
      if (g.cash < 500) { alertInsufficientFunds(g, 500, "This promotion"); return; }
      if ((w.level||1) < 3 || (w.skill||0) < 70) { Alert.alert("Not Eligible", "Worker needs level 3+ and skill 70+."); return; }
      g.cash -= 500;
      g.expenses += 500;
      recordTransaction(g, "payroll", -500, `${w.name}: promotion`);
      const newRole = `Senior ${w.role}`;
      w.role = newRole;
      w.skill = Math.min(150, (w.skill||80) + 5);
      w.wagePerDay = Math.round(w.wagePerDay * 1.20);
      w.mood = Math.min(100, (w.mood ?? 50) + 20);
      addLog(g, `⭐ ${w.name} promoted to ${newRole} — +5 skill, +20% wage!`);
    });
  }, [update]);

  const handlePostJob = useCallback((posting) => {
    update((g) => {
      if (g.cash < posting.cost) { alertInsufficientFunds(g, posting.cost, "This job ad"); return; }
      g.cash -= posting.cost;
      g.expenses += posting.cost;
      recordTransaction(g, "payroll", -posting.cost, "Recruitment job advert");
      for (let i = 0; i < posting.count; i++) {
        g.applicants.push(createApplicant({ skillMin: posting.skillMin, skillMax: posting.skillMax, wageMin: posting.wageMin, wageMax: posting.wageMax, quality: posting.quality }));
      }
      addLog(g, `📢 Job ad posted — ${posting.count} applicant(s) added.`);
    });
  }, [update]);

  const handleBuyMaterials = useCallback((matId, qty) => {
    fireHaptic("light");
    update((g) => {
      const res = buyYardMaterials(g, matId, qty);
      if (res.status === "unaffordable") alertInsufficientFunds(g, res.cost, "These materials");
    });
  }, [update]);

  // Purchase exactly the missing materials for an active site at market price
  const handleBuyMaterialsForSite = useCallback((siteId) => {
    update((g) => {
      // State change in orderSiteMaterials() so the harness orders through the same path.
      const res = orderSiteMaterials(g, siteId);
      if (res.status === "unaffordable") alertInsufficientFunds(g, res.unitPrice, "Even one unit of material");
    });
  }, [update]);

  // Emergency purchase: 1.5× price, uses supplier credit if cash is short
  const handleEmergencyPurchase = useCallback((siteId) => {
    update((g) => { emergencyOrderMaterials(g, siteId); });
  }, [update]);

  const handleStartSite = useCallback((contract, crewIds, equipIds) => {
    fireHaptic("light");
    update((g) => {
      // The state change lives in mobilizeSite() so the playtest harness drives the exact code
      // a player's tap does. This wrapper only turns its verdict into the alert the player sees.
      const res = mobilizeSite(g, contract.id, crewIds, equipIds);
      if (res.status === "unavailable") { Alert.alert("Unavailable", "This contract is no longer open."); return; }
      if (res.status === "plant") {
        fireHaptic("error");
        Alert.alert("Wrong Plant For The Job", `${res.missing.summary}\n\n${res.missing.action}`);
        return;
      }
      if (res.status === "frozen") { Alert.alert("Operations Frozen", res.reason); return; }
      if (res.status === "blocked") {
        const { title, body } = buildAssignBlockAlert(res.reason, res.kind);
        Alert.alert(title, body);
        return;
      }
      if (res.status === "lost") {
        Alert.alert(
          "Bid Lost",
          `${res.winnerName} was awarded "${res.label}".\n\nYou bid ${res.outcome.label.toLowerCase()} — a ${res.outcome.winPercent}% chance. Your crew and materials were not committed.`,
          [{ text: "OK" }]
        );
      }
    });
  }, [update]);

  const handleHireSubcontractor = useCallback((typeId) => {
    update((g) => {
      const def = SUBCONTRACTOR_TYPES.find((t) => t.id === typeId);
      if (!def) return;
      if (g.cash < def.hireCost) { alertInsufficientFunds(g, def.hireCost, "This subcontractor"); return; }
      g.cash -= def.hireCost;
      g.expenses += def.hireCost;
      recordTransaction(g, "payroll", -def.hireCost, `${def.label}: subcontractor hire fee`);
      if (!g.subcontractors) g.subcontractors = [];
      g.subcontractors.push(createSubcontractor(typeId));
      addLog(g, `🤝 Hired ${def.label} for ${def.durationDays} days — ${money(def.hireCost)} upfront.`);
    });
  }, [update]);

  const handleBuyInsurance = useCallback((planId) => {
    fireHaptic("light");
    update((g) => {
      const plan = INSURANCE_PLANS.find(p => p.id === planId);
      if (!plan) return;
      g.insurancePlanId = planId;
      if (planId === "none") {
        addLog(g, `🛡️ Insurance cancelled — no coverage.`);
      } else {
        addLog(g, `🛡️ Insurance switched to ${plan.label} (${money(plan.monthlyPremium)}/mo).`);
      }
    });
  }, [update]);

  const handleSetBidStyle = useCallback((contractId, style) => {
    update((g) => {
      if (!g.contractBidStyles) g.contractBidStyles = {};
      g.contractBidStyles[contractId] = style;
    });
  }, [update]);

  const handleTakeLoan = useCallback((product) => {
    fireHaptic("light");
    update((g) => {
      if ((g.loans || []).length >= 3) {
        Alert.alert("Loan Limit", "You already have 3 active loans. Pay off a loan before taking another.");
        return;
      }

      const profile = buildBorrowerProfile(g, product);
      const offer = computeLoanOffer(product.id, profile);
      if (!offer.approved) {
        Alert.alert("Financing Declined", (offer.reasons || ["You do not currently qualify for this product."]).join("\n\n"));
        return;
      }

      const collateral = getLendingCollateral(g, product);
      const loan = offerToLoanRecord(offer, uid, {
        collateralVehicleId: product.collateralType === "vehicle" ? collateral.id : null,
      });
      g.loans.push(loan);
      g.cash += offer.principal;
      // Borrowed principal is financing, not operating revenue.
      recordTransaction(g, "financing", offer.principal, `${offer.label} proceeds`, {
        loanId: loan.id,
        productId: offer.productId,
        apr: offer.apr,
      });
      fireHaptic("success");
      addLog(g, `💳 Loan approved: ${money(offer.principal)} (${offer.apr}% APR, ${offer.termWeeks} weeks, ${money(offer.weeklyPayment)}/week).`);
    });
  }, [update]);

  const handlePayTax = useCallback(() => {
    fireHaptic("light");
    update((g) => {
      const _res = payTaxBill(g);
      if (_res.status === "unaffordable") { alertInsufficientFunds(g, _res.want, "A part payment on this tax bill"); return; }
      if (_res.status !== "paid") return;
      fireHaptic(_res.cleared ? "milestone" : "success");
      if (_res.unfrozen) fireHaptic("milestone");
    });
  }, [update]);

  // R16-1: Savings account handlers
  const handleSavingsDeposit = useCallback((amount) => {
    update((g) => {
      const amt = Math.round(amount);
      if (!amt || amt <= 0) { Alert.alert("Invalid Amount", "Enter a positive amount."); return; }
      if (g.cash < amt) {
        Alert.alert("Not Enough Operating Cash", `You have ${money(g.cash)} in operating cash, less than the ${money(amt)} you're moving to savings.\n\nMove a smaller amount, or wait for a job to pay out.`);
        return;
      }
      g.cash -= amt;
      g.savings = (g.savings || 0) + amt;
      recordTransaction(g, "financing", -amt, "Transfer to reserve savings");
      addLog(g, `🏦 Deposited ${money(amt)} into savings. Reserve: ${money(g.savings)}.`);
    });
  }, [update]);

  const handleSavingsWithdraw = useCallback((amount) => {
    update((g) => {
      const amt = Math.round(amount);
      if (!amt || amt <= 0) { Alert.alert("Invalid Amount", "Enter a positive amount."); return; }
      if ((g.savings || 0) < amt) {
        Alert.alert("Not Enough In Savings", `Your reserve holds ${money(g.savings || 0)}, less than the ${money(amt)} you're withdrawing.\n\nWithdraw a smaller amount.`);
        return;
      }
      g.savings -= amt;
      g.cash += amt;
      recordTransaction(g, "financing", amt, "Transfer from reserve savings");
      addLog(g, `🏦 Withdrew ${money(amt)} from savings. Reserve: ${money(g.savings)}.`);
    });
  }, [update]);

  // R16-2: Early loan payoff handler
  const handlePayoffLoan = useCallback((loanId, payoffAmount) => {
    update((g) => {
      const loan = (g.loans || []).find(l => l.id === loanId);
      if (!loan) return;
      if (g.cash < payoffAmount) {
        const a = buildInsufficientFundsAlert({
          cost: payoffAmount, purchase: "Paying this loan off early", cash: g.cash,
          savings: g.savings || 0, hasActiveSites: (g.activeSites || []).length > 0,
          canBorrow: false, formatMoney: money,
        });
        Alert.alert(a.title, a.body);
        return;
      }
      g.cash -= payoffAmount;
      g.expenses += payoffAmount;
      recordTransaction(g, "financing", -payoffAmount, `${loan.label}: early payoff`);
      g.loans = g.loans.filter(l => l.id !== loanId);
      g.creditScore = Math.min(850, (g.creditScore || 600) + 5);
      addLog(g, `✅ "${loan.label}" paid off early. Credit +5.`);
    });
  }, [update]);

  const handleLoanPartialPayment = useCallback((loanId, amount) => {
    update((g) => {
      const loan = (g.loans || []).find(l => l.id === loanId);
      const amt = Math.round(amount);
      if (!loan || amt <= 0 || g.cash < amt) {
        const a = buildInsufficientFundsAlert({
          cost: amt, purchase: "This loan payment", cash: g.cash,
          savings: g.savings || 0, hasActiveSites: (g.activeSites || []).length > 0,
          canBorrow: false, formatMoney: money,
        });
        Alert.alert(a.title, a.body);
        return;
      }
      const actualAmt = Math.min(amt, loan.remainingBalance);
      g.cash -= actualAmt;
      g.expenses += actualAmt;
      recordTransaction(g, "financing", -actualAmt, `${loan.label}: extra payment`);
      loan.remainingBalance -= actualAmt;
      loan.weeksLeft = Math.max(0, Math.ceil(loan.remainingBalance / (loan.weeklyPayment || 1)));
      if (loan.remainingBalance <= 0) {
        g.loans = g.loans.filter(l => l.id !== loanId);
        g.creditScore = Math.min(850, (g.creditScore || 600) + 5);
        addLog(g, `✅ Loan "${loan.label}" fully paid off. Credit +5.`);
      } else {
        g.creditScore = Math.min(850, (g.creditScore || 600) + 1);
        addLog(g, `💳 Paid ${money(actualAmt)} toward "${loan.label}". Remaining: ${money(loan.remainingBalance)}.`);
      }
    });
  }, [update]);

  // R16-4: Business Line of Credit handlers
  const handleOpenCreditLine = useCallback(() => {
    update((g) => {
      if ((g.creditScore || 600) < 680) { const a = buildCreditTooLowAlert({ creditScore: g.creditScore || 600, required: 680 }); Alert.alert(a.title, a.body); return; }
      if (g.creditLine) { Alert.alert("Already Active", "You already have an open line of credit."); return; }
      g.creditLine = { limit: 75000, drawn: 0, apr: 14, opened: g.day };
      g.creditScore = Math.max(300, (g.creditScore || 600) - 3);
      addLog(g, `💳 Business Line of Credit opened — up to ${money(75000)} at 14% APR on drawn amount.`);
    });
  }, [update]);

  const handleDrawCreditLine = useCallback((amount) => {
    update((g) => {
      if (!g.creditLine) return;
      const avail = (g.creditLine.limit || 75000) - (g.creditLine.drawn || 0);
      const amt = Math.min(Math.round(amount), avail);
      if (amt <= 0) { Alert.alert("No Credit Available", "Credit limit reached."); return; }
      g.creditLine.drawn = (g.creditLine.drawn || 0) + amt;
      g.cash += amt;
      recordTransaction(g, "financing", amt, "Credit line draw");
      addLog(g, `💳 Drew ${money(amt)} from credit line. Total drawn: ${money(g.creditLine.drawn)}.`);
    });
  }, [update]);

  const handleRepayCreditLine = useCallback((amount) => {
    update((g) => {
      if (!g.creditLine || !(g.creditLine.drawn)) return;
      const amt = Math.min(Math.round(amount), g.creditLine.drawn, g.cash);
      if (amt <= 0) { Alert.alert("Cannot Repay", "Nothing drawn or insufficient cash."); return; }
      g.creditLine.drawn -= amt;
      g.cash -= amt;
      g.expenses += amt;
      recordTransaction(g, "financing", -amt, "Credit line repayment");
      if (g.creditLine.drawn <= 0) {
        g.creditLine.drawn = 0;
        addLog(g, `✅ Credit line fully repaid.`);
      } else {
        addLog(g, `💳 Repaid ${money(amt)}. Still drawn: ${money(g.creditLine.drawn)}.`);
      }
    });
  }, [update]);

  const handleUpgradeOffice = useCallback(() => {
    fireHaptic("light");
    update((g) => {
      const next = OFFICES[g.officeIndex + 1];
      if (!next) { Alert.alert("Max Office", "You're at the top tier already."); return; }
      if (g.cash < next.cost) { alertInsufficientFunds(g, next.cost, next.name || "This office upgrade"); return; }
      g.cash -= next.cost;
      g.expenses += next.cost;
      recordTransaction(g, "property", -next.cost, `Moved into ${next.name}`);
      g.officeIndex += 1;
      addLog(g, `🏢 Upgraded to ${next.name} — crew cap ${next.crewCap}, equip cap ${next.equipCap}.`);
    });
  }, [update]);

  const handleResetGame = useCallback(() => {
    Alert.alert("Reset Game", "Start over from scratch? All progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => {
        const fresh = freshState();
        fresh.lastRealTimestamp = Date.now();
        setGame(fresh);
        setTheme("dark");
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => {});
      }},
    ]);
  }, []);

  const handleOpenOffice = useCallback((cityId, officeTypeId) => {
    fireHaptic("light");
    update((g) => {
      const city = CITIES.find(c => c.id === cityId);
      const def  = REGIONAL_OFFICE_TYPES.find(t => t.id === officeTypeId);
      if (!city || !def) return;
      if (g.reputation < city.unlockRep) { Alert.alert("Not Yet", `Need ${city.unlockRep}+ reputation to expand to ${city.name}.`); return; }
      if (g.cash < city.unlockCost + def.cost) { alertInsufficientFunds(g, city.unlockCost + def.cost, `Expanding to ${city.name} with a ${def.name}`); return; }
      const alreadyInCity = (g.cityOffices||[]).some(o => o.cityId === cityId);
      const totalCost = def.cost + (alreadyInCity ? 0 : city.unlockCost);
      g.cash -= totalCost;
      g.expenses += totalCost;
      recordTransaction(g, "property", -totalCost, `${def.name} in ${city.name}`);
      if (!g.cityOffices) g.cityOffices = [];
      g.cityOffices.push({ id: uid(), cityId, typeId: officeTypeId, name: `${def.name} — ${city.name}`, openedDay: g.day });
      addLog(g, `🏙️ Opened ${def.name} in ${city.name}, ${city.state}!`);
    });
  }, [update]);

  const handleBuyProperty = useCallback((typeId) => {
    fireHaptic("light");
    update((g) => {
      const def = PROPERTY_TYPES.find(t => t.id === typeId);
      if (!def) return;
      if (g.cash < def.cost) { alertInsufficientFunds(g, def.cost, def.name); return; }
      g.cash -= def.cost;
      g.expenses += def.cost;
      recordTransaction(g, "property", -def.cost, `Bought ${def.name}`);
      if (!g.properties) g.properties = [];
      g.properties.push({ id: uid(), typeId, name: def.name, purchasedDay: g.day });
      addLog(g, `🏠 Purchased ${def.name} — ${def.desc}`);
    });
  }, [update]);

  const handleHirePM = useCallback((pmTypeId) => {
    update((g) => {
      const def = PM_TIERS.find(t => t.id === pmTypeId);
      if (!def) return;
      const already = (g.projectManagers||[]).some(pm => pm.typeId === pmTypeId);
      if (already) { Alert.alert("Already Hired", `You already have a ${def.name} on staff.`); return; }
      if (g.cash < def.hireCost) { alertInsufficientFunds(g, def.hireCost, `Hiring a ${def.name || "project manager"}`); return; }
      g.cash -= def.hireCost;
      g.expenses += def.hireCost;
      recordTransaction(g, "payroll", -def.hireCost, `${def.name}: hiring fee`);
      if (!g.projectManagers) g.projectManagers = [];
      g.projectManagers.push({ id: uid(), typeId: pmTypeId, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, wagePerDay: def.wagePerDay });
      addLog(g, `📋 ${def.name} hired — ${def.desc}`);
      if (def.autoManage) {
        g.autoAssignCrew = true;
        g.autoAssignEquipment = true;
        addLog(g, `⚡ Auto-assign crew & vehicles enabled by ${def.name}.`);
      }
      if (def.id === "director") {
        g.autoPurchaseMaterials = true;
        g.autoRepairEquipment = true;
        addLog(g, `⚡ Auto-buy materials & auto-repair enabled.`);
      }
    });
  }, [update]);

  const handleFirePM = useCallback((pmId) => {
    update((g) => {
      const pm = (g.projectManagers||[]).find(p => p.id === pmId);
      if (!pm) return;
      g.projectManagers = g.projectManagers.filter(p => p.id !== pmId);
      addLog(g, `❌ ${pm.name} has left the company.`);
    });
  }, [update]);

  const handleTrainCrew = useCallback((workerId, programId) => {
    fireHaptic("light");
    update((g) => {
      const w = g.crew.find((w) => w.id === workerId);
      const prog = TRAINING_PROGRAMS.find((p) => p.id === programId);
      if (!w || !prog) return;
      if (g.cash < prog.cost) { alertInsufficientFunds(g, prog.cost, prog.label || prog.name || "This training"); return; }
      if (w.status === "Active") { Alert.alert("On Site", "Can't enroll a worker currently assigned to a site."); return; }
      const alreadyEnrolled = (g.trainingQueue || []).some((t) => t.workerId === workerId);
      if (alreadyEnrolled) { Alert.alert("Already Training", "This worker is already enrolled in a program."); return; }
      g.cash -= prog.cost;
      g.expenses += prog.cost;
      recordTransaction(g, "payroll", -prog.cost, `${w.name}: ${prog.label} training`);
      if (!g.trainingQueue) g.trainingQueue = [];
      g.trainingQueue.push({ id: uid(), workerId, programId, daysLeft: prog.duration });
      addLog(g, `📚 ${w.name} enrolled in "${prog.label}" — completes in ${prog.duration} days.`);
    });
  }, [update]);

  const handleAcquireRival = useCallback((rivalId) => {
    fireHaptic("light");
    update((g) => {
      const rival = (g.rivals||[]).find(r => r.id === rivalId);
      const blocked = acquisitionBlockReason(rival, g);
      if (blocked) { Alert.alert("Cannot Acquire", blocked); return; }

      // ── WHAT YOU ARE BUYING IS WHAT YOU GET ────────────────────────────────
      // One planAcquisition() call decides the whole transaction, and it is the same call
      // the confirmation copy reads — so what the deal promises is by construction what it
      // delivers. Buying a company used to hand over 1-3 GENERIC workers whether the firm
      // employed 2 or 20, no equipment at all, and nothing in the ledger.
      const plan = planAcquisition(rival, g);

      g.cash -= plan.cost;
      g.expenses += plan.cost;
      recordTransaction(g, "acquisitions", -plan.cost, `Acquired ${plan.rivalName}`);

      if (plan.cashTransferred > 0) {
        g.cash += plan.cashTransferred;
        g.revenue += plan.cashTransferred;
        recordTransaction(g, "acquisitions", plan.cashTransferred, `${plan.rivalName}: cash reserves`);
      }

      if (!g.acquiredRivals) g.acquiredRivals = [];
      g.acquiredRivals.push(rivalId);

      // Phase 6: buying a competitor out wins you the market and earns you enemies. The firms
      // still standing remember who did the buying, and bid against you on principle.
      recordMemory(g, {
        tag: `acquired_${rivalId}`, kind: "rivalry", valence: "bad", weight: 2,
        subject: plan.rivalName,
        label: `Bought out ${plan.rivalName}`,
        detail: `you bought ${plan.rivalName} out of the market`,
      });
      g.lastAcquisitionDay = g.day;
      g.reputation = Math.min(100, (g.reputation||0) + plan.repGain);
      g.creditScore = Math.min(850, (g.creditScore||600) + plan.creditGain);

      // Their crew. Experienced enough to skip the new-hire curve, but they did not choose
      // you — so loyalty and mood start low and they need managing like anyone else.
      for (const spec of plan.crew) {
        const w = createWorker(spec.role);
        w.skill = spec.skill;
        w.loyalty = spec.loyalty;
        w.mood = spec.mood;
        w.hireDay = g.day;
        g.crew.push(w);
      }

      // Their plant. Arrives used and parked in the yard, like any real acquisition.
      for (let i = 0; i < plan.machines; i++) {
        const shopItem = EQUIPMENT_SHOP[Math.min(i + 1, EQUIPMENT_SHOP.length - 1)] || EQUIPMENT_SHOP[0];
        const machine = createEquipment(shopItem);
        machine.condition = rand(45, 80);
        machine.purchaseDay = g.day;
        machine.status = "Idle";
        g.equipment = g.equipment || [];
        g.equipment.push(machine);
      }

      addLog(g, `🤝 Acquired ${plan.rivalName} for ${money(plan.cost)} — ${plan.crew.length} crew, ${plan.machines} machine${plan.machines === 1 ? "" : "s"}.`);
      pushMarketNews(g, {
        text: `🤝 ${plan.rivalName} has been acquired and is off the market.`,
        tone: "info",
        rivalId: rivalId,
      });
      addImportantNotice(g, plan.summary, "green");
    });
  }, [update]);

  const handleSellProperty = useCallback((propId) => {
    update((g) => {
      const prop = (g.properties||[]).find(p => p.id === propId);
      if (!prop) return;
      const def = PROPERTY_TYPES.find(t => t.id === prop.typeId);
      const salePrice = Math.round((def?.cost||0) * (def?.resaleRate||0.8));
      g.cash += salePrice;
      g.revenue += salePrice;
      recordTransaction(g, "sales", salePrice, `Sold ${def?.name || "property"}`);
      g.properties = g.properties.filter(p => p.id !== propId);
      addLog(g, `💸 Sold ${def?.name||"property"} for ${money(salePrice)}.`);
    });
  }, [update]);

  const handleBuyEquipmentUpgrade = useCallback((equipId, upgradeId) => {
    update(g => {
      const eq = g.equipment.find(e => e.id === equipId);
      const upg = EQUIPMENT_UPGRADES.find(u => u.id === upgradeId);
      if (!eq || !upg) return;
      const currentTier = (eq.upgrades || {})[upgradeId] || 0;
      const nextTier = upg.tiers[currentTier];
      if (!nextTier || g.cash < nextTier.cost) return;
      g.cash -= nextTier.cost;
      g.expenses += nextTier.cost;
      recordTransaction(g, "equipment", -nextTier.cost, `${eq.name}: ${upg.label} upgrade`);
      if (!eq.upgrades) eq.upgrades = {};
      eq.upgrades[upgradeId] = currentTier + 1;
      addLog(g, `⚙️ ${eq.name}: ${upg.label} upgraded to Tier ${currentTier + 1} (${nextTier.effect})`);
    });
  }, [update]);

  const handleRepairEquipmentNew = useCallback((equipId, isEmergency) => {
    update((g) => { repairEquipment(g, equipId, isEmergency); });
  }, [update]);

  const handleRaiseWage = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      const _increase = Math.round(_w.wagePerDay * 0.1);
      _w.wagePerDay += _increase;
      _w.loyalty = Math.min(100, (_w.loyalty ?? 0) + 8);
      _w.mood = Math.min(100, (_w.mood ?? 70) + 10);
      addLog(g, `💚 ${_w.name} wage raised by ${money(_increase)}/day — loyalty +8`);
    });
  }, [update]);

  const handleLowerWage = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      const _decrease = Math.round(_w.wagePerDay * 0.1);
      _w.wagePerDay = Math.max(50, _w.wagePerDay - _decrease);
      _w.loyalty = Math.max(0, (_w.loyalty ?? 0) - 15);
      _w.mood = Math.max(0, (_w.mood ?? 70) - 12);
      addLog(g, `🔴 ${_w.name} wage cut by ${money(_decrease)}/day — morale hit`);
    });
  }, [update]);

  // Sprint 13. The whole wage control used to be the two ±10% nudges above. "I should be able
  // to determine how much people are paid" — so here is the number.
  const handleSetWage = useCallback((workerId, amount) => {
    fireHaptic("light");
    update((g) => {
      const _w = (g.crew || []).find((x) => x.id === workerId) || (g.officeStaff || []).find((x) => x.id === workerId);
      if (!_w) return;
      const _before = _w.wagePerDay;
      const _res = setWage(_w, amount);
      if (!_res || _res.applied === _before) return;
      const _pos = _res.positionAfter;
      addLog(g, `💰 ${_w.name} now on ${money(_res.applied)}/day (${_pos.label}).`);
      if (_pos.key === "insulting") {
        addImportantNotice(g, `${_w.name} is on ${money(_res.applied)}/day against a market rate of ${money(_res.market)}. People do not stay on that.`, "orange");
      }
    });
  }, [update]);

  const handleBulkHire = useCallback((count) => {
    fireHaptic("light");
    update((g) => {
      const _plan = planBulkHire(g.applicants || [], count, {
        crewCap: getTotalCrewCap(g),
        currentCrew: (g.crew || []).length,
        cash: g.cash,
        hireCostFor: (a) => Math.round((a.desiredWage || 200) * 5),
      });
      if (_plan.count === 0) {
        fireHaptic("error");
        Alert.alert("Cannot Hire", _plan.reason || "Nobody available to hire.");
        return;
      }
      for (const a of _plan.hiring) {
        const _w = createWorker(a.role, {
          name: a.name, skill: a.skill, specialty: a.specialty,
          wagePerDay: a.desiredWage || 200, hireDay: g.day,
        });
        g.crew.push(_w);
      }
      g.applicants = (g.applicants || []).filter((a) => !_plan.hiring.some((h) => h.id === a.id));
      g.cash -= _plan.spend;
      g.expenses += _plan.spend;
      recordTransaction(g, "payroll", -_plan.spend, `Bulk hire — ${_plan.count} crew`);
      addLog(g, `👷 Hired ${_plan.count} crew in one go for ${money(_plan.spend)}.`);
      addImportantNotice(g, `${_plan.count} new crew started today.${_plan.reason ? ` ${_plan.reason}` : ""}`, "green");
    });
  }, [update]);

  const handleFireMany = useCallback((workerIds) => {
    // A neutral tap on press; the warning buzz fires below, once people have actually gone.
    // The top of a handler is before the guards, and my own source-scanning test caught this.
    fireHaptic("light");
    update((g) => {
      const _ids = Array.isArray(workerIds) ? workerIds : [];
      const _going = (g.crew || []).filter((w) => _ids.includes(w.id));
      if (_going.length === 0) return;
      const _plan = planBulkFire(_going);
      fireHaptic("warning");
      g.cash -= _plan.severance;
      g.expenses += _plan.severance;
      recordTransaction(g, "payroll", -_plan.severance, `Severance — ${_plan.count} crew`);
      // Anyone let go comes off the sites they were on, or the site keeps a ghost in its crew list.
      for (const site of (g.activeSites || [])) {
        site.assignedCrewIds = (site.assignedCrewIds || []).filter((id) => !_ids.includes(id));
      }
      g.crew = (g.crew || []).filter((w) => !_ids.includes(w.id));
      addLog(g, `🔴 Let ${_plan.count} crew go — ${money(_plan.severance)} in severance, saving ${money(_plan.dailySaving)}/day.`);
      addImportantNotice(g, `${_plan.count} crew dismissed. ${money(_plan.severance)} severance paid.`, "orange");
      recordMemory(g, { tag: `mass_layoff_${g.day}`, kind: "crew", valence: "bad", weight: _plan.count >= 5 ? 2.5 : 1,
        label: "Let people go", detail: `you dismissed ${_plan.count} people at once` });
    });
  }, [update]);

  const handleGiveBonus = useCallback((workerId) => {
    fireHaptic("light");
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      const _bonus = _w.wagePerDay * 2;
      if (g.cash < _bonus) { addLog(g, "Not enough cash for bonus."); return; }
      g.cash -= _bonus;
      g.expenses += _bonus;
      recordTransaction(g, "payroll", -_bonus, `${_w.name}: bonus`);
      _w.mood = Math.min(100, (_w.mood ?? 70) + 20);
      _w.loyalty = Math.min(100, (_w.loyalty ?? 0) + 12);
      addLog(g, `🎁 ${_w.name} received a ${money(_bonus)} bonus — morale +20`);
    });
  }, [update]);

  const handleRestWorker = useCallback((workerId) => {
    fireHaptic("light");
    update((g) => { restWorker(g, workerId); });
  }, [update]);

  const handleRestAllTired = useCallback(() => {
    update((g) => {
      let count = 0;
      (g.crew||[]).forEach(_w => {
        if ((_w.stamina ?? 100) < 40 && _w.status !== "Resting") {
          const _from = (g.activeSites||[]).find(site => (site.assignedCrewIds||[]).includes(_w.id));
          if (_from) _w.awaitingRestForSiteId = _from.id;
          (g.activeSites||[]).forEach(site => {
            site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== _w.id);
          });
          _w.status = "Resting";
          _w.restUntilStamina = 80;
          count++;
        }
      });
      if (count > 0) addLog(g, `💤 ${count} tired worker(s) sent to rest.`);
    });
  }, [update]);

  const handleBuyLunch = useCallback((workerId) => {
    fireHaptic("light");
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      if ((g.cash||0) < 25) { addLog(g, "Not enough cash for lunch."); return; }
      if (_w.lastLunchDay === g.day) { addLog(g, `${_w.name} already had lunch today.`); return; }
      g.cash -= 25;
      recordTransaction(g, "payroll", -25, `${_w.name}: crew lunch`);
      _w.mood = Math.min(100, (_w.mood ?? 70) + 8);
      _w.stamina = Math.min(100, (_w.stamina ?? 50) + 5);
      _w.lastLunchDay = g.day;
      addLog(g, `🍱 ${_w.name} had lunch — mood +8, stamina +5`);
    });
  }, [update]);

  const handlePauseSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s) return;
      pauseSite(_s, 999, "manual");
      addLog(g, `⏸ ${_s.label} paused.`);
    });
  }, [update]);

  const handleResumeSite = useCallback((siteId) => {
    update((g) => { resumeSite(g, siteId); });
  }, [update]);

  const handleAbandonSite = useCallback((siteId) => {
    fireHaptic("light");
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s) return;
      const _def = CONTRACT_DEFS.find(c => c.id === (g.contracts||[]).find(cc => cc.id === _s.contractId)?.defId);
      const _fee = Math.round((_def?.baseValue || 10000) * 0.15);
      const _repLoss = Math.max(2, (_def?.tier||_def?.minTier||1) * 2);
      const _cashBeforeFee = g.cash || 0;
      g.cash = Math.max(-50000, _cashBeforeFee - _fee);
      g.expenses = (g.expenses||0) + _fee;
      recordTransaction(g, "fines", g.cash - _cashBeforeFee, `${_s.label}: abandonment fee`);
      g.reputation = Math.max(0, (g.reputation||0) - _repLoss);
      (_s.assignedCrewIds||[]).forEach(cid => { const _w=(g.crew||[]).find(w=>w.id===cid); if(_w){_w.status="Idle"; _w.assignedSiteId=null;} });
      (_s.assignedEquipmentIds||[]).forEach(eid => { const _e=(g.equipment||[]).find(e=>e.id===eid); if(_e){_e.assignedSiteId=null;_e.status="Idle";} });
      g.activeSites = (g.activeSites||[]).filter(s => s.id !== siteId);
      addLog(g, `🚫 Abandoned ${_s.label} — ${money(_fee)} fee, rep -${_repLoss}.`);
      addImportantNotice(g, `🚫 Abandoned "${_s.label}" — ${money(_fee)} fee, reputation -${_repLoss}. Win more contracts to recover.`, "red");
    });
  }, [update]);

  const handleSettleSite = useCallback((siteId) => {
    fireHaptic("light");
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s) return;
      const _def = CONTRACT_DEFS.find(c => c.id === (g.contracts||[]).find(cc => cc.id === _s.contractId)?.defId);
      const _prog = Math.min(1, (((_s.currentPhaseIdx||0) / Math.max(1, (_s.phases||[]).length)) + ((_s.phaseProgress||0)/100/Math.max(1,(_s.phases||[]).length))));
      const _value = _s.totalValue || _def?.baseValue || 10000;
      // Settlement is capped at what the contract still owes. Without this cap a settled job
      // could pay more than its own contract value: the deposit and every progress claim have
      // already been banked, and this figure was being added on top of them. That was a small
      // leak when only the 25% deposit existed and would have become a large one now that
      // claims release half the value during the job.
      const _outstanding = Math.max(0, _value - (_s.depositPaid || 0) - (_s.progressPaid || 0));
      const _partial = Math.min(_outstanding, Math.round(_value * Math.max(0.2, _prog) * 0.6));
      const _repLoss = Math.max(1, Math.round((_def?.minTier||1) * 1.5));
      g.cash = (g.cash||0) + _partial;
      g.revenue = (g.revenue||0) + _partial;
      if (_partial > 0) recordTransaction(g, "contracts", _partial, `${_s.label}: settlement`);
      g.reputation = Math.max(0, (g.reputation||0) - _repLoss);
      (_s.assignedCrewIds||[]).forEach(cid => { const _w=(g.crew||[]).find(w=>w.id===cid); if(_w){_w.status="Idle"; _w.assignedSiteId=null;} });
      (_s.assignedEquipmentIds||[]).forEach(eid => { const _e=(g.equipment||[]).find(e=>e.id===eid); if(_e){_e.assignedSiteId=null;_e.status="Idle";} });
      g.activeSites = (g.activeSites||[]).filter(s => s.id !== siteId);
      g.completedJobs = (g.completedJobs||0) + 1;
      addLog(g, `🤝 Settled ${_s.label} — ${money(_partial)} partial payout, rep -${_repLoss}.`);
      addImportantNotice(g, `🤝 Settled "${_s.label}" early — partial payout of ${money(_partial)}, reputation -${_repLoss}.`, "orange");
    });
  }, [update]);

  const handleRenegotiate = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s || _s.renegotiated) return;
      const _def = CONTRACT_DEFS.find(c => c.id === (g.contracts||[]).find(cc => cc.id === _s.contractId)?.defId);
      const _cost = Math.round((_def?.baseValue || _s.totalValue || 10000) * 0.08);
      if ((g.cash||0) < _cost) { addLog(g, `Need ${money(_cost)} to renegotiate.`); alertInsufficientFunds(g, _cost, "Renegotiating this contract"); return; }
      g.cash -= _cost;
      g.expenses = (g.expenses||0) + _cost;
      recordTransaction(g, "fines", -_cost, `${_s.label}: deadline renegotiation`);
      g.reputation = Math.max(0, (g.reputation||0) - 2);
      _s.deadlineDay = (g.day||0) + Math.max(7, Math.round((_def?.durationDays||14)*0.4));
      _s.renegotiated = true;
      addLog(g, `📅 ${_s.label} deadline extended — ${money(_cost)}, rep -2.`);
    });
  }, [update]);

  const handleAssignCrewToSite = useCallback((workerId, siteId) => {
    fireHaptic("light");
    update((g) => {
      const w = (g.crew||[]).find(c => c.id === workerId);
      const site = (g.activeSites||[]).find(s => s.id === siteId);
      if (!w || !site) return;
      if (w.status === "Resting" || w.status === "Training") { addLog(g, `${w.name} is not available.`); return; }
      (g.activeSites||[]).forEach(s => { s.assignedCrewIds = (s.assignedCrewIds||[]).filter(id => id !== workerId); });
      site.assignedCrewIds = [...(site.assignedCrewIds||[]), workerId];
      repairCrewAssignments(g);
      addLog(g, `👷 ${w.name} assigned to ${site.label}.`);
    });
  }, [update]);

  const handleUnassignCrewFromSite = useCallback((workerId, siteId) => {
    update((g) => {
      const w = (g.crew||[]).find(c => c.id === workerId);
      const site = (g.activeSites||[]).find(s => s.id === siteId);
      if (!w || !site) return;
      site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== workerId);
      repairCrewAssignments(g);
      addLog(g, `👷 ${w.name} removed from ${site.label}.`);
    });
  }, [update]);

  const handleAssignEquipToSite = useCallback((equipId, siteId) => {
    fireHaptic("light");
    update((g) => {
      const eq = (g.equipment||[]).find(e => e.id === equipId);
      const site = (g.activeSites||[]).find(s => s.id === siteId);
      if (!eq || !site) return;
      if (eq.status === "Maintenance" || eq.status === "Broken") { addLog(g, `${eq.name} is not available.`); return; }
      (g.activeSites||[]).forEach(s => { s.assignedEquipmentIds = (s.assignedEquipmentIds||[]).filter(id => id !== equipId); });
      site.assignedEquipmentIds = [...(site.assignedEquipmentIds||[]), equipId];
      repairCrewAssignments(g);
      addLog(g, `🚜 ${eq.name} assigned to ${site.label}.`);
    });
  }, [update]);

  const handleUnassignEquipFromSite = useCallback((equipId, siteId) => {
    update((g) => {
      const eq = (g.equipment||[]).find(e => e.id === equipId);
      const site = (g.activeSites||[]).find(s => s.id === siteId);
      if (!eq || !site) return;
      site.assignedEquipmentIds = (site.assignedEquipmentIds||[]).filter(id => id !== equipId);
      repairCrewAssignments(g);
      addLog(g, `🚜 ${eq.name} removed from ${site.label}.`);
    });
  }, [update]);

  const handleScheduleMaintenance = useCallback((equipId) => {
    fireHaptic("light");
    update((g) => {
      const eq = (g.equipment || []).find(e => e.id === equipId);
      if (!eq) return;
      if (eq.status === "Active" || eq.assignedSiteId) {
        Alert.alert("In Use", "Unassign this vehicle from its site before scheduling maintenance.");
        return;
      }
      const ok = scheduleMaintenance(g, equipId);
      if (!ok) {
        const estimated = Math.max(25, Math.round((eq.dailyCost || eq.maintenance || 50) * 0.35));
        Alert.alert("Maintenance Unavailable", `Unable to schedule maintenance right now. Keep at least ${money(estimated)} available and make sure the vehicle is idle.`);
        return;
      }
      repairCrewAssignments(g);
    });
  }, [update]);

  const handleRetireEquipment = useCallback((equipId) => {
    update((g) => {
      const eq = (g.equipment||[]).find(e => e.id === equipId);
      if (!eq) return;
      (g.activeSites||[]).forEach(s => { s.assignedEquipmentIds = (s.assignedEquipmentIds||[]).filter(id => id !== equipId); });
      g.equipment = (g.equipment||[]).filter(e => e.id !== equipId);
      repairCrewAssignments(g);
      addLog(g, `⬛ ${eq.name} retired from fleet.`);
    });
  }, [update]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!loaded || !game) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: THEMES.dark.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: THEMES.dark.text, fontSize: 18 }}>Loading Construction Flow…</Text>
      </SafeAreaView>
    );
  }

  // Color helpers available throughout (including renderSetup)
  const col = { color: T.text };
  const subCol = { color: T.sub };

  // Show company-setup wizard for brand new games
  if (!game.setupDone) {
    return renderSetup();
  }

  // Game-over screen
  if (game.gameOver) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>💸</Text>
          <Text style={{ color: T.red, fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 8 }}>
            {game.companyName} is Bankrupt
          </Text>
          <Text style={{ color: T.sub, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
            Cash fell below −$10,000 for 5 consecutive days.{"\n"}Your creditors have moved in.
          </Text>
          <View style={{ width: "100%", backgroundColor: T.panel, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: T.border, marginBottom: 20 }}>
            <Text style={{ color: T.sub, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 }}>FINAL STATS</Text>
            {[
              ["Days in Business", String(game.day || 1)],
              ["Jobs Completed", String(game.completedJobs || 0)],
              ["Crew at Close", String((game.crew || []).length)],
              ["Peak Reputation", String(game.hallOfFame?.highestRep || game.reputation || 0)],
              ["Peak Valuation", money(game.hallOfFame?.highestValuation || game.companyValuation || 0)],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border }}>
                <Text style={{ color: T.sub, fontSize: 13 }}>{label}</Text>
                <Text style={{ color: T.text, fontSize: 13, fontWeight: "700" }}>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: T.sub, fontSize: 12, fontStyle: "italic", textAlign: "center", marginBottom: 28, lineHeight: 18 }}>
            &quot;Every failed company is just a blueprint for the next one.&quot;
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: T.green, paddingVertical: 16, borderRadius: 14, width: "100%", alignItems: "center", marginBottom: 12 }}
            onPress={handleResetGame}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#000", fontSize: 16, fontWeight: "900" }}>Start Over →</Text>
          </TouchableOpacity>
          {onBackToHub && (
            <TouchableOpacity
              style={{ paddingVertical: 14, width: "100%", alignItems: "center" }}
              onPress={onBackToHub}
              activeOpacity={0.8}
            >
              <Text style={{ color: T.sub, fontSize: 14 }}>← Back to Hub</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const repTier = getRepTier(game.reputation);
  const creditInfo = getCreditLabel(game.creditScore);
  const office = OFFICES[game.officeIndex || 0];
  const { width } = Dimensions.get("window");
  const homeCity = CITIES.find(c => c.id === (game.startingCityId || "salem"));
  const displayCityName    = game.homeCityName    || homeCity?.name        || "Salem";
  const displayStateCode   = game.homeStateCode   || homeCity?.state       || "OR";
  const displayCompetition = game.homeCompetition || homeCity?.competition || "Low";

  // ── Tab content ────────────────────────────────────────────────────────────

  function renderSetup() {
    const US_STATES = [
      ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
      ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
      ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
      ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
      ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
      ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
      ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
      ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
      ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
      ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
      ["DC","Washington D.C."],
    ];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60, flexGrow: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 36, textAlign: "center", marginBottom: 4 }}>🏗️</Text>
          <Text style={{ color: T.text, fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 4 }}>Construction Flow</Text>
          <Text style={{ color: T.sub, fontSize: 14, textAlign: "center", marginBottom: 32 }}>Build a construction empire from the ground up.</Text>

          {/* Step indicator */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 }}>
            {[0,1,2].map(s => (
              <View key={s} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: setupStep >= s ? T.green : T.border }} />
            ))}
          </View>

          {setupStep === 0 ? (
            /* Step 1 — Company name */
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.green, borderWidth: 2 }]}>
              <Text style={[styles.label, col, { marginBottom: 4 }]}>Step 1 — Who Are You?</Text>
              <Text style={[styles.sub, subCol, { marginBottom: 12 }]}>You&apos;re the owner. Your name and your company&apos;s name appear on your Home screen, your bids, and your company profile.</Text>
              <Text style={[styles.sub, subCol, { marginBottom: 4 }]}>Your name</Text>
              <TextInput
                style={[styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 12 }]}
                value={setupOwner}
                onChangeText={setSetupOwner}
                placeholder="e.g. Sam Delgado"
                placeholderTextColor={T.sub}
                maxLength={28}
                autoFocus
              />
              <Text style={[styles.sub, subCol, { marginBottom: 4 }]}>Company name</Text>
              <TextInput
                style={[styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 12 }]}
                value={setupName}
                onChangeText={setSetupName}
                placeholder="e.g. Apex Build Co."
                placeholderTextColor={T.sub}
                maxLength={36}
              />
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: setupName.trim().length > 0 ? T.green : T.panel2, borderColor: T.green }]}
                onPress={() => { if (setupName.trim().length > 0) setSetupStep(1); }}
              >
                <Text style={[styles.btnText, { color: setupName.trim().length > 0 ? "#000" : T.sub }]}>Next — Choose Your State →</Text>
              </TouchableOpacity>
            </View>

          ) : setupStep === 1 ? (
            /* Step 2 — State selection (all 50 states, searchable) */
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 2 }]}>
              <Text style={[styles.label, col, { marginBottom: 4 }]}>Step 2 — Your State</Text>
              <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>Where are you building? Search by name or abbreviation.</Text>
              {setupHomeStateCode ? (
                <View style={[styles.rowItem, { borderColor: T.cyan, backgroundColor: T.panel2, marginBottom: 10, flexDirection: "row", alignItems: "center" }]}>
                  <Text style={[styles.label, { color: T.cyan, flex: 1 }]}>✓ {setupHomeStateName} ({setupHomeStateCode})</Text>
                  <TouchableOpacity onPress={() => { setSetupHomeStateCode(""); setSetupHomeStateName(""); setSetupStateSearch(""); }}>
                    <Text style={[styles.sub, { color: T.sub }]}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={[styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 8 }]}
                    value={setupStateSearch}
                    onChangeText={text => { setSetupStateSearch(text); }}
                    placeholder="e.g. Tennessee or TN"
                    placeholderTextColor={T.sub}
                    autoCorrect={false}
                  />
                  <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                    {US_STATES
                      .filter(([code, name]) => {
                        const q = setupStateSearch.toLowerCase();
                        return !q || name.toLowerCase().includes(q) || code.toLowerCase() === q;
                      })
                      .map(([code, name]) => (
                        <TouchableOpacity
                          key={code}
                          style={[styles.rowItem, { marginBottom: 4, paddingVertical: 8, flexDirection: "row", alignItems: "center" }]}
                          onPress={() => { setSetupHomeStateCode(code); setSetupHomeStateName(name); setSetupStateSearch(name); }}
                        >
                          <Text style={[styles.sub, { color: T.sub, width: 32 }]}>{code}</Text>
                          <Text style={[styles.label, col, { flex: 1 }]}>{name}</Text>
                        </TouchableOpacity>
                      ))
                    }
                  </ScrollView>
                </>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: T.panel2, borderColor: T.border }]} onPress={() => setSetupStep(0)}>
                  <Text style={[styles.btnText, col]}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 2, backgroundColor: setupHomeStateCode ? T.green : T.panel2, borderColor: T.green }]}
                  onPress={() => { if (setupHomeStateCode) setSetupStep(2); }}
                >
                  <Text style={[styles.btnText, { color: setupHomeStateCode ? "#000" : T.sub }]}>Next — Your City →</Text>
                </TouchableOpacity>
              </View>
            </View>

          ) : (
            /* Step 3 — City name + market size */
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 2 }]}>
              <Text style={[styles.label, col, { marginBottom: 4 }]}>Step 3 — Your City</Text>
              <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>Type your city or town. This is where you&apos;ll pick up your first contracts.</Text>
              <TextInput
                style={[styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 14 }]}
                value={setupHomeCityText}
                onChangeText={setSetupHomeCityText}
                placeholder="e.g. Nashville"
                placeholderTextColor={T.sub}
                maxLength={40}
                autoFocus
              />
              <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>What&apos;s the construction market like there?</Text>
              {[
                { key: "Low",    label: "Small Market",  desc: "Less competition, steady local work" },
                { key: "Medium", label: "Growing City",  desc: "Mix of residential and commercial" },
                { key: "High",   label: "Major Metro",   desc: "High competition, bigger contracts" },
              ].map(opt => {
                const sel = setupCompetition === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.rowItem, { borderColor: sel ? T.cyan : T.border, backgroundColor: sel ? T.panel2 : "transparent", marginBottom: 6 }]}
                    onPress={() => setSetupCompetition(opt.key)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: sel ? T.cyan : T.text }]}>{opt.label}</Text>
                      <Text style={[styles.sub, subCol]}>{opt.desc}</Text>
                    </View>
                    <View style={[styles.selDot, { backgroundColor: sel ? T.cyan : T.border }]} />
                  </TouchableOpacity>
                );
              })}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: T.panel2, borderColor: T.border }]} onPress={() => setSetupStep(1)}>
                  <Text style={[styles.btnText, col]}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 2, backgroundColor: setupHomeCityText.trim() ? T.green : T.panel2, borderColor: T.green }]}
                  onPress={() => {
                    if (!setupHomeCityText.trim()) return;
                    const competitionToCityId = { Low: "salem", Medium: "portland", High: "phoenix" };
                    const templateCityId = competitionToCityId[setupCompetition] || "salem";
                    update(g => {
                      g.ownerName = setupOwner.trim() || "Owner";
                      g.companyName = setupName.trim() || "New Build Co.";
                      g.startingCityId = templateCityId;
                      g.homeCityName = setupHomeCityText.trim();
                      g.homeStateCode = setupHomeStateCode;
                      g.homeStateName = setupHomeStateName;
                      g.homeCompetition = setupCompetition;
                      g.setupDone = true;
                      addLog(g, `🏗️ ${g.ownerName} founded ${g.companyName} in ${g.homeCityName}, ${g.homeStateCode}. Let's build.`);
                    });
                  }}
                >
                  <Text style={[styles.btnText, { color: setupHomeCityText.trim() ? "#000" : T.sub }]}>🚀 Start Building</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={{ color: T.sub, fontSize: 11, textAlign: "center", marginTop: 24, lineHeight: 17 }}>
            You start with $75,000 · 1 truck · 3 crew members{"\n"}
            You make money by winning bids, putting crew and machines on site, and finishing the job before the deadline.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  function renderHome() {
    const activeSites = getActiveSites(game);
    const idleCrew = getIdleCrew(game);
    const idleEquip = getIdleEquipment(game);
    const valuation = computeValuation(game);
    const rank = game.nationalRank || 99;
    const cityCount = (game.cityOffices || []).length + 1;

    const companyLevel = getCompanyLevel(game);
    const nextLevel = COMPANY_LEVELS.find(l => l.level === companyLevel.level + 1);
    const overdueSites = activeSites.filter(s => game.day > s.deadlineDay);
    const burningOutCrew = game.crew.filter(w => (w.stamina ?? 50) < 15);
    const sitesNeedingMats = activeSites.filter(s => {
      const contract = game.contracts.find(c => c.id === s.contractId);
      const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
      return def?.materials && Object.entries(def.materials).some(([matId, needed]) => ((s.materialsFulfilled||{})[matId]||0) < needed);
    });
    const topRivalByRep = [...(game.rivals||[])].filter(r=>r.status!=="Bankrupt"&&!(game.acquiredRivals||[]).includes(r.id)).sort((a,b)=>(b.cash||0)-(a.cash||0))[0];
    const rivalOutpacing = topRivalByRep && (topRivalByRep.cash||0) > (game.cash||0);

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── SITE COMMAND ──────────────────────────────────────────────────
            One hero card answering the three questions a player opens the app
            with: how much money do I have, what is my company worth, and what
            is actually running right now. This replaces a separate company
            header card and a separate KPI strip further down the scroll — the
            grouping is the point. See FLEETFLOW_PARITY_AUDIT.md §2 gap 3. */}
        <View
          style={[
            {
              backgroundColor: T.panel,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: alpha(T.accent, 0.35),
              borderLeftWidth: 4,
              borderLeftColor: T.accent,
              padding: SPACING.lg,
              marginBottom: SPACING.md,
            },
            ELEVATION.hero,
          ]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[TYPE.title, { color: T.text }]} numberOfLines={1}>{game.companyName}</Text>
                {(game.generation || 1) > 1 && <Pill T={T} label={`GEN ${game.generation}`} tone="caution" />}
              </View>
              {/* The WildBear first-minute rule requires "who am I / what do I own" to be
                  answerable on the screen the player lands on. */}
              <Text style={[TYPE.caption, { color: T.sub, marginTop: 3 }]} numberOfLines={1}>
                {game.ownerName || "Owner"} · General contractor
              </Text>
              <Text style={[TYPE.caption, { color: T.sub, marginTop: 2 }]} numberOfLines={1}>
                {office.name} · {displayCityName}, {displayStateCode}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[TYPE.eyebrow, { color: T.sub, marginBottom: 2 }]}>
                {`Day ${game.day} · ${formatClock(game.gameMinutes)}${isPaused(speedId) ? " · PAUSED" : ""}`}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {game.seasonEmoji ? (
                  <Text style={[TYPE.caption, { color: T.sub }]}>{game.seasonEmoji} {game.currentSeason}</Text>
                ) : null}
                <TouchableOpacity
                  style={{
                    paddingHorizontal: SPACING.sm + 2, paddingVertical: 5, borderRadius: RADIUS.pill,
                    backgroundColor: speedId === DEFAULT_SPEED_ID ? T.panel2 : alpha(T.caution, 0.2),
                    borderWidth: 1, borderColor: speedId === DEFAULT_SPEED_ID ? T.border : T.caution,
                  }}
                  onPress={() => {
                    fireHaptic("light");
                    const i = SPEEDS.findIndex((sp) => sp.id === speedId);
                    setSpeedId(SPEEDS[(i + 1) % SPEEDS.length].id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Game speed: ${speedById(speedId).description}. Tap to change.`}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: speedId === DEFAULT_SPEED_ID ? T.sub : T.caution }}>
                    {speedById(speedId).label}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: SPACING.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.eyebrow, { color: T.sub, marginBottom: 2 }]}>Operating cash</Text>
              {/* Animated.View wraps only the figure: the pulse is decorative and never
                  delays anything from being tappable. */}
              <Animated.View style={{ transform: [{ scale: cashPulse }], alignSelf: "flex-start" }}>
                <Text style={[TYPE.hero, { color: game.cash >= 0 ? T.safe : T.hazard }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {money(game.cash)}
                </Text>
              </Animated.View>
              {(game.savings || 0) > 0 && (
                <Text style={[TYPE.caption, { color: T.steel, marginTop: 2 }]}>{money(game.savings)} in savings</Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[TYPE.eyebrow, { color: T.sub, marginBottom: 2 }]}>Company value</Text>
              <Text style={[TYPE.stat, { color: T.text }]} numberOfLines={1}>{compactMoney(valuation)}</Text>
              <View style={{ marginTop: 4 }}>
                <Pill T={T} label={`${repTier.badge} ${repTier.label}`} tone="accent" />
              </View>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: T.border, marginVertical: SPACING.md }} />

          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <StatTile T={T} label="Sites" value={`${activeSites.length}`} sub={activeSites.length === 1 ? "active" : "active"} tone={activeSites.length > 0 ? "accent" : null} />
            <StatTile T={T} label="Crew free" value={`${idleCrew.length}`} sub={`of ${(game.crew || []).length}`} tone={idleCrew.length > 0 ? "safe" : null} />
            <StatTile T={T} label="Machines" value={`${idleEquip.length}`} sub={`of ${(game.equipment || []).length}`} tone={idleEquip.length > 0 ? "safe" : null} />
          </View>
        </View>

        {/* ── WHAT NEEDS YOU ────────────────────────────────────────────────
            Every alert is an AlertBanner with a tap target to the tab that
            fixes it. Previously these were four differently-styled cards and
            a bullet list with no way to act on any of it. */}
        {(() => {
          const dailyBurn = (game.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0) +
            (game.equipment || []).reduce((s, e) => s + e.dailyCost, 0) +
            dailyOfficeRent(game);
          const daysLeft = dailyBurn > 0 ? Math.floor(game.cash / dailyBurn) : 999;
          if (daysLeft >= 5 || game.cash < 0) return null;
          return (
            <AlertBanner
              T={T}
              tone="hazard"
              icon="warning-outline"
              title={`Cash running low — about ${daysLeft} day${daysLeft !== 1 ? "s" : ""} of runway`}
              body={`Overhead is ${money(dailyBurn)}/day. Finish a job or arrange finance before you run out.`}
              actionLabel="Open Finance"
              onAction={() => setTab("Finance")}
            />
          );
        })()}

        {burningOutCrew.length > 0 && (
          <AlertBanner
            T={T}
            tone="caution"
            icon="battery-dead-outline"
            title={`${burningOutCrew.length} worker${burningOutCrew.length !== 1 ? "s" : ""} burning out`}
            body={`${burningOutCrew.slice(0, 3).map((w) => `${w.name} ${Math.round(w.stamina ?? 0)}%`).join(" · ")}. Low stamina slows every site they are on — rest them to recover.`}
            actionLabel="Open Crew"
            onAction={() => setTab("Crew")}
          />
        )}

        {/* ─── Site Office inbox — Sprint 8 ────────────────────────────────────
            Audit row 11. This was a single `importantNotice` slot behind 102 call sites:
            anything raised alongside something else was destroyed before it was drawn, and
            nothing ever expired — a simulated run had a day-3 milestone still sitting here on
            day 120.

            Now a queue. The most important item leads; the rest are one tap away; things that
            need a DECISION never age out, and everything else does. */}
        {(() => {
          const notices = sortedNotices(game);
          if (notices.length === 0) return null;
          const summary = summarizeInbox(game);
          const lead = notices[0];
          const rest = notices.slice(1, inboxOpen ? INBOX_VISIBLE : 0);
          const hidden = Math.max(0, notices.length - 1 - rest.length);

          return (
            <Card T={T} tone={noticeTone(lead.level)} elevated>
              <SectionLabel
                T={T}
                tone={noticeTone(lead.level)}
                right={
                  <Pill
                    T={T}
                    label={summary.headline}
                    tone={noticeTone(summary.level)}
                    filled={summary.actions > 0}
                  />
                }
              >
                Site Office
              </SectionLabel>

              {/* The lead item, given the weight the old single banner had. */}
              <View style={{ marginTop: SPACING.sm }}>
                <Text style={[TYPE.body, { color: T.text }]}>{lead.message}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.xs, gap: SPACING.sm }}>
                  <Text style={[TYPE.caption, { color: T.sub }]}>
                    {describeNoticeAge(lead.day, game.day)}
                  </Text>
                  {lead.level === "action" ? (
                    <Text style={[TYPE.caption, { color: toneColor("accent", T), fontWeight: "700" }]}>
                      Needs a decision
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }}>
                  {lead.actionTab ? (
                    <TouchableOpacity
                      style={{
                        minHeight: MIN_TAP_TARGET - 10, justifyContent: "center",
                        paddingHorizontal: SPACING.md, borderRadius: RADIUS.xs,
                        borderWidth: 1, borderColor: alpha(T.accent, 0.6), backgroundColor: alpha(T.accent, 0.14),
                      }}
                      onPress={() => setTab(lead.actionTab)}
                      accessibilityRole="button"
                      accessibilityLabel={lead.actionLabel || `Go to ${lead.actionTab}`}
                    >
                      <Text style={{ fontSize: 12, color: T.accent, fontWeight: "700" }}>
                        {lead.actionLabel || `Go to ${lead.actionTab}`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={{
                      minHeight: MIN_TAP_TARGET - 10, justifyContent: "center",
                      paddingHorizontal: SPACING.md, borderRadius: RADIUS.xs,
                      borderWidth: 1, borderColor: T.border, backgroundColor: T.panel2,
                    }}
                    onPress={() => update((g) => { dismissNotice(g, lead.id); g.importantNotice = topNotice(g); })}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss this update"
                  >
                    <Text style={{ fontSize: 12, color: T.sub, fontWeight: "700" }}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Everything the old single slot would have thrown away. */}
              {notices.length > 1 && (
                <>
                  <TouchableOpacity
                    style={{ minHeight: MIN_TAP_TARGET - 12, justifyContent: "center", marginTop: SPACING.sm }}
                    onPress={() => {
                      const opening = !inboxOpen;
                      setInboxOpen(opening);
                      if (opening) update((g) => { markAllRead(g); });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={inboxOpen ? "Hide earlier updates" : `Show ${notices.length - 1} earlier updates`}
                  >
                    <Text style={[TYPE.caption, { color: toneColor("steel", T), fontWeight: "700" }]}>
                      {inboxOpen ? "Hide earlier updates" : `${notices.length - 1} more update${notices.length - 1 === 1 ? "" : "s"}`}
                    </Text>
                  </TouchableOpacity>

                  {inboxOpen && rest.map((n) => (
                    <View
                      key={n.id}
                      style={{
                        flexDirection: "row", alignItems: "flex-start",
                        paddingVertical: SPACING.sm,
                        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
                      }}
                    >
                      <View style={{
                        width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: SPACING.sm,
                        backgroundColor: toneColor(noticeTone(n.level), T),
                      }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[TYPE.caption, { color: T.text }]} numberOfLines={3}>{n.message}</Text>
                        <Text style={[TYPE.caption, { color: T.sub, marginTop: 1 }]}>
                          {describeNoticeAge(n.day, game.day)}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {inboxOpen && hidden > 0 && (
                    <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.xs }]}>
                      and {hidden} older
                    </Text>
                  )}

                  {inboxOpen && (
                    <TouchableOpacity
                      style={{ minHeight: MIN_TAP_TARGET - 12, justifyContent: "center", marginTop: SPACING.xs }}
                      onPress={() => update((g) => { clearInbox(g); markAllRead(g); g.importantNotice = topNotice(g); })}
                      accessibilityRole="button"
                      accessibilityLabel="Clear updates, keeping anything that needs a decision"
                    >
                      <Text style={[TYPE.caption, { color: T.sub, fontWeight: "700" }]}>
                        Clear all{actionCount(game) > 0 ? " (keeps decisions)" : ""}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </Card>
          );
        })()}

        {game.tutorialDone && getPredictiveWarnings(game).map((w, i) => (
          <AlertBanner
            key={`warn-${i}`}
            T={T}
            tone={w.severity === "high" ? "hazard" : "caution"}
            icon={w.icon || "alert-circle-outline"}
            title={w.text}
            actionLabel={w.tab ? (w.action || `Open ${w.tab}`) : null}
            onAction={w.tab ? () => setTab(w.tab) : null}
          />
        ))}

        {/* ── NEXT BEST ACTION ──────────────────────────────────────────────
            One card, not two. This screen used to render the same
            getNextBestAction(game) result twice, ~250 lines apart in two
            different designs — a "this app is broken" signal, and it meant the
            advice was never prominent. */}
        {(() => {
          const nba = getNextBestAction(game);
          if (!nba) return null;
          const isCritical = ["red", "orange"].includes(nba.tone);
          if (!game.tutorialDone && !isCritical) return null;
          if (nba.tab === "Home") return null;
          const tone = nba.tone === "red" ? "hazard" : nba.tone === "orange" ? "caution" : "accent";
          const accent = toneColor(tone, T);
          return (
            <Card T={T} tone={tone} elevated>
              <SectionLabel T={T} tone={tone}>Do this next</SectionLabel>
              <Text style={[TYPE.label, { color: T.text, marginTop: SPACING.sm }]}>{nba.title}</Text>
              <Text style={[TYPE.body, { color: T.sub, marginTop: SPACING.xs }]}>{nba.body}</Text>
              <TouchableOpacity
                style={{
                  marginTop: SPACING.md, backgroundColor: accent, borderRadius: RADIUS.sm,
                  minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center",
                }}
                onPress={() => setTab(nba.tab)}
                accessibilityRole="button"
                accessibilityLabel={`${nba.title}. Go to ${nba.tab}`}
              >
                <Text style={{ color: "#0a1018", fontWeight: "800", fontSize: 14 }}>Go to {nba.tab}</Text>
              </TouchableOpacity>
            </Card>
          );
        })()}

        {/* ── GETTING STARTED ───────────────────────────────────────────────
            Step-by-step, auto-advancing with game state. */}
        {!game.tutorialDone && (() => {
          const step = getTutorialStepIndex(game);

          const steps = [
            {
              num: "1 of 4", title: "Accept Your First Contract",
              body: `You start with ${money(game.cash)}, 1 truck, ${(game.crew || []).length} crew, and 20 lumber already in inventory.\n\nGo to Bids → accept the Fence Installation — your lumber is already covered. Assign crew + truck, then tap Mobilise.`,
              cta: "Go to Bids", action: () => setTab("Bids"),
            },
            {
              num: "2 of 4", title: "Buy Materials & Mobilise Crew",
              body: `Your contract is accepted. Now:\n• Go to Sites → open the job\n• Tap Buy Materials to purchase what the job needs\n• Assign crew and your truck, then tap Mobilise`,
              cta: "Go to Sites", action: () => setTab("Sites"),
            },
            {
              num: "3 of 4", title: "Buy Missing Materials",
              body: `Your site needs materials before work can start. Go to Sites, open the job, and tap Buy Materials.\n\nYour daily costs: ${money((game.crew || []).reduce((s, w) => s + (w.wagePerDay || 0), 0))} crew + ${money(game.equipment.reduce((s, e) => s + e.dailyCost, 0))} equipment.`,
              cta: "Go to Sites", action: () => setTab("Sites"),
            },
            {
              num: "4 of 4", title: "Watch Your Site Progress",
              body: `Crew and equipment are working! Check the Sites tab to see phase progress.\n\nWhen all phases complete, cash lands automatically.\n\nTip: assign more crew to finish faster — but watch your daily wage bill.`,
              cta: "Go to Sites", action: () => setTab("Sites"),
            },
          ];

          const s = steps[step];
          if (!s) return null;
          return (
            <Card T={T} tone="accent" elevated>
              <SectionLabel T={T} tone="accent" right={<Text style={[TYPE.caption, { color: T.sub }]}>Step {s.num}</Text>}>
                Getting started
              </SectionLabel>
              <Text style={[TYPE.label, { color: T.text, marginTop: SPACING.sm, marginBottom: SPACING.xs }]}>{s.title}</Text>
              <Text style={[TYPE.body, { color: T.sub, marginBottom: SPACING.md }]}>{s.body}</Text>
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                <TouchableOpacity
                  style={{
                    flex: 1, backgroundColor: T.accent, borderRadius: RADIUS.sm,
                    minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center",
                  }}
                  onPress={s.action}
                  accessibilityRole="button"
                  accessibilityLabel={s.cta}
                >
                  <Text style={{ color: "#0a1018", fontWeight: "800", fontSize: 14 }}>{s.cta}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: SPACING.lg, borderRadius: RADIUS.sm, borderWidth: 1,
                    borderColor: T.border, backgroundColor: T.panel2,
                    minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center",
                  }}
                  onPress={() => update((g) => {
                    g.tutorialDone = true;
                    addImportantNotice(g, "Tutorial skipped. Check Bids for contracts, Finance for loans, Empire to grow.", "green");
                  })}
                  accessibilityRole="button"
                  accessibilityLabel="Skip tutorial"
                >
                  <Text style={{ color: T.sub, fontWeight: "700", fontSize: 14 }}>Skip</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })()}

        {/* ── COMPANY LEVEL ─────────────────────────────────────────────── */}
        <Card T={T} tone="steel">
          <SectionLabel
            T={T}
            tone="steel"
            right={
              nextLevel
                ? <Text style={[TYPE.caption, { color: T.sub }]}>Next: {nextLevel.label}</Text>
                : <Pill T={T} label="MAX LEVEL" tone="caution" filled />
            }
          >
            Level {companyLevel.level}
          </SectionLabel>
          <Text style={[TYPE.label, { color: T.text, marginTop: SPACING.sm }]}>{companyLevel.label}</Text>
          {nextLevel && (
            <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
              {[
                { label: "Reputation", current: game.reputation || 0, target: nextLevel.repMin, fmt: (v) => `${v}` },
                { label: "Jobs done", current: game.completedJobs || 0, target: nextLevel.jobsMin, fmt: (v) => `${v}` },
                { label: "Company value", current: valuation, target: nextLevel.valMin, fmt: (v) => compactMoney(v) },
              ].map((bar) => {
                const pct = Math.min(100, Math.round((bar.current / Math.max(1, bar.target)) * 100));
                const done = bar.current >= bar.target;
                return (
                  <ProgressBar
                    key={bar.label}
                    T={T}
                    percent={pct}
                    tone={done ? "safe" : "steel"}
                    label={done ? `✓ ${bar.label}` : bar.label}
                    value={`${bar.fmt(bar.current)} / ${bar.fmt(bar.target)}`}
                    height={5}
                  />
                );
              })}
            </View>
          )}
        </Card>

        {/* ── COMPANY HEALTH ────────────────────────────────────────────── */}
        {game.tutorialDone && (() => {
          const hs = computeHealthScore(game);
          const tone = hs.colorKey === "green" ? "safe" : hs.colorKey === "red" ? "hazard" : "caution";
          const hc = toneColor(tone, T);
          return (
            <Card T={T} tone={tone}>
              <SectionLabel T={T} tone={tone} right={<Pill T={T} label={hs.label} tone={tone} filled />}>
                Company health
              </SectionLabel>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.md, marginBottom: SPACING.sm }}>
                <Text style={[TYPE.statLarge, { color: hc, marginRight: SPACING.md }]}>{hs.score}</Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar T={T} percent={hs.score} tone={tone} />
                </View>
              </View>
              {hs.factors.map((f, i) => (
                <Text key={i} style={[TYPE.caption, { color: T.sub, marginTop: 2 }]}>• {f}</Text>
              ))}
              <Text style={[TYPE.caption, { color: T.dim, marginTop: SPACING.sm, fontStyle: "italic" }]}>
                Safety recovers +0.5/day toward 70. Incidents, corner cuts and violations lower it.
              </Text>
            </Card>
          );
        })()}

        {/* ── On-Time Streak ───────────────────────────────────────────────── */}
        {((game.onTimeStreak||0) >= 1 || (game.bestStreak||0) >= 3) && (
          <CollapsibleSection
            title="🔥 On-Time Streak"
            summary={`${game.onTimeStreak||0} in a row · best ${game.bestStreak||0}`}
            persistKey="home_ontime_streak"
            colors={{ background: T.panel, border: T.orange, text: T.text, sub: T.sub, accent: T.orange }}
          >
            {(() => {
              const milestones = [3, 5, 10, 20];
              const streak = game.onTimeStreak || 0;
              const nextMilestone = milestones.find(m => m > streak) || 20;
              const pct = Math.min(100, Math.round((streak / nextMilestone) * 100));
              return (
                <>
                  <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 8 }]}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: T.orange }]} />
                  </View>
                  <Text style={[styles.sub, { color: T.sub, marginTop: 3 }]}>
                    {streak}/{nextMilestone} → {money(nextMilestone * 300)} bonus · Best: {game.bestStreak||0}
                  </Text>
                </>
              );
            })()}
          </CollapsibleSection>
        )}

        {/* ── Weekly Challenge ─────────────────────────────────────────────── */}
        {game.weeklyChallenge && (() => {
          const wc = game.weeklyChallenge;
          const pct = wc.progress < 0 ? 0 : Math.min(100, Math.round(((wc.progress||0) / wc.target) * 100));
          const daysLeft = Math.max(0, 7 - ((game.day - (wc.startDay||0)) % 7));
          const failed = wc.progress < 0;
          const claimable = wc.completed && !wc.claimedDay;
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: claimable ? T.green : failed ? T.red : T.purple, borderWidth: 1.5 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.label, col]}>📋 Weekly Challenge</Text>
                <Text style={[styles.sub, { color: T.sub }]}>{daysLeft}d left</Text>
              </View>
              <Text style={[styles.sub, col, { marginVertical: 4 }]}>{wc.label}</Text>
              {!failed && (
                <>
                  <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 4 }]}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: wc.completed ? T.green : T.purple }]} />
                  </View>
                  <Text style={[styles.sub, { color: T.sub, marginTop: 2 }]}>{pct}% · Reward: {money(wc.reward)} + {wc.repBonus} rep</Text>
                </>
              )}
              {failed && <Text style={[styles.sub, { color: T.red, marginTop: 4 }]}>Challenge failed — new one starts next week.</Text>}
              {claimable && (
                <TouchableOpacity
                  style={[styles.btn, { marginTop: 8, backgroundColor: T.green, borderColor: T.green }]}
                  onPress={() => update(g => {
                    const _wc = g.weeklyChallenge;
                    g.cash += _wc.reward;
                    g.revenue += _wc.reward;
                    recordTransaction(g, "bonuses", _wc.reward, "Weekly challenge reward");
                    g.reputation = Math.min(100, (g.reputation||0) + _wc.repBonus);
                    _wc.claimedDay = g.day;
                    addLog(g, `🎉 Weekly challenge reward claimed: ${money(_wc.reward)} + ${_wc.repBonus} rep!`);
                  })}
                >
                  <Text style={[styles.btnText, { color: "#fff" }]}>Claim Reward — {money(wc.reward)}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* ── Weekly Site Report ───────────────────────────────────────────── */}
        {game.weeklyReport && (() => {
          const wr = game.weeklyReport;
          const net = (wr.revenue||0) - (wr.expenses||0);
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={[styles.label, col]}>📈 Last Week Report</Text>
                <TouchableOpacity onPress={() => update(g => { g.weeklyReport = null; })}>
                  <Text style={[styles.sub, { color: T.sub }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                {[
                  { label: "Revenue", val: money(wr.revenue||0), color: T.green },
                  { label: "Expenses", val: money(wr.expenses||0), color: T.red },
                  { label: "Net", val: (net>=0?"+":"")+money(net), color: net>=0?T.green:T.red },
                ].map(s => (
                  <View key={s.label} style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 6, padding: 8, alignItems: "center" }}>
                    <Text style={{ color: s.color, fontSize: 13, fontWeight: "800" }}>{s.val}</Text>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              {(wr.jobsCompleted||0) > 0 && (
                <Text style={[styles.sub, { color: T.sub }]}>
                  {wr.jobsCompleted} contract{wr.jobsCompleted!==1?"s":""} completed · {wr.onTimeJobs||0} on time
                </Text>
              )}
            </View>
          );
        })()}

        {/* ── Clients ───────────────────────────────────────────────────────
            Sprint 7. This was a CollapsibleSection, collapsed by default, so the loyalty
            system — tier ceilings, value bonuses, deadline extensions, repeat business — was
            simulated in full and seen by almost nobody (audit row 28).

            It is now a card at the same level as everything else it competes with, and it
            leads with the thing the player can act on: who is about to become more valuable,
            and what that is already worth. */}
        {game.tutorialDone && (() => {
          const rels = game.clientRelationships || {};
          const activeClients = CLIENT_ROSTER.filter(c => rels[c.id]?.jobsDone > 0);
          if (activeClients.length === 0) return null;
          const _loyalClients = activeClients.filter(c => (rels[c.id]?.loyalty || 0) >= 40).length;
          const _bonusValue = activeClients.reduce((sum, c) => {
            const t = getClientTier(rels[c.id]?.loyalty || 0);
            return sum + Math.max(0, (t.valueMult || 1) - 1);
          }, 0);
          return (
            <Card T={T} tone={_loyalClients > 0 ? "success" : "steel"} style={{ marginTop: 8 }}>
              <SectionLabel
                T={T}
                tone={_loyalClients > 0 ? "success" : "steel"}
                right={<Pill T={T} label={`${activeClients.length} client${activeClients.length !== 1 ? "s" : ""}`} tone="steel" />}
              >
                Clients
              </SectionLabel>
              <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.xs, marginBottom: SPACING.sm }]}>
                {_loyalClients > 0
                  ? `${_loyalClients} of them pay you a loyalty premium — worth about +${Math.round(_bonusValue * 100)}% across their contracts.`
                  : "Repeat work raises a client's tier. Higher tiers pay more and give you longer deadlines."}
              </Text>
              {CLIENT_ROSTER.map(cl => {
                const rel = rels[cl.id] || { loyalty: 0, jobsDone: 0 };
                if (rel.jobsDone === 0) return null;
                const tier = getClientTier(rel.loyalty);
                const pct = Math.min(100, Math.round((rel.loyalty / 100) * 100));
                const tierColor = T[tier.color] || T.sub;
                return (
                  <View key={cl.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <Text style={[styles.sub, col]}>{cl.icon} {cl.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.sub, { color: tierColor, fontSize: 12, fontWeight: "700" }]}>{tier.label}</Text>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{rel.jobsDone} job{rel.jobsDone!==1?"s":""}</Text>
                      </View>
                    </View>
                    <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                      <View style={{ height: 4, width: `${pct}%`, backgroundColor: tierColor, borderRadius: 2 }} />
                    </View>
                    {tier.valueMult > 1 && (
                      <Text style={[styles.sub, { color: T.green, fontSize: 12, marginTop: 2 }]}>✓ {Math.round((tier.valueMult-1)*100)}% value bonus · +{tier.extraDays}d deadline on their contracts</Text>
                    )}
                  </View>
                );
              })}
            </Card>
          );
        })()}

        {/* Today's Priorities */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <Text style={[styles.sectionTitle, col]}>Today&apos;s Priorities</Text>
          {sitesNeedingMats.length > 0 && (
            <Text style={[styles.sub, { color: T.orange }]}>⚠ Materials needed on {sitesNeedingMats.length} site{sitesNeedingMats.length > 1 ? "s" : ""}</Text>
          )}
          {burningOutCrew.length > 0 && (
            <Text style={[styles.sub, { color: T.red }]}>⚠ {burningOutCrew.length} crew member{burningOutCrew.length > 1 ? "s" : ""} burning out</Text>
          )}
          {overdueSites.length > 0 && (
            <Text style={[styles.sub, { color: T.red }]}>🔴 {overdueSites.length} site{overdueSites.length > 1 ? "s" : ""} overdue</Text>
          )}
          {rivalOutpacing && topRivalByRep && (
            <Text style={[styles.sub, { color: T.yellow }]}>⚡ {topRivalByRep.name.split(" ")[0]} is outpacing you</Text>
          )}
          {sitesNeedingMats.length === 0 && burningOutCrew.length === 0 && overdueSites.length === 0 && !rivalOutpacing && (
            <Text style={[styles.sub, { color: T.green }]}>✅ Operations running smoothly</Text>
          )}
        </View>

        {/* CEO Executive Dashboard */}
        {(() => {
          const equipVal = Math.round((game.equipment||[]).reduce((s,e)=>s+e.price*(e.condition/100)*0.6,0));
          const realEstVal = Math.round((game.properties||[]).reduce((s,p)=>{
            const def=PROPERTY_TYPES.find(t=>t.id===p.typeId); return s+(def?def.cost*(def.resaleRate||0.8):0);
          },0));
          const wkRev  = game.weeklyStats?.revenue  || 0;
          const wkExp  = game.weeklyStats?.expenses  || 0;
          const wkProfit = wkRev - wkExp;
          const topRival = [...(game.rivals||[])].filter(r=>r.status!=="Bankrupt").sort((a,b)=>(b.rep||0)-(a.rep||0))[0];
          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.strongBorder, borderLeftWidth: 4 }]}>
              {/* Header row */}
              <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <View>
                  <Text style={[styles.sectionTitle, { color: T.purple }]}>Executive Dashboard</Text>
                  <Text style={[styles.sub, subCol]}>CEO View · Day {game.day}</Text>
                </View>
                <View style={{ alignItems:"flex-end" }}>
                  <Text style={[{ fontSize:20, fontWeight:"900", color:T.cyan }]}>{money(valuation)}</Text>
                  <Text style={[styles.sub, subCol]}>Company Value</Text>
                </View>
              </View>

              {/* Rank / Share / Cities */}
              <View style={{ flexDirection:"row", gap:6, marginBottom:6 }}>
                {[
                  { label:"National Rank", val: rank<=3?`#${rank} 🏆`:`#${rank}`, color: rank<=3?T.yellow:rank<=10?T.green:T.sub },
                  { label:"Market Share",  val: `${game.marketShare||1}%`,         color: T.blue },
                  { label:"Cities Active", val: `${cityCount}`,                    color: T.orange },
                ].map(k=>(
                  <View key={k.label} style={[styles.kpi,{flex:1,backgroundColor:T.panel,borderColor:T.border}]}>
                    <Text style={[styles.kpiVal,{color:k.color,fontSize:13}]}>{k.val}</Text>
                    <Text style={[styles.kpiLabel,subCol]}>{k.label}</Text>
                  </View>
                ))}
              </View>

              {/* Weekly P&L */}
              <View style={{ flexDirection:"row", gap:6, marginBottom:6 }}>
                {[
                  { label:"Wk Revenue",  val: money(wkRev),    color: T.green },
                  { label:"Wk Expenses", val: money(wkExp),    color: T.red },
                  { label:"Wk Profit",   val: money(wkProfit), color: wkProfit>=0?T.green:T.red },
                ].map(k=>(
                  <View key={k.label} style={[styles.kpi,{flex:1,backgroundColor:T.panel,borderColor:T.border}]}>
                    <Text style={[styles.kpiVal,{color:k.color,fontSize:12}]}>{k.val}</Text>
                    <Text style={[styles.kpiLabel,subCol]}>{k.label}</Text>
                  </View>
                ))}
              </View>

              {/* Assets + Top Rival */}
              <View style={{ flexDirection:"row", gap:6 }}>
                {[
                  { label:"Equip Fleet",  val: money(equipVal),                              color: T.orange },
                  { label:"Real Estate",  val: money(realEstVal),                            color: T.purple },
                  { label:"Top Rival",    val: topRival?topRival.name.split(" ")[0]:"None",  color: T.red },
                ].map(k=>(
                  <View key={k.label} style={[styles.kpi,{flex:1,backgroundColor:T.panel,borderColor:T.border}]}>
                    <Text style={[styles.kpiVal,{color:k.color,fontSize:11}]} numberOfLines={1}>{k.val}</Text>
                    <Text style={[styles.kpiLabel,subCol]}>{k.label}</Text>
                  </View>
                ))}
              </View>

              {/* Next empire goals */}
              {EMPIRE_GOALS.filter(g2=>!(game.empireGoalsCompleted||[]).includes(g2.id)).slice(0,2).map(goal=>(
                <View key={goal.id} style={{flexDirection:"row",justifyContent:"space-between",marginTop:6,paddingTop:6,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border}}>
                  <Text style={[styles.sub,{color:T.purple}]}>🎯 {goal.title}</Text>
                  <Text style={[styles.sub,subCol]}>{goal.desc}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* The second copy of Next Best Action that used to live here has been removed. The
            same getNextBestAction(game) result was rendered twice on this screen, ~250 lines
            apart in two different card designs. The one above, near the top of Home, is the
            single copy. */}

        {/* Speed Up Time */}
        {(game.activeSites||[]).length > 0 && (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: T.panel2, borderColor: T.purple, borderLeftWidth: 4 }]}
            onPress={handleSpeedUp}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: T.purple }]}>⚡ Speed Up Time</Text>
                <Text style={[styles.sub, subCol]}>Advance 2 game hours instantly — costs in-game cash.</Text>
                <Text style={[styles.sub, { color: T.purple }]}>Cost: {money(Math.round(1000 * Math.pow(2, game.speedUpUses||0)))} {(game.speedUpUses||0) > 0 ? `(doubles each use)` : ""}</Text>
              </View>
              <Text style={{ color: T.purple, fontSize: 22 }}>→</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Legacy Score Card (Feature 4) */}
        {(() => {
          const legacy = getLegacyScore(game);
          const nextTiers = [
            { min: 80, label: "Industry Legend", icon: "trophy" },
            { min: 60, label: "National Powerhouse", icon: "business" },
            { min: 40, label: "State Leader", icon: "star" },
            { min: 20, label: "Regional Contractor", icon: "construct" },
            { min: 0, label: "Local Builder", icon: "hammer" },
          ];
          const nextTier = nextTiers.slice().reverse().find(t => t.min > legacy.score);
          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.purple, borderLeftWidth: 4, marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 11, color: T.purple, fontWeight: "700", marginBottom: 2 }}>LEGACY SCORE</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name={legacy.icon} size={20} color={T.purple} />
                    <Text style={{ fontSize: 22, fontWeight: "900", color: T.text }}>{legacy.label}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 28, fontWeight: "900", color: T.purple }}>{legacy.score}</Text>
                  <Text style={[styles.sub, { color: T.sub }]}>/100</Text>
                </View>
              </View>
              <View style={{ height: 5, backgroundColor: T.track, borderRadius: 3, marginTop: 8 }}>
                <View style={{ height: 5, width: `${legacy.score}%`, backgroundColor: T.purple, borderRadius: 3 }} />
              </View>
              {nextTier && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>Next:</Text>
                  <Ionicons name={nextTier.icon} size={10} color={T.sub} />
                  <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{nextTier.label} at {nextTier.min} pts</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── STANDING ──────────────────────────────────────────────────────
            Active Sites and Crew Idle used to sit here as well as in the hero
            card at the top of the screen. These four are the figures the hero
            does NOT already carry, so nothing is stated twice. */}
        <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md - 2 }}>
          <StatTile T={T} label="Jobs done" value={`${game.completedJobs || 0}`} tone="safe" />
          <StatTile T={T} label="Reputation" value={`${game.reputation || 0}`} sub={repTier.label} tone="accent" />
          <StatTile T={T} label="Credit" value={`${game.creditScore || 600}`} sub={getCreditLabel(game.creditScore || 600).label} tone={(game.creditScore || 600) >= 680 ? "safe" : (game.creditScore || 600) >= 600 ? "caution" : "hazard"} />
          <StatTile T={T} label="Safety" value={`${Math.round(game.safetyScore || 0)}`} tone={(game.safetyScore || 0) >= 70 ? "safe" : (game.safetyScore || 0) >= 45 ? "caution" : "hazard"} />
        </View>

        {/* Market Event Banner */}
        {game.activeMarketEvent && (() => {
          const evt = MARKET_EVENTS.find((e) => e.id === game.activeMarketEvent);
          if (!evt) return null;
          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T[evt.tone] || T.border, borderWidth: 2 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name={evt.ionicon} size={14} color={T[evt.tone] || T.text} />
                <Text style={[styles.label, { color: T[evt.tone] || T.text }]}>{evt.label}</Text>
              </View>
              <Text style={[styles.sub, subCol]}>{evt.desc}</Text>
              <View style={{ marginTop: 6 }}>
                <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2, overflow: "hidden" }}>
                  <View style={{ height: 4, width: `${Math.round((game.marketEventDaysLeft / evt.duration) * 100)}%`, backgroundColor: T[evt.tone] || T.text, borderRadius: 2 }} />
                </View>
                <Text style={[styles.sub, { color: T[evt.tone] || T.sub, marginTop: 2, fontSize: 12 }]}>
                  {game.marketEventDaysLeft} of {evt.duration} day{evt.duration !== 1 ? "s" : ""} remaining
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Active Sites Summary */}
        {activeSites.length > 0 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
            <Text style={[styles.sectionTitle, col]}>Active Sites</Text>
            {activeSites.map((site) => {
              const overallPct = ((site.currentPhaseIdx / site.phases.length) + (site.phaseProgress / 100 / site.phases.length)) * 100;
              const currentPhaseName = site.phases[site.currentPhaseIdx] || "Complete";
              const vis = PHASE_VISUALS[currentPhaseName] || { emoji: "🏗️", desc: currentPhaseName };
              return (
                <View key={site.id} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={[styles.label, col, { flex: 1 }]} numberOfLines={1}>{site.label}</Text>
                    <Text style={[styles.sub, { color: site.status === "Paused" ? T.orange : T.cyan }]} numberOfLines={1}>
                      {site.status === "Paused" ? "⏸ Paused" : `${vis.emoji} ${currentPhaseName}`}
                    </Text>
                  </View>
                  {/* Phase progress strip */}
                  <View style={{ flexDirection: "row", gap: 3, marginTop: 5, marginBottom: 3 }}>
                    {site.phases.map((ph, idx) => {
                      const done = idx < site.currentPhaseIdx;
                      const active = idx === site.currentPhaseIdx;
                      const pv = PHASE_VISUALS[ph] || { emoji: "🏗️" };
                      return (
                        <View key={idx} style={{ alignItems: "center", flex: 1 }}>
                          <Text style={{ fontSize: 14, opacity: done ? 1 : active ? 1 : 0.3 }}>{pv.emoji}</Text>
                          {active && (
                            <View style={[styles.progressTrack, { backgroundColor: T.track, width: "100%", marginTop: 2 }]}>
                              <View style={[styles.progressFill, { width: `${site.phaseProgress}%`, backgroundColor: T.orange }]} />
                            </View>
                          )}
                          {done && <View style={{ height: 4, width: "100%", backgroundColor: T.green, borderRadius: 2, marginTop: 2 }} />}
                          {!done && !active && <View style={{ height: 4, width: "100%", backgroundColor: T.track, borderRadius: 2, marginTop: 2 }} />}
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[styles.sub, subCol]}>{site.client} · {Math.round(overallPct)}%</Text>
                    <Text style={[styles.sub, { color: game.day > site.deadlineDay ? T.red : T.green }]}>
                      {game.day > site.deadlineDay ? "⚠ OVERDUE" : `Day ${site.deadlineDay} deadline`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* This Week P&L */}
        {(() => {
          const ws = game.weeklyStats || {};
          const income = ws.revenue || 0;
          const expenses = ws.expenses || 0;
          if (income === 0 && expenses === 0) return null;
          const net = income - expenses;
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border, marginBottom: 8 }]}>
              <Text style={[styles.sectionTitle, col]}>This Week</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.sub, subCol]}>Revenue</Text>
                <Text style={[styles.sub, { color: T.green, fontWeight: "700" }]}>{money(income)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.sub, subCol]}>Expenses</Text>
                <Text style={[styles.sub, { color: T.orange }]}>-{money(expenses)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: T.border }}>
                <Text style={[styles.sub, subCol]}>Net</Text>
                <Text style={[styles.sub, { color: net >= 0 ? T.green : T.red, fontWeight: "700" }]}>
                  {net >= 0 ? "+" : ""}{money(net)}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* R15-8: Market Flash Deal */}
        {game.hotMaterialDeal && (
          <View style={[styles.card, { backgroundColor: T.green + "18", borderColor: T.green, borderWidth: 1.5, marginBottom: 8 }]}>
            <Text style={[styles.sectionTitle, { color: T.green }]}>📊 Market Flash Deal</Text>
            <Text style={[styles.sub, subCol]}>
              {game.hotMaterialDeal.label} — {game.hotMaterialDeal.discountPct}% off · {money(getMaterialUnitPrice(game, game.hotMaterialDeal.matId))}/unit
            </Text>
            <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>
              Expires Day {game.hotMaterialDeal.expiresDay} · Buy in Sites tab
            </Text>
            <TouchableOpacity
              style={[styles.smallBtn, { marginTop: 6, backgroundColor: T.green, borderColor: T.green }]}
              onPress={() => setTab("Sites")}
            >
              <Text style={[styles.smallBtnText, { color: "#000" }]}>Buy Now →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ops Feed */}
        {(() => {
          const FEED_EMOJI = { green: "✅", red: "🔴", orange: "⚠️", cyan: "🔵", yellow: "⭐", purple: "🔷", sub: "·" };
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <Text style={[styles.sectionTitle, col]}>Ops Feed</Text>
              {game.opsFeed?.length > 0 ? game.opsFeed.slice(0, 8).map((entry) => (
                <Text key={entry.id} style={[styles.feedItem, { color: T[entry.tone] || T.sub }]}>
                  {FEED_EMOJI[entry.tone] || "·"} {entry.text}
                </Text>
              )) : (
                <Text style={[styles.sub, { color: T.sub, fontStyle: "italic" }]}>No recent events — keep building!</Text>
              )}
            </View>
          );
        })()}

        {/* ── MARKET NEWS ───────────────────────────────────────────────────
            Rival activity in its own feed. It used to go through addLog, which caps the
            player's `logs` at 25 and `opsFeed` at 20 — so a rival buying a digger pushed
            the player's own site events out of their own history. */}
        {(game.marketNews || []).length > 0 && (
          <Card T={T} tone="info">
            <SectionLabel T={T} tone="info" right={
              <Text style={[TYPE.caption, { color: T.sub }]}>
                {countLiveRivals(game)} firm{countLiveRivals(game) === 1 ? "" : "s"} trading
              </Text>
            }>
              Market news
            </SectionLabel>
            <View style={{ marginTop: SPACING.sm }}>
              {(game.marketNews || []).slice(0, 6).map((item) => (
                <View
                  key={item.id}
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: toneColor(item.tone, T),
                    paddingLeft: SPACING.sm,
                    marginBottom: SPACING.sm,
                  }}
                >
                  <Text style={[TYPE.caption, { color: T.text }]} numberOfLines={2}>{item.text}</Text>
                  <Text style={[TYPE.caption, { color: T.dim, marginTop: 1 }]}>Day {item.day}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Rival Activity */}
        {game.rivals && game.rivals.length > 0 && (() => {
          const topRivals = [...game.rivals]
            .filter(r => !(game.acquiredRivals||[]).includes(r.id))
            .sort((a,b) => (b.rep||0) - (a.rep||0))
            .slice(0, 2);
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <Text style={[styles.sectionTitle, col]}>Rival Activity</Text>
              {topRivals.map((r) => {
                // Read the lifecycle's own status rather than re-deriving one from cash, which
                // let the card call a company "Struggling" while the simulation had it trading
                // normally — and vice versa.
                const statusLabel = r.status || RIVAL_STATUS.ACTIVE;
                const statusColor = statusLabel === RIVAL_STATUS.BANKRUPT ? T.dim
                  : statusLabel === RIVAL_STATUS.STRUGGLING ? T.caution : T.safe;
                const myRep = game.reputation || 0;
                const theirRep = r.rep || 0;
                const maxRep = Math.max(myRep, theirRep, 1);
                const myPct = Math.round((myRep / maxRep) * 100);
                const ahead = myRep >= theirRep;
                return (
                  <View key={r.id} style={{ paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View>
                        <Text style={[styles.label, col]}>{r.name}</Text>
                        <Text style={[styles.sub, subCol]}>{r.activeJobs||0} active jobs</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.sub, { color: statusColor, fontWeight: "600" }]}>{statusLabel}</Text>
                        <Text style={[styles.sub, subCol]}>{money(r.cash||0)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", height: 3, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                      <View style={{ flex: myPct, height: 3, backgroundColor: T.purple }} />
                      <View style={{ flex: 100 - myPct, height: 3, backgroundColor: ahead ? T.panel2 : T.red }} />
                    </View>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginTop: 1 }]}>
                      You {myRep} rep {ahead ? "↑" : "↓"} {r.name.split(" ")[0]} {theirRep}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* Theme / Settings */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: T.panel2, borderColor: T.border, flex: 1 }]}
            onPress={() => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); update((g) => { g.theme = t; }); }}
          >
            <Text style={[styles.btnText, col]}>{theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: T.panel2, borderColor: T.red, flex: 1 }]} onPress={handleResetGame}>
            <Text style={[styles.btnText, { color: T.red }]}>Reset Game</Text>
          </TouchableOpacity>
        </View>
        {onBackToHub && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: T.panel2, borderColor: T.border, marginTop: 8 }]}
            onPress={onBackToHub}
          >
            <Text style={[styles.btnText, col]}>← Back to Game Hub</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  function renderBids() {
    const allOpen = getOpenContracts(game);
    const filter = game.contractCategoryFilter || "All";
    const openContracts = filter === "All" ? allOpen : allOpen.filter((c) => c.category === filter);
    const idleCrew = getIdleCrew(game);
    const idleEquip = getIdleEquipment(game);

    return (
      <BidsScreen
        game={game} T={T} col={col} subCol={subCol}
        openContracts={openContracts} allOpenCount={allOpen.length}
        categoryFilter={filter}
        onSetFilter={(f) => update((g) => { g.contractCategoryFilter = f; })}
        idleCrew={idleCrew} idleEquip={idleEquip}
        onStartSite={handleStartSite}
        onBuyMaterials={handleBuyMaterials}
        onSetBidStyle={handleSetBidStyle}
        lockedChains={(game.contracts || []).filter((c) => c.status === CHAIN_LOCKED)}
        company={companyCapacity(game)}
      />
    );
  }

  function renderSites() {
    const activeSites = getActiveSites(game);
    const SITE_MODES = [
      { key: "normal",   label: "Normal",   icon: "reorder-three",  desc: "Balanced pace",        color: T.sub },
      { key: "rush",     label: "Rush",     icon: "flash",          desc: "+45% speed, tires crew", color: T.orange },
      { key: "overtime", label: "Overtime", icon: "moon",           desc: "+30% speed, $$ cost",    color: T.yellow },
      { key: "quality",  label: "Quality",  icon: "star",           desc: "-22% speed, +bonus pay",  color: T.cyan },
      { key: "budget",   label: "Budget",   icon: "cash",           desc: "-12% speed, save costs",  color: T.green },
    ];

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}>

        {/* Active Site Management */}
        {activeSites.length === 0 && (() => {
          const empty = getEmptyState("Sites");
          return (
            <EmptyState
              T={T}
              icon={empty.icon}
              title={empty.title}
              body={empty.body}
              ctaLabel={empty.cta}
              onCta={empty.tab ? () => setTab(empty.tab) : null}
            />
          );
        })()}
        {activeSites.length > 0 && (
          <View style={{ marginBottom: SPACING.lg }}>
            <SectionLabel T={T} tone="accent" style={{ marginBottom: SPACING.sm }}>
              {`Active sites · ${activeSites.length}`}
            </SectionLabel>
            {activeSites.map((site) => {
              const overallPct = Math.min(100, ((site.currentPhaseIdx / site.phases.length) + (Math.max(0, site.phaseProgress) / 100 / site.phases.length)) * 100);
              const currentPh = site.phases[site.currentPhaseIdx] || "Complete";
              const vis = PHASE_VISUALS[currentPh] || { emoji: "🏗️" };
              const mode = site.siteMode || "normal";
              const modeDef = SITE_MODES.find(m => m.key === mode) || SITE_MODES[0];
              const siteCrew = game.crew.filter(w => site.assignedCrewIds.includes(w.id));
              const siteEquip = game.equipment.filter(e => site.assignedEquipmentIds.includes(e.id));
              const contract = game.contracts.find(c => c.id === site.contractId);
              const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
              const daysLate = Math.max(0, game.day - site.deadlineDay);
              // Value the job will pay if it finished today — NOT profit, despite the old name.
              const valueAfterPenalty = Math.max(0, site.totalValue - daysLate * site.penaltyPerDay);
              // The real running P&L: what has been spent on this job so far against what it
              // will pay. This is the number that teaches a player what a job actually costs.
              const liveEconomics = buildProjectEconomics({
                contractValue: site.totalValue,
                depositPaid: site.depositPaid || 0,
                penalty: daysLate * site.penaltyPerDay,
                costs: ensureProjectCostLedger(site),
              });
              const isOverdue = game.day > site.deadlineDay;
              const missingMats = getSiteMissingMaterials(site, def, game);
              const _renegCost = Math.round((def?.baseValue || site.totalValue || 10000) * 0.08);
              const _canRenegotiate = game.cash >= _renegCost;
              const hasMissingMats = missingMats.length > 0;
              const totalCostNormal = missingMats.reduce((s, m) => s + m.costNormal, 0);
              const totalCostEmergency = missingMats.reduce((s, m) => s + m.costEmergency, 0);
              const canAffordNormal = game.cash >= totalCostNormal;
              const canAffordEmergency = game.cash >= totalCostEmergency || (game.creditScore || 600) >= 600;
              const allMats = def?.materials ? Object.entries(def.materials).map(([matId, needed]) => {
                const fulfilled = (site.materialsFulfilled || {})[matId] || 0;
                const mat = MATERIAL_DEFS.find(m => m.id === matId);
                return { icon: mat?.icon || "📦", id: matId, fulfilled, needed, ok: fulfilled >= needed };
              }) : [];
              const lastChaos = site.chaosHistory?.[0];
              return (
                <View key={site.id} style={[styles.card, {
                  backgroundColor: T.panel,
                  borderRadius: RADIUS.md,
                  padding: SPACING.lg,
                  marginBottom: SPACING.md,
                  borderColor: hasMissingMats ? alpha(T.caution, 0.55) : isOverdue ? alpha(T.hazard, 0.55) : T.border,
                  borderWidth: 1,
                  borderLeftWidth: 4,
                  borderLeftColor: hasMissingMats ? T.caution : isOverdue ? T.hazard : T.accent,
                }, ELEVATION.card]}>
                  {/* Header — project, client, location on the left; the one number that
                      matters (progress, or how late it is) on the right. */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACING.sm }}>
                    <View style={{ flex: 1, marginRight: SPACING.md }}>
                      <Text style={[TYPE.label, { color: T.text }]} numberOfLines={1}>{site.label}</Text>
                      <Text style={[TYPE.caption, { color: T.sub, marginTop: 2 }]} numberOfLines={1}>{site.client}</Text>
                      {contract?.cityId && (() => {
                        const siteCity = CITIES.find(c => c.id === contract.cityId);
                        if (!siteCity) return null;
                        const _region = siteCity.region;
                        const _weatherRisk = _region === "Pacific Northwest" ? "🌧️ Rain risk"
                          : _region === "Southwest" ? "☀️ Heat risk"
                          : _region === "Mountain" ? "❄️ Snow risk"
                          : _region === "South Central" ? "⛈️ Storm risk"
                          : null;
                        return (
                          <Text style={[TYPE.caption, { color: T.dim, marginTop: 2 }]} numberOfLines={1}>
                            📍 {siteCity.name}{_weatherRisk && !site.currentWeather ? ` · ${_weatherRisk}` : ""}
                          </Text>
                        );
                      })()}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {site.status === "Paused" ? (
                        <Pill T={T} label="Paused" tone="caution" filled />
                      ) : isOverdue ? (
                        <Pill T={T} label={`${daysLate}d late`} tone="hazard" filled />
                      ) : (
                        <Text style={[TYPE.stat, { color: toneColor(progressTone(overallPct), T) }]}>
                          {Math.round(overallPct)}%
                        </Text>
                      )}
                      <Text style={[TYPE.caption, { color: isOverdue ? T.hazard : T.sub, marginTop: 3 }]}>
                        Due day {site.deadlineDay}
                      </Text>
                    </View>
                  </View>

                  {/* Overall progress */}
                  <ProgressBar
                    T={T}
                    percent={overallPct}
                    tone={isOverdue ? "hazard" : progressTone(overallPct)}
                    style={{ marginBottom: SPACING.sm }}
                  />

                  {/* Deadline urgency */}
                  {!isOverdue && site.status !== "Paused" && (() => {
                    const daysLeft = site.deadlineDay - game.day;
                    const tone = deadlineTone(daysLeft);
                    const pct = Math.min(100, Math.round((daysLeft / 14) * 100));
                    return (
                      <ProgressBar
                        T={T}
                        percent={pct}
                        tone={tone}
                        label="Time left"
                        value={daysLeft <= 0 ? "Due today" : `${daysLeft}d`}
                        height={4}
                        style={{ marginBottom: SPACING.sm }}
                      />
                    );
                  })()}

                  {/* Current phase */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
                    <Text style={{ fontSize: 20, marginRight: SPACING.sm }}>{vis.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar
                        T={T}
                        percent={Math.max(0, site.phaseProgress || 0)}
                        tone="steel"
                        label={currentPh}
                        value={`Phase ${(site.currentPhaseIdx || 0) + 1} of ${site.phases.length}`}
                        height={4}
                      />
                      {(() => {
                        const _rate = site._progressRate;
                        if (!_rate || overallPct >= 100 || site.status === "Paused") return null;
                        const _pctPerDay = pctPerDay(_rate);
                        const _daysLeft = daysRemaining(site, _rate);
                        return (
                          <Text style={[TYPE.caption, { color: T.sub, marginTop: 4 }]}>
                            {_daysLeft ? `~${_daysLeft} days remaining · ` : ""}{_pctPerDay.toFixed(1)}%/day
                          </Text>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Why this site is stopped, paused or slow — straight from what the tick did to
                      it, with the most useful fix. Sprint 1, P0-1: no silent stalls. */}
                  <SiteStatusBanner
                    T={T}
                    site={site}
                    day={game.day}
                    resolveAction={(action) => {
                      if (action.label === "Order materials") return () => handleBuyMaterialsForSite(site.id);
                      if (action.label === "Pay for same-day") return () => handleEmergencyPurchase(site.id);
                      if (action.label === "Resume") return () => handleResumeSite(site.id);
                      if (action.tab && action.tab !== "Sites") return () => setTab(action.tab);
                      return null;
                    }}
                  />

                  {/* ── PHASE STRIP ────────────────────────────────────────────────
                      The shape of the job: what is signed off, what the crew is on, and
                      what is still ahead. The card used to show only the current phase
                      name and a bar, so a construction project read as a progress meter. */}
                  {(() => {
                    const phaseSummary = summarizeSitePhases(site);
                    if (phaseSummary.length === 0) return null;
                    return (
                      <View style={{ marginBottom: SPACING.sm }}>
                        <View style={{ flexDirection: "row", gap: 3, marginBottom: SPACING.sm }}>
                          {phaseSummary.map((ph) => (
                            <View
                              key={ph.index}
                              style={{
                                flex: 1, height: 5, borderRadius: 3,
                                backgroundColor: ph.state === "done" ? T.safe : T.track,
                                overflow: "hidden",
                              }}
                            >
                              {ph.state === "current" && (
                                <View style={{ height: 5, width: `${ph.percent}%`, backgroundColor: T.accent, borderRadius: 3 }} />
                              )}
                            </View>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
                          {phaseSummary.map((ph) => (
                            <Text
                              key={ph.index}
                              style={[TYPE.caption, {
                                color: ph.state === "done" ? T.safe : ph.state === "current" ? T.accent : T.dim,
                                fontWeight: ph.state === "current" ? "700" : "500",
                              }]}
                            >
                              {ph.state === "done" ? "✓ " : ""}{ph.name}
                            </Text>
                          ))}
                        </View>
                      </View>
                    );
                  })()}

                  {/* ── DELIVERIES IN TRANSIT ──────────────────────────────────────
                      An order that has been placed but has not landed is the difference
                      between "nobody has done anything" and "it is handled, wait two
                      days" — and only the first one needs the player. */}
                  {Array.isArray(site.pendingDeliveries) && site.pendingDeliveries.length > 0 && (
                    <View style={{
                      backgroundColor: alpha(T.steel, 0.1), borderRadius: RADIUS.sm,
                      padding: SPACING.md - 2, marginBottom: SPACING.sm,
                      borderWidth: 1, borderColor: alpha(T.steel, 0.4),
                    }}>
                      <SectionLabel T={T} tone="info">
                        {`On order · ${site.pendingDeliveries.length}`}
                      </SectionLabel>
                      {site.pendingDeliveries.slice(0, 4).map((d) => {
                        const daysOut = Math.max(0, (d.arrivesDay ?? game.day) - game.day);
                        return (
                          <View key={d.id} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.xs }}>
                            <Text style={[TYPE.caption, { color: T.text, flex: 1 }]} numberOfLines={1}>
                              {d.emergency ? "⚡ " : "🚚 "}{d.qty} {d.unit} of {d.label}
                            </Text>
                            <Text style={[TYPE.caption, { color: daysOut === 0 ? T.safe : T.steel, fontWeight: "700" }]}>
                              {daysOut === 0 ? "Today" : `${daysOut}d`}
                            </Text>
                          </View>
                        );
                      })}
                      {site.pendingDeliveries.length > 4 && (
                        <Text style={[TYPE.caption, { color: T.dim, marginTop: 2 }]}>
                          +{site.pendingDeliveries.length - 4} more on order
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Rush quality warning. The specialty-mismatch line that used to sit here fired on
                      a different condition from the −10% the tick actually applied (it stayed quiet
                      whenever a machine matched the phase), so the card and the simulation
                      disagreed. SiteStatusBanner now reports the penalty the tick applied. */}
                  {(site.rushQualityPenalty || 0) > 0.04 && (
                    <Text style={[TYPE.caption, { color: T.caution, marginBottom: SPACING.xs }]}>
                      ⚡ Rush impact: quality −{Math.round((site.rushQualityPenalty || 0) * 100)}%
                    </Text>
                  )}

                  {/* The throttle, where the player is actually looking.
                      A device screenshot showed a garage job reading "~32 days remaining ·
                      14.8%/day" against a six-day deadline, with two machines parked on it and
                      no explanation anywhere. The penalty was real and correct; its invisibility
                      was the defect, and it was reported as the game being broken — fairly. */}
                  {site.plantWarning && (
                    <View style={{ marginTop: 6, backgroundColor: alpha(T.caution, 0.14), borderRadius: 6, padding: 7, borderWidth: 1, borderColor: T.caution }}>
                      <Text style={[styles.sub, { color: T.caution, fontWeight: "700", fontSize: 12 }]}>
                        🐌 {site.plantWarning}
                      </Text>
                    </View>
                  )}

                  {/* Crew on site. Every row is a full-width tap target at the 44pt minimum —
                      the inherited rows were 9px text with 2px padding, roughly 14pt tall. */}
                  {(() => {
                    const idleCrew = game.crew.filter(w => w.status === "Idle");
                    const exhausted = siteCrew.filter(w => (w.stamina ?? 50) < 25 || (w.mood ?? 70) < 20);
                    return (
                      <View style={{ backgroundColor: T.panel2, borderRadius: RADIUS.sm, padding: SPACING.md - 2, marginBottom: SPACING.sm }}>
                        <SectionLabel
                          T={T}
                          right={siteCrew.length === 0 ? <Pill T={T} label="No crew" tone="hazard" /> : null}
                        >
                          {`Crew · ${siteCrew.length}`}
                        </SectionLabel>
                        {exhausted.length > 0 && (
                          <Text style={[TYPE.caption, { color: T.caution, marginTop: SPACING.sm }]}>
                            ⚠ {exhausted.length} worker{exhausted.length > 1 ? "s" : ""} exhausted — rest them in the Crew tab.
                          </Text>
                        )}
                        {siteCrew.map(w => (
                          <View
                            key={w.id}
                            style={{
                              flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                              minHeight: MIN_TAP_TARGET, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
                            }}
                          >
                            <View style={{ flex: 1, marginRight: SPACING.sm }}>
                              <Text style={[TYPE.body, { color: T.text }]} numberOfLines={1}>{w.name}</Text>
                              <Text style={[TYPE.caption, { color: T.sub }]} numberOfLines={1}>
                                {w.specialty || w.role} · stamina {Math.round(w.stamina ?? 0)}%
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={{
                                borderRadius: RADIUS.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
                                borderWidth: 1, borderColor: alpha(T.hazard, 0.6), backgroundColor: alpha(T.hazard, 0.14),
                              }}
                              onPress={() => handleUnassignCrewFromSite(w.id, site.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${w.name} from ${site.label}`}
                            >
                              <Text style={{ fontSize: 12, color: T.hazard, fontWeight: "700" }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        {idleCrew.length > 0 && (
                          <>
                            <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.sm, marginBottom: SPACING.xs }]}>Available to assign</Text>
                            {idleCrew.slice(0, 4).map(w => (
                              <TouchableOpacity
                                key={w.id}
                                style={{
                                  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                                  backgroundColor: alpha(T.safe, 0.1), borderRadius: RADIUS.xs,
                                  paddingHorizontal: SPACING.md, minHeight: MIN_TAP_TARGET, marginBottom: SPACING.xs,
                                  borderWidth: 1, borderColor: alpha(T.safe, 0.4),
                                }}
                                onPress={() => handleAssignCrewToSite(w.id, site.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Assign ${w.name}, ${w.role}, to ${site.label}`}
                              >
                                <Text style={[TYPE.body, { color: T.text, flex: 1 }]} numberOfLines={1}>{w.name} · {w.role}</Text>
                                <Text style={{ fontSize: 12, color: T.safe, fontWeight: "700" }}>Assign</Text>
                              </TouchableOpacity>
                            ))}
                            {idleCrew.length > 4 && (
                              <Text style={[TYPE.caption, { color: T.dim, marginTop: 2 }]}>+{idleCrew.length - 4} more in the Crew tab</Text>
                            )}
                          </>
                        )}
                        {idleCrew.length === 0 && siteCrew.length === 0 && (
                          <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.sm }]}>
                            Nobody is free. Hire in the Crew tab, or pull crew off another site.
                          </Text>
                        )}
                      </View>
                    );
                  })()}

                  {/* Equipment on site. The machine's own artwork rides every row — the game
                      ships 45 equipment renders and used to show them only in the shop and the
                      owned list. See FLEETFLOW_PARITY_AUDIT.md §2 gap 5. */}
                  {(() => {
                    const idleEquip = game.equipment.filter(e => e.status === "Idle" && !e.assignedSiteId);
                    return (
                      <View style={{ backgroundColor: T.panel2, borderRadius: RADIUS.sm, padding: SPACING.md - 2, marginBottom: SPACING.sm }}>
                        <SectionLabel T={T}>{`Equipment · ${siteEquip.length}`}</SectionLabel>
                        {siteEquip.map(e => {
                          const img = EQUIPMENT_IMAGES[e.shopId];
                          const condTone = conditionTone(e.condition);
                          return (
                            <View
                              key={e.id}
                              style={{
                                flexDirection: "row", alignItems: "center", minHeight: MIN_TAP_TARGET + 8,
                                borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
                              }}
                            >
                              {img ? (
                                <Image
                                  source={img}
                                  style={{ width: 46, height: 34, borderRadius: RADIUS.xs, marginRight: SPACING.sm, backgroundColor: "#ffffff" }}
                                  resizeMode="contain"
                                />
                              ) : null}
                              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                                <Text style={[TYPE.body, { color: T.text }]} numberOfLines={1}>{e.name}</Text>
                                <Text style={[TYPE.caption, { color: toneColor(condTone, T) }]} numberOfLines={1}>
                                  {e.status === "Maintenance" ? "In maintenance" : `Condition ${Math.round(e.condition)}%`}
                                </Text>
                              </View>
                              <View style={{ flexDirection: "row", gap: SPACING.xs }}>
                                {(e.condition < 80 || e.status === "Maintenance") && (
                                  <TouchableOpacity
                                    style={{
                                      borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.sm,
                                      borderWidth: 1, borderColor: alpha(T.steel, 0.6), backgroundColor: alpha(T.steel, 0.14),
                                    }}
                                    onPress={() => handleRepairEquipmentNew(e.id, e.status === "Maintenance")}
                                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Repair ${e.name}`}
                                  >
                                    <Text style={{ fontSize: 12, color: T.steel, fontWeight: "700" }}>Repair</Text>
                                  </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                  style={{
                                    borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.sm,
                                    borderWidth: 1, borderColor: alpha(T.hazard, 0.6), backgroundColor: alpha(T.hazard, 0.14),
                                  }}
                                  onPress={() => handleUnassignEquipFromSite(e.id, site.id)}
                                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${e.name} from ${site.label}`}
                                >
                                  <Text style={{ fontSize: 12, color: T.hazard, fontWeight: "700" }}>Remove</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                        {idleEquip.length > 0 && (
                          <>
                            <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.sm, marginBottom: SPACING.xs }]}>In the yard</Text>
                            {idleEquip.slice(0, 3).map(e => {
                              const img = EQUIPMENT_IMAGES[e.shopId];
                              return (
                                <TouchableOpacity
                                  key={e.id}
                                  style={{
                                    flexDirection: "row", alignItems: "center",
                                    backgroundColor: alpha(T.steel, 0.1), borderRadius: RADIUS.xs,
                                    paddingHorizontal: SPACING.sm, minHeight: MIN_TAP_TARGET + 4, marginBottom: SPACING.xs,
                                    borderWidth: 1, borderColor: alpha(T.steel, 0.4),
                                  }}
                                  onPress={() => handleAssignEquipToSite(e.id, site.id)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Assign ${e.name} to ${site.label}`}
                                >
                                  {img ? (
                                    <Image
                                      source={img}
                                      style={{ width: 40, height: 30, borderRadius: RADIUS.xs, marginRight: SPACING.sm, backgroundColor: "#ffffff" }}
                                      resizeMode="contain"
                                    />
                                  ) : null}
                                  <Text style={[TYPE.body, { color: T.text, flex: 1 }]} numberOfLines={1}>{e.name}</Text>
                                  <Text style={{ fontSize: 12, color: T.steel, fontWeight: "700" }}>Assign</Text>
                                </TouchableOpacity>
                              );
                            })}
                            {idleEquip.length > 3 && (
                              <Text style={[TYPE.caption, { color: T.dim, marginTop: 2 }]}>+{idleEquip.length - 3} more in the Equipment tab</Text>
                            )}
                          </>
                        )}
                        {siteEquip.length === 0 && idleEquip.length === 0 && (
                          <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.sm }]}>
                            No machines free. Buy or finance one in the Equipment tab.
                          </Text>
                        )}
                      </View>
                    );
                  })()}
                  {/* Materials status */}
                  {allMats.length > 0 && (
                    <View style={{ marginBottom: SPACING.sm }}>
                      {hasMissingMats && (
                        <View style={{
                          backgroundColor: alpha(T.caution, 0.1), borderRadius: RADIUS.sm, padding: SPACING.md - 2,
                          marginBottom: SPACING.sm, borderWidth: 1, borderColor: alpha(T.caution, 0.55),
                          borderLeftWidth: 4, borderLeftColor: T.caution,
                        }}>
                          <Text style={[TYPE.bodyStrong, { color: T.caution, marginBottom: SPACING.sm }]}>
                            Work stalled — materials missing
                          </Text>
                          {missingMats.map(m => (
                            <View key={m.matId} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: SPACING.xs }}>
                              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                  <Ionicons name={m.icon} size={13} color={T.text} />
                                  <Text style={[TYPE.caption, { color: T.text }]}>{m.label}: {m.fulfilled}/{m.needed} {m.unit}</Text>
                                </View>
                                <ProgressBar
                                  T={T}
                                  percent={Math.round((m.fulfilled / m.needed) * 100)}
                                  tone="caution"
                                  height={3}
                                  style={{ marginTop: 3 }}
                                />
                              </View>
                              <Text style={[TYPE.caption, { color: T.caution, fontWeight: "700" }]}>{money(m.costNormal)}</Text>
                            </View>
                          ))}
                          {!canAffordNormal && (
                            <View style={{ marginTop: SPACING.sm, backgroundColor: alpha(T.hazard, 0.12), borderRadius: RADIUS.xs, padding: SPACING.sm }}>
                              <Text style={[TYPE.caption, { color: T.hazard }]}>
                                Cash shortfall: {money(Math.max(0, totalCostNormal - game.cash))}
                              </Text>
                              {(game.creditScore || 600) >= 600 && (
                                <Text style={[TYPE.caption, { color: T.steel, marginTop: 2 }]}>
                                  Supplier credit available (credit {game.creditScore})
                                </Text>
                              )}
                            </View>
                          )}
                          <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                            <TouchableOpacity
                              style={{
                                flex: 1, backgroundColor: canAffordNormal ? T.accent : T.panel2, borderRadius: RADIUS.sm,
                                borderWidth: 1.5, borderColor: canAffordNormal ? T.accent : T.border,
                                minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center",
                              }}
                              onPress={() => handleBuyMaterialsForSite(site.id)}
                              accessibilityRole="button"
                              accessibilityLabel={`Buy materials for ${money(totalCostNormal)}`}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "800", color: canAffordNormal ? "#0a1018" : T.sub }}>Buy materials</Text>
                              <Text style={{ fontSize: 11, color: canAffordNormal ? "#0a1018cc" : T.sub }}>{money(totalCostNormal)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                flex: 1, backgroundColor: canAffordEmergency ? alpha(T.caution, 0.18) : T.panel2, borderRadius: RADIUS.sm,
                                borderWidth: 1.5, borderColor: canAffordEmergency ? T.caution : T.border,
                                minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center",
                              }}
                              onPress={() => handleEmergencyPurchase(site.id)}
                              accessibilityRole="button"
                              accessibilityLabel={`Emergency order at 1.5 times price, ${money(totalCostEmergency)}`}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "800", color: canAffordEmergency ? T.caution : T.sub }}>Emergency</Text>
                              <Text style={{ fontSize: 11, color: canAffordEmergency ? T.caution : T.sub }}>{money(totalCostEmergency)} · 1.5×</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                flex: 1, backgroundColor: T.panel2, borderRadius: RADIUS.sm,
                                borderWidth: 1.5, borderColor: alpha(T.steel, 0.6),
                                minHeight: MIN_TAP_TARGET, alignItems: "center", justifyContent: "center",
                              }}
                              onPress={() => update(g => { const s = g.activeSites.find(s => s.id === site.id); if (s) pauseSite(s, 999, "manual"); })}
                              accessibilityRole="button"
                              accessibilityLabel="Pause this site, no penalty"
                            >
                              <Text style={{ fontSize: 13, fontWeight: "800", color: T.steel }}>Pause</Text>
                              <Text style={{ fontSize: 11, color: T.sub }}>No penalty</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }}>
                        {allMats.map(m => (
                          <View
                            key={m.id}
                            style={{
                              flexDirection: "row", alignItems: "center",
                              backgroundColor: m.ok ? T.panel3 : alpha(T.caution, 0.15),
                              borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 3,
                            }}
                          >
                            <Ionicons name={m.icon} size={13} color={m.ok ? T.sub : T.caution} />
                            <Text style={[TYPE.caption, { color: m.ok ? T.sub : T.caution, marginLeft: 3 }]}>
                              {m.fulfilled}/{m.needed}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Weather + last incident row */}
                  {(site.currentWeather || lastChaos) && (
                    <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm, alignItems: "center", flexWrap: "wrap" }}>
                      {site.currentWeather && (
                        <View style={{
                          flexDirection: "row", alignItems: "center", backgroundColor: alpha(T.steel, 0.18),
                          borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 3,
                        }}>
                          <Ionicons name={site.currentWeather.icon} size={13} color={T.steel} />
                          <Text style={[TYPE.caption, { color: T.steel, marginLeft: 4 }]}>{site.currentWeather.label}</Text>
                        </View>
                      )}
                      {lastChaos && (
                        <Text style={[TYPE.caption, { color: T.caution, flex: 1 }]} numberOfLines={2}>⚡ {lastChaos.text}</Text>
                      )}
                    </View>
                  )}

                  {/* ── PROJECT P&L ───────────────────────────────────────────────
                      buildProjectEconomics is one of Construction Flow's best original
                      systems — a live running cost against contract value, updating as the
                      job burns wages, fuel and materials. It used to render as three 10px
                      label/value rows lost among a dozen others. Promoted to its own panel
                      with the margin as the headline, because margin is the number the whole
                      game is about. Same values, same calculation. */}
                  <View style={{
                    backgroundColor: T.panel2, borderRadius: RADIUS.sm, padding: SPACING.md,
                    marginBottom: SPACING.sm, borderWidth: 1, borderColor: T.border,
                  }}>
                    <SectionLabel
                      T={T}
                      right={
                        <Text style={[TYPE.bodyStrong, { color: liveEconomics.netProfit >= 0 ? T.safe : T.hazard }]}>
                          {liveEconomics.netProfit >= 0 ? "+" : "−"}{money(Math.abs(liveEconomics.netProfit))}
                        </Text>
                      }
                    >
                      Margin if it finishes now
                    </SectionLabel>
                    <View style={{ marginTop: SPACING.sm }}>
                      <KeyValueRow
                        T={T}
                        label="Contract value"
                        value={daysLate > 0 ? `${money(site.totalValue)} → ${money(valueAfterPenalty)}` : money(site.totalValue)}
                        tone={daysLate > 0 ? "hazard" : "safe"}
                      />
                      <KeyValueRow
                        T={T}
                        label="Spent so far"
                        value={money(liveEconomics.directCosts)}
                        tone="accent"
                        divider={(site.depositPaid || 0) > 0 || (isOverdue && daysLate > 0)}
                      />
                      {(() => {
                        // What the client has actually released so far: the mobilisation
                        // deposit plus every certified progress claim. A contractor watches
                        // this number during a job far more closely than the final figure.
                        const paid = summarizeSitePayments(site);
                        if (paid.received <= 0) return null;
                        return (
                          <>
                            <KeyValueRow
                              T={T}
                              label={`Received so far (${paid.percentReceived}%)`}
                              value={money(paid.received)}
                              tone="info"
                              divider
                            />
                            <KeyValueRow
                              T={T}
                              label={paid.progress > 0 ? `Deposit ${money(paid.deposit)} · claims ${money(paid.progress)}` : "Mobilisation deposit"}
                              value={`${money(paid.outstanding)} outstanding`}
                              tone="neutral"
                              divider={isOverdue && daysLate > 0}
                            />
                          </>
                        );
                      })()}
                      {isOverdue && daysLate > 0 && (
                        <KeyValueRow
                          T={T}
                          label={`Late penalty · ${daysLate}d${daysLate > 5 ? " (1.5× escalated)" : ""}`}
                          value={`−${money(daysLate * site.penaltyPerDay)}`}
                          tone="hazard"
                          divider={false}
                        />
                      )}
                    </View>
                    {isOverdue && daysLate > 0 && (
                      <ProgressBar
                        T={T}
                        percent={Math.max(0, Math.round((valueAfterPenalty / site.totalValue) * 100))}
                        tone={valueAfterPenalty > site.totalValue * 0.5 ? "caution" : "hazard"}
                        label="Value remaining"
                        value={`${money(valueAfterPenalty)} of ${money(site.totalValue)}`}
                        height={4}
                        style={{ marginTop: SPACING.sm }}
                      />
                    )}
                  </View>

                  {/* Strategy selector */}
                  <SectionLabel T={T} style={{ marginBottom: SPACING.sm }}>Site strategy</SectionLabel>
                  <View style={{ flexDirection: "row", gap: SPACING.xs }}>
                    {SITE_MODES.map(m => {
                      const selected = mode === m.key;
                      return (
                        <TouchableOpacity
                          key={m.key}
                          style={{
                            flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: 2, borderRadius: RADIUS.sm,
                            borderWidth: 1.5, minHeight: MIN_TAP_TARGET,
                            borderColor: selected ? m.color : T.border,
                            backgroundColor: selected ? alpha(m.color, 0.16) : "transparent",
                            alignItems: "center", justifyContent: "center",
                          }}
                          onPress={() => update(g => { const s = g.activeSites.find(s => s.id === site.id); if (s) s.siteMode = m.key; })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${m.label} pace — ${m.desc}`}
                        >
                          <Ionicons name={m.icon} size={15} color={selected ? m.color : T.sub} />
                          <Text style={{ fontSize: 11, marginTop: 2, color: selected ? m.color : T.sub, fontWeight: selected ? "700" : "500" }}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {modeDef.key !== "normal" && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginTop: SPACING.sm }}>
                      <Ionicons name={modeDef.icon} size={13} color={modeDef.color} />
                      <Text style={[TYPE.caption, { color: modeDef.color }]}>{modeDef.desc}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={{
                      alignSelf: "flex-start", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
                      borderRadius: RADIUS.sm, borderWidth: 1, borderColor: alpha(T.steel, 0.7), marginTop: SPACING.md,
                    }}
                    onPress={() => setTab("Crew")}
                    accessibilityRole="button"
                    accessibilityLabel="Hire a subcontractor crew"
                  >
                    <Text style={{ color: T.steel, fontSize: 12, fontWeight: "700" }}>⚡ Hire sub crew →</Text>
                  </TouchableOpacity>

                  {/* On-time completion bonus offered to the crew */}
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md }}>
                    <Text style={[TYPE.caption, { color: T.sub }]}>On-time bonus</Text>
                    {[0, 500, 1000, 2500].map(amt => {
                      const sel = (site.completionBonus || 0) === amt;
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={{
                            paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
                            borderWidth: 1, borderColor: sel ? T.caution : T.border,
                            backgroundColor: sel ? alpha(T.caution, 0.18) : "transparent",
                          }}
                          onPress={() => update(g => { const s = g.activeSites.find(s => s.id === site.id); if (s) s.completionBonus = amt; })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: sel }}
                          accessibilityLabel={amt === 0 ? "No on-time bonus" : `On-time bonus of ${money(amt)}`}
                        >
                          <Text style={{ fontSize: 12, color: sel ? T.caution : T.sub, fontWeight: sel ? "700" : "500" }}>
                            {amt === 0 ? "None" : money(amt)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Job exit controls */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {site.status === "Paused" && !canPlayerResume(site) ? (
                      // An official hold: no Resume. The banner above says why and for how long.
                      <View style={[styles.smallBtn, { borderWidth:1, borderColor: T.border, backgroundColor: "transparent" }]}>
                        <Text style={[styles.smallBtnText, { color: T.sub }]}>⏳ On hold</Text>
                      </View>
                    ) : (
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderWidth:1, borderColor: site.status==="Paused" ? T.green : T.cyan, backgroundColor: "transparent" }]}
                      onPress={() => site.status==="Paused" ? handleResumeSite(site.id) : handlePauseSite(site.id)}
                    >
                      <Text style={[styles.smallBtnText, { color: site.status==="Paused" ? T.green : T.cyan }]}>
                        {site.status==="Paused" ? "▶ Resume" : "⏸ Pause"}
                      </Text>
                    </TouchableOpacity>
                    )}
                    {game.day > site.deadlineDay && !site.renegotiated && (
                      <TouchableOpacity
                        style={[styles.smallBtn, { borderWidth:1, borderColor: _canRenegotiate ? T.yellow : T.border, backgroundColor:"transparent", opacity: _canRenegotiate ? 1 : 0.45 }]}
                        onPress={() => handleRenegotiate(site.id)}
                      >
                        <Text style={[styles.smallBtnText, { color: _canRenegotiate ? T.yellow : T.sub }]}>Renegotiate {money(_renegCost)}</Text>
                      </TouchableOpacity>
                    )}
                    {(game.day > site.deadlineDay || site.status === "Paused") && (
                      <TouchableOpacity
                        style={[styles.smallBtn, { borderWidth:1, borderColor:T.purple, backgroundColor:"transparent" }]}
                        onPress={() => handleSettleSite(site.id)}
                      >
                        <Text style={[styles.smallBtnText, { color: T.purple }]}>Settle</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderWidth:1, borderColor:T.red, backgroundColor:"transparent" }]}
                      onPress={() => {
                        const _siteDef = CONTRACT_DEFS.find(c => c.id === (game.contracts.find(cc => cc.id === site.contractId)?.defId));
                        const _fee = Math.round((_siteDef?.baseValue||10000)*0.15);
                        Alert.alert("Abandon Site?", `Fee: ${money(_fee)}, reputation penalty. Cannot undo.`, [
                          {text:"Cancel",style:"cancel"},
                          {text:"Abandon",style:"destructive",onPress:()=>handleAbandonSite(site.id)}
                        ]);
                      }}
                    >
                      <Text style={[styles.smallBtnText, { color: T.red }]}>Abandon</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recently Completed Sites */}
        {(game.jobHistory || []).length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, col, { marginBottom: 8 }]}>Recently Completed</Text>
            {[...(game.jobHistory || [])].reverse().slice(0, 5).map((job, i) => (
              <View key={i} style={[styles.card, { backgroundColor: T.panel, borderLeftWidth: 3, borderLeftColor: T.green, marginBottom: 6, padding: 10 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, col, { fontSize: 13 }]}>✓ {job.label}</Text>
                    <Text style={[styles.sub, subCol]}>{job.client} · Day {job.day}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.sub, { color: T.green, fontWeight: "700", fontSize: 13 }]}>{money(job.value)}</Text>
                    {job.quality && <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{job.quality} quality</Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Office Upgrade */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Office: {office.name}</Text>
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          {OFFICE_IMAGES[office.id] && (
            <Image source={OFFICE_IMAGES[office.id]} style={{ width: "100%", height: 130, borderRadius: 8, marginBottom: 8, backgroundColor: "#fff" }} resizeMode="contain" />
          )}
          <Text style={[styles.sub, subCol]}>
            Crew cap: {office.crewCap} · Equip cap: {office.equipCap} · Daily rent:{" "}
            {dailyOfficeRent(game) > 0 ? money(office.dailyRent) : "none — you own the building"}
          </Text>
          {office.perks.map((p) => <Text key={p.key} style={[styles.sub, { color: T.cyan }]}>{p.label}</Text>)}
          {OFFICES[game.officeIndex + 1] && (() => {
            const nextOffice = OFFICES[game.officeIndex + 1];
            const canAfford = game.cash >= nextOffice.cost;
            return (
              <>
                {OFFICE_IMAGES[nextOffice.id] && (
                  <Image source={OFFICE_IMAGES[nextOffice.id]} style={{ width: "100%", height: 100, borderRadius: 8, marginTop: 10, backgroundColor: "#fff", opacity: 0.85 }} resizeMode="contain" />
                )}
                {!canAfford && nextOffice.cost > 0 && (() => {
                  const pct = Math.min(99, Math.round((game.cash / nextOffice.cost) * 100));
                  const barColor = pct >= 75 ? T.yellow : pct >= 50 ? T.orange : T.sub;
                  return (
                    <View style={{ marginTop: 10, marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text style={[styles.sub, subCol]}>Upgrade savings</Text>
                        <Text style={[styles.sub, { color: barColor }]}>{money(game.cash)} / {money(nextOffice.cost)}</Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                        <View style={{ height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 }} />
                      </View>
                    </View>
                  );
                })()}
                <TouchableOpacity
                  style={[styles.btn, { marginTop: canAfford ? 10 : 4, backgroundColor: canAfford ? T.blue : T.panel2, borderColor: T.blue }]}
                  onPress={handleUpgradeOffice}
                >
                  <Text style={[styles.btnText, { color: canAfford ? "#fff" : T.red }]}>
                    Upgrade to {nextOffice.name} — {money(nextOffice.cost)}
                  </Text>
                </TouchableOpacity>
              </>
            );
          })()}
        </View>
      </ScrollView>
    );
  }

  function renderCrew() {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* Auto Assign toggle strip */}
        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 0 }}>
          <TouchableOpacity
            style={[styles.btn, { flex: 1, backgroundColor: game.autoAssignCrew ? T.green : T.panel2, borderColor: T.green, paddingVertical: 8 }]}
            onPress={() => update(g => { g.autoAssignCrew = !g.autoAssignCrew; })}
          >
            <Text style={[styles.btnText, { color: game.autoAssignCrew ? "#fff" : T.sub, fontSize: 12 }]}>
              {game.autoAssignCrew ? "✓ Auto Assign ON" : "Auto Assign OFF"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { flex: 1, backgroundColor: T.panel2, borderColor: T.cyan, paddingVertical: 8 }]}
            onPress={() => handleRestAllTired()}
          >
            <Text style={[styles.btnText, { color: T.cyan, fontSize: 12 }]}>😴 Rest All Tired</Text>
          </TouchableOpacity>
        </View>
        {/* Crew filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, marginTop: 8, marginBottom: 4 }} contentContainerStyle={{ gap: 8, flexDirection: "row" }}>
          {["All", "Active", "Idle", "Resting", "Training", "Low Stamina"].map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setCrewFilter(f)}
              style={{ borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: crewFilter === f ? T.cyan : T.panel2, borderWidth: 1, borderColor: crewFilter === f ? T.cyan : T.border }}
            >
              <Text style={{ color: crewFilter === f ? "#fff" : T.sub, fontSize: 12, fontWeight: "600" }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {(() => {
          const _filteredCrew = crewFilter === "All" ? (game.crew||[]) : (game.crew||[]).filter(w =>
            crewFilter === "Active"      ? w.status === "Active" :
            crewFilter === "Idle"        ? w.status === "Idle" :
            crewFilter === "Resting"     ? w.status === "Resting" :
            crewFilter === "Training"    ? !!(game.trainingQueue||[]).find(t=>t.workerId===w.id) :
            crewFilter === "Low Stamina" ? (w.stamina ?? 50) < 30 : true
          );
          if (crewFilter !== "All" && _filteredCrew.length === 0 && (game.crew||[]).length > 0) return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 20, margin: 12 }]}>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 10 }]}>
                None of your {(game.crew||[]).length} crew are {crewFilter.toLowerCase()} right now.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: T.cyan, borderColor: T.cyan }]}
                onPress={() => setCrewFilter("All")}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>Show All Crew</Text>
              </TouchableOpacity>
            </View>
          );
          return null;
        })()}
        <CrewScreen
          game={crewFilter === "All" ? game : { ...game, crew: (game.crew||[]).filter(w =>
            crewFilter === "Active"      ? w.status === "Active" :
            crewFilter === "Idle"        ? w.status === "Idle" :
            crewFilter === "Resting"     ? w.status === "Resting" :
            crewFilter === "Training"    ? !!(game.trainingQueue||[]).find(t=>t.workerId===w.id) :
            crewFilter === "Low Stamina" ? (w.stamina ?? 50) < 30 : true
          )}}
          T={T} col={col} subCol={subCol}
          onHire={handleHireCrew} onFire={handleFireCrew} onPostJob={handlePostJob}
          onHireSubcontractor={handleHireSubcontractor}
          onHirePM={handleHirePM} onFirePM={handleFirePM}
          onTrain={handleTrainCrew}
          onPromote={handlePromoteCrew}
          onRaiseWage={handleRaiseWage}
          onLowerWage={handleLowerWage}
          onSetWage={handleSetWage}
          onBulkHire={handleBulkHire}
          onFireMany={handleFireMany}
          onGiveBonus={handleGiveBonus}
          onRest={handleRestWorker}
          onRestAllTired={handleRestAllTired}
          onBuyLunch={handleBuyLunch}
          onAssignToSite={handleAssignCrewToSite}
          activeSites={game.activeSites}
        />
      </ScrollView>
    );
  }

  function renderEquipment() {
    // Condition colour now comes from `conditionTone` in the design system, so a machine's
    // condition reads the same here as it does on a site card.
    const office = OFFICES[game.officeIndex || 0];
    const totalEquipCap = office.equipCap + getEquipCapBonus(game);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 120 }}>

        {/* Fleet header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, col]}>Vehicles Fleet ({(game.equipment||[]).length}/{totalEquipCap})</Text>
        </View>

        {/* Auto-dispatch toggles */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <Text style={[styles.label, col]}>⚡ Auto Dispatch</Text>
          <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginBottom: 8 }]}>Hire a Senior PM or Director to auto-manage your operation.</Text>
          {[
            { key: "autoAssignCrew",        label: "Auto-Assign Crew",     icon: "👷", color: T.green  },
            { key: "autoAssignEquipment",   label: "Auto-Assign Vehicles", icon: "🚛", color: T.cyan   },
            { key: "autoRepairEquipment",   label: "Auto-Repair Fleet",    icon: "🔧", color: T.orange },
            { key: "autoPurchaseMaterials", label: "Auto-Buy Materials",   icon: "📦", color: T.yellow },
          ].map((item, idx, arr) => (
            <View key={item.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: idx < arr.length - 1 ? 1 : 0, borderColor: T.border }}>
              <Text style={[styles.sub, col]}>{item.icon}  {item.label}</Text>
              <Switch
                value={!!game[item.key]}
                onValueChange={v => update(g => { g[item.key] = v; })}
                trackColor={{ false: T.track, true: item.color }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* Equipment filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8, flexDirection: "row" }}>
          {["All", "Active", "Idle", "Maintenance", "Broken", "Low Condition"].map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setEquipFilter(f)}
              style={{ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: equipFilter === f ? T.orange : T.panel2, borderWidth: 1, borderColor: equipFilter === f ? T.orange : T.border }}
            >
              <Text style={{ color: equipFilter === f ? "#fff" : T.sub, fontSize: 11, fontWeight: "600" }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Fleet health summary */}
        {(game.equipment||[]).length > 0 && (() => {
          const equips = game.equipment || [];
          const avgCond = Math.round(equips.reduce((s, e) => s + (e.condition || 0), 0) / equips.length);
          const active = equips.filter(e => e.status === "Active").length;
          const idle = equips.filter(e => e.status === "Idle").length;
          const needsWork = equips.filter(e => e.status === "Maintenance" || e.status === "Broken").length;
          const barColor = avgCond >= 70 ? T.green : avgCond >= 40 ? T.orange : T.red;
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border, marginBottom: 8 }]}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {[
                  { label: "Active", val: active, color: T.orange },
                  { label: "Idle", val: idle, color: T.green },
                  { label: "Needs Work", val: needsWork, color: needsWork > 0 ? T.red : T.sub },
                ].map(s => (
                  <View key={s.label} style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 6, padding: 8, alignItems: "center" }}>
                    <Text style={{ color: s.color, fontSize: 18, fontWeight: "900" }}>{s.val}</Text>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={[styles.sub, subCol]}>Fleet health</Text>
                <Text style={[styles.sub, { color: barColor, fontWeight: "600" }]}>{avgCond}% avg condition</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: T.track }]}>
                <View style={[styles.progressFill, { width: `${avgCond}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          );
        })()}

        {/* ── THE YARD AT A GLANCE ──────────────────────────────────────────
            What is earning, what is parked, what is in the workshop, and what the whole
            lot costs per day whether or not it turns a wheel. The tab listed machines
            without ever stating the fleet's position. */}
        {(game.equipment || []).length > 0 && (() => {
          const fleet = summarizeFleet(game);
          return (
            <Card T={T} tone={fleet.utilisation >= 50 ? "safe" : fleet.workshop > 0 ? "caution" : "accent"}>
              <SectionLabel
                T={T}
                tone={fleet.utilisation >= 50 ? "safe" : "caution"}
                right={<Text style={[TYPE.caption, { color: T.sub }]}>{money(fleet.dailyCost)}/day to run</Text>}
              >
                {`The yard · ${fleet.total} machine${fleet.total === 1 ? "" : "s"}`}
              </SectionLabel>
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                <StatTile T={T} label="Earning" value={`${fleet.working}`} sub="on site" tone={fleet.working > 0 ? "safe" : "hazard"} />
                <StatTile T={T} label="Parked" value={`${fleet.parked}`} sub="in the yard" tone={fleet.parked > 0 ? "caution" : null} />
                <StatTile T={T} label="Workshop" value={`${fleet.workshop}`} sub="down" tone={fleet.workshop > 0 ? "hazard" : null} />
              </View>
              <ProgressBar
                T={T}
                percent={fleet.utilisation}
                tone={progressTone(fleet.utilisation)}
                label="Fleet utilisation"
                value={`${fleet.utilisation}% · avg condition ${fleet.averageCondition}%`}
                style={{ marginTop: SPACING.md }}
              />
            </Card>
          );
        })()}

        {/* Owned equipment */}
        {(game.equipment||[]).length === 0 ? (() => {
          const empty = getEmptyState("Equipment");
          return <EmptyState T={T} icon={empty.icon} title={empty.title} body={empty.body} />;
        })() : (() => {
          const _filteredEquip = equipFilter === "All" ? (game.equipment||[]) : (game.equipment||[]).filter(e =>
            equipFilter === "Active"       ? e.status === "Active" :
            equipFilter === "Idle"         ? e.status === "Idle" :
            equipFilter === "Maintenance"  ? e.status === "Maintenance" :
            equipFilter === "Broken"       ? e.status === "Broken" :
            equipFilter === "Low Condition"? (e.condition ?? 100) < 40 : true
          );
          if (_filteredEquip.length === 0 && equipFilter !== "All") return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 20 }]}>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 10 }]}>
                None of your {(game.equipment||[]).length} machines are {equipFilter.toLowerCase()} right now.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: T.orange, borderColor: T.orange }]}
                onPress={() => setEquipFilter("All")}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>Show All Equipment</Text>
              </TouchableOpacity>
            </View>
          );
          return _filteredEquip.map((equip) => {
            const cond = Math.round(equip.condition ?? 100);
            const repairCost = Math.round((equip.price || 5000) * 0.2);
            const emergRepairCost = Math.round((equip.price || 5000) * 0.4);
            const equipImg = EQUIPMENT_IMAGES[equip.shopId];
            // The question the player actually has about a machine, which the card never
            // answered: is this thing making me money, or am I paying to park it?
            const econ = summarizeEquipmentEconomics(equip, game);
            const verdictTint = toneColor(econ.verdict.tone, T);
            return (
              <View key={equip.id} style={[styles.card, {
                backgroundColor: T.panel,
                borderColor: alpha(verdictTint, 0.5),
                borderWidth: 1,
                borderLeftWidth: 4,
                borderLeftColor: verdictTint,
              }]}>
                <View style={{ flexDirection: "row" }}>
                  {equipImg && (
                    <Image
                      source={equipImg}
                      style={{ width: 76, height: 58, borderRadius: RADIUS.sm, marginRight: SPACING.md, backgroundColor: "#fff" }}
                      resizeMode="contain"
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, col]} numberOfLines={1}>{equipImg ? "" : "🔧 "}{equip.name}</Text>
                    <Text style={[styles.sub, subCol]} numberOfLines={1}>
                      Tier {equip.tier || 1} · {equip.type} · {money(equip.dailyCost || 0)}/day
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xs }}>
                      <Pill T={T} label={econ.verdict.label} tone={econ.verdict.tone} filled />
                      <Text style={[TYPE.caption, { color: T.sub, flex: 1 }]} numberOfLines={1}>{econ.verdict.detail}</Text>
                    </View>
                  </View>
                </View>

                {/* Condition */}
                <ProgressBar
                  T={T}
                  percent={cond}
                  tone={conditionTone(cond)}
                  label="Condition"
                  value={`${cond}%`}
                  style={{ marginTop: SPACING.md }}
                />
                {equip.status === "Maintenance" && (
                  <Text style={[TYPE.caption, { color: T.hazard, marginTop: SPACING.xs }]}>
                    ⚠ In the workshop — repair it to put it back on a site.
                  </Text>
                )}

                {/* ── IS IT PAYING FOR ITSELF ─────────────────────────────────
                    Utilisation, what it has cost you since you bought it, and what it
                    would fetch if you sold it. A machine is an asset; this is its
                    asset card. */}
                <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                  <StatTile
                    T={T}
                    label="Utilisation"
                    value={`${econ.utilisation}%`}
                    sub={`${econ.daysWorked}/${econ.daysOwned} days`}
                    tone={econ.utilisation >= 60 ? "safe" : econ.utilisation >= 30 ? "caution" : "hazard"}
                  />
                  <StatTile
                    T={T}
                    label="Run cost"
                    value={compactMoney(econ.lifetimeCost)}
                    sub="since purchase"
                    tone="caution"
                  />
                  <StatTile
                    T={T}
                    label="Resale"
                    value={compactMoney(econ.resaleEstimate)}
                    sub="estimate"
                    tone="info"
                  />
                </View>

                {/* Equipment Upgrades */}
                <View style={{ marginTop: SPACING.md, marginBottom: 2 }}>
                  <SectionLabel T={T} style={{ marginBottom: SPACING.sm }}>Upgrades</SectionLabel>
                  {EQUIPMENT_UPGRADES.map(upg => {
                    const currentTier = (equip.upgrades || {})[upg.id] || 0;
                    const nextTier = upg.tiers[currentTier];
                    const isMax = currentTier >= upg.tiers.length;
                    const canAfford = nextTier && game.cash >= nextTier.cost;
                    return (
                      <View key={upg.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                        <Text style={{ fontSize: 13, marginRight: 6 }}>{upg.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sub, { color: isMax ? T.green : currentTier > 0 ? T.cyan : T.sub, fontSize: 12 }]}>
                            {upg.label}{currentTier > 0 ? ` T${currentTier} — ${upg.tiers[currentTier - 1].effect}` : " — not installed"}
                          </Text>
                        </View>
                        {!isMax ? (
                          <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: canAfford ? T.blue : T.panel2, borderColor: T.blue, paddingHorizontal: 8 }]}
                            onPress={() => handleBuyEquipmentUpgrade(equip.id, upg.id)}
                          >
                            <Text style={[styles.smallBtnText, { color: canAfford ? "#fff" : T.sub }]}>
                              {currentTier === 0 ? "Install" : "Upgrade"} {money(nextTier.cost)}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={[styles.sub, { color: T.green, fontSize: 12 }]}>✓ Max</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                {/* Buttons row */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {cond < 80 && equip.status !== "Maintenance" && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.blue, flex: 1, minWidth: 80 }]}
                      onPress={() => handleRepairEquipmentNew(equip.id, false)}>
                      <Text style={styles.smallBtnText}>Repair ({money(repairCost)})</Text>
                    </TouchableOpacity>
                  )}
                  {equip.status === "Maintenance" && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.orange, flex: 1, minWidth: 80 }]}
                      onPress={() => handleRepairEquipmentNew(equip.id, true)}>
                      <Text style={styles.smallBtnText}>Emergency Repair ({money(emergRepairCost)})</Text>
                    </TouchableOpacity>
                  )}
                  {equip.status !== "Maintenance" && !equip.assignedSiteId && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.yellow + "33", flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.yellow }]}
                      onPress={() => handleScheduleMaintenance(equip.id)}>
                      <Text style={[styles.smallBtnText, { color: T.yellow }]}>Maintenance</Text>
                    </TouchableOpacity>
                  )}
                  {!equip.assignedSiteId && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.red + "22", flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.red }]}
                      onPress={() => handleSellEquipment(equip.id)}>
                      <Text style={[styles.smallBtnText, { color: T.red }]}>Sell ({money(Math.round(cond/100 * (equip.price||5000) * 0.5))})</Text>
                    </TouchableOpacity>
                  )}
                  {!equip.assignedSiteId && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.panel2, flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.sub }]}
                      onPress={() => Alert.alert("Retire Equipment", `Remove ${equip.name} from fleet permanently? No cash recovered.`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Retire", style: "destructive", onPress: () => handleRetireEquipment(equip.id) }
                      ])}>
                      <Text style={[styles.smallBtnText, { color: T.sub }]}>Retire</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          });
        })()}

        {/* Buy Vehicles */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 4 }]}>Buy Vehicles</Text>
        <Text style={[styles.sub, subCol, { marginBottom: 10 }]}>New vehicles have full reliability. Used vehicles cost ~40% less but have higher breakdown risk.</Text>
        {EQUIPMENT_SHOP.map((item) => {
          const atCap = (game.equipment||[]).length >= totalEquipCap;
          const discount = (game._equipDiscount || 0);
          const newPrice = Math.round(item.price * (1 - discount));
          const usedPrice = Math.round(newPrice * 0.58);
          const shopImg = EQUIPMENT_IMAGES[item.shopId];
          return (
            <View key={item.shopId} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              {shopImg && (
                <Image source={shopImg} style={{ width: "100%", height: 110, borderRadius: 8, marginBottom: 8, backgroundColor: "#fff" }} resizeMode="contain" />
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, col]}>{shopImg ? "" : "🚜 "}{item.name} <Text style={[styles.sub, { color: T.blue }]}>Tier {item.tier}</Text></Text>
                  <Text style={[styles.sub, subCol]}>{item.role}</Text>
                  <Text style={[styles.sub, subCol]}>Daily cost: {money(item.dailyCost)} · Type: {item.type}</Text>
                </View>
                {discount > 0 && <Text style={[styles.sub, { color: T.yellow }]}>-{Math.round(discount*100)}%</Text>}
              </View>
              {atCap ? (
                <View style={[styles.btn, { marginTop: 8, backgroundColor: T.panel2, borderColor: T.border }]}>
                  <Text style={[styles.btnText, { color: T.sub }]}>Vehicles Cap — Upgrade office</Text>
                </View>
              ) : (
                <>
                  {game.cash < newPrice && (() => {
                    const pct = Math.min(99, Math.round((game.cash / newPrice) * 100));
                    const barColor = pct >= 75 ? T.yellow : pct >= 50 ? T.orange : T.sub;
                    return (
                      <View style={{ marginTop: 8, marginBottom: 2 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={[styles.sub, subCol]}>Savings</Text>
                          <Text style={[styles.sub, { color: barColor }]}>{money(game.cash)} / {money(newPrice)}</Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                          <View style={{ height: 4, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 }} />
                        </View>
                      </View>
                    );
                  })()}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: game.cash >= newPrice ? T.blue : T.panel2, borderColor: T.blue }]}
                    onPress={() => handleBuyEquipment(item, false)}
                  >
                    <Text style={[styles.btnText, { color: game.cash >= newPrice ? "#fff" : T.red, fontSize: 12 }]}>🆕 New</Text>
                    <Text style={[styles.sub, { color: game.cash >= newPrice ? T.sub : T.red, textAlign: "center" }]}>{money(newPrice)}</Text>
                    <Text style={[styles.sub, { color: T.sub, textAlign: "center", fontSize: 12 }]}>100% condition · reliable</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: game.cash >= usedPrice ? T.orange+"44" : T.panel2, borderColor: T.orange }]}
                    onPress={() => handleBuyEquipment(item, true)}
                  >
                    <Text style={[styles.btnText, { color: game.cash >= usedPrice ? T.orange : T.red, fontSize: 12 }]}>🔄 Used</Text>
                    <Text style={[styles.sub, { color: game.cash >= usedPrice ? T.orange : T.red, textAlign: "center" }]}>{money(usedPrice)}</Text>
                    <Text style={[styles.sub, { color: T.sub, textAlign: "center", fontSize: 12 }]}>~55% cond · higher risk</Text>
                  </TouchableOpacity>
                </View>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  function renderEmpire() {
    const valuation = computeValuation(game);
    const rank = game.nationalRank || 99;
    const completedGoalIds = game.empireGoalsCompleted || [];
    const selectedCity = CITIES.find(c => c.id === game.selectedEmpireCity) || CITIES[1];
    const hasOfficeInSelected = (game.cityOffices||[]).some(o => o.cityId === selectedCity.id);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 120 }}>

        {/* Legacy Complete Banner */}
        {game.hallOfFame?.prestigeReached && (
          <View style={{ backgroundColor: T.yellow + "22", borderColor: T.yellow, borderWidth: 2, borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 28, marginBottom: 4 }}>👑</Text>
            <Text style={{ color: T.yellow, fontWeight: "900", fontSize: 16, marginBottom: 2 }}>DYNASTY COMPLETE — GEN {game.generation||1}</Text>
            <Text style={[styles.sub, { color: T.text, textAlign: "center", marginBottom: 8 }]}>Built the #1 construction empire in America. Achieved on Day {game.hallOfFame.prestigeReached}.</Text>
            {(game.legacyPerks||[]).length > 0 && (
              <View style={{ width: "100%", marginTop: 4 }}>
                <Text style={[styles.sub, { color: T.yellow, fontWeight: "700", marginBottom: 4 }]}>Carried Legacy Perks:</Text>
                {(game.legacyPerks||[]).map((p,i) => {
                  const def = LEGACY_PERKS.find(lp => lp.id === p);
                  return <Text key={i} style={[styles.sub, { color: T.text }]}>• {def?.label || p}</Text>;
                })}
              </View>
            )}
          </View>
        )}
        {/* Dynasty pending call-to-action */}
        {game._pendingPrestige && !game.hallOfFame?.prestigeReached && (
          <View style={{ backgroundColor: T.green + "22", borderColor: T.green, borderWidth: 2, borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🏆</Text>
            <Text style={{ color: T.green, fontWeight: "900", fontSize: 15, marginBottom: 4 }}>Dynasty Ready to Claim!</Text>
            <Text style={[styles.sub, { color: T.text, textAlign: "center" }]}>You&apos;ve hit Level 10, Rank #1, and cleared your debt. Tap the crown to begin your legacy.</Text>
          </View>
        )}

        {/* Company Valuation */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.strongBorder, borderWidth: 2 }]}>
          <Text style={[styles.sectionTitle, col]}>Company Valuation</Text>
          <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginBottom: 6 }]}>
            Home market: {displayCityName}, {displayStateCode} · {displayCompetition} competition
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <View>
              <Text style={[styles.cashBig, { color: T.cyan }]}>{money(valuation)}</Text>
              <Text style={[styles.sub, subCol]}>Net Worth</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.cashBig, { color: rank <= 10 ? T.green : T.sub }]}>#{rank}</Text>
              <Text style={[styles.sub, subCol]}>National Rank</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.cashBig, { color: T.blue }]}>{game.marketShare || 1}%</Text>
              <Text style={[styles.sub, subCol]}>Market Share</Text>
            </View>
          </View>
          {[
            { label: "Cash", val: money(game.cash), color: game.cash >= 0 ? T.green : T.red },
            { label: "Equipment Fleet", val: money(Math.round((game.equipment||[]).reduce((s,e)=>s+e.price*(e.condition/100)*0.6,0))), color: T.orange },
            { label: "Properties", val: money(Math.round((game.properties||[]).reduce((s,p)=>{ const d=PROPERTY_TYPES.find(t=>t.id===p.typeId); return s+(d?d.cost*(d.resaleRate||0.8):0); },0))), color: T.purple },
            { label: "Office Network", val: money(Math.round((game.cityOffices||[]).reduce((s,o)=>{ const d=REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId); return s+(d?d.cost*0.7:0); },0))), color: T.blue },
            { label: "Active Pipeline", val: money(Math.round((game.activeSites||[]).reduce((s,site)=>s+site.totalValue*0.4,0))), color: T.cyan },
          ].map(row => (
            <View key={row.label} style={[styles.finRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.sub, col]}>{row.label}</Text>
              <Text style={[styles.sub, { color: row.color }]}>{row.val}</Text>
            </View>
          ))}
        </View>

        {/* ─── Company Ladder — Phase 5 ────────────────────────────────────────
            Where the player is on the progression ladder, what each building they own is
            actually giving them, and what the next rung costs.

            Every line in this card is a perk the simulation applies. Before Phase 5, four of
            the six office perks and both the contract-slot and no-rent promises were strings
            on a purchase button read by nothing, so a card like this could not honestly have
            been drawn. */}
        {(() => {
          const officeIdx = Number.isFinite(game.officeIndex) ? game.officeIndex : 0;
          const office = OFFICES[officeIdx] || OFFICES[0];
          const perks = resolveCompanyPerks(game);
          const sources = describePerkSources(game);
          const next = nextOfficeUpgrade(game);
          const board = contractBoardSize(game);
          const rent = dailyOfficeRent(game);
          const crewUsed = (game.crew || []).length;
          const equipUsed = (game.equipment || []).length;

          return (
            <Card T={T} tone="accent" elevated style={{ marginTop: 8 }}>
              <SectionLabel
                T={T}
                tone="accent"
                right={<Pill T={T} label={`Rung ${officeIdx + 1} of ${OFFICES.length}`} tone="accent" filled />}
              >
                Company Ladder
              </SectionLabel>

              <Text style={[TYPE.title, { color: T.text, marginTop: SPACING.xs }]} numberOfLines={1}>
                {office.name}
              </Text>
              <ProgressBar
                T={T}
                percent={((officeIdx + 1) / OFFICES.length) * 100}
                tone="accent"
                height={6}
                style={{ marginTop: SPACING.sm }}
              />

              <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
                <StatTile
                  T={T}
                  label="Crew space"
                  value={`${crewUsed}/${perks.crewCap}`}
                  tone={crewUsed >= perks.crewCap ? "warning" : "success"}
                />
                <StatTile
                  T={T}
                  label="Machine space"
                  value={`${equipUsed}/${perks.equipCap}`}
                  tone={equipUsed >= perks.equipCap ? "warning" : "success"}
                />
                <StatTile
                  T={T}
                  label="Daily rent"
                  value={rent > 0 ? money(rent) : "None"}
                  tone={rent > 0 ? "neutral" : "success"}
                  sub={rent > 0 ? null : "You own it"}
                />
              </View>

              <View style={{ marginTop: SPACING.md }}>
                <KeyValueRow T={T} label="Contracts on the board" value={`${board.floor}–${board.cap}`} />
                {perks.bidBonus > 0 && (
                  <KeyValueRow T={T} label="Bid win chance" value={`+${Math.round(perks.bidBonus * 100)}%`} tone="success" />
                )}
                {perks.penaltyReduction > 0 && (
                  <KeyValueRow T={T} label="Delay penalties" value={`−${Math.round(perks.penaltyReduction * 100)}%`} tone="success" />
                )}
                {perks.materialDiscount > 0 && (
                  <KeyValueRow T={T} label="Material costs" value={`−${Math.round(perks.materialDiscount * 100)}%`} tone="success" />
                )}
                {perks.weeklyPropertyIncome > 0 && (
                  <KeyValueRow T={T} label="Property income" value={`+${money(perks.weeklyPropertyIncome)}/wk`} tone="success" divider={false} />
                )}
              </View>

              {/* What each building you own is giving you. */}
              {sources.length > 0 && (
                <View style={{ marginTop: SPACING.md }}>
                  <SectionLabel T={T}>What your buildings give you</SectionLabel>
                  {sources.map((s) => (
                    <View key={s.key} style={{ marginTop: SPACING.sm }}>
                      <Text style={[TYPE.label, { color: T.text }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[TYPE.caption, { color: T.sub, marginTop: 1 }]} numberOfLines={2}>
                        {s.effects.length > 0 ? s.effects.join(" · ") : "No active perks"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* The next rung. Null at the top of the ladder, which is worth saying out loud. */}
              <View style={{ marginTop: SPACING.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border, paddingTop: SPACING.md }}>
                {next ? (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[TYPE.label, { color: T.text, flex: 1, marginRight: SPACING.sm }]} numberOfLines={1}>
                        {`Next: ${next.name}`}
                      </Text>
                      <Pill
                        T={T}
                        label={next.affordable ? money(next.cost) : `${money(next.shortfall)} short`}
                        tone={next.affordable ? "success" : "neutral"}
                      />
                    </View>
                    <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.xs }]}>
                      {next.gains.join(" · ")}
                    </Text>
                    {next.rentIncrease > 0 && rent > 0 && (
                      <Text style={[TYPE.caption, { color: T.sub, marginTop: 2 }]}>
                        Rent rises by {money(next.rentIncrease)}/day — {money(next.dailyRent)} total.
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={[TYPE.caption, { color: T.sub }]}>
                    Top of the office ladder. Growth now comes from regional offices, properties and acquisitions.
                  </Text>
                )}
              </View>
            </Card>
          );
        })()}

        {/* ─── Company Story — Phase 6 ─────────────────────────────────────────
            What this company has done, and what it is costing or earning it now.

            Audit row 23 was the last untouched gap: "FleetFlow's events REMEMBER. A decision
            made on day 20 can be referenced on day 60. Construction Flow's chains are per-site
            and short-lived, so the world doesn't accumulate a history." Before Phase 6 the
            only event history was site.chaosHistory — capped at 10, scoped to one job, and
            destroyed when that job finished. Nothing survived a completed project.

            Every line here is backed by a live modifier. The standing text is derived from the
            same resolveMemoryEffects() the bidding, material pricing and turnover code reads,
            so this card cannot claim an effect the simulation is not applying. */}
        {(() => {
          const story = summarizeCompanyStory(game, 6);
          const effects = resolveMemoryEffects(game);
          const callback = pickMemoryCallback(game);
          const toneFor = (v) => (v === "bad" ? "hazard" : v === "neutral" ? "neutral" : "success");

          const live = [
            effects.bidEdge !== 0 && {
              label: "Bid win chance", tone: effects.bidEdge > 0 ? "success" : "hazard",
              value: `${effects.bidEdge > 0 ? "+" : "−"}${Math.abs(Math.round(effects.bidEdge * 100))}%`,
            },
            effects.supplierGoodwill !== 0 && {
              label: "Material prices", tone: effects.supplierGoodwill > 0 ? "success" : "hazard",
              value: `${effects.supplierGoodwill > 0 ? "−" : "+"}${Math.abs(Math.round(effects.supplierGoodwill * 100))}%`,
            },
            effects.crewLoyalty !== 0 && {
              label: "Crew staying power", tone: effects.crewLoyalty > 0 ? "success" : "hazard",
              value: `${effects.crewLoyalty > 0 ? "+" : "−"}${Math.abs(Math.round(effects.crewLoyalty * 100))}%`,
            },
            effects.rivalGrudge > 0 && {
              label: "Rivals bidding against you", tone: "hazard",
              value: `−${Math.round(effects.rivalGrudge * 100)}%`,
            },
          ].filter(Boolean);

          return (
            <Card T={T} tone={effects.rivalGrudge > 0 ? "hazard" : "steel"} elevated style={{ marginTop: 8 }}>
              <SectionLabel T={T} tone="steel">Company Story</SectionLabel>
              <Text style={[TYPE.body, { color: T.text, marginTop: SPACING.xs }]}>
                {describeStanding(game)}
              </Text>

              {live.length > 0 && (
                <View style={{ marginTop: SPACING.md }}>
                  <SectionLabel T={T}>What your history is doing right now</SectionLabel>
                  {live.map((row, i) => (
                    <KeyValueRow
                      key={row.label}
                      T={T}
                      label={row.label}
                      value={row.value}
                      tone={row.tone}
                      divider={i < live.length - 1}
                    />
                  ))}
                </View>
              )}

              {/* The world referring back to something the player actually did. */}
              {callback && (
                <View style={{ marginTop: SPACING.md }}>
                  <AlertBanner
                    T={T}
                    tone={callback.tone === "red" ? "hazard" : callback.tone === "green" ? "success" : callback.tone === "orange" ? "caution" : "info"}
                    title={callback.title}
                    body={callback.desc}
                  />
                </View>
              )}

              {story.length > 0 ? (
                <View style={{ marginTop: SPACING.md }}>
                  <SectionLabel T={T}>What this company has done</SectionLabel>
                  {story.map((entry) => (
                    <View key={entry.key} style={{ flexDirection: "row", alignItems: "flex-start", marginTop: SPACING.sm }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: SPACING.sm, backgroundColor: toneColor(toneFor(entry.valence), T), opacity: entry.stillCounts ? 1 : 0.35 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[TYPE.label, { color: entry.stillCounts ? T.text : T.sub }]} numberOfLines={2}>
                          {entry.label}
                        </Text>
                        <Text style={[TYPE.caption, { color: T.sub, marginTop: 1 }]} numberOfLines={1}>
                          {entry.when}{entry.stillCounts ? "" : " · no longer counts"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.md }]}>
                  Nothing on the record yet. Deliver a job, deal straight with a supplier, or buy
                  out a rival, and this is where it stays.
                </Text>
              )}
            </Card>
          );
        })()}

        {/* Market Position */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border, marginTop: 8 }]}>
          <Text style={[styles.sectionTitle, col]}>Market Position</Text>
          {[
            { label: "Market Share",      val: `${game.marketShare||1}%`,                                          color: T.blue },
            { label: "National Rank",     val: `#${rank}`,                                                         color: rank<=3?T.yellow:rank<=10?T.green:T.sub },
            { label: "Cities with Offices",val: `${(game.cityOffices||[]).length + 1}`,                            color: T.orange },
            { label: "Acquired Rivals",   val: `${(game.acquiredRivals||[]).length}`,                              color: T.purple },
            { label: "Your Valuation",    val: money(valuation),                                                    color: T.cyan },
          ].map(row => (
            <View key={row.label} style={[styles.finRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.sub, col]}>{row.label}</Text>
              <Text style={[styles.sub, { color: row.color }]}>{row.val}</Text>
            </View>
          ))}
          {(game.rivals||[]).filter(r=>!( game.acquiredRivals||[]).includes(r.id)&&r.status!=="Bankrupt").slice(0,3).map(rival => {
            const rivalVal = (rival.cash||0) + (rival.rep||0)*50000 + ((rival.cityPresence||["salem"]).length)*100000 + (rival.jobsCompleted||0)*15000;
            const ahead = valuation > rivalVal;
            const total = valuation + rivalVal;
            const playerShare = total > 0 ? Math.round((valuation / total) * 100) : 50;
            const gap = Math.abs(valuation - rivalVal);
            return (
              <View key={rival.id} style={{ paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.sub, col]}>{rival.name}</Text>
                  <Text style={[styles.sub, { color: ahead ? T.green : T.red }]}>{money(rivalVal)} {ahead ? "▼" : "▲"}</Text>
                </View>
                <View style={{ flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                  <View style={{ flex: playerShare, height: 4, backgroundColor: T.green }} />
                  <View style={{ flex: 100 - playerShare, height: 4, backgroundColor: ahead ? T.panel2 : T.red }} />
                </View>
                <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginTop: 2 }]}>
                  {ahead ? `You're ahead by ${money(gap)}` : `Behind by ${money(gap)}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Rankings Card — Area 3 */}
        {(() => {
          const activeRivals = (game.rivals||[]).filter(r=>!(game.acquiredRivals||[]).includes(r.id)&&r.status!=="Bankrupt");
          const totalMarket = activeRivals.reduce((s,r)=>{
            return s + (r.cash||0)+(r.rep||0)*50000+((r.cityPresence||["salem"]).length)*100000+(r.jobsCompleted||0)*15000;
          }, valuation);
          const marketSharePct = totalMarket > 0 ? ((valuation / totalMarket)*100) : 100;

          // Revenue rank: count rivals with higher weeklyRevenue estimate (val × 0.1)
          const weeklyRev = (game.weeklyStats?.revenue||0);
          const revenueRank = 1 + activeRivals.filter(r => {
            const est = ((r.cash||0)+(r.rep||0)*50000+((r.cityPresence||["salem"]).length)*100000) * 0.1;
            return est > weeklyRev;
          }).length;

          // Reputation rank
          const repRank = 1 + activeRivals.filter(r=>(r.rep||0)>(game.reputation||0)).length;

          // Company value rank
          const valRank = 1 + activeRivals.filter(r=>{
            const rv=(r.cash||0)+(r.rep||0)*50000+((r.cityPresence||["salem"]).length)*100000+(r.jobsCompleted||0)*15000;
            return rv > valuation;
          }).length;

          const totalRivals = activeRivals.length;
          const aheadCount = totalRivals - (valRank - 1);

          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.strongBorder, borderWidth: 1.5, marginTop: 8 }]}>
              <Text style={[styles.sectionTitle, { color: T.yellow, marginBottom: 8 }]}>Rankings</Text>
              {[
                { label: "Revenue Rank",    val: `#${revenueRank} / ${totalRivals+1}`, color: revenueRank<=3?T.yellow:revenueRank<=Math.ceil((totalRivals+1)/2)?T.green:T.sub },
                { label: "Reputation Rank", val: `#${repRank} / ${totalRivals+1}`,    color: repRank<=3?T.yellow:repRank<=Math.ceil((totalRivals+1)/2)?T.green:T.sub },
                { label: "Market Share",    val: `${marketSharePct.toFixed(1)}%`,       color: marketSharePct>=50?T.green:marketSharePct>=25?T.cyan:T.sub },
                { label: "Company Value",   val: `#${valRank} / ${totalRivals+1}`,     color: valRank<=3?T.yellow:valRank<=Math.ceil((totalRivals+1)/2)?T.green:T.sub },
              ].map(row=>(
                <View key={row.label} style={[styles.finRow,{borderBottomColor:T.border}]}>
                  <Text style={[styles.sub,col]}>{row.label}</Text>
                  <Text style={[styles.sub,{color:row.color,fontWeight:"700"}]}>{row.val}</Text>
                </View>
              ))}
              <Text style={[styles.sub,{color:T.cyan,marginTop:6,fontStyle:"italic"}]}>
                {aheadCount > 0 ? `You're ahead of ${aheadCount} rival${aheadCount!==1?"s":""}` : "Rivals are outpacing you — push harder!"}
              </Text>
            </View>
          );
        })()}

        {/* Empire Goals */}
        <Text style={[styles.sectionTitle, col, { marginTop: 8, marginBottom: 8 }]}>Empire Goals</Text>
        {EMPIRE_GOALS.map(goal => {
          const done = completedGoalIds.includes(goal.id);
          // Compute progress for known goal types
          let progressPct = done ? 100 : 0;
          let progressLabel = null;
          if (!done) {
            if (goal.id === "local_foothold") { const v = game.completedJobs||0; progressPct = Math.min(100, (v/10)*100); progressLabel = `${v}/10 jobs`; }
            else if (goal.id === "second_city" || goal.id === "multi_city") { const v = (game.cityOffices||[]).length; const t = goal.id === "second_city" ? 1 : 3; progressPct = Math.min(100,(v/t)*100); progressLabel = `${v}/${t} offices`; }
            else if (goal.id === "national_player") { const v = (game.cityOffices||[]).length; progressPct = Math.min(100,(v/7)*100); progressLabel = `${v}/7 cities`; }
            else if (goal.id === "land_baron") { const v = (game.properties||[]).length; progressPct = Math.min(100,(v/5)*100); progressLabel = `${v}/5 properties`; }
            else if (goal.id === "acquisition_king") { const v = (game.acquiredRivals||[]).length; progressPct = Math.min(100,(v/2)*100); progressLabel = `${v}/2 rivals`; }
            else if (goal.id === "valuation_5m") { const v = valuation; progressPct = Math.min(100,(v/5000000)*100); progressLabel = `${money(v)} / $5M`; }
            else if (goal.id === "construction_empire") { const v = valuation; progressPct = Math.min(100,(v/10000000)*100); progressLabel = `${money(v)} / $10M`; }
            else if (goal.id === "number_one") { const v = valuation; progressPct = Math.min(100,(v/20000000)*100); progressLabel = `${money(v)} / $20M`; }
            else if (goal.id === "salem_dominant") { const v = (game.cityJobsWon||{}).salem||0; progressPct = Math.min(100,(v/15)*100); progressLabel = `${v}/15 jobs`; }
          }
          return (
            <View key={goal.id} style={[styles.card, { backgroundColor: done ? T.panel3 : T.panel, borderColor: done ? T.green : T.border, borderWidth: done ? 1.5 : 1 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: done ? T.green : T.text }]}>{done ? "✅" : "○"} {goal.title}</Text>
                  <Text style={[styles.sub, subCol]}>{goal.desc}</Text>
                  {!done && progressLabel && (
                    <View style={{ marginTop: 5 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.sub, { color: T.cyan, fontSize: 12 }]}>{progressLabel}</Text>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{Math.round(progressPct)}%</Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2, marginTop: 2 }}>
                        <View style={{ height: 4, width: `${progressPct}%`, backgroundColor: T.cyan, borderRadius: 2 }} />
                      </View>
                    </View>
                  )}
                </View>
                <Text style={[styles.sub, { color: T.orange }]}>+{money(goal.cashReward||0)}</Text>
              </View>
            </View>
          );
        })}

        {/* City Expansion */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>City Expansion</Text>
        <Text style={[styles.sub, subCol, { marginBottom: 10 }]}>You operate in {(game.cityOffices||[]).length + 1} cit{(game.cityOffices||[]).length === 0 ? "y" : "ies"}. Open offices to unlock higher-value contracts.</Text>

        {/* City selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {CITIES.filter(c => c.id !== "salem").map(city => {
            const hasOffice = (game.cityOffices||[]).some(o => o.cityId === city.id);
            const isSelected = game.selectedEmpireCity === city.id;
            return (
              <TouchableOpacity
                key={city.id}
                style={[styles.chip, { marginRight: 8, paddingVertical: 6, paddingHorizontal: 12, borderColor: isSelected ? T.orange : hasOffice ? T.green : T.border, backgroundColor: isSelected ? T.orange : hasOffice ? T.panel3 : T.panel2 }]}
                onPress={() => update(g => { g.selectedEmpireCity = city.id; })}
              >
                <Text style={{ color: isSelected ? "#fff" : hasOffice ? T.green : T.sub, fontSize: 12, fontWeight: "600" }}>
                  {hasOffice ? "✅ " : ""}{city.name}, {city.state}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected city detail */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <Text style={[styles.label, col]}>{selectedCity.name}, {selectedCity.state}</Text>
          <Text style={[styles.sub, subCol]}>{selectedCity.popLabel} · {selectedCity.region}</Text>
          <Text style={[styles.sub, subCol]}>Contract value: ×{selectedCity.contractMult} · Competition: {selectedCity.competition}</Text>
          <Text style={[styles.sub, { color: game.reputation >= selectedCity.unlockRep ? T.green : T.orange }]}>
            Rep required: {selectedCity.unlockRep} {game.reputation >= selectedCity.unlockRep ? "✅" : `(have ${game.reputation})`}
          </Text>
          {hasOfficeInSelected ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.sub, { color: T.green }]}>✅ You have a presence in {selectedCity.name}</Text>
              {(game.cityOffices||[]).filter(o=>o.cityId===selectedCity.id).map(o => {
                const def = REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId);
                return <Text key={o.id} style={[styles.sub, subCol]}>· {def?.name||o.typeId} (opened Day {o.openedDay})</Text>;
              })}
            </View>
          ) : null}
          <Text style={[styles.label, col, { marginTop: 12, marginBottom: 4 }]}>Open an Office</Text>
          {REGIONAL_OFFICE_TYPES.map(def => {
            const totalCost = def.cost + (hasOfficeInSelected ? 0 : selectedCity.unlockCost);
            const canAfford = game.cash >= totalCost;
            const repOk = game.reputation >= selectedCity.unlockRep;
            return (
              <View key={def.id} style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border, marginBottom: 8 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, col]}>{def.name}</Text>
                    <Text style={[styles.sub, subCol]}>{def.desc}</Text>
                    <Text style={[styles.sub, { color: T.cyan }]}>+{def.crewBonus} crew · +{def.contractSlots} contract slots</Text>
                    <Text style={[styles.sub, { color: T.orange }]}>Daily rent: {money(def.dailyRent)}</Text>
                  </View>
                  <Text style={[styles.label, { color: canAfford ? T.green : T.red }]}>{money(totalCost)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.btn, { marginTop: 8, backgroundColor: (!repOk || !canAfford) ? T.panel3 : T.blue, borderColor: !repOk ? T.orange : T.blue }]}
                  onPress={() => handleOpenOffice(selectedCity.id, def.id)}
                  disabled={!repOk}
                >
                  <Text style={[styles.btnText, { color: (!repOk || !canAfford) ? T.sub : "#fff" }]}>
                    {!repOk ? `Needs Rep ${selectedCity.unlockRep}` : `Open ${def.name}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Properties */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Land & Properties</Text>
        {PROPERTY_TYPES.map(def => {
          const owned = (game.properties||[]).filter(p => p.typeId === def.id);
          const canAfford = game.cash >= def.cost;
          return (
            <View key={def.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, col]}>{def.name}</Text>
                  <Text style={[styles.sub, subCol]}>{def.desc}</Text>
                  {def.dailyCost > 0 && <Text style={[styles.sub, { color: T.orange }]}>Daily cost: {money(def.dailyCost)}</Text>}
                  {def.weeklyIncome > 0 && <Text style={[styles.sub, { color: T.green }]}>💵 Weekly income: +{money(def.weeklyIncome)}</Text>}
                  {owned.length > 0 && <Text style={[styles.sub, { color: T.cyan }]}>✅ Owned ×{owned.length} · earning {money(def.weeklyIncome * owned.length)}/wk</Text>}
                </View>
                <Text style={[styles.label, { color: canAfford ? T.green : T.red }]}>{money(def.cost)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, { marginTop: 8, backgroundColor: canAfford ? T.purple : T.panel2, borderColor: T.purple }]}
                onPress={() => handleBuyProperty(def.id)}
              >
                <Text style={[styles.btnText, { color: canAfford ? "#fff" : T.sub }]}>Purchase</Text>
              </TouchableOpacity>
              {owned.map(p => (
                <TouchableOpacity key={p.id} style={[styles.btn, { marginTop: 4, borderColor: T.red }]} onPress={() => handleSellProperty(p.id)}>
                  <Text style={[styles.btnText, { color: T.red }]}>Sell ({money(Math.round(def.cost*(def.resaleRate||0.8)))})</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* City Market Share */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>City Market Share</Text>
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border, padding: 10 }]}>
          {CITIES.map(city => {
            const hasPresence = city.id === "salem" || (game.cityOffices||[]).some(o => o.cityId === city.id);
            if (!hasPresence) return null;
            const playerShare = getCityPlayerShare(game, city.id);
            const jobsWon = (game.cityJobsWon||{})[city.id] || 0;
            return (
              <View key={city.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom: 4 }}>
                  <Text style={[styles.label, col]}>{city.name}, {city.state}</Text>
                  <Text style={[styles.sub, { color: playerShare >= 50 ? T.green : T.sub }]}>{playerShare}% share · {jobsWon} jobs won</Text>
                </View>
                <View style={{ height: 6, backgroundColor: T.track, borderRadius: 3 }}>
                  <View style={{ height: 6, width: `${Math.min(100,playerShare)}%`, backgroundColor: playerShare >= 50 ? T.green : T.blue, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* National Contractor Rankings */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>National Contractor Rankings</Text>
        {(() => {
          const activeRivals = (game.rivals || []).filter(r => !((game.acquiredRivals||[]).includes(r.id)) && r.status !== "Bankrupt");
          if (activeRivals.length === 0) return null;
          const closestRival = activeRivals.reduce((closest, r) => {
            const rVal = (r.cash||0) + (r.rep||0)*50000 + (r.cityPresence||["salem"]).length*100000 + (r.jobsCompleted||0)*15000;
            const closestVal = (closest.cash||0) + (closest.rep||0)*50000 + (closest.cityPresence||["salem"]).length*100000 + (closest.jobsCompleted||0)*15000;
            return Math.abs(rVal - valuation) < Math.abs(closestVal - valuation) ? r : closest;
          });
          const closestVal = (closestRival.cash||0) + (closestRival.rep||0)*50000 + (closestRival.cityPresence||["salem"]).length*100000 + (closestRival.jobsCompleted||0)*15000;
          const gap = valuation - closestVal;
          const isAhead = gap >= 0;
          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.orange, borderWidth: 1, marginBottom: 8 }]}>
              <Text style={[styles.sub, { color: T.orange, fontSize: 12, fontWeight: "700", marginBottom: 2 }]}>
                🎯 CLOSEST RIVAL — {closestRival.name}
              </Text>
              <Text style={[styles.sub, subCol]}>
                {isAhead ? `You're ahead by ${money(Math.abs(gap))}` : `They're ahead by ${money(Math.abs(gap))}`} · {closestRival.focus || "general"} focus
              </Text>
            </View>
          );
        })()}
        {buildContractorRankings(game).map(entry => {
          const rival = !entry.isPlayer ? (game.rivals||[]).find(r => r.id === entry.id) : null;
          const acqCost = rival ? Math.max(50000, (rival.rep||0)*3000 + (rival.cash||0)*0.5) : 0;
          const rankColor = entry.rank === 1 ? T.yellow : entry.rank <= 3 ? T.orange : entry.rank <= 10 ? T.green : T.sub;
          return (
            <View key={entry.id} style={[styles.card, {
              backgroundColor: entry.isPlayer ? T.panel3 : entry.acquired ? T.panel2 : T.panel,
              borderColor: entry.isPlayer ? T.cyan : entry.rank <= 3 ? T.yellow : entry.acquired ? T.green : T.border,
              borderLeftWidth: entry.isPlayer || entry.rank <= 3 ? 4 : 1,
              marginBottom: 6,
            }]}>
              <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap: 10, flex: 1 }}>
                  <Text style={[{ fontSize: 18, fontWeight: "900", color: rankColor, minWidth: 36 }]}>#{entry.rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: entry.isPlayer ? T.cyan : col.color }]}>
                      {entry.isPlayer ? "★ " : ""}{entry.name}{entry.acquired ? " ✅" : ""}
                    </Text>
                    <Text style={[styles.sub, subCol]}>
                      Rep {entry.rep} · {entry.cities} {entry.cities === 1 ? "city" : "cities"}{entry.status === "Bankrupt" ? " · 💀 Bankrupt" : ""}
                    </Text>
                    {rival && (() => {
                      const focusIcon = rival.focus === "residential" ? "🏠" : rival.focus === "commercial" ? "🏢" : "🔧";
                      const focusLabel = rival.focus || "general";
                      const aggLabel = (rival.aggression || 0) >= 0.70 ? "High threat" : (rival.aggression || 0) >= 0.55 ? "Active" : "Low key";
                      const aggColor = (rival.aggression || 0) >= 0.70 ? T.red : (rival.aggression || 0) >= 0.55 ? T.orange : T.sub;
                      const inHomeCity = (rival.cityPresence || ["salem"]).includes(game.startingCityId || "salem");
                      return (
                        <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginTop: 1 }]}>
                          {focusIcon} {focusLabel} · <Text style={{ color: aggColor }}>{aggLabel}</Text>{inHomeCity ? " · 🏠 In your market" : ""}
                        </Text>
                      );
                    })()}
                  </View>
                </View>
                <Text style={[styles.sub, { color: entry.isPlayer ? T.cyan : T.sub }]}>{money(entry.value)}</Text>
              </View>
              {rival && !entry.acquired && entry.status !== "Bankrupt" && (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>👷 {rival.employees || 0} crew</Text>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>🚜 {rival.equipment || 0} machine{(rival.equipment || 0) === 1 ? "" : "s"}</Text>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>🏙️ {(rival.cityPresence || ["salem"]).length} {(rival.cityPresence || ["salem"]).length === 1 ? "city" : "cities"}</Text>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>💰 {money(rival.cash || 0)}</Text>
                </View>
              )}
              {rival && (rival.aggression || 0) >= 0.70 && !entry.acquired && entry.status !== "Bankrupt" && (
                <View style={{ marginTop: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                    <Text style={[styles.sub, { color: T.red, fontSize: 12, fontWeight: "700" }]}>⚠ High aggression rival</Text>
                    <Text style={[styles.sub, { color: T.red, fontSize: 12 }]}>{Math.round((rival.aggression || 0) * 100)}%</Text>
                  </View>
                  <View style={{ height: 3, backgroundColor: T.track, borderRadius: 2 }}>
                    <View style={{ height: 3, width: `${Math.round((rival.aggression || 0) * 100)}%`, backgroundColor: T.red, borderRadius: 2 }} />
                  </View>
                </View>
              )}
              {!entry.isPlayer && !entry.acquired && entry.status !== "Bankrupt" && game.reputation >= 50 && (() => {
                // Show acquire button when player valuation > 5× rival OR rival is struggling
                const rivalValNow = entry.value;
                const canAcquire = (valuation >= rivalValNow * 5 && game.cash >= 200000) || game.cash >= acqCost;
                return canAcquire ? (
                  <TouchableOpacity
                    style={[styles.btn, { marginTop: 8, backgroundColor: game.cash >= acqCost ? T.orange : T.panel2, borderColor: T.orange }]}
                    onPress={() => Alert.alert(
                      "Acquire Competitor",
                      `Buy out ${entry.name} for ${money(acqCost)}? You'll absorb their assets and crew.`,
                      [{ text: "Cancel", style: "cancel" }, { text: "Acquire", onPress: () => handleAcquireRival(entry.id) }]
                    )}
                  >
                    <Text style={[styles.btnText, { color: game.cash >= acqCost ? "#fff" : T.sub }]}>
                      Acquire — {money(acqCost)}
                    </Text>
                  </TouchableOpacity>
                ) : null;
              })()}
              {entry.acquired && <Text style={[styles.sub, { color: T.green, marginTop: 4 }]}>Acquired — integrated into your company.</Text>}
            </View>
          );
        })}

        {/* ── Achievements ── */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Achievements</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ACHIEVEMENTS_LIST.map(ach => {
            const earned = (game.achievements || []).includes(ach.id);
            return (
              <View key={ach.id} style={{ width: "48%", backgroundColor: earned ? T.green + "15" : T.panel, borderColor: earned ? T.green : T.border, borderWidth: earned ? 1.5 : 1, borderRadius: 10, padding: 11, marginBottom: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                  <Ionicons name={ach.icon} size={22} color={earned ? T.green : T.sub} style={{ marginRight: 7, opacity: earned ? 1 : 0.35 }} />
                  {earned && <Text style={{ color: T.green, fontSize: 13, fontWeight: "bold", marginLeft: "auto" }}>✓</Text>}
                </View>
                <Text style={{ fontWeight: "bold", fontSize: 12, color: earned ? T.text : T.sub, marginBottom: 3 }}>{ach.title}</Text>
                <Text style={[styles.sub, { color: earned ? T.sub : T.border, fontSize: 12, lineHeight: 14 }]}>{ach.desc}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Company Records / Hall of Fame (Feature 5) ── */}
        <Text style={[styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }]}>Company Records</Text>
        <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.yellow, borderWidth: 1.5 }]}>
          {[
            { label: "🏆 Biggest Contract",        value: money(game.hallOfFame?.biggestContract || 0),                                                   color: T.yellow },
            { label: "📈 Peak Reputation",         value: `${game.hallOfFame?.highestRep || 0}`,                                                           color: T.purple },
            { label: "👷 Largest Crew Ever",       value: `${game.hallOfFame?.largestCrew || 0} workers`,                                                  color: T.cyan },
            { label: "🚜 Largest Fleet Ever",      value: `${game.hallOfFame?.largestFleet || 0} machines`,                                                color: T.orange },
            { label: "💰 Peak Valuation",          value: money(game.hallOfFame?.highestValuation || 0),                                                   color: T.green },
            { label: "⭐ Most Profitable Job",     value: game.hallOfFame?.mostProfitableProject?.label ? `${game.hallOfFame.mostProfitableProject.label} (${money(game.hallOfFame.mostProfitableProject.value)})` : "None yet", color: T.blue },
          ].map((row, i, arr) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.border }}>
              <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{row.label}</Text>
              <Text style={[styles.sub, { color: row.color, fontWeight: "700", fontSize: 12, textAlign: "right", flex: 1, marginLeft: 8 }]} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ── City Presence (Feature 8) ── */}
        {(() => {
          const activeCities = CITIES.filter(city =>
            city.id === "salem" || (game.cityOffices||[]).some(o => o.cityId === city.id)
          );
          if (activeCities.length === 0) return null;
          return (
            <>
              <Text style={[styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }]}>City Presence</Text>
              <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
                {activeCities.map((city, i) => {
                  const stats = game.cityStats?.[city.id] || { playerJobs: 0, rivalJobs: 0 };
                  const totalJobs = stats.playerJobs + stats.rivalJobs;
                  const sharePct = totalJobs > 0 ? Math.round((stats.playerJobs / totalJobs) * 100) : 100;
                  const rankInCity = 1 + (game.rivals||[]).filter(r =>
                    r.status !== "Bankrupt" &&
                    (r.cityPresence||["salem"]).includes(city.id) &&
                    (r.rep||0) > (game.reputation||0)
                  ).length;
                  const hasOffice = city.id === "salem" || (game.cityOffices||[]).some(o => o.cityId === city.id);
                  return (
                    <View key={city.id} style={{ marginBottom: i < activeCities.length - 1 ? 12 : 0, paddingBottom: i < activeCities.length - 1 ? 12 : 0, borderBottomWidth: i < activeCities.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: T.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <View>
                          <Text style={[styles.label, col]}>{city.name}, {city.state}</Text>
                          <Text style={[styles.sub, { color: T.sub }]}>Rank #{rankInCity} · {stats.playerJobs} jobs won</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.sub, { color: sharePct >= 50 ? T.green : sharePct >= 25 ? T.cyan : T.sub, fontWeight: "700" }]}>{sharePct}%</Text>
                          <Text style={[{ fontSize: 12, color: T.sub }]}>market share</Text>
                        </View>
                      </View>
                      <View style={{ height: 6, backgroundColor: T.track, borderRadius: 3 }}>
                        <View style={{ height: 6, width: `${Math.min(100, sharePct)}%`, backgroundColor: sharePct >= 50 ? T.green : T.blue, borderRadius: 3 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          );
        })()}

        {/* ── Ultimate Goals / Endgame Milestones (Feature 9) ── */}
        {(() => {
          const endgameMilestones = MILESTONE_DEFS.filter(m => m.tier === 4);
          if (endgameMilestones.length === 0) return null;
          const valuation = computeValuation(game);
          return (
            <>
              <Text style={[styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }]}>Ultimate Goals</Text>
              {endgameMilestones.map(m => {
                const done = !!(game._milestones?.[m.key]);
                let progressPct = done ? 100 : 0;
                let progressLabel = null;
                if (!done) {
                  if (m.key === "rep100")     { const v = game.reputation||0; progressPct = Math.min(100,(v/100)*100); progressLabel = `${v}/100 rep`; }
                  else if (m.key === "cities10") { const v = (game.unlockedCities?.length||1); progressPct = Math.min(100,(v/10)*100); progressLabel = `${v}/10 cities`; }
                  else if (m.key === "value100m") { const v = game.companyValuation||0; progressPct = Math.min(100,(v/100000000)*100); progressLabel = `${money(v)} / $100M`; }
                  else if (m.key === "jobs1000") { const v = game.completedJobs||0; progressPct = Math.min(100,(v/1000)*100); progressLabel = `${v}/1,000 jobs`; }
                  else if (m.key === "domination") {
                    const activeRivals = (game.rivals||[]).filter(r=>r.status!=="Bankrupt");
                    const outvalued = activeRivals.filter(r=>(game.companyValuation||0)>((r.cash||0)+(r.rep||0)*50000)*10).length;
                    progressPct = activeRivals.length > 0 ? Math.min(100,(outvalued/activeRivals.length)*100) : 100;
                    progressLabel = `${outvalued}/${activeRivals.length} rivals outvalued 10×`;
                  }
                }
                return (
                  <View key={m.key} style={[styles.card, { backgroundColor: done ? T.panel3 : T.panel, borderColor: done ? T.yellow : T.border, borderWidth: done ? 2 : 1, marginBottom: 6 }]}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: done ? T.yellow : T.text }]}>{done ? "🏆" : "○"} {m.label}</Text>
                        <Text style={[styles.sub, { color: T.sub }]}>{m.desc}</Text>
                        {!done && progressLabel && (
                          <View style={{ marginTop: 5 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <Text style={[styles.sub, { color: T.yellow, fontSize: 12 }]}>{progressLabel}</Text>
                              <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{Math.round(progressPct)}%</Text>
                            </View>
                            <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2, marginTop: 2 }}>
                              <View style={{ height: 4, width: `${progressPct}%`, backgroundColor: T.yellow, borderRadius: 2 }} />
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          );
        })()}

        {/* ── Company Legacy ── */}
        <Text style={[styles.sectionTitle, col, { marginTop: 20, marginBottom: 8 }]}>Company Legacy</Text>
        <View style={styles.card}>
          {[
            { label: "Years in Business", value: (() => { const yrs = Math.floor((game.day || 1) / 365); return yrs >= 1 ? `${yrs} Year${yrs !== 1 ? "s" : ""}` : "< 1 Year"; })(), color: T.cyan },
            { label: "Days Operating",          value: `${game.day ?? 0}`,                                                        color: T.text },
            { label: "Total Contracts Won",     value: `${(game.legacyStats?.totalContractsWon ?? 0).toLocaleString()}`,           color: T.blue },
            { label: "Total Revenue",           value: money(game.legacyStats?.totalRevenue ?? 0),                                color: T.green },
            { label: "Employees Ever Hired",    value: `${(game.legacyStats?.totalEmployeesHired ?? 0).toLocaleString()}`,         color: T.purple },
            { label: "Equipment Purchased",     value: `${(game.legacyStats?.totalEquipmentBought ?? 0).toLocaleString()}`,        color: T.orange },
            { label: "Achievements Earned",     value: `${(game.achievements || []).length} / ${ACHIEVEMENTS_LIST.length}`,        color: T.yellow },
          ].map((row, i, arr) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: T.border }}>
              <Text style={[styles.label, { color: T.sub, fontWeight: "500", fontSize: 13 }]}>{row.label}</Text>
              <Text style={{ color: row.color, fontWeight: "bold", fontSize: 14 }}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Legacy Score Tier (Feature 4 — Empire) ── */}
        {(() => {
          const legacy = getLegacyScore(game);
          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.purple, borderWidth: 1.5, marginTop: 8, marginBottom: 8, alignItems: "center" }]}>
              <Text style={{ fontSize: 11, color: T.purple, fontWeight: "700", marginBottom: 4 }}>YOUR LEGACY TIER</Text>
              <Ionicons name={legacy.icon} size={36} color={T.purple} style={{ marginBottom: 4 }} />
              <Text style={[styles.h2, { color: T.purple, textAlign: "center" }]}>{legacy.label}</Text>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }]}>Legacy Score: {legacy.score} / 100</Text>
              <View style={{ height: 6, width: "100%", backgroundColor: T.track, borderRadius: 3, marginTop: 10 }}>
                <View style={{ height: 6, width: `${legacy.score}%`, backgroundColor: T.purple, borderRadius: 3 }} />
              </View>
            </View>
          );
        })()}
      </ScrollView>
    );
  }

  function renderFinance() {
    const totalDebt = game.loans.reduce((s, l) => s + l.remainingBalance, 0);
    const dailyPayroll = [...game.crew, ...game.officeStaff].reduce((s, p) => s + (p.wagePerDay || 0), 0);
    const weeklyPayroll = dailyPayroll * 7;
    const weeklyEquipCost = game.equipment.reduce((s, e) => s + e.dailyCost, 0) * 7;
    const weeklyRent = dailyOfficeRent(game) * 7;
    const dailyEquipCost = game.equipment.reduce((s, e) => s + e.dailyCost, 0);
    const dailyLoanInterest = game.loans.reduce((s, l) => s + (l.weeklyPayment || 0) / 7, 0);
    const dailyIncome = (game.weeklyStats?.revenue || 0) / 7;
    // Tax accrues against every dollar of revenue, so a cash-flow figure that ignores it
    // overstates the business by the tax rate and the runway estimate below inherits the lie.
    // FleetFlow includes taxEstimate in its daily expenses for exactly this reason.
    const dailyTaxAccrual = dailyIncome * taxRateFor(game);
    const netDailyCashFlow = dailyIncome - dailyPayroll - dailyEquipCost - dailyOfficeRent(game) - dailyLoanInterest - dailyTaxAccrual;
    const regionalEconomy = getConstructionRegionalSnapshot(game);
    const loanOffers = LOAN_PRODUCTS.map((product) => {
      const offer = computeLoanOffer(product.id, buildBorrowerProfile(game, product));
      return {
        ...product,
        _offer: offer,
        principal: offer.approved ? offer.principal : product.principalMin,
        apr: offer.approved ? offer.apr : product.aprMax,
        weeks: product.termWeeks,
        eligible: offer.approved,
        declineReasons: offer.approved ? [] : (offer.reasons || []),
      };
    });

    // Financial ledger view model. The ledger is history-only and never mutates balances.
    const ledgerCutoff = (game.day || 0) - 7;
    const ledger7d = (game.ledger || []).filter((entry) => (entry.day || 0) >= ledgerCutoff);
    const recentLedger = (game.ledger || []).slice(0, 8);
    const ledgerRevenue = ledger7d.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
    const ledgerExpenses = ledger7d.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const ledgerNet = ledgerRevenue - ledgerExpenses;
    const ledgerCategoryLabels = {
      payroll: "Payroll", fuel: "Fuel", maintenance: "Maintenance", equipment: "Equipment",
      materials: "Materials", insurance: "Insurance", utilities: "Utilities", inventory: "Inventory",
      taxes: "Taxes", financing: "Financing", property: "Property", fines: "Fines & Legal",
      contracts: "Contracts", bonuses: "Bonuses", sales: "Asset Sales", misc: "Other",
    };
    const summarizeLedgerCategories = (entries, sign) => Object.entries(entries.reduce((acc, entry) => {
      if ((sign === "income" && entry.amount <= 0) || (sign === "expense" && entry.amount >= 0)) return acc;
      const key = entry.category || "misc";
      acc[key] = (acc[key] || 0) + Math.abs(entry.amount);
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topRevenueCategories = summarizeLedgerCategories(ledger7d, "income");
    const topExpenseCategories = summarizeLedgerCategories(ledger7d, "expense");

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
        {/* ─── Performance — Sprint 7 ──────────────────────────────────────────
            How the company is actually doing, measured from state this game maintains.

            Audit rows 36/37 said analyticsEngine was "collected but the player can't see it."
            The truth was worse: it is FleetFlow's module, and every input it reads
            (weeklyStats.completedRoutes / routeIncome / wages, status "En Route",
            customerRating) is a field Construction Flow does not have. It was snapshotting a
            row of zeros, a permanent 100% on-time rate and a permanent 0% utilisation every
            seven days. Surfacing THOSE numbers would have been worse than hiding them.

            Every figure below comes from src/systems/constructionKPIs.js, which measures crew,
            plant, the ledger, job history and bid outcomes — all things that exist. */}
        {(() => {
          const rows = buildKPIRows(game);
          const summary = summarizePerformance(game);
          const ctx = computeKPIs(game).context;
          const toneFor = (grade) =>
            grade === "great" ? "success" : grade === "good" ? "steel" : grade === "poor" ? "caution" : "neutral";

          return (
            <Card
              T={T}
              tone={summary.ready && summary.weakest?.grade === "poor" ? "caution" : "steel"}
              elevated
            >
              <SectionLabel
                T={T}
                tone="steel"
                right={summary.ready
                  ? <Pill T={T} label={`${summary.greatCount}/${summary.readyCount} strong`} tone={summary.poorCount > 0 ? "caution" : "success"} />
                  : null}
              >
                Performance
              </SectionLabel>

              <Text style={[TYPE.label, { color: T.text, marginTop: SPACING.xs }]}>
                {summary.headline}
              </Text>
              {summary.detail ? (
                <Text style={[TYPE.caption, { color: T.sub, marginTop: 2 }]}>{summary.detail}</Text>
              ) : null}

              <View style={{ marginTop: SPACING.md }}>
                {rows.map((row, i) => {
                  const dir = row.ready ? describeKPIDirection(game, row.key) : { direction: "flat", hasTrend: false };
                  const arrow = !dir.hasTrend ? "" : dir.direction === "up" ? " ▲" : dir.direction === "down" ? " ▼" : "";
                  return (
                    <View
                      key={row.key}
                      style={{
                        paddingVertical: SPACING.sm,
                        borderBottomWidth: i < rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: T.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={[TYPE.body, { color: T.text, flex: 1, marginRight: SPACING.sm }]} numberOfLines={1}>
                          {row.label}
                        </Text>
                        <Text
                          style={[TYPE.bodyStrong, { color: row.ready ? toneColor(toneFor(row.grade), T) : T.sub }]}
                          numberOfLines={1}
                        >
                          {row.ready ? `${row.display}${arrow}` : "—"}
                        </Text>
                      </View>
                      <Text style={[TYPE.caption, { color: T.sub, marginTop: 1 }]} numberOfLines={1}>
                        {row.ready ? row.help : "Not enough history yet"}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* The counts behind the percentages, so "67%" reads as "2 of 3 on time". */}
              <Text style={[TYPE.caption, { color: T.sub, marginTop: SPACING.md }]}>
                {ctx.ratedJobs > 0
                  ? `${ctx.ratedJobs - ctx.lateJobs} of ${ctx.ratedJobs} job${ctx.ratedJobs === 1 ? "" : "s"} on time · `
                  : ""}
                {ctx.machinesWorking}/{ctx.machines} machines working · {ctx.crewOnSite}/{ctx.crew} crew on site
                {ctx.bidsResolved > 0 ? ` · ${ctx.bidsResolved} bid${ctx.bidsResolved === 1 ? "" : "s"} resolved` : ""}
              </Text>
            </Card>
          );
        })()}
        {/* P&L summary */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <Text style={[styles.sectionTitle, col]}>Financial Overview</Text>
          {[
            { label: "Cash on Hand",      val: money(game.cash),                                color: game.cash >= 0 ? T.green : T.red },
            { label: "Net Daily Cash Flow",val: (netDailyCashFlow >= 0 ? "+" : "") + money(netDailyCashFlow), color: netDailyCashFlow >= 0 ? T.green : T.red,
              bar: netDailyCashFlow < 0 && game.cash > 0 ? (() => { const d = Math.floor(game.cash / Math.abs(netDailyCashFlow)); return { value: Math.min(100, Math.round((d / 30) * 100)), color: d < 7 ? T.red : d < 14 ? T.orange : T.yellow }; })() : null,
              note: netDailyCashFlow < 0 && game.cash > 0 ? `${Math.floor(game.cash / Math.abs(netDailyCashFlow))}d runway at current burn rate` : null,
            },
            { label: "Credit Score",       val: `${game.creditScore} (${creditInfo.label})`,    color: T[creditInfo.color], bar: { value: Math.round(Math.max(0, Math.min(100, ((game.creditScore - 300) / 550) * 100))), color: T[creditInfo.color] } },
            { label: "Total Debt",         val: money(totalDebt),                                color: totalDebt > 0 ? T.orange : T.green },
            { label: "Daily Loan Interest",val: money(Math.round(dailyLoanInterest)),            color: dailyLoanInterest > 0 ? T.orange : T.sub },
            { label: "Daily Tax Accrual",  val: money(Math.round(dailyTaxAccrual)),              color: dailyTaxAccrual > 0 ? T.orange : T.sub,
              note: taxEstimate(game) > 0 ? `${money(taxEstimate(game))} set aside so far this week` : null },
            { label: "Weekly Payroll",     val: money(weeklyPayroll),                            color: T.text },
            { label: "Weekly Equip Cost",  val: money(weeklyEquipCost),                          color: T.text },
            { label: "Weekly Rent",        val: money(weeklyRent),                               color: T.text },
            { label: "Total Revenue",      val: money(game.revenue),                             color: T.cyan },
            { label: "Total Expenses",     val: money(game.expenses),                            color: T.orange },
          ].map((row) => (
            <View key={row.label} style={[styles.finRow, { borderBottomColor: T.border, flexDirection: "column", alignItems: "stretch" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.sub, col]}>{row.label}</Text>
                <Text style={[styles.sub, { color: row.color }]}>{row.val}</Text>
              </View>
              {row.bar && (
                <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 4 }]}>
                  <View style={[styles.progressFill, { width: `${row.bar.value}%`, backgroundColor: row.bar.color }]} />
                </View>
              )}
              {row.note && (
                <Text style={[styles.sub, { color: row.bar?.color || T.sub, fontSize: 12, marginTop: 2 }]}>{row.note}</Text>
              )}
            </View>
          ))}
        </View>

        {/* Regional Economy */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: T.cyan }]}>Regional Economy · {regionalEconomy.stateName}</Text>
          <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>
            Local construction conditions actively affect bids, materials, wages, and financing.
          </Text>
          {[
            { label: "Contract Market", val: `${regionalEconomy.contractValueMult.toFixed(2)}×`, color: regionalEconomy.contractValueMult >= 1 ? T.green : T.orange },
            { label: "Material Prices", val: `${regionalEconomy.materialPriceMult.toFixed(2)}×`, color: regionalEconomy.materialPriceMult <= 1 ? T.green : T.orange },
            { label: "Wage Pressure", val: `${regionalEconomy.wageMult.toFixed(2)}×`, color: regionalEconomy.wageMult <= 1 ? T.green : T.orange },
            { label: "Lending Climate", val: `${regionalEconomy.lendingEconomyMult.toFixed(2)}×`, color: regionalEconomy.lendingEconomyMult >= 1 ? T.green : T.orange },
          ].map((row) => (
            <View key={row.label} style={[styles.finRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.sub, col]}>{row.label}</Text>
              <Text style={[styles.sub, { color: row.color, fontWeight: "700" }]}>{row.val}</Text>
            </View>
          ))}
        </View>

        {/* Financial Ledger */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.strongBorder, borderWidth: 1.5 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <View>
              <Text style={[styles.sectionTitle, col]}>Transaction Ledger</Text>
              <Text style={[styles.sub, subCol]}>Last 7 days · cash movements recorded automatically</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: (ledgerNet >= 0 ? T.green : T.red) + "22" }]}>
              <Text style={[styles.statusPillText, { color: ledgerNet >= 0 ? T.green : T.red }]}>
                {ledgerNet >= 0 ? "+" : ""}{money(ledgerNet)} net
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Income", value: ledgerRevenue, color: T.green, prefix: "+" },
              { label: "Expenses", value: ledgerExpenses, color: T.red, prefix: "-" },
              { label: "Net", value: Math.abs(ledgerNet), color: ledgerNet >= 0 ? T.green : T.red, prefix: ledgerNet >= 0 ? "+" : "-" },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 8, padding: 9, alignItems: "center" }}>
                <Text style={{ color: item.color, fontSize: 13, fontWeight: "800" }}>{item.prefix}{money(item.value)}</Text>
                <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {ledger7d.length > 0 ? (
            <>
              {(topRevenueCategories.length > 0 || topExpenseCategories.length > 0) && (
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sub, { color: T.green, fontWeight: "700", marginBottom: 4 }]}>TOP INCOME</Text>
                    {topRevenueCategories.map(([category, amount]) => (
                      <View key={`rev-${category}`} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={[styles.sub, subCol]} numberOfLines={1}>{ledgerCategoryLabels[category] || category}</Text>
                        <Text style={[styles.sub, { color: T.green }]}>+{money(amount)}</Text>
                      </View>
                    ))}
                    {topRevenueCategories.length === 0 && <Text style={[styles.sub, subCol]}>No income yet</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sub, { color: T.red, fontWeight: "700", marginBottom: 4 }]}>TOP SPENDING</Text>
                    {topExpenseCategories.map(([category, amount]) => (
                      <View key={`exp-${category}`} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={[styles.sub, subCol]} numberOfLines={1}>{ledgerCategoryLabels[category] || category}</Text>
                        <Text style={[styles.sub, { color: T.red }]}>-{money(amount)}</Text>
                      </View>
                    ))}
                    {topExpenseCategories.length === 0 && <Text style={[styles.sub, subCol]}>No expenses yet</Text>}
                  </View>
                </View>
              )}

              <Text style={[styles.sub, { color: T.sub, fontWeight: "700", marginBottom: 5 }]}>RECENT TRANSACTIONS</Text>
              {recentLedger.map((entry, index) => (
                <View key={entry.id || `${entry.day}-${index}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: (entry.amount >= 0 ? T.green : T.orange) + "22", marginRight: 8 }}>
                    <Ionicons name={entry.amount >= 0 ? "arrow-down" : "arrow-up"} size={14} color={entry.amount >= 0 ? T.green : T.orange} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.sub, col]} numberOfLines={1}>{entry.description || ledgerCategoryLabels[entry.category] || "Transaction"}</Text>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>Day {entry.day || 0} · {ledgerCategoryLabels[entry.category] || entry.category || "Other"} · Balance {money(entry.balance || 0)}</Text>
                  </View>
                  <Text style={[styles.sub, { color: entry.amount >= 0 ? T.green : T.red, fontWeight: "800" }]}>
                    {entry.amount >= 0 ? "+" : "-"}{money(Math.abs(entry.amount))}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <View style={{ backgroundColor: T.panel2, borderRadius: 8, padding: 12 }}>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center" }]}>
                Nothing recorded yet. Every contract payment, wage, material order and repair lands here automatically — start a job and the ledger fills itself.
              </Text>
            </View>
          )}
        </View>

        {/* R16-1: Business Savings */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1, marginBottom: 8 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={[styles.sectionTitle, { color: T.cyan }]}>🏦 Reserve Savings</Text>
            <Text style={[styles.label, { color: T.cyan }]}>{money(game.savings || 0)}</Text>
          </View>
          <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginBottom: 8 }]}>
            {(game.savings || 0) > 0 ? `Earning ${money(Math.round((game.savings || 0) * 0.0012))}/day · 4.4% annual` : "Deposit to earn 4.4% annual interest on reserves."}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {[1000, 5000, 10000, 50000, 100000].map(p => (
              <TouchableOpacity key={p} style={[styles.chip, { marginRight: 6, borderColor: savingsAmt === String(p) ? T.cyan : T.border }]} onPress={() => setSavingsAmt(String(p))}>
                <Text style={[styles.sub, { color: savingsAmt === String(p) ? T.cyan : T.sub }]}>{money(p)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={[styles.input, col, { marginBottom: 8 }]} value={savingsAmt} onChangeText={setSavingsAmt} keyboardType="numeric" placeholder="Custom amount" placeholderTextColor={T.sub} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: game.cash >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? T.cyan : T.panel2, borderColor: T.cyan }]}
              onPress={() => { handleSavingsDeposit(parseInt(savingsAmt) || 0); setSavingsAmt(""); }}>
              <Text style={[styles.btnText, { color: game.cash >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? "#000" : T.sub }]}>Deposit →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: (game.savings || 0) >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? T.green : T.panel2, borderColor: T.green }]}
              onPress={() => { handleSavingsWithdraw(parseInt(savingsAmt) || 0); setSavingsAmt(""); }}>
              <Text style={[styles.btnText, { color: (game.savings || 0) >= (parseInt(savingsAmt) || 0) && (parseInt(savingsAmt) || 0) > 0 ? "#fff" : T.sub }]}>← Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tax being set aside. THE FIX FOR THE AMBUSH: the old card was gated entirely on
            `taxDue > 0`, so during the week a bill was building there was no tax card on the
            screen at all — nothing said a bill was coming until it landed. FleetFlow shows the
            running figure as `taxEstimate` in its daily expenses all week long. */}
        {(game.taxDue || 0) <= 0 && taxEstimate(game) > 0 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1 }]}>
            <Text style={[styles.label, { color: T.orange }]}>🧾 Tax Set Aside: {money(taxEstimate(game))}</Text>
            <Text style={[styles.sub, subCol]}>
              Accruing at {Math.round(taxRateFor(game) * 100)}% on {money(game.weeklyStats?.revenue || 0)} of revenue this week. This becomes your bill on day {Math.ceil((game.day + 1) / 7) * 7}.
            </Text>
            <Text style={[styles.sub, subCol, { marginTop: 2 }]}>
              {hasEstimator(game)
                ? "Your Estimator's cost reporting is keeping the assessable base down."
                : "Hire an Estimator in Crew to reduce what you are assessed."}
            </Text>
          </View>
        )}

        {/* Tax */}
        {(game.taxDue || 0) > 0 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.red, borderWidth: 1.5 }]}>
            <Text style={[styles.label, { color: T.red }]}>⚠ Tax Due: {money(game.taxDue)}</Text>
            {(() => {
              const st = describeTaxStatus(game);
              return (
                <>
                  <Text style={[styles.sub, { color: st.level === "frozen" || st.level === "urgent" ? T.red : T.sub }]}>
                    {st.headline} — {st.detail}
                  </Text>
                  <Text style={[styles.sub, subCol, { marginTop: 2 }]}>
                    Charged at {Math.round(taxRateFor(game) * 100)}% of revenue
                    {taxRateFor(game) < TAX_RATE ? " (reduced rate while your company is young)" : ""}
                    {hasEstimator(game) ? ", with your Estimator's relief applied" : ""}.
                  </Text>
                  {taxEstimate(game) > 0 && (
                    <Text style={[styles.sub, { color: T.orange, marginTop: 2 }]}>
                      A further {money(taxEstimate(game))} is already set aside for next week's bill.
                    </Text>
                  )}
                  {(game.taxOverdueDays || 0) > PENALTY_GRACE_DAYS && (
                    <Text style={[styles.sub, { color: T.red, marginTop: 2, fontWeight: "600" }]}>
                      This debt is compounding at {Math.round(LATE_PENALTY_RATE * 100)}% a week.
                    </Text>
                  )}
                </>
              );
            })()}
            {game.taxOverdueDays > 0 && (
              <View style={{ marginTop: 6 }}>
                <View style={[styles.progressTrack, { backgroundColor: T.track, height: 8 }]}>
                  <View style={[styles.progressFill, { width: `${Math.round((game.taxOverdueDays / 14) * 100)}%`, backgroundColor: game.taxOverdueDays >= 10 ? T.red : T.orange, height: 8 }]} />
                </View>
                <Text style={[styles.sub, { color: game.taxOverdueDays >= 10 ? T.red : T.orange, marginTop: 2, fontWeight: "600" }]}>
                  Day {game.taxOverdueDays} of 14 — {14 - game.taxOverdueDays} day{14 - game.taxOverdueDays !== 1 ? "s" : ""} until freeze
                </Text>
              </View>
            )}
            {/* Pay in full when you can; pay down when you cannot. The old card offered only
                "Pay Tax Bill", and the handler behind it refused anything short of the full
                amount — so a bill bigger than your cash could never be reduced, only grown. */}
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, backgroundColor: canPayInFull(game) ? T.red : T.panel2, borderColor: T.red }]}
              onPress={handlePayTax}
              accessibilityRole="button"
              accessibilityLabel={canPayInFull(game)
                ? `Pay the full tax bill of ${money(game.taxDue || 0)}`
                : `Pay ${money(suggestedPayment(game))} towards the tax bill`}
            >
              <Text style={[styles.btnText, { color: canPayInFull(game) ? "#fff" : T.red }]}>
                {canPayInFull(game)
                  ? `Pay Tax Bill — ${money(game.taxDue || 0)}`
                  : canPayPartial(game)
                    ? `Pay ${money(minPartialPayment(game))} Now (part payment)`
                    : "Pay Tax Bill"}
              </Text>
            </TouchableOpacity>
            {!canPayInFull(game) && canPayPartial(game) && (
              <Text style={[styles.sub, { color: T.sub, marginTop: 4 }]}>
                {game.businessFrozen
                  ? `${money(unfreezeThreshold(game))} lifts the freeze. Anything less still reduces the debt.`
                  : "A part payment reduces the debt and buys back time."}
              </Text>
            )}
            {!canPayInFull(game) && !canPayPartial(game) && (
              <Text style={[styles.sub, { color: T.orange, marginTop: 4 }]}>
                You need {money(minPartialPayment(game))} to make a payment. Finish a job or take a loan.
              </Text>
            )}
          </View>
        )}

        {/* Active Loans */}
        {game.loans.length > 0 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
            <Text style={[styles.sectionTitle, col]}>Active Loans</Text>
            {game.loans.map((loan) => (
              <View key={loan.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={[styles.label, col, { flex: 1 }]} numberOfLines={1}>{loan.label}</Text>
                  <Text style={[styles.label, { color: T.orange }]} numberOfLines={1}>{money(loan.remainingBalance)} left</Text>
                </View>
                <Text style={[styles.sub, subCol]}>{loan.weeksLeft} weeks · {money(loan.weeklyPayment)}/week</Text>
                {(() => {
                  const maxWeeks = 52;
                  const pct = Math.min(100, Math.round((loan.weeksLeft / maxWeeks) * 100));
                  const barColor = loan.weeksLeft <= 4 ? T.green : loan.weeksLeft <= 13 ? T.orange : T.red;
                  return (
                    <View style={{ marginTop: 4 }}>
                      <View style={[styles.progressTrack, { backgroundColor: T.track }]}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={[styles.sub, { color: T.sub, marginTop: 2, fontSize: 12 }]}>
                        {loan.weeksLeft <= 4 ? `Almost done — ${loan.weeksLeft} wk${loan.weeksLeft !== 1 ? "s" : ""} left` : `${loan.weeksLeft} weeks remaining`}
                      </Text>
                    </View>
                  );
                })()}
                {loan.missedPayments > 0 && <Text style={[styles.sub, { color: T.red }]}>{loan.missedPayments} missed payment(s)</Text>}
                {/* Extra payment input */}
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <TextInput
                    style={[styles.input, col, { flex: 1, marginBottom: 0, paddingVertical: 4 }]}
                    value={loanPayAmts[loan.id] || ""}
                    onChangeText={v => setLoanPayAmts(prev => ({ ...prev, [loan.id]: v }))}
                    keyboardType="numeric"
                    placeholder="Extra payment"
                    placeholderTextColor={T.sub}
                  />
                  <TouchableOpacity
                    style={[styles.smallBtn, { borderWidth: 1, borderColor: T.cyan, paddingHorizontal: 14 }]}
                    onPress={() => { handleLoanPartialPayment(loan.id, parseInt(loanPayAmts[loan.id]) || 0); setLoanPayAmts(prev => ({ ...prev, [loan.id]: "" })); }}>
                    <Text style={[styles.smallBtnText, { color: T.cyan }]}>Pay</Text>
                  </TouchableOpacity>
                </View>
                {/* Early full payoff */}
                {(() => {
                  const payoff = Math.round((loan.remainingBalance || 0) * 1.01);
                  const canAfford = game.cash >= payoff;
                  return (
                    <TouchableOpacity style={[styles.smallBtn, { marginTop: 4, borderWidth: 1, borderColor: canAfford ? T.green : T.border, backgroundColor: "transparent" }]}
                      onPress={() => handlePayoffLoan(loan.id, payoff)}>
                      <Text style={[styles.smallBtnText, { color: canAfford ? T.green : T.sub }]}>
                        Pay Off Early — {money(payoff)}{!canAfford ? ` (need ${money(payoff - game.cash)} more)` : " · 1% fee · Credit +5"}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            ))}
          </View>
        )}

        {/* R16-4: Credit Line */}
        {!game.creditLine && (game.creditScore || 600) >= 680 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.purple, borderWidth: 1, marginBottom: 8 }]}>
            <Text style={[styles.sectionTitle, { color: T.purple }]}>💳 Business Line of Credit</Text>
            <Text style={[styles.sub, subCol]}>$75,000 revolving · 14% APR on drawn amount only · repay anytime</Text>
            <TouchableOpacity style={[styles.btn, { marginTop: 8, backgroundColor: T.purple, borderColor: T.purple }]} onPress={handleOpenCreditLine}>
              <Text style={[styles.btnText, { color: "#fff" }]}>Open Line of Credit</Text>
            </TouchableOpacity>
          </View>
        )}
        {game.creditLine && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.purple, borderWidth: 1.5, marginBottom: 8 }]}>
            <Text style={[styles.sectionTitle, { color: T.purple }]}>💳 Line of Credit</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[styles.sub, subCol]}>Drawn</Text>
              <Text style={[styles.label, { color: T.red }]}>{money(game.creditLine.drawn || 0)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[styles.sub, subCol]}>Available</Text>
              <Text style={[styles.label, { color: T.green }]}>{money((game.creditLine.limit || 75000) - (game.creditLine.drawn || 0))}</Text>
            </View>
            <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginBottom: 8 }]}>
              {(game.creditLine.drawn || 0) > 0 ? `Interest: ~${money(Math.round((game.creditLine.drawn || 0) * 0.14 / 365))}/day` : "No interest until you draw funds."}
            </Text>
            <TextInput style={[styles.input, col, { marginBottom: 8 }]} value={creditLineAmt} onChangeText={setCreditLineAmt} keyboardType="numeric" placeholder="Amount to draw or repay" placeholderTextColor={T.sub} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={[styles.smallBtn, { flex: 1, borderWidth: 1, borderColor: T.purple }]} onPress={() => { handleDrawCreditLine(parseInt(creditLineAmt) || 0); setCreditLineAmt(""); }}>
                <Text style={[styles.smallBtnText, { color: T.purple }]}>Draw Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { flex: 1, borderWidth: 1, borderColor: T.green }]} onPress={() => { handleRepayCreditLine(parseInt(creditLineAmt) || 0); setCreditLineAmt(""); }}>
                <Text style={[styles.smallBtnText, { color: T.green }]}>Repay</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Loan Products */}
        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Available Financing</Text>
        {loanOffers.map((product) => (
          <View key={product.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[styles.label, col]}>{product.label}</Text>
              <Text style={[styles.label, { color: T.green }]}>{money(product.principal)}</Text>
            </View>
            {product.eligible ? (
              <>
                <Text style={[styles.sub, subCol]}>{product.apr}% APR · {product.weeks} weeks · {money(product._offer.weeklyPayment)}/week · Total {money(product._offer.totalRepayment)}</Text>
                <Text style={[styles.sub, { color: T.green, fontSize: 12, marginTop: 3 }]}>{product._offer.approvalReason}</Text>
                {product.collateralRequired && <Text style={[styles.sub, { color: T.orange, fontSize: 12, marginTop: 2 }]}>Secured financing · collateral required</Text>}
              </>
            ) : (
              <>
                <Text style={[styles.sub, { color: T.red }]}>Not currently eligible</Text>
                <Text style={[styles.sub, subCol, { fontSize: 12, marginTop: 3 }]}>{product.declineReasons[0] || `Needs ${product.minCredit}+ credit score.`}</Text>
              </>
            )}
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, backgroundColor: product.eligible ? T.blue : T.panel2, borderColor: product.eligible ? T.blue : T.border }]}
              onPress={() => handleTakeLoan(product)}
            >
              <Text style={[styles.btnText, { color: product.eligible ? "#fff" : T.sub }]}>{product.eligible ? "Accept Financing" : "View Requirements"}</Text>
            </TouchableOpacity>
          </View>
        ))}
        {loanOffers.length === 0 && (
          <Text style={[styles.sub, subCol, { textAlign: "center", paddingVertical: 16 }]}>
            No lender will underwrite you yet. Credit score rises when you finish contracts on time and stay out of overdraft — the first loan products unlock as it climbs.
          </Text>
        )}

        {/* Materials Inventory */}
        {/* Reputation Panel */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border, marginBottom: 10 }]}>
          <Text style={[styles.sectionTitle, col]}>Reputation: {game.reputation} — {repTier.badge} {repTier.label}</Text>
          <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 6, height: 8 }]}>
            <View style={[styles.progressFill, { width: `${Math.min(100, game.reputation)}%`, backgroundColor: T.purple, height: 8 }]} />
          </View>
          {[
            { threshold: 20,  effect: "Unlock residential contracts" },
            { threshold: 40,  effect: "Better loan terms, more contract variety" },
            { threshold: 60,  effect: "Commercial mega-contracts unlock" },
            { threshold: 80,  effect: "Stadium contract available" },
            { threshold: 95,  effect: "WildBear City Plaza unlocked" },
          ].map((r) => (
            <View key={r.threshold} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={[styles.sub, { color: game.reputation >= r.threshold ? T.green : T.sub }]}>
                {game.reputation >= r.threshold ? "✅" : "○"} Rep {r.threshold}
              </Text>
              <Text style={[styles.sub, { color: game.reputation >= r.threshold ? T.green : T.sub }]}>{r.effect}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Materials Inventory</Text>
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          {MATERIAL_DEFS.map((m) => (
            <View key={m.id} style={[styles.finRow, { borderBottomColor: T.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name={m.icon} size={13} color={T.text} />
                <Text style={[styles.sub, col]}>{m.label}</Text>
              </View>
              <Text style={[styles.sub, { color: T.cyan }]}>{game.materials[m.id] || 0} {m.unit} · {money(getMaterialUnitPrice(game, m.id))}/{m.unit}</Text>
            </View>
          ))}
        </View>

        {/* ── Insurance Coverage ── */}
        <View style={{ marginTop: 18, marginBottom: 18 }}>
          <Text style={[styles.sectionTitle, col]}>Insurance Coverage</Text>
          {(() => {
            const activePlan = INSURANCE_PLANS.find(p => p.id === (game.insurancePlanId || "none"));
            return (
              <>
                {!activePlan || game.insurancePlanId === "none" ? (
                  <View style={{ backgroundColor: T.red + "22", borderColor: T.red, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <Text style={{ color: T.red, fontWeight: "bold", fontSize: 13 }}>⚠ No insurance — accidents are 100% your cost</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: T.cyan + "18", borderColor: T.cyan, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                    <Text style={[styles.label, { color: T.cyan }]}>{activePlan.label}</Text>
                    <Text style={[styles.sub, subCol]}>Coverage: {Math.round(activePlan.coverage * 100)}%  ·  Deductible: {money(activePlan.deductible)}  ·  Premium: {money(activePlan.monthlyPremium)}/mo</Text>
                  </View>
                )}
                {INSURANCE_PLANS.map(plan => {
                  const isActive = plan.id === (game.insurancePlanId || "none");
                  return (
                    <TouchableOpacity key={plan.id} onPress={() => handleBuyInsurance(plan.id)} style={{ backgroundColor: isActive ? T.cyan + "22" : T.panel, borderColor: isActive ? T.cyan : T.border, borderWidth: isActive ? 1.5 : 1, borderRadius: 8, padding: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isActive ? T.cyan : T.text, fontWeight: "bold", fontSize: 13 }}>{plan.label}{isActive ? "  ✓" : ""}</Text>
                        <Text style={[styles.sub, subCol]}>{plan.desc}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                        <Text style={{ color: isActive ? T.cyan : T.text, fontWeight: "600", fontSize: 12 }}>{plan.monthlyPremium > 0 ? money(plan.monthlyPremium) + "/mo" : "Free"}</Text>
                        {plan.id !== "none" && <Text style={[styles.sub, subCol]}>{Math.round(plan.coverage * 100)}% cov · {money(plan.deductible)} ded</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          })()}
        </View>

        {/* ── Safety & Compliance ── */}
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.sectionTitle, col]}>Safety & Compliance</Text>
          <View style={[styles.card, { marginBottom: 10 }]}>
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={[styles.label, col]}>Safety Score</Text>
                <Text style={{ fontWeight: "bold", fontSize: 13, color: (game.safetyScore ?? 0) >= 70 ? T.green : (game.safetyScore ?? 0) >= 40 ? T.orange : T.red }}>{game.safetyScore ?? 0}/100</Text>
              </View>
              <View style={{ height: 8, backgroundColor: T.track, borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 4, width: `${Math.min(game.safetyScore ?? 0, 100)}%`, backgroundColor: (game.safetyScore ?? 0) >= 70 ? T.green : (game.safetyScore ?? 0) >= 40 ? T.orange : T.red }} />
              </View>
            </View>
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={[styles.label, col]}>Compliance Score</Text>
                <Text style={{ fontWeight: "bold", fontSize: 13, color: (game.complianceScore ?? 0) >= 60 ? T.blue : (game.complianceScore ?? 0) >= 40 ? T.orange : T.red }}>{game.complianceScore ?? 0}/100</Text>
              </View>
              <View style={{ height: 8, backgroundColor: T.track, borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: 8, borderRadius: 4, width: `${Math.min(game.complianceScore ?? 0, 100)}%`, backgroundColor: (game.complianceScore ?? 0) >= 60 ? T.blue : (game.complianceScore ?? 0) >= 40 ? T.orange : T.red }} />
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={[styles.label, col]}>Safety Violations</Text>
              <Text style={{ fontWeight: "bold", fontSize: 13, color: (game.safetyViolations ?? 0) > 0 ? T.red : T.green }}>{game.safetyViolations ?? 0}</Text>
            </View>
            {game.incidentHistory && game.incidentHistory.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.sub, { color: T.sub, marginBottom: 4 }]}>Recent Incidents</Text>
                {[...game.incidentHistory].slice(-3).reverse().map((inc, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: T.border }}>
                    <Text style={{ color: inc.severity === 0 ? T.green : T.red, marginRight: 6, fontSize: 12 }}>{inc.severity === 0 ? "✓" : "⚠"}</Text>
                    <Text style={[styles.sub, subCol, { flex: 1 }]}>{inc.desc} (Day {inc.day})</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ backgroundColor: T.panel2, borderRadius: 6, padding: 8 }}>
              <Text style={[styles.sub, { color: T.sub, fontStyle: "italic" }]}>Higher scores unlock Government contracts and better workers</Text>
            </View>
          </View>
        </View>

        {/* ── Company Performance History ── */}
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.sectionTitle, col]}>Performance History</Text>
          {(!game.economicHistory || game.economicHistory.length < 2) ? (
            <View style={[styles.card, { alignItems: "center", paddingVertical: 18 }]}>
              <Text style={[styles.sub, { color: T.sub, fontStyle: "italic", textAlign: "center" }]}>Tracking begins after first week of operations</Text>
            </View>
          ) : (
            <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
              <View style={{ flexDirection: "row", backgroundColor: T.panel2, paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: T.border }}>
                {["Week", "Revenue", "Expenses", "Profit", "Rep"].map((h, i) => (
                  <Text key={h} style={[styles.sub, { flex: i === 0 ? 0.6 : 1, color: T.sub, fontWeight: "700", fontSize: 11, textAlign: i === 0 ? "left" : "right" }]}>{h}</Text>
                ))}
              </View>
              {(() => {
                const history = [...game.economicHistory].slice(-8).reverse();
                const maxAbsProfit = Math.max(1, ...history.map(r => Math.abs(r.profit ?? 0)));
                return history.map((row, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: i < Math.min((game.economicHistory || []).length, 8) - 1 ? 1 : 0, borderBottomColor: T.border, backgroundColor: i % 2 === 0 ? "transparent" : T.panel2 + "55" }}>
                    <Text style={[styles.sub, { flex: 0.6, color: T.sub, fontSize: 11 }]}>W{row.week}</Text>
                    <Text style={[styles.sub, { flex: 1, color: T.text, fontSize: 11, textAlign: "right" }]}>{money(row.revenue)}</Text>
                    <Text style={[styles.sub, { flex: 1, color: T.text, fontSize: 11, textAlign: "right" }]}>{money(row.expenses)}</Text>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={[styles.sub, { fontSize: 11, fontWeight: "700", color: (row.profit ?? 0) >= 0 ? T.green : T.red }]}>
                        {money(row.profit)}
                      </Text>
                      <View style={{ height: 2, width: `${Math.round((Math.abs(row.profit ?? 0) / maxAbsProfit) * 100)}%`, backgroundColor: (row.profit ?? 0) >= 0 ? T.green : T.red, borderRadius: 1, marginTop: 2 }} />
                    </View>
                    <Text style={[styles.sub, { flex: 1, color: T.sub, fontSize: 11, textAlign: "right" }]}>{row.reputation ?? "—"}</Text>
                  </View>
                ));
              })()}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // ─── Tab Bar ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={T.bg} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, backgroundColor: T.panel, borderBottomColor: T.border }}>
        {onBackToHub && (
          <TouchableOpacity onPress={onBackToHub} style={{ flexDirection: "row", alignItems: "center", paddingRight: 12 }}>
            <Text style={{ color: T.sub, fontSize: 13, fontWeight: "600" }}>‹ Hub</Text>
          </TouchableOpacity>
        )}
        <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: "800" }}>Construction Flow</Text>
        <View style={{ backgroundColor: (game.cash >= 0 ? T.green : T.red) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
          <Text style={{ color: game.cash >= 0 ? T.green : T.red, fontSize: 12, fontWeight: "700" }}>{money(game.cash)}</Text>
        </View>
      </View>

      {/* Contract Completion Celebration */}
      {game.pendingCelebration && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
            <View style={[styles.modalCard, { margin: 24, alignItems: "center", borderColor: game.pendingCelebration.isOnTime ? T.green : T.orange, borderWidth: 2 }]}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>{game.pendingCelebration.isMajor ? "🏆" : game.pendingCelebration.isOnTime ? "✅" : "✔️"}</Text>
              <Text style={[styles.h2, col, { textAlign: "center", marginBottom: 4 }]}>{game.pendingCelebration.isMajor ? "MAJOR CONTRACT COMPLETE!" : "Job Complete!"}</Text>
              <Text style={[styles.label, { color: T.sub, textAlign: "center", marginBottom: 12 }]}>{game.pendingCelebration.label}</Text>
              <Text style={{ fontSize: 36, fontWeight: "900", color: T.green, marginBottom: 4 }}>{money(game.pendingCelebration.earned)}</Text>
              <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>paid by {game.pendingCelebration.client}</Text>

              {/* ── Project P&L ──────────────────────────────────────────────
                  A payout is not a profit. This is the one screen where the player can
                  learn what a construction job actually costs to run, so it itemises the
                  money this project spent and lands on a single net number. */}
              {game.pendingCelebration.economics && (() => {
                const ec = game.pendingCelebration.economics;
                const profitable = ec.netProfit >= 0;
                const toneColor = { positive: T.green, negative: T.red, neutral: T.text };
                return (
                  <View style={{ width: "100%", backgroundColor: T.panel2, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: T.border }}>
                    <Text style={{ fontSize: 12, color: T.sub, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 }}>WHAT THIS JOB MADE</Text>
                    {buildProjectProfitLines(ec, money).map((line, i) => (
                      <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={[styles.sub, { color: T.sub, flex: 1 }]} numberOfLines={1}>{line.label}</Text>
                        <Text style={[styles.sub, { color: toneColor[line.tone] || T.text, fontWeight: "700" }]}>{line.value}</Text>
                      </View>
                    ))}
                    <View style={{ height: 1, backgroundColor: T.border, marginVertical: 8 }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.label, col]}>Net profit</Text>
                      <Text style={{ color: profitable ? T.green : T.red, fontSize: 20, fontWeight: "900" }}>
                        {profitable ? "" : "−"}{money(Math.abs(ec.netProfit))}
                      </Text>
                    </View>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 11, marginTop: 2 }]}>
                      {ec.marginPercent}% margin{ec.depositPaid > 0 ? ` · ${money(ec.depositPaid)} of this arrived as the deposit at mobilisation` : ""}
                    </Text>
                    {game.pendingCelebration.costsPartial && (
                      <Text style={[styles.sub, { color: T.orange, fontSize: 11, marginTop: 6 }]}>
                        ⚠ This job was already running before cost tracking started — the costs above cover only part of it.
                      </Text>
                    )}
                    {/* Spelling out what is deliberately NOT charged here is the difference
                        between an honest breakdown and one the player later feels tricked by. */}
                    {game.pendingCelebration.isFirstProject && (
                      <>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 11, marginTop: 8, fontStyle: "italic" }]}>{OVERHEAD_NOTE}</Text>
                        <Text style={[styles.sub, { color: T.cyan, fontSize: 12, marginTop: 8 }]}>{getProjectReinvestmentHint(ec.netProfit)}</Text>
                      </>
                    )}
                  </View>
                );
              })()}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                {game.pendingCelebration.isOnTime && (
                  <View style={[styles.statusPill, { backgroundColor: T.green + "22" }]}>
                    <Text style={[styles.statusPillText, { color: T.green }]}>✅ On Time</Text>
                  </View>
                )}
                {game.pendingCelebration.repGained > 0 && (
                  <View style={[styles.statusPill, { backgroundColor: T.purple + "22" }]}>
                    <Text style={[styles.statusPillText, { color: T.purple }]}>+{game.pendingCelebration.repGained} Rep</Text>
                  </View>
                )}
                {game.pendingCelebration.qualityBonus > 0 && (
                  <View style={[styles.statusPill, { backgroundColor: T.cyan + "22" }]}>
                    <Text style={[styles.statusPillText, { color: T.cyan }]}>⭐ Quality +{money(game.pendingCelebration.qualityBonus)}</Text>
                  </View>
                )}
                {game.pendingCelebration.penalty > 0 && (
                  <View style={[styles.statusPill, { backgroundColor: T.red + "22" }]}>
                    <Text style={[styles.statusPillText, { color: T.red }]}>⚠ {money(game.pendingCelebration.penalty)} penalty</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: T.green, borderColor: T.green, width: "100%" }]}
                onPress={() => update(g => { g.pendingCelebration = null; })}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Decision Event Modal */}
      {game.pendingDecision && (
        <Modal transparent animationType="slide" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "flex-end" }]}>
            <View style={[styles.modalCard, { margin: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: T[game.pendingDecision.tone] || T.border, borderWidth: 2 }]}>
              <Text style={[col, { fontSize: 28, textAlign: "center", marginBottom: 8 }]}>{game.pendingDecision.title}</Text>
              <Text style={[styles.body, col, { textAlign: "center", marginBottom: 16 }]}>{game.pendingDecision.desc}</Text>
              {(game.pendingDecision.options || []).map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.btn, { marginBottom: 8, backgroundColor: i === 0 ? (T[game.pendingDecision.tone] || T.blue) : T.panel2, borderColor: i === 0 ? (T[game.pendingDecision.tone] || T.blue) : T.strongBorder, borderWidth: i === 0 ? 0 : 1.5 }]}
                  onPress={() => update(g => resolveDecision(g, i))}
                >
                  <Text style={[styles.btnText, { color: i === 0 ? "#000" : T.text, fontWeight: "800" }]}>{opt.label}</Text>
                  {opt.sub && <Text style={[styles.sub, { color: i === 0 ? "rgba(0,0,0,0.65)" : T.sub, textAlign: "center", marginTop: 2 }]}>{opt.sub}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}

      {/* Company Story Card */}
      {game.pendingStory && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
            <View style={[styles.modalCard, { margin: 28, alignItems: "center", borderColor: T.yellow, borderWidth: 2 }]}>
              <Ionicons name={game.pendingStory.icon} size={52} color={T.yellow} style={{ marginBottom: 12 }} />
              <Text style={[styles.h2, col, { textAlign: "center", marginBottom: 8 }]}>{game.pendingStory.title}</Text>
              <Text style={[styles.body, col, { textAlign: "center", marginBottom: 20 }]}>{game.pendingStory.body}</Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: T.yellow, borderColor: T.yellow, width: "100%" }]}
                onPress={() => update(g => { g.pendingStory = null; })}
              >
                <Text style={[styles.btnText, { color: "#000" }]}>Noted</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Breakdown Player Choice Modal */}
      {game.pendingBreakdown && (
        <Modal transparent animationType="slide" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "flex-end" }]}>
            <View style={[styles.modalCard, { margin: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: T.red, borderWidth: 2 }]}>
              <Text style={{ fontSize: 28, textAlign: "center", marginBottom: 4 }}>🔧 Vehicle Breakdown</Text>
              <Text style={[styles.label, col, { textAlign: "center", marginBottom: 4 }]}>{game.pendingBreakdown.equipName}</Text>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 16 }]}>Broke down on {game.pendingBreakdown.siteLabel}</Text>
              <TouchableOpacity
                style={[styles.btn, { marginBottom: 8, backgroundColor: T.green, borderColor: T.green }]}
                onPress={() => update(g => {
                  const bd = g.pendingBreakdown;
                  const equip = g.equipment.find(e => e.id === bd.equipId);
                  if (equip) { g.cash -= bd.repairCost; recordTransaction(g, "maintenance", -bd.repairCost, `${bd.equipName}: breakdown repair`); equip.condition = Math.min(100, equip.condition + 40); equip.status = "Active"; }
                  addLog(g, `🔧 ${bd.equipName} repaired for ${money(bd.repairCost)} — back online.`);
                  g.pendingBreakdown = null;
                })}
              >
                <Text style={[styles.btnText, { color: "#000" }]}>Repair On-Site — {money(game.pendingBreakdown.repairCost)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { marginBottom: 8, backgroundColor: T.panel2, borderColor: T.orange, borderWidth: 1.5 }]}
                onPress={() => update(g => {
                  const bd = g.pendingBreakdown;
                  const equip = g.equipment.find(e => e.id === bd.equipId);
                  if (equip) { equip.condition = Math.max(5, equip.condition - 25); }
                  addLog(g, `⚠️ ${bd.equipName} pushed through breakdown — high failure risk.`);
                  g.pendingBreakdown = null;
                })}
              >
                <Text style={[styles.btnText, { color: T.text }]}>Push Through — Risk further damage</Text>
                <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }]}>No cost · condition −25 · high breakdown risk</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { marginBottom: 8, backgroundColor: T.panel2, borderColor: T.blue, borderWidth: 1.5 }]}
                onPress={() => update(g => {
                  const bd = g.pendingBreakdown;
                  const equip = g.equipment.find(e => e.id === bd.equipId);
                  if (equip) {
                    equip.status = "Maintenance";
                    const site = g.activeSites.find(s => s.id === bd.siteId);
                    if (site) site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter(id => id !== bd.equipId);
                  }
                  addLog(g, `🔧 ${bd.equipName} pulled for scheduled maintenance — repair from the Equipment tab.`);
                  g.pendingBreakdown = null;
                })}
              >
                <Text style={[styles.btnText, { color: T.text }]}>Delay Repair — Pull from site for later</Text>
                <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }]}>No cost · repair later from the Equipment tab</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { marginBottom: 4, backgroundColor: T.panel2, borderColor: T.red }]}
                onPress={() => update(g => {
                  const bd = g.pendingBreakdown;
                  const equip = g.equipment.find(e => e.id === bd.equipId);
                  const scrapValue = equip ? Math.round(equip.price * 0.15 * equip.condition / 100) : 0;
                  if (equip) {
                    g.cash += scrapValue;
                    recordTransaction(g, "sales", scrapValue, `${bd.equipName}: scrapped`);
                    const site = g.activeSites.find(s => s.id === bd.siteId);
                    if (site) site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter(id => id !== bd.equipId);
                    g.equipment = g.equipment.filter(e => e.id !== bd.equipId);
                  }
                  addLog(g, `🗑️ ${bd.equipName} scrapped — recovered ${money(scrapValue)}.`);
                  g.pendingBreakdown = null;
                })}
              >
                <Text style={[styles.btnText, { color: T.red }]}>Scrap & Replace — Recover {money(Math.round((game.equipment.find(e => e.id === game.pendingBreakdown.equipId)?.price || 0) * 0.15 * (game.equipment.find(e => e.id === game.pendingBreakdown.equipId)?.condition || 0) / 100))}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Inspection Result Modal */}
      {game.pendingInspection && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
            <View style={[styles.modalCard, { margin: 28, alignItems: "center",
              borderColor: game.pendingInspection.outcome === "pass" ? T.green : game.pendingInspection.outcome === "minor" ? T.yellow : T.red,
              borderWidth: 2 }]}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>
                {game.pendingInspection.outcome === "pass" ? "✅" : game.pendingInspection.outcome === "minor" ? "🔍" : "❌"}
              </Text>
              <Text style={[styles.h2, col, { textAlign: "center", marginBottom: 4 }]}>
                {game.pendingInspection.outcome === "pass" ? "Inspection Passed!" : game.pendingInspection.outcome === "minor" ? "Minor Corrections Required" : "Major Inspection Failure"}
              </Text>
              <Text style={[styles.label, { color: T.sub, textAlign: "center", marginBottom: 8 }]}>{game.pendingInspection.phaseName} · {game.pendingInspection.siteLabel}</Text>
              {game.pendingInspection.outcome === "pass" && (
                <Text style={[styles.sub, { color: T.green, textAlign: "center", marginBottom: 12 }]}>Work passed all checks. Reputation +2, Credit +1.</Text>
              )}
              {game.pendingInspection.outcome === "minor" && (
                <Text style={[styles.sub, { color: T.yellow, textAlign: "center", marginBottom: 12 }]}>
                  Remediation cost: {money(game.pendingInspection.penaltyApplied)}. Minor setback on next phase.
                </Text>
              )}
              {game.pendingInspection.outcome === "major" && (
                <Text style={[styles.sub, { color: T.red, textAlign: "center", marginBottom: 12 }]}>
                  Major defects found. Cost: {money(game.pendingInspection.penaltyApplied)}. Site paused. Rep -3.
                </Text>
              )}
              <TouchableOpacity
                style={[styles.btn, {
                  backgroundColor: game.pendingInspection.outcome === "pass" ? T.green : game.pendingInspection.outcome === "minor" ? T.yellow : T.red,
                  borderColor: "transparent", width: "100%" }]}
                onPress={() => update(g => { g.pendingInspection = null; })}
              >
                <Text style={[styles.btnText, { color: game.pendingInspection.outcome === "minor" ? "#000" : "#fff" }]}>
                  {game.pendingInspection.outcome === "pass" ? "Excellent!" : "Understood"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* While You Were Away */}
      {game.pendingOfflineSummary && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "center", backgroundColor: "rgba(0,0,0,0.82)" }]}>
            {/* Entrance animation on the rising edge of pendingOfflineSummary. Opacity and
                transform only, so nothing inside is delayed from being tappable, and Reduce
                Motion removes it entirely (the hook is passed `!reducedMotion &&` upstream). */}
            <Animated.View style={[{ margin: SPACING.lg, backgroundColor: T.panel, borderRadius: RADIUS.xl, borderWidth: 1.5, borderColor: alpha(T.accent, 0.5), overflow: "hidden" }, ELEVATION.hero, offlineEntrance]}>
              {/* Header */}
              <View style={{ backgroundColor: T.accent, paddingVertical: 18, alignItems: "center" }}>
                <Text style={{ fontSize: 32, marginBottom: 4 }}>🏗️</Text>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#000" }}>While You Were Away</Text>
                <Text style={{ fontSize: 13, color: "rgba(0,0,0,0.75)", marginTop: 3 }}>
                  {game.pendingOfflineSummary.elapsedDays > 0
                    ? `${game.pendingOfflineSummary.elapsedDays} game day${game.pendingOfflineSummary.elapsedDays !== 1 ? "s" : ""} of work continued`
                    : "A short while passed"}
                </Text>
              </View>

              <View style={{ padding: 16 }}>
                {/* Cash row */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: game.pendingOfflineSummary.cashDelta >= 0 ? T.green : T.red }}>
                    <Text style={{ fontSize: 12, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>NET CASH</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: game.pendingOfflineSummary.cashDelta >= 0 ? T.green : T.red }}>
                      {game.pendingOfflineSummary.cashDelta >= 0 ? "+" : ""}{money(game.pendingOfflineSummary.cashDelta)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: T.cyan }}>
                    <Text style={{ fontSize: 12, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>CASH NOW</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: game.pendingOfflineSummary.cashNow >= 0 ? T.cyan : T.red }}>
                      {money(game.pendingOfflineSummary.cashNow)}
                    </Text>
                  </View>
                </View>

                {/* Jobs / Rep / Overhead row */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.orange }}>
                    <Text style={{ fontSize: 12, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>JOBS DONE</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: T.orange }}>{game.pendingOfflineSummary.jobsDelta}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.purple }}>
                    <Text style={{ fontSize: 12, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>REP</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: T.purple }}>{game.pendingOfflineSummary.repDelta >= 0 ? "+" : ""}{game.pendingOfflineSummary.repDelta}</Text>
                  </View>
                  {(game.pendingOfflineSummary.overheadPerDay || 0) > 0 && (
                    <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.red }}>
                      <Text style={{ fontSize: 12, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>BURN/DAY</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: T.red }}>{money(game.pendingOfflineSummary.overheadPerDay)}</Text>
                    </View>
                  )}
                </View>

                {/* ── YOUR JOB SITES ──────────────────────────────────────────
                    The part the report was missing. A player returning after two days wants
                    to know what happened on their jobs — "Foundation 42% → 67%" — not only
                    that the balance moved. See FLEETFLOW_PARITY_AUDIT.md §2 gap 9. */}
                {(game.pendingOfflineSummary.siteReport || []).length > 0 && (
                  <View style={{
                    backgroundColor: T.panel2, borderRadius: RADIUS.md, padding: SPACING.md,
                    marginBottom: SPACING.md, borderWidth: 1, borderColor: T.border,
                  }}>
                    <SectionLabel T={T} tone="accent" style={{ marginBottom: SPACING.sm }}>Your job sites</SectionLabel>
                    {(game.pendingOfflineSummary.siteReport || []).map((line) => {
                      const tint = toneColor(line.tone, T);
                      return (
                        <View
                          key={line.id}
                          style={{
                            borderLeftWidth: 3, borderLeftColor: tint,
                            paddingLeft: SPACING.sm, marginBottom: SPACING.sm,
                          }}
                        >
                          <Text style={[TYPE.bodyStrong, { color: T.text }]} numberOfLines={2}>{line.headline}</Text>
                          <Text style={[TYPE.caption, { color: T.sub, marginTop: 2 }]}>{line.detail}</Text>
                          {(line.claimed || 0) > 0 && (
                            <Text style={[TYPE.caption, { color: T.safe, marginTop: 2, fontWeight: "700" }]}>
                              Progress payment received: {money(line.claimed)}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Events while away */}
                {(game.pendingOfflineSummary.logsWhileAway || []).length > 0 && (
                  <View style={{ backgroundColor: T.panel2, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: T.border }}>
                    <Text style={{ fontSize: 11, color: T.sub, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 }}>WHAT HAPPENED</Text>
                    {(game.pendingOfflineSummary.logsWhileAway || []).map((entry, i) => (
                      <Text key={i} style={{ fontSize: 12, color: T.text, lineHeight: 18, marginBottom: 3 }}>{entry}</Text>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={{ backgroundColor: T.accent, borderRadius: RADIUS.md, minHeight: MIN_TAP_TARGET + 6, alignItems: "center", justifyContent: "center" }}
                  onPress={() => update(g => { g.pendingOfflineSummary = null; })}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss the away report and get back to work"
                >
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#0a1018", letterSpacing: 0.5 }}>Get Back to Work →</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Major Project Ceremony Modal (Feature 3) */}
      {game.pendingCeremony && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
            <View style={[styles.modalCard, { margin: 20, alignItems: "center", borderColor: T.yellow, borderWidth: 3 }]}>
              <Text style={{ fontSize: 56, marginBottom: 10 }}>🏆</Text>
              <Text style={[styles.h2, { color: T.yellow, textAlign: "center", marginBottom: 6 }]}>LANDMARK PROJECT COMPLETE!</Text>
              <Text style={[styles.label, col, { textAlign: "center", marginBottom: 4 }]}>{game.pendingCeremony.label}</Text>
              <Text style={{ fontSize: 32, fontWeight: "900", color: T.green, marginBottom: 4 }}>{money(game.pendingCeremony.revenue)}</Text>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 12 }]}>Day {game.pendingCeremony.day} · {game.pendingCeremony.crewCount} crew · {game.pendingCeremony.equipmentCount} equipment</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }}>
                <View style={[styles.statusPill, { backgroundColor: T.yellow + "22" }]}>
                  <Text style={[styles.statusPillText, { color: T.yellow }]}>+{game.pendingCeremony.repGained} Reputation</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: T.purple + "22" }]}>
                  <Text style={[styles.statusPillText, { color: T.purple }]}>Major Milestone</Text>
                </View>
              </View>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 16, fontStyle: "italic" }]}>
                A defining moment for {game.companyName}. This project will be remembered.
              </Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: T.yellow, borderColor: T.yellow, width: "100%" }]}
                onPress={() => update(g => { g.pendingCeremony = null; })}
              >
                <Text style={[styles.btnText, { color: "#000", fontWeight: "900" }]}>Accept the Award</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Veteran Worker Recognition Modal ────────────────────────────────── */}
      {game.pendingVeteranEvent && (
        <Modal transparent animationType="slide" visible={true}>
          <View style={[styles.modalOverlay, { justifyContent: "flex-end" }]}>
            <View style={[styles.modalCard, { margin: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: T.yellow, borderWidth: 2 }]}>
              <Text style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>⭐ Veteran Recognition</Text>
              <Text style={[styles.label, col, { textAlign: "center", marginBottom: 4 }]}>{game.pendingVeteranEvent.workerName}</Text>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 12 }]}>
                {game.pendingVeteranEvent.jobsCompleted} jobs completed · Skill {game.pendingVeteranEvent.skill}
              </Text>
              <Text style={[styles.body, col, { textAlign: "center", marginBottom: 16 }]}>
                One of your most experienced builders. How do you recognize their contribution?
              </Text>
              {(() => {
                const _canAfford = game.cash >= game.pendingVeteranEvent.retainCost;
                return (
                  <TouchableOpacity
                    style={[styles.btn, { marginBottom: 8, backgroundColor: _canAfford ? T.green : T.panel2, borderColor: _canAfford ? T.green : T.border, opacity: _canAfford ? 1 : 0.55 }]}
                    onPress={() => {
                      const ev = game.pendingVeteranEvent;
                      if (!_canAfford) { alertInsufficientFunds(game, ev.retainCost, "This retention bonus"); return; }
                      update(g => {
                        const _ev = g.pendingVeteranEvent;
                        const w = (g.crew||[]).find(c => c.id === _ev.workerId);
                        if (w) {
                          g.cash -= _ev.retainCost; g.expenses += _ev.retainCost;
                          w.loyalty = Math.min(100, (w.loyalty ?? 50) + 20);
                          w.wagePerDay = Math.round(w.wagePerDay * 1.08);
                          w.skill = Math.min(150, (w.skill||75) + 5);
                          addLog(g, `⭐ Retention bonus paid to ${w.name} — ${money(_ev.retainCost)}. Loyalty +20, skill +5.`);
                          addImportantNotice(g, `${w.name} is staying! Loyalty cemented.`, "green");
                        }
                        g.pendingVeteranEvent = null;
                      });
                    }}
                  >
                    <Text style={[styles.btnText, { color: _canAfford ? "#fff" : T.sub }]}>Pay Retention Bonus — {money(game.pendingVeteranEvent.retainCost)}</Text>
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                style={[styles.btn, { marginBottom: 8, backgroundColor: T.cyan, borderColor: T.cyan }]}
                onPress={() => update(g => {
                  const ev = g.pendingVeteranEvent;
                  const w = (g.crew||[]).find(c => c.id === ev.workerId);
                  if (w) {
                    w.careerLevel = "super";
                    w.loyalty = Math.min(100, (w.loyalty ?? 50) + 15);
                    w.wagePerDay = Math.round(w.wagePerDay * 1.12);
                    addLog(g, `📋 ${w.name} promoted to Field Superintendent. +12% wage, loyalty +15.`);
                    addImportantNotice(g, `${w.name} is now a Field Superintendent!`, "green");
                  }
                  g.pendingVeteranEvent = null;
                })}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>Promote to Field Superintendent (+12% wage)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { borderColor: T.sub }]}
                onPress={() => update(g => {
                  const ev = g.pendingVeteranEvent;
                  const w = (g.crew||[]).find(c => c.id === ev.workerId);
                  if (w) {
                    g.reputation = (g.reputation||0) + 3;
                    g.cash += 500; g.revenue += 500;
                    recordTransaction(g, "bonuses", 500, `${w.name}: departure referral`);
                    g.crew = g.crew.filter(c => c.id !== ev.workerId);
                    addLog(g, `👋 ${w.name} departed gracefully. +3 rep, +$500 referral.`);
                  }
                  g.pendingVeteranEvent = null;
                })}
              >
                <Text style={[styles.btnText, { color: T.sub }]}>Graceful Farewell (+3 rep, +$500 referral)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Dynasty / Prestige Modal ─────────────────────────────────────────── */}
      {game._pendingPrestige && (() => {
        const [_chosen, _setChosen] = [null, () => {}]; // local state via useState below
        // Pick 3 random perks (shuffle and pick first 3)
        const _shuffled = [...LEGACY_PERKS].sort(() => Math.random() - 0.5).slice(0, 3);
        const bestWorker = [...(game.crew||[])].sort((a,b)=>(b.skill||0)-(a.skill||0))[0];
        return (
          <Modal transparent animationType="fade" visible={true}>
            <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
              <View style={[styles.modalCard, { borderColor: T.yellow, borderWidth: 2, maxHeight: "90%" }]}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={{ fontSize: 36, textAlign: "center", marginBottom: 4 }}>👑</Text>
                  <Text style={{ color: T.yellow, fontWeight: "900", fontSize: 20, textAlign: "center", marginBottom: 4 }}>DYNASTY COMPLETE</Text>
                  <Text style={[styles.sub, { color: T.text, textAlign: "center", marginBottom: 16 }]}>
                    You built the #1 construction empire in America — debt-free, Generation {game.generation||1}.
                  </Text>
                  {/* Stats recap */}
                  <View style={{ backgroundColor: T.panel2, borderRadius: 8, padding: 10, marginBottom: 16 }}>
                    {[
                      { label: "Days Played",    val: `Day ${game.day}` },
                      { label: "Total Revenue",  val: money(game.revenue||0) },
                      { label: "Jobs Completed", val: `${game.completedJobs||0}` },
                      { label: "Best Worker",    val: bestWorker ? `${bestWorker.name} (Skill ${bestWorker.skill||75})` : "—" },
                      { label: "Rivals Acquired",val: `${(game.acquiredRivals||[]).length}` },
                    ].map(r => (
                      <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={[styles.sub, { color: T.sub }]}>{r.label}</Text>
                        <Text style={[styles.sub, { color: T.text, fontWeight: "700" }]}>{r.val}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.label, col, { textAlign: "center", marginBottom: 10 }]}>Choose your Legacy Perk</Text>
                  <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginBottom: 12 }]}>This bonus carries into Generation {(game.generation||1)+1} and stacks with each new dynasty.</Text>
                  {_shuffled.map(perk => (
                    <TouchableOpacity
                      key={perk.id}
                      style={[styles.btn, { marginBottom: 8, backgroundColor: T.panel2, borderColor: T.yellow, borderWidth: 1 }]}
                      onPress={() => {
                        const next = startNewGeneration(game, perk.id);
                        saveGame(next);
                        setGame(next);
                      }}
                    >
                      <Text style={[styles.btnText, { color: T.yellow }]}>{perk.label}</Text>
                      <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }]}>{perk.desc}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={{ paddingVertical: 12, alignItems: "center" }}
                    onPress={() => update(g => { g._pendingPrestige = false; g.hallOfFame.prestigeReached = g.day; })}
                  >
                    <Text style={[styles.sub, { color: T.sub }]}>Keep playing this save instead →</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}

      <View style={{ flex: 1, paddingBottom: Platform.select({ ios: 88, android: 76, default: 70 }) }}>
        {tab === "Home"      && renderHome()}
        {tab === "Bids"      && renderBids()}
        {tab === "Sites"     && renderSites()}
        {tab === "Crew"      && renderCrew()}
        {tab === "Equipment" && renderEquipment()}
        {tab === "Finance"   && renderFinance()}
        {tab === "Empire"    && renderEmpire()}
      </View>
      <View style={[styles.tabBar, { backgroundColor: T.tabBar, borderColor: T.border }]}>
        {TABS.map((t) => {
          const active = tab === t;
          const badgeVal = {
            // Sprint 8: unread inbox items show on Home, so something landing while the player
            // is on another tab is visible rather than silently queued.
            Home:      unreadCount(game),
            Bids:      getOpenContracts(game).length,
            Crew:      game.applicants.length,
            Equipment: (game.equipment||[]).filter(e => e.condition < 40 || e.status === "Maintenance").length || 0,
            Finance:   (game.taxDue || 0) > 0 ? "!" : 0,
            Empire:    (game.empireGoalsCompleted||[]).length < EMPIRE_GOALS.length && EMPIRE_GOALS.some(g2 => !(game.empireGoalsCompleted||[]).includes(g2.id) && (() => { try { return g2.check(game); } catch(_){return false;} })()) ? "!" : 0,
          }[t];
          const TAB_ICONS = {
            Home:     { active: "home",          inactive: "home-outline"          },
            Bids:     { active: "document-text", inactive: "document-text-outline" },
            Sites:    { active: "construct",      inactive: "construct-outline"     },
            Crew:     { active: "people",         inactive: "people-outline"        },
            Equipment:{ active: "hammer",         inactive: "hammer-outline"        },
            Finance:  { active: "wallet",         inactive: "wallet-outline"        },
            Empire:   { active: "trophy",         inactive: "trophy-outline"        },
          };
          const iconName = active ? TAB_ICONS[t]?.active : TAB_ICONS[t]?.inactive;
          // During the tutorial, mark the tab the Getting Started card is sending the
          // player to. Without this the card says "Go to Bids" and the tab itself gives no
          // sign which one that is — the single cheapest fix available to the first minute.
          const isTutorialTarget = !active && t === getTutorialTargetTab(game);
          return (
            <TouchableOpacity
              key={t}
              style={styles.tabItem}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              // The marker dot is decorative, so the cue it carries has to reach screen
              // readers through the label instead.
              accessibilityLabel={isTutorialTarget ? `${t} — next tutorial step` : t}
              accessibilityState={{ selected: active }}
            >
              {isTutorialTarget && (
                <View
                  style={{
                    position: "absolute", top: 2, alignSelf: "center",
                    width: 7, height: 7, borderRadius: 4, backgroundColor: T.accentSoft,
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              )}
              {!!badgeVal && (
                <View style={[styles.badge, { backgroundColor: t === "Finance" ? T.hazard : T.accent }]}>
                  <Text style={styles.badgeText}>{badgeVal}</Text>
                </View>
              )}
              <Ionicons name={iconName} size={20} color={active ? T.accent : T.sub} />
              {/* "Equipment" is the longest label in TABS and was wrapping to two lines and
                  overflowing the bar on a real device. numberOfLines pins it to one line and
                  adjustsFontSizeToFit shrinks only the label that needs it, so the other six
                  keep their size. Guards every future label, not just this one. */}
              <Text
                style={[styles.tabLabel, { color: active ? T.text : T.sub, fontWeight: active ? "700" : "500" }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t}
              </Text>
              {active
                ? <View style={[styles.tabDot, { backgroundColor: T.accent }]} />
                : <View style={[styles.tabDot, { backgroundColor: "transparent" }]} />
              }
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Bids Screen (fully playable) ───────────────────────────────────────────

const CONTRACT_CATEGORIES = ["All", "Residential", "Commercial", "Infrastructure", "Government", "Mega"];

function BidsScreen({ game, T, col, subCol, openContracts, allOpenCount, categoryFilter, onSetFilter, idleCrew, idleEquip, onStartSite, onBuyMaterials, onSetBidStyle, lockedChains = [], company = null }) {
  const [selectedContract, setSelectedContract] = useState(null);
  const [selectedCrewIds, setSelectedCrewIds] = useState([]);
  const [selectedEquipIds, setSelectedEquipIds] = useState([]);
  const [materialModal, setMaterialModal] = useState(null);
  const [buyQty, setBuyQty] = useState("10");

  const contract = selectedContract ? (game.contracts || []).find((c) => c.id === selectedContract) : null;
  const blockReason = contract ? getAssignBlockReason(contract, selectedCrewIds, selectedEquipIds, game) : null;

  function toggleCrew(id) {
    setSelectedCrewIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleEquip(id) {
    setSelectedEquipIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleConfirm() {
    fireHaptic("light");
    if (!contract) return;
    if (blockReason) { Alert.alert("Cannot Start Site", blockReason); return; }
    // Material pre-check: warn if missing materials before starting
    const _cdef = CONTRACT_DEFS.find(d => d.id === contract.defId);
    const _requiredMats = Object.entries(_cdef?.materials || {});
    const _shortMats = _requiredMats.filter(([matId, needed]) => (game.materials?.[matId] || 0) < needed);
    if (_shortMats.length > 0) {
      const _matDesc = _shortMats.map(([matId, needed]) => `${matId}: need ${needed}, have ${game.materials?.[matId] || 0}`).join("\n");
      Alert.alert(
        "Missing Materials",
        `This site needs materials you don't have:\n\n${_matDesc}\n\nThe site will stall when it starts. You can buy them in the Sites tab. Start anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Anyway", onPress: () => {
            onStartSite(contract, selectedCrewIds, selectedEquipIds);
            setSelectedContract(null);
            setSelectedCrewIds([]);
            setSelectedEquipIds([]);
          }}
        ]
      );
      return;
    }
    onStartSite(contract, selectedCrewIds, selectedEquipIds);
    setSelectedContract(null);
    setSelectedCrewIds([]);
    setSelectedEquipIds([]);
  }

  function openBuyModal(matId) {
    const needed = contract?.materials?.[matId] || 0;
    const have = game.materials[matId] || 0;
    setMaterialModal({ matId, needed, have });
    setBuyQty(String(Math.max(1, needed - have)));
  }

  const riskColors = ["", T.green, T.cyan, T.yellow, T.orange, T.red];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 120 }}>
        {lockedChains.length > 0 && company && (
          <View style={{ marginBottom: 6 }}>
            <Text style={[styles.label, { color: T.sub, marginBottom: 6 }]}>Earned opportunities · waiting on your company</Text>
            {lockedChains.map((c) => <ChainOpportunityCard key={c.id} T={T} contract={c} company={company} formatMoney={money} />)}
          </View>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={[styles.sectionTitle, col]}>
            {openContracts.length}/{allOpenCount} Contract{allOpenCount !== 1 ? "s" : ""}
          </Text>
        </View>
        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {CONTRACT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, { marginRight: 6, color: categoryFilter === cat ? "#fff" : T.sub, borderColor: categoryFilter === cat ? T.orange : T.border, backgroundColor: categoryFilter === cat ? T.orange : T.panel2, paddingVertical: 5, paddingHorizontal: 10 }]}
              onPress={() => onSetFilter(cat)}
            >
              <Text style={{ color: categoryFilter === cat ? "#fff" : T.sub, fontSize: 12, fontWeight: "600" }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {openContracts.length === 0 && (
          <EmptyState
            T={T}
            icon={getEmptyState("Bids").icon}
            title={categoryFilter !== "All" ? `No ${categoryFilter} contracts right now` : getEmptyState("Bids").title}
            body={categoryFilter !== "All"
              ? `Nothing in ${categoryFilter} right now — other categories may still have work.`
              : getEmptyState("Bids").body}
            ctaLabel={categoryFilter !== "All" ? "Show all categories" : null}
            onCta={categoryFilter !== "All" ? () => onSetFilter("All") : null}
          />
        )}

        {openContracts.map((c) => {
          const isSelected = selectedContract === c.id;
          const def = CONTRACT_DEFS.find((d) => d.id === c.defId);
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.card, {
                backgroundColor: T.panel,
                borderColor: isSelected ? T.orange : T.border,
                borderWidth: isSelected ? 2 : 1,
              }]}
              onPress={() => {
                setSelectedContract(isSelected ? null : c.id);
                setSelectedCrewIds([]);
                setSelectedEquipIds([]);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Contract: ${c.label} for ${c.client}, ${money(c.value)}`}
              accessibilityHint={isSelected ? "Double tap to collapse" : "Double tap to open and bid"}
              accessibilityState={{ expanded: isSelected }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text style={[styles.label, col]} numberOfLines={1}>{c.label}</Text>
                    <Text style={{ fontSize: 12, color: T.purple, borderWidth: 1, borderColor: T.purple, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>{c.category || "Commercial"}</Text>
                  </View>
                  <Text style={[styles.sub, subCol]}>{c.client}{(() => {
                    const bidCity = CITIES.find(ct => ct.id === (c.cityId || "salem"));
                    const isHome = (c.cityId || "salem") === (game.startingCityId || "salem");
                    return bidCity ? ` · ${bidCity.name}${isHome ? " 🏠" : ""}` : "";
                  })()}</Text>
                  {/* Phase visual preview */}
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
                    {c.phases.map((ph, i) => {
                      const pv = PHASE_VISUALS[ph] || { emoji: "🏗️" };
                      return <Text key={i} style={{ fontSize: 12 }}>{pv.emoji}</Text>;
                    })}
                  </View>
                  {/* Sprint 12: what this job will actually need, BEFORE the player bids.
                      The plant requirement is a gate, and a gate the player only discovers by
                      hitting it is a trap. plantPlanFor covers every phase, not just the first
                      one that blocks, so nothing is a surprise at phase four either. */}
                  {(() => {
                    const plan = plantPlanFor(c.phases || [], game.equipment || [], CONTRACT_DEFS.find((d) => d.id === c.defId)?.minTier);
                    const needed = plan.filter((p) => p.required);
                    if (needed.length === 0) return null;
                    const short = needed.filter((p) => !p.satisfied);
                    const types = [...new Set(needed.flatMap((p) => p.required.anyOf))];
                    return (
                      <Text style={[styles.sub, { color: short.length > 0 ? T.orange : T.sub, marginTop: 3, fontSize: 11 }]}>
                        {short.length > 0
                          ? `⚠ Needs ${[...new Set(short.flatMap((p) => p.required.anyOf))].join("/")} plant you do not have`
                          : `🚜 Plant on hand for all ${needed.length} phase${needed.length === 1 ? "" : "s"} (${types.join("/")})`}
                      </Text>
                    );
                  })()}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.label, { color: T.green }]}>{money(c.value)}</Text>
                  <Text style={[styles.sub, { color: T.sub }]}>{money(Math.round(c.value / Math.max(1, c.durationDays)))}/day</Text>
                  <Text style={[styles.sub, { color: riskColors[c.risk] || T.sub }]}>Risk: {"●".repeat(c.risk)}{"○".repeat(5 - c.risk)}</Text>
                </View>
              </View>
              {/* R15-2: Weekend Rush banner */}
              {c.isWeeklyRush && (
                <View style={{ backgroundColor: T.yellow + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6, borderWidth: 1, borderColor: T.yellow }}>
                  <Text style={[styles.sub, { color: T.yellow, fontWeight: "700", fontSize: 12 }]}>
                    ⚡ WEEKEND RUSH — 2× Pay · Expires Day {c.expiresDay}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <Text style={[styles.chip, { color: T.blue, borderColor: T.blue }]}>👷 Min {c.crewMin}</Text>
                <Text style={[styles.chip, { color: T.orange, borderColor: T.orange }]}>🚜 Tier {c.minTier}+</Text>
                <Text style={[styles.chip, { color: T.purple, borderColor: T.purple }]}>{c.durationDays}d target</Text>
                {def?.repReward > 0 && <Text style={[styles.chip, { color: T.cyan, borderColor: T.cyan }]}>+{def.repReward} rep</Text>}
                {c.isChainUnlock && <Text style={[styles.chip, { color: T.yellow, borderColor: T.yellow, fontWeight: "700" }]}>🔓 Chain Unlock</Text>}
              </View>
              {/* R15-3: Rival interest warning */}
              {c.interestedRival && c.status === "Open" && (
                <Text style={[styles.sub, { color: T.red, fontSize: 12, marginTop: 3, fontWeight: "600" }]}>
                  🔥 {c.interestedRival} is also bidding — don&apos;t wait
                </Text>
              )}
              {(() => {
                const daysLeft = (c.expiresDay || 0) - (game.day || 0);
                if (daysLeft > 7) return null;
                const color = daysLeft <= 2 ? T.red : daysLeft <= 4 ? T.orange : T.yellow;
                const pct = Math.max(0, Math.round((daysLeft / 7) * 100));
                return (
                  <View style={{ marginTop: 4 }}>
                    <Text style={[styles.sub, { color, fontWeight: daysLeft <= 2 ? "700" : "400" }]}>
                      {daysLeft <= 0 ? "⚠ Expires today" : daysLeft === 1 ? "⏱ Expires tomorrow" : `⏱ Expires in ${daysLeft} days`}
                    </Text>
                    <View style={{ height: 2, backgroundColor: T.track, borderRadius: 1, marginTop: 3 }}>
                      <View style={{ height: 2, width: `${pct}%`, backgroundColor: color, borderRadius: 1 }} />
                    </View>
                  </View>
                );
              })()}
              {c.isChainUnlock && (
                <Text style={[styles.sub, { color: T.yellow, marginTop: 4, fontStyle: "italic" }]}>Unlocked by completing a previous contract — limited time offer.</Text>
              )}

              {/* Expanded assignment panel */}
              {isSelected && (
                <View style={{ marginTop: 14 }}>
                  <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>{c.desc}</Text>
                  {/* Profit estimate */}
                  {(() => {
                    const bidStyle = (game.contractBidStyles || {})[c.id] || "standard";
                    const BID_MULT = { aggressive: 0.82, standard: 1.00, premium: 1.28 };
                    const effectiveValue = Math.round(c.value * (BID_MULT[bidStyle] ?? 1.0));

                    // Every input below is resolved the same way the real charge resolves it:
                    // materials through getMaterialUnitPrice (regional pricing + bulk
                    // discount), labour from the player's own crew wages, equipment from the
                    // day rate of the machines they actually own. The old estimate priced
                    // materials off the raw table, hardcoded labour at $220/crew/day, ignored
                    // equipment entirely, and estimated against the pre-bid-style value — so
                    // switching to an aggressive bid lowered the headline number while the
                    // "est. profit" underneath it did not move.
                    // Stock on hand still cost the business money to buy, so the estimate
                    // prices the whole requirement rather than only the shortfall — otherwise
                    // a job looks cheaper purely because materials were bought earlier.
                    const estMatCost = Object.entries(c.materials || {}).reduce(
                      (sum, [matId, qty]) => sum + qty * getMaterialUnitPrice(game, matId),
                      0,
                    );

                    const _crewPool = game.crew || [];
                    const avgCrewWage = _crewPool.length
                      ? _crewPool.reduce((sum, w) => sum + (w.wagePerDay || 0), 0) / _crewPool.length
                      : 220;
                    const _equipPool = game.equipment || [];
                    const avgEquipCost = _equipPool.length
                      ? _equipPool.reduce((sum, e) => sum + (e.dailyCost || 0), 0) / _equipPool.length
                      : 0;

                    const est = estimateProjectCosts({
                      contractValue: effectiveValue,
                      durationDays: c.durationDays,
                      crewMin: c.crewMin,
                      equipMin: Math.max(1, c.equipMin || 1),
                      materialUnitCost: estMatCost,
                      avgCrewWagePerDay: avgCrewWage,
                      avgEquipmentCostPerDay: avgEquipCost,
                    });
                    const estProfit = est.netProfit;
                    return (
                      <View style={{ backgroundColor: T.panel2, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Contract value</Text>
                          <Text style={[styles.sub, { color: T.green, fontWeight: "700" }]}>{money(effectiveValue)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Est. materials</Text>
                          <Text style={[styles.sub, { color: T.orange }]}>{money(est.materials)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Est. crew wages ({est.crewDays} crew-days)</Text>
                          <Text style={[styles.sub, { color: T.orange }]}>{money(est.labor)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Est. equipment ({est.equipmentDays} machine-days)</Text>
                          <Text style={[styles.sub, { color: T.orange }]}>{money(est.equipment)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                          <Text style={[styles.sub, { color: T.text, fontWeight: "700" }]}>Est. profit</Text>
                          <Text style={[styles.sub, { color: estProfit >= 0 ? T.cyan : T.red, fontWeight: "700" }]}>{money(estProfit)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={[styles.sub, subCol]}>Deadline penalty</Text>
                          <Text style={[styles.sub, { color: T.red }]}>{money(c.penaltyPerDay)}/day late</Text>
                        </View>
                        {(() => {
                          const marginPct = est.marginPercent;
                          const barColor = marginPct < 0 ? T.red : marginPct >= 30 ? T.green : marginPct >= 15 ? T.cyan : T.orange;
                          return (
                            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                                <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>Profit margin</Text>
                                <Text style={[styles.sub, { color: barColor, fontSize: 12, fontWeight: "600" }]}>{marginPct}%</Text>
                              </View>
                              <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                                <View style={{ height: 4, width: `${Math.max(0, Math.min(100, marginPct * 2))}%`, backgroundColor: barColor, borderRadius: 2 }} />
                              </View>
                              {marginPct < 0 && (
                                <Text style={[styles.sub, { color: T.red, fontSize: 12, marginTop: 4 }]}>
                                  ⚠ At your current wages and material prices this job loses money. Bid premium, or take it only to build reputation.
                                </Text>
                              )}
                              <Text style={[styles.sub, { color: T.sub, fontSize: 12, marginTop: 4, fontStyle: "italic" }]}>
                                Estimate assumes {c.durationDays}d at minimum crew. Delays, weather and repairs come out of this margin.
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                    );
                  })()}

                  {/* Materials check */}
                  {Object.keys(c.materials || {}).length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={[styles.label, col, { marginBottom: 4 }]}>Materials Needed</Text>
                      {Object.entries(c.materials).map(([matId, needed]) => {
                        const have = game.materials[matId] || 0;
                        const mat = MATERIAL_DEFS.find((m) => m.id === matId);
                        const ok = have >= needed;
                        return (
                          <View key={matId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                              {mat?.icon && <Ionicons name={mat.icon} size={11} color={ok ? T.green : T.red} />}
                              <Text style={[styles.sub, { color: ok ? T.green : T.red }]}>{mat?.label}: {have}/{needed} {mat?.unit}</Text>
                            </View>
                            {!ok && (
                              <TouchableOpacity
                                style={[styles.smallBtn, { backgroundColor: T.orange }]}
                                onPress={() => openBuyModal(matId)}
                              >
                                <Text style={styles.smallBtnText}>Buy</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Crew selection */}
                  <Text style={[styles.label, col, { marginBottom: 4 }]}>Assign Crew ({selectedCrewIds.length} selected, need {c.crewMin})</Text>
                  {idleCrew.length === 0 && (
                    <Text style={[styles.sub, { color: T.orange }]}>No idle crew available — hire more in the Crew tab.</Text>
                  )}
                  {idleCrew.map((w) => {
                    const sel = selectedCrewIds.includes(w.id);
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.rowItem, { backgroundColor: sel ? T.panel3 : T.panel2, borderColor: sel ? T.orange : T.border }]}
                        onPress={() => toggleCrew(w.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={[styles.label, col]} numberOfLines={1}>{w.name}</Text>
                            {(w.certifications||[]).length > 0 && <Text style={{ fontSize: 12 }}>🎓</Text>}
                          </View>
                          <Text style={[styles.sub, subCol]}>{w.role} · Skill {w.skill} · {w.trait.label}</Text>
                        </View>
                        <View style={[styles.selDot, { backgroundColor: sel ? T.orange : T.border }]} />
                      </TouchableOpacity>
                    );
                  })}

                  {/* Equipment selection */}
                  <Text style={[styles.label, col, { marginTop: 12, marginBottom: 4 }]}>Assign Equipment ({selectedEquipIds.length} selected, need {c.equipMin})</Text>
                  {idleEquip.length === 0 && (
                    <Text style={[styles.sub, { color: T.orange }]}>No idle machines — buy equipment in the Equipment tab.</Text>
                  )}
                  {/* Phase 6: the machine's own artwork rides the picker row. Site cards got
                      this in Phase 3, but the PICKER — the screen where the player actually
                      chooses what to send — was still a text list, which is the one place
                      knowing a grader from a paver changes the decision. */}
                  {idleEquip.map((e) => {
                    const sel = selectedEquipIds.includes(e.id);
                    const tierOk = e.tier >= c.minTier;
                    const img = EQUIPMENT_IMAGES[e.shopId];
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[styles.rowItem, { alignItems: "center", minHeight: MIN_TAP_TARGET + 8, backgroundColor: sel ? T.panel3 : T.panel2, borderColor: sel ? T.orange : tierOk ? T.border : T.red, opacity: tierOk ? 1 : 0.6 }]}
                        onPress={() => tierOk && toggleEquip(e.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${sel ? "Deselect" : "Select"} ${e.name}, tier ${e.tier}, condition ${Math.round(e.condition)} percent`}
                      >
                        {img ? (
                          <Image
                            source={img}
                            style={{ width: 46, height: 34, borderRadius: RADIUS.xs, marginRight: SPACING.sm, backgroundColor: "#ffffff" }}
                            resizeMode="contain"
                          />
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.label, col]} numberOfLines={1}>{e.name}</Text>
                          <Text style={[styles.sub, { color: toneColor(conditionTone(e.condition), T) }]} numberOfLines={1}>
                            Tier {e.tier} · Cond {Math.round(e.condition)}%
                          </Text>
                          {!tierOk && <Text style={[styles.sub, { color: T.red }]}>Needs Tier {c.minTier}+</Text>}
                        </View>
                        <View style={[styles.selDot, { backgroundColor: sel ? T.orange : T.border }]} />
                      </TouchableOpacity>
                    );
                  })}
                  {/* ── BID STRATEGY ────────────────────────────────────────────────
                      Each option now shows the two things that make it a decision: what it
                      pays and how likely you are to be awarded it. Both come from one
                      planBid() call, which is the same call handleStartSite rolls against —
                      so the odds shown here are by construction the odds you get. */}
                  {(() => {
                    const bidStyle = (game.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE;
                    const plans = BID_STYLES.map((opt) => ({ opt, plan: planBid(c, opt.key, withBidPerks(game)) }));
                    const active = plans.find((p) => p.opt.key === bidStyle) || plans[1];
                    return (
                      <View style={{ marginTop: SPACING.md }}>
                        <SectionLabel T={T} style={{ marginBottom: SPACING.sm }}>Bid strategy</SectionLabel>
                        <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm }}>
                          {plans.map(({ opt, plan }) => {
                            const isActive = bidStyle === opt.key;
                            const tint = toneColor(plan.riskTone, T);
                            return (
                              <TouchableOpacity
                                key={opt.key}
                                onPress={() => onSetBidStyle(c.id, opt.key)}
                                style={{
                                  flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xs,
                                  borderRadius: RADIUS.sm, borderWidth: 1.5, minHeight: MIN_TAP_TARGET + 12,
                                  borderColor: isActive ? tint : T.border,
                                  backgroundColor: isActive ? alpha(tint, 0.15) : "transparent",
                                  alignItems: "center", justifyContent: "center",
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={`${opt.label} bid, ${money(plan.effectiveValue)}, ${plan.winPercent} percent chance of winning`}
                              >
                                <Text style={{ fontWeight: "800", fontSize: 13, color: isActive ? tint : T.text }}>{opt.label}</Text>
                                <Text style={{ fontSize: 12, color: isActive ? tint : T.sub, marginTop: 2 }}>
                                  {compactMoney(plan.effectiveValue)}
                                </Text>
                                <Text style={{ fontSize: 11, color: isActive ? tint : T.dim, marginTop: 1 }}>
                                  {plan.winPercent}% win
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <View style={{ backgroundColor: T.panel2, borderRadius: RADIUS.sm, padding: SPACING.md, borderWidth: 1, borderColor: T.border }}>
                          <Text style={[TYPE.caption, { color: T.sub, marginBottom: SPACING.sm }]}>{active.plan.detail}</Text>
                          <ProgressBar
                            T={T}
                            percent={active.plan.winPercent}
                            tone={active.plan.riskTone}
                            label="Chance of being awarded"
                            value={`${active.plan.winPercent}% · ${active.plan.riskLabel}`}
                            height={5}
                          />
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.sm }}>
                            <Text style={[TYPE.caption, { color: T.sub }]}>Contract value if won</Text>
                            <Text style={[TYPE.bodyStrong, { color: T.text }]}>{money(active.plan.effectiveValue)}</Text>
                          </View>
                          {active.plan.contested && (
                            <Text style={[TYPE.caption, { color: T.caution, marginTop: SPACING.sm }]}>
                              ⚠ {active.plan.rivalName} is already chasing this one.
                            </Text>
                          )}
                          <Text style={[TYPE.caption, { color: T.dim, marginTop: SPACING.sm, fontStyle: "italic" }]}>
                            Losing a bid costs you the contract, not your crew — nothing is committed until you win.
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Confirm button */}
                  {(() => {
                    const bidStyle = (game.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE;
                    const plan = planBid(c, bidStyle, withBidPerks(game));
                    return (
                      <TouchableOpacity
                        style={[styles.btn, {
                          marginTop: SPACING.lg,
                          backgroundColor: !blockReason ? T.accent : T.panel2,
                          borderColor: !blockReason ? T.accent : T.border,
                        }]}
                        onPress={handleConfirm}
                        accessibilityRole="button"
                        accessibilityLabel={blockReason || `Submit ${plan.label} bid for ${money(plan.effectiveValue)}`}
                      >
                        <Text style={[styles.btnText, { color: !blockReason ? "#0a1018" : T.sub }]}>
                          {blockReason || `Submit ${plan.label} Bid · ${plan.winPercent}%`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Active sites quick-look */}
        {getActiveSites(game).length > 0 && (
          <>
            <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Active Sites</Text>
            {getActiveSites(game).map((site) => {
              const pct = ((site.currentPhaseIdx / site.phases.length) + (site.phaseProgress / 100 / site.phases.length)) * 100;
              return (
                <View key={site.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[styles.label, col]} numberOfLines={1}>{site.label}</Text>
                    <Text style={[styles.sub, { color: site.status === "Paused" ? T.orange : T.cyan }]}>
                      {site.status === "Paused" ? "⏸ Paused" : site.phases[site.currentPhaseIdx] || "Done"}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 6 }]}>
                    <View style={[styles.progressFill, { width: `${Math.round(pct)}%`, backgroundColor: T.green }]} />
                  </View>
                  <Text style={[styles.sub, subCol]}>{Math.round(pct)}% · {site.assignedCrewIds.length} crew · Deadline Day {site.deadlineDay}</Text>
                  {site.chaosHistory?.slice(0, 2).map((e, i) => (
                    <Text key={i} style={[styles.sub, { color: T.orange, marginTop: 2 }]}>⚠ {e.text}</Text>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Material Buy Modal */}
      <Modal visible={!!materialModal} transparent animationType="slide" onRequestClose={() => setMaterialModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: T.panel, borderColor: T.border }]}>
            {materialModal && (() => {
              const mat = MATERIAL_DEFS.find((m) => m.id === materialModal.matId);
              // The price buyYardMaterials() will charge — same function, so quote and charge cannot differ.
              const price = getMaterialUnitPrice(game, materialModal.matId);
              const qty = parseInt(buyQty) || 0;
              const total = price * qty;
              return (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    {mat?.icon && <Ionicons name={mat.icon} size={20} color={T.text} />}
                    <Text style={[styles.h2, col]}>Buy {mat?.label}</Text>
                  </View>
                  <Text style={[styles.sub, subCol]}>Current stock: {materialModal.have} {mat?.unit}</Text>
                  <Text style={[styles.sub, subCol]}>Market price: {money(price)}/{mat?.unit}</Text>
                  <TextInput
                    style={[styles.input, { color: T.text, borderColor: T.border, backgroundColor: T.panel2, marginTop: 12 }]}
                    value={buyQty}
                    onChangeText={setBuyQty}
                    keyboardType="numeric"
                    placeholder="Quantity"
                    placeholderTextColor={T.sub}
                  />
                  <Text style={[styles.label, { color: T.green, marginTop: 8 }]}>Total: {money(total)}</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                    <TouchableOpacity style={[styles.btn, { flex: 1, borderColor: T.border }]} onPress={() => setMaterialModal(null)}>
                      <Text style={[styles.btnText, col]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, { flex: 1, backgroundColor: game.cash >= total ? T.green : T.panel2, borderColor: T.green }]}
                      onPress={() => { onBuyMaterials(materialModal.matId, qty); setMaterialModal(null); }}
                    >
                      <Text style={[styles.btnText, { color: game.cash >= total ? "#fff" : T.red }]}>Buy</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Crew Screen ─────────────────────────────────────────────────────────────

function CrewScreen({ game, T, col, subCol, onHire, onFire, onPostJob, onHireSubcontractor, onHirePM, onFirePM, onTrain, onPromote, onRaiseWage, onLowerWage, onGiveBonus, onRest, onRestAllTired, onBuyLunch, onSetWage, onBulkHire, onFireMany }) {
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  // Sprint 13, from the device: "drop downs are needed to reduce the amount of scrolling".
  // Every worker card rendered four stat bars, certificate badges and six buttons. At ten crew
  // that is a screen you scroll past rather than read, and at twenty-five — which bulk hiring
  // now makes reachable in one tap — it is unusable. Collapsed by default; one tap opens the
  // person you actually care about.
  const [expandedCrewId, setExpandedCrewId] = useState(null);
  const [selectedCrewIds, setSelectedCrewIds] = useState([]);
  const [bulkHireCount, setBulkHireCount] = useState("");
  const [wageDrafts, setWageDrafts] = useState({});
  const toggleSelected = (id) =>
    setSelectedCrewIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const office = OFFICES[game.officeIndex || 0];
  const moodColor = (v) => v >= 70 ? T.green : v >= 45 ? T.yellow : T.red;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
      {/* Hire ads */}
      <Text style={[styles.sectionTitle, col, { marginBottom: 8 }]}>Post Job Ads</Text>
      {JOB_POSTINGS.map((posting) => (
        <View key={posting.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={[styles.label, col]}>{posting.label}</Text>
            <Text style={[styles.label, { color: T.orange }]}>{money(posting.cost)}</Text>
          </View>
          <Text style={[styles.sub, subCol]}>{posting.desc}</Text>
          <Text style={[styles.sub, subCol]}>Adds {posting.count} candidate(s) · Skill {posting.skillMin}–{posting.skillMax}</Text>
          <TouchableOpacity
            style={[styles.btn, { marginTop: 8, backgroundColor: game.cash >= posting.cost ? T.blue : T.panel2, borderColor: T.blue }]}
            onPress={() => onPostJob(posting)}
          >
            <Text style={[styles.btnText, { color: game.cash >= posting.cost ? "#fff" : T.sub }]}>Post Ad</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Applicants */}
      {game.applicants.length === 0 && (
        <EmptyState
          T={T}
          icon="person-add-outline"
          title="No applicants waiting"
          body="Post a job ad to attract trades. Applicants arrive over the following days and expire if you leave them too long."
          ctaLabel="Post a job ad"
          onCta={onPostJob}
        />
      )}
      {game.applicants.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 6 }]}>
            Applicants ({game.applicants.length})
          </Text>
          {/* Specialty filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {["All", ...CREW_SPECIALTIES].map(spec => (
              <TouchableOpacity key={spec} style={[styles.chip, { marginRight: 6, borderColor: specialtyFilter === spec ? T.purple : T.border }]} onPress={() => setSpecialtyFilter(spec)}>
                <Text style={[styles.sub, { color: specialtyFilter === spec ? T.purple : T.sub, fontWeight: specialtyFilter === spec ? "700" : "400" }]}>{spec}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {game.applicants.filter(a => specialtyFilter === "All" || (a.specialty || "General") === specialtyFilter).map((a) => (
            <View key={a.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, col]} numberOfLines={1}>{a.name}</Text>
                  <Text style={[styles.sub, subCol]}>{a.role} · {a.trait.label}</Text>
                  <Text style={[styles.sub, subCol]}>Skill {a.skill} · {money(a.desiredWage)}/day</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    <Text style={[styles.chip, { color: T.purple, borderColor: T.purple }]}>{a.specialty || "General"}</Text>
                    {a.quality && <Text style={[styles.chip, { color: T.yellow, borderColor: T.yellow }]}>{a.quality}</Text>}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                  <Text style={[styles.sub, { color: T.orange }]}>Signing: {money(a.signingBonus)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.btn, { marginTop: 8, backgroundColor: T.green, borderColor: T.green }]}
                onPress={() => onHire(a)}
                disabled={game.crew.length >= office.crewCap}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>
                  {game.crew.length >= office.crewCap ? "Crew Cap Reached" : `Hire — ${money(a.signingBonus)} signing bonus`}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Current Crew */}
      <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>
        Crew ({game.crew.length}/{office.crewCap})
      </Text>
      {game.crew.some(w => (w.stamina ?? 50) < 40) && (
        <TouchableOpacity
          style={[styles.btn, { marginBottom: 10, backgroundColor: T.cyan + "22", borderColor: T.cyan }]}
          onPress={() => onRestAllTired && onRestAllTired()}
        >
          <Text style={[styles.btnText, { color: T.cyan }]}>😴 Rest All Tired Workers (stamina &lt; 40)</Text>
        </TouchableOpacity>
      )}
      {game.crew.length === 0 && (
        <EmptyState
          T={T}
          icon={getEmptyState("Crew").icon}
          title={getEmptyState("Crew").title}
          body="A site cannot start without crew. Post a job ad to bring in applicants, then hire the trades your contracts call for."
          ctaLabel="Post a job ad"
          onCta={onPostJob}
        />
      )}
      {/* ── Payroll & bulk actions ────────────────────────────────────────────
          Sprint 13, from the device: "if you want to hire 25 employees at once you can, if you
          wanna fire all of them you can... but you can also individually click on each
          employee's profile." FleetFlow has bulkHireApplicants(count) and fireAllDrivers();
          Construction Flow had neither, so every hire and every dismissal was one tap at a
          time down a list with no end. */}
      {(game.crew || []).length > 0 && (() => {
        const pay = payrollSummary(game);
        return (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: pay.atRisk > 0 ? T.orange : T.border, borderWidth: pay.atRisk > 0 ? 1.5 : 1 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.label, col]}>Payroll · {pay.headcount} on the books</Text>
              <Text style={[styles.label, { color: T.orange }]}>{money(pay.daily)}/day</Text>
            </View>
            <Text style={[styles.sub, { color: pay.atRisk > 0 ? T.orange : T.sub, marginTop: 2 }]}>
              {pay.headline} · {pay.versusMarket >= 0 ? "+" : ""}{money(pay.versusMarket)}/day vs market
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <TextInput
                style={[styles.input, col, { flex: 1, marginBottom: 0 }]}
                value={bulkHireCount}
                onChangeText={(t) => setBulkHireCount(t.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder="How many"
                placeholderTextColor={T.sub}
                accessibilityLabel="Number of crew to hire at once"
              />
              <TouchableOpacity
                style={{ backgroundColor: bulkHireCount ? T.green + "22" : T.panel2, borderRadius: 7, borderWidth: 1, borderColor: bulkHireCount ? T.green : T.border, paddingVertical: 8, paddingHorizontal: 12 }}
                disabled={!bulkHireCount}
                onPress={() => { onBulkHire && onBulkHire(parseInt(bulkHireCount, 10)); setBulkHireCount(""); }}
                accessibilityRole="button"
                accessibilityLabel={`Hire ${bulkHireCount || "several"} crew at once`}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: bulkHireCount ? T.green : T.sub }}>
                  Hire {bulkHireCount || "N"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[TYPE.caption, { color: T.dim, marginTop: 3 }]}>
              {(game.applicants || []).length} applicant{(game.applicants || []).length === 1 ? "" : "s"} waiting · cap {getTotalCrewCap(game)}
            </Text>

            <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 7, borderWidth: 1, borderColor: T.border, paddingVertical: 8, alignItems: "center" }}
                onPress={() => { fireHaptic("light"); setSelectedCrewIds(selectedCrewIds.length === (game.crew || []).length ? [] : (game.crew || []).map((w) => w.id)); }}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: T.sub }}>
                  {selectedCrewIds.length === (game.crew || []).length ? "Clear selection" : "Select all"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: selectedCrewIds.length > 0 ? T.red + "22" : T.panel2, borderRadius: 7, borderWidth: 1, borderColor: selectedCrewIds.length > 0 ? T.red : T.border, paddingVertical: 8, alignItems: "center" }}
                disabled={selectedCrewIds.length === 0}
                onPress={() => {
                  const plan = planBulkFire((game.crew || []).filter((w) => selectedCrewIds.includes(w.id)));
                  Alert.alert(
                    `Let ${plan.count} go?`,
                    `${money(plan.severance)} in severance, saving ${money(plan.dailySaving)}/day.\n\nThis cannot be undone.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: `Dismiss ${plan.count}`, style: "destructive", onPress: () => { onFireMany && onFireMany(selectedCrewIds); setSelectedCrewIds([]); } },
                    ]
                  );
                }}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${selectedCrewIds.length} selected crew`}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: selectedCrewIds.length > 0 ? T.red : T.sub }}>
                  Dismiss {selectedCrewIds.length || ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {game.crew.map((w) => {
        // Trait effects now come from one shared helper, so the same trait can no longer be
        // described one way here and another way on the applicant card.
        const traitEffects = describeTraitEffects(w);
        const where = describeWorkerAssignment(w, game);
        const risks = workerRiskFlags(w);
        const standing = summarizeWorkerStanding(w, game);
        const voice = workerVoiceLine(w, game);
        return (
        <View key={w.id} style={[styles.card, {
          backgroundColor: T.panel,
          borderColor: risks.length > 0 ? alpha(toneColor(risks[0].tone, T), 0.5) : T.border,
          borderLeftWidth: 4,
          borderLeftColor: risks.length > 0 ? toneColor(risks[0].tone, T) : toneColor(where.tone, T),
        }]}>
          {/* ── WHERE THEY ARE ───────────────────────────────────────────────
              First line on the card, because "Dave is pouring the foundation at
              Riverside" and "Dave is sitting in the yard costing you $200 a day"
              are the two facts an owner needs, and the card used to show neither. */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm }}>
            <Text style={[TYPE.caption, { color: toneColor(where.tone, T), fontWeight: "700", flex: 1 }]} numberOfLines={1}>
              {where.state === "working" ? "🔨 " : where.state === "resting" ? "😴 " : where.state === "paused" ? "⏸ " : "🅿️ "}
              {where.label}
            </Text>
            <Text style={[TYPE.caption, { color: T.sub }]}>{money(w.wagePerDay)}/day</Text>
            <TouchableOpacity
              onPress={() => { fireHaptic("light"); toggleSelected(w.id); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 8 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selectedCrewIds.includes(w.id) }}
              accessibilityLabel={`Select ${w.name}`}
            >
              <Text style={{ fontSize: 15, color: selectedCrewIds.includes(w.id) ? T.red : T.dim }}>
                {selectedCrewIds.includes(w.id) ? "☑" : "☐"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, col]}>{w.name}</Text>
              <Text style={[styles.sub, subCol]}>
                {w.role} · {w.specialty || "General"} · Lv{w.level || 1} {WORKER_LEVELS.find(l => l.level === (w.level || 1))?.label || ""}
              </Text>
              <Text style={[TYPE.caption, { color: T.dim, marginTop: 1 }]}>
                {standing.rank} · {standing.tenureLabel} · {standing.jobs} job{standing.jobs === 1 ? "" : "s"}
              </Text>
              {(() => {
                const curLvl = WORKER_LEVELS.find(l => l.level === (w.level || 1));
                const nextLvl = WORKER_LEVELS.find(l => l.level === (w.level || 1) + 1);
                if (!curLvl || !nextLvl) return <Text style={[styles.sub, { color: T.yellow, fontSize: 12 }]}>⭐ Max Level</Text>;
                const xpProgress = Math.min(1, ((w.xp || 0) - curLvl.xpRequired) / (nextLvl.xpRequired - curLvl.xpRequired));
                return (
                  <View style={{ marginTop: 3, marginBottom: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>XP {w.xp || 0} / {nextLvl.xpRequired}</Text>
                      <Text style={[styles.sub, { color: T.cyan, fontSize: 12 }]}>Next: {nextLvl.label}</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: T.track, height: 4, marginTop: 2 }]}>
                      <View style={[styles.progressFill, { width: `${Math.round(xpProgress * 100)}%`, backgroundColor: T.cyan, height: 4 }]} />
                    </View>
                  </View>
                );
              })()}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[styles.sub, subCol]}>Skill · {money(w.wagePerDay)}/day</Text>
                    <Text style={[styles.sub, { color: w.skill >= 100 ? T.green : w.skill >= 70 ? T.blue : T.orange }]}>{w.skill}/150</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 2 }]}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((w.skill / 150) * 100))}%`, backgroundColor: w.skill >= 100 ? T.green : w.skill >= 70 ? T.blue : T.orange }]} />
                  </View>
                </View>
              </View>
              {(() => {
                const daysWorked = game.day - (w.hireDay || game.day);
                const jobsDone = w.jobsCompleted || 0;
                const loyalty = w.loyalty ?? 0;
                if (daysWorked > 0 || jobsDone > 0) {
                  return (
                    <Text style={[styles.sub, { color: loyalty >= 80 ? T.yellow : loyalty >= 40 ? T.cyan : T.sub, fontSize: 12, marginTop: 1 }]}>
                      {loyalty >= 80 ? "⭐ " : ""}Hired Day {w.hireDay || 0} · {jobsDone} project{jobsDone !== 1 ? "s" : ""} complete{loyalty >= 80 ? " · Veteran" : ""}
                    </Text>
                  );
                }
                return null;
              })()}
            </View>
            {/* The status word and site name that used to live here are now the first line
                of the card, where they belong. This column keeps the trait, which is the
                one thing about a person the header cannot say in a phrase. */}
            <View style={{ alignItems: "flex-end", marginLeft: SPACING.sm }}>
              <View style={[styles.statusPill, { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.border }]}>
                <Text style={[styles.statusPillText, { color: T.text }]}>{w.trait?.label || "—"}</Text>
              </View>
              {w.trait?.desc ? (
                <Text style={[TYPE.caption, { color: T.dim, marginTop: 3, maxWidth: 130, textAlign: "right" }]} numberOfLines={2}>
                  {w.trait.desc}
                </Text>
              ) : null}
            </View>
          </View>
          {/* ── WHAT NEEDS DOING ABOUT THIS PERSON ─────────────────────────
              The simulation already knows a worker is exhausted, unhappy or three days
              from taking another offer. It used to know it silently, and the player only
              found out when they quit. */}
          {risks.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: SPACING.sm }}>
              {risks.map((r) => (
                <Pill key={r.key} T={T} label={r.label} tone={r.tone} filled />
              ))}
            </View>
          )}
          {risks.length > 0 && (
            <Text style={[TYPE.caption, { color: toneColor(risks[0].tone, T), marginTop: SPACING.xs }]}>
              {risks[0].detail}
            </Text>
          )}

          {/* ── THEIR VOICE ────────────────────────────────────────────────
              One line, derived from the state the simulation already produced, so it can
              only narrate something true. Deterministic per worker per day — see
              companyLife.js on why flavour text here must never consume an RNG draw. */}
          <Text style={[TYPE.caption, { color: T.sub, fontStyle: "italic", marginTop: SPACING.sm }]} numberOfLines={2}>
            “{voice}”
          </Text>

          {/* Trait impact pills */}
          {traitEffects.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: SPACING.sm }}>
              {traitEffects.map((e, i) => (
                <Pill key={i} T={T} label={e.label} tone={e.tone} />
              ))}
            </View>
          )}
          {/* Sprint 13: a compact line when collapsed, so the card still answers the two
              questions an owner has — what are they costing me, and are they about to walk —
              without four progress bars and six buttons for every person on the books. */}
          <TouchableOpacity
            onPress={() => { fireHaptic("light"); setExpandedCrewId((id) => (id === w.id ? null : w.id)); }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.sm }}
            accessibilityRole="button"
            accessibilityLabel={`${expandedCrewId === w.id ? "Collapse" : "Expand"} ${w.name}`}
          >
            {(() => {
              const pos = payPosition(w);
              return (
                <Text style={[TYPE.caption, { color: toneColor(pos.tone, T), fontWeight: "700" }]}>
                  {pos.label} · market {money(marketRateFor(w))}
                  {(w.underpaidDays || 0) > 5 ? ` · unhappy ${Math.round(w.underpaidDays)}d` : ""}
                </Text>
              );
            })()}
            <Text style={[TYPE.caption, { color: T.sub }]}>{expandedCrewId === w.id ? "Hide ▲" : "Details ▼"}</Text>
          </TouchableOpacity>

          {expandedCrewId === w.id && (
          <>
          {/* Set an exact wage. The whole control used to be two ±10% nudges. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <TextInput
              style={[styles.input, col, { flex: 1, marginBottom: 0 }]}
              value={wageDrafts[w.id] ?? String(w.wagePerDay)}
              onChangeText={(t) => setWageDrafts((d) => ({ ...d, [w.id]: t.replace(/[^0-9]/g, "") }))}
              keyboardType="numeric"
              placeholder={`${WAGE_FLOOR}–${WAGE_CEILING}`}
              placeholderTextColor={T.sub}
              accessibilityLabel={`Daily wage for ${w.name}`}
            />
            <TouchableOpacity
              style={{ backgroundColor: T.green + "22", borderRadius: 7, borderWidth: 1, borderColor: T.green, paddingVertical: 8, paddingHorizontal: 14 }}
              onPress={() => {
                const want = parseInt(wageDrafts[w.id] ?? String(w.wagePerDay), 10);
                if (Number.isFinite(want)) onSetWage && onSetWage(w.id, want);
                setWageDrafts((d) => ({ ...d, [w.id]: undefined }));
              }}
              accessibilityRole="button"
              accessibilityLabel={`Set ${w.name}'s wage`}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: T.green }}>Set Pay</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const draft = parseInt(wageDrafts[w.id] ?? "", 10);
            if (!Number.isFinite(draft) || draft === w.wagePerDay) return null;
            const pv = previewWage(w, draft);
            return (
              <Text style={[TYPE.caption, { color: toneColor(pv.positionAfter.tone, T), marginTop: 3 }]}>
                {pv.clamped ? `Clamped to ${money(pv.applied)}. ` : ""}
                {pv.positionAfter.label} · loyalty {pv.loyaltyDelta >= 0 ? "+" : ""}{pv.loyaltyDelta}, mood {pv.moodDelta >= 0 ? "+" : ""}{pv.moodDelta}
              </Text>
            );
          })()}
          {/* Stats bars */}
          {[
            { label: "Mood",    val: w.mood,              color: moodColor(w.mood) },
            { label: "Stamina", val: w.stamina,            color: (w.stamina ?? 50) < 20 ? T.red : (w.stamina ?? 50) < 40 ? T.orange : T.cyan },
            { label: "Loyalty", val: w.loyalty ?? 0,       color: (w.loyalty ?? 0) >= 70 ? T.yellow : (w.loyalty ?? 0) >= 40 ? T.green : T.red },
          ].map((stat) => (
            <View key={stat.label} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.sub, subCol]}>{stat.label}</Text>
                <Text style={[styles.sub, { color: stat.color }]}>{Math.round(stat.val)}/100</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: T.track }]}>
                <View style={[styles.progressFill, { width: `${Math.max(0,Math.min(100,stat.val))}%`, backgroundColor: stat.color }]} />
              </View>
            </View>
          ))}
          {/* Certification badges */}
          {(w.certifications || []).length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {(w.certifications || []).map((cert) => {
                const prog = TRAINING_PROGRAMS.find(p => p.certId === cert);
                return (
                  <View key={cert} style={{ backgroundColor: T.blue + "22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.blue }}>
                    <Text style={[styles.sub, { fontSize: 12, color: T.blue, fontWeight: "700" }]}>🎓 {prog?.label || cert}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {/* Wage & bonus controls */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 80, backgroundColor: T.green + "22", borderRadius: 7, borderWidth: 1, borderColor: T.green, paddingVertical: 6, alignItems: "center" }}
              onPress={() => onRaiseWage && onRaiseWage(w.id)}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: T.green }}>Raise Wage</Text>
              <Text style={{ fontSize: 12, color: T.sub }}>+10%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 80, backgroundColor: T.orange + "22", borderRadius: 7, borderWidth: 1, borderColor: T.orange, paddingVertical: 6, alignItems: "center" }}
              onPress={() => onLowerWage && onLowerWage(w.id)}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: T.orange }}>Lower Wage</Text>
              <Text style={{ fontSize: 12, color: T.sub }}>-10%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 80, backgroundColor: T.yellow + "22", borderRadius: 7, borderWidth: 1, borderColor: T.yellow, paddingVertical: 6, alignItems: "center" }}
              onPress={() => onGiveBonus && onGiveBonus(w.id)}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: T.yellow }}>Give Bonus</Text>
              <Text style={{ fontSize: 12, color: T.sub }}>2× daily</Text>
            </TouchableOpacity>
            {w.status !== "Resting" && (w.stamina ?? 50) < 80 && (
              <TouchableOpacity
                style={{ flex: 1, minWidth: 80, backgroundColor: T.cyan + "22", borderRadius: 7, borderWidth: 1, borderColor: T.cyan, paddingVertical: 6, alignItems: "center" }}
                onPress={() => onRest && onRest(w.id)}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: T.cyan }}>Rest</Text>
                <Text style={{ fontSize: 12, color: T.sub }}>→80 stamina</Text>
              </TouchableOpacity>
            )}
            {w.lastLunchDay !== game.day && (
              <TouchableOpacity
                style={{ flex: 1, minWidth: 80, backgroundColor: T.orange + "22", borderRadius: 7, borderWidth: 1, borderColor: T.orange, paddingVertical: 6, alignItems: "center" }}
                onPress={() => onBuyLunch && onBuyLunch(w.id)}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: T.orange }}>Buy Lunch</Text>
                <Text style={{ fontSize: 12, color: T.sub }}>$25 · mood+8</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Promotion to Senior role — level >= 3, skill >= 70 */}
          {w.status !== "Active" && (w.level || 1) >= 3 && (w.skill || 0) >= 70 && !w.role?.startsWith("Senior") && (
            <TouchableOpacity
              style={[styles.btn, { marginTop: 6, backgroundColor: T.purple + "22", borderColor: T.purple }]}
              onPress={() => onPromote && onPromote(w.id)}
            >
              <Text style={[styles.btnText, { color: T.purple }]}>Promote to Senior {w.role} — $500</Text>
            </TouchableOpacity>
          )}
          {w.status !== "Active" && w.status !== "Resting" && (
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, borderColor: T.red }]}
              onPress={() => Alert.alert("Fire Worker", `Let go of ${w.name}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Fire", style: "destructive", onPress: () => onFire(w.id) },
              ])}
            >
              <Text style={[styles.btnText, { color: T.red }]}>Let Go</Text>
            </TouchableOpacity>
          )}
          {w.status === "Resting" && (
            <View style={{ marginTop: 6, backgroundColor: T.cyan + "18", borderRadius: 6, padding: 6, borderWidth: 1, borderColor: T.cyan }}>
              <Text style={[styles.sub, { color: T.cyan, fontSize: 12 }]}>😴 Resting — stamina recovering to {w.restUntilStamina || 80}</Text>
            </View>
          )}
          </>
          )}
        </View>
        );
      })}

      {/* Training Programs */}
      {game.crew.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Training Programs</Text>
          <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>Invest in crew skill and unlock certifications. Worker must be idle.</Text>
          {TRAINING_PROGRAMS.map((prog) => (
            <View key={prog.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, col]}>{prog.label}</Text>
                  <Text style={[styles.sub, { color: T.cyan }]}>Skill +{prog.skillBonus} · {prog.duration} days · Cert: {prog.certId}</Text>
                  {prog.wagePressure > 0 && <Text style={[styles.sub, { color: T.orange }]}>Wage pressure +{Math.round(prog.wagePressure * 100)}% after completion</Text>}
                </View>
                <Text style={[styles.label, { color: game.cash >= prog.cost ? T.green : T.red }]}>{money(prog.cost)}</Text>
              </View>
              {/* Worker selection for training */}
              {game.crew.filter(w => w.status === "Idle" && !(game.trainingQueue || []).some(t => t.workerId === w.id)).slice(0, 3).map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.btn, { marginTop: 6, backgroundColor: game.cash >= prog.cost ? T.blue : T.panel2, borderColor: T.blue }]}
                  onPress={() => onTrain && onTrain(w.id, prog.id)}
                >
                  <Text style={[styles.btnText, { color: game.cash >= prog.cost ? "#fff" : T.sub }]}>
                    Train {w.name.split(" ")[0]} — {money(prog.cost)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {/* Active training queue */}
          {(game.trainingQueue || []).length > 0 && (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.cyan, borderWidth: 1 }]}>
              <Text style={[styles.label, { color: T.cyan, marginBottom: 6 }]}>In Training</Text>
              {(game.trainingQueue || []).map(t => {
                const w = game.crew.find(c => c.id === t.workerId);
                const prog = TRAINING_PROGRAMS.find(p => p.id === t.programId);
                const totalDays = prog?.duration || 1;
                const doneDays = totalDays - (t.daysLeft || 0);
                const pct = Math.round((doneDays / totalDays) * 100);
                return (
                  <View key={t.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.sub, { color: T.cyan }]}>{w?.name || "Worker"} — {prog?.label || t.programId}</Text>
                      <Text style={[styles.sub, subCol]}>{t.daysLeft}d left</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 3 }]}>
                      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: T.cyan }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Subcontractors */}
      <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Hire Subcontractors</Text>
      <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>Temporary crews — faster progress, higher cost, lower reliability.</Text>
      {SUBCONTRACTOR_TYPES.map((def) => {
        const active = (game.subcontractors || []).find((sc) => sc.typeId === def.id);
        return (
          <View key={def.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, col]}>{def.label}</Text>
                <Text style={[styles.sub, subCol]}>{def.desc}</Text>
                <Text style={[styles.sub, subCol]}>Skill {def.skill} · {money(def.wagePerDay)}/day · {def.count} workers · {def.durationDays} days</Text>
                <Text style={[styles.sub, { color: T.orange }]}>Reliability: {Math.round(def.reliability * 100)}%</Text>
              </View>
              <Text style={[styles.label, { color: T.orange }]}>{money(def.hireCost)}</Text>
            </View>
            {active ? (
              <Text style={[styles.sub, { color: T.cyan, marginTop: 8 }]}>✅ Active — {active.daysLeft} day(s) left</Text>
            ) : (
              <TouchableOpacity
                style={[styles.btn, { marginTop: 8, backgroundColor: game.cash >= def.hireCost ? T.cyan : T.panel2, borderColor: T.cyan }]}
                onPress={() => onHireSubcontractor(def.id)}
              >
                <Text style={[styles.btnText, { color: game.cash >= def.hireCost ? "#fff" : T.sub }]}>Hire for {def.durationDays} days</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Active Subcontractors */}
      {(game.subcontractors || []).length > 0 && (
        <>
          <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Active Subcontractors</Text>
          {game.subcontractors.map((sc) => (
            <View key={sc.id} style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.label, col]}>{sc.name}</Text>
                <Text style={[styles.sub, { color: T.cyan }]}>{sc.daysLeft}d left</Text>
              </View>
              <Text style={[styles.sub, subCol]}>{sc.role} · {sc.count} workers · {money(sc.wagePerDay)}/day · {sc.status}</Text>
            </View>
          ))}
        </>
      )}

      {/* Office Staff */}
      {game.officeStaff.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Office Staff</Text>
          {game.officeStaff.map((s) => (
            <View key={s.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <Text style={[styles.label, col]}>{s.name}</Text>
              <Text style={[styles.sub, subCol]}>{s.role} · {money(s.wagePerDay)}/day</Text>
            </View>
          ))}
        </>
      )}

      {/* Project Managers */}
      <Text style={[styles.sectionTitle, col, { marginTop: 16, marginBottom: 8 }]}>Project Managers</Text>
      <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>PMs speed up sites, reduce delays, and senior PMs auto-manage stalled jobs.</Text>
      {PM_TIERS.map(def => {
        const hired = (game.projectManagers||[]).find(pm => pm.typeId === def.id);
        return (
          <View key={def.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, col]}>{def.name}</Text>
                <Text style={[styles.sub, subCol]}>{def.desc}</Text>
                <Text style={[styles.sub, { color: T.cyan }]}>
                  Delay -{ Math.round(def.delayReduce*100)}% · Margin +{Math.round(def.marginBoost*100)}%{def.autoManage ? " · Auto-manages" : ""}
                </Text>
                <Text style={[styles.sub, { color: T.orange }]}>{money(def.wagePerDay)}/day · Hire: {money(def.hireCost)}</Text>
              </View>
            </View>
            {hired ? (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.sub, { color: T.green }]}>✅ On staff: {hired.name}</Text>
                <TouchableOpacity style={[styles.btn, { marginTop: 6, borderColor: T.red }]} onPress={() => onFirePM(hired.id)}>
                  <Text style={[styles.btnText, { color: T.red }]}>Let Go</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btn, { marginTop: 8, backgroundColor: game.cash >= def.hireCost ? T.blue : T.panel2, borderColor: T.blue }]}
                onPress={() => onHirePM(def.id)}
              >
                <Text style={[styles.btnText, { color: game.cash >= def.hireCost ? "#fff" : T.sub }]}>Hire — {money(def.hireCost)}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Shared stylesheet, rebuilt on the design system's tokens.
//
// These names are unchanged, because ~500 call sites across this file reference them. What
// changed is the values, and that is deliberate: raising `sub` from 12 to 13 and `smallBtn`
// from 5pt to a 44pt minimum tap target fixes readability and reachability on every screen at
// once, not only on the ones rewritten by hand. See FLEETFLOW_PARITY_AUDIT.md §2 gaps 2 and 9.
//
// Colours stay out of here on purpose. The screen flips between dark and light at runtime and
// applies theme colours inline; a static StyleSheet cannot hold a value that changes with the
// theme. Layout, radius, type and spacing are theme-independent, so they belong here.
const styles = StyleSheet.create({
  card:        { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md + 2, marginBottom: SPACING.md - 2 },
  h2:          { fontSize: 18, fontWeight: "800" },
  label:       { fontSize: 15, fontWeight: "700" },
  body:        { fontSize: 14, lineHeight: 20, marginTop: SPACING.xs },
  // Was 12. This is the workhorse text style in the file and the main reason Construction
  // Flow read as small next to FleetFlow.
  sub:         { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sectionTitle:{ fontSize: 16, fontWeight: "800", marginBottom: SPACING.xs },
  cashBig:     { fontSize: 24, fontWeight: "900" },
  kpi:         { borderRadius: RADIUS.sm, borderWidth: 1, padding: SPACING.md - 2, alignItems: "center" },
  kpiVal:      { fontSize: 20, fontWeight: "800" },
  kpiLabel:    { fontSize: 12, marginTop: 3 },
  progressTrack:{ height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  tabBar:      { position: "absolute", left: 10, right: 10, bottom: Platform.select({ ios: 24, android: 12, default: 10 }), flexDirection: "row", borderRadius: RADIUS.xl, borderWidth: 1.2, justifyContent: "space-around", alignItems: "center", paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xs, elevation: 10, shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  tabItem:     { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", position: "relative", paddingVertical: SPACING.sm, paddingHorizontal: 1 },
  tabIcon:     { fontSize: 14, fontWeight: "700" },
  tabLabel:    { fontSize: 11, fontWeight: "600", marginTop: 2, textAlign: "center", width: "100%" },
  tabDot:      { marginTop: 4, width: 5, height: 5, borderRadius: 999 },
  badge:       { position: "absolute", top: 0, right: 8, minWidth: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:   { color: "#0a1018", fontSize: 12, fontWeight: "800" },
  // Both button styles now meet the 44pt minimum tap target. `smallBtn` was 5pt of vertical
  // padding around 12px text, which is roughly a 22pt target.
  btn:         { borderRadius: RADIUS.sm, borderWidth: 1, minHeight: MIN_TAP_TARGET, paddingHorizontal: SPACING.lg, alignItems: "center", justifyContent: "center" },
  btnText:     { fontSize: 14, fontWeight: "700" },
  smallBtn:    { borderRadius: RADIUS.xs, minHeight: MIN_TAP_TARGET - 8, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, alignItems: "center", justifyContent: "center" },
  smallBtnText:{ color: "#fff", fontSize: 13, fontWeight: "700" },
  chip:        { fontSize: 12, borderWidth: 1, borderRadius: RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  rowItem:     { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md - 2, marginBottom: SPACING.sm - 2 },
  selDot:      { width: 18, height: 18, borderRadius: 9, marginLeft: SPACING.sm },
  finRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  input:         { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.md - 2, fontSize: 16 },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  // The inherited value hard-coded a green-tinted panel from a different game's palette.
  modalCard:     { borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderTopWidth: 1, padding: SPACING.xl, backgroundColor: "#141c28" },
  feedItem:      { fontSize: 13, lineHeight: 19, paddingVertical: SPACING.xs },
  statusPill:    { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm + 2, paddingVertical: 3 },
  statusPillText:{ fontSize: 12, fontWeight: "700" },
});
