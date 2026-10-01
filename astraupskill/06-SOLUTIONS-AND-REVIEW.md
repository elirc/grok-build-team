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
