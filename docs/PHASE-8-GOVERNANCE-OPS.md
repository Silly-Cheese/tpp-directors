# Phase 8 — Governance Operations Suite

Phase 8 adds the recurring governance work that happens between and around formal Board meetings. It builds on the certified meeting records from Phase 7 and keeps the portal inside the existing technical boundaries:

- GitHub Pages hosting;
- Firebase Authentication + Cloud Firestore only;
- no Firebase Storage or Functions;
- no direct file uploads;
- Google Docs / Drive / Sheets / Slides links for supporting documents;
- no manual/composite Firestore indexes.

## Phase 7 completion work

Before Phase 8 was opened, Phase 7 received a final permanent-record preflight layer.

When an authorized user presses **Certify Permanent Record**, the portal now checks the selected adjourned meeting for:

- an occupied `activeVoteId`;
- agenda items still marked `active`;
- motions still marked `voting`;
- votes that are not fully `closed`.

Those conditions block certification in the normal portal workflow.

Motions left in `pending_second` or `ready` at adjournment are surfaced in an explicit confirmation. If certification continues, the permanent record preserves those unresolved states rather than silently rewriting them.

This preflight is an operational safeguard layered on top of the Phase 7 permanent-record rules. It does not invent a legal requirement that is absent from the organization's governing documents.

## Phase 8 modules

Phase 8 adds one **Governance** section with five operational modules:

1. Committees
2. Conflicts & COI
3. Officers
4. Board Tasks
5. Compliance

## Permissions

Phase 8 adds:

```text
committees.view
committees.manage

coi.view
coi.submit
coi.review
coi.manage

officers.view
officers.manage

tasks.view
tasks.create
tasks.updateOwn
tasks.manage

compliance.view
compliance.manage
```

The Founder Director root account implicitly has every capability.

### Default access

Standard Directors receive view access to committees, officer history, their own COI records, their own assigned tasks, and compliance items. They can submit their own COI disclosure and update tasks assigned to them.

The Board Secretary receives broader committee, COI review, task-management, and compliance-management capabilities.

The Board Chair receives committee management, COI review, and task-management capabilities.

The Treasurer receives task-creation and compliance-management capability in addition to normal Board access.

`officers.manage` and `coi.manage` are intentionally not assigned broadly by default. The Founder can grant them individually.

Existing accounts do not silently receive newly added permissions. The Founder should review/reapply the intended permission template or grant Phase 8 capabilities individually before production use.

## Committees

Collection:

```text
committees
```

Representative fields:

```text
committeeNumber
name
committeeType
purpose
status
chairUid
memberUids
charterUrl
establishedDate
sunsetDate
createdAt
createdBy
updatedAt
updatedBy
```

Committee types:

```text
standing
ad_hoc
special
```

Committee statuses:

```text
active
inactive
disbanded
```

An active committee must have at least one member. If a Chair is selected, the Chair is automatically included in the membership list.

The committee charter is a Google link only; the portal never accepts an uploaded charter file.

Committee membership changes affect the committee workspace only. They do not add, remove, suspend, confirm, or otherwise alter legal Board membership.

## Annual Conflict-of-Interest Disclosures

Collection:

```text
coiDisclosures
```

Directors can submit their own annual disclosure using a deterministic `{directorUid}_{year}` document ID.

Representative fields:

```text
disclosureNumber
year
directorUid
directorName
disclosureUrl
hasConflicts
summary
status
submittedAt
reviewedAt
reviewedBy
reviewNote
```

Statuses:

```text
submitted
reviewed
renewal_required
archived
```

The underlying annual disclosure form/document must be a supported Google HTTPS link.

Ordinary directors see only their own disclosure records. A user with `coi.review`, `coi.manage`, or Founder root access can review the Board-wide disclosure set.

A reviewed disclosure cannot be silently overwritten by the submitting director. A reviewer can instead require renewal/correction, which reopens the self-service submission path.

## Specific Conflict / Recusal Records

Collection:

```text
conflictRecords
```

This is separate from the annual disclosure. It records an actual or potential conflict connected to a vendor, transaction, meeting, agenda item, vote, or other matter.

Representative fields:

