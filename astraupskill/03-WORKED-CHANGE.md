# Worked change: assign a task and preserve its calendar due date

Begin with a task that already belongs to a project in Cedar Studio. The original starter accepted an optional assignee ID but did not verify membership, and its UI did not offer a usable edit form. The completed change treats assignment as a relationship that must hold across both the request and database boundaries.

## 1. Define the editable contract

A create body includes title, status, description, nullable due date, and nullable assignee ID. The project comes from the route and organization comes from verified context. For an existing record the body wraps the editable values with a captured version:

```json
{
  "version": 3,
  "task": {
    "title": "Explain conflict recovery",
    "status": "IN_PROGRESS",
    "description": "Include an example of the retained draft.",
    "dueDate": "2032-02-29",
    "assigneeId": "demo_member"
  }
}
```

February 29 is valid in 2032. The same day in 2031 is rejected. An unknown property such as `organizationId` or `projectId` is also rejected, rather than passed through to Prisma. Inspect `taskInput` and `taskUpdate` in [validation.ts](../backend/src/lib/validation.ts) to see normalization and strictness applied before persistence.

## 2. Verify both parent and reference

The route is `/api/projects/:id/tasks/:taskId`. The [task routes](../backend/src/routes/taskRoutes.ts) receive merged parent parameters and require verified membership. The repository ([projectRepository.ts](../backend/src/repositories/projectRepository.ts)) finds the task with its task ID, project ID, and selected organization ID. Note that `backend/src/repositories/taskRepository.ts` and `backend/src/services/taskService.ts` are deliberate nine-line re-export shims; the transaction you are looking for lives in `projectRepository.ts`. A task ID from another route parent cannot be substituted successfully.

Before writing an assignment, the repository finds the selected user's membership in the same organization. A user who exists only in Maple is refused for a Cedar task. The compound foreign key in [the schema](../backend/prisma/schema.prisma) enforces the same relationship for writers outside this code path. Explain why a plain foreign key to User would be insufficient.

## 3. Commit the conditional change and audit

The update predicate includes the captured version. Exactly one matching row is updated, its version increments, and its TASK audit is inserted in the same transaction. A stale predicate produces a conflict. A failed audit insert rolls back the data update. The response converts the optional stored date into a date-only string before the frontend adopts it.

## 4. Preserve selection and unfinished work

[AssigneePicker](../frontend/src/features/tasks/components/AssigneePicker.tsx) searches member pages and separately resolves the currently selected member. A search that excludes the assignee does not silently unassign the task. The task draft stores the member ID, while the option label supplies name and email for disambiguation.

The parent editor captures the submitted values and baseline before awaiting the request. On success it adopts the returned row and version. On failure it keeps its pending description, date, and assignment. A comment editor has an independent version and draft; saving the task does not submit that comment accidentally.

Verify the change with a valid assignment, an outsider assignment, a leap-day boundary, two competing edits, and a direct database attempt that bypasses the repository. Then perform the same edit in a browser and inspect the accepted row. [The testing guide](04-TESTING-AND-DEBUGGING.md) explains why all of those observations matter.
