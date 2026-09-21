// Company-perk contract tests.
//
// The Phase 5 finding was not that progression content was missing — there are five office
// tiers, nine cities, five regional office types and four property types. It was that the
// ladder SOLD PERKS IT DID NOT DELIVER. Four of the six office perks were read by nothing.
// `contractSlots` was advertised up to "+80" on a $1.5M building and consumed nowhere.
// `eliminatesRent` was the entire pitch of a $120,000 property and never checked.
//
// So the most important test in this file is not any single perk's arithmetic. It is the
// guard that walks the data tables and fails if a declared perk goes unclaimed — the same
// shape as Phase 4's ledger-category guard, and for the same reason.

import {
  OFFICES,
  REGIONAL_OFFICE_TYPES,
  PROPERTY_TYPES,
} from "../src/systems/companyPerkTables.js";

import {
  PERK_KEYS,
  MAX_BID_BONUS,
  MAX_PENALTY_REDUCTION,
  MAX_MATERIAL_DISCOUNT,
  BASE_CONTRACT_FLOOR,
  BASE_CONTRACT_CAP,
  MAX_CONTRACT_SLOTS,
  resolveCompanyPerks,
  contractBoardSize,
  dailyOfficeRent,
  describePerkSources,
  nextOfficeUpgrade,
} from "../src/systems/companyPerks.js";

const game = (over = {}) => ({ officeIndex: 0, cityOffices: [], properties: [], cash: 0, ...over });
const regional = (typeId, id = typeId) => ({ id, typeId, cityId: "portland", openedDay: 1 });
const property = (typeId, id = typeId) => ({ id, typeId, purchasedDay: 1 });

describe("EVERY ADVERTISED PERK IS DELIVERED", () => {
  // This is the test the whole module exists for.

  test("every office perk key is resolved into a real number", () => {
    const declared = new Set();
    for (const office of OFFICES) {
      for (const perk of office.perks || []) declared.add(perk.key);
    }
    expect(declared.size).toBeGreaterThan(0);
    for (const key of declared) {
      expect(PERK_KEYS).toContain(key);
      // And owning the office that grants it actually moves that number.
      const grantingIndex = OFFICES.findIndex((o) => (o.perks || []).some((p) => p.key === key));
      const without = resolveCompanyPerks(game({ officeIndex: 0 }));
      const withIt = resolveCompanyPerks(game({ officeIndex: grantingIndex }));
      expect(withIt[key]).toBeGreaterThan(without[key] || 0);
    }
  });

  test("every numeric perk a regional office declares is resolved", () => {
    for (const def of REGIONAL_OFFICE_TYPES) {
      const base = resolveCompanyPerks(game());
      const owned = resolveCompanyPerks(game({ cityOffices: [regional(def.id)] }));
      if (def.crewBonus > 0) expect(owned.crewCap).toBeGreaterThan(base.crewCap);
      if (def.contractSlots > 0) expect(owned.contractSlots).toBeGreaterThan(base.contractSlots);
    }
  });

  test("every perk a property declares is resolved", () => {
    for (const def of PROPERTY_TYPES) {
      const base = resolveCompanyPerks(game());
      const owned = resolveCompanyPerks(game({ properties: [property(def.id)] }));
      if (def.equipCapBonus > 0) expect(owned.equipCap).toBeGreaterThan(base.equipCap);
      if (def.crewCapBonus > 0) expect(owned.crewCap).toBeGreaterThan(base.crewCap);
      if (def.materialDiscount > 0) expect(owned.materialDiscount).toBeGreaterThan(base.materialDiscount);
      if (def.eliminatesRent) expect(owned.rentEliminated).toBe(true);
      if (def.weeklyIncome > 0) expect(owned.weeklyPropertyIncome).toBeGreaterThan(base.weeklyPropertyIncome);
    }
  });

  test("no perk key is resolved that no table declares", () => {
    // The other direction: a key here with nothing granting it is dead weight.
    const declared = new Set();
    for (const o of OFFICES) for (const p of o.perks || []) declared.add(p.key);
    for (const r of REGIONAL_OFFICE_TYPES) {
      if (r.crewBonus) declared.add("crewCap");
      if (r.contractSlots) declared.add("contractSlots");
    }
    for (const p of PROPERTY_TYPES) {
      if (p.equipCapBonus) declared.add("equipCap");
      if (p.crewCapBonus) declared.add("crewCap");
      if (p.materialDiscount) declared.add("materialDiscount");
      if (p.eliminatesRent) declared.add("rentEliminated");
      if (p.weeklyIncome) declared.add("weeklyPropertyIncome");
    }
    // crewCap and equipCap come from the office tier itself even with nothing else owned.
    declared.add("crewCap");
    declared.add("equipCap");
    for (const key of PERK_KEYS) expect([...declared]).toContain(key);
  });

  test("every perk label on a buy button describes something that happens", () => {
    // A label is a promise the player pays money for.
    for (const office of OFFICES) {
      for (const perk of office.perks || []) {
        expect(typeof perk.label).toBe("string");
        expect(perk.label.length).toBeGreaterThan(0);
        expect(Number.isFinite(perk.value)).toBe(true);
        expect(perk.value).toBeGreaterThan(0);
      }
    }
  });
});

