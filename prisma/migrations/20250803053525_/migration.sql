/*
  Warnings:

  - You are about to drop the column `latitude` on the `places` table. All the data in the column will be lost.
  - You are about to drop the column `locationId` on the `places` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `places` table. All the data in the column will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."NearbyPlace" DROP CONSTRAINT "NearbyPlace_locationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."places" DROP CONSTRAINT "places_locationId_fkey";

-- AlterTable
ALTER TABLE "public"."places" DROP COLUMN "latitude",
DROP COLUMN "locationId",
DROP COLUMN "longitude",
ADD COLUMN     "location" TEXT;

-- DropTable
DROP TABLE "public"."Location";
