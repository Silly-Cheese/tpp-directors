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
  link.href = "./phase5.css";
  link.dataset.phase5Styles = "true";
  document.head.append(link);
}

function ensureMeetingView() {
  if ($("#view-meetings")) return;
  const portalMain = $(".portal-main");
  if (!portalMain) return;

  const section = document.createElement("section");
  section.id = "view-meetings";
  section.className = "portal-section meeting-phase5-shell";
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="eyebrow">BOARD MEETINGS</p>
        <h2>Meeting Room</h2>
        <p>Schedule Board meetings, activate director check-in, track attendance, establish quorum, and control the live meeting lifecycle.</p>
      </div>
      <button id="meeting-create-button" class="meeting-primary-button" type="button">Schedule Meeting</button>
    </div>

    <div class="meeting-metrics">
      <div class="meeting-metric"><span>Meetings</span><strong id="meeting-metric-total">0</strong></div>
      <div class="meeting-metric"><span>Upcoming</span><strong id="meeting-metric-upcoming">0</strong></div>
      <div class="meeting-metric"><span>Check-In Open</span><strong id="meeting-metric-checkin">0</strong></div>
      <div class="meeting-metric"><span>Live / Recessed</span><strong id="meeting-metric-live">0</strong></div>
    </div>

    <article id="meeting-create-panel" class="panel meeting-create-panel" hidden>
      <div class="panel-heading">
        <div><p class="eyebrow">NEW BOARD MEETING</p><h2>Schedule meeting</h2></div>
        <button id="meeting-create-close" class="meeting-secondary-button" type="button">Close</button>
      </div>
      <form id="meeting-create-form" class="meeting-form" novalidate>
        <label>Meeting title<input name="title" maxlength="140" placeholder="Regular Meeting of the Board of Directors" required></label>
        <div class="meeting-form-row">
          <label>Meeting type
            <select name="meetingType">
              <option value="regular">Regular</option>
              <option value="special">Special</option>
              <option value="organizational">Organizational</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
          <label>Date and time<input name="scheduledFor" type="datetime-local" required></label>
        </div>
        <div class="meeting-form-row">
          <label>Meeting mode
            <select name="locationMode">
              <option value="in_person">In person</option>
              <option value="virtual">Virtual</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label>Location / connection note<input name="locationLabel" maxlength="180" placeholder="Board Room, Google Meet link description, etc."></label>
        </div>
        <label>Quorum required
          <input name="quorumRequired" type="number" min="1" step="1" placeholder="Leave blank for majority of invited voting-eligible directors">
        </label>
        <div>
          <label>Invited directors</label>
          <div id="meeting-invite-grid" class="meeting-invite-grid"><div class="phase5-empty">Loading Board directory…</div></div>
        </div>
        <button class="meeting-primary-button" type="submit">Create Scheduled Meeting</button>
        <p id="meeting-create-message" class="meeting-form-message" role="status"></p>
      </form>
    </article>

    <div class="meeting-toolbar">
      <div class="meeting-filters">
        <label>Search<input id="meeting-search" type="search" placeholder="Meeting title or number"></label>
        <label>Status
          <select id="meeting-status-filter">
            <option value="all">All meetings</option>
            <option value="scheduled">Scheduled</option>
            <option value="checkin_open">Check-in open</option>
            <option value="in_session">In session</option>
            <option value="recessed">Recessed</option>
            <option value="adjourned">Adjourned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <button id="meeting-refresh-button" class="meeting-secondary-button" type="button">Refresh</button>
    </div>

    <div class="meeting-layout">
      <div id="meeting-list" class="meeting-list"><div class="phase5-empty">Loading Board meetings…</div></div>
      <article id="meeting-detail" class="panel meeting-detail"><div class="phase5-empty">Select a meeting to view its live Boardroom.</div></article>
    </div>`;
  portalMain.append(section);

  const overview = $("#view-overview");
  if (overview && !$("#phase5-dashboard-meeting")) {
    const banner = document.createElement("div");
    banner.id = "phase5-dashboard-meeting";
    banner.className = "meeting-phase5-banner";
    banner.hidden = true;
    banner.innerHTML = `<div><strong id="phase5-dashboard-meeting-title">Board meeting</strong><span id="phase5-dashboard-meeting-copy"></span></div><button id="phase5-dashboard-meeting-open" class="meeting-secondary-button" type="button">Open Meeting Room</button>`;
    overview.prepend(banner);
  }
}

function meetingNav() {
  return $('.nav-item[data-view="meetings"]');
}

function showMeetingView() {
  document.querySelectorAll(".portal-section").forEach((section) => { section.hidden = section.id !== "view-meetings"; });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === "meetings"));
  const title = $("#view-title");
  if (title) title.textContent = "Board Meetings";
  $("#view-meetings").hidden = false;
  renderMeetings();
}

function installNavigationBridge() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest(".nav-item[data-view]");
    if (!nav) return;
    if (nav.dataset.view === "meetings") {
      if (!currentProfile || !hasPermission(currentProfile, PERMISSIONS.MEETINGS_VIEW)) return;
      showMeetingView();
    } else {
      const meetingView = $("#view-meetings");
      if (meetingView) meetingView.hidden = true;
    }
  });

  $("#phase5-dashboard-meeting-open")?.addEventListener("click", () => showMeetingView());
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

async function refreshDirectory() {
  if (!currentProfile || (!isFounder(currentProfile) && !hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW))) {
    directory = [];
    renderInviteChoices();
    return;
  }
  try {
    directory = await listBoardDirectory(currentProfile);
  } catch (error) {
    console.warn("Unable to load meeting directory", error);
    directory = [];
  }
  renderInviteChoices();
}

function currentBoardDirectory() {
  return directory.filter((entry) => ["interim", "confirmed", "leave_of_absence"].includes(entry.boardStatus));
}

function renderInviteChoices() {
  const grid = $("#meeting-invite-grid");
  if (!grid) return;
  const entries = currentBoardDirectory();
  grid.replaceChildren();
  if (!entries.length) {
    grid.innerHTML = '<div class="phase5-empty">No current Board directory records are available.</div>';
    return;
  }
  entries.forEach((entry) => {
    const label = document.createElement("label");
    label.className = "meeting-invite-option";
    label.innerHTML = `<input type="checkbox" name="meetingInvitee" checked><span><strong></strong><small></small></span>`;
    const input = label.querySelector("input");
    input.value = entry.uid;
    label.querySelector("strong").textContent = entry.displayName || entry.fullName || "Director";
    label.querySelector("small").textContent = `${entry.directorNumber || "Board"} · ${entry.votingStatus === "ineligible" ? "Non-voting" : "Voting eligible"}`;
    grid.append(label);
  });
}

function bindMeetingStream() {
  if (meetingsUnsubscribe) meetingsUnsubscribe();
  if (!currentProfile || !hasPermission(currentProfile, PERMISSIONS.MEETINGS_VIEW)) return;

  meetingsUnsubscribe = onSnapshot(collection(db, "meetings"), (snapshot) => {
    meetings = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => timestampValue(b.scheduledFor) - timestampValue(a.scheduledFor));

    if (!selectedMeetingId || !meetings.some((entry) => entry.id === selectedMeetingId)) {
      const priority = meetings.find((entry) => ["in_session", "checkin_open", "recessed"].includes(entry.status))
        || meetings.find((entry) => entry.status === "scheduled")
        || meetings[0];
      selectedMeetingId = priority?.id || null;
      bindAttendanceStream();
    }
    renderMeetings();
    renderDashboardMeetingBanner();
  }, (error) => {
    console.warn("Meeting stream unavailable", error);
    const list = $("#meeting-list");
    if (list) list.innerHTML = '<div class="phase5-empty">The Board meeting list could not be loaded.</div>';
  });
}

function bindAttendanceStream() {
  if (attendanceUnsubscribe) attendanceUnsubscribe();
  selectedAttendance = [];
  if (!selectedMeetingId || !currentProfile || !hasPermission(currentProfile, PERMISSIONS.MEETINGS_VIEW)) {
    renderMeetingDetail();
    return;
  }
  attendanceUnsubscribe = onSnapshot(
    query(collection(db, "meetingAttendance"), where("meetingId", "==", selectedMeetingId)),
    (snapshot) => {
      selectedAttendance = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => String(a.directorNumber || a.directorName || "").localeCompare(String(b.directorNumber || b.directorName || "")));
      renderMeetingDetail();
      renderDashboardMeetingBanner();
    },
    (error) => {
      console.warn("Attendance stream unavailable", error);
      selectedAttendance = [];
      renderMeetingDetail();
    }
  );
}

function selectedMeeting() {
  return meetings.find((entry) => entry.id === selectedMeetingId) || null;
}

function renderMeetingMetrics() {
  const now = Date.now();
  $("#meeting-metric-total").textContent = String(meetings.length);
  $("#meeting-metric-upcoming").textContent = String(meetings.filter((entry) => entry.status === "scheduled" && timestampValue(entry.scheduledFor) >= now).length);
  $("#meeting-metric-checkin").textContent = String(meetings.filter((entry) => entry.status === "checkin_open").length);
  $("#meeting-metric-live").textContent = String(meetings.filter((entry) => ["in_session", "recessed"].includes(entry.status)).length);
}

function filteredMeetings() {
  const search = String($("#meeting-search")?.value || "").trim().toLowerCase();
  const status = $("#meeting-status-filter")?.value || "all";
  return meetings.filter((meeting) => {
    if (status !== "all" && meeting.status !== status) return false;
    if (!search) return true;
    return [meeting.title, meeting.meetingNumber, meeting.meetingType, meeting.locationLabel].some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function renderMeetingList() {
  const list = $("#meeting-list");
  if (!list) return;
  list.replaceChildren();
  const entries = filteredMeetings();
  if (!entries.length) {
    list.innerHTML = '<div class="phase5-empty">No Board meetings match this view.</div>';
    return;
  }
  entries.forEach((meeting) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `meeting-card${meeting.id === selectedMeetingId ? " selected" : ""}`;
    button.dataset.meetingId = meeting.id;
    button.innerHTML = `<div class="meeting-card-top"><div><strong></strong><small class="meeting-number"></small></div><span class="meeting-status"></span></div><small class="meeting-date"></small><small class="meeting-location"></small>`;
    button.querySelector("strong").textContent = meeting.title || "Board Meeting";
    button.querySelector(".meeting-number").textContent = `${meeting.meetingNumber || "BM"} · ${humanize(meeting.meetingType)}`;
    const status = button.querySelector(".meeting-status");
    status.textContent = meetingStatusLabel(meeting.status);
    status.classList.add(meeting.status);
    button.querySelector(".meeting-date").textContent = formatDateTime(meeting.scheduledFor);
    button.querySelector(".meeting-location").textContent = `${humanize(meeting.locationMode)}${meeting.locationLabel ? ` · ${meeting.locationLabel}` : ""}`;
    list.append(button);
  });
}

function presenceLabel(status) {
  return humanize(status || "invited");
}

function renderAttendanceTable(meeting) {
  const canManage = hasPermission(currentProfile, PERMISSIONS.MEETINGS_ATTENDANCE_MANAGE)
    && !["adjourned", "cancelled"].includes(meeting.status);
  const baseStatuses = meeting.status === "scheduled"
    ? ["invited", "excused"]
    : ["invited", "present", "departed", "excused", "absent"];

  const rows = selectedAttendance.map((entry) => {
    const statusClass = `attendance-${entry.presenceStatus || "invited"}`;
    const statuses = baseStatuses.includes(entry.presenceStatus) ? baseStatuses : [entry.presenceStatus, ...baseStatuses];
    const control = canManage
      ? `<select class="attendance-select" data-attendance-uid="${entry.directorUid}">
          ${statuses.map((status) => `<option value="${status}"${entry.presenceStatus === status ? " selected" : ""}>${presenceLabel(status)}</option>`).join("")}
        </select>`
      : `<span class="${statusClass}">${presenceLabel(entry.presenceStatus)}</span>`;
    return `<tr><td><strong>${escapeHtml(entry.directorName || "Director")}</strong><small>${escapeHtml(entry.directorNumber || "")}</small></td><td>${escapeHtml(entry.boardRole || "Director")}</td><td>${entry.votingEligible ? "Eligible" : "Ineligible"}</td><td>${control}</td></tr>`;
  }).join("");

  return `<div class="attendance-table-wrap"><table class="attendance-table"><thead><tr><th>Director</th><th>Board Role</th><th>Voting</th><th>Attendance</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No attendance records.</td></tr>'}</tbody></table></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMeetingControls(meeting) {
  const controls = [];
  const canActivate = hasPermission(currentProfile, PERMISSIONS.MEETINGS_ACTIVATE);
  const canControl = hasPermission(currentProfile, PERMISSIONS.MEETINGS_CONTROL);

  if (meeting.status === "scheduled" && canActivate) controls.push('<button class="meeting-primary-button" data-meeting-action="activate">Activate / Open Check-In</button>');
  if (meeting.status === "scheduled" && canControl) controls.push('<button class="meeting-danger-button" data-meeting-action="cancel">Cancel Meeting</button>');
  if (meeting.status === "checkin_open" && canControl) {
    controls.push('<button class="meeting-primary-button" data-meeting-action="call-order">Call to Order</button>');
    controls.push('<button class="meeting-danger-button" data-meeting-action="cancel">Cancel Meeting</button>');
  }
  if (meeting.status === "in_session" && canControl) {
    controls.push('<button class="meeting-secondary-button" data-meeting-action="recess">Call Recess</button>');
    controls.push('<button class="meeting-danger-button" data-meeting-action="adjourn">Adjourn Meeting</button>');
  }
  if (meeting.status === "recessed" && canControl) {
    controls.push('<button class="meeting-primary-button" data-meeting-action="resume">Resume Meeting</button>');
    controls.push('<button class="meeting-danger-button" data-meeting-action="adjourn">Adjourn Meeting</button>');
  }
  return controls.join("");
}