describe("the office ladder", () => {
  test("bid bonus rises with the office and is capped", () => {
    expect(resolveCompanyPerks(game({ officeIndex: 0 })).bidBonus).toBe(0);
    expect(resolveCompanyPerks(game({ officeIndex: 1 })).bidBonus).toBeCloseTo(0.05);
    expect(resolveCompanyPerks(game({ officeIndex: 4 })).bidBonus).toBeCloseTo(0.12);
    for (let i = 0; i < OFFICES.length; i++) {
      expect(resolveCompanyPerks(game({ officeIndex: i })).bidBonus).toBeLessThanOrEqual(MAX_BID_BONUS);
    }
  });

  test("penalty reduction rises with the office and is capped", () => {
    expect(resolveCompanyPerks(game({ officeIndex: 0 })).penaltyReduction).toBe(0);
    expect(resolveCompanyPerks(game({ officeIndex: 2 })).penaltyReduction).toBeCloseTo(0.10);
    expect(resolveCompanyPerks(game({ officeIndex: 3 })).penaltyReduction).toBeCloseTo(0.15);
    for (let i = 0; i < OFFICES.length; i++) {
      expect(resolveCompanyPerks(game({ officeIndex: i })).penaltyReduction).toBeLessThanOrEqual(MAX_PENALTY_REDUCTION);
    }
  });

  test("a maxed-out company is strong, never immune", () => {
    const maxed = game({
      officeIndex: 4,
      cityOffices: REGIONAL_OFFICE_TYPES.map((d, i) => regional(d.id, `r${i}`)),
      properties: PROPERTY_TYPES.map((d, i) => property(d.id, `p${i}`)),
    });
    const perks = resolveCompanyPerks(maxed);
    expect(perks.bidBonus).toBeLessThanOrEqual(MAX_BID_BONUS);
    expect(perks.penaltyReduction).toBeLessThanOrEqual(MAX_PENALTY_REDUCTION);
    expect(perks.materialDiscount).toBeLessThanOrEqual(MAX_MATERIAL_DISCOUNT);
    expect(perks.contractSlots).toBeLessThanOrEqual(MAX_CONTRACT_SLOTS);
    // Still has to pay somebody for something.
    expect(perks.materialDiscount).toBeLessThan(1);
  });

  test("capacity grows across the whole ladder", () => {
    for (let i = 1; i < OFFICES.length; i++) {
      expect(resolveCompanyPerks(game({ officeIndex: i })).crewCap)
        .toBeGreaterThan(resolveCompanyPerks(game({ officeIndex: i - 1 })).crewCap);
      expect(resolveCompanyPerks(game({ officeIndex: i })).equipCap)
        .toBeGreaterThan(resolveCompanyPerks(game({ officeIndex: i - 1 })).equipCap);
    }
  });
});

