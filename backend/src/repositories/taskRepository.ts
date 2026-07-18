// =============================================================================
// TASK REPOSITORY
// =============================================================================
// The repository layer is responsible for all data access.
//
// Why have a separate repository layer?
// 1. It keeps data access logic in one place
// 2. It makes it much easier to switch databases or ORMs later
// 3. It makes unit testing services easier (you can mock the repository)
//
// Note: With Prisma, some people skip this layer. We include it here for learning purposes.
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function findByProjectId(projectId: string) {
  return prisma.task.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(data: any) {
  return prisma.task.create({ data });
}

// More methods will be added as the project grows (findById, update, delete, etc.)
