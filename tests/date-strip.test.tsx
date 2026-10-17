// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DateStrip } from '@/features/schedules/current-schedule/components/date-strip';
import { buildDayOptions, buildPeriodWeekGrids } from '@/features/schedules/current-schedule/schedule-data';
afterEach(cleanup);
it('shows one week, navigates by keyboard and returns to the previous week', async () => {
  const days = buildDayOptions('2026-10-18', '2026-10-31');
  const weeks = buildPeriodWeekGrids('2026-10-18', '2026-10-31', new Map(days.map(d => [d.iso, d])));
  function TestStrip() { const [date, setDate] = useState('2026-10-18'); return <DateStrip weeks={weeks} selectedDate={date} onSelectDate={setDate} />; }
  render(<TestStrip />);
  expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6);
  expect(screen.getByRole('button', { name: /השבוע הקודם/ })).toBeDisabled();
  const next = screen.getByRole('button', { name: /השבוע הבא/ });
  next.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByText('שבוע 2 מתוך 2')).toBeInTheDocument();
  expect(next).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /השבוע הקודם/ }));
  expect(screen.getByText('שבוע 1 מתוך 2')).toBeInTheDocument();
});
