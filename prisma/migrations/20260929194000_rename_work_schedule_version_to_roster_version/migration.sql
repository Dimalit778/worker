ALTER TABLE "WorkScheduleVersion" RENAME TO "RosterVersion";

CREATE OR REPLACE FUNCTION protect_published_assignments() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM "RosterVersion" WHERE id=OLD."versionId" AND status<>'DRAFT') THEN
  RAISE EXCEPTION 'Published assignments are immutable';
 END IF;
 IF TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM "RosterVersion" WHERE id=NEW."versionId" AND status<>'DRAFT') THEN
  RAISE EXCEPTION 'Published assignments are immutable';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'RosterVersion' AND policyname = 'WorkScheduleVersion_read_own_court'
  ) THEN
    ALTER POLICY "WorkScheduleVersion_read_own_court" ON "RosterVersion" RENAME TO "RosterVersion_read_own_court";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'RosterVersion' AND policyname = 'WorkScheduleVersion_manager_write_own_court'
  ) THEN
    ALTER POLICY "WorkScheduleVersion_manager_write_own_court" ON "RosterVersion" RENAME TO "RosterVersion_manager_write_own_court";
  END IF;
END $$;
