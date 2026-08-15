import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Founder-created Auth users are provisioned through an isolated secondary app.
// Creating a user signs that Auth instance in as the new user, so using a separate
// in-memory instance prevents the Founder Director's primary portal session from
// being replaced during account creation.
export const provisioningApp = initializeApp(firebaseConfig, "accountProvisioner");
export const provisioningAuth = getAuth(provisioningApp);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Unable to configure primary authentication persistence", error);
});

setPersistence(provisioningAuth, inMemoryPersistence).catch((error) => {
  console.error("Unable to configure provisioning authentication persistence", error);
});

// The static site has a single app.js script tag. Governance feature modules are
// loaded from this shared Firebase entry path so Phases 5+ execute on GitHub Pages
// without requiring a build step or additional HTML script tags.
if (typeof window !== "undefined") {
  Promise.resolve()
    .then(() => import("./phase5.js"))
    .then(() => import("./phase5-polish.js"))
    .then(() => import("./phase6.js"))
    .then(() => import("./phase6-guard.js"))
    .then(() => import("./phase6-alert.js"))
    .catch((error) => console.error("Unable to load Board governance modules", error));
}
