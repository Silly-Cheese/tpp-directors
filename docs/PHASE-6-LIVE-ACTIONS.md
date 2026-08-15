# Phase 6 — Agenda, Motions, Live Voting & Resolution Registry

Phase 6 is the Board's live action layer on top of the Phase 5 Meeting Room.

## Status

**FINISHED / CODE COMPLETE**

The final Phase 6 hardening pass was completed before Phase 7 certification was added.

## Implemented workflow

```text
Agenda Item
  -> Motion
  -> Second
  -> Push Vote
  -> Ballots
  -> Close Vote
  -> Preliminary Resolution
```

The portal supports live agendas, Agenda Ready Google-document attachment, motions, seconds, vote-level recusals, approve/oppose/abstain ballots, recorded/confidential ballot modes, configurable thresholds, resolution generation, and portal-wide Vote Now alerts.

## Permissions

```text
agenda.manage
motions.create
motions.second
votes.view
votes.cast
votes.push
votes.close
resolutions.view
resolutions.create
```

Founder root implicitly has every capability. The Founder can assign or remove individual capabilities from every other Board account.

## Final concurrency hardening

### Meeting-owned active vote lock

Each meeting now contains:

```text
activeVoteId
```

A pushed vote claims this field atomically. A second vote cannot legitimately be opened while the field is occupied.

The lock is released only when that vote reaches `closed`.

### Vote lifecycle

The final lifecycle is:

```text
OPEN -> CLOSING -> CLOSED
```

`closing` is important. It freezes ballot acceptance before tallying begins, preventing a ballot from arriving after the controller has already calculated totals but before the closed result is committed.

The close workflow:

1. rechecks the meeting and quorum in the normal client workflow;
2. moves the vote from `open` to `closing`;
3. stops further ballot creation;
4. reads deterministic ballot records from the frozen eligible-voter list;
5. calculates the selected threshold;
6. atomically changes the vote to `closed`;
7. releases the meeting's active-vote lock;
8. finalizes the motion;
9. completes the agenda item;
10. creates the preliminary Board resolution.

### Recess and adjourn protection

A meeting with an occupied `activeVoteId` cannot be recessed or adjourned through the normal Phase 5/6 workflow or through the Phase 1–7 Firestore Security Rules.

That means Phase 7 receives a cleaner post-meeting state: an adjourned meeting cannot still have an active official ballot.

## Motions

A motion requires:

- meeting is in session;
- agenda item belongs to that meeting;
- agenda item is not completed, tabled, or withdrawn;
- mover has `motions.create`;
- mover is currently present and voting eligible.

A second requires a different present voting-eligible director with `motions.second`.

## Vote opening

The client calculates the live Phase 5 quorum immediately before the vote is pushed.

A vote snapshots:

```text
eligibleVoterUids
recusedDirectorUids
quorumSnapshotPresent
quorumSnapshotRequired
thresholdMode
ballotVisibility
```

Eligible voters are present voting-eligible directors minus vote-level recusals.

## Ballots

Ballots use deterministic IDs:

```text
voteBallots/{voteId}_{directorUid}
```

A voter may create only their own ballot while:

- the vote is `open`;
- their UID is in the frozen eligible-voter list;
- they remain present and voting eligible;
- their account has `votes.cast`.

Ballots cannot be updated or deleted.

## Ballot modes

### Recorded

Individual choices can be shown after the vote closes. The recorded-ballot audit uses deterministic direct reads so each historical vote always loads its own ballot set.

### Confidential

Individual choices are hidden from ordinary Board viewers. The voter, Founder root, and an authorized vote closer retain audit access.

This is confidential, not cryptographically anonymous, because the portal intentionally has no trusted backend or Cloud Function.

## Vote thresholds

```text
simple_majority_cast
majority_eligible
two_thirds_cast
```

The selected rule and required approval count are preserved with the vote and preliminary resolution.

## Preliminary resolutions

Closing a vote creates:

```text
resolutions/{resolutionId}
```

with a `BR-YYYY-XXXXXX` resolution number and:

```text
certified: false
```

Phase 7 certifies these records when the complete meeting record is sealed.

## Serverless quorum boundary

The project intentionally uses only GitHub Pages, Firebase Authentication, and Cloud Firestore.

The client calculates meeting-wide quorum from the current attendance roster. Firestore Security Rules independently validate each ballot against the open vote, its frozen voter list, and the voter's current attendance record, but the rules do not aggregate the entire attendance collection to recalculate quorum themselves.

The original attendance data and the vote's quorum snapshot remain available for later audit and Phase 7 certification.

## No manual/composite indexes

Phase 6 uses direct reads, authorized plain collection reads, or a single equality filter such as:

```text
meetingId == selectedMeetingId
```

Sorting, search, quorum calculations, and threshold calculations remain client-side.

There is intentionally no `firestore.indexes.json`.

## Phase 7 handoff

An adjourned meeting handed to Phase 7 now has:

- immutable attendance;
- closed votes only;
- no active-vote lock;
- completed vote totals;
- preliminary resolution records;
- preserved motion/agenda history.

That state is used to produce the certified permanent Board record.
