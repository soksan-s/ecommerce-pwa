import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createKhqrPaymentForOrder, serializeKhqrPayment } from "@/lib/server/bakong/payments";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const body = await request.json();
    const orderId = String(body.orderId || "").trim();

    if (!orderId) {
      return fail("Order ID is required.", 422);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order || order.userId !== user.id || order.channel !== "ONLINE") {
      return fail("Order not found.", 404);
    }

    if (["CANCELLED", "REFUNDED", "RETURNED", "COMPLETED"].includes(order.status)) {
      return fail("This order cannot accept a new payment.", 409);
    }

    console.log("[KHQR] Starting payment creation", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
    });

    const startedAt = Date.now();

    const { payment, qrImage, reused } =
      await createKhqrPaymentForOrder(order);

    console.log("[KHQR] Payment creation finished", {
      durationMs: Date.now() - startedAt,
      reused,
    });

    return ok({
      success: true,
      reused,
      payment: serializeKhqrPayment(payment, { qrImage }),
    });

    // const { payment, qrImage, reused } = await createKhqrPaymentForOrder(order);

    
    // return ok({
    //   success: true,
    //   reused,
    //   payment: serializeKhqrPayment(payment, { qrImage }),
    // });
  } catch (error) {
    if (error?.code === "BAKONG_CONFIG_MISSING") {
      return fail("Bakong payment is not configured.", 503);
    }

    if (error?.code === "ORDER_ALREADY_PAID") {
      return fail(error.message, error.status || 409);
    }

    return handleRouteError(error, "Unable to create KHQR payment.");
  }
}
