// A save that fails to load must never be replaced by a fresh company.
//
// Before this fix, any exception while loading (truncated JSON, a migration throwing on an old
// shape, a gameTick throwing during offline catch-up) started a fresh company, and the ~2s
// autosave wrote it over the player's real save — permanent, silent loss of their company.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ConstructionFlowScreen, {
  freshState,
  migrateState,
  computeOfflineProgress,
  applyOfflineProgress,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import {
  BACKUP_STORAGE_KEY,
  QUARANTINE_STORAGE_KEY,
  chooseSaveToLoad,
  restoreSavedGame,
  runOfflineCatchUp,
} from "../src/systems/saveRecovery.js";

jest.useFakeTimers();
jest.setTimeout(30000);

const STORAGE_KEY = "constructionflow_v1_save";
const deps = { migrateState, computeOfflineProgress, applyOfflineProgress };

function establishedCompany(name = "Keep Me Construction") {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.companyName = name;
  g.cash = 987654;
  g.completedJobs = 42;
  g.lastRealTimestamp = Date.now();
  return g;
}

describe("saveRecovery (pure)", () => {
  const now = Date.now();

  test("a good save loads from the save and is refreshed as the backup", () => {
    const raw = JSON.stringify(establishedCompany());
    const r = chooseSaveToLoad(raw, null, now, deps);
    expect(r.source).toBe("save");
    expect(r.game.cash).toBe(987654);
    expect(r.rawToBackup).toBe(raw);
    expect(r.unreadable).toBeNull();
  });

  test("no save at all is a fresh start with nothing to quarantine", () => {
    const r = chooseSaveToLoad(null, null, now, deps);
    expect(r).toEqual({ game: null, source: "fresh", rawToBackup: null, unreadable: null });
  });

  test("a truncated save falls back to the last good backup", () => {
    const good = JSON.stringify(establishedCompany());
    const truncated = good.slice(0, Math.floor(good.length / 2));
    const r = chooseSaveToLoad(truncated, good, now, deps);
    expect(r.source).toBe("backup");
    expect(r.game.companyName).toBe("Keep Me Construction");
    expect(r.unreadable).toBe(truncated);
    // The bad payload must never become the backup.
    expect(r.rawToBackup).toBeNull();
  });

  test("unreadable save with no backup is quarantined, not discarded", () => {
    const r = chooseSaveToLoad("{not json", null, now, deps);
    expect(r.source).toBe("fresh");
    expect(r.game).toBeNull();
    expect(r.unreadable).toBe("{not json");
  });

  test("a JSON value that is not a game object is rejected", () => {
    for (const raw of ["null", "42", "[]", '"text"']) {
      expect(() => restoreSavedGame(raw, now, deps)).toThrow();
    }
  });

  test("a migration that throws is treated as unreadable", () => {
    const throwingDeps = { ...deps, migrateState: () => { throw new Error("bad shape"); } };
    const r = chooseSaveToLoad(JSON.stringify(establishedCompany()), null, now, throwingDeps);
    expect(r.source).toBe("fresh");
    expect(r.unreadable).not.toBeNull();
  });

  test("offline catch-up that throws keeps the save, un-progressed", () => {
    const saved = migrateState(establishedCompany());
    saved.lastRealTimestamp = now - 60 * 60 * 1000;
    const out = runOfflineCatchUp(saved, now, {
      computeOfflineProgress,
      applyOfflineProgress: () => { throw new Error("tick blew up"); },
    });
    expect(out.cash).toBe(987654);
    expect(out.day).toBe(saved.day);
    expect(out.lastRealTimestamp).toBe(now);
  });

  test("offline catch-up still runs normally when it succeeds", () => {
    const saved = migrateState(establishedCompany());
    saved.lastRealTimestamp = now - 60 * 60 * 1000;
    const out = runOfflineCatchUp(saved, now, deps);
    expect(out.day).toBeGreaterThan(saved.day);
  });
});

describe("saveRecovery (mounted screen)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  async function mountAndAutosave() {
    let tree;
    await act(async () => { tree = TestRenderer.create(<ConstructionFlowScreen />); });
    // Past the 2s throttled autosave that used to overwrite the real save.
    await act(async () => { jest.advanceTimersByTime(2500); });
    await act(async () => { tree.unmount(); });
  }

  test("a corrupt save is restored from backup and the company survives the autosave", async () => {
    const good = JSON.stringify(establishedCompany());
    await AsyncStorage.setItem(BACKUP_STORAGE_KEY, good);
    await AsyncStorage.setItem(STORAGE_KEY, good.slice(0, 200));

    await mountAndAutosave();

    const saved = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY));
    expect(saved.companyName).toBe("Keep Me Construction");
    expect(saved.completedJobs).toBe(42);
    expect(await AsyncStorage.getItem(QUARANTINE_STORAGE_KEY)).toBe(good.slice(0, 200));
  });

  test("a corrupt save with no backup is quarantined before a fresh company is saved", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{\"companyName\":\"Keep Me");

    await mountAndAutosave();

    expect(await AsyncStorage.getItem(QUARANTINE_STORAGE_KEY)).toBe("{\"companyName\":\"Keep Me");
  });

  test("a good save loads and becomes the backup", async () => {
    const good = JSON.stringify(establishedCompany());
    await AsyncStorage.setItem(STORAGE_KEY, good);

    await mountAndAutosave();

    expect(await AsyncStorage.getItem(BACKUP_STORAGE_KEY)).toBe(good);
    const saved = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY));
    expect(saved.companyName).toBe("Keep Me Construction");
  });
});
