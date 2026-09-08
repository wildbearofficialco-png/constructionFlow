# Testing ConstructionFlow in Expo Snack

This folder is a ready-to-copy, self-contained build of ConstructionFlow for testing in
[Expo Snack](https://snack.expo.dev) with Expo Go — no local dev server needed.

It's generated from the real game (`src/games/constructionflow/ConstructionFlowScreen.js` +
`src/systems/`) by `scripts/build-snack.js`. The only difference from the production code: the
50 equipment/office image `require(...)` calls are rewritten to remote `{ uri }` sources
pointing at this repo's raw GitHub content, so nothing needs to be re-uploaded into Snack by
hand. Everything else — the full game loop, economy, crew, bidding, AI competitors, weather,
territories, analytics — is unchanged.

## What to copy into Snack

Go to [snack.expo.dev](https://snack.expo.dev) and create these **15 files**, matching these
exact names and paths (use the `+` button in Snack's file list; typing a path like
`systems/utils.js` creates the `systems` folder automatically):

| Snack path | Copy from |
|---|---|
| `App.js` | `snack/App.js` |
| `ConstructionFlowScreen.js` | `snack/ConstructionFlowScreen.js` |
| `systems/utils.js` | `snack/systems/utils.js` |
| `systems/employeePersonalities.js` | `snack/systems/employeePersonalities.js` |
| `systems/inventorySystem.js` | `snack/systems/inventorySystem.js` |
| `systems/randomEvents.js` | `snack/systems/randomEvents.js` |
| `systems/aiCompetitors.js` | `snack/systems/aiCompetitors.js` |
| `systems/economyEngine.js` | `snack/systems/economyEngine.js` |
| `systems/customerSatisfaction.js` | `snack/systems/customerSatisfaction.js` |
| `systems/demandPricing.js` | `snack/systems/demandPricing.js` |
| `systems/weatherRouteConditions.js` | `snack/systems/weatherRouteConditions.js` |
| `systems/staffPerformance.js` | `snack/systems/staffPerformance.js` |
| `systems/contractBidding.js` | `snack/systems/contractBidding.js` |
| `systems/analyticsEngine.js` | `snack/systems/analyticsEngine.js` |
| `systems/territorySystem.js` | `snack/systems/territorySystem.js` |

No assets need to be uploaded — all art loads from `raw.githubusercontent.com`.

## Dependencies

In Snack's left sidebar, under **Dependencies**, add:
- `@react-native-async-storage/async-storage`
- `@expo/vector-icons` (usually already available by default in Snack)

Also set Snack's **SDK version** (bottom-left) to match whatever Expo Go version is installed on
your iPhone/iPad — this app currently targets **Expo SDK 57**.

## Regenerating this folder

After changing `ConstructionFlowScreen.js` or any of the systems it imports, run:

```bash
node scripts/build-snack.js
```

then commit the updated `snack/` folder. If a newly-added system needs shipping to Snack too,
add its filename to `SYSTEMS_NEEDED` in `scripts/build-snack.js` first.
