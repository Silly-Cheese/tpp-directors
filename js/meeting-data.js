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
import { hasPermission, PERMISSIONS } from "./permissions.js";

export const MEETING_STATUSES = Object.freeze([
  "scheduled",
  "checkin_open",
  "in_session",
  "recessed",
  "adjourned",
  "cancelled"
]);

export const MEETING_TYPES = Object.freeze([
  "regular",
  "special",
  "organizational",
  "emergency"
]);

export const PRESENCE_STATUSES = Object.freeze([
  "invited",
  "present",
  "departed",
  "excused",
  "absent"
]);

const VALID_TYPES = new Set(MEETING_TYPES);
const VALID_PRESENCE = new Set(PRESENCE_STATUSES);
const CONTROL_TRANSITIONS = Object.freeze({
  scheduled: new Set(["checkin_open", "cancelled"]),
  checkin_open: new Set(["in_session", "cancelled"]),
  in_session: new Set(["recessed", "adjourned"]),
  recessed: new Set(["in_session", "adjourned"]),
  adjourned: new Set(),
  cancelled: new Set()
});

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

function meetingNumberFromId(id) {
  return `BM-${new Date().getFullYear()}-${String(id).slice(0, 6).toUpperCase()}`;
}

function attendanceId(meetingId, uid) {
  return `${meetingId}_${uid}`;
}

export function meetingStatusLabel(status = "") {
  return String(status || "scheduled")
    .replace("checkin", "check-in")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function defaultQuorumFor(eligibleCount) {
  const count = Math.max(0, Number(eligibleCount) || 0);
  return count > 0 ? Math.floor(count / 2) + 1 : 0;
}

export function calculateQuorum(meeting, attendance = []) {
  const presentEligible = attendance.filter((entry) => entry.votingEligible === true && entry.presenceStatus === "present").length;
  const required = Math.max(0, Number(meeting?.quorumRequired) || 0);
  return {
    presentEligible,
    required,
    achieved: required > 0 && presentEligible >= required
  };
}

export function isMeetingTransitionAllowed(currentStatus, nextStatus) {
  return CONTROL_TRANSITIONS[currentStatus]?.has(nextStatus) === true;
}

export async function createBoardMeeting(input, profile, directoryEntries = []) {
  requirePermission(profile, PERMISSIONS.MEETINGS_CREATE, "Your account is not authorized to create Board meetings.");

  const title = String(input.title || "").trim();
  if (!title) throw new Error("Enter a meeting title.");

  const meetingType = VALID_TYPES.has(input.meetingType) ? input.meetingType : "regular";
  const scheduledFor = String(input.scheduledFor || "").trim();
  if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) throw new Error("Choose a valid meeting date and time.");

  const requestedUids = [...new Set((Array.isArray(input.invitedDirectorUids) ? input.invitedDirectorUids : []).map(String))];
  if (!requestedUids.length) throw new Error("Invite at least one director to the meeting.");
  if (requestedUids.length > 100) throw new Error("A meeting may not contain more than 100 invited directors.");

  const directoryByUid = new Map(directoryEntries.map((entry) => [entry.uid, entry]));
  const invitees = requestedUids.map((uid) => directoryByUid.get(uid)).filter(Boolean);
  if (invitees.length !== requestedUids.length) throw new Error("One or more selected directors are no longer available in the Board directory.");

  const eligibleInvitees = invitees.filter((entry) => entry.votingStatus !== "ineligible");
  const autoQuorum = defaultQuorumFor(eligibleInvitees.length);
  const suppliedQuorum = Number(input.quorumRequired);
  const quorumRequired = Number.isInteger(suppliedQuorum) && suppliedQuorum > 0 ? suppliedQuorum : autoQuorum;
  if (quorumRequired < 1 || quorumRequired > eligibleInvitees.length) {
    throw new Error("Quorum must be at least 1 and cannot exceed the number of invited voting-eligible directors.");
  }

  const meetingRef = doc(collection(db, "meetings"));
  const actorUid = auth.currentUser.uid;
  const meeting = {
    meetingNumber: meetingNumberFromId(meetingRef.id),
    title,
    meetingType,
    scheduledFor,
    locationMode: ["in_person", "virtual", "hybrid"].includes(input.locationMode) ? input.locationMode : "in_person",
    locationLabel: String(input.locationLabel || "").trim() || null,
    status: "scheduled",
    invitedDirectorUids: invitees.map((entry) => entry.uid),
    eligibleVotingDirectorUids: eligibleInvitees.map((entry) => entry.uid),
    quorumRequired,
    createdBy: actorUid,
    createdByName: profile.displayName || profile.fullName || "Director",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
    checkInOpenedAt: null,
    calledToOrderAt: null,
    recessedAt: null,
    resumedAt: null,
    adjournedAt: null,
    cancelledAt: null
  };

  const batch = writeBatch(db);
  batch.set(meetingRef, meeting);
  invitees.forEach((entry) => {
    batch.set(doc(db, "meetingAttendance", attendanceId(meetingRef.id, entry.uid)), {
      meetingId: meetingRef.id,
      directorUid: entry.uid,
      directorNumber: entry.directorNumber || null,
      directorName: entry.displayName || entry.fullName || "Director",
      boardRole: entry.boardRole || "Director",
      officerRole: entry.officerRole || null,
      votingEligible: entry.votingStatus !== "ineligible",
      invited: true,
      presenceStatus: "invited",
      checkedInAt: null,
      departedAt: null,
      returnedAt: null,
      excusedAt: null,
      absentAt: null,
      lastPresenceChangeAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actorUid
    });
  });
  await batch.commit();
  return { id: meetingRef.id, ...meeting };
}

