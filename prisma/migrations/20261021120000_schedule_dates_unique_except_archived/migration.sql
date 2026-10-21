-- DropIndex
DROP INDEX "Schedule_facilityId_startDate_endDate_key";

-- Archived periods keep their dates, so only non-archived periods must be unique per facility and dates.
-- Partial index, kept only in SQL like ScheduleVersion_one_draft (Prisma schema cannot express it without a preview feature).
CREATE UNIQUE INDEX "Schedule_facilityId_startDate_endDate_active_key" ON "Schedule"("facilityId", "startDate", "endDate") WHERE "status" <> 'ARCHIVED';
