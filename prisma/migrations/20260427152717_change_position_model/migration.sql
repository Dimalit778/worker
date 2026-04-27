/*
  Warnings:

  - You are about to drop the `CourtPosition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CourtShiftRequirement` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourtPosition" DROP CONSTRAINT "CourtPosition_courtId_fkey";

-- DropForeignKey
ALTER TABLE "CourtShiftRequirement" DROP CONSTRAINT "CourtShiftRequirement_courtId_fkey";

-- DropForeignKey
ALTER TABLE "CourtShiftRequirement" DROP CONSTRAINT "CourtShiftRequirement_positionId_fkey";

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_positionId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleWarning" DROP CONSTRAINT "ScheduleWarning_positionId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT "ShiftAssignment_positionId_fkey";

-- DropTable
DROP TABLE "CourtPosition";

-- DropTable
DROP TABLE "CourtShiftRequirement";

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCapacity" (
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

    CONSTRAINT "ShiftCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_courtId_displayOrder_idx" ON "Position"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Position_courtId_code_key" ON "Position"("courtId", "code");

-- CreateIndex
CREATE INDEX "ShiftCapacity_courtId_shiftType_dayCategory_idx" ON "ShiftCapacity"("courtId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "ShiftCapacity_positionId_idx" ON "ShiftCapacity"("positionId");

-- CreateIndex
CREATE INDEX "ShiftCapacity_courtId_displayOrder_idx" ON "ShiftCapacity"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCapacity_courtId_positionId_shiftType_dayCategory_key" ON "ShiftCapacity"("courtId", "positionId", "shiftType", "dayCategory");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCapacity" ADD CONSTRAINT "ShiftCapacity_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCapacity" ADD CONSTRAINT "ShiftCapacity_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
