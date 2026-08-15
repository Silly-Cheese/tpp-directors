import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";
import { isFounder, sensitivePermissionsFor } from "./admin-security-data.js";

let profileUnsubscribe = null;
let currentProfile = null;
let initialized = false;

function canAudit(profile) {
  return isFounder(profile) || hasPermission(profile, PERMISSIONS.AUDIT_VIEW);
}

function applyLiveAuditAccess(profile) {
  currentProfile = profile;
  const nav = document.querySelector('.nav-item[data-view="security"]');
  if (nav) nav.hidden = !canAudit(profile);
  const securityView = document.querySelector("#view-security");
  if (!canAudit(profile) && securityView && !securityView.hidden) {
    document.querySelector('.nav-item[data-view="overview"]')?.click();
  }
}

function bindProfile(uid) {
  profileUnsubscribe?.();
  profileUnsubscribe = onSnapshot(doc(db, "directors", uid), (snapshot) => {
    if (!snapshot.exists() || snapshot.data().accountStatus !== "active") {
      applyLiveAuditAccess(null);
      return;
    }
    applyLiveAuditAccess({ uid: snapshot.id, ...snapshot.data() });
  }, () => applyLiveAuditAccess(null));
}

async function recordAtomicAccessReview(button) {
  if (!isFounder(currentProfile) || !auth.currentUser) return;
  const result = document.querySelector("#phase9-review-result")?.value === "changes_required" ? "changes_required" : "approved";
  const notes = String(document.querySelector("#phase9-review-notes")?.value || "").trim().slice(0, 5000);
  const directorsSnapshot = await getDocs(collection(db, "directors"));
  const accountSnapshot = directorsSnapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      uid: entry.id,
      directorNumber: data.directorNumber || null,
      fullName: data.fullName || data.displayName || "Director",
      accountStatus: data.accountStatus || null,
      boardStatus: data.boardStatus || null,
      officerRole: data.officerRole || null,
      permissionCount: Array.isArray(data.permissions) ? data.permissions.length : 0,
      sensitivePermissions: sensitivePermissionsFor({ uid: entry.id, ...data })
    };
  });
  const eventRef = doc(collection(db, "auditEvents"));
  const markerRef = doc(db, "system", "lastAccessReview");
  const actorName = currentProfile.displayName || currentProfile.fullName || "Founder Director";
  const batch = writeBatch(db);
  batch.set(eventRef, {
    actorUid: auth.currentUser.uid,
    actorName,
    action: "security.access_review.completed",
    objectType: "accessReview",
    objectId: eventRef.id,
    reason: notes || "Periodic Board portal access review.",
    details: {
      result,
      directorCount: accountSnapshot.length,
      privilegedCount: accountSnapshot.filter((entry) => entry.sensitivePermissions.length > 0).length,
      snapshot: accountSnapshot
    },
    createdAt: serverTimestamp()
  });
  batch.set(markerRef, {
    docType: "access_review_marker",
    result,
    notes: notes || null,
    reviewedAt: serverTimestamp(),
    reviewedBy: auth.currentUser.uid,
    reviewedByName: actorName,
    auditEventId: eventRef.id
  }, { merge: false });
  await batch.commit();
  const message = document.querySelector("#phase9-access-message");
  if (message) message.textContent = `Access review recorded atomically as audit event ${eventRef.id}.`;
  document.querySelector("#phase9-refresh")?.click();
  return eventRef.id;
}

function bindAtomicReviewInterceptor() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-phase9-action="record-access-review"]');
    if (!button || !isFounder(currentProfile)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    recordAtomicAccessReview(button).catch((error) => {
      const message = document.querySelector("#phase9-access-message");
      if (message) message.textContent = error.message || "Unable to record the access review.";
    }).finally(() => { button.disabled = false; });
  }, true);
}

function init() {
  if (initialized) return;
  initialized = true;
  bindAtomicReviewInterceptor();
  onAuthStateChanged(auth, (user) => {
    profileUnsubscribe?.();
    profileUnsubscribe = null;
    currentProfile = null;
    if (!user) return applyLiveAuditAccess(null);
    bindProfile(user.uid);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
