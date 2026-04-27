/*
  Warnings:

  - You are about to drop the column `code` on the `Position` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[courtId,name]` on the table `Position` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Position_courtId_code_key";

-- AlterTable
ALTER TABLE "Position" DROP COLUMN "code";

-- CreateIndex
CREATE UNIQUE INDEX "Position_courtId_name_key" ON "Position"("courtId", "name");
