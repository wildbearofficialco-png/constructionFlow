// Recovery Guidance — failure states that tell the player what to do next.
//
// WildBear standard, failure-state rule: financial trouble, damaged assets, unavailable
// workers, overdue obligations and blocked work "must be understandable and have an
// intentional recovery path". The three things every one of them has to answer are:
//
//   WHAT HAPPENED · WHY IT HAPPENED · WHAT I CAN DO ABOUT IT
//
// Construction Flow's alerts were answering the first and stopping. "Insufficient Funds —
// Need $24,000." is true, and leaves the player staring at a wall. The functions here add
// the missing third clause, and they add it from actual game state (what you have, what the
// gap is, which of the recovery routes are open to you right now) rather than from a
// generic string — a suggestion the player cannot act on is worse than no suggestion.
//
// Pure: nothing here reads or writes game state beyond the snapshot it is handed, and
// nothing here changes what anything costs.

// Recovery routes, in the order a player should actually try them. Each is gated on whether
// it is genuinely available — never tell someone to take a loan they cannot qualify for.
function getCashRecoveryOptions({ cash = 0, shortfall = 0, hasActiveSites = false, creditScore = 600, canBorrow = true, savings = 0 } = {}) {
  const options = [];
  if (savings >= shortfall && shortfall > 0) {
    options.push("move money out of savings in Finance");
  }
  if (hasActiveSites) {
    options.push("finish an active job — payment lands on completion");
  }
  if (canBorrow && creditScore >= 600) {
    options.push("take a loan in Finance");
  }
  if (!hasActiveSites) {
    options.push("win a bid and get the 25% mobilisation deposit");
  }
  options.push("sell idle equipment in Vehicles");
  return options;
}

// Formats a list as prose without a trailing "or" dangling on a single item.
function joinOptions(options) {
  if (options.length === 0) return "";
  if (options.length === 1) return options[0];
  return `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`;
}

// The single most-used failure state in the game: you cannot afford this.
//
// `formatMoney` is injected so this module never owns currency formatting — the caller's
// `money()` stays the one source of truth for how a figure is rendered.
export function buildInsufficientFundsAlert({
  cost = 0,
  purchase = "this",
  cash = 0,
  savings = 0,
  hasActiveSites = false,
  creditScore = 600,
  canBorrow = true,
  formatMoney,
} = {}) {
  const fmt = typeof formatMoney === "function" ? formatMoney : (n) => `$${Math.round(n).toLocaleString()}`;
  const price = Math.max(0, Math.round(Number(cost) || 0));
  const balance = Math.round(Number(cash) || 0);
  const shortfall = Math.max(0, price - balance);

  const options = getCashRecoveryOptions({ cash: balance, shortfall, hasActiveSites, creditScore, canBorrow, savings });

  // What happened, why (the gap, stated as a number), and what to do about it.
  const body =
    `${purchase} costs ${fmt(price)}. You have ${fmt(balance)} — ${fmt(shortfall)} short.\n\n` +
    `To close the gap: ${joinOptions(options)}.`;

  return { title: "Not Enough Cash", body, shortfall };
}

// Why a project cannot be mobilised, and where the missing piece comes from. The reason
// itself is produced by the caller (it knows the contract's requirements); this attaches
// the route to fixing it, keyed off what kind of shortfall it is.
const ASSIGN_RECOVERY_BY_KIND = {
  equipment: "Buy or free up a machine in the Vehicles tab — equipment already on another site can't be double-booked.",
  tier: "Higher-tier jobs need bigger machines. Buy one in Vehicles, or take a lower-tier contract until you can afford it.",
  crew: "Hire in the Crew tab, or pull crew off another site. Resting and injured crew can't be assigned.",
  materials: "Buy the shortfall from the Sites tab once the job is open, or stock up from Bids before you mobilise.",
  frozen: "Pay the overdue tax bill in Finance to unfreeze the business. Nothing can start until it clears.",
  none: "",
};

export function getAssignBlockRecovery(kind) {
  return ASSIGN_RECOVERY_BY_KIND[kind] || "";
}

// Attaches the recovery clause to a block reason, so the alert reads as one thought rather
// than a rule followed by a hint.
export function buildAssignBlockAlert(reason, kind) {
  const recovery = getAssignBlockRecovery(kind);
  return {
    title: "Can't Start This Job Yet",
    body: recovery ? `${reason}\n\n${recovery}` : reason,
  };
}

// Credit is the one gate a player can be locked behind for a long time without being told
// how it moves, so this names the levers explicitly.
export function buildCreditTooLowAlert({ creditScore = 600, required = 680 } = {}) {
  const gap = Math.max(0, Math.round(required - creditScore));
  return {
    title: "Credit Score Too Low",
    body:
      `This needs a credit score of ${required}. Yours is ${Math.round(creditScore)} — ${gap} short.\n\n` +
      "Credit rises when you finish contracts on time and repay loans on schedule. It falls with late jobs, missed payments, and time spent overdrawn.",
  };
}

// Capacity limits are a progression gate, not a failure — but they still have to say what
// lifts them.
export function buildCapacityAlert({ kind = "crew", current = 0, cap = 0 } = {}) {
  const noun = kind === "crew" ? "crew members" : "machines";
  return {
    title: kind === "crew" ? "Crew At Capacity" : "Fleet At Capacity",
    body:
      `You're at ${current} of ${cap} ${noun}. Your office tier sets this limit.\n\n` +
      "Upgrade your office in Empire, or open a regional office in a new city, to raise it.",
  };
}