```text
conflictNumber
directorUid
directorName
entityOrInterest
relationship
description
action
status
meetingId
agendaItemId
voteId
relatedDocumentUrl
managementPlan
resolvedAt
resolvedBy
```

Actions:

```text
disclosed
recused
not_recused
management_plan
```

Statuses:

```text
open
managed
resolved
```

A director can create a conflict record for themselves with `coi.submit`. Recording or resolving another director's conflict requires `coi.manage`.

The Phase 8 conflict registry complements the vote-level recusals already stored by Phase 6. A Phase 6 vote recusal remains part of the certified meeting record; Phase 8 can preserve the broader reason, relationship, and management plan.

## Officer Management

Collection:

```text
officerTerms
```

Phase 8 treats an officer assignment as a historical term, not merely a mutable label on a user profile.

Representative fields:

```text
termNumber
officerTitle
directorUid
directorName
directorNumber
basis
status
startDate
endDate
relatedMeetingId
relatedResolutionId
appointmentDocumentUrl
createdAt
concludedAt
```

Assignment bases:

```text
election
appointment
interim
confirmation
```

Statuses:

```text
active
concluded
```

When a new officer assignment is recorded:

- a new `OFF-YYYY-XXXXXX` term record is created;
- any conflicting active term for the same officer title is concluded;
- any other active officer term for the selected director is concluded;
- the director's current `officerRole` field is updated;
- the Board-facing directory receives the same current officer label.

The historical term record remains even after the current profile label changes.

### Root-account protection

`officers.manage` can change only the `officerRole` field, plus its update metadata, on an ordinary director account. It cannot change account status, Board status, voting eligibility, permissions, login identity, or root/system role.

The protected Founder root account can receive an officer term only when the Founder is the authenticated actor. A delegated officer manager cannot modify the root account.

## Board Tasks

Collection:

```text
boardTasks
```

Representative fields:

```text
taskNumber
title
description
ownerUids
ownerNames
priority
status
dueDate
relatedMeetingId
relatedResolutionId
relatedDocumentUrl
committeeId
completionNote
completedAt
```

Priorities:

```text
low
normal
high
urgent
```

Statuses:

```text
open
in_progress
completed
cancelled
```

Users with `tasks.create` can create assignments. Users with `tasks.manage` can view and manage the complete task set.

An ordinary assigned director with `tasks.updateOwn` can update only the operational completion state of their own task. They cannot silently reassign the task, rewrite its creator, or change ownership/priority through the self-service rule.

Non-managers load assigned tasks with one single-field `array-contains` query on `ownerUids`.

## Compliance

Collection:

```text
complianceItems
```

Representative fields:

```text
complianceNumber
title
description
category
status
dueDate
recurrence
ownerUid
ownerName
authorityOrSource
sourceDocumentUrl
completionNote
completedAt
```

Categories:

```text
corporate
tax
registration
policy
board
financial
program
other
```

Statuses:

```text
pending
due
completed
waived
```

The client derives display states such as **Overdue**, **Due Today**, **Due Soon**, and **Upcoming** from the stored date and status. This avoids scheduled backend jobs while still making the compliance dashboard operational when opened.

Source policies, filing instructions, confirmations, or other documents remain Google links.

## Governance event trail

Collection:

```text
governanceEvents
```

Phase 8 operations write append-only event records for committee changes, COI actions, officer actions, Board tasks, and compliance changes.

These events are readable only by governance managers. Legitimate self-service actions such as a director submitting their COI disclosure or updating an assigned task may write their own event, but the event actor UID must always match the authenticated user.

Phase 9 will build the broader Founder audit/security console around these and the existing administrative audit records.

## No manual/composite indexes

Phase 8 continues the existing no-index architecture.

Representative reads are:

```text
boardDirectory.directoryVisible == true
coiDisclosures.directorUid == currentUid
conflictRecords.directorUid == currentUid
boardTasks.ownerUids array-contains currentUid
```

Committee, officer, compliance, and manager-level governance lists use authorized plain collection reads and browser-side sorting/filtering.

There is intentionally no `firestore.indexes.json`.

## Phase 9 handoff

Phase 9 can now focus on Founder Director administration, security controls, session/access oversight, and consolidated audit review rather than having to build the underlying governance workflows themselves.
