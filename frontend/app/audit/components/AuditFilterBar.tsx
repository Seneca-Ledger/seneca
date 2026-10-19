'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FilterActions } from '@/app/(main)/statements/components/filters/FilterActions';
import { FilterDropdown } from '@/app/(main)/statements/components/filters/FilterDropdown';
import { Search } from '@/app/components/icons';
import { FilterChipButton } from '@/app/components/ui/filter-chip-button';
import { useIntlayer } from '@/app/i18n';
import {
  type ActorType,
  type AuditAction,
  type AuditEventFilter,
  ENTITY_TYPES,
  type EntityType,
} from '@/lib/api/audit';

/** Keys of the `auditUi` dictionary used as option labels. */
type LabelKey =
  | 'allUsers'
  | 'user'
  | 'system'
  | 'integration'
  | 'ai'
  | 'allActions'
  | 'actionCreate'
  | 'actionUpdate'
  | 'actionDelete'
  | 'actionImport'
  | 'actionExport'
  | 'actionLink'
  | 'actionUnlink'
  | 'actionMerge'
  | 'actionCategorize'
  | 'rollback'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'allTime';

type ActorTypeOption = { value: ActorType | ''; labelKey: LabelKey };
type ActionOption = { value: AuditAction | ''; labelKey: LabelKey };

const ACTOR_OPTIONS: ActorTypeOption[] = [
  { value: '', labelKey: 'allUsers' },
  { value: 'user', labelKey: 'user' },
  { value: 'system', labelKey: 'system' },
  { value: 'integration', labelKey: 'integration' },
  { value: 'ai', labelKey: 'ai' },
];

const ACTION_OPTIONS: ActionOption[] = [
  { value: '', labelKey: 'allActions' },
  { value: 'create', labelKey: 'actionCreate' },
  { value: 'update', labelKey: 'actionUpdate' },
  { value: 'delete', labelKey: 'actionDelete' },
  { value: 'import', labelKey: 'actionImport' },
  { value: 'export', labelKey: 'actionExport' },
  { value: 'link', labelKey: 'actionLink' },
  { value: 'unlink', labelKey: 'actionUnlink' },
  { value: 'match', labelKey: 'actionMerge' },
  { value: 'apply_rule', labelKey: 'actionCategorize' },
  { value: 'rollback', labelKey: 'rollback' },
];

type DatePreset = '7d' | '30d' | '90d' | 'all';

