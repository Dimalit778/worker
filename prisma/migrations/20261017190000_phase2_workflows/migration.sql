-- CreateEnum
CREATE TYPE "EmployeeRequestType" AS ENUM ('TIME_OFF', 'SHIFT_SWAP', 'URGENT_ABSENCE');

-- CreateEnum
CREATE TYPE "EmployeeRequestStatus" AS ENUM ('PENDING_PEER', 'PENDING_MANAGER', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AvailabilitySubmission" ADD COLUMN     "draftEntries" JSONB,
ADD COLUMN     "draftNote" TEXT,
ADD COLUMN     "draftSavedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "StaffingDateOverride" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "positionId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "label" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffingDateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRequest" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "type" "EmployeeRequestType" NOT NULL,
    "status" "EmployeeRequestStatus" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "slotId" TEXT,
    "targetUserId" TEXT,
    "reason" TEXT,
    "peerRespondedAt" TIMESTAMPTZ(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffingDateOverride_facilityId_date_idx" ON "StaffingDateOverride"("facilityId", "date");

-- CreateIndex
CREATE INDEX "StaffingDateOverride_positionId_idx" ON "StaffingDateOverride"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffingDateOverride_facilityId_date_positionId_shiftType_key" ON "StaffingDateOverride"("facilityId", "date", "positionId", "shiftType");

-- CreateIndex
CREATE INDEX "EmployeeRequest_facilityId_status_idx" ON "EmployeeRequest"("facilityId", "status");

-- CreateIndex
CREATE INDEX "EmployeeRequest_requesterId_facilityId_idx" ON "EmployeeRequest"("requesterId", "facilityId");

-- CreateIndex
CREATE INDEX "EmployeeRequest_targetUserId_facilityId_idx" ON "EmployeeRequest"("targetUserId", "facilityId");

-- CreateIndex
CREATE INDEX "EmployeeRequest_slotId_idx" ON "EmployeeRequest"("slotId");

-- AddForeignKey
ALTER TABLE "StaffingDateOverride" ADD CONSTRAINT "StaffingDateOverride_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingDateOverride" ADD CONSTRAINT "StaffingDateOverride_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingDateOverride" ADD CONSTRAINT "StaffingDateOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_requesterId_facilityId_fkey" FOREIGN KEY ("requesterId", "facilityId") REFERENCES "User"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_targetUserId_facilityId_fkey" FOREIGN KEY ("targetUserId", "facilityId") REFERENCES "User"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRequest" ADD CONSTRAINT "EmployeeRequest_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ScheduleSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

