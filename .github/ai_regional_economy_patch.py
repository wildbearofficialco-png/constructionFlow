from pathlib import Path
p=Path("constructionFlow/src/games/constructionflow/ConstructionFlowScreen.js")
t=p.read_text()

imports='''import {
  getConstructionRegionalSnapshot,
  applyRegionalContractValue,
  applyRegionalMaterialPrice,
  applyRegionalWage,
} from "../../systems/constructionRegionalEconomy.js";
'''
anchor='import { recordTransaction } from "../../systems/financialLedger.js";\n'
if imports not in t:
    if anchor not in t: raise SystemExit("import anchor missing")
    t=t.replace(anchor, anchor+imports, 1)

old='''  const enhanced = enhanceContractValue(def, state, { value: Math.round(def.baseValue * seasonMult), deadline: baseDeadline });'''
new='''  const regionAdjustedBase = applyRegionalContractValue(def.baseValue, state);
  const enhanced = enhanceContractValue(def, state, { value: Math.round(regionAdjustedBase * seasonMult), deadline: baseDeadline });'''
if old not in t: raise SystemExit("contract anchor missing")
t=t.replace(old,new,1)

old='''    economyMult: g.economy?.demandIndex || 1.0,'''
new='''    economyMult: getConstructionRegionalSnapshot(g).lendingEconomyMult,'''
if old not in t: raise SystemExit("lending anchor missing")
t=t.replace(old,new,1)

old='''      const basePrice = g.materialPrices[matId] || MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice || 100;'''
new='''      const rawBasePrice = g.materialPrices[matId] || MATERIAL_DEFS.find((m) => m.id === matId)?.basePrice || 100;
      const basePrice = applyRegionalMaterialPrice(rawBasePrice, g);'''
if old not in t: raise SystemExit("material anchor missing")
t=t.replace(old,new,1)

old='''        skill: applicant.skill, wagePerDay: applicant.desiredWage,'''
new='''        skill: applicant.skill, wagePerDay: applyRegionalWage(applicant.desiredWage, g),'''
if old not in t: raise SystemExit("wage anchor missing")
t=t.replace(old,new,1)

old='''    const loanOffers = LOAN_PRODUCTS.map((product) => {'''
new='''    const regionalEconomy = getConstructionRegionalSnapshot(game);
    const loanOffers = LOAN_PRODUCTS.map((product) => {'''
if old not in t: raise SystemExit("finance calc anchor missing")
t=t.replace(old,new,1)

ui_anchor='''        {/* Financial Ledger */}'''
ui='''        {/* Regional Economy */}
        <View style={[styles.card, { backgroundColor: T.panel, borderColor: T.cyan, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: T.cyan }]}>Regional Economy · {regionalEconomy.stateName}</Text>
          <Text style={[styles.sub, subCol, { marginBottom: 8 }]}>
            Local construction conditions actively affect bids, materials, wages, and financing.
          </Text>
          {[
            { label: "Contract Market", val: \`\${regionalEconomy.contractValueMult.toFixed(2)}×\`, color: regionalEconomy.contractValueMult >= 1 ? T.green : T.orange },
            { label: "Material Prices", val: \`\${regionalEconomy.materialPriceMult.toFixed(2)}×\`, color: regionalEconomy.materialPriceMult <= 1 ? T.green : T.orange },
            { label: "Wage Pressure", val: \`\${regionalEconomy.wageMult.toFixed(2)}×\`, color: regionalEconomy.wageMult <= 1 ? T.green : T.orange },
            { label: "Lending Climate", val: \`\${regionalEconomy.lendingEconomyMult.toFixed(2)}×\`, color: regionalEconomy.lendingEconomyMult >= 1 ? T.green : T.orange },
          ].map((row) => (
            <View key={row.label} style={[styles.finRow, { borderBottomColor: T.border }]}>
              <Text style={[styles.sub, col]}>{row.label}</Text>
              <Text style={[styles.sub, { color: row.color, fontWeight: "700" }]}>{row.val}</Text>
            </View>
          ))}
        </View>

'''
if ui not in t:
    if ui_anchor not in t: raise SystemExit("finance UI anchor missing")
    t=t.replace(ui_anchor, ui+ui_anchor,1)

p.write_text(t)
