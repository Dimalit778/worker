/*
  Warnings:

  - You are about to drop the column `employeeCode` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `employeeNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ShiftCapacityRule` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[scheduleId,employeeId,date,shiftType,position,slotIndex]` on the table `ShiftAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `position` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotIndex` to the `ShiftAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DayCategory" AS ENUM ('WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY');

-- DropForeignKey
ALTER TABLE "ShiftCapacityRule" DROP CONSTRAINT "ShiftCapacityRule_courtId_fkey";

-- DropIndex
DROP INDEX "Court_regionId_idx";

-- DropIndex
DROP INDEX "Employee_employeeCode_key";

-- DropIndex
DROP INDEX "ShiftAssignment_scheduleId_employeeId_date_shiftType_key";

-- DropIndex
DROP INDEX "User_employeeNumber_key";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "employeeCode";

-- AlterTable
ALTER TABLE "ShiftAssignment" ADD COLUMN     "position" "Position" NOT NULL,
ADD COLUMN     "slotIndex" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "employeeNumber";

-- DropTable
DROP TABLE "ShiftCapacityRule";

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

-- CreateIndex
CREATE INDEX "CourtShiftRule_courtId_shiftType_dayCategory_displayOrder_idx" ON "CourtShiftRule"("courtId", "shiftType", "dayCategory", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourtShiftRule_courtId_shiftType_dayCategory_position_key" ON "CourtShiftRule"("courtId", "shiftType", "dayCategory", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_scheduleId_employeeId_date_shiftType_positi_key" ON "ShiftAssignment"("scheduleId", "employeeId", "date", "shiftType", "position", "slotIndex");

-- AddForeignKey
ALTER TABLE "CourtShiftRule" ADD CONSTRAINT "CourtShiftRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
