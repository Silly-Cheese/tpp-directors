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
- server-side enforcement that ordinary directors can read only `directoryVisible == true` Board-directory records;
- server-side enforcement that ordinary directors can read only published Board notices;
- no manual/composite indexes.

### Phase 4 — Board Document Center & Board Inbox: CODE COMPLETE

Implemented:

- full Board Document Center integrated into the portal;
- **Google-link-only** submissions — no upload input exists;
- accepted HTTPS hosts: Google Docs, Google Drive, Google Sheets, and Google Slides;
- automatic Google link-type detection;
- `BDOC-YYYY-XXXXXX` record numbering without a Firestore counter;
- categories for governance, policy, financial, program, committee, report, legal, minutes, and other records;
- access scopes for Board-wide, Board Officers, selected directors, and Founder-only records;
- submitting-director access to their own records throughout review/revision;
- Board Inbox for accounts with `documents.review`;
- document statuses: submitted, under review, returned for revision, agenda ready, approved, rejected, tabled, archived;
- server-enforced review transition rules;
- revision/resubmission workflow;
- append-only `documentEvents` history;
- detailed record viewer with Google-document launch link;
- latest review-note display;
- dashboard document summary/recent records;
- search, category filtering, status filtering, and client-side sorting;
- `agenda_ready` handoff state reserved for Phase 5/6 meeting integration;
- Board/officer/restricted document access enforced by Firestore Security Rules;
- separate single-field Firestore queries merged/deduplicated in the browser;
- no manual/composite indexes;
- Phase 4 browser QA harness.

**External production verification is still required** after GitHub Pages, Firebase Authentication, DNS, and Firestore Security Rules are configured/deployed. That is deployment work, not unfinished generation.

## Implementation phases

1. **Foundation — complete**
2. **Accounts, PIN authentication, permissions — code complete**
3. **Director dashboard & Board directory — complete**
4. **Google-link document center & Board Inbox — code complete**
5. Meetings, activation, live check-in, attendance and quorum
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
- Restricted document records are not exposed by a broad ordinary-director collection read.
- Document review transitions are constrained server-side.
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
documentEvents     append-only document history
system             protected counters/config foundation
auditEvents        Founder-only administrative audit records
```

Future governance collections remain deny-by-default until their implementation phase.

## No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

Phase 1-4 use direct document reads, unrestricted reads only where the role may see the full collection, or separate single-field equality / `array-contains` queries. Results are merged, filtered, searched, and sorted client-side.

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
- `docs/FOUNDER-BOOTSTRAP.md`
- `docs/DEPLOYMENT.md`
- `tests/phase2-phase3.html`
- `tests/phase4-documents.html`

## Local development

Serve the repository over HTTP because the site uses JavaScript modules:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time actions.
