import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Admin-only helpers: dynamic inventory / expiry alerts ─────────────────

function variantProductName(variant) {
  if (!variant) return "Unknown product";
  return variant.nameKh || variant.product?.nameKh || variant.product?.name || variant.name || "Unknown product";
}

function stockMessage(type, inventory) {
  const name = variantProductName(inventory.variant);
  const branch = inventory.branch?.name || "Main";

  if (type === "low_stock") {
    return `ស្តុកទាប / Low stock: ${name} [${branch}] នៅសល់ ${inventory.quantity}`;
  }

  return `អស់ស្តុក / Out of stock: ${name} [${branch}]`;
}

function expiryMessage(type, batch) {
  const name = variantProductName(batch.variant);
  const branch = batch.branch?.name || "Main";

  if (type === "expired") {
    return `ផុតកំណត់ / Expired: ${name} [${branch}] Batch ${batch.batchNumber}`;
  }

  return `ជិតផុតកំណត់ / Expiring soon: ${name} [${branch}] Batch ${batch.batchNumber}`;
}

async function getAdminAlerts() {
  const now = new Date();
  const nextSevenDays = new Date(now);
  nextSevenDays.setDate(now.getDate() + 7);

  const [inventoryRows, expiryRows] = await Promise.all([
    prisma.inventory.findMany({
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        branch: true,
      },
    }),
    prisma.inventoryBatch.findMany({
      where: {
        remainingQty: {
          gt: 0,
        },
        expiryDate: {
          lte: nextSevenDays,
        },
      },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        branch: true,
      },
      orderBy: {
        expiryDate: "asc",
      },
    }),
  ]);

  const lowStock = inventoryRows
    .filter((row) => row.quantity > 0 && row.quantity <= (row.variant?.product?.minStockAlert || 5))
    .map((row) => ({
      id: `low-stock-${row.id}`,
      type: "low_stock",
      severity: "warning",
      message: stockMessage("low_stock", row),
      href: "/admin?tab=inventory",
      createdAt: new Date().toISOString(),
    }));

  const outOfStock = inventoryRows
    .filter((row) => row.quantity === 0)
    .map((row) => ({
      id: `out-stock-${row.id}`,
      type: "out_of_stock",
      severity: "danger",
      message: stockMessage("out_of_stock", row),
      href: "/admin?tab=inventory",
      createdAt: new Date().toISOString(),
    }));

  const expired = expiryRows
    .filter((batch) => batch.expiryDate < now)
    .map((batch) => ({
      id: `expired-${batch.id}`,
      type: "expired",
      severity: "danger",
      message: expiryMessage("expired", batch),
      href: "/admin/inventory/expiry?tab=expired",
      createdAt: batch.expiryDate,
    }));

  const expiringSoon = expiryRows
    .filter((batch) => batch.expiryDate >= now)
    .map((batch) => ({
      id: `expiring-${batch.id}`,
      type: "expiring_soon",
      severity: "warning",
      message: expiryMessage("expiring_soon", batch),
      href: "/admin/inventory/expiry?tab=sevenDays",
      createdAt: batch.expiryDate,
    }));

  return { lowStock, outOfStock, expired, expiringSoon };
}

// ─── GET /api/notifications ─────────────────────────────────────────────────

export async function GET(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const role = user.role;

    // ── ADMIN / SUPER_ADMIN: full inventory alerts + DB notifications ──
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      const { lowStock, outOfStock, expired, expiringSoon } = await getAdminAlerts();

      const dbNotifications = await prisma.notification.findMany({
        where: { isRead: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const groups = { lowStock, outOfStock, expired, expiringSoon };

      return ok({
        data: groups,
        alerts: [...expired, ...expiringSoon, ...outOfStock, ...lowStock],
        total: Object.values(groups).reduce((sum, group) => sum + group.length, 0),
        notifications: dbNotifications,
      });
    }

    // ── CASHIER / MANAGER: branch-scoped + own account notifications ──
    if (role === "CASHIER" || role === "MANAGER") {
      const orConditions = [{ userId: user.id }];

      // Only add branchId filter if the user has one
      if (user.branchId) {
        orConditions.push({ branchId: user.branchId });
      }

      const notifications = await prisma.notification.findMany({
        where: {
          OR: orConditions,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      return ok({
        notifications,
        unreadCount,
      });
    }

    // ── CLIENT: strictly own notifications only ──
    if (role === "CLIENT") {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: user.id,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      return ok({
        notifications,
        unreadCount,
      });
    }

    // All other roles — no notifications
    return ok({ notifications: [], unreadCount: 0 });
  } catch (error) {
    return handleRouteError(error, "Unable to load notifications.");
  }
}

// ─── PATCH /api/notifications ─── Mark notification(s) as read ────────────

export async function PATCH(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const body = await request.json();
    const role = user.role;

    // Mark a specific notification as read
    if (body.id) {
      const notif = await prisma.notification.findUnique({
        where: { id: body.id },
        select: { id: true, userId: true, branchId: true },
      });

      if (!notif) {
        return fail("Notification not found.", 404);
      }

      // Security: ensure the user can actually read this notification
      const canAccess =
        (role === "ADMIN" || role === "SUPER_ADMIN") ||
        (notif.userId === user.id) ||
        ((role === "CASHIER" || role === "MANAGER") && user.branchId && notif.branchId === user.branchId);

      if (!canAccess) {
        return fail("Access denied.", 403);
      }

      await prisma.notification.update({
        where: { id: body.id },
        data: { isRead: true },
      });

      return ok({ success: true });
    }

    // Mark all as read for this user's scope
    if (body.markAllRead) {
      if (role === "CLIENT") {
        await prisma.notification.updateMany({
          where: { userId: user.id, isRead: false },
          data: { isRead: true },
        });
      } else if (role === "CASHIER" || role === "MANAGER") {
        const orConditions = [{ userId: user.id }];
        if (user.branchId) {
          orConditions.push({ branchId: user.branchId });
        }
        await prisma.notification.updateMany({
          where: { OR: orConditions, isRead: false },
          data: { isRead: true },
        });
      }

      return ok({ success: true });
    }

    return fail("Invalid request.", 422);
  } catch (error) {
    return handleRouteError(error, "Unable to update notification.");
  }
}
