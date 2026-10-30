'use client';

import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { useIntlayer } from '@/app/i18n';
import { RuleActionsField } from './RuleActionsField';
import { RuleConditionsField } from './RuleConditionsField';
import type { RuleSeed } from './types';
import type { useRuleNames } from './useRuleNames';

interface RuleEditorFormProps {
  draft: RuleSeed;
  onChange: (update: (draft: RuleSeed) => RuleSeed) => void;
  targets: ReturnType<typeof useRuleNames>;
  onSubmit: () => void;
}

/** The rule's name, what it matches and what it sets. Saving is the page's. */
export function RuleEditorForm({ draft, onChange, targets, onSubmit }: RuleEditorFormProps) {
  const t = useIntlayer('categorizationRules');
  const { words, categories, wallets, members, tags } = targets;
  const ownerOptions =
    members.length > 0
      ? [
          { value: OWNER_SHARED, label: words.shared },
          ...members.map(member => ({ value: member.memberId, label: member.label })),
        ]
      : [];

  return (
    <form
      className="seneca-rule-dialog"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="seneca-rule-dialog__field">
        <label htmlFor="rule-name" className="seneca-rule-dialog__label">
          {t.dialog.nameLabel}
        </label>
        <input
          id="rule-name"
          className="seneca-rule-dialog__input"
          value={draft.name}
          placeholder={t.dialog.namePlaceholder.value}
          onChange={event => {
            const name = event.target.value;
            onChange(current => ({ ...current, name }));
          }}
        />
      </div>

      <RuleConditionsField
        conditions={draft.conditions}
        onChange={conditions => onChange(current => ({ ...current, conditions }))}
        ownerOptions={ownerOptions}
        hasMembers={members.length > 0}
        walletOptions={wallets.map(wallet => ({ value: wallet.id, label: wallet.name }))}
      />

      <RuleActionsField
        result={draft.result}
        onChange={result => onChange(current => ({ ...current, result }))}
        categories={categories}
        wallets={wallets}
        ownerOptions={ownerOptions}
        tags={tags}
      />
    </form>
  );
}