function renderSelfCheckIn(meeting) {
  const uid = auth.currentUser?.uid;
  const own = selectedAttendance.find((entry) => entry.directorUid === uid);
  if (!own) return '<div class="meeting-self-checkin"><div><strong>You are not on this meeting roster.</strong><span>Attendance actions are unavailable for this meeting.</span></div></div>';

  if (!["checkin_open", "in_session", "recessed"].includes(meeting.status)) {
    return `<div class="meeting-self-checkin"><div><strong>Check-in is ${meeting.status === "scheduled" ? "not open yet" : "closed"}.</strong><span>Your roster status is ${presenceLabel(own.presenceStatus)}.</span></div></div>`;
  }

  if (own.presenceStatus === "present") {
    return '<div class="meeting-self-checkin"><div><strong>Checked in ✓</strong><span>You are currently counted as present for this meeting.</span></div></div>';
  }
  if (["excused", "absent"].includes(own.presenceStatus)) {
    return `<div class="meeting-self-checkin"><div><strong>Attendance status: ${presenceLabel(own.presenceStatus)}</strong><span>An authorized attendance manager must change this status before self check-in is available.</span></div></div>`;
  }

  return `<div class="meeting-self-checkin"><div><strong>${own.presenceStatus === "departed" ? "Return to the meeting" : "Director check-in is open"}</strong><span>Check in from this device to be counted as present.</span></div><button class="meeting-primary-button" data-meeting-action="self-checkin">${own.presenceStatus === "departed" ? "Check Back In" : "Check In"}</button></div>`;
}

