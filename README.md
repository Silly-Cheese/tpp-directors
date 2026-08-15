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
- **File uploads:** None. Board documents are represented only by Google Docs / Drive / Sheets / Slides links.

## Phase status

### Phase 1 — Foundation: COMPLETE

Static GitHub Pages application, Firebase Web SDK connection, deny-by-default Firestore foundation, protected Founder root model, Google-link-only document policy, and deployment architecture.

### Phase 2 — Accounts, PIN Authentication & Permissions: CODE COMPLETE

Founder-created Board accounts, Full Name + four-digit PIN experience, activation codes, permission templates plus individual capabilities, protected Founder root identity, account recovery flows, audit events, and no raw PIN/activation-code storage in Firestore.

### Phase 3 — Director Dashboard & Board Directory: COMPLETE

Operational dashboard, Board-facing directory separated from secure account records, director statuses/terms/voting eligibility, Founder management controls, Board notices, server-side directory/notice privacy, and no manual/composite indexes.

### Phase 4 — Board Document Center & Board Inbox: COMPLETE

Google Docs / Drive / Sheets / Slides link-only submissions, Board Inbox, access scopes, review lifecycle, Agenda Ready handoff, mutation-bound append-only document history, server-authoritative timestamps, and no Firebase Storage.

### Phase 5 — Board Meetings, Check-In, Attendance & Quorum: POLISHED / CODE COMPLETE

Implemented and reviewed:

- live Board Meeting Room;
- `BM-YYYY-XXXXXX` meeting numbering;
- regular / special / organizational / emergency meetings;
- in-person / virtual / hybrid modes;
- frozen invited and voting-eligible roster snapshots;
- configurable quorum requirement;
- activation / Check-In Open;
- self check-in and return after departure;
- live Firestore attendance;
- present / departed / excused / absent states;
- live quorum calculation;
- Call to Order / Recess / Resume / Adjourn / pre-session cancellation;
- locked attendance after adjournment/cancellation;
- Founder-assignable meeting permissions;
- select-all / clear-all meeting invite controls and roster count;
- lifecycle confirmation prompts;
- live Boardroom status indicator;
- stable Phase 5 -> Phase 6 meeting handoff;
- observer-loop protection for Firestore-driven rerenders;
- corrected GitHub Pages module loading so Phase 5 actually executes from the production app entry path;
- Phase 5 browser QA harness;
- no manual/composite indexes.

### Phase 6 — Agenda, Motions, Live Voting & Resolution Registry: CODE COMPLETE

Implemented:

- live agenda inside the selected Board Meeting Room;
- Agenda Ready Google-linked document attachment;
- agenda item types/statuses;
- `agenda.manage` permission;
- present voting-eligible director motions;
- seconding by a different present voting-eligible director;
- `motions.create` and `motions.second` permissions;
- live quorum gate before the client pushes a vote;
- vote-level recusals;
- frozen eligible-voter and quorum snapshots;
- approve / oppose / abstain ballots;
- immutable deterministic ballot records;
- recorded ballot mode;
- confidential ballot mode with voter/Founder/controller audit access;
- simple-majority-of-votes-cast, majority-of-eligible-voters, and two-thirds-of-votes-cast thresholds;
- `votes.view`, `votes.cast`, `votes.push`, and `votes.close` permissions;
- Firestore validation of each ballot against the voter and current Phase 5 attendance record;
- vote closing and immutable result totals;
- automatic preliminary `BR-YYYY-XXXXXX` resolution records;
- searchable Resolution Registry;
- Phase 6 Security Rules for agenda, motion, vote, ballot, recusal, and resolution records;
- Phase 6 browser QA harness;
- no manual/composite indexes.

**External production verification is still required** after GitHub Pages, Firebase Authentication, DNS, Founder bootstrap, and the current Firestore Security Rules are configured/deployed. That is deployment work rather than unfinished generation.

## Implementation phases

