import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase.js";

let initialized = false;

async function listByMeeting(collectionName, meetingId) {
  const snapshot = await getDocs(query(collection(db, collectionName), where("meetingId", "==", meetingId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function selectedMeetingId() {
  return document.querySelector(".meeting-card.selected")?.dataset.meetingId
    || document.querySelector("#phase7-minutes-workspace")?.dataset.meetingId
    || null;
}

function showMessage(text) {
  const message = document.querySelector("#phase7-action-message");
  if (message) message.textContent = text;
}

async function verifyCertification(button) {
  const meetingId = selectedMeetingId();
  if (!meetingId) throw new Error("The selected Board meeting is unavailable.");
  const [meetingSnapshot, agenda, motions, votes] = await Promise.all([
    getDoc(doc(db, "meetings", meetingId)),
    listByMeeting("agendaItems", meetingId),
    listByMeeting("motions", meetingId),
    listByMeeting("votes", meetingId)
  ]);
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  const meeting = meetingSnapshot.data();
  if (meeting.status !== "adjourned") throw new Error("The meeting must be adjourned before certification.");
  if (meeting.activeVoteId) throw new Error("An active Board vote must be completed before certification.");

  const activeAgenda = agenda.filter((entry) => entry.status === "active");
  const liveMotions = motions.filter((entry) => entry.status === "voting");
  const unfinishedVotes = votes.filter((entry) => entry.status !== "closed");
  if (activeAgenda.length || liveMotions.length || unfinishedVotes.length) {
    const problems = [];
    if (activeAgenda.length) problems.push(`${activeAgenda.length} active agenda item${activeAgenda.length === 1 ? "" : "s"}`);
    if (liveMotions.length) problems.push(`${liveMotions.length} motion${liveMotions.length === 1 ? "" : "s"} still marked Voting`);
    if (unfinishedVotes.length) problems.push(`${unfinishedVotes.length} vote${unfinishedVotes.length === 1 ? "" : "s"} not fully closed`);
    throw new Error(`Certification preflight failed: ${problems.join(", ")}. Resolve the live business before sealing the permanent record.`);
  }

  const unresolvedMotions = motions.filter((entry) => ["pending_second", "ready"].includes(entry.status));
  if (unresolvedMotions.length) {
    const proceed = window.confirm(
      `${unresolvedMotions.length} motion${unresolvedMotions.length === 1 ? " remains" : "s remain"} unresolved at adjournment. `
      + "The permanent record will preserve those unresolved states. Continue certification?"
    );
    if (!proceed) throw new Error("Certification cancelled so unresolved motions can be reviewed.");
  }

  button.dataset.phase7PreflightVerified = "true";
  button.disabled = false;
  button.click();
  delete button.dataset.phase7PreflightVerified;
}

function init() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-phase7-action="certify"]');
    if (!button || button.dataset.phase7PreflightVerified === "true") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    showMessage("Running permanent-record preflight…");
    verifyCertification(button).catch((error) => {
      button.disabled = false;
      showMessage(error.message || "The permanent record could not pass certification preflight.");
    });
  }, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
