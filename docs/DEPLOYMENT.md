# Production Deployment

The application is designed for GitHub Pages at `https://directors.ask4prayers.com` with Firebase Authentication and Cloud Firestore from project `tpp-direc`.

## 1. GitHub Pages

Repository: `Silly-Cheese/tpp-directors`

Enable GitHub Pages using the `main` branch and repository root as the publishing source. The repository contains:

- `index.html`
- `CNAME` containing `directors.ask4prayers.com`
- `.nojekyll` so the repository is served as a plain static site

GitHub Pages is an external repository setting and is not enabled merely by committing these files.

## 2. DNS

Create the DNS record for `directors.ask4prayers.com` required by the GitHub Pages configuration for `Silly-Cheese.github.io`.

Do not remove the repository `CNAME` file after the custom domain is configured.

## 3. Firebase Authentication

In Firebase Console for project `tpp-direc`:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` to Authentication authorized domains if it is not already present.
3. Do not enable Firebase Hosting, Storage, Functions, or unrelated Firebase products for this portal.

Directors never enter an email address. Email/Password is only the Firebase backing provider; the portal creates random non-deliverable Auth aliases and presents the requested Full Name + PIN experience.

See `docs/PHASE-2-AUTHENTICATION.md` for the credential architecture.

## 4. Cloud Firestore

Create/confirm the Cloud Firestore database for `tpp-direc` and deploy the repository Security Rules.

From a Firebase CLI environment authenticated to the correct Google/Firebase account:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

### No manual/composite indexes

The project intentionally does not contain `firestore.indexes.json`, and `firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for portal queries. Director, account, and notice lists are read without composite queries and are searched, filtered, and sorted in the browser. Future phases must preserve this architecture unless the project requirements are explicitly changed.

## 5. Founder Director bootstrap

The root Founder Director identity must exist before Founder Control can create ordinary accounts.

Follow `docs/FOUNDER-BOOTSTRAP.md` exactly. The bootstrap is a one-time Firebase Console operation because putting a root-claim secret in a public GitHub Pages client would be insecure.

The Phase 3 bootstrap model includes a Board-facing `boardDirectory/{FOUNDER_AUTH_UID}` record in addition to the protected `directors/{FOUNDER_AUTH_UID}` record. If that Board-directory mirror is omitted during initial bootstrap, Founder Control can backfill the missing directory record after the Founder account is activated.

## 6. Phase 2 account verification

After Pages, DNS, Firebase Authentication, Security Rules, and Founder bootstrap are configured, verify:

- the initial sign-in screen asks for full name only;
- the Founder name resolves to the first-use activation screen;
- the activation code allows PIN creation;
- subsequent sign-in uses Full Name + four-digit PIN;
- Founder Control is visible only to the protected root profile;
- the Founder can create an ordinary director account without replacing the Founder browser session;
- the one-time activation code is displayed after account creation and is not stored in Firestore;
- a new director can activate and choose a PIN;
- a signed-in director can change their own PIN;
- an interrupted activation can use the `I already created my PIN` recovery route;
- a non-active account is removed from portal access by the live profile listener;
- `Prepare PIN Recovery` marks an ordinary account for recovery and displays the administrative recovery package;
- unauthenticated users cannot list `loginDirectory` or `directors`;
- ordinary users cannot create, promote, delete, or demote root identities.

For a forgotten-PIN recovery, the Founder must perform the privileged Firebase Authentication password change through an authorized Firebase administrative workflow before giving the generated activation code to the director. The static portal does not pretend to have Admin SDK privileges.

## 7. Phase 3 Board workspace verification

Verify the Board workspace after at least the Founder and one ordinary director exist:

- the overview dashboard displays Board counts and the signed-in director's profile information;
- `boardDirectory` is readable by directors with `directors.view` without exposing login aliases, login keys, root fields, or permission arrays;
- the Board directory can search by name, role, officer role, or director number;
- directory status filters work for current, confirmed, interim, leave-of-absence, and former records;
- detailed director profiles show only Board-facing governance information;
- Founder changes to Board role, officer role, Board status, voting status, term dates, and directory visibility update the Board-facing directory;
- older Phase 2 account records missing a Board-directory mirror are backfilled through Founder Control;
- Founder Board-account metrics update correctly;
- the Founder can publish a Board notice;
- active directors can see published notices on their dashboard;
- notice priority/expiration filtering is performed client-side;
- the Founder can archive a notice;
- no Phase 2 or Phase 3 workflow requests a manual/composite Firestore index.

## 8. Browser QA harness

After serving the repository over HTTP, open:

```text
/tests/phase2-phase3.html
```

The harness performs non-destructive browser tests for name normalization, login-key determinism, activation formatting, PIN validation, account-specific PIN backing values, director-number formatting, permission templates, and Board-directory summary calculations. It does not write to Firebase.

## 9. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- file uploads
- manual/composite Firestore indexes

Board documents in Phase 4 and later must continue to use Google Docs/Drive/Sheets/Slides links instead of uploads.
