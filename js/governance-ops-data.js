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

export const COMMITTEE_TYPES = Object.freeze(["standing", "ad_hoc", "special"]);
export const COMMITTEE_STATUSES = Object.freeze(["active", "inactive", "disbanded"]);
export const COI_DISCLOSURE_STATUSES = Object.freeze(["submitted", "reviewed", "renewal_required", "archived"]);
export const CONFLICT_STATUSES = Object.freeze(["open", "managed", "resolved"]);
export const CONFLICT_ACTIONS = Object.freeze(["disclosed", "recused", "not_recused", "management_plan"]);
export const OFFICER_TERM_STATUSES = Object.freeze(["active", "concluded"]);
export const OFFICER_BASIS = Object.freeze(["election", "appointment", "interim", "confirmation"]);
export const TASK_STATUSES = Object.freeze(["open", "in_progress", "completed", "cancelled"]);
export const TASK_PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);
export const COMPLIANCE_STATUSES = Object.freeze(["pending", "due", "completed", "waived"]);
export const COMPLIANCE_CATEGORIES = Object.freeze(["corporate", "tax", "registration", "policy", "board", "financial", "program", "other"]);

const GOOGLE_HOSTS = new Set(["docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com"]);
const committeeTypes = new Set(COMMITTEE_TYPES);
const committeeStatuses = new Set(COMMITTEE_STATUSES);
const taskStatuses = new Set(TASK_STATUSES);
const taskPriorities = new Set(TASK_PRIORITIES);
const complianceStatuses = new Set(COMPLIANCE_STATUSES);
const complianceCategories = new Set(COMPLIANCE_CATEGORIES);
const officerBasis = new Set(OFFICER_BASIS);

function requireAuth() {
  if (!auth.currentUser) throw new Error("Sign in to continue.");
}

function requirePermission(profile, permission, message) {
  requireAuth();
  if (!hasPermission(profile, permission)) throw new Error(message);
}

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function clean(value, max = 5000) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanMultiline(value, max = 12000) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanDate(value) {
  const candidate = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function unique(values = [], max = 100) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).map((entry) => entry.trim()).filter(Boolean))].slice(0, max);
}

function validGoogleUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "https:" && GOOGLE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function requireGoogleUrl(value, label) {
  const result = String(value || "").trim();
  if (result && !validGoogleUrl(result)) throw new Error(`${label} must be a Google Docs, Drive, Sheets, or Slides HTTPS link.`);
  return result || null;
}

