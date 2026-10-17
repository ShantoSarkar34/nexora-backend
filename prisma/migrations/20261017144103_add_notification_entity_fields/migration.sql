-- CreateEnum
CREATE TYPE "NotificationEntityType" AS ENUM ('JOB', 'APPLICATION', 'CONTRACT', 'PAYMENT', 'REVIEW', 'INVITATION', 'CONVERSATION', 'DISPUTE');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" "NotificationEntityType",
ADD COLUMN     "meta" JSONB;
