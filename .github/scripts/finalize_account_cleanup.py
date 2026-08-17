from pathlib import Path

p = Path('js/founder-admin.js')
s = p.read_text()
old = '''  return snapshot.docs\n    .map((entry) => ({ uid: entry.id, ...entry.data() }))\n    .sort((a, b) => String(a.directorNumber ?? "").localeCompare(String(b.directorNumber ?? "")));'''
new = '''  return snapshot.docs\n    .map((entry) => ({ uid: entry.id, ...entry.data() }))\n    .filter((entry) => entry.duplicateRetired !== true)\n    .sort((a, b) => String(a.directorNumber ?? "").localeCompare(String(b.directorNumber ?? "")));'''
if old not in s:
    raise SystemExit('listDirectorAccounts anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('js/app.js')
s = p.read_text()
old = '''    const record = await loadLoginRecord(loginKey);\n    if (!record?.authEmail) throw new Error("The portal could not continue with that Board identity.");\n    pendingLogin = { fullName, loginKey, ...record };'''
new = '''    const record = await loadLoginRecord(loginKey);\n    if (!record?.authEmail) throw new Error("The portal could not continue with that Board identity.");\n    if (record.disabled === true) throw new Error("This Board account has been retired. Contact the Founder Director if a replacement account is needed.");\n    pendingLogin = { fullName, loginKey, ...record };'''
if old not in s:
    raise SystemExit('lookupName anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
