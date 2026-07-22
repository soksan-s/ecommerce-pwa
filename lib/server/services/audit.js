import { prisma } from "@/lib/server/db/prisma";

function normalizeAction(action) {
  const value = String(action || "UPDATE").toUpperCase();
  return ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "STOCK_CHANGE"].includes(value) ? value : "UPDATE";
}

export async function logAction({ userId, action, module, recordId, oldValue = null, newValue = null }) {
  return prisma.auditLog.create({
    data: {
      userId: userId || null,
      action: normalizeAction(action),
      module: String(module || "SYSTEM").toUpperCase(),
      recordId: recordId || null,
      oldValue,
      newValue,
    },
  });
}
