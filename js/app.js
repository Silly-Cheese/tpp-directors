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
  listAllBoardNotices,
  listBoardDirectory,
  listBoardNotices,
  publishBoardNotice,
  summarizeBoardDirectory
} from "./board-data.js";
import {
  canReviewDocuments,
  documentStatusLabel,
  listBoardDocuments,
  listDocumentEvents,
  reviewBoardDocument,
  reviseBoardDocument,
  submitBoardDocument,
  summarizeDocuments
} from "./document-data.js";
import {
  hasPermission,
  PERMISSIONS,
  PERMISSION_TEMPLATES,
  permissionsForTemplate
} from "./permissions.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
const viewTitle = $("#view-title");
const navItems = $$(".nav-item[data-view]");
const founderOnlyElements = $$(".founder-only");
const directorsNav = $('.nav-item[data-view="directors"]');
const documentsNav = $('.nav-item[data-view="documents"]');

const views = {
  overview: $("#view-overview"),
  documents: $("#view-documents"),
  directors: $("#view-directors"),
  founder: $("#view-founder"),
  placeholder: $("#view-placeholder")
};
const placeholderTitle = $("#placeholder-title");
const placeholderCopy = $("#placeholder-copy");

const boardTotalMetric = $("#board-total-metric");
const boardConfirmedMetric = $("#board-confirmed-metric");
const documentInboxMetric = $("#document-inbox-metric");
const documentInboxCaption = $("#document-inbox-caption");
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
const dashboardDocumentList = $("#dashboard-document-list");
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

const refreshDocumentsButton = $("#refresh-documents-button");
const openSubmitDocumentButton = $("#open-submit-document");
const submitDocumentPanel = $("#submit-document-panel");
const closeSubmitDocumentButton = $("#close-submit-document");
const submitDocumentForm = $("#submit-document-form");
const submitDocumentMessage = $("#submit-document-message");
const documentAccessScope = $("#document-access-scope");
const documentRestrictedField = $("#document-restricted-field");
const documentRestrictedDirectors = $("#document-restricted-directors");
const documentSearch = $("#document-search");
const documentStatusFilter = $("#document-status-filter");
const documentCategoryFilter = $("#document-category-filter");
const documentList = $("#document-list");
const documentsAccessible = $("#documents-accessible");
const documentsMine = $("#documents-mine");
const documentsInbox = $("#documents-inbox");
const documentsAgenda = $("#documents-agenda");
const documentInboxPanel = $("#document-inbox-panel");
const documentInboxBadge = $("#document-inbox-badge");
const documentInboxList = $("#document-inbox-list");
const documentDetailPanel = $("#document-detail-panel");
const documentDetailTitle = $("#document-detail-title");
const documentDetailNumber = $("#document-detail-number");
const documentDetailLink = $("#document-detail-link");
const documentDetailStatus = $("#document-detail-status");
const documentDetailCategory = $("#document-detail-category");
const documentDetailLinkType = $("#document-detail-link-type");
const documentDetailSubmitter = $("#document-detail-submitter");
const documentDetailAccess = $("#document-detail-access");
const documentDetailRevision = $("#document-detail-revision");
const documentDetailDescription = $("#document-detail-description");
const documentDetailRequested = $("#document-detail-requested");
const documentReviewNoteBox = $("#document-review-note-box");
const documentDetailReviewNote = $("#document-detail-review-note");
const documentReviewControls = $("#document-review-controls");
const documentReviewNote = $("#document-review-note");
const documentReviewMessage = $("#document-review-message");
const documentReviseForm = $("#document-revise-form");
const documentReviseMessage = $("#document-revise-message");
const reviseDocumentTitle = $("#revise-document-title");
const reviseDocumentUrl = $("#revise-document-url");
const reviseDocumentDescription = $("#revise-document-description");
const reviseDocumentRequested = $("#revise-document-requested");
const documentHistoryList = $("#document-history-list");
const closeDocumentDetail = $("#close-document-detail");

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
  meetings: ["Meetings", "Live meeting activation, director check-in, attendance, and quorum arrive in Phase 5."],
  resolutions: ["Resolutions", "Live motions, pushed voting, and the permanent resolution registry arrive in Phase 6."]
});

let loginStep = "name";
let pendingLogin = null;
let currentProfile = null;
let currentLoginRecord = null;
let activationRecoveryRequested = false;
let profileUnsubscribe = null;
let founderAccounts = [];
let directoryEntries = [];
let boardNotices = [];
let boardDocuments = [];
let selectedDocumentId = null;

function isFounder(profile) {
  return profile?.root === true && profile?.systemRole === "founder_director";
}

function humanize(value = "") {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name = "") {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TPP";
}

function formatDate(value) {
  if (!value) return "—";
  if (typeof value.toDate === "function") return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(value.toDate());
  if (typeof value.seconds === "number") return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.seconds * 1000));
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatTerm(start, end) {
  if (!start && !end) return "Not set";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `Begins ${formatDate(start)}` : `Through ${formatDate(end)}`;
}

