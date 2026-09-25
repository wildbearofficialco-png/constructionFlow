// Plant requirements: the right machine for the job, not any machine for any job.
//
// WHY THIS MODULE EXISTS
// ----------------------
// Sprint 12. Reported from a device: "if you're going to be doing a job, it should require
// certain equipment. I don't feel like you should be able to use any equipment for any job.
// In real life you need specific equipment for the specific job you're doing."
//
// Correct, and the code agreed with the complaint. Equipment type was a BONUS and never a
// requirement:
//
//     const phaseAffinity = PHASE_TYPE_BONUS[currentPhaseName] || {};
//     const equipTypeBonus = assignedEquip.reduce((best, e) => {
//       const b = phaseAffinity[e.type] || 1.0;
//       return b > best ? b : best;
//     }, 1.0);
//
// Bring a tower crane to a driveway and you got 1.0x. Bring a pickup truck to a pile-driving
// phase and you also got 1.0x — the floor of that reduce is 1.0, so the WRONG machine and NO
// machine were worth exactly the same, and the right machine was a mild speed-up you could
// ignore. Nothing in the game ever said "you cannot do this without a crane."
//
// This module adds the requirement the bonus table implied but never enforced.
//
// DESIGN RULE: BLOCK AT THE GATE, STALL IN THE MIDDLE.
// A phase you have not started refuses to start without its plant, with a message naming the
// machine. A phase already under way whose plant has broken or been sold does NOT hard-stop —
// it crawls. A hard stop mid-project on a machine that broke through no fault of the player is
// a dead save, and this project's standing rule is that a setback must never become one.
//
// Everything here is pure and RNG-free.

// Equipment types as EQUIPMENT_SHOP defines them.
export const PLANT_TYPES = ["Earthwork", "Lifting", "Concrete", "Foundation", "Utility"];

// Tier 3 and above is "heavy plant" — the class a licence actually matters for. See
// siteCompliance.js, which reads this.
export const HEAVY_TIER = 3;

// What a phase genuinely cannot be done without.
//
// Deliberately sparser than PHASE_TYPE_BONUS. A bonus table can afford to have an opinion about
// every phase; a REQUIREMENT table gates the player, so it only names plant whose absence would
// actually stop the work in the real trade. Finish and fit-out phases require nothing: people
// with hand tools do that work, and demanding a machine for it would be theatre.
export const PHASE_PLANT_REQUIREMENTS = Object.freeze({
  "Site Prep":        { anyOf: ["Earthwork"], minTier: 1, why: "clearing and grading needs earthmoving plant" },
  "Demo":             { anyOf: ["Earthwork"], minTier: 2, why: "demolition needs machine plant, not hand tools" },
  "Survey":           { anyOf: ["Utility", "Earthwork"], minTier: 1, why: "a survey crew needs transport to site" },
  "Excavation":       { anyOf: ["Earthwork"], minTier: 2, why: "you cannot dig a commercial excavation with a skid steer" },
  "Earthwork":        { anyOf: ["Earthwork"], minTier: 2, why: "bulk earthworks need medium plant or better" },
  "Dredging":         { anyOf: ["Earthwork", "Foundation"], minTier: 3, why: "dredging needs heavy plant" },
  "Foundation":       { anyOf: ["Foundation", "Concrete", "Earthwork"], minTier: 2, why: "foundations need excavation or concrete plant" },
  "Foundation Piers": { anyOf: ["Foundation", "Concrete"], minTier: 2, why: "piers need foundation or concrete plant" },
  "Piling":           { anyOf: ["Foundation"], minTier: 4, why: "piles are driven or bored — nothing else will do it" },
  "Dock Structure":   { anyOf: ["Foundation", "Lifting"], minTier: 3, why: "marine structure needs heavy plant" },
  "Structure":        { anyOf: ["Lifting"], minTier: 3, why: "structural work needs lifting plant" },
  "Structural":       { anyOf: ["Lifting"], minTier: 3, why: "structural work needs lifting plant" },
  "Structural Steel": { anyOf: ["Lifting"], minTier: 3, why: "steel has to be lifted into place" },
  "Steel Frame":      { anyOf: ["Lifting"], minTier: 3, why: "steel has to be lifted into place" },
  "Core":             { anyOf: ["Lifting", "Concrete"], minTier: 3, why: "a building core needs lifting or pumping plant" },
  "Deck Pour":        { anyOf: ["Concrete"], minTier: 3, why: "a deck pour needs a concrete pump" },
  "Deck":             { anyOf: ["Lifting", "Concrete"], minTier: 2, why: "deck work needs lifting or concrete plant" },
  "Framing":          { anyOf: ["Lifting", "Utility"], minTier: 1, why: "framing needs at least material handling on site" },
  "Roofing":          { anyOf: ["Lifting", "Utility"], minTier: 1, why: "roofing materials have to get up there" },
  "Roof Structure":   { anyOf: ["Lifting"], minTier: 2, why: "roof structure needs lifting plant" },
  "Envelope":         { anyOf: ["Lifting"], minTier: 2, why: "facade panels need lifting plant" },
  "Facade":           { anyOf: ["Lifting"], minTier: 3, why: "facade work needs reach lifting" },
  "Paving":           { anyOf: ["Earthwork"], minTier: 3, why: "paving needs a paver or heavy earthwork plant" },
  "Base Layer":       { anyOf: ["Earthwork"], minTier: 2, why: "a road base has to be laid and compacted by machine" },
  "Surfacing":        { anyOf: ["Earthwork"], minTier: 3, why: "surfacing needs paving plant" },
  "Utilities":        { anyOf: ["Earthwork", "Utility"], minTier: 1, why: "utility trenching needs plant on site" },
  "Material Delivery":{ anyOf: ["Earthwork", "Utility"], minTier: 1, why: "something has to carry the materials" },
  "Warehousing":      { anyOf: ["Lifting", "Utility"], minTier: 1, why: "materials have to be moved and stacked" },
  "Post Installation":{ anyOf: ["Earthwork", "Utility"], minTier: 1, why: "posts need boring or handling plant" },
  "Fence Assembly":   { anyOf: ["Utility", "Earthwork"], minTier: 1, why: "the crew and materials have to reach the line" },
  "Seating Structure":{ anyOf: ["Lifting"], minTier: 2, why: "precast seating has to be lifted" },
  "Barriers":         { anyOf: ["Lifting", "Earthwork"], minTier: 2, why: "barriers are placed by machine" },
  // Everything else — Finish Work, Finishes, Finishing, Fitout, Interior, Exterior, MEP,
  // MEP Rough, Commissioning, Inspection, Final Inspection, Striping — is trade labour. No
  // requirement, on purpose.
});

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function tierOf(machine) {
  return Number.isFinite(machine?.tier) ? machine.tier : 1;
}

