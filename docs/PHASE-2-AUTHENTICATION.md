# Phase 2 Authentication, Accounts & Permissions

Phase 2 implements Founder-controlled Board accounts using Firebase Authentication and Cloud Firestore only. The production client remains a static GitHub Pages application.

## Status

**Phase 2 code generation is complete.** Production Firebase/Auth/rules verification still requires the external console configuration described in `DEPLOYMENT.md` and `FOUNDER-BOOTSTRAP.md`.

## Director experience

Ordinary directors do not enter an email address, username, or conventional password.

### First use

1. Founder Director creates the Board account.
2. The portal generates a one-time activation code and displays it once to the Founder.
3. The director enters their full name.
4. The portal prompts for the activation code.
5. After successful Firebase Authentication, the director chooses a four-digit PIN.
6. The Firebase Auth backing credential is changed and Firestore marks the account active.

### Normal sign-in

```text
Full Name
→ 4-digit PIN
→ Board Portal
```

Firebase Authentication establishes the session. Firestore Security Rules authorize portal access using the immutable Firebase Auth UID and the protected director profile.

## Internal Auth aliases

Firebase Email/Password Authentication is used only as the underlying credential provider because the project has no application server or Cloud Functions.

Each account receives a random non-deliverable internal Auth alias such as:

```text
dir-<random>@tpp-directors.invalid
```

That alias is not the director's email address and is never used as the human-facing login identifier.

## Full-name lookup

The normalized full name is SHA-256 hashed in the browser and becomes the document ID for:

```text
loginDirectory/{loginKey}
```

The login-directory record contains the minimum data required to connect the name flow to Firebase Authentication:

```text
directorUid
authEmail
activationRequired
createdAt
updatedAt
activatedAt
```

An unauthenticated client may `get` one exact login-directory record. Collection listing is denied. Exact duplicate normalized full names are rejected during account creation because the requested login page uses only full name as its visible identifier.

## PIN handling

The raw four-digit PIN is never written to Firestore.

The PIN is converted in memory into an account-specific Firebase password value. Firebase Authentication stores/verifies the actual credential. Firestore stores only account and governance metadata.

A four-digit PIN has limited entropy, so the portal uses Firebase Authentication's service-side throttling behavior and generic login errors. A JavaScript-only lockout is not treated as a security boundary.

## Founder account provisioning

The portal uses a second Firebase app/Auth instance named `accountProvisioner` with in-memory persistence.

Creating a Firebase password user signs that Auth instance in as the new user, so isolating provisioning prevents a newly created director account from replacing the Founder Director's primary portal session.

After Auth creation, one Firestore transaction:

- allocates the next `DIR-######`;
- creates `directors/{newUid}`;
- creates `boardDirectory/{newUid}` beginning in Phase 3;
- creates `loginDirectory/{loginKey}`;
- advances the director-number counter;
- records an account-creation audit event.

If the Firestore transaction fails immediately after Auth creation, the provisioning client attempts to delete the newly created Auth user.

## Founder root invariants

The Founder Director remains a separately bootstrapped root identity:

```text
systemRole: "founder_director"
root: true
permissions: ["*"]
```

Ordinary account administration cannot create a second root account, promote another account to Founder Director, delete the root account, or demote/suspend/archive it through the normal account-management UI.

## Permission model

Portal capabilities are stored as strings rather than being inferred only from titles.

Examples include:

```text
directors.view
directors.create
directors.update
directors.suspend
permissions.manage
announcements.manage
meetings.view
meetings.create
meetings.activate
meetings.attendance.manage
votes.cast
votes.push
votes.close
documents.view
documents.submit
documents.review
resolutions.view
resolutions.create
minutes.view
minutes.edit
audit.view
```

The Founder root implicitly has every capability. Templates are starting points only; Founder Control supports granular per-director permission selection.

## Account states

Phase 2 supports:

- `awaiting_activation`
- `active`
- `pin_reset_required`
- `locked`
- `suspended`
- `inactive`
- `former_director`
- `archived`

The signed-in profile is watched live. If an active director is changed to a non-active portal account state, their current portal session is removed from the application UI.

## Self-service PIN change

A signed-in director can change their own four-digit PIN from the dashboard. Firebase may require a recent authentication session; when that happens the portal instructs the director to sign out and sign back in with the current PIN before retrying.

## Interrupted first-time activation

The Auth password change and the Firestore activation-state update cannot be one atomic cross-product transaction.

If the PIN credential was successfully changed but the Firestore activation-finalization step was interrupted, the login screen includes an **I already created my PIN** recovery path. A successful PIN sign-in can complete the remaining Firestore activation state without asking the user to recover through an insecure workaround.

## Forgotten PIN recovery

A static Founder browser cannot safely replace another user's Firebase Authentication password because privileged user-management APIs require a secure administrative environment.

Founder Control therefore provides **Prepare PIN Recovery** for an ordinary director. It:

1. marks the account `pin_reset_required`;
2. returns the internal Auth alias;
3. generates a new one-time activation code;
4. displays the corresponding temporary Firebase Auth backing password;
5. records the recovery preparation in the audit log.

The Founder must then perform the actual privileged Auth-password change through an authorized Firebase administrative workflow. Only the activation code is given to the director. The director signs in with that code and creates a new four-digit PIN.

The portal never stores the recovery activation code or the user's PIN in Firestore.

## No manual/composite indexes

This project does not define or deploy manual/composite Firestore indexes.

Phase 2 operations use direct document reads, plain Founder-only collection reads, a single counter transaction, and client-side sorting.

`firestore.indexes.json` is intentionally absent and `firebase.json` deploys Firestore Security Rules only.

## QA

The repository includes `tests/phase2-phase3.html`, a browser-run pure-function QA harness covering identity normalization, deterministic login keys, activation formatting, PIN validation/backing-password behavior, director numbering, permission templates, and Phase 3 Board-summary calculations.
