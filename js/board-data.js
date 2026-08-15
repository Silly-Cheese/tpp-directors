import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

const BOARD_CURRENT_STATUSES = new Set(["interim", "confirmed", "leave_of_absence"]);
const NOTICE_PRIORITIES = new Set(["normal", "important", "urgent"]);

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

export function normalizeBoardStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return ["interim", "confirmed", "leave_of_absence", "former"].includes(status)
    ? status
    : "interim";
}

export function boardDirectoryRecord(profile = {}) {
  return {
    directorNumber: profile.directorNumber || null,
    fullName: profile.fullName || profile.displayName || "Director",
    displayName: profile.displayName || profile.fullName || "Director",
    boardRole: profile.boardRole || "Director",
    officerRole: profile.officerRole || null,
    boardStatus: normalizeBoardStatus(profile.boardStatus),
    votingStatus: profile.votingStatus === "ineligible" ? "ineligible" : "eligible",
    termStart: profile.termStart || null,
    termEnd: profile.termEnd || null,
    directoryVisible: profile.directoryVisible !== false,
    updatedAt: serverTimestamp()
  };
}

export async function listBoardDirectory(profile) {
  if (!hasPermission(profile, PERMISSIONS.DIRECTORS_VIEW)) {
    throw new Error("Your account does not have Board directory access.");
  }

  const directoryRef = collection(db, "boardDirectory");
  const snapshot = isFounder(profile)
    ? await getDocs(directoryRef)
    : await getDocs(query(directoryRef, where("directoryVisible", "==", true)));

  return snapshot.docs
    .map((entry) => ({ uid: entry.id, ...entry.data() }))
    .filter((entry) => isFounder(profile) || entry.directoryVisible !== false)
    .sort((a, b) => String(a.directorNumber ?? "").localeCompare(String(b.directorNumber ?? "")));
}

export function summarizeBoardDirectory(entries = []) {
  const visible = entries.filter((entry) => entry.directoryVisible !== false);
  const current = visible.filter((entry) => BOARD_CURRENT_STATUSES.has(normalizeBoardStatus(entry.boardStatus)));
  return {
    total: current.length,
    confirmed: current.filter((entry) => normalizeBoardStatus(entry.boardStatus) === "confirmed").length,
    interim: current.filter((entry) => normalizeBoardStatus(entry.boardStatus) === "interim").length,
    votingEligible: current.filter((entry) => entry.votingStatus !== "ineligible").length
  };
}

function sortNotices(entries) {
  const priorityRank = { urgent: 0, important: 1, normal: 2 };
  return entries.sort((a, b) => {
    const priorityDifference = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
    if (priorityDifference !== 0) return priorityDifference;
    return timestampValue(b.publishedAt || b.createdAt) - timestampValue(a.publishedAt || a.createdAt);
  });
}

export async function listBoardNotices() {
  if (!auth.currentUser) throw new Error("Sign in to view Board notices.");
  const snapshot = await getDocs(query(collection(db, "announcements"), where("status", "==", "published")));
  const today = todayKey();
  return sortNotices(snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((notice) => !notice.expiresOn || notice.expiresOn >= today));
}

export async function listAllBoardNotices(profile) {
  if (!auth.currentUser || !hasPermission(profile, PERMISSIONS.ANNOUNCEMENTS_MANAGE)) {
    throw new Error("Your account is not authorized to manage Board notices.");
  }
  const snapshot = await getDocs(collection(db, "announcements"));
  return sortNotices(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
}

export async function publishBoardNotice(input, profile) {
  if (!auth.currentUser || !hasPermission(profile, PERMISSIONS.ANNOUNCEMENTS_MANAGE)) {
    throw new Error("Your account is not authorized to publish Board notices.");
  }

  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!title) throw new Error("Enter a notice title.");
  if (!body) throw new Error("Enter the notice message.");

  const priority = NOTICE_PRIORITIES.has(input.priority) ? input.priority : "normal";
  const noticeRef = doc(collection(db, "announcements"));
  await setDoc(noticeRef, {
    title,
    body,
    priority,
    status: "published",
    expiresOn: input.expiresOn || null,
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  return noticeRef.id;
}

export async function archiveBoardNotice(id, profile) {
  if (!auth.currentUser || !hasPermission(profile, PERMISSIONS.ANNOUNCEMENTS_MANAGE)) {
    throw new Error("Your account is not authorized to manage Board notices.");
  }
  if (!id) throw new Error("A Board notice is required.");

  await updateDoc(doc(db, "announcements", id), {
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
}
