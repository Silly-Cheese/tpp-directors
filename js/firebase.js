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
