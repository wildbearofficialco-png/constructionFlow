# Claude handoff: Construction Flow parity sprint

## Mission

Move Construction Flow toward FleetFlow Simulator quality without adding unrelated feature categories.

## Current diagnosis

Construction Flow already has a large playable game screen, seven core tabs, mature simulation modules, an Expo Go-compatible architecture, and a generated Snack single-file build. The largest remaining gap is integration and verification.

## Non-negotiable constraints

- Work from the existing code, do not rewrite the game.
- Keep Expo Go and Snack compatibility.
- Do not add native dependencies unless absolutely necessary.
- Do not merge to `main` or touch release/submission configuration.
- Do not delete save compatibility.
- Favor small, reviewable changes.
- Preserve the existing `constructionflow_v1_save` data contract or provide backward-compatible migration.
- Run lint, typecheck, tests, and Expo Doctor before declaring implementation ready.

## Priority order

### 1. Establish test runner

The branch already includes starter parity tests under `__tests__` for:
- clone/state integrity
- equipment shop invariants
- offline progression safeguards

Use Expo's supported Jest setup for the installed SDK. Install through Expo CLI so compatible versions are resolved rather than guessing dependency versions.

### 2. Wire equipment wear and maintenance

Integrate the existing `src/systems/equipmentWear.js` system into the actual game loop and Vehicles UI.

Player-visible expectations:
- equipment condition should deteriorate from use
- maintenance/repair should cost money and create a meaningful decision
- badly maintained equipment should create downtime/reliability consequences
- assigned/broken/repairing states must not conflict
- state must save/load correctly

Do not create a second overlapping wear model if one already exists in `ConstructionFlowScreen.js`. Reconcile and reuse.

### 3. Wire financial ledger

Integrate `src/systems/financialLedger.js` into Finance so players can understand where money came from and where it went.

At minimum categorize:
- contract revenue
- payroll
- equipment purchases
- operating/fuel costs
- maintenance/repairs
- materials
- loan proceeds and payments when lending is integrated
- random-event expenses/revenue

Avoid double-counting existing cash mutations. The ledger should observe/account for transactions, not create duplicate charges.

### 4. Wire lending

Integrate `src/systems/lendingEngine.js` and `src/data/lendingProducts.js` into Finance.

Expected loop:
- eligibility / terms
- borrow
- cash proceeds once
- scheduled repayment
- consequences for missed payments if supported by existing engine
- save/load stability

### 5. Wire regional economy

Integrate `src/systems/regionalEconomyEngine.js` + `src/data/regionalEconomy2026.js` visibly into the economy.

Prefer effects players can understand:
- contract/job demand
- material prices
- wages/cost pressure
- financing conditions if supported

Provide UI explanation so the player can tell why costs/opportunities changed.

## Validation checklist

Before asking Brady to test on device:
- test runner passes
- lint passes
- TypeScript check passes
- Expo Doctor has no unexplained blocking errors
- app starts without red-screen errors
- existing save loads
- new game starts
- bid -> site -> completion -> payment loop works
- hiring/payroll works
- equipment purchase/assignment works
- offline catch-up works
- Snack single-file generation still succeeds

## Human involvement

Only ask Brady for a decision when product behavior genuinely has multiple reasonable choices. Otherwise choose the least disruptive option and document it.