describe("crew and machine capacity", () => {
  test("regional offices add crew space on top of the home office", () => {
    const base = resolveCompanyPerks(game({ officeIndex: 2 })).crewCap;
    const withOffice = resolveCompanyPerks(game({ officeIndex: 2, cityOffices: [regional("regional_office")] })).crewCap;
    expect(withOffice).toBe(base + 15);
  });

  test("an office property houses crew — the bonus that used to be computed and dropped", () => {
    // `getTotalCrewCap` summed a property bonus into a local and then returned without it.
    const base = resolveCompanyPerks(game()).crewCap;
    const withProperty = resolveCompanyPerks(game({ properties: [property("office_property")] })).crewCap;
    expect(withProperty).toBeGreaterThan(base);
  });

  test("an equipment yard adds machine space, not crew space", () => {
    const withYard = resolveCompanyPerks(game({ properties: [property("equipment_yard")] }));
    const base = resolveCompanyPerks(game());
    expect(withYard.equipCap).toBe(base.equipCap + 5);
    expect(withYard.crewCap).toBe(base.crewCap);
  });

  test("several of the same property stack", () => {
    const two = resolveCompanyPerks(game({ properties: [property("equipment_yard", "a"), property("equipment_yard", "b")] }));
    expect(two.equipCap).toBe(resolveCompanyPerks(game()).equipCap + 10);
  });
});

describe("the contract board", () => {
  test("a company with no regional offices gets the base board", () => {
    expect(contractBoardSize(game())).toEqual({ floor: BASE_CONTRACT_FLOOR, cap: BASE_CONTRACT_CAP });
  });

  test("regional offices widen the board — the perk that did nothing", () => {
    const withHq = contractBoardSize(game({ cityOffices: [regional("national_hq")] }));
    expect(withHq.floor).toBeGreaterThan(BASE_CONTRACT_FLOOR);
    expect(withHq.cap).toBeGreaterThan(BASE_CONTRACT_CAP);
    expect(withHq.cap - withHq.floor).toBe(BASE_CONTRACT_CAP - BASE_CONTRACT_FLOOR);
  });

  test("the board never becomes unreadable, however much you own", () => {
    const everything = game({ cityOffices: REGIONAL_OFFICE_TYPES.flatMap((d, i) => [regional(d.id, `a${i}`), regional(d.id, `b${i}`)]) });
    const board = contractBoardSize(everything);
    expect(board.cap).toBeLessThanOrEqual(BASE_CONTRACT_CAP + MAX_CONTRACT_SLOTS);
  });

  test("the advertised slot numbers are ones the game can actually deliver", () => {
    // They used to read up to "+80", which would put eighty contracts on the board.
    for (const def of REGIONAL_OFFICE_TYPES) {
      expect(def.contractSlots).toBeGreaterThan(0);
      expect(def.contractSlots).toBeLessThanOrEqual(MAX_CONTRACT_SLOTS);
    }
  });
});

describe("office rent", () => {
  test("rent is charged normally without an office property", () => {
    expect(dailyOfficeRent(game({ officeIndex: 4 }))).toBe(OFFICES[4].dailyRent);
  });

  test("owning your office eliminates rent — the $120,000 promise that was never kept", () => {
    const owned = game({ officeIndex: 4, properties: [property("office_property")] });
    expect(dailyOfficeRent(owned)).toBe(0);
    expect(resolveCompanyPerks(owned).rentEliminated).toBe(true);
  });

  test("other properties do not eliminate rent", () => {
    for (const id of ["equipment_yard", "storage_lot", "material_warehouse"]) {
      expect(dailyOfficeRent(game({ officeIndex: 4, properties: [property(id)] }))).toBe(OFFICES[4].dailyRent);
    }
  });

  test("the saving is worth what the property costs", () => {
    // A sanity check on the balance: at the top office the property pays for itself in a
    // reasonable time, rather than being a trap.
    const annualSaving = OFFICES[4].dailyRent * 365;
    const cost = PROPERTY_TYPES.find((p) => p.id === "office_property").cost;
    expect(annualSaving).toBeGreaterThan(cost * 0.5);
  });
});

