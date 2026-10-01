import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

const issuer = "team-workspace",
  audience = "team-workspace-web";
export function validateSecret(secret: string) {
  if (
    Buffer.byteLength(secret) < 32 ||
    /^(change|replace|example|your[-_ ])/i.test(secret)
  )
    throw new Error(
      "JWT_SECRET must be a generated secret of at least 32 bytes.",
    );
}
export function issueToken(userId: string, secret: string) {
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: "30m",
    issuer,
    audience,
  });
}
export function authenticate(secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ") || header.length > 2048)
        throw new Error();
      const payload = jwt.verify(header.slice(7), secret, {
        algorithms: ["HS256"],
        issuer,
        audience,
      }) as JwtPayload;
      if (
        typeof payload.sub !== "string" ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(payload.sub)
      )
        throw new Error();
      req.userId = payload.sub;
      next();
    } catch {
      next(
        new AppError(
          401,
          "Sign in again to continue. Your editor can be exported first.",
        ),
      );
    }
  };
}
export async function currentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true } },
        },
        orderBy: { organizationId: "asc" },
      },
    },
  });
  if (!user) throw new AppError(401, "Sign in again to continue.");
  return user;
}
