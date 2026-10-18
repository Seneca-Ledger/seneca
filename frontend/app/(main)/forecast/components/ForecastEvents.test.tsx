import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ForecastEvent } from '../hooks/useForecast';
import { ForecastEvents } from './ForecastEvents';

const event = (date: string, label: string): ForecastEvent => ({
  date,
  label,
  amount: -10,
  kind: 'subscription',
  sourceId: label,
});

describe('ForecastEvents', () => {
  it('groups the next seven days as this week, then one group per month', () => {
    render(
      <ForecastEvents
        events={[
          event('2026-10-15', 'Rent'),
          event('2026-10-19', 'Framer'),
          event('2026-10-28', 'Payday'),
          event('2026-11-01', 'WeWork'),
          event('2027-01-03', 'GitHub'),
        ]}
        excluded={[]}
        onToggle={vi.fn()}
        formatAmount={String}
        today={new Date(2026, 9, 15)}
      />,
    );

    const titles = screen.getAllByRole('heading').map(heading => heading.textContent);
    // A later year names itself; this one does not.
    expect(titles).toEqual(['This week', 'October', 'November', 'January 2027']);
  });
});
