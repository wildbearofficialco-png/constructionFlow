// Decisions during a job (stage B).
//
// Build 14 had 21 site events and every one applied itself: the player watched a job for
// minutes with nothing to decide. Three moments now ask instead — on the site card, not as a
// pop-up — with a fair default if the player lets it ride:
//   weather   — the existing Weather Delay event (which used to claim it "stopped work" while
//               progress carried on at full speed, so it was a free deadline extension)
//   ground    — unexpected ground conditions, drawn from the same event roll as everything else
//   behind    — raised once when the job's own forecast says it will miss its deadline
// Option prices were tuned so each is the cheapest choice somewhere across realistic jobs
// (see siteChoices.test.js "no option is always right"). At most one decision per job (two on jobs of 10+ days). Costs scale with the job's value, so a
// fence and a road ask the same question at their own size. Pure: callers apply cash, ledger
// entries, incidents and notices from what resolveChoice returns.

export const CHOICE_WINDOW_DAYS = 1;      // ignored for this long → the default is taken
export const COVER_SPEED = 0.8;           // tarped and pumped: work carries on, slower
export const COVER_SHARE = 0.005;         // of the job's value, min COVER_MIN
export const COVER_MIN = 300;
export const PUSH_INCIDENT_CHANCE = 0.25;
export const PUSH_QUALITY_HIT = 0.04;
export const OVERTIME_DAYS = 3;
export const OVERTIME_SPEED = 1.3;        // same as the Overtime site strategy

function num(v, f = 0) { return Number.isFinite(v) ? v : f; }
const pct = (value, share, min) => Math.max(min, Math.round(num(value) * share));

export function choiceBudget(site) {
  return num(site?.durationDays, 0) >= 10 ? 2 : 1;
}

export function canOfferChoice(site) {
  return Boolean(site) && !site.pendingChoice && num(site.choicesOffered, 0) < choiceBudget(site);
}

// Daily cost of the crew on this site, for pricing time in money the player recognises.
export function crewDayCost(site, crew) {
  const ids = new Set(site?.assignedCrewIds || []);
  return (crew || []).filter((w) => ids.has(w.id)).reduce((s, w) => s + num(w.wagePerDay), 0);
}

export function buildChoice(kind, site, ctx = {}) {
  const value = num(site?.totalValue, 0);
  const day = num(ctx.day, 1);
  if (kind === "weather") {
    const days = Math.max(1, Math.round(num(ctx.days, 2)));
    return {
      kind, day, expiresDay: day + CHOICE_WINDOW_DAYS, days, defaultId: "wait",
      title: "🌧️ Heavy rain on site",
      body: `Forecast says ${days} day${days === 1 ? "" : "s"} of it. How do you want to handle it?`,
      options: [
        { id: "wait", label: "Wait it out", sub: `Work stops ${days}d · deadline +${days}d · crew still paid` },
        { id: "cover", label: `Cover the site — ${money(pct(value, COVER_SHARE, COVER_MIN))}`, sub: `Tarps and pumps: work carries on at ${Math.round(COVER_SPEED * 100)}% · deadline +1d` },
        { id: "push", label: "Work through it", sub: "Full speed · quality suffers · risk of an incident" },
      ],
    };
  }
  if (kind === "ground") {
    const chance = changeOrderChance(ctx.reputation);
    return {
      kind, day, expiresDay: day + CHOICE_WINDOW_DAYS, defaultId: "engineer",
      title: "⛏️ Unexpected ground conditions",
      body: "The crew hit rock and groundwater the survey missed.",
      options: [
        { id: "engineer", label: `Bring in an engineer — ${money(pct(value, 0.03, 500))}`, sub: "Redesign the footing · deadline +1d · no risk" },
        { id: "change_order", label: "Ask the client to pay", sub: `${Math.round(chance * 100)}% they agree (+4% on the contract) · if not, a lost half-day` },
        { id: "dig", label: "Dig through it", sub: "No cost now · heavy wear on the machines · risk of an incident" },
      ],
    };
  }
  if (kind === "behind") {
    const overtimeCost = Math.max(300, Math.round(num(ctx.crewDayCost) * 0.5 * OVERTIME_DAYS));
    return {
      kind, day, expiresDay: day + CHOICE_WINDOW_DAYS, defaultId: "accept",
      title: "⏱️ This job is running late",
      body: `At this pace it finishes about ${Math.max(1, Math.round(num(ctx.lateBy, 1)))} day(s) past the deadline.`,
      options: [
        { id: "overtime", label: `Overtime for ${OVERTIME_DAYS} days — ${money(overtimeCost)}`, sub: `+${Math.round((OVERTIME_SPEED - 1) * 100)}% speed · crew tire faster` },
        { id: "extension", label: "Ask the client for more time", sub: `${Math.round(changeOrderChance(ctx.reputation) * 100)}% they agree (+2d) · costs a little goodwill either way` },
        { id: "accept", label: "Keep going", sub: "No cost now · late-penalty if it misses" },
      ],
    };
  }
  return null;
}

