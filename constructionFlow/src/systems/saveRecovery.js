// Save loading that can never cost the player their company.
//
// Before this, any exception while loading — a truncated JSON write, a migration that throws on
// an unexpected old shape, or a gameTick that throws during offline catch-up — fell to a catch
// that started a fresh company. The ~2s autosave then wrote that empty company over the real
// save, so one bad load silently and permanently erased the player's progress. FleetFlow hit the
// same defect and fixed it in build 43 with a pre-migration backup; this is the same pattern.
//
// Pure apart from the injected game functions, so it is testable without React or storage.

export const BACKUP_STORAGE_KEY = "constructionflow_v1_backup";
export const QUARANTINE_STORAGE_KEY = "constructionflow_v1_unreadable";

// Parses and migrates one raw payload. Throws if the payload cannot become a game.
// Offline catch-up is attempted separately: if it throws, the player gets their save back
// without the catch-up rather than losing the save over it.
export function restoreSavedGame(raw, nowTs, { migrateState, computeOfflineProgress, applyOfflineProgress }) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Save payload is not a game object");
  }
  const saved = migrateState(parsed);
  return runOfflineCatchUp(saved, nowTs, { computeOfflineProgress, applyOfflineProgress });
}

// Runs offline catch-up, falling back to the un-progressed state if the simulation throws.
export function runOfflineCatchUp(saved, nowTs, { computeOfflineProgress, applyOfflineProgress }) {
  try {
    const offlineInfo = computeOfflineProgress(saved, nowTs);
    if (offlineInfo && offlineInfo.ticksToRun > 0) {
      return applyOfflineProgress(saved, offlineInfo.ticksToRun);
    }
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("[ConstructionFlow] offline catch-up failed (skipped):", e);
  }
  return { ...saved, lastRealTimestamp: nowTs };
}

// Decides what to load from the primary save and the last known-good backup.
// Returns { game, source, rawToBackup } where source is "save", "backup" or "fresh".
// game is null for "fresh" (the caller builds a new company); unreadable is the primary payload
// to quarantine when neither copy could be loaded, so it is never simply overwritten.
export function chooseSaveToLoad(raw, backupRaw, nowTs, deps) {
  if (!raw) return { game: null, source: "fresh", rawToBackup: null, unreadable: null };
  try {
    return { game: restoreSavedGame(raw, nowTs, deps), source: "save", rawToBackup: raw, unreadable: null };
  } catch (e) {
    if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("[ConstructionFlow] save failed to load, trying backup:", e);
  }
  if (backupRaw && backupRaw !== raw) {
    try {
      // The backup is not re-written as itself — the next successful save/load refreshes it.
      return { game: restoreSavedGame(backupRaw, nowTs, deps), source: "backup", rawToBackup: null, unreadable: raw };
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("[ConstructionFlow] backup failed to load:", e);
    }
  }
  return { game: null, source: "fresh", rawToBackup: null, unreadable: raw };
}
