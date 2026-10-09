'use client';

import MuiTooltip from '@mui/material/Tooltip';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatMonthParam } from '@/app/(main)/dashboard/helpers/dashboard-url-state';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { DocumentTypeIcon } from '@/app/components/DocumentTypeIcon';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Receipt,
} from '@/app/components/icons';
import { NotesBadge } from '@/app/components/notes/NotesBadge';
import { PDFThumbnail } from '@/app/components/PDFThumbnail';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { tokens } from '@/lib/theme-tokens';
import {
  DEFAULT_STATEMENT_COLUMNS,
  type StatementColumn,
  type StatementColumnId,
  statementColumnWidthStyle,
} from './columns/statement-columns';
import { resolveStatementSortDate } from './StatementsListView.utils';

export type StatementListItem = {
  id: string;
  source?: 'statement' | 'gmail' | 'scan';
  receiptSource?: string;
  fileName: string;
  subject?: string;
  sender?: string;
  status: string;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  createdAt: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName: string;
  fileType: string;
  currency?: string | null;
  exported?: boolean | null;
  paid?: boolean | null;
  processedAt?: string;
  receivedAt?: string;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    category?: string;
    categoryId?: string;
    lineItems?: Array<{ description: string; amount?: number }>;
  };
  category?: {
    id?: string | null;
    name?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  tags?: Array<{ id?: string; name?: string; color?: string | null }>;
  transactionSummary?: {
    description?: string | null;
    exchangeRate?: string | number | null;
    exchangeRateMixed?: boolean;
    cardLabel?: string | null;
  } | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  errorMessage?: string | null;
  parsingDetails?: {
    detectedBy?: string;
    importPreview?: {
      source?: string;
      description?: string;
      merchant?: string;
      categoryId?: string;
    };
    metadataExtracted?: {
      currency?: string;
      headerDisplay?: {
        currencyDisplay?: string;
      };
    };
  };
};

type DuplicateRole = 'primary' | 'suspected';
type DuplicateGroupTone = 'sky' | 'blue' | 'indigo' | 'slate' | 'zinc' | 'stone';

type DuplicateGroupStyle = {
  rowBorderColor: string;
  rowBg: string;
  lineColor: string;
  badgeBg: string;
  badgeColor: string;
  buttonBorder: string;
  buttonBg: string;
  buttonColor: string;
  buttonHoverBorder: string;
  buttonHoverBg: string;
  buttonHoverColor: string;
};

