import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import {
  buildActivationPassword,
  buildLoginKey,
  buildPinPassword,
  validatePin
} from "./identity.js";
import {
  backfillBoardDirectory,
  createDirectorAccount,
  listDirectorAccounts,
  prepareDirectorPinReset,
  updateDirectorAccess
} from "./founder-admin.js";
import {
  archiveBoardNotice,
  listBoardDirectory,
  listBoardNotices,
  publishBoardNotice,
  summarizeBoardDirectory
} from "./board-data.js";
import {
  hasPermission,
  PERMISSIONS,
  PERMISSION_TEMPLATES,
  permissionsForTemplate
} from "./permissions.js";

const $ = (selector) => document.querySelector(selector);
const signedOutView = $("#signed-out-view");
const signedInView = $("#signed-in-view");
const loginForm = $("#login-form");
const loginInstructions = $("#login-instructions");
const nameField = $("#name-field");
const fullNameInput = $("#full-name");
const activationField = $("#activation-field");
const activationCodeInput = $("#activation-code");
const pinField = $("#pin-field");
const pinInput = $("#pin");
const continueButton = $("#continue-button");
const activationRecoveryButton = $("#activation-recovery-button");
const loginBackButton = $("#login-back-button");
const loginMessage = $("#login-message");
const pinSetupForm = $("#pin-setup-form");
const pinSetupName = $("#pin-setup-name");
const pinSetupMessage = $("#pin-setup-message");
const signOutButton = $("#sign-out-button");
const accountName = $("#account-name");
const accountRole = $("#account-role");
const founderOnlyElements = document.querySelectorAll(".founder-only");
const navItems = document.querySelectorAll(".nav-item[data-view]");
const directorsNav = document.querySelector('.nav-item[data-view="directors"]');
const viewTitle = $("#view-title");
const overviewView = $("#view-overview");
const directorsView = $("#view-directors");
const placeholderView = $("#view-placeholder");
const placeholderTitle = $("#placeholder-title");
const placeholderCopy = $("#placeholder-copy");
const founderView = $("#view-founder");

const boardTotalMetric = $("#board-total-metric");
const boardConfirmedMetric = $("#board-confirmed-metric");
const boardInterimMetric = $("#board-interim-metric");
const accountStatusMetric = $("#account-status-metric");
const accountNumberMetric = $("#account-number-metric");
const profileName = $("#profile-name");
const profileDirectorNumber = $("#profile-director-number");
const profileBoardRole = $("#profile-board-role");
const profileOfficerRole = $("#profile-officer-role");
const profileBoardStatus = $("#profile-board-status");
const profileVotingStatus = $("#profile-voting-status");
const profileTerm = $("#profile-term");
const profilePermissions = $("#profile-permissions");
const dashboardNotices = $("#dashboard-notices");
const changePinForm = $("#change-pin-form");
const changePinMessage = $("#change-pin-message");

const refreshDirectoryButton = $("#refresh-directory-button");
const directorySearch = $("#directory-search");
const directoryStatusFilter = $("#directory-status-filter");
const directoryGrid = $("#directory-grid");
const directoryTotal = $("#directory-total");
const directoryConfirmed = $("#directory-confirmed");
const directoryInterim = $("#directory-interim");
const directoryVoting = $("#directory-voting");
const directoryProfilePanel = $("#directory-profile-panel");
const directoryProfileAvatar = $("#directory-profile-avatar");
const directoryProfileName = $("#directory-profile-name");
const directoryProfileNumber = $("#directory-profile-number");
const directoryProfileRole = $("#directory-profile-role");
const directoryProfileOfficer = $("#directory-profile-officer");
const directoryProfileStatus = $("#directory-profile-status");
const directoryProfileVoting = $("#directory-profile-voting");
const directoryProfileTerm = $("#directory-profile-term");
const closeDirectoryProfile = $("#close-directory-profile");

const createDirectorForm = $("#create-director-form");
const createDirectorMessage = $("#create-director-message");
const permissionTemplateSelect = $("#director-permission-template");
const activationResult = $("#activation-result");
const activationResultName = $("#activation-result-name");
const activationResultCode = $("#activation-result-code");
const activationResultNumber = $("#activation-result-number");
const copyActivationButton = $("#copy-activation-button");
const refreshDirectorsButton = $("#refresh-directors-button");
const directorCount = $("#director-count");
const directorTableBody = $("#director-table-body");
const founderTotalCount = $("#founder-total-count");
const founderActiveCount = $("#founder-active-count");
const founderAwaitingCount = $("#founder-awaiting-count");
const founderOtherCount = $("#founder-other-count");

const boardNoticeForm = $("#board-notice-form");
const boardNoticeMessage = $("#board-notice-message");
const founderNoticeList = $("#founder-notice-list");
const refreshNoticesButton = $("#refresh-notices-button");

