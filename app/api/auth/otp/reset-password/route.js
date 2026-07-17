import { fail, handleRouteError, ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Verifies a Firebase ID token server-side using Google's public REST API.
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
    const { phoneNumber, newPassword, firebaseIdToken } = await request.json();

    if (!phoneNumber || !newPassword) {
      return fail("Missing required fields.", 400);
    }

    if (newPassword.length < 4) {
      return fail("Password must be at least 4 characters long.", 400);
    }

    // Verify Firebase token to confirm the phone number belongs to this user
    if (!firebaseIdToken) {
      return fail("Phone verification token is missing.", 400);
    }

    const firebaseUser = await verifyFirebaseIdToken(firebaseIdToken);
    const firebasePhone = firebaseUser.phoneNumber || "";
    const normalizedInput = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

    if (firebasePhone !== normalizedInput) {
      return fail("Phone number does not match the verified Firebase token.", 400);
    }

    // Find the existing user in our database
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      return fail("No account found with this phone number.", 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the user's password in our database
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Also update all account records linked to this user (both credential and phone-number)
    await prisma.account.updateMany({
      where: { userId: user.id },
      data: { password: passwordHash },
    });

    return ok({ message: "Password reset successfully." });
  } catch (error) {
    return handleRouteError(error, "Unable to reset password.");
  }
}
