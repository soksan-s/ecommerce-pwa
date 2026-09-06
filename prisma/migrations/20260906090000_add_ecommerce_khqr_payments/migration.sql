-- Extend existing payment states for online payment lifecycles.
DO $$
BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Make Payment usable for POS sales and e-commerce orders.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "qrString" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "qrMd5" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "deeplink" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "transactionHash" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "fromAccountId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "toAccountId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "paidAt" DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_expiresAt_idx" ON "Payment"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_qrMd5_key" ON "Payment"("qrMd5");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_externalRef_key" ON "Payment"("externalRef");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_transactionHash_key" ON "Payment"("transactionHash");
