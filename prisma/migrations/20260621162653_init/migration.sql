-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ScheduleChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "ScheduleVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DayCategory" AS ENUM ('WEEKDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "HolidayKind" AS ENUM ('EVE', 'HOLIDAY', 'SPECIAL_DAY');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'PUBLISHED', 'ARCHIVED');

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
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
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
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "positionId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isReligious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
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
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "HolidayKind" NOT NULL,
    "behavesAs" "DayCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityForm" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityShift" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePeriod" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkScheduleVersion" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ScheduleVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
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
    "courtId" TEXT,
    "positionId" TEXT,
    "shiftType" "ShiftType",
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
    "scheduleId" TEXT NOT NULL,
    "totalShifts" INTEGER NOT NULL DEFAULT 0,
    "morningShifts" INTEGER NOT NULL DEFAULT 0,
    "eveningShifts" INTEGER NOT NULL DEFAULT 0,
    "nightShifts" INTEGER NOT NULL DEFAULT 0,
    "weekendShifts" INTEGER NOT NULL DEFAULT 0,
    "totalHours" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairnessRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleChangeLog" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "versionId" TEXT,
    "shiftAssignmentId" TEXT,
    "changedById" TEXT NOT NULL,
    "changeType" "ScheduleChangeType" NOT NULL,
    "message" TEXT,
    "reason" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChangeLog_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE INDEX "UserPermission_grantedById_idx" ON "UserPermission"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permissionKey_key" ON "UserPermission"("userId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Court_code_key" ON "Court"("code");

-- CreateIndex
CREATE INDEX "Court_regionId_idx" ON "Court"("regionId");

-- CreateIndex
CREATE INDEX "Employee_courtId_idx" ON "Employee"("courtId");

-- CreateIndex
CREATE INDEX "Employee_courtId_isActive_idx" ON "Employee"("courtId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE INDEX "Employee_positionId_courtId_idx" ON "Employee"("positionId", "courtId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_id_courtId_key" ON "Employee"("id", "courtId");

-- CreateIndex
CREATE INDEX "Position_courtId_idx" ON "Position"("courtId");

-- CreateIndex
CREATE INDEX "Position_courtId_displayOrder_idx" ON "Position"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Position_courtId_name_key" ON "Position"("courtId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_courtId_code_key" ON "Position"("courtId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Position_id_courtId_key" ON "Position"("id", "courtId");

-- CreateIndex
CREATE INDEX "ShiftCapacity_courtId_isActive_idx" ON "ShiftCapacity"("courtId", "isActive");

-- CreateIndex
CREATE INDEX "ShiftCapacity_courtId_shiftType_dayCategory_idx" ON "ShiftCapacity"("courtId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "ShiftCapacity_positionId_idx" ON "ShiftCapacity"("positionId");

-- CreateIndex
CREATE INDEX "ShiftCapacity_positionId_courtId_idx" ON "ShiftCapacity"("positionId", "courtId");

-- CreateIndex
CREATE INDEX "ShiftCapacity_courtId_displayOrder_idx" ON "ShiftCapacity"("courtId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCapacity_courtId_positionId_shiftType_dayCategory_key" ON "ShiftCapacity"("courtId", "positionId", "shiftType", "dayCategory");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Holiday_behavesAs_idx" ON "Holiday"("behavesAs");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "AvailabilityForm_employeeId_idx" ON "AvailabilityForm"("employeeId");

-- CreateIndex
CREATE INDEX "AvailabilityForm_periodId_idx" ON "AvailabilityForm"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityForm_periodId_employeeId_key" ON "AvailabilityForm"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "AvailabilityShift_date_shiftType_idx" ON "AvailabilityShift"("date", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityShift_formId_date_shiftType_key" ON "AvailabilityShift"("formId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "SchedulePeriod_courtId_idx" ON "SchedulePeriod"("courtId");

-- CreateIndex
CREATE INDEX "SchedulePeriod_courtId_endDate_idx" ON "SchedulePeriod"("courtId", "endDate");

-- CreateIndex
CREATE INDEX "SchedulePeriod_courtId_startDate_endDate_idx" ON "SchedulePeriod"("courtId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "SchedulePeriod_startDate_endDate_idx" ON "SchedulePeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePeriod_id_courtId_key" ON "SchedulePeriod"("id", "courtId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_periodId_key" ON "WorkSchedule"("periodId");

-- CreateIndex
CREATE INDEX "WorkSchedule_courtId_idx" ON "WorkSchedule"("courtId");

-- CreateIndex
CREATE INDEX "WorkSchedule_status_idx" ON "WorkSchedule"("status");

-- CreateIndex
CREATE INDEX "WorkSchedule_courtId_status_idx" ON "WorkSchedule"("courtId", "status");

-- CreateIndex
CREATE INDEX "WorkSchedule_createdById_idx" ON "WorkSchedule"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_id_courtId_key" ON "WorkSchedule"("id", "courtId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_periodId_courtId_key" ON "WorkSchedule"("periodId", "courtId");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_scheduleId_idx" ON "WorkScheduleVersion"("scheduleId");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_courtId_idx" ON "WorkScheduleVersion"("courtId");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_status_idx" ON "WorkScheduleVersion"("status");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_isActive_idx" ON "WorkScheduleVersion"("isActive");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_scheduleId_status_isActive_version_idx" ON "WorkScheduleVersion"("scheduleId", "status", "isActive", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleVersion_scheduleId_version_key" ON "WorkScheduleVersion"("scheduleId", "version");

-- CreateIndex
CREATE INDEX "ShiftAssignment_scheduleId_idx" ON "ShiftAssignment"("scheduleId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_versionId_idx" ON "ShiftAssignment"("versionId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_versionId_date_idx" ON "ShiftAssignment"("versionId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_versionId_date_shiftType_positionId_idx" ON "ShiftAssignment"("versionId", "date", "shiftType", "positionId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_scheduleId_date_idx" ON "ShiftAssignment"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_scheduleId_courtId_idx" ON "ShiftAssignment"("scheduleId", "courtId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_employeeId_courtId_idx" ON "ShiftAssignment"("employeeId", "courtId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_positionId_courtId_idx" ON "ShiftAssignment"("positionId", "courtId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_employeeId_date_idx" ON "ShiftAssignment"("employeeId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_courtId_date_idx" ON "ShiftAssignment"("courtId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_positionId_idx" ON "ShiftAssignment"("positionId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_shiftType_idx" ON "ShiftAssignment"("shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_versionId_employeeId_date_shiftType_key" ON "ShiftAssignment"("versionId", "employeeId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "ScheduleWarning_scheduleId_date_idx" ON "ScheduleWarning"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_employeeId_date_idx" ON "ScheduleWarning"("employeeId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_courtId_date_idx" ON "ScheduleWarning"("courtId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_positionId_date_idx" ON "ScheduleWarning"("positionId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_shiftType_idx" ON "ScheduleWarning"("shiftType");

-- CreateIndex
CREATE INDEX "FairnessRecord_scheduleId_idx" ON "FairnessRecord"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "FairnessRecord_employeeId_scheduleId_key" ON "FairnessRecord"("employeeId", "scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_scheduleId_createdAt_idx" ON "ScheduleChangeLog"("scheduleId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_versionId_createdAt_idx" ON "ScheduleChangeLog"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_shiftAssignmentId_idx" ON "ScheduleChangeLog"("shiftAssignmentId");

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_changedById_createdAt_idx" ON "ScheduleChangeLog"("changedById", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_courtId_fkey" FOREIGN KEY ("positionId", "courtId") REFERENCES "Position"("id", "courtId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCapacity" ADD CONSTRAINT "ShiftCapacity_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCapacity" ADD CONSTRAINT "ShiftCapacity_positionId_courtId_fkey" FOREIGN KEY ("positionId", "courtId") REFERENCES "Position"("id", "courtId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityForm" ADD CONSTRAINT "AvailabilityForm_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityForm" ADD CONSTRAINT "AvailabilityForm_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityShift" ADD CONSTRAINT "AvailabilityShift_formId_fkey" FOREIGN KEY ("formId") REFERENCES "AvailabilityForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "SchedulePeriod_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_periodId_courtId_fkey" FOREIGN KEY ("periodId", "courtId") REFERENCES "SchedulePeriod"("id", "courtId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleVersion" ADD CONSTRAINT "WorkScheduleVersion_scheduleId_courtId_fkey" FOREIGN KEY ("scheduleId", "courtId") REFERENCES "WorkSchedule"("id", "courtId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleVersion" ADD CONSTRAINT "WorkScheduleVersion_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkScheduleVersion" ADD CONSTRAINT "WorkScheduleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_scheduleId_courtId_fkey" FOREIGN KEY ("scheduleId", "courtId") REFERENCES "WorkSchedule"("id", "courtId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_courtId_fkey" FOREIGN KEY ("employeeId", "courtId") REFERENCES "Employee"("id", "courtId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_positionId_courtId_fkey" FOREIGN KEY ("positionId", "courtId") REFERENCES "Position"("id", "courtId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkScheduleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_shiftAssignmentId_fkey" FOREIGN KEY ("shiftAssignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
