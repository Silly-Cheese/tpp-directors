from pathlib import Path
p = Path('index.html')
s = p.read_text()
old = 'Portal actions may be recorded. PINs and activation codes are never stored in Cloud Firestore.'
new = 'Portal actions may be recorded. PINs are never stored in Cloud Firestore. Temporary activation codes are retained only in the Founder-protected recovery vault so an account can be activated without creating duplicates.'
if old not in s:
    raise SystemExit('security note anchor not found')
p.write_text(s.replace(old, new, 1))
