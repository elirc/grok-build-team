import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { loginInput, registrationInput } from "../lib/validation";
import { AppError } from "../lib/errors";
const dummyHash = bcrypt.hashSync("synthetic-unused-account-password", 10);
export async function loginUser(value: unknown) {
  const data = loginInput.parse(value);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const matches = await bcrypt.compare(
    data.password,
    user?.passwordHash || dummyHash,
  );
  if (!user || !matches)
    throw new AppError(401, "Email or password was not accepted.");
  return user.id;
}
export async function registerUser(value: unknown) {
  const data = registrationInput.parse(value),
    passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, name: data.name, passwordHash },
    });
    const organization = await tx.organization.create({
      data: { name: data.teamName },
    });
    await tx.organizationMember.create({
      data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: organization.id,
        actorId: user.id,
        resourceType: "TEAM",
        resourceId: organization.id,
        action: "CREATE",
        version: 1,
      },
    });
    return user.id;
  });
}
