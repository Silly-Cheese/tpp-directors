# Phase 1 Architecture — Board of Directors Portal

Phase 1 establishes the production foundation for The Prayer Project Board of Directors Portal. It intentionally does not implement director PIN sign-in, account creation, meetings, voting, or document workflows; those are built in later phases on top of this contract.

## Production environment

- Production URL: `https://directors.ask4prayers.com`
- Hosting: GitHub Pages
- Repository: `Silly-Cheese/tpp-directors`
- Firebase project: `tpp-direc`
- Firebase products permitted: Authentication and Cloud Firestore only
- Firebase Hosting: not used
- Firebase Storage: not used
- Cloud Functions: not used
- Board file uploads: not permitted
- Board documents: stored externally in Google Docs, Drive, Sheets, or Slides and represented in Firestore by validated links and metadata

## Application layers

### Static client

The application is a native HTML/CSS/JavaScript-module site. GitHub Pages serves the client directly. There is no application server and no build step required for production.

### Firebase Authentication

Firebase Authentication will establish the authenticated session. Phase 2 is responsible for the final Founder/bootstrap credential flow and the Full Name + PIN director experience.

### Cloud Firestore

Firestore stores governance data, account metadata, permissions, meetings, votes, document-link records, resolutions, compliance records, and audit events as later phases are implemented.

Firestore Security Rules are the authorization boundary. Hiding a button or page in client JavaScript is never considered authorization.

## Identity contract

Every authenticated Board user has an immutable Firebase Authentication UID. The corresponding director profile uses that UID as its Firestore document ID:

`directors/{authUid}`

Human-readable director numbers such as `DIR-000001` are metadata and never replace the immutable UID for authorization.

### Protected Founder Director identity

The Founder Director is represented by a director document containing both:

- `systemRole: "founder_director"`
- `root: true`

The root identity is unique. Later phases must not permit normal director-management screens to delete, archive, suspend, demote, or transfer this identity.

The root account may administer the portal, but portal permissions do not themselves create or change legal corporate authority. Governance authority continues to come from The Prayer Project's governing documents and valid Board actions.

## Director profile baseline

Later phases may extend the record, but the baseline profile is:

```text
directors/{authUid}
  directorNumber
  fullName
  normalizedName
  displayName
  boardRole
  officerRole
  systemRole
  root
  accountStatus
  votingStatus
  termStart
  termEnd
  permissions
  createdAt
  createdBy
  updatedAt
  updatedBy
```

Expected account states include:

- `awaiting_activation`
- `active`
- `pin_reset_required`
- `locked`
- `suspended`
- `inactive`
- `former_director`
- `archived`

Historical governance records must continue to reference a director even after portal access is disabled.

## Planned Firestore collections

The following top-level collection names are reserved by the architecture:

- `directors`
- `meetings`
- `resolutions`
- `documents`
- `committees`
- `tasks`
- `compliance`
- `announcements`
- `auditEvents`
- `system`

Subcollections will be used where the record belongs naturally to a parent governance object, such as attendance and ballots associated with a meeting.

Until the phase responsible for a collection is implemented, Firestore rules should deny access to it by default.

## Governance record principles

1. Completed votes and certified records must not be silently overwritten.
2. Corrections to certified records should create an auditable correction or superseding record.
3. Important administrative actions must produce audit events.
4. Account deactivation must not delete historical participation.
5. Secret-ballot design must separate participation/audit evidence from ballot choice.
6. Quorum and vote thresholds are configuration enforced from valid governance rules, not hard-coded assumptions.

## Google-link-only document policy

There is no file input or Firebase Storage workflow in this project.

Later document forms will accept only supported Google-hosted document links, including Google Docs, Google Drive, Google Sheets, and Google Slides. Firestore stores the link and governance metadata, not the file bytes.

## Phase 1 security posture

Phase 1 rules intentionally provide no write path from the unfinished client. Existing authenticated active directors may read their own profile, and the protected Founder Director identity may read director records. All other governance collections are closed until their phase-specific authorization rules are implemented.

This prevents unfinished screens from becoming accidental write APIs.
