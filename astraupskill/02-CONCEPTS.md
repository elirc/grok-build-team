# Concepts: identity, references, versions, and evidence

## Selection is not authorization

A browser can send any organization identifier. The server verifies the token's subject, then reads the matching OrganizationMember row for that requested organization. The current role comes from that row. An owner of Cedar can be a regular member of Maple; treating role as a global user property would grant incorrect privileges.

The same distinction appears in assignment. A real user is not necessarily a member of the selected team. A task's optional assignee uses the compound relationship `(assigneeId, organizationId)` to a membership's `(userId, organizationId)`. The API checks eligibility for a helpful response, and the foreign key provides a database backstop. Removing an assigned membership requires explicit reassignment first.

## One forged request, traced end to end

| step | value | what happens |
|---|---|---|
| token subject | `demo_member` (a Cedar member) | `authenticate` verifies the signature and sets `req.userId` |
| header | `x-org-id: demo_maple` (an organization the caller does not belong to) | `attachTenantContext` parses the header as an identifier |
| membership lookup | `organizationMember.findUnique({ userId: "demo_member", organizationId: "demo_maple" })` | returns `null`: no row |
| decision | 403 `You are not a member of that organization.` | thrown before any project or task query runs |
| Maple data touched | none | the only query was the membership lookup, keyed by the caller |

Change one thing at a time and predict again: no header at all (400 before the membership lookup); a valid Maple member with a Cedar task id in the path (404, because the repository's `where` carries `organizationId` and the row is invisible); a Cedar member who was removed from Cedar an hour ago (403, because the membership row is gone even though the token is still valid). Selection is not authorization: the header selects, the membership row authorizes.

## Record identity and editable state have different lifetimes

A task ID remains stable when its title changes. The saved version describes which accepted state an editor started from. Consider two clients submitting version 4. The first conditional update matches and increments to 5. The second no longer matches version 4 and receives a conflict. It must not silently replace its expected version with 5 and retry the old content.

A React Query list can refresh while an editor remains dirty. Refreshing a list is not permission to replace an unfinished draft. This app keeps the baseline record and editable fields separately, exports pending values with their baseline, and requires an explicit load-current action. That is why the losing browser can show both an error and recoverable work.

## Aggregate writes need one commit boundary

Registration creates several related records: a user, a team, its owner membership, and an audit event. If audit insertion fails, leaving a partially registered account would make retry behavior confusing. The transaction rolls everything back. A comment mutation similarly commits its content or deletion and its audit together.

Transactions do not guarantee that the client receives the response. A connection may break after commit. Repeating a create can therefore make a duplicate unless a durable idempotency design exists. This implementation deliberately documents that limit. A disabled button helps with local double clicks but does not solve an ambiguous network retry.

## Authorship differs from moderation

Only a comment's author can edit its words. An owner or administrator may explicitly delete another person's comment, producing a moderation audit action under the moderator's identity. Allowing an administrator to rewrite another author's comment would misrepresent who said it. This is a domain policy enforced by the API, not just hidden controls.

Deleting a task with comments is refused until those comments are explicitly removed. Deleting a project with tasks follows the same pattern. The application makes destructive consequences visible instead of relying on broad cascading deletion. Audit metadata is retained, but it is not a complete historical snapshot or a restore system.

## Calendar values are not timestamps

A due date is a real `YYYY-MM-DD` calendar value or null, stored as a PostgreSQL date. The API validates the actual day, including leap years, and returns a date-only string. It is not converted into a user's local time zone. Task status is a bounded enum with freely editable values; it does not imply approvals, reminders, or a scheduling engine. Read [the worked change](03-WORKED-CHANGE.md) to connect these ideas to source.
