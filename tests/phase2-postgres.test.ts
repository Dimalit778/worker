import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// Phase 2 workflows against a migrated PostgreSQL (same conventions as scheduling-postgres.test.ts).
const identity = vi.hoisted(() => ({ userId: '' }));
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: identity.userId }, expires: '2099-01-01' }) }));
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('UNAUTHORIZED'); } }));
vi.mock('@/features/periods/notify-submission', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/periods/notify-submission')>()),
  sendSubmissionExtendedEmails: vi.fn(async () => ({ ok: true, sent: 0 })),
}));
vi.mock('@/lib/db/client', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: null };
  const target = new URL(process.env.TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Integration tests require a localhost database ending in _test');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('@/generated/prisma/client');
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) }) };
});
import { prisma } from '@/lib/db/client';
import { createAssignment, saveScheduleChanges, startScheduleCorrection } from '@/features/schedules/assignments/actions';
import { generateAutoSchedule } from '@/features/schedules/generation/actions';
import { publishSchedule } from '@/features/schedules/draft-schedule/actions';
import { getScheduleWarnings, getUpcomingSchedule } from '@/features/schedules/assignments/queries';
import { loadSchedulingInput } from '@/features/schedules/generation/queries';
import { saveAvailabilityDraft, submitAvailability } from '@/features/availability/actions';
import { extendSubmissionDeadline } from '@/features/periods/actions';
import { deleteStaffingDateOverride, saveStaffingDateOverride } from '@/features/settings/actions';
import { approveRequest, createDateRequest, createTransferRequest, respondToTransfer } from '@/features/requests/actions';

