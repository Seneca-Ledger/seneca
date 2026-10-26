'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import {
  type OpenExpenseDrawerEventDetail,
  resolveExpenseDrawerMode,
  STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT,
  type StatementExpenseMode,
} from '@/app/lib/statement-expense-drawer';

export type StatementsQueueValue = {
  inboxConnected: boolean;
  onScan: () => void;
  onInboxSync: () => void;
  onLocalUpload: () => void;
};

// Rendered outside the statements layout (tests, storybook-style mounts) the
// upload button still renders; it just has nothing to act on.
const FALLBACK_VALUE: StatementsQueueValue = {
  inboxConnected: false,
  onScan: () => undefined,
  onInboxSync: () => undefined,
  onLocalUpload: () => undefined,
};

const StatementsQueueContext = createContext<StatementsQueueValue>(FALLBACK_VALUE);

export function useStatementsQueue(): StatementsQueueValue {
  return useContext(StatementsQueueContext);
}

function useInboxConnected(user: unknown): boolean {
  const [inboxConnected, setInboxConnected] = useState(FALLBACK_VALUE.inboxConnected);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    void Promise.allSettled([apiClient.get('/integrations/imap/status')]).then(([inbox]) => {
      const isConnected = (result: PromiseSettledResult<{ data?: unknown }>): boolean => {
        if (result.status !== 'fulfilled') {
          return false;
        }
        const data = result.value?.data;
        if (typeof data !== 'object' || data === null) {
          return false;
        }
        const flag = 'connected' in data ? data.connected : 'active' in data ? data.active : false;
        return flag === true;
      };

      if (isMounted && inbox) {
        setInboxConnected(isConnected(inbox));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return inboxConnected;
}

type UploadActions = Pick<StatementsQueueValue, 'onScan' | 'onInboxSync' | 'onLocalUpload'>;

function useUploadActions(inboxConnected: boolean): UploadActions {
  const router = useRouter();
  const tSync = useIntlayer('statementsSidePanelSync');

  const navigateToSubmit = useCallback(
    (mode?: StatementExpenseMode): void => {
      if (typeof window === 'undefined') {
        return;
      }
      if (window.location.pathname.startsWith('/statements/submit')) {
        if (mode) {
          const detail: OpenExpenseDrawerEventDetail = { mode: resolveExpenseDrawerMode(mode) };
          window.dispatchEvent(new CustomEvent(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, { detail }));
        }
        return;
      }
      router.push(`/statements/submit${mode ? `?openExpenseDrawer=${mode}` : ''}`);
    },
    [router],
  );

  const onInboxSync = useCallback((): void => {
    if (!inboxConnected) {
      openAppPanel('integrations', 'imap');
      return;
    }

    apiClient
      .post('/integrations/imap/sync')
      .then(response =>
        checkContract('ProtocolSyncResult', response.data, '/integrations/imap/sync'),
      )
      .then(result => {
        const scanned = result.scanned ?? 0;
        const imported = result.imported ?? 0;

        if (imported > 0) {
          toast.success(
            imported === 1
              ? tSync.inboxImportedOne.value
              : tSync.inboxImportedMany.value.replace('{count}', String(imported)),
          );
          navigateToSubmit();
          return;
        }

        if (scanned === 0) {
          toast.error(tSync.noUnreadEmails.value);
          return;
        }

        toast.error(tSync.noNewAttachments.value);
        navigateToSubmit();
      })
      .catch(() => {
        toast.error(tSync.syncInboxFailed.value);
      });
  }, [inboxConnected, navigateToSubmit, tSync]);

  return {
    onScan: useCallback(() => navigateToSubmit('scan'), [navigateToSubmit]),
    onLocalUpload: useCallback(() => navigateToSubmit('manual'), [navigateToSubmit]),
    onInboxSync,
  };
}

/**
 * The mailbox connection and the upload actions the statements upload button
 * needs. Mounted once by the statements layout, so switching pages neither remounts
 * it nor reloads the connection.
 */
export function StatementsQueueProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user } = useAuth();
  const inboxConnected = useInboxConnected(user);
  const actions = useUploadActions(inboxConnected);

  const value = useMemo<StatementsQueueValue>(
    () => ({ inboxConnected, ...actions }),
    [inboxConnected, actions],
  );

  return (
    <StatementsQueueContext.Provider value={value}>{children}</StatementsQueueContext.Provider>
  );
}
