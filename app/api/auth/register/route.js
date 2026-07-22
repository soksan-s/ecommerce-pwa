import { fail, handleRouteError, ok } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth";
import { normalizePhoneNumber, phoneAuthEmail, phonesMatch } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

// Verifies a Firebase ID token server-side using Google's public REST API.
// This does NOT require firebase-admin or a service account key.
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
    const { username, phoneNumber, password, firebaseIdToken } = await request.json();

    if (!phoneNumber || !password) {
      return fail("Missing required fields.", 400);
    }

    if (password.length < 4) {
      return fail("Password must be at least 4 characters long.", 400);
    }

    // Verify the Firebase ID token to confirm the phone number was genuinely verified by Firebase
    if (!firebaseIdToken) {
      return fail("Phone verification token is missing. Please verify your phone number first.", 400);
    }

    const firebaseUser = await verifyFirebaseIdToken(firebaseIdToken);

    const canonicalPhone = normalizePhoneNumber(phoneNumber);

    if (!canonicalPhone) {
      return fail("Please enter a valid phone number.", 400);
    }

    if (!phonesMatch(firebaseUser.phoneNumber, canonicalPhone)) {
      return fail("Phone number does not match the verified Firebase token.", 400);
    }

    const passwordHash = await hashPassword(password);

    // Better Auth phone-number sign-in looks up credentials with:
    //   providerId === "credential"
    //   accountId === user.id  (the user's ID, not the phone number)
    //
    // Source: node_modules/better-auth/dist/plugins/phone-number/routes.mjs
    //
    // The phone plugin itself stores its meta on `user.phoneNumber`/`user.phoneNumberVerified`.
    // The password/credential lookup is delegated to the standard "credential" providerId.
    //
    // Since we use Firebase for OTP verification, we must create this row directly
    // in Prisma so that authClient.signIn.phoneNumber(...) can find and verify it.

    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber: canonicalPhone },
      select: { id: true },
    });

    if (existingUser) {
      return fail("An account with this phone number already exists.", 409);
    }

    const user = await prisma.user.create({
      data: {
        email: phoneAuthEmail(canonicalPhone),
        username: username || "",
        phoneNumber: canonicalPhone,
        passwordHash,
        phoneNumberVerified: true,
        role: "CLIENT",
        status: "ACTIVE",
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

    console.log("[register] verified firebase token; created Better Auth phone credential for", {
      canonicalPhone,
      userId: user.id,
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