// A machine only counts if it is actually available to work. A broken machine on the books is
// not plant on site, which is the whole reason a breakdown is felt at all.
export function isUsable(machine) {
  if (!machine) return false;
  const status = String(machine.status || "");
  return status !== "Broken" && status !== "Maintenance" && status !== "In Repair" && status !== "Sold";
}

// THE ROOT ERROR THIS FIXES.
//
// Every contract in the game already carries its own `minTier` — the garage job says
// `minTier: 1`, meaning tier-1 plant is enough to do it. Sprint 12 then invented a SECOND,
// stricter, per-phase requirement ("Foundation needs tier 2") and let it silently override the
// contract's own stated requirement. A player who owned exactly what the job asked for was
// throttled to a quarter speed for it, with nothing on screen explaining why.
//
// The contract's own figure wins. The phase table still decides WHICH KIND of plant the work
// needs — you cannot drive piles with a pickup — but it may not demand a bigger machine than
// the job itself asked for.
export function requirementFor(phaseName, contractMinTier = null) {
  const req = PHASE_PLANT_REQUIREMENTS[phaseName];
  if (!req) return null;
  if (!Number.isFinite(contractMinTier)) return req;
  return { ...req, minTier: Math.min(req.minTier, Math.max(1, contractMinTier)) };
}

// Does this set of machines satisfy the phase?
export function satisfies(phaseName, machines, contractMinTier = null) {
  const req = requirementFor(phaseName, contractMinTier);
  if (!req) return true;
  return arr(machines).some(
    (m) => isUsable(m) && req.anyOf.includes(m.type) && tierOf(m) >= req.minTier
  );
}

// What is missing, in words the player can act on. Returns null when nothing is.
export function missingPlantFor(phaseName, machines, contractMinTier = null) {
  const req = requirementFor(phaseName, contractMinTier);
  if (!req || satisfies(phaseName, machines, contractMinTier)) return null;

  // Distinguish "you own nothing suitable" from "the suitable machine is broken", because they
  // need completely different actions from the player.
  const ownedButUnusable = arr(machines).some(
    (m) => !isUsable(m) && req.anyOf.includes(m.type) && tierOf(m) >= req.minTier
  );

  return {
    phase: phaseName,
    anyOf: req.anyOf,
    minTier: req.minTier,
    why: req.why,
    ownedButUnusable,
    summary: `${phaseName} needs ${req.anyOf.join(" or ")} plant at tier ${req.minTier} or above — ${req.why}.`,
    action: ownedButUnusable
      ? "You own a machine that would do it, but it is out of service. Repair it first."
      : `Buy or assign ${req.anyOf.join(" or ")} plant of tier ${req.minTier}+.`,
  };
}

// ─── Starting a site ─────────────────────────────────────────────────────────

// Checked against the machines the player is actually assigning, for the FIRST phase only.
// Demanding the plant for every phase up front would mean a player could not take a job until
// they owned a tower crane for a fit-out six months away, which is not how a contractor works:
// you win the job, then you hire in.
export function canStartWithPlant(phases, machines, contractMinTier = null) {
  const first = arr(phases)[0];
  if (!first) return { ok: true, missing: null };
  const missing = missingPlantFor(first, machines, contractMinTier);
  return { ok: !missing, missing };
}

// Every phase of a job, with what it will need. This is the honest version of the check above:
// the player is told up front what is coming, rather than being blocked by surprise at phase 4.
export function plantPlanFor(phases, machines, contractMinTier = null) {
  return arr(phases).map((phaseName) => {
    const req = requirementFor(phaseName, contractMinTier);
    return {
      phase: phaseName,
      required: req ? { anyOf: req.anyOf, minTier: req.minTier } : null,
      satisfied: satisfies(phaseName, machines, contractMinTier),
    };
  });
}

// ─── Mid-phase ───────────────────────────────────────────────────────────────

// How badly progress suffers when the required plant is not on site. NOT zero, deliberately:
// a machine breaking mid-phase must be a setback the player can dig out of, never a dead save.
// The crew keep working by hand and get a fraction of the rate.
// Was 0.25 — a FOUR-TIMES slowdown for bringing a tier-1 machine to a tier-2 phase. On a real
// device that turned a garage job into "~32 days remaining · 14.8%/day" against a six-day
// deadline, and the player was never told why. A penalty should be felt, not fatal.
export const STALL_FACTOR = 0.55;

export function plantProgressFactor(phaseName, machines, contractMinTier = null) {
  return satisfies(phaseName, machines, contractMinTier) ? 1.0 : STALL_FACTOR;
}
