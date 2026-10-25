'use client';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import React from 'react';
import { Plus } from '@/app/components/icons';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { WorkspaceCard } from './WorkspaceCard';

type WorkspaceItem = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  backgroundImage: string | null;
  isFavorite: boolean;
  memberRole?: string;
};

type EmptyStateProps = {
  createLabel: string;
  noWorkspacesLabel: string;
  onCreateClick: () => void;
};
function EmptyWorkspacesState({
  createLabel,
  noWorkspacesLabel,
  onCreateClick,
}: EmptyStateProps): React.JSX.Element {
  const t = useIntlayer('workspacesListView');
  return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <EmptyStateIllustration name="workspaces" size="lg" />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          mb: 1,
          color: 'var(--foreground)',
        }}
      >
        {noWorkspacesLabel}
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'var(--text-secondary)' }}>
        {t.empty.subtitle}
      </Typography>
      <button
        type="button"
        onClick={onCreateClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '12px 24px 12px 20px',
          background: 'var(--primary-fill)',
          color: '#fff',
          fontWeight: 500,
          fontSize: 14,
          border: 'none',
          cursor: 'pointer',
          borderRadius: tokens.radius.md,
        }}
      >
        <Plus size={18} aria-hidden />
        {createLabel}
      </button>
    </Box>
  );
}

function NoResultsState(): React.JSX.Element {
  const t = useIntlayer('workspacesListView');
  return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <EmptyStateIllustration name="no-results" size="md" />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          mb: 1,
          color: 'var(--foreground)',
        }}
      >
        {t.noResults.title}
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: 'var(--text-secondary)' }}>
        {t.noResults.subtitle}
      </Typography>
    </Box>
  );
}

type WorkspaceGridViewProps = {
  workspaces: WorkspaceItem[];
  allWorkspacesEmpty: boolean;
  filteredEmpty: boolean;
  createLabel: string;
  noWorkspacesLabel: string;
  onWorkspaceClick: (id: string) => void;
  onCreateClick: () => void;
  onFavoriteToggle: (id: string) => Promise<void>;
};

export function WorkspaceGridView({
  workspaces,
  allWorkspacesEmpty,
  filteredEmpty,
  createLabel,
  noWorkspacesLabel,
  onWorkspaceClick,
  onCreateClick,
  onFavoriteToggle,
}: WorkspaceGridViewProps): React.JSX.Element {
  if (allWorkspacesEmpty) {
    return (
      <EmptyWorkspacesState
        createLabel={createLabel}
        noWorkspacesLabel={noWorkspacesLabel}
        onCreateClick={onCreateClick}
      />
    );
  }
  if (filteredEmpty) {
    return <NoResultsState />;
  }
  return (
    <Box
      data-tour-shot="workspaces-list"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
          xl: 'repeat(4, 1fr)',
        },
        gap: 3,
        mb: 4,
      }}
    >
      {workspaces.map(workspace => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          onClick={() => onWorkspaceClick(workspace.id)}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
      {/* An outlined dashed slot, not a filled card: an action, not content. */}
      <Box
        component="button"
        type="button"
        onClick={onCreateClick}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          width: '100%',
          height: '100%',
          minHeight: 160,
          p: 3,
          cursor: 'pointer',
          border: '1px dashed',
          borderColor: theme => alpha(theme.palette.text.primary, 0.15),
          borderRadius: tokens.radius.lg,
          bgcolor: 'transparent',
          color: 'var(--muted-foreground)',
          transition: 'border-color 150ms ease, color 150ms ease',
          '&:hover': { borderColor: 'var(--primary)', color: 'var(--foreground)' },
        }}
      >
        <Plus size={22} style={{ color: 'var(--primary)' }} />
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'inherit' }}>
          {createLabel}
        </Typography>
      </Box>
    </Box>
  );
}
