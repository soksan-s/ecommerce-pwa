/**
 * Creates (or resets) three test accounts — ADMIN, CASHIER, CLIENT — with all
 * verification/security gates pre-cleared for local testing:
 *   - status ACTIVE
 *   - phone + email verified
 *   - passwordChangedAt set (skips the forced first-login password change)
 *   - Better Auth credential Account row created so sign-in works immediately
 *
 * Safe to re-run: it upserts only these three users and touches nothing else.
 *
 * Usage: node scripts/create-test-users.js
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const TEST_PASSWORD = "Test@123";

const testUsers = [
  {
    phoneNumber: "+85596000001",
    email: "testadmin@soksan.dev",
    name: "Test Admin",
    role: "ADMIN",
    roleName: "ADMIN",
  },
  {
    phoneNumber: "+85596000002",
    email: "testcashier@soksan.dev",
    name: "Test Cashier",
    role: "CASHIER",
    roleName: "CASHIER",
  },
  {
    phoneNumber: "+85596000003",
    email: "testclient@soksan.dev",
    name: "Test Client",
    role: "CLIENT",
    roleName: "CLIENT",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // Optional links — created by prisma/seed.js if it was ever run.
  const hqBranch = await prisma.branch.findFirst({ where: { code: "HQ" } });
  const roles = await prisma.role.findMany();
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  for (const spec of testUsers) {
    const data = {
      email: spec.email,
      emailVerified: true,
      passwordHash,
      role: spec.role,
      roleId: roleByName.get(spec.roleName) || null,
      branchId: hqBranch?.id || null,
      name: spec.name,
      status: "ACTIVE",
      phoneNumberVerified: true,
      passwordChangedAt: new Date(),
      deletedAt: null,
    };

    const user = await prisma.user.upsert({
      where: { phoneNumber: spec.phoneNumber },
      update: data,
      create: { phoneNumber: spec.phoneNumber, ...data },
    });

    // (Re)create the Better Auth credential account so authClient sign-in
    // works right away — mirrors ensureCredentialAccount() in the login route.
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

    console.log(`✔ ${spec.role.padEnd(7)} ${spec.phoneNumber}  /  ${spec.email}`);
  }

  console.log(`\nPassword for all three: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Failed to create test users:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
