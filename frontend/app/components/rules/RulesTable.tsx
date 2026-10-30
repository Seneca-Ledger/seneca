'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@mui/material';
import NextLink from 'next/link';
import { GripVertical } from '@/app/components/icons';
import { formatDate } from '@/app/components/transactions/helpers/transactionFormatters';
import { useIntlayer, useLocale } from '@/app/i18n';
import { RuleRowMenu } from './RuleRowMenu';
import {
  describeConditions,
  describeResult,
  fill,
  type RuleNames,
  type RuleWords,
} from './rule-text';
import type { Rule } from './types';

export interface RuleRowActions {
  canEdit: boolean;
  canDelete: boolean;
  onToggle: (rule: Rule, isActive: boolean) => void;
  onApply: (rule: Rule) => void;
  onDelete: (rule: Rule) => void;
  onEdit: (rule: Rule) => void;
}

interface RulesTableProps extends RuleRowActions {
  rules: Rule[];
  words: RuleWords;
  names: RuleNames;
  /** The new order, first one on top; only offered to members who may edit. */
  onReorder: (rules: Rule[]) => void;
}

function RuleRow({
  rule,
  words,
  names,
  actions,
}: {
  rule: Rule;
  words: RuleWords;
  names: RuleNames;
  actions: RuleRowActions;
}) {
  const t = useIntlayer('categorizationRules');
  const { locale } = useLocale();
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id, disabled: !actions.canEdit });
  const settable = Boolean(rule.result.categoryId || rule.result.tagIds?.length);

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'seneca-rules-table__row',
        !rule.isActive && 'seneca-rules-table__row--paused',
        isDragging && 'seneca-rules-table__row--dragging',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <td className="seneca-rules-table__grip-cell">
        {actions.canEdit && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="seneca-rules-table__grip"
            aria-label={fill(t.page.dragHandle.value, { name: rule.name })}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
        )}
      </td>
      <td className="seneca-rules-table__name-cell">
        <NextLink href={`/rules/${rule.id}`} className="seneca-rules-table__name">
          {rule.name}
        </NextLink>
        {!rule.isActive && <span className="seneca-rules-table__paused">{t.page.paused}</span>}
      </td>
      <td data-label={t.page.when.value}>{describeConditions(rule.conditions, words, names)}</td>
      <td data-label={t.page.thenLabel.value}>{describeResult(rule.result, words, names)}</td>
      <td className="seneca-rules-table__stats">
        {rule.matchCount > 0
          ? [
              fill(t.page.matched.value, { count: rule.matchCount }),
              rule.lastMatchedAt
                ? fill(t.page.lastMatched.value, { date: formatDate(rule.lastMatchedAt, locale) })
                : null,
            ]
              .filter(Boolean)
              .join(', ')
          : t.page.neverMatched}
      </td>
      <td className="seneca-rules-table__controls">
        {actions.canEdit && (
          <Switch
            size="small"
            checked={rule.isActive}
            onChange={event => actions.onToggle(rule, event.target.checked)}
            slotProps={{ input: { 'aria-label': `${t.page.toggle.value}: ${rule.name}` } }}
          />
        )}
        <RuleRowMenu
          rule={rule}
          onEdit={actions.canEdit ? () => actions.onEdit(rule) : undefined}
          onApply={actions.canEdit && settable ? () => actions.onApply(rule) : undefined}
          onDelete={actions.canDelete ? () => actions.onDelete(rule) : undefined}
        />
      </td>
    </tr>
  );
}

/**
 * The workspace's rules in the order they are tried: the first one that
 * matches a row files it. Rows are dragged by their handle, or moved with the
 * keyboard (space, then the arrow keys).
 */
export function RulesTable({ rules, words, names, onReorder, ...actions }: RulesTableProps) {
  const t = useIntlayer('categorizationRules');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = rules.findIndex(rule => rule.id === active.id);
    const to = rules.findIndex(rule => rule.id === over.id);
    onReorder(arrayMove(rules, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <table className="seneca-rules-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="u-visually-hidden">{t.page.order}</span>
            </th>
            <th scope="col">{t.page.nameColumn}</th>
            <th scope="col">{t.page.when}</th>
            <th scope="col">{t.page.thenLabel}</th>
            <th scope="col">{t.page.matchedColumn}</th>
            <th scope="col">
              <span className="u-visually-hidden">{t.page.actions}</span>
            </th>
          </tr>
        </thead>
        <SortableContext items={rules.map(rule => rule.id)} strategy={verticalListSortingStrategy}>
          <tbody>
            {rules.map(rule => (
              <RuleRow key={rule.id} rule={rule} words={words} names={names} actions={actions} />
            ))}
          </tbody>
        </SortableContext>
      </table>
    </DndContext>
  );
}
