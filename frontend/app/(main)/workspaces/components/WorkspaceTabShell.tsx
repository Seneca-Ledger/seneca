'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { getWorkspaceTabItems, type WorkspaceTabId } from '@/app/lib/workspace-tabs';
import { tokens } from '@/lib/theme-tokens';
import WorkspacesListContent from './WorkspacesListContent';

type Props = {
  activeItem: WorkspaceTabId;
  children: ReactNode;
};

const BLOCK_SKELETON_KEYS = ['block-0', 'block-1', 'block-2', 'block-3'];

// The tab views size themselves to calc(100vh - var(--global-nav-height)); the
// shell hands them this height so the tab row doesn't push them past the fold.
const TAB_ROW_HEIGHT = '56px';
const ALL_WORKSPACES_TAB = 'all-workspaces';

function WorkspaceTabShellSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - var(--global-nav-height, 0px))',
        px: 3,
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Skeleton variant="rounded" width={40} height={40} />
        <Box>
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={280} height={18} />
        </Box>
      </Box>
      {BLOCK_SKELETON_KEYS.map(key => (
        <Skeleton key={key} variant="rounded" height={72} sx={{ borderRadius: tokens.radius.lg }} />
      ))}
    </Box>
  );
}

export default function WorkspaceTabShell({ activeItem, children }: Props) {
  const router = useRouter();
  const t = useIntlayer('workspacesListView');
  const { loading, currentWorkspace } = useWorkspace();
  const [isAllWorkspacesOpen, setIsAllWorkspacesOpen] = useState(false);

  useEffect(() => {
    if (!(loading || currentWorkspace)) {
      router.replace('/workspaces/list');
    }
  }, [currentWorkspace, loading, router]);

  if (loading || !currentWorkspace) {
    return <WorkspaceTabShellSkeleton />;
  }

  const tabItems = getWorkspaceTabItems(activeItem, currentWorkspace.stats?.memberCount ?? 0);

  return (
    <Box sx={{ '--global-nav-height': TAB_ROW_HEIGHT }}>
      <Box
        sx={{ height: TAB_ROW_HEIGHT, px: 3, display: 'flex', alignItems: 'flex-start' }}
        data-testid="workspace-tabs"
      >
        <Tabs
          value={isAllWorkspacesOpen ? ALL_WORKSPACES_TAB : activeItem}
          variant="scrollable"
          scrollButtons={false}
          aria-label={t.tabs.sections.value}
          sx={{ ...sharedMuiTabsSx, mb: 0 }}
        >
          {tabItems.map(item => (
            <Tab
              key={item.id}
              value={item.id}
              component={Link}
              href={item.href}
              onClick={() => setIsAllWorkspacesOpen(false)}
              label={item.badge === undefined ? item.label : `${item.label} (${item.badge})`}
            />
          ))}
          <Tab
            value={ALL_WORKSPACES_TAB}
            label={t.tabs.allWorkspaces}
            onClick={() => setIsAllWorkspacesOpen(true)}
          />
        </Tabs>
      </Box>
      {isAllWorkspacesOpen ? (
        <WorkspacesListContent
          embedded
          redirectPathOnSelect={null}
          onWorkspaceActivated={() => setIsAllWorkspacesOpen(false)}
          onCloseEmbedded={() => setIsAllWorkspacesOpen(false)}
        />
      ) : (
        children
      )}
    </Box>
  );
}