function permissionLabel(permission) {
  return String(permission).split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
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
    case "auth/user-not-found": return "The name and credential provided were not accepted.";
    case "auth/too-many-requests": return "Sign-in has been temporarily limited after repeated attempts. Try again later or contact the Founder Director.";
    case "auth/requires-recent-login": return "For security, sign out and sign back in with your current PIN before changing it.";
    case "auth/network-request-failed": return "The portal could not reach Firebase. Check your connection and try again.";
    default: return error?.message || "The portal could not complete that request.";
  }
}

function syncLoginButtonLabel() {
  continueButton.textContent = loginStep === "activation" ? "Verify activation code" : (["pin", "recovery-pin"].includes(loginStep) ? "Sign in" : "Continue");
}

function resetLoginFlow({ keepName = false } = {}) {
  loginStep = "name";
  pendingLogin = null;
  currentLoginRecord = null;
  activationRecoveryRequested = false;
  nameField.hidden = false;
  activationField.hidden = true;
  pinField.hidden = true;
  activationRecoveryButton.hidden = true;
  loginBackButton.hidden = true;
  loginInstructions.textContent = "Enter your full name to continue.";
  loginMessage.textContent = "";
  activationCodeInput.value = "";
  pinInput.value = "";
  if (!keepName) fullNameInput.value = "";
  syncLoginButtonLabel();
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
  pinSetupMessage.textContent = profile.accountStatus === "pin_reset_required" ? "Choose a new four-digit PIN to complete account recovery." : "";
  currentProfile = profile;
  currentLoginRecord = loginRecord;
}

