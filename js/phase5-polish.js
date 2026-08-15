import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth } from "./firebase.js";

let observer = null;
let lastMeetingId = null;
let initialized = false;

const $ = (selector) => document.querySelector(selector);

function selectedMeetingId() {
  return $(".meeting-card.selected")?.dataset.meetingId || null;
}

function dispatchMeetingSelection(force = false) {
  const meetingId = selectedMeetingId();
  if (!meetingId) return;
  if (!force && meetingId === lastMeetingId && $("#phase6-meeting-workspace")) return;
  lastMeetingId = meetingId;
  window.dispatchEvent(new CustomEvent("tpp:meeting-selected", { detail: { meetingId } }));
}

function ensureInviteTools() {
  const grid = $("#meeting-invite-grid");
  if (!grid || $("#phase5-invite-tools")) return;

  const tools = document.createElement("div");
  tools.id = "phase5-invite-tools";
  tools.className = "phase5-invite-tools";
  tools.innerHTML = `
    <div><strong id="phase5-invite-count">0 selected</strong><span>Choose the official meeting roster before creating the meeting.</span></div>
    <div class="phase5-invite-actions">
      <button type="button" class="meeting-secondary-button" data-phase5-invite="all">Select all</button>
      <button type="button" class="meeting-secondary-button" data-phase5-invite="none">Clear</button>
    </div>`;
  grid.parentElement?.insertBefore(tools, grid);
  syncInviteCount();
}

function syncInviteCount() {
  const count = document.querySelectorAll('#meeting-invite-grid input[name="meetingInvitee"]:checked').length;
  const total = document.querySelectorAll('#meeting-invite-grid input[name="meetingInvitee"]').length;
  const label = $("#phase5-invite-count");
  if (label) label.textContent = `${count} of ${total} selected`;
}

function ensureMeetingPolish() {
  const detail = $("#meeting-detail");
  if (!detail) return;

  const selected = $(".meeting-card.selected");
  const meetingId = selected?.dataset.meetingId;
  if (!meetingId) return;

  let createdWorkspace = false;
  if (!$("#phase5-live-meta")) {
    const strip = detail.querySelector(".meeting-live-strip");
    if (strip) {
      const meta = document.createElement("div");
      meta.id = "phase5-live-meta";
      meta.className = "phase5-live-meta";
      meta.innerHTML = `<span class="phase5-live-dot" aria-hidden="true"></span><strong>Live Boardroom</strong><span id="phase5-last-sync">Live Firestore updates enabled</span>`;
      strip.after(meta);
    }
  }

  if (!$("#phase6-meeting-workspace")) {
    const workspace = document.createElement("section");
    workspace.id = "phase6-meeting-workspace";
    workspace.className = "phase6-host";
    workspace.dataset.meetingId = meetingId;
    workspace.innerHTML = '<div class="phase5-phase6-placeholder"><strong>Board Actions</strong><span>Loading agenda, motions, and voting workspace…</span></div>';
    detail.append(workspace);
    createdWorkspace = true;
  }

  const workspace = $("#phase6-meeting-workspace");
  const phase6ReadyNeedsHandoff = Boolean($("#view-resolutions") && workspace && workspace.dataset.phase6Bound !== "true");
  if (phase6ReadyNeedsHandoff) workspace.dataset.phase6Bound = "true";
  dispatchMeetingSelection(createdWorkspace || meetingId !== lastMeetingId || phase6ReadyNeedsHandoff);
}

function installConfirmationGuard() {
  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-meeting-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.meetingAction;
    const prompts = {
      activate: "Open director check-in for this meeting?",
      "call-order": "Call this Board meeting to order?",
      recess: "Place this meeting into recess?",
      resume: "Resume this Board meeting?",
      adjourn: "Adjourn this meeting? Attendance will become locked and Phase 5 will not reopen it.",
      cancel: "Cancel this meeting? Attendance will become locked and the meeting cannot be reopened in Phase 5."
    };
    if (!prompts[action]) return;
    if (!window.confirm(prompts[action])) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

function installInteractionEnhancements() {
  document.addEventListener("click", (event) => {
    const inviteAction = event.target.closest("[data-phase5-invite]")?.dataset.phase5Invite;
    if (inviteAction) {
      const checked = inviteAction === "all";
      document.querySelectorAll('#meeting-invite-grid input[name="meetingInvitee"]').forEach((input) => { input.checked = checked; });
      syncInviteCount();
      return;
    }

    const meetingCard = event.target.closest("[data-meeting-id]");
    if (meetingCard) queueMicrotask(() => dispatchMeetingSelection(true));
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches('#meeting-invite-grid input[name="meetingInvitee"]')) syncInviteCount();
  });
}

function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    ensureInviteTools();
    syncInviteCount();
    ensureMeetingPolish();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureInviteTools();
  ensureMeetingPolish();
}

function teardown() {
  lastMeetingId = null;
  if (observer) observer.disconnect();
  observer = null;
}

function init() {
  if (initialized) return;
  initialized = true;
  installConfirmationGuard();
  installInteractionEnhancements();
  onAuthStateChanged(auth, (user) => {
    if (!user) return teardown();
    startObserver();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
