// Thin wrapper around expo-haptics.
//
// Sprint 9. FleetFlow fires tactile feedback at 25 sites — a bid won, a job delivered, a
// milestone, a purchase, a refusal. Construction Flow fired none anywhere in the game loop
// (the only Haptics reference in the repo was inside CollapsibleSection). Of everything
// measured in the FleetFlow gap analysis this was the cheapest distance between "5/10" and
// "feels like a real product": nothing about the simulation changes, but every confirmed
// action stops feeling like a web page.
//
// Two rules, both inherited from FleetFlow's own module:
//
//   1. ALWAYS try/catch. A device without a taptic engine, the iOS simulator, or web must
//      no-op rather than throw into the caller. A haptic is never load-bearing.
//
//   2. NEVER fire from the tick. gameTick runs hundreds of times during offline catch-up, and
//      a buzz per simulated day would vibrate the phone continuously when a player reopens the
//      app after a night away. Every call site in this codebase is a live button press.
//
// Not unit-tested directly — it is a native call, the same convention as AsyncStorage usage
// elsewhere here. `constructionHaptics.test.js` guards rule 2 by source-scanning the screen.
import * as Haptics from "expo-haptics";

export async function fireHaptic(kind = "light") {
  try {
    if (kind === "milestone") {
      // Stronger but still restrained: a success pulse followed by one short impact beat, so a
      // company milestone is distinguishable from a routine confirmation without escalating
      // into constant heavy vibration.
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (kind === "success") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === "warning") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (kind === "error") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (kind === "heavy") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch (_e) {
    // Unsupported platform or device — silently no-op.
  }
}
