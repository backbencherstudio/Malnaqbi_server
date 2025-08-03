/*
  Warnings:

  - You are about to drop the `place_ratings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `place_reviews` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "place_ratings" DROP CONSTRAINT "place_ratings_place_id_fkey";

-- DropForeignKey
ALTER TABLE "place_ratings" DROP CONSTRAINT "place_ratings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "place_reviews" DROP CONSTRAINT "place_reviews_place_id_fkey";

-- DropForeignKey
ALTER TABLE "place_reviews" DROP CONSTRAINT "place_reviews_user_id_fkey";

-- DropTable
DROP TABLE "place_ratings";

-- DropTable
DROP TABLE "place_reviews";

-- CreateTable
CREATE TABLE "experience_reviews" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "user_id" TEXT,
    "place_id" TEXT,
    "rating" INTEGER,
    "imgage" TEXT[],
    "tags" TEXT[],
    "review_title" TEXT,
    "review_body" TEXT,

    CONSTRAINT "experience_reviews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;
