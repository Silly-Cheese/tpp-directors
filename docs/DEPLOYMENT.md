# Production Deployment

The portal targets `https://directors.ask4prayers.com`, is hosted with GitHub Pages, and uses only Firebase Authentication + Cloud Firestore from project `tpp-direc`.

## 1. GitHub Pages

Repository: `Silly-Cheese/tpp-directors`

Enable Pages from the `main` branch and repository root. The repository contains `index.html`, `.nojekyll`, and `CNAME` with `directors.ask4prayers.com`.

The static page uses one primary script entry. `firebase.js` dynamically loads the live Meeting Room, voting, permanent-record, Phase 7 preflight, and Phase 8 governance modules without a build step.

## 2. DNS

Configure `directors.ask4prayers.com` for the GitHub Pages site and keep the repository `CNAME` file.

## 3. Firebase Authentication

In Firebase project `tpp-direc`:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` to authorized domains if needed.
3. Do not enable Firebase Hosting, Storage, Functions, or other Firebase products for this portal.

Directors never enter an email address. Email/password is only the internal Firebase backing credential for the Full Name + four-digit PIN experience.

## 4. Cloud Firestore

Create/confirm Cloud Firestore and deploy the current consolidated Phase 1–8 rules:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

### No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

`firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for the portal. Phases 1–8 use direct document reads, authorized plain collection reads, or one single-field equality / `array-contains` query at a time, with browser-side merge/filter/sort and aggregation where needed.

## 5. Founder bootstrap

Follow `docs/FOUNDER-BOOTSTRAP.md` before using Founder Control. The protected Founder identity must exist before ordinary accounts can be provisioned.

## 6. Phase 2 account verification

Verify Full Name first-step login, activation-code use, four-digit PIN setup/subsequent sign-in, Founder provisioning session isolation, `DIR-######` creation, PIN recovery, suspension enforcement, and Founder-root protection.

## 7. Phase 3 workspace verification

Verify dashboard metrics, Board profile/term/voting data, directory filters, hidden-directory protection, published-only ordinary notice access, notice management, and the absence of composite-index prompts.

## 8. Phase 4 document verification

Verify:

- no file input exists;
- Google Docs / Drive / Sheets / Slides HTTPS links are accepted;
- non-Google and HTTP links are rejected by both client and rules;
- Board / Officers / Selected Directors / Founder-only scopes behave correctly;
- Board Inbox transitions and revision/resubmission work;
- Agenda Ready works;
- invalid lifecycle jumps are rejected;
- every accepted mutation reserves a fresh `lastEventId` and matching immutable history record;
- Google Drive permissions still govern the underlying file.

## 9. Phase 5 meeting verification

Create multiple voting-eligible directors and accounts with appropriate meeting permissions. Verify the live Meeting Room, meeting creation, roster snapshots, deterministic attendance, check-in/departure/return, quorum changes across devices, lifecycle permissions, and attendance locking after adjournment/cancellation.

## 10. Phase 6 live-governance verification

Use at least two present voting-eligible directors, an agenda manager, and a vote controller.

Verify:

- Agenda Ready Google documents attach correctly;
- present eligible directors can make/second motions;
- `activeVoteId` is claimed atomically when a vote opens;
- a second overlapping vote is rejected;
- Recess/Adjourn is blocked while a vote is active;
- live quorum gates vote push and normal close initiation;
- recusals are removed from the frozen ballot list;
- deterministic immutable ballots accept Approve/Oppose/Abstain;
- recorded/confidential ballot access behaves correctly;
- `open -> closing -> closed` freezes ballot intake before tally finalization;
- closing recovery can safely finish a frozen `closing` vote after an interrupted client session;
- finalization clears `activeVoteId`, completes the motion/agenda item, and creates a preliminary resolution.

## 11. Phase 7 minutes & certification verification

Use an Adjourned meeting containing at least one closed Phase 6 vote/resolution.

### Minutes

Verify `minutes.view`, `minutes.edit`, and `minutes.certify` independently. Confirm the official minutes remain a Google link, structured notes save correctly, Ready minutes are read-only until returned to Draft, and a Cancelled/certified meeting cannot use the ordinary editing workflow.

### Certification preflight

Before the final certification transaction, verify the normal portal blocks certification if:

- the meeting is not Adjourned;
- `activeVoteId` remains set;
- an agenda item remains `active`;
- a motion remains `voting`;
- a vote remains `open` or `closing`.

If a motion remains `pending_second` or `ready` at adjournment, verify the portal explicitly warns that the unresolved state will be preserved before continuing.

### Permanent record

