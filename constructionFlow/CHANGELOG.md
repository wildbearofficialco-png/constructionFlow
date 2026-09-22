# Construction Flow Changelog

All notable changes should be documented here. This file starts at Phase 1 of the FleetFlow
parity work; 1.0.0 build 1 is the TestFlight build that preceded it.

## Unreleased

### Release (1.0.0, build 6)

- iOS `buildNumber` 5 -> 6. Version stays **1.0.0**. Android `versionCode` untouched at 1.
- **Carries three sprints' worth of work.** Build 5 shipped Phase 6 (company memory, the approved
  icon); everything since has been merged and unbuilt:
  - **Sprint 7** — eight construction-native KPIs and the Performance card, replacing a FleetFlow
    analytics engine that was measuring fields this game does not have; clients lifted out of a
    collapsed drawer onto a real card.
  - **Sprint 7 device fixes** — the "Equipment" tab label that wrapped and fell off the bar, and
    the clock the game always had but never rendered.
  - **Sprint 8** — the Site Office inbox, replacing a single `importantNotice` slot behind 102
    call sites.
- **Two save migrations run on an existing build-5 save**, and this build is the first chance to
  validate either on a device: Sprint 7's `kpiHistory` + bid counters, and Sprint 8's `inbox` +
  `_noticeSeq`. Both are additive, both repair corrupted values rather than crashing, and neither
  invents history the player never had. Eleven tests cover them.
- Release gate: lint 0 errors (33 pre-existing warnings), typecheck clean, **623/623 tests across
  31 suites run three consecutive times**, Expo config resolves to Construction Flow / 1.0.0 / 6 /
  `co.wildbear.constructionflow` / EAS project `72e9062c-b382-478a-b226-b3ea5559e117`,
  `npx expo export --platform ios` bundles cleanly.
- Identity preserved: bundle identifier, EAS project, App Store Connect app `6793354537`, the
  approved artwork.


## Sprint 8 — The Site Office inbox

**Not built.** `ios.buildNumber` stays at **5**; nothing ships without an explicit go-ahead.

### The finding — one slot behind 102 call sites

Audit row 11 said Construction Flow had "`importantNotice` — one at a time." That undersells it.
The entire channel was a single field:

```js
function addImportantNotice(state, message, tone = "green") {
  state.importantNotice = { id: Date.now(), message, tone };
}
```

One hundred and two call sites, one slot. Three defects follow:

1. **Loss.** Every call overwrites the last. Complete a job, break a machine and lose a bid in the
   same tick and the player sees one of the three; the other two are destroyed before they are
   ever drawn.
2. **Staleness.** Nothing expires. A seeded 120-day run left a **day-3** `🏆 "$100K Reserve"
   milestone reached!` banner still occupying the top of Home on **day 120** — 117 game-days
   later — because nobody had tapped Dismiss. The most prominent card on the home screen was a
   congratulation from four months ago.
3. **Colliding ids.** `Date.now()` is millisecond resolution, so every notice raised in the same
   tick shares an id with its neighbours.

Defect 2 was found by instrumenting a real run rather than by reading the code — the first probe
written to measure defect 1 reported *zero* losses, which turned out to be the `Date.now()`
collision (defect 3) defeating the probe's own comparison. The corrected probe found the stale
banner instead.

### `src/systems/noticeInbox.js` (new)

A small queue that keeps what matters, ages out what does not, and distinguishes a thing you
should **see** from a thing you must **do**.

- Five levels: `action`, `urgent`, `warning`, `info`, `good`. The most important item leads;
  within a level, newest first.
- **Action items never expire.** They are waiting on the player, and silently removing something
  they still owe a decision on is how a game loses their trust. "Clear all" keeps them too.
- Everything else ages out in 2–3 days, so the home screen can never again lead with a
  four-month-old congratulation.
- Unique ids from a monotonic counter on the state — no RNG, no clock.
- Deduped on identical text raised the same day; capped at 25, the same constraint Phase 4 put on
  market news and Phase 6 on the chronicle.

**All 102 call sites kept their existing signature.** The tone vocabulary (`green`/`red`/
`orange`/`neutral`/`cyan`) maps to levels inside the module, so no call site needed individual
rewriting and re-review. `importantNotice` is still written with the top of the queue, so
anything reading it directly keeps working.

### New — the Site Office card on Home

