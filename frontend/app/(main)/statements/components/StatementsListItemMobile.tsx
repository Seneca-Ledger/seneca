'use client';

import clsx from 'clsx';
import React from 'react';
import { AlertCircle } from '@/app/components/icons';
import { canTeach } from '@/app/components/pdf-teach/teach-utils';
import { Checkbox } from '@/app/components/ui/checkbox';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { StatusBadge, TeachButton } from './StatementAmountCell';
import type { StatementListItem } from './statements-list-item.types';

/**
 * A documents row on a phone (<768px): who and how much on the first line,
 * when and what on the second, so the amount never leaves the screen.
 */
export function StatementsListItemMobile(props: {
  statement: StatementListItem;
  c: typeof tokens.color | typeof tokens.dark.color;
  merchantLabel: string;
  amountLabel: string;
  dateLabel: string;
  isProcessing: boolean;
  hasError: boolean;
  danger: boolean;
  showAmountLoader: boolean;
  caption: string | null | undefined;
  selected: boolean;
  selectionDisabled: boolean;
  onToggleSelect?: () => void;
  onIconClick: (mode?: 'teach') => void;
  rowsToggle: React.ReactNode;
}): React.JSX.Element {
  const listText = useIntlayer('statementsListUi');
  const { statement, c, merchantLabel, amountLabel, dateLabel, isProcessing, hasError } = props;
  const { danger, showAmountLoader, caption, selected, selectionDisabled } = props;
  const { onToggleSelect, onIconClick, rowsToggle } = props;
  return (
    <>
      {/* Mobile layout (<768px): who and how much on the first line, when and what
        on the second — the amount never leaves the screen. Taps outside the
        checkbox and icon fall through to the overlay button and open the row. */}
      <div
        data-testid={`statement-item-mobile-${statement.id}`}
        className="seneca-stmt-list-item__mobile"
      >
        <div className="seneca-stmt-list-item__mobile-select">
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
          className="seneca-stmt-list-item__mobile-icon"
          onClick={event => {
            event.stopPropagation();
            onIconClick();
          }}
          aria-label={statement.fileName}
        ></button>
        <div className="seneca-stmt-list-item__mobile-body">
          <div className="seneca-stmt-list-item__mobile-line">
            <span className="seneca-stmt-list-item__mobile-merchant">
              {isProcessing ? listText.processing : merchantLabel}
            </span>
            {hasError ? <AlertCircle size={14} style={{ color: c.danger, flexShrink: 0 }} /> : null}
            <span
              className={clsx('seneca-stmt-list-item__mobile-amount', PRIVATE_CLASS)}
              style={{
                color: danger ? c.danger : undefined,
              }}
            >
              {canTeach(statement) ? (
                <TeachButton onTeach={() => onIconClick('teach')} />
              ) : showAmountLoader ? (
                <Spinner style={{ width: 14, height: 14, color: c.ink400 }} />
              ) : (
                amountLabel
              )}
            </span>
          </div>
          <div className="seneca-stmt-list-item__mobile-line seneca-stmt-list-item__mobile-meta">
            <span className="seneca-stmt-list-item__mobile-meta-text">
              {[dateLabel, caption].filter(Boolean).join(' · ')}
            </span>
            {rowsToggle}
            <StatusBadge
              status={statement.status}
              isProcessing={isProcessing}
              errorMessage={statement.errorMessage}
            />
          </div>
        </div>
      </div>
    </>
  );
}
