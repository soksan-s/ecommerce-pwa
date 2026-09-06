import { createAuditLog } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

import { getBakongConfig } from "./config";
import { generateBakongDeeplink } from "./deeplink";
import { createExternalRef, createKhqrPaymentPayload, createQrImageDataUrl } from "./khqr";
import { checkTransactionByMd5 } from "./transaction";

const KHQR_METHOD = "KHQR";
const TERMINAL_STATUSES = new Set(["PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED", "VOIDED"]);

function toSafePayment(payment, { qrImage = null } = {}) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    orderNumber: payment.order?.orderNumber,
    status: payment.status,
    amount: Number(payment.amount || 0),
    currency: payment.currency,
    qr: payment.qrString || undefined,
    qrImage: qrImage || undefined,
    deeplink: payment.deeplink || undefined,
    externalRef: payment.externalRef || undefined,
    expiresAt: payment.expiresAt,
    paidAt: payment.paidAt,
  };
}

function amountMatches(actual, expected, currency) {
  const actualValue = Number(actual);
  const expectedValue = Number(expected);
  if (!Number.isFinite(actualValue) || !Number.isFinite(expectedValue)) {
    return false;
  }

  const tolerance = String(currency).toUpperCase() === "KHR" ? 0 : 0.01;
  return Math.abs(actualValue - expectedValue) <= tolerance;
}

function receiverMatches(actualReceiver) {
  const expectedReceiver = getBakongConfig().accountId;
  return String(actualReceiver || "").trim().toLowerCase() === String(expectedReceiver || "").trim().toLowerCase();
}

function logPaymentEvent(event, data) {
  const safeData = {
    paymentId: data.paymentId,
    orderId: data.orderId,
    externalRef: data.externalRef,
    responseCode: data.responseCode,
    errorCode: data.errorCode,
    transactionHash: data.transactionHash,
    status: data.status,
    timestamp: new Date().toISOString(),
  };
  console.info(`[bakong:${event}]`, safeData);
}

async function expirePayment(payment) {
  if (payment.status !== "PENDING" || !payment.expiresAt || payment.expiresAt > new Date()) {
    return payment;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "PENDING",
        paidAt: null,
      },
      data: {
        status: "EXPIRED",
      },
    });

    if (payment.orderId) {
      await tx.order.updateMany({
        where: {
          id: payment.orderId,
          paymentStatus: "PENDING",
        },
        data: {
          paymentStatus: "EXPIRED",
        },
      });
    }

    return tx.payment.findUnique({
      where: { id: payment.id },
      include: { order: true },
    });
  });

  logPaymentEvent("expired", {
    paymentId: updated.id,
    orderId: updated.orderId,
    externalRef: updated.externalRef,
    status: updated.status,
  });

  return updated;
}

async function failPayment(payment, reason, transaction = null) {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
        transactionHash: transaction?.hash || payment.transactionHash,
        fromAccountId: transaction?.fromAccountId || payment.fromAccountId,
        toAccountId: transaction?.toAccountId || payment.toAccountId,
        description: transaction?.description || payment.description,
        note: reason,
      },
    });

    if (payment.orderId) {
      await tx.order.updateMany({
        where: {
          id: payment.orderId,
          paymentStatus: "PENDING",
        },
        data: {
          paymentStatus: "FAILED",
        },
      });
    }

    return tx.payment.findUnique({
      where: { id: payment.id },
      include: { order: true },
    });
  });

  logPaymentEvent("failed", {
    paymentId: updated.id,
    orderId: updated.orderId,
    externalRef: updated.externalRef,
    transactionHash: transaction?.hash,
    status: updated.status,
  });

  return updated;
}

