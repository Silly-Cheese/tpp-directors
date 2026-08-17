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

if (typeof window !== "undefined") {
  window.__TPP_MODULE_STATUS__ ||= {};
  const modules = [
    "./prayer-project-brand.js",
    "./founder-first-run-redirect.js",
    "./runtime-hardening.js",
    "./portal-navigation-sync.js",
    "./phase6-closing-recovery.js",
    "./phase6-guard.js",
    "./phase6-alert.js",
    "./phase6-recorded-audit.js",
    "./phase7.js",
    "./phase7-sync.js",
    "./phase7-preflight.js",
    "./phase8.js",
    "./phase8-access-guard.js",
    "./phase9.js",
    "./phase9-finalize.js",
    "./phase10.js",
    "./account-lifecycle.js",
    "./portal-theme-v3.js"
  ];

  const updateModuleStatus = (path, status, error = null) => {
    const key = path.replace(/^\.\//, "").replace(/\.js$/, "");
    window.__TPP_MODULE_STATUS__[key] = {
      status,
      error: error ? String(error?.message || error).slice(0, 500) : null,
      updatedAt: new Date().toISOString()
    };
    window.dispatchEvent(new CustomEvent("tpp:module-status", {
      detail: { module: key, ...window.__TPP_MODULE_STATUS__[key] }
    }));
  };

  (async () => {
    for (const path of modules) {
      updateModuleStatus(path, "loading");
      try {
        await import(path);
        updateModuleStatus(path, "loaded");
      } catch (error) {
        updateModuleStatus(path, "failed", error);
        console.error(`Unable to load Board Portal module ${path}`, error);
      }
    }
  })();
}
