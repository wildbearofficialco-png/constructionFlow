// Render smoke tests — the whole screen, actually mounted, every tab visited.
//
// WHY THIS FILE EXISTS
// --------------------
// Construction Flow's suite tests state transitions (economy, offline progress, ledgers) but
// nothing had ever mounted the component. That left a whole class of defect reachable only by
// installing a build: a value of the wrong *shape* handed to a React child crashes the render
// with no type error and no lint error.
//
// This file found exactly that on its first run. `getCreditLabel()` returns
// `{ label, color }`, and a dashboard tile passed the object itself where a string belonged:
// "Objects are not valid as a React child (found: object with keys {label, color})". That is a
// white-screen crash on the tab the player lands on, and it would have shipped to TestFlight.
//
// So these tests are deliberately shallow and wide: they do not assert what a tab looks like,
// only that every tab renders without throwing, in the states a real save actually reaches.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import ConstructionFlowScreen, {
  freshState,
  TABS,
  EQUIPMENT_SHOP,
} from "../src/games/constructionflow/ConstructionFlowScreen.js";

jest.useFakeTimers();

const STORAGE_KEY = "constructionflow_v1_save";

// Mounts the screen against a seeded save and returns the renderer.
async function mountWith(mutate = () => {}) {
  const g = freshState();
  g.setupDone = true;
  g.tutorialDone = true;
  g.lastRealTimestamp = Date.now();
  mutate(g);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(g));

  let tree;
  await act(async () => {
    tree = TestRenderer.create(<ConstructionFlowScreen />);
  });
  await act(async () => {
    jest.advanceTimersByTime(10);
  });
  return tree;
}

function tabButton(tree, name) {
  return tree.root
    .findAll((n) => n.props && n.props.accessibilityRole === "tab", { deep: true })
    .find((b) => String(b.props.accessibilityLabel || "").startsWith(name));
}

// Visits every tab in turn and returns the rendered size of each, so a tab that renders
// nothing at all is distinguishable from one that renders a screen.
async function visitAllTabs(tree) {
  const sizes = {};
  for (const name of TABS) {
    const button = tabButton(tree, name);
    expect(button).toBeDefined();
    await act(async () => {
      button.props.onPress();
    });
    sizes[name] = JSON.stringify(tree.toJSON()).length;
  }
  return sizes;
}

// A save with a job site under way: crew and equipment assigned, materials partly delivered,
// a phase in progress. This is the state the Sites rewrite actually has to survive.
function withActiveSite(g) {
  const crewIds = g.crew.map((w) => w.id);
  const equipIds = g.equipment.map((e) => e.id);
  for (const w of g.crew) w.status = "Working";
  for (const e of g.equipment) e.status = "Active";

  const contract = g.contracts[0];
  g.activeSites = [{
    id: "site-1",
    contractId: contract.id,
    label: contract.label || "Test Site",
    client: contract.client || "Test Client",
    status: "Active",
    phases: ["Site Prep", "Foundation", "Framing", "Final Inspection"],
    currentPhaseIdx: 1,
    phaseProgress: 42,
    assignedCrewIds: crewIds,
    assignedEquipmentIds: equipIds,
    materialsFulfilled: { lumber: 20 },
    // Phase 2: an order in transit and a certified claim, so every scenario below renders
    // the delivery panel and the payments summary rather than only their empty case.
    pendingDeliveries: [{
      id: "dlv-test-concrete", matId: "concrete", label: "Concrete", unit: "m³",
      qty: 40, cost: 4800, emergency: false, orderedDay: g.day, arrivesDay: g.day + 2,
    }],
    progressPaid: 8000,
    phasesClaimed: 1,
    totalValue: 48000,
    depositPaid: 12000,
    penaltyPerDay: 500,
    deadlineDay: g.day + 9,
    startDay: g.day,
    siteMode: "normal",
    chaosHistory: [{ text: "Rain halted excavation for half a day.", day: g.day }],
    currentWeather: { label: "Heavy rain", icon: "rainy", severity: "moderate" },
    _progressRate: 0.6,
  }];
  g.contracts = g.contracts.map((c) => (c.id === contract.id ? { ...c, status: "Active" } : c));
}

