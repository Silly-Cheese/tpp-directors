import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";
import {
  activateEmergencyFreeze,
  auditEventIsCorrelated,
  collectAuditTrail,
  createSecurityIncident,
  getEmergencyFreeze,
  getSecurityPolicy,
  isFounder,
  liftEmergencyFreeze,
  listSecurityDirectors,
  listSecurityIncidents,
  recordAccessReview,
  saveSecurityPolicy,
  sensitivePermissionsFor,
  summarizeSecurityPosture,
  updateSecurityIncident
} from "./admin-security-data.js";

const $ = (selector) => document.querySelector(selector);
let profile = null;
let directors = [];
let auditRows = [];
let incidents = [];
let policy = null;
let freeze = null;
let initialized = false;
let activeTab = "overview";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(value) {
  const millis = timestampValue(value);
  if (!millis) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
  }).format(new Date(millis));
}

function humanize(value = "") {
  return String(value || "—").replaceAll("_", " ").replaceAll(".", " · ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canAudit() {
  return isFounder(profile) || hasPermission(profile, PERMISSIONS.AUDIT_VIEW);
}

function installStylesheet() {
  if ($('link[data-phase9-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase9.css";
  link.dataset.phase9Styles = "true";
  document.head.append(link);
}

function ensureNavigation() {
  if ($('.nav-item[data-view="security"]')) return;
  const anchor = $('.nav-item[data-view="founder"]') || $('.nav-item[data-view="governance"]') || $('.nav-item[data-view="records"]');
  if (!anchor) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-item";
  button.dataset.view = "security";
  button.textContent = "Security & Audit";
  button.hidden = true;
  anchor.after(button);
  button.addEventListener("click", showSecurityView);
}

function ensureView() {
  if ($("#view-security")) return;
  const main = $(".portal-main");
  if (!main) return;
  const section = document.createElement("section");
  section.id = "view-security";
  section.className = "portal-section phase9-shell";
  section.hidden = true;
  section.innerHTML = `
    <div class="phase9-head">
      <div><p class="eyebrow">PHASE 9 · ADMINISTRATION & SECURITY</p><h2>Security & Audit Center</h2><p>Founder access oversight, consolidated governance history, emergency account controls, incident records, and security review.</p></div>
      <button id="phase9-refresh" class="secondary-button" type="button">Refresh Security Center</button>
    </div>
    <div id="phase9-banner"></div>
    <div id="phase9-tabs" class="phase9-tabs">
      <button type="button" data-phase9-tab="overview" class="active">Overview</button>
      <button type="button" data-phase9-tab="audit">Audit Trail</button>
      <button type="button" data-phase9-tab="access" data-founder-only>Access Oversight</button>
      <button type="button" data-phase9-tab="incidents" data-founder-only>Incidents</button>
      <button type="button" data-phase9-tab="settings" data-founder-only>Security Policy</button>
    </div>
    <div id="phase9-content" class="phase9-content"></div>`;
  main.append(section);
}

function showSecurityView() {
  if (!canAudit()) return;
  document.querySelectorAll(".portal-section").forEach((section) => { section.hidden = section.id !== "view-security"; });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === "security"));
  const title = $("#view-title");
  if (title) title.textContent = "Security & Audit Center";
  $("#view-security").hidden = false;
  render();
}

function renderBanner() {
  const host = $("#phase9-banner");
  if (!host) return;
  if (!isFounder(profile)) {
    host.innerHTML = '<div class="phase9-banner info"><strong>Delegated audit access</strong><span>This account can read administrative audit events only. Founder-only security controls are hidden.</span></div>';
    return;
  }
  if (freeze?.status === "active") {
    host.innerHTML = `<div class="phase9-banner danger"><strong>EMERGENCY ACCESS FREEZE ACTIVE</strong><span>${escapeHtml(freeze.reason || "Non-Founder Board portal access is suspended.")}</span></div>`;
    return;
  }
  host.innerHTML = '<div class="phase9-banner good"><strong>Founder security controls available</strong><span>No emergency access freeze is active.</span></div>';
}

function renderOverview() {
  if (!isFounder(profile)) {
    return `<article class="panel phase9-auditor-card"><h3>Audit access</h3><p>Your delegated role can review administrative audit events. Founder-only account, incident, and emergency controls remain protected.</p><button type="button" data-phase9-tab-jump="audit">Open Audit Trail</button></article>`;
  }
  const summary = summarizeSecurityPosture(directors, auditRows);
  const wildcard = directors.filter((entry) => !isFounder(entry) && Array.isArray(entry.permissions) && entry.permissions.includes("*"));
  const highRisk = directors.filter((entry) => !isFounder(entry) && sensitivePermissionsFor(entry).length > 0);
  const rootWarning = summary.rootCount === 1 ? "One protected Founder root identity is present." : `${summary.rootCount} Founder root identities detected — review immediately.`;
  return `
    <div class="phase9-metrics">
      <div><span>Board Accounts</span><strong>${summary.total}</strong><small>${summary.active} active</small></div>
      <div><span>Suspended</span><strong>${summary.suspended}</strong><small>${summary.pending} activation/recovery</small></div>
      <div><span>Privileged Accounts</span><strong>${summary.privileged}</strong><small>Sensitive capabilities assigned</small></div>
      <div><span>Audit Entries</span><strong>${summary.auditCount}</strong><small>${summary.uncorrelated} require contextual review</small></div>
    </div>
    <div class="phase9-overview-grid">
      <article class="panel phase9-health-card"><p class="eyebrow">ROOT INTEGRITY</p><h3>${summary.rootCount === 1 ? "Protected" : "Attention Required"}</h3><p>${escapeHtml(rootWarning)}</p>${wildcard.length ? `<div class="phase9-warning"><strong>${wildcard.length} non-Founder wildcard account${wildcard.length === 1 ? "" : "s"}</strong><span>Wildcard permission assignments should be reviewed immediately.</span></div>` : '<div class="phase9-ok">No non-Founder wildcard permission assignments detected.</div>'}</article>
      <article class="panel phase9-health-card"><p class="eyebrow">PRIVILEGE EXPOSURE</p><h3>${highRisk.length} elevated account${highRisk.length === 1 ? "" : "s"}</h3><div class="phase9-mini-list">${highRisk.slice(0, 6).map((entry) => `<div><strong>${escapeHtml(entry.fullName || entry.displayName || "Director")}</strong><span>${escapeHtml(sensitivePermissionsFor(entry).join(", "))}</span></div>`).join("") || '<span class="muted-copy">No non-Founder sensitive grants detected.</span>'}</div><button type="button" data-phase9-tab-jump="access">Review Access Matrix</button></article>
      <article class="panel phase9-emergency-card"><p class="eyebrow">EMERGENCY CONTROL</p><h3>${freeze?.status === "active" ? "Access Freeze Active" : "Board Access Freeze"}</h3><p>This control suspends every non-Founder portal account in one audited batch. The Founder root remains available for recovery.</p>${freeze?.status === "active" ? `<p><strong>Activated:</strong> ${escapeHtml(formatDateTime(freeze.activatedAt))}</p><button type="button" class="phase9-lift" data-phase9-action="lift-freeze">Lift Emergency Freeze</button>` : `<label>Reason for freeze<textarea id="phase9-freeze-reason" rows="3" maxlength="2000" placeholder="Describe the security or operational reason"></textarea></label><button type="button" class="phase9-freeze" data-phase9-action="activate-freeze">Activate Emergency Freeze</button>`}<p id="phase9-freeze-message" class="form-message"></p></article>
      <article class="panel phase9-health-card"><p class="eyebrow">SECURITY INCIDENTS</p><h3>${incidents.filter((entry) => !["resolved", "closed"].includes(entry.status)).length} open / investigating</h3><p>${incidents.length} total recorded incident${incidents.length === 1 ? "" : "s"}.</p><button type="button" data-phase9-tab-jump="incidents">Open Incident Register</button></article>
    </div>`;
}

function filteredAuditRows() {
  const search = String($("#phase9-audit-search")?.value || "").trim().toLowerCase();
  const source = $("#phase9-audit-source")?.value || "all";
  return auditRows.filter((entry) => {
    if (source !== "all" && entry.source !== source) return false;
    if (!search) return true;
    return [entry.action, entry.actor, entry.targetType, entry.targetId, entry.source].some((value) => String(value || "").toLowerCase().includes(search));
  });
}

function renderAuditRows() {
  const host = $("#phase9-audit-list");
  if (!host) return;
  const rows = filteredAuditRows();
  host.innerHTML = rows.length ? rows.map((entry) => `
    <article class="phase9-audit-row">
      <div class="phase9-audit-source ${escapeHtml(entry.source)}">${escapeHtml(entry.source.toUpperCase())}</div>
      <div><strong>${escapeHtml(humanize(entry.action))}</strong><span>${escapeHtml(entry.actor)} · ${escapeHtml(formatDateTime(entry.createdAt))}</span>${entry.targetId ? `<small>${escapeHtml(entry.targetType || "record")} · ${escapeHtml(entry.targetId)}</small>` : ""}</div>
      <span class="phase9-correlation ${auditEventIsCorrelated(entry) ? "verified" : "context"}">${auditEventIsCorrelated(entry) ? "Correlated" : "Context Review"}</span>
    </article>`).join("") : '<div class="phase9-empty">No audit events match this filter.</div>';
}

function renderAudit() {
  return `
    <div class="phase9-toolbar"><label>Search audit trail<input id="phase9-audit-search" type="search" placeholder="Action, actor, target, or ID"></label><label>Source<select id="phase9-audit-source"><option value="all">All sources</option><option value="admin">Administrative</option>${isFounder(profile) ? '<option value="document">Documents</option><option value="governance">Governance</option><option value="record">Certified Records</option>' : ""}</select></label></div>
    <div class="phase9-audit-note"><strong>Audit interpretation</strong><span>Administrative and permanent-record events are privileged append-only records. Document/governance events are correlated against their source context but are not cryptographically server-signed because this portal intentionally has no backend.</span></div>
    <div id="phase9-audit-list" class="phase9-audit-list"></div>`;
}

function renderAccess() {
  const rows = directors.map((entry) => {
    const sensitive = sensitivePermissionsFor(entry);
    return `<tr><td><strong>${escapeHtml(entry.fullName || entry.displayName || "Director")}</strong><small>${escapeHtml(entry.directorNumber || entry.uid)}</small></td><td>${escapeHtml(humanize(entry.accountStatus))}</td><td>${escapeHtml(entry.officerRole || "—")}</td><td>${sensitive.length ? sensitive.map((permission) => `<span>${escapeHtml(permission)}</span>`).join("") : '<em>Standard access</em>'}</td></tr>`;
  }).join("");
  return `
    <div class="phase9-access-head"><div><h3>Portal Access Matrix</h3><p>Review the current account state and sensitive capabilities before recording a formal access review.</p></div><button type="button" data-phase9-action="open-founder-control">Open Founder Control</button></div>
    <div class="table-wrap"><table class="phase9-access-table"><thead><tr><th>Director</th><th>Account</th><th>Officer</th><th>Sensitive capabilities</th></tr></thead><tbody>${rows}</tbody></table></div>
    <article class="panel phase9-review-card"><p class="eyebrow">FORMAL ACCESS REVIEW</p><h3>Record Access Review</h3><label>Result<select id="phase9-review-result"><option value="approved">Approved — access is appropriate</option><option value="changes_required">Changes required</option></select></label><label>Review notes<textarea id="phase9-review-notes" rows="4" maxlength="5000" placeholder="Document findings, changes required, or review basis"></textarea></label><button type="button" data-phase9-action="record-access-review">Record Immutable Review Event</button><p id="phase9-access-message" class="form-message"></p></article>`;
}

function renderIncidents() {
  return `
    <div class="phase9-incident-layout">
      <article class="panel"><p class="eyebrow">NEW INCIDENT</p><h3>Open Security Incident</h3><label>Title<input id="phase9-incident-title" maxlength="240"></label><label>Severity<select id="phase9-incident-severity"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Description<textarea id="phase9-incident-description" rows="5" maxlength="6000"></textarea></label><button type="button" data-phase9-action="create-incident">Create Incident</button><p id="phase9-incident-message" class="form-message"></p></article>
      <div class="phase9-incident-list">${incidents.length ? incidents.map((entry) => `<article class="panel phase9-incident ${escapeHtml(entry.severity)}"><div class="phase9-incident-head"><div><strong>${escapeHtml(entry.incidentNumber || "SEC")}</strong><h3>${escapeHtml(entry.title)}</h3></div><span>${escapeHtml(humanize(entry.status))}</span></div><p>${escapeHtml(entry.description)}</p><small>${escapeHtml(humanize(entry.severity))} severity · opened ${escapeHtml(formatDateTime(entry.createdAt))}</small><label>Status<select data-incident-status="${escapeHtml(entry.id)}"><option value="open" ${entry.status === "open" ? "selected" : ""}>Open</option><option value="investigating" ${entry.status === "investigating" ? "selected" : ""}>Investigating</option><option value="resolved" ${entry.status === "resolved" ? "selected" : ""}>Resolved</option><option value="closed" ${entry.status === "closed" ? "selected" : ""}>Closed</option></select></label><label>Response notes<textarea data-incident-notes="${escapeHtml(entry.id)}" rows="3">${escapeHtml(entry.responseNotes || "")}</textarea></label><button type="button" data-phase9-incident-update="${escapeHtml(entry.id)}">Update Incident</button></article>`).join("") : '<div class="phase9-empty">No security incidents have been recorded.</div>'}</div>
    </div>`;
}

function renderSettings() {
  return `
    <article class="panel phase9-settings-card"><p class="eyebrow">FOUNDER SECURITY POLICY</p><h3>Administrative Security Settings</h3><p>These settings document the operating security policy for the portal. They do not replace Firebase Authentication controls or create a hidden backend.</p><label>Access review cadence (days)<input id="phase9-policy-cadence" type="number" min="1" max="365" value="${escapeHtml(policy?.accessReviewCadenceDays || 90)}"></label><label>Security / recovery contact<input id="phase9-policy-contact" maxlength="500" value="${escapeHtml(policy?.securityContact || "")}" placeholder="Internal contact instruction"></label><label>Account recovery instructions<textarea id="phase9-policy-recovery" rows="4" maxlength="3000">${escapeHtml(policy?.recoveryInstructions || "")}</textarea></label><label>Administrative notes<textarea id="phase9-policy-notes" rows="5" maxlength="5000">${escapeHtml(policy?.administrativeNotes || "")}</textarea></label><button type="button" data-phase9-action="save-policy">Save Security Policy</button><p id="phase9-policy-message" class="form-message"></p></article>`;
}

function render() {
  const content = $("#phase9-content");
  if (!content || !profile) return;
  document.querySelectorAll("[data-founder-only]").forEach((element) => { element.hidden = !isFounder(profile); });
  if (!isFounder(profile) && activeTab !== "audit" && activeTab !== "overview") activeTab = "audit";
  document.querySelectorAll("[data-phase9-tab]").forEach((button) => button.classList.toggle("active", button.dataset.phase9Tab === activeTab));
  renderBanner();
  if (activeTab === "overview") content.innerHTML = renderOverview();
  if (activeTab === "audit") {
    content.innerHTML = renderAudit();
    renderAuditRows();
  }
  if (activeTab === "access") content.innerHTML = renderAccess();
  if (activeTab === "incidents") content.innerHTML = renderIncidents();
  if (activeTab === "settings") content.innerHTML = renderSettings();
}

async function refreshData() {
  if (!profile || !canAudit()) return;
  const refresh = $("#phase9-refresh");
  if (refresh) { refresh.disabled = true; refresh.textContent = "Refreshing…"; }
  try {
    auditRows = await collectAuditTrail(profile);
    if (isFounder(profile)) {
      [directors, incidents, policy, freeze] = await Promise.all([
        listSecurityDirectors(profile),
        listSecurityIncidents(profile),
        getSecurityPolicy(profile),
        getEmergencyFreeze(profile)
      ]);
    } else {
      directors = [];
      incidents = [];
      policy = null;
      freeze = null;
    }
    render();
  } catch (error) {
    const content = $("#phase9-content");
    if (content) content.innerHTML = `<div class="phase9-empty">${escapeHtml(error.message || "Security Center could not load.")}</div>`;
  } finally {
    if (refresh) { refresh.disabled = false; refresh.textContent = "Refresh Security Center"; }
  }
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

async function handleAction(button) {
  const action = button.dataset.phase9Action;
  if (!action || !isFounder(profile)) return;
  if (action === "activate-freeze") {
    const reason = $("#phase9-freeze-reason")?.value || "";
    if (!window.confirm("Suspend every non-Founder Board Portal account now? The Founder root will remain available.")) return;
    const count = await activateEmergencyFreeze(reason, profile);
    await refreshData();
    const message = $("#phase9-freeze-message"); if (message) message.textContent = `${count} account${count === 1 ? "" : "s"} suspended.`;
  }
  if (action === "lift-freeze") {
    if (!window.confirm("Lift the emergency freeze and restore accounts that are still suspended by it?")) return;
    await liftEmergencyFreeze(profile);
    await refreshData();
  }
  if (action === "record-access-review") {
    const message = $("#phase9-access-message");
    const id = await recordAccessReview({ result: $("#phase9-review-result")?.value, notes: $("#phase9-review-notes")?.value }, profile);
    if (message) message.textContent = `Access review recorded as audit event ${id}.`;
    await refreshData();
  }
  if (action === "open-founder-control") {
    document.querySelector('.nav-item[data-view="founder"]')?.click();
  }
  if (action === "create-incident") {
    const message = $("#phase9-incident-message");
    await createSecurityIncident({ title: $("#phase9-incident-title")?.value, severity: $("#phase9-incident-severity")?.value, description: $("#phase9-incident-description")?.value }, profile);
    if (message) message.textContent = "Security incident recorded.";
    await refreshData();
  }
  if (action === "save-policy") {
    const message = $("#phase9-policy-message");
    await saveSecurityPolicy({ accessReviewCadenceDays: $("#phase9-policy-cadence")?.value, securityContact: $("#phase9-policy-contact")?.value, recoveryInstructions: $("#phase9-policy-recovery")?.value, administrativeNotes: $("#phase9-policy-notes")?.value }, profile);
    if (message) message.textContent = "Security policy saved and audited.";
    await refreshData();
  }
}

function bindEvents() {
  $("#phase9-refresh")?.addEventListener("click", refreshData);
  $("#phase9-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-phase9-tab]");
    if (!button || button.hidden) return;
    activeTab = button.dataset.phase9Tab;
    render();
  });
  $("#phase9-content")?.addEventListener("click", async (event) => {
    const jump = event.target.closest("[data-phase9-tab-jump]");
    if (jump) { activeTab = jump.dataset.phase9TabJump; render(); return; }
    const incident = event.target.closest("[data-phase9-incident-update]");
    if (incident && isFounder(profile)) {
      incident.disabled = true;
      try {
        const id = incident.dataset.phase9IncidentUpdate;
        await updateSecurityIncident(id, { status: document.querySelector(`[data-incident-status="${CSS.escape(id)}"]`)?.value, responseNotes: document.querySelector(`[data-incident-notes="${CSS.escape(id)}"]`)?.value }, profile);
        await refreshData();
      } catch (error) { window.alert(error.message || "Unable to update the incident."); }
      finally { incident.disabled = false; }
      return;
    }
    const action = event.target.closest("[data-phase9-action]");
    if (action) {
      action.disabled = true;
      try { await handleAction(action); }
      catch (error) {
        const message = $("#phase9-freeze-message") || $("#phase9-access-message") || $("#phase9-incident-message") || $("#phase9-policy-message");
        if (message) message.textContent = error.message || "Security action failed.";
        else window.alert(error.message || "Security action failed.");
      } finally { action.disabled = false; }
    }
  });
  $("#phase9-content")?.addEventListener("input", (event) => {
    if (["phase9-audit-search", "phase9-audit-source"].includes(event.target.id)) renderAuditRows();
  });
  $("#phase9-content")?.addEventListener("change", (event) => {
    if (event.target.id === "phase9-audit-source") renderAuditRows();
  });
}

function applyAccess() {
  const nav = $('.nav-item[data-view="security"]');
  if (nav) nav.hidden = !canAudit();
  if (!canAudit() && $("#view-security") && !$("#view-security").hidden) document.querySelector('.nav-item[data-view="overview"]')?.click();
}

function init() {
  if (initialized) return;
  initialized = true;
  installStylesheet();
  ensureNavigation();
  ensureView();
  bindEvents();
  onAuthStateChanged(auth, async (user) => {
    profile = user ? await loadProfile(user.uid) : null;
    directors = []; auditRows = []; incidents = []; policy = null; freeze = null;
    applyAccess();
    if (profile && canAudit()) await refreshData();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
