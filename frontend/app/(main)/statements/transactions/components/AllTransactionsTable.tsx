'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown } from '@/app/components/icons';
import { ItemImageBadge } from '@/app/components/item-images/ItemImageBadge';
import { PaymentTypeLabel } from '@/app/components/transactions/PaymentTypeLabel';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { type SkeletonColumn, SkeletonRows } from '@/app/components/ui/table-skeleton';
import { useIntlayer, useLocale } from '@/app/i18n';
import { isSuggestion } from '@/app/lib/category-suggestion';
import type { CategoryList } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { useCategoryName } from '@/app/lib/use-category-name';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import {
  type Direction,
  directionOf,
  type ListedRow,
  rowSides,
  signedAmount,
} from '../all-transactions';

const DIRECTION_ICONS: Record<Direction, typeof ArrowUpRight> = {
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  transfer: ArrowLeftRight,
};

// The cells of a row while the page loads, column for column.
const LOADING_COLUMNS: SkeletonColumn[] = [
  { className: 'seneca-all-tx__col-direction', shape: 'circle', size: 16 },
  { shape: 'text', size: 180 },
  { className: 'seneca-all-tx__num', shape: 'text', size: 80 },
  { className: 'seneca-all-tx__num', shape: 'text', size: 80 },
  { shape: 'text', size: 90 },
  { shape: 'text', size: 100 },
  { shape: 'text', size: 100 },
  { shape: 'text', size: 90 },
  { shape: 'none' },
  { className: 'seneca-all-tx__col-actions', shape: 'text', size: 64 },
  { className: 'seneca-all-tx__col-check', shape: 'none' },
];

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

export function AllTransactionsTable({
  loading = false,
  rows,
  categories,
  budgetByCategory,
  selected,
  onToggle,
  onToggleAll,
  onSetCategory,
  onOpen,
}: {
  /** The header stays and the rows are placeholders while the page loads. */
  loading?: boolean;
  rows: readonly ListedRow[];
  categories: CategoryList;
  /** The budget's name for a category id, when one has a budget. */
  budgetByCategory: ReadonlyMap<string, string>;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onSetCategory: (ids: string[], categoryId: string) => void;
  onOpen: (row: ListedRow) => void;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsPage');
  const tTable = useIntlayer('transactionsTable');
  const { locale } = useLocale();
  const router = useRouter();
  const categoryName = useCategoryName();
  const allSelected = rows.length > 0 && rows.every(row => selected.has(row.id));
  const someSelected = !allSelected && rows.some(row => selected.has(row.id));
  const choices = categories.filter(category => category.isEnabled);
  const money = (value: number, currency: string) => formatMoney(value, currency, locale);
  const [pickingCategory, setPickingCategory] = useState(false);

  return (
    <div className="seneca-all-tx__table-wrap">
      {selected.size > 0 ? (
        <div className="seneca-all-tx__bulk" role="status">
          <span>{t.selected.value.replace('{count}', String(selected.size))}</span>
          {/* The category drawer every other place uses, not a menu of its own. */}
          <button
            type="button"
            className="seneca-all-tx__menu-button"
            onClick={() => setPickingCategory(true)}
          >
            {t.setCategory}
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      ) : null}
      <StatementCategoryDrawer
        open={pickingCategory}
        onClose={() => setPickingCategory(false)}
        categories={choices}
        selectedCategoryId=""
        onSelect={categoryId => {
          setPickingCategory(false);
          if (categoryId) {
            onSetCategory([...selected], categoryId);
          }
        }}
      />
      <table className="seneca-all-tx__table">
        <thead>
          <tr>
            <th className="seneca-all-tx__col-direction" />
            <th>{t.description}</th>
            <th className="seneca-all-tx__num">{t.amount}</th>
            <th className="seneca-all-tx__num">{t.runningBalance}</th>
            <th className="seneca-all-tx__col-date">{tTable.columnDate}</th>
            <th>{t.sourceAccount}</th>
            <th>{t.destinationAccount}</th>
            <th>{tTable.columnCategory}</th>
            <th>{t.budget}</th>
            <th className="seneca-all-tx__col-actions">
              <span className="u-visually-hidden">{t.actions}</span>
            </th>
            <th className="seneca-all-tx__col-check">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={onToggleAll}
                aria-label={tTable.selectAllRows.value}
              />
            </th>
          </tr>
        </thead>
        {loading ? (
          <SkeletonRows columns={LOADING_COLUMNS} rows={8} />
        ) : (
          <tbody>
            {rows.map(row => {
              const direction = directionOf(row);
              const Icon = DIRECTION_ICONS[direction];
              const amount = signedAmount(row);
              const { source, destination } = rowSides(row);
              const description = row.paymentPurpose?.trim() || row.counterpartyName;
              const budget = row.categoryId ? budgetByCategory.get(row.categoryId) : undefined;
              return (
                <tr key={row.id} className={clsx(selected.has(row.id) && 'is-selected')}>
                  <td className="seneca-all-tx__col-direction">
                    {/* The vendor's mark or the item's picture, where there is one; the sign of the amount
                        still says which way the money went. */}
                    <ItemImageBadge transactionId={row.id} size={22} name={row.counterpartyName}>
                      <Icon size={16} aria-label={t[direction].value} />
                    </ItemImageBadge>
                  </td>
                  <td className="seneca-all-tx__description" data-label={t.description.value}>
                    <button
                      type="button"
                      className={clsx('seneca-all-tx__link', PRIVATE_CLASS)}
                      onClick={() => onOpen(row)}
                    >
                      {description}
                    </button>
                    <PaymentTypeLabel type={row.paymentType} />
                  </td>
                  <td
                    className={clsx(
                      'seneca-all-tx__num seneca-all-tx__figure',
                      amount > 0 && 'seneca-all-tx__income',
                      amount < 0 && 'seneca-all-tx__spend',
                      PRIVATE_CLASS,
                    )}
                    data-label={t.amount.value}
                  >
                    {money(amount, row.currency)}
                  </td>
                  <td
                    className={clsx('seneca-all-tx__num seneca-all-tx__figure', PRIVATE_CLASS)}
                    data-label={t.runningBalance.value}
                  >
                    {row.runningBalance ? money(Number(row.runningBalance), row.currency) : '–'}
                  </td>
                  <td data-label={tTable.columnDate.value}>
                    {formatStoredDateWithOptions(row.transactionDate, LONG_DATE, locale)}
                  </td>
                  <td className="seneca-all-tx__party" data-label={t.sourceAccount.value}>
                    {source ?? '–'}
                  </td>
                  <td className="seneca-all-tx__party" data-label={t.destinationAccount.value}>
                    {destination ?? '–'}
                  </td>
                  <td data-label={tTable.columnCategory.value}>
                    {/* A suggested category is dashed until the row is confirmed. */}
                    <span className={isSuggestion(row) ? 'seneca-suggested-category' : undefined}>
                      {row.category ? categoryName(row.category.name) : t.uncategorized}
                    </span>
                  </td>
                  <td data-label={t.budget.value}>{budget ?? ''}</td>
                  <td className="seneca-all-tx__col-actions">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="seneca-all-tx__menu-button">
                          {t.actions}
                          <ChevronDown size={16} aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpen(row)}>{t.details}</DropdownMenuItem>
                        {row.statementId ? (
                          <DropdownMenuItem
                            onClick={() => router.push(`/statements/${row.statementId}/edit`)}
                          >
                            {t.openDocument}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  <td className="seneca-all-tx__col-check">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => onToggle(row.id)}
                      aria-label={tTable.selectTransaction.value}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
