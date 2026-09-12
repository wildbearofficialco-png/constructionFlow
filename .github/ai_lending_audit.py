from pathlib import Path

p = Path('constructionFlow/src/games/constructionflow/ConstructionFlowScreen.js')
text = p.read_text()
needles = ['LOAN_PRODUCTS', 'handleTakeLoan', 'handlePayoffLoan', 'handleLoanPartialPayment', 'missedPayments', 'weeklyPayment']
lines = text.splitlines()
out=[]
for needle in needles:
    out.append(f'===== {needle} =====')
    hits=[i for i,l in enumerate(lines) if needle in l]
    for i in hits[:8]:
        a=max(0,i-18); b=min(len(lines),i+45)
        out.append(f'--- lines {a+1}-{b} ---')
        out.extend(lines[a:b])
    out.append('')
Path('constructionFlow/docs/LENDING_SCREEN_AUDIT.txt').write_text('\n'.join(out))
# trigger audit workflow