The lead item gets the weight the old banner had, with its age and — for action items — a
"Needs a decision" flag and a button to the tab that resolves it. Everything else is one tap
away rather than destroyed. Unread items badge the **Home tab**, so something landing while the
player is on another screen is visible instead of silently queued.

### A wiring bug the tests caught

The save migration carried a returning player's on-screen notice into the new queue — except it
detected "legacy save" with `!Array.isArray(g.inbox)`, and `migrateState` opens with
`{ ...freshState(), ...saved }`. Since `freshState` now carries `inbox: []`, **that check could
never be true**, and the carry-over never ran. It now tests `saved.inbox`, the only honest
witness to what the player actually had.

### Tests — 585 → 623

- `__tests__/noticeInbox.test.js` (21). Each of the three defects has a test named after it,
  including the exact day-3-milestone-on-day-120 case.
- `__tests__/noticeInboxIntegration.test.js` (14). Seeded 120- and 200-day runs asserting
  nothing on screen is older than its lifespan, ids stay unique, the queue stays bounded, and
  `importantNotice` still mirrors the top of the queue.
- Three render probes: the lead-plus-rest case, an action item, and the empty inbox drawing no
  card at all.

### Save compatibility

Additive: `inbox`, `_noticeSeq`. A returning player's single notice is carried into the queue at
the current day, so it gets a normal lifespan from the upgrade rather than arriving pre-expired
or living forever. A corrupted inbox is repaired rather than crashing the load.


## Sprint 7 — The company you can read

**Not built into a TestFlight build.** `ios.buildNumber` stays at **5** at the app owner's
instruction: no new build without an explicit go-ahead.

### The finding — the analytics engine was not "unsurfaced", it was measuring nothing

Audit rows 36/37 said `analyticsEngine` was "ticked every day and almost never shown — data is
collected; the player can't see it." That was half right, and the wrong half is the interesting
one. `analyticsEngine.js` is FleetFlow's module, shared verbatim, and **every input it reads is
a field Construction Flow does not have**:

| It reads | Construction Flow has | So the KPI was |
| --- | --- | --- |
| `weeklyStats.completedRoutes` | — | on-time rate **1.00, always** |
| `weeklyStats.lateDeliveries` | — | " |
| `weeklyStats.routeIncome` | — | revenue **0, always** |
| `weeklyStats.wages` / `fuel` / `rent` | — | expenses **0, always** |
| `status === "En Route"` | `Active` / `Idle` / `Broken` | utilisation **0.00, always** |
| `game.customerRating` | — | **3.5, forever** |

