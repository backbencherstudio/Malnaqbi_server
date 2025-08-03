/*
  Warnings:

  - The `type` column on the `places` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."places" ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "title" SET DATA TYPE TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT[];
