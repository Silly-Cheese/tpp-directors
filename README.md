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

Phase 1 includes:

- static GitHub Pages application shell;
- custom-domain `CNAME` and `.nojekyll` configuration;
- Firebase Web SDK initialization;
- Authentication and Cloud Firestore only;
- Firestore deny-by-default security foundation;
- Firebase CLI configuration for Firestore Security Rules deployment;
- protected Founder Director root-identity contract;
- baseline director/account data model;
- reserved governance collection architecture;
- Google-link-only Board document policy;
- deployment and production-verification documentation.

### Phase 2 — Accounts, PIN Authentication & Permissions: IN PROGRESS

Implemented so far:

- Full Name first-step login flow;
- SHA-256 normalized-name login lookup;
- opaque internal Firebase Auth aliases instead of director email addresses;
- one-time activation-code flow;
- four-digit director-facing PIN setup/sign-in;
- PINs are never stored in Firestore;
- isolated secondary Firebase Auth instance for Founder account provisioning;
- Founder-created ordinary Board accounts;
- automatic `DIR-######` allocation using a Firestore counter transaction;
- initial permission templates/capability model;
- Founder Control account-creation interface;
- Founder Board account roster;
- account-creation audit events;
- protected root-account rules;
- no manual/composite indexes; account roster sorting is client-side;
- detailed one-time Founder bootstrap procedure.

Still to complete in Phase 2:

- granular per-director permission editor UI;
- status/suspension management UI;
- stronger account-management UX and validation;
- production Firebase/Auth/rules verification after external console setup;
- test coverage for activation, provisioning rollback, permissions, and account-state handling;
- documented administrative recovery workflow for forgotten PINs under the no-backend constraint.

## Build approach

This repository is intentionally a static web application. It uses native HTML/CSS/JavaScript modules and the Firebase Web SDK from Google's CDN so it can run directly on GitHub Pages without a server-side build environment.

### Implementation phases

1. **Foundation, Firebase connection, protected app shell, Founder Director bootstrap model — complete**
2. **Director accounts, first-use PIN activation, login, permissions — in progress**
3. Director dashboards and Board directory
4. Google-link document center and Board Inbox
5. Meetings, activation, live check-in, attendance and quorum
6. Agenda, motions, resolutions and live voting
7. Minutes, certifications and permanent Board records
8. Committees, conflicts, officer management, tasks and compliance
9. Founder Director administration, audit and security controls
10. Operational hardening, testing and launch

## Security principles

- Firestore rules are the authorization boundary; UI hiding is never treated as security.
- The Founder Director account is the protected root governance-administration identity.
- Other accounts receive granular capabilities assigned by the Founder Director.
- Completed governance records must not be silently rewritten.
- PINs must never be stored in Firestore as plaintext.
- Historical directors remain attached to historical votes and meetings even after login access is disabled.
- No bootstrap secret is embedded in the public GitHub Pages client.
- The public login directory permits only an exact document lookup; collection listing is denied.
- No manual/composite Firestore indexes are defined or deployed.

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md` — production architecture and data-contract foundation
- `docs/PHASE-2-AUTHENTICATION.md` — Full Name + PIN and Founder account architecture
- `docs/FOUNDER-BOOTSTRAP.md` — exact protected Founder Director bootstrap procedure
- `docs/DEPLOYMENT.md` — GitHub Pages, DNS, Firebase, rules, and verification steps

## Local development

Because the project uses JavaScript modules, serve the repository through a local HTTP server rather than opening `index.html` directly from disk.

Example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Firestore deployment

The included Firebase configuration targets Security Rules only and intentionally does not deploy manual/composite indexes:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

## Required external setup

The repository cannot itself enable GitHub Pages, alter DNS, enable the Firebase Authentication provider, deploy Firestore rules into your Firebase project, or create the initial privileged Founder Auth identity. Follow `docs/DEPLOYMENT.md` and `docs/FOUNDER-BOOTSTRAP.md` for those one-time external actions.
