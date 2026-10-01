import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { createApp } from "../app";
import { issueToken } from "../middleware/auth";
import { seedDemo } from "../seed";
import * as repository from "../repositories/projectRepository";

const secret = "synthetic-local-integration-secret-" + "x".repeat(40);
const password = "synthetic-only-password-2026";
let app: ReturnType<typeof createApp>;
const a = "demo_cedar",
  b = "demo_maple";
const token = (id = "demo_owner") => issueToken(id, secret);
const call = (
  method: "get" | "post" | "put" | "delete",
  path: string,
  org = a,
  user = "demo_owner",
) =>
  request(app)
    [method](path)
    .set("Authorization", "Bearer " + token(user))
    .set("x-org-id", org);
const projectValue = {
  name: "Learning API",
  description: "Practice reliable saves",
};
async function createProject(name = "Learning API") {
  const result = await call("post", "/api/projects").send({
    ...projectValue,
    name,
  });
  expect(result.status).toBe(201);
  return result.body;
}
async function createTask(projectId: string) {
  const result = await call("post", `/api/projects/${projectId}/tasks`).send({
    title: "Write a useful regression",
    status: "TODO",
  });
  expect(result.status).toBe(201);
  return result.body;
}
async function failingAudit(work: () => Promise<void>) {
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic internal detail'; END $$`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER reject_test_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_test_audit()`,
  );
  try {
    await work();
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER reject_test_audit ON "AuditEvent"',
    );
    await prisma.$executeRawUnsafe("DROP FUNCTION reject_test_audit()");
  }
}
let fixtureDatabaseVerified = false;
beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL || "http://missing");
  if (
    process.env.TEAM_TEST_DATABASE !== "owned-temporary-cluster" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/astra_team_test"
  )
    throw new Error(
      "Use scripts/test-database.mjs with its owned temporary cluster.",
    );
  fixtureDatabaseVerified = true;
});
async function clearFixtures() {
  if (!fixtureDatabaseVerified)
    throw new Error("Fixture database identity was not verified.");
  await prisma.comment.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}
beforeEach(async () => {
  await clearFixtures();
  await seedDemo(password);
  app = createApp(secret);
});
afterAll(async () => {
  try {
    if (fixtureDatabaseVerified) await clearFixtures();
  } finally {
    await prisma.$disconnect();
  }
});

