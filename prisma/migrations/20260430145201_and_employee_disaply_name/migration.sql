/*
  Warnings:

  - A unique constraint covering the columns `[courtId,code]` on the table `Position` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `displayName` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Position_courtId_code_idx";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "displayName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Position" ALTER COLUMN "code" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Position_courtId_idx" ON "Position"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_courtId_code_key" ON "Position"("courtId", "code");