const DUPLICATE_GROUP_STYLES: Record<DuplicateGroupTone, DuplicateGroupStyle> = {
  blue: {
    rowBorderColor: 'var(--color-info-soft-border)',
    rowBg: 'rgba(239,246,255,0.1)',
    lineColor: 'rgba(147,197,253,0.9)',
    badgeBg: 'var(--color-info-soft-border)',
    badgeColor: 'var(--color-info-soft-text)',
    buttonBorder: 'var(--color-info-soft-border)',
    buttonBg: 'var(--color-info-soft-bg)',
    buttonColor: 'var(--color-info-soft-text)',
    buttonHoverBorder: 'var(--color-info-soft-border)',
    buttonHoverBg: 'var(--color-info-soft-border)',
    buttonHoverColor: '#1e40af',
  },
  sky: {
    rowBorderColor: 'var(--color-info-soft-bg)',
    rowBg: 'rgba(240,249,255,0.1)',
    lineColor: 'rgba(125,211,252,0.9)',
    badgeBg: 'var(--color-info-soft-bg)',
    badgeColor: 'var(--color-info-soft-text)',
    buttonBorder: 'var(--color-info-soft-border)',
    buttonBg: 'var(--color-info-soft-bg)',
    buttonColor: 'var(--color-info-soft-text)',
    buttonHoverBorder: 'var(--color-info-soft-border)',
    buttonHoverBg: 'var(--color-info-soft-bg)',
    buttonHoverColor: '#075985',
  },
  indigo: {
    rowBorderColor: 'var(--color-success-soft-bg)',
    rowBg: 'rgba(237,247,237,0.1)',
    lineColor: 'rgba(168,213,168,0.9)',
    badgeBg: 'var(--color-success-soft-bg)',
    badgeColor: 'var(--primary)',
    buttonBorder: 'var(--color-success-soft-border)',
    buttonBg: 'var(--color-success-soft-bg)',
    buttonColor: 'var(--primary)',
    buttonHoverBorder: 'var(--color-success-soft-border)',
    buttonHoverBg: 'var(--color-success-soft-bg)',
    buttonHoverColor: 'var(--primary-strong)',
  },
  slate: {
    rowBorderColor: 'var(--border-color)',
    rowBg: 'rgba(248,250,252,0.3)',
    lineColor: 'rgba(148,163,184,0.85)',
    badgeBg: 'var(--muted)',
    badgeColor: 'var(--text-secondary)',
    buttonBorder: 'var(--border-color)',
    buttonBg: 'var(--muted)',
    buttonColor: 'var(--text-secondary)',
    buttonHoverBorder: 'var(--border-color)',
    buttonHoverBg: 'var(--muted)',
    buttonHoverColor: 'var(--text-secondary)',
  },
  zinc: {
    rowBorderColor: 'var(--border-color)',
    rowBg: 'rgba(250,250,250,0.3)',
    lineColor: 'rgba(161,161,170,0.85)',
    badgeBg: 'var(--muted)',
    badgeColor: 'var(--text-secondary)',
    buttonBorder: 'var(--border-color)',
    buttonBg: 'var(--muted)',
    buttonColor: 'var(--text-secondary)',
    buttonHoverBorder: 'var(--border-color)',
    buttonHoverBg: 'var(--muted)',
    buttonHoverColor: 'var(--text-primary)',
  },
  stone: {
    rowBorderColor: 'var(--border-color)',
    rowBg: 'rgba(250,250,249,0.3)',
    lineColor: 'rgba(168,162,158,0.85)',
    badgeBg: 'var(--muted)',
    badgeColor: 'var(--text-secondary)',
    buttonBorder: 'var(--border-color)',
    buttonBg: 'var(--muted)',
    buttonColor: 'var(--text-secondary)',
    buttonHoverBorder: 'var(--border-color)',
    buttonHoverBg: 'var(--muted)',
    buttonHoverColor: 'var(--text-primary)',
  },
};

type Props = {
  dataTourId?: string;
  statement: StatementListItem;
  viewLabel: string;
  duplicateActionLabel?: string;
  isReceipt: boolean;
  isProcessing: boolean;
  merchantLabel: string;
  amountLabel: string;
  dateLabel: string;
  onView: () => void;
  onIconClick: () => void;
  onToggleSelect?: () => void;
  selected?: boolean;
  selectionDisabled?: boolean;
  typeLabel?: string;
  isManualExpense?: boolean;
  isPossibleDuplicate?: boolean;
  duplicatePosition?: number;
  duplicateGroupSize?: number;
  duplicateRole?: DuplicateRole;
  duplicateGroupLabel?: string;
  duplicateGroupTone?: DuplicateGroupTone;
  duplicateReason?: string;
  viewDisabled?: boolean;
  columns?: StatementColumn[];
  currentExchangeRateLabels?: Record<string, string>;
  workspaceCurrency?: string | null;
  /** Rows of this statement still in Review, or 1 for a receipt not yet approved. */
  pendingReview?: number;
};

const EMPTY_CELL = '—';
const APPROVED_STATUSES = new Set(['completed', 'parsed', 'validated']);
const NUMERIC_COLUMN_IDS = new Set<StatementColumnId>(['amount', 'exchangeRate']);

const normalizeExchangeRateCurrency = (
  ...currencies: Array<string | null | undefined>
): string | null => {
  const normalized = firstNonEmpty(...currencies)?.toUpperCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'NIS' || normalized === '\u20aa') {
    return 'ILS';
  }
  return normalized;
};

const columnCellStyle = (columnId: StatementColumnId): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  justifyContent:
    columnId === 'receipt'
      ? 'center'
      : columnId === 'action' || columnId === 'amount'
        ? 'flex-end'
        : undefined,
  ...statementColumnWidthStyle(columnId),
});

