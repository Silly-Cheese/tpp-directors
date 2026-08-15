# Phase 4 — Board Document Center & Board Inbox

Phase 4 is complete. It makes Google-linked Board documents operational inside The Prayer Project Board of Directors Portal while preserving the project's no-upload and no-manual-index requirements.

## Core document policy

The portal does **not** upload or store file bytes.

Every Board document is represented by:

- a Google Docs, Google Drive, Google Sheets, or Google Slides HTTPS link;
- Firestore metadata describing the governance record;
- access-control metadata;
- status/review metadata;
- an append-only, mutation-bound history trail.

Firebase Storage is not used.

The portal validates the Google URL in the browser and Firestore Security Rules. Google Drive sharing permissions remain independent: portal permission to see a link does not grant permission to open the underlying Google file.

## Firestore collections

### `documents/{documentId}`

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
lastEventId
createdAt
updatedAt
updatedBy
```

Document numbers use `BDOC-YYYY-XXXXXX`, with the suffix derived from the Firestore document ID. No counter is required.

### `documentEvents/{eventId}`

Append-only lifecycle events include:

- submitted;
- revised;
- resubmitted;
- under review;
- returned for revision;
- agenda ready;
- approved;
- rejected;
- tabled;
- archived.

History is read with a single-field `documentId == ...` query and sorted client-side.

## Mutation-bound event integrity

The final Phase 4 review hardened document history beyond simple append-only rules.

Every document mutation reserves a new random `lastEventId` in the document record. Security Rules require:

1. the new `lastEventId` to be a string;
2. the ID not to already exist in `documentEvents`;
3. the event being created to use exactly that document ID;
4. the event type to match the actual document transition/revision;
5. the event actor to match the authenticated user performing the mutation;
6. revision events to match the actual revision increment and prior status;
7. review events to match the actual new status and reviewer UID.

This prevents an authorized user from appending arbitrary duplicate-looking history events to a document they can access.

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

Accessible only to the Founder root account and the submitting director. A non-Founder reviewer does not receive Founder-only records in the Board Inbox.

## Review permission

`documents.review` controls the Board Inbox/review workflow. Founder root implicitly has every capability. The initial Secretary and Chair templates include document review, but the Founder can change permissions individually.

## Document lifecycle

```text
SUBMITTED
  -> UNDER REVIEW
  -> RETURNED FOR REVISION -> SUBMITTED
  -> AGENDA READY
  -> APPROVED / REJECTED / TABLED
  -> ARCHIVED
```

Security Rules enforce allowed transitions. Archived/rejected records cannot be silently reopened into arbitrary earlier states.

## Revision model

The Google file remains in Drive. A portal revision updates the stored link/metadata and increments `revisionNumber`.

A submitter may revise only while the record is:

- `submitted`; or
- `returned_for_revision`.

Reviewers cannot use the review path to rewrite title, Google link, access scope, category, or submitting identity.

## Board Inbox

The Board Inbox is derived from reviewer-visible documents in:

- `submitted`;
- `under_review`.

It is not a duplicate Firestore collection.

## Agenda handoff

`agenda_ready` remains the document handoff state for the agenda/voting layer. Phase 5 now supplies real meeting IDs and live meeting state; Phase 6 will attach agenda-ready documents to agenda items and pushed Board actions.

## No manual/composite indexes

Phase 4 uses separate single-field reads such as:

```text
submittedBy == currentUid
accessScope == board
accessScope == officers
allowedDirectorUids array-contains currentUid
documentId == selectedDocumentId
```

Results are merged, deduplicated, filtered, searched, and sorted in the browser.

There is intentionally no `firestore.indexes.json`.

## Completion status

Phase 4 is considered **COMPLETE** after the Phase 5 review because:

- Google-link validation exists in client and Security Rules;
- restricted access is enforced server-side;
- review transitions are enforced server-side;
- Founder-only records are actually Founder-restricted;
- history events are append-only and bound to real document mutations;
- no upload path exists;
- no manual/composite index is required.
