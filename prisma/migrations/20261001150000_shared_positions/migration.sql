-- Preserve existing schedules and requirements while sharing base positions.
-- Different local settings for the same base role require explicit resolution;
-- abort rather than silently choose one facility's settings.
BEGIN;
LOCK TABLE "FacilityPosition", "StaffingRequirement", "ScheduleSlot" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT "baseRole" FROM "FacilityPosition"
    WHERE "baseRole" IS NOT NULL
    GROUP BY "baseRole"
    HAVING count(DISTINCT ROW("name", "requiredRank", "isActive", "displayOrder", "color")) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot merge base positions with differing settings. Resolve name/rank/active/order/color differences per baseRole before retrying.';
  END IF;
END $$;

-- Capture ownership BEFORE turning base positions into global rows.
ALTER TABLE "StaffingRequirement" ADD COLUMN "facilityId" TEXT;
UPDATE "StaffingRequirement" r SET "facilityId" = p."facilityId"
FROM "FacilityPosition" p WHERE p."id" = r."positionId";
ALTER TABLE "StaffingRequirement" ALTER COLUMN "facilityId" SET NOT NULL;
DROP INDEX "StaffingRequirement_positionId_shiftType_dayCategory_key";
CREATE UNIQUE INDEX "StaffingRequirement_facilityId_positionId_shiftType_dayCate_key"
  ON "StaffingRequirement" ("facilityId", "positionId", "shiftType", "dayCategory");
CREATE INDEX "StaffingRequirement_positionId_idx" ON "StaffingRequirement" ("positionId");
ALTER TABLE "StaffingRequirement" ADD CONSTRAINT "StaffingRequirement_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TEMP TABLE position_merge_map ON COMMIT DROP AS
SELECT "id" AS old_id,
  first_value("id") OVER (PARTITION BY "baseRole" ORDER BY "createdAt", "id") AS canonical_id
FROM "FacilityPosition" WHERE "baseRole" IS NOT NULL;

ALTER TABLE "ScheduleSlot" DROP CONSTRAINT "ScheduleSlot_positionId_facilityId_fkey";
UPDATE "ScheduleSlot" s SET "positionId" = m.canonical_id
FROM position_merge_map m WHERE s."positionId" = m.old_id AND m.old_id <> m.canonical_id;
UPDATE "StaffingRequirement" r SET "positionId" = m.canonical_id
FROM position_merge_map m WHERE r."positionId" = m.old_id AND m.old_id <> m.canonical_id;
DELETE FROM "FacilityPosition" p USING position_merge_map m
WHERE p."id" = m.old_id AND m.old_id <> m.canonical_id;

ALTER TABLE "FacilityPosition" RENAME TO "Position";
ALTER TABLE "Position" RENAME CONSTRAINT "FacilityPosition_pkey" TO "Position_pkey";
ALTER TABLE "Position" RENAME CONSTRAINT "FacilityPosition_facilityId_fkey" TO "Position_facilityId_fkey";
DROP INDEX "FacilityPosition_id_facilityId_key";
DROP INDEX "FacilityPosition_facilityId_baseRole_key";
ALTER INDEX "FacilityPosition_facilityId_name_key" RENAME TO "Position_facilityId_name_key";
ALTER INDEX "FacilityPosition_facilityId_isActive_displayOrder_idx" RENAME TO "Position_facilityId_isActive_displayOrder_idx";
ALTER TABLE "Position" ALTER COLUMN "facilityId" DROP NOT NULL;
UPDATE "Position" SET "facilityId" = NULL WHERE "baseRole" IS NOT NULL;
CREATE UNIQUE INDEX "Position_baseRole_key" ON "Position"("baseRole");
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express global-or-local ownership with a foreign key alone.
ALTER TABLE "Position" ADD CONSTRAINT "Position_scope_check" CHECK (
  ("baseRole" IS NOT NULL AND "facilityId" IS NULL) OR
  ("baseRole" IS NULL AND "facilityId" IS NOT NULL)
);

CREATE FUNCTION enforce_position_facility_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id TEXT;
BEGIN
  SELECT "facilityId" INTO owner_id FROM "Position" WHERE "id" = NEW."positionId" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Position does not exist' USING ERRCODE = '23503';
  END IF;
  IF owner_id IS NOT NULL AND owner_id <> NEW."facilityId" THEN
    RAISE EXCEPTION 'Position belongs to another facility' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "ScheduleSlot_position_scope"
BEFORE INSERT OR UPDATE OF "positionId", "facilityId" ON "ScheduleSlot"
FOR EACH ROW EXECUTE FUNCTION enforce_position_facility_scope();
CREATE TRIGGER "StaffingRequirement_position_scope"
BEFORE INSERT OR UPDATE OF "positionId", "facilityId" ON "StaffingRequirement"
FOR EACH ROW EXECUTE FUNCTION enforce_position_facility_scope();

-- Changing ownership later could invalidate existing references. Create a new
-- position instead; this also prevents concurrent cross-facility reassignment.
CREATE FUNCTION prevent_position_scope_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."facilityId" IS DISTINCT FROM OLD."facilityId"
     OR NEW."baseRole" IS DISTINCT FROM OLD."baseRole" THEN
    RAISE EXCEPTION 'Position ownership and base role are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Position_immutable_scope"
BEFORE UPDATE OF "facilityId", "baseRole" ON "Position"
FOR EACH ROW EXECUTE FUNCTION prevent_position_scope_change();
COMMIT;
