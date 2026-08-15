# Founder Director First-Run Setup

The protected Founder account is now initialized through the portal's one-screen first-run setup. Manual creation of `directors`, `boardDirectory`, `loginDirectory`, and `system/counters` records is no longer required.

## Protected Firebase Auth identity

The one-time bootstrap is hard-bound in Firestore Security Rules to this Firebase Authentication UID:

```text
QuctEgPv6laYa98bGaLasSdSERk1
```

That UID is the only authenticated identity allowed to invoke the one-time Founder bootstrap exception.

The exception automatically closes once the protected Founder director document exists.

## Founder identity created by the wizard

```text
Full name: Christopher Shelley
Normalized name: christopher shelley
Director number: DIR-000001
Board role: Founder Director
Board status: interim
System role: founder_director
Root: true
Voting status: eligible
Permissions: ["*"]
Permission template: founder_root
```

The fixed SHA-256 login key is:

```text
1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76
```

## What must exist before first run

Only one Firebase Authentication user must be created manually.

In Firebase project `tpp-direc`:

1. Enable **Authentication > Email/Password**.
2. Create the temporary Firebase Auth user whose UID is exactly `QuctEgPv6laYa98bGaLasSdSERk1`.
3. Keep the temporary email/alias and temporary password private.
4. Deploy the current repository `firestore.rules`.

Do not manually create the Founder Firestore documents.

## First-run portal flow

Open the normal Board Portal and choose:

```text
First-time Founder setup
```

or open:

```text
/founder-setup.html
```

Enter:

- the temporary Firebase email/alias used for the Auth user;
- its temporary Firebase password;
- the four-digit PIN you want to use for the Board Portal;
- the PIN again for confirmation.

Press:

```text
Initialize My Founder Portal
```

The wizard then:

1. signs into Firebase Authentication with the temporary credential;
2. verifies that the authenticated UID exactly equals `QuctEgPv6laYa98bGaLasSdSERk1`;
3. atomically creates the protected Founder `directors` record;
4. creates the safe Board-facing `boardDirectory` mirror;
5. creates the exact-name `loginDirectory` record;
6. initializes `system/counters` so the next Board account is `DIR-000002`;
7. replaces the temporary Firebase password with the PIN-backed internal credential;
8. changes the Founder account to `active`;
9. records a Founder bootstrap audit event when available;
10. signs out and returns to normal Director Sign In.

No activation code is required for the Founder first-run flow.

## Normal Founder login after setup

After first-run setup, normal login is simply:

```text
Christopher Shelley
→ four-digit PIN
→ Founder Director Portal
```

The temporary Firebase email/password is no longer used for normal Board Portal sign-in.

## Records automatically created

The wizard creates:

```text
directors/QuctEgPv6laYa98bGaLasSdSERk1
boardDirectory/QuctEgPv6laYa98bGaLasSdSERk1
loginDirectory/1003e917ed8c7dba3019775969f12c8cc751e5cc9e18a011b6719a7efc2d9e76
system/counters
```

The temporary password and four-digit PIN are never stored in Firestore.

## Bootstrap security boundary

The first-run screen being publicly reachable does not grant Founder access.

Firestore Rules require the request to be authenticated as the exact preselected Firebase UID. They also constrain the bootstrapped Founder identity to `DIR-000001`, `Founder Director`, `founder_director`, `root: true`, and wildcard permissions. Once the Founder `directors` document exists, `founderBootstrapOpen()` evaluates false and the one-time bootstrap path is closed.

A visitor who does not control the preselected Firebase Auth account cannot initialize a different UID as Founder through this workflow.

## Root invariants after setup

1. Ordinary account creation cannot create `root: true`.
2. Ordinary account creation cannot assign `systemRole: founder_director`.
3. Normal account-management paths cannot suspend, archive, demote, or overwrite the Founder root.
4. Root authorization is based on the authenticated Firebase UID and protected Firestore profile, not a typed name alone.
5. Founder root has wildcard portal capability `*`.
6. Future exceptional root maintenance must be explicit and auditable.

## Forgotten PIN

The project still intentionally has no application server, Cloud Functions, or production Admin SDK runtime. Forgotten-PIN recovery therefore remains a console-assisted administrative process rather than allowing a public browser to reset Firebase Authentication credentials for another identity.
