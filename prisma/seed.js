const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed script...");

  console.log("Cleaning up existing database records...");
  const tableNames = [
    'AuditLog', 'SystemSettings', 'Refund', 'ReturnItem', 'Return',
    'Payment', 'PaymentMethod', 'SaleItem', 'Sale', 'OrderLine',
    'OrderStatusHistory', 'Order', 'InventoryMovement', 'Inventory',
    'PurchaseOrderItem', 'GoodsReceipt', 'PurchaseOrder', 'Supplier',
    'ProductDeposit', 'DepositType', 'ProductPriceTier', 'ProductVariant',
    'VariantImage', 'VariantAttributeValue', 'VariantAttribute',
    'Favorite', 'Comment', 'SupportMessage', 'SupportTicket', 'Coupon',
    'ProductTagItem', 'ProductTag', 'ProductBarcode', 'ProductImage', 'Product',
    'Brand', 'Category', 'CustomerNote', 'CustomerCredit', 'CustomerAddress',
    'Customer', 'CustomerType', 'Shift', 'User', 'RolePermission',
    'Permission', 'Role', 'Branch'
  ];
  
  for (const tableName of tableNames) {
    try {
      if (prisma[tableName]) {
        await prisma[tableName].deleteMany({});
      }
    } catch (e) {
      console.log(`Could not delete ${tableName}: ${e.message}`);
    }
  }

  console.log("Seeding default branch...");
  const mainBranch = await prisma.branch.create({
    data: {
      code: "HQ",
      name: "Phnom Penh Headquarters",
      phone: "+85523888999",
      address: "Street 100, Phnom Penh, Cambodia",
      status: "ACTIVE",
    },
  });

  console.log("Seeding system settings...");
  await prisma.systemSettings.create({
    data: {
      usdToKhrRate: 4000,
    },
  });

  console.log("Seeding permissions and roles...");
  const permissionsList = [
    { name: "pos:sales", description: "Process sales transactions at the POS", module: "POS" },
    { name: "pos:reports", description: "Access personal shift and cashier reports", module: "POS" },
    { name: "pos:shifts", description: "Manage cash drawer shifts (open/close)", module: "POS" },
    { name: "pos:returns", description: "Handle customer item refunds and returns", module: "POS" },
    { name: "pos:exchanges", description: "Redeem winning ring pulls/caps and container exchanges", module: "POS" },
    { name: "admin:dashboard", description: "View full store revenue and operations analytics", module: "ADMIN" },
    { name: "admin:products", description: "Create, update, and manage product catalog", module: "ADMIN" },
    { name: "admin:inventory", description: "Adjust stock levels and view movements", module: "ADMIN" },
    { name: "admin:procurement", description: "Manage suppliers, POs, and Goods Receipts", module: "ADMIN" },
    { name: "admin:customers", description: "View customer profiles, credit limits, and container ledgers", module: "ADMIN" },
    { name: "admin:promotions", description: "Create discount campaigns and coupons", module: "ADMIN" },
    { name: "admin:reports", description: "Export CSV/PDF financial summaries and receivables", module: "ADMIN" },
    { name: "admin:users", description: "Configure system users and permission mappings", module: "ADMIN" },
    { name: "admin:settings", description: "Modify global settings and exchange rates", module: "ADMIN" },
  ];

  const dbPermissions = [];
  for (const perm of permissionsList) {
    const created = await prisma.permission.create({ data: perm });
    dbPermissions.push(created);
  }

  const adminRole = await prisma.role.create({
    data: {
      name: "ADMIN",
      description: "Full system control across all operational modules",
    },
  });

  const cashierRole = await prisma.role.create({
    data: {
      name: "CASHIER",
      description: "POS terminal operations, shift manager, and return processing",
    },
  });

  const clientRole = await prisma.role.create({
    data: {
      name: "CLIENT",
      description: "Default customer storefront client role",
    },
  });

  for (const perm of dbPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  const cashierPermNames = ["pos:sales", "pos:reports", "pos:shifts", "pos:returns", "pos:exchanges"];
  const cashierPerms = dbPermissions.filter((p) => cashierPermNames.includes(p.name));
  for (const perm of cashierPerms) {
    await prisma.rolePermission.create({
      data: {
        roleId: cashierRole.id,
        permissionId: perm.id,
      },
    });
  }

  console.log("Seeding system users...");
  const bcryptHash = "$2a$10$r8h77FkI5U.NqE04L2Yee.n.6aW.9m.GqG9p3e7m6c7d8e9f0g1h2"; // "password"

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      passwordHash: bcryptHash,
      role: "ADMIN",
      roleId: adminRole.id,
      branchId: mainBranch.id,
      name: "System Administrator",
      status: "ACTIVE"
    },
  });

  const cashierUser = await prisma.user.create({
    data: {
      email: "cashier@example.com",
      passwordHash: bcryptHash,
      role: "CASHIER",
      roleId: cashierRole.id,
      branchId: mainBranch.id,
      name: "Sreysor Cashier",
      status: "ACTIVE"
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: "client@example.com",
      passwordHash: bcryptHash,
      role: "CLIENT",
      roleId: clientRole.id,
      branchId: mainBranch.id,
      name: "Visal Customer",
      status: "ACTIVE"
    },
  });

  console.log("Seeding configurable payment methods...");
  const paymentMethods = ["Cash", "KHQR", "Bank Transfer", "Customer Credit"];
  for (const name of paymentMethods) {
    await prisma.paymentMethod.create({
      data: { name, active: true },
    });
  }

  console.log("Seeding customer categories...");
  const retailType = await prisma.customerType.create({ data: { name: "RETAIL", code: "RETAIL" } });
  const wholesaleType = await prisma.customerType.create({ data: { name: "WHOLESALE", code: "WHOLESALE" } });

  console.log("Seeding customer accounts...");
  const customer1 = await prisma.customer.create({
    data: {
      name: "Heng Wholesale Beverage",
      phone: "+85512345678",
      email: "heng@example.com",
      customerTypeId: wholesaleType.id,
      creditLimit: 5000.0,
      creditBalance: 1200.0,
    },
  });

  await prisma.customerCredit.create({
    data: {
      customerId: customer1.id,
      branchId: mainBranch.id,
      type: "CHARGE",
      amount: 1200.0,
      balance: 1200.0,
      note: "Opening credit balance",
    },
  });

  console.log("Seeding categories & brands...");
  const catBeer = await prisma.category.create({ data: { name: "Beer", slug: "beer" } });
  const catWater = await prisma.category.create({ data: { name: "Water", slug: "water" } });
  
  const brandAngkor = await prisma.brand.create({ data: { name: "Angkor", slug: "angkor" } });
  const brandVital = await prisma.brand.create({ data: { name: "Vital", slug: "vital" } });

  console.log("Seeding products and variants...");
  
  const prodAngkor = await prisma.product.create({
    data: {
      name: "Angkor Beer Case",
      slug: "angkor-beer-case",
      categoryId: catBeer.id,
      brandId: brandAngkor.id,
      isVariant: true,
      description: "Angkor Beer case consisting of 24 cans. Original premium taste brewed in Cambodia.",
    },
  });

  const angkorVariant = await prisma.productVariant.create({
    data: {
      productId: prodAngkor.id,
      sku: "ANG-CAN-24",
      barcode: "885002011022",
      name: "Default Variant",
      price: 12.5,
      costPrice: 10.0,
      wholesalePrice: 11.0,
      vipPrice: 10.5,
    }
  });

  await prisma.inventory.create({
    data: {
      variantId: angkorVariant.id,
      branchId: mainBranch.id,
      quantity: 120,
      availableQuantity: 120,
    },
  });

  const prodVital = await prisma.product.create({
    data: {
      name: "Vital Pure Water 5-Gallon Tank",
      slug: "vital-5-gallon",
      categoryId: catWater.id,
      brandId: brandVital.id,
      isVariant: true,
      description: "Vital premium purified drinking water in 5-gallon container.",
    },
  });

  const vitalVariant = await prisma.productVariant.create({
    data: {
      productId: prodVital.id,
      sku: "VIT-GAL-05",
      barcode: "885004011233",
      name: "Default Variant",
      price: 3.5,
      costPrice: 2.0,
      wholesalePrice: 2.5,
      vipPrice: 2.2,
    }
  });

  await prisma.inventory.create({
    data: {
      variantId: vitalVariant.id,
      branchId: mainBranch.id,
      quantity: 150,
      availableQuantity: 150,
    },
  });

  console.log("Seeding coupons...");
  await prisma.coupon.create({
    data: {
      code: "BEVERAGE10",
      type: "PERCENT",
      value: 10,
      minPurchase: 0,
      description: "Opening promo discount for 10% off purchases.",
      isActive: true,
    },
  });

  console.log("Seed script execution completed successfully!");
}

main()
  .catch((error) => {
    console.error("Error running seed script:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