function renderPermissionChips(profile) {
  profilePermissions.replaceChildren();
  const values = isFounder(profile) ? ["Founder Root · All Portal Capabilities"] : (profile.permissions || []).map(permissionLabel);
  if (!values.length) {
    profilePermissions.innerHTML = '<span class="muted-copy">No portal capabilities are currently assigned.</span>';
    return;
  }
  values.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "permission-chip";
    chip.textContent = value;
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
  documentsNav.hidden = ![PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.DOCUMENTS_SUBMIT, PERMISSIONS.DOCUMENTS_REVIEW].some((permission) => hasPermission(profile, permission));
  openSubmitDocumentButton.hidden = !hasPermission(profile, PERMISSIONS.DOCUMENTS_SUBMIT);

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
    if (!snapshot.exists()) return signOut(auth).catch(console.error);
    const profile = { uid: snapshot.id, ...snapshot.data() };
    if (profile.accountStatus !== "active") return signOut(auth).catch(console.error);
    applyProfileToUI(profile);
  }, (error) => {
    console.warn("Director profile listener closed", error);
    if (auth.currentUser?.uid === uid) signOut(auth).catch(console.error);
  });
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
  if (!fullName) return void (loginMessage.textContent = "Enter your full name to continue.");
  setBusy(continueButton, true, "Checking…");
  loginMessage.textContent = "";
  try {
    const loginKey = await buildLoginKey(fullName);
    const record = await loadLoginRecord(loginKey);
    if (!record?.authEmail) throw new Error("The portal could not continue with that Board identity.");
    if (record.disabled === true) throw new Error("This Board account has been retired. Contact the Founder Director if a replacement account is needed.");
    pendingLogin = { fullName, loginKey, ...record };
    nameField.hidden = true;
    loginBackButton.hidden = false;
    if (record.activationRequired === true) {
      loginStep = "activation";
      activationField.hidden = false;
      pinField.hidden = true;
      activationRecoveryButton.hidden = false;
      loginInstructions.textContent = `Activate the Board account for ${fullName}.`;
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
    console.error(error);
    loginMessage.textContent = error.message || "The portal could not check that Board identity.";
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function activateWithCode() {
  if (!pendingLogin?.authEmail) return resetLoginFlow({ keepName: true });
  setBusy(continueButton, true, "Verifying…");
  try {
    await signInWithEmailAndPassword(auth, pendingLogin.authEmail, buildActivationPassword(activationCodeInput.value));
  } catch (error) {
    loginMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function signInWithPin() {
  if (!pendingLogin?.authEmail) return resetLoginFlow({ keepName: true });
  if (!validatePin(pinInput.value)) return void (loginMessage.textContent = "Enter your four-digit PIN.");
  setBusy(continueButton, true, "Signing in…");
  try {
    await signInWithEmailAndPassword(auth, pendingLogin.authEmail, buildPinPassword(pinInput.value, pendingLogin.authEmail));
  } catch (error) {
    loginMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(continueButton, false);
    syncLoginButtonLabel();
  }
}

async function completePinSetup(event) {
  event.preventDefault();
  const data = new FormData(pinSetupForm);
  const pin = String(data.get("newPin") || "");
  const confirmPin = String(data.get("confirmPin") || "");
  const button = $("#save-pin-button");
  if (!validatePin(pin)) return void (pinSetupMessage.textContent = "Choose exactly four digits for your PIN.");
  if (pin !== confirmPin) return void (pinSetupMessage.textContent = "The two PIN entries do not match.");
  if (!auth.currentUser || !currentProfile?.loginKey) return void (pinSetupMessage.textContent = "Your activation session is no longer available.");

  setBusy(button, true, "Activating…");
  try {
    const loginRecord = currentLoginRecord || await loadLoginRecord(currentProfile.loginKey);
    if (!loginRecord?.authEmail) throw new Error("The account login record is unavailable.");
    await updatePassword(auth.currentUser, buildPinPassword(pin, loginRecord.authEmail));
    await finalizeActivationRecord(currentProfile, loginRecord);
    pinSetupForm.reset();
    currentProfile = await loadDirectorProfile(auth.currentUser.uid);
    showSignedIn(currentProfile);
  } catch (error) {
    pinSetupMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(button, false);
  }
}

async function changeOwnPin(event) {
  event.preventDefault();
  const data = new FormData(changePinForm);
  const pin = String(data.get("newPin") || "");
  const confirmPin = String(data.get("confirmPin") || "");
  const button = changePinForm.querySelector('button[type="submit"]');
  if (!validatePin(pin)) return void (changePinMessage.textContent = "Choose exactly four digits.");
  if (pin !== confirmPin) return void (changePinMessage.textContent = "The PIN entries do not match.");
  setBusy(button, true, "Changing…");
  try {
    const login = await loadLoginRecord(currentProfile.loginKey);
    if (!login?.authEmail) throw new Error("The account login record is unavailable.");
    await updatePassword(auth.currentUser, buildPinPassword(pin, login.authEmail));
    changePinForm.reset();
    changePinMessage.textContent = "PIN changed successfully.";
  } catch (error) {
    changePinMessage.textContent = authErrorMessage(error);
  } finally {
    setBusy(button, false);
  }
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
  if (isFounder(profile)) loadFounderWorkspace().catch(console.error);
}

function hideAllViews() {
  Object.values(views).forEach((view) => { if (view) view.hidden = true; });
}

function switchPortalView(view) {
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  hideAllViews();

  if (view === "overview") {
    views.overview.hidden = false;
    viewTitle.textContent = "Governance Overview";
    return;
  }
  if (view === "documents") {
    views.documents.hidden = false;
    viewTitle.textContent = "Board Documents";
    loadDocuments().catch(console.error);
    return;
  }
  if (view === "directors") {
    if (!hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW)) return switchPortalView("overview");
    views.directors.hidden = false;
    viewTitle.textContent = "Board Directory";
    loadDirectory().catch(console.error);
    return;
  }
  if (view === "founder") {
    if (!isFounder(currentProfile)) return switchPortalView("overview");
    views.founder.hidden = false;
    viewTitle.textContent = "Founder Director Control";
    loadFounderWorkspace().catch(console.error);
    return;
  }

  views.placeholder.hidden = false;
  const [title, copy] = moduleCopy[view] || ["Board Module", "This module is not available yet."];
  viewTitle.textContent = title;
  placeholderTitle.textContent = title;
  placeholderCopy.textContent = copy;
}

async function refreshBoardWorkspace() {
  const tasks = [listBoardNotices().catch(() => []), listBoardDocuments(currentProfile).catch(() => [])];
  if (hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW)) tasks.push(listBoardDirectory(currentProfile).catch(() => []));
  const [notices, documents, directory = []] = await Promise.all(tasks);
  boardNotices = notices;
  boardDocuments = documents;
  directoryEntries = directory;
  renderDashboard();
  renderRestrictedDirectorChoices();
}

function renderDashboard() {
  const boardSummary = summarizeBoardDirectory(directoryEntries);
  boardTotalMetric.textContent = hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW) ? boardSummary.total : "—";
  boardConfirmedMetric.textContent = hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW) ? boardSummary.confirmed : "—";

  const documentSummary = summarizeDocuments(boardDocuments, currentProfile);
  documentInboxMetric.textContent = canReviewDocuments(currentProfile) ? documentSummary.inbox : documentSummary.mine;
  documentInboxCaption.textContent = canReviewDocuments(currentProfile) ? "Documents awaiting Board review." : "Your active document submissions.";

  dashboardNotices.replaceChildren();
  if (!boardNotices.length) dashboardNotices.innerHTML = '<div class="empty-state">No active Board notices.</div>';
  boardNotices.slice(0, 4).forEach((notice) => {
    const item = document.createElement("article");
    item.className = `notice-item priority-${notice.priority || "normal"}`;
    item.innerHTML = `<div><strong></strong><span></span></div><small></small>`;
    item.querySelector("strong").textContent = notice.title;
    item.querySelector("span").textContent = notice.body;
    item.querySelector("small").textContent = humanize(notice.priority || "normal");
    dashboardNotices.append(item);
  });

  dashboardDocumentList.replaceChildren();
  const recent = boardDocuments.filter((entry) => entry.status !== "archived").slice(0, 5);
  if (!recent.length) dashboardDocumentList.innerHTML = '<div class="empty-state">No accessible Board documents yet.</div>';
  recent.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compact-row";
    button.dataset.dashboardDocumentId = entry.id;
    button.innerHTML = '<span><strong></strong><small></small></span><em></em>';
    button.querySelector("strong").textContent = entry.title;
    button.querySelector("small").textContent = entry.documentNumber || "Board document";
    button.querySelector("em").textContent = documentStatusLabel(entry.status);
    dashboardDocumentList.append(button);
  });
}

