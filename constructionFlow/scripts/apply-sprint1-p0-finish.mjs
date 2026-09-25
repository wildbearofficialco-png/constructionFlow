import fs from "node:fs";
import path from "node:path";

const screenPath = path.resolve("src/games/constructionflow/ConstructionFlowScreen.js");
let code = fs.readFileSync(screenPath, "utf8");

function replaceExactlyOnce(label, from, to) {
  const first = code.indexOf(from);
  if (first < 0) throw new Error(`${label}: anchor not found`);
  if (code.indexOf(from, first + from.length) >= 0) throw new Error(`${label}: anchor occurs more than once`);
  code = code.slice(0, first) + to + code.slice(first + from.length);
  console.log(`patched: ${label}`);
}

replaceExactlyOnce(
  "crew tick-rate imports",
  `import { chaosChancePerTick } from "../../systems/siteEvents.js";\nimport { penaltyFor } from "../../systems/penalties.js";`,
  `import { chaosChancePerTick } from "../../systems/siteEvents.js";\nimport {\n  rushStaminaChancePerTick,\n  skillGainChancePerTick,\n  RUSH_STAMINA_PER_HIT,\n  SKILL_GAIN_PER_EVENT,\n} from "../../systems/crewTickRates.js";\nimport { equipmentRepairEventCost, fuelSurgeEventCost } from "../../systems/eventEconomy.js";\nimport { penaltyFor } from "../../systems/penalties.js";`
);

replaceExactlyOnce(
  "rush stamina rate",
  `    // Rush/overtime: extra stamina drain\n    if ((site.siteMode === "rush" || site.siteMode === "overtime") && Math.random() < 0.25) {\n      for (const id of site.assignedCrewIds) {\n        const w = g.crew.find(cw => cw.id === id);\n        if (w) w.stamina = Math.max(0, (w.stamina ?? 50) - 2);\n      }\n    }`,
  `    // Rush/overtime: extra stamina drain. Expressed as a per-DAY design rate so future\n    // clock changes cannot silently multiply the cost. At the current 32 ticks/day this is\n    // intentionally identical to the old 25% per-tick behavior.\n    if ((site.siteMode === "rush" || site.siteMode === "overtime") && Math.random() < rushStaminaChancePerTick()) {\n      for (const id of site.assignedCrewIds) {\n        const w = g.crew.find(cw => cw.id === id);\n        if (w) w.stamina = Math.max(0, (w.stamina ?? 50) - RUSH_STAMINA_PER_HIT);\n      }\n    }`
);

replaceExactlyOnce(
  "skill gain rate",
  `      if (Math.random() < 0.05 && (w.skill || 0) < 120) w.skill = Math.min(120, (w.skill || 75) + 1);`,
  `      // Skill progression is a per-DAY expectation, not a hard-coded per-tick chance.\n      // Current feel is preserved while making it immune to future tick-length changes.\n      if (Math.random() < skillGainChancePerTick() && (w.skill || 0) < 120) {\n        w.skill = Math.min(120, (w.skill || 75) + SKILL_GAIN_PER_EVENT);\n      }`
);

replaceExactlyOnce(
  "breakdown event cost",
  `        const repairCost = rand(800, 3500);\n        game.pendingBreakdown = {`,
  `        // Repair exposure follows the actual machine and severity instead of a flat\n        // starter-to-mega-company dollar range.\n        const repairCost = equipmentRepairEventCost(assigned, {\n          severity: 1 + Math.max(0, 100 - (assigned.condition || 100)) / 100,\n          roll: Math.random(),\n        });\n        game.pendingBreakdown = {`
);

replaceExactlyOnce(
  "fuel surge event cost",
  `  { id: "fuel_cost",  label: "Fuel Cost Surge",       prob: 0.02, tone: "orange", icon: "⛽",\n    apply: (site, game) => {\n      const surcharge = rand(500, 2000);\n      game.cash -= surcharge;\n      addLog(game, \`⛽ Fuel cost surge on \${site.label} — \${money(surcharge)} equipment surcharge.\`);\n      return { text: \`Fuel surge — \${money(surcharge)} equipment surcharge.\`, type: "fuel_cost" };\n    }\n  },`,
  `  { id: "fuel_cost",  label: "Fuel Cost Surge",       prob: 0.02, tone: "orange", icon: "⛽",\n    apply: (site, game) => {\n      // Exposure follows the fleet that is actually burning fuel. A one-pickup starter\n      // company and a crane/dozer fleet no longer receive the same arbitrary bill.\n      const surcharge = fuelSurgeEventCost(game.equipment || [], { surgePct: 0.30, exposureDays: 5 });\n      game.cash -= surcharge;\n      game.expenses = (game.expenses || 0) + surcharge;\n      if (game.weeklyStats) game.weeklyStats.expenses = (game.weeklyStats.expenses || 0) + surcharge;\n      addLog(game, \`⛽ Fuel cost surge on \${site.label} — \${money(surcharge)} equipment surcharge.\`);\n      return { text: \`Fuel surge — \${money(surcharge)} equipment surcharge.\`, type: "fuel_cost" };\n    }\n  },`
);

fs.writeFileSync(screenPath, code);
console.log("Sprint 1 P0 live-code anchors patched successfully.");
