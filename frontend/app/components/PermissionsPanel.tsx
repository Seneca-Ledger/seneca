'use client';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { isValid } from 'date-fns';
import React, { useState } from 'react';
import { Pencil, Trash2, UserPlus } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { resolveLocaleTag, resolvePickerFormat } from '@/app/lib/user-format';
import { formatStoredDateWithOptions, useUserFormat } from '@/app/lib/user-format-store';
import api from '../lib/api';

type FilePermissionType = ContractInput<'GrantPermissionBody'>['permissionType'];
const PERMISSION_TYPES: readonly FilePermissionType[] = ['owner', 'editor', 'viewer', 'downloader'];
const isPermissionType = (value: string): value is FilePermissionType =>
  PERMISSION_TYPES.some(type => type === value);

interface Permission {
  id: string;
  user: { id: string; email: string };
  grantedBy: { id: string; email: string };
  permissionType: string;
  canReshare: boolean;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PermissionsPanelProps {
  fileId: string;
  permissions: Permission[];
  onPermissionsUpdate: () => void;
}

interface GetApiMessageArgs {
  error: unknown;
  fallback: string;
}
function getApiMessage({ error, fallback }: GetApiMessageArgs): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }
  const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
  return response?.data?.error?.message ?? fallback;
}

const PERMISSION_COLOR_MAP: Record<string, 'success' | 'primary' | 'default' | 'info'> = {
  owner: 'success',
  editor: 'primary',
  viewer: 'default',
  downloader: 'info',
};

type IntlayerT = ReturnType<typeof useIntlayer<'permissionsPanel'>>;

function getPermissionColor(type: string): 'success' | 'primary' | 'default' | 'info' {
  return PERMISSION_COLOR_MAP[type] ?? 'default';
}

interface PermTableProps {
  permissions: Permission[];
  t: IntlayerT;
  formatDate: (d: string) => string;
  onEdit: (p: Permission) => void;
  onRevoke: (id: string) => void;
}

interface PermRowProps {
  permission: Permission;
  labelMap: Record<string, string>;
  t: IntlayerT;
  formatDate: (d: string) => string;
  onEdit: (p: Permission) => void;
  onRevoke: (id: string) => void;
}

