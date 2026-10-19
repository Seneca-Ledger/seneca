'use client';

import React from 'react';
import { AlertTriangle } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { ModalFooter, ModalShell } from './ui/modal-shell';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  /** When true, the modal will not auto-close after confirming; caller manages close. */
  manualClose?: boolean;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function, complexity
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  isDestructive = false,
  isLoading = false,
  icon,
  manualClose = false,
}: ConfirmModalProps) {
  const t = useIntlayer('confirmModal');

  const resolvedConfirmText = confirmText ?? t.buttons.confirm.value;
  const resolvedCancelText = cancelText ?? t.buttons.cancel.value;

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleConfirm = () => {
    onConfirm();
    if (!(isLoading || manualClose)) {
      onClose();
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={true}
      closeOnBackdropClick={!isLoading}
      closeOnEscape={!isLoading}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              padding: 8,
              borderRadius: tokens.radius.full,
              background: isDestructive
                ? 'var(--color-error-soft-bg)'
                : 'var(--color-info-soft-bg)',
              color: isDestructive ? '#dc2626' : '#2563eb',
            }}
          >
            {icon ?? <AlertTriangle size={20} />}
          </div>
          <span>{title}</span>
        </div>
      }
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={handleConfirm}
          cancelText={resolvedCancelText}
          confirmText={resolvedConfirmText}
          confirmVariant={isDestructive ? 'destructive' : 'primary'}
          isConfirmLoading={isLoading}
          isConfirmDisabled={isLoading}
        />
      }
    >
      {typeof message === 'string' ? (
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.625 }}>{message}</p>
      ) : (
        message
      )}
    </ModalShell>
  );
}
