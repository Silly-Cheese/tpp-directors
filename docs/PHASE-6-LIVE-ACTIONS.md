# Phase 6 — Agenda, Motions, Live Voting & Resolution Registry

Phase 6 builds the Board's live action workflow on top of the Phase 5 Meeting Room.

## Phase 5 polish completed first

Before Phase 6 was opened, Phase 5 received an integration and usability review.

The review found and corrected a critical static-site issue: `phase5.js` existed in the repository but was not loaded by the only script tag in `index.html`. The portal now loads Phase 5, its polish layer, and Phase 6 from the shared `firebase.js` entry path using dynamic ES-module imports. This keeps GitHub Pages build-free while ensuring the meeting code actually executes.

Phase 5 polish also adds:

- select-all / clear-all meeting roster controls;
- selected-roster count;
- confirmation prompts for meeting lifecycle actions;
- a live Boardroom indicator;
- a stable Phase 5 -> Phase 6 meeting-selection handoff;
- observer-loop protection so Firestore-driven rerenders do not recursively trigger the polish layer.

## Phase 6 scope

Phase 6 implements:

- live meeting agendas;
- Agenda Ready Google-linked document attachment;
- agenda-item states;
- motions;
- seconds;
- vote setup and push;
- vote-level recusals;
- recorded and confidential ballots;
- approve / oppose / abstain voting;
- immutable per-director ballots;
- live ballot-receipt information for vote controllers;
- configurable vote thresholds;
- vote closing and result calculation;
- preliminary resolution generation;
- a searchable Board Resolution Registry;
- Phase 6 Firestore Security Rules;
- a Phase 6 browser QA harness;
- no manual/composite Firestore indexes.

Phase 6 does not certify meeting minutes or seal the permanent meeting record. Those remain Phase 7 responsibilities.

## Permissions

Phase 6 adds:

```text
agenda.manage
motions.create
motions.second
votes.view
```

and uses the existing:

```text
votes.cast
votes.push
votes.close
resolutions.view
resolutions.create
```

The Founder Director root account implicitly has every capability.

### Default templates

**Standard Director** receives:

- `motions.create`
- `motions.second`
- `votes.view`
- `votes.cast`

in addition to the prior standard Board access.

**Board Secretary** also receives `agenda.manage`.

**Board Chair** receives the complete live-action controller set, including agenda management, vote push, and vote close.

The Founder can still override every permission individually.

## Firestore collections

### `agendaItems/{agendaId}`

Representative fields:

```text
agendaNumber
meetingId
meetingNumber
order
itemType
title
description
documentId
documentNumber
documentTitle
documentUrl
status
createdBy
createdByName
createdAt
updatedAt
updatedBy
```

Agenda item types:

```text
business
report
motion
resolution
election
other
```

Agenda states:

```text
queued
active
completed
tabled
withdrawn
```

Agenda records are read with one single-field `meetingId == ...` query and sorted client-side.

## Google-linked documents on the agenda

Phase 4 documents marked `agenda_ready` can be attached to a Phase 6 agenda item.

The portal does not copy or upload the file. The agenda stores the Board document metadata and Google link, while the underlying `documents/{documentId}` record receives `agendaMeetingId`.

Firestore Rules permit that association only when:

- the caller has `agenda.manage`;
- the document is already `agenda_ready`;
- the document has not already been assigned to a meeting;
- the target meeting remains open for governance work.

## Motions

A motion requires:

- an in-session Board meeting;
- a valid agenda item for that meeting;
- a signed-in director with `motions.create`;
- the director's attendance record to be `present`;
- the director to be voting eligible.

New motions begin:

```text
pending_second
```

and contain a permanent mover snapshot.

A different present voting-eligible director with `motions.second` can second the motion, changing it to:

```text
ready
```

The mover cannot second their own motion.

## Vote push

An authorized vote controller can push a `ready` motion to the Board.

The client reads the live Phase 5 attendance roster and calculates quorum immediately before opening the vote.

If quorum is not currently achieved, the portal refuses to push the vote.

The vote snapshots:

```text
eligibleVoterUids
recusedDirectorUids
quorumSnapshotPresent
quorumSnapshotRequired
thresholdMode
ballotVisibility
```

Eligible voters are voting-eligible directors marked `present` at the moment the ballot is pushed, less any recorded vote-level recusals.

### Important serverless quorum boundary

This portal deliberately uses GitHub Pages + Firebase Authentication + Firestore only. There is no trusted Cloud Function or application server.

