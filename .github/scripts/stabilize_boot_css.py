from pathlib import Path

STAMP='20260817-stable2'

# 1) Deterministic CSS in the HTML head: base + all phase styles + authoritative theme last.
p=Path('index.html')
s=p.read_text()
old='  <link rel="stylesheet" href="./styles.css">'
new='''  <link rel="stylesheet" href="./styles.css?v={s}">\n  <link rel="stylesheet" href="./phase5.css?v={s}" data-phase5-styles="true">\n  <link rel="stylesheet" href="./phase6.css?v={s}" data-phase6-styles="true">\n  <link rel="stylesheet" href="./phase7.css?v={s}" data-phase7-styles="true">\n  <link rel="stylesheet" href="./phase8.css?v={s}" data-phase8-styles="true">\n  <link rel="stylesheet" href="./phase9.css?v={s}" data-phase9-styles="true">\n  <link rel="stylesheet" href="./phase10.css?v={s}" data-phase10-styles="true">\n  <link rel="stylesheet" id="tpp-portal-theme-v3" href="./portal-theme-v3.css?v={s}">'''.format(s=STAMP)
if old not in s:
    raise SystemExit('index stylesheet anchor missing')
s=s.replace(old,new,1)

# Direct-load Phase 5 and 6 before the existing app module, independent of the dynamic feature loader.
# The canonical app module is known to be present near </body>.
if f'./js/phase5.js?v={STAMP}' not in s:
    marker='</body>'
    if marker not in s:
        raise SystemExit('index body close missing')
    direct=f'''  <script type="module" src="./js/phase5.js?v={STAMP}"></script>\n  <script type="module" src="./js/phase6.js?v={STAMP}"></script>\n'''
    s=s.replace(marker,direct+marker,1)
p.write_text(s)

# 2) Phase 5 mounts its UI immediately, then auth only populates it.
p=Path('js/phase5.js')
s=p.read_text()
needle='''onAuthStateChanged(auth, async (user) => {'''
pre='''// Mount the real Meeting Room immediately so the static placeholder is never left visible\n// while authentication/profile state is resolving.\ninstallStylesheet();\nensureMeetingView();\n\n'''
if pre not in s:
    if needle not in s:
        raise SystemExit('Phase 5 auth anchor missing')
    s=s.replace(needle,pre+needle,1)
p.write_text(s)

# 3) Remove Phase 5/6 from the delayed dynamic loader because index.html now loads them directly.
p=Path('js/firebase.js')
s=p.read_text()
for entry in [
    f'    "./phase5.js?v=20260817-stable1",\n',
    f'    "./phase6.js?v=20260817-stable1",\n',
    '    "./phase5.js",\n',
    '    "./phase6.js",\n'
]:
    s=s.replace(entry,'')
p.write_text(s)

# 4) Static authoritative theme exists in head; JS theme helper must not insert another copy.
p=Path('js/portal-theme-v3.js')
s=p.read_text()
s='''const THEME_ID = "tpp-portal-theme-v3";\n\nfunction markThemeReady() {\n  document.documentElement.dataset.tppTheme = "v3";\n}\n\nif (document.readyState === "loading") {\n  document.addEventListener("DOMContentLoaded", markThemeReady, { once: true });\n} else {\n  markThemeReady();\n}\n'''
p.write_text(s)
