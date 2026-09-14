# Construction Flow — side-by-side audit vs FleetFlow Simulator

Date: 2026-09-14
Reference: `wildbearofficialco-png/Fleetflow` @ `main` (build 51)
Subject: `wildbearofficialco-png/constructionFlow` @ `ai/constructionflow-parity-audit`

This is a code-level audit. Every classification below was read out of the two
implementations, not inferred from the earlier parity docs. Where a claim needs a device to
confirm it, the area is marked VERIFY rather than guessed at.

## Scale

| | FleetFlow | Construction Flow |
|---|---|---|
| Main game screen | 28,154 lines | 10,256 lines |
| Extracted helper modules | 39 (`src/utils/fleetflow*`) | 2, plus 1 shared component |
| Shared simulation systems | 17 | 22 |
| Tests | mature suite | 10 suites / 92 tests (was 7 / 41) |

The headline is in row two. At the start of this pass Construction Flow had *more*
simulation systems than FleetFlow but had extracted **zero** presentation/helper modules —
every piece of game logic that FleetFlow keeps in a testable pure module lived inline in
Construction Flow's screen. That was, and at 2-of-39 still is, the single biggest structural
difference between the two codebases, and it is why the test count was so far behind: logic
with no import surface cannot be tested. The three modules extracted this pass
(`projectEconomics.js`, `recoveryGuidance.js`, the tutorial step helpers) took the count from
41 to 92 largely on their own, which is the argument for continuing.

## Area-by-area

Status: STRONG = at FleetFlow product quality · PARTIAL = present, below quality · GAP =
missing · VERIFY = code exists, player experience unconfirmed.

Disposition: **A** = shared WildBear Core · **B** = adapted for construction · **C** = not
appropriate for construction.

| # | Area | Status | Disposition | Evidence / note |
|---|---|---|---|---|
| 1 | Initial launch | STRONG | A | Both gate on `didLoad`; CF has save-integrity check (`checkSaveIntegrity`) FleetFlow lacks |
| 2 | Company setup | PARTIAL → **fixed** | A | CF had a 3-step wizard but never asked the owner's name. Added this pass |
| 3 | Home | PARTIAL → **fixed** | A | Identity and next-action rendered below six dashboards. Reordered this pass |
| 4 | Navigation | STRONG | A | Both 7-tab bottom nav; CF now marks the tutorial's target tab too |
| 5 | Work marketplace | STRONG | B | CF bidding (styles, rivals, categories) is richer than FleetFlow's job list |
| 6 | Starting work | STRONG | B | CF mobilise flow (crew + equipment + materials + deposit) is the better loop |
| 7 | Active work | PARTIAL → **improved** | B | Phases/weather/chaos are strong; costs were invisible mid-job. Added running P&L |
| 8 | Completion | GAP → **fixed** | A | CF showed payout only, never profit. This was the largest single P0 |
| 9 | Staff | STRONG | B | Personalities, loyalty, promotion, turnover. Ahead of FleetFlow in places |
| 10 | Assets | STRONG | B | Wear/maintenance/breakdown wired; 50-machine catalogue |
| 11 | Finance | STRONG | A | Ledger wired and categorised |
| 12 | Lending | STRONG | A | Underwriting + products wired |
| 13 | Economy | STRONG | B | Regional pricing/wages/demand/financing all wired |
| 14 | Competitors | PARTIAL | B | Rivals bid and grow, but no headline/news surface like FleetFlow's |
| 15 | Events | STRONG | B | Weather, theft, inspections, labour, chain events. Construction's own identity |
| 16 | Offline | STRONG | A | CF's return screen is arguably better presented than FleetFlow's |
| 17 | Save/load | STRONG | A | Migration is thorough; long-running saves verified on device 2026-09-14 |
| 18 | Progression | STRONG | B | Company levels, valuation milestones, empire goals |
| 19 | Failure states | PARTIAL → **fixed** | A | Every affordability, capacity and gate alert now names a live recovery route |
| 20 | Settings | PARTIAL | A | CF has theme + automation toggles; no presentation/haptics settings |
| 21 | Visual presentation | PARTIAL | A | Card/colour grammar already close. Density is the gap — see #26 |
| 22 | First 20 minutes | STRONG | A | Profit clarity, identity and pacing verified on device 2026-09-14 |
| 23 | Midgame | PARTIAL | B | Multi-site works; specialisation strategy is thin |
| 24 | Endgame | PARTIAL | B | Empire/territories/legacy exist. Correctly deprioritised per Pass 1 |
| 25 | Testing | PARTIAL → **improved** | A | 41 → 92 tests. Still behind FleetFlow's coverage |
| 26 | Release readiness | PARTIAL | A | Gate is green; two pre-existing expo-doctor failures documented below |

