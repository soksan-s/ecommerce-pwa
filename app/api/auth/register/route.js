import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Verifies a Firebase ID token server-side using Google's public REST API.
// This does NOT require firebase-admin or a service account key.
async function verifyFirebaseIdToken(idToken) {
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

    // Normalize phone number for comparison (Firebase stores with + prefix)
    const firebasePhone = firebaseUser.phoneNumber || "";
    const normalizedInput = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

    if (firebasePhone !== normalizedInput) {
      return fail("Phone number does not match the verified Firebase token.", 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
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
        accounts: {
          create: [
            {
              id: crypto.randomUUID(),
              accountId: phoneNumber,
              providerId: "credential",
              password: passwordHash,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: crypto.randomUUID(),
              accountId: phoneNumber,
              providerId: "phone-number",
              password: passwordHash,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
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
