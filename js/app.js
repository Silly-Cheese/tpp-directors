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
  createDirectorAccount,
  listDirectorAccounts,
  updateDirectorAccess
} from "./founder-admin.js";
import {
  PERMISSIONS,
  PERMISSION_TEMPLATES,
  permissionsForTemplate
} from "./permissions.js";

const signedOutView = document.querySelector("#signed-out-view");
const signedInView = document.querySelector("#signed-in-view");
const loginForm = document.querySelector("#login-form");
const loginInstructions = document.querySelector("#login-instructions");
const nameField = document.querySelector("#name-field");
const fullNameInput = document.querySelector("#full-name");
const activationField = document.querySelector("#activation-field");
const activationCodeInput = document.querySelector("#activation-code");
const pinField = document.querySelector("#pin-field");
const pinInput = document.querySelector("#pin");
const continueButton = document.querySelector("#continue-button");
const loginBackButton = document.querySelector("#login-back-button");
const loginMessage = document.querySelector("#login-message");
const pinSetupForm = document.querySelector("#pin-setup-form");
const pinSetupName = document.querySelector("#pin-setup-name");
const pinSetupMessage = document.querySelector("#pin-setup-message");
const signOutButton = document.querySelector("#sign-out-button");
const accountName = document.querySelector("#account-name");
const accountRole = document.querySelector("#account-role");
const founderOnlyElements = document.querySelectorAll(".founder-only");
const navItems = document.querySelectorAll(".nav-item[data-view]");
const viewTitle = document.querySelector("#view-title");
const overviewView = document.querySelector("#view-overview");
const placeholderView = document.querySelector("#view-placeholder");
const placeholderTitle = document.querySelector("#placeholder-title");
const placeholderCopy = document.querySelector("#placeholder-copy");
const founderView = document.querySelector("#view-founder");
const accountStatusMetric = document.querySelector("#account-status-metric");
const accountNumberMetric = document.querySelector("#account-number-metric");
const profileName = document.querySelector("#profile-name");
const profileBoardRole = document.querySelector("#profile-board-role");
const profileOfficerRole = document.querySelector("#profile-officer-role");
const profileVotingStatus = document.querySelector("#profile-voting-status");
const createDirectorForm = document.querySelector("#create-director-form");
const createDirectorMessage = document.querySelector("#create-director-message");
const permissionTemplateSelect = document.querySelector("#director-permission-template");
const activationResult = document.querySelector("#activation-result");
const activationResultName = document.querySelector("#activation-result-name");
const activationResultCode = document.querySelector("#activation-result-code");
const activationResultNumber = document.querySelector("#activation-result-number");
const copyActivationButton = document.querySelector("#copy-activation-button");
const refreshDirectorsButton = document.querySelector("#refresh-directors-button");
const directorCount = document.querySelector("#director-count");
const directorTableBody = document.querySelector("#director-table-body");
const manageDirectorPanel = document.querySelector("#manage-director-panel");
const manageDirectorForm = document.querySelector("#manage-director-form");
const manageDirectorName = document.querySelector("#manage-director-name");
const manageDirectorNumber = document.querySelector("#manage-director-number");
const manageDirectorUid = document.querySelector("#manage-director-uid");
const manageBoardRole = document.querySelector("#manage-board-role");
const manageOfficerRole = document.querySelector("#manage-officer-role");
const manageAccountStatus = document.querySelector("#manage-account-status");
const manageVotingStatus = document.querySelector("#manage-voting-status");
const managePermissionTemplate = document.querySelector("#manage-permission-template");
const applyPermissionTemplateButton = document.querySelector("#apply-permission-template");
const permissionCheckboxes = document.querySelector("#permission-checkboxes");
const manageDirectorMessage = document.querySelector("#manage-director-message");
const closeManageDirectorButton = document.querySelector("#close-manage-director");
const cancelManageDirectorButton = document.querySelector("#cancel-manage-director");

const moduleCopy = Object.freeze({
  meetings: ["Meetings", "Live meeting activation, director check-in, attendance, and quorum are intentionally held for Phase 5."],
  documents: ["Board Documents", "Google Docs, Drive, Sheets, and Slides link submissions are intentionally held for Phase 4. No file uploads will be added."],
  resolutions: ["Resolutions", "The permanent resolution registry and live Board actions are introduced with the meeting and voting phases."],
  directors: ["Directors", "The full Board directory and director profiles arrive in Phase 3. Account provisioning is already available to the Founder Director in Founder Control."]
});

