'use client';

import {
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import NextLink from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { CategoryPickerField } from '@/app/components/categories/CategoryPickerField';
import { ChevronLeft } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import type { BudgetFormData, BudgetItem } from '../hooks/useBudgetsPage';

type CategoryOption = { id: string; name: string; type: string };
type GoalOption = { id: string; name: string };

const NO_GOAL = '';

interface BudgetFormDrawerProps {
  open: boolean;
  editing: BudgetItem | null;
  formData: BudgetFormData;
  saving: boolean;
  onFormChange: (data: BudgetFormData) => void;
  onSave: () => void;
  onClose: () => void;
}

type FieldChange = { field: keyof BudgetFormData; value: string | number };

function useExpenseCategories(open: boolean): CategoryOption[] {
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    apiQueryDecoded({ url: '/categories', contract: 'CategoryList' })
      .then(categories => {
        setCategories(categories.filter(category => category.type === 'expense'));
      })
      .catch(() => {
        setCategories([]);
      });
  }, [open]);

  return categories;
}

// null until the goals request settles, so the empty-state hint below never
// flashes while they are still loading.
function useGoals(open: boolean): GoalOption[] | null {
  const [goals, setGoals] = useState<GoalOption[] | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    apiQueryDecoded({ url: '/goals', contract: 'GoalList' })
      .then(setGoals)
      // A member without goal.view keeps the picker empty and unexplained —
      // the budget is still saveable without a goal.
      .catch(() => {});
  }, [open]);

  return goals;
}

function DrawerTitle({
  editing,
  onClose,
}: Pick<BudgetFormDrawerProps, 'editing' | 'onClose'>): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <div className="seneca-payable-drawer__title-wrap">
      <button
        type="button"
        onClick={onClose}
        className="seneca-payable-drawer__back-btn"
        aria-label={t.cancel.value}
      >
        <ChevronLeft size={20} />
      </button>
      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
        {editing ? t.editBudget : t.newBudget}
      </span>
    </div>
  );
}

function NameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <TextField
      label={t.fieldName.value}
      value={value}
      onChange={event => onChange(event.target.value)}
      fullWidth
    />
  );
}

function CategoryField({
  value,
  disabled,
  categories,
  onChange,
}: {
  value: string;
  disabled: boolean;
  categories: CategoryOption[];
  onChange: (value: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label
        htmlFor="budget-category"
        style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}
      >
        {t.fieldCategory}
      </label>
      <CategoryPickerField
        id="budget-category"
        value={value}
        categories={categories}
        onChange={onChange}
        placeholder={t.fieldCategory.value}
        disabled={disabled}
      />
    </div>
  );
}

function LimitAmountField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <TextField
      label={t.fieldLimitAmount.value}
      type="number"
      value={value || ''}
      onChange={event => onChange(Number(event.target.value))}
      fullWidth
      slotProps={{
        htmlInput: { min: 0, step: 1000 },
      }}
    />
  );
}

function PeriodField({
  value,
  disabled,
  onChange,
}: {
  value: BudgetFormData['periodType'];
  disabled: boolean;
  onChange: (value: BudgetFormData['periodType']) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <FormControl fullWidth>
      <InputLabel>{t.fieldPeriod}</InputLabel>
      <Select
        value={value}
        label={t.fieldPeriod.value}
        onChange={event => onChange(event.target.value as BudgetFormData['periodType'])}
        disabled={disabled}
      >
        <MenuItem value="weekly">{t.periodWeekly}</MenuItem>
        <MenuItem value="monthly">{t.periodMonthly}</MenuItem>
        <MenuItem value="quarterly">{t.periodQuarterly}</MenuItem>
        <MenuItem value="annual">{t.periodAnnual}</MenuItem>
      </Select>
    </FormControl>
  );
}

function RolloverField({
  value,
  onChange,
}: {
  value: BudgetFormData['rolloverMode'];
  onChange: (value: BudgetFormData['rolloverMode']) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <FormControl fullWidth>
      <InputLabel>{t.fieldRollover}</InputLabel>
      <Select
        value={value}
        label={t.fieldRollover.value}
        onChange={event => onChange(event.target.value as BudgetFormData['rolloverMode'])}
      >
        <MenuItem value="none">{t.rolloverNone}</MenuItem>
        <MenuItem value="carry">{t.rolloverCarry}</MenuItem>
        <MenuItem value="refill">{t.rolloverRefill}</MenuItem>
      </Select>
    </FormControl>
  );
}

function GoalField({
  value,
  goals,
  onChange,
  onClose,
}: {
  value: string;
  goals: GoalOption[] | null;
  onChange: (value: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <FormControl fullWidth>
      <InputLabel>{t.fieldGoal}</InputLabel>
      <Select
        value={value}
        label={t.fieldGoal.value}
        onChange={event => onChange(event.target.value)}
      >
        <MenuItem value={NO_GOAL}>
          <em>{t.noGoal}</em>
        </MenuItem>
        {(goals ?? []).map(goal => (
          <MenuItem key={goal.id} value={goal.id}>
            {goal.name}
          </MenuItem>
        ))}
      </Select>
      {/* Budgets only link to goals; goals themselves are created on their
          own page, so an empty picker points the way there. */}
      {goals?.length === 0 && (
        <FormHelperText>
          {t.noGoalsYet}{' '}
          <Link component={NextLink} href="/goals" onClick={onClose}>
            {t.createGoalLink}
          </Link>
        </FormHelperText>
      )}
    </FormControl>
  );
}

function StartsOnField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <CustomDatePicker
      label={t.fieldStartsOn.value}
      value={value}
      onChange={onChange}
      size="medium"
    />
  );
}

