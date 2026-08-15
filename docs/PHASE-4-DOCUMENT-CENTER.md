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

Document numbers use `BDOC-YYYY-XXXXXX`, with the suffix derived from the Firestore document ID. No counter is required.

### `documentEvents/{eventId}`

Append-only lifecycle events such as submitted, revised, resubmitted, under review, returned for revision, agenda ready, approved, rejected, tabled, and archived.

Events are read with a single-field `documentId == ...` query and sorted client-side.

## Categories

- Governance
- Policy
- Financial
- Program
- Committee
- Report
- Legal
- Minutes
- Other

## Access scopes

### Board of Directors

Accessible to active users with `documents.view`, the submitter, document reviewers, and Founder root.

### Board Officers

Accessible to active officers with `documents.view`, the submitter, document reviewers, and Founder root.

### Selected Directors

Accessible to the selected Firebase Authentication UIDs, the submitter, document reviewers, and Founder root.

### Founder Director Only

This scope is literal: it is accessible only to the Founder root account and the submitting director.

A non-Founder user with `documents.review` does **not** receive Founder-only records in the Board Inbox and cannot review them. Founder root can process those records.

The submitter retains access so they can follow status and complete requested revisions.

## Review permission

`documents.review` is the Phase 4 review capability.

Founder root implicitly has every capability. The initial Board Secretary and Board Chair templates also include document review.

Non-Founder reviewers receive all non-Founder-only submissions, including Board, Officers, and Selected-Director records. That elevated review access is intentional and enforced by Security Rules.

## Document lifecycle

```text
SUBMITTED
  -> UNDER REVIEW
  -> RETURNED FOR REVISION -> SUBMITTED
  -> AGENDA READY
  -> APPROVED / REJECTED / TABLED
  -> ARCHIVED
```

Some direct transitions are supported, such as moving a submitted item directly to Agenda Ready or rejecting a clearly unsuitable submission.

Security Rules enforce valid transitions. Archived/rejected records cannot be silently reopened into arbitrary earlier states.

## Revision model

The Google file remains in Drive. A portal revision updates the link/metadata and increments `revisionNumber`.

A submitter may revise only while the record is:

- `submitted`, or
- `returned_for_revision`.

Reviewers cannot use the review path to rewrite the submitted title, Google link, access scope, category, or submitting identity.

## Board Inbox

The Board Inbox is derived from reviewer-visible documents in:

- `submitted`
- `under_review`

It is not a duplicate Firestore collection.

Founder-only submissions are excluded from a non-Founder reviewer's data set.

## Agenda handoff

`agenda_ready` is the Phase 4 handoff state to the future meeting system.

`agendaMeetingId` is reserved for Phase 5/6. Phase 4 does not invent a meeting ID before the meeting module exists.

## No manual/composite indexes

Phase 4 preserves the project-wide no-manual-index rule.

Ordinary document access uses separate single-field queries such as:

```text
submittedBy == currentUid
accessScope == board
accessScope == officers
allowedDirectorUids array-contains currentUid
```

A non-Founder reviewer uses separate single-field queries for `board`, `officers`, and `restricted` scopes plus their own submissions. Founder root may read the full collection.

Result sets are merged, deduplicated, filtered, searched, and sorted in the browser.

Document history uses one equality query on `documentId`.

There is intentionally no `firestore.indexes.json`.

## Phase 3 completion included with Phase 4

Phase 3 was hardened before Phase 4 opened:

1. Ordinary `boardDirectory` reads now require `directoryVisible == true`, with a matching single-field query.
2. Ordinary directors can read only `published` Board notices; archived records are no longer merely hidden by the UI.

## Phase 5 handoff

Phase 5 can consume `agenda_ready` records by attaching them to scheduled/active meetings, writing a meeting association through Phase 5-authorized rules, and displaying the linked Google document inside the live agenda.

No Phase 5 collection is opened by Phase 4.