Construction Flow's `weeklyStats` is `{revenue, expenses, jobsCompleted, unexpectedCosts,
savingsInterest}` — not one of those names. So the engine was snapshotting a row of zeros, a
permanent 100% on-time rate and a permanent 0% utilisation every seven days and keeping 26 of
them in the save.

**Surfacing those numbers, as the audit's own recommendation implied, would have been worse than
leaving them hidden** — precise, confident and wrong is worse than absent.

It also carries a real operator-precedence bug that would misreport FleetFlow too:

```js
const totalExpenses = game.weeklyStats?.wages || 0 + (game.weeklyStats?.fuel || 0) + ...
```

`||` binds looser than `+`, so that is `wages || (0 + fuel + repairs + ...)`. Whenever wages is
non-zero, every other expense line is silently discarded.

### `src/systems/constructionKPIs.js` (new)

Eight measures computed from state this game actually maintains — translated to construction
rather than copied: revenue per **crew**, **plant** utilisation, cost per **job site**.

On-Time Completion · Plant Utilisation · Crew Utilisation · Profit Margin · Revenue/Crew/Week ·
Bid Win Rate · Plant Condition · Client Retention

Two design rules that do most of the work:

- **A measure with no data behind it is `null`, never zero.** Zero is a claim — "you are failing"
  — and a company on day 3 that has never bid has not earned that claim. Those render as "Not
  enough history yet".
- **Nothing is blamed on the player that is not their doing.** A *broken* machine is excluded
  from the utilisation denominator, and *resting* crew from theirs, so a breakdown or a rest day
  never reads as a management failure. Plant *condition*, by contrast, counts the whole yard —
  a yard full of wrecks really is a condition problem.

The card leads with a verdict, not a grid: the weakest measure by name, with advice attached to
it. And it prints the counts behind the percentages, so "67%" reads as "2 of 3 jobs on time".

### New counters, and what migration deliberately does not do

`bidsPlaced` / `bidsWon` / `bidsLost` are new, because nothing tracked bid outcomes at all, and
`jobHistory` entries now carry `daysLate`.

**Migration starts all of them at zero rather than inferring them.** A returning player's
`completedJobs` is not evidence of bids won — there is no record of the bids they *lost*, and a
fabricated win rate would be the game making something up about them. Job-history entries written
before this sprint are excluded from the on-time rate rather than assumed on time, which would
flatter that record.

The stale `analytics` blob is dropped on load, reclaiming the save space 26 rows of zeros
occupied.

### Clients came out of the drawer

Audit row 28: the loyalty system — tier ceilings, value bonuses, deadline extensions, repeat
business — was simulated in full inside a `CollapsibleSection` that defaults to closed. It is now
a card at the same level as everything it competes with, leading with what loyalty is actually
worth: *"3 of them pay you a loyalty premium — worth about +18% across their contracts."*

### Two device-reported fixes

**The tab label that fell off the bar.** "Equipment" is the longest entry in `TABS` and was
wrapping to two lines and overflowing the bottom bar on a real iPhone. It had no wrap guard at
all. Now `numberOfLines={1}` with `adjustsFontSizeToFit`, so only the label that needs to shrink
does, plus `minWidth: 0` on the tab item — without it a flex child refuses to shrink past its
intrinsic text width, which is what pushed the label onto a second line in the first place.

**The clock.** Reported as "feels off", and the reason is that there wasn't one. Construction
Flow has always HAD a clock — `gameMinutes` starts at 480 (8:00 AM) and advances 30 per tick, 48
ticks to the day — it was simply never rendered, so time passed invisibly and the day appeared to
jump. The header now reads `Day 12 · 8:30 AM`, using a `formatClock` that is deliberately
identical to FleetFlow's so the two games tell the time the same way.

### Tests — 525 → 585

- `__tests__/constructionKPIs.test.js` (29). Opens by **pinning the claim that the old engine
  could not measure this game**, including an executable demonstration of the precedence bug, so
  nobody "fixes" this by wiring the dead engine back up.
- `__tests__/constructionKPIsIntegration.test.js` (17). Proves the counters are incremented by
  the real bid path, that won + lost always equals placed across 120 simulated days, and that a
  job driven to completion through the actual tick reaches the KPIs.
- Three render probes: the populated card, the no-history case, and clients as a card.
- `__tests__/clockAndTabBar.test.js` (11). Clock edges, the 8:00 AM start, junk-value fallback,
  the day rolling over after exactly 48 ticks, and guards so no future tab rename can overflow
  the bar again.

One test corrected during the work: it asserted a legacy save should show **no** poor grades, and
that was wrong. A fresh company's plant and crew genuinely *are* idle — that is measured from the
roster in front of it, not from missing history, and "0% — assign them to sites" is exactly the
nudge a new player needs. The guard now covers the measures that really do depend on absent
history.

### Save compatibility

Additive only: `kpiHistory`, `bidsPlaced`, `bidsWon`, `bidsLost`. Corrupted values are repaired
rather than crashing the load. Covered by five tests.


## Phase 6 — A company with a memory, and the approved icon

### Release (1.0.0, build 5)

- iOS `buildNumber` 4 -> 5. Version stays **1.0.0**. Android `versionCode` untouched at 1.
- Build 4 is on TestFlight and carried the five parity phases with a placeholder icon. Build 5
  is the first to carry the approved artwork, and the first with a world that remembers.
- Release gate: lint 0 errors (34 pre-existing warnings), typecheck clean, **525/525 tests
  across 26 suites run four consecutive times**, Expo config resolves to Construction Flow /
  1.0.0 / 5 / `co.wildbear.constructionflow` / EAS project
  `72e9062c-b382-478a-b226-b3ea5559e117`, `expo export --platform ios` bundles cleanly.
- Identity preserved: bundle identifier, EAS project, App Store Connect app `6793354537`.


### The app icon was a placeholder, and had been since build 1

Builds 1 through 4 all shipped a generated placeholder: a flat orange crane glyph on near-black,
37KB at 1024x1024, produced by `scripts/generate_construction_icon.py` in the FleetFlow repo.

Before replacing it, the approved artwork was searched for properly: constructionFlow history
deepened to 84 commits, FleetFlow's full 1019-commit history, every branch, every blob in both
object stores, and the whole working disk. **The only construction icon blobs that have ever
existed in either repository are the three placeholders** (`a76ce666` icon/adaptive, `cf0b3ac0`
splash, `665cf5f6` favicon), byte-identical across both repos. A 799KB `assets/images/icon.png`
does exist in early history under a commit titled *"Use ConstructionFlow branding for app icon,
splash, and favicon"* — it is the stock Expo template chevron, not the branding its message
claims. Recorded so nobody repeats the search.

The approved artwork supplied by the app owner is now in place: 1254x1254 RGB resampled to
1024x1024 with Lanczos, flattened to RGB with **no alpha channel** at every size (an iOS icon
carrying alpha is rejected at submission), applied to `icon`, the Android adaptive foreground,
the splash image and the 48x48 web favicon.

### The finding — audit row 23, the last untouched gap

> "FleetFlow's events REMEMBER. A decision made on day 20 can be referenced on day 60.
> Construction Flow's chains are per-site and short-lived, so the world doesn't accumulate a
> history."

Grep confirmed it exactly. Construction Flow's only event history was `site.chaosHistory` —
capped at 10 entries, scoped to a single job site, and **destroyed when that site completed**.
Nothing survived a finished project. A player on day 200 had a company with no past: the same
events fired, worded the same way, referencing nothing they had ever done.

### `src/systems/companyMemory.js` (new)

A durable, capped chronicle of what the company has done — and, the part that matters, one that
**costs and pays something**. Phase 5's lesson was that advertising an effect and delivering
nothing is worse than never advertising it, so every memory kind feeds a modifier, every
modifier is consumed by the running game, and the tests walk both directions.

**The design rule: your history helps you AND haunts you.** Memory that only granted bonuses
would just be a second perk ladder.

| What you did | What it does to you |
| --- | --- |
| Delivered jobs on time, premium work | `bidEdge` — you win more work |
| Blew deadlines, shipped below-standard | `bidEdge` negative — you win less |
| Paid your supplier up front | `supplierGoodwill` — cheaper materials |
| Took materials and never settled | `supplierGoodwill` negative — dearer materials |
| Paid people properly when they asked | `crewLoyalty` — your crews stay |
| Worked someone to burnout | `crewLoyalty` negative — they leave faster |
| Bought a rival out of the market | `rivalGrudge` — survivors bid against you personally |

Every effect is capped (+/-10% bids, +/-10% materials, +/-50% turnover, -12% from grudges) and
**decays linearly to nothing over 120 days**, so a grudge from a year ago stops pricing your
concrete while staying in the chronicle for the player to read.

### A new decision whose price is not on the invoice

The Supplier Deal event gained a third option: **"Take it, settle later"** — the materials
arrive, nothing is paid, and your supplier remembers. It is the clearest demonstration of the
system: a choice that is obviously correct today and quietly expensive for the next 120 days.

### New — Company Story card on Empire

Three things: what your record has left you standing as, **what your history is doing right now**
(the live modifiers, read from the same resolver the bidding and pricing code reads, so the card
cannot claim an effect the simulation is not applying), and the chronicle itself with each entry
dimmed once it stops counting. Plus callbacks — the world referring back to a specific thing you
did, by name and by date.

### Equipment artwork reaches the decision

Audit gap 5 noted 45 equipment renders shown in only two places. Phase 3 put them on site cards;
the **assignment picker** — the screen where the player actually chooses which machine to send —
was still a plain text list. That is the one place where knowing a grader from a paver changes
the decision. It now carries the artwork, a condition-toned readout, a 44pt tap target and an
accessibility label.

### Fixed — a 1-in-20 flake, and what it was really reporting

The long-run economy test failed roughly 1 run in 20: progress claims exceeding half the
contract value. Build 3 corrected this assertion once already, from the value a site STARTED
with to its current value. **That was still wrong**, and this run found the remaining hole:

> A claim is validated against the contract value AT CLAIM TIME, and released cash is never
> clawed back if the contract is later revalued DOWN.

So $50,000 legitimately released against a $100,000 contract stays on the books after a payment
hold cuts that contract to $93,002, and the naive ceiling of $46,501 is simply the wrong number
to measure against. **The code was right both times.** The assertion now measures against the
high-water mark, and a companion test pins the revalued-down behaviour deliberately so it cannot
regress into an actual overpayment bug. Reproduced at attempt 22 of a loop, then 30 consecutive
clean runs after the fix.

### Found while chasing the flake: six modules were spending your money silently

The 1-in-25 flake turned up something bigger than itself. **Six shared system modules moved the
player's cash and wrote no ledger entry at all** — `randomEvents.js` (nine separate cash
movements), `inventorySystem.js`, `staffPerformance.js`, `employeePersonalities.js` and
`territorySystem.js`.

The reconciler caught the money, because that is what it is for, but by the time it runs all it
can see is that cash moved and no category claimed it. So it filed the lot as **"Financing or
balance transfer"**. A failed health inspection, a theft, an emergency repair, a training
programme and a territory unlock all appeared in Finance as a balance transfer.

That is this effort's recurring defect in a new place: *the number the player reads is not the
thing that happened.* Phase 5 found it in the office ladder's perks; Phase 6 found it in the
ledger. Every one of those thirteen movements is now recorded with the category and the
description of what actually occurred — "Failed health inspection", "Theft loss", "Emergency
repair", "Medical costs", "Contract penalty", not a catch-all.

`__tests__/ledgerInstrumentation.test.js` is the guard: a mechanical source scan that fails if
any new `game.cash` movement in a shared module goes unrecorded, plus eight seeded runs holding
uncategorised cash under **5%** — far tighter than the 25% the original test allowed for all
reconciliation kinds combined. `aiCompetitors.js` is excluded deliberately: it moves
`competitor.cash`, a rival's balance sheet, which correctly never enters the player's ledger.

The flake was cured by instrumenting the money, not by loosening the threshold. 40 consecutive
clean runs of the originally-failing test.

### Save compatibility

One additive field, `companyMemory`, defaulted to `[]` by the migration. **The migration does not
invent a history the player never had** — a build-4 save with 40 completed jobs does not become 40
remembered triumphs; the chronicle starts empty and fills from the day the build is installed. A
corrupted chronicle (wrong type) is repaired rather than crashing the load. Covered by four tests.

### Tests — 439 → 525

- `__tests__/companyMemory.test.js` (37). Leads with **"every declared effect is consumed by the
  game"**, and asserts every memory kind feeds at least one effect and every callback is
  reachable by some history — so neither a dead kind nor dead prose can survive.
- `__tests__/companyMemoryIntegration.test.js` (22). Each test names what the player would feel.
  Includes 400 ticks with no NaN and a bounded chronicle, a job driven to completion through the
  real tick to prove the record is written by the game rather than by the test, and four
  save-compatibility cases.
- `__tests__/ledgerInstrumentation.test.js` (24). The guard described above.
- Two Empire render probes, including the no-history case.
- One new economy test pinning the revalued-down contract behaviour.


### Release (1.0.0, build 4) — the first binary carrying any parity work

- iOS `buildNumber` 3 -> 4. Version stays **1.0.0**: build 1 is what is on TestFlight and
  1.0.0 has never been publicly released, so there is no `CFBundleShortVersionString`
  collision to avoid. Android `versionCode` untouched at 1 (iOS-only build).
- **Why 4 and not 2.** Numbers 2 and 3 were spent in `app.json` by earlier sessions without
  ever producing a binary. Build numbers are not reusable in the App Store Connect sense once
  committed to the release record, and the safe rule is monotonic increase from the highest
  value the source has ever carried. Source said 3, so this is 4.
- **This is the first build to carry ANY of the five parity phases.** TestFlight build 1
  predates Phase 1 entirely. Everything from Phase 1 through Phase 5 lands in this single
  install:
  - Phase 1 — the presentation layer (design tokens, UI primitives, motion, hierarchy)
  - Phase 2 — the construction loop as a game (bidding you can lose, material lead times,
    phase completion, progress payments)
  - Phase 3 — the company you can see (worker standing and voice, equipment economics,
    the while-you-were-away site report)
  - Phase 4 — a market that keeps living (rival lifecycle, new entrants, market news,
    acquisitions that transfer a real business)
  - Phase 5 — the progression ladder pays what it advertises (six formerly phantom perks
    made real, Company Ladder card on Empire)
- Release gate: lint 0 errors (34 pre-existing warnings), typecheck clean, **439/439 tests
  across 23 suites**, Expo config resolves (Construction Flow / 1.0.0 / 4 /
  co.wildbear.constructionflow / EAS project 72e9062c-b382-478a-b226-b3ea5559e117),
  `npx expo-doctor` 19/21 (both failures are network-policy-blocked checks in the agent
  sandbox, not project defects), `npx expo export --platform ios` bundles cleanly.
- Save compatibility: no new save fields and no new migration in this build. Two migrations
  written in earlier phases run against a build-1 save — Phase 2's delivery/claim fields and
  Phase 4's rival-record rewrite — both covered by tests across 8 suites. Installing over
  build 1 rather than deleting the app is the intended upgrade path.
- Identity preserved: bundle identifier `co.wildbear.constructionflow`, EAS project
  `72e9062c-b382-478a-b226-b3ea5559e117`, App Store Connect app `6793354537`, artwork and
  branding untouched.


## Phase 5 — Long-term progression: the ladder now pays what it advertises

### The finding

Construction Flow was not short of late-game content. It has five office tiers, nine cities,
five regional office types, four property types, ten company levels, empire goals, milestones
and achievements. **The problem was that most of what the ladder sold was not real.**

Six perks are advertised on the office upgrade path. Four of them were read by nothing — they
existed only as strings in a data table and on the button the player pressed to buy them:

| Purchase | Advertised | Was it delivered? |
| --- | --- | --- |
| Rented Portakabin, $3,500 | +5% bid win chance | **No** |
| Small Site Office, $15,000 | −10% delay penalties | **No** |
| Project Office, $45,000 | −15% delay penalties | **No** |
| Project Office, $45,000 | −8% material costs | Yes |
| HQ Tower Suite, $110,000 | +12% bid win chance | **No** |
| HQ Tower Suite, $110,000 | −15% material costs | Yes |
| All five regional offices | up to "+80 contract slots" | **No** — board hard-coded 5–7 |
| Office Property, $120,000 | "Eliminates home office rent" | **No** — rent charged regardless |
| Properties | crew capacity | **No** — computed into a dead local, then dropped |

A player could spend $1,620,000 on the Office Property and a National HQ and receive, between
them, nothing at all. This is worse than a missing feature: the game took the money and showed
a confirmation.

### Fixed

- **`src/systems/companyPerkTables.js` (new).** The three progression tables, extracted out of
  `ConstructionFlowScreen.js`. They lived inside the screen, which is how four office perks
  came to be declared in one place and consumed in none.
- **`src/systems/companyPerks.js` (new).** One resolver — `resolveCompanyPerks` — that turns
  everything a company owns into one set of numbers. Every consumer reads it. A perk can no
  longer be advertised in one file and forgotten in another.
- **Bid win chance is real.** All three bid call sites go through `withBidPerks`, so the odds
  shown on the card are by construction the odds that get rolled. Capped at +15%; a bid is
  never a certainty.
- **Delay penalty relief is real.** Applied before the existing 85% cap. Capped at −40%: a
  late job is cheaper, never free.
- **Contract slots are real.** `contractBoardSize` widens the open-contract board from the
  hard-coded floor 5 / cap 7. Capped at +8 so a large company cannot balloon the save.
- **`eliminatesRent` is real.** `dailyOfficeRent` returns 0 for a company that owns its
  building, and the rent line leaves the ledger rather than being written as $0.
- **Property crew capacity is real.** `crewCapBonus` is a new, separate field. `getTotalCrewCap`
  used to compute a property bonus from `equipCapBonus` — a *machine* figure — and then return
  without using it. That dead local is gone.
- **Every rent figure the player reads now matches the money that moves.** Fixing the charge
  alone would have left the Finance tab's net cash flow, the cash-runway warning, the health
  score, the away report's overhead line and the office card all quoting a bill the player no
  longer pays. All six now read `dailyOfficeRent`.

### Honest downgrade: contract slots

The tables advertised 3 / 8 / 18 / 35 / 80 extra contract slots. Delivering "+80" literally
would put eighty contracts on the board — unreadable, and a save-size problem earlier phases
already fought. **The honest fix for a promise that large and that false is to make the promise
smaller and true**, not to keep the number and ship an absurdity. The tables now advertise
1–5 extra contracts and deliver exactly that.

### New — Company Ladder card on the Empire tab

`describePerkSources` and `nextOfficeUpgrade` feed a card that answers three questions a
progression system has to answer and this one could not: where am I (rung *n* of 5), what is
each building I bought actually giving me, and what does the next rung cost. Every figure on it
is a perk the simulation applies — which is why a card like this could not honestly have been
drawn before this phase.

### Tests — 388 → 439

- `__tests__/companyPerks.test.js` (30). Headline block: **"every advertised perk is
  delivered"** walks the data tables and fails if any declared perk goes unclaimed. This is the
  guard that stops a perk becoming decorative again.
- `__tests__/companyPerksIntegration.test.js` (18). Each test names the money the player was
  spending on nothing. Includes a 400-tick run with everything owned (no NaN capacity or cost),
  a legacy-save resolve, and source scans asserting the screen reads the resolver rather than
  the raw table.
- Three Empire-tab render probes, including the top-of-the-ladder case and the no-rent case.

### Near-miss caught by the integration tests

`getTotalCrewCap` was rewired to the resolver but not exported, so the integration test could
not reach it — a reminder that Phases 1–4 each had wiring that was written, tested in isolation
and never connected. That is the point of running integration tests against the real screen
rather than only the module.

### Save compatibility

No new save fields and no migration. `resolveCompanyPerks` reads `officeIndex`, `cityOffices`
and `properties`, which every existing save already carries, and coalesces missing values.
A build-1 save loads and resolves correctly — covered by test.

### Not shipped

`ios.buildNumber` is **unchanged at 3**. Build 3 has not been tested on device yet, and the
standing recommendation is still to install it before stacking another build on top.


### Release (1.0.0, build 3)

> **Correction (Phase 5).** The two bullets below originally said builds 1 and 2 "went to
> TestFlight" and that build 2 "was cut but never installed." **That was wrong, and it mattered.**
> A TestFlight screenshot on 2026-09-21 shows the device on `1.0.0 (1)`. Numbers 2 and 3 exist
> only as an `ios.buildNumber` value in `app.json` — a field in a JSON file. Bumping it produces
> nothing. No binary was ever built or uploaded from this work: there is no EAS CLI and no Expo
> auth in the agent sandbox, and no CI workflow in this repo, so nothing here *could* have cut a
> build. **Build 1 is the only build that has ever existed**, and it predates Phase 1.
>
> The general lesson, which is the same one this whole parity effort keeps finding: a version
> number written down is not a version number shipped, exactly as a perk written in a data table
> is not a perk the player receives. Release state has to be read from the store, not from the
> repo.

- iOS `buildNumber` 2 -> 3 **in `app.json`**. Version stays **1.0.0**: build 1 went to TestFlight
  under it and it has not been publicly released, so there is no `CFBundleShortVersionString`
  collision to avoid. Android `versionCode` untouched.
- Whenever a build *is* cut, it will be the first one carrying any of the parity work.
  Everything from Phase 1 onward lands in that single install.
- Release gate: lint 0 errors (35 pre-existing warnings), typecheck clean, 388/388 tests,
  `npx expo-doctor` 19/21 (both failures are network-policy-blocked checks in the sandbox),
  `npx expo export --platform ios` bundles cleanly. The suite was run three times to
  confirm the claim-schedule flake fixed above is genuinely gone.

**What to look at on device**, in priority order, since none of it is testable from here:

1. **Does amber read right?** It is the primary action colour on every screen. Biggest
   aesthetic bet in the whole run of work.
2. **Install over your build-1 save, don't wipe.** Two migrations now run on it: Phase 2's
   delivery/claim fields and Phase 4's rival-record rewrite. Both are test-covered; only your
   device proves it.
3. **Bidding.** You can lose one now. The first contract is guaranteed and the odds are always
   on screen before you commit. Tension, or noise?
4. **Material lead time.** A job can sit stalled two days waiting on concrete. Drama, or dead
   air? `NORMAL_DELIVERY_DAYS` in `src/systems/constructionLoop.js` is a one-line change.
5. **Crew, Equipment and Empire** — tightest rows, largest type increase. Wrapping or clipping
   shows up there first.
6. **Market news on Home.** Does a living market read as interesting, or as chatter?

### Fixed — a flaky test, and what it revealed

Cutting build 3 surfaced a test that failed roughly 1 run in 400: a job's progress claims
exceeding the documented cap. The code was right and the test was wrong, but the reason is
worth recording. **A contract's value legitimately changes mid-job** — a Scope Change or
Client Praise event adds to `site.totalValue`, a payment hold subtracts from it — and claims
are certified against what the job is worth *now*. The test had pinned the value the job
started with.

`finalPaymentDue` already tolerated this in both directions (it computes the handover balance
from the current value, so a rise self-corrects and a fall simply owes nothing rather than
clawing cash back), but nothing asserted it. There is now an explicit test for a contract
revalued up and down mid-job.

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
