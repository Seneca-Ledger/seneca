'use client';

import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { merchantTones } from '@/app/components/charts/chart-theme';
import { LazyPayeeLines } from '@/app/components/charts/lazy-charts';
import { ArrowLeft } from '@/app/components/icons';
import { offerAction } from '@/app/components/payees/offer-action-toast';
import { PayeePicker } from '@/app/components/payees/PayeePicker';
import { takenBy } from '@/app/components/payees/TransactionPayeeSection';
import type { PayeeMode } from '@/app/components/payees/types';
import {
  useApplyPayeeCategory,
  useMergePayees,
  usePayee,
  usePayeePeers,
  usePayeeSummary,
  useSplitPayeeAlias,
  useUpdatePayee,
} from '@/app/components/payees/usePayees';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { LoadError } from '@/app/components/ui/load-error';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { VendorIcon } from '@/app/components/VendorIcon';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { PayeeSummary } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { PayeeTransactions } from '../components/PayeeTransactions';

const formatDay = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(date),
  );

/** Twelve quiet bars: what went to the payee each month, or came from it when nothing went. */
function MonthBars({ summary, tone }: { summary: PayeeSummary; tone: string }): React.JSX.Element {
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

/** The payee against the biggest others of its category, a smooth line each. */
function PeersSection({ payeeId }: { payeeId: string }): React.JSX.Element | null {
  const t = useIntlayer('payeesPage');
  const { locale } = useLocale();
  const peers = usePayeePeers(payeeId);
  const data = peers.data;
  if (!data) {
    return null;
  }
  const category = data.category ? localizeStatementCategoryName(data.category.name, locale) : null;
  return (
    <section className="seneca-all-tx__card seneca-payees__section">
      <h2 className="seneca-all-tx__card-title">
        {category
          ? t.comparisonTitle.value.replace('{{category}}', category)
          : t.comparisonTitlePlain}
      </h2>
      {data.series.length < 2 ? (
        <span className="seneca-all-tx__muted" style={{ fontSize: 14 }}>
          {t.comparisonEmpty}
        </span>
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

export default function PayeePage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const t = useIntlayer('payeesPage');
  const tPayees = useIntlayer('payees');
  const nav = useIntlayer('navigation');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();

  const payee = usePayee(id);
  const summary = usePayeeSummary(id);
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: 5 * 60_000,
    enabled: Boolean(workspaceId),
  });
  const update = useUpdatePayee();
  const merge = useMergePayees();
  const applyCategory = useApplyPayeeCategory();
  const splitAlias = useSplitPayeeAlias();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  // The picker stays until the drawer has slid away, so its rows leave with it.
  const [pickerShown, setPickerShown] = useState(false);
  const openMerge = () => {
    setPickerShown(true);
    setMergeOpen(true);
  };
  const closeMerge = () => {
    setMergeOpen(false);
    setTimeout(() => setPickerShown(false), 300);
  };
  const [pickingAlways, setPickingAlways] = useState(false);

  const fail = (error: unknown) => toast.error(getApiErrorMessage(error, tPayees.failed.value));

  const save = (body: { name?: string; mode?: PayeeMode; categoryId?: string | null }) =>
    update
      .mutateAsync({ id, ...body })
      .then(() => {
        toast.success(tPayees.saved.value);
        return true;
      })
      .catch((error: unknown) => {
        // The name belongs to another payee: offer to fold this one into it.
        const existing = takenBy(error);
        if (existing && body.name) {
          offerAction({
            message: tPayees.nameTaken.value,
            applyLabel: tPayees.merge.value,
            dismissLabel: tPayees.cancel.value,
            onApply: () =>
              void merge
                .mutateAsync({ targetId: existing, sourceIds: [id] })
                .then(() => {
                  toast.success(tPayees.merged.value);
                  router.replace(`/statements/payees/${existing}`);
                })
                .catch(fail),
          });
        } else {
          fail(error);
        }
        return false;
      });

  const changeMode = (mode: string) => {
    if (mode !== 'always') {
      setPickingAlways(false);
      void save({ mode: mode as PayeeMode });
      return;
    }
    const categoryId = payee.data?.category?.id ?? payee.data?.defaultCategory?.id ?? null;
    if (categoryId) {
      void save({ mode: 'always', categoryId });
    } else {
      setPickingAlways(true);
    }
  };

  const data = payee.data;
  const info = summary.data;
  const money = (value: number) => formatMoney(value, info?.currency ?? 'EUR', locale);

  return (
    <div className="seneca-all-tx">
      <Button
        component={Link}
        href="/statements/payees"
        size="small"
        startIcon={<ArrowLeft size={16} />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {nav.nav.payees}
      </Button>

      {payee.isError && <LoadError>{t.notFound}</LoadError>}
      {payee.isPending && <Skeleton variant="rounded" height={120} />}

      {data && (
        <>
          <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <VendorIcon vendorName={data.name} size={44} />
            {renaming === null ? (
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, flex: 1, minWidth: 0 }}>
                {data.name}
              </h1>
            ) : (
              <form
                style={{ display: 'flex', gap: 8, flex: 1, minWidth: 240 }}
                onSubmit={event => {
                  event.preventDefault();
                  void save({ name: renaming.trim() }).then(ok => ok && setRenaming(null));
                }}
              >
                <TextField
                  size="small"
                  value={renaming}
                  onChange={event => setRenaming(event.target.value)}
                  slotProps={{ htmlInput: { 'aria-label': t.rename.value } }}
                  fullWidth
                />
                <Button type="submit" variant="contained" disabled={!renaming.trim()}>
                  {t.save}
                </Button>
                <Button variant="text" onClick={() => setRenaming(null)}>
                  {t.cancel}
                </Button>
              </form>
            )}
            {renaming === null && (
              <ReadOnlyHint>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="outlined" onClick={() => setRenaming(data.name)}>
                    {t.rename}
                  </Button>
                  <Button variant="outlined" onClick={openMerge}>
                    {t.mergeWith}
                  </Button>
                </div>
              </ReadOnlyHint>
            )}
          </header>

          {info && (
            <div className="seneca-payees__figures">
              {info.spentLastYear > 0 && (
                <div>
                  <span className="seneca-payees__figure-label">{t.spentYear}</span>
                  <span className="seneca-payees__figure-value">
                    <PrivateAmount>{money(info.spentLastYear)}</PrivateAmount>
                  </span>
                </div>
              )}
              {info.receivedLastYear > 0 && (
                <div>
                  <span className="seneca-payees__figure-label">{t.receivedYear}</span>
                  <span className="seneca-payees__figure-value">
                    <PrivateAmount>{money(info.receivedLastYear)}</PrivateAmount>
                  </span>
                </div>
              )}
              {info.averageSpent !== null && (
                <div>
                  <span className="seneca-payees__figure-label">{t.average}</span>
                  <span className="seneca-payees__figure-value">
                    <PrivateAmount>{money(info.averageSpent)}</PrivateAmount>
                  </span>
                </div>
              )}
              <div>
                <span className="seneca-payees__figure-label">{t.countLabel}</span>
                <span className="seneca-payees__figure-value">{info.count}</span>
              </div>
              {info.lastSeen && (
                <div>
                  <span className="seneca-payees__figure-label">{t.lastSeen}</span>
                  <span className="seneca-payees__figure-value">
                    {formatDay(info.lastSeen, locale)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="seneca-all-tx__body">
            <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
              {info && (
                <section className="seneca-all-tx__card seneca-payees__section">
                  <h2 className="seneca-all-tx__card-title">{t.monthsTitle}</h2>
                  <MonthBars summary={info} tone={merchantTones([data.name])[0]} />
                </section>
              )}
              <PeersSection payeeId={id} />
            </div>

            <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              <section className="seneca-all-tx__card seneca-payees__section">
                <h2 className="seneca-all-tx__card-title">{t.categoryTitle}</h2>
                <Select
                  size="small"
                  fullWidth
                  value={pickingAlways ? 'always' : data.mode}
                  disabled={update.isPending}
                  aria-label={tPayees.modeLabel.value}
                  onChange={changeMode}
                  options={[
                    { value: 'auto', label: tPayees.modeAuto.value },
                    { value: 'always', label: tPayees.modeAlways.value },
                    { value: 'never', label: tPayees.modeNever.value },
                  ]}
                />
                {(data.mode === 'always' || pickingAlways) && (
                  <CategoryPickerField
                    size="small"
                    value={data.mode === 'always' ? (data.category?.id ?? '') : ''}
                    disabled={update.isPending}
                    ariaLabel={tPayees.pickCategory.value}
                    categories={categories.data ?? []}
                    placeholder={tPayees.pickCategory.value}
                    onChange={value => {
                      if (value) {
                        void save({ mode: 'always', categoryId: value }).then(
                          ok => ok && setPickingAlways(false),
                        );
                      }
                    }}
                  />
                )}
                {data.mode === 'always' && data.category && (info?.undecidedCount ?? 0) > 0 && (
                  <ReadOnlyHint>
                    <Button
                      variant="text"
                      disabled={applyCategory.isPending}
                      sx={{ justifySelf: 'start' }}
                      onClick={() =>
                        void applyCategory
                          .mutateAsync(id)
                          .then(result =>
                            toast.success(
                              t.applied.value.replace('{{count}}', String(result.updated)),
                            ),
                          )
                          .catch(fail)
                      }
                    >
                      {t.applyToPast.value.replace('{{count}}', String(info?.undecidedCount ?? 0))}
                    </Button>
                  </ReadOnlyHint>
                )}
                <span className="seneca-all-tx__muted" style={{ fontSize: 13 }}>
                  {tPayees.hint}
                </span>
              </section>

              {info && info.aliases.length > 0 && (
                <section className="seneca-all-tx__card seneca-payees__section">
                  <h2 className="seneca-all-tx__card-title">{t.aliasesTitle}</h2>
                  <span className="seneca-all-tx__muted" style={{ fontSize: 13 }}>
                    {t.aliasesHint}
                  </span>
                  <div>
                    {info.aliases.map(alias => (
                      <div key={alias.key} className="seneca-payees__row">
                        <span style={{ fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }}>
                          {alias.example ?? alias.key}
                        </span>
                        {info.aliases.length > 1 && (
                          <ReadOnlyHint>
                            <Button
                              size="small"
                              variant="text"
                              disabled={splitAlias.isPending}
                              onClick={() =>
                                void splitAlias
                                  .mutateAsync({ id, key: alias.key })
                                  .then(result =>
                                    toast.success(
                                      t.splitDone.value.replace(
                                        '{{count}}',
                                        String(result.updated),
                                      ),
                                    ),
                                  )
                                  .catch(fail)
                              }
                            >
                              {t.splitAlias}
                            </Button>
                          </ReadOnlyHint>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {info && info.subscriptions.length > 0 && (
                <section className="seneca-all-tx__card seneca-payees__section">
                  <h2 className="seneca-all-tx__card-title">{t.subscriptionsTitle}</h2>
                  {info.subscriptions.map(subscription => (
                    <Link
                      key={subscription.id}
                      href="/subscriptions"
                      className="seneca-all-tx__link"
                    >
                      {subscription.name}
                    </Link>
                  ))}
                </section>
              )}
            </div>
          </div>

          {/* Full width: the table has nine columns and needs the room. */}
          <PayeeTransactions payeeId={id} />

          <DrawerShell
            isOpen={mergeOpen}
            onClose={closeMerge}
            position="right"
            width="md"
            title={t.mergeDrawerTitle.value}
          >
            <div style={{ display: 'grid', gap: 12, padding: '4px 4px 16px' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t.mergeHint}</p>
              {pickerShown && (
                <PayeePicker
                  inline
                  existingOnly
                  current={{ id: data.id, name: data.name }}
                  disabled={merge.isPending}
                  onPick={choice => {
                    if (!('payeeId' in choice)) {
                      return;
                    }
                    void merge
                      .mutateAsync({ targetId: id, sourceIds: [choice.payeeId] })
                      .then(() => {
                        toast.success(tPayees.merged.value);
                        closeMerge();
                      })
                      .catch(fail);
                  }}
                />
              )}
            </div>
          </DrawerShell>
        </>
      )}
    </div>
  );
}
