-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "feeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "netAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");
