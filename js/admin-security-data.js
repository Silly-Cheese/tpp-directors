import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

export const SENSITIVE_PERMISSIONS = Object.freeze([
  "permissions.manage",
  "directors.create",
  "directors.update",
  "directors.suspend",
  "meetings.activate",
  "meetings.control",
  "meetings.attendance.manage",
  "agenda.manage",
  "votes.push",
  "votes.close",
  "resolutions.create",
  "minutes.certify",
  "records.certify",
  "documents.review",
  "committees.manage",
  "coi.review",
  "coi.manage",
  "officers.manage",
  "tasks.manage",
  "compliance.manage",
  "audit.view"
]);

const INCIDENT_STATUSES = new Set(["open", "investigating", "resolved", "closed"]);
const INCIDENT_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function requireAuth() {
  if (!auth.currentUser) throw new Error("Sign in to continue.");
}

export function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function requireFounder(profile) {
  requireAuth();
  if (!isFounder(profile)) throw new Error("Founder Director root access is required for this security action.");
}

function clean(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function eventActor(data) {
  return data.actorName || data.reviewedByName || data.createdByName || data.updatedByName || data.certifiedByName || data.directorName || data.actorUid || data.createdBy || data.updatedBy || "Board user";
}

function eventAction(data, fallback) {
  return data.action || data.type || data.eventType || fallback || "event";
}

export function normalizeAuditEvent(source, id, data = {}) {
  return {
    id: `${source}:${id}`,
    source,
    sourceId: id,
    action: eventAction(data, source),
    actor: eventActor(data),
    actorUid: data.actorUid || data.createdBy || data.updatedBy || data.certifiedBy || data.reviewedBy || null,
    targetType: data.targetType || data.objectType || data.type || data.documentId && "document" || data.meetingId && "meeting" || null,
    targetId: data.targetId || data.objectId || data.documentId || data.meetingId || data.recordId || null,
    createdAt: data.createdAt || data.timestamp || data.reviewedAt || data.certifiedAt || data.updatedAt || null,
    details: data.details || data.note || data.reason || data.reviewNote || null,
    raw: data
  };
}

export function auditEventIsCorrelated(event) {
  if (!event) return false;
  if (["admin", "record"].includes(event.source)) return true;
  if (event.source === "document") return Boolean(event.targetId && event.actorUid && event.createdAt);
  if (event.source === "governance") return Boolean(event.targetId && event.actorUid && event.createdAt && event.action);
  return false;
}

export function sensitivePermissionsFor(profile = {}) {
  if (isFounder(profile)) return ["Founder Root · All Capabilities"];
  const assigned = Array.isArray(profile.permissions) ? profile.permissions : [];
  if (assigned.includes("*")) return ["Wildcard · All Capabilities"];
  return SENSITIVE_PERMISSIONS.filter((permission) => assigned.includes(permission));
}

export function summarizeSecurityPosture(directors = [], auditRows = []) {
  const active = directors.filter((entry) => entry.accountStatus === "active").length;
  const suspended = directors.filter((entry) => entry.accountStatus === "suspended").length;
  const pending = directors.filter((entry) => ["awaiting_activation", "pin_reset_required"].includes(entry.accountStatus)).length;
  const privileged = directors.filter((entry) => sensitivePermissionsFor(entry).length > 0).length;
  const rootCount = directors.filter(isFounder).length;
  const uncorrelated = auditRows.filter((entry) => !auditEventIsCorrelated(entry)).length;
  return { total: directors.length, active, suspended, pending, privileged, rootCount, auditCount: auditRows.length, uncorrelated };
}

export async function listSecurityDirectors(profile) {
  requireFounder(profile);
  const snapshot = await getDocs(collection(db, "directors"));
  return snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
}

async function safeEventCollection(name, source) {
  try {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map((entry) => normalizeAuditEvent(source, entry.id, entry.data()));
  } catch (error) {
    console.warn(`Audit source ${name} unavailable`, error);
    return [];
  }
}

export async function collectAuditTrail(profile) {
  requireAuth();
  const founder = isFounder(profile);
  const delegatedAudit = hasPermission(profile, PERMISSIONS.AUDIT_VIEW);
  if (!founder && !delegatedAudit) throw new Error("Your account does not have audit access.");

  const admin = await safeEventCollection("auditEvents", "admin");
  if (!founder) return admin.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));

  const [documents, governance, records] = await Promise.all([
    safeEventCollection("documentEvents", "document"),
    safeEventCollection("governanceEvents", "governance"),
    safeEventCollection("recordEvents", "record")
  ]);
  return [...admin, ...documents, ...governance, ...records]
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

