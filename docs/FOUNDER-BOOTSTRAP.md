# Founder Director Bootstrap Procedure

This is the one-time production bootstrap for the protected Founder Director account. It must be performed directly in the Firebase Console for project `tpp-direc` before ordinary Board accounts can be created from the portal.

The bootstrap is intentionally not exposed as a public web action. This repository is public and GitHub Pages is a static client, so a browser-accessible root-claim secret would not be an acceptable security boundary.

## Founder identity

```text
Full name: Christopher Shelley
Normalized name: christopher shelley
Director number: DIR-000001
Board role: Founder Director
Board status: interim
System role: founder_director
Root: true
Permissions: ["*"]
```

The SHA-256 login key for the normalized full name `christopher shelley` is:

```text
1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76
```

## Before bootstrap

1. Enable Firebase Authentication **Email/Password** in project `tpp-direc`.
2. Create/confirm Cloud Firestore.
3. Deploy `firestore.rules`.
4. Keep the activation code and internal Auth alias private. Do not commit them to GitHub or place them in Firestore.

## Step 1 — Choose the one-time Founder activation credential

Privately choose a random 12-character activation code using uppercase letters/numbers, preferably avoiding ambiguous characters. It can be grouped as:

```text
XXXX-XXXX-XXXX
```

The Firebase Authentication temporary password must be:

```text
TPP-ACT-XXXXXXXXXXXX
```

where the dashes are removed from the activation code.

## Step 2 — Create the Founder Firebase Authentication user

In Firebase Console > Authentication > Users:

1. Add a password user.
2. Use a random non-deliverable internal alias such as `founder-<long-random-token>@tpp-directors.invalid`.
3. Use the temporary activation password from Step 1.
4. Create the user.
5. Copy the Firebase Authentication UID exactly.

The alias is an internal credential identifier. It is not Christopher Shelley's email address and is never entered on the Board Portal login screen.

## Step 3 — Create the protected Founder director document

Create:

```text
directors/{FOUNDER_AUTH_UID}
```

with:

```text
directorNumber: "DIR-000001"
fullName: "Christopher Shelley"
normalizedName: "christopher shelley"
loginKey: "1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76"
displayName: "Christopher Shelley"
boardRole: "Founder Director"
officerRole: null
boardStatus: "interim"
systemRole: "founder_director"
root: true
accountStatus: "awaiting_activation"
votingStatus: "eligible"
termStart: null
termEnd: null
directoryVisible: true
permissions: ["*"]
permissionTemplate: "founder_root"
activationCompletedAt: null
createdAt: <timestamp>
createdBy: "bootstrap"
updatedAt: <timestamp>
updatedBy: "bootstrap"
```

Use the Firebase Authentication UID as the Firestore document ID.

## Step 4 — Create the Founder login-directory record

Create:

```text
loginDirectory/1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76
```

with:

```text
directorUid: "{FOUNDER_AUTH_UID}"
authEmail: "{THE_RANDOM_INTERNAL_ALIAS_FROM_STEP_2}"
activationRequired: true
createdAt: <timestamp>
updatedAt: <timestamp>
```

Do not put the activation code or four-digit PIN in this document.

## Step 5 — Create the Board-facing Founder directory record

Create:

```text
boardDirectory/{FOUNDER_AUTH_UID}
```

with:

```text
directorNumber: "DIR-000001"
fullName: "Christopher Shelley"
displayName: "Christopher Shelley"
boardRole: "Founder Director"
officerRole: null
boardStatus: "interim"
votingStatus: "eligible"
termStart: null
termEnd: null
directoryVisible: true
updatedAt: <timestamp>
```

This is intentionally separate from the secure `directors` record. Ordinary Board directory access never exposes the Founder login key, wildcard permission, system role, or other authentication metadata.

If this directory record is omitted during bootstrap, the Phase 3 Founder Control backfill will create the missing mirror after the Founder account is activated.

## Step 6 — Initialize the director-number counter

Create:

```text
system/counters
```

with:

```text
nextDirectorNumber: 2
updatedAt: <timestamp>
updatedBy: "bootstrap"
```

The Founder is `DIR-000001`, so the first account created from Founder Control receives `DIR-000002`.

## Step 7 — Activate through the normal portal

At `https://directors.ask4prayers.com`:

1. Enter `Christopher Shelley`.
2. Enter the private one-time activation code.
3. Choose and confirm the Founder four-digit PIN.
4. The portal changes the Firebase Auth backing credential and marks the Founder profile `active`.
5. The login-directory record becomes `activationRequired: false`.
6. Founder Control becomes available.

Normal Founder sign-in is then:

```text
Christopher Shelley
→ four-digit PIN
→ Founder Director Control Center
```

## Root invariants

1. Ordinary account creation cannot create `root: true`.
2. Ordinary account creation cannot assign `systemRole: "founder_director"`.
3. The normal account-management path cannot delete the root account.
4. The normal account-management path cannot suspend, archive, demote, or overwrite the root account.
5. Root authorization is based on the authenticated Firebase UID and protected Firestore profile, never on a typed name alone.
6. The Founder root account has wildcard permission `*`.
7. Any future exceptional root-maintenance workflow must be explicit and auditable.

## Important limitation

Because the project intentionally has no application server, Cloud Functions, or Admin SDK runtime, the portal cannot safely replace another user's Firebase Auth password directly from the Founder browser. Forgotten-PIN recovery therefore uses the console-assisted recovery workflow documented in `PHASE-2-AUTHENTICATION.md`.
