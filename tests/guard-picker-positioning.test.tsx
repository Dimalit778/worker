// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuardPicker } from '@/features/schedules/shared/guard-picker';

const rect = (top: number, left = 100): DOMRect => ({
  top, bottom: top + 30, left, right: left + 100, width: 100, height: 30, x: left, y: top,
  toJSON: () => ({}),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('innerHeight', 600);
  vi.stubGlobal('innerWidth', 800);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...rect(0), width: 176, height: 300 });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function picker(initial: DOMRect) {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  const bounds = vi.fn(() => initial);
  anchor.getBoundingClientRect = bounds;
  const onClose = vi.fn();
  const rendered = render(<GuardPicker
    employees={[{ id: 'e', displayName: 'עובד בדיקה', position: null }]}
    currentUserId={null} anchorRect={initial} anchorElement={anchor}
    onSelect={vi.fn()} onRemove={vi.fn()} onClose={onClose}
  />);
  const panel = screen.getByPlaceholderText('חיפוש...').parentElement!.parentElement!;
  return { panel, anchor, bounds, onClose, unmount: () => { rendered.unmount(); anchor.remove(); } };
}

it('opens above a bottom cell and keeps the entire panel visible', () => {
  const { panel, unmount } = picker(rect(550));
  expect(panel).toHaveStyle({ top: '246px' });
  expect(Number.parseFloat(panel.style.top) + 300).toBeLessThan(600);
  unmount();
});

it('opens below a top cell and clamps the right edge to the viewport', () => {
  const { panel, unmount } = picker(rect(30, 760));
  expect(panel).toHaveStyle({ top: '64px', left: '616px' });
  unmount();
});

it('limits the height when neither side can fit the menu', () => {
  vi.stubGlobal('innerHeight', 250);
  const { panel, unmount } = picker(rect(100));
  expect(panel).toHaveStyle({ maxHeight: '108px' });
  unmount();
});

it('tracks its anchor during background scroll and closes when the anchor leaves the screen', () => {
  const { panel, bounds, onClose, unmount } = picker(rect(30));
  bounds.mockReturnValue(rect(100));
  fireEvent.scroll(document);
  act(() => vi.advanceTimersByTime(20));
  expect(panel).toHaveStyle({ top: '134px' });
  bounds.mockReturnValue(rect(-50));
  fireEvent.scroll(document);
  act(() => vi.advanceTimersByTime(20));
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
});

it('keeps employee-list scrolling inside the picker without dismissing it', () => {
  const { bounds, onClose, unmount } = picker(rect(30));
  bounds.mockClear();
  fireEvent.scroll(screen.getByRole('list'));
  act(() => vi.advanceTimersByTime(20));
  expect(bounds).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  unmount();
});
