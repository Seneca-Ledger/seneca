'use client';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { merchantTones } from '@/app/components/charts/chart-theme';
import { ArrowLeft } from '@/app/components/icons';
import { offerAction } from '@/app/components/payees/offer-action-toast';
import { PayeeDrawer } from '@/app/components/payees/PayeeDrawer';
import { takenBy } from '@/app/components/payees/TransactionPayeeSection';
import type { PayeeMode } from '@/app/components/payees/types';
import {
  useApplyPayeeCategory,
  useMergePayees,
  usePayee,
  usePayeeSummary,
  useUpdatePayee,
} from '@/app/components/payees/usePayees';
import { LoadError } from '@/app/components/ui/load-error';
import { Select } from '@/app/components/ui/select';
import { VendorIcon } from '@/app/components/VendorIcon';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { PayeeAliasesSection } from '../components/PayeeAliasesSection';
import {
  PayeeDetailSkeleton,
  PayeeFiguresSkeleton,
  PayeeMonthsSkeleton,
} from '../components/PayeeDetailSkeleton';
import { PayeeFigures } from '../components/PayeeFigures';
import { PayeeMonthBars } from '../components/PayeeMonthBars';
import { PayeePeersSection } from '../components/PayeePeersSection';
import { PayeeTransactions } from '../components/PayeeTransactions';

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

  const [renaming, setRenaming] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
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
      {payee.isPending && <PayeeDetailSkeleton payeeId={id} />}

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
                  <Button variant="outlined" onClick={() => setMergeOpen(true)}>
                    {t.mergeWith}
                  </Button>
                </div>
              </ReadOnlyHint>
            )}
          </header>

          {summary.isPending ? <PayeeFiguresSkeleton /> : null}
          {info && <PayeeFigures summary={info} money={money} />}

          <div className="seneca-all-tx__body" style={{ alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {summary.isPending ? <PayeeMonthsSkeleton /> : null}
              {info && (
                <section className="seneca-all-tx__card seneca-payees__section">
                  <h2 className="seneca-all-tx__card-title">{t.monthsTitle}</h2>
                  <PayeeMonthBars summary={info} tone={merchantTones([data.name])[0]} />
                </section>
              )}
              <PayeePeersSection payeeId={id} />
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

              {info && <PayeeAliasesSection payeeId={id} aliases={info.aliases} />}

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

          <PayeeDrawer
            open={mergeOpen}
            title={t.mergeDrawerTitle.value}
            hint={t.mergeHint}
            current={{ id: data.id, name: data.name }}
            existingOnly
            busy={merge.isPending}
            onClose={() => setMergeOpen(false)}
            onPick={choice => {
              if (!('payeeId' in choice)) {
                return;
              }
              void merge
                .mutateAsync({ targetId: id, sourceIds: [choice.payeeId] })
                .then(() => {
                  toast.success(tPayees.merged.value);
                  setMergeOpen(false);
                })
                .catch(fail);
            }}
          />
        </>
      )}
    </div>
  );
}