const date = (day: string) => new Date(`${day}T00:00:00Z`);
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('phase 2 workflows against migrated PostgreSQL', () => {
  let facilityId: string;
  let scheduleId: string;
  let positionId: string;
  let employeeId: string;
  let colleagueId: string;
  let managerId: string;
  let expected: { versionId: string | null; revision: number };
  const as = (userId: string) => { identity.userId = userId; };

  beforeEach(async () => {
    const suffix = randomUUID();
    const district = await prisma.district.create({ data: { name: 'test', code: suffix } });
    const facility = await prisma.facility.create({ data: { name: 'test', code: suffix, districtId: district.id } });
    facilityId = facility.id;
    const role = await prisma.role.upsert({ where: { rank: 4 }, update: {}, create: { code: 'GUARD', name: 'guard', rank: 4 } });
    const position = await prisma.position.create({ data: { facilityId, name: 'guard', requiredRank: 4, displayOrder: 4 } });
    positionId = position.id;
    const user = (tag: string, extra = {}) => prisma.user.create({ data: { email: `${suffix}-${tag}@test.invalid`, passwordHash: 'unused', facilityId, roleId: role.id, firstName: 'Test', lastName: tag, displayName: `Test ${tag}`, ...extra } });
    employeeId = (await user('employee')).id;
    colleagueId = (await user('colleague')).id;
    managerId = (await user('manager', { canEditSchedule: true })).id;
    as(managerId);
    const schedule = await prisma.schedule.create({ data: { facilityId, name: 'test', startDate: date('2098-01-06'), endDate: date('2098-01-19'), submissionOpensAt: new Date('2020-01-01'), submissionClosesAt: date('2098-01-05') } });
    scheduleId = schedule.id;
    for (const dayCategory of ['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const) {
      for (const shiftType of ['MORNING', 'EVENING', 'NIGHT'] as const) {
        await prisma.staffingRequirement.create({ data: { facilityId, positionId, dayCategory, shiftType, requiredCount: 1 } });
      }
    }
    expected = await startScheduleCorrection(scheduleId, { versionId: null, revision: 0 });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  /** Employee submitted: 06/01 morning preferred, 07/01 night available (seeded directly; submitAvailability requires the weekly minimum). */
  const submitEmployee = async () => {
    await prisma.availabilitySubmission.create({ data: { userId: employeeId, facilityId, scheduleId, submittedAt: new Date(), availabilities: { create: [{ date: date('2098-01-06'), shiftType: 'MORNING', preference: 'PREFERRED' }, { date: date('2098-01-07'), shiftType: 'NIGHT', preference: 'AVAILABLE' }] } } });
  };
  const generate = async () => {
    const result = await generateAutoSchedule(scheduleId, expected);
    expect(result).toMatchObject({ ok: true });
    const draft = await prisma.scheduleVersion.findFirstOrThrow({ where: { scheduleId, status: 'DRAFT' } });
    expected = { versionId: draft.id, revision: draft.revision };
  };
  const employeeShifts = async (versionId: string) =>
    (await prisma.scheduleSlot.findMany({ where: { versionId, userId: employeeId }, orderBy: { date: 'asc' } }))
      .map(slot => `${slot.date.toISOString().slice(0, 10)}|${slot.shiftType}`);
  const publish = async () => {
    expect(await publishSchedule(scheduleId, { ...expected, confirmIssues: true })).toEqual({ ok: true });
    const version = await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: expected.versionId! } });
    expected = { versionId: version.id, revision: version.revision };
  };
  /** Employee on 06/01 morning in the current draft, then published. */
  const publishEmployeeOnMorning = async () => {
    const result = await createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-06', shiftType: 'MORNING', slotIndex: 0 }, expected, { reason: 'test' });
    expected = { versionId: result.versionId, revision: result.revision };
    await publish();
    return prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: expected.versionId!, userId: employeeId } });
  };

  it('keeps an availability draft out of the engine until it is submitted', async () => {
    as(employeeId);
    expect(await saveAvailabilityDraft({ periodId: scheduleId, entries: { '2098-01-06-MORNING': 'AVAILABLE' }, note: 'draft' })).toMatchObject({ ok: true });
    const draft = await prisma.availabilitySubmission.findFirstOrThrow({ where: { scheduleId, userId: employeeId }, include: { availabilities: true } });
    expect(draft).toMatchObject({ submittedAt: null, draftNote: 'draft' });
    expect(draft.availabilities).toHaveLength(0);
    expect((await loadSchedulingInput(prisma, scheduleId, facilityId, null)).input.availability.has(employeeId)).toBe(false);

    // Submitting below the weekly minimum is rejected and leaves the draft untouched.
    const rejected = await submitAvailability({ periodId: scheduleId, entries: { '2098-01-06-MORNING': 'PREFERRED', '2098-01-07-NIGHT': 'AVAILABLE' }, note: '' });
    expect(rejected).toMatchObject({ ok: false, error: expect.stringContaining('יש לסמן לפחות 2 משמרות בוקר ומשמרת ערב אחת') });
    const untouched = await prisma.availabilitySubmission.findFirstOrThrow({ where: { scheduleId, userId: employeeId }, include: { availabilities: true } });
    expect(untouched).toMatchObject({ submittedAt: null, draftNote: 'draft' });
    expect(untouched.availabilities).toHaveLength(0);

    // 2 mornings + 1 evening in each of the two weeks.
    const entries = { '2098-01-06-MORNING': 'PREFERRED', '2098-01-07-MORNING': 'AVAILABLE', '2098-01-08-EVENING': 'AVAILABLE', '2098-01-13-MORNING': 'AVAILABLE', '2098-01-14-MORNING': 'AVAILABLE', '2098-01-15-EVENING': 'AVAILABLE', '2098-01-07-NIGHT': 'AVAILABLE', '2098-01-09-EVENING': 'UNAVAILABLE' } as const;
    expect(await submitAvailability({ periodId: scheduleId, entries, note: '' })).toMatchObject({ ok: true });
    const submitted = await prisma.availabilitySubmission.findFirstOrThrow({ where: { scheduleId, userId: employeeId }, include: { availabilities: true } });
    expect(submitted.submittedAt).not.toBeNull();
    expect(submitted.draftEntries).toBeNull();
    expect(submitted.availabilities).toHaveLength(8);

    // A later draft does not change what the engine reads.
    expect(await saveAvailabilityDraft({ periodId: scheduleId, entries: {}, note: '' })).toMatchObject({ ok: true });
    const { input } = await loadSchedulingInput(prisma, scheduleId, facilityId, null);
    expect([...input.availability.get(employeeId)!].sort()).toEqual(['2098-01-06|MORNING', '2098-01-07|MORNING', '2098-01-07|NIGHT', '2098-01-08|EVENING', '2098-01-13|MORNING', '2098-01-14|MORNING', '2098-01-15|EVENING']);
    expect([...input.preferences.get(employeeId)!]).toEqual(['2098-01-06|MORNING']);
  });

  it('exempts a week with approved time off from the weekly minimum on submit', async () => {
    as(employeeId);
    const week2 = { '2098-01-13-MORNING': 'AVAILABLE', '2098-01-14-MORNING': 'AVAILABLE', '2098-01-15-EVENING': 'AVAILABLE' } as const;
    expect(await createDateRequest({ type: 'TIME_OFF', startDate: '2098-01-06', endDate: '2098-01-06', reason: 'חופשה' })).toEqual({ ok: true });
    // Pending time off does not exempt week 1.
    expect(await submitAvailability({ periodId: scheduleId, entries: week2, note: '' })).toMatchObject({ ok: false, error: expect.stringContaining('בשבוע 1') });

    const request = await prisma.employeeRequest.findFirstOrThrow({ where: { requesterId: employeeId } });
    as(managerId);
    expect(await approveRequest(request.id)).toMatchObject({ ok: true });
    as(employeeId);
    expect(await submitAvailability({ periodId: scheduleId, entries: week2, note: '' })).toMatchObject({ ok: true });
    // Week 2 has no time off, so it is still enforced.
    expect(await submitAvailability({ periodId: scheduleId, entries: { '2098-01-13-MORNING': 'AVAILABLE' }, note: '' })).toMatchObject({ ok: false, error: expect.stringContaining('בשבוע 2') });
  });

  it('extends the submission deadline with an audited reason, only before publication', async () => {
    expect(await extendSubmissionDeadline({ scheduleId, newDeadline: '2098-01-05T20:00', reason: '' })).toEqual({ error: 'יש לציין סיבה להארכה' });
    const result = await extendSubmissionDeadline({ scheduleId, newDeadline: '2098-01-05T20:00', reason: 'חג' });
    expect(result).toMatchObject({ ok: true });
    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(schedule.submissionClosesAt.toISOString()).toBe('2098-01-05T18:00:00.000Z');
    expect(schedule.reminderSentAt).toBeNull();
    const change = await prisma.scheduleChange.findFirstOrThrow({ where: { scheduleId, changeType: 'UPDATE' } });
    expect(change.reason).toContain('חג');
    expect(change.beforeData).toEqual({ submissionClosesAt: '2098-01-05T00:00:00.000Z' });

    // Publication preserves the deadline; a later extension is rejected because the schedule is published.
    await publish();
    const closedAt = (await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } })).submissionClosesAt;
    expect(closedAt).toEqual(schedule.submissionClosesAt);
    expect(await extendSubmissionDeadline({ scheduleId, newDeadline: '2098-01-05T21:00', reason: 'שוב' })).toHaveProperty('error');
    expect((await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } })).submissionClosesAt).toEqual(closedAt);
  });

  it('feeds date-specific requirements into generation and freezes them on publication', async () => {
    await submitEmployee();
    expect(await saveStaffingDateOverride({ date: '2098-01-06', label: 'חג', entries: [{ positionId, shiftType: 'MORNING', amount: 0 }] })).toMatchObject({ ok: true });
    const { input } = await loadSchedulingInput(prisma, scheduleId, facilityId, expected.versionId);
    expect(input.dateOverrides).toEqual([expect.objectContaining({ date: '2098-01-06', positionId, shiftType: 'MORNING', amount: 0 })]);

    await generate();
    // 06/01 morning is preferred, but the holiday requirement is 0, so nobody is placed there.
    expect(await employeeShifts(expected.versionId!)).toEqual(['2098-01-07|NIGHT']);
    expect(await prisma.scheduleSlot.count({ where: { versionId: expected.versionId!, date: date('2098-01-06'), shiftType: 'MORNING' } })).toBe(0);

    await publish();
    const snapshot = (await prisma.scheduleVersion.findUniqueOrThrow({ where: { id: expected.versionId! } })).capacitySnapshot;
    expect(snapshot).toEqual(expect.arrayContaining([expect.objectContaining({ date: '2098-01-06', shiftType: 'MORNING', amount: 0, label: 'חג' })]));

    // Removing the override later does not change what the published version shows.
    const before = (await getUpcomingSchedule(facilityId))?.capacity;
    expect(await deleteStaffingDateOverride('2098-01-06')).toMatchObject({ ok: true });
    expect((await getUpcomingSchedule(facilityId))?.capacity).toEqual(before);
  });

  it('treats approved time off as unavailable and flags existing assignments on it', async () => {
    await submitEmployee();
    as(employeeId);
    expect(await createDateRequest({ type: 'TIME_OFF', startDate: '2098-01-06', endDate: '2098-01-06', reason: 'חופשה' })).toEqual({ ok: true });
    const request = await prisma.employeeRequest.findFirstOrThrow({ where: { requesterId: employeeId } });
    as(managerId);
    expect(await approveRequest(request.id)).toMatchObject({ ok: true, affectedSlots: [] });

    await generate();
    expect(await employeeShifts(expected.versionId!)).toEqual(['2098-01-07|NIGHT']);

    // A manual placement on the vacation day is saved as an override and raises an error warning.
    const result = await createAssignment({ scheduleId, employeeId, positionId, date: '2098-01-06', shiftType: 'MORNING', slotIndex: 0 }, expected, { reason: 'אין מחליף' });
    expected = { versionId: result.versionId, revision: result.revision };
    const warnings = await getScheduleWarnings(scheduleId, facilityId);
    expect(warnings.some(w => w.severity === 'ERROR' && w.message.includes('חופשה מאושרת'))).toBe(true);
  });

  it('reports existing assignments when time off is approved without changing them', async () => {
    const published = await publishEmployeeOnMorning();
    as(employeeId);
    expect(await createDateRequest({ type: 'TIME_OFF', startDate: '2098-01-06', endDate: '2098-01-06' })).toEqual({ ok: true });
    const request = await prisma.employeeRequest.findFirstOrThrow({ where: { requesterId: employeeId } });
    as(managerId);
    const approved = await approveRequest(request.id);
    expect(approved).toMatchObject({ ok: true, affectedSlots: [expect.objectContaining({ id: published.id })] });
    expect((await prisma.scheduleSlot.findUniqueOrThrow({ where: { id: published.id } })).userId).toBe(employeeId);
  });

  it('approves a shift transfer in place and preserves the original publication', async () => {
    const published = await publishEmployeeOnMorning();
    const publishedVersionId = expected.versionId!;
    as(employeeId);
    expect(await createTransferRequest({ slotId: published.id, targetUserId: colleagueId })).toEqual({ ok: true });
    const request = await prisma.employeeRequest.findFirstOrThrow({ where: { requesterId: employeeId, type: 'SHIFT_SWAP' } });
    as(colleagueId);
    expect(await respondToTransfer(request.id, true)).toEqual({ ok: true });
    as(managerId);

    // The colleague submitted no availability, so approval needs a reason.
    expect(await approveRequest(request.id)).toMatchObject({ ok: false, requiresOverride: true, violations: [expect.objectContaining({ code: 'NO_SUBMISSION' })] });
    expect(await approveRequest(request.id, { overrideReason: 'סוכם טלפונית' })).toMatchObject({ ok: true });

    const schedule = await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(schedule.publishedVersionId).toBe(publishedVersionId);
    expect(await prisma.scheduleVersion.count({ where: { scheduleId } })).toBe(2);
    expect(await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: schedule.originalVersionId!, date: date('2098-01-06'), shiftType: 'MORNING' } })).toMatchObject({ userId: employeeId });
    const moved = await prisma.scheduleSlot.findFirstOrThrow({ where: { versionId: schedule.publishedVersionId!, date: date('2098-01-06'), shiftType: 'MORNING' } });
    expect(moved.userId).toBe(colleagueId);
    const audit = await prisma.scheduleChange.findFirstOrThrow({ where: { scheduleId, reason: { contains: 'אושרה העברת משמרת' } } });
    expect(audit.afterData).toMatchObject({ requestId: request.id, assignment: { userId: colleagueId } });
    expect((await prisma.scheduleSlot.findUniqueOrThrow({ where: { id: published.id } })).userId).toBe(colleagueId);
    expect(await prisma.employeeRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'APPROVED', overrideReason: 'סוכם טלפונית' });
  });

  it('cancels a transfer when the manager clears its live slot', async () => {
    const published = await publishEmployeeOnMorning();
    as(employeeId);
    expect(await createTransferRequest({ slotId: published.id, targetUserId: colleagueId })).toEqual({ ok: true });
    const request = await prisma.employeeRequest.findFirstOrThrow({ where: { requesterId: employeeId, type: 'SHIFT_SWAP' } });
    as(colleagueId);
    expect(await respondToTransfer(request.id, true)).toEqual({ ok: true });
    as(managerId);
    await saveScheduleChanges(scheduleId, { ...expected, publish: true }, [{ employeeId: null, positionId, date: '2098-01-06', shiftType: 'MORNING', slotIndex: 0 }]);

    expect(await prisma.employeeRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
      status: 'CANCELLED', decidedById: managerId, decisionNote: 'בוטלה: המנהל שינה את השיבוץ במשמרת זו',
    });
    const result = await approveRequest(request.id, { overrideReason: 'test' });
    expect(result).toMatchObject({ ok: false });
    expect('error' in result && result.error).toContain('הבקשה כבר טופלה');
    expect((await prisma.scheduleSlot.findUniqueOrThrow({ where: { id: published.id } })).userId).toBeNull();
  });

  it('approves an urgent absence with a handling note and leaves the assignment in place', async () => {
    const published = await publishEmployeeOnMorning();
    as(employeeId);
    expect(await createDateRequest({ type: 'URGENT_ABSENCE', startDate: '2098-01-06', endDate: '2098-01-06', reason: 'מחלה' })).toEqual({ ok: true });
    const request = await prisma.employeeRequest.findFirstOrThrow({ where: { requesterId: employeeId, type: 'URGENT_ABSENCE' } });
    as(managerId);
    expect(await approveRequest(request.id)).toMatchObject({ ok: false });
    expect(await approveRequest(request.id, { decisionNote: 'הוזעק מחליף' })).toMatchObject({ ok: true, affectedSlots: [expect.objectContaining({ id: published.id })] });
    expect((await prisma.scheduleSlot.findUniqueOrThrow({ where: { id: published.id } })).userId).toBe(employeeId);
    expect((await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } })).publishedVersionId).toBe(expected.versionId);
  });
});
