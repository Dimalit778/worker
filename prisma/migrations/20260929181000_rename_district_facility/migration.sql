ALTER TABLE "Region" RENAME TO "District";
ALTER TABLE "Court" RENAME TO "Facility";
ALTER TABLE "UserCourtRole" RENAME TO "UserDistrictRole";

ALTER TABLE "District" RENAME CONSTRAINT "Region_pkey" TO "District_pkey";
ALTER INDEX "Region_code_key" RENAME TO "District_code_key";

ALTER TABLE "Facility" RENAME CONSTRAINT "Court_pkey" TO "Facility_pkey";
ALTER INDEX "Court_code_key" RENAME TO "Facility_code_key";
ALTER INDEX "Court_regionId_idx" RENAME TO "Facility_regionId_idx";
ALTER TABLE "Facility" RENAME CONSTRAINT "Court_regionId_fkey" TO "Facility_regionId_fkey";

ALTER TABLE "UserDistrictRole" RENAME CONSTRAINT "UserCourtRole_pkey" TO "UserDistrictRole_pkey";
ALTER TABLE "UserDistrictRole" RENAME CONSTRAINT "UserCourtRole_userId_fkey" TO "UserDistrictRole_userId_fkey";
ALTER TABLE "UserDistrictRole" RENAME CONSTRAINT "UserCourtRole_courtId_fkey" TO "UserDistrictRole_courtId_fkey";
ALTER INDEX "UserCourtRole_courtId_idx" RENAME TO "UserDistrictRole_courtId_idx";

ALTER POLICY "Court_read_own_or_admin" ON "Facility" RENAME TO "Facility_read_own_or_admin";
ALTER POLICY "Court_admin_write" ON "Facility" RENAME TO "Facility_admin_write";
