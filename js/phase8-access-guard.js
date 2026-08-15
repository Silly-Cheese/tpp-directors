import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

let profileUnsub = null;
let initialized = false;

const TAB_PERMISSION = Object.freeze({
  committees: PERMISSIONS.COMMITTEES_VIEW,
  coi: PERMISSIONS.COI_VIEW,
  officers: PERMISSIONS.OFFICERS_VIEW,
  tasks: PERMISSIONS.TASKS_VIEW,
  compliance: PERMISSIONS.COMPLIANCE_VIEW
});

function founder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function allowed(profile, permission) {
  return founder(profile) || hasPermission(profile, permission);
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
    applyAccess({ uid: snapshot.id, ...snapshot.data() });
  }, () => applyAccess(null));
}

function init() {
  if (initialized) return;
  initialized = true;
  onAuthStateChanged(auth, async (user) => {
    profileUnsub?.();
    profileUnsub = null;
    if (!user) return applyAccess(null);
    const profile = await loadProfile(user.uid);
    applyAccess(profile);
    if (profile?.accountStatus === "active") bindProfile(user.uid);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
