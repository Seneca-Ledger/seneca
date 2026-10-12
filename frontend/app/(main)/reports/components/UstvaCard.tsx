'use client';

import { Alert, Box, Button, Link as MuiLink, Stack, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useUpdatePayee } from '@/app/components/payees/usePayees';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import type { TaxReturnLine } from './tax-return.helpers';

interface UstvaField {
  kz: string;
  line: number;
  label: string;
  kind: 'base' | 'tax';
  amount: number;
  transactionIds: string[];
}

interface UstvaOpenItem {
  reason: 'zero_rated' | 'supply_type_unknown';
  direction: 'income' | 'expense';
  lines: number[];
  net: number;
  tax: number;
  payeeId: string | null;
  payeeName: string | null;
  transactionIds: string[];
}

export interface UstvaResult {
  unsupported: 'not_germany' | 'not_registered' | 'form_year_unknown' | 'period_spans_years' | null;
  form: {
    year: number;
    sourceUrl: string;
    checkedAt: string;
    fields: UstvaField[];
    kz83: number;
    open: UstvaOpenItem[];
  } | null;
  missingRates: Array<{ transactionId: string }>;
  sondervorauszahlungDue: boolean;
}

/** As ELSTER takes it: whole euros for a base, euros with a decimal comma for tax. */
export function elsterAmount(amount: number, kind: 'base' | 'tax'): string {
  return kind === 'base' ? String(Math.trunc(amount)) : amount.toFixed(2).replace('.', ',');
}

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/**
 * The period on the lines of the German Umsatzsteuer-Voranmeldung, to type
 * into Mein ELSTER: Kennzahl, line and amount, each with the transactions
 * behind it. What the data cannot place is listed, not guessed.
 */
export function UstvaCard({
  period,
  lines,
}: {
  period: { periodStart: string; periodEnd: string };
  lines: TaxReturnLine[];
}): React.ReactElement | null {
  const t = useIntlayer('ustvaCard');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const updatePayee = useUpdatePayee();
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryKey = queryKeys.taxUstva({ workspaceId, ...period });

  const ustva = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQuery<UstvaResult>({
        url: `/tax/returns/ustva?periodStart=${period.periodStart}&periodEnd=${period.periodEnd}`,
        signal,
      }),
    enabled: Boolean(workspaceId),
  });

  const data = ustva.data;
  if (!data || data.unsupported === 'not_germany' || data.unsupported === 'not_registered') {
    return null;
  }

  const year = period.periodStart.slice(0, 4);
  const lineOf = new Map(lines.map(line => [line.transactionId, line]));
  const copy = (value: string) => {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => toast.success(t.copied.value))
      .catch(() => undefined);
  };
  const mark = (payeeId: string, supplyType: 'goods' | 'services') =>
    void updatePayee
      .mutateAsync({ id: payeeId, supplyType })
      .then(() => queryClient.invalidateQueries({ queryKey }))
      .catch((error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value)));

  return (
    <Box
      data-testid="ustva-card"
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 2, sm: 3 } }}
    >
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
        {fill(t.title.value, { year })}
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 2, fontSize: 13, color: 'text.secondary', maxWidth: 640 }}>
        {fill(t.description.value, { year })}
      </Typography>

      {data.unsupported === 'form_year_unknown' ? (
        <Alert severity="info">{fill(t.formUnknown.value, { year })}</Alert>
      ) : data.unsupported === 'period_spans_years' ? (
        <Alert severity="info">{t.spansYears.value}</Alert>
      ) : data.form ? (
        <Stack spacing={2}>
          <Stack component="ul" spacing={0} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {data.form.fields.map(field => (
              <FieldRow
                key={`${field.kz}-${field.line}`}
                field={field}
                lineOf={lineOf}
                expanded={expanded === `${field.kz}-${field.line}`}
                onToggle={key => setExpanded(expanded === key ? null : key)}
                onCopy={copy}
              />
            ))}
            <Box
              component="li"
              data-testid="ustva-kz-83"
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, py: 1 }}
            >
              <Typography sx={{ fontSize: 12, color: 'text.secondary', width: 64 }}>
                {fill(t.lineLabel.value, { line: 50 })}
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, width: 56 }}>Kz 83</Typography>
              <Typography sx={{ fontSize: 13, flex: '1 1 220px', minWidth: 0 }}>
                {t.kz83Label.value}
              </Typography>
              <Typography
                sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                {elsterAmount(data.form.kz83, 'tax')} €
              </Typography>
              <Button size="small" onClick={() => copy(elsterAmount(data.form?.kz83 ?? 0, 'tax'))}>
                {t.copy.value}
              </Button>
            </Box>
          </Stack>

          {data.form.open.length > 0 ? (
            <Alert severity="warning" data-testid="ustva-open">
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
                {t.openTitle.value}
              </Typography>
              <Stack spacing={1}>
                {data.form.open.map(item => (
                  <OpenItemRow
                    key={`${item.reason}-${item.direction}-${item.payeeId ?? item.transactionIds[0]}`}
                    item={item}
                    busy={updatePayee.isPending}
                    onMark={mark}
                  />
                ))}
                <Typography sx={{ fontSize: 12 }}>{t.kz83Incomplete.value}</Typography>
              </Stack>
            </Alert>
          ) : null}

          {data.sondervorauszahlungDue ? (
            <Alert severity="info">{t.sondervorauszahlung.value}</Alert>
          ) : null}
          {data.missingRates.length > 0 ? (
            <Alert severity="warning">
              {fill(t.missingRates.value, { count: data.missingRates.length })}
            </Alert>
          ) : null}

          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {fill(t.basisNote.value, { date: data.form.checkedAt })}{' '}
            <MuiLink href={data.form.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t.sourceLink.value}
            </MuiLink>
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}

