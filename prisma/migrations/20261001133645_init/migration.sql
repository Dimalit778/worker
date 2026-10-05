-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('MANAGER', 'SHIFT_MANAGER', 'BAKAR', 'GUARD');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "DayCategory" AS ENUM ('WEEKDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AvailabilityPreference" AS ENUM ('AVAILABLE', 'PREFERRED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "ScheduleChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'ARCHIVE', 'MANUAL_OVERRIDE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "systemRole" "SystemRole" NOT NULL DEFAULT 'USER',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isReligious" BOOLEAN NOT NULL DEFAULT false,
    "facilityId" TEXT NOT NULL,
    "employeeRole" "EmployeeRole" NOT NULL,
    "canEditSchedule" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityShift" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "endDayOffset" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacilityShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityPosition" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseRole" "EmployeeRole",
    "requiredRank" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffingRequirement" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "dayCategory" "DayCategory" NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StaffingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "submissionOpensAt" TIMESTAMPTZ(3) NOT NULL,
    "submissionClosesAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSlot" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" TEXT,
    "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySubmission" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAvailability" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "preference" "AvailabilityPreference" NOT NULL,

    CONSTRAINT "ShiftAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleChange" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeType" "ScheduleChangeType" NOT NULL,
    "reason" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_systemRole_idx" ON "User"("systemRole");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_facilityId_key" ON "User"("id", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_code_key" ON "Facility"("code");

-- CreateIndex
CREATE INDEX "Facility_districtId_idx" ON "Facility"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityShift_facilityId_shiftType_key" ON "FacilityShift"("facilityId", "shiftType");

-- CreateIndex
CREATE INDEX "FacilityPosition_facilityId_isActive_displayOrder_idx" ON "FacilityPosition"("facilityId", "isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityPosition_id_facilityId_key" ON "FacilityPosition"("id", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityPosition_facilityId_name_key" ON "FacilityPosition"("facilityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityPosition_facilityId_baseRole_key" ON "FacilityPosition"("facilityId", "baseRole");

-- CreateIndex
CREATE UNIQUE INDEX "StaffingRequirement_positionId_shiftType_dayCategory_key" ON "StaffingRequirement"("positionId", "shiftType", "dayCategory");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_id_facilityId_key" ON "Schedule"("id", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_facilityId_startDate_endDate_key" ON "Schedule"("facilityId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ScheduleSlot_userId_startsAt_idx" ON "ScheduleSlot"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "ScheduleSlot_positionId_facilityId_idx" ON "ScheduleSlot"("positionId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSlot_scheduleId_date_shiftType_positionId_slotNumbe_key" ON "ScheduleSlot"("scheduleId", "date", "shiftType", "positionId", "slotNumber");

-- CreateIndex
CREATE INDEX "AvailabilitySubmission_userId_facilityId_idx" ON "AvailabilitySubmission"("userId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySubmission_scheduleId_userId_key" ON "AvailabilitySubmission"("scheduleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAvailability_submissionId_date_shiftType_key" ON "ShiftAvailability"("submissionId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "ScheduleChange_scheduleId_createdAt_idx" ON "ScheduleChange"("scheduleId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleChange_changedById_facilityId_idx" ON "ScheduleChange"("changedById", "facilityId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityShift" ADD CONSTRAINT "FacilityShift_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityPosition" ADD CONSTRAINT "FacilityPosition_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "FacilityPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_scheduleId_facilityId_fkey" FOREIGN KEY ("scheduleId", "facilityId") REFERENCES "Schedule"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_positionId_facilityId_fkey" FOREIGN KEY ("positionId", "facilityId") REFERENCES "FacilityPosition"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_userId_facilityId_fkey" FOREIGN KEY ("userId", "facilityId") REFERENCES "User"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_scheduleId_facilityId_fkey" FOREIGN KEY ("scheduleId", "facilityId") REFERENCES "Schedule"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_userId_facilityId_fkey" FOREIGN KEY ("userId", "facilityId") REFERENCES "User"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAvailability" ADD CONSTRAINT "ShiftAvailability_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AvailabilitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChange" ADD CONSTRAINT "ScheduleChange_scheduleId_facilityId_fkey" FOREIGN KEY ("scheduleId", "facilityId") REFERENCES "Schedule"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChange" ADD CONSTRAINT "ScheduleChange_changedById_facilityId_fkey" FOREIGN KEY ("changedById", "facilityId") REFERENCES "User"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;