const manageDirectorPanel = $("#manage-director-panel");
const manageDirectorForm = $("#manage-director-form");
const manageDirectorName = $("#manage-director-name");
const manageDirectorNumber = $("#manage-director-number");
const manageDirectorUid = $("#manage-director-uid");
const manageBoardRole = $("#manage-board-role");
const manageOfficerRole = $("#manage-officer-role");
const manageBoardStatus = $("#manage-board-status");
const manageVotingStatus = $("#manage-voting-status");
const manageTermStart = $("#manage-term-start");
const manageTermEnd = $("#manage-term-end");
const manageAccountStatus = $("#manage-account-status");
const manageDirectoryVisible = $("#manage-directory-visible");
const managePermissionTemplate = $("#manage-permission-template");
const applyPermissionTemplateButton = $("#apply-permission-template");
const permissionCheckboxes = $("#permission-checkboxes");
const manageDirectorMessage = $("#manage-director-message");
const closeManageDirectorButton = $("#close-manage-director");
const cancelManageDirectorButton = $("#cancel-manage-director");
const preparePinResetButton = $("#prepare-pin-reset");
const pinRecoveryResult = $("#pin-recovery-result");
const pinRecoveryName = $("#pin-recovery-name");
const pinRecoveryAlias = $("#pin-recovery-alias");
const pinRecoveryPassword = $("#pin-recovery-password");
const pinRecoveryCode = $("#pin-recovery-code");

const moduleCopy = Object.freeze({
  meetings: ["Meetings", "Live meeting activation, director check-in, attendance, and quorum are intentionally held for Phase 5."],
  documents: ["Board Documents", "Google Docs, Drive, Sheets, and Slides link submissions are intentionally held for Phase 4. No file uploads will be added."],
  resolutions: ["Resolutions", "The permanent resolution registry and live Board actions are introduced with the meeting and voting phases."]
});

let loginStep = "name";
let pendingLogin = null;
let currentProfile = null;
let currentLoginRecord = null;
let founderAccounts = [];
let directoryEntries = [];
let boardNotices = [];
let profileUnsubscribe = null;

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function humanize(value = "") {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TPP";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatTerm(start, end) {
  if (!start && !end) return "Not set";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `Begins ${formatDate(start)}`;
  return `Through ${formatDate(end)}`;
}

function permissionLabel(permission) {
  return String(permission)
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (busy && label) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
  } else if (!busy && button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}

function authErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The name and credential provided were not accepted.";
    case "auth/too-many-requests":
      return "Sign-in has been temporarily limited after repeated attempts. Try again later or contact the Founder Director.";
    case "auth/requires-recent-login":
      return "For security, sign out and sign back in with your current PIN before changing it.";
    case "auth/network-request-failed":
      return "The portal could not reach Firebase. Check your connection and try again.";
    default:
      return error?.message || "The portal could not complete that request.";
  }
}

function syncLoginButtonLabel() {
  if (loginStep === "activation") continueButton.textContent = "Verify activation code";
  else if (loginStep === "pin" || loginStep === "recovery-pin") continueButton.textContent = "Sign in";
  else continueButton.textContent = "Continue";
}

function resetLoginFlow({ keepName = false } = {}) {
  loginStep = "name";
  pendingLogin = null;
  currentLoginRecord = null;
  nameField.hidden = false;
  activationField.hidden = true;
  pinField.hidden = true;
  activationRecoveryButton.hidden = true;
  loginBackButton.hidden = true;
  syncLoginButtonLabel();
  loginInstructions.textContent = "Enter your full name to continue.";
  loginMessage.textContent = "";
  activationCodeInput.value = "";
  pinInput.value = "";
  if (!keepName) fullNameInput.value = "";
}

function showSignedOut() {
  signedOutView.hidden = false;
  signedInView.hidden = true;
}

function showPinSetup(profile, loginRecord) {
  signedOutView.hidden = false;
  signedInView.hidden = true;
  loginForm.hidden = true;
  pinSetupForm.hidden = false;
  pinSetupName.textContent = profile.displayName || profile.fullName || "Director";
  pinSetupMessage.textContent = profile.accountStatus === "pin_reset_required"
    ? "Choose a new four-digit PIN to complete your account recovery."
    : "";
  currentProfile = profile;
  currentLoginRecord = loginRecord;
}

function renderPermissionChips(profile) {
  profilePermissions.replaceChildren();
  const permissions = isFounder(profile) ? ["Founder Root · All Portal Capabilities"] : (profile.permissions || []).map(permissionLabel);
  if (!permissions.length) {
    profilePermissions.innerHTML = '<span class="muted-copy">No portal capabilities are currently assigned.</span>';
    return;
  }
  permissions.forEach((permission) => {
    const chip = document.createElement("span");
    chip.className = "permission-chip";
    chip.textContent = permission;
    profilePermissions.append(chip);
  });
}

