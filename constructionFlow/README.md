# Construction Flow

A standalone construction-business simulation game, built with Expo + React Native + Expo Router.

**Release status:** 1.0.0 (iOS build 1) — configured as a standalone iOS app for EAS/TestFlight.
See [Building for iOS](#building-for-ios).

Start with a small crew and one truck, bid on jobs, buy and maintain heavy equipment, hire and
manage operators, and grow into a construction empire — buying yards, expanding into new
territories, and taking on bigger contracts as your reputation grows.

This app was migrated from a mature implementation originally built inside the FleetFlow
codebase, reusing FleetFlow's proven simulation architecture (economy, AI competitors, random
events, staff/personality systems, weather, contract bidding, analytics, territories) adapted to
a construction-company theme.

## Get started

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android), or press `i` / `a` for a simulator/emulator,
or `w` for web.

## Project structure

- `src/app/` — Expo Router entry points. `index.tsx` renders the game inside an error boundary;
  the actual UI/state is entirely owned by `ConstructionFlowScreen`.
- `src/games/constructionflow/ConstructionFlowScreen.js` — the game itself: a single large,
  self-contained screen component that owns all UI, navigation between in-game tabs (Home, Bids,
  Sites, Crew, Vehicles, Finance, Empire), and the game loop.
- `src/systems/` — shared simulation systems (economy, employee personalities, inventory,
  random events, AI competitors, customer satisfaction, demand/pricing, weather, staff
  performance, contract bidding, analytics, territories, equipment wear, financial ledger,
  holdings, lending, regional economy, vehicle lifecycle). Not every system is wired into the
  UI yet — see "Roadmap" below.
- `src/data/` — supporting data tables (lending products, regional economy tuning) used by the
  systems above.
- `assets/construction/` — equipment and office artwork used by the game.

## Save data

The game autosaves to `AsyncStorage` under the key `constructionflow_v1_save`. No backend or
account system is required to play.

Everything the save holds is bounded: logs, ops feed, event log, ledger and closed-contract
history all have caps, so a long-running save stays flat rather than growing with play time.
A day-300 save measures ~93 KB. This matters because `clone()` deep-copies the whole save on
every tick *and* every player tap — save size is directly felt as UI latency on device.

## Validation

```bash
npm run verify   # expo lint + tsc --noEmit + jest
npm run doctor   # expo-doctor
npx expo export --platform ios   # bundle validation without a native toolchain
```

## Building for iOS

The app is configured as a standalone iOS application (not an Expo Go project).

| | |
|---|---|
| Display name | Construction Flow |
| Version | 1.0.0 |
| iOS build number | 1 |
| Bundle identifier | `co.wildbear.constructionflow` |
| Apple Team ID | `3CRXBAH48B` |
| App Store Connect app ID | `6793354537` |
| EAS owner / slug | `wildbear` / `constructionflow` |

Build numbers are managed in `app.json` (`ios.buildNumber`), not by EAS — `eas.json` sets
`cli.appVersionSource: "local"` and `autoIncrement: false` on the production profile, so every
TestFlight upload needs `ios.buildNumber` bumped by hand first. Apple rejects a repeated build
number for the same version.

```bash
npx eas-cli@latest login            # one-time, interactive
npm run build:ios                   # eas build --platform ios --profile production
npm run submit:ios                  # uploads the latest build to TestFlight
```

`expo-updates` is deliberately not installed, so no EAS Update channels are configured; every
change ships as a new build.

## Roadmap

- Replace React Native's deprecated core `SafeAreaView` with `react-native-safe-area-context`
  (already a dependency). Deferred out of the 1.0 release because it is a layout change across
  every screen, and 1.0's goal is device testing of the existing UI.
- Wire the remaining unused simulation systems (`holdingsEngine`, `vehicleLifecycle`,
  `territorySystem`) into the UI, or drop them.
