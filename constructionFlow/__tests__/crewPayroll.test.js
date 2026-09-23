// Payroll.
//
// Sprint 13, from the device: "I should be able to determine how much people are paid."
//
// You could not — the whole control was ±10% buttons. And the deeper defect was that the
// consequence had no memory: a wage cut cost 15 loyalty on the day it happened and nothing
// ever again, so cutting everyone's pay and eating one hit was strictly optimal. Nobody left,
// because nothing was still tracking it tomorrow.

import {
  MARKET_RATES,
  DEFAULT_MARKET_RATE,
  WAGE_FLOOR,
  WAGE_CEILING,
  QUIT_GRACE_DAYS,
  MAX_QUIT_RISK,
  SEVERANCE_DAYS,
  baseRateFor,
  marketRateFor,
  payRatio,
  payPosition,
  previewWage,
  setWage,
  accrueUnderpayment,
  quitRisk,
  payrollSummary,
  planBulkHire,
  planBulkFire,
} from "../src/systems/crewPayroll.js";

const w = (over = {}) => ({
  id: "w1", name: "Sam", role: "Carpenter", skill: 90, wagePerDay: 215,
  loyalty: 50, mood: 70, certifications: [], ...over,
});

describe("what the job is worth", () => {
  test("every role the game hires for has a rate", () => {
    for (const role of ["Labourer", "Carpenter", "Electrician", "Plumber", "Concreter", "Steelworker",
                        "Site Foreman", "Safety Officer", "Project Manager", "Estimator"]) {
      expect({ role, rate: typeof MARKET_RATES[role] }).toEqual({ role, rate: "number" });
    }
  });

  test("licensed trades pay more than general labour", () => {
    expect(baseRateFor("Electrician")).toBeGreaterThan(baseRateFor("Labourer"));
    expect(baseRateFor("Project Manager")).toBeGreaterThan(baseRateFor("Carpenter"));
  });

  test("an unknown role still has a rate rather than zero", () => {
    // A zero market rate would make every wage look infinitely generous.
    expect(baseRateFor("Drone Pilot")).toBe(DEFAULT_MARKET_RATE);
    expect(marketRateFor({ role: "Drone Pilot", skill: 90 })).toBeGreaterThan(0);
  });

  test("skill moves the rate", () => {
    expect(marketRateFor(w({ skill: 120 }))).toBeGreaterThan(marketRateFor(w({ skill: 70 })));
  });

  test("tickets move it too", () => {
    expect(marketRateFor(w({ certifications: ["equipment_cert", "safety_cert"] })))
      .toBeGreaterThan(marketRateFor(w({ certifications: [] })));
  });

  test("a wretched worker is still worth the floor, not nothing", () => {
    expect(marketRateFor(w({ skill: 1, role: "Labourer" }))).toBeGreaterThanOrEqual(WAGE_FLOOR);
  });

  test("missing fields never produce NaN", () => {
    expect(Number.isFinite(marketRateFor({}))).toBe(true);
    expect(Number.isFinite(marketRateFor(null))).toBe(true);
    expect(Number.isFinite(payRatio({}))).toBe(true);
  });
});

describe("a wage can finally be read", () => {
  test("paying the market rate reads as fair", () => {
    const x = w();
    x.wagePerDay = marketRateFor(x);
    expect(payPosition(x).key).toBe("fair");
  });

  test("paying well over reads as generous", () => {
    const x = w();
    x.wagePerDay = Math.round(marketRateFor(x) * 1.4);
    expect(payPosition(x).key).toBe("generous");
  });

  test("paying half reads as insulting", () => {
    const x = w();
    x.wagePerDay = Math.round(marketRateFor(x) * 0.5);
    expect(payPosition(x).key).toBe("insulting");
  });

  test("the bands are ordered and the labels are distinct", () => {
    const x = w();
    const m = marketRateFor(x);
    const keys = [0.5, 0.85, 1.0, 1.5].map((r) => payPosition({ ...x, wagePerDay: Math.round(m * r) }).key);
    expect(keys).toEqual(["insulting", "under", "fair", "generous"]);
  });
});

