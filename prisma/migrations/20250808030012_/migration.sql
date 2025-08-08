-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('RESOLEVED', 'OPEN');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "status" "ConversationStatus" DEFAULT 'OPEN';
