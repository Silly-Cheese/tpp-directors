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

### No composite/manual indexes

The project intentionally does not contain `firestore.indexes.json`, and `firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for portal queries. Account lists are sorted client-side, and future query design must preserve the no-manual-index requirement unless the project requirements are explicitly changed.

## 5. Founder Director bootstrap

The root Founder Director identity must exist before the Founder Control Center can create ordinary accounts.

Follow `docs/FOUNDER-BOOTSTRAP.md` exactly. The bootstrap is a one-time Firebase Console operation because putting a root-claim secret in a public GitHub Pages client would be insecure.

After the root Auth user, director profile, login-directory record, and counter are created, the Founder can activate the account through the normal portal and choose the first four-digit PIN.

## 6. Phase 2 verification

After Pages, DNS, Firebase Authentication, the Firestore rules, and Founder bootstrap are configured, verify:

- `https://directors.ask4prayers.com` loads without Firebase Hosting;
- the initial sign-in screen asks for full name only;
- the Founder name resolves to the first-use activation screen;
- the activation code signs the Founder in and allows PIN creation;
- a subsequent sign-in uses Full Name + four-digit PIN;
- Founder Control is visible only to the protected root profile;
- the Founder can create an ordinary director account;
- creating an ordinary account does not replace the Founder browser session;
- the one-time activation code is displayed after creation and is not stored in Firestore;
- an ordinary new director can activate and choose a PIN;
- unauthenticated users cannot list `loginDirectory` or `directors`;
- ordinary directors cannot list all director account records during Phase 2;
- ordinary users cannot create, promote, delete, or demote root identities;
- unfinished governance collections remain deny-by-default;
- no manual/composite Firestore index is requested by Phase 2 workflows.

## 7. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in production runtime
- file uploads
- manual/composite Firestore indexes

Board documents in later phases must continue to use Google Docs/Drive/Sheets/Slides links instead of uploads.
