export const EXPECTED_PRODUCTION_HOST = "directors.ask4prayers.com";
export const EXPECTED_FIREBASE_PROJECT = "tpp-direc";

export const MANUAL_LAUNCH_ITEMS = Object.freeze([
  Object.freeze({ id: "pages", label: "GitHub Pages publishes the main branch repository root." }),
  Object.freeze({ id: "dns", label: "directors.ask4prayers.com resolves to the GitHub Pages site." }),
  Object.freeze({ id: "https", label: "Production HTTPS is working and enforced." }),
  Object.freeze({ id: "auth_provider", label: "Firebase Email/Password Authentication is enabled." }),
  Object.freeze({ id: "auth_domain", label: "directors.ask4prayers.com is an authorized Firebase Authentication domain." }),
  Object.freeze({ id: "rules_deployed", label: "The current firestore.rules compiled and deployed successfully to tpp-direc." }),
  Object.freeze({ id: "founder_bootstrap", label: "The protected Founder Director identity is bootstrapped and verified." }),
  Object.freeze({ id: "account_flow", label: "Director activation, PIN sign-in, PIN change, suspension, and recovery were tested." }),
  Object.freeze({ id: "qa_harnesses", label: "All Phase 2–10 browser QA harnesses pass over HTTP/HTTPS." }),
  Object.freeze({ id: "multi_device", label: "A multi-account, multi-device live Board meeting simulation passed." }),
  Object.freeze({ id: "negative_rules", label: "Unauthorized Firestore writes/reads were tested and rejected." }),
  Object.freeze({ id: "voting", label: "Quorum, recusals, pushed voting, closing recovery, and resolution creation were verified." }),
  Object.freeze({ id: "certification", label: "Minutes readiness, certification preflight, and permanent record sealing were verified." }),
  Object.freeze({ id: "phase8", label: "Committees, COI, officers, tasks, and compliance workflows were verified." }),
  Object.freeze({ id: "freeze", label: "Emergency access freeze and restore were tested with non-Founder accounts." }),
  Object.freeze({ id: "mobile", label: "Phone, tablet, and desktop layouts were reviewed for critical workflows." }),
  Object.freeze({ id: "google_access", label: "Official Google document links open with the intended Board sharing permissions." }),
  Object.freeze({ id: "cleanup", label: "Temporary test accounts, meetings, votes, documents, and governance records were cleaned up." }),
  Object.freeze({ id: "board_ready", label: "The real Board roster, permissions, notices, and first organizational meeting are prepared." })
]);

function check(id, label, status, detail, critical = true) {
  return { id, label, status, detail, critical };
}

export function evaluateEnvironment(input = {}) {
  const hostname = String(input.hostname || "").toLowerCase();
  const protocol = String(input.protocol || "").toLowerCase();
  const projectId = String(input.projectId || "");
  const cname = String(input.cname || "").trim().toLowerCase();
  const firebaseJson = input.firebaseJson && typeof input.firebaseJson === "object" ? input.firebaseJson : null;
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
  const checks = [];

  checks.push(check(
    "host",
    "Production hostname",
    local ? "warning" : (hostname === EXPECTED_PRODUCTION_HOST ? "pass" : "fail"),
    local ? "Running in a local development environment." : (hostname === EXPECTED_PRODUCTION_HOST ? `Running on ${EXPECTED_PRODUCTION_HOST}.` : `Current host is ${hostname || "unknown"}.`),
    true
  ));
  checks.push(check(
    "https",
    "Secure transport",
    local ? "warning" : (protocol === "https:" ? "pass" : "fail"),
    local ? "Local development may use HTTP." : (protocol === "https:" ? "HTTPS is active." : "Production must use HTTPS."),
    true
  ));
  checks.push(check(
    "firebase_project",
    "Firebase project",
    projectId === EXPECTED_FIREBASE_PROJECT ? "pass" : "fail",
    projectId === EXPECTED_FIREBASE_PROJECT ? `Connected to ${EXPECTED_FIREBASE_PROJECT}.` : `Configured project is ${projectId || "unknown"}.`,
    true
  ));
  if (cname) {
    checks.push(check(
      "cname",
      "GitHub Pages CNAME",
      cname === EXPECTED_PRODUCTION_HOST ? "pass" : "fail",
      cname === EXPECTED_PRODUCTION_HOST ? "CNAME matches the production domain." : `CNAME is ${cname}.`,
      true
    ));
  } else {
    checks.push(check("cname", "GitHub Pages CNAME", "warning", "CNAME could not be read from the current deployment.", false));
  }
  if (firebaseJson) {
    const forbidden = ["hosting", "storage", "functions"].filter((key) => Object.prototype.hasOwnProperty.call(firebaseJson, key));
    const rulesOnly = firebaseJson.firestore?.rules === "firestore.rules" && !firebaseJson.firestore?.indexes;
    checks.push(check(
      "firebase_scope",
      "Firebase product scope",
      forbidden.length === 0 && rulesOnly ? "pass" : "fail",
      forbidden.length ? `Unexpected Firebase configuration: ${forbidden.join(", ")}.` : (rulesOnly ? "Firebase CLI configuration is Firestore-rules-only." : "Firebase CLI configuration includes an unexpected indexes/rules shape."),
      true
    ));
  } else {
    checks.push(check("firebase_scope", "Firebase product scope", "warning", "firebase.json could not be read from the deployed site.", false));
  }
  checks.push(check(
    "index_file",
    "Manual/composite index file",
    input.indexFilePresent === false ? "pass" : (input.indexFilePresent === true ? "fail" : "warning"),
    input.indexFilePresent === false ? "No firestore.indexes.json is deployed." : (input.indexFilePresent === true ? "firestore.indexes.json is present and must be removed." : "Index-file presence could not be verified."),
    true
  ));
  checks.push(check(
    "network",
    "Browser network state",
    input.online === false ? "fail" : "pass",
    input.online === false ? "Browser reports that it is offline." : "Browser reports an active network connection.",
    false
  ));
  return checks;
}

