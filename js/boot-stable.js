// Deterministic Board Portal bootstrap.
// Critical live-governance modules mount first; the main app/router comes last.
const RELEASE = "20260918-meeting-editor";

async function boot() {
  try {
    await import("./phase5.js?v=20260918-meeting-editor");
    await import(`./phase6.js?v=${RELEASE}`);
    await import(`./app.js?v=${RELEASE}`);
    window.__TPP_BOOT_RELEASE__ = RELEASE;
    window.dispatchEvent(new CustomEvent("tpp:boot-ready", { detail: { release: RELEASE } }));
  } catch (error) {
    console.error("Board Portal critical boot failed", error);
    window.__TPP_BOOT_ERROR__ = String(error?.message || error);
    const message = document.createElement("div");
    message.setAttribute("role", "alert");
    message.style.cssText = "position:fixed;inset:auto 18px 18px 18px;z-index:99999;padding:14px 16px;border:1px solid #8d7452;border-radius:12px;background:#301415;color:#fffdf8;font:600 14px/1.45 system-ui;";
    message.textContent = `The Board Portal could not finish loading: ${window.__TPP_BOOT_ERROR__}`;
    document.body.append(message);
  }
}


function initializeWorkspaceNavigation() {
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.getElementById("board-menu-toggle");
  if (!sidebar || !toggle) return;
  sidebar.dataset.menuReady = "true";
  function closeMenu() {
    sidebar.dataset.menuOpen = "false";
    toggle.setAttribute("aria-expanded", "false");
  }
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    sidebar.dataset.menuOpen = String(open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  sidebar.addEventListener("click", event => {
    if (!event.target.closest(".nav-item[data-view]")) return;
    closeMenu();
    if (window.matchMedia("(max-width:760px)").matches) {
      requestAnimationFrame(() => {
        const heading = document.getElementById("view-title");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: "start" }); }
      });
    }
  });
  sidebar.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeMenu(); toggle.focus(); }
  });
  window.addEventListener("tpp:view-changed", () => {
    closeMenu();
    if (window.matchMedia("(max-width:760px)").matches) {
      const heading = document.getElementById("view-title");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: "start", behavior: "auto" });
      }
    }
  });
  const view = document.getElementById("signed-in-view");
  if (view) new MutationObserver(() => { if (view.hidden) closeMenu(); }).observe(view, { attributes: true, attributeFilter: ["hidden"] });
}
initializeWorkspaceNavigation();

boot();
