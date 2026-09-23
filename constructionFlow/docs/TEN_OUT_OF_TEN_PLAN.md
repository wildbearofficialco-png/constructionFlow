# Construction Flow → 10/10: the measured gap against FleetFlow

Owner rating, 2026-09-23: **FleetFlow 10/10, Construction Flow 5/10.**

Previous parity docs in this repo were written feature-by-feature from reading the screen. That
produced a list of things that were *present* and missed how much was *missing*, which is why
the comparisons have felt thin. This one is measured instead — every claim below is a count
taken from the two codebases, and the command that produced it is reproducible.

---

## 1. The size of the hole

| | FleetFlow | Construction Flow |
|---|---|---|
| Main screen | **29,321 lines** | 12,403 lines |
| Helper modules (`src/utils`) | **50 files** | 1 file |
| Data tables (`src/data`) | 9 files | 2 files |
| utils + data | **9,231 lines** | ~400 lines |
| Modals / overlays | **24** | 1 |
| Simulation systems | 20 | 31 |

Construction Flow has **more simulation systems than FleetFlow** and **42% of the game**.

That combination is the whole diagnosis, and it matches every sprint finding so far: the
simulation is not the weak part. The weak part is everything between the simulation and the
player — the events, the ceremony, the feedback, the long arc, the endgame. Construction Flow
computes a rich world and shows the player a spreadsheet of it.

---

## 2. Feature presence, by reference count

Counts are case-insensitive matches in each game's main screen file.

| Feature | FleetFlow | Construction Flow | Verdict |
|---|---|---|---|
| `branch` (multi-location empire) | **1090** | 1 | absent |
| CEO / owner event system | **1796 lines, 104 events** | 0 | absent |
| `insurance` | 164 | 39 | shallow |
| `manager` | 134 | 23 | shallow |
| `offline` | 112 | 42 | shallow |
| `morale` | 87 | 21 | shallow |
| `investor` | 64 | 4 | near-absent |
| `prestige` | 60 | 14 | shallow |
| `stock` | 56 | 11 | shallow |
| `dividend` | 25 | 0 | absent |
| `haptic` | 25 | **0** | absent |
| `sellCompany` (business exit) | 21 | 0 | absent |
| `saveHealth` | 22 | 0 | absent |
| `difficulty` | 16 | 0 | absent |
| `onboarding` | 14 | 1 | absent |
| `leaderboard` | 6 | 0 | absent |
| `careerComplete` (an ending) | 5 | 0 | absent |
| `taxReserve` | **9** | **0** | absent — see §3 |

---

## 3. The tax bug that is actually being felt

Two separate defects. The first is fixed but unshipped. The second was never found until now.

### 3a. Fixed, but not in any build on a device

`9cea0d4` ("Fix taxes: the freeze that froze nothing") landed **after** `408789e`, the build-6
cut. No TestFlight build contains it. The freeze that freezes nothing, the impossible full-only
payment, and the missing early-game relief are all still live on device.

### 3b. Not fixed — the ambush

FleetFlow accrues tax **as the player earns it**:

```js
// FleetFlowScreen.js:3801
game.taxReserve += contract.dailyPayout * 0.12 * contractEarlyMod;
// FleetFlowScreen.js:5114
game.taxReserve += routeTaxSetAside;
// FleetFlowScreen.js:3583 — at week end, the bill IS the reserve
const taxBill = Math.round(game.taxReserve);
```

and shows the running figure back (`taxEstimate`, line 10741) **before** the bill ever lands.
By the time the week closes, the player has watched the money being set aside and knows what is
coming. The bill is an expected event.

Construction Flow has **zero** references to `taxReserve`. The bill is computed at week end from
`weeklyStats.revenue` and simply appears. There is no accrual, no reserve, no estimate, and no
warning. From the player's seat a five-figure bill materialises out of nothing against cash that
was already committed to wages and materials.

That is not a balance complaint. It is a missing mechanic, and it is the one being reported.

**Also missing:** FleetFlow charges 8%/week late-payment penalties on tax debt
(`FleetFlowScreen.js:3600`). Construction Flow has none, so tax debt is a static number that
never gets worse — which removes the pressure that makes paying it a decision at all.

---

## 4. The ranked list

Ordered by *felt improvement per hour of work*, not by size.

### Tier 1 — why it feels 5/10, and cheap to fix

1. **Tax reserve + running estimate.** Accrue per completed phase/job into a visible reserve.
   Show "Tax set aside: $X" in Finance and on the Home cash card. Bill from the reserve at week
   end. *(§3b — reported by the owner.)*
2. **Late-payment penalty.** 8%/week on outstanding tax, matching FleetFlow. Debt that grows is
   a decision; debt that sits is furniture.
3. **Haptics.** FleetFlow fires tactile feedback at 25 sites — bid won, job complete, machine
   broken, level up, purchase. Construction Flow fires none outside a collapsible section. This
   is the single cheapest "feels premium" change available.
4. **Ship the unshipped tax fix.** It is already merged on `main` and in no build.

### Tier 2 — the depth that makes a company feel alive

5. **Owner events.** FleetFlow's 104-event catalog with multi-step chains and memory of past
   choices (1,796 lines across 5 modules). Construction Flow has zero. Translated to
   construction: the inspector, the union rep, the client who wants to change the scope at
   phase 3, the subcontractor who wants to go exclusive, the rival poaching your foreman.
   **This is the largest single reason FleetFlow feels alive and Construction Flow does not.**
6. **Company eras.** FleetFlow has named, themed eras with their own descriptions and colours
   (`Curbside Startup` → `Local Operator` → `Regional Carrier` → `Logistics Empire` →
   `Multi-State Network`). Construction Flow has a bare numeric level. An era gives the player a
   story about where they are; a level gives them a number.
7. **Return report.** A dedicated 137-line module in FleetFlow. What happened while you were
   away, presented as an event rather than a log dump.
8. **Save health & recovery.** 107 lines in FleetFlow, 0 in Construction Flow. A corrupted save
   currently means a dead company with no route back.

### Tier 3 — the empire endgame

9. **Yards / branches.** 1,090 references in FleetFlow versus 1. Multi-city operations with
   their own cash, crew caps, plant caps and transfers between them. This is the whole late game.
10. **An ending.** `sellCompany` and `careerComplete` — FleetFlow lets a player finish. Construction
    Flow has no terminal state, so the late game has nothing to aim at.
11. **Investors and dividends.** 64 and 25 references versus 4 and 0.
12. **Difficulty modes.** 16 references versus 0.

### Tier 4 — polish

13. **Modals.** 24 versus 1. Assignment, catalog browsing, transfers, era reveal, manager detail.
14. **Onboarding.** 14 references versus 1.
15. **Managers.** 134 versus 23.

---

## 5. Working agreement

Build → test on device → feedback → next sprint, until it is a 10.

Sprints are cut so that each one is worth a TestFlight build on its own. No build is cut without
explicit say-so, and no build is cut for two small fixes.

**Sprint 9 is Tier 1** — the tax reserve, the penalty, haptics throughout, and the already-merged
tax fix riding along. That is a build worth testing, and it answers the defect that was reported
from the device.
