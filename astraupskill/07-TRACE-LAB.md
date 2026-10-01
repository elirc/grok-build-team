# Trace lab: a task, two editors, and an accountable discussion

Use the fictional local accounts from [the setup guide](../README.md). Keep developer tools open and record the route, actor, selected organization, expected version, response status, and resulting audit action for each step. Avoid copying bearer tokens or passwords into your notes.

## The membership lookup Round 1 asks you to find

Round 1 sends you to `backend/src/middleware/tenantContext.ts:12`. The organization arrives in a header, but the role comes from the membership row this function loads — which is why a task body cannot choose its own tenant or authority.

```ts
    if (!req.userId) throw new AppError(401, "Sign in to continue.");
    const parsed = identity.safeParse(req.headers["x-org-id"]);
    if (!parsed.success)
      throw new AppError(
        400,
        "Select an organization using the x-org-id header.",
      );
    const membership = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: req.userId,
          organizationId: parsed.data,
        },
      },
    });
    if (!membership)
      throw new AppError(403, "You are not a member of that organization.");
    req.tenant = {
      userId: req.userId,
      organizationId: parsed.data,
      role: membership.role,
    };
```

## Round 1: establish the relationship

Sign in as the Cedar owner and create a project called "Reliable request forms." Add a task called "Explain stale-save recovery," assign it to Sam Member, and give it due date February 29, 2032. Inspect the outgoing request. Its body contains editable task fields, while the parent project is in the URL and the team selection is in the organization header.

Find the current membership lookup in [tenantContext.ts](../backend/src/middleware/tenantContext.ts). Then find assignee validation and date conversion in [projectRepository.ts](../backend/src/repositories/projectRepository.ts). Explain why both the project relationship and assignee relationship contain the organization ID. Record the accepted task identity and version.

Search the assignee choices for a name that excludes Sam. The existing selection should remain visible and unchanged. Clearing the assignment requires choosing Unassigned and saving. A search result is a window onto possible references, not the full state of your current task.

## Round 2: preserve a losing task draft

Open the task in a second signed-in tab. Change its description differently in each tab, leaving both drafts based on the same version. Save the first. Save the second and inspect its conflict response. The losing text, due date, and assignment remain available. Export the draft and identify which values are pending and which version was captured.

Load the current task only after confirming replacement. Explain why the client must not automatically increment its baseline and submit the losing text again. Compare the persisted version with the task audit. There should be one accepted update from this race.

## Round 3: authorship and moderation

Sign in as Sam Member and add a comment explaining the task's acceptance criteria. Open the same comment as Alex Owner. The owner can review and explicitly delete it, but cannot edit Sam's words. Inspect [commentRepository.ts](../backend/src/repositories/commentRepository.ts) to find the server-side author check. Hidden Save controls alone would not be sufficient protection.

Try deleting the task while it still has this comment. The operation should refuse and preserve both records. If you deliberately moderate-delete the comment, inspect the retained COMMENT audit in your development database: the actor is the moderator and the action is MODERATE_DELETE. The original CREATE audit still records Sam's contribution. These are change metadata, not a full restore snapshot of the deleted text.

## Round 4: guard unfinished discussion

Start a new comment without saving it. Try New task, switching organizations, and signing out; decline each discard prompt. Your pending comment should remain. Export it, then explicitly close the task and accept discarding the local draft. Explain how CommentsPanel reports dirty and busy state to the parent workspace and why a task save should not submit a comment accidentally.

Finish by writing one precise regression test for a boundary you traced. Include the persisted state you expect after failure, rather than asserting only that an error appeared. Compare your evidence with [the testing guide](04-TESTING-AND-DEBUGGING.md).
