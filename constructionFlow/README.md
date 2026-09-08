# ConstructionFlow

A standalone construction-business simulation game, built with Expo + React Native + Expo Router.

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

## Roadmap

See the FleetFlow parity checklist tracked in project notes for the next milestones: wiring in
equipment wear/maintenance, financial ledger, lending/financing, and regional economy systems
into the UI, and building out the automated test suite mirrored from FleetFlow's
`__tests__/constructionFlow*.test.js` files.
