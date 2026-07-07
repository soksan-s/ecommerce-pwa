import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Not authenticated.", 401);

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return fail("New password must be at least 6 characters long.", 400);
    }

    // If not first-boot (passwordChangedAt exists), require currentPassword
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, passwordChangedAt: true },
    });

    if (!dbUser) return fail("User not found.", 404);

    // First-boot: no current password needed if passwordChangedAt is null
    const isFirstBoot = dbUser.passwordChangedAt === null;

    if (!isFirstBoot) {
      if (!currentPassword) {
        return fail("Current password is required.", 400);
      }
      const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return fail("Current password is incorrect.", 401);
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });

    return ok({ message: "Password changed successfully." });
  } catch (error) {
    return handleRouteError(error, "Unable to change password.");
  }
}
