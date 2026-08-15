# Phase 3 — Director Dashboard & Board Directory

Phase 3 turns the authenticated shell into a usable Board workspace while preserving the static GitHub Pages architecture, Firebase Authentication + Cloud Firestore-only constraint, and no-manual/composite-index rule.

**Phase 3 is complete.** Phase 4 subsequently hardened two Phase 3 read paths described below without changing the Phase 3 product model.

## Director dashboard

Every active director receives a governance overview containing:

- current Board-member count;
- confirmed-director count;
- the director's portal account status and director number;
- Board role and officer role;
- Board confirmation/status state;
- voting eligibility;
- Board term dates;
- currently assigned portal capabilities;
- active Board notices;
- self-service PIN change;
- integrated recent-document information after Phase 4.

## Board directory

Directors with `directors.view` can:

- view current Board members;
- search by name, role, officer title, or director number;
- filter by current, confirmed, interim, leave-of-absence, or former status;
- view director profile cards;
- open a detailed Board-facing profile;
- see Board role, officer role, status, voting eligibility, and term dates.

### Directory visibility is enforced by Firestore

The `directoryVisible` field is not merely a UI preference.

For ordinary directors, Firestore Security Rules permit reads only when:

```text
directoryVisible == true
```

The client uses a matching single-field query. This closes the earlier Phase 3 edge case where a hidden profile could have been omitted from the screen while remaining readable through a direct Firestore request.

Founder root access may inspect hidden Board-directory records for administration.

No composite index is needed for `directoryVisible == true`.

## Sensitive-account separation

The private `directors/{uid}` records contain account-security/authorization fields such as:

- `loginKey`;
- permission arrays;
- account status;
- system role;
- root status;
- audit-related metadata.

Ordinary Board directory access never lists those records.

Phase 3 uses:

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

## Board statuses

Supported Board-facing states:

- `interim`
- `confirmed`
- `leave_of_absence`
- `former`

The initial/default state for newly created directors is `interim`.

Board status and portal account status remain intentionally separate. Historical Board status should not be erased simply because portal access changes.

## Founder Director administration

Founder Control manages both the secure account record and Board-facing directory mirror.

The Founder can set:

- Board role;
- officer role;
- Board status;
- voting eligibility;
- term start/end dates;
- directory visibility;
- portal account status;
- individual portal permissions.

New accounts create both `directors/{uid}` and `boardDirectory/{uid}` in the same account-provisioning workflow.

Older Phase 2 accounts can be backfilled by Founder Control without changing authentication credentials.

## Board notices

Phase 3 uses `announcements` for Board notices.

Representative fields:

```text
title
body
priority        // normal | important | urgent
status          // published | archived
expiresOn
publishedAt
createdAt
createdBy
updatedAt
updatedBy
```

### Published-only ordinary read enforcement

Ordinary active directors can read only records where:

```text
status == published
```

The dashboard uses a matching single-field query and filters expiration client-side.

Authorized notice managers can inspect archived records. This closes the earlier edge case where archived notices were removed from the UI but remained readable by an ordinary direct collection request.

No composite index is needed.

## Phase 2 completion carried into Phase 3

Phase 3 also completed:

- self-service PIN change;
- interrupted first-activation recovery;
- `pin_reset_required` as a first-class account state;
- Founder forgotten-PIN recovery package preparation;
- documented Firebase-console-assisted privileged password reset under the no-backend constraint;
- browser pure-function QA coverage.

The portal never stores a raw PIN in Firestore.

## No manual/composite indexes

Phase 3 uses direct reads, plain collection reads where authorized, single-field queries, and browser-side search/filter/sort.

`firestore.indexes.json` remains absent and `firebase.json` deploys Security Rules only.

## Phase 4 handoff

Phase 4 builds the Google-link-only Board Document Center on top of the completed Phase 3 identity, directory, notice, and Founder-permission foundations. See `PHASE-4-DOCUMENT-CENTER.md`.
