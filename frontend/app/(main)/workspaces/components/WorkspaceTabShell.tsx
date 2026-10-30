'use client';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { sharedMuiTabsSx } from '@/app/components/ui/mui-tabs';
import { PageTitle } from '@/app/components/ui/page-title';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { getWorkspaceTabItems, type WorkspaceTabId } from '@/app/lib/workspace-tabs';
import { WorkspaceMembersSkeleton } from './WorkspaceMembersSkeleton';
import { WorkspaceOverviewSkeleton } from './WorkspaceOverviewSkeleton';
import WorkspacesListContent from './WorkspacesListContent';

type Props = {
  activeItem: WorkspaceTabId;
  children: ReactNode;
};

// The tab views size themselves to calc(100vh - var(--global-nav-height)); the
// shell hands them the height of the title and tab rows so neither pushes them past the fold.
const TITLE_ROW_HEIGHT = '52px';
const TAB_ROW_HEIGHT = '56px';
const ALL_WORKSPACES_TAB = 'all-workspaces';

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

  // Title and tabs need no data, so they stay put while the workspace loads;
  // only the tab body is a placeholder of the tab's own shape.
  const ready = !loading && currentWorkspace;
  const memberCount = currentWorkspace?.stats?.memberCount;
  const tabItems = getWorkspaceTabItems(activeItem, memberCount ?? 0);

  return (
    <Box sx={{ '--global-nav-height': `calc(${TITLE_ROW_HEIGHT} + ${TAB_ROW_HEIGHT})` }}>
      <Box
        sx={{
          height: TITLE_ROW_HEIGHT,
          px: { xs: 2, md: 4 },
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <PageTitle path="/workspaces" />
      </Box>
      <Box
        sx={{
          height: TAB_ROW_HEIGHT,
          px: { xs: 2, md: 4 },
          display: 'flex',
          alignItems: 'flex-start',
        }}
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
              label={
                item.badge === undefined || memberCount === undefined
                  ? item.label
                  : `${item.label} (${item.badge})`
              }
            />
          ))}
          <Tab
            value={ALL_WORKSPACES_TAB}
            label={t.tabs.allWorkspaces}
            onClick={() => setIsAllWorkspacesOpen(true)}
          />
        </Tabs>
      </Box>
      {!ready ? (
        activeItem === 'members' ? (
          <WorkspaceMembersSkeleton memberCount={memberCount} />
        ) : (
          <WorkspaceOverviewSkeleton />
        )
      ) : isAllWorkspacesOpen ? (
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
