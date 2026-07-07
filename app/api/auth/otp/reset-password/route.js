import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { phoneNumber, otp, newPassword } = await request.json();

    if (!phoneNumber || !otp || !newPassword) {
      return fail("Missing required fields.", 400);
    }

    if (newPassword.length < 4) {
      return fail("Password must be at least 4 characters long.", 400);
    }

    // Verify the OTP logic
    const otpRecord = await prisma.otp.findFirst({
      where: {
        phone: phoneNumber,
        purpose: "RESET_PASSWORD",
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      return fail("No active reset request found.", 400);
    }

    if (otpRecord.expiresAt < new Date()) {
      return fail("Reset code has expired.", 400);
    }

    if (otpRecord.attempts >= 5) {
      return fail("Too many invalid attempts. Please request a new code.", 429);
    }

    // Verify code
    const isValid = await bcrypt.compare(otp, otpRecord.codeHash);

    if (!isValid) {
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return fail("Invalid verification code.", 400);
    }

    // Mark as used
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    // Update User password
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!existingUser) {
      return fail("Account not found.", 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });

    return ok({ message: "Password updated successfully." });
  } catch (error) {
    return handleRouteError(error, "Unable to reset password.");
  }
}
