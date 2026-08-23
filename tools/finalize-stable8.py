from pathlib import Path

p = Path('js/meeting-data.js')
text = p.read_text()
old = '    meetingNumber: meetingNumberFromId(meetingRef.id),\n    creationKey: creationKey || null,'
new = '    meetingNumber: meetingNumberFromId(creationKey || meetingRef.id),\n    creationKey: creationKey || null,'
if old not in text:
    raise SystemExit('Meeting number anchor not found')
p.write_text(text.replace(old, new, 1))

meeting = p.read_text()
assert 'meetingNumberFromId(creationKey || meetingRef.id)' in meeting
assert 'doc(db, "meetings", `create_${creationKey}`)' in meeting
print('Stable8 meeting number/idempotency finalization ready.')