async function loadDirectory() {
  if (!hasPermission(currentProfile, PERMISSIONS.DIRECTORS_VIEW)) return;
  directoryGrid.innerHTML = '<div class="empty-state">Loading Board directory…</div>';
  directoryEntries = await listBoardDirectory(currentProfile);
  const summary = summarizeBoardDirectory(directoryEntries);
  directoryTotal.textContent = summary.total;
  directoryConfirmed.textContent = summary.confirmed;
  directoryInterim.textContent = summary.interim;
  directoryVoting.textContent = summary.votingEligible;
  renderDirectory();
  renderRestrictedDirectorChoices();
}

function renderDirectory() {
  const search = directorySearch.value.trim().toLowerCase();
  const status = directoryStatusFilter.value;
  const currentStatuses = new Set(["interim", "confirmed", "leave_of_absence"]);
  const entries = directoryEntries.filter((entry) => {
    const boardStatus = entry.boardStatus || "interim";
    if (status === "current" && !currentStatuses.has(boardStatus)) return false;
    if (!["current", "all"].includes(status) && boardStatus !== status) return false;
    if (!search) return true;
    return [entry.fullName, entry.displayName, entry.boardRole, entry.officerRole, entry.directorNumber].some((value) => String(value || "").toLowerCase().includes(search));
  });

  directoryGrid.replaceChildren();
  if (!entries.length) return void (directoryGrid.innerHTML = '<div class="empty-state">No directors match the current filters.</div>');
  entries.forEach((entry) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "director-card";
    card.dataset.directoryUid = entry.uid;
    card.innerHTML = '<div class="director-avatar"></div><div class="director-card-copy"><strong></strong><span></span><small></small></div><div class="status-pill"></div>';
    card.querySelector(".director-avatar").textContent = initials(entry.displayName || entry.fullName);
    card.querySelector("strong").textContent = entry.displayName || entry.fullName;
    card.querySelector("span").textContent = entry.officerRole || entry.boardRole || "Director";
    card.querySelector("small").textContent = `${entry.directorNumber || "Director"}${entry.directoryVisible === false ? " · Hidden" : ""}`;
    card.querySelector(".status-pill").textContent = humanize(entry.boardStatus || "interim");
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
  directoryProfilePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRestrictedDirectorChoices() {
  documentRestrictedDirectors.replaceChildren();
  const eligible = directoryEntries.filter((entry) => entry.boardStatus !== "former" && entry.uid !== auth.currentUser?.uid && entry.directoryVisible !== false);
  if (!eligible.length) {
    documentRestrictedDirectors.innerHTML = '<span class="muted-copy">No other visible directors are available for selection.</span>';
    return;
  }
  eligible.forEach((entry) => {
    const label = document.createElement("label");
    label.className = "permission-option";
    label.innerHTML = '<input type="checkbox" name="restrictedDirector"><span></span>';
    label.querySelector("input").value = entry.uid;
    label.querySelector("span").textContent = `${entry.displayName || entry.fullName} · ${entry.directorNumber || "Director"}`;
    documentRestrictedDirectors.append(label);
  });
}

async function loadDocuments() {
  if (!currentProfile) return;
  documentList.innerHTML = '<div class="empty-state">Loading Board documents…</div>';
  boardDocuments = await listBoardDocuments(currentProfile);
  renderDocuments();
  renderDashboard();
}

function documentAccessLabel(entry) {
  if (entry.accessScope === "officers") return "Board Officers";
  if (entry.accessScope === "restricted") return "Selected Directors";
  if (entry.accessScope === "founder") return "Founder Director Only";
  return "Board of Directors";
}

function renderDocuments() {
  const summary = summarizeDocuments(boardDocuments, currentProfile);
  documentsAccessible.textContent = summary.accessible;
  documentsMine.textContent = summary.mine;
  documentsInbox.textContent = summary.inbox;
  documentsAgenda.textContent = summary.agendaReady;

  const reviewer = canReviewDocuments(currentProfile);
  documentInboxPanel.hidden = !reviewer;
  if (reviewer) {
    const queue = boardDocuments.filter((entry) => ["submitted", "under_review"].includes(entry.status));
    documentInboxBadge.textContent = queue.length;
    documentInboxList.replaceChildren();
    if (!queue.length) documentInboxList.innerHTML = '<div class="empty-state">The Board Inbox is clear.</div>';
    queue.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inbox-row";
      button.dataset.documentId = entry.id;
      button.innerHTML = '<div><strong></strong><span></span></div><small></small>';
      button.querySelector("strong").textContent = entry.title;
      button.querySelector("span").textContent = `${entry.submittedByName || "Director"} · ${entry.documentNumber || "Board document"}`;
      button.querySelector("small").textContent = documentStatusLabel(entry.status);
      documentInboxList.append(button);
    });
  }

  const search = documentSearch.value.trim().toLowerCase();
  const status = documentStatusFilter.value;
  const category = documentCategoryFilter.value;
  const entries = boardDocuments.filter((entry) => {
    if (status === "active" && entry.status === "archived") return false;
    if (!["active", "all"].includes(status) && entry.status !== status) return false;
    if (category !== "all" && entry.category !== category) return false;
    if (!search) return true;
    return [entry.title, entry.documentNumber, entry.submittedByName, entry.category, entry.description].some((value) => String(value || "").toLowerCase().includes(search));
  });

  documentList.replaceChildren();
  if (!entries.length) return void (documentList.innerHTML = '<div class="empty-state">No Board documents match the current filters.</div>');
  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "document-card";
    card.innerHTML = '<div class="document-card-top"><div><span class="document-number"></span><h3></h3></div><span class="status-pill"></span></div><p></p><div class="document-meta"><span></span><span></span><span></span></div><button class="table-action" type="button">View record</button>';
    card.querySelector(".document-number").textContent = entry.documentNumber || "Board document";
    card.querySelector("h3").textContent = entry.title;
    card.querySelector(".status-pill").textContent = documentStatusLabel(entry.status);
    card.querySelector("p").textContent = entry.description || "No description provided.";
    const meta = card.querySelectorAll(".document-meta span");
    meta[0].textContent = humanize(entry.category);
    meta[1].textContent = entry.linkType || "Google Document";
    meta[2].textContent = documentAccessLabel(entry);
    const button = card.querySelector("button");
    button.dataset.documentId = entry.id;
    documentList.append(card);
  });
}

