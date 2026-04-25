/*
  Warnings:

  - You are about to drop the `CourtStaffingRule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourtStaffingRule" DROP CONSTRAINT "CourtStaffingRule_courtShiftRoleId_fkey";

-- DropTable
DROP TABLE "CourtStaffingRule";

-- CreateTable
CREATE TABLE "CourtStaffRule" (
    "id" TEXT NOT NULL,
    "courtShiftRoleId" TEXT NOT NULL,
    "dayCategory" "DayCategory" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtStaffRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtStaffRule_dayCategory_displayOrder_idx" ON "CourtStaffRule"("dayCategory", "displayOrder");

-- CreateIndex
CREATE INDEX "CourtStaffRule_courtShiftRoleId_idx" ON "CourtStaffRule"("courtShiftRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtStaffRule_dayCategory_courtShiftRoleId_key" ON "CourtStaffRule"("dayCategory", "courtShiftRoleId");

-- AddForeignKey
ALTER TABLE "CourtStaffRule" ADD CONSTRAINT "CourtStaffRule_courtShiftRoleId_fkey" FOREIGN KEY ("courtShiftRoleId") REFERENCES "CourtShiftRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
