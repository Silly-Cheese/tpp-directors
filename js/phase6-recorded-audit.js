import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

let profile = null;
let votes = new Map();
let votesUnsub = null;
let observer = null;
let refreshQueued = false;
let initialized = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function humanize(value = "") {
  return String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function correctCard(card) {
  const number = card.querySelector(".phase6-vote-head span")?.textContent?.trim();
  if (!number) return;
  const vote = votes.get(number);
  if (!vote || vote.status !== "closed" || vote.ballotVisibility !== "recorded") return;

  const existing = card.querySelector(".phase6-recorded-ballots");
  if (existing?.dataset.correctVoteId === vote.id) return;

  const audit = existing || document.createElement("div");
  audit.className = "phase6-recorded-ballots";
  audit.dataset.correctVoteId = vote.id;
  audit.innerHTML = '<span>Loading recorded ballot audit…</span>';
  if (!existing) {
    const totals = card.querySelector(".phase6-vote-totals");
    totals?.after(audit);
  }

  try {
    const snapshot = await getDocs(query(collection(db, "voteBallots"), where("voteId", "==", vote.id)));
    const ballots = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => String(a.voterName || "").localeCompare(String(b.voterName || "")));
    audit.innerHTML = ballots.length
      ? ballots.map((entry) => `<span>${escapeHtml(entry.voterName || "Director")} — <strong>${escapeHtml(humanize(entry.choice))}</strong></span>`).join("")
      : '<span>No ballots were cast.</span>';
  } catch (error) {
    console.warn("Recorded-ballot audit could not be loaded", error);
    audit.innerHTML = '<span>Recorded ballot details are not available to this account.</span>';
  }
}

function refreshCards() {
  refreshQueued = false;
  if (!profile || !hasPermission(profile, PERMISSIONS.VOTES_VIEW)) return;
  document.querySelectorAll(".phase6-vote-card.closed").forEach((card) => { correctCard(card); });
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshCards);
}

function bindVotes() {
  votesUnsub?.();
  votesUnsub = null;
  votes.clear();
  if (!profile || !hasPermission(profile, PERMISSIONS.VOTES_VIEW)) return;
  votesUnsub = onSnapshot(collection(db, "votes"), (snapshot) => {
    votes = new Map(snapshot.docs.map((entry) => {
      const value = { id: entry.id, ...entry.data() };
      return [value.voteNumber, value];
    }));
    queueRefresh();
  }, (error) => console.warn("Recorded ballot audit vote stream unavailable", error));
}

function startObserver() {
  observer?.disconnect();
  observer = new MutationObserver(queueRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  queueRefresh();
}

async function loadProfile(uid) {
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js");
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

function teardown() {
  votesUnsub?.();
  observer?.disconnect();
  votesUnsub = observer = null;
  votes.clear();
  profile = null;
}

function init() {
  if (initialized) return;
  initialized = true;
  onAuthStateChanged(auth, async (user) => {
    if (!user) return teardown();
    const next = await loadProfile(user.uid);
    if (!next || next.accountStatus !== "active") return teardown();
    profile = next;
    bindVotes();
    startObserver();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
