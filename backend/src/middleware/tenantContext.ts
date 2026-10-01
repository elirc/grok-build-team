import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { identity } from "../lib/validation";

export type TenantContext = {
  userId: string;
  organizationId: string;
  role: Role;
};
export async function attachTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
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
    next();
  } catch (error) {
    next(error);
  }
}
export function requireTenant(req: Request): TenantContext {
  if (!req.tenant)
    throw new AppError(401, "Verified organization membership is required.");
  return req.tenant;
}
export function requireManager(context: TenantContext) {
  if (!["OWNER", "ADMIN"].includes(context.role))
    throw new AppError(
      403,
      "An owner or administrator must change projects. Members can manage tasks.",
    );
}
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      tenant?: TenantContext;
      requestId: string;
    }
  }
}
