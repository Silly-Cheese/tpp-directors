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
import { listBoardDirectory } from "./board-data.js";
import {
  adjournMeeting,
  calculateQuorum,
  callMeetingToOrder,
  cancelMeeting,
  checkIntoMeeting,
  createBoardMeeting,
  meetingStatusLabel,
  openMeetingCheckIn,
  recessMeeting,
  resumeMeeting,
  updateMeetingAttendance
} from "./meeting-data.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

let currentProfile = null;
let meetings = [];
let directory = [];
let selectedMeetingId = null;
let selectedAttendance = [];
let meetingsUnsubscribe = null;
let attendanceUnsubscribe = null;
let initialized = false;

const $ = (selector) => document.querySelector(selector);

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(value) {
  const millis = timestampValue(value);
  if (!millis) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(millis));
}

function humanize(value = "") {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setMessage(element, message = "") {
  if (element) element.textContent = message;
}

function installStylesheet() {
  if ($('link[data-phase5-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase5.css?v=20260817-dark2";
  link.dataset.phase5Styles = "true";
  document.head.append(link);
}

function ensureMeetingView() {
  const portalMain = $(".portal-main");
  if (!portalMain) return;
  const section = $("#view-meetings") || document.createElement("section");
  const wasConnected = section.isConnected;
  section.id = "view-meetings";
  section.className = "portal-section";
  if (!wasConnected) section.hidden = true;
  section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="eyebrow">LIVE BOARDROOM</p>
        <h2>Meetings, check-in & quorum</h2>
        <p>Create Board meetings, open director check-in, track legal presence, and control the live meeting lifecycle.</p>
      </div>
      <div class="button-row">
        <button id="phase5-refresh" class="secondary-button" type="button">Refresh</button>
        <button id="phase5-open-create" class="primary-button" type="button">Create meeting</button>
      </div>
    </div>

    <article id="phase5-create-panel" class="panel meeting-create-panel" hidden>
      <div class="panel-heading">
        <div><p class="eyebrow">NEW BOARD MEETING</p><h2>Create meeting record</h2></div>
        <button id="phase5-close-create" class="secondary-button" type="button">Close</button>
      </div>
      <form id="phase5-create-form" class="meeting-form" novalidate>
        <div class="meeting-form-row">
          <label>Meeting title<input name="title" maxlength="160" placeholder="Initial Organizational Meeting" required></label>
          <label>Meeting type<select name="type"><option value="regular">Regular</option><option value="special">Special</option><option value="organizational">Organizational</option><option value="emergency">Emergency</option></select></label>
        </div>
        <div class="meeting-form-row">
          <label>Scheduled start<input name="scheduledStart" type="datetime-local" required></label>
          <label>Meeting mode<select name="mode"><option value="in_person">In person</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option></select></label>
        </div>
        <label>Location / connection details<input name="location" maxlength="240" placeholder="Board room, Google Meet link, or other connection details"></label>
        <div class="meeting-form-row">
          <label>Quorum requirement<input name="quorumRequired" type="number" min="1" step="1" placeholder="Default: majority of invited voting directors"></label>
          <label>Notes<input name="notes" maxlength="500" placeholder="Optional meeting setup note"></label>
        </div>
        <fieldset class="permission-fieldset">
          <legend>Invited directors</legend>
          <p>Choose the directors who are entitled to attend this meeting. Voting eligibility is snapshotted when the meeting is created.</p>
          <div id="phase5-invite-grid" class="meeting-invite-grid"></div>
        </fieldset>
        <button type="submit">Create Board Meeting</button>
        <p id="phase5-create-message" class="meeting-form-message" role="status"></p>
      </form>
    </article>

    <div class="meeting-toolbar">
      <div class="meeting-filters">
        <label>Search<input id="phase5-search" type="search" placeholder="Meeting title or number"></label>
        <label>Status<select id="phase5-status-filter"><option value="all">All meetings</option><option value="scheduled">Scheduled</option><option value="checkin_open">Check-in open</option><option value="in_session">In session</option><option value="recessed">Recessed</option><option value="adjourned">Adjourned</option><option value="cancelled">Cancelled</option></select></label>
      </div>
    </div>

    <div class="meeting-layout">
      <div id="phase5-meeting-list" class="meeting-list"><div class="phase5-empty">Loading Board meetings…</div></div>
      <article id="phase5-meeting-detail" class="panel meeting-detail"><div class="phase5-empty">Select a meeting to open the Meeting Room.</div></article>
    </div>`;
  portalMain.append(section);
}

function selectedMeeting() {
  return meetings.find((meeting) => meeting.id === selectedMeetingId) || null;
}

function liveAttendanceSummary(meeting = selectedMeeting()) {
  const voting = new Set(meeting?.votingEligibleUids || []);
  const present = selectedAttendance.filter((entry) => entry.status === "present");
  const votingPresent = present.filter((entry) => voting.has(entry.directorUid));
  const quorumRequired = Math.max(1, Number(meeting?.quorumRequired) || 1);
  return {
    presentCount: present.length,
    votingPresentCount: votingPresent.length,
    quorumRequired,
    quorumAchieved: votingPresent.length >= quorumRequired
  };
}

function renderInviteGrid() {
  const grid = $("#phase5-invite-grid");
  if (!grid) return;
  const candidates = directory.filter((entry) => ["interim", "confirmed", "leave_of_absence"].includes(entry.boardStatus));
  if (!candidates.length) {
    grid.innerHTML = '<div class="phase5-empty">No current Board directory records are available.</div>';
    return;
  }
  grid.innerHTML = candidates.map((entry) => `
    <label class="meeting-invite-option">
      <input type="checkbox" name="invitedDirector" value="${entry.uid}">
      <span><strong>${entry.fullName || "Director"}</strong><small>${entry.directorNumber || "—"} · ${entry.boardRole || "Director"} · ${entry.votingStatus === "ineligible" ? "Non-voting" : "Voting eligible"}</small></span>
    </label>`).join("");
}

function renderMeetingList() {
  const list = $("#phase5-meeting-list");
  if (!list) return;
  const search = String($("#phase5-search")?.value || "").trim().toLowerCase();
  const status = $("#phase5-status-filter")?.value || "all";
  const filtered = meetings.filter((meeting) => {
    if (status !== "all" && meeting.status !== status) return false;
    if (!search) return true;
    return [meeting.title, meeting.meetingNumber, meeting.type].some((value) => String(value || "").toLowerCase().includes(search));
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="phase5-empty">No Board meetings match this view.</div>';
    return;
  }
  list.innerHTML = filtered.map((meeting) => `
    <button class="meeting-card ${meeting.id === selectedMeetingId ? "selected" : ""}" type="button" data-meeting-id="${meeting.id}">
      <div class="meeting-card-top"><strong>${meeting.title || "Board Meeting"}</strong><span class="meeting-status ${meeting.status}">${meetingStatusLabel(meeting.status)}</span></div>
      <small>${meeting.meetingNumber || "BM"} · ${humanize(meeting.type)}</small>
      <small>${formatDateTime(meeting.scheduledStart)}</small>
      <small>${humanize(meeting.mode)} · ${meeting.location || "No location specified"}</small>
    </button>`).join("");
}

function attendanceRow(meeting, entry) {
  const votingEligible = (meeting.votingEligibleUids || []).includes(entry.directorUid);
  const mayManage = hasPermission(currentProfile, PERMISSIONS.MEETINGS_ATTENDANCE_MANAGE)
    && !["adjourned", "cancelled"].includes(meeting.status);
  const status = entry.status || "invited";
  return `<tr>
    <td><strong>${entry.directorName || "Director"}</strong><small>${entry.directorNumber || "—"}</small></td>
    <td>${entry.boardRole || "Director"}</td>
    <td>${votingEligible ? "Eligible" : "Ineligible"}</td>
    <td>${mayManage ? `<select class="attendance-select" data-attendance-uid="${entry.directorUid}">
      ${["invited", "present", "departed", "excused", "absent"].map((value) => `<option value="${value}" ${status === value ? "selected" : ""}>${humanize(value)}</option>`).join("")}
    </select>` : `<span class="attendance-${status}">${humanize(status)}</span>`}</td>
  </tr>`;
}

function renderMeetingDetail() {
  const container = $("#phase5-meeting-detail");
  if (!container) return;
  const meeting = selectedMeeting();
  if (!meeting) {
    container.innerHTML = '<div class="phase5-empty">Select a meeting to open the Meeting Room.</div>';
    return;
  }

  const summary = liveAttendanceSummary(meeting);
  const ownAttendance = selectedAttendance.find((entry) => entry.directorUid === currentProfile?.uid);
  const invited = (meeting.invitedDirectorUids || []).includes(currentProfile?.uid);
  const mayCheckIn = invited && ["checkin_open", "in_session", "recessed"].includes(meeting.status)
    && ownAttendance?.status !== "present";
  const mayControl = hasPermission(currentProfile, PERMISSIONS.MEETINGS_CONTROL);
  const mayActivate = hasPermission(currentProfile, PERMISSIONS.MEETINGS_ACTIVATE);
  const locked = ["adjourned", "cancelled"].includes(meeting.status);

  const controls = [];
  if (mayActivate && meeting.status === "scheduled") controls.push('<button class="meeting-primary-button" data-meeting-action="activate">Open Check-In</button>');
  if (mayControl && meeting.status === "checkin_open") controls.push('<button class="meeting-primary-button" data-meeting-action="call">Call to Order</button>');
  if (mayControl && meeting.status === "in_session") controls.push('<button class="meeting-secondary-button" data-meeting-action="recess">Call Recess</button>');
  if (mayControl && meeting.status === "recessed") controls.push('<button class="meeting-primary-button" data-meeting-action="resume">Resume Meeting</button>');
  if (mayControl && ["checkin_open", "in_session", "recessed"].includes(meeting.status)) controls.push('<button class="meeting-danger-button" data-meeting-action="adjourn">Adjourn Meeting</button>');
  if (mayControl && ["scheduled", "checkin_open"].includes(meeting.status)) controls.push('<button class="meeting-danger-button" data-meeting-action="cancel">Cancel Meeting</button>');

  container.innerHTML = `
    <div class="meeting-detail-head">
      <div><p class="eyebrow">${meeting.meetingNumber || "BOARD MEETING"}</p><h2>${meeting.title || "Board Meeting"}</h2><p>${formatDateTime(meeting.scheduledStart)} · ${humanize(meeting.type)}</p></div>
      <span class="meeting-status ${meeting.status}">${meetingStatusLabel(meeting.status)}</span>
    </div>
    <div class="meeting-live-strip">
      <div><span>Invited</span><strong>${meeting.invitedCount || (meeting.invitedDirectorUids || []).length}</strong></div>
      <div><span>Present</span><strong>${summary.presentCount}</strong></div>
      <div><span>Voting Present</span><strong>${summary.votingPresentCount}</strong></div>
      <div><span>Quorum</span><strong class="${summary.quorumAchieved ? "quorum-achieved" : "quorum-not-achieved"}">${summary.votingPresentCount}/${summary.quorumRequired}</strong></div>
    </div>
    <div class="phase5-live-meta"><span class="phase5-live-dot"></span><strong>Live Boardroom</strong><span>Live Firestore updates enabled.</span></div>
    <dl class="detail-list">
      <div><dt>Mode</dt><dd>${humanize(meeting.mode)}</dd></div>
      <div><dt>Location / connection</dt><dd>${meeting.location || "Not specified"}</dd></div>
      <div><dt>Quorum requirement</dt><dd>${meeting.quorumRequired} voting-eligible director${Number(meeting.quorumRequired) === 1 ? "" : "s"}</dd></div>
      <div><dt>Created by</dt><dd>${meeting.createdByName || "Director"}</dd></div>
    </dl>
    ${invited ? `<div class="meeting-self-checkin"><div><strong>${ownAttendance?.status === "present" ? "You are checked in." : locked ? "This meeting is closed." : meeting.status === "scheduled" ? "Check-in is closed." : "Your roster status is " + humanize(ownAttendance?.status || "invited") + "."}</strong><span>${ownAttendance?.status === "present" ? "Your presence is included in the live quorum calculation." : "Your roster status is " + humanize(ownAttendance?.status || "invited") + "."}</span></div>${mayCheckIn ? '<button class="meeting-primary-button" data-meeting-action="self-checkin">Check In</button>' : ""}</div>` : ""}
    ${controls.length ? `<div class="meeting-actions">${controls.join("")}</div>` : ""}
    <div class="panel-heading"><div><p class="eyebrow">LIVE ATTENDANCE</p><h2>Director roster</h2></div><span class="count-badge">${selectedAttendance.length}</span></div>
    <div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>Director</th><th>Board role</th><th>Voting</th><th>Attendance</th></tr></thead><tbody>${selectedAttendance.map((entry) => attendanceRow(meeting, entry)).join("") || '<tr><td colspan="4">No attendance records are available.</td></tr>'}</tbody></table></div>
    <p id="phase5-action-message" class="meeting-form-message" role="status"></p>
    <section id="phase6-meeting-workspace" class="phase6-host" data-meeting-id="${meeting.id}"><div class="phase6-empty">Loading agenda, motions, and voting…</div></section>`;
  window.__TPP_SELECTED_MEETING_ID__ = meeting.id;
  queueMicrotask(() => window.dispatchEvent(new CustomEvent("tpp:meeting-selected", { detail: { meetingId: meeting.id } })));
}

function subscribeAttendance(meetingId) {
  if (attendanceUnsubscribe) attendanceUnsubscribe();
  selectedAttendance = [];
  renderMeetingDetail();
  if (!meetingId) return;
  const attendanceQuery = query(collection(db, "meetingAttendance"), where("meetingId", "==", meetingId));
  attendanceUnsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
    selectedAttendance = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => String(a.directorName || "").localeCompare(String(b.directorName || "")));
    renderMeetingDetail();
  }, (error) => {
    console.warn("Meeting attendance listener closed", error);
    setMessage($("#phase5-action-message"), error.message || "Attendance could not be refreshed.");
  });
}

function subscribeMeetings() {
  if (meetingsUnsubscribe) meetingsUnsubscribe();
  meetingsUnsubscribe = onSnapshot(collection(db, "meetings"), (snapshot) => {
    meetings = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => timestampValue(b.scheduledStart) - timestampValue(a.scheduledStart));
    if (selectedMeetingId && !meetings.some((meeting) => meeting.id === selectedMeetingId)) selectedMeetingId = null;
    if (!selectedMeetingId && meetings.length) selectedMeetingId = meetings.find((meeting) => ["checkin_open", "in_session", "recessed"].includes(meeting.status))?.id || meetings[0].id;
    renderMeetingList();
    renderMeetingDetail();
    if (selectedMeetingId) subscribeAttendance(selectedMeetingId);
  }, (error) => {
    console.warn("Meeting listener closed", error);
    const list = $("#phase5-meeting-list");
    if (list) list.innerHTML = `<div class="phase5-empty">${error.message || "Board meetings could not be loaded."}</div>`;
  });
}

async function handleMeetingAction(action) {
  const meeting = selectedMeeting();
  if (!meeting) return;
  const message = $("#phase5-action-message");
  setMessage(message, "");
  try {
    if (action === "activate") await openMeetingCheckIn(meeting.id, currentProfile);
    if (action === "call") await callMeetingToOrder(meeting.id, currentProfile);
    if (action === "recess") await recessMeeting(meeting.id, currentProfile);
    if (action === "resume") await resumeMeeting(meeting.id, currentProfile);
    if (action === "adjourn") await adjournMeeting(meeting.id, currentProfile);
    if (action === "cancel") await cancelMeeting(meeting.id, currentProfile);
    if (action === "self-checkin") await checkIntoMeeting(meeting.id, currentProfile);
  } catch (error) {
    console.error(error);
    setMessage(message, error.message || "The meeting action could not be completed.");
  }
}

async function handleCreateMeeting(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#phase5-create-message");
  const data = new FormData(form);
  const invitedDirectorUids = data.getAll("invitedDirector");
  setMessage(message, "Creating meeting…");
  try {
    const created = await createBoardMeeting({
      title: data.get("title"),
      type: data.get("type"),
      scheduledStart: data.get("scheduledStart"),
      mode: data.get("mode"),
      location: data.get("location"),
      quorumRequired: data.get("quorumRequired"),
      notes: data.get("notes"),
      invitedDirectorUids,
      directory
    }, currentProfile);
    form.reset();
    renderInviteGrid();
    $("#phase5-create-panel").hidden = true;
    selectedMeetingId = created.id;
    subscribeAttendance(created.id);
  } catch (error) {
    console.error(error);
    setMessage(message, error.message || "The meeting could not be created.");
  }
}

function bindEvents() {
  $("#phase5-refresh")?.addEventListener("click", () => subscribeMeetings());
  $("#phase5-open-create")?.addEventListener("click", () => { $("#phase5-create-panel").hidden = false; });
  $("#phase5-close-create")?.addEventListener("click", () => { $("#phase5-create-panel").hidden = true; });
  $("#phase5-create-form")?.addEventListener("submit", handleCreateMeeting);
  $("#phase5-search")?.addEventListener("input", renderMeetingList);
  $("#phase5-status-filter")?.addEventListener("change", renderMeetingList);
  $("#phase5-meeting-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-meeting-id]");
    if (!button) return;
    selectedMeetingId = button.dataset.meetingId;
    renderMeetingList();
    subscribeAttendance(selectedMeetingId);
  });
  $("#phase5-meeting-detail")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-meeting-action]");
    if (button) handleMeetingAction(button.dataset.meetingAction);
  });
  $("#phase5-meeting-detail")?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-attendance-uid]");
    if (!select) return;
    updateMeetingAttendance(selectedMeetingId, select.dataset.attendanceUid, select.value, currentProfile).catch((error) => {
      console.error(error);
      setMessage($("#phase5-action-message"), error.message || "Attendance could not be updated.");
    });
  });
}

async function initialize(profile) {
  if (initialized) return;
  initialized = true;
  currentProfile = profile;
  installStylesheet();
  ensureMeetingView();
  directory = await listBoardDirectory(profile).catch(() => []);
  renderInviteGrid();
  bindEvents();
  subscribeMeetings();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const snapshot = await getDoc(doc(db, "directors", user.uid));
  if (!snapshot.exists()) return;
  const profile = { uid: snapshot.id, ...snapshot.data() };
  if (!hasPermission(profile, PERMISSIONS.MEETINGS_VIEW)) return;
  initialize(profile).catch((error) => console.error("Phase 5 could not initialize", error));
});
