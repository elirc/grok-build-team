# Verification record and current limits

The team workspace was verified on September 9, 2026 with Node 22.16.0, Prisma 6.19.2, PostgreSQL 18, React 18, Vite 5.4.21, and Playwright 1.60 with Chromium. Verification used fictional data in a helper-owned temporary loopback database. Existing personal databases and project environment files were excluded from both testing and delivery.

## Completed evidence

All 83 automated checks passed: 58 backend tests, six frontend component tests, three setup tests, and 16 Chromium workflows. The backend and frontend typechecks and production builds passed. Fresh migration deployment succeeded, the demo seed ran twice without overwriting existing identities, and PostgreSQL shutdown was confirmed before the helper removed its owned temporary cluster.

Run `npm run test:api` for the backend and setup checks, `npm test` to include component tests, and `npm run verify` for the complete workflow. The [root guide](../README.md) lists prerequisites and configuration. Reports default to `.verification`; `TEAM_VERIFY_RESULTS_DIR` can direct them elsewhere. Fixture cleanup refuses to run without the expected marker, loopback host, and owned database name.

The backend tests verify membership-derived authority, selected-team scope, strict request shapes, project/task CRUD, conditional versions, concurrent edits, literal bounded search, relational constraints, and retained audit metadata. Team-specific coverage includes atomic registration, duplicate registration races, invalid or cross-team assignments, membership references, calendar dates, comment authorship, administrative moderation, wrong-parent reads, and comment create/update/delete rollback after a forced audit failure.

Browser evidence includes project and task CRUD, assignment and due-date editing, local registration, comment CRUD, moderation controls, competing task/project/comment editors, exportable losing drafts, explicit current-value loading, query failures, and dirty task/organization/sign-out navigation. Tokens remain in tab memory, and reloading returns to sign-in. A saved result and a subsequent refresh failure are displayed independently.

The [desktop capture](images/desktop.png) and [narrow capture](images/narrow.png) show the project editor, assigned task with calendar due date, and comment discussion at 1440 and 390 CSS pixels. They were visually reviewed, and the browser check confirmed no horizontal page overflow. A final singular-comment wording correction is presentation-only; no workflow or persistence code changed after the passing run. These checks are useful layout evidence rather than a comprehensive accessibility certification.

## Boundaries not claimed

This is a local learning application. Tokens expire after 30 minutes, authentication throttling is process-local, and there is no MFA, refresh-token flow, email verification, password reset, or server-side token revocation. Membership is checked on every request without a promise of atomic revocation against already in-flight operations. Registration creates a new private team; invitations, role management, membership removal, and team deletion have no application UI.

The migration targets a fresh dedicated database. Unknown existing data was not upgraded. Docker Compose configuration is supplied, but verification used installed PostgreSQL executables rather than a Docker daemon. No production deployment, power-loss experiment, live email, or external provider operation was performed.

Create operations have no durable idempotency receipts. A timeout may follow a committed write, so inspect current state before retrying. Draft exports are manual recovery artifacts without automatic import or merging. Audits retain metadata, not complete before-and-after snapshots; comment audit details are stored in PostgreSQL without a dedicated audit UI. Task statuses are freely editable enum values, and due dates do not schedule reminders. Use [the practice exercises](05-PRACTICE.md) to extend these limits deliberately.