function numberFor(prefix, id) {
  return `${prefix}-${new Date().getFullYear()}-${String(id).slice(0, 6).toUpperCase()}`;
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function eventRef() {
  return doc(collection(db, "governanceEvents"));
}

function eventPayload(category, action, targetType, targetId, details = {}) {
  return {
    category,
    action,
    targetType,
    targetId,
    actorUid: auth.currentUser.uid,
    details,
    createdAt: serverTimestamp()
  };
}

export function governanceStatusLabel(value = "") {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function dueState(dueDate, status) {
  if (status === "completed" || status === "waived" || status === "cancelled") return status;
  const normalized = cleanDate(dueDate);
  if (!normalized) return "unscheduled";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const difference = Math.ceil((Date.parse(`${normalized}T00:00:00`) - Date.parse(`${todayKey}T00:00:00`)) / 86400000);
  if (difference < 0) return "overdue";
  if (difference === 0) return "due_today";
  if (difference <= 14) return "due_soon";
  return "upcoming";
}

export async function listCommittees(profile) {
  requirePermission(profile, PERMISSIONS.COMMITTEES_VIEW, "Your account does not have committee access.");
  const snapshot = await getDocs(collection(db, "committees"));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function saveCommittee(input, profile, existingId = null) {
  requirePermission(profile, PERMISSIONS.COMMITTEES_MANAGE, "Your account is not authorized to manage Board committees.");
  const name = clean(input.name, 180);
  const purpose = cleanMultiline(input.purpose, 5000);
  if (!name) throw new Error("Enter a committee name.");
  if (!purpose) throw new Error("Enter the committee purpose or delegated scope.");
  const type = committeeTypes.has(input.committeeType) ? input.committeeType : "standing";
  const status = committeeStatuses.has(input.status) ? input.status : "active";
  const memberUids = unique(input.memberUids, 100);
  const chairUid = String(input.chairUid || "").trim() || null;
  if (chairUid && !memberUids.includes(chairUid)) memberUids.unshift(chairUid);
  if (!memberUids.length && status === "active") throw new Error("An active committee must have at least one Board member.");
  const charterUrl = requireGoogleUrl(input.charterUrl, "Committee charter");
  const committeeRef = existingId ? doc(db, "committees", existingId) : doc(collection(db, "committees"));
  const existing = existingId ? await getDoc(committeeRef) : null;
  if (existingId && !existing.exists()) throw new Error("Committee record not found.");
  const event = eventRef();
  const actorName = profile.displayName || profile.fullName || "Governance Administrator";
  const payload = {
    committeeNumber: existing?.data()?.committeeNumber || numberFor("COM", committeeRef.id),
    name,
    committeeType: type,
    purpose,
    status,
    chairUid,
    memberUids,
    charterUrl,
    establishedDate: cleanDate(input.establishedDate) || existing?.data()?.establishedDate || null,
    sunsetDate: cleanDate(input.sunsetDate),
    createdAt: existing?.data()?.createdAt || serverTimestamp(),
    createdBy: existing?.data()?.createdBy || auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    updatedByName: actorName
  };
  const batch = writeBatch(db);
  batch.set(committeeRef, payload, { merge: false });
  batch.set(event, eventPayload("committee", existingId ? "committee.updated" : "committee.created", "committee", committeeRef.id, {
    committeeNumber: payload.committeeNumber,
    status,
    memberCount: memberUids.length,
    chairUid
  }));
  await batch.commit();
  return { id: committeeRef.id, ...payload };
}

export async function listOwnOrReviewCoiDisclosures(profile, year = null) {
  requirePermission(profile, PERMISSIONS.COI_VIEW, "Your account does not have conflict-of-interest access.");
  const ref = collection(db, "coiDisclosures");
  let snapshot;
  if (isFounder(profile) || hasPermission(profile, PERMISSIONS.COI_REVIEW)) snapshot = await getDocs(ref);
  else snapshot = await getDocs(query(ref, where("directorUid", "==", auth.currentUser.uid)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => !year || Number(entry.year) === Number(year))
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
}

export async function submitCoiDisclosure(input, profile) {
  requirePermission(profile, PERMISSIONS.COI_SUBMIT, "Your account is not authorized to submit a conflict-of-interest disclosure.");
  const year = Number(input.year) || new Date().getFullYear();
  if (year < 2020 || year > 2100) throw new Error("Choose a valid disclosure year.");
  const disclosureUrl = requireGoogleUrl(input.disclosureUrl, "Disclosure document");
  if (!disclosureUrl) throw new Error("Add the Google link to the signed or completed disclosure document.");
  const disclosureId = `${auth.currentUser.uid}_${year}`;
  const ref = doc(db, "coiDisclosures", disclosureId);
  const existing = await getDoc(ref);
  if (existing.exists() && ["reviewed", "archived"].includes(existing.data().status)) throw new Error("That annual disclosure is already reviewed and cannot be overwritten.");
  const event = eventRef();
  const hasConflicts = input.hasConflicts === true || input.hasConflicts === "true";
  const payload = {
    disclosureNumber: existing.data()?.disclosureNumber || `COI-${year}-${String(auth.currentUser.uid).slice(0, 6).toUpperCase()}`,
    year,
    directorUid: auth.currentUser.uid,
    directorName: profile.displayName || profile.fullName || "Director",
    disclosureUrl,
    hasConflicts,
    summary: cleanMultiline(input.summary, 5000) || null,
    status: "submitted",
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    reviewNote: null,
    createdAt: existing.data()?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  const batch = writeBatch(db);
  batch.set(ref, payload, { merge: false });
  batch.set(event, eventPayload("coi", existing.exists() ? "coi.resubmitted" : "coi.submitted", "coiDisclosure", disclosureId, { year, hasConflicts }));
  await batch.commit();
  return { id: disclosureId, ...payload };
}

export async function reviewCoiDisclosure(disclosureId, action, note, profile) {
  requirePermission(profile, PERMISSIONS.COI_REVIEW, "Your account is not authorized to review conflict-of-interest disclosures.");
  const ref = doc(db, "coiDisclosures", disclosureId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Disclosure record not found.");
  const current = snapshot.data();
  if (!['submitted', 'renewal_required'].includes(current.status)) throw new Error("This disclosure is not awaiting review.");
  const status = action === "renewal_required" ? "renewal_required" : "reviewed";
  const reviewNote = cleanMultiline(note, 3000) || null;
  if (status === "renewal_required" && !reviewNote) throw new Error("Explain what must be corrected or renewed.");
  const batch = writeBatch(db);
  batch.update(ref, {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: auth.currentUser.uid,
    reviewedByName: profile.displayName || profile.fullName || "COI Reviewer",
    reviewNote,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  const event = eventRef();
  batch.set(event, eventPayload("coi", status === "reviewed" ? "coi.reviewed" : "coi.renewal_required", "coiDisclosure", disclosureId, { directorUid: current.directorUid, year: current.year }));
  await batch.commit();
}

export async function listConflictRecords(profile) {
  requirePermission(profile, PERMISSIONS.COI_VIEW, "Your account does not have conflict-of-interest access.");
  const ref = collection(db, "conflictRecords");
  let snapshot;
  if (isFounder(profile) || hasPermission(profile, PERMISSIONS.COI_REVIEW) || hasPermission(profile, PERMISSIONS.COI_MANAGE)) snapshot = await getDocs(ref);
  else snapshot = await getDocs(query(ref, where("directorUid", "==", auth.currentUser.uid)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

export async function createConflictRecord(input, profile) {
  requireAuth();
  const canManage = hasPermission(profile, PERMISSIONS.COI_MANAGE);
  const canSubmit = hasPermission(profile, PERMISSIONS.COI_SUBMIT);
  if (!canManage && !canSubmit) throw new Error("Your account is not authorized to record conflict disclosures.");
  const targetUid = canManage && input.directorUid ? String(input.directorUid) : auth.currentUser.uid;
  if (!targetUid) throw new Error("Choose the director connected to this conflict.");
  const description = cleanMultiline(input.description, 6000);
  if (!description) throw new Error("Describe the potential or actual conflict.");
  const ref = doc(collection(db, "conflictRecords"));
  const action = CONFLICT_ACTIONS.includes(input.action) ? input.action : "disclosed";
  const payload = {
    conflictNumber: numberFor("CONFLICT", ref.id),
    directorUid: targetUid,
    directorName: clean(input.directorName, 180) || (targetUid === auth.currentUser.uid ? (profile.displayName || profile.fullName || "Director") : "Director"),
    entityOrInterest: clean(input.entityOrInterest, 300) || null,
    relationship: clean(input.relationship, 500) || null,
    description,
    action,
    status: action === "management_plan" ? "managed" : "open",
    meetingId: clean(input.meetingId, 200) || null,
    agendaItemId: clean(input.agendaItemId, 200) || null,
    voteId: clean(input.voteId, 200) || null,
    relatedDocumentUrl: requireGoogleUrl(input.relatedDocumentUrl, "Related conflict document"),
    managementPlan: cleanMultiline(input.managementPlan, 5000) || null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    resolvedAt: null,
    resolvedBy: null
  };
  const batch = writeBatch(db);
  batch.set(ref, payload);
  const event = eventRef();
  batch.set(event, eventPayload("coi", "conflict.created", "conflictRecord", ref.id, { directorUid: targetUid, action }));
  await batch.commit();
  return { id: ref.id, ...payload };
}

export async function resolveConflictRecord(conflictId, input, profile) {
  requirePermission(profile, PERMISSIONS.COI_MANAGE, "Your account is not authorized to resolve conflict records.");
  const ref = doc(db, "conflictRecords", conflictId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Conflict record not found.");
  const status = input.status === "managed" ? "managed" : "resolved";
  const batch = writeBatch(db);
  batch.update(ref, {
    status,
    action: CONFLICT_ACTIONS.includes(input.action) ? input.action : snapshot.data().action,
    managementPlan: cleanMultiline(input.managementPlan, 5000) || snapshot.data().managementPlan || null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    resolvedAt: status === "resolved" ? serverTimestamp() : null,
    resolvedBy: status === "resolved" ? auth.currentUser.uid : null
  });
  const event = eventRef();
  batch.set(event, eventPayload("coi", status === "resolved" ? "conflict.resolved" : "conflict.managed", "conflictRecord", conflictId, { directorUid: snapshot.data().directorUid }));
  await batch.commit();
}

export async function listOfficerTerms(profile) {
  requirePermission(profile, PERMISSIONS.OFFICERS_VIEW, "Your account does not have officer-history access.");
  const snapshot = await getDocs(collection(db, "officerTerms"));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

export async function assignOfficer(input, profile) {
  requirePermission(profile, PERMISSIONS.OFFICERS_MANAGE, "Your account is not authorized to assign Board officers.");
  const directorUid = String(input.directorUid || "").trim();
  const title = clean(input.officerTitle, 180);
  if (!directorUid || !title) throw new Error("Choose a director and officer title.");
  const directorRef = doc(db, "directors", directorUid);
  const directoryRef = doc(db, "boardDirectory", directorUid);
  const directorSnapshot = await getDoc(directorRef);
  if (!directorSnapshot.exists()) throw new Error("Director account not found.");
  const director = directorSnapshot.data();
  if (director.accountStatus !== "active") throw new Error("Only an active Board account can receive an officer assignment.");
  const termsSnapshot = await getDocs(collection(db, "officerTerms"));
  const activeTerms = termsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((entry) => entry.status === "active");
  const conflictingTitle = activeTerms.find((entry) => entry.officerTitle.toLowerCase() === title.toLowerCase() && entry.directorUid !== directorUid);
  const currentDirectorTerm = activeTerms.find((entry) => entry.directorUid === directorUid);
  const termRef = doc(collection(db, "officerTerms"));
  const basis = officerBasis.has(input.basis) ? input.basis : "appointment";
  const startDate = cleanDate(input.startDate);
  if (!startDate) throw new Error("Choose an officer term start date.");
  const batch = writeBatch(db);

  const conclude = (term) => {
    batch.update(doc(db, "officerTerms", term.id), {
      status: "concluded",
      endDate: startDate,
      concludedAt: serverTimestamp(),
      concludedBy: auth.currentUser.uid,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
  };
  if (conflictingTitle) {
    conclude(conflictingTitle);
    const previousDirector = await getDoc(doc(db, "directors", conflictingTitle.directorUid));
    if (previousDirector.exists() && previousDirector.data().officerRole === conflictingTitle.officerTitle) {
      batch.update(doc(db, "directors", conflictingTitle.directorUid), { officerRole: null, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
      batch.set(doc(db, "boardDirectory", conflictingTitle.directorUid), { officerRole: null, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
  if (currentDirectorTerm && currentDirectorTerm.id !== conflictingTitle?.id) conclude(currentDirectorTerm);

  batch.set(termRef, {
    termNumber: numberFor("OFF", termRef.id),
    officerTitle: title,
    directorUid,
    directorName: director.displayName || director.fullName || "Director",
    directorNumber: director.directorNumber || null,
    basis,
    status: "active",
    startDate,
    endDate: cleanDate(input.endDate),
    relatedMeetingId: clean(input.relatedMeetingId, 200) || null,
    relatedResolutionId: clean(input.relatedResolutionId, 200) || null,
    appointmentDocumentUrl: requireGoogleUrl(input.appointmentDocumentUrl, "Officer appointment document"),
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    concludedAt: null,
    concludedBy: null
  });
  batch.update(directorRef, { officerRole: title, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
  batch.set(directoryRef, { officerRole: title, updatedAt: serverTimestamp() }, { merge: true });
  const event = eventRef();
  batch.set(event, eventPayload("officer", "officer.assigned", "officerTerm", termRef.id, { directorUid, officerTitle: title, basis }));
  await batch.commit();
  return { id: termRef.id };
}

export async function concludeOfficerTerm(termId, endDate, profile) {
  requirePermission(profile, PERMISSIONS.OFFICERS_MANAGE, "Your account is not authorized to manage Board officer terms.");
  const termRef = doc(db, "officerTerms", termId);
  const snapshot = await getDoc(termRef);
  if (!snapshot.exists() || snapshot.data().status !== "active") throw new Error("Active officer term not found.");
  const term = snapshot.data();
  const end = cleanDate(endDate) || new Date().toISOString().slice(0, 10);
  const directorSnapshot = await getDoc(doc(db, "directors", term.directorUid));
  const batch = writeBatch(db);
  batch.update(termRef, {
    status: "concluded",
    endDate: end,
    concludedAt: serverTimestamp(),
    concludedBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  if (directorSnapshot.exists() && directorSnapshot.data().officerRole === term.officerTitle) {
    batch.update(doc(db, "directors", term.directorUid), { officerRole: null, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
    batch.set(doc(db, "boardDirectory", term.directorUid), { officerRole: null, updatedAt: serverTimestamp() }, { merge: true });
  }
  const event = eventRef();
  batch.set(event, eventPayload("officer", "officer.term.concluded", "officerTerm", termId, { directorUid: term.directorUid, officerTitle: term.officerTitle, endDate: end }));
  await batch.commit();
}

export async function listBoardTasks(profile) {
  requirePermission(profile, PERMISSIONS.TASKS_VIEW, "Your account does not have Board task access.");
  const ref = collection(db, "boardTasks");
  let snapshot;
  if (isFounder(profile) || hasPermission(profile, PERMISSIONS.TASKS_MANAGE)) snapshot = await getDocs(ref);
  else snapshot = await getDocs(query(ref, where("ownerUids", "array-contains", auth.currentUser.uid)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

export async function createBoardTask(input, profile) {
  requirePermission(profile, PERMISSIONS.TASKS_CREATE, "Your account is not authorized to create Board tasks.");
  const title = clean(input.title, 240);
  if (!title) throw new Error("Enter a task title.");
  const ownerUids = unique(input.ownerUids, 25);
  if (!ownerUids.length) throw new Error("Assign the task to at least one director.");
  const ref = doc(collection(db, "boardTasks"));
  const payload = {
    taskNumber: numberFor("TASK", ref.id),
    title,
    description: cleanMultiline(input.description, 6000) || null,
    ownerUids,
    ownerNames: unique(input.ownerNames, 25),
    priority: taskPriorities.has(input.priority) ? input.priority : "normal",
    status: "open",
    dueDate: cleanDate(input.dueDate),
    relatedMeetingId: clean(input.relatedMeetingId, 200) || null,
    relatedResolutionId: clean(input.relatedResolutionId, 200) || null,
    relatedDocumentUrl: requireGoogleUrl(input.relatedDocumentUrl, "Task document"),
    committeeId: clean(input.committeeId, 200) || null,
    completionNote: null,
    completedAt: null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    createdByName: profile.displayName || profile.fullName || "Board Task Manager",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  const batch = writeBatch(db);
  batch.set(ref, payload);
  const event = eventRef();
  batch.set(event, eventPayload("task", "task.created", "boardTask", ref.id, { taskNumber: payload.taskNumber, ownerUids, priority: payload.priority }));
  await batch.commit();
  return { id: ref.id, ...payload };
}

export async function updateBoardTask(taskId, input, profile) {
  requireAuth();
  const ref = doc(db, "boardTasks", taskId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Board task not found.");
  const current = snapshot.data();
  const manager = hasPermission(profile, PERMISSIONS.TASKS_MANAGE);
  const owner = Array.isArray(current.ownerUids) && current.ownerUids.includes(auth.currentUser.uid) && hasPermission(profile, PERMISSIONS.TASKS_UPDATE_OWN);
  if (!manager && !owner) throw new Error("Your account is not authorized to update this task.");
  const status = taskStatuses.has(input.status) ? input.status : current.status;
  const batch = writeBatch(db);
  const patch = {
    status,
    completionNote: cleanMultiline(input.completionNote, 4000) || current.completionNote || null,
    completedAt: status === "completed" ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  if (manager) {
    patch.title = clean(input.title ?? current.title, 240) || current.title;
    patch.description = cleanMultiline(input.description ?? current.description, 6000) || null;
    patch.priority = taskPriorities.has(input.priority) ? input.priority : current.priority;
    patch.dueDate = cleanDate(input.dueDate) || null;
    const owners = unique(input.ownerUids || current.ownerUids, 25);
    if (!owners.length) throw new Error("A Board task must retain at least one owner.");
    patch.ownerUids = owners;
    patch.ownerNames = unique(input.ownerNames || current.ownerNames, 25);
  }
  batch.update(ref, patch);
  const event = eventRef();
  batch.set(event, eventPayload("task", status === "completed" ? "task.completed" : "task.updated", "boardTask", taskId, { status, manager }));
  await batch.commit();
}

export async function listComplianceItems(profile) {
  requirePermission(profile, PERMISSIONS.COMPLIANCE_VIEW, "Your account does not have compliance access.");
  const snapshot = await getDocs(collection(db, "complianceItems"));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || String(a.title || "").localeCompare(String(b.title || "")));
}

export async function saveComplianceItem(input, profile, existingId = null) {
  requirePermission(profile, PERMISSIONS.COMPLIANCE_MANAGE, "Your account is not authorized to manage compliance items.");
  const title = clean(input.title, 240);
  if (!title) throw new Error("Enter a compliance item title.");
  const ref = existingId ? doc(db, "complianceItems", existingId) : doc(collection(db, "complianceItems"));
  const existing = existingId ? await getDoc(ref) : null;
  if (existingId && !existing.exists()) throw new Error("Compliance item not found.");
  const status = complianceStatuses.has(input.status) ? input.status : (existing?.data()?.status || "pending");
  const payload = {
    complianceNumber: existing?.data()?.complianceNumber || numberFor("COMP", ref.id),
    title,
    description: cleanMultiline(input.description, 6000) || null,
    category: complianceCategories.has(input.category) ? input.category : "other",
    status,
    dueDate: cleanDate(input.dueDate),
    recurrence: clean(input.recurrence, 180) || null,
    ownerUid: clean(input.ownerUid, 200) || null,
    ownerName: clean(input.ownerName, 180) || null,
    authorityOrSource: clean(input.authorityOrSource, 800) || null,
    sourceDocumentUrl: requireGoogleUrl(input.sourceDocumentUrl, "Compliance source document"),
    completionNote: cleanMultiline(input.completionNote, 4000) || null,
    completedAt: status === "completed" ? serverTimestamp() : (existing?.data()?.completedAt || null),
    createdAt: existing?.data()?.createdAt || serverTimestamp(),
    createdBy: existing?.data()?.createdBy || auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };
  const batch = writeBatch(db);
  batch.set(ref, payload, { merge: false });
  const event = eventRef();
  batch.set(event, eventPayload("compliance", existingId ? "compliance.updated" : "compliance.created", "complianceItem", ref.id, { status, dueDate: payload.dueDate, category: payload.category }));
  await batch.commit();
  return { id: ref.id, ...payload };
}

export async function listGovernanceEvents(profile) {
  const canView = isFounder(profile)
    || hasPermission(profile, PERMISSIONS.COMMITTEES_MANAGE)
    || hasPermission(profile, PERMISSIONS.COI_REVIEW)
    || hasPermission(profile, PERMISSIONS.COI_MANAGE)
    || hasPermission(profile, PERMISSIONS.OFFICERS_MANAGE)
    || hasPermission(profile, PERMISSIONS.TASKS_MANAGE)
    || hasPermission(profile, PERMISSIONS.COMPLIANCE_MANAGE);
  if (!canView) return [];
  const snapshot = await getDocs(collection(db, "governanceEvents"));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}
