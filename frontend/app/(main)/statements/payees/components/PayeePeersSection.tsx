import Skeleton from '@mui/material/Skeleton';
import { LazyPayeeLines } from '@/app/components/charts/lazy-charts';
import { usePayeePeers } from '@/app/components/payees/usePayees';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ChartLineIcon } from '@/app/components/ui/empty-state-icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';

/** The comparison card while it loads; its title names the category, so it waits too. */
export function PayeePeersSkeleton(): React.JSX.Element {
  return (
    <section
      className="seneca-all-tx__card seneca-payees__section"
      style={{ flex: 1, gridTemplateRows: 'auto 1fr' }}
      aria-busy="true"
    >
      <Skeleton variant="text" width={220} height={24} />
      <Skeleton variant="rounded" sx={{ height: '100%', minHeight: 160 }} />
    </section>
  );
}

/** The payee against the biggest others of its category, a smooth line each. */
export function PayeePeersSection({ payeeId }: { payeeId: string }): React.JSX.Element | null {
  const t = useIntlayer('payeesPage');
  const { locale } = useLocale();
  const peers = usePayeePeers(payeeId);
  const data = peers.data;
  if (peers.isPending) {
    return <PayeePeersSkeleton />;
  }
  if (!data) {
    return null;
  }
  const category = data.category ? localizeStatementCategoryName(data.category.name, locale) : null;
  const empty = data.series.length < 2;
  return (
    // The card takes the rest of the column, as tall as the cards beside it.
    <section
      className="seneca-all-tx__card seneca-payees__section"
      style={{ flex: 1, gridTemplateRows: 'auto 1fr' }}
    >
      <h2 className="seneca-all-tx__card-title">
        {category
          ? t.comparisonTitle.value.replace('{{category}}', category)
          : t.comparisonTitlePlain}
      </h2>
      {empty ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState compact icon={<ChartLineIcon />} description={t.comparisonEmpty} />
        </div>
      ) : (
        <div className="seneca-payees__lines">
          <LazyPayeeLines
            months={data.months}
            lines={data.series}
            locale={locale}
            formatValue={value => formatMoney(value, data.currency, locale)}
            formatTick={value => formatMoney(value, data.currency, locale, { notation: 'compact' })}
          />
        </div>
      )}
    </section>
  );
}
