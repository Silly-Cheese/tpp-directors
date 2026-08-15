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

export const provisioningApp = initializeApp(firebaseConfig, "accountProvisioner");
export const provisioningAuth = getAuth(provisioningApp);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Unable to configure primary authentication persistence", error);
});

setPersistence(provisioningAuth, inMemoryPersistence).catch((error) => {
  console.error("Unable to configure provisioning authentication persistence", error);
});

// GitHub Pages remains build-free. Governance modules are loaded in dependency order
// from the shared Firebase entry path used by the single app.js script tag.
if (typeof window !== "undefined") {
  Promise.resolve()
    .then(() => import("./phase5.js"))
    .then(() => import("./phase5-polish.js"))
    .then(() => import("./phase6.js"))
    .then(() => import("./phase6-closing-recovery.js"))
    .then(() => import("./phase6-guard.js"))
    .then(() => import("./phase6-alert.js"))
    .then(() => import("./phase6-recorded-audit.js"))
    .then(() => import("./phase7.js"))
    .then(() => import("./phase7-sync.js"))
    .then(() => import("./phase7-preflight.js"))
    .then(() => import("./phase8.js"))
    .catch((error) => console.error("Unable to load Board governance modules", error));
}
