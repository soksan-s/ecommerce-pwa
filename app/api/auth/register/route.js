import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const { username, phoneNumber, password, code } = await request.json();

    if (!phoneNumber || !password || !code) {
      return fail("Missing required fields.", 400);
    }

    if (password.length < 4) {
      return fail("Password must be at least 4 characters long.", 400);
    }

    // Secure check: verify the code again or verify that it was recently marked as used
    // We'll re-verify the code against the most recently used OTP for VERIFY_PHONE
    const recentOtp = await prisma.otp.findFirst({
      where: {
        phone: phoneNumber,
        purpose: "VERIFY_PHONE",
        usedAt: { not: null },
      },
      orderBy: {
        usedAt: "desc",
      },
    });

    if (!recentOtp) {
      return fail("Phone number not verified. Please verify your phone number first.", 400);
    }

    // Must be used within the last 15 minutes to allow registration
    if (Date.now() - recentOtp.usedAt.getTime() > 15 * 60 * 1000) {
      return fail("Phone verification expired. Please verify again.", 400);
    }

    // Verify the code matches
    const isValid = await bcrypt.compare(code, recentOtp.codeHash);
    if (!isValid) {
      return fail("Invalid verification code provided.", 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: {
        phoneNumber,
      },
    });

    if (existingUser) {
      return fail("An account with this phone number already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        username: username || "",
        phoneNumber,
        passwordHash,
        phoneNumberVerified: true,
        role: "CLIENT", // Always CLIENT (Customer) for public registration
      },
    });

    return ok({
      message: "Account created successfully.",
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to process register request.", {
      conflictMessage: "An account with this phone number already exists.",
    });
  }
}
