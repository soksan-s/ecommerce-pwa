import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;
const runtimeDatabaseUrl =
  process.env.NODE_ENV === "development"
    ? process.env.DIRECT_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
