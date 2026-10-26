import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { PayeeSummary } from '@/app/lib/contracts';

const formatDay = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(date),
  );

/** The payee's figures for the last year: spent, received, average, how often, last seen. */
export function PayeeFigures({
  summary,
  money,
}: {
  summary: PayeeSummary;
  /** An amount in the summary's currency. */
  money: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const { locale } = useLocale();
  return (
    <div className="seneca-payees__figures">
      {summary.spentLastYear > 0 && (
        <div>
          <span className="seneca-payees__figure-label">{t.spentYear}</span>
          <span className="seneca-payees__figure-value">
            <PrivateAmount>{money(summary.spentLastYear)}</PrivateAmount>
          </span>
        </div>
      )}
      {summary.receivedLastYear > 0 && (
        <div>
          <span className="seneca-payees__figure-label">{t.receivedYear}</span>
          <span className="seneca-payees__figure-value">
            <PrivateAmount>{money(summary.receivedLastYear)}</PrivateAmount>
          </span>
        </div>
      )}
      {summary.averageSpent !== null && (
        <div>
          <span className="seneca-payees__figure-label">{t.average}</span>
          <span className="seneca-payees__figure-value">
            <PrivateAmount>{money(summary.averageSpent)}</PrivateAmount>
          </span>
        </div>
      )}
      <div>
        <span className="seneca-payees__figure-label">{t.countLabel}</span>
        <span className="seneca-payees__figure-value">{summary.count}</span>
      </div>
      {summary.lastSeen && (
        <div>
          <span className="seneca-payees__figure-label">{t.lastSeen}</span>
          <span className="seneca-payees__figure-value">{formatDay(summary.lastSeen, locale)}</span>
        </div>
      )}
    </div>
  );
}
