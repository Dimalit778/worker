-- This is an empty migration.-- Court-scoped row level security policies.
--
-- Policies read these transaction/session settings:
--   app.current_role        = ADMIN | MANAGER | EMPLOYEE
--   app.current_court_id    = Court.id
--   app.current_employee_id = Employee.id
--
-- Use SET LOCAL inside a transaction before querying with a non-owner DB role.

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.current_app_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_role', true), '')
$$;

CREATE OR REPLACE FUNCTION app_private.current_court_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_court_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_private.current_employee_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_employee_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_private.current_app_role() = 'ADMIN'
$$;

CREATE OR REPLACE FUNCTION app_private.is_manager_for_court(court_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_private.is_admin()
    OR (
      app_private.current_app_role() = 'MANAGER'
      AND app_private.current_court_id() = court_id
    )
$$;

CREATE OR REPLACE FUNCTION app_private.can_read_court(court_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT app_private.is_admin()
    OR (
      app_private.current_app_role() IN ('MANAGER', 'EMPLOYEE')
      AND app_private.current_court_id() = court_id
    )
$$;

CREATE OR REPLACE FUNCTION app_private.schedule_court_id(schedule_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT "courtId" FROM "WorkSchedule" WHERE "id" = schedule_id
$$;

CREATE OR REPLACE FUNCTION app_private.period_court_id(period_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT "courtId" FROM "SchedulePeriod" WHERE "id" = period_id
$$;

CREATE OR REPLACE FUNCTION app_private.form_court_id(form_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT p."courtId"
  FROM "AvailabilityForm" f
  JOIN "SchedulePeriod" p ON p."id" = f."periodId"
  WHERE f."id" = form_id
$$;

CREATE OR REPLACE FUNCTION app_private.form_employee_id(form_id TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT "employeeId" FROM "AvailabilityForm" WHERE "id" = form_id
$$;

ALTER TABLE "Court" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Position" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftCapacity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchedulePeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkScheduleVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleWarning" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FairnessRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleChangeLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityForm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityShift" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Court_read_own_or_admin" ON "Court"
FOR SELECT USING (app_private.is_admin() OR app_private.can_read_court("id"));
CREATE POLICY "Court_admin_write" ON "Court"
FOR ALL USING (app_private.is_admin())
WITH CHECK (app_private.is_admin());

CREATE POLICY "Employee_read_own_court" ON "Employee"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "Employee_manager_write_own_court" ON "Employee"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "Position_read_own_court" ON "Position"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "Position_manager_write_own_court" ON "Position"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "ShiftCapacity_read_own_court" ON "ShiftCapacity"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "ShiftCapacity_manager_write_own_court" ON "ShiftCapacity"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "SchedulePeriod_read_own_court" ON "SchedulePeriod"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "SchedulePeriod_manager_write_own_court" ON "SchedulePeriod"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "WorkSchedule_read_own_court" ON "WorkSchedule"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "WorkSchedule_manager_write_own_court" ON "WorkSchedule"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "WorkScheduleVersion_read_own_court" ON "WorkScheduleVersion"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "WorkScheduleVersion_manager_write_own_court" ON "WorkScheduleVersion"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "ShiftAssignment_read_own_court" ON "ShiftAssignment"
FOR SELECT USING (app_private.can_read_court("courtId"));
CREATE POLICY "ShiftAssignment_manager_write_own_court" ON "ShiftAssignment"
FOR ALL USING (app_private.is_manager_for_court("courtId"))
WITH CHECK (app_private.is_manager_for_court("courtId"));

CREATE POLICY "ScheduleWarning_read_own_court" ON "ScheduleWarning"
FOR SELECT USING (app_private.can_read_court(COALESCE("courtId", app_private.schedule_court_id("scheduleId"))));
CREATE POLICY "ScheduleWarning_manager_write_own_court" ON "ScheduleWarning"
FOR ALL USING (app_private.is_manager_for_court(COALESCE("courtId", app_private.schedule_court_id("scheduleId"))))
WITH CHECK (app_private.is_manager_for_court(COALESCE("courtId", app_private.schedule_court_id("scheduleId"))));

CREATE POLICY "FairnessRecord_read_own_court" ON "FairnessRecord"
FOR SELECT USING (app_private.can_read_court(app_private.schedule_court_id("scheduleId")));
CREATE POLICY "FairnessRecord_manager_write_own_court" ON "FairnessRecord"
FOR ALL USING (app_private.is_manager_for_court(app_private.schedule_court_id("scheduleId")))
WITH CHECK (app_private.is_manager_for_court(app_private.schedule_court_id("scheduleId")));

CREATE POLICY "ScheduleChangeLog_read_own_court" ON "ScheduleChangeLog"
FOR SELECT USING (app_private.can_read_court(app_private.schedule_court_id("scheduleId")));
CREATE POLICY "ScheduleChangeLog_manager_write_own_court" ON "ScheduleChangeLog"
FOR ALL USING (app_private.is_manager_for_court(app_private.schedule_court_id("scheduleId")))
WITH CHECK (app_private.is_manager_for_court(app_private.schedule_court_id("scheduleId")));

CREATE POLICY "AvailabilityForm_read_own_court" ON "AvailabilityForm"
FOR SELECT USING (app_private.can_read_court(app_private.period_court_id("periodId")));
CREATE POLICY "AvailabilityForm_employee_or_admin_write" ON "AvailabilityForm"
FOR ALL USING (
  app_private.is_admin()
  OR (
    app_private.current_app_role() = 'EMPLOYEE'
    AND app_private.current_employee_id() = "employeeId"
    AND app_private.current_court_id() = app_private.period_court_id("periodId")
  )
)
WITH CHECK (
  app_private.is_admin()
  OR (
    app_private.current_app_role() = 'EMPLOYEE'
    AND app_private.current_employee_id() = "employeeId"
    AND app_private.current_court_id() = app_private.period_court_id("periodId")
  )
);

CREATE POLICY "AvailabilityShift_read_own_court" ON "AvailabilityShift"
FOR SELECT USING (app_private.can_read_court(app_private.form_court_id("formId")));
CREATE POLICY "AvailabilityShift_employee_or_admin_write" ON "AvailabilityShift"
FOR ALL USING (
  app_private.is_admin()
  OR (
    app_private.current_app_role() = 'EMPLOYEE'
    AND app_private.current_employee_id() = app_private.form_employee_id("formId")
    AND app_private.current_court_id() = app_private.form_court_id("formId")
  )
)
WITH CHECK (
  app_private.is_admin()
  OR (
    app_private.current_app_role() = 'EMPLOYEE'
    AND app_private.current_employee_id() = app_private.form_employee_id("formId")
    AND app_private.current_court_id() = app_private.form_court_id("formId")
  )
);
