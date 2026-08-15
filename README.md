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

Google-linked official minutes, structured minutes metadata, `draft -> ready -> certified` workflow, immutable certified meeting records/snapshots, resolution certification, meeting record seals, certification preflight, searchable/print-friendly Board Records, and no composite indexes.

### Phase 8 — Governance Operations Suite: FINISHED / CODE COMPLETE

Implemented and reviewed:

- unified **Governance** portal section;
- standing / ad hoc / special committee management;
- committee chairs, members, purpose, status, charter Google link, and dates;
- annual director conflict-of-interest disclosures using Google links;
- Board-wide COI review workflow with `reviewed` / `renewal_required` states;
- specific conflict / recusal / management-plan records;
- private ordinary-director COI visibility with reviewer/Founder Board-wide access;
- historical officer-term records with election / appointment / interim / confirmation basis;
- protected officer-role synchronization to the director account and Board directory;
- delegated officer managers limited to officer-role metadata on ordinary accounts;
- Founder-root protection during officer changes;
- Board task creation, assignment, due dates, priorities, committee/meeting/resolution links, and self-service completion updates;
- compliance items with categories, due dates, recurrence, ownership, Google-source links, and completed/waived states;
- derived Overdue / Due Today / Due Soon / Upcoming display states without scheduled backend jobs;
- append-only Phase 8 governance events;
- live Phase 8 permission/tab refresh when Founder access changes;
- Phase 8 granular permissions and updated role templates;
- Phase 8 Firestore Security Rules;
- Phase 8 browser QA harness;
- no manual/composite indexes.

### Phase 9 — Founder Administration, Audit & Security: FINISHED / CODE COMPLETE

Implemented and finalized:

- dedicated **Security & Audit Center**;
- Founder-only security overview and privilege exposure analysis;
- delegated `audit.view` read-only administrative audit access;
- live revocation of delegated audit access while the user is signed in;
- consolidated Founder audit view across administrative, document, governance, and permanent-record event streams;
- browser-side audit search/filtering without composite indexes;
- explicit context-correlation labels for browser-originated document/governance events rather than falsely representing them as server-signed logs;
- sensitive-permission access matrix;
- non-Founder wildcard permission warning;
- formal access-review audit snapshots;
- atomic access-review write of the immutable audit event plus `system/lastAccessReview` marker;
- Founder security-policy record under `system/portalSecurityPolicy`;
- Founder-only security incident register with severity/status/response notes;
- real emergency access freeze that changes all affected non-Founder accounts to `suspended` while preserving the protected Founder root;
- emergency restore that returns still-frozen accounts to their prior recorded account state;
- audit events for emergency freeze, restore, security policy changes, incidents, and formal access reviews;
- cross-phase portal navigation synchronization;
- Phase 9 browser QA harness;
- no new Firebase products and no manual/composite indexes.

### Phase 10 — Production Hardening, Verification & Launch Readiness: CODE COMPLETE

Implemented:

- resilient sequential governance-module loader with per-module `loading / loaded / failed` status;
- session-local runtime error diagnostics;
- offline/degraded-mode warning banner for official Board workflows;
- Founder-only **Launch Readiness Center**;
- automatic production hostname / HTTPS / Firebase project / CNAME checks;
- `firebase.json` product-scope verification;
- deployed `firestore.indexes.json` presence check;
- Founder-root session verification;
- one-root / non-Founder-wildcard security checks;
- emergency-freeze / security-policy / access-review / incident checks;
- live-meeting and unfinished-vote launch checks;
- Founder manual go-live checklist stored in `system/launchReadiness`;
- launch gate that requires all critical automatic checks and all manual checks to clear;
- auditable `draft`, `ready_for_launch`, and `launched` operational milestones;
- links to every Phase 2–10 browser QA harness;
- final production documentation and go-live checklist;
- no new Firebase products and no manual/composite indexes.

**All 10 generation phases are now code-complete. External production verification is still required.** GitHub Pages/DNS/Auth settings, Founder bootstrap, current Firestore Rules deployment, multi-account live testing, and final go-live checks must be completed against the real production environment before the portal should be described as production-verified.

