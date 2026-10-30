import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { DEFAULT_STATEMENT_COLUMNS } from '../columns/statement-columns';
import { isDocumentApproved } from '../StatementsListView.utils';
import {
  firstNonEmpty,
  formatBoolean,
  normalizeExchangeRateCurrency,
} from '../statements-list-item.cells';
import type { DuplicateRole, StatementsListItemProps } from '../statements-list-item.types';

/**
 * What one row of the documents list shows, worked out from its props: the
 * amount as figure and currency, the duplicate caption and its tooltip, the
 * labels of the plain columns, and which columns are drawn.
 */
export function useStatementsListItemModel({
  statement,
  viewLabel,
  duplicateActionLabel,
  isReceipt,
  amountLabel,
  onView,
  typeLabel,
  isManualExpense = false,
  isPossibleDuplicate = false,
  duplicatePosition,
  duplicateGroupSize,
  duplicateRole,
  duplicateGroupLabel,
  duplicateReason,
  viewDisabled = false,
  columns = DEFAULT_STATEMENT_COLUMNS,
  currentExchangeRateLabels,
  workspaceCurrency,
  pendingReview = 0,
}: StatementsListItemProps) {
  const listText = useIntlayer('statementsListUi');
  const { locale } = useLocale();

  const resolvedTypeLabel = typeLabel || statement.fileType;
  const isLocalReceipt = statement.source === 'scan';
  const previewSource: 'receipt' | 'statement' = isLocalReceipt ? 'receipt' : 'statement';
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
  const duplicateRoleLabel =
    resolvedDuplicateRole === 'primary' ? listText.rolePrimary.value : listText.roleSuspected.value;
  // Group and role go to the tooltip; the row itself only says "possible duplicate, 1 of 2".
  const duplicateBadgeLabel = isPossibleDuplicate
    ? `${resolvedDuplicateGroupLabel} · ${duplicateRoleLabel} #${duplicatePosition || 1}${duplicateGroupSize ? `/${duplicateGroupSize}` : ''}`
    : null;
  const duplicateCaption = isPossibleDuplicate
    ? listText.possibleDuplicate.value
        .replace('{position}', String(duplicatePosition || 1))
        .replace('{total}', String(duplicateGroupSize || duplicatePosition || 1))
    : null;
  const duplicateTooltipText = `${duplicateBadgeLabel ?? ''} — ${duplicateReason || listText.duplicateReasonSame.value}`;
  const reviewLabel = duplicateActionLabel || listText.review.value;
  const actionLabel = isPossibleDuplicate ? reviewLabel : viewLabel;
  const typeCaption = isManualExpense
    ? null
    : isReceipt
      ? resolvedTypeLabel
      : resolvedTypeLabel?.toUpperCase();
  const handleView = () => {
    if (viewDisabled) {
      return;
    }
    onView();
  };
  const visibleColumns = columns.filter(column => column.visible);
  const renderedColumns = visibleColumns.length > 0 ? visibleColumns : columns.slice(0, 1);
  const sourceLabel = isLocalReceipt ? listText.typeReceipt.value : statement.bankName;
  // importPreview.categoryId is deliberately not a fallback: it is a bare id,
  // and rendering it puts a raw UUID in the column.
  const categoryLabel = firstNonEmpty(statement.category?.name, statement.parsedData?.category);
  // System categories are stored by their English name; the link and the icon
  // keep that name, the reader sees it in their language.
  const categoryText = categoryLabel && localizeStatementCategoryName(categoryLabel, locale);
  const tagsLabel =
    statement.tags
      ?.map(tag => tag.name)
      .filter(Boolean)
      .join(', ') || null;
  const descriptionLabel = firstNonEmpty(
    statement.parsingDetails?.importPreview?.description,
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
    isDocumentApproved(statement.status, isReceipt, pendingReview),
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

  return {
    previewSource,
    hasError,
    isPendingStatement,
    isNegativeAmount,
    isMissingAmount,
    showAmountLoader,
    duplicateCaption,
    duplicateTooltipText,
    reviewLabel,
    actionLabel,
    typeCaption,
    handleView,
    renderedColumns,
    sourceLabel,
    categoryLabel,
    categoryText,
    tagsLabel,
    descriptionLabel,
    exchangeRateLabel,
    approvedLabel,
    billableLabel,
    exportedLabel,
  };
}