let loginStep = "name";
let pendingLogin = null;
let currentProfile = null;
let currentLoginRecord = null;
let founderAccounts = [];
let profileUnsubscribe = null;

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
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

function syncLoginButtonLabel() {
  if (loginStep === "activation") continueButton.textContent = "Verify activation code";
  else if (loginStep === "pin") continueButton.textContent = "Sign in";
  else continueButton.textContent = "Continue";
}

function authErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The name and credential provided were not accepted.";
    case "auth/too-many-requests":
      return "Sign-in has been temporarily limited after repeated attempts. Try again later or contact the Founder Director.";
    case "auth/network-request-failed":
      return "The portal could not reach Firebase. Check your connection and try again.";
    default:
      return error?.message || "The portal could not complete that request.";
  }
}

function resetLoginFlow({ keepName = false } = {}) {
  loginStep = "name";
  pendingLogin = null;
  currentLoginRecord = null;
  nameField.hidden = false;
  activationField.hidden = true;
  pinField.hidden = true;
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
  pinSetupMessage.textContent = "";
  currentProfile = profile;
  currentLoginRecord = loginRecord;
}

function applyProfileToUI(profile) {
  currentProfile = profile;
  const founder = isFounder(profile);
  accountName.textContent = profile.displayName || profile.fullName || "Board Portal";
  accountRole.textContent = profile.displayRole || profile.officerRole || profile.boardRole || "Director";
  founderOnlyElements.forEach((element) => {
    element.hidden = !founder;
  });
  accountStatusMetric.textContent = profile.accountStatus === "active" ? "Active" : profile.accountStatus || "Unknown";
  accountNumberMetric.textContent = profile.directorNumber ? `${profile.directorNumber} · Board identity verified.` : "Board identity verified.";
  profileName.textContent = profile.fullName || "—";
  profileBoardRole.textContent = profile.boardRole || "Director";
  profileOfficerRole.textContent = profile.officerRole || "None";
  profileVotingStatus.textContent = profile.votingStatus === "ineligible" ? "Ineligible" : "Eligible";
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
      loginInstructions.textContent = `Activate the Board account for ${fullName}.`;
      activationCodeInput.focus();
    } else {
      loginStep = "pin";
      activationField.hidden = true;
      pinField.hidden = false;
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
  const code = activationCodeInput.value;
  if (!pendingLogin?.authEmail) {
    resetLoginFlow({ keepName: true });
    return;
  }

  setBusy(continueButton, true, "Verifying…");
  loginMessage.textContent = "";
  try {
    const password = buildActivationPassword(code);
    await signInWithEmailAndPassword(auth, pendingLogin.authEmail, password);
  } catch (error) {
    console.error("Activation sign-in failed", error);
    loginMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function signInWithPin() {
  const pin = pinInput.value;
  if (!pendingLogin?.authEmail) {
    resetLoginFlow({ keepName: true });
    return;
  }

  if (!validatePin(pin)) {
    loginMessage.textContent = "Enter your four-digit PIN.";
    return;
  }

  setBusy(continueButton, true, "Signing in…");
  loginMessage.textContent = "";
  try {
    const password = buildPinPassword(pin, pendingLogin.authEmail);
    await signInWithEmailAndPassword(auth, pendingLogin.authEmail, password);
  } catch (error) {
    console.error("PIN sign-in failed", error);
    loginMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function completePinSetup(event) {
  event.preventDefault();
  const formData = new FormData(pinSetupForm);
  const pin = String(formData.get("newPin") ?? "");
  const confirmPin = String(formData.get("confirmPin") ?? "");
  const saveButton = document.querySelector("#save-pin-button");

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

    const directorRef = doc(db, "directors", auth.currentUser.uid);
    const loginRef = doc(db, "loginDirectory", currentProfile.loginKey);
    const batch = writeBatch(db);
    batch.update(directorRef, {
      accountStatus: "active",
      activationCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    batch.update(loginRef, {
      activationRequired: false,
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await batch.commit();

    pinSetupForm.reset();
    currentProfile = await loadDirectorProfile(auth.currentUser.uid);
    currentLoginRecord = { ...loginRecord, activationRequired: false };
    showSignedIn(currentProfile);
  } catch (error) {
    console.error("Unable to complete PIN activation", error);
    pinSetupMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(saveButton, false);
  }
}

function switchPortalView(view) {
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  overviewView.hidden = view !== "overview";
  founderView.hidden = view !== "founder";
  placeholderView.hidden = view === "overview" || view === "founder";

  if (view === "overview") {
    viewTitle.textContent = "Governance Overview";
    return;
  }

  if (view === "founder") {
    if (!isFounder(currentProfile)) {
      switchPortalView("overview");
      return;
    }
    viewTitle.textContent = "Founder Director Control";
    loadFounderAccounts().catch(console.error);
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

function permissionLabel(permission) {
  return permission
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
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
  return Array.from(permissionCheckboxes.querySelectorAll('input[name="permission"]:checked'))
    .map((input) => input.value);
}

function makeCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function renderDirectorAccounts(accounts) {
  founderAccounts = accounts;
  directorTableBody.replaceChildren();
  directorCount.textContent = String(accounts.length);

  if (!accounts.length) {
    const row = document.createElement("tr");
    const cell = makeCell("No director accounts have been created.", "empty-cell");
    cell.colSpan = 5;
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
      makeCell(String(director.accountStatus || "unknown").replaceAll("_", " "), "status-cell"),
      makeCell(director.root === true ? "Founder Root" : (PERMISSION_TEMPLATES[director.permissionTemplate]?.label || "Custom")),
      manageCell
    );
    directorTableBody.append(row);
  });
}

async function loadFounderAccounts() {
  if (!isFounder(currentProfile)) return;
  directorTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Loading accounts…</td></tr>';
  try {
    const accounts = await listDirectorAccounts(currentProfile);
    renderDirectorAccounts(accounts);
  } catch (error) {
    console.error("Unable to load director accounts", error);
    directorTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Unable to load Board accounts.</td></tr>';
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
  manageAccountStatus.value = director.accountStatus || "active";
  manageVotingStatus.value = director.votingStatus === "ineligible" ? "ineligible" : "eligible";
  managePermissionTemplate.value = PERMISSION_TEMPLATES[director.permissionTemplate] ? director.permissionTemplate : "standard_director";
  setPermissionSelection(director.permissions || []);
  manageDirectorMessage.textContent = "";
  manageDirectorPanel.hidden = false;
  manageDirectorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeManageDirector() {
  manageDirectorPanel.hidden = true;
  manageDirectorForm.reset();
  manageDirectorMessage.textContent = "";
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
      accountStatus: manageAccountStatus.value,
      votingStatus: manageVotingStatus.value,
      permissions: getPermissionSelection()
    }, currentProfile);
    manageDirectorMessage.textContent = "Director access updated.";
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
      votingStatus: formData.get("votingStatus"),
      permissionTemplate: formData.get("permissionTemplate")
    }, currentProfile);

    activationResultName.textContent = result.fullName;
    activationResultCode.textContent = result.activationCode;
    activationResultNumber.textContent = result.directorNumber;
    activationResult.hidden = false;
    createDirectorMessage.textContent = "Board account created successfully.";
    createDirectorForm.reset();
    document.querySelector("#director-board-role").value = "Director";
    populateTemplateSelect(permissionTemplateSelect);
    await loadFounderAccounts();
  } catch (error) {
    console.error("Unable to create director account", error);
    createDirectorMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(submitButton, false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginStep === "name") await lookupName();
  else if (loginStep === "activation") await activateWithCode();
  else if (loginStep === "pin") await signInWithPin();
});

loginBackButton.addEventListener("click", () => resetLoginFlow({ keepName: true }));
pinSetupForm.addEventListener("submit", completePinSetup);
signOutButton.addEventListener("click", async () => signOut(auth));
createDirectorForm.addEventListener("submit", handleCreateDirector);
manageDirectorForm.addEventListener("submit", handleManageDirector);
refreshDirectorsButton.addEventListener("click", () => loadFounderAccounts());
closeManageDirectorButton.addEventListener("click", closeManageDirector);
cancelManageDirectorButton.addEventListener("click", closeManageDirector);
applyPermissionTemplateButton.addEventListener("click", () => {
  setPermissionSelection(permissionsForTemplate(managePermissionTemplate.value));
});
directorTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-manage-uid]");
  if (button) openManageDirector(button.dataset.manageUid);
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

navItems.forEach((item) => {
  item.addEventListener("click", () => switchPortalView(item.dataset.view));
});

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
    closeManageDirector();
    loginForm.hidden = false;
    pinSetupForm.hidden = true;
    showSignedOut();
    return;
  }

  try {
    const profile = await loadDirectorProfile(user.uid);
    if (!profile) {
      await signOut(auth);
      resetLoginFlow();
      loginMessage.textContent = "This Firebase identity is not authorized for the Board Portal.";
      return;
    }

    if (profile.accountStatus === "awaiting_activation") {
      const loginRecord = await loadLoginRecord(profile.loginKey);
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
