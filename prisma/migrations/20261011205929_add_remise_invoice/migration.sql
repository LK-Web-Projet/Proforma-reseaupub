-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('POURCENTAGE', 'MONTANT');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'POURCENTAGE',
ADD COLUMN     "discountValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isDiscountEnabled" BOOLEAN NOT NULL DEFAULT false;
