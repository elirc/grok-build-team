# Test what a failure would actually break

Use `npm run test:api` for backend and setup checks, `npm test` to add frontend component tests, and `npm run verify` for the full browser workflow. These commands create a marked temporary database rather than connecting the fixtures to your personal database. The helper checks the loopback hostname, owned database name, and explicit fixture marker before destructive test cleanup. Read [the root setup](../README.md) for PostgreSQL and browser prerequisites.

## One exact-contract test

The revocation case named below is `backend/src/__tests__/taskRoutes.integration.test.ts:165`. Note the explicit reassignment before the membership delete — the fixture is revised to express the scenario rather than the foreign key being removed to accommodate it.

```ts
  it("removes access after membership revocation without trusting old JWT roles", async () => {
    const oldToken = token("demo_member");
    // Membership removal requires explicit reassignment first.
    await prisma.task.updateMany({
      where: { assigneeId: "demo_member", organizationId: a },
      data: { assigneeId: null },
    });
    await prisma.organizationMember.deleteMany({
      where: { userId: "demo_member", organizationId: a },
    });
    expect(
      (
        await request(app)
          .get("/api/projects")
          .set("Authorization", "Bearer " + oldToken)
          .set("x-org-id", a)
      ).status,
    ).toBe(403);
  });
```

## Replace permissive tests with exact contracts

The original route examples accepted arrays such as 200 or 401 as a passing result. That cannot distinguish a working authenticated endpoint from one that rejects every caller. The current [integration suite](../backend/src/__tests__/taskRoutes.integration.test.ts) supplies real fixture identities and expects one exact response for each case. A member can create a task in Cedar; that same member cannot read Maple projects. After membership removal, the old token does not restore access.

Reference constraints matter to the fixture itself. The seed now assigns a task to Sam Member. A test that removes Sam's membership must explicitly clear that assignment first. A separate test proves that directly deleting a referenced membership is refused. Do not remove the foreign key to make an old fixture pass; revise the fixture to express the scenario you actually intend to test.

## Observe rows and audits after races

For a concurrent comment edit, submit two different contents with the same version. Assert exactly one 200 and one 409, then read the persisted comment. Its version should increment once, and only one update audit should exist. For assignment, compare the winning response's assignee and description with the stored task. Checking only response codes can miss a later unintended overwrite.

The audit-failure helper installs a synthetic trigger inside the owned test database. Registration, comment creation, comment update, and deletion must roll back when that trigger rejects the audit insert. The response is a controlled generic server error; internal SQL details are not returned. Assert that the user/team counts or comment content and version remain unchanged after the failure. Remove the synthetic trigger in a finally block so the next test has a clean environment.

## Separate application failures from test mistakes

If a browser check cannot locate a populated textarea, inspect its accessibility snapshot and use its textbox role and exact accessible name. Keep the assertion about retained content. If a member cannot see an assignee option, inspect the selected team and the scoped member request before assuming the select control is broken. A valid user in another team is intentionally absent.

The [browser scenarios](../browser-tests/workspace.spec.mjs) test actual input retention, manual export, current-value loading, moderation controls, and dirty navigation. They also simulate a successful save followed by a failed list refresh. The saved notice must remain meaningful while the refresh error is shown separately. A failed refresh does not prove that the prior write rolled back.

When debugging, record method, route, request ID, status, expected version, and observed persisted state. Exclude tokens, passwords, and personal comment text from logs. Finish with a minimal reproduction and a regression test at the boundary that originally failed.
