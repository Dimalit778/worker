// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WarningsPanel } from '@/features/schedules/warnings/components/warnings-panel';
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
