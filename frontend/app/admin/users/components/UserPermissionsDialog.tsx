'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';

interface Permission {
  value: string;
  label: string;
}

export interface UserPermissionsDialogProps {
  open: boolean;
  editingUser: { id: string; name: string; email: string; role: string } | null;
  selectedPermissions: string[];
  saving: boolean;
  allPermissions: Permission[];
  labels: {
    titlePrefix: string;
    rolePrefix: string;
    subtitleSuffix: React.ReactNode;
    resetDefaults: React.ReactNode;
    cancel: React.ReactNode;
    save: React.ReactNode;
  };
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
  onToggle: (permission: string) => void;
}

function PermissionsList({
  allPermissions,
  selectedPermissions,
  onToggle,
}: {
  allPermissions: Permission[];
  selectedPermissions: string[];
  onToggle: (p: string) => void;
}): React.JSX.Element {
  return (
    <FormGroup>
      {allPermissions.map(perm => (
        <FormControlLabel
          key={perm.value}
          control={
            <Checkbox
              checked={selectedPermissions.includes(perm.value)}
              onChange={() => onToggle(perm.value)}
            />
          }
          label={perm.label}
        />
      ))}
    </FormGroup>
  );
}

export function UserPermissionsDialog({
  open,
  editingUser,
  selectedPermissions,
  saving,
  allPermissions,
  labels,
  onClose,
  onSave,
  onReset,
  onToggle,
}: UserPermissionsDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {labels.titlePrefix}: {editingUser?.name} ({editingUser?.email})
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {labels.rolePrefix}: <strong>{editingUser?.role}</strong>. {labels.subtitleSuffix}
          </Typography>
          <PermissionsList
            allPermissions={allPermissions}
            selectedPermissions={selectedPermissions}
            onToggle={onToggle}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReset} disabled={saving} color="warning">
          {labels.resetDefaults}
        </Button>
        <Button onClick={onClose} disabled={saving}>
          {labels.cancel}
        </Button>
        <Button onClick={onSave} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={20} color="inherit" /> : labels.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
