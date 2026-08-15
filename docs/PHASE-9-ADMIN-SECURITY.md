# Phase 9 — Founder Administration, Audit & Security

Phase 9 adds a dedicated Security & Audit Center on top of the operational Board portal built in Phases 1–8.

The fixed architecture remains unchanged:

- GitHub Pages hosting;
- Firebase Authentication + Cloud Firestore only;
- no Firebase Storage;
- no Cloud Functions;
- no production Admin SDK runtime;
- no native file uploads;
- no manual/composite Firestore indexes.

## Founder Security & Audit Center

The Phase 9 workspace is dynamically loaded after the Phase 8 governance modules and appears for:

- the protected Founder Director root account; or
- an account with the existing `audit.view` capability.

Delegated `audit.view` accounts receive the administrative audit stream only. Founder-only security controls remain unavailable.

## Consolidated audit trail

For the Founder root, Phase 9 reads and normalizes:

```text
auditEvents
documentEvents
governanceEvents
recordEvents
```

The browser merges and sorts these event streams by timestamp without a composite index.

The audit view identifies the event source, actor, action, target, and event time. Client-originated document/governance events are labeled as context-correlated rather than represented as cryptographically server-signed logs.

### Important serverless boundary

Because this portal intentionally has no trusted backend, pre-authentication failures cannot be written to Firestore as a trustworthy security log without allowing unauthenticated clients to fabricate those events.

Firebase Authentication remains responsible for its own throttling / credential handling. Phase 9 does not pretend to have authoritative failed-PIN telemetry that the architecture cannot securely provide.

## Access oversight

The Founder can review all director account records and see a focused list of sensitive capabilities, including authority such as:

```text
permissions.manage
directors.create
directors.update
directors.suspend
meetings.activate
meetings.control
votes.push
votes.close
records.certify
coi.manage
officers.manage
tasks.manage
compliance.manage
audit.view
```

The Security Center highlights:

- Founder-root count;
- active / suspended / activation-recovery accounts;
- non-Founder wildcard access;
- non-Founder sensitive capability grants;
- total audit history available to the current account.

Founder Control remains the place where actual per-director permission edits are performed.

## Formal access reviews

The Founder can record a periodic access review as an append-only `auditEvents` record. The event stores a snapshot of each account's:

- UID / director number;
- name;
- account state;
- Board state;
- officer role;
- permission count;
- sensitive permission list.

A lightweight marker is also stored in `system/lastAccessReview` so the current review status can be surfaced without rewriting the historical event.

## Emergency access freeze

Phase 9 implements an actual account-level emergency control rather than a UI-only switch.

When activated by the Founder:

1. all non-Founder Board portal accounts are enumerated;
2. each prior account status is preserved in `system/emergencyAccessFreeze`;
3. every affected non-Founder account is changed to `accountStatus: suspended` in the same batch;
4. the Founder root is not modified;
5. an administrative audit event records the reason and affected-account count.

Existing profile listeners sign suspended users out of normal portal access.

When the Founder lifts the freeze, accounts that are still suspended by the freeze are restored to their prior recorded states. Accounts deliberately changed to another state during the incident are not overwritten by the restore operation.

This control uses the existing account-status authorization boundary, so it does not require Cloud Functions or a new backend.

## Security incident register

Phase 9 stores Founder-only incident records as `system` documents with:

```text
docType: security_incident
incidentNumber
title
description
severity
status
responseNotes
createdAt / createdBy
updatedAt / updatedBy
resolvedAt
```

Supported severities:

```text
low
medium
high
critical
```

Supported statuses:

```text
open
investigating
resolved
closed
```

Incident creation/status changes also create administrative audit events.

## Security policy record

`system/portalSecurityPolicy` stores operational Founder notes such as:

- access-review cadence;
- security/recovery contact instruction;
- recovery-process notes;
- administrative security notes.

This is an operational policy/configuration record. It does not override Firebase Authentication behavior and it does not introduce secret material into the public client.

## Phase 8 completion review

Before Phase 9 was generated, Phase 8 was re-reviewed for:

- COI self-service privacy;
- Board-wide reviewer access;
- task-owner restrictions;
- compliance management boundaries;
- officer-role synchronization;
- Founder-root officer protection;
- dynamic permission/tab updates for already-signed-in accounts.

Phase 8 governance events remain append-only. Phase 9 treats those browser-originated event records as context-correlated operational history and does not overstate them as server-signed evidence.

## No manual/composite indexes

Phase 9 uses authorized plain collection reads and direct document reads. Search, filtering, audit merging, privilege analysis, and security metrics happen in the browser.

There is still no `firestore.indexes.json`.

Firebase deployment remains rules-only:

```bash
firebase use tpp-direc
firebase deploy --only firestore:rules
```

## Phase 10 handoff

Phase 10 can now focus on production hardening rather than new governance features:

- deploy and compile-check the final Firestore rules against `tpp-direc`;
- configure GitHub Pages / DNS / authorized domains;
- bootstrap the protected Founder identity;
- run all browser QA harnesses;
- run multi-account / multi-device live-meeting testing;
- execute Firestore permission-negative tests;
- verify mobile/desktop behavior;
- verify recovery and emergency-freeze procedures;
- remove stale test data;
- launch the operational Board Portal.
