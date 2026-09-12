from pathlib import Path

screen_path = Path('constructionFlow/src/games/constructionflow/ConstructionFlowScreen.js')
text = screen_path.read_text()

import_anchor = 'import { initTerritories, tickTerritories } from "../../systems/territorySystem.js";\n'
imports = '''import { initTerritories, tickTerritories } from "../../systems/territorySystem.js";
import { LENDING_PRODUCTS } from "../../data/lendingProducts.js";
import { computeLoanOffer, offerToLoanRecord } from "../../systems/lendingEngine.js";
import { recordTransaction } from "../../systems/financialLedger.js";
'''
if import_anchor not in text:
    raise SystemExit('Import anchor not found; refusing unsafe lending patch')
text = text.replace(import_anchor, imports, 1)

old_products = '''const LOAN_PRODUCTS = [
  { id: "micro",             label: "Emergency Micro Loan",    minCredit: 500, principal: 8000,   apr: 22, weeks: 8,   maxDebtFactor: 1.5 },
  { id: "working",           label: "Working Capital Loan",    minCredit: 560, principal: 20000,  apr: 14, weeks: 16,  maxDebtFactor: 2.5 },
  { id: "equipment",         label: "Equipment Finance Loan",  minCredit: 620, principal: 60000,  apr: 10, weeks: 28,  maxDebtFactor: 3.5 },
  { id: "expansion",         label: "Growth Loan",             minCredit: 680, principal: 150000, apr: 8,  weeks: 40,  maxDebtFactor: 5.0 },
  { id: "emergency_line",    label: "Emergency Credit Line",   minCredit: 500, principal: 5000,   apr: 22, weeks: 8,   maxDebtFactor: 1.5 },
  { id: "equipment_finance", label: "Equipment Financing",     minCredit: 560, principal: 35000,  apr: 10, weeks: 52,  maxDebtFactor: 3.0 },
  { id: "mega_bond",         label: "Infrastructure Bond",     minCredit: 720, principal: 500000, apr: 7,  weeks: 260, maxDebtFactor: 8.0 },
];'''
new_products = '''const LOAN_PRODUCTS = LENDING_PRODUCTS;

function getLendingCollateral(g, product) {
  const equipment = g.equipment || [];
  const appraised = equipment.map((e) => ({
    id: e.id,
    value: Math.max(0, Math.round((e.price || 0) * ((e.condition ?? 100) / 100))),
  }));
  if (product?.collateralType === "vehicle") {
    return appraised.sort((a, b) => b.value - a.value)[0] || { id: null, value: 0 };
  }
  if (product?.collateralType === "fleet") {
    return { id: null, value: appraised.reduce((sum, e) => sum + e.value, 0) };
  }
  if (product?.collateralType === "company") {
    return { id: null, value: Math.max(0, computeValuation(g)) };
  }
  return { id: null, value: 0 };
}

function buildBorrowerProfile(g, product) {
  const collateral = getLendingCollateral(g, product);
  const existingDebt = (g.loans || []).reduce((sum, loan) => sum + (loan.remainingBalance || 0), 0);
  const missedPaymentCount = (g.loans || []).reduce((sum, loan) => sum + (loan.missedPayments || 0), 0);
  const weeklyRevenue = g.weeklyStats?.revenue || 0;
  const weeklyExpenses = g.weeklyStats?.expenses || 0;
  return {
    creditScore: g.creditScore || 600,
    companyValue: Math.max(0, computeValuation(g)),
    cashFlow: weeklyRevenue - weeklyExpenses,
    existingDebt,
    missedPaymentCount,
    companyAgeDays: g.day || 0,
    collateralValue: collateral.value,
    economyMult: g.economy?.demandIndex || 1.0,
  };
}'''
if old_products not in text:
    raise SystemExit('Legacy loan product table not found; refusing unsafe lending patch')
text = text.replace(old_products, new_products, 1)

old_handler = '''  const handleTakeLoan = useCallback((product) => {
    update((g) => {
      if (g.creditScore < product.minCredit) { Alert.alert("Credit Too Low", `Need ${product.minCredit}+ credit score.`); return; }
      // Max 3 active loans (infinite-loop prevention)
      if ((g.loans||[]).length >= 3) { Alert.alert("Loan Limit", "You already have 3 active loans. Pay off a loan before taking another."); return; }
      // No new loans when cash is negative (bankruptcy recovery abuse prevention)
      if ((g.cash||0) < 0) { Alert.alert("Account in Red", "Cannot take loans while your account is negative. Generate revenue first."); return; }
      const existingDebt = (g.loans||[]).reduce((s, l) => s + l.remainingBalance, 0);
      const currentValuation = computeValuation(g);
      // Debt must be < 3× current valuation
      if (existingDebt > currentValuation * 3) { Alert.alert("Debt Limit", `Your debt-to-value ratio is too high. Grow your company or repay loans first.`); return; }
      const debtLimit = Math.max(5000, g.cash * product.maxDebtFactor + g.reputation * 60);
      if (existingDebt + product.principal > debtLimit) { Alert.alert("Debt Limit", "Too much existing debt for this loan."); return; }
      const loan = createLoanFromProduct(product, g);
      g.loans.push(loan);
      g.cash += product.principal;
      g.revenue += product.principal;
      addLog(g, `💳 Loan approved: ${money(product.principal)} (${Math.round(loan.apr)}% APR, ${product.weeks} weeks).`);
    });
  }, [update]);'''
