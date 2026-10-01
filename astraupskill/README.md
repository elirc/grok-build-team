# Team workspace course: relationships that survive real edits

This course develops a junior developer's CRUD skills into the judgment expected of a mid-level engineer. The subject is a team workspace: projects contain tasks, tasks have optional assignees and due dates, and members discuss work through comments. The important questions are who may change each record, how related identities stay consistent, and what a user can recover when a save fails.

The original starter had registration and login functions, but task routes did not authenticate callers or check memberships. Its new-task button was a placeholder, and route tests accepted several incompatible statuses as success. The completed local workflow supplies concrete boundaries that you can trace and challenge. Reading architecture comments is useful; proving that a forged assignment cannot cross teams is stronger evidence of understanding.

## Prerequisites and pacing

**Prerequisites:** React state and effects, `fetch` with headers, basic SQL, what a foreign key and a compound foreign key are.

**Pacing:** map + concepts about 2 h, the worked change about 3 h with the app running, one evening per practice exercise, the trace lab 1 h.

## A practical learning sequence

1. Follow [the root setup](../README.md) and use fictional data. Sign in as the owner and member, then compare project mutation controls. Create a task as the member, assign it to a colleague, and add a comment.
2. Read [the codebase map](01-CODEBASE-MAP.md). Find the request's verified subject, selected team, database membership lookup, parsed editable body, scoped repository query, and transaction.
3. Study [the concepts](02-CONCEPTS.md). Explain why a user ID is not enough to prove that someone is eligible for assignment in a particular team.
4. Reconstruct [the worked change](03-WORKED-CHANGE.md), which adds an assignment and calendar due date through every layer. Trace the accepted response back into the editor.
5. Run [the testing exercises](04-TESTING-AND-DEBUGGING.md), implement [the practice tasks](05-PRACTICE.md), and compare [review reasoning](06-SOLUTIONS-AND-REVIEW.md).
6. Complete [the trace lab](07-TRACE-LAB.md) without relying on button labels as proof of server authorization. Review [verification](VERIFICATION.md) before making broader claims.

A useful first experiment uses two tabs editing the same comment. Both capture version 1. Save a different explanation in each. The second save should conflict and preserve its text. Export the losing draft, identify its captured version, and then load the current comment. Explain why automatically retrying with version 2 would defeat the protection.

Keep a small engineering journal with an observation, a hypothesis, a discriminating experiment, and a result. For example: a membership deletion fails because a task still references that assignee. Predict whether deleting an unrelated membership should fail. Then find the compound foreign key and explain which exact relationship it protects.

Your completion artifact should include a small vertical feature, its rejected-request example, a regression test against persisted state, and a migration or compatibility note. You should be able to distinguish a cached list from an editable draft, a successful transaction from a delivered response, a comment author from a moderator, and a private team from a browser-selected identifier. Those distinctions apply to customer portals, ticket systems, inventory apps, and many other CRUD products.
