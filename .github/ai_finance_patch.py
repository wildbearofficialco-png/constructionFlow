from pathlib import Path

path = Path('constructionFlow/src/games/constructionflow/ConstructionFlowScreen.js')
text = path.read_text()

calc_marker = '''    const loanOffers = LOAN_PRODUCTS.filter((p) => game.creditScore >= p.minCredit);\n\n    return ('''
calc_replacement = '''    const loanOffers = LOAN_PRODUCTS.filter((p) => game.creditScore >= p.minCredit);

    // Financial ledger view model. The ledger is history-only and never mutates balances.
    const ledgerCutoff = (game.day || 0) - 7;
    const ledger7d = (game.ledger || []).filter((entry) => (entry.day || 0) >= ledgerCutoff);
    const recentLedger = (game.ledger || []).slice(0, 8);
    const ledgerRevenue = ledger7d.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
    const ledgerExpenses = ledger7d.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const ledgerNet = ledgerRevenue - ledgerExpenses;
    const ledgerCategoryLabels = {
      payroll: "Payroll", fuel: "Fuel", maintenance: "Maintenance", equipment: "Equipment",
      materials: "Materials", insurance: "Insurance", utilities: "Utilities", inventory: "Inventory",
      taxes: "Taxes", financing: "Financing", property: "Property", fines: "Fines & Legal",
      contracts: "Contracts", bonuses: "Bonuses", sales: "Asset Sales", misc: "Other",
    };
    const summarizeLedgerCategories = (entries, sign) => Object.entries(entries.reduce((acc, entry) => {
      if ((sign === "income" && entry.amount <= 0) || (sign === "expense" && entry.amount >= 0)) return acc;
      const key = entry.category || "misc";
      acc[key] = (acc[key] || 0) + Math.abs(entry.amount);
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const topRevenueCategories = summarizeLedgerCategories(ledger7d, "income");
    const topExpenseCategories = summarizeLedgerCategories(ledger7d, "expense");

    return ('''

if calc_marker not in text:
    raise SystemExit('Finance calculation marker not found; refusing unsafe patch')
text = text.replace(calc_marker, calc_replacement, 1)

ui_marker = '''        </View>\n\n        {/* R16-1: Business Savings */}'''
ui_replacement = '''        </View>

        {/* Financial Ledger */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.strongBorder, borderWidth: 1.5 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <View>
              <Text style={[styles.sectionTitle, col]}>Transaction Ledger</Text>
              <Text style={[styles.sub, subCol]}>Last 7 days · cash movements recorded automatically</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: (ledgerNet >= 0 ? T.green : T.red) + "22" }]}>
              <Text style={[styles.statusPillText, { color: ledgerNet >= 0 ? T.green : T.red }]}>
                {ledgerNet >= 0 ? "+" : ""}{money(ledgerNet)} net
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Income", value: ledgerRevenue, color: T.green, prefix: "+" },
              { label: "Expenses", value: ledgerExpenses, color: T.red, prefix: "-" },
              { label: "Net", value: Math.abs(ledgerNet), color: ledgerNet >= 0 ? T.green : T.red, prefix: ledgerNet >= 0 ? "+" : "-" },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1, backgroundColor: T.panel2, borderRadius: 8, padding: 9, alignItems: "center" }}>
                <Text style={{ color: item.color, fontSize: 13, fontWeight: "800" }}>{item.prefix}{money(item.value)}</Text>
                <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {ledger7d.length > 0 ? (
            <>
              {(topRevenueCategories.length > 0 || topExpenseCategories.length > 0) && (
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sub, { color: T.green, fontWeight: "700", marginBottom: 4 }]}>TOP INCOME</Text>
                    {topRevenueCategories.map(([category, amount]) => (
                      <View key={`rev-${category}`} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={[styles.sub, subCol]} numberOfLines={1}>{ledgerCategoryLabels[category] || category}</Text>
                        <Text style={[styles.sub, { color: T.green }]}>+{money(amount)}</Text>
                      </View>
                    ))}
                    {topRevenueCategories.length === 0 && <Text style={[styles.sub, subCol]}>No income yet</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sub, { color: T.red, fontWeight: "700", marginBottom: 4 }]}>TOP SPENDING</Text>
                    {topExpenseCategories.map(([category, amount]) => (
                      <View key={`exp-${category}`} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={[styles.sub, subCol]} numberOfLines={1}>{ledgerCategoryLabels[category] || category}</Text>
                        <Text style={[styles.sub, { color: T.red }]}>-{money(amount)}</Text>
                      </View>
                    ))}
                    {topExpenseCategories.length === 0 && <Text style={[styles.sub, subCol]}>No expenses yet</Text>}
                  </View>
                </View>
              )}

              <Text style={[styles.sub, { color: T.sub, fontWeight: "700", marginBottom: 5 }]}>RECENT TRANSACTIONS</Text>
              {recentLedger.map((entry, index) => (
                <View key={entry.id || `${entry.day}-${index}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: (entry.amount >= 0 ? T.green : T.orange) + "22", marginRight: 8 }}>
                    <Ionicons name={entry.amount >= 0 ? "arrow-down" : "arrow-up"} size={14} color={entry.amount >= 0 ? T.green : T.orange} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.sub, col]} numberOfLines={1}>{entry.description || ledgerCategoryLabels[entry.category] || "Transaction"}</Text>
                    <Text style={[styles.sub, { color: T.sub, fontSize: 10 }]}>Day {entry.day || 0} · {ledgerCategoryLabels[entry.category] || entry.category || "Other"} · Balance {money(entry.balance || 0)}</Text>
                  </View>
                  <Text style={[styles.sub, { color: entry.amount >= 0 ? T.green : T.red, fontWeight: "800" }]}>
                    {entry.amount >= 0 ? "+" : "-"}{money(Math.abs(entry.amount))}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <View style={{ backgroundColor: T.panel2, borderRadius: 8, padding: 12 }}>
              <Text style={[styles.sub, { color: T.sub, textAlign: "center" }]}>No ledger activity yet. New income and expenses will appear here automatically.</Text>
            </View>
          )}
        </View>

        {/* R16-1: Business Savings */}'''

if ui_marker not in text:
    raise SystemExit('Finance UI marker not found; refusing unsafe patch')
text = text.replace(ui_marker, ui_replacement, 1)
path.write_text(text)
