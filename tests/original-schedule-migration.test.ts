import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('original/current schedule migration', () => {
  it('preserves legacy versions, requests and an open draft while snapshotting the earliest publication', () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('Migration tests require a localhost database ending in _test');
    }
    const schema = `original_${randomUUID().replaceAll('-', '')}`;
    const run = (target: string, sql: string) => execFileSync('psql', [target, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
      input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const base = url.toString();
    run(base, `CREATE SCHEMA ${schema}`);
    url.searchParams.set('options', `-csearch_path=${schema}`);
    const target = url.toString();
    try {
      const migrations = new URL('../prisma/migrations/', import.meta.url);
      for (const name of readdirSync(migrations).sort().filter(name => /^\d/.test(name) && name < '20261021190000')) {
        run(target, readFileSync(new URL(`${name}/migration.sql`, migrations), 'utf8'));
      }
      run(target, `
        INSERT INTO "District" (id,name,code,"updatedAt") VALUES ('d','test','test',now());
        INSERT INTO "Facility" (id,name,code,"districtId","updatedAt") VALUES ('f','test','test','d',now());
        INSERT INTO "User" (id,email,"passwordHash","firstName","lastName","displayName","facilityId","roleId","updatedAt")
          VALUES ('e1','e1@test.invalid','x','a','a','a','f','role_guard',now()), ('e2','e2@test.invalid','x','b','b','b','f','role_guard',now());
        INSERT INTO "Position" (id,"facilityId",name,"requiredRank","displayOrder","updatedAt") VALUES ('p','f','guard',4,4,now());
        INSERT INTO "Schedule" (id,"facilityId",name,"startDate","endDate","submissionOpensAt","submissionClosesAt","updatedAt")
          VALUES ('s','f','test','2098-01-01','2098-01-07',now(),now(),now());
        INSERT INTO "ScheduleVersion" (id,"scheduleId","facilityId",number) VALUES ('v1','s','f',1);
        INSERT INTO "ScheduleSlot" (id,"facilityId","scheduleId","versionId","positionId",date,"shiftType","slotNumber","startsAt","endsAt","userId","updatedAt")
          VALUES ('a1','f','s','v1','p','2098-01-01','MORNING',1,'2098-01-01 05:00Z','2098-01-01 13:00Z','e1',now());
        UPDATE "ScheduleVersion" SET status='PUBLISHED', "publishedAt"='2026-10-01' WHERE id='v1';
        UPDATE "Schedule" SET status='PUBLISHED', "publishedVersionId"='v1' WHERE id='s';
        INSERT INTO "ScheduleVersion" (id,"scheduleId","facilityId",number) VALUES ('v2','s','f',2);
        INSERT INTO "ScheduleSlot" (id,"facilityId","scheduleId","versionId","positionId",date,"shiftType","slotNumber","startsAt","endsAt","userId","updatedAt")
          VALUES ('a2','f','s','v2','p','2098-01-01','MORNING',1,'2098-01-01 05:00Z','2098-01-01 13:00Z','e2',now());
        UPDATE "ScheduleVersion" SET status='PUBLISHED', "publishedAt"='2026-10-02' WHERE id='v2';
        INSERT INTO "ScheduleVersion" (id,"scheduleId","facilityId",number) VALUES ('v3','s','f',3);
        UPDATE "Schedule" SET "publishedVersionId"='v2', "draftVersionId"='v3' WHERE id='s';
        INSERT INTO "EmployeeRequest" (id,"facilityId",type,status,"requesterId","targetUserId","slotId","updatedAt")
          VALUES ('r','f','SHIFT_SWAP','PENDING_MANAGER','e1','e2','a1',now());
        INSERT INTO "ScheduleChange" (id,"facilityId","scheduleId","changedById","versionId","changeType",reason,"beforeData","afterData")
          VALUES ('c','f','s','e1','v2','UPDATE','keep reason','{"before":1}','{"after":2}');
      `);
      const retained = `SELECT jsonb_build_object(
        'versions',(SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM "ScheduleVersion" v WHERE number <> 0),
        'slots',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM "ScheduleSlot" a WHERE id IN ('a1','a2')),
        'requests',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM "EmployeeRequest" r),
        'changes',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM "ScheduleChange" c))`;
      const before = run(target, retained);
      run(target, readFileSync(new URL('20261021190000_original_and_current_schedule/migration.sql', migrations), 'utf8'));
      expect(run(target, retained)).toBe(before);
      expect(run(target, `SELECT "originalVersionId" || '|' || "publishedVersionId" || '|' || "draftVersionId" FROM "Schedule" WHERE id='s'`)).toBe('s-original|v2|v3');
      expect(run(target, `SELECT "userId" FROM "ScheduleSlot" WHERE "versionId"='s-original'`)).toBe('e1');
      expect(() => run(target, `UPDATE "ScheduleSlot" SET "userId"='e2' WHERE "versionId"='s-original'`)).toThrow();
      expect(() => run(target, `UPDATE "ScheduleSlot" SET "userId"='e2' WHERE id='a1'`)).toThrow();
      run(target, `UPDATE "ScheduleSlot" SET "userId"='e1' WHERE id='a2'; UPDATE "ScheduleVersion" SET revision=revision+1 WHERE id='v2';`);
      expect(run(target, `SELECT "userId" FROM "ScheduleSlot" WHERE id='a2'`)).toBe('e1');
    } finally {
      run(base, `DROP SCHEMA ${schema} CASCADE`);
    }
  }, 20000);
});
