// The core construction loop: bid → win → prepare → build → phases → inspection → paid.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Phase 2 of the FleetFlow parity work. The audit found that two of the loop's three player
// decisions were not decisions at all — one option strictly dominated the others, so a player
// who understood the game had nothing to think about:
//
//   Bid style      Premium paid +28% of contract value and cost nothing. The UI said
//                  "higher bar", but nothing in the code read the bid style except the payout
//                  multiplier. Premium was free money; aggressive was a strictly worse
//                  Standard. Always pick Premium.
//   Ordering       An emergency material order cost 1.5x and arrived at exactly the same
//                  moment as a normal order, because both were instant. Always pick Normal.
//
// Both are fixed here by giving each option something real to trade:
//
//   Bid style      now moves the probability of WINNING the contract, not just its value.
//                  Premium is a big margin you might not get. Aggressive is a thin margin you
//                  almost certainly will.
//   Ordering       normal orders now take days to arrive and work stalls until they do, so
//                  the emergency premium buys the one thing a late project needs: time.
//
// It also gives the loop's beats a voice — a completed phase, an arriving delivery and a
// progress payment each say so — and releases the contract's money across the job instead of
// only at its two ends.
//
// Everything here is pure: state in, values out, no mutation of the arguments and no RNG
// except where a function's name says it rolls. That is what makes it testable, and it is the
// pattern FleetFlow's `src/utils/` uses for the same reason.

// ─── Bidding ─────────────────────────────────────────────────────────────────

// `value` is the multiplier on the contract's headline value. `baseWinChance` is the
// probability of being awarded the job before reputation and local competition adjust it.
//
// The numbers are chosen so expected value rises with risk but never trivially: at base
// rates, aggressive returns 0.82 x 0.92 = 0.754 of headline per attempt, standard
// 1.00 x 0.78 = 0.780, premium 1.28 x 0.55 = 0.704. No style dominates, and which one is
// correct depends on how many contracts you can afford to lose — which depends on your
// crew's idle cost, your runway and how thin the board is. That is the decision.
export const BID_STYLES = [
  {
    key: "aggressive",
    label: "Aggressive",
    value: 0.82,
    baseWinChance: 0.92,
    blurb: "Undercut to win the work",
    detail: "You will almost certainly be awarded this, at a thin margin.",
  },
  {
    key: "standard",
    label: "Standard",
    value: 1.0,
    baseWinChance: 0.78,
    blurb: "Bid at market rate",
    detail: "A fair price, and usually enough to win it.",
  },
  {
    key: "premium",
    label: "Premium",
    value: 1.28,
    baseWinChance: 0.55,
    blurb: "Price for quality, risk the job",
    detail: "The best margin on the board — if a cheaper contractor does not take it first.",
  },
];

export const DEFAULT_BID_STYLE = "standard";

export function getBidStyle(key) {
  return BID_STYLES.find((s) => s.key === key) || BID_STYLES.find((s) => s.key === DEFAULT_BID_STYLE);
}

// How hard this contract's market is to win, as a multiplier on the style's base chance.
// Reputation is the player's leverage: a well-regarded contractor is chosen over a cheaper
// unknown, which is the whole reason reputation is worth having.
//
// `game.bidBonus` is the office-tier perk, resolved by companyPerks.js and passed in by the
// caller rather than imported here — this module must stay free of the perk tables so it can
// be tested against a bare object. Phase 5 wired it; before that the perk was a string on an
// upgrade button that nothing read, which is also why it is additive on the multiplier rather
// than a fourth bid style: it makes every style a little more winnable without flattening the
// choice between them.
export function getBidCompetition(game = {}, contract = {}) {
  const reputation = Number.isFinite(game.reputation) ? game.reputation : 0;
  // 0 rep -> 0.88, 50 rep -> 1.00, 100 rep -> 1.12.
  const reputationFactor = 0.88 + (Math.max(0, Math.min(100, reputation)) / 100) * 0.24;

  // A contract a named rival is already circling is genuinely harder to take.
  const contestedFactor = contract.interestedRival ? 0.82 : 1.0;

  // Bigger work draws bigger firms.
  const categoryFactor =
    contract.category === "Mega" ? 0.82 :
    contract.category === "Government" ? 0.88 :
    contract.category === "Infrastructure" ? 0.92 :
    1.0;

  const officeBonus = Number.isFinite(game.bidBonus) ? Math.max(0, Math.min(0.15, game.bidBonus)) : 0;

  // Phase 6: what the company has DONE, net of what it has done TO people. Positive from a
  // record of delivered work and pleased clients, negative from blown jobs and from rivals
  // holding a grudge. Clamped both ways so history moves the odds without ever deciding them.
  const memoryEdge = Number.isFinite(game.memoryEdge) ? Math.max(-0.12, Math.min(0.12, game.memoryEdge)) : 0;

  return reputationFactor * contestedFactor * categoryFactor + officeBonus + memoryEdge;
}

