import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { calculateQuorum } from "./meeting-data.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

export const AGENDA_ITEM_TYPES = Object.freeze(["business", "report", "motion", "resolution", "election", "other"]);
export const AGENDA_STATUSES = Object.freeze(["queued", "active", "completed", "tabled", "withdrawn"]);
export const MOTION_STATUSES = Object.freeze(["pending_second", "ready", "voting", "adopted", "failed", "tabled", "withdrawn"]);
export const VOTE_STATUSES = Object.freeze(["open", "closed"]);
export const BALLOT_CHOICES = Object.freeze(["approve", "oppose", "abstain"]);
export const BALLOT_VISIBILITIES = Object.freeze(["recorded", "confidential"]);
export const THRESHOLD_MODES = Object.freeze(["simple_majority_cast", "majority_eligible", "two_thirds_cast"]);

const ITEM_TYPES = new Set(AGENDA_ITEM_TYPES);
const AGENDA_STATUS_SET = new Set(AGENDA_STATUSES);
const BALLOT_CHOICE_SET = new Set(BALLOT_CHOICES);
const BALLOT_VISIBILITY_SET = new Set(BALLOT_VISIBILITIES);
const THRESHOLD_SET = new Set(THRESHOLD_MODES);

function requireAuth() {
  if (!auth.currentUser) throw new Error("Sign in to continue.");
}

function requirePermission(profile, permission, message) {
  requireAuth();
  if (!hasPermission(profile, permission)) throw new Error(message);
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function agendaNumber(id) {
  return `AI-${String(id).slice(0, 6).toUpperCase()}`;
}

function motionNumber(id) {
  return `MOT-${new Date().getFullYear()}-${String(id).slice(0, 6).toUpperCase()}`;
}

function voteNumber(id) {
  return `VOTE-${new Date().getFullYear()}-${String(id).slice(0, 6).toUpperCase()}`;
}

function resolutionNumber(id) {
  return `BR-${new Date().getFullYear()}-${String(id).slice(0, 6).toUpperCase()}`;
}

function ballotId(voteId, uid) {
  return `${voteId}_${uid}`;
}

function recusalId(voteId, uid) {
  return `${voteId}_${uid}`;
}

export function statusLabel(value = "") {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function thresholdLabel(mode = "simple_majority_cast") {
  const labels = {
    simple_majority_cast: "Simple majority of votes cast",
    majority_eligible: "Majority of eligible voters",
    two_thirds_cast: "Two-thirds of non-abstaining votes cast"
  };
  return labels[mode] || labels.simple_majority_cast;
}

export function calculateVoteResult(mode, counts, eligibleCount) {
  const approve = Math.max(0, Number(counts?.approve) || 0);
  const oppose = Math.max(0, Number(counts?.oppose) || 0);
  const abstain = Math.max(0, Number(counts?.abstain) || 0);
  const eligible = Math.max(0, Number(eligibleCount) || 0);
  const decisive = approve + oppose;
  let required = 0;
  let adopted = false;

  if (mode === "majority_eligible") {
    required = Math.floor(eligible / 2) + 1;
    adopted = approve >= required;
  } else if (mode === "two_thirds_cast") {
    required = decisive > 0 ? Math.ceil((decisive * 2) / 3) : 1;
    adopted = approve >= required;
  } else {
    required = decisive > 0 ? Math.floor(decisive / 2) + 1 : 1;
    adopted = approve >= required;
  }

  return { approve, oppose, abstain, eligible, decisive, required, adopted, result: adopted ? "adopted" : "failed" };
}

export async function listMeetingAgenda(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_VIEW, "Your account does not have Board meeting access.");
  const snapshot = await getDocs(query(collection(db, "agendaItems"), where("meetingId", "==", meetingId)));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

export async function listMeetingMotions(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_VIEW, "Your account does not have Board meeting access.");
  const snapshot = await getDocs(query(collection(db, "motions"), where("meetingId", "==", meetingId)));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
}

export async function listMeetingVotes(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.VOTES_VIEW, "Your account does not have voting-record access.");
  const snapshot = await getDocs(query(collection(db, "votes"), where("meetingId", "==", meetingId)));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(b.openedAt) - timestampValue(a.openedAt));
}

