/*
  Warnings:

  - You are about to drop the column `openingDuties` on the `FairnessRecord` table. All the data in the column will be lost.
  - You are about to drop the column `isOpeningDuty` on the `ShiftAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `ShiftAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `shiftType` on the `ShiftAssignment` table. All the data in the column will be lost.
  - You are about to drop the `CourtShiftRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SchedulingPeriod` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[scheduleId,employeeId,date,courtShiftRoleId,slotIndex]` on the table `ShiftAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `courtId` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courtShiftRoleId` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_periodId_fkey";

-- DropForeignKey
ALTER TABLE "CourtShiftRule" DROP CONSTRAINT "CourtShiftRule_courtId_fkey";

-- DropForeignKey
ALTER TABLE "FairnessRecord" DROP CONSTRAINT "FairnessRecord_periodId_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_periodId_fkey";

-- DropForeignKey
ALTER TABLE "SchedulingPeriod" DROP CONSTRAINT "SchedulingPeriod_courtId_fkey";

-- DropForeignKey
ALTER TABLE "SchedulingPeriod" DROP CONSTRAINT "SchedulingPeriod_createdById_fkey";

-- DropIndex
DROP INDEX "ShiftAssignment_scheduleId_employeeId_date_shiftType_positi_key";

-- AlterTable
ALTER TABLE "FairnessRecord" DROP COLUMN "openingDuties";

-- AlterTable
ALTER TABLE "ScheduleWarning" ADD COLUMN     "courtId" TEXT,
ADD COLUMN     "courtShiftRoleId" TEXT;

-- AlterTable
ALTER TABLE "ShiftAssignment" DROP COLUMN "isOpeningDuty",
DROP COLUMN "position",
DROP COLUMN "shiftType",
ADD COLUMN     "courtId" TEXT NOT NULL,
ADD COLUMN     "courtShiftRoleId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CourtShiftRule";

-- DropTable
DROP TABLE "SchedulingPeriod";

-- CreateTable
CREATE TABLE "CourtShiftRole" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtShiftRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtShiftRoleAllowedPosition" (
    "id" TEXT NOT NULL,
    "courtShiftRoleId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtShiftRoleAllowedPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtStaffingRule" (
    "id" TEXT NOT NULL,
    "courtShiftRoleId" TEXT NOT NULL,
    "dayCategory" "DayCategory" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtStaffingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePeriod" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtShiftRole_courtId_shiftType_displayOrder_idx" ON "CourtShiftRole"("courtId", "shiftType", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourtShiftRole_courtId_code_shiftType_key" ON "CourtShiftRole"("courtId", "code", "shiftType");

-- CreateIndex
CREATE INDEX "CourtShiftRoleAllowedPosition_position_idx" ON "CourtShiftRoleAllowedPosition"("position");

-- CreateIndex
CREATE UNIQUE INDEX "CourtShiftRoleAllowedPosition_courtShiftRoleId_position_key" ON "CourtShiftRoleAllowedPosition"("courtShiftRoleId", "position");

-- CreateIndex
CREATE INDEX "CourtStaffingRule_dayCategory_displayOrder_idx" ON "CourtStaffingRule"("dayCategory", "displayOrder");

-- CreateIndex
CREATE INDEX "CourtStaffingRule_courtShiftRoleId_idx" ON "CourtStaffingRule"("courtShiftRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtStaffingRule_dayCategory_courtShiftRoleId_key" ON "CourtStaffingRule"("dayCategory", "courtShiftRoleId");

-- CreateIndex
CREATE INDEX "SchedulePeriod_courtId_status_idx" ON "SchedulePeriod"("courtId", "status");

-- CreateIndex
CREATE INDEX "SchedulePeriod_startDate_endDate_idx" ON "SchedulePeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePeriod_courtId_startDate_endDate_key" ON "SchedulePeriod"("courtId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ScheduleWarning_courtId_date_idx" ON "ScheduleWarning"("courtId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_courtShiftRoleId_date_idx" ON "ScheduleWarning"("courtShiftRoleId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_courtShiftRoleId_idx" ON "ShiftAssignment"("courtShiftRoleId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_courtId_date_idx" ON "ShiftAssignment"("courtId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_scheduleId_employeeId_date_courtShiftRoleId_key" ON "ShiftAssignment"("scheduleId", "employeeId", "date", "courtShiftRoleId", "slotIndex");

-- AddForeignKey
ALTER TABLE "CourtShiftRole" ADD CONSTRAINT "CourtShiftRole_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtShiftRoleAllowedPosition" ADD CONSTRAINT "CourtShiftRoleAllowedPosition_courtShiftRoleId_fkey" FOREIGN KEY ("courtShiftRoleId") REFERENCES "CourtShiftRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtStaffingRule" ADD CONSTRAINT "CourtStaffingRule_courtShiftRoleId_fkey" FOREIGN KEY ("courtShiftRoleId") REFERENCES "CourtShiftRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "SchedulePeriod_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "SchedulePeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_courtShiftRoleId_fkey" FOREIGN KEY ("courtShiftRoleId") REFERENCES "CourtShiftRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_courtShiftRoleId_fkey" FOREIGN KEY ("courtShiftRoleId") REFERENCES "CourtShiftRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
