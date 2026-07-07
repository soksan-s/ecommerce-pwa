import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { phoneNumber, password } = body;

    if (!phoneNumber || !password) {
      return fail("Missing required fields.", 400);
    }

    // Since we're using Better Auth, we don't actually need this custom login route for standard sessions
    // Better Auth provides `authClient.signIn.phoneNumber({ phoneNumber, password })` on the frontend
    // This route is kept for manual checks or specific admin first-boot logic if needed.

    // BUT for Admin First-Boot:
    // If the phone matches the .env ADMIN_PHONE, we can intercept and create the user if missing,
    // before letting Better Auth log them in.
    const adminPhone = (process.env.ADMIN_PHONE || "").trim();
    if (adminPhone && phoneNumber === adminPhone) {
      const existingAdmin = await prisma.user.findUnique({
        where: { phoneNumber: adminPhone },
      });

      if (!existingAdmin) {
        // Create the admin user on the fly if they don't exist
        const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
        if (password !== adminPassword) {
          return fail("Invalid credentials.", 401);
        }

        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
          data: {
            phoneNumber: adminPhone,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            phoneNumberVerified: true,
            // passwordChangedAt is NULL, forcing a password change on first login
          },
        });
      }
    }

    return ok({ message: "Proceed to Better Auth sign in." });
  } catch (error) {
    return handleRouteError(error, "Unable to process login request.");
  }
}
