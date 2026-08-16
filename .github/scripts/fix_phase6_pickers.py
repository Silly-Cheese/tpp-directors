from pathlib import Path

p = Path("js/phase6.js")
s = p.read_text()

state_old = 'let agendaDraft = { itemType: "business", documentId: "", title: "", description: "" };\nlet motionDraftAgendaId = null;'
state_new = 'let agendaDraft = { itemType: "business", documentId: "", title: "", description: "" };\nlet agendaDocumentPickerOpen = false;\nlet motionDraftAgendaId = null;'
if state_old in s:
    s = s.replace(state_old, state_new, 1)
elif 'let agendaDocumentPickerOpen = false;' not in s:
    raise SystemExit("agenda picker state anchor not found")

start = s.index("function renderAgendaForm() {")
end = s.index("\nfunction renderMotionForm", start)
replacement = r'''function renderAgendaForm() {
  if (!agendaFormOpen || !hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE)) return "";
  const availableDocuments = agendaDocuments.filter((entry) => !entry.agendaMeetingId || entry.agendaMeetingId === meetingId);
  const selectedDocument = availableDocuments.find((entry) => entry.id === agendaDraft.documentId) || null;
  const typeChoice = (value, label) => `<button type="button" class="phase6-type-choice${agendaDraft.itemType === value ? " selected" : ""}" data-phase6-type-choice="${value}" aria-pressed="${agendaDraft.itemType === value ? "true" : "false"}">${label}</button>`;
  const documentChoices = [
    `<button type="button" class="phase6-document-choice${agendaDraft.documentId ? "" : " selected"}" data-phase6-document-choice=""><strong>None</strong><span>No Board document attached</span></button>`,
    ...availableDocuments.map((entry) => `<button type="button" class="phase6-document-choice${agendaDraft.documentId === entry.id ? " selected" : ""}" data-phase6-document-choice="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.documentNumber || "BDOC")} · ${escapeHtml(entry.title)}</strong><span>Agenda Ready Board document</span></button>`)
  ].join("");
  return `
    <form id="phase6-agenda-form" class="phase6-form">
      <div class="phase6-form-head"><div><strong>Add agenda item</strong><span>Add an item directly or connect an Agenda Ready Board document.</span></div><button type="button" class="secondary-button" data-phase6-action="close-agenda-form">Close</button></div>
      <fieldset class="phase6-type-fieldset"><legend>Agenda item type</legend><div class="phase6-type-picker">${typeChoice("business","Business")}${typeChoice("report","Report")}${typeChoice("motion","Motion")}${typeChoice("resolution","Resolution")}${typeChoice("election","Election")}${typeChoice("other","Other")}</div></fieldset>
      <input type="hidden" name="itemType" value="${escapeHtml(agendaDraft.itemType)}">
      <input type="hidden" name="documentId" value="${escapeHtml(agendaDraft.documentId)}">
      <div class="phase6-document-picker">
        <span class="phase6-field-label">Agenda Ready document</span>
        <button type="button" class="phase6-document-trigger" data-phase6-action="toggle-document-picker" aria-expanded="${agendaDocumentPickerOpen ? "true" : "false"}">
          <span><strong>${selectedDocument ? escapeHtml(selectedDocument.documentNumber || "BDOC") : "None"}</strong><small>${selectedDocument ? escapeHtml(selectedDocument.title) : "No Board document attached"}</small></span>
          <span class="phase6-picker-chevron" aria-hidden="true">${agendaDocumentPickerOpen ? "▲" : "▼"}</span>
        </button>
        ${agendaDocumentPickerOpen ? `<div class="phase6-document-menu" role="listbox">${documentChoices}</div>` : ""}
      </div>
      <label>Title<input name="title" maxlength="180" value="${escapeHtml(agendaDraft.title)}" required></label>
      <label>Description<textarea name="description" rows="3" maxlength="1200">${escapeHtml(agendaDraft.description)}</textarea></label>
      <button type="submit" class="meeting-primary-button phase6-add-agenda-button">Add to Agenda</button>
      <p id="phase6-agenda-message" class="meeting-form-message"></p>
    </form>`;
}
'''
s = s[:start] + replacement + s[end:]

reset_old = '''function resetAgendaDraft() {
  agendaDraft = { itemType: "business", documentId: "", title: "", description: "" };
}'''
reset_new = '''function resetAgendaDraft() {
  agendaDraft = { itemType: "business", documentId: "", title: "", description: "" };
  agendaDocumentPickerOpen = false;
}'''
if reset_old in s:
    s = s.replace(reset_old, reset_new, 1)