async function openDocumentDetail(documentId) {
  const entry = boardDocuments.find((item) => item.id === documentId);
  if (!entry) return;
  selectedDocumentId = documentId;
  documentDetailTitle.textContent = entry.title;
  documentDetailNumber.textContent = entry.documentNumber || "Board document";
  documentDetailLink.href = entry.documentUrl;
  documentDetailStatus.textContent = documentStatusLabel(entry.status);
  documentDetailCategory.textContent = humanize(entry.category);
  documentDetailLinkType.textContent = entry.linkType || "Google Document";
  documentDetailSubmitter.textContent = entry.submittedByName || "Director";
  documentDetailAccess.textContent = documentAccessLabel(entry);
  documentDetailRevision.textContent = `Revision ${entry.revisionNumber || 1}`;
  documentDetailDescription.textContent = entry.description || "—";
  documentDetailRequested.textContent = entry.requestedAction || "No specific action requested.";
  documentReviewNoteBox.hidden = !entry.reviewNote;
  documentDetailReviewNote.textContent = entry.reviewNote || "";
  documentReviewControls.hidden = !canReviewDocuments(currentProfile) || entry.status === "archived";
  documentReviewNote.value = "";
  documentReviewMessage.textContent = "";

  const revisable = entry.submittedBy === auth.currentUser?.uid && ["submitted", "returned_for_revision"].includes(entry.status);
  documentReviseForm.hidden = !revisable;
  if (revisable) {
    reviseDocumentTitle.value = entry.title || "";
    reviseDocumentUrl.value = entry.documentUrl || "";
    reviseDocumentDescription.value = entry.description || "";
    reviseDocumentRequested.value = entry.requestedAction || "";
    documentReviseMessage.textContent = "";
  }

  documentDetailPanel.hidden = false;
  documentHistoryList.innerHTML = '<div class="empty-state">Loading history…</div>';
  documentDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const events = await listDocumentEvents(documentId, currentProfile);
    renderDocumentHistory(events);
  } catch (error) {
    documentHistoryList.innerHTML = `<div class="empty-state">${error.message || "History unavailable."}</div>`;
  }
}

function renderDocumentHistory(events) {
  documentHistoryList.replaceChildren();
  if (!events.length) return void (documentHistoryList.innerHTML = '<div class="empty-state">No history events are recorded.</div>');
  events.forEach((event) => {
    const item = document.createElement("div");
    item.className = "timeline-item";
    item.innerHTML = '<span></span><div><strong></strong><small></small><p></p></div>';
    item.querySelector("strong").textContent = documentStatusLabel(event.type);
    item.querySelector("small").textContent = `${event.actorName || "Board user"} · ${formatDate(event.createdAt)}`;
    const note = item.querySelector("p");
    note.textContent = event.note || "";
    note.hidden = !event.note;
    documentHistoryList.append(item);
  });
}

