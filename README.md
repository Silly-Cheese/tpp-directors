# The Prayer Project — Board of Directors Portal

Private governance portal for The Prayer Project Board of Directors.

## Production target

- **Site:** `https://directors.ask4prayers.com`
- **Hosting:** GitHub Pages
- **Repository:** `Silly-Cheese/tpp-directors`
- **Firebase project:** `tpp-direc`
- **Firebase services allowed:** Authentication and Cloud Firestore only
- **Firebase Hosting / Storage / Functions:** Not used
- **Manual/composite Firestore indexes:** Not used
- **File uploads:** None. Official Board documents and minutes remain Google Docs / Drive / Sheets / Slides links.

## Phase status

### Phase 1 — Foundation: COMPLETE

Static GitHub Pages application, Firebase connection, protected Founder root model, deny-by-default governance foundation, and Google-link-only document policy.

### Phase 2 — Accounts, PIN Authentication & Permissions: CODE COMPLETE

Founder-created Board accounts, Full Name + four-digit PIN experience, activation codes, permission templates plus individual capabilities, protected Founder root identity, recovery flows, and administrative audit records.

### Phase 3 — Director Dashboard & Board Directory: COMPLETE

Operational dashboard, Board-facing director directory separated from secure account records, director terms/status/voting eligibility, Founder controls, and Board notices.

### Phase 4 — Board Document Center & Board Inbox: COMPLETE

Google-link-only Board document submissions, access scopes, review lifecycle, Board Inbox, Agenda Ready handoff, revision history, and mutation-bound append-only document events.

### Phase 5 — Board Meetings, Check-In, Attendance & Quorum: POLISHED / CODE COMPLETE

Live Meeting Room, scheduled meetings, invited/voting roster snapshots, check-in, live attendance, quorum, lifecycle controls, attendance locking after adjournment/cancellation, and Founder-assignable meeting permissions.

### Phase 6 — Agenda, Motions, Live Voting & Resolution Registry: FINISHED / CODE COMPLETE

Implemented and hardened:

- live agendas and Agenda Ready Google-document attachment;
- present voting-eligible motions and seconds;
- vote-level recusals;
- approve / oppose / abstain ballots;
- recorded and confidential ballot modes;
- simple-majority, majority-of-eligible, and two-thirds thresholds;
- immutable deterministic ballot records;
- portal-wide **VOTE NOW** alerts;
- corrected per-vote recorded-ballot audit;
- one `activeVoteId` lock per meeting;
- atomic prevention of overlapping pushed votes;
- vote lifecycle `open -> closing -> closed` so ballot intake freezes before tally finalization;
- meeting recess/adjourn protection while a vote is active;
- automatic preliminary `BR-YYYY-XXXXXX` resolution records;
- Resolution Registry;
- no manual/composite indexes.

### Phase 7 — Minutes, Certification & Permanent Board Records: CODE COMPLETE

Implemented:

- Google-linked official minutes;
- structured minutes metadata inside the portal;
- `draft -> ready -> certified` minutes lifecycle;
- separate `minutes.view`, `minutes.edit`, `minutes.certify`, `records.view`, and `records.certify` capabilities;
- minutes readiness only after adjournment;
- return-to-draft correction workflow before certification;
- deterministic `meetingMinutes/{meetingId}` records;
- immutable `meetingRecords/{meetingId}` certified master records;
- `BMR-YYYY-XXXXXX` permanent record numbers;
- immutable typed `meetingRecordEntries` snapshots;
- preserved attendance, agenda, motions, votes, resolutions, and recusals;
- confidential ballot choices excluded from the permanent snapshot while original immutable ballots retain Phase 6 access controls;
- resolution certification in the same atomic record-sealing batch;
- meeting-level record seal without changing historical `adjourned` meeting status;
- immutable certification event;
- searchable **Board Records** portal section;
- print-friendly certified record view;
- Phase 7 browser QA harness;
- consolidated Phase 1–7 Firestore Security Rules;
- no manual/composite indexes.

**External production verification is still required** after GitHub Pages, Firebase Authentication, DNS, Founder bootstrap, and the current Firestore Security Rules are configured/deployed. That is deployment work rather than unfinished generation.