describe("every tab renders", () => {
  test("a brand-new company", async () => {
    const tree = await mountWith();
    const sizes = await visitAllTabs(tree);
    for (const name of TABS) expect(sizes[name]).toBeGreaterThan(500);
  });

  test("a company mid-project, with crew, equipment and weather on site", async () => {
    const tree = await mountWith(withActiveSite);
    const sizes = await visitAllTabs(tree);
    for (const name of TABS) expect(sizes[name]).toBeGreaterThan(500);
  });

  test("a company in trouble: no cash, exhausted crew, broken machines, overdue site", async () => {
    // Every alert path on Home at once — low-cash runway, crew burnout, predictive warnings,
    // and an overdue job site with the late-penalty panel showing.
    const tree = await mountWith((g) => {
      withActiveSite(g);
      g.cash = 400;
      g.creditScore = 480;
      g.safetyScore = 22;
      g.taxDue = 4000;
      g.activeSites[0].deadlineDay = g.day - 6;
      g.activeSites[0].materialsFulfilled = {};
      for (const w of g.crew) { w.stamina = 8; w.mood = 12; }
      for (const e of g.equipment) { e.condition = 11; e.status = "Maintenance"; }
      g.importantNotice = { message: "A client withheld a progress payment.", tone: "red" };
    });
    const sizes = await visitAllTabs(tree);
    for (const name of TABS) expect(sizes[name]).toBeGreaterThan(500);
  });

  test("a large late-game company", async () => {
    const tree = await mountWith((g) => {
      g.cash = 12_500_000;
      g.day = 640;
      g.reputation = 96;
      g.completedJobs = 210;
      g.creditScore = 800;
      g.savings = 2_000_000;
      // Buy one of everything the shop sells, so every equipment card and image path renders.
      g.equipment = EQUIPMENT_SHOP.slice(0, 12).map((item, i) => ({
        id: `eq-${i}`,
        shopId: item.id,
        name: item.name,
        type: item.type,
        tier: item.tier,
        condition: 30 + ((i * 7) % 70),
        dailyCost: item.dailyCost,
        status: i % 3 === 0 ? "Maintenance" : "Idle",
        hours: i * 320,
        purchaseDay: 1,
        value: item.price,
      }));
      withActiveSite(g);
    });
    const sizes = await visitAllTabs(tree);
    for (const name of TABS) expect(sizes[name]).toBeGreaterThan(500);
  });

  test("light mode", async () => {
    // The stylesheet is theme-independent and colours are applied inline, so light mode is the
    // path most likely to hit a missing theme key.
    const tree = await mountWith((g) => {
      g.theme = "light";
      withActiveSite(g);
    });
    const sizes = await visitAllTabs(tree);
    for (const name of TABS) expect(sizes[name]).toBeGreaterThan(500);
  });

  test("mid-tutorial, before the player has done anything", async () => {
    const tree = await mountWith((g) => {
      g.tutorialDone = false;
    });
    const sizes = await visitAllTabs(tree);
    for (const name of TABS) expect(sizes[name]).toBeGreaterThan(500);
  });
});

