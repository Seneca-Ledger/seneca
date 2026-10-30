import Skeleton from '@mui/material/Skeleton';
import { useIntlayer } from '@/app/i18n';

const ROWS = [
  { name: 120, when: 180, result: 150, stats: 90 },
  { name: 150, when: 220, result: 120, stats: 110 },
  { name: 100, when: 160, result: 140, stats: 90 },
];

/**
 * The rules table while it loads: its real column heads over three rows with a
 * line where each rule's name, conditions, result and count will be.
 */
export function RulesSkeleton({ canEdit }: { canEdit: boolean }) {
  const t = useIntlayer('categorizationRules');
  return (
    <table className="seneca-rules-table" aria-busy="true">
      <thead>
        <tr>
          <th scope="col">
            <span className="u-visually-hidden">{t.page.order}</span>
          </th>
          <th scope="col">{t.page.nameColumn}</th>
          <th scope="col">{t.page.when}</th>
          <th scope="col">{t.page.thenLabel}</th>
          <th scope="col">{t.page.matchedColumn}</th>
          <th scope="col">
            <span className="u-visually-hidden">{t.page.actions}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(row => (
          <tr key={row.name} className="seneca-rules-table__row">
            <td className="seneca-rules-table__grip-cell">
              {canEdit && <Skeleton variant="rounded" width={18} height={18} />}
            </td>
            <td className="seneca-rules-table__name-cell">
              <Skeleton variant="text" width={row.name} />
            </td>
            <td data-label={t.page.when.value}>
              <Skeleton variant="text" width={row.when} />
            </td>
            <td data-label={t.page.thenLabel.value}>
              <Skeleton variant="text" width={row.result} />
            </td>
            <td className="seneca-rules-table__stats">
              <Skeleton variant="text" width={row.stats} />
            </td>
            <td className="seneca-rules-table__controls">
              {canEdit && (
                <Skeleton variant="rounded" width={28} height={16} sx={{ borderRadius: '999px' }} />
              )}
              <Skeleton variant="circular" width={24} height={24} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
