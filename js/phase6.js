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
import { listBoardDocuments } from "./document-data.js";
import { calculateQuorum } from "./meeting-data.js";
import {
  castVote,
  closeVote,
  createAgendaItem,
  createMotion,
  openVote,
  secondMotion,
  setAgendaItemStatus,
  statusLabel,
  thresholdLabel
} from "./governance-data.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

const $ = (selector) => document.querySelector(selector);

let currentProfile = null;
let meetingId = null;
let meeting = null;
let attendance = [];
let agendaItems = [];
let motions = [];
let votes = [];
let ballots = [];
let ownBallot = null;
let agendaDocuments = [];
let resolutions = [];
let agendaFormOpen = false;
let motionDraftAgendaId = null;
let voteSetupMotionId = null;
let selectedResolutionId = null;
let initialized = false;

let meetingUnsub = null;
let attendanceUnsub = null;
let agendaUnsub = null;
let motionsUnsub = null;
let votesUnsub = null;
let ballotsUnsub = null;
let ownBallotUnsub = null;
let resolutionsUnsub = null;

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

function formatDate(value) {
  const millis = timestampValue(value);
  return millis ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(millis)) : "—";
}

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function canControlBallots() {
  return currentProfile && (isFounder(currentProfile) || hasPermission(currentProfile, PERMISSIONS.VOTES_CLOSE));
}

