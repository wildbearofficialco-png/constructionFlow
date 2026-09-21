// Motion primitives for Construction Flow, built on React Native's built-in Animated API.
// No new dependency, so this ships without changing the native module list.
//
// WHY
// ---
// Construction Flow imports `Animated` and never uses it. The player buys a machine, finishes
// a phase, banks a payment — and nothing on screen acknowledges it. FleetFlow pulses the figure
// that rose and animates a celebration card in, and most of its "feels alive" advantage over
// Construction Flow is that acknowledgement rather than any difference in simulation depth.
//
// Every export here is purely presentational: it observes a value gameplay code already
// computed and renders a transition around it. None of them can affect game state.
//
// REDUCED MOTION
// --------------
// `useOsReducedMotion()` reads the OS accessibility setting and subscribes to live changes
// (a player can flip it while the app is open). Callers pass `animate` as
// `!reducedMotion && <condition>`, so turning Reduce Motion on removes the transition rather
// than speeding it up. Safe on platforms where the API is absent (web) — falls back to false.

import { useEffect, useRef, useState } from "react";
import { Animated, AccessibilityInfo } from "react-native";

export function useOsReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (typeof AccessibilityInfo?.isReduceMotionEnabled === "function") {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((value) => {
          if (mounted) setReducedMotion(Boolean(value));
        })
        .catch(() => {});
    }
    let subscription;
    if (typeof AccessibilityInfo?.addEventListener === "function") {
      subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
        setReducedMotion(Boolean(value));
      });
    }
    return () => {
      mounted = false;
      // Older React Native returned nothing from addEventListener — guard both shapes.
      if (subscription && typeof subscription.remove === "function") subscription.remove();
    };
  }, []);

  return reducedMotion;
}

// A brief scale pulse whenever `value` increases — cash landing from a completed contract,
// reputation ticking up after an inspection. A flash rather than a digit-by-digit count-up,
// which would need per-frame money formatting this codebase has no reason to grow.
//
// Returns an Animated.Value to spread into a wrapping Animated.View's transform. Never mutates
// `value`; purely observes it.
//
// Holds the Animated.Value in useState's lazy-init form rather than `useRef(...).current`:
// reading a ref during render is what `react-hooks/refs` forbids, and useState still gives a
// referentially stable instance across renders, which Animated.Value needs to be.
export function usePulseOnIncrease(value, animate) {
  const [scale] = useState(() => new Animated.Value(1));
  const prevValueRef = useRef(value);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (animate && typeof value === "number" && typeof prev === "number" && value > prev) {
      scale.stopAnimation();
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.09, duration: 90, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 170, useNativeDriver: true }),
      ]).start();
    }
    prevValueRef.current = value;
  }, [value, animate, scale]);

  return scale;
}

// Fade + gentle scale-in for a card or modal's content.
//
// Takes a `trigger` boolean rather than assuming its own component mounts fresh per entrance:
// ConstructionFlowScreen is one persistent component for the whole session, so a mount-only
// effect would fire once for the app's entire lifetime. This watches `trigger` going
// false -> true (a new pendingCelebration appearing, an offline summary arriving) and replays
// on each rising edge.
//
// Renders unanimated (opacity 1, scale 1) whenever `trigger` is false, including the whole time
// Reduce Motion is on, since callers pass `animate && condition`. Opacity and transform only —
// both GPU-composited and non-blocking, so nothing it wraps is ever delayed from being tappable.
export function useEntranceAnimation(trigger) {
  const [opacity] = useState(() => new Animated.Value(trigger ? 0 : 1));
  const [scale] = useState(() => new Animated.Value(trigger ? 0.95 : 1));
  const prevTriggerRef = useRef(trigger);

  useEffect(() => {
    const risingEdge = trigger && !prevTriggerRef.current;
    prevTriggerRef.current = trigger;

    if (!trigger) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    if (risingEdge) {
      opacity.setValue(0);
      scale.setValue(0.95);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 190, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 190, useNativeDriver: true }),
      ]).start();
    }
  }, [trigger, opacity, scale]);

  return { opacity, transform: [{ scale }] };
}