export async function listVoteBallots(voteId, profile) {
  requirePermission(profile, PERMISSIONS.VOTES_VIEW, "Your account does not have voting-record access.");
  const snapshot = await getDocs(query(collection(db, "voteBallots"), where("voteId", "==", voteId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function listVoteRecusals(voteId, profile) {
  requirePermission(profile, PERMISSIONS.VOTES_VIEW, "Your account does not have voting-record access.");
  const snapshot = await getDocs(query(collection(db, "voteRecusals"), where("voteId", "==", voteId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function listResolutions(profile) {
  requirePermission(profile, PERMISSIONS.RESOLUTIONS_VIEW, "Your account does not have resolution-registry access.");
  const snapshot = await getDocs(collection(db, "resolutions"));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

export async function createAgendaItem(meetingId, input, profile) {
  requirePermission(profile, PERMISSIONS.AGENDA_MANAGE, "Your account is not authorized to manage Board agendas.");
  const meetingSnapshot = await getDoc(doc(db, "meetings", meetingId));
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  const meeting = meetingSnapshot.data();
  if (["adjourned", "cancelled"].includes(meeting.status)) throw new Error("The agenda is locked for this meeting.");

  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  if (!title) throw new Error("Enter an agenda item title.");
  const itemType = ITEM_TYPES.has(input.itemType) ? input.itemType : "business";

  const existing = await listMeetingAgenda(meetingId, profile);
  const order = existing.length ? Math.max(...existing.map((entry) => Number(entry.order) || 0)) + 10 : 10;
  const itemRef = doc(collection(db, "agendaItems"));
  const batch = writeBatch(db);

  let documentRecord = null;
  const documentId = String(input.documentId || "").trim() || null;
  if (documentId) {
    const documentSnapshot = await getDoc(doc(db, "documents", documentId));
    if (!documentSnapshot.exists()) throw new Error("The selected Board document no longer exists.");
    documentRecord = documentSnapshot.data();
    if (documentRecord.status !== "agenda_ready") throw new Error("Only Agenda Ready documents can be attached to a meeting agenda.");
    if (documentRecord.agendaMeetingId && documentRecord.agendaMeetingId !== meetingId) throw new Error("That Board document is already attached to another meeting.");
    batch.update(doc(db, "documents", documentId), {
      agendaMeetingId: meetingId,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
  }

  batch.set(itemRef, {
    agendaNumber: agendaNumber(itemRef.id),
    meetingId,
    meetingNumber: meeting.meetingNumber || null,
    order,
    itemType,
    title,
    description: description || null,
    documentId,
    documentNumber: documentRecord?.documentNumber || null,
    documentTitle: documentRecord?.title || null,
    documentUrl: documentRecord?.documentUrl || null,
    status: "queued",
    createdBy: auth.currentUser.uid,
    createdByName: profile.displayName || profile.fullName || "Director",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  await batch.commit();
  return { id: itemRef.id };
}

export async function setAgendaItemStatus(agendaItemId, nextStatus, profile) {
  requirePermission(profile, PERMISSIONS.AGENDA_MANAGE, "Your account is not authorized to manage Board agendas.");
  if (!AGENDA_STATUS_SET.has(nextStatus)) throw new Error("Choose a valid agenda status.");
  const itemRef = doc(db, "agendaItems", agendaItemId);
  const itemSnapshot = await getDoc(itemRef);
  if (!itemSnapshot.exists()) throw new Error("Agenda item not found.");
  const item = itemSnapshot.data();
  const meetingSnapshot = await getDoc(doc(db, "meetings", item.meetingId));
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  if (["adjourned", "cancelled"].includes(meetingSnapshot.data().status)) throw new Error("The agenda is locked for this meeting.");

  await writeBatch(db).update(itemRef, {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  }).commit();
}

export async function createMotion(meetingId, agendaItemId, text, profile) {
  requirePermission(profile, PERMISSIONS.MOTIONS_CREATE, "Your account is not authorized to make Board motions through the portal.");
  requireAuth();
  const motionText = String(text || "").trim();
  if (!motionText) throw new Error("Enter the text of the motion.");

  const [meetingSnapshot, attendanceSnapshot, agendaSnapshot] = await Promise.all([
    getDoc(doc(db, "meetings", meetingId)),
    getDoc(doc(db, "meetingAttendance", `${meetingId}_${auth.currentUser.uid}`)),
    getDoc(doc(db, "agendaItems", agendaItemId))
  ]);
  if (!meetingSnapshot.exists() || meetingSnapshot.data().status !== "in_session") throw new Error("Motions can be entered only while the meeting is in session.");
  if (!attendanceSnapshot.exists() || attendanceSnapshot.data().presenceStatus !== "present" || attendanceSnapshot.data().votingEligible !== true) {
    throw new Error("You must be a present voting-eligible director to make a motion.");
  }
  if (!agendaSnapshot.exists() || agendaSnapshot.data().meetingId !== meetingId) throw new Error("Agenda item not found for this meeting.");

  const motionRef = doc(collection(db, "motions"));
  const batch = writeBatch(db);
  batch.set(motionRef, {
    motionNumber: motionNumber(motionRef.id),
    meetingId,
    agendaItemId,
    motionText,
    status: "pending_second",
    movedByUid: auth.currentUser.uid,
    movedByName: profile.displayName || profile.fullName || "Director",
    secondedByUid: null,
    secondedByName: null,
    secondedAt: null,
    voteId: null,
    resolutionId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.update(doc(db, "agendaItems", agendaItemId), {
    status: "active",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  await batch.commit();
  return { id: motionRef.id };
}

export async function secondMotion(motionId, profile) {
  requirePermission(profile, PERMISSIONS.MOTIONS_SECOND, "Your account is not authorized to second Board motions through the portal.");
  requireAuth();
  const motionRef = doc(db, "motions", motionId);
  const motionSnapshot = await getDoc(motionRef);
  if (!motionSnapshot.exists()) throw new Error("Motion not found.");
  const motion = motionSnapshot.data();
  if (motion.status !== "pending_second") throw new Error("This motion is not awaiting a second.");
  if (motion.movedByUid === auth.currentUser.uid) throw new Error("The director who made the motion cannot second it.");

  const [meetingSnapshot, attendanceSnapshot] = await Promise.all([
    getDoc(doc(db, "meetings", motion.meetingId)),
    getDoc(doc(db, "meetingAttendance", `${motion.meetingId}_${auth.currentUser.uid}`))
  ]);
  if (!meetingSnapshot.exists() || meetingSnapshot.data().status !== "in_session") throw new Error("The meeting is not currently in session.");
  if (!attendanceSnapshot.exists() || attendanceSnapshot.data().presenceStatus !== "present" || attendanceSnapshot.data().votingEligible !== true) {
    throw new Error("You must be a present voting-eligible director to second a motion.");
  }

  await writeBatch(db).update(motionRef, {
    status: "ready",
    secondedByUid: auth.currentUser.uid,
    secondedByName: profile.displayName || profile.fullName || "Director",
    secondedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  }).commit();
}

export async function openVote(input, profile) {
  requirePermission(profile, PERMISSIONS.VOTES_PUSH, "Your account is not authorized to push Board votes.");
  requireAuth();

  const motionId = String(input.motionId || "").trim();
  const motionSnapshot = await getDoc(doc(db, "motions", motionId));
  if (!motionSnapshot.exists()) throw new Error("Motion not found.");
  const motion = motionSnapshot.data();
  if (motion.status !== "ready") throw new Error("The motion must have a second before voting opens.");

  const meetingSnapshot = await getDoc(doc(db, "meetings", motion.meetingId));
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  const meeting = meetingSnapshot.data();
  if (meeting.status !== "in_session") throw new Error("Votes can be pushed only while the meeting is in session.");

  const attendanceSnapshot = await getDocs(query(collection(db, "meetingAttendance"), where("meetingId", "==", motion.meetingId)));
  const attendance = attendanceSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const quorum = calculateQuorum(meeting, attendance);
  if (!quorum.achieved) throw new Error(`Quorum is not present (${quorum.presentEligible}/${quorum.required}).`);

  const presentEligible = attendance.filter((entry) => entry.votingEligible === true && entry.presenceStatus === "present");
  const presentEligibleUids = new Set(presentEligible.map((entry) => entry.directorUid));
  const recusedDirectorUids = [...new Set((Array.isArray(input.recusedDirectorUids) ? input.recusedDirectorUids : []).map(String))]
    .filter((uid) => presentEligibleUids.has(uid));
  const recusedSet = new Set(recusedDirectorUids);
  const eligibleVoterUids = presentEligible.map((entry) => entry.directorUid).filter((uid) => !recusedSet.has(uid));
  if (!eligibleVoterUids.length) throw new Error("No eligible voters remain after recusals.");

  const ballotVisibility = BALLOT_VISIBILITY_SET.has(input.ballotVisibility) ? input.ballotVisibility : "recorded";
  const thresholdMode = THRESHOLD_SET.has(input.thresholdMode) ? input.thresholdMode : "simple_majority_cast";
  const voteRef = doc(collection(db, "votes"));
  const batch = writeBatch(db);

  batch.set(voteRef, {
    voteNumber: voteNumber(voteRef.id),
    meetingId: motion.meetingId,
    meetingNumber: meeting.meetingNumber || null,
    agendaItemId: motion.agendaItemId,
    motionId,
    question: String(input.question || motion.motionText).trim() || motion.motionText,
    status: "open",
    ballotVisibility,
    thresholdMode,
    eligibleVoterUids,
    recusedDirectorUids,
    quorumSnapshotPresent: quorum.presentEligible,
    quorumSnapshotRequired: quorum.required,
    openedBy: auth.currentUser.uid,
    openedByName: profile.displayName || profile.fullName || "Vote Controller",
    openedAt: serverTimestamp(),
    closedBy: null,
    closedByName: null,
    closedAt: null,
    approveCount: null,
    opposeCount: null,
    abstainCount: null,
    ballotCount: null,
    requiredApproveCount: null,
    result: "pending",
    resolutionId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });

  recusedDirectorUids.forEach((uid) => {
    const attendanceRecord = presentEligible.find((entry) => entry.directorUid === uid);
    batch.set(doc(db, "voteRecusals", recusalId(voteRef.id, uid)), {
      voteId: voteRef.id,
      meetingId: motion.meetingId,
      directorUid: uid,
      directorName: attendanceRecord?.directorName || "Director",
      reason: String(input.recusalReason || "").trim() || null,
      recordedBy: auth.currentUser.uid,
      recordedAt: serverTimestamp()
    });
  });

  batch.update(doc(db, "motions", motionId), {
    status: "voting",
    voteId: voteRef.id,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.update(doc(db, "agendaItems", motion.agendaItemId), {
    status: "active",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  await batch.commit();
  return { id: voteRef.id };
}

export async function castVote(voteId, choice, profile) {
  requirePermission(profile, PERMISSIONS.VOTES_CAST, "Your account is not authorized to cast Board votes.");
  requireAuth();
  if (!BALLOT_CHOICE_SET.has(choice)) throw new Error("Choose Approve, Oppose, or Abstain.");

  const voteSnapshot = await getDoc(doc(db, "votes", voteId));
  if (!voteSnapshot.exists()) throw new Error("Vote not found.");
  const vote = voteSnapshot.data();
  if (vote.status !== "open") throw new Error("This vote is closed.");
  if (!Array.isArray(vote.eligibleVoterUids) || !vote.eligibleVoterUids.includes(auth.currentUser.uid)) throw new Error("You are not eligible to cast this ballot.");

  const attendanceSnapshot = await getDoc(doc(db, "meetingAttendance", `${vote.meetingId}_${auth.currentUser.uid}`));
  if (!attendanceSnapshot.exists() || attendanceSnapshot.data().presenceStatus !== "present") throw new Error("You must currently be marked present to cast this ballot.");

  const ballotRef = doc(db, "voteBallots", ballotId(voteId, auth.currentUser.uid));
  if ((await getDoc(ballotRef)).exists()) throw new Error("Your ballot has already been recorded and cannot be changed.");

  await writeBatch(db).set(ballotRef, {
    voteId,
    meetingId: vote.meetingId,
    voterUid: auth.currentUser.uid,
    voterName: profile.displayName || profile.fullName || "Director",
    choice,
    ballotVisibility: vote.ballotVisibility,
    submittedAt: serverTimestamp()
  }).commit();
}

export async function closeVote(voteId, profile) {
  requirePermission(profile, PERMISSIONS.VOTES_CLOSE, "Your account is not authorized to close Board votes.");
  requirePermission(profile, PERMISSIONS.RESOLUTIONS_CREATE, "Your account is not authorized to create resolution records.");
  requireAuth();

  const voteRef = doc(db, "votes", voteId);
  const voteSnapshot = await getDoc(voteRef);
  if (!voteSnapshot.exists()) throw new Error("Vote not found.");
  const vote = voteSnapshot.data();
  if (vote.status !== "open") throw new Error("This vote is already closed.");

  const [meetingSnapshot, motionSnapshot, ballotsSnapshot] = await Promise.all([
    getDoc(doc(db, "meetings", vote.meetingId)),
    getDoc(doc(db, "motions", vote.motionId)),
    getDocs(query(collection(db, "voteBallots"), where("voteId", "==", voteId)))
  ]);
  if (!meetingSnapshot.exists() || meetingSnapshot.data().status !== "in_session") throw new Error("The meeting must be in session to close this vote.");
  if (!motionSnapshot.exists()) throw new Error("The motion record is unavailable.");

  const ballots = ballotsSnapshot.docs.map((entry) => entry.data());
  const counts = {
    approve: ballots.filter((entry) => entry.choice === "approve").length,
    oppose: ballots.filter((entry) => entry.choice === "oppose").length,
    abstain: ballots.filter((entry) => entry.choice === "abstain").length
  };
  const result = calculateVoteResult(vote.thresholdMode, counts, vote.eligibleVoterUids?.length || 0);
  const resolutionRef = doc(collection(db, "resolutions"));
  const motion = motionSnapshot.data();
  const meeting = meetingSnapshot.data();
  const batch = writeBatch(db);

  batch.update(voteRef, {
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
  batch.update(doc(db, "motions", vote.motionId), {
    status: result.adopted ? "adopted" : "failed",
    resolutionId: resolutionRef.id,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.update(doc(db, "agendaItems", vote.agendaItemId), {
    status: "completed",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.set(resolutionRef, {
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
    certifiedBy: null
  });
  await batch.commit();
  return { resolutionId: resolutionRef.id, ...result };
}