const textCellStyle = (columnId: StatementColumnId, muted = false): React.CSSProperties => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
  textAlign: NUMERIC_COLUMN_IDS.has(columnId) ? 'right' : 'left',
  color: muted ? 'var(--muted-foreground)' : 'var(--foreground)',
});

const firstNonEmpty = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

const formatBoolean = (value: boolean | null, yes: string, no: string): string => {
  if (value === null) return EMPTY_CELL;
  return value ? yes : no;
};

/**
 * How long the pointer has to rest on the category chip before it lights up.
 * Until it does, the chip is still part of the row and a click opens the
 * statement — the green sweep is what says "this one goes somewhere else".
 */
const CATEGORY_LINK_DELAY_MS = 450;

/**
 * The category chip opens the Top categories leaderboard on the statement's own
 * month with that category's row ringed — the same `?month=&focus=category:<name>`
 * contract advice links use (app/components/insights/insight-href.ts, read by
 * app/hooks/useAttentionFocus.ts). The leaderboard has no category ids, so rows
 * are keyed by the lowercased name.
 */
const categoryHref = (categoryLabel: string, statement: StatementListItem): string => {
  const params = new URLSearchParams();
  const sortDate = resolveStatementSortDate(statement);
  if (sortDate > 0) {
    params.set('month', formatMonthParam(new Date(sortDate)));
  }
  params.set('focus', `category:${categoryLabel.trim().toLowerCase()}`);
  return `/reports?tab=cash-flow&${params.toString()}`;
};

function StatusBadge({
  status,
  isProcessing,
  errorMessage,
}: {
  status: string;
  isProcessing: boolean;
  errorMessage?: string | null;
}) {
  const listText = useIntlayer('statementsListUi');
  if (errorMessage || status === 'error') {
    return <span className="lumio-stmt-badge lumio-stmt-badge--error">{listText.statusError}</span>;
  }
  if (isProcessing || status === 'processing' || status === 'uploaded') {
    return (
      <span className="lumio-stmt-badge lumio-stmt-badge--pending">{listText.statusPending}</span>
    );
  }
  // Parsed, but the balance did not reconcile: held out of analytics until a user
  // confirms it on the statement page.
  if (status === 'needs_review') {
    return (
      <span className="lumio-stmt-badge lumio-stmt-badge--review">
        {listText.statusNeedsReview}
      </span>
    );
  }
  if (status === 'completed' || status === 'parsed' || status === 'validated') {
    return (
      <span className="lumio-stmt-badge lumio-stmt-badge--completed">
        {listText.statusCompleted}
      </span>
    );
  }
  return null;
}

