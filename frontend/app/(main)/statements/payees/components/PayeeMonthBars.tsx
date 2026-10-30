import { useLocale } from '@/app/i18n';
import type { PayeeSummary } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';

/** Twelve quiet bars: what went to the payee each month, or came from it when nothing went. */
export function PayeeMonthBars({
  summary,
  tone,
}: {
  summary: PayeeSummary;
  tone: string;
}): React.JSX.Element {
  const { locale } = useLocale();
  const spends = summary.spentLastYear > 0;
  const values = summary.months.map(month => (spends ? month.spent : month.received));
  const highest = Math.max(...values, 0);
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  return (
    <div className="seneca-payees__bars">
      {summary.months.map((month, index) => {
        const value = values[index];
        return (
          <div
            key={month.month}
            className="seneca-payees__bar"
            title={`${month.month}: ${formatMoney(value, summary.currency, locale)}`}
          >
            <span
              className="seneca-payees__bar-fill"
              style={{ height: highest > 0 ? `${(value / highest) * 90}%` : 0, background: tone }}
            />
            <span className="seneca-payees__bar-label">
              {monthName.format(new Date(`${month.month}-01T00:00:00Z`))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
