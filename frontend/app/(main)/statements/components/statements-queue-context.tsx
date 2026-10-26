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
import {
  type CloudImportProvider,
  type ConnectedCloudProviders,
} from '@/app/lib/statement-upload-actions';

export type StatementsQueueValue = {
  providers: ConnectedCloudProviders;
  onScan: () => void;
  onCloudImport: (provider: CloudImportProvider | null) => void;
  onGmail: () => void;
  onLocalUpload: () => void;
};

// Rendered outside the statements layout (tests, storybook-style mounts) the
// upload button still renders; it just has nothing to act on.
const FALLBACK_VALUE: StatementsQueueValue = {
  providers: { googleDriveConnected: false, dropboxConnected: false, gmailConnected: false },
  onScan: () => undefined,
  onCloudImport: () => undefined,
  onGmail: () => undefined,
  onLocalUpload: () => undefined,
};

const StatementsQueueContext = createContext<StatementsQueueValue>(FALLBACK_VALUE);

export function useStatementsQueue(): StatementsQueueValue {
  return useContext(StatementsQueueContext);
}

function useCloudProviders(user: unknown): ConnectedCloudProviders {
  const [providers, setProviders] = useState<ConnectedCloudProviders>(FALLBACK_VALUE.providers);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return;
    }

    void Promise.allSettled([
      apiClient.get('/integrations/dropbox/status'),
      apiClient.get('/integrations/google-drive/status'),
      apiClient.get('/integrations/imap/status'),
    ]).then(([dropbox, googleDrive, inbox]) => {
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

      if (isMounted) {
        setProviders({
          dropboxConnected: isConnected(dropbox),
          googleDriveConnected: isConnected(googleDrive),
          gmailConnected: isConnected(inbox),
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return providers;
}

type UploadActions = Pick<
  StatementsQueueValue,
  'onScan' | 'onCloudImport' | 'onGmail' | 'onLocalUpload'
>;

function useUploadActions(gmailConnected: boolean): UploadActions {
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

  const onCloudImport = useCallback(
    (provider: CloudImportProvider | null): void => {
      if (!provider) {
        openAppPanel('integrations');
        return;
      }

      const endpoint =
        provider === 'dropbox' ? '/integrations/dropbox/sync' : '/integrations/google-drive/sync';

      apiClient
        .post(endpoint)
        .then(() => {
          toast.success(
            provider === 'dropbox'
              ? tSync.dropboxImportStarted.value
              : tSync.googleDriveImportStarted.value,
          );
          navigateToSubmit();
        })
        .catch(() => {
          toast.error(
            provider === 'dropbox'
              ? tSync.dropboxImportFailed.value
              : tSync.googleDriveImportFailed.value,
          );
        });
    },
    [navigateToSubmit, tSync],
  );

  const onGmail = useCallback((): void => {
    if (!gmailConnected) {
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
  }, [gmailConnected, navigateToSubmit, tSync]);

  return {
    onScan: useCallback(() => navigateToSubmit('scan'), [navigateToSubmit]),
    onLocalUpload: useCallback(() => navigateToSubmit('manual'), [navigateToSubmit]),
    onCloudImport,
    onGmail,
  };
}

/**
 * The connected cloud providers and the upload actions the statements upload button
 * needs. Mounted once by the statements layout, so switching pages neither remounts
 * it nor reloads the providers.
 */
export function StatementsQueueProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user } = useAuth();
  const providers = useCloudProviders(user);
  const actions = useUploadActions(providers.gmailConnected);

  const value = useMemo<StatementsQueueValue>(
    () => ({ providers, ...actions }),
    [providers, actions],
  );

  return (
    <StatementsQueueContext.Provider value={value}>{children}</StatementsQueueContext.Provider>
  );
}
