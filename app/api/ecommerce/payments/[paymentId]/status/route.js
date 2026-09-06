import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createQrImageDataUrl } from "@/lib/server/bakong/khqr";
import { serializeKhqrPayment, verifyKhqrPayment } from "@/lib/server/bakong/payments";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const { paymentId } = await params;
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment || payment.method !== "KHQR" || !payment.order || payment.order.userId !== user.id || payment.order.channel !== "ONLINE") {
      return fail("Payment not found.", 404);
    }

    const { searchParams } = new URL(request.url);
    const includeQr = searchParams.get("includeQr") === "1";
    const verified = await verifyKhqrPayment(payment);
    const qrImage = includeQr && verified?.qrString ? await createQrImageDataUrl(verified.qrString) : null;

    return ok({
      success: true,
      payment: serializeKhqrPayment(verified, { qrImage }),
    });
  } catch (error) {
    if (error?.code === "BAKONG_CONFIG_MISSING" || error?.code === "BAKONG_TOKEN_MISSING") {
      return fail("Bakong payment verification is not configured.", 503);
    }

    return handleRouteError(error, "Unable to check KHQR payment status.");
  }
}
