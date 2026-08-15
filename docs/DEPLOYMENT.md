# Production Deployment

The Prayer Project Board of Directors Portal targets:

```text
https://directors.ask4prayers.com
```

Production architecture:

- GitHub Pages hosting;
- Firebase project `tpp-direc`;
- Firebase Authentication + Cloud Firestore only;
- no Firebase Hosting;
- no Firebase Storage;
- no Cloud Functions;
- no production Admin SDK runtime;
- no native file uploads;
- Google Docs / Drive / Sheets / Slides links for Board records;
- no manual/composite Firestore indexes.

All 10 repository generation phases are code-complete. The steps below are the required production-verification path.

## 1. GitHub Pages

Repository:

```text
Silly-Cheese/tpp-directors
```

Configure GitHub Pages to publish:

```text
Branch: main
Folder: / (root)
```

The repository already contains:

```text
index.html
.nojekyll
CNAME
```

`CNAME` must contain exactly:

```text
directors.ask4prayers.com
```

The application is build-free. `index.html` loads `js/app.js`, which initializes Firebase and the sequential production governance-module loader.

## 2. DNS

Configure the `directors.ask4prayers.com` DNS record for the GitHub Pages site according to the DNS provider/GitHub Pages configuration in use.

After DNS propagation, verify:

```text
https://directors.ask4prayers.com
```

loads the production portal over HTTPS.

Do not remove the repository `CNAME` file.

## 3. Firebase Authentication

In Firebase project:

```text
tpp-direc
```

complete the following:

1. Enable **Email/Password** Authentication.
2. Add `directors.ask4prayers.com` as an authorized domain when required by Firebase Authentication settings.
3. Keep the user-facing portal experience as Full Name + activation code/PIN; directors do not enter an email address.
4. Do not enable Firebase Hosting, Storage, or Functions for this portal.

The internal Firebase email/password credential is an implementation detail backing the Board-facing name/PIN workflow.

## 4. Cloud Firestore

Create/confirm Cloud Firestore in `tpp-direc` and deploy the repository rules:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

The deployment configuration is intentionally rules-only:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

### No manual/composite indexes

There must be no:

```text
firestore.indexes.json
```

Do not add manual/composite indexes for the Board Portal unless the project architecture is explicitly changed in the future.

The portal uses direct document reads, plain authorized collection reads, or single-field equality / `array-contains` queries, then performs sorting/filtering/aggregation client-side.

## 5. Founder bootstrap

Follow:

```text
docs/FOUNDER-BOOTSTRAP.md
```

The protected Founder identity must exist before ordinary Board accounts are provisioned.

Production verification should confirm exactly one director record with:

```text
root: true
systemRole: founder_director
```

and that the account is active.

## 6. Account/PIN verification

Using separate browser/device sessions, verify:

- Founder sign-in;
- Founder-created director account provisioning;
- Founder session remains signed in while provisioning another Auth user;
- first-time activation code;
- four-digit PIN creation;
- subsequent Full Name + PIN sign-in;
- PIN change;
- PIN reset/recovery procedure;
- suspension/deactivation enforcement;
- protected Founder root cannot be managed through ordinary director controls.

## 7. Board directory and permissions

Verify the real Board data:

- Director IDs;
- full/display names;
- Interim/Confirmed status;
- voting eligibility;
- officer roles;
- terms;
- directory visibility;
- individual permissions.

Existing accounts must be reviewed for current Phase 8/9 capability grants because updating a code permission template does not retroactively rewrite stored Firestore permission arrays.

Confirm no non-Founder account holds:

```text
*
```

unless the architecture is intentionally changed.

## 8. Documents

Verify Phase 4 using multiple permission levels:

- no file input/upload exists;
- Google Docs / Drive / Sheets / Slides HTTPS links are accepted;
- unsupported/non-Google links are rejected;
- Board, Officers, Selected Directors, and Founder-only scopes behave correctly;
- Board Inbox status transitions work;
- Returned for Revision / resubmission works;
- Agenda Ready works;
- history events follow the corresponding document mutation;
- underlying Google sharing permissions are correct for the intended Board audience.

## 9. Meetings and attendance

Use multiple Board accounts/devices.

Verify:

- meeting creation;
- `BM-YYYY-XXXXXX` identifiers;
- roster and voting-eligible snapshots;
- deterministic attendance records;
- check-in;
- Departed / returned;
- Excused / Absent management;
- live quorum updates;
- non-voting directors do not increase voting quorum;
- recess/resume;
- attendance locks after Adjourned/Cancelled;
- an adjourned meeting cannot be silently reopened.

## 10. Agenda, motions, voting and resolutions

Verify:

- Agenda Ready documents can be attached;
- agenda status changes;
- motion creation;
- mover cannot second their own motion;
- another present eligible director can second;
- vote-level recusals;
- one meeting `activeVoteId` lock;
- second overlapping pushed vote is rejected;
- portal-wide **VOTE NOW** alert;
- Approve / Oppose / Abstain;
- one immutable deterministic ballot per voter;
- current-presence enforcement;
- recorded ballot auditing;
- confidential ballot access boundaries;
- all threshold modes;
- `open -> closing -> closed`;
- new ballots stop after Closing begins;
- interrupted Closing recovery;
- normal close-time quorum guard;
- final transaction clears `activeVoteId`;
- motion/agenda state finishes;
- preliminary `BR-YYYY-XXXXXX` resolution is created.

