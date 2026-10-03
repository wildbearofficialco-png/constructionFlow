// An earned chain opportunity that is waiting for the company to be able to take it.
//
// Sprint 1. These used to arrive as ordinary bids with a 14-day clock, before a new company could
// possibly staff or equip them, and expire unused. They now wait here, with every gate spelled out,
// and no clock runs until all of them are met. Presentational: the gates come from
// systems/chainOpportunities.js.

import React from "react";
import { View, Text } from "react-native";
import { chainReadiness } from "../systems/chainOpportunities.js";
import { SPACING, RADIUS, TYPE, alpha, THEMES } from "../theme/constructionTheme";

export default function ChainOpportunityCard({ T = THEMES.dark, contract, company, formatMoney = (n) => `$${n}` }) {
  const { gates } = chainReadiness(contract, company);
  return (
    <View
      testID="chain-opportunity-card"
      style={{
        backgroundColor: alpha(T.info || T.steel || "#38bdf8", 0.08), borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: alpha(T.info || T.steel || "#38bdf8", 0.45),
        padding: SPACING.md, marginBottom: SPACING.md,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[TYPE.label, { color: T.text, flex: 1 }]}>🔒 {contract.label}</Text>
        <Text style={[TYPE.bodyStrong, { color: T.sub }]}>{formatMoney(contract.value)}</Text>
      </View>
      <Text style={[TYPE.caption, { color: T.sub, marginTop: 2, marginBottom: SPACING.sm }]}>
        Earned — held for you with no expiry. The {contract.durationDays}-day bid window opens when your company meets every line below.
      </Text>
      {gates.map((g) => (
        <View key={g.key} style={{ marginBottom: 4 }}>
          <Text style={[TYPE.caption, { color: g.ok ? T.safe : T.caution, fontWeight: "700" }]}>
            {g.ok ? "✓" : "✗"} {g.label}
            {g.need != null ? `: need ${g.need}` : ""}
            {g.have != null ? `, you have ${g.have}` : ""}
          </Text>
          {!g.ok && g.hint ? <Text style={[TYPE.caption, { color: T.sub, marginLeft: 14 }]}>{g.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}
