import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/server/db/prisma";

// Flexible password hashing & verification that supports BOTH:
// 1. Better Auth object signature: verify({ hash, password })
// 2. Standard positional signature: verify(password, hash)

export async function hashPassword(passwordOrObj) {
  let plain = passwordOrObj;
  if (typeof passwordOrObj === "object" && passwordOrObj !== null) {
    plain = passwordOrObj.password || passwordOrObj.plain || "";
  }
  if (typeof plain !== "string" || !plain) return "";
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(arg1, arg2) {
  let plainPassword = "";
  let hash = "";

  if (typeof arg1 === "object" && arg1 !== null) {
    plainPassword = arg1.password || arg1.plainPassword || "";
    hash = arg1.hash || arg1.passwordHash || "";
  } else {
    plainPassword = arg1 || "";
    hash = arg2 || "";
  }

  if (typeof plainPassword !== "string" || !plainPassword) return false;
  if (typeof hash !== "string" || !hash) return false;

  return bcrypt.compare(plainPassword, hash);
}

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "default_development_secret_for_better_auth_12345",
  trustedOrigins: [
    "http://localhost:3000",
    "http://172.27.160.1:3000",
    "http://soksansite.com:3000",
  ],
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_BASE_URL ||
    "http://localhost:3000",
  advanced: {
    useSecureCookies:
      (process.env.BETTER_AUTH_URL || process.env.BETTER_AUTH_BASE_URL || "")
        .trim()
        .startsWith("https://"),
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
});

export async function getSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch {
    return null;
  }
}

function isDatabaseUnavailableError(error) {
  if (["P1001", "P1002", "P1008", "P1017"].includes(error?.code)) {
    return true;
  }

  const message = String(error?.message || error || "").toLowerCase();

  return [
    "can't reach database server",
    "timed out fetching a new connection",
    "connection error",
    "connection refused",
    "server closed the connection unexpectedly",
    "remaining connection slots are reserved",
    "enotfound",
    "econnreset",
  ].some((fragment) => message.includes(fragment));
}

export async function getCurrentUser(options = {}) {
  const { suppressDatabaseErrors = false } = options;
  const sessionData = await getSession();

  if (!sessionData?.session) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: sessionData.user.id,
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        role: true,
        name: true,
        username: true,
        roleId: true,
        branchId: true,
        passwordChangedAt: true,
        roleRef: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    return user;
  } catch (error) {
    if (suppressDatabaseErrors && isDatabaseUnavailableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  return user;
}

export async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return user;
}

export function hasPermission(user, permissionName) {
  if (!user) {
    return false;
  }

  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return true;
  }

  if (!user.roleRef || !Array.isArray(user.roleRef.permissions)) {
    return false;
  }

  return user.roleRef.permissions.some(
    (rp) => rp.permission && rp.permission.name === permissionName,
  );
}

export async function requirePermission(permissionName) {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, permissionName)) {
    return null;
  }

  return user;
}

export function getDefaultRouteForRole(role) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    return "/admin";
  }

  if (role === "CASHIER" || role === "MANAGER") {
    return "/pos";
  }

  return "/client";
}

export function canAccessClient(role) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "CLIENT";
}

export function canAccessPOS(role) {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "CASHIER" ||
    role === "MANAGER"
  );
}
