// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SHORTCUT_NEXT_MONTH, SHORTCUT_PREVIOUS_MONTH } from '@/app/lib/keyboard-shortcuts';
import { MonthStrip } from './MonthStrip';

vi.mock('@/app/components/icons', () => ({
  ChevronLeft: () => <span data-testid="chevron-left" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
}));

const labels = { group: 'Select month', previousYear: 'Previous year', nextYear: 'Next year' };
const now = new Date(2026, 7, 20); // 20 Aug 2026

describe('MonthStrip', () => {
  it('renders twelve month chips with the active month pressed', () => {
    render(
      <MonthStrip
        displayMonth={new Date(2026, 7, 1)}
        onChange={() => undefined}
        locale="en"
        labels={labels}
        now={now}
      />,
    );
    const group = screen.getByRole('group', { name: 'Select month' });
    const chips = group.querySelectorAll('button');
    expect(chips).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Aug' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Jan' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables future months of the current year', () => {
    render(
      <MonthStrip
        displayMonth={new Date(2026, 7, 1)}
        onChange={() => undefined}
        locale="en"
        labels={labels}
        now={now}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sep' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dec' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jul' })).toBeEnabled();
  });

  it('reports the clicked month for the displayed year', () => {
    const onChange = vi.fn();
    render(
      <MonthStrip
        displayMonth={new Date(2026, 7, 1)}
        onChange={onChange}
        locale="en"
        labels={labels}
        now={now}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mar' }));
    expect(onChange).toHaveBeenCalledWith(2026, 2);
  });

  it('steps the year and disables next-year at the current year', () => {
    const onChange = vi.fn();
    render(
      <MonthStrip
        displayMonth={new Date(2026, 7, 1)}
        onChange={onChange}
        locale="en"
        labels={labels}
        now={now}
      />,
    );
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(onChange).toHaveBeenCalledWith(2025, 7);
  });

  it('clamps to the current month when stepping forward would land in the future', () => {
    const onChange = vi.fn();
    render(
      <MonthStrip
        displayMonth={new Date(2025, 10, 1)}
        onChange={onChange}
        locale="en"
        labels={labels}
        now={now}
      />,
    );
    expect(screen.getByRole('button', { name: 'Dec' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    expect(onChange).toHaveBeenCalledWith(2026, 7);
  });

  it('localises month names', () => {
    render(
      <MonthStrip
        displayMonth={new Date(2026, 0, 1)}
        onChange={() => undefined}
        locale="ru"
        labels={labels}
        now={now}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Jan' })).toBeNull();
    expect(screen.getByRole('button', { name: /янв/i })).toBeInTheDocument();
  });

  describe('arrow keys', () => {
    const renderAt = (displayMonth: Date) => {
      const onChange = vi.fn();
      render(
        <MonthStrip
          displayMonth={displayMonth}
          onChange={onChange}
          locale="en"
          labels={labels}
          now={now}
        />,
      );
      return onChange;
    };

    it('steps back a month with the left arrow, across the year boundary', () => {
      const onChange = renderAt(new Date(2026, 0, 1));
      fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith(2025, 11);
    });

    it('steps forward a month with the right arrow', () => {
      const onChange = renderAt(new Date(2025, 11, 1));
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith(2026, 0);
    });

    it('does not step past the current month', () => {
      const onChange = renderAt(new Date(2026, 7, 1));
      fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('leaves arrows alone while focus is on something that uses them', () => {
      const onChange = renderAt(new Date(2026, 5, 1));
      const tab = document.createElement('button');
      tab.setAttribute('role', 'tab');
      document.body.append(tab);
      fireEvent.keyDown(tab, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(onChange).not.toHaveBeenCalled();
      tab.remove();
    });

    it('ignores arrows held with a modifier', () => {
      const onChange = renderAt(new Date(2026, 5, 1));
      fireEvent.keyDown(window, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('steps when the command palette asks', () => {
      const onChange = renderAt(new Date(2026, 5, 1));
      window.dispatchEvent(new CustomEvent(SHORTCUT_PREVIOUS_MONTH));
      expect(onChange).toHaveBeenCalledWith(2026, 4);
      window.dispatchEvent(new CustomEvent(SHORTCUT_NEXT_MONTH));
      expect(onChange).toHaveBeenLastCalledWith(2026, 6);
    });
  });
});