function auditEventPayload(action, details = {}) {
  return {
    actorUid: auth.currentUser.uid,
    actorName: details.actorName || "Founder Director",
    action,
    objectType: details.objectType || "system",
    objectId: details.objectId || null,
    reason: details.reason || null,
    details,
    createdAt: serverTimestamp()
  };
}

export async function getSecurityPolicy(profile) {
  requireFounder(profile);
  const snapshot = await getDoc(doc(db, "system", "portalSecurityPolicy"));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveSecurityPolicy(input, profile) {
  requireFounder(profile);
  const ref = doc(db, "system", "portalSecurityPolicy");
  const payload = {
    docType: "portal_security_policy",
    accessReviewCadenceDays: Math.max(1, Math.min(365, Number(input.accessReviewCadenceDays) || 90)),
    recoveryInstructions: clean(input.recoveryInstructions, 3000) || null,
    securityContact: clean(input.securityContact, 500) || null,
    administrativeNotes: clean(input.administrativeNotes, 5000) || null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    updatedByName: profile.displayName || profile.fullName || "Founder Director"
  };
  const auditRef = doc(collection(db, "auditEvents"));
  const batch = writeBatch(db);
  batch.set(ref, payload, { merge: true });
  batch.set(auditRef, auditEventPayload("security.policy.updated", {
    actorName: payload.updatedByName,
    objectType: "system",
    objectId: "portalSecurityPolicy",
    reason: "Founder security policy settings updated.",
    accessReviewCadenceDays: payload.accessReviewCadenceDays
  }));
  await batch.commit();
}

export async function listSecurityIncidents(profile) {
  requireFounder(profile);
  const snapshot = await getDocs(collection(db, "system"));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => entry.docType === "security_incident")
    .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
}

export async function createSecurityIncident(input, profile) {
  requireFounder(profile);
  const title = clean(input.title, 240);
  const description = clean(input.description, 6000);
  if (!title || !description) throw new Error("Enter an incident title and description.");
  const incidentRef = doc(collection(db, "system"));
  const severity = INCIDENT_SEVERITIES.has(input.severity) ? input.severity : "medium";
  const payload = {
    docType: "security_incident",
    incidentNumber: `SEC-${new Date().getFullYear()}-${incidentRef.id.slice(0, 6).toUpperCase()}`,
    title,
    description,
    severity,
    status: "open",
    responseNotes: null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
    createdByName: profile.displayName || profile.fullName || "Founder Director",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    resolvedAt: null
  };
  const auditRef = doc(collection(db, "auditEvents"));
  const batch = writeBatch(db);
  batch.set(incidentRef, payload);
  batch.set(auditRef, auditEventPayload("security.incident.created", {
    actorName: payload.createdByName,
    objectType: "securityIncident",
    objectId: incidentRef.id,
    reason: title,
    severity
  }));
  await batch.commit();
  return { id: incidentRef.id, ...payload };
}

export async function updateSecurityIncident(incidentId, input, profile) {
  requireFounder(profile);
  const ref = doc(db, "system", incidentId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists() || snapshot.data().docType !== "security_incident") throw new Error("Security incident not found.");
  const status = INCIDENT_STATUSES.has(input.status) ? input.status : snapshot.data().status;
  const auditRef = doc(collection(db, "auditEvents"));
  const batch = writeBatch(db);
  batch.update(ref, {
    status,
    responseNotes: clean(input.responseNotes, 6000) || snapshot.data().responseNotes || null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    resolvedAt: ["resolved", "closed"].includes(status) ? serverTimestamp() : null
  });
  batch.set(auditRef, auditEventPayload("security.incident.updated", {
    actorName: profile.displayName || profile.fullName || "Founder Director",
    objectType: "securityIncident",
    objectId: incidentId,
    reason: `Incident status changed to ${status}.`,
    status
  }));
  await batch.commit();
}

