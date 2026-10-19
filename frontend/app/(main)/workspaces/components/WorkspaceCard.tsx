'use client';

import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { PLAIN_BACKGROUND } from '../constants';

const getApiMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }
  const response = (error as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message || fallback;
};

interface WorkspaceCardProps {
  workspace: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    backgroundImage: string | null;
    isFavorite?: boolean;
    memberRole?: string;
  };
  onClick: () => void;
  onFavoriteToggle?: (workspaceId: string) => Promise<void>;
}

export function WorkspaceCard({ workspace, onClick, onFavoriteToggle }: WorkspaceCardProps) {
  const { roles } = useIntlayer('workspacesListView');
  const [isFavorite, setIsFavorite] = useState(workspace.isFavorite);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setIsFavorite(workspace.isFavorite);
  }, [workspace.isFavorite]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);

    await (async () => {
      await onFavoriteToggle?.(workspace.id);
    })().catch(async (error: unknown) => {
      setIsFavorite(!nextFavorite);
      toast.error(getApiMessage(error, 'Failed to update favorite status'));
    });
  };

  const isExternalBackground = Boolean(
    workspace.backgroundImage &&
      (workspace.backgroundImage.startsWith('http://') ||
        workspace.backgroundImage.startsWith('https://') ||
        workspace.backgroundImage.startsWith('/')),
  );

  const plain = workspace.backgroundImage === PLAIN_BACKGROUND;
  const backgroundImage = workspace.backgroundImage
    ? isExternalBackground
      ? workspace.backgroundImage
      : `/workspace-backgrounds/${workspace.backgroundImage}`
    : '/workspace-backgrounds/vidar-nordli-mathisen-641pLhGEEyg-unsplash.jpg';

  // The role in the reader's language; a role the dictionary lacks keeps its own name.
  const role = workspace.memberRole;
  const translatedRole = role
    ? (roles as Record<string, { value: string } | undefined>)[role]
    : null;
  const roleLabel = role
    ? (translatedRole?.value ?? role.charAt(0).toUpperCase() + role.slice(1))
    : null;
  const subtitle = [roleLabel, workspace.description].filter(Boolean).join(' · ');

  // Two zones: the cover on top, name and details on a plain panel below it, so
  // text never sits on a photo it cannot be read against.
  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        bgcolor: 'var(--card)',
        transition: 'border-color 150ms ease',
        '&:hover': { borderColor: theme => alpha(theme.palette.text.primary, 0.2) },
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
        }}
      >
        <Box sx={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              // "No photo": the flat warm surface instead of a picture.
              backgroundImage: plain ? 'none' : `url(${backgroundImage})`,
              bgcolor: 'var(--icon-badge-bg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transition: 'transform 400ms ease',
              transform: isHovered ? 'scale(1.03)' : 'scale(1)',
            }}
          />
        </Box>
        {/* Room on the right is the star's; it is a sibling, as buttons cannot nest. */}
        <Box sx={{ px: 2, py: 1.5, pr: 6, minWidth: 0 }}>
          <Box
            component="h3"
            sx={{
              m: 0,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspace.name}
          </Box>
          {subtitle ? (
            <Box
              component="p"
              sx={{
                m: 0,
                mt: 0.25,
                fontSize: 12,
                color: 'var(--muted-foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </Box>
          ) : null}
        </Box>
      </button>

      <IconButton
        onClick={handleFavoriteClick}
        size="small"
        sx={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          color: isFavorite ? 'warning.main' : 'var(--muted-foreground)',
          '&:hover': { bgcolor: theme => alpha(theme.palette.text.primary, 0.06) },
        }}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        {isFavorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </Box>
  );
}
