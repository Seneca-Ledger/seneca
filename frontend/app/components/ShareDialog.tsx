'use client';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { Copy, Trash2 } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import api from '../lib/api';

interface SharedLink {
  id: string;
  token: string;
  permission: string;
  expiresAt: string | null;
  allowAnonymous: boolean;
  description: string | null;
  status: string;
  accessCount: number;
  createdAt: string;
}

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  sharedLinks: SharedLink[];
  onLinksUpdate: () => void;
}

function resolveDateLocale(locale: string): string {
  return resolveLocaleTag(locale);
}

interface LinkPrimaryProps {
  link: SharedLink;
  untilPrefix: string;
  formatDate: (d: string) => string;
  permissionLabel: React.ReactNode;
  statusLabel: React.ReactNode;
}

function LinkPrimary({
  link,
  untilPrefix,
  formatDate,
  permissionLabel,
  statusLabel,
}: LinkPrimaryProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
      <Chip label={permissionLabel} size="small" color="primary" />
      <Chip
        label={statusLabel}
        size="small"
        color={link.status === 'active' ? 'success' : 'error'}
      />
      {link.expiresAt && (
        <Chip
          label={`${untilPrefix} ${formatDate(link.expiresAt)}`}
          size="small"
          variant="outlined"
        />
      )}
    </Box>
  );
}

interface LinkRowProps {
  link: SharedLink;
  copiedToken: string | null;
  onCopy: (token: string) => void;
  onDelete: (id: string) => void;
  formatDate: (d: string) => string;
  createdPrefix: string;
  visitsPrefix: string;
  untilPrefix: string;
  copyTitle: string;
  deleteTitle: string;
  permissionLabel: React.ReactNode;
  statusLabel: React.ReactNode;
}

function LinkRow({
  link,
  copiedToken,
  onCopy,
  onDelete,
  formatDate,
  createdPrefix,
  visitsPrefix,
  untilPrefix,
  copyTitle,
  deleteTitle,
  permissionLabel,
  statusLabel,
}: LinkRowProps): React.JSX.Element {
  return (
    <ListItem sx={{ border: '1px solid', borderColor: 'divider', mb: 1 }}>
      <ListItemText
        primary={
          <LinkPrimary
            link={link}
            untilPrefix={untilPrefix}
            formatDate={formatDate}
            permissionLabel={permissionLabel}
            statusLabel={statusLabel}
          />
        }
        secondary={
          <Box>
            {link.description && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {link.description}
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {createdPrefix}: {formatDate(link.createdAt)} • {visitsPrefix}: {link.accessCount}
            </Typography>
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <Tooltip title={copyTitle}>
          <IconButton
            edge="end"
            onClick={() => onCopy(link.token)}
            color={copiedToken === link.token ? 'success' : 'default'}
          >
            <Copy size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title={deleteTitle}>
          <IconButton edge="end" onClick={() => onDelete(link.id)}>
            <Trash2 size={18} />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

interface LinkListProps {
  links: SharedLink[];
  copiedToken: string | null;
  onCopy: (token: string) => void;
  onDelete: (id: string) => void;
  formatDate: (d: string) => string;
  t: ReturnType<typeof useIntlayer<'shareDialog'>>;
  permissionLabels: Record<string, React.ReactNode>;
  statusLabels: Record<string, React.ReactNode>;
}

function LinkList({
  links,
  copiedToken,
  onCopy,
  onDelete,
  formatDate,
  t,
  permissionLabels,
  statusLabels,
}: LinkListProps): React.JSX.Element {
  return (
    <List>
      {links.map(link => (
        <LinkRow
          key={link.id}
          link={link}
          copiedToken={copiedToken}
          onCopy={onCopy}
          onDelete={onDelete}
          formatDate={formatDate}
          createdPrefix={t.createdPrefix.value}
          visitsPrefix={t.visitsPrefix.value}
          untilPrefix={t.untilPrefix.value}
          copyTitle={t.tooltips.copy.value}
          deleteTitle={t.tooltips.delete.value}
          permissionLabel={permissionLabels[link.permission] ?? link.permission}
          statusLabel={statusLabels[link.status] ?? link.status}
        />
      ))}
    </List>
  );
}

interface CopyArgs {
  token: string;
  setCopied: (v: string | null) => void;
}
async function copyTokenToClipboard({ token, setCopied }: CopyArgs): Promise<void> {
  await navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
  setCopied(token);
  setTimeout(() => setCopied(null), 2000);
}

interface DeleteArgs {
  linkId: string;
  onLinksUpdate: () => void;
}
async function deleteLinkById({ linkId, onLinksUpdate }: DeleteArgs): Promise<void> {
  try {
    await api.delete(`/storage/shares/${linkId}`);
    onLinksUpdate();
  } catch (error) {
    console.error('Failed to delete shared link:', error);
  }
}

/**
 * Dialog for creating and managing shared links
 */
export default function ShareDialog({
  sharedLinks,
  onLinksUpdate,
}: ShareDialogProps): React.JSX.Element {
  const t = useIntlayer('shareDialog');
  const { locale } = useLocale();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const formatDate = (dateString: string): string =>
    formatStoredDateWithOptions(
      dateString,
      { year: 'numeric', month: 'long', day: 'numeric' },
      resolveDateLocale(locale),
    );

  const PERMISSION_LABELS: Record<string, React.ReactNode> = {
    view: t.permissionLabel.view,
    download: t.permissionLabel.download,
    edit: t.permissionLabel.edit,
  };
  const STATUS_LABELS: Record<string, React.ReactNode> = {
    active: t.statusLabel.active,
    expired: t.statusLabel.expired,
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {t.activeLinks.value} ({sharedLinks.length})
        </Typography>
        {sharedLinks.length === 0 ? (
          <Typography
            sx={{
              color: 'text.secondary',
            }}
          >
            {t.noLinks}
          </Typography>
        ) : (
          <LinkList
            links={sharedLinks}
            copiedToken={copiedToken}
            onCopy={token => {
              void copyTokenToClipboard({ token, setCopied: setCopiedToken });
            }}
            onDelete={id => {
              void deleteLinkById({ linkId: id, onLinksUpdate });
            }}
            formatDate={formatDate}
            t={t}
            permissionLabels={PERMISSION_LABELS}
            statusLabels={STATUS_LABELS}
          />
        )}
      </Paper>
    </Box>
  );
}
