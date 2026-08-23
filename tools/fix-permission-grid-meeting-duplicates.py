from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing anchor for {label} in {path}")
    p.write_text(text.replace(old, new, 1))

# 1) Remove obsolete motion-second permission everywhere in the permission model.
p = Path('js/permissions.js')
text = p.read_text()
text = text.replace('  MOTIONS_SECOND: "motions.second",\n', '')
text = text.replace('      PERMISSIONS.MOTIONS_SECOND,\n', '')
p.write_text(text)

# 2) Remove legacy seconding rule path while preserving old pending_second motions as vote-ready.
p = Path('firestore.rules')
text = p.read_text()
start = text.find('    function secondMotion() {')
if start != -1:
    end = text.find('    function startVote(id) {', start)
    if end == -1:
        raise SystemExit('Could not locate end of secondMotion rule block')
    text = text[:start] + text[end:]
text = text.replace('allow update: if secondMotion() || startVote(id) || finishVote(id);', 'allow update: if startVote(id) || finishVote(id);')
p.write_text(text)

# 3) Add a shared submit lock + deterministic creation key to Phase 5.
replace_once(
    'js/phase5.js',
    'async function handleCreateMeeting(event) {\n  event.preventDefault();\n  const form = event.currentTarget;\n  const message = $("#phase5-create-message");\n  const data = new FormData(form);\n  const invitedDirectorUids = data.getAll("invitedDirector");\n  setMessage(message, "Creating meeting…");\n  try {\n    const created = await createBoardMeeting({',
    '''async function handleCreateMeeting(event) {\n  event.preventDefault();\n  const form = event.currentTarget;\n  // DOM-level lock is shared even if this module is accidentally evaluated twice.\n  if (form.dataset.submitting === "true") return;\n  form.dataset.submitting = "true";\n  const submitButton = form.querySelector('button[type="submit"]');\n  const originalButtonText = submitButton?.textContent || "Create Board Meeting";\n  if (submitButton) {\n    submitButton.disabled = true;\n    submitButton.textContent = "Creating…";\n  }\n  const message = $("#phase5-create-message");\n  const data = new FormData(form);\n  const invitedDirectorUids = data.getAll("invitedDirector");\n  const creationKey = form.dataset.creationKey || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replaceAll("-", "");\n  form.dataset.creationKey = creationKey;\n  setMessage(message, "Creating meeting…");\n  try {\n    const created = await createBoardMeeting({\n      creationKey,''',
    'Phase 5 submit lock'
)
replace_once(
    'js/phase5.js',
    '    form.reset();\n    renderInviteGrid();\n    $("#phase5-create-panel").hidden = true;\n    selectedMeetingId = created.id;\n    subscribeAttendance(created.id);\n  } catch (error) {\n    console.error(error);\n    setMessage(message, error.message || "The meeting could not be created.");\n  }\n}',
    '''    form.reset();\n    delete form.dataset.creationKey;\n    renderInviteGrid();\n    $("#phase5-create-panel").hidden = true;\n    selectedMeetingId = created.id;\n    subscribeAttendance(created.id);\n  } catch (error) {\n    console.error(error);\n    setMessage(message, error.message || "The meeting could not be created.");\n  } finally {\n    delete form.dataset.submitting;\n    if (submitButton?.isConnected) {\n      submitButton.disabled = false;\n      submitButton.textContent = originalButtonText;\n    }\n  }\n}''',
    'Phase 5 submit unlock'
)

# 4) Data-layer idempotency: identical submission key = identical meeting document ID.
replace_once(
    'js/meeting-data.js',
    '  const meetingRef = doc(collection(db, "meetings"));\n  const actorUid = auth.currentUser.uid;',
    '''  const rawCreationKey = String(input.creationKey || "").trim();\n  const creationKey = /^[A-Za-z0-9_-]{12,96}$/.test(rawCreationKey) ? rawCreationKey : null;\n  const meetingRef = creationKey\n    ? doc(db, "meetings", `create_${creationKey}`)\n    : doc(collection(db, "meetings"));\n  const actorUid = auth.currentUser.uid;''',
    'meeting creation idempotency'
)
replace_once(
    'js/meeting-data.js',
    '    meetingNumber: meetingNumberFromId(meetingRef.id),\n    title,',
    '    meetingNumber: meetingNumberFromId(meetingRef.id),\n    creationKey: creationKey || null,\n    title,',
    'meeting creation key field'
)

