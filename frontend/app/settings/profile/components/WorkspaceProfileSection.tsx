'use client';

import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import {
  type WorkspaceProfile,
  workspaceProfileOf,
} from '@/app/components/navigation/helpers/navigation-config';
import { Alert } from '@/app/components/ui/alert';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

type Tx = (path: string[], fallback: string) => string;

/**
 * Home or business. Only the menu changes: the home profile hides the
 * business pages, nothing is deleted and every page still opens by link.
 */
export function WorkspaceProfileSection({ tx }: { tx: Tx }) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = workspaceProfileOf(currentWorkspace);

  const choose = async (next: WorkspaceProfile | null): Promise<void> => {
    if (!next || next === profile || !currentWorkspace) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/workspaces/${currentWorkspace.id}`, {
        profile: next,
      } satisfies ContractInput<'UpdateWorkspaceBody'>);
      // The sidebar reads the profile off the workspace, so it has to be re-read.
      await refreshWorkspaces();
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, tx(['workspaceProfileCard', 'saveError'], 'Could not save')),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <ToggleButtonGroup
        exclusive
        value={profile}
        onChange={(_event, value: WorkspaceProfile | null) => void choose(value)}
        disabled={saving}
        aria-label={tx(['workspaceProfileCard', 'title'], 'Workspace profile')}
      >
        <ToggleButton value="home" sx={{ textTransform: 'none', px: 2.5 }}>
          <Stack
            sx={{
              alignItems: 'flex-start',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
              }}
            >
              {tx(['workspaceProfileCard', 'home'], 'Home')}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {tx(['workspaceProfileCard', 'homeHint'], 'Personal or family money')}
            </Typography>
          </Stack>
        </ToggleButton>
        <ToggleButton value="business" sx={{ textTransform: 'none', px: 2.5 }}>
          <Stack
            sx={{
              alignItems: 'flex-start',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
              }}
            >
              {tx(['workspaceProfileCard', 'business'], 'Business')}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {tx(['workspaceProfileCard', 'businessHint'], 'Invoices, payables, ledger, tax')}
            </Typography>
          </Stack>
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
