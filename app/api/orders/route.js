import { fail, handleRouteError, ok } from "@/lib/api-response";
import { calculateDeposits, createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serializers";

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function mapCouponType(type) {
  if (!type) {
    return null;
  }

  const normalized = String(type).toUpperCase();
  return normalized === "PERCENT" ? "PERCENT" : "FIXED";
}

/**
 * Generates a unique order number like ORD-20260723-A1B2C3.
 * Retries up to 5 times on the rare collision chance.
 */
async function generateOrderNumber() {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `ORD-${datePart}-${suffix}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber: candidate } });
    if (!existing) {
      return candidate;
    }
  }
  // Fallback: timestamp-based
  return `ORD-${Date.now()}`;
}

export async function GET(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel")?.toUpperCase();
    const status = searchParams.get("status")?.toUpperCase();
    const where = {};

    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      if (channel === "ONLINE" || channel === "POS") {
        where.channel = channel;
      }
    } else if (canAccessPOS(user.role)) {
      where.channel = "ONLINE";
    } else {
      where.userId = user.id;
    }

    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        delivery: {
          include: {
            driver: true,
          },
        },
        customer: true,
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return ok({
      data: orders.map(serializeOrder),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load orders.");
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const body = await request.json();
    const lines = Array.isArray(body.lines) ? body.lines : (Array.isArray(body.items) ? body.items : []);
    const shippingAddress = body.shippingAddress?.trim();
    const paymentMethod = body.paymentMethod?.trim();
    const lat =
      body.deliveryLatitude !== undefined && body.deliveryLatitude !== null
        ? Number(body.deliveryLatitude)
        : body.lat !== undefined && body.lat !== null
          ? Number(body.lat)
          : null;
    const lng =
      body.deliveryLongitude !== undefined && body.deliveryLongitude !== null
        ? Number(body.deliveryLongitude)
        : body.lng !== undefined && body.lng !== null
          ? Number(body.lng)
          : null;
    const deliveryNote = (body.deliveryNote || body.note || "").trim() || null;

    if (!shippingAddress || shippingAddress.length < 8 || !paymentMethod || !lines.length) {
      return fail("Invalid order payload.", 422);
    }

// Lines must reference variantId. Products with variants require variantId.
    const variantIds = [...new Set(lines.map((l) => l.variantId).filter(Boolean))];

    // Find products that have variants but no variantId was provided
    const productOnlyIds = [...new Set(lines.filter((l) => !l.variantId && l.productId).map((l) => l.productId))];
    if (productOnlyIds.length > 0) {
      // Check if any of these products have variants
      const productsWithVariants = await prisma.product.count({
        where: {
          id: { in: productOnlyIds },
          isVariant: true,
        },
      });
      if (productsWithVariants > 0) {
        return fail("Variant selection is required for products with multiple options.", 422);
      }
    }

    // Fetch variants referenced directly
    const directVariants = variantIds.length
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds }, isActive: true },
          include: { product: true },
        })
      : [];

    // For non-variant products, resolve the first active variant
    const productVariants = productOnlyIds.length
      ? await prisma.productVariant.findMany({
          where: { productId: { in: productOnlyIds }, isActive: true },
          include: { product: true },
          orderBy: { sortOrder: "asc" },
        })
      : [];

    // Build a map: productId → first active variant (lowest sortOrder)
    const productToVariantMap = new Map();
    for (const v of productVariants) {
      if (!productToVariantMap.has(v.productId)) {
        productToVariantMap.set(v.productId, v);
      }
    }

    // Verify every productId resolved to a variant. For products that have no
    // variants at all (e.g. legacy products created before the variant system,
    // or products added without enabling variants), create a default variant on
    // the fly so every line always resolves to a real, orderable variant whose
    // price matches the product-level price.
    const unresolvedProducts = productOnlyIds.filter((id) => !productToVariantMap.has(id));
    if (unresolvedProducts.length) {
      const unresolvedProductRows = await prisma.product.findMany({
        where: { id: { in: unresolvedProducts }, deletedAt: null },
      });

      const fallbackBranchId = body.branchId
        ? body.branchId
        : (await prisma.branch.findFirst({ where: { code: "HQ" } }))?.id || null;

      for (const legacyProduct of unresolvedProductRows) {
        // Reuse an existing default variant if present (idempotent retries).
        let defaultVariant = await prisma.productVariant.findFirst({
          where: { productId: legacyProduct.id, name: "Default" },
        });

        if (!defaultVariant) {
          defaultVariant = await prisma.productVariant.create({
            data: {
              productId: legacyProduct.id,
              sku:
                legacyProduct.sku ||
                `DFLT-${String(legacyProduct.id).slice(-8).toUpperCase()}`,
              name: "Default",
              price: Number(legacyProduct.price || 0),
              costPrice: legacyProduct.costPrice || null,
              wholesalePrice: legacyProduct.wholesalePrice || null,
              discountPercent: legacyProduct.discountPercent || 0,
            },
            include: { product: true },
          });
        } else if (!defaultVariant.isActive) {
          defaultVariant = await prisma.productVariant.update({
            where: { id: defaultVariant.id },
            data: { isActive: true },
            include: { product: true },
          });
        }

        // Ensure the default variant has an inventory record at the branch so
        // the stock check below uses the product's available quantity.
        if (fallbackBranchId) {
          await prisma.inventory.upsert({
            where: {
              variantId_branchId: {
                variantId: defaultVariant.id,
                branchId: fallbackBranchId,
              },
            },
            update: {},
            create: {
              variantId: defaultVariant.id,
              branchId: fallbackBranchId,
              quantity: legacyProduct.stock || 0,
              reservedQuantity: 0,
              availableQuantity: legacyProduct.stock || 0,
            },
          });
        }

        productToVariantMap.set(legacyProduct.id, defaultVariant);
      }

      const stillUnresolved = unresolvedProducts.filter((id) => !productToVariantMap.has(id));
      if (stillUnresolved.length) {
        return fail("Some products are unavailable.", 422);
      }
    }

    // Combine into a unified variant map
    const variantMap = new Map();
    for (const v of directVariants) {
      variantMap.set(v.id, v);
    }
    for (const [productId, v] of productToVariantMap.entries()) {
      variantMap.set(productId, v);
    }

    const normalizedLines = lines.map((line) => {
      const lookupKey = line.variantId || line.productId;
      const variant = variantMap.get(lookupKey);
      if (!variant) {
        throw new Error(`Variant not found for line: ${lookupKey}`);
      }
      const quantity = Number(line.quantity || 0);
      // Price is always calculated from the selected variant (never from legacy product.price)
      const unitPrice = Number(variant.price) * (1 - variant.discountPercent / 100);

      return {
        variant,
        quantity,
        unitPrice: Number(unitPrice.toFixed(2)),
      };
    });

    // Check inventory via variant
    if (normalizedLines.some((line) => line.quantity <= 0)) {
      return fail("Invalid quantity for one or more products.", 422);
    }

    // Verify stock for each variant at the branch
    let branchId = body.branchId;
    if (!branchId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { code: "HQ" },
      });
      branchId = defaultBranch?.id;
    }

if (!branchId) {
      return fail("Store branch is not configured. Please contact support.", 503);
    }

    // Check stock levels for variants
    for (const line of normalizedLines) {
      const inv = await prisma.inventory.findUnique({
        where: {
          variantId_branchId: {
            variantId: line.variant.id,
            branchId,
          },
        },
      });
      const availQty = inv ? (inv.availableQuantity > 0 ? inv.availableQuantity : inv.quantity) : 0;
      if (line.quantity > availQty) {
        return fail(`Insufficient stock for ${line.variant.product.name}.`, 422);
      }
    }

    if (normalizedLines.some((line) => line.quantity <= 0)) {
      return fail("Invalid quantity for one or more products.", 422);
    }

    const subtotal = normalizedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    let coupon = null;
    const today = startOfDay(new Date());

    if (couponCode) {
      coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode,
          isActive: true,
        },
      });

      if (!coupon) {
        return fail("Coupon not found or inactive.", 404);
      }

      if (coupon.audience === "USER" && coupon.userEmail && coupon.userEmail !== user.email) {
        return fail("Coupon is not assigned to this account.", 403);
      }

      if (coupon.startsAt && startOfDay(coupon.startsAt) > today) {
        return fail("Coupon is not active yet.", 422);
      }

      if (coupon.endsAt && startOfDay(coupon.endsAt) < today) {
        return fail("Coupon has expired.", 422);
      }
    }

    const couponDiscount = coupon
      ? coupon.type === "PERCENT"
        ? Number(((subtotal * Number(coupon.value)) / 100).toFixed(2))
        : Number(Math.min(Number(coupon.value), subtotal).toFixed(2))
      : 0;

    const order = await prisma.$transaction(async (tx) => {
      // Resolve Customer profile by user email
      const customer = await tx.customer.findFirst({
        where: { email: user.email },
      });

      // Calculate deposits
      const { totalDeposit } = await calculateDeposits(tx, normalizedLines.map(line => ({
        productId: line.variant.productId,
        quantity: line.quantity,
      })));

      const orderNumber = await generateOrderNumber();

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          customerId: customer?.id || null,
          branchId,
          channel: "ONLINE",
          shippingAddress,
          note: deliveryNote,
          paymentMethod,
          subtotal,
          total: subtotal - couponDiscount + totalDeposit,
          status: "PENDING",
          couponCode: coupon?.code || null,
          couponType: coupon ? mapCouponType(coupon.type) : null,
          couponValue: coupon ? Number(coupon.value) : null,
          couponDiscount,
          delivery: {
            create: {
              address: shippingAddress,
              lat: lat !== null && !isNaN(lat) ? lat : null,
              lng: lng !== null && !isNaN(lng) ? lng : null,
              note: deliveryNote,
              status: "PENDING",
            },
          },
          items: {
            create: normalizedLines.map((line) => ({
              variantId: line.variant.id,
              productName: line.variant.product.name,
              variantName: line.variant.name,
              sku: line.variant.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: Number((line.unitPrice * line.quantity).toFixed(2)),
            })),
          },
        },
        include: {
          items: true,
          delivery: {
            include: {
              driver: true,
            },
          },
          customer: true,
          user: true,
        },
      });

for (const line of normalizedLines) {
        // Ensure branch inventory record exists
        await tx.inventory.upsert({
          where: { variantId_branchId: { variantId: line.variant.id, branchId } },
          update: {},
          create: { variantId: line.variant.id, branchId, quantity: 0, reservedQuantity: 0, availableQuantity: 0 },
        });

        // Atomically check availableQuantity >= line.quantity AND reserve stock
        // Using updateMany with gte condition on availableQuantity prevents race conditions
        const reserveResult = await tx.inventory.updateMany({
          where: {
            variantId: line.variant.id,
            branchId,
            availableQuantity: { gte: line.quantity },
          },
          data: {
            reservedQuantity: { increment: line.quantity },
            availableQuantity: { decrement: line.quantity },
          },
        });

        if (reserveResult.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const updatedInventory = await tx.inventory.findUnique({
          where: {
            variantId_branchId: { variantId: line.variant.id, branchId },
          },
        });

        const availBefore = updatedInventory ? (updatedInventory.quantity - updatedInventory.reservedQuantity + line.quantity) : 0;

        await createInventoryMovement(tx, {
          variantId: line.variant.id,
          branchId,
          orderId: created.id,
          type: "RESERVATION",
          channel: "ONLINE",
          quantity: line.quantity,
          previousStock: availBefore,
          nextStock: Number(updatedInventory.availableQuantity),
          note: "Online order inventory reservation",
          userId: user.id,
        });
      }

      await createAuditLog(tx, {
        userId: user.id,
        action: "CREATE",
        module: "orders",
        recordId: created.id,
        newValue: {
          channel: "ONLINE",
          status: created.status,
          total: Number(created.total),
          itemCount: normalizedLines.reduce((sum, line) => sum + line.quantity, 0),
        },
      });

      return created;
    });

    return ok({
      data: serializeOrder(order),
    });
  } catch (error) {
    if (error?.message === "INSUFFICIENT_STOCK") {
      return fail("One or more products no longer have enough stock.", 409);
    }

    return handleRouteError(error, "Unable to create order.");
  }
}
