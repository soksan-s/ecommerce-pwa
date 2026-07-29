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

    if (user.role === "ADMIN") {
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
    const shippingAddress = body.shippingAddress?.trim();
    const paymentMethod = body.paymentMethod?.trim();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const couponCode = body.couponCode?.trim().toUpperCase() || null;

    if (!shippingAddress || shippingAddress.length < 8 || !paymentMethod || !lines.length) {
      return fail("Invalid order payload.", 422);
    }

    // Lines may reference variantId (new) or productId (legacy cart).
    // Separate them so we can do targeted lookups.
    const directVariantIds = [...new Set(lines.map((l) => l.variantId).filter(Boolean))];
    const productOnlyIds   = [...new Set(lines.filter((l) => !l.variantId && l.productId).map((l) => l.productId))];

    // Fetch variants referenced directly
    const directVariants = directVariantIds.length
      ? await prisma.productVariant.findMany({
          where: { id: { in: directVariantIds }, isActive: true },
          include: { product: true },
        })
      : [];

    // Resolve legacy productIds → first active variant for that product
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

    // Verify every productId resolved to a variant
    const unresolvedProducts = productOnlyIds.filter((id) => !productToVariantMap.has(id));
    if (unresolvedProducts.length) {
      return fail("Some products are unavailable.", 422);
    }

    // Combine into a unified variant map keyed by the ID that arrived in the line
    const variantMap = new Map();
    for (const v of directVariants) {
      variantMap.set(v.id, v);
    }
    // For legacy lines, key by productId so the normalisation below can find them
    for (const [productId, v] of productToVariantMap.entries()) {
      variantMap.set(productId, v);
    }

    const normalizedLines = lines.map((line) => {
      // Look up by variantId first, then fall back to productId (legacy cart key)
      const lookupKey = line.variantId || line.productId;
      const variant = variantMap.get(lookupKey);
      const quantity = Number(line.quantity || 0);
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
          paymentMethod,
          subtotal,
          total: subtotal - couponDiscount + totalDeposit,
          status: "PENDING",
          couponCode: coupon?.code || null,
          couponType: coupon ? mapCouponType(coupon.type) : null,
          couponValue: coupon ? Number(coupon.value) : null,
          couponDiscount,
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
        },
      });

for (const line of normalizedLines) {
        // Ensure branch inventory record exists
        await tx.inventory.upsert({
          where: { variantId_branchId: { variantId: line.variant.id, branchId } },
          update: {},
          create: { variantId: line.variant.id, branchId, quantity: 0, availableQuantity: 0 },
        });

        const stockUpdate = await tx.inventory.updateMany({
          where: {
            variantId: line.variant.id,
            branchId,
            quantity: {
              gte: line.quantity,
            },
          },
          data: {
            quantity: {
              decrement: line.quantity,
            },
          },
        });

        if (stockUpdate.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const updatedInventory = await tx.inventory.findUnique({
          where: {
            variantId_branchId: { variantId: line.variant.id, branchId },
          },
        });

        await createInventoryMovement(tx, {
          variantId: line.variant.id,
          branchId,
          orderId: created.id,
          type: "RESERVATION",
          channel: "ONLINE",
          quantity: line.quantity,
          previousStock: Number(updatedInventory.quantity) + line.quantity,
          nextStock: Number(updatedInventory.quantity),
          note: "Online order inventory reservation",
          userId: user.id,
        });

        // Also decrement the legacy product.stock field so the client-facing
        // catalog endpoint (/api/products → catalog.js normalizeProduct)
        // reflects the correct available quantity.
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variant.id },
          select: { productId: true },
        });
        if (variant) {
          const product = await tx.product.findUnique({
            where: { id: variant.productId },
            select: { stock: true },
          });
          if (product && product.stock >= line.quantity) {
            await tx.product.update({
              where: { id: variant.productId },
              data: { stock: { decrement: line.quantity } },
            });
          }
        }
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
