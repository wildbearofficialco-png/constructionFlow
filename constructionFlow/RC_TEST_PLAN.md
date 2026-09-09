# ConstructionFlow — Release Candidate: Expo Go Regression Test

**Branch:** `claude/constructionflow-app-store-audit-828lht`
**File to paste:** `constructionFlow/snack/ConstructionFlowSnack.js` (11,348 lines, ~675KB)
**Status:** ready for hands-on testing. **No EAS build has been run and nothing has been submitted.**

---

## Setup (2 minutes)

1. Open `constructionFlow/snack/ConstructionFlowSnack.js` on GitHub, on the branch above.
2. Select All → Copy.
3. In Snack, select all of `App.js` → Paste over it.
4. Dependencies panel: `@react-native-async-storage/async-storage`. **Nothing else to add** —
   `expo-haptics` is loaded defensively and goes quiet if Snack can't resolve it.
5. SDK version: **57**.
6. Scan with Expo Go.

**Start a fresh company.** The economy changed substantially in Sprint 3; an old save will be
migrated but won't show you the new opening.

---

## What I already verified (so you don't need to)

Automated, 95 suites / 1,537 tests, 0 lint errors:

- All 7 tabs render for both a brand-new and a 150-day company
- All 12 modals render (celebration, story, decision, change order, breakdown, inspection,
  offline summary, ceremony, notice, weekly report, game over, prestige)
- Setup screen, light theme, business-frozen, zero-crew/zero-fleet, corrupt-save recovery
- Economy across 12 seeds × 2 operating styles × 200 days
- Save size and tick cost on a 300-day company

**What that does NOT cover, and why you're testing:** how it *looks*, how it *feels*, whether
the pacing is fun, touch targets on a phone, iPad layout, real frame rate, and whether the
copy makes sense to a human. Those need your eyes.

---

## Priority 1 — the four sprints' headline changes (~25 min)

Do these first. If one is broken, stop and tell me.

### 1.1 Bidding is a real contest
- [ ] Bids tab → open Fence Installation → assign crew + truck.
- [ ] Each strategy (Aggressive / Standard / Premium) shows a **different win %**.
- [ ] Button reads "📨 Submit Bid — N% to win" and the % matches the selected strategy.
- [ ] Submit. **You can lose.** On a loss: a named rival takes it, their price is shown, and
      your crew/truck/materials are **not** consumed.
- [ ] Lose one deliberately (bid Premium at low reputation). Tutorial should switch to
      "Someone Outbid You" rather than leaving you stuck.
- [ ] Win one. Log says "Bid WON", mobilisation draw lands.

### 1.2 You get paid in stages
- [ ] On winning: a **mobilisation draw** (not "25% deposit") appears in cash and on the site card.
- [ ] Site card shows `Billed £X of £Y` and a 🔒 retained figure.
- [ ] As each phase certifies, cash arrives mid-job — you are not waiting until the end.
- [ ] Finance tab shows a **Retainage Held** row.
- [ ] ~2 weeks after finishing a job, retainage is released (watch the log).

### 1.3 Money has weight
- [ ] You start with **$24,000**, not $75,000. Setup screen says so.
- [ ] The first job matters — you should feel the overhead. Note how many days of runway you feel you have.
- [ ] Diesel appears as a cost (weekly log line, and machines refuel).
- [ ] Parked machines cost less per day than working ones.

### 1.4 Equipment: rent, finance or buy
- [ ] Vehicles tab → shop. Every machine offers **New / Used / Rent / Finance**.
- [ ] Rent a machine you couldn't afford to buy. It appears in your fleet with a 🔑 Rented tag
      and a "Return Hire" button (no Sell/Retire — it isn't yours).
- [ ] Finance one. Shows 🏦 with weekly payment and weeks remaining.
- [ ] Fleet cards show **engine hours** and "service in N hrs" / "overdue by N hrs".

---

## Priority 2 — construction depth (~20 min)

- [ ] **Change order** — accept one (contract value and deadline both rise; site card shows 📝)
      and decline one (reputation dips, schedule protected).
- [ ] **Ground conditions** — on a *bigger* job (drainage, road, anything 9+ days), expect rock,
      water table, contaminated soil, utility strike. **These should NOT hammer the tutorial
      Fence job** — that was a bug I fixed this sprint; if a small residential job gets buried
      in them, tell me.
- [ ] **Weather** — should actually happen now, and more in Winter than Summer.
- [ ] **Crew** — hire a walk-in applicant (they appear on their own now; you should not need to
      buy a job ad to survive). Check wages read as **per-day amounts in the $160–260 range**,
      not $18–32.
- [ ] **Service a machine** past its interval → confirm the service clock resets.

---

## Priority 3 — stability and feel (~15 min)

- [ ] **Haptics** — feel a buzz on bid win/loss and job completion. Toggle "📳 Vibration
      Feedback" off in Vehicles → Auto Dispatch; confirm it stops.
- [ ] **Background/foreground** — leave the app 2+ minutes, come back. Offline summary appears,
      numbers are sane, nothing lost.
- [ ] **Force quit and reopen.** Company is exactly as you left it.
- [ ] **Long session** — leave it running ~15 minutes. It should not get slower or hotter.
      (Save size is now flat with age; this is the on-device confirmation of that.)
- [ ] **Both themes** — toggle light/dark, walk all 7 tabs in each.
- [ ] **iPad** — run the whole thing again. Layout, touch targets, no clipping.

---

## Priority 4 — things I want your judgement on

Not pass/fail. These are the calls I made that you and Randy should confirm.

1. **Difficulty.** A cautious operator lands near break-even; an ambitious one profits.
   Simulated bust rate is ~8%. Does losing feel fair, or punishing?
2. **Starting cash.** $24k is ~1 month of overhead. Too tight? Too loose?
3. **Bid win rates.** Aggressive ~80% base, Standard ~55%, Premium ~30%, before your
   reputation and capacity modify them. Does losing a bid feel like information or noise?
4. **Retainage hold** is 14 days at 8%. Interesting tension, or just annoying?
5. **Pacing** — day 30 should feel small, day 90 like a real business.

---

## Known before you start

- **The app icon and splash are still generated placeholders.** `app.config.js` says so in its
  own comments. This does not block Expo Go testing and it will not fail review, but it should
  not be what ships. It needs a designer — I can't make artwork.
  (`icon.png` and `adaptive-icon.png` are currently the same file.)
- **`ios.buildNumber` is still 1.** Deliberately not bumped. FleetFlow's `KNOWN_ISSUES.md`
  items 8 and 11 record this failing twice: a build must be bumped **in the same commit as the
  build itself**, and you'll likely have fixes from this test round first.
- A React Native `SafeAreaView` deprecation warning appears in logs. Cosmetic, not a defect.

---

## Reporting back

For anything broken, the most useful thing is: **which tab, what you tapped, what you expected,
what happened.** A screenshot of the log feed helps a lot — most systems narrate themselves there.

If it's solid, the remaining path is: bump `buildNumber` → `eas build --profile
construction-production` → TestFlight → device test the real binary → screenshots and metadata →
submit. I can prep all of that, but the build and submit steps need your Apple credentials.
