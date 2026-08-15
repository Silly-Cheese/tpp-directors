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
  certifyMeetingRecord,
  getCertifiedRecordEntries,
  markMinutesReady,
  minutesStatusLabel,
  returnMinutesToDraft,
  saveMinutesDraft,
  summarizeCertifiedRecord
} from "./minutes-data.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

const $ = (selector) => document.querySelector(selector);
let profile = null;
let selectedMeetingId = null;
let meeting = null;
let minutes = null;
let records = [];
let selectedRecordId = null;
let selectedRecordEntries = [];
let meetingUnsub = null;
let minutesUnsub = null;
let recordsUnsub = null;
let observer = null;
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
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(value) {
  const millis = timestampValue(value);
  if (!millis) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  }).format(new Date(millis));
}

function humanize(value = "") {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function installStylesheet() {
  if ($('link[data-phase7-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase7.css";
  link.dataset.phase7Styles = "true";
  document.head.append(link);
}

function ensureRecordsNavigation() {
  if ($('.nav-item[data-view="records"]')) return;
  const resolutions = $('.nav-item[data-view="resolutions"]');
  if (!resolutions) return;
  const button = document.createElement("button");
  button.className = "nav-item";
  button.type = "button";
  button.dataset.view = "records";
  button.textContent = "Board Records";
  resolutions.after(button);
}

function ensureRecordsView() {
  if ($("#view-records")) return;
  const main = $(".portal-main");
  if (!main) return;
  const section = document.createElement("section");
  section.id = "view-records";
  section.className = "portal-section phase7-records-shell";
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading-row">
      <div><p class="eyebrow">PERMANENT BOARD RECORDS</p><h2>Certified Meeting Records</h2><p>Certified records preserve the meeting, minutes link, attendance, agenda, motions, votes, resolutions, and recusals as a read-only snapshot.</p></div>
      <button id="phase7-refresh-records" class="secondary-button" type="button">Refresh</button>
    </div>
    <div class="phase7-record-metrics">
      <div><span>Certified Records</span><strong id="phase7-record-count">0</strong></div>
      <div><span>Resolutions Preserved</span><strong id="phase7-resolution-count">0</strong></div>
      <div><span>Votes Preserved</span><strong id="phase7-vote-count">0</strong></div>
      <div><span>Attendance Entries</span><strong id="phase7-attendance-count">0</strong></div>
    </div>
    <div class="phase7-record-toolbar"><label>Search records<input id="phase7-record-search" type="search" placeholder="Record number, meeting, or certifier"></label></div>
    <div class="phase7-record-layout">
      <div id="phase7-record-list" class="phase7-record-list"><div class="phase7-empty">Loading certified records…</div></div>
      <article id="phase7-record-detail" class="panel phase7-record-detail"><div class="phase7-empty">Select a certified meeting record.</div></article>
    </div>`;
  main.append(section);
}

function showRecordsView() {
  if (!profile || !hasPermission(profile, PERMISSIONS.RECORDS_VIEW)) return;
  document.querySelectorAll(".portal-section").forEach((section) => { section.hidden = section.id !== "view-records"; });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === "records"));
  const title = $("#view-title");
  if (title) title.textContent = "Permanent Board Records";
  $("#view-records").hidden = false;
  renderRecords();
}

function ensureMinutesHost() {
  const detail = $("#meeting-detail");
  const phase6 = $("#phase6-meeting-workspace");
  if (!detail || !phase6 || $("#phase7-minutes-workspace")) return;
  const host = document.createElement("section");
  host.id = "phase7-minutes-workspace";
  host.className = "phase7-minutes-host";
  phase6.after(host);
  renderMinutes();
}

function renderMinutesReadOnly() {
  if (!minutes) return '<div class="phase7-empty">No minutes draft has been created for this meeting.</div>';
  return `
    <div class="phase7-minutes-readonly">
      <div><span>Status</span><strong>${escapeHtml(minutesStatusLabel(minutes.status))}</strong></div>
      <div><span>Prepared by</span><strong>${escapeHtml(minutes.preparedByName || "—")}</strong></div>
      <div><span>Updated</span><strong>${escapeHtml(formatDateTime(minutes.updatedAt))}</strong></div>
      ${minutes.minutesDocumentUrl ? `<a href="${escapeHtml(minutes.minutesDocumentUrl)}" target="_blank" rel="noopener noreferrer">Open Official Minutes in Google</a>` : ""}
    </div>`;
}

function renderMinutesForm() {
  const editable = !minutes || minutes.status === "draft";
  if (!editable || !hasPermission(profile, PERMISSIONS.MINUTES_EDIT)) return renderMinutesReadOnly();
  return `
    <form id="phase7-minutes-form" class="phase7-minutes-form" novalidate>
      <label>Official minutes Google link<input name="minutesDocumentUrl" type="url" placeholder="https://docs.google.com/..." value="${escapeHtml(minutes?.minutesDocumentUrl || "")}"></label>
      <small>All official minutes documents remain Google-hosted. The portal stores the governance record and certification metadata.</small>
      <label>Opening notes<textarea name="openingNotes" rows="3" maxlength="5000">${escapeHtml(minutes?.openingNotes || "")}</textarea></label>
      <label>Discussion summary<textarea name="discussionSummary" rows="6" maxlength="12000">${escapeHtml(minutes?.discussionSummary || "")}</textarea></label>
      <label>Other business<textarea name="otherBusiness" rows="4" maxlength="8000">${escapeHtml(minutes?.otherBusiness || "")}</textarea></label>
      <label>Closing notes<textarea name="closingNotes" rows="3" maxlength="5000">${escapeHtml(minutes?.closingNotes || "")}</textarea></label>
      <label>Approval / certification reference<input name="approvalReference" maxlength="800" placeholder="Optional motion, resolution, or approval reference" value="${escapeHtml(minutes?.approvalReference || "")}"></label>
      <div class="phase7-actions"><button type="submit">Save Minutes Draft</button></div>
      <p id="phase7-minutes-message" class="meeting-form-message"></p>
    </form>`;
}

function renderCertificationActions() {
  if (!meeting || meeting.status === "cancelled") return "";
  const buttons = [];
  if (minutes?.status === "draft" && meeting.status === "adjourned" && hasPermission(profile, PERMISSIONS.MINUTES_CERTIFY)) {
    buttons.push('<button type="button" class="meeting-secondary-button" data-phase7-action="ready">Mark Ready for Certification</button>');
  }
  if (minutes?.status === "ready" && hasPermission(profile, PERMISSIONS.MINUTES_EDIT)) {
    buttons.push('<button type="button" class="meeting-secondary-button" data-phase7-action="return-draft">Return to Draft</button>');
  }
  if (minutes?.status === "ready" && meeting.status === "adjourned" && hasPermission(profile, PERMISSIONS.RECORDS_CERTIFY)) {
    buttons.push('<button type="button" class="phase7-certify-button" data-phase7-action="certify">Certify Permanent Record</button>');
  }
  if (meeting.recordStatus === "certified" && meeting.recordId && hasPermission(profile, PERMISSIONS.RECORDS_VIEW)) {
    buttons.push('<button type="button" class="meeting-primary-button" data-phase7-action="open-record">Open Certified Record</button>');
  }
  return buttons.length ? `<div class="phase7-certification-actions">${buttons.join("")}</div>` : "";
}

function renderMinutes() {
  const host = $("#phase7-minutes-workspace");
  if (!host || !profile || !hasPermission(profile, PERMISSIONS.MINUTES_VIEW)) {
    if (host) host.innerHTML = "";
    return;
  }
  if (!meeting) {
    host.innerHTML = '<div class="phase7-empty">Loading minutes workspace…</div>';
    return;
  }
  const certified = meeting.recordStatus === "certified";
  host.innerHTML = `
    <div class="phase7-minutes-head">
      <div><p class="eyebrow">PHASE 7 · MINUTES & CERTIFICATION</p><h2>Official Meeting Record</h2><p>Prepare the Google-linked minutes, review the meeting record, and permanently certify the completed Board record.</p></div>
      <span class="phase7-record-status ${certified ? "certified" : "working"}">${certified ? "CERTIFIED" : escapeHtml(minutesStatusLabel(minutes?.status || "draft"))}</span>
    </div>
    ${meeting.status === "cancelled" ? '<div class="phase7-warning">This meeting was cancelled. The ordinary Phase 7 minutes-certification workflow is unavailable.</div>' : ""}
    ${certified ? renderMinutesReadOnly() : renderMinutesForm()}
    ${renderCertificationActions()}
    <p id="phase7-action-message" class="meeting-form-message"></p>`;
}

function filteredRecords() {
  const search = String($("#phase7-record-search")?.value || "").trim().toLowerCase();
  return records.filter((record) => {
    if (!search) return true;
    return [record.recordNumber, record.meetingNumber, record.meetingTitle, record.certifiedByName].some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function renderRecordMetrics() {
  const count = (id, value) => { const el = $(id); if (el) el.textContent = String(value); };
  count("#phase7-record-count", records.length);
  count("#phase7-resolution-count", records.reduce((sum, record) => sum + (Number(record.resolutionCount) || 0), 0));
  count("#phase7-vote-count", records.reduce((sum, record) => sum + (Number(record.voteCount) || 0), 0));
  count("#phase7-attendance-count", records.reduce((sum, record) => sum + (Number(record.attendanceCount) || 0), 0));
}

function renderRecordList() {
  const list = $("#phase7-record-list");
  if (!list) return;
  list.replaceChildren();
  const entries = filteredRecords();
  if (!entries.length) {
    list.innerHTML = '<div class="phase7-empty">No certified meeting records match this view.</div>';
    return;
  }
  entries.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `phase7-record-card${record.id === selectedRecordId ? " selected" : ""}`;
    button.dataset.phase7RecordId = record.id;
    button.innerHTML = `<div><strong>${escapeHtml(record.recordNumber || "BMR")}</strong><span>${escapeHtml(record.meetingTitle || "Board Meeting")}</span></div><small>${escapeHtml(record.meetingNumber || "")} · ${escapeHtml(formatDateTime(record.certifiedAt))}</small>`;
    list.append(button);
  });
}

function renderEntryGroup(type, title) {
  const entries = selectedRecordEntries.filter((entry) => entry.entryType === type);
  if (!entries.length) return "";
  return `<section class="phase7-entry-group"><h3>${escapeHtml(title)}</h3>${entries.map((entry) => {
    const data = entry.data || {};
    if (type === "attendance") return `<div class="phase7-entry"><strong>${escapeHtml(data.directorName)}</strong><span>${escapeHtml(data.directorNumber || "")} · ${escapeHtml(humanize(data.presenceStatus))}${data.votingEligible ? " · Voting eligible" : ""}</span></div>`;
    if (type === "agenda") return `<div class="phase7-entry"><strong>${escapeHtml(data.agendaNumber || "Agenda")} · ${escapeHtml(data.title)}</strong><span>${escapeHtml(humanize(data.status))}${data.documentUrl ? ` · <a href="${escapeHtml(data.documentUrl)}" target="_blank" rel="noopener noreferrer">Google document</a>` : ""}</span></div>`;
    if (type === "motion") return `<div class="phase7-entry"><strong>${escapeHtml(data.motionNumber || "Motion")}</strong><p>${escapeHtml(data.motionText || "")}</p><span>Moved by ${escapeHtml(data.movedByName || "—")} · Seconded by ${escapeHtml(data.secondedByName || "—")} · ${escapeHtml(humanize(data.status))}</span></div>`;
    if (type === "vote") return `<div class="phase7-entry"><strong>${escapeHtml(data.voteNumber || "Vote")} · ${escapeHtml(data.question)}</strong><span>${data.approveCount || 0} approve · ${data.opposeCount || 0} oppose · ${data.abstainCount || 0} abstain · ${escapeHtml(humanize(data.result))}</span></div>`;
    if (type === "resolution") return `<div class="phase7-entry"><strong>${escapeHtml(data.resolutionNumber || "Resolution")} · ${escapeHtml(data.title)}</strong><p>${escapeHtml(data.resolutionText || "")}</p><span>${escapeHtml(humanize(data.status))}</span></div>`;
    if (type === "recusal") return `<div class="phase7-entry"><strong>${escapeHtml(data.directorName || "Director")}</strong><span>Recused${data.reason ? ` · ${escapeHtml(data.reason)}` : ""}</span></div>`;
    return "";
  }).join("")}</section>`;
}

function renderRecordDetail() {
  const panel = $("#phase7-record-detail");
  if (!panel) return;
  const record = records.find((entry) => entry.id === selectedRecordId);
  if (!record) {
    panel.innerHTML = '<div class="phase7-empty">Select a certified meeting record.</div>';
    return;
  }
  const summary = summarizeCertifiedRecord(record, selectedRecordEntries);
  panel.innerHTML = `
    <div class="phase7-record-detail-head"><div><p class="eyebrow">${escapeHtml(record.recordNumber || "CERTIFIED RECORD")}</p><h2>${escapeHtml(record.meetingTitle || "Board Meeting")}</h2><p>${escapeHtml(record.meetingNumber || "")} · Certified ${escapeHtml(formatDateTime(record.certifiedAt))}</p></div><span class="phase7-record-status certified">CERTIFIED</span></div>
    <div class="phase7-record-actions">${record.minutesSnapshot?.minutesDocumentUrl ? `<a href="${escapeHtml(record.minutesSnapshot.minutesDocumentUrl)}" target="_blank" rel="noopener noreferrer">Open Official Minutes</a>` : ""}<button type="button" data-phase7-print>Print Record</button></div>
    <dl class="detail-list">
      <div><dt>Certified by</dt><dd>${escapeHtml(record.certifiedByName || "—")}</dd></div>
      <div><dt>Meeting type</dt><dd>${escapeHtml(humanize(record.meetingSnapshot?.meetingType))}</dd></div>
      <div><dt>Called to order</dt><dd>${escapeHtml(formatDateTime(record.meetingSnapshot?.calledToOrderAt))}</dd></div>
      <div><dt>Adjourned</dt><dd>${escapeHtml(formatDateTime(record.meetingSnapshot?.adjournedAt))}</dd></div>
      <div><dt>Entries</dt><dd>${summary.attendanceCount} attendance · ${summary.agendaCount} agenda · ${summary.voteCount} votes · ${summary.resolutionCount} resolutions</dd></div>
    </dl>
    <section class="phase7-minutes-snapshot"><h3>Certified Minutes Summary</h3><p>${escapeHtml(record.minutesSnapshot?.discussionSummary || "No discussion summary recorded in the portal metadata.")}</p>${record.minutesSnapshot?.approvalReference ? `<span>Reference: ${escapeHtml(record.minutesSnapshot.approvalReference)}</span>` : ""}</section>
    ${renderEntryGroup("attendance", "Attendance")}
    ${renderEntryGroup("agenda", "Agenda")}
    ${renderEntryGroup("motion", "Motions")}
    ${renderEntryGroup("vote", "Votes")}
    ${renderEntryGroup("resolution", "Resolutions")}
    ${renderEntryGroup("recusal", "Recusals")}`;
}

function renderRecords() {
  renderRecordMetrics();
  renderRecordList();
  renderRecordDetail();
}

function bindSelectedMeeting(id) {
  meetingUnsub?.();
  minutesUnsub?.();
  meetingUnsub = minutesUnsub = null;
  selectedMeetingId = id;
  meeting = null;
  minutes = null;
  if (!id || !profile) return renderMinutes();
  meetingUnsub = onSnapshot(doc(db, "meetings", id), (snapshot) => {
    meeting = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    renderMinutes();
  });
  if (hasPermission(profile, PERMISSIONS.MINUTES_VIEW)) {
    minutesUnsub = onSnapshot(doc(db, "meetingMinutes", id), (snapshot) => {
      minutes = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      renderMinutes();
    });
  }
}

function bindRecords() {
  recordsUnsub?.();
  recordsUnsub = null;
  records = [];
  if (!profile || !hasPermission(profile, PERMISSIONS.RECORDS_VIEW)) return renderRecords();
  recordsUnsub = onSnapshot(collection(db, "meetingRecords"), (snapshot) => {
    records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampValue(b.certifiedAt) - timestampValue(a.certifiedAt));
    if (!selectedRecordId || !records.some((entry) => entry.id === selectedRecordId)) selectedRecordId = records[0]?.id || null;
    if (selectedRecordId) loadRecordEntries(selectedRecordId);
    else { selectedRecordEntries = []; renderRecords(); }
  }, (error) => {
    console.warn("Permanent record stream unavailable", error);
    records = [];
    renderRecords();
  });
}

async function loadRecordEntries(id) {
  selectedRecordEntries = [];
  renderRecords();
  try {
    selectedRecordEntries = await getCertifiedRecordEntries(id, profile);
  } catch (error) {
    console.warn("Certified record entries unavailable", error);
  }
  renderRecords();
}

async function handleMinutesSubmit(form) {
  const message = $("#phase7-minutes-message");
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  button.disabled = true;
  if (message) message.textContent = "";
  try {
    await saveMinutesDraft(selectedMeetingId, {
      minutesDocumentUrl: data.get("minutesDocumentUrl"),
      openingNotes: data.get("openingNotes"),
      discussionSummary: data.get("discussionSummary"),
      otherBusiness: data.get("otherBusiness"),
      closingNotes: data.get("closingNotes"),
      approvalReference: data.get("approvalReference")
    }, profile);
    if (message) message.textContent = "Minutes draft saved.";
  } catch (error) {
    if (message) message.textContent = error.message || "Minutes could not be saved.";
  } finally {
    button.disabled = false;
  }
}

async function handlePhase7Action(action) {
  const message = $("#phase7-action-message");
  if (message) message.textContent = "";
  try {
    if (action === "ready") {
      if (!window.confirm("Mark these minutes Ready for Certification? Editing will pause until they are returned to Draft.")) return;
      await markMinutesReady(selectedMeetingId, profile);
    } else if (action === "return-draft") {
      await returnMinutesToDraft(selectedMeetingId, profile);
    } else if (action === "certify") {
      if (!window.confirm("CERTIFY this meeting's permanent Board record? The certified snapshot, minutes state, and resolution certifications will become read-only.")) return;
      const result = await certifyMeetingRecord(selectedMeetingId, profile);
      selectedRecordId = result.id;
      showRecordsView();
      await loadRecordEntries(result.id);
    } else if (action === "open-record") {
      selectedRecordId = meeting?.recordId || selectedMeetingId;
      showRecordsView();
      await loadRecordEntries(selectedRecordId);
    }
  } catch (error) {
    if (message) message.textContent = error.message || "The Phase 7 action could not be completed.";
  }
}

function startObserver() {
  observer?.disconnect();
  observer = new MutationObserver(() => ensureMinutesHost());
  observer.observe(document.body, { childList: true, subtree: true });
  ensureMinutesHost();
}

function bindUI() {
  window.addEventListener("tpp:meeting-selected", (event) => {
    const id = event.detail?.meetingId || null;
    if (id !== selectedMeetingId) bindSelectedMeeting(id);
    ensureMinutesHost();
  });

  document.addEventListener("click", (event) => {
    const nav = event.target.closest('.nav-item[data-view="records"]');
    if (nav) return queueMicrotask(showRecordsView);
    const action = event.target.closest("[data-phase7-action]")?.dataset.phase7Action;
    if (action) return handlePhase7Action(action);
    const recordCard = event.target.closest("[data-phase7-record-id]");
    if (recordCard) {
      selectedRecordId = recordCard.dataset.phase7RecordId;
      loadRecordEntries(selectedRecordId);
      return;
    }
    if (event.target.closest("#phase7-refresh-records")) return bindRecords();
    if (event.target.closest("[data-phase7-print]")) return window.print();
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("#phase7-record-search")) renderRecordList();
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#phase7-minutes-form")) {
      event.preventDefault();
      handleMinutesSubmit(event.target);
    }
  });
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

function teardown() {
  meetingUnsub?.();
  minutesUnsub?.();
  recordsUnsub?.();
  observer?.disconnect();
  meetingUnsub = minutesUnsub = recordsUnsub = observer = null;
  profile = null;
  meeting = minutes = null;
  records = [];
  selectedRecordEntries = [];
}

function init() {
  if (initialized) return;
  initialized = true;
  installStylesheet();
  ensureRecordsNavigation();
  ensureRecordsView();
  bindUI();
  onAuthStateChanged(auth, async (user) => {
    if (!user) return teardown();
    const next = await loadProfile(user.uid);
    if (!next || next.accountStatus !== "active") return teardown();
    profile = next;
    const nav = $('.nav-item[data-view="records"]');
    if (nav) nav.hidden = !hasPermission(profile, PERMISSIONS.RECORDS_VIEW);
    bindRecords();
    startObserver();
    window.dispatchEvent(new CustomEvent("tpp:phase7-ready"));
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
