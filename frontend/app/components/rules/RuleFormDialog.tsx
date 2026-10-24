'use client';

import { Button } from '@mui/material';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { Plus, X } from '@/app/components/icons';
import { offerAction } from '@/app/components/payees/offer-action-toast';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { FULL_SCREEN_ON_PHONE, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { describeConditions, fill } from './rule-text';
import {
  EMPTY_CONDITION,
  operatorsFor,
  type RuleCondition,
  type RuleDraftBody,
  type RuleField,
  type RuleSeed,
  TEXT_FIELDS,
} from './types';
import {
  completeConditions,
  useApplyRule,
  useRulePreview,
  useRuleTargets,
  useSaveRule,
} from './useRules';
import { useRuleWords } from './useRuleWords';

/** The select's value for "this rule does not touch the field". */
const NO_CHANGE = '';
const PREVIEW_EXAMPLES = 5;

interface RuleFormDialogProps {
  open: boolean;
  /** The rule to edit, or a draft to start from; null opens a blank rule. */
  seed: RuleSeed | null;
  onClose: () => void;
}

function blankSeed(): RuleSeed {
  return { id: null, name: '', conditions: [EMPTY_CONDITION], result: {}, priority: 0 };
}

/**
 * Create or edit a rule: conditions that must all hold, and what a matching
 * row gets. A live preview says how many existing rows match; after saving,
 * the rows nobody filed by hand are offered for refiling, never refiled on
 * their own.
 */
export function RuleFormDialog({ open, seed, onClose }: RuleFormDialogProps) {
  const t = useIntlayer('categorizationRules');
  const words = useRuleWords();
  const members = useWorkspaceMembers();
  const { categories, wallets } = useRuleTargets();
  const save = useSaveRule();
  const apply = useApplyRule();
  const [draft, setDraft] = useState<RuleSeed>(() => seed ?? blankSeed());

  // Every opening starts from the rule handed in (or a blank one).
  useEffect(() => {
    if (open) {
      setDraft(seed ?? blankSeed());
    }
  }, [open, seed]);

  const preview = useRulePreview(draft.conditions, open);
  const conditions = completeConditions(draft.conditions);
  const hasAction =
    Boolean(draft.result.categoryId) ||
    Boolean(draft.result.walletId) ||
    draft.result.ownerMemberId !== undefined;
  const problem =
    conditions.length === 0 ? t.dialog.needsCondition : hasAction ? null : t.dialog.needsAction;

  const ownerName = (memberId: string) =>
    memberId === OWNER_SHARED
      ? words.shared
      : (members.find(member => member.memberId === memberId)?.label ?? null);

  const fieldOptions: RuleField[] = [
    ...TEXT_FIELDS,
    'amount',
    ...(members.length > 0 ? (['owner'] as RuleField[]) : []),
  ];

  const setCondition = (index: number, next: RuleCondition) =>
    setDraft(current => ({
      ...current,
      conditions: current.conditions.map((condition, at) => (at === index ? next : condition)),
    }));

  const changeField = (index: number, field: RuleField) =>
    setCondition(index, {
      field,
      operator: operatorsFor(field)[0],
      value: field === 'owner' ? OWNER_SHARED : '',
    });

  const handleSave = async () => {
    const body: RuleDraftBody = {
      name: draft.name.trim() || describeConditions(conditions, words, ownerName),
      conditions: conditions.map(condition =>
        condition.field === 'amount' ? { ...condition, value: Number(condition.value) } : condition,
      ),
      result: draft.result,
      priority: draft.priority,
    };
    // Read before the dialog closes: the preview is of what was just saved.
    const refilable = draft.result.categoryId ? (preview.data?.overridable ?? 0) : 0;
    const saved = await save.mutateAsync({ id: draft.id, body }).catch(() => null);
    if (!saved) {
      toast.error(t.toast.saveFailed.value);
      return;
    }
    toast.success(t.toast.saved.value);
    onClose();
    if (refilable > 0) {
      offerAction({
        message: fill(t.toast.applyOffer.value, { count: refilable }),
        applyLabel: t.toast.apply.value,
        dismissLabel: t.toast.notNow.value,
        onApply: () =>
          void apply.mutateAsync(saved.id).then(
            result => toast.success(fill(t.toast.applied.value, { count: result.applied })),
            () => toast.error(t.toast.applyFailed.value),
          ),
      });
    }
  };

  const ownerOptions = [
    { value: OWNER_SHARED, label: words.shared },
    ...members.map(member => ({ value: member.memberId, label: member.label })),
  ];

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size="md"
      paperSx={{ maxWidth: 640, ...FULL_SCREEN_ON_PHONE }}
      title={
        <span style={{ fontWeight: 500 }}>
          {draft.id ? t.dialog.editTitle : t.dialog.createTitle}
        </span>
      }
      footer={
        <>
          <Button
            type="button"
            variant="text"
            onClick={onClose}
            sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
          >
            {t.dialog.cancel}
          </Button>
          <Button
            type="button"
            variant={problem ? 'outlined' : 'contained'}
            onClick={() => void handleSave()}
            disabled={Boolean(problem) || save.isPending}
          >
            {t.dialog.save}
          </Button>
        </>
      }
    >
      <form
        className="seneca-rule-dialog"
        onSubmit={event => {
          event.preventDefault();
          if (!(problem || save.isPending)) {
            void handleSave();
          }
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
            onChange={event => setDraft({ ...draft, name: event.target.value })}
          />
        </div>

        <fieldset className="seneca-rule-dialog__group">
          <legend className="seneca-rule-dialog__label">{t.dialog.conditionsLabel}</legend>
          {draft.conditions.map((condition, index) => (
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
                  onChange={event =>
                    setCondition(index, { ...condition, value: event.target.value })
                  }
                />
              )}
              {draft.conditions.length > 1 && (
                <button
                  type="button"
                  className="seneca-rule-dialog__remove"
                  aria-label={t.dialog.removeCondition.value}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      conditions: draft.conditions.filter((_, at) => at !== index),
                    })
                  }
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
            onClick={() =>
              setDraft({ ...draft, conditions: [...draft.conditions, EMPTY_CONDITION] })
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            {t.dialog.addCondition}
          </Button>
        </fieldset>

        <fieldset className="seneca-rule-dialog__group">
          <legend className="seneca-rule-dialog__label">{t.dialog.actionsLabel}</legend>
          <div className="seneca-rule-dialog__action">
            <span className="seneca-rule-dialog__action-label">{t.dialog.categoryLabel}</span>
            <CategoryPickerField
              id="rule-category"
              size="small"
              value={draft.result.categoryId ?? ''}
              categories={categories}
              onChange={categoryId =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, categoryId: categoryId || undefined },
                })
              }
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
                value={draft.result.walletId ?? NO_CHANGE}
                onChange={walletId =>
                  setDraft({
                    ...draft,
                    result: { ...draft.result, walletId: walletId || undefined },
                  })
                }
                options={[
                  { value: NO_CHANGE, label: t.dialog.noChange.value },
                  ...wallets.map(wallet => ({ value: wallet.id, label: wallet.name })),
                ]}
                size="small"
              />
            </div>
          )}
          {members.length > 0 && (
            <div className="seneca-rule-dialog__action">
              <span className="seneca-rule-dialog__action-label">{t.dialog.ownerLabel}</span>
              <Select
                inputProps={{ 'aria-label': t.dialog.ownerLabel.value }}
                value={
                  draft.result.ownerMemberId === undefined
                    ? NO_CHANGE
                    : (draft.result.ownerMemberId ?? OWNER_SHARED)
                }
                onChange={value => {
                  const { ownerMemberId: _dropped, ...rest } = draft.result;
                  setDraft({
                    ...draft,
                    result:
                      value === NO_CHANGE
                        ? rest
                        : { ...rest, ownerMemberId: value === OWNER_SHARED ? null : value },
                  });
                }}
                options={[{ value: NO_CHANGE, label: t.dialog.noChange.value }, ...ownerOptions]}
                size="small"
              />
            </div>
          )}
        </fieldset>

        <div className="seneca-rule-dialog__field">
          <label htmlFor="rule-priority" className="seneca-rule-dialog__label">
            {t.dialog.priorityLabel}
          </label>
          <input
            id="rule-priority"
            className="seneca-rule-dialog__input seneca-rule-dialog__input--short"
            type="number"
            step={1}
            value={draft.priority}
            onChange={event =>
              setDraft({ ...draft, priority: Math.trunc(Number(event.target.value) || 0) })
            }
          />
          <span className="seneca-rule-dialog__hint">{t.dialog.priorityHint}</span>
        </div>

        <section className="seneca-rule-dialog__preview" aria-live="polite">
          <span className="seneca-rule-dialog__label">{t.dialog.previewTitle}</span>
          {problem ? (
            <span className="seneca-rule-dialog__hint">{problem}</span>
          ) : preview.data ? (
            <>
              <span>
                {preview.data.matchedTransactions > 0
                  ? fill(t.dialog.previewMatches.value, {
                      count: preview.data.matchedTransactions,
                    })
                  : t.dialog.previewNone}
              </span>
              {draft.result.categoryId && preview.data.overridable > 0 ? (
                <span className="seneca-rule-dialog__hint">
                  {fill(t.dialog.previewOverridable.value, { count: preview.data.overridable })}
                </span>
              ) : null}
              {preview.data.matches.length > 0 && (
                <ul className="seneca-rule-dialog__examples">
                  {preview.data.matches.slice(0, PREVIEW_EXAMPLES).map(match => (
                    <li key={match.id}>
                      <span>{match.counterparty ?? match.purpose}</span>
                      <span className="seneca-rule-dialog__example-meta">
                        {match.date} · {match.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {preview.data.truncated ? (
                <span className="seneca-rule-dialog__hint">{t.dialog.previewTruncated}</span>
              ) : null}
            </>
          ) : null}
        </section>
      </form>
    </ModalShell>
  );
}