describe("the rewritten surfaces actually appear", () => {
  // `visitAllTabs` only proves a tab did not throw. These pin that the Phase 1 rewrites are
  // on screen, so a future refactor that drops a card fails here rather than on a device.
  test("Home shows the command card, guidance and standing", async () => {
    const tree = await mountWith(withActiveSite);
    const json = JSON.stringify(tree.toJSON());
    for (const probe of [
      "Operating cash",   // hero card
      "Company value",
      "Crew free",        // hero stat tiles
      "Machines",
      "Do this next",     // the single Next Best Action
      "Company health",
      "Jobs done",        // standing row
      "Credit",
      "Safety",
    ]) {
      expect(json).toContain(probe);
    }
  });

  test("a job site shows its crew, machines, weather and running margin", async () => {
    const tree = await mountWith((g) => {
      withActiveSite(g);
      g.activeSites[0].label = "Riverside Fence";
      g.activeSites[0].client = "Acme Developments";
    });
    const sites = tabButton(tree, "Sites");
    await act(async () => { sites.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    for (const probe of [
      "Riverside Fence",
      "Acme Developments",
      "Foundation",                 // current phase
      "Heavy rain",                 // weather on site
      "Margin if it finishes now",  // the promoted project P&L
      "Received so far",            // deposit + certified progress claims (Phase 2)
      "Time left",
      "Site strategy",
    ]) {
      expect(json).toContain(probe);
    }
  });

  test("a job site shows its phase strip and what is on order", async () => {
    const tree = await mountWith(withActiveSite);
    const sites = tabButton(tree, "Sites");
    await act(async () => { sites.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    // The phase strip names every phase, not just the current one.
    for (const phase of ["Site Prep", "Foundation", "Framing", "Final Inspection"]) {
      expect(json).toContain(phase);
    }
    // Orders in transit are visible, so "waiting on a delivery" reads differently from
    // "nobody has ordered anything".
    expect(json).toContain("On order");
    expect(json).toContain("Concrete");
    // And what the client has actually released so far.
    expect(json).toContain("Received so far");
  });

  test("the Bids tab shows what a bid pays AND how likely it is to be won", async () => {
    // The bid used to show only a payout multiplier, which made Premium free money.
    const tree = await mountWith();
    const bids = tabButton(tree, "Bids");
    await act(async () => { bids.props.onPress(); });

    // The bid panel lives inside an expanded contract card, so open one first.
    const card = tree.root
      .findAll((n) => n.props && String(n.props.accessibilityLabel || "").startsWith("Contract:"), { deep: true })[0];
    expect(card).toBeDefined();
    await act(async () => { card.props.onPress(); });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Bid strategy");
    for (const style of ["Aggressive", "Standard", "Premium"]) {
      expect(json).toContain(style);
    }
    expect(json).toContain("% win");
  });

  test("Crew shows people, not rows: where they are, their standing, their voice", async () => {
    const tree = await mountWith((g) => {
      withActiveSite(g);
      // `withActiveSite` names the site after the contract it draws from, so name it
      // explicitly here — this test asserts the crew card says which job they are on.
      g.activeSites[0].label = "Riverside Fence";
      // One worker on the job, one sitting in the yard, one about to walk.
      g.crew[0].hireDay = 1;
      g.crew[0].jobsCompleted = 30;
      g.crew[1].status = "Idle";
      g.activeSites[0].assignedCrewIds = [g.crew[0].id];
      g.crew[2].loyalty = 8;
      g.crew[2].stamina = 9;
      g.day = 120;
    });
    const crew = tabButton(tree, "Crew");
    await act(async () => { crew.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());

    // Where they are — the fact the card never carried.
    expect(json).toContain("Riverside Fence");
    expect(json).toContain("no site assigned");
    // Their standing at this company.
    expect(json).toMatch(/with the company/);
    // And a risk that needs acting on before they quit.
    expect(json).toContain("Exhausted");
  });

  test("Equipment answers whether a machine is making money", async () => {
    const tree = await mountWith((g) => {
      withActiveSite(g);
      g.equipment[0].purchaseDay = 1;
      g.equipment[0].daysWorked = 40;
      g.day = 90;
    });
    const equipment = tabButton(tree, "Equipment");
    await act(async () => { equipment.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain("The yard");        // fleet summary
    expect(json).toContain("Fleet utilisation");
    expect(json).toContain("Utilisation");     // per-machine asset card
    expect(json).toContain("Resale");
    expect(json).toContain("Run cost");
  });

  test("the away report says what happened to the job sites", async () => {
    const tree = await mountWith((g) => {
      withActiveSite(g);
      g.pendingOfflineSummary = {
        elapsedDays: 3,
        cashDelta: 8200,
        jobsDelta: 0,
        repDelta: 2,
        cashNow: 83200,
        overheadPerDay: 1450,
        logsWhileAway: ["🌧️ Rain halted excavation for a day."],
        siteReport: [{
          id: "site-1",
          label: "Riverside Fence",
          kind: "progressed",
          tone: "safe",
          headline: "Riverside Fence — Foundation → Framing",
          detail: "42% → 67% · 1 phase complete",
          percentFrom: 42,
          percentTo: 67,
          phasesDone: 1,
          claimed: 12500,
        }],
      };
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Your job sites");
    expect(json).toContain("Foundation → Framing");
    expect(json).toContain("42% → 67%");
    expect(json).toContain("Progress payment received");
  });

  test("Home carries a market news feed, separate from the player's ops log", async () => {
    const tree = await mountWith((g) => {
      g.marketNews = [
        { id: "mn-1", text: "🏗️ Apex Construction opened a yard in Bend and hired 2 workers.", tone: "neutral", day: 40, rivalId: "apex" },
        { id: "mn-2", text: "📉 Northwest Contractors is weeks from closing, with creditors circling.", tone: "caution", day: 39, rivalId: "northwest" },
        { id: "mn-3", text: "🆕 Granite Works has opened for business — a concrete specialist.", tone: "info", day: 38, rivalId: "entrant_38_x" },
      ];
      // Home renders `opsFeed`, not `logs` — seed both so this really checks that market
      // news sits beside the player's own history rather than in place of it.
      g.logs = ["MY OWN SITE EVENT"];
      g.opsFeed = [{ id: "mine", text: "MY OWN SITE EVENT", tone: "neutral", day: 40 }];
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Market news");
    expect(json).toContain("opened a yard in Bend");
    expect(json).toContain("creditors circling");
    // React splits interpolated text into separate children, so the live-firm count and its
    // label are not one contiguous string in the tree — assert on the label alone.
    expect(json).toContain(" trading");
    // And the player's own feed is untouched by it.
    expect(json).toContain("MY OWN SITE EVENT");
  });

  test("a rival's status on Home comes from the lifecycle, not from its cash", async () => {
    const tree = await mountWith((g) => {
      g.rivals[0].status = "Struggling";
      g.rivals[0].cash = 400000; // plenty of cash, but the lifecycle says struggling
      g.rivals[0].rep = 90;
      g.rivals[1].status = "Active";
      g.rivals[1].rep = 85;
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Struggling");
  });

  test("Empire shows where you are on the ladder and what the next rung costs", async () => {
    // Phase 5. Every figure in this card is a perk the simulation applies; before Phase 5
    // four of the six office perks were strings on a purchase button and nothing else.
    const tree = await mountWith((g) => {
      g.officeIndex = 2;
      g.cash = 60000;
      g.cityOffices = [{ id: "o1", typeId: "regional_office", cityId: "seattle", openedDay: 4 }];
      g.properties = [{ id: "p1", typeId: "equipment_yard", purchasedDay: 6 }];
    });
    const empire = tabButton(tree, "Empire");
    await act(async () => { empire.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain("Company Ladder");
    expect(json).toContain("Rung 3 of 5");
    expect(json).toContain("Small Site Office");
    expect(json).toContain("Crew space");
    expect(json).toContain("Contracts on the board");
    // The buildings the player bought, each with what it actually gives them.
    expect(json).toContain("What your buildings give you");
    expect(json).toContain("Regional Office");
    expect(json).toContain("Equipment Yard");
    // And the next rung, priced against the cash on hand.
    expect(json).toContain("Next: Project Office");
  });

  test("Empire says so plainly at the top of the office ladder, rather than showing nothing", async () => {
    const tree = await mountWith((g) => { g.officeIndex = 4; });
    const empire = tabButton(tree, "Empire");
    await act(async () => { empire.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Rung 5 of 5");
    expect(json).toContain("Top of the office ladder");
    expect(json).not.toContain("Next: ");
  });

  test("an owned office property shows as no rent, not as $0 rent", async () => {
    const tree = await mountWith((g) => {
      g.officeIndex = 3;
      g.properties = [{ id: "p1", typeId: "office_property", purchasedDay: 2 }];
    });
    const empire = tabButton(tree, "Empire");
    await act(async () => { empire.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("You own it");
    expect(json).toContain("No office rent");
  });

  test("Empire tells you what your company has done and what it is costing you", async () => {
    // Phase 6, audit row 23. Before this the world had no memory: the only event history was
    // site.chaosHistory, capped at 10 and destroyed when the job finished.
    const tree = await mountWith((g) => {
      g.day = 150;
      g.companyMemory = [
        { tag: "delivered_a", kind: "triumph", valence: "good", day: 148, weight: 3,
          label: "Delivered Harbor Tower on time", detail: "you delivered Harbor Tower on time", subject: "Harbor Trust" },
        { tag: "supplier_stiffed_40", kind: "supplier", valence: "bad", day: 40, weight: 2,
          label: "Took materials without paying", detail: "you took a bulk order on account and never settled it", subject: "" },
      ];
    });
    const empire = tabButton(tree, "Empire");
    await act(async () => { empire.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain("Company Story");
    expect(json).toContain("What this company has done");
    expect(json).toContain("Delivered Harbor Tower on time");
    // The live consequence, not just the anecdote.
    expect(json).toContain("What your history is doing right now");
    // And the world referring back to the thing the player actually did.
    expect(json).toContain("you took a bulk order on account and never settled it");
  });

  test("a company with no past is told so, rather than shown an empty card", async () => {
    const tree = await mountWith((g) => { g.companyMemory = []; });
    const empire = tabButton(tree, "Empire");
    await act(async () => { empire.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Company Story");
    expect(json).toContain("Nothing on the record yet");
    expect(json).not.toContain("What your history is doing right now");
  });

  test("an empty Sites tab explains itself and offers a way out", async () => {
    const tree = await mountWith();
    const sites = tabButton(tree, "Sites");
    await act(async () => { sites.props.onPress(); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("No active job sites");
    expect(json).toContain("Go to Bids");
  });
});

describe("modals render", () => {
  test("the while-you-were-away report", async () => {
    const tree = await mountWith((g) => {
      withActiveSite(g);
      g.pendingOfflineSummary = {
        elapsedDays: 3,
        cashDelta: 8200,
        jobsDelta: 1,
        repDelta: 4,
        cashNow: 83200,
        overheadPerDay: 1450,
        logsWhileAway: [
          "🏗️ Foundation reached 67%.",
          "🌧️ Rain halted excavation for a day.",
          "💰 Progress payment received: $22,000.",
        ],
      };
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("While You Were Away");
    expect(json).toContain("Get Back to Work");
  });

  test("the setup screen for a device with no save at all", async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    let tree;
    await act(async () => {
      tree = TestRenderer.create(<ConstructionFlowScreen />);
    });
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(JSON.stringify(tree.toJSON())).toContain("Construction Flow");
  });
});

describe("the theme actually reaches the screen", () => {
  test("the app background is the construction charcoal, not FleetFlow's navy", async () => {
    const tree = await mountWith();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("#0a1018");
    expect(json).not.toContain("#071224");
  });
});
