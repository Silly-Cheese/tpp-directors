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

export const DOCUMENT_STATUSES = Object.freeze([
  "submitted", "under_review", "returned_for_revision", "agenda_ready",
  "approved", "rejected", "tabled", "archived"
]);
export const DOCUMENT_CATEGORIES = Object.freeze([
  "governance", "policy", "financial", "program", "committee", "report", "legal", "minutes", "other"
]);
export const DOCUMENT_ACCESS_SCOPES = Object.freeze(["board", "officers", "restricted", "founder"]);

const GOOGLE_HOSTS = new Set(["docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com"]);
const STATUS_SET = new Set(DOCUMENT_STATUSES);
const CATEGORY_SET = new Set(DOCUMENT_CATEGORIES);
const ACCESS_SET = new Set(DOCUMENT_ACCESS_SCOPES);
const REVIEW_TRANSITIONS = Object.freeze({
  submitted: new Set(["under_review", "returned_for_revision", "agenda_ready", "rejected", "tabled", "archived"]),
  under_review: new Set(["returned_for_revision", "agenda_ready", "approved", "rejected", "tabled", "archived"]),
  returned_for_revision: new Set(["archived"]),
  agenda_ready: new Set(["approved", "rejected", "tabled", "archived"]),
  approved: new Set(["archived"]), rejected: new Set(["archived"]), tabled: new Set(["archived"]), archived: new Set()
});

function requireAuthenticated() { if (!auth.currentUser) throw new Error("Sign in to continue."); }
function requirePermission(profile, permission, message) { requireAuthenticated(); if (!hasPermission(profile, permission)) throw new Error(message); }
function isFounder(profile) { return profile?.root === true && profile?.systemRole === "founder_director"; }
function timestampValue(value) { if (!value) return 0; if (typeof value.toMillis === "function") return value.toMillis(); if (typeof value.seconds === "number") return value.seconds * 1000; return 0; }
function dedupeById(entries) { return [...new Map(entries.map((entry) => [entry.id, entry])).values()]; }

export function normalizeGoogleDocumentLink(value = "") {
  const raw = String(value).trim();
  if (!raw) throw new Error("Enter a Google document link.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Enter a valid Google Docs, Drive, Sheets, or Slides link."); }
  if (url.protocol !== "https:" || !GOOGLE_HOSTS.has(url.hostname.toLowerCase())) throw new Error("Only HTTPS Google Docs, Drive, Sheets, or Slides links are accepted.");
  url.hash = "";
  return url.toString();
}

export function identifyGoogleLinkType(value = "") {
  const url = new URL(normalizeGoogleDocumentLink(value));
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === "drive.google.com") return "Google Drive";
  if (path.includes("/spreadsheets/") || host === "sheets.google.com") return "Google Sheets";
  if (path.includes("/presentation/") || host === "slides.google.com") return "Google Slides";
  if (path.includes("/document/")) return "Google Docs";
  return "Google Document";
}

export function normalizeDocumentCategory(value = "") { const category = String(value).trim().toLowerCase(); return CATEGORY_SET.has(category) ? category : "other"; }
export function normalizeDocumentAccess(value = "") { const scope = String(value).trim().toLowerCase(); return ACCESS_SET.has(scope) ? scope : "board"; }
export function documentStatusLabel(status = "") { return String(status || "submitted").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
export function isAllowedReviewTransition(currentStatus, nextStatus) { return REVIEW_TRANSITIONS[currentStatus]?.has(nextStatus) === true; }
export function canReviewDocuments(profile) { return hasPermission(profile, PERMISSIONS.DOCUMENTS_REVIEW); }

export function canSeeDocumentLocally(documentRecord, profile) {
  if (!documentRecord || !profile || !auth.currentUser) return false;
  if (isFounder(profile)) return true;
  if (documentRecord.submittedBy === auth.currentUser.uid) return true;
  if (canReviewDocuments(profile) && documentRecord.accessScope !== "founder") return true;
  if (!hasPermission(profile, PERMISSIONS.DOCUMENTS_VIEW)) return false;
  switch (documentRecord.accessScope) {
    case "board": return true;
    case "officers": return Boolean(profile.officerRole);
    case "restricted": return Array.isArray(documentRecord.allowedDirectorUids) && documentRecord.allowedDirectorUids.includes(auth.currentUser.uid);
    default: return false;
  }
}

function cleanAllowedDirectors(scope, values = []) {
  if (scope !== "restricted") return [];
  const cleaned = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))];
  if (!cleaned.length) throw new Error("Choose at least one director for a restricted document.");
  return cleaned.slice(0, 25);
}
function makeDocumentNumber(refId) { return `BDOC-${new Date().getFullYear()}-${String(refId).slice(0, 6).toUpperCase()}`; }

