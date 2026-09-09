/**
 * ConstructionFlow — single-file Snack build. GENERATED — do not edit directly.
 * Regenerate with `node scripts/build-snack-single.js` from src/games/constructionflow/
 * ConstructionFlowScreen.js and src/systems/*.
 *
 * Paste this ENTIRE file over Snack's App.js. No other files needed — any gameplay system
 * the screen imports is inlined below as an isolated module (IIFE), and all 50
 * equipment/office images load from this repo's raw GitHub content instead of local requires.
 *
 * Dependencies used (all standard in Expo Go / Snack SDK 57):
 *   react, react-native, @react-native-async-storage/async-storage, @expo/vector-icons
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert, AppState, Platform, Modal,
  StatusBar, Dimensions, Animated, Switch, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// ─── ConstructionFlow game screen ───────────────────────────────────────────────

// NOTE: this screen used to import 12 modules from ../../systems/ and tick 15 of their
// functions every game day. Every one of them was inert: their output fields
// (g.aiCompetitors, g.economy, g.territories, g.analytics, g.pricing, g.weather,
// g.satisfaction, g.rfps, ...) were written each day and never read anywhere in gameplay
// or UI. Two were worse than inert — getConstructionWeatherDelay() applied its delay to
// `g.activeProjects`, a field that does not exist in this game (sites live in
// `g.activeSites`), so weather delay had never once fired; and tickInventory() was gated on
// `Array.isArray(g.inventory)`, which is never set because materials live in `g.materials`.
// initAnalytics was imported and never called at all, so tickAnalytics ran on uninitialised
// state. They are gone rather than wired up because this file already has better,
// player-visible equivalents for each concern: enhancedRivalDailyLogic + buildContractorRankings
// (rivals), the seasons/marketState/inflation block (economy), CITIES contract multipliers
// (territories), clientRelationships (satisfaction), the materialPrices walk (pricing), and
// WEATHER_PATTERNS/applyWeatherEvent (weather, now fixed below). The modules themselves stay
// in src/systems/ — RestaurantFlow and RealEstateFlow still import them.

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "constructionflow_v1_save";
// Rolling backup of the last save that loaded cleanly. Previously a single unreadable byte
// in STORAGE_KEY sent the loader straight into `catch (_) { freshState() }` — the player's
// whole company gone, with no warning and nothing to restore from. For a game people put
// weeks into, silent save loss is the worst possible failure. FleetFlow learned this the
// hard way and keeps the same pattern (see its BACKUP_STORAGE_KEY + applyEmergencyRecoveryV71).
const BACKUP_STORAGE_KEY = "constructionflow_v1_backup";
// Bumped only when a change makes old saves genuinely unreadable — migrateState() handles
// additive field changes on its own and does not need a bump.
const SAVE_SCHEMA_VERSION = 1;
const TABS = ["Home", "Bids", "Sites", "Crew", "Vehicles", "Finance", "Empire"];

const THEMES = {
  dark: {
    bg: "#071224", panel: "#0d1b33", panel2: "#12213d", panel3: "#182949",
    border: "#233455", strongBorder: "#31507d", text: "#f8fafc", sub: "#94a3b8",
    green: "#22c55e", red: "#ef4444", blue: "#3b82f6", orange: "#f59e0b",
    purple: "#8b5cf6", cyan: "#06b6d4", yellow: "#eab308", tabBar: "#0a1730",
    track: "#091321", shadow: "#000000",
  },
  light: {
    bg: "#edf3fb", panel: "#ffffff", panel2: "#f6f9fd", panel3: "#edf4fb",
    border: "#c9d7ea", strongBorder: "#aac0de", text: "#11213a", sub: "#5e7392",
    green: "#16a34a", red: "#dc2626", blue: "#2563eb", orange: "#d97706",
    purple: "#7c3aed", cyan: "#0891b2", yellow: "#ca8a04", tabBar: "#ffffff",
    track: "#d8e4f1", shadow: "#9bb0ca",
  },
};

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

// ─── Haptics ────────────────────────────────────────────────────────────────────
// Winning a bid, losing one, and finishing a job are the moments worth feeling. expo-haptics
// ships inside Expo Go, but it is loaded lazily inside a try/catch and every call is a no-op
// if it is missing: the single-file Snack build is Brady's only on-device testing path, and a
// hard `import` of a module Snack could not resolve would break the entire game rather than
// just the vibration. Failing silently is the correct trade here.
let _hapticsModule;
let _hapticsUnavailable = false;
function getHaptics() {
  if (_hapticsModule || _hapticsUnavailable) return _hapticsModule;
  try {
    _hapticsModule = require("expo-haptics");
  } catch (_) {
    _hapticsUnavailable = true;
  }
  return _hapticsModule;
}

// kind: "light" | "success" | "warning" | "error"
export function triggerHaptic(kind, enabled = true) {
  if (!enabled) return;
  if (Platform.OS === "web") return;
  const H = getHaptics();
  if (!H) return;
  try {
    if (kind === "light") H.impactAsync?.(H.ImpactFeedbackStyle?.Light);
    else if (kind === "success") H.notificationAsync?.(H.NotificationFeedbackType?.Success);
    else if (kind === "warning") H.notificationAsync?.(H.NotificationFeedbackType?.Warning);
    else if (kind === "error") H.notificationAsync?.(H.NotificationFeedbackType?.Error);
  } catch (_) {
    // A vibration failing must never surface to the player.
  }
}

// ─── Wage Scale ─────────────────────────────────────────────────────────────────
// ConstructionFlow prices labour PER DAY. FleetFlow — which most of these systems were
// ported from — prices it PER HOUR (`wagePerHour: 13`, `const desired = 18 * wagePressure`).
// During the port those hourly constants landed in ConstructionFlow's per-day fields, so
// createWorker() paid the three starting crew rand(160, 260)/day while createApplicant()
// and JOB_POSTINGS priced every subsequent hire at 18-32/day. Firing your starters and
// rehiring cut payroll by ~90%, which was both the strictly optimal opening move and the
// thing that removed labour — a construction company's largest real cost — as a source of
// pressure. Every wage number in this file now derives from this one table so the two
// scales cannot silently diverge again. See __tests__/constructionFlowWageScale.test.js.
// Opening bankroll. Roughly one month of a starting company's standing overhead (three crew,
// one pickup, shed rent), so the first contract genuinely matters. See the day-30 band in
// __tests__/constructionFlowEconomyCurve.test.js.
export const STARTING_CASH = 24000;

// Revolving credit line, unlocked at 680+ credit. Named so the Finance copy and the facility
// it describes cannot drift apart — the advertised terms were previously hardcoded in the UI
// string separately from the object that actually gets created.
export const CREDIT_LINE_LIMIT = 75000;
export const CREDIT_LINE_APR = 14;

export const WAGE_SCALE = {
  VERSION: 2,     // bumped when the scale itself changes; saves carry g.wageScaleVersion
  MIN: 120,       // hard floor a wage can be cut to (handleLowerWage)
  BASE_MIN: 160,  // default hire range — matches the starting crew exactly
  BASE_MAX: 260,
  DEFAULT: 200,   // fallback when a worker record predates a field or is malformed
  UNDERPAID: 170, // below this a skilled, unhappy worker starts looking elsewhere
};

// ─── Competitive Bidding ────────────────────────────────────────────────────────
// Winning work is the core fantasy of running a construction company, so it gets a real
// contest. Previously "Aggressive / Standard / Premium" were a bare payout multiplier
// applied at the moment the player pressed Start — there was no roll and no way to lose,
// which made Premium (+28% for nothing) strictly dominant and made every other choice a
// self-inflicted pay cut. Now the style sets the PRICE YOU BID, the client weighs that
// price against your reputation, relationships, readiness and the rival field, and you
// can lose the job.
//
// One table, used by the resolver, the UI odds readout and the tests alike — the three
// previously-duplicated copies of these multipliers are what let the UI and the payout
// drift apart in the first place.
export const BID_STYLES = [
  { key: "aggressive", label: "Aggressive", sub: "Underbid to win",   multiplier: 0.82, baseWin: 0.80, color: "orange" },
  { key: "standard",   label: "Standard",   sub: "Market rate",       multiplier: 1.00, baseWin: 0.55, color: "blue"   },
  { key: "premium",    label: "Premium",    sub: "Price at a premium", multiplier: 1.28, baseWin: 0.30, color: "green"  },
];
export const DEFAULT_BID_STYLE = "standard";

export function getBidStyle(key) {
  return BID_STYLES.find((b) => b.key === key) || BID_STYLES.find((b) => b.key === DEFAULT_BID_STYLE);
}

// Reads a perk value off the current head-office tier. OFFICES has advertised "+5% / +12%
// bid win chance" and "-10% / -15% delay penalties" in the upgrade UI since launch, but
// only materialDiscount was ever actually read — the other two perks were sold to the
// player and then silently ignored. Both are wired up now (bidBonus here, penaltyReduction
// in the site-completion penalty math).
export function getOfficePerkValue(g, key) {
  const perk = (OFFICES[g?.officeIndex || 0]?.perks || []).find((p) => p.key === key);
  return perk ? perk.value : 0;
}

// Probability of winning `contract` at `styleKey`, in 0.05..0.95. Pure and deterministic —
// the UI shows exactly the number the resolver rolls against, so the odds are never a lie.
export function computeBidWinChance(g, contract, styleKey) {
  const style = getBidStyle(styleKey);
  let chance = style.baseWin;

  // Reputation is the single biggest lever: an unknown contractor struggles to win at any
  // price, an elite one can hold out for premium rates.
  chance += ((g?.reputation || 0) - 30) / 200;                       // -0.15 .. +0.35

  // A better head office reads as a more credible bidder.
  chance += getOfficePerkValue(g, "bidBonus");                        // 0 .. +0.12

  // An Estimator on staff prices the job properly. This support role has been hireable
  // (and payrolled at $340/day) since launch while doing nothing whatsoever.
  const hasEstimator = (g?.officeStaff || []).some((sp) => sp.role === "Estimator");
  if (hasEstimator) chance += 0.06;

  // Repeat clients favour the contractor they already trust.
  if (contract?.clientId) {
    const rel = (g?.clientRelationships || {})[contract.clientId];
    const tier = getClientTier(rel?.loyalty || 0);
    chance += Math.min(0.10, (tier?.valueMult > 1 ? 0.06 : 0) + (rel?.jobsDone || 0) * 0.01);
  }

  // Visibly showing up with more crew and machines than the job strictly needs.
  const idleCrewCount = (g?.crew || []).filter((w) => w.status === "Idle").length;
  const idleEquipCount = (g?.equipment || []).filter((e) => e.status === "Idle").length;
  const crewHeadroom = idleCrewCount - (contract?.crewMin || 1);
  const equipHeadroom = idleEquipCount - (contract?.equipMin || 1);
  if (crewHeadroom > 0) chance += Math.min(0.05, crewHeadroom * 0.015);
  if (equipHeadroom > 0) chance += Math.min(0.03, equipHeadroom * 0.015);

  // A named rival actively chasing this job is real competition.
  if (contract?.interestedRival) chance -= 0.12;

  // Bigger jobs draw more and better-resourced bidders.
  const risk = contract?.risk || 1;
  chance -= Math.max(0, risk - 2) * 0.04;                             // 0 .. -0.12

  // A poor safety/compliance record costs you work, especially on public jobs.
  if ((g?.safetyScore ?? 60) < 40) chance -= 0.08;
  if ((contract?.category === "Government" || contract?.category === "Infrastructure")
      && (g?.complianceScore ?? 60) < 50) chance -= 0.08;

  return clamp(chance, 0.05, 0.95);
}

// Flat cost of preparing and submitting a bid — takeoffs, estimating time, bond paperwork.
// Charged win or lose, which is what stops "bid Premium on everything and reroll" from
// being free. Scaled to the job so it never dominates a small residential contract.
export function getBidPrepCost(contract) {
  return clamp(Math.round((contract?.value || 0) * 0.004), 60, 4000);
}

// ─── Diesel ─────────────────────────────────────────────────────────────────────
// Fuel used to be consumed and refilled without anyone ever paying for it: machines burned
// their tanks down while working, idle machines got a free 30% top-up overnight, and diesel
// never appeared as a cost. Worse, it was a silent job-killer — see refuelFleet below.
// Diesel is now bought at a fluctuating pump price and billed daily, which is what makes
// running a big fleet on a long job genuinely expensive.
const DIESEL_BASE_PRICE = 4.20;          // per unit; equipment burns ~12 units/day working
const DIESEL_MIN_PRICE = 2.60;
const DIESEL_MAX_PRICE = 8.40;

// Top every machine's tank up to capacity and bill for the fuel actually added. When cash is
// short the fleet gets a partial fill rather than nothing, so a cash squeeze slows the company
// down instead of bricking it. Returns the total spend so the caller can log it.
function refuelFleet(g) {
  const price = g.dieselPrice || DIESEL_BASE_PRICE;
  let unitsBought = 0;
  let spend = 0;
  for (const e of (g.equipment || [])) {
    if (!e.fuelCap) continue;                     // electric/static plant has no tank
    const needed = e.fuelCap - (e.fuel || 0);
    if (needed <= 0.01) continue;
    const affordable = Math.max(0, (g.cash - spend)) / price;
    const units = Math.min(needed, affordable);
    if (units <= 0.01) continue;
    e.fuel = (e.fuel || 0) + units;
    unitsBought += units;
    spend += units * price;
  }
  spend = Math.round(spend);
  if (spend > 0) {
    g.cash -= spend;
    g.expenses += spend;
    g.weeklyStats.expenses += spend;
    g.weeklyStats.fuel = (g.weeklyStats.fuel || 0) + spend;
  }
  return { spend, units: unitsBought };
}

// Re-staff and re-equip sites that have lost people or machines mid-job.
//
// A site only progresses while it has at least one crew member AND one usable machine
// assigned. Several systems remove them mid-job and none of them put anything back: a machine
// that runs dry is pulled off, a machine dropping below 20% condition goes to maintenance, and
// crew who quit, burn out or retire are stripped from assignedCrewIds. Once the last one went,
// the site froze at whatever phase it was on — permanently — while the remaining crew stayed
// "Active" on it, drawing full wages on a job that could never finish or pay.
//
// This was not a rare edge case: a 200-day simulated run reached 99% "has an active site"
// utilisation and completed ZERO jobs, because its only site had frozen around day 15 and
// never recovered. Sending idle resources back out each morning is what a foreman does.
function remobiliseSites(g) {
  for (const site of (g.activeSites || [])) {
    if (site.status !== "Active") continue;

    const equipShort = (site.equipMin || 1) - (site.assignedEquipmentIds || []).length;
    if (equipShort > 0) {
      const available = (g.equipment || []).filter(
        (e) => e.status === "Idle" && !e.assignedSiteId && (e.fuel || 0) > 0 && e.condition > 20
      );
      for (const e of available.slice(0, equipShort)) {
        e.status = "Active";
        e.assignedSiteId = site.contractId;
        site.assignedEquipmentIds = [...(site.assignedEquipmentIds || []), e.id];
        addLog(g, `\u{1F69C} ${e.name} sent back out to ${site.label}.`);
      }
    }

    const crewShort = (site.crewMin || 1) - (site.assignedCrewIds || []).length;
    if (crewShort > 0) {
      // Only crew with something left in the tank — putting an exhausted worker straight back
      // on site is how the burnout spiral starts.
      const available = (g.crew || []).filter(
        (w) => w.status === "Idle" && !w.assignedSiteId && (w.stamina ?? 50) > 25 && w.onShift !== false
      );
      for (const w of available.slice(0, crewShort)) {
        w.status = "Active";
        w.assignedSiteId = site.contractId;
        site.assignedCrewIds = [...(site.assignedCrewIds || []), w.id];
        addLog(g, `\u{1F477} ${w.name} reassigned to ${site.label} to keep it moving.`);
      }
    }

    // Nothing left to send. Say so plainly rather than letting the job rot in silence.
    if (!(site.assignedCrewIds || []).length || !(site.assignedEquipmentIds || []).length) {
      site._stalledDays = (site._stalledDays || 0) + 1;
      if (site._stalledDays === 2 || site._stalledDays % 7 === 0) {
        const missing = !(site.assignedCrewIds || []).length ? "crew" : "usable equipment";
        addLog(g, `\u26A0\uFE0F ${site.label} has no ${missing} and is not progressing — assign from Sites, or hire in Crew.`);
        addImportantNotice(g, `${site.label} is stalled with no ${missing}. It cannot finish until you staff it.`, "red");
      }
    } else {
      site._stalledDays = 0;
    }
  }
}

// ─── Equipment Acquisition: Rent, Finance, or Buy ───────────────────────────────
// Owning outright used to be the only way to put a machine on a job, which made the entire
// mid-game a cash-savings exercise: a $290k tower crane simply could not appear until you had
// $290k spare, so the contracts that need one were unreachable for reasons that had nothing
// to do with skill. Renting and financing are how real contractors bridge that, and they turn
// "can I afford this machine" into the more interesting "how should I pay for this machine".
//
//   Rent     — no capital, highest running cost. Right for one job, or a machine you need once.
//   Finance  — some capital, a weekly payment, and the machine is yours at the end. Repossessed
//              if you default, which is the risk that makes it a real decision.
//   Buy      — all the capital up front, lowest running cost. Always cheapest if you can afford it.
const RENTAL_DAY_RATE_MULT = 1.6;      // rented machines cost more per day than owned ones
const RENTAL_CAPITAL_RATE = 0.002;     // ...plus a slice of list price per day
const RENTAL_DELIVERY_RATE = 0.01;     // one-off float/delivery charge to get it on site
const FINANCE_DOWN_PCT = 0.20;         // deposit required to finance
const FINANCE_APR = 0.16;
const FINANCE_WEEKS = 52;
const FINANCE_REPO_MISSED_PAYMENTS = 3; // missed payments before the lender takes it back

// Daily cost of a rented machine. Deliberately well above its owned dailyCost so that renting
// is the expensive-but-accessible option and owning still wins over a long enough horizon.
export function getRentalDailyRate(item) {
  return Math.round((item?.dailyCost || 0) * RENTAL_DAY_RATE_MULT + (item?.price || 0) * RENTAL_CAPITAL_RATE);
}

export function getRentalDeliveryFee(item) {
  return Math.max(150, Math.round((item?.price || 0) * RENTAL_DELIVERY_RATE));
}

// A parked machine costs storage, insurance and depreciation — not fuel, wear and operator
// time. Charging the full operating rate on idle plant made owning equipment a pure liability
// between jobs: since a contract cannot be bid at all without its crewMin AND equipMin sitting
// idle, the game forced players to hold capacity and then billed them full rate for holding it.
// Measured across every operating policy, that was the single largest drain on the curve.
export const IDLE_EQUIPMENT_COST_FACTOR = 0.35;

// What a machine actually costs the company each day. One helper so the payroll rollup, the
// runway projection and the UI can never disagree about the number.
//
// Rentals are charged in full regardless: you pay the hire company for every day you keep the
// machine, working or not, which is exactly the pressure that makes renting a short-job tool
// and owning the long-term play.
export function getEquipmentDailyCost(e) {
  if (!e) return 0;
  if (e.isRental) return e.rentalDailyRate || 0;
  const base = e.dailyCost || 0;
  const working = e.status === "Active";
  return Math.round(working ? base : base * IDLE_EQUIPMENT_COST_FACTOR);
}

export function getFinanceTerms(item, discountedPrice) {
  const price = Number.isFinite(discountedPrice) ? discountedPrice : (item?.price || 0);
  const down = Math.round(price * FINANCE_DOWN_PCT);
  const principal = price - down;
  // Simple-interest amortisation over the term, matching how g.loans already prices credit.
  const total = Math.round(principal * (1 + FINANCE_APR * (FINANCE_WEEKS / 52)));
  const weeklyPayment = Math.max(1, Math.round(total / FINANCE_WEEKS));
  return { price, down, principal, total, weeklyPayment, weeks: FINANCE_WEEKS };
}

// Total weekly outflow committed to equipment finance — surfaced in Finance so the player can
// see what their fleet is costing them before taking on another machine.
export function getWeeklyEquipmentFinanceCost(g) {
  return (g?.equipmentLoans || []).reduce((sum, l) => sum + (l.weeklyPayment || 0), 0);
}

// ─── Progress Payments & Retainage ──────────────────────────────────────────────
// Construction is not paid on delivery — it is paid in draws as the work is certified, with
// a slice held back until the job is signed off. Previously ConstructionFlow paid a 25%
// deposit on mobilisation and the whole remaining 75% in one lump at completion, which meant
// a long job had no cash coming in for weeks and then a windfall. Now each completed phase
// bills its share, every payment has retainage withheld, and the retainage is released after
// a hold period once the job is done. Cash flow — not profit — becomes the thing you manage.
export const MOBILISATION_DEPOSIT_PCT = 0.12;   // was 0.25; the rest now arrives as you build
export const RETAINAGE_PCT = 0.08;              // withheld from every draw, released after sign-off
export const RETAINAGE_RELEASE_DAYS = 14;       // hold period after practical completion

// Gross value of one phase's draw. Phases are billed evenly across the contract, which keeps
// the schedule legible to the player (a 5-phase job pays a fifth at a time).
export function getPhaseDrawValue(site) {
  const phaseCount = (site?.phases || []).length;
  if (!phaseCount) return 0;
  return Math.round((site.totalValue || 0) / phaseCount);
}

// Pay `gross` against a site, withholding retainage. Returns the amounts so callers can log
// them. Mutates both site and game — the single place a site's billing is advanced, so
// billedToDate and retainageHeld can never disagree with the cash actually paid.
function billSiteDraw(g, site, gross, label) {
  const cappedGross = Math.max(0, Math.min(gross, (site.totalValue || 0) - (site.billedToDate || 0)));
  if (cappedGross <= 0) return { gross: 0, retained: 0, net: 0 };
  const retained = Math.round(cappedGross * RETAINAGE_PCT);
  const net = cappedGross - retained;
  site.billedToDate = (site.billedToDate || 0) + cappedGross;
  site.retainageHeld = (site.retainageHeld || 0) + retained;
  g.cash += net;
  g.revenue += net;
  g.weeklyStats.revenue += net;
  if (label) {
    addLog(g, `\uD83D\uDCB5 ${site.label}: ${label} — ${money(net)} received (${money(retained)} retainage held).`);
  }
  return { gross: cappedGross, retained, net };
}

// Total retainage currently withheld across live sites and completed-but-unreleased jobs.
// Surfaced in Finance so the player can see money they have earned but cannot yet spend.
export function getTotalRetainageHeld(g) {
  const onSites = (g?.activeSites || []).reduce((sum, s) => sum + (s.retainageHeld || 0), 0);
  const pending = (g?.pendingRetainage || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  return Math.round(onSites + pending);
}

// ─── Equipment Operating Hours ──────────────────────────────────────────────────
// Hours on the clock, not miles on the odometer, are how construction equipment is actually
// valued, serviced and traded. createEquipment() has carried a `mileage: 0` field since
// launch that was written once and never read or incremented by anything — a leftover of the
// port from FleetFlow, where vehicles genuinely drive. It is replaced by engine hours, which
// drive three things a player can feel: when a machine is due for service, how fast it wears
// once service is overdue, and what it is worth secondhand.
const OPERATING_HOURS_PER_TICK = 1 / 6;      // ~8 operating hours per in-game day (48 ticks)
const SERVICE_INTERVAL_HOURS = 250;          // a realistic-ish interval for plant equipment
const SERVICE_OVERDUE_WEAR_MULT = 2.2;       // skipping service costs you condition, fast
const SERVICE_OVERDUE_BREAKDOWN_MULT = 1.8;  // ...and makes breakdowns markedly likelier

export function getHoursSinceService(e) {
  return Math.max(0, (e?.engineHours || 0) - (e?.hoursAtLastService || 0));
}

export function isServiceDue(e) {
  return getHoursSinceService(e) >= SERVICE_INTERVAL_HOURS;
}

// How far past due, as a multiple of the interval: 0 while in service window, 1.0 at one
// full interval overdue. Used to scale wear and breakdown risk continuously rather than
// flipping a switch, so letting a machine drift 20 hours past due is a small cost and
// letting it drift 500 hours past due is a serious one.
export function getServiceOverdueRatio(e) {
  return Math.max(0, (getHoursSinceService(e) - SERVICE_INTERVAL_HOURS) / SERVICE_INTERVAL_HOURS);
}

// Secondhand value. Condition still dominates, but hours now matter independently: a
// well-maintained machine with 4,000 hours on it is worth materially less than an identical
// one with 200, which is what makes buying used (and running machines into the ground)
// a real decision rather than a cosmetic one.
export function getEquipmentResaleValue(e) {
  if (!e) return 0;
  const conditionFactor = Math.max(0, Math.min(1, (e.condition || 0) / 100));
  // Hours depreciation tapers rather than falling off a cliff: -50% at ~5,000 hours.
  const hoursFactor = 1 / (1 + (e.engineHours || 0) / 5000);
  const serviceFactor = isServiceDue(e) ? 0.88 : 1.0;  // an overdue service is priced in
  return Math.max(0, Math.round((e.price || 0) * 0.45 * conditionFactor * hoursFactor * serviceFactor));
}

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

// Phases during which the crew is working in or on the ground, and can therefore discover
// what the survey missed. Gates the unexpected-site-condition chaos events.
const GROUND_PHASES = new Set([
  "Survey", "Site Prep", "Demo", "Demolition", "Excavation", "Foundation",
  "Base Layer", "Earthworks", "Grading", "Utilities", "Piling", "Structure",
]);

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
  pickup:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/pickup.png" },
  skidsteer:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/skidsteer.png" },
  miniex:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/miniex.png" },
  compactor:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/compactor.png" },
  generator:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/generator.png" },
  backhoe:      { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/backhoe.png" },
  bulldozer:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/bulldozer.png" },
  dumptruck:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/dumptruck.png" },
  grader:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/grader.png" },
  mobcrane:     { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/mobcrane.png" },
  concpump:     { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/concpump.png" },
  telehandler:  { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/telehandler.png" },
  pavermachine: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/pavermachine.png" },
  towercrane:   { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/towercrane.png" },
  piledriver:   { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/piledriver.png" },
  drillingrig:  { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/drillingrig.png" },
  cargovan:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/cargovan.png" },
  trackloader:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/trackloader.png" },
  utilitytruck:   { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/utilitytruck.png" },
  stakebed:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/stakebed.png" },
  towtruck:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/towtruck.png" },
  sweeper:        { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/sweeper.png" },
  padfootroller:  { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/padfootroller.png" },
  trenchroller:   { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/trenchroller.png" },
  dustcannon:     { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/dustcannon.png" },
  scissorlift:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/scissorlift.png" },
  excavator:      { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/excavator.png" },
  wheelloader:    { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/wheelloader.png" },
  forklift:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/forklift.png" },
  mixertruck:     { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/mixertruck.png" },
  watertruck:     { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/watertruck.png" },
  fueltruck:      { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/fueltruck.png" },
  flatbedhauler:  { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/flatbedhauler.png" },
  boomtruck:      { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/boomtruck.png" },
  boomlift:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/boomlift.png" },
  trencher:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/trencher.png" },
  vibratoryroller:{ uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/vibratoryroller.png" },
  linepump:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/linepump.png" },
  spreadertruck:  { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/spreadertruck.png" },
  haultruck:      { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/haultruck.png" },
  vactruck:       { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/vactruck.png" },
  coldplaner:     { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/coldplaner.png" },
  crawlercrane:   { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/crawlercrane.png" },
  screeningplant: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/screeningplant.png" },
  crushingplant:  { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/equipment/crushingplant.png" },
};

// ─── Equipment Upgrades ─────────────────────────────────────────────────────────

const EQUIPMENT_UPGRADES = [
  { id: "engine",    label: "Engine Overhaul",   icon: "⚙️",  tiers: [{ tier:1, cost:3000, effect:"+6% speed" },{ tier:2, cost:9000, effect:"+12% speed" }] },
  { id: "telematics",label: "Telematics Kit",    icon: "📡",  tiers: [{ tier:1, cost:2000, effect:"-10% breakdown risk" },{ tier:2, cost:6000, effect:"-20% breakdown risk" }] },
  { id: "safety",    label: "Safety Package",    icon: "🦺",  tiers: [{ tier:1, cost:1500, effect:"-8% incident risk" },{ tier:2, cost:4500, effect:"-18% incident risk" }] },
];

// ─── Contract Definitions ────────────────────────────────────────────────────────

const CONTRACT_DEFS = [
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
  { id: "driveway",     label: "Driveway & Apron",         category: "Residential",
    minTier: 1, crewMin: 1, equipMin: 1,
    baseValue: 12500, durationDays: 4, phases: ["Site Prep","Base Layer","Concrete Pour"],
    materials: { concrete: 8 }, penaltyPerDay: 70, creditReq: 500, risk: 1,
    repReward: 2, creditReward: 2,
    desc: "Concrete driveway and apron. Quick turnaround, steady cash." },
  { id: "retaining_wall", label: "Retaining Wall",          category: "Residential",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 24000, durationDays: 7, phases: ["Survey","Excavation","Footings","Wall Build"],
    materials: { concrete: 14, steel: 2 }, penaltyPerDay: 110, creditReq: 500, risk: 1,
    repReward: 3, creditReward: 2,
    desc: "Engineered block wall on a sloping block. Earthwork practice." },
  { id: "shed_slab",    label: "Workshop Slab & Shed",      category: "Residential",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 16500, durationDays: 5, phases: ["Site Prep","Foundation","Erection"],
    materials: { concrete: 10, steel: 3 }, penaltyPerDay: 90, creditReq: 500, risk: 1,
    repReward: 2, creditReward: 2,
    desc: "Slab and kit shed for a rural block. Reliable filler work." },
  { id: "shopfit",      label: "Small Shop Fitout",         category: "Commercial",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 34000, durationDays: 8, phases: ["Strip Out","Framing","Services","Finishes"],
    materials: { lumber: 30, electrical: 14, plumbing: 6 },
    penaltyPerDay: 150, creditReq: 500, risk: 1,
    repReward: 3, creditReward: 3,
    desc: "Fitout for a local café or shop. First step into commercial work.",
    unlocksContractId: "comm_fitout" },
  // ── Infrastructure — reputation + community standing ─────────────────────────
  { id: "footpath",     label: "Footpath & Kerb Renewal",   category: "Infrastructure",
    minTier: 1, crewMin: 2, equipMin: 1,
    baseValue: 27000, durationDays: 7, phases: ["Survey","Demo","Base Layer","Concrete Pour"],
    materials: { concrete: 16, asphalt: 4 }, penaltyPerDay: 130, creditReq: 500, risk: 1,
    repReward: 3, creditReward: 3,
    desc: "Council footpath and kerb renewal. Visible community work." },
  { id: "drainage",     label: "Stormwater Drainage",       category: "Infrastructure",
    minTier: 1, crewMin: 3, equipMin: 1,
    baseValue: 52000, durationDays: 11, phases: ["Survey","Excavation","Pipe Laying","Backfill","Inspection"],
    materials: { concrete: 20, plumbing: 18 }, penaltyPerDay: 240, creditReq: 500, risk: 2,
    repReward: 4, creditReward: 4,
    desc: "Stormwater upgrade for a low-lying street. Trenching and utilities work.",
    unlocksContractId: "city_road" },

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

export const MATERIAL_DEFS = [
  { id: "concrete",   label: "Concrete",   unit: "m³",   basePrice: 120, volatility: 0.14, icon: "layers" },
  { id: "lumber",     label: "Lumber",     unit: "sheets",basePrice: 85,  volatility: 0.18, icon: "leaf" },
  { id: "steel",      label: "Steel",      unit: "tons",  basePrice: 950, volatility: 0.20, icon: "build" },
  { id: "electrical", label: "Electrical", unit: "spools",basePrice: 45,  volatility: 0.10, icon: "flash" },
  { id: "plumbing",   label: "Plumbing",   unit: "meters",basePrice: 38,  volatility: 0.10, icon: "water" },
  { id: "asphalt",    label: "Asphalt",    unit: "tons",  basePrice: 200, volatility: 0.12, icon: "map" },
];

// ─── Office Tiers (analog to Properties) ────────────────────────────────────────

export const OFFICES = [
  { id: 0, name: "Shed & Trailer",      cost: 0,      crewCap: 4,  equipCap: 2,  dailyRent: 50,   perks: [], desc: "One phone, one whiteboard, unlimited ambition." },
  { id: 1, name: "Rented Portakabin",   cost: 3500,   crewCap: 8,  equipCap: 4,  dailyRent: 160,  perks: [{ key: "bidBonus", value: 0.05, label: "+5% bid win chance" }], desc: "A proper on-site office. Clients trust you more." },
  { id: 2, name: "Small Site Office",   cost: 15000,  crewCap: 16, equipCap: 8,  dailyRent: 420,  perks: [{ key: "penaltyReduction", value: 0.10, label: "-10% delay penalties" }], desc: "Room to grow and plan bigger projects." },
  { id: 3, name: "Project Office",      cost: 45000,  crewCap: 30, equipCap: 18, dailyRent: 1100, perks: [{ key: "materialDiscount", value: 0.08, label: "-8% material costs" },{ key: "penaltyReduction", value: 0.15, label: "-15% delay penalties" }], desc: "A full project management hub." },
  { id: 4, name: "HQ Tower Suite",      cost: 110000, crewCap: 80, equipCap: 50, dailyRent: 2800, perks: [{ key: "bidBonus", value: 0.12, label: "+12% bid win chance" },{ key: "materialDiscount", value: 0.15, label: "-15% material costs" }], desc: "When you sign contracts, people stand up." },
];

// Keyed by OFFICES[].id (0-4), same pattern as EQUIPMENT_IMAGES.
export const OFFICE_IMAGES = {
  0: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/shed.png" },
  1: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/portakabin.png" },
  2: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/smalloffice.png" },
  3: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/projectoffice.png" },
  4: { uri: "https://raw.githubusercontent.com/wildbearofficialco-png/constructionFlow/main/constructionFlow/assets/construction/office/hqtower.png" },
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
    // Outliving your rivals is not the same as dominating them. Rivals go bankrupt on their
    // own through enhancedRivalDailyLogic, and a bankrupt rival satisfies the per-rival test
    // below — so a company that never took a single job used to collect the $500,000 bonus
    // around day 49 simply by existing while the AI destroyed itself. The valuation floor is
    // what makes this an achievement: you have to have actually built something first.
    check: (g) => {
      const rivals = g.rivals || [];
      if (!rivals.length) return false;
      if ((g.companyValuation || 0) < DOMINATION_MIN_VALUATION) return false;
      return rivals.every((r) => r.status === "Bankrupt"
        || (g.companyValuation || 0) > ((r.cash || 0) + (r.rep || 0) * 50000) * 10);
    },
    reward: (g) => { g.cash += 500000; addLog(g, "👑 Market Domination achieved! $500k bonus!"); } },
];

// Floor a company must clear before "Market Domination" can be claimed — see that milestone.
export const DOMINATION_MIN_VALUATION = 5000000;

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

const REGIONAL_OFFICE_TYPES = [
  { id:"small_office",     name:"Small Office",     cost:25000,   dailyRent:150,  crewBonus:5,  contractSlots:3,  desc:"Covers a local area. Room for a small team." },
  { id:"regional_office",  name:"Regional Office",  cost:80000,   dailyRent:450,  crewBonus:15, contractSlots:8,  desc:"Multi-site coordination hub." },
  { id:"corporate_office", name:"Corporate Office", cost:200000,  dailyRent:1200, crewBonus:30, contractSlots:18, desc:"Full corporate presence in the city." },
  { id:"state_hq",         name:"State HQ",         cost:500000,  dailyRent:3000, crewBonus:60, contractSlots:35, desc:"Dominant player in the state." },
  { id:"national_hq",      name:"National HQ",      cost:1500000, dailyRent:9000, crewBonus:150,contractSlots:80, desc:"Commands national market presence." },
];

// ─── Property Types ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { id:"equipment_yard",     name:"Equipment Yard",     cost:40000,  dailyCost:120, weeklyIncome:400,  resaleRate:0.80, equipCapBonus:5,  materialDiscount:0,    eliminatesRent:false, desc:"Stores 5 extra machines and cuts maintenance fees." },
  { id:"storage_lot",        name:"Storage Lot",        cost:25000,  dailyCost:75,  weeklyIncome:250,  resaleRate:0.80, equipCapBonus:0,  materialDiscount:0.05, eliminatesRent:false, desc:"Bulk material storage. 5% off material orders." },
  { id:"material_warehouse", name:"Material Warehouse", cost:75000,  dailyCost:200, weeklyIncome:750,  resaleRate:0.80, equipCapBonus:0,  materialDiscount:0.15, eliminatesRent:false, desc:"Full warehouse. 15% off all material purchases." },
  { id:"office_property",    name:"Office Property",    cost:120000, dailyCost:0,   weeklyIncome:600,  resaleRate:0.85, equipCapBonus:0,  materialDiscount:0,    eliminatesRent:true,  desc:"Own instead of rent. Eliminates home office daily rent." },
];

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
  // Valued off the same resale model the Sell button uses, so the company's stated worth
  // and what its fleet would actually fetch cannot drift apart.
  const equipValue = (g.equipment||[]).reduce((s,e) => s + getEquipmentResaleValue(e) / 0.45 * 0.6, 0);
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
  const dailyBurn = (g.crew||[]).reduce((s,w)=>s+(w.wagePerDay||0),0)+(g.equipment||[]).reduce((s,e)=>s+getEquipmentDailyCost(e),0)+(OFFICES[g.officeIndex||0]?.dailyRent||0);
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

export function getPredictiveWarnings(g) {
  const warnings = [];
  const dailyBurn=(g.crew||[]).reduce((s,w)=>s+(w.wagePerDay||0),0)+(g.equipment||[]).reduce((s,e)=>s+getEquipmentDailyCost(e),0)+(OFFICES[g.officeIndex||0]?.dailyRent||0);
  const runway=dailyBurn>0?Math.floor((g.cash||0)/dailyBurn):999;
  if (runway<5) warnings.push({ text:`Cash runway critical — only ${runway} day${runway!==1?"s":""} left`, severity:"high" });
  const overdue=(g.activeSites||[]).filter(s=>s.status==="Active"&&(g.day>(s.deadlineDay||9999)));
  for (const s of overdue.slice(0,2)) warnings.push({ text:`"${s.label}" is overdue — penalties accumulating`, severity:"high" });
  const badEquip=(g.equipment||[]).filter(e=>(e.condition ?? 100)<30);
  if (badEquip.length>0) warnings.push({ text:`${badEquip.length} vehicle${badEquip.length>1?"s":""} below 30% condition — breakdown risk`, severity:"medium" });
  const missingSite=(g.activeSites||[]).find(s=>{ const con=(g.contracts||[]).find(c=>c.id===s.contractId); const def=CONTRACT_DEFS.find(d=>d.id===con?.defId); return def?.materials&&Object.entries(def.materials).some(([m,n])=>((s.materialsFulfilled||{})[m]||0)<n); });
  if (missingSite) warnings.push({ text:`"${missingSite.label}" is stalled — missing materials`, severity:"medium" });
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

function getTotalCrewCap(g) {
  const officeTier = OFFICES[g.officeIndex || 0];
  const officeBonus = (g.cityOffices||[]).reduce((s,o) => {
    const def = REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId);
    return s + (def ? def.crewBonus : 0);
  }, 0);
  const propBonus = (g.properties||[]).reduce((s,p) => {
    const def = PROPERTY_TYPES.find(t=>t.id===p.typeId);
    return s + (def ? def.equipCapBonus : 0); // reuse field for crew in office_property
  }, 0);
  return (officeTier?.crewCap || 4) + officeBonus;
}

function getMaterialDiscount(g) {
  const officePerk = OFFICES[g.officeIndex||0]?.perks?.find(p=>p.key==="materialDiscount");
  const baseDisc = officePerk ? officePerk.value : 0;
  const propDisc = (g.properties||[]).reduce((s,p) => {
    const def = PROPERTY_TYPES.find(t=>t.id===p.typeId);
    return s + (def ? (def.materialDiscount||0) : 0);
  }, 0);
  return Math.min(0.40, baseDisc + propDisc); // cap at 40%
}

function getEquipCapBonus(g) {
  return (g.properties||[]).reduce((s,p) => {
    const def = PROPERTY_TYPES.find(t=>t.id===p.typeId);
    return s + (def ? (def.equipCapBonus||0) : 0);
  }, 0);
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
        if (goal.cashReward) { g.cash += goal.cashReward; g.revenue += goal.cashReward; }
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

const CHAOS_EVENTS = [
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
      const fine = rand(2000, 8000);
      game.cash -= fine;
      game.reputation = Math.max(0, game.reputation - rand(2, 6));
      addLog(game, `🦺 Safety incident on ${site.label}! Fine of ${money(fine)} issued.`);
      return { text: `Safety incident — ${money(fine)} fine, reputation hit.`, type: "safety" };
    }
  },
  { id: "permit",     label: "Permit Delay",          prob: 0.02, tone: "yellow", icon: "📋",
    apply: (site, game) => {
      site.status = "Paused";
      const days = rand(2, 5);
      site.pausedDays = (site.pausedDays || 0) + days;
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
        const baseVal = site.totalValue || 8000;
        const fine = Math.max(500, Math.round(baseVal * rand(8, 18) / 100 / 100) * 100);
        game.cash -= fine;
        site.status = "Paused";
        site.pausedDays = rand(2, 4);
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
      addLog(game, `🔴 ${equip.name} subject to safety recall — pulled from ${site.label}.`);
      return { text: `${equip.name} recalled for safety. Pulled from site.`, type: "recall" };
    }
  },
  // ── Unexpected site conditions ────────────────────────────────────────────────
  // What is actually in the ground is the classic construction unknown, and it is the risk
  // that most distinguishes this from a delivery game: you bid a job before you know what you
  // will hit. Each is gated to the phases where it could plausibly be discovered — you do not
  // strike a gas main while hanging drywall — via `groundPhase` below.
  { id: "rock_strata", label: "Rock Strata Hit", prob: 0.016, tone: "orange", icon: "⛰️", groundPhase: true,
    apply: (site, game) => {
      const extraCost = Math.max(1500, Math.round((site.totalValue || 20000) * rand(3, 8) / 100));
      const lostDays = rand(1, 3);
      game.cash -= extraCost;
      game.expenses += extraCost;
      game.weeklyStats.unexpectedCosts = (game.weeklyStats.unexpectedCosts || 0) + extraCost;
      site.phaseProgress = Math.max(0, site.phaseProgress - rand(10, 22));
      site.deadlineDay += lostDays;
      addLog(game, `⛰️ ${site.label}: Hit rock during excavation — ${money(extraCost)} in breaking and hauling, ${lostDays} day(s) lost.`);
      return { text: `Rock strata hit. ${money(extraCost)} extra, ${lostDays} day(s) lost.`, type: "ground_rock" };
    }
  },
  { id: "water_table", label: "High Water Table", prob: 0.013, tone: "cyan", icon: "💧", groundPhase: true,
    apply: (site, game) => {
      const extraCost = Math.max(1200, Math.round((site.totalValue || 20000) * rand(2, 6) / 100));
      game.cash -= extraCost;
      game.expenses += extraCost;
      game.weeklyStats.unexpectedCosts = (game.weeklyStats.unexpectedCosts || 0) + extraCost;
      site.phaseProgress = Math.max(0, site.phaseProgress - rand(8, 16));
      addLog(game, `💧 ${site.label}: Water table higher than surveyed — ${money(extraCost)} on dewatering pumps.`);
      return { text: `High water table. ${money(extraCost)} on dewatering.`, type: "ground_water" };
    }
  },
  { id: "contaminated_soil", label: "Contaminated Soil", prob: 0.007, tone: "red", icon: "☣️", groundPhase: true,
    apply: (site, game) => {
      const extraCost = Math.max(3000, Math.round((site.totalValue || 20000) * rand(5, 12) / 100));
      const pauseDays = rand(2, 5);
      game.cash -= extraCost;
      game.expenses += extraCost;
      game.weeklyStats.unexpectedCosts = (game.weeklyStats.unexpectedCosts || 0) + extraCost;
      site.status = "Paused";
      site.pausedDays = (site.pausedDays || 0) + pauseDays;
      site.deadlineDay += pauseDays;
      addLog(game, `☣️ ${site.label}: Contaminated soil found — remediation ${money(extraCost)}, site closed ${pauseDays} day(s) pending clearance.`);
      return { text: `Contaminated soil. ${money(extraCost)} remediation, paused ${pauseDays} day(s).`, type: "ground_contamination" };
    }
  },
  { id: "utility_strike", label: "Underground Utility Strike", prob: 0.009, tone: "red", icon: "⚡", groundPhase: true,
    apply: (site, game) => {
      const extraCost = Math.max(2000, Math.round((site.totalValue || 20000) * rand(4, 9) / 100));
      const pauseDays = rand(1, 3);
      game.cash -= extraCost;
      game.expenses += extraCost;
      game.weeklyStats.unexpectedCosts = (game.weeklyStats.unexpectedCosts || 0) + extraCost;
      site.status = "Paused";
      site.pausedDays = (site.pausedDays || 0) + pauseDays;
      site.deadlineDay += pauseDays;
      // Hitting an unmarked service is a safety and compliance event, not just a cost.
      game.complianceScore = Math.max(0, (game.complianceScore ?? 60) - rand(3, 7));
      applyIncident(game, 1);
      addLog(game, `⚡ ${site.label}: Struck an unmarked service line — ${money(extraCost)} in repairs, utility shut the site for ${pauseDays} day(s).`);
      return { text: `Utility strike. ${money(extraCost)} repairs, ${pauseDays} day(s) closed.`, type: "ground_utility" };
    }
  },
  { id: "archaeological_find", label: "Archaeological Find", prob: 0.003, tone: "yellow", icon: "🏺", groundPhase: true,
    apply: (site, game) => {
      const pauseDays = rand(4, 9);
      site.status = "Paused";
      site.pausedDays = (site.pausedDays || 0) + pauseDays;
      site.deadlineDay += pauseDays;
      addLog(game, `🏺 ${site.label}: Artefacts uncovered — heritage assessment ordered. Site halted ${pauseDays} day(s), deadline extended.`);
      return { text: `Archaeological find. Halted ${pauseDays} day(s) for assessment.`, type: "ground_heritage" };
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
      if (_matIds.length > 0) {
        const _matId = _matIds[Math.floor(Math.random() * _matIds.length)];
        if (site.materialsFulfilled) site.materialsFulfilled[_matId] = Math.max(0, (site.materialsFulfilled[_matId]||0) - 2);
      }
      addLog(game, `🔴 Material theft at ${site.label} — inventory reduced.`);
      return { text: `Material theft — on-site materials reduced.`, type: "material_theft" };
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

// Exported for tests only: the ground-condition events are data with side effects, and the
// tests assert each one actually costs the player something rather than silently no-opping.
export const CHAOS_EVENTS_FOR_TEST = CHAOS_EVENTS;

// ─── Change Orders ──────────────────────────────────────────────────────────────
// A client changing their mind mid-build is the most characteristic thing that happens on a
// construction job, and it is a genuine decision rather than a dice roll: more money and a
// longer deadline against tying your crew up and pushing everything behind it. Kept in its
// own catalogue (not DECISION_EVENTS) because it needs a specific site as context and must
// never be selected by the generic `pick(DECISION_EVENTS)` draw.
//
// Every option's apply() reads g.pendingDecision.context, matching how EMPLOYEE_EVENTS work:
// only serializable fields are stored on the pending decision, and the handlers are looked up
// by id at render time.
const CHANGE_ORDER_EVENT = {
  id: "change_order",
  title: "📝 Change Order",
  tone: "cyan",
  options: [
    {
      label: "Accept the change",
      sub: "More money, more time, crew stays committed",
      apply: (g) => {
        const ctx = g.pendingDecision?.context || {};
        const site = (g.activeSites || []).find((s) => s.id === ctx.siteId);
        if (!site) return;
        site.totalValue = Math.round((site.totalValue || 0) + (ctx.valueAdd || 0));
        site.deadlineDay = (site.deadlineDay || g.day) + (ctx.extraDays || 0);
        site.durationDays = (site.durationDays || 0) + (ctx.extraDays || 0);
        // The added scope is real work: it costs progress on the phase in hand.
        site.phaseProgress = Math.max(0, (site.phaseProgress || 0) - (ctx.progressCost || 0));
        site.changeOrders = [...(site.changeOrders || []), {
          day: g.day, valueAdd: ctx.valueAdd || 0, extraDays: ctx.extraDays || 0,
        }];
        // Accommodating a client builds the relationship that wins the next job.
        if (ctx.clientId) {
          if (!g.clientRelationships) g.clientRelationships = {};
          const rel = g.clientRelationships[ctx.clientId] || { loyalty: 0, jobsDone: 0, lastJobDay: null };
          rel.loyalty = Math.min(100, (rel.loyalty ?? 0) + 4);
          g.clientRelationships[ctx.clientId] = rel;
        }
        addLog(g, `📝 Change order accepted on ${site.label}: +${money(ctx.valueAdd || 0)}, +${ctx.extraDays || 0} days.`);
        addImportantNotice(g, `Change order accepted — contract now ${money(site.totalValue)}.`, "green");
      },
    },
    {
      label: "Decline — build to the original scope",
      sub: "Protect the schedule, disappoint the client",
      apply: (g) => {
        const ctx = g.pendingDecision?.context || {};
        const site = (g.activeSites || []).find((s) => s.id === ctx.siteId);
        g.reputation = Math.max(0, (g.reputation || 0) - 1);
        if (ctx.clientId) {
          if (!g.clientRelationships) g.clientRelationships = {};
          const rel = g.clientRelationships[ctx.clientId] || { loyalty: 0, jobsDone: 0, lastJobDay: null };
          rel.loyalty = Math.max(0, (rel.loyalty ?? 0) - 6);
          g.clientRelationships[ctx.clientId] = rel;
        }
        addLog(g, `📝 Change order declined on ${site?.label || "site"} — building to original scope. Client unimpressed.`);
        addImportantNotice(g, "Change order declined — schedule protected, client relationship dented.", "orange");
      },
    },
  ],
};

// What a client might ask for mid-build, paired with the phases it plausibly follows.
const CHANGE_ORDER_REQUESTS = [
  { text: "wants the finishes upgraded throughout", valuePct: [0.08, 0.16], days: [2, 5] },
  { text: "has asked for an extra room added to the plans", valuePct: [0.12, 0.24], days: [4, 9] },
  { text: "wants the electrical spec brought up to commercial grade", valuePct: [0.06, 0.14], days: [2, 4] },
  { text: "is asking for a larger slab than the drawings show", valuePct: [0.10, 0.20], days: [3, 7] },
  { text: "wants additional site drainage after seeing the last storm", valuePct: [0.07, 0.15], days: [2, 6] },
  { text: "has requested a revised layout for the service areas", valuePct: [0.05, 0.12], days: [1, 4] },
  { text: "wants premium fixtures substituted throughout", valuePct: [0.06, 0.13], days: [1, 3] },
];

// Exported for tests only: the modal dispatches these by id at render time, so a test has to
// reach the same handler objects the UI does rather than reimplementing their effects.
export const CHANGE_ORDER_EVENT_FOR_TEST = CHANGE_ORDER_EVENT;

const DECISION_EVENTS = [
  {
    id: "supplier_deal", title: "📦 Supplier Deal", tone: "cyan",
    desc: "Your materials supplier offers a one-time 30% discount on bulk lumber and concrete if you commit $8,000 today.",
    options: [
      { label: "Take the deal", sub: "Spend $8,000 → receive 40 lumber + 15 concrete", apply: (g) => { if (g.cash >= 8000) { g.cash -= 8000; g.expenses += 8000; g.materials.lumber = (g.materials.lumber||0)+40; g.materials.concrete = (g.materials.concrete||0)+15; addLog(g, "📦 Took supplier deal — 40 lumber + 15 concrete at 30% off!"); addImportantNotice(g, "Bulk deal: 40 lumber + 15 concrete purchased for $8,000.", "green"); } } },
      { label: "Pass", sub: "Keep your cash", apply: (g) => { addImportantNotice(g, "Supplier deal declined — cash kept.", "neutral"); } },
    ],
  },
  {
    id: "investor_offer", title: "💼 Angel Investor", tone: "green",
    desc: "A local investor offers $120,000 cash today. In return, you agree to pay $1,200/week until $180,000 total is repaid.",
    options: [
      { label: "Accept investment", sub: "+$120,000 now, $1,200/week repayment", apply: (g) => { g.cash += 120000; g.loans = g.loans || []; g.loans.push({ id: uid(), label: "Angel Investment", weeklyPayment: 1200, weeksLeft: 150, remainingBalance: 180000, missedPayments: 0 }); addLog(g, "💼 Angel investor deal closed — $120,000 received."); addImportantNotice(g, "Angel investment: $120,000 received — loan created.", "green"); } },
      { label: "Decline", sub: "No debt, no strings", apply: (g) => { addImportantNotice(g, "Angel investor declined — no debt taken on.", "neutral"); } },
    ],
  },
  {
    id: "rival_poach", title: "📉 Rival Struggling", tone: "orange",
    desc: "A struggling rival's best worker is looking for a new employer. You can hire them for a $10,000 signing bonus.",
    options: [
      { label: "Poach them", sub: "Pay $10,000 — get a skilled Veteran worker", apply: (g) => { if (g.cash >= 10000) { g.cash -= 10000; g.expenses += 10000; const w = createWorker("Site Foreman"); w.skill = rand(100, 118); w.trait = CREW_TRAITS.find(t => t.label === "Veteran") || pick(CREW_TRAITS); w.wagePerDay = rand(220, 320); w.hireDay = g.day; g.crew.push(w); addLog(g, `👷 Poached ${w.name} from struggling rival — Veteran Foreman hired.`); addImportantNotice(g, `Veteran crew member poached from rival for $10,000.`, "green"); } } },
      { label: "Stay out", sub: "Not your business", apply: (g) => { addImportantNotice(g, "Rival's worker not hired — cash saved.", "neutral"); } },
    ],
  },
  {
    id: "rush_bid", title: "⚡ Emergency Contract", tone: "yellow",
    desc: "A client needs urgent repair work — double the going rate but the deadline is 4 days with heavy penalties.",
    options: [
      { label: "Take the rush job", sub: "2× value, 4-day deadline, 3× penalty/day", apply: (g) => { const base = CONTRACT_DEFS.find(d => d.category === "Commercial" && d.minTier <= 2); if (base) { const c = createContract(g); c.value = Math.round(c.value * 2.0); c.deadline = g.day + 5; c.expiresDay = g.day + 2; c.penaltyPerDay = (c.penaltyPerDay || 200) * 3; c.label = "⚡ " + c.label; g.contracts.push(c); addLog(g, `⚡ Emergency contract added — high value, tight window.`); addImportantNotice(g, "Rush contract added — tight deadline, 2× payout. Check Bids.", "orange"); } } },
      { label: "Turn it down", sub: "Too risky right now", apply: (g) => { addImportantNotice(g, "Emergency contract declined — too risky.", "neutral"); } },
    ],
  },
  {
    id: "bulk_equipment_deal", title: "🚜 Fleet Discount", tone: "cyan",
    desc: "An equipment dealer offers 20% off any purchase today only. Valid for next machine you buy.",
    options: [
      { label: "Lock in the discount", sub: "Next equipment purchase: -20%", apply: (g) => { g._equipDiscount = 0.20; g._equipDiscountExpiry = (g.day||1) + 3; addLog(g, "🚜 Fleet discount locked — 20% off next machine for 3 days!"); addImportantNotice(g, "20% equipment discount active for 3 days — visit Vehicles.", "green"); } },
      { label: "Not now", sub: "No savings today", apply: (g) => { addImportantNotice(g, "Equipment discount passed — no purchase planned.", "neutral"); } },
    ],
  },
  {
    id: "govt_contract_tip", title: "🏛️ Gov't Insider", tone: "purple",
    desc: "A contact tips you off: a major government contract is coming. Spend $3,000 on prep work to get priority bid access.",
    options: [
      { label: "Invest in prep", sub: "$3,000 → priority on next Government contract", apply: (g) => { if (g.cash >= 3000) { g.cash -= 3000; g.expenses += 3000; g._govtPriority = true; addLog(g, "🏛️ Invested in government prep — priority access on next Gov contract."); addImportantNotice(g, "Government contract tip: $3,000 invested — priority bid access unlocked.", "green"); } } },
      { label: "Skip it", sub: "Save your cash", apply: (g) => { addImportantNotice(g, "Government contract tip declined.", "neutral"); } },
    ],
  },
  {
    id: "competitor_acquisition", title: "🤝 Acquisition Offer", tone: "orange",
    desc: "Northwest Contractors is in financial trouble. You can acquire them for $160,000 — absorbing their 3 crew and 1 machine.",
    options: [
      { label: "Acquire them", sub: "$160,000 → 3 workers + 1 machine + rep boost", apply: (g) => { if (g.cash >= 160000) { g.cash -= 160000; g.expenses += 160000; for (let i=0;i<3;i++) { const w = createWorker(); w.skill = rand(90,110); w.hireDay = g.day; g.crew.push(w); } const acquiredMachine = createEquipment(EQUIPMENT_SHOP[1] || EQUIPMENT_SHOP[0]); acquiredMachine.condition = rand(60, 80); acquiredMachine.name = "Acquired " + acquiredMachine.name; g.equipment = g.equipment || []; g.equipment.push(acquiredMachine); g.reputation = Math.min(100,(g.reputation||0)+5); if (!(g.acquiredRivals||[]).includes("northwest")) g.acquiredRivals = [...(g.acquiredRivals||[]),"northwest"]; addLog(g, "🤝 Acquired Northwest Contractors — 3 crew, 1 machine absorbed!"); addImportantNotice(g, "Rival acquired! +3 crew, +1 equipment, +5 reputation.", "green"); } } },
      { label: "Pass", sub: "Not the right time", apply: (g) => { addImportantNotice(g, "Acquisition passed — not the right time.", "neutral"); } },
    ],
  },
  {
    id: "material_futures", title: "📊 Material Futures", tone: "yellow",
    desc: "Lock in today's steel price for 30 days by pre-paying $8,000. Protects against market volatility.",
    options: [
      { label: "Lock in steel price", sub: "$8,000 → steel price frozen for 30 days", apply: (g) => { if (g.cash >= 8000) { g.cash -= 8000; g.expenses += 8000; g._steelPriceLock = (g.day||1) + 30; g._steelPriceLocked = g.materialPrices.steel || 950; addLog(g, "📊 Steel price locked for 30 days — protected from volatility."); addImportantNotice(g, "Steel price locked for 30 days — protected from market spikes.", "green"); } } },
      { label: "Skip the hedge", sub: "Take your chances", apply: (g) => { addImportantNotice(g, "Material futures declined — steel price exposed to market.", "neutral"); } },
    ],
  },
  {
    id: "training_grant", title: "🎓 Government Grant", tone: "green",
    desc: "A regional skills grant offers to fund $10,000 worth of crew training. Accept or lose the allocation.",
    options: [
      { label: "Accept the grant", sub: "+$10,000 training credit", apply: (g) => { g.cash += 10000; addLog(g, "🎓 Government training grant accepted — $10,000 added to operating funds."); addImportantNotice(g, "Training grant received: $10,000 added to cash.", "green"); } },
      { label: "Decline", sub: "Someone else gets it", apply: (g) => { addImportantNotice(g, "Training grant declined — someone else takes it.", "neutral"); } },
    ],
  },
  {
    id: "insurance_payout",
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
    id: "corner_cut", title: "✂️ Client Wants to Cut Corners", tone: "red",
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
    id: "foreman_ultimatum", title: "💼 Foreman Demands a Raise or Quits", tone: "orange",
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
    id: "inspector_violation", title: "🚨 Inspector Found a Violation", tone: "red",
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
    id: "emergency_job", title: "🚨 Emergency Project Offer", tone: "green",
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
    id: "union_rep", title: "🤝 Union Representative Visits", tone: "orange",
    desc: "A labor organizer is on your site talking to crew. How you respond will shape morale and wages.",
    options: [
      { label: "Engage cooperatively", sub: "All wages +8% · loyalty +8 · mood +10", apply: (g) => {
        for (const w of (g.crew||[])) { w.wagePerDay=Math.round((w.wagePerDay||WAGE_SCALE.DEFAULT)*1.08); w.loyalty=Math.min(100,(w.loyalty ?? 50)+8); w.mood=Math.min(100,(w.mood ?? 50)+10); }
        addLog(g,"🤝 Cooperative with union — wages +8%, morale boosted.");
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
    id: "subcontractor_dispute", title: "⚠️ Subcontractor Dispute", tone: "orange",
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
    id: "delay_regulatory", title: "📜 Regulatory Hold", tone: "yellow",
    desc: "Inspectors have flagged this site for a compliance review.",
    options: [
      { label: "Wait It Out", sub: "Pause and pay compliance fee", apply: (g) => {
        const pd = g.pendingDecision;
        const site = (g.activeSites||[]).find(s => s.id === pd.siteId);
        if (site) { site.status = "Paused"; site.pausedDays = (site.pausedDays||0) + (pd.delayDays||5); }
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
          if (site) { site.status = "Paused"; site.pausedDays = (site.pausedDays||0) + reducedDays; }
          g.cash -= totalCost; g.expenses = (g.expenses||0) + totalCost;
          addLog(g, `📜 Expedited regulatory process — ${money(totalCost)} paid, only ${reducedDays} day pause.`);
          addImportantNotice(g, `Expedited review: ${money(totalCost)} paid, hold cut to ${reducedDays} days.`, "orange");
        } else {
          if (site) { site.status = "Paused"; site.pausedDays = (site.pausedDays||0) + (pd.delayDays||5); }
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
            if (site) { site.status = "Paused"; site.pausedDays = (site.pausedDays||0) + 1; }
            addLog(g, `📜 Premium resolution partially worked — ${money(totalCost)} paid, 1-day minimum hold.`);
            addImportantNotice(g, `Premium didn't fully clear — 1-day hold remains. ${money(totalCost)} paid.`, "orange");
          }
        } else {
          if (site) { site.status = "Paused"; site.pausedDays = (site.pausedDays||0) + (pd.delayDays||5); }
          g.cash -= (pd.fine||1000); g.expenses = (g.expenses||0) + (pd.fine||1000);
          addLog(g, `📜 Insufficient funds for premium — ${money(pd.fine||1000)} paid, full delay applied.`);
          addImportantNotice(g, `Insufficient funds for premium — full delay applied.`, "red");
        }
      } },
    ],
  },
  {
    id: "delay_permit", title: "📋 Permit Review Delay", tone: "yellow",
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
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); if (w) { g.cash -= (w.wagePerDay||WAGE_SCALE.DEFAULT); g.expenses += (w.wagePerDay||WAGE_SCALE.DEFAULT); w.loyalty = Math.min(100,(w.loyalty ?? 50)+10); addLog(g, `🤒 ${w.name} given paid sick day — loyalty up.`); addImportantNotice(g, `${w.name} given paid sick day — loyalty +10.`, "green"); } } },
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
        apply: (g) => { const w = (g.crew||[]).find(c => c.id === g.pendingDecision?.context?.workerId); const site = (g.activeSites||[]).find(s => s.id === g.pendingDecision?.context?.siteId); const dock = w?.wagePerDay||WAGE_SCALE.DEFAULT; g.cash += dock; if (site) site.phaseProgress = Math.max(0,(site.phaseProgress||0)-5); if (w) w.loyalty = Math.max(0,(w.loyalty ?? 50)-10); addLog(g, `🕐 ${w?.name||"Worker"} docked pay for causing delay.`); addImportantNotice(g, `${w?.name||"Worker"} docked pay — loyalty -10, 5% progress lost.`, "orange"); } },
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

// Per-tick probability of a weather roll on an active site, before seasonal modulation.
// 48 ticks make an in-game day, so 0.0022 is about one roll every ~9 days; applyWeatherEvent
// then decides whether that roll actually produces snow/rain/heat for the site's region.
const WEATHER_TICK_PROB = 0.0022;

// Winter and Spring are wetter and stop work more often; Summer brings heat rather than
// rain but still disrupts. Uses the season the game already tracks on g.currentSeason.
function getSeasonalWeatherMult(g) {
  switch (g?.currentSeason) {
    case "Winter": return 1.9;
    case "Fall":   return 1.25;
    case "Spring": return 1.15;
    case "Summer": return 0.85;
    default:       return 1.0;
  }
}

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

const LOAN_PRODUCTS = [
  { id: "micro",             label: "Emergency Micro Loan",    minCredit: 500, principal: 8000,   apr: 22, weeks: 8,   maxDebtFactor: 1.5 },
  { id: "working",           label: "Working Capital Loan",    minCredit: 560, principal: 20000,  apr: 14, weeks: 16,  maxDebtFactor: 2.5 },
  { id: "equipment",         label: "Equipment Finance Loan",  minCredit: 620, principal: 60000,  apr: 10, weeks: 28,  maxDebtFactor: 3.5 },
  { id: "expansion",         label: "Growth Loan",             minCredit: 680, principal: 150000, apr: 8,  weeks: 40,  maxDebtFactor: 5.0 },
  { id: "emergency_line",    label: "Emergency Credit Line",   minCredit: 500, principal: 5000,   apr: 22, weeks: 8,   maxDebtFactor: 1.5 },
  { id: "equipment_finance", label: "Equipment Financing",     minCredit: 560, principal: 35000,  apr: 10, weeks: 52,  maxDebtFactor: 3.0 },
  { id: "mega_bond",         label: "Infrastructure Bond",     minCredit: 720, principal: 500000, apr: 7,  weeks: 260, maxDebtFactor: 8.0 },
];

// ─── Job Postings ────────────────────────────────────────────────────────────────

// Organic applicant flow — see the walk-in block in gameTick. Capped so the Crew screen never
// fills with stale candidates, and so paid ads keep their value.
const WALKIN_BASE_CHANCE = 0.06;
const WALKIN_APPLICANT_CAP = 5;

export const JOB_POSTINGS = [
  { id: "basic",    label: "Basic Ad",    cost: 120,  count: 1, skillMin: 75,  skillMax: 95,  wageMin: 165, wageMax: 240, desc: "Finds a reliable labourer or tradesperson." },
  { id: "standard", label: "Standard Ad", cost: 300,  count: 2, skillMin: 90,  skillMax: 110, wageMin: 220, wageMax: 315, desc: "Attracts experienced tradespeople." },
  { id: "premium",  label: "Premium Ad",  cost: 650,  count: 3, skillMin: 105, skillMax: 130, wageMin: 285, wageMax: 420, desc: "Top-tier tradespeople. Foreman-quality." },
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

function addImportantNotice(state, message, tone = "green") {
  state.importantNotice = { id: Date.now(), message, tone };
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

function getBestEquipTier(state) {
  if (!state.equipment.length) return 0;
  return Math.max(...state.equipment.map((e) => e.tier));
}

function createEquipment(item) {
  return {
    id: uid(), shopId: item.shopId, name: item.name, type: item.type,
    tier: item.tier, price: item.price, dailyCost: item.dailyCost,
    fuelCap: item.fuelCap, fuel: item.fuelCap, reliability: item.reliability,
    capacity: item.capacity, condition: 100, engineHours: 0, hoursAtLastService: 0,
    status: "Idle", assignedSiteId: null, breakdowns: 0, upgrades: {},
  };
}

function createWorker(role, overrides = {}) {
  const trait = pick(CREW_TRAITS);
  return {
    id: uid(),
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    role: role || pick(CREW_ROLES),
    specialty: pick(CREW_SPECIALTIES),
    age: rand(20, 56),
    skill: rand(75, 105),
    mood: rand(60, 85),
    loyalty: rand(55, 80),
    stamina: rand(70, 95),
    trait,
    wagePerDay: rand(WAGE_SCALE.BASE_MIN, WAGE_SCALE.BASE_MAX),
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
    desiredWage: rand(boost.wageMin ?? WAGE_SCALE.BASE_MIN, boost.wageMax ?? WAGE_SCALE.BASE_MAX),
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

function applyIncident(g, severity) {
  if (!g.incidentHistory) g.incidentHistory = [];
  g.safetyScore     = Math.max(0, Math.min(100, (g.safetyScore    ?? 70) - severity * rand(3, 8)));
  g.complianceScore = Math.max(0, Math.min(100, (g.complianceScore ?? 60) - severity * rand(2, 5)));
  g.safetyViolations = (g.safetyViolations ?? 0) + 1;
  const rawCost = severity * rand(1500, 4000);
  const netCost = applyInsuranceClaim(g, rawCost);
  g.cash -= netCost;
  g.expenses += netCost;
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

export function createContract(state, forcedDefId) {
  const bestTier = getBestEquipTier(state);
  const repRequired = { stadium: 80, wildbear_city: 95 };
  const eligible = CONTRACT_DEFS.filter((d) => {
    if (d.minTier >= 3 && (state.reputation || 0) < 25) return false;
    if (d.minTier >= 4 && (state.reputation || 0) < 60) return false;
    if (state.creditScore < d.creditReq) return false;
    if (d.minTier > Math.max(1, bestTier)) return false;
    if (repRequired[d.id] && (state.reputation || 0) < repRequired[d.id]) return false;
    if (d.category === "Government" && d.complianceReq && (state.complianceScore ?? 60) < d.complianceReq) return false;
    return true;
  });
  const pool = eligible.length ? eligible : CONTRACT_DEFS.slice(0, 3);
  const forcedDef = forcedDefId ? CONTRACT_DEFS.find((d) => d.id === forcedDefId) : null;
  const def = forcedDef || pick(pool);

  const contractCityId = pickContractCity(state);
  const baseDeadline = state.day + def.durationDays + rand(2, 6);
  const seasonMult = state.seasonContractMult || 1.0;
  const enhanced = enhanceContractValue(def, state, { value: Math.round(def.baseValue * seasonMult), deadline: baseDeadline });

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
  return RIVAL_COMPANIES.map((r) => ({
    id: r.id, name: r.name, aggression: r.aggression, focus: r.focus,
    rep: r.startRep, jobsCompleted: 0, activeJobs: 0,
    cash: rand(20000, 50000),
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

// Returns array of { matId, label, icon, unit, needed, fulfilled, missing, pricePerUnit, costNormal, costEmergency }
function getSiteMissingMaterials(site, contractDef, game) {
  if (!contractDef?.materials) return [];
  const disc = game ? getMaterialDiscount(game) : 0;
  return Object.entries(contractDef.materials).reduce((acc, [matId, needed]) => {
    const fulfilled = (site.materialsFulfilled || {})[matId] || 0;
    const shortfall = Math.max(0, needed - fulfilled);
    if (shortfall === 0) return acc;
    const mat = MATERIAL_DEFS.find(m => m.id === matId);
    const basePrice = (game?.materialPrices?.[matId]) || mat?.basePrice || 100;
    const pricePerUnit = Math.round(basePrice * (1 - disc));
    acc.push({
      matId, needed, fulfilled, missing: shortfall,
      label: mat?.label || matId, icon: mat?.icon || "📦", unit: mat?.unit || "units",
      pricePerUnit,
      costNormal: pricePerUnit * shortfall,
      costEmergency: Math.round(pricePerUnit * shortfall * 1.5),
    });
    return acc;
  }, []);
}

function getNextBestAction(s) {
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
  if (_brokenAssigned) return { title: "Vehicle Broken on Site", body: `${_brokenAssigned.name} is down on an active site. Repair it in Vehicles to restore full progress.`, tone: "orange", tab: "Vehicles" };

  // Also catch any broken equipment not on site
  const _brokenAny = _equipment.find(e => e.status === "Broken" || e.status === "Maintenance");
  if (_brokenAny) return { title: "Vehicle Needs Repair", body: `${_brokenAny.name} is out of action. Repair it in Vehicles before assigning to new sites.`, tone: "orange", tab: "Vehicles" };

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
    if (_equipment.length < 1) return { title: "Buy Your First Machine", body: "A Basic Pickup Truck unlocks Tier 1 contracts. Go to Vehicles tab to purchase.", tone: "cyan", tab: "Vehicles" };
    if (_openContracts.length === 0) return { title: "No Active Sites", body: "No contracts available right now. Your reputation will attract new ones tomorrow.", tone: "blue", tab: "Bids" };
    if (_idleCrew.length >= 1 && _idleEquip.length >= 1) {
      return { title: "Ready to Work — No Active Sites", body: `${_idleCrew.length} crew idle and ${_idleEquip.length} machines ready. Bid on a contract in Bids and start a site.`, tone: "blue", tab: "Bids" };
    }
    return { title: "No Active Sites", body: "Head to Bids and pick up a contract to get back to work.", tone: "blue", tab: "Bids" };
  }

  // Subcontractor suggestion: slow site, no subs active, can afford
  const _activeSubs = (s.subcontractors||[]).filter(sc => (sc.daysLeft||0) > 0 && sc.status === "Active");
  const _slowSite = _activeSites.find(site => site._progressRate && site._progressRate * 48 < 8 && site.status === "Active");
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
          m.reward(state);
          addImportantNotice(state, `🏆 "${m.label}" milestone reached!`, "green");
        } else if (m.reward > 0) {
          state.cash += m.reward;
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
    if (w.mood < 40 && w.wagePerDay < WAGE_SCALE.UNDERPAID && w.skill > 90) quitChance = Math.max(quitChance, 0.08);

    // Burnout: stamina < 20 → 30% quit chance; stamina < 10 → 60% quit chance
    if ((w.stamina ?? 50) < 10 && w.status !== "Idle") {
      w.mood = Math.max(0, (w.mood ?? 50) - rand(10, 18));
      quitChance = Math.max(quitChance, 0.60);
      addLog(g, `😰 ${w.name} is completely burned out — about to quit!`);
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
        } else {
          w.mood = Math.max(0, (w.mood ?? 50) - 15);
          quitChance = Math.max(quitChance, 0.10);
        }
      }
    }

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
  if (perkId === "veteran_mentor" && mentor) { fresh.legacyMentor = { name: mentor.name, skill: mentor.skill||75, role: mentor.role, wagePerDay: Math.round((mentor.wagePerDay||WAGE_SCALE.DEFAULT) * 0.5) }; }
  if (perkId === "equipment_cache")       { fresh._pendingEquipCache = true; }
  if (perkId === "material_stockpile")    { const mats = ["concrete","lumber","steel"]; mats.forEach(m => { fresh.materials[m] = (fresh.materials[m]||0) + 30; }); }
  if (perkId === "political_connections") { fresh._politicalContractsLeft = 5; }
  // Stack bonuses from prior generations (diminishing)
  for (const p of (g.legacyPerks||[])) {
    if (p === "iron_foundation")   fresh.cash += 15000;
    if (p === "reputation_legacy") fresh.reputation = Math.min(fresh.reputation + 8, 35);
  }
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
  for (const rival of g.rivals) {
    if ((g.acquiredRivals || []).includes(rival.id)) continue;

    // ── Rival bankruptcy / recovery ──────────────────────────────────────────
    if (rival.status === "Bankrupt") {
      rival.bankruptDays = (rival.bankruptDays || 0) + 1;
      // After 90 days re-enter at 20% of original valuation
      if (rival.bankruptDays >= 90) {
        rival.status = "Active";
        rival.cash = rand(8000, 20000);
        rival.rep = Math.max(5, Math.round((rival.rep || 10) * 0.4));
        rival.activeJobs = 0;
        rival.bankruptDays = 0;
        addLog(g, `📈 ${rival.name} has restructured and re-entered the market.`);
      }
      continue;
    }

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

    // Rival bankruptcy (revised threshold)
    rival.lowValuationDays = (rival.lowValuationDays || 0);
    const rivalVal = (rival.cash || 0) + (rival.rep || 0) * 50000 + ((rival.cityPresence || ["salem"]).length) * 100000;
    if (rivalVal < 10000) {
      rival.lowValuationDays++;
    } else {
      rival.lowValuationDays = 0;
    }
    if ((rival.cash || 0) < -15000 || rival.lowValuationDays >= 30) {
      rival.status = "Bankrupt";
      rival.bankruptDays = 0;
      addLog(g, `📉 ${rival.name} has gone bankrupt and exited the market.`);
      continue;
    }

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
    }
    // Rivals occasionally buy equipment (simulated)
    if (Math.random() < 0.03 && (rival.cash || 0) > 50000) {
      rival.equipCount = (rival.equipCount || 1) + 1;
      rival.cash -= rand(15000, 50000);
      rival.rep = Math.min(100, (rival.rep || 0) + 1);
    }
    // Market response — rivals pull back during recession
    if (g.activeMarketEvent === "recession_start" && Math.random() < 0.30) {
      rival.activeJobs = Math.max(0, (rival.activeJobs || 0) - 1);
    }
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
      if (Math.random() < 0.3) addLog(g, `👷 ${rival.name} hired ${hireCount} new worker${hireCount > 1 ? "s" : ""}.`);
    }

    // Buy equipment when cash-positive and expanding
    if (rival.cash > 60000 && (rival.equipment || 1) < 8 && Math.random() < 0.05) {
      rival.equipment = (rival.equipment || 1) + 1;
      rival.cash -= rand(20000, 55000);
      if (Math.random() < 0.25) addLog(g, `🚜 ${rival.name} acquired new equipment.`);
    }

    // Lay off workers when cash-strapped
    if (rival.cash < 5000 && (rival.employees || 2) > 2 && Math.random() < 0.12) {
      rival.employees = Math.max(2, (rival.employees || 2) - 1);
      if (Math.random() < 0.4) addLog(g, `📉 ${rival.name} downsized — laid off a worker.`);
    }

    // Contract stealing
    const hasPMDirector = (g.projectManagers || []).some((pm) => pm.typeId === "director");
    const stealPenalty = hasPMDirector ? 0.80 : 1.0;
    const focusMap = { residential: ["Residential"], commercial: ["Commercial"], infrastructure: ["Infrastructure"] };
    const targetCategories = focusMap[rival.focus] || ["Commercial"];
    const vulnerableContracts = g.contracts.filter((c) =>
      c.status === "Open" && targetCategories.includes(c.category) && c.expiresDay <= g.day + 2
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
    const expiredOpen = g.contracts.filter((c) => c.status === "Open" && c.expiresDay < g.day);
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
        addLog(g, `🏗️ ${rival.name} strategically expanded to ${target.name}!`);
      }
    }

    // Rivals can win annual awards too (adds realism)
    if (g.day % 365 === 0 && rival.rep >= 60 && Math.random() < 0.3) {
      rival.rep = Math.min(100, (rival.rep || 0) + rand(3, 8));
      if (Math.random() < 0.5) addLog(g, `🏆 ${rival.name} won an industry award — their reputation grows.`);
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
        _weakerRival.status = "Bankrupt";
        _weakerRival.bankruptDays = 0;
        addLog(g, `🏗️ ${rival.name} acquired ${_weakerRival.name} — a rival has consolidated!`);
      }
    }

    // ── Rival War: Bankruptcy tracking (Feature 7) ──────────────────────────
    const _rivalValuation = (rival.cash||0) + (rival.rep||0)*50000 + ((rival.cityPresence||["salem"]).length)*100000;
    if (_rivalValuation < 10000 && rival.status !== "Bankrupt") {
      rival.bankruptDays = (rival.bankruptDays||0) + 1;
      if (rival.bankruptDays >= 30 && !rival.bankrupt) {
        rival.bankrupt = true;
        rival.bankruptDay = g.day;
        rival.status = "Bankrupt";
        addLog(g, `📉 ${rival.name} has gone bankrupt.`);
      }
    }

    // ── Rival War: Recovery (Feature 7) ─────────────────────────────────────
    if (rival.bankrupt && g.day > (rival.bankruptDay||0) + 90) {
      rival.bankrupt = false;
      rival.status = "Active";
      rival.cash = 15000;
      rival.reputation = Math.max(5, (rival.rep||0) * 0.4);
      rival.bankruptDays = 0;
      addLog(g, `📈 ${rival.name} has recovered and re-entered the market.`);
    }
  }
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
    if ((g.acquiredRivals || []).includes(rival.id)) continue;
    if (rival.status === "Bankrupt") continue;
    const personality = rivalPersonality[rival.id];
    if (!personality) continue;
    if (personality.dailySkip && Math.random() > personality.dailySkip) continue;
    const targets = openContracts.filter((c) =>
      c.status === "Open" && personality.focus.includes(c.category)
    );
    for (const c of targets) {
      if (Math.random() < rival.aggression * personality.focusBonus * cityPressure * playerEdge) {
        c.status = "Taken";
        rival.activeJobs = (rival.activeJobs || 0) + 1;
        rival.rep = Math.min(100, (rival.rep || 0) + rand(1, 3));
        addLog(g, `🏗️ ${rival.name} claimed "${c.label}".`);
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
    site.status = "Paused";
    site.pausedDays = (site.pausedDays || 0) + pauseDays;
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
        const fine = rand(1500, 5000);
        game.cash -= fine;
        site.status = "Paused";
        site.pausedDays = (site.pausedDays || 0) + rand(1, 3);
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

function cleanStaleState(g) {
  if (Array.isArray(g.logs))     g.logs = g.logs.slice(0, 25);
  if (Array.isArray(g.opsFeed))  g.opsFeed = g.opsFeed.slice(0, 20);
  g.eventLog = (g.eventLog || []).slice(0, 50);
  // Lost bids linger for a few days as visible feedback ("Apex took that one"), then go.
  // Without this they accumulate forever: the daily refresh only expires contracts still
  // in "Open" status, and the open-pool cap deliberately preserves every non-Open entry.
  if (Array.isArray(g.contracts)) {
    g.contracts = g.contracts.filter(
      (c) => c.status !== "Lost" || (g.day || 1) - (c.lostOnDay || 0) <= 3
    );
  }
  if (Array.isArray(g.contracts)) {
    const currentDay = g.day || 1;
    // Contracts a rival took. Previously gated on `g.day > 10`, which was harmless, but the
    // whole purge only ran on load — see the call site in gameTick's day rollover.
    g.contracts = g.contracts.filter((c) => c.status !== "Taken" || (c.expiresDay || 0) >= currentDay - 10);
    // Finished work stays around briefly for the completion UI, then goes. Without this,
    // every job a company ever completed remained in state for the life of the save.
    g.contracts = g.contracts.filter(
      (c) => c.status !== "Complete" || currentDay - (c.completedOnDay || 0) <= 5
    );
  }
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
    createContract({ cash: STARTING_CASH, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices:[], properties:[] }, "fence"),
    createContract({ cash: STARTING_CASH, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices:[], properties:[] }),
    createContract({ cash: STARTING_CASH, day: 1, creditScore: 600, marketState: "Normal", equipment: [startEquip], contracts: [], _milestones: {}, cityOffices:[], properties:[] }),
  ];

  return {
    cash: STARTING_CASH, day: 1, gameMinutes: 480,
    reputation: 0, creditScore: 600,
    companyName: "New Build Co.",
    theme: "dark",
    marketState: "Normal",
    businessFrozen: false,
    taxDue: 0, taxOverdueDays: 0,
    revenue: 0, expenses: 0,
    weeklyStats: { revenue: 0, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0, fuel: 0 },
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
    cityJobsWon: {},

    // Sprint 5 — Safety, Insurance, Economy History, Achievements, Legacy
    safetyScore: 60, complianceScore: 60, safetyViolations: 0,
    incidentHistory: [],
    insurancePlanId: "none",
    economicHistory: [],
    achievements: [],
    legacyStats: initLegacyStats(),
    contractBidStyles: {},
    wageScaleVersion: WAGE_SCALE.VERSION,
    bidsWon: 0, bidsLost: 0,
    pendingRetainage: [],
    equipmentLoans: [],
    dieselPrice: DIESEL_BASE_PRICE,
    hapticsEnabled: true,
    saveSchemaVersion: SAVE_SCHEMA_VERSION,

    logs: [`🏗️ Welcome to ConstructionFlow. You have ${money(STARTING_CASH)}, one truck, and three crew — about a month of overhead. Win the Fence job in Bids before it runs out.`],
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
    speedMode: false,
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
  // Deep-merge nested objects so new sub-keys added in future sprints are
  // defaulted for old saves while all existing saved values are preserved.
  g.weeklyStats = { ...defaults.weeklyStats, ...(saved.weeklyStats || {}) };
  g.hallOfFame  = { ...defaults.hallOfFame,  ...(saved.hallOfFame  || {}) };
  if (!g.rivals || !g.rivals.length)       g.rivals = createRivals();
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
  if (g.bidsWon  === undefined)        g.bidsWon = 0;
  if (g.bidsLost === undefined)        g.bidsLost = 0;
  if (!Array.isArray(g.pendingRetainage)) g.pendingRetainage = [];
  if (!Array.isArray(g.equipmentLoans))   g.equipmentLoans = [];
  if (!Number.isFinite(g.dieselPrice))   g.dieselPrice = DIESEL_BASE_PRICE;
  if (typeof g.hapticsEnabled !== "boolean") g.hapticsEnabled = true;
  // Sites started before progress billing existed only recorded a 25% deposit. Seed
  // billedToDate from it so the completion settlement pays the correct balance instead of
  // paying the full contract value a second time.
  for (const site of (g.activeSites || [])) {
    if (site.billedToDate === undefined || !Number.isFinite(site.billedToDate)) {
      site.billedToDate = Math.max(0, Math.round(site.depositPaid || 0));
    }
    if (site.retainageHeld === undefined || !Number.isFinite(site.retainageHeld)) {
      site.retainageHeld = 0;
    }
  }
  g.saveSchemaVersion = SAVE_SCHEMA_VERSION;
  // Sprint 15 fields
  if (g.materials && g.materials.asphalt === undefined) g.materials.asphalt = 0;
  if (g.materialPrices && g.materialPrices.asphalt === undefined) g.materialPrices.asphalt = 200;
  if (g.pendingBreakdown === undefined)  g.pendingBreakdown = null;
  if (g.pendingInspection === undefined) g.pendingInspection = null;
  // Sprint finalization fields
  if (g.lastLoginDay === undefined)         g.lastLoginDay = g.day || 1;
  if (g.consecutiveLoginDays === undefined) g.consecutiveLoginDays = 0;
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
  if (g.speedMode     === undefined) g.speedMode     = false;
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
  // Migrate active sites
  (g.activeSites || []).forEach(s => {
    if (!s._clientCheckins) s._clientCheckins = [];
  });
  // Migrate existing active sites to have new fields
  (g.activeSites || []).forEach(s => {
    if (s.depositPaid      === undefined) s.depositPaid      = 0;
    if (s.completionBonus  === undefined) s.completionBonus  = 0;
    if (s.rushQualityPenalty === undefined) s.rushQualityPenalty = 0;
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
  // ── Equipment operating hours ───────────────────────────────────────────────
  // Saves predating the hours model have `mileage: 0` (a dead field that was never
  // incremented) and no engineHours. Seeding hours from condition rather than zeroing them
  // means a well-used machine in an existing save reads as well-used — starting everyone at
  // 0 hours would hand every long-running save a fleet that looks brand new and is worth
  // more secondhand than it should be.
  for (const e of (g.equipment || [])) {
    if (e.engineHours === undefined || !Number.isFinite(e.engineHours)) {
      const wear = Math.max(0, 100 - (Number.isFinite(e.condition) ? e.condition : 100));
      e.engineHours = Math.round(wear * 30);   // 100% worn out ~= 3,000 hours
    }
    if (e.hoursAtLastService === undefined || !Number.isFinite(e.hoursAtLastService)) {
      // Assume last serviced within the current interval so nobody loads in already overdue.
      e.hoursAtLastService = Math.max(0, e.engineHours - rand(0, SERVICE_INTERVAL_HOURS - 1));
    }
    delete e.mileage;
  }

  // ── Wage-scale repair (see WAGE_SCALE) ──────────────────────────────────────
  // Saves written before the wage-scale fix hold crew hired at FleetFlow's per-HOUR
  // range (18-32) in a per-DAY field, alongside starting crew on the correct per-day
  // range (160-260). Left alone those workers would stay ~10x underpaid forever and the
  // fire-and-rehire exploit would persist in every existing save. Anything below MIN is
  // unreachable through any normal hire path on the corrected scale, so within a save that
  // has not yet been stamped it identifies an old-scale record. The g.wageScaleVersion stamp
  // (not the magnitude test alone) is what makes this idempotent: it runs at most once per
  // save, so a legitimately cheap worker — e.g. a half-wage veteran_mentor at 100/day — is
  // never repeatedly "corrected" upward on later loads.
  let _rescaledWages = 0;
  if (g.wageScaleVersion !== WAGE_SCALE.VERSION) {
  for (const w of (g.crew || [])) {
    const wage = Number(w.wagePerDay);
    if (!Number.isFinite(wage) || wage <= 0) { w.wagePerDay = WAGE_SCALE.DEFAULT; _rescaledWages++; continue; }
    if (wage < WAGE_SCALE.MIN) {
      // Preserve each worker's relative standing within the old 18-32 band instead of
      // flattening everyone to one number: an old 32/day hire stays the expensive one.
      const rel = Math.max(0, Math.min(1, (wage - 18) / (32 - 18)));
      w.wagePerDay = Math.round(WAGE_SCALE.BASE_MIN + rel * (WAGE_SCALE.BASE_MAX - WAGE_SCALE.BASE_MIN));
      _rescaledWages++;
    }
  }
  for (const a of (g.applicants || [])) {
    const wage = Number(a.desiredWage);
    if (!Number.isFinite(wage) || wage <= 0) { a.desiredWage = WAGE_SCALE.DEFAULT; continue; }
    if (wage < WAGE_SCALE.MIN) {
      const rel = Math.max(0, Math.min(1, (wage - 18) / (32 - 18)));
      a.desiredWage = Math.round(WAGE_SCALE.BASE_MIN + rel * (WAGE_SCALE.BASE_MAX - WAGE_SCALE.BASE_MIN));
    }
  }
  g.wageScaleVersion = WAGE_SCALE.VERSION;
  }
  if (_rescaledWages > 0) {
    addLog(g, `\uD83D\uDCB5 Payroll correction: ${_rescaledWages} crew member${_rescaledWages === 1 ? " was" : "s were"} on an out-of-date pay scale and now earn a proper day rate.`);
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
  // Sync equipment status (don't override Maintenance/Broken)
  for (const e of (g.equipment || [])) {
    if (e.status === "Maintenance" || e.status === "Broken") continue;
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
  const MINS_PER_TICK = 30;
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

  // ── Crew/equipment assignment integrity every tick ───────────────────────────
  repairCrewAssignments(g);

  // ── Update active sites ──────────────────────────────────────────────────────
  for (const site of g.activeSites) {
    if (site.status === "Paused") {
      if ((site.pausedDays || 0) > 0 && site.pausedDays !== 999) {
        site.pausedDays = site.pausedDays - (MINS_PER_TICK / 1440);
        if (site.pausedDays <= 0) { site.status = "Active"; site.pausedDays = 0; }
      }
      continue;
    }
    if (site.status !== "Active") continue;

    const assignedCrew = g.crew.filter((w) => site.assignedCrewIds.includes(w.id));
    // Only use equipment that is not broken/maintenance
    const assignedEquip = g.equipment.filter((e) => site.assignedEquipmentIds.includes(e.id) && e.status !== "Broken" && e.status !== "Maintenance");

    if (!assignedCrew.length || !assignedEquip.length) continue;

    // Stall progress while materials are missing — player must buy or emergency-purchase
    const _siteContract = g.contracts.find(c => c.id === site.contractId);
    const _siteDef = CONTRACT_DEFS.find(d => d.id === _siteContract?.defId);
    const _hasMissingMats = _siteDef?.materials && Object.entries(_siteDef.materials).some(
      ([matId, needed]) => ((site.materialsFulfilled || {})[matId] || 0) < needed
    );
    if (_hasMissingMats) {
      if (Math.random() < 0.04) addLog(g, `⚠️ ${site.label}: Work stalled — materials missing. Go to Sites to purchase.`);
      continue;
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
    const progressRate = (2.0 * (avgSkill / 100) * avgSpeed * Math.min(crewCount / (site.crewMin || 2), 1.5)) * (MINS_PER_TICK / 60) * subBonus * pmBonus * pmSpeedBonus * teamLeaderBonus * equipTypeBonus * crewSpecialtyBonus * mismatchPenalty * stratMod * _certBonus * engineBonus;
    site._progressRate = progressRate;

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

      // Progress payment for the phase just certified. Only intermediate phases draw here —
      // the final phase's balance is settled in the completion branch below, so a job can
      // never be billed twice for the same work.
      if (site.currentPhaseIdx < site.phases.length) {
        billSiteDraw(g, site, getPhaseDrawValue(site), `"${completedPhaseName}" certified`);
      }

      // Inspection outcome — fires when an inspection phase completes
      if (INSPECTION_PHASES.has(completedPhaseName) && !g.pendingInspection) {
        const qualityMod = site.siteMode === "quality" ? 0.20 : site.siteMode === "budget" ? -0.18 : 0;
        const avgCrewSkillInsp = assignedCrew.length
          ? assignedCrew.reduce((s, w) => s + w.skill, 0) / assignedCrew.length : 80;
        const passChance = Math.min(0.90, 0.55 + qualityMod + (avgCrewSkillInsp - 80) / 200);
        const inspRoll = Math.random();
        let inspOutcome, inspPenalty = 0;
        if (inspRoll < passChance) {
          inspOutcome = "pass";
          g.reputation = Math.min(100, (g.reputation || 0) + 2);
          g.creditScore = Math.min(850, (g.creditScore || 600) + 1);
          addLog(g, `✅ ${site.label}: ${completedPhaseName} passed — reputation +2.`);
        } else if (inspRoll < passChance + 0.28) {
          inspOutcome = "minor";
          inspPenalty = rand(500, 2500);
          g.cash -= inspPenalty;
          site.phaseProgress = -20;
          addLog(g, `🔍 ${site.label}: Minor correction required — ${money(inspPenalty)} to remediate.`);
        } else {
          inspOutcome = "major";
          inspPenalty = rand(2500, 9000);
          g.cash -= inspPenalty;
          site.status = "Paused";
          site.pausedDays = (site.pausedDays || 0) + rand(3, 6);
          g.reputation = Math.max(0, (g.reputation || 0) - 3);
          addLog(g, `❌ ${site.label}: Major inspection failure — ${money(inspPenalty)} cost, site paused.`);
        }
        g.pendingInspection = { siteId: site.id, siteLabel: site.label, phaseName: completedPhaseName, outcome: inspOutcome, penaltyApplied: inspPenalty };
      }

      if (site.currentPhaseIdx >= site.phases.length) {
        // Site complete
        site.status = "Complete";
        // Close the contract too. It used to stay "Active" for the rest of the run, which
        // both misreported the company's live workload and made the entry immortal: the
        // daily refresh only expires contracts still in "Open" status.
        {
          const _finishedContract = (g.contracts || []).find((c) => c.id === site.contractId);
          if (_finishedContract) {
            _finishedContract.status = "Complete";
            _finishedContract.completedOnDay = g.day;
          }
        }
        const daysLate = Math.max(0, g.day - site.deadlineDay);
        // Escalating penalty: 1× for first 5 days late, 1.5× after that, capped at 85%
        const BASE_LATE_DAYS = 5;
        let penalty = 0;
        if (daysLate <= BASE_LATE_DAYS) {
          penalty = daysLate * site.penaltyPerDay;
        } else {
          penalty = BASE_LATE_DAYS * site.penaltyPerDay + (daysLate - BASE_LATE_DAYS) * site.penaltyPerDay * 1.5;
        }
        // The Small Site Office and Project Office tiers both advertise a delay-penalty
        // reduction in the office upgrade screen ("-10% / -15% delay penalties"). Until now
        // that perk was displayed and paid for but never read anywhere. Applied before the
        // cap so the cap still bounds the final figure.
        penalty = Math.round(penalty * (1 - getOfficePerkValue(g, "penaltyReduction")));
        penalty = Math.min(penalty, Math.round(site.totalValue * 0.85));
        // Final draw: whatever has not been billed yet, less retainage and the late penalty.
        // Everything already paid out during the job is tracked in site.billedToDate, so this
        // is a settlement of the balance rather than a second payment for the whole contract.
        const grossRemaining = Math.max(0, (site.totalValue || 0) - (site.billedToDate || 0));
        const finalRetainage = Math.round(grossRemaining * RETAINAGE_PCT);
        site.billedToDate = (site.billedToDate || 0) + grossRemaining;
        site.retainageHeld = (site.retainageHeld || 0) + finalRetainage;
        const earned = Math.max(0, grossRemaining - finalRetainage - penalty);
        g.cash += earned;
        g.revenue += earned;
        g.weeklyStats.revenue += earned;

        // Retainage is released after the hold period, once the client has signed off.
        if ((site.retainageHeld || 0) > 0) {
          if (!g.pendingRetainage) g.pendingRetainage = [];
          g.pendingRetainage.push({
            id: uid(), label: site.label, client: site.client,
            amount: site.retainageHeld, releaseDay: g.day + RETAINAGE_RELEASE_DAYS,
          });
          addLog(g, `\uD83D\uDD12 ${money(site.retainageHeld)} retainage held on "${site.label}" — released day ${g.day + RETAINAGE_RELEASE_DAYS}.`);
        }
        g.completedJobs = (g.completedJobs || 0) + 1;
        if (!g.cityJobsWon) g.cityJobsWon = {};
        const completedCityKey = site.cityId || "salem";
        g.cityJobsWon[completedCityKey] = (g.cityJobsWon[completedCityKey] || 0) + 1;
        const siteDef = CONTRACT_DEFS.find(d => d.id === (g.contracts.find(c => c.id === site.contractId)?.defId));
        const repGained = siteDef?.repReward || rand(3, 8);
        const creditGained = siteDef?.creditReward || rand(2, 5);
        // Diminishing returns near the top. Flat gains had companies at reputation 95-100
        // by day 90 — the entire progression ceiling reached in a third of a run, after
        // which the biggest contracts unlocked all at once and there was nothing left to
        // climb. The last stretch of a reputation should be the hardest to earn.
        const _repScale = 1 - Math.pow(Math.min(1, (g.reputation || 0) / 100), 1.6) * 0.82;
        g.reputation = Math.min(100, (g.reputation || 0) + repGained * _repScale);
        g.creditScore = Math.min(850, (g.creditScore || 600) + creditGained);
        // Quality bonus (rush mode degrades quality)
        const avgQuality = assignedCrew.reduce((s, w) => s + (w.trait?.quality || 1.0), 0) / Math.max(1, assignedCrew.length);
        const effectiveQuality = Math.max(0.80, avgQuality - (site.rushQualityPenalty || 0));
        let qualityBonus = 0;
        if (effectiveQuality > 1.05) {
          qualityBonus = Math.round(earned * (effectiveQuality - 1.0) * 0.4);
          g.cash += qualityBonus;
          g.revenue += qualityBonus;
        }
        // Story triggers
        if (!g.pendingCelebration) {
          g.pendingCelebration = {
            label: site.label, client: site.client,
            earned: earned + qualityBonus, penalty, repGained,
            isOnTime: daysLate === 0, isMajor: (siteDef?.baseValue || 0) >= 100000,
            qualityBonus, day: g.day,
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
            addImportantNotice(g, "First job complete! Retainage from it is released in about two weeks — see Finance. Empire is where you grow.", "green");
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
        g.jobHistory = [...(g.jobHistory || []), { label: site.label, client: site.client, value: earned + qualityBonus, day: g.day, quality: _qualLabel }].slice(-20);
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
          if (_unlockDef && !g.bids.some(b => b.contractId === _unlockDef.id)) {
            const _newBid = { ..._unlockDef };
            _newBid.value = Math.round((_unlockDef.baseValue || _unlockDef.value || 10000) * 1.15);
            _newBid.isChainUnlock = true;
            _newBid.id = `bid_chain_${Date.now()}`;
            _newBid.contractId = _unlockDef.id;
            _newBid.expiryDay = g.day + 14;
            if (!g.bids) g.bids = [];
            g.bids.unshift(_newBid);
            // Also add to open contracts so it appears in Bids tab
            const _chainContract = {
              id: `chain_${uid()}`, defId: _unlockDef.id, label: _unlockDef.label, category: _unlockDef.category || "Commercial",
              client: pick(CLIENTS), value: _newBid.value, phases: [..._unlockDef.phases],
              minTier: _unlockDef.minTier, crewMin: _unlockDef.crewMin, equipMin: _unlockDef.equipMin,
              materials: { ...(_unlockDef.materials||{}) }, penaltyPerDay: _unlockDef.penaltyPerDay,
              durationDays: _unlockDef.durationDays, deadline: g.day + _unlockDef.durationDays + rand(3, 8),
              expiresDay: g.day + 14, status: "Open", desc: _unlockDef.desc, risk: _unlockDef.risk || 2,
              cityId: pickContractCity(g), isChainUnlock: true,
            };
            g.contracts.push(_chainContract);
            addLog(g, `🔓 New opportunity unlocked: ${_unlockDef.label}`);
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

    // Chaos events — mid-game sites (started after day 30) get 12% daily chance vs 8%
    const isMidGameSite = (site.startDay || 0) > 30;
    const chaosBaseProb = isMidGameSite ? 0.015 : 0.012;
    const chaosProbMult = isMidGameSite ? 9.6 : 8;
    if (Math.random() < chaosBaseProb) {
      const siteEquip = g.equipment.find(e => (site.assignedEquipmentIds || []).includes(e.id));
      const telematicsTier = siteEquip?.upgrades?.telematics || 0;
      const safetyTier = siteEquip?.upgrades?.safety || 0;
      // Ground conditions are only discovered while you are actually in the ground, AND only
      // on jobs substantial enough to be digging into the unknown.
      //
      // Without the scale gate these events applied to every job with a "Survey" or "Site
      // Prep" phase — including the tutorial Fence Installation. A three-crew starting company
      // on a six-day job was hit by rock strata, water table and archaeological finds faster
      // than it could make progress: measured across four seeds, three of them left that first
      // job unfinished after 120 in-game days, still on its opening phase. That is the worst
      // possible place for it, since it reads as the game being broken.
      const currentPhase = site.phases[site.currentPhaseIdx || 0] || "";
      const _siteDefForGround = CONTRACT_DEFS.find(
        (d) => d.id === (g.contracts.find((c) => c.id === site.contractId)?.defId));
      const substantialJob = (_siteDefForGround?.risk || 1) >= 2
        || (site.durationDays || 0) >= 9;
      const inGround = GROUND_PHASES.has(currentPhase) && substantialJob;
      const eligible = CHAOS_EVENTS.filter((e) => {
        if (e.groundPhase && !inGround) return false;
        let prob = e.prob * chaosProbMult;
        if (e.id === "breakdown") {
          prob *= (1 - telematicsTier * 0.10);
          // Machines run past their service interval break down more. Uses the worst
          // offender on site, so one neglected machine puts the whole job at risk.
          const worstOverdue = (site.assignedEquipmentIds || []).reduce((worst, id) => {
            const eq = g.equipment.find((x) => x.id === id);
            return eq ? Math.max(worst, getServiceOverdueRatio(eq)) : worst;
          }, 0);
          prob *= 1 + Math.min(1, worstOverdue) * (SERVICE_OVERDUE_BREAKDOWN_MULT - 1);
        }
        if (e.id === "safety" || e.id === "inspection") prob *= (1 - safetyTier * 0.09);
        return Math.random() < prob;
      });
      if (eligible.length) {
        const event = pick(eligible);
        const result = event.apply(site, g);
        if (result) {
          if (!site.chaosHistory) site.chaosHistory = [];
          site.chaosHistory = [{ ...result, day: g.day }, ...site.chaosHistory].slice(0, 10);
          if (result.type === "breakdown" || result.type === "safety") {
            g.weeklyStats.unexpectedCosts = (g.weeklyStats.unexpectedCosts || 0) + 2000;
            applyIncident(g, result.type === "safety" ? 2 : 1);
          } else if (result.type === "permit" && Math.random() < 0.3) {
            applyInspectionPass(g);
          }
          checkChainEvents(site, g, result.type);
        }
      }
    }

    // ── Weather ───────────────────────────────────────────────────────────────
    // Independent of the chaos roll above. Rate is tuned to land roughly one weather
    // event per active site per 8-12 in-game days at the seasonal baseline, so weather
    // is a pressure the player plans around rather than a curiosity they never meet.
    if (!site.currentWeather && Math.random() < WEATHER_TICK_PROB * getSeasonalWeatherMult(g)) {
      const siteCityDef = CITIES.find((c) => c.id === site.cityId);
      const siteRegion = siteCityDef?.region || "Pacific Northwest";
      const weatherResult = applyWeatherEvent(site, g, siteRegion);
      if (weatherResult) {
        if (!site.chaosHistory) site.chaosHistory = [];
        site.chaosHistory = [{ ...weatherResult, day: g.day }, ...site.chaosHistory].slice(0, 10);
      }
    }

    // Equipment wear
    for (const id of site.assignedEquipmentIds) {
      const e = g.equipment.find((eq) => eq.id === id);
      if (!e) continue;
      e.engineHours = (e.engineHours || 0) + OPERATING_HOURS_PER_TICK;
      // Running past a service interval wears the machine noticeably faster. This is the
      // whole point of tracking hours: maintenance becomes something you schedule ahead of
      // a big job rather than something you react to after a breakdown.
      const overdueWear = 1 + Math.min(1.2, getServiceOverdueRatio(e)) * (SERVICE_OVERDUE_WEAR_MULT - 1);
      e.condition = Math.max(0, e.condition - (0.1 * MINS_PER_TICK / 60) * overdueWear);
      e.fuel = Math.max(0, e.fuel - (0.5 * MINS_PER_TICK / 60));
      if (!e._serviceWarned && isServiceDue(e)) {
        e._serviceWarned = true;
        addLog(g, `\uD83D\uDD27 ${e.name} is due for service at ${Math.round(e.engineHours)} hours — schedule it in Vehicles before it starts costing you.`);
      }
      if (e.condition < 20 && e.status === "Active") {
        e.status = "Maintenance";
        e.assignedSiteId = null;
        site.assignedEquipmentIds = site.assignedEquipmentIds.filter((eid) => eid !== e.id);
        addLog(g, `🔧 ${e.name} pulled from ${site.label} for emergency maintenance.`);
      } else if (e.fuel <= 0 && e.fuelCap > 0 && e.status === "Active") {
        e.status = "Idle";
        e.assignedSiteId = null;
        site.assignedEquipmentIds = site.assignedEquipmentIds.filter((eid) => eid !== e.id);
        addLog(g, `⛽ ${e.name} ran out of fuel — pulled from ${site.label}. Refuel overnight.`);
      }
    }

    // Crew stamina drain
    const _seasonStamDrain = (g.seasonStaminaMult || 1.0) * 0.25;
    for (const id of site.assignedCrewIds) {
      const w = g.crew.find((w) => w.id === id);
      if (!w) continue;
      w.stamina = Math.max(0, w.stamina - (_seasonStamDrain * MINS_PER_TICK / 60));
      if (Math.random() < 0.05 && (w.skill || 0) < 120) w.skill = Math.min(120, (w.skill || 75) + 1);
      if (w.stamina < 10 && w.status === "Active") {
        w.status = "Idle";
        w.assignedSiteId = null;
        site.assignedCrewIds = site.assignedCrewIds.filter((cid) => cid !== w.id);
        addLog(g, `⚠ ${w.name} exhausted — pulled from ${site.label}.`);
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
    // Login streak / daily reward
    const daysSinceLogin = (g.day||1) - (g.lastLoginDay||0);
    if (daysSinceLogin === 1) {
      g.consecutiveLoginDays = (g.consecutiveLoginDays||0) + 1;
      const streakBonus = Math.min(500, (g.consecutiveLoginDays||1) * 50);
      if ((g.consecutiveLoginDays||0) >= 3) {
        g.cash += streakBonus;
        addLog(g, `🎯 ${g.consecutiveLoginDays}-day streak! Bonus: ${money(streakBonus)}.`);
      }
    } else if (daysSinceLogin > 2) {
      g.consecutiveLoginDays = 1;
    }
    g.lastLoginDay = g.day;

    // Payroll (with labor_shortage market event crewWageMod)
    const activePayrollEvent = g.activeMarketEvent ? MARKET_EVENTS.find((e) => e.id === g.activeMarketEvent) : null;
    const crewWageMod = activePayrollEvent?.crewWageMod || 0;
    const dailyPayroll = [...g.crew.filter((w) => w.onShift !== false), ...g.officeStaff]
      .reduce((s, p) => s + (p.wagePerDay || 0) * (1 + crewWageMod), 0);

    // Office rent
    const office = OFFICES[g.officeIndex];
    const dailyRent = office.dailyRent;

    // Equipment daily cost
    const equipCost = g.equipment.reduce((s, e) => s + getEquipmentDailyCost(e), 0);

    const totalOverhead = dailyPayroll + dailyRent + equipCost;
    g.cash -= totalOverhead;
    g.expenses += totalOverhead;
    g.weeklyStats.expenses += totalOverhead;

    // ── Crew rest ─────────────────────────────────────────────────────────────
    // Crew on site used to recover no stamina at all — only idle workers rested. Since a
    // working day drains ~6 stamina and nothing replaced it, everyone assigned to a job
    // slid to burnout in about a fortnight, quit, and left the site short-handed. On the
    // long contracts that are supposed to be the mid-game that produced a one-way ratchet:
    // simulated companies peaked around day 90 and shrank from there as crew bled out
    // faster than they could be replaced. Crew go home at the end of a shift, so they
    // recover overnight too — just less than someone who had the day off.
    for (const w of g.crew) {
      if (w.status === "Idle") {
        w.stamina = Math.min(100, (w.stamina ?? 50) + rand(15, 25));
        w.mood = Math.min(100, (w.mood ?? 50) + rand(2, 6));
      } else {
        w.stamina = Math.min(100, (w.stamina ?? 50) + rand(4, 8));
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

    // ── Diesel: refuel the fleet and pay for it ───────────────────────────────
    const _fuelBill = refuelFleet(g);
    if (_fuelBill.spend > 0 && g.day % 7 === 0) {
      addLog(g, `⛽ Diesel this week: ${money(g.weeklyStats.fuel || _fuelBill.spend)} at ${(g.dieselPrice || DIESEL_BASE_PRICE).toFixed(2)}/unit.`);
    }
    // People and machines that came off a job yesterday go back out this morning.
    remobiliseSites(g);

    // Pump price drifts, and the fuel_spike market event pushes it hard.
    {
      const drift = (Math.random() - 0.5) * 0.28;
      const spikeMult = g.activeMarketEvent === "fuel_spike" ? 1.035 : 1.0;
      g.dieselPrice = clamp(
        Math.round(((g.dieselPrice || DIESEL_BASE_PRICE) + drift) * spikeMult * 100) / 100,
        DIESEL_MIN_PRICE, DIESEL_MAX_PRICE
      );
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

    // Refresh contracts
    g.contracts = g.contracts.filter((c) => c.status !== "Open" || c.expiresDay >= g.day);
    while (g.contracts.filter((c) => c.status === "Open").length < 5) {
      g.contracts.push(createContract(g));
    }
    // Expire old contracts — preserve all non-Open entries, cap Open pool at 7
    const openPool = g.contracts.filter((c) => c.status === "Open");
    g.contracts = [...g.contracts.filter((c) => c.status !== "Open"), ...openPool.slice(0, 7)];

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

    // ── Equipment finance ─────────────────────────────────────────────────────
    // Deliberately kept in its own list rather than folded into g.loans: the working-capital
    // loan path caps the player at 3 active loans, and financing machines must not consume
    // that allowance. Repossession is what makes financing a real risk rather than free money.
    if (g.day % 7 === 0 && (g.equipmentLoans || []).length) {
      const repossessed = [];
      for (const loan of g.equipmentLoans) {
        if (loan.weeksLeft <= 0) continue;
        if (g.cash >= loan.weeklyPayment) {
          g.cash -= loan.weeklyPayment;
          g.expenses += loan.weeklyPayment;
          g.weeklyStats.expenses += loan.weeklyPayment;
          loan.remainingBalance = Math.max(0, loan.remainingBalance - loan.weeklyPayment);
          loan.weeksLeft -= 1;
          loan.missedPayments = 0;
          if (loan.weeksLeft <= 0) {
            const owned = (g.equipment || []).find((e) => e.id === loan.equipId);
            if (owned) delete owned.isFinanced;
            addLog(g, `✅ ${loan.label} paid off — the machine is yours outright.`);
          }
        } else {
          loan.missedPayments = (loan.missedPayments || 0) + 1;
          g.creditScore = Math.max(300, g.creditScore - 18);
          if (loan.missedPayments >= FINANCE_REPO_MISSED_PAYMENTS) {
            repossessed.push(loan);
          } else {
            const left = FINANCE_REPO_MISSED_PAYMENTS - loan.missedPayments;
            addLog(g, `⚠️ Missed finance payment on ${loan.label} — credit hit. ${left} more and it's repossessed.`);
            addImportantNotice(g, `Missed payment on ${loan.label}. ${left} missed payment${left === 1 ? "" : "s"} from repossession.`, "orange");
          }
        }
      }
      for (const loan of repossessed) {
        const eq = (g.equipment || []).find((e) => e.id === loan.equipId);
        // Free it from any site first so no job is left holding a reference to a machine
        // that no longer exists.
        (g.activeSites || []).forEach((site) => {
          site.assignedEquipmentIds = (site.assignedEquipmentIds || []).filter((id) => id !== loan.equipId);
        });
        g.equipment = (g.equipment || []).filter((e) => e.id !== loan.equipId);
        g.creditScore = Math.max(300, g.creditScore - 25);
        addLog(g, `🚨 ${loan.label} REPOSSESSED after ${FINANCE_REPO_MISSED_PAYMENTS} missed payments. Credit score badly damaged.`);
        addImportantNotice(g, `${eq?.name || loan.label} was repossessed by the lender.`, "red");
      }
      if (repossessed.length) {
        const repoIds = new Set(repossessed.map((l) => l.id));
        g.equipmentLoans = g.equipmentLoans.filter((l) => !repoIds.has(l.id));
        repairCrewAssignments(g);
      }
      g.equipmentLoans = g.equipmentLoans.filter((l) => l.weeksLeft > 0);
    }

    // Equipment maintenance costs: condition < 50% → $10/day per equipment
    const maintenanceCost = (g.equipment||[]).reduce((s,e)=>{
      return s + (e.condition < 50 ? 10 : 0);
    }, 0);
    if (maintenanceCost > 0) {
      g.cash -= maintenanceCost;
      g.expenses += maintenanceCost;
      g.weeklyStats.expenses += maintenanceCost;
    }

    // Equipment condition degrades 0.05% per tick (independent of site assignment)
    for (const e of (g.equipment||[])) {
      if (e.status !== "Active") {
        e.condition = Math.max(0, e.condition - 0.05);
      }
    }

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
          addLog(g, `🏗️ Property income: +${money(_propIncome)} passive revenue from ${_ownedProps.length} propert${_ownedProps.length === 1 ? 'y' : 'ies'}.`);
        }
      }
      const weeklyRevenue = g.weeklyStats.revenue || 0;
      if (weeklyRevenue > 0) {
        g.taxDue = (g.taxDue || 0) + Math.round(weeklyRevenue * 0.12);
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
      g.weeklyStats = { revenue: 0, expenses: 0, jobsCompleted: 0, unexpectedCosts: 0, savingsInterest: 0, fuel: 0 };
    }

    // ── Retainage release ─────────────────────────────────────────────────────
    // Money already earned but withheld until the client signs off. Paid out here so the
    // player sees it arrive as a distinct event a couple of weeks after handover.
    if ((g.pendingRetainage || []).length > 0) {
      const dueNow = g.pendingRetainage.filter((r) => (r.releaseDay || 0) <= g.day);
      for (const r of dueNow) {
        g.cash += r.amount;
        g.revenue += r.amount;
        g.weeklyStats.revenue += r.amount;
        addLog(g, `\uD83D\uDD13 Retainage released: ${money(r.amount)} from "${r.label}" (${r.client}).`);
      }
      if (dueNow.length) {
        g.pendingRetainage = g.pendingRetainage.filter((r) => (r.releaseDay || 0) > g.day);
      }
    }

    // R16-1: Daily savings interest (0.12%/day ≈ 4.4% annual)
    if ((g.savings || 0) > 0) {
      const _savInt = Math.round(g.savings * 0.0012);
      if (_savInt >= 1) {
        g.cash += _savInt;
        g.revenue += _savInt;
        g.weeklyStats.revenue += _savInt;
        g.weeklyStats.savingsInterest = (g.weeklyStats.savingsInterest || 0) + _savInt;
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
      }
    }

    if ((g.taxDue || 0) > 0) {
      g.taxOverdueDays = (g.taxOverdueDays || 0) + 1;
      if (g.taxOverdueDays >= 14) g.businessFrozen = true;
    }

    if (g.cash < 0) {
      addLog(g, `⚠ Day ${g.day}: Overhead ${money(totalOverhead)} — account in the red!`);
      // Early-game safety net: prevent impossible lock-out on first 10 days
      if (g.day <= 10 && g.cash < -500) {
        const grant = Math.abs(g.cash) + 1000;
        g.cash += grant;
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
          g.reputation = Math.min(100, (g.reputation||0) + vm.rep);
          addImportantNotice(g, `💰 ${vm.label} valuation milestone! +${money(vm.reward)} + ${vm.rep} rep.`, "green");
        }
      }
      // Dynasty trigger: Level 10 + Rank #1 + no debt
      const _compLevel = COMPANY_LEVELS.slice().reverse().find(l => (g.reputation||0) >= l.repMin && (g.completedJobs||0) >= l.jobsMin && computeValuation(g) >= l.valMin) || COMPANY_LEVELS[0];
      const _totalDebt = (g.loans||[]).reduce((s,l)=>s+(l.remaining||0),0);
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
      const surcharge = Math.round(g.equipment.reduce((s, e) => s + getEquipmentDailyCost(e), 0) * (activeEvent.equipDailyCostMult - 1));
      if (surcharge > 0) { g.cash -= surcharge; g.expenses += surcharge; }
    }

    // ── Regional office rent ───────────────────────────────────────────────────
    const officeRent = (g.cityOffices||[]).reduce((s,o) => {
      const def = REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId);
      return s + (def ? def.dailyRent : 0);
    }, 0);
    if (officeRent > 0) { g.cash -= officeRent; g.expenses += officeRent; }

    // ── Property running costs ────────────────────────────────────────────────
    const propCost = (g.properties||[]).reduce((s,p) => {
      const def = PROPERTY_TYPES.find(t=>t.id===p.typeId);
      return s + (def ? def.dailyCost : 0);
    }, 0);
    if (propCost > 0) { g.cash -= propCost; g.expenses += propCost; }

    // ── PM payroll ─────────────────────────────────────────────────────────────
    const pmPayroll = (g.projectManagers||[]).reduce((s,pm) => s + (pm.wagePerDay||0), 0);
    if (pmPayroll > 0) { g.cash -= pmPayroll; g.expenses += pmPayroll; }

    // ── PM auto-management: senior PMs unpause stalled sites ──────────────────
    const hasAutoMgr = (g.projectManagers||[]).some(pm => {
      const def = PM_TIERS.find(t=>t.id===pm.typeId);
      return def?.autoManage;
    });
    if (hasAutoMgr) {
      for (const site of g.activeSites) {
        if (site.status === "Paused" && Math.random() < 0.60) {
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

    // ── Walk-in applicants ────────────────────────────────────────────────────
    // Paid job ads used to be the ONLY source of labour: g.applicants started empty and was
    // filled exclusively by handlePostJob. Since crew quit, burn out and retire, a player who
    // lost people and did not know to buy an ad had no way back — the company simply stalled
    // with too few crew to meet any contract's minimum. A reputable contractor gets people
    // turning up looking for work, so there is now a small organic trickle. Ads still matter:
    // they are faster and buy access to better tradespeople than a walk-in.
    if ((g.applicants || []).length < WALKIN_APPLICANT_CAP) {
      const repFactor = Math.min(1, (g.reputation || 0) / 60);
      const shortHanded = g.crew.length < 3 ? 0.10 : 0;   // word gets round when you need people
      if (Math.random() < WALKIN_BASE_CHANCE + repFactor * 0.14 + shortHanded) {
        if (!g.applicants) g.applicants = [];
        g.applicants.push(createApplicant({
          // Walk-ins are ordinary hands; the Premium ad is still how you find a foreman.
          skillMin: 70, skillMax: 95 + Math.round(repFactor * 15),
        }));
        addLog(g, `\uD83D\uDC77 A tradesperson stopped by looking for work — see Crew.`);
      }
    }

    // ── Change orders ─────────────────────────────────────────────────────────
    // Only on a job that is meaningfully underway (a client does not redesign on day one)
    // and not already carrying two changes, so a long build cannot spiral indefinitely.
    if (!g.pendingDecision) {
      const eligibleSites = (g.activeSites || []).filter((site) => {
        if (site.status !== "Active" || !(site.phases || []).length) return false;
        const overall = (site.currentPhaseIdx || 0) / site.phases.length;
        return overall >= 0.25 && overall <= 0.8 && (site.changeOrders || []).length < 2;
      });
      if (eligibleSites.length && Math.random() < 0.07) {
        const site = pick(eligibleSites);
        const req = pick(CHANGE_ORDER_REQUESTS);
        const valuePct = req.valuePct[0] + Math.random() * (req.valuePct[1] - req.valuePct[0]);
        const valueAdd = Math.round((site.totalValue || 0) * valuePct);
        const extraDays = rand(req.days[0], req.days[1]);
        const contract = (g.contracts || []).find((c) => c.id === site.contractId);
        g.pendingDecision = {
          id: CHANGE_ORDER_EVENT.id,
          title: CHANGE_ORDER_EVENT.title,
          tone: CHANGE_ORDER_EVENT.tone,
          desc: `${site.client} ${req.text} on "${site.label}". They will pay ${money(valueAdd)} more and allow ${extraDays} extra day${extraDays === 1 ? "" : "s"}.`,
          context: {
            siteId: site.id,
            clientId: contract?.clientId || null,
            valueAdd,
            extraDays,
            progressCost: rand(5, 15),
          },
          options: CHANGE_ORDER_EVENT.options.map((o) => ({ label: o.label, sub: o.sub })),
        };
      }
    }

    // ── Decision events ────────────────────────────────────────────────────────
    if (!g.pendingDecision && ((g.day % 15 === 0 && Math.random() < 0.40) || (g.day % 7 === 0 && Math.random() < 0.12))) {
      const evt = pick(DECISION_EVENTS);
      // Only store serializable fields — apply() functions looked up from DECISION_EVENTS at render time
      g.pendingDecision = {
        id: evt.id, title: evt.title, tone: evt.tone, desc: evt.desc,
        options: evt.options.map(o => ({ label: o.label, sub: o.sub })),
      };
    }

    // ── Employee events (pop-up decisions from active crew) ────────────────────
    if (!g.pendingDecision && (g.activeSites||[]).some(s => (s.assignedCrewIds||[]).length > 0)) {
      // ~8% chance per game day (every 48 ticks) if crew are on site
      if (Math.random() < 0.0017) {
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
            eq.condition = Math.min(100, (eq.condition || 0) + 40);
            if (eq.status === "Broken") eq.status = "Idle";
            addLog(g, `🔧 Auto-repaired ${eq.name} — ${money(repCost)}.`);
          }
        }
      }
    }

    // ── Auto-purchase missing materials for active sites ──────────────────────
    if (g.autoPurchaseMaterials && newDay) {
      for (const site of (g.activeSites || [])) {
        if (site.status !== "Active") continue;
        const _con = (g.contracts || []).find(c => c.id === site.contractId);
        const _def = CONTRACT_DEFS.find(d => d.id === _con?.defId);
        if (!_def?.materials) continue;
        const _disc = getMaterialDiscount(g);
        for (const [matId, needed] of Object.entries(_def.materials)) {
          const have = (site.materialsFulfilled || {})[matId] || 0;
          if (have >= needed) continue;
          const shortage = needed - have;
          const price = (g.materialPrices || {})[matId] || 100;
          const cost = Math.round(shortage * price * (1 - _disc));
          if (g.cash >= cost) {
            g.cash -= cost;
            g.expenses = (g.expenses || 0) + cost;
            g.weeklyStats.expenses = (g.weeklyStats.expenses || 0) + cost;
            if (!site.materialsFulfilled) site.materialsFulfilled = {};
            site.materialsFulfilled[matId] = needed;
            addLog(g, `⚡ Auto-purchased ${shortage} ${matId} for "${site.label}" — ${money(cost)}.`);
          }
        }
      }
    }

    // ── Bankruptcy check ──────────────────────────────────────────────────────
    if (g.cash < -10000) {
      g.bankruptcyDays = (g.bankruptcyDays || 0) + 1;
      if (g.bankruptcyDays >= 5) {
        g.gameOver = true;
        g.gameOverReason = "bankruptcy";
      } else {
        addLog(g, `🚨 Bankruptcy warning: ${money(Math.abs(g.cash))} in debt — Day ${g.bankruptcyDays} of 5 before collapse.`);
      }
    } else if (g.cash >= 0) {
      g.bankruptcyDays = 0;
    }

    // ── Housekeeping ──────────────────────────────────────────────────────────
    // cleanStaleState enforces every cap this save has — log length, event history,
    // per-site chaos history, per-worker job history, and the purging of finished, lost and
    // rival-taken contracts. It used to run ONLY from migrateState, i.e. once when a save was
    // opened and never again while the game was actually being played. Everything it bounds
    // therefore grew without limit for the whole session: a simulated 300-day run carried 813
    // contracts (732 of them long-dead "Taken" entries) in a 435KB save, and both the per-tick
    // state clone and the save serialisation scaled with it.
    cleanStaleState(g);

    // ── Empire goals ──────────────────────────────────────────────────────────
    checkEmpireGoals(g);
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
const REAL_SECONDS_PER_GAME_MINUTE = 0.1;
const MAX_OFFLINE_REAL_SECONDS = 7 * 24 * 3600; // 7 days cap
const OFFLINE_SUMMARY_THRESHOLD_GAME_MINUTES = 5; // show summary if > 5 game-min away

export function computeOfflineProgress(savedGame, nowTimestamp) {
  const lastTs = savedGame.lastRealTimestamp;
  if (!lastTs || !nowTimestamp) return null;
  const elapsedRealSeconds = Math.min(MAX_OFFLINE_REAL_SECONDS, Math.max(0, (nowTimestamp - lastTs) / 1000));
  if (elapsedRealSeconds < 1) return null;
  const elapsedGameMinutes = Math.floor(elapsedRealSeconds / REAL_SECONDS_PER_GAME_MINUTE);
  if (elapsedGameMinutes < OFFLINE_SUMMARY_THRESHOLD_GAME_MINUTES) return null;
  const ticksToRun = Math.floor(elapsedGameMinutes / 30); // 30 game-min per tick
  if (ticksToRun < 1) return null;
  return { elapsedRealSeconds, elapsedGameMinutes, ticksToRun };
}

export function applyOfflineProgress(savedGame, ticksToRun) {
  const MAX_TICKS = 480; // cap at 10 game days (48 ticks/day) for performance
  const clampedTicks = Math.min(ticksToRun, MAX_TICKS);
  let g = clone(savedGame);

  const before = {
    cash: g.cash,
    completedJobs: g.completedJobs || 0,
    reputation: g.reputation || 0,
    day: g.day || 1,
    logCount: (g.logs || []).length,
  };

  for (let i = 0; i < clampedTicks; i++) {
    const cashBefore = g.cash;
    g = gameTick(g);
    // Offline payroll protection: if a single tick would burn more than 50% of
    // a positive cash balance, cap the loss so the player doesn't log back in bankrupt
    if (cashBefore > 0 && g.cash < cashBefore * 0.5 && g.cash < 0) {
      g.cash = Math.max(0, cashBefore * 0.5);
    }
    // Hard bankruptcy floor: never go below -$50,000
    if (g.cash < -50000) {
      g.cash = -50000;
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
  const dailyEquip  = (g.equipment || []).reduce((s, e) => s + getEquipmentDailyCost(e), 0);
  const dailyRent   = OFFICES[g.officeIndex || 0]?.dailyRent || 0;
  const overheadPerDay = Math.round(dailyWages + dailyEquip + dailyRent);

  g.pendingOfflineSummary = {
    elapsedDays: daysDelta,
    cashDelta,
    jobsDelta,
    repDelta,
    cashNow: after.cash,
    overheadPerDay,
    logsWhileAway,
  };
  g.lastRealTimestamp = Date.now();
  return g;
}

// ─── Submit a bid on an open contract ───────────────────────────────────────────
// Extracted out of the screen component so the bid contest is directly testable: it is the
// central money decision in the game and it used to be a bare payout multiplier with no
// outcome at all. Mutates `g` in place (matching every other state mutator here) and returns
// a result object; the caller owns showing the alert. Never throws.
export function submitBidCore(g, contractId, crewIds, equipIds) {
  const c = (g.contracts || []).find((x) => x.id === contractId);
  if (!c || c.status !== "Open") return { ok: false, reason: "This contract is no longer open." };
  const blockReason = getAssignBlockReason(c, crewIds, equipIds, g);
  if (blockReason) return { ok: false, reason: blockReason };

  // Submitting costs the estimating fee whether you win or not, so bidding wide has a real
  // price. Nothing else is committed until the bid is won: crew, equipment and materials are
  // all left untouched on a loss.
  const bidStyle = (g.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE;
  const style = getBidStyle(bidStyle);
  const winChance = computeBidWinChance(g, c, bidStyle);
  const prepCost = getBidPrepCost(c);
  g.cash -= prepCost;
  g.expenses += prepCost;
  g.weeklyStats.expenses += prepCost;

  const yourBid = Math.round(c.value * style.multiplier);

  if (Math.random() >= winChance) {
    // Lost. Name the winner and their price so this reads as a market you were beaten in
    // rather than an invisible dice roll — the player can see that bidding lower would have
    // won it, which is the entire point of having a strategy choice at all.
    const activeRivals = (g.rivals || []).filter((r) => r.status !== "Bankrupt");
    const winner = c.interestedRival
      || (activeRivals.length ? pick(activeRivals).name : "another contractor");
    const winningBid = Math.round(yourBid * (0.86 + Math.random() * 0.1));
    c.status = "Lost";
    c.lostToRival = winner;
    c.lostOnDay = g.day;
    g.bidsLost = (g.bidsLost || 0) + 1;
    addLog(g, `📉 Bid lost: "${c.label}" went to ${winner} at ${money(winningBid)} — your ${style.label.toLowerCase()} bid was ${money(yourBid)}. Estimating cost ${money(prepCost)}.`);
    addImportantNotice(g, `${winner} won "${c.label}". Bid lower next time, or build reputation to win at your price.`, "orange");
    return { ok: true, won: false, winner, winChance, prepCost, yourBid };
  }

  g.bidsWon = (g.bidsWon || 0) + 1;
  const effectiveValue = yourBid;

  // Consume materials — track exactly what was fulfilled, never go negative
  const materialsFulfilled = {};
  for (const matId of Object.keys(c.materials || {})) {
    const needed = c.materials[matId];
    const available = Math.max(0, g.materials[matId] || 0);
    const consumed = Math.min(needed, available);
    g.materials[matId] = available - consumed;
    materialsFulfilled[matId] = consumed;
  }

  // Mark crew and equipment as active
  for (const id of crewIds) {
    const w = g.crew.find((w) => w.id === id);
    if (w) { w.status = "Active"; w.assignedSiteId = c.id; }
  }
  for (const id of equipIds) {
    const e = g.equipment.find((e) => e.id === id);
    if (e) { e.status = "Active"; e.assignedSiteId = c.id; }
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
  });

  // Mobilisation draw. Smaller than the old 25% lump because the balance now arrives as
  // progress payments while the work is done, rather than all at the end.
  const _newSite = g.activeSites[g.activeSites.length - 1];
  const _mob = billSiteDraw(g, _newSite, Math.round(effectiveValue * MOBILISATION_DEPOSIT_PCT), null);
  _newSite.depositPaid = _mob.net;

  addLog(g, `🏗️ Bid WON: "${c.label}" for ${c.client} — ${money(effectiveValue)} on a ${style.label.toLowerCase()} bid (${Math.round(winChance * 100)}% odds). 💰 Mobilisation draw: ${money(_mob.net)}.`);
  return { ok: true, won: true, winChance, prepCost, yourBid, site: _newSite };
}

// ─── Hiring and purchasing cores ────────────────────────────────────────────────
// Extracted from the screen for the same reason submitBidCore was: these move real money,
// and the balance harness (__tests__/constructionFlowEconomyCurve.test.js) has to drive the
// SAME code the player does. A harness that re-implements "what hiring costs" measures its
// own arithmetic instead of the game's, and would happily certify an economy the game does
// not actually have. Both mutate `g` in place and return a result object; the caller owns
// showing the alert.
export function hireCrewCore(g, applicant) {
  if (!applicant) return { ok: false, reason: "No applicant selected." };
  if (g.crew.length >= getTotalCrewCap(g)) {
    return { ok: false, reason: "Upgrade your office or open a Regional Office in a new city." };
  }
  const bonus = applicant.signingBonus || 0;
  if (g.cash < bonus) return { ok: false, reason: `Signing bonus requires ${money(bonus)}.` };
  g.cash -= bonus;
  g.expenses += bonus;
  g.applicants = (g.applicants || []).filter((a) => a.id !== applicant.id);
  const worker = {
    ...createWorker(applicant.role),
    id: uid(), name: applicant.name, role: applicant.role,
    skill: applicant.skill, wagePerDay: applicant.desiredWage,
    mood: applicant.mood, loyalty: applicant.loyalty, trait: applicant.trait,
    hireDay: g.day, jobHistory: [], attendanceStrikes: 0,
    status: "Idle",
  };
  delete worker.siteId;
  delete worker.currentSiteId;
  delete worker.assignedSiteId;
  g.crew.push(worker);
  trackHire(g);
  addLog(g, `👷 ${applicant.name} hired as ${applicant.role}.`);
  repairCrewAssignments(g);
  return { ok: true, worker };
}

export function payTaxCore(g) {
  if ((g.taxDue || 0) <= 0) return { ok: false, reason: "No tax owing." };
  if (g.cash < g.taxDue) return { ok: false, reason: `Tax bill is ${money(g.taxDue)}.` };
  const paid = g.taxDue;
  g.cash -= paid;
  g.expenses += paid;
  addLog(g, `\u2705 Tax bill of ${money(paid)} paid.`);
  g.taxDue = 0;
  g.taxOverdueDays = 0;
  g.businessFrozen = false;
  return { ok: true, paid };
}

export function buyEquipmentCore(g, item, isUsed = false) {
  if (!item) return { ok: false, reason: "No equipment selected." };
  const discount = (g._equipDiscount || 0);
  const basePrice = Math.round(item.price * (1 - discount));
  const effectivePrice = isUsed ? Math.round(basePrice * 0.58) : basePrice;
  if (g.cash < effectivePrice) return { ok: false, reason: `Need ${money(effectivePrice)}.` };
  const office = OFFICES[g.officeIndex];
  if (g.equipment.length >= office.equipCap + getEquipCapBonus(g)) {
    return { ok: false, reason: "Upgrade your office to add more vehicles to your fleet." };
  }
  g.cash -= effectivePrice;
  g.expenses += effectivePrice;
  const equip = createEquipment(item);
  if (isUsed) {
    equip.condition = rand(40, 68);
    equip.reliability = Math.round(item.reliability * 0.78);
    equip.isUsed = true;
    // A used machine has a working life behind it: it must not read as zero-hours, or
    // buying used would be a way to acquire a pristine service history for 58% of list.
    equip.engineHours = Math.round((100 - equip.condition) * 30);
    equip.hoursAtLastService = Math.max(0, equip.engineHours - rand(0, SERVICE_INTERVAL_HOURS - 1));
  }
  g.equipment.push(equip);
  if (discount > 0) {
    delete g._equipDiscount;
    delete g._equipDiscountExpiry;
  }
  addLog(g, `🚜 ${isUsed ? "Used " : ""}${item.name} purchased for ${money(effectivePrice)}${discount > 0 ? ` (${Math.round(discount * 100)}% discount)` : ""}.`);
  trackEquipBuy(g);
  return { ok: true, equipment: equip, price: effectivePrice };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ConstructionFlowScreen({ onBackToHub }) {
  const [game, setGame] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("Home");
  const [theme, setTheme] = useState("dark");
  const T = THEMES[theme] || THEMES.dark;
  const tickRef = useRef(null);
  const [speedMode, setSpeedMode] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const gameRef = useRef(null);
  const saveTimerRef = useRef(null);
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
      // Parse + migrate one stored payload. Returns null (never throws) if the payload is
      // absent, unparseable, or fails the structural integrity check, so the caller can
      // fall through to the next source rather than losing the company outright.
      const tryLoad = (raw) => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!checkSaveIntegrity(parsed).valid) return null;
          return migrateState(parsed);
        } catch (_) {
          return null;
        }
      };

      let saved = null;
      let recoveredFromBackup = false;
      let lostSave = false;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        saved = tryLoad(raw);
        if (saved) {
          // Snapshot the payload we just proved loadable as this session's rollback point,
          // once, before any gameplay write can replace it. Deliberately not done on every
          // throttled save: that would keep overwriting the backup with the newest payload,
          // so a save that goes bad would immediately be backed up over the last good one
          // and the backup would protect nothing.
          AsyncStorage.setItem(BACKUP_STORAGE_KEY, raw).catch(() => {});
        }
        if (!saved && raw) {
          // The main slot exists but is unreadable. Fall back to the last good backup.
          const backupRaw = await AsyncStorage.getItem(BACKUP_STORAGE_KEY);
          saved = tryLoad(backupRaw);
          recoveredFromBackup = !!saved;
          lostSave = !saved;
        }
      } catch (_) {
        // AsyncStorage itself is unavailable — fall through to a fresh company.
        lostSave = true;
      }

      if (saved) {
        if (recoveredFromBackup) {
          addImportantNotice(saved, "⚠️ Your save was damaged and has been restored from the last good backup. You may have lost a little recent progress.", "orange");
          addLog(saved, "🛟 Save recovered from backup after the main save failed to load.");
        }
        const nowTs = Date.now();
        const offlineInfo = computeOfflineProgress(saved, nowTs);
        if (offlineInfo && offlineInfo.ticksToRun > 0) {
          const progressed = applyOfflineProgress(saved, offlineInfo.ticksToRun);
          setGame(progressed);
          setTheme(progressed.theme || "dark");
        } else {
          saved.lastRealTimestamp = nowTs;
          setGame(saved);
          setTheme(saved.theme || "dark");
        }
      } else {
        const fs = freshState();
        fs.lastRealTimestamp = Date.now();
        if (lostSave) {
          // Tell the player rather than silently handing them a new company and letting
          // them work out for themselves that weeks of play are gone.
          addImportantNotice(fs, "⚠️ Your previous save could not be read and no usable backup was found. Starting a new company.", "red");
          addLog(fs, "⚠️ Previous save was unreadable — started a new company.");
        }
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
        next.crew.push(createWorker({ name: m.name, skill: m.skill||75, role: m.role, wagePerDay: m.wagePerDay||WAGE_SCALE.DEFAULT, loyalty: 90, jobsCompleted: 20 }));
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

  // Haptics for the two outcomes the player is not necessarily looking at the screen for:
  // a job landing, and a breakdown pulling a machine off site. Keyed on the pending-card
  // fields so each fires exactly once, when the card appears.
  const celebratedRef = useRef(null);
  useEffect(() => {
    const key = game?.pendingCelebration ? `${game.pendingCelebration.label}-${game.pendingCelebration.day}` : null;
    if (key && key !== celebratedRef.current) {
      celebratedRef.current = key;
      triggerHaptic("success", game.hapticsEnabled !== false);
    }
  }, [game?.pendingCelebration, game?.hapticsEnabled]);

  const breakdownRef = useRef(null);
  useEffect(() => {
    const key = game?.pendingBreakdown?.equipId || null;
    if (key && key !== breakdownRef.current) {
      breakdownRef.current = key;
      triggerHaptic("error", game.hapticsEnabled !== false);
    }
  }, [game?.pendingBreakdown, game?.hapticsEnabled]);

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
    const tickMs = speedMode ? 1500 : 3000;
    tickRef.current = setInterval(() => {
      setGame((prev) => {
        if (!prev) return prev;
        try {
          let next = gameTick(prev);
          if (next.cash < -50000) next.cash = -50000;
          next.lastRealTimestamp = Date.now();
          return next;
        } catch (e) {
          if (__DEV__) console.warn("[ConstructionFlow] tick error:", e);
          return prev;
        }
      });
    }, tickMs); // speedMode: 1.5s real = 15 min game; normal: 3s = 30 min game
    return () => clearInterval(tickRef.current);
  }, [loaded, speedMode]);

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
            saveGame(progressed);
            return progressed;
          }
          const updated = { ...prevGame, lastRealTimestamp: nowTs };
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
    update((g) => {
      const result = buyEquipmentCore(g, item, isUsed);
      if (!result.ok) Alert.alert("Cannot Purchase", result.reason);
    });
  }, [update]);

  const handleRentEquipment = useCallback((item) => {
    update((g) => {
      const office = OFFICES[g.officeIndex];
      const totalEquipCap = office.equipCap + getEquipCapBonus(g);
      // A rented machine still has to be managed and stored, so it occupies a fleet slot.
      // What renting buys you is capital, not capacity — upgrading the yard stays worthwhile.
      if (g.equipment.length >= totalEquipCap) { Alert.alert("Vehicles Cap", "Upgrade your office to add more vehicles to your fleet."); return; }
      const delivery = getRentalDeliveryFee(item);
      if (g.cash < delivery) { Alert.alert("Insufficient Funds", `Delivery to site costs ${money(delivery)}.`); return; }
      g.cash -= delivery;
      g.expenses += delivery;
      const equip = createEquipment(item);
      equip.isRental = true;
      equip.rentalDailyRate = getRentalDailyRate(item);
      equip.rentedOnDay = g.day;
      g.equipment.push(equip);
      addLog(g, `🔑 Rented ${item.name} — ${money(equip.rentalDailyRate)}/day plus ${money(delivery)} delivery. Return it from Vehicles when the job is done.`);
    });
  }, [update]);

  const handleReturnRental = useCallback((equipId) => {
    update((g) => {
      const e = (g.equipment || []).find((eq) => eq.id === equipId);
      if (!e) return;
      if (!e.isRental) { Alert.alert("Not Rented", "This machine is owned — sell it instead."); return; }
      if (e.status === "Active") { Alert.alert("In Use", "Can't return equipment currently assigned to a site."); return; }
      const days = Math.max(1, (g.day || 1) - (e.rentedOnDay || g.day));
      g.equipment = g.equipment.filter((eq) => eq.id !== equipId);
      addLog(g, `🔑 Returned ${e.name} after ${days} day${days === 1 ? "" : "s"} on hire. Daily cost ends today.`);
    });
  }, [update]);

  const handleFinanceEquipment = useCallback((item) => {
    update((g) => {
      const discount = (g._equipDiscount || 0);
      const price = Math.round(item.price * (1 - discount));
      const terms = getFinanceTerms(item, price);
      if (g.creditScore < 580) { Alert.alert("Credit Too Low", "Equipment finance needs a credit score of 580+. Build your record with smaller jobs first."); return; }
      if (g.cash < terms.down) { Alert.alert("Insufficient Deposit", `Financing needs ${money(terms.down)} down (${Math.round(FINANCE_DOWN_PCT * 100)}%).`); return; }
      const office = OFFICES[g.officeIndex];
      const totalEquipCap = office.equipCap + getEquipCapBonus(g);
      if (g.equipment.length >= totalEquipCap) { Alert.alert("Vehicles Cap", "Upgrade your office to add more vehicles to your fleet."); return; }

      g.cash -= terms.down;
      g.expenses += terms.down;
      const equip = createEquipment(item);
      equip.isFinanced = true;
      g.equipment.push(equip);
      if (!g.equipmentLoans) g.equipmentLoans = [];
      g.equipmentLoans.push({
        id: uid(), equipId: equip.id, label: item.name,
        weeklyPayment: terms.weeklyPayment, weeksLeft: terms.weeks,
        remainingBalance: terms.total, missedPayments: 0,
      });
      if (discount > 0) { delete g._equipDiscount; delete g._equipDiscountExpiry; }
      trackEquipBuy(g);
      addLog(g, `🏦 Financed ${item.name}: ${money(terms.down)} down, ${money(terms.weeklyPayment)}/week for ${terms.weeks} weeks. Miss ${FINANCE_REPO_MISSED_PAYMENTS} payments and it's repossessed.`);
    });
  }, [update]);

  const handleSpeedUp = useCallback(() => {
    const cur = gameRef.current;
    if (!cur) return;
    const uses = cur.speedUpUses || 0;
    const cost = Math.round(1000 * Math.pow(2, uses));
    if (cur.cash < cost) {
      Alert.alert("Insufficient Funds", `You need ${money(cost)} to speed up time.\nSave up and try again.`);
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
    update((g) => {
      const e = g.equipment.find((eq) => eq.id === equipId);
      if (!e) return;
      const cost = Math.round((100 - e.condition) * 25);
      if (g.cash < cost) { Alert.alert("Insufficient Funds", `Repair costs ${money(cost)}.`); return; }
      g.cash -= cost;
      g.expenses += cost;
      e.condition = 100;
      e.fuel = e.fuelCap;
      e.status = "Idle";
      if (g.pendingBreakdown?.equipId === equipId) g.pendingBreakdown = null;
      addLog(g, `🔧 ${e.name} repaired and fuelled for ${money(cost)}.`);
    });
  }, [update]);

  const handleSellEquipment = useCallback((equipId) => {
    update((g) => {
      const e = g.equipment.find((eq) => eq.id === equipId);
      if (!e) return;
      if (e.status === "Active") { Alert.alert("In Use", "Can't sell equipment currently assigned to a site."); return; }
      const salePrice = getEquipmentResaleValue(e);
      g.cash += salePrice;
      g.revenue += salePrice;
      g.equipment = g.equipment.filter((eq) => eq.id !== equipId);
      addLog(g, `💸 Sold ${e.name} for ${money(salePrice)}.`);
    });
  }, [update]);

  const handleHireCrew = useCallback((applicant) => {
    update((g) => {
      const result = hireCrewCore(g, applicant);
      if (!result.ok) Alert.alert("Cannot Hire", result.reason);
    });
  }, [update]);

  const handleFireCrew = useCallback((workerId) => {
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
    update((g) => {
      const w = g.crew.find(w => w.id === workerId);
      if (!w) return;
      if (g.cash < 500) { Alert.alert("Insufficient Funds", "Promotion costs $500."); return; }
      if ((w.level||1) < 3 || (w.skill||0) < 70) { Alert.alert("Not Eligible", "Worker needs level 3+ and skill 70+."); return; }
      g.cash -= 500;
      g.expenses += 500;
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
      if (g.cash < posting.cost) { Alert.alert("Insufficient Funds", `Posting costs ${money(posting.cost)}.`); return; }
      g.cash -= posting.cost;
      g.expenses += posting.cost;
      for (let i = 0; i < posting.count; i++) {
        g.applicants.push(createApplicant({ skillMin: posting.skillMin, skillMax: posting.skillMax, wageMin: posting.wageMin, wageMax: posting.wageMax, quality: posting.quality }));
      }
      addLog(g, `📢 Job ad posted — ${posting.count} applicant(s) added.`);
    });
  }, [update]);

  const handleBuyMaterials = useCallback((matId, qty) => {
    update((g) => {
      if (!qty || qty < 1) return;
      const basePrice = g.materialPrices[matId] || MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice || 100;
      // R15-8: Apply flash deal price if active for this material
      const isFlashDeal = g.hotMaterialDeal && g.hotMaterialDeal.matId === matId && g.hotMaterialDeal.expiresDay >= g.day;
      const price = isFlashDeal ? g.hotMaterialDeal.unitPrice : Math.round(basePrice * (1 - getMaterialDiscount(g)));
      const totalCost = price * qty;
      if (g.cash < totalCost) { Alert.alert("Insufficient Funds", `Costs ${money(totalCost)}.`); return; }
      g.cash -= totalCost;
      g.expenses += totalCost;
      g.materials[matId] = (g.materials[matId] || 0) + qty;
      const mat = MATERIAL_DEFS.find((m) => m.id === matId);
      addLog(g, `📦 Purchased ${qty} ${mat?.unit || "units"} of ${mat?.label || matId} for ${money(totalCost)}.`);
    });
  }, [update]);

  // Purchase exactly the missing materials for an active site at market price
  const handleBuyMaterialsForSite = useCallback((siteId) => {
    update((g) => {
      const site = g.activeSites.find(s => s.id === siteId);
      if (!site) return;
      const contract = g.contracts.find(c => c.id === site.contractId);
      const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
      const missing = getSiteMissingMaterials(site, def, g);
      if (!missing.length) return;
      const totalCost = missing.reduce((s, m) => s + m.costNormal, 0);
      if (g.cash < totalCost) {
        // Partial: buy as much as possible
        let budget = g.cash;
        for (const m of missing) {
          if (budget <= 0) break;
          const canBuy = Math.min(m.missing, Math.floor(budget / m.pricePerUnit));
          if (canBuy > 0) {
            const cost = canBuy * m.pricePerUnit;
            g.cash -= cost;
            g.expenses += cost;
            if (!site.materialsFulfilled) site.materialsFulfilled = {};
            site.materialsFulfilled[m.matId] = (site.materialsFulfilled[m.matId] || 0) + canBuy;
            budget -= cost;
            addLog(g, `📦 Partial buy: ${canBuy} ${m.unit} of ${m.label} for ${money(cost)}.`);
          }
        }
      } else {
        g.cash -= totalCost;
        g.expenses += totalCost;
        for (const m of missing) {
          if (!site.materialsFulfilled) site.materialsFulfilled = {};
          site.materialsFulfilled[m.matId] = (site.materialsFulfilled[m.matId] || 0) + m.missing;
          addLog(g, `📦 Bought ${m.missing} ${m.unit} of ${m.label} for ${money(m.costNormal)}.`);
        }
      }
    });
  }, [update]);

  // Emergency purchase: 1.5× price, uses supplier credit if cash is short
  const handleEmergencyPurchase = useCallback((siteId) => {
    update((g) => {
      const site = g.activeSites.find(s => s.id === siteId);
      if (!site) return;
      const contract = g.contracts.find(c => c.id === site.contractId);
      const def = CONTRACT_DEFS.find(d => d.id === contract?.defId);
      const missing = getSiteMissingMaterials(site, def, g);
      if (!missing.length) return;
      const totalCost = missing.reduce((s, m) => s + m.costEmergency, 0);
      const shortfall = Math.max(0, totalCost - (g.cash || 0));
      const canUseCredit = (g.creditScore || 600) >= 600;
      if (shortfall > 0 && !canUseCredit) {
        addLog(g, `❌ Emergency purchase failed — insufficient cash and credit below 600.`);
        return;
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
      for (const m of missing) {
        if (!site.materialsFulfilled) site.materialsFulfilled = {};
        site.materialsFulfilled[m.matId] = (site.materialsFulfilled[m.matId] || 0) + m.missing;
        addLog(g, `⚡ Emergency delivery: ${m.missing} ${m.unit} of ${m.label} (${money(m.costEmergency)}).`);
      }
    });
  }, [update]);

  const handleStartSite = useCallback((contract, crewIds, equipIds) => {
    update((g) => {
      const result = submitBidCore(g, contract.id, crewIds, equipIds);
      if (!result.ok) { Alert.alert("Cannot Submit Bid", result.reason); return; }
      triggerHaptic(result.won ? "success" : "warning", g.hapticsEnabled !== false);
    });
  }, [update]);

  const handleHireSubcontractor = useCallback((typeId) => {
    update((g) => {
      const def = SUBCONTRACTOR_TYPES.find((t) => t.id === typeId);
      if (!def) return;
      if (g.cash < def.hireCost) { Alert.alert("Insufficient Funds", `Hire cost: ${money(def.hireCost)}`); return; }
      g.cash -= def.hireCost;
      g.expenses += def.hireCost;
      if (!g.subcontractors) g.subcontractors = [];
      g.subcontractors.push(createSubcontractor(typeId));
      addLog(g, `🤝 Hired ${def.label} for ${def.durationDays} days — ${money(def.hireCost)} upfront.`);
    });
  }, [update]);

  const handleBuyInsurance = useCallback((planId) => {
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
    update((g) => {
      if (g.creditScore < product.minCredit) { Alert.alert("Credit Too Low", `Need ${product.minCredit}+ credit score.`); return; }
      // Max 3 active loans (infinite-loop prevention)
      if ((g.loans||[]).length >= 3) { Alert.alert("Loan Limit", "You already have 3 active loans. Pay off a loan before taking another."); return; }
      // No new loans when cash is negative (bankruptcy recovery abuse prevention)
      if ((g.cash||0) < 0) { Alert.alert("Account in Red", "Cannot take loans while your account is negative. Generate revenue first."); return; }
      const existingDebt = (g.loans||[]).reduce((s, l) => s + l.remainingBalance, 0);
      const currentValuation = computeValuation(g);
      // Debt must be < 3× current valuation
      if (existingDebt > currentValuation * 3) { Alert.alert("Debt Limit", `Your debt-to-value ratio is too high. Grow your company or repay loans first.`); return; }
      const debtLimit = Math.max(5000, g.cash * product.maxDebtFactor + g.reputation * 60);
      if (existingDebt + product.principal > debtLimit) { Alert.alert("Debt Limit", "Too much existing debt for this loan."); return; }
      const loan = createLoanFromProduct(product, g);
      g.loans.push(loan);
      g.cash += product.principal;
      g.revenue += product.principal;
      addLog(g, `💳 Loan approved: ${money(product.principal)} (${Math.round(loan.apr)}% APR, ${product.weeks} weeks).`);
    });
  }, [update]);

  const handlePayTax = useCallback(() => {
    update((g) => {
      const result = payTaxCore(g);
      if (!result.ok && (g.taxDue || 0) > 0) Alert.alert("Insufficient Funds", result.reason);
    });
  }, [update]);

  // R16-1: Savings account handlers
  const handleSavingsDeposit = useCallback((amount) => {
    update((g) => {
      const amt = Math.round(amount);
      if (!amt || amt <= 0) { Alert.alert("Invalid Amount", "Enter a positive amount."); return; }
      if (g.cash < amt) { Alert.alert("Insufficient Funds", `Need ${money(amt)} in operating cash.`); return; }
      g.cash -= amt;
      g.savings = (g.savings || 0) + amt;
      addLog(g, `🏦 Deposited ${money(amt)} into savings. Reserve: ${money(g.savings)}.`);
    });
  }, [update]);

  const handleSavingsWithdraw = useCallback((amount) => {
    update((g) => {
      const amt = Math.round(amount);
      if (!amt || amt <= 0) { Alert.alert("Invalid Amount", "Enter a positive amount."); return; }
      if ((g.savings || 0) < amt) { Alert.alert("Insufficient Reserve", `Only ${money(g.savings || 0)} in savings.`); return; }
      g.savings -= amt;
      g.cash += amt;
      addLog(g, `🏦 Withdrew ${money(amt)} from savings. Reserve: ${money(g.savings)}.`);
    });
  }, [update]);

  // R16-2: Early loan payoff handler
  const handlePayoffLoan = useCallback((loanId, payoffAmount) => {
    update((g) => {
      const loan = (g.loans || []).find(l => l.id === loanId);
      if (!loan) return;
      if (g.cash < payoffAmount) { Alert.alert("Insufficient Funds", `Need ${money(payoffAmount)} to pay off this loan early.`); return; }
      g.cash -= payoffAmount;
      g.expenses += payoffAmount;
      g.loans = g.loans.filter(l => l.id !== loanId);
      g.creditScore = Math.min(850, (g.creditScore || 600) + 5);
      addLog(g, `✅ "${loan.label}" paid off early. Credit +5.`);
    });
  }, [update]);

  const handleLoanPartialPayment = useCallback((loanId, amount) => {
    update((g) => {
      const loan = (g.loans || []).find(l => l.id === loanId);
      const amt = Math.round(amount);
      if (!loan || amt <= 0 || g.cash < amt) { Alert.alert("Insufficient Funds", `Need ${money(amt)} in cash.`); return; }
      const actualAmt = Math.min(amt, loan.remainingBalance);
      g.cash -= actualAmt;
      g.expenses += actualAmt;
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
      if ((g.creditScore || 600) < 680) { Alert.alert("Credit Too Low", "Need 680+ credit score to open a line of credit."); return; }
      if (g.creditLine) { Alert.alert("Already Active", "You already have an open line of credit."); return; }
      g.creditLine = { limit: CREDIT_LINE_LIMIT, drawn: 0, apr: CREDIT_LINE_APR, opened: g.day };
      g.creditScore = Math.max(300, (g.creditScore || 600) - 3);
      addLog(g, `💳 Business Line of Credit opened — up to ${money(CREDIT_LINE_LIMIT)} at ${CREDIT_LINE_APR}% APR on drawn amount.`);
    });
  }, [update]);

  const handleDrawCreditLine = useCallback((amount) => {
    update((g) => {
      if (!g.creditLine) return;
      const avail = (g.creditLine.limit || CREDIT_LINE_LIMIT) - (g.creditLine.drawn || 0);
      const amt = Math.min(Math.round(amount), avail);
      if (amt <= 0) { Alert.alert("No Credit Available", "Credit limit reached."); return; }
      g.creditLine.drawn = (g.creditLine.drawn || 0) + amt;
      g.cash += amt;
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
      if (g.creditLine.drawn <= 0) {
        g.creditLine.drawn = 0;
        addLog(g, `✅ Credit line fully repaid.`);
      } else {
        addLog(g, `💳 Repaid ${money(amt)}. Still drawn: ${money(g.creditLine.drawn)}.`);
      }
    });
  }, [update]);

  const handleUpgradeOffice = useCallback(() => {
    update((g) => {
      const next = OFFICES[g.officeIndex + 1];
      if (!next) { Alert.alert("Max Office", "You're at the top tier already."); return; }
      if (g.cash < next.cost) { Alert.alert("Insufficient Funds", `Need ${money(next.cost)}.`); return; }
      g.cash -= next.cost;
      g.expenses += next.cost;
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
        AsyncStorage.removeItem(BACKUP_STORAGE_KEY).catch(() => {});
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => {});
      }},
    ]);
  }, []);

  const handleOpenOffice = useCallback((cityId, officeTypeId) => {
    update((g) => {
      const city = CITIES.find(c => c.id === cityId);
      const def  = REGIONAL_OFFICE_TYPES.find(t => t.id === officeTypeId);
      if (!city || !def) return;
      if (g.reputation < city.unlockRep) { Alert.alert("Not Yet", `Need ${city.unlockRep}+ reputation to expand to ${city.name}.`); return; }
      if (g.cash < city.unlockCost + def.cost) { Alert.alert("Insufficient Funds", `Expanding to ${city.name} and opening a ${def.name} costs ${money(city.unlockCost + def.cost)}.`); return; }
      const alreadyInCity = (g.cityOffices||[]).some(o => o.cityId === cityId);
      const totalCost = def.cost + (alreadyInCity ? 0 : city.unlockCost);
      g.cash -= totalCost;
      g.expenses += totalCost;
      if (!g.cityOffices) g.cityOffices = [];
      g.cityOffices.push({ id: uid(), cityId, typeId: officeTypeId, name: `${def.name} — ${city.name}`, openedDay: g.day });
      addLog(g, `🏙️ Opened ${def.name} in ${city.name}, ${city.state}!`);
    });
  }, [update]);

  const handleBuyProperty = useCallback((typeId) => {
    update((g) => {
      const def = PROPERTY_TYPES.find(t => t.id === typeId);
      if (!def) return;
      if (g.cash < def.cost) { Alert.alert("Insufficient Funds", `${def.name} costs ${money(def.cost)}.`); return; }
      g.cash -= def.cost;
      g.expenses += def.cost;
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
      if (g.cash < def.hireCost) { Alert.alert("Insufficient Funds", `Hiring costs ${money(def.hireCost)}.`); return; }
      g.cash -= def.hireCost;
      g.expenses += def.hireCost;
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
    update((g) => {
      const w = g.crew.find((w) => w.id === workerId);
      const prog = TRAINING_PROGRAMS.find((p) => p.id === programId);
      if (!w || !prog) return;
      if (g.cash < prog.cost) { Alert.alert("Insufficient Funds", `Training costs ${money(prog.cost)}.`); return; }
      if (w.status === "Active") { Alert.alert("On Site", "Can't enroll a worker currently assigned to a site."); return; }
      const alreadyEnrolled = (g.trainingQueue || []).some((t) => t.workerId === workerId);
      if (alreadyEnrolled) { Alert.alert("Already Training", "This worker is already enrolled in a program."); return; }
      g.cash -= prog.cost;
      g.expenses += prog.cost;
      if (!g.trainingQueue) g.trainingQueue = [];
      g.trainingQueue.push({ id: uid(), workerId, programId, daysLeft: prog.duration });
      addLog(g, `📚 ${w.name} enrolled in "${prog.label}" — completes in ${prog.duration} days.`);
    });
  }, [update]);

  const handleAcquireRival = useCallback((rivalId) => {
    update((g) => {
      const rival = (g.rivals||[]).find(r => r.id === rivalId);
      if (!rival) return;
      const acquisitionCost = Math.max(50000, (rival.rep||0) * 3000 + (rival.cash||0) * 0.5);
      if (g.reputation < 50) { Alert.alert("Reputation Too Low", "Need 50+ reputation to acquire rivals."); return; }
      // Acquisition cooldown: 30-day gap between acquisitions
      if (g.day - (g.lastAcquisitionDay||0) < 30) { Alert.alert("Acquisition Cooldown", `Must wait ${30 - (g.day - (g.lastAcquisitionDay||0))} more day(s) before next acquisition.`); return; }
      if (g.cash < acquisitionCost) { Alert.alert("Insufficient Funds", `Acquiring ${rival.name} costs ${money(acquisitionCost)}.`); return; }
      g.cash -= acquisitionCost;
      g.expenses += acquisitionCost;
      g.cash += (rival.cash||0) * 0.7; // absorb 70% of rival cash
      g.revenue += (rival.cash||0) * 0.7;
      if (!g.acquiredRivals) g.acquiredRivals = [];
      g.acquiredRivals.push(rivalId);
      g.lastAcquisitionDay = g.day;
      g.reputation = Math.min(100, (g.reputation||0) + rand(3, 8));
      g.creditScore = Math.min(850, (g.creditScore||600) + rand(5, 15));
      // Remove rival from all site assignments when poached away
      for (const site of (g.activeSites||[])) {
        site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== rivalId);
      }
      // Add rival's crew as new crew members
      const newCrew = Math.min(3, rand(1, 3));
      for (let i = 0; i < newCrew; i++) g.crew.push(createWorker(pick(CREW_ROLES)));
      addLog(g, `🤝 Acquired ${rival.name}! Absorbed their assets and ${newCrew} workers.`);
      if ((g.acquiredRivals||[]).length === 1) {
        addImportantNotice(g, `🤝 First rival acquired! Your empire expands — ${rival.name} is now under your banner.`, "cyan");
      }
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
      g.properties = g.properties.filter(p => p.id !== propId);
      addLog(g, `💸 Sold ${def?.name||"property"} for ${money(salePrice)}.`);
    });
  }, [update]);

  const handleBuyEquipmentUpgrade = useCallback((equipId, upgradeId) => {
    update(g => {
      const eq = g.equipment.find(e => e.id === equipId);
      const upg = EQUIPMENT_UPGRADES.find(u => u.id === upgradeId);
      if (!eq || !upg) return;
      // You don't fit an engine overhaul to a machine you're hiring by the day.
      if (eq.isRental) { Alert.alert("Hired Machine", "You can't modify a machine you're renting."); return; }
      const currentTier = (eq.upgrades || {})[upgradeId] || 0;
      const nextTier = upg.tiers[currentTier];
      if (!nextTier || g.cash < nextTier.cost) return;
      g.cash -= nextTier.cost;
      g.expenses += nextTier.cost;
      if (!eq.upgrades) eq.upgrades = {};
      eq.upgrades[upgradeId] = currentTier + 1;
      addLog(g, `⚙️ ${eq.name}: ${upg.label} upgraded to Tier ${currentTier + 1} (${nextTier.effect})`);
    });
  }, [update]);

  const handleRepairEquipmentNew = useCallback((equipId, isEmergency) => {
    update((g) => {
      const _eq = (g.equipment || []).find(e => e.id === equipId);
      if (!_eq) return;
      const _baseCost = Math.round((_eq.price || 5000) * (isEmergency ? 0.4 : 0.2));
      if (g.cash < _baseCost) { addLog(g, `Not enough cash to repair ${_eq.name}.`); return; }
      g.cash -= _baseCost;
      g.expenses += _baseCost;
      _eq.condition = isEmergency ? 100 : Math.min(100, (_eq.condition || 0) + 60);
      // A workshop repair includes the service, so it resets the interval too.
      _eq.hoursAtLastService = _eq.engineHours || 0;
      _eq._serviceWarned = false;
      _eq.status = "Idle";
      if (g.pendingBreakdown?.equipId === equipId) g.pendingBreakdown = null;
      addLog(g, `🔧 ${_eq.name} repaired — condition ${Math.round(_eq.condition)}%`);
    });
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
      _w.wagePerDay = Math.max(WAGE_SCALE.MIN, _w.wagePerDay - _decrease);
      _w.loyalty = Math.max(0, (_w.loyalty ?? 0) - 15);
      _w.mood = Math.max(0, (_w.mood ?? 70) - 12);
      addLog(g, `🔴 ${_w.name} wage cut by ${money(_decrease)}/day — morale hit`);
    });
  }, [update]);

  const handleGiveBonus = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      const _bonus = _w.wagePerDay * 2;
      if (g.cash < _bonus) { addLog(g, "Not enough cash for bonus."); return; }
      g.cash -= _bonus;
      g.expenses += _bonus;
      _w.mood = Math.min(100, (_w.mood ?? 70) + 20);
      _w.loyalty = Math.min(100, (_w.loyalty ?? 0) + 12);
      addLog(g, `🎁 ${_w.name} received a ${money(_bonus)} bonus — morale +20`);
    });
  }, [update]);

  const handleRestWorker = useCallback((workerId) => {
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      (g.activeSites||[]).forEach(site => {
        site.assignedCrewIds = (site.assignedCrewIds||[]).filter(id => id !== workerId);
      });
      _w.status = "Resting";
      _w.restUntilStamina = 80;
      addLog(g, `💤 ${_w.name} is resting — will return when stamina reaches 80%.`);
    });
  }, [update]);

  const handleRestAllTired = useCallback(() => {
    update((g) => {
      let count = 0;
      (g.crew||[]).forEach(_w => {
        if ((_w.stamina ?? 100) < 40 && _w.status !== "Resting") {
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
    update((g) => {
      const _w = (g.crew||[]).find(w => w.id === workerId);
      if (!_w) return;
      if ((g.cash||0) < 25) { addLog(g, "Not enough cash for lunch."); return; }
      if (_w.lastLunchDay === g.day) { addLog(g, `${_w.name} already had lunch today.`); return; }
      g.cash -= 25;
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
      _s.status = "Paused";
      _s.pausedDays = 999;
      addLog(g, `⏸ ${_s.label} paused.`);
    });
  }, [update]);

  const handleResumeSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s) return;
      _s.status = "Active";
      _s.pausedDays = 0;
      addLog(g, `▶️ ${_s.label} resumed.`);
    });
  }, [update]);

  const handleAbandonSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s) return;
      const _def = CONTRACT_DEFS.find(c => c.id === (g.contracts||[]).find(cc => cc.id === _s.contractId)?.defId);
      const _fee = Math.round((_def?.baseValue || 10000) * 0.15);
      const _repLoss = Math.max(2, (_def?.tier||_def?.minTier||1) * 2);
      g.cash = Math.max(-50000, (g.cash||0) - _fee);
      g.expenses = (g.expenses||0) + _fee;
      g.reputation = Math.max(0, (g.reputation||0) - _repLoss);
      (_s.assignedCrewIds||[]).forEach(cid => { const _w=(g.crew||[]).find(w=>w.id===cid); if(_w){_w.status="Idle"; _w.assignedSiteId=null;} });
      (_s.assignedEquipmentIds||[]).forEach(eid => { const _e=(g.equipment||[]).find(e=>e.id===eid); if(_e){_e.assignedSiteId=null;_e.status="Idle";} });
      g.activeSites = (g.activeSites||[]).filter(s => s.id !== siteId);
      addLog(g, `🚫 Abandoned ${_s.label} — ${money(_fee)} fee, rep -${_repLoss}.`);
      addImportantNotice(g, `🚫 Abandoned "${_s.label}" — ${money(_fee)} fee, reputation -${_repLoss}. Win more contracts to recover.`, "red");
    });
  }, [update]);

  const handleSettleSite = useCallback((siteId) => {
    update((g) => {
      const _s = (g.activeSites||[]).find(s => s.id === siteId);
      if (!_s) return;
      const _def = CONTRACT_DEFS.find(c => c.id === (g.contracts||[]).find(cc => cc.id === _s.contractId)?.defId);
      const _prog = Math.min(1, (((_s.currentPhaseIdx||0) / Math.max(1, (_s.phases||[]).length)) + ((_s.phaseProgress||0)/100/Math.max(1,(_s.phases||[]).length))));
      const _partial = Math.round((_s.totalValue || _def?.baseValue || 10000) * Math.max(0.2, _prog) * 0.6);
      const _repLoss = Math.max(1, Math.round((_def?.minTier||1) * 1.5));
      g.cash = (g.cash||0) + _partial;
      g.revenue = (g.revenue||0) + _partial;
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
      if ((g.cash||0) < _cost) { addLog(g, `Need ${money(_cost)} to renegotiate.`); Alert.alert("Insufficient Funds", `Renegotiating costs ${money(_cost)}. You have ${money(g.cash||0)}.`); return; }
      g.cash -= _cost;
      g.expenses = (g.expenses||0) + _cost;
      g.reputation = Math.max(0, (g.reputation||0) - 2);
      _s.deadlineDay = (g.day||0) + Math.max(7, Math.round((_def?.durationDays||14)*0.4));
      _s.renegotiated = true;
      addLog(g, `📅 ${_s.label} deadline extended — ${money(_cost)}, rep -2.`);
    });
  }, [update]);

  const handleAssignCrewToSite = useCallback((workerId, siteId) => {
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
    update((g) => {
      const eq = (g.equipment||[]).find(e => e.id === equipId);
      if (!eq || eq.status === "Maintenance") return;
      (g.activeSites||[]).forEach(s => { s.assignedEquipmentIds = (s.assignedEquipmentIds||[]).filter(id => id !== equipId); });
      eq.status = "Maintenance";
      eq.assignedSiteId = null;
      eq.hoursAtLastService = eq.engineHours || 0;
      eq._serviceWarned = false;
      repairCrewAssignments(g);
      addLog(g, `🔧 ${eq.name} pulled for scheduled maintenance at ${Math.round(eq.engineHours || 0)} hours — service clock reset.`);
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
        <Text style={{ color: THEMES.dark.text, fontSize: 18 }}>Loading ConstructionFlow…</Text>
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
            <Text style={{ color: T.sub, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 10 }}>FINAL STATS</Text>
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
  const nextBest = getNextBestAction(game);
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
          <Text style={{ color: T.text, fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 4 }}>ConstructionFlow</Text>
          <Text style={{ color: T.sub, fontSize: 14, textAlign: "center", marginBottom: 32 }}>Build a construction empire from the ground up.</Text>

          {/* If we are here because a save could not be read, say so. The loader writes an
              importantNotice explaining it, but the setup screen renders before the main UI
              that normally displays notices — so without this the player whose save was lost
              is dropped into "Name Your Company" with no explanation at all, which is the one
              scenario the backup/recovery path exists to handle gracefully. */}
          {game?.importantNotice?.message && (
            <View style={{ backgroundColor: T.panel2, borderColor: T.red, borderWidth: 1.5, borderRadius: 12, padding: 14, marginBottom: 24 }}>
              <Text style={{ color: T.red, fontWeight: "800", fontSize: 13, marginBottom: 4 }}>Previous save</Text>
              <Text style={{ color: T.text, fontSize: 13, lineHeight: 19 }}>{game.importantNotice.message}</Text>
            </View>
          )}

          {/* Step indicator */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 }}>
            {[0,1,2].map(s => (
              <View key={s} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: setupStep >= s ? T.green : T.border }} />
            ))}
          </View>

          {setupStep === 0 ? (
            /* Step 1 — Company name */
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.green, borderWidth: 2 }]}>
              <Text style={[styles.label, col, { marginBottom: 4 }]}>Step 1 — Name Your Company</Text>
              <Text style={[styles.sub, subCol, { marginBottom: 12 }]}>This will appear on your Home screen, bids, and company profile.</Text>
              <TextInput
                style={[styles.input, { color: T.text, borderColor: T.strongBorder, backgroundColor: T.panel2, marginBottom: 12 }]}
                value={setupName}
                onChangeText={setSetupName}
                placeholder="e.g. Apex Build Co."
                placeholderTextColor={T.sub}
                maxLength={36}
                autoFocus
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
                      g.companyName = setupName.trim() || "New Build Co.";
                      g.startingCityId = templateCityId;
                      g.homeCityName = setupHomeCityText.trim();
                      g.homeStateCode = setupHomeStateCode;
                      g.homeStateName = setupHomeStateName;
                      g.homeCompetition = setupCompetition;
                      g.setupDone = true;
                      addLog(g, `🏗️ Welcome to ${g.companyName}! Based in ${g.homeCityName}, ${g.homeStateCode}. Let's build.`);
                    });
                  }}
                >
                  <Text style={[styles.btnText, { color: setupHomeCityText.trim() ? "#000" : T.sub }]}>🚀 Start Building</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={{ color: T.sub, fontSize: 11, textAlign: "center", marginTop: 24 }}>
            {`You start with ${money(STARTING_CASH)} · 1 truck · 3 crew members`}
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>

        {/* Low cash warning */}
        {(() => {
          const dailyBurn = (game.crew||[]).reduce((s,w)=>s+(w.wagePerDay||0),0) +
            (game.equipment||[]).reduce((s,e)=>s+getEquipmentDailyCost(e),0) +
            (OFFICES[game.officeIndex||0]?.dailyRent||0);
          const daysLeft = dailyBurn > 0 ? Math.floor(game.cash / dailyBurn) : 999;
          if (daysLeft < 5 && game.cash >= 0) return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.red, borderWidth: 2, borderLeftWidth: 5, marginBottom: 10 }]}>
              <Text style={[styles.label, { color: T.red, marginBottom: 4 }]}>⚠️ Cash Running Low</Text>
              <Text style={[styles.sub, col]}>~{daysLeft} day{daysLeft !== 1 ? "s" : ""} of runway left at {money(dailyBurn)}/day overhead. Complete a job or take out a loan in Finance before you run out.</Text>
            </View>
          );
          return null;
        })()}

        {/* Crew burnout warning */}
        {burningOutCrew.length > 0 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1.5, marginBottom: 8 }]}>
            <Text style={[styles.label, { color: T.orange, marginBottom: 6 }]}>⚠️ Crew Burning Out ({burningOutCrew.length})</Text>
            {burningOutCrew.slice(0, 3).map(w => (
              <View key={w.id} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.sub, col]}>{w.name}</Text>
                  <Text style={[styles.sub, { color: T.red }]}>Stamina {Math.round(w.stamina ?? 0)}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: T.track }]}>
                  <View style={[styles.progressFill, { width: `${Math.round(w.stamina ?? 0)}%`, backgroundColor: T.red }]} />
                </View>
              </View>
            ))}
            <Text style={[styles.sub, { color: T.sub, fontSize: 10, fontStyle: "italic", marginTop: 2 }]}>Low stamina slows site progress — remove from sites to recover.</Text>
          </View>
        )}

        {/* Important notice — persists until tapped */}
        {game.importantNotice && (() => {
          const noticeColors = { green: T.green, orange: T.orange, red: T.red, neutral: T.sub };
          const borderCol = noticeColors[game.importantNotice.tone] || T.cyan;
          return (
            <TouchableOpacity
              onPress={() => update(g => { g.importantNotice = null; })}
              style={[styles.card, { backgroundColor: T.panel, borderColor: borderCol, borderWidth: 2, borderLeftWidth: 5, marginBottom: 10 }]}
            >
              <Text style={[styles.label, { color: borderCol, marginBottom: 3 }]}>📣 Update</Text>
              <Text style={[styles.sub, col]}>{game.importantNotice.message}</Text>
              <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginTop: 4, fontStyle: "italic" }]}>Tap to dismiss</Text>
            </TouchableOpacity>
          );
        })()}

        {/* ── Company Health Score ─────────────────────────────────────────── */}
        {game.tutorialDone && (() => {
          const hs = computeHealthScore(game);
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T[hs.colorKey], borderWidth: 1.5 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={[styles.label, col]}>📊 Company Health</Text>
                <View style={{ backgroundColor: T[hs.colorKey]+"33", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ color: T[hs.colorKey], fontWeight: "700", fontSize: 13 }}>{hs.label}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 30, fontWeight: "900", color: T[hs.colorKey], marginRight: 10 }}>{hs.score}</Text>
                <View style={{ flex: 1 }}>
                  <View style={[styles.progressTrack, { backgroundColor: T.track }]}>
                    <View style={[styles.progressFill, { width: `${hs.score}%`, backgroundColor: T[hs.colorKey] }]} />
                  </View>
                </View>
              </View>
              {hs.factors.map((f, i) => <Text key={i} style={[styles.sub, { color: T.sub, fontSize: 11 }]}>• {f}</Text>)}
              <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginTop: 6, fontStyle: "italic" }]}>Safety recovers +0.5/day toward 70. Incidents, corner cuts, and violations lower it.</Text>
            </View>
          );
        })()}

        {/* ── Predictive Warnings ──────────────────────────────────────────── */}
        {game.tutorialDone && (() => {
          const warnings = getPredictiveWarnings(game);
          if (!warnings.length) return null;
          const sevColors = { high: T.red, medium: T.orange, low: T.sub };
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1 }]}>
              <Text style={[styles.label, col, { marginBottom: 8 }]}>⚡ Early Warnings</Text>
              {warnings.map((w, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sevColors[w.severity]||T.sub, marginRight: 8 }} />
                  <Text style={[styles.sub, { color: T.text, flex: 1, fontSize: 12 }]}>{w.text}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {/* ── Next Best Action ─────────────────────────────────────────────── */}
        {(() => {
          const nba = getNextBestAction(game);
          const _isCritical = ["red", "orange"].includes(nba.tone);
          if (!game.tutorialDone && !_isCritical) return null;
          if (nba.tab === "Home") return null;
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1.5 }]}>
              <Text style={[styles.label, col, { marginBottom: 4 }]}>🎯 Next Best Action</Text>
              <Text style={[styles.sub, col, { fontWeight: "600", marginBottom: 4 }]}>{nba.title}</Text>
              <Text style={[styles.sub, { color: T.sub, marginBottom: 10 }]}>{nba.body}</Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: T.cyan, borderColor: T.cyan }]} onPress={() => setTab(nba.tab)}>
                <Text style={[styles.btnText, { color: "#fff" }]}>Go to {nba.tab} →</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── On-Time Streak ───────────────────────────────────────────────── */}
        {((game.onTimeStreak||0) >= 1 || (game.bestStreak||0) >= 3) && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.orange, borderWidth: 1.5 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.label, col]}>🔥 On-Time Streak</Text>
              <View style={{ backgroundColor: T.orange+"33", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ color: T.orange, fontWeight: "700", fontSize: 13 }}>{game.onTimeStreak||0} in a row</Text>
              </View>
            </View>
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
          </View>
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
                    <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{s.label}</Text>
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

        {/* ── Client Relationships ─────────────────────────────────────────── */}
        {game.tutorialDone && (() => {
          const rels = game.clientRelationships || {};
          const activeClients = CLIENT_ROSTER.filter(c => rels[c.id]?.jobsDone > 0);
          if (activeClients.length === 0) return null;
          return (
            <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
              <Text style={[styles.sectionTitle, col]}>🤝 Client Relationships</Text>
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
                        <Text style={[styles.sub, { color: tierColor, fontSize: 10, fontWeight: "700" }]}>{tier.label}</Text>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{rel.jobsDone} job{rel.jobsDone!==1?"s":""}</Text>
                      </View>
                    </View>
                    <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                      <View style={{ height: 4, width: `${pct}%`, backgroundColor: tierColor, borderRadius: 2 }} />
                    </View>
                    {tier.valueMult > 1 && (
                      <Text style={[styles.sub, { color: T.green, fontSize: 10, marginTop: 2 }]}>✓ {Math.round((tier.valueMult-1)*100)}% value bonus · +{tier.extraDays}d deadline on their contracts</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* Tutorial — step-by-step, auto-advances with game state */}
        {!game.tutorialDone && (() => {
          const hasActiveSite  = (game.activeSites||[]).length > 0;
          const hasLostABid    = (game.bidsLost || 0) > 0 && (game.bidsWon || 0) === 0;
          const needsMaterials = hasActiveSite && (game.activeSites||[]).some(s => {
            const con = (game.contracts||[]).find(c => c.id === s.contractId);
            const def = CONTRACT_DEFS.find(d => d.id === con?.defId);
            return def?.materials && Object.entries(def.materials).some(([id,qty]) => ((s.materialsFulfilled||{})[id]||0) < qty);
          });

          // Determine current step. Losing the opening bid is a normal outcome now, so it
          // gets its own step rather than leaving the player staring at "submit your first
          // bid" wondering why nothing happened.
          let step = 0;
          if (hasActiveSite && !needsMaterials)      step = 3;
          else if (hasActiveSite && needsMaterials)  step = 2;
          else if (hasLostABid)                      step = 1;

          const dailyBurn = (game.crew||[]).reduce((s,w)=>s+(w.wagePerDay||0),0)
            + game.equipment.reduce((s,e)=>s+getEquipmentDailyCost(e),0)
            + (OFFICES[game.officeIndex||0]?.dailyRent || 0);

          const steps = [
            {
              num: "1 of 4", title: "Win Your First Bid",
              body: `You have ${money(game.cash)}, one truck, ${(game.crew||[]).length} crew and 20 lumber in stock — about ${Math.max(1, Math.round(game.cash / Math.max(1, dailyBurn)))} days of overhead.\n\nGo to Bids → open Fence Installation (your lumber already covers it). Pick your crew and truck, choose a bid strategy, then Submit Bid.\n\nYou are bidding against other contractors, so you can lose. The screen shows your odds before you commit — bid Aggressive to win more often for less money.`,
              cta: "Go to Bids →", action: () => setTab("Bids"),
            },
            {
              num: "1 of 4", title: "Someone Outbid You",
              body: `That is normal — you are competing for work, not claiming it.\n\nEvery bid costs a small estimating fee whether you win or lose, so bid where you are strong. Your odds go up with reputation, spare crew and machines, and an Estimator on staff.\n\nGo back to Bids and try again — a lower (Aggressive) bid wins far more often.`,
              cta: "Back to Bids →", action: () => setTab("Bids"),
            },
            {
              num: "2 of 4", title: "Get Materials On Site",
              body: `You won the job — the client has paid a mobilisation draw.\n\nWork will not start until the materials are on site. Go to Sites, open the job and tap Buy Materials.\n\nYour overhead runs at ${money(dailyBurn)}/day while you sort it out, so do not leave a site waiting.`,
              cta: "Go to Sites →", action: () => setTab("Sites"),
            },
            {
              num: "3 of 4", title: "You Get Paid As You Build",
              body: `Your crew are working. Each phase you finish is certified and paid — you do not wait until the end.\n\nA small percentage of every payment is held back as retainage and released about two weeks after handover, so the last slice arrives late. Watch for it in Finance.\n\nKeep an eye on diesel, machine service hours and crew stamina — a job that runs out of any of them stops.`,
              cta: "Go to Sites →", action: () => setTab("Sites"),
            },
          ];

          const s = steps[step];
          return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.cyan, borderWidth: 2, borderLeftWidth: 5 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={[styles.label, { color: T.cyan }]}>🚀 Getting Started</Text>
                <Text style={{ color: T.sub, fontSize: 11 }}>Step {s.num}</Text>
              </View>
              <Text style={[styles.label, col, { marginBottom: 6 }]}>{s.title}</Text>
              <Text style={[styles.sub, col, { lineHeight: 20, marginBottom: 10 }]}>{s.body}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: T.cyan, borderColor: T.cyan }]} onPress={s.action}>
                  <Text style={[styles.btnText, { color: "#000" }]}>{s.cta}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: T.panel3 || T.panel, borderColor: T.border }]} onPress={() => update(g => { g.tutorialDone = true; addImportantNotice(g, "Tutorial skipped. Bids to win work, Sites to run it, Crew and Vehicles to keep it moving, Finance for money.", "green"); })}>
                  <Text style={[styles.btnText, subCol]}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Company Level */}
        <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.strongBorder, borderLeftWidth: 4, borderLeftColor: T.cyan }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={[{ fontSize: 11, color: T.cyan, fontWeight: "700", marginBottom: 2 }]}>LEVEL {companyLevel.level}</Text>
              <Text style={[styles.label, col]}>{companyLevel.label}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {nextLevel && <Text style={[styles.sub, { color: T.sub }]}>Next: {nextLevel.label}</Text>}
              {!nextLevel && <Text style={[styles.sub, { color: T.yellow }]}>MAX LEVEL</Text>}
            </View>
          </View>
          {nextLevel && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {[
                { label: "Rep",   current: game.reputation || 0,    target: nextLevel.repMin,  color: T.purple, fmt: v => `${v}` },
                { label: "Jobs",  current: game.completedJobs || 0, target: nextLevel.jobsMin, color: T.orange, fmt: v => `${v}` },
                { label: "Value", current: valuation,               target: nextLevel.valMin,  color: T.cyan,   fmt: v => money(v) },
              ].map(bar => {
                const pct = Math.min(100, Math.round((bar.current / Math.max(1, bar.target)) * 100));
                const done = bar.current >= bar.target;
                return (
                  <View key={bar.label} style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.sub, { color: done ? T.green : T.sub, fontSize: 10 }]}>{done ? "✓ " : ""}{bar.label}</Text>
                      <Text style={[styles.sub, { color: done ? T.green : bar.color, fontSize: 10 }]}>
                        {bar.fmt(bar.current)} / {bar.fmt(bar.target)}
                      </Text>
                    </View>
                    <View style={{ height: 3, backgroundColor: T.track, borderRadius: 2, marginTop: 2 }}>
                      <View style={{ height: 3, width: `${pct}%`, backgroundColor: done ? T.green : bar.color, borderRadius: 2 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Company Header */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.h2, col]} numberOfLines={1}>{game.companyName}</Text>
                {(game.generation||1) > 1 && (
                  <Text style={{ fontSize: 10, color: T.yellow, fontWeight: "700", borderWidth: 1, borderColor: T.yellow, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>GEN {game.generation}</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.sub, subCol]}>{repTier.badge} {repTier.label} · Day {game.day}</Text>
                  {game.seasonEmoji && (
                    <Text style={[styles.sub, { color: T.sub, fontSize: 11 }]}>{game.seasonEmoji} {game.currentSeason}</Text>
                  )}
                  {(game.savings || 0) > 0 && (
                    <Text style={[styles.sub, { color: T.cyan, fontSize: 10 }]}>🏦 {money(game.savings)} saved</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: speedMode ? T.yellow + "33" : T.panel2, borderWidth: 1, borderColor: speedMode ? T.yellow : T.border, marginLeft: 8 }}
                  onPress={() => setSpeedMode(s => !s)}
                >
                  <Text style={{ fontSize: 11, color: speedMode ? T.yellow : T.sub, fontWeight: speedMode ? "700" : "400" }}>
                    {speedMode ? "⚡ 2×" : "1×"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", minWidth: 0 }}>
              <Text style={[styles.cashBig, { color: game.cash >= 0 ? T.green : T.red }]} numberOfLines={1}>{money(game.cash)}</Text>
              <Text style={[styles.sub, subCol]} numberOfLines={1}>{office.name}</Text>
              <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginTop: 1 }]} numberOfLines={1}>📍 {displayCityName}, {displayStateCode}</Text>
            </View>
          </View>
        </View>

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

        {/* Next Best Action */}
        {nextBest && (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: T.panel2, borderColor: T[nextBest.tone] || T.border, borderLeftWidth: 4 }]}
            onPress={() => setTab(nextBest.tab || tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, { color: T[nextBest.tone] || T.text }]}>{nextBest.title}</Text>
            <Text style={[styles.body, col]}>{nextBest.body}</Text>
            {nextBest.tab && <Text style={[styles.sub, { color: T[nextBest.tone] }]}>→ Go to {nextBest.tab}</Text>}
          </TouchableOpacity>
        )}

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
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Next:</Text>
                  <Ionicons name={nextTier.icon} size={10} color={T.sub} />
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{nextTier.label} at {nextTier.min} pts</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* KPI Row */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Active Sites", val: activeSites.length, color: T.orange },
            { label: "Crew Idle", val: idleCrew.length, color: T.cyan },
            { label: "Jobs Done", val: game.completedJobs, color: T.green },
            { label: "Reputation", val: `${game.reputation}`, color: T.purple },
          ].map((k) => (
            <View key={k.label} style={[styles.kpi, { backgroundColor: T.panel, borderColor: T.border, flex: 1 }]}>
              <Text style={[styles.kpiVal, { color: k.color }]}>{k.val}</Text>
              <Text style={[styles.kpiLabel, subCol]}>{k.label}</Text>
            </View>
          ))}
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
                <Text style={[styles.sub, { color: T[evt.tone] || T.sub, marginTop: 2, fontSize: 10 }]}>
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
                  {/* Billing: how much of this job has actually been paid, and what is held back */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[styles.sub, subCol]}>
                      {`Billed ${money(site.billedToDate || 0)} of ${money(site.totalValue || 0)}`}
                    </Text>
                    {(site.retainageHeld || 0) > 0 && (
                      <Text style={[styles.sub, { color: T.yellow }]}>{`🔒 ${money(site.retainageHeld)} retained`}</Text>
                    )}
                  </View>
                  {(site.changeOrders || []).length > 0 && (
                    <Text style={[styles.sub, { color: T.cyan }]}>
                      {`📝 ${site.changeOrders.length} change order${site.changeOrders.length === 1 ? "" : "s"} · +${money(site.changeOrders.reduce((sum, co) => sum + (co.valueAdd || 0), 0))}`}
                    </Text>
                  )}
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
              {game.hotMaterialDeal.label} — {game.hotMaterialDeal.discountPct}% off · {money(game.hotMaterialDeal.unitPrice)}/unit
            </Text>
            <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>
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
                const statusLabel = r.status === "Bankrupt" ? "Bankrupt" : (r.cash||0) < 5000 ? "Struggling" : "Active";
                const statusColor = r.status === "Bankrupt" ? T.sub : (r.cash||0) < 5000 ? T.orange : T.green;
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
                    <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 1 }]}>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>

        {/* Active Site Management */}
        {activeSites.length === 0 && (
          <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", paddingVertical: 24 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏗️</Text>
            <Text style={[styles.label, { color: T.sub, textAlign: "center", marginBottom: 4 }]}>No active sites</Text>
            <Text style={[styles.sub, subCol, { textAlign: "center", marginBottom: 12 }]}>Accept a contract from the Bids tab to get started.</Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: T.orange, borderColor: T.orange }]}
              onPress={() => setTab("Bids")}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>Go to Bids</Text>
            </TouchableOpacity>
          </View>
        )}
        {activeSites.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, col, { marginBottom: 8 }]}>Active Sites ({activeSites.length})</Text>
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
              const projectedProfit = Math.max(0, site.totalValue - daysLate * site.penaltyPerDay);
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
                <View key={site.id} style={[styles.card, { backgroundColor: T.panel, borderColor: hasMissingMats ? T.orange : isOverdue ? T.red : T.border, borderWidth: (hasMissingMats || isOverdue) ? 2 : 1, marginBottom: 10 }]}>
                  {/* Header */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.label, col]} numberOfLines={1}>{site.label}</Text>
                      <Text style={[styles.sub, subCol]} numberOfLines={1}>{site.client}</Text>
                      {contract?.cityId && (() => {
                        const siteCity = CITIES.find(c => c.id === contract.cityId);
                        if (!siteCity) return null;
                        const _region = siteCity.region;
                        const _weatherRisk = _region === "Pacific Northwest" ? "🌧️ Rain risk region"
                          : _region === "Southwest" ? "☀️ Heat risk region"
                          : _region === "Mountain" ? "❄️ Snow risk region"
                          : _region === "South Central" ? "⛈️ Storm risk region"
                          : null;
                        return (
                          <>
                            <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>📍 {siteCity.name}</Text>
                            {_weatherRisk && !site.currentWeather && (
                              <Text style={[styles.sub, { color: T.sub, fontSize: 9 }]}>{_weatherRisk}</Text>
                            )}
                          </>
                        );
                      })()}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.sub, { color: site.status === "Paused" ? T.orange : isOverdue ? T.red : T.green, fontWeight: "700" }]}>
                        {site.status === "Paused" ? "⏸ Paused" : isOverdue ? `⚠ ${daysLate}d Late` : `${Math.round(overallPct)}%`}
                      </Text>
                      <Text style={[styles.sub, { color: isOverdue ? T.red : T.sub }]}>Due Day {site.deadlineDay}</Text>
                    </View>
                  </View>

                  {/* Overall progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: T.track, marginBottom: 4 }]}>
                    <View style={[styles.progressFill, { width: `${overallPct}%`, backgroundColor: isOverdue ? T.red : T.orange }]} />
                  </View>

                  {/* Deadline urgency bar */}
                  {!isOverdue && site.status !== "Paused" && (() => {
                    const daysLeft = site.deadlineDay - game.day;
                    const barColor = daysLeft <= 2 ? T.red : daysLeft <= 5 ? T.orange : T.green;
                    const pct = Math.min(100, Math.round((daysLeft / 14) * 100));
                    return (
                      <View style={{ marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Deadline</Text>
                          <Text style={[styles.sub, { color: barColor, fontSize: 10, fontWeight: daysLeft <= 5 ? "700" : "400" }]}>
                            {daysLeft <= 0 ? "Due today" : `${daysLeft}d left`}
                          </Text>
                        </View>
                        <View style={{ height: 3, backgroundColor: T.track, borderRadius: 2 }}>
                          <View style={{ height: 3, width: `${pct}%`, backgroundColor: barColor, borderRadius: 2 }} />
                        </View>
                      </View>
                    );
                  })()}

                  {/* Current phase + phase progress */}
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>{vis.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={[styles.sub, { color: T.cyan, fontWeight: "600", fontSize: 11 }]}>{currentPh}</Text>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Phase {(site.currentPhaseIdx || 0) + 1}/{site.phases.length}</Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: T.track, height: 4, marginTop: 3 }]}>
                        <View style={[styles.progressFill, { width: `${Math.max(0, site.phaseProgress || 0)}%`, backgroundColor: T.cyan, height: 4 }]} />
                      </View>
                      {(() => {
                        const _rate = site._progressRate;
                        if (!_rate || overallPct >= 100 || site.status === "Paused") return null;
                        const _phasesLeft = (site.phases.length || 1) - (site.currentPhaseIdx || 0);
                        const _progressLeft = 100 * _phasesLeft - (site.phaseProgress || 0);
                        const _pctPerDay = _rate * 48;
                        const _daysLeft = _pctPerDay > 0 ? Math.ceil(_progressLeft / _pctPerDay) : null;
                        return (
                          <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginTop: 3 }]}>
                            {_daysLeft ? `~${_daysLeft} days remaining` : ""}{_daysLeft ? " · " : ""}{_pctPerDay.toFixed(1)}%/day
                          </Text>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Specialty mismatch + rush quality warnings */}
                  {(() => {
                    const sitePh = site.phases[site.currentPhaseIdx] || "";
                    const specialtyMap = SPECIALTY_PHASE_BONUS;
                    const crewHasMatch = siteCrew.some(w => (specialtyMap[w.specialty || ""] || {})[sitePh] > 1.0);
                    const phaseTypeMatch = sitePh && (PHASE_TYPE_BONUS[sitePh] || {});
                    const equipHasMatch = siteEquip.some(e => (phaseTypeMatch[e.type] || 1.0) > 1.0);
                    const showMismatch = sitePh && siteCrew.length > 0 && !crewHasMatch && !equipHasMatch;
                    const rushPenalty = site.rushQualityPenalty || 0;
                    return (
                      <>
                        {showMismatch && (() => {
                          const neededSpec = Object.entries(SPECIALTY_PHASE_BONUS).find(([, phases]) =>
                            Object.entries(phases).some(([p, v]) => v > 1.0 && sitePh.toLowerCase().includes(p.toLowerCase()))
                          )?.[0] || "matching";
                          return (
                            <Text style={[styles.sub, { color: T.orange, fontSize: 10, marginBottom: 4 }]}>
                              ⚠ {sitePh} needs a {neededSpec} specialist · −10% speed without one
                            </Text>
                          );
                        })()}
                        {rushPenalty > 0.04 && (
                          <Text style={[styles.sub, { color: T.orange, fontSize: 10, marginBottom: 4 }]}>
                            ⚡ Rush impact: quality −{Math.round(rushPenalty * 100)}%
                          </Text>
                        )}
                      </>
                    );
                  })()}

                  {/* Crew assignment */}
                  {(() => {
                    const idleCrew = game.crew.filter(w => w.status === "Idle");
                    return (
                      <View style={{ backgroundColor: T.panel2, borderRadius: 6, padding: 8, marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={[styles.sub, { color: T.sub, fontSize: 10, fontWeight: "700" }]}>CREW ({siteCrew.length})</Text>
                          {siteCrew.length === 0 && <Text style={[styles.sub, { color: T.red, fontSize: 10 }]}>⚠ No crew</Text>}
                        </View>
                        {(() => {
                          const _exhausted = siteCrew.filter(w => (w.stamina ?? 50) < 25 || (w.mood ?? 70) < 20);
                          return _exhausted.length > 0 ? (
                            <Text style={[styles.sub, { color: T.orange, fontSize: 10, marginBottom: 3 }]}>
                              ⚠ {_exhausted.length} worker{_exhausted.length > 1 ? "s" : ""} exhausted — rest them in Crew tab.
                            </Text>
                          ) : null;
                        })()}
                        {siteCrew.map(w => (
                          <View key={w.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <Text style={[styles.sub, { fontSize: 10, color: T.text, flex: 1 }]}>{w.name.split(" ")[0]} · {w.specialty || w.role}</Text>
                            <TouchableOpacity
                              style={{ backgroundColor: T.red + "33", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.red }}
                              onPress={() => handleUnassignCrewFromSite(w.id, site.id)}
                            >
                              <Text style={{ fontSize: 9, color: T.red, fontWeight: "700" }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        {idleCrew.length > 0 && (
                          <>
                            <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 4, marginBottom: 2 }]}>Idle workers:</Text>
                            {idleCrew.slice(0, 4).map(w => (
                              <TouchableOpacity
                                key={w.id}
                                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: T.green + "18", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2, borderWidth: 1, borderColor: T.green + "55" }}
                                onPress={() => handleAssignCrewToSite(w.id, site.id)}
                              >
                                <Text style={{ fontSize: 10, color: T.text }}>{w.name.split(" ")[0]} · {w.role}</Text>
                                <Text style={{ fontSize: 9, color: T.green, fontWeight: "700" }}>+ Assign</Text>
                              </TouchableOpacity>
                            ))}
                            {idleCrew.length > 4 && (
                              <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 2, fontStyle: "italic" }]}>+{idleCrew.length - 4} more in Crew tab</Text>
                            )}
                          </>
                        )}
                        {idleCrew.length === 0 && siteCrew.length === 0 && (
                          <Text style={[styles.sub, { color: T.sub, fontSize: 9, fontStyle: "italic" }]}>No idle workers available</Text>
                        )}
                      </View>
                    );
                  })()}

                  {/* Equipment assignment */}
                  {(() => {
                    const idleEquip = game.equipment.filter(e => e.status === "Idle" && !e.assignedSiteId);
                    const brokenOnSite = siteEquip.filter(e => e.status === "Maintenance" || e.condition < 30);
                    return (
                      <View style={{ backgroundColor: T.panel2, borderRadius: 6, padding: 8, marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={[styles.sub, { color: T.sub, fontSize: 10, fontWeight: "700" }]}>EQUIPMENT ({siteEquip.length})</Text>
                        </View>
                        {siteEquip.map(e => (
                          <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                            <Text style={[styles.sub, { fontSize: 10, color: e.condition < 30 ? T.red : T.text, flex: 1 }]} numberOfLines={1}>{e.name} {e.condition < 30 ? "⚠" : ""}</Text>
                            <View style={{ flexDirection: "row", gap: 4 }}>
                              {(e.condition < 80 || e.status === "Maintenance") && (
                                <TouchableOpacity
                                  style={{ backgroundColor: T.blue + "33", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: T.blue }}
                                  onPress={() => handleRepairEquipmentNew(e.id, e.status === "Maintenance")}
                                >
                                  <Text style={{ fontSize: 9, color: T.blue, fontWeight: "700" }}>Repair</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={{ backgroundColor: T.red + "33", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: T.red }}
                                onPress={() => handleUnassignEquipFromSite(e.id, site.id)}
                              >
                                <Text style={{ fontSize: 9, color: T.red, fontWeight: "700" }}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                        {idleEquip.length > 0 && (
                          <>
                            <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 4, marginBottom: 2 }]}>Available equipment:</Text>
                            {idleEquip.slice(0, 3).map(e => (
                              <TouchableOpacity
                                key={e.id}
                                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: T.cyan + "18", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, marginBottom: 2, borderWidth: 1, borderColor: T.cyan + "55" }}
                                onPress={() => handleAssignEquipToSite(e.id, site.id)}
                              >
                                <Text style={{ fontSize: 10, color: T.text }}>{e.name}</Text>
                                <Text style={{ fontSize: 9, color: T.cyan, fontWeight: "700" }}>+ Assign</Text>
                              </TouchableOpacity>
                            ))}
                            {idleEquip.length > 3 && (
                              <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 2, fontStyle: "italic" }]}>+{idleEquip.length - 3} more in Vehicles tab</Text>
                            )}
                          </>
                        )}
                        {siteEquip.length === 0 && idleEquip.length === 0 && (
                          <Text style={[styles.sub, { color: T.sub, fontSize: 9, fontStyle: "italic" }]}>No equipment available</Text>
                        )}
                      </View>
                    );
                  })()}

                  {/* Materials status */}
                  {allMats.length > 0 && (
                    <View style={{ marginBottom: 6 }}>
                      {hasMissingMats && (
                        <View style={{ backgroundColor: T.orange + "22", borderRadius: 6, padding: 6, marginBottom: 6, borderWidth: 1, borderColor: T.orange }}>
                          <Text style={{ color: T.orange, fontWeight: "700", fontSize: 11, marginBottom: 2 }}>⚠ Materials Missing — Work Stalled</Text>
                          {missingMats.map(m => {
                            const shortfall = totalCostNormal - game.cash;
                            return (
                              <View key={m.matId} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 1 }}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                    <Ionicons name={m.icon} size={10} color={T.text} />
                                    <Text style={[styles.sub, { fontSize: 10, color: T.text }]}>{m.label}: {m.fulfilled}/{m.needed} {m.unit}</Text>
                                  </View>
                                  <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 2, height: 3 }]}>
                                    <View style={[styles.progressFill, { width: `${Math.round((m.fulfilled / m.needed) * 100)}%`, backgroundColor: T.orange, height: 3 }]} />
                                  </View>
                                </View>
                                <Text style={[styles.sub, { fontSize: 10, color: T.orange }]}>Need {money(m.costNormal)}</Text>
                              </View>
                            );
                          })}
                          {!canAffordNormal && (
                            <View style={{ marginTop: 4, backgroundColor: T.red + "18", borderRadius: 4, padding: 4 }}>
                              <Text style={[styles.sub, { fontSize: 10, color: T.red }]}>Cash shortfall: {money(Math.max(0, totalCostNormal - game.cash))}</Text>
                              {(game.creditScore || 600) >= 600 && (
                                <Text style={[styles.sub, { fontSize: 10, color: T.cyan }]}>Supplier credit available (Credit {game.creditScore})</Text>
                              )}
                            </View>
                          )}
                          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: canAffordNormal ? T.green : T.panel2, borderRadius: 6, borderWidth: 1.5, borderColor: canAffordNormal ? T.green : T.border, paddingVertical: 7, alignItems: "center" }}
                              onPress={() => handleBuyMaterialsForSite(site.id)}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: canAffordNormal ? "#fff" : T.sub }}>Buy Materials</Text>
                              <Text style={{ fontSize: 9, color: canAffordNormal ? "#ffffffcc" : T.sub }}>{money(totalCostNormal)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: canAffordEmergency ? T.orange + "33" : T.panel2, borderRadius: 6, borderWidth: 1.5, borderColor: canAffordEmergency ? T.orange : T.border, paddingVertical: 7, alignItems: "center" }}
                              onPress={() => handleEmergencyPurchase(site.id)}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: canAffordEmergency ? T.orange : T.sub }}>Emergency</Text>
                              <Text style={{ fontSize: 9, color: canAffordEmergency ? T.orange : T.sub }}>{money(totalCostEmergency)} (1.5×)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 6, borderWidth: 1.5, borderColor: T.blue, paddingVertical: 7, alignItems: "center" }}
                              onPress={() => update(g => { const s = g.activeSites.find(s => s.id === site.id); if (s) { s.status = "Paused"; s.pausedDays = 999; } })}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: T.blue }}>Pause</Text>
                              <Text style={{ fontSize: 9, color: T.sub }}>No penalty</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                        {allMats.map(m => (
                          <View key={m.id} style={{ flexDirection: "row", alignItems: "center", backgroundColor: m.ok ? T.panel3 : T.orange + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                            <Ionicons name={m.icon} size={10} color={m.ok ? T.sub : T.orange} />
                            <Text style={[styles.sub, { fontSize: 9, color: m.ok ? T.sub : T.orange, marginLeft: 2 }]}>{m.fulfilled}/{m.needed}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Weather + last chaos row */}
                  {(site.currentWeather || lastChaos) && (
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                      {site.currentWeather && (
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: T.blue + "28", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Ionicons name={site.currentWeather.icon} size={11} color={T.blue} />
                          <Text style={[styles.sub, { color: T.blue, fontSize: 9, marginLeft: 3 }]}>{site.currentWeather.label}</Text>
                        </View>
                      )}
                      {lastChaos && (
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sub, { color: T.orange, fontSize: 9 }]} numberOfLines={1}>⚡ {lastChaos.text}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Projected profit */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Contract value</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={[styles.sub, { color: T.green, fontWeight: "700", fontSize: 11 }]}>{money(site.totalValue)}</Text>
                      {daysLate > 0 && <Text style={[styles.sub, { color: T.red, fontSize: 10 }]}>→ {money(projectedProfit)}</Text>}
                    </View>
                  </View>
                  {(site.depositPaid || 0) > 0 && !isOverdue && (
                    <Text style={[styles.sub, { color: T.cyan, fontSize: 10, marginBottom: 4 }]}>
                      {`💰 Mobilisation draw received: ${money(site.depositPaid)}`}
                    </Text>
                  )}
                  {isOverdue && daysLate > 0 && (
                    <View style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Value remaining</Text>
                        <Text style={[styles.sub, { color: T.red, fontSize: 10, fontWeight: "700" }]}>
                          -{money(daysLate * site.penaltyPerDay)} penalty{daysLate > 5 ? " (1.5× escalated)" : ""}
                        </Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                        <View style={{ height: 4, width: `${Math.max(0, Math.round((projectedProfit / site.totalValue) * 100))}%`, backgroundColor: projectedProfit > site.totalValue * 0.5 ? T.orange : T.red, borderRadius: 2 }} />
                      </View>
                      <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 1 }]}>
                        {money(projectedProfit)} of {money(site.totalValue)} remaining
                      </Text>
                    </View>
                  )}

                  {/* Strategy selector */}
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginBottom: 4 }]}>SITE STRATEGY</Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {SITE_MODES.map(m => (
                      <TouchableOpacity
                        key={m.key}
                        style={{ flex: 1, paddingVertical: 5, paddingHorizontal: 2, borderRadius: 6, borderWidth: 1.5,
                          borderColor: mode === m.key ? m.color : T.border,
                          backgroundColor: mode === m.key ? m.color + "28" : "transparent",
                          alignItems: "center" }}
                        onPress={() => update(g => { const s = g.activeSites.find(s => s.id === site.id); if (s) s.siteMode = m.key; })}
                      >
                        <Ionicons name={m.icon} size={12} color={mode === m.key ? m.color : T.sub} />
                        <Text style={{ fontSize: 9, color: mode === m.key ? m.color : T.sub, fontWeight: mode === m.key ? "700" : "400" }}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {modeDef.key !== "normal" && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Ionicons name={modeDef.icon} size={10} color={modeDef.color} />
                      <Text style={[styles.sub, { color: modeDef.color, fontSize: 10 }]}>{modeDef.desc}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: T.cyan, marginTop: 6 }}
                    onPress={() => setTab("Crew")}
                  >
                    <Text style={{ color: T.cyan, fontSize: 10, fontWeight: "700" }}>⚡ Hire Sub Crew →</Text>
                  </TouchableOpacity>

                  {/* R14-3: Crew completion bonus */}
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>On-time bonus:</Text>
                    {[0, 500, 1000, 2500].map(amt => {
                      const sel = (site.completionBonus || 0) === amt;
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: sel ? T.yellow : T.border, backgroundColor: sel ? T.yellow + "33" : "transparent" }}
                          onPress={() => update(g => { const s = g.activeSites.find(s => s.id === site.id); if (s) s.completionBonus = amt; })}
                        >
                          <Text style={[styles.sub, { color: sel ? T.yellow : T.sub, fontSize: 10, fontWeight: sel ? "700" : "400" }]}>
                            {amt === 0 ? "None" : money(amt)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Job exit controls */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderWidth:1, borderColor: site.status==="Paused" ? T.green : T.cyan, backgroundColor: "transparent" }]}
                      onPress={() => site.status==="Paused" ? handleResumeSite(site.id) : handlePauseSite(site.id)}
                    >
                      <Text style={[styles.smallBtnText, { color: site.status==="Paused" ? T.green : T.cyan }]}>
                        {site.status==="Paused" ? "▶ Resume" : "⏸ Pause"}
                      </Text>
                    </TouchableOpacity>
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
                    {job.quality && <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{job.quality} quality</Text>}
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
          <Text style={[styles.sub, subCol]}>Crew cap: {office.crewCap} · Equip cap: {office.equipCap} · Daily rent: {money(office.dailyRent)}</Text>
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
              <Text style={[styles.sub, { color: T.sub, textAlign: "center" }]}>No {crewFilter.toLowerCase()} crew members right now.</Text>
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
    const conditionColor = (c) => c >= 70 ? T.green : c >= 40 ? T.orange : T.red;
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
          <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginBottom: 8 }]}>Hire a Senior PM or Director to auto-manage your operation.</Text>
          {[
            { key: "autoAssignCrew",        label: "Auto-Assign Crew",     icon: "👷", color: T.green  },
            { key: "autoAssignEquipment",   label: "Auto-Assign Vehicles", icon: "🚛", color: T.cyan   },
            { key: "autoRepairEquipment",   label: "Auto-Repair Fleet",    icon: "🔧", color: T.orange },
            { key: "autoPurchaseMaterials", label: "Auto-Buy Materials",   icon: "📦", color: T.yellow },
            { key: "hapticsEnabled",        label: "Vibration Feedback",   icon: "📳", color: T.purple },
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
                    <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{s.label}</Text>
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

        {/* Owned equipment */}
        {(game.equipment||[]).length === 0 ? (
          <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 24 }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🚜</Text>
            <Text style={[styles.label, col, { textAlign: "center" }]}>No Vehicles Yet</Text>
            <Text style={[styles.sub, subCol, { textAlign: "center", marginTop: 4 }]}>
              Buy a vehicle below to boost site efficiency and unlock contracts.
            </Text>
          </View>
        ) : (() => {
          const _filteredEquip = equipFilter === "All" ? (game.equipment||[]) : (game.equipment||[]).filter(e =>
            equipFilter === "Active"       ? e.status === "Active" :
            equipFilter === "Idle"         ? e.status === "Idle" :
            equipFilter === "Maintenance"  ? e.status === "Maintenance" :
            equipFilter === "Broken"       ? e.status === "Broken" :
            equipFilter === "Low Condition"? (e.condition ?? 100) < 40 : true
          );
          if (_filteredEquip.length === 0 && equipFilter !== "All") return (
            <View style={[styles.card, { backgroundColor: T.panel2, borderColor: T.border, alignItems: "center", padding: 20 }]}>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center" }]}>No {equipFilter.toLowerCase()} equipment right now.</Text>
            </View>
          );
          return _filteredEquip.map((equip) => {
            const cond = Math.round(equip.condition ?? 100);
            const cc = conditionColor(cond);
            const repairCost = Math.round((equip.price || 5000) * 0.2);
            const emergRepairCost = Math.round((equip.price || 5000) * 0.4);
            const assignedSite = equip.assignedSiteId
              ? game.activeSites?.find(s => s.id === equip.assignedSiteId)
              : null;
            const equipImg = EQUIPMENT_IMAGES[equip.shopId];
            return (
              <View key={equip.id} style={[styles.card, { backgroundColor: T.panel, borderColor: cc, borderWidth: 1.5 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  {equipImg && (
                    <Image source={equipImg} style={{ width: 64, height: 48, borderRadius: 8, marginRight: 10, backgroundColor: "#fff" }} resizeMode="contain" />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, col]}>{equipImg ? "" : "🔧 "}{equip.name}</Text>
                    <Text style={[styles.sub, subCol]}>Tier {equip.tier || 1} · {money(getEquipmentDailyCost(equip))}/day · {equip.type}</Text>
                    <Text style={[styles.sub, { color: cc }]}>Condition: {cond}%</Text>
                    {(() => {
                      const hrs = Math.round(equip.engineHours || 0);
                      const sinceService = Math.round(getHoursSinceService(equip));
                      const due = isServiceDue(equip);
                      return (
                        <Text style={[styles.sub, { color: due ? T.orange : T.sub }]}>
                          {`${hrs.toLocaleString()} hrs · ${due ? `service overdue by ${sinceService - SERVICE_INTERVAL_HOURS} hrs` : `service in ${SERVICE_INTERVAL_HOURS - sinceService} hrs`}`}
                        </Text>
                      );
                    })()}
                    {equip.isRental && (
                      <Text style={[styles.sub, { color: T.cyan }]}>
                        {`🔑 Rented — on hire ${Math.max(1, (game.day || 1) - (equip.rentedOnDay || game.day))} day(s)`}
                      </Text>
                    )}
                    {equip.isFinanced && (() => {
                      const loan = (game.equipmentLoans || []).find((l) => l.equipId === equip.id);
                      if (!loan) return null;
                      return (
                        <Text style={[styles.sub, { color: T.purple }]}>
                          {`🏦 Financed — ${money(loan.weeklyPayment)}/wk, ${loan.weeksLeft} wk left${loan.missedPayments ? ` · ${loan.missedPayments} missed` : ""}`}
                        </Text>
                      );
                    })()}
                    {equip.status === "Maintenance" && <Text style={[styles.sub, { color: T.red }]}>⚠️ In maintenance — needs repair</Text>}
                    {assignedSite && <Text style={[styles.sub, { color: T.cyan }]}>Assigned to: {assignedSite.label}</Text>}
                    {!assignedSite && equip.status === "Idle" && <Text style={[styles.sub, { color: T.green }]}>Available</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.sub, { color: equip.status === "Active" ? T.orange : equip.status === "Maintenance" ? T.red : T.green }]}>
                      {equip.status}
                    </Text>
                  </View>
                </View>
                {/* Condition bar */}
                <View style={[styles.progressTrack, { backgroundColor: T.track, marginTop: 6 }]}>
                  <View style={[styles.progressFill, { width: `${cond}%`, backgroundColor: cc }]} />
                </View>
                {/* Equipment Upgrades */}
                <View style={{ marginTop: 10, marginBottom: 2 }}>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10, fontWeight: "700", marginBottom: 5 }]}>UPGRADES</Text>
                  {EQUIPMENT_UPGRADES.map(upg => {
                    const currentTier = (equip.upgrades || {})[upg.id] || 0;
                    const nextTier = upg.tiers[currentTier];
                    const isMax = currentTier >= upg.tiers.length;
                    const canAfford = nextTier && game.cash >= nextTier.cost;
                    return (
                      <View key={upg.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                        <Text style={{ fontSize: 13, marginRight: 6 }}>{upg.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sub, { color: isMax ? T.green : currentTier > 0 ? T.cyan : T.sub, fontSize: 10 }]}>
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
                          <Text style={[styles.sub, { color: T.green, fontSize: 10 }]}>✓ Max</Text>
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
                  {!equip.assignedSiteId && equip.isRental && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.cyan + "22", flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.cyan }]}
                      onPress={() => handleReturnRental(equip.id)}>
                      <Text style={[styles.smallBtnText, { color: T.cyan }]}>Return Hire</Text>
                    </TouchableOpacity>
                  )}
                  {!equip.assignedSiteId && !equip.isRental && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: T.red + "22", flex: 1, minWidth: 80, borderWidth: 1, borderColor: T.red }]}
                      onPress={() => handleSellEquipment(equip.id)}>
                      <Text style={[styles.smallBtnText, { color: T.red }]}>Sell ({money(getEquipmentResaleValue(equip))})</Text>
                    </TouchableOpacity>
                  )}
                  {!equip.assignedSiteId && !equip.isRental && (
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
                    <Text style={[styles.sub, { color: T.sub, textAlign: "center", fontSize: 10 }]}>100% condition · reliable</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: game.cash >= usedPrice ? T.orange+"44" : T.panel2, borderColor: T.orange }]}
                    onPress={() => handleBuyEquipment(item, true)}
                  >
                    <Text style={[styles.btnText, { color: game.cash >= usedPrice ? T.orange : T.red, fontSize: 12 }]}>🔄 Used</Text>
                    <Text style={[styles.sub, { color: game.cash >= usedPrice ? T.orange : T.red, textAlign: "center" }]}>{money(usedPrice)}</Text>
                    <Text style={[styles.sub, { color: T.sub, textAlign: "center", fontSize: 10 }]}>~55% cond · higher risk</Text>
                  </TouchableOpacity>
                </View>
                {/* Rent / Finance — how a machine gets on site without the full purchase price */}
                {(() => {
                  const rentRate = getRentalDailyRate(item);
                  const delivery = getRentalDeliveryFee(item);
                  const terms = getFinanceTerms(item, newPrice);
                  const canRent = game.cash >= delivery;
                  const canFinance = game.cash >= terms.down && game.creditScore >= 580;
                  return (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={[styles.btn, { flex: 1, backgroundColor: canRent ? T.cyan + "33" : T.panel2, borderColor: T.cyan }]}
                        onPress={() => handleRentEquipment(item)}
                      >
                        <Text style={[styles.btnText, { color: canRent ? T.cyan : T.red, fontSize: 12 }]}>🔑 Rent</Text>
                        <Text style={[styles.sub, { color: canRent ? T.cyan : T.red, textAlign: "center" }]}>{money(rentRate)}/day</Text>
                        <Text style={[styles.sub, { color: T.sub, textAlign: "center", fontSize: 10 }]}>{money(delivery)} delivery · no capital</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, { flex: 1, backgroundColor: canFinance ? T.purple + "33" : T.panel2, borderColor: T.purple }]}
                        onPress={() => handleFinanceEquipment(item)}
                      >
                        <Text style={[styles.btnText, { color: canFinance ? T.purple : T.red, fontSize: 12 }]}>🏦 Finance</Text>
                        <Text style={[styles.sub, { color: canFinance ? T.purple : T.red, textAlign: "center" }]}>{money(terms.down)} down</Text>
                        <Text style={[styles.sub, { color: T.sub, textAlign: "center", fontSize: 10 }]}>
                          {game.creditScore < 580 ? "Needs 580+ credit" : `${money(terms.weeklyPayment)}/wk × ${terms.weeks}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
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
          <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginBottom: 6 }]}>
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
            { label: "Equipment Fleet", val: money(Math.round((game.equipment||[]).reduce((s,e)=>s+getEquipmentResaleValue(e)/0.45*0.6,0))), color: T.orange },
            { label: "Retainage Held", val: money(getTotalRetainageHeld(game)), color: T.yellow },
            { label: "Properties", val: money(Math.round((game.properties||[]).reduce((s,p)=>{ const d=PROPERTY_TYPES.find(t=>t.id===p.typeId); return s+(d?d.cost*(d.resaleRate||0.8):0); },0))), color: T.purple },
            { label: "Office Network", val: money(Math.round((game.cityOffices||[]).reduce((s,o)=>{ const d=REGIONAL_OFFICE_TYPES.find(t=>t.id===o.typeId); return s+(d?d.cost*0.7:0); },0))), color: T.blue },
            { label: "Active Pipeline", val: money(Math.round((game.activeSites||[]).reduce((s,site)=>s+site.totalValue*0.4,0))), color: T.cyan },
            ...((game.equipmentLoans || []).length
              ? [{ label: "Equipment Finance", val: `${money(getWeeklyEquipmentFinanceCost(game))}/wk`, color: T.red }]
              : []),
          ].map(row => (
            <View key={row.label} style={[styles.finRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.sub, col]}>{row.label}</Text>
              <Text style={[styles.sub, { color: row.color }]}>{row.val}</Text>
            </View>
          ))}
        </View>

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
                <Text style={[styles.sub, { color: T.sub, fontSize: 9, marginTop: 2 }]}>
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
                        <Text style={[styles.sub, { color: T.cyan, fontSize: 10 }]}>{progressLabel}</Text>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{Math.round(progressPct)}%</Text>
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
              <Text style={[styles.sub, { color: T.orange, fontSize: 10, fontWeight: "700", marginBottom: 2 }]}>
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
                        <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginTop: 1 }]}>
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
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>👷 {rival.employees || 0} crew</Text>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>🚛 {rival.equipment || 0} vehicles</Text>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>🏙️ {(rival.cityPresence || ["salem"]).length} {(rival.cityPresence || ["salem"]).length === 1 ? "city" : "cities"}</Text>
                  <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>💰 {money(rival.cash || 0)}</Text>
                </View>
              )}
              {rival && (rival.aggression || 0) >= 0.70 && !entry.acquired && entry.status !== "Bankrupt" && (
                <View style={{ marginTop: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                    <Text style={[styles.sub, { color: T.red, fontSize: 10, fontWeight: "700" }]}>⚠ High aggression rival</Text>
                    <Text style={[styles.sub, { color: T.red, fontSize: 10 }]}>{Math.round((rival.aggression || 0) * 100)}%</Text>
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
                <Text style={[styles.sub, { color: earned ? T.sub : T.border, fontSize: 10, lineHeight: 14 }]}>{ach.desc}</Text>
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
                          <Text style={[{ fontSize: 9, color: T.sub }]}>market share</Text>
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
                    const val = game.companyValuation || 0;
                    if (val < DOMINATION_MIN_VALUATION) {
                      // Surface the valuation gate rather than showing 100% while it blocks.
                      progressPct = Math.min(99, (val / DOMINATION_MIN_VALUATION) * 100);
                      progressLabel = `${money(val)} / ${money(DOMINATION_MIN_VALUATION)} company value`;
                    } else {
                      progressPct = activeRivals.length > 0 ? Math.min(100,(outvalued/activeRivals.length)*100) : 100;
                      progressLabel = `${outvalued}/${activeRivals.length} rivals outvalued 10×`;
                    }
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
                              <Text style={[styles.sub, { color: T.yellow, fontSize: 10 }]}>{progressLabel}</Text>
                              <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{Math.round(progressPct)}%</Text>
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
    const weeklyEquipCost = game.equipment.reduce((s, e) => s + getEquipmentDailyCost(e), 0) * 7;
    const weeklyRent = office.dailyRent * 7;
    const dailyEquipCost = game.equipment.reduce((s, e) => s + getEquipmentDailyCost(e), 0);
    const dailyLoanInterest = game.loans.reduce((s, l) => s + (l.weeklyPayment || 0) / 7, 0);
    const dailyIncome = (game.weeklyStats?.revenue || 0) / 7;
    const netDailyCashFlow = dailyIncome - dailyPayroll - dailyEquipCost - office.dailyRent - dailyLoanInterest;
    const loanOffers = LOAN_PRODUCTS.filter((p) => game.creditScore >= p.minCredit);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
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
                <Text style={[styles.sub, { color: row.bar?.color || T.sub, fontSize: 10, marginTop: 2 }]}>{row.note}</Text>
              )}
            </View>
          ))}
        </View>

        {/* R16-1: Business Savings */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1, marginBottom: 8 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={[styles.sectionTitle, { color: T.cyan }]}>🏦 Reserve Savings</Text>
            <Text style={[styles.label, { color: T.cyan }]}>{money(game.savings || 0)}</Text>
          </View>
          <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginBottom: 8 }]}>
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

        {/* Tax */}
        {(game.taxDue || 0) > 0 && (
          <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.red, borderWidth: 1.5 }]}>
            <Text style={[styles.label, { color: T.red }]}>⚠ Tax Due: {money(game.taxDue)}</Text>
            <Text style={[styles.sub, subCol]}>Overdue {game.taxOverdueDays} day(s). Business freezes at 14 days.</Text>
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
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, backgroundColor: game.cash >= (game.taxDue || 0) ? T.red : T.panel2, borderColor: T.red }]}
              onPress={handlePayTax}
            >
              <Text style={[styles.btnText, { color: game.cash >= (game.taxDue || 0) ? "#fff" : T.red }]}>Pay Tax Bill</Text>
            </TouchableOpacity>
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
                      <Text style={[styles.sub, { color: T.sub, marginTop: 2, fontSize: 10 }]}>
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
            <Text style={[styles.sub, subCol]}>{`${money(CREDIT_LINE_LIMIT)} revolving · ${CREDIT_LINE_APR}% APR on drawn amount only · repay anytime`}</Text>
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
              <Text style={[styles.label, { color: T.green }]}>{money((game.creditLine.limit || CREDIT_LINE_LIMIT) - (game.creditLine.drawn || 0))}</Text>
            </View>
            <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginBottom: 8 }]}>
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
            {(() => {
              const _score = game.creditScore || 600;
              const _disc = _score >= 780 ? 2.5 : _score >= 720 ? 1.5 : _score >= 660 ? 0.5 : 0;
              const _apr = Math.max(0.5, product.apr - _disc);
              return <Text style={[styles.sub, subCol]}>{_apr}% APR{_disc > 0 ? ` (−${_disc}% credit bonus)` : ""} · {product.weeks} weeks · {money(Math.round(product.principal * (1 + _apr / 100) / product.weeks))}/week</Text>;
            })()}
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, backgroundColor: T.blue, borderColor: T.blue }]}
              onPress={() => handleTakeLoan(product)}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>Take Loan</Text>
            </TouchableOpacity>
          </View>
        ))}
        {loanOffers.length === 0 && (
          <Text style={[styles.sub, subCol, { textAlign: "center", paddingVertical: 16 }]}>No financing available — improve credit score to unlock loans.</Text>
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
              <Text style={[styles.sub, { color: T.cyan }]}>{game.materials[m.id] || 0} {m.unit} · {money(game.materialPrices[m.id] || m.basePrice)}/{m.unit}</Text>
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
        <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: "800" }}>ConstructionFlow</Text>
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
              <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>for {game.pendingCelebration.client}</Text>
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
                  onPress={() => update(g => {
                    const evtDef = DECISION_EVENTS.find(e => e.id === g.pendingDecision?.id)
                      || EMPLOYEE_EVENTS.find(e => e.id === g.pendingDecision?.id)
                      || (g.pendingDecision?.id === CHANGE_ORDER_EVENT.id ? CHANGE_ORDER_EVENT : null);
                    if (evtDef?.options?.[i]?.apply) evtDef.options[i].apply(g);
                    g.pendingDecision = null;
                  })}
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
                  if (equip) { g.cash -= bd.repairCost; equip.condition = Math.min(100, equip.condition + 40); equip.status = "Active"; }
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
                  addLog(g, `🔧 ${bd.equipName} pulled for scheduled maintenance — repair from Vehicles tab.`);
                  g.pendingBreakdown = null;
                })}
              >
                <Text style={[styles.btnText, { color: T.text }]}>Delay Repair — Pull from site for later</Text>
                <Text style={[styles.sub, { color: T.sub, textAlign: "center", marginTop: 2 }]}>No cost · repair later from Vehicles tab</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { marginBottom: 4, backgroundColor: T.panel2, borderColor: T.red }]}
                onPress={() => update(g => {
                  const bd = g.pendingBreakdown;
                  const equip = g.equipment.find(e => e.id === bd.equipId);
                  const scrapValue = equip ? Math.round(equip.price * 0.15 * equip.condition / 100) : 0;
                  if (equip) {
                    g.cash += scrapValue;
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
            <View style={{ margin: 16, backgroundColor: T.panel, borderRadius: 20, borderWidth: 2, borderColor: T.strongBorder, overflow: "hidden" }}>
              {/* Header */}
              <View style={{ backgroundColor: T.green, paddingVertical: 18, alignItems: "center" }}>
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
                    <Text style={{ fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>NET CASH</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: game.pendingOfflineSummary.cashDelta >= 0 ? T.green : T.red }}>
                      {game.pendingOfflineSummary.cashDelta >= 0 ? "+" : ""}{money(game.pendingOfflineSummary.cashDelta)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1.5, borderColor: T.cyan }}>
                    <Text style={{ fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>CASH NOW</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: game.pendingOfflineSummary.cashNow >= 0 ? T.cyan : T.red }}>
                      {money(game.pendingOfflineSummary.cashNow)}
                    </Text>
                  </View>
                </View>

                {/* Jobs / Rep / Overhead row */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.orange }}>
                    <Text style={{ fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>JOBS DONE</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: T.orange }}>{game.pendingOfflineSummary.jobsDelta}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.purple }}>
                    <Text style={{ fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>REP</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: T.purple }}>{game.pendingOfflineSummary.repDelta >= 0 ? "+" : ""}{game.pendingOfflineSummary.repDelta}</Text>
                  </View>
                  {(game.pendingOfflineSummary.overheadPerDay || 0) > 0 && (
                    <View style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: T.red }}>
                      <Text style={{ fontSize: 10, color: T.sub, marginBottom: 3, fontWeight: "700", letterSpacing: 0.8 }}>BURN/DAY</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: T.red }}>{money(game.pendingOfflineSummary.overheadPerDay)}</Text>
                    </View>
                  )}
                </View>

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
                  style={{ backgroundColor: T.green, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                  onPress={() => update(g => { g.pendingOfflineSummary = null; })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#000", letterSpacing: 0.5 }}>Get Back to Work →</Text>
                </TouchableOpacity>
              </View>
            </View>
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
                      if (!_canAfford) { Alert.alert("Insufficient Funds", `You need ${money(ev.retainCost)} to pay this bonus.`); return; }
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
        {tab === "Vehicles"  && renderEquipment()}
        {tab === "Finance"   && renderFinance()}
        {tab === "Empire"    && renderEmpire()}
      </View>
      <View style={[styles.tabBar, { backgroundColor: T.tabBar, borderColor: T.border }]}>
        {TABS.map((t) => {
          const active = tab === t;
          const badgeVal = {
            Bids:      getOpenContracts(game).length,
            Crew:      game.applicants.length,
            Vehicles:  (game.equipment||[]).filter(e => e.condition < 40 || e.status === "Maintenance").length || 0,
            Finance:   (game.taxDue || 0) > 0 ? "!" : 0,
            Empire:    (game.empireGoalsCompleted||[]).length < EMPIRE_GOALS.length && EMPIRE_GOALS.some(g2 => !(game.empireGoalsCompleted||[]).includes(g2.id) && (() => { try { return g2.check(game); } catch(_){return false;} })()) ? "!" : 0,
          }[t];
          const TAB_ICONS = {
            Home:     { active: "home",          inactive: "home-outline"          },
            Bids:     { active: "document-text", inactive: "document-text-outline" },
            Sites:    { active: "construct",      inactive: "construct-outline"     },
            Crew:     { active: "people",         inactive: "people-outline"        },
            Vehicles: { active: "car",            inactive: "car-outline"           },
            Finance:  { active: "wallet",         inactive: "wallet-outline"        },
            Empire:   { active: "trophy",         inactive: "trophy-outline"        },
          };
          const iconName = active ? TAB_ICONS[t]?.active : TAB_ICONS[t]?.inactive;
          return (
            <TouchableOpacity key={t} style={styles.tabItem} onPress={() => setTab(t)} activeOpacity={0.75}>
              {!!badgeVal && (
                <View style={[styles.badge, { backgroundColor: t === "Finance" ? T.red : T.orange }]}>
                  <Text style={styles.badgeText}>{badgeVal}</Text>
                </View>
              )}
              <Ionicons name={iconName} size={20} color={active ? T.green : T.sub} />
              <Text style={[styles.tabLabel, { color: active ? T.text : T.sub, fontWeight: active ? "700" : "500" }]}>{t}</Text>
              {active
                ? <View style={[styles.tabDot, { backgroundColor: T.green }]} />
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

function BidsScreen({ game, T, col, subCol, openContracts, allOpenCount, categoryFilter, onSetFilter, idleCrew, idleEquip, onStartSite, onBuyMaterials, onSetBidStyle }) {
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
          <View style={{ alignItems: "center", padding: 24 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
            <Text style={[styles.label, { color: T.sub, textAlign: "center", marginBottom: 6 }]}>
              {categoryFilter !== "All" ? `No ${categoryFilter} contracts right now` : "No contracts available"}
            </Text>
            <Text style={[styles.sub, subCol, { textAlign: "center" }]}>
              New contracts arrive daily. Come back tomorrow or improve your reputation for better offers.
            </Text>
          </View>
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
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <Text style={[styles.label, col]} numberOfLines={1}>{c.label}</Text>
                    <Text style={{ fontSize: 10, color: T.purple, borderWidth: 1, borderColor: T.purple, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>{c.category || "Commercial"}</Text>
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
                  <Text style={[styles.sub, { color: T.yellow, fontWeight: "700", fontSize: 10 }]}>
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
                <Text style={[styles.sub, { color: T.red, fontSize: 10, marginTop: 3, fontWeight: "600" }]}>
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
                    const estMatCost = Object.entries(c.materials || {}).reduce((s, [matId, qty]) => {
                      const price = game.materialPrices[matId] || MATERIAL_DEFS.find(m => m.id === matId)?.basePrice || 100;
                      return s + qty * price;
                    }, 0);
                    const estLaborCost = (c.crewMin || 1) * 220 * (c.durationDays || 1);
                    const estProfit = c.value - estMatCost - estLaborCost;
                    const bidStyle = (game.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE;
                    const effectiveValue = Math.round(c.value * getBidStyle(bidStyle).multiplier);
                    return (
                      <View style={{ backgroundColor: T.panel2, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Contract value</Text>
                          <Text style={[styles.sub, { color: T.green, fontWeight: "700" }]}>{money(effectiveValue)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Est. material cost</Text>
                          <Text style={[styles.sub, { color: T.orange }]}>{money(estMatCost)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                          <Text style={[styles.sub, subCol]}>Est. labor cost</Text>
                          <Text style={[styles.sub, { color: T.orange }]}>{money(estLaborCost)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                          <Text style={[styles.sub, { color: T.text, fontWeight: "700" }]}>Est. profit</Text>
                          <Text style={[styles.sub, { color: estProfit >= 0 ? T.cyan : T.red, fontWeight: "700" }]}>{money(estProfit)}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                          <Text style={[styles.sub, subCol]}>Deadline penalty</Text>
                          <Text style={[styles.sub, { color: T.red }]}>{money(c.penaltyPerDay)}/day late</Text>
                        </View>
                        {estProfit > 0 && (() => {
                          const marginPct = Math.round((estProfit / Math.max(1, effectiveValue)) * 100);
                          const barColor = marginPct >= 30 ? T.green : marginPct >= 15 ? T.cyan : T.orange;
                          return (
                            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                                <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Profit margin</Text>
                                <Text style={[styles.sub, { color: barColor, fontSize: 10, fontWeight: "600" }]}>{marginPct}%</Text>
                              </View>
                              <View style={{ height: 4, backgroundColor: T.track, borderRadius: 2 }}>
                                <View style={{ height: 4, width: `${Math.min(100, marginPct * 2)}%`, backgroundColor: barColor, borderRadius: 2 }} />
                              </View>
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
                    <Text style={[styles.sub, { color: T.orange }]}>No idle vehicles — buy machines in the Vehicles tab.</Text>
                  )}
                  {idleEquip.map((e) => {
                    const sel = selectedEquipIds.includes(e.id);
                    const tierOk = e.tier >= c.minTier;
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[styles.rowItem, { backgroundColor: sel ? T.panel3 : T.panel2, borderColor: sel ? T.orange : tierOk ? T.border : T.red, opacity: tierOk ? 1 : 0.6 }]}
                        onPress={() => tierOk && toggleEquip(e.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.label, col]}>{e.name}</Text>
                          <Text style={[styles.sub, subCol]}>Tier {e.tier} · Cond {Math.round(e.condition)}%</Text>
                          {!tierOk && <Text style={[styles.sub, { color: T.red }]}>Needs Tier {c.minTier}+</Text>}
                        </View>
                        <View style={[styles.selDot, { backgroundColor: sel ? T.orange : T.border }]} />
                      </TouchableOpacity>
                    );
                  })}

                  {/* Bid Style */}
                  {(() => {
                    const BID_OPTIONS = BID_STYLES.map((b) => ({ ...b, color: T[b.color] }));
                    const bidStyle = (game.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE;
                    const activeMultiplier = getBidStyle(bidStyle).multiplier;
                    const winPct = Math.round(computeBidWinChance(game, c, bidStyle) * 100);
                    const prepCost = getBidPrepCost(c);
                    const winColor = winPct >= 60 ? T.green : winPct >= 35 ? T.orange : T.red;
                    return (
                      <View style={{ marginTop: 10 }}>
                        <Text style={[styles.sub, { color: T.sub, marginBottom: 6, fontSize: 11 }]}>Bid Strategy</Text>
                        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                          {BID_OPTIONS.map(opt => {
                            const active = bidStyle === opt.key;
                            return (
                              <TouchableOpacity key={opt.key} onPress={() => onSetBidStyle(c.id, opt.key)} style={{ flex: 1, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 7, borderWidth: 1.5, borderColor: opt.color, backgroundColor: active ? opt.color + "33" : "transparent", alignItems: "center" }}>
                                <Text style={{ fontWeight: "bold", fontSize: 12, color: active ? opt.color : T.sub }}>{opt.label}</Text>
                                <Text style={{ fontSize: 9, color: active ? opt.color : T.border, textAlign: "center", marginTop: 1 }}>{opt.sub}</Text>
                                <Text style={{ fontSize: 10, fontWeight: "bold", color: active ? opt.color : T.sub, marginTop: 2 }}>{`${Math.round(computeBidWinChance(game, c, opt.key) * 100)}% win`}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: T.panel2, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 }}>
                          <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>Your Bid</Text>
                          <Text style={{ color: T.text, fontWeight: "bold", fontSize: 12 }}>{`$${Math.round(c.value * activeMultiplier).toLocaleString()}`}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: T.panel2, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginTop: 4 }}>
                          <Text style={[styles.sub, { color: T.sub, fontSize: 12 }]}>Chance to win</Text>
                          <Text style={{ color: winColor, fontWeight: "bold", fontSize: 12 }}>{`${winPct}%`}</Text>
                        </View>
                        <Text style={[styles.sub, { color: T.sub, fontSize: 10, marginTop: 5 }]}>
                          {`Estimating costs ${money(prepCost)} whether you win or lose. Reputation, an Estimator, repeat clients and spare capacity all improve your odds.`}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Confirm button */}
                  <TouchableOpacity
                    style={[styles.btn, { marginTop: 14, backgroundColor: !blockReason ? T.green : T.panel2, borderColor: !blockReason ? T.green : T.border }]}
                    onPress={handleConfirm}
                  >
                    <Text style={[styles.btnText, { color: !blockReason ? "#fff" : T.sub }]}>
                      {blockReason || `📨 Submit Bid — ${Math.round(computeBidWinChance(game, c, (game.contractBidStyles || {})[c.id] || DEFAULT_BID_STYLE) * 100)}% to win`}
                    </Text>
                  </TouchableOpacity>
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
              const price = game.materialPrices[materialModal.matId] || mat?.basePrice || 100;
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

function CrewScreen({ game, T, col, subCol, onHire, onFire, onPostJob, onHireSubcontractor, onHirePM, onFirePM, onTrain, onPromote, onRaiseWage, onLowerWage, onGiveBonus, onRest, onRestAllTired, onBuyLunch }) {
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
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
        <Text style={[styles.sub, subCol, { textAlign: "center", padding: 16, fontStyle: "italic" }]}>
          Post a job to attract applicants.
        </Text>
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
        <Text style={[styles.sub, subCol, { textAlign: "center", padding: 16 }]}>No crew yet — post a job ad to find workers.</Text>
      )}
      {game.crew.map((w) => {
        const trait = w.trait || {};
        const traitEffects = [];
        if ((trait.speed || 1) > 1.05) traitEffects.push({ label: `Speed +${Math.round((trait.speed - 1) * 100)}%`, color: T.green });
        else if ((trait.speed || 1) < 0.97) traitEffects.push({ label: `Speed −${Math.round((1 - trait.speed) * 100)}%`, color: T.red });
        if ((trait.quality || 1) > 1.05) traitEffects.push({ label: `Quality +${Math.round((trait.quality - 1) * 100)}%`, color: T.cyan });
        if ((trait.safety || 1) > 1.08) traitEffects.push({ label: `Safety +${Math.round((trait.safety - 1) * 100)}%`, color: T.blue });
        else if ((trait.safety || 1) < 0.95) traitEffects.push({ label: `Safety risk`, color: T.orange });
        if (trait.label === "Team Leader") traitEffects.push({ label: "Team +8% progress", color: T.purple });
        if (trait.label === "Frequent No-Show") traitEffects.push({ label: "Unreliable presence", color: T.red });
        if ((trait.wagePressure || 1) > 1.12) traitEffects.push({ label: `High wage demand`, color: T.orange });
        return (
        <View key={w.id} style={[styles.card, { backgroundColor: T.panel, borderColor: T.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, col]}>{w.name}</Text>
                  <Text style={[styles.sub, subCol]}>{w.role} · Lv{w.level || 1} {WORKER_LEVELS.find(l => l.level === (w.level || 1))?.label || ""}</Text>
              {(() => {
                const curLvl = WORKER_LEVELS.find(l => l.level === (w.level || 1));
                const nextLvl = WORKER_LEVELS.find(l => l.level === (w.level || 1) + 1);
                if (!nextLvl) return <Text style={[styles.sub, { color: T.yellow, fontSize: 10 }]}>⭐ Max Level</Text>;
                const xpProgress = Math.min(1, ((w.xp || 0) - curLvl.xpRequired) / (nextLvl.xpRequired - curLvl.xpRequired));
                return (
                  <View style={{ marginTop: 3, marginBottom: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.sub, { color: T.sub, fontSize: 9 }]}>XP {w.xp || 0} / {nextLvl.xpRequired}</Text>
                      <Text style={[styles.sub, { color: T.cyan, fontSize: 9 }]}>Next: {nextLvl.label}</Text>
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
                    <Text style={[styles.sub, { color: loyalty >= 80 ? T.yellow : loyalty >= 40 ? T.cyan : T.sub, fontSize: 10, marginTop: 1 }]}>
                      {loyalty >= 80 ? "⭐ " : ""}Hired Day {w.hireDay || 0} · {jobsDone} project{jobsDone !== 1 ? "s" : ""} complete{loyalty >= 80 ? " · Veteran" : ""}
                    </Text>
                  );
                }
                return null;
              })()}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.sub, { color: w.status === "Active" ? T.orange : w.status === "Idle" ? T.green : T.sub }]}>{w.status}</Text>
              {w.status === "Active" && (() => {
                const workingSite = (game.activeSites || []).find(s => (s.assignedCrewIds || []).includes(w.id));
                return workingSite ? (
                  <Text style={[styles.sub, { color: T.cyan, fontSize: 10, marginTop: 2 }]}>🏗️ {workingSite.label}</Text>
                ) : null;
              })()}
              <View style={[styles.statusPill, { backgroundColor: T.panel2, marginTop: 4 }]}>
                <Text style={[styles.statusPillText, { color: T.text }]}>{trait.label || "—"}</Text>
              </View>
            </View>
          </View>
          {/* Trait impact pills */}
          {traitEffects.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {traitEffects.map((e, i) => (
                <View key={i} style={[styles.statusPill, { backgroundColor: e.color + "22" }]}>
                  <Text style={[styles.statusPillText, { color: e.color }]}>{e.label}</Text>
                </View>
              ))}
            </View>
          )}
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
                    <Text style={[styles.sub, { fontSize: 9, color: T.blue, fontWeight: "700" }]}>🎓 {prog?.label || cert}</Text>
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
              <Text style={{ fontSize: 10, fontWeight: "700", color: T.green }}>Raise Wage</Text>
              <Text style={{ fontSize: 9, color: T.sub }}>+10%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 80, backgroundColor: T.orange + "22", borderRadius: 7, borderWidth: 1, borderColor: T.orange, paddingVertical: 6, alignItems: "center" }}
              onPress={() => onLowerWage && onLowerWage(w.id)}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: T.orange }}>Lower Wage</Text>
              <Text style={{ fontSize: 9, color: T.sub }}>-10%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 80, backgroundColor: T.yellow + "22", borderRadius: 7, borderWidth: 1, borderColor: T.yellow, paddingVertical: 6, alignItems: "center" }}
              onPress={() => onGiveBonus && onGiveBonus(w.id)}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: T.yellow }}>Give Bonus</Text>
              <Text style={{ fontSize: 9, color: T.sub }}>2× daily</Text>
            </TouchableOpacity>
            {w.status !== "Resting" && (w.stamina ?? 50) < 80 && (
              <TouchableOpacity
                style={{ flex: 1, minWidth: 80, backgroundColor: T.cyan + "22", borderRadius: 7, borderWidth: 1, borderColor: T.cyan, paddingVertical: 6, alignItems: "center" }}
                onPress={() => onRest && onRest(w.id)}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: T.cyan }}>Rest</Text>
                <Text style={{ fontSize: 9, color: T.sub }}>→80 stamina</Text>
              </TouchableOpacity>
            )}
            {w.lastLunchDay !== game.day && (
              <TouchableOpacity
                style={{ flex: 1, minWidth: 80, backgroundColor: T.orange + "22", borderRadius: 7, borderWidth: 1, borderColor: T.orange, paddingVertical: 6, alignItems: "center" }}
                onPress={() => onBuyLunch && onBuyLunch(w.id)}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: T.orange }}>Buy Lunch</Text>
                <Text style={{ fontSize: 9, color: T.sub }}>$25 · mood+8</Text>
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
              <Text style={[styles.sub, { color: T.cyan, fontSize: 10 }]}>😴 Resting — stamina recovering to {w.restUntilStamina || 80}</Text>
            </View>
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

const styles = StyleSheet.create({
  card:        { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 10 },
  h2:          { fontSize: 18, fontWeight: "700" },
  label:       { fontSize: 15, fontWeight: "600" },
  body:        { fontSize: 14, marginTop: 4 },
  sub:         { fontSize: 12, marginTop: 2 },
  sectionTitle:{ fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cashBig:     { fontSize: 22, fontWeight: "800" },
  kpi:         { borderRadius: 8, borderWidth: 1, padding: 10, alignItems: "center" },
  kpiVal:      { fontSize: 20, fontWeight: "800" },
  kpiLabel:    { fontSize: 11, marginTop: 2 },
  progressTrack:{ height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  tabBar:      { position: "absolute", left: 10, right: 10, bottom: Platform.select({ ios: 24, android: 12, default: 10 }), flexDirection: "row", borderRadius: 20, borderWidth: 1.2, justifyContent: "space-around", alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, elevation: 10 },
  tabItem:     { flex: 1, alignItems: "center", justifyContent: "center", position: "relative", paddingVertical: 8, paddingHorizontal: 2 },
  tabIcon:     { fontSize: 14, fontWeight: "700" },
  tabLabel:    { fontSize: 11, fontWeight: "600" },
  tabDot:      { marginTop: 4, width: 5, height: 5, borderRadius: 999 },
  badge:       { position: "absolute", top: 0, right: 10, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:   { color: "#fff", fontSize: 9, fontWeight: "700" },
  btn:         { borderRadius: 8, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  btnText:     { fontSize: 14, fontWeight: "600" },
  smallBtn:    { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, alignItems: "center" },
  smallBtnText:{ color: "#fff", fontSize: 12, fontWeight: "600" },
  chip:        { fontSize: 11, borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rowItem:     { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6 },
  selDot:      { width: 16, height: 16, borderRadius: 8, marginLeft: 8 },
  finRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  input:         { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard:     { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 20, backgroundColor: "#111a0f" },
  feedItem:      { fontSize: 12, paddingVertical: 3 },
  statusPill:    { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText:{ fontSize: 11, fontWeight: "600" },
});
