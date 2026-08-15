# Founder Director Bootstrap Contract

This document defines the one-time bootstrap requirements for the protected Founder Director account. The credential implementation itself is Phase 2 because it must be implemented together with the portal's final Authentication/PIN flow.

## Bootstrap goal

The first operational identity in the portal is the Founder Director. It is not created by another portal user and is not promoted from an ordinary director account.

After bootstrap, all ordinary Board accounts are created or authorized through Founder-controlled administration.

## Required Founder profile

The Firebase Authentication UID for the Founder account must be used as the Firestore document ID:

`directors/{FOUNDER_AUTH_UID}`

The initial Firestore profile must include at least:

```text
fullName: "Christopher Shelley"
displayName: "Christopher Shelley"
normalizedName: "christopher shelley"
directorNumber: "DIR-000001"
boardRole: "Founder Director"
officerRole: null
systemRole: "founder_director"
root: true
accountStatus: "active"
votingStatus: "eligible"
permissions: ["*"]
createdBy: "bootstrap"
updatedBy: "bootstrap"
```

`createdAt` and `updatedAt` should be server timestamps when the record is initialized.

## Invariants

Later security rules and administrative screens must enforce these rules:

1. There is only one active `root: true` Founder Director identity unless the governance architecture is intentionally redesigned.
2. An ordinary director cannot grant themselves `root` or `systemRole: "founder_director"`.
3. The Founder account cannot be deleted through the normal director-account UI.
4. The Founder account cannot be suspended, archived, or demoted through the normal director-account UI.
5. Permission assignment cannot remove the root account's system-management capability.
6. Any exceptional root-account maintenance must be explicit and auditable.
7. Firebase Authentication UID, not name, is the authorization identity.

## Why the account is not created in Phase 1 client code

The repository is public and hosted as a static GitHub Pages application. A secret bootstrap credential embedded in client JavaScript would not be secret. Phase 1 therefore establishes the protected identity model without shipping an insecure public bootstrap endpoint.

Phase 2 must implement the actual Authentication and PIN architecture before the Founder credential is created for production use.

## Phase 2 handoff

Phase 2 is responsible for:

- selecting and implementing the Firebase Authentication backing credential for the Full Name + PIN experience;
- establishing the Founder Authentication identity;
- writing the protected Founder profile;
- Founder-created ordinary accounts;
- first-use account activation;
- PIN setup/reset;
- lockout/rate-limit behavior available within the chosen architecture;
- granular permission storage and enforcement;
- session handling and account-status enforcement.

No design should store a director's raw PIN in Firestore.
