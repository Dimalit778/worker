ALTER TABLE "WorkSchedule" RENAME TO "Roster";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Roster' AND policyname = 'WorkSchedule_read_own_court'
  ) THEN
    ALTER POLICY "WorkSchedule_read_own_court" ON "Roster" RENAME TO "Roster_read_own_court";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'Roster' AND policyname = 'WorkSchedule_manager_write_own_court'
  ) THEN
    ALTER POLICY "WorkSchedule_manager_write_own_court" ON "Roster" RENAME TO "Roster_manager_write_own_court";
  END IF;
END $$;
