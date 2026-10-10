// Hiring and the 50-day raise (review sprint, P1).
//
// Found in a live playtest of build 14: every applicant from Crew > Post Job Ads asked $18–45/day
// against a market rate of $126–227, so each hire started "Badly underpaid", bled morale and
// quit. And every brand-new company's crew got a 10% raise "for 50 days of loyalty" on day 1–2,
// because the milestone read the loyalty score, not the days employed.
import {
  freshState, migrateState, createApplicant, hireWageFor, checkWorkerTurnover,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import {
  marketRateFor, payPosition, applicantAskingWage, isMispricedWage, WAGE_FLOOR, APPLICANT_ASK,
} from "../src/systems/crewPayroll.js";

describe("applicant asking wage", () => {
  test("every ad tier asks at or above the applicant's market rate", () => {
    for (const tierId of Object.keys(APPLICANT_ASK)) {
      for (let i = 0; i < 200; i++) {
        const a = createApplicant({ skillMin: 75, skillMax: 130, tierId });
        expect(a.desiredWage).toBeGreaterThanOrEqual(WAGE_FLOOR);
        expect(a.desiredWage / marketRateFor(a)).toBeGreaterThanOrEqual(APPLICANT_ASK[tierId][0] - 0.01);
      }
    }
  });

  test("a new hire is never below market on the day they start", () => {
    const g = freshState();
    for (let i = 0; i < 200; i++) {
      const a = createApplicant({ skillMin: 75, skillMax: 130, tierId: "basic" });
      const w = { role: a.role, skill: a.skill, certifications: [], wagePerDay: hireWageFor(a, g) };
      expect(["fair", "generous"]).toContain(payPosition(w).key);
    }
  });

  test("premium ads ask more than basic ones for the same person", () => {
    const person = { role: "Carpenter", skill: 100 };
    expect(applicantAskingWage(person, "premium", () => 0.5)).toBeGreaterThan(applicantAskingWage(person, "basic", () => 0.5));
  });

  test("an old-band wage is recognised as mis-priced", () => {
    expect(isMispricedWage(34)).toBe(true);
    expect(isMispricedWage(WAGE_FLOOR)).toBe(false);
    expect(isMispricedWage(220)).toBe(false);
  });
});

describe("save migration", () => {
  test("waiting applicants on old wages are repriced", () => {
    const saved = freshState();
    saved.applicants = [{ id: "a1", name: "Vera Tanaka", role: "Carpenter", skill: 106, desiredWage: 33 }];
    const g = migrateState(JSON.parse(JSON.stringify(saved)));
    expect(g.applicants[0].desiredWage).toBeGreaterThanOrEqual(marketRateFor(g.applicants[0]));
  });

  test("crew hired on a mis-priced wage move to market once, with a notice", () => {
    const saved = freshState();
    saved.crew.push({ ...saved.crew[0], id: "w-bug", name: "Hugo Hassan", role: "Plumber", skill: 90, wagePerDay: 34, underpaidDays: 9 });
    const g = migrateState(JSON.parse(JSON.stringify(saved)));
    const hugo = g.crew.find((w) => w.id === "w-bug");
    expect(hugo.wagePerDay).toBe(marketRateFor(hugo));
    expect(hugo.underpaidDays).toBe(0);
    expect(JSON.stringify(g)).toContain("Pay correction: Hugo Hassan");
    // Fairly paid crew are untouched, and the correction does not run twice.
    expect(g.crew[0].wagePerDay).toBe(saved.crew[0].wagePerDay);
    const again = migrateState(JSON.parse(JSON.stringify({ ...g, crew: [...g.crew, { ...hugo, id: "w2", wagePerDay: 40 }] })));
    expect(again.crew.find((w) => w.id === "w2").wagePerDay).toBe(40);
  });

  test("a fresh company needs no correction", () => {
    const g = migrateState(JSON.parse(JSON.stringify(freshState())));
    expect(JSON.stringify(g)).not.toContain("Pay correction");
  });
});

describe("the 50-day raise", () => {
  const realRandom = Math.random;
  afterEach(() => { Math.random = realRandom; });

  function runDays(g, days) {
    Math.random = () => 0.99; // no random quits or drama; only the milestone logic is under test
    for (let i = 0; i < days; i++) { g.day += 1; checkWorkerTurnover(g); }
  }

  test("starting crew get no raise in the first days of a new company", () => {
    const g = freshState();
    g.crew.forEach((w) => { w.loyalty = 80; w.status = "Idle"; });
    const before = g.crew.map((w) => w.wagePerDay);
    runDays(g, 10);
    expect(g.crew.map((w) => w.wagePerDay)).toEqual(before);
    expect(JSON.stringify(g.logs || [])).not.toContain("loyal for 50 days");
  });

  test("the raise arrives once a worker has really been on the books 50 days", () => {
    const g = freshState();
    g.cash = 1e6;
    g.crew.forEach((w) => { w.loyalty = 80; w.status = "Idle"; w.hireDay = 0; });
    const before = g.crew[0].wagePerDay;
    g.day = 49;
    runDays(g, 1);
    expect(g.crew[0].wagePerDay).toBe(before + Math.round(before * 0.1));
    expect(g.crew[0]._loyalty50Done).toBe(true);
  });

  test("someone hired on day 40 waits until day 90", () => {
    const g = freshState();
    g.cash = 1e6;
    const w = g.crew[0];
    w.loyalty = 80; w.status = "Idle"; w.hireDay = 40;
    g.day = 60;
    runDays(g, 20);
    expect(w._loyalty50Done).toBeFalsy();
    runDays(g, 10);
    expect(w._loyalty50Done).toBe(true);
  });
});