anchor = '    const action = event.target.closest("[data-phase6-action]")?.dataset.phase6Action;\n'
insert = '''    const typeChoice = event.target.closest("[data-phase6-type-choice]");
    if (typeChoice) {
      captureAgendaDraft();
      agendaDraft.itemType = typeChoice.dataset.phase6TypeChoice || "business";
      return renderWorkspace();
    }

    const documentChoice = event.target.closest("[data-phase6-document-choice]");
    if (documentChoice) {
      captureAgendaDraft();
      agendaDraft.documentId = documentChoice.dataset.phase6DocumentChoice || "";
      agendaDocumentPickerOpen = false;
      return renderWorkspace();
    }

'''
if 'const typeChoice = event.target.closest("[data-phase6-type-choice]")' not in s:
    if anchor not in s:
        raise SystemExit("click handler anchor not found")
    s = s.replace(anchor, insert + anchor, 1)

openclose_old = '''    if (action === "open-agenda-form") { resetAgendaDraft(); agendaFormOpen = true; return renderWorkspace(); }
    if (action === "close-agenda-form") { agendaFormOpen = false; resetAgendaDraft(); return renderWorkspace(); }'''
openclose_new = '''    if (action === "open-agenda-form") { resetAgendaDraft(); agendaFormOpen = true; return renderWorkspace(); }
    if (action === "toggle-document-picker") { captureAgendaDraft(); agendaDocumentPickerOpen = !agendaDocumentPickerOpen; return renderWorkspace(); }
    if (action === "close-agenda-form") { agendaFormOpen = false; resetAgendaDraft(); return renderWorkspace(); }'''
if 'action === "toggle-document-picker"' not in s:
    if openclose_old not in s:
        raise SystemExit("open/close action anchor not found")
    s = s.replace(openclose_old, openclose_new, 1)

p.write_text(s)

css = Path("phase6.css")
c = css.read_text()
marker = "/* Deterministic Phase 6 agenda pickers */"
if marker not in c:
    c += r'''

/* Deterministic Phase 6 agenda pickers */
.phase6-type-picker{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px!important}
.phase6-type-choice{appearance:none!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;padding:10px 13px!important;border:1px solid rgba(216,195,165,.20)!important;border-radius:999px!important;background:rgba(255,255,255,.035)!important;color:#cfc3b4!important;font:inherit!important;font-size:.82rem!important;font-weight:800!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;z-index:20!important}
.phase6-type-choice:hover{border-color:rgba(216,195,165,.48)!important;background:rgba(216,195,165,.08)!important;color:#fff0d2!important}
.phase6-type-choice.selected{border-color:rgba(255,240,210,.72)!important;background:linear-gradient(135deg,rgba(255,240,210,.20),rgba(216,195,165,.10))!important;color:#fff0d2!important;box-shadow:0 0 0 3px rgba(216,195,165,.08)!important}
.phase6-type-choice:focus-visible{outline:2px solid #fff0d2!important;outline-offset:2px!important}
.phase6-document-picker{display:grid;gap:8px;position:relative;z-index:30}
.phase6-field-label{color:#d6cabb;font-size:.82rem;font-weight:800}
.phase6-document-trigger{width:100%;min-height:58px;padding:11px 14px;border:1px solid rgba(216,195,165,.28)!important;border-radius:17px!important;background:rgba(5,5,5,.92)!important;color:#f7f2ea!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;text-align:left!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;z-index:31!important}
.phase6-document-trigger>span:first-child{display:grid;gap:3px;min-width:0}.phase6-document-trigger strong{color:#fff0d2!important;font-size:.86rem}.phase6-document-trigger small{color:#a99f94!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.phase6-picker-chevron{color:#d8c3a5!important;font-size:.72rem;flex:0 0 auto}
.phase6-document-trigger:hover,.phase6-document-trigger[aria-expanded="true"]{border-color:rgba(255,240,210,.62)!important;background:#0d0b09!important}
.phase6-document-menu{display:grid;gap:7px;padding:8px;border:1px solid rgba(216,195,165,.24);border-radius:18px;background:#090806;box-shadow:0 22px 60px rgba(0,0,0,.55);position:relative;z-index:40}
.phase6-document-choice{width:100%;display:grid!important;gap:3px!important;padding:11px 12px!important;border:1px solid transparent!important;border-radius:13px!important;background:transparent!important;color:#f7f2ea!important;text-align:left!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;z-index:41!important}
.phase6-document-choice strong{font-size:.84rem}.phase6-document-choice span{color:#978d82!important;font-size:.75rem}
.phase6-document-choice:hover{background:rgba(255,255,255,.055)!important;border-color:rgba(216,195,165,.16)!important}
.phase6-document-choice.selected{background:rgba(216,195,165,.09)!important;border-color:rgba(216,195,165,.30)!important;color:#fff0d2!important}
.phase6-form input[type="hidden"]{display:none!important}
@media(max-width:680px){.phase6-type-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
    css.write_text(c)
