import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { phoneAuthEmail } from "@/lib/phone";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const adminUser = await requireAdminUser();
    if (!adminUser) return fail("Unauthorized", 401);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        phoneNumber: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return ok({ users });
  } catch (error) {
    return handleRouteError(error, "Failed to load users");
  }
}

export async function POST(request) {
  try {
    const adminUser = await requireAdminUser();
    if (!adminUser) return fail("Unauthorized", 401);

    const { name, phoneNumber, password, role } = await request.json();

    if (!phoneNumber || !password || !role) {
      return fail("Phone number, password, and role are required.", 400);
    }

    if (password.length < 6) {
      return fail("Password must be at least 6 characters.", 400);
    }

    const allowedRoles = ["ADMIN", "MANAGER", "CASHIER", "WAREHOUSE_STAFF", "DRIVER", "CLIENT"];
    if (!allowedRoles.includes(role)) {
      return fail("Invalid role specified.", 400);
    }

    if (role === "SUPER_ADMIN") {
      return fail("Cannot create a SUPER_ADMIN account.", 403);
    }

    const existing = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      return fail("A user with this phone number already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: phoneAuthEmail(phoneNumber),
        name: name || null,
        phoneNumber,
        passwordHash,
        role,
        status: "ACTIVE",
        phoneNumberVerified: true,
        // Admin-created accounts don't require forced password change (except ADMIN role)
        passwordChangedAt: role !== "ADMIN" ? new Date() : null,
      },
      select: {
        id: true,
        name: true,
        username: true,
        phoneNumber: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return ok({ user }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to create user.", {
      conflictMessage: "A user with this phone number already exists.",
    });
  }
}
