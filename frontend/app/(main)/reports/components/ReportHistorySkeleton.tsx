'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

const HISTORY_SKELETON_KEYS = ['hist-0', 'hist-1', 'hist-2', 'hist-3', 'hist-4'];

/** The history table's header row; the last column (download) sits on the right. */
export function HistoryHead({ labels }: { labels: string[] }): React.JSX.Element {
  return (
    <TableHead>
      <TableRow sx={{ bgcolor: 'var(--muted)' }}>
        {labels.map((label, i) => (
          <TableCell
            key={label}
            align={i === labels.length - 1 ? 'right' : 'left'}
            sx={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--muted-foreground)',
            }}
          >
            {label}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

function ReportHistoryRowSkeleton(): React.JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2">
          <Skeleton variant="text" width="70%" />
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          <Skeleton variant="text" width={140} />
        </Typography>
      </TableCell>
      <TableCell>
        <Skeleton
          variant="rounded"
          width={40}
          height={20}
          sx={{ borderRadius: tokens.radius.full }}
        />
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          <Skeleton variant="text" width={70} />
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          <Skeleton variant="text" width={50} />
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Skeleton variant="circular" width={26} height={26} sx={{ ml: 'auto' }} />
      </TableCell>
    </TableRow>
  );
}

/** The history while it loads: the same frames and header, the rows as bars. */
export function ReportHistorySkeleton({ headers }: { headers: string[] }): React.JSX.Element {
  return (
    <>
      {/* Mobile card list — xs only */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          flexDirection: 'column',
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
        }}
      >
        {HISTORY_SKELETON_KEYS.map((key, idx) => (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={16} />
            </Box>
            <Skeleton
              variant="rounded"
              width={40}
              height={20}
              sx={{ borderRadius: tokens.radius.full }}
            />
            <Skeleton variant="text" width={40} height={16} />
            <Skeleton variant="circular" width={26} height={26} />
          </Box>
        ))}
      </Box>

      {/* Desktop table — sm+ */}
      <Box
        aria-busy
        sx={{
          display: { xs: 'none', sm: 'block' },
          overflowX: 'auto',
          border: '1px solid var(--border)',
          bgcolor: 'var(--card)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <Table size="small" sx={{ minWidth: 480 }}>
          <HistoryHead labels={headers} />
          <TableBody>
            {HISTORY_SKELETON_KEYS.map(key => (
              <ReportHistoryRowSkeleton key={key} />
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}
