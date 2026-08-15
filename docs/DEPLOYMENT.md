# Production Deployment

The portal targets `https://directors.ask4prayers.com`, is hosted with GitHub Pages, and uses only Firebase Authentication + Cloud Firestore from project `tpp-direc`.

## 1. GitHub Pages

Repository: `Silly-Cheese/tpp-directors`

Enable Pages from the `main` branch and repository root.

The repository contains:

- `index.html`
- `CNAME` with `directors.ask4prayers.com`
- `.nojekyll`

GitHub Pages is an external repository setting; committing these files alone does not enable it.

## 2. DNS

Configure `directors.ask4prayers.com` for the GitHub Pages site and keep the repository `CNAME` file.

## 3. Firebase Authentication

In Firebase project `tpp-direc`:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` to authorized domains if needed.
3. Do not enable Firebase Hosting, Storage, Functions, or other Firebase products for this portal.

Directors do not enter an email address. The email/password provider is only the internal Firebase backing credential for the Full Name + four-digit PIN experience.

## 4. Cloud Firestore

Create/confirm Cloud Firestore and deploy the repository Security Rules:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

### No manual/composite indexes

There is intentionally no `firestore.indexes.json`.

`firebase.json` references only `firestore.rules`.

Do not create manual/composite indexes for the portal. Phase 1-4 query design uses direct reads, role-authorized full collection reads, or separate single-field equality / `array-contains` queries with browser-side merge/filter/sort.

## 5. Founder bootstrap

Follow `docs/FOUNDER-BOOTSTRAP.md` before using Founder Control.

The root Founder identity must exist before ordinary accounts can be provisioned.

After Founder activation, Founder Control can backfill a missing `boardDirectory/{FOUNDER_UID}` mirror if the initial console bootstrap omitted it.

## 6. Phase 2 account verification

Verify:

- Full Name is the visible first login identifier;
- activation-code first use works;
- four-digit PIN setup works;
- subsequent Full Name + PIN sign-in works;
- Founder provisioning does not replace the Founder browser session;
- ordinary director creation produces `DIR-######` and a one-time activation code;
- the activation code is not stored in Firestore;
- self-service PIN change works;
- interrupted activation recovery works;
- suspended/inactive users lose portal access through the live profile listener;
- PIN recovery preparation produces the documented Firebase-admin recovery package;
- ordinary users cannot create/promote/demote the Founder root identity.

## 7. Phase 3 workspace verification

Verify:

- dashboard Board metrics render;
- Board profile/term/voting data render;
- Board directory search and status filters work;
- ordinary directory listing returns only `directoryVisible == true` records;
- a hidden directory record cannot be read by an ordinary director through a direct Firestore request;
- Founder root can administer hidden directory records;
- only published Board notices are readable by ordinary directors;
- archived notices disappear from ordinary notice reads, not merely the UI;
- notice publishing/archive works for authorized managers;
- Phase 3 workflows do not request a composite index.

## 8. Phase 4 document verification

Create at least one Standard Director and one account with `documents.review`, then verify the following.

### Google-link-only submission

- the portal contains no file input;
- Google Docs links are accepted;
- Google Sheets links are identified correctly;
- Google Slides links are identified correctly;
- Google Drive links are accepted;
- non-Google URLs are rejected;
- HTTP/non-HTTPS Google links are rejected;
- the underlying Google file still requires appropriate Drive sharing permissions.

### Document access scopes

Verify with separate accounts:

- **Board** records are readable by directors with `documents.view`;
- **Board Officers** records are not readable by non-officers;
- **Board Officers** records are readable by an officer with `documents.view`;
- **Selected Directors** records are readable only by selected UIDs, the submitter, reviewers, and Founder root;
- **Founder Director Only** records are not returned to ordinary directors;
- the submitting director can still see their own restricted/Founder-only submission;
- reviewers can read the full document review set.

### Board Inbox and lifecycle

Verify:

- newly submitted documents appear in the Board Inbox for reviewers;
- Begin Review changes `submitted -> under_review`;
- Return for Revision requires a note;
- the submitter can revise a returned record and resubmit it;
- revision number increments;
- Agenda Ready status works;
- permitted approve/reject/table transitions work;
- invalid status jumps are rejected by the client and Firestore rules;
- archived records cannot be reopened directly;
- every lifecycle operation creates an append-only `documentEvents` entry;
- the record detail page opens the Google link in a new tab;
- search/category/status filters work client-side.

### No-index verification

Phase 4 must not prompt for a manual/composite index.

The ordinary-document read strategy intentionally uses separate queries such as:

```text
submittedBy == currentUid
accessScope == board
accessScope == officers
allowedDirectorUids array-contains currentUid
```

Those result sets are merged/deduplicated in JavaScript.

Document history uses:

```text
documentId == selectedDocumentId
```

No combined query/orderBy is used.

## 9. Browser QA harnesses

Serve the repo locally over HTTP and open:

```text
/tests/phase2-phase3.html
/tests/phase4-documents.html
```

The Phase 4 harness validates Google-link handling, category/access normalization, human-readable statuses, and review-transition rules without writing to Firebase.

## 10. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- direct file uploads
- manual/composite Firestore indexes

Board documents remain Google-hosted links throughout later phases unless the project requirements are explicitly changed.
