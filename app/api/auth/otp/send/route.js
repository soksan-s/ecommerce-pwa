import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { sendOTP, generateOTPCode } from "@/lib/otp-provider";
import { normalizePhoneNumber } from "@/lib/phone";
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

    // Demo OTP guard: only allow the designated demo phone number
    const demoOtpEnabled = process.env.DEMO_OTP_ENABLED === "true";
    if (demoOtpEnabled) {
      const demoPhone = normalizePhoneNumber(process.env.DEMO_OTP_PHONE || "");
      const requestPhone = normalizePhoneNumber(phoneNumber);
      if (!demoPhone || requestPhone !== demoPhone) {
        return fail("Demo OTP is only available for the designated test phone number.", 403);
      }
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

    if (recentOtp && !demoOtpEnabled) {
      return fail("Please wait 60 seconds before requesting another code.", 429);
    }

    const code = (demoOtpEnabled && process.env.DEMO_OTP_CODE) ? process.env.DEMO_OTP_CODE : generateOTPCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const canonicalPhone = normalizePhoneNumber(phoneNumber) || phoneNumber;

    await prisma.otp.create({
      data: {
        phone: canonicalPhone,
        codeHash,
        purpose,
        expiresAt,
      },
    });

    const sent = await sendOTP(canonicalPhone, code);
    
    if (!sent) {
      return fail("Failed to send OTP.", 500);
    }

    return ok({ message: "OTP sent successfully." });
  } catch (error) {
    return handleRouteError(error, "Unable to send OTP.");
  }
}
