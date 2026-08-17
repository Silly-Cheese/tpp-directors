from pathlib import Path

RELEASE_OLD = "20260817-stable4"
RELEASE_NEW = "20260817-stable5"

# ---- meeting-data.js: accept both Phase 5 legacy field names and canonical schema ----
p = Path("js/meeting-data.js")
s = p.read_text()
old = '''  const meetingType = VALID_TYPES.has(input.meetingType) ? input.meetingType : "regular";\n  const scheduledFor = String(input.scheduledFor || "").trim();\n  if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) throw new Error("Choose a valid meeting date and time.");'''
new = '''  const requestedMeetingType = input.meetingType ?? input.type;\n  const meetingType = VALID_TYPES.has(requestedMeetingType) ? requestedMeetingType : "regular";\n  const scheduledFor = String(input.scheduledFor ?? input.scheduledStart ?? "").trim();\n  if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) throw new Error("Choose a valid meeting date and time.");'''
if old not in s:
    raise SystemExit("meeting-data input contract anchor missing")
s = s.replace(old, new, 1)

old = '''  const directoryByUid = new Map(directoryEntries.map((entry) => [entry.uid, entry]));'''
new = '''  const effectiveDirectory = Array.isArray(directoryEntries) && directoryEntries.length\n    ? directoryEntries\n    : (Array.isArray(input.directory) ? input.directory : []);\n  const directoryByUid = new Map(effectiveDirectory.map((entry) => [entry.uid, entry]));'''
if old not in s:
    raise SystemExit("meeting-data directory anchor missing")
s = s.replace(old, new, 1)

old = '''    meetingType,\n    scheduledFor,\n    locationMode: ["in_person", "virtual", "hybrid"].includes(input.locationMode) ? input.locationMode : "in_person",\n    locationLabel: String(input.locationLabel || "").trim() || null,'''
new = '''    meetingType,\n    scheduledFor,\n    locationMode: ["in_person", "virtual", "hybrid"].includes(input.locationMode ?? input.mode) ? (input.locationMode ?? input.mode) : "in_person",\n    locationLabel: String(input.locationLabel ?? input.location ?? "").trim() || null,\n    notes: String(input.notes || "").trim() || null,'''
if old not in s:
    raise SystemExit("meeting-data persisted fields anchor missing")
s = s.replace(old, new, 1)
p.write_text(s)

# ---- phase5.js: normalize old/new records and send canonical create payload ----
p = Path("js/phase5.js")
s = p.read_text()
anchor = '''function humanize(value = "") {\n  return String(value || "—").replaceAll("_", " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase());\n}\n'''
insert = '''function humanize(value = "") {\n  return String(value || "—").replaceAll("_", " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase());\n}\n\nfunction normalizeMeetingRecord(record = {}) {\n  const eligible = Array.isArray(record.eligibleVotingDirectorUids)\n    ? record.eligibleVotingDirectorUids\n    : (Array.isArray(record.votingEligibleUids) ? record.votingEligibleUids : []);\n  return {\n    ...record,\n    meetingType: record.meetingType || record.type || "regular",\n    type: record.type || record.meetingType || "regular",\n    scheduledFor: record.scheduledFor || record.scheduledStart || null,\n    scheduledStart: record.scheduledStart || record.scheduledFor || null,\n    locationMode: record.locationMode || record.mode || "in_person",\n    mode: record.mode || record.locationMode || "in_person",\n    locationLabel: record.locationLabel ?? record.location ?? null,\n    location: record.location ?? record.locationLabel ?? null,\n    eligibleVotingDirectorUids: eligible,\n    votingEligibleUids: Array.isArray(record.votingEligibleUids) ? record.votingEligibleUids : eligible\n  };\n}\n\nfunction normalizeAttendanceRecord(record = {}) {\n  const presence = record.presenceStatus || record.status || "invited";\n  return { ...record, presenceStatus: presence, status: presence };\n}\n'''
if anchor not in s:
    raise SystemExit("phase5 helper anchor missing")
s = s.replace(anchor, insert, 1)

old = '''    selectedAttendance = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))\n      .sort((a, b) => String(a.directorName || "").localeCompare(String(b.directorName || "")));'''
new = '''    selectedAttendance = snapshot.docs.map((entry) => normalizeAttendanceRecord({ id: entry.id, ...entry.data() }))\n      .sort((a, b) => String(a.directorName || "").localeCompare(String(b.directorName || "")));'''
if old not in s:
    raise SystemExit("phase5 attendance normalization anchor missing")
s = s.replace(old, new, 1)

