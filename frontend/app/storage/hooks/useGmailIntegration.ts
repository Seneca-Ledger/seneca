'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/api';

export interface GmailStatus {
  connected?: boolean;
}

export interface GmailIntegrationState {
  gmailStatus: GmailStatus | null;
  gmailLoading: boolean;
}

export function useGmailIntegration(): GmailIntegrationState {
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      return await (async () => {
        setGmailLoading(true);
        const resp = await api.get('/integrations/gmail/status');
        if (!mounted) {
          return;
        }
        // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
        setGmailStatus((resp.data as GmailStatus) || null);
      })()
        .catch(async () => {
          // ignore
        })
        .finally(async () => {
          if (mounted) {
            setGmailLoading(false);
          }
        });
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return { gmailStatus, gmailLoading };
}
