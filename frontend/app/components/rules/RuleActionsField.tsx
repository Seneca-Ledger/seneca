'use client';

import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { TagPicker } from '@/app/components/tags/TagPicker';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { CategoryList, StorageTag, WalletList } from '@/app/lib/contracts';
import type { RuleDraftBody } from './types';

/** The select's value for "this rule does not touch the field". */
const NO_CHANGE = '';

type Result = RuleDraftBody['result'];

interface RuleActionsFieldProps {
  result: Result;
  onChange: (result: Result) => void;
  categories: CategoryList;
  wallets: WalletList;
  /** Shared plus each member; empty in a workspace of one, which hides the owner. */
  ownerOptions: { value: string; label: string }[];
  tags: readonly StorageTag[];
}

/** What a matching row gets: a category, an account, an owner, tags. Each is optional. */
export function RuleActionsField({
  result,
  onChange,
  categories,
  wallets,
  ownerOptions,
  tags,
}: RuleActionsFieldProps) {
  const t = useIntlayer('categorizationRules');
  const chosenTags = (result.tagIds ?? [])
    .map(id => tags.find(tag => tag.id === id))
    .filter((tag): tag is StorageTag => Boolean(tag));

  return (
    <fieldset className="seneca-rule-dialog__group">
      <legend className="seneca-rule-dialog__label">{t.dialog.actionsLabel}</legend>
      <div className="seneca-rule-dialog__action">
        <span className="seneca-rule-dialog__action-label">{t.dialog.categoryLabel}</span>
        <CategoryPickerField
          id="rule-category"
          size="small"
          value={result.categoryId ?? ''}
          categories={categories}
          onChange={categoryId => onChange({ ...result, categoryId: categoryId || undefined })}
          placeholder={t.dialog.noChange.value}
          clearLabel={t.dialog.noChange.value}
          ariaLabel={t.dialog.categoryLabel.value}
        />
      </div>
      {wallets.length > 0 && (
        <div className="seneca-rule-dialog__action">
          <span className="seneca-rule-dialog__action-label">{t.dialog.walletLabel}</span>
          <Select
            inputProps={{ 'aria-label': t.dialog.walletLabel.value }}
            value={result.walletId ?? NO_CHANGE}
            onChange={walletId => onChange({ ...result, walletId: walletId || undefined })}
            options={[
              { value: NO_CHANGE, label: t.dialog.noChange.value },
              ...wallets.map(wallet => ({ value: wallet.id, label: wallet.name })),
            ]}
            size="small"
          />
        </div>
      )}
      {ownerOptions.length > 1 && (
        <div className="seneca-rule-dialog__action">
          <span className="seneca-rule-dialog__action-label">{t.dialog.ownerLabel}</span>
          <Select
            inputProps={{ 'aria-label': t.dialog.ownerLabel.value }}
            value={
              result.ownerMemberId === undefined
                ? NO_CHANGE
                : (result.ownerMemberId ?? OWNER_SHARED)
            }
            onChange={value => {
              const { ownerMemberId: _dropped, ...rest } = result;
              onChange(
                value === NO_CHANGE
                  ? rest
                  : { ...rest, ownerMemberId: value === OWNER_SHARED ? null : value },
              );
            }}
            options={[{ value: NO_CHANGE, label: t.dialog.noChange.value }, ...ownerOptions]}
            size="small"
          />
        </div>
      )}
      <TagPicker
        value={chosenTags}
        onChange={next => {
          const { tagIds: _dropped, ...rest } = result;
          onChange(next.length > 0 ? { ...rest, tagIds: next.map(tag => tag.id) } : rest);
        }}
      />
      <span className="seneca-rule-dialog__hint">{t.dialog.tagsHint}</span>
    </fieldset>
  );
}
