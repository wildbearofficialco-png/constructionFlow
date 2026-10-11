// Which Home sections a company sees, by how far it has come.
//
// On day 1 Home stacked ~17 sections under the tutorial card — an executive dashboard, national
// rank, market share, legacy score, rival tracking, market news — before the player had finished
// a single job. Sections now arrive when they start to mean something. Nothing is removed: the
// player can show the full dashboard at any time (g.homeShowAll), and the stages only ever widen.

export const HOME_STAGES = Object.freeze({ NEW: "new", GROWING: "growing", ESTABLISHED: "established" });

function num(v, f = 0) { return Number.isFinite(v) ? v : f; }

export function homeStage(g) {
  const jobs = num(g?.completedJobs, 0);
  const offices = Array.isArray(g?.cityOffices) ? g.cityOffices.length : 0;
  const level = num(g?.companyLevel, 1);
  if (jobs >= 5 || level >= 2 || offices > 0) return HOME_STAGES.ESTABLISHED;
  if (jobs >= 1) return HOME_STAGES.GROWING;
  return HOME_STAGES.NEW;
}

// Sections not listed here (the hero card, Site Office notices, Do This Next, Getting Started,
// Active Sites, settings) are always shown.
const STAGE_SECTIONS = {
  [HOME_STAGES.NEW]: [],
  [HOME_STAGES.GROWING]: ["level", "health", "streak", "weeklyReport", "clients", "priorities", "thisWeek", "opsFeed"],
  [HOME_STAGES.ESTABLISHED]: ["level", "health", "streak", "weeklyReport", "clients", "priorities", "thisWeek", "opsFeed",
    "weeklyChallenge", "executive", "standing", "marketNews", "rivals"],
};

export const ALL_OPTIONAL_SECTIONS = STAGE_SECTIONS[HOME_STAGES.ESTABLISHED];

export function homeSectionVisibility(g) {
  const stage = homeStage(g);
  const shown = new Set(g?.homeShowAll ? ALL_OPTIONAL_SECTIONS : STAGE_SECTIONS[stage]);
  const vis = { stage, showAll: Boolean(g?.homeShowAll) };
  // A pinned news item (the one-time market correction) shows Market News at any stage while
  // the pin lasts, so a player whose rivals were just revalued is told why.
  const day = num(g?.day, 0);
  if ((Array.isArray(g?.marketNews) ? g.marketNews : []).some((n) => n && num(n.pinUntilDay, -1) >= day)) shown.add("marketNews");
  for (const key of ALL_OPTIONAL_SECTIONS) vis[key] = shown.has(key);
  vis.hiddenCount = ALL_OPTIONAL_SECTIONS.filter((k) => !vis[k]).length;
  return vis;
}
