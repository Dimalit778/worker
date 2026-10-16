import { describe, expect, it } from 'vitest';
import { shiftBounds } from '@/features/schedules/shift-times';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (b: { startsAt: Date; endsAt: Date }) => [b.startsAt.toISOString(), b.endsAt.toISOString()];

describe('shiftBounds (Asia/Jerusalem)', () => {
  it('uses +03:00 in summer', () => {
    expect(iso(shiftBounds(day('2026-07-15'), '07:00', '15:00'))).toEqual([
      '2026-07-15T04:00:00.000Z',
      '2026-07-15T12:00:00.000Z',
    ]);
  });

  it('uses +02:00 in winter', () => {
    expect(iso(shiftBounds(day('2026-12-15'), '07:00', '15:00'))).toEqual([
      '2026-12-15T05:00:00.000Z',
      '2026-12-15T13:00:00.000Z',
    ]);
  });

  it('ends a night shift on the next day', () => {
    expect(iso(shiftBounds(day('2026-07-15'), '23:00', '07:00'))).toEqual([
      '2026-07-15T20:00:00.000Z',
      '2026-07-16T04:00:00.000Z',
    ]);
  });

  it('handles DST start (2026-03-27): night shift spans the switch', () => {
    expect(iso(shiftBounds(day('2026-03-26'), '23:00', '07:00'))).toEqual([
      '2026-03-26T21:00:00.000Z', // +02:00
      '2026-03-27T04:00:00.000Z', // +03:00
    ]);
    expect(iso(shiftBounds(day('2026-03-27'), '07:00', '15:00'))).toEqual([
      '2026-03-27T04:00:00.000Z',
      '2026-03-27T12:00:00.000Z',
    ]);
  });

  it('handles DST end (2026-10-25): night shift spans the switch', () => {
    expect(iso(shiftBounds(day('2026-10-24'), '23:00', '07:00'))).toEqual([
      '2026-10-24T20:00:00.000Z', // +03:00
      '2026-10-25T05:00:00.000Z', // +02:00
    ]);
    expect(iso(shiftBounds(day('2026-10-25'), '07:00', '15:00'))).toEqual([
      '2026-10-25T05:00:00.000Z',
      '2026-10-25T13:00:00.000Z',
    ]);
  });
});