## The five biggest differences today

1. **Completion showed revenue, never profit.** Construction Flow's celebration modal
   displayed the payout and stopped. FleetFlow's build 51 explicitly fixed this on its side
   with `fleetflowFirstDeliveryHelpers.js` — gross minus operating costs equals net, plus
   one reinvestment line. A player could finish ten Construction Flow jobs without ever
   learning that a job has costs. **Fixed this pass.**

2. **No extracted helper modules.** FleetFlow has 39 pure, testable `fleetflow*` helpers
   holding contract presentation, finance, progression, onboarding, event chains. Construction
   Flow has none — all of it is inline in a 10k-line screen. This is why Construction Flow's
   test count is low: most of its logic has no import surface to test against.

3. **Identity was incomplete.** Setup asked for a company but never for a person. The
   WildBear first-minute rule's first question — "who am I?" — had no answer anywhere in
   the game. **Fixed this pass.**

4. **Home led with analytics, not the company.** Health score, predictive warnings, streaks,
   weekly challenge, weekly report and client relationships all rendered above the company
   header and the Getting Started card. **Fixed this pass.**

5. **No information-density control.** FleetFlow uses `CollapsibleSection` in 27 places with
   AsyncStorage-persisted expand state, deliberately keeping urgent alerts outside it.
   Construction Flow renders 24 always-expanded cards on Home. Construction Flow does not
   have less content than FleetFlow — it has less *organised* content.

## The five highest-impact changes — all delivered in Pass 1

These were the five identified at the start of the pass. All five shipped; recorded here as
the pass's own scorecard.

1. **Project profit, everywhere money is shown.** ✅ Completion P&L, live site margin, and
   a bid-time estimate that runs the same calculation path as the charge.
2. **Port `CollapsibleSection` as the first real WildBear Core component.** ✅ Ported and
   applied to Home's two reference cards, with critical alerts deliberately left outside it.
3. **Extract the first Construction Flow helper modules.** ✅ Three so far. Next candidates
   remain site, crew and contract presentation — the densest inline logic left.
4. **Name a recovery path in every failure state.** ✅ Empty states and the full alert sweep.
   Advice is derived from live state, so it never suggests an unavailable route.
5. **Tutorial tab highlighting.** ✅ The bottom nav now marks the tab the Getting Started
   card is pointing at, with the cue carried to screen readers via the accessibility label.

## What FleetFlow does that should become WildBear Core

Ranked by how ready each one is to move:

- **`CollapsibleSection`** — already game-agnostic. Move as-is. Highest value, lowest risk.
- **`fleetflowUiHelpers.js`** — tone-to-colour mapping, compact money, short durations,
  per-tab empty-state copy, next-step hint. This is literally the shared visual grammar the
  standard calls for, and it is already pure.
- **The first-completion economics contract** — gross → itemised costs → net → margin → one
  reinvestment line. The *grammar* is core; the line items are per industry. Construction
  Flow's `projectEconomics.js` is the second implementation of it, deliberately shaped the
  same way.
