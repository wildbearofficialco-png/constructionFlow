// Rivals earn from the contracts they win (systems/rivalEconomy.js).
//
// The old model paid $12k–40k per open job per DAY regardless of the job's value: a $9,000 fence
// was worth ~$100,000 to a rival, and the top firm passed $13M by day 37.
import {
  ensureJobBook, rivalWinsContract, settleRivalDay,
  RIVAL_MARGIN_MAX, RIVAL_OVERHEAD_BASE, RIVAL_OVERHEAD_PER_EMPLOYEE,
} from "../src/systems/rivalEconomy.js";

const rival = (over = {}) => ({ id: "r", name: "IronPeak", cash: 30000, employees: 4, activeJobs: 0, ...over });

test("winning a contract books its value and keeps the count in step", () => {
  const r = rival();
  rivalWinsContract(r, { value: 9000 });
  rivalWinsContract(r, { value: 45000 });
  expect(r.jobBook).toEqual([9000, 45000]);
  expect(r.activeJobs).toBe(2);
});

test("a $9,000 fence is worth at most its margin to a rival, not ~$100,000", () => {
  const r = rival({ employees: 1 });
  rivalWinsContract(r, { value: 9000 });
  let earned = 0;
  for (let d = 0; d < 60 && r.jobBook.length; d++) earned += settleRivalDay(r).income;
  expect(earned).toBeGreaterThan(0);
  expect(earned).toBeLessThanOrEqual(Math.round(9000 * RIVAL_MARGIN_MAX));
});

test("overhead is paid every day, work or not", () => {
  const r = rival({ cash: 10000, employees: 5 });
  const out = settleRivalDay(r, () => 0.99);
  expect(out.income).toBe(0);
  expect(r.cash).toBe(10000 - (RIVAL_OVERHEAD_BASE + 5 * RIVAL_OVERHEAD_PER_EMPLOYEE));
});

test("a job finishes and pays once", () => {
  const r = rival({ employees: 1 });
  rivalWinsContract(r, { value: 100000 });
  const out = settleRivalDay(r, () => 0.01); // finishes; minimum margin
  expect(out.completed).toBe(1);
  expect(out.income).toBeGreaterThanOrEqual(22000);
  expect(r.jobBook).toEqual([]);
  expect(settleRivalDay(r, () => 0.01).income).toBe(0);
});

test("a save from before job books gets one entry per open job", () => {
  const r = ensureJobBook(rival({ activeJobs: 3 }), 20000);
  expect(r.jobBook).toEqual([20000, 20000, 20000]);
  expect(r.activeJobs).toBe(3);
  ensureJobBook(r, 99);
  expect(r.jobBook).toEqual([20000, 20000, 20000]); // never rebuilt once present
});
