import { fail, handleRouteError, ok } from "@/lib/api-response";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { normalizePhoneNumber, phoneAuthEmail } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

function getPhoneVariants(phoneNumber) {
  const canonicalPhone = normalizePhoneNumber(phoneNumber);
  const digits = canonicalPhone.replace(/^\+/, "");
  const variants = new Set([phoneNumber, canonicalPhone, digits]);

  if (canonicalPhone.startsWith("+855") && digits.length > 3) {
    variants.add(`+855 ${digits.slice(3)}`);
  }

  return [...variants].filter(Boolean);
}

async function ensureCredentialAccount(user, passwordHash) {
  const expectedEmail = user.email || phoneAuthEmail(user.phoneNumber);
  if (!user.email) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: expectedEmail },
    });
  }

  await prisma.account.deleteMany({
    where: {
      userId: user.id,
      providerId: { in: ["credential", "phone-number"] },
    },
  });

  await prisma.account.create({
    data: {
      id: `cred-${user.id}`,
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { phoneNumber, email, password } = body;
    const rawIdentifier = (phoneNumber || email || "").trim();

    if (!rawIdentifier || !password) {
      return fail("Missing required fields.", 400);
    }

    // Since we're using Better Auth, we don't actually need this custom login route for standard sessions
    // Better Auth provides email/password sessions; phone accounts use a stable internal email identifier.
    // This route is kept for manual checks or specific admin first-boot logic if needed.

    // BUT for Admin First-Boot:
    // If the phone matches the .env ADMIN_PHONE, we can intercept and create the user if missing,
    // before letting Better Auth log them in.
    const adminPhone = (process.env.ADMIN_PHONE || "").trim();
    if (adminPhone && rawIdentifier === adminPhone) {
      const existingAdmin = await prisma.user.findUnique({
        where: { phoneNumber: adminPhone },
      });

      if (!existingAdmin) {
        // Create the admin user on the fly if they don't exist
        const adminPassword = (process.env.ADMIN_PASSWORD || "").trim();
        if (password !== adminPassword) {
          return fail("Invalid credentials.", 401);
        }

        const passwordHash = await hashPassword(adminPassword);
        const admin = await prisma.user.create({
          data: {
            phoneNumber: adminPhone,
            email: phoneAuthEmail(adminPhone),
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            phoneNumberVerified: true,
            // passwordChangedAt is NULL, forcing a password change on first login
          },
        });

        await ensureCredentialAccount(admin, passwordHash);
      }
    }

    const variants = getPhoneVariants(rawIdentifier);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { phoneNumber: { in: variants } },
          { email: rawIdentifier.toLowerCase() },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        passwordHash: true,
        status: true,
      },
    });

    for (const user of users) {
      if (!user.passwordHash) continue;

      const isValid = await verifyPassword({ hash: user.passwordHash, password });
      if (!isValid) continue;

      if (user.status !== "ACTIVE") {
        return fail("This account is not active.", 403);
      }

      await ensureCredentialAccount(user, user.passwordHash);

      const emailForAuth = user.email || phoneAuthEmail(user.phoneNumber);

      return ok({
        message: "Proceed to Better Auth sign in.",
        phoneNumberForAuth: user.phoneNumber,
        emailForAuth,
      });
    }

    return fail("Invalid credentials.", 401);
  } catch (error) {
    return handleRouteError(error, "Unable to process login request.");
  }
}
