-- CreateEnum
CREATE TYPE "public"."Devise" AS ENUM ('XOF', 'EUR', 'USD');

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "devise" "public"."Devise" NOT NULL DEFAULT 'XOF';