describe("setting an exact number", () => {
  test("the wage becomes what was asked for", () => {
    const x = w();
    setWage(x, 300);
    expect(x.wagePerDay).toBe(300);
  });

  test("below the floor is clamped, and says so", () => {
    const p = previewWage(w(), 1);
    expect(p.applied).toBe(WAGE_FLOOR);
    expect(p.clamped).toBe(true);
  });

  test("above the ceiling is clamped too", () => {
    expect(previewWage(w(), 99999).applied).toBe(WAGE_CEILING);
  });

  test("preview does not mutate — it is a preview", () => {
    const x = w();
    const before = { ...x };
    previewWage(x, 900);
    expect(x).toEqual(before);
  });

  test("a raise lifts loyalty and mood, a cut lowers them", () => {
    const up = w(); setWage(up, 400);
    expect(up.loyalty).toBeGreaterThan(50);
    expect(up.mood).toBeGreaterThan(70);

    const down = w(); setWage(down, 120);
    expect(down.loyalty).toBeLessThan(50);
    expect(down.mood).toBeLessThan(70);
  });

  test("the reaction scales with the size of the cut, not a flat number", () => {
    // A $10 cut to a $400 wage is a rounding error; the same cut to a $100 wage is an insult.
    const small = w({ wagePerDay: 400 }); setWage(small, 390);
    const large = w({ wagePerDay: 400 }); setWage(large, 200);
    expect(large.loyalty).toBeLessThan(small.loyalty);
  });

  test("loyalty and mood stay inside 0..100", () => {
    const x = w({ loyalty: 98, mood: 99 });
    setWage(x, 1800);
    expect(x.loyalty).toBeLessThanOrEqual(100);
    expect(x.mood).toBeLessThanOrEqual(100);

    const y = w({ loyalty: 2, mood: 1 });
    setWage(y, WAGE_FLOOR);
    expect(y.loyalty).toBeGreaterThanOrEqual(0);
    expect(y.mood).toBeGreaterThanOrEqual(0);
  });

  test("paying up to market clears the grudge", () => {
    const x = w({ wagePerDay: 100, underpaidDays: 20 });
    setWage(x, marketRateFor(x));
    expect(x.underpaidDays).toBe(0);
  });

  test("setting a wage on nothing does not throw", () => {
    expect(() => setWage(null, 100)).not.toThrow();
  });
});

describe("underpayment has a memory now", () => {
  test("it accrues day after day", () => {
    const x = w({ wagePerDay: 100 });
    for (let i = 0; i < 10; i++) accrueUnderpayment(x);
    expect(x.underpaidDays).toBe(10);
  });

  test("a fair wage never accrues anything", () => {
    const x = w();
    x.wagePerDay = marketRateFor(x);
    for (let i = 0; i < 30; i++) accrueUnderpayment(x);
    expect(x.underpaidDays || 0).toBe(0);
    expect(quitRisk(x)).toBe(0);
  });

  test("being badly underpaid bleeds morale visibly before anyone walks", () => {
    const x = w({ wagePerDay: 90, mood: 80, loyalty: 80 });
    for (let i = 0; i < 10; i++) accrueUnderpayment(x);
    expect(x.mood).toBeLessThan(80);
    expect(x.loyalty).toBeLessThan(80);
  });

  test("paying properly again heals it, more slowly than it accrued", () => {
    const x = w({ wagePerDay: 100 });
    for (let i = 0; i < 10; i++) accrueUnderpayment(x);
    const peak = x.underpaidDays;
    x.wagePerDay = marketRateFor(x) * 1.2;
    for (let i = 0; i < 10; i++) accrueUnderpayment(x);
    expect(x.underpaidDays).toBeLessThan(peak);
    expect(x.underpaidDays).toBeGreaterThan(0);
  });

  test("the old exploit is closed", () => {
    // Cut everyone's pay, eat one loyalty hit, bank the savings forever. Under the old system
    // nothing tracked it the next day. Now it does, and it ends in people leaving.
    const x = w({ wagePerDay: 90 });
    setWage(x, 90);
    for (let i = 0; i < 40; i++) accrueUnderpayment(x);
    expect(quitRisk(x)).toBeGreaterThan(0);
  });
});

describe("people leave", () => {
  test("nobody walks inside the grace period", () => {
    // A brief squeeze during a cash crisis has to be survivable — that is the decision the
    // player is supposed to get to make.
    const x = w({ wagePerDay: 90 });
    for (let i = 0; i < QUIT_GRACE_DAYS; i++) accrueUnderpayment(x);
    expect(quitRisk(x)).toBe(0);
  });

  test("risk grows the longer it goes on", () => {
    const x = w({ wagePerDay: 90 });
    for (let i = 0; i < QUIT_GRACE_DAYS + 2; i++) accrueUnderpayment(x);
    const early = quitRisk(x);
    for (let i = 0; i < 10; i++) accrueUnderpayment(x);
    expect(quitRisk(x)).toBeGreaterThan(early);
  });

  test("and is capped, so it is never a certainty", () => {
    const x = w({ wagePerDay: 90, loyalty: 0 });
    for (let i = 0; i < 500; i++) accrueUnderpayment(x);
    expect(quitRisk(x)).toBeLessThanOrEqual(MAX_QUIT_RISK);
  });

  test("loyalty earned elsewhere buys patience", () => {
    const loyal = w({ wagePerDay: 90, loyalty: 95 });
    const sour = w({ wagePerDay: 90, loyalty: 5 });
    for (let i = 0; i < 20; i++) { accrueUnderpayment(loyal); accrueUnderpayment(sour); }
    expect(quitRisk(loyal)).toBeLessThan(quitRisk(sour));
  });

  test("a well-paid worker is never at risk however long they stay", () => {
    const x = w({ underpaidDays: 900 });
    x.wagePerDay = marketRateFor(x) * 2;
    expect(quitRisk(x)).toBe(0);
  });
});