function applyProfileToUI(profile) {
  currentProfile = profile;
  const founder = isFounder(profile);
  accountName.textContent = profile.displayName || profile.fullName || "Board Portal";
  accountRole.textContent = profile.officerRole || profile.boardRole || "Director";
  founderOnlyElements.forEach((element) => { element.hidden = !founder; });
  directorsNav.hidden = !hasPermission(profile, PERMISSIONS.DIRECTORS_VIEW);

  accountStatusMetric.textContent = profile.accountStatus === "active" ? "Active" : humanize(profile.accountStatus);
  accountNumberMetric.textContent = profile.directorNumber ? `${profile.directorNumber} · Board identity verified.` : "Board identity verified.";
  profileName.textContent = profile.fullName || "—";
  profileDirectorNumber.textContent = profile.directorNumber || "—";
  profileBoardRole.textContent = profile.boardRole || "Director";
  profileOfficerRole.textContent = profile.officerRole || "None";
  profileBoardStatus.textContent = humanize(profile.boardStatus || "interim");
  profileVotingStatus.textContent = profile.votingStatus === "ineligible" ? "Ineligible" : "Eligible";
  profileTerm.textContent = formatTerm(profile.termStart, profile.termEnd);
  renderPermissionChips(profile);
}

function watchCurrentProfile(uid) {
  if (profileUnsubscribe) profileUnsubscribe();
  profileUnsubscribe = onSnapshot(doc(db, "directors", uid), (snapshot) => {
    if (!auth.currentUser || auth.currentUser.uid !== uid) return;
    if (!snapshot.exists()) {
      signOut(auth).catch(console.error);
      return;
    }
    const profile = { uid: snapshot.id, ...snapshot.data() };
    if (profile.accountStatus !== "active") {
      signOut(auth).catch(console.error);
      return;
    }
    applyProfileToUI(profile);
  }, (error) => {
    console.warn("Director profile listener closed", error);
    if (auth.currentUser?.uid === uid) signOut(auth).catch(console.error);
  });
}

function showSignedIn(profile) {
  signedOutView.hidden = true;
  signedInView.hidden = false;
  loginForm.hidden = false;
  pinSetupForm.hidden = true;
  applyProfileToUI(profile);
  switchPortalView("overview");
  watchCurrentProfile(profile.uid);
  refreshBoardWorkspace().catch(console.error);
  if (isFounder(profile)) loadFounderAccounts().catch(console.error);
}

async function loadDirectorProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

async function loadLoginRecord(loginKey) {
  if (!loginKey) return null;
  const snapshot = await getDoc(doc(db, "loginDirectory", loginKey));
  return snapshot.exists() ? { loginKey, ...snapshot.data() } : null;
}

