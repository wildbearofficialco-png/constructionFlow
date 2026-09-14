# FleetFlow Simulator → Construction Flow Parity Matrix

Reference: FleetFlow Simulator current `main` plus its testing/release discipline. Target: Construction Flow `ai/constructionflow-parity-audit`.

Status key: STRONG = substantially present; PARTIAL = present but not at FleetFlow product quality; GAP = missing or needs deliberate implementation; VERIFY = code exists but device/player experience still needs validation.

| Product layer | FleetFlow reference behavior | Construction Flow status | Construction-specific target | Priority |
|---|---|---|---|---|
| Company identity | setup, company identity, history/progression | PARTIAL | make opening identity/setup feel deliberate and persistent | P0 |
| First minute | clear setup and first dispatch path | GAP | guided first bid → crew/equipment → start project | P0 |
| Core work loop | jobs/contracts → assign → progress → complete → payout | PARTIAL | bid → win → resource project → phases → completion/payment | P0 |
| Home/dashboard | business state + urgent next actions | PARTIAL | simplify into company health + active projects + next action | P0 |
| Work marketplace | requirements, economics, bidding/competition | STRONG/PARTIAL | make bid economics and competitor pressure immediately legible | P0 |
| People | hiring, roles, fatigue/availability, personality/events | STRONG/PARTIAL | crew identity, role fit, fatigue/morale/quit/no-show clarity | P1 |
| Assets | purchase, assignment, lifecycle, wear, repair, resale | STRONG | finish UX and validate maintenance/repair/replacement loop | P1 |
| Materials/inventory | logistics-specific supplies less central | STRONG | preserve as signature Construction mechanic; improve clarity | P1 |
| Finance ledger | categorized business history | STRONG | finish explicit labels and reconciliation UX | P1 |
| Lending | product ladder, underwriting, repayment/repossession | STRONG | validate balance and presentation | P1 |
| Regional economy | state/macro costs, demand, wages, financing | STRONG | validate player-facing explanations and balance | P1 |
| Client relationships | payment terms/reputation/renewal dynamics | PARTIAL | construction clients, slow/unpaid risk, repeat work | P1 |
| Competitors | rival companies, headlines, bidding, position | PARTIAL | contractors that bid, grow, win work, and feel persistent | P1 |
| Events/decisions | business/CEO events with consequences/memory | PARTIAL | delays, theft, weather, inspection, change order, labor/material events | P1 |
| Offline progression | active work and business state continue coherently | VERIFY | project phases, costs, wear, fatigue, events and return report | P0 |
| Save/migration | persistence + compatibility | VERIFY | device-test old/current saves and every major system | P0 |
| Failure/recovery | negative cash, damage, fatigue, overdue obligations | PARTIAL | clear recovery actions; avoid silent dead ends | P0 |
| Early pacing | first delivery and upgrade within first session | GAP | satisfying first project and attainable first upgrade in ~20 min | P0 |
| Midgame | fleet/staff/branch expansion | PARTIAL | multiple sites, specialized crews/equipment, office/yard growth | P2 |
| Late game | branches, investments, acquisitions, CEO layer | PARTIAL | territories, major contracts, company acquisitions, executive decisions | P2 |
| Prestige/endgame | founder/CEO/empire progression | GAP/PARTIAL | only deepen after early/midgame is excellent | P3 |
| Inbox/history | decisions and company memory/history | GAP/PARTIAL | unified project/company inbox + timeline when useful | P2 |
| Presentation | mature cards, formatting, settings, moments | GAP | align typography/cards/buttons/colors/status language with WildBear standard | P0 |
| Empty states | clear next action | GAP/PARTIAL | every empty screen tells player exactly what unlocks/action comes next | P0 |
| iPhone/iPad clarity | release-quality readability | VERIFY | device audit both form factors | P0 |
| Automated tests | broad regression suite | PARTIAL | expand from current 41 tests around core loop/save/offline/economy | P0 |
| CI quality gate | tests/lint/typecheck/Doctor/build checks | STRONG | keep current validated gate mandatory | P0 |
| Snack/Expo Go | rapid player test path | STRONG | keep generated single-file build current and dependency-safe | P0 |
| Release discipline | CI + EAS workflows + known issues/testing docs | PARTIAL | release only after parity gate; no release changes without approval | P0 |

## Construction Flow implementation order

### Pass 1 — Player foundation (P0)
Do not add broad late-game scope yet.
- redesign first minute around one obvious first contract
- align Home/dashboard and navigation with WildBear visual grammar
- make first bid/resource/start flow frictionless
- add explicit empty-state guidance
- validate save/load and offline progression on device
- validate failure/recovery states
- tune first 20 minutes so player earns, learns, upgrades, and wants to return

### Pass 2 — Business realism (P1)
- deepen client relationships/payment behavior
- make rival contractors persistent and visible
- finish people UX around availability/morale/personality
- polish equipment lifecycle UX
- polish ledger/lending/regional-economy explanations
- construction event families: weather, theft, inspections, change orders, labor, material disruption, client payment

### Pass 3 — Management game (P2)
- multi-site management
- office/yard/location progression
- specialized crews and equipment strategies
- territory/market expansion
- inbox/company history/timeline
- delegation/management tools

### Pass 4 — Empire (P3)
Only after Passes 1–3 are fun and stable.
- executive decisions
- acquisitions/investments where they fit construction
- major regional/national contracts
- prestige/legacy/endgame

## Product rule
Construction Flow does not need every FleetFlow feature by name. It needs the same *depth contract*: every major FleetFlow layer gets either a Construction equivalent or an explicit reason it does not belong.

## Immediate acceptance tests for Pass 1
A fresh player can:
1. launch without errors
2. understand their construction company within 60 seconds
3. identify a profitable first opportunity
4. understand what crew/equipment/materials it needs
5. start the project without hunting through screens
6. see progress and costs clearly
7. complete work and understand the payment/profit result
8. close/reopen without losing state
9. receive a believable offline-return result
10. see a realistic next upgrade and reason to continue

Until all ten pass on device, new empire-scale features are secondary.