async function handleSubmitDocument(event) {
  event.preventDefault();
  const button = submitDocumentForm.querySelector('button[type="submit"]');
  const data = new FormData(submitDocumentForm);
  setBusy(button, true, "Submitting…");
  submitDocumentMessage.textContent = "";
  try {
    await submitBoardDocument({
      title: data.get("title"),
      category: data.get("category"),
      documentUrl: data.get("documentUrl"),
      description: data.get("description"),
      requestedAction: data.get("requestedAction"),
      accessScope: data.get("accessScope"),
      allowedDirectorUids: $$('#document-restricted-directors input:checked').map((input) => input.value)
    }, currentProfile);
    submitDocumentForm.reset();
    documentRestrictedField.hidden = true;
    submitDocumentMessage.textContent = "Document submitted to the Board system.";
    await loadDocuments();
  } catch (error) {
    submitDocumentMessage.textContent = error.message || "Unable to submit the document.";
  } finally {
    setBusy(button, false);
  }
}

async function handleDocumentReview(action, button) {
  if (!selectedDocumentId) return;
  setBusy(button, true, "Saving…");
  documentReviewMessage.textContent = "";
  try {
    await reviewBoardDocument(selectedDocumentId, action, documentReviewNote.value, currentProfile);
    await loadDocuments();
    await openDocumentDetail(selectedDocumentId);
    documentReviewMessage.textContent = "Document status updated.";
  } catch (error) {
    documentReviewMessage.textContent = error.message || "Unable to update the document.";
  } finally {
    setBusy(button, false);
  }
}

async function handleDocumentRevision(event) {
  event.preventDefault();
  if (!selectedDocumentId) return;
  const button = documentReviseForm.querySelector('button[type="submit"]');
  setBusy(button, true, "Saving revision…");
  try {
    await reviseBoardDocument(selectedDocumentId, {
      title: reviseDocumentTitle.value,
      documentUrl: reviseDocumentUrl.value,
      description: reviseDocumentDescription.value,
      requestedAction: reviseDocumentRequested.value
    }, currentProfile);
    await loadDocuments();
    await openDocumentDetail(selectedDocumentId);
    documentReviseMessage.textContent = "Revision submitted.";
  } catch (error) {
    documentReviseMessage.textContent = error.message || "Unable to save the revision.";
  } finally {
    setBusy(button, false);
  }
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

function buildPermissionCheckboxes() {
  permissionCheckboxes.replaceChildren();
  Object.values(PERMISSIONS).forEach((permission) => {
    const label = document.createElement("label");
    label.className = "permission-option";
    label.innerHTML = '<input type="checkbox" name="permission"><span></span>';
    label.querySelector("input").value = permission;
    label.querySelector("span").textContent = permissionLabel(permission);
    permissionCheckboxes.append(label);
  });
}

function setPermissionSelection(permissions = []) {
  const selected = new Set(Array.isArray(permissions) ? permissions : []);
  $$('#permission-checkboxes input[name="permission"]').forEach((input) => { input.checked = selected.has(input.value); });
}

function getPermissionSelection() {
  return $$('#permission-checkboxes input[name="permission"]:checked').map((input) => input.value);
}

function renderFounderAccounts(accounts) {
  founderAccounts = accounts;
  directorCount.textContent = accounts.length;
  founderTotalCount.textContent = accounts.length;
  founderActiveCount.textContent = accounts.filter((entry) => entry.accountStatus === "active").length;
  founderAwaitingCount.textContent = accounts.filter((entry) => entry.accountStatus === "awaiting_activation").length;
  founderOtherCount.textContent = accounts.filter((entry) => !["active", "awaiting_activation"].includes(entry.accountStatus)).length;
  directorTableBody.replaceChildren();
  accounts.forEach((director) => {
    const row = document.createElement("tr");
    row.innerHTML = '<td><strong></strong><small></small></td><td></td><td class="status-cell"></td><td></td><td></td>';
    row.children[0].querySelector("strong").textContent = director.fullName || "Director";
    row.children[0].querySelector("small").textContent = director.directorNumber || director.uid;
    row.children[1].textContent = `${director.officerRole || director.boardRole || "Director"} · ${humanize(director.boardStatus || "interim")}`;
    row.children[2].textContent = humanize(director.accountStatus || "unknown");
    row.children[3].textContent = director.root ? "Founder Root" : (PERMISSION_TEMPLATES[director.permissionTemplate]?.label || "Custom");
    if (director.root) row.children[4].innerHTML = '<span class="protected-badge">Protected</span>';
    else {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "table-action";
      button.dataset.manageUid = director.uid;
      button.textContent = "Manage";
      row.children[4].append(button);
    }
    directorTableBody.append(row);
  });
}

async function loadFounderAccounts() {
  if (!isFounder(currentProfile)) return;
  directorTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Loading accounts…</td></tr>';
  const accounts = await listDirectorAccounts(currentProfile);
  renderFounderAccounts(accounts);
  const backfilled = await backfillBoardDirectory(currentProfile);
  if (backfilled) await refreshBoardWorkspace();
}

async function loadFounderNotices() {
  if (!isFounder(currentProfile)) return;
  const notices = await listAllBoardNotices(currentProfile);
  founderNoticeList.replaceChildren();
  if (!notices.length) return void (founderNoticeList.innerHTML = '<div class="empty-state">No Board notices have been published.</div>');
  notices.forEach((notice) => {
    const item = document.createElement("article");
    item.className = `notice-item priority-${notice.priority || "normal"}`;
    item.innerHTML = '<div><strong></strong><span></span></div><div class="button-row"><small></small><button class="table-action" type="button">Archive</button></div>';
    item.querySelector("strong").textContent = notice.title;
    item.querySelector("span").textContent = notice.body;
    item.querySelector("small").textContent = humanize(notice.status || "published");
    const button = item.querySelector("button");
    button.dataset.archiveNotice = notice.id;
    button.hidden = notice.status === "archived";
    founderNoticeList.append(item);
  });
}

async function loadFounderWorkspace() {
  if (!isFounder(currentProfile)) return;
  await Promise.all([loadFounderAccounts(), loadFounderNotices()]);
}

function openManageDirector(uid) {
  const director = founderAccounts.find((entry) => entry.uid === uid);
  if (!director || director.root) return;
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
  setPermissionSelection([]);
  pinRecoveryResult.hidden = true;
}

async function handleManageDirector(event) {
  event.preventDefault();
  const uid = manageDirectorUid.value;
  const button = manageDirectorForm.querySelector('button[type="submit"]');
  if (!uid) return;
  setBusy(button, true, "Saving…");
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
    manageDirectorMessage.textContent = "Director record updated.";
    await Promise.all([loadFounderAccounts(), refreshBoardWorkspace()]);
  } catch (error) {
    manageDirectorMessage.textContent = error.message || "Unable to update the director.";
  } finally {
    setBusy(button, false);
  }
}

