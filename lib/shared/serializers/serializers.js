export function serializeOrder(order) {
  const delivery = order.delivery
    ? {
        id: order.delivery.id,
        address: order.delivery.address || order.shippingAddress || "",
        lat: order.delivery.lat !== null && order.delivery.lat !== undefined ? Number(order.delivery.lat) : null,
        lng: order.delivery.lng !== null && order.delivery.lng !== undefined ? Number(order.delivery.lng) : null,
        note: order.delivery.note || "",
        status: String(order.delivery.status || "PENDING").toLowerCase(),
        scheduledAt: order.delivery.scheduledAt,
        deliveredAt: order.delivery.deliveredAt,
        driver: order.delivery.driver
          ? {
              name: order.delivery.driver.name,
              phone: order.delivery.driver.phoneNumber,
              vehiclePlate: order.delivery.driver.vehiclePlate || "",
            }
          : null,
      }
    : null;

  const customer = order.customer
    ? {
        id: order.customer.id,
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email || "",
      }
    : order.user
      ? {
          id: order.user.id,
          name: order.user.name || "Customer",
          phone: order.user.phoneNumber || "",
          email: order.user.email || "",
        }
      : null;

  return {
    id: order.id,
    orderNumber: order.orderNumber || order.id,
    createdAt: order.createdAt,
    channel: (order.channel || "ONLINE").toLowerCase(),
    shippingAddress: order.shippingAddress || (delivery ? delivery.address : ""),
    paymentMethod: order.paymentMethod,
    paymentStatus: (order.paymentStatus || "PENDING").toLowerCase(),
    status: order.status.toLowerCase(),
    subtotal: Number(order.subtotal || order.total || 0),
    shippingFee: Number(order.shippingFee || 0),
    taxAmount: Number(order.taxAmount || 0),
    total: Number(order.total || 0),
    note: order.note || (delivery ? delivery.note : ""),
    trackingNumber: order.trackingNumber || "",
    trackingCarrier: order.trackingCarrier || "",
    trackingStatus: order.trackingStatus || "",
    trackingUpdatedAt: order.trackingUpdatedAt || null,
    couponCode: order.couponCode,
    couponDiscount: Number(order.couponDiscount || 0),
    delivery,
    customer,
    items: (order.items || order.lines || []).map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal || item.quantity * item.unitPrice),
    })),
    // Legacy alias for backward compatibility
    lines: (order.items || order.lines || []).map((item) => ({
      productId: item.variantId || item.productId,
      productName: item.productName || item.variantName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discountPercent: item.discountPercent || 0,
    })),
  };
}

export function serializeCoupon(coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type.toLowerCase(),
    value: Number(coupon.value),
    isActive: coupon.isActive,
    description: coupon.description,
    audience: coupon.audience.toLowerCase(),
    userEmail: coupon.userEmail || "",
  };
}

export function serializeSupportTicket(ticket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    messages: (ticket.messages || []).map((entry) => ({
      id: entry.id,
      authorRole: entry.user.role,
      authorEmail: entry.user.email,
      message: entry.message,
      createdAt: entry.createdAt,
    })),
  };
}

export function serializeComment(comment) {
  return {
    id: comment.id,
    userEmail: comment.user.email,
    message: comment.message,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isEdited: comment.updatedAt?.getTime?.() !== comment.createdAt?.getTime?.(),
  };
}
