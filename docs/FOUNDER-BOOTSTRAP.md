# Founder Director Bootstrap Procedure

This is the one-time production bootstrap for the protected Founder Director account. It must be performed directly in the Firebase Console for project `tpp-direc` before ordinary Board accounts can be created from the portal.

The bootstrap is intentionally not exposed as a public web action. This repository is public and GitHub Pages is a static client, so a browser-accessible root-claim secret would not be an acceptable security boundary.

## Founder identity

The protected initial identity is:

```text
Full name: Christopher Shelley
Normalized name: christopher shelley
Director number: DIR-000001
Board role: Founder Director
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

Privately choose a random 12-character activation code using uppercase letters/numbers, preferably avoiding ambiguous characters. It can be grouped for human use as:

```text
XXXX-XXXX-XXXX
```

The Firebase Authentication temporary password must be:

```text
TPP-ACT-XXXXXXXXXXXX
```

where the dashes are removed from the activation code.

Example formatting only:

```text
Portal activation code: ABCD-EFGH-JK23
Firebase temporary password: TPP-ACT-ABCDEFGHJK23
```

Do not use that example as the real credential.

## Step 2 — Create the Founder Firebase Authentication user

In Firebase Console > Authentication > Users:

1. Add a password user.
2. Use a random non-deliverable internal alias, for example the format:
   `founder-<long-random-token>@tpp-directors.invalid`
3. Use the temporary activation password from Step 1.
4. Create the user.
5. Copy the Firebase Authentication UID exactly.

The alias is an internal Firebase credential identifier. It is not Christopher Shelley's email address and will never be entered on the Board Portal login screen.

## Step 3 — Create the protected Founder director document

In Cloud Firestore create:

```text
directors/{FOUNDER_AUTH_UID}
```

with these fields:

```text
directorNumber: "DIR-000001"
fullName: "Christopher Shelley"
normalizedName: "christopher shelley"
loginKey: "1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76"
displayName: "Christopher Shelley"
boardRole: "Founder Director"
officerRole: null
systemRole: "founder_director"
root: true
accountStatus: "awaiting_activation"
votingStatus: "eligible"
termStart: null
termEnd: null
permissions: ["*"]
permissionTemplate: "founder_root"
activationCompletedAt: null
createdAt: <timestamp>
createdBy: "bootstrap"
updatedAt: <timestamp>
updatedBy: "bootstrap"
```

Use the Firebase Authentication UID as the Firestore document ID. Do not use `DIR-000001` as the document ID.

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

Do not put the activation code or the four-digit PIN in this document.

## Step 5 — Initialize the director-number counter

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

The Founder is `DIR-000001`, so the first account created from Founder Control will receive `DIR-000002`.

## Step 6 — Activate through the normal portal

At `https://directors.ask4prayers.com`:

1. Enter `Christopher Shelley`.
2. Enter the private one-time activation code from Step 1.
3. Choose and confirm the Founder four-digit PIN.
4. The portal changes the Firebase Auth backing credential and marks the Founder profile `active`.
5. The portal marks the login-directory record `activationRequired: false`.
6. Founder Control becomes available.

From that point forward the normal Founder sign-in experience is:

```text
Christopher Shelley
→ four-digit PIN
→ Founder Director Control Center
```

## Root invariants

The portal and Security Rules preserve the following design:

1. Ordinary account creation cannot create `root: true`.
2. Ordinary account creation cannot assign `systemRole: "founder_director"`.
3. The normal account-management path cannot delete the root account.
4. The normal account-management path cannot suspend, archive, demote, or overwrite the root account.
5. Root authorization is based on the authenticated Firebase UID and protected Firestore profile, never on a typed name alone.
6. The Founder root account has the wildcard permission `*`.
7. Any future exceptional root-maintenance workflow must be explicit and auditable.

## Important limitation

Because the project intentionally has no application server, Cloud Functions, or Admin SDK runtime, the portal cannot safely replace another user's Firebase Auth password from the Founder browser. Forgotten-PIN recovery therefore requires a Firebase administrative action unless the architecture is later changed to allow a secure backend.
