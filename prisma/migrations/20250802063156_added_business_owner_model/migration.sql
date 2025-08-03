-- CreateTable
CREATE TABLE "public"."business_owners" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "status" SMALLINT DEFAULT 1,
    "user_id" TEXT,
    "business_name" TEXT,
    "business_type" TEXT,
    "id_document" TEXT,
    "trade_license" TEXT,

    CONSTRAINT "business_owners_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."business_owners" ADD CONSTRAINT "business_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
