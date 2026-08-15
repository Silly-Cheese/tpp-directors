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
