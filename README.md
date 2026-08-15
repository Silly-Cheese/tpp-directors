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

Implemented:

- Founder-created Board accounts;
- Full Name first-step login;
- one-time activation codes;
- four-digit director PIN setup/sign-in;
- internal non-deliverable Firebase Auth aliases rather than director email addresses;
- no raw PIN or activation-code storage in Firestore;
- isolated provisioning Auth instance;
- automatic `DIR-######` assignment;
- account states and live suspension/deactivation enforcement;
- permission templates plus individual capabilities;
- protected Founder root identity;
- self-service PIN change;
- interrupted-activation recovery;
- `pin_reset_required` recovery state;
- Founder console-assisted forgotten-PIN package;
- administrative audit events;
- browser QA harness;
- no manual/composite indexes.

### Phase 3 — Director Dashboard & Board Directory: COMPLETE

Implemented and hardened:

- operational director dashboard;
- Board-wide current/confirmed/interim metrics;
- personal Board profile, term, voting status, and permissions;
- Board-facing `boardDirectory` separated from secure account records;
- searchable/filterable director directory;
- detailed director profile view;
- interim / confirmed / leave-of-absence / former states;
- Founder management of Board role, officer role, status, term, voting eligibility, account state, and directory visibility;
- automatic Board-directory creation and Founder backfill;
- Board notices with priority, expiration, publishing, and archive controls;
- server-side enforcement of hidden directory records and archived notice privacy;
- no manual/composite indexes.

### Phase 4 — Board Document Center & Board Inbox: COMPLETE

Implemented and reviewed:

- Google Docs / Drive / Sheets / Slides link-only submissions;
- no file upload input and no Firebase Storage;
- client + Security Rules Google-link validation;
- `BDOC-YYYY-XXXXXX` numbering without a counter;
- document categories and requested Board actions;
- Board-wide, officer, selected-director, and Founder-only access scopes;
- Board Inbox for `documents.review`;
- submitted / under review / returned for revision / agenda ready / approved / rejected / tabled / archived statuses;
- server-enforced transition rules;
- submitter revision/resubmission workflow;
- detailed document viewer and review notes;
- client-side search/filter/sort;
- append-only `documentEvents` history;
- unique `lastEventId` binding so every accepted history event must correspond to the actual document mutation that reserved it;
- fresh event-ID enforcement to prevent duplicate/fabricated event records;
- Phase 4 browser QA harness;
- no manual/composite indexes.

### Phase 5 — Board Meetings, Check-In, Attendance & Quorum: CODE COMPLETE

Implemented:

- live Board Meeting Room integrated into the existing portal;
- `BM-YYYY-XXXXXX` meeting numbering without a counter;
- regular, special, organizational, and emergency meeting types;
- in-person, virtual, and hybrid meeting modes;
- scheduled meeting creation;
- invited-director roster snapshots;
- frozen voting-eligible roster snapshots;
- configurable quorum requirement with a majority helper when left blank;
- `meetings.view`, `meetings.create`, `meetings.activate`, `meetings.control`, and `meetings.attendance.manage` permissions;
- Founder root access to every meeting capability;
- activation / Check-In Open state;
- invited-director self check-in;
- late arrival and return after departure, including during recess;
- live attendance roster using Firestore snapshots;
- present / departed / excused / absent attendance management;
- live quorum derived from current voting-eligible directors marked present;
- Call to Order;
- Recess;
- Resume;
- Adjourn;
- pre-session cancellation;
- attendance locking after adjournment/cancellation;
- live dashboard meeting banner;
- Firestore Security Rules preventing roster injection, quorum rewriting, unauthorized lifecycle changes, and post-adjournment attendance edits;
- Phase 5 browser QA harness;
- no manual/composite indexes.

**External production verification is still required** after GitHub Pages, Firebase Authentication, DNS, Founder bootstrap, and the current Firestore Security Rules are configured/deployed. That is deployment work rather than unfinished generation.

## Implementation phases

1. **Foundation — complete**
2. **Accounts, PIN authentication, permissions — code complete**
3. **Director dashboard & Board directory — complete**
4. **Google-link document center & Board Inbox — complete**
5. **Meetings, activation, live check-in, attendance and quorum — code complete**
6. Agenda, motions, resolutions and live voting
7. Minutes, certifications and permanent Board records
8. Committees, conflicts, officer management, tasks and compliance
9. Founder Director administration, audit and security controls
10. Operational hardening, production testing and launch

## Security principles

- Firestore Security Rules are the authorization boundary; hidden UI is not security.
- The Founder Director account is the protected root governance-administration identity.
- Other accounts receive granular capabilities assigned by the Founder Director.
- Board-facing directory data is separated from sensitive authentication/account records.
- PINs and activation codes are never stored in Firestore.
- Board documents are links/metadata only; Firebase Storage is never used.
- Google Drive sharing permissions remain independent of portal authorization.
- Document review transitions and history-event integrity are enforced server-side.
- Meeting invitation lists, voting-eligible snapshots, and quorum requirements cannot be rewritten through live meeting controls.
- Quorum is derived from current attendance rather than a mutable `quorumAchieved` field.
- Attendance becomes immutable after adjournment/cancellation.
- Historical records are preserved rather than silently rewritten/deleted.
- No bootstrap secret is embedded in the public GitHub Pages client.
- The public login directory permits only exact document lookup; collection listing is denied.
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
system             protected counters/config foundation
auditEvents        Founder-only administrative audit records
```

Future governance collections remain deny-by-default until their implementation phase.

## No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

Phases 1–5 use direct document reads, plain authorized collection reads, or one single-field equality / `array-contains` filter at a time. Search, sorting, filtering, quorum calculations, and summary logic remain client-side.

Deploy rules only:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md`
- `docs/PHASE-2-AUTHENTICATION.md`
- `docs/PHASE-3-DIRECTOR-WORKSPACE.md`
- `docs/PHASE-4-DOCUMENT-CENTER.md`
- `docs/PHASE-5-MEETINGS.md`
- `docs/FOUNDER-BOOTSTRAP.md`
- `docs/DEPLOYMENT.md`
- `tests/phase2-phase3.html`
- `tests/phase4-documents.html`
- `tests/phase5-meetings.html`

## Local development

Serve the repository over HTTP because the site uses JavaScript modules:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time actions.