export function StatementsListItem({
  dataTourId,
  statement,
  viewLabel,
  duplicateActionLabel,
  isReceipt,
  isProcessing,
  merchantLabel,
  amountLabel,
  dateLabel,
  onView,
  onIconClick,
  onToggleSelect,
  selected = false,
  selectionDisabled = false,
  typeLabel,
  isManualExpense = false,
  isPossibleDuplicate = false,
  duplicatePosition,
  duplicateGroupSize,
  duplicateRole,
  duplicateGroupLabel,
  duplicateGroupTone,
  duplicateReason,
  viewDisabled = false,
  columns = DEFAULT_STATEMENT_COLUMNS,
  currentExchangeRateLabels,
  workspaceCurrency,
  pendingReview = 0,
}: Props) {
  const { resolvedTheme } = useTheme();
  const listText = useIntlayer('statementsListUi');
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const PREVIEW_WIDTH = 430;
  const PREVIEW_HEIGHT = 620;
  const PREVIEW_IMAGE_WIDTH = (PREVIEW_WIDTH - 16) * 2;
  const thumbnailButtonRef = useRef<HTMLButtonElement | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewPosition(null);
  }, []);

  const [categoryLit, setCategoryLit] = useState(false);
  const categoryTimerRef = useRef<number | undefined>(undefined);

  const lightCategoryAfterDwell = useCallback(() => {
    window.clearTimeout(categoryTimerRef.current);
    categoryTimerRef.current = window.setTimeout(
      () => setCategoryLit(true),
      CATEGORY_LINK_DELAY_MS,
    );
  }, []);

  const unlightCategory = useCallback(() => {
    window.clearTimeout(categoryTimerRef.current);
    setCategoryLit(false);
  }, []);

  useEffect(() => () => window.clearTimeout(categoryTimerRef.current), []);

  const resolvedTypeLabel = typeLabel || statement.fileType;
  const isGmailReceipt = statement.source === 'gmail';
  const isLocalReceipt = statement.source === 'scan';
  const previewSource = isGmailReceipt ? 'gmail' : isLocalReceipt ? 'receipt' : 'statement';
  const normalizedPreviewType = (isReceipt ? 'pdf' : statement.fileType || statement.fileName || '')
    .trim()
    .toLowerCase();
  const hasHoverPreview =
    normalizedPreviewType === 'pdf' ||
    normalizedPreviewType.includes('pdf') ||
    normalizedPreviewType.endsWith('/pdf') ||
    normalizedPreviewType === 'application/pdf';

  const updatePreviewPosition = useCallback(() => {
    const trigger = thumbnailButtonRef.current;
    if (!trigger?.isConnected || typeof window === 'undefined') {
      closePreview();
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 12;

    const maxTop = Math.max(16, viewportHeight - PREVIEW_HEIGHT - 16);
    const centeredTop = triggerRect.top + triggerRect.height / 2 - PREVIEW_HEIGHT / 2;
    const top = Math.min(Math.max(16, centeredTop), maxTop);

    const rightSideLeft = triggerRect.right + gap;
    const fitsOnRight = rightSideLeft + PREVIEW_WIDTH <= viewportWidth - 12;
    const left = fitsOnRight ? rightSideLeft : Math.max(12, triggerRect.left - PREVIEW_WIDTH - gap);

    setPreviewPosition({ top, left });
  }, [closePreview]);

  useEffect(() => {
    if (!previewVisible) return;

    updatePreviewPosition();

    const handleDismiss = () => {
      closePreview();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
      }
    };

    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('wheel', handleDismiss, { capture: true, passive: true });
    window.addEventListener('touchmove', handleDismiss, { capture: true, passive: true });
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('blur', handleDismiss);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('wheel', handleDismiss, true);
      window.removeEventListener('touchmove', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('blur', handleDismiss);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, previewVisible, updatePreviewPosition]);

  const hasError = !!statement.errorMessage || statement.status === 'error';
  const isPendingStatement = statement.status === 'uploaded' || statement.status === 'processing';
  const compactAmountLabel = amountLabel.replace(/\s+/g, '');
  const isZeroAmountLabel = /^0(?:[.,]0+)?\D*$/.test(compactAmountLabel);
  const isNegativeAmount = amountLabel.startsWith('-') && amountLabel !== '-';
  const isMissingAmount = amountLabel === '-';
  const showAmountLoader =
    !isReceipt && isPendingStatement && (isZeroAmountLabel || isMissingAmount);
  const resolvedDuplicateRole: DuplicateRole = duplicateRole || 'suspected';
  const resolvedDuplicateGroupLabel = duplicateGroupLabel || listText.group.value;
  const resolvedDuplicateGroupTone: DuplicateGroupTone = duplicateGroupTone || 'stone';
  const duplicateStyle = DUPLICATE_GROUP_STYLES[resolvedDuplicateGroupTone];
  const duplicateRoleLabel =
    resolvedDuplicateRole === 'primary' ? listText.rolePrimary.value : listText.roleSuspected.value;
  const duplicateBadgeLabel = isPossibleDuplicate
    ? `${resolvedDuplicateGroupLabel} · ${duplicateRoleLabel} #${duplicatePosition || 1}${duplicateGroupSize ? `/${duplicateGroupSize}` : ''}`
    : null;
  const duplicateTooltipText = duplicateReason || listText.duplicateReasonSame.value;
  const actionLabel = isPossibleDuplicate
    ? duplicateActionLabel || listText.review.value
    : viewLabel;
  const duplicateRoleBadgeStyle: React.CSSProperties =
    resolvedDuplicateRole === 'primary'
      ? { fontWeight: 700, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }
      : resolvedTheme === 'dark'
        ? {
            fontWeight: 500,
            border: '1px dashed rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            opacity: 0.9,
          }
        : {
            fontWeight: 500,
            border: '1px dashed rgba(0,0,0,0.15)',
            background: 'rgba(255,255,255,0.7)',
            opacity: 0.8,
          };
  const duplicateRoleButtonStyle: React.CSSProperties =
    resolvedDuplicateRole === 'primary'
      ? { fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
      : { fontWeight: 500, borderStyle: 'dashed', opacity: 0.9 };
  const duplicateCardStyle: React.CSSProperties =
    resolvedTheme === 'dark'
      ? {
          borderColor: duplicateStyle.lineColor,
          background: `color-mix(in srgb, ${duplicateStyle.lineColor} 10%, var(--content-row-bg, ${c.surface}))`,
          boxShadow: `inset 0 0 0 1px ${duplicateStyle.rowBorderColor}`,
        }
      : {
          borderColor: duplicateStyle.rowBorderColor,
          backgroundColor: `var(--content-row-bg, ${c.surface})`,
          boxShadow: `inset 0 0 0 1px ${duplicateStyle.rowBorderColor}`,
        };
  const handleView = () => {
    if (viewDisabled) {
      return;
    }
    onView();
  };
  const visibleColumns = columns.filter(column => column.visible);
  const renderedColumns = visibleColumns.length > 0 ? visibleColumns : columns.slice(0, 1);
  const sourceLabel = isGmailReceipt
    ? 'Gmail'
    : isLocalReceipt
      ? listText.typeReceipt.value
      : statement.bankName;
  // importPreview.categoryId is deliberately not a fallback: it is a bare id,
  // and rendering it puts a raw UUID in the column.
  const categoryLabel = firstNonEmpty(statement.category?.name, statement.parsedData?.category);
  const tagsLabel =
    statement.tags
      ?.map(tag => tag.name)
      .filter(Boolean)
      .join(', ') || null;
  const descriptionLabel = firstNonEmpty(
    statement.parsingDetails?.importPreview?.description,
    statement.parsedData?.lineItems?.[0]?.description,
    statement.transactionSummary?.description,
    statement.subject,
  );
  const statementCurrency = normalizeExchangeRateCurrency(
    statement.currency,
    statement.parsedData?.currency,
    statement.parsingDetails?.metadataExtracted?.currency,
    statement.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay,
  );
  const targetCurrency = normalizeExchangeRateCurrency(workspaceCurrency) ?? FALLBACK_CURRENCY;
  const usdExchangeRateLabel = targetCurrency
    ? currentExchangeRateLabels?.[`USD:${targetCurrency}`]
    : null;
  const currentExchangeRateLabel =
    statementCurrency && targetCurrency
      ? currentExchangeRateLabels?.[`${statementCurrency}:${targetCurrency}`]
      : null;
  const exchangeRateLabel =
    usdExchangeRateLabel ??
    currentExchangeRateLabel ??
    (statement.transactionSummary?.exchangeRateMixed
      ? listText.mixed.value
      : firstNonEmpty(statement.transactionSummary?.exchangeRate));
  const approvedLabel = formatBoolean(
    APPROVED_STATUSES.has(statement.status.toLowerCase()),
    listText.yes.value,
    listText.no.value,
  );
  const billableLabel = formatBoolean(
    !(isMissingAmount || isZeroAmountLabel),
    listText.yes.value,
    listText.no.value,
  );
  const exportedLabel = formatBoolean(
    Boolean(statement.exported ?? statement.processedAt),
    listText.yes.value,
    listText.no.value,
  );

  const renderPlainCell = (
    columnId: StatementColumnId,
    value: string | null,
  ): React.JSX.Element => (
    <span style={textCellStyle(columnId, !value || value === EMPTY_CELL)}>
      {value || EMPTY_CELL}
    </span>
  );

  const handleCategoryClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    // Ctrl/cmd/shift-click is the browser's own "open elsewhere"; let it be,
    // and only keep it off the row.
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      event.stopPropagation();
      return;
    }
    if (!categoryLit) {
      // Not lit yet, so the chip is still just a cell of the row: swallow the
      // navigation and let the click bubble up and open the statement.
      event.preventDefault();
      return;
    }
    event.stopPropagation();
  };

  const renderCategoryCell = (): React.JSX.Element => {
    if (!categoryLabel) return renderPlainCell('category', null);
    return (
      <Link
        href={categoryHref(categoryLabel, statement)}
        className={`lumio-stmt-category-link${categoryLit ? ' lumio-stmt-category-link--lit' : ''}`}
        onClick={handleCategoryClick}
        onMouseEnter={lightCategoryAfterDwell}
        onMouseLeave={unlightCategory}
        // Keyboard focus has no pointer crossing the column to ignore, so it
        // lights the chip at once and Enter goes to the leaderboard.
        onFocus={() => setCategoryLit(true)}
        onBlur={unlightCategory}
        title={listText.categoryLink.value.replace('{category}', categoryLabel)}
      >
        <span className="lumio-stmt-category-link__badge">
          <CategoryIconBadge
            name={categoryLabel}
            color={statement.category?.color}
            icon={statement.category?.icon}
            size={22}
          />
        </span>
        <span
          className="lumio-stmt-category-link__text"
          data-label={categoryLabel}
          style={{ ...textCellStyle('category'), width: 'auto', minWidth: 0 }}
        >
          {categoryLabel}
        </span>
      </Link>
    );
  };

  const renderReceiptCell = (): React.JSX.Element => (
    <div style={{ position: 'relative', pointerEvents: 'auto' }}>
      <button
        type="button"
        ref={thumbnailButtonRef}
        data-testid={`statement-thumbnail-trigger-${statement.id}`}
        style={{
          width: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.15s',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
        onClick={event => {
          event.stopPropagation();
          onIconClick();
        }}
        onMouseEnter={() => setPreviewVisible(true)}
        onMouseLeave={closePreview}
        aria-label={statement.fileName}
      >
        <span
          style={{
            color: c.ink400,
            opacity: 0.6,
            transition: 'opacity 0.15s',
            display: 'contents',
          }}
        >
          <DocumentTypeIcon
            fileType={isReceipt ? 'pdf' : statement.fileType}
            fileName={statement.fileName}
            fileId={statement.id}
            source={previewSource}
            size={28}
            muted
          />
        </span>
      </button>

      {hasHoverPreview && previewVisible && previewPosition
        ? createPortal(
            <div
              data-testid="statement-hover-preview"
              style={{
                pointerEvents: 'none',
                position: 'fixed',
                zIndex: 140,
                borderRadius: tokens.radius.lg,
                border: `1px solid ${c.ink150}`,
                background: 'var(--card-bg)',
                padding: 8,
                boxShadow: tokens.shadow.lg,
                top: previewPosition.top,
                left: previewPosition.left,
                width: PREVIEW_WIDTH,
                maxWidth: 'min(430px, calc(100vw - 24px))',
              }}
            >
              <PDFThumbnail
                fileId={statement.id}
                fileName={statement.fileName}
                source={previewSource}
                width={PREVIEW_WIDTH - 16}
                thumbnailWidth={PREVIEW_IMAGE_WIDTH}
                height={PREVIEW_HEIGHT}
                preservePageAspect
                errorMessage="Unable to load document"
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  const renderMerchantCell = (): React.JSX.Element => (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, pointerEvents: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flexShrink: 0, opacity: 0.6 }}>
          {isGmailReceipt ? (
            <img
              src="/icons/gmail.png"
              alt="Gmail"
              width={16}
              height={16}
              style={{ borderRadius: tokens.radius.full, objectFit: 'contain' }}
            />
          ) : isLocalReceipt ? (
            <Receipt
              data-testid="receipt-statement-type-icon"
              size={16}
              style={{ color: c.ink500 }}
            />
          ) : (
            <BankLogoAvatar bankName={statement.bankName} size={16} />
          )}
        </div>

        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            color: c.ink900,
            fontSize: 15,
          }}
        >
          {isProcessing ? listText.processing : merchantLabel}
        </span>

        {pendingReview > 0 && !isProcessing ? (
          <span className="lumio-stmt-badge lumio-stmt-badge--review" style={{ flexShrink: 0 }}>
            {listText.toReview}
            {isReceipt ? null : ` · ${pendingReview}`}
          </span>
        ) : null}

        {hasError ? (
          <AlertCircle size={16} style={{ color: c.danger, marginLeft: 4 }} />
        ) : isPossibleDuplicate ? (
          <MuiTooltip title={duplicateTooltipText} placement="top" enterDelay={150}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: tokens.radius.xs,
                fontSize: 10,
                letterSpacing: '0.05em',
                marginLeft: 4,
                backgroundColor: duplicateStyle.badgeBg,
                color: duplicateStyle.badgeColor,
                ...duplicateRoleBadgeStyle,
              }}
            >
              {resolvedDuplicateRole === 'primary' ? (
                <CheckCircle2 size={12} />
              ) : (
                <CircleHelp size={12} />
              )}
              {duplicateBadgeLabel}
            </div>
          </MuiTooltip>
        ) : isManualExpense ? (
          <CreditCard
            data-testid="manual-expense-type-icon"
            size={14}
            style={{ color: c.ink500, opacity: 0.5, marginLeft: 4 }}
          />
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: c.ink400,
              background: c.ink50,
              borderRadius: tokens.radius.xs,
              padding: '2px 6px',
              marginLeft: 4,
              opacity: 0.7,
            }}
          >
            {resolvedTypeLabel === 'PDF' ? 'PDF' : resolvedTypeLabel}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: c.ink400, marginTop: 2, marginLeft: 24 }}>
        {dateLabel}
        <NotesBadge entityId={statement.id} />
      </div>
    </div>
  );

  const renderAmountCell = (): React.JSX.Element => (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 19,
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: '-0.025em',
          fontVariantNumeric: 'tabular-nums',
          color: isNegativeAmount || hasError || isMissingAmount ? c.danger : c.ink900,
        }}
      >
        {showAmountLoader ? (
          <Spinner style={{ width: 16, height: 16, color: c.ink400 }} />
        ) : (
          amountLabel
        )}
      </span>
      <div
        style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
      >
        <StatusBadge
          status={statement.status}
          isProcessing={isProcessing}
          errorMessage={statement.errorMessage}
        />
      </div>
    </div>
  );

  const renderActionCell = (): React.JSX.Element => (
    <button
      data-testid="statement-view-icon"
      type="button"
      onClick={event => {
        event.stopPropagation();
        handleView();
      }}
      // The whole row already opens the statement, so a plain row gets a quiet
      // arrow instead of a "View" pill; a duplicate keeps its "Review" label,
      // which says something the row click does not.
      className={`lumio-stmt-list-item__view-btn${isPossibleDuplicate ? '' : ' lumio-stmt-list-item__view-btn--arrow'}`}
      style={
        isPossibleDuplicate
          ? {
              borderColor: duplicateStyle.buttonBorder,
              backgroundColor: duplicateStyle.buttonBg,
              color: duplicateStyle.buttonColor,
              ...duplicateRoleButtonStyle,
            }
          : {}
      }
      aria-label={actionLabel}
      disabled={viewDisabled}
    >
      {isPossibleDuplicate ? actionLabel : <ChevronRight size={18} aria-hidden />}
    </button>
  );

  const renderColumnCell = (columnId: StatementColumnId): React.JSX.Element => {
    if (columnId === 'receipt') return renderReceiptCell();
    if (columnId === 'merchant') return renderMerchantCell();
    if (columnId === 'from')
      return renderPlainCell(
        columnId,
        firstNonEmpty(statement.user?.name, statement.user?.email, statement.sender),
      );
    if (columnId === 'to') return renderPlainCell(columnId, sourceLabel);
    if (columnId === 'category') return renderCategoryCell();
    if (columnId === 'tag') return renderPlainCell(columnId, tagsLabel);
    if (columnId === 'amount') return renderAmountCell();
    if (columnId === 'action') return renderActionCell();
    if (columnId === 'approved') return renderPlainCell(columnId, approvedLabel);
    if (columnId === 'billable') return renderPlainCell(columnId, billableLabel);
    if (columnId === 'card')
      return renderPlainCell(columnId, firstNonEmpty(statement.transactionSummary?.cardLabel));
    if (columnId === 'description') return renderPlainCell(columnId, descriptionLabel);
    if (columnId === 'exchangeRate') return renderPlainCell(columnId, exchangeRateLabel);
    if (columnId === 'exported') return renderPlainCell(columnId, exportedLabel);
    return renderPlainCell(columnId, null);
  };

  // Row styles based on duplicate/error/selected state
  const rowStyle: React.CSSProperties = isPossibleDuplicate
    ? duplicateCardStyle
    : hasError
      ? { borderColor: '#fecaca', backgroundColor: 'rgba(255,241,242,0.4)' }
      : selected
        ? {}
        : {};

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: whole-row click is a shortcut for the buttons rendered inside this row. Giving the row role=button would nest interactive elements inside an interactive role, which is worse than the current state.
    <div
      data-tour-id={dataTourId}
      className={`lumio-stmt-list-item${selected ? ' lumio-stmt-list-item--selected' : ''}${hasError && !isPossibleDuplicate ? ' lumio-stmt-list-item--error' : ''}`}
      style={{ ...rowStyle, cursor: viewDisabled ? 'default' : 'pointer' }}
      onClick={handleView}
    >
      {isPossibleDuplicate ? (
        <span
          aria-hidden
          className="lumio-stmt-list-item__accent"
          style={{
            width: 4,
            backgroundColor: duplicateStyle.lineColor,
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          handleView();
        }}
        className="lumio-stmt-list-item__desktop-overlay"
        aria-label={viewLabel}
        aria-disabled={viewDisabled}
      />

      {/* Mobile layout (<768px): who and how much on the first line, when and what
          on the second — the amount never leaves the screen. Taps outside the
          checkbox and icon fall through to the overlay button and open the row. */}
      <div
        data-testid={`statement-item-mobile-${statement.id}`}
        className="lumio-stmt-list-item__mobile"
      >
        <div className="lumio-stmt-list-item__mobile-select">
          {selectionDisabled ? null : (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
              aria-label={merchantLabel}
            />
          )}
        </div>
        <button
          type="button"
          className="lumio-stmt-list-item__mobile-icon"
          onClick={event => {
            event.stopPropagation();
            onIconClick();
          }}
          aria-label={statement.fileName}
        >
          <DocumentTypeIcon
            fileType={isReceipt ? 'pdf' : statement.fileType}
            fileName={statement.fileName}
            fileId={statement.id}
            source={previewSource}
            size={28}
            muted
          />
        </button>
        <div className="lumio-stmt-list-item__mobile-body">
          <div className="lumio-stmt-list-item__mobile-line">
            <span className="lumio-stmt-list-item__mobile-merchant">
              {isProcessing ? listText.processing : merchantLabel}
            </span>
            {hasError ? <AlertCircle size={14} style={{ color: c.danger, flexShrink: 0 }} /> : null}
            <span
              className="lumio-stmt-list-item__mobile-amount"
              style={{
                color: isNegativeAmount || hasError || isMissingAmount ? c.danger : undefined,
              }}
            >
              {showAmountLoader ? (
                <Spinner style={{ width: 14, height: 14, color: c.ink400 }} />
              ) : (
                amountLabel
              )}
            </span>
          </div>
          <div className="lumio-stmt-list-item__mobile-line lumio-stmt-list-item__mobile-meta">
            <span className="lumio-stmt-list-item__mobile-meta-text">
              {[dateLabel, isPossibleDuplicate ? duplicateBadgeLabel : categoryLabel || sourceLabel]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <StatusBadge
              status={statement.status}
              isProcessing={isProcessing}
              errorMessage={statement.errorMessage}
            />
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div
        data-testid={`statement-item-desktop-${statement.id}`}
        className="lumio-stmt-list-item__desktop"
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            width: 16,
            display: 'flex',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s',
            flexShrink: 0,
            marginRight: 16,
          }}
        >
          {selectionDisabled ? (
            <span style={{ display: 'inline-flex', height: 16, width: 16 }} />
          ) : (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
              style={{ pointerEvents: 'auto', height: 16, width: 16 }}
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flex: 1,
            minWidth: 0,
            pointerEvents: 'auto',
          }}
        >
          {renderedColumns.map(column => (
            <div
              key={column.id}
              data-testid={`statement-column-${statement.id}-${column.id}`}
              style={columnCellStyle(column.id)}
            >
              {renderColumnCell(column.id)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
