// Site diagnostics — why a job site is not running at full speed, in words the player can act on.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 1 (Stabilization), P0-1: "If project progress is below its normal rate, the site card
// tells the player why and provides the most relevant action."
//
// Three device builds in a row shipped a site that was slow or stopped for a reason the card did
// not show: a truck that ran dry and never came back (build 9), a tier throttle nobody mentioned
// (build 11), and — found by the first-hour audit — a card that kept printing yesterday's
// "~3 days remaining · 97%/day" on a site that had not moved for two days, because every stall
// branch in the tick `continue`d past the line that updates the rate.
//
// The rule this module enforces is structural: the TICK records what it actually did to the
// rate (`site.stopReason`, `site.rateFactors`, `site.pauseReason`), and the card reads only that.
// A modifier the tick applied cannot be missing from the card, and the card cannot claim a
// modifier the tick did not apply — which is how the specialty warning used to disagree with
// the simulation.
//
// Everything here is pure and RNG-free.

// ─── Pauses ──────────────────────────────────────────────────────────────────

// Why a site is on hold. `action` is the most useful thing the player can do about it; null means
// the honest answer is "wait", and the card says how long.
export const PAUSE_REASONS = Object.freeze({
  permit:      { label: "Permit hold",                action: null },
  inspection:  { label: "Failed safety inspection",   action: { label: "Review crew", tab: "Crew" } },
  regulatory:  { label: "Regulatory hold",            action: null },
  weather:     { label: "Weather",                    action: null },
  quality:     { label: "Failed quality inspection",  action: null },
  manual:      { label: "Paused by you",              action: { label: "Resume", tab: "Sites" } },
  other:       { label: "On hold",                    action: null },
});

// Holds the authorities put on a site. Only their own resolution clears them — the countdown, or
// the regulatory decision card's paid paths. Sprint 1: the generic Resume button cleared ANY pause,
// so a permit hold or a failed safety inspection could be waved away with one tap.
export const REGULATORY_HOLDS = Object.freeze(new Set(["permit", "regulatory", "inspection", "quality"]));

export function isRegulatoryHold(site) {
  return site?.status === "Paused" && REGULATORY_HOLDS.has(site?.pauseReason?.key);
}

// Can the PLAYER resume this site? Only a pause the player made. A pre-Sprint-1 save's manual
// pause carries no reason but is recognisable by its open-ended 999 days.
export function canPlayerResume(site) {
  if (site?.status !== "Paused") return false;
  const key = site?.pauseReason?.key;
  if (key) return key === "manual";
  return site?.pausedDays === 999;
}

// Can an automatic manager (a Senior PM) get a paused site moving? Operational holds yes;
// regulatory holds never.
export function canAutoResume(site) {
  return site?.status === "Paused" && !isRegulatoryHold(site);
}

// The one way a site should be put on hold, so the reason travels with the pause.
export function pauseSite(site, days, reasonKey = "other", detail = null) {
  if (!site) return;
  const key = PAUSE_REASONS[reasonKey] ? reasonKey : "other";
  // A player's own pause never replaces a regulatory hold — otherwise "Pause" then "Resume" would
  // be a way round the permit office.
  if (key === "manual" && isRegulatoryHold(site)) return;
  const openEnded = days === Infinity || days >= 999;
  const wasOpenEnded = site.status === "Paused" && site.pausedDays >= 999;
  site.status = "Paused";
  if (openEnded) site.pausedDays = 999;
  // A timed hold landing on an open-ended manual pause starts its own clock, rather than adding to
  // the 999 sentinel and becoming a thousand-day hold.
  else if (wasOpenEnded) site.pausedDays = Math.max(0, Number(days) || 0);
  else site.pausedDays = Math.max(0, Number(site.pausedDays) || 0) + Math.max(0, Number(days) || 0);
  site.pauseReason = { key, detail: detail || null };
}

// ─── Rate factors ────────────────────────────────────────────────────────────

