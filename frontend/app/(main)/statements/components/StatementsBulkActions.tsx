'use client';

import { useTheme } from 'next-themes';
import { useEffect, useEffectEvent, useId, useRef } from 'react';
import type { Command } from '@/app/components/command-palette/command-registry';
import { ShortcutHint } from '@/app/components/command-palette/ShortcutHint';
import { ChevronDown, Copy, Download, GitMerge, Trash2, X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

interface Props {
  selectedCount: number;
  selectedActionsOpen: boolean;
  /** What the desktop menu offers: the Documents commands for the selection. */
  selectionActions: Command[];
  hasSelectedDuplicates: boolean;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  onActionsOpenChange: (open: boolean) => void;
  onMerge: () => void;
  onDismiss: () => void;
  onMarkDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

/** Moves focus along the menu's rows: arrows wrap, Home and End jump to the ends. */
function nextRow(rows: HTMLElement[], current: number, key: string): HTMLElement | undefined {
  const last = rows.length - 1;
  const steps: Record<string, number> = {
    ArrowDown: current >= last ? 0 : current + 1,
    ArrowUp: current <= 0 ? last : current - 1,
    Home: 0,
    End: last,
  };
  return key in steps ? rows[steps[key]] : undefined;
}

/**
 * The "N selected" menu on desktop: the same actions as the shortcuts and the
 * palette, each with its key. Opens on click, ↓ or "."; arrows move, Enter runs,
 * Escape, Tab or a click outside closes it.
 */
function DesktopActionsMenu({
  selectedLabel,
  open,
  actions,
  onOpenChange,
}: {
  selectedLabel: string;
  open: boolean;
  actions: Command[];
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const closeOutside = useEffectEvent((event: PointerEvent): void => {
    if (!rootRef.current?.contains(event.target as Node)) {
      onOpenChange(false);
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const listener = (event: PointerEvent): void => closeOutside(event);
    document.addEventListener('pointerdown', listener);
    return () => document.removeEventListener('pointerdown', listener);
  }, [open]);

  const close = (): void => {
    onOpenChange(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      // Handled here, so the page's Escape does not clear the selection too.
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      onOpenChange(false);
      return;
    }
    const rows = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const row = nextRow(rows, rows.indexOf(document.activeElement as HTMLElement), event.key);
    if (row) {
      event.preventDefault();
      row.focus();
    }
  };

  return (
    <div ref={rootRef} className="seneca-stmt-list-view__bulk-desktop">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => onOpenChange(!open)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        className="seneca-stmt-list-view__bulk-trigger"
      >
        {selectedLabel}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={selectedLabel}
          className="seneca-stmt-list-view__bulk-menu"
          onKeyDown={onMenuKeyDown}
        >
          {actions.map(action => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                action.run();
              }}
              className={`seneca-stmt-list-view__bulk-menu-btn${
                action.id === 'documents.deleteSelected'
                  ? ' seneca-stmt-list-view__bulk-menu-btn--danger'
                  : ''
              }`}
            >
              <span className="seneca-stmt-list-view__bulk-menu-label">
                {action.icon}
                {action.label}
              </span>
              {action.binding ? <ShortcutHint binding={action.binding} /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
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
        className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--primary"
      >
        <GitMerge size={14} />
        {mergeDuplicatesLabel}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--secondary"
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
  selectionActions,
  hasSelectedDuplicates,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onActionsOpenChange,
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
      <DesktopActionsMenu
        selectedLabel={selectedLabel}
        open={selectedActionsOpen}
        actions={selectionActions}
        onOpenChange={onActionsOpenChange}
      />

      <div className="seneca-stmt-list-view__mobile-bulk">
        <span style={{ fontSize: 14, fontWeight: 500, color: c.ink800 }}>{selectedLabel}</span>
        <div className="seneca-stmt-list-view__mobile-bulk-actions">
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
            className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--primary"
          >
            <Copy size={14} />
            {markDuplicateLabel}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--secondary"
          >
            <Download size={14} />
            {listText.export}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--danger"
          >
            <Trash2 size={14} />
            {listText.delete}
          </button>
        </div>
      </div>
    </>
  );
}
