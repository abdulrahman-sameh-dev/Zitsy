-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "printifyActualShippingCurrency" TEXT,
ADD COLUMN     "printifyActualShippingMinor" INTEGER,
ADD COLUMN     "printifyQuotedShippingCurrency" TEXT,
ADD COLUMN     "printifyQuotedShippingMinor" INTEGER,
ADD COLUMN     "printifyShippingDeltaMinor" INTEGER,
ADD COLUMN     "printifyShippingReconcileStatus" TEXT,
ADD COLUMN     "printifyShippingReconciledAt" TIMESTAMP(3);
