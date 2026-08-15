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
- **File uploads:** None. Official Board documents, minutes, charters, COI forms, officer records, task attachments, and compliance sources remain Google Docs / Drive / Sheets / Slides links.

## Phase status

### Phase 1 — Foundation: COMPLETE

Static GitHub Pages application, Firebase connection, protected Founder root model, deny-by-default governance foundation, and Google-link-only document policy.

### Phase 2 — Accounts, PIN Authentication & Permissions: CODE COMPLETE

Founder-created Board accounts, Full Name + four-digit PIN experience, activation codes, granular permissions, protected Founder root identity, recovery flows, and administrative audit records.

### Phase 3 — Director Dashboard & Board Directory: COMPLETE

Operational dashboard, Board-facing director directory separated from secure account records, director terms/status/voting eligibility, Founder controls, and Board notices.

### Phase 4 — Board Document Center & Board Inbox: COMPLETE

Google-link-only Board document submissions, access scopes, review lifecycle, Board Inbox, Agenda Ready handoff, revision history, and append-only document events.

### Phase 5 — Board Meetings, Check-In, Attendance & Quorum: POLISHED / CODE COMPLETE

Live Meeting Room, scheduled meetings, invited/voting roster snapshots, check-in, live attendance, quorum, lifecycle controls, attendance locking after adjournment/cancellation, and Founder-assignable meeting permissions.

### Phase 6 — Agenda, Motions, Live Voting & Resolution Registry: FINISHED / CODE COMPLETE

Live agendas, motions/seconds, vote-level recusals, pushed approve/oppose/abstain ballots, recorded/confidential modes, threshold rules, deterministic immutable ballots, portal-wide **VOTE NOW** alerts, one-active-vote meeting lock, `open -> closing -> closed` vote lifecycle, closing recovery, preliminary `BR-YYYY-XXXXXX` resolutions, and the Resolution Registry.

### Phase 7 — Minutes, Certification & Permanent Board Records: FINISHED / CODE COMPLETE

Implemented and hardened:

- Google-linked official minutes;
- structured minutes metadata;
- `draft -> ready -> certified` lifecycle;
- separate minutes and record-certification permissions;
- return-to-draft correction before certification;
- deterministic `meetingMinutes/{meetingId}` records;
- immutable `meetingRecords/{meetingId}` master records;
- `BMR-YYYY-XXXXXX` permanent record numbers;
- immutable attendance/agenda/motion/vote/resolution/recusal snapshots;
- confidential ballot choices excluded from permanent snapshots;
- resolution certification in the same record-sealing batch;
- meeting-level record seal without rewriting historical `adjourned` status;
- immutable certification event;
- searchable/print-friendly **Board Records** section;
- certification preflight that blocks active agenda business, voting motions, unfinished votes, or an occupied active-vote lock;
- explicit warning before sealing a record that still contains unresolved `pending_second` or `ready` motions;
- Phase 7 QA harness;
- no manual/composite indexes.

### Phase 8 — Governance Operations Suite: CODE COMPLETE

Implemented:

- unified **Governance** portal section;
- standing / ad hoc / special committee management;
- committee chairs, members, purpose, status, charter Google link, and dates;
- annual director conflict-of-interest disclosures using Google links;
- Board-wide COI review workflow with `reviewed` / `renewal_required` states;
- specific conflict / recusal / management-plan records;
- private ordinary-director COI visibility with reviewer/Founder Board-wide access;
- historical officer-term records with election / appointment / interim / confirmation basis;
- protected officer-role synchronization to the director account and Board directory;
- Founder-root protection during officer changes;
- Board task creation, assignment, due dates, priorities, committee/meeting/resolution links, and self-service completion updates;
- compliance items with categories, due dates, recurrence, ownership, Google-source links, and completed/waived states;
- derived Overdue / Due Today / Due Soon / Upcoming display states without scheduled backend jobs;
- append-only Phase 8 governance events;
- Phase 8 granular permissions and updated role templates;
- Phase 8 Firestore Security Rules;
- Phase 8 browser QA harness;
- no manual/composite indexes.

**External production verification is still required** after GitHub Pages, Firebase Authentication, DNS, Founder bootstrap, and the current Firestore Security Rules are configured/deployed. That is deployment work rather than unfinished generation.