/** One Kennzahl: line, label, the amount as ELSTER takes it, and the rows behind it. */
function FieldRow({
  field,
  lineOf,
  expanded,
  onToggle,
  onCopy,
}: {
  field: UstvaField;
  lineOf: Map<string, TaxReturnLine>;
  expanded: boolean;
  onToggle: (key: string) => void;
  onCopy: (value: string) => void;
}): React.ReactElement {
  const t = useIntlayer('ustvaCard');
  const key = `${field.kz}-${field.line}`;
  const value = elsterAmount(field.amount, field.kind);
  return (
    <Box
      component="li"
      data-testid={`ustva-kz-${field.kz}`}
      sx={{ borderBottom: '1px solid var(--border)', py: 1 }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', width: 64 }}>
          {fill(t.lineLabel.value, { line: field.line })}
        </Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 600, width: 56 }}>Kz {field.kz}</Typography>
        <Typography sx={{ fontSize: 13, flex: '1 1 220px', minWidth: 0 }}>{field.label}</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {value} €
        </Typography>
        <Button size="small" onClick={() => onCopy(value)}>
          {t.copy.value}
        </Button>
        <Button size="small" onClick={() => onToggle(key)} aria-expanded={expanded}>
          {fill(t.transactionsCount.value, { count: field.transactionIds.length })}
        </Button>
      </Box>
      {expanded ? (
        <Stack spacing={0.25} sx={{ mt: 0.5, pl: { sm: 15 } }}>
          {field.transactionIds.map(id => {
            const line = lineOf.get(id);
            return (
              <Typography key={id} sx={{ fontSize: 12, color: 'text.secondary' }}>
                {line
                  ? `${line.date} · ${line.counterparty} · ${line.taxAmountConverted.toFixed(2)}`
                  : id}
              </Typography>
            );
          })}
        </Stack>
      ) : null}
    </Box>
  );
}

/** An amount the data cannot place, and for a payee, the choice that places it. */
function OpenItemRow({
  item,
  busy,
  onMark,
}: {
  item: UstvaOpenItem;
  busy: boolean;
  onMark: (payeeId: string, supplyType: 'goods' | 'services') => void;
}): React.ReactElement {
  const t = useIntlayer('ustvaCard');
  const template =
    item.reason === 'zero_rated'
      ? t.openZeroRated.value
      : item.direction === 'income'
        ? t.openSupplyIncome.value
        : t.openSupplyExpense.value;
  const payeeId = item.reason === 'supply_type_unknown' ? item.payeeId : null;
  return (
    <Box>
      <Typography sx={{ fontSize: 13 }}>
        {fill(template, {
          payee: item.payeeName ?? '—',
          net: elsterAmount(item.net, 'tax'),
          tax: elsterAmount(item.tax, 'tax'),
        })}
      </Typography>
      {payeeId ? (
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={() => onMark(payeeId, 'goods')}
          >
            {t.markGoods.value}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={busy}
            onClick={() => onMark(payeeId, 'services')}
          >
            {t.markServices.value}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
