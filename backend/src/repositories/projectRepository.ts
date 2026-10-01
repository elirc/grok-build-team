import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { identity } from "../lib/validation";
import { AppError } from "../lib/errors";
import {
  ProjectInput,
  TaskInput,
  ListInput,
  TaskListInput,
} from "../lib/validation";
import { TenantContext } from "../middleware/tenantContext";

type Tx = Prisma.TransactionClient;
const taskDto = <T extends { dueDate: Date | null }>(row: T) => ({
  ...row,
  dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
});
const taskData = (data: TaskInput) => ({
  ...data,
  dueDate: data.dueDate ? new Date(data.dueDate + "T00:00:00.000Z") : null,
});
async function verifyAssignee(tx: Tx, org: string, userId: string | null) {
  if (!userId) return;
  const member = await tx.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: identity.parse(org) },
    },
  });
  if (!member)
    throw new AppError(400, "Choose an assignee who belongs to this team.");
}

const pageSize = 20;
const ordered = [{ createdAt: "desc" as const }, { id: "asc" as const }];
// Prisma sends contains to LIKE: escape wildcard characters for literal search.
const literal = (query: string) =>
  query.replace(/[\\%_]/g, (value) => "\\" + value);
function audit(
  tx: Tx,
  context: TenantContext,
  resourceType: string,
  resourceId: string,
  action: string,
  version: number,
) {
  return tx.auditEvent.create({
    data: {
      organizationId: identity.parse(context.organizationId),
      actorId: context.userId,
      resourceType,
      resourceId,
      action,
      version,
    },
  });
}
async function projectIn(tx: Tx, org: string, id: string) {
  const row = await tx.project.findFirst({
    where: { id, organizationId: identity.parse(org) },
  });
  if (!row) throw new AppError(404, "Project not found in this organization.");
  return row;
}
async function taskIn(tx: Tx, org: string, projectId: string, id: string) {
  const row = await tx.task.findFirst({
    where: { id, projectId, organizationId: identity.parse(org) },
  });
  if (!row) throw new AppError(404, "Task not found in this project.");
  return taskDto(row);
}
const conflict = () =>
  new AppError(
    409,
    "This record changed. Export your draft, then load the current record before retrying.",
  );

