'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useConfirmStatement } from '@/app/(main)/statements/[id]/edit/hooks/useConfirmStatement';
import { useStatementReviewCounts } from '@/app/(main)/statements/components/hooks/useStatementReviewCounts';
import { RowsToggle } from '@/app/(main)/statements/components/StatementsListItemCells';
import { StatementTransactionsPanel } from '@/app/(main)/statements/components/StatementTransactionsPanel';
import { DocumentThumbnailPreview } from '@/app/components/DocumentThumbnailPreview';
import { formatDate } from '@/app/components/transactions/helpers/transactionFormatters';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { ReviewInboxDocument, ReviewInboxItem } from '../lib/review-inbox-model';

type ReviewColumn = 'receipt' | 'merchant' | 'category' | 'amount';

// Resolved once the confirmation lands: the shared invalidation refreshes Review.
const NO_RELOAD = async (): Promise<void> => undefined;

/**
 * A statement's waiting rows as one line, built from the Documents pieces: its
 * "Transactions: N ▾" toggle opens the same rows panel under it, and "Confirm
 * all" is the statement page's action (rows without a category stay here).
 */
export function ReviewDocumentGroup({
  document,
  items,
  expanded,
  onToggle,
  onOpen,
  columnStyle,
  selectCellSx,
  isMobile,
  onOpenPreview,
}: {
  document: ReviewInboxDocument;
  items: ReviewInboxItem[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  columnStyle: (column: ReviewColumn) => React.CSSProperties;
  selectCellSx: Record<string, unknown>;
  isMobile: boolean;
  onOpenPreview: (document: ReviewInboxDocument) => void;
}): React.JSX.Element {
  const labels = useIntlayer('statementEditPage').labels as Record<string, { value: string }>;
  const { locale } = useLocale();
  // The page holds only the first rows of the queue; the count is the statement's own.
  const waiting = useStatementReviewCounts(true)[document.id] ?? items.length;
  const { confirming, confirmAll } = useConfirmStatement(document.id, NO_RELOAD, {
    done: labels.confirmAllDone?.value,
    uncategorized: labels.confirmAllUncategorized?.value,
    failed: labels.confirmAllFailed?.value,
  });
  const dates = items
    .map(item => ('date' in item ? item.date : null))
    .filter((date): date is string => Boolean(date))
    .sort();
  const span = [...new Set([dates[0], dates[dates.length - 1]])]
    .filter(Boolean)
    .map(date => formatDate(date, locale))
    .join(' – ');

  return (
    <>
      <Box
        data-testid="review-document-group"
        onClick={onOpen}
        className="seneca-stmt-list-item"
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      >
        <Box sx={{ ...selectCellSx, mr: 2 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={columnStyle('receipt')}>
            <DocumentThumbnailPreview
              fileId={document.id}
              fileName={document.fileName ?? ''}
              fileType={document.fileType ?? document.fileName ?? ''}
              source={document.source}
              onOpen={() => onOpenPreview(document)}
              testId={`review-thumbnail-${document.id}`}
            />
          </div>
          <div style={columnStyle('merchant')}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                width: '100%',
              }}
            >
              <Typography
                component="span"
                noWrap
                title={document.fileName ?? undefined}
                sx={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: 'var(--foreground)',
                }}
              >
                {document.fileName}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                component="span"
                sx={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  mt: 0.25,
                }}
              >
                {span}
                {' · '}
                <RowsToggle
                  transactionCount={waiting}
                  expanded={expanded}
                  onToggleExpand={onToggle}
                />
              </Typography>
            </Box>
          </div>
          {isMobile ? null : <div style={columnStyle('category')} />}
          <div
            style={
              isMobile ? { flex: '0 0 auto' } : { ...columnStyle('amount'), overflow: 'visible' }
            }
            onClick={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="seneca-review-group__confirm"
              disabled={confirming}
              onClick={() => void confirmAll()}
            >
              {labels.confirmAll?.value}
            </button>
          </div>
        </Box>
      </Box>
      {expanded ? <StatementTransactionsPanel statementId={document.id} unconfirmedOnly /> : null}
    </>
  );
}
