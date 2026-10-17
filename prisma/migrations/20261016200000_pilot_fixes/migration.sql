-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockedUntil" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "openNotifiedAt" TIMESTAMPTZ(3),
ADD COLUMN     "reminderSentAt" TIMESTAMPTZ(3);
