# Phase 4 — Board Document Center & Board Inbox

Phase 4 makes Google-linked Board documents operational inside The Prayer Project Board of Directors Portal.

## Core document policy

The portal does **not** upload or store file bytes.

Every Board document is represented by:

- a Google Docs, Google Drive, Google Sheets, or Google Slides HTTPS link;
- Firestore metadata describing the governance record;
- access-control metadata;
- status/review metadata;
- immutable history events.

Firebase Storage is not used.

The portal validates the URL host before accepting a submission. Google Drive sharing permissions still matter independently: portal access to a link does not grant access to the underlying Google file.

## Firestore collections

### `documents/{documentId}`

Primary Board document record.

Representative fields:

```text
documentNumber
title
description
documentUrl
linkType
category
accessScope
allowedDirectorUids
requestedAction
status
revisionNumber
submittedBy
submittedByName
submittedAt
reviewedBy
reviewedByName
reviewedAt
reviewNote
agendaMeetingId
archivedAt
createdAt
updatedAt
updatedBy
```

Document numbers use the format:

```text
BDOC-YYYY-XXXXXX
```

The suffix is derived from the Firestore document ID. A counter or composite index is not required.

### `documentEvents/{eventId}`

Append-only lifecycle events for a Board document.

Representative event types include:

- `submitted`
- `revised`
- `resubmitted`
- `under_review`
- `returned_for_revision`
- `agenda_ready`
- `approved`
- `rejected`
- `tabled`
- `archived`

Events are sorted client-side after a single-field `documentId == ...` query.

## Categories

Phase 4 supports:

- Governance
- Policy
- Financial
- Program
- Committee
- Report
- Legal
- Minutes
- Other

The category list is metadata only and can be expanded later without introducing file uploads.

## Access scopes

### Board of Directors

Accessible to active users with `documents.view`.

### Board Officers

Accessible to active users with `documents.view` and a non-null officer role.

### Selected Directors

Accessible only to the listed Firebase Authentication UIDs, the submitting director, document reviewers, and the Founder root account.

### Founder Director Only

Accessible to the Founder root account, document reviewers, and the submitting director.

The submitting director always retains portal access to their own submission so they can follow review status and complete a requested revision.

## Review permission

`documents.review` is the Phase 4 review capability.

The Founder root account always has it. The initial Board Secretary and Board Chair templates also include it.

Reviewers receive the Board Inbox and can process submitted records through the supported lifecycle.

## Document lifecycle

The main lifecycle is:

```text
SUBMITTED
  -> UNDER REVIEW
  -> RETURNED FOR REVISION -> SUBMITTED
  -> AGENDA READY
  -> APPROVED / REJECTED / TABLED
  -> ARCHIVED
```

Some direct transitions are intentionally supported, such as submitting a record directly to Agenda Ready or rejecting a clearly unsuitable submission. Security Rules enforce allowed transitions; the browser UI is not the authorization boundary.

Archived records cannot be silently reopened.

## Revision model

The document file itself remains in Google Drive. A Phase 4 revision updates the stored Google link/metadata and increments `revisionNumber`.

The portal never stores old file bytes. The append-only event history records that a revision or resubmission occurred.

A submitting director may revise a document only while it is:

- `submitted`, or
- `returned_for_revision`.

Reviewers cannot silently rewrite the submitted title, link, access scope, category, or submitting identity through the review path.

## Board Inbox

Users with `documents.review` see a Board Inbox containing records in:

- `submitted`
- `under_review`

The Board Inbox is a review queue, not a separate Firestore collection. It is derived client-side from the reviewer-visible document set.

This avoids duplicate source-of-truth records.

## Agenda handoff

Phase 4 supports `agenda_ready` as the handoff state to the meeting system.

`agendaMeetingId` is reserved for Phase 5/6 integration. Phase 4 does not fabricate a meeting ID before the meeting module exists.

## No manual/composite indexes

Phase 4 preserves the project-wide rule that no manual/composite Firestore indexes are created.

Non-reviewer document access is assembled from separate single-field queries:

- `submittedBy == currentUid`
- `accessScope == board`
- `accessScope == officers` when applicable
- `allowedDirectorUids array-contains currentUid`

The result sets are merged, deduplicated, filtered, searched, and sorted in the browser.

Reviewers/Founder may read the full `documents` collection because Security Rules authorize their role.

Document history uses one single-field equality query on `documentId`.

There is intentionally no `firestore.indexes.json`.

## Phase 3 completion included with Phase 4

Before opening the document collection, Phase 3 was hardened in two areas:

1. Hidden `boardDirectory` records now require `directoryVisible == true` for ordinary director reads; the client uses a matching single-field query.
2. Ordinary directors can read only `published` Board notices; archived notices are no longer merely hidden by client-side filtering.

The Founder/authorized notice manager can still inspect archived notice records.

## Phase 5 handoff

Phase 5 can consume Phase 4 records by:

- selecting `agenda_ready` documents;
- attaching them to a scheduled/active meeting;
- storing the meeting ID in the document record through a Phase 5-authorized workflow;
- showing linked documents directly inside live meeting agenda items.

No Phase 5 collection is opened by Phase 4 Security Rules.
