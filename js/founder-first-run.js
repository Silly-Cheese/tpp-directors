import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const FOUNDER_UID = "QuctEgPv6laYa98bGaLasSdSERk1";
const FOUNDER_LOGIN_KEY = "1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76";
const FOUNDER_NAME = "Christopher Shelley";

const app = initializeApp(firebaseConfig, "founderFirstRun");
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.querySelector("#founder-setup-form");
const button = document.querySelector("#founder-setup-button");
const message = document.querySelector("#founder-setup-message");

function pinPassword(pin, email) {
  return `TPP|PIN|${pin}|${String(email || "").toLowerCase()}`;
}

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle("first-run-success", success);
}

function setBusy(busy, label = "Initializing…") {
  button.disabled = busy;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
  } else {
    button.textContent = button.dataset.originalLabel || "Initialize My Founder Portal";
    delete button.dataset.originalLabel;
  }
}

function validatePin(pin) {
  return /^\d{4}$/.test(pin);
}

async function existingFounderProfile() {
  try {
    const snapshot = await getDoc(doc(db, "directors", FOUNDER_UID));
    return snapshot.exists() ? snapshot.data() : null;
  } catch {
    // A missing bootstrap record is intentionally unreadable under normal rules.
    return null;
  }
}

async function createBootstrapRecords(authEmail) {
  const directorRef = doc(db, "directors", FOUNDER_UID);
  const directoryRef = doc(db, "boardDirectory", FOUNDER_UID);
  const loginRef = doc(db, "loginDirectory", FOUNDER_LOGIN_KEY);
  const counterRef = doc(db, "system", "counters");
  const batch = writeBatch(db);

  batch.set(directorRef, {
    directorNumber: "DIR-000001",
    fullName: FOUNDER_NAME,
    normalizedName: "christopher shelley",
    loginKey: FOUNDER_LOGIN_KEY,
    displayName: FOUNDER_NAME,
    boardRole: "Founder Director",
    officerRole: null,
    boardStatus: "interim",
    systemRole: "founder_director",
    root: true,
    accountStatus: "awaiting_activation",
    votingStatus: "eligible",
    termStart: null,
    termEnd: null,
    directoryVisible: true,
    permissions: ["*"],
    permissionTemplate: "founder_root",
    activationCompletedAt: null,
    createdAt: serverTimestamp(),
    createdBy: "first_run_bootstrap",
    updatedAt: serverTimestamp(),
    updatedBy: FOUNDER_UID
  });

  batch.set(directoryRef, {
    directorNumber: "DIR-000001",
    fullName: FOUNDER_NAME,
    displayName: FOUNDER_NAME,
    boardRole: "Founder Director",
    officerRole: null,
    boardStatus: "interim",
    votingStatus: "eligible",
    termStart: null,
    termEnd: null,
    directoryVisible: true,
    updatedAt: serverTimestamp()
  });

  batch.set(loginRef, {
    directorUid: FOUNDER_UID,
    authEmail,
    activationRequired: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.set(counterRef, {
    nextDirectorNumber: 2,
    updatedAt: serverTimestamp(),
    updatedBy: "first_run_bootstrap"
  });

  await batch.commit();
}

async function activateFounder() {
  const batch = writeBatch(db);
  batch.update(doc(db, "directors", FOUNDER_UID), {
    accountStatus: "active",
    activationCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: FOUNDER_UID
  });
  batch.update(doc(db, "loginDirectory", FOUNDER_LOGIN_KEY), {
    activationRequired: false,
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
}

async function recordBootstrapAudit() {
  const eventRef = doc(db, "auditEvents", `founder_bootstrap_${FOUNDER_UID}`);
  const batch = writeBatch(db);
  batch.set(eventRef, {
    actorUid: FOUNDER_UID,
    actorName: FOUNDER_NAME,
    action: "founder.first_run_bootstrap.completed",
    objectType: "director",
    objectId: FOUNDER_UID,
    reason: "Protected Founder Director account initialized through the first-run setup wizard.",
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  const pin = String(data.get("pin") || "");
  const pinConfirm = String(data.get("pinConfirm") || "");

  if (!email || !password) return setMessage("Enter the temporary Firebase email and password you used when creating the Auth user.");
  if (!validatePin(pin)) return setMessage("Choose exactly four digits for your portal PIN.");
  if (pin !== pinConfirm) return setMessage("The two PIN entries do not match.");

  setBusy(true);
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (credential.user.uid !== FOUNDER_UID) {
      await signOut(auth).catch(() => {});
      throw new Error("This Firebase account is not the protected Founder setup identity.");
    }

    const authEmail = credential.user.email || email;
    const existing = await existingFounderProfile();
    if (existing && !(existing.root === true && existing.systemRole === "founder_director")) {
      throw new Error("A conflicting Founder profile already exists. Setup stopped without changing it.");
    }
    if (!existing) {
      setMessage("Creating the protected Founder records…");
      await createBootstrapRecords(authEmail);
    }

    setMessage("Securing the account with your four-digit PIN…");
    await updatePassword(credential.user, pinPassword(pin, authEmail));
    await activateFounder();
    await recordBootstrapAudit().catch((error) => console.warn("Founder bootstrap audit write was unavailable", error));

    setMessage("Founder setup complete. Redirecting to Director Sign In…", true);
    form.reset();
    await signOut(auth);
    window.setTimeout(() => { window.location.href = "./"; }, 900);
  } catch (error) {
    console.error("Founder first-run setup failed", error);
    const code = error?.code || "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      setMessage("Firebase did not accept that temporary email/password. Check the Auth user you created and try again.");
    } else if (code === "auth/too-many-requests") {
      setMessage("Firebase temporarily limited sign-in attempts. Try again after the Auth limit clears.");
    } else if (code === "permission-denied" || code === "firestore/permission-denied") {
      setMessage("The first-run Firestore rule has not been deployed yet. Deploy the current firestore.rules, then try this setup again.");
    } else {
      setMessage(error?.message || "Founder setup could not be completed.");
    }
  } finally {
    setBusy(false);
  }
});
