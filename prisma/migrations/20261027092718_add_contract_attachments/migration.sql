-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]';
