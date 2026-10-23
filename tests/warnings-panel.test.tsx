// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmployeeWarningsPanel, WarningsPanel } from '@/features/schedules/warnings/components/warnings-panel';
import { groupWarningsByEmployee } from '@/features/schedules/warnings/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

afterEach(cleanup);

const warning: ScheduleWarningSummary = {
  id: 'warning', type: 'UNFILLED', severity: 'ERROR',
  message: '05/10/2026 · בוקר — חסר אחמ״ש', date: '2026-10-05', shiftType: 'MORNING', employeeName: null, positionName: null,
};

it('displays the specific critical problem instead of only its generic type', () => {
  render(<WarningsPanel warnings={[warning]} />);
  expect(screen.getByText(warning.message)).toBeInTheDocument();
});

it('keeps a type label for warnings without a message', () => {
  render(<WarningsPanel warnings={[{ ...warning, message: '' }]} />);
  expect(screen.getByText('תקן לא מאויש')).toBeInTheDocument();
});

it('shows only the week and missing shift for minimum issues in compact mode', () => {
  const morning: ScheduleWarningSummary = { ...warning, id: 'morning', type: 'MIN_NOT_MET', weekNumber: 1,
    employeeName: 'בני', message: 'שבוע 1: נדרשות 2 משמרות בוקר; בפועל: 0.' };
  const evening: ScheduleWarningSummary = { ...morning, id: 'evening', weekNumber: 2, shiftType: 'EVENING',
    message: 'שבוע 2: נדרשת משמרת ערב אחת; בפועל: 0.' };
  render(<EmployeeWarningsPanel groups={groupWarningsByEmployee([morning, evening])} compact />);
  expect(screen.getByText('בני')).toBeInTheDocument();
  expect(screen.getByText('שבוע 1 — חסר בוקר')).toBeInTheDocument();
  expect(screen.getByText('שבוע 2 — חסר ערב')).toBeInTheDocument();
  expect(screen.queryByText(/בפועל|נדרשות|2 בעיות/)).not.toBeInTheDocument();
});

it('keeps the explanation and shift context of non-minimum issues in compact mode', () => {
  render(<EmployeeWarningsPanel groups={groupWarningsByEmployee([{ ...warning, type: 'CONFLICT', employeeName: 'בני',
    message: 'העובד משובץ בזמן חופשה מאושרת.' }])} compact />);
  expect(screen.getByText('העובד משובץ בזמן חופשה מאושרת. — 05/10 · בוקר')).toBeInTheDocument();
});
