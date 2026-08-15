import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { db } from "./firebase.js";

const FOUNDER_LOGIN_KEY = "1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76";

async function routeFirstRun() {
  if (window.location.pathname.endsWith("/founder-setup.html")) return;
  try {
    const snapshot = await getDoc(doc(db, "loginDirectory", FOUNDER_LOGIN_KEY));
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
