import { useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import type { AuditEvent } from '@/lib/api/audit';
import { rollbackEvent } from '@/lib/api/audit';
import { getErrorMessage } from '../helpers/audit-helpers';
import { assertRollbackSucceeded } from '../utils/rollback-result';

export type RollbackState = {
  rollbackTarget: AuditEvent | null;
  rollbackLoading: boolean;
  rollbackError: string | null;
  handleRollback: (e: AuditEvent) => void;
  confirmRollback: () => Promise<void>;
  cancelRollback: () => void;
};

type RollbackParams = { onAfterRollback: () => unknown; onCloseDrawer: () => void };

export function useAuditRollback({
  onAfterRollback,
  onCloseDrawer,
}: RollbackParams): RollbackState {
  const t = useIntlayer('auditUi');
  const [rollbackTarget, setRollbackTarget] = useState<AuditEvent | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  const handleRollback = (event: AuditEvent): void => {
    setRollbackTarget(event);
    setRollbackError(null);
  };
  const cancelRollback = (): void => {
    setRollbackTarget(null);
  };

  const confirmRollback = async (): Promise<void> => {
    if (!rollbackTarget) {
      return;
    }
    setRollbackLoading(true);
    setRollbackError(null);

    await (async () => {
      const result = await rollbackEvent(rollbackTarget.id);
      assertRollbackSucceeded(result);
      toast.success(t.rollbackSuccess.value);
      setRollbackTarget(null);
      onCloseDrawer();
      onAfterRollback();
    })()
      .catch(async (err: unknown) => {
        setRollbackError(getErrorMessage({ error: err, fallback: t.rollbackFailed.value }));
      })
      .finally(async () => {
        setRollbackLoading(false);
      });
  };

  return {
    rollbackTarget,
    rollbackLoading,
    rollbackError,
    handleRollback,
    confirmRollback,
    cancelRollback,
  };
}