# 5) Strong dark/high-contrast permissions UI in the authoritative final theme.
p = Path('portal-theme-v3.css')
text = p.read_text()
marker = '/* ===== Stable8: Founder permission editor ===== */'
if marker not in text:
    text += r'''

/* ===== Stable8: Founder permission editor ===== */
#manage-director-panel .permission-fieldset{
  background:#090806!important;
  border:1px solid #6d5940!important;
  border-radius:16px!important;
  padding:18px!important;
}
#manage-director-panel .permission-fieldset>legend{
  color:#ffe9c5!important;
  -webkit-text-fill-color:#ffe9c5!important;
  font-weight:900!important;
  letter-spacing:.02em!important;
  padding:0 8px!important;
}
#permission-checkboxes.permission-grid{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:10px!important;
  margin-top:8px!important;
}
#permission-checkboxes .permission-option{
  min-width:0!important;
  min-height:48px!important;
  display:flex!important;
  align-items:center!important;
  gap:10px!important;
  padding:12px 14px!important;
  border-radius:12px!important;
  border:1px solid #5d4b36!important;
  background:#0e0c09!important;
  color:#fffdf8!important;
  -webkit-text-fill-color:#fffdf8!important;
  cursor:pointer!important;
  transition:background .15s ease,border-color .15s ease,transform .15s ease!important;
}
#permission-checkboxes .permission-option:hover{
  background:#18130e!important;
  border-color:#9a7e59!important;
}
#permission-checkboxes .permission-option:has(input:checked){
  background:#241b12!important;
  border-color:#e8cfa8!important;
  box-shadow:inset 0 0 0 1px rgba(255,233,197,.16)!important;
}
#permission-checkboxes .permission-option input[type="checkbox"]{
  width:18px!important;
  height:18px!important;
  min-width:18px!important;
  flex:0 0 18px!important;
  margin:0!important;
  accent-color:#e8cfa8!important;
}
#permission-checkboxes .permission-option span{
  color:#fffdf8!important;
  -webkit-text-fill-color:#fffdf8!important;
  opacity:1!important;
  font-size:.9rem!important;
  font-weight:800!important;
  line-height:1.25!important;
  overflow-wrap:anywhere!important;
}
#permission-checkboxes .permission-option:has(input:checked) span{color:#ffe9c5!important;-webkit-text-fill-color:#ffe9c5!important}
@media(max-width:1050px){#permission-checkboxes.permission-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:680px){#permission-checkboxes.permission-grid{grid-template-columns:1fr!important}}
'''
p.write_text(text)

# 6) Bump the release so browser caches cannot mix the old form/permissions code.
for path in ['index.html', 'js/boot-stable.js']:
    p = Path(path)
    text = p.read_text().replace('20260817-stable7', '20260822-stable8')
    p.write_text(text)

# Make Phase 5/6 data imports use this release too.
for path in ['js/phase5.js', 'js/phase6.js']:
    p = Path(path)
    text = p.read_text().replace('20260817-stable6', '20260822-stable8')
    p.write_text(text)

# Assertions.
perm = Path('js/permissions.js').read_text()
phase5 = Path('js/phase5.js').read_text()
meeting = Path('js/meeting-data.js').read_text()
app = Path('js/app.js').read_text()
css = Path('portal-theme-v3.css').read_text()
boot = Path('js/boot-stable.js').read_text()
assert 'MOTIONS_SECOND' not in perm
assert 'motions.second' not in perm
assert 'form.dataset.submitting === "true"' in phase5
assert 'creationKey,' in phase5
assert 'doc(db, "meetings", `create_${creationKey}`)' in meeting
assert marker in css
assert '20260822-stable8' in boot
print('Permission grid + meeting idempotency repair ready.')
