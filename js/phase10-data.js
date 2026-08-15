import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  evaluateEnvironment,
  evaluateLaunchGate,
  evaluateModuleStatus,
  evaluateSecuritySnapshot,
  normalizeManualState
} from "./production-readiness.js";

function requireFounder(profile) {
  if (!auth.currentUser || profile?.root !== true || profile?.systemRole !== "founder_director") {
    throw new Error("Founder Director root access is required for launch-readiness controls.");
  }
}

async function safeFetchText(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return { ok: false, status: response.status, text: "" };
    return { ok: true, status: response.status, text: await response.text() };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

async function safeFetchJson(path) {
  const result = await safeFetchText(path);
  if (!result.ok) return { ...result, json: null };
  try { return { ...result, json: JSON.parse(result.text) }; }
  catch { return { ...result, json: null }; }
}

async function listCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function getLaunchReadiness(profile) {
  requireFounder(profile);
  const snapshot = await getDoc(doc(db, "system", "launchReadiness"));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function runProductionDiagnostics(profile) {
  requireFounder(profile);
  const [cnameResult, firebaseResult, indexResult] = await Promise.all([
    safeFetchText("./CNAME"),
    safeFetchJson("./firebase.json"),
    safeFetchText("./firestore.indexes.json")
  ]);

  const [directors, incidentsRaw, meetings, votes, policySnap, reviewSnap, freezeSnap, ownProfileSnap] = await Promise.all([
    listCollection("directors"),
    listCollection("system"),
    listCollection("meetings"),
    listCollection("votes"),
    getDoc(doc(db, "system", "portalSecurityPolicy")),
    getDoc(doc(db, "system", "lastAccessReview")),
    getDoc(doc(db, "system", "emergencyAccessFreeze")),
    getDoc(doc(db, "directors", auth.currentUser.uid))
  ]);

  const incidents = incidentsRaw.filter((entry) => entry.docType === "security_incident");
  const environmentChecks = evaluateEnvironment({
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    projectId: firebaseConfig.projectId,
    cname: cnameResult.ok ? cnameResult.text : "",
    firebaseJson: firebaseResult.json,
    indexFilePresent: indexResult.ok ? true : (indexResult.status === 404 ? false : null),
    online: navigator.onLine
  });
  const moduleChecks = evaluateModuleStatus(window.__TPP_MODULE_STATUS__ || {});
  const securityChecks = evaluateSecuritySnapshot({
    directors,
    incidents,
    meetings,
    votes,
    policy: policySnap.exists() ? policySnap.data() : null,
    lastAccessReview: reviewSnap.exists() ? reviewSnap.data() : null,
    freeze: freezeSnap.exists() ? freezeSnap.data() : null
  });
  const identityCheck = {
    id: "founder_session",
    label: "Founder production session",
    status: ownProfileSnap.exists() && ownProfileSnap.data().root === true && ownProfileSnap.data().systemRole === "founder_director" && ownProfileSnap.data().accountStatus === "active" ? "pass" : "fail",
    detail: ownProfileSnap.exists() ? "Authenticated session is bound to the active Founder root profile." : "Founder profile document is unavailable.",
    critical: true
  };

  return {
    checks: [identityCheck, ...environmentChecks, ...moduleChecks, ...securityChecks],
    directors,
    incidents,
    meetings,
    votes,
    generatedAt: new Date().toISOString()
  };
}

export async function saveLaunchReadiness(input, profile, diagnostics = null) {
  requireFounder(profile);
  const current = await getLaunchReadiness(profile);
  const items = normalizeManualState(input.items || current?.items || {});
  const notes = String(input.notes || "").trim().slice(0, 8000) || null;
  const requestedStatus = ["draft", "ready_for_launch", "launched"].includes(input.status) ? input.status : (current?.status || "draft");
  if (current?.status === "launched" && requestedStatus !== "launched") {
    throw new Error("The portal is already recorded as Production Launched. The live launch status cannot be downgraded; save future notes/checklist changes while retaining Launched status.");
  }
  if (["ready_for_launch", "launched"].includes(requestedStatus)) {
    if (!Array.isArray(diagnostics?.checks) || diagnostics.checks.length === 0) throw new Error("Run current production diagnostics before recording launch readiness.");
    const gate = evaluateLaunchGate(diagnostics.checks, items);
    if (!gate.ready) throw new Error(`Launch gate is not clear: ${gate.criticalFailures.length + gate.criticalWarnings.length} automatic blocker(s) and ${gate.incompleteManual.length} manual item(s) remain.`);
  }

  const ref = doc(db, "system", "launchReadiness");
  const auditRef = doc(collection(db, "auditEvents"));
  const actorName = profile.displayName || profile.fullName || "Founder Director";
  const payload = {
    docType: "launch_readiness",
    status: requestedStatus,
    items,
    notes,
    automaticCheckSummary: Array.isArray(diagnostics?.checks) && diagnostics.checks.length ? {
      pass: diagnostics.checks.filter((entry) => entry.status === "pass").length,
      warning: diagnostics.checks.filter((entry) => entry.status === "warning").length,
      fail: diagnostics.checks.filter((entry) => entry.status === "fail").length,
      total: diagnostics.checks.length,
      checkedAt: serverTimestamp()
    } : (current?.automaticCheckSummary || null),
    createdAt: current?.createdAt || serverTimestamp(),
    createdBy: current?.createdBy || auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
    updatedByName: actorName,
    readyAt: requestedStatus === "ready_for_launch" ? (current?.readyAt || serverTimestamp()) : (current?.readyAt || null),
    launchedAt: requestedStatus === "launched" ? (current?.launchedAt || serverTimestamp()) : (current?.launchedAt || null)
  };
  const batch = writeBatch(db);
  batch.set(ref, payload, { merge: false });
  batch.set(auditRef, {
    actorUid: auth.currentUser.uid,
    actorName,
    action: `production.launch_readiness.${requestedStatus}`,
    objectType: "system",
    objectId: "launchReadiness",
    reason: notes || `Launch readiness saved with status ${requestedStatus}.`,
    details: {
      status: requestedStatus,
      completedManual: Object.values(items).filter(Boolean).length,
      totalManual: Object.keys(items).length
    },
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return payload;
}
