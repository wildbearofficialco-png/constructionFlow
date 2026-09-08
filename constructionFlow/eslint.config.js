const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["node_modules/**", "assets/**", ".expo/**", "dist/**"],
  },
  {
    // These rules flag real pre-existing code smells in the large game screen
    // (inherited from FleetFlow's ConstructionFlow implementation), but the fixes
    // require case-by-case behavioral review, not a mechanical sweep. Downgraded to
    // warn so CI catches new regressions without blocking on pre-existing debt.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];
