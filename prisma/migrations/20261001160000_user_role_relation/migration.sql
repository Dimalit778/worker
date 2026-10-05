-- Replace enum values with shared Role records without recreating users/positions.
BEGIN;
LOCK TABLE "User", "Position" IN ACCESS EXCLUSIVE MODE;
CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Role_rank_check" CHECK ("rank" BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Role_rank_key" ON "Role"("rank");
INSERT INTO "Role" ("id", "code", "name", "rank") VALUES
('role_manager', 'MANAGER', 'קצין מתקן', 1),
('role_shift_manager', 'SHIFT_MANAGER', 'אחמ״ש', 2),
('role_bakar', 'BAKAR', 'בקר', 3),
('role_guard', 'GUARD', 'מאבטח', 4);

ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
UPDATE "User" u SET "roleId"=r."id" FROM "Role" r WHERE r."code"=u."employeeRole"::text;
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User" DROP COLUMN "employeeRole";

-- Retarget the existing ownership safeguards before dropping the old enum column.
DROP TRIGGER "Position_immutable_scope" ON "Position";
ALTER TABLE "Position" DROP CONSTRAINT "Position_scope_check";
ALTER TABLE "Position" ADD COLUMN "baseRoleId" TEXT;
UPDATE "Position" p SET "baseRoleId"=r."id" FROM "Role" r WHERE r."code"=p."baseRole"::text;
ALTER TABLE "Position" DROP COLUMN "baseRole";
CREATE UNIQUE INDEX "Position_baseRoleId_key" ON "Position"("baseRoleId");
ALTER TABLE "Position" ADD CONSTRAINT "Position_baseRoleId_fkey" FOREIGN KEY ("baseRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_scope_check" CHECK (
 ("baseRoleId" IS NOT NULL AND "facilityId" IS NULL) OR
 ("baseRoleId" IS NULL AND "facilityId" IS NOT NULL)
);
CREATE OR REPLACE FUNCTION prevent_position_scope_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."facilityId" IS DISTINCT FROM OLD."facilityId"
    OR NEW."baseRoleId" IS DISTINCT FROM OLD."baseRoleId" THEN
   RAISE EXCEPTION 'Position ownership and base role are immutable' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Position_immutable_scope"
BEFORE UPDATE OF "facilityId", "baseRoleId" ON "Position"
FOR EACH ROW EXECUTE FUNCTION prevent_position_scope_change();
DROP TYPE "EmployeeRole";
COMMIT;