function PermRow({
  permission,
  labelMap,
  t,
  formatDate,
  onEdit,
  onRevoke,
}: PermRowProps): React.JSX.Element {
  return (
    <TableRow key={permission.id}>
      <TableCell>{permission.user.email}</TableCell>
      <TableCell>
        <Chip
          label={labelMap[permission.permissionType] ?? permission.permissionType}
          size="small"
          color={getPermissionColor(permission.permissionType)}
        />
      </TableCell>
      <TableCell>
        <Chip
          label={permission.canReshare ? t.values.yes : t.values.no}
          size="small"
          color={permission.canReshare ? 'success' : 'default'}
          variant="outlined"
        />
      </TableCell>
      <TableCell>
        {permission.expiresAt ? (
          <Chip label={formatDate(permission.expiresAt)} size="small" variant="outlined" />
        ) : (
          t.values.forever
        )}
      </TableCell>
      <TableCell>{permission.grantedBy.email}</TableCell>
      <TableCell>{formatDate(permission.createdAt)}</TableCell>
      <TableCell align="center">
        <Tooltip title={t.tooltips.edit.value}>
          <IconButton size="small" onClick={() => onEdit(permission)}>
            <Pencil size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t.tooltips.revoke.value}>
          <IconButton size="small" onClick={() => onRevoke(permission.id)}>
            <Trash2 size={16} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

function PermTable({
  permissions,
  t,
  formatDate,
  onEdit,
  onRevoke,
}: PermTableProps): React.JSX.Element {
  const labelMap: Record<string, string> = {
    owner: t.permission.owner.value,
    editor: t.permission.editor.value,
    viewer: t.permission.viewer.value,
    downloader: t.permission.downloader.value,
  };
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{t.table.user}</TableCell>
            <TableCell>{t.table.rights}</TableCell>
            <TableCell>{t.table.canReshare}</TableCell>
            <TableCell>{t.table.expires}</TableCell>
            <TableCell>{t.table.grantedBy}</TableCell>
            <TableCell>{t.table.createdAt}</TableCell>
            <TableCell align="center">{t.table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {permissions.map(permission => (
            <PermRow
              key={permission.id}
              permission={permission}
              labelMap={labelMap}
              t={t}
              formatDate={formatDate}
              onEdit={onEdit}
              onRevoke={onRevoke}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

interface PermFormProps {
  permissionType: FilePermissionType;
  setPermissionType: (v: FilePermissionType) => void;
  canReshare: boolean;
  setCanReshare: (v: boolean) => void;
  expiresAt: string;
  setExpiresAt: (v: string) => void;
  error: string | null;
  t: IntlayerT;
}

function PermFormFields({
  permissionType,
  setPermissionType,
  canReshare,
  setCanReshare,
  expiresAt,
  setExpiresAt,
  error,
  t,
}: PermFormProps): React.JSX.Element {
  const { preferences } = useUserFormat();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <FormControl fullWidth>
        <InputLabel>{t.dialogs.accessLevel}</InputLabel>
        <Select
          value={permissionType}
          label={t.dialogs.accessLevel.value}
          onChange={e => {
            if (isPermissionType(e.target.value)) setPermissionType(e.target.value);
          }}
        >
          <MenuItem value="viewer">{t.permission.viewer}</MenuItem>
          <MenuItem value="downloader">{t.permission.viewDownloadLong}</MenuItem>
          <MenuItem value="editor">{t.permission.editorLong}</MenuItem>
        </Select>
      </FormControl>
      <DateTimePicker
        label={t.dialogs.expiresAt.value}
        value={expiresAt ? new Date(expiresAt) : null}
        onChange={date => setExpiresAt(date && isValid(date) ? date.toISOString() : '')}
        format={`${resolvePickerFormat(preferences)} HH:mm`}
        ampm={false}
        disablePast
        slotProps={{ textField: { fullWidth: true } }}
      />
      <FormControlLabel
        control={<Switch checked={canReshare} onChange={e => setCanReshare(e.target.checked)} />}
        label={t.dialogs.reshare.value}
      />
    </Box>
  );
}

/**
 * Panel for managing file permissions and access control
 */
export default function PermissionsPanel({
  fileId,
  permissions,
  onPermissionsUpdate,
}: PermissionsPanelProps): React.JSX.Element {
  const t = useIntlayer('permissionsPanel');
  const { locale } = useLocale();
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [permissionType, setPermissionType] = useState<FilePermissionType>('viewer');
  const [canReshare, setCanReshare] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrantPermission = async (): Promise<void> => {
    await (async () => {
      setGranting(true);
      setError(null);
      await api.post(`/storage/files/${fileId}/permissions`, {
        userId: userEmail.trim(),
        permissionType,
        canReshare,
        expiresAt: expiresAt || undefined,
      } satisfies ContractInput<'GrantPermissionBody'>);
      setUserEmail('');
      setPermissionType('viewer');
      setCanReshare(false);
      setExpiresAt('');
      setGrantDialogOpen(false);
      onPermissionsUpdate();
    })()
      .catch(async (err: unknown) => {
        setError(getApiMessage({ error: err, fallback: t.errors.grantFailed.value }));
      })
      .finally(async () => {
        setGranting(false);
      });
  };

  const handleUpdatePermission = async (): Promise<void> => {
    if (!selectedPermission) {
      return;
    }

    await (async () => {
      setGranting(true);
      setError(null);
      await api.put(`/storage/permissions/${selectedPermission.id}`, {
        permissionType,
        canReshare,
        expiresAt: expiresAt || null,
      } satisfies ContractInput<'UpdatePermissionBody'>);
      setEditDialogOpen(false);
      setSelectedPermission(null);
      onPermissionsUpdate();
    })()
      .catch(async (err: unknown) => {
        setError(getApiMessage({ error: err, fallback: t.errors.updateFailed.value }));
      })
      .finally(async () => {
        setGranting(false);
      });
  };

  const handleRevokePermission = async (permissionId: string): Promise<void> => {
    if (!confirm(t.confirmRevoke.value)) {
      return;
    }

    await (async () => {
      await api.delete(`/storage/permissions/${permissionId}`);
      onPermissionsUpdate();
    })().catch(async err => {
      console.error('Failed to revoke permission:', err);
    });
  };

  const handleEditClick = (permission: Permission): void => {
    setSelectedPermission(permission);
    if (isPermissionType(permission.permissionType)) setPermissionType(permission.permissionType);
    setCanReshare(permission.canReshare);
    setExpiresAt(permission.expiresAt || '');
    setEditDialogOpen(true);
  };
  const formatDate = (dateString: string): string =>
    formatStoredDateWithOptions(
      dateString,
      { year: 'numeric', month: 'long', day: 'numeric' },
      resolveLocaleTag(locale),
    );

  const formProps: PermFormProps = {
    permissionType,
    setPermissionType,
    canReshare,
    setCanReshare,
    expiresAt,
    setExpiresAt,
    error,
    t,
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            {t.title.value} ({permissions.length})
          </Typography>
          <Button
            variant="contained"
            startIcon={<UserPlus size={18} />}
            onClick={() => setGrantDialogOpen(true)}
          >
            {t.grantAccess}
          </Button>
        </Box>
        {permissions.length === 0 ? (
          <Alert severity="info">{t.empty}</Alert>
        ) : (
          <PermTable
            permissions={permissions}
            t={t}
            formatDate={formatDate}
            onEdit={handleEditClick}
            onRevoke={id => {
              void handleRevokePermission(id);
            }}
          />
        )}
      </Paper>

      <Dialog
        open={grantDialogOpen}
        onClose={() => setGrantDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t.dialogs.grantTitle}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              label={t.dialogs.userIdOrEmail.value}
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              helperText={t.dialogs.userIdOrEmailHelp.value}
            />
            <PermFormFields {...formProps} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantDialogOpen(false)}>{t.dialogs.cancel}</Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleGrantPermission();
            }}
            disabled={!userEmail || granting}
          >
            {t.dialogs.grant}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t.dialogs.editTitle}</DialogTitle>
        <DialogContent>
          <PermFormFields {...formProps} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t.dialogs.cancel}</Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleUpdatePermission();
            }}
            disabled={granting}
          >
            {t.dialogs.save}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