Verify `records.certify` separately from minutes editing. A valid atomic certification should create/update:

```text
meetingRecords/{meetingId}
meetingRecordEntries/*
meetingMinutes/{meetingId}
meetings/{meetingId}
resolutions/* for that meeting
recordEvents/{meetingId}_certified
```

Confirm the meeting remains historically Adjourned, minutes/resolutions become certified, permanent snapshots preserve the meeting history, confidential individual ballot choices are not copied into the certified snapshot, and certified records cannot be rewritten/deleted.

## 12. Phase 8 governance verification

Before testing ordinary users, reapply or explicitly add the intended Phase 8 permissions to existing accounts. Existing director records do not automatically rewrite their permission arrays when code templates change.

### Committees

Verify:

- `committees.view` controls access;
- `committees.manage` is required to create/update committees;
- standing/ad hoc/special types work;
- Active/Inactive/Disbanded states work;
- an Active committee cannot be saved without members;
- selecting a Chair includes that director in membership;
- the charter field accepts only Google HTTPS links when populated;
- committee membership changes do not alter Board status or voting eligibility.

### Annual COI disclosures

Use at least one standard director and one `coi.review` account.

Verify:

- a standard director sees only their own annual disclosure records;
- `coi.submit` creates `{directorUid}_{year}` records;
- a valid Google disclosure link is required;
- the reviewer can see Board-wide disclosures;
- Reviewed records cannot be silently overwritten by the director;
- Renewal Required reopens the self-service resubmission path;
- unrelated directors cannot read another ordinary director's disclosure through direct Firestore access.

### Specific conflict records

Verify:

- a director with `coi.submit` can create a conflict record only for themselves;
- `coi.manage` can record/manage another director's conflict;
- meeting/agenda/vote references can be preserved;
- related supporting records use Google links only;
- Managed/Resolved updates cannot rewrite the conflict's identity/creator fields.

### Officer terms

Verify:

- `officers.view` exposes current/history records;
- `officers.manage` is required to create/conclude terms;
- election/appointment/interim/confirmation bases work;
- a new term creates `OFF-YYYY-XXXXXX` history;
- a conflicting current holder for the same title is concluded;
- another active term held by the newly selected director is concluded;
- current `officerRole` is synchronized to both `directors` and `boardDirectory`;
- a delegated officer manager cannot change account status, Board status, voting eligibility, permissions, login identity, root status, or system role;
- a delegated officer manager cannot modify the Founder root account;
- the authenticated Founder can record an officer term for the Founder root if desired.

### Board tasks

Verify:

- `tasks.create` can create a task with one or more owners;
- non-managers with `tasks.view` see only tasks whose `ownerUids` contain their UID;
- `tasks.updateOwn` allows Start/Complete on an assigned task;
- self-service task updates cannot reassign owners or change priority/creator fields;
- `tasks.manage` can manage the full task set;
- related supporting material remains a Google link;
- the owner query does not request a composite index.

### Compliance

Verify:

- `compliance.view` controls Board visibility;
- `compliance.manage` is required for create/update;
- categories/statuses save correctly;
- source documents accept Google links only;
- due-state labels correctly show Overdue, Due Today, Due Soon, Upcoming, or Unscheduled;
- no background scheduler or Cloud Function is used for due-state calculation.

### Governance events

Verify committee, COI, officer, task, and compliance changes create append-only `governanceEvents`. Ordinary self-service actions may create their own event, but cannot read the manager-wide event log unless they separately hold a governance-management permission.

## 13. Browser QA harnesses

Serve the repository locally over HTTP and open:

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
/tests/phase5-meetings.html
/tests/phase6-governance.html
/tests/phase7-records.html
/tests/phase8-governance.html
```

The harnesses are non-destructive. Phase 8 checks governance-state labels and date-driven compliance/task due-state classification without writing to Firebase.

## 14. No-index verification

No Phase 1–8 workflow should request a manual/composite index.

Representative single-field reads include:

```text
meetingAttendance.meetingId == selectedMeetingId
agendaItems.meetingId == selectedMeetingId
motions.meetingId == selectedMeetingId
votes.meetingId == selectedMeetingId
meetingRecordEntries.meetingId == selectedMeetingId
boardDirectory.directoryVisible == true
coiDisclosures.directorUid == currentUid
conflictRecords.directorUid == currentUid
boardTasks.ownerUids array-contains currentUid
```

Search, sorting, filtering, quorum math, vote thresholds, due-state calculations, and summary metrics occur in the browser.

## 15. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- direct file uploads
- manual/composite Firestore indexes

All Board documents and supporting governance records remain Google-hosted links unless the project requirements are explicitly changed.
