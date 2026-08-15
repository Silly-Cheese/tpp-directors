# Phase 5 — Board Meetings, Check-In, Attendance & Quorum

Phase 5 turns the Board Portal into a live digital Boardroom. It builds on the Founder-controlled permissions, Board directory, and Google-linked document system from Phases 1–4.

## Phase 5 scope

Phase 5 implements:

- scheduled Board meetings;
- meeting types and meeting location/mode metadata;
- invited-director roster snapshots;
- voting-eligible roster snapshots;
- a frozen quorum requirement for each meeting;
- meeting activation / check-in opening;
- director self check-in;
- late arrival and return after departure;
- live attendance management;
- live quorum calculation;
- call to order;
- recess;
- resume;
- adjournment;
- cancellation before a meeting is in session;
- live dashboard meeting notices;
- Firestore snapshot-driven meeting and attendance updates;
- Founder-assignable meeting permissions;
- Phase 5 Security Rules;
- no manual/composite Firestore indexes.

Phase 5 does **not** yet implement motions, pushed voting, resolution passage, or permanent minutes. Those remain Phase 6 and Phase 7 responsibilities.

## Permissions

Phase 5 uses these existing/granular capabilities:

```text
meetings.view
meetings.create
meetings.activate
meetings.control
meetings.attendance.manage
```

The Founder Director root account implicitly has every capability.

### `meetings.view`

Allows an active director to:

- open the Meeting Room;
- view meetings;
- view live attendance;
- view quorum status;
- self-check-in when invited and when check-in is open.

### `meetings.create`

Allows scheduling a new Board meeting and creating its initial invited attendance roster.

### `meetings.activate`

Allows the transition:

```text
SCHEDULED -> CHECK-IN OPEN
```

This is intentionally distinct from general meeting control so the Founder can delegate activation without necessarily delegating the entire live meeting console.

### `meetings.control`

Allows the live lifecycle transitions:

```text
CHECK-IN OPEN -> IN SESSION
IN SESSION -> RECESSED
RECESSED -> IN SESSION
IN SESSION / RECESSED -> ADJOURNED
SCHEDULED / CHECK-IN OPEN -> CANCELLED
```

### `meetings.attendance.manage`

Allows an authorized user to manage another director's attendance status while the meeting is still open.

The standard Board Chair template includes activation, live control, and attendance management. The Secretary template includes meeting creation and attendance management. The Founder can override these assignments per director.

## Firestore collections

### `meetings/{meetingId}`

Representative fields:

```text
meetingNumber
title
meetingType
scheduledFor
locationMode
locationLabel
status
invitedDirectorUids
eligibleVotingDirectorUids
quorumRequired
createdBy
createdByName
createdAt
updatedAt
updatedBy
checkInOpenedAt
calledToOrderAt
recessedAt
resumedAt
adjournedAt
cancelledAt
```

Meeting numbers use:

```text
BM-YYYY-XXXXXX
```

The suffix comes from the Firestore document ID, so no counter or manual index is required.

### `meetingAttendance/{meetingId}_{directorUid}`

One deterministic attendance record is created for each invited director.

Representative fields:

```text
meetingId
directorUid
directorNumber
directorName
boardRole
officerRole
votingEligible
invited
presenceStatus
checkedInAt
departedAt
returnedAt
excusedAt
absentAt
lastPresenceChangeAt
createdAt
updatedAt
updatedBy
```

The deterministic document ID prevents duplicate attendance records for the same director/meeting pair.

## Meeting statuses

```text
scheduled
checkin_open
in_session
recessed
adjourned
cancelled
```

The portal does not silently reopen an adjourned or cancelled meeting. Later correction/certification workflows belong to the permanent-record phase.

## Attendance statuses

```text
invited
present
departed
excused
absent
```

A director can self-change only from:

```text
invited -> present
departed -> present
```

and only while the meeting is:

```text
checkin_open
in_session
recessed
```

An attendance manager may make the other supported changes while the meeting is open. Attendance becomes immutable when the meeting is adjourned or cancelled.

## Quorum

Quorum is not stored as a mutable `true/false` value.

At meeting creation the portal snapshots:

- invited directors;
- which invitees are voting eligible;
- the required number for quorum.

The live quorum result is then derived from the attendance records:

```text
voting-eligible directors with presenceStatus == present
```

compared against:

```text
meeting.quorumRequired
```

This is critical for Phase 6. If a voting-eligible director departs and the present count falls below quorum, the portal immediately reflects that change rather than trusting an old stored `quorumAchieved: true` flag.

### Default quorum helper

If the meeting creator leaves the quorum field blank, the client proposes a majority of invited voting-eligible directors:

```text
floor(eligibleInvitees / 2) + 1
```

The creator may enter a different positive number up to the number of invited voting-eligible directors so the portal can follow the organization's governing documents rather than hard-coding one legal rule.

## Meeting activation and check-in

A newly created meeting begins as `scheduled`.

An authorized user activates it:

```text
scheduled -> checkin_open
```

Directors on that meeting's roster immediately receive the live Meeting Room state and may check in from their own account.

The attendance record becomes `present`, and `checkedInAt` is timestamped. If a director was previously marked `departed`, a later self check-in records `returnedAt`.

## Call to order and quorum

The portal does not require quorum merely to press **Call to Order**. This is intentional because a Board may need to convene and record that quorum was not present.

Phase 6 will use the derived live quorum state when deciding whether a substantive pushed vote can be opened or completed.

## Recess and resume

A meeting controller may transition:

```text
in_session -> recessed -> in_session
```

Directors may still return/check in during a recess. This prevents the attendance record from becoming artificially stale while the Board is temporarily recessed.

## Adjournment

Adjournment transitions an in-session or recessed meeting to:

```text
adjourned
```

After adjournment:

- directors cannot self-check-in;
- attendance managers cannot rewrite attendance;
- the meeting cannot be silently reopened by Phase 5;
- Phase 7 can later certify the permanent meeting record.

## Phase 4 hardening completed during Phase 5 review

The Phase 4 review identified an audit-integrity gap: `documentEvents` were append-only but a user could theoretically attempt to create a false event unrelated to a real document mutation.

Phase 5 closes that gap.

A document-history event must now match the actual document write in the same request/batch:

- `submitted` must correspond to the original revision-1 submission;
- `revised` / `resubmitted` must correspond to a real revision increment and matching prior status;
- reviewer events must match the new document status, reviewer UID, and document update timestamp.

Therefore Phase 4 is considered complete after this review.

## No manual/composite indexes

Phase 5 preserves the project-wide no-manual-index rule.

Meeting reads use:

- a plain `meetings` collection read for authorized Board users;
- one single-field equality query on `meetingAttendance.meetingId` for the selected meeting.

All sorting, status filtering, searching, quorum calculations, and attendance summaries occur in the browser.

There is intentionally no `firestore.indexes.json`.

## Phase 6 handoff

Phase 6 can now build live agendas, motions, resolutions, and pushed voting on top of a reliable meeting state.

Before a Phase 6 vote is opened, the voting service can read:

- the active meeting status;
- the eligible-voter snapshot;
- current attendance;
- the derived quorum result.

That allows the portal to refuse or flag a vote when quorum is not currently present rather than relying on a stale meeting-level flag.
