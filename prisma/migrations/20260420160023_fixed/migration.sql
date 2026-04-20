/*
  Warnings:

  - You are about to drop the column `districtId` on the `Court` table. All the data in the column will be lost.
  - You are about to drop the `District` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `regionId` to the `Court` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Court" DROP CONSTRAINT "Court_districtId_fkey";

-- DropIndex
DROP INDEX "Court_districtId_idx";

-- AlterTable
ALTER TABLE "Court" DROP COLUMN "districtId",
ADD COLUMN     "regionId" TEXT NOT NULL;

-- DropTable
DROP TABLE "District";

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Court_regionId_idx" ON "Court"("regionId");

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
