'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { PageTitle } from '@/app/components/ui/page-title';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { WorkspaceGridView } from './WorkspaceGridView';
import { type ViewMode, WorkspaceListFilters } from './WorkspaceListFilters';
import { WorkspaceListView } from './WorkspaceListView';
import { SORT_FNS, type SortOption } from './workspace-list.helpers';

type TranslationValue = string | { value?: string };

const resolveTranslation = (value: TranslationValue | undefined, fallback: string): string =>
  typeof value === 'string' ? value : (value?.value ?? fallback);

/** Workspace shape shared by the list views (grid + list). */
type WorkspaceListItem = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  backgroundImage: string | null;
  isFavorite: boolean;
  createdAt: string;
  memberRole?: string;
};

type Props = {
  embedded?: boolean;
  redirectPathOnSelect?: string | null;
  onWorkspaceActivated?: () => void;
  onCloseEmbedded?: () => void;
};

function useWorkspaceListState({ workspaces }: { workspaces: WorkspaceListItem[] }): {
  searchQuery: string;
  viewMode: ViewMode;
  sortOption: SortOption;
  showSortMenu: boolean;
  filteredWorkspaces: typeof workspaces;
  sortedWorkspaces: typeof workspaces;
  setSearchQuery: (v: string) => void;
  setViewMode: (v: ViewMode) => void;
  setSortOption: (v: SortOption) => void;
  toggleSortMenu: () => void;
} {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('favorites');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return workspaces;
    }
    const q = searchQuery.toLowerCase();
    return workspaces.filter(
      w => w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q),
    );
  }, [workspaces, searchQuery]);

  const sortedWorkspaces = useMemo(
    () => [...filteredWorkspaces].sort(SORT_FNS[sortOption]),
    [filteredWorkspaces, sortOption],
  );
  const toggleSortMenu = (): void => setShowSortMenu(v => !v);
  return {
    searchQuery,
    viewMode,
    sortOption,
    showSortMenu,
    filteredWorkspaces,
    sortedWorkspaces,
    setSearchQuery,
    setViewMode,
    setSortOption,
    toggleSortMenu,
  };
}

const CARD_SKELETON_KEYS = ['card-0', 'card-1', 'card-2', 'card-3', 'card-4', 'card-5'];

