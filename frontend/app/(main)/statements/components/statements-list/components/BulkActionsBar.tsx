/* eslint-disable max-lines */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  GitMerge,
  Trash2,
  X,
} from '@/app/components/icons';

interface DuplicateActionsProps {
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  onMergeDuplicates: () => void;
  onDismissDuplicates: () => void;
}

function MergeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} className="seneca-stmt-list-view__bulk-menu-btn">
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <GitMerge size={16} style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--primary)' }}>
          {label}
        </span>
      </span>
      <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
    </button>
  );
}

function DismissButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} className="seneca-stmt-list-view__bulk-menu-btn">
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <X size={16} style={{ color: 'var(--muted-foreground)' }} />
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--foreground)' }}>
          {label}
        </span>
      </span>
      <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
    </button>
  );
}

function DuplicateActions({
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  onMergeDuplicates,
  onDismissDuplicates,
}: DuplicateActionsProps): React.JSX.Element {
  return (
    <>
      <MergeButton label={mergeDuplicatesLabel} onClick={onMergeDuplicates} />
      <DismissButton label={dismissDuplicateLabel} onClick={onDismissDuplicates} />
      <div className="seneca-stmt-list-view__bulk-menu-divider" />
    </>
  );
}

interface StandardActionsProps {
  markDuplicateLabel: string;
  onMarkAsDuplicate: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

// eslint-disable-next-line max-lines-per-function
function StandardActions({
  markDuplicateLabel,
  onMarkAsDuplicate,
  onExportSelected,
  onDeleteSelected,
}: StandardActionsProps): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        onClick={onMarkAsDuplicate}
        className="seneca-stmt-list-view__bulk-menu-btn"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Copy size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--primary)' }}>
            {markDuplicateLabel}
          </span>
        </span>
        <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
      </button>
      <button
        type="button"
        onClick={onExportSelected}
        className="seneca-stmt-list-view__bulk-menu-btn"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Download size={16} style={{ color: 'var(--muted-foreground)' }} />
          <span
            style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--foreground)' }}
          >
            Export
          </span>
        </span>
        <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
      </button>
      <button
        type="button"
        onClick={onDeleteSelected}
        className="seneca-stmt-list-view__bulk-menu-btn seneca-stmt-list-view__bulk-menu-btn--danger"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trash2 size={16} style={{ color: 'var(--destructive)' }} />
          <span
            style={{ fontSize: 16, fontWeight: 600, lineHeight: 1, color: 'var(--destructive)' }}
          >
            Delete
          </span>
        </span>
        <ChevronRight size={16} style={{ color: 'var(--destructive)' }} />
      </button>
    </>
  );
}

interface BulkActionsBarProps {
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  onMergeDuplicates: () => void;
  onDismissDuplicates: () => void;
  onMarkAsDuplicate: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

interface MobileBulkProps {
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  onMergeDuplicates: () => void;
  onDismissDuplicates: () => void;
  onMarkAsDuplicate: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

// eslint-disable-next-line max-lines-per-function
function MobileBulkActions({
  selectedCount,
  hasSelectedDuplicates,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onMergeDuplicates,
  onDismissDuplicates,
  onMarkAsDuplicate,
  onExportSelected,
  onDeleteSelected,
}: MobileBulkProps): React.JSX.Element {
  return (
    <div className="seneca-stmt-list-view__mobile-bulk">
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
        {selectedCount} selected
      </span>
      <div className="seneca-stmt-list-view__mobile-bulk-actions">
        {hasSelectedDuplicates ? (
          <>
            <button
              type="button"
              onClick={onMergeDuplicates}
              className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--primary"
            >
              <GitMerge size={14} />
              {mergeDuplicatesLabel}
            </button>
            <button
              type="button"
              onClick={onDismissDuplicates}
              className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--secondary"
            >
              <X size={14} />
              {dismissDuplicateLabel}
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onMarkAsDuplicate}
          className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--primary"
        >
          <Copy size={14} />
          {markDuplicateLabel}
        </button>
        <button
          type="button"
          onClick={onExportSelected}
          className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--secondary"
        >
          <Download size={14} />
          Export
        </button>
        <button
          type="button"
          onClick={onDeleteSelected}
          className="seneca-stmt-list-view__mobile-action-btn seneca-stmt-list-view__mobile-action-btn--danger"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}

function useOutsideClick({
  enabled,
  onClose,
}: {
  enabled: boolean;
  onClose: () => void;
}): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [enabled, onClose]);
  return ref;
}

interface DesktopMenuProps {
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  onMergeDuplicates: () => void;
  onDismissDuplicates: () => void;
  onMarkAsDuplicate: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

// eslint-disable-next-line max-lines-per-function
function DesktopBulkMenu({
  selectedCount,
  hasSelectedDuplicates,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onMergeDuplicates,
  onDismissDuplicates,
  onMarkAsDuplicate,
  onExportSelected,
  onDeleteSelected,
}: DesktopMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick({ enabled: open, onClose: () => setOpen(false) });

  return (
    <div className="seneca-stmt-list-view__bulk-desktop" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="seneca-stmt-list-view__bulk-trigger"
      >
        {selectedCount} selected
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="seneca-stmt-list-view__bulk-menu">
          {hasSelectedDuplicates ? (
            <DuplicateActions
              mergeDuplicatesLabel={mergeDuplicatesLabel}
              dismissDuplicateLabel={dismissDuplicateLabel}
              onMergeDuplicates={onMergeDuplicates}
              onDismissDuplicates={onDismissDuplicates}
            />
          ) : null}
          <StandardActions
            markDuplicateLabel={markDuplicateLabel}
            onMarkAsDuplicate={onMarkAsDuplicate}
            onExportSelected={onExportSelected}
            onDeleteSelected={onDeleteSelected}
          />
        </div>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function
export function BulkActionsBar({
  selectedCount,
  hasSelectedDuplicates,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onMergeDuplicates,
  onDismissDuplicates,
  onMarkAsDuplicate,
  onExportSelected,
  onDeleteSelected,
}: BulkActionsBarProps): React.JSX.Element {
  return (
    <>
      <DesktopBulkMenu
        selectedCount={selectedCount}
        hasSelectedDuplicates={hasSelectedDuplicates}
        mergeDuplicatesLabel={mergeDuplicatesLabel}
        dismissDuplicateLabel={dismissDuplicateLabel}
        markDuplicateLabel={markDuplicateLabel}
        onMergeDuplicates={onMergeDuplicates}
        onDismissDuplicates={onDismissDuplicates}
        onMarkAsDuplicate={onMarkAsDuplicate}
        onExportSelected={onExportSelected}
        onDeleteSelected={onDeleteSelected}
      />
      <MobileBulkActions
        selectedCount={selectedCount}
        hasSelectedDuplicates={hasSelectedDuplicates}
        mergeDuplicatesLabel={mergeDuplicatesLabel}
        dismissDuplicateLabel={dismissDuplicateLabel}
        markDuplicateLabel={markDuplicateLabel}
        onMergeDuplicates={onMergeDuplicates}
        onDismissDuplicates={onDismissDuplicates}
        onMarkAsDuplicate={onMarkAsDuplicate}
        onExportSelected={onExportSelected}
        onDeleteSelected={onDeleteSelected}
      />
    </>
  );
}
