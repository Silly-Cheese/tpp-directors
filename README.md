# The Prayer Project — Board of Directors Portal

Private governance portal for The Prayer Project Board of Directors.

## Production target

- **Site:** `https://directors.ask4prayers.com`
- **Hosting:** GitHub Pages
- **Repository:** `Silly-Cheese/tpp-directors`
- **Firebase project:** `tpp-direc`
- **Firebase services allowed:** Authentication and Cloud Firestore only
- **File uploads:** None. Board documents are represented by Google Docs / Drive / Sheets / Slides links.

## Build approach

This repository is intentionally a static web application. It uses native HTML/CSS/JavaScript modules and the Firebase Web SDK from Google's CDN so it can run directly on GitHub Pages without a server-side build environment.

### Planned implementation phases

1. Foundation, Firebase connection, protected app shell, Founder Director bootstrap model
2. Director accounts, first-use PIN activation, login, permissions
3. Director dashboards and Board directory
4. Google-link document center and Board Inbox
5. Meetings, activation, live check-in, attendance and quorum
6. Agenda, motions, resolutions and live voting
7. Minutes, certifications and permanent Board records
8. Committees, conflicts, officer management, tasks and compliance
9. Founder Director administration, audit and security controls
10. Operational hardening, testing and launch

## Security principles

- Firestore rules are the authorization boundary; UI hiding is never treated as security.
- The Founder Director account is the protected root governance-administration identity.
- Other accounts receive granular capabilities assigned by the Founder Director.
- Completed governance records must not be silently rewritten.
- PINs must never be stored in Firestore as plaintext.
- Historical directors remain attached to historical votes and meetings even after login access is disabled.

## Local development

Because the project uses JavaScript modules, serve the repository through a local HTTP server rather than opening `index.html` directly from disk.

Example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

The repository includes a `CNAME` file for `directors.ask4prayers.com`. GitHub Pages still needs to be enabled in repository settings and the DNS record for the subdomain must point to the GitHub Pages host.
