/**
 * Notification Service
 * Safe createNotification() with 60-second deduplication guard.
 * Works inside or outside a Prisma transaction context.
 */

/**
 * Create a notification record in the database.
 *
 * Deduplication: if a notification with the same userId/branchId, type, and
 * data.orderId or data.paymentId already exists within the last 60 seconds,
 * the insertion is silently skipped to prevent duplicate spam.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} txOrPrisma
 * @param {{
 *   userId?: string | null;
 *   branchId?: string | null;
 *   type: string;
 *   title: string;
 *   message: string;
 *   data?: Record<string, unknown> | null;
 * }} params
 * @returns {Promise<import('@prisma/client').Notification | null>}
 */
export async function createNotification(txOrPrisma, { userId = null, branchId = null, type, title, message, data = null }) {
  try {
    // Build deduplication filter
    const dedupeWindow = new Date(Date.now() - 60 * 1000); // 60 seconds ago
    const dedupeWhere = {
      type,
      createdAt: { gte: dedupeWindow },
    };

    if (userId) dedupeWhere.userId = userId;
    if (branchId && !userId) dedupeWhere.branchId = branchId;

    // Check for matching orderId or paymentId in data
    const orderId = data?.orderId;
    const paymentId = data?.paymentId;

    if (orderId || paymentId) {
      const existing = await txOrPrisma.notification.findFirst({
        where: dedupeWhere,
        select: { id: true, data: true },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        const existingData = existing.data || {};
        const isDuplicate =
          (orderId && existingData.orderId === orderId) ||
          (paymentId && existingData.paymentId === paymentId);

        if (isDuplicate) {
          // Silently skip — duplicate within 60 seconds
          return null;
        }
      }
    }

    const notification = await txOrPrisma.notification.create({
      data: {
        userId: userId || null,
        branchId: branchId || null,
        type,
        title,
        message,
        data: data || undefined,
        isRead: false,
      },
    });

    return notification;
  } catch (error) {
    // Never let notification creation fail a transaction
    console.error("[notifications] createNotification error:", error?.message || error);
    return null;
  }
}
