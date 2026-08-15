# Phase 3 — Director Dashboard & Board Directory

Phase 3 turns the authenticated shell into a usable Board workspace while preserving the project's static GitHub Pages architecture, Firebase Authentication + Cloud Firestore-only constraint, and no-manual/composite-index rule.

## Phase 3 capabilities

### Director dashboard

Every active director receives a governance overview containing:

- current Board-member count;
- confirmed-director count;
- interim-director count;
- the director's portal account status and director number;
- Board role and officer role;
- Board confirmation/status state;
- voting eligibility;
- Board term dates;
- the director's currently assigned portal capabilities;
- active Board notices;
- self-service PIN change for a recently authenticated account;
- clear placeholders for the document, meeting, and voting phases that follow.

### Board directory

Directors with `directors.view` can open the Board Directory and:

- view current Board members;
- search by name, role, officer title, or director number;
- filter by current, confirmed, interim, leave-of-absence, or former status;
- view director profile cards;
- open a detailed Board-facing profile;
- see Board role, officer role, confirmation/status, voting eligibility, and term dates.

Filtering and sorting happen in the browser. No composite Firestore indexes are used.

## Sensitive-account separation

The private `directors/{uid}` records contain account-security and authorization fields such as:

- `loginKey`;
- permission arrays;
- account status;
- system role;
- root status;
- audit-related metadata.

Those records are not used as the ordinary Board directory.

Phase 3 introduces:

```text
boardDirectory/{authUid}
```

with Board-facing fields only:

```text
directorNumber
fullName
displayName
boardRole
officerRole
boardStatus
votingStatus
termStart
termEnd
directoryVisible
updatedAt
```

This means ordinary directors can list the Board without receiving authentication aliases, login keys, permission arrays, or sensitive account administration fields.

## Board statuses

Phase 3 supports these Board-facing statuses:

- `interim`
- `confirmed`
- `leave_of_absence`
- `former`

The initial/default status for newly created directors is `interim`, which matches the planned initial Board-confirmation workflow.

Account status and Board status are intentionally separate. For example, a person can be a confirmed director while their portal login is temporarily suspended, or a former director record can remain historically preserved after portal access is disabled.

## Founder Director administration

Founder Control now manages both the secure account record and the Board-facing directory record.

The Founder can set:

- Board role;
- officer role;
- Board status;
- voting eligibility;
- term start and end dates;
- directory visibility;
- portal account status;
- individual portal permissions.

New accounts create both `directors/{uid}` and `boardDirectory/{uid}` in the same Firestore transaction.

For Phase 2 accounts that existed before the directory was introduced, Founder Control performs a missing-record backfill. The backfill does not create manual indexes and does not alter authentication credentials.

## Board notices

Phase 3 opens the previously reserved `announcements` collection for active Board members.

A Board notice contains:

```text
title
body
priority        // normal | important | urgent
status          // published | archived
expiresOn       // optional YYYY-MM-DD
publishedAt
createdAt
createdBy
updatedAt
updatedBy
```

Active directors can read published notices. Notice lists are filtered and sorted client-side so no composite index is required.

Founder Control can publish and archive notices. The capability string `announcements.manage` also exists in the permission model for future delegated administration.

## Phase 2 completion carried into Phase 3

The Phase 3 generation also closes several Phase 2 implementation gaps:

- self-service PIN change for a signed-in director;
- a recovery choice for an activation that was interrupted after the PIN credential was already changed;
- `pin_reset_required` as a first-class account activation state;
- Founder preparation of a forgotten-PIN recovery package;
- a documented console-assisted Auth-password step for forgotten PINs under the no-backend constraint;
- browser-based pure-function QA tests under `tests/`.

The portal still never stores a raw PIN in Firestore.

## Forgotten-PIN limitation

Because this project deliberately has no application server, Cloud Functions, or Admin SDK runtime, a Founder browser cannot securely replace another user's Firebase Authentication password.

The portal can prepare a recovery package containing:

- the internal Firebase Auth alias;
- a new one-time activation code;
- the corresponding temporary Firebase Auth backing password.

The Founder must perform the actual privileged Auth-password change through an authorized Firebase administrative workflow. The director receives only the activation code and then chooses a new four-digit PIN in the portal.

## No manual/composite indexes

Phase 3 uses only:

- direct document reads;
- plain collection reads;
- client-side search/filter/sort;
- Firestore batches/transactions for synchronized record updates.

`firestore.indexes.json` remains absent. `firebase.json` deploys Security Rules only.

## Phase 3 handoff

Phase 4 can now build the Google-link-only Board Document Center and Board Inbox on top of:

- authenticated director identities;
- Founder-controlled permissions;
- Board-facing director profiles;
- dashboard notices;
- synchronized Board status/term records;
- the existing deny-by-default governance security posture.
