'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { alpha, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { MailPlus } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

/** Divider between flat rows; barely there, in either theme. */
const HAIRLINE = (theme: Theme): string => alpha(theme.palette.text.primary, 0.06);

/** Mirrors a loaded member row: flat, hairline between rows, 32px avatar, role on the right. */
function MemberRowSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 1.25,
        '& + &': { borderTop: '1px solid', borderColor: HAIRLINE },
      }}
    >
      <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1.5 }}>
        <Skeleton variant="circular" width={32} height={32} />
        <Box>
          <Skeleton variant="text" width={110} height={20} />
          <Skeleton variant="text" width={190} height={20} />
        </Box>
      </Box>
      <Skeleton variant="text" width={40} height={20} sx={{ mr: 1 }} />
    </Box>
  );
}

/**
 * Same shape as the loaded Members tab: toolbar (search, sort and role filter
 * only past one member, as there), flat member rows, the pending invitations heading.
 */
export function WorkspaceMembersSkeleton({
  memberCount = 1,
}: {
  memberCount?: number;
}): React.JSX.Element {
  const t = useIntlayer('workspaceMembers');
  const showListControls = memberCount > 1;
  const rows = Math.min(Math.max(memberCount, 1), 8);

  return (
    <Box
      aria-busy="true"
      sx={{
        height: 'calc(100vh - var(--global-nav-height, 0px))',
        overflowY: 'auto',
        bgcolor: 'var(--background)',
      }}
    >
      <Box
        sx={{
          maxWidth: 1120,
          px: { xs: 2.5, sm: 4 },
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          {showListControls && (
            <>
              <Skeleton variant="rounded" sx={{ width: { xs: '100%', sm: 240 }, height: 40 }} />
              <Skeleton variant="text" width={90} height={24} />
              <Skeleton variant="text" width={110} height={24} />
            </>
          )}
          <Button variant="contained" size="small" startIcon={<MailPlus size={16} />} tabIndex={-1}>
            {t.invite.button}
          </Button>
        </Box>
        <Box>
          {Array.from({ length: rows }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static skeleton list
            <MemberRowSkeleton key={index} />
          ))}
        </Box>
        <Box sx={{ pt: 2 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-foreground)' }}
          >
            {t.pending.title}
          </Typography>
          <Skeleton variant="text" width={150} height={20} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
    </Box>
  );
}