describe("where your perks come from", () => {
  test("each building owned is listed with what it gives", () => {
    const sources = describePerkSources(game({
      officeIndex: 3,
      cityOffices: [regional("regional_office")],
      properties: [property("equipment_yard"), property("office_property")],
    }));
    expect(sources).toHaveLength(4);
    for (const s of sources) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(Array.isArray(s.effects)).toBe(true);
      for (const e of s.effects) {
        expect(typeof e).toBe("string");
        expect(e).not.toContain("undefined");
        expect(e).not.toContain("NaN");
      }
    }
  });

  test("a brand-new company still lists its starting shed", () => {
    const sources = describePerkSources(game());
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].kind).toBe("office");
  });

  test("an unknown building id is skipped rather than rendered as undefined", () => {
    const sources = describePerkSources(game({
      cityOffices: [regional("does_not_exist")],
      properties: [property("also_fake")],
    }));
    expect(sources.every((s) => s.name && !s.name.includes("undefined"))).toBe(true);
  });
});

describe("the next rung on the ladder", () => {
  test("names what it costs and what it actually gives", () => {
    const next = nextOfficeUpgrade(game({ officeIndex: 0, cash: 100000 }));
    expect(next.name).toBe(OFFICES[1].name);
    expect(next.cost).toBe(OFFICES[1].cost);
    expect(next.affordable).toBe(true);
    expect(next.gains.length).toBeGreaterThan(0);
    expect(next.gains.join(" ")).toContain("crew");
  });

  test("an unaffordable upgrade says how short you are, not just 'no'", () => {
    const next = nextOfficeUpgrade(game({ officeIndex: 3, cash: 10000 }));
    expect(next.affordable).toBe(false);
    expect(next.shortfall).toBe(OFFICES[4].cost - 10000);
  });

  test("it names the rent increase, because that is the real cost of moving up", () => {
    const next = nextOfficeUpgrade(game({ officeIndex: 0 }));
    expect(next.rentIncrease).toBe(OFFICES[1].dailyRent - OFFICES[0].dailyRent);
    expect(next.rentIncrease).toBeGreaterThan(0);
  });

  test("the top of the ladder returns null, so the screen can say so", () => {
    expect(nextOfficeUpgrade(game({ officeIndex: OFFICES.length - 1 }))).toBeNull();
  });
});

describe("garbage never reaches the player", () => {
  test("every resolved perk is a usable value for any input", () => {
    for (const bad of [undefined, null, {}, { officeIndex: 99 }, { officeIndex: -5 },
      { cityOffices: null, properties: "nope" }, { properties: [null, "x"] }]) {
      const perks = resolveCompanyPerks(bad);
      for (const key of PERK_KEYS) {
        if (key === "rentEliminated") {
          expect(typeof perks[key]).toBe("boolean");
        } else {
          expect(Number.isFinite(perks[key])).toBe(true);
          expect(perks[key]).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test("the derived helpers survive the same garbage", () => {
    for (const bad of [undefined, null, {}, { officeIndex: 99 }]) {
      expect(Number.isFinite(dailyOfficeRent(bad))).toBe(true);
      const board = contractBoardSize(bad);
      expect(Number.isFinite(board.floor)).toBe(true);
      expect(board.cap).toBeGreaterThanOrEqual(board.floor);
      expect(() => describePerkSources(bad)).not.toThrow();
      expect(() => nextOfficeUpgrade(bad)).not.toThrow();
    }
  });
});
