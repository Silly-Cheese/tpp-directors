# Production Deployment

The portal targets `https://directors.ask4prayers.com`, is hosted with GitHub Pages, and uses only Firebase Authentication + Cloud Firestore from project `tpp-direc`.

## 1. GitHub Pages

Repository: `Silly-Cheese/tpp-directors`

Enable Pages from the `main` branch and repository root.

The repository contains `index.html`, `.nojekyll`, and `CNAME` with `directors.ask4prayers.com`.

The static page has one primary script entry. `firebase.js` dynamically loads the Phase 5 Meeting Room, Phase 5 polish layer, and Phase 6 live-governance module so no build step is required.

## 2. DNS

Configure `directors.ask4prayers.com` for the GitHub Pages site and keep the repository `CNAME` file.

## 3. Firebase Authentication

In Firebase project `tpp-direc`:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` to authorized domains if needed.
3. Do not enable Firebase Hosting, Storage, Functions, or other Firebase products for this portal.

Directors never enter an email address. Email/password is only the internal backing credential for the Full Name + four-digit PIN experience.

## 4. Cloud Firestore

Create/confirm Cloud Firestore and deploy the current rules:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

### No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

`firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for the portal. Phases 1–6 use direct reads, authorized plain collection reads, or one single-field equality / `array-contains` query at a time, with browser-side merge/filter/sort where needed.

## 5. Founder bootstrap

Follow `docs/FOUNDER-BOOTSTRAP.md` before using Founder Control. The protected Founder identity must exist before ordinary accounts can be provisioned.

## 6. Phase 2 account verification

Verify:

- Full Name is the visible first login identifier;
- activation-code first use works;
- four-digit PIN setup works;
- subsequent Full Name + PIN sign-in works;
- Founder provisioning does not replace the Founder browser session;
- ordinary director creation produces `DIR-######` and a one-time activation code;
- the activation code is not stored in Firestore;
- self-service PIN change works;
- interrupted activation recovery works;
- suspended/inactive users lose portal access;
- ordinary users cannot create/promote/demote the Founder root identity.

## 7. Phase 3 workspace verification

Verify:

- dashboard Board metrics render;
- Board profile/term/voting data render;
- Board directory search/status filters work;
- ordinary directory reads return only `directoryVisible == true` records;
- hidden directory records cannot be read directly by ordinary directors;
- only published notices are readable by ordinary directors;
- archived notices remain available only to authorized managers;
- no Phase 3 workflow requests a composite index.

## 8. Phase 4 document verification

Verify:

- no file input exists;
- Google Docs / Drive / Sheets / Slides HTTPS links are accepted;
- non-Google and HTTP links are rejected by both client and rules;
- Board / Officers / Selected Directors / Founder-only scopes behave correctly;
- Founder-only submissions are not exposed to non-Founder reviewers;
- Board Inbox transitions work;
- Return for Revision and resubmission work;
- revision number increments;
- Agenda Ready status works;
- invalid status jumps are rejected;
- archived records cannot be silently reopened;
- each accepted lifecycle mutation reserves a fresh `lastEventId` and creates the matching immutable `documentEvents` record;
- unrelated/duplicate history events are rejected;
- Google Drive sharing permissions still govern the underlying file.

## 9. Phase 5 meeting verification

Create at least two voting-eligible directors plus accounts with appropriate meeting permissions.

### Module-loading / polish check

Verify on the real GitHub Pages site that:

- clicking **Meetings** opens the live Meeting Room rather than the old placeholder;
- Phase 5 loads without adding a second HTML script tag;
- select-all / clear-all invite controls work;
- selected invite count updates;
- lifecycle confirmation prompts appear;
- Firestore rerenders do not create a browser freeze or recursive MutationObserver loop.

### Meeting creation

Verify:

- `meetings.create` is required;
- meeting types/modes work;
- `BM-YYYY-XXXXXX` IDs are generated;
- invited and voting-eligible rosters are snapshotted;
- deterministic `meetingAttendance/{meetingId}_{directorUid}` records are created;
- mismatched/duplicate attendance IDs are rejected;
- quorum cannot exceed invited voting-eligible directors;
- leaving quorum blank uses the client majority helper.

### Activation / attendance / quorum

Verify:

