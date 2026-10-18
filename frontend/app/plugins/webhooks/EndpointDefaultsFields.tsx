'use client';

import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export interface EndpointDefaults {
  defaultWalletId: string | null;
  defaultBranchId: string | null;
}

/** Where an endpoint's statements land when the sender names no account or branch. */
export function EndpointDefaultsFields({
  value,
  onChange,
}: {
  value: EndpointDefaults;
  onChange: (next: EndpointDefaults) => void;
}): React.JSX.Element {
  const t = useIntlayer('webhooksDrawer');
  const workspaceId = useWorkspaceId();
  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
  });
  const branches = useQuery({
    queryKey: queryKeys.branches(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/branches', signal, contract: 'BranchList' }),
  });
  const none = { value: '', label: t.noDefault.value };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', mb: 0.5 }}>
          {t.defaultWallet}
        </Typography>
        <Select
          size="small"
          fullWidth
          value={value.defaultWalletId ?? ''}
          inputProps={{ 'aria-label': t.defaultWallet.value }}
          options={[
            none,
            ...(wallets.data ?? []).map(wallet => ({ value: wallet.id, label: wallet.name })),
          ]}
          onChange={id => onChange({ ...value, defaultWalletId: id || null })}
        />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', mb: 0.5 }}>
          {t.defaultBranch}
        </Typography>
        <Select
          size="small"
          fullWidth
          value={value.defaultBranchId ?? ''}
          inputProps={{ 'aria-label': t.defaultBranch.value }}
          options={[
            none,
            ...(branches.data ?? []).map(branch => ({ value: branch.id, label: branch.name })),
          ]}
          onChange={id => onChange({ ...value, defaultBranchId: id || null })}
        />
      </Box>
    </Box>
  );
}