export async function findByOrganizationId(org: string, query: ListInput) {
  const where: Prisma.ProjectWhereInput = {
    organizationId: identity.parse(org),
    ...(query.q
      ? {
          OR: [
            { name: { contains: literal(query.q), mode: "insensitive" } },
            {
              description: { contains: literal(query.q), mode: "insensitive" },
            },
          ],
        }
      : {}),
  };
  return prisma.$transaction(
    async (tx) => ({
      items: await tx.project.findMany({
        where,
        orderBy: ordered,
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { tasks: true } } },
      }),
      total: await tx.project.count({ where }),
      page: query.page,
      pageSize,
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export const getProject = (org: string, id: string) =>
  projectIn(prisma, org, id);
export async function create(context: TenantContext, data: ProjectInput) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.project.create({
      data: { ...data, organizationId: identity.parse(context.organizationId) },
    });
    await audit(tx, context, "PROJECT", row.id, "CREATE", row.version);
    return row;
  });
}
export async function update(
  context: TenantContext,
  id: string,
  expected: number,
  data: ProjectInput,
) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.project.updateMany({
      where: {
        id,
        organizationId: identity.parse(context.organizationId),
        version: expected,
      },
      data: { ...data, version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      await projectIn(tx, context.organizationId, id);
      throw conflict();
    }
    await audit(tx, context, "PROJECT", id, "UPDATE", expected + 1);
    return projectIn(tx, context.organizationId, id);
  });
}
export async function remove(
  context: TenantContext,
  id: string,
  expected: number,
) {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.project.deleteMany({
      where: {
        id,
        organizationId: identity.parse(context.organizationId),
        version: expected,
        tasks: { none: {} },
      },
    });
    if (removed.count !== 1) {
      const row = await projectIn(tx, context.organizationId, id);
      if (row.version !== expected) throw conflict();
      throw new AppError(
        409,
        "Delete the project tasks explicitly before deleting this project.",
      );
    }
    await audit(tx, context, "PROJECT", id, "DELETE", expected + 1);
    return { id };
  });
}
export async function listTasks(
  org: string,
  projectId: string,
  query: TaskListInput,
) {
  return prisma.$transaction(
    async (tx) => {
      await projectIn(tx, org, projectId);
      const where: Prisma.TaskWhereInput = {
        organizationId: identity.parse(org),
        projectId,
        ...(query.q
          ? {
              title: {
                contains: literal(query.q),
                mode: "insensitive" as const,
              },
            }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      };
      return {
        items: (
          await tx.task.findMany({
            where,
            orderBy: ordered,
            skip: (query.page - 1) * pageSize,
            take: pageSize,
          })
        ).map(taskDto),
        total: await tx.task.count({ where }),
        page: query.page,
        pageSize,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export const getTask = (org: string, projectId: string, id: string) =>
  taskIn(prisma, org, projectId, id);
export async function createTask(
  context: TenantContext,
  projectId: string,
  data: TaskInput,
) {
  return prisma.$transaction(async (tx) => {
    await projectIn(tx, context.organizationId, projectId);
    await verifyAssignee(tx, context.organizationId, data.assigneeId);
    const row = await tx.task.create({
      data: {
        ...taskData(data),
        projectId,
        organizationId: identity.parse(context.organizationId),
      },
    });
    await audit(tx, context, "TASK", row.id, "CREATE", row.version);
    return taskDto(row);
  });
}
export async function updateTask(
  context: TenantContext,
  projectId: string,
  id: string,
  expected: number,
  data: TaskInput,
) {
  return prisma.$transaction(async (tx) => {
    await taskIn(tx, context.organizationId, projectId, id);
    await verifyAssignee(tx, context.organizationId, data.assigneeId);
    const changed = await tx.task.updateMany({
      where: {
        id,
        projectId,
        organizationId: identity.parse(context.organizationId),
        version: expected,
      },
      data: { ...taskData(data), version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      await taskIn(tx, context.organizationId, projectId, id);
      throw conflict();
    }
    await audit(tx, context, "TASK", id, "UPDATE", expected + 1);
    return taskIn(tx, context.organizationId, projectId, id);
  });
}
export async function removeTask(
  context: TenantContext,
  projectId: string,
  id: string,
  expected: number,
) {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.task.deleteMany({
      where: {
        id,
        projectId,
        organizationId: identity.parse(context.organizationId),
        version: expected,
        comments: { none: {} },
      },
    });
    if (removed.count !== 1) {
      const current = await taskIn(tx, context.organizationId, projectId, id);
      if (current.version !== expected) throw conflict();
      throw new AppError(
        409,
        "Delete task comments explicitly before deleting this task.",
      );
    }
    await audit(tx, context, "TASK", id, "DELETE", expected + 1);
    return { id };
  });
}
export function history(org: string, kind: "PROJECT" | "TASK", id: string) {
  return prisma.auditEvent.findMany({
    where: {
      organizationId: identity.parse(org),
      resourceType: kind,
      resourceId: id,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
  });
}

export async function members(org: string, query: ListInput) {
  const where: Prisma.OrganizationMemberWhereInput = {
    organizationId: identity.parse(org),
    ...(query.q
      ? {
          user: {
            OR: [
              { name: { contains: literal(query.q), mode: "insensitive" } },
              { email: { contains: literal(query.q), mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  return prisma.$transaction(
    async (tx) => ({
      items: (
        await tx.organizationMember.findMany({
          where,
          select: {
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { userId: "asc" },
          skip: (query.page - 1) * 20,
          take: 20,
        })
      ).map((row) => ({ ...row.user, role: row.role })),
      total: await tx.organizationMember.count({ where }),
      page: query.page,
      pageSize: 20,
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function member(org: string, userId: string) {
  const found = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: identity.parse(userId),
        organizationId: identity.parse(org),
      },
    },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!found) throw new AppError(404, "Team member not found.");
  return { ...found.user, role: found.role };
}
