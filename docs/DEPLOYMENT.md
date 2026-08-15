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

1. Enable the Authentication provider selected in Phase 2.
2. Add the production domain `directors.ask4prayers.com` to the authorized domains if it is not already present.
3. Do not enable unrelated Firebase products for this portal.

The final Authentication provider/credential design is intentionally deferred to Phase 2 because the requested Full Name + 4-digit PIN experience must be implemented without exposing a bootstrap secret or storing raw PINs.

## 4. Cloud Firestore

Create/confirm the Cloud Firestore database for `tpp-direc` and deploy the repository rules/index configuration.

From a Firebase CLI environment authenticated to the correct Google/Firebase account:

```bash
firebase use tpp-direc
firebase deploy --only firestore
```

The repository's `firebase.json` contains only Firestore configuration. It does not configure Firebase Hosting, Storage, or Functions.

## 5. Phase 1 verification

After Pages and DNS are active, verify:

- `https://directors.ask4prayers.com` loads the Board Portal shell;
- browser developer tools show no missing module/CORS errors for the Firebase CDN imports;
- the site loads without Firebase Hosting;
- there is no file-upload control;
- the login form clearly indicates that PIN activation is a Phase 2 feature;
- unauthenticated users cannot read or write Firestore governance data;
- unfinished governance collections remain deny-by-default.

## 6. Phase 2 boundary

Do not manually create ordinary director accounts or expose a temporary production login before Phase 2 is implemented. Phase 2 will establish the Founder Director Authentication identity first and then make all ordinary account creation Founder-controlled.
