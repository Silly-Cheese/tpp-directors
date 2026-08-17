from pathlib import Path

# Patch founder-admin.js
p = Path('js/founder-admin.js')
s = p.read_text()

old_dup = '''  const loginRef = doc(db, "loginDirectory", loginKey);\n  const existingLogin = await getDoc(loginRef);\n  if (existingLogin.exists()) {\n    throw new Error("A Board account already uses that full name. Exact duplicate names require a separate identity workflow.");\n  }\n'''
new_dup = '''  const loginRef = doc(db, "loginDirectory", loginKey);\n  const existingLogin = await getDoc(loginRef);\n  if (existingLogin.exists()) {\n    const existingUid = existingLogin.data()?.directorUid || null;\n    const existingDirector = existingUid ? await getDoc(doc(db, "directors", existingUid)) : null;\n    const reusable = existingLogin.data()?.disabled === true\n      || (existingDirector?.exists() && ["archived", "former_director"].includes(existingDirector.data()?.accountStatus));\n    if (!reusable) {\n      throw new Error("A Board account already uses that full name. Open that existing account in Founder Control instead of creating a duplicate.");\n    }\n  }\n'''
if old_dup not in s:
    raise SystemExit('duplicate check anchor not found')
s = s.replace(old_dup, new_dup, 1)

old_refs = '''    const counterRef = doc(db, "system", "counters");\n    const auditRef = doc(collection(db, "auditEvents"));\n    const actorUid = auth.currentUser.uid;\n'''
new_refs = '''    const counterRef = doc(db, "system", "counters");\n    const activationVaultRef = doc(db, "activationVault", createdUser.uid);\n    const auditRef = doc(collection(db, "auditEvents"));\n    const actorUid = auth.currentUser.uid;\n'''
if old_refs not in s:
    raise SystemExit('account refs anchor not found')
s = s.replace(old_refs, new_refs, 1)

old_login_set = '''      transaction.set(loginRef, {\n        directorUid: createdUser.uid,\n        authEmail,\n        activationRequired: true,\n        createdAt: serverTimestamp(),\n        updatedAt: serverTimestamp()\n      });\n\n      transaction.set(counterRef, {'''
new_login_set = '''      transaction.set(loginRef, {\n        directorUid: createdUser.uid,\n        authEmail,\n        activationRequired: true,\n        disabled: false,\n        createdAt: serverTimestamp(),\n        updatedAt: serverTimestamp()\n      });\n\n      transaction.set(activationVaultRef, {\n        directorUid: createdUser.uid,\n        directorNumber,\n        fullName,\n        loginKey,\n        authEmail,\n        activationCode,\n        purpose: "initial_activation",\n        status: "available",\n        createdAt: serverTimestamp(),\n        createdBy: actorUid,\n        updatedAt: serverTimestamp(),\n        updatedBy: actorUid\n      });\n\n      transaction.set(counterRef, {'''
if old_login_set not in s:
    raise SystemExit('login set anchor not found')
s = s.replace(old_login_set, new_login_set, 1)

old_reset_refs = '''  const login = loginSnapshot.data();\n  const auditRef = doc(collection(db, "auditEvents"));\n  const batch = writeBatch(db);\n'''
new_reset_refs = '''  const login = loginSnapshot.data();\n  const activationVaultRef = doc(db, "activationVault", uid);\n  const auditRef = doc(collection(db, "auditEvents"));\n  const batch = writeBatch(db);\n'''
if old_reset_refs not in s:
    raise SystemExit('reset refs anchor not found')
s = s.replace(old_reset_refs, new_reset_refs, 1)

old_reset_audit = '''  batch.set(auditRef, {\n    category: "account",\n    action: "director.pin_reset.prepared",'''
new_reset_audit = '''  batch.set(activationVaultRef, {\n    directorUid: uid,\n    directorNumber: director.directorNumber || null,\n    fullName: director.fullName || "Director",\n    loginKey: director.loginKey,\n    authEmail: login.authEmail,\n    activationCode,\n    temporaryAuthPassword,\n    purpose: "pin_reset",\n    status: "available",\n    createdAt: serverTimestamp(),\n    createdBy: auth.currentUser.uid,\n    updatedAt: serverTimestamp(),\n    updatedBy: auth.currentUser.uid\n  }, { merge: true });\n  batch.set(auditRef, {\n    category: "account",\n    action: "director.pin_reset.prepared",'''
if old_reset_audit not in s:
    raise SystemExit('reset audit anchor not found')
s = s.replace(old_reset_audit, new_reset_audit, 1)

p.write_text(s)

# Patch Firestore rules with founder-only activation vault.
r = Path('firestore.rules')
t = r.read_text()
anchor = '''    match /system/{id} {\n      allow read, update: if founder();\n      allow create: if founder() || founderBootstrapCounter(id);\n      allow delete: if false;\n    }\n'''
replacement = '''    match /activationVault/{id} {\n      allow get, list, create, update: if founder();\n      allow delete: if false;\n    }\n\n    match /system/{id} {\n      allow read, update: if founder();\n      allow create: if founder() || founderBootstrapCounter(id);\n      allow delete: if false;\n    }\n'''
if anchor not in t:
    raise SystemExit('system rules anchor not found')
t = t.replace(anchor, replacement, 1)
r.write_text(t)
