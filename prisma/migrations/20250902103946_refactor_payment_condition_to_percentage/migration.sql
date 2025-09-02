/*
  Warnings:

  - You are about to drop the column `paymentCondition` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Invoice" DROP COLUMN "paymentCondition",
ADD COLUMN     "paymentConditionPercentage" INTEGER;
