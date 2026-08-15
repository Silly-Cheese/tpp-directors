# Phase 7 — Minutes, Certification & Permanent Board Records

Phase 7 converts an adjourned Board meeting into a certified, read-only governance record while keeping the portal within the project's fixed architecture:

- GitHub Pages hosting;
- Firebase Authentication + Cloud Firestore only;
- no Firebase Storage or Functions;
- no direct uploads;
- official minutes remain a Google Docs / Drive / Sheets / Slides link;
- no manual/composite Firestore indexes.

## Phase 6 completion work

Before Phase 7 certification was opened, Phase 6 received a final concurrency hardening pass.

### One active vote per meeting

Each meeting owns an `activeVoteId` lock. Opening a pushed vote claims the lock atomically. A second controller cannot legitimately open another vote while the lock is occupied.

### Two-stage close

Vote closing uses:

```text
OPEN -> CLOSING -> CLOSED
```

Moving to `closing` stops new ballots before the tally is frozen. The final transaction closes the vote, releases `meeting.activeVoteId`, updates the motion, completes the agenda item, and creates the preliminary Board resolution.

If a browser disconnects after the vote reaches `closing`, an authorized recovery layer can finish the already-frozen tally without reopening ballot intake.

### Meeting lifecycle lock

A meeting cannot be recessed or adjourned while `activeVoteId` is occupied. This prevents Phase 7 from receiving an adjourned meeting with an unfinished official ballot.

## Phase 7 permissions

```text
minutes.view
minutes.edit
minutes.certify
records.view
records.certify
```

Founder root possesses every capability implicitly. The default Board Secretary template receives the full Phase 7 minutes/record toolset. Standard Directors, the Chair, and Treasurer receive read access to minutes and certified records by default, but not final record-certification authority. The Founder can override permissions individually.

## Minutes workflow

Minutes use a deterministic record:

```text
meetingMinutes/{meetingId}
```

Statuses:

```text
DRAFT -> READY -> CERTIFIED
```

### Draft

An authorized minutes editor can maintain structured portal metadata while the meeting is underway or after adjournment.

Representative fields:

```text
meetingId
meetingNumber
meetingTitle
status
minutesDocumentUrl
openingNotes
discussionSummary
otherBusiness
closingNotes
approvalReference
preparedBy
preparedByName
createdAt
updatedAt
readyAt
readyBy
certifiedAt
certifiedBy
recordId
```

The official minutes file is never uploaded. `minutesDocumentUrl` must be a supported Google HTTPS link before the minutes can become Ready for Certification.

### Ready for Certification

`minutes.certify` may move Draft minutes to Ready only after the meeting is adjourned. Ready minutes are temporarily read-only. An authorized minutes editor can return them to Draft if correction is needed before final certification.

### Certified

`records.certify` seals the minutes at the same time the permanent meeting record is created. After certification the Phase 7 rules do not permit ordinary minutes editing.

## Permanent record master

A certified meeting receives:

```text
meetingRecords/{meetingId}
```

The record includes:

- `BMR-YYYY-XXXXXX` record number;
- meeting identity and lifecycle snapshot;
- official Google minutes link;
- structured minutes summary;
- counts for attendance, agenda items, motions, votes, resolutions, and recusals;
- certifier identity;
- server-authoritative certification timestamp;
- certification schema version.

The master certified record is immutable after creation.

## Permanent record entries

To avoid putting the entire meeting history into one oversized Firestore document, Phase 7 writes immutable snapshot entries to:

```text
meetingRecordEntries/{meetingId}_{type}_{sourceId}
```

Entry types:

```text
attendance
agenda
motion
vote
resolution
recusal
```

Every entry contains the meeting/record identity, source ID, entry type, ordering value, certified snapshot map, certification timestamp, and certifier UID.

### Scalable Security Rules model

Certification is designed to remain one atomic Firestore batch even when a meeting has several directors and many motions/votes. Firestore Security Rules have document-access-call limits for atomic operations, so the rules deliberately do **not** perform a unique `get()` against every source document for every certified entry.