async function markPaymentPaid(payment, transaction) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.payment.findUnique({
      where: { id: payment.id },
      include: { order: true },
    });

    if (!current) {
      throw Object.assign(new Error("Payment not found."), { code: "PAYMENT_NOT_FOUND" });
    }

    if (current.status === "PAID") {
      return current;
    }

    if (current.status !== "PENDING") {
      return current;
    }

    if (current.expiresAt && current.expiresAt <= new Date()) {
      await tx.payment.update({
        where: { id: current.id },
        data: { status: "EXPIRED" },
      });
      return tx.payment.findUnique({ where: { id: current.id }, include: { order: true } });
    }

    const duplicate = await tx.payment.findFirst({
      where: {
        transactionHash: transaction.hash,
        id: { not: current.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      await tx.payment.update({
        where: { id: current.id },
        data: {
          status: "FAILED",
          fromAccountId: transaction.fromAccountId || null,
          toAccountId: transaction.toAccountId || null,
          description: transaction.description || current.description,
          note: "Duplicate Bakong transaction hash.",
        },
      });

      if (current.orderId) {
        await tx.order.updateMany({
          where: {
            id: current.orderId,
            paymentStatus: "PENDING",
          },
          data: {
            paymentStatus: "FAILED",
          },
        });
      }

      return tx.payment.findUnique({ where: { id: current.id }, include: { order: true } });
    }

    const updateResult = await tx.payment.updateMany({
      where: {
        id: current.id,
        status: "PENDING",
        transactionHash: null,
      },
      data: {
        status: "PAID",
        transactionHash: transaction.hash,
        fromAccountId: transaction.fromAccountId || null,
        toAccountId: transaction.toAccountId || null,
        description: transaction.description || current.description,
        paidAt: transaction.acknowledgedDateMs ? new Date(Number(transaction.acknowledgedDateMs)) : new Date(),
      },
    });

    if (updateResult.count !== 1) {
      return tx.payment.findUnique({ where: { id: current.id }, include: { order: true } });
    }

    if (current.orderId) {
      const nextOrderStatus = current.order?.status === "PENDING" ? "CONFIRMED" : current.order?.status;
      await tx.order.update({
        where: { id: current.orderId },
        data: {
          paymentStatus: "PAID",
          ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
        },
      });

      if (current.order?.status !== nextOrderStatus) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: current.orderId,
            status: nextOrderStatus,
            changedBy: current.order.userId,
            note: "KHQR payment verified by Bakong.",
          },
        });
      }
    }

    await createAuditLog(tx, {
      userId: current.order?.userId || null,
      action: "UPDATE",
      module: "payments",
      recordId: current.id,
      oldValue: { status: current.status },
      newValue: {
        status: "PAID",
        orderId: current.orderId,
        transactionHash: transaction.hash,
      },
    });

    const updated = await tx.payment.findUnique({
      where: { id: current.id },
      include: { order: true },
    });

    logPaymentEvent("paid", {
      paymentId: updated.id,
      orderId: updated.orderId,
      externalRef: updated.externalRef,
      transactionHash: transaction.hash,
      status: updated.status,
    });

    return updated;
  });
}

