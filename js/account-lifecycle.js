import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from "./firebase.js";

let selectedUid = null;

async function founderProfile() {
  if (!auth.currentUser) return null;
  const snap = await getDoc(doc(db, "directors", auth.currentUser.uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.root === true && data.systemRole === "founder_director" ? data : null;
}

function ensurePanel() {
  const manage = document.getElementById("manage-director-panel");
  if (!manage) return null;
  let panel = document.getElementById("activation-vault-panel");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "activation-vault-panel";
  panel.innerHTML = `
    <div class="panel-heading">
      <div><p class="eyebrow">ACCOUNT RECOVERY</p><h3>Activation & duplicate recovery</h3></div>
      <button type="button" class="secondary-button" data-activation-refresh>Refresh</button>
    </div>
    <div id="activation-vault-content"><p>Choose a director account to view recovery information.</p></div>`;
  manage.append(panel);
  return panel;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

async function loadRecovery(uid) {
  selectedUid = uid || document.getElementById("manage-director-uid")?.value || null;
  const panel = ensurePanel();
  const host = document.getElementById("activation-vault-content");
  if (!panel || !host || !selectedUid) return;
  host.innerHTML = "<p>Loading recovery information…</p>";
  try {
    const founder = await founderProfile();
    if (!founder) throw new Error("Founder root access is required.");
    const [directorSnap, vaultSnap] = await Promise.all([
      getDoc(doc(db, "directors", selectedUid)),
      getDoc(doc(db, "activationVault", selectedUid))
    ]);
    if (!directorSnap.exists()) throw new Error("Director account not found.");
    const director = directorSnap.data();
    const vault = vaultSnap.exists() ? vaultSnap.data() : null;
    const pending = ["awaiting_activation", "pin_reset_required"].includes(director.accountStatus);
    const retired = director.duplicateRetired === true || director.accountStatus === "archived";

    let credential = "";
    if (pending && vault?.activationCode) {
      credential = `
        <div class="recovery-result">
          <strong>${vault.purpose === "pin_reset" ? "Current PIN recovery code" : "Current activation code"}</strong>
          <div class="activation-code-display">
            <code id="saved-activation-code">${escapeHtml(vault.activationCode)}</code>
            <button type="button" class="secondary-button" data-copy-saved-activation>Copy code</button>
          </div>
          <p>${vault.purpose === "pin_reset" ? "This recovery package is saved so you do not need to recreate the director account. If Firebase Auth has not yet been changed to the temporary password, complete that administrative step first." : "This code is saved automatically and can be copied again any time before activation. Do not create another account if the code is forgotten."}</p>
          ${vault.temporaryAuthPassword ? `<details><summary>Firebase temporary password</summary><code>${escapeHtml(vault.temporaryAuthPassword)}</code></details>` : ""}
        </div>`;
    } else if (pending) {
      credential = `
        <div class="recovery-result warning">
          <strong>No recoverable code was stored for this older account.</strong>
          <p>This account was created before automatic activation-code storage was added. Do not create more duplicates. Retire this stale record below, then create one final replacement account.</p>
        </div>`;
    } else {
      credential = `<p>This account does not currently need an activation code.</p>`;
    }

    host.innerHTML = `
      ${credential}
      ${retired ? `<p><strong>This record is already retired as a duplicate/archive.</strong></p>` : `
      <div class="danger-zone">
        <strong>Duplicate cleanup</strong>
        <p>Use this only on an accidental duplicate. It archives the portal record, hides it from the Board directory, disables its name-login record, and preserves the audit trail. It does not delete the Firebase Auth user.</p>
        <button type="button" class="duplicate-retire-button" data-retire-duplicate="${escapeHtml(selectedUid)}">Retire as Duplicate</button>
      </div>`}`;
  } catch (error) {
    host.innerHTML = `<p class="form-message">${escapeHtml(error.message || "Recovery information could not be loaded. If activationVault permission is denied, deploy the newest Firestore rules first.")}</p>`;
  }
}

async function retireDuplicate(uid) {
  const founder = await founderProfile();
  if (!founder || !auth.currentUser) throw new Error("Founder root access is required.");
  const directorRef = doc(db, "directors", uid);
  const directorSnap = await getDoc(directorRef);
  if (!directorSnap.exists()) throw new Error("Director account not found.");
  const director = directorSnap.data();
  if (director.root === true || director.systemRole === "founder_director") throw new Error("The Founder root account cannot be retired.");

  const loginRef = director.loginKey ? doc(db, "loginDirectory", director.loginKey) : null;
  const directoryRef = doc(db, "boardDirectory", uid);
  const vaultRef = doc(db, "activationVault", uid);
  const auditRef = doc(collection(db, "auditEvents"));
  const [loginSnap, directorySnap] = await Promise.all([
    loginRef ? getDoc(loginRef) : Promise.resolve(null),
    getDoc(directoryRef)
  ]);

  const batch = writeBatch(db);
  batch.update(directorRef, {
    accountStatus: "archived",
    boardStatus: "former",
    votingStatus: "ineligible",
    directoryVisible: false,
    officerRole: null,
    duplicateRetired: true,
    duplicateRetiredAt: serverTimestamp(),
    duplicateRetiredBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  if (directorySnap.exists()) {
    batch.update(directoryRef, {
      boardStatus: "former",
      votingStatus: "ineligible",
      directoryVisible: false,
      officerRole: null,
      updatedAt: serverTimestamp()
    });
  }
  if (loginRef && loginSnap?.exists()) {
    batch.update(loginRef, {
      disabled: true,
      activationRequired: false,
      retiredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  batch.set(vaultRef, {
    directorUid: uid,
    fullName: director.fullName || "Director",
    directorNumber: director.directorNumber || null,
    status: "retired",
    activationCode: null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  }, { merge: true });
  batch.set(auditRef, {
    category: "account",
    action: "director.duplicate.retired",
    actorUid: auth.currentUser.uid,
    targetUid: uid,
    createdAt: serverTimestamp(),
    details: {
      directorNumber: director.directorNumber || null,
      fullName: director.fullName || null
    }
  });
  await batch.commit();
}

function bind() {
  ensurePanel();
  document.addEventListener("click", async (event) => {
    const manage = event.target.closest?.("[data-manage-uid]");
    if (manage) {
      const uid = manage.dataset.manageUid;
      setTimeout(() => loadRecovery(uid), 0);
      return;
    }
    if (event.target.closest?.("[data-activation-refresh]")) {
      await loadRecovery(selectedUid);
      return;
    }
    if (event.target.closest?.("[data-copy-saved-activation]")) {
      const value = document.getElementById("saved-activation-code")?.textContent || "";
      if (!value) return;
      await navigator.clipboard.writeText(value);
      event.target.textContent = "Copied";
      setTimeout(() => { event.target.textContent = "Copy code"; }, 1200);
      return;
    }
    const retire = event.target.closest?.("[data-retire-duplicate]");
    if (retire) {
      const uid = retire.dataset.retireDuplicate;
      if (!window.confirm("Retire this accidental duplicate? It will disappear from normal Board use and its name-login record will be disabled. This cannot be undone from the normal portal.")) return;
      retire.disabled = true;
      retire.textContent = "Retiring…";
      try {
        await retireDuplicate(uid);
        alert("Duplicate retired. You can now create a clean replacement account if needed.");
        window.location.reload();
      } catch (error) {
        retire.disabled = false;
        retire.textContent = "Retire as Duplicate";
        const host = document.getElementById("activation-vault-content");
        if (host) host.insertAdjacentHTML("beforeend", `<p class="form-message">${escapeHtml(error.message || "Duplicate could not be retired.")}</p>`);
      }
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
else bind();
