# Practice: take one team feature through every layer

Choose one exercise, write its acceptance criteria, and complete it as a vertical change. A route, table, and button are intermediate pieces. The finished feature needs an authorized actor, strict input, a consistent relationship, predictable failure behavior, an understandable editor, and evidence. Use fictional fixtures and read [the solution review](06-SOLUTIONS-AND-REVIEW.md) after drafting your design.

## 1. Add a task assignee filter

Task search currently filters title and status. Add a nullable assignee filter that distinguishes all tasks, unassigned tasks, and tasks assigned to a selected member. Define an unambiguous query representation; do not overload an empty string to mean two different things. Compose the new predicate with organization and project scope, and use it consistently for both count and rows.

Add the filter to the query cache key and reset pagination when it changes. Verify an assignee outside the team cannot expand access. Test a task whose assignment changes while the current filtered list is visible. The editor must retain unsaved work even if its task disappears from the list after refresh. Your review should explain the difference between list membership and record identity.

**Check:** start red. Today `GET /api/projects/:id/tasks?assigneeId=demo_member` returns 400, because `taskListInput` in `backend/src/lib/validation.ts` is `.strict()`, so add that as a failing expectation first. Then, next to `filters and pages tasks within their parent` in `taskRoutes.integration.test.ts`, create one task assigned to `demo_member`, one to `demo_owner` and one unassigned, and assert:
- the unassigned filter returns exactly one item, with `total` 1;
- the `demo_member` filter returns exactly that task;
- filtering by `demo_outsider` (not a Cedar member) returns no Maple rows;
- combining the unassigned filter with an assignee ID returns 400.
`npm run test:api` passes, including the existing `rejects unknown wrapper and repeated query fields` unit test.

## 2. Build a safe reassignment workflow

The database refuses membership removal while tasks still reference that member. Design a team-admin operation that reassigns all affected tasks to another current member or explicitly leaves them unassigned. Include captured versions or another clear concurrency policy. A task edited concurrently must not lose its newer content because a bulk operation rewrote the whole row.

Keep task reassignment and the membership change within a deliberate transaction boundary, with accountable audit events. Decide how existing comment authorship should behave after membership removal: historical author identity should remain truthful even when the person no longer has access. Implement a preview that shows affected counts and a final confirmation. The current application has no membership-management UI, so this is an extension, not a hidden existing feature.

**Check:** an integration test reassigns `demo_member`'s Cedar tasks to `demo_owner` and then removes the membership in one call. Afterwards the membership row is gone, every affected task has `assigneeId` `demo_owner` with its version incremented exactly once, and its title and description are unchanged. A second test edits one affected task's description between preview and confirm. The confirm must either return 409 or keep the newer description; it must never restore the old one. Force an audit failure with the existing `failingAudit` helper and assert that both the membership and the assignments are unchanged. `npm run test:api` passes.

## 3. Add durable notification intent

Suppose assigning a task should notify its new owner. Calling an email provider before the task commits can notify someone about a rolled-back assignment. Calling it after commit can lose the notification when the process stops. Introduce an outbox row in the same transaction as the assignment and audit, then process it separately.

Define retry identity, attempted and accepted states, and how duplicate delivery is handled. Use a fake provider for tests and do not send real messages during development. Demonstrate a worker failure after the provider accepts a message but before the local receipt is updated. Explain which guarantees you can support and which remain at-least-once delivery behavior.

**Check:** with a fake provider that records calls:
- a task assignment that rolls back (use `failingAudit`) leaves zero outbox rows and zero provider calls;
- a committed assignment leaves exactly one pending outbox row in the same transaction;
- a worker that crashes after the fake provider accepts but before the receipt is written delivers a second time on retry, and your test asserts the provider saw the same attempt or idempotency key both times.
Your write-up states that this last case is at-least-once delivery.

## 4. Make create retries explicit

Registration and comment creation do not have durable idempotency keys. Add an actor-scoped key to comment creation, store a fingerprint of normalized content and parent identity, and commit the receipt with the comment and audit. Same key plus same payload should return the original accepted result; a different payload should conflict. Specify behavior after the comment is deleted and after receipt expiry.

**Check:** four integration assertions:
- same key and same body twice gives one comment row, one CREATE audit, and the same comment `id` in both responses;
- same key with a different body gives 409 and no new row;
- two simultaneous requests with the same key (`Promise.all`, modelled on `allows only one simultaneous registration per canonical email`) give exactly one row;
- the same key used by a different user creates a separate comment.

For each exercise, deliver a source change, a failure test, a browser recovery example, and a migration note. Keep a clear list of implemented behavior and remaining limits. That discipline makes a small feature more convincing than a large collection of unverified controls.