new_handler = '''  const handleTakeLoan = useCallback((product) => {
    update((g) => {
      if ((g.loans || []).length >= 3) {
        Alert.alert("Loan Limit", "You already have 3 active loans. Pay off a loan before taking another.");
        return;
      }

      const profile = buildBorrowerProfile(g, product);
      const offer = computeLoanOffer(product.id, profile);
      if (!offer.approved) {
        Alert.alert("Financing Declined", (offer.reasons || ["You do not currently qualify for this product."]).join("\n\n"));
        return;
      }

      const collateral = getLendingCollateral(g, product);
      const loan = offerToLoanRecord(offer, uid, {
        collateralVehicleId: product.collateralType === "vehicle" ? collateral.id : null,
      });
      g.loans.push(loan);
      g.cash += offer.principal;
      // Borrowed principal is financing, not operating revenue.
      recordTransaction(g, "financing", offer.principal, `${offer.label} proceeds`, {
        loanId: loan.id,
        productId: offer.productId,
        apr: offer.apr,
      });
      addLog(g, `💳 Loan approved: ${money(offer.principal)} (${offer.apr}% APR, ${offer.termWeeks} weeks, ${money(offer.weeklyPayment)}/week).`);
    });
  }, [update]);'''
if old_handler not in text:
    raise SystemExit('Legacy handleTakeLoan block not found; refusing unsafe lending patch')
text = text.replace(old_handler, new_handler, 1)

old_offers = '    const loanOffers = LOAN_PRODUCTS.filter((p) => game.creditScore >= p.minCredit);'
new_offers = '''    const loanOffers = LOAN_PRODUCTS.map((product) => {
      const offer = computeLoanOffer(product.id, buildBorrowerProfile(game, product));
      return {
        ...product,
        _offer: offer,
        principal: offer.approved ? offer.principal : product.principalMin,
        apr: offer.approved ? offer.apr : product.aprMax,
        weeks: product.termWeeks,
        eligible: offer.approved,
        declineReasons: offer.approved ? [] : (offer.reasons || []),
      };
    });'''
if old_offers not in text:
    raise SystemExit('Finance loanOffers marker not found; refusing unsafe lending patch')
text = text.replace(old_offers, new_offers, 1)

old_card = '''            {(() => {
              const _score = game.creditScore || 600;
              const _disc = _score >= 780 ? 2.5 : _score >= 720 ? 1.5 : _score >= 660 ? 0.5 : 0;
              const _apr = Math.max(0.5, product.apr - _disc);
              return <Text style={[styles.sub, subCol]}>{_apr}% APR{_disc > 0 ? ` (−${_disc}% credit bonus)` : ""} · {product.weeks} weeks · {money(Math.round(product.principal * (1 + _apr / 100) / product.weeks))}/week</Text>;
            })()}
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, backgroundColor: T.blue, borderColor: T.blue }]}
              onPress={() => handleTakeLoan(product)}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>Take Loan</Text>
            </TouchableOpacity>'''
new_card = '''            {product.eligible ? (
              <>
                <Text style={[styles.sub, subCol]}>{product.apr}% APR · {product.weeks} weeks · {money(product._offer.weeklyPayment)}/week · Total {money(product._offer.totalRepayment)}</Text>
                <Text style={[styles.sub, { color: T.green, fontSize: 10, marginTop: 3 }]}>{product._offer.approvalReason}</Text>
                {product.collateralRequired && <Text style={[styles.sub, { color: T.orange, fontSize: 10, marginTop: 2 }]}>Secured financing · collateral required</Text>}
              </>
            ) : (
              <>
                <Text style={[styles.sub, { color: T.red }]}>Not currently eligible</Text>
                <Text style={[styles.sub, subCol, { fontSize: 10, marginTop: 3 }]}>{product.declineReasons[0] || `Needs ${product.minCredit}+ credit score.`}</Text>
              </>
            )}
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8, backgroundColor: product.eligible ? T.blue : T.panel2, borderColor: product.eligible ? T.blue : T.border }]}
              onPress={() => handleTakeLoan(product)}
            >
              <Text style={[styles.btnText, { color: product.eligible ? "#fff" : T.sub }]}>{product.eligible ? "Accept Financing" : "View Requirements"}</Text>
            </TouchableOpacity>'''
if old_card not in text:
    raise SystemExit('Legacy financing card block not found; refusing unsafe lending patch')
text = text.replace(old_card, new_card, 1)

screen_path.write_text(text)

engine_path = Path('constructionFlow/src/systems/lendingEngine.js')
engine = engine_path.read_text()
engine = engine.replace('from "../data/lendingProducts";', 'from "../data/lendingProducts.js";')
engine_path.write_text(engine)
