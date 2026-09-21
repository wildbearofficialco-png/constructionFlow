# Construction Flow Changelog

All notable changes should be documented here. This file starts at Phase 1 of the FleetFlow
parity work; 1.0.0 build 1 is the TestFlight build that preceded it.

## Unreleased

### Fixed — Phase 4: a market that keeps living

FleetFlow shipped builds 58 and 59 specifically to fix a market that stopped living, and its
changelog is a ready-made post-mortem. Reading Construction Flow's rival code against it found
**every one of those defects still present, plus four of its own**:

- **The market died permanently.** `createRivals()` mints seven fixed companies and was only
  ever called on a fresh save. Acquire or bankrupt them all and the board was empty forever.
  Worse, the migration's `if (!g.rivals.length) g.rivals = createRivals()` would have
  regenerated *the same seven* — resurrecting companies the player had bought. New companies
  now enter a thin field, gated on a cooldown and a low daily roll so an arrival is news
  rather than a conveyor belt. **The ones you bought stay bought**, which the buyout copy
  promises and a test enforces.
- **An entrant that could never do anything.** The bidding loop did a bare
  `rivalPersonality[rival.id]` lookup followed by `continue`. A generated company has no entry
  in that authored table by definition, so every entrant would have sat on the board forever
  — present, but never bidding. This is the exact trap FleetFlow's build 59 names in its own
  daily sim. Entrants now carry their seed *and* their personality on the record, and the
  lookup falls back to it. (Nearly shipped: the helper was written and tested, and the loop
  still wasn't using it. An unused-import warning caught it.)
- **Rival news crowded out the player's own.** It went through `addLog`, which caps `logs` at
  25 and `opsFeed` at 20 — the player's *own* operations feeds. A rival buying a digger pushed
  the player's site events out of their own history. Rival activity now has its own capped
  feed, surfaced on Home as **Market news**. The rule for which feed: *did this happen to the
  player, or merely in the market?* Being outbid or poached is the player's event and stays in
  their log; a rival opening a yard is market news.
- **Two competing bankruptcy systems shared one field with opposite meanings.** One lifecycle
  at the top of the rival loop treated `bankruptDays` as *days spent bankrupt*; a second
  ("Rival War: Feature 7") treated the same field as *days spent nearly bankrupt*. The second
  system's recovery branch was **unreachable** — the first `continue`s past it for any
  bankrupt company — and its recovery wrote `rival.reputation`, a field nothing reads. There
  is now one lifecycle with one field, `troubleDays`, meaning "days in the current state" and
  resetting on every transition.
- **Two counters for one thing.** One capex path incremented `rival.equipCount`, another
  incremented `rival.equipment`, and the UI read only the second — so half of every rival's
  machine purchases were invisible. One field now, with the old one folded in on migration.
- **`createRivals()` minted incomplete records.** No `status`, no `employees`, no `equipment`.
  The old code only worked by accident (`rival.status === "Bankrupt"` is false for undefined,
  and every counter read was written `(rival.employees || 2)`). A company whose status is
  literally undefined cannot be reasoned about.
- **Acquisitions transferred almost nothing.** Buying a company gave 1–3 *generic* workers
  whether it employed 2 or 20, no equipment at all, and recorded nothing in the ledger — so
  the reconciler saw cash it could not explain, the same shape as the settlement leak fixed in
  Phase 2. It also filtered site crew by `id !== rivalId`, comparing a crew member's id
  against a company's: dead code with a comment claiming it did something.

### Added — Phase 4

- `src/systems/rivalMarket.js` — the market's logic, pure and testable: the unified lifecycle,
  market-health and entrant gating, RNG-free news builders, and `planAcquisition`.
- **Acquisitions that transfer a real business.** Crew scaled to the company's actual
  headcount with trades matching what it built (a residential firm's people are carpenters),
  its machines, its cash reserves, and both sides recorded in the ledger under a new
  **Acquisitions** category. Above the cap the remainder is sold off in the deal rather than
  dumped on the player as individual records. **Live and bankrupt are genuinely different
  deals, not just different prices**: a trading firm is a going concern; a failed one's plant
  and crew went to creditors before you got there, which is what the cheap distressed price
  has always represented.
- **Growth narrated from movements that really happened.** Instead of a bare "acquired new
  equipment", the feed carries "🏗️ Apex Construction opened a yard in Bend, added 2 machines
  and hired 3 workers." Every clause is derived from a delta the daily sim already produced,
  so it narrates the simulation rather than running a second one beside it.
- **Decline is visible before it is an opportunity.** An escalating line per stage of a slump
  — losing money and missing deadlines → parked its fleet and cut shifts → weeks from closing
  with creditors circling — so a company going under is news, not an obituary.
- A rival's status on Home now reads from the lifecycle instead of being re-derived from cash,
  which let the card call a company "Struggling" while the simulation had it trading normally.
- A construction rival owns **machines**, not "vehicles".

**The news builders are RNG-free, and it is tested.** Same FleetFlow build 59 lesson as
Phase 3: a cosmetic headline must not consume a draw from the sequence the gated simulation
behaviours read.

### Tests — Phase 4

82 new tests, taking the suite from 305 to 387:

- `rivalMarket.test.js` (58) — the lifecycle across every transition and boundary, entrant
  gating and the never-inert property, news determinism and feed isolation, and acquisition
  plans for live and failed companies. Plus a sweep proving every entry point survives a
  literal `null` in the rivals array, which a JS default parameter does **not** guard against.
- `rivalMarketIntegration.test.js` (22) — 1,000 simulated days without a NaN or a broken
  record; a board emptied by bankruptcies refilling with new companies; bought companies never
  returning; entrants actually winning contracts; a year of market activity never displacing
  the player's ops log; and a guard that **no `recordTransaction` call uses a ledger category
  that would render unlabelled** — which is how the missing Acquisitions category was caught.

### Release (1.0.0, build 2)

- iOS `buildNumber` 1 -> 2. Version stays **1.0.0**: build 1 went to TestFlight under it and
  it has not been publicly released, so there is no `CFBundleShortVersionString` collision to
  avoid. Android `versionCode` untouched — this is an iOS build.
- Ships Phases 1, 2 and 3 together. Build 1 was the pre-audit game.
- `npx expo-doctor` 19/21 (both failures are network-policy-blocked checks in the build
  sandbox, not project issues), `npx expo export --platform ios` bundles cleanly, lint 0
  errors, typecheck clean, 305/305 tests.

**What to look at on device**, since these are the things no test can judge:

1. **Does amber read right?** It is now the primary action colour on every screen — the
   single biggest aesthetic bet in this release.
2. **Crew, Equipment and Empire** have the tightest horizontal rows and the largest type
   increase. If anything wraps badly or clips, it will be there.
3. **Install over an existing build-1 save**, don't wipe first. Migration is test-covered
   (a job in progress loads, defaults to no outstanding orders and no claims, and migrating
   twice is idempotent) but only a real device proves it.
4. **Bidding.** You can lose a bid now. The first contract is guaranteed and the odds are
   always on screen before you commit — does losing one read as tension or as noise?
5. **Material lead time.** A job can sit stalled two days waiting on concrete. Drama or dead
   air? `NORMAL_DELIVERY_DAYS` in `src/systems/constructionLoop.js` is a one-line change.

### Added — Phase 3: the living company

Phase 1 made the game legible; Phase 2 made its loop a game. Phase 3's finding is a third
kind of gap: **the company is being simulated but not witnessed.**

Construction Flow already tracks crew mood, loyalty, stamina, traits, XP and turnover, and
machine hours, condition, wear and utilisation. It knew a worker was exhausted, three days
from quitting, and currently pouring a foundation at Riverside — and said none of it. The
player only found out when they quit.

- **Crew are people now, not rows.** Every card leads with *where they actually are* —
  "🔨 Riverside Fence · Foundation" or "🅿️ In the yard — no site assigned", which is the
  difference between a working crew and a wage bill. Below that: their standing at your
  company (rank, tenure, jobs), the risks that need acting on before you lose them
  (exhausted, unhappy, flight risk, attendance), and **one line in their own voice**.
- **Machines answer the question the player actually has.** Not "condition 62%" but *is this
  thing making me money?* Each machine card now carries a verdict — Earning, Idle today,
  Underused, In the workshop — with utilisation (days worked against days owned), what it
  has cost you since purchase, and what it would fetch if sold.
- **The yard at a glance.** What is earning, what is parked, what is in the workshop, fleet
  utilisation, average condition, and the daily bill the whole lot runs up whether or not it
  turns a wheel.
- **The away report finally says what happened to the job sites.** This was the audit's
  gap 9. "Cash +$8,200" is a bank statement; the player's actual question is what happened to
  their jobs. Now, per job: *"Riverside Fence — Foundation → Framing · 42% → 67% · 1 phase
  complete"*, plus any progress payment it banked. A job that finished is reported as
  finished rather than silently vanishing, and **a job that did not move says so** — silence
  would hide a stall.

### Added — Phase 3 infrastructure

- `src/systems/companyLife.js` — the living-company logic, pure and testable: worker
  assignment, risk flags, voice, standing, trait effects, machine economics, fleet summary,
  and the offline site-report diff.

**One property is load-bearing and tested directly: none of this flavour text touches the
RNG.** That is a lesson taken from FleetFlow's build 59 post-mortem, where `pushNewsFeedItem`
minted list keys with `Math.random()` — so posting a purely cosmetic headline consumed a draw
from the same sequence the gated simulation behaviours read, and adding or removing a
decorative line could change what the simulation did that day. Phase 3 adds a lot of flavour
text, so variety here comes from `pickStable`, a djb2 hash of state the game already holds.
An integration test runs the same seeded 30-tick sequence twice — once with every presentation
helper called between ticks — and asserts the two runs end identically.

### Tests — Phase 3

67 new tests, taking the suite from 238 to 305:

- `companyLife.test.js` (51) — assignment states, risk ordering and the three-flag cap, voice
  priority and determinism, tenure and rank, machine verdicts, fleet arithmetic, and the
  offline diff across progressed / completed / stalled / started jobs.
- `companyLifeIntegration.test.js` (13) — the RNG-free property proven against the real
  `gameTick`, the away report built from an actual `applyOfflineProgress` run, and 200 ticks
  without a NaN reaching a worker or machine card.

### Changed — Phase 2: the core construction loop

Phase 1 made the game legible. Phase 2 makes its central loop a game. The audit's Phase 2
brief was "bidding, contracts, job sites, phases, crew, equipment, materials, completion,
inspections, payment" — and reading that code turned up something worse than a missing
feature: **two of the loop's three player decisions were not decisions at all.**

- **A bid you always won.** `contractBidStyles` offered Aggressive (−18% value), Standard and
  Premium (+28% value). Nothing in the codebase read the bid style except the payout
  multiplier. The UI promised "fast close" and "higher bar"; neither existed. Premium was
  +28% money for nothing and Aggressive was a strictly worse Standard, so a player who
  understood the game had one correct answer and no choice. **The bid style now moves the
  probability of being awarded the contract**, not just its value — premium is the best margin
  on the board if a cheaper contractor does not take it first. The card shows the odds and the
  payout for all three before you commit, and `rollBidOutcome` rolls the same number the card
  showed, so a lost bid is never a surprise. Losing costs you the contract, not your crew:
  nothing is committed until you win.
- **An emergency order that bought nothing.** An emergency material order cost 1.5× and
  arrived at exactly the same instant as a normal one, because both were instant. **Normal
  orders now take two days to arrive and work stalls until they land**, so the emergency
  premium buys the one thing a late project actually needs. The site card shows what is on
  order and how far out it is, and the stall message distinguishes "waiting on a delivery"
  from "nobody has ordered anything" — only the second one needs the player.

It also gives the loop its missing beats:

- **A completed phase says so.** Finishing a phase was silent unless it happened to be an
  inspection, so the loop's most frequent milestone had no moment at all. "Foundation complete
  — Framing begins."
- **A phase strip on every site card.** What is signed off, what the crew is on, what is still
  ahead. The card used to show only the current phase name and a bar, so a construction
  project read as a progress meter.
- **Progress payments.** Construction is not paid in two lumps. A deposit mobilises the job,
  the client certifies completed work and releases claims against it, and the balance lands at
  handover. **The total a contract pays is unchanged** — only its timing moved, and the tests
  hold that invariant across awkward values, phase counts and penalties.
- **Deliveries announce themselves** when they land, and the site resumes the same tick.

### Added — Phase 2

- `src/systems/constructionLoop.js` — the loop's pure logic, extracted and testable: bid
  planning and award rolls, delivery scheduling and collection, phase summaries, and the
  progress-payment schedule. This is the first module in Construction Flow following
  FleetFlow's `src/utils/` pattern of keeping decision logic out of the screen so it can be
  asserted without rendering.
- **A guaranteed first contract.** A brand-new company at 0 reputation would have lost a
  standard bid 31% of the time — and that bid is the tutorial's step 1. The guarantee is
  shown honestly as 100% in the UI rather than being a hidden fudge, and lifts as soon as the
  player has one completed job or one running site.
- Accessibility on the contract cards, which had none: role, label and expanded state.

### Fixed — Phase 2

- **A settlement could pay more than the contract was worth.** `handleSettleSite` added its
  partial payout on top of the deposit without deducting it — a small leak while only the 25%
  deposit existed, and one that would have become large now that progress claims release half
  the contract during the job. Settlement is now capped at the outstanding balance, and is
  recorded in the ledger like every other contract payment.

**One deliberate balance consequence, stated rather than buried:** a late penalty is withheld
from what is still owed and can never claw back cash already released, which is how liquidated
damages actually work. So certifying phases early reduces your exposure to running late. This
is self-correcting in play — a job that is late is usually late precisely *because* its phases
are not done, which leaves the penalty plenty of outstanding balance to bite into.

### Tests — Phase 2

68 new tests, taking the suite from 170 to 238:

- `constructionLoop.test.js` (48) — the properties that make each option a decision rather than
  the numbers that implement it today, so a balance pass can retune freely but cannot
  reintroduce a dominant option. Plus the progress-payment schedule, swept for rounding drift
  across 13-phase jobs at awkward values.
- `constructionLoopIntegration.test.js` (20) — the helpers wired into real game state: save
  migration from a build-1 job in progress, deliveries landing through `gameTick`, phase
  completion paying exactly one claim, replay-safety against offline catch-up, and 300 ticks
  without NaN or an over-claim.

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
