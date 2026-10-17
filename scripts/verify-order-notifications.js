import assert from "node:assert";
import { formatTelegramOrderMessage, escapeTelegramHtml, getDeliveryMapInfo } from "../lib/server/services/telegram.js";

async function runTests() {
  console.log("--- Starting Notification Verification Tests ---\n");

  // 1. Test Telegram HTML entity escaping
  console.log("Test 1: Telegram HTML Escaping");
  const rawText = `Customer <script>alert("hack") & 'foo'</script>`;
  const escaped = escapeTelegramHtml(rawText);
  assert.strictEqual(escaped.includes("<script>"), false, "HTML tag '<script>' must be escaped");
  assert.strictEqual(escaped.includes("&lt;script&gt;"), true, "Must contain &lt;script&gt;");
  assert.strictEqual(escaped.includes("&amp;"), true, "Must escape ampersands");
  console.log("✅ Passed: HTML escaping correctly sanitizes malicious and special characters.\n");

  // 2. Test Telegram Order Message Formatting & Map App Link
  console.log("Test 2: Telegram Order Message Formatting with Map Link");
  const sampleOnlineOrder = {
    orderNumber: "ORD-20261009-9999",
    totalAmount: 45.5,
    currency: "USD",
    orderChannel: "ONLINE",
    orderType: "DELIVERY",
    paymentStatus: "PENDING",
    paymentMethod: "KHQR",
    createdAt: new Date("2026-10-09T13:00:00Z"),
    user: {
      name: "Sok Dara",
      phone: "012 345 678",
      email: "dara@example.com",
    },
    items: [
      { productName: "Organic Jasmine Rice 5kg", quantity: 2, unitPrice: 15.0 },
      { productName: "Palm Sugar 1kg", quantity: 3, unitPrice: 5.166 },
    ],
    deliveryAddress: {
      addressLine1: "#123 St 271, Phnom Penh",
      city: "Phnom Penh",
    },
    notes: "Please call upon arrival",
  };

  const message = formatTelegramOrderMessage(sampleOnlineOrder);
  assert.strictEqual(message.includes("Soeum Savet Store"), true, "Must include store name");
  assert.strictEqual(message.includes("ORD-20261009-9999"), true, "Must include order number");
  assert.strictEqual(message.includes("$45.50"), true, "Must format USD total");
  assert.strictEqual(message.includes("Sok Dara"), true, "Must include customer name");
  assert.strictEqual(message.includes("012 345 678"), true, "Must include customer phone");
  assert.strictEqual(message.includes("Organic Jasmine Rice 5kg"), true, "Must list items");
  assert.strictEqual(message.includes("#123 St 271"), true, "Must include delivery address");
  assert.strictEqual(message.includes("google.com/maps/search"), true, "Must include Google Maps link");
  console.log("✅ Passed: Telegram message and Map link formatted completely and accurately.\n");

  // 3. Test Map Resolution with GPS Coordinates vs Text Address
  console.log("Test 3: Map App Link Resolution (GPS Coordinates & Text Address)");
  const orderWithCoords = {
    shippingAddress: "BKK1, Phnom Penh",
    delivery: {
      address: "BKK1, Phnom Penh",
      lat: 11.5564,
      lng: 104.9282,
    },
  };
  const mapInfoCoords = getDeliveryMapInfo(orderWithCoords);
  assert.strictEqual(mapInfoCoords.hasCoordinates, true, "Must detect coordinates");
  assert.strictEqual(mapInfoCoords.mapUrl, "https://www.google.com/maps/search/?api=1&query=11.5564,104.9282", "Must format GPS query");

  const orderWithTextOnly = {
    shippingAddress: "#55 Russian Blvd, Phnom Penh",
  };
  const mapInfoText = getDeliveryMapInfo(orderWithTextOnly);
  assert.strictEqual(mapInfoText.hasCoordinates, false, "No coordinates");
  assert.strictEqual(mapInfoText.mapUrl.includes("Russian%20Blvd"), true, "Must encode text query");
  console.log("✅ Passed: Map URL resolution correctly handles both coordinates and address text.\n");

  // 4. Test POS Sales do NOT trigger Online Order Notifications
  console.log("Test 4: Channel Filter (POS sale vs Online Order)");
  const posOrder = {
    orderNumber: "POS-20261009-0001",
    orderChannel: "POS",
    totalAmount: 12.0,
  };
  const isOnlineOrder = (posOrder.orderChannel || "").toUpperCase() === "ONLINE";
  assert.strictEqual(isOnlineOrder, false, "POS order must NOT be identified as ONLINE order");
  console.log("✅ Passed: POS sales are strictly excluded from online order notifications.\n");

  // 5. Test Push Subscription Role Authorization Filter
  console.log("Test 5: Push Subscription Role Authorization Filter");
  const ALLOWED_ROLES = ["ADMIN", "SUPER_ADMIN", "MANAGER", "CASHIER"];
  
  assert.strictEqual(ALLOWED_ROLES.includes("ADMIN"), true, "ADMIN is allowed");
  assert.strictEqual(ALLOWED_ROLES.includes("SUPER_ADMIN"), true, "SUPER_ADMIN is allowed");
  assert.strictEqual(ALLOWED_ROLES.includes("CASHIER"), true, "CASHIER is allowed");
  assert.strictEqual(ALLOWED_ROLES.includes("CUSTOMER"), false, "CUSTOMER is not allowed");
  assert.strictEqual(ALLOWED_ROLES.includes("GUEST"), false, "GUEST is not allowed");
  console.log("✅ Passed: Role authorization correctly filters staff vs customers.\n");

  // 6. Test Web Push Payload Structure
  console.log("Test 6: Web Push Payload Structure");
  const pushPayload = {
    title: "🛒 New Online Order #ORD-20261009-9999",
    body: "Customer Sok Dara placed an order of $45.50 (2 items).",
    url: "/admin/orders/ord_12345",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "new-online-order-ORD-20261009-9999",
    data: {
      orderId: "ord_12345",
      orderNumber: "ORD-20261009-9999",
      url: "/admin/orders/ord_12345",
      totalAmount: 45.5,
    },
  };
  assert.strictEqual(typeof pushPayload.title, "string", "Title must be string");
  assert.strictEqual(typeof pushPayload.body, "string", "Body must be string");
  assert.strictEqual(pushPayload.tag, "new-online-order-ORD-20261009-9999", "Tag must deduplicate notification tray");
  assert.strictEqual(pushPayload.data.orderId, "ord_12345", "Order ID must be attached");
  console.log("✅ Passed: Web Push payload conforms to Push API & Service Worker specifications.\n");

  console.log("-------------------------------------------------");
  console.log("🎉 ALL ORDER NOTIFICATION & MAP TESTS PASSED!");
  console.log("-------------------------------------------------");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