function renderMeetingDetail() {
  const panel = $("#meeting-detail");
  if (!panel) return;
  const meeting = selectedMeeting();
  if (!meeting) {
    panel.innerHTML = '<div class="phase5-empty">Select a meeting to view its live Boardroom.</div>';
    return;
  }

  const quorum = calculateQuorum(meeting, selectedAttendance);
  const presentCount = selectedAttendance.filter((entry) => entry.presenceStatus === "present").length;
  panel.innerHTML = `
    <div class="meeting-detail-head">
      <div><p class="eyebrow">${escapeHtml(meeting.meetingNumber || "BOARD MEETING")}</p><h2>${escapeHtml(meeting.title || "Board Meeting")}</h2><p>${escapeHtml(formatDateTime(meeting.scheduledFor))} · ${escapeHtml(humanize(meeting.meetingType))}</p></div>
      <span class="meeting-status ${escapeHtml(meeting.status)}">${escapeHtml(meetingStatusLabel(meeting.status))}</span>
    </div>
    <div class="meeting-live-strip">
      <div><span>Invited</span><strong>${meeting.invitedDirectorUids?.length || 0}</strong></div>
      <div><span>Present</span><strong>${presentCount}</strong></div>
      <div><span>Voting Present</span><strong>${quorum.presentEligible}</strong></div>
      <div><span>Quorum</span><strong class="${quorum.achieved ? "quorum-achieved" : "quorum-not-achieved"}">${quorum.achieved ? "ACHIEVED" : `${quorum.presentEligible}/${quorum.required}`}</strong></div>
    </div>
    <dl class="detail-list">
      <div><dt>Mode</dt><dd>${escapeHtml(humanize(meeting.locationMode))}</dd></div>
      <div><dt>Location / connection</dt><dd>${escapeHtml(meeting.locationLabel || "Not specified")}</dd></div>
      <div><dt>Quorum requirement</dt><dd>${quorum.required} voting-eligible director${quorum.required === 1 ? "" : "s"}</dd></div>
      <div><dt>Created by</dt><dd>${escapeHtml(meeting.createdByName || "Board administrator")}</dd></div>
    </dl>
    ${renderSelfCheckIn(meeting)}
    <div class="meeting-actions">${renderMeetingControls(meeting)}</div>
    <div class="panel-heading"><div><p class="eyebrow">LIVE ATTENDANCE</p><h2>Director roster</h2></div></div>
    ${renderAttendanceTable(meeting)}
    <p id="meeting-action-message" class="meeting-form-message" role="status"></p>`;
}

