'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export const duplicateResolutions = ['skip', 'mark_duplicate', 'force_import'] as const;
export type DuplicateResolution = (typeof duplicateResolutions)[number];

export type ProcessingSettings = {
  categorizationThreshold: number;
  duplicateResolution: DuplicateResolution;
  aiCategorization: boolean;
  aiMerchantNormalization: boolean;
  merchantLearning: boolean;
};

/** Mirrors the server defaults, which are the previously hardcoded values. */
const DEFAULTS: ProcessingSettings = {
  categorizationThreshold: 0.7,
  duplicateResolution: 'skip',
  aiCategorization: true,
  aiMerchantNormalization: true,
  merchantLearning: true,
};

export type UseProcessingMessages = {
  loadError: string;
  saveError: string;
  savedMessage: string;
};

export type UseProcessingReturn = {
  settings: ProcessingSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  message: string | null;
  update: (patch: Partial<ProcessingSettings>) => Promise<void>;
};

export function useProcessing(
  isAuthenticated: boolean,
  workspaceId: string | null | undefined,
  messages: UseProcessingMessages,
): UseProcessingReturn {
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!(isAuthenticated && workspaceId)) return;

    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      await apiClient.get(`/workspaces/${workspaceId}`).then(
        response => {
          if (!active) return;
          setSettings({ ...DEFAULTS, ...(response.data?.settings?.processing || {}) });
        },
        (err: unknown) => {
          if (active) setError(getApiErrorMessage(err, messages.loadError));
        },
      );
      if (active) setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [isAuthenticated, workspaceId, messages.loadError]);

  const rollbackRef = useRef(settings);

  const update = useCallback(
    async (patch: Partial<ProcessingSettings>) => {
      if (!workspaceId) return;

      // Capture the rollback value from the updater so `update` keeps its
      // identity across saves.
      setSettings(current => {
        rollbackRef.current = current;
        return { ...current, ...patch };
      });
      setSaving(true);
      setError(null);
      setMessage(null);

      await apiClient.patch(`/workspaces/${workspaceId}`, { processing: patch }).then(
        () => setMessage(messages.savedMessage),
        (err: unknown) => {
          setSettings(rollbackRef.current);
          setError(getApiErrorMessage(err, messages.saveError));
        },
      );
      setSaving(false);
    },
    [messages.saveError, messages.savedMessage, workspaceId],
  );

  return { settings, loading, saving, error, message, update };
}
