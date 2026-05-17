/*
  Warnings:

  - You are about to drop the `Availability` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AvailabilityEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShiftCapacity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_periodId_fkey";

-- DropForeignKey
ALTER TABLE "AvailabilityEntry" DROP CONSTRAINT "AvailabilityEntry_availabilityId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftCapacity" DROP CONSTRAINT "ShiftCapacity_courtId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftCapacity" DROP CONSTRAINT "ShiftCapacity_positionId_fkey";

-- DropTable
DROP TABLE "Availability";

-- DropTable
DROP TABLE "AvailabilityEntry";

-- DropTable
DROP TABLE "ShiftCapacity";

-- CreateTable
CREATE TABLE "StaffingRequirement" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "dayCategory" "DayCategory" NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySubmission" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffingRequirement_courtId_shiftType_dayCategory_idx" ON "StaffingRequirement"("courtId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "StaffingRequirement_positionId_idx" ON "StaffingRequirement"("positionId");

-- CreateIndex
CREATE INDEX "StaffingRequirement_courtId_displayOrder_idx" ON "StaffingRequirement"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StaffingRequirement_courtId_positionId_shiftType_dayCategor_key" ON "StaffingRequirement"("courtId", "positionId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "AvailabilitySubmission_employeeId_idx" ON "AvailabilitySubmission"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySubmission_periodId_employeeId_key" ON "AvailabilitySubmission"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_date_shiftType_idx" ON "AvailabilitySlot"("date", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_submissionId_date_shiftType_key" ON "AvailabilitySlot"("submissionId", "date", "shiftType");

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AvailabilitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