function renderMeetings() {
  if (!initialized) return;
  const createButton = $("#meeting-create-button");
  if (createButton) createButton.hidden = !currentProfile || !hasPermission(currentProfile, PERMISSIONS.MEETINGS_CREATE);
  renderMeetingMetrics();
  renderMeetingList();
  renderMeetingDetail();
}

function renderDashboardMeetingBanner() {
  const banner = $("#phase5-dashboard-meeting");
  if (!banner || !currentProfile || !hasPermission(currentProfile, PERMISSIONS.MEETINGS_VIEW)) {
    if (banner) banner.hidden = true;
    return;
  }

  const active = meetings.find((entry) => ["in_session", "checkin_open", "recessed"].includes(entry.status));
  const upcoming = meetings
    .filter((entry) => entry.status === "scheduled" && timestampValue(entry.scheduledFor) >= Date.now())
    .sort((a, b) => timestampValue(a.scheduledFor) - timestampValue(b.scheduledFor))[0];
  const meeting = active || upcoming;
  if (!meeting) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  $("#phase5-dashboard-meeting-title").textContent = active ? `${meetingStatusLabel(meeting.status)} — ${meeting.title}` : `Upcoming — ${meeting.title}`;
  if (active && selectedMeetingId === meeting.id) {
    const quorum = calculateQuorum(meeting, selectedAttendance);
    $("#phase5-dashboard-meeting-copy").textContent = `${meeting.meetingNumber} · ${quorum.achieved ? "Quorum achieved" : `Quorum ${quorum.presentEligible}/${quorum.required}`} · ${formatDateTime(meeting.scheduledFor)}`;
  } else {
    $("#phase5-dashboard-meeting-copy").textContent = `${meeting.meetingNumber} · ${meetingStatusLabel(meeting.status)} · ${formatDateTime(meeting.scheduledFor)}`;
  }
}

