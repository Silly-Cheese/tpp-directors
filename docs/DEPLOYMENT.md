# Production Deployment

The portal targets `https://directors.ask4prayers.com`, is hosted with GitHub Pages, and uses only Firebase Authentication + Cloud Firestore from project `tpp-direc`.

## 1. GitHub Pages

Repository: `Silly-Cheese/tpp-directors`

Enable Pages from the `main` branch and repository root. The repository contains `index.html`, `.nojekyll`, and `CNAME` with `directors.ask4prayers.com`.

The static page uses one primary script entry. `firebase.js` dynamically loads the Phase 5 Meeting Room, Phase 6 live-governance tools, and Phase 7 minutes/permanent-record modules without a build step.

## 2. DNS

Configure `directors.ask4prayers.com` for the GitHub Pages site and keep the repository `CNAME` file.

## 3. Firebase Authentication

In Firebase project `tpp-direc`:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` to authorized domains if needed.
3. Do not enable Firebase Hosting, Storage, Functions, or other Firebase products for this portal.

Directors never enter an email address. Email/password is only the internal Firebase backing credential for the Full Name + four-digit PIN experience.

## 4. Cloud Firestore

Create/confirm Cloud Firestore and deploy the current consolidated Phase 1–7 rules:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

### No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

`firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for the portal. Phases 1–7 use direct document reads, authorized plain collection reads, or one single-field equality / `array-contains` query at a time, with browser-side merge/filter/sort and aggregation where needed.

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

Create multiple voting-eligible directors and accounts with appropriate meeting permissions.

Verify:

- Meetings opens the real Meeting Room on GitHub Pages;
- module loading requires no extra HTML script tag;
- meeting creation and `BM-YYYY-XXXXXX` numbering work;
- invited/voting-eligible roster snapshots and deterministic attendance records are created;
- check-in, Departed/return, Excused/Absent, and live attendance work across devices;
- non-voting directors do not increase voting quorum;
- attendance changes update quorum immediately;
- attendance locks after Adjourned/Cancelled;
- lifecycle permissions are enforced;
- an Adjourned meeting cannot be silently reopened.

## 10. Phase 6 live-governance verification

Use at least two present voting-eligible directors, an agenda manager, and a vote controller.

### Agenda / motions

Verify Agenda Ready Google documents can be attached, closed agenda items reject new motions, a present voting-eligible director can make a motion, the mover cannot second it, and a different present voting-eligible director can second it.

### Active-vote lock

Verify:

- a newly created meeting has `activeVoteId: null`;
- pushing a vote atomically changes `activeVoteId` to that vote ID;
- attempting to push a second vote for the same meeting is rejected;
- a meeting with an active vote cannot Recess or Adjourn;
- another controller cannot bypass the active-vote lock with a direct Firestore write.

### Vote push / quorum / recusals

Verify:

- only a `ready` motion can be pushed;
- the client blocks push when live quorum is absent;
- frozen eligible voters contain present voting-eligible directors minus recusals;
- deterministic recusal records are created;
- recused directors are excluded from the ballot;
- out-of-population eligible/recusal UIDs are rejected by rules.

### Ballots

Verify Approve / Oppose / Abstain on separate accounts/devices. Confirm deterministic `{voteId}_{directorUid}` IDs, one immutable ballot per voter, present-status enforcement, frozen voter-list enforcement, recorded-ballot auditing, and confidential-ballot access restrictions.

### Two-stage vote close

Verify:

```text
open -> closing -> closed
```

Specifically:

- `votes.close` is required;
- close-time live quorum is checked by the normal client workflow;
- moving to `closing` stops additional ballot creation;
- a ballot write attempted after `closing` begins is rejected;
- final totals equal Approve + Oppose + Abstain;
- all three threshold modes calculate expected results;
- the final transaction clears `meeting.activeVoteId`;
- the motion becomes Adopted/Failed;
- the agenda item becomes Completed;
- a preliminary `BR-YYYY-XXXXXX` resolution is created with `certified: false`.