async function finalizeActivationRecord(profile, loginRecord) {
  if (!auth.currentUser || !profile?.loginKey || !loginRecord) throw new Error("The activation record is unavailable.");
  const batch = writeBatch(db);
  batch.update(doc(db, "directors", auth.currentUser.uid), {
    accountStatus: "active",
    activationCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.update(doc(db, "loginDirectory", profile.loginKey), {
    activationRequired: false,
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
}

async function lookupName() {
  const fullName = fullNameInput.value.trim();
  if (!fullName) {
    loginMessage.textContent = "Enter your full name to continue.";
    return;
  }

  setBusy(continueButton, true, "Checking…");
  loginMessage.textContent = "";
  try {
    const loginKey = await buildLoginKey(fullName);
    const record = await loadLoginRecord(loginKey);
    if (!record?.authEmail) {
      loginMessage.textContent = "The portal could not continue with that Board identity.";
      return;
    }

    pendingLogin = { fullName, loginKey, ...record };
    nameField.hidden = true;
    loginBackButton.hidden = false;

    if (record.activationRequired === true) {
      loginStep = "activation";
      activationField.hidden = false;
      pinField.hidden = true;
      activationRecoveryButton.hidden = false;
      loginInstructions.textContent = `Activate or recover the Board account for ${fullName}.`;
      activationCodeInput.focus();
    } else {
      loginStep = "pin";
      activationField.hidden = true;
      pinField.hidden = false;
      activationRecoveryButton.hidden = true;
      loginInstructions.textContent = `Enter the four-digit PIN for ${fullName}.`;
      pinInput.focus();
    }
  } catch (error) {
    console.error("Unable to resolve Board identity", error);
    loginMessage.textContent = "The portal could not check that Board identity.";
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function activateWithCode() {
  if (!pendingLogin?.authEmail) {
    resetLoginFlow({ keepName: true });
    return;
  }
  setBusy(continueButton, true, "Verifying…");
  loginMessage.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, pendingLogin.authEmail, buildActivationPassword(activationCodeInput.value));
  } catch (error) {
    console.error("Activation sign-in failed", error);
    loginMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function signInWithPin() {
  if (!pendingLogin?.authEmail) {
    resetLoginFlow({ keepName: true });
    return;
  }
  if (!validatePin(pinInput.value)) {
    loginMessage.textContent = "Enter your four-digit PIN.";
    return;
  }

  setBusy(continueButton, true, "Signing in…");
  loginMessage.textContent = "";
  try {
    const credential = await signInWithEmailAndPassword(auth, pendingLogin.authEmail, buildPinPassword(pinInput.value, pendingLogin.authEmail));
    if (loginStep === "recovery-pin") {
      sessionStorage.setItem("tpp-activation-recovery", credential.user.uid);
    }
  } catch (error) {
    console.error("PIN sign-in failed", error);
    loginMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

function startActivationRecovery() {
  if (!pendingLogin?.authEmail) return;
  loginStep = "recovery-pin";
  activationField.hidden = true;
  pinField.hidden = false;
  activationRecoveryButton.hidden = true;
  loginInstructions.textContent = `Enter the PIN you already created for ${pendingLogin.fullName}.`;
  loginMessage.textContent = "Use this only if activation was interrupted after your PIN was saved.";
  syncLoginButtonLabel();
  pinInput.focus();
}

async function completePinSetup(event) {
  event.preventDefault();
  const formData = new FormData(pinSetupForm);
  const pin = String(formData.get("newPin") ?? "");
  const confirmPin = String(formData.get("confirmPin") ?? "");
  const saveButton = $("#save-pin-button");

  if (!validatePin(pin)) {
    pinSetupMessage.textContent = "Choose exactly four digits for your PIN.";
    return;
  }
  if (pin !== confirmPin) {
    pinSetupMessage.textContent = "The two PIN entries do not match.";
    return;
  }
  if (!auth.currentUser || !currentProfile?.loginKey) {
    pinSetupMessage.textContent = "Your activation session is no longer available. Start again from the sign-in page.";
    return;
  }

  setBusy(saveButton, true, "Activating…");
  pinSetupMessage.textContent = "";
  try {
    const loginRecord = currentLoginRecord || await loadLoginRecord(currentProfile.loginKey);
    if (!loginRecord?.authEmail) throw new Error("The account login record is unavailable.");
    await updatePassword(auth.currentUser, buildPinPassword(pin, loginRecord.authEmail));
    await finalizeActivationRecord(currentProfile, loginRecord);
    pinSetupForm.reset();
    currentProfile = await loadDirectorProfile(auth.currentUser.uid);
    currentLoginRecord = { ...loginRecord, activationRequired: false };
    showSignedIn(currentProfile);
  } catch (error) {
    console.error("Unable to complete PIN activation", error);
    pinSetupMessage.textContent = `${authErrorMessage(error)} If your PIN was already saved before this error, return to sign in and choose “I already created my PIN.”`;
  } finally {
    setBusy(saveButton, false);
  }
}

async function changeOwnPin(event) {
  event.preventDefault();
  if (!auth.currentUser || !currentProfile) return;
  const data = new FormData(changePinForm);
  const newPin = String(data.get("newPin") ?? "");
  const confirmPin = String(data.get("confirmPin") ?? "");
  const button = changePinForm.querySelector('button[type="submit"]');

  if (!validatePin(newPin)) {
    changePinMessage.textContent = "Choose exactly four digits for your new PIN.";
    return;
  }
  if (newPin !== confirmPin) {
    changePinMessage.textContent = "The two PIN entries do not match.";
    return;
  }

  setBusy(button, true, "Changing PIN…");
  changePinMessage.textContent = "";
  try {
    const loginRecord = await loadLoginRecord(currentProfile.loginKey);
    if (!loginRecord?.authEmail) throw new Error("The account login record is unavailable.");
    await updatePassword(auth.currentUser, buildPinPassword(newPin, loginRecord.authEmail));
    changePinForm.reset();
    changePinMessage.textContent = "Your Board Portal PIN has been changed.";
  } catch (error) {
    console.error("Unable to change PIN", error);
    changePinMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(button, false);
  }
}

function switchPortalView(view) {
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  overviewView.hidden = view !== "overview";
  directorsView.hidden = view !== "directors";
  founderView.hidden = view !== "founder";
  placeholderView.hidden = ["overview", "directors", "founder"].includes(view);

  if (view === "overview") {
    viewTitle.textContent = "Governance Overview";
    return;
  }
  if (view === "directors") {
    if (!hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW)) {
      switchPortalView("overview");
      return;
    }
    viewTitle.textContent = "Board Directory";
    renderDirectory();
    return;
  }
  if (view === "founder") {
    if (!isFounder(currentProfile)) {
      switchPortalView("overview");
      return;
    }
    viewTitle.textContent = "Founder Director Control";
    loadFounderAccounts().catch(console.error);
    loadNotices().catch(console.error);
    return;
  }

  const [title, copy] = moduleCopy[view] || ["Board Module", "This module is not available yet."];
  viewTitle.textContent = title;
  placeholderTitle.textContent = title;
  placeholderCopy.textContent = copy;
}

function populateTemplateSelect(select) {
  select.replaceChildren();
  Object.entries(PERMISSION_TEMPLATES).forEach(([key, template]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = template.label;
    select.append(option);
  });
}

function populatePermissionTemplates() {
  populateTemplateSelect(permissionTemplateSelect);
  populateTemplateSelect(managePermissionTemplate);
}

function buildPermissionCheckboxes() {
  permissionCheckboxes.replaceChildren();
  Object.values(PERMISSIONS).forEach((permission) => {
    const label = document.createElement("label");
    label.className = "permission-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "permission";
    input.value = permission;
    const text = document.createElement("span");
    text.textContent = permissionLabel(permission);
    label.append(input, text);
    permissionCheckboxes.append(label);
  });
}

function setPermissionSelection(permissions = []) {
  const selected = new Set(Array.isArray(permissions) ? permissions : []);
  permissionCheckboxes.querySelectorAll('input[name="permission"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function getPermissionSelection() {
  return Array.from(permissionCheckboxes.querySelectorAll('input[name="permission"]:checked')).map((input) => input.value);
}

function renderBoardMetrics() {
  const metrics = summarizeBoardDirectory(directoryEntries);
  boardTotalMetric.textContent = String(metrics.total);
  boardConfirmedMetric.textContent = String(metrics.confirmed);
  boardInterimMetric.textContent = String(metrics.interim);
  directoryTotal.textContent = String(metrics.total);
  directoryConfirmed.textContent = String(metrics.confirmed);
  directoryInterim.textContent = String(metrics.interim);
  directoryVoting.textContent = String(metrics.votingEligible);
}

async function loadDirectory() {
  if (!currentProfile || !hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW)) {
    directoryEntries = [];
    renderBoardMetrics();
    return;
  }
  directoryEntries = await listBoardDirectory(currentProfile);
  renderBoardMetrics();
  renderDirectory();
}

function renderDirectory() {
  if (!directoryGrid) return;
  const query = directorySearch.value.trim().toLowerCase();
  const status = directoryStatusFilter.value;
  const currentStatuses = new Set(["interim", "confirmed", "leave_of_absence"]);

  const filtered = directoryEntries.filter((entry) => {
    const entryStatus = entry.boardStatus || "interim";
    const statusMatch = status === "all"
      || (status === "current" && currentStatuses.has(entryStatus))
      || entryStatus === status;
    const searchable = [entry.fullName, entry.displayName, entry.directorNumber, entry.boardRole, entry.officerRole]
      .filter(Boolean).join(" ").toLowerCase();
    return statusMatch && (!query || searchable.includes(query));
  });

  directoryGrid.replaceChildren();
  if (!filtered.length) {
    directoryGrid.innerHTML = '<div class="empty-state">No directors match the current directory filters.</div>';
    return;
  }

  filtered.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "director-card";
    const avatar = document.createElement("div");
    avatar.className = "director-avatar";
    avatar.textContent = initials(entry.displayName || entry.fullName);
    const content = document.createElement("div");
    content.className = "director-card-content";
    const top = document.createElement("div");
    top.className = "director-card-top";
    const identity = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = entry.displayName || entry.fullName || "Director";
    const number = document.createElement("span");
    number.textContent = entry.directorNumber || "Board Director";
    identity.append(name, number);
    const badge = document.createElement("span");
    badge.className = `board-status status-${entry.boardStatus || "interim"}`;
    badge.textContent = humanize(entry.boardStatus || "interim");
    top.append(identity, badge);

    const role = document.createElement("p");
    role.textContent = entry.officerRole ? `${entry.boardRole || "Director"} · ${entry.officerRole}` : (entry.boardRole || "Director");
    const term = document.createElement("small");
    term.textContent = formatTerm(entry.termStart, entry.termEnd);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-action director-profile-button";
    button.dataset.directoryUid = entry.uid;
    button.textContent = "View profile";
    content.append(top, role, term, button);
    card.append(avatar, content);
    directoryGrid.append(card);
  });
}

function openDirectoryProfile(uid) {
  const entry = directoryEntries.find((item) => item.uid === uid);
  if (!entry) return;
  directoryProfileAvatar.textContent = initials(entry.displayName || entry.fullName);
  directoryProfileName.textContent = entry.displayName || entry.fullName || "Director";
  directoryProfileNumber.textContent = entry.directorNumber || "—";
  directoryProfileRole.textContent = entry.boardRole || "Director";
  directoryProfileOfficer.textContent = entry.officerRole || "None";
  directoryProfileStatus.textContent = humanize(entry.boardStatus || "interim");
  directoryProfileVoting.textContent = entry.votingStatus === "ineligible" ? "Ineligible" : "Eligible";
  directoryProfileTerm.textContent = formatTerm(entry.termStart, entry.termEnd);
  directoryProfilePanel.hidden = false;
  directoryProfilePanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderNotices() {
  dashboardNotices.replaceChildren();
  founderNoticeList.replaceChildren();

  if (!boardNotices.length) {
    dashboardNotices.innerHTML = '<div class="empty-state">No active Board notices.</div>';
    founderNoticeList.innerHTML = '<div class="empty-state">No active Board notices.</div>';
    return;
  }

  boardNotices.slice(0, 5).forEach((notice) => dashboardNotices.append(buildNoticeCard(notice, false)));
  boardNotices.forEach((notice) => founderNoticeList.append(buildNoticeCard(notice, isFounder(currentProfile))));
}

function buildNoticeCard(notice, manageable) {
  const card = document.createElement("article");
  card.className = `notice-card priority-${notice.priority || "normal"}`;
  const header = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = notice.title || "Board Notice";
  const priority = document.createElement("span");
  priority.textContent = humanize(notice.priority || "normal");
  header.append(title, priority);
  const body = document.createElement("p");
  body.textContent = notice.body || "";
  card.append(header, body);
  if (notice.expiresOn) {
    const expiry = document.createElement("small");
    expiry.textContent = `Expires ${formatDate(notice.expiresOn)}`;
    card.append(expiry);
  }
  if (manageable) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button notice-archive-button";
    button.dataset.archiveNotice = notice.id;
    button.textContent = "Archive notice";
    card.append(button);
  }
  return card;
}

async function loadNotices() {
  boardNotices = await listBoardNotices();
  renderNotices();
}

async function refreshBoardWorkspace() {
  const jobs = [];
  if (hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW)) jobs.push(loadDirectory());
  jobs.push(loadNotices());
  await Promise.allSettled(jobs);
}

function makeCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function renderFounderMetrics(accounts) {
  const active = accounts.filter((entry) => entry.accountStatus === "active").length;
  const awaiting = accounts.filter((entry) => entry.accountStatus === "awaiting_activation").length;
  founderTotalCount.textContent = String(accounts.length);
  founderActiveCount.textContent = String(active);
  founderAwaitingCount.textContent = String(awaiting);
  founderOtherCount.textContent = String(Math.max(0, accounts.length - active - awaiting));
}

function renderDirectorAccounts(accounts) {
  founderAccounts = accounts;
  renderFounderMetrics(accounts);
  directorTableBody.replaceChildren();
  directorCount.textContent = String(accounts.length);

  if (!accounts.length) {
    const row = document.createElement("tr");
    const cell = makeCell("No director accounts have been created.", "empty-cell");
    cell.colSpan = 6;
    row.append(cell);
    directorTableBody.append(row);
    return;
  }

  accounts.forEach((director) => {
    const row = document.createElement("tr");
    const identityCell = document.createElement("td");
    const name = document.createElement("strong");
    const number = document.createElement("small");
    name.textContent = director.fullName || "Unnamed Director";
    number.textContent = director.directorNumber || director.uid;
    identityCell.append(name, number);

    const manageCell = document.createElement("td");
    if (director.root === true || director.systemRole === "founder_director") {
      const protectedBadge = document.createElement("span");
      protectedBadge.className = "protected-badge";
      protectedBadge.textContent = "Protected";
      manageCell.append(protectedBadge);
    } else {
      const manageButton = document.createElement("button");
      manageButton.type = "button";
      manageButton.className = "table-action";
      manageButton.dataset.manageUid = director.uid;
      manageButton.textContent = "Manage";
      manageCell.append(manageButton);
    }

    row.append(
      identityCell,
      makeCell(director.officerRole || director.boardRole || "Director"),
      makeCell(humanize(director.boardStatus || "interim"), "status-cell"),
      makeCell(humanize(director.accountStatus || "unknown"), "status-cell"),
      makeCell(director.root === true ? "Founder Root" : (PERMISSION_TEMPLATES[director.permissionTemplate]?.label || "Custom")),
      manageCell
    );
    directorTableBody.append(row);
  });
}

async function loadFounderAccounts() {
  if (!isFounder(currentProfile)) return;
  directorTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">Loading accounts…</td></tr>';
  try {
    await backfillBoardDirectory(currentProfile);
    const accounts = await listDirectorAccounts(currentProfile);
    renderDirectorAccounts(accounts);
    await loadDirectory();
  } catch (error) {
    console.error("Unable to load director accounts", error);
    directorTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">Unable to load Board accounts.</td></tr>';
  }
}

function openManageDirector(uid) {
  const director = founderAccounts.find((entry) => entry.uid === uid);
  if (!director || director.root === true || director.systemRole === "founder_director") return;

  manageDirectorUid.value = director.uid;
  manageDirectorName.textContent = director.fullName || "Director";
  manageDirectorNumber.textContent = director.directorNumber || director.uid;
  manageBoardRole.value = director.boardRole || "Director";
  manageOfficerRole.value = director.officerRole || "";
  manageBoardStatus.value = director.boardStatus || "interim";
  manageVotingStatus.value = director.votingStatus === "ineligible" ? "ineligible" : "eligible";
  manageTermStart.value = director.termStart || "";
  manageTermEnd.value = director.termEnd || "";
  manageAccountStatus.value = director.accountStatus || "active";
  manageDirectoryVisible.checked = director.directoryVisible !== false;
  managePermissionTemplate.value = PERMISSION_TEMPLATES[director.permissionTemplate] ? director.permissionTemplate : "standard_director";
  setPermissionSelection(director.permissions || []);
  manageDirectorMessage.textContent = "";
  pinRecoveryResult.hidden = true;
  manageDirectorPanel.hidden = false;
  manageDirectorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeManageDirector() {
  manageDirectorPanel.hidden = true;
  manageDirectorForm.reset();
  manageDirectorMessage.textContent = "";
  pinRecoveryResult.hidden = true;
  setPermissionSelection([]);
}

async function handleManageDirector(event) {
  event.preventDefault();
  const uid = manageDirectorUid.value;
  const saveButton = manageDirectorForm.querySelector('button[type="submit"]');
  if (!uid || !isFounder(currentProfile)) return;

  setBusy(saveButton, true, "Saving access…");
  manageDirectorMessage.textContent = "";
  try {
    await updateDirectorAccess(uid, {
      boardRole: manageBoardRole.value,
      officerRole: manageOfficerRole.value,
      boardStatus: manageBoardStatus.value,
      votingStatus: manageVotingStatus.value,
      termStart: manageTermStart.value || null,
      termEnd: manageTermEnd.value || null,
      accountStatus: manageAccountStatus.value,
      directoryVisible: manageDirectoryVisible.checked,
      permissions: getPermissionSelection()
    }, currentProfile);
    manageDirectorMessage.textContent = "Director account and Board profile updated.";
    await loadFounderAccounts();
  } catch (error) {
    console.error("Unable to update director access", error);
    manageDirectorMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(saveButton, false);
  }
}

async function handleCreateDirector(event) {
  event.preventDefault();
  if (!isFounder(currentProfile)) return;

  const submitButton = createDirectorForm.querySelector('button[type="submit"]');
  const formData = new FormData(createDirectorForm);
  createDirectorMessage.textContent = "";
  activationResult.hidden = true;
  setBusy(submitButton, true, "Creating account…");
  try {
    const result = await createDirectorAccount({
      fullName: formData.get("fullName"),
      boardRole: formData.get("boardRole"),
      officerRole: formData.get("officerRole"),
      boardStatus: formData.get("boardStatus"),
      votingStatus: formData.get("votingStatus"),
      termStart: formData.get("termStart") || null,
      termEnd: formData.get("termEnd") || null,
      permissionTemplate: formData.get("permissionTemplate")
    }, currentProfile);

    activationResultName.textContent = result.fullName;
    activationResultCode.textContent = result.activationCode;
    activationResultNumber.textContent = result.directorNumber;
    activationResult.hidden = false;
    createDirectorMessage.textContent = "Board account and directory profile created successfully.";
    createDirectorForm.reset();
    $("#director-board-role").value = "Director";
    $("#director-board-status").value = "interim";
    populateTemplateSelect(permissionTemplateSelect);
    await loadFounderAccounts();
  } catch (error) {
    console.error("Unable to create director account", error);
    createDirectorMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(submitButton, false);
  }
}

async function preparePinRecovery() {
  const uid = manageDirectorUid.value;
  if (!uid || !isFounder(currentProfile)) return;
  setBusy(preparePinResetButton, true, "Preparing…");
  manageDirectorMessage.textContent = "";
  try {
    const result = await prepareDirectorPinReset(uid, currentProfile);
    pinRecoveryName.textContent = `${result.fullName} · ${result.directorNumber || "Director"}`;
    pinRecoveryAlias.textContent = result.authEmail;
    pinRecoveryPassword.textContent = result.temporaryAuthPassword;
    pinRecoveryCode.textContent = result.activationCode;
    pinRecoveryResult.hidden = false;
    manageDirectorMessage.textContent = "PIN recovery prepared. Complete the Firebase administrative password step shown below before giving the activation code to the director.";
    await loadFounderAccounts();
  } catch (error) {
    console.error("Unable to prepare PIN recovery", error);
    manageDirectorMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(preparePinResetButton, false);
  }
}

async function publishNotice(event) {
  event.preventDefault();
  const button = boardNoticeForm.querySelector('button[type="submit"]');
  const data = new FormData(boardNoticeForm);
  setBusy(button, true, "Publishing…");
  boardNoticeMessage.textContent = "";
  try {
    await publishBoardNotice({
      title: data.get("title"),
      body: data.get("body"),
      priority: data.get("priority"),
      expiresOn: data.get("expiresOn") || null
    }, currentProfile);
    boardNoticeForm.reset();
    boardNoticeMessage.textContent = "Board notice published.";
    await loadNotices();
  } catch (error) {
    console.error("Unable to publish Board notice", error);
    boardNoticeMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(button, false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginStep === "name") await lookupName();
  else if (loginStep === "activation") await activateWithCode();
  else if (loginStep === "pin" || loginStep === "recovery-pin") await signInWithPin();
});
loginBackButton.addEventListener("click", () => resetLoginFlow({ keepName: true }));
activationRecoveryButton.addEventListener("click", startActivationRecovery);
pinSetupForm.addEventListener("submit", completePinSetup);
changePinForm.addEventListener("submit", changeOwnPin);
signOutButton.addEventListener("click", async () => signOut(auth));
createDirectorForm.addEventListener("submit", handleCreateDirector);
manageDirectorForm.addEventListener("submit", handleManageDirector);
preparePinResetButton.addEventListener("click", preparePinRecovery);
boardNoticeForm.addEventListener("submit", publishNotice);
refreshDirectorsButton.addEventListener("click", () => loadFounderAccounts());
refreshDirectoryButton.addEventListener("click", () => loadDirectory());
refreshNoticesButton.addEventListener("click", () => loadNotices());
closeManageDirectorButton.addEventListener("click", closeManageDirector);
cancelManageDirectorButton.addEventListener("click", closeManageDirector);
closeDirectoryProfile.addEventListener("click", () => { directoryProfilePanel.hidden = true; });
applyPermissionTemplateButton.addEventListener("click", () => setPermissionSelection(permissionsForTemplate(managePermissionTemplate.value)));
directorySearch.addEventListener("input", renderDirectory);
directoryStatusFilter.addEventListener("change", renderDirectory);
directoryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-directory-uid]");
  if (button) openDirectoryProfile(button.dataset.directoryUid);
});
directorTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-manage-uid]");
  if (button) openManageDirector(button.dataset.manageUid);
});
founderNoticeList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-archive-notice]");
  if (!button) return;
  try {
    await archiveBoardNotice(button.dataset.archiveNotice, currentProfile);
    await loadNotices();
  } catch (error) {
    boardNoticeMessage.textContent = authErrorMessage(error);
  }
});
copyActivationButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(activationResultCode.textContent);
    copyActivationButton.textContent = "Copied";
    setTimeout(() => { copyActivationButton.textContent = "Copy code"; }, 1400);
  } catch {
    createDirectorMessage.textContent = "Copying was blocked by the browser. Select the activation code manually.";
  }
});
navItems.forEach((item) => item.addEventListener("click", () => switchPortalView(item.dataset.view)));