Instead:

- only an account with `records.certify` may create permanent snapshot entries;
- every snapshot document ID must deterministically equal `meetingId + entryType + sourceId`;
- every entry must reference the same meeting/record ID;
- every entry must be created with the same server-authoritative certification time and certifier;
- the certified `meetingRecords/{meetingId}` master must exist in the same atomic operation;
- entries are immutable after creation;
- the client constructs the entry data from the already-locked adjourned meeting source records immediately before certification.

This avoids a rules-call ceiling that would otherwise make an ordinary multi-vote Board meeting impossible to certify atomically, while still restricting snapshot creation to explicitly delegated record-certification authority.

## What is snapshotted

### Attendance

Director name/number, Board/officer role, voting eligibility, final presence status, check-in, departure, return, excused, and absent timestamps.

### Agenda

Agenda number/order, item type, title, description, final status, and any linked Google Board-document metadata.

### Motions

Motion number/text, final state, mover, seconder, vote ID, and resolution ID.

### Votes

Vote number/question, threshold, ballot visibility, frozen voter/recusal counts, quorum snapshot, result totals, required approval count, and open/close timestamps.

Individual confidential ballot choices are **not copied** into the permanent snapshot. Original immutable ballot documents continue to follow Phase 6 access rules.

### Resolutions

Resolution number/text, result, vote totals, threshold, mover/seconder, and adoption timestamp.

### Recusals

Director identity, vote ID, reason, and recorded timestamp.

## Resolution certification

Phase 6 creates preliminary resolution records with `certified: false`. During Phase 7 permanent-record certification, every resolution associated with the meeting is updated in the same atomic batch to include:

```text
certified: true
recordId: <meetingId>
certifiedAt: <server time>
certifiedBy: <certifier uid>
```

After certification the rules do not permit ordinary resolution rewriting.

## Meeting record seal

The underlying meeting remains historically `adjourned`; Phase 7 does not pretend the meeting is back in session. It receives a separate record seal:

```text
recordStatus: certified
recordId: <meetingId>
minutesId: <meetingId>
certifiedAt
certifiedBy
certifiedByName
```

This keeps meeting lifecycle state separate from record-certification state.

## Certification event

A deterministic immutable event is created at:

```text
recordEvents/{meetingId}_certified
```

It records who performed certification and when.

## Atomic certification

Certification is one Firestore batch covering:

- certified meeting master record;
- immutable certified record entries;
- resolution certifications;
- minutes certification;
- meeting record seal;
- record event.

The client refuses certification if the operation would exceed its conservative write-count ceiling.

## Preconditions

The normal Phase 7 workflow requires:

- meeting status is `adjourned`;
- no `activeVoteId` remains;
- every meeting vote is `closed`;
- minutes status is `ready`;
- official minutes Google link is valid;
- no certified record already exists.

## Certified Records UI

Phase 7 adds **Board Records** to portal navigation with certified-record totals, search, certifier/lifecycle information, official Google minutes link, structured minutes summary, grouped attendance/agenda/motion/vote/resolution/recusal entries, and a print-friendly permanent-record view.

## Record certification vs. legal approval

Portal certification means the portal's governance record is sealed and made read-only. It does not create legal authority absent from the organization's governing documents, and it does not replace Board approval of minutes or records where the bylaws or applicable law require that approval.

The optional `approvalReference` field exists so the organization can record the motion, resolution, or other approval basis used under its actual governance process.

## No manual/composite indexes

Phase 7 uses one-field `meetingId == selectedMeetingId` reads for source and permanent-record-entry retrieval. Certified master records use an authorized plain collection read with browser-side search/sort. There is intentionally no `firestore.indexes.json`.

## Phase 8 handoff

Phase 8 can build committees, conflict-of-interest workflows, officer administration, Board tasks, and compliance tracking on top of certified permanent records rather than mutable live-meeting data.
