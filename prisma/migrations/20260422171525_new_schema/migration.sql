-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GUARD', 'BAKAR', 'SHIFT_MANAGER', 'FACILITY_OFFICER');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "DayCategory" AS ENUM ('WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'OPEN_FOR_SUBMISSION', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('UNDERSTAFFED', 'UNFILLED', 'MIN_NOT_MET', 'CONFLICT', 'FAIRNESS');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

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
    "systemRole" "SystemRole" NOT NULL DEFAULT 'EMPLOYEE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "position" "Position" NOT NULL,
    "courtId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtShiftRule" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "dayCategory" "DayCategory" NOT NULL,
    "position" "Position" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtShiftRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulingPeriod" (
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

    CONSTRAINT "SchedulingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityEntry" (
    "id" TEXT NOT NULL,
    "availabilityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "position" "Position" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "isOpeningDuty" BOOLEAN NOT NULL DEFAULT false,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleWarning" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "type" "WarningType" NOT NULL,
    "severity" "WarningSeverity" NOT NULL,
    "employeeId" TEXT,
    "date" DATE,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairnessRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "totalShifts" INTEGER NOT NULL DEFAULT 0,
    "morningShifts" INTEGER NOT NULL DEFAULT 0,
    "eveningShifts" INTEGER NOT NULL DEFAULT 0,
    "nightShifts" INTEGER NOT NULL DEFAULT 0,
    "weekendShifts" INTEGER NOT NULL DEFAULT 0,
    "openingDuties" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairnessRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
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
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_systemRole_idx" ON "User"("systemRole");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Court_code_key" ON "Court"("code");

-- CreateIndex
CREATE INDEX "Court_regionId_idx" ON "Court"("regionId");

-- CreateIndex
CREATE INDEX "Employee_courtId_idx" ON "Employee"("courtId");

-- CreateIndex
CREATE INDEX "Employee_position_idx" ON "Employee"("position");

-- CreateIndex
CREATE INDEX "CourtShiftRule_courtId_shiftType_dayCategory_displayOrder_idx" ON "CourtShiftRule"("courtId", "shiftType", "dayCategory", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourtShiftRule_courtId_shiftType_dayCategory_position_key" ON "CourtShiftRule"("courtId", "shiftType", "dayCategory", "position");

-- CreateIndex
CREATE INDEX "SchedulingPeriod_courtId_status_idx" ON "SchedulingPeriod"("courtId", "status");

-- CreateIndex
CREATE INDEX "SchedulingPeriod_startDate_endDate_idx" ON "SchedulingPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingPeriod_courtId_startDate_endDate_key" ON "SchedulingPeriod"("courtId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Availability_employeeId_idx" ON "Availability"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_periodId_employeeId_key" ON "Availability"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "AvailabilityEntry_date_shiftType_idx" ON "AvailabilityEntry"("date", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityEntry_availabilityId_date_shiftType_key" ON "AvailabilityEntry"("availabilityId", "date", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_periodId_key" ON "Schedule"("periodId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_scheduleId_date_idx" ON "ShiftAssignment"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_employeeId_date_idx" ON "ShiftAssignment"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_scheduleId_employeeId_date_shiftType_positi_key" ON "ShiftAssignment"("scheduleId", "employeeId", "date", "shiftType", "position", "slotIndex");

-- CreateIndex
CREATE INDEX "ScheduleWarning_scheduleId_date_idx" ON "ScheduleWarning"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_employeeId_date_idx" ON "ScheduleWarning"("employeeId", "date");

-- CreateIndex
CREATE INDEX "FairnessRecord_periodId_idx" ON "FairnessRecord"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "FairnessRecord_employeeId_periodId_key" ON "FairnessRecord"("employeeId", "periodId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtShiftRule" ADD CONSTRAINT "CourtShiftRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingPeriod" ADD CONSTRAINT "SchedulingPeriod_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulingPeriod" ADD CONSTRAINT "SchedulingPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityEntry" ADD CONSTRAINT "AvailabilityEntry_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
