'use client';

import { useTheme } from 'next-themes';
import React from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { AuditEvent } from '@/lib/api/audit';
import { tokens } from '@/lib/theme-tokens';
import { formatAuditEvent } from '../utils/formatAuditEvent';
import { relativeTime } from '../utils/relativeTime';

interface AuditEventModalProps {
  event: AuditEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onRollback?: (event: AuditEvent) => void;
  rollbackLoading?: boolean;
}

export function AuditEventModal({
  event,
  isOpen,
  onClose,
  onRollback,
  rollbackLoading,
}: AuditEventModalProps) {
  const t = useIntlayer('auditUi');
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

  if (!event) {
    return null;
  }
  const formatted = formatAuditEvent(event);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: `1px solid ${c.ink100}`,
    fontSize: 13,
  };

  const labelStyle: React.CSSProperties = {
    color: c.ink500,
    fontWeight: 500,
  };

  const valueStyle: React.CSSProperties = {
    color: c.ink900,
    fontWeight: 500,
    textAlign: 'right',
    maxWidth: '60%',
    wordBreak: 'break-all',
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={t.eventDetails.value}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelText={t.close.value}
          {...(event.isUndoable && onRollback
            ? {
                onConfirm: () => onRollback(event),
                confirmText: t.rollback.value,
                confirmVariant: 'destructive',
                isConfirmLoading: rollbackLoading,
              }
            : {})}
        />
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Description banner */}
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 12,
            background: c.ink50,
            border: `1px solid ${c.ink150}`,
            borderRadius: tokens.radius.md,
            fontSize: 13,
            color: c.ink700,
            lineHeight: 1.5,
          }}
        >
          {formatted.description}
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>{t.actor}</span>
          <span style={valueStyle}>{event.actorLabel}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t.action}</span>
          <span style={valueStyle}>{formatted.actionLabel}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t.entity}</span>
          <span style={valueStyle}>{formatted.objectLabel}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>{t.when}</span>
          <span style={valueStyle}>{relativeTime(event.createdAt)}</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>{t.severity}</span>
          <span style={valueStyle}>{event.severity}</span>
        </div>

        {event.isUndoable && (
          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: c.ink400,
              lineHeight: 1.5,
            }}
          >
            {t.rollbackHint}
          </p>
        )}
      </div>
    </ModalShell>
  );
}
