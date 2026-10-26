'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { VatFilingSettings, WorkspaceTaxSettings } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { OfficialRatesPanel } from './OfficialRatesPanel';
import { SettingsSection } from './SettingsSection';

export type VatStatus = WorkspaceTaxSettings['vatStatus'];

const STATUSES: VatStatus[] = ['registered', 'small_business', 'not_registered'];

type Frequency = NonNullable<VatFilingSettings['frequency']>;

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/**
 * Whether the workspace charges VAT, and how much of its income it holds back
 * for tax. Changing the VAT status re-assesses every row not on a filed
 * return; the reserve feeds safe-to-spend on the forecast.
 */
export function TaxStatusSection(): React.ReactElement {
  const t = useIntlayer('workspaceTaxStatus');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: queryKeys.taxSettings(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings', signal, contract: 'WorkspaceTaxSettings' }),
    enabled: Boolean(workspaceId),
  });
  const reserve = useQuery({
    queryKey: queryKeys.taxReserveSettings(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings/reserve', signal, contract: 'TaxReserveSettings' }),
    enabled: Boolean(workspaceId),
  });
  const filing = useQuery({
    queryKey: queryKeys.taxVatFiling(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings/vat-filing', signal, contract: 'VatFilingSettings' }),
    enabled: Boolean(workspaceId),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: Boolean(workspaceId),
  });

  const [percent, setPercent] = useState('');
  const [paymentsCategoryId, setPaymentsCategoryId] = useState('');
  useEffect(() => {
    if (reserve.data) {
      setPercent(reserve.data.percent === null ? '' : String(reserve.data.percent));
      setPaymentsCategoryId(reserve.data.paymentsCategoryId ?? '');
    }
  }, [reserve.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tax-settings', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['tax-return', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['tax-year', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['forecast', workspaceId] });
  };

  const setStatus = useMutation({
    mutationFn: (status: VatStatus) =>
      apiClient
        .put('/tax/settings/vat-status', { status } satisfies ContractInput<'SetVatStatusBody'>)
        .then(response =>
          checkContract('VatStatusChange', response.data, '/tax/settings/vat-status'),
        ),
    onSuccess: result => {
      toast.success(fill(t.statusSaved.value, { count: result.reassessed }));
      invalidate();
    },
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const reassess = useMutation({
    mutationFn: () =>
      apiClient
        .post('/tax/settings/reassess', {} satisfies ContractInput<'ReassessTaxBody'>)
        .then(response =>
          checkContract('TaxReassessment', response.data, '/tax/settings/reassess'),
        ),
    onSuccess: result => {
      toast.success(fill(t.reassessed.value, { count: result.reassessed }));
      invalidate();
    },
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const saveFiling = useMutation({
    mutationFn: (body: ContractInput<'SetVatFilingBody'>) =>
      apiClient
        .put('/tax/settings/vat-filing', body)
        .then(response =>
          checkContract('VatFilingSettings', response.data, '/tax/settings/vat-filing'),
        ),
    onSuccess: () => {
      toast.success(t.filingSaved.value);
      invalidate();
    },
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const saveReserve = useMutation({
    mutationFn: (body: ContractInput<'SetTaxReserveBody'>) =>
      apiClient
        .put('/tax/settings/reserve', body)
        .then(response =>
          checkContract('TaxReserveSettings', response.data, '/tax/settings/reserve'),
        ),
    onSuccess: () => {
      toast.success(t.reserveSaved.value);
      invalidate();
    },
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const status = settings.data?.vatStatus;
  const statusHelp: Record<VatStatus, string> = {
    registered: t.registeredHelp.value,
    small_business: t.smallBusinessHelp.value,
    not_registered: t.notRegisteredHelp.value,
  };
  const statusLabel: Record<VatStatus, string> = {
    registered: t.registered.value,
    small_business: t.smallBusiness.value,
    not_registered: t.notRegistered.value,
  };

  const parsedPercent = percent.trim() === '' ? null : Number(percent.replace(',', '.'));
  const percentInvalid =
    parsedPercent !== null &&
    (!Number.isFinite(parsedPercent) || parsedPercent < 0 || parsedPercent > 100);
  const reserveDirty =
    reserve.data !== undefined &&
    (parsedPercent !== reserve.data.percent ||
      (paymentsCategoryId || null) !== reserve.data.paymentsCategoryId);

  const expenseCategories = (categories.data ?? []).filter(
    category => category.type === 'expense' && !category.parentId,
  );

  return (
    <SettingsSection title={t.title.value} description={t.description.value}>
      <Stack spacing={2.5}>
        {settings.isError ? <Alert severity="error">{t.loadError.value}</Alert> : null}

        <Box>
          <Select
            size="small"
            value={status ?? ''}
            disabled={!status || setStatus.isPending}
            aria-label={t.statusLabel.value}
            onChange={value => setStatus.mutate(value as VatStatus)}
            options={STATUSES.map(value => ({ value, label: statusLabel[value] }))}
            sx={{ minWidth: 280 }}
          />
          {status ? (
            <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary', maxWidth: 560 }}>
              {statusHelp[status]}
            </Typography>
          ) : null}
        </Box>

        {status === 'registered' && filing.data ? (
          <Box>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <Select
                size="small"
                value={filing.data.frequency ?? ''}
                displayEmpty
                aria-label={t.frequencyLabel.value}
                disabled={saveFiling.isPending}
                onChange={value =>
                  saveFiling.mutate({
                    frequency: (value || null) as Frequency | null,
                    extension: filing.data?.extension ?? false,
                  })
                }
                options={(['monthly', 'quarterly', 'annual'] as const).map(value => ({
                  value,
                  label: {
                    monthly: t.frequencyMonthly.value,
                    quarterly: t.frequencyQuarterly.value,
                    annual: t.frequencyAnnual.value,
                  }[value],
                }))}
                sx={{ minWidth: 220 }}
              />
              {filing.data.extensionName ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={filing.data.extension}
                      disabled={saveFiling.isPending}
                      onChange={event =>
                        saveFiling.mutate({
                          frequency: filing.data?.isDefault
                            ? null
                            : (filing.data?.frequency ?? null),
                          extension: event.target.checked,
                        })
                      }
                    />
                  }
                  label={fill(t.extensionLabel.value, { name: filing.data.extensionName })}
                />
              ) : null}
            </Stack>
            <Typography sx={{ mt: 0.75, fontSize: 12, color: 'text.secondary', maxWidth: 560 }}>
              {filing.data.deadlinesKnown ? t.remindersOn.value : t.remindersUnknown.value}
            </Typography>
          </Box>
        ) : null}

        {status === 'registered' ? <OfficialRatesPanel /> : null}

        {status === 'registered' ? (
          <Box>
            <Button
              size="small"
              variant="outlined"
              disabled={reassess.isPending}
              onClick={() => reassess.mutate()}
            >
              {reassess.isPending ? t.reassessing.value : t.reassess.value}
            </Button>
            <Typography sx={{ mt: 0.75, fontSize: 12, color: 'text.secondary', maxWidth: 560 }}>
              {t.reassessHelp.value}
            </Typography>
          </Box>
        ) : null}

        <Box
          component="form"
          aria-label={t.reserveTitle.value}
          onSubmit={event => {
            event.preventDefault();
            if (percentInvalid) return;
            saveReserve.mutate({
              percent: parsedPercent,
              paymentsCategoryId: paymentsCategoryId || null,
            });
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
            {t.reserveTitle.value}
          </Typography>
          <Typography
            sx={{ mt: 0.5, mb: 1.5, fontSize: 13, color: 'text.secondary', maxWidth: 560 }}
          >
            {t.reserveDescription.value}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label={t.percentLabel.value}
              value={percent}
              // Until the saved share arrives, typing would be overwritten by it.
              disabled={reserve.isPending}
              onChange={event => setPercent(event.target.value)}
              error={percentInvalid}
              helperText={percentInvalid ? t.percentInvalid.value : t.percentHelp.value}
              sx={{ width: 200 }}
              slotProps={{
                htmlInput: { inputMode: 'decimal', 'aria-label': t.percentLabel.value },
              }}
            />
            <CategoryPickerField
              size="small"
              value={paymentsCategoryId}
              ariaLabel={t.paymentsCategoryLabel.value}
              categories={expenseCategories}
              onChange={setPaymentsCategoryId}
              placeholder={t.noPaymentsCategory.value}
              clearLabel={t.noPaymentsCategory.value}
              sx={{ width: 'auto', minWidth: 220, maxWidth: 300 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={!reserveDirty || percentInvalid || saveReserve.isPending}
              sx={{ mt: 0.25 }}
            >
              {t.save.value}
            </Button>
          </Stack>
          <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary', maxWidth: 560 }}>
            {t.paymentsCategoryHelp.value}
          </Typography>
        </Box>
      </Stack>
    </SettingsSection>
  );
}
