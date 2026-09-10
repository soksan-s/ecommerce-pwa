"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderPrintView({ order }) {
  if (!order) return null;

  const items = order.items || order.lines || [];
  const exchangeRate = 4100;
  const totalUsd = Number(order.total || 0);
  const totalKhr = Math.round(totalUsd * exchangeRate);

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=700,height=900");
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsRows = items
      .map(
        (item, i) => `
        <tr>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: left;">
            <div style="font-weight: 600;">${item.productName || item.variantName || "Item"}</div>
            ${item.variantName && item.variantName !== "Default" && item.variantName !== item.productName ? `<div style="font-size: 11px; color: #666;">${item.variantName}</div>` : ""}
            ${item.sku ? `<div style="font-size: 10px; color: #888;">SKU: ${item.sku}</div>` : ""}
          </td>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: right;">$${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td style="padding: 6px 4px; border-bottom: 1px dashed #ddd; text-align: right; font-weight: 600;">$${Number(item.lineTotal || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    const driverInfo = order.delivery?.driver
      ? `<div style="margin-top: 4px;"><strong>Driver:</strong> ${order.delivery.driver.name} (${order.delivery.driver.phone})</div>`
      : "";

    const carrierInfo = order.trackingCarrier || order.trackingNumber
      ? `<div style="margin-top: 4px;"><strong>Carrier:</strong> ${order.trackingCarrier || "Standard"} | <strong>Tracking:</strong> ${order.trackingNumber || "N/A"}</div>`
      : "";

    const coordsInfo = order.delivery?.lat && order.delivery?.lng
      ? `<div style="margin-top: 4px; font-size: 11px; color: #555;"><strong>GPS:</strong> ${Number(order.delivery.lat).toFixed(5)}, ${Number(order.delivery.lng).toFixed(5)}</div>`
      : "";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Order Receipt - ${order.orderNumber || order.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Content:wght@400;700&display=swap');
            * { box-sizing: border-box; }
            body {
              font-family: 'Content', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 13px;
              line-height: 1.4;
              color: #111;
              margin: 0;
              padding: 20px;
              background: #fff;
            }
            .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #222; padding-bottom: 12px; }
            .store-title-kh { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
            .store-title-en { font-size: 14px; font-weight: 600; color: #444; margin-bottom: 4px; }
            .store-sub { font-size: 11px; color: #666; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; font-size: 12px; }
            .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #ccc; margin: 12px 0 6px 0; padding-bottom: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
            th { text-align: left; padding: 6px 4px; border-bottom: 1.5px solid #222; font-size: 12px; }
            .totals-table { width: 100%; margin-top: 8px; font-size: 13px; }
            .totals-table td { padding: 3px 4px; }
            .grand-total { font-size: 16px; font-weight: 700; border-top: 2px solid #222; border-bottom: 2px solid #222; }
            .footer { text-align: center; font-size: 11px; color: #666; margin-top: 24px; border-top: 1px dashed #ccc; padding-top: 12px; }
            @media print {
              body { padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-title-kh">ហាង ស៊ើម សាវេត</div>
            <div class="store-title-en">Soeum Savet Store</div>
            <div class="store-sub">Siem Reap, Cambodia &bull; Tel: 012 345 678 / 098 765 432</div>
            <div class="store-sub">Online & Retail Order Receipt</div>
          </div>

          <div class="meta-grid">
            <div>
              <div><strong>Order No:</strong> ${order.orderNumber || order.id}</div>
              <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
              <div><strong>Status:</strong> ${String(order.status).toUpperCase()}</div>
            </div>
            <div>
              <div><strong>Channel:</strong> ${(order.channel || "ONLINE").toUpperCase()}</div>
              <div><strong>Payment:</strong> ${order.paymentMethod || "Cash on Delivery"} (${String(order.paymentStatus || "PENDING").toUpperCase()})</div>
            </div>
          </div>

          <div class="section-title">Customer & Delivery Info</div>
          <div style="font-size: 12px; margin-bottom: 12px; background: #f9f9f9; padding: 8px; border-radius: 4px;">
            <div><strong>Customer:</strong> ${order.customer?.name || order.user?.name || "Customer"}</div>
            ${order.customer?.phone || order.user?.phone ? `<div><strong>Phone:</strong> ${order.customer?.phone || order.user?.phone}</div>` : ""}
            <div><strong>Address:</strong> ${order.shippingAddress || order.delivery?.address || "Store Pickup"}</div>
            ${order.note || order.delivery?.note ? `<div><strong>Delivery Note:</strong> ${order.note || order.delivery?.note}</div>` : ""}
            ${driverInfo}
            ${carrierInfo}
            ${coordsInfo}
          </div>

          <div class="section-title">Order Items</div>
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Item</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 15%; text-align: right;">Price</th>
                <th style="width: 20%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <table class="totals-table">
            <tr>
              <td style="text-align: right; width: 75%;">Subtotal:</td>
              <td style="text-align: right; font-weight: 600;">$${Number(order.subtotal || order.total || 0).toFixed(2)}</td>
            </tr>
            ${order.shippingFee ? `
            <tr>
              <td style="text-align: right;">Shipping Fee:</td>
              <td style="text-align: right;">$${Number(order.shippingFee).toFixed(2)}</td>
            </tr>
            ` : ""}
            ${order.couponDiscount ? `
            <tr>
              <td style="text-align: right; color: #c00;">Discount (${order.couponCode || "Promo"}):</td>
              <td style="text-align: right; color: #c00;">-$${Number(order.couponDiscount).toFixed(2)}</td>
            </tr>
            ` : ""}
            <tr class="grand-total">
              <td style="text-align: right; padding: 6px 4px;">Grand Total:</td>
              <td style="text-align: right; padding: 6px 4px;">
                $${totalUsd.toFixed(2)}<br/>
                <span style="font-size: 12px; font-weight: normal; color: #555;">(${totalKhr.toLocaleString()} KHR)</span>
              </td>
            </tr>
          </table>

          <div class="footer">
            <div>អរគុណសម្រាប់ការគាំទ្រហាង ស៊ើម សាវេត!</div>
            <div>Thank you for choosing Soeum Savet Store.</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="gap-2 border-[var(--border-soft)] hover:bg-[var(--surface-hover)]"
    >
      <Printer className="size-4 text-[var(--muted-foreground)]" />
      <span>Print Receipt</span>
    </Button>
  );
}
