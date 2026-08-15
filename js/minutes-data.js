import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

export const MINUTES_STATUSES = Object.freeze(["draft", "ready", "certified"]);
export const RECORD_ENTRY_TYPES = Object.freeze(["attendance", "agenda", "motion", "vote", "resolution", "recusal"]);

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

function cleanText(value, maxLength = 5000) {
  return String(value || "").trim().slice(0, maxLength);
}

function validGoogleUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && ["docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function recordNumber(meetingId) {
  return `BMR-${new Date().getFullYear()}-${String(meetingId).slice(0, 6).toUpperCase()}`;
}

function entryId(meetingId, type, sourceId) {
  return `${meetingId}_${type}_${String(sourceId).replaceAll("/", "_")}`;
}

export function minutesStatusLabel(status = "draft") {
  return String(status || "draft").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function summarizeCertifiedRecord(record, entries = []) {
  const byType = (type) => entries.filter((entry) => entry.entryType === type).length;
  return {
    recordNumber: record?.recordNumber || "BMR",
    attendanceCount: byType("attendance"),
    agendaCount: byType("agenda"),
    motionCount: byType("motion"),
    voteCount: byType("vote"),
    resolutionCount: byType("resolution"),
    recusalCount: byType("recusal")
  };
}

export async function getMeetingMinutes(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MINUTES_VIEW, "Your account does not have access to Board minutes.");
  const snapshot = await getDoc(doc(db, "meetingMinutes", meetingId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveMinutesDraft(meetingId, input, profile) {
  requirePermission(profile, PERMISSIONS.MINUTES_EDIT, "Your account is not authorized to edit Board minutes.");
  const meetingSnapshot = await getDoc(doc(db, "meetings", meetingId));
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  const meeting = meetingSnapshot.data();
  if (meeting.status === "cancelled") throw new Error("Cancelled meetings cannot receive an official minutes draft through this workflow.");
  if (meeting.recordStatus === "certified") throw new Error("This meeting record is certified and read-only.");

  const minutesRef = doc(db, "meetingMinutes", meetingId);
  const existingSnapshot = await getDoc(minutesRef);
  const existing = existingSnapshot.exists() ? existingSnapshot.data() : null;
  if (existing?.status === "certified") throw new Error("Certified minutes cannot be edited.");
  if (existing?.status === "ready") throw new Error("Return the minutes to Draft before editing them.");

  const minutesDocumentUrl = String(input.minutesDocumentUrl || "").trim();
  if (minutesDocumentUrl && !validGoogleUrl(minutesDocumentUrl)) throw new Error("Minutes must use a Google Docs, Drive, Sheets, or Slides HTTPS link.");

  const payload = {
    meetingId,
    meetingNumber: meeting.meetingNumber || null,
    meetingTitle: meeting.title || "Board Meeting",
    status: "draft",
    minutesDocumentUrl: minutesDocumentUrl || null,
    openingNotes: cleanText(input.openingNotes),
    discussionSummary: cleanText(input.discussionSummary, 12000),
    otherBusiness: cleanText(input.otherBusiness, 8000),
    closingNotes: cleanText(input.closingNotes),
    approvalReference: cleanText(input.approvalReference, 800) || null,
    preparedBy: existing?.preparedBy || auth.currentUser.uid,
    preparedByName: existing?.preparedByName || profile.displayName || profile.fullName || "Board Secretary",
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    readyAt: null,
    readyBy: null,
    readyByName: null,
    certifiedAt: null,
    certifiedBy: null,
    certifiedByName: null,
    recordId: null
  };
  await setDoc(minutesRef, payload, { merge: false });
  return { id: meetingId, ...payload };
}

export async function markMinutesReady(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MINUTES_CERTIFY, "Your account is not authorized to approve minutes for certification.");
  const [meetingSnapshot, minutesSnapshot] = await Promise.all([
    getDoc(doc(db, "meetings", meetingId)),
    getDoc(doc(db, "meetingMinutes", meetingId))
  ]);
  if (!meetingSnapshot.exists() || meetingSnapshot.data().status !== "adjourned") throw new Error("Minutes can be marked ready only after the meeting is adjourned.");
  if (!minutesSnapshot.exists()) throw new Error("Create the minutes draft first.");
  const minutes = minutesSnapshot.data();
  if (minutes.status !== "draft") throw new Error("Only Draft minutes can move to Ready for Certification.");
  if (!validGoogleUrl(minutes.minutesDocumentUrl)) throw new Error("Add the official Google document link before marking minutes ready.");

  const batch = writeBatch(db);
  batch.update(doc(db, "meetingMinutes", meetingId), {
    status: "ready",
    readyAt: serverTimestamp(),
    readyBy: auth.currentUser.uid,
    readyByName: profile.displayName || profile.fullName || "Board Secretary",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  await batch.commit();
}

export async function returnMinutesToDraft(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.MINUTES_EDIT, "Your account is not authorized to edit Board minutes.");
  const minutesRef = doc(db, "meetingMinutes", meetingId);
  const snapshot = await getDoc(minutesRef);
  if (!snapshot.exists() || snapshot.data().status !== "ready") throw new Error("Only Ready minutes can be returned to Draft.");
  const meetingSnapshot = await getDoc(doc(db, "meetings", meetingId));
  if (!meetingSnapshot.exists() || meetingSnapshot.data().recordStatus === "certified") throw new Error("The permanent meeting record is already certified.");
  const batch = writeBatch(db);
  batch.update(minutesRef, {
    status: "draft",
    readyAt: null,
    readyBy: null,
    readyByName: null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  await batch.commit();
}

async function listByMeeting(collectionName, meetingId) {
  const snapshot = await getDocs(query(collection(db, collectionName), where("meetingId", "==", meetingId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function snapshotAttendance(entry) {
  return {
    directorUid: entry.directorUid,
    directorNumber: entry.directorNumber || null,
    directorName: entry.directorName || "Director",
    boardRole: entry.boardRole || "Director",
    officerRole: entry.officerRole || null,
    votingEligible: entry.votingEligible === true,
    presenceStatus: entry.presenceStatus || "invited",
    checkedInAt: entry.checkedInAt || null,
    departedAt: entry.departedAt || null,
    returnedAt: entry.returnedAt || null,
    excusedAt: entry.excusedAt || null,
    absentAt: entry.absentAt || null
  };
}

function snapshotAgenda(entry) {
  return {
    agendaNumber: entry.agendaNumber || null,
    order: Number(entry.order) || 0,
    itemType: entry.itemType || "business",
    title: entry.title || "Agenda Item",
    description: entry.description || null,
    documentId: entry.documentId || null,
    documentNumber: entry.documentNumber || null,
    documentTitle: entry.documentTitle || null,
    documentUrl: entry.documentUrl || null,
    status: entry.status || "queued"
  };
}

function snapshotMotion(entry) {
  return {
    motionNumber: entry.motionNumber || null,
    agendaItemId: entry.agendaItemId || null,
    motionText: entry.motionText || "",
    status: entry.status || "pending_second",
    movedByUid: entry.movedByUid || null,
    movedByName: entry.movedByName || null,
    secondedByUid: entry.secondedByUid || null,
    secondedByName: entry.secondedByName || null,
    secondedAt: entry.secondedAt || null,
    voteId: entry.voteId || null,
    resolutionId: entry.resolutionId || null
  };
}

function snapshotVote(entry) {
  return {
    voteNumber: entry.voteNumber || null,
    agendaItemId: entry.agendaItemId || null,
    motionId: entry.motionId || null,
    question: entry.question || "Board Vote",
    ballotVisibility: entry.ballotVisibility || "recorded",
    thresholdMode: entry.thresholdMode || "simple_majority_cast",
    eligibleVoterCount: Array.isArray(entry.eligibleVoterUids) ? entry.eligibleVoterUids.length : 0,
    recusedDirectorCount: Array.isArray(entry.recusedDirectorUids) ? entry.recusedDirectorUids.length : 0,
    quorumSnapshotPresent: Number(entry.quorumSnapshotPresent) || 0,
    quorumSnapshotRequired: Number(entry.quorumSnapshotRequired) || 0,
    approveCount: Number(entry.approveCount) || 0,
    opposeCount: Number(entry.opposeCount) || 0,
    abstainCount: Number(entry.abstainCount) || 0,
    ballotCount: Number(entry.ballotCount) || 0,
    requiredApproveCount: Number(entry.requiredApproveCount) || 0,
    result: entry.result || "pending",
    resolutionId: entry.resolutionId || null,
    openedAt: entry.openedAt || null,
    closedAt: entry.closedAt || null
  };
}

function snapshotResolution(entry) {
  return {
    resolutionNumber: entry.resolutionNumber || null,
    title: entry.title || "Board Resolution",
    resolutionText: entry.resolutionText || "",
    status: entry.status || "failed",
    voteId: entry.voteId || null,
    motionId: entry.motionId || null,
    approveCount: Number(entry.approveCount) || 0,
    opposeCount: Number(entry.opposeCount) || 0,
    abstainCount: Number(entry.abstainCount) || 0,
    ballotCount: Number(entry.ballotCount) || 0,
    eligibleVoterCount: Number(entry.eligibleVoterCount) || 0,
    requiredApproveCount: Number(entry.requiredApproveCount) || 0,
    thresholdMode: entry.thresholdMode || "simple_majority_cast",
    ballotVisibility: entry.ballotVisibility || "recorded",
    movedByName: entry.movedByName || null,
    secondedByName: entry.secondedByName || null,
    adoptedAt: entry.adoptedAt || null
  };
}

function snapshotRecusal(entry) {
  return {
    voteId: entry.voteId || null,
    directorUid: entry.directorUid || null,
    directorName: entry.directorName || "Director",
    reason: entry.reason || null,
    recordedAt: entry.recordedAt || null
  };
}

export async function certifyMeetingRecord(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.RECORDS_CERTIFY, "Your account is not authorized to certify permanent Board records.");
  requireAuth();

  const [meetingSnapshot, minutesSnapshot, existingRecord] = await Promise.all([
    getDoc(doc(db, "meetings", meetingId)),
    getDoc(doc(db, "meetingMinutes", meetingId)),
    getDoc(doc(db, "meetingRecords", meetingId))
  ]);
  if (!meetingSnapshot.exists()) throw new Error("Board meeting not found.");
  const meeting = meetingSnapshot.data();
  if (meeting.status !== "adjourned") throw new Error("Only an adjourned meeting can be certified.");
  if (meeting.activeVoteId) throw new Error("An active vote must be closed before certification.");
  if (meeting.recordStatus === "certified" || existingRecord.exists()) throw new Error("This meeting already has a certified permanent record.");
  if (!minutesSnapshot.exists() || minutesSnapshot.data().status !== "ready") throw new Error("Minutes must be Ready for Certification first.");
  if (!validGoogleUrl(minutesSnapshot.data().minutesDocumentUrl)) throw new Error("The official minutes must have a valid Google document link.");

  const [attendance, agenda, motions, votes, resolutions, recusals] = await Promise.all([
    listByMeeting("meetingAttendance", meetingId),
    listByMeeting("agendaItems", meetingId),
    listByMeeting("motions", meetingId),
    listByMeeting("votes", meetingId),
    listByMeeting("resolutions", meetingId),
    listByMeeting("voteRecusals", meetingId)
  ]);
  const unfinishedVotes = votes.filter((entry) => entry.status !== "closed");
  if (unfinishedVotes.length) throw new Error("Every meeting vote must be closed before the permanent record is certified.");

  const entries = [
    ...attendance.map((entry) => ({ sourceId: entry.id, entryType: "attendance", order: 0, data: snapshotAttendance(entry) })),
    ...agenda.map((entry) => ({ sourceId: entry.id, entryType: "agenda", order: Number(entry.order) || 0, data: snapshotAgenda(entry) })),
    ...motions.map((entry) => ({ sourceId: entry.id, entryType: "motion", order: timestampValue(entry.createdAt), data: snapshotMotion(entry) })),
    ...votes.map((entry) => ({ sourceId: entry.id, entryType: "vote", order: timestampValue(entry.openedAt), data: snapshotVote(entry) })),
    ...resolutions.map((entry) => ({ sourceId: entry.id, entryType: "resolution", order: timestampValue(entry.createdAt), data: snapshotResolution(entry) })),
    ...recusals.map((entry) => ({ sourceId: entry.id, entryType: "recusal", order: timestampValue(entry.recordedAt), data: snapshotRecusal(entry) }))
  ];
  if (entries.length + resolutions.length + 4 > 450) throw new Error("This meeting contains too many record entries for one atomic certification. Split or archive supporting material before certification.");

  const minutes = minutesSnapshot.data();
  const recordRef = doc(db, "meetingRecords", meetingId);
  const eventRef = doc(db, "recordEvents", `${meetingId}_certified`);
  const batch = writeBatch(db);
  batch.set(recordRef, {
    recordNumber: recordNumber(meetingId),
    meetingId,
    meetingNumber: meeting.meetingNumber || null,
    meetingTitle: meeting.title || "Board Meeting",
    recordStatus: "certified",
    meetingSnapshot: {
      title: meeting.title || "Board Meeting",
      meetingType: meeting.meetingType || "regular",
      scheduledFor: meeting.scheduledFor || null,
      locationMode: meeting.locationMode || null,
      locationLabel: meeting.locationLabel || null,
      quorumRequired: Number(meeting.quorumRequired) || 0,
      invitedDirectorCount: Array.isArray(meeting.invitedDirectorUids) ? meeting.invitedDirectorUids.length : 0,
      votingEligibleDirectorCount: Array.isArray(meeting.eligibleVotingDirectorUids) ? meeting.eligibleVotingDirectorUids.length : 0,
      checkInOpenedAt: meeting.checkInOpenedAt || null,
      calledToOrderAt: meeting.calledToOrderAt || null,
      adjournedAt: meeting.adjournedAt || null
    },
    minutesSnapshot: {
      minutesDocumentUrl: minutes.minutesDocumentUrl,
      openingNotes: minutes.openingNotes || "",
      discussionSummary: minutes.discussionSummary || "",
      otherBusiness: minutes.otherBusiness || "",
      closingNotes: minutes.closingNotes || "",
      approvalReference: minutes.approvalReference || null,
      preparedByName: minutes.preparedByName || null,
      readyByName: minutes.readyByName || null
    },
    attendanceCount: attendance.length,
    agendaItemCount: agenda.length,
    motionCount: motions.length,
    voteCount: votes.length,
    resolutionCount: resolutions.length,
    recusalCount: recusals.length,
    certifiedAt: serverTimestamp(),
    certifiedBy: auth.currentUser.uid,
    certifiedByName: profile.displayName || profile.fullName || "Record Certifier",
    certificationVersion: 1
  });

  entries.forEach((entry) => {
    batch.set(doc(db, "meetingRecordEntries", entryId(meetingId, entry.entryType, entry.sourceId)), {
      meetingId,
      recordId: meetingId,
      recordNumber: recordNumber(meetingId),
      entryType: entry.entryType,
      sourceId: entry.sourceId,
      order: entry.order,
      data: entry.data,
      certifiedAt: serverTimestamp(),
      certifiedBy: auth.currentUser.uid
    });
  });
  resolutions.forEach((resolution) => {
    batch.update(doc(db, "resolutions", resolution.id), {
      certified: true,
      certifiedAt: serverTimestamp(),
      certifiedBy: auth.currentUser.uid,
      certifiedByName: profile.displayName || profile.fullName || "Record Certifier",
      recordId: meetingId
    });
  });
  batch.update(doc(db, "meetingMinutes", meetingId), {
    status: "certified",
    certifiedAt: serverTimestamp(),
    certifiedBy: auth.currentUser.uid,
    certifiedByName: profile.displayName || profile.fullName || "Record Certifier",
    recordId: meetingId,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.update(doc(db, "meetings", meetingId), {
    recordStatus: "certified",
    recordId: meetingId,
    minutesId: meetingId,
    certifiedAt: serverTimestamp(),
    certifiedBy: auth.currentUser.uid,
    certifiedByName: profile.displayName || profile.fullName || "Record Certifier",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.set(eventRef, {
    type: "meeting_record_certified",
    meetingId,
    recordId: meetingId,
    recordNumber: recordNumber(meetingId),
    actorUid: auth.currentUser.uid,
    actorName: profile.displayName || profile.fullName || "Record Certifier",
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return { id: meetingId, recordNumber: recordNumber(meetingId) };
}

export async function listCertifiedMeetingRecords(profile) {
  requirePermission(profile, PERMISSIONS.RECORDS_VIEW, "Your account does not have access to permanent Board records.");
  const snapshot = await getDocs(collection(db, "meetingRecords"));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampValue(b.certifiedAt) - timestampValue(a.certifiedAt));
}

export async function getCertifiedRecordEntries(meetingId, profile) {
  requirePermission(profile, PERMISSIONS.RECORDS_VIEW, "Your account does not have access to permanent Board records.");
  const snapshot = await getDocs(query(collection(db, "meetingRecordEntries"), where("meetingId", "==", meetingId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => {
    const typeCompare = String(a.entryType).localeCompare(String(b.entryType));
    return typeCompare || (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}
