import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";

dotenv.config();
export async function seedDemo(password: string) {
  if (password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error(
      "DEMO_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.",
    );
  const organizations = ["demo_cedar", "demo_maple"];
  const users = ["demo_owner", "demo_member", "demo_outsider"];
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.$transaction(async (tx) => {
    const existingOrgs = await tx.organization.count({
      where: { id: { in: organizations } },
    });
    const existingUsers = await tx.user.count({ where: { id: { in: users } } });
    if (existingOrgs === 2 && existingUsers === 3)
      return {
        created: 0,
        note: "Existing demo identities preserved, including passwords and edits.",
      };
    if (existingOrgs || existingUsers)
      throw new Error(
        "Partial demo identities exist. Inspect them before seeding; no rows were changed.",
      );
    await tx.organization.createMany({
      data: [
        { id: organizations[0], name: "Cedar Studio" },
        { id: organizations[1], name: "Maple Works" },
      ],
    });
    await tx.user.createMany({
      data: [
        {
          id: users[0],
          name: "Alex Owner",
          email: "owner@example.test",
          passwordHash,
        },
        {
          id: users[1],
          name: "Sam Member",
          email: "member@example.test",
          passwordHash,
        },
        {
          id: users[2],
          name: "Morgan Owner",
          email: "outsider@example.test",
          passwordHash,
        },
      ],
    });
    await tx.organizationMember.createMany({
      data: [
        { userId: users[0], organizationId: organizations[0], role: "OWNER" },
        { userId: users[0], organizationId: organizations[1], role: "MEMBER" },
        { userId: users[1], organizationId: organizations[0], role: "MEMBER" },
        { userId: users[2], organizationId: organizations[1], role: "OWNER" },
      ],
    });
    const a = await tx.project.create({
      data: {
        organizationId: organizations[0],
        name: "Customer portal",
        description:
          "Build a clear place for customers to review requests and follow progress.",
      },
    });
    const b = await tx.project.create({
      data: {
        organizationId: organizations[1],
        name: "Inventory refresh",
        description: "Review stock workflows and reduce manual updates.",
      },
    });
    await tx.task.createMany({
      data: [
        {
          organizationId: organizations[0],
          projectId: a.id,
          title: "Map the request lifecycle",
          description:
            "Describe the request states and agree on acceptance criteria.",
          assigneeId: users[1],
          dueDate: new Date("2030-06-15T00:00:00.000Z"),
          status: "IN_PROGRESS",
        },
        {
          organizationId: organizations[0],
          projectId: a.id,
          title: "Write conflict-handling examples",
          status: "TODO",
        },
        {
          organizationId: organizations[1],
          projectId: b.id,
          title: "Review stock adjustment rules",
          status: "TODO",
        },
      ],
    });
    await tx.auditEvent.createMany({
      data: [a, b].map((p) => ({
        organizationId: p.organizationId,
        actorId: p.organizationId === organizations[0] ? users[0] : users[2],
        resourceType: "PROJECT",
        resourceId: p.id,
        action: "SEED",
        version: 1,
      })),
    });
    return {
      created: 2,
      note: "Created two fictional organizations, three users and their starter work.",
    };
  });
}
if (require.main === module) {
  if (process.env.ALLOW_DEMO_SEED !== "yes")
    throw new Error(
      "Set ALLOW_DEMO_SEED=yes explicitly for fictional local demo data.",
    );
  seedDemo(process.env.DEMO_PASSWORD || "")
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