export function changeOrderChance(reputation) {
  return Math.max(0.25, Math.min(0.85, 0.25 + num(reputation, 0) / 150));
}

function money(n) {
  return `$${Math.round(num(n)).toLocaleString("en-US")}`;
}

// Applies an option to the site. Returns what the caller must do outside the site:
//   { cash: <amount to charge, >= 0>, incident: <severity or 0>, log: string, kind, optionId }
export function resolveChoice(site, optionId, ctx = {}, rng = Math.random) {
  const choice = site?.pendingChoice;
  if (!choice) return null;
  const opt = (choice.options || []).find((o) => o.id === optionId) ? optionId : choice.defaultId;
  const value = num(site.totalValue, 0);
  const day = num(ctx.day, choice.day);
  const out = { cash: 0, incident: 0, log: "", kind: choice.kind, optionId: opt, defaulted: optionId !== opt || ctx.defaulted === true };

  if (choice.kind === "weather") {
    const days = num(choice.days, 2);
    if (opt === "wait") {
      site.deadlineDay = num(site.deadlineDay) + days;
      site.currentWeather = { icon: "rainy", label: "Rain — work stopped", endsDay: day + days, stopsWork: true };
      out.log = `waited out the rain (${days}d stopped, deadline +${days}d)`;
    } else if (opt === "cover") {
      out.cash = pct(value, COVER_SHARE, COVER_MIN);
      site.deadlineDay = num(site.deadlineDay) + 1;
      site.currentWeather = { icon: "umbrella", label: "Rain — site covered", endsDay: day + days, speed: COVER_SPEED };
      out.log = "covered the site and kept working";
    } else {
      site.rushQualityPenalty = Math.min(0.12, num(site.rushQualityPenalty) + PUSH_QUALITY_HIT);
      if (rng() < PUSH_INCIDENT_CHANCE) out.incident = 1;
      out.log = out.incident ? "worked through the rain — and someone got hurt" : "worked through the rain";
    }
  } else if (choice.kind === "ground") {
    if (opt === "engineer") {
      out.cash = pct(value, 0.03, 500);
      site.deadlineDay = num(site.deadlineDay) + 1;
      out.log = "brought in an engineer";
    } else if (opt === "change_order") {
      if (rng() < changeOrderChance(ctx.reputation)) {
        site.totalValue = Math.round(value * 1.04);
        site.deadlineDay = num(site.deadlineDay) + 1;
        out.log = "the client agreed to pay for the extra work";
      } else {
        site.phaseProgress = Math.max(0, num(site.phaseProgress) - 15);
        out.log = "the client refused the change order — half a day lost";
      }
    } else {
      out.machineWear = 15;
      if (rng() < 0.25) out.incident = 1;
      out.log = out.incident ? "dug through it — and had an incident" : "dug through the rock";
    }
  } else if (choice.kind === "behind") {
    if (opt === "overtime") {
      out.cash = Math.max(300, Math.round(num(ctx.crewDayCost) * 0.5 * OVERTIME_DAYS));
      site.overtimeUntilDay = day + OVERTIME_DAYS;
      out.log = `put the crew on overtime for ${OVERTIME_DAYS} days`;
    } else if (opt === "extension") {
      out.reputation = -1;
      if (rng() < changeOrderChance(ctx.reputation)) {
        site.deadlineDay = num(site.deadlineDay) + 2;
        out.log = "the client gave two more days";
      } else {
        out.log = "the client said no to more time";
      }
    } else {
      out.log = "kept going at the current pace";
    }
  }

  site.choiceHistory = [...(site.choiceHistory || []), { kind: choice.kind, optionId: opt, day, defaulted: out.defaulted }].slice(-5);
  delete site.pendingChoice;
  return out;
}

