/*
  Warnings:

  - You are about to drop the column `displayOrder` on the `Position` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Position_courtId_displayOrder_idx";

-- AlterTable
ALTER TABLE "Position" DROP COLUMN "displayOrder",
ADD COLUMN     "code" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Position_courtId_code_idx" ON "Position"("courtId", "code");