## Implementation phases

1. **Foundation — complete**
2. **Accounts, PIN authentication, permissions — code complete**
3. **Director dashboard & Board directory — complete**
4. **Google-link document center & Board Inbox — complete**
5. **Meetings, activation, live check-in, attendance and quorum — polished / code complete**
6. **Agenda, motions, resolutions and live voting — finished / code complete**
7. **Minutes, certifications and permanent Board records — code complete**
8. Committees, conflicts, officer management, tasks and compliance
9. Founder Director administration, audit and security controls
10. Operational hardening, production testing and launch

## Security principles

- Firestore Security Rules are the authorization boundary; hidden UI is not security.
- Founder Director is the protected root portal identity.
- Other accounts receive granular Founder-assigned capabilities.
- PINs and activation codes are never stored in Firestore.
- Firebase Storage and Functions are not used.
- Board files remain Google-hosted links.
- Google sharing permissions remain independent from portal authorization.
- Attendance becomes immutable after adjournment/cancellation.
- A meeting may own only one active pushed vote at a time.
- Ballots stop accepting writes before vote totals are finalized.
- Ballots are deterministic per vote/director and cannot be updated or deleted after submission.
- Confidential ballots are not represented as cryptographically anonymous.
- Preliminary resolutions become certified only when the permanent meeting record is sealed.
- Certified meeting records and certified record entries cannot be rewritten or deleted through the portal rules.
- Portal certification is a record-locking workflow; it does not invent legal authority or replace any approval required by governing documents or applicable law.
- No bootstrap secret is embedded in the public GitHub Pages client.
- No manual/composite Firestore indexes are defined or deployed.

## Firestore collections currently opened by phase

```text
directors             secure account / authorization records
loginDirectory        exact pre-auth name lookup
boardDirectory        Board-facing director profiles
announcements         Board notices
documents             Google-linked Board document metadata
documentEvents        append-only document lifecycle history
meetings              Board meeting records / active-vote lock / record seal
meetingAttendance     one attendance record per meeting/director
agendaItems           live meeting agenda records
motions               mover / seconder / motion lifecycle
votes                 pushed vote definitions and result totals
voteBallots           immutable per-voter ballots
voteRecusals          vote-level recusals
resolutions           preliminary/certified Board resolutions
meetingMinutes        Google-linked structured minutes metadata
meetingRecords        immutable certified meeting master records
meetingRecordEntries  immutable certified source snapshots
recordEvents          permanent record-certification events
system                Founder-only counters/config foundation
auditEvents           administrative audit records
```

Future Phase 8+ governance collections remain deny-by-default until implemented.

## No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

Phases 1–7 use direct document reads, authorized plain collection reads, or one single-field equality / `array-contains` filter at a time. Sorting, searching, quorum math, vote thresholds, record summaries, and other aggregation remain client-side.

Deploy rules only:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

`firebase.json` references only `firestore.rules`.

## Serverless quorum boundary

The portal intentionally uses GitHub Pages + Firebase Authentication + Cloud Firestore only. The live client calculates meeting-wide quorum from Phase 5 attendance and preserves the quorum snapshot with each vote. Firestore Rules validate each ballot against the frozen vote eligibility and the voter's current present attendance record, but there is no trusted server-side aggregation service.

Phase 7 preserves the meeting attendance data and quorum snapshots in the certified record for audit.

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md`
- `docs/PHASE-2-AUTHENTICATION.md`
- `docs/PHASE-3-DIRECTOR-WORKSPACE.md`
- `docs/PHASE-4-DOCUMENT-CENTER.md`
- `docs/PHASE-5-MEETINGS.md`
- `docs/PHASE-6-LIVE-ACTIONS.md`
- `docs/PHASE-7-PERMANENT-RECORDS.md`
- `docs/FOUNDER-BOOTSTRAP.md`
- `docs/DEPLOYMENT.md`

## Browser QA harnesses

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
/tests/phase5-meetings.html
/tests/phase6-governance.html
/tests/phase7-records.html
```

Serve the repository over HTTP before opening the harnesses:

```bash
python -m http.server 8080
```

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore Rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time actions.
