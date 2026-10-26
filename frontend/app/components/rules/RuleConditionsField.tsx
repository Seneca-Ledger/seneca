'use client';

import { Button } from '@mui/material';
import { Plus, X } from '@/app/components/icons';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import {
  EMPTY_CONDITION,
  operatorsFor,
  type RuleCondition,
  type RuleField,
  TEXT_FIELDS,
} from './types';
import { useRuleWords } from './useRuleWords';

interface RuleConditionsFieldProps {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
  /** Who a row can belong to; empty in a workspace of one, which hides the owner field. */
  ownerOptions: { value: string; label: string }[];
  hasMembers: boolean;
}

/** The rule dialog's conditions: rows of field, check and value that must all hold. */
export function RuleConditionsField({
  conditions,
  onChange,
  ownerOptions,
  hasMembers,
}: RuleConditionsFieldProps) {
  const t = useIntlayer('categorizationRules');
  const words = useRuleWords();

  const fieldOptions: RuleField[] = [
    ...TEXT_FIELDS,
    'amount',
    ...(hasMembers ? (['owner'] as RuleField[]) : []),
  ];

  const setCondition = (index: number, next: RuleCondition) =>
    onChange(conditions.map((condition, at) => (at === index ? next : condition)));

  const changeField = (index: number, field: RuleField) =>
    setCondition(index, {
      field,
      operator: operatorsFor(field)[0],
      value: field === 'owner' ? OWNER_SHARED : '',
    });

  return (
    <fieldset className="seneca-rule-dialog__group">
      <legend className="seneca-rule-dialog__label">{t.dialog.conditionsLabel}</legend>
      {conditions.map((condition, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
        <div className="seneca-rule-dialog__condition" key={index}>
          <Select
            inputProps={{ 'aria-label': t.dialog.fieldLabel.value }}
            value={condition.field}
            onChange={value => changeField(index, value as RuleField)}
            options={[...new Set([...fieldOptions, condition.field])].map(field => ({
              value: field,
              label: words.field[field],
            }))}
            size="small"
          />
          <Select
            inputProps={{ 'aria-label': t.dialog.operatorLabel.value }}
            value={condition.operator}
            onChange={value =>
              setCondition(index, {
                ...condition,
                operator: value as RuleCondition['operator'],
              })
            }
            options={[...new Set([...operatorsFor(condition.field), condition.operator])].map(
              operator => ({ value: operator, label: words.operator[operator] }),
            )}
            size="small"
          />
          {condition.field === 'owner' ? (
            <Select
              inputProps={{ 'aria-label': t.dialog.valueLabel.value }}
              value={String(condition.value)}
              onChange={value => setCondition(index, { ...condition, value })}
              options={ownerOptions}
              size="small"
            />
          ) : (
            <input
              aria-label={t.dialog.valueLabel.value}
              className="seneca-rule-dialog__input"
              type={condition.field === 'amount' ? 'number' : 'text'}
              inputMode={condition.field === 'amount' ? 'decimal' : undefined}
              value={String(condition.value)}
              onChange={event => setCondition(index, { ...condition, value: event.target.value })}
            />
          )}
          {conditions.length > 1 && (
            <button
              type="button"
              className="seneca-rule-dialog__remove"
              aria-label={t.dialog.removeCondition.value}
              onClick={() => onChange(conditions.filter((_, at) => at !== index))}
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="text"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() => onChange([...conditions, EMPTY_CONDITION])}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t.dialog.addCondition}
      </Button>
    </fieldset>
  );
}