Firestore Security Rules can validate an individual director's current attendance when that person casts a ballot, and can validate that vote snapshots contain only meeting-level voting-eligible director UIDs. Rules cannot perform an arbitrary server-side aggregation across the complete attendance collection to independently recalculate quorum for the vote-opening write.

Therefore:

- the client performs the live quorum aggregation;
- the vote preserves the quorum snapshot used when it was opened;
- the original meeting roster and attendance records remain available for audit;
- each actual ballot is independently validated by Firestore against the voter's eligibility and current `present` attendance record.

This limitation is documented rather than being represented as server-authoritative quorum aggregation.

## Recusals

Vote-level recusals are stored in:

```text
voteRecusals/{voteId}_{directorUid}
```

A recused director is excluded from that vote's eligible-voter snapshot but remains part of the underlying meeting attendance record.

This intentionally separates physical/remote presence from voting participation.

## Ballots

Ballots are stored as deterministic documents:

```text
voteBallots/{voteId}_{directorUid}
```

A director may create only their own ballot, and only when:

- the vote is open;
- their UID is in the vote's eligible-voter snapshot;
- they possess `votes.cast`;
- their Phase 5 attendance record is still `present`;
- the ballot choice is `approve`, `oppose`, or `abstain`.

Ballots cannot be updated or deleted.

That means a submitted vote cannot be silently changed later.

## Ballot visibility

### Recorded

Recorded ballots are auditable by users with the appropriate vote-record permission after the vote closes. Vote controllers can inspect ballot receipts while the vote is open.

### Confidential

A confidential ballot hides individual choices from ordinary Board viewers. Individual ballot records remain visible to:

- the voter who cast that ballot;
- the Founder Director root account;
- an authorized `votes.close` controller who must be able to audit/tally the ballot set.

This is intentionally called **confidential**, not cryptographically anonymous or secret. With the current no-backend architecture, a trusted vote controller must be able to read the ballot documents to close and audit the vote.

## Vote thresholds

Phase 6 supports:

### `simple_majority_cast`

Approval must exceed opposition among non-abstaining votes cast.

### `majority_eligible`

Approval must reach a majority of the eligible-voter snapshot, regardless of abstentions or uncast ballots.

### `two_thirds_cast`

Approval must reach two-thirds of non-abstaining votes cast.

The selected threshold and calculated required approval count are preserved in the closed vote and resolution record.

## Vote close

Only an account with `votes.close` and `resolutions.create` can close a vote through the Phase 6 workflow.

Closing the vote:

1. reads the immutable ballot set;
2. calculates approve / oppose / abstain totals;
3. calculates the applicable threshold;
4. records `adopted` or `failed`;
5. closes the motion;
6. marks the agenda item completed;
7. creates a preliminary Board resolution record.

There is no Phase 6 "edit result" or ballot-reopen workflow. A later reconsideration should be represented as a new Board action, not a silent rewrite of the original ballots.

## Resolution Registry

Closed motion votes create:

```text
resolutions/{resolutionId}
```

with IDs displayed as:

```text
BR-YYYY-XXXXXX
```

Representative fields include:

```text
resolutionNumber
meetingId
meetingNumber
agendaItemId
motionId
voteId
title
resolutionText
status
thresholdMode
ballotVisibility
approveCount
opposeCount
abstainCount
ballotCount
eligibleVoterCount
requiredApproveCount
movedByUid
movedByName
secondedByUid
secondedByName
adoptedAt
createdAt
createdBy
certified
certifiedAt
certifiedBy
```

Phase 6 creates these records with:

```text
certified: false
```

Phase 7 will perform Secretary/authorized certification and permanent meeting-record sealing.

## No manual/composite indexes

Phase 6 continues the project-wide rule.

Queries use only a single field at a time, for example:

```text
agendaItems.meetingId == selectedMeetingId
motions.meetingId == selectedMeetingId
votes.meetingId == selectedMeetingId
voteBallots.voteId == selectedVoteId
voteRecusals.voteId == selectedVoteId
```

The Resolution Registry uses an authorized plain collection read and browser-side search/sort.

There is intentionally no `firestore.indexes.json`.

## Phase 7 handoff

Phase 7 can now build minutes and certification from authoritative source records already captured during the meeting:

- meeting lifecycle timestamps;
- attendance roster and presence changes;
- agenda items;
- motions and seconds;
- vote snapshots;
- immutable ballots;
- recusals;
- resolution results.

Phase 7 should certify and seal those records rather than re-entering the same information manually.