### Pushed-vote alert

Verify an eligible director receives the portal-wide **VOTE NOW** alert while on Overview, Documents, Directors, or another portal view, and that it changes to **BALLOT RECORDED** after their deterministic ballot is created.

## 11. Phase 7 minutes & certification verification

Use an Adjourned meeting that contains at least one closed Phase 6 vote/resolution.

### Minutes draft

Verify:

- `minutes.view` controls visibility;
- `minutes.edit` is required to create/update `meetingMinutes/{meetingId}`;
- the minutes document itself is a Google link, never an upload;
- Google Docs / Drive / Sheets / Slides HTTPS links are accepted;
- unsupported URLs are rejected;
- structured opening/discussion/other-business/closing notes save correctly;
- a Cancelled meeting cannot use the ordinary official-minutes workflow;
- a certified meeting cannot be edited.

### Ready for Certification

Verify:

- `minutes.certify` is required;
- only an Adjourned meeting can move Draft minutes to Ready;
- a valid official Google minutes link is required;
- Ready minutes are read-only in the ordinary editor;
- an authorized minutes editor can return Ready minutes to Draft before final certification.

### Permanent record certification

Verify `records.certify` separately from minutes editing permissions.

Certification must be rejected when:

- the meeting is not Adjourned;
- `activeVoteId` remains set;
- any vote is Open or Closing;
- minutes are not Ready;
- the official minutes Google link is invalid/missing;
- a certified `meetingRecords/{meetingId}` already exists.

For a valid certification, verify one atomic operation produces/updates:

```text
meetingRecords/{meetingId}
meetingRecordEntries/*
meetingMinutes/{meetingId}
meetings/{meetingId}
resolutions/* for that meeting
recordEvents/{meetingId}_certified
```

Then verify:

- master record number uses `BMR-YYYY-XXXXXX`;
- meeting remains historically `status: adjourned`;
- meeting receives `recordStatus: certified` and record/minutes links;
- minutes become `certified`;
- preliminary meeting resolutions become `certified: true` and reference the meeting record;
- record entries preserve attendance, agenda, motion, vote, resolution, and recusal snapshots;
- confidential individual ballot choices are not copied into the permanent snapshot;
- original immutable ballots retain their Phase 6 access controls;
- certified master records cannot be updated/deleted;
- certified record entries cannot be updated/deleted;
- certified resolutions cannot be arbitrarily rewritten;
- the deterministic certification event cannot be rewritten/deleted.

### Board Records UI

Verify:

- **Board Records** is visible only to accounts with `records.view`;
- certified records appear without a composite-index prompt;
- search works client-side;
- official Google minutes open in a new tab;
- attendance/agenda/motions/votes/resolutions/recusals render under the correct certified meeting;
- Print Record produces the print-focused certified-record view.

## 12. Browser QA harnesses

Serve the repository locally over HTTP and open:

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
/tests/phase5-meetings.html
/tests/phase6-governance.html
/tests/phase7-records.html
```

The harnesses are non-destructive and do not write to Firebase. Phase 7 checks record-summary counting, minutes status labels, the Phase 6 `closing` state, and threshold math used by certified results.

## 13. No-index verification

No Phase 1–7 workflow should request a manual/composite index.

Representative single-field reads include:

```text
meetingAttendance.meetingId == selectedMeetingId
agendaItems.meetingId == selectedMeetingId
motions.meetingId == selectedMeetingId
votes.meetingId == selectedMeetingId
voteRecusals.meetingId == selectedMeetingId
resolutions.meetingId == selectedMeetingId
meetingRecordEntries.meetingId == selectedMeetingId
```

Recorded ballots may use deterministic direct document reads. Search, sorting, filtering, quorum math, vote thresholds, and permanent-record summaries occur in the browser.

## 14. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- direct file uploads
- manual/composite Firestore indexes

Board documents and official minutes remain Google-hosted links unless the project requirements are explicitly changed.
