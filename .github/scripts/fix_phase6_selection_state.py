from pathlib import Path

p = Path('js/phase6.js')
s = p.read_text()

old_render = '''function renderWorkspace() {
  const host = $("#phase6-meeting-workspace");
  if (!host || host.dataset.meetingId !== meetingId) return;
  if (agendaFormOpen) captureAgendaDraft();'''
new_render = '''function renderWorkspace({ captureDraft = true } = {}) {
  const host = $("#phase6-meeting-workspace");
  if (!host || host.dataset.meetingId !== meetingId) return;
  if (agendaFormOpen && captureDraft) captureAgendaDraft();'''
if old_render not in s:
    raise SystemExit('renderWorkspace anchor not found')
s = s.replace(old_render, new_render, 1)

old_type = '''    if (typeChoice) {
      captureAgendaDraft();
      agendaDraft.itemType = typeChoice.dataset.phase6TypeChoice || "business";
      return renderWorkspace();
    }'''
new_type = '''    if (typeChoice) {
      captureAgendaDraft();
      agendaDraft.itemType = typeChoice.dataset.phase6TypeChoice || "business";
      return renderWorkspace({ captureDraft: false });
    }'''
if old_type not in s:
    raise SystemExit('type choice block not found')
s = s.replace(old_type, new_type, 1)

old_doc = '''    if (documentChoice) {
      captureAgendaDraft();
      agendaDraft.documentId = documentChoice.dataset.phase6DocumentChoice || "";
      agendaDocumentPickerOpen = false;
      return renderWorkspace();
    }'''
new_doc = '''    if (documentChoice) {
      captureAgendaDraft();
      agendaDraft.documentId = documentChoice.dataset.phase6DocumentChoice || "";
      agendaDocumentPickerOpen = false;
      return renderWorkspace({ captureDraft: false });
    }'''
if old_doc not in s:
    raise SystemExit('document choice block not found')
s = s.replace(old_doc, new_doc, 1)

p.write_text(s)
