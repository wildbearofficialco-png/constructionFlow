# FleetFlow → Construction Flow Parity Audit

**Audited:** 2026-09-21
**Reference:** `wildbearofficialco-png/Fleetflow` @ `501c755` — FleetFlow Simulator 1.3.4 (build 59), 59 TestFlight builds of real-device feedback behind it.
**Subject:** `wildbearofficialco-png/constructionflow` @ `347d38a` — Construction Flow 1.0.0 (build 1), first TestFlight build.

This document exists because Construction Flow was played side by side with FleetFlow on a
physical iPhone and read as clearly less finished. This is the root-cause analysis of *why*, not
a feature wish list.

---

## 0. The headline finding

**Construction Flow is not missing the simulation. It is missing the presentation layer that
makes a simulation legible.**

Construction Flow already runs: project phases, crew stamina/morale/specialties, equipment wear
and breakdowns, materials with regional pricing, a lending ladder with credit scoring, insurance,
safety and compliance scores, taxes, AI rivals with bankruptcy and acquisition, weather, chaos and
decision events, offline progression, achievements, milestones, prestige/legacy, client
relationships, territories and a regional economy. Its `freshState()` carries ~110 top-level keys.
FleetFlow's simulation is deeper in places, but not by the margin the side-by-side suggests.

The gap the player actually feels is measurable:

| Measure | FleetFlow | Construction Flow | Effect on the player |
|---|---|---|---|
| Named styles in the screen's stylesheet | 92 distinct | **32 distinct** | Nothing is consistent; every card is hand-assembled |
| Stylesheet is theme-aware | Yes — `createStyles(COLORS)`, memoized on theme | **No** — one static sheet, colors re-applied inline at 503 call sites | Light mode is stitched together by hand and drifts |
| Inline `style={{` sites per 1000 lines | 28 | **47** | 1.7× more ad-hoc styling, so 1.7× more drift |
| Font sizes ≤ 10px | 70 of 383 (18%), nearly all uppercase eyebrow labels | **134 of 262 (51%)**, including body copy at 9px | **This is the single most visible quality gap on a real iPhone** |
| Shadow / elevation uses | 5 | **1** | Cards sit flat on the background; no depth, no hierarchy |
| `accessibilityRole` / `accessibilityLabel` | 9 / 8 | **1 / 1** | VoiceOver reads the screen as undifferentiated text |
| Reusable UI primitives | `Pill`, `ProgressBar`, `StatMini`, `MiniCompare`, `SectionToggle`, `SectionHeader` | **none** | Every badge and bar is rebuilt from scratch, slightly differently |
| Motion / haptics layer | `fleetflowMotionHelpers`, `fleetflowHaptics`, `fleetflowPresentationMoments`, reduced-motion respect | **none** | Nothing acknowledges the player's actions |
| Regression tests | **104 files** | 12 files / 100 tests | Changes are riskier; device bugs recur |
| Extracted helper modules | 48 files, 408 KB `src/utils/` | **0** — one 10.7k-line screen file | Logic can't be tested without rendering |

**The three sentences that explain the whole gap:**

1. FleetFlow has a **design system**; Construction Flow has a stylesheet with 32 entries and 503
   inline overrides.
2. FleetFlow's screens have **typographic hierarchy** (an uppercase 10px eyebrow above a 15px
   value above a 12px explanation); Construction Flow renders most of its content at one small
   size, so nothing stands out and everything must be read.
3. FleetFlow **acknowledges the player** (pulses, entrance animations, haptics, an inbox that has
   to be marked handled); Construction Flow displays state and waits.

Everything below is downstream of those three.

---

## 1. Parity matrix (40 categories)

Classification:
- **EQUIVALENT** — Construction Flow is at FleetFlow's level.
- **PARTIAL** — present, but below FleetFlow's product quality.
- **MISSING** — not implemented.
- **N/A** — inappropriate for a construction simulator.
- **ADAPT** — needs a construction-specific translation, not a copy.

