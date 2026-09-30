-- AlterTable
ALTER TABLE "Court" ADD COLUMN "submissionOpenWeekday" INTEGER,
ADD COLUMN "submissionOpenTime" TEXT,
ADD COLUMN "submissionCloseWeekday" INTEGER,
ADD COLUMN "submissionCloseTime" TEXT;

-- AlterTable
ALTER TABLE "SchedulePeriod" ADD COLUMN "submissionOpensAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "submissionNotifiedAt" TIMESTAMP(3);

-- Existing periods are already past the send step. Mark them notified so opening the app does not email the court.
UPDATE "SchedulePeriod" AS sp
SET "submissionNotifiedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "WorkSchedule" AS ws
  WHERE ws."periodId" = sp."id"
    AND ws."status" <> 'DRAFT'
);

-- Existing drafts stay manual. A far-future open time keeps the new scheduler from opening or emailing them.
UPDATE "SchedulePeriod" AS sp
SET
  "submissionOpensAt" = TIMESTAMP '2099-01-01',
  "submissionNotifiedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "WorkSchedule" AS ws
  WHERE ws."periodId" = sp."id"
    AND ws."status" = 'DRAFT'
);