export async function createKhqrPaymentForOrder(order) {
  const config = getBakongConfig();
  const now = new Date();

  if (TERMINAL_STATUSES.has(order.paymentStatus) && order.paymentStatus === "PAID") {
    throw Object.assign(new Error("This order is already paid."), {
      code: "ORDER_ALREADY_PAID",
      status: 409,
    });
  }

  await prisma.payment.updateMany({
    where: {
      orderId: order.id,
      method: KHQR_METHOD,
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  const existing = await prisma.payment.findFirst({
    where: {
      orderId: order.id,
      method: KHQR_METHOD,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    include: { order: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      payment: existing,
      qrImage: existing.qrString ? await createQrImageDataUrl(existing.qrString) : null,
      reused: true,
    };
  }

  // const expiresAt = new Date(Date.now() + config.expiryMinutes * 60 * 1000);
  // const externalRef = createExternalRef(order.orderNumber);
  // const khqrPayload = createKhqrPaymentPayload({ order, externalRef, expiresAt });
  // const qrImage = await createQrImageDataUrl(khqrPayload.qrString);
  // const deeplink = await generateBakongDeeplink(khqrPayload.qrString);

  console.log("[KHQR] Step 1: Creating payment");

const expiresAt = new Date(
  Date.now() + config.expiryMinutes * 60 * 1000
);

const externalRef = createExternalRef(order.orderNumber);

console.log("[KHQR] Step 2: Generating KHQR");

const khqrPayload = createKhqrPaymentPayload({
  order,
  externalRef,
  expiresAt,
});

console.log("[KHQR] KHQR generated", {
  currency: khqrPayload.currency,
  amount: khqrPayload.amount,
  md5: khqrPayload.qrMd5,
  qrLength: khqrPayload.qrString?.length,
});

console.log("[KHQR] Step 3: Generating QR image");

const qrImage = await createQrImageDataUrl(khqrPayload.qrString);

console.log("[KHQR] QR image generated");

console.log("[KHQR] Step 4: Calling Bakong deeplink API", {
  baseUrl: config.baseUrl,
});

const deeplinkStartedAt = Date.now();

const deeplink = await generateBakongDeeplink(
  khqrPayload.qrString
);

console.log("[KHQR] Deeplink generated", {
  durationMs: Date.now() - deeplinkStartedAt,
  deeplink,
});

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        orderId: order.id,
        branchId: order.branchId,
        method: KHQR_METHOD,
        amount: khqrPayload.amount,
        currency: khqrPayload.currency,
        exchangeRate: order.exchangeRate,
        baseAmount: khqrPayload.amount,
        reference: order.orderNumber,
        status: "PENDING",
        qrString: khqrPayload.qrString,
        qrMd5: khqrPayload.qrMd5,
        deeplink,
        externalRef,
        description: khqrPayload.description,
        expiresAt,
        paidAt: null,
      },
      include: { order: true },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: KHQR_METHOD,
        paymentStatus: "PENDING",
      },
    });

    await createAuditLog(tx, {
      userId: order.userId,
      action: "CREATE",
      module: "payments",
      recordId: created.id,
      newValue: {
        orderId: order.id,
        externalRef,
        status: "PENDING",
        method: KHQR_METHOD,
      },
    });

    return created;
  });

  logPaymentEvent("created", {
    paymentId: payment.id,
    orderId: payment.orderId,
    externalRef: payment.externalRef,
    status: payment.status,
  });

  return { payment, qrImage, reused: false };
}

export async function verifyKhqrPayment(payment) {
  const freshPayment = await expirePayment(payment);

  if (!freshPayment || freshPayment.status !== "PENDING") {
    return freshPayment;
  }

  const response = await checkTransactionByMd5(freshPayment.qrMd5);

  logPaymentEvent("checked", {
    paymentId: freshPayment.id,
    orderId: freshPayment.orderId,
    externalRef: freshPayment.externalRef,
    responseCode: response?.responseCode,
    errorCode: response?.errorCode,
    transactionHash: response?.data?.hash,
    status: freshPayment.status,
  });

  if (response?.responseCode === 1 && response?.errorCode === 1) {
    return freshPayment;
  }

  if (response?.responseCode !== 0 || !response?.data) {
    if (response?.errorCode === 2 || response?.errorCode === 3) {
      return failPayment(freshPayment, response?.responseMessage || "Bakong transaction failed.");
    }
    return freshPayment;
  }

  const transaction = response.data;

  if (String(transaction.currency || "").toUpperCase() !== freshPayment.currency) {
    return failPayment(freshPayment, "Bakong transaction currency mismatch.", transaction);
  }

  if (!amountMatches(transaction.amount, freshPayment.amount, freshPayment.currency)) {
    return failPayment(freshPayment, "Bakong transaction amount mismatch.", transaction);
  }

  if (!receiverMatches(transaction.toAccountId)) {
    return failPayment(freshPayment, "Bakong transaction receiver mismatch.", transaction);
  }

  return markPaymentPaid(freshPayment, transaction);
}

export function serializeKhqrPayment(payment, options) {
  return toSafePayment(payment, options);
}
