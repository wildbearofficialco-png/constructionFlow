// The return-visit streak: a small bonus for coming back to the company on consecutive REAL days.
//
// SPRINT 1 — IT WAS PAYING PER GAME DAY. The "login streak" lived in gameTick's new-day block:
//
//     const daysSinceLogin = (g.day||1) - (g.lastLoginDay||0);
//     if (daysSinceLogin === 1) { g.consecutiveLoginDays += 1; ... bonus up to $500 ... }
//
// g.day is the SIMULATED day, and it advances every 96 real seconds, so a player who left the
// game running collected a "login" bonus every game day: ~$19,600 in a new company's first 45 game
// days, against a first contract worth ~$9,000. It propped up the starter economy by accident and
// hid whether the construction loop pays for itself.
//
// A streak is now counted on real calendar days, when the app is opened or brought back to the
// foreground. Game days passing — online or offline — never touch it.

import { addLog, money } from "./utils.js";
import { recordTransaction } from "./financialLedger.js";

export const STREAK_BONUS_PER_DAY = 50;
export const STREAK_BONUS_CAP = 500;
export const STREAK_MIN_FOR_BONUS = 3;

// Local calendar date of a real timestamp, "YYYY-MM-DD".
export function calendarDayKey(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayNumber(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return null;
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function streakBonusFor(streak) {
  return streak >= STREAK_MIN_FOR_BONUS ? Math.min(STREAK_BONUS_CAP, streak * STREAK_BONUS_PER_DAY) : 0;
}

// Call when a real session begins (app opened, or returned from background). Mutates `g`.
// Returns { streak, bonus, counted } — `counted` is false for a second session on the same day.
export function registerSession(g, nowMs) {
  if (!g || !Number.isFinite(nowMs)) return { streak: 0, bonus: 0, counted: false };
  const today = calendarDayKey(nowMs);
  const last = g.lastSessionDate || null;
  if (last === today) return { streak: g.consecutiveLoginDays || 1, bonus: 0, counted: false };

  const gap = last ? dayNumber(today) - dayNumber(last) : null;
  // Consecutive real day extends the streak. A first session, a missed day, or a device clock that
  // moved backwards starts it again.
  const streak = gap === 1 ? (g.consecutiveLoginDays || 0) + 1 : 1;
  g.consecutiveLoginDays = streak;
  g.lastSessionDate = today;

  const bonus = streakBonusFor(streak);
  if (bonus > 0) {
    g.cash = (g.cash || 0) + bonus;
    g.revenue = (g.revenue || 0) + bonus;
    recordTransaction(g, "bonuses", bonus, `${streak}-day return streak bonus`);
    addLog(g, `🎯 ${streak} days in a row! Return bonus: ${money(bonus)}.`);
  }
  return { streak, bonus, counted: true };
}
