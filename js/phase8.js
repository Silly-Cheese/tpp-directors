import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, db } from "./firebase.js";
import {
  assignOfficer,
  concludeOfficerTerm,
  createBoardTask,
  createConflictRecord,
  dueState,
  governanceStatusLabel,
  resolveConflictRecord,
  reviewCoiDisclosure,
  saveCommittee,
  saveComplianceItem,
  submitCoiDisclosure,
  updateBoardTask
} from "./governance-ops-data.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

const $ = (selector) => document.querySelector(selector);
let profile = null;
let activeTab = "committees";
let committees = [];
let disclosures = [];
let conflicts = [];
let officerTerms = [];
let tasks = [];
let compliance = [];
let directory = [];
let selectedCommitteeId = null;
let editingComplianceId = null;
let unsubs = [];
let initialized = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function formatDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(timestampValue(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function isFounder() {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function canSeePhase8() {
  if (!profile) return false;
  return isFounder() || [
    PERMISSIONS.COMMITTEES_VIEW,
    PERMISSIONS.COI_VIEW,
    PERMISSIONS.OFFICERS_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.COMPLIANCE_VIEW
  ].some((permission) => hasPermission(profile, permission));
}

function directorName(uid) {
  const entry = directory.find((item) => item.uid === uid || item.id === uid);
  return entry?.displayName || entry?.fullName || "Director";
}

function directorOptions(selected = "", includeBlank = true) {
  return `${includeBlank ? '<option value="">Select director</option>' : ""}${directory.map((entry) => {
    const uid = entry.uid || entry.id;
    return `<option value="${escapeHtml(uid)}"${uid === selected ? " selected" : ""}>${escapeHtml(entry.directorNumber || "")} — ${escapeHtml(entry.displayName || entry.fullName || "Director")}</option>`;
  }).join("")}`;
}

function installStyles() {
  if ($('link[data-phase8-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase8.css";
  link.dataset.phase8Styles = "true";
  document.head.append(link);
}

function ensureNavigation() {
  if ($('.nav-item[data-view="governance"]')) return;
  const anchor = $('.nav-item[data-view="records"]') || $('.nav-item[data-view="resolutions"]');
  if (!anchor) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-item";
  button.dataset.view = "governance";
  button.textContent = "Governance";
  anchor.after(button);
}

function ensureView() {
  if ($("#view-governance")) return;
  const main = $(".portal-main");
  if (!main) return;
  const section = document.createElement("section");
  section.id = "view-governance";
  section.className = "portal-section phase8-shell";
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading-row phase8-heading">
      <div><p class="eyebrow">BOARD GOVERNANCE OPERATIONS</p><h2>Governance Center</h2><p>Committees, conflict disclosures, officer terms, Board assignments, and compliance obligations in one operational workspace.</p></div>
    </div>
    <div id="phase8-metrics" class="phase8-metrics"></div>
    <div class="phase8-tabs" role="tablist">
      <button type="button" data-phase8-tab="committees">Committees</button>
      <button type="button" data-phase8-tab="coi">Conflicts & COI</button>
      <button type="button" data-phase8-tab="officers">Officers</button>
      <button type="button" data-phase8-tab="tasks">Board Tasks</button>
      <button type="button" data-phase8-tab="compliance">Compliance</button>
    </div>
    <div id="phase8-workspace"></div>`;
  main.append(section);
}

function showGovernanceView() {
  if (!canSeePhase8()) return;
  document.querySelectorAll(".portal-section").forEach((section) => { section.hidden = section.id !== "view-governance"; });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === "governance"));
  const title = $("#view-title");
  if (title) title.textContent = "Board Governance";
  $("#view-governance").hidden = false;
  render();
}

function renderMetrics() {
  const host = $("#phase8-metrics");
  if (!host) return;
  const currentYear = new Date().getFullYear();
  const reviewedCurrent = disclosures.filter((entry) => Number(entry.year) === currentYear && entry.status === "reviewed").length;
  const activeOfficers = officerTerms.filter((entry) => entry.status === "active").length;
  const openTasks = tasks.filter((entry) => !["completed", "cancelled"].includes(entry.status)).length;
  const dueCompliance = compliance.filter((entry) => ["overdue", "due_today", "due_soon"].includes(dueState(entry.dueDate, entry.status))).length;
  host.innerHTML = `
    <div><span>Active Committees</span><strong>${committees.filter((entry) => entry.status === "active").length}</strong></div>
    <div><span>${currentYear} COI Reviewed</span><strong>${reviewedCurrent}</strong></div>
    <div><span>Active Officers</span><strong>${activeOfficers}</strong></div>
    <div><span>Open Tasks</span><strong>${openTasks}</strong></div>
    <div><span>Compliance Due Soon</span><strong>${dueCompliance}</strong></div>`;
}

function committeeForm() {
  if (!hasPermission(profile, PERMISSIONS.COMMITTEES_MANAGE)) return "";
  const selected = committees.find((entry) => entry.id === selectedCommitteeId);
  const memberSet = new Set(selected?.memberUids || []);
  return `
    <form id="phase8-committee-form" class="phase8-form">
      <div class="phase8-form-head"><div><strong>${selected ? "Edit Committee" : "Create Committee"}</strong><span>Membership changes affect the committee workspace, not a director's legal Board status.</span></div>${selected ? '<button type="button" class="secondary-button" data-phase8-action="new-committee">New</button>' : ""}</div>
      <div class="phase8-grid-2"><label>Name<input name="name" maxlength="180" required value="${escapeHtml(selected?.name || "")}"></label><label>Type<select name="committeeType"><option value="standing"${selected?.committeeType === "standing" ? " selected" : ""}>Standing</option><option value="ad_hoc"${selected?.committeeType === "ad_hoc" ? " selected" : ""}>Ad Hoc</option><option value="special"${selected?.committeeType === "special" ? " selected" : ""}>Special</option></select></label></div>
      <label>Purpose / delegated scope<textarea name="purpose" rows="4" maxlength="5000" required>${escapeHtml(selected?.purpose || "")}</textarea></label>
      <div class="phase8-grid-2"><label>Chair<select name="chairUid">${directorOptions(selected?.chairUid || "")}</select></label><label>Status<select name="status"><option value="active"${selected?.status === "active" ? " selected" : ""}>Active</option><option value="inactive"${selected?.status === "inactive" ? " selected" : ""}>Inactive</option><option value="disbanded"${selected?.status === "disbanded" ? " selected" : ""}>Disbanded</option></select></label></div>
      <div class="phase8-grid-2"><label>Established<input name="establishedDate" type="date" value="${escapeHtml(selected?.establishedDate || "")}"></label><label>Sunset / end date<input name="sunsetDate" type="date" value="${escapeHtml(selected?.sunsetDate || "")}"></label></div>
      <label>Committee charter Google link<input name="charterUrl" type="url" value="${escapeHtml(selected?.charterUrl || "")}" placeholder="https://docs.google.com/..."></label>
      <fieldset><legend>Committee members</legend><div class="phase8-member-grid">${directory.map((entry) => {
        const uid = entry.uid || entry.id;
        return `<label><input type="checkbox" name="memberUid" value="${escapeHtml(uid)}"${memberSet.has(uid) ? " checked" : ""}><span>${escapeHtml(entry.displayName || entry.fullName || "Director")}</span></label>`;
      }).join("")}</div></fieldset>
      <button type="submit" class="meeting-primary-button">${selected ? "Save Committee" : "Create Committee"}</button><p class="meeting-form-message" id="phase8-committee-message"></p>
    </form>`;
}

function renderCommittees() {
  if (!hasPermission(profile, PERMISSIONS.COMMITTEES_VIEW)) return '<div class="phase8-empty">Committee access is not enabled for this account.</div>';
  const cards = committees.length ? committees.map((entry) => `
    <article class="phase8-card ${escapeHtml(entry.status)}">
      <div class="phase8-card-head"><div><span>${escapeHtml(entry.committeeNumber || "COM")}</span><strong>${escapeHtml(entry.name)}</strong></div><em>${escapeHtml(governanceStatusLabel(entry.status))}</em></div>
      <p>${escapeHtml(entry.purpose || "")}</p>
      <div class="phase8-meta"><span>${escapeHtml(governanceStatusLabel(entry.committeeType))}</span><span>Chair: ${escapeHtml(entry.chairUid ? directorName(entry.chairUid) : "Not assigned")}</span><span>${entry.memberUids?.length || 0} members</span></div>
      <div class="phase8-inline">${entry.charterUrl ? `<a href="${escapeHtml(entry.charterUrl)}" target="_blank" rel="noopener noreferrer">Open Charter</a>` : ""}${hasPermission(profile, PERMISSIONS.COMMITTEES_MANAGE) ? `<button type="button" data-phase8-edit-committee="${entry.id}">Manage</button>` : ""}</div>
    </article>`).join("") : '<div class="phase8-empty">No committees have been created.</div>';
  return `<div class="phase8-layout"><div class="phase8-list">${cards}</div>${committeeForm()}</div>`;
}

function disclosureForm() {
  if (!hasPermission(profile, PERMISSIONS.COI_SUBMIT)) return "";
  return `
    <form id="phase8-coi-form" class="phase8-form compact">
      <div class="phase8-form-head"><div><strong>Annual COI Disclosure</strong><span>Your disclosure document remains Google-hosted.</span></div></div>
      <div class="phase8-grid-2"><label>Year<input name="year" type="number" min="2020" max="2100" value="${new Date().getFullYear()}" required></label><label>Disclose conflicts?<select name="hasConflicts"><option value="false">No conflicts disclosed</option><option value="true">Yes — conflicts disclosed</option></select></label></div>
      <label>Disclosure Google link<input name="disclosureUrl" type="url" placeholder="https://docs.google.com/..." required></label>
      <label>Summary / context<textarea name="summary" rows="3" maxlength="5000"></textarea></label>
      <button type="submit" class="meeting-primary-button">Submit Annual Disclosure</button><p id="phase8-coi-message" class="meeting-form-message"></p>
    </form>`;
}

function conflictForm() {
  if (!hasPermission(profile, PERMISSIONS.COI_SUBMIT) && !hasPermission(profile, PERMISSIONS.COI_MANAGE)) return "";
  const canManage = hasPermission(profile, PERMISSIONS.COI_MANAGE);
  return `
    <form id="phase8-conflict-form" class="phase8-form compact">
      <div class="phase8-form-head"><div><strong>Record Specific Conflict</strong><span>Use this for a vendor relationship, transaction, agenda item, vote, or other matter requiring disclosure or recusal.</span></div></div>
      ${canManage ? `<label>Director<select name="directorUid">${directorOptions(auth.currentUser?.uid || "")}</select></label>` : ""}
      <div class="phase8-grid-2"><label>Entity / interest<input name="entityOrInterest" maxlength="300"></label><label>Relationship<input name="relationship" maxlength="500"></label></div>
      <label>Description<textarea name="description" rows="4" maxlength="6000" required></textarea></label>
      <div class="phase8-grid-2"><label>Action<select name="action"><option value="disclosed">Disclosure recorded</option><option value="recused">Director recused</option><option value="not_recused">Disclosure — no recusal</option><option value="management_plan">Management plan</option></select></label><label>Related Google document<input name="relatedDocumentUrl" type="url" placeholder="Optional"></label></div>
      <div class="phase8-grid-3"><label>Meeting ID<input name="meetingId"></label><label>Agenda Item ID<input name="agendaItemId"></label><label>Vote ID<input name="voteId"></label></div>
      <label>Management plan / safeguards<textarea name="managementPlan" rows="3" maxlength="5000"></textarea></label>
      <button type="submit" class="meeting-primary-button">Record Conflict</button><p id="phase8-conflict-message" class="meeting-form-message"></p>
    </form>`;
}

function renderCoi() {
  if (!hasPermission(profile, PERMISSIONS.COI_VIEW)) return '<div class="phase8-empty">Conflict-of-interest access is not enabled for this account.</div>';
  const canReview = hasPermission(profile, PERMISSIONS.COI_REVIEW);
  const disclosuresHtml = disclosures.length ? disclosures.map((entry) => `
    <article class="phase8-card"><div class="phase8-card-head"><div><span>${escapeHtml(entry.disclosureNumber || "COI")}</span><strong>${escapeHtml(entry.directorName || "Director")} · ${entry.year}</strong></div><em>${escapeHtml(governanceStatusLabel(entry.status))}</em></div>
      <div class="phase8-meta"><span>${entry.hasConflicts ? "Conflicts disclosed" : "No conflicts disclosed"}</span>${entry.reviewedByName ? `<span>Reviewed by ${escapeHtml(entry.reviewedByName)}</span>` : ""}</div>
      ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}<div class="phase8-inline"><a href="${escapeHtml(entry.disclosureUrl)}" target="_blank" rel="noopener noreferrer">Open Disclosure</a>${canReview && ["submitted", "renewal_required"].includes(entry.status) ? `<button type="button" data-phase8-coi-review="${entry.id}" data-action="reviewed">Mark Reviewed</button><button type="button" data-phase8-coi-review="${entry.id}" data-action="renewal_required">Require Revision</button>` : ""}</div></article>`).join("") : '<div class="phase8-empty">No annual disclosures are visible to this account.</div>';
  const conflictHtml = conflicts.length ? conflicts.map((entry) => `
    <article class="phase8-card ${escapeHtml(entry.status)}"><div class="phase8-card-head"><div><span>${escapeHtml(entry.conflictNumber || "CONFLICT")}</span><strong>${escapeHtml(entry.directorName || "Director")}${entry.entityOrInterest ? ` · ${escapeHtml(entry.entityOrInterest)}` : ""}</strong></div><em>${escapeHtml(governanceStatusLabel(entry.status))}</em></div>
      <p>${escapeHtml(entry.description || "")}</p><div class="phase8-meta"><span>${escapeHtml(governanceStatusLabel(entry.action))}</span>${entry.meetingId ? `<span>Meeting ${escapeHtml(entry.meetingId)}</span>` : ""}${entry.voteId ? `<span>Vote ${escapeHtml(entry.voteId)}</span>` : ""}</div>
      <div class="phase8-inline">${entry.relatedDocumentUrl ? `<a href="${escapeHtml(entry.relatedDocumentUrl)}" target="_blank" rel="noopener noreferrer">Open Related Document</a>` : ""}${hasPermission(profile, PERMISSIONS.COI_MANAGE) && entry.status !== "resolved" ? `<button type="button" data-phase8-resolve-conflict="${entry.id}">Resolve</button>` : ""}</div></article>`).join("") : '<div class="phase8-empty">No specific conflict records are visible.</div>';
  return `<div class="phase8-stack">${disclosureForm()}<section><div class="phase8-subhead"><h3>Annual Disclosures</h3><span>${disclosures.length} records</span></div><div class="phase8-list">${disclosuresHtml}</div></section>${conflictForm()}<section><div class="phase8-subhead"><h3>Specific Conflict & Recusal Records</h3><span>${conflicts.length} records</span></div><div class="phase8-list">${conflictHtml}</div></section></div>`;
}

function officerForm() {
  if (!hasPermission(profile, PERMISSIONS.OFFICERS_MANAGE)) return "";
  return `
    <form id="phase8-officer-form" class="phase8-form compact">
      <div class="phase8-form-head"><div><strong>Record Officer Assignment</strong><span>Creates a permanent officer-term record and updates the director's current officer label.</span></div></div>
      <div class="phase8-grid-2"><label>Director<select name="directorUid" required>${directorOptions()}</select></label><label>Officer title<input name="officerTitle" maxlength="180" placeholder="Chair, Secretary, Treasurer…" required></label></div>
      <div class="phase8-grid-3"><label>Basis<select name="basis"><option value="election">Election</option><option value="appointment">Appointment</option><option value="interim">Interim appointment</option><option value="confirmation">Confirmation</option></select></label><label>Start<input name="startDate" type="date" required></label><label>Term end<input name="endDate" type="date"></label></div>
      <div class="phase8-grid-2"><label>Related meeting ID<input name="relatedMeetingId"></label><label>Related resolution ID<input name="relatedResolutionId"></label></div>
      <label>Appointment/election Google document<input name="appointmentDocumentUrl" type="url" placeholder="Optional Google link"></label>
      <button type="submit" class="meeting-primary-button">Record Officer Assignment</button><p id="phase8-officer-message" class="meeting-form-message"></p>
    </form>`;
}

function renderOfficers() {
  if (!hasPermission(profile, PERMISSIONS.OFFICERS_VIEW)) return '<div class="phase8-empty">Officer-history access is not enabled for this account.</div>';
  const active = officerTerms.filter((entry) => entry.status === "active");
  const history = officerTerms.filter((entry) => entry.status !== "active");
  const renderTerm = (entry) => `<article class="phase8-card ${escapeHtml(entry.status)}"><div class="phase8-card-head"><div><span>${escapeHtml(entry.termNumber || "OFF")}</span><strong>${escapeHtml(entry.officerTitle)} · ${escapeHtml(entry.directorName)}</strong></div><em>${escapeHtml(governanceStatusLabel(entry.status))}</em></div><div class="phase8-meta"><span>${escapeHtml(governanceStatusLabel(entry.basis))}</span><span>${escapeHtml(formatDate(entry.startDate))} → ${entry.endDate ? escapeHtml(formatDate(entry.endDate)) : "Current"}</span>${entry.relatedResolutionId ? `<span>Resolution ${escapeHtml(entry.relatedResolutionId)}</span>` : ""}</div><div class="phase8-inline">${entry.appointmentDocumentUrl ? `<a href="${escapeHtml(entry.appointmentDocumentUrl)}" target="_blank" rel="noopener noreferrer">Open Appointment Record</a>` : ""}${entry.status === "active" && hasPermission(profile, PERMISSIONS.OFFICERS_MANAGE) ? `<button type="button" data-phase8-conclude-officer="${entry.id}">Conclude Term</button>` : ""}</div></article>`;
  return `<div class="phase8-stack">${officerForm()}<section><div class="phase8-subhead"><h3>Current Officers</h3><span>${active.length} active</span></div><div class="phase8-list">${active.length ? active.map(renderTerm).join("") : '<div class="phase8-empty">No active officer terms are recorded.</div>'}</div></section><section><div class="phase8-subhead"><h3>Officer History</h3><span>${history.length} concluded</span></div><div class="phase8-list">${history.length ? history.map(renderTerm).join("") : '<div class="phase8-empty">No concluded officer terms yet.</div>'}</div></section></div>`;
}

function taskForm() {
  if (!hasPermission(profile, PERMISSIONS.TASKS_CREATE)) return "";
  return `
    <form id="phase8-task-form" class="phase8-form compact">
      <div class="phase8-form-head"><div><strong>Create Board Task</strong><span>Assignments can be tied to a committee, meeting, resolution, or Google document.</span></div></div>
      <label>Task title<input name="title" maxlength="240" required></label><label>Description<textarea name="description" rows="3" maxlength="6000"></textarea></label>
      <div class="phase8-grid-3"><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label><label>Due date<input name="dueDate" type="date"></label><label>Committee<select name="committeeId"><option value="">None</option>${committees.map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`).join("")}</select></label></div>
      <fieldset><legend>Owners</legend><div class="phase8-member-grid">${directory.map((entry) => `<label><input type="checkbox" name="ownerUid" value="${escapeHtml(entry.uid || entry.id)}"><span>${escapeHtml(entry.displayName || entry.fullName || "Director")}</span></label>`).join("")}</div></fieldset>
      <div class="phase8-grid-2"><label>Related meeting ID<input name="relatedMeetingId"></label><label>Related resolution ID<input name="relatedResolutionId"></label></div><label>Related Google document<input name="relatedDocumentUrl" type="url"></label>
      <button type="submit" class="meeting-primary-button">Create Task</button><p id="phase8-task-message" class="meeting-form-message"></p>
    </form>`;
}

function renderTasks() {
  if (!hasPermission(profile, PERMISSIONS.TASKS_VIEW)) return '<div class="phase8-empty">Board task access is not enabled for this account.</div>';
  const cards = tasks.length ? tasks.map((entry) => {
    const due = dueState(entry.dueDate, entry.status);
    const canUpdate = hasPermission(profile, PERMISSIONS.TASKS_MANAGE) || (entry.ownerUids?.includes(auth.currentUser?.uid) && hasPermission(profile, PERMISSIONS.TASKS_UPDATE_OWN));
    return `<article class="phase8-card task-${escapeHtml(entry.priority)}"><div class="phase8-card-head"><div><span>${escapeHtml(entry.taskNumber || "TASK")}</span><strong>${escapeHtml(entry.title)}</strong></div><em>${escapeHtml(governanceStatusLabel(entry.status))}</em></div>${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ""}<div class="phase8-meta"><span>${escapeHtml(governanceStatusLabel(entry.priority))} priority</span><span class="due-${escapeHtml(due)}">${entry.dueDate ? `Due ${escapeHtml(formatDate(entry.dueDate))} · ${escapeHtml(governanceStatusLabel(due))}` : "No due date"}</span><span>${escapeHtml((entry.ownerNames?.length ? entry.ownerNames : (entry.ownerUids || []).map(directorName)).join(", ") || "Unassigned")}</span></div><div class="phase8-inline">${entry.relatedDocumentUrl ? `<a href="${escapeHtml(entry.relatedDocumentUrl)}" target="_blank" rel="noopener noreferrer">Open Related Document</a>` : ""}${canUpdate && entry.status === "open" ? `<button type="button" data-phase8-task-status="in_progress" data-task-id="${entry.id}">Start</button>` : ""}${canUpdate && !["completed", "cancelled"].includes(entry.status) ? `<button type="button" data-phase8-task-status="completed" data-task-id="${entry.id}">Complete</button>` : ""}${hasPermission(profile, PERMISSIONS.TASKS_MANAGE) && entry.status === "completed" ? `<button type="button" data-phase8-task-status="open" data-task-id="${entry.id}">Reopen</button>` : ""}</div></article>`;
  }).join("") : '<div class="phase8-empty">No Board tasks are assigned to this account.</div>';
  return `<div class="phase8-stack">${taskForm()}<section><div class="phase8-subhead"><h3>Assignments</h3><span>${tasks.length} visible</span></div><div class="phase8-list">${cards}</div></section></div>`;
}

function complianceForm() {
  if (!hasPermission(profile, PERMISSIONS.COMPLIANCE_MANAGE)) return "";
  const selected = compliance.find((entry) => entry.id === editingComplianceId);
  return `
    <form id="phase8-compliance-form" class="phase8-form compact">
      <div class="phase8-form-head"><div><strong>${selected ? "Update Compliance Item" : "Create Compliance Item"}</strong><span>Track filings, policy reviews, Board obligations, registrations, and recurring governance deadlines.</span></div>${selected ? '<button type="button" class="secondary-button" data-phase8-action="new-compliance">New</button>' : ""}</div>
      <label>Title<input name="title" maxlength="240" required value="${escapeHtml(selected?.title || "")}"></label><label>Description<textarea name="description" rows="3" maxlength="6000">${escapeHtml(selected?.description || "")}</textarea></label>
      <div class="phase8-grid-3"><label>Category<select name="category">${["corporate", "tax", "registration", "policy", "board", "financial", "program", "other"].map((value) => `<option value="${value}"${selected?.category === value ? " selected" : ""}>${escapeHtml(governanceStatusLabel(value))}</option>`).join("")}</select></label><label>Status<select name="status">${["pending", "due", "completed", "waived"].map((value) => `<option value="${value}"${selected?.status === value ? " selected" : ""}>${escapeHtml(governanceStatusLabel(value))}</option>`).join("")}</select></label><label>Due date<input name="dueDate" type="date" value="${escapeHtml(selected?.dueDate || "")}"></label></div>
      <div class="phase8-grid-2"><label>Recurrence<input name="recurrence" maxlength="180" placeholder="Annual, every 2 years, one-time…" value="${escapeHtml(selected?.recurrence || "")}"></label><label>Owner<select name="ownerUid">${directorOptions(selected?.ownerUid || "")}</select></label></div>
      <label>Authority / source<input name="authorityOrSource" maxlength="800" value="${escapeHtml(selected?.authorityOrSource || "")}"></label><label>Source Google document<input name="sourceDocumentUrl" type="url" value="${escapeHtml(selected?.sourceDocumentUrl || "")}"></label><label>Completion note<textarea name="completionNote" rows="2" maxlength="4000">${escapeHtml(selected?.completionNote || "")}</textarea></label>
      <button type="submit" class="meeting-primary-button">${selected ? "Save Compliance Item" : "Create Compliance Item"}</button><p id="phase8-compliance-message" class="meeting-form-message"></p>
    </form>`;
}

function renderCompliance() {
  if (!hasPermission(profile, PERMISSIONS.COMPLIANCE_VIEW)) return '<div class="phase8-empty">Compliance access is not enabled for this account.</div>';
  const cards = compliance.length ? compliance.map((entry) => {
    const due = dueState(entry.dueDate, entry.status);
    return `<article class="phase8-card"><div class="phase8-card-head"><div><span>${escapeHtml(entry.complianceNumber || "COMP")}</span><strong>${escapeHtml(entry.title)}</strong></div><em>${escapeHtml(governanceStatusLabel(entry.status))}</em></div>${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ""}<div class="phase8-meta"><span>${escapeHtml(governanceStatusLabel(entry.category))}</span><span class="due-${escapeHtml(due)}">${entry.dueDate ? `${escapeHtml(formatDate(entry.dueDate))} · ${escapeHtml(governanceStatusLabel(due))}` : "No due date"}</span><span>${escapeHtml(entry.ownerName || (entry.ownerUid ? directorName(entry.ownerUid) : "No owner"))}</span>${entry.recurrence ? `<span>${escapeHtml(entry.recurrence)}</span>` : ""}</div><div class="phase8-inline">${entry.sourceDocumentUrl ? `<a href="${escapeHtml(entry.sourceDocumentUrl)}" target="_blank" rel="noopener noreferrer">Open Source Document</a>` : ""}${hasPermission(profile, PERMISSIONS.COMPLIANCE_MANAGE) ? `<button type="button" data-phase8-edit-compliance="${entry.id}">Manage</button>` : ""}</div></article>`;
  }).join("") : '<div class="phase8-empty">No compliance obligations have been entered.</div>';
  return `<div class="phase8-layout"><div class="phase8-list">${cards}</div>${complianceForm()}</div>`;
}

function render() {
  const host = $("#phase8-workspace");
  if (!host || !profile) return;
  renderMetrics();
  document.querySelectorAll("[data-phase8-tab]").forEach((button) => button.classList.toggle("active", button.dataset.phase8Tab === activeTab));
  if (activeTab === "coi") host.innerHTML = renderCoi();
  else if (activeTab === "officers") host.innerHTML = renderOfficers();
  else if (activeTab === "tasks") host.innerHTML = renderTasks();
  else if (activeTab === "compliance") host.innerHTML = renderCompliance();
  else host.innerHTML = renderCommittees();
}

function clearStreams() {
  unsubs.forEach((unsubscribe) => unsubscribe?.());
  unsubs = [];
  committees = disclosures = conflicts = officerTerms = tasks = compliance = directory = [];
}

function bindCollection(name, setter, permitted, queryRef = null) {
  if (!permitted) { setter([]); return; }
  const ref = queryRef || collection(db, name);
  unsubs.push(onSnapshot(ref, (snapshot) => {
    setter(snapshot.docs.map((entry) => ({ id: entry.id, uid: entry.id, ...entry.data() })));
    render();
  }, (error) => console.warn(`Phase 8 ${name} stream unavailable`, error)));
}

function bindStreams() {
  clearStreams();
  const founder = isFounder();
  const visibleDirectory = query(collection(db, "boardDirectory"), where("directoryVisible", "==", true));
  bindCollection("boardDirectory", (value) => { directory = value.sort((a, b) => String(a.directorNumber || "").localeCompare(String(b.directorNumber || ""))); }, true, founder ? collection(db, "boardDirectory") : visibleDirectory);
  bindCollection("committees", (value) => { committees = value.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))); }, hasPermission(profile, PERMISSIONS.COMMITTEES_VIEW));
  const coiReviewer = founder || hasPermission(profile, PERMISSIONS.COI_REVIEW);
  bindCollection("coiDisclosures", (value) => { disclosures = value.sort((a, b) => Number(b.year || 0) - Number(a.year || 0)); }, hasPermission(profile, PERMISSIONS.COI_VIEW), coiReviewer ? collection(db, "coiDisclosures") : query(collection(db, "coiDisclosures"), where("directorUid", "==", auth.currentUser.uid)));
  const conflictManager = founder || hasPermission(profile, PERMISSIONS.COI_REVIEW) || hasPermission(profile, PERMISSIONS.COI_MANAGE);
  bindCollection("conflictRecords", (value) => { conflicts = value.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt)); }, hasPermission(profile, PERMISSIONS.COI_VIEW), conflictManager ? collection(db, "conflictRecords") : query(collection(db, "conflictRecords"), where("directorUid", "==", auth.currentUser.uid)));
  bindCollection("officerTerms", (value) => { officerTerms = value.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt)); }, hasPermission(profile, PERMISSIONS.OFFICERS_VIEW));
  const taskManager = founder || hasPermission(profile, PERMISSIONS.TASKS_MANAGE);
  bindCollection("boardTasks", (value) => { tasks = value.sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"))); }, hasPermission(profile, PERMISSIONS.TASKS_VIEW), taskManager ? collection(db, "boardTasks") : query(collection(db, "boardTasks"), where("ownerUids", "array-contains", auth.currentUser.uid)));
  bindCollection("complianceItems", (value) => { compliance = value.sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"))); }, hasPermission(profile, PERMISSIONS.COMPLIANCE_VIEW));
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

function formOwners(form, field) {
  const inputs = Array.from(form.querySelectorAll(`input[name="${field}"]:checked`));
  return inputs.map((entry) => entry.value);
}

function bindUI() {
  document.addEventListener("click", async (event) => {
    if (event.target.closest('.nav-item[data-view="governance"]')) return queueMicrotask(showGovernanceView);
    const tab = event.target.closest("[data-phase8-tab]")?.dataset.phase8Tab;
    if (tab) { activeTab = tab; return render(); }
    const editCommittee = event.target.closest("[data-phase8-edit-committee]")?.dataset.phase8EditCommittee;
    if (editCommittee) { selectedCommitteeId = editCommittee; return render(); }
    if (event.target.closest('[data-phase8-action="new-committee"]')) { selectedCommitteeId = null; return render(); }
    const review = event.target.closest("[data-phase8-coi-review]");
    if (review) {
      const note = review.dataset.action === "renewal_required" ? window.prompt("What needs to be corrected or renewed?") : null;
      if (review.dataset.action === "renewal_required" && !note) return;
      try { await reviewCoiDisclosure(review.dataset.phase8CoiReview, review.dataset.action, note, profile); } catch (error) { window.alert(error.message); }
      return;
    }
    const resolve = event.target.closest("[data-phase8-resolve-conflict]")?.dataset.phase8ResolveConflict;
    if (resolve) {
      const note = window.prompt("Resolution / management note (optional):") || "";
      try { await resolveConflictRecord(resolve, { status: "resolved", managementPlan: note }, profile); } catch (error) { window.alert(error.message); }
      return;
    }
    const conclude = event.target.closest("[data-phase8-conclude-officer]")?.dataset.phase8ConcludeOfficer;
    if (conclude) {
      const end = window.prompt("Officer term end date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
      if (!end) return;
      try { await concludeOfficerTerm(conclude, end, profile); } catch (error) { window.alert(error.message); }
      return;
    }
    const taskButton = event.target.closest("[data-phase8-task-status]");
    if (taskButton) {
      const status = taskButton.dataset.phase8TaskStatus;
      const completionNote = status === "completed" ? (window.prompt("Completion note (optional):") || "") : "";
      try { await updateBoardTask(taskButton.dataset.taskId, { status, completionNote }, profile); } catch (error) { window.alert(error.message); }
      return;
    }
    const editCompliance = event.target.closest("[data-phase8-edit-compliance]")?.dataset.phase8EditCompliance;
    if (editCompliance) { editingComplianceId = editCompliance; return render(); }
    if (event.target.closest('[data-phase8-action="new-compliance"]')) { editingComplianceId = null; return render(); }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form.id === "phase8-committee-form") {
      event.preventDefault(); const data = new FormData(form); const message = form.querySelector("#phase8-committee-message");
      try { await saveCommittee({ name: data.get("name"), committeeType: data.get("committeeType"), purpose: data.get("purpose"), chairUid: data.get("chairUid"), status: data.get("status"), establishedDate: data.get("establishedDate"), sunsetDate: data.get("sunsetDate"), charterUrl: data.get("charterUrl"), memberUids: formOwners(form, "memberUid") }, profile, selectedCommitteeId); selectedCommitteeId = null; }
      catch (error) { if (message) message.textContent = error.message; }
    } else if (form.id === "phase8-coi-form") {
      event.preventDefault(); const data = new FormData(form); const message = form.querySelector("#phase8-coi-message");
      try { await submitCoiDisclosure({ year: data.get("year"), hasConflicts: data.get("hasConflicts"), disclosureUrl: data.get("disclosureUrl"), summary: data.get("summary") }, profile); form.reset(); }
      catch (error) { if (message) message.textContent = error.message; }
    } else if (form.id === "phase8-conflict-form") {
      event.preventDefault(); const data = new FormData(form); const message = form.querySelector("#phase8-conflict-message"); const uid = data.get("directorUid") || auth.currentUser.uid;
      try { await createConflictRecord({ directorUid: uid, directorName: directorName(uid), entityOrInterest: data.get("entityOrInterest"), relationship: data.get("relationship"), description: data.get("description"), action: data.get("action"), relatedDocumentUrl: data.get("relatedDocumentUrl"), meetingId: data.get("meetingId"), agendaItemId: data.get("agendaItemId"), voteId: data.get("voteId"), managementPlan: data.get("managementPlan") }, profile); form.reset(); }
      catch (error) { if (message) message.textContent = error.message; }
    } else if (form.id === "phase8-officer-form") {
      event.preventDefault(); const data = new FormData(form); const message = form.querySelector("#phase8-officer-message");
      try { await assignOfficer({ directorUid: data.get("directorUid"), officerTitle: data.get("officerTitle"), basis: data.get("basis"), startDate: data.get("startDate"), endDate: data.get("endDate"), relatedMeetingId: data.get("relatedMeetingId"), relatedResolutionId: data.get("relatedResolutionId"), appointmentDocumentUrl: data.get("appointmentDocumentUrl") }, profile); form.reset(); }
      catch (error) { if (message) message.textContent = error.message; }
    } else if (form.id === "phase8-task-form") {
      event.preventDefault(); const data = new FormData(form); const message = form.querySelector("#phase8-task-message"); const owners = formOwners(form, "ownerUid");
      try { await createBoardTask({ title: data.get("title"), description: data.get("description"), priority: data.get("priority"), dueDate: data.get("dueDate"), committeeId: data.get("committeeId"), ownerUids: owners, ownerNames: owners.map(directorName), relatedMeetingId: data.get("relatedMeetingId"), relatedResolutionId: data.get("relatedResolutionId"), relatedDocumentUrl: data.get("relatedDocumentUrl") }, profile); form.reset(); }
      catch (error) { if (message) message.textContent = error.message; }
    } else if (form.id === "phase8-compliance-form") {
      event.preventDefault(); const data = new FormData(form); const message = form.querySelector("#phase8-compliance-message"); const uid = data.get("ownerUid");
      try { await saveComplianceItem({ title: data.get("title"), description: data.get("description"), category: data.get("category"), status: data.get("status"), dueDate: data.get("dueDate"), recurrence: data.get("recurrence"), ownerUid: uid, ownerName: uid ? directorName(uid) : null, authorityOrSource: data.get("authorityOrSource"), sourceDocumentUrl: data.get("sourceDocumentUrl"), completionNote: data.get("completionNote") }, profile, editingComplianceId); editingComplianceId = null; }
      catch (error) { if (message) message.textContent = error.message; }
    }
  });
}

function init() {
  if (initialized) return;
  initialized = true;
  installStyles();
  ensureNavigation();
  ensureView();
  bindUI();
  onAuthStateChanged(auth, async (user) => {
    clearStreams();
    if (!user) { profile = null; return; }
    const next = await loadProfile(user.uid);
    if (!next || next.accountStatus !== "active") { profile = null; return; }
    profile = next;
    if (!canSeePhase8()) return;
    ensureNavigation(); ensureView(); bindStreams(); render();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
