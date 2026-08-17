from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Missing expected block in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    p.write_text(text)

# meeting-data: legacy attendance compatibility + quorum compatibility
replace_once('js/meeting-data.js',
'''export function calculateQuorum(meeting, attendance = []) {\n  const presentEligible = attendance.filter((entry) => entry.votingEligible === true && entry.presenceStatus === "present").length;''',
'''export function calculateQuorum(meeting, attendance = []) {\n  const presentEligible = attendance.filter((entry) => entry.votingEligible === true && (entry.presenceStatus || entry.status) === "present").length;''')
replace_once('js/meeting-data.js',
'''  const meeting = meetingSnapshot.data();\n  const attendance = attendanceSnapshot.data();\n  if (!["checkin_open", "in_session", "recessed"].includes(meeting.status)) throw new Error("Check-in is not currently open for this meeting.");\n  if (attendance.presenceStatus === "present") return;\n  if (["excused", "absent"].includes(attendance.presenceStatus)) throw new Error("Your attendance status must be changed by an authorized meeting administrator before you can check in.");''',
'''  const meeting = meetingSnapshot.data();\n  const attendance = attendanceSnapshot.data();\n  const currentPresence = attendance.presenceStatus || attendance.status || "invited";\n  if (!["checkin_open", "in_session", "recessed"].includes(meeting.status)) throw new Error("Check-in is not currently open for this meeting.");\n  if (currentPresence === "present") return;\n  if (["excused", "absent"].includes(currentPresence)) throw new Error("Your attendance status must be changed by an authorized meeting administrator before you can check in.");''')

# Phase 5: force fresh meeting-data module
replace_once('js/phase5.js', '} from "./meeting-data.js";', '} from "./meeting-data.js?v=20260817-stable6";')

# governance-data: force fresh meeting-data and remove second requirement from new motions/votes
replace_once('js/governance-data.js', 'import { calculateQuorum } from "./meeting-data.js";', 'import { calculateQuorum } from "./meeting-data.js?v=20260817-stable6";')
replace_once('js/governance-data.js', 'attendanceSnapshot.data().presenceStatus !== "present"', '(attendanceSnapshot.data().presenceStatus || attendanceSnapshot.data().status) !== "present"')
replace_once('js/governance-data.js', 'freshAttendance.data().presenceStatus !== "present"', '(freshAttendance.data().presenceStatus || freshAttendance.data().status) !== "present"')
replace_once('js/governance-data.js', 'status: "pending_second", movedByUid: auth.currentUser.uid,', 'status: "ready", movedByUid: auth.currentUser.uid,')
replace_once('js/governance-data.js', 'if (motion.status !== "ready") throw new Error("The motion must have a second before voting opens.");', 'if (!["ready", "pending_second"].includes(motion.status)) throw new Error("This motion is not ready for voting.");')
replace_once('js/governance-data.js', 'const presentEligible = attendance.filter((entry) => entry.votingEligible === true && entry.presenceStatus === "present");', 'const presentEligible = attendance.filter((entry) => entry.votingEligible === true && (entry.presenceStatus || entry.status) === "present");')
replace_once('js/governance-data.js', 'if (!freshMotionSnapshot.exists() || freshMotionSnapshot.data().status !== "ready") throw new Error("This motion is no longer ready for voting.");', 'if (!freshMotionSnapshot.exists() || !["ready", "pending_second"].includes(freshMotionSnapshot.data().status)) throw new Error("This motion is no longer ready for voting.");')
# castVote has two attendance checks; make both legacy-safe
text = Path('js/governance-data.js').read_text()
text = text.replace('attendanceSnapshot.data().presenceStatus !== "present"', '(attendanceSnapshot.data().presenceStatus || attendanceSnapshot.data().status) !== "present"')
text = text.replace('freshAttendance.data().presenceStatus !== "present"', '(freshAttendance.data().presenceStatus || freshAttendance.data().status) !== "present"')
Path('js/governance-data.js').write_text(text)