const DATE_PRESETS: { value: DatePreset; labelKey: LabelKey }[] = [
  { value: '7d', labelKey: 'last7Days' },
  { value: '30d', labelKey: 'last30Days' },
  { value: '90d', labelKey: 'last90Days' },
  { value: 'all', labelKey: 'allTime' },
];

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function presetToDates(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  if (preset === 'all') {
    return {};
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { dateFrom: daysAgoIso(days), dateTo: undefined };
}

function currentPreset(filters: AuditEventFilter): DatePreset {
  if (!filters.dateFrom) {
    return '7d';
  }
  const diff = Math.round((Date.now() - new Date(filters.dateFrom).getTime()) / 86_400_000);
  if (diff <= 7) {
    return '7d';
  }
  if (diff <= 30) {
    return '30d';
  }
  if (diff <= 90) {
    return '90d';
  }
  return 'all';
}

function dateChipLabelKey(filters: AuditEventFilter): LabelKey {
  const preset = currentPreset(filters);
  return DATE_PRESETS.find(p => p.value === preset)?.labelKey ?? 'last7Days';
}

interface AuditFilterBarProps {
  filters: AuditEventFilter;
  onFiltersChange: (update: Partial<AuditEventFilter>) => void;
}

export function AuditFilterBar({ filters, onFiltersChange }: AuditFilterBarProps) {
  const t = useIntlayer('auditUi');
  const [usersOpen, setUsersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [entityOpen, setEntityOpen] = useState(false);

  // Pending state for dropdowns (apply on confirm)
  const [pendingActorType, setPendingActorType] = useState<ActorType | ''>(filters.actorType ?? '');
  const [pendingAction, setPendingAction] = useState<AuditAction | ''>(filters.action ?? '');
  const [pendingDatePreset, setPendingDatePreset] = useState<DatePreset>(currentPreset(filters));
  const [pendingEntity, setPendingEntity] = useState<EntityType | ''>(filters.entityType ?? '');

  // Search debounce
  const [searchVal, setSearchVal] = useState(filters.actorLabel ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (val: string) => {
      setSearchVal(val);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onFiltersChange({ actorLabel: val || undefined });
      }, 300);
    },
    [onFiltersChange],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const applyUsers = () => {
    onFiltersChange({ actorType: pendingActorType || undefined });
    setUsersOpen(false);
  };
  const resetUsers = () => {
    setPendingActorType('');
    onFiltersChange({ actorType: undefined });
    setUsersOpen(false);
  };

  const applyActions = () => {
    onFiltersChange({ action: pendingAction || undefined });
    setActionsOpen(false);
  };
  const resetActions = () => {
    setPendingAction('');
    onFiltersChange({ action: undefined });
    setActionsOpen(false);
  };

  const applyEntity = () => {
    onFiltersChange({ entityType: pendingEntity || undefined });
    setEntityOpen(false);
  };
  const resetEntity = () => {
    setPendingEntity('');
    onFiltersChange({ entityType: undefined });
    setEntityOpen(false);
  };

  const applyDate = () => {
    onFiltersChange(presetToDates(pendingDatePreset));
    setDateOpen(false);
  };
  const resetDate = () => {
    setPendingDatePreset('7d');
    onFiltersChange(presetToDates('7d'));
    setDateOpen(false);
  };

  const usersActive = Boolean(filters.actorType);
  const actionsActive = Boolean(filters.action);
  const dateActive = currentPreset(filters) !== '7d';
  const entityActive = Boolean(filters.entityType);
  const entityLabel = filters.entityType
    ? (t.entityLabels[filters.entityType]?.value ?? filters.entityType)
    : t.allEntityTypes.value;

  const usersLabel =
    t[ACTOR_OPTIONS.find(o => o.value === filters.actorType)?.labelKey ?? 'allUsers'].value;

  const actionsLabel =
    t[ACTION_OPTIONS.find(o => o.value === filters.action)?.labelKey ?? 'allActions'].value;

  return (
    <div className="audit-filter-bar">
      {/* Search */}
      <div className="audit-search-wrap">
        <Search size={14} />
        <input
          className="audit-search"
          placeholder={t.searchPlaceholder.value}
          value={searchVal}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {/* Users chip */}
      <FilterDropdown
        open={usersOpen}
        onOpenChange={open => {
          setUsersOpen(open);
          if (open) {
            setPendingActorType(filters.actorType ?? '');
          }
        }}
        trigger={<FilterChipButton active={usersActive}>{usersLabel}</FilterChipButton>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ACTOR_OPTIONS.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <input
                type="radio"
                name="audit-actor-type"
                value={opt.value}
                checked={pendingActorType === opt.value}
                onChange={() => setPendingActorType(opt.value)}
              />
              {t[opt.labelKey]}
            </label>
          ))}
        </div>
        <FilterActions
          applyLabel={t.apply.value}
          resetLabel={t.reset.value}
          onApply={applyUsers}
          onReset={resetUsers}
        />
      </FilterDropdown>

      {/* Actions chip */}
      <FilterDropdown
        open={actionsOpen}
        onOpenChange={open => {
          setActionsOpen(open);
          if (open) {
            setPendingAction(filters.action ?? '');
          }
        }}
        trigger={<FilterChipButton active={actionsActive}>{actionsLabel}</FilterChipButton>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ACTION_OPTIONS.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <input
                type="radio"
                name="audit-action"
                value={opt.value}
                checked={pendingAction === opt.value}
                onChange={() => setPendingAction(opt.value)}
              />
              {t[opt.labelKey]}
            </label>
          ))}
        </div>
        <FilterActions
          applyLabel={t.apply.value}
          resetLabel={t.reset.value}
          onApply={applyActions}
          onReset={resetActions}
        />
      </FilterDropdown>

      {/* Entity type chip */}
      <FilterDropdown
        open={entityOpen}
        onOpenChange={open => {
          setEntityOpen(open);
          if (open) {
            setPendingEntity(filters.entityType ?? '');
          }
        }}
        trigger={<FilterChipButton active={entityActive}>{entityLabel}</FilterChipButton>}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {(['', ...ENTITY_TYPES] as const).map(value => (
            <label
              key={value || 'all'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <input
                type="radio"
                name="audit-entity-type"
                value={value}
                checked={pendingEntity === value}
                onChange={() => setPendingEntity(value)}
              />
              {value ? (t.entityLabels[value]?.value ?? value) : t.allEntityTypes.value}
            </label>
          ))}
        </div>
        <FilterActions
          applyLabel={t.apply.value}
          resetLabel={t.reset.value}
          onApply={applyEntity}
          onReset={resetEntity}
        />
      </FilterDropdown>

      {/* Date chip */}
      <FilterDropdown
        open={dateOpen}
        onOpenChange={open => {
          setDateOpen(open);
          if (open) {
            setPendingDatePreset(currentPreset(filters));
          }
        }}
        trigger={
          <FilterChipButton active={dateActive}>
            {t[dateChipLabelKey(filters)].value}
          </FilterChipButton>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {DATE_PRESETS.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <input
                type="radio"
                name="audit-date-preset"
                value={opt.value}
                checked={pendingDatePreset === opt.value}
                onChange={() => setPendingDatePreset(opt.value)}
              />
              {t[opt.labelKey]}
            </label>
          ))}
        </div>
        <FilterActions
          applyLabel={t.apply.value}
          resetLabel={t.reset.value}
          onApply={applyDate}
          onReset={resetDate}
        />
      </FilterDropdown>
    </div>
  );
}