describe("the whole payroll at a glance", () => {
  test("it totals crew and office together", () => {
    const s = payrollSummary({ crew: [w({ wagePerDay: 200 }), w({ wagePerDay: 300 })], officeStaff: [w({ role: "Estimator", wagePerDay: 100 })] });
    expect(s.headcount).toBe(3);
    expect(s.daily).toBe(600);
    expect(s.weekly).toBe(4200);
  });

  test("it says whether you are under or over the going rate", () => {
    const cheap = payrollSummary({ crew: [w({ wagePerDay: 90 })], officeStaff: [] });
    expect(cheap.versusMarket).toBeLessThan(0);
    const rich = payrollSummary({ crew: [w({ wagePerDay: 900 })], officeStaff: [] });
    expect(rich.versusMarket).toBeGreaterThan(0);
  });

  test("it names how many may walk", () => {
    const x = w({ wagePerDay: 90 });
    for (let i = 0; i < 30; i++) accrueUnderpayment(x);
    expect(payrollSummary({ crew: [x], officeStaff: [] }).atRisk).toBe(1);
  });

  test("an empty company summarises without dividing by zero", () => {
    const s = payrollSummary({ crew: [], officeStaff: [] });
    expect(s).toMatchObject({ headcount: 0, daily: 0, weekly: 0 });
    expect(Number.isFinite(s.versusMarket)).toBe(true);
  });

  test("a missing game does not throw", () => {
    expect(() => payrollSummary(null)).not.toThrow();
  });
});

describe("hiring twenty-five at once", () => {
  const applicants = (n) => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, role: "Labourer", skill: 90, hireCost: 1000 }));

  test("it hires what you asked for when there is room and cash", () => {
    const plan = planBulkHire(applicants(30), 25, { crewCap: 40, currentCrew: 0, cash: 100000 });
    expect(plan.count).toBe(25);
    expect(plan.spend).toBe(25000);
    expect(plan.reason).toBeNull();
  });

  test("the crew cap stops it, and says so", () => {
    const plan = planBulkHire(applicants(30), 25, { crewCap: 10, currentCrew: 6, cash: 100000 });
    expect(plan.count).toBe(4);
    expect(plan.shortOfRoom).toBe(true);
    expect(plan.reason).toContain("crew cap");
  });

  test("cash stops it, and says that instead", () => {
    const plan = planBulkHire(applicants(30), 25, { crewCap: 40, currentCrew: 0, cash: 3500 });
    expect(plan.count).toBe(3);
    expect(plan.reason).toContain("not enough cash");
  });

  test("no room at all explains itself", () => {
    const plan = planBulkHire(applicants(5), 5, { crewCap: 5, currentCrew: 5, cash: 100000 });
    expect(plan.count).toBe(0);
    expect(plan.reason).toContain("expand your office");
  });

  test("asking for none is not an error", () => {
    expect(planBulkHire(applicants(5), 0, { crewCap: 40, currentCrew: 0, cash: 1000 }).count).toBe(0);
  });

  test("it never hires more applicants than exist", () => {
    expect(planBulkHire(applicants(3), 25, { crewCap: 40, currentCrew: 0, cash: 100000 }).count).toBe(3);
  });

  test("nonsense input plans nothing rather than throwing", () => {
    for (const junk of [null, undefined, NaN, -5, "lots"]) {
      expect(planBulkHire(applicants(5), junk, { crewCap: 40, currentCrew: 0, cash: 9999 }).count).toBe(0);
    }
    expect(planBulkHire(null, 5, { crewCap: 40, currentCrew: 0, cash: 9999 }).count).toBe(0);
  });

  test("a custom hire cost is respected", () => {
    const plan = planBulkHire(applicants(10), 10, {
      crewCap: 40, currentCrew: 0, cash: 10000, hireCostFor: () => 2500,
    });
    expect(plan.count).toBe(4);
  });
});

describe("firing them all", () => {
  test("severance is what stops it being free", () => {
    const plan = planBulkFire([w({ wagePerDay: 200 }), w({ wagePerDay: 300 })]);
    expect(plan.count).toBe(2);
    expect(plan.severance).toBe(500 * SEVERANCE_DAYS);
  });

  test("it reports what you would save", () => {
    expect(planBulkFire([w({ wagePerDay: 200 })]).dailySaving).toBe(200);
  });

  test("firing nobody costs nothing", () => {
    expect(planBulkFire([])).toMatchObject({ count: 0, severance: 0, dailySaving: 0 });
    expect(planBulkFire(null).count).toBe(0);
  });
});
