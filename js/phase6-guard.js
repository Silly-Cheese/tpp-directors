import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase.js";
import { calculateQuorum } from "./meeting-data.js";

let initialized = false;

function selectedMeetingId() {
  return document.querySelector(".meeting-card.selected")?.dataset.meetingId || null;
}

async function confirmQuorumAtClose(button) {
  const meetingId = selectedMeetingId();
  if (!meetingId) throw new Error("The selected meeting is unavailable.");
  const [meetingSnapshot, attendanceSnapshot] = await Promise.all([
    getDoc(doc(db, "meetings", meetingId)),
    getDocs(query(collection(db, "meetingAttendance"), where("meetingId", "==", meetingId)))
  ]);
  if (!meetingSnapshot.exists()) throw new Error("The Board meeting no longer exists.");
  const meeting = meetingSnapshot.data();
  if (meeting.status !== "in_session") throw new Error("The meeting must be in session before the vote can be closed.");
  const attendance = attendanceSnapshot.docs.map((entry) => entry.data());
  const quorum = calculateQuorum(meeting, attendance);
  if (!quorum.achieved) {
    throw new Error(`Quorum is no longer present (${quorum.presentEligible}/${quorum.required}). The vote remains open.`);
  }
  button.dataset.phase6QuorumVerified = "true";
  button.disabled = false;
  button.click();
  delete button.dataset.phase6QuorumVerified;
}

function init() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-phase6-close-vote]");
    if (closeButton && closeButton.dataset.phase6QuorumVerified !== "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeButton.disabled = true;
      confirmQuorumAtClose(closeButton).catch((error) => {
        closeButton.disabled = false;
        const voteId = closeButton.dataset.phase6CloseVote;
        const message = document.querySelector(`[data-phase6-vote-card-message="${CSS.escape(voteId)}"]`);
        if (message) message.textContent = error.message || "The vote cannot be closed right now.";
      });
      return;
    }

    const motionButton = event.target.closest("[data-phase6-new-motion]");
    if (motionButton) {
      const agendaItem = motionButton.closest(".phase6-agenda-item");
      if (agendaItem?.classList.contains("completed") || agendaItem?.classList.contains("tabled") || agendaItem?.classList.contains("withdrawn")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
