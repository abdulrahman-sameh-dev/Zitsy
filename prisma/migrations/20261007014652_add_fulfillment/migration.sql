-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ON_HOLD', 'SENDING_TO_PRODUCTION', 'IN_PRODUCTION', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'ACTION_REQUIRED', 'UNFULFILLABLE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillmentAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fulfillmentError" TEXT,
ADD COLUMN     "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "printifyFulfilledAt" TIMESTAMP(3),
ADD COLUMN     "printifyLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "printifySentToProductionAt" TIMESTAMP(3),
ADD COLUMN     "printifySubmittedAt" TIMESTAMP(3);