// A penalty only counts if it is material. A 2% wobble is not something to put in front of the
// player; a 10% one is.
export const MATERIAL_PENALTY = 0.97;

// What the tick reports for each multiplier below 1 it applied to a site's progress rate.
// `factor` is the multiplier itself (0.55 = running at 55% speed).
export function describeFactor(f) {
  const pct = Math.round((f.factor ?? 1) * 100);
  switch (f.key) {
    case "understaffed":
      return {
        text: `Understaffed: ${f.have} of ${f.need} crew on site — ${pct}% speed`,
        action: { label: "Assign crew", tab: "Sites" },
      };
    case "specialty":
      return {
        text: `${f.phase} has no ${f.specialty || "matching"} specialist on site — ${pct}% speed`,
        action: { label: "Hire or assign", tab: "Crew" },
      };
    case "plant":
      if (f.workshopHours) {
        return {
          text: `${f.phase}: the machine is in the workshop, back in ~${f.workshopHours}h — ${pct}% speed until then`,
          action: null,
        };
      }
      return {
        text: `${f.phase} needs ${(f.anyOf || []).join(" or ")} plant at tier ${f.minTier}+ — ${pct}% speed`,
        action: f.ownedButUnusable
          ? { label: "Repair machine", tab: "Equipment" }
          : { label: "Assign plant", tab: "Sites" },
      };
    case "site_mode":
      return {
        text: `${f.mode === "quality" ? "Quality" : "Budget"} mode — ${pct}% speed by your choice`,
        action: null,
      };
    default:
      return { text: `${f.label || "Slowed"} — ${pct}% speed`, action: null };
  }
}

// ─── Stops ───────────────────────────────────────────────────────────────────

export function describeStop(stop, day) {
  if (!stop) return null;
  switch (stop.key) {
    case "no_crew":
      return { text: "Stopped: nobody on site", action: { label: "Assign crew", tab: "Sites" } };
    case "crew_resting": {
      const n = stop.resting || 0;
      return {
        text: `Stopped: ${n === 1 ? "the crew member is" : `all ${n} crew are`} resting — they return automatically once rested`,
        action: { label: "Assign other crew", tab: "Sites" },
      };
    }
    case "materials_short":
      return {
        text: `Stopped: short ${stop.summary || "materials"} and nothing on order`,
        action: { label: "Order materials", tab: "Sites" },
      };
    case "materials_in_transit": {
      const wait = Number.isFinite(stop.due) && Number.isFinite(day) ? Math.max(0, stop.due - day) : null;
      return {
        text: `Waiting on materials: ${stop.summary || "delivery"} arrives ${wait === 0 ? "today" : wait != null ? `in ${wait}d` : "soon"}`,
        action: { label: "Pay for same-day", tab: "Sites" },
      };
    }
    default:
      return { text: "Stopped", action: null };
  }
}

// ─── The card's verdict ──────────────────────────────────────────────────────

// state: "running" | "slowed" | "stopped" | "paused"
// lines: [{ text, action: {label, tab} | null, severity: "stop"|"slow"|"info" }]
export function diagnoseSite(site, day) {
  if (!site) return { state: "running", lines: [] };

  if (site.status === "Paused") {
    const r = PAUSE_REASONS[site.pauseReason?.key] || null;
    const weather = site.currentWeather?.label || null;
    const label = r ? r.label : weather ? weather : "On hold";
    const left = site.pausedDays === 999 ? null : Math.max(0, Math.ceil(Number(site.pausedDays) || 0));
    const detail = site.pauseReason?.detail ? ` — ${site.pauseReason.detail}` : "";
    const when = left == null ? "until you resume it" : left <= 0 ? "resumes shortly" : `resumes in ~${left}d`;
    return {
      state: "paused",
      lines: [{ text: `Paused: ${label}${detail} · ${when}`, action: r?.action || null, severity: "stop" }],
    };
  }

  if (site.stopReason) {
    const d = describeStop(site.stopReason, day);
    return { state: "stopped", lines: [{ ...d, severity: "stop" }] };
  }

  const factors = (Array.isArray(site.rateFactors) ? site.rateFactors : [])
    .filter((f) => Number.isFinite(f?.factor) && f.factor < MATERIAL_PENALTY)
    .sort((a, b) => a.factor - b.factor);
  if (factors.length === 0) return { state: "running", lines: [] };
  return {
    state: "slowed",
    lines: factors.map((f) => ({ ...describeFactor(f), severity: f.key === "site_mode" ? "info" : "slow" })),
  };
}

