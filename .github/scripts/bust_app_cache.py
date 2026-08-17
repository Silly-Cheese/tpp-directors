from pathlib import Path
p=Path('index.html')
s=p.read_text()
old='<script type="module" src="./js/app.js"></script>'
new='<script type="module" src="./js/app.js?v=20260817-stable3"></script>'
if old not in s:
    raise SystemExit('app script anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
