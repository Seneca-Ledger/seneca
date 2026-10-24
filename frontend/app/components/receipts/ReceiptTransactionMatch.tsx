'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient, {
  type ReceiptMatchCandidate,
  type ReceiptRecord,
  type ReceiptSplitSuggestion,
  receiptsApi,
} from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';
import { groupSplitItems } from './helpers/receipt-split-groups';
import type { ReceiptCategoryOption } from './receipt-types';

interface Props {
  receipt: ReceiptRecord;
  /** The workspace's categories, for moving a line to another one before the split. */
  categories: ReceiptCategoryOption[];
  saving: boolean;
  /** Approves through the page's own flow (autosave, then approve) with the given target. */
  onApprove: (options: { transactionId?: string | null }) => Promise<void>;
  /** Reloads the receipt after a split. */
  onChanged: () => Promise<void>;
}

const formatMoney = (amount: number, currency: string, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);

/**
 * The bank row a parsed receipt documents, with the two ways to approve it,
 * and — once attached — the split of that row by line items: a preview where
 * each line's category can be changed before anything is booked, and an undo.
 */
// eslint-disable-next-line max-lines-per-function, complexity
export function ReceiptTransactionMatch({
  receipt,
  categories,
  saving,
  onApprove,
  onChanged,
}: Props) {
  const t = useIntlayer('receiptDocumentPage');
  const { locale: appLocale } = useLocale();
  const [candidates, setCandidates] = useState<ReceiptMatchCandidate[]>([]);
  const [suggestion, setSuggestion] = useState<ReceiptSplitSuggestion | null>(null);
  // The suggestion's lines as the user corrects them.
  const [items, setItems] = useState<ReceiptSplitSuggestion['items']>([]);
  // Split already: as the receipt says, or as just applied or undone here.
  const [split, setSplit] = useState(Boolean(receipt.transactionSplit));
  useEffect(() => {
    setSplit(Boolean(receipt.transactionSplit));
  }, [receipt.transactionSplit]);
  const [busy, setBusy] = useState(false);
  const match = receipt.metadata?.transactionMatch ?? null;
  const approved = receipt.status === 'approved' && Boolean(receipt.transactionId);
  const lineItems = (receipt.parsedData?.lineItems ?? []).filter(item => item.amount > 0);
  const locale = typeof navigator === 'undefined' ? 'en' : navigator.language;

  useEffect(() => {
    if (approved || !match) {
      setCandidates([]);
      return;
    }
    let active = true;
    receiptsApi
      .transactionMatches(receipt.id)
      .then(result => {
        if (active) setCandidates(result.data.filter(row => match.transactionIds.includes(row.id)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [receipt.id, approved, match]);

  const parts = useMemo(
    () => (suggestion ? groupSplitItems(items, suggestion.total) : []),
    [items, suggestion],
  );
  const categoryName = (id: string | null): string => {
    const category = id ? categories.find(option => option.id === id) : undefined;
    return category ? getCategoryDisplayName(category, appLocale) : t.uncategorised.value;
  };

  const loadSplit = useCallback(async () => {
    setBusy(true);
    await receiptsApi
      .splitSuggestion(receipt.id)
      .then(next => {
        if (next.alreadySplit) {
          setSplit(true);
          return;
        }
        setSuggestion(next);
        // A line the suggestion left open goes where the split would put it anyway.
        setItems(
          next.items.map(item => ({
            ...item,
            categoryId: item.categoryId ?? next.fallbackCategoryId,
          })),
        );
      })
      .catch(() => toast.error(t.splitFailed.value));
    setBusy(false);
  }, [receipt.id, t.splitFailed.value]);

  const applySplit = useCallback(async () => {
    setBusy(true);
    await receiptsApi
      .splitByLineItems(receipt.id, items)
      .then(async () => {
        toast.success(t.splitDone.value);
        setSuggestion(null);
        setSplit(true);
        invalidateFinancialData();
        await onChanged();
      })
      .catch(() => toast.error(t.splitFailed.value));
    setBusy(false);
  }, [receipt.id, items, onChanged, t.splitDone.value, t.splitFailed.value]);

  const undoSplit = useCallback(async () => {
    if (!receipt.transactionId) return;
    setBusy(true);
    await apiClient
      .post(`/transactions/${receipt.transactionId}/unsplit`)
      .then(async () => {
        toast.success(t.splitUndone.value);
        setSplit(false);
        invalidateFinancialData();
        await onChanged();
      })
      .catch(() => toast.error(t.splitFailed.value));
    setBusy(false);
  }, [receipt.transactionId, onChanged, t.splitUndone.value, t.splitFailed.value]);

  if (!(approved || match)) return null;
  if (approved && lineItems.length < 2) return null;

  return (
    <Box
      data-testid="receipt-transaction-match"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        p: 2,
        display: 'grid',
        gap: 1,
      }}
    >
      {!approved && match && (
        <>
          <Typography variant="subtitle2">
            {match.kind === 'multi' ? t.matchMulti.value : t.matchTitle.value}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t.matchHelp.value}
          </Typography>
          {candidates.map(row => (
            <Typography key={row.id} variant="body2">
              {row.transactionDate.slice(0, 10)} · {row.counterpartyName} ·{' '}
              <PrivateAmount>{formatMoney(row.amount, row.currency, locale)}</PrivateAmount>
            </Typography>
          ))}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              disabled={saving}
              onClick={() => void onApprove({})}
            >
              {t.approveAttach.value}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={saving}
              onClick={() => void onApprove({ transactionId: null })}
            >
              {t.approveNew.value}
            </Button>
          </Box>
        </>
      )}

      {approved &&
        (split ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.splitAlready.value}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => void undoSplit()}
            >
              {t.splitUndo.value}
            </Button>
          </Box>
        ) : suggestion ? (
          <>
            <Typography variant="subtitle2">{t.splitPreview.value}</Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.splitReviewHint.value}
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              {items.map((item, index) => (
                <Box
                  key={`${index}-${item.description}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) auto 220px' },
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography variant="body2" noWrap title={item.description}>
                    {item.description}
                  </Typography>
                  <Typography
                    variant="body2"
                    className={PRIVATE_CLASS}
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatMoney(item.amount, suggestion.currency, locale)}
                  </Typography>
                  <CategoryPickerField
                    size="small"
                    ariaLabel={t.splitItemCategory.value.replace('{item}', item.description)}
                    value={item.categoryId ?? ''}
                    categories={categories}
                    onChange={categoryId =>
                      setItems(current =>
                        current.map((line, lineIndex) =>
                          lineIndex === index ? { ...line, categoryId: categoryId || null } : line,
                        ),
                      )
                    }
                    placeholder={t.uncategorised.value}
                    clearLabel={t.uncategorised.value}
                  />
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {parts.map(part => (
                <Chip
                  key={part.categoryId ?? 'none'}
                  size="small"
                  label={
                    <>
                      {categoryName(part.categoryId)}:{' '}
                      <PrivateAmount>
                        {formatMoney(part.amount, suggestion.currency, locale)}
                      </PrivateAmount>
                    </>
                  }
                  title={part.items.join(', ')}
                />
              ))}
            </Box>
            {parts.length >= 2 ? (
              <Button
                size="small"
                variant="contained"
                disabled={busy}
                onClick={() => void applySplit()}
              >
                {t.splitApply.value}
              </Button>
            ) : (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {t.splitOneCategory.value}
              </Typography>
            )}
          </>
        ) : (
          <Button size="small" variant="outlined" disabled={busy} onClick={() => void loadSplit()}>
            {t.splitByItems.value}
          </Button>
        ))}
    </Box>
  );
}
