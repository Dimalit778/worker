BEGIN;
LOCK TABLE "Schedule", "ScheduleSlot", "ScheduleChange" IN ACCESS EXCLUSIVE MODE;

-- DropIndex
DROP INDEX "ScheduleSlot_scheduleId_date_shiftType_positionId_slotNumbe_key";

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "draftVersionId" TEXT,
ADD COLUMN     "publishedVersionId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "versionId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleChange" ADD COLUMN     "versionId" TEXT;

-- CreateTable
CREATE TABLE "ScheduleVersion" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capacitySnapshot" JSONB,

    CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- Keep all existing slot IDs, submissions, audit rows, and the revision token.
INSERT INTO "ScheduleVersion" ("id", "scheduleId", "facilityId", "number", "revision", "status", "publishedAt", "createdAt", "capacitySnapshot")
SELECT s."id" || '-v1', s."id", s."facilityId", 1, s."revision", s."status", s."publishedAt", s."createdAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', r."id", 'positionId', r."positionId", 'displayName', p."name", 'color', p."color",
    'rank', COALESCE(p."requiredRank", role."rank", p."displayOrder"),
    'shiftType', r."shiftType", 'dayCategory', r."dayCategory", 'amount', r."requiredCount"
  ) ORDER BY r."id") FROM "StaffingRequirement" r JOIN "Position" p ON p."id" = r."positionId"
    LEFT JOIN "Role" role ON role."id" = p."baseRoleId"
    WHERE r."facilityId" = s."facilityId" AND p."isActive"
      AND COALESCE(p."requiredRank", role."rank", p."displayOrder") <> 1), '[]'::jsonb)
FROM "Schedule" s;
UPDATE "ScheduleSlot" SET "versionId" = "scheduleId" || '-v1';
UPDATE "ScheduleChange" SET "versionId" = "scheduleId" || '-v1';
UPDATE "Schedule" SET
  "draftVersionId" = CASE WHEN "status" = 'DRAFT' THEN "id" || '-v1' END,
  "publishedVersionId" = CASE WHEN "status" = 'PUBLISHED' OR ("status" = 'ARCHIVED' AND "publishedAt" IS NOT NULL) THEN "id" || '-v1' END;
ALTER TABLE "ScheduleSlot" ALTER COLUMN "versionId" SET NOT NULL;
ALTER TABLE "Schedule" DROP COLUMN "revision";

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_id_scheduleId_facilityId_key" ON "ScheduleVersion"("id", "scheduleId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_scheduleId_number_key" ON "ScheduleVersion"("scheduleId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_draftVersionId_key" ON "Schedule"("draftVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_publishedVersionId_key" ON "Schedule"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_draftVersionId_id_facilityId_key" ON "Schedule"("draftVersionId", "id", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_publishedVersionId_id_facilityId_key" ON "Schedule"("publishedVersionId", "id", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSlot_versionId_date_shiftType_positionId_slotNumber_key" ON "ScheduleSlot"("versionId", "date", "shiftType", "positionId", "slotNumber");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_draftVersionId_id_facilityId_fkey" FOREIGN KEY ("draftVersionId", "id", "facilityId") REFERENCES "ScheduleVersion"("id", "scheduleId", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_publishedVersionId_id_facilityId_fkey" FOREIGN KEY ("publishedVersionId", "id", "facilityId") REFERENCES "ScheduleVersion"("id", "scheduleId", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_scheduleId_facilityId_fkey" FOREIGN KEY ("scheduleId", "facilityId") REFERENCES "Schedule"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_versionId_scheduleId_facilityId_fkey" FOREIGN KEY ("versionId", "scheduleId", "facilityId") REFERENCES "ScheduleVersion"("id", "scheduleId", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChange" ADD CONSTRAINT "ScheduleChange_versionId_scheduleId_facilityId_fkey" FOREIGN KEY ("versionId", "scheduleId", "facilityId") REFERENCES "ScheduleVersion"("id", "scheduleId", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A schedule has at most one editing draft, including during concurrent requests.
CREATE UNIQUE INDEX "ScheduleVersion_one_draft" ON "ScheduleVersion" ("scheduleId") WHERE "status" = 'DRAFT';

-- Published snapshots cannot be changed or deleted through another write path.
CREATE FUNCTION protect_schedule_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Published schedule versions are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW."scheduleId" <> OLD."scheduleId" OR NEW."facilityId" <> OLD."facilityId" OR NEW."number" <> OLD."number" THEN
    RAISE EXCEPTION 'Schedule version identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_schedule_version BEFORE UPDATE OR DELETE ON "ScheduleVersion"
FOR EACH ROW EXECUTE FUNCTION protect_schedule_version();

CREATE FUNCTION protect_schedule_slot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_status "ScheduleStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT "status" INTO version_status FROM "ScheduleVersion" WHERE "id" = OLD."versionId" FOR SHARE;
    IF version_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published schedule slots are immutable'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT "status" INTO version_status FROM "ScheduleVersion" WHERE "id" = NEW."versionId" FOR SHARE;
    IF version_status <> 'DRAFT' THEN RAISE EXCEPTION 'Published schedule slots are immutable'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER protect_schedule_slot BEFORE INSERT OR UPDATE OR DELETE ON "ScheduleSlot"
FOR EACH ROW EXECUTE FUNCTION protect_schedule_slot();

COMMIT;
