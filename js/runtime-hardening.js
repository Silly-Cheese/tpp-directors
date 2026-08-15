const runtime = window.__TPP_RUNTIME__ ||= {
  errors: [],
  online: navigator.onLine,
  startedAt: new Date().toISOString()
};

function installProductionStyles() {
  if (document.querySelector('link[data-production-hardening]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./production-hardening.css";
  link.dataset.productionHardening = "true";
  document.head.append(link);
}

function safeMessage(value) {
  return String(value || "Unknown runtime error").replace(/[\r\n]+/g, " ").slice(0, 500);
}

function recordRuntimeError(source, message) {
  runtime.errors.push({ source, message: safeMessage(message), at: new Date().toISOString() });
  if (runtime.errors.length > 30) runtime.errors.splice(0, runtime.errors.length - 30);
  renderBanner();
}

function failedModules() {
  return Object.entries(window.__TPP_MODULE_STATUS__ || {}).filter(([, entry]) => entry?.status === "failed");
}

function ensureBanner() {
  let banner = document.querySelector("#runtime-health-banner");
  if (banner) return banner;
  banner = document.createElement("div");
  banner.id = "runtime-health-banner";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.style.cssText = "position:sticky;top:0;z-index:9999;padding:10px 16px;font:600 14px/1.35 system-ui,sans-serif;text-align:center;border-bottom:1px solid rgba(0,0,0,.12);";
  const shell = document.querySelector(".page-shell") || document.body;
  shell.prepend(banner);
  return banner;
}

function renderBanner() {
  const banner = ensureBanner();
  const failed = failedModules();
  if (!navigator.onLine) {
    banner.hidden = false;
    banner.style.background = "#7f1d1d";
    banner.style.color = "white";
    banner.textContent = "Board Portal is offline. Changes and live meeting updates may not reach Firestore until connectivity returns.";
    return;
  }
  if (failed.length) {
    banner.hidden = false;
    banner.style.background = "#78350f";
    banner.style.color = "white";
    banner.textContent = `Board Portal is in degraded mode: ${failed.length} governance module${failed.length === 1 ? "" : "s"} failed to load. Founder launch diagnostics should be run before Board use.`;
    return;
  }
  if (runtime.errors.length) {
    banner.hidden = false;
    banner.style.background = "#1e3a5f";
    banner.style.color = "white";
    banner.textContent = "A portal runtime error was detected. Refresh the page before conducting an official Board action; the Founder can review Launch Readiness diagnostics.";
    return;
  }
  banner.hidden = true;
  banner.textContent = "";
}

window.addEventListener("online", () => {
  runtime.online = true;
  renderBanner();
});
window.addEventListener("offline", () => {
  runtime.online = false;
  renderBanner();
});
window.addEventListener("error", (event) => {
  recordRuntimeError("window.error", event?.message || event?.error?.message);
});
window.addEventListener("unhandledrejection", (event) => {
  recordRuntimeError("unhandledrejection", event?.reason?.message || event?.reason);
});
window.addEventListener("tpp:module-status", renderBanner);

installProductionStyles();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderBanner, { once: true });
else renderBanner();

export function getRuntimeHealth() {
  return {
    online: navigator.onLine,
    errors: [...runtime.errors],
    failedModules: failedModules().map(([name, entry]) => ({ name, ...entry }))
  };
}
