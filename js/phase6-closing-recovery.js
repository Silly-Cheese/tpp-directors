import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { calculateVoteResult } from "./governance-data.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

let profile = null;
let initialized = false;
let observerFrame = null;

function resolutionNumber(id) {
  return `BR-${new Date().getFullYear()}-${String(id).slice(0, 6).toUpperCase()}`;
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

async function readFrozenBallots(voteId, voterUids = []) {
  const snapshots = await Promise.all(voterUids.map((uid) => getDoc(doc(db, "voteBallots", `${voteId}_${uid}`))));
  return snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => snapshot.data());
}

async function finalizeClosingVote(voteId) {
  if (!profile || !hasPermission(profile, PERMISSIONS.VOTES_CLOSE) || !hasPermission(profile, PERMISSIONS.RESOLUTIONS_CREATE)) {
    throw new Error("Your account is not authorized to finalize this Board vote.");
  }

  const voteRef = doc(db, "votes", voteId);
  const voteSnapshot = await getDoc(voteRef);
  if (!voteSnapshot.exists()) throw new Error("Vote not found.");
  const vote = voteSnapshot.data();
  if (vote.status === "closed") return;
  if (vote.status !== "closing") throw new Error("This vote is not in the recoverable Closing state.");

  const ballots = await readFrozenBallots(voteId, vote.eligibleVoterUids || []);
  const counts = {
    approve: ballots.filter((entry) => entry.choice === "approve").length,
    oppose: ballots.filter((entry) => entry.choice === "oppose").length,
    abstain: ballots.filter((entry) => entry.choice === "abstain").length
  };
  const result = calculateVoteResult(vote.thresholdMode, counts, vote.eligibleVoterUids?.length || 0);
  const resolutionRef = doc(collection(db, "resolutions"));

  await runTransaction(db, async (transaction) => {
    const [freshVoteSnapshot, meetingSnapshot, motionSnapshot] = await Promise.all([
      transaction.get(voteRef),
      transaction.get(doc(db, "meetings", vote.meetingId)),
      transaction.get(doc(db, "motions", vote.motionId))
    ]);
    if (!freshVoteSnapshot.exists() || freshVoteSnapshot.data().status !== "closing") throw new Error("The vote is no longer waiting to be finalized.");
    if (!meetingSnapshot.exists() || meetingSnapshot.data().status !== "in_session" || meetingSnapshot.data().activeVoteId !== voteId) {
      throw new Error("The meeting no longer owns this Closing vote.");
    }
    if (!motionSnapshot.exists() || motionSnapshot.data().status !== "voting") throw new Error("The motion record is not ready to finalize.");

    const motion = motionSnapshot.data();
    const meeting = meetingSnapshot.data();
    transaction.update(voteRef, {
      status: "closed",
      approveCount: result.approve,
      opposeCount: result.oppose,
      abstainCount: result.abstain,
      ballotCount: ballots.length,
      requiredApproveCount: result.required,
      result: result.result,
      resolutionId: resolutionRef.id,
      closedBy: auth.currentUser.uid,
      closedByName: profile.displayName || profile.fullName || "Vote Controller",
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    transaction.update(doc(db, "meetings", vote.meetingId), {
      activeVoteId: null,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    transaction.update(doc(db, "motions", vote.motionId), {
      status: result.adopted ? "adopted" : "failed",
      resolutionId: resolutionRef.id,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    transaction.update(doc(db, "agendaItems", vote.agendaItemId), {
      status: "completed",
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    transaction.set(resolutionRef, {
      resolutionNumber: resolutionNumber(resolutionRef.id),
      meetingId: vote.meetingId,
      meetingNumber: meeting.meetingNumber || vote.meetingNumber || null,
      agendaItemId: vote.agendaItemId,
      motionId: vote.motionId,
      voteId,
      title: vote.question,
      resolutionText: motion.motionText,
      status: result.result,
      thresholdMode: vote.thresholdMode,
      ballotVisibility: vote.ballotVisibility,
      approveCount: result.approve,
      opposeCount: result.oppose,
      abstainCount: result.abstain,
      ballotCount: ballots.length,
      eligibleVoterCount: vote.eligibleVoterUids?.length || 0,
      requiredApproveCount: result.required,
      movedByUid: motion.movedByUid,
      movedByName: motion.movedByName,
      secondedByUid: motion.secondedByUid,
      secondedByName: motion.secondedByName,
      adoptedAt: result.adopted ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid,
      certified: false,
      certifiedAt: null,
      certifiedBy: null,
      certifiedByName: null,
      recordId: null
    });
  });
}

function setMessage(voteId, text) {
  const target = document.querySelector(`[data-phase6-vote-card-message="${CSS.escape(voteId)}"]`);
  if (target && target.textContent !== text) target.textContent = text;
}

async function inspectClosingButton(button) {
  if (!button?.isConnected || button.dataset.phase6RecoveryChecked === "true") return;
  button.dataset.phase6RecoveryChecked = "true";
  const voteId = button.dataset.phase6CloseVote;
  if (!voteId) return;
  try {
    const snapshot = await getDoc(doc(db, "votes", voteId));
    if (!snapshot.exists() || snapshot.data().status !== "closing" || !button.isConnected) return;
    if (button.textContent !== "Finalize Closing Vote") button.textContent = "Finalize Closing Vote";
    button.dataset.phase6ClosingRecovery = "true";
    button.closest(".phase6-vote-card")?.querySelectorAll("[data-phase6-cast]").forEach((cast) => {
      if (!cast.disabled) cast.disabled = true;
    });
    const status = button.closest(".phase6-vote-card")?.querySelector(".phase6-vote-head em");
    if (status && status.textContent !== "Closing — ballots frozen") status.textContent = "Closing — ballots frozen";
  } catch {
    // A future Phase 6 rerender creates a fresh button and will retry automatically.
  }
}

function markClosingButtons() {
  observerFrame = null;
  document.querySelectorAll("[data-phase6-close-vote]").forEach((button) => {
    void inspectClosingButton(button);
  });
}

function queueClosingButtonScan() {
  if (observerFrame !== null) return;
  observerFrame = requestAnimationFrame(markClosingButtons);
}

function init() {
  if (initialized) return;
  initialized = true;

  const observer = new MutationObserver(queueClosingButtonScan);
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-phase6-close-vote]");
    if (!button || button.dataset.phase6ClosingRecovery !== "true") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const voteId = button.dataset.phase6CloseVote;
    if (!window.confirm("Finalize this already-Closing vote? Ballot intake is frozen and the preserved ballot set will be tallied.")) return;
    button.disabled = true;
    finalizeClosingVote(voteId).catch((error) => {
      button.disabled = false;
      setMessage(voteId, error.message || "The Closing vote could not be finalized.");
    });
  }, true);

  onAuthStateChanged(auth, async (user) => {
    profile = user ? await loadProfile(user.uid) : null;
    document.querySelectorAll("[data-phase6-close-vote]").forEach((button) => {
      delete button.dataset.phase6RecoveryChecked;
    });
    queueClosingButtonScan();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
