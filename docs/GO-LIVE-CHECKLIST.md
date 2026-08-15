# The Prayer Project Board Portal — Go-Live Checklist

Use this checklist only after Phase 10 code is present on `main`. The in-portal Founder **Launch Readiness** workspace stores the operational copy of these checks in `system/launchReadiness`.

## Hosting and domain

- [ ] GitHub Pages is enabled from the `main` branch and repository root.
- [ ] Repository `CNAME` is exactly `directors.ask4prayers.com`.
- [ ] DNS resolves `directors.ask4prayers.com` to GitHub Pages.
- [ ] `https://directors.ask4prayers.com` loads successfully.
- [ ] Production HTTPS is enforced.

## Firebase

- [ ] Firebase project is `tpp-direc`.
- [ ] Email/Password Authentication is enabled.
- [ ] `directors.ask4prayers.com` is authorized for Firebase Authentication.
- [ ] Cloud Firestore is active.
- [ ] Current `firestore.rules` compile successfully.
- [ ] Current `firestore.rules` are deployed to `tpp-direc`.
- [ ] `firebase.json` contains Firestore rules configuration only.
- [ ] No `firestore.indexes.json` exists.
- [ ] Firebase Hosting, Storage, and Functions remain unused.

## Founder and accounts

- [ ] Protected Founder Director Firebase Auth identity is bootstrapped.
- [ ] Founder profile is the only `root: true` / `systemRole: founder_director` record.
- [ ] Founder login works through the normal Board portal flow.
- [ ] Director account provisioning works without replacing the Founder session.
- [ ] First activation code flow works.
- [ ] Four-digit PIN setup works.
- [ ] Subsequent Full Name + PIN sign-in works.
- [ ] PIN change works.
- [ ] PIN recovery procedure works.
- [ ] Suspension immediately removes portal access.
- [ ] No non-Founder account has wildcard `*` permission.
- [ ] Existing accounts have the intended current Phase 8/9 permission set.

## Board data

- [ ] Real Board roster is loaded.
- [ ] Interim/confirmed Board status is correct.
- [ ] Voting eligibility is correct.
- [ ] Officer roles are correct.
- [ ] Terms are correct.
- [ ] Directory visibility is correct.
- [ ] Permission templates/individual grants are reviewed.
- [ ] Board notices are current.

## Documents

- [ ] No native upload control is present.
- [ ] Google Docs links work.
- [ ] Google Drive links work.
- [ ] Google Sheets links work.
- [ ] Google Slides links work.
- [ ] Non-Google document URLs are rejected.
- [ ] Board / Officers / Selected Directors / Founder-only scopes were tested.
- [ ] Google sharing permissions were verified separately from portal access.
- [ ] Board Inbox review/revision/Agenda Ready workflow was tested.

## Meetings and voting

- [ ] Meeting creation works.
- [ ] Director roster snapshot works.
- [ ] Check-in works across multiple devices.
- [ ] Departed/returned attendance works.
- [ ] Quorum recalculates correctly.
- [ ] Recess/resume works.
- [ ] Adjourn/cancel locks attendance.
- [ ] Agenda items and Agenda Ready documents work.
- [ ] Motion and second workflow works.
- [ ] Mover cannot second the same motion.
- [ ] Recusal removes the director from that vote's eligible ballot snapshot.
- [ ] Portal-wide Vote Now alert works.
- [ ] Approve/Oppose/Abstain ballots work.
- [ ] Ballots are immutable.
- [ ] Recorded ballot audit works.
- [ ] Confidential ballot access works as designed.
- [ ] Only one pushed vote can be active per meeting.
- [ ] `open -> closing -> closed` works.
- [ ] Closing recovery works after interrupted connectivity.
- [ ] Meeting cannot recess/adjourn while a pushed vote remains active.
- [ ] Resolution record is created when vote closes.

## Minutes and permanent records

- [ ] Minutes use Google links only.
- [ ] Draft -> Ready works.
- [ ] Return to Draft works before certification.
- [ ] Certification preflight blocks unfinished live business.
- [ ] Certification creates the permanent meeting record.
- [ ] Certified meeting remains historically Adjourned.
- [ ] Certified resolutions are linked to the permanent record.
- [ ] Certified records cannot be rewritten/deleted.
- [ ] Board Records search/print view works.

## Governance operations

- [ ] Committees and charters tested.
- [ ] Director annual COI self-service privacy tested.
- [ ] COI reviewer Board-wide access tested.
- [ ] Specific conflict/recusal records tested.
- [ ] Officer term assignment/conclusion tested.
- [ ] Founder root protection during delegated officer management tested.
- [ ] Board task ownership/self-service restrictions tested.
- [ ] Compliance due-state calculations reviewed.

## Security and administration

- [ ] Security & Audit Center loads for Founder.
- [ ] Delegated `audit.view` sees only intended audit access.
- [ ] Revoking `audit.view` takes effect while the account is signed in.
- [ ] Formal access review creates the audit event + marker atomically.
- [ ] Security policy record exists.
- [ ] No unresolved critical incident exists.
- [ ] Emergency access freeze was tested.
- [ ] Founder remains accessible during the freeze.
- [ ] Freeze restore returns affected accounts to their prior states.
- [ ] Runtime offline/degraded-mode banner works.

## QA and devices

- [ ] Phase 2–3 harness passed.
- [ ] Phase 4 harness passed.
- [ ] Phase 5 harness passed.
- [ ] Phase 6 harness passed.
- [ ] Phase 7 harness passed.
- [ ] Phase 8 harness passed.
- [ ] Phase 9 harness passed.
- [ ] Phase 10 harness passed.
- [ ] Chrome/Chromium desktop reviewed.
- [ ] Android/mobile layout reviewed.
- [ ] Small-screen meeting voting reviewed.
- [ ] Tablet layout reviewed if Board will use tablets.
- [ ] Refresh/reconnect during a meeting was tested.
- [ ] Multi-device simultaneous Board activity was tested.

## Cleanup and launch

- [ ] Test accounts are removed/disabled as appropriate.
- [ ] Test meetings/votes/documents are removed or clearly segregated before official use.
- [ ] First real organizational meeting is prepared.
- [ ] Founder runs **Launch Readiness → Run Production Diagnostics**.
- [ ] Every critical automatic check passes.
- [ ] Every manual Launch Readiness item is checked.
- [ ] Founder records **Ready for Launch**.
- [ ] Final production smoke test passes at `https://directors.ask4prayers.com`.
- [ ] Founder records **Production Launched**.

Recording the launch milestone is an audit/governance record. It does not itself configure GitHub Pages, DNS, Firebase Authentication, or deploy Firestore Rules.
