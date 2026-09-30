BEGIN;

-- Support version-scoped warning reads and recalculation cleanup.
CREATE INDEX "ScheduleWarning_versionId_idx" ON "ScheduleWarning"("versionId");

-- The employeeId/versionId unique index does not lead with versionId.
CREATE INDEX "FairnessRecord_versionId_idx" ON "FairnessRecord"("versionId");

-- Holiday_date_key already enforces uniqueness and supports date lookups.
DROP INDEX "Holiday_date_idx";

COMMIT;
