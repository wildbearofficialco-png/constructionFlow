// Save health: catching the number that went wrong before it eats the company.
//
// WHY THIS MODULE EXISTS
// ----------------------
// A device screenshot showed the header reading **$NaN**.
//
// That single value is fatal in a way that is easy to underestimate. Every affordability check
// in the game is `cash >= cost`, and every comparison against NaN is false — so once cash is
// NaN the player can buy nothing, hire nobody, and pay no bill. Taking out a loan adds to NaN
// and stays NaN. From inside the game it reads exactly as the report described it: *"I run out
// of money before a job is completed. Even if I take out every loan I still run out."*
//
// It could not be reproduced. Roughly 1,500 simulated game days across seeded runs, migrated
// build-6 saves and deliberately hostile states produced no non-finite value anywhere in the
// state tree. That points at a player action — a handler — rather than the tick, and handlers
// are React callbacks that the test harness cannot drive.
//
// So this module does not pretend to know the cause. It does the thing that is correct when a
// fatal defect cannot be reproduced: it stops the defect from being fatal, and it leaves
// evidence so the next occurrence names itself.
//
// FleetFlow has `fleetflowSaveHealth.js` for exactly this class of problem. Construction Flow
// had nothing — it was item 8 on this project's own gap list and had not been built yet.
//
// Repair, not silence: every intervention is logged and surfaced, because a game that quietly
// rewrites the player's money is worse than one that breaks honestly.

// The fields whose corruption ends a run. Anything here is repaired rather than trusted.
export const CRITICAL_NUMERICS = Object.freeze([
  "cash", "expenses", "revenue", "taxDue", "taxReserve", "savings",
  "reputation", "creditScore", "day", "gameMinutes",
]);

export const FALLBACKS = Object.freeze({
  cash: 0, expenses: 0, revenue: 0, taxDue: 0, taxReserve: 0, savings: 0,
  reputation: 50, creditScore: 600, day: 1, gameMinutes: 480,
});

function isBad(v) {
  return typeof v !== "number" || !Number.isFinite(v);
}

// Checks the state and returns what is wrong, without changing anything.
export function auditState(game) {
  if (!game) return { ok: true, broken: [] };
  const broken = [];
  for (const key of CRITICAL_NUMERICS) {
    if (isBad(game[key])) broken.push({ key, value: String(game[key]) });
  }
  // Per-worker and per-machine numbers that feed cash arithmetic.
  for (const w of Array.isArray(game.crew) ? game.crew : []) {
    if (w && isBad(w.wagePerDay)) broken.push({ key: `crew:${w.id}.wagePerDay`, value: String(w.wagePerDay) });
  }
  for (const e of Array.isArray(game.equipment) ? game.equipment : []) {
    if (e && isBad(e.dailyCost)) broken.push({ key: `equipment:${e.id}.dailyCost`, value: String(e.dailyCost) });
  }
  return { ok: broken.length === 0, broken };
}

// Repairs in place and returns a report. `lastGood` is the previous tick's value for the
// top-level numerics, which is a far better repair than a constant: a player whose cash was
// $48,213 a moment ago should get $48,213 back, not zero.
export function repairState(game, lastGood = null) {
  const audit = auditState(game);
  if (audit.ok) return { repaired: false, fields: [] };

  const fields = [];
  for (const { key, value } of audit.broken) {
    if (key.includes(":")) {
      const [kind, rest] = key.split(":");
      const [id, field] = rest.split(".");
      const list = kind === "crew" ? game.crew : game.equipment;
      const item = (Array.isArray(list) ? list : []).find((x) => x && x.id === id);
      if (item) {
        item[field] = kind === "crew" ? 150 : 100;
        fields.push({ key, was: value, now: item[field] });
      }
      continue;
    }
    const recovered = lastGood && Number.isFinite(lastGood[key]) ? lastGood[key] : FALLBACKS[key];
    game[key] = recovered;
    fields.push({ key, was: value, now: recovered });
  }

  // A breadcrumb the next report can be read against. Bounded, like everything else in a save.
  const log = Array.isArray(game.healthLog) ? game.healthLog : [];
  game.healthLog = [
    { day: Number.isFinite(game.day) ? game.day : 0, fields: fields.map((f) => `${f.key}:${f.was}`) },
    ...log,
  ].slice(0, 20);

  return { repaired: true, fields };
}

// A snapshot of just the values worth restoring from. Cheap enough to take every tick.
export function snapshotGood(game) {
  if (!game) return null;
  const snap = {};
  for (const key of CRITICAL_NUMERICS) {
    if (Number.isFinite(game[key])) snap[key] = game[key];
  }
  return snap;
}

export function describeRepair(report) {
  if (!report || !report.repaired) return null;
  const names = report.fields.map((f) => f.key).join(", ");
  return `A saved value went bad (${names}) and was restored. Your company is intact — please report this if you see it again.`;
}
