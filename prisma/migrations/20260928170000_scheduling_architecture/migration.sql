CREATE TYPE "Capability" AS ENUM ('GUARD', 'CONTROLLER', 'SHIFT_MANAGER');
CREATE TYPE "AvailabilityPreference" AS ENUM ('AVAILABLE', 'PREFERRED', 'UNAVAILABLE');
CREATE TYPE "SubmissionState" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED');
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TABLE "UserCourtRole" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "courtId" TEXT NOT NULL REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "courtId")
);
CREATE INDEX "UserCourtRole_courtId_idx" ON "UserCourtRole"("courtId");
INSERT INTO "UserCourtRole" SELECT u.id, e."courtId" FROM "User" u JOIN "Employee" e ON e.id=u."employeeId" WHERE u."systemRole"='MANAGER';
ALTER TABLE "Employee" ADD COLUMN "capability" "Capability" NOT NULL DEFAULT 'GUARD';
ALTER TABLE "Position" ADD COLUMN "requiredCapability" "Capability" NOT NULL DEFAULT 'GUARD';
-- One-time mapping of existing fixture codes; runtime never interprets display names.
UPDATE "Position" SET "requiredCapability"=CASE WHEN code IN (1,2) THEN 'SHIFT_MANAGER'::"Capability" WHEN code=3 THEN 'CONTROLLER'::"Capability" ELSE 'GUARD'::"Capability" END;
UPDATE "Employee" e SET capability=p."requiredCapability" FROM "Position" p WHERE p.id=e."positionId";
ALTER TABLE "AvailabilityShift" ADD COLUMN "preference" "AvailabilityPreference" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "SchedulePeriod" ADD COLUMN "submissionState" "SubmissionState" NOT NULL DEFAULT 'SCHEDULED';
UPDATE "SchedulePeriod" p SET "submissionState"=CASE WHEN s.status='OPEN' THEN 'OPEN'::"SubmissionState" WHEN s.status IN ('LOCKED','PUBLISHED','ARCHIVED') THEN 'CLOSED'::"SubmissionState" ELSE 'SCHEDULED'::"SubmissionState" END FROM "WorkSchedule" s WHERE s."periodId"=p.id;
ALTER TABLE "WorkScheduleVersion" ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "WorkScheduleVersion_id_scheduleId_courtId_key" ON "WorkScheduleVersion"(id,"scheduleId","courtId");
-- Retain the newest draft/current publication when normalizing old demo data.
UPDATE "WorkScheduleVersion" v SET status='ARCHIVED', "isActive"=false WHERE status='DRAFT' AND EXISTS (SELECT 1 FROM "WorkScheduleVersion" n WHERE n."scheduleId"=v."scheduleId" AND n.status='DRAFT' AND n.version>v.version);
UPDATE "WorkScheduleVersion" SET "isActive"=false WHERE status<>'PUBLISHED';
UPDATE "WorkScheduleVersion" v SET "isActive"=false WHERE "isActive" AND EXISTS (SELECT 1 FROM "WorkScheduleVersion" n WHERE n."scheduleId"=v."scheduleId" AND n."isActive" AND n.version>v.version);
CREATE UNIQUE INDEX "one_draft_per_schedule" ON "WorkScheduleVersion"("scheduleId") WHERE status='DRAFT';
CREATE UNIQUE INDEX "one_current_publication" ON "WorkScheduleVersion"("scheduleId") WHERE "isActive";
ALTER TABLE "ShiftAssignment" ADD COLUMN source "AssignmentSource" NOT NULL DEFAULT 'MANUAL', ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT "ShiftAssignment_versionId_fkey";
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_versionId_scheduleId_courtId_fkey" FOREIGN KEY ("versionId","scheduleId","courtId") REFERENCES "WorkScheduleVersion"(id,"scheduleId","courtId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleWarning" ADD COLUMN "versionId" TEXT REFERENCES "WorkScheduleVersion"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FairnessRecord" ADD COLUMN "versionId" TEXT REFERENCES "WorkScheduleVersion"(id) ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "FairnessRecord_employeeId_scheduleId_key";
CREATE UNIQUE INDEX "FairnessRecord_employeeId_versionId_key" ON "FairnessRecord"("employeeId","versionId");
-- Old analyses are disposable caches and cannot reliably be attributed to a version.
DELETE FROM "FairnessRecord";
DELETE FROM "ScheduleWarning";
ALTER TABLE "ShiftCapacity" ADD CONSTRAINT "capacity_nonnegative" CHECK ("requiredCount">=0);
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "period_date_order" CHECK ("startDate"<="endDate");
-- Protect history even when a parent deletion cascades.
CREATE FUNCTION protect_published_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM "WorkScheduleVersion" WHERE id=OLD."versionId" AND status<>'DRAFT') THEN
  RAISE EXCEPTION 'Published assignments are immutable';
 END IF;
 IF TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM "WorkScheduleVersion" WHERE id=NEW."versionId" AND status<>'DRAFT') THEN
  RAISE EXCEPTION 'Published assignments are immutable';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_published_assignments BEFORE INSERT OR UPDATE OR DELETE ON "ShiftAssignment" FOR EACH ROW EXECUTE FUNCTION protect_published_assignments();
CREATE FUNCTION protect_published_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='PUBLISHED' OR OLD."publishedAt" IS NOT NULL THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Published history cannot be deleted'; END IF;
  -- Republish may deactivate the former current version, never change its content/identity.
  IF (to_jsonb(OLD) - 'isActive' - 'updatedAt') IS DISTINCT FROM (to_jsonb(NEW) - 'isActive' - 'updatedAt') OR (NOT OLD."isActive" AND NEW."isActive") THEN
   RAISE EXCEPTION 'Published version metadata is immutable';
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER retain_published_versions BEFORE UPDATE OR DELETE ON "WorkScheduleVersion" FOR EACH ROW EXECUTE FUNCTION protect_published_version();
CREATE FUNCTION protect_schedule_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- FK SET NULL may detach a deleted draft assignment/version; snapshot content must survive.
 IF TG_OP='UPDATE' AND (to_jsonb(OLD) - 'shiftAssignmentId' - 'versionId') = (to_jsonb(NEW) - 'shiftAssignmentId' - 'versionId')
   AND (NEW."shiftAssignmentId" IS NULL OR NEW."shiftAssignmentId" IS NOT DISTINCT FROM OLD."shiftAssignmentId")
   AND (NEW."versionId" IS NULL OR NEW."versionId" IS NOT DISTINCT FROM OLD."versionId") THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Audit history is append-only';
END $$;
CREATE TRIGGER retain_audit BEFORE DELETE OR UPDATE ON "ScheduleChangeLog" FOR EACH ROW EXECUTE FUNCTION protect_schedule_audit();
