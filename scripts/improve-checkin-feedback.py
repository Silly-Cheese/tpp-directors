from pathlib import Path

p = Path('js/phase5.js')
s = p.read_text()
old = '''    </dl>\n    ${invited ? `<div class="meeting-self-checkin"><div><strong>${ownAttendance?.status === "present" ? "You are checked in." : locked ? "This meeting is closed." : meeting.status === "scheduled" ? "Check-in is closed." : "Your roster status is " + humanize(ownAttendance?.status || "invited") + "."}</strong><span>${ownAttendance?.status === "present" ? "Your presence is included in the live quorum calculation." : "Your roster status is " + humanize(ownAttendance?.status || "invited") + "."}</span></div>${mayCheckIn ? '<button class="meeting-primary-button" data-meeting-action="self-checkin">Check In</button>' : ""}</div>` : ""}\n    ${controls.length ? `<div class="meeting-actions">${controls.join("")}</div>` : ""}\n    <div class="panel-heading"><div><p class="eyebrow">LIVE ATTENDANCE</p><h2>Director roster</h2></div><span class="count-badge">${selectedAttendance.length}</span></div>'''
new = '''    </dl>\n    <p id="phase5-action-message" class="meeting-form-message phase5-action-message" role="status"></p>\n    ${invited ? `<div class="meeting-self-checkin"><div><strong>${ownAttendance?.status === "present" ? "You are checked in." : locked ? "This meeting is closed." : meeting.status === "scheduled" ? "Check-in is closed." : "Your roster status is " + humanize(ownAttendance?.status || "invited") + "."}</strong><span>${ownAttendance?.status === "present" ? "Your presence is included in the live quorum calculation." : "Your roster status is " + humanize(ownAttendance?.status || "invited") + "."}</span></div>${mayCheckIn ? '<button class="meeting-primary-button" data-meeting-action="self-checkin">Check In</button>' : ""}</div>` : ""}\n    ${controls.length ? `<div class="meeting-actions">${controls.join("")}</div>` : ""}\n    <div class="panel-heading"><div><p class="eyebrow">LIVE ATTENDANCE</p><h2>Director roster</h2></div><span class="count-badge">${selectedAttendance.length}</span></div>'''
if old not in s: raise SystemExit('meeting detail anchor not found')
s = s.replace(old, new, 1)
s = s.replace('    <p id="phase5-action-message" class="meeting-form-message" role="status"></p>\n    <section id="phase6-meeting-workspace"', '    <section id="phase6-meeting-workspace"', 1)
old2 = '''async function handleMeetingAction(action) {\n  const meeting = selectedMeeting();\n  if (!meeting) return;\n  const message = $("#phase5-action-message");\n  setMessage(message, "");\n  try {'''
new2 = '''async function handleMeetingAction(action, sourceButton = null) {\n  const meeting = selectedMeeting();\n  if (!meeting) return;\n  const message = $("#phase5-action-message");\n  setMessage(message, action === "self-checkin" ? "Recording your check-in…" : "Updating meeting…");\n  const originalText = sourceButton?.textContent || "";\n  if (sourceButton) { sourceButton.disabled = true; if (action === "self-checkin") sourceButton.textContent = "Checking in…"; }\n  try {'''
if old2 not in s: raise SystemExit('action handler anchor not found')
s = s.replace(old2, new2, 1)
old3 = '''    if (action === "cancel") await cancelMeeting(meeting.id, currentProfile);\n    if (action === "self-checkin") await checkIntoMeeting(meeting.id, currentProfile);\n  } catch (error) {\n    console.error(error);\n    setMessage(message, error.message || "The meeting action could not be completed.");\n  }\n}'''
new3 = '''    if (action === "cancel") await cancelMeeting(meeting.id, currentProfile);\n    if (action === "self-checkin") await checkIntoMeeting(meeting.id, currentProfile);\n    setMessage(message, action === "self-checkin" ? "Check-in recorded." : "Meeting updated.");\n  } catch (error) {\n    console.error(error);\n    const detail = error?.code === "permission-denied"\n      ? "Check-in was blocked by the currently deployed Firestore rules. Deploy the latest firestore.rules and try again."\n      : (error.message || "The meeting action could not be completed.");\n    setMessage(message, detail);\n  } finally {\n    if (sourceButton?.isConnected) { sourceButton.disabled = false; sourceButton.textContent = originalText; }\n  }\n}'''
if old3 not in s: raise SystemExit('action handler tail not found')
s = s.replace(old3, new3, 1)
s = s.replace('if (button) handleMeetingAction(button.dataset.meetingAction);', 'if (button) handleMeetingAction(button.dataset.meetingAction, button);', 1)
p.write_text(s)

# bump critical release so this UX fix is guaranteed fresh
boot = Path('js/boot-stable.js')
b = boot.read_text().replace('20260817-stable6', '20260817-stable7')
boot.write_text(b)
idx = Path('index.html')
i = idx.read_text().replace('20260817-stable6', '20260817-stable7')
idx.write_text(i)

assert 'Checking in…' in p.read_text()
assert 'currently deployed Firestore rules' in p.read_text()
assert '20260817-stable7' in boot.read_text()
print('stable7 check-in feedback applied')
