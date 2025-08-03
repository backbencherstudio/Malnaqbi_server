/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `business_owners` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "business_owners_user_id_key" ON "public"."business_owners"("user_id");