## 11. Minutes and permanent records

Use an adjourned meeting with realistic Phase 6 history.

Verify:

- minutes Google link only;
- structured minute fields;
- Draft -> Ready;
- Ready -> Draft correction;
- certification preflight blocks active agenda business, voting motions, unfinished votes, or an active vote lock;
- unresolved pending/ready motions are explicitly surfaced;
- certification creates the permanent record and snapshots;
- meeting remains historically Adjourned;
- resolutions become certified;
- confidential individual ballot choices are not copied into the permanent snapshot;
- certified records/entries cannot be rewritten/deleted;
- Board Records search/print view works.

## 12. Governance operations

Verify Phase 8:

### Committees

- view/manage permissions;
- Standing / Ad Hoc / Special types;
- membership and Chair logic;
- Google charter links;
- committee changes do not change legal Board membership.

### COI

- ordinary director sees only own annual disclosure/conflict records;
- reviewer sees Board-wide disclosures;
- Reviewed / Renewal Required flow;
- specific conflict/recusal/management-plan records;
- supporting Google links;
- another ordinary director cannot directly read unrelated COI records.

### Officers

- historical officer terms;
- election/appointment/interim/confirmation basis;
- old terms conclude;
- current role syncs to secure director + Board directory records;
- delegated officer manager cannot change login/root/system/Board/voting/permission state;
- delegated manager cannot modify Founder root;
- Founder can record a Founder officer term when appropriate.

### Tasks and compliance

- task assignment;
- owner-only task visibility/self-updates;
- manager controls;
- compliance categories/statuses;
- due-state calculations;
- supporting Google links;
- no scheduled backend job exists.

## 13. Security & Audit Center

Verify Phase 9:

- Founder can open Security & Audit;
- delegated `audit.view` sees the intended administrative audit subset;
- removing `audit.view` while signed in immediately removes the delegated workspace;
- consolidated Founder audit view loads;
- browser-originated event history is shown as contextual/correlated rather than server-signed;
- sensitive permission matrix is correct;
- formal access review writes the audit event and `system/lastAccessReview` marker atomically;
- security policy can be saved;
- incident register works;
- emergency freeze suspends all affected non-Founder accounts;
- Founder remains active;
- suspended sessions lose access through live profile enforcement;
- lift restores only accounts still suspended by the freeze to their recorded prior state.

## 14. Runtime hardening

Verify Phase 10 runtime behavior:

- production governance modules report `loaded` status;
- forced offline state shows the runtime warning banner;
- reconnect removes the offline warning when no other runtime problem remains;
- a simulated module/runtime failure produces degraded-mode warning behavior;
- the portal does not write arbitrary client runtime errors into Firestore as audit evidence.

## 15. Browser QA harnesses

Run over HTTP/HTTPS:

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

The harnesses are intended to be non-destructive. Live multi-account Firestore testing is still required separately.

## 16. Firestore negative testing

Before official Board use, attempt unauthorized actions using ordinary/director-level accounts and verify Firestore rejects them.

At minimum test unauthorized:

- director/account management;
- permission changes;
- restricted/founder document reads;
- meeting lifecycle control;
- attendance override;
- vote push/close;
- another director's ballot creation/change;
- ballot mutation after submission;
- permanent record certification;
- another director's private COI data;
- officer management;
- task reassignment;
- compliance management;
- Founder-only `system` records;
- audit/security administration.

## 17. Device testing

Review critical workflows on:

- desktop Chromium/Chrome;
- Android/mobile Chromium;
- small phone viewport;
- tablet if Board members will use tablets.

Prioritize:

- sign-in/PIN;
- meeting check-in;
- Vote Now alert;
- ballot buttons;
- live attendance/quorum;
- documents;
- Governance tabs;
- Security/Launch Readiness Founder controls.

## 18. Launch Readiness Center

Sign in as the Founder root and open:

```text
Launch Readiness
```

Press:

```text
Run Production Diagnostics
```

Automatic diagnostics should confirm, among other things:

- active Founder root session;
- production host/HTTPS;
- Firebase project `tpp-direc`;
- correct CNAME;
- rules-only `firebase.json`;
- no deployed `firestore.indexes.json`;
- all production modules loaded;
- exactly one Founder root;
- no non-Founder wildcard permissions;
- no active emergency freeze;
- no unresolved critical incident;
- no unfinished pushed vote.

Then complete every manual Founder verification item.

The Launch Readiness gate is clear only when all critical automatic checks and all manual checks are satisfied.

## 19. Cleanup

Before the first official meeting:

- disable/remove temporary test accounts as appropriate;
- remove or clearly segregate test meetings/votes/documents/governance records;
- verify only intended Board accounts remain active;
- verify real Google Board records have correct sharing;
- prepare the first organizational meeting and agenda.

## 20. Record launch milestone

After all checks pass:

1. record **Ready for Launch** in the Founder Launch Readiness Center;
2. perform a final production smoke test at `https://directors.ask4prayers.com`;
3. record **Production Launched**.

These actions update Founder-only `system/launchReadiness` and create administrative audit events. They do not configure hosting/DNS/Auth/Firestore on their own.

## 21. Products intentionally not used

- Firebase Hosting
- Firebase Storage
- Cloud Functions for Firebase
- Firebase Admin SDK in the production runtime
- direct file uploads
- manual/composite Firestore indexes

Board documents and official minutes remain Google-hosted links unless the architecture is explicitly changed later.