// ─── Returning people and machines to the job they left ──────────────────────

// Stamina a worker pulled off a site for exhaustion or injury needs before going back.
export const RETURN_STAMINA = 45;
// Share of the tank a machine pulled for fuel needs before going back.
export const RETURN_FUEL_SHARE = 0.25;

function onAnySite(g, key, id) {
  return (g.activeSites || []).some((s) => (s[key] || []).includes(id));
}

function liveSite(g, id) {
  const s = (g.activeSites || []).find((st) => st.id === id);
  return s && (s.status === "Active" || s.status === "Paused") ? s : null;
}

// Put back everyone and everything that was taken off a site for a recoverable reason and has now
// recovered. Returns human-readable lines for the ops log. Mutates `g`.
//
// Exhaustion (auto-pull), injury, and the player's own "Rest" button all mark the worker with
// `awaitingRestForSiteId`; fuel with `awaitingFuelForSiteId`; a recall or other repair with
// `awaitingRepairForSiteId`. Before Sprint 1 only the first two were ever marked, so a worker the
// player RESTED — exactly as the site card told them to — never went back.
export function returnRecoveredToSites(g, isUsable) {
  const lines = [];
  for (const w of (g.crew || [])) {
    if (!w.awaitingRestForSiteId) continue;
    if (w.status === "Resting" || w.status === "Training") continue;   // still off, by choice
    if ((w.stamina ?? 0) < RETURN_STAMINA) continue;
    const back = liveSite(g, w.awaitingRestForSiteId);
    w.awaitingRestForSiteId = null;
    // The player already put them to work somewhere: that decision wins.
    if (!back || onAnySite(g, "assignedCrewIds", w.id)) continue;
    if ((back.assignedCrewIds || []).includes(w.id)) continue;
    back.assignedCrewIds = [...(back.assignedCrewIds || []), w.id];
    w.status = "Active";
    w.assignedSiteId = back.id;
    lines.push({ kind: "crew", text: `💪 ${w.name} rested and back on ${back.label}.` });
  }
  for (const e of (g.equipment || [])) {
    if (e.awaitingFuelForSiteId && (e.fuel ?? 0) >= (e.fuelCap || 0) * RETURN_FUEL_SHARE) {
      const back = liveSite(g, e.awaitingFuelForSiteId);
      e.awaitingFuelForSiteId = null;
      if (back && !onAnySite(g, "assignedEquipmentIds", e.id)) {
        back.assignedEquipmentIds = [...(back.assignedEquipmentIds || []), e.id];
        e.status = "Active";
        e.assignedSiteId = back.id;
        lines.push({ kind: "equipment", text: `⛽ ${e.name} refuelled and back on ${back.label}.` });
      }
    }
    if (e.awaitingRepairForSiteId && e.status === "Idle" && (!isUsable || isUsable(e))) {
      const back = liveSite(g, e.awaitingRepairForSiteId);
      e.awaitingRepairForSiteId = null;
      if (back && !onAnySite(g, "assignedEquipmentIds", e.id)) {
        back.assignedEquipmentIds = [...(back.assignedEquipmentIds || []), e.id];
        e.status = "Active";
        e.assignedSiteId = back.id;
        lines.push({ kind: "equipment", text: `🔧 ${e.name} repaired and back on ${back.label}.` });
      }
    }
  }
  return lines;
}