export async function getEmergencyFreeze(profile) {
  requireFounder(profile);
  const snapshot = await getDoc(doc(db, "system", "emergencyAccessFreeze"));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function activateEmergencyFreeze(reason, profile) {
  requireFounder(profile);
  const freezeRef = doc(db, "system", "emergencyAccessFreeze");
  const existing = await getDoc(freezeRef);
  if (existing.exists() && existing.data().status === "active") throw new Error("Emergency access freeze is already active.");
  const directors = await listSecurityDirectors(profile);
  const affected = directors
    .filter((entry) => !isFounder(entry) && entry.accountStatus !== "suspended")
    .map((entry) => ({ uid: entry.uid, previousStatus: entry.accountStatus || "active" }));
  if (affected.length + 2 > 450) throw new Error("Too many accounts for one emergency freeze batch.");
  const why = clean(reason, 2000);
  if (!why) throw new Error("Enter the reason for the emergency access freeze.");

  const batch = writeBatch(db);
  affected.forEach((entry) => {
    batch.update(doc(db, "directors", entry.uid), {
      accountStatus: "suspended",
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
  });
  batch.set(freezeRef, {
    docType: "emergency_access_freeze",
    status: "active",
    reason: why,
    affectedAccounts: affected,
    activatedAt: serverTimestamp(),
    activatedBy: auth.currentUser.uid,
    activatedByName: profile.displayName || profile.fullName || "Founder Director",
    liftedAt: null,
    liftedBy: null
  }, { merge: false });
  const auditRef = doc(collection(db, "auditEvents"));
  batch.set(auditRef, auditEventPayload("security.emergency_freeze.activated", {
    actorName: profile.displayName || profile.fullName || "Founder Director",
    objectType: "system",
    objectId: "emergencyAccessFreeze",
    reason: why,
    affectedCount: affected.length
  }));
  await batch.commit();
  return affected.length;
}

export async function liftEmergencyFreeze(profile) {
  requireFounder(profile);
  const freezeRef = doc(db, "system", "emergencyAccessFreeze");
  const snapshot = await getDoc(freezeRef);
  if (!snapshot.exists() || snapshot.data().status !== "active") throw new Error("No emergency access freeze is active.");
  const affected = Array.isArray(snapshot.data().affectedAccounts) ? snapshot.data().affectedAccounts : [];
  const stateSnapshots = await Promise.all(affected.map((entry) => getDoc(doc(db, "directors", entry.uid))));
  const restores = affected.filter((entry, index) => stateSnapshots[index].exists() && stateSnapshots[index].data().accountStatus === "suspended");
  if (restores.length + 2 > 450) throw new Error("Too many accounts for one emergency restore batch.");

  const batch = writeBatch(db);
  restores.forEach((entry) => {
    batch.update(doc(db, "directors", entry.uid), {
      accountStatus: entry.previousStatus || "active",
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
  });
  batch.update(freezeRef, {
    status: "lifted",
    liftedAt: serverTimestamp(),
    liftedBy: auth.currentUser.uid,
    liftedByName: profile.displayName || profile.fullName || "Founder Director"
  });
  const auditRef = doc(collection(db, "auditEvents"));
  batch.set(auditRef, auditEventPayload("security.emergency_freeze.lifted", {
    actorName: profile.displayName || profile.fullName || "Founder Director",
    objectType: "system",
    objectId: "emergencyAccessFreeze",
    reason: "Founder lifted the emergency access freeze.",
    restoredCount: restores.length
  }));
  await batch.commit();
  return restores.length;
}

export async function recordAccessReview(input, profile) {
  requireFounder(profile);
  const directors = await listSecurityDirectors(profile);
  const result = input.result === "changes_required" ? "changes_required" : "approved";
  const snapshot = directors.map((entry) => ({
    uid: entry.uid,
    directorNumber: entry.directorNumber || null,
    fullName: entry.fullName || entry.displayName || "Director",
    accountStatus: entry.accountStatus || null,
    boardStatus: entry.boardStatus || null,
    officerRole: entry.officerRole || null,
    permissionCount: Array.isArray(entry.permissions) ? entry.permissions.length : 0,
    sensitivePermissions: sensitivePermissionsFor(entry)
  }));
  const eventRef = doc(collection(db, "auditEvents"));
  await setDoc(eventRef, auditEventPayload("security.access_review.completed", {
    actorName: profile.displayName || profile.fullName || "Founder Director",
    objectType: "accessReview",
    objectId: eventRef.id,
    reason: clean(input.notes, 5000) || "Periodic Board portal access review.",
    result,
    directorCount: snapshot.length,
    privilegedCount: snapshot.filter((entry) => entry.sensitivePermissions.length > 0).length,
    snapshot
  }));
  await setDoc(doc(db, "system", "lastAccessReview"), {
    docType: "access_review_marker",
    result,
    notes: clean(input.notes, 5000) || null,
    reviewedAt: serverTimestamp(),
    reviewedBy: auth.currentUser.uid,
    reviewedByName: profile.displayName || profile.fullName || "Founder Director",
    auditEventId: eventRef.id
  }, { merge: false });
  return eventRef.id;
}