describe("real PostgreSQL and HTTP tenant contract", () => {
  it("fails closed when an internal caller omits organization context", async () => {
    await expect(
      repository.findByOrganizationId(undefined as never, { q: "", page: 1 }),
    ).rejects.toThrow();
    await expect(
      repository.getProject(undefined as never, "unknown"),
    ).rejects.toThrow();
    expect(() =>
      repository.history(undefined as never, "PROJECT", "unknown"),
    ).toThrow();
  });
  it("signs in with normalized email and returns memberships without hashes", async () => {
    const result = await request(app)
      .post("/api/auth/login")
      .send({ email: " OWNER@EXAMPLE.TEST ", password });
    expect(result.status).toBe(200);
    expect(result.body.user.memberships).toHaveLength(2);
    expect(result.body.user.passwordHash).toBeUndefined();
    expect(jwt.verify(result.body.token, secret)).toMatchObject({
      sub: "demo_owner",
    });
  });
  it("returns the same rejection for missing user and bad password", async () => {
    for (const email of ["missing@example.test", "owner@example.test"]) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "incorrect" });
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Email or password was not accepted.");
    }
  });
  it("rejects missing, wrong, and expired authentication", async () => {
    expect((await request(app).get("/api/projects")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/projects")
          .set("Authorization", "Bearer wrong")
      ).status,
    ).toBe(401);
    const expired = jwt.sign({}, secret, {
      subject: "demo_owner",
      expiresIn: -1,
      issuer: "team-workspace",
      audience: "team-workspace-web",
    });
    expect(
      (
        await request(app)
          .get("/api/me")
          .set("Authorization", "Bearer " + expired)
      ).status,
    ).toBe(401);
  });
  it("requires an explicit organization header and verified membership", async () => {
    expect(
      (
        await request(app)
          .get("/api/projects")
          .set("Authorization", "Bearer " + token())
      ).status,
    ).toBe(400);
    expect((await call("get", "/api/projects", b, "demo_member")).status).toBe(
      403,
    );
  });
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
  it("lists only the selected authorized tenant", async () => {
    const cedar = await call("get", "/api/projects"),
      maple = await call("get", "/api/projects", b);
    expect(cedar.body.items.every((p: any) => p.organizationId === a)).toBe(
      true,
    );
    expect(maple.body.items.every((p: any) => p.organizationId === b)).toBe(
      true,
    );
    expect(cedar.body.items[0].id).not.toBe(maple.body.items[0].id);
  });
  it("scopes single reads and writes even when the user belongs to both tenants", async () => {
    const row = await createProject();
    expect((await call("get", "/api/projects/" + row.id, b)).status).toBe(404);
    expect(
      (
        await call("put", "/api/projects/" + row.id, b, "demo_outsider").send({
          version: 1,
          project: { name: "Wrong" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(
          "delete",
          "/api/projects/" + row.id,
          b,
          "demo_outsider",
        ).send({ version: 1 })
      ).status,
    ).toBe(404);
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: row.id } })).name,
    ).toBe(row.name);
  });
  it("forbids member project mutations while allowing task CRUD", async () => {
    const row = await createProject();
    expect(
      (await call("post", "/api/projects", a, "demo_member").send(projectValue))
        .status,
    ).toBe(403);
    expect(
      (
        await call("put", "/api/projects/" + row.id, a, "demo_member").send({
          version: 1,
          project: projectValue,
        })
      ).status,
    ).toBe(403);
    const task = await call(
      "post",
      `/api/projects/${row.id}/tasks`,
      a,
      "demo_member",
    ).send({ title: "Member task", status: "TODO" });
    expect(task.status).toBe(201);
    expect(
      (
        await call(
          "put",
          `/api/projects/${row.id}/tasks/${task.body.id}`,
          a,
          "demo_member",
        ).send({ version: 1, task: { title: "Member update", status: "DONE" } })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "delete",
          `/api/projects/${row.id}/tasks/${task.body.id}`,
          a,
          "demo_member",
        ).send({ version: 2 })
      ).status,
    ).toBe(200);
  });
  it("reads changed roles from membership for every request", async () => {
    const row = await createProject();
    await prisma.organizationMember.update({
      where: {
        userId_organizationId: { userId: "demo_owner", organizationId: a },
      },
      data: { role: "MEMBER" },
    });
    expect(
      (await call("delete", "/api/projects/" + row.id).send({ version: 1 }))
        .status,
    ).toBe(403);
  });
  it("creates updates and deletes stable identities with retained audit", async () => {
    const row = await createProject();
    const update = await call("put", "/api/projects/" + row.id).send({
      version: 1,
      project: { name: "Renamed", description: "" },
    });
    expect(update.body).toMatchObject({
      id: row.id,
      version: 2,
      name: "Renamed",
    });
    expect(
      (await call("delete", "/api/projects/" + row.id).send({ version: 2 }))
        .status,
    ).toBe(200);
    expect((await call("get", "/api/projects/" + row.id)).status).toBe(404);
    const audit = await call("get", `/api/projects/${row.id}/audit`);
    expect(audit.body.items).toHaveLength(3);
    expect(
      (await call("get", `/api/projects/${row.id}/audit`, b)).body.items,
    ).toHaveLength(0);
  });
  it("accepts one of two concurrent project updates", async () => {
    const row = await createProject();
    const results = await Promise.all(
      ["A", "B"].map((name) =>
        call("put", "/api/projects/" + row.id).send({
          version: 1,
          project: { name },
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: row.id } }))
        .version,
    ).toBe(2);
    expect(
      await prisma.auditEvent.count({ where: { resourceId: row.id } }),
    ).toBe(2);
  });
  it("rejects stale deletion and preserves the current project", async () => {
    const row = await createProject();
    await call("put", "/api/projects/" + row.id).send({
      version: 1,
      project: { name: "Current" },
    });
    expect(
      (await call("delete", "/api/projects/" + row.id).send({ version: 1 }))
        .status,
    ).toBe(409);
    expect((await call("get", "/api/projects/" + row.id)).body.name).toBe(
      "Current",
    );
  });
  it("requires explicit task removal before project deletion", async () => {
    const row = await createProject(),
      task = await createTask(row.id);
    expect(
      (await call("delete", "/api/projects/" + row.id).send({ version: 1 }))
        .status,
    ).toBe(409);
    expect(
      (
        await call("delete", `/api/projects/${row.id}/tasks/${task.id}`).send({
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (await call("delete", "/api/projects/" + row.id).send({ version: 1 }))
        .status,
    ).toBe(200);
  });
  it("does not allow tasks to cross tenants or route parents", async () => {
    const row = await createProject(),
      other = await createProject("Other"),
      task = await createTask(row.id);
    expect(
      (await call("get", `/api/projects/${other.id}/tasks/${task.id}`)).status,
    ).toBe(404);
    expect(
      (
        await call(
          "post",
          `/api/projects/${row.id}/tasks`,
          b,
          "demo_outsider",
        ).send({ title: "Cross", status: "TODO" })
      ).status,
    ).toBe(404);
    expect(
      (await call("get", `/api/projects/${row.id}/tasks/${task.id}`, b)).status,
    ).toBe(404);
    expect(
      (
        await call("put", `/api/projects/${other.id}/tasks/${task.id}`).send({
          version: 1,
          task: { title: "Wrong", status: "DONE" },
        })
      ).status,
    ).toBe(404);
  });
  it("enforces tenant parent matching in the database itself", async () => {
    const row = await createProject();
    await expect(
      prisma.task.create({
        data: { organizationId: b, projectId: row.id, title: "Invalid FK" },
      }),
    ).rejects.toThrow();
  });
  it("handles task concurrency and stale deletion", async () => {
    const row = await createProject(),
      task = await createTask(row.id),
      path = `/api/projects/${row.id}/tasks/${task.id}`;
    const responses = await Promise.all(
      ["One", "Two"].map((title) =>
        call("put", path).send({ version: 1, task: { title, status: "DONE" } }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await call("delete", path).send({ version: 1 })).status).toBe(409);
    expect((await call("get", path)).body.version).toBe(2);
  });
  it("rolls back project create update and delete when audit fails", async () => {
    const row = await createProject(),
      before = await prisma.project.count();
    await failingAudit(async () => {
      for (const response of [
        await call("post", "/api/projects").send({ name: "Rejected" }),
        await call("put", "/api/projects/" + row.id).send({
          version: 1,
          project: { name: "Rejected" },
        }),
        await call("delete", "/api/projects/" + row.id).send({ version: 1 }),
      ]) {
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(JSON.stringify(response.body)).not.toContain(
          "synthetic internal detail",
        );
        expect(response.body.requestId).toBe(response.headers["x-request-id"]);
      }
    });
    expect(await prisma.project.count()).toBe(before);
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: row.id } }))
        .version,
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({ where: { resourceId: row.id } }),
    ).toBe(1);
  });
  it("rolls back task mutations when their audit fails", async () => {
    const row = await createProject(),
      task = await createTask(row.id),
      path = `/api/projects/${row.id}/tasks/${task.id}`;
    await failingAudit(async () => {
      expect(
        (
          await call("put", path).send({
            version: 1,
            task: { title: "Rejected", status: "DONE" },
          })
        ).status,
      ).toBeGreaterThanOrEqual(500);
      expect(
        (await call("delete", path).send({ version: 1 })).status,
      ).toBeGreaterThanOrEqual(500);
      expect(
        (
          await call("post", `/api/projects/${row.id}/tasks`).send({
            title: "Rejected",
            status: "TODO",
          })
        ).status,
      ).toBeGreaterThanOrEqual(500);
    });
    expect(await prisma.task.count({ where: { projectId: row.id } })).toBe(1);
    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).version,
    ).toBe(1);
  });
  it("uses literal wildcard search and stable bounded pages", async () => {
    await createProject("100%_ matched");
    expect(
      (await call("get", "/api/projects?q=100%25_")).body.items,
    ).toHaveLength(1);
    for (let i = 0; i < 21; i++)
      await prisma.project.create({
        data: { name: "Page " + i, organizationId: a },
      });
    const first = await call("get", "/api/projects?q=Page&page=1"),
      second = await call("get", "/api/projects?q=Page&page=2");
    expect(first.body.items).toHaveLength(20);
    expect(second.body.items).toHaveLength(1);
    expect(
      new Set([...first.body.items, ...second.body.items].map((p: any) => p.id))
        .size,
    ).toBe(21);
  });
  it("filters and pages tasks within their parent", async () => {
    const row = await createProject();
    for (let i = 0; i < 21; i++)
      await prisma.task.create({
        data: {
          organizationId: a,
          projectId: row.id,
          title: "Task " + i,
          status: "DONE",
        },
      });
    expect(
      (await call("get", `/api/projects/${row.id}/tasks?status=DONE&page=2`))
        .body.items,
    ).toHaveLength(1);
    expect(
      (await call("get", `/api/projects/${row.id}/tasks?status=TODO`)).body
        .total,
    ).toBe(0);
  });
  it("rejects unknown fields malformed bodies and oversized requests before insertion", async () => {
    const count = await prisma.project.count();
    expect(
      (
        await call("post", "/api/projects").send({
          ...projectValue,
          organizationId: b,
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("post", "/api/projects?extra=1").send(projectValue)).status,
    ).toBe(400);
    expect(
      (
        await call("post", "/api/projects")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect(
      (
        await call("post", "/api/projects").send({
          name: "A",
          description: "x".repeat(40000),
        })
      ).status,
    ).toBe(413);
    expect(await prisma.project.count()).toBe(count);
  });
  it("rejects repeated query fields and unapproved browser origins", async () => {
    expect((await call("get", "/api/projects?q=a&q=b")).status).toBe(400);
    expect(
      (
        await call("get", "/api/projects").set(
          "Origin",
          "http://unrelated.test",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call("get", "/api/projects").set(
          "Origin",
          "http://127.0.0.1:5175",
        )
      ).status,
    ).toBe(200);
  });
  it("does not overwrite existing demo passwords or edited project data", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: "demo_owner" },
    });
    await prisma.project.updateMany({
      where: { organizationId: a },
      data: { name: "Edited demo" },
    });
    expect((await seedDemo("different-synthetic-password")).created).toBe(0);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: "demo_owner" } }))
        .passwordHash,
    ).toBe(before.passwordHash);
    expect(
      (await prisma.project.findFirstOrThrow({ where: { organizationId: a } }))
        .name,
    ).toBe("Edited demo");
  });
});

