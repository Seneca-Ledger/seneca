// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
