'use client';

import Skeleton from '@mui/material/Skeleton';

const WEEKDAYS = 7;
const CELLS = 35;

/** The calendar's own frame — weekdays and a 5-week grid — while records load. */
export function SpendOverTimeCalendarSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="lumio-spend-calendar">
      <div className="lumio-spend-calendar__grid">
        {Array.from({ length: WEEKDAYS }, (_, index) => (
          <Skeleton key={`weekday-${index}`} variant="text" width="40%" height={18} />
        ))}
        {Array.from({ length: CELLS }, (_, index) => (
          <Skeleton
            key={`cell-${index}`}
            variant="rounded"
            className="lumio-spend-calendar__day"
            sx={{ height: 'auto', border: 0 }}
          />
        ))}
      </div>
    </section>
  );
}