populatePermissionTemplates();
buildPermissionCheckboxes();
resetLoginFlow();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (profileUnsubscribe) {
      profileUnsubscribe();
      profileUnsubscribe = null;
    }
    currentProfile = null;
    currentLoginRecord = null;
    founderAccounts = [];
    directoryEntries = [];
    boardNotices = [];
    closeManageDirector();
    directoryProfilePanel.hidden = true;
    loginForm.hidden = false;
    pinSetupForm.hidden = true;
    showSignedOut();
    return;
  }

  try {
    let profile = await loadDirectorProfile(user.uid);
    if (!profile) {
      await signOut(auth);
      resetLoginFlow();
      loginMessage.textContent = "This Firebase identity is not authorized for the Board Portal.";
      return;
    }

    if (["awaiting_activation", "pin_reset_required"].includes(profile.accountStatus)) {
      const loginRecord = await loadLoginRecord(profile.loginKey);
      const recoveryUid = sessionStorage.getItem("tpp-activation-recovery");
      if (recoveryUid === user.uid) {
        await finalizeActivationRecord(profile, loginRecord);
        sessionStorage.removeItem("tpp-activation-recovery");
        profile = await loadDirectorProfile(user.uid);
        showSignedIn(profile);
        return;
      }
      showPinSetup(profile, loginRecord);
      return;
    }

    if (profile.accountStatus === "active") {
      showSignedIn(profile);
      return;
    }

    await signOut(auth);
    resetLoginFlow();
    loginMessage.textContent = "This Board account is not currently available for portal access.";
  } catch (error) {
    console.error("Unable to load director profile", error);
    try { await signOut(auth); } catch {}
    showSignedOut();
    loginMessage.textContent = "The portal could not load your Board profile.";
  }
});