// A player's very first contract is guaranteed. Without this, a brand-new company (0
// reputation) would lose its first bid 31% of the time on a standard bid and 52% on a
// premium one — and that bid is the tutorial's step 1, the single most important minute the
// game has. The WildBear first-minute rule is explicit that a new player must get to a
// running job; losing the contract the tutorial card points at fails that outright.
//
// The guarantee is shown honestly as 100% in the UI rather than being a hidden fudge, because
// `planBid` is also what `rollBidOutcome` rolls against — what the player is promised is by
// construction what happens. It lifts the moment they have a company of their own: one
// completed job, or one site already running.
export function hasFirstContractGuarantee(game = {}) {
  const completed = Number.isFinite(game.completedJobs) ? game.completedJobs : 0;
  const running = Array.isArray(game.activeSites) ? game.activeSites.length : 0;
  return completed === 0 && running === 0;
}

// Chain opportunities are earned by completing a prerequisite. Sprint 1 deliberately keeps
// them locked, without an expiry clock, until the company has enough crew/plant capacity to
// take them. Once that gate is open the award itself must not be another dice roll: the player
// already did the work that earned it. Public-market jobs remain competitive.
export function hasEarnedContractGuarantee(contract = {}) {
  return contract.chainGuaranteed === true && contract.locked !== true;
}

// The full picture the player is shown BEFORE committing, so a lost bid is never a surprise:
// what it pays, how likely it is, and who else wants it. The screen renders exactly this
// object, and `rollBidOutcome` consumes exactly this `winChance` — so what is promised and
// what is rolled cannot drift apart.
export function planBid(contract = {}, styleKey = DEFAULT_BID_STYLE, game = {}) {
  const style = getBidStyle(styleKey);
  const headline = Number.isFinite(contract.value) ? contract.value : 0;
  const competition = getBidCompetition(game, contract);
  const firstContractGuaranteed = hasFirstContractGuarantee(game);
  const earnedContractGuaranteed = hasEarnedContractGuarantee(contract);
  const guaranteed = firstContractGuaranteed || earnedContractGuaranteed;
  // Floors and ceilings so no public-market bid is ever hopeless or certain. The opening job
  // and earned chain opportunities are the two explicit guarantees.
  const winChance = guaranteed ? 1 : Math.max(0.25, Math.min(0.97, style.baseWinChance * competition));

  return {
    guaranteed,
    styleKey: style.key,
    label: style.label,
    blurb: style.blurb,
    detail: earnedContractGuaranteed
      ? "You earned this follow-up contract — once eligible, it is yours to accept."
      : firstContractGuaranteed
        ? "Your first contract is yours — nobody outbids a new firm on its opening job."
        : style.detail,
    valueMultiplier: style.value,
    effectiveValue: Math.round(headline * style.value),
    winChance,
    winPercent: Math.round(winChance * 100),
    // Expected value per attempt, which is what makes the three styles comparable at all.
    expectedValue: Math.round(headline * style.value * winChance),
    contested: Boolean(contract.interestedRival),
    rivalName: contract.interestedRival || null,
    riskTone: winChance >= 0.85 ? "safe" : winChance >= 0.65 ? "caution" : "hazard",
    riskLabel: guaranteed ? "Guaranteed" : winChance >= 0.85 ? "Very likely" : winChance >= 0.65 ? "Likely" : "Contested",
  };
}

// Rolls the award. `rng` is injectable so tests are deterministic; production passes nothing
// and gets Math.random. Returns the plan alongside the outcome so callers never have to
// recompute (and so cannot recompute it differently).
export function rollBidOutcome(contract, styleKey, game, rng = Math.random) {
  const plan = planBid(contract, styleKey, game);
  const roll = rng();
  // A guaranteed bid short-circuits the roll entirely. `roll < 1` would also always hold for
  // Math.random(), but relying on that would make the guarantee depend on the RNG's range
  // rather than on saying what it means.
  return { ...plan, won: plan.guaranteed || roll < plan.winChance, roll };
}

