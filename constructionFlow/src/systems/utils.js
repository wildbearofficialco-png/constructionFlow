// Shared utilities for all gameplay systems

export const uid = () => Math.random().toString(36).slice(2, 10);
export const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function addLog(game, msg) {
  if (!Array.isArray(game.logs)) game.logs = [];
  if (!Array.isArray(game.eventLog)) game.eventLog = [];
  game.logs.unshift(msg);
  if (game.logs.length > 100) game.logs.length = 100;
  game.eventLog.unshift({ id: uid(), msg, day: game.day || 0 });
  if (game.eventLog.length > 80) game.eventLog.length = 80;
}

export function money(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}
