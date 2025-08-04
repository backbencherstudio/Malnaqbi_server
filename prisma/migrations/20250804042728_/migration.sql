/*
  Warnings:

  - A unique constraint covering the columns `[user_id,place_id]` on the table `favourite_places` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "favourite_places_user_id_place_id_key" ON "favourite_places"("user_id", "place_id");