| # | Category | Status | FleetFlow reference | Construction Flow today | Why FleetFlow feels better |
|---|---|---|---|---|---|
| 1 | Onboarding | **PARTIAL** | `renderSetup`, `fleetflowOnboardingHelpers`, 5 tutorial steps, dismissible per-tab tips, company logo picker | `renderSetup` + 4-step Getting Started card, tutorial-target dot on the tab bar | FleetFlow's tips are *per tab and dismissible*, so guidance follows the player instead of living in one card on Home. Construction Flow's tutorial card competes with 21 other cards on the same screen. |
| 2 | Home / dashboard | **PARTIAL** | One grouped "FleetFlow Command" card with internal dividers (Cash/Net Worth tiles → today's world → opportunity → competitor watch → quick alerts), then Health, then Warnings | **22 sequentially stacked full-width cards**, each with its own border and emoji title | FleetFlow **groups related facts inside one card** using `borderTopWidth` dividers and uppercase section eyebrows. Construction Flow gives a card to every fact, so the player scrolls a list instead of reading a dashboard. |
| 3 | Navigation | **PARTIAL** | 6 tabs: Home / Dispatch / Fleet / Team / Finance / Industry | 7 tabs: Home / Bids / Sites / Crew / **Vehicles** / Finance / Empire | Construction Flow's equipment tab is literally named **"Vehicles"** — a leftover from the FleetFlow fork, in a game about excavators. 7 tabs is also at the top of the WildBear UI Standard's 5–7 range while carrying a redundant Bids/Sites split. |
| 4 | Visual hierarchy | **PARTIAL** | Uppercase 10px eyebrow (`letterSpacing: 1, textTransform: "uppercase"`) → 15–34px value → 12px explanation, used consistently | Emoji + 15px `styles.label` for every section, regardless of importance | FleetFlow's eyebrow/value/caption triad means a player's eye lands on the number first. Construction Flow's titles are all the same weight, so the screen has no entry point. |
| 5 | Cards | **PARTIAL** | `borderRadius: 12–20`, tinted borders (`accent + "44"`), 4px left accent stripe, shadow + elevation on hero cards | `styles.card` = `borderRadius: 10, borderWidth: 1`, flat, no shadow anywhere but one | Depth and the accent stripe let FleetFlow rank cards by importance without words. Every Construction Flow card looks equally important. |
| 6 | Typography | **PARTIAL** | 18% of sizes ≤10px, used for eyebrows | **51% ≤10px, 34 uses of 9px including body copy** | This is the gap the eye catches first at arm's length on a phone. Construction Flow's site cards are readable but *effortful*. |
| 7 | Colors | **ADAPT** | Dark navy + blue/cyan primary | **Byte-identical `THEMES` object to FleetFlow's** — same navy, same blue/cyan primary | Construction Flow currently has *no visual identity of its own*. It is FleetFlow's palette with different words. Construction orange/amber is used as an occasional accent, never as the primary. |
| 8 | Spacing | **PARTIAL** | `screenPad: { padding: 16 }`, consistent `gap` usage, `marginBottom: 10/12` rhythm | `padding: 12` / `14` depending on tab; margins 2/3/4/5/6/8/10 ad hoc | No spacing scale, so vertical rhythm is irregular and the screens feel cramped. |
| 9 | Buttons | **EQUIVALENT** | `styles.btn` + variants, clear action verbs | `styles.btn`, `styles.smallBtn`, clear verbs ("Mobilise", "Buy Materials") | Construction Flow's button copy is genuinely good. Tap targets on the 9px inline buttons in site cards are below the 44pt guideline. |
| 10 | Empty states | **PARTIAL** | `getFleetFlowEmptyStateMessage(tab)` — one helper, a message per tab | Good empty state on Sites and Bids; Crew/Equipment/Finance have bare one-liners or nothing | Inconsistent: the player learns some empty screens explain themselves and some don't, so they stop trusting them. |
| 11 | Notifications | ~~PARTIAL~~ **fixed in Sprint 8** | Executive Inbox with **unresolved action items the player must "Mark Handled"**, urgent items promoted to a red card, 160 `Alert.alert` call sites | `importantNotice` (one at a time, tap to dismiss), ops feed, 36 `Alert.alert` | FleetFlow's inbox *persists a decision* — something is waiting for you. Construction Flow's notice is a banner that disappears; nothing accumulates, so nothing feels owed. |
| 12 | Progress indicators | **PARTIAL** | `ProgressBar` component + `getFleetFlowProgressTone(percent)` so color means the same thing everywhere | Hand-built `View` pairs at ~30 sites, heights 3/4/6, colors chosen ad hoc per site | Same bar means the same thing in FleetFlow. In Construction Flow a cyan bar means phase progress in one card and something else two cards down. |
| 13 | Jobs / contracts | **PARTIAL → fixed in Phase 2** | Contract marketplace, competitive bidding, `fleetflowContractPresentation` view-model | `BidsScreen`, `CONTRACT_DEFS` (256 defs), categories, bid styles, rival bidding | Originally scored EQUIVALENT from the feature list — wrongly. Reading the code showed the bid style was read by *nothing* except the payout multiplier, so Premium was +28% for free and the central decision of the loop was fake. Fixed in Phase 2: bid style now moves win probability, with the odds shown before committing. |
| 14 | Employees | **PARTIAL** | Personalities, loyalty, morale, XP, specialization, turnover, poaching, driver comfort, Talent folded into Team | Crew traits, specialties, stamina, mood, career levels, training, promotion, turnover, subcontractors, PM tiers | Systems are close to parity. FleetFlow surfaces *the person* (name, trait, mood, a line of dialogue); Construction Flow surfaces `Dave · Concreter` at 10px with a Remove button. |
| 15 | Equipment | ~~PARTIAL~~ **fixed in Phase 3 + 6** | `vehicleLifecycle`, `equipmentWear`, divisions, paint/wrap, used market | Same `equipmentWear` module, 45 equipment PNGs, upgrades, condition, maintenance | ~~45 pieces of equipment artwork shown in exactly two places.~~ Phase 3 put the artwork on site cards; Phase 6 put it in the **assignment picker**, the screen where the player actually chooses which machine to send and the one place where telling a grader from a paver changes the decision. |
| 16 | Maintenance | **EQUIVALENT** | `scheduleMaintenance`, breakdown risk, preventative maintenance | Same module, `handleRepairEquipmentNew`, condition gates | Parity. |
| 17 | Financing | **EQUIVALENT** | `lendingEngine` + `LENDING_PRODUCTS` ladder, underwriting, repossession | **Same two modules, shared verbatim** | Parity. |
| 18 | Banking | **PARTIAL** | Operating account, savings, credit line, repossession threshold | `savings`, `creditLine`, `loans`, `debt` | Present but thinly surfaced — savings appears as a 10px chip in the header. |
| 19 | Cash flow | **PARTIAL** | Weekly P&L, `financialLedger` categories, reconciliation | Same `financialLedger` module, weekly stats, `projectEconomics` per-project P&L | **`buildProjectEconomics` is a genuinely excellent Construction Flow original** — live per-project running cost vs. contract value. It is buried inside a site card at 10px. This should be a headline number. |
| 20 | Taxes | **EQUIVALENT** | Tax due, overdue days, business freeze | `taxDue`, `taxOverdueDays`, `businessFrozen` | Parity. |
| 21 | Payroll | **EQUIVALENT** | Daily wages, overtime, standby rate offline | `wagePerDay`, overtime site mode, offline wage accrual | Parity. |
| 22 | Insurance | **EQUIVALENT** | Claims, deductible | `INSURANCE_PLANS`, `applyInsuranceClaim`, `insuranceDeductibleMult` | Parity. |
| 23 | Random events | ~~PARTIAL~~ **fixed in Phase 6** | `randomEvents` + CEO event catalog, **chains** (`fleetflowCeoEventChains`) and **memory** (`fleetflowCeoEventMemory`) — an event can reference an earlier decision | `CHAOS_EVENTS`, `DECISION_EVENTS`, `EMPLOYEE_EVENTS`, `checkChainEvents` | **This was the last untouched gap, and it was exactly right.** Construction Flow's only event history was `site.chaosHistory` — capped at 10, scoped to one job site, destroyed when that site completed. Nothing survived a finished project. Phase 6 added `src/systems/companyMemory.js`: a durable capped chronicle whose entries feed four live modifiers (bid edge, supplier goodwill, crew loyalty, rival grudge), decay over 120 days, and are surfaced on an Empire Company Story card with callbacks that name the specific thing the player did. History helps *and* haunts — buying the market out earns a grudge. |
| 24 | Weather | **ADAPT** | `weatherRouteConditions` — affects route time | Same module + `getConstructionWeatherDelay`, `applyWeatherEvent`, regional risk labels | Construction Flow's weather is *better suited to the genre* (rain halts excavation) but reads as one 9px line on a site card. This should be one of the game's signature moments. |
| 25 | AI competitors | **PARTIAL → fixed in Phase 4** | `aiCompetitors` + **4 dedicated helper modules (890 lines)**: rival identity, rival market, rival investment, rival events. New entrants when the field thins. Narrated growth ("opened a gravel yard, added 2 vehicles and hired 2 drivers"). Escalating decline lines before bankruptcy. RNG-free news builders. | **Identical `aiCompetitors.js`**, plus `enhancedRivalDailyLogic` (240 lines) and `enhancedRivalBidding` inline in the screen | Two structural risks FleetFlow already hit and fixed, that Construction Flow still carries: **(a)** no new-entrant path — acquire or bankrupt all 5 rivals and the market is permanently dead; **(b)** rival news goes to the same capped ops log as the player's own events, so rival activity pushes the player's operations out of their own feed. FleetFlow's build 59 changelog is the exact post-mortem. |
| 26 | Rival growth | **PARTIAL → fixed in Phase 4** | Narrated from movements the sim already produced — growth reads like a company doing things | `rival.activeJobs`, cash, rep, `cityPresence`, restructure after 90 days | Construction Flow's rivals grow numerically but are *described* generically. FleetFlow derives the sentence from the actual delta, so it never lies and always reads specific. |
| 27 | Reputation | **EQUIVALENT** | Rep tiers, badges | `REP_TIERS`, `getRepTier`, badge + label | Parity. |
| 28 | Client relationships | ~~PARTIAL~~ **fixed in Sprint 7** | Customer satisfaction, repeat contracts, tier ceilings, transfers on acquisition | `clientRelationships`, `CLIENT_ROSTER`, `getClientTier`, `pendingRepeatClients` | ~~Collapsed inside a `CollapsibleSection`, so most players never open it.~~ Sprint 7 promoted it to a card at the same level as what it competes with, leading with what loyalty is worth in money rather than hiding the tier bars behind a tap. |
| 29 | Offline progression | **PARTIAL → fixed in Phase 3** | Narrative line items: deliveries completed, late arrivals, earnings, wages, fuel, overhead, net | KPI tiles (cash Δ, cash now, jobs, rep) + last 6 log lines + overhead/day | Construction Flow's tiles are good, but **the summary never says what happened to the projects** — no "Foundation 42% → 67%", no material spend, no weather delay, no progress payment. The player's actual question ("what happened to my job sites?") is unanswered. |
| 30 | Daily / weekly progression | **EQUIVALENT** | Daily goal, login streak, weekly challenge, weekly report | On-time streak, weekly challenge, weekly report, `consecutiveLoginDays` | Systems parity; `consecutiveLoginDays` is tracked but **never rendered**. |
| 31 | Milestones | **EQUIVALENT** | `fleetflowProgressionHelpers`, milestone defs | `MILESTONE_DEFS`, `checkMilestones`, `pendingCelebration` | Parity. |
| 32 | Achievements | **EQUIVALENT** | Achievement list + checks | `ACHIEVEMENTS_LIST`, `checkAchievements` | Parity. |
| 33 | Properties | ~~EQUIVALENT~~ **PARTIAL → fixed in Phase 5** | Investment properties, branches | `PROPERTY_TYPES`, `properties`, `REGIONAL_OFFICE_TYPES` | **This row was wrong, and Phase 5 corrected it.** The tables were at parity; the *consumers* were not. The $120,000 Office Property's entire pitch — "eliminates home office rent" — was read by nothing, and property crew capacity was computed into a dead local and dropped. Content parity is not the same as the content doing anything. |
| 34 | Expansion | ~~EQUIVALENT~~ **PARTIAL → fixed in Phase 5** | Branches, staffing, transfers, territory | `cityOffices`, `CITIES`, `unlockedCities`, `territorySystem` | Same correction. All five regional office types advertised contract slots, up to "+80" on a $1,500,000 National HQ; the open-contract board was hard-coded to a floor of 5 and a cap of 7 regardless of what the player owned. |
| 35 | Company growth | **EQUIVALENT → extended in Phase 5** | Company eras, levels, valuation, net worth | `COMPANY_LEVELS`, `computeValuation`, `computeNationalRank`, `computeMarketShare` | Parity, and Construction Flow's Level card with three progress bars (Rep/Jobs/Value) is *better* than FleetFlow's equivalent. Phase 5 added the missing half: a Company Ladder card saying where the player is on the office ladder, what each building they own actually gives them, and what the next rung costs. |
| 36 | Reports | ~~PARTIAL~~ **fixed in Sprint 7** | Weekly report, economy balance, industry dashboard | Weekly report card, `analyticsEngine`, `economicHistory` | `economicHistory` and `analyticsEngine` are ticked every day and almost never shown. |
| 37 | Analytics | ~~PARTIAL~~ **fixed in Sprint 7** | `fleetflowIndustryDashboardHelpers` + a whole Industry tab | Same `analyticsEngine` module; no dedicated surface | **This row was wrong in an important way.** The data was not merely unseen — `analyticsEngine` is FleetFlow's, and every input it reads (`weeklyStats.completedRoutes`/`routeIncome`/`wages`, status `"En Route"`, `customerRating`) is a field Construction Flow does not have, so every snapshot was zeros, a permanent 100% on-time rate and 0% utilisation. Surfacing it would have been worse than hiding it. Sprint 7 replaced it with `src/systems/constructionKPIs.js`: eight construction-native measures computed from crew, plant, the ledger, job history and new bid counters, with absent data shown as "not enough history yet" rather than zero. |
| 38 | "What should I do next?" | **PARTIAL** | `getFleetFlowNextStepHint`, AI Dispatcher advisor card with tone, `getPredictiveWarnings` with **inline `action →` links that jump to the right tab** | `getNextBestAction`, `getPredictiveWarnings` | **Defect found: Construction Flow renders Next Best Action twice on Home** (lines 6573 and 6831 of `ConstructionFlowScreen.js`) — same `getNextBestAction(game)` result, two different card designs, ~250 lines apart. Also, Construction Flow's Early Warnings are bullet dots with no way to act on them; FleetFlow's each carry a tap target to the relevant tab. |
| 39 | Failure states | **EQUIVALENT** | Emergency bailout, owner deposit, local grant, recovery buttons | `recoveryGuidance` module (shared), `bankruptcyDays`, `gameOver`, `activeGrant` | Parity. |
| 40 | Late-game depth | **PARTIAL** | Prestige, legacy perks, eras, investors, holdings, CEO events, acquisitions that transfer a real business | Prestige, `LEGACY_PERKS`, `EMPIRE_GOALS`, `acquiredRivals`, hall of fame | FleetFlow's build 58 overhauled acquisitions so buying a rival transfers their fleet, crew, clients and cash. Construction Flow's acquisition still removes a rival and pays reputation — **exactly the defect FleetFlow shipped a fix for**, already diagnosed in its changelog. |

### Not appropriate to copy (N/A)

| FleetFlow system | Why it doesn't translate |
|---|---|
| Dispatch / auto-dispatch loop | A construction crew is *mobilised to a site for weeks*, not dispatched per-run. Construction Flow's crew-assignment-per-site is the correct translation and should not be turned into a dispatch queue. |
| Route selection & mileage | No route. Equipment hours and site days are the construction equivalents, and both already exist. |
| Vehicle paint / wrap customization | Livery is a trucking-identity mechanic. Construction identity is equipment *capability and condition*, not paint. |
| Per-run cargo/freight tiers | Replaced by project phases and material requirements, which Construction Flow already has and which are a better fit. |

### Concept translation table

| FleetFlow | Construction Flow |
|---|---|
| Drivers | Operators, labourers, carpenters, concreters, steelworkers |
| Dispatch | Crew mobilisation to a job site |
| Routes | Active job sites |
| Vehicles | Equipment (excavators, dozers, cranes, trucks) |
| Clients | Project owners / developers / municipalities |
| Delivery completion | Phase completion → inspection → final handover |
| Fuel | Fuel **plus** materials (concrete, lumber, steel, electrical, plumbing, asphalt) |
| Branches | Regional offices and yards |
| Cargo tier | Project class (Residential → Commercial → Infrastructure → Government → Mega) |
| Late delivery penalty | Liquidated damages per day past contract deadline |
| Rival carriers | Rival general contractors bidding the same RFPs |

---

## 2. The biggest 10 gaps, and why each one matters to the player

### 1. No design system — 32 styles carrying 503 inline overrides
**Why it matters:** The player never consciously notices a spacing scale. They notice that
FleetFlow looks like a product and Construction Flow looks like a build. Consistency *is* the
polish. With 503 inline style objects, two cards showing the same kind of information don't
match, and the eye reads that mismatch as "unfinished" before reading a single word.

### 2. Half the text is 10px or smaller
**Why it matters:** This is the one that costs the player actual effort. A site card holds crew
names, equipment condition, material counts, phase progress and running P&L — all at 9–10px.
On a phone at arm's length that's not a dashboard, it's a document. FleetFlow keeps its 10px
strictly for uppercase eyebrow labels and puts content at 12–16px.

### 3. Home is 22 stacked cards, not a dashboard
**Why it matters:** The player opens the app to answer three questions: *how much money do I
have, what's happening on my sites, what should I do next?* Construction Flow can answer all
three — but it makes the player scroll past a Company Health card, an Early Warnings card, a
Next Best Action card, a streak card, a challenge card, a weekly report card, a client card, a
priorities card, a CEO dashboard card, a **second** Next Best Action card, a speed-up card, a
legacy card, a KPI row, a market banner, a sites summary, a P&L card, a deal card, an ops feed
and a rival feed. FleetFlow groups the same information into one Command card with internal
dividers. Grouping is what makes it feel designed.

### 4. Construction Flow has FleetFlow's exact color palette
**Why it matters:** The user asked for a construction identity. Right now the `THEMES` object is
byte-identical to FleetFlow's — same navy, same blue-and-cyan primary. Played side by side, they
look like the same app with different nouns. Amber/safety-orange as the *primary* action color,
with safety green reserved for "go/safe" and hazard red for "stop", would give the game an
identity the player recognises in one second.

### 5. 45 pieces of equipment artwork, shown in two places
**Why it matters:** This is Construction Flow's biggest unfair advantage over FleetFlow and it is
being wasted. FleetFlow's own `VehicleImage` component isn't even used in its screen. Putting the
excavator on the site card, in the assignment picker and in the dashboard's active-site strip
would immediately make Construction Flow look *richer* than its benchmark — at zero simulation
cost, using assets already in the repo.

### 6. The simulation is invisible — nothing acknowledges the player
**Why it matters:** FleetFlow pulses the cash figure when it rises, animates a milestone card in,
fires a haptic on a button, and respects Reduce Motion while doing it. Construction Flow has
`Animated` imported and unused. The player does a thing, the number changes, and the app says
nothing. That silence is most of the "feels less alive" impression.

### 7. Next Best Action is rendered twice on Home
**Why it matters:** A player reading the same advice twice in one scroll concludes the app is
broken, and they're not wrong. It also means the advice is never *prominent* — two medium cards
instead of one strong one.

### 8. The equipment tab is called "Vehicles"
**Why it matters:** It's the single clearest tell that this is a fork. A construction company
owns equipment, plant and a yard. Naming it "Vehicles" tells the player, in one word on every
screen, that this game is a re-skin.

### 9. Offline return doesn't say what happened to the job sites
**Why it matters:** "Cash +$8,200" without "Foundation 42% → 67%, material delivery arrived,
one rain day" is a bank statement, not a story. The user's own example in the brief is exactly
right, and Construction Flow's `applyOfflineProgress` already computes everything needed — it
just doesn't record the per-site deltas into `pendingOfflineSummary`.

### 10. The market can die permanently, and rival news crowds out the player's own
**Why it matters:** FleetFlow shipped both fixes in build 59 after a player acquired all five
competitors and found an empty, permanently dead market. Construction Flow has the same
five-rival fixed roster, the same bankruptcy path, the same `acquiredRivals` exclusion — and no
new-entrant path. Its rival news also writes to `logs`, the same capped feed as the player's own
operations. Both are known, already-diagnosed defects sitting in Construction Flow's code today.

---

## 3. Highest-impact improvements, ranked by player-felt value per hour of work

| Rank | Improvement | Effort | Player impact |
|---|---|---|---|
| 1 | Construction design system (tokens) + 8 UI primitives, applied to Home and Sites | M | **Very high** — fixes gaps 1, 2, 3, 4 at once |
| 2 | Typography floor: no body copy below 12px, eyebrows at 11px | S | **Very high** — the most visible single change |
| 3 | Equipment artwork on site cards, pickers and the dashboard | S | **High** — free richness from existing assets |
| 4 | Rebuild Home as: Command card → alerts → next action → active sites → everything else collapsed | M | **High** — makes the game answerable in 3 seconds |
| 5 | Motion feedback (pulse on cash rise, entrance on celebration), reduced-motion aware | S | **High** — the "alive" feeling, no new dependency |
| 6 | Rename Vehicles → Equipment | XS | **High per unit effort** — identity |
| 7 | Remove the duplicate Next Best Action | XS | **Medium** — removes a "this is broken" signal |
| 8 | Per-site deltas in the offline return report | S | Medium-high |
| 9 | Rival market entrants + rival news to its own feed | M | Medium (protects late-game) |
| 10 | Acquisitions that transfer crew, equipment, clients and cash | L | Medium (late-game only) |

---

## 4. Recommended phased roadmap

**Phase 1 — UX + visual parity** *(this PR)*
Design system, UI primitives, motion layer, Home rebuild, Sites readability pass, empty states,
typography floor, tab rename, duplicate-card fix. **No simulation changes.**

**Phase 2 — Core construction loop** *(shipped — see CHANGELOG.md)*
Bid → win → prepare → crew → equipment → materials → build → problems → phases → inspection →
handover → payment, each step given a clear moment and clear feedback.

The audit above ranked this second on effort-to-impact. Reading the loop's code turned up
something the category-by-category pass had missed, because it is invisible from the outside:
**two of the loop's three player decisions were dominated options, not decisions.** The bid
style moved the payout and nothing else, so Premium was +28% money for free. An emergency
material order cost 1.5× and arrived at the same instant as a normal one, because both were
instant. Both are now real trades — the bid style moves the probability of *winning*, and
normal orders take days to arrive while work stalls. Phase completion, deliveries and progress
claims each got the moment they lacked. The loop's pure logic lives in
`src/systems/constructionLoop.js` with 68 tests.

Still open from this phase, deliberately deferred: equipment artwork in the bid and completion
screens, and the inspection beat (which already has a modal but no player decision in it).

**Phase 3 — Living company** *(shipped — see CHANGELOG.md)*
Employees as people (name, trait, a line of their own), equipment lifecycle surfaced, offline
report with per-site deltas.

The finding for this phase was that the company is **simulated but not witnessed**: the game
knew a worker was exhausted and three days from quitting and said nothing until they went.
Crew cards now lead with where the person actually is, what their standing at the company is,
what needs acting on, and a line in their own voice. Machine cards answer "is this making me
money" with a verdict, utilisation and resale. The away report says what happened to each job.
Logic lives in `src/systems/companyLife.js` with 64 tests — including a direct test that none
of the new flavour text consumes an RNG draw, which is FleetFlow's build 59 defect.

Still open from this phase, deliberately deferred to a later pass: **finance and analytics
reports** (`economicHistory` and `analyticsEngine` are ticked daily and still almost never
shown — audit rows 36 and 37), and **inspections as a player decision** rather than a result
delivered by the tick.

**Phase 4 — Living market** *(shipped — see CHANGELOG.md)*
Rival contractors that bid visibly against the player, narrated growth and decline, new entrants,
rival news in its own feed, acquisitions that transfer a real business.

Every defect FleetFlow's builds 58 and 59 fixed was still present here, plus four of Construction
Flow's own: a market that died permanently, an entrant that could never bid (the exact trap
FleetFlow names), rival news crowding the player's own ops log, **two competing bankruptcy
systems sharing one field with opposite meanings** (with the second's recovery unreachable),
two counters for one thing, `createRivals()` minting records with no `status` at all, and
acquisitions that transferred 1–3 generic workers and nothing else. Logic lives in
`src/systems/rivalMarket.js` with 80 tests.

Still open, deliberately deferred: **regional demand** and a market that responds to the
player's own dominance in a city.

**Phase 5 — Long-term progression** *(shipped — see CHANGELOG.md)*
Yards, offices, geographic expansion, company tiers, milestones, achievements, late-game goals.

The finding inverted the expectation. Construction Flow was **not** short of late-game content —
five office tiers, nine cities, five regional office types, four property types, ten company
levels, empire goals, milestones and achievements were all already there. **What was missing was
any of it being true.** Four of the six office perks, the contract-slot promise on all five
regional offices, the $120,000 Office Property's no-rent pitch and property crew capacity were
read by nothing: strings in a data table and on the button the player pressed to buy them. A
player could spend $1,620,000 and receive nothing but a confirmation dialog.

Perks are now resolved in one place (`src/systems/companyPerks.js`, tables in
`companyPerkTables.js`) and consumed everywhere, with a test that walks the data tables and
fails if any declared perk goes unclaimed. The advertised contract-slot numbers were reduced
from 3/8/18/35/80 to 1–5 and are now delivered exactly — the honest fix for a promise that large
and that false is to make the promise smaller and true. A Company Ladder card on the Empire tab
shows where the player stands and what each purchase bought them.

Still open, deliberately deferred: **mega-projects** (multi-site contracts spanning months),
and audit rows 36/37 — `economicHistory` and `analyticsEngine` are still ticked daily and almost
never shown.

---

## 5. Files and systems involved

| Area | Files |
|---|---|
| Everything visual | `src/games/constructionflow/ConstructionFlowScreen.js` (10,738 lines — the whole game) |
| Shared primitives | `src/components/` (currently only `CollapsibleSection.js`) |
| Simulation modules (shared with FleetFlow, mostly at parity) | `src/systems/*.js` (25 files) |
| Construction-specific | `src/systems/projectEconomics.js`, `constructionRegionalEconomy.js`, `recoveryGuidance.js` |
| Artwork | `assets/construction/equipment/` (45 PNGs), `assets/construction/office/` (5 PNGs) |
| Tests | `__tests__/` (31 files, 623 tests — 12 files / 100 tests at audit time) |
| Release config | `app.json` (`ios.buildNumber`, bundle id `co.wildbear.constructionflow`), `eas.json` |

**Missing infrastructure Construction Flow should grow, mirroring FleetFlow's `src/utils/`:**
`src/theme/`, `src/components/ui/`, `src/utils/` for extracted, testable presentation logic.

---

## 6. Scope of the first implementation PR (Phase 1)

**In scope — presentation only. No simulation, economy, or save-format change.**

1. `src/theme/constructionTheme.js` — construction identity tokens: color roles (amber primary,
   safety green, hazard red, charcoal/navy surfaces), type scale, spacing scale, radius scale,
   elevation, plus pure helpers (`toneColor`, `progressTone`, `compactMoney`, `emptyStateFor`).
2. `src/components/ui/` — `Card`, `SectionLabel`, `Pill`, `StatTile`, `ProgressBar`, `EmptyState`,
   `AlertBanner`, `KeyValueRow`.
3. `src/utils/constructionMotion.js` — `useOsReducedMotion`, `usePulseOnIncrease`,
   `useEntranceAnimation` (React Native `Animated` only, no new dependency).
4. Home rebuilt around the new primitives with a real hierarchy; the duplicate Next Best Action
   removed; Early Warnings given tap-to-tab actions.
5. Sites readability pass — typography floor applied, equipment artwork on assignment rows.
6. Consistent empty states across all seven tabs.
7. Tab rename `Vehicles` → `Equipment`, with save back-compatibility.
8. New tests for every pure helper and for the invariants above.

**Out of scope for this PR:** anything that changes what the simulation does, `app.json`
build number, new native dependencies (so `expo-haptics` waits for Phase 1b), and a TestFlight
build.

**Acceptance:** `npm run lint`, `npm run typecheck`, `npm test`, `npx expo-doctor`, and
`npx expo export --platform ios` all pass; existing saves load unchanged.
