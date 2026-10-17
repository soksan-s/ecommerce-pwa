import { prisma } from "../db/prisma.js";

/**
 * Escapes HTML characters for Telegram HTML parse mode
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formats date/time for Telegram messages (ICT / UTC+7)
 * @param {Date|string} dateVal
 * @returns {string}
 */
function formatDateTime(dateVal) {
  try {
    const d = dateVal ? new Date(dateVal) : new Date();
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Phnom_Penh",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Builds the HTML message for a new online order notification
 * @param {object} order
 * @returns {string}
 */
/**
 * Resolves map link for delivery address or GPS coordinates.
 * Generates universal Google Maps URL that opens directly in native map apps (Google Maps, Apple Maps) on mobile and desktop.
 * @param {object} order
 * @returns {{ mapUrl: string | null, addressText: string | null, hasCoordinates: boolean, lat: number | null, lng: number | null }}
 */
export function getDeliveryMapInfo(order) {
  if (!order) return { mapUrl: null, addressText: null, hasCoordinates: false, lat: null, lng: null };

  // 1. Check coordinates
  const lat =
    order.delivery?.lat !== undefined && order.delivery?.lat !== null
      ? Number(order.delivery.lat)
      : order.deliveryLatitude !== undefined && order.deliveryLatitude !== null
        ? Number(order.deliveryLatitude)
        : order.lat !== undefined && order.lat !== null
          ? Number(order.lat)
          : null;

  const lng =
    order.delivery?.lng !== undefined && order.delivery?.lng !== null
      ? Number(order.delivery.lng)
      : order.deliveryLongitude !== undefined && order.deliveryLongitude !== null
        ? Number(order.deliveryLongitude)
        : order.lng !== undefined && order.lng !== null
          ? Number(order.lng)
          : null;

  const hasCoordinates =
    lat !== null &&
    lng !== null &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    (lat !== 0 || lng !== 0);

  // 2. Resolve address text
  let addressText = null;
  if (typeof order.shippingAddress === "string" && order.shippingAddress.trim()) {
    addressText = order.shippingAddress.trim();
  } else if (order.deliveryAddress) {
    if (typeof order.deliveryAddress === "string") {
      addressText = order.deliveryAddress.trim();
    } else {
      const parts = [
        order.deliveryAddress.addressLine1,
        order.deliveryAddress.addressLine2,
        order.deliveryAddress.city,
        order.deliveryAddress.state,
      ].filter(Boolean);
      addressText = parts.join(", ");
    }
  } else if (order.delivery?.address && typeof order.delivery.address === "string") {
    addressText = order.delivery.address.trim();
  }

  let mapUrl = null;
  if (hasCoordinates) {
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  } else if (addressText) {
    mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`;
  }

  return { mapUrl, addressText, hasCoordinates, lat, lng };
}

/**
 * Builds the HTML message for a new online order notification
 * @param {object} order
 * @returns {string}
 */
function buildTelegramMessage(order) {
  const storeName = "Soeum Savet Store";
  const orderNumber = order.orderNumber || order.id || "N/A";
  const rawTotal = order.total !== undefined ? order.total : (order.totalAmount !== undefined ? order.totalAmount : 0);
  const total = Number(rawTotal || 0).toFixed(2);
  const currency = order.currency || "USD";
  const createdAtFormatted = formatDateTime(order.createdAt);
  const paymentMethod = order.paymentMethod || "CASH_ON_DELIVERY";
  const paymentStatus = order.paymentStatus || order.status || "PENDING";

  // Customer info
  const customerName = order.user?.name || order.customer?.name || null;
  const customerPhone = order.user?.phoneNumber || order.user?.phone || order.customer?.phone || order.customer?.phoneNumber || null;
  
  const { mapUrl, addressText } = getDeliveryMapInfo(order);
  const note = order.notes || order.note || order.delivery?.note || null;

  // Order items summary
  const items = Array.isArray(order.items) ? order.items : [];
  let itemsListHtml = "";
  if (items.length > 0) {
    itemsListHtml = items
      .map((item, idx) => {
        const name = escapeHtml(item.productName || item.name || "Item");
        const variant = item.variantName && item.variantName !== "Default" ? ` (${escapeHtml(item.variantName)})` : "";
        const qty = item.quantity || 1;
        const lineTotal = Number(item.lineTotal || (item.unitPrice * qty) || 0).toFixed(2);
        return `  ${idx + 1}. <b>${name}${variant}</b> x${qty} — $${lineTotal}`;
      })
      .join("\n");
  } else {
    itemsListHtml = "  <i>No items listed</i>";
  }

  let message = `🛒 <b>NEW ONLINE ORDER RECEIVED!</b>\n`;
  message += `🏪 <b>Store:</b> ${escapeHtml(storeName)}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 <b>Order Number:</b> <code>#${escapeHtml(orderNumber)}</code>\n`;
  message += `💵 <b>Total:</b> <b>$${escapeHtml(total)} ${escapeHtml(currency)}</b>\n`;
  message += `🕒 <b>Time:</b> ${escapeHtml(createdAtFormatted)}\n`;
  message += `💳 <b>Payment:</b> ${escapeHtml(paymentMethod)} (${escapeHtml(paymentStatus)})\n`;

  if (customerName || customerPhone) {
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `👤 <b>Customer Details:</b>\n`;
    if (customerName) message += `  • <b>Name:</b> ${escapeHtml(customerName)}\n`;
    if (customerPhone) message += `  • <b>Phone:</b> <code>${escapeHtml(customerPhone)}</code>\n`;
  }

  if (addressText) {
    message += `━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📍 <b>Delivery Address:</b>\n`;
    message += `  ${escapeHtml(addressText)}\n`;
    if (mapUrl) {
      message += `  🗺️ <a href="${mapUrl}">Open with Maps App</a>\n`;
    }
  }

  if (note) {
    message += `📝 <b>Delivery Note:</b> ${escapeHtml(note)}\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📦 <b>Order Items:</b>\n${itemsListHtml}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `⚡ <i>Please review and process this order in the Admin or POS portal.</i>`;

  return message;
}

/**
 * Sends a Telegram notification for a new ONLINE order.
 * Deduplicated persistently via OrderNotificationLog in Prisma.
 * Guaranteed to be non-blocking and safe against failures.
 *
 * @param {object} order - Full order object with items, user, customer, delivery
 * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string }>}
 */
export async function sendTelegramOrderNotification(order) {
  if (!order || !order.id) {
    return { success: false, error: "Invalid order data" };
  }

  // Only send for ONLINE orders
  if (order.channel && order.channel !== "ONLINE") {
    return { success: false, skipped: true, error: "Not an online order" };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1003961403667";

  if (!botToken) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not configured. Skipping Telegram notification.");
    return { success: false, error: "TELEGRAM_BOT_TOKEN not configured" };
  }

  const orderId = String(order.id);
  const orderNumber = String(order.orderNumber || order.id);

  try {
    // 1. Check persistent deduplication record in DB
    let log = null;
    try {
      log = await prisma.orderNotificationLog.findUnique({
        where: { orderId },
      });

      if (log?.telegramSent) {
        // Already sent — prevent duplicates
        return { success: true, skipped: true };
      }
    } catch (dbErr) {
      console.warn("[Telegram] OrderNotificationLog check warning:", dbErr?.message || dbErr);
    }

    // 2. Prepare message & map button
    const text = buildTelegramMessage(order);
    const { mapUrl } = getDeliveryMapInfo(order);

    const replyMarkup = mapUrl
      ? {
          inline_keyboard: [
            [
              {
                text: "🗺️ Open Location in Maps",
                url: mapUrl,
              },
            ],
          ],
        }
      : undefined;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok || !result.ok) {
      const errMsg = result?.description || `HTTP ${response.status}`;
      console.error("[Telegram] API error sending order notification:", errMsg);

      // Record error in log
      try {
        await prisma.orderNotificationLog.upsert({
          where: { orderId },
          update: { telegramError: errMsg },
          create: {
            orderId,
            orderNumber,
            telegramSent: false,
            telegramError: errMsg,
          },
        });
      } catch {}

      return { success: false, error: errMsg };
    }

    // 3. Record successful delivery
    try {
      await prisma.orderNotificationLog.upsert({
        where: { orderId },
        update: {
          telegramSent: true,
          telegramSentAt: new Date(),
          telegramError: null,
        },
        create: {
          orderId,
          orderNumber,
          telegramSent: true,
          telegramSentAt: new Date(),
        },
      });
    } catch {}

    return { success: true };
  } catch (error) {
    const errorMsg = error?.name === "AbortError" ? "Request timeout" : error?.message || "Unknown error";
    console.error("[Telegram] Error sending notification:", errorMsg);

    try {
      await prisma.orderNotificationLog.upsert({
        where: { orderId },
        update: { telegramError: errorMsg },
        create: {
          orderId,
          orderNumber,
          telegramSent: false,
          telegramError: errorMsg,
        },
      });
    } catch {}

    return { success: false, error: errorMsg };
  }
}

export { escapeHtml as escapeTelegramHtml, buildTelegramMessage as formatTelegramOrderMessage };
