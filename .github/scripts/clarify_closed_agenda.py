from pathlib import Path
p=Path('js/phase6.js')
s=p.read_text()
old='''      ${hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE) && !["adjourned", "cancelled"].includes(meeting.status) ? `<button class="meeting-primary-button" data-phase6-action="open-agenda-form">Add Agenda Item</button>` : ""}'''
new='''      ${hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE) ? (["adjourned", "cancelled"].includes(meeting.status) ? `<button class="meeting-secondary-button" type="button" disabled title="Agenda changes are locked after a meeting is closed.">Meeting Closed</button>` : `<button class="meeting-primary-button" data-phase6-action="open-agenda-form">Add Agenda Item</button>`) : ""}'''
if old not in s:
    raise SystemExit('agenda action anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
