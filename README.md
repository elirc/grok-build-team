# Team workspace

A local React, Express, TypeScript, and PostgreSQL application for learning reliable project, task, and comment CRUD. Sign in to a fictional team, create a project, assign tasks to its members, set calendar due dates, and discuss the work. You can also register a local account that owns a new private team.

Start the detailed [junior-to-mid-level course](astraupskill/README.md) after the first successful local run. The original JOURNAL and PHASE_PLANS files remain historical design notes; this README and the course describe the implemented application.

## Local setup

Use Node 22 and npm. Use a fresh dedicated PostgreSQL database for this schema. No existing database is automatically upgraded, and the setup script does not overwrite environment files.

```powershell
npm ci
npm run setup:local
docker compose up -d postgres   # unverified path: prefer npm run setup:local (see astraupskill/VERIFICATION.md)
npm run db:generate
npm run db:deploy
npm run build
npm run seed --workspace backend
```

`setup:local` creates a root `.env` for Compose and `backend/.env` for the API, with independent generated database, JWT, and demo-password values. Read the generated `DEMO_PASSWORD` locally when signing in; do not commit or share those files. The seed requires `ALLOW_DEMO_SEED=yes`, which this explicit local setup supplies. If either environment file exists, setup refuses to overwrite it. Inspect your configuration and adapt it deliberately instead of deleting an unknown file.

Compose exposes PostgreSQL only on `127.0.0.1:5439`, using database `team_workspace` and user `team_dev`. If using your installed PostgreSQL server instead, create a dedicated empty database and configure `backend/.env` yourself. The migration creates the complete initial schema and relational constraints. The Compose daemon was not used during implementation verification; the automated helper used installed PostgreSQL executables.

Run these in separate terminals from the project root:

```powershell
npm run dev --workspace backend
npm run dev --workspace frontend
```

Open `http://127.0.0.1:5175`. The API binds to `127.0.0.1:4002`; the Vite proxy forwards `/api`. Use the documented loopback hostname consistently. Optional proxy settings belong in `frontend/.env`; credentials never belong in frontend environment variables.

## Accounts and roles

The fictional seed creates `owner@example.test`, `member@example.test`, and `outsider@example.test`, all using the generated demo password. Alex Owner owns Cedar Studio and is a regular member of Maple Works. Sam Member belongs only to Cedar Studio. Morgan Owner owns Maple Works. Seed identities are stable; repeating the seed preserves existing passwords and edits, and partial seed identities cause an explicit refusal.

Owners and administrators can create, edit, and delete projects. All current team members can manage that team's tasks. Only a comment's author may edit its words. Its author or a team owner/administrator may explicitly delete it, with a separate moderation audit action for another author's comment.

Registration creates a user, a new team, its owner membership, and a team creation audit in one transaction. It never joins an existing team based on a supplied organization ID or role. Membership invitation, role management, and team deletion interfaces are not implemented. Use the seeded accounts to study existing multi-team membership.

## Editing and relationships

Every edit or delete carries the saved version. Competing edits yield a conflict while the losing browser retains its draft. Export pending work before choosing Load current. A list refresh does not silently replace an editor's captured baseline. Confirmed saves and failed list refreshes have separate feedback.

Task fields include title, description, status, an optional real calendar due date from 1970 through 2100, and an optional assignee from the current team. Member search is paginated, and an existing selection remains visible outside the current result page. The database also enforces same-team project and assignment relationships. Task statuses can be changed among TODO, IN_PROGRESS, and DONE; there is no approval workflow or notification service.

Delete comments explicitly before deleting their task, and delete tasks explicitly before deleting their project. Historical audit metadata remains after deletion. A referenced membership cannot be removed while tasks are assigned to it; reassignment is a deliberate prerequisite. Comments store their actual author, independent from the actor who later moderates a deletion.

## Verification

```powershell
npm run test:api
npm test
npm run verify
```

The helper creates an owned temporary PostgreSQL cluster, migrates it, runs the requested tests, checks the repeatable seed, and confirms shutdown before removing its own cluster. Install PostgreSQL executables and set `POSTGRES_BIN` if they are not on PATH. On Windows the helper defaults to PostgreSQL 18's installation directory. Browser checks use Playwright 1.60; install its matching browser with `npx playwright install chromium`. `PLAYWRIGHT_BROWSERS_PATH` can point to an existing matching cache. Results default to `.verification`, or `TEAM_VERIFY_RESULTS_DIR` when provided.

Read [verification and limitations](astraupskill/VERIFICATION.md) for actual results. This is a local learning workspace: expiring memory-only tokens, process-local authentication throttling, no MFA or refresh flow, no durable create idempotency, and no production deployment. A timeout may occur after a write commits; inspect current state before repeating a create.
