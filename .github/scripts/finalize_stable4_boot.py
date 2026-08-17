from pathlib import Path
p=Path('index.html')
s=p.read_text()
for old in ['20260817-stable2','20260817-stable3']:
    s=s.replace(old,'20260817-stable4')
# Replace separate critical module scripts with one deterministic boot script.
for line in [
    '  <script type="module" src="./js/app.js?v=20260817-stable4"></script>\n',
    '  <script type="module" src="./js/phase5.js?v=20260817-stable4"></script>\n',
    '  <script type="module" src="./js/phase6.js?v=20260817-stable4"></script>\n',
    '  <script type="module" src="./js/app.js"></script>\n'
]:
    s=s.replace(line,'')
marker='</body>'
boot='  <script type="module" src="./js/boot-stable.js?v=20260817-stable4"></script>\n'
if boot not in s:
    s=s.replace(marker,boot+marker,1)
p.write_text(s)
