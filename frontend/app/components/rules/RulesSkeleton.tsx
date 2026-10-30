import Skeleton from '@mui/material/Skeleton';
import type { ReactNode } from 'react';

const ROWS = [
  { name: 120, when: 180, result: 210, stats: 90 },
  { name: 150, when: 220, result: 170, stats: 140 },
  { name: 100, when: 160, result: 200, stats: 90 },
];

/**
 * The rules list while it loads: the real card and "When"/"Then" words, with a
 * line where each rule's name, conditions, result and count will be.
 */
export function RulesSkeleton({
  when,
  then,
  canEdit,
}: {
  when: ReactNode;
  then: ReactNode;
  canEdit: boolean;
}) {
  return (
    <ul className="seneca-rules__list" aria-busy="true">
      {ROWS.map(row => (
        <li key={row.name} className="seneca-rules__row">
          <div className="seneca-rules__body">
            <span className="seneca-rules__name">
              <Skeleton variant="text" width={row.name} />
            </span>
            <span className="seneca-rules__line">
              <span className="seneca-rules__key">{when}</span>{' '}
              <Skeleton variant="text" width={row.when} sx={{ display: 'inline-block' }} />
            </span>
            <span className="seneca-rules__line">
              <span className="seneca-rules__key">{then}</span>{' '}
              <Skeleton variant="text" width={row.result} sx={{ display: 'inline-block' }} />
            </span>
            <span className="seneca-rules__stats">
              <Skeleton variant="text" width={row.stats} />
            </span>
          </div>
          {canEdit && (
            <div className="seneca-rules__controls">
              <Skeleton variant="rounded" width={40} height={24} sx={{ borderRadius: '999px' }} />
              <Skeleton variant="rounded" width={48} height={30} />
              <Skeleton variant="rounded" width={56} height={30} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
