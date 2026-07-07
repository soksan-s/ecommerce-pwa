import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { phoneNumber, code, purpose } = await request.json();

    if (!phoneNumber || !code || !purpose) {
      return fail("Missing required fields.", 400);
    }

    // Find the most recent unused OTP for this phone and purpose
    const otpRecord = await prisma.otp.findFirst({
      where: {
        phone: phoneNumber,
        purpose,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      return fail("No active OTP found. Please request a new one.", 400);
    }

    if (otpRecord.expiresAt < new Date()) {
      return fail("OTP has expired.", 400);
    }

    if (otpRecord.attempts >= 5) {
      return fail("Too many invalid attempts. Please request a new OTP.", 429);
    }

    // Verify code
    const isValid = await bcrypt.compare(code, otpRecord.codeHash);

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

    return ok({ message: "Code verified successfully." });
  } catch (error) {
    return handleRouteError(error, "Unable to verify OTP.");
  }
}
