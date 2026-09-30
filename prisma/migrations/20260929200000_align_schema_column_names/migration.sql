-- Align database identifiers with schema.prisma.
-- Earlier migrations renamed tables only; columns and several tables still used the previous names.

CREATE TYPE "FacilityRole" AS ENUM ('MANAGER');

CREATE TYPE "SystemRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "systemRole" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "systemRole" TYPE "SystemRole_new" USING (
  CASE "systemRole"::text
    WHEN 'ADMIN' THEN 'ADMIN'
    ELSE 'USER'
  END::"SystemRole_new"
);
ALTER TYPE "SystemRole" RENAME TO "SystemRole_old";
ALTER TYPE "SystemRole_new" RENAME TO "SystemRole";
DROP TYPE "SystemRole_old";
ALTER TABLE "User" ALTER COLUMN "systemRole" SET DEFAULT 'USER';

ALTER TABLE "UserDistrictRole" ADD COLUMN "role" "FacilityRole" NOT NULL DEFAULT 'MANAGER';
ALTER TABLE "UserDistrictRole" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "Facility" RENAME COLUMN "regionId" TO "districtId";
ALTER TABLE "Employee" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "Employee" RENAME COLUMN "positionId" TO "primaryShiftRoleId";
ALTER TABLE "Position" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "ShiftCapacity" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "ShiftCapacity" RENAME COLUMN "positionId" TO "shiftRoleId";
ALTER TABLE "SchedulePeriod" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "RosterVersion" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "ShiftAssignment" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "ShiftAssignment" RENAME COLUMN "positionId" TO "shiftRoleId";
ALTER TABLE "ScheduleWarning" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "ScheduleWarning" RENAME COLUMN "positionId" TO "shiftRoleId";
ALTER TABLE "UserDistrictRole" RENAME COLUMN "courtId" TO "facilityId";
ALTER TABLE "AvailabilityShift" RENAME COLUMN "formId" TO "submissionId";

DROP INDEX "WorkSchedule_status_idx";
DROP INDEX "WorkSchedule_courtId_status_idx";
ALTER TABLE "Roster" ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "Roster"
SET "archivedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP)
WHERE "status"::text = 'ARCHIVED';
ALTER TABLE "Roster" DROP COLUMN "publishedAt";
ALTER TABLE "Roster" DROP COLUMN "status";
ALTER TABLE "Roster" RENAME COLUMN "courtId" TO "facilityId";
DROP TYPE "ScheduleStatus";

DELETE FROM "ScheduleWarning" WHERE "versionId" IS NULL;
ALTER TABLE "ScheduleWarning" ALTER COLUMN "versionId" SET NOT NULL;
DELETE FROM "FairnessRecord" WHERE "versionId" IS NULL;
ALTER TABLE "FairnessRecord" ALTER COLUMN "versionId" SET NOT NULL;

ALTER TABLE "Position" RENAME TO "ShiftRole";
ALTER TABLE "ShiftCapacity" RENAME TO "StaffingRequirement";
ALTER TABLE "AvailabilityForm" RENAME TO "AvailabilitySubmission";
ALTER TABLE "AvailabilityShift" RENAME TO "ShiftAvailability";
ALTER TABLE "FairnessRecord" RENAME TO "EmployeeScheduleStats";
ALTER TABLE "SystemConfig" RENAME TO "SystemSetting";
ALTER TABLE "UserDistrictRole" RENAME TO "UserFacilityRole";