export function offerChoice(site, kind, ctx = {}) {
  if (!canOfferChoice(site)) return null;
  const choice = buildChoice(kind, site, ctx);
  if (!choice) return null;
  site.pendingChoice = choice;
  site.choicesOffered = num(site.choicesOffered, 0) + 1;
  return choice;
}

// The weather multiplier on a site's progress today.
export function weatherFactor(site, day) {
  const w = site?.currentWeather;
  if (!w || num(w.endsDay, 0) <= num(day, 0)) return 1;
  if (w.stopsWork) return 0;
  if (Number.isFinite(w.speed)) return w.speed;
  return 1;
}

export function overtimeFactor(site, day) {
  return num(site?.overtimeUntilDay, 0) > num(day, 0) ? OVERTIME_SPEED : 1;
}

// How many days late the job looks at today's pace. 0 when on time or when there is no pace yet.
export function forecastLateBy(site, day, ticksPerDay) {
  const rate = num(site?._progressRate, 0);
  if (rate <= 0 || !Array.isArray(site?.phases)) return 0;
  const remaining = (site.phases.length - num(site.currentPhaseIdx, 0)) * 100 - num(site.phaseProgress, 0);
  const daysNeeded = remaining / (rate * Math.max(1, ticksPerDay));
  return Math.max(0, daysNeeded - (num(site.deadlineDay, day) - num(day, 0)));
}

// The mid-job moment: once per job, when it passes MID_JOB_AT of the way through, there is a
// MID_JOB_CHANCE it asks one question — about the ground while the crew is digging, about the
// weather otherwise. Random site events alone made decisions too rare to matter (~1 in 10 jobs
// in a 164-job simulation); this keeps it to one predictable beat, inside the job's budget.
export const MID_JOB_AT = 0.4;
export const MID_JOB_CHANCE = 0.6;
const GROUND_PHASES = /survey|site prep|foundation|excavat|demo|post install|earthwork|trench|pil/i;

export function jobProgress(site) {
  const phases = Array.isArray(site?.phases) ? site.phases.length : 0;
  if (!phases) return 0;
  return Math.min(1, (num(site.currentPhaseIdx, 0) * 100 + num(site.phaseProgress, 0)) / (phases * 100));
}

export function midJobChoiceKind(site) {
  const phase = (site?.phases || [])[num(site?.currentPhaseIdx, 0)] || "";
  return GROUND_PHASES.test(phase) ? "ground" : "weather";
}

// Returns the kind to offer today, or null. Marks the site so it is only ever considered once.
export function rollMidJobChoice(site, rng = Math.random) {
  if (!site || site._midJobRolled || jobProgress(site) < MID_JOB_AT) return null;
  site._midJobRolled = true;
  if (!canOfferChoice(site) || rng() >= MID_JOB_CHANCE) return null;
  return midJobChoiceKind(site);
}
