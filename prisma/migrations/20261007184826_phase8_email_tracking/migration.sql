-- AlterTable: customer-facing tracking link token + authoritative delivered timestamp
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "trackingToken" TEXT;

-- AlterTable: deterministic email idempotency key
ALTER TABLE "EmailLog" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingToken_key" ON "Order"("trackingToken");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_dedupeKey_key" ON "EmailLog"("dedupeKey");