old = '''    meetings = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))\n      .sort((a, b) => timestampValue(b.scheduledStart) - timestampValue(a.scheduledStart));'''
new = '''    meetings = snapshot.docs.map((entry) => normalizeMeetingRecord({ id: entry.id, ...entry.data() }))\n      .sort((a, b) => timestampValue(b.scheduledStart) - timestampValue(a.scheduledStart));'''
if old not in s:
    raise SystemExit("phase5 meeting normalization anchor missing")
s = s.replace(old, new, 1)

old = '''    const created = await createBoardMeeting({\n      title: data.get("title"),\n      type: data.get("type"),\n      scheduledStart: data.get("scheduledStart"),\n      mode: data.get("mode"),\n      location: data.get("location"),\n      quorumRequired: data.get("quorumRequired"),\n      notes: data.get("notes"),\n      invitedDirectorUids,\n      directory\n    }, currentProfile);'''
new = '''    const created = await createBoardMeeting({\n      title: data.get("title"),\n      meetingType: data.get("type"),\n      scheduledFor: data.get("scheduledStart"),\n      locationMode: data.get("mode"),\n      locationLabel: data.get("location"),\n      quorumRequired: data.get("quorumRequired"),\n      notes: data.get("notes"),\n      invitedDirectorUids\n    }, currentProfile, directory);'''
if old not in s:
    raise SystemExit("phase5 create payload anchor missing")
s = s.replace(old, new, 1)
p.write_text(s)

# ---- authoritative contrast layer: eliminate surviving light-theme islands ----
p = Path("portal-theme-v3.css")
s = p.read_text()
marker = "/* ===== Stable5: eliminate all surviving light-theme islands ===== */"
if marker not in s:
    s += '''\n\n/* ===== Stable5: eliminate all surviving light-theme islands ===== */\n.empty-state,.phase5-empty,.phase6-empty,.phase8-empty,.phase9-empty,.phase10-empty,\n.phase10-status>div,.phase10-check,.phase10-item,.phase10-list a,.phase10-list button,\n.phase10-gate,.phase10-gate.ready,.phase10-gate.blocked,\n.meeting-self-checkin,.activation-result,.recovery-result,.policy-box,.review-note-box{\n  background:#11100e!important;\n  color:var(--text)!important;\n  border-color:#4a3b2c!important;\n}\n.empty-state,.empty-state *,.phase5-empty,.phase5-empty *,.phase6-empty,.phase6-empty *,\n.phase8-empty,.phase8-empty *,.phase9-empty,.phase9-empty *,.phase10-empty,.phase10-empty *,\n.phase10-status>div *,.phase10-check *,.phase10-item *,.phase10-list a *,.phase10-list button *,\n.phase10-gate *,.meeting-self-checkin *{\n  color:var(--text2)!important;\n  -webkit-text-fill-color:currentColor!important;\n  opacity:1!important;\n}\n.phase10-status>div strong,.phase10-check strong,.phase10-gate strong,.meeting-self-checkin strong{color:var(--text)!important}\n.phase10-status>div span,.phase10-status>div small,.phase10-check span,.phase10-item span{color:var(--text3)!important}\n.phase10-gate.ready{border-color:#315c3a!important;background:#0d1a10!important}\n.phase10-gate.ready,.phase10-gate.ready *{color:#c8f7d1!important}\n.phase10-gate.blocked{border-color:#7b5930!important;background:#1c140b!important}\n.phase10-gate.blocked,.phase10-gate.blocked *{color:#ffe0a8!important}\n.phase10-badge.draft,.phase10-badge.ready_for_launch,.phase10-badge.launched,.count-badge,.status-pill{\n  background:#211a14!important;color:var(--accent2)!important;border:1px solid var(--border)!important;\n}\n.phase10-tabs button{background:#0d0c0a!important;color:var(--text2)!important;border:1px solid #3b3024!important}\n.phase10-tabs button.active{background:#172238!important;color:#fff!important;border-color:#243653!important}\n\n/* Light browser autofill must not reintroduce white fields. */\ninput:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,textarea:-webkit-autofill,select:-webkit-autofill{\n  -webkit-box-shadow:0 0 0 1000px var(--field) inset!important;\n  -webkit-text-fill-color:var(--text)!important;\n  caret-color:var(--accent2)!important;\n}\n'''
p.write_text(s)

# ---- cache-bust the complete critical release ----
for filename in ["index.html", "js/boot-stable.js"]:
    p = Path(filename)
    s = p.read_text().replace(RELEASE_OLD, RELEASE_NEW)
    p.write_text(s)
