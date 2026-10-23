'use client';

import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatMoney } from '@/app/lib/format-money';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The automatic choice: the rules and the workspace default pick the rate. */
const AUTOMATIC = '';

/**
 * The tax rate of the receipt's transaction, picked from the workspace's rates.
 *
 * The rate lives on the transaction, not the receipt, because that is what
 * every tax figure sums. Left on automatic it follows the rules and the
 * workspace default; a rate picked here wins over both.
 */
export function ReceiptTaxField({
  id,
  receiptId,
  date,
  currency,
  sx,
}: {
  id: string;
  receiptId: string;
  /** The receipt's date: only the rates in force on it are offered. */
  date: string;
  currency: string;
  sx?: SxProps<Theme>;
}): React.ReactElement {
  const t = useIntlayer('receiptParsedDataForm');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const taxKey = queryKeys.receiptTax({ workspaceId, receiptId });

  const taxQuery = useQuery({
    queryKey: taxKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/receipts/${receiptId}/tax`,
        signal,
        contract: 'ReceiptTax',
      }),
    enabled: Boolean(workspaceId),
  });
  const ratesQuery = useQuery({
    queryKey: queryKeys.taxRatesInForce({ workspaceId, date }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/tax/settings/rates',
        params: date ? { date } : undefined,
        signal,
        contract: 'TaxRateList',
      }),
    enabled: Boolean(workspaceId),
  });

  const pick = useMutation({
    mutationFn: async (taxRateId: string | null) => {
      const response = await apiClient.put(`/receipts/${receiptId}/tax`, {
        taxRateId,
      } satisfies ContractInput<'SetReceiptTaxBody'>);
      return checkContract('ReceiptTax', response.data, `/receipts/${receiptId}/tax`);
    },
    onSuccess: tax => {
      queryClient.setQueryData(taxKey, tax);
      // The row's tax moves the VAT return, the reserve and the reports.
      invalidateFinancialData();
    },
    onError: () => {
      toast.error(t.taxSaveFailed.value);
    },
  });

  const tax = taxQuery.data;
  const rates = ratesQuery.data ?? [];
  const usable = Boolean(tax?.transactionId && tax.assessable && !tax.locked);
  const selected = tax?.taxSource === 'manual' && tax.taxRateId ? tax.taxRateId : AUTOMATIC;
  const appliedRate = rates.find(rate => rate.id === tax?.taxRateId);

  const note = (() => {
    if (!tax) {
      return null;
    }
    if (!tax.transactionId) {
      return t.taxNoTransaction.value;
    }
    if (!tax.assessable) {
      return t.taxNotRegistered.value;
    }
    if (tax.locked) {
      return t.taxLocked.value;
    }
    if (tax.taxAmount === null) {
      return t.taxSourceNone.value;
    }
    const source =
      tax.taxSource === 'manual'
        ? t.taxSourceManual.value
        : tax.taxSource === 'rule'
          ? t.taxSourceRule.value
          : t.taxSourceDefault.value;
    const rateName = selected === AUTOMATIC && appliedRate ? ` (${appliedRate.name})` : '';
    return `${formatMoney(Number(tax.taxAmount), currency, locale)} · ${source}${rateName}`;
  })();

  return (
    <Box>
      <Select
        fullWidth
        id={id}
        inputProps={{ 'aria-label': t.tax.value }}
        value={selected}
        disabled={!usable || pick.isPending}
        onChange={value => pick.mutate(value === AUTOMATIC ? null : value)}
        options={[
          { value: AUTOMATIC, label: t.taxAutomatic.value },
          // Rate names carry their percentage already ("USt 19%").
          ...rates.map(rate => ({ value: rate.id, label: rate.name })),
        ]}
        sx={sx}
      />
      {note ? (
        <Box
          component="p"
          sx={{
            m: 0,
            mt: 0.5,
            fontSize: 13,
            color: 'text.secondary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {note}
        </Box>
      ) : null}
    </Box>
  );
}