1. **Foundation — complete**
2. **Accounts, PIN authentication, permissions — code complete**
3. **Director dashboard & Board directory — complete**
4. **Google-link document center & Board Inbox — complete**
5. **Meetings, activation, live check-in, attendance and quorum — polished / code complete**
6. **Agenda, motions, resolutions and live voting — code complete**
7. Minutes, certifications and permanent Board records
8. Committees, conflicts, officer management, tasks and compliance
9. Founder Director administration, audit and security controls
10. Operational hardening, production testing and launch

## Security principles

- Firestore Security Rules are the authorization boundary; hidden UI is not security.
- The Founder Director account is the protected root governance-administration identity.
- Other accounts receive granular capabilities assigned by the Founder Director.
- PINs and activation codes are never stored in Firestore.
- Board documents are links/metadata only; Firebase Storage is never used.
- Google Drive sharing permissions remain independent of portal authorization.
- Document review transitions and history-event integrity are enforced server-side.
- Meeting invitation lists, voting-eligible snapshots, and quorum requirements cannot be rewritten through ordinary live-meeting controls.
- Quorum is derived from current attendance rather than a mutable `quorumAchieved` field.
- Attendance becomes immutable after adjournment/cancellation.
- Motions require a present voting-eligible director, and a second must come from a different present voting-eligible director.
- Ballots are deterministic per vote/director and cannot be updated or deleted after submission.
- Firestore validates each ballot against the open vote, eligible-voter snapshot, and current present attendance record.
- Confidential ballots are confidential to ordinary Board viewers, not cryptographically anonymous; the voter, Founder root, and authorized vote closer can audit them.
- Closed Phase 6 resolution records are preliminary until Phase 7 certification.
- Historical records are preserved rather than silently rewritten/deleted.
- No bootstrap secret is embedded in the public GitHub Pages client.
- No manual/composite Firestore indexes are defined or deployed.

## Firestore collections currently opened by phase

```text
directors          secure account / authorization records
loginDirectory     exact pre-auth name lookup
boardDirectory     Board-facing director profiles
announcements      Board notices
documents          Google-linked Board document metadata
documentEvents     mutation-bound append-only document history
meetings           Board meeting records and lifecycle state
meetingAttendance  one attendance record per meeting/director pair
agendaItems        live meeting agenda records
motions            mover / seconder / motion lifecycle records
votes              pushed vote definitions and closed result totals
voteBallots        immutable per-voter ballots
voteRecusals       vote-level recusal records
resolutions        preliminary Board resolution registry
system             protected counters/config foundation
auditEvents        Founder-only administrative audit records
```

Future governance collections remain deny-by-default until their implementation phase.

## No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

Phases 1–6 use direct document reads, authorized plain collection reads, or one single-field equality / `array-contains` filter at a time. Search, sorting, filtering, quorum calculations, vote threshold calculations, and summaries remain client-side.

Deploy rules only:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

## Serverless quorum boundary

The live client calculates quorum from Phase 5 attendance immediately before a Phase 6 vote is pushed and stores that snapshot with the vote. Firestore Security Rules validate individual ballots and ensure voter UIDs come from the meeting's voting-eligible population, but the rules cannot aggregate an arbitrary attendance collection to independently count quorum for the vote-opening request. The underlying attendance records and vote snapshot are retained for audit.

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md`
- `docs/PHASE-2-AUTHENTICATION.md`
- `docs/PHASE-3-DIRECTOR-WORKSPACE.md`
- `docs/PHASE-4-DOCUMENT-CENTER.md`
- `docs/PHASE-5-MEETINGS.md`
- `docs/PHASE-6-LIVE-ACTIONS.md`
- `docs/FOUNDER-BOOTSTRAP.md`
- `docs/DEPLOYMENT.md`
- `tests/phase2-phase3.html`
- `tests/phase4-documents.html`
- `tests/phase5-meetings.html`
- `tests/phase6-governance.html`

## Local development

Serve the repository over HTTP because the site uses JavaScript modules:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time actions.
