/*
  Warnings:

  - You are about to drop the column `periodId` on the `AvailabilitySubmission` table. All the data in the column will be lost.
  - You are about to drop the column `periodId` on the `FairnessRecord` table. All the data in the column will be lost.
  - You are about to drop the column `generatedById` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `periodId` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the `SchedulePeriod` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[scheduleId,employeeId]` on the table `AvailabilitySubmission` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[employeeId,scheduleId]` on the table `FairnessRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `scheduleId` to the `AvailabilitySubmission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduleId` to the `FairnessRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `courtId` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `submissionDeadline` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScheduleStatus" ADD VALUE 'OPEN_FOR_SUBMISSION';
ALTER TYPE "ScheduleStatus" ADD VALUE 'LOCKED';

-- DropForeignKey
ALTER TABLE "AvailabilitySubmission" DROP CONSTRAINT "AvailabilitySubmission_periodId_fkey";

-- DropForeignKey
ALTER TABLE "FairnessRecord" DROP CONSTRAINT "FairnessRecord_periodId_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_generatedById_fkey";

-- DropForeignKey
ALTER TABLE "Schedule" DROP CONSTRAINT "Schedule_periodId_fkey";

-- DropForeignKey
ALTER TABLE "SchedulePeriod" DROP CONSTRAINT "SchedulePeriod_courtId_fkey";

-- DropForeignKey
ALTER TABLE "SchedulePeriod" DROP CONSTRAINT "SchedulePeriod_createdById_fkey";

-- DropIndex
DROP INDEX "AvailabilitySubmission_periodId_employeeId_key";

-- DropIndex
DROP INDEX "FairnessRecord_employeeId_periodId_key";

-- DropIndex
DROP INDEX "FairnessRecord_periodId_idx";

-- DropIndex
DROP INDEX "Schedule_periodId_key";

-- AlterTable
ALTER TABLE "AvailabilitySubmission" DROP COLUMN "periodId",
ADD COLUMN     "scheduleId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FairnessRecord" DROP COLUMN "periodId",
ADD COLUMN     "scheduleId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "generatedById",
DROP COLUMN "periodId",
ADD COLUMN     "courtId" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL,
ADD COLUMN     "submissionDeadline" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "SchedulePeriod";

-- DropEnum
DROP TYPE "PeriodStatus";

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySubmission_scheduleId_employeeId_key" ON "AvailabilitySubmission"("scheduleId", "employeeId");

-- CreateIndex
CREATE INDEX "FairnessRecord_scheduleId_idx" ON "FairnessRecord"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "FairnessRecord_employeeId_scheduleId_key" ON "FairnessRecord"("employeeId", "scheduleId");

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairnessRecord" ADD CONSTRAINT "FairnessRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
