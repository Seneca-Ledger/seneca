'use client';

import { useTheme } from 'next-themes';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  GitMerge,
  Trash2,
  X,
} from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

interface Props {
  selectedCount: number;
  selectedActionsOpen: boolean;
  hasSelectedDuplicates: boolean;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  onToggleActionsOpen: () => void;
  onMerge: () => void;
  onDismiss: () => void;
  onMarkDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

function DesktopDuplicateActions({
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  onMerge,
  onDismiss,
}: {
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  onMerge: () => void;
  onDismiss: () => void;
}): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <>
      <button type="button" onClick={onMerge} className="lumio-stmt-list-view__bulk-menu-btn">
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitMerge size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--primary)' }}>
            {mergeDuplicatesLabel}
          </span>
        </span>
        <ChevronRight size={16} style={{ color: c.ink300 }} />
      </button>
      <button type="button" onClick={onDismiss} className="lumio-stmt-list-view__bulk-menu-btn">
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <X size={16} style={{ color: c.ink400 }} />
          <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: c.ink900 }}>
            {dismissDuplicateLabel}
          </span>
        </span>
        <ChevronRight size={16} style={{ color: c.ink300 }} />
      </button>
      <div className="lumio-stmt-list-view__bulk-menu-divider" />
    </>
  );
}

function MobileDuplicateActions({
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  onMerge,
  onDismiss,
}: {
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  onMerge: () => void;
  onDismiss: () => void;
}): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        onClick={onMerge}
        className="lumio-stmt-list-view__mobile-action-btn lumio-stmt-list-view__mobile-action-btn--primary"
      >
        <GitMerge size={14} />
        {mergeDuplicatesLabel}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="lumio-stmt-list-view__mobile-action-btn lumio-stmt-list-view__mobile-action-btn--secondary"
      >
        <X size={14} />
        {dismissDuplicateLabel}
      </button>
    </>
  );
}

export function StatementsBulkActions({
  selectedCount,
  selectedActionsOpen,
  hasSelectedDuplicates,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onToggleActionsOpen,
  onMerge,
  onDismiss,
  onMarkDuplicate,
  onExport,
  onDelete,
}: Props): React.JSX.Element {
  const listText = useIntlayer('statementsListUi');
  const selectedLabel = listText.selectedCount.value.replace('{count}', String(selectedCount));
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <>
      <div className="lumio-stmt-list-view__bulk-desktop">
        <button
          type="button"
          onClick={onToggleActionsOpen}
          className="lumio-stmt-list-view__bulk-trigger"
        >
          {selectedLabel}
          <ChevronDown size={14} />
        </button>

        {selectedActionsOpen && (
          <div className="lumio-stmt-list-view__bulk-menu">
            {hasSelectedDuplicates ? (
              <DesktopDuplicateActions
                mergeDuplicatesLabel={mergeDuplicatesLabel}
                dismissDuplicateLabel={dismissDuplicateLabel}
                onMerge={onMerge}
                onDismiss={onDismiss}
              />
            ) : null}

            <button
              type="button"
              onClick={onMarkDuplicate}
              className="lumio-stmt-list-view__bulk-menu-btn"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Copy size={16} style={{ color: 'var(--primary)' }} />
                <span
                  style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--primary)' }}
                >
                  {markDuplicateLabel}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: c.ink300 }} />
            </button>

            <button
              type="button"
              onClick={onExport}
              className="lumio-stmt-list-view__bulk-menu-btn"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Download size={16} style={{ color: c.ink400 }} />
                <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: c.ink900 }}>
                  {listText.export}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: c.ink300 }} />
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="lumio-stmt-list-view__bulk-menu-btn lumio-stmt-list-view__bulk-menu-btn--danger"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={16} style={{ color: c.danger }} />
                <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: c.danger }}>
                  {listText.delete}
                </span>
              </span>
              <ChevronRight size={16} style={{ color: c.danger }} />
            </button>
          </div>
        )}
      </div>

      <div className="lumio-stmt-list-view__mobile-bulk">
        <span style={{ fontSize: 14, fontWeight: 500, color: c.ink800 }}>{selectedLabel}</span>
        <div className="lumio-stmt-list-view__mobile-bulk-actions">
          {hasSelectedDuplicates ? (
            <MobileDuplicateActions
              mergeDuplicatesLabel={mergeDuplicatesLabel}
              dismissDuplicateLabel={dismissDuplicateLabel}
              onMerge={onMerge}
              onDismiss={onDismiss}
            />
          ) : null}
          <button
            type="button"
            onClick={onMarkDuplicate}
            className="lumio-stmt-list-view__mobile-action-btn lumio-stmt-list-view__mobile-action-btn--primary"
          >
            <Copy size={14} />
            {markDuplicateLabel}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="lumio-stmt-list-view__mobile-action-btn lumio-stmt-list-view__mobile-action-btn--secondary"
          >
            <Download size={14} />
            {listText.export}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="lumio-stmt-list-view__mobile-action-btn lumio-stmt-list-view__mobile-action-btn--danger"
          >
            <Trash2 size={14} />
            {listText.delete}
          </button>
        </div>
      </div>
    </>
  );
}
