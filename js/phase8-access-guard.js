import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

let profileUnsub = null;
let initialized = false;
let lastPermissionSignature = null;

const TAB_PERMISSION = Object.freeze({
  committees: PERMISSIONS.COMMITTEES_VIEW,
  coi: PERMISSIONS.COI_VIEW,
  officers: PERMISSIONS.OFFICERS_VIEW,
  tasks: PERMISSIONS.TASKS_VIEW,
  compliance: PERMISSIONS.COMPLIANCE_VIEW
});

const PHASE8_PERMISSIONS = Object.freeze([
  PERMISSIONS.COMMITTEES_VIEW,
  PERMISSIONS.COMMITTEES_MANAGE,
  PERMISSIONS.COI_VIEW,
  PERMISSIONS.COI_SUBMIT,
  PERMISSIONS.COI_REVIEW,
  PERMISSIONS.COI_MANAGE,
  PERMISSIONS.OFFICERS_VIEW,
  PERMISSIONS.OFFICERS_MANAGE,
  PERMISSIONS.TASKS_VIEW,
  PERMISSIONS.TASKS_CREATE,
  PERMISSIONS.TASKS_UPDATE_OWN,
  PERMISSIONS.TASKS_MANAGE,
  PERMISSIONS.COMPLIANCE_VIEW,
  PERMISSIONS.COMPLIANCE_MANAGE,
  PERMISSIONS.DIRECTORS_VIEW
]);

function founder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function allowed(profile, permission) {
  return founder(profile) || hasPermission(profile, permission);
}

function permissionSignature(profile) {
  if (!profile) return "signed-out";
  if (founder(profile)) return "founder-root";
  return PHASE8_PERMISSIONS.map((permission) => `${permission}:${hasPermission(profile, permission) ? 1 : 0}`).join("|");
}

function applyAccess(profile) {
  const navigation = document.querySelector('.nav-item[data-view="governance"]');
  const tabs = Array.from(document.querySelectorAll("[data-phase8-tab]"));
  const permittedTabs = tabs.filter((button) => allowed(profile, TAB_PERMISSION[button.dataset.phase8Tab]));
  if (navigation) navigation.hidden = permittedTabs.length === 0;

  tabs.forEach((button) => {
    button.hidden = !allowed(profile, TAB_PERMISSION[button.dataset.phase8Tab]);
  });

  if (!permittedTabs.length) {
    const view = document.querySelector("#view-governance");
    if (view && !view.hidden) document.querySelector('.nav-item[data-view="overview"]')?.click();
    return;
  }

  const current = tabs.find((button) => button.classList.contains("active"));
  if (!current || current.hidden) permittedTabs[0].click();
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

function bindProfile(uid) {
  profileUnsub?.();
  profileUnsub = onSnapshot(doc(db, "directors", uid), (snapshot) => {
    if (!snapshot.exists() || snapshot.data().accountStatus !== "active") return applyAccess(null);
    const nextProfile = { uid: snapshot.id, ...snapshot.data() };
    const nextSignature = permissionSignature(nextProfile);
    if (lastPermissionSignature !== null && nextSignature !== lastPermissionSignature) {
      window.location.reload();
      return;
    }
    lastPermissionSignature = nextSignature;
    applyAccess(nextProfile);
  }, () => applyAccess(null));
}

function init() {
  if (initialized) return;
  initialized = true;
  onAuthStateChanged(auth, async (user) => {
    profileUnsub?.();
    profileUnsub = null;
    lastPermissionSignature = null;
    if (!user) return applyAccess(null);
    const profile = await loadProfile(user.uid);
    lastPermissionSignature = permissionSignature(profile);
    applyAccess(profile);
    if (profile?.accountStatus === "active") bindProfile(user.uid);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
