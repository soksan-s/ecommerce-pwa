const { PrismaClient } = require('@prisma/client');

// Usage: node scripts/debug-better-auth.js 11831023
const input = process.argv[2] || '11831023';
const phoneNumber = input;
const partial = phoneNumber.replace(/^\+/, '');

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1) Exact phone lookup
    const userExact = await prisma.user.findFirst({
      where: { phoneNumber },
      select: { id: true, phoneNumber: true, role: true, status: true, phoneNumberVerified: true, createdAt: true },
    });

    console.log('=== USER (exact phoneNumber) ===');
    console.log(userExact);

    // 2) Partial match lookup (in case you store "+1183..." but we query without +)
    const usersPartial = await prisma.user.findMany({
      where: { phoneNumber: { contains: partial } },
      select: { id: true, phoneNumber: true, role: true, status: true, phoneNumberVerified: true, createdAt: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n=== USERS (phoneNumber contains partial) ===');
    console.dir(usersPartial, { depth: null });

    const usersToInspect = usersPartial.length ? usersPartial : userExact ? [userExact] : [];

    for (const u of usersToInspect) {
      const accountsByUserId = await prisma.account.findMany({
        where: { userId: u.id },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      console.log(`\n=== ACCOUNTS (userId: ${u.id}) ===`);
      console.dir(accountsByUserId, { depth: null });
    }

    // 3) Also inspect accounts by accountId (some adapters store phone in accountId)
    const accountsByAccountId = await prisma.account.findMany({
      where: { accountId: { contains: partial } },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n=== ACCOUNTS (accountId contains partial) ===');
    console.dir(accountsByAccountId, { depth: null });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