export async function listBoardMeetings(profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_VIEW, "Your account does not have Board meeting access.");
  const snapshot = await getDocs(collection(db, "meetings"));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(b.scheduledFor) - timestampValue(a.scheduledFor));
}

export async function getBoardMeeting(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_VIEW, "Your account does not have Board meeting access.");
  const snapshot = await getDoc(doc(db, "meetings", meetingId));
  if (!snapshot.exists()) throw new Error("Board meeting not found.");
  return { id: snapshot.id, ...snapshot.data() };
}

export async function listMeetingAttendance(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_VIEW, "Your account does not have Board meeting access.");
  const snapshot = await getDocs(query(collection(db, "meetingAttendance"), where("meetingId", "==", meetingId)));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.directorNumber || a.directorName || "").localeCompare(String(b.directorNumber || b.directorName || "")));
}

async function transitionMeeting(meetingId, nextStatus, profile) {
  const meetingRef = doc(db, "meetings", meetingId);
  const snapshot = await getDoc(meetingRef);
  if (!snapshot.exists()) throw new Error("Board meeting not found.");
  const meeting = snapshot.data();

  const activating = meeting.status === "scheduled" && nextStatus === "checkin_open";
  if (activating) {
    requirePermission(profile, PERMISSIONS.MEETINGS_ACTIVATE, "Your account is not authorized to activate Board meetings.");
  } else {
    requirePermission(profile, PERMISSIONS.MEETINGS_CONTROL, "Your account is not authorized to control live Board meetings.");
  }

  if (!isMeetingTransitionAllowed(meeting.status, nextStatus)) {
    throw new Error(`${meetingStatusLabel(meeting.status)} cannot move directly to ${meetingStatusLabel(nextStatus)}.`);
  }

  const patch = {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  if (nextStatus === "checkin_open") patch.checkInOpenedAt = serverTimestamp();
  if (meeting.status === "checkin_open" && nextStatus === "in_session") patch.calledToOrderAt = serverTimestamp();
  if (nextStatus === "recessed") patch.recessedAt = serverTimestamp();
  if (meeting.status === "recessed" && nextStatus === "in_session") patch.resumedAt = serverTimestamp();
  if (nextStatus === "adjourned") patch.adjournedAt = serverTimestamp();
  if (nextStatus === "cancelled") patch.cancelledAt = serverTimestamp();

  await writeBatch(db).update(meetingRef, patch).commit();
}

export function openMeetingCheckIn(meetingId, profile) {
  return transitionMeeting(meetingId, "checkin_open", profile);
}

export function callMeetingToOrder(meetingId, profile) {
  return transitionMeeting(meetingId, "in_session", profile);
}

export function recessMeeting(meetingId, profile) {
  return transitionMeeting(meetingId, "recessed", profile);
}

export function resumeMeeting(meetingId, profile) {
  return transitionMeeting(meetingId, "in_session", profile);
}

export function adjournMeeting(meetingId, profile) {
  return transitionMeeting(meetingId, "adjourned", profile);
}

export function cancelMeeting(meetingId, profile) {
  return transitionMeeting(meetingId, "cancelled", profile);
}

export async function checkIntoMeeting(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_VIEW, "Your account does not have Board meeting access.");
  requireAuth();

  const [meetingSnapshot, attendanceSnapshot] = await Promise.all([
    getDoc(doc(db, "meetings", meetingId)),
    getDoc(doc(db, "meetingAttendance", attendanceId(meetingId, auth.currentUser.uid)))
  ]);
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  if (!attendanceSnapshot.exists()) throw new Error("You are not on the invited roster for this meeting.");

  const meeting = meetingSnapshot.data();
  const attendance = attendanceSnapshot.data();
  if (!["checkin_open", "in_session"].includes(meeting.status)) throw new Error("Check-in is not currently open for this meeting.");
  if (attendance.presenceStatus === "present") return;
  if (["excused", "absent"].includes(attendance.presenceStatus)) throw new Error("Your attendance status must be changed by an authorized meeting administrator before you can check in.");

  const patch = {
    presenceStatus: "present",
    lastPresenceChangeAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  if (!attendance.checkedInAt) patch.checkedInAt = serverTimestamp();
  else patch.returnedAt = serverTimestamp();

  await writeBatch(db)
    .update(doc(db, "meetingAttendance", attendanceId(meetingId, auth.currentUser.uid)), patch)
    .commit();
}

export async function updateMeetingAttendance(meetingId, targetUid, presenceStatus, profile) {
  requirePermission(profile, PERMISSIONS.MEETINGS_ATTENDANCE_MANAGE, "Your account is not authorized to manage meeting attendance.");
  if (!VALID_PRESENCE.has(presenceStatus)) throw new Error("Choose a valid attendance status.");

  const attendanceRef = doc(db, "meetingAttendance", attendanceId(meetingId, targetUid));
  const snapshot = await getDoc(attendanceRef);
  if (!snapshot.exists()) throw new Error("Attendance record not found.");
  const current = snapshot.data();

  const patch = {
    presenceStatus,
    lastPresenceChangeAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  if (presenceStatus === "present" && !current.checkedInAt) patch.checkedInAt = serverTimestamp();
  if (presenceStatus === "present" && current.checkedInAt) patch.returnedAt = serverTimestamp();
  if (presenceStatus === "departed") patch.departedAt = serverTimestamp();
  if (presenceStatus === "excused") patch.excusedAt = serverTimestamp();
  if (presenceStatus === "absent") patch.absentAt = serverTimestamp();

  await writeBatch(db).update(attendanceRef, patch).commit();
}