async function createMeetingFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#meeting-create-message");
  const data = new FormData(form);
  const rawSchedule = String(data.get("scheduledFor") || "");
  const scheduledFor = rawSchedule ? new Date(rawSchedule).toISOString() : "";
  const invitedDirectorUids = Array.from(form.querySelectorAll('input[name="meetingInvitee"]:checked')).map((input) => input.value);

  button.disabled = true;
  button.textContent = "Creating…";
  setMessage(message);
  try {
    const meeting = await createBoardMeeting({
      title: data.get("title"),
      meetingType: data.get("meetingType"),
      scheduledFor,
      locationMode: data.get("locationMode"),
      locationLabel: data.get("locationLabel"),
      quorumRequired: data.get("quorumRequired"),
      invitedDirectorUids
    }, currentProfile, directory);
    form.reset();
    renderInviteChoices();
    $("#meeting-create-panel").hidden = true;
    selectedMeetingId = meeting.id;
    bindAttendanceStream();
  } catch (error) {
    console.error("Unable to create meeting", error);
    setMessage(message, error.message || "The meeting could not be created.");
  } finally {
    button.disabled = false;
    button.textContent = "Create Scheduled Meeting";
  }
}

async function performMeetingAction(action) {
  const meeting = selectedMeeting();
  if (!meeting) return;
  const message = $("#meeting-action-message");
  setMessage(message);
  try {
    if (action === "activate") await openMeetingCheckIn(meeting.id, currentProfile);
    else if (action === "call-order") await callMeetingToOrder(meeting.id, currentProfile);
    else if (action === "recess") await recessMeeting(meeting.id, currentProfile);
    else if (action === "resume") await resumeMeeting(meeting.id, currentProfile);
    else if (action === "adjourn") await adjournMeeting(meeting.id, currentProfile);
    else if (action === "cancel") await cancelMeeting(meeting.id, currentProfile);
    else if (action === "self-checkin") await checkIntoMeeting(meeting.id, currentProfile);
  } catch (error) {
    console.error("Meeting action failed", error);
    setMessage(message, error.message || "The meeting action could not be completed.");
  }
}

