// How a rival construction firm earns money — the same way the player does: from the contracts
// it actually wins, at a realistic margin, paid when the job is done.
//
// The old model paid every rival $12,000–40,000 PER DAY for each job it held, whatever the job
// was worth, while a job stayed open ~5.5 days. Claiming a $9,000 fence was worth ~$100,000 to a
// rival, so the top firm passed $13M by day 37 and $400M by day 200 against a player near
// $1.4M — a race nobody could ever be in. Now a rival keeps a book of the contracts it won;
// each finishes with the same daily chance as before and pays its value times a margin, and the
// firm pays daily overhead for its people. Rivals can still outgrow a careless player, and a
// rival with no work can still fail (stepRivalLifecycle).

export const RIVAL_MARGIN_MIN = 0.22;
export const RIVAL_MARGIN_MAX = 0.35;
export const RIVAL_JOB_COMPLETE_CHANCE = 0.18; // per job, per day (~5.5-day average job)
export const RIVAL_OVERHEAD_BASE = 300;          // per day: yard, insurance, admin
export const RIVAL_OVERHEAD_PER_EMPLOYEE = 150;   // per day
export const RIVAL_JOB_BOOK_MAX = 40;

function num(v, f = 0) { return Number.isFinite(v) ? v : f; }

// A save from before job books: one entry per open job, valued at a typical board contract.
export function ensureJobBook(rival, fallbackValue = 20000) {
  if (!rival) return rival;
  if (!Array.isArray(rival.jobBook)) {
    rival.jobBook = Array.from({ length: Math.max(0, Math.round(num(rival.activeJobs, 0))) }, () => fallbackValue);
  }
  rival.activeJobs = rival.jobBook.length;
  return rival;
}

// Every path where a rival takes a contract goes through here, so the book and the count agree.
export function rivalWinsContract(rival, contract) {
  if (!rival) return;
  ensureJobBook(rival);
  rival.jobBook = [...rival.jobBook, Math.max(0, Math.round(num(contract?.value, 0)))].slice(-RIVAL_JOB_BOOK_MAX);
  rival.activeJobs = rival.jobBook.length;
}

// One day of a rival's business. Returns what happened so the caller can narrate and adjust rep.
export function settleRivalDay(rival, rng = Math.random) {
  ensureJobBook(rival);
  let income = 0;
  let completed = 0;
  const stillOpen = [];
  for (const value of rival.jobBook) {
    if (rng() < RIVAL_JOB_COMPLETE_CHANCE) {
      const margin = RIVAL_MARGIN_MIN + (RIVAL_MARGIN_MAX - RIVAL_MARGIN_MIN) * rng();
      income += Math.round(value * margin);
      completed += 1;
    } else {
      stillOpen.push(value);
    }
  }
  rival.jobBook = stillOpen;
  rival.activeJobs = stillOpen.length;
  const overhead = RIVAL_OVERHEAD_BASE + Math.max(1, num(rival.employees, 2)) * RIVAL_OVERHEAD_PER_EMPLOYEE;
  rival.cash = num(rival.cash, 0) + income - overhead;
  if (income > 0) rival.estimatedRevenue = num(rival.estimatedRevenue, 0) + income;
  return { income, overhead, completed };
}

// ─── One-time market correction for saves from the old economy ───────────────
//
// Saves played under the old model hold rivals worth $10M–$400M against a player near $1M. The
// new economy keeps the top rival at about 1.3–2x the player (max ~3.2x seen across 36 simulated
// 200-day careers), and never above ~$250k + $10k per game day. Rivals above that limit are
// brought back to it, keeping their order; nothing of the player's is touched. It runs once per
// save (game._rivalMarketCorrectedV1) and tells the player in a single news line.
export const MARKET_CORRECTION_FLAG = "_rivalMarketCorrectedV1";
export const CORRECTION_PLAYER_MULTIPLE = 3;
export const CORRECTION_BASE = 250000;
export const CORRECTION_PER_DAY = 10000;
export const CORRECTION_MIN_CASH = 20000;
export const CORRECTION_MAX_BOOK = 8;

export function rivalValueLimit(day, playerValue) {
  return Math.max(CORRECTION_PLAYER_MULTIPLE * Math.max(0, num(playerValue, 0)), CORRECTION_BASE + CORRECTION_PER_DAY * Math.max(1, num(day, 1)));
}

// valueOf: the rival valuation function (rivalMarket.rivalValuation), injected to avoid a cycle.
export function applyMarketCorrection(game, { playerValue, valueOf, machineValue = 12000 }) {
  if (!game || game[MARKET_CORRECTION_FLAG]) return [];
  game[MARKET_CORRECTION_FLAG] = true;
  const limit = rivalValueLimit(game.day, playerValue);
  const rivals = (game.rivals || []).filter((r) => r && r.status !== "Bankrupt");
  const top = Math.max(0, ...rivals.map((r) => valueOf(r)));
  if (top <= limit) return [];
  const corrected = [];
  for (const r of rivals) {
    ensureJobBook(r);
    const value = valueOf(r);
    if (value <= limit) continue;
    // Keep the pecking order: the biggest firm lands at the limit, the others a little under it.
    const target = Math.round(limit * (0.85 + 0.15 * (value / top)));
    if (r.jobBook.length > CORRECTION_MAX_BOOK) { r.jobBook = r.jobBook.slice(-CORRECTION_MAX_BOOK); r.activeJobs = r.jobBook.length; }
    let excess = valueOf(r) - target;
    if (excess > 0) {
      const cashCut = Math.max(0, Math.min(excess, num(r.cash, 0) - CORRECTION_MIN_CASH));
      r.cash = num(r.cash, 0) - cashCut;
      excess -= cashCut;
    }
    if (excess > 0 && num(r.equipment, 1) > 1) {
      const machines = Math.min(num(r.equipment, 1) - 1, Math.ceil(excess / machineValue));
      r.equipment = num(r.equipment, 1) - machines;
    }
    corrected.push(r.name || r.id);
  }
  return corrected;
}
