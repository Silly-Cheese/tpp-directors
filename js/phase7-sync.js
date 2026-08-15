import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth } from "./firebase.js";

let lastId = null;
let observer = null;

function selectedMeetingId() {
  return document.querySelector(".meeting-card.selected")?.dataset.meetingId || null;
}

function sync(force = false) {
  const id = selectedMeetingId();
  if (!id || (!force && id === lastId)) return;
  lastId = id;
  window.dispatchEvent(new CustomEvent("tpp:meeting-selected", { detail: { meetingId: id } }));
}

function start() {
  observer?.disconnect();
  observer = new MutationObserver(() => sync(false));
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  queueMicrotask(() => sync(true));
}

window.addEventListener("tpp:phase7-ready", () => sync(true));
onAuthStateChanged(auth, (user) => {
  if (!user) {
    lastId = null;
    observer?.disconnect();
    observer = null;
    return;
  }
  start();
});
