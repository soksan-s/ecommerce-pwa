import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

    const subscriptionsCount = await prisma.pushSubscription.count({
      where: { userId: user.id },
    });

    return ok({
      data: {
        vapidPublicKey,
        isSupported: true,
        isSubscribed: subscriptionsCount > 0,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Failed to get push status.");
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return fail("Not authenticated.", 401);
    }

    // Only staff roles are allowed to subscribe for operational alerts
    const allowedRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"];
    if (!allowedRoles.includes(user.role)) {
      return fail("Only Admin and POS staff can subscribe to order push alerts.", 403);
    }

    const body = await request.json();
    const { endpoint, keys, userAgent } = body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return fail("Invalid push subscription payload.", 422);
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
      },
    });

    return ok({
      data: {
        id: subscription.id,
        success: true,
        message: "Push notifications enabled successfully.",
      },
    });
  } catch (error) {
    return handleRouteError(error, "Failed to save push subscription.");
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const { searchParams } = new URL(request.url);
    let endpoint = searchParams.get("endpoint");

    if (!endpoint) {
      try {
        const body = await request.json();
        endpoint = body?.endpoint;
      } catch {}
    }

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint,
          userId: user.id,
        },
      });
    } else {
      // Remove all subscriptions for this user
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id },
      });
    }

    return ok({
      data: {
        success: true,
        message: "Push notifications disabled.",
      },
    });
  } catch (error) {
    return handleRouteError(error, "Failed to remove push subscription.");
  }
}
