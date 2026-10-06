# Review reasoning for the next feature

These notes describe possible solutions to [the practice exercises](05-PRACTICE.md). They are design guidance, not claims that the extensions already exist. A strong review follows the state transition and asks what can happen concurrently, what must be committed together, and what a caller may retry safely.

## The narrow-mutation shape already in the repository

Before designing bulk reassignment, read the existing narrow mutation, `backend/src/repositories/commentRepository.ts:136`. The author check, the scoped predicate, the version condition and the audit write are all inside one `prisma.$transaction`, and `changed.count !== 1` is the conflict.

```ts
  return prisma.$transaction(async (tx) => {
    const current = await rowIn(tx, context, projectId, taskId, id);
    if (current.authorId !== context.userId)
      throw new AppError(403, "Only the author can edit a comment.");
    const changed = await tx.comment.updateMany({
      where: {
        ...scoped(context, projectId, taskId),
        id,
        authorId: context.userId,
        version: expected,
      },
      data: { ...data, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw conflict();
    await audit(tx, context, id, "UPDATE", expected + 1);
```

## What the composite foreign keys do and do not check

The assignment backstop is `Task_assigneeId_organizationId_fkey`, `FOREIGN KEY ("assigneeId", "organizationId") REFERENCES "OrganizationMember"("userId", "organizationId")` in the initial migration. Three details are worth knowing before you add any new relationship with the same pattern:

- **The referenced pair needs its own unique constraint.** PostgreSQL only accepts a foreign key that targets a primary key or unique constraint. That's why the schema carries `@@unique([userId, organizationId])` on `OrganizationMember` and `@@unique([id, organizationId])` on `Project` and `Task`, even though each `id` is already unique on its own. Without the extra unique index, the migration fails.
- **Nullable columns use `MATCH SIMPLE`.** The migration doesn't specify a match type, so PostgreSQL uses the default, `MATCH SIMPLE`: if *any* referencing column is null, the constraint is not checked at all. That's what lets an unassigned task (`assigneeId` null) exist. It's safe here only because `Task.organizationId` is `NOT NULL`. If you add a composite reference whose tenant column can be null, a row with a null tenant skips the check entirely. Either keep the tenant column `NOT NULL` or declare `MATCH FULL`.
- **Postgres does not index the referencing side for you.** No index on `Task` starts with `assigneeId`. When a membership row is deleted, the `RESTRICT` check has to find tasks by `(assigneeId, organizationId)`. The `(organizationId, projectId, createdAt, id)` index narrows that to the team's tasks, but no further. That's fine at this scale. If membership removal becomes a bulk operation (exercise 2), add `@@index([organizationId, assigneeId])` and confirm with `EXPLAIN` that the check stops scanning the whole team.

**Check:** in a scratch database you migrated and seeded yourself (never your personal one), insert a task directly in SQL with a real Cedar `projectId`, `organizationId` `demo_cedar` and `assigneeId` `demo_outsider` (a Maple-only user). PostgreSQL rejects it with a foreign-key violation naming `Task_assigneeId_organizationId_fkey` (the existing test `enforces same-team assignment even when a writer bypasses the repository` does the same through Prisma). The same insert with `assigneeId` null succeeds.

## Filtering without changing authority

An assignee filter should become another validated clause in the repository predicate. Preserve the organization and project clauses regardless of the requested assignee. One clear API could use `assignment=all`, `assignment=unassigned`, or `assigneeId=<validated-id>`, with mutually exclusive combinations. Reject ambiguous combinations instead of choosing an undocumented precedence.

Use the same predicate for total and items under the existing consistent-read transaction. Add the filter to the React Query key. When an accepted edit moves a task out of the filtered population, retain the editor's accepted row and show the updated list separately. Do not treat disappearance from a filtered list as deletion. Test the distinction with two tabs and an assignment change.

## Reassignment is a narrow mutation

A bulk reassignment operation should update the assignment field and version, not resubmit stale title, description, and status snapshots. Decide how to handle concurrent assignment changes. A preview is an observation, not a lock held while the user thinks. The final operation must recheck the selected team's members and affected records inside its transaction.

Membership removal and reassignment also interact with comment history. Preserve author identity independently from current access. A former member can remain the historical author while new API requests using their old token lose team access. Keep the scope check on every request; do not infer authority from a comment's author ID alone. If a large reassignment cannot fit one practical transaction, design a resumable operation with explicit progress and recovery instead of pretending a series of independent writes is atomic.

## Outbox and retry evidence

An outbox worker needs a claim mechanism so multiple workers do not process the same pending row without coordination. It also needs an attempt identity or provider idempotency mechanism for the crash window after remote acceptance. A database transaction cannot roll back an already sent message. Tests should cover task rollback before outbox commit, worker retry after a known rejection, and ambiguous provider acceptance.

For comment-create idempotency, use a unique actor/operation/key constraint and a payload fingerprint that includes the task parent. Store the accepted response or stable resource identity in the same transaction. Resolve simultaneous duplicate keys through the committed receipt rather than issuing another create. Define whether a later retry after deletion returns a tombstone or the historical receipt; silently recreating the deleted comment is usually a surprising retry contract.

## A reviewable change packet

Include one successful request and one rejected example, the source of actor identity, the exact relationship constraint, version behavior, and rollback evidence. Show a screenshot or browser assertion for preserved input after failure. Explain how the migration applies to an existing development database and what a downgrade would lose.

Avoid broad claims such as fully secure, exactly once, or production ready. State the specific verified boundary and its limits. The existing [verification record](VERIFICATION.md) is an example of distinguishing builds, database tests, browser evidence, and capabilities that remain unimplemented.
