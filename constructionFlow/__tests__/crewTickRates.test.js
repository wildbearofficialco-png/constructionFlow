import {
  RUSH_STAMINA_HITS_PER_DAY,
  RUSH_STAMINA_PER_HIT,
  SKILL_GAIN_EVENTS_PER_DAY,
  rushStaminaChancePerTick,
  skillGainChancePerTick,
  expectedRushStaminaDrainPerDay,
  expectedSkillGainPerDay,
} from "../src/systems/crewTickRates.js";

describe("crew rates do not drift when tick length changes", () => {
  test.each([16, 24, 32, 48, 96, 144])("rush stamina keeps the same daily expectation at %i ticks/day", (ticks) => {
    expect(rushStaminaChancePerTick(ticks)).toBeCloseTo(RUSH_STAMINA_HITS_PER_DAY / ticks, 10);
    expect(expectedRushStaminaDrainPerDay(ticks)).toBeCloseTo(
      RUSH_STAMINA_HITS_PER_DAY * RUSH_STAMINA_PER_HIT,
      10
    );
  });

  test.each([16, 24, 32, 48, 96, 144])("skill progression keeps the same daily expectation at %i ticks/day", (ticks) => {
    expect(skillGainChancePerTick(ticks)).toBeCloseTo(SKILL_GAIN_EVENTS_PER_DAY / ticks, 10);
    expect(expectedSkillGainPerDay(ticks)).toBeCloseTo(SKILL_GAIN_EVENTS_PER_DAY, 10);
  });

  test("current 32-tick clock preserves the pre-fix feel rather than silently retuning", () => {
    expect(rushStaminaChancePerTick(32)).toBeCloseTo(0.25, 10);
    expect(skillGainChancePerTick(32)).toBeCloseTo(0.05, 10);
  });
});
