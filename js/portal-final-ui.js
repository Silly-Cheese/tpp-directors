// Final UI stabilizer for The Prayer Project Board Portal.
// This module intentionally loads last, after every phase module.

const FINAL_STYLES_ID = "tpp-final-ui-styles";

function installFinalStyles() {
  if (document.getElementById(FINAL_STYLES_ID)) return;
  const link = document.createElement("link");
  link.id = FINAL_STYLES_ID;
  link.rel = "stylesheet";
  // Versioned query prevents stale GitHub Pages/browser cache after UI hotfixes.
  link.href = "./portal-final.css?v=20260817-1";
  document.head.append(link);
}

function syncPhase6HiddenStateFromClick(event) {
  const form = event.target?.closest?.("#phase6-agenda-form");
  if (!form) return;

  const typeButton = event.target.closest("[data-phase6-type-choice]");
  if (typeButton) {
    const hiddenType = form.querySelector('input[name="itemType"]');
    if (hiddenType) hiddenType.value = typeButton.dataset.phase6TypeChoice || "business";
    return;
  }

  const documentButton = event.target.closest("[data-phase6-document-choice]");
  if (documentButton) {
    const hiddenDocument = form.querySelector('input[name="documentId"]');
    if (hiddenDocument) hiddenDocument.value = documentButton.dataset.phase6DocumentChoice || "";
  }
}

function installInteractionGuard() {
  // Capture phase runs before Phase 6's document-level bubble handler. This makes
  // the current DOM form state reflect the user's click before Phase 6 captures
  // the draft during its rerender cycle.
  document.addEventListener("click", syncPhase6HiddenStateFromClick, true);
}

function markReady() {
  document.documentElement.dataset.tppFinalUi = "ready";
  window.dispatchEvent(new CustomEvent("tpp:final-ui-ready"));
}

function init() {
  installFinalStyles();
  installInteractionGuard();
  markReady();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
