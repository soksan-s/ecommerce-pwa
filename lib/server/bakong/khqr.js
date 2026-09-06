import { createRequire } from "module";

import QRCode from "qrcode";

import { requireBakongConfig } from "./config";

const require = createRequire(import.meta.url);
const { BakongKHQR, IndividualInfo, khqrData } = require("bakong-khqr");

function normalizeCurrency(currency) {
  const normalized = String(currency || "USD").toUpperCase();
  return normalized === "KHR" ? "KHR" : "USD";
}

function normalizeAmount(amount, currency) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error("Invalid KHQR payment amount."), {
      code: "INVALID_PAYMENT_AMOUNT",
    });
  }

  return currency === "KHR" ? Math.round(value) : Number(value.toFixed(2));
}

function truncate(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

export function createExternalRef(orderNumber) {
  const cleaned = String(orderNumber || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${cleaned || "SS"}-${random}`.slice(0, 35);
}

export function createKhqrPaymentPayload({ order, externalRef, expiresAt }) {
  const config = requireBakongConfig();
  const currency = normalizeCurrency(order.currency);
  const amount = normalizeAmount(order.total, currency);
  const optionalData = {
    currency: currency === "KHR" ? khqrData.currency.khr : khqrData.currency.usd,
    amount,
    billNumber: truncate(externalRef, 25),
    mobileNumber: config.mobileNumber,
    storeLabel: truncate(config.merchantName, 25),
    terminalLabel: "ECOM",
    purposeOfTransaction: truncate(`Order ${order.orderNumber}`, 25),
    expirationTimestamp: expiresAt.getTime(),
    merchantCategoryCode: config.merchantCategoryCode,
  };

  const khqr = new BakongKHQR();
  const info = new IndividualInfo(config.accountId, truncate(config.merchantName, 25), truncate(config.merchantCity, 15), optionalData);
  const response = khqr.generateIndividual(info);

  if (response?.status?.code !== 0 || !response?.data?.qr || !response?.data?.md5) {
    throw Object.assign(new Error(response?.status?.message || "Unable to generate KHQR."), {
      code: "KHQR_GENERATION_FAILED",
      errorCode: response?.status?.errorCode,
    });
  }

  return {
    qrString: response.data.qr,
    qrMd5: response.data.md5,
    amount,
    currency,
    externalRef,
    description: `Order ${order.orderNumber}`,
  };
}

export async function createQrImageDataUrl(qrString) {
  return QRCode.toDataURL(qrString, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });
}
