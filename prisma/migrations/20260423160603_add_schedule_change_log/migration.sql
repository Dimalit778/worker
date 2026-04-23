-- CreateEnum
CREATE TYPE "ScheduleChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'MANUAL_OVERRIDE');

-- CreateTable
CREATE TABLE "ScheduleChangeLog" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "shiftAssignmentId" TEXT,
    "changedById" TEXT NOT NULL,
    "changeType" "ScheduleChangeType" NOT NULL,
    "message" TEXT,
    "reason" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_scheduleId_createdAt_idx" ON "ScheduleChangeLog"("scheduleId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_shiftAssignmentId_idx" ON "ScheduleChangeLog"("shiftAssignmentId");

-- CreateIndex
CREATE INDEX "ScheduleChangeLog_changedById_createdAt_idx" ON "ScheduleChangeLog"("changedById", "createdAt");

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_shiftAssignmentId_fkey" FOREIGN KEY ("shiftAssignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChangeLog" ADD CONSTRAINT "ScheduleChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
