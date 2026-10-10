// Contracts that are the player's by agreement stay the player's (review sprint, P3).
//
// Build-14 playtest: a rival took the Fence Installation the tutorial tells you to accept, while
// the player was still reading it; and "Take the rush job" put a contract on the public board
// that a rival "outbid" the player on the same day.
import {
  freshState, migrateState, enhancedRivalDailyLogic, enhancedRivalBidding, gameTick, DECISION_EVENTS,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { planBid, rollBidOutcome, hasReservedGuarantee } from "../src/systems/constructionLoop.js";
import { ticksPerDay } from "../src/systems/gameClock.js";

const realRandom = Math.random;
afterEach(() => { Math.random = realRandom; });

function aggressive(g) {
  g.rivals = g.rivals.map((r) => ({ ...r, aggression: 1, cash: 5_000_000, rep: 80 }));
}

describe("the tutorial's opening job", () => {
  test("a new company's first contract is reserved and marked as the tutorial job", () => {
    const g = freshState();
    expect(g.contracts[0]).toMatchObject({ defId: "fence", reservedForPlayer: true, tutorialContract: true });
    expect(g.contracts[0].interestedRival).toBeUndefined();
  });

  test("rivals cannot take it, however aggressive", () => {
    const g = { ...freshState(), setupDone: true };
    aggressive(g);
    Math.random = () => 0.001;
    for (let d = 0; d < 20; d++) {
      g.day += 1;
      enhancedRivalDailyLogic(g);
      enhancedRivalBidding(g, g.contracts.filter((c) => c.status === "Open"));
    }
    const tutorial = g.contracts.find((c) => c.tutorialContract);
    expect(tutorial.status).toBe("Open");
    // Proof the rivals were active in this run: public contracts did go.
    expect(g.contracts.some((c) => !c.reservedForPlayer && c.status === "Taken")).toBe(true);
  });

  test("it waits for a player who is still reading, then lapses normally after their first job", () => {
    let g = { ...freshState(), setupDone: true };
    const id = g.contracts[0].id;
    const tpd = ticksPerDay("1x");
    for (let i = 0; i < tpd * 12; i++) { g = gameTick(g); g.pendingDecision = null; }
    expect(g.contracts.find((c) => c.id === id)?.status).toBe("Open");
    g.completedJobs = 1;
    for (let i = 0; i < tpd * 2; i++) { g = gameTick(g); g.pendingDecision = null; }
    expect(g.contracts.find((c) => c.id === id && c.status === "Open")).toBeUndefined();
  });

  test("a save that already lost its tutorial fence gets a reserved one back", () => {
    const saved = freshState();
    saved.contracts = saved.contracts.map((c) => ({ ...c, status: c.defId === "fence" ? "Taken" : c.status, tutorialContract: false, reservedForPlayer: false }));
    const g = migrateState(JSON.parse(JSON.stringify(saved)));
    const held = g.contracts.filter((c) => c.status === "Open" && c.tutorialContract && c.reservedForPlayer);
    expect(held).toHaveLength(1);
    expect(held[0].defId).toBe("fence");
  });

  test("a company past its first job is not given one", () => {
    const saved = { ...freshState(), completedJobs: 2 };
    saved.contracts = saved.contracts.map((c) => ({ ...c, status: "Taken", tutorialContract: false, reservedForPlayer: false }));
    const g = migrateState(JSON.parse(JSON.stringify(saved)));
    expect(g.contracts.some((c) => c.tutorialContract && c.status === "Open")).toBe(false);
  });
});

describe("jobs accepted on a decision card", () => {
  function accept(label) {
    const g = { ...freshState(), setupDone: true, completedJobs: 3 };
    const ev = DECISION_EVENTS.find((e) => (e.options || []).some((o) => o.label === label));
    const before = g.contracts.length;
    ev.options.find((o) => o.label === label).apply(g);
    return { g, added: g.contracts.slice(before) };
  }

  test.each(["Take the rush job", "Take the emergency job"])("%s is reserved and guaranteed", (label) => {
    const { g, added } = accept(label);
    expect(added).toHaveLength(1);
    const c = added[0];
    expect(c.reservedForPlayer).toBe(true);
    expect(hasReservedGuarantee(c)).toBe(true);
    expect(planBid(c, "premium", g).winChance).toBe(1);
    expect(rollBidOutcome(c, "premium", g, () => 0.999).won).toBe(true);
    // ...and rivals leave it alone.
    aggressive(g);
    Math.random = () => 0.001;
    enhancedRivalDailyLogic(g);
    enhancedRivalBidding(g, g.contracts.filter((x) => x.status === "Open"));
    expect(g.contracts.find((x) => x.id === c.id).status).toBe("Open");
    expect(g.contracts.some((x) => !x.reservedForPlayer && x.status === "Taken")).toBe(true);
  });

  test("an ordinary public contract is still contested", () => {
    const g = { ...freshState(), setupDone: true, completedJobs: 3 };
    const publicJob = g.contracts[1];
    expect(publicJob.reservedForPlayer).toBeFalsy();
    expect(planBid(publicJob, "premium", g).winChance).toBeLessThan(1);
  });
});
