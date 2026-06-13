-- Replace ScheduleStatus enum: DRAFT/FINALIZED/PUBLISHED -> DRAFT/ACTIVE/ARCHIVED
-- Mapping: DRAFT unchanged; FINALIZED -> DRAFT (no separate "סוכם" state); PUBLISHED -> ACTIVE

CREATE TYPE "ScheduleStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

ALTER TABLE "Schedule" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Schedule" ALTER COLUMN "status" TYPE "ScheduleStatus_new" USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'DRAFT'::"ScheduleStatus_new"
    WHEN 'FINALIZED' THEN 'DRAFT'::"ScheduleStatus_new"
    WHEN 'PUBLISHED' THEN 'ACTIVE'::"ScheduleStatus_new"
    ELSE 'DRAFT'::"ScheduleStatus_new"
  END
);

ALTER TABLE "Schedule" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"ScheduleStatus_new";

DROP TYPE "ScheduleStatus";

ALTER TYPE "ScheduleStatus_new" RENAME TO "ScheduleStatus";