## Implementation phases

1. **Foundation — complete**
2. **Accounts, PIN authentication, permissions — code complete**
3. **Director dashboard & Board directory — complete**
4. **Google-link document center & Board Inbox — complete**
5. **Meetings, activation, live check-in, attendance and quorum — polished / code complete**
6. **Agenda, motions, resolutions and live voting — finished / code complete**
7. **Minutes, certifications and permanent Board records — finished / code complete**
8. **Committees, conflicts, officer management, tasks and compliance — finished / code complete**
9. **Founder administration, consolidated audit and security controls — finished / code complete**
10. **Operational hardening, production verification tooling and launch readiness — code complete**

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
- Phase 9 emergency freeze uses the existing account-status enforcement path; it is not a visual-only maintenance switch.
- The Founder root is excluded from emergency account freeze operations.
- Pre-authentication failed-PIN telemetry is not represented as authoritative because this no-backend architecture cannot securely accept unauthenticated security-log writes without spoofing risk.
- Browser-originated operational events are presented as contextual audit history, not cryptographically server-signed evidence.
- Phase 10 runtime errors remain local diagnostics rather than untrusted Firestore audit writes.
- Phase 10 launch status records an operational milestone; it does not configure hosting, DNS, Firebase Authentication, or deploy Firestore Rules.
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
committees             committee records
coiDisclosures         annual director COI disclosures
conflictRecords        specific conflict / recusal / management records
officerTerms           historical Board officer assignments
boardTasks             Board follow-up assignments
complianceItems        governance/compliance obligations
governanceEvents       append-only governance operational history
system                 Founder-only counters, security records, launch-readiness state
auditEvents            append-only administrative/access/security/launch audit records
```

Phases 9–10 deliberately reuse the already-protected `system` and `auditEvents` collections rather than opening unnecessary new security or deployment collections.

## No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

Phases 1–10 use direct document reads, authorized plain collection reads, or one single-field equality / `array-contains` filter at a time. Sorting, searching, quorum math, vote thresholds, due-state calculations, permanent-record summaries, audit merging, privilege analysis, security metrics, production diagnostics, and launch summaries remain client-side.

Deploy rules only:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

`firebase.json` references only `firestore.rules`.

## Serverless boundaries

The portal intentionally uses GitHub Pages + Firebase Authentication + Cloud Firestore only. Meeting-wide quorum is calculated from Phase 5 attendance in the live client and preserved with each vote; Firestore Rules validate individual ballot eligibility and presence. Phase 8 compliance due-state labels are calculated when the portal is used rather than by a scheduled backend worker. Phase 9 does not invent pre-auth security telemetry or server-side intrusion detection that this architecture cannot securely provide. Phase 10 distinguishes automatic browser-verifiable checks from manual deployment facts that require Founder confirmation.

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md`
- `docs/PHASE-2-AUTHENTICATION.md`
- `docs/PHASE-3-DIRECTOR-WORKSPACE.md`
- `docs/PHASE-4-DOCUMENT-CENTER.md`
- `docs/PHASE-5-MEETINGS.md`
- `docs/PHASE-6-LIVE-ACTIONS.md`
- `docs/PHASE-7-PERMANENT-RECORDS.md`
- `docs/PHASE-8-GOVERNANCE-OPS.md`
- `docs/PHASE-9-ADMIN-SECURITY.md`
- `docs/PHASE-10-PRODUCTION-READINESS.md`
- `docs/GO-LIVE-CHECKLIST.md`
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
/tests/phase9-security.html
/tests/phase10-production.html
```

Serve the repository over HTTP before opening local harnesses:

```bash
python -m http.server 8080
```

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, add the production Auth authorized domain, deploy Firestore Rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md`, `docs/FOUNDER-BOOTSTRAP.md`, `docs/PHASE-10-PRODUCTION-READINESS.md`, and `docs/GO-LIVE-CHECKLIST.md` for those actions.
