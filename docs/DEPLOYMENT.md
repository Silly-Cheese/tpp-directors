# Production Deployment

The portal targets `https://directors.ask4prayers.com`, is hosted with GitHub Pages, and uses only Firebase Authentication + Cloud Firestore from project `tpp-direc`.

## 1. GitHub Pages

Repository: `Silly-Cheese/tpp-directors`

Enable Pages from the `main` branch and repository root.

The repository contains:

- `index.html`
- `CNAME` with `directors.ask4prayers.com`
- `.nojekyll`

GitHub Pages is an external repository setting; committing these files alone does not enable it.

## 2. DNS

Configure `directors.ask4prayers.com` for the GitHub Pages site and keep the repository `CNAME` file.

## 3. Firebase Authentication

In Firebase project `tpp-direc`:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` to authorized domains if needed.
3. Do not enable Firebase Hosting, Storage, Functions, or other Firebase products for this portal.

Directors do not enter an email address. The email/password provider is only the internal Firebase backing credential for the Full Name + four-digit PIN experience.

## 4. Cloud Firestore

Create/confirm Cloud Firestore and deploy the repository Security Rules:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

### No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

`firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for the portal. Phase 1–5 query design uses direct reads, authorized plain collection reads, or one single-field equality / `array-contains` query at a time with browser-side merge/filter/sort.

## 5. Founder bootstrap

Follow `docs/FOUNDER-BOOTSTRAP.md` before using Founder Control.

The root Founder identity must exist before ordinary accounts can be provisioned.

After Founder activation, Founder Control can backfill a missing `boardDirectory/{FOUNDER_UID}` mirror if the initial console bootstrap omitted it.

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
- suspended/inactive users lose portal access through the live profile listener;
- PIN recovery preparation produces the documented Firebase-admin recovery package;
- ordinary users cannot create/promote/demote the Founder root identity.

## 7. Phase 3 workspace verification

Verify:

- dashboard Board metrics render;
- Board profile/term/voting data render;
- Board directory search and status filters work;
- ordinary directory listing returns only `directoryVisible == true` records;
- a hidden directory record cannot be read by an ordinary director through a direct Firestore request;
- Founder root can administer hidden directory records;
- only published Board notices are readable by ordinary directors;
- archived notices disappear from ordinary notice reads, not merely the UI;
- notice publishing/archive works for authorized managers;
- Phase 3 workflows do not request a composite index.

## 8. Phase 4 document verification

Create at least one Standard Director and one account with `documents.review`.

### Google-link-only submission

Verify:

- the portal contains no file input;
- Google Docs links are accepted;
- Google Sheets links are identified correctly;
- Google Slides links are identified correctly;
- Google Drive links are accepted;
- non-Google URLs are rejected by the client;
- a direct Firestore attempt to write a non-Google document URL is rejected by Security Rules;
- HTTP/non-HTTPS Google links are rejected;
- the underlying Google file still requires appropriate Drive sharing permissions.

### Document access scopes

Verify with separate accounts:

- **Board** records are readable by directors with `documents.view`;
- **Board Officers** records are not readable by non-officers;
- **Board Officers** records are readable by an officer with `documents.view`;
- **Selected Directors** records are readable only by selected UIDs, the submitter, reviewers, and Founder root;
- **Founder Director Only** records are not returned to ordinary directors or non-Founder reviewers;
- the submitting director can still see their own Founder-only submission;
- Founder root can review Founder-only records.

### Board Inbox and lifecycle

Verify:

- newly submitted documents appear in the Board Inbox for reviewers;
- Begin Review changes `submitted -> under_review`;
- Return for Revision requires a note;
- the submitter can revise a returned record and resubmit it;
- revision number increments;
- Agenda Ready status works;
- permitted approve/reject/table transitions work;
- invalid status jumps are rejected by the client and Firestore rules;
- archived records cannot be reopened directly;
- every accepted lifecycle mutation creates an append-only `documentEvents` entry;
- each mutation changes `lastEventId` to a fresh event ID;
- trying to reuse an existing event ID in `lastEventId` is rejected;
- trying to create an unrelated event whose ID does not equal the document's reserved `lastEventId` is rejected;
- the record detail page opens the Google link in a new tab;
- search/category/status filters work client-side.

## 9. Phase 5 meeting verification

Create at least two voting-eligible directors plus accounts with the relevant meeting permissions.

### Meeting creation

Verify:

- an account without `meetings.create` cannot create a meeting;
- an authorized creator can create Regular, Special, Organizational, and Emergency meetings;
- meeting mode accepts In Person, Virtual, and Hybrid;
- meeting numbers use `BM-YYYY-XXXXXX`;
- the invited roster is stored as a snapshot;
- the voting-eligible invited roster is stored separately;
- deterministic `meetingAttendance/{meetingId}_{directorUid}` records are created for invitees;
- a direct attempt to create a duplicate/mismatched attendance document ID is rejected;
- quorum cannot exceed the number of invited voting-eligible directors;
- leaving quorum blank uses the client majority helper;
- no meeting creation query requests a manual/composite index.

### Activation and self check-in

Verify:

- `scheduled -> checkin_open` requires `meetings.activate`;
- an invited director can self-check-in after check-in opens;
- a non-invited director cannot create or mutate an attendance record to join the meeting;
- self check-in sets `presenceStatus: present` and `checkedInAt`;
- a departed director can return and receives `returnedAt`;
- return/self check-in remains available during recess;
- self check-in is rejected while the meeting is merely Scheduled;
- self check-in is rejected after Adjourned or Cancelled.

### Attendance and quorum

Verify:

- `meetings.attendance.manage` is required to change another director's attendance;
- attendance managers can mark Excused before check-in opens;
- Present / Departed / Absent cannot be recorded before check-in opens;
- live attendance changes appear on another signed-in device without refresh;
- non-voting directors may be marked Present but do not increase the voting quorum count;
- a voting-eligible Present director increases the quorum count;
- marking that director Departed immediately reduces the quorum count;
- quorum is derived from attendance and is not stored as a writable `quorumAchieved` field;
- attendance changes are rejected after Adjourned or Cancelled.

### Live meeting control

Verify:

- Call to Order requires `meetings.control`;
- `checkin_open -> in_session` works;
- `in_session -> recessed` works;
- `recessed -> in_session` works;
- `in_session/recessed -> adjourned` works;
- Scheduled/Check-In Open meetings can be Cancelled by an authorized controller;
- an Adjourned meeting cannot be reopened through Phase 5;
- meeting lifecycle writes cannot alter invited roster, eligible-voter snapshot, quorum requirement, meeting number, or creator fields;
- the dashboard meeting banner reflects an active/open meeting;
- the Meeting Room shows live status and quorum on multiple devices.

## 10. Browser QA harnesses

Serve the repo locally over HTTP and open:

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
/tests/phase5-meetings.html
```

The harnesses are non-destructive. Phase 5 validates majority quorum calculation, attendance-derived quorum, readable meeting status labels, and allowed/forbidden meeting lifecycle transitions.

## 11. No-index verification

Phase 4/5 must not prompt for a manual/composite index.

Representative Phase 4 single-field reads:

```text
submittedBy == currentUid
accessScope == board
accessScope == officers
allowedDirectorUids array-contains currentUid
documentId == selectedDocumentId
```

Representative Phase 5 attendance read:

```text
meetingId == selectedMeetingId
```

Meeting lists are authorized plain collection reads. Sorting/searching/filtering/quorum calculation happen in the browser.

## 12. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- direct file uploads
- manual/composite Firestore indexes

Board documents remain Google-hosted links throughout later phases unless the project requirements are explicitly changed.
