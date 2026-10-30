'use client';

import { useTheme } from 'next-themes';
import React from 'react';
import { DocumentThumbnailPreview } from '@/app/components/DocumentThumbnailPreview';
import { Checkbox } from '@/app/components/ui/checkbox';
import { tokens } from '@/lib/theme-tokens';
import { type StatementColumnId } from './columns/statement-columns';
import { useStatementsListItemModel } from './hooks/useStatementsListItemModel';
import { StatementAmountCell } from './StatementAmountCell';
import { StatementCategoryCell } from './StatementCategoryCell';
import {
  ActionCell,
  MerchantCell,
  PlainCell,
  RowsToggle,
  TagCell,
} from './StatementsListItemCells';
import { StatementsListItemMobile } from './StatementsListItemMobile';
import { columnCellStyle, firstNonEmpty } from './statements-list-item.cells';
import type { StatementsListItemProps } from './statements-list-item.types';
import { statementMonth } from './statements-list-item-parts';

export type { StatementListItem } from './statements-list-item.types';

export function StatementsListItem(props: StatementsListItemProps) {
  const {
    dataTourId,
    statement,
    viewLabel,
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
    isManualExpense = false,
    isPossibleDuplicate = false,
    duplicateGroupStart = true,
    duplicateGroupEnd = true,
    viewDisabled = false,
    pendingReview = 0,
    transactionCount = 0,
    expanded = false,
    onToggleExpand,
    onAddCategory,
  } = props;
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

  const {
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
  } = useStatementsListItemModel(props);
  const rowsToggle = (
    <RowsToggle
      transactionCount={transactionCount}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
  );

  const renderColumnCell = (columnId: StatementColumnId): React.JSX.Element => {
    if (columnId === 'receipt')
      return (
        <DocumentThumbnailPreview
          fileId={statement.id}
          fileName={statement.fileName}
          fileType={isReceipt ? 'pdf' : statement.fileType || statement.fileName || ''}
          source={previewSource}
          onOpen={onIconClick}
          testId={`statement-thumbnail-trigger-${statement.id}`}
        />
      );
    if (columnId === 'merchant')
      return (
        <MerchantCell
          c={c}
          statementId={statement.id}
          merchantLabel={merchantLabel}
          isProcessing={isProcessing}
          isReceipt={isReceipt}
          isManualExpense={isManualExpense}
          hasError={hasError}
          pendingReview={pendingReview}
          dateLabel={dateLabel}
          typeCaption={typeCaption}
          duplicateCaption={duplicateCaption}
          duplicateTooltipText={duplicateTooltipText}
          rowsToggle={rowsToggle}
        />
      );
    if (columnId === 'from')
      return (
        <PlainCell
          columnId={columnId}
          value={firstNonEmpty(statement.user?.name, statement.user?.email, statement.sender)}
        />
      );
    if (columnId === 'to') return <PlainCell columnId={columnId} value={sourceLabel} />;
    if (columnId === 'category')
      return (
        <StatementCategoryCell
          category={statement.category}
          label={categoryLabel}
          text={categoryText}
          month={statementMonth(statement)}
          rowsCount={transactionCount}
          uncategorizedCount={statement.transactionSummary?.uncategorizedCount ?? 0}
          isReceipt={isReceipt}
          busy={isProcessing || hasError}
          pending={isPendingStatement}
          onAddCategory={onAddCategory}
          onOpenRows={onToggleExpand}
        />
      );
    if (columnId === 'tag') return <TagCell statement={statement} tagsLabel={tagsLabel} />;
    if (columnId === 'amount')
      return (
        <StatementAmountCell
          statement={statement}
          amountLabel={amountLabel}
          isReceipt={isReceipt}
          isProcessing={isProcessing}
          onTeach={() => onIconClick('teach')}
        />
      );
    if (columnId === 'action')
      return (
        <ActionCell
          reviewLabel={reviewLabel}
          actionLabel={actionLabel}
          isPossibleDuplicate={isPossibleDuplicate}
          viewDisabled={viewDisabled}
          onView={handleView}
        />
      );
    if (columnId === 'approved') return <PlainCell columnId={columnId} value={approvedLabel} />;
    if (columnId === 'billable') return <PlainCell columnId={columnId} value={billableLabel} />;
    if (columnId === 'card')
      return (
        <PlainCell
          columnId={columnId}
          value={firstNonEmpty(statement.transactionSummary?.cardLabel)}
        />
      );
    if (columnId === 'description')
      return <PlainCell columnId={columnId} value={descriptionLabel} />;
    if (columnId === 'exchangeRate')
      return <PlainCell columnId={columnId} value={exchangeRateLabel} />;
    if (columnId === 'exported') return <PlainCell columnId={columnId} value={exportedLabel} />;
    return <PlainCell columnId={columnId} value={null} />;
  };

  // Row styles based on duplicate/error/selected state
  const rowStyle: React.CSSProperties =
    hasError && !isPossibleDuplicate
      ? { borderColor: '#fecaca', backgroundColor: 'rgba(255,241,242,0.4)' }
      : {};

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: whole-row click is a shortcut for the buttons rendered inside this row. Giving the row role=button would nest interactive elements inside an interactive role, which is worse than the current state.
    <div
      data-tour-id={dataTourId}
      className={`seneca-stmt-list-item${selected ? ' seneca-stmt-list-item--selected' : ''}${hasError && !isPossibleDuplicate ? ' seneca-stmt-list-item--error' : ''}`}
      style={{ ...rowStyle, cursor: viewDisabled ? 'default' : 'pointer' }}
      onClick={handleView}
    >
      {isPossibleDuplicate ? (
        <span
          aria-hidden
          className={`seneca-stmt-list-item__accent${duplicateGroupStart ? ' seneca-stmt-list-item__accent--start' : ''}${duplicateGroupEnd ? ' seneca-stmt-list-item__accent--end' : ''}`}
        />
      ) : null}

      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          handleView();
        }}
        className="seneca-stmt-list-item__desktop-overlay"
        aria-label={viewLabel}
        aria-disabled={viewDisabled}
      />

      <StatementsListItemMobile
        statement={statement}
        c={c}
        merchantLabel={merchantLabel}
        amountLabel={amountLabel}
        dateLabel={dateLabel}
        isProcessing={isProcessing}
        hasError={hasError}
        danger={isNegativeAmount || hasError || isMissingAmount}
        showAmountLoader={showAmountLoader}
        caption={isPossibleDuplicate ? duplicateCaption : categoryText || sourceLabel}
        selected={selected}
        selectionDisabled={selectionDisabled}
        onToggleSelect={onToggleSelect}
        onIconClick={onIconClick}
        rowsToggle={rowsToggle}
      />

      {/* Desktop Layout */}
      <div
        data-testid={`statement-item-desktop-${statement.id}`}
        className="seneca-stmt-list-item__desktop"
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
