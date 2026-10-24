'use client';

import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { usePayeeDuplicates, usePayeesOverview } from '@/app/components/payees/usePayees';
import { Button } from '@/app/components/ui/button';
import { LoadError } from '@/app/components/ui/load-error';
import { PageTitle } from '@/app/components/ui/page-title';
import { AppPagination } from '@/app/components/ui/pagination';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { periodFromParams } from '../../transactions/all-transactions';
import { MonthsColumn } from '../../transactions/components/MonthsColumn';
import { DuplicatesDrawer } from './DuplicatesDrawer';
import { PayeesTable } from './PayeesTable';

const PAGE_SIZE = 50;

type Direction = 'expense' | 'income';

/**
 * Who was paid, and who paid us, in a month or ever: the Firefly III expense
 * and revenue accounts, on the layout of All transactions (the table, the
 * months beside it, `?month=` / `?all=1` in the address).
 */
export function PayeesView(): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const { locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = periodFromParams(searchParams);
  const direction: Direction = searchParams.get('direction') === 'income' ? 'income' : 'expense';
  const [search, setSearch] = useState('');
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  // The page belongs to one period, direction and search; changing any starts afresh.
  const viewKey = `${period.kind === 'all' ? 'all' : period.month}:${direction}:${search}`;
  const [paging, setPaging] = useState({ viewKey, page: 1 });
  const page = paging.viewKey === viewKey ? paging.page : 1;

  const overview = usePayeesOverview({
    month: period.kind === 'month' ? period.month : undefined,
    direction,
    search,
    page,
    limit: PAGE_SIZE,
  });
  const duplicates = usePayeeDuplicates();
  const data = overview.data;
  const totalPages = Math.max(1, Math.ceil((data?.totalPayees ?? 0) / PAGE_SIZE));
  const periodName =
    period.kind === 'all'
      ? t.allTime.value
      : new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
          new Date(`${period.month}-01T00:00:00Z`),
        );

  const goTo = (next: { month?: string; all?: boolean; direction?: Direction }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.direction) {
      params.set('direction', next.direction);
    } else {
      params.delete('month');
      params.delete('all');
      if (next.all) {
        params.set('all', '1');
      } else if (next.month) {
        params.set('month', next.month);
      }
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const groups = duplicates.data ?? [];

  return (
    <div className="seneca-all-tx">
      <header className="seneca-all-tx__header">
        <PageTitle
          path="/statements/payees"
          summary={`${direction === 'income' ? t.receivedTab.value : t.spentTab.value} · ${periodName}`}
        />
      </header>

      <div className="seneca-payees__toolbar">
        <TextTabs
          value={direction}
          onChange={value => goTo({ direction: value })}
          ariaLabel={t.directionLabel.value}
          options={[
            { value: 'expense', label: t.spentTab },
            { value: 'income', label: t.receivedTab },
          ]}
        />
        <TextField
          size="small"
          value={search}
          placeholder={t.searchPlaceholder.value}
          onChange={event => setSearch(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': t.searchPlaceholder.value } }}
          sx={{ minWidth: 220 }}
        />
      </div>

      {groups.length > 0 && (
        <div className="seneca-payees__notice">
          <span>{t.duplicatesTitle.value.replace('{{count}}', String(groups.length))}</span>
          <Button variant="ghost" onClick={() => setDuplicatesOpen(true)}>
            {t.duplicatesAction}
          </Button>
        </div>
      )}

      <div className="seneca-all-tx__scope">
        {period.kind === 'all' ? (
          <button type="button" className="seneca-all-tx__text-link" onClick={() => goTo({})}>
            {t.showByMonth}
          </button>
        ) : (
          <button
            type="button"
            className="seneca-all-tx__text-link"
            onClick={() => goTo({ all: true })}
          >
            {t.showEverything}
          </button>
        )}
      </div>

      <div className="seneca-all-tx__body">
        <section className="seneca-all-tx__card seneca-all-tx__list">
          <div className="seneca-all-tx__list-head">
            <h2 className="seneca-all-tx__card-title">{periodName}</h2>
            {data && (
              <span className="seneca-all-tx__muted">
                {fillTemplateNodes(t.total.value, {
                  amount: formatMoney(data.totalAmount, data.currency, locale),
                })}
                {' · '}
                {t.payeeCount.value.replace('{{count}}', String(data.totalPayees))}
              </span>
            )}
          </div>
          {data && data.missingRates.length > 0 && (
            <p className="seneca-all-tx__state seneca-all-tx__muted">
              {t.unconvertedNote.value.replace('{{list}}', data.missingRates.join(', '))}
            </p>
          )}
          {overview.isError ? (
            <LoadError>{t.loadFailed}</LoadError>
          ) : overview.isPending ? (
            <div className="seneca-all-tx__state">
              {Array.from({ length: 6 }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={index} variant="rounded" height={36} />
              ))}
            </div>
          ) : (data?.rows.length ?? 0) === 0 ? (
            <p className="seneca-all-tx__state seneca-all-tx__muted">{t.empty}</p>
          ) : (
            <PayeesTable rows={data?.rows ?? []} currency={data?.currency ?? ''} />
          )}
          {totalPages > 1 ? (
            <AppPagination
              className="seneca-all-tx__pagination"
              page={page}
              total={totalPages}
              onChange={next => setPaging({ viewKey, page: next })}
            />
          ) : null}
        </section>

        <MonthsColumn
          months={data?.months ?? []}
          selected={period.kind === 'month' ? period.month : null}
          onSelect={month => goTo({ month })}
        />
      </div>

      <DuplicatesDrawer
        open={duplicatesOpen}
        groups={groups}
        onClose={() => setDuplicatesOpen(false)}
      />
    </div>
  );
}
