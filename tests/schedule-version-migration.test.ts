import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('schedule version data migration', () => {
  it('preserves existing schedules, assignments, submissions and audit payloads', () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('Migration tests require a localhost database ending in _test');
    }
    const schema = `migration_${randomUUID().replaceAll('-', '')}`;
    const run = (target: string, sql: string) => execFileSync('psql', [target, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const base = url.toString();
    run(base, `CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    const target = url.toString();
    try {
      for (const migration of ['20261001133645_init', '20261001150000_shared_positions', '20261001160000_user_role_relation']) {
        run(target, readFileSync(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
      }
      run(target, `
        INSERT INTO "District" (id, name, code, "updatedAt") VALUES ('d', 'test', 'test', now());
        INSERT INTO "Facility" (id, name, code, "districtId", "updatedAt") VALUES ('f', 'test', 'test', 'd', now());
        INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", "displayName", "facilityId", "roleId", "updatedAt")
          VALUES ('u', 'migration@test.invalid', 'x', 'test', 'test', 'test', 'f', 'role_guard', now());
        INSERT INTO "Position" (id, "facilityId", name, "requiredRank", "displayOrder", "updatedAt") VALUES ('p', 'f', 'guard', 4, 4, now());
        INSERT INTO "StaffingRequirement" (id, "facilityId", "positionId", "shiftType", "dayCategory", "requiredCount")
          VALUES ('r', 'f', 'p', 'MORNING', 'WEEKDAY', 2);
        INSERT INTO "Schedule" (id, "facilityId", name, "startDate", "endDate", "submissionOpensAt", "submissionClosesAt", status, "publishedAt", revision, "updatedAt")
          SELECT status::text, 'f', status::text, '2098-01-01'::date + n::int*14, '2098-01-14'::date + n::int*14, now(), now(), status,
          CASE WHEN status <> 'DRAFT' THEN now() END, 7, now()
          FROM unnest(enum_range(NULL::"ScheduleStatus")) WITH ORDINALITY AS t(status, n);
        INSERT INTO "ScheduleSlot" (id, "facilityId", "scheduleId", "positionId", date, "shiftType", "slotNumber", "startsAt", "endsAt", "userId", source, "isLocked", note, "updatedAt")
          SELECT id || '-slot', 'f', id, 'p', "startDate", 'MORNING', 1, "startDate" + time '05:00', "startDate" + time '13:00', 'u', 'MANUAL', true, 'keep note', now() FROM "Schedule";
        INSERT INTO "AvailabilitySubmission" (id, "facilityId", "scheduleId", "userId", "submittedAt", "updatedAt")
          SELECT id || '-form', 'f', id, 'u', now(), now() FROM "Schedule";
        INSERT INTO "ShiftAvailability" (id, "submissionId", date, "shiftType", preference)
          SELECT id || '-availability', id || '-form', "startDate", 'MORNING', 'PREFERRED' FROM "Schedule";
        INSERT INTO "ScheduleChange" (id, "facilityId", "scheduleId", "changedById", "changeType", reason, "beforeData", "afterData")
          SELECT id || '-audit', 'f', id, 'u', 'UPDATE', 'keep reason', '{"before":1}', '{"after":2}' FROM "Schedule";
      `);
      const snapshot = `SELECT jsonb_build_object(
        'schedules', (SELECT jsonb_agg(to_jsonb(s) - 'revision' - 'draftVersionId' - 'publishedVersionId' ORDER BY id) FROM "Schedule" s),
        'slots', (SELECT jsonb_agg(to_jsonb(s) - 'versionId' ORDER BY id) FROM "ScheduleSlot" s),
        'submissions', (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM "AvailabilitySubmission" s),
        'availability', (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM "ShiftAvailability" s),
        'audit', (SELECT jsonb_agg(to_jsonb(s) - 'versionId' ORDER BY id) FROM "ScheduleChange" s)
      )`;
      const before = JSON.parse(run(target, snapshot));
      run(target, readFileSync(new URL('../prisma/migrations/20261016180000_schedule_versions/migration.sql', import.meta.url), 'utf8'));
      expect(JSON.parse(run(target, snapshot))).toEqual(before);
      expect(run(target, `SELECT count(*) FROM "ScheduleVersion" WHERE revision = 7 AND number = 1`)).toBe('3');
      expect(run(target, `SELECT "draftVersionId" FROM "Schedule" WHERE id = 'DRAFT'`)).toBe('DRAFT-v1');
      expect(run(target, `SELECT "publishedVersionId" FROM "Schedule" WHERE id = 'PUBLISHED'`)).toBe('PUBLISHED-v1');
      expect(run(target, `SELECT "publishedVersionId" FROM "Schedule" WHERE id = 'ARCHIVED'`)).toBe('ARCHIVED-v1');
      expect(run(target, `SELECT "capacitySnapshot"->0->>'amount' FROM "ScheduleVersion" WHERE id = 'PUBLISHED-v1'`)).toBe('2');
    } finally {
      run(base, `DROP SCHEMA ${schema} CASCADE`);
    }
  }, 20000);
});
