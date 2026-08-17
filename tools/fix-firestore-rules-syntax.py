from pathlib import Path

path = Path('firestore.rules')
text = path.read_text()

old_present = """    function presentVoter(meetingId, uid) {\n      return exists(aPath(meetingId, uid))\n        && (\n          (('presenceStatus' in get(aPath(meetingId, uid)).data) && get(aPath(meetingId, uid)).data.presenceStatus == 'present')\n          || (!('presenceStatus' in get(aPath(meetingId, uid)).data) && ('status' in get(aPath(meetingId, uid)).data) && get(aPath(meetingId, uid)).data.status == 'present')\n        )\n        && get(aPath(meetingId, uid)).data.votingEligible == true;\n    }\n"""
new_present = """    function attendancePresence(data) {\n      return data.get('presenceStatus', data.get('status', 'invited'));\n    }\n    function presentVoter(meetingId, uid) {\n      return exists(aPath(meetingId, uid))\n        && attendancePresence(get(aPath(meetingId, uid)).data) == 'present'\n        && get(aPath(meetingId, uid)).data.votingEligible == true;\n    }\n"""

old_checkin = "        && (((('presenceStatus' in resource.data) && resource.data.presenceStatus in ['invited','departed'])) || ((!('presenceStatus' in resource.data)) && ('status' in resource.data) && resource.data.status in ['invited','departed']))) && request.resource.data.presenceStatus == 'present'\n"
new_checkin = "        && attendancePresence(resource.data) in ['invited','departed']\n        && request.resource.data.presenceStatus == 'present'\n"

if old_present not in text:
    raise SystemExit('presentVoter compatibility block not found')
if old_checkin not in text:
    raise SystemExit('selfCheckIn compatibility line not found')

text = text.replace(old_present, new_present, 1)
text = text.replace(old_checkin, new_checkin, 1)
path.write_text(text)
print('Patched Firestore rules compatibility expressions.')