export async function submitBoardDocument(input, profile) {
  requirePermission(profile, PERMISSIONS.DOCUMENTS_SUBMIT, "Your account is not authorized to submit Board documents.");
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const requestedAction = String(input.requestedAction ?? "").trim();
  if (!title) throw new Error("Enter a document title.");
  if (!description) throw new Error("Enter a short description of the document.");
  const documentUrl = normalizeGoogleDocumentLink(input.documentUrl);
  const category = normalizeDocumentCategory(input.category);
  const accessScope = normalizeDocumentAccess(input.accessScope);
  const allowedDirectorUids = cleanAllowedDirectors(accessScope, input.allowedDirectorUids);
  const documentRef = doc(collection(db, "documents"));
  const eventRef = doc(collection(db, "documentEvents"));
  const record = {
    documentNumber: makeDocumentNumber(documentRef.id), title, description, documentUrl,
    linkType: identifyGoogleLinkType(documentUrl), category, accessScope, allowedDirectorUids,
    requestedAction: requestedAction || null, status: "submitted", revisionNumber: 1,
    submittedBy: auth.currentUser.uid, submittedByName: profile.displayName || profile.fullName || "Director",
    submittedAt: serverTimestamp(), reviewedBy: null, reviewedByName: null, reviewedAt: null,
    reviewNote: null, agendaMeetingId: null, archivedAt: null, updatedBy: auth.currentUser.uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
  const batch = writeBatch(db);
  batch.set(documentRef, record);
  batch.set(eventRef, { documentId: documentRef.id, documentNumber: record.documentNumber, type: "submitted", actorUid: auth.currentUser.uid, actorName: record.submittedByName, note: requestedAction || null, createdAt: serverTimestamp() });
  await batch.commit();
  return { id: documentRef.id, ...record };
}

export async function listBoardDocuments(profile) {
  requireAuthenticated();
  const documentsRef = collection(db, "documents");
  let documents = [];
  if (isFounder(profile)) {
    const snapshot = await getDocs(documentsRef);
    documents = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  } else {
    const reads = [getDocs(query(documentsRef, where("submittedBy", "==", auth.currentUser.uid)))];
    if (canReviewDocuments(profile)) {
      reads.push(getDocs(query(documentsRef, where("accessScope", "==", "board"))));
      reads.push(getDocs(query(documentsRef, where("accessScope", "==", "officers"))));
      reads.push(getDocs(query(documentsRef, where("accessScope", "==", "restricted"))));
    } else if (hasPermission(profile, PERMISSIONS.DOCUMENTS_VIEW)) {
      reads.push(getDocs(query(documentsRef, where("accessScope", "==", "board"))));
      if (profile.officerRole) reads.push(getDocs(query(documentsRef, where("accessScope", "==", "officers"))));
      reads.push(getDocs(query(documentsRef, where("allowedDirectorUids", "array-contains", auth.currentUser.uid))));
    }
    const snapshots = await Promise.all(reads);
    documents = dedupeById(snapshots.flatMap((snapshot) => snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
  }
  return documents.filter((entry) => canSeeDocumentLocally(entry, profile)).sort((a, b) => timestampValue(b.updatedAt) - timestampValue(a.updatedAt));
}

export async function getBoardDocument(documentId, profile) {
  requireAuthenticated();
  const snapshot = await getDoc(doc(db, "documents", documentId));
  if (!snapshot.exists()) throw new Error("Board document not found.");
  const record = { id: snapshot.id, ...snapshot.data() };
  if (!canSeeDocumentLocally(record, profile)) throw new Error("Your account does not have access to this Board document.");
  return record;
}

export async function listDocumentEvents(documentId, profile) {
  await getBoardDocument(documentId, profile);
  const snapshot = await getDocs(query(collection(db, "documentEvents"), where("documentId", "==", documentId)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt));
}

export async function reviseBoardDocument(documentId, input, profile) {
  requireAuthenticated();
  const record = await getBoardDocument(documentId, profile);
  if (record.submittedBy !== auth.currentUser.uid) throw new Error("Only the submitting director can revise this document.");
  if (!["submitted", "returned_for_revision"].includes(record.status)) throw new Error("This document cannot be revised in its current status.");
  const documentUrl = normalizeGoogleDocumentLink(input.documentUrl || record.documentUrl);
  const title = String(input.title ?? record.title).trim();
  const description = String(input.description ?? record.description).trim();
  if (!title || !description) throw new Error("Title and description are required.");
  const eventRef = doc(collection(db, "documentEvents"));
  const batch = writeBatch(db);
  batch.update(doc(db, "documents", documentId), {
    title, description, documentUrl, linkType: identifyGoogleLinkType(documentUrl),
    requestedAction: String(input.requestedAction ?? record.requestedAction ?? "").trim() || null,
    status: "submitted", revisionNumber: Number(record.revisionNumber || 1) + 1,
    reviewNote: null, reviewedBy: null, reviewedByName: null, reviewedAt: null,
    updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid
  });
  batch.set(eventRef, { documentId, documentNumber: record.documentNumber, type: record.status === "returned_for_revision" ? "resubmitted" : "revised", actorUid: auth.currentUser.uid, actorName: profile.displayName || profile.fullName || "Director", note: null, createdAt: serverTimestamp() });
  await batch.commit();
}

export async function reviewBoardDocument(documentId, action, note, profile) {
  requirePermission(profile, PERMISSIONS.DOCUMENTS_REVIEW, "Your account is not authorized to review Board documents.");
  const snapshot = await getDoc(doc(db, "documents", documentId));
  if (!snapshot.exists()) throw new Error("Board document not found.");
  const record = snapshot.data();
  if (record.accessScope === "founder" && !isFounder(profile)) throw new Error("This record is restricted to the Founder Director.");
  const transitions = Object.freeze({ begin_review: "under_review", return_revision: "returned_for_revision", agenda_ready: "agenda_ready", approve: "approved", reject: "rejected", table: "tabled", archive: "archived" });
  const nextStatus = transitions[action];
  if (!STATUS_SET.has(nextStatus)) throw new Error("Choose a valid document action.");
  if (!isAllowedReviewTransition(record.status, nextStatus)) throw new Error(`A document in ${documentStatusLabel(record.status)} status cannot be moved directly to ${documentStatusLabel(nextStatus)}.`);
  const reviewNote = String(note ?? "").trim() || null;
  if (["return_revision", "reject"].includes(action) && !reviewNote) throw new Error("Enter a review note explaining this action.");
  const eventRef = doc(collection(db, "documentEvents"));
  const reviewerName = profile.displayName || profile.fullName || "Board Reviewer";
  const batch = writeBatch(db);
  batch.update(doc(db, "documents", documentId), {
    status: nextStatus, reviewNote, reviewedBy: auth.currentUser.uid, reviewedByName: reviewerName,
    reviewedAt: serverTimestamp(), archivedAt: nextStatus === "archived" ? serverTimestamp() : record.archivedAt || null,
    updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid
  });
  batch.set(eventRef, { documentId, documentNumber: record.documentNumber || null, type: nextStatus, actorUid: auth.currentUser.uid, actorName: reviewerName, note: reviewNote, createdAt: serverTimestamp() });
  await batch.commit();
}

export function summarizeDocuments(entries = [], profile = {}) {
  const currentUid = auth.currentUser?.uid;
  const visible = entries.filter((entry) => entry.status !== "archived");
  return {
    accessible: visible.length,
    mine: visible.filter((entry) => entry.submittedBy === currentUid).length,
    inbox: canReviewDocuments(profile) ? visible.filter((entry) => ["submitted", "under_review"].includes(entry.status)).length : 0,
    agendaReady: visible.filter((entry) => entry.status === "agenda_ready").length
  };
}