// Who took it, when the player loses. Prefers the rival already named on the contract so the
// story stays consistent with what the player was shown.
export function pickWinningRival(contract = {}, game = {}, rng = Math.random) {
  const available = (game.rivals || []).filter(
    (r) => r && r.status !== "Bankrupt" && !(game.acquiredRivals || []).includes(r.id)
  );
  if (contract.interestedRival) {
    const named = available.find((r) => r.name === contract.interestedRival);
    if (named) return named;
    return { id: null, name: contract.interestedRival };
  }
  if (available.length === 0) return null;
  return available[Math.floor(rng() * available.length)] || available[0];
}

// ─── Material deliveries ─────────────────────────────────────────────────────

// A normal order is placed with a supplier and turns up when it turns up. An emergency order
// is on site the same day at 1.5x, which is what the premium is actually buying — before this,
// both were instant and the emergency option was strictly worse.
export const NORMAL_DELIVERY_DAYS = 2;
export const EMERGENCY_DELIVERY_DAYS = 0;

// Builds the delivery records an order creates. Pure: the caller charges the cash and appends
// these. One record per material so a part-filled order can arrive in pieces.
export function planDeliveries(missingMaterials = [], day = 1, { emergency = false } = {}) {
  const leadDays = emergency ? EMERGENCY_DELIVERY_DAYS : NORMAL_DELIVERY_DAYS;
  return missingMaterials
    .filter((m) => m && m.missing > 0)
    .map((m, i) => ({
      // Deterministic id: a delivery is uniquely identified by what it is and when it lands,
      // so an offline catch-up that replays a day cannot mint a duplicate.
      id: `dlv-${day}-${m.matId}-${i}${emergency ? "-e" : ""}`,
      matId: m.matId,
      label: m.label,
      unit: m.unit,
      qty: m.missing,
      cost: emergency ? m.costEmergency : m.costNormal,
      emergency,
      orderedDay: day,
      arrivesDay: day + leadDays,
    }));
}

// Splits a site's pending deliveries into those that have landed by `day` and those still out.
// Never mutates the site.
export function collectArrivedDeliveries(site = {}, day = 1) {
  const pending = Array.isArray(site.pendingDeliveries) ? site.pendingDeliveries : [];
  const arrived = [];
  const stillPending = [];
  for (const d of pending) {
    if (!d || typeof d !== "object") continue;
    if ((d.arrivesDay ?? 0) <= day) arrived.push(d);
    else stillPending.push(d);
  }
  return { arrived, stillPending };
}

// What the player is told when an order lands. Plural-correct, and names the site, because
// several sites can be taking deliveries at once.
export function describeDelivery(siteLabel, delivery) {
  if (!delivery) return "";
  const prefix = delivery.emergency ? "⚡ Emergency delivery" : "📦 Material delivery";
  return `${prefix} arrived at ${siteLabel}: ${delivery.qty} ${delivery.unit} of ${delivery.label}.`;
}

// The soonest a site's outstanding orders will land, for the "work stalled" copy. Returns null
// when nothing is on order — which is the state that actually needs the player's attention,
// because nobody has ordered anything.
export function nextDeliveryDay(site = {}) {
  const pending = Array.isArray(site.pendingDeliveries) ? site.pendingDeliveries : [];
  if (pending.length === 0) return null;
  return pending.reduce((soonest, d) => {
    const at = d?.arrivesDay ?? Infinity;
    return at < soonest ? at : soonest;
  }, Infinity);
}

// ─── Phases ──────────────────────────────────────────────────────────────────

// The phase list as the player should see it: what is done, what is happening, what is coming.
// The site card used to show only the current phase name and a bar, so the shape of the job —
// the thing that makes it a construction project rather than a progress meter — was invisible.
export function summarizeSitePhases(site = {}) {
  const phases = Array.isArray(site.phases) ? site.phases : [];
  const currentIdx = Number.isFinite(site.currentPhaseIdx) ? site.currentPhaseIdx : 0;
  return phases.map((name, i) => ({
    name,
    index: i,
    state: i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
    // Only the current phase has partial progress; the others are 0 or 100 by definition.
    percent: i < currentIdx ? 100 : i === currentIdx ? Math.max(0, Math.min(100, site.phaseProgress || 0)) : 0,
  }));
}