async function handleCreateDirector(event) {
  event.preventDefault();
  const button = createDirectorForm.querySelector('button[type="submit"]');
  const data = new FormData(createDirectorForm);
  setBusy(button, true, "Creating…");
  try {
    const result = await createDirectorAccount({
      fullName: data.get("fullName"), boardRole: data.get("boardRole"), officerRole: data.get("officerRole"), boardStatus: data.get("boardStatus"), votingStatus: data.get("votingStatus"), termStart: data.get("termStart") || null, termEnd: data.get("termEnd") || null, permissionTemplate: data.get("permissionTemplate")
    }, currentProfile);
    activationResultName.textContent = result.fullName;
    activationResultCode.textContent = result.activationCode;
    activationResultNumber.textContent = result.directorNumber;
    activationResult.hidden = false;
    createDirectorMessage.textContent = "Board account created.";
    createDirectorForm.reset();
    $("#director-board-role").value = "Director";
    populateTemplateSelect(permissionTemplateSelect);
    await Promise.all([loadFounderAccounts(), refreshBoardWorkspace()]);
  } catch (error) {
    createDirectorMessage.textContent = error.message || "Unable to create the account.";
  } finally {
    setBusy(button, false);
  }
}

async function handlePreparePinReset() {
  const uid = manageDirectorUid.value;
  if (!uid) return;
  setBusy(preparePinResetButton, true, "Preparing…");
  try {
    const result = await prepareDirectorPinReset(uid, currentProfile);
    pinRecoveryName.textContent = `${result.fullName} · ${result.directorNumber}`;
    pinRecoveryAlias.textContent = result.authEmail;
    pinRecoveryPassword.textContent = result.temporaryAuthPassword;
    pinRecoveryCode.textContent = result.activationCode;
    pinRecoveryResult.hidden = false;
    await loadFounderAccounts();
  } catch (error) {
    manageDirectorMessage.textContent = error.message || "Unable to prepare PIN recovery.";
  } finally {
    setBusy(preparePinResetButton, false);
  }
}

async function handlePublishNotice(event) {
  event.preventDefault();
  const button = boardNoticeForm.querySelector('button[type="submit"]');
  const data = new FormData(boardNoticeForm);
  setBusy(button, true, "Publishing…");
  try {
    await publishBoardNotice({ title: data.get("title"), body: data.get("body"), priority: data.get("priority"), expiresOn: data.get("expiresOn") || null }, currentProfile);
    boardNoticeForm.reset();
    boardNoticeMessage.textContent = "Board notice published.";
    await Promise.all([loadFounderNotices(), refreshBoardWorkspace()]);
  } catch (error) {
    boardNoticeMessage.textContent = error.message || "Unable to publish the notice.";
  } finally {
    setBusy(button, false);
  }
}

// Authentication events
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  if (loginStep === "name") await lookupName();
  else if (loginStep === "activation") await activateWithCode();
  else await signInWithPin();
});
loginBackButton.addEventListener("click", () => resetLoginFlow({ keepName: true }));
activationRecoveryButton.addEventListener("click", () => {
  activationRecoveryRequested = true;
  loginStep = "recovery-pin";
  activationField.hidden = true;
  pinField.hidden = false;
  activationRecoveryButton.hidden = true;
  loginInstructions.textContent = `Enter the PIN you already created for ${pendingLogin?.fullName || "this account"}.`;
  syncLoginButtonLabel();
  pinInput.focus();
});
pinSetupForm.addEventListener("submit", completePinSetup);
changePinForm.addEventListener("submit", changeOwnPin);
signOutButton.addEventListener("click", () => signOut(auth));