- **The dismiss-once contextual tip tracker** (`ONBOARDING_TIPS`, `sanitizeDismissedTips`,
  `getActiveTipForTab`). Pure, tiny, and Construction Flow has no equivalent.
- **Company logo selection.** FleetFlow has `COMPANY_LOGO_OPTIONS`; Construction Flow has no
  visual identity at all. Core, with a per-industry emoji set.

Not yet ready to extract: FleetFlow's tutorial is deliberately inline and tightly coupled to
its own JSX, and its own comments say so. Do not try to generalise it.

## What Construction Flow should deliberately do differently

- **Materials as a first-class resource.** FleetFlow has no real equivalent. Materials give
  Construction Flow a purchasing/shortage/price-timing game FleetFlow cannot have. Deepen it,
  do not normalise it away.
- **Project phases.** A delivery is atomic; a project has stages that fail differently.
  Phase-level inspections, phase-level weather stoppage and phase-level crew fit are
  construction's own fantasy.
- **Deposits and staged payment.** Construction Flow already pays 25% on mobilisation.
  That is correct for the industry and should grow (progress billing, retainage, slow payers)
  rather than being flattened into FleetFlow's pay-on-delivery model.
- **The bid, not the accept.** FleetFlow dispatches. Construction Flow *bids* — with a style
  multiplier and rivals bidding against you. This should become the most interesting decision
  in the game and should not be simplified toward FleetFlow's one-tap dispatch.
- **Crew composition over headcount.** Trades and specialties matter in a way driver
  headcount does not.
- **Do not copy FleetFlow's CEO/investor event layer yet.** Five `fleetflowCeoEvent*` modules
  totalling ~1,800 lines serve a late game Construction Flow has not earned. Pass 4 at the
  earliest.

## Known issues, unchanged by this pass

`npx expo-doctor` reports 2 failures on this branch. Both pre-date this work — verified by
stashing all changes and re-running:

1. **Expo config schema check** — app.json schema validation.
2. **React Native Directory metadata** — "Directory check failed with unexpected server
   response". Network-dependent, not a project fault.

`npx expo lint` reports 39 warnings, 0 errors. All 39 pre-date this pass and none are in
files touched here.

## Pass 1 status — complete

- [x] Bid screen: estimated margin before commitment
- [x] Port `CollapsibleSection` and apply to Home
- [x] Failure-state recovery sweep (insufficient cash, missing crew/equipment/materials,
      capacity caps, credit gates, debt servicing)
- [x] Tutorial tab highlighting
- [x] Device test — **passed** (Brady, 2026-09-14): save/load on a long-running company,
      offline return, iPhone + iPad readability

All ten Pass 1 acceptance tests from the parity matrix now pass, code and device.

Final gate at Pass 1 close: 10 suites / 92 tests, `expo lint` 0 errors, `tsc --noEmit`
clean, Snack single-file build regenerates with no unresolved local imports. The two
expo-doctor failures documented above are unchanged and pre-date this work.

## Pass 2 entry point

With the first 20 minutes holding up on device, the matrix's Pass 2 (business realism, P1)
is next. Ordered by what the Pass 1 work has already made cheap:

1. **Client payment behaviour.** Deposits and staged payment already exist and the project
   P&L can now show what a slow payer actually costs. Slow-paying and non-paying clients are
   construction's signature financial pressure and the groundwork is in.
2. **Rival contractors made visible.** Rivals already bid and grow; they have no surface.
   FleetFlow's headline/news presentation is the model.
3. **Construction event families.** Weather, theft, inspections and change orders exist as
   mechanics; they need the presentation grammar the rest of the game now has.
4. **Continue extracting helpers.** `projectEconomics.js`, `recoveryGuidance.js` and the
   tutorial helpers are the template. Site, crew and contract presentation are the densest
   remaining inline logic, and extracting them is what will let the test count keep climbing.

Do not start Pass 3 (multi-site management) or Pass 4 (empire) until Pass 2 is fun.
