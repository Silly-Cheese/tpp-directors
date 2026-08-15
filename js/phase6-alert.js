import {
  collection,
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

let profile = null;
let votesUnsub = null;
let ballotUnsub = null;
let openVote = null;
let ownBallot = null;
let initialized = false;

function installAlertStyle() {
  if (document.querySelector("#phase6-vote-alert-style")) return;
  const style = document.createElement("style");
  style.id = "phase6-vote-alert-style";
  style.textContent = `
    .phase6-vote-alert{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 1rem;padding:.9rem 1rem;border:1px solid #e8be65;border-radius:14px;background:#fff8e8;box-shadow:0 8px 24px rgba(46,36,10,.08)}
    .phase6-vote-alert[hidden]{display:none}.phase6-vote-alert>div{display:grid;gap:.12rem}.phase6-vote-alert span{font-size:.7rem;font-weight:900;letter-spacing:.1em;color:#8d5a00}.phase6-vote-alert strong{color:#392b0b}.phase6-vote-alert small{color:#745f31}.phase6-vote-alert button{border:0;border-radius:10px;padding:.7rem .85rem;background:#72500a;color:#fff;font:inherit;font-weight:800;cursor:pointer;white-space:nowrap}.phase6-vote-alert.recorded{border-color:#a9d6b7;background:#edf9f1}.phase6-vote-alert.recorded span{color:#2f7046}.phase6-vote-alert.recorded button{background:#2e6a43}@media(max-width:680px){.phase6-vote-alert{align-items:stretch;flex-direction:column}.phase6-vote-alert button{width:100%}}
  `;
  document.head.append(style);
}

function ensureAlert() {
  if (document.querySelector("#phase6-vote-alert")) return document.querySelector("#phase6-vote-alert");
  const main = document.querySelector(".portal-main");
  const topbar = document.querySelector(".portal-topbar");
  if (!main || !topbar) return null;
  const alert = document.createElement("div");
  alert.id = "phase6-vote-alert";
  alert.className = "phase6-vote-alert";
  alert.hidden = true;
  alert.innerHTML = `<div><span id="phase6-vote-alert-kicker">VOTE NOW</span><strong id="phase6-vote-alert-title">Board vote</strong><small id="phase6-vote-alert-copy"></small></div><button id="phase6-vote-alert-open" type="button">Open Meeting Room</button>`;
  topbar.after(alert);
  alert.querySelector("#phase6-vote-alert-open").addEventListener("click", () => {
    const meetingNav = document.querySelector('.nav-item[data-view="meetings"]');
    meetingNav?.click();
    requestAnimationFrame(() => document.querySelector(`[data-meeting-id="${CSS.escape(openVote?.meetingId || "")}"]`)?.click());
  });
  return alert;
}

function render() {
  const alert = ensureAlert();
  if (!alert || !openVote || !profile) {
    if (alert) alert.hidden = true;
    return;
  }
  const uid = auth.currentUser?.uid;
  const eligible = openVote.eligibleVoterUids?.includes(uid);
  const recused = openVote.recusedDirectorUids?.includes(uid);
  if (!eligible || recused) {
    alert.hidden = true;
    return;
  }

  alert.hidden = false;
  alert.classList.toggle("recorded", Boolean(ownBallot));
  alert.querySelector("#phase6-vote-alert-kicker").textContent = ownBallot ? "BALLOT RECORDED" : "VOTE NOW";
  alert.querySelector("#phase6-vote-alert-title").textContent = openVote.question || "Board vote";
  alert.querySelector("#phase6-vote-alert-copy").textContent = ownBallot
    ? "Your ballot is locked. Open the Meeting Room to follow the live vote."
    : `${openVote.voteNumber || "Live vote"} is open for your Board account.`;
}

function bindOwnBallot() {
  ballotUnsub?.();
  ballotUnsub = null;
  ownBallot = null;
  if (!openVote || !auth.currentUser) return render();
  ballotUnsub = onSnapshot(doc(db, "voteBallots", `${openVote.id}_${auth.currentUser.uid}`), (snapshot) => {
    ownBallot = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    render();
  }, () => {
    ownBallot = null;
    render();
  });
}

function bindVotes() {
  votesUnsub?.();
  votesUnsub = null;
  openVote = null;
  if (!profile || !hasPermission(profile, PERMISSIONS.VOTES_VIEW)) return render();
  votesUnsub = onSnapshot(collection(db, "votes"), (snapshot) => {
    const uid = auth.currentUser?.uid;
    const open = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((entry) => entry.status === "open" && entry.eligibleVoterUids?.includes(uid) && !entry.recusedDirectorUids?.includes(uid));
    openVote = open[0] || null;
    bindOwnBallot();
    render();
  }, (error) => {
    console.warn("Pushed-vote alert stream unavailable", error);
    openVote = null;
    render();
  });
}

async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? { uid: snapshot.id, ...snapshot.data() } : null;
}

function teardown() {
  votesUnsub?.();
  ballotUnsub?.();
  votesUnsub = ballotUnsub = null;
  profile = null;
  openVote = null;
  ownBallot = null;
  render();
}

function init() {
  if (initialized) return;
  initialized = true;
  installAlertStyle();
  onAuthStateChanged(auth, async (user) => {
    if (!user) return teardown();
    const nextProfile = await loadProfile(user.uid);
    if (!nextProfile || nextProfile.accountStatus !== "active") return teardown();
    profile = nextProfile;
    bindVotes();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
