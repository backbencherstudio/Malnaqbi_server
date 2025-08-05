-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "commission" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "payment_method" TEXT DEFAULT 'wallet',
ADD COLUMN     "payment_status" TEXT DEFAULT 'pending',
ADD COLUMN     "product_id" TEXT,
ADD COLUMN     "product_title" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