ALTER INDEX "Facility_regionId_idx" RENAME TO "Facility_districtId_idx";
ALTER INDEX "Employee_courtId_idx" RENAME TO "Employee_facilityId_idx";
ALTER INDEX "Employee_courtId_isActive_idx" RENAME TO "Employee_facilityId_isActive_idx";
ALTER INDEX "Employee_positionId_idx" RENAME TO "Employee_primaryShiftRoleId_idx";
ALTER INDEX "Employee_positionId_courtId_idx" RENAME TO "Employee_primaryShiftRoleId_facilityId_idx";
ALTER INDEX "Employee_id_courtId_key" RENAME TO "Employee_id_facilityId_key";
ALTER INDEX "Position_courtId_idx" RENAME TO "ShiftRole_facilityId_idx";
ALTER INDEX "Position_courtId_displayOrder_idx" RENAME TO "ShiftRole_facilityId_displayOrder_idx";
ALTER INDEX "Position_courtId_name_key" RENAME TO "ShiftRole_facilityId_name_key";
ALTER INDEX "Position_courtId_code_key" RENAME TO "ShiftRole_facilityId_code_key";
ALTER INDEX "Position_id_courtId_key" RENAME TO "ShiftRole_id_facilityId_key";
ALTER INDEX "ShiftCapacity_courtId_isActive_idx" RENAME TO "StaffingRequirement_facilityId_isActive_idx";
ALTER INDEX "ShiftCapacity_courtId_shiftType_dayCategory_idx" RENAME TO "StaffingRequirement_facilityId_shiftType_dayCategory_idx";
ALTER INDEX "ShiftCapacity_positionId_idx" RENAME TO "StaffingRequirement_shiftRoleId_idx";
ALTER INDEX "ShiftCapacity_positionId_courtId_idx" RENAME TO "StaffingRequirement_shiftRoleId_facilityId_idx";
ALTER INDEX "ShiftCapacity_courtId_displayOrder_idx" RENAME TO "StaffingRequirement_facilityId_displayOrder_idx";
ALTER INDEX "ShiftCapacity_courtId_positionId_shiftType_dayCategory_key" RENAME TO "StaffingRequirement_facilityId_shiftRoleId_shiftType_dayCategory_key";
ALTER INDEX "SchedulePeriod_courtId_idx" RENAME TO "SchedulePeriod_facilityId_idx";
ALTER INDEX "SchedulePeriod_courtId_endDate_idx" RENAME TO "SchedulePeriod_facilityId_endDate_idx";
ALTER INDEX "SchedulePeriod_courtId_startDate_endDate_idx" RENAME TO "SchedulePeriod_facilityId_startDate_endDate_idx";
ALTER INDEX "SchedulePeriod_id_courtId_key" RENAME TO "SchedulePeriod_id_facilityId_key";
ALTER INDEX "WorkSchedule_courtId_idx" RENAME TO "Roster_facilityId_idx";
ALTER INDEX "WorkSchedule_createdById_idx" RENAME TO "Roster_createdById_idx";
ALTER INDEX "WorkSchedule_periodId_key" RENAME TO "Roster_periodId_key";
ALTER INDEX "WorkSchedule_id_courtId_key" RENAME TO "Roster_id_facilityId_key";
ALTER INDEX "WorkSchedule_periodId_courtId_key" RENAME TO "Roster_periodId_facilityId_key";
CREATE INDEX "Roster_facilityId_archivedAt_idx" ON "Roster"("facilityId", "archivedAt");
ALTER INDEX "WorkScheduleVersion_courtId_idx" RENAME TO "RosterVersion_facilityId_idx";
ALTER INDEX "WorkScheduleVersion_id_scheduleId_courtId_key" RENAME TO "RosterVersion_id_scheduleId_facilityId_key";
ALTER INDEX "WorkScheduleVersion_isActive_idx" RENAME TO "RosterVersion_isActive_idx";
ALTER INDEX "WorkScheduleVersion_scheduleId_idx" RENAME TO "RosterVersion_scheduleId_idx";
ALTER INDEX "WorkScheduleVersion_scheduleId_status_isActive_version_idx" RENAME TO "RosterVersion_scheduleId_status_isActive_version_idx";
ALTER INDEX "WorkScheduleVersion_scheduleId_version_key" RENAME TO "RosterVersion_scheduleId_version_key";
ALTER INDEX "WorkScheduleVersion_status_idx" RENAME TO "RosterVersion_status_idx";
ALTER INDEX "ScheduleWarning_courtId_date_idx" RENAME TO "ScheduleWarning_facilityId_date_idx";
ALTER INDEX "ScheduleWarning_positionId_date_idx" RENAME TO "ScheduleWarning_shiftRoleId_date_idx";
ALTER INDEX "ShiftAssignment_versionId_date_shiftType_positionId_idx" RENAME TO "ShiftAssignment_versionId_date_shiftType_shiftRoleId_idx";
ALTER INDEX "ShiftAssignment_scheduleId_courtId_idx" RENAME TO "ShiftAssignment_scheduleId_facilityId_idx";
ALTER INDEX "ShiftAssignment_employeeId_courtId_idx" RENAME TO "ShiftAssignment_employeeId_facilityId_idx";
ALTER INDEX "ShiftAssignment_positionId_courtId_idx" RENAME TO "ShiftAssignment_shiftRoleId_facilityId_idx";
ALTER INDEX "ShiftAssignment_courtId_date_idx" RENAME TO "ShiftAssignment_facilityId_date_idx";
ALTER INDEX "ShiftAssignment_positionId_idx" RENAME TO "ShiftAssignment_shiftRoleId_idx";
ALTER INDEX "AvailabilityForm_employeeId_idx" RENAME TO "AvailabilitySubmission_employeeId_idx";
ALTER INDEX "AvailabilityForm_periodId_idx" RENAME TO "AvailabilitySubmission_periodId_idx";
ALTER INDEX "AvailabilityForm_periodId_employeeId_key" RENAME TO "AvailabilitySubmission_periodId_employeeId_key";
ALTER INDEX "AvailabilityShift_date_shiftType_idx" RENAME TO "ShiftAvailability_date_shiftType_idx";
ALTER INDEX "AvailabilityShift_formId_date_shiftType_key" RENAME TO "ShiftAvailability_submissionId_date_shiftType_key";
ALTER INDEX "FairnessRecord_versionId_idx" RENAME TO "EmployeeScheduleStats_versionId_idx";
ALTER INDEX "FairnessRecord_scheduleId_idx" RENAME TO "EmployeeScheduleStats_scheduleId_idx";
ALTER INDEX "FairnessRecord_employeeId_versionId_key" RENAME TO "EmployeeScheduleStats_employeeId_versionId_key";
ALTER INDEX "UserDistrictRole_courtId_idx" RENAME TO "UserFacilityRole_facilityId_idx";

