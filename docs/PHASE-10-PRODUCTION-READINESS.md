# Phase 10 — Production Hardening, Verification & Launch Readiness

Phase 10 is the final generation phase for The Prayer Project Board of Directors Portal. It does not add another governance domain. It hardens the existing Phase 1–9 system, exposes production diagnostics, records a Founder-controlled launch checklist, and provides the final handoff to live deployment at `https://directors.ask4prayers.com`.

The fixed architecture remains unchanged:

- GitHub Pages hosting;
- Firebase Authentication + Cloud Firestore only;
- no Firebase Hosting;
- no Firebase Storage;
- no Cloud Functions;
- no production Admin SDK runtime;
- no native file uploads;
- Board files remain Google Docs / Drive / Sheets / Slides links;
- no manual/composite Firestore indexes.

## Phase 9 finalization

Before Phase 10 was opened, Phase 9 received a final security-integrity pass.

### Live audit-permission revocation

`phase9-finalize.js` listens to the signed-in director profile. If delegated `audit.view` access is removed while the user is signed in, the Security & Audit navigation is removed immediately and the user is routed away from the security workspace. Firestore Rules remain the actual authorization boundary.

### Atomic formal access reviews

The original Phase 9 workflow wrote the immutable audit event and the `system/lastAccessReview` marker as two sequential operations. The finalization layer intercepts the normal access-review action and writes both records in one Firestore batch.

The historical audit event and the current marker therefore cannot be separated by an interrupted browser request in the normal portal workflow.

## Production module loader

`js/firebase.js` now maintains:

```text
window.__TPP_MODULE_STATUS__
```

Every production governance module is loaded sequentially and receives a state:

```text
loading
loaded
failed
```

The loader records failures rather than silently terminating the entire diagnostic stack. Later recovery/diagnostic modules may still load even if an earlier module has failed.

The current load order includes:

```text
runtime-hardening
portal-navigation-sync
phase5
phase5-polish
phase6
phase6-closing-recovery
phase6-guard
phase6-alert
phase6-recorded-audit
phase7
phase7-sync
phase7-preflight
phase8
phase8-access-guard
phase9
phase9-finalize
phase10
```

## Runtime hardening

`js/runtime-hardening.js` installs a client-side health layer.

It watches:

- browser online/offline state;
- production module failures;
- uncaught window errors;
- unhandled promise rejections.

The runtime health buffer is intentionally local to the current browser session. It does not write arbitrary browser errors to Firestore.

This prevents untrusted or noisy client telemetry from being represented as authoritative audit evidence.

### Board action warning banner

The portal displays a persistent warning when:

- the browser is offline;
- one or more production governance modules failed to load; or
- a runtime error was detected.

The purpose is operational safety: directors should refresh/recover the portal before continuing an official Board action instead of silently working through a degraded client.

## Launch Readiness Center

Phase 10 adds a Founder-only **Launch Readiness** portal section.

It contains:

1. automatic production diagnostics;
2. Founder manual verification checklist;
3. runtime/module health display;
4. links to all browser QA harnesses;
5. auditable Ready for Launch / Production Launched milestones.

The Launch Readiness Center is visible only to the active protected Founder Director root account.

## Automatic diagnostics

Automatic checks include the following.

### Runtime / hosting

- authenticated session is the active Founder root;
- current hostname is `directors.ask4prayers.com` in production;
- HTTPS is active in production;
- Firebase project ID is `tpp-direc`;
- root `CNAME` matches `directors.ask4prayers.com`;
- `firebase.json` remains Firestore-rules-only;
- no `firestore.indexes.json` is deployed;
- browser reports online network status;
- production governance modules loaded successfully.

Localhost is treated as a warning rather than a production failure for host/HTTPS checks so the diagnostics can still be used during development.

### Security / account integrity

- exactly one Founder root identity;
- no non-Founder wildcard `*` permissions;
- no active emergency access freeze;
- security-policy record status;
- formal access-review marker status;
- no unresolved critical security incidents;
- open non-critical incidents surfaced as warnings;
- activation/PIN-recovery accounts surfaced as warnings.

### Governance runtime integrity

- no live/recessed meeting is silently ignored;
- no pushed vote remains `open` or `closing` before launch approval.

An unfinished pushed vote is treated as a critical launch blocker.

## Manual Founder launch checklist

Some facts cannot be securely or reliably proven by a static browser application. Phase 10 therefore requires explicit Founder verification for items such as:

- GitHub Pages branch/root publishing configuration;
- DNS resolution;
- production HTTPS;
- Firebase Email/Password provider enabled;
- production domain authorized in Firebase Auth;
- current `firestore.rules` compiled and deployed to `tpp-direc`;
- Founder bootstrap verification;
- account/PIN/recovery testing;
- all browser QA harnesses passed;
- multi-device live meeting simulation passed;
- negative Firestore permission tests passed;
- quorum/voting/recusal/closing recovery verified;
- permanent-record certification verified;
- Phase 8 governance workflows verified;
- emergency freeze/restore tested;
- phone/tablet/desktop review completed;
- Google sharing/access verified;
- test data cleaned up;
- real Board roster/permissions/first meeting prepared.

These items live in Founder-only:

```text
system/launchReadiness
```

## Launch gate

The Phase 10 launch gate becomes clear only when:

1. there are no critical automatic failures;
2. there are no critical automatic warnings;
3. every manual launch-verification item is checked.

The portal may then record:

```text
ready_for_launch
```

or:

```text
launched
```

Recording either status creates an `auditEvents` entry and updates the Founder-only launch-readiness record atomically.

### Important limitation

The launch status is an operational governance record. It does **not**:

- enable GitHub Pages;
- modify DNS;
- enable Firebase Authentication;
- add an authorized domain;
- deploy Firestore Rules;
- create the Founder Firebase Auth identity.

Those remain external deployment actions.

## No-index verification

Phase 10 checks for the deployed presence of `firestore.indexes.json` and treats a present file as a launch failure.

The repository continues to deploy only:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

No Phase 10 workflow requires a composite/manual index.

## QA

A new non-destructive harness is available at:

```text
/tests/phase10-production.html
```

It tests the pure readiness evaluator without connecting to Firebase, including:

- good production environment;
- bad host/HTTP/wrong Firebase project/index presence;
- successful and failed module-loader states;
- healthy security snapshot;
- wildcard/freeze/critical incident/open-vote blockers;
- complete and incomplete manual launch gates.

## Production certification boundary

Phase 10 can make the repository code-complete and provide live diagnostics, but the portal should not be called production-verified until the external deployment steps and live multi-account tests are actually completed against `tpp-direc` and `directors.ask4prayers.com`.

That distinction is intentional: code generation and production verification are different milestones.
