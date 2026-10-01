import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { identity, CommentInput, ListInput } from "../lib/validation";
import { TenantContext } from "../middleware/tenantContext";
type Tx = Prisma.TransactionClient;
const include = { author: { select: { id: true, name: true } } };
function scoped(context: TenantContext, projectId: string, taskId: string) {
  identity.parse(context.userId);
  return {
    organizationId: identity.parse(context.organizationId),
    taskId: identity.parse(taskId),
    task: { projectId: identity.parse(projectId) },
  };
}
async function parent(
  tx: Tx,
  context: TenantContext,
  projectId: string,
  taskId: string,
) {
  scoped(context, projectId, taskId);
  const row = await tx.task.findFirst({
    where: { id: taskId, projectId, organizationId: context.organizationId },
  });
  if (!row) throw new AppError(404, "Task not found in this project.");
}
async function rowIn(
  tx: Tx,
  context: TenantContext,
  projectId: string,
  taskId: string,
  id: string,
) {
  const row = await tx.comment.findFirst({
    where: { ...scoped(context, projectId, taskId), id: identity.parse(id) },
    include,
  });
  if (!row) throw new AppError(404, "Comment not found in this task.");
  return row;
}
const conflict = () =>
  new AppError(
    409,
    "This comment changed. Export your draft, then load the current comment before retrying.",
  );
function audit(
  tx: Tx,
  context: TenantContext,
  id: string,
  action: string,
  version: number,
) {
  return tx.auditEvent.create({
    data: {
      organizationId: context.organizationId,
      actorId: context.userId,
      resourceType: "COMMENT",
      resourceId: id,
      action,
      version,
    },
  });
}
export async function list(
  context: TenantContext,
  projectId: string,
  taskId: string,
  query: ListInput,
) {
  return prisma.$transaction(
    async (tx) => {
      await parent(tx, context, projectId, taskId);
      const where: Prisma.CommentWhereInput = {
        ...scoped(context, projectId, taskId),
        ...(query.q
          ? {
              content: {
                contains: query.q.replace(/[\\%_]/g, (value) => "\\" + value),
                mode: "insensitive",
              },
            }
          : {}),
      };
      return {
        items: await tx.comment.findMany({
          where,
          include,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (query.page - 1) * 20,
          take: 20,
        }),
        total: await tx.comment.count({ where }),
        page: query.page,
        pageSize: 20,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export const get = (
  context: TenantContext,
  projectId: string,
  taskId: string,
  id: string,
) => rowIn(prisma, context, projectId, taskId, id);
export async function create(
  context: TenantContext,
  projectId: string,
  taskId: string,
  data: CommentInput,
) {
  return prisma.$transaction(async (tx) => {
    await parent(tx, context, projectId, taskId);
    const row = await tx.comment.create({
      data: {
        ...data,
        taskId,
        organizationId: context.organizationId,
        authorId: context.userId,
      },
      include,
    });
    await audit(tx, context, row.id, "CREATE", row.version);
    return row;
  });
}
export async function update(
  context: TenantContext,
  projectId: string,
  taskId: string,
  id: string,
  expected: number,
  data: CommentInput,
) {
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
    return rowIn(tx, context, projectId, taskId, id);
  });
}
export async function remove(
  context: TenantContext,
  projectId: string,
  taskId: string,
  id: string,
  expected: number,
) {
  return prisma.$transaction(async (tx) => {
    const current = await rowIn(tx, context, projectId, taskId, id);
    if (
      current.authorId !== context.userId &&
      !["OWNER", "ADMIN"].includes(context.role)
    )
      throw new AppError(
        403,
        "Only the author or a team administrator can delete a comment.",
      );
    const removed = await tx.comment.deleteMany({
      where: { ...scoped(context, projectId, taskId), id, version: expected },
    });
    if (removed.count !== 1) throw conflict();
    await audit(
      tx,
      context,
      id,
      current.authorId === context.userId ? "DELETE" : "MODERATE_DELETE",
      expected + 1,
    );
    return { id };
  });
}