- `scheduled -> checkin_open` requires `meetings.activate`;
- invited directors can self-check in only while allowed;
- non-invitees cannot create themselves into attendance;
- Departed directors can return, including during recess;
- attendance-manager permission is enforced;
- non-voting present directors do not increase voting quorum;
- present/departed voting directors immediately change the live quorum calculation;
- attendance becomes immutable after Adjourned/Cancelled.

### Live meeting control

Verify:

- Call to Order / Recess / Resume / Adjourn require `meetings.control`;
- pre-session cancellation works;
- an Adjourned meeting cannot be silently reopened;
- lifecycle writes cannot rewrite the meeting number, roster snapshots, quorum requirement, or creator fields;
- the dashboard live-meeting banner updates across devices.

## 10. Phase 6 live-governance verification

Use at least two present voting-eligible directors, an agenda manager, and a vote controller.

### Agenda

Verify:

- `agenda.manage` is required to add/manage agenda items;
- business/report/motion/resolution/election/other types can be created;
- agenda item ordering is stable client-side;
- an Agenda Ready Board document can be attached;
- an attached document receives `agendaMeetingId`;
- a non-Agenda-Ready document cannot be attached;
- a document already assigned to another meeting cannot be reassigned;
- agenda records are locked after Adjourned/Cancelled.

### Motions / seconds

Verify:

- a motion can be made only while the meeting is In Session;
- the mover must be Present and voting eligible;
- `motions.create` is required;
- a new motion begins `pending_second`;
- the mover cannot second their own motion;
- a second director must be Present, voting eligible, and have `motions.second`;
- seconding changes the motion to `ready`;
- mover/seconder names and UIDs remain snapshotted.

### Vote push / quorum / recusals

Verify:

- `votes.push` is required;
- only a `ready` motion can be pushed;
- the client blocks vote push when live Phase 5 quorum is not satisfied;
- the vote stores the quorum snapshot used to open it;
- the eligible-voter snapshot contains currently Present voting-eligible directors minus selected recusals;
- vote recusals create deterministic `voteRecusals/{voteId}_{directorUid}` records;
- recused directors do not receive an eligible ballot state;
- Firestore rejects eligible/recusal UIDs outside the meeting's voting-eligible population.

### Ballots

Verify with separate devices/accounts:

- `votes.cast` is required;
- eligible Present directors can vote Approve / Oppose / Abstain;
- a director cannot cast another director's ballot;
- the ballot ID is deterministic: `{voteId}_{directorUid}`;
- a second ballot write for the same voter is rejected;
- ballot update/delete is rejected;
- a director marked Departed after vote-open cannot cast until Present again;
- a director not in the vote's frozen eligible-voter snapshot cannot cast even if later marked Present;
- recorded ballots become auditable according to the vote-record rules;
- confidential ballots are readable by the voter, Founder root, and authorized vote closer, but not ordinary Board viewers.

### Vote thresholds / close

Verify all three modes with known ballot totals:

- `simple_majority_cast`;
- `majority_eligible`;
- `two_thirds_cast`.

Also verify:

- `votes.close` and `resolutions.create` are required to close through the workflow;
- closing writes approve/oppose/abstain totals;
- `ballotCount` equals the three totals;
- the closed vote result is Adopted or Failed;
- the motion is closed to the same result state;
- the agenda item becomes Completed;
- a `BR-YYYY-XXXXXX` resolution record is created;
- the resolution record begins `certified: false` for Phase 7.

### Serverless quorum boundary

Manually verify that the stored vote quorum snapshot matches the underlying Phase 5 attendance records at the moment the vote was pushed. The client performs the roster-wide quorum aggregation. Firestore Rules independently validate individual ballots against the open vote, eligible-voter snapshot, and the voter's current Present attendance record.

## 11. Browser QA harnesses

Serve the repository locally over HTTP and open:

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
/tests/phase5-meetings.html
/tests/phase6-governance.html
```

The Phase 6 harness checks threshold math and readable governance status labels without writing to Firebase.

## 12. No-index verification

Phase 6 must not prompt for a manual/composite index.

Representative reads remain single-field:

```text
meetingAttendance.meetingId == selectedMeetingId
agendaItems.meetingId == selectedMeetingId
motions.meetingId == selectedMeetingId
votes.meetingId == selectedMeetingId
voteBallots.voteId == selectedVoteId
voteRecusals.voteId == selectedVoteId
```

Search, sorting, filtering, quorum math, and threshold math occur in the browser.

## 13. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- direct file uploads
- manual/composite Firestore indexes

Board documents remain Google-hosted links unless the project requirements are explicitly changed.
