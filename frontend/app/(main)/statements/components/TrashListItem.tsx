'use client';

import type React from 'react';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { BriefcaseBusiness, FileText, RotateCcw, Table2, Trash2 } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import type { TrashEntityType } from './trash-utils';

export type TrashListItemModel = {
  id: string;
  fileName: string;
  bankName: string;
  fileType: string;
  entityType?: TrashEntityType;
  deletedAt?: string | null;
  createdAt: string;
};

type Props = {
  item: TrashListItemModel;
  selected: boolean;
  onToggleSelect: () => void;
  onRestore: () => void;
  onDelete: () => void;
  bankDisplayName: string;
  typeLabel: string;
  deletedAtLabel: string;
  autoDeleteAtLabel: string;
  deletedAtCaption: string;
  autoDeleteAtCaption: string;
  restoreLabel: string;
  deleteLabel: string;
};

const ENTITY_ICON_BY_TYPE: Record<
  TrashEntityType,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  statement: FileText,
  table: Table2,
  workspace: BriefcaseBusiness,
};

export function TrashListItem({
  item,
  selected,
  onToggleSelect,
  onRestore,
  onDelete,
  bankDisplayName,
  typeLabel,
  deletedAtLabel,
  autoDeleteAtLabel,
  deletedAtCaption,
  autoDeleteAtCaption,
  restoreLabel,
  deleteLabel,
}: Props) {
  const TypeIcon = ENTITY_ICON_BY_TYPE[item.entityType ?? 'statement'] ?? FileText;

  return (
    <div className="seneca-trash-item">
      <div className="seneca-trash-item__inner">
        <div className="seneca-trash-item__type-col">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            style={{ height: 16, width: 16 }}
          />
          <div className="seneca-trash-item__type-label">
            <TypeIcon size={16} color="var(--muted-foreground)" />
            <span>{typeLabel}</span>
          </div>
        </div>

        <div className="seneca-trash-item__dates-col">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="seneca-trash-item__date-label">{deletedAtCaption}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{deletedAtLabel}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="seneca-trash-item__date-label">{autoDeleteAtCaption}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{autoDeleteAtLabel}</span>
          </div>
        </div>

        <div className="seneca-trash-item__file-col">
          <BankLogoAvatar bankName={item.bankName} size={20} />
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              {item.fileName}
            </p>
            {bankDisplayName ? (
              <p
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  color: 'var(--muted-foreground)',
                }}
              >
                {bankDisplayName}
              </p>
            ) : null}
          </div>
        </div>

        <div className="seneca-trash-item__actions">
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              onRestore();
            }}
            className="seneca-trash-item__restore-btn"
            title={restoreLabel}
          >
            <RotateCcw size={14} />
            {restoreLabel}
          </button>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              onDelete();
            }}
            className="seneca-trash-item__delete-btn"
            title={deleteLabel}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