function installStylesheet() {
  if ($('link[data-phase6-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase6.css";
  link.dataset.phase6Styles = "true";
  document.head.append(link);
}

function ensureResolutionView() {
  if ($("#view-resolutions")) return;
  const portalMain = $(".portal-main");
  if (!portalMain) return;
  const section = document.createElement("section");
  section.id = "view-resolutions";
  section.className = "portal-section phase6-resolution-view";
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading-row">
      <div><p class="eyebrow">RESOLUTION REGISTRY</p><h2>Board actions & vote records</h2><p>Closed motion votes create permanent preliminary resolution records. Phase 7 will add certification and permanent meeting-record sealing.</p></div>
      <button id="phase6-refresh-resolutions" class="secondary-button" type="button">Refresh</button>
    </div>
    <div class="phase6-resolution-toolbar">
      <label>Search<input id="phase6-resolution-search" type="search" placeholder="Resolution number, title, meeting"></label>
      <label>Status<select id="phase6-resolution-status"><option value="all">All</option><option value="adopted">Adopted</option><option value="failed">Failed</option></select></label>
    </div>
    <div class="phase6-resolution-layout">
      <div id="phase6-resolution-list" class="phase6-resolution-list"><div class="phase6-empty">Loading resolutions…</div></div>
      <article id="phase6-resolution-detail" class="panel"><div class="phase6-empty">Select a resolution record.</div></article>
    </div>`;
  portalMain.append(section);
}

function showResolutionView() {
  if (!currentProfile || !hasPermission(currentProfile, PERMISSIONS.RESOLUTIONS_VIEW)) return;
  document.querySelectorAll(".portal-section").forEach((section) => { section.hidden = section.id !== "view-resolutions"; });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === "resolutions"));
  const title = $("#view-title");
  if (title) title.textContent = "Resolution Registry";
  $("#view-resolutions").hidden = false;
  renderResolutions();
}

function currentAttendance() {
  return attendance.find((entry) => entry.directorUid === auth.currentUser?.uid) || null;
}

function presentEligible() {
  return attendance.filter((entry) => entry.votingEligible === true && entry.presenceStatus === "present");
}

function currentOpenVote() {
  return votes.find((vote) => vote.status === "open") || null;
}

function motionsForAgenda(agendaItemId) {
  return motions.filter((motion) => motion.agendaItemId === agendaItemId);
}

function voteForMotion(motionId) {
  return votes.find((vote) => vote.motionId === motionId) || null;
}

function resolutionForVote(voteId) {
  return resolutions.find((entry) => entry.voteId === voteId) || null;
}

function renderAgendaForm() {
  if (!agendaFormOpen || !hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE)) return "";
  const options = agendaDocuments
    .filter((entry) => !entry.agendaMeetingId || entry.agendaMeetingId === meetingId)
    .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.documentNumber || "BDOC")} — ${escapeHtml(entry.title)}</option>`)
    .join("");
  return `
    <form id="phase6-agenda-form" class="phase6-form">
      <div class="phase6-form-head"><div><strong>Add agenda item</strong><span>Create business directly or attach an Agenda Ready Google-linked Board document.</span></div><button type="button" class="secondary-button" data-phase6-action="close-agenda-form">Close</button></div>
      <div class="phase6-form-row">
        <label>Type<select name="itemType"><option value="business">Business</option><option value="report">Report</option><option value="motion">Motion</option><option value="resolution">Resolution</option><option value="election">Election</option><option value="other">Other</option></select></label>
        <label>Agenda Ready document<select name="documentId"><option value="">None</option>${options}</select></label>
      </div>
      <label>Title<input name="title" maxlength="180" required></label>
      <label>Description<textarea name="description" rows="3" maxlength="1200"></textarea></label>
      <button type="submit" class="meeting-primary-button">Add to Agenda</button>
      <p id="phase6-agenda-message" class="meeting-form-message"></p>
    </form>`;
}

function renderMotionForm(agendaItemId) {
  if (motionDraftAgendaId !== agendaItemId) return "";
  return `
    <form class="phase6-motion-form" data-phase6-motion-form="${escapeHtml(agendaItemId)}">
      <label>Motion text<textarea name="motionText" rows="3" maxlength="1600" placeholder="I move that…" required></textarea></label>
      <div class="phase6-inline-actions"><button class="meeting-primary-button" type="submit">Enter Motion</button><button class="meeting-secondary-button" type="button" data-phase6-action="cancel-motion">Cancel</button></div>
      <p class="meeting-form-message" data-phase6-motion-message></p>
    </form>`;
}

function renderVoteSetup(motion) {
  if (voteSetupMotionId !== motion.id) return "";
  const eligible = presentEligible();
  const recusalChoices = eligible.map((entry) => `
    <label class="phase6-recusal-option"><input type="checkbox" name="recusedUid" value="${escapeHtml(entry.directorUid)}"><span><strong>${escapeHtml(entry.directorName)}</strong><small>${escapeHtml(entry.directorNumber || "Voting director")}</small></span></label>`).join("");
  return `
    <form class="phase6-vote-setup" data-phase6-vote-form="${escapeHtml(motion.id)}">
      <div class="phase6-form-head"><div><strong>Push vote</strong><span>The eligible voter snapshot is taken from directors currently marked present. Recusals are excluded from the ballot list.</span></div><button type="button" class="secondary-button" data-phase6-action="cancel-vote-setup">Close</button></div>
      <label>Question<textarea name="question" rows="2" maxlength="1600">${escapeHtml(motion.motionText)}</textarea></label>
      <div class="phase6-form-row">
        <label>Threshold<select name="thresholdMode"><option value="simple_majority_cast">Simple majority of votes cast</option><option value="majority_eligible">Majority of eligible voters</option><option value="two_thirds_cast">Two-thirds of non-abstaining votes cast</option></select></label>
        <label>Ballot visibility<select name="ballotVisibility"><option value="recorded">Recorded ballot</option><option value="confidential">Confidential — controllers can audit</option></select></label>
      </div>
      <fieldset><legend>Recusals for this vote</legend><div class="phase6-recusal-grid">${recusalChoices || '<span class="phase6-empty">No present voting-eligible directors.</span>'}</div></fieldset>
      <label>Recusal note<textarea name="recusalReason" rows="2" maxlength="500" placeholder="Optional shared reason/note"></textarea></label>
      <button class="meeting-primary-button" type="submit">Push Vote to Directors</button>
      <p class="meeting-form-message" data-phase6-vote-message></p>
    </form>`;
}

function renderVoteCard(vote) {
  const uid = auth.currentUser?.uid;
  const eligible = vote.eligibleVoterUids?.includes(uid);
  const recused = vote.recusedDirectorUids?.includes(uid);
  const own = ownBallot && ownBallot.voteId === vote.id ? ownBallot : null;
  const controller = canControlBallots();
  const receiptCount = controller ? ballots.length : (own ? 1 : 0);
  const closed = vote.status === "closed";
  const result = closed ? statusLabel(vote.result) : "Voting Open";

  let ballotArea = "";
  if (!closed && recused) {
    ballotArea = '<div class="phase6-ballot-state recused"><strong>Recused</strong><span>You are not included in this ballot.</span></div>';
  } else if (!closed && !eligible) {
    ballotArea = '<div class="phase6-ballot-state"><strong>Not eligible for this ballot</strong><span>The vote was pushed to the eligible-voter snapshot shown below.</span></div>';
  } else if (!closed && own) {
    ballotArea = `<div class="phase6-ballot-state recorded"><strong>Ballot recorded ✓</strong><span>Your choice is locked as ${escapeHtml(statusLabel(own.choice))}.</span></div>`;
  } else if (!closed && eligible && hasPermission(currentProfile, PERMISSIONS.VOTES_CAST)) {
    ballotArea = `<div class="phase6-ballot-buttons"><button data-phase6-cast="approve" data-vote-id="${vote.id}">Approve</button><button data-phase6-cast="oppose" data-vote-id="${vote.id}">Oppose</button><button data-phase6-cast="abstain" data-vote-id="${vote.id}">Abstain</button></div>`;
  }

  const totals = closed
    ? `<div class="phase6-vote-totals"><span>Approve <strong>${vote.approveCount || 0}</strong></span><span>Oppose <strong>${vote.opposeCount || 0}</strong></span><span>Abstain <strong>${vote.abstainCount || 0}</strong></span><span>Required <strong>${vote.requiredApproveCount || 0}</strong></span></div>`
    : `<div class="phase6-vote-progress"><strong>${controller ? receiptCount : (own ? "Your ballot received" : "Awaiting your ballot")}</strong><span>${controller ? `of ${vote.eligibleVoterUids?.length || 0} ballots received` : `${vote.eligibleVoterUids?.length || 0} eligible voters in snapshot`}</span></div>`;

  const individual = closed && vote.ballotVisibility === "recorded" && ballots.length && controller
    ? `<div class="phase6-recorded-ballots">${ballots.map((entry) => `<span>${escapeHtml(entry.voterName)} — <strong>${escapeHtml(statusLabel(entry.choice))}</strong></span>`).join("")}</div>`
    : "";

  return `
    <article class="phase6-vote-card ${closed ? `closed ${escapeHtml(vote.result)}` : "open"}">
      <div class="phase6-vote-head"><div><span>${escapeHtml(vote.voteNumber || "VOTE")}</span><strong>${escapeHtml(vote.question)}</strong></div><em>${escapeHtml(result)}</em></div>
      <div class="phase6-vote-meta"><span>${escapeHtml(thresholdLabel(vote.thresholdMode))}</span><span>${vote.ballotVisibility === "confidential" ? "Confidential ballot (controllers can audit)" : "Recorded ballot"}</span><span>Quorum snapshot ${vote.quorumSnapshotPresent}/${vote.quorumSnapshotRequired}</span></div>
      ${ballotArea}
      ${totals}
      ${individual}
      ${!closed && controller ? `<button class="meeting-danger-button" data-phase6-close-vote="${vote.id}">Close Vote & Record Result</button>` : ""}
      <p class="meeting-form-message" data-phase6-vote-card-message="${vote.id}"></p>
    </article>`;
}

function renderMotion(motion) {
  const vote = voteForMotion(motion.id);
  const canSecond = meeting?.status === "in_session"
    && motion.status === "pending_second"
    && motion.movedByUid !== auth.currentUser?.uid
    && currentAttendance()?.presenceStatus === "present"
    && currentAttendance()?.votingEligible === true
    && hasPermission(currentProfile, PERMISSIONS.MOTIONS_SECOND);
  const canPush = meeting?.status === "in_session"
    && motion.status === "ready"
    && hasPermission(currentProfile, PERMISSIONS.VOTES_PUSH)
    && !currentOpenVote();

  return `
    <div class="phase6-motion ${escapeHtml(motion.status)}">
      <div class="phase6-motion-head"><div><span>${escapeHtml(motion.motionNumber || "MOTION")}</span><strong>${escapeHtml(motion.motionText)}</strong></div><em>${escapeHtml(statusLabel(motion.status))}</em></div>
      <div class="phase6-motion-by"><span>Moved by ${escapeHtml(motion.movedByName || "Director")}</span><span>${motion.secondedByName ? `Seconded by ${escapeHtml(motion.secondedByName)}` : "Awaiting second"}</span></div>
      <div class="phase6-inline-actions">
        ${canSecond ? `<button class="meeting-secondary-button" data-phase6-second-motion="${motion.id}">Second Motion</button>` : ""}
        ${canPush ? `<button class="meeting-primary-button" data-phase6-setup-vote="${motion.id}">Push Vote</button>` : ""}
      </div>
      ${renderVoteSetup(motion)}
      ${vote ? renderVoteCard(vote) : ""}
    </div>`;
}

function renderAgendaItem(item) {
  const itemMotions = motionsForAgenda(item.id);
  const canMakeMotion = meeting?.status === "in_session"
    && currentAttendance()?.presenceStatus === "present"
    && currentAttendance()?.votingEligible === true
    && hasPermission(currentProfile, PERMISSIONS.MOTIONS_CREATE);
  const canManage = hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE) && !["adjourned", "cancelled"].includes(meeting?.status);
  return `
    <article class="phase6-agenda-item ${escapeHtml(item.status)}">
      <div class="phase6-agenda-head">
        <div><span>${escapeHtml(item.agendaNumber || "AGENDA")} · ${escapeHtml(statusLabel(item.itemType))}</span><strong>${escapeHtml(item.title)}</strong>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</div>
        <em>${escapeHtml(statusLabel(item.status))}</em>
      </div>
      ${item.documentUrl ? `<a class="phase6-document-link" href="${escapeHtml(item.documentUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.documentNumber || "Board document")} · ${escapeHtml(item.documentTitle || "Open Google document")}</a>` : ""}
      <div class="phase6-inline-actions">
        ${canMakeMotion ? `<button class="meeting-secondary-button" data-phase6-new-motion="${item.id}">Make Motion</button>` : ""}
        ${canManage && !["completed", "tabled", "withdrawn"].includes(item.status) ? `<button class="meeting-secondary-button" data-phase6-agenda-status="tabled" data-agenda-id="${item.id}">Table Item</button><button class="meeting-secondary-button" data-phase6-agenda-status="withdrawn" data-agenda-id="${item.id}">Withdraw</button>` : ""}
      </div>
      ${renderMotionForm(item.id)}
      <div class="phase6-motion-list">${itemMotions.map(renderMotion).join("")}</div>
    </article>`;
}

function renderWorkspace() {
  const host = $("#phase6-meeting-workspace");
  if (!host || host.dataset.meetingId !== meetingId) return;
  if (!currentProfile || !meeting) {
    host.innerHTML = '<div class="phase6-empty">Loading Board actions…</div>';
    return;
  }

  const quorum = calculateQuorum(meeting, attendance);
  const openVote = currentOpenVote();
  host.innerHTML = `
    <div class="phase6-section-head">
      <div><p class="eyebrow">PHASE 6 · LIVE BOARD ACTIONS</p><h2>Agenda, Motions & Voting</h2><p>Board actions are tied to this meeting, its live attendance roster, and immutable ballots.</p></div>
      ${hasPermission(currentProfile, PERMISSIONS.AGENDA_MANAGE) && !["adjourned", "cancelled"].includes(meeting.status) ? `<button class="meeting-primary-button" data-phase6-action="open-agenda-form">Add Agenda Item</button>` : ""}
    </div>
    <div class="phase6-action-metrics">
      <div><span>Agenda Items</span><strong>${agendaItems.length}</strong></div>
      <div><span>Open Motions</span><strong>${motions.filter((entry) => ["pending_second", "ready", "voting"].includes(entry.status)).length}</strong></div>
      <div><span>Vote</span><strong>${openVote ? "OPEN" : "NONE"}</strong></div>
      <div><span>Quorum</span><strong class="${quorum.achieved ? "phase6-good" : "phase6-bad"}">${quorum.achieved ? `${quorum.presentEligible}/${quorum.required}` : `NO · ${quorum.presentEligible}/${quorum.required}`}</strong></div>
    </div>
    ${!quorum.achieved && meeting.status === "in_session" ? '<div class="phase6-quorum-warning"><strong>Quorum is not currently present.</strong><span>The portal will not push a new vote until the live attendance count satisfies the meeting quorum requirement.</span></div>' : ""}
    ${renderAgendaForm()}
    <div class="phase6-agenda-list">${agendaItems.length ? agendaItems.map(renderAgendaItem).join("") : '<div class="phase6-empty">No agenda items have been added to this meeting.</div>'}</div>
    <p id="phase6-global-message" class="meeting-form-message"></p>`;
}

async function refreshAgendaDocuments() {
  if (!currentProfile) return;
  try {
    agendaDocuments = (await listBoardDocuments(currentProfile)).filter((entry) => entry.status === "agenda_ready");
  } catch (error) {
    console.warn("Agenda-ready documents unavailable", error);
    agendaDocuments = [];
  }
  renderWorkspace();
}

function clearMeetingStreams() {
  [meetingUnsub, attendanceUnsub, agendaUnsub, motionsUnsub, votesUnsub, ballotsUnsub, ownBallotUnsub].forEach((unsubscribe) => unsubscribe?.());
  meetingUnsub = attendanceUnsub = agendaUnsub = motionsUnsub = votesUnsub = ballotsUnsub = ownBallotUnsub = null;
  meeting = null;
  attendance = [];
  agendaItems = [];
  motions = [];
  votes = [];
  ballots = [];
  ownBallot = null;
}

function bindBallotStream() {
  ballotsUnsub?.();
  ownBallotUnsub?.();
  ballotsUnsub = ownBallotUnsub = null;
  ballots = [];
  ownBallot = null;
  const vote = currentOpenVote() || votes[0];
  if (!vote || !auth.currentUser) return renderWorkspace();

  if (canControlBallots()) {
    ballotsUnsub = onSnapshot(query(collection(db, "voteBallots"), where("voteId", "==", vote.id)), (snapshot) => {
      ballots = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      ownBallot = ballots.find((entry) => entry.voterUid === auth.currentUser.uid) || null;
      renderWorkspace();
    }, (error) => console.warn("Ballot controller stream unavailable", error));
  } else {
    ownBallotUnsub = onSnapshot(doc(db, "voteBallots", `${vote.id}_${auth.currentUser.uid}`), (snapshot) => {
      ownBallot = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      renderWorkspace();
    }, () => { ownBallot = null; renderWorkspace(); });
  }
}

function bindMeeting(meetingIdValue) {
  clearMeetingStreams();
  meetingId = meetingIdValue;
  agendaFormOpen = false;
  motionDraftAgendaId = null;
  voteSetupMotionId = null;
  if (!meetingId || !currentProfile) return;

  meetingUnsub = onSnapshot(doc(db, "meetings", meetingId), (snapshot) => {
    meeting = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    renderWorkspace();
  });
  attendanceUnsub = onSnapshot(query(collection(db, "meetingAttendance"), where("meetingId", "==", meetingId)), (snapshot) => {
    attendance = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    renderWorkspace();
  });
  agendaUnsub = onSnapshot(query(collection(db, "agendaItems"), where("meetingId", "==", meetingId)), (snapshot) => {
    agendaItems = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    renderWorkspace();
  });
  motionsUnsub = onSnapshot(query(collection(db, "motions"), where("meetingId", "==", meetingId)), (snapshot) => {
    motions = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
    renderWorkspace();
  });
  if (hasPermission(currentProfile, PERMISSIONS.VOTES_VIEW)) {
    votesUnsub = onSnapshot(query(collection(db, "votes"), where("meetingId", "==", meetingId)), (snapshot) => {
      votes = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampValue(b.openedAt) - timestampValue(a.openedAt));
      bindBallotStream();
      renderWorkspace();
    });
  }
  refreshAgendaDocuments();
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

function bindResolutions() {
  resolutionsUnsub?.();
  resolutions = [];
  if (!currentProfile || !hasPermission(currentProfile, PERMISSIONS.RESOLUTIONS_VIEW)) return;
  resolutionsUnsub = onSnapshot(collection(db, "resolutions"), (snapshot) => {
    resolutions = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
    renderResolutions();
    renderWorkspace();
  }, (error) => console.warn("Resolution registry stream unavailable", error));
}

function filteredResolutions() {
  const search = String($("#phase6-resolution-search")?.value || "").trim().toLowerCase();
  const status = $("#phase6-resolution-status")?.value || "all";
  return resolutions.filter((entry) => {
    if (status !== "all" && entry.status !== status) return false;
    if (!search) return true;
    return [entry.resolutionNumber, entry.title, entry.resolutionText, entry.meetingNumber].some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function renderResolutions() {
  const list = $("#phase6-resolution-list");
  const detail = $("#phase6-resolution-detail");
  if (!list || !detail) return;
  list.replaceChildren();
  const entries = filteredResolutions();
  if (!entries.length) list.innerHTML = '<div class="phase6-empty">No resolution records match this view.</div>';
  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `phase6-resolution-card${entry.id === selectedResolutionId ? " selected" : ""}`;
    button.dataset.resolutionId = entry.id;
    button.innerHTML = `<div><strong>${escapeHtml(entry.resolutionNumber || "BR")}</strong><span>${escapeHtml(entry.title || "Board Resolution")}</span></div><em class="${escapeHtml(entry.status)}">${escapeHtml(statusLabel(entry.status))}</em>`;
    list.append(button);
  });

  const selected = resolutions.find((entry) => entry.id === selectedResolutionId);
  if (!selected) {
    detail.innerHTML = '<div class="phase6-empty">Select a resolution record.</div>';
    return;
  }
  detail.innerHTML = `
    <div class="phase6-resolution-detail-head"><div><p class="eyebrow">${escapeHtml(selected.resolutionNumber)}</p><h2>${escapeHtml(selected.title)}</h2></div><span class="phase6-resolution-status ${escapeHtml(selected.status)}">${escapeHtml(statusLabel(selected.status))}</span></div>
    <p class="phase6-resolution-text">${escapeHtml(selected.resolutionText)}</p>
    <dl class="detail-list">
      <div><dt>Meeting</dt><dd>${escapeHtml(selected.meetingNumber || "—")}</dd></div>
      <div><dt>Moved by</dt><dd>${escapeHtml(selected.movedByName || "—")}</dd></div>
      <div><dt>Seconded by</dt><dd>${escapeHtml(selected.secondedByName || "—")}</dd></div>
      <div><dt>Vote</dt><dd>${selected.approveCount || 0} approve · ${selected.opposeCount || 0} oppose · ${selected.abstainCount || 0} abstain</dd></div>
      <div><dt>Threshold</dt><dd>${escapeHtml(thresholdLabel(selected.thresholdMode))}</dd></div>
      <div><dt>Created</dt><dd>${escapeHtml(formatDate(selected.createdAt))}</dd></div>
      <div><dt>Certification</dt><dd>${selected.certified ? "Certified" : "Pending Phase 7 certification"}</dd></div>
    </dl>`;
}

async function submitAgendaForm(form) {
  const message = form.querySelector("#phase6-agenda-message");
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  button.disabled = true;
  try {
    await createAgendaItem(meetingId, {
      itemType: data.get("itemType"),
      documentId: data.get("documentId"),
      title: data.get("title"),
      description: data.get("description")
    }, currentProfile);
    agendaFormOpen = false;
    await refreshAgendaDocuments();
  } catch (error) {
    if (message) message.textContent = error.message || "The agenda item could not be created.";
  } finally {
    button.disabled = false;
  }
}

async function submitMotionForm(form) {
  const agendaItemId = form.dataset.phase6MotionForm;
  const message = form.querySelector("[data-phase6-motion-message]");
  const button = form.querySelector('button[type="submit"]');
  const text = new FormData(form).get("motionText");
  button.disabled = true;
  try {
    await createMotion(meetingId, agendaItemId, text, currentProfile);
    motionDraftAgendaId = null;
  } catch (error) {
    if (message) message.textContent = error.message || "The motion could not be entered.";
  } finally {
    button.disabled = false;
  }
}

async function submitVoteForm(form) {
  const motionId = form.dataset.phase6VoteForm;
  const message = form.querySelector("[data-phase6-vote-message]");
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const recusedDirectorUids = Array.from(form.querySelectorAll('input[name="recusedUid"]:checked')).map((input) => input.value);
  button.disabled = true;
  try {
    await openVote({
      motionId,
      question: data.get("question"),
      thresholdMode: data.get("thresholdMode"),
      ballotVisibility: data.get("ballotVisibility"),
      recusedDirectorUids,
      recusalReason: data.get("recusalReason")
    }, currentProfile);
    voteSetupMotionId = null;
  } catch (error) {
    if (message) message.textContent = error.message || "The vote could not be opened.";
  } finally {
    button.disabled = false;
  }
}

async function performCast(button) {
  const voteId = button.dataset.voteId;
  const choice = button.dataset.phase6Cast;
  const message = document.querySelector(`[data-phase6-vote-card-message="${CSS.escape(voteId)}"]`);
  button.parentElement?.querySelectorAll("button").forEach((entry) => { entry.disabled = true; });
  try {
    await castVote(voteId, choice, currentProfile);
  } catch (error) {
    if (message) message.textContent = error.message || "Your ballot could not be recorded.";
  }
}

async function performCloseVote(button) {
  const voteId = button.dataset.phase6CloseVote;
  const message = document.querySelector(`[data-phase6-vote-card-message="${CSS.escape(voteId)}"]`);
  if (!window.confirm("Close this vote and permanently record its result? Ballots cannot be changed after submission.")) return;
  button.disabled = true;
  try {
    await closeVote(voteId, currentProfile);
  } catch (error) {
    if (message) message.textContent = error.message || "The vote could not be closed.";
    button.disabled = false;
  }
}

function bindGlobalUI() {
  window.addEventListener("tpp:meeting-selected", (event) => {
    const nextId = event.detail?.meetingId || null;
    const host = $("#phase6-meeting-workspace");
    if (host && nextId) host.dataset.meetingId = nextId;
    if (nextId !== meetingId) bindMeeting(nextId);
    else renderWorkspace();
  });

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest('.nav-item[data-view="resolutions"]');
    if (nav) return queueMicrotask(showResolutionView);

    const action = event.target.closest("[data-phase6-action]")?.dataset.phase6Action;
    if (action === "open-agenda-form") { agendaFormOpen = true; return renderWorkspace(); }
    if (action === "close-agenda-form") { agendaFormOpen = false; return renderWorkspace(); }
    if (action === "cancel-motion") { motionDraftAgendaId = null; return renderWorkspace(); }
    if (action === "cancel-vote-setup") { voteSetupMotionId = null; return renderWorkspace(); }

    const newMotion = event.target.closest("[data-phase6-new-motion]")?.dataset.phase6NewMotion;
    if (newMotion) { motionDraftAgendaId = newMotion; return renderWorkspace(); }

    const secondId = event.target.closest("[data-phase6-second-motion]")?.dataset.phase6SecondMotion;
    if (secondId) {
      try { await secondMotion(secondId, currentProfile); } catch (error) { $("#phase6-global-message").textContent = error.message; }
      return;
    }

    const setupVote = event.target.closest("[data-phase6-setup-vote]")?.dataset.phase6SetupVote;
    if (setupVote) { voteSetupMotionId = setupVote; return renderWorkspace(); }

    const agendaStatusButton = event.target.closest("[data-phase6-agenda-status]");
    if (agendaStatusButton) {
      try { await setAgendaItemStatus(agendaStatusButton.dataset.agendaId, agendaStatusButton.dataset.phase6AgendaStatus, currentProfile); }
      catch (error) { $("#phase6-global-message").textContent = error.message; }
      return;
    }

    const castButton = event.target.closest("[data-phase6-cast]");
    if (castButton) return performCast(castButton);

    const closeButton = event.target.closest("[data-phase6-close-vote]");
    if (closeButton) return performCloseVote(closeButton);

    const resolutionCard = event.target.closest("[data-resolution-id]");
    if (resolutionCard) { selectedResolutionId = resolutionCard.dataset.resolutionId; return renderResolutions(); }

    if (event.target.closest("#phase6-refresh-resolutions")) return renderResolutions();
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "phase6-agenda-form") { event.preventDefault(); submitAgendaForm(event.target); }
    else if (event.target.matches("[data-phase6-motion-form]")) { event.preventDefault(); submitMotionForm(event.target); }
    else if (event.target.matches("[data-phase6-vote-form]")) { event.preventDefault(); submitVoteForm(event.target); }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "phase6-resolution-search") renderResolutions();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "phase6-resolution-status") renderResolutions();
  });
}

function teardown() {
  clearMeetingStreams();
  resolutionsUnsub?.();
  resolutionsUnsub = null;
  currentProfile = null;
  resolutions = [];
}

async function applyAuthUser(user) {
  if (!user) return teardown();
  const profile = await loadProfile(user.uid);
  if (!profile || profile.accountStatus !== "active") return;
  currentProfile = profile;
  const resolutionNav = $('.nav-item[data-view="resolutions"]');
  if (resolutionNav) resolutionNav.hidden = !hasPermission(profile, PERMISSIONS.RESOLUTIONS_VIEW);
  bindResolutions();
}

function init() {
  if (initialized) return;
  initialized = true;
  installStylesheet();
  ensureResolutionView();
  bindGlobalUI();
  onAuthStateChanged(auth, (user) => applyAuthUser(user).catch((error) => console.error("Phase 6 authentication initialization failed", error)));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
