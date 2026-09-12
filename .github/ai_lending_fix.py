from pathlib import Path
p = Path('constructionFlow/src/games/constructionflow/ConstructionFlowScreen.js')
text = p.read_text()
old = 'join("\n\n")'
new = 'join("\\n\\n")'
if old not in text:
    raise SystemExit('Expected lending decline separator not found')
text = text.replace(old, new, 1)
p.write_text(text)