## Implementation phases

1. **Foundation — complete**
2. **Accounts, PIN authentication, permissions — code complete**
3. **Director dashboard & Board directory — complete**
4. **Google-link document center & Board Inbox — complete**
5. **Meetings, activation, live check-in, attendance and quorum — polished / code complete**
6. **Agenda, motions, resolutions and live voting — finished / code complete**
7. **Minutes, certifications and permanent Board records — finished / code complete**
8. **Committees, conflicts, officer management, tasks and compliance — code complete**
9. Founder Director administration, consolidated audit and security controls
10. Operational hardening, production testing and launch

## Security principles

- Firestore Security Rules are the authorization boundary; hidden UI is not security.
- Founder Director is the protected root portal identity.
- Other accounts receive granular Founder-assigned capabilities.
- PINs and activation codes are never stored in Firestore.
- Firebase Storage and Functions are not used.
- All Board files remain Google-hosted links.
- Google sharing permissions remain independent from portal authorization.
- Attendance becomes immutable after adjournment/cancellation.
- A meeting may own only one active pushed vote at a time.
- Ballots stop accepting writes before vote totals are finalized.
- Ballots are deterministic per vote/director and cannot be updated or deleted after submission.
- Confidential ballots are confidential, not represented as cryptographically anonymous.
- Certified meeting records and certified record entries cannot be rewritten or deleted through the portal rules.
- Committee membership does not alter legal Board membership.
- COI self-service access is limited to the authenticated director's own disclosure/conflict records unless review/manage authority is granted.
- `officers.manage` can change only current officer-role metadata on ordinary director accounts; it cannot change root/system role, login identity, Board status, voting eligibility, or general permissions.
- Delegated officer managers cannot modify the Founder root account. Founder-root officer changes require the authenticated Founder.
- Assigned directors may update their own task progress without silently changing ownership or task authority.
- Portal workflows enforce the configured data model but do not invent legal governance authority absent from governing documents or applicable law.
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
voteRecusals          vote-level meeting recusals
resolutions           preliminary/certified Board resolutions
meetingMinutes        Google-linked structured minutes metadata
meetingRecords        immutable certified meeting master records
meetingRecordEntries  immutable certified source snapshots
recordEvents          permanent record-certification events
committees             Phase 8 committee records
coiDisclosures         annual director COI disclosures
conflictRecords        specific conflict / recusal / management records
officerTerms           historical Board officer assignments
boardTasks             Board follow-up assignments
complianceItems        governance/compliance obligations
governanceEvents       append-only Phase 8 operational history
system                 Founder-only counters/config foundation
auditEvents            administrative audit records
```

Future Phase 9+ collections remain deny-by-default until implemented.

## No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

Phases 1–8 use direct document reads, authorized plain collection reads, or one single-field equality / `array-contains` filter at a time. Sorting, searching, quorum math, vote thresholds, due-state calculations, record summaries, and governance dashboard metrics remain client-side.

Deploy rules only:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

`firebase.json` references only `firestore.rules`.

## Serverless boundaries

The portal intentionally uses GitHub Pages + Firebase Authentication + Cloud Firestore only. Meeting-wide quorum is calculated from Phase 5 attendance in the live client and preserved with each vote; Firestore Rules validate individual ballot eligibility and presence. Phase 8 compliance due-state labels are calculated when the portal is used rather than by a scheduled backend worker.

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md`
- `docs/PHASE-2-AUTHENTICATION.md`
- `docs/PHASE-3-DIRECTOR-WORKSPACE.md`
- `docs/PHASE-4-DOCUMENT-CENTER.md`
- `docs/PHASE-5-MEETINGS.md`
- `docs/PHASE-6-LIVE-ACTIONS.md`
- `docs/PHASE-7-PERMANENT-RECORDS.md`
- `docs/PHASE-8-GOVERNANCE-OPS.md`
- `docs/FOUNDER-BOOTSTRAP.md`
- `docs/DEPLOYMENT.md`

## Browser QA harnesses

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
/tests/phase5-meetings.html
/tests/phase6-governance.html
/tests/phase7-records.html
/tests/phase8-governance.html
```

Serve the repository over HTTP before opening the harnesses:

```bash
python -m http.server 8080
```

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore Rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time actions.
