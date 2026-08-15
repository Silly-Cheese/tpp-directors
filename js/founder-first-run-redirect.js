import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { doc, getDoc, getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const FOUNDER_LOGIN_KEY = "1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76";
const detectorApp = initializeApp(firebaseConfig, "founderFirstRunDetector");
const detectorDb = getFirestore(detectorApp);

async function routeFirstRun() {
  if (window.location.pathname.endsWith("/founder-setup.html")) return;
  try {
    const snapshot = await getDoc(doc(detectorDb, "loginDirectory", FOUNDER_LOGIN_KEY));
    if (!snapshot.exists()) {
      window.location.replace(new URL("./founder-setup.html", window.location.href).href);
    }
  } catch (error) {
    // Do not redirect on network/rules errors. The normal portal should remain
    // available so a deployment problem is visible instead of becoming a loop.
    console.warn("Founder first-run detection was unavailable", error);
  }
}

await routeFirstRun();
