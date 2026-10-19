'use client';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ConfirmModal from '@/app/components/ConfirmModal';
import { useIntlayer } from '@/app/i18n';
import type { RollbackState } from '../hooks/useAuditRollback';

type MsgProps = {
  rollbackTarget: NonNullable<RollbackState['rollbackTarget']>;
  rollbackError: string | null;
};
function RollbackMessage({ rollbackTarget, rollbackError }: MsgProps): React.JSX.Element {
  const t = useIntlayer('auditUi');
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" style={{ color: 'var(--text-secondary)' }}>
        {t.rollbackAttempt}{' '}
        {rollbackTarget.description || `${rollbackTarget.entityType} ${rollbackTarget.entityId}`}.
      </Typography>
      {rollbackTarget.diff && (
        <Alert severity="warning" sx={{ fontSize: 12 }}>
          {t.rollbackDiffWarning}
        </Alert>
      )}
      {rollbackError && (
        <Typography variant="body2" style={{ color: 'var(--destructive)' }}>
          {rollbackError}
        </Typography>
      )}
    </Stack>
  );
}

export function AuditRollbackModal({ rollback }: { rollback: RollbackState }): React.JSX.Element {
  const t = useIntlayer('auditUi');
  return (
    <ConfirmModal
      isOpen={Boolean(rollback.rollbackTarget)}
      onClose={rollback.cancelRollback}
      onConfirm={rollback.confirmRollback}
      title={t.confirmRollback.value}
      message={
        rollback.rollbackTarget && (
          <RollbackMessage
            rollbackTarget={rollback.rollbackTarget}
            rollbackError={rollback.rollbackError}
          />
        )
      }
      confirmText={rollback.rollbackLoading ? t.rollingBack.value : t.rollback.value}
      cancelText={t.cancel.value}
      isDestructive
      isLoading={rollback.rollbackLoading}
      manualClose
    />
  );
}