export function evaluateModuleStatus(status = {}) {
  const entries = Object.entries(status || {});
  if (!entries.length) return [check("modules", "Governance module loader", "warning", "Module load status is not available yet.", true)];
  const failed = entries.filter(([, value]) => value?.status === "failed");
  const loading = entries.filter(([, value]) => value?.status === "loading");
  return [check(
    "modules",
    "Governance module loader",
    failed.length ? "fail" : (loading.length ? "warning" : "pass"),
    failed.length ? `${failed.length} module(s) failed to load: ${failed.map(([name]) => name).join(", ")}.` : (loading.length ? `${loading.length} module(s) are still loading.` : `${entries.length} production module(s) loaded successfully.`),
    true
  )];
}

export function evaluateSecuritySnapshot(input = {}) {
  const directors = Array.isArray(input.directors) ? input.directors : [];
  const incidents = Array.isArray(input.incidents) ? input.incidents : [];
  const meetings = Array.isArray(input.meetings) ? input.meetings : [];
  const votes = Array.isArray(input.votes) ? input.votes : [];
  const roots = directors.filter((entry) => entry?.root === true && entry?.systemRole === "founder_director");
  const wildcard = directors.filter((entry) => !(entry?.root === true && entry?.systemRole === "founder_director") && Array.isArray(entry?.permissions) && entry.permissions.includes("*"));
  const pendingAccounts = directors.filter((entry) => ["awaiting_activation", "pin_reset_required"].includes(entry?.accountStatus));
  const activeIncidents = incidents.filter((entry) => !["resolved", "closed"].includes(entry?.status));
  const criticalIncidents = activeIncidents.filter((entry) => entry?.severity === "critical");
  const activeMeetings = meetings.filter((entry) => ["check_in_open", "in_session", "recessed"].includes(entry?.status));
  const unfinishedVotes = votes.filter((entry) => ["open", "closing"].includes(entry?.status));
  return [
    check("root_count", "Founder root integrity", roots.length === 1 ? "pass" : "fail", roots.length === 1 ? "Exactly one protected Founder root account is present." : `${roots.length} Founder root accounts were found.`, true),
    check("wildcard", "Non-Founder wildcard access", wildcard.length === 0 ? "pass" : "fail", wildcard.length === 0 ? "No non-Founder account has wildcard permissions." : `${wildcard.length} non-Founder wildcard account(s) require review.`, true),
    check("freeze", "Emergency access freeze", input.freeze?.status === "active" ? "fail" : "pass", input.freeze?.status === "active" ? "An emergency access freeze is active." : "No emergency access freeze is active.", true),
    check("security_policy", "Security policy record", input.policy ? "pass" : "warning", input.policy ? "Founder security policy settings are present." : "No portal security policy record is saved yet.", false),
    check("access_review", "Formal access review", input.lastAccessReview ? "pass" : "warning", input.lastAccessReview ? "At least one formal access review is recorded." : "No formal access review marker exists yet.", false),
    check("critical_incidents", "Critical security incidents", criticalIncidents.length === 0 ? "pass" : "fail", criticalIncidents.length === 0 ? "No unresolved critical incidents." : `${criticalIncidents.length} unresolved critical incident(s).`, true),
    check("open_incidents", "Open security incidents", activeIncidents.length === 0 ? "pass" : "warning", activeIncidents.length === 0 ? "No open security incidents." : `${activeIncidents.length} incident(s) remain open or investigating.`, false),
    check("pending_accounts", "Activation/recovery accounts", pendingAccounts.length === 0 ? "pass" : "warning", pendingAccounts.length === 0 ? "No accounts are awaiting activation or PIN recovery." : `${pendingAccounts.length} account(s) are awaiting activation or recovery.`, false),
    check("active_meetings", "Live meeting state", activeMeetings.length === 0 ? "pass" : "warning", activeMeetings.length === 0 ? "No Board meeting is currently live." : `${activeMeetings.length} live/recessed meeting(s) exist.`, false),
    check("unfinished_votes", "Unfinished pushed votes", unfinishedVotes.length === 0 ? "pass" : "fail", unfinishedVotes.length === 0 ? "No pushed vote is open or closing." : `${unfinishedVotes.length} pushed vote(s) remain open/closing.`, true)
  ];
}

export function normalizeManualState(saved = {}) {
  const current = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(MANUAL_LAUNCH_ITEMS.map((item) => [item.id, current[item.id] === true]));
}

export function evaluateLaunchGate(checks = [], manualState = {}) {
  const criticalFailures = checks.filter((entry) => entry.critical && entry.status === "fail");
  const criticalWarnings = checks.filter((entry) => entry.critical && entry.status === "warning");
  const normalized = normalizeManualState(manualState);
  const incompleteManual = MANUAL_LAUNCH_ITEMS.filter((item) => !normalized[item.id]);
  return {
    ready: criticalFailures.length === 0 && criticalWarnings.length === 0 && incompleteManual.length === 0,
    criticalFailures,
    criticalWarnings,
    incompleteManual,
    completedManual: MANUAL_LAUNCH_ITEMS.length - incompleteManual.length,
    totalManual: MANUAL_LAUNCH_ITEMS.length
  };
}
