import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import {
  MANUAL_LAUNCH_ITEMS,
  evaluateLaunchGate,
  normalizeManualState
} from "./production-readiness.js";
import {
  getLaunchReadiness,
  runProductionDiagnostics,
  saveLaunchReadiness
} from "./phase10-data.js";

const $ = (selector) => document.querySelector(selector);
let profile = null;
let profileUnsub = null;
let diagnostics = null;
let savedState = null;
let activeTab = "diagnostics";
let initialized = false;
let running = false;

function founder(value) {
  return value?.root === true && value?.systemRole === "founder_director" && value?.accountStatus === "active";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function installStylesheet() {
  if ($('link[data-phase10-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase10.css";
  link.dataset.phase10Styles = "true";
  document.head.append(link);
}

function ensureNavigation() {
  if ($('.nav-item[data-view="launch"]')) return;
  const anchor = $('.nav-item[data-view="security"]') || $('.nav-item[data-view="founder"]');
  if (!anchor) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-item";
  button.dataset.view = "launch";
  button.textContent = "Launch Readiness";
  button.hidden = true;
  anchor.after(button);
  button.addEventListener("click", showView);
}

function ensureView() {
  if ($("#view-launch")) return;
  const main = $(".portal-main");
  if (!main) return;
  const section = document.createElement("section");
  section.id = "view-launch";
  section.className = "portal-section phase10-shell";
  section.hidden = true;
  section.innerHTML = `
    <div class="phase10-head">
      <div><p class="eyebrow">PHASE 10 · PRODUCTION READINESS</p><h2>Launch Readiness Center</h2><p>Final production diagnostics, manual verification, runtime health, and an auditable go-live record for the Board Portal.</p></div>
      <button id="phase10-run" class="secondary-button" type="button">Run Production Diagnostics</button>
    </div>
    <div id="phase10-summary"></div>
    <div id="phase10-tabs" class="phase10-tabs">
      <button type="button" data-phase10-tab="diagnostics" class="active">Diagnostics</button>
      <button type="button" data-phase10-tab="checklist">Launch Checklist</button>
      <button type="button" data-phase10-tab="release">Release & QA</button>
    </div>
    <div id="phase10-content" class="phase10-content"></div>`;
  main.append(section);
}

function showView() {
  if (!founder(profile)) return;
  document.querySelectorAll(".portal-section").forEach((section) => { section.hidden = section.id !== "view-launch"; });
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === "launch"));
  const title = $("#view-title");
  if (title) title.textContent = "Launch Readiness";
  $("#view-launch").hidden = false;
  render();
}

function statusCounts() {
  const checks = diagnostics?.checks || [];
  return {
    pass: checks.filter((entry) => entry.status === "pass").length,
    warning: checks.filter((entry) => entry.status === "warning").length,
    fail: checks.filter((entry) => entry.status === "fail").length,
    total: checks.length
  };
}

function gate() {
  return evaluateLaunchGate(diagnostics?.checks || [], normalizeManualState(savedState?.items || {}));
}

function renderSummary() {
  const host = $("#phase10-summary");
  if (!host) return;
  const counts = statusCounts();
  const currentGate = gate();
  const state = savedState?.status || "draft";
  host.innerHTML = `
    <div class="phase10-status">
      <div><span>Automatic Checks</span><strong>${counts.total || "—"}</strong><small>${counts.pass} pass · ${counts.warning} warning · ${counts.fail} fail</small></div>
      <div><span>Manual Verification</span><strong>${currentGate.completedManual}/${currentGate.totalManual}</strong><small>Founder-confirmed launch items</small></div>
      <div><span>Launch Gate</span><strong>${currentGate.ready ? "CLEAR" : "HOLD"}</strong><small>${currentGate.ready ? "All required checks are satisfied." : "Outstanding blockers remain."}</small></div>
      <div><span>Recorded Status</span><strong><span class="phase10-badge ${escapeHtml(state)}">${escapeHtml(state.replaceAll("_", " ").toUpperCase())}</span></strong><small>${savedState?.updatedByName ? `Last updated by ${escapeHtml(savedState.updatedByName)}` : "Not yet recorded"}</small></div>
    </div>
    <div class="phase10-gate ${currentGate.ready ? "ready" : "blocked"}">
      <div><strong>${currentGate.ready ? "Production launch gate is clear." : "Production launch gate is not clear."}</strong><span>${currentGate.ready ? "The automatic diagnostics and manual verification checklist are complete. You may record Ready for Launch or Production Launched." : `${currentGate.criticalFailures.length} critical failure(s), ${currentGate.criticalWarnings.length} critical warning(s), and ${currentGate.incompleteManual.length} manual item(s) remain.`}</span></div>
    </div>`;
}

function renderChecks() {
  const checks = diagnostics?.checks || [];
  if (!checks.length) return '<div class="phase10-empty">Run Production Diagnostics to evaluate the deployed portal and current Board security state.</div>';
  return `<div class="phase10-checks">${checks.map((entry) => `
    <article class="phase10-check ${escapeHtml(entry.status)} ${entry.critical ? "critical" : ""}">
      <span class="dot" aria-hidden="true"></span>
      <div><strong>${escapeHtml(entry.label)}</strong><span>${escapeHtml(entry.detail)}</span></div>
    </article>`).join("")}</div>`;
}

function renderDiagnostics() {
  const runtime = window.__TPP_RUNTIME__ || { errors: [] };
  const modules = window.__TPP_MODULE_STATUS__ || {};
  return `
    <div class="phase10-toolbar"><div><h3>Automatic Production Diagnostics</h3><p>Checks run against the current browser deployment and the current Founder-authorized Firestore state.</p></div><button type="button" data-phase10-action="run">Run Again</button></div>
    ${renderChecks()}
    <article class="panel"><p class="eyebrow">RUNTIME HEALTH</p><h3>Client diagnostics</h3><div class="phase10-runtime">${escapeHtml(JSON.stringify({ online: navigator.onLine, runtimeErrors: runtime.errors || [], modules }, null, 2))}</div></article>`;
}

function renderChecklist() {
  const items = normalizeManualState(savedState?.items || {});
  return `
    <div class="phase10-toolbar"><div><h3>Founder Go-Live Checklist</h3><p>These checks require human verification and are intentionally not guessed by the browser.</p></div><span>${Object.values(items).filter(Boolean).length}/${MANUAL_LAUNCH_ITEMS.length} complete</span></div>
    <div class="phase10-manual">${MANUAL_LAUNCH_ITEMS.map((item) => `<label class="phase10-item"><input type="checkbox" data-launch-item="${escapeHtml(item.id)}" ${items[item.id] ? "checked" : ""}><span>${escapeHtml(item.label)}</span></label>`).join("")}</div>
    <label class="phase10-notes"><span>Launch notes</span><textarea id="phase10-notes" maxlength="8000" placeholder="Record deployment notes, known limitations, test references, or Board launch notes.">${escapeHtml(savedState?.notes || "")}</textarea></label>
    <div class="phase10-actions"><button type="button" data-phase10-action="save-draft">Save Checklist Progress</button><button type="button" data-phase10-action="ready">Record Ready for Launch</button><button type="button" class="phase10-danger" data-phase10-action="launched">Record Production Launched</button></div>
    <p id="phase10-action-message" class="form-message"></p>`;
}

const QA_PAGES = [
  ["Phase 2–3", "./tests/phase2-phase3.html"],
  ["Phase 4", "./tests/phase4-documents.html"],
  ["Phase 5", "./tests/phase5-meetings.html"],
  ["Phase 6", "./tests/phase6-governance.html"],
  ["Phase 7", "./tests/phase7-records.html"],
  ["Phase 8", "./tests/phase8-governance.html"],
  ["Phase 9", "./tests/phase9-security.html"],
  ["Phase 10", "./tests/phase10-production.html"]
];

function renderRelease() {
  return `
    <div class="phase10-release">
      <article class="panel"><p class="eyebrow">BROWSER QA</p><h3>Non-destructive harnesses</h3><p>Run these over HTTP/HTTPS before production Board use.</p><div class="phase10-list">${QA_PAGES.map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener"><span>${escapeHtml(label)} QA</span><strong>Open ↗</strong></a>`).join("")}</div></article>
      <article class="panel"><p class="eyebrow">PRODUCTION RECORD</p><h3>Launch state</h3><p>The Launch Readiness record lives in Founder-only <code>system/launchReadiness</code>. Recording Ready/Launched does not alter hosting or Firebase configuration; it creates an auditable operational milestone.</p><dl class="detail-list"><div><dt>Status</dt><dd>${escapeHtml(savedState?.status || "draft")}</dd></div><div><dt>Manual checks</dt><dd>${Object.values(normalizeManualState(savedState?.items || {})).filter(Boolean).length}/${MANUAL_LAUNCH_ITEMS.length}</dd></div><div><dt>Production host</dt><dd>directors.ask4prayers.com</dd></div><div><dt>Firebase</dt><dd>Authentication + Firestore only</dd></div><div><dt>Indexes</dt><dd>No manual/composite indexes</dd></div></dl></article>
    </div>`;
}

function render() {
  if (!$("#view-launch")) return;
  renderSummary();
  document.querySelectorAll("[data-phase10-tab]").forEach((button) => button.classList.toggle("active", button.dataset.phase10Tab === activeTab));
  const content = $("#phase10-content");
  if (activeTab === "diagnostics") content.innerHTML = renderDiagnostics();
  if (activeTab === "checklist") content.innerHTML = renderChecklist();
  if (activeTab === "release") content.innerHTML = renderRelease();
}

async function refreshSavedState() {
  savedState = profile && founder(profile) ? await getLaunchReadiness(profile) : null;
}

async function runDiagnostics() {
  if (!founder(profile) || running) return;
  running = true;
  const button = $("#phase10-run");
  if (button) { button.disabled = true; button.textContent = "Running…"; }
  try {
    diagnostics = await runProductionDiagnostics(profile);
    await refreshSavedState();
    render();
  } catch (error) {
    diagnostics = { checks: [{ id: "diagnostic_error", label: "Production diagnostics", status: "fail", detail: error.message || "Diagnostics could not complete.", critical: true }] };
    render();
  } finally {
    running = false;
    if (button) { button.disabled = false; button.textContent = "Run Production Diagnostics"; }
  }
}

function currentChecklistItems() {
  const base = normalizeManualState(savedState?.items || {});
  document.querySelectorAll("[data-launch-item]").forEach((input) => { base[input.dataset.launchItem] = input.checked; });
  return base;
}

async function saveStatus(status) {
  if (!founder(profile)) return;
  const notes = $("#phase10-notes")?.value ?? savedState?.notes ?? "";
  if (["ready_for_launch", "launched"].includes(status)) {
    if (!diagnostics?.checks) throw new Error("Run Production Diagnostics immediately before recording this launch milestone.");
    const currentGate = evaluateLaunchGate(diagnostics.checks, currentChecklistItems());
    if (!currentGate.ready) throw new Error("Launch gate is not clear. Resolve automatic blockers and complete every manual verification item first.");
    if (status === "launched" && !window.confirm("Record the Board Portal as Production Launched? This records an auditable milestone; it does not change GitHub Pages or Firebase settings.")) return;
  }
  await saveLaunchReadiness({ items: currentChecklistItems(), notes, status }, profile, diagnostics);
  await refreshSavedState();
  render();
  const message = $("#phase10-action-message");
  if (message) message.textContent = status === "draft" ? "Launch checklist progress saved." : `Launch status recorded: ${status.replaceAll("_", " ")}.`;
}

function bindEvents() {
  $("#phase10-run")?.addEventListener("click", runDiagnostics);
  $("#phase10-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-phase10-tab]");
    if (!button) return;
    activeTab = button.dataset.phase10Tab;
    render();
  });
  $("#phase10-content")?.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-phase10-action]");
    if (!action) return;
    action.disabled = true;
    try {
      if (action.dataset.phase10Action === "run") await runDiagnostics();
      if (action.dataset.phase10Action === "save-draft") await saveStatus("draft");
      if (action.dataset.phase10Action === "ready") await saveStatus("ready_for_launch");
      if (action.dataset.phase10Action === "launched") await saveStatus("launched");
    } catch (error) {
      const message = $("#phase10-action-message");
      if (message) message.textContent = error.message || "Launch readiness action failed.";
      else window.alert(error.message || "Launch readiness action failed.");
    } finally { action.disabled = false; }
  });
}

function applyAccess() {
  const nav = $('.nav-item[data-view="launch"]');
  if (nav) nav.hidden = !founder(profile);
  if (!founder(profile) && $("#view-launch") && !$("#view-launch").hidden) document.querySelector('.nav-item[data-view="overview"]')?.click();
}

function bindProfile(uid) {
  profileUnsub?.();
  profileUnsub = onSnapshot(doc(db, "directors", uid), async (snapshot) => {
    profile = snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
    applyAccess();
    if (founder(profile)) {
      await refreshSavedState().catch(() => {});
      render();
    }
  }, () => { profile = null; applyAccess(); });
}

async function init() {
  if (initialized) return;
  initialized = true;
  installStylesheet();
  ensureNavigation();
  ensureView();
  bindEvents();
  onAuthStateChanged(auth, async (user) => {
    profileUnsub?.();
    profileUnsub = null;
    diagnostics = null;
    savedState = null;
    if (!user) { profile = null; applyAccess(); return; }
    const snapshot = await getDoc(doc(db, "directors", user.uid));
    profile = snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
    applyAccess();
    if (founder(profile)) {
      await refreshSavedState().catch(() => {});
      bindProfile(user.uid);
      render();
    }
  });
  window.addEventListener("tpp:module-status", () => {
    if (founder(profile) && diagnostics) render();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
