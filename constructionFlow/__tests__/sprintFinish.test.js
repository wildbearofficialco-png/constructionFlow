// Build 15 finishing items: contract values for new games only, the market-correction pin on
// Home, and the site decision card at the top of the site card.
import fs from "fs";
import path from "path";
import {
  freshState, migrateState, createContract, NEW_GAME_CONTRACT_VALUE_SCALE, STARTING_CASH,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";
import { homeSectionVisibility } from "../src/systems/homeLayout.js";
import { pushMarketNews } from "../src/systems/rivalMarket.js";
import { withSeed } from "../scripts/playtest/firstHourHarness.js";

describe("new-game balance never reaches existing saves", () => {
  test("a new game starts with $65,000 and 80% contract values", () => {
    const g = freshState();
    expect(g.cash).toBe(STARTING_CASH);
    expect(STARTING_CASH).toBe(65000);
    expect(g.contractValueScale).toBe(NEW_GAME_CONTRACT_VALUE_SCALE);
    expect(NEW_GAME_CONTRACT_VALUE_SCALE).toBe(0.8);
  });

  test("an existing save keeps its cash and full contract values", () => {
    const old = freshState();
    delete old.contractValueScale;
    old.cash = 75000; old.day = 40;
    const g = migrateState(JSON.parse(JSON.stringify(old)));
    expect(g.cash).toBe(75000);
    expect(g.contractValueScale).toBe(1);
    const full = withSeed(7, () => createContract({ ...g }, "fence").value);
    const scaled = withSeed(7, () => createContract({ ...g, contractValueScale: 0.8 }, "fence").value);
    expect(scaled).toBe(Math.round(full * 0.8));
  });

  test("a new game keeps its scale through save and load", () => {
    const g = migrateState(JSON.parse(JSON.stringify(freshState())));
    expect(g.contractValueScale).toBe(0.8);
  });
});

describe("the market correction is visible on Home at any stage", () => {
  const growing = () => ({ ...freshState(), day: 30, completedJobs: 2, homeShowAll: false });

  test("a pinned news item shows Market News for its pin, then the stage rule returns", () => {
    const g = growing();
    expect(homeSectionVisibility(g).marketNews).toBe(false);
    pushMarketNews(g, { text: "📉 Market correction", tone: "info", pinDays: 7 });
    expect(homeSectionVisibility(g).marketNews).toBe(true);
    g.day = 37;
    expect(homeSectionVisibility(g).marketNews).toBe(true);
    g.day = 38;
    expect(homeSectionVisibility(g).marketNews).toBe(false);
  });

  test("ordinary rival news does not pin anything", () => {
    const g = growing();
    pushMarketNews(g, { text: "IronPeak claimed a job", tone: "neutral" });
    expect(homeSectionVisibility(g).marketNews).toBe(false);
  });
});

test("the decision card sits above the crew and plant lists on the site card", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "games", "constructionflow", "ConstructionFlowScreen.js"), "utf8");
  const card = src.indexOf("{site.pendingChoice && (");
  const progress = src.indexOf("{/* Overall progress */}");
  const phase = src.indexOf("{/* Current phase */}");
  expect(card).toBeGreaterThan(progress);
  expect(card).toBeLessThan(phase);
});
