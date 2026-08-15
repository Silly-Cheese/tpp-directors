# The Prayer Project — Board of Directors Portal

Private governance portal for The Prayer Project Board of Directors.

## Production target

- **Site:** `https://directors.ask4prayers.com`
- **Hosting:** GitHub Pages
- **Repository:** `Silly-Cheese/tpp-directors`
- **Firebase project:** `tpp-direc`
- **Firebase services allowed:** Authentication and Cloud Firestore only
- **Firebase Hosting / Storage / Functions:** Not used
- **File uploads:** None. Board documents are represented by Google Docs / Drive / Sheets / Slides links.

## Phase status

**Phase 1 — Foundation: CODE COMPLETE**

Phase 1 now includes:

- static GitHub Pages application shell;
- custom-domain `CNAME` and `.nojekyll` configuration;
- Firebase Web SDK initialization;
- Authentication and Cloud Firestore only;
- Firestore deny-by-default security foundation;
- Firebase CLI configuration for Firestore rules/index deployment;
- protected Founder Director root-identity contract;
- baseline director/account data model;
- reserved governance collection architecture;
- Google-link-only Board document policy;
- deployment and production-verification documentation.

External console configuration is still required to publish the site and deploy the rules. See `docs/DEPLOYMENT.md`.

## Build approach

This repository is intentionally a static web application. It uses native HTML/CSS/JavaScript modules and the Firebase Web SDK from Google's CDN so it can run directly on GitHub Pages without a server-side build environment.

### Implementation phases

1. **Foundation, Firebase connection, protected app shell, Founder Director bootstrap model — complete**
2. Director accounts, first-use PIN activation, login, permissions
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

## Project documentation

- `docs/PHASE-1-ARCHITECTURE.md` — production architecture and data-contract foundation
- `docs/FOUNDER-BOOTSTRAP.md` — protected Founder Director root-account contract
- `docs/DEPLOYMENT.md` — GitHub Pages, DNS, Firebase, and verification steps

## Local development

Because the project uses JavaScript modules, serve the repository through a local HTTP server rather than opening `index.html` directly from disk.

Example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Firestore deployment

The included Firebase configuration targets Firestore only:

```bash
firebase use tpp-direc
firebase deploy --only firestore
```

## Phase 2 boundary

Phase 2 will implement the actual Founder Authentication identity and the requested Founder-controlled account lifecycle, including the Full Name + PIN user experience. The credential design is intentionally not faked in Phase 1 because this is a public static client and raw PINs/bootstrap secrets must not be exposed.