// Navigation
navItems.forEach((item) => item.addEventListener("click", () => switchPortalView(item.dataset.view)));
$$('[data-open-view]').forEach((button) => button.addEventListener("click", () => switchPortalView(button.dataset.openView)));
dashboardDocumentList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-dashboard-document-id]");
  if (!button) return;
  switchPortalView("documents");
  await openDocumentDetail(button.dataset.dashboardDocumentId);
});

// Directory
refreshDirectoryButton.addEventListener("click", () => loadDirectory().catch(console.error));
directorySearch.addEventListener("input", renderDirectory);
directoryStatusFilter.addEventListener("change", renderDirectory);
directoryGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-directory-uid]");
  if (card) openDirectoryProfile(card.dataset.directoryUid);
});
closeDirectoryProfile.addEventListener("click", () => { directoryProfilePanel.hidden = true; });

// Documents
refreshDocumentsButton.addEventListener("click", () => loadDocuments().catch(console.error));
openSubmitDocumentButton.addEventListener("click", () => { submitDocumentPanel.hidden = false; submitDocumentPanel.scrollIntoView({ behavior: "smooth" }); });
closeSubmitDocumentButton.addEventListener("click", () => { submitDocumentPanel.hidden = true; });
documentAccessScope.addEventListener("change", () => { documentRestrictedField.hidden = documentAccessScope.value !== "restricted"; });
submitDocumentForm.addEventListener("submit", handleSubmitDocument);
documentSearch.addEventListener("input", renderDocuments);
documentStatusFilter.addEventListener("change", renderDocuments);
documentCategoryFilter.addEventListener("change", renderDocuments);
documentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-document-id]");
  if (button) openDocumentDetail(button.dataset.documentId).catch(console.error);
});
documentInboxList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-document-id]");
  if (button) openDocumentDetail(button.dataset.documentId).catch(console.error);
});
closeDocumentDetail.addEventListener("click", () => { documentDetailPanel.hidden = true; selectedDocumentId = null; });
documentReviewControls.addEventListener("click", (event) => {
  const button = event.target.closest("[data-document-action]");
  if (button) handleDocumentReview(button.dataset.documentAction, button).catch(console.error);
});
documentReviseForm.addEventListener("submit", handleDocumentRevision);

// Founder controls
populateTemplateSelect(permissionTemplateSelect);
populateTemplateSelect(managePermissionTemplate);
buildPermissionCheckboxes();
createDirectorForm.addEventListener("submit", handleCreateDirector);
manageDirectorForm.addEventListener("submit", handleManageDirector);
refreshDirectorsButton.addEventListener("click", () => loadFounderWorkspace().catch(console.error));
closeManageDirectorButton.addEventListener("click", closeManageDirector);
cancelManageDirectorButton.addEventListener("click", closeManageDirector);
preparePinResetButton.addEventListener("click", handlePreparePinReset);
applyPermissionTemplateButton.addEventListener("click", () => setPermissionSelection(permissionsForTemplate(managePermissionTemplate.value)));
directorTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-manage-uid]");
  if (button) openManageDirector(button.dataset.manageUid);
});
copyActivationButton.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(activationResultCode.textContent); copyActivationButton.textContent = "Copied"; setTimeout(() => { copyActivationButton.textContent = "Copy code"; }, 1200); }
  catch { createDirectorMessage.textContent = "Copying was blocked. Select the activation code manually."; }
});
boardNoticeForm.addEventListener("submit", handlePublishNotice);
refreshNoticesButton.addEventListener("click", () => loadFounderNotices().catch(console.error));
founderNoticeList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-archive-notice]");
  if (!button) return;
  setBusy(button, true, "Archiving…");
  try { await archiveBoardNotice(button.dataset.archiveNotice, currentProfile); await Promise.all([loadFounderNotices(), refreshBoardWorkspace()]); }
  catch (error) { boardNoticeMessage.textContent = error.message || "Unable to archive the notice."; }
  finally { setBusy(button, false); }
});

resetLoginFlow();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (profileUnsubscribe) { profileUnsubscribe(); profileUnsubscribe = null; }
    currentProfile = null;
    currentLoginRecord = null;
    founderAccounts = [];
    directoryEntries = [];
    boardNotices = [];
    boardDocuments = [];
    selectedDocumentId = null;
    closeManageDirector();
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

    if (profile.accountStatus === "awaiting_activation" && activationRecoveryRequested) {
      const loginRecord = await loadLoginRecord(profile.loginKey);
      await finalizeActivationRecord(profile, loginRecord);
      activationRecoveryRequested = false;
      profile = await loadDirectorProfile(user.uid);
    }

    if (["awaiting_activation", "pin_reset_required"].includes(profile.accountStatus)) {
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
