/*
  Warnings:

  - You are about to drop the column `position` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `courtShiftRoleId` on the `ScheduleWarning` table. All the data in the column will be lost.
  - You are about to drop the column `courtShiftRoleId` on the `ShiftAssignment` table. All the data in the column will be lost.
  - You are about to drop the `CourtShiftRole` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CourtStaffRule` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[scheduleId,date,shiftType,positionId,slotIndex]` on the table `ShiftAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `positionId` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionId` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftType` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CourtShiftRole" DROP CONSTRAINT "CourtShiftRole_courtId_fkey";

-- DropForeignKey
ALTER TABLE "CourtStaffRule" DROP CONSTRAINT "CourtStaffRule_courtShiftRoleId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleWarning" DROP CONSTRAINT "ScheduleWarning_courtShiftRoleId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT "ShiftAssignment_courtShiftRoleId_fkey";

-- DropIndex
DROP INDEX "Employee_position_idx";

-- DropIndex
DROP INDEX "ScheduleWarning_courtShiftRoleId_date_idx";

-- DropIndex
DROP INDEX "ShiftAssignment_courtShiftRoleId_idx";

-- DropIndex
DROP INDEX "ShiftAssignment_scheduleId_employeeId_date_courtShiftRoleId_key";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "position",
ADD COLUMN     "positionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleWarning" DROP COLUMN "courtShiftRoleId",
ADD COLUMN     "positionId" TEXT,
ADD COLUMN     "shiftType" "ShiftType";

-- AlterTable
ALTER TABLE "ShiftAssignment" DROP COLUMN "courtShiftRoleId",
ADD COLUMN     "positionId" TEXT NOT NULL,
ADD COLUMN     "shiftType" "ShiftType" NOT NULL;

-- DropTable
DROP TABLE "CourtShiftRole";

-- DropTable
DROP TABLE "CourtStaffRule";

-- DropEnum
DROP TYPE "Position";

-- CreateTable
CREATE TABLE "CourtPosition" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtShiftRequirement" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "dayCategory" "DayCategory" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtShiftRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtPosition_courtId_displayOrder_idx" ON "CourtPosition"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourtPosition_courtId_code_key" ON "CourtPosition"("courtId", "code");

-- CreateIndex
CREATE INDEX "CourtShiftRequirement_courtId_shiftType_dayCategory_idx" ON "CourtShiftRequirement"("courtId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "CourtShiftRequirement_positionId_idx" ON "CourtShiftRequirement"("positionId");

-- CreateIndex
CREATE INDEX "CourtShiftRequirement_courtId_displayOrder_idx" ON "CourtShiftRequirement"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourtShiftRequirement_courtId_positionId_shiftType_dayCateg_key" ON "CourtShiftRequirement"("courtId", "positionId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE INDEX "ScheduleWarning_positionId_date_idx" ON "ScheduleWarning"("positionId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_shiftType_idx" ON "ScheduleWarning"("shiftType");

-- CreateIndex
CREATE INDEX "ShiftAssignment_positionId_idx" ON "ShiftAssignment"("positionId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_shiftType_idx" ON "ShiftAssignment"("shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_scheduleId_date_shiftType_positionId_slotIn_key" ON "ShiftAssignment"("scheduleId", "date", "shiftType", "positionId", "slotIndex");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "CourtPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtPosition" ADD CONSTRAINT "CourtPosition_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtShiftRequirement" ADD CONSTRAINT "CourtShiftRequirement_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtShiftRequirement" ADD CONSTRAINT "CourtShiftRequirement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "CourtPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "CourtPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "CourtPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
