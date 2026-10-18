'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import type { PluginKey } from '../types';

/** Where each plugin's switch lives in `workspace.settings.plugins`. */
const SETTINGS_KEY = {
  'ai-assistant': 'aiAssistant',
  webhooks: 'webhooks',
  'mcp-server': 'mcp',
} as const satisfies Record<PluginKey, string>;

/** A missing or non-boolean switch counts as off, as on the server. */
export function readPluginSwitch(
  settings: Record<string, unknown> | null | undefined,
  key: PluginKey,
): boolean {
  const plugins = settings?.plugins;
  return (
    typeof plugins === 'object' &&
    plugins !== null &&
    (plugins as Record<string, unknown>)[SETTINGS_KEY[key]] === true
  );
}

/** Plugin switches of the open workspace; only owners and admins may flip them. */
export function usePluginState() {
  const { currentWorkspace, setWorkspacePlugins } = useWorkspace();
  const t = useIntlayer('pluginsPage');
  const [pending, setPending] = useState<PluginKey | null>(null);
  const settings = currentWorkspace?.settings;
  const workspaceId = currentWorkspace?.id;
  const canToggle =
    currentWorkspace?.memberRole === 'owner' || currentWorkspace?.memberRole === 'admin';

  const isEnabled = useCallback((key: PluginKey) => readPluginSwitch(settings, key), [settings]);

  const setEnabled = useCallback(
    async (key: PluginKey, enabled: boolean): Promise<void> => {
      if (!workspaceId) {
        return;
      }
      setPending(key);
      try {
        await setWorkspacePlugins({ workspaceId, plugins: { [SETTINGS_KEY[key]]: enabled } });
      } catch {
        toast.error(t.toggleFailed.value);
      } finally {
        setPending(null);
      }
    },
    [workspaceId, setWorkspacePlugins, t.toggleFailed],
  );

  return { isEnabled, setEnabled, canToggle, pending };
}
