-- CreateEnum
CREATE TYPE "GuardRank" AS ENUM ('GUARD', 'BAKAR', 'SHIFT_MANAGER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "guardRank" "GuardRank" NOT NULL DEFAULT 'GUARD';