# Phase 6: fresh data modules, no second UI, legacy attendance normalization
replace_once('js/phase6.js', 'import { calculateQuorum } from "./meeting-data.js";', 'import { calculateQuorum } from "./meeting-data.js?v=20260817-stable6";')
replace_once('js/phase6.js', '  secondMotion,\n', '')
replace_once('js/phase6.js', '} from "./governance-data.js";', '} from "./governance-data.js?v=20260817-stable6";')
old_render = '''function renderMotion(motion) {\n  const vote = voteForMotion(motion.id);\n  const canSecond = meeting?.status === "in_session"\n    && motion.status === "pending_second"\n    && motion.movedByUid !== auth.currentUser?.uid\n    && currentAttendance()?.presenceStatus === "present"\n    && currentAttendance()?.votingEligible === true\n    && hasPermission(currentProfile, PERMISSIONS.MOTIONS_SECOND);\n  const canPush = meeting?.status === "in_session"\n    && motion.status === "ready"\n    && hasPermission(currentProfile, PERMISSIONS.VOTES_PUSH)\n    && !currentOpenVote();\n\n  return `\n    <div class="phase6-motion ${escapeHtml(motion.status)}">\n      <div class="phase6-motion-head"><div><span>${escapeHtml(motion.motionNumber || "MOTION")}</span><strong>${escapeHtml(motion.motionText)}</strong></div><em>${escapeHtml(statusLabel(motion.status))}</em></div>\n      <div class="phase6-motion-by"><span>Moved by ${escapeHtml(motion.movedByName || "Director")}</span><span>${motion.secondedByName ? `Seconded by ${escapeHtml(motion.secondedByName)}` : "Awaiting second"}</span></div>\n      <div class="phase6-inline-actions">\n        ${canSecond ? `<button class="meeting-secondary-button" data-phase6-second-motion="${motion.id}">Second Motion</button>` : ""}\n        ${canPush ? `<button class="meeting-primary-button" data-phase6-setup-vote="${motion.id}">Push Vote</button>` : ""}\n      </div>'''
new_render = '''function renderMotion(motion) {\n  const vote = voteForMotion(motion.id);\n  const effectiveStatus = motion.status === "pending_second" ? "ready" : motion.status;\n  const canPush = meeting?.status === "in_session"\n    && ["ready", "pending_second"].includes(motion.status)\n    && hasPermission(currentProfile, PERMISSIONS.VOTES_PUSH)\n    && !currentOpenVote();\n\n  return `\n    <div class="phase6-motion ${escapeHtml(effectiveStatus)}">\n      <div class="phase6-motion-head"><div><span>${escapeHtml(motion.motionNumber || "MOTION")}</span><strong>${escapeHtml(motion.motionText)}</strong></div><em>${escapeHtml(statusLabel(effectiveStatus))}</em></div>\n      <div class="phase6-motion-by"><span>Moved by ${escapeHtml(motion.movedByName || "Director")}</span><span>${motion.secondedByName ? `Seconded by ${escapeHtml(motion.secondedByName)}` : "Second not required"}</span></div>\n      <div class="phase6-inline-actions">\n        ${canPush ? `<button class="meeting-primary-button" data-phase6-setup-vote="${motion.id}">Push Vote</button>` : ""}\n      </div>'''
replace_once('js/phase6.js', old_render, new_render)
replace_once('js/phase6.js', '<div><dt>Seconded by</dt><dd>${escapeHtml(selected.secondedByName || "—")}</dd></div>', '<div><dt>Second</dt><dd>${escapeHtml(selected.secondedByName || "Not required")}</dd></div>')
second_handler = '''    const secondId = event.target.closest("[data-phase6-second-motion]")?.dataset.phase6SecondMotion;\n    if (secondId) {\n      try { await secondMotion(secondId, currentProfile); } catch (error) { $("#phase6-global-message").textContent = error.message; }\n      return;\n    }\n\n'''
replace_once('js/phase6.js', second_handler, '')
replace_once('js/phase6.js', 'attendance = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));', 'attendance = snapshot.docs.map((entry) => { const record = { id: entry.id, ...entry.data() }; return { ...record, presenceStatus: record.presenceStatus || record.status || "invited" }; });')

# Firestore rules: legacy attendance check-in + no-second motion lifecycle
replace_once('firestore.rules',
'''    function presentVoter(meetingId, uid) {\n      return exists(aPath(meetingId, uid))\n        && get(aPath(meetingId, uid)).data.presenceStatus == 'present'\n        && get(aPath(meetingId, uid)).data.votingEligible == true;\n    }''',
'''    function presentVoter(meetingId, uid) {\n      return exists(aPath(meetingId, uid))\n        && (\n          (('presenceStatus' in get(aPath(meetingId, uid)).data) && get(aPath(meetingId, uid)).data.presenceStatus == 'present')\n          || (!('presenceStatus' in get(aPath(meetingId, uid)).data) && ('status' in get(aPath(meetingId, uid)).data) && get(aPath(meetingId, uid)).data.status == 'present')\n        )\n        && get(aPath(meetingId, uid)).data.votingEligible == true;\n    }''')
replace_once('firestore.rules',
"        && resource.data.presenceStatus in ['invited','departed'] && request.resource.data.presenceStatus == 'present'",
"        && (((('presenceStatus' in resource.data) && resource.data.presenceStatus in ['invited','departed'])) || ((!('presenceStatus' in resource.data)) && ('status' in resource.data) && resource.data.status in ['invited','departed']))) && request.resource.data.presenceStatus == 'present'")
replace_once('firestore.rules', "&& request.resource.data.status == 'pending_second' && request.resource.data.movedByUid == request.auth.uid", "&& request.resource.data.status == 'ready' && request.resource.data.movedByUid == request.auth.uid")
replace_once('firestore.rules', "return cap('votes.push') && resource.data.status == 'ready' && meeting(resource.data.meetingId).status == 'in_session'", "return cap('votes.push') && resource.data.status in ['ready','pending_second'] && meeting(resource.data.meetingId).status == 'in_session'")

# Stable6 cache version everywhere critical
replace_once('js/boot-stable.js', 'const RELEASE = "20260817-stable5";', 'const RELEASE = "20260817-stable6";')
text = Path('index.html').read_text().replace('20260817-stable5', '20260817-stable6')
Path('index.html').write_text(text)

# Verification assertions
assert 'status: "ready", movedByUid' in Path('js/governance-data.js').read_text()
assert 'motion must have a second' not in Path('js/governance-data.js').read_text()
assert 'data-phase6-second-motion' not in Path('js/phase6.js').read_text()
assert 'Awaiting second' not in Path('js/phase6.js').read_text()
assert 'Second not required' in Path('js/phase6.js').read_text()
assert "resource.data.status in ['ready','pending_second']" in Path('firestore.rules').read_text()
assert '20260817-stable6' in Path('js/boot-stable.js').read_text()
print('stable6 check-in/no-second patch applied')