async function handleAttendanceChange(select) {
  const meeting = selectedMeeting();
  if (!meeting) return;
  select.disabled = true;
  try {
    await updateMeetingAttendance(meeting.id, select.dataset.attendanceUid, select.value, currentProfile);
  } catch (error) {
    console.error("Attendance update failed", error);
    setMessage($("#meeting-action-message"), error.message || "Attendance could not be updated.");
  } finally {
    select.disabled = false;
  }
}

function bindUI() {
  meetingNav()?.addEventListener("click", () => {
    if (currentProfile && hasPermission(currentProfile, PERMISSIONS.MEETINGS_VIEW)) showMeetingView();
  });
  $("#meeting-create-button")?.addEventListener("click", () => {
    $("#meeting-create-panel").hidden = false;
    refreshDirectory();
  });
  $("#meeting-create-close")?.addEventListener("click", () => { $("#meeting-create-panel").hidden = true; });
  $("#meeting-create-form")?.addEventListener("submit", createMeetingFromForm);
  $("#meeting-search")?.addEventListener("input", renderMeetingList);
  $("#meeting-status-filter")?.addEventListener("change", renderMeetingList);
  $("#meeting-refresh-button")?.addEventListener("click", () => {
    refreshDirectory();
    renderMeetings();
  });
  $("#meeting-list")?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-meeting-id]");
    if (!card) return;
    selectedMeetingId = card.dataset.meetingId;
    bindAttendanceStream();
    renderMeetingList();
  });
  $("#meeting-detail")?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-meeting-action]")?.dataset.meetingAction;
    if (action) performMeetingAction(action);
  });
  $("#meeting-detail")?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-attendance-uid]");
    if (select) handleAttendanceChange(select);
  });
  installNavigationBridge();
}

function tearDownStreams() {
  if (meetingsUnsubscribe) meetingsUnsubscribe();
  if (attendanceUnsubscribe) attendanceUnsubscribe();
  meetingsUnsubscribe = null;
  attendanceUnsubscribe = null;
  meetings = [];
  selectedAttendance = [];
  selectedMeetingId = null;
}

async function applyAuthUser(user) {
  if (!user) {
    currentProfile = null;
    tearDownStreams();
    const nav = meetingNav();
    if (nav) nav.hidden = true;
    renderDashboardMeetingBanner();
    return;
  }
  const profile = await loadProfile(user.uid);
  if (!profile || profile.accountStatus !== "active") return;
  currentProfile = profile;
  const nav = meetingNav();
  const canView = hasPermission(profile, PERMISSIONS.MEETINGS_VIEW);
  if (nav) nav.hidden = !canView;
  if (!canView) {
    tearDownStreams();
    return;
  }
  await refreshDirectory();
  bindMeetingStream();
}

function init() {
  if (initialized) return;
  initialized = true;
  installStylesheet();
  ensureMeetingView();
  bindUI();
  onAuthStateChanged(auth, (user) => applyAuthUser(user).catch((error) => console.error("Phase 5 auth initialization failed", error)));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
