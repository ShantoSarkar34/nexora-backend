import "dotenv/config";
import prisma from "../src/config/prismaClient";
import { hashPassword } from "../src/utils/hashPassword";

const run = async () => {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Nexora Admin";

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (in .env or the command line) before running this script.");
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  }

  const hashedPassword = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== "ADMIN") {
    // Never silently promote a real user's account.
    throw new Error(`${email} already belongs to a ${existing.role} account. Use a different ADMIN_EMAIL.`);
  }

  if (existing) {
    // Re-running resets the password and signs out the admin's old sessions.
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashedPassword, passwordChangedAt: new Date(), isSuspended: false, isVerified: true },
    });
    console.log(`Admin ${email} already existed: password reset.`);
    return;
  }

  await prisma.user.create({
    data: { name, email, password: hashedPassword, role: "ADMIN", provider: "LOCAL", isVerified: true },
  });
  console.log(`Admin ${email} created. Log in with POST /api/v1/auth/login using exactly this email.`);
};

run()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());