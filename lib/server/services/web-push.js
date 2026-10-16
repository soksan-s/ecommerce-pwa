import webpush from "web-push";
import { prisma } from "../db/prisma.js";

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT || "mailto:admin@soeumsavet.store";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error("[WebPush] Failed to configure VAPID details:", err?.message || err);
    return false;
  }
}

/**
 * Sends Web Push notifications for a new ONLINE order to all subscribed Admin / POS staff.
 * Auto-cleans expired subscriptions (HTTP 410 / 404).
 * Updates OrderNotificationLog.
 *
 * @param {object} order - Full order object
 * @returns {Promise<{ success: boolean, sentCount: number, error?: string }>}
 */
export async function sendOrderPushNotification(order) {
  if (!order || !order.id) {
    return { success: false, sentCount: 0, error: "Invalid order data" };
  }

  // Only send for ONLINE orders
  if (order.channel && order.channel !== "ONLINE") {
    return { success: false, sentCount: 0, error: "Not an online order" };
  }

  if (!ensureVapidConfig()) {
    console.warn("[WebPush] VAPID keys not configured. Skipping Web Push.");
    return { success: false, sentCount: 0, error: "VAPID keys not configured" };
  }

  const orderId = String(order.id);
  const orderNumber = String(order.orderNumber || order.id);
  const total = Number(order.total || 0).toFixed(2);
  const currency = order.currency || "USD";
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const customerName = order.user?.name || order.customer?.name || "Customer";

  const payload = JSON.stringify({
    title: `🛒 New Online Order #${orderNumber}`,
    body: `${customerName} placed an order for $${total} ${currency} (${itemCount} item${itemCount === 1 ? "" : "s"}). Tap to manage.`,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    tag: `online-order-${orderId}`,
    data: {
      url: "/admin?tab=orders",
      posUrl: "/pos/orders",
      orderId,
      orderNumber,
      total,
      currency,
    },
  });

  try {
    // 1. Fetch push subscriptions of all authorized staff (ADMIN, SUPER_ADMIN, MANAGER, CASHIER)
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        user: {
          role: {
            in: ["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"],
          },
          status: "ACTIVE",
          deletedAt: null,
        },
      },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0 };
    }

    let successCount = 0;
    const expiredEndpoints = [];

    // 2. Dispatch push to all active subscriptions
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        // Determine destination URL based on role
        const role = sub.user?.role;
        const targetUrl = role === "CASHIER" ? "/pos/orders" : "/admin?tab=orders";
        const customPayload = JSON.stringify({
          title: `🛒 New Online Order #${orderNumber}`,
          body: `${customerName} placed an order for $${total} ${currency} (${itemCount} item${itemCount === 1 ? "" : "s"}). Tap to manage.`,
          icon: "/icons/icon-192.svg",
          badge: "/icons/icon-192.svg",
          tag: `online-order-${orderId}`,
          data: {
            url: targetUrl,
            orderId,
            orderNumber,
            total,
            currency,
          },
        });

        try {
          await webpush.sendNotification(pushSubscription, customPayload, {
            TTL: 86400, // 24 hours
            urgency: "high",
          });
          successCount += 1;
        } catch (pushErr) {
          const statusCode = pushErr?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription has expired or unsubscribed
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error(`[WebPush] Failed sending to endpoint (${statusCode}):`, pushErr?.message || pushErr);
          }
        }
      })
    );

    // 3. Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      try {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: { in: expiredEndpoints } },
        });
      } catch (cleanErr) {
        console.warn("[WebPush] Failed to clean up expired subscriptions:", cleanErr?.message);
      }
    }

    // 4. Update log in DB
    try {
      await prisma.orderNotificationLog.upsert({
        where: { orderId },
        update: {
          pushSentCount: { increment: successCount },
          pushSentAt: new Date(),
        },
        create: {
          orderId,
          orderNumber,
          pushSentCount: successCount,
          pushSentAt: new Date(),
        },
      });
    } catch {}

    return { success: true, sentCount: successCount };
  } catch (error) {
    console.error("[WebPush] Error dispatching push notifications:", error?.message || error);
    return { success: false, sentCount: 0, error: error?.message || "Unknown error" };
  }
}
