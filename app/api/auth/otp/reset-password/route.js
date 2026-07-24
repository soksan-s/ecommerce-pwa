import { fail, handleRouteError, ok } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { normalizePhoneNumber, phoneAuthEmail, phonesMatch } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

function getPhoneVariants(phoneNumber) {
  const canonicalPhone = normalizePhoneNumber(phoneNumber);
  const digits = canonicalPhone.replace(/^\+/, "");
  const variants = new Set([phoneNumber, canonicalPhone, digits]);

  if (canonicalPhone.startsWith("+855") && digits.length > 3) {
    variants.add(`+855 ${digits.slice(3)}`);
    variants.add(`0${digits.slice(3)}`);
  }

  return [...variants].filter(Boolean);
}

// Verifies a Firebase ID token server-side using Google's public REST API.
async function verifyFirebaseIdToken(idToken) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    throw new Error("Firebase API key is not configured");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Firebase token verification failed");
  }

  const data = await res.json();
  const firebaseUser = data.users?.[0];

  if (!firebaseUser) {
    throw new Error("No user found in Firebase token");
  }

  return firebaseUser;
}

export async function POST(request) {
  try {
    const { phoneNumber, newPassword, firebaseIdToken } = await request.json();

    if (!phoneNumber || !newPassword) {
      return fail("Missing required fields.", 400);
    }

    if (newPassword.length < 4) {
      return fail("Password must be at least 4 characters long.", 400);
    }

    if (!firebaseIdToken) {
      return fail("Phone verification token is missing.", 400);
    }

    const canonicalPhone = normalizePhoneNumber(phoneNumber);

    if (!canonicalPhone) {
      return fail("Please enter a valid phone number.", 400);
    }

    const firebaseUser = await verifyFirebaseIdToken(firebaseIdToken);

    if (!phonesMatch(firebaseUser.phoneNumber, canonicalPhone)) {
      return fail("Phone number does not match the verified Firebase token.", 400);
    }

    // Find the existing user in database using phone variants
    const variants = getPhoneVariants(canonicalPhone);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: { in: variants } },
          { phoneNumber: canonicalPhone },
        ],
        deletedAt: null,
      },
    });

    if (!user) {
      return fail("No account found with this phone number.", 404);
    }

    const passwordHash = await hashPassword(newPassword);
    const expectedEmail = user.email || phoneAuthEmail(user.phoneNumber);

    // Keep user.passwordHash, user.email, and Better Auth credential account in sync
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        email: expectedEmail,
      },
    });

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

    return ok({
      message: "Password reset successfully.",
      emailForAuth: expectedEmail,
      phoneNumberForAuth: user.phoneNumber,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to reset password.");
  }
}
