# Construction Flow Changelog

All notable changes should be documented here. This file starts at Phase 1 of the FleetFlow
parity work; 1.0.0 build 1 is the TestFlight build that preceded it.

## Unreleased

### Added — Phase 1: UX and visual parity

Construction Flow was played side by side with FleetFlow Simulator on a physical iPhone and
read as clearly less finished. `FLEETFLOW_PARITY_AUDIT.md` is the root-cause analysis. The
short version: the simulation was not the problem — Construction Flow already runs project
phases, crew morale, equipment wear, materials, lending, insurance, safety, taxes, AI rivals,
weather, offline progression and prestige. What it lacked was the presentation layer that makes
a simulation legible. This release is that layer. **No simulation, economy or save-format
change.**

- **A design system.** `src/theme/constructionTheme.js` holds colour roles, a type scale, a 4pt
  spacing scale, a radius scale and two elevation levels. The screen previously carried a
  32-entry StyleSheet with 503 inline overrides, so two cards showing the same kind of
  information never quite matched.
- **A construction identity.** The inherited `THEMES` object was byte-identical to FleetFlow's:
  the same navy, the same blue-and-cyan primary. Surfaces are now charcoal-navy, and
  **construction amber is the primary action colour**. Safety green means go, hi-vis yellow
  means degrading, signal red means stop, steel blue is informational. Every existing colour key
  is kept, so all 503 call sites shift coherently rather than breaking.
- **Eight shared UI primitives** (`src/components/ui/`): `Card`, `SectionLabel`, `Pill`,
  `ProgressBar`, `StatTile`, `KeyValueRow`, `AlertBanner`, `EmptyState`. `SectionLabel` is the
  hierarchy primitive the game was missing — a quiet uppercase eyebrow above a loud value above
  a small explanation, which reads instantly where two same-size titles have to be read word by
  word.
- **A motion layer** (`src/utils/constructionMotion.js`), built on React Native's own `Animated`
  so it adds **no dependency and no native module**. The cash figure pulses when it rises; the
  away report animates in. `useOsReducedMotion()` reads the OS accessibility setting and
  subscribes to live changes, and every animation is gated on it, so Reduce Motion removes the
  transition rather than shortening it. `Animated` was already imported by the screen and never
  used.
- **Home rebuilt as a dashboard.** It was 22 sequentially stacked full-width cards. It now opens
  with one **Site Command** hero card — company, day, operating cash, company value, reputation
  tier, and tiles for active sites / free crew / free machines — then the alerts that need the
  player, then one clear next action, then progression. Grouping related facts inside one card
  with internal dividers is what makes a screen read as designed rather than as a list.
- **Warnings you can act on.** Every predictive warning now carries the tab that fixes it and a
  tap target to get there. They were bullet dots with nowhere to go.
- **Equipment artwork on the job site.** The game ships 45 equipment renders and showed them in
  exactly two places (the shop card and the owned-equipment thumbnail). They now ride every
  assignment row on a site card, in the yard picker and on assigned machines.
- **The project P&L promoted.** `buildProjectEconomics` — a live running cost against contract
  value, one of Construction Flow's best original systems — rendered as three 10px rows lost
  among a dozen others. It now has its own panel with the margin as the headline.
- **Empty states on every tab.** Bids, Sites, Crew and Equipment now explain what the screen is
  for and what to do next, with a button where there is somewhere to go.

### Changed

- **The "Vehicles" tab is now "Equipment".** A leftover from the FleetFlow fork, and the
  clearest tell on every screen that this game was a re-skin. `normalizeTabName()` maps any
  persisted or hard-coded `"Vehicles"`/`"Fleet"` reference to `Equipment`, and anything
  unrecognised to `Home`, so no save or guidance record can land the player on a blank screen.
  The tab icon changed from a car to a hammer. Copy that said "vehicle" now says "machine".
- **Typography floor.** 34 uses of 9px and 100 of 10px are gone — 51% of the game's font sizes
  were at or below 10px, against FleetFlow's 18%, and that included body copy. Nothing renders
  below 11px now, and 11px is reserved for uppercase eyebrow labels. `styles.sub`, the
  workhorse text style behind hundreds of call sites, went from 12px to 13px.
- **Tap targets.** `styles.btn` and `styles.smallBtn` now meet the 44pt minimum. The crew and
  equipment rows on a site card had 9px text with 2px of padding — roughly a 14pt target.
- **Accessibility.** The screen had one `accessibilityRole` and one `accessibilityLabel` in
  10,738 lines. Every control added or rewritten in this pass carries both, progress bars report
  their value, and the site-pace and bonus selectors expose their selected state.
- **The important-notice banner** now has an explicit dismiss button instead of dismissing on a
  tap anywhere on the card.

### Fixed

- **Next Best Action was rendered twice on Home.** The same `getNextBestAction(game)` result
  appeared in two different card designs about 250 lines apart. A player reading the same advice
  twice in one scroll concludes the app is broken — and it also meant the advice was never
  prominent. There is one copy now, near the top of the screen.
- **A white-screen crash on the Home tab**, found by the new render smoke tests before it
  reached a device. A dashboard tile passed `getCreditLabel()`'s `{ label, color }` object
  straight to a React child: *"Objects are not valid as a React child."* Neither TypeScript nor
  ESLint catches this, because nothing had ever mounted the component in a test.
- The "Active Sites" and "Crew Idle" figures were stated twice on Home, in the KPI row and again
  in the header area. The standing row now carries the four figures the hero card does not.

### Tests

70 new tests across three files, taking the suite from 100 to 170:

- `constructionTheme.test.js` (36) — token scales, tone vocabulary, money formatting, empty-state
  copy, and that Construction Flow no longer ships FleetFlow's exact palette.
- `constructionFlowPresentationParity.test.js` (22) — source-level regression guards for the
  defects above: the typography floor, the tab name, one Next Best Action, warnings carrying a
  valid tab, design-system adoption, and that the save key and opening position are untouched.
- `constructionFlowRenderSmoke.test.js` (12) — mounts the real screen and visits all seven tabs
  across six save states (new company, mid-project, company in trouble, late-game, light mode,
  mid-tutorial), plus the away report and the setup screen. This is the file that caught the
  crash above.

### Release

No release. `ios.buildNumber` is deliberately **not** bumped and `app.json`, `eas.json` and the
bundle identifier are untouched — this PR is not cut as a TestFlight build.

Verified: `npm run lint` (0 errors, 35 pre-existing warnings, down from 39), `npm run typecheck`
clean, `npm test` 170/170, `npx expo-doctor` 19/21 (the two failures are network-policy-blocked
checks in this sandbox, not project issues), `npx expo export --platform ios` bundles cleanly.
