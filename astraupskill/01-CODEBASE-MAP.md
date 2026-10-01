# Map the application by responsibility

The workspace has a React frontend and an Express API using a shared Prisma client. Read a single request vertically before reading every file. A good starting point is updating a task's assignee, because it crosses identity, a parent relationship, input validation, a database constraint, and an editor baseline.

## Entry and identity

[app.ts](../backend/src/app.ts) constructs the HTTP application independently from [index.ts](../backend/src/index.ts), which binds the loopback server and handles shutdown. This separation lets Supertest exercise the real route stack without starting the production listener. The app establishes request IDs, bounded JSON parsing, allowed browser origin, controlled errors, and authenticated routes.

[authRoutes.ts](../backend/src/routes/authRoutes.ts) bounds sign-in and registration attempts and calls [authService.ts](../backend/src/services/authService.ts). Registration commits user, team, owner membership, and audit together. [auth.ts](../backend/src/middleware/auth.ts) issues and verifies expiring tokens. Tokens identify the subject; they do not supply a trusted current team role.

[tenantContext.ts](../backend/src/middleware/tenantContext.ts) treats `x-org-id` as a requested selection and looks up the subject's current membership in PostgreSQL. It attaches the verified context used by project, task, member-reference, and comment operations. A guessed organization header alone grants no access.

## Domain and persistence

[validation.ts](../backend/src/lib/validation.ts) defines strict editable shapes, versions, query bounds, identifiers, and real calendar dates. Project routes delegate nested task routes using merged route parameters. The service keeps the parent project ID separate from the task body; clients cannot move a task by injecting a different project ID.

[projectRepository.ts](../backend/src/repositories/projectRepository.ts) coordinates project and task storage because their relationships share a boundary. The original task service and repository entry files now expose the scoped operations instead of retaining unprotected starter functions. [commentRepository.ts](../backend/src/repositories/commentRepository.ts) enforces parent scope, authorship, moderation, captured versions, and transactional comment audits.

Read [schema.prisma](../backend/prisma/schema.prisma) alongside the [initial migration](../backend/prisma/migrations/202609090001_team_workspace/migration.sql). A task references its project using project ID plus organization ID. Its optional assignee references membership using user ID plus organization ID. The database can therefore reject a cross-team relationship even when another writer bypasses the HTTP service.

## Frontend state

[App.tsx](../frontend/src/App.tsx) owns the in-memory session and active membership. [ProjectsPage.tsx](../frontend/src/features/projects/pages/ProjectsPage.tsx) composes the project library and task editors, using the existing TasksPage entry. React Query keys separate organization data; editable drafts and saved baseline records remain separate state.

[AssigneePicker.tsx](../frontend/src/features/tasks/components/AssigneePicker.tsx) searches bounded member pages and resolves the current selection separately. [CommentsPanel.tsx](../frontend/src/features/tasks/components/CommentsPanel.tsx) owns the comment draft and reports its dirty/busy state to the parent navigation guard. This communication prevents switching tasks from silently discarding a pending discussion.

Finish the map with [the integration suite](../backend/src/__tests__/taskRoutes.integration.test.ts) and [browser scenarios](../browser-tests/workspace.spec.mjs). Identify which tests inspect PostgreSQL rows and which inspect retained browser input. Both observations are needed to explain a reliable edit.
