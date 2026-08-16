let initialized = false;
let observedHost = null;
let hostObserver = null;
let restoreFrame = null;
let selectedMeetingId = null;

const draft = {
  itemType: "business",
  documentId: "",
  title: "",
  description: ""
};

function installStylesheet() {
  if (document.querySelector('link[data-phase6-prayer-theme]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./phase6-prayer-theme.css";
  link.dataset.phase6PrayerTheme = "true";
  document.head.append(link);
}

function resetDraft() {
  draft.itemType = "business";
  draft.documentId = "";
  draft.title = "";
  draft.description = "";
}

function captureForm(form) {
  if (!form) return;
  const type = form.elements.namedItem("itemType");
  const documentId = form.elements.namedItem("documentId");
  const title = form.elements.namedItem("title");
  const description = form.elements.namedItem("description");
  if (type) draft.itemType = String(type.value || "business");
  if (documentId) draft.documentId = String(documentId.value || "");
  if (title) draft.title = String(title.value || "");
  if (description) draft.description = String(description.value || "");
}

function restoreForm() {
  restoreFrame = null;
  const form = document.querySelector("#phase6-agenda-form");
  if (!form) return;

  const type = form.elements.namedItem("itemType");
  const documentId = form.elements.namedItem("documentId");
  const title = form.elements.namedItem("title");
  const description = form.elements.namedItem("description");

  if (type && [...type.options].some((option) => option.value === draft.itemType)) type.value = draft.itemType;
  if (documentId && [...documentId.options].some((option) => option.value === draft.documentId)) documentId.value = draft.documentId;
  if (title && title.value !== draft.title) title.value = draft.title;
  if (description && description.value !== draft.description) description.value = draft.description;
}

function queueRestore() {
  if (restoreFrame !== null) return;
  restoreFrame = requestAnimationFrame(restoreForm);
}

function bindHost() {
  const host = document.querySelector("#phase6-meeting-workspace");
  if (host === observedHost) return;
  hostObserver?.disconnect();
  hostObserver = null;
  observedHost = host;
  if (!host) return;
  hostObserver = new MutationObserver(queueRestore);
  hostObserver.observe(host, { childList: true, subtree: true });
  queueRestore();
}

function init() {
  if (initialized) return;
  initialized = true;
  installStylesheet();

  document.addEventListener("input", (event) => {
    const form = event.target.closest?.("#phase6-agenda-form");
    if (form) captureForm(form);
  }, true);

  document.addEventListener("change", (event) => {
    const form = event.target.closest?.("#phase6-agenda-form");
    if (form) captureForm(form);
  }, true);

  document.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-phase6-action]")?.dataset.phase6Action;
    if (action === "open-agenda-form") {
      resetDraft();
      queueMicrotask(queueRestore);
    } else if (action === "close-agenda-form") {
      resetDraft();
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target?.id === "phase6-agenda-form") captureForm(event.target);
  }, true);

  window.addEventListener("tpp:meeting-selected", (event) => {
    const nextMeetingId = event.detail?.meetingId || null;
    if (nextMeetingId !== selectedMeetingId) {
      selectedMeetingId = nextMeetingId;
      resetDraft();
    }
    queueMicrotask(() => {
      bindHost();
      queueRestore();
    });
  });

  window.addEventListener("tpp:module-status", (event) => {
    if (event.detail?.module === "phase6" && event.detail?.status === "loaded") {
      bindHost();
      queueRestore();
    }
  });

  const bodyObserver = new MutationObserver(() => {
    if (document.querySelector("#phase6-meeting-workspace") !== observedHost) bindHost();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  bindHost();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