function EndsOnField({
  value,
  invalid,
  onChange,
}: {
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <CustomDatePicker
      label={t.fieldEndsOn.value}
      value={value}
      onChange={onChange}
      size="medium"
      error={invalid}
      helperText={invalid ? t.endBeforeStart.value : undefined}
    />
  );
}

function FormFields({
  editing,
  formData,
  categories,
  goals,
  hasBackwardsWindow,
  onChange,
  onClose,
}: Pick<BudgetFormDrawerProps, 'editing' | 'formData' | 'onClose'> & {
  categories: CategoryOption[];
  goals: GoalOption[] | null;
  hasBackwardsWindow: boolean;
  onChange: (change: FieldChange) => void;
}): React.JSX.Element {
  const isEditing = Boolean(editing);

  return (
    // The scroll container would clip the first field's floating label, which
    // sits above the input, so the padding keeps it inside.
    <div
      style={{
        display: 'grid',
        gap: 16,
        flex: 1,
        overflowY: 'auto',
        minHeight: 0,
        padding: '10px 4px 4px',
      }}
    >
      <NameField value={formData.name} onChange={value => onChange({ field: 'name', value })} />
      <CategoryField
        value={formData.categoryId}
        disabled={isEditing}
        categories={categories}
        onChange={value => onChange({ field: 'categoryId', value })}
      />
      <LimitAmountField
        value={formData.limitAmount}
        onChange={value => onChange({ field: 'limitAmount', value })}
      />
      <PeriodField
        value={formData.periodType}
        disabled={isEditing}
        onChange={value => onChange({ field: 'periodType', value })}
      />
      {/* Where the unspent part of a period goes: nowhere, into the next
          period, or back up to the limit. */}
      <RolloverField
        value={formData.rolloverMode}
        onChange={value => onChange({ field: 'rolloverMode', value })}
      />
      <GoalField
        value={formData.goalId}
        goals={goals}
        onChange={value => onChange({ field: 'goalId', value })}
        onClose={onClose}
      />
      {/* A project budget runs only while the project does. Left empty — the
          normal case — the budget behaves as it always has and never ends. */}
      <StartsOnField
        value={formData.startsOn}
        onChange={value => onChange({ field: 'startsOn', value })}
      />
      <EndsOnField
        value={formData.endsOn}
        invalid={hasBackwardsWindow}
        onChange={value => onChange({ field: 'endsOn', value })}
      />
    </div>
  );
}

function DrawerFooter({
  saving,
  onSave,
  onClose,
  canSave,
}: Pick<BudgetFormDrawerProps, 'saving' | 'onSave' | 'onClose'> & {
  canSave: boolean;
}): React.JSX.Element {
  const t = useIntlayer('budgetsPage');
  return (
    <div className="seneca-payable-drawer__footer">
      <Button variant="outlined" sx={{ flex: 1 }} onClick={onClose} disabled={saving}>
        {t.cancel}
      </Button>
      <Button variant="contained" sx={{ flex: 1 }} onClick={onSave} disabled={saving || !canSave}>
        {saving ? t.saving : t.save}
      </Button>
    </div>
  );
}

export function BudgetFormDrawer(props: BudgetFormDrawerProps): React.JSX.Element {
  const categories = useExpenseCategories(props.open);
  const goals = useGoals(props.open);
  const { formData, onFormChange } = props;
  const handleChange = useCallback(
    (change: FieldChange): void => {
      onFormChange({ ...formData, [change.field]: change.value });
    },
    [formData, onFormChange],
  );

  const hasBackwardsWindow = Boolean(
    formData.startsOn && formData.endsOn && formData.startsOn > formData.endsOn,
  );
  const canSave = Boolean(
    formData.name.trim() && formData.categoryId && formData.limitAmount > 0 && !hasBackwardsWindow,
  );

  return (
    <DrawerShell
      isOpen={props.open}
      onClose={props.onClose}
      position="right"
      width="lg"
      showCloseButton={false}
      sx={{
        maxWidth: '100%',
        borderLeft: 0,
        bgcolor: 'background.paper',
        '@media (min-width:600px)': { maxWidth: 512 },
      }}
      title={<DrawerTitle editing={props.editing} onClose={props.onClose} />}
    >
      <div className="seneca-payable-drawer__body">
        <FormFields
          editing={props.editing}
          formData={formData}
          categories={categories}
          goals={goals}
          hasBackwardsWindow={hasBackwardsWindow}
          onChange={handleChange}
          onClose={props.onClose}
        />
        <DrawerFooter
          saving={props.saving}
          onSave={props.onSave}
          onClose={props.onClose}
          canSave={canSave}
        />
      </div>
    </DrawerShell>
  );
}
