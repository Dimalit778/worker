/*
  Warnings:

  - You are about to drop the `CourtShiftRoleAllowedPosition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourtShiftRoleAllowedPosition" DROP CONSTRAINT "CourtShiftRoleAllowedPosition_courtShiftRoleId_fkey";

-- DropTable
DROP TABLE "CourtShiftRoleAllowedPosition";
