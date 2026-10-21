BEGIN;
LOCK TABLE "Schedule", "ScheduleVersion", "ScheduleSlot" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "Schedule" ADD COLUMN "originalVersionId" TEXT;
CREATE UNIQUE INDEX "Schedule_originalVersionId_key" ON "Schedule"("originalVersionId");
CREATE UNIQUE INDEX "Schedule_originalVersionId_id_facilityId_key" ON "Schedule"("originalVersionId", "id", "facilityId");
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_originalVersionId_id_facilityId_fkey"
  FOREIGN KEY ("originalVersionId", "id", "facilityId") REFERENCES "ScheduleVersion"("id", "scheduleId", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the earliest retained publication, without deleting any legacy version,
-- audit row, request or live slot. Number 0 is reserved for the original snapshot.
-- The table lock keeps other writers out while this one-time copy is made.
ALTER TABLE "ScheduleSlot" DISABLE TRIGGER protect_schedule_slot;
INSERT INTO "ScheduleVersion" (id, "scheduleId", "facilityId", number, revision, status, "publishedAt", "createdAt", "capacitySnapshot")
SELECT s.id || '-original', s.id, s."facilityId", 0, v.revision, 'PUBLISHED', v."publishedAt", v."createdAt", v."capacitySnapshot"
FROM "Schedule" s
JOIN LATERAL (
  SELECT * FROM "ScheduleVersion" WHERE "scheduleId" = s.id AND "publishedAt" IS NOT NULL AND status <> 'DRAFT'
  ORDER BY "publishedAt", number LIMIT 1
) v ON true;
INSERT INTO "ScheduleSlot" (id, "facilityId", "scheduleId", "versionId", "positionId", date, "shiftType", "slotNumber", "startsAt", "endsAt", "userId", source, "isLocked", note, "createdAt", "updatedAt")
SELECT a.id || '-original', a."facilityId", a."scheduleId", s.id || '-original', a."positionId", a.date, a."shiftType", a."slotNumber", a."startsAt", a."endsAt", a."userId", a.source, a."isLocked", a.note, a."createdAt", a."updatedAt"
FROM "Schedule" s
JOIN LATERAL (
  SELECT id FROM "ScheduleVersion" WHERE "scheduleId" = s.id AND number <> 0 AND "publishedAt" IS NOT NULL AND status <> 'DRAFT'
  ORDER BY "publishedAt", number LIMIT 1
) v ON true
JOIN "ScheduleSlot" a ON a."versionId" = v.id;
UPDATE "Schedule" s SET "originalVersionId" = s.id || '-original'
WHERE EXISTS (SELECT 1 FROM "ScheduleVersion" v WHERE v.id = s.id || '-original');
ALTER TABLE "ScheduleSlot" ENABLE TRIGGER protect_schedule_slot;

CREATE OR REPLACE FUNCTION protect_schedule_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'DRAFT' THEN
    IF TG_OP = 'DELETE' OR NOT EXISTS (
      SELECT 1 FROM "Schedule" s WHERE s.id = OLD."scheduleId" AND s.status = 'PUBLISHED'
        AND s."publishedVersionId" = OLD.id AND s."originalVersionId" IS NOT NULL AND s."originalVersionId" <> OLD.id
    ) THEN RAISE EXCEPTION 'Original and historical schedule versions are immutable'; END IF;
    IF NEW.status <> OLD.status OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" OR NEW."capacitySnapshot" IS DISTINCT FROM OLD."capacitySnapshot" THEN
      RAISE EXCEPTION 'Published schedule metadata is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.id <> OLD.id OR NEW."scheduleId" <> OLD."scheduleId" OR NEW."facilityId" <> OLD."facilityId" OR NEW.number <> OLD.number THEN
    RAISE EXCEPTION 'Schedule version identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_schedule_slot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v "ScheduleVersion"; live BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT * INTO v FROM "ScheduleVersion" WHERE id = OLD."versionId" FOR SHARE;
    IF v.status <> 'DRAFT' THEN
      SELECT EXISTS (SELECT 1 FROM "Schedule" s WHERE s.id = v."scheduleId" AND s.status = 'PUBLISHED'
        AND s."publishedVersionId" = v.id AND s."originalVersionId" IS NOT NULL AND s."originalVersionId" <> v.id) INTO live;
      IF NOT live OR TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Original, historical and referenced schedule slots are protected'; END IF;
      IF NEW.id <> OLD.id OR NEW."versionId" <> OLD."versionId" OR NEW."scheduleId" <> OLD."scheduleId" OR NEW."facilityId" <> OLD."facilityId"
        OR NEW.date <> OLD.date OR NEW."shiftType" <> OLD."shiftType" OR NEW."positionId" <> OLD."positionId" OR NEW."slotNumber" <> OLD."slotNumber" THEN
        RAISE EXCEPTION 'Published slot identity is immutable';
      END IF;
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT * INTO v FROM "ScheduleVersion" WHERE id = NEW."versionId" FOR SHARE;
    IF v.status <> 'DRAFT' AND NOT EXISTS (
      SELECT 1 FROM "Schedule" s WHERE s.id = v."scheduleId" AND s.status = 'PUBLISHED'
        AND s."publishedVersionId" = v.id AND s."originalVersionId" IS NOT NULL AND s."originalVersionId" <> v.id
    ) THEN RAISE EXCEPTION 'Original and historical schedule slots are immutable'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

CREATE FUNCTION protect_schedule_original() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."originalVersionId" IS NOT NULL AND NEW."originalVersionId" IS DISTINCT FROM OLD."originalVersionId" THEN
    RAISE EXCEPTION 'The original schedule snapshot cannot be replaced';
  END IF;
  IF NEW."originalVersionId" IS NOT NULL AND (NEW."originalVersionId" = NEW."publishedVersionId" OR NOT EXISTS (
    SELECT 1 FROM "ScheduleVersion" v WHERE v.id = NEW."originalVersionId" AND v.status = 'PUBLISHED'
  )) THEN RAISE EXCEPTION 'The original must be a separate published snapshot'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_schedule_original BEFORE UPDATE ON "Schedule"
FOR EACH ROW EXECUTE FUNCTION protect_schedule_original();
COMMIT;
