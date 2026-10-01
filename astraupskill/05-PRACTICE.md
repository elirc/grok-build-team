# Practice: take one team feature through every layer

Choose one exercise, write its acceptance criteria, and complete it as a vertical change. A route, table, and button are intermediate pieces. The finished feature needs an authorized actor, strict input, a consistent relationship, predictable failure behavior, an understandable editor, and evidence. Use fictional fixtures and read [the solution review](06-SOLUTIONS-AND-REVIEW.md) after drafting your design.

## 1. Add a task assignee filter

Task search currently filters title and status. Add a nullable assignee filter that distinguishes all tasks, unassigned tasks, and tasks assigned to a selected member. Define an unambiguous query representation; do not overload an empty string to mean two different things. Compose the new predicate with organization and project scope, and use it consistently for both count and rows.

Add the filter to the query cache key and reset pagination when it changes. Verify an assignee outside the team cannot expand access. Test a task whose assignment changes while the current filtered list is visible. The editor must retain unsaved work even if its task disappears from the list after refresh. Your review should explain the difference between list membership and record identity.

## 2. Build a safe reassignment workflow

The database refuses membership removal while tasks still reference that member. Design a team-admin operation that reassigns all affected tasks to another current member or explicitly leaves them unassigned. Include captured versions or another clear concurrency policy. A task edited concurrently must not lose its newer content because a bulk operation rewrote the whole row.

Keep task reassignment and the membership change within a deliberate transaction boundary, with accountable audit events. Decide how existing comment authorship should behave after membership removal: historical author identity should remain truthful even when the person no longer has access. Implement a preview that shows affected counts and a final confirmation. The current application has no membership-management UI, so this is an extension, not a hidden existing feature.

## 3. Add durable notification intent

Suppose assigning a task should notify its new owner. Calling an email provider before the task commits can notify someone about a rolled-back assignment. Calling it after commit can lose the notification when the process stops. Introduce an outbox row in the same transaction as the assignment and audit, then process it separately.

Define retry identity, attempted and accepted states, and how duplicate delivery is handled. Use a fake provider for tests and do not send real messages during development. Demonstrate a worker failure after the provider accepts a message but before the local receipt is updated. Explain which guarantees you can support and which remain at-least-once delivery behavior.

## 4. Make create retries explicit

Registration and comment creation do not have durable idempotency keys. Add an actor-scoped key to comment creation, store a fingerprint of normalized content and parent identity, and commit the receipt with the comment and audit. Same key plus same payload should return the original accepted result; a different payload should conflict. Specify behavior after the comment is deleted and after receipt expiry.

For each exercise, deliver a source change, a failure test, a browser recovery example, and a migration note. Keep a clear list of implemented behavior and remaining limits. That discipline makes a small feature more convincing than a large collection of unverified controls.
