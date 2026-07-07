import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { sendOTP, generateOTPCode } from "@/lib/otp-provider";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { phoneNumber, purpose } = await request.json();

    if (!phoneNumber) {
      return fail("Phone number is required.", 400);
    }

    if (!["VERIFY_PHONE", "RESET_PASSWORD"].includes(purpose)) {
      return fail("Invalid OTP purpose.", 400);
    }

    // Basic rate limiting / cooldown check:
    // Ensure they haven't requested an OTP in the last 60 seconds
    const recentOtp = await prisma.otp.findFirst({
      where: {
        phone: phoneNumber,
        purpose,
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000), // 60 seconds ago
        },
      },
    });

    if (recentOtp) {
      return fail("Please wait 60 seconds before requesting another code.", 429);
    }

    const code = generateOTPCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.otp.create({
      data: {
        phone: phoneNumber,
        codeHash,
        purpose,
        expiresAt,
      },
    });

    const sent = await sendOTP(phoneNumber, code);
    
    if (!sent) {
      return fail("Failed to send OTP.", 500);
    }

    return ok({ message: "OTP sent successfully." });
  } catch (error) {
    return handleRouteError(error, "Unable to send OTP.");
  }
}
