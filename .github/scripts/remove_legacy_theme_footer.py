from pathlib import Path

p = Path('index.html')
s = p.read_text()
s = s.replace('<meta name="theme-color" content="#0b1730">', '<meta name="theme-color" content="#030303">')
s = s.replace('  <link rel="stylesheet" href="./prayer-project-brand.css">\n', '')
s = s.replace('  <link rel="stylesheet" href="./form-contrast.css">\n', '')
footer = '    <footer><span>© The Prayer Project</span><span>Directors · Governance · Accountability</span></footer>\n'
if footer not in s:
    raise SystemExit('footer anchor not found')
s = s.replace(footer, '')
p.write_text(s)
