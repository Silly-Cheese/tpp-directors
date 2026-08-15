let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(".nav-item[data-view]");
    if (!button || button.hidden || button.disabled) return;
    document.querySelectorAll(".portal-section").forEach((section) => {
      section.hidden = true;
    });
  }, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