ALTER TABLE "Facility" RENAME CONSTRAINT "Facility_regionId_fkey" TO "Facility_districtId_fkey";
ALTER TABLE "Employee" RENAME CONSTRAINT "Employee_courtId_fkey" TO "Employee_facilityId_fkey";
ALTER TABLE "Employee" RENAME CONSTRAINT "Employee_positionId_courtId_fkey" TO "Employee_primaryShiftRoleId_facilityId_fkey";
ALTER TABLE "ShiftRole" RENAME CONSTRAINT "Position_pkey" TO "ShiftRole_pkey";
ALTER TABLE "ShiftRole" RENAME CONSTRAINT "Position_courtId_fkey" TO "ShiftRole_facilityId_fkey";
ALTER TABLE "StaffingRequirement" RENAME CONSTRAINT "ShiftCapacity_pkey" TO "StaffingRequirement_pkey";
ALTER TABLE "StaffingRequirement" RENAME CONSTRAINT "ShiftCapacity_courtId_fkey" TO "StaffingRequirement_facilityId_fkey";
ALTER TABLE "StaffingRequirement" RENAME CONSTRAINT "ShiftCapacity_positionId_courtId_fkey" TO "StaffingRequirement_shiftRoleId_facilityId_fkey";
ALTER TABLE "AvailabilitySubmission" RENAME CONSTRAINT "AvailabilityForm_pkey" TO "AvailabilitySubmission_pkey";
ALTER TABLE "AvailabilitySubmission" RENAME CONSTRAINT "AvailabilityForm_periodId_fkey" TO "AvailabilitySubmission_periodId_fkey";
ALTER TABLE "AvailabilitySubmission" RENAME CONSTRAINT "AvailabilityForm_employeeId_fkey" TO "AvailabilitySubmission_employeeId_fkey";
ALTER TABLE "ShiftAvailability" RENAME CONSTRAINT "AvailabilityShift_pkey" TO "ShiftAvailability_pkey";
ALTER TABLE "ShiftAvailability" RENAME CONSTRAINT "AvailabilityShift_formId_fkey" TO "ShiftAvailability_submissionId_fkey";
ALTER TABLE "SchedulePeriod" RENAME CONSTRAINT "SchedulePeriod_courtId_fkey" TO "SchedulePeriod_facilityId_fkey";
ALTER TABLE "Roster" RENAME CONSTRAINT "WorkSchedule_pkey" TO "Roster_pkey";
ALTER TABLE "Roster" RENAME CONSTRAINT "WorkSchedule_courtId_fkey" TO "Roster_facilityId_fkey";
ALTER TABLE "Roster" RENAME CONSTRAINT "WorkSchedule_periodId_courtId_fkey" TO "Roster_periodId_facilityId_fkey";
ALTER TABLE "Roster" RENAME CONSTRAINT "WorkSchedule_createdById_fkey" TO "Roster_createdById_fkey";
ALTER TABLE "RosterVersion" RENAME CONSTRAINT "WorkScheduleVersion_pkey" TO "RosterVersion_pkey";
ALTER TABLE "RosterVersion" RENAME CONSTRAINT "WorkScheduleVersion_scheduleId_courtId_fkey" TO "RosterVersion_scheduleId_facilityId_fkey";
ALTER TABLE "RosterVersion" RENAME CONSTRAINT "WorkScheduleVersion_courtId_fkey" TO "RosterVersion_facilityId_fkey";
ALTER TABLE "RosterVersion" RENAME CONSTRAINT "WorkScheduleVersion_createdById_fkey" TO "RosterVersion_createdById_fkey";
ALTER TABLE "ShiftAssignment" RENAME CONSTRAINT "ShiftAssignment_scheduleId_courtId_fkey" TO "ShiftAssignment_scheduleId_facilityId_fkey";
ALTER TABLE "ShiftAssignment" RENAME CONSTRAINT "ShiftAssignment_versionId_scheduleId_courtId_fkey" TO "ShiftAssignment_versionId_scheduleId_facilityId_fkey";
ALTER TABLE "ShiftAssignment" RENAME CONSTRAINT "ShiftAssignment_employeeId_courtId_fkey" TO "ShiftAssignment_employeeId_facilityId_fkey";
ALTER TABLE "ShiftAssignment" RENAME CONSTRAINT "ShiftAssignment_courtId_fkey" TO "ShiftAssignment_facilityId_fkey";
ALTER TABLE "ShiftAssignment" RENAME CONSTRAINT "ShiftAssignment_positionId_courtId_fkey" TO "ShiftAssignment_shiftRoleId_facilityId_fkey";
ALTER TABLE "ScheduleWarning" RENAME CONSTRAINT "ScheduleWarning_courtId_fkey" TO "ScheduleWarning_facilityId_fkey";
ALTER TABLE "ScheduleWarning" RENAME CONSTRAINT "ScheduleWarning_positionId_fkey" TO "ScheduleWarning_shiftRoleId_fkey";
ALTER TABLE "EmployeeScheduleStats" RENAME CONSTRAINT "FairnessRecord_pkey" TO "EmployeeScheduleStats_pkey";
ALTER TABLE "EmployeeScheduleStats" RENAME CONSTRAINT "FairnessRecord_employeeId_fkey" TO "EmployeeScheduleStats_employeeId_fkey";
ALTER TABLE "EmployeeScheduleStats" RENAME CONSTRAINT "FairnessRecord_scheduleId_fkey" TO "EmployeeScheduleStats_scheduleId_fkey";
ALTER TABLE "EmployeeScheduleStats" RENAME CONSTRAINT "FairnessRecord_versionId_fkey" TO "EmployeeScheduleStats_versionId_fkey";
ALTER TABLE "SystemSetting" RENAME CONSTRAINT "SystemConfig_pkey" TO "SystemSetting_pkey";
ALTER TABLE "UserFacilityRole" RENAME CONSTRAINT "UserDistrictRole_pkey" TO "UserFacilityRole_pkey";
ALTER TABLE "UserFacilityRole" RENAME CONSTRAINT "UserDistrictRole_userId_fkey" TO "UserFacilityRole_userId_fkey";
ALTER TABLE "UserFacilityRole" RENAME CONSTRAINT "UserDistrictRole_courtId_fkey" TO "UserFacilityRole_facilityId_fkey";

CREATE OR REPLACE FUNCTION app_private.schedule_court_id(schedule_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT "facilityId" FROM "Roster" WHERE "id" = schedule_id
$$;

CREATE OR REPLACE FUNCTION app_private.period_court_id(period_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT "facilityId" FROM "SchedulePeriod" WHERE "id" = period_id
$$;

CREATE OR REPLACE FUNCTION app_private.form_court_id(form_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT p."facilityId"
  FROM "AvailabilitySubmission" f
  JOIN "SchedulePeriod" p ON p."id" = f."periodId"
  WHERE f."id" = form_id
$$;

CREATE OR REPLACE FUNCTION app_private.form_employee_id(form_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT "employeeId" FROM "AvailabilitySubmission" WHERE "id" = form_id
$$;

CREATE OR REPLACE FUNCTION protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status = 'PUBLISHED' OR OLD."publishedAt" IS NOT NULL THEN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Published history cannot be deleted'; END IF;
  IF (to_jsonb(OLD) - 'isActive' - 'updatedAt') IS DISTINCT FROM (to_jsonb(NEW) - 'isActive' - 'updatedAt') OR (NOT OLD."isActive" AND NEW."isActive") THEN
   RAISE EXCEPTION 'Published version metadata is immutable';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