// "Foundation complete — Framing begins." Before this, finishing a phase was silent unless it
// happened to be an inspection, so the loop's most frequent milestone had no moment at all.
export function describePhaseCompletion(completedPhase, nextPhase) {
  if (!completedPhase) return "";
  if (!nextPhase) return `✅ ${completedPhase} complete — the project is finished.`;
  return `✅ ${completedPhase} complete — ${nextPhase} begins.`;
}

// ─── Progress payments ───────────────────────────────────────────────────────

// Construction is not paid in two lumps. A deposit mobilises the job, progress claims are
// certified as phases complete, and the balance is released at handover.
//
// CRITICAL INVARIANT, and the reason this is a pure function with its own tests: the TOTAL a
// contract pays is unchanged. Only the timing moves. deposit + progress + final always equals
// value - penalty. Nothing here can mint money, and re-running a phase completion cannot pay
// twice, because each release is computed from a cumulative target minus what has already
// been paid rather than as an independent increment.
export const DEPOSIT_SHARE = 0.25;
export const PROGRESS_SHARE = 0.50;

// The cumulative progress payment a site should have received once `phasesComplete` of its
// non-final phases are done. Rounded once, at the cumulative level, so per-phase rounding
// can never accumulate a drift.
export function progressPaymentTarget(contractValue, totalPhases, phasesComplete) {
  const value = Number.isFinite(contractValue) ? Math.max(0, contractValue) : 0;
  const phases = Number.isFinite(totalPhases) ? Math.max(0, totalPhases) : 0;
  // The final phase is paid at handover, not as a progress claim.
  const claimable = Math.max(0, phases - 1);
  if (claimable === 0 || value === 0) return 0;
  const done = Math.max(0, Math.min(claimable, Number.isFinite(phasesComplete) ? phasesComplete : 0));
  return Math.round(value * PROGRESS_SHARE * (done / claimable));
}

// What to release right now, given what has already been paid. Never negative, so a site
// whose value was renegotiated downward simply stops receiving claims rather than clawing
// cash back out of the player's account mid-job.
export function planProgressPayment(site = {}, contractValue = 0, phasesComplete = 0) {
  const totalPhases = Array.isArray(site.phases) ? site.phases.length : 0;
  const target = progressPaymentTarget(contractValue, totalPhases, phasesComplete);
  const alreadyPaid = Number.isFinite(site.progressPaid) ? site.progressPaid : 0;
  const release = Math.max(0, target - alreadyPaid);
  return { release, target, alreadyPaid };
}

// The balance owed at handover. This is what makes the invariant hold: whatever the deposit
// and progress claims did or did not pay, the final payment is the remainder, so the three
// always sum to the contract value less any penalty.
//
// ONE DELIBERATE CONSEQUENCE, worth stating because it is a balance decision and not an
// oversight: a late penalty is withheld from what is still owed, and can never claw back cash
// the client has already released. So a job whose phases were certified early is less exposed
// to running late than one that is behind on everything. That is both how liquidated damages
// actually work — they come off the final certificate — and self-correcting in play, because
// a job that is late is usually late precisely because its phases are NOT done, which leaves
// the penalty plenty of outstanding balance to bite into. The contract's 85% penalty cap in
// the completion path is unchanged.
export function finalPaymentDue(contractValue, penalty, depositPaid, progressPaid) {
  const value = Number.isFinite(contractValue) ? contractValue : 0;
  const pen = Number.isFinite(penalty) ? Math.max(0, penalty) : 0;
  const deposit = Number.isFinite(depositPaid) ? Math.max(0, depositPaid) : 0;
  const progress = Number.isFinite(progressPaid) ? Math.max(0, progressPaid) : 0;
  return Math.max(0, value - pen - deposit - progress);
}

// What the player has been paid on a job so far, for the site card. A running claim total is
// the number a contractor actually watches during a job.
export function summarizeSitePayments(site = {}) {
  const deposit = Number.isFinite(site.depositPaid) ? site.depositPaid : 0;
  const progress = Number.isFinite(site.progressPaid) ? site.progressPaid : 0;
  const value = Number.isFinite(site.totalValue) ? site.totalValue : 0;
  const received = deposit + progress;
  return {
    deposit,
    progress,
    received,
    outstanding: Math.max(0, value - received),
    percentReceived: value > 0 ? Math.round((received / value) * 100) : 0,
  };
}
