import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const signedOutView = document.querySelector("#signed-out-view");
const signedInView = document.querySelector("#signed-in-view");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const signOutButton = document.querySelector("#sign-out-button");
const accountRole = document.querySelector("#account-role");
const founderOnlyElements = document.querySelectorAll(".founder-only");

function showSignedOut() {
  signedOutView.hidden = false;
  signedInView.hidden = true;
}

function showSignedIn(profile = {}) {
  signedOutView.hidden = true;
  signedInView.hidden = false;

  const label = profile.displayRole || profile.boardRole || "Director";
  accountRole.textContent = label;

  const isFounderDirector = profile.systemRole === "founder_director" || profile.root === true;
  founderOnlyElements.forEach((element) => {
    element.hidden = !isFounderDirector;
  });
}

async function loadDirectorProfile(uid) {
  const snapshot = await getDoc(doc(db, "directors", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fullName = new FormData(loginForm).get("fullName")?.trim();

  if (!fullName) {
    loginMessage.textContent = "Enter your full name to continue.";
    return;
  }

  loginMessage.textContent = "Director account activation and 4-digit PIN sign-in will be enabled in Phase 2.";
});

signOutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showSignedOut();
    return;
  }

  try {
    const profile = await loadDirectorProfile(user.uid);
    if (!profile || profile.accountStatus === "suspended" || profile.accountStatus === "archived") {
      await signOut(auth);
      showSignedOut();
      loginMessage.textContent = "This Board account is not available for portal access.";
      return;
    }

    showSignedIn(profile);
  } catch (error) {
    console.error("Unable to load director profile", error);
    showSignedOut();
    loginMessage.textContent = "The portal could not load your Board profile.";
  }
});
