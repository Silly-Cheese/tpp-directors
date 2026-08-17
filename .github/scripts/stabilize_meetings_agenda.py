from pathlib import Path
import re

# --- Phase 5: replace legacy placeholder and own the Phase 6 mount point ---
p = Path('js/phase5.js')
s = p.read_text()

s = s.replace('''function ensureMeetingView() {\n  if ($("#view-meetings")) return;\n  const portalMain = $(".portal-main");\n  if (!portalMain) return;\n  const section = document.createElement("section");\n  section.id = "view-meetings";\n  section.className = "portal-section";\n  section.hidden = true;''', '''function ensureMeetingView() {\n  const portalMain = $(".portal-main");\n  if (!portalMain) return;\n  const section = $("#view-meetings") || document.createElement("section");\n  const wasConnected = section.isConnected;\n  section.id = "view-meetings";\n  section.className = "portal-section";\n  if (!wasConnected) section.hidden = true;''')

old_tail = '''    <div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>Director</th><th>Board role</th><th>Voting</th><th>Attendance</th></tr></thead><tbody>${selectedAttendance.map((entry) => attendanceRow(meeting, entry)).join("") || '<tr><td colspan="4">No attendance records are available.</td></tr>'}</tbody></table></div>\n    <p id="phase5-action-message" class="meeting-form-message" role="status"></p>`;\n}'''
new_tail = '''    <div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>Director</th><th>Board role</th><th>Voting</th><th>Attendance</th></tr></thead><tbody>${selectedAttendance.map((entry) => attendanceRow(meeting, entry)).join("") || '<tr><td colspan="4">No attendance records are available.</td></tr>'}</tbody></table></div>\n    <p id="phase5-action-message" class="meeting-form-message" role="status"></p>\n    <section id="phase6-meeting-workspace" class="phase6-host" data-meeting-id="${meeting.id}"><div class="phase6-empty">Loading agenda, motions, and voting…</div></section>`;\n  window.__TPP_SELECTED_MEETING_ID__ = meeting.id;\n  queueMicrotask(() => window.dispatchEvent(new CustomEvent("tpp:meeting-selected", { detail: { meetingId: meeting.id } })));\n}'''
if old_tail not in s:
    raise SystemExit('Phase 5 meeting detail tail anchor not found')
s = s.replace(old_tail, new_tail, 1)
p.write_text(s)

# --- Phase 6: replace fragile custom agenda controls with native selects ---
p = Path('js/phase6.js')
s = p.read_text()

start = s.index('function renderAgendaForm() {')
end = s.index('\nfunction renderMotionForm', start)
new_func = r'''function renderAgendaForm() {
  if (!agendaFormOpen || !hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE)) return "";
  const availableDocuments = agendaDocuments.filter((entry) => !entry.agendaMeetingId || entry.agendaMeetingId === meetingId);
  const typeOptions = [
    ["business", "Business"],
    ["report", "Report"],
    ["motion", "Motion"],
    ["resolution", "Resolution"],
    ["election", "Election"],
    ["other", "Other"]
  ].map(([value, label]) => `<option value="${value}" ${agendaDraft.itemType === value ? "selected" : ""}>${label}</option>`).join("");
  const documentOptions = [
    `<option value="" ${agendaDraft.documentId ? "" : "selected"}>None</option>`,
    ...availableDocuments.map((entry) => `<option value="${escapeHtml(entry.id)}" ${agendaDraft.documentId === entry.id ? "selected" : ""}>${escapeHtml(entry.documentNumber || "BDOC")} · ${escapeHtml(entry.title)}</option>`)
  ].join("");
  return `
    <form id="phase6-agenda-form" class="phase6-form">
      <div class="phase6-form-head"><div><strong>Add agenda item</strong><span>Add an item directly or connect an Agenda Ready Board document.</span></div><button type="button" class="secondary-button" data-phase6-action="close-agenda-form">Close</button></div>
      <div class="phase6-form-row">
        <label>Type<select name="itemType">${typeOptions}</select></label>
        <label>Agenda Ready document<select name="documentId">${documentOptions}</select></label>
      </div>
      <label>Title<input name="title" maxlength="180" value="${escapeHtml(agendaDraft.title)}" required></label>
      <label>Description<textarea name="description" rows="3" maxlength="1200">${escapeHtml(agendaDraft.description)}</textarea></label>
      <button type="submit" class="meeting-primary-button phase6-add-agenda-button">Add to Agenda</button>
      <p id="phase6-agenda-message" class="meeting-form-message"></p>
    </form>`;
}
'''
s = s[:start] + new_func + s[end:]

# Cache bust the phase-specific CSS.
s = s.replace('link.href = "./phase6.css";', 'link.href = "./phase6.css?v=20260817-stable1";')

# Bind the already-selected meeting after auth/profile is available, so an initial
# selection event that occurred before Phase 6 loaded is not lost.
old_apply = '''  currentProfile = profile;\n  const resolutionNav = $('.nav-item[data-view="resolutions"]');\n  if (resolutionNav) resolutionNav.hidden = !hasPermission(profile, PERMISSIONS.RESOLUTIONS_VIEW);\n  bindResolutions();\n}'''
new_apply = '''  currentProfile = profile;\n  const resolutionNav = $('.nav-item[data-view="resolutions"]');\n  if (resolutionNav) resolutionNav.hidden = !hasPermission(profile, PERMISSIONS.RESOLUTIONS_VIEW);\n  bindResolutions();\n  const selected = window.__TPP_SELECTED_MEETING_ID__ || $("#phase6-meeting-workspace")?.dataset.meetingId || null;\n  if (selected) bindMeeting(selected);\n}'''
if old_apply not in s:
    raise SystemExit('Phase 6 applyAuthUser anchor not found')
s = s.replace(old_apply, new_apply, 1)
p.write_text(s)

# --- Loader: remove stale MutationObserver polish layer and bust module cache ---
p = Path('js/firebase.js')
s = p.read_text()
s = s.replace('    "./phase5.js",\n    "./phase5-polish.js",\n    "./phase6.js",', '    "./phase5.js?v=20260817-stable1",\n    "./phase6.js?v=20260817-stable1",')
p.write_text(s)