const registration = {
  email: "new@example.test",
  name: "New Learner",
  teamName: "New Team",
  password: "synthetic-registration-password",
};
async function commentFixture(author = "demo_member") {
  const project = await createProject(),
    task = await createTask(project.id),
    path = `/api/projects/${project.id}/tasks/${task.id}`;
  const result = await call("post", path + "/comments", a, author).send({
    content: "Explain the acceptance criteria.",
  });
  expect(result.status).toBe(201);
  return { project, task, path, comment: result.body };
}
describe("team registration and task assignment", () => {
  it("registers a normalized account with exactly one privately owned team", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...registration, email: " NEW@EXAMPLE.TEST " });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("new@example.test");
    expect(response.body.user.memberships).toHaveLength(1);
    const membership = response.body.user.memberships[0];
    expect(membership.role).toBe("OWNER");
    expect(membership.organization.name).toBe("New Team");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(
      (
        await request(app)
          .get("/api/projects")
          .set("Authorization", "Bearer " + response.body.token)
          .set("x-org-id", a)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/projects")
          .set("Authorization", "Bearer " + response.body.token)
          .set("x-org-id", membership.organization.id)
      ).body.total,
    ).toBe(0);
  });
  it("allows only one simultaneous registration per canonical email", async () => {
    const result = await Promise.all(
      [1, 2].map(() =>
        request(app).post("/api/auth/register").send(registration),
      ),
    );
    expect(result.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.organization.count()).toBe(3);
    expect(
      await prisma.user.count({ where: { email: registration.email } }),
    ).toBe(1);
  });
  it("rolls back user team and membership together when registration audit fails", async () => {
    await failingAudit(async () => {
      expect(
        (await request(app).post("/api/auth/register").send(registration))
          .status,
      ).toBe(500);
    });
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.organization.count()).toBe(2);
    expect(await prisma.organizationMember.count()).toBe(4);
  });
  it("rejects registration privilege injection and bcrypt-overlong passwords", async () => {
    for (const extra of [
      { role: "OWNER" },
      { organizationId: a },
      { password: "x".repeat(73) },
      { password: "short" },
      { name: " " },
    ])
      expect(
        (
          await request(app)
            .post("/api/auth/register")
            .send({ ...registration, ...extra })
        ).status,
      ).toBe(400);
    expect(await prisma.user.count()).toBe(3);
  });
  it("rejects query and media-type ambiguity on authentication writes", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/register?role=OWNER")
          .send(registration)
      ).status,
    ).toBe(400);
    expect(
      (await request(app).post("/api/auth/login").type("text").send("hello"))
        .status,
    ).toBe(415);
  });
  it("creates edits and clears task description due date and same-team assignment", async () => {
    const p = await createProject(),
      path = `/api/projects/${p.id}/tasks`,
      value = {
        title: "Write API contract",
        status: "TODO",
        description: "Document invalid input.",
        dueDate: "2031-02-28",
        assigneeId: "demo_member",
      };
    const made = await call("post", path, a, "demo_member").send(value);
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject(value);
    const updated = await call("put", path + "/" + made.body.id).send({
      version: 1,
      task: { ...value, description: "", dueDate: null, assigneeId: null },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      version: 2,
      description: "",
      dueDate: null,
      assigneeId: null,
    });
    expect((await call("get", path)).body.items[0].dueDate).toBeNull();
  });
  it("rejects another team's assignee and invalid calendar dates", async () => {
    const p = await createProject(),
      path = `/api/projects/${p.id}/tasks`,
      value = { title: "A", status: "TODO" };
    for (const extra of [
      { assigneeId: "demo_outsider" },
      { dueDate: "2031-02-29" },
      { dueDate: "2030-01-01T00:00:00Z" },
      { dueDate: "1969-12-31" },
    ])
      expect(
        (await call("post", path).send({ ...value, ...extra })).status,
      ).toBe(400);
    expect(await prisma.task.count({ where: { projectId: p.id } })).toBe(0);
  });
  it("enforces same-team assignment even when a writer bypasses the repository", async () => {
    const p = await createProject();
    await expect(
      prisma.task.create({
        data: {
          title: "Bypass",
          organizationId: a,
          projectId: p.id,
          assigneeId: "demo_outsider",
        },
      }),
    ).rejects.toThrow();
  });
  it("retains referenced memberships until assignments are explicitly cleared", async () => {
    const p = await createProject();
    const task = await call("post", `/api/projects/${p.id}/tasks`).send({
      title: "Assigned",
      status: "TODO",
      assigneeId: "demo_member",
    });
    expect(task.status).toBe(201);
    await expect(
      prisma.organizationMember.deleteMany({
        where: { userId: "demo_member", organizationId: a },
      }),
    ).rejects.toThrow();
  });
  it("lists and resolves only selected-team member references", async () => {
    const response = await call("get", "/api/members");
    expect(response.status).toBe(200);
    expect(response.body.items.map((m: any) => m.id).sort()).toEqual([
      "demo_member",
      "demo_owner",
    ]);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect((await call("get", "/api/members/demo_outsider")).status).toBe(404);
    expect((await call("get", "/api/members?q=%25")).body.total).toBe(0);
    expect((await call("get", "/api/members", b, "demo_member")).status).toBe(
      403,
    );
  });
  it("retains accepted task details when a stale assignment edit loses", async () => {
    const p = await createProject(),
      t = await createTask(p.id),
      path = `/api/projects/${p.id}/tasks/${t.id}`;
    const results = await Promise.all(
      ["demo_owner", "demo_member"].map((assigneeId) =>
        call("put", path).send({
          version: 1,
          task: {
            title: "Race",
            status: "IN_PROGRESS",
            assigneeId,
            dueDate: "2031-06-10",
            description: assigneeId,
          },
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!;
    expect((await call("get", path)).body).toMatchObject({
      assigneeId: winner.body.assigneeId,
      description: winner.body.description,
      version: 2,
    });
  });
});
describe("owned task discussion contract", () => {
  it("creates reads edits and deletes an owned comment with retained audit", async () => {
    const f = await commentFixture(),
      path = f.path + "/comments/" + f.comment.id;
    expect(f.comment.authorId).toBe("demo_member");
    expect((await call("get", path)).body.author.name).toBe("Sam Member");
    const update = await call("put", path, a, "demo_member").send({
      version: 1,
      comment: { content: "Updated criteria." },
    });
    expect(update.status).toBe(200);
    expect(update.body.version).toBe(2);
    expect(
      (await call("delete", path, a, "demo_member").send({ version: 2 }))
        .status,
    ).toBe(200);
    expect((await call("get", path)).status).toBe(404);
    const audit = await prisma.auditEvent.findMany({
      where: { resourceType: "COMMENT", resourceId: f.comment.id },
    });
    expect(audit).toHaveLength(3);
    expect(audit.every((row) => row.actorId === "demo_member")).toBe(true);
  });
  it("prevents author and team identity injection in comment bodies", async () => {
    const f = await commentFixture();
    for (const extra of [
      { authorId: "demo_owner" },
      { organizationId: b },
      { version: 10 },
      { content: " " },
      { content: "x".repeat(2001) },
    ])
      expect(
        (
          await call("post", f.path + "/comments").send({
            content: "Valid",
            ...extra,
          })
        ).status,
      ).toBe(400);
  });
  it("denies comment edits by another member or an administrator", async () => {
    const f = await commentFixture();
    expect(
      (
        await call("put", f.path + "/comments/" + f.comment.id).send({
          version: 1,
          comment: { content: "Rewrite another author" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("get", f.path + "/comments/" + f.comment.id)).body.content,
    ).toBe(f.comment.content);
  });
  it("permits explicit administrative deletion but never rewrites authorship", async () => {
    const f = await commentFixture();
    expect(
      (
        await call("delete", f.path + "/comments/" + f.comment.id).send({
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.auditEvent.findFirst({
        where: { resourceId: f.comment.id, action: "MODERATE_DELETE" },
      }),
    ).toMatchObject({ actorId: "demo_owner", version: 2 });
  });
  it("denies a regular member deletion of another author's comment", async () => {
    const f = await commentFixture("demo_owner");
    expect(
      (
        await call(
          "delete",
          f.path + "/comments/" + f.comment.id,
          a,
          "demo_member",
        ).send({ version: 1 })
      ).status,
    ).toBe(403);
  });
  it("does not reveal comments through another tenant or parent task", async () => {
    const f = await commentFixture(),
      other = await createTask(f.project.id);
    expect((await call("get", f.path + "/comments", b)).status).toBe(404);
    expect(
      (
        await call(
          "get",
          `/api/projects/${f.project.id}/tasks/${other.id}/comments/${f.comment.id}`,
        )
      ).status,
    ).toBe(404);
  });
  it("accepts one of two concurrent comment edits", async () => {
    const f = await commentFixture(),
      path = f.path + "/comments/" + f.comment.id;
    const responses = await Promise.all(
      ["A", "B"].map((content) =>
        call("put", path, a, "demo_member").send({
          version: 1,
          comment: { content },
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await call("get", path)).body.version).toBe(2);
    expect(
      await prisma.auditEvent.count({ where: { resourceId: f.comment.id } }),
    ).toBe(2);
  });
  it("preserves a newer comment when deletion has a stale version", async () => {
    const f = await commentFixture(),
      path = f.path + "/comments/" + f.comment.id;
    expect(
      (
        await call("put", path, a, "demo_member").send({
          version: 1,
          comment: { content: "Newer" },
        })
      ).status,
    ).toBe(200);
    expect((await call("delete", path).send({ version: 1 })).status).toBe(409);
    expect((await call("get", path)).body.content).toBe("Newer");
  });
  it("requires explicit comment removal before deleting its task", async () => {
    const f = await commentFixture();
    expect((await call("delete", f.path).send({ version: 1 })).status).toBe(
      409,
    );
    expect(
      (
        await call("delete", f.path + "/comments/" + f.comment.id).send({
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect((await call("delete", f.path).send({ version: 1 })).status).toBe(
      200,
    );
  });
  it("rolls back comment create edit and delete when audit fails", async () => {
    const f = await commentFixture(),
      path = f.path + "/comments/" + f.comment.id;
    await failingAudit(async () => {
      expect(
        (
          await call("post", f.path + "/comments").send({
            content: "Uncommitted",
          })
        ).status,
      ).toBe(500);
      expect(
        (
          await call("put", path, a, "demo_member").send({
            version: 1,
            comment: { content: "Uncommitted" },
          })
        ).status,
      ).toBe(500);
      expect((await call("delete", path).send({ version: 1 })).status).toBe(
        500,
      );
    });
    expect(await prisma.comment.count({ where: { taskId: f.task.id } })).toBe(
      1,
    );
    expect((await call("get", path)).body).toMatchObject({
      version: 1,
      content: f.comment.content,
    });
    expect(
      await prisma.auditEvent.count({ where: { resourceId: f.comment.id } }),
    ).toBe(1);
  });
  it("paginates comments with a stable order and literal search", async () => {
    const f = await commentFixture();
    await prisma.comment.createMany({
      data: Array.from({ length: 23 }, (_, n) => ({
        organizationId: a,
        taskId: f.task.id,
        authorId: "demo_owner",
        content: n === 0 ? "Literal % underscore _" : "Note " + n,
      })),
    });
    expect((await call("get", f.path + "/comments")).body.items).toHaveLength(
      20,
    );
    expect(
      (await call("get", f.path + "/comments?page=2")).body.items,
    ).toHaveLength(4);
    expect((await call("get", f.path + "/comments?q=%25")).body.total).toBe(1);
  });
});
