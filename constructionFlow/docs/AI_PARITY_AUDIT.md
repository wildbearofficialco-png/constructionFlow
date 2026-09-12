# Construction Flow parity audit

Date: 2026-09-12
Benchmark: FleetFlow Simulator

## Current state

Construction Flow is already a substantial standalone Expo/React Native game migrated from the mature FleetFlow architecture. The repository contains:

- Seven core in-game tabs: Home, Bids, Sites, Crew, Vehicles, Finance, Empire.
- AsyncStorage save/autosave under `constructionflow_v1_save`.
- A large production game screen plus a generated single-file Snack build.
- Mature simulation modules for economy, staff/personality, inventory, random events, AI competitors, customer satisfaction, demand/pricing, weather, performance, contract bidding, analytics, territories, equipment wear, financial ledger, holdings, lending, regional economy, and vehicle lifecycle.
- A large construction equipment asset catalog and office progression assets.

The main gap is not game scope. The main gap is integration, automated validation, and release hardening.

## Highest-priority parity gaps

### P0: release blockers

1. Automated test coverage is missing from the standalone repository.
   - FleetFlow has a mature `__tests__` suite.
   - Construction Flow currently has no test script or Jest setup in `package.json`.
   - Comments in `ConstructionFlowScreen.js` already reference parity tests such as `constructionFlowClone.test.js`, but those tests are not present in this standalone repo.

2. Several migrated systems exist as modules but are not fully wired into the UI/game loop.
   - README explicitly calls out equipment wear/maintenance, financial ledger, lending/financing, and regional economy integration as incomplete.
   - These should be wired before adding new feature categories.

3. Release configuration is not yet at FleetFlow parity.
   - Construction Flow currently exposes standard Expo scripts, but the repo does not yet mirror FleetFlow's mature EAS/release configuration and testing workflow.
   - Do not perform release or submission work without owner approval.

### P1: gameplay depth

4. Vehicle/equipment ownership needs the full wear -> repair -> downtime -> operating-cost loop visible to the player.
5. Finance needs complete ledger visibility, loans/financing, repayment behavior, and consequences.
6. Regional economy should visibly affect bids, costs, wages, material pricing, and job availability.
7. Empire progression should connect territory expansion, holdings, reputation, and larger contract tiers into a clear long-term progression loop.

### P1: quality and balance

8. Validate save/load migration and offline progress against longer-running companies.
9. Validate economy pacing so early progression is purposeful without becoming grindy.
10. Validate AI competitors and bidding pressure so contracts feel contested but not arbitrary.
11. Validate random-event frequency so events create stories without constantly interrupting play.
12. Validate mobile performance because the primary game screen is very large and owns most state/UI.

## Work order

### Phase A: parity safety net

- Port the Construction Flow-relevant tests from FleetFlow into the standalone repo.
- Add the minimum test tooling needed to run them.
- Verify clone/save helpers, economy math, contract state transitions, staff behavior, equipment lifecycle, and persistence helpers.

### Phase B: wire existing systems

Order:
1. equipment wear + maintenance
2. financial ledger
3. lending/financing
4. regional economy
5. vehicle lifecycle integration

Do not add unrelated new systems until these are player-visible and tested.

### Phase C: gameplay polish

- Improve feedback for job progress, delays, inspections, breakdowns, morale, finances, and reputation changes.
- Tighten early-game pacing and contract rewards.
- Check that every major tab has a meaningful reason to revisit it during a normal play session.

### Phase D: release hardening

- lint
- typecheck
- expo-doctor
- device test in Expo Go where compatible
- verify Snack single-file build
- final save/load regression test
- only then prepare an EAS/TestFlight plan for owner approval

## Rules for AI work

- Work on a feature branch, not `main`.
- Keep Expo Go/Snack compatibility unless a native dependency is truly necessary.
- Prefer wiring and testing systems already present over adding new feature categories.
- Do not merge, submit, delete data, or change release configuration without owner approval.
- Keep user involvement limited to decisions and meaningful device tests.

## Recommended next implementation task

Port the missing standalone Construction Flow test safety net first. The codebase is already large enough that modifying economy, finance, equipment, or save logic without tests creates unnecessary risk.
