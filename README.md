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
- **File uploads:** None. Board documents are represented by Google Docs / Drive / Sheets / Slides links.

## Phase status

### Phase 1 — Foundation: COMPLETE

Phase 1 established the static GitHub Pages application, Firebase Web SDK connection, deny-by-default Firestore foundation, protected Founder root model, Google-link-only document policy, and deployment architecture.

### Phase 2 — Accounts, PIN Authentication & Permissions: CODE COMPLETE

Implemented:

- Full Name first-step login;
- SHA-256 normalized-name lookup;
- random internal Firebase Auth aliases rather than director email addresses;
- Founder-created Board accounts;
- isolated provisioning Auth instance so account creation does not replace the Founder session;
- one-time activation codes;
- four-digit PIN setup and normal PIN sign-in;
- no raw PIN storage in Firestore;
- automatic `DIR-######` allocation;
- account-state enforcement and live suspension/deactivation handling;
- permission templates;
- granular per-director capability assignment;
- protected Founder root account;
- self-service PIN change;
- interrupted-activation recovery path;
- `pin_reset_required` account flow;
- Founder preparation of a console-assisted forgotten-PIN recovery package;
- account creation/access/recovery audit events;
- browser-run pure-function QA harness;
- no manual/composite indexes.

### Phase 3 — Director Dashboard & Board Directory: CODE COMPLETE

Implemented:

- operational director dashboard;
- Board-wide current/confirmed/interim metrics;
- personal Board profile and term information;
- visible portal-permission summary;
- active Board notices on the dashboard;
- Board-facing `boardDirectory` collection separated from secure account records;
- searchable director directory;
- client-side Board-status filters;
- detailed director profile view;
- interim / confirmed / leave-of-absence / former Board states;
- Founder management of Board role, officer role, status, term, voting eligibility, and directory visibility;
- automatic creation of Board-directory records for new accounts;
- Founder backfill of missing Phase 2 directory records;
- Founder Board-account metrics;
- Founder Board-notice publishing and archiving;
- `announcements.manage` capability foundation;
- Phase 3 Firestore Security Rules;
- all directory and notice filtering/sorting performed client-side with no manual/composite indexes.

**External production verification is still required** after GitHub Pages, Firebase Authentication, DNS, and Firestore Security Rules are configured/deployed. That is deployment work rather than unfinished Phase 2/3 generation.

## Implementation phases

1. **Foundation, Firebase connection, protected app shell, Founder Director bootstrap model — complete**
2. **Director accounts, first-use PIN activation, login, permissions — code complete**
3. **Director dashboards and Board directory — code complete**
4. Google-link document center and Board Inbox
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
- The Board-facing directory is separated from sensitive authentication/account records.
- PINs and activation codes are never stored in Firestore.
- Historical directors remain attached to future historical governance records even after portal access is disabled.
- No bootstrap secret is embedded in the public GitHub Pages client.
- The public login directory permits only exact document lookup; collection listing is denied.
- Completed governance records in later phases must not be silently rewritten.
- No manual/composite Firestore indexes are defined or deployed.

## Firestore collections currently opened by phase

```text
directors          secure account / authorization records
loginDirectory     exact pre-auth name lookup
boardDirectory     Board-facing director profiles
announcements      Board notices
system             protected counters/config foundation
auditEvents        Founder-only immutable administrative audit records
```

All future governance collections remain deny-by-default until their implementation phase.

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md` — production architecture and data-contract foundation
- `docs/PHASE-2-AUTHENTICATION.md` — Full Name + PIN, account lifecycle, permissions, and recovery
- `docs/PHASE-3-DIRECTOR-WORKSPACE.md` — Board dashboard, directory, statuses, and notices
- `docs/FOUNDER-BOOTSTRAP.md` — protected Founder Director bootstrap procedure
- `docs/DEPLOYMENT.md` — GitHub Pages, DNS, Firebase, rules, and verification steps
- `tests/phase2-phase3.html` — browser-run pure-function QA harness

## Local development

Because the project uses JavaScript modules, serve the repository through a local HTTP server rather than opening `index.html` directly from disk.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Firestore deployment

The Firebase configuration targets Security Rules only and intentionally does not deploy manual/composite indexes:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

There is intentionally no `firestore.indexes.json`.

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore rules into the Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time actions.