function LoadingView(): React.JSX.Element {
  return (
    <Box sx={{ maxWidth: '100%', px: 3, py: 4 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(4, 1fr)',
          },
          gap: 3,
        }}
      >
        {/* Same two zones as a loaded card: cover, then name and details. */}
        {CARD_SKELETON_KEYS.map(key => (
          <Box
            key={key}
            sx={{
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
            }}
          >
            <Skeleton
              variant="rectangular"
              sx={{ aspectRatio: '16/9', width: '100%', height: 'auto' }}
            />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={16} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

type BodyProps = {
  ls: ReturnType<typeof useWorkspaceListState>;
  allCount: number;
  currentWorkspaceId: string | undefined;
  createLabel: string;
  noWorkspacesLabel: string;
  searchPlaceholder: string;
  embedded: boolean;
  onWorkspaceClick: (id: string) => void;
  onCreateClick: () => void;
  onFavoriteToggle: (id: string) => Promise<void>;
};

function WorkspaceListBody({
  ls,
  allCount,
  currentWorkspaceId,
  createLabel,
  noWorkspacesLabel,
  searchPlaceholder,
  embedded,
  onWorkspaceClick,
  onCreateClick,
  onFavoriteToggle,
}: BodyProps): React.JSX.Element {
  const showGrid = ls.viewMode === 'grid' || allCount === 0;
  return (
    <Box sx={{ maxWidth: '100%', px: 3, py: 4 }}>
      {allCount > 0 && (
        <WorkspaceListFilters
          searchQuery={ls.searchQuery}
          searchPlaceholder={searchPlaceholder}
          embedded={embedded}
          viewMode={ls.viewMode}
          sortOption={ls.sortOption}
          showSortMenu={ls.showSortMenu}
          onSearchChange={ls.setSearchQuery}
          onSortSelect={opt => {
            ls.setSortOption(opt);
            ls.toggleSortMenu();
          }}
          onSortMenuToggle={ls.toggleSortMenu}
          onViewModeSelect={ls.setViewMode}
        />
      )}
      {showGrid ? (
        <WorkspaceGridView
          workspaces={ls.sortedWorkspaces}
          allWorkspacesEmpty={allCount === 0}
          filteredEmpty={ls.filteredWorkspaces.length === 0}
          createLabel={createLabel}
          noWorkspacesLabel={noWorkspacesLabel}
          onWorkspaceClick={onWorkspaceClick}
          onCreateClick={onCreateClick}
          onFavoriteToggle={onFavoriteToggle}
        />
      ) : (
        <WorkspaceListView
          workspaces={ls.sortedWorkspaces}
          currentWorkspaceId={currentWorkspaceId}
          createLabel={createLabel}
          onWorkspaceClick={onWorkspaceClick}
          onCreateClick={onCreateClick}
        />
      )}
    </Box>
  );
}

function useWorkspaceNav({
  switchWorkspace,
  onWorkspaceActivated,
  redirectPathOnSelect,
}: {
  switchWorkspace: (id: string) => Promise<void>;
  onWorkspaceActivated?: () => void;
  redirectPathOnSelect: string | null | undefined;
}): { handleWorkspaceClick: (id: string) => void } {
  const router = useRouter();
  const handleWorkspaceClick = (id: string): void => {
    void switchWorkspace(id)
      .then(() => {
        onWorkspaceActivated?.();
        if (redirectPathOnSelect) {
          router.push(redirectPathOnSelect);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to switch workspace:', error);
      });
  };
  return { handleWorkspaceClick };
}

export default function WorkspacesListContent({
  embedded,
  redirectPathOnSelect = '/workspaces/overview',
  onWorkspaceActivated,
}: Props): React.JSX.Element {
  const content = useIntlayer('workspaces-selector');
  const { currentWorkspace, workspaces, loading, switchWorkspace, toggleFavorite } = useWorkspace();
  const router = useRouter();
  const ls = useWorkspaceListState({ workspaces });
  const { handleWorkspaceClick } = useWorkspaceNav({
    switchWorkspace,
    onWorkspaceActivated,
    redirectPathOnSelect,
  });
  const handleCreateWorkspace = (): void => {
    router.push('/onboarding?mode=create-workspace');
  };
  const createLabel = resolveTranslation(content.createWorkspace, 'Create workspace');
  const noWorkspacesLabel = resolveTranslation(content.noWorkspaces, 'You have no workspaces yet');
  const searchPlaceholder = resolveTranslation(content.searchPlaceholder, 'Search workspaces...');

  if (loading) {
    return <LoadingView />;
  }

  return (
    // No fixed height: the page scrolls, and the shell keeps the room under the
    // mobile bottom bar. A screen-high box with hidden overflow cut off the last cards.
    <Box sx={{ pt: embedded ? 2 : 0 }}>
      {/* Embedded, it sits under the workspace shell, whose title row already names the page. */}
      {embedded ? null : (
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 'var(--seneca-page-top, 24px)', mb: 1 }}>
          <PageTitle path="/workspaces" />
        </Box>
      )}
      <WorkspaceListBody
        ls={ls}
        allCount={workspaces.length}
        currentWorkspaceId={currentWorkspace?.id}
        createLabel={createLabel}
        noWorkspacesLabel={noWorkspacesLabel}
        searchPlaceholder={searchPlaceholder}
        embedded={Boolean(embedded)}
        onWorkspaceClick={handleWorkspaceClick}
        onCreateClick={handleCreateWorkspace}
        onFavoriteToggle={toggleFavorite}
      />
    </Box>
  );
}
