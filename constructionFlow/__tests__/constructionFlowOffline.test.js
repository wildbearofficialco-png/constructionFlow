import { freshState, computeOfflineProgress, applyOfflineProgress } from "../src/games/constructionflow/ConstructionFlowScreen";

describe("Construction Flow offline progression", () => {
  test("returns null without a prior timestamp", () => {
    const state = freshState();
    state.lastRealTimestamp = null;
    expect(computeOfflineProgress(state, Date.now())).toBeNull();
  });

  test("does not produce negative time when saved timestamp is in the future", () => {
    const state = freshState();
    const now = Date.now();
    state.lastRealTimestamp = now + 10000;
    expect(computeOfflineProgress(state, now)).toBeNull();
  });

  test("caps long catch-up simulation to 480 ticks", () => {
    const state = freshState();
    const next = applyOfflineProgress(state, 100000);
    expect(next.day).toBe(state.day + 10);
  });

  test("long catch-up keeps core numeric state finite", () => {
    const state = freshState();
    const next = applyOfflineProgress(state, 480);
    expect(Number.isFinite(next.cash)).toBe(true);
    expect(Number.isFinite(next.day)).toBe(true);
    expect(next.day).toBeGreaterThanOrEqual(state.day);
  });

  test("cash never passes the hard debt floor during catch-up", () => {
    const state = freshState();
    state.cash = 5000;
    state.crew = Array.from({ length: 40 }, (_, i) => ({
      id: `w${i}`, name: `Worker ${i}`, role: "Labourer", wagePerDay: 600, onShift: true,
      status: "Idle", skill: 80, stamina: 100, mood: 70, loyalty: 60, jobsCompleted: 0,
      trait: null, specialty: "General", certifications: [],
    }));
    const next = applyOfflineProgress(state, 480);
    expect(Number.isFinite(next.cash)).toBe(true);
    expect(next.cash).toBeGreaterThanOrEqual(-50000);
  });

  test("does not mutate the original saved state", () => {
    const state = freshState();
    const originalCash = state.cash;
    const originalDay = state.day;
    applyOfflineProgress(state, 100);
    expect(state.cash).toBe(originalCash);
    expect(state.day).toBe(originalDay);
  });
});
