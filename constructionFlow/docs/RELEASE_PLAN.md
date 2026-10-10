# Construction Flow — 1.0.0 Release Plan

Source of truth for the public launch. Update it when a decision changes; do not change
App Store Connect from this document without explicit approval.

## Business model (decided 2026-10-10)

| Item | Decision |
|---|---|
| Price | **$0.99 USD**, one-time paid download (App Store price tier for $0.99) |
| Ads | None |
| Subscriptions | None |
| In-app purchases | None |

What this means for the code and the store listing:

- The app must stay free of IAP, ad and subscription SDKs. Today it has none — no `expo-in-app-purchases`,
  `react-native-iap`, AdMob or similar dependency, and no network code. Any in-game "purchase"
  (equipment, offices, speed-ups) spends in-game cash only.
- No account, no data collection: the App Privacy label is **Data Not Collected**.
- The description must not imply ads, subscriptions or future paid content.

## Status

| Step | Status |
|---|---|
| Build 14 (save-data safety fix, PR #30) merged to `main` | Done |
| Build 14 built on EAS and uploaded to TestFlight | In progress |
| Physical-device testing of build 14 (iPhone + iPad) | Owner: WildBear |
| Privacy and Support URLs confirmed live in a browser | Owner: WildBear |
| App Store Connect: price, screenshots, privacy label, age rating, description | Not started — **awaiting approval** |
| Submit for public App Store review | Not started — **awaiting approval** |

## Device test checklist (build 14)

1. Install over build 13: the existing company loads intact.
2. Background the app, return after a few minutes and after several hours: progress catches up, nothing lost.
3. Force-quit and relaunch mid-game: progress is kept.
4. Crew tab shows the crew list (iPhone and iPad).
5. Play a fresh company through its first contract: payout, wages and taxes look right.
6. iPad: every tab is usable at full width and in both orientations the app supports (portrait).

## App Store Connect checklist (do not start until approved)

- Pricing: $0.99 USD, all territories unless decided otherwise.
- Agreements, Tax and Banking: the **Paid Apps Agreement** must be active, with banking and tax
  forms complete, or a paid app cannot be released.
- App Privacy: Data Not Collected.
- Privacy Policy URL: `https://wildbearofficialco-png.github.io/Fleetflow/constructionflow/`
- Support URL: `https://wildbearofficialco-png.github.io/Fleetflow/constructionflow/support.html`
- Screenshots: 6.9" iPhone and 13" iPad (`supportsTablet` is on).
- Age rating questionnaire, description, keywords, category (Games › Simulation).
- Build: select 1.0.0 (14) once device testing passes.
