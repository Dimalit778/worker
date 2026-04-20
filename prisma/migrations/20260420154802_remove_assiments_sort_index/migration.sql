/*
  Warnings:

  - The values [OPEN,CLOSED,PUBLISHED] on the enum `PeriodStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `userId` on the `Availability` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `CourtEligibility` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `FairnessRecord` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ScheduleWarning` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ShiftAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `guardRank` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `primaryCourtId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[periodId,employeeId]` on the table `Availability` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId,courtId]` on the table `CourtEligibility` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId,periodId]` on the table `FairnessRecord` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[scheduleId,employeeId,date,shiftType]` on the table `ShiftAssignment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `employeeId` to the `Availability` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AvailabilityEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `districtId` to the `Court` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Court` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeId` to the `CourtEligibility` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CourtEligibility` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeId` to the `FairnessRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `FairnessRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ScheduleWarning` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SchedulingPeriod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeId` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ShiftCapacityRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SystemConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GUARD', 'BAKAR', 'SHIFT_MANAGER', 'FACILITY_OFFICER');

-- AlterEnum
BEGIN;
CREATE TYPE "PeriodStatus_new" AS ENUM ('DRAFT', 'OPEN_FOR_SUBMISSION', 'LOCKED', 'ARCHIVED');
ALTER TABLE "public"."SchedulingPeriod" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SchedulingPeriod" ALTER COLUMN "status" TYPE "PeriodStatus_new" USING ("status"::text::"PeriodStatus_new");
ALTER TYPE "PeriodStatus" RENAME TO "PeriodStatus_old";
ALTER TYPE "PeriodStatus_new" RENAME TO "PeriodStatus";
DROP TYPE "public"."PeriodStatus_old";
ALTER TABLE "SchedulingPeriod" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
ALTER TYPE "ScheduleStatus" ADD VALUE 'FINALIZED';

-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_periodId_fkey";

-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_userId_fkey";

-- DropForeignKey
ALTER TABLE "CourtEligibility" DROP CONSTRAINT "CourtEligibility_userId_fkey";

-- DropForeignKey
ALTER TABLE "FairnessRecord" DROP CONSTRAINT "FairnessRecord_periodId_fkey";

-- DropForeignKey
ALTER TABLE "FairnessRecord" DROP CONSTRAINT "FairnessRecord_userId_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_periodId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleWarning" DROP CONSTRAINT "ScheduleWarning_userId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT "ShiftAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_primaryCourtId_fkey";

-- DropIndex
DROP INDEX "Availability_periodId_userId_key";

-- DropIndex
DROP INDEX "CourtEligibility_userId_courtId_key";

-- DropIndex
DROP INDEX "FairnessRecord_userId_periodId_key";

-- DropIndex
DROP INDEX "ShiftAssignment_scheduleId_userId_date_shiftType_key";

-- AlterTable
ALTER TABLE "Availability" DROP COLUMN "userId",
ADD COLUMN     "employeeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AvailabilityEntry" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Court" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "districtId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CourtEligibility" DROP COLUMN "userId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "employeeId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FairnessRecord" DROP COLUMN "userId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "employeeId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleWarning" DROP COLUMN "userId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "SchedulingPeriod" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ShiftAssignment" DROP COLUMN "userId",
ADD COLUMN     "employeeId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ShiftCapacityRule" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "guardRank",
DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "primaryCourtId",
DROP COLUMN "role",
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "systemRole" "SystemRole" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropEnum
DROP TYPE "GuardRank";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "position" "Position" NOT NULL,
    "primaryCourtId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_position_idx" ON "Employee"("position");

-- CreateIndex
CREATE INDEX "Employee_primaryCourtId_idx" ON "Employee"("primaryCourtId");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE INDEX "Availability_employeeId_idx" ON "Availability"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_periodId_employeeId_key" ON "Availability"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "AvailabilityEntry_courtId_date_shiftType_idx" ON "AvailabilityEntry"("courtId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "Court_districtId_idx" ON "Court"("districtId");

-- CreateIndex
CREATE INDEX "CourtEligibility_courtId_idx" ON "CourtEligibility"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtEligibility_employeeId_courtId_key" ON "CourtEligibility"("employeeId", "courtId");

-- CreateIndex
CREATE INDEX "FairnessRecord_periodId_idx" ON "FairnessRecord"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "FairnessRecord_employeeId_periodId_key" ON "FairnessRecord"("employeeId", "periodId");

-- CreateIndex
CREATE INDEX "Schedule_periodId_status_idx" ON "Schedule"("periodId", "status");

-- CreateIndex
CREATE INDEX "ScheduleWarning_scheduleId_date_idx" ON "ScheduleWarning"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_courtId_date_idx" ON "ScheduleWarning"("courtId", "date");

-- CreateIndex
CREATE INDEX "ScheduleWarning_employeeId_date_idx" ON "ScheduleWarning"("employeeId", "date");

-- CreateIndex
CREATE INDEX "SchedulingPeriod_startDate_endDate_idx" ON "SchedulingPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "SchedulingPeriod_status_idx" ON "SchedulingPeriod"("status");

-- CreateIndex
CREATE INDEX "ShiftAssignment_courtId_date_shiftType_idx" ON "ShiftAssignment"("courtId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "ShiftAssignment_employeeId_date_idx" ON "ShiftAssignment"("employeeId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_scheduleId_date_idx" ON "ShiftAssignment"("scheduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_scheduleId_employeeId_date_shiftType_key" ON "ShiftAssignment"("scheduleId", "employeeId", "date", "shiftType");

-- CreateIndex
CREATE INDEX "ShiftCapacityRule_courtId_shiftType_idx" ON "ShiftCapacityRule"("courtId", "shiftType");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_systemRole_idx" ON "User"("systemRole");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_primaryCourtId_fkey" FOREIGN KEY ("primaryCourtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtEligibility" ADD CONSTRAINT "CourtEligibility_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SchedulingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
