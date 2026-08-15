import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db, provisioningAuth } from "./firebase.js";
import {
  buildActivationPassword,
  buildLoginKey,
  formatDirectorNumber,
  generateActivationCode,
  generateAuthEmail,
  normalizeFullName
} from "./identity.js";
import { hasPermission, PERMISSIONS, permissionsForTemplate } from "./permissions.js";

const MANAGEABLE_STATUSES = new Set([
  "awaiting_activation",
  "active",
  "locked",
  "suspended",
  "inactive",
  "former_director",
  "archived"
]);

function requireFounderCapability(profile, permission) {
  if (!auth.currentUser || !hasPermission(profile, permission)) {
    throw new Error("Your account is not authorized to perform this action.");
  }
}

export async function createDirectorAccount(input, founderProfile) {
  requireFounderCapability(founderProfile, PERMISSIONS.DIRECTORS_CREATE);

  const fullName = String(input.fullName ?? "").trim().replace(/\s+/g, " ");
  const normalizedName = normalizeFullName(fullName);
  if (!normalizedName) throw new Error("Enter the director's full name.");

  const loginKey = await buildLoginKey(fullName);
  const loginRef = doc(db, "loginDirectory", loginKey);
  const existingLogin = await getDoc(loginRef);
  if (existingLogin.exists()) {
    throw new Error("A Board account already uses that full name. Exact duplicate names require a separate identity workflow.");
  }

  const activationCode = generateActivationCode();
  const authEmail = generateAuthEmail();
  const activationPassword = buildActivationPassword(activationCode);
  let createdUser = null;

  try {
    const credential = await createUserWithEmailAndPassword(
      provisioningAuth,
      authEmail,
      activationPassword
    );
    createdUser = credential.user;

    const directorRef = doc(db, "directors", createdUser.uid);
    const counterRef = doc(db, "system", "counters");
    const auditRef = doc(collection(db, "auditEvents"));
    const actorUid = auth.currentUser.uid;

    let directorNumber = null;

    await runTransaction(db, async (transaction) => {
      const counterSnapshot = await transaction.get(counterRef);
      const nextNumber = counterSnapshot.exists()
        ? Math.max(2, Number(counterSnapshot.data().nextDirectorNumber) || 2)
        : 2;

      directorNumber = formatDirectorNumber(nextNumber);
      const permissions = permissionsForTemplate(input.permissionTemplate);

      transaction.set(directorRef, {
        directorNumber,
        fullName,
        normalizedName,
        loginKey,
        displayName: fullName,
        boardRole: String(input.boardRole ?? "Director").trim() || "Director",
        officerRole: String(input.officerRole ?? "").trim() || null,
        systemRole: "director",
        root: false,
        accountStatus: "awaiting_activation",
        votingStatus: input.votingStatus === "ineligible" ? "ineligible" : "eligible",
        termStart: null,
        termEnd: null,
        permissions,
        permissionTemplate: input.permissionTemplate || "standard_director",
        activationCompletedAt: null,
        createdAt: serverTimestamp(),
        createdBy: actorUid,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid
      });

      transaction.set(loginRef, {
        directorUid: createdUser.uid,
        authEmail,
        activationRequired: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.set(counterRef, {
        nextDirectorNumber: nextNumber + 1,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid
      }, { merge: true });

      transaction.set(auditRef, {
        category: "account",
        action: "director.created",
        actorUid,
        targetUid: createdUser.uid,
        createdAt: serverTimestamp(),
        details: {
          directorNumber,
          boardRole: String(input.boardRole ?? "Director").trim() || "Director",
          permissionTemplate: input.permissionTemplate || "standard_director"
        }
      });
    });

    return {
      uid: createdUser.uid,
      directorNumber,
      fullName,
      activationCode
    };
  } catch (error) {
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch (cleanupError) {
        console.error("Unable to roll back provisioned Firebase Auth user", cleanupError);
      }
    }
    throw error;
  } finally {
    try {
      await signOut(provisioningAuth);
    } catch (error) {
      console.warn("Provisioning Auth sign-out was not completed", error);
    }
  }
}

export async function listDirectorAccounts(founderProfile) {
  requireFounderCapability(founderProfile, PERMISSIONS.DIRECTORS_VIEW);
  const snapshot = await getDocs(collection(db, "directors"));
  return snapshot.docs
    .map((entry) => ({ uid: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.directorNumber ?? "").localeCompare(String(b.directorNumber ?? "")));
}

export async function updateDirectorAccess(uid, changes, founderProfile) {
  requireFounderCapability(founderProfile, PERMISSIONS.DIRECTORS_UPDATE);
  if (!uid) throw new Error("A director account is required.");

  const directorRef = doc(db, "directors", uid);
  const snapshot = await getDoc(directorRef);
  if (!snapshot.exists()) throw new Error("Director account not found.");

  const current = snapshot.data();
  if (current.root === true || current.systemRole === "founder_director") {
    throw new Error("The Founder Director root account cannot be changed through ordinary account administration.");
  }

  const nextStatus = changes.accountStatus ?? current.accountStatus;
  if (!MANAGEABLE_STATUSES.has(nextStatus)) throw new Error("Invalid account status.");

  const patch = {
    accountStatus: nextStatus,
    boardRole: String(changes.boardRole ?? current.boardRole ?? "Director").trim() || "Director",
    officerRole: String(changes.officerRole ?? current.officerRole ?? "").trim() || null,
    votingStatus: changes.votingStatus === "ineligible" ? "ineligible" : "eligible",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };

  if (changes.permissionTemplate) {
    requireFounderCapability(founderProfile, PERMISSIONS.PERMISSIONS_MANAGE);
    patch.permissionTemplate = changes.permissionTemplate;
    patch.permissions = permissionsForTemplate(changes.permissionTemplate);
  }

  const auditRef = doc(collection(db, "auditEvents"));
  const batch = writeBatch(db);
  batch.update(directorRef, patch);
  batch.set(auditRef, {
    category: "account",
    action: "director.access.updated",
    actorUid: auth.currentUser.uid,
    targetUid: uid,
    createdAt: serverTimestamp(),
    details: {
      accountStatus: patch.accountStatus,
      votingStatus: patch.votingStatus,
      permissionTemplate: patch.permissionTemplate ?? current.permissionTemplate ?? null
    }
  });
  await batch.commit();
}
