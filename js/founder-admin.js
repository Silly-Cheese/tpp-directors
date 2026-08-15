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
import { boardDirectoryRecord, normalizeBoardStatus } from "./board-data.js";
import { hasPermission, PERMISSIONS, permissionsForTemplate } from "./permissions.js";

const MANAGEABLE_STATUSES = new Set([
  "awaiting_activation",
  "active",
  "pin_reset_required",
  "locked",
  "suspended",
  "inactive",
  "former_director",
  "archived"
]);
const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS));

function requireFounderCapability(profile, permission) {
  if (!auth.currentUser || !hasPermission(profile, permission)) {
    throw new Error("Your account is not authorized to perform this action.");
  }
}

function requireFounderRoot(profile) {
  if (!auth.currentUser || profile?.root !== true || profile?.systemRole !== "founder_director") {
    throw new Error("This action is restricted to the Founder Director root account.");
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
    const directoryRef = doc(db, "boardDirectory", createdUser.uid);
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
      const directorProfile = {
        directorNumber,
        fullName,
        normalizedName,
        loginKey,
        displayName: fullName,
        boardRole: String(input.boardRole ?? "Director").trim() || "Director",
        officerRole: String(input.officerRole ?? "").trim() || null,
        boardStatus: normalizeBoardStatus(input.boardStatus || "interim"),
        systemRole: "director",
        root: false,
        accountStatus: "awaiting_activation",
        votingStatus: input.votingStatus === "ineligible" ? "ineligible" : "eligible",
        termStart: input.termStart || null,
        termEnd: input.termEnd || null,
        directoryVisible: true,
        permissions,
        permissionTemplate: input.permissionTemplate || "standard_director",
        activationCompletedAt: null,
        createdAt: serverTimestamp(),
        createdBy: actorUid,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid
      };

      transaction.set(directorRef, directorProfile);
      transaction.set(directoryRef, boardDirectoryRecord(directorProfile));
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
          boardRole: directorProfile.boardRole,
          boardStatus: directorProfile.boardStatus,
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
  requireFounderRoot(founderProfile);
  const snapshot = await getDocs(collection(db, "directors"));
  return snapshot.docs
    .map((entry) => ({ uid: entry.id, ...entry.data() }))
    .sort((a, b) => String(a.directorNumber ?? "").localeCompare(String(b.directorNumber ?? "")));
}

export async function backfillBoardDirectory(founderProfile) {
  requireFounderRoot(founderProfile);
  const [directorSnapshot, directorySnapshot] = await Promise.all([
    getDocs(collection(db, "directors")),
    getDocs(collection(db, "boardDirectory"))
  ]);
  const existing = new Set(directorySnapshot.docs.map((entry) => entry.id));
  const missing = directorSnapshot.docs.filter((entry) => !existing.has(entry.id));
  if (!missing.length) return 0;
  if (missing.length > 450) throw new Error("Board directory backfill is too large for one browser batch.");

  const batch = writeBatch(db);
  missing.forEach((entry) => {
    batch.set(doc(db, "boardDirectory", entry.id), boardDirectoryRecord(entry.data()));
  });
  await batch.commit();
  return missing.length;
}

export async function updateDirectorAccess(uid, changes, founderProfile) {
  requireFounderRoot(founderProfile);
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

  const nextVotingStatus = changes.votingStatus ?? current.votingStatus ?? "eligible";
  if (!["eligible", "ineligible"].includes(nextVotingStatus)) throw new Error("Invalid voting status.");

  const patch = {
    accountStatus: nextStatus,
    boardRole: String(changes.boardRole ?? current.boardRole ?? "Director").trim() || "Director",
    officerRole: String(changes.officerRole ?? current.officerRole ?? "").trim() || null,
    boardStatus: normalizeBoardStatus(changes.boardStatus ?? current.boardStatus),
    votingStatus: nextVotingStatus,
    termStart: changes.termStart ?? current.termStart ?? null,
    termEnd: changes.termEnd ?? current.termEnd ?? null,
    directoryVisible: changes.directoryVisible ?? current.directoryVisible ?? true,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  };

  if (Array.isArray(changes.permissions)) {
    requireFounderCapability(founderProfile, PERMISSIONS.PERMISSIONS_MANAGE);
    const permissions = [...new Set(changes.permissions)].filter((permission) => VALID_PERMISSIONS.has(permission));
    patch.permissions = permissions;
    patch.permissionTemplate = "custom";
  } else if (changes.permissionTemplate) {
    requireFounderCapability(founderProfile, PERMISSIONS.PERMISSIONS_MANAGE);
    patch.permissionTemplate = changes.permissionTemplate;
    patch.permissions = permissionsForTemplate(changes.permissionTemplate);
  }

  const auditRef = doc(collection(db, "auditEvents"));
  const directoryRef = doc(db, "boardDirectory", uid);
  const batch = writeBatch(db);
  batch.update(directorRef, patch);
  batch.set(directoryRef, boardDirectoryRecord({ ...current, ...patch }), { merge: true });
  batch.set(auditRef, {
    category: "account",
    action: "director.access.updated",
    actorUid: auth.currentUser.uid,
    targetUid: uid,
    createdAt: serverTimestamp(),
    details: {
      accountStatus: patch.accountStatus,
      boardStatus: patch.boardStatus,
      votingStatus: patch.votingStatus,
      permissionTemplate: patch.permissionTemplate ?? current.permissionTemplate ?? null,
      permissionCount: patch.permissions?.length ?? current.permissions?.length ?? 0
    }
  });
  await batch.commit();
}

export async function prepareDirectorPinReset(uid, founderProfile) {
  requireFounderRoot(founderProfile);
  if (!uid) throw new Error("A director account is required.");

  const directorRef = doc(db, "directors", uid);
  const directorSnapshot = await getDoc(directorRef);
  if (!directorSnapshot.exists()) throw new Error("Director account not found.");
  const director = directorSnapshot.data();
  if (director.root === true || director.systemRole === "founder_director") {
    throw new Error("Root PIN recovery must be handled directly through the documented Founder bootstrap recovery process.");
  }

  const loginRef = doc(db, "loginDirectory", director.loginKey);
  const loginSnapshot = await getDoc(loginRef);
  if (!loginSnapshot.exists()) throw new Error("The director login record is unavailable.");

  const activationCode = generateActivationCode();
  const temporaryAuthPassword = buildActivationPassword(activationCode);
  const login = loginSnapshot.data();
  const auditRef = doc(collection(db, "auditEvents"));
  const batch = writeBatch(db);

  batch.update(directorRef, {
    accountStatus: "pin_reset_required",
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid
  });
  batch.update(loginRef, {
    activationRequired: true,
    pinResetPreparedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  batch.set(auditRef, {
    category: "account",
    action: "director.pin_reset.prepared",
    actorUid: auth.currentUser.uid,
    targetUid: uid,
    createdAt: serverTimestamp(),
    details: { directorNumber: director.directorNumber || null }
  });
  await batch.commit();

  return {
    fullName: director.fullName,
    directorNumber: director.directorNumber,
    authEmail: login.authEmail,
    activationCode,
    temporaryAuthPassword
  };
}
